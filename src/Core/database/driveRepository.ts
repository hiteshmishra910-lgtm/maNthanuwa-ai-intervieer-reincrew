import { supabase } from './supabaseClient';
import type {
  InterviewDrive,
  InterviewTemplate,
  QuestionBank,
  CandidateAssignment,
  DriveSummary,
  DriveLifecycleStatus,
  EvaluationProfileTier
} from '../../types/driveTypes';

/**
 * Repository service for Campus Interview Drives, Templates, and Question Banks.
 */
export class DriveRepository {
  /**
   * Fetch all interview drives (uses vw_drive_summary presentation view)
   */
  static async listDrives(): Promise<DriveSummary[]> {
    const { data, error } = await supabase
      .from('vw_drive_summary')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DriveRepository] Failed to list drives:', error);
      throw error;
    }
    return (data || []) as DriveSummary[];
  }

  /**
   * Get drive details by ID
   */
  static async getDriveById(driveId: string): Promise<DriveSummary | null> {
    const { data, error } = await supabase
      .from('vw_drive_summary')
      .select('*')
      .eq('drive_id', driveId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DriveRepository] Failed to get drive by ID:', error);
      throw error;
    }
    return data as DriveSummary;
  }

  /**
   * Get active drive by access key (for candidate join flow)
   * Queries drive_access_keys table, then fetches the linked drive.
   */
  static async getDriveByAccessKey(accessKey: string): Promise<InterviewDrive | null> {
    const key = accessKey.trim().toUpperCase();

    // First find the drive_id from the access key
    const { data: keyData, error: keyError } = await supabase
      .from('drive_access_keys')
      .select('drive_id')
      .eq('access_key', key)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      if (keyError?.code === 'PGRST116') return null;
      console.error('[DriveRepository] Failed to find access key:', keyError);
      return null;
    }

    // Then fetch the drive itself
    const { data, error } = await supabase
      .from('interview_drives')
      .select('*')
      .eq('id', keyData.drive_id)
      .in('status', ['SCHEDULED', 'ACTIVE'])
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[DriveRepository] Failed to get drive by access key:', error);
      throw error;
    }
    return data as InterviewDrive;
  }

  /**
   * Create a new campus interview drive with its access key
   */
  static async createDrive(driveData: {
    title: string;
    description?: string;
    template_id?: string;
    question_bank_id?: string;
    access_key: string;
    role?: string;                          // NEW
    evaluation_mode?: 'LOCAL' | 'AI' | 'HYBRID';      // NEW
    evaluation_profile?: EvaluationProfileTier;
    proctoring_settings?: Record<string, any>;
    scheduled_at?: string;
    created_by?: string;
  }): Promise<InterviewDrive & { access_key: string }>{
    // 1. Insert the drive (no access_key — that goes in drive_access_keys)
    const payload = {
      title: driveData.title,
      description: driveData.description || null,
      status: 'DRAFT' as DriveLifecycleStatus,
      template_id: driveData.template_id || null,
      question_bank_id: driveData.question_bank_id || null,
      role: driveData.role || 'CSE',                          // NEW
      evaluation_mode: driveData.evaluation_mode || 'LOCAL',  // NEW
      evaluation_profile: driveData.evaluation_profile || 'balanced',
      proctoring_settings: driveData.proctoring_settings || { camera_required: true, tab_switch_limit: 3, audio_monitoring: true },
      scheduled_at: driveData.scheduled_at || null,
      created_by: driveData.created_by || 'HR Admin'
    };

    const { data, error } = await supabase
      .from('interview_drives')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[DriveRepository] Failed to create drive:', error);
      throw error;
    }

    // 2. Insert the access key into drive_access_keys
    const drive = data as InterviewDrive;
    const { error: keyError } = await supabase
      .from('drive_access_keys')
      .insert({
        drive_id: drive.id,
        access_key: driveData.access_key.trim().toUpperCase(),
        max_uses: 0,
        current_uses: 0,
        is_active: true
      });

    if (keyError) {
      console.error('[DriveRepository] Failed to create access key:', keyError);
      // Don't throw — drive was created, key insertion is best-effort
      throw keyError;
    }

    return { ...drive, access_key: driveData.access_key.trim().toUpperCase() };
  }

  /**
   * Advance or update drive lifecycle status
   * Transitions: DRAFT -> SCHEDULED -> ACTIVE -> COMPLETED -> ARCHIVED
   */
  static async updateDriveStatus(driveId: string, status: DriveLifecycleStatus): Promise<InterviewDrive> {
    const updates: Record<string, any> = { status };
    const now = new Date().toISOString();

    if (status === 'ACTIVE') {
      updates.started_at = now;
    } else if (status === 'COMPLETED') {
      updates.completed_at = now;
    }

    const { data, error } = await supabase
      .from('interview_drives')
      .update(updates)
      .eq('id', driveId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[DriveRepository] Failed to update drive status:', error);
      throw error;
    }
    return data as InterviewDrive;
  }

  /**
   * Atomically validates prerequisites and publishes a drive (DRAFT -> ACTIVE)
   */
  static async publishDrive(driveId: string): Promise<InterviewDrive> {
    // 1. Fetch current drive state for validation
    const { data: drive, error: fetchErr } = await supabase
      .from('interview_drives')
      .select('*, job_posts(id, questions)')
      .eq('id', driveId)
      .maybeSingle();

    if (fetchErr || !drive) {
      throw new Error(`Drive not found or fetch error: ${fetchErr?.message || 'Unknown error'}`);
    }

    // If already ACTIVE, return early (idempotent)
    if (drive.status === 'ACTIVE') {
      return drive as InterviewDrive;
    }

    // 2. Validate prerequisites before publishing
    const jobPost = (drive as any).job_posts;
    const hasQuestions = (jobPost?.questions && Array.isArray(jobPost.questions) && jobPost.questions.length > 0) || drive.question_bank_id || drive.template_id;
    
    if (!drive.title || drive.title.trim().length === 0) {
      throw new Error('Drive publication failed: Drive title is required.');
    }

    // 3. Atomically transition status to ACTIVE
    return this.updateDriveStatus(driveId, 'ACTIVE');
  }

  /**
   * List active interview templates
   */
  static async listTemplates(): Promise<InterviewTemplate[]> {
    const { data, error } = await supabase
      .from('vw_drive_templates')
      .select('*');

    if (error) {
      console.error('[DriveRepository] Failed to list templates:', error);
      throw error;
    }
    return (data || []) as InterviewTemplate[];
  }

  /**
   * List active question banks
   */
  static async listQuestionBanks(): Promise<QuestionBank[]> {
    const { data, error } = await supabase
      .from('vw_question_banks')
      .select('*');

    if (error) {
      console.error('[DriveRepository] Failed to list question banks:', error);
      throw error;
    }
    return (data || []) as QuestionBank[];
  }

  /**
   * Assign candidates to a drive with full assignment metadata
   */
  static async assignCandidatesToDrive(
    driveId: string,
    candidates: Array<{
      candidate_id: string;
      college_id?: string;
      college_email?: string;
      deadline?: string;
      max_attempts?: number;
      notes?: string;
      assigned_by?: string;
    }>
  ): Promise<CandidateAssignment[]> {
    const records = candidates.map(c => ({
      drive_id: driveId,
      candidate_id: c.candidate_id,
      college_id: c.college_id || null,
      college_email: c.college_email || null,
      deadline: c.deadline || null,
      max_attempts: c.max_attempts ?? 1,
      notes: c.notes || null,
      assigned_by: c.assigned_by || 'CSV Import',
      status: 'INVITED'
    }));

    const { data, error } = await supabase
      .from('candidate_assignments')
      .upsert(records, { onConflict: 'drive_id,candidate_id' })
      .select();

    if (error) {
      console.error('[DriveRepository] Failed to assign candidates:', error);
      throw error;
    }

    // Update total candidates counter on drive
    const { count } = await supabase
    .from('candidate_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('drive_id', driveId);

  await supabase
    .from('interview_drives')
    .update({ total_candidates: count ?? 0 })
    .eq('id', driveId);

    return (data || []) as CandidateAssignment[];
  }
}
