import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../../Core/database/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgProfileForm {
  org_name: string;
  industry: string;
  company_size: string;
  website: string;
}

export interface FirstDriveForm {
  title: string;
  description: string;
  scheduled_at: string; // ISO date string
}

export type OnboardingStep = 'org' | 'done';

const INDUSTRY_OPTIONS = [
  'Technology',
  'Finance & Banking',
  'Healthcare',
  'Education',
  'E-Commerce',
  'Manufacturing',
  'Consulting',
  'Other',
];

const COMPANY_SIZE_OPTIONS = [
  '1–10',
  '11–50',
  '51–200',
  '201–500',
  '500+',
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRecruiterOnboarding() {
  const { user } = useUser();

  const [step, setStep] = useState<OnboardingStep>('org');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgForm, setOrgForm] = useState<OrgProfileForm>({
    org_name: '',
    industry: '',
    company_size: '',
    website: '',
  });

  const [driveForm, setDriveForm] = useState<FirstDriveForm>({
    title: '',
    description: '',
    scheduled_at: '',
  });

  // ── Step 1: Save org profile ───────────────────────────────────────────────
  async function submitOrgProfile() {
    if (!orgForm.org_name.trim()) {
      setError('Organisation name is required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: dbError } = await supabase
        .from('organizations')            // ← table created by the SQL below
        .insert({
          name: orgForm.org_name.trim(),
          industry: orgForm.industry,
          company_size: orgForm.company_size,
          website: orgForm.website.trim() || null,
          created_by: user?.primaryEmailAddress?.emailAddress ?? '',
        });

      if (dbError) throw dbError;
      setStep('done');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save organisation profile.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Create first interview drive ──────────────────────────────────
  async function submitFirstDrive() {
    if (!driveForm.title.trim()) {
      setError('Drive title is required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: dbError } = await supabase
        .from('interview_drives')
        .insert({
          title: driveForm.title.trim(),
          description: driveForm.description.trim() || null,
          status: 'DRAFT',
          created_by: user?.primaryEmailAddress?.emailAddress ?? '',
          scheduled_at: driveForm.scheduled_at
            ? new Date(driveForm.scheduled_at).toISOString()
            : null,
          total_candidates: 0,
          completed_candidates: 0,
        });

      if (dbError) throw dbError;
      setStep('done');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create interview drive.');
    } finally {
      setLoading(false);
    }
  }

  function updateOrgForm(field: keyof OrgProfileForm, value: string) {
    setOrgForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function updateDriveForm(field: keyof FirstDriveForm, value: string) {
    setDriveForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  return {
    step,
    loading,
    error,
    orgForm,
    driveForm,
    updateOrgForm,
    updateDriveForm,
    submitOrgProfile,
    submitFirstDrive,
    INDUSTRY_OPTIONS,
    COMPANY_SIZE_OPTIONS,
  };
}