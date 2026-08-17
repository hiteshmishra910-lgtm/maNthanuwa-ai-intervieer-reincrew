import { InterviewSession } from '../../../types';
import { ReportGenerator } from '../../Evaluation/pipeline/ReportGenerator';
import { resolveSessionViewModel, EvaluationModeType } from './sessionStatusResolver';
import { isDemoSessionId } from '../demo/demoGuards';
import { DemoDataService } from '../demo/demoDataService';

export const resolveSessionEvaluationMode = (session: any): EvaluationModeType =>
  resolveSessionViewModel(session).evalMode;

export interface SessionDataHealth {
  reportsLoaded: boolean;
  responsesLoaded: boolean;
  proctoringLoaded: boolean;
}

export const getEffectiveSessionReport = (session: any) => {
  if (!session) return null;

  const sessionId = typeof session === 'string' ? session : (session.id || session.session_id);
  if (sessionId && isDemoSessionId(sessionId)) {
    return DemoDataService.getDemoSessionReport(sessionId);
  }

  // Priority 1: Use the stored evaluation_logic from evaluation_reports if available.
  let evalLogic =
    session.evaluation_logic ||
    session.evaluationReport?.evaluation_logic ||
    session.evaluation_reports?.[0]?.evaluation_logic ||
    session.interview_metadata?.evaluation_logic ||
    session.interview_metadata?.evaluationReport?.evaluation_logic;

  if (typeof evalLogic === 'string') {
    try {
      evalLogic = JSON.parse(evalLogic);
    } catch (_) {
      // Ignore parse failure, fall through to reconstruction
    }
  }

  if (evalLogic && typeof evalLogic === 'object' && Object.keys(evalLogic).length > 0) {
    return evalLogic;
  }

  // Priority 2: Reconstruct a report from individual session_responses.
  const resultsList =
    session.results ||
    session.all_questions_and_answers ||
    session.responses ||
    session.session_responses ||
    session.all_responses ||
    [];
  const hasResults = Array.isArray(resultsList) && resultsList.length > 0;
  const sessionScore = session.overall_score || session.overallScore || session.total_score || 0;

  // If the query failed, we shouldn't fabricate a 0-score report.
  // The UI will handle displaying the explicit error state.
  if (session.queryFailures?.responses) {
    return {
      _isMissingData: true,
      evaluationStatus: 'FAILED',
      finalScore: sessionScore,
      reason: 'Evaluation report could not be reconstructed because responses failed to load.',
    };
  }

  // If we have no responses, but we HAVE a score, this is a corrupted session (AI failed/Parser crashed)
  if (!hasResults && sessionScore > 0) {
    return {
      _isMissingData: true,
      evaluationStatus: 'FAILED',
      finalScore: sessionScore,
      reason: 'Evaluation report could not be reconstructed. Session scored but response data is missing.',
    };
  }

  if (hasResults) {
    const history: any[] = resultsList.map((r: any, idx: number) => {
      const text = r.userAnswer || r.candidate_answer || r.transcript || r.answer || '';
      return {
        questionId: idx + 1,
        questionText: r.questionText || r.question_text || `Question ${idx + 1}`,
        transcript: text,
        isFollowUp: !!(r.isFollowUp ?? r.is_follow_up),
        evaluation: {
          contentScore: typeof (r.contentScore ?? r.content_score) === 'number' ? (r.contentScore ?? r.content_score) : 0,
          grammarScore: typeof (r.grammarScore ?? r.grammar_score) === 'number' ? (r.grammarScore ?? r.grammar_score) : 0,
          fluencyScore: typeof (r.fluencyScore ?? r.fluency_score) === 'number' ? (r.fluencyScore ?? r.fluency_score) : 0,
          verdict: r.verdict || 'Not Evaluated',
          feedback: r.feedback || { observation: 'Response recorded; no evaluation was stored for this answer.' }
        }
      };
    });

    const resolvedMode = resolveSessionEvaluationMode(session);
    const isApi = resolvedMode === EvaluationModeType.API;

    return ReportGenerator.computeFinalReport(
      history,
      {
        sessionId: session.id || session.session_id,
        overallRiskScore: session.proctoringReport?.violations?.length || session.all_proctoring_events?.length ? 15 : 0,
        violationScore: session.proctoringReport?.violations?.length || session.all_proctoring_events?.length ? 3 : 0,
        integrityScore: 100,
        violations: session.proctoringReport?.violations || session.all_proctoring_events || [],
        sessionDurationMs: ((session.duration_minutes ?? 0) * 60_000)
      } as any,
      {
        evaluationMode: resolvedMode,
        provider: isApi ? 'openrouter' : 'local-heuristic',
        model: isApi ? 'unknown-llm' : 'core-heuristics',
        targetSeniorityLevel: session.target_seniority_level || session.metadata?.target_seniority_level || session.target_profile || session.candidate_target_profile || 'FRESHER',
        reconstructedFromResponses: true
      } as any

    );
  }

  return null;
};
