// ============================================================================
// REICREW AI — CAMPUS INTERVIEW DRIVE TYPINGS
// ============================================================================

export type DriveLifecycleStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export type EvaluationProfileTier = 'fast' | 'balanced' | 'advanced';

export type CandidateAssignmentStatus = 'INVITED' | 'VERIFIED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABSENT';

export interface ProctoringSettings {
  camera_required: boolean;
  tab_switch_limit: number;
  audio_monitoring: boolean;
  face_detection?: boolean;
}

export interface InterviewTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'Technical' | 'Behavioral' | 'Mixed';
  total_questions: number;
  steps: Array<{ category: string; difficulty: string }>;
  default_evaluation_profile: EvaluationProfileTier;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionBank {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  questions: any[];
  total_questions: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InterviewDrive {
  id: string;
  title: string;
  description?: string;
  status: DriveLifecycleStatus;
  template_id?: string;
  question_bank_id?: string;
  job_post_id?: string;        
  role: string;                
  evaluation_mode: 'LOCAL' | 'AI' | 'HYBRID';
  evaluation_profile: EvaluationProfileTier;
  proctoring_settings: ProctoringSettings;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_by?: string;
  total_candidates: number;
  completed_candidates: number;
  created_at: string;
  updated_at: string;
}

export interface CandidateAssignment {
  id: string;
  drive_id: string;
  candidate_id: string;
  status: CandidateAssignmentStatus;
  college_id?: string;
  college_email?: string;
  verified_at?: string;
  session_id?: string;
  assigned_at: string;
  completed_at?: string;
  deadline?: string;
  max_attempts?: number;
  attempts_used?: number;
  notes?: string;
  assigned_by?: string;
  id_proof_url?: string;
  id_proof_type?: string;
}

export interface DriveAccessKey {
  id: string;
  drive_id: string;
  access_key: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  created_at: string;
}

export interface DriveSummary extends InterviewDrive {
  template_name?: string;
  template_category?: string;
  question_bank_title?: string;
  access_keys?: string[];
  actual_candidates: number;
  invited_count: number;
  verified_count: number;
  in_progress_count: number;
  completed_count: number;
  absent_count: number;
  avg_score?: number;
  evaluation_profile_label: 'Local' | 'Hybrid' | 'API';
}
