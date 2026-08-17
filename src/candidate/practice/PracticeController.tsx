import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { setSupabaseAuthToken, setClerkToken } from '../../Core/database/supabaseClient';
import { PracticeSetupScreen } from '../../Practice/components/PracticeSetupScreen';
import { PracticeInterviewWrapper } from '../../Practice/components/PracticeInterviewWrapper';
import { PracticeEndScreen } from '../../Practice/components/PracticeEndScreen';
import { PracticeCandidate } from '../../Practice/hooks/usePracticeSession';

export const PracticeController: React.FC = () => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const navigate = useNavigate();
  
  const [practiceFlowState, setPracticeFlowState] = useState<'setup' | 'interview' | 'completed'>('setup');
  const [practiceCandidate, setPracticeCandidate] = useState<PracticeCandidate | null>(null);
  const [practiceHistory, setPracticeHistory] = useState<{ question: string; answer: string; ideal_answer: string; evaluation?: any }[]>([]);
  const [practiceCompletionViewModel, setPracticeCompletionViewModel] = useState<any>(null);

  // Restore completed practice session report from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('reicrew_practice_last_report');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.candidate && parsed.completionViewModel) {
          setPracticeCandidate(parsed.candidate);
          setPracticeHistory(parsed.history || []);
          setPracticeCompletionViewModel(parsed.completionViewModel);
          setPracticeFlowState('completed');
        }
      }
    } catch (e) {
      console.warn('[PracticeController] Failed to restore saved practice report', e);
    }
  }, []);

  // Keep Supabase token fresh for the duration of the practice session
  useEffect(() => {
    if (!isSignedIn) return;

    const refreshToken = async () => {
      try {
        let rawClerkToken = null;
        let token = null;
        try { 
          rawClerkToken = await getToken();   // raw Clerk JWT for edge functions
          token = await getToken({ template: 'supabase' }); 
        } catch { 
          token = rawClerkToken; 
        }
        setClerkToken(rawClerkToken);         // store for edge function auth
        if (token) setSupabaseAuthToken(token);
      } catch (err) {
        console.warn('[PracticeController] Token refresh failed', err);
      }
    };

    refreshToken();
    const interval = setInterval(refreshToken, 50000);
    return () => clearInterval(interval);
  }, [isSignedIn, getToken]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/" replace />;

  if (practiceFlowState === 'setup') {
    return (
      <PracticeSetupScreen
        onStart={(candidate) => {
          setPracticeCandidate(candidate);
          setPracticeFlowState('interview');
        }}
        onBack={() => {
          navigate('/candidate/dashboard');
        }}
      />
    );
  }

  if (practiceFlowState === 'interview' && practiceCandidate) {
    return (
      <PracticeInterviewWrapper
        candidate={practiceCandidate}
        onComplete={(history, _proctoringReport, completionResult) => {
          setPracticeHistory(history);
          let mode: 'report' | 'processing' | 'failed' = 'processing';
          if (completionResult?.completionState === 'FAILED') mode = 'failed';
          if (completionResult?.completionState === 'COMPLETED' || completionResult?.completionState === 'QUEUED' || completionResult?.report) mode = 'report';
          
          const vm = {
            mode: 'report',
            report: completionResult?.report,
            processingElapsedMs: 0,
          };
          setPracticeCompletionViewModel(vm);

          try {
            sessionStorage.setItem('reicrew_practice_last_report', JSON.stringify({
              candidate: practiceCandidate,
              history,
              completionViewModel: vm
            }));
          } catch (e) {
            console.warn('[PracticeController] Failed to persist practice report in sessionStorage', e);
          }

          setPracticeFlowState('completed');
        }}
      />
    );
  }

  if (practiceFlowState === 'completed' && practiceCandidate) {
    return (
      <PracticeEndScreen
        candidate={practiceCandidate}
        completionViewModel={practiceCompletionViewModel}
        history={practiceHistory}
        onPracticeAgain={() => {
          sessionStorage.removeItem('reicrew_practice_last_report');
          setPracticeCandidate(null);
          setPracticeHistory([]);
          setPracticeCompletionViewModel(null);
          setPracticeFlowState('setup');
        }}
        onHome={() => {
          sessionStorage.removeItem('reicrew_practice_last_report');
          navigate('/candidate/dashboard');
        }}
      />
    );
  }

  return null;
};