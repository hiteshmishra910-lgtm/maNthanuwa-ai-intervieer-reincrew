import { Contradiction, ContradictionReport } from './types';
import { ParsedSentence, sentenceStemTokens } from './syntax';
import { SentenceEmbedding } from './Embeddings';
import { Normalizer } from '../pipeline/Normalizer';
import { Tokenizer } from '../pipeline/Tokenizer';
import { Stemmer } from '../pipeline/Stemmer';

/**
 * Contradiction detection for the expert engine.
 *
 * Two deterministic signals:
 *  1. A curated rule table of contradictory concept poles (e.g. FIFO vs LIFO, O(1) vs O(N)
 *     without worst-case qualification, single vs multiple inheritance). Each pole is a set of
 *     surface phrases; a rule fires when both poles appear in the answer.
 *  2. Affirm/negate pairs — two sentences that discuss the same claim (shared significant
 *     tokens + similar embeddings) where one is negated and the other is not.
 *
 * `score` starts at 10 and deducts per contradiction.
 */

interface ContradictionRule {
  id: string;
  poleA: string[];
  poleB: string[];
  severity: Contradiction['severity'];
  explanation: (a: string, b: string) => string;
  /** Suppression words: when present in either sentence, the rule does not fire. */
  suppress?: string[];
  /** When true, the two sentences must also share at least one content token. */
  requireSharedContent?: boolean;
}

const RULES: ContradictionRule[] = [
  {
    id: 'fifo_lifo',
    poleA: ['fifo', 'first in first out'],
    poleB: ['lifo', 'last in first out'],
    severity: 'high',
    requireSharedContent: true,
    explanation: () => 'Described the same structure as both FIFO and LIFO, which are mutually exclusive.',
  },
  {
    id: 'complexity_o1_on',
    poleA: ['o(1)', 'constant time'],
    poleB: ['o(n)', 'linear time'],
    severity: 'high',
    suppress: ['worst', 'collis'],
    requireSharedContent: true,
    explanation: () => 'Claimed the same operation is both O(1) and O(N) without qualifying worst case / collisions.',
  },
  {
    id: 'java_inheritance',
    poleA: ['single inheritance', 'inherits from one class', 'extends one class', 'one parent class'],
    poleB: ['multiple inheritance', 'extends multiple classes', 'multiple parent classes'],
    severity: 'medium',
    requireSharedContent: true,
    explanation: () => 'Asserted both single and multiple class inheritance in the same answer.',
  },
  {
    id: 'always_never',
    poleA: ['always'],
    poleB: ['never'],
    severity: 'medium',
    requireSharedContent: true,
    explanation: () => 'Used both "always" and "never" for the same claim.',
  },
  {
    id: 'increase_decrease',
    poleA: ['increases', 'increasing', 'grows', 'rises'],
    poleB: ['decreases', 'decreasing', 'shrinks', 'falls'],
    severity: 'medium',
    requireSharedContent: true,
    explanation: () => 'Claimed the same quantity both increases and decreases.',
  },
];

interface CompiledRule {
  rule: ContradictionRule;
  poleA: string[][];
  poleB: string[][];
}

const COMPILED_RULES: CompiledRule[] = RULES.map(rule => ({
  rule,
  poleA: compilePoles(rule.poleA),
  poleB: compilePoles(rule.poleB),
}));

function compilePoles(phrases: string[]): string[][] {
  return phrases.map(phrase =>
    Tokenizer.tokenize(Normalizer.normalize(phrase)).map(t => Stemmer.stem(t)),
  );
}

export function detectContradictions(
  sentences: SentenceEmbedding[],
  parsed: ParsedSentence[],
  matchedConcepts: Set<string>,
): ContradictionReport {
  const contradictions: Contradiction[] = [];
  const stemmed = parsed.map(sentenceStemTokens);

  // 1. Curated rule table.
  for (const { rule, poleA, poleB } of COMPILED_RULES) {
    const aSentence = findPoleSentence(stemmed, parsed, poleA);
    const bSentence = findPoleSentence(stemmed, parsed, poleB);
    if (aSentence === -1 || bSentence === -1) continue;
    if (aSentence === bSentence) continue;

    const sentenceText = `${sentences[aSentence].text} ${sentences[bSentence].text}`.toLowerCase();
    if (rule.suppress && rule.suppress.some(w => sentenceText.includes(w))) continue;
    if (rule.requireSharedContent && !shareContent(stemmed[aSentence], stemmed[bSentence])) continue;

    contradictions.push({
      ruleId: rule.id,
      sentenceA: aSentence,
      sentenceB: bSentence,
      explanation: rule.explanation(sentences[aSentence].text, sentences[bSentence].text),
      severity: rule.severity,
    });
  }

  // 2. Affirm vs negate the same claim.
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i];
      const b = parsed[j];
      if (a.tokens.length < 4 || b.tokens.length < 4) continue;
      if (a.hasNegation === b.hasNegation) continue;
      if (!mentionsConcept(a, matchedConcepts) && !mentionsConcept(b, matchedConcepts)) continue;

      const shared = significantShared(stemmed[i], stemmed[j]);
      if (shared < 2) continue;

      const cosine = cosineBetween(sentences[i], sentences[j]);
      if (cosine < 0.6) continue;

      contradictions.push({
        ruleId: 'affirm_negate',
        sentenceA: a.hasNegation ? j : i,
        sentenceB: a.hasNegation ? i : j,
        explanation: 'The same claim is affirmed in one sentence and negated in another.',
        severity: 'medium',
      });
    }
  }

  const penalty = contradictions.reduce((sum, c) => sum + SEVERITY_PENALTY[c.severity], 0);
  return {
    score: round1(Math.max(0, Math.min(10, 10 - penalty))),
    contradictions,
  };
}

const SEVERITY_PENALTY: Record<Contradiction['severity'], number> = {
  high: 2.0,
  medium: 1.0,
  low: 0.5,
};

function findPoleSentence(
  stemmed: string[][],
  parsed: ParsedSentence[],
  poles: string[][],
): number {
  for (let i = 0; i < stemmed.length; i++) {
    for (const pole of poles) {
      const at = indexOfSequence(stemmed[i], pole);
      if (at !== -1 && !isNegated(parsed[i], at)) return i;
    }
  }
  return -1;
}

function indexOfSequence(tokens: string[], sequence: string[]): number {
  if (sequence.length === 0 || sequence.length > tokens.length) return -1;
  outer:
  for (let i = 0; i <= tokens.length - sequence.length; i++) {
    for (let j = 0; j < sequence.length; j++) {
      if (tokens[i + j] !== sequence[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** A pole is "negated" when a negation word sits within the 3 tokens before it. */
function isNegated(sentence: ParsedSentence, startIndex: number): boolean {
  const from = Math.max(0, startIndex - 3);
  for (let i = from; i < startIndex; i++) {
    if (sentence.tokens[i].isNegation) return true;
  }
  return false;
}

function shareContent(a: string[], b: string[]): boolean {
  return significantShared(a, b) >= 1;
}

function significantShared(a: string[], b: string[]): number {
  const setB = new Set(b);
  const seen = new Set<string>();
  let count = 0;
  for (const t of a) {
    if (t.length < 4 || seen.has(t)) continue;
    seen.add(t);
    if (setB.has(t)) count++;
  }
  return count;
}

function mentionsConcept(sentence: ParsedSentence, matched: Set<string>): boolean {
  const text = sentence.text.toLowerCase();
  for (const concept of matched) {
    const base = concept.replace(/_/g, ' ');
    if (text.includes(base)) return true;
    if (base.endsWith('s') && text.includes(base.slice(0, -1))) return true;
  }
  return false;
}

function cosineBetween(a: SentenceEmbedding, b: SentenceEmbedding): number {
  let dot = 0;
  for (let i = 0; i < a.embedding.length; i++) dot += a.embedding[i] * b.embedding[i];
  return dot;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
