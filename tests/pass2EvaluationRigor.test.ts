import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ScoreAggregator, KNOWLEDGE_GATE_CAP } from '../src/Evaluation/pipeline/ScoreAggregator';
import { ReportGenerator } from '../src/Evaluation/pipeline/ReportGenerator';
import { computeRecommendation } from '../shared/scoringPolicy';

/**
 * PASS 2 regression guards for the verified audit findings.
 *
 * 1A  communicationClarityScore was floored at 8.0 unconditionally.
 * 1B  factsScore = 4.0 was granted to ANY schema-less question, bypassing the Knowledge Gate
 *     (which can only engage when a question defines expected concepts). This was the true root
 *     cause of the "name and college" anomaly: 7.2/10 -> 72/100 -> "Hire".
 * 1C  Score Gravity engaged at <= 2.0 while the Knowledge Gate capped at 3.0, so `3.0 <= 2.0`
 *     was false and gravity never fired for the answers it exists to catch.
 * 1D  Session accumulators defaulted a missing sub-dimension to 5 (50%).
 * 2B  technicalErrors was hardcoded to [] in questionBreakdown.
 * 2C  Incorrect answers were credited with "Attempted an explanation" / "Kept communication active".
 */

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const codeOf = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Minimal PipelineContext sufficient for ScoreAggregator. */
function ctx(overrides: any = {}): any {
  return {
    developerTrace: [],
    conceptEvidence: [],
    matchedConcepts: new Set<string>(),
    conceptCompleteness: new Map<string, any>(),
    misconceptionEvidence: [],
    technicalErrors: [],
    selfCorrectionsCount: 0,
    questionSatisfaction: 'YES',
    relevantContentRatio: 1.0,
    tokens: new Array(40).fill('word'),
    reachedDepth: [],
    missedDependencies: [],
    validConnections: [],
    invalidConnections: [],
    unrecognizedClaims: [],
    localRepetitionPenalties: 0,
    isHonestUnknown: false,
    uncertaintyDetected: false,
    buzzwordStuffingDetected: false,
    circularExplanationDetected: false,
    transcript: 'my name is John from XYZ College',
    question: { rubric: null, knowledgeModel: [], evaluationGuide: ['Explain the concept'], type: 'Technical' },
    ...overrides,
  };
}
const run = (c: any) => { new ScoreAggregator().execute(c); return c; };

describe('1C: Score Gravity is synchronised with the Knowledge Gate', () => {
  it('exports one shared constant instead of two drifting literals', () => {
    expect(KNOWLEDGE_GATE_CAP).toBe(3.0);
    const src = codeOf('src/Evaluation/pipeline/ScoreAggregator.ts');
    // Gravity must derive its trigger from the gate, never re-hardcode a number.
    expect(src).toContain('context.technicalAccuracyScore <= KNOWLEDGE_GATE_CAP');
    expect(src).not.toMatch(/technicalAccuracyScore <= 2\.0/);
  });

  it('engages for a gated answer, so peripherals cannot stay at 8.0+', () => {
    const c = run(ctx({
      question: {
        rubric: { coreConcepts: ['docker-isolation', 'image-layers'], supportingConcepts: [] },
        knowledgeModel: [], evaluationGuide: ['Explain Docker'], type: 'Technical',
      },
      // Demonstrates nothing -> Knowledge Gate caps accuracy at 3.0.
    }));

    expect(c.technicalAccuracyScore).toBeLessThanOrEqual(KNOWLEDGE_GATE_CAP);
    expect(c.developerTrace.join(' ')).toMatch(/Score Gravity/);
    // The explicit requirement: no 8.0+ communication or confidence on a no-knowledge answer.
    expect(c.communicationClarityScore).toBeLessThan(8.0);
    expect(c.confidenceCalibrationScore).toBeLessThan(8.0);
    expect(c.reasoningScore).toBeLessThan(8.0);
  });

  it('leaves a competent answer untouched', () => {
    const c = run(ctx({
      question: {
        rubric: { coreConcepts: ['docker-isolation'], supportingConcepts: [] },
        knowledgeModel: [], evaluationGuide: ['Explain Docker'], type: 'Technical',
      },
      conceptEvidence: [{ conceptId: 'docker-isolation', negated: false }],
      matchedConcepts: new Set(['docker-isolation']),
    }));
    expect(c.technicalAccuracyScore).toBeGreaterThan(KNOWLEDGE_GATE_CAP);
    expect(c.developerTrace.join(' ')).not.toMatch(/Score Gravity/);
  });
});

describe('1A: the unconditional 8.0 communication floor is gone', () => {
  it('no longer clamps communication up to 8.0', () => {
    const src = codeOf('src/Evaluation/pipeline/ScoreAggregator.ts');
    expect(src).not.toContain('Math.max(8.0, commScore)');
  });

  it('lets repetition penalties actually land', () => {
    const c = run(ctx({
      localRepetitionPenalties: 5,
      question: { rubric: null, knowledgeModel: [], evaluationGuide: ['x'], type: 'Behavioral Experience' },
    }));
    // 10 - 5 = 5.0; under the old floor this reported 8.0.
    expect(c.communicationClarityScore).toBeLessThan(8.0);
  });
});

describe('1B: the schema-less fallback floor no longer rescues technical non-answers', () => {
  it('a TECHNICAL question with no rubric gets no factual baseline', () => {
    const c = run(ctx({
      question: { rubric: null, knowledgeModel: [], evaluationGuide: ['Explain Docker'], type: 'Technical' },
    }));
    expect(c.developerTrace.join(' ')).toMatch(/Fallback Floor SUPPRESSED/);
    // The reported anomaly: this used to reach 7.2/10 -> 72/100 -> "Hire".
    const pct = Math.round(c.technicalAccuracyScore * 10);
    expect(pct).toBeLessThan(50);
    expect(computeRecommendation(pct, 100)).toBe('Reject');
  });

  it('an OPEN-ENDED question keeps the floor — a coherent answer there is a genuine pass', () => {
    const c = run(ctx({
      question: {
        rubric: null, knowledgeModel: [], evaluationGuide: ['Background'],
        type: 'Behavioral Experience', interviewCategory: 'Introduction',
      },
      transcript: 'I am a final year computer science student who enjoys backend work.',
    }));
    expect(c.developerTrace.join(' ')).toMatch(/Fallback Floor: open-ended/);
    expect(c.technicalAccuracyScore).toBeGreaterThan(KNOWLEDGE_GATE_CAP);
  });

  it('treats a question with NO type metadata as technical (strict by default)', () => {
    // Deliberate: an unclassified question is far more likely to be a custom recruiter-authored
    // technical prompt than a behavioural one, and the audit specifically called out custom
    // recruiter questions as a route by which fluff earned a pass. Failing closed is the correct
    // default for a hiring decision; real questions all carry metadata, so this affects only
    // unclassified custom prompts.
    const c = run(ctx({
      question: { rubric: null, knowledgeModel: [], evaluationGuide: ['Explain something'] },
    }));
    expect(c.developerTrace.join(' ')).toMatch(/Fallback Floor SUPPRESSED/);
  });

  it('recognises open-ended questions by category as well as by type', () => {
    for (const interviewCategory of ['Introduction', 'Communication', 'Behavioral', 'Project', 'Situational']) {
      const c = run(ctx({
        question: { rubric: null, knowledgeModel: [], evaluationGuide: ['x'], type: 'Core', interviewCategory },
      }));
      expect(c.developerTrace.join(' '), interviewCategory).toMatch(/Fallback Floor: open-ended/);
    }
  });
});

describe('1D: aggregate accumulators no longer default to 50%', () => {
  const proctoring: any = { integrityScore: 100, violations: [] };

  it('a missing sub-dimension contributes 0, not 5', () => {
    // contentScore present and 0; the other dimensions absent entirely.
    const report = ReportGenerator.computeFinalReport(
      [{ questionText: 'Q1', transcript: 'name and college', evaluation: { contentScore: 0 } } as any],
      proctoring,
    );
    expect(report.overallScores.knowledgeScore).toBe(0);
    expect(report.overallScores.communicationScore).toBe(0);
    expect(report.executiveSummary.technicalScore).toBe(0);
    expect(report.executiveSummary.recommendation).toBe('Reject');
  });

  it('display and timeline fallbacks are deliberately left at 5 so the UI still renders', () => {
    const src = codeOf('src/Evaluation/pipeline/ReportGenerator.ts');
    expect(src).toMatch(/score: evalData\.contentScore \?\? 5/);
    expect(src).toMatch(/qIndex: i \+ 1, score: \(h\.evaluation\?\.contentScore \?\? 5\)/);
  });

  it('a genuinely strong session is unaffected', () => {
    const report = ReportGenerator.computeFinalReport(
      [{
        questionText: 'Q1', transcript: 'detailed answer',
        evaluation: { contentScore: 9, conceptUnderstandingScore: 9, reasoningScore: 8, communicationClarityScore: 9 },
      } as any],
      proctoring,
    );
    expect(report.executiveSummary.technicalScore).toBe(90);
    expect(report.executiveSummary.recommendation).toBe('Strong Hire');
  });
});

describe('2B: technical errors reach the recruiter', () => {
  const proctoring: any = { integrityScore: 100, violations: [] };

  it('is no longer hardcoded to an empty array', () => {
    expect(codeOf('src/Evaluation/pipeline/ReportGenerator.ts')).not.toContain('technicalErrors: [],');
  });

  it('surfaces LLM errors nested under analysis', () => {
    const report = ReportGenerator.computeFinalReport(
      [{
        questionText: 'Explain JOINs', transcript: 'wrong answer',
        evaluation: {
          contentScore: 2,
          analysis: { technicalErrors: [{ error: 'Confused INNER JOIN with LEFT JOIN', severity: 'medium' }] },
        },
      } as any],
      proctoring,
    );
    expect(report.questionBreakdown[0].technicalErrors).toEqual(['Confused INNER JOIN with LEFT JOIN']);
  });

  it('surfaces flat local-engine errors and plain strings alike', () => {
    const report = ReportGenerator.computeFinalReport(
      [{
        questionText: 'Q', transcript: 'a',
        evaluation: { contentScore: 2, technicalErrors: ['Stated Docker is a virtual machine', { explanation: 'Reversed TCP and UDP' }] },
      } as any],
      proctoring,
    );
    expect(report.questionBreakdown[0].technicalErrors).toEqual([
      'Stated Docker is a virtual machine',
      'Reversed TCP and UDP',
    ]);
  });

  it('drops unusable entries rather than rendering blanks or [object Object]', () => {
    const report = ReportGenerator.computeFinalReport(
      [{ questionText: 'Q', transcript: 'a', evaluation: { contentScore: 2, technicalErrors: [{}, '', null, '  '] } } as any],
      proctoring,
    );
    expect(report.questionBreakdown[0].technicalErrors).toEqual([]);
  });
});

describe('2C: no participation trophies for an incorrect answer', () => {
  const src = codeOf('src/Core/api/apiService.ts');

  it('the two reported phrases are gone', () => {
    expect(src).not.toContain('"Attempted an explanation"');
    expect(src).not.toContain('"Kept communication active"');
  });

  it('next steps are actionable rather than restating the question', () => {
    expect(src).not.toContain('`Understand the core principles of ${item}`');
  });
});

describe('Phase 3: the dead legacy hybrid path is gone', () => {
  it('the deprecated orchestrator is removed', () => {
    const src = read('src/Evaluation/dispatch/EvaluationDispatcher.ts');
    expect(src).not.toContain('runBatchEvaluation');
    expect(src).not.toContain('BatchLLMSynthesizer');
    expect(src).not.toContain('BatchLLMEvaluator');
  });

  it('the dead engine files no longer exist', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/Evaluation/engines/BatchLLMEvaluator.ts'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src/Evaluation/engines/BatchLLMSynthesizer.ts'))).toBe(false);
  });

  it('the LIVE hybrid path is untouched and still builds its report from LLM scores', () => {
    const edge = read('supabase/functions/evaluate-hybrid-job/index.ts');
    expect(edge).toContain('buildHybridReport');
    expect(edge).toContain('buildBatchEvaluationPrompt');
  });

  it('the live prompt enforces a Reject-band ceiling on fluff', () => {
    const prompt = read('shared/promptBuilder.ts');
    expect(prompt).toMatch(/SCORING FLOOR RULES/);
    // The phrase wraps across a line in the prompt template, so allow any whitespace.
    expect(prompt).toMatch(/name,\s+college/i);
    expect(prompt).toMatch(/buzzword recitation/i);
    // Fluency must be explicitly disqualified as evidence of knowledge.
    expect(prompt).toMatch(/are NOT evidence of knowledge/i);
    // Candidate-fairness clauses must survive alongside the stricter ceilings.
    expect(prompt).toMatch(/own\s+words/i);
    expect(prompt).toMatch(/Honest unknowns/i);
  });
});

describe('2A: API mode no longer falls back to boilerplate', () => {
  it('the dispatcher passes a 4th argument for API mode only', () => {
    const src = codeOf('src/Evaluation/dispatch/EvaluationDispatcher.ts');

    // Asserted as behaviour, not as formatting.
    //
    // This originally pinned the literal expression
    //   `mode === EvaluationMode.API ? this.buildApiAnalysis(history) : undefined`
    // which broke when the dispatcher was legitimately extended with an API-failure fallback
    // path (commits 9db3131 / 21e3ffd). The guarantee never changed — the LLM-derived analysis
    // is still built only on the non-local branch and still passed as the 4th argument — but the
    // shape did, and a guard that fails on a valid refactor trains people to ignore it.
    expect(src).toContain('buildApiAnalysis');
    // 1. The analysis is only built when the mode is NOT local.
    expect(src).toMatch(/const\s+isLocal\s*=\s*mode\s*===\s*EvaluationMode\.LOCAL/);
    expect(src).toMatch(/if\s*\(\s*!isLocal\s*\)\s*\{[\s\S]*?this\.buildApiAnalysis\(history\)/);

    // 2. It is handed to computeFinalReport as the 4th argument.
    expect(src).toMatch(/\}\s*,\s*aiAnalysisPayload\s*\)/);

    // 3. HYBRID is finalised on its own earlier branch and must not receive one — a hybrid
    //    report is heuristic at this point and its LLM pass happens later in the queue worker.
    const hybridBranch = src.slice(
      src.indexOf('if (mode === EvaluationMode.HYBRID)'),
      src.indexOf('const isLocal')
    );
    expect(hybridBranch.length).toBeGreaterThan(0);
    expect(hybridBranch).not.toContain('buildApiAnalysis');
  });

  it('ReportGenerator prefers a supplied analysis over its template', () => {
    const report = ReportGenerator.computeFinalReport(
      [{ questionText: 'Q', transcript: 'a', evaluation: { contentScore: 4 } } as any],
      { integrityScore: 100, violations: [] } as any,
      {},
      { summary: 'LLM-derived narrative.', strengths: ['Explained indexing.'], weaknesses: ['Missed sharding.'] },
    );
    expect(report.executiveSummary.summary).toBe('LLM-derived narrative.');
    expect(report.strengths).toEqual(['Explained indexing.']);
    expect(report.weaknesses).toEqual(['Missed sharding.']);
  });
});
