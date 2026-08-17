# Evaluation Scoring Schema — API vs Local vs Hybrid

> **Purpose:** Single source of truth for per-question evaluation output format across all modes. Shivam/Pranita use this to align the local evaluation engine output with what the report pipeline expects.
>
> **Last updated:** 7th August 2026

---

## 1. Score Scales

| Scale | Range | Used For |
|-------|-------|----------|
| Per-question score | 0–10 | `contentScore`, `technicalAccuracyScore`, `conceptUnderstandingScore`, `reasoningScore`, `communicationClarityScore`, `confidenceCalibrationScore` |
| Aggregate/report score | 0–100 | `executiveSummary.technicalScore`, `overallScores.*`, `interview_sessions.overall_score` |

**Conversion:** `aggregateScore = perQuestionAverage × 10` (use `perQuestionAverageToOverallScore()` from `shared/scoringPolicy.ts`)

---

## 2. Per-Question Output Schema (`EvaluationResult`)

This is what `ReportGenerator.computeFinalReport()` reads. Both API and Local engines must populate these fields.

### 2.1 Scoring Fields (all 0–10 scale)

| Field | Local Source | API Source | ReportGenerator Reads As |
|-------|-------------|------------|--------------------------|
| `contentScore` | ScoreAggregator `technicalAccuracyScore` | Weighted blend from `buildEvaluationResult` | `technicalScore` in question breakdown |
| `conceptUnderstandingScore` | ScoreAggregator | LLM `analysis.understanding` | `knowledgeScore` in session avg |
| `reasoningScore` | ScoreAggregator | LLM `analysis.reasoning` | `reasoningScore` in session avg |
| `communicationClarityScore` | ScoreAggregator | LLM `analysis.clarity` | `communicationScore` in session avg |
| `confidenceCalibrationScore` | ScoreAggregator | LLM `analysis.confidence` | `confidenceGap` in session avg |
| `knowledgeScore` | — (alias for `conceptUnderstandingScore`) | Legacy weighted blend | Fallback for `conceptUnderstandingScore` |
| `problemSolvingScore` | — (alias for `reasoningScore`) | Legacy weighted blend | Fallback for `reasoningScore` |
| `communicationScore` | — (alias for `communicationClarityScore`) | Legacy weighted average | Fallback for `communicationClarityScore` |

**Rule:** The V2 field names (`conceptUnderstandingScore`, `reasoningScore`, `communicationClarityScore`, `confidenceCalibrationScore`) take precedence. Legacy names are fallbacks only.

### 2.2 Qualitative Fields

| Field | Type | Description |
|-------|------|-------------|
| `mentionedConcepts` | `string[]` | Concepts the candidate named/identified |
| `explainedConcepts` | `string[]` | Concepts actually explained with understanding |
| `missingKeyPoints` | `string[]` | Expected concepts the candidate didn't cover |
| `answerType` | enum | One of: `honest_unknown`, `keyword_list_only`, `incorrect_attempt`, `mixed_understanding`, `partial_explanation`, `full_explanation` |
| `answerQuality` | enum | One of: `HONEST_UNKNOWN`, `KEYWORD_LIST`, `INCORRECT_ATTEMPT`, `SURFACE_LEVEL`, `COMPETENT`, `STRONG`, `EXPERT` |
| `verdict` | enum | **`Pass`** (≥7), **`Borderline`** (≥5), **`Fail`** (<5) |

### 2.3 Verdict Thresholds (canonical — `shared/verdictPolicy.ts`)

```
Score ≥ 7  →  "Pass"
Score ≥ 5  →  "Borderline"
Score < 5  →  "Fail"
```

This applies to ALL modes (LOCAL, API, HYBRID). The `determineVerdict()` function from `shared/verdictPolicy.ts` is the single source of truth.

### 2.4 Feedback Structure

```typescript
feedback: {
  observation: string;    // 1-2 sentence summary of this answer
  demonstrated: string[]; // What the candidate showed
  gaps: string[];         // What was missing
  nextSteps: string[];    // Improvement suggestions
}
```

### 2.5 Metadata

```typescript
evaluationMetadata: {
  evaluationSource: 'LOCAL' | 'API' | 'API_FAILED';
  provider: string;       // 'local-core-v1' | 'openrouter' | 'gemini'
  model: string;          // 'core-heuristics' | model name
  latencyMs: number;
  mode: string;           // 'LOCAL' | 'Interactive' | 'HYBRID'
}
```

---

## 3. Session-Level Aggregation (ReportGenerator)

The report generator aggregates per-question scores into session averages:

```
avgKnowledge    = sum(conceptUnderstandingScore × 10) / count
avgReasoning    = sum(reasoningScore × 10) / count
avgCommunication = sum(communicationClarityScore × 10) / count
avgConfidenceGap = sum(confidenceGap) / count
```

These populate `overallScores.*` on a **0–100 scale**.

### Hiring Recommendation Thresholds (`shared/scoringPolicy.ts`)

```
trustAdjustedScore ≥ 80  →  "Strong Hire"
trustAdjustedScore ≥ 65  →  "Hire"
trustAdjustedScore ≥ 50  →  "Consider"
trustAdjustedScore < 50  →  "Reject"

integrityScore < 40      →  "Reject" (hard floor, overrides score)
```

---

## 4. Mode-Specific Notes

### LOCAL Mode
- Source: `EvaluationCore.evaluateAnswer()` → 22-module pipeline
- All scoring fields populated by `ScoreAggregator`
- `evaluationMetadata.evaluationSource = 'LOCAL'`
- `verdict` via `determineVerdict()` from `shared/verdictPolicy.ts`

### API Mode
- Source: `InteractiveEvaluationStrategy` → calls `submitAnswer()` → LLM evaluates per-turn
- V2 fields mapped from LLM `analysis.*` sub-fields
- `evaluationMetadata.evaluationSource = 'API'`
- Verdict thresholds unified with LOCAL (≥7/≥5)
- Turn recovery retries failed turns at finalization

### HYBRID Mode
- **During interview:** Uses LOCAL engine (zero API calls, instant feedback)
- **After interview:** Background Edge Function sends all answers to LLM in a single batch
- Final report built by `buildHybridReport()` from `shared/hybridReportBuilder.ts`
- Uses `perQuestionAverageToOverallScore()` for 0-10 → 0-100 conversion
- `evaluationMetadata.evaluationSource = 'HYBRID_API'` (after background job completes)

---

## 5. What Shivam & Pranita Need to Match

The local evaluation engine must output an object matching the `EvaluationResult` interface with at minimum:

**Required scoring fields (0–10):**
- `contentScore`
- `conceptUnderstandingScore`
- `reasoningScore`
- `communicationClarityScore`
- `confidenceCalibrationScore`

**Required qualitative fields:**
- `mentionedConcepts: string[]`
- `explainedConcepts: string[]`
- `missingKeyPoints: string[]`
- `verdict: 'Pass' | 'Borderline' | 'Fail'` (use `determineVerdict()`)
- `feedback: { observation, demonstrated, gaps, nextSteps }`

**Required metadata:**
- `evaluationMetadata.evaluationSource: 'LOCAL'`

If these fields are populated with correct types and scales, the report pipeline will produce consistent output regardless of which engine generated it.
