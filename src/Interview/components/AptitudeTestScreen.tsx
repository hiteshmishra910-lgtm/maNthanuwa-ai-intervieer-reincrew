import React, { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import { Camera, AlertTriangle, CheckCircle, ArrowRight, Clock, ShieldAlert, Check, Mic, Volume2 } from 'lucide-react';
import { AIService } from '../../Core/ai/aiService';
import { APTITUDE_QUESTION_BANK } from '../services/questionBank';
import { CameraPreview } from '../../Proctoring/components/CameraPreview';
import { CameraAnalysis } from '../../Proctoring/components/CameraAnalysis';
import { PreFlightCheck } from './PreFlightCheck';
import { LocalCameraProvider } from '../../Proctoring/services/cameraProviders/LocalCameraProvider';
import { PhoneCameraProvider } from '../../Proctoring/services/cameraProviders/PhoneCameraProvider';
import { SupabaseService } from '../../Core/database/supabaseService';
import { 
  ProctoringReport, ProctoringState, ProctoringAction, 
  Question, TimelineEvent, ProctorViolation, RawDetectionFrame, HeartbeatMetrics,
  DEFAULT_PROCTORING_SETTINGS, PhoneConnectionState, CameraProvider,
  ProctoringConfiguration, InterviewCompletionState
} from '../../../types';
import { ErrorLogService } from '../../Core/logging/errorLogService';
import { CameraProviderFactory } from '../../Proctoring/services/cameraProviders/CameraProviderFactory';
import { requestFullscreenIfSupported } from '../../Core/utils/fullscreen';

const generateViolationId = () => Math.random().toString(36).substring(2, 9);
const VIOLATION_COOLDOWN = 5000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const createInitialState = (): ProctoringState => ({
  engineState: 'INITIALIZING',
  currentRiskScore: 0,
  overallRiskScore: 0,
  heartbeat: {
    fps: 0, lastDetectionAgoMs: 0, trackingConfidence: 0, engineState: 'INITIALIZING',
    gazeDirection: '',
    detectionHealth: 'GOOD'
  },
  violations: [],
  timeline: [],
  gazeState: 'LOOKING', gazeAwayStartTime: null,
  multiFaceState: 'SINGLE_FACE', multiFaceStartTime: null,
  noFaceState: 'FACE_PRESENT', noFaceStartTime: null,
  sessionStartTime: Date.now(),
  monitoringStartTime: null,
  cameraReconnectCount: 0,
  maxConcurrentFaces: 1,
  microphoneHealthy: true,
  networkHealthy: true,
  heartbeatCount: 0,
  fullscreenExitEvents: 0,
  copyPasteEvents: 0,
  violationScore: 0,
  integrityScore: 100,
  totalGazeAwayDurationMs: 0,
  lastViolationTime: 0,
  settings: DEFAULT_PROCTORING_SETTINGS,
  cameraOffStartTime: null,
  micOffStartTime: null,

  // ─── Phone Camera Proctoring Defaults ──────────────────────────────
  cameraProvider: 'none',
  phoneConnectionState: 'WAITING',
  phoneConnectionId: null,
  phoneReconnectCount: 0,
  lastReceivedSequence: 0,
  phoneTimeOffsetMs: 0,
  networkQuality: {
    avgLatencyMs: 0,
    packetLossRate: 0,
    heartbeatAgeMs: 0,
    reconnectCount: 0,
  },
  setupCheck: {
    microphone: false,
    cameraPermission: false,
    faceDetected: false,
    lightingGood: false,
    cameraStable: false,
    distanceAppropriate: false,
    networkStable: false,
    batteryOk: false,
  },
  setupProgressMs: 0,
});

const proctoringReducer = (state: ProctoringState, action: ProctoringAction): ProctoringState => {
  const now = Date.now();
  switch (action.type) {
    case 'SET_SETTINGS': return { ...state, settings: action.settings };
    case 'SET_UNSUPPORTED_BROWSER': return { ...state, engineState: 'UNSUPPORTED_BROWSER' };
    case 'SET_PERMISSION_DENIED': return { ...state, engineState: 'PERMISSION_DENIED' };
    case 'ENGINE_READY': return { ...state, engineState: 'READY', monitoringStartTime: state.monitoringStartTime || now };
    
    case 'HEARTBEAT':
    case 'REMOTE_HEARTBEAT': {
      if (action.type === 'REMOTE_HEARTBEAT') {
        if (action.sequence <= state.lastReceivedSequence) return state;
        return { 
          ...state, 
          heartbeat: action.metrics, 
          heartbeatCount: state.heartbeatCount + 1,
          lastReceivedSequence: action.sequence
        };
      }
      return { ...state, heartbeat: action.metrics, heartbeatCount: state.heartbeatCount + 1 };
    }
    
    case 'DECAY_RISK': {
      if (state.currentRiskScore === 0) return state;
      const floor = Math.floor(state.overallRiskScore * 0.25);
      const newScore = Math.max(floor, state.currentRiskScore - 1);
      return { ...state, currentRiskScore: newScore };
    }

    case 'TAB_HIDDEN': {
      if (now - state.lastViolationTime < VIOLATION_COOLDOWN) return state;
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'TAB_HIDDEN', severity: 2, timestamp: now, message: 'Browser tab hidden' };
      const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'TAB_HIDDEN', severity: 2 };
      const newViolationScore = state.violationScore + 2;
      return { 
        ...state, 
        violations: [...state.violations, v], 
        timeline: [...state.timeline, t], 
        violationScore: newViolationScore, 
        integrityScore: Math.max(0, 100 - newViolationScore * 5),
        lastViolationTime: now 
      };
    }

    case 'FULLSCREEN_EXIT': {
      if (now - state.lastViolationTime < VIOLATION_COOLDOWN) return state;
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'FULLSCREEN_EXIT', severity: 3, timestamp: now, message: 'Exited fullscreen mode' };
      const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'FULLSCREEN_EXIT', severity: 3 };
      const newViolationScore = state.violationScore + 3;
      return { 
        ...state, 
        fullscreenExitEvents: state.fullscreenExitEvents + 1, 
        violations: [...state.violations, v], 
        timeline: [...state.timeline, t], 
        violationScore: newViolationScore, 
        integrityScore: Math.max(0, 100 - newViolationScore * 5),
        lastViolationTime: now 
      };
    }

    case 'COPY_PASTE': {
      if (now - state.lastViolationTime < VIOLATION_COOLDOWN) return state;
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'COPY_PASTE', severity: 2, timestamp: now, message: 'Clipboard action detected' };
      const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'COPY_PASTE', severity: 2 };
      const newViolationScore = state.violationScore + 2;
      return { 
        ...state, 
        copyPasteEvents: state.copyPasteEvents + 1, 
        violations: [...state.violations, v], 
        timeline: [...state.timeline, t], 
        violationScore: newViolationScore, 
        integrityScore: Math.max(0, 100 - newViolationScore * 5),
        lastViolationTime: now 
      };
    }

    case 'CAMERA_LOST': {
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'CAMERA_LOST', severity: 4, timestamp: now, message: 'Camera disconnected' };
      const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'CAMERA_LOST', severity: 4 };
      const newViolationScore = state.violationScore + 4;
      return { 
        ...state, 
        cameraReconnectCount: state.cameraReconnectCount + 1, 
        violations: [...state.violations, v], 
        timeline: [...state.timeline, t], 
        violationScore: newViolationScore,
        integrityScore: Math.max(0, 100 - newViolationScore * 5),
        lastViolationTime: now
      };
    }

    case 'MICROPHONE_LOST': {
      if (!state.microphoneHealthy) return state;
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'MICROPHONE_LOST', severity: 2, timestamp: now, message: 'Microphone disconnected or muted' };
      const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'MICROPHONE_LOST', severity: 2 };
      const newViolationScore = state.violationScore + 2;
      return { 
        ...state, 
        microphoneHealthy: false, 
        violations: [...state.violations, v], 
        timeline: [...state.timeline, t], 
        violationScore: newViolationScore,
        integrityScore: Math.max(0, 100 - newViolationScore * 5),
        lastViolationTime: now
      };
    }

    case 'MICROPHONE_RECOVERED': return { ...state, microphoneHealthy: true };
    case 'NETWORK_LOST': return { ...state, networkHealthy: false };
    case 'NETWORK_RECOVERED': return { ...state, networkHealthy: true };

    // ─── Phone Camera Proctoring Actions ────────────────────────────────
    case 'SET_CAMERA_PROVIDER': return { ...state, cameraProvider: action.provider };
    case 'SET_PHONE_CONNECTION_STATE': return { ...state, phoneConnectionState: action.state };
    case 'PHONE_CONNECTED': {
      const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'PHONE_CONNECTED', severity: 0, detail: `Connection ID bound: ${action.connectionId}` };
      return { 
        ...state, 
        phoneConnectionState: 'CONNECTED', 
        phoneConnectionId: action.connectionId,
        timeline: [...state.timeline, t] 
      };
    }
    case 'PHONE_DISCONNECTED': {
      const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'PHONE_DISCONNECTED', severity: 2, detail: 'Phone connection lost' };
      return { 
        ...state, 
        phoneConnectionState: 'RECONNECTING',
        timeline: [...state.timeline, t] 
      };
    }
    case 'PHONE_RECONNECTED': {
      const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'PHONE_RECONNECTED', severity: 0, detail: `Reconnected device: ${action.connectionId}` };
      return { 
        ...state, 
        phoneConnectionState: 'CONNECTED',
        phoneReconnectCount: state.phoneReconnectCount + 1,
        timeline: [...state.timeline, t] 
      };
    }
    case 'UPDATE_NETWORK_QUALITY': return { ...state, networkQuality: action.quality };
    case 'UPDATE_SETUP_CHECK': return { ...state, setupCheck: { ...state.setupCheck, ...action.check } };
    case 'UPDATE_SETUP_PROGRESS': return { ...state, setupProgressMs: action.progressMs };
    case 'SET_PHONE_TIME_OFFSET': return { ...state, phoneTimeOffsetMs: action.offsetMs };

    case 'DETECTION_FRAME':
    case 'REMOTE_DETECTION_FRAME': {
      const newState = { ...state };
      if (action.type === 'REMOTE_DETECTION_FRAME') {
        if (action.sequence <= state.lastReceivedSequence) return state;
        newState.lastReceivedSequence = action.sequence;
      }
      if (action.frame.faceCount > state.maxConcurrentFaces) newState.maxConcurrentFaces = action.frame.faceCount;

      // No Face State Machine
      if (action.frame.faceCount === 0) {
        if (newState.noFaceState === 'FACE_PRESENT') {
          newState.noFaceState = 'NO_FACE_START';
          newState.noFaceStartTime = now;
        } else if (newState.noFaceState === 'NO_FACE_START' && newState.noFaceStartTime && now - newState.noFaceStartTime > 15000) {
          newState.noFaceState = 'VIOLATION_CREATED';
          if (now - state.lastViolationTime >= VIOLATION_COOLDOWN) {
            const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'NO_FACE', severity: 3, timestamp: now, message: 'No face detected for 15s' };
            const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'NO_FACE', severity: 3 };
            newState.violations = [...newState.violations, v];
            newState.timeline = [...newState.timeline, t];
            newState.violationScore += 3;
            newState.integrityScore = Math.max(0, 100 - newState.violationScore * 5);
            newState.lastViolationTime = now;
          }
        }
      } else {
        newState.noFaceState = 'FACE_PRESENT';
        newState.noFaceStartTime = null;
      }

      // Multiple Faces State Machine
      if (action.frame.faceCount > 1) {
        if (newState.multiFaceState === 'SINGLE_FACE') {
          newState.multiFaceState = 'MULTI_FACE_START';
          newState.multiFaceStartTime = now;
        } else if (newState.multiFaceState === 'MULTI_FACE_START' && newState.multiFaceStartTime && now - newState.multiFaceStartTime > 3000) {
          newState.multiFaceState = 'MULTI_FACE_CONFIRMED';
          if (now - state.lastViolationTime >= VIOLATION_COOLDOWN) {
            const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'MULTIPLE_FACES', severity: 5, timestamp: now, message: 'Multiple faces detected for 3s' };
            const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'MULTIPLE_FACES', severity: 5 };
            newState.violations = [...newState.violations, v];
            newState.timeline = [...newState.timeline, t];
            newState.violationScore += 5;
            newState.integrityScore = Math.max(0, 100 - newState.violationScore * 5);
            newState.lastViolationTime = now;
          }
        }
      } else {
        newState.multiFaceState = 'SINGLE_FACE';
        newState.multiFaceStartTime = null;
      }

      // Gaze State Machine (Holistic Away Detection)
      // Reduced sensitivity: Away > 5-6 sec -> violation (we check 5500 ms)
      const isAway = action.frame.gazeDirection !== 'center' || Math.abs(action.frame.headYaw) > 30 || action.frame.facePosition === 'PARTIAL_OUT';
      if (isAway && action.frame.faceCount > 0) {
        if (newState.gazeState === 'LOOKING') {
          newState.gazeState = 'AWAY_START';
          newState.gazeAwayStartTime = now;
        } else if (newState.gazeState === 'AWAY_START' && newState.gazeAwayStartTime && now - newState.gazeAwayStartTime > 5500) {
          newState.gazeState = 'VIOLATION_CREATED';
          if (now - state.lastViolationTime >= VIOLATION_COOLDOWN) {
            const reason = action.frame.facePosition === 'PARTIAL_OUT' ? 'Face partially out of camera view' : 
                           Math.abs(action.frame.headYaw) > 30 ? 'Head turned away from screen' : 
                           `Looking ${action.frame.gazeDirection}`;
            const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'GAZE_AWAY', severity: 2, timestamp: now, message: reason };
            const t: TimelineEvent = { sessionId: '', timestamp: now, event: 'GAZE_AWAY', severity: 2, detail: reason };
            newState.violations = [...newState.violations, v];
            newState.timeline = [...newState.timeline, t];
            newState.violationScore += 2;
            newState.integrityScore = Math.max(0, 100 - newState.violationScore * 5);
            newState.lastViolationTime = now;
          }
          newState.totalGazeAwayDurationMs += (now - newState.gazeAwayStartTime);
        }
      } else {
        newState.gazeState = 'LOOKING';
        if (action.frame.faceCount > 0) {
          newState.gazeAwayStartTime = null;
        }
      }

      const isChanged = 
        newState.maxConcurrentFaces !== state.maxConcurrentFaces ||
        newState.noFaceState !== state.noFaceState ||
        newState.multiFaceState !== state.multiFaceState ||
        newState.gazeState !== state.gazeState ||
        newState.violations.length !== state.violations.length ||
        newState.timeline.length !== state.timeline.length ||
        newState.violationScore !== state.violationScore;

      return isChanged ? newState : state;
    }
    default: return state;
  }
};

const selectBalancedQuestions = (): Question[] => {
  const quant = APTITUDE_QUESTION_BANK.filter(q => q.category === 'Quantitative');
  const logical = APTITUDE_QUESTION_BANK.filter(q => q.category === 'Logical');
  const analytical = APTITUDE_QUESTION_BANK.filter(q => q.category === 'Analytical');
  const verbal = APTITUDE_QUESTION_BANK.filter(q => q.category === 'Verbal');

  const pick = (arr: any[], count: number) => {
    return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
  };

  const chosen = [
    ...pick(quant, 3),
    ...pick(logical, 3),
    ...pick(analytical, 2),
    ...pick(verbal, 2)
  ];
  
  return chosen.sort(() => 0.5 - Math.random());
};

interface AptitudeTestScreenProps {
  candidate: { name: string; email: string; role: string; customTopic?: string; isDemo?: boolean; jobPostId?: string; session?: any };
  onComplete: (history: { question: string; answer: string; ideal_answer: string; questionData?: any; timeSpentSeconds?: number }[], proctoringReport: ProctoringReport, evalReport: any) => void;
}

export const AptitudeTestScreen: React.FC<AptitudeTestScreenProps> = ({ candidate, onComplete }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [index: number]: string }>({});
  const [remainingTimeSeconds, setRemainingTimeSeconds] = useState(60);
  const [timeSpentArray, setTimeSpentArray] = useState<number[]>(new Array(10).fill(0));
  const [hasStarted, setHasStarted] = useState(false);
  const hasStartedRef = useRef(false);
  useEffect(() => { hasStartedRef.current = hasStarted; }, [hasStarted]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Submitting answers and compiling results...');
  const [cameraReady, setCameraReady] = useState(false);
  const [isCalibrationComplete, setIsCalibrationComplete] = useState(false);
  // Stable identity so PreFlightCheck's effects (which depend on this
  // callback) aren't torn down/recreated on every re-render of this screen.
  const handleCalibrationReady = useCallback(() => {
    setIsCalibrationComplete(true);
  }, []);
  const [toastWarning, setToastWarning] = useState<{ message: string; type: 'warning' | 'danger' } | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(
    candidate.session?.id || 
    sessionStorage.getItem('current_session_id') || 
    localStorage.getItem('current_session_id') || 
    ""
  );

  useEffect(() => {
    if (!sessionIdRef.current) {
      setSessionError("No active interview session ID found. The interview cannot proceed safely. Please register again.");
    }
  }, []);
  const [proctoring, dispatch] = useReducer(proctoringReducer, createInitialState());
  
  const providerRef = useRef<CameraProvider | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const [pairingQrUrl, setPairingQrUrl] = useState<string>('');
  const [pairingTokenExpiry, setPairingTokenExpiry] = useState<Date | null>(null);
  const [phonePreviewStream, setPhonePreviewStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const totalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTerminatedRef = useRef<boolean>(false);

  // Initialize CameraProvider
  useEffect(() => {
    let mounted = true;

    const wireAudioTrack = (audioTrack: MediaStreamTrack) => {
      audioTrack.addEventListener('ended', () => {
        ErrorLogService.logError('proctoring', "Microphone track ended unexpectedly", undefined, sessionIdRef.current, candidate.name);
        dispatch({ type: 'MICROPHONE_LOST' });
      });
      audioTrack.addEventListener('mute', () => {
        setTimeout(() => {
          if (audioTrack.muted) {
            ErrorLogService.logError('proctoring', "Microphone muted by user/system", undefined, sessionIdRef.current, candidate.name);
            dispatch({ type: 'MICROPHONE_LOST' });
          }
        }, 3000);
      });
      audioTrack.addEventListener('unmute', () => dispatch({ type: 'MICROPHONE_RECOVERED' }));
    };

    const initMediaAndDevice = async () => {
      // 1. Read configuration from the snapshot in the session prop
      const proctorSnapshot = candidate.session?.interview_metadata?.job_settings_snapshot?.proctoring;

      let enabled = proctorSnapshot?.enabled !== false;
      //let cameraMode: 'auto' | 'webcam' | 'phone' = proctorSnapshot?.camera?.mode || proctorSnapshot?.cameraMode || 'auto';
      let cameraMode: 'auto' | 'webcam' | 'phone' = proctorSnapshot?.camera?.mode || proctorSnapshot?.cameraMode || 'auto';

      // 2. Development overrides
      if (import.meta.env.DEV) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCamera = urlParams.get('camera') || urlParams.get('forcePhone') || urlParams.get('forcePhoneProctor');
        if (urlCamera === 'phone' || urlCamera === 'true') {
          cameraMode = 'phone';
        } else if (urlCamera === 'webcam') {
          cameraMode = 'webcam';
        } else if (urlCamera === 'none') {
          enabled = false;
        }
      }

      const config: ProctoringConfiguration = {
        enabled,
        camera: { mode: cameraMode }
      };

      if (!config.enabled) {
        console.log("[CameraProvider] AI Proctoring is disabled for this session.");
        dispatch({ type: 'SET_CAMERA_PROVIDER', provider: 'none' });
        if (sessionIdRef.current) {
          SupabaseService.updateSessionMetadata(sessionIdRef.current, {
            runtime: { cameraProvider: 'none' }
          }).catch(err => console.warn("Failed to update runtime proctoring metadata", err));
        }
        setCameraReady(true);
        setIsCalibrationComplete(true);
        return;
      }

      // 3. Create and initialize primary provider
      let provider = CameraProviderFactory.createPrimary(sessionIdRef.current, config);
      if (!provider) {
        dispatch({ type: 'SET_CAMERA_PROVIDER', provider: 'none' });
        setCameraReady(true);
        setIsCalibrationComplete(true);
        return;
      }

      try {
        // For phone provider as primary: acquire local microphone first (audio-only, no video)
        if (provider.type === 'phone_camera') {
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!mounted) {
              audioStream.getTracks().forEach(t => t.stop());
              return;
            }
            audioStreamRef.current = audioStream;

            const audioTrack = audioStream.getAudioTracks()[0];
            if (audioTrack) {
              wireAudioTrack(audioTrack);
            }
          } catch (micErr: any) {
            console.error("[CameraProvider] Microphone access denied for phone mode:", micErr);
            ErrorLogService.logError('proctoring', `Microphone access denied: ${micErr.message || micErr}`, micErr, sessionIdRef.current, candidate.name);
            dispatch({ type: 'SET_PERMISSION_DENIED' });
            return;
          }
        }

        await provider.initialize();
        if (!mounted) {
          provider.dispose();
          return;
        }
        providerRef.current = provider;
        dispatch({ type: 'SET_CAMERA_PROVIDER', provider: provider.type });

        // Record provider in audit metadata
        if (sessionIdRef.current) {
          SupabaseService.updateSessionMetadata(sessionIdRef.current, {
            runtime: { cameraProvider: provider.type }
          }).catch(err => console.warn("Failed to update runtime proctoring metadata", err));
        }

        // For phone provider: generate QR pairing URL
        if (provider.type === 'phone_camera') {
          const origin = window.location.origin;
          const tokenVal = (provider as PhoneCameraProvider).getPairingToken();
          setPairingQrUrl(`${origin}/proctor/phone-camera?token=${tokenVal}`);
          setPairingTokenExpiry((provider as PhoneCameraProvider).getTokenExpiresAt());
        }

        const stream = provider.getPreviewStream();
        if (stream) {
          setPreviewStream(stream);
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            wireAudioTrack(audioTrack);
          }
        }
        setCameraReady(true);

      } catch (err: any) {
        console.warn("[CameraProvider] Primary provider failed in Aptitude, trying fallback...", err);

        const fallbackProvider = CameraProviderFactory.createFallback(sessionIdRef.current, config);
        if (fallbackProvider) {
          try {
            // Fallback (e.g. phone camera): Request local microphone first, then initialize phone camera
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!mounted) {
              audioStream.getTracks().forEach(t => t.stop());
              return;
            }
            audioStreamRef.current = audioStream;

            const audioTrack = audioStream.getAudioTracks()[0];
            if (audioTrack) {
              wireAudioTrack(audioTrack);
            }

            await fallbackProvider.initialize();
            if (!mounted) {
              fallbackProvider.dispose();
              audioStream.getTracks().forEach(t => t.stop());
              return;
            }
            provider = fallbackProvider;
            providerRef.current = provider;
            dispatch({ type: 'SET_CAMERA_PROVIDER', provider: provider.type });

            // Record provider in audit metadata
            if (sessionIdRef.current) {
              SupabaseService.updateSessionMetadata(sessionIdRef.current, {
                runtime: { cameraProvider: provider.type }
              }).catch(err => console.warn("Failed to update runtime proctoring metadata", err));
            }

            const origin = window.location.origin;
            const tokenVal = (provider as PhoneCameraProvider).getPairingToken();
            setPairingQrUrl(`${origin}/proctor/phone-camera?token=${tokenVal}`);
            setPairingTokenExpiry((provider as PhoneCameraProvider).getTokenExpiresAt());

            setCameraReady(true);

          } catch (fallbackErr: any) {
            console.error("[CameraProvider] Fallback initialization failed in Aptitude:", fallbackErr);
            ErrorLogService.logError('proctoring', `Fallback initialization failed in Aptitude: ${fallbackErr.message || fallbackErr}`, fallbackErr, sessionIdRef.current, candidate.name);
            dispatch({ type: 'SET_PERMISSION_DENIED' });
          }
        } else {
          // No fallback configuration allowed (e.g. Webcam Only)
          dispatch({ type: 'SET_PERMISSION_DENIED' });
        }
      }

      // Wire provider callbacks
      if (providerRef.current) {
        providerRef.current.subscribe({
          onDetectionFrame: (frame) => {
            dispatch({ type: 'REMOTE_DETECTION_FRAME', frame, sequence: (frame as any).sequence || 0 });
          },
          onHeartbeat: (metrics) => {
            dispatch({ type: 'REMOTE_HEARTBEAT', metrics, sequence: (metrics as any).sequence || 0 });
          },
          onEngineReady: () => {
            dispatch({ type: 'ENGINE_READY' });
          },
          onError: (error) => {
            if (error.code === 'PHONE_DISCONNECTED') {
              dispatch({ type: 'PHONE_DISCONNECTED' });
            } else if (error.code === 'CAMERA_LOST') {
              dispatch({ type: 'CAMERA_LOST' });
            }
          },
          onStatusChange: (status) => {
            if (providerRef.current?.type === 'phone_camera') {
              const stateVal = (providerRef.current as PhoneCameraProvider).getConnectionState();
              dispatch({ type: 'SET_PHONE_CONNECTION_STATE', state: stateVal });
              
              // Update phone preview stream
              const stream = providerRef.current.getPreviewStream();
              setPhonePreviewStream(stream);
            }
          }
        });
      }
    };

    initMediaAndDevice();

    return () => {
      mounted = false;
      if (providerRef.current) {
        providerRef.current.dispose();
        providerRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

  // Load proctoring settings once on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await SupabaseService.getSystemSettings('proctoring_settings');
        if (settings) {
          console.log("[AptitudeTest] Loaded system proctoring settings:", settings);
          dispatch({ type: 'SET_SETTINGS', settings });
        } else {
          console.log("[AptitudeTest] No system proctoring settings found. Using client defaults.");
        }
      } catch (err) {
        console.error("[AptitudeTest] Failed to load proctoring settings:", err);
      }
    };
    fetchSettings();
  }, []);

  // 1. Initialize assessment questions, session recovery
  useEffect(() => {
    const recoveryKey = `reicrew_mcq_recovery_${sessionIdRef.current}`;
    const savedStr = localStorage.getItem(recoveryKey);
    let initialized = false;

    if (savedStr) {
      try {
        const saved = JSON.parse(savedStr);
        if (saved && (Date.now() - saved.startedAt < SESSION_TTL_MS)) {
          setQuestions(saved.questions);
          setCurrentIndex(saved.currentIndex);
          setSelectedAnswers(saved.selectedAnswers || {});
          setRemainingTimeSeconds(saved.remainingTimeSeconds);
          setTimeSpentArray(saved.timeSpentArray || new Array(10).fill(0));
          setHasStarted(true);
          initialized = true;
        } else {
          localStorage.removeItem(recoveryKey);
        }
      } catch (e) {
        console.warn("Failed to parse recovery state for Aptitude", e);
      }
    }

    if (!initialized) {
      const selected = selectBalancedQuestions();
      setQuestions(selected);
      // Create initial recovery payload
      localStorage.setItem(recoveryKey, JSON.stringify({
        startedAt: Date.now(),
        questions: selected,
        currentIndex: 0,
        selectedAnswers: {},
        remainingTimeSeconds: 60,
        timeSpentArray: new Array(10).fill(0)
      }));
    }
  }, []);

  // 2. Prevent right-click, select all, and copy-paste shortcuts
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      dispatch({ type: 'COPY_PASTE' });
      setToastWarning({ message: "Right-click context menu is disabled for security.", type: 'warning' });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCopy = e.ctrlKey && (e.key === 'c' || e.key === 'C');
      const isPaste = e.ctrlKey && (e.key === 'v' || e.key === 'V');
      const isSelectAll = e.ctrlKey && (e.key === 'a' || e.key === 'A');
      const isInspect = e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I'));

      if (isCopy || isPaste || isSelectAll || isInspect) {
        e.preventDefault();
        dispatch({ type: 'COPY_PASTE' });
        setToastWarning({ message: "Security Warning: Keyboard shortcuts are restricted.", type: 'warning' });
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 3. Tab focus and fullscreen triggers
  useEffect(() => {
    const handleVis = () => {
      if (!hasStartedRef.current) return;
      if (document.hidden) {
        dispatch({ type: 'TAB_HIDDEN' });
      }
    };
    const handleBlur = () => {
      if (!hasStartedRef.current) return;
      dispatch({ type: 'TAB_HIDDEN' });
    };
    const handleFullscreen = () => { 
      if (!hasStartedRef.current) return;
      if (!document.fullscreenElement) {
        dispatch({ type: 'FULLSCREEN_EXIT' });
      }
    };

    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreen);

    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreen);
    };
  }, []);

  // 4. Timer interval per question and total time spent
  useEffect(() => {
    if (!hasStarted || loading || isTerminatedRef.current) return;

    timerRef.current = setInterval(() => {
      setRemainingTimeSeconds((prev) => {
        if (prev <= 1) {
          // Time expired! Auto-next
          handleNextQuestion(true);
          return 60;
        }
        return prev - 1;
      });

      setTimeSpentArray((prev) => {
        const next = [...prev];
        next[currentIndex] = (next[currentIndex] || 0) + 1;
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasStarted, currentIndex, loading]);

  // 5. Update recovery state locally
  useEffect(() => {
    if (!hasStarted || questions.length === 0) return;
    const recoveryKey = `reicrew_mcq_recovery_${sessionIdRef.current}`;
    const savedStr = localStorage.getItem(recoveryKey);
    let startedAt = Date.now();
    try {
      if (savedStr) startedAt = JSON.parse(savedStr).startedAt;
    } catch {
      // Intentional: a corrupt or truncated recovery blob must not block the test from starting.
      // `startedAt` keeps its default and the recovery record is rewritten immediately below.
    }

    localStorage.setItem(recoveryKey, JSON.stringify({
      startedAt,
      questions,
      currentIndex,
      selectedAnswers,
      remainingTimeSeconds,
      timeSpentArray
    }));
  }, [currentIndex, selectedAnswers, remainingTimeSeconds, timeSpentArray, questions, hasStarted]);

  // 6. Terminate interview on extreme proctoring violations
  useEffect(() => {
    if (!hasStarted || isTerminatedRef.current) return;
    const settings = proctoring.settings || DEFAULT_PROCTORING_SETTINGS;

    const tabSwitchCount = proctoring.violations.filter(v => v.type === 'TAB_HIDDEN').length;
    const fullscreenExitCount = proctoring.violations.filter(v => v.type === 'FULLSCREEN_EXIT').length;

    // --- TERMINATION CHECKS ---
    if (tabSwitchCount >= settings.tabSwitchTerminateCount) {
      isTerminatedRef.current = true;
      setToastWarning({ message: `Test Terminated: Too many tab switches (${tabSwitchCount}/${settings.tabSwitchTerminateCount}).`, type: 'danger' });
      submitAndComplete(true);
      return;
    }
    if (fullscreenExitCount >= settings.fullscreenExitTerminateCount) {
      isTerminatedRef.current = true;
      setToastWarning({ message: `Test Terminated: Exited fullscreen mode too many times (${fullscreenExitCount}/${settings.fullscreenExitTerminateCount}).`, type: 'danger' });
      submitAndComplete(true);
      return;
    }

    // --- WARNING CHECKS ---
    if (tabSwitchCount >= settings.tabSwitchWarningCount) {
      setToastWarning({
        message: `Warning: Tab switch detected. Total: ${tabSwitchCount}/${settings.tabSwitchTerminateCount}. Please focus on the screen.`,
        type: 'danger'
      });
    }
    else if (fullscreenExitCount >= settings.fullscreenExitWarningCount) {
      setToastWarning({
        message: `Warning: Fullscreen mode exited. Total: ${fullscreenExitCount}/${settings.fullscreenExitTerminateCount}. Please return to fullscreen.`,
        type: 'danger'
      });
    }
  }, [proctoring.violations, proctoring.settings, hasStarted]);

  // Toast warning automatic fade out (4-second auto-dismiss across all warning types)
  useEffect(() => {
    if (toastWarning) {
      const t = setTimeout(() => setToastWarning(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toastWarning]);

  const handleDetectionFrame = (frame: RawDetectionFrame) => {
    dispatch({ type: 'DETECTION_FRAME', frame });
    if (providerRef.current && providerRef.current.type === 'local_webcam') {
      (providerRef.current as LocalCameraProvider).emitDetectionFrame(frame);
    }
  };

  const handleEngineReady = () => {
    dispatch({ type: 'ENGINE_READY' });
    if (providerRef.current && providerRef.current.type === 'local_webcam') {
      (providerRef.current as LocalCameraProvider).emitEngineReady();
    }
  };

  const handleHeartbeat = (metrics: HeartbeatMetrics) => {
    dispatch({ type: 'HEARTBEAT', metrics });
    if (providerRef.current && providerRef.current.type === 'local_webcam') {
      (providerRef.current as LocalCameraProvider).emitHeartbeat(metrics);
    }
  };

  const compileProctorReport = (isTerminated = false, terminationReason?: string): ProctoringReport => {
    const elapsedMs = Date.now() - proctoring.sessionStartTime;
    const violations = proctoring.violations.map(v => ({ ...v, sessionId: sessionIdRef.current }));
    const timeline = proctoring.timeline.map(t => ({ ...t, sessionId: sessionIdRef.current }));

    return {
      sessionId: sessionIdRef.current,
      currentRiskScore: proctoring.currentRiskScore,
      overallRiskScore: proctoring.overallRiskScore,
      noFaceEvents: violations.filter(v => v.type === 'NO_FACE').length,
      gazeAwayEvents: violations.filter(v => v.type === 'GAZE_AWAY').length,
      multipleFaceEvents: violations.filter(v => v.type === 'MULTIPLE_FACES').length,
      tabSwitchEvents: violations.filter(v => v.type === 'TAB_HIDDEN').length,
      fullscreenExitEvents: proctoring.fullscreenExitEvents,
      copyPasteEvents: proctoring.copyPasteEvents,
      violationScore: proctoring.violationScore,
      integrityScore: proctoring.integrityScore,
      totalGazeAwayDurationMs: proctoring.totalGazeAwayDurationMs,
      microphoneLostEvents: violations.filter(v => v.type === 'MICROPHONE_LOST').length,
      violations,
      timeline,
      sessionDurationMs: elapsedMs,
      monitoringDurationMs: proctoring.monitoringStartTime ? (Date.now() - proctoring.monitoringStartTime) : elapsedMs,
      heartbeatCount: proctoring.heartbeatCount,
      heartbeatSamples: [],
      cameraReconnectCount: proctoring.cameraReconnectCount,
      maxConcurrentFaces: proctoring.maxConcurrentFaces,
      browserInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      },
      healthSummary: {
        monitoringCoveragePercent: 100,
        averageTrackingConfidence: 90,
        totalDetectionFrames: proctoring.heartbeatCount * 15,
        stalledPeriods: 0,
        longestNoFaceDurationMs: 0,
        longestGazeAwayDurationMs: 0
      },
      isTerminated,
      terminationReason,
    };
  };

  const handleNextQuestion = (isTimeout = false) => {
    if (isTimeout) {
      // Auto-submit current question as unattempted or empty if not answered
      setSelectedAnswers((prev) => {
        if (prev[currentIndex] === undefined) {
          return { ...prev, [currentIndex]: 'Unattempted' };
        }
        return prev;
      });
    }

    if (currentIndex < 9) {
      setCurrentIndex((prev) => prev + 1);
      setRemainingTimeSeconds(60);
    } else {
      // Completed the 10th question!
      submitAndComplete(false);
    }
  };

  const submitAndComplete = async (terminated = false) => {
    setLoading(true);
    setLoadingText(terminated ? "Test terminated. Compiling report..." : "Assessment complete. Saving evaluation...");
    if (timerRef.current) clearInterval(timerRef.current);

    const recoveryKey = `reicrew_mcq_recovery_${sessionIdRef.current}`;
    localStorage.removeItem(recoveryKey);

    const proctorReport = compileProctorReport(terminated, terminated ? "Terminated due to extreme proctoring violations" : undefined);

    // Map history array structure
    const historyData = questions.map((q, idx) => {
      const selected = selectedAnswers[idx] || 'Unattempted';
      return {
        question: q.question,
        answer: selected,
        ideal_answer: q.answer || '',
        questionData: q,
        timeSpentSeconds: timeSpentArray[idx] || 0
      };
    });

    let evalReport = null;
    let evalErrorReason: string | undefined = undefined;
    try {
      evalReport = await AIService.evaluateInterview(historyData, sessionIdRef.current, proctorReport);
    } catch (e: any) {
      console.error("Failed to generate AI evaluation report for MCQ:", e);
      evalErrorReason = e?.message || String(e);
    }

    onComplete(historyData, proctorReport, {
      completionState: evalReport ? InterviewCompletionState.COMPLETED : InterviewCompletionState.FAILED,
      report: evalReport,
      errorReason: evalErrorReason,
      startedAt: new Date().toISOString(),
    });
  };

  // SVG timer properties
  const radius = 24;
  const stroke = 4;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (remainingTimeSeconds / 60) * circumference;

  const currentQ = questions[currentIndex];
  const hasSelected = selectedAnswers[currentIndex] !== undefined;

  if (sessionError) {
    return (
      <div className="min-h-screen w-screen bg-[#F8FAFC] flex items-center justify-center p-4 text-slate-900 animate-in fade-in duration-500">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-200 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
            <span className="text-2xl font-bold text-red-600">!</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Critical Session Error</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            {sessionError}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-12">
          <div className="text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">Ready to start the Aptitude Assessment?</h1>
            <p className="text-slate-500 font-medium max-w-xl mx-auto">
              Please review the rules and complete camera calibration before beginning the test.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200/60 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">60s Timer per Question</h3>
                <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                  Each question has a strict 60-second limit. The timer resets automatically.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/60 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Check size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">MCQ Selection</h3>
                <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                  Select your answers from the options. They are saved dynamically.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200/60 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Proctoring Rules</h3>
                <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                  Remain centered in the camera feed. Tab switches and shortcuts are restricted.
                </p>
              </div>
            </div>
          </div>

          {/* Pre-Flight Calibration Check */}
          <div className="flex justify-center flex-col items-center gap-4">
            {proctoring.cameraProvider === 'local_webcam' && (
              <CameraAnalysis
                stream={previewStream || providerRef.current?.getPreviewStream() || null}
                onDetectionFrame={(frame) => {
                  dispatch({ type: 'REMOTE_DETECTION_FRAME', frame, sequence: 0 });
                  if (providerRef.current && providerRef.current.type === 'local_webcam') {
                    (providerRef.current as LocalCameraProvider).emitDetectionFrame(frame);
                  }
                }}
                onEngineReady={() => {
                  dispatch({ type: 'ENGINE_READY' });
                }}
                onHeartbeat={(metrics) => {
                  dispatch({ type: 'REMOTE_HEARTBEAT', metrics, sequence: 0 });
                }}
                devOverlay={false}
                enabled={true}
              />
            )}

            {providerRef.current && (
              <PreFlightCheck
                provider={providerRef.current}
                onReady={handleCalibrationReady}
                showQrCode={proctoring.cameraProvider === 'phone_camera'}
                qrCodeUrl={pairingQrUrl}
                qrTokenExpiry={pairingTokenExpiry ?? undefined}
                phoneConnectionState={proctoring.phoneConnectionState}
              />
            )}
          </div>

          <div className="text-center pt-4">
            <button
              onClick={() => {
                // Advance the UI first. Optional browser APIs like fullscreen
                // must never be able to block the assessment from starting.
                setHasStarted(true);
                setRemainingTimeSeconds(60);

                // iPhone Safari may not support document fullscreen; never block
                // the assessment start if fullscreen is unavailable there.
                void requestFullscreenIfSupported();
              }}
              disabled={!isCalibrationComplete}
              className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 disabled:shadow-none transition-all active:scale-95 w-full sm:w-auto cursor-pointer"
            >
              {!isCalibrationComplete ? 'Complete Calibration Above' : 'Start Assessment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between px-3 py-4 sm:p-6">
      {/* Toast Warnings */}
      {toastWarning && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 ${
          toastWarning.type === 'danger' 
            ? 'bg-rose-50 border-rose-200 text-rose-600' 
            : 'bg-amber-50 border-amber-200 text-amber-600'
        }`}>
          <ShieldAlert className="shrink-0" />
          <span className="font-semibold text-sm">{toastWarning.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 p-3 lg:p-4 rounded-2xl lg:rounded-3xl shadow-sm mb-4 lg:mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xl">A</div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800">Aptitude Path</h2>
            <p className="text-slate-400 text-xs font-medium">MCQ Assessment</p>
          </div>
        </div>

        {/* Indicators */}
        <div className="hidden md:flex items-center gap-2">
          {Array.from({ length: 10 }).map((_, idx) => {
            const isDone = selectedAnswers[idx] !== undefined;
            const isCurrent = idx === currentIndex;
            return (
              <div 
                key={idx} 
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isCurrent ? 'bg-indigo-600 scale-125 ring-4 ring-indigo-50' : 
                  isDone ? 'bg-indigo-200' : 'bg-slate-100'
                }`}
              />
            );
          })}
        </div>

        {/* Live Proctor and Timer */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-700 text-xs font-bold uppercase tracking-wider">Secure</span>
          </div>

          <div className="relative flex items-center justify-center">
            <svg height="48" width="48" className="transform -rotate-90">
              <circle
                stroke="#E2E8F0"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                stroke={remainingTimeSeconds <= 15 ? "#EF4444" : "#4F46E5"}
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference + ' ' + circumference}
                style={{ strokeDashoffset }}
                strokeLinecap="round"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            </svg>
            <span className={`absolute text-xs font-black ${remainingTimeSeconds <= 15 ? 'text-rose-500 animate-pulse' : 'text-slate-700'}`}>
              {remainingTimeSeconds}s
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 items-stretch mb-4 lg:mb-6">
        {/* Left Side: Proctor Preview (Desktop Column / Compact Mobile Banner) */}
        <div className="lg:col-span-1 flex flex-col gap-3 lg:gap-4">
          {/* Mobile Proctoring Bar */}
          <div className="lg:hidden bg-white border border-slate-200 p-3 rounded-2xl shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-16 h-12 bg-slate-900 rounded-xl overflow-hidden relative shrink-0">
                <CameraPreview 
                  stream={proctoring.cameraProvider === 'phone_camera' ? phonePreviewStream : (previewStream || providerRef.current?.getPreviewStream() || null)}
                  mirrored={proctoring.cameraProvider === 'local_webcam'}
                  showPlaceholder={proctoring.cameraProvider === 'phone_camera' && !phonePreviewStream}
                />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Proctoring Active</span>
                <span className="text-xs font-black text-slate-700">Integrity {proctoring.integrityScore}%</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Live</span>
            </div>
          </div>

          {/* Desktop Proctoring Box */}
          <div className="hidden lg:flex flex-col gap-4 flex-1">
            <div className="bg-slate-900 aspect-square rounded-3xl overflow-hidden shadow-md relative border border-slate-800">
              <CameraPreview 
                stream={proctoring.cameraProvider === 'phone_camera' ? phonePreviewStream : (previewStream || providerRef.current?.getPreviewStream() || null)}
                mirrored={proctoring.cameraProvider === 'local_webcam'}
                showPlaceholder={proctoring.cameraProvider === 'phone_camera' && !phonePreviewStream}
                statusOverlay={
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${proctoring.engineState === 'READY' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                    <span className="text-white text-[10px] font-mono tracking-wider">
                      {proctoring.cameraProvider === 'phone_camera' ? 'PHONE LIVE' : 'WEBCAM LIVE'}
                    </span>
                  </div>
                }
              />

              {proctoring.cameraProvider === 'local_webcam' && (
                <CameraAnalysis
                  stream={providerRef.current?.getPreviewStream() ?? null}
                  onDetectionFrame={handleDetectionFrame}
                  onEngineReady={handleEngineReady}
                  onHeartbeat={handleHeartbeat}
                  devOverlay={false}
                  enabled={true}
                />
              )}
            </div>
            
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col justify-between flex-1">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Clock size={16} className="text-indigo-500" />
                  Assessment Instructions
                </h3>
                <ul className="text-xs text-slate-500 space-y-2.5 font-medium">
                  <li className="flex gap-2">
                    <span className="text-indigo-500 font-black">•</span>
                    Each question has a strict 60s timer limit.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-indigo-500 font-black">•</span>
                    Timer resets automatically when moving to the next question.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-indigo-500 font-black">•</span>
                    Forward-only navigation. You cannot return to previous questions.
                  </li>
                  <li className="flex gap-2">
                    <span className="text-indigo-500 font-black">•</span>
                    Integrity proctoring actively monitors gaze, tab switches, and shortcuts.
                  </li>
                </ul>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-4">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1">
                  <span>INTEGRITY STATUS</span>
                  <span className={proctoring.integrityScore < 70 ? 'text-rose-500' : 'text-emerald-500'}>
                    {proctoring.integrityScore}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      proctoring.integrityScore < 50 ? 'bg-rose-500' : 
                      proctoring.integrityScore < 75 ? 'bg-amber-400' : 
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${proctoring.integrityScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: MCQ Panel */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl lg:rounded-4xl p-4 sm:p-6 md:p-8 flex flex-col justify-between shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-4 h-full py-20">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 font-bold text-lg">{loadingText}</p>
            </div>
          ) : currentQ ? (
            <div className="space-y-6">
              {/* Question Index & Category */}
              <div className="flex items-center gap-3">
                <span className="bg-indigo-50 text-indigo-600 text-xs font-extrabold px-3 py-1.5 rounded-xl uppercase tracking-wider">
                  {currentQ.category}
                </span>
                <span className="text-slate-400 text-xs font-bold">
                  Question {currentIndex + 1} of 10
                </span>
                {currentQ.difficulty && (
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                    currentQ.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-600' :
                    currentQ.difficulty === 'hard' ? 'bg-rose-50 text-rose-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {currentQ.difficulty}
                  </span>
                )}
              </div>

              {/* Question Text */}
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 leading-snug">
                {currentQ.question}
              </h1>

              {/* Optional Question Image */}
              {currentQ.imageUrl && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 flex justify-center bg-slate-50 p-2">
                  <img src={currentQ.imageUrl} alt="Question Diagram" className="object-contain max-h-60" />
                </div>
              )}

              {/* Options Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                {currentQ.options?.map((opt, oIdx) => {
                  const optKey = String.fromCharCode(65 + oIdx); // A, B, C, D
                  const isSelected = selectedAnswers[currentIndex] === optKey;

                  return (
                    <button
                      key={oIdx}
                      onClick={() => {
                        setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: optKey }));
                      }}
                      className={`group text-left p-4 sm:p-5 min-h-[56px] rounded-2xl border-2 transition-all duration-300 flex items-center justify-between active:scale-[0.99] ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100' 
                          : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/30'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-50 group-hover:bg-slate-100 text-slate-500'
                        }`}>
                          {optKey}
                        </div>
                        <span className="text-slate-700 font-semibold text-sm">{opt}</span>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full py-20 text-slate-400">
              No questions found.
            </div>
          )}

          {/* Navigation Controls */}
          {!loading && (
            <div className="border-t border-slate-100 pt-5 mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-slate-400 text-xs font-semibold order-2 sm:order-1">
                * Answers are saved as you select.
              </span>
              <button
                onClick={() => handleNextQuestion(false)}
                disabled={!hasSelected}
                className="order-1 sm:order-2 w-full sm:w-auto bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-300 text-white px-8 py-4 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 shadow-md hover:shadow-xl shadow-indigo-100 disabled:shadow-none"
              >
                <span>{currentIndex < 9 ? 'Next Question' : 'Complete Assessment'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
