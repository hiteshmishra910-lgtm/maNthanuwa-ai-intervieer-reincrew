import { useState, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { SupabaseService } from '../../Core/database/supabaseService';
import { setSupabaseAuthToken, setClerkToken } from '../../Core/database/supabaseClient';
import { getDeviceFingerprint } from '../../Proctoring/services/deviceFingerprint';
import { ErrorLogService } from '../../Core/logging/errorLogService';
import { InterviewRole, InterviewRoles, CandidateTargetProfile } from '../../../types';

export type PracticeDifficulty = 'easy' | 'medium' | 'hard';
export type PracticeInterviewType = 'technical' | 'behavioral' | 'mixed';

export interface PracticeConfig {
  role: InterviewRole;
  difficulty: PracticeDifficulty;
  interviewType: PracticeInterviewType;
  targetProfile?: CandidateTargetProfile;
}


export interface PracticeCandidate {
  name: string;
  email: string;
  role: string;
  clerkUserId: string;
  jobPostId?: string;
  session?: any;
  isPractice: true;
  practiceConfig: PracticeConfig;
}

interface UsePracticeSessionReturn {
  isLoading: boolean;
  error: string | null;
  createPracticeSession: (config: PracticeConfig) => Promise<PracticeCandidate | null>;
}

export function usePracticeSession(): UsePracticeSessionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { user } = useUser();

  const createPracticeSession = useCallback(async (config: PracticeConfig): Promise<PracticeCandidate | null> => {
    if (!user) {
      setError('You must be signed in to start a practice session.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      let token: string | null = null;
      let rawClerkToken: string | null = null;
      try {
        rawClerkToken = await getToken();   // raw Clerk JWT for edge functions
        token = await getToken({ template: 'supabase' });
      } catch {
        token = rawClerkToken;
      }
      setClerkToken(rawClerkToken);         // store for edge function auth
      if (token) setSupabaseAuthToken(token);

      const name = user.fullName ||
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        user.username ||
        user.primaryEmailAddress?.emailAddress.split('@')[0] || 'Student';
      const email = user.primaryEmailAddress?.emailAddress || '';
      const clerkUserId = user.id;

      // Upsert candidate record
      const candidateRecord = await SupabaseService.upsertCandidate({
        name,
        email,
        role: config.role,
        clerk_user_id: clerkUserId,
      });

      const fp = await getDeviceFingerprint();

      // Find matching job post for the role (same logic as App.tsx handleStart)
      let jobPostId: string | undefined;
      try {
        const jobs = await SupabaseService.getAllJobs();
        const roleName = InterviewRoles[config.role] || config.role;
        const matchedJob = jobs.find(
          (j: any) =>
            j.settings?.role === config.role ||
            j.title.toLowerCase().includes(config.role.toLowerCase()) ||
            j.title.toLowerCase().includes(roleName.toLowerCase().split(' ')[0])
        );
        if (matchedJob) {
          jobPostId = String(matchedJob.id);
        }
      } catch (jobErr) {
        console.warn('[PracticeSession] Could not match job post:', jobErr);
      }

      // Build practice session metadata — marks session as practice AND disables proctoring
      const practiceMetadata = {
        job_settings_snapshot: {
          proctoring: {
            enabled: true,           
            aiProctoringEnabled: false,
            camera: { mode: 'auto' as const },
          },
          difficultyStrategy: config.difficulty,
          practiceInterviewType: config.interviewType,
          evaluationMode: 'LOCAL',
        },
        target_seniority_level: config.targetProfile || 'FRESHER',
        practice: {
          is_practice: true,
          config,
          startedAt: new Date().toISOString(),
        },
      };


      const session = await SupabaseService.createSession(
        candidateRecord.id,
        jobPostId as any,
        fp,
        practiceMetadata,
        candidateRecord.name,
      );

      sessionStorage.setItem('current_session_id', session.id);

      const practiceCandidate: PracticeCandidate = {
        name,
        email,
        role: config.role,
        clerkUserId,
        jobPostId,
        session,
        isPractice: true,
        practiceConfig: config,
      };

      return practiceCandidate;
    } catch (err: any) {
      const msg = err?.message || 'Failed to create practice session.';
      setError(msg);
      ErrorLogService.logError('database', `Practice session creation failed: ${msg}`, err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, getToken]);

  return { isLoading, error, createPracticeSession };
}