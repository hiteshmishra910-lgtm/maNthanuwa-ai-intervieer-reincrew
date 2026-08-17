import { SentenceEmbedding } from './Embeddings';
import { Stemmer } from '../pipeline/Stemmer';

/**
 * Lightweight rule-based syntax layer for the expert engine.
 *
 * Not a full NLP dependency parser — deliberately. It is deterministic, dependency-free and
 * runs in microseconds, producing just enough structure for the grammar, readability and
 * contradiction analyzers:
 *
 *  - POS-tagged tokens (closed-class lists + suffix heuristics),
 *  - a dependency-ish spine per sentence: subject -> main verb -> object,
 *  - clause boundaries (split on conjunctions),
 *  - negation flags (which the contradiction detector uses for polarity).
 *
 * Parsing is intentionally conservative: every tag is a heuristic and nothing here mutates
 * shared state.
 */

export type PosTag =
  | 'DET'
  | 'PRON'
  | 'NOUN'
  | 'VERB'
  | 'AUX'
  | 'ADJ'
  | 'ADV'
  | 'PREP'
  | 'CONJ'
  | 'NEG'
  | 'NUM'
  | 'OTHER';

export interface ParsedToken {
  text: string;
  pos: PosTag;
  isNegation: boolean;
  isAuxiliary: boolean;
}

export type DependencyType = 'ROOT' | 'SBJ' | 'OBJ' | 'NEG' | 'AUX';

export interface DependencyRelation {
  type: DependencyType;
  /** Index of the head token. */
  head: number;
  /** Index of the dependent token. */
  dep: number;
}

export interface ParsedSentence {
  index: number;
  text: string;
  tokens: ParsedToken[];
  /** Token index of the sentence's subject head, or -1. */
  subjectIndex: number;
  /** Token index of the main verb, or -1. */
  verbIndex: number;
  /** Token index of the direct object, or -1. */
  objectIndex: number;
  /** Contiguous token-index ranges per clause (split on conjunctions). */
  clauses: number[][];
  hasNegation: boolean;
  relations: DependencyRelation[];
}

const DETERMINERS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'each', 'every', 'some', 'any',
  'no', 'another', 'both', 'such', 'several', 'few', 'many', 'much',
]);

const PRONOUNS = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'our', 'their', 'its', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'this', 'that', 'these', 'those',
]);

const PREPOSITIONS = new Set([
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'into', 'through', 'over',
  'under', 'between', 'among', 'against', 'during', 'without', 'via', 'per', 'as', 'after',
  'before', 'within', 'about', 'across', 'behind', 'above', 'below', 'along', 'around',
  'towards', 'than',
]);

const CONJUNCTIONS = new Set([
  'and', 'or', 'but', 'because', 'however', 'although', 'unless', 'while', 'so',
  'if', 'though', 'yet', 'nor', 'whereas', 'since', 'when', 'hence', 'thus',
]);

const AUXILIARIES = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does', 'did',
  'have', 'has', 'had', 'will', 'would', 'shall', 'should', 'can', 'could', 'may',
  'might', 'must',
]);

const NEGATION_WORDS = new Set([
  'not', 'never', 'no', 'isnt', 'arent', 'wasnt', 'werent', 'dont', 'doesnt', 'didnt',
  'wont', 'wouldnt', 'shouldnt', 'cant', 'cannot', 'couldnt', 'mustnt', 'neither', 'nor',
  'without', 'nothing', 'nobody', 'none', 'hardly', 'barely', 'scarcely',
]);

const NUMBERS = new Set([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'first', 'second', 'third', 'fourth', 'fifth',
]);

/** Base forms of common verbs — used to tag inflected surfaces as VERB. */
export const COMMON_VERB_BASES = new Set([
  'work', 'play', 'run', 'go', 'come', 'use', 'store', 'return', 'push', 'pop',
  'process', 'read', 'write', 'create', 'implement', 'operate', 'manage', 'handle',
  'provide', 'need', 'want', 'know', 'think', 'say', 'take', 'get', 'make', 'call',
  'allow', 'keep', 'sort', 'search', 'insert', 'delete', 'update', 'contain', 'hold',
  'support', 'follow', 'maintain', 'grow', 'reduce', 'increase', 'change', 'build',
  'compile', 'execute', 'happen', 'result', 'cause', 'ensure', 'help', 'add', 'remove',
  'move', 'send', 'receive', 'store', 'access', 'fetch', 'load', 'save', 'share', 'map',
  'look', 'see', 'show', 'start', 'stop', 'begin', 'end', 'find', 'give', 'put', 'let',
  'mean', 'represent', 'define', 'describe', 'explain', 'discuss', 'mention', 'choose',
  'select', 'compare', 'connect', 'link', 'apply', 'use', 'avoid', 'prevent', 'solve',
  'fix', 'test', 'check', 'verify', 'measure', 'compute', 'calculate', 'assign', 'replace',
  'convert', 'transform', 'divide', 'split', 'merge', 'combine', 'extend', 'inherit',
]);

const ADJECTIVE_SUFFIXES = ['ful', 'ous', 'ive', 'able', 'ible', 'al', 'ent', 'ant', 'ic', 'ary', 'ish'];
const NOUN_SUFFIXES = ['tion', 'sion', 'ment', 'ness', 'ity', 'ance', 'ence', 'ism', 'ist', 'er', 'or'];
const VERB_SUFFIXES = ['ize', 'ify', 'ate', 'en'];

function isCommonVerbSurface(lower: string): boolean {
  if (COMMON_VERB_BASES.has(lower)) return true;
  const candidates: string[] = [];
  if (lower.endsWith('ies') && lower.length > 4) candidates.push(lower.slice(0, -3) + 'y');
  if (lower.endsWith('es') && lower.length > 3) {
    candidates.push(lower.slice(0, -2), lower.slice(0, -1));
  }
  if (lower.endsWith('s') && lower.length > 3) candidates.push(lower.slice(0, -1));
  if (lower.endsWith('ing') && lower.length > 5) {
    candidates.push(lower.slice(0, -3), lower.slice(0, -3) + 'e');
  }
  if (lower.endsWith('ed') && lower.length > 4) {
    candidates.push(lower.slice(0, -2), lower.slice(0, -2) + 'e');
  }
  if (lower.endsWith('en') && lower.length > 4) candidates.push(lower.slice(0, -2));
  return candidates.some(c => c !== lower && COMMON_VERB_BASES.has(c));
}

export function tagToken(text: string): ParsedToken {
  const lower = text.toLowerCase();
  const isNegation = NEGATION_WORDS.has(lower);
  let pos: PosTag;

  if (isNegation) pos = 'NEG';
  else if (AUXILIARIES.has(lower)) pos = 'AUX';
  else if (DETERMINERS.has(lower)) pos = 'DET';
  else if (PRONOUNS.has(lower)) pos = 'PRON';
  else if (CONJUNCTIONS.has(lower)) pos = 'CONJ';
  else if (PREPOSITIONS.has(lower)) pos = 'PREP';
  else if (NUMBERS.has(lower) || /^\d+$/.test(lower)) pos = 'NUM';
  else if (isCommonVerbSurface(lower)) pos = 'VERB';
  else if (lower.endsWith('ly') && lower.length > 4) pos = 'ADV';
  else if (ADJECTIVE_SUFFIXES.some(s => lower.endsWith(s)) && lower.length > 4) pos = 'ADJ';
  else if (VERB_SUFFIXES.some(s => lower.endsWith(s))) pos = 'VERB';
  else if (lower.endsWith('ing') || lower.endsWith('ed') || lower.endsWith('en')) pos = 'VERB';
  else if (NOUN_SUFFIXES.some(s => lower.endsWith(s))) pos = 'NOUN';
  else pos = 'OTHER';

  return { text: lower, pos, isNegation, isAuxiliary: pos === 'AUX' };
}

function isNounish(pos: PosTag): boolean {
  return pos === 'NOUN' || pos === 'PRON' || pos === 'OTHER';
}

function isVerbish(pos: PosTag): boolean {
  return pos === 'VERB' || pos === 'AUX';
}

/**
 * Split a token array into contiguous clause ranges at conjunction boundaries. The
 * conjunction token itself starts the next clause.
 */
function splitClauses(tokens: ParsedToken[]): number[][] {
  const clauses: number[][] = [];
  let start = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].pos === 'CONJ') {
      clauses.push(range(start, i));
      start = i;
    }
  }
  clauses.push(range(start, tokens.length));
  return clauses.filter(c => c.length > 0);
}

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i < end; i++) out.push(i);
  return out;
}

export function parseSentence(sentence: SentenceEmbedding, index: number): ParsedSentence {
  const tokens = sentence.tokens.map(tagToken);
  const relations: DependencyRelation[] = [];
  const clauses = splitClauses(tokens);

  // Subject: first nounish token before the main verb, skipping prep/det/neg lead-ins.
  const firstClause = clauses[0] || [];
  let subjectIndex = -1;
  let verbIndex = -1;
  let objectIndex = -1;

  for (const idx of firstClause) {
    const t = tokens[idx];
    if (isVerbish(t.pos)) {
      verbIndex = idx;
      break;
    }
    if (isNounish(t.pos) && subjectIndex === -1 && !t.isNegation) {
      subjectIndex = idx;
    }
  }

  // Direct object: first nounish token strictly after the main verb.
  if (verbIndex !== -1) {
    relations.push({ type: 'ROOT', head: verbIndex, dep: verbIndex });
    for (let i = verbIndex + 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.pos === 'CONJ') break;
      if (isNounish(t.pos) && t.pos !== 'PRON' || (t.pos === 'PRON' && i > verbIndex + 1)) {
        objectIndex = i;
        break;
      }
    }
  }

  if (subjectIndex !== -1 && verbIndex !== -1) {
    relations.push({ type: 'SBJ', head: verbIndex, dep: subjectIndex });
  }
  if (verbIndex !== -1 && objectIndex !== -1) {
    relations.push({ type: 'OBJ', head: verbIndex, dep: objectIndex });
  }

  // Negation relations: negation word -> following verb/aux, else -> following token.
  let hasNegation = false;
  tokens.forEach((t, idx) => {
    if (!t.isNegation) return;
    hasNegation = true;
    let target = -1;
    for (let i = idx + 1; i < tokens.length; i++) {
      if (tokens[i].pos === 'CONJ') break;
      if (isVerbish(tokens[i].pos)) {
        target = i;
        break;
      }
    }
    if (target === -1 && idx + 1 < tokens.length) target = idx + 1;
    if (target !== -1) relations.push({ type: 'NEG', head: target, dep: idx });
  });

  // Auxiliary relations: aux -> main verb.
  tokens.forEach((t, idx) => {
    if (t.isAuxiliary && verbIndex !== -1 && idx !== verbIndex) {
      relations.push({ type: 'AUX', head: verbIndex, dep: idx });
    }
  });

  return {
    index,
    text: sentence.text,
    tokens,
    subjectIndex,
    verbIndex,
    objectIndex,
    clauses,
    hasNegation,
    relations,
  };
}

export function parseDependencies(sentences: SentenceEmbedding[]): ParsedSentence[] {
  return sentences.map((s, i) => parseSentence(s, i));
}

/** Stemmed surface of a sentence (used by grammar/contradiction checks). */
export function sentenceStemTokens(parsed: ParsedSentence): string[] {
  return parsed.tokens.map(t => Stemmer.stem(t.text));
}
