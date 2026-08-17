import { DuplicateSentencePair, RepetitionReport } from './types';
import { SentenceEmbedding } from './Embeddings';
import { Stemmer } from '../pipeline/Stemmer';

/**
 * Repetition detection for the expert engine.
 *
 * Combines four deterministic signals:
 *  - filler-word density ("basically", "you know", ...),
 *  - content-word type-token ratio (lexical redundancy),
 *  - repeated content n-grams across the answer,
 *  - near-duplicate sentences (token overlap + embedding cosine).
 *
 * `score` starts at 10 and deducts per violation, so it stays explainable.
 */

const FILLER_PHRASES = [
  'basically', 'actually', 'literally', 'you know', 'sort of', 'kind of', 'stuff',
  'things', 'um', 'uh', 'i guess', 'somewhat', 'pretty much', 'in my opinion',
  'i mean', 'like', 'just so', 'as such',
];

const CONTENT_MIN_LENGTH = 3;

export function detectRepetition(sentences: SentenceEmbedding[]): RepetitionReport {
  if (sentences.length === 0) {
    return {
      score: 10,
      fillerCount: 0,
      fillerRatio: 0,
      typeTokenRatio: 1,
      repeatedChunks: [],
      duplicateSentencePairs: [],
    };
  }

  const allTokens = sentences.flatMap(s => s.tokens);
  const totalTokens = allTokens.length;

  // 1. Filler density.
  const normalizedText = sentences.map(s => s.text.toLowerCase()).join(' \n ');
  let fillerCount = 0;
  for (const filler of FILLER_PHRASES) {
    const re = new RegExp(`(^|\\s)${escapeRegExp(filler)}(\\s|$|\\.|,|\\n)`, 'g');
    const matches = normalizedText.match(re);
    if (matches) fillerCount += matches.length;
  }
  const fillerRatio = totalTokens > 0 ? fillerCount / totalTokens : 0;

  // 2. Content-word type-token ratio.
  const contentTokens = allTokens.filter(t => t.length >= CONTENT_MIN_LENGTH);
  const uniqueContent = new Set(contentTokens);
  const typeTokenRatio = contentTokens.length > 0 ? uniqueContent.size / contentTokens.length : 1;

  // 3. Repeated content n-grams (stemmed, length 3).
  const repeatedChunks = findRepeatedChunks(sentences);

  // 4. Near-duplicate sentence pairs.
  const duplicateSentencePairs = findDuplicateSentencePairs(sentences);

  // Score synthesis.
  let score = 10;

  if (fillerRatio > 0.12) score -= 2.0;
  else if (fillerRatio > 0.08) score -= 1.0;

  if (typeTokenRatio < 0.45) score -= Math.min(2.5, (0.45 - typeTokenRatio) / 0.45 * 2.5);

  for (let i = 0; i < Math.min(3, repeatedChunks.length); i++) score -= 0.6;
  for (let i = 0; i < Math.min(2, duplicateSentencePairs.length); i++) score -= 1.0;

  return {
    score: round1(Math.max(0, Math.min(10, score))),
    fillerCount,
    fillerRatio: round1(fillerRatio),
    typeTokenRatio: round1(typeTokenRatio),
    repeatedChunks,
    duplicateSentencePairs,
  };
}

function findRepeatedChunks(sentences: SentenceEmbedding[]): string[] {
  const chunkCounts = new Map<string, number>();
  const chunkSurfaces = new Map<string, string>();

  for (const sentence of sentences) {
    const stems = sentence.tokens.map(t => Stemmer.stem(t));
    for (let i = 0; i + 3 <= stems.length; i++) {
      const window = stems.slice(i, i + 3);
      if (window.some(t => t.length < CONTENT_MIN_LENGTH)) continue;
      const key = window.join(' ');
      chunkCounts.set(key, (chunkCounts.get(key) || 0) + 1);
      if (!chunkSurfaces.has(key)) chunkSurfaces.set(key, sentence.tokens.slice(i, i + 3).join(' '));
    }
  }

  const repeated: { key: string; surface: string; count: number }[] = [];
  for (const [key, count] of chunkCounts) {
    if (count >= 2) repeated.push({ key, surface: chunkSurfaces.get(key) || key, count });
  }

  // Longest first, then most frequent — the most salient redundancy on top.
  repeated.sort((a, b) => b.key.split(' ').length - a.key.split(' ').length || b.count - a.count);
  return repeated.slice(0, 5).map(r => r.surface);
}

function findDuplicateSentencePairs(sentences: SentenceEmbedding[]): DuplicateSentencePair[] {
  const pairs: DuplicateSentencePair[] = [];
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const a = sentences[i];
      const b = sentences[j];
      if (a.tokens.length < 4 || b.tokens.length < 4) continue;

      const setA = new Set(a.tokens);
      const setB = new Set(b.tokens);
      let shared = 0;
      for (const t of setA) if (setB.has(t)) shared++;
      const union = setA.size + setB.size - shared;
      const jaccard = union > 0 ? shared / union : 0;

      if (jaccard >= 0.8) {
        pairs.push({ a: i, b: j, overlap: round1(jaccard) });
        continue;
      }

      let dot = 0;
      for (let k = 0; k < a.embedding.length; k++) dot += a.embedding[k] * b.embedding[k];
      if (dot >= 0.95) pairs.push({ a: i, b: j, overlap: round1(Math.max(jaccard, dot)) });
    }
  }
  return pairs;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
