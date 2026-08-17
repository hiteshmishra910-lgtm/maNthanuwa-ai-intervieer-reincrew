import { Question, QuestionType, EvaluationResult, QuestionAlignment, ConceptEvidence, MisconceptionEvidence, ConfidenceEvidence } from '../../../types';
import type { ExpertAnalysis } from '../expert/types';

export interface Evidence {
  id: string;
  type: 'concept' | 'mechanism' | 'example' | 'tradeoff' | 'limitation' | 'complexity' | 'misconception' | 'contradiction';
  sentenceIndex: number;
  span: string;             // Verbatim transcript text
  confidence: number;       // Detection confidence 0.0 - 1.0
  similarityScore?: number; // Concept similarity 0.0 - 1.0
  severity?: 'minor' | 'moderate' | 'critical';
  conceptId?: string;
  source: string;           // Module name that extracted this evidence
}

export interface ScoreTraceItem {
  evidenceId: string;
  label: string;
  deltaPoints: number;
  category: 'accuracy' | 'understanding' | 'reasoning' | 'communication' | 'penalty';
}

export interface EvaluationGraphNode {
  conceptId: string;
  importance: 'critical' | 'important' | 'supporting' | 'bonus';
  weight: number;
  prerequisites: string[];
  expectedDimensions: ('definition' | 'mechanism' | 'purpose' | 'useCase' | 'limitations' | 'tradeoffs')[];
}

export interface EvaluationGraph {
  questionId: string;
  nodes: Map<string, EvaluationGraphNode>;
  expectedTradeoffs: string[];
  expectedExamples: string[];
  misconceptions: { id: string; trigger: string; severity: 'minor' | 'moderate' | 'critical'; explanation: string }[];
}

/** A topic-specific expectation contributed by a domain pack (evaluated deterministically). */
export interface DomainRuleSpec {
  id: string;
  description: string;
  /** When any trigger phrase appears, the rule becomes active. */
  triggerPhrases: string[];
  /** If none of these appears while the rule is active, the rule fails (negative mark). */
  expectedPhrases: string[];
  severity: 'low' | 'medium' | 'high';
  penalty: number;
}

/** A domain rule with the owning domain stamped in (used by the expert rubric). */
export interface DomainRule extends DomainRuleSpec {
  domain: string;
}

export interface DomainPack {
  domain: string;
  version: string; // e.g. "2.3.0"
  concepts: { id: string; aliases: string[]; importance: 'critical' | 'important' | 'supporting' | 'bonus' }[];
  misconceptions: { id: string; keywords: string[]; severity: 'minor' | 'moderate' | 'critical'; explanation: string }[];
  tradeoffs?: { topic: string; pros: string[]; cons: string[] }[];
  rules?: DomainRuleSpec[];
}

export interface VersionMetadata {
  engineVersion: string;
  evaluationSchemaVersion: string;
  rubricVersion: string;
  domainPackVersion?: string;
  benchmarkVersion?: string;
}

export interface PipelineContext {
  // Inputs
  readonly question: Question;
  readonly answer: string;
  readonly questionType: QuestionType;
  readonly weightsProfile: EvaluationProfile;
  readonly visualMetrics?: any;
  readonly audioMetrics?: any;
  isHonestUnknown: boolean;
  questionAlignment?: QuestionAlignment;

  // Evidence Model (V2 Engine)
  evidences?: Evidence[];
  scoreTrace?: ScoreTraceItem[];
  evaluationGraph?: EvaluationGraph;

  // Expert Engine Output (opt-in via ExpertEvaluationModule)
  expert?: ExpertAnalysis;

  // Metadata & Diagnostics
  readonly ruleVersion: string;
  readonly engineVersion?: string;
  readonly evaluationSchemaVersion?: string;
  readonly knowledgeModelVersion: string;
  developerTrace: string[];
  detectorConfidences: { [detectorName: string]: number };

  // Pre-processed Text Data
  normalizedAnswer: string;
  tokens: string[];
  stemmedTokens: string[];
  sentences: string[][]; // tokenized and stemmed sentences

  // Extracted Knowledge Metrics
  matchedConcepts: Set<string>;
  conceptCompleteness: Map<string, {
    satisfiedDimensions: string[];
    completenessRatio: number;
  }>;
  reachedDepth: string[];
  missedDependencies: string[];
  validConnections: string[];
  invalidConnections: string[];

  // Signals and Evidences
  conceptEvidence: ConceptEvidence[];
  misconceptionEvidence: MisconceptionEvidence[];
  confidenceEvidence: ConfidenceEvidence[];

  technicalErrors: {
    ruleId: string;
    matchedText: string;
    expected: string;
    explanation: string;
    severity: 'low' | 'medium' | 'high';
    penalty: number;
  }[];
  misconceptions: string[];
  missingKeyPoints?: string[];
  contradictions: string[];

  unrecognizedClaims: string[];
  uncertaintyDetected: boolean;
  selfCorrectionsCount: number;
  relevantContentRatio: number;
  buzzwordStuffingDetected: boolean;
  circularExplanationDetected: boolean;
  knowledgeBoundaryExceeded: boolean;

  // Local Communication Heuristics
  localClarityScore: number;
  localRepetitionPenalties: number;

  // Output Scores (Aggregated at final stage)
  technicalAccuracyScore: number;
  conceptUnderstandingScore: number;
  reasoningScore: number;
  communicationClarityScore: number;
  confidenceCalibrationScore: number;
  evaluationConfidence: number;

  questionSatisfaction?: 'YES' | 'PARTIAL' | 'NO';
  explanationCompletenessPercent?: number;
  technicalAccuracyBreakdown?: {
    factsScore: number;
    questionSatisfactionScore: number;
    misconceptionsScore: number;
    completenessScore: number;
    relevanceScore: number;
  };
}

export interface EvaluationModule {
  readonly name: string;
  execute(context: PipelineContext): void;
}

export interface EvaluationProfile {
  id: string;                    // UUID of the profile
  version_number: number;        // The version of this profile configuration
  accuracyWeight: number;      // 0-100
  understandingWeight: number;   // 0-100
  reasoningWeight: number;       // 0-100
  communicationWeight: number;   // 0-100
  confidenceWeight: number;       // 0-100
  requiredDimensions: ('definition' | 'mechanism' | 'purpose' | 'useCase' | 'limitations' | 'tradeoffs' | 'alternatives' | 'failureCases' | 'dependencies')[];
}

export const EVALUATION_PROFILES_REGISTRY: { [type in QuestionType]: EvaluationProfile } = {
  Definition: {
    id: '00000000-0000-0000-0000-000000000001',
    version_number: 1,
    accuracyWeight: 40,
    understandingWeight: 40,
    reasoningWeight: 10,
    communicationWeight: 5,
    confidenceWeight: 5,
    requiredDimensions: ['definition', 'mechanism']
  },
  Comparison: {
    id: '00000000-0000-0000-0000-000000000001',
    version_number: 1,
    accuracyWeight: 30,
    understandingWeight: 30,
    reasoningWeight: 20,
    communicationWeight: 10,
    confidenceWeight: 10,
    requiredDimensions: ['definition', 'mechanism', 'alternatives']
  },
  Scenario: {
    id: '00000000-0000-0000-0000-000000000001',
    version_number: 1,
    accuracyWeight: 20,
    understandingWeight: 30,
    reasoningWeight: 30,
    communicationWeight: 10,
    confidenceWeight: 10,
    requiredDimensions: ['mechanism', 'useCase', 'failureCases']
  },
  Debugging: {
    id: '00000000-0000-0000-0000-000000000001',
    version_number: 1,
    accuracyWeight: 40,
    understandingWeight: 20,
    reasoningWeight: 20,
    communicationWeight: 10,
    confidenceWeight: 10,
    requiredDimensions: ['mechanism', 'failureCases', 'dependencies']
  },
  Design: {
    id: '00000000-0000-0000-0000-000000000001',
    version_number: 1,
    accuracyWeight: 20,
    understandingWeight: 30,
    reasoningWeight: 30,
    communicationWeight: 10,
    confidenceWeight: 10,
    requiredDimensions: ['mechanism', 'tradeoffs', 'dependencies']
  },
  Tradeoff: {
    id: '00000000-0000-0000-0000-000000000001',
    version_number: 1,
    accuracyWeight: 20,
    understandingWeight: 20,
    reasoningWeight: 40,
    communicationWeight: 10,
    confidenceWeight: 10,
    requiredDimensions: ['limitations', 'tradeoffs', 'alternatives']
  },
  Architecture: {
    id: '00000000-0000-0000-0000-000000000001',
    version_number: 1,
    accuracyWeight: 20,
    understandingWeight: 20,
    reasoningWeight: 40,
    communicationWeight: 10,
    confidenceWeight: 10,
    requiredDimensions: ['mechanism', 'tradeoffs', 'dependencies', 'failureCases']
  },
  HR: {
    id: '00000000-0000-0000-0000-000000000001',
    version_number: 1,
    accuracyWeight: 10,
    understandingWeight: 20,
    reasoningWeight: 10,
    communicationWeight: 40,
    confidenceWeight: 20,
    requiredDimensions: ['useCase']
  },
  Technical: {
    id: '00000000-0000-0000-0000-000000000001',
    version_number: 1,
    accuracyWeight: 30,
    understandingWeight: 35,
    reasoningWeight: 20,
    communicationWeight: 10,
    confidenceWeight: 5,
    requiredDimensions: ['definition', 'mechanism', 'useCase']
  }
};

/* ============================================================================
 * Phase 1 & Phase -1 Frozen Interface DTO Contracts (schemaVersion: "v1.0")
 * ============================================================================ */

export interface IntentInputDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly context: Readonly<any>;
  readonly intentBundleVersion: string;
}

export interface IntentResultDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly conceptId: string;
  readonly matchedIntent: string;
  readonly semanticSimilarityScore: number;
  readonly confidence?: number;
  readonly matchedPhrases?: readonly string[];
  /** @deprecated Use conceptId instead */
  readonly rawKeywordMatch?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IIntentEngine {
  readonly version: 'v1';
  readonly stabilityTier: 'Internal';
  evaluateIntent(input: IntentInputDTO_v1): Promise<IntentResultDTO_v1[]>;
}

export interface EvidenceInputDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly context: Readonly<any>;
  readonly intentResults: readonly IntentResultDTO_v1[];
}

export interface EvidenceQuoteDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly sentenceIndex: number;
  readonly transcriptQuote: string;
  readonly matchedConceptId: string;
  readonly evidenceStrength: 'STRONG' | 'PARTIAL' | 'WEAK';
}

export interface EvidenceGraphDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly demonstratedQuotes: readonly EvidenceQuoteDTO_v1[];
  readonly missingGaps: readonly string[];
  readonly technicalErrors: readonly { readonly error: string; readonly severity: 'low' | 'medium' | 'high' }[];
}

export interface IEvidenceEngine {
  readonly version: 'v1';
  readonly stabilityTier: 'Internal';
  extractEvidence(input: EvidenceInputDTO_v1): Promise<EvidenceGraphDTO_v1>;
}

export interface SessionContextPayloadDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly sessionId: string;
  readonly rawTranscripts: readonly string[];
  readonly mentionedTechnologies: readonly string[];
  readonly claimedExperience: readonly string[];
  readonly previousExplanations: readonly { readonly questionId: string; readonly summary: string }[];
  readonly unansweredProbes: readonly string[];
}

export interface IDialogueContext {
  readonly version: 'v1';
  readonly stabilityTier: 'Internal';
  readonly sessionId: string;
  updateContext(questionId: string, candidateUtterance: string): void;
  getContextPayload(): SessionContextPayloadDTO_v1;
  clearSessionMemory(): void;
}

export interface ISemanticUnderstandingProvider {
  readonly version: 'v1';
  readonly stabilityTier: 'Public';
  readonly providerId: string;
  readonly modelVersion: string;
  computeSimilarity(candidateText: string, targetCriteriaText: string): Promise<number>;
}

