import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveSessionViewModel,
  EvaluationModeType,
  normalizeScore,
  extractSessionScore,
  getDisplayEvalMode,
} from '../src/Core/utils/sessionStatusResolver';
import { ReportGenerator } from '../src/Evaluation/pipeline/ReportGenerator';
import { getEffectiveSessionReport } from '../src/Core/utils/reportReconstructor';

/**
 * Regression guard for the four reported dashboard defects:
 *
 *   1. Every session displayed evaluation mode LOCAL, including sessions configured for API or
 *      HYBRID in the interview flow editor.
 *   2. Reports failed to appear in the Admin and Candidate dashboards.
 *   3. A completed interview with recorded answers rendered the "No Questions Answered" card.
 *   4. Reports rendered "Interview Duration 0s" and question counts such as "11 / 10".
 *
 * The behavioural assertions run the real resolver and the real report generator. Where a
 * property can only be pinned by inspecting source (a database write inside a render path, a SQL
 * view definition), the source is read with comments stripped first — a static assertion that
 * matches its own explanatory comment proves nothing.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Strips comments so assertions cannot be satisfied by prose describing the fix. */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('evaluation mode is reported from the session, not defaulted to LOCAL', () => {
  it('reads the configured mode surfaced by vw_candidate_master', () => {
    // This is the field the whole bug hinged on: the session records its mode, but nothing
    // carried it to the dashboard, so the resolver never had it to read.
    expect(resolveSessionViewModel({ evaluation_mode: 'API' }).evalMode).toBe(EvaluationModeType.API);
    expect(resolveSessionViewModel({ evaluation_mode: 'HYBRID' }).evalMode).toBe(EvaluationModeType.HYBRID);
    expect(resolveSessionViewModel({ evaluation_mode: 'LOCAL' }).evalMode).toBe(EvaluationModeType.LOCAL);
  });

  it('does NOT claim LOCAL when the mode is unknown', () => {
    // The original defect. A session with no report and no recorded mode was displayed as LOCAL,
    // asserting to the recruiter that the deterministic engine had assessed the candidate.
    const noEvidence = { session_status: 'COMPLETED', questions_answered: 5 };
    expect(resolveSessionViewModel(noEvidence).evalMode).toBe(EvaluationModeType.UNKNOWN);
    expect(resolveSessionViewModel(null).evalMode).toBe(EvaluationModeType.UNKNOWN);
  });

  it('lets what actually ran outrank what was configured', () => {
    // A session set up for API whose report records a local fallback must show LOCAL: the
    // recruiter is looking at a score the local engine produced.
    const vm = resolveSessionViewModel({
      evaluation_mode: 'API',
      evaluation_logic: { metadata: { evaluationMode: 'LOCAL' } },
    });
    expect(vm.evalMode).toBe(EvaluationModeType.LOCAL);
  });

  it('does not let a substring match steal HYBRID', () => {
    // 'HYBRID-API' and similar composite values must not resolve to API.
    expect(resolveSessionViewModel({ evaluation_mode: 'HYBRID-API' }).evalMode).toBe(EvaluationModeType.HYBRID);
  });

  it('still falls back to the provider recorded on the report', () => {
    expect(
      resolveSessionViewModel({ evaluation_logic: { metadata: { provider: 'openrouter' } } }).evalMode
    ).toBe(EvaluationModeType.API);
    expect(
      resolveSessionViewModel({ evaluation_logic: { metadata: { provider: 'local-heuristic' } } }).evalMode
    ).toBe(EvaluationModeType.LOCAL);
  });

  it('the migration exposes evaluation_mode so the resolver has something to read', () => {
    const migration = read('supabase/migrations/20260801000001_expose_evaluation_mode_in_candidate_master.sql');
    expect(migration).toContain('CREATE OR REPLACE VIEW vw_candidate_master');
    expect(migration).toContain('AS evaluation_mode');
    expect(migration).toMatch(/interview_metadata\s*->>\s*'evaluationMode'/);
    // The job snapshot is the fallback for sessions created before the top-level key existed.
    expect(migration).toMatch(/'job_settings_snapshot'\s*->>\s*'evaluationMode'/);
    // Absent must be NULL, not '' — '' is truthy-adjacent noise the resolver would have to guess at.
    expect(migration).toContain('NULLIF(');
    // is_practice must survive: CREATE OR REPLACE VIEW only permits appending columns, so
    // dropping it here would fail in production and break the practice-session filter.
    expect(migration).toContain('AS is_practice');
  });

  it('both session feeds forward evaluation_mode to the dashboards', () => {
    const service = code('src/Core/database/supabaseService.ts');
    // Once in getAllSessions' primary path, once in its degraded path, once in getStudentSessions.
    const occurrences = service.match(/evaluation_mode:\s*record\.evaluation_mode/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });
});

describe('report reconstruction never fabricates or persists', () => {
  /**
   * These assertions follow the code rather than a filename.
   *
   * `getEffectiveSessionReport` and `resolveSessionEvaluationMode` originally lived inside
   * AdminDashboard.tsx and were later extracted to src/Core/utils/reportReconstructor.ts so the
   * Admin, HR and Candidate views could share one implementation. That extraction is exactly the
   * outcome these tests want, but they were pinned to the old location by `indexOf(...)` and so
   * failed on a refactor that improved the thing they guard. They now target the owning module
   * and, where the code is reachable, execute it instead of reading it.
   */
  const RECONSTRUCTOR = 'src/Core/utils/reportReconstructor.ts';
  const reconstructorSource = code(RECONSTRUCTOR);
  const CONSUMERS = [
    'src/Admin/components/AdminDashboard.tsx',
    'src/candidate/components/CompletedInterviews.tsx',
    'src/HR/components/HRDashboard.tsx',
  ];

  it('the reconstruction is not written back to the database', () => {
    // The original defect: a render path called saveEvaluationReport, stamping a LOCAL report
    // into the database for any session that lacked one. That row then became the
    // highest-priority source for the mode, making the wrong value permanent.
    expect(reconstructorSource).not.toContain('saveEvaluationReport');
    expect(reconstructorSource).not.toMatch(/SupabaseService\.\w*[Ss]ave/);
    expect(reconstructorSource).not.toContain('supabase');
  });

  it('reconstructs a usable report from stored responses (behavioural)', () => {
    const report: any = getEffectiveSessionReport({
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      duration_minutes: 12,
      all_questions_and_answers: [
        { question_text: 'Explain indexing.', candidate_answer: 'B-trees keep keys sorted.', content_score: 7, verdict: 'Pass' },
        { question_text: 'What is sharding?', candidate_answer: 'Not sure.', content_score: 1, verdict: 'Fail' },
      ],
    });
    expect(report).toBeTruthy();
    expect(report.questionBreakdown).toHaveLength(2);
    // Duration must survive: rendering "0s" for a 12-minute interview was one of the reported bugs.
    expect(report.proctoringSummary.sessionDurationMs).toBe(12 * 60_000);
  });

  it('an unevaluated answer scores 0, not a fabricated pass (behavioural)', () => {
    // `content_score` is written on every successfully evaluated answer, so null means the
    // evaluation failed. Defaulting it to 5/10 manufactured a pass out of a failure.
    const report: any = getEffectiveSessionReport({
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      all_questions_and_answers: [{ question_text: 'Q', candidate_answer: 'An answer.' }],
    });
    expect(report.questionBreakdown[0].score).toBe(0);
    expect(report.questionBreakdown[0].verdict ?? 'Not Evaluated').not.toBe('Pass');
  });

  it('returns null rather than a report when there is nothing to reconstruct from', () => {
    expect(getEffectiveSessionReport({ session_id: '123e4567-e89b-12d3-a456-426614174000' })).toBeNull();
  });

  it('the mode resolver is not reimplemented per dashboard', () => {
    // Three divergent copies of the resolution chain existed; the same session could be labelled
    // differently in two places on one screen. There must now be exactly one, and it must
    // delegate to the shared view-model resolver rather than defaulting to LOCAL.
    expect(reconstructorSource).toContain('resolveSessionViewModel');
    expect(reconstructorSource).not.toMatch(/return\s+['"]LOCAL['"]/);

    for (const file of CONSUMERS) {
      const src = code(file);
      expect(src, `${file} must import the shared reconstructor, not redefine it`).not.toMatch(
        /(export\s+)?const\s+getEffectiveSessionReport\s*=/
      );
      expect(src, `${file} must not redefine the mode resolver`).not.toMatch(
        /(export\s+)?const\s+resolveSessionEvaluationMode\s*=/
      );
    }
  });

  it('no dashboard fabricates a report from constants when evaluation_logic is missing', () => {
    for (const file of CONSUMERS) {
      const src = code(file);
      // The exact fabrications that shipped, and that regressed into HRDashboard.tsx when the
      // recruiter-onboarding branch was merged.
      expect(src, `${file} must not invent a 50% technical score`).not.toMatch(
        /overall_score\s*\|\|\s*50/
      );
      expect(src, `${file} must not hardcode report confidence`).not.toMatch(
        /reportConfidence:\s*['"]Medium['"]/
      );
    }
  });
});

describe('report statistics reflect what actually happened', () => {
  const proctoring: any = {
    sessionDurationMs: 605_000,
    integrityScore: 100,
    violations: [],
    gazeAwayEvents: 0,
    multipleFaceEvents: 0,
    tabSwitchEvents: 0,
    totalGazeAwayDurationMs: 0,
    isTerminated: false,
  };

  // `any` because AnswerRecord.evaluation is the full 60-field EvaluationResult; these tests only
  // exercise the fields computeFinalReport reads, and spelling out the rest would obscure them.
  const answer = (i: number, isFollowUp = false): any => ({
    questionId: i,
    questionText: `Q${i}`,
    transcript: 'A real answer with substance.',
    isFollowUp,
    evaluation: { contentScore: 7, communicationClarityScore: 7 },
  });

  it('carries the interview duration into proctoringSummary', () => {
    // SessionReportView reads report.proctoringSummary.sessionDurationMs. The key was never
    // populated, so EVERY report in every mode rendered "Interview Duration 0s".
    const report = ReportGenerator.computeFinalReport([answer(1)], proctoring);
    expect(report.proctoringSummary.sessionDurationMs).toBe(605_000);
  });

  it('defaults the duration to 0 rather than undefined when there is no proctoring data', () => {
    const report = ReportGenerator.computeFinalReport([answer(1)], null);
    expect(report.proctoringSummary.sessionDurationMs).toBe(0);
  });

  it('records termination as a fact instead of leaving it to be inferred', () => {
    const report = ReportGenerator.computeFinalReport([answer(1)], {
      ...proctoring,
      isTerminated: true,
      terminationReason: 'Too many tab switches (3/3).',
    });
    expect(report.proctoringSummary.isTerminated).toBe(true);
    expect(report.proctoringSummary.terminationReason).toBe('Too many tab switches (3/3).');
  });

  it('marks follow-ups in the question breakdown', () => {
    // Without this the report view cannot tell planned questions from adaptive follow-ups, which
    // is what produced "Questions Attempted 11 / 10".
    const history = [answer(1), answer(2), answer(3, true)];
    const report = ReportGenerator.computeFinalReport(history, proctoring);
    const flags = report.questionBreakdown.map((q: any) => q.isFollowUp);
    expect(flags).toEqual([false, false, true]);
    expect(report.questionBreakdown.filter((q: any) => !q.isFollowUp)).toHaveLength(2);
  });

  it('the report view derives question counts instead of hardcoding ten', () => {
    const view = code('src/Analytics/components/SessionReportView.tsx');
    expect(view).not.toMatch(/const expectedQuestions\s*=\s*10\s*;/);
    expect(view).not.toMatch(/questionsAttempted\s*<\s*10/);
    // Follow-ups are excluded from the attempted count so the ratio describes the planned interview.
    expect(view).toMatch(/filter\(\(q: any\)\s*=>\s*!q\.isFollowUp\)/);
    // The banner must be driven by recorded termination, not by a question-count heuristic.
    expect(view).toMatch(/wasTerminated\s*=\s*report\.proctoringSummary\?\.isTerminated/);
    expect(view).toMatch(/isTerminatedEarly\s*=\s*wasTerminated/);
  });
});

describe('a finished session cannot be rewritten to zero', () => {
  it('completeSession refuses to overwrite a terminal session', () => {
    const service = code('src/Core/database/supabaseService.ts');
    const start = service.indexOf('static async completeSession');
    expect(start).toBeGreaterThan(-1);
    const end = service.indexOf('static async saveResponse', start);
    const body = service.slice(start, end > -1 ? end : undefined);

    // The interview screen's pagehide handler calls completeSession(0, 'TERMINATED', 0, ...).
    // Without this guard, a late call against an already-finished session zeroed its recorded
    // duration and question count while its answers remained on file.
    expect(body).toMatch(/status\s*===\s*["']COMPLETED["']/);
    expect(body).toMatch(/status\s*===\s*["']TERMINATED["']/);
    // The guard must return before issuing the UPDATE.
    const guardIdx = body.indexOf("=== \"COMPLETED\"") >= 0 ? body.indexOf("=== \"COMPLETED\"") : body.indexOf("=== 'COMPLETED'");
    const updateIdx = body.indexOf('.update(payload)');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(guardIdx);
  });

  it('createSession lets the resolved evaluation mode win over caller metadata', () => {
    const service = code('src/Core/database/supabaseService.ts');
    const start = service.indexOf('interview_metadata: {');
    const body = service.slice(start, start + 400);
    const spreadIdx = body.indexOf('...metadata,');
    const modeIdx = body.indexOf('evaluationMode: effectiveMode');
    expect(spreadIdx).toBeGreaterThan(-1);
    expect(modeIdx).toBeGreaterThan(-1);
    // metadata is spread FIRST; a caller passing an empty evaluationMode must not blank out the
    // resolved mode, which is now the dashboards' source of truth.
    expect(modeIdx).toBeGreaterThan(spreadIdx);
  });
});

describe('Canonical Score Extraction, Dual-Table Persistence & Provenance Contracts', () => {
  it('normalizeScore validates range 0-100 and rejects invalid inputs', () => {
    expect(normalizeScore(78)).toBe(78);
    expect(normalizeScore(0)).toBe(0);
    expect(normalizeScore(100)).toBe(100);
    expect(normalizeScore('85')).toBe(85);
    expect(normalizeScore(-10)).toBeNull();
    expect(normalizeScore(145)).toBeNull();
    expect(normalizeScore(NaN)).toBeNull();
    expect(normalizeScore(null)).toBeNull();
    expect(normalizeScore('unknown')).toBeNull();
  });

  it('extractSessionScore respects strict hierarchy precedence and ignores sub-metrics', () => {
    // 1. Root overall_score wins
    expect(extractSessionScore({ overall_score: 88, overallScore: 60, total_score: 40 })).toBe(88);
    
    // 2. Root total_score wins if overall_score is missing
    expect(extractSessionScore({ total_score: 75, evaluation_logic: { finalScore: 90 } })).toBe(75);

    // 3. Nested finalScore wins if root fields are null
    expect(extractSessionScore({ total_score: null, evaluation_logic: { finalScore: 82 } })).toBe(82);

    // 4. Sub-metrics like trustScore or technicalScore alone must NOT become overall score
    const subMetricOnly = {
      overall_score: null,
      total_score: null,
      evaluation_logic: { executiveSummary: { trustScore: 95, technicalScore: 60 } }
    };
    expect(extractSessionScore(subMetricOnly)).toBeNull();
  });

  it('preserves 0 as a valid score and null as missing score', () => {
    // 0 -> 0%
    const zeroSession = resolveSessionViewModel({ session_status: 'COMPLETED', questions_answered: 3, overall_score: 0 });
    expect(zeroSession.displayScoreText).toBe('0%');

    // null -> —
    const nullSession = resolveSessionViewModel({ session_status: 'COMPLETED', questions_answered: 3, overall_score: null, total_score: null });
    expect(nullSession.displayScoreText).toBe('—');
  });

  it('getDisplayEvalMode transforms API_FALLBACK to API (Fallback)', () => {
    expect(getDisplayEvalMode('API_FALLBACK')).toBe('API (Fallback)');
    expect(getDisplayEvalMode('API')).toBe('API');
    expect(getDisplayEvalMode('LOCAL')).toBe('LOCAL');
    expect(getDisplayEvalMode('HYBRID')).toBe('HYBRID');
  });

  it('saveEvaluationReport updates both evaluation_reports and interview_sessions without 0-defaulting', () => {
    const src = code('src/Core/database/supabaseService.ts');
    expect(src).toContain('const canonicalScore = normalizeScore(');
    expect(src).toMatch(/interview_sessions[\s\S]*?total_score:\s*canonicalScore/);
    expect(src).toMatch(/interview_sessions[\s\S]*?overall_score:\s*canonicalScore/);
    // Must NOT default missing scores to 0
    expect(src).not.toMatch(/total_score:\s*canonicalScore\s*\|\|\s*0/);
  });
});

