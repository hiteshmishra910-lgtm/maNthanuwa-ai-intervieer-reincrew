import { CONCEPT_REGISTRY } from '../pipeline/ConceptRegistry';
import { DomainPack } from '../pipeline/interfaces';
import { Normalizer } from '../pipeline/Normalizer';
import { Stemmer } from '../pipeline/Stemmer';
import dbmsPack from '../domainPacks/DBMS.json';
import networksPack from '../domainPacks/Networks.json';
import osPack from '../domainPacks/OS.json';
import systemDesignPack from '../domainPacks/SystemDesign.json';

/**
 * Synonym / phrase mapping surface for the expert engine.
 *
 * A `PhraseMap` indexes every surface (canonical label, alias, curated multi-word phrase) by
 * its first token and resolves which concepts a candidate utterance mentions, reporting the
 * longest match per position. Two matching lanes are compared:
 *  - raw tokens  -> `EXACT_ALIAS`
 *  - stemmed     -> `STEM_MATCH` (catches inflections like "pushing" ~ "push")
 *
 * `SynonymRegistry` is the process-wide singleton that seeds the map from the global concept
 * registry, the four domain packs, and a curated interview phrase table.
 */

export type MatchKind = 'EXACT_ALIAS' | 'STEM_MATCH';

export interface MatchedPhrase {
  conceptIds: string[];
  original: string;
  kind: MatchKind;
  weight: number;
  sentenceIndex: number;
  tokenStart: number;
  tokenEnd: number; // exclusive
  tokens: string[];
}

interface PhraseEntry {
  conceptIds: string[];
  original: string;
  rawTokens: string[];
  stemmedTokens: string[];
  kind: 'label' | 'alias' | 'phrase';
  weight: number;
}

/** Normalise a candidate utterance into the token stream used for phrase matching. */
export function tokenizeForPhrase(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export class PhraseMap {
  private entriesByStemmedFirst: Map<string, PhraseEntry[]>;
  private entriesByRawFirst: Map<string, PhraseEntry[]>;

  constructor() {
    this.entriesByStemmedFirst = new Map();
    this.entriesByRawFirst = new Map();
  }

  register(phrase: string, conceptIds: string[], kind: 'label' | 'alias' | 'phrase' = 'alias', weight = 1.0): void {
    const rawTokens = tokenizeForPhrase(Normalizer.normalize(phrase));
    if (rawTokens.length === 0) return;
    const stemmedTokens = rawTokens.map(t => Stemmer.stem(t));

    const entry: PhraseEntry = {
      conceptIds,
      original: phrase,
      rawTokens,
      stemmedTokens,
      kind,
      weight,
    };

    const stemFirst = stemmedTokens[0];
    const rawFirst = rawTokens[0];
    this.push(this.entriesByStemmedFirst, stemFirst, entry);
    this.push(this.entriesByRawFirst, rawFirst, entry);
  }

  private push(index: Map<string, PhraseEntry[]>, key: string, entry: PhraseEntry): void {
    const bucket = index.get(key) || [];
    bucket.push(entry);
    index.set(key, bucket);
  }

  get size(): number {
    return this.entriesByStemmedFirst.size;
  }

  /**
   * Find all phrase matches in a tokenised sentence, longest-first per start position.
   *
   * @param sentenceIndex   attribution index supplied by the caller (0 when free-form text)
   */
  find(sentenceTokens: string[], sentenceIndex = 0): MatchedPhrase[] {
    if (!sentenceTokens || sentenceTokens.length === 0) return [];
    const stemmed = sentenceTokens.map(t => Stemmer.stem(t));
    const matches: MatchedPhrase[] = [];

    for (let i = 0; i < sentenceTokens.length; i++) {
      const best = this.bestAt(sentenceTokens, stemmed, i);
      if (best) {
        matches.push({
          conceptIds: best.entry.conceptIds,
          original: best.entry.original,
          kind: best.kind,
          weight: best.entry.weight,
          sentenceIndex,
          tokenStart: i,
          tokenEnd: i + best.entry.stemmedTokens.length,
          tokens: sentenceTokens.slice(i, i + best.entry.stemmedTokens.length),
        });
        i += best.entry.stemmedTokens.length - 1;
      }
    }

    return matches;
  }

  private bestAt(sentenceTokens: string[], stemmed: string[], index: number):
    { entry: PhraseEntry; kind: MatchKind } | null {
    const candidates = new Map<PhraseEntry, MatchKind>();

    const stemFirst = stemmed[index];
    for (const entry of this.entriesByStemmedFirst.get(stemFirst) || []) {
      if (this.sequenceMatches(stemmed, index, entry.stemmedTokens)) {
        const rawMatched = this.sequenceMatches(sentenceTokens, index, entry.rawTokens);
        candidates.set(entry, rawMatched ? 'EXACT_ALIAS' : 'STEM_MATCH');
      }
    }

    const rawFirst = sentenceTokens[index];
    for (const entry of this.entriesByRawFirst.get(rawFirst) || []) {
      if (candidates.has(entry)) continue;
      if (this.sequenceMatches(sentenceTokens, index, entry.rawTokens)) {
        candidates.set(entry, 'EXACT_ALIAS');
      }
    }

    if (candidates.size === 0) return null;

    // Prefer the longest match, then the most specific kind.
    let bestEntry: PhraseEntry | null = null;
    let bestKind: MatchKind = 'STEM_MATCH';
    let bestLen = -1;
    for (const [entry, kind] of candidates) {
      const len = entry.stemmedTokens.length;
      if (len > bestLen || (len === bestLen && kind === 'EXACT_ALIAS' && bestKind === 'STEM_MATCH')) {
        bestEntry = entry;
        bestKind = kind;
        bestLen = len;
      }
    }
    return bestEntry ? { entry: bestEntry, kind: bestKind } : null;
  }

  private sequenceMatches(tokens: string[], start: number, expected: string[]): boolean {
    if (start + expected.length > tokens.length) return false;
    for (let j = 0; j < expected.length; j++) {
      if (tokens[start + j] !== expected[j]) return false;
    }
    return true;
  }
}

/** Curated multi-word interview surfaces that alias common concepts across domains. */
const EXPERT_PHRASE_TABLE: Record<string, { phrases: string[]; weight?: number }> = {
  lifo: { phrases: ['last in first out', 'last-in-first-out', 'lifo ordering', 'lifo order'] },
  fifo: { phrases: ['first in first out', 'first-in-first-out', 'fifo ordering', 'fifo order'] },
  stacks: { phrases: ['push and pop', 'push pop operation', 'call stack', 'undo operation'] },
  queues: { phrases: ['enqueue dequeue', 'task scheduling queue', 'printer queue'] },
  time_complexity: { phrases: ['big o notation', 'big o of n', 'order of growth', 'runtime complexity', 'asymptotic analysis', 'asymptotic complexity', 'time and space complexity'] },
  binary_search: { phrases: ['divide and conquer search', 'halving the search space', 'sorted array search'] },
  dynamic_programming: { phrases: ['optimal substructure', 'overlapping subproblems', 'memoization table', 'top down dp', 'bottom up dp'] },
  deadlock: { phrases: ['mutual exclusion', 'hold and wait', 'circular wait', 'no preemption', 'resource allocation graph'] },
  process: { phrases: ['process control block', 'pcb', 'running program', 'program in execution'] },
  virtual_memory: { phrases: ['page table', 'page fault', 'memory management unit', 'swap space', 'demand paging'] },
  scheduling: { phrases: ['cpu scheduling', 'time slice', 'context switch', 'round robin scheduling', 'shortest job first', 'first come first serve'] },
  sql: { phrases: ['structured query language', 'select query', 'join query', 'relational query'] },
  primary_key: { phrases: ['row identifier', 'unique row identifier', 'table identifier'] },
  foreign_key: { phrases: ['referential integrity', 'reference another table', 'cross table reference'] },
  normalization: { phrases: ['normal forms', 'reduce redundancy', 'remove duplicate data', 'first normal form', 'third normal form'] },
  acid: { phrases: ['acid properties', 'all or nothing transaction', 'transaction guarantees', 'atomic all or nothing'] },
  database_indexing: { phrases: ['b tree index', 'hash index', 'explain plan', 'query planner'] },
  inheritance: { phrases: ['parent class', 'child class', 'base class', 'derived class', 'extends another class', 'reuse code through subclassing'] },
  polymorphism: { phrases: ['runtime dispatch', 'compile time dispatch', 'method overriding', 'method overloading', 'same interface different behaviour'] },
  encapsulation: { phrases: ['data hiding', 'private fields', 'access modifiers', 'getters and setters'] },
  abstraction: { phrases: ['hide implementation details', 'essential characteristics', 'expose simple interface'] },
  http: { phrases: ['hypertext transfer protocol', 'request response cycle', 'port eighty'] },
  rest_api: { phrases: ['representational state transfer', 'stateless api', 'resource oriented', 'crud endpoints'] },
  jwt: { phrases: ['json web token', 'signed token', 'stateless auth token', 'header payload signature'] },
  load_balancing: { phrases: ['traffic distribution', 'least connections', 'round robin distribution', 'health check routing'] },
  caching: { phrases: ['cache hit', 'cache miss', 'least recently used', 'eviction policy', 'memory cache'] },
  containerization: { phrases: ['share host kernel', 'lightweight isolation', 'container runtime'] },
  cloud_computing: { phrases: ['pay as you go', 'on demand resources', 'elastic scaling'] },
  cicd: { phrases: ['continuous integration', 'continuous deployment', 'automated build pipeline'] },
  microservices: { phrases: ['independently deployable', 'api gateway', 'bounded context', 'service decomposition'] },
  modulation: { phrases: ['amplitude modulation', 'frequency modulation', 'carrier wave', 'modulation index'] },
  multiplexing: { phrases: ['time division multiplexing', 'frequency division multiplexing', 'channel sharing'] },
  adc_dac: { phrases: ['analog to digital', 'digital to analog', 'sampling theorem', 'quantization error'] },
  frequency: { phrases: ['cycles per second', 'inverse of time period', 'hertz measurement'] },
  wavelength: { phrases: ['speed of light over frequency', 'distance between peaks', 'spatial period'] },
  embedded_systems: { phrases: ['real time operating system', 'bare metal', 'gpio pins', 'interrupt handler'] },
  voltage: { phrases: ['potential difference', 'electromotive force', 'electric potential'] },
  current: { phrases: ['flow of charge', 'charge per second', 'amperes'] },
  resistance: { phrases: ['opposes current', 'voltage drop across', 'resistivity'] },
  power_electrical: { phrases: ['p equals vi', 'power dissipation', 'watts'] },
  opamp: { phrases: ['operational amplifier', 'inverting amplifier', 'virtual ground', 'negative feedback'] },
  transistor: { phrases: ['semiconductor switch', 'bipolar junction', 'gate source drain', 'field effect transistor'] },
  deadlock_conditions: { phrases: ['circular wait condition', 'hold and wait condition', 'no preemption condition'] },
  star_framework: { phrases: ['situation task action result', 'star method', 'star framework', 'structured behavioral story', 'action i took'] },
  personal_ownership: { phrases: ['i personally implemented', 'i led the effort', 'my direct responsibility', 'i took ownership', 'my individual contribution'] },
  conflict_resolution: { phrases: ['differing technical opinions', 'stakeholder alignment', 'active listening', 'reached consensus', 'shared compromise'] },
  adaptability: { phrases: ['pivoted approach', 'changing requirements', 'handling ambiguity', 'adapted implementation', 'flexible strategy'] },
  leadership: { phrases: ['mentored junior developers', 'technical leadership', 'project ownership', 'driving technical standards'] },
  incident_triage: { phrases: ['production outage', 'incident triage', 'root cause analysis', 'post mortem', 'analyzed server logs'] },
  risk_mitigation: { phrases: ['rollback plan', 'feature flags', 'fallback strategy', 'circuit breaker', 'graceful degradation'] },
  stakeholder_communication: { phrases: ['status updates', 'escalation path', 'clear expectations', 'non technical summary'] },
  self_introduction: { phrases: ['professional background', 'years of experience', 'primary focus', 'career journey'] },
  concise_articulation: { phrases: ['concise articulation', 'structured summary', 'logical progression', 'direct answer'] },
};

export class SynonymRegistry {
  private static instance: SynonymRegistry;
  private map = new PhraseMap();

  static getInstance(): SynonymRegistry {
    if (!SynonymRegistry.instance) {
      SynonymRegistry.instance = new SynonymRegistry();
    }
    return SynonymRegistry.instance;
  }

  private constructor() {
    this.seed();
  }

  private seed(): void {
    // 1. Global concept registry: canonical label + every alias.
    for (const [id, entry] of Object.entries(CONCEPT_REGISTRY)) {
      this.registerConcept(id, entry.concept, entry.aliases || []);
    }

    // 2. Domain packs: concept labels + aliases.
    const packs: DomainPack[] = [
      dbmsPack as unknown as DomainPack,
      networksPack as unknown as DomainPack,
      osPack as unknown as DomainPack,
      systemDesignPack as unknown as DomainPack,
    ];
    for (const pack of packs) {
      for (const concept of pack.concepts || []) {
        this.registerConcept(concept.id, concept.id.replace(/_/g, ' '), concept.aliases || []);
      }
    }

    // 3. Curated interview phrase table.
    for (const [conceptId, spec] of Object.entries(EXPERT_PHRASE_TABLE)) {
      for (const phrase of spec.phrases) {
        this.map.register(phrase, [conceptId], 'phrase', spec.weight ?? 1.0);
      }
    }
  }

  /** Add a concept's surfaces (idempotent — duplicates are cheap and harmless). */
  registerConcept(conceptId: string, label: string, aliases: string[] = []): void {
    this.map.register(label, [conceptId], 'label', 1.0);
    for (const alias of aliases) {
      this.map.register(alias, [conceptId], 'alias', 0.9);
    }
  }

  get phraseMap(): PhraseMap {
    return this.map;
  }

  find(text: string): MatchedPhrase[] {
    const tokens = tokenizeForPhrase(text);
    return this.map.find(tokens, 0);
  }

  /**
   * Aggregate `find` results into a conceptId -> matched-phrases map, highest-weight first.
   */
  findConcepts(text: string): Map<string, MatchedPhrase[]> {
    const aggregated = new Map<string, MatchedPhrase[]>();
    for (const match of this.find(text)) {
      for (const conceptId of match.conceptIds) {
        const bucket = aggregated.get(conceptId) || [];
        bucket.push(match);
        aggregated.set(conceptId, bucket);
      }
    }
    // Deterministic ordering: strongest kind, then highest weight, then longest surface.
    for (const bucket of aggregated.values()) {
      bucket.sort((a, b) =>
        (a.kind === b.kind ? 0 : a.kind === 'EXACT_ALIAS' ? -1 : 1) ||
        (b.weight - a.weight) ||
        (b.original.length - a.original.length));
    }
    return aggregated;
  }
}
