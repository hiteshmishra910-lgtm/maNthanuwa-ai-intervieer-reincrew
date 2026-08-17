import React, { useState,useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SupabaseService } from '../../Core/database/supabaseService';
import { getDeviceFingerprint } from '../../Proctoring/services/deviceFingerprint';
import { CheckCircle, AlertCircle, Loader2, Camera, Mic, Monitor, Upload } from 'lucide-react';

type JoinFlowStep = 'ACCESS_KEY' | 'IDENTITY_VERIFICATION' | 'SYSTEM_CHECK' | 'WAITING_ROOM' | 'ERROR';

interface DriveInfo {
  id: string;
  title: string;
  description?: string;
  status?: string;
  evaluation_profile?: string;
  proctoring_settings?: any;
  access_key: string;
  access_key_id: string;
  job_post_id?: string;
  role?: string;
  evaluation_mode?: 'LOCAL' | 'AI'| 'HYBRID'; 
}

export const JoinDriveScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<JoinFlowStep>('ACCESS_KEY');

  // If the candidate arrived via a card click from their dashboard,
  // the access key is already known — skip Step 1 and verify it immediately.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const prefillKey = params.get('key') || (location.state as any)?.prefillAccessKey;
    if (!prefillKey) return;

    setLoading(true);
    setError(null);
    SupabaseService.verifyAccessKey(prefillKey)
      .then((drive) => {
        if (!drive) {
          setError('This interview link is no longer valid. Please contact HR.');
          setLoading(false);
          return;
        }
        setDriveInfo(drive);
        setStep('IDENTITY_VERIFICATION');
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to verify interview access.');
      })
      .finally(() => setLoading(false));
  }, [location.search]);


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [driveInfo, setDriveInfo] = useState<DriveInfo | null>(null);
  const [candidateEmail, setCandidateEmail] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [assignment, setAssignment] = useState<any>(null);

  // --- Step 1: Access Key ---
  const handleAccessKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.target as HTMLFormElement);
    const accessKey = formData.get('accessKey') as string;

    try {
      const drive = await SupabaseService.verifyAccessKey(accessKey);
      if (!drive) {
        throw new Error('Invalid or expired Access Key. Please check and try again.');
      }
      setDriveInfo(drive);
      setStep('IDENTITY_VERIFICATION');
    } catch (err: any) {
      setError(err.message || 'Failed to verify access key.');
    } finally {
      setLoading(false);
    }
  };

  // --- Step 2: Identity Verification (+ ID proof) ---
  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!idProofFile) {
        throw new Error('Please upload a valid ID proof to continue.');
      }

      // 1. Lookup or Upsert Candidate (no role source available from interview_drives —
      // role assignment needs to come from Aditya's template/question_bank join once defined)
      let candidate = await SupabaseService.getCandidateByEmail(candidateEmail);
      if (!candidate) {
        candidate = await SupabaseService.upsertCandidate({
          name: collegeId || candidateEmail.split('@')[0],
          email: candidateEmail,
        });
      }

      // 2. Validate Assignment (with auto-assign fallback if student joins via access key)
      const validation = await SupabaseService.validateAssignment(candidateEmail, driveInfo!.id, candidate.id, collegeId);

      if (!validation.valid) {
        throw new Error(validation.reason || 'You are not assigned to this interview drive.');
      }

      const finalAssignment = validation.assignment;

      // Session resume check
      if (finalAssignment.session_id && finalAssignment.status === 'IN_PROGRESS') {
        console.log('[JoinFlow] Session resume detected for assignment:', finalAssignment.id);
        // TODO: navigate directly to resume route once resume flow is built
      }

      // 3. Upload ID proof to Cloudinary (low-res)
      const idProofUrl = await SupabaseService.uploadIdProof(idProofFile, candidateEmail, driveInfo!.id);

      // 4. Mark assignment VERIFIED with proof attached
      await SupabaseService.markIdentityVerified(finalAssignment.id, idProofUrl, idProofFile.type);

      // 5. Count this access key use only on a successful verified join
      await SupabaseService.incrementAccessKeyUsage(driveInfo!.access_key_id);

      setAssignment({ ...finalAssignment, id_proof_url: idProofUrl, status: 'VERIFIED' });
      setStep('SYSTEM_CHECK');
    } catch (err: any) {
      setError(err.message || 'Identity verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // --- Step 3: System Check ---
  const handleSystemCheckComplete = () => {
    setStep('WAITING_ROOM');
  };

  // --- Step 4: Waiting Room -> Interview ---
  const handleStartInterview = async () => {
    setLoading(true);
    setError(null);
    try {
      let candidate = await SupabaseService.getCandidateByEmail(candidateEmail);
      if (!candidate) {
        candidate = await SupabaseService.upsertCandidate({
          name: collegeId || candidateEmail.split('@')[0],
          email: candidateEmail,
        });
      }

      const fp = await getDeviceFingerprint();

      const session = await SupabaseService.createSession(
        candidate.id,
        undefined,
        fp,
        {
          drive_id: driveInfo?.id,
          assignment_id: assignment?.id,
          evaluationMode: driveInfo?.evaluation_mode || 'LOCAL',
        },
        candidate.name,
        driveInfo?.id
      );

      sessionStorage.setItem("current_session_id", session.id);

      if (assignment) {
        await SupabaseService.incrementAttempt(assignment.id);
        await SupabaseService.updateAssignmentStatus(assignment.id, 'IN_PROGRESS');
        await SupabaseService.linkSessionToAssignment(assignment.id, session.id);
      }

      navigate('/interview-guest', {
        state: {
          candidateParams: {
            name: collegeId || candidateEmail.split('@')[0],
            email: candidateEmail,
            role: driveInfo?.role || 'CSE',
            evaluationMode: driveInfo?.evaluation_mode || 'LOCAL',
            jobPostId: driveInfo?.job_post_id,
            driveId: driveInfo?.id,
            assignmentId: assignment?.id,
            session,
          },
        },
      });
    } catch (err: any) {
      console.error('[JoinFlow] Failed to start interview session:', err);
      setError('Failed to initialize interview session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-slate-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Reincrew.AI Join Flow</h1>
          <p className="text-slate-500 mt-2">
            {step === 'ACCESS_KEY' && 'Enter your Drive Access Key to begin.'}
            {step === 'IDENTITY_VERIFICATION' && 'Verify your identity and upload ID proof.'}
            {step === 'SYSTEM_CHECK' && 'Please ensure your camera and microphone are working.'}
            {step === 'WAITING_ROOM' && 'You are in the waiting room. Ready to start?'}
          </p>
        </div>

        {error && (
          <div aria-live="polite" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {step === 'ACCESS_KEY' && (
          <form onSubmit={handleAccessKeySubmit} className="space-y-6">
            <div>
              <label htmlFor="driveAccessKeyInput" className="block text-sm font-medium text-slate-700 mb-2">
                Drive Access Key
              </label>
              <input
                id="driveAccessKeyInput"
                name="accessKey"
                type="text"
                data-tour="interview-access-key"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-center text-2xl tracking-widest font-mono uppercase"
                required
                maxLength={10}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              aria-label="Verify Access Key"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Access Key'}
            </button>
          </form>
        )}

        {step === 'IDENTITY_VERIFICATION' && driveInfo && (
          <form onSubmit={handleIdentitySubmit} className="space-y-6">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 mb-4">
              <p className="text-sm font-semibold text-indigo-900">{driveInfo.title}</p>
              {driveInfo.description && (
                <p className="text-xs text-indigo-700">{driveInfo.description}</p>
              )}
            </div>

            <div>
              <label htmlFor="candidateEmailInput" className="block text-sm font-medium text-slate-700 mb-2">
                College Email Address
              </label>
              <input
                id="candidateEmailInput"
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="student@college.edu"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="collegeIdInput" className="block text-sm font-medium text-slate-700 mb-2">
                College ID / Roll Number
              </label>
              <input
                id="collegeIdInput"
                type="text"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                placeholder="e.g., 21CS101"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            
            <div>
              <label htmlFor="idProofFileInput" className="block text-sm font-medium text-slate-700 mb-2">
                Upload ID Proof (College ID / Aadhaar / etc.)
              </label>
              <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-slate-300 cursor-pointer hover:border-indigo-400 transition-colors">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-600">
                  {idProofFile ? idProofFile.name : 'Choose an image file'}
                </span>
                <input
                  id="idProofFileInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setIdProofFile(e.target.files?.[0] || null)}
                  required
                />
              </label>
            </div>
            

            <div className="flex gap-3">
              <button
                type="button"
                aria-label="Back to access key"
                onClick={() => { setStep('ACCESS_KEY'); setError(null); }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                aria-label="Verify Identity"
                className="flex-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Identity'}
              </button>
            </div>
          </form>
        )}

        {step === 'SYSTEM_CHECK' && (() => {
          const isSttSupported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
          return (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Camera className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Camera Access</p>
                    <p className="text-sm text-slate-500">Required for proctoring</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" />
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Mic className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Microphone Access</p>
                    <p className="text-sm text-slate-500">Required for voice responses</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" />
                </div>

                <div className={`flex items-center gap-4 p-4 rounded-xl border ${isSttSupported ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSttSupported ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    <Monitor className={`w-5 h-5 ${isSttSupported ? 'text-emerald-600' : 'text-red-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Speech Recognition Capability</p>
                    <p className="text-sm text-slate-500">
                      {isSttSupported ? 'Speech API supported' : 'Unsupported Browser (Please switch to Google Chrome or Microsoft Edge)'}
                    </p>
                  </div>
                  {isSttSupported ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500 ml-auto" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 ml-auto" />
                  )}
                </div>

                {!isSttSupported && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                    <p className="font-bold text-amber-900">Speech-to-Text API Not Detected</p>
                    <p>Your current browser does not support full Speech Recognition. To complete the voice interview, please open this link using <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>.</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleSystemCheckComplete}
                disabled={!isSttSupported}
                aria-label="Continue after system check"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSttSupported ? 'System Check Passed, Continue' : 'Please Switch to Supported Browser (Chrome / Edge)'}
              </button>
            </div>
          );
        })()}

        {step === 'WAITING_ROOM' && (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">You're in the Waiting Room</h3>
              <p className="text-slate-500 mt-2">
                Your session is being prepared. Please ensure you are in a quiet environment.
              </p>
            </div>
            <button
              onClick={handleStartInterview}
              disabled={loading}
              data-tour="start-interview-btn"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Start Interview Now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};