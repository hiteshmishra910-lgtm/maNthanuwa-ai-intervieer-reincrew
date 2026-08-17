import { Normalizer } from '../pipeline/Normalizer';
import { Tokenizer } from '../pipeline/Tokenizer';

/**
 * Lightweight subword embedding engine (FastText-style hashing trick).
 *
 * Deliberately dependency-free and deterministic:
 *  - each token is expanded into character n-grams (n = 3..6) plus the whole token,
 *  - every n-gram is hashed to a fixed-size dimension via FNV-1a and accumulated with a
 *    signed (+1/-1) contribution (the SGD-style hashing trick),
 *  - the resulting vector is unit-normalised, so similarity reduces to cosine distance.
 *
 * Character n-grams give out-of-vocabulary robustness: "inheritance" and "inherits" share
 * n-grams ("inhe", "herit", ...) even though they do not share a stem, which is exactly the
 * paraphrase recall the expert engine needs without shipping any model weights.
 */

export const DEFAULT_EMBEDDING_DIM = 256;

/** Lightweight words whose signal is mostly syntactic — down-weighted, never removed. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that',
  'these', 'those', 'as', 'by', 'from', 'we', 'you', 'they', 'our', 'their', 'there',
  'then', 'than', 'so', 'if', 'when', 'can', 'will', 'would', 'do', 'does', 'did',
  'have', 'has', 'had', 'not', 'no', 'but', 'about', 'also', 'just', 'very',
]);

const NGRAM_MIN = 3;
const NGRAM_MAX = 6;

/** FNV-1a 32-bit — deterministic, well distributed, cheap. */
export function hashString32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function signFromHash(hash: number): number {
  return (hash & 1) === 0 ? 1 : -1;
}

/**
 * Embed a single phrase (normalized, tokenized, lower-cased) into a fixed-size vector.
 *
 * @param phrase     raw text to embed
 * @param dim        embedding dimensionality
 * @param boostStop  when false, stop words receive a reduced weight instead of none
 */
export function embedPhrase(phrase: string, dim: number = DEFAULT_EMBEDDING_DIM): Float32Array {
  const vector = new Float32Array(dim);
  if (!phrase) return vector;

  const normalized = Normalizer.normalize(phrase);
  const tokens = Tokenizer.tokenize(normalized);

  for (const token of tokens) {
    const weight = STOPWORDS.has(token) ? 0.3 : 1.0;
    accumulateToken(vector, token, weight, dim);
  }

  normalizeInPlace(vector);
  return vector;
}

function accumulateToken(vector: Float32Array, token: string, weight: number, dim: number): void {
  // Whole-token hash keeps the raw surface meaningful even when it is short.
  const tokenHash = hashString32(token);
  vector[tokenHash % dim] += signFromHash(tokenHash) * weight;

  const bounded = `<${token}>`;
  for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
    for (let i = 0; i + n <= bounded.length; i++) {
      const gram = bounded.slice(i, i + n);
      const h = hashString32(gram);
      vector[h % dim] += signFromHash(h) * weight;
    }
  }
}

export function embedTokens(tokens: string[], dim: number = DEFAULT_EMBEDDING_DIM): Float32Array {
  const vector = new Float32Array(dim);
  if (!tokens || tokens.length === 0) return vector;
  for (const token of tokens) {
    const weight = STOPWORDS.has(token) ? 0.3 : 1.0;
    accumulateToken(vector, token, weight, dim);
  }
  normalizeInPlace(vector);
  return vector;
}

/** Unit-normalise in place (skips the zero vector). */
export function normalizeInPlace(vector: Float32Array): void {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return;
  for (let i = 0; i < vector.length; i++) vector[i] /= norm;
}

/** Cosine similarity between two equal-length vectors (0 when either is empty/zero). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  const denom = Math.sqrt(aNorm) * Math.sqrt(bNorm);
  if (denom === 0) return 0;
  return Math.max(0, Math.min(1, dot / denom));
}

/** Average (then re-normalised) embedding of several phrases — e.g. all aliases of a concept. */
export function embedPhrases(phrases: string[], dim: number = DEFAULT_EMBEDDING_DIM): Float32Array {
  const mean = new Float32Array(dim);
  let count = 0;
  for (const phrase of phrases) {
    const vec = embedPhrase(phrase, dim);
    if (!isZero(vec)) {
      for (let i = 0; i < dim; i++) mean[i] += vec[i];
      count++;
    }
  }
  if (count === 0) return mean;
  for (let i = 0; i < dim; i++) mean[i] /= count;
  normalizeInPlace(mean);
  return mean;
}

function isZero(vector: Float32Array): boolean {
  for (let i = 0; i < vector.length; i++) {
    if (vector[i] !== 0) return false;
  }
  return true;
}

export interface SentenceEmbedding {
  text: string;
  tokens: string[];
  embedding: Float32Array;
}

export function embedSentences(text: string, dim: number = DEFAULT_EMBEDDING_DIM): SentenceEmbedding[] {
  if (!text) return [];
  const rawSentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(Boolean);

  return rawSentences.map(raw => {
    const tokens = Tokenizer.tokenize(Normalizer.normalize(raw));
    return {
      text: raw,
      tokens,
      embedding: embedTokens(tokens, dim),
    };
  });
}
