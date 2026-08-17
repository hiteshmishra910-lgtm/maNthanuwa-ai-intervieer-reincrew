import type { ExpertDimension, ExpertImportance } from './WeightedRubric';
import type { ExpertMatchKind } from './SemanticMatcher';
import type { DatabaseVerdict } from '../../../shared/verdictPolicy';

/**
 * Shared expert-engine output types.
 *
 * Kept in a leaf module so both the pipeline (`interfaces.ts`) and the orchestrator
 * (`ExpertEvaluator.ts`) can reference them without creating a runtime import cycle.
 */

export interface ExpertConceptMatchSummary {
  conceptId: string;
  label: string;
  weight: number;
  importance: ExpertImportance;
  matched: boolean;
  confidence: number;
  similarityScore: number;
  matchKind: ExpertMatchKind;
  bestSentenceIndex: number;
  matchedPhrases: string[];
  satisfiedDimensions: ExpertDimension[];
  missingDimensions: ExpertDimension[];
}

export interface ExpertScores {
  /** 0-10, weighted by concept importance and per-dimension satisfaction. */
  conceptCoverage: number;
  /** 0-10, mean confidence of the concepts that were matched. */
  semanticRelevance: number;
  /** 0-10, how deep the candidate travelled down prerequisite chains. */
  depth: number;
  /** 0-10, proportion of expected concept relationships that were evidenced. */
  relationship: number;
  /** 0-3, deducted from the weighted total for un-negated misconceptions. */
  misconceptionPenalty: number;
  /** 0-10, blended grammar/readability/repetition quality (contradictions are negative marks). */
  language: number;
  /** Total deductions from negative marking (misconceptions + contradictions + domain rules), capped. */
  negativePenalty: number;
  /** 0-10, final blended score. */
  weightedTotal: number;
}

// ── Coverage scoring ──────────────────────────────────────────────────────────────────────────

export interface TierCoverage {
  tier: ExpertImportance;
  expectedConcepts: number;
  matchedConcepts: number;
  expectedWeight: number;
  matchedWeight: number;
  /** matchedWeight / expectedWeight for this tier. */
  ratio: number;
}

export interface CoverageReport {
  /** 0-10, dimension-adjusted weighted coverage (drives `scores.conceptCoverage`). */
  overall: number;
  /** 0-1, dimension-adjusted covered weight / total rubric weight. */
  ratio: number;
  tiers: TierCoverage[];
  /** 0-10, satisfied dimension weight / expected dimension weight across matched concepts. */
  dimensionCoverage: number;
  /** 0-10, evidenced relationship edges / expected relationship edges. */
  relationshipCoverage: number;
  coveredWeight: number;
  totalWeight: number;
}

// ── Negative marking ─────────────────────────────────────────────────────────────────────────

export type NegativeMarkSource = 'misconception' | 'contradiction' | 'domain_rule';

export interface NegativeMark {
  id: string;
  source: NegativeMarkSource;
  description: string;
  matchedText?: string;
  severity: 'low' | 'medium' | 'high';
  penalty: number;
}

// ── Domain rules ─────────────────────────────────────────────────────────────────────────────

export interface DomainRuleResult {
  ruleId: string;
  domain: string;
  description: string;
  triggered: boolean;
  passed: boolean;
  matchedTriggers: string[];
  missingPhrases: string[];
  severity: 'low' | 'medium' | 'high';
  penalty: number;
}

// ── Feedback generation ────────────────────────────────────────────────────────────────────────

export interface ExpertFeedback {
  /** One-line headline with verdict and score. */
  summary: string;
  verdict: DatabaseVerdict;
  strengths: string[];
  weaknesses: string[];
  /** Ranked by importance then weight. */
  missingConcepts: string[];
  suggestions: string[];
  /** Pre-deduction weighted blend (0-10). */
  positiveScore: number;
  negativePenalty: number;
  finalScore: number;
}

// ── Syntax layer ────────────────────────────────────────────────────────────────────────────

export interface SyntaxSentenceSummary {
  index: number;
  text: string;
  subject: string;
  verb: string;
  hasNegation: boolean;
  clauseCount: number;
}

export interface SyntaxSummary {
  sentenceCount: number;
  clauseCount: number;
  subjects: string[];
  mainVerbs: string[];
  sentences: SyntaxSentenceSummary[];
}

// ── Grammar layer ───────────────────────────────────────────────────────────────────────────

export interface GrammarIssue {
  ruleId: string;
  sentenceIndex: number;
  matchedText: string;
  explanation: string;
  severity: 'low' | 'medium' | 'high';
  penalty: number;
}

export interface GrammarReport {
  /** 0-10, higher is cleaner prose. */
  score: number;
  issues: GrammarIssue[];
}

// ── Readability layer ────────────────────────────────────────────────────────────────────────

export interface ReadabilityReport {
  /** 0-10, mapped from Flesch reading ease. */
  score: number;
  /** Flesch reading ease 0-100 (100 = very easy). */
  readingEase: number;
  /** Flesch-Kincaid grade level. */
  gradeLevel: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  longWordRatio: number;
  /** Type-token ratio over all content tokens. */
  lexicalDiversity: number;
}

// ── Repetition layer ─────────────────────────────────────────────────────────────────────────

export interface DuplicateSentencePair {
  a: number;
  b: number;
  overlap: number;
}

export interface RepetitionReport {
  /** 0-10, higher is less repetitive. */
  score: number;
  fillerCount: number;
  fillerRatio: number;
  typeTokenRatio: number;
  repeatedChunks: string[];
  duplicateSentencePairs: DuplicateSentencePair[];
}

// ── Contradiction layer ───────────────────────────────────────────────────────────────────────

export interface Contradiction {
  ruleId: string;
  sentenceA: number;
  sentenceB: number;
  explanation: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ContradictionReport {
  /** 0-10, higher is more internally consistent. */
  score: number;
  contradictions: Contradiction[];
}

// ── Language synthesis ────────────────────────────────────────────────────────────────────────

export interface ExpertLanguageAnalysis {
  /** 0-10 blended from grammar/readability/repetition (contradictions are negative marks). */
  score: number;
  sentenceCount: number;
  grammar: GrammarReport;
  readability: ReadabilityReport;
  repetition: RepetitionReport;
  contradictions: ContradictionReport;
}

export interface ExpertAnalysis {
  engine: 'expert-local-v1';
  rubricVersion: string;
  questionType: string;
  graph: {
    nodeCount: number;
    edgeCount: number;
    maxDepth: number;
    reachedDepth: number;
    weightedCoverage: number;
  };
  concepts: ExpertConceptMatchSummary[];
  misconceptionHits: string[];
  scores: ExpertScores;
  verdict: DatabaseVerdict;
  /** Lightweight dependency parse of the candidate's answer. */
  syntax: SyntaxSummary;
  /** Grammar / readability / repetition / contradiction findings. */
  language: ExpertLanguageAnalysis;
  /** Structured coverage report (tiered + dimensions + relationships). */
  coverage: CoverageReport;
  /** Every score deduction, fully explainable. */
  negativeMarks: NegativeMark[];
  /** Domain-pack rule evaluation results. */
  domainRules: DomainRuleResult[];
  /** Human-readable strengths / weaknesses / missing concepts. */
  feedback: ExpertFeedback;
}
