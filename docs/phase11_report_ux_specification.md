# Reincrew.AI Phase 11.0: Report Intelligence & UX Specification
## Canonical Presentation Contract & 6-Layer Progressive-Disclosure Architecture

---

## 1. Executive Overview & Design Principles

Phase 11.0 defines the **Presentation Layer Specification** for `Reincrew.AI` evaluation reports. The core architectural boundary of Phase 11 is that **presentation is strictly separated from evaluation logic and scoring math**. Candidate numerical scores, historical question ratings, and raw transcript strings are **100% immutable**.

### Key Principles:
1. **Zero-Drift Scoring**: Presentation code (`ReportGenerator.ts`, `EnrichedReportDTO_v1`, UI components) operates on top of existing `MasterEvaluationReport` outputs as read-only inputs.
2. **Evidence-First Transparency**: Replaces arbitrary AI confidence meters with explicit **Evidence Coverage** indicators (High, Medium, Low) based on question sample depth.
3. **Rapid Recruiter Review**: Layer 1 provides a rapid review surface for recruiters while allowing deeper progressive disclosure into evidence, trade-offs, and transcripts.
4. **Differentiated Dashboard Visibility**: Candidate, HR, and Admin views receive appropriate data tailored to candidate learning, HR candidate screening, and Admin forensic auditing.

---

## 2. Competitive Benchmarking Audit

We analyzed five leading interviewing and scorecard platforms to synthesize best practices for `Reincrew.AI`:

| Platform | Strengths Analyzed | Weakness / Gap Addressed in Reincrew.AI |
|---|---|---|
| **Greenhouse** | Structured competency scorecards & evidence-backed question focus | Rigid manual form filling; lack of dynamic evidence extraction |
| **Ashby** | Extremely compact decision surface & evidence summaries | Lacks automated deep technical trade-off breakdown |
| **HireVue** | Tagged interview moments & proctoring insights | Opaque AI scoring; rigid video prompts without adaptive follow-ups |
| **Interviewer.AI** | Detailed skill breakdowns & actionable candidate improvement tips | High robotic tone in candidate feedback summaries |
| **SHRM Guidelines** | Job-relatedness, standardized evaluation rubrics, human oversight | Traditional paper-based workflows |

---

## 3. The 6-Layer Progressive-Disclosure Report Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: EXECUTIVE CANDIDATE SNAPSHOT (Rapid Review Surface)                │
│  - Overall Score (0-100), Match Category (STRONG MATCH / MATCH / POTENTIAL) │
│  - Executive Narrative Summary + Quick Counter Badges                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 2: COMPETENCY SCORECARD (Anchored Rating Surface)                     │
│  - 4 Pillars: Knowledge Depth, Problem Solving, Reasoning, Communication    │
│  - Score + Rating Level + Evidence Coverage Level (HIGH / MEDIUM / LOW)     │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 3: SPECIFIC STRENGTHS (Evidence-Linked Accomplishments)               │
│  - Demonstrated Skill + Specific Mechanism + Evidence Anchor                │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 4: DEVELOPMENT AREAS (Actionable Growth Blueprint)                   │
│  - Missed Concept/Trade-off + Specific Evidence + Practice Recommendation   │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 5: QUESTION-BY-QUESTION EVIDENCE CHAIN (Collapsible Tracing Surface) │
│  - Question -> Answer -> Scores -> Concepts -> Technical Errors -> Probes   │
├─────────────────────────────────────────────────────────────────────────────┤
│ LAYER 6: HIRING DECISION SUPPORT (Decision Support Surface)                 │
│  - Decision Support Signal (STRONG CONSIDERATION / CONSIDERATION / CAUTION) │
│  - Role Technical Readiness + Recommended Next Action                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Differentiated 3-Dashboard Visibility Matrix

| Layer / Field | Candidate Dashboard | HR Dashboard | Admin Dashboard |
|---|---|---|---|
| **Layer 1: Snapshot** | Personal Summary (No Hiring Signal) | ✅ Executive Candidate Snapshot | ✅ Executive Candidate Snapshot |
| **Layer 2: Scorecard** | Competency Highlights | ✅ Full Competency Scorecard | ✅ Full Competency Scorecard |
| **Layer 3: Strengths** | ✅ Strengths & Skill Badges | ✅ Specific Strengths + Evidence | ✅ Specific Strengths + Evidence |
| **Layer 4: Dev Areas** | ✅ Actionable Growth Blueprint | ✅ Development Areas + Trade-offs | ✅ Development Areas + Trade-offs |
| **Layer 5: Evidence** | Practice recommendations | ✅ Question Breakdown & Probes | ✅ Full Evidence Chain + Transcripts |
| **Layer 6: Signal** | ❌ Excluded (Candidate privacy) | ✅ Hiring Decision Support Signal | ✅ Hiring Decision Support Signal |
| **Proctoring** | ❌ Excluded (Prevents candidate stress)| ✅ Proctoring Integrity Summary | ✅ Forensic Proctoring Details |
| **Telemetry** | ❌ Excluded | ❌ Excluded | ✅ Full Provenance & LLM Telemetry |

---

## 5. Formal Data Contracts (`EnrichedReportDTO_v1`)

```typescript
export interface EnrichedCompetencyScorecard_v1 {
  competencyKey: 'knowledge' | 'reasoning' | 'problem_solving' | 'communication';
  title: string;
  score: number; // 0-100
  ratingLevel: 'EXPERT' | 'STRONG' | 'COMPETENT' | 'DEVELOPING' | 'NEEDS_WORK';
  evidenceCoverage: 'HIGH' | 'MEDIUM' | 'LOW';
  evidenceSummary: string;
}

export interface EnrichedStrengthItem_v1 {
  skillName: string;
  mechanismExplained: string;
  businessImpact: string;
  evidenceQuestionIndex: number;
}

export interface EnrichedDevelopmentItem_v1 {
  areaName: string;
  tradeoffMissed: string;
  actionablePracticeFormula: string;
  evidenceQuestionIndex: number;
}

export interface EnrichedHiringSignal_v1 {
  signal: 'STRONG CONSIDERATION' | 'CONSIDERATION' | 'CAUTION';
  readinessLevel: string;
  recommendedNextStep: string;
  rationale: string;
}

export interface EnrichedReportDTO_v1 {
  schemaVersion: 'v1.0';
  generatedAt: string;
  layer1_snapshot: {
    overallScore: number;
    matchCategory: 'STRONG MATCH' | 'GOOD MATCH' | 'POTENTIAL MATCH' | 'DEVELOPMENT NEEDED';
    summaryNarrative: string;
    strengthCount: number;
    devAreaCount: number;
  };
  layer2_scorecard: EnrichedCompetencyScorecard_v1[];
  layer3_strengths: EnrichedStrengthItem_v1[];
  layer4_devAreas: EnrichedDevelopmentItem_v1[];
  layer5_evidenceChain: {
    questionIndex: number;
    questionText: string;
    score: number;
    userAnswer: string;
    conceptsCovered: string[];
    conceptsMissed: string[];
    technicalErrors: string[];
    adaptiveProbe?: string;
  }[];
  layer6_hiringSignal: EnrichedHiringSignal_v1;
}
```

---

## 6. Verification & Sign-off Gate

Phase 11.0 is hereby signed off and frozen as the canonical UX specification for Phase 11 execution.
