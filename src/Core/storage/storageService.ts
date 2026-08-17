
import { InterviewSession, AdminConfig, EvaluationResult, Candidate, JobPost, Question, RoleSettings } from "../../../types";

const SESSIONS_KEY = 'reicrew_sessions_v3';
const CONFIG_KEY = 'reicrew_config_v3';
const JOBS_KEY = 'reicrew_jobs_v3';
const PROFILES_KEY = 'reicrew_profiles_v3';
import { DEFAULT_SETTINGS, JOB_TEMPLATES } from "../database/jobSeedRepository";

const DEFAULT_CONFIG: AdminConfig = {
  eyeTrackingSensitivity: 7,
  warningThreshold: 3,
  aiStrictness: 8,
  enableEyeTracking: true,
  enableFaceDetection: true,
  defaultDifficulty: 'Medium',
  eyeAwayThreshold: 15,
  faceMissingThreshold: 20,
  headMovementThreshold: 0.15
};

import { supabase ,setSupabaseAuthToken} from '../database/supabaseClient';



export const StorageService = {
  // --- Sessions ---
  // NOTE: Session CRUD is handled by SupabaseService.getAllSessions() / createSession() / completeSession()
  // which correctly reference the v6 schema table 'interview_sessions'.
  // Legacy getSessions() and saveSession() referencing a non-existent 'interviews' table were removed.

  // --- Config ---
  getConfig: async (): Promise<AdminConfig> => {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
    } catch (e) { return DEFAULT_CONFIG; }
  },

  saveConfig: async (config: AdminConfig) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  },

  // --- Jobs ---
  getJobs: async (): Promise<JobPost[]> => {
    try {
      // 1. Try Supabase first (Source of Truth)
      const { data, error } = await supabase.from('job_posts').select('*');
      
      if (!error && data && data.length > 0) {
        const remoteJobs = data.map(j => ({
          id: j.id,
          title: j.title,
          description: j.description || '',
          mode: j.mode || 'AI',
          status: j.status || 'ACTIVE',
          company: j.company || 'General',
          questions: j.questions ? (typeof j.questions === 'string' ? JSON.parse(j.questions) : j.questions) : [],
          settings: j.settings ? (typeof j.settings === 'string' ? JSON.parse(j.settings) : j.settings) : DEFAULT_SETTINGS
        })) as JobPost[];
        
        // Sync to local cache
        // OPTIMIZATION: Only sync to localStorage if data actually changed
        try {
          const existing = localStorage.getItem(JOBS_KEY);
          const newSerialized = JSON.stringify(remoteJobs);
          if (existing !== newSerialized) {
            localStorage.setItem(JOBS_KEY, newSerialized);
          }
        } catch (e) { /* quota or parse error — skip */ }
        return remoteJobs;
      }

      if (error) console.warn("Supabase jobs fetch error:", error);
    } catch (e) {
      console.warn("Error fetching jobs from Supabase:", e);
    }

    // 2. Fallback to Local Storage
    const stored = localStorage.getItem(JOBS_KEY);
    if (stored) {
      const localJobs = JSON.parse(stored);
      if (localJobs.length > 0) return localJobs;
    }

    console.log("Using seed data as final fallback");
    localStorage.setItem(JOBS_KEY, JSON.stringify(JOB_TEMPLATES));
    return [...JOB_TEMPLATES] as JobPost[];
  },

  getJobById: async (id: string): Promise<JobPost | undefined> => {
    try {
      const { data, error } = await supabase.from('job_posts').select('*').eq('id', id).single();
      if (!error && data) {
        return {
          id: data.id,
          title: data.title,
          description: data.description || '',
          mode: data.mode || 'AI',
          status: data.status || 'ACTIVE',
          company: data.company || 'General',
          questions: data.questions ? (typeof data.questions === 'string' ? JSON.parse(data.questions) : data.questions) : [],
          settings: data.settings ? (typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings) : DEFAULT_SETTINGS
        } as JobPost;
      }
    } catch {
      // Intentional: this is the remote lookup. Any failure (offline, RLS, malformed row) falls
      // through to the local search immediately below, which is the designed degraded path.
    }
    
    // Fallback to local search
    const jobs = await StorageService.getJobs();
    return jobs.find(j => j.id === id);
  },

  saveJobs: async (jobs: JobPost[]) => {
    // 1. Local sync (for UI responsiveness)
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));

    // 2. Sync to Supabase
    try {
      const { error } = await supabase.from('job_posts').upsert(
        jobs.map(j => ({
          id: j.id,
          title: j.title,
          description: j.description,
          status: j.status,
          questions: j.questions,
          settings: j.settings,
          company: j.company,
          mode: j.mode
        }))
      );
      if (error) throw error;
      console.log("Jobs synced to Supabase successfully");
    } catch (e) {
      console.warn("Supabase jobs sync failed (local updated):", e);
    }
  },

  deleteJob: async (jobId: string) => {
    // 1. Update Local
    try {
      const stored = localStorage.getItem(JOBS_KEY);
      if (stored) {
        const jobs: JobPost[] = JSON.parse(stored);
        const updatedJobs = jobs.filter(j => j.id !== jobId);
        localStorage.setItem(JOBS_KEY, JSON.stringify(updatedJobs));
      }
    } catch {
      // Intentional: pruning the local cache is best-effort. Supabase is the system of record and
      // the authoritative delete follows immediately below; a stale cache entry must not abort it.
    }

    // 2. Delete from Supabase
    try {
      const { error } = await supabase.from('job_posts').delete().eq('id', jobId);
      if (error) throw error;
    } catch (e) {
      console.error("Delete job from Supabase failed", e);
    }
  },

  // --- User Profiles ---
  getUserProfile: async (accessId: string): Promise<Candidate | null> => {
    try {
      const stored = localStorage.getItem(PROFILES_KEY);
      if (!stored) return null;
      const profiles = JSON.parse(stored);
      return profiles[accessId] || null;
    } catch (e) { return null; }
  },

  saveUserProfile: async (candidate: Candidate) => {
    try {
      const stored = localStorage.getItem(PROFILES_KEY);
      const profiles = stored ? JSON.parse(stored) : {};
      if (candidate.accessId) {
        profiles[candidate.accessId] = candidate;
        localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      }
    } catch (e) { console.error(e); }
  },

  clearUserProfile: (accessId: string) => {
    try {
      const stored = localStorage.getItem(PROFILES_KEY);
      if (stored) {
        const profiles = JSON.parse(stored);
        delete profiles[accessId];
        localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      }
    } catch {
      // Intentional: local profile caching is an optimisation. localStorage throws in private
      // browsing and on quota exhaustion, neither of which should surface to the caller.
    }
  }
};
