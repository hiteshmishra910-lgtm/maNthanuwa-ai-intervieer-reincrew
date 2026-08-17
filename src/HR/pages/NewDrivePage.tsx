import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Logo } from '../../Core/components/Logo';
import CreateDriveForm from '../components/CsvImport/CreateDriveForm';
import DriveLinkShare from '../components/DriveLinkShare';

export const NewDrivePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [created, setCreated] = useState<{ id: string; title: string; accessKey: string } | null>(null);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <Logo className="w-8 h-8" />
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                {created ? 'Drive Created' : 'Create Interview Drive'}
              </h1>
              <p className="text-[11px] text-slate-400 leading-tight">Reicrew AI</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {!created && (
          <button onClick={() => navigate('/hr/dashboard')}
            className="mb-6 text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Dashboard
          </button>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
          {!created ? (
            <CreateDriveForm
              onCreated={(drive) => setCreated(drive)}
              onCancel={() => navigate('/hr/dashboard')}
              createdBy={user?.primaryEmailAddress?.emailAddress ?? 'HR Admin'}
            />
          ) : (
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, color: '#15803d',
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                padding: '8px 12px', fontSize: 13, fontWeight: 500, marginBottom: 12,
              }}>
                "{created.title}" was created as a draft.
              </div>
              <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
                Share this link with candidates now, or come back to it later.
                Remember to activate the drive before candidates try to join.
              </p>

              <DriveLinkShare driveTitle={created.title} accessKey={created.accessKey} />
              <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                <button
                type="button"
                onClick={() => navigate(`/hr/import?driveId=${created.id}`)}
                style={{
                  padding: '10px 18px', borderRadius: 8, border: 'none', fontSize: 14,
                  fontWeight: 500, background: '#6366f1', color: '#fff', cursor: 'pointer',
                }}
                >
                  Import Candidates for this Drive
                </button>
                <button
                type="button"
                onClick={() => navigate('/hr/dashboard?tab=drives')}
                style={{
                  padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1',
                  background: '#fff', fontSize: 14, cursor: 'pointer',
                }}
                >
                  Go to My Drives
                </button>
                <button
                type="button"
                onClick={() => setCreated(null)}
                style={{
                  padding: '10px 18px', borderRadius: 8, border: '1px solid #cbd5e1',
                  background: '#fff', fontSize: 14, cursor: 'pointer',
                }}
                >
                  Create another drive
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};