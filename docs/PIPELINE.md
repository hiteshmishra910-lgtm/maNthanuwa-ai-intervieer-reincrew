# Reicrew AI — Evaluation Pipeline

## Overview

The evaluation pipeline is a modular, sequential processing system that analyzes candidate answers against knowledge models. It produces multi-dimensional scores and detects patterns like misconceptions, contradictions, and bluffing.

---

## Architecture

```
Answer Input
     │
     ▼
┌─────────────────────────────────────────────────┐
│              Pipeline Context                   │
│  (shared mutable state across all modules)      │
└─────────────────────────────────────────────────┘
     │
     ▼
┌────────────┐    ┌────────────┐    ┌────────────┐
│  Module 1  │───▶│  Module 2  │───▶│  Module 3  │───▶ ...
│ (Normalizer)│   │(Tokenizer) │    │(Stemmer)   │
└────────────┘    └────────────┘    └────────────┘
     │
     ▼
┌─────────────────────────────────────────────────┐
│              Score Aggregator                   │
│  (computes final 5-dimension scores)           │
└─────────────────────────────────────────────────┘
     │
     ▼
EvaluationResult
```

---

## Pipeline Context (`interfaces.ts`)

The `PipelineContext` is the shared state object passed through all modules:

### Inputs
- `question` — The interview question
- `answer` — Candidate's answer text
- `questionType` — Question classification
- `weightsProfile` — Scoring weights for this question type

### Pre-processed Data
- `normalizedAnswer` — Cleaned text
- `tokens` — Tokenized words
- `stemmedTokens` — Stemmed tokens
- `sentences` — Tokenized sentences

### Extracted Knowledge
- `matchedConcepts` — Concepts found in answer
- `conceptCompleteness` — Per-concept completion ratio
- `reachedDepth` — Depth levels reached
- `missedDependencies` — Missing prerequisite concepts
- `validConnections` / `invalidConnections` — Concept relationships

### Signals
- `technicalErrors` — Detected technical mistakes
- `misconceptions` — Identified misconceptions
- `contradictions` — Internal contradictions
- `uncertaintyDetected` — Candidate uncertainty markers
- `selfCorrectionsCount` — Self-correction count
- `buzzwordStuffingDetected` — Keyword stuffing flag

### Output Scores
- `technicalAccuracyScore` (0-10)
- `conceptUnderstandingScore` (0-10)
- `reasoningScore` (0-10)
- `communicationClarityScore` (0-10)
- `confidenceCalibrationScore` (0-10)
- `evaluationConfidence` (0-100)

---

## Evaluation Profiles (`interfaces.ts`)

Each question type has a weighted scoring profile:

| Type | Accuracy | Understanding | Reasoning | Communication | Confidence |
|------|----------|---------------|-----------|---------------|------------|
| Definition | 40 | 40 | 10 | 5 | 5 |
| Comparison | 30 | 30 | 20 | 10 | 10 |
| Scenario | 20 | 30 | 30 | 10 | 10 |
| Debugging | 40 | 20 | 20 | 10 | 10 |
| Design | 20 | 30 | 30 | 10 | 10 |
| Tradeoff | 20 | 20 | 40 | 10 | 10 |
| Architecture | 20 | 20 | 40 | 10 | 10 |
| HR | 10 | 20 | 10 | 40 | 20 |
| Technical | 30 | 35 | 20 | 10 | 5 |

---

## Pipeline Modules (`services/pipeline/`)

### Text Processing Modules
| Module | Purpose |
|--------|---------|
| `Normalizer.ts` | Text normalization and cleaning |
| `Tokenizer.ts` | Word tokenization |
| `Stemmer.ts` | Word stemming |
| `AliasResolver.ts` | Resolves concept aliases |

### Analysis Modules
| Module | Purpose |
|--------|---------|
| `ConceptMatcher.ts` | Matches answer against knowledge model concepts |
| `UnderstandingAnalyzer.ts` | Evaluates depth of understanding |
| `RelevanceAnalyzer.ts` | Measures answer relevance to question |
| `IntentDetector.ts` | Detects answer intent alignment |
| `CommunicationAnalyzer.ts` | Evaluates clarity and structure |

### Detection Modules
| Module | Purpose |
|--------|---------|
| `TechnicalRulesDetector.ts` | Detects technical errors |
| `MisconceptionDetector.ts` | Identifies misconceptions |
| `UncertaintyDetector.ts` | Detects uncertainty markers |
| `UnrecognizedClaimDetector.ts` | Flags unrecognized claims |
| `SelfCorrectionDetector.ts` | Counts self-corrections |
| `NegativeEvidenceDetector.ts` | Finds negative evidence |
| `StructuralContradictionDetector.ts` | Detects contradictions |

### Scoring Modules
| Module | Purpose |
|--------|---------|
| `ConfidenceAnalyzer.ts` | Analyzes confidence calibration |
| `ScoreAggregator.ts` | Aggregates final scores |
| `DependencyGraphAnalyzer.ts` | Analyzes concept dependencies |
| `RelationshipGraphValidator.ts` | Validates concept relationships |
| `QuestionAlignmentEvaluator.ts` | Evaluates question-answer alignment |

### Orchestration
| Module | Purpose |
|--------|---------|
| `EvaluationPolicyEngine.ts` | Determines evaluation strategy |
| `EvaluationStrategy.ts` | Strategy pattern for evaluation |
| `InterviewFlowController.ts` | Controls interview flow |
| `QuestionNavigator.ts` | Selects next questions |
| `FollowUpService.ts` | Generates follow-up questions |

---

## Question Alignment (`QuestionAlignment`)

The pipeline evaluates how well an answer aligns with the question:

```typescript
interface QuestionAlignment {
  answeredQuestion: boolean;        // Did candidate answer the question?
  relevanceScore: number;           // 0-1: Content relevance
  intentScore: number;              // 0-1: Intent alignment
  topicScore: number;               // 0-1: Topic coverage
  scenarioScore: number;            // 0-1: Scenario handling
  evidenceScore: number;            // 0-1: Evidence quality
  completenessScore: number;        // 0-1: Completeness
  misunderstandingDetected: boolean;
  offTopic: boolean;
  genericMemorizedAnswer: boolean;
  answeredDifferentQuestion: boolean;
  requiredElementsMissing: string[];
  fatalIssues: FatalIssue[];
}
```

### Fatal Issues
- `DID_NOT_ANSWER` — No answer provided
- `OFF_TOPIC` — Answer is off-topic
- `MAJOR_MISCONCEPTION` — Major technical misconception
- `ANSWERED_DIFFERENT_QUESTION` — Answered wrong question
- `NO_EXAMPLE_PROVIDED` — Missing examples
- `MEMORIZED_TEMPLATE` — Memorized/templated answer
- `INCOMPLETE_RESPONSE` — Incomplete answer
- `HALLUCINATED_FACTS` — Fabricated facts

---

## Output: EvaluationResult

Each question evaluation produces an `EvaluationResult` with:

- **Scores**: Content, grammar, fluency, communication, honesty
- **Qualitative**: Mentioned/explained concepts, answer type, quality level
- **Verdict**: Excellent/Good/Pass/Borderline/Fail
- **Feedback**: Observation, demonstrated skills, gaps, next steps
- **Analysis**: Technical accuracy, problem solving, reasoning breakdown
- **Behavioral**: Communication, problem solving, ownership, teamwork
- **5-Dimension Scores**: Technical accuracy, concept understanding, reasoning, communication clarity, confidence calibration
