import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate, useLocation } from 'react-router-dom';

import { DynamicInterviewScreen } from '../../Interview/components/DynamicInterviewScreen';
import { EndScreen } from '../../Interview/components/EndScreen';
import { SupabaseService } from '../../Core/database/supabaseService';
import { ErrorLogService } from '../../Core/logging/errorLogService';
import { supabase, setSupabaseAuthToken, getEdgeFunctionAuthHeaders, setClerkToken } from '../../Core/database/supabaseClient';
import { getDeviceFingerprint } from '../../Proctoring/services/deviceFingerprint';

import { TerminationReason, isFailureStatus } from '../../../types';

// This controller wraps the actual interview session and completion screens.
// Riddhi's Join flow will eventually navigate here with the candidate object in state.
// For now, it exposes a way to receive the candidate via props or route state.

export const MainInterviewController: React.FC<{ candidateParams?: any }> = ({ candidateParams }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();
  
  const [candidate, setCandidate] = useState<any>(candidateParams || location.state?.candidateParams);
  const [flowState, setFlowState] = useState<'interview' | 'completed'>('interview');
  const [interviewHistory, setInterviewHistory] = useState<any[]>([]);
  const [finalCompletionViewModel, setFinalCompletionViewModel] = useState<any>(null);
  const [finalProctoringReport, setFinalProctoringReport] = useState<any>(null);

  // Transition session status to IN_PROGRESS when candidate reaches active interview screen
  useEffect(() => {
    if (flowState === 'interview') {
      const sessionId = sessionStorage.getItem("current_session_id");
      if (sessionId) {
        SupabaseService.updateSessionStatus(sessionId, 'IN_PROGRESS').catch(err => {
          console.warn("[MainInterviewController] Failed to set IN_PROGRESS status:", err);
        });
      }
    }
  }, [flowState]);

  // Keep Supabase & Clerk tokens fresh for the duration of the interview session
  useEffect(() => {
    const refreshToken = async () => {
      try {
        let rawClerkToken = null;
        let token = null;
        try {
          rawClerkToken = await getToken();
          token = await getToken({ template: 'supabase' });
        } catch {
          token = rawClerkToken;
        }
        if (rawClerkToken) setClerkToken(rawClerkToken);
        if (token) setSupabaseAuthToken(token);
      } catch (err) {
        console.warn('[MainInterviewController] Token refresh failed', err);
      }
    };

    refreshToken();
    const interval = setInterval(refreshToken, 50000);
    return () => clearInterval(interval);
  }, [getToken]);

  // If no candidate is provided, we can't start an interview.
  useEffect(() => {
    if (!candidate) {
      navigate('/join');
    }
  }, [candidate, navigate]);

  // Polling for hybrid/background processing (moved from App.tsx)
  useEffect(() => {
    let timer: any;
    if (flowState === 'completed' && (finalCompletionViewModel?.mode === 'processing' || finalCompletionViewModel?.mode === 'queued')) {
      const sessionId = sessionStorage.getItem("current_session_id");
      if (!sessionId) return;
      
      let attempts = 0;
      const MAX_ATTEMPTS = 24; // 2 mins at 5s

      timer = setInterval(async () => {
        attempts++;
        if (attempts > MAX_ATTEMPTS) {
          clearInterval(timer);
          if (finalCompletionViewModel?.mode === 'processing' || finalCompletionViewModel?.mode === 'queued') {
            setFinalCompletionViewModel((prev: any) => prev ? { ...prev, mode: 'failed' } : null);
          }
          return;
        }

        try {
          const { data: job } = await supabase
            .from('evaluation_jobs')
            .select('status')
            .eq('session_id', sessionId)
            .maybeSingle();

          if (job && isFailureStatus(job.status)) {
            clearInterval(timer);
            setFinalCompletionViewModel((prev: any) => prev ? { ...prev, mode: 'failed' } : null);
            return;
          }

          const session = await SupabaseService.getSession(sessionId);
          const report = session?.evaluation_report;
          
          const isBackendCompleted = job?.status === 'COMPLETED' || session?.status === 'COMPLETED' || report?.evaluationStatus === 'COMPLETED' || report?.reportType === 'final_ai';

          if (isBackendCompleted && report && report.reportType !== 'heuristic') {
             clearInterval(timer);
             setFinalCompletionViewModel((prev: any) => prev ? { mode: 'report', report, processingElapsedMs: prev.processingElapsedMs } : null);
          } else {
             setFinalCompletionViewModel((prev: any) => prev ? { ...prev, processingElapsedMs: attempts * 5000 } : null);
          }
        } catch(e) {
          console.warn("Polling error:", e);
        }
      }, 5000);
    }
    return () => clearInterval(timer);
  }, [flowState, finalCompletionViewModel?.mode]);

  const handleInterviewComplete = async (
    history: any[],
    proctoringReport: any,
    completionResult: any,
  ) => {
    setInterviewHistory(history);
    setFinalProctoringReport(proctoringReport);

    let mode: "report" | "processing" | "failed" | "queued" = "processing";
    let reportData = completionResult?.report;

    if (completionResult?.completionState === 'FAILED') mode = "failed";
    else if (completionResult?.completionState === 'COMPLETED' || completionResult?.report) mode = "report";
    else if (completionResult?.completionState === 'QUEUED') mode = "queued";
    else if (completionResult && (completionResult.totalScore !== undefined || completionResult.overallScores || completionResult.executiveSummary || completionResult.strengths)) {
      mode = "report";
      reportData = completionResult;
    }

    setFinalCompletionViewModel({
      mode,
      report: reportData || completionResult?.report,
      errorReason: completionResult?.errorReason,
      processingElapsedMs: 0
    });

    setFlowState("completed");

    try {
      const sessionId = sessionStorage.getItem("current_session_id");
      if (sessionId) {
        const savePromises: Promise<any>[] = [];

        if (reportData) {
          savePromises.push(
            SupabaseService.saveEvaluationReport(sessionId, reportData, candidate?.name)
              .catch((e) => console.error("Eval save failed", e))
          );
          if (Array.isArray(reportData?.questionBreakdown)) {
            savePromises.push(
              SupabaseService.saveAptitudeResponses(sessionId, reportData.questionBreakdown)
                .catch((e) => console.error("Aptitude responses save failed", e))
            );
          }
          // Backup report logic to session metadata so reportReconstructor & admin views always find it
          savePromises.push(
            SupabaseService.updateSessionMetadata(sessionId, {
              evaluation_logic: reportData
            }).catch((e) => console.warn("Session metadata evaluation backup failed", e))
          );
        }
        if (proctoringReport) {
          savePromises.push(
            SupabaseService.saveProctoringReport(sessionId, proctoringReport, {} as any, candidate?.name, proctoringReport.flushedEventIds || [])
              .catch((e) => console.error("Proctoring save failed", e))
          );
        }

        const primaryQuestionsCount = history.filter((h: any) => !h.questionData?.isFollowUp).length;
        const isTerminated = proctoringReport?.isTerminated || (proctoringReport?.violationScore && proctoringReport.violationScore >= 15);
        const terminationReason = isTerminated ? TerminationReason.EXCESSIVE_PROCTORING_VIOLATIONS : undefined;

        savePromises.push(
          SupabaseService.completeSession(
            sessionId,
            proctoringReport?.sessionDurationMs ? Math.round(proctoringReport.sessionDurationMs / 1000) : 0,
            isTerminated ? "TERMINATED" : "COMPLETED",
            primaryQuestionsCount,
            terminationReason
          ).catch((e) => console.error("Session complete save failed", e))
        );

        await Promise.allSettled(savePromises);
        if (completionResult?.completionState === 'QUEUED') {
          // Asynchronously trigger background queue worker without blocking candidate navigation
          (async () => {
            try {
              let freshToken: string | null = null;
              try {
                freshToken = await getToken({ template: 'supabase' });
              } catch {
                freshToken = await getToken();
              }
              if (freshToken) setSupabaseAuthToken(freshToken);

              // Trigger worker asynchronously to claim and process the job
              supabase.functions.invoke('process-evaluation-queue', {
                body: { sessionId },
                headers: getEdgeFunctionAuthHeaders(freshToken ?? undefined),
              }).catch((err) => console.warn("[MainInterviewController] Async queue worker trigger failed:", err));
            } catch (invokeErr) {
              console.warn("[MainInterviewController] Queue worker trigger exception:", invokeErr);
            }
          })();
        } 

        if (candidate?.assignmentId) {
          try {
            await SupabaseService.completeAssignment(candidate.assignmentId);
          } catch (assignErr) {
            console.warn("Failed to complete assignment status update:", assignErr);
          }
        }
      }
    } catch (e) {
      ErrorLogService.logError("system", "Failed to complete session gracefully", e, sessionStorage.getItem("current_session_id") || undefined, candidate?.name);
    }
  };

  const handleReset = () => {
    navigate('/');
  };

  if (!candidate) return null;

  return (
    <>
      {flowState === "interview" && (
        <DynamicInterviewScreen
          candidate={candidate}
          onComplete={handleInterviewComplete}
        />
      )}

      {flowState === "completed" && (
        <EndScreen
          history={interviewHistory}
          candidate={candidate}
          completionViewModel={finalCompletionViewModel}
          proctoringReport={finalProctoringReport}
          onHome={handleReset}
        />
      )}
    </>
  );
};
