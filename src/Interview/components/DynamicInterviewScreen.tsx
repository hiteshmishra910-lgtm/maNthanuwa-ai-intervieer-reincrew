import React, { useState, useEffect, useRef, useReducer, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setClerkToken, setSupabaseAuthToken } from '../../Core/database/supabaseClient';
import { Mic, MicOff, Volume2, Send, Loader2, Edit3, CheckCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { AIService, ComposedInterview, getQuestionsForRole } from '../../Core/ai/aiService';
import { submitAnswer, localDifficultySignal, hashString } from '../../Core/api/apiService';
import { EvaluationDispatcher } from '../../Evaluation/dispatch/EvaluationDispatcher';

import { TranscriptValidator } from '../../Evaluation/pipeline/TranscriptValidator';
import { useInterviewFlowController, InterviewState } from '../hooks/useInterviewFlowController';
import { useSpeech } from '../hooks/useSpeech';
import { CameraMonitor } from '../../Proctoring/components/CameraMonitor';
import { MonitoringDashboard } from '../../Analytics/components/MonitoringDashboard';
import { SupabaseService } from '../../Core/database/supabaseService';
import { AptitudeTestScreen } from './AptitudeTestScreen';
import { MediaCaptureService, RollingRecorder } from '../../Proctoring/services/mediaCaptureService';
import { 
  InterviewMediaResources, RawDetectionFrame, ProctorViolation, TimelineEvent, 
  HeartbeatMetrics, ProctoringEngineState, ProctoringReport, DashboardTelemetry,
  Question, DEFAULT_PROCTORING_SETTINGS, PhoneConnectionState, CameraProvider,
  ProctoringConfiguration, EvaluationMode
} from '../../../types';
import { getDeviceFingerprint } from '../../Proctoring/services/deviceFingerprint';
import { ErrorLogService } from '../../Core/logging/errorLogService';
import { TelemetryService } from '../../Analytics/services/telemetryService';
import { CameraPreview } from '../../Proctoring/components/CameraPreview';
import { CameraAnalysis } from '../../Proctoring/components/CameraAnalysis';
import { CameraProviderFactory } from '../../Proctoring/services/cameraProviders/CameraProviderFactory';
import { PreFlightCheck } from './PreFlightCheck';
import { LocalCameraProvider } from '../../Proctoring/services/cameraProviders/LocalCameraProvider';
import { isFullscreenActive, requestFullscreenIfSupported } from '../../Core/utils/fullscreen';
import { PhoneCameraProvider } from '../../Proctoring/services/cameraProviders/PhoneCameraProvider';
import { uploadProctoringSnapshot, uploadProctoringClip } from '../../Core/storage/cloudinaryService';

// Speech Recognition Types removed, using useSpeech hook
import { ProctoringState, ProctoringAction } from '../../../types';

const DEFAULT_EVALUATION_MODE = EvaluationMode.LOCAL;

const resolveEvaluationMode = (
  globalMode: string | EvaluationMode | null,
  jobSnapshotMode?: string | null,
  sessionId?: string
): EvaluationMode => {
  // 1. Session-scoped explicit UI override
  try {
    if (sessionId) {
      const sessionOverride = localStorage.getItem(`reicrew_eval_mode_override_${sessionId}`);
      if (sessionOverride) {
        const normOverride = sessionOverride.toUpperCase();
        if (normOverride.includes('LOCAL')) return EvaluationMode.LOCAL;
        if (normOverride.includes('HYBRID')) return EvaluationMode.HYBRID;
        if (normOverride.includes('API')) return EvaluationMode.API;
      }
    }
  } catch (e) {
    // Ignore storage errors
  }

  // 2. URL parameter override
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlMode = urlParams.get('mode') || urlParams.get('evalMode') || urlParams.get('evaluationMode');
    if (urlMode) {
      const normUrl = urlMode.toUpperCase();
      if (normUrl.includes('LOCAL')) return EvaluationMode.LOCAL;
      if (normUrl.includes('HYBRID')) return EvaluationMode.HYBRID;
      if (normUrl.includes('API')) return EvaluationMode.API;
    }
  } catch (e) {
    // Ignore URL param errors
  }

  // 3. Admin Global System setting from database
  if (globalMode) {
    const normGlobal = String(globalMode).toUpperCase();
    if (normGlobal.includes('LOCAL')) return EvaluationMode.LOCAL;
    if (normGlobal.includes('HYBRID')) return EvaluationMode.HYBRID;
    if (normGlobal.includes('API')) return EvaluationMode.API;
  }

  // 4. Candidate / Drive snapshot setting
  if (jobSnapshotMode) {
    const norm = String(jobSnapshotMode).toUpperCase();
    if (norm === 'LOCAL' || norm.includes('LOCAL')) return EvaluationMode.LOCAL;
    if (norm === 'API' || norm.includes('API') || norm.includes('INTERACTIVE') || norm === 'AI') return EvaluationMode.API;
    if (norm === 'HYBRID') return EvaluationMode.HYBRID;
  }

  return EvaluationMode.LOCAL;
};

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

const generateViolationId = () => Math.random().toString(36).substring(2, 9);
const VIOLATION_COOLDOWN = 5000;

/**
 * Is `type` still within its own cooldown window?
 *
 * The cooldown exists to stop one continuous condition from logging dozens of identical
 * violations per second. That intent is per-type — it was implemented against a single shared
 * `lastViolationTime`, so an unrelated violation silenced every other type for five seconds.
 *
 * The practical effect was that tab switches went unrecorded: leaving the tab takes the
 * candidate's face out of frame, NO_FACE fires first, and the TAB_HIDDEN that arrives
 * milliseconds later was dropped. Same for exiting fullscreen in order to switch tabs.
 */
const isWithinCooldown = (state: ProctoringState, type: string, now: number): boolean => {
  const last = state.lastViolationTimeByType?.[type];
  return typeof last === 'number' && now - last < VIOLATION_COOLDOWN;
};

/** Records the cooldown clock for `type`, keeping the legacy global field in step. */
const stampCooldown = (state: ProctoringState, type: string, now: number) => ({
  lastViolationTime: now,
  lastViolationTimeByType: { ...(state.lastViolationTimeByType || {}), [type]: now },
});

const baseReducer = (state: ProctoringState, action: ProctoringAction): ProctoringState => {
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
    
    case 'UPDATE_VIOLATION_MEDIA': {
      const violations = state.violations.map(v => 
        v.id === action.id ? { ...v, snapshot_url: action.snapshotUrl || undefined, clip_url: action.clipUrl || undefined } : v
      );
      return { ...state, violations };
    }

    case 'DECAY_RISK': {
      if (state.currentRiskScore === 0) return state;
      const floor = Math.floor(state.overallRiskScore * 0.25);
      const newScore = Math.max(floor, state.currentRiskScore - 1);
      return { ...state, currentRiskScore: newScore };
    }

    case 'TAB_HIDDEN': {
      if (isWithinCooldown(state, 'TAB_HIDDEN', now)) return state;
      // The trigger is recorded because "tab switch" and "window lost focus" are different
      // events to a reviewer: the first is navigating away, the second can be an OS notification.
      const detail = action.trigger === 'blur'
        ? 'Window lost focus — the candidate switched to another window or application'
        : 'Tab switch — the candidate navigated away from the interview tab';
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'TAB_HIDDEN', severity: 2, timestamp: now, message: detail };
      const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'TAB_HIDDEN', severity: 2, detail };
      return { ...state, violations: [...state.violations, v], timeline: [...state.timeline, t], violationScore: state.violationScore + 2, ...stampCooldown(state, 'TAB_HIDDEN', now) };
    }

    case 'FULLSCREEN_EXIT': {
      if (isWithinCooldown(state, 'FULLSCREEN_EXIT', now)) return state;
      const detail = 'Fullscreen exit — the candidate left fullscreen mode';
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'FULLSCREEN_EXIT', severity: 3, timestamp: now, message: detail };
      const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'FULLSCREEN_EXIT', severity: 3, detail };
      return { ...state, fullscreenExitEvents: state.fullscreenExitEvents + 1, violations: [...state.violations, v], timeline: [...state.timeline, t], violationScore: state.violationScore + 3, ...stampCooldown(state, 'FULLSCREEN_EXIT', now) };
    }

    case 'COPY_PASTE': {
      if (isWithinCooldown(state, 'COPY_PASTE', now)) return state;
      // Copy, cut and paste are materially different signals — paste suggests importing an
      // answer from elsewhere, copy suggests exfiltrating the question. "Clipboard action
      // detected" told the reviewer neither, even though the DOM event already carried it.
      const clipboardLabel: Record<string, string> = {
        copy: 'Copy attempt — the candidate copied content from the interview',
        cut: 'Cut attempt — the candidate cut content from the interview',
        paste: 'Paste attempt — the candidate pasted content into their answer',
      };
      const detail = clipboardLabel[String(action.clipboardAction || '').toLowerCase()]
        || 'Clipboard activity detected during the interview';
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'COPY_PASTE', severity: 2, timestamp: now, message: detail };
      const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'COPY_PASTE', severity: 2, detail };
      return { ...state, copyPasteEvents: state.copyPasteEvents + 1, violations: [...state.violations, v], timeline: [...state.timeline, t], violationScore: state.violationScore + 2, ...stampCooldown(state, 'COPY_PASTE', now) };
    }

    case 'CAMERA_LOST': {
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'CAMERA_LOST', severity: 4, timestamp: now, message: 'Camera disconnected' };
      const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'CAMERA_LOST', severity: 4 };
      return { ...state, cameraReconnectCount: state.cameraReconnectCount + 1, violations: [...state.violations, v], timeline: [...state.timeline, t], currentRiskScore: state.currentRiskScore + 4, overallRiskScore: state.overallRiskScore + 4 };
    }

    case 'MICROPHONE_LOST': {
      if (!state.microphoneHealthy) return state;
      const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'MICROPHONE_LOST', severity: 2, timestamp: now, message: 'Microphone disconnected or muted' };
      const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'MICROPHONE_LOST', severity: 2 };
      return { ...state, microphoneHealthy: false, violations: [...state.violations, v], timeline: [...state.timeline, t], currentRiskScore: state.currentRiskScore + 2, overallRiskScore: state.overallRiskScore + 2 };
    }

    case 'MICROPHONE_RECOVERED': {
      if (state.microphoneHealthy) return state;
      const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'MICROPHONE_RECOVERED', severity: 0 };
      return { ...state, microphoneHealthy: true, timeline: [...state.timeline, t] };
    }

    case 'NETWORK_LOST': return { ...state, networkHealthy: false };
    case 'NETWORK_RECOVERED': return { ...state, networkHealthy: true };

    // ─── Phone Camera Proctoring Actions ────────────────────────────────
    case 'SET_CAMERA_PROVIDER': return { ...state, cameraProvider: action.provider };
    case 'SET_PHONE_CONNECTION_STATE': return { ...state, phoneConnectionState: action.state };
    case 'PHONE_CONNECTED': {
      const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'PHONE_CONNECTED', severity: 0, detail: `Connection ID bound: ${action.connectionId}` };
      return { 
        ...state, 
        phoneConnectionState: 'CONNECTED', 
        phoneConnectionId: action.connectionId,
        timeline: [...state.timeline, t] 
      };
    }
    case 'PHONE_DISCONNECTED': {
      const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'PHONE_DISCONNECTED', severity: 2, detail: 'Phone connection lost' };
      return { 
        ...state, 
        phoneConnectionState: 'RECONNECTING',
        timeline: [...state.timeline, t] 
      };
    }
    case 'PHONE_RECONNECTED': {
      const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'PHONE_RECONNECTED', severity: 0, detail: `Reconnected device: ${action.connectionId}` };
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
        } else if (newState.noFaceState === 'NO_FACE_START' && newState.noFaceStartTime && now - newState.noFaceStartTime > (state.settings?.faceMissingWarningSec ?? 10) * 1000) {
          newState.noFaceState = 'VIOLATION_CREATED';
          if (!isWithinCooldown(state, 'NO_FACE', now)) {
            const warnSec = state.settings?.faceMissingWarningSec ?? 10;
            const detail = `No face in frame — the candidate was not visible to the camera for over ${warnSec}s`;
            const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'NO_FACE', severity: 3, timestamp: now, message: detail };
            const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'NO_FACE', severity: 3, detail };
            newState.violations = [...newState.violations, v];
            newState.timeline = [...newState.timeline, t];
            newState.violationScore += 3;
            Object.assign(newState, stampCooldown(newState, 'NO_FACE', now));
          }
        }
      } else {
        if (newState.noFaceState === 'VIOLATION_CREATED') {
          const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'FACE_RECOVERED', severity: 0, detail: 'Face detected' };
          newState.timeline = [...newState.timeline, t];
        }
        newState.noFaceState = 'FACE_PRESENT';
        newState.noFaceStartTime = null;
      }

      // Multiple Faces State Machine
      if (action.frame.faceCount > 1) {
        if (newState.multiFaceState === 'SINGLE_FACE') {
          newState.multiFaceState = 'MULTI_FACE_START';
          newState.multiFaceStartTime = now;
        } else if (newState.multiFaceState === 'MULTI_FACE_START' && newState.multiFaceStartTime && now - newState.multiFaceStartTime > 3000) {
          // 'MULTI_FACE_CONFIRMED', not 'VIOLATION_CREATED'.
          //
          // ProctoringState.multiFaceState is declared as
          // 'SINGLE_FACE' | 'MULTI_FACE_START' | 'MULTI_FACE_CONFIRMED'. This assigned a fourth
          // value that is not in the union and used `as any` to get it past the compiler, so the
          // state never matched anything a consumer was written to test for — including the live
          // violations panel. AptitudeTestScreen has always used the declared value.
          newState.multiFaceState = 'MULTI_FACE_CONFIRMED';
          if (!isWithinCooldown(state, 'MULTIPLE_FACES', now)) {
            const faces = action.frame.faceCount;
            const detail = `Multiple faces in frame — ${faces} people were visible to the camera for over 3s`;
            const v: ProctorViolation = { id: generateViolationId(), sessionId: '', type: 'MULTIPLE_FACES', severity: 5, timestamp: now, message: detail };
            const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'MULTIPLE_FACES', severity: 5, detail };
            newState.violations = [...newState.violations, v];
            newState.timeline = [...newState.timeline, t];
            newState.violationScore += 5;
            Object.assign(newState, stampCooldown(newState, 'MULTIPLE_FACES', now));
          }
        }
      } else {
        if (newState.multiFaceState === 'MULTI_FACE_CONFIRMED') {
          const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'MULTIPLE_FACES_RESOLVED', severity: 0, detail: 'Single face restored' };
          newState.timeline = [...newState.timeline, t];
        }
        newState.multiFaceState = 'SINGLE_FACE';
        newState.multiFaceStartTime = null;
      }

      // Gaze State Machine (Holistic Away Detection)
      const isAway = action.frame.gazeDirection !== 'center' || Math.abs(action.frame.headYaw) > 30 || action.frame.facePosition === 'PARTIAL_OUT';
      if (isAway && action.frame.faceCount > 0) {
        if (newState.gazeState === 'LOOKING') {
          newState.gazeState = 'AWAY_START';
          newState.gazeAwayStartTime = now;
        } else if (newState.gazeState === 'AWAY_START' && newState.gazeAwayStartTime && now - newState.gazeAwayStartTime > 12000) {
          newState.gazeState = 'VIOLATION_CREATED';
          const reason = action.frame.facePosition === 'PARTIAL_OUT' ? 'Face partially out' : 
                         Math.abs(action.frame.headYaw) > 30 ? 'Head turned away' : 
                         `Looking ${action.frame.gazeDirection}`;
          // NO PENALTY YET - Just log the data!
          const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'GAZE_AWAY_LOG_ONLY', severity: 0, detail: reason };
          newState.timeline = [...newState.timeline, t];
          newState.totalGazeAwayDurationMs += (now - newState.gazeAwayStartTime);
        }
      } else {
        if (newState.gazeState === 'VIOLATION_CREATED') {
          newState.gazeState = 'COOLDOWN';
          const t: TimelineEvent = { id: generateViolationId(), sessionId: '', timestamp: now, event: 'GAZE_RESOLVED', severity: 0, detail: 'Returned to screen' };
          newState.timeline = [...newState.timeline, t];
        } else {
          newState.gazeState = 'LOOKING';
        }
        // Only clear gaze start time if they are looking back at screen AND face is present
        // If face is absent, we don't clear it so we don't spam transitions.
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
        newState.currentRiskScore !== state.currentRiskScore;

      return isChanged ? newState : state;
    }
    default: return state;
  }
};

const MAX_TIMELINE_EVENTS = 250;
const proctoringReducer = (state: ProctoringState, action: ProctoringAction): ProctoringState => {
  const newState = baseReducer(state, action);
  if (newState.timeline.length > MAX_TIMELINE_EVENTS) {
    return {
      ...newState,
      timeline: newState.timeline.slice(newState.timeline.length - MAX_TIMELINE_EVENTS)
    };
  }
  return newState;
};

interface DynamicInterviewScreenProps {
  candidate: { name: string; email: string; role: string; customTopic?: string; isDemo?: boolean; jobPostId?: string; session?: any };
  onComplete: (history: { question: string; answer: string; ideal_answer: string }[], proctoringReport: ProctoringReport, completionResult: any) => void;
}



export const DynamicInterviewScreen: React.FC<DynamicInterviewScreenProps> = ({ candidate, onComplete }) => {
  const { getToken } = useAuth();

  // Keep Supabase & Clerk tokens active and refreshed during proctoring upload events
  useEffect(() => {
    const refreshToken = async () => {
      try {
        let rawClerkToken = null;
        let token = null;
        try {
          rawClerkToken = await getToken();
          token = await getToken({ template: 'supabase' });
        } catch {
          token = rawClerkToken;
        }
        if (rawClerkToken) setClerkToken(rawClerkToken);
        if (token) setSupabaseAuthToken(token);
      } catch (err) {
        console.warn('[DynamicInterviewScreen] Token sync failed', err);
      }
    };

    refreshToken();
    const interval = setInterval(refreshToken, 45000);
    return () => clearInterval(interval);
  }, [getToken]);

  const [branch, setBranch] = useState<ComposedInterview | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [evaluationMode, setEvaluationMode] = useState<EvaluationMode | null>(null);
  const [configurationReady, setConfigurationReady] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const jobSettingsRef = useRef<any>(null);
  const [history, setHistory] = useState<{ question: string; answer: string; ideal_answer: string; evaluation?: any; difficulty?: string; category?: string; questionData?: any }[]>([]);
  const {
    isListening, transcript, setTranscript, resetTranscript,
    startListening, stopListening, isSupported, speak, stopSpeaking, isSpeaking, warmUp,
    micStatus, interimTranscript, liveTranscript
  } = useSpeech(questions[currentIndex]?.id);
  
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Evaluating your response...');
  const [isEditing, setIsEditing] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const hasStartedRef = useRef(false);
  useEffect(() => { hasStartedRef.current = hasStarted; }, [hasStarted]);
  const sessionIdRef = useRef<string>(
    candidate.session?.id || 
    sessionStorage.getItem('current_session_id') || 
    localStorage.getItem('current_session_id') || 
    ""
  );
  
  const contextRef = useRef<any>(null);
  const [interviewContext, setInterviewContext] = useState<any>(null);
  const { 
    state: interviewState, 
    features, 
    isProcessing, 
    setIsProcessing, 
    transitionTo, 
    submitTranscript, 
    currentQuestion: pipelineCurrentQuestion, 
    lastEvaluation, 
    isCompleted: pipelineCompleted,
    completionResult: pipelineCompletionResult,
    completionResultRef,
    controller
  } = useInterviewFlowController(interviewContext || sessionIdRef.current);

  const isProcessingRef = useRef(false);
  const [isMobileMonitorOpen, setIsMobileMonitorOpen] = useState(false);
  const MAX_QUESTIONS = 10;

  const historyRef = useRef<any[]>([]);
  const bgEvalsRef = useRef<{ [key: number]: Promise<any> }>({});
  const lastSubmittedTranscriptRef = useRef("");
  const submittedQuestionRef = useRef<string>('');
  const submittedIdealAnswerRef = useRef<string>(''); 
  const lastProcessedEvaluationRef = useRef<any>(null);

  const updateHistory = (newHistory: any[]) => {
    historyRef.current = newHistory;
    setHistory(newHistory);
  };

  // Reset all states when candidate identity, role, or jobPostId changes to prevent stale data
  useEffect(() => {
    setIsPrepared(false);
    setConfigurationReady(false);
    setEvaluationMode(null);
    setLoading(true);
    setCurrentIndex(0);
    setBranch(null);
    setQuestions([]);
    updateHistory([]);
    setTranscript("");
  }, [candidate.email, candidate.role, candidate.jobPostId]);

  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);

  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const transitionStartRef = useRef<number>(0);
  const llmDurationRef = useRef<number>(0);
  const ttsStartRef = useRef<number>(0);
  const sttDurationRef = useRef<number>(0);
  const sttStartTimeRef = useRef<number | null>(null);
  const sttCapturedDurationRef = useRef<number>(0);
  const activeQuestionIdRef = useRef<string | number>("");
  const isTransitioningRef = useRef<boolean>(false);



  const [proctoring, dispatch] = useReducer(proctoringReducer, createInitialState());
  const [toastQueue, setToastQueue] = useState<{ message: string; type: 'warning' | 'danger'; id: string }[]>([]);
  const [activeToast, setActiveToast] = useState<{ message: string; type: 'warning' | 'danger'; id: string } | null>(null);
  
  const lastToastTimeRef = useRef<number>(0);
  const lastToastKeyRef = useRef<string>('');
  const lastToastedCountsRef = useRef<{ tabSwitch: number; multiFace: number; copyPaste: number; fullscreen: number }>({
    tabSwitch: 0,
    multiFace: 0,
    copyPaste: 0,
    fullscreen: 0
  });

  const enqueueToast = useCallback((message: string, type: 'warning' | 'danger', key: string) => {
    const now = Date.now();
    if (key === lastToastKeyRef.current && (now - lastToastTimeRef.current) < 5000) {
      return;
    }
    lastToastKeyRef.current = key;
    lastToastTimeRef.current = now;

    setToastQueue(prev => {
      if (prev.some(t => t.id === key)) return prev;
      return [...prev, { message, type, id: key }];
    });
  }, []);

  useEffect(() => {
    if (!activeToast && toastQueue.length > 0) {
      const nextToast = toastQueue[0];
      setActiveToast(nextToast);
      setToastQueue(prev => prev.slice(1));
    }
  }, [activeToast, toastQueue]);

  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);

  useEffect(() => {
    if (!sessionIdRef.current) {
      setSessionError("No active interview session ID found. The interview cannot proceed safely. Please register again.");
    }
  }, []);

  // Load proctoring settings once on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await SupabaseService.getSystemSettings('proctoring_settings');
        if (settings) {
          console.log("[DynamicInterview] Loaded system proctoring settings:", settings);
          dispatch({ type: 'SET_SETTINGS', settings });
        } else {
          console.log("[DynamicInterview] No system proctoring settings found. Using client defaults.");
        }
      } catch (err) {
        console.error("[DynamicInterview] Failed to load proctoring settings:", err);
      }
    };
    fetchSettings();
  }, []);

  // Refs for tracking camera/mic off states and warning triggers to bypass tab throttling
  const cameraOffStartTimeRef = useRef<number | null>(null);
  const micOffStartTimeRef = useRef<number | null>(null);
  const warnedNoFaceRef = useRef(false);
  const warnedCameraOffRef = useRef(false);
  const warnedMicOffRef = useRef(false);

  const flushedEventIdsRef = useRef<Set<string>>(new Set());
  const flushQueueRef = useRef<any[]>([]);
  const isFlushingRef = useRef<boolean>(false);

  const triggerFlush = async () => {
    if (isFlushingRef.current || flushQueueRef.current.length === 0) return;
    isFlushingRef.current = true;

    const chunkToFlush = [...flushQueueRef.current];
    flushQueueRef.current = flushQueueRef.current.slice(chunkToFlush.length);

    try {
      await SupabaseService.insertProctoringEvents(chunkToFlush);
      console.log(`[ProctoringFlush] Successfully flushed ${chunkToFlush.length} events to database.`);
    } catch (err) {
      console.error("[ProctoringFlush] Failed to flush events, putting back in queue for retry:", err);
      flushQueueRef.current = [...chunkToFlush, ...flushQueueRef.current];
    } finally {
      isFlushingRef.current = false;
      if (flushQueueRef.current.length > 0) {
        triggerFlush();
      }
    }
  };

  const addViolationToQueue = (v: any) => {
    const payload = {
      session_id: sessionIdRef.current,
      candidate_name: candidate.name || 'Candidate',
      event_type: v.type,
      severity: v.severity > 5 ? 'High' : (v.severity > 2 ? 'Medium' : 'Low'),
      risk_points: v.severity > 5 ? 15 : (v.severity > 2 ? 5 : 1),
      message: v.message,
      snapshot_url: v.snapshot_url || null,
      clip_url: v.clip_url || null,
      occurred_at: new Date(v.timestamp).toISOString()
    };

    if (flushedEventIdsRef.current.has(v.id)) {
      if (v.snapshot_url || v.clip_url) {
        const queued = flushQueueRef.current.find(item => item.occurred_at === payload.occurred_at && item.event_type === payload.event_type);
        if (queued) {
          queued.snapshot_url = v.snapshot_url || queued.snapshot_url;
          queued.clip_url = v.clip_url || queued.clip_url;
        } else {
          SupabaseService.updateProctoringEventMedia(
            sessionIdRef.current,
            payload.event_type,
            payload.occurred_at,
            v.snapshot_url,
            v.clip_url
          ).catch(() => {});
        }
      }
      return;
    }

    flushedEventIdsRef.current.add(v.id);
    flushQueueRef.current.push(payload);
    console.log(`[ProctoringQueue] Queued violation: ${v.type}. Queue size: ${flushQueueRef.current.length}`);

    // Immediate flush for real-time dashboard updates & notifications
    triggerFlush();
  };

  const flushAllRemainingEvents = async () => {
    while (isFlushingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (flushQueueRef.current.length > 0) {
      isFlushingRef.current = true;
      const chunkToFlush = [...flushQueueRef.current];
      flushQueueRef.current = [];
      try {
        await SupabaseService.insertProctoringEvents(chunkToFlush);
        console.log(`[ProctoringFlush] Final flush of ${chunkToFlush.length} events completed successfully.`);
      } catch (err) {
        console.error("[ProctoringFlush] Final flush failed, keeping in queue for fallback:", err);
        flushQueueRef.current = [...chunkToFlush];
      } finally {
        isFlushingRef.current = false;
      }
    }
  };

  useEffect(() => {
    if (!sessionIdRef.current) {
      alert("Fatal Error: Interview session not found. Please restart the interview.");
      window.location.href = '/';
    }
  }, []);

  const mediaRef = useRef<InterviewMediaResources | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const rollingRecorderRef = useRef<RollingRecorder | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCalibrationComplete, setIsCalibrationComplete] = useState(false);
  // Stable identity so PreFlightCheck's effects (which depend on this
  // callback) aren't torn down/recreated on every re-render of this screen.
  const handleCalibrationReady = useCallback(() => {
    setIsCalibrationComplete(true);
  }, []);

  // New Phone Camera Proctoring Refs/State
  const providerRef = useRef<CameraProvider | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const [pairingQrUrl, setPairingQrUrl] = useState<string>('');
  const [pairingTokenExpiry, setPairingTokenExpiry] = useState<Date | null>(null);
  const [phonePreviewStream, setPhonePreviewStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  // Recovery overlay countdown (seconds remaining before FAILED)
  const [phoneReconnectCountdown, setPhoneReconnectCountdown] = useState<number | null>(null);
  const phoneReconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const proctoringRef = useRef(proctoring);

  useEffect(() => {
    proctoringRef.current = proctoring;
  }, [proctoring]);
  
  const heartbeatSamplesRef = useRef<{timestamp: number; fps: number}[]>([]);
  const latestHeartbeatRef = useRef<{fps: number, health: string}>({ fps: 0, health: 'GOOD' });

  // Dashboard Telemetry
  const defaultTelemetry: DashboardTelemetry = {
    faceDetected: false,
    trackingConfidence: 0,
    monitoringQualityScore: 0,
    gazeDirection: 'center',
    gazeDurationMs: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    fps: 0,
    facePosition: 'CENTERED',
    detectionHealth: 'INITIALIZING',
    lastUpdated: Date.now()
  };
  const telemetryRef = useRef<DashboardTelemetry>(defaultTelemetry);
  const [telemetry, setTelemetry] = useState<DashboardTelemetry>(defaultTelemetry);
  
  const healthStatsRef = useRef({
    totalFrames: 0,
    framesWithFace: 0,
    confidenceSum: 0,
    stalledPeriods: 0,
    longestNoFaceStart: null as number | null,
    longestNoFaceDurationMs: 0,
    longestGazeAwayStart: null as number | null,
    longestGazeAwayDurationMs: 0,
    currentGazeDirection: 'center' as string,
    currentGazeDirectionStart: Date.now() as number
  });

  useEffect(() => {
    // 300ms Sampling for UI stability (no hidden state machine)
    const interval = setInterval(() => {
      setTelemetry(telemetryRef.current);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // 1. Initialize Proctoring Media
  useEffect(() => {
    const checkBrowserSupport = (): boolean => {
      const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
      const hasWebGL = (() => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
        } catch { return false; }
      })();
      return hasGetUserMedia && hasWebGL;
    };

    if (!checkBrowserSupport()) {
      dispatch({ type: 'SET_UNSUPPORTED_BROWSER' });
      return;
    }

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

            mediaRef.current = {
              stream: audioStream,
              videoTrack: null as any,
              audioTrack,
            };
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

        // For local webcam provider: wire up the preview stream
        const stream = provider.getPreviewStream();
        if (stream) {
          setPreviewStream(stream);
          mediaRef.current = {
            stream,
            videoTrack: stream.getVideoTracks()[0],
            audioTrack: stream.getAudioTracks()[0],
          };

          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            wireAudioTrack(audioTrack);
          }

          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.addEventListener('ended', () => {
              ErrorLogService.logError('proctoring', "Camera track ended unexpectedly", undefined, sessionIdRef.current, candidate.name);
              dispatch({ type: 'CAMERA_LOST' });
            });
          }

          rollingRecorderRef.current = new RollingRecorder(stream);
          rollingRecorderRef.current.start();
        }

        setCameraReady(true);

      } catch (err: any) {
        console.warn("[CameraProvider] Primary provider failed, trying fallback...", err);

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

            mediaRef.current = {
              stream: audioStream,
              videoTrack: null as any,
              audioTrack,
            };

            setCameraReady(true);

          } catch (fallbackErr: any) {
            console.error("[CameraProvider] Fallback initialization failed:", fallbackErr);
            ErrorLogService.logError('proctoring', `Fallback initialization failed: ${fallbackErr.message || fallbackErr}`, fallbackErr, sessionIdRef.current, candidate.name);
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

            const stats = healthStatsRef.current;
            stats.totalFrames++;
            if (frame.faceDetected) {
              stats.framesWithFace++;
              stats.confidenceSum += frame.trackingConfidence;
              if (stats.longestNoFaceStart !== null) {
                const duration = Date.now() - stats.longestNoFaceStart;
                if (duration > stats.longestNoFaceDurationMs) stats.longestNoFaceDurationMs = duration;
                stats.longestNoFaceStart = null;
              }
            } else if (stats.longestNoFaceStart === null) {
              stats.longestNoFaceStart = Date.now();
            }

            const isAway = frame.gazeDirection !== 'center' || Math.abs(frame.headYaw) > 30 || frame.facePosition === 'PARTIAL_OUT';

            if (isAway && frame.faceCount > 0) {
              if (stats.longestGazeAwayStart === null) stats.longestGazeAwayStart = Date.now();
            } else {
              if (stats.longestGazeAwayStart !== null) {
                const duration = Date.now() - stats.longestGazeAwayStart;
                if (duration > stats.longestGazeAwayDurationMs) stats.longestGazeAwayDurationMs = duration;
                stats.longestGazeAwayStart = null;
              }
            }

            if (frame.gazeDirection !== stats.currentGazeDirection) {
              stats.currentGazeDirection = frame.gazeDirection;
              stats.currentGazeDirectionStart = Date.now();
            }
            const gazeDurationMs = Date.now() - stats.currentGazeDirectionStart;

            const fpsVal = latestHeartbeatRef.current.fps;
            const fpsScore = Math.min(100, Math.max(0, (fpsVal / 24) * 100));
            const facePresenceScore = frame.faceDetected ? 100 : 0;
            const monitoringQualityScore = Math.round(
              (frame.trackingConfidence * 0.6) +
              (fpsScore * 0.2) +
              (facePresenceScore * 0.2)
            );

            telemetryRef.current = {
              faceDetected: frame.faceDetected,
              trackingConfidence: frame.trackingConfidence,
              monitoringQualityScore,
              gazeDirection: frame.gazeDirection,
              gazeDurationMs,
              headPitch: frame.headPitch,
              headYaw: frame.headYaw,
              headRoll: frame.headRoll,
              fps: latestHeartbeatRef.current.fps,
              facePosition: frame.facePosition,
              detectionHealth: latestHeartbeatRef.current.health as any,
              lastUpdated: Date.now()
            };
          },
          onHeartbeat: (metrics) => {
            latestHeartbeatRef.current = {
              fps: metrics.fps,
              health: metrics.detectionHealth,
            };
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

              // Update phone preview stream — picks up WebRTC remote video when it arrives
              const stream = providerRef.current.getPreviewStream();
              setPhonePreviewStream(stream);

              // Start countdown overlay when entering RECONNECTING
              if (stateVal === 'RECONNECTING') {
                if (!phoneReconnectTimerRef.current) {
                  // DISCONNECT_TIMEOUT_MS = 20s, RECONNECT_TIMEOUT_MS = 9s → ~11s window shown
                  let secondsLeft = 11;
                  setPhoneReconnectCountdown(secondsLeft);
                  phoneReconnectTimerRef.current = setInterval(() => {
                    secondsLeft--;
                    if (secondsLeft <= 0) {
                      clearInterval(phoneReconnectTimerRef.current!);
                      phoneReconnectTimerRef.current = null;
                      setPhoneReconnectCountdown(null);
                    } else {
                      setPhoneReconnectCountdown(secondsLeft);
                    }
                  }, 1000);
                }
              } else if (stateVal === 'CONNECTED') {
                // Phone recovered — clear countdown
                if (phoneReconnectTimerRef.current) {
                  clearInterval(phoneReconnectTimerRef.current);
                  phoneReconnectTimerRef.current = null;
                }
                setPhoneReconnectCountdown(null);
              }
            }
          },
          onMediaUploaded: (violationId, snapshotUrl, clipUrl) => {
            dispatch({ type: 'UPDATE_VIOLATION_MEDIA', id: violationId, snapshotUrl, clipUrl });
            
            const currentViolations = proctoringRef.current?.violations || [];
            const violation = currentViolations.find(v => v.id === violationId);
            if (violation) {
              addViolationToQueue({
                ...violation,
                snapshot_url: snapshotUrl || undefined,
                clip_url: clipUrl || undefined
              });
            }
          }
        });
      }
    };

    initMediaAndDevice();

    return () => {
      mounted = false;
      if (rollingRecorderRef.current) {
        rollingRecorderRef.current.destroy();
        rollingRecorderRef.current = null;
      }
      if (providerRef.current) {
        providerRef.current.dispose();
        providerRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
      if (mediaRef.current) {
        mediaRef.current.stream.getTracks().forEach(t => t.stop());
        mediaRef.current = null;
      }
      // Clean up any running reconnect countdown
      if (phoneReconnectTimerRef.current) {
        clearInterval(phoneReconnectTimerRef.current);
        phoneReconnectTimerRef.current = null;
      }
    };
  }, []);

  // Handle Violations: Upload snapshots and clips
  const prevViolationsLengthRef = useRef(0);
  useEffect(() => {
    if (proctoring.violations.length > prevViolationsLengthRef.current) {
      const newViolations = proctoring.violations.slice(prevViolationsLengthRef.current);
      prevViolationsLengthRef.current = proctoring.violations.length;

      const sessionStrId = candidate.email.replace(/[^a-zA-Z0-9]/g, '');

      newViolations.forEach(async (violation) => {
        if (proctoring.cameraProvider === 'phone_camera') {
          // Request media capture from phone companion
          if (providerRef.current && providerRef.current.type === 'phone_camera') {
            (providerRef.current as PhoneCameraProvider).requestViolationCapture(violation.id);
          }
          return;
        }

        let snapshotUrl = null;
        let clipUrl = null;
        try {
          if (videoElRef.current) {
            try {
              // Wait for video to be ready (readyState >= 2)
              const video = videoElRef.current;
              if (video.readyState < 2) {
                await new Promise<void>((resolve) => {
                  const handler = () => { video.removeEventListener('canplay', handler); resolve(); };
                  video.addEventListener('canplay', handler);
                  setTimeout(resolve, 3000); // max wait 3 seconds
                });
              }
              const snapshotBlob = await MediaCaptureService.captureSnapshot(videoElRef.current);
              snapshotUrl = await uploadProctoringSnapshot(
                sessionIdRef.current ?? sessionStrId,
                violation.id,
                snapshotBlob
              );
            } catch (snapErr) {
              console.error('[MediaCapture] Snapshot failed:', snapErr);
            }
          }

          if (rollingRecorderRef.current) {
            // Wait up to 3 seconds for a segment to be available
            let clipBlob = await rollingRecorderRef.current.captureClip();
            
            if (!clipBlob) {
              // Recorder hasn't finished a segment yet — wait and retry
              await new Promise(resolve => setTimeout(resolve, 2000));
              clipBlob = await rollingRecorderRef.current?.captureClip() ?? null;
            }

            if (clipBlob) {
              rollingRecorderRef.current?.resume(); // Resume recording immediately
              clipUrl = await uploadProctoringClip(
                sessionIdRef.current ?? sessionStrId,
                violation.id,
                clipBlob
              );
            }
          }

          dispatch({ type: 'UPDATE_VIOLATION_MEDIA', id: violation.id, snapshotUrl, clipUrl });

          console.log(`[MediaCapture] Violation media uploaded for ${violation.type}: snapshot=${snapshotUrl}, clip=${clipUrl}`);

        } catch (err) {
          console.error("Failed to capture violation media:", err);
        } finally {
          addViolationToQueue({
            ...violation,
            snapshot_url: snapshotUrl || undefined,
            clip_url: clipUrl || undefined
          });
        }
      });
    }
  }, [proctoring.violations, proctoring.cameraProvider, candidate.email]);

  // Handle Timeline Events: Queue them as they are logged
  const prevTimelineLengthRef = useRef(0);
  useEffect(() => {
    if (proctoring.timeline.length > prevTimelineLengthRef.current) {
      const newEvents = proctoring.timeline.slice(prevTimelineLengthRef.current);
      prevTimelineLengthRef.current = proctoring.timeline.length;

      newEvents.forEach((t: TimelineEvent) => {
        if (t.id && !flushedEventIdsRef.current.has(t.id)) {
          flushedEventIdsRef.current.add(t.id);

          const payload = {
            session_id: sessionIdRef.current,
            candidate_name: candidate.name || 'Candidate',
            event_type: t.event,
            severity: t.severity > 5 ? 'High' : (t.severity > 2 ? 'Medium' : 'Low'),
            risk_points: t.severity > 5 ? 10 : (t.severity > 2 ? 5 : 1),
            message: t.detail || t.event,
            snapshot_url: null,
            clip_url: null,
            occurred_at: new Date(t.timestamp).toISOString()
          };

          flushQueueRef.current.push(payload);
          console.log(`[ProctoringQueue] Queued timeline event: ${t.event}. Queue size: ${flushQueueRef.current.length}`);
        }
      });

      if (flushQueueRef.current.length > 0) {
        triggerFlush();
      }
    }
  }, [proctoring.timeline, candidate.name]);

  // Periodic 30-second database flush
  useEffect(() => {
    const timer = setInterval(() => {
      if (flushQueueRef.current.length > 0 && !isFlushingRef.current) {
        console.log(`[ProctoringFlush] 30s periodic flush triggered. Queue size: ${flushQueueRef.current.length}`);
        triggerFlush();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // 2. Setup System Event Listeners
  useEffect(() => {
    const handleVis = () => {
      if (!hasStartedRef.current) return;
      if (document.hidden) {
        ErrorLogService.logError('proctoring', "Tab switch: the candidate navigated away from the interview tab", undefined, sessionIdRef.current, candidate.name);
        dispatch({ type: 'TAB_HIDDEN', trigger: 'visibilitychange' });
      }
    };
    const handleBlur = () => {
      if (!hasStartedRef.current) return;
      ErrorLogService.logError('proctoring', "Window focus lost: the candidate switched to another window or application", undefined, sessionIdRef.current, candidate.name);
      dispatch({ type: 'TAB_HIDDEN', trigger: 'blur' });
    };
    const handleFullscreen = () => { 
      if (!hasStartedRef.current) return;
      const full = isFullscreenActive();
      setIsFullscreen(full);
      if (!full) {
        ErrorLogService.logError('proctoring', "Fullscreen mode exited", undefined, sessionIdRef.current, candidate.name);
        dispatch({ type: 'FULLSCREEN_EXIT' });
      }
    };
    const handleClipboard = (e: any) => {
      if (!hasStartedRef.current) return;
      // e.type is already 'copy' | 'cut' | 'paste' — it was being logged but discarded before
      // reaching the violation record, so every clipboard event read as "Clipboard action
      // detected" on the report regardless of which one it was.
      const clipboardAction = String(e?.type || '').toLowerCase() as 'copy' | 'cut' | 'paste';
      ErrorLogService.logError('proctoring', `Clipboard ${clipboardAction || 'activity'}: the candidate attempted to ${clipboardAction || 'use the clipboard'}`, undefined, sessionIdRef.current, candidate.name);
      dispatch({ type: 'COPY_PASTE', clipboardAction });
    };
    const hasTerminatedOnExitRef = { current: false };
    const handlePageHide = () => {
      if (!hasStartedRef.current || hasTerminatedOnExitRef.current) return;
      const answeredCount = (historyRef.current || []).filter((h: any) => h?.answer && String(h.answer).trim().length > 0).length;
      if (answeredCount === 0 && sessionIdRef.current) {
        hasTerminatedOnExitRef.current = true;
        SupabaseService.completeSession(sessionIdRef.current, 0, "TERMINATED", 0, "EXITED_WITHOUT_ANSWERING").catch(() => {});
      }
    };

    const handleUnload = (e: any) => {
      if (!hasStartedRef.current) return;
      handlePageHide();
      ErrorLogService.logError('proctoring', "Page unload/refresh attempted", undefined, sessionIdRef.current, candidate.name);
      dispatch({ type: 'REFRESH_ATTEMPT' });
      e.preventDefault();
      e.returnValue = '';
    };
    const handleOffline = () => {
      ErrorLogService.logError('system', "Network connectivity lost", undefined, sessionIdRef.current, candidate.name);
      dispatch({ type: 'NETWORK_LOST' });
    };
    const handleOnline = () => {
      ErrorLogService.logError('system', "Network connectivity restored", undefined, sessionIdRef.current, candidate.name);
      dispatch({ type: 'NETWORK_RECOVERED' });
    };
    
    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('copy', handleClipboard);
    document.addEventListener('paste', handleClipboard);
    document.addEventListener('cut', handleClipboard);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    const interval = setInterval(() => dispatch({ type: 'DECAY_RISK' }), 30000);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('copy', handleClipboard);
      document.removeEventListener('paste', handleClipboard);
      document.removeEventListener('cut', handleClipboard);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, []);

  // Phase 1: Load Configuration (On Mount / Candidate Change)
  useEffect(() => {
    let mounted = true;
    const loadInterviewConfiguration = async () => {
      try {
        const globalMode = await SupabaseService.getSystemSettings("evaluation_mode");
        const candidateSnapshotMode = (candidate as any).evaluationMode || candidate.session?.configured_evaluation_mode;
        const activeMode = resolveEvaluationMode(globalMode, candidateSnapshotMode, sessionIdRef.current);

        console.log("🚀 [Phase 1 Load Config] Active Mode:", activeMode);
        if (mounted) {
          setEvaluationMode(activeMode);
          setConfigurationReady(true);
        }
      } catch (err) {
        console.warn("Failed to load interview config, falling back to default:", err);
        if (mounted) {
          setEvaluationMode(DEFAULT_EVALUATION_MODE);
          setConfigurationReady(true);
        }
      }
    };

    loadInterviewConfiguration();

    return () => {
      mounted = false;
    };
  }, [candidate.email, candidate.role, candidate.jobPostId]);

  // Phase 2: Prepare Interview (When Configuration is Ready)
  useEffect(() => {
    if (!configurationReady) return;
    if (isPrepared) return;

    let mounted = true;
    const prepareInterview = async () => {
      console.log('[prepareInterview] candidate.role:', candidate.role, '| candidate.evaluationMode:', (candidate as any).evaluationMode);
      
      try {
        setLoading(true);
        setLoadingText("Preparing your interview session...");

        // 1. Check for saved state (recovery)
        const savedStateStr = localStorage.getItem('reicrew_autosave_' + sessionIdRef.current);
        if (savedStateStr) {
          try {
            const savedState = JSON.parse(savedStateStr);
            if (savedState.candidate?.role !== candidate.role) {
              console.log('[Autosave] Role mismatch, clearing stale autosave');
              localStorage.removeItem('reicrew_autosave_' + sessionIdRef.current);
              // fall through to fresh load
            } 
            else if (savedState.questions && savedState.questions.length > 0) {
              if (!mounted) return;
              
              // Ensure recovered questions have IDs
              const recoveredQuestions = savedState.questions.map((q: any) => ({
                ...q,
                id: q.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
              }));

              const activeEvalMode = resolveEvaluationMode(evaluationMode, savedState.evaluationMode);
              setQuestions(recoveredQuestions);
              setCurrentIndex(savedState.currentIndex || 0);
              updateHistory(savedState.history || []);
              setEvaluationMode(activeEvalMode);
              if (savedState.transcript) {
                setTimeout(() => {
                  if (mounted) setTranscript(savedState.transcript);
                }, 100);
              }
              
              contextRef.current = {
                mode: activeEvalMode,
                configuration: { mode: activeEvalMode, engineId: 'api-v1', version: '1.0.0', followupThreshold: 8.0, weights: { Critical: 70, Important: 20, NiceToHave: 10 } },
                candidate: candidate,
                jobSettings: jobSettingsRef.current || { title: candidate.role },
                questionQueue: recoveredQuestions,
                currentQuestion: recoveredQuestions[savedState.currentIndex || 0],
                answerHistory: savedState.history || [],
                metadata: { sessionId: sessionIdRef.current, source: 'DynamicInterviewScreen' }
              };
              setInterviewContext(contextRef.current);
              
              setIsPrepared(true);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn("Failed to parse recovery state", e);
          }
        }

        // 2. Load job post questions/settings
        let interviewQuestions: Question[] = [];
        let jobSettings: any = null;

        if (candidate.jobPostId) {
          try {
            const job = await SupabaseService.getJobById(candidate.jobPostId);
            if (job) {
              jobSettings = job.settings;
              jobSettingsRef.current = jobSettings;
              if (job.questions) {
                interviewQuestions = typeof job.questions === 'string' ? JSON.parse(job.questions) : job.questions;
                console.log("Loaded questions from database job post:", job.title, interviewQuestions.length);
              }
            }
          } catch (dbErr: any) {
            console.error("Failed to load questions from database job post:", dbErr);
            ErrorLogService.logError('interview', `Failed to load questions for job post ${candidate.jobPostId}: ${dbErr.message || dbErr}`, dbErr, sessionIdRef.current, candidate.name);
          }
        }

        // Load fallback static questions if no DB questions found
        if (interviewQuestions.length === 0) {
          const safeRole = candidate.role || 'general';
          console.log('[prepareInterview] calling getQuestionsForRole with:', safeRole);
          interviewQuestions = getQuestionsForRole(safeRole);
          console.log('[prepareInterview] total questions:', interviewQuestions.length);
          if (!candidate.role) {
            console.warn('[prepareInterview] candidate.role is undefined, falling back to "general"');
          }
          interviewQuestions = getQuestionsForRole(safeRole);
          console.log('[prepareInterview] total questions:', interviewQuestions.length);
          console.log('[prepareInterview] first 3 questions:', interviewQuestions.slice(0,3).map(q => q.question));
        }

        let newBranch: ComposedInterview;
        if (interviewQuestions && interviewQuestions.length > 0) {
          newBranch = AIService.composeInterviewFromList(interviewQuestions,
          { ...jobSettings, role: candidate.role });
        } else {
          newBranch = AIService.composeInterview(candidate.role as any, jobSettings);
        }
        if (!mounted) return;
        setBranch(newBranch);
        
        const firstStep = newBranch.steps[0];
        const firstQuestion = firstStep?.isAdaptive 
          ? firstStep.adaptiveQuestions?.medium 
          : firstStep?.question;

        if (!firstQuestion) {
          throw new Error("Composed interview has no valid first question.");
        }

        // Extract all questions properly handling adaptive steps
        const extractedQuestions = newBranch.steps.map(s => 
          s.isAdaptive ? (s.adaptiveQuestions?.medium || s.question) : s.question
        ).filter(Boolean) as Question[];

        const activeEvalMode = resolveEvaluationMode(evaluationMode, null);
        contextRef.current = {
          mode: activeEvalMode,
          configuration: { mode: activeEvalMode, engineId: 'api-v1', version: '1.0.0', followupThreshold: 8.0, weights: { Critical: 70, Important: 20, NiceToHave: 10 } },
          candidate: candidate,
          jobSettings: jobSettingsRef.current || { title: candidate.role },
          questionQueue: extractedQuestions,
          currentQuestion: firstQuestion,
          answerHistory: [],
          metadata: { sessionId: sessionIdRef.current, source: 'DynamicInterviewScreen' }
        };
        setInterviewContext(contextRef.current);

        setQuestions([firstQuestion]);
        setIsPrepared(true);
        setLoading(false);
      } catch (err: any) {
        console.error("Interview preparation failed:", err);
        ErrorLogService.logError('interview', `Interview preparation failed: ${err.message || err}`, err, sessionIdRef.current, candidate.name);
        if (mounted) {
          setIsPrepared(true);
          setLoading(false);
        }
      }
    };

    prepareInterview();

    return () => {
      mounted = false;
    };
  }, [configurationReady, isPrepared, candidate.role, candidate.jobPostId]);

  // Cancel speech synthesis on component unmount and abort any active requests
  useEffect(() => {
    return () => {
      synthRef.current?.cancel();
      if (activeRequestControllerRef.current) {
        activeRequestControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-save interview metadata immediately (discrete changes)
  useEffect(() => {
    if (hasStarted && questions.length > 0) {
      const currentSave = localStorage.getItem('reicrew_autosave_' + sessionIdRef.current);
      let currentSaveObj = {};
      try {
        if (currentSave) currentSaveObj = JSON.parse(currentSave);
      } catch {
        // Intentional: a corrupt autosave blob must never interrupt a live interview. Merging
        // starts from an empty object and the write below replaces the bad entry outright.
      }

      localStorage.setItem('reicrew_autosave_' + sessionIdRef.current, JSON.stringify({
        ...currentSaveObj,
        sessionId: sessionIdRef.current,
        currentIndex,
        questions,
        history,
        evaluationMode
      }));
    }
  }, [currentIndex, hasStarted, questions, history, evaluationMode]);

  // Debounced transcript auto-save (prevents rapid writing to disk on every spoken word/keystroke)
  useEffect(() => {
    if (!hasStarted || questions.length === 0) return;

    const timer = setTimeout(() => {
      const currentSave = localStorage.getItem('reicrew_autosave_' + sessionIdRef.current);
      let currentSaveObj = {};
      try {
        if (currentSave) currentSaveObj = JSON.parse(currentSave);
      } catch {
        // Intentional — same reasoning as the metadata autosave above: a bad blob is discarded
        // and overwritten rather than being allowed to break transcript persistence.
      }

      localStorage.setItem('reicrew_autosave_' + sessionIdRef.current, JSON.stringify({
        ...currentSaveObj,
        transcript
      }));
    }, 1500);

    return () => clearTimeout(timer);
  }, [transcript, hasStarted, questions.length]);

  // Handle offline sync warning
  useEffect(() => {
    const handleOffline = () => {
       // Alerting user of offline state
       console.warn("Connection lost. Responses are being stored locally.");
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

    const triggerTermination = async (reason: string) => {
    if (isProcessingRef.current || pipelineCompleted) return;
    enqueueToast(`Interview Terminated: ${reason}`, 'danger', `termination_${Date.now()}`);
    setIsProcessing(true);
    isProcessingRef.current = true;
    setLoadingText("Awaiting background evaluations...");
    setLoading(true);
    stopListening();
    
    setTimeout(async () => {
        const bgPromises = Object.values(bgEvalsRef.current);
        await Promise.allSettled(bgPromises);

        setLoadingText("Terminating interview...");
        await flushAllRemainingEvents();
        const proctoringReport = compileReport(true, reason);
        
        let completionResult = null;
        try {
          // Phase 2 Architecture: evaluationMode state is already initialized from the immutable snapshot.
          const activeEvalMode = evaluationMode || EvaluationMode.API;

          console.log("🛑 [Termination] Mode:", activeEvalMode);

          // Map historyRef to AnswerRecord shape for the ReportGenerator
          const mappedHistory = historyRef.current.map((h: any, idx: number) => ({
            questionId: h.questionData?.id || idx,
            questionText: h.question,
            transcript: h.answer,
            evaluation: h.evaluation,
            isFollowUp: !!h.questionData?.isFollowUp,
            topic: h.category
          }));

          completionResult = await EvaluationDispatcher.getInstance().finalizeInterview(
            sessionIdRef.current,
            mappedHistory,
            proctoringReport,
            activeEvalMode
          );
        } catch (e) {
          console.error("Evaluation failed during termination:", e);
        }
        onComplete(historyRef.current, proctoringReport, completionResult);
    }, 100);
  };
  const checkProctoringThresholds = () => {
    if (!hasStarted || isProcessingRef.current) return;
    const settings = proctoring.settings || DEFAULT_PROCTORING_SETTINGS;

    // 1. Count-based checks
    const tabSwitchCount = proctoring.violations.filter(v => v.type === 'TAB_HIDDEN').length;
    const multipleFacesCount = proctoring.violations.filter(v => v.type === 'MULTIPLE_FACES').length;
    const copyPasteCount = proctoring.violations.filter(v => v.type === 'COPY_PASTE').length;
    const fullscreenExitCount = proctoring.violations.filter(v => v.type === 'FULLSCREEN_EXIT').length;

    // 2. Duration-based checks
    const faceMissingDuration = proctoring.noFaceStartTime ? (Date.now() - proctoring.noFaceStartTime) / 1000 : 0;
    const cameraOffDuration = cameraOffStartTimeRef.current ? (Date.now() - cameraOffStartTimeRef.current) / 1000 : 0;
    const micOffDuration = micOffStartTimeRef.current ? (Date.now() - micOffStartTimeRef.current) / 1000 : 0;

    // --- TERMINATION CHECKS ---
    const isPracticeMode = candidate.session?.interview_metadata?.practice?.is_practice === true;
      if (!isPracticeMode) {
      if (tabSwitchCount >= settings.tabSwitchTerminateCount) {
        triggerTermination(`Too many tab switches (${tabSwitchCount}/${settings.tabSwitchTerminateCount}).`);
        return;
      }
      if (multipleFacesCount >= settings.multipleFacesTerminateCount) {
        triggerTermination(`Multiple faces detected too many times (${multipleFacesCount}/${settings.multipleFacesTerminateCount}).`);
        return;
      }
      if (fullscreenExitCount >= settings.fullscreenExitTerminateCount) {
        triggerTermination(`Exited fullscreen mode too many times (${fullscreenExitCount}/${settings.fullscreenExitTerminateCount}).`);
        return;
      }
      if (faceMissingDuration >= settings.faceMissingTerminateSec) {
        triggerTermination(`Face missing for more than ${settings.faceMissingTerminateSec} seconds.`);
        return;
      }
      if (cameraOffDuration >= settings.cameraOffTerminateSec) {
        triggerTermination(`Camera disconnected/turned off for more than ${settings.cameraOffTerminateSec} seconds.`);
        return;
      }
      if (micOffDuration >= settings.micOffTerminateSec) {
        triggerTermination(`Microphone muted/turned off for more than ${settings.micOffTerminateSec} seconds.`);
        return;
      }
  }

    // --- WARNING CHECKS ---
    if (tabSwitchCount > lastToastedCountsRef.current.tabSwitch && tabSwitchCount >= settings.tabSwitchWarningCount) {
      lastToastedCountsRef.current.tabSwitch = tabSwitchCount;
      enqueueToast(
        `Tab switch detected — you navigated away from the interview tab. Total: ${tabSwitchCount}/${settings.tabSwitchTerminateCount}. Please stay on this screen.`,
        'danger',
        `tabswitch_${tabSwitchCount}`
      );
    }
    else if (multipleFacesCount > lastToastedCountsRef.current.multiFace && multipleFacesCount >= settings.multipleFacesWarningCount) {
      lastToastedCountsRef.current.multiFace = multipleFacesCount;
      enqueueToast(
        `Multiple faces in frame — more than one person is visible to the camera. Total: ${multipleFacesCount}/${settings.multipleFacesTerminateCount}. Only you should be in view.`,
        'danger',
        `multiface_${multipleFacesCount}`
      );
    }
    else if (copyPasteCount > lastToastedCountsRef.current.copyPaste && copyPasteCount > 0) {
      lastToastedCountsRef.current.copyPaste = copyPasteCount;
      const lastClipboard = [...proctoring.violations].reverse().find(v => v.type === 'COPY_PASTE');
      enqueueToast(
        `${lastClipboard?.message || 'Clipboard activity detected'}. Total: ${copyPasteCount}. Copying or pasting during the interview is recorded.`,
        'danger',
        `copypaste_${copyPasteCount}`
      );
    }
    else if (fullscreenExitCount > lastToastedCountsRef.current.fullscreen && fullscreenExitCount >= settings.fullscreenExitWarningCount) {
      lastToastedCountsRef.current.fullscreen = fullscreenExitCount;
      enqueueToast(
        `Warning: Fullscreen mode exited. Total: ${fullscreenExitCount}/${settings.fullscreenExitTerminateCount}. Please return to fullscreen.`,
        'danger',
        `fullscreen_${fullscreenExitCount}`
      );
    }
    else if (faceMissingDuration >= settings.faceMissingWarningSec && !warnedNoFaceRef.current) {
      enqueueToast(
        `Warning: Please make sure your face is clearly visible. Face missing for ${Math.round(faceMissingDuration)}s.`,
        'warning',
        'facemissing'
      );
      warnedNoFaceRef.current = true;
    }
    else if (cameraOffDuration >= settings.cameraOffWarningSec && !warnedCameraOffRef.current) {
      enqueueToast(
        `Warning: Camera turned off or feed blocked for ${Math.round(cameraOffDuration)}s. Please turn your camera back on.`,
        'warning',
        'cameraoff'
      );
      warnedCameraOffRef.current = true;
    }
    else if (micOffDuration >= settings.micOffWarningSec && !warnedMicOffRef.current) {
      enqueueToast(
        `Warning: Microphone is off or muted for ${Math.round(micOffDuration)}s. Please unmute your microphone.`,
        'warning',
        'micoff'
      );
      warnedMicOffRef.current = true;
    }
  };

  // Periodic 1-second check for camera/mic off and general proctoring warnings/terminations
  useEffect(() => {
    if (!hasStarted) return;
    
    const interval = setInterval(() => {
      // 1. Check camera track state
      let isCameraOff = false;
      if (proctoring.cameraProvider === 'none') {
        isCameraOff = false;
      } else if (proctoring.cameraProvider === 'phone_camera') {
        // In phone camera mode, camera is off if phone is not connected
        isCameraOff = proctoring.phoneConnectionState !== 'CONNECTED';
      } else {
        const videoTrack = mediaRef.current?.videoTrack;
        isCameraOff = !videoTrack || !videoTrack.enabled || videoTrack.readyState === 'ended' || (videoTrack as any).muted;
      }
      
      if (isCameraOff) {
        if (cameraOffStartTimeRef.current === null) {
          cameraOffStartTimeRef.current = Date.now();
        }
      } else {
        cameraOffStartTimeRef.current = null;
        warnedCameraOffRef.current = false;
      }

      // 2. Check microphone track state
      const audioTrack = mediaRef.current?.audioTrack;
      const isMicOff = !audioTrack || !audioTrack.enabled || audioTrack.readyState === 'ended' || audioTrack.muted;
      
      if (isMicOff) {
        if (micOffStartTimeRef.current === null) {
          micOffStartTimeRef.current = Date.now();
        }
      } else {
        micOffStartTimeRef.current = null;
        warnedMicOffRef.current = false;
      }

      // 3. Reset face missing warning ref if face is present
      if (proctoring.noFaceStartTime === null) {
        warnedNoFaceRef.current = false;
      }

      // 4. Run warning and termination checks against settings
      checkProctoringThresholds();
    }, 1000);

    return () => clearInterval(interval);
  }, [hasStarted, proctoring.noFaceStartTime, proctoring.violations, proctoring.settings]);

  const speakQuestion = (text: string, onEnd?: () => void) => {
    speak(text, { onEnd });
  };

  const toggleMic = () => {
    if (!isSupported) {
        alert("Speech recognition is not supported on this device/browser. Please type your answer directly.");
        setIsEditing(true);
        return;
    }
    if (isListening) {
      if (sttStartTimeRef.current !== null) {
        sttCapturedDurationRef.current = performance.now() - sttStartTimeRef.current;
        sttStartTimeRef.current = null;
      }
      stopListening();
    } else {
      sttStartTimeRef.current = performance.now();
      sttCapturedDurationRef.current = 0;
      startListening(currentQ?.id);
    }
  };
//Start
const handleNext = async () => {
  const answerText = (liveTranscript || transcript).trim();
  if (!answerText || isSpeaking || isProcessingRef.current) return;
  const validation = TranscriptValidator.validate(answerText);
  if (!validation.isValid) {
    alert(`We couldn't clearly hear your answer: ${validation.reason}. Please try answering the question again.`);
    // Don't transition to processing. Let the user retry.
    return;
  }
  if (!navigator.onLine) {
    alert("Connection lost. Please wait until your connection is restored to submit your answer.");
    return;
  }

  // Update legacy state for compatibility
  isProcessingRef.current = true;
  setIsProcessing(true);

  // Stop recording and finalize STT duration
  if (isListening && sttStartTimeRef.current !== null) {
    sttCapturedDurationRef.current = performance.now() - sttStartTimeRef.current;
    sttStartTimeRef.current = null;
  }
  sttDurationRef.current = sttCapturedDurationRef.current;
  sttCapturedDurationRef.current = 0;

  stopListening();
  setTranscript(answerText);

  // Set timing markers
  transitionStartRef.current = performance.now();
  if (questions[currentIndex]) {
    activeQuestionIdRef.current = questions[currentIndex].id;
  }
  isTransitioningRef.current = true;

  setLoadingText("Analyzing your answer...");
  setLoading(true);

  try {
    const llmStart = performance.now();
    // Submit to new controller pipeline
    if (submitTranscript) {
      lastSubmittedTranscriptRef.current = answerText;
      submittedQuestionRef.current = questions[currentIndex]?.question || '';      
      submittedIdealAnswerRef.current = questions[currentIndex]?.ideal_answer || '';  
      await submitTranscript(answerText);
    }
    llmDurationRef.current = performance.now() - llmStart;
    
    if (controller?.state === 'COMPLETED' || pipelineCompleted) {
      setLoadingText("Finalizing your interview report...");
      isProcessingRef.current = false;
      setLoading(false);
      
      const proctoringReport = compileReport(false);
      const finalResult = (controller as any)?.completionResult || completionResultRef?.current || pipelineCompletionResult;
      onComplete(historyRef.current, proctoringReport, finalResult);
      return;
    }

    // On success, clear the input
    resetTranscript();
    setIsEditing(false);
    setLoading(false);
    setIsProcessing(false);
    isProcessingRef.current = false;
  } catch (err: any) {
    console.error("Submission failed", err);
    ErrorLogService.logError('interview', `Submission failed: ${err}`, err, sessionIdRef.current, candidate?.name);
    setIsProcessing(false);
    isProcessingRef.current = false;
    setLoading(false);
  }
}; // ← This closes the handleNext function

 const compileReport = (isTerminated = false, terminationReason?: string): ProctoringReport => {
  const now = Date.now();
  const p = proctoringRef.current; // ← use ref, not stale closure state

  const violations = p.violations.map(v => ({ ...v, sessionId: sessionIdRef.current }));
  const timeline = p.timeline.map(t => ({ ...t, sessionId: sessionIdRef.current }));

  return {
    sessionId: sessionIdRef.current,
    currentRiskScore: p.currentRiskScore,
    overallRiskScore: p.overallRiskScore,
    noFaceEvents: violations.filter(v => v.type === 'NO_FACE').length,
    gazeAwayEvents: violations.filter(v => v.type === 'GAZE_AWAY').length,
    multipleFaceEvents: violations.filter(v => v.type === 'MULTIPLE_FACES').length,
    tabSwitchEvents: violations.filter(v => v.type === 'TAB_HIDDEN').length,
    fullscreenExitEvents: violations.filter(v => v.type === 'FULLSCREEN_EXIT').length,
    copyPasteEvents: violations.filter(v => v.type === 'COPY_PASTE').length,
    microphoneLostEvents: violations.filter(v => v.type === 'MICROPHONE_LOST').length,
    violationScore: p.violationScore,
    integrityScore: Math.max(0, 100 - p.violationScore * 10),
    totalGazeAwayDurationMs: p.totalGazeAwayDurationMs,
    violations,
    timeline,
    flushedEventIds: Array.from(flushedEventIdsRef.current),
    sessionDurationMs: now - p.sessionStartTime,       // ← now fresh
    isTerminated,
    terminationReason,
    monitoringDurationMs: p.monitoringStartTime
      ? now - p.monitoringStartTime
      : 0,
    heartbeatCount: p.heartbeatCount,
    heartbeatSamples: heartbeatSamplesRef.current,
    cameraReconnectCount: p.cameraReconnectCount,
    maxConcurrentFaces: p.maxConcurrentFaces,
    browserInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    },
    healthSummary: {
      monitoringCoveragePercent: healthStatsRef.current.totalFrames > 0
        ? Math.round((healthStatsRef.current.framesWithFace / healthStatsRef.current.totalFrames) * 1000) / 10
        : 100,
      averageTrackingConfidence: healthStatsRef.current.totalFrames > 0
        ? Math.round(healthStatsRef.current.confidenceSum / healthStatsRef.current.totalFrames)
        : 100,
      totalDetectionFrames: healthStatsRef.current.totalFrames,
      stalledPeriods: healthStatsRef.current.stalledPeriods,
      longestNoFaceDurationMs: healthStatsRef.current.longestNoFaceDurationMs,
      longestGazeAwayDurationMs: healthStatsRef.current.longestGazeAwayDurationMs,
    },
  };
};

  const handleHeartbeat = (metrics: HeartbeatMetrics) => {
    dispatch({ type: 'HEARTBEAT', metrics });
    latestHeartbeatRef.current = { fps: metrics.fps, health: metrics.detectionHealth };
    
    if (metrics.fps === 0 || metrics.lastDetectionAgoMs > 2000) {
      healthStatsRef.current.stalledPeriods++;
    }

    heartbeatSamplesRef.current.push({
      timestamp: Date.now(),
      fps: metrics.fps
    });
  };

  // Rendering gates
  if (candidate?.role === 'APTITUDE') {
    return <AptitudeTestScreen candidate={candidate} onComplete={onComplete} />;
  }

  if (proctoring.engineState === 'UNSUPPORTED_BROWSER') {
    return (
      <div className="h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md text-center shadow-2xl border border-slate-700">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Browser Not Supported</h2>
          <p className="text-slate-300">This interview requires a modern browser with camera and WebGL support. Please use Chrome, Edge, or Firefox.</p>
        </div>
      </div>
    );
  }

  if (proctoring.engineState === 'PERMISSION_DENIED') {
    return (
      <div className="h-screen bg-[#0f172a] flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md text-center shadow-2xl border border-slate-700">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Permissions Denied</h2>
          <p className="text-slate-300 mb-6">We need camera and microphone access to conduct this interview. Please allow permissions and try again.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors">
            Reload Page
          </button>
        </div>
      </div>
    );
  }



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

  const currentQ = questions[currentIndex];
  const primaryCount = history.filter(h => !h.questionData?.isFollowUp).length;
  const totalQuestions = branch ? branch.steps.length : 10;
  const activePrimaryIndex = Math.min(totalQuestions, primaryCount + (currentQ?.isFollowUp ? 0 : 1));

  
  // ─── PIPELINE EVENT LISTENERS ───────────────────────────────────────
  
  // React to new questions
  useEffect(() => {
    if (pipelineCurrentQuestion && pipelineCurrentQuestion.id !== questions[currentIndex]?.id) {
      // Find or insert the question
      setQuestions(prev => {
        if (!prev.find(q => q.id === pipelineCurrentQuestion.id)) {
          const newQ = [...prev];
          newQ.splice(currentIndex + 1, 0, pipelineCurrentQuestion);
          return newQ;
        }
        return prev;
      });
      setCurrentIndex(prev => prev + 1);
      
      // Play TTS
      ttsStartRef.current = performance.now();
      setTimeout(() => {
        speakQuestion(pipelineCurrentQuestion.question, () => {
          if (isTransitioningRef.current) {
            isTransitioningRef.current = false;
            const ttsEnd = performance.now();
            const ttsDurationMs = ttsEnd - ttsStartRef.current;
            const totalTransitionMs = ttsEnd - transitionStartRef.current;
            TelemetryService.recordLatency({
              questionId: activeQuestionIdRef.current,
              sttDurationMs: sttDurationRef.current,
              llmDurationMs: llmDurationRef.current, // this needs adjustment since llm wait is inside pipeline
              ttsDurationMs: ttsDurationMs,
              totalTransitionMs: totalTransitionMs
            });
          }
          startListening(pipelineCurrentQuestion.id);
        });
      }, 300);
    }
  }, [pipelineCurrentQuestion]);

  // React to evaluations (save to Supabase)
  useEffect(() => {
    if (lastEvaluation && lastEvaluation !== lastProcessedEvaluationRef.current) {
      lastProcessedEvaluationRef.current = lastEvaluation;
      const currentHistoryLength = historyRef.current.length;
      const newEntry = {
        question: questions[currentIndex]?.question || (questions[currentIndex] as any)?.text || '',
        answer: lastSubmittedTranscriptRef.current,
        ideal_answer: questions[currentIndex]?.ideal_answer || "",
        evaluation: lastEvaluation,
        difficulty: questions[currentIndex]?.difficulty || 1,
        category: questions[currentIndex]?.category || 'General',
        questionData: questions[currentIndex]
      };
      const updatedHistory = [...historyRef.current, newEntry];
      updateHistory(updatedHistory);
      
      SupabaseService.saveResponse(
        sessionIdRef.current,
        currentHistoryLength,
        lastEvaluation,
        newEntry.ideal_answer,
        candidate.name,
        newEntry.question,
        newEntry.answer
      )
        .catch(dbErr => {
          console.error("Failed to save response:", dbErr);
          ErrorLogService.logWarning("database", "Failed to save pipeline response", dbErr, sessionIdRef.current, candidate.name);
        });
    }
  }, [lastEvaluation]);

  // React to normal interview completion
  useEffect(() => {
    if (!pipelineCompleted) return;

    const handleNormalCompletion = async () => {
      //if (isProcessingRef.current && !pipelineCompleted) return;
      setIsProcessing(true);
      isProcessingRef.current = true;
      setLoadingText("Finalizing interview...");
      setLoading(true);
      stopListening();

      await flushAllRemainingEvents();
      const proctoringReport = compileReport();
      const finalResult = (controller as any)?.completionResult || completionResultRef?.current || pipelineCompletionResult;
      onComplete(historyRef.current, proctoringReport, finalResult);
    };

    handleNormalCompletion();
  }, [pipelineCompleted, pipelineCompletionResult]);

  return (
    <div className="w-full h-dvh overflow-hidden bg-[#F8FAFC] flex flex-col font-sans relative">
      {/* Top Banner for Warnings */}
      {activeToast && (
        <div className={`fixed top-0 left-0 w-full z-100 text-center p-3 font-bold text-white shadow-lg flex items-center justify-center gap-2 animate-in slide-in-from-top-4 fade-in duration-300 ${activeToast.type === 'danger' ? 'bg-red-600' : 'bg-orange-500'}`}>
          <AlertTriangle size={20} />
          {activeToast.message}
        </div>
      )}

      {/* Fullscreen Re-entry Alert Banner */}
      {!isFullscreen && hasStarted && (
        <div className="fixed top-12 left-0 w-full z-100 bg-rose-600 text-white p-3 font-bold text-center flex items-center justify-center gap-3 shadow-xl animate-in slide-in-from-top-4 duration-300">
          <AlertTriangle size={18} />
          <span className="text-sm">Fullscreen mode exited! Please return to fullscreen to continue the interview safely.</span>
          <button
            onClick={() => {
              void requestFullscreenIfSupported().then((enteredFullscreen) => {
                // Keep the banner hidden on browsers that don't support fullscreen.
                setIsFullscreen(enteredFullscreen || !isFullscreenActive());
              });
            }}
            className="ml-2 px-3 py-1.5 bg-white text-rose-700 text-xs font-black rounded-xl shadow hover:bg-rose-50 transition-all cursor-pointer"
          >
            Re-enter Fullscreen
          </button>
        </div>
      )}
      
      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-100 z-50">
        <div 
          className="h-full bg-indigo-600 transition-all duration-700 ease-out"
          style={{ width: `${(activePrimaryIndex / totalQuestions) * 100}%` }}
        />
      </div>

      <header className="px-4 py-4 md:px-8 md:py-6 flex justify-between items-center border-b border-slate-200 bg-white sticky top-0 z-60">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-bold shadow-lg">
            {candidate.role ? candidate.role.substring(0, 2).toUpperCase() : 'CS'}
          </div>
          <div>
            <h2 className="font-bold text-slate-900 tracking-tight">{candidate.name}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{candidate.role} Candidate</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMonitorOpen(true)}
            className="md:hidden px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold border border-indigo-100"
          >
            Show Monitoring
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-slate-50 rounded-xl border border-slate-200">
            <span className="hidden md:inline text-xs font-bold text-slate-500">QUESTION</span>
            <span className="text-sm font-black text-indigo-600">{activePrimaryIndex} / {totalQuestions}</span>
          </div>
        </div>
      </header>

      {/* Two-Column Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Right Column: V8 Monitoring Sidebar */}
        <aside className={`
          ${isMobileMonitorOpen ? 'fixed inset-0 z-100 bg-slate-900 flex pt-16 px-4 pb-4 overflow-y-auto' : 'hidden md:flex'}
          md:relative md:order-last md:w-[320px] lg:w-95 md:max-w-[35vw] shrink-0 md:bg-slate-900 text-white md:border-l border-slate-700 flex-col shadow-xl md:z-70
        `}>
          {isMobileMonitorOpen && (
            <button 
              onClick={() => setIsMobileMonitorOpen(false)}
              className="md:hidden absolute top-4 right-4 text-slate-300 bg-slate-800 p-2 rounded-full font-bold"
            >
              Close
            </button>
          )}
          <div className="p-0 md:p-4 flex flex-col gap-4 mt-8 md:mt-0">
            
            {/* Camera Preview */}
            <div className="w-full aspect-4/3 bg-black rounded-xl overflow-hidden relative shadow-2xl md:shadow-lg shrink-0">
              <CameraPreview 
                ref={videoElRef}
                stream={proctoring.cameraProvider === 'phone_camera' ? phonePreviewStream : (previewStream || providerRef.current?.getPreviewStream() || null)}
                mirrored={proctoring.cameraProvider === 'local_webcam'}
                showPlaceholder={
                  (proctoring.cameraProvider === 'phone_camera' && !phonePreviewStream)
                }
                statusOverlay={
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                    <div className={`w-1.5 h-1.5 rounded-full ${cameraReady ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                      {proctoring.cameraProvider === 'phone_camera' ? 'Phone' : 'Webcam'}
                    </span>
                  </div>
                }
              />

              {/* Headless local analysis only when using LocalCameraProvider */}
              {proctoring.cameraProvider === 'local_webcam' && (
                <CameraAnalysis
                  stream={providerRef.current?.getPreviewStream() ?? null}
                  onDetectionFrame={(frame) => {
                    dispatch({ type: 'DETECTION_FRAME', frame });
                    
                    // Forward events to local provider so subscribers like PreFlightCheck receive them
                    if (providerRef.current && providerRef.current.type === 'local_webcam') {
                      (providerRef.current as LocalCameraProvider).emitDetectionFrame(frame);
                    }
                    
                    // Stats updates
                    const stats = healthStatsRef.current;
                    stats.totalFrames++;
                    if (frame.faceDetected) {
                      stats.framesWithFace++;
                      stats.confidenceSum += frame.trackingConfidence;
                      if (stats.longestNoFaceStart !== null) {
                        const duration = Date.now() - stats.longestNoFaceStart;
                        if (duration > stats.longestNoFaceDurationMs) stats.longestNoFaceDurationMs = duration;
                        stats.longestNoFaceStart = null;
                      }
                    } else if (stats.longestNoFaceStart === null) {
                      stats.longestNoFaceStart = Date.now();
                    }

                    const isAway = frame.gazeDirection !== 'center' || Math.abs(frame.headYaw) > 30 || frame.facePosition === 'PARTIAL_OUT';

                    if (isAway && frame.faceCount > 0) {
                      if (stats.longestGazeAwayStart === null) stats.longestGazeAwayStart = Date.now();
                    } else {
                      if (stats.longestGazeAwayStart !== null) {
                        const duration = Date.now() - stats.longestGazeAwayStart;
                        if (duration > stats.longestGazeAwayDurationMs) stats.longestGazeAwayDurationMs = duration;
                        stats.longestGazeAwayStart = null;
                      }
                    }

                    if (frame.gazeDirection !== stats.currentGazeDirection) {
                      stats.currentGazeDirection = frame.gazeDirection;
                      stats.currentGazeDirectionStart = Date.now();
                    }
                    const gazeDurationMs = Date.now() - stats.currentGazeDirectionStart;
                    
                    // Calculate monitoring quality score
                    const fpsVal = latestHeartbeatRef.current.fps;
                    const fpsScore = Math.min(100, Math.max(0, (fpsVal / 24) * 100));
                    const facePresenceScore = frame.faceDetected ? 100 : 0;
                    const monitoringQualityScore = Math.round(
                      (frame.trackingConfidence * 0.6) + 
                      (fpsScore * 0.2) + 
                      (facePresenceScore * 0.2)
                    );

                    telemetryRef.current = {
                      faceDetected: frame.faceDetected,
                      trackingConfidence: frame.trackingConfidence,
                      monitoringQualityScore,
                      gazeDirection: frame.gazeDirection,
                      gazeDurationMs,
                      headPitch: frame.headPitch,
                      headYaw: frame.headYaw,
                      headRoll: frame.headRoll,
                      fps: latestHeartbeatRef.current.fps,
                      facePosition: frame.facePosition,
                      detectionHealth: latestHeartbeatRef.current.health as any,
                      lastUpdated: Date.now()
                    };
                  }}
                  onHeartbeat={(metrics) => {
                    latestHeartbeatRef.current = {
                      fps: metrics.fps,
                      health: metrics.detectionHealth,
                    };
                    dispatch({ type: 'HEARTBEAT', metrics });
                    
                    if (providerRef.current && providerRef.current.type === 'local_webcam') {
                      (providerRef.current as LocalCameraProvider).emitHeartbeat(metrics);
                    }
                  }}
                  onEngineReady={() => {
                    dispatch({ type: 'ENGINE_READY' });
                    
                    if (providerRef.current && providerRef.current.type === 'local_webcam') {
                      (providerRef.current as LocalCameraProvider).emitEngineReady();
                    }
                  }}
                  enabled={true}
                  fpsTarget={/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 3 : 15}
                />
              )}
            </div>

            {/* V8 Dashboard UI Components */}
            <div className="flex-1 block">
              {telemetry && (
                <MonitoringDashboard 
                    telemetry={telemetry} 
                    proctoring={proctoring} 
                />
              )}
            </div>

          </div>
        </aside>

        {/* Left Column: Interview UI */}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#F8FAFC]">
          <main className="flex-1 w-full p-3 sm:p-4 md:p-8 flex flex-col justify-start space-y-4 md:space-y-12 pb-safe overflow-y-auto">
        {!hasStarted ? (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 mt-6 pb-12">
            <div className="text-center space-y-3">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900">Ready to begin?</h1>
              <p className="text-slate-500 font-medium max-w-xl mx-auto text-sm sm:text-base">
                Please review these quick guidelines to ensure a smooth interview session.
              </p>
            </div>

            {/* Instruction Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {/* Mic Card */}
              <div className="bg-white border border-slate-200/60 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Mic size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Microphone Usage</h3>
                  <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                    Click the microphone button at the bottom to record. Speak clearly, or edit/type your answer if needed.
                  </p>
                </div>
              </div>

              {/* Questions Card */}
              <div className="bg-white border border-slate-200/60 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <Volume2 size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Questions & Flow</h3>
                  <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                    Listen to the AI read each question. Replay it at any time. There are 5 dynamic questions in total.
                  </p>
                </div>
              </div>

              {/* Proctoring Card */}
              <div className="bg-white border border-slate-200/60 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center space-y-3">
                <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">Proctoring Rules</h3>
                  <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                    Stay in camera view. Switching tabs or exiting fullscreen mode may automatically terminate the interview.
                  </p>
                </div>
              </div>
            </div>

            {/* Calibration Checklist */}
            <div className="flex justify-center py-4">
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
                  if (!configurationReady || !isPrepared || !isCalibrationComplete) return;

                  // Advance the UI first. Optional browser APIs like fullscreen/TTS
                  // must never be able to block the interview from starting.
                  setLoading(false);
                  setHasStarted(true);

                  // iPhone Safari may not support the Fullscreen API on the document.
                  // Request it when available, but never block interview start if unsupported.
                  void requestFullscreenIfSupported();

                  const currentQ = questions[currentIndex];
                  const firstQuestionText = currentQ ? currentQ.question : '';

                  // Speak the first question synchronously in this user gesture handler to bypass autoplay policies.
                  // If TTS/STT throws on a device/browser edge case, fall back to starting the mic directly.
                  try {
                    if (firstQuestionText) {
                      speakQuestion(firstQuestionText, () => {
                        startListening(currentQ?.id);
                      });
                    } else {
                      startListening(currentQ?.id);
                    }
                  } catch (error) {
                    console.error('[InterviewStart] Failed to start TTS/STT on user gesture:', error);
                    startListening(currentQ?.id);
                  }
                }}
                disabled={!configurationReady || !isPrepared || !isCalibrationComplete}
                className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 disabled:shadow-none transition-all active:scale-95 w-full sm:w-auto cursor-pointer"
              >
                {!configurationReady ? 'Initializing system...' :
                  (!isPrepared || loading) ? 'Preparing interview...' :
                  !isCalibrationComplete ? 'Complete Calibration Above' :
                  (questions.length > 1 || currentIndex > 0 || history.length > 0) ? 'Resume Interview' :
                  'Start Interview'}
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center space-y-4 min-h-100 h-full w-full bg-[#F8FAFC] rounded-3xl p-8">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-bold text-lg">{loadingText}</p>
          </div>
        ) : (
          <>
            {/* AI Question Section */}
            <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 pr-12 md:pr-16 mt-8 md:mt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-indigo-500 animate-ping' : 'bg-slate-300'}`} />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Interviewer</span>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold shadow-xs select-none"
                    title={`Evaluation Mode set by HR: ${evaluationMode || 'LOCAL'}`}
                  >
                    <span>
                      {evaluationMode === 'LOCAL' 
                        ? '⚡ Local Evaluation' 
                        : evaluationMode === 'HYBRID' 
                        ? '🔄 Hybrid Evaluation' 
                        : '☁️ API Evaluation'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <h1 className="text-xl sm:text-2xl md:text-4xl font-extrabold text-slate-900 leading-tight">
                  {currentQ?.question}
                </h1>
                <button 
                  onClick={() => {
                    stopListening();
                    speakQuestion(currentQ?.question || '', () => {
                      startListening(currentQ?.id);
                    });
                  }}
                  disabled={isSpeaking || isProcessing}
                  className="absolute -right-10 md:-right-14 top-0 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-slate-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-xl hover:bg-slate-50 active:scale-95"
                  title="Repeat Question"
                >
                  <Volume2 size={22} />
                </button>
              </div>
            </div>

            {/* User Response Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                micStatus === 'listening' ? 'bg-rose-500 animate-pulse' :
                micStatus === 'reconnecting' ? 'bg-amber-400 animate-ping' :
                micStatus === 'error' ? 'bg-red-500' :
                'bg-slate-300'
              }`} />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {micStatus === 'listening' && 'Listening...'}
                {micStatus === 'reconnecting' && 'Reconnecting Mic...'}
                {micStatus === 'error' && 'Mic Error / Unavailable'}
                {micStatus === 'off' && (isEditing ? 'Editing Response' : 'Your Response')}
              </span>
            </div>
            {!isListening && transcript && (
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 transition-colors py-2 px-3 rounded-lg hover:bg-indigo-50 active:scale-95"
              >
                <Edit3 size={14} />
                {isEditing ? 'Save Edit' : 'Edit Answer'}
              </button>
            )}
          </div>

          <div className={`min-h-30 md:min-h-40 bg-white border-2 rounded-3xl md:rounded-4xl p-4 md:p-8 transition-all ${
            isListening ? 'border-rose-200 shadow-xl shadow-rose-100/50' : 
            isEditing || transcript ? 'border-indigo-200 shadow-xl shadow-indigo-100/50' : 
            'border-slate-100 shadow-sm'
          }`}>
          <div className="relative">
              <textarea
                disabled={!hasStarted || isSpeaking || isProcessing}
                className={`w-full h-28 md:h-40 p-3 md:p-4 bg-slate-50 border-2 rounded-2xl resize-none outline-none transition-all text-sm md:text-base text-slate-700 font-medium ${
                  !hasStarted || isSpeaking || isProcessing
                    ? 'border-slate-200 bg-slate-100/70 text-slate-400 cursor-not-allowed'
                    : isListening
                    ? 'border-indigo-400 bg-indigo-50/30'
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                }`}
                value={liveTranscript || ""}
                onChange={(e) => {
                  if (!hasStarted || isSpeaking || isProcessing) return;
                  setTranscript(e.target.value);
                  setIsEditing(true);
                }}
                placeholder={
                  !hasStarted ? "Interview has not started..." :
                  isSpeaking ? "AI is asking question... Please listen" :
                  isProcessing ? "Processing response..." :
                  isListening ? "Listening... (or type your answer below)" :
                  "Type or speak your answer here..."
                }
              />
              {interimTranscript && (
                <div className="absolute bottom-4 left-4 right-16 pointer-events-none">
                  <span className="bg-slate-800/80 text-white text-xs md:text-sm px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-sm animate-pulse">
                    {interimTranscript}
                  </span>
                </div>
              )}
          </div>
        </div>
      </div>
          </>
        )}
      </main>

      {hasStarted && !loading && (
        <footer className="sticky bottom-0 p-4 md:p-8 bg-white border-t border-slate-200 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] md:shadow-none z-60">
        <div className="max-w-4xl mx-auto flex items-center gap-3 md:gap-6">
          <button
            onClick={toggleMic}
            disabled={!hasStarted || isSpeaking || isProcessing}
            className={`w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-full flex flex-col items-center justify-center transition-all ${
              micStatus === 'listening' ? 'bg-rose-500 text-white shadow-xl shadow-rose-200' :
              micStatus === 'reconnecting' ? 'bg-amber-500 text-white shadow-xl shadow-amber-200 animate-pulse' :
              micStatus === 'error' ? 'bg-red-600 text-white shadow-xl shadow-red-200' :
              'bg-slate-100 text-slate-900 hover:bg-slate-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {micStatus === 'listening' ? <MicOff size={28} /> : <Mic size={28} />}
          </button>

          <button
            onClick={handleNext}
            disabled={!hasStarted || !transcript.trim() || isSpeaking || isProcessing || (isListening && transcript.length === 0)}
            className="flex-1 bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-300 text-white h-16 md:h-20 rounded-2xl md:rounded-[28px] font-bold text-lg md:text-xl shadow-xl shadow-slate-200/50 transition-all flex items-center justify-center gap-2 md:gap-3 active:scale-[0.98]"
          >
            <span className="truncate">{activePrimaryIndex < totalQuestions ? 'Next Question' : 'Complete Interview'}</span>
            <ArrowRight size={20} className="shrink-0" />
          </button>
        </div>
        </footer>
      )}

        {/* ─── Phone Reconnection Recovery Overlay ─────────────────────────── */}
        {proctoring.cameraProvider === 'phone_camera' && phoneReconnectCountdown !== null && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.72)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{
              background: '#fff',
              borderRadius: 20,
              padding: '36px 40px',
              maxWidth: 420,
              width: '90vw',
              textAlign: 'center',
              boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
            }}>
              {/* Animated phone icon */}
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#FFF3CD',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 30,
                animation: 'pulse 1.2s ease-in-out infinite',
              }}>
                📱
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>
                Phone connection lost
              </h2>
              <p style={{ fontSize: 15, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
                Please unlock or reopen the companion app on your phone.<br />
                The interview will resume automatically.
              </p>

              {/* Countdown progress bar */}
              <div style={{ background: '#f1f5f9', borderRadius: 999, height: 8, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: 999,
                  background: phoneReconnectCountdown > 5 ? '#f59e0b' : '#ef4444',
                  width: `${(phoneReconnectCountdown / 11) * 100}%`,
                  transition: 'width 1s linear, background 0.3s ease',
                }} />
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>
                {phoneReconnectCountdown} second{phoneReconnectCountdown !== 1 ? 's' : ''} remaining before camera lost is recorded
              </p>
            </div>
          </div>
        )}

        </div>
      </div>
    </div>
  );
};
