import React, { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  User,
  Mail,
  Calendar,
  Award,
  Briefcase,
  Shield,
  Loader2,
  LogOut,
  CheckCircle,
  Clock,
  Edit3,
  Save,
  X,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../Core/database/supabaseClient';
import { useAppLogout } from '../../hooks/useAppLogout';

interface StudentProfileProps {
  candidateData: {
    id: string;
    name: string;
    email: string;
    applied_role?: string;
    clerk_user_id?: string;
    created_at?: string;
  } | null;
  totalCompletedInterviews: number;
  onUpdate?: (updated: { name: string; applied_role: string | null }) => void;
}

export const CandidateProfile: React.FC<StudentProfileProps> = ({
  candidateData,
  totalCompletedInterviews,
  onUpdate,
}) => {
  const { user } = useUser();
  const handleLogout = useAppLogout();
  const [avatarError, setAvatarError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const profileImage = user?.imageUrl && !avatarError ? user.imageUrl : null;
  const initials = user?.firstName?.[0] && user?.lastName?.[0]
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.firstName?.[0]?.toUpperCase() || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || '?';

  // Use Clerk's createdAt as primary source of truth, fallback to candidate DB creation
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : candidateData?.created_at
    ? new Date(candidateData.created_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'N/A';

  const currentName = user?.fullName || candidateData?.name || 'Student';

  const handleStartEdit = () => {
    setEditName(currentName);
    setEditRole(candidateData?.applied_role || '');
    setIsEditing(true);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Try to update in candidates table
      if (candidateData?.id) {
        const { error } = await supabase
          .from('candidates')
           .update({ name: editName.trim(), applied_role: editRole || null })
          .eq('id', candidateData.id);

        if (error) throw error;
      }

      // Also try to update Clerk display name
      try {
        await user?.update({ firstName: editName.trim().split(' ')[0] || '', lastName: editName.trim().split(' ').slice(1).join(' ') || '' });
      } catch {
        // Clerk update is best-effort — may require re-authentication
      }

      setSaveSuccess(true);
      setIsEditing(false);
      // Brief flash then reset
      onUpdate?.({ name: editName.trim(), applied_role: editRole || null });
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      if (err?.code === '42501' || err?.message?.includes('permission denied')) {
        setSaveError('Database permission issue. Save the SQL fix first, then try again.');
      } else {
        setSaveError(err?.message || 'Failed to save. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center">
                <span className="text-2xl font-bold text-indigo-600">{initials}</span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
              <CheckCircle size={12} className="text-white" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-slate-900">{currentName}</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {candidateData?.email || user?.primaryEmailAddress?.emailAddress || ''}
            </p>
            {candidateData?.applied_role && (
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100">
                <Briefcase size={12} />
                {{
                  CSE: 'Computer Science & Engineering',
                  IT: 'Information Technology',
                  ECE: 'Electronics & Communication Engineering',
                  EE: 'Electrical Engineering',
                  ME: 'Mechanical Engineering',
                  CE: 'Civil Engineering',
                  CH: 'Chemical Engineering',
                  BT: 'Biotechnology',
                  OTHER: 'Other',
                }[candidateData.applied_role] ?? candidateData.applied_role}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 self-start shrink-0">
            {!isEditing && (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 transition-colors py-2 px-3.5 rounded-xl border border-indigo-200 hover:bg-indigo-50"
              >
                <Edit3 size={14} />
                Edit
              </button>
            )}
            <button
              onClick={() => { void handleLogout('/'); }}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-500 transition-colors py-2 px-3.5 rounded-xl border border-transparent hover:border-red-200 hover:bg-red-50"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Inline Editing */}
        {isEditing && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Edit Profile</h4>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    aria-label="Full Name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-11 pr-4 py-3 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-sm"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Branch</label>
                <div className="relative">
                  <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-11 pr-10 py-3 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all appearance-none cursor-pointer text-sm"
                  >
                    <option value="">Select your branch</option>
                    <option value="CSE">Computer Science & Engineering</option>
                    <option value="IT">Information Technology</option>
                    <option value="ECE">Electronics & Communication Engineering</option>
                    <option value="EE">Electrical Engineering</option>
                    <option value="ME">Mechanical Engineering</option>
                    <option value="CE">Civil Engineering</option>
                    <option value="CH">Chemical Engineering</option>
                    <option value="BT">Biotechnology</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <svg className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              </div>

              {saveError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-500 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={14} />
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <CheckCircle size={14} />
                  Profile updated successfully!
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <X size={14} />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editName.trim()}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-2 border border-indigo-100">
            <Award size={18} className="text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalCompletedInterviews}</p>
          <p className="text-xs text-slate-500 mt-0.5">Completed Interviews</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-2 border border-emerald-100">
            <Shield size={18} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">1</p>
          <p className="text-xs text-slate-500 mt-0.5">Active Sessions</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-2 border border-amber-100">
            <Calendar size={18} className="text-amber-600" />
          </div>
          <p className="text-sm font-semibold text-slate-900 mt-1">{joinedDate}</p>
          <p className="text-xs text-slate-500 mt-0.5">Joined</p>
        </div>
      </div>

      {/* Account Details */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Account Details</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <User size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">Full Name</span>
            </div>
            <span className="text-sm font-medium text-slate-900">{currentName}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">Email</span>
            </div>
            <span className="text-sm font-medium text-slate-900">{candidateData?.email || user?.primaryEmailAddress?.emailAddress || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <Briefcase size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">Branch</span>
            </div>
            <span className="text-sm font-medium text-slate-900">
              {candidateData?.applied_role
                ? {
                    CSE: 'Computer Science & Engineering',
                    IT: 'Information Technology',
                    ECE: 'Electronics & Communication Engineering',
                    EE: 'Electrical Engineering',
                    ME: 'Mechanical Engineering',
                    CE: 'Civil Engineering',
                    CH: 'Chemical Engineering',
                    BT: 'Biotechnology',
                    OTHER: 'Other',
                  }[candidateData.applied_role] ?? candidateData.applied_role
                : <span className="text-slate-400 italic">Not set — edit profile</span>}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">Account Created</span>
            </div>
            <span className="text-sm font-medium text-slate-900">{joinedDate}</span>
          </div>
        </div>
      </div>

      {/* Clerk Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <Shield size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Authentication</span>
        </div>
        <p className="text-xs text-slate-400">
          Signed in via Clerk • User ID: {user?.id?.substring(0, 12)}...
          {user?.primaryEmailAddress?.verification?.status === 'verified' && (
            <span className="text-emerald-500 ml-2">✓ Email verified</span>
          )}
        </p>
      </div>
    </div>
  );
};
