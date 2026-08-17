import type { ExpertConcept, ExpertDimension } from './WeightedRubric';
import { embedPhrases, embedSentences, cosineSimilarity, SentenceEmbedding, DEFAULT_EMBEDDING_DIM } from './Embeddings';
import { PhraseMap, tokenizeForPhrase } from './SynonymMap';
import { Normalizer } from '../pipeline/Normalizer';
import { Stemmer } from '../pipeline/Stemmer';

/**
 * Semantic matcher — fuses three signals into a single transparent similarity decision:
 *
 *  1. LEXICAL   phrase-map hits (exact alias / stem-matched phrase)          -> decisive
 *  2. STEM      stem-token containment (order-independent surface coverage)  -> medium
 *  3. EMBEDDING subword-n-gram cosine similarity (paraphrase recall)         -> recall
 *
 * `confidence` is the weighted combination of all three; `similarityScore` is the pure
 * embedding cosine, so callers can explain *why* a paraphrase was accepted.
 */

export type ExpertMatchKind = 'lexical' | 'stem' | 'semantic' | 'none';

export interface ConceptSemanticMatch {
  conceptId: string;
  matched: boolean;
  confidence: number;
  similarityScore: number;
  matchKind: ExpertMatchKind;
  matchedPhrases: string[];
  bestSentenceIndex: number;
  satisfiedDimensions: ExpertDimension[];
}

export interface SemanticMatcherOptions {
  lexicalWeight: number;
  stemWeight: number;
  embeddingWeight: number;
  matchThreshold: number;
  /** Stem containment at/above which a match is reported as `stem` rather than `semantic`. */
  stemKindThreshold: number;
  /** Embedding cosine at/above which a sentence counts as discussing a dimension. */
  dimensionThresholds: Record<ExpertDimension, number>;
  dim: number;
}

export const DEFAULT_SEMANTIC_OPTIONS: SemanticMatcherOptions = {
  lexicalWeight: 0.55,
  stemWeight: 0.2,
  embeddingWeight: 0.25,
  matchThreshold: 0.52,
  stemKindThreshold: 0.6,
  dimensionThresholds: {
    definition: 0.5,
    mechanism: 0.48,
    purpose: 0.45,
    useCase: 0.42,
    limitations: 0.48,
    tradeoffs: 0.48,
    alternatives: 0.45,
    failureCases: 0.48,
    dependencies: 0.42,
  },
  dim: DEFAULT_EMBEDDING_DIM,
};

const DIMENSION_TRIGGERS: Record<ExpertDimension, string[]> = {
  definition: ['is a', 'is an', 'means', 'refers to', 'defined as', 'stands for', 'describes', 'known as', 'called'],
  mechanism: ['works by', 'works through', 'internally', 'how it', 'steps', 'process', 'implementation', 'algorithm', 'mechanism', 'under the hood', 'operates'],
  purpose: ['used to', 'used for', 'purpose', 'goal', 'so that', 'in order to', 'to ensure', 'to provide', 'helps to', 'allows us to', 'benefit'],
  useCase: ['for example', 'use case', 'in practice', 'real world', 'scenario', 'when we', 'application', 'common use', 'such as'],
  limitations: ['limitation', 'downside', 'drawback', 'problem', 'issue', 'however', 'cannot', 'not suitable', 'fails', 'cons'],
  tradeoffs: ['trade-off', 'tradeoff', 'versus', 'depends', 'cost', 'pros and cons', 'balance', 'compromise'],
  alternatives: ['alternative', 'instead', 'other option', 'could also', 'another way', 'rather than', 'different approach'],
  failureCases: ['fails', 'crash', 'breaks', 'edge case', 'worst case', 'failure'],
  dependencies: ['depends on', 'requires', 'built on', 'built upon', 'uses', 'prerequisite', 'needs', 'relies on'],
};

const DIMENSION_REFERENCE: Record<ExpertDimension, string> = {
  definition: 'define what it is, what it means, describe what it is, what is',
  mechanism: 'how it works internally, the mechanism, the steps, how it operates, implementation details, how data flows',
  purpose: 'purpose, why we use it, what it is used for, goal, the benefit',
  useCase: 'use case, example, when to use it, application, real world scenario',
  limitations: 'limitation, drawback, downside, when it fails, not good for, the problem',
  tradeoffs: 'trade off, versus, pros and cons, cost and benefit, comparing options',
  alternatives: 'alternative, other options, instead of, a different approach',
  failureCases: 'failure, edge case, worst case, when it breaks, crash',
  dependencies: 'depends on, requires, built on top of, prerequisite, uses',
};

interface Surface {
  text: string;
  stemTokens: string[];
  embedding: Float32Array;
}

export class SemanticMatcher {
  private readonly phraseMap: PhraseMap;
  private readonly options: SemanticMatcherOptions;
  private readonly dimensionEmbeddings: Map<ExpertDimension, Float32Array>;

  constructor(phraseMap: PhraseMap, options: Partial<SemanticMatcherOptions> = {}) {
    this.phraseMap = phraseMap;
    this.options = { ...DEFAULT_SEMANTIC_OPTIONS, ...options };

    this.dimensionEmbeddings = new Map();
    for (const dim of Object.keys(DIMENSION_REFERENCE) as ExpertDimension[]) {
      this.dimensionEmbeddings.set(dim, embedPhrases([DIMENSION_REFERENCE[dim]], this.options.dim));
    }
  }

  matchConcept(concept: ExpertConcept, sentences: SentenceEmbedding[]): ConceptSemanticMatch {
    const surfaces = this.buildSurfaces(concept);
    if (surfaces.length === 0) {
      return {
        conceptId: concept.id,
        matched: false,
        confidence: 0,
        similarityScore: 0,
        matchKind: 'none',
        matchedPhrases: [],
        bestSentenceIndex: -1,
        satisfiedDimensions: [],
      };
    }

    let bestConfidence = 0;
    let bestKind: ExpertMatchKind = 'none';
    let bestSentence = -1;
    let bestSimilarity = 0;
    const matchedPhrases = new Set<string>();
    const conceptSentences: number[] = [];

    for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
      const sentence = sentences[sIdx];
      if (sentence.tokens.length === 0) continue;

      const lexical = this.lexicalHit(concept.id, sentence.tokens);
      if (lexical.hit) {
        conceptSentences.push(sIdx);
        for (const surface of lexical.surfaces) matchedPhrases.add(surface);
      }

      const { stem, bestSurface } = this.stemContainment(sentence, surfaces);
      const embedding = this.embeddingScore(sentence, surfaces);

      if (stem >= this.options.stemKindThreshold) conceptSentences.push(sIdx);

      const combined =
        this.options.lexicalWeight * (lexical.hit ? 1 : 0) +
        this.options.stemWeight * stem +
        this.options.embeddingWeight * embedding;

      if (combined > bestConfidence) {
        bestConfidence = combined;
        bestSentence = sIdx;
        bestSimilarity = embedding;
        if (lexical.hit) bestKind = 'lexical';
        else if (stem >= this.options.stemKindThreshold) bestKind = 'stem';
        else bestKind = 'semantic';
      }
      if (lexical.hit && bestSurface) matchedPhrases.add(bestSurface.text);
    }

    const matched = bestConfidence >= this.options.matchThreshold;
    const satisfiedDimensions = matched
      ? this.satisfiedDimensions(concept, sentences, conceptSentences, bestSentence)
      : [];

    return {
      conceptId: concept.id,
      matched,
      confidence: matched ? bestConfidence : bestConfidence,
      similarityScore: bestSimilarity,
      matchKind: matched ? (bestKind === 'none' ? 'semantic' : bestKind) : 'none',
      matchedPhrases: Array.from(matchedPhrases),
      bestSentenceIndex: bestSentence,
      satisfiedDimensions,
    };
  }

  private buildSurfaces(concept: ExpertConcept): Surface[] {
    const seen = new Set<string>();
    const surfaces: Surface[] = [];
    const push = (text: string) => {
      const normalized = Normalizer.normalize(text);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      surfaces.push({
        text,
        stemTokens: tokenizeForPhrase(text).map(t => Stemmer.stem(t)),
        embedding: embedPhrases([text], this.options.dim),
      });
    };
    push(concept.label);
    for (const alias of concept.aliases) push(alias);
    return surfaces;
  }

  private lexicalHit(conceptId: string, tokens: string[]): { hit: boolean; surfaces: string[] } {
    const hits: string[] = [];
    for (const match of this.phraseMap.find(tokens, 0)) {
      if (match.conceptIds.includes(conceptId)) hits.push(match.original);
    }
    return { hit: hits.length > 0, surfaces: hits };
  }

  private stemContainment(sentence: SentenceEmbedding, surfaces: Surface[]): { stem: number; bestSurface: Surface | null } {
    const sentenceStem = new Set(sentence.tokens.map(t => Stemmer.stem(t)));
    let best = 0;
    let bestSurface: Surface | null = null;
    for (const surface of surfaces) {
      if (surface.stemTokens.length === 0) continue;
      let present = 0;
      for (const tok of surface.stemTokens) {
        if (sentenceStem.has(tok)) present++;
      }
      const ratio = present / surface.stemTokens.length;
      if (ratio > best) {
        best = ratio;
        bestSurface = surface;
      }
    }
    return { stem: best, bestSurface };
  }

  private embeddingScore(sentence: SentenceEmbedding, surfaces: Surface[]): number {
    if (sentence.tokens.length === 0) return 0;
    let best = 0;
    for (const surface of surfaces) {
      if (surface.stemTokens.length === 0) continue;
      best = Math.max(best, cosineSimilarity(sentence.embedding, surface.embedding));
    }
    return best;
  }

  /**
   * Which expected dimensions of a concept the candidate actually explained, evaluated only
   * over the sentences that discuss the concept (to avoid cross-talk with unrelated content).
   */
  private satisfiedDimensions(
    concept: ExpertConcept,
    sentences: SentenceEmbedding[],
    conceptSentences: number[],
    bestSentenceIndex: number,
  ): ExpertDimension[] {
    const targets = new Set<number>(conceptSentences);
    if (bestSentenceIndex >= 0) targets.add(bestSentenceIndex);

    const satisfied: ExpertDimension[] = [];
    for (const dim of Object.keys(concept.dimensions) as ExpertDimension[]) {
      if (concept.dimensions[dim] <= 0.02) continue; // only expected dimensions
      const threshold = this.options.dimensionThresholds[dim];
      const reference = this.dimensionEmbeddings.get(dim);

      let done = false;
      for (const sIdx of targets) {
        const sentence = sentences[sIdx];
        if (this.hasTrigger(sentence.text, DIMENSION_TRIGGERS[dim])) {
          satisfied.push(dim);
          done = true;
          break;
        }
        if (reference && sentence.tokens.length > 0) {
          const cosine = cosineSimilarity(sentence.embedding, reference);
          if (cosine >= threshold) {
            satisfied.push(dim);
            done = true;
            break;
          }
        }
      }
      if (!done) continue;
    }
    return satisfied;
  }

  private hasTrigger(text: string, triggers: string[]): boolean {
    const normalized = Normalizer.normalize(text);
    for (const trigger of triggers) {
      if (normalized.includes(Normalizer.normalize(trigger))) return true;
    }
    return false;
  }

  static splitSentences(text: string): SentenceEmbedding[] {
    return embedSentences(text);
  }
}
