import { ReadabilityReport } from './types';
import { SentenceEmbedding } from './Embeddings';

/**
 * Readability analysis (Flesch-style) for the expert engine.
 *
 * Produces deterministic, dependency-free metrics:
 *  - Flesch reading ease 0-100 and Flesch-Kincaid grade level,
 *  - average sentence/word length signals,
 *  - lexical diversity (type-token ratio over content tokens).
 *
 * `score` maps reading ease onto 0-10: FRE 100 -> 10, FRE 60 -> 5, FRE 20 -> 0.
 */

/** Stop words excluded from the lexical-diversity numerator. */
const DIVERSITY_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'it', 'its', 'this', 'that',
  'these', 'those', 'as', 'by', 'from', 'we', 'you', 'they', 'our', 'their', 'there',
  'then', 'than', 'so', 'if', 'when', 'can', 'will', 'would', 'do', 'does', 'did',
  'have', 'has', 'had', 'not', 'no', 'about', 'also', 'just', 'very', 'i', 'he', 'she',
  'my', 'his', 'her', 'me', 'him', 'us', 'them', 'to', 'which', 'what', 'who',
]);

/**
 * Approximate syllable count per word (deterministic, conservative).
 * Handles silent-e and -es/-ed endings; "y" counts as a vowel between consonants.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase();
  if (!w) return 1;
  if (w.length <= 3) return 1;

  let count = (w.match(/[aeiouy]+/g) || []).length;
  if (count === 0) count = 1;

  if (w.endsWith('e') && !w.endsWith('le') && w.length > 4) count = Math.max(1, count - 1);
  if ((w.endsWith('es') || w.endsWith('ed')) && count > 1) count -= 1;

  return Math.max(1, count);
}

export function analyzeReadability(sentences: SentenceEmbedding[]): ReadabilityReport {
  const allTokens = sentences.flatMap(s => s.tokens);
  const wordCount = allTokens.length;
  const sentenceCount = sentences.length;

  if (wordCount === 0 || sentenceCount === 0) {
    return {
      score: 0,
      readingEase: 0,
      gradeLevel: 0,
      avgWordsPerSentence: 0,
      avgSyllablesPerWord: 0,
      longWordRatio: 0,
      lexicalDiversity: 0,
    };
  }

  const syllableCount = allTokens.reduce((sum, t) => sum + countSyllables(t), 0);
  const longWordCount = allTokens.filter(t => t.length >= 6).length;

  const readingEase = clamp(
    206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount),
    0,
    100,
  );
  const gradeLevel = clamp(
    0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59,
    0,
    25,
  );

  const contentTokens = allTokens.filter(t => !DIVERSITY_STOPWORDS.has(t));
  const uniqueContent = new Set(contentTokens);
  const lexicalDiversity = contentTokens.length > 0 ? uniqueContent.size / contentTokens.length : 1;

  return {
    score: round1(clamp((readingEase - 20) / 8, 0, 10)),
    readingEase: round1(readingEase),
    gradeLevel: round1(gradeLevel),
    avgWordsPerSentence: round1(wordCount / sentenceCount),
    avgSyllablesPerWord: round1(syllableCount / wordCount),
    longWordRatio: round1(longWordCount / wordCount),
    lexicalDiversity: round1(lexicalDiversity),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
