
export type QuestionType = 'Definition' | 'Comparison' | 'Scenario' | 'Debugging' | 'Design' | 'Tradeoff' | 'Architecture' | 'HR' | 'Technical';

import type { ExpertAnalysis } from './src/Evaluation/expert/types';

export type CandidateOutcome = 'PENDING' | 'SHORTLIST' | 'REJECT' | 'INTERVIEW_SCHEDULED';

export enum TerminationReason {
  EXCESSIVE_PROCTORING_VIOLATIONS = 'EXCESSIVE_PROCTORING_VIOLATIONS',
  CAMERA_DISCONNECTED = 'CAMERA_DISCONNECTED',
  TAB_SWITCH_LIMIT_EXCEEDED = 'TAB_SWITCH_LIMIT_EXCEEDED',
  ADMIN_TERMINATED = 'ADMIN_TERMINATED',
  NETWORK_FAILURE = 'NETWORK_FAILURE'
}

export type InterviewRole =
  | 'CSE'
  | 'ETC'
  | 'AI'
  | 'DS'
  | 'CYBER'
  | 'EE'
  | 'ME'
  | 'CE'
  | 'IT';

export const InterviewRoles = {
  CSE: 'Computer Science Engineering (CSE)',
  ETC: 'Electronics & Telecommunication Engineering (ETC)',
  DS: 'Data Science (DS)',
  AI: 'Artificial Intelligence (AI)',
  CYBER: 'Cyber Security (CYBER)',
  EE: 'Electrical Engineering (EE)',
  ME: 'Mechanical Engineering (ME)',
  CE: 'Civil Engineering (CE)',
  IT: 'Information Technology (IT)',
} as const;

export type QuestionCategory =
  | 'Introduction'
  | 'Communication'
  | 'Behavioral'
  | 'Project'
  | 'Analytical'
  | 'Situational'
  | 'Technical_Fundamentals'
  | 'Technical_Core'
  | 'Technical_Scenario';

export type EvaluationDimension =
  | 'technicalAccuracy'
  | 'conceptUnderstanding'
  | 'reasoning'
  | 'problemSolving'
  | 'communication'
  | 'fluency'
  | 'adaptability'
  | 'cultureFit';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type CandidateTargetProfile = 'COLLEGE_STUDENT' | 'FRESHER' | 'MID_LEVEL' | 'SENIOR_LEAD';

export const CandidateTargetProfileOptions: { value: CandidateTargetProfile; label: string; desc: string }[] = [
  { value: 'COLLEGE_STUDENT', label: 'College Student / Intern', desc: 'Focus on core CS fundamentals & learning aptitude' },
  { value: 'FRESHER',         label: 'Fresher / Entry-Level',   desc: '0-2 years experience; basics, clean code & logic' },
  { value: 'MID_LEVEL',       label: 'Mid-Level Engineer',     desc: '2-5 years experience; APIs, databases & scenarios' },
  { value: 'SENIOR_LEAD',     label: 'Senior / Lead Architect', desc: '5+ years experience; system design, failure modes & trade-offs' }
];

export interface RubricElement {
  id: string;
  required?: boolean;
  category?: 'concept' | 'mechanism' | 'tradeoff' | 'edge_case' | 'application';
  description?: string;
}


export interface InterviewTemplate {
  id: string;
  steps: {
    category: QuestionCategory;
    difficulty: Difficulty;
  }[];
}

export interface InterviewSettings {
  role: InterviewRole;
  template: string;
  version: number;
}

export interface ConceptEvidence {
  conceptId: string;
  matchedAlias: string;
  sentenceIndex: number;
  matchStrength: 'EXACT_ALIAS' | 'FUZZY_ALIAS' | 'STEM_MATCH' | 'PARTIAL_MATCH' | 'SEMANTIC_PATTERN';
  confidence: number;
}

export interface MisconceptionEvidence {
  misconceptionId: string;
  triggerPhrase: string;
  sentenceIndex: number;
  negated: boolean;
  confidence: number;
}

export interface ConfidenceEvidence {
  factor: string;
  adjustment: number;
  reason: string;
}

export interface ConceptExpectation {
  conceptId: string;
  expected: {
    definition: boolean;
    mechanism: boolean;
    purpose: boolean;
    useCase: boolean;
    limitations: boolean;
    tradeoffs?: boolean;
    alternatives?: boolean;
    failureCases?: boolean;
    dependencies?: boolean;
  };
  relationships?: string[]; // e.g. ["Inheritance -> Method Overriding", "Method Overriding -> Polymorphism"]
  commonMistakes?: string[]; // Specific misconceptions associated with this question
}

export interface Question {
  id: string | number; // String or number to support mockups, tests, and database
  question: string; // Renamed from text to match spec
  ideal_answer?: string; // Kept optional for backward compatibility during transition
  category?: string;
  type?: 'Fundamentals' | 'Core' | 'Scenario' | 'Behavioral Experience' | 'Behavioral Situation';
  difficulty?: Difficulty; // Optional to prevent breaking legacy mockups/tests
  questionType?: QuestionType;
  knowledgeModel?: ConceptExpectation[]; // Legacy

  // --- V3 Evaluation Data Models ---
  rubric?: {
    coreConcepts: string[];
    supportingConcepts: string[];
    synonymGroups?: Record<string, string[]>;
    misconceptions?: string[];
  };
  scoring?: {
    technicalAccuracy: number;
    conceptUnderstanding: number;
    reasoning: number;
    communication: number;
    confidence: number;
  };
  followups?: {
    whenMissing: string;
    branchId: string;
  }[];
  confidenceRules?: any;
  rubricVersion?: string;
  // -----------------------------------

  evaluationGuide?: string[];
  maxScore?: number;
  isFollowUp?: boolean;
  discriminationWeight?: number;
  version?: number; // Optional to prevent breaking legacy mockups/tests
  updatedAt?: string;
  // MCQ/Aptitude Extensions
  options?: string[];
  answer?: string;
  explanation?: string;
  imageUrl?: string;
  timeLimit?: number;
  keyConcepts?: EvaluationConcept[];
  staticFollowUps?: { question: string; evaluationGuide: string[] }[];

  // Refined Composition Metadata
  role?: InterviewRole | 'COMMON' | 'APTITUDE'; // Optional to prevent breaking legacy mockups/tests
  interviewCategory?: QuestionCategory;        // Optional for MCQ/legacy, mandatory for voice
  estimatedDuration?: number;                  // In seconds
  tags?: string[];
  isActive?: boolean;                          // Optional to prevent breaking legacy mockups/tests
  topic?: string;                              // Optional to support specific bootstrapped questions
  metadata?: Record<string, any>;              // For tracking follow-up generation stats
}

export interface Candidate {
  name: string;
  position?: string;
  company?: string;
  accessId?: string;
  jobPostId?: string;
  customTopic?: string; // For Mini Demo Mode
  isDemo?: boolean;
  role?: string;

  // Identity Verification Fields
  email?: string;
  phone?: string;
  idNumber?: string;
  profilePhoto?: string;
  idCardImage?: string;
  isVerified?: boolean;

  // Strongly typed session snapshot
  session?: InterviewSession;
}
// Note: Keep other types the same, we will append MasterEvaluationReport at the end.

export interface ProctoringConfiguration {
  enabled: boolean;
  camera: {
    mode: 'auto' | 'webcam' | 'phone';
  };
}

export interface RoleSettings {
  difficulty: 'Very Easy' | 'Easy' | 'Medium' | 'Hard' | 'Very Hard';
  preset: 'Relaxed' | 'Normal' | 'Strict' | 'Custom';
  weights: {
    concept: number;   // 0-100
    grammar: number;   // 0-100
    fluency: number;   // 0-100
    camera: number;    // 0-100
  };
  proctoring: {
    maxWarnings: number; // 1-5
    sensitivity: 'Low' | 'Medium' | 'High';
    includeInScore: boolean;

    // Structured proctoring configuration settings
    enabled?: boolean;
    camera?: {
      mode: 'auto' | 'webcam' | 'phone';
    };

    // TODO: Remove legacy compatibility fields after v1.x migration
    aiProctoringEnabled?: boolean;
    cameraMode?: 'auto' | 'webcam' | 'phone';
  };
}

export interface JobPost {
  id: string; // This is the interview_id
  company: string;
  title: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  questions: Question[];
  settings: RoleSettings;
  mode: 'AI' | 'Custom';
}

export interface FeedbackStructure {
  observation: string;
  demonstrated: string[];
  gaps: string[];
  nextSteps: string[];
}

export function formatFeedbackToString(feedback: any): string {
  if (!feedback) return "";
  if (typeof feedback === 'string') {
    if (feedback.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(feedback);
        return formatFeedbackToString(parsed);
      } catch {
        // ignore and return string
      }
    }
    return feedback;
  }
  const parts: string[] = [];
  if (feedback.observation) {
    parts.push(`Observation: ${feedback.observation}`);
  }
  if (feedback.demonstrated && feedback.demonstrated.length > 0) {
    parts.push(`Demonstrated: ${feedback.demonstrated.join(', ')}`);
  }
  if (feedback.gaps && feedback.gaps.length > 0) {
    parts.push(`Gaps: ${feedback.gaps.join(', ')}`);
  }
  if (feedback.nextSteps && feedback.nextSteps.length > 0) {
    parts.push(`Next Steps: ${feedback.nextSteps.join(', ')}`);
  }
  return parts.join(' | ');
}

export function ensureFeedbackStructure(feedback: any): FeedbackStructure {
  if (!feedback) {
    return { observation: "", demonstrated: [], gaps: [], nextSteps: [] };
  }
  if (typeof feedback === 'object' && 'observation' in feedback) {
    return feedback as FeedbackStructure;
  }
  if (typeof feedback === 'string') {
    const trimmed = feedback.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return {
            observation: parsed.observation || "",
            demonstrated: parsed.demonstrated || [],
            gaps: parsed.gaps || [],
            nextSteps: parsed.nextSteps || []
          };
        }
      } catch {
        // ignore and fall through
      }
    }
    return {
      observation: feedback,
      demonstrated: [],
      gaps: [],
      nextSteps: []
    };
  }
  return { observation: "", demonstrated: [], gaps: [], nextSteps: [] };
}

export type EvaluationSourceType = 'API' | 'LOCAL' | 'HYBRID_API' | 'HYBRID_LOCAL' | 'API_FAILED';

export type DimensionScore = {
  score: number;
  positiveEvidence: string[]; // Max 3 items
  negativeEvidence: string[]; // Max 3 items
};

export type DeepReadonly<T> =
    T extends (infer R)[] ? ReadonlyArray<DeepReadonly<R>> :
    T extends (...args: any[]) => any ? T :
    T extends object ? { readonly [P in keyof T]: DeepReadonly<T[P]> } :
    T;

export interface EvaluationResult {
  questionId: number;
  questionText: string;
  userAnswer: string;
  questionAlignment?: QuestionAlignment;

  // Granular Scoring
  contentScore: number; // Concept (adjusted content score)
  knowledgeScore?: number; // NEW
  problemSolvingScore?: number; // NEW
  learningPotentialScore?: number; // NEW
  confidenceGap?: number; // NEW
  grammarScore: number;
  fluencyScore: number;
  communicationScore?: number;
  honestyScore?: number; // 0-10
  knowledgeAdmissionScore?: number; // 0-10
  bluffRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
  misconceptionRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
  confidenceCalibration?: 'UNDERCONFIDENT' | 'CALIBRATED' | 'OVERCONFIDENT';

  // Qualitative Analysis
  mentionedConcepts: string[];   // Concepts the candidate named/identified
  explainedConcepts: string[];   // Concepts the candidate actually explained with understanding
  matchedKeyPoints: string[];    // Backward compat: = mentionedConcepts
  missingKeyPoints: string[];
  answerType: 'honest_unknown' | 'keyword_list_only' | 'incorrect_attempt' | 'mixed_understanding' | 'partial_explanation' | 'full_explanation';
  answerQuality: 'HONEST_UNKNOWN' | 'KEYWORD_LIST' | 'INCORRECT_ATTEMPT' | 'SURFACE_LEVEL' | 'COMPETENT' | 'STRONG' | 'EXPERT';
  verdict: 'Excellent' | 'Good' | 'Pass' | 'Borderline' | 'Fail';
  isHonestUnknown?: boolean;
  buzzwordStuffingDetected?: boolean;
  feedback: FeedbackStructure;

  // Strict Evaluation Segments (New)
  analysis?: {
    technicalAccuracy: number;
    problemSolving: number;
    practicalExecution: number;
    communication: number;
    redFlags?: string[];
    // New Version 11 scores
    coverage?: number;
    understanding?: number;
    reasoning?: number;
    depth?: number;
    clarity?: number;
    structure?: number;
    confidence?: number;
    consistency?: number;
    answerDirectnessScore?: number;
    tradeoffReasoningScore?: number;
    curiosity?: number; // NEW
    selfCorrection?: number; // NEW
    learningPotential?: number; // NEW
    technicalErrors?: { error: string; severity: 'low' | 'medium' | 'high' }[];
  };

  // V2 Dimensions
  dimensions?: {
    correctness: DimensionScore;
    reasoning: DimensionScore;
    application: DimensionScore;
    communication: DimensionScore;
    confidence: DimensionScore;
    coverage: DimensionScore;
  };

  /** Expert local-evaluation analysis (only present when the expert engine is enabled). */
  expert?: ExpertAnalysis;

  // Adaptive & Behavioral Extensions
  behavioralMetrics?: {
    communication: number;
    problemSolving: number;
    ownership: number;
    teamwork: number;
    adaptability: number;
    leadershipPotential: number;
    responseStructure: number;
    evidenceStrength: number;
  };
  transcriptQuality?: number;
  evaluationPending?: boolean;
  evaluationConfidence?: number; // 0-100: how confident is the evaluation (low for local fallback, high for AI)
  evaluationError?: string; // Captured error message if evaluation failed
  followupResult?: {
    reliability: number; // 0-100
  };
  strengths?: string[];
  improvements?: string[];
  recommendedFocusAreas?: string[];
  highestDifficultyReached?: 'easy' | 'medium' | 'hard';

  // 5-Dimension Evaluation Properties
  technicalAccuracyScore?: number;       // Core (0-10)
  conceptUnderstandingScore?: number;    // Core (0-10)
  reasoningScore?: number;               // Core (0-10)
  communicationClarityScore?: number;    // Local + LLM (0-10)
  confidenceCalibrationScore?: number;   // Local + LLM (0-10)

  // Sub-breakdowns and Metrics
  technicalAccuracyBreakdown?: {
    factsScore: number;
    questionSatisfactionScore: number;
    misconceptionsScore: number;
    completenessScore: number;
    relevanceScore: number;
  };
  questionSatisfaction?: 'YES' | 'PARTIAL' | 'NO';
  explanationCompletenessPercent?: number;
  relevantContentRatio?: number;
  conceptGraphDetails?: {
    reachedDepth: string[];
    missedDependencies: string[];
    validConnections: string[];
    invalidConnections: string[];
  };
  misconceptionsDetected?: string[];
  uncertaintyDetected?: boolean;
  selfCorrectionsCount?: number;
  unsupportedClaimsCount?: number;
  knowledgeBoundaryExceeded?: boolean;
  developerTrace?: string[];
  detectorConfidences?: { [detectorName: string]: number };
  ruleVersion?: string;
  knowledgeModelVersion?: string;
  explainabilityReport?: string;
  recommendation?: 'Strong Hire' | 'Hire' | 'Consider' | 'Reject';
  relevanceScore?: number;
  questionSatisfactionScore?: number;

  // Visual/Legacy
  confidenceScore: number; // 0-100 (Visual)
  expressionAnalysis: string; // Summary of visual analysis
  timestamp: string;
  evaluationMetadata?: {
    engineId: string;
    version: string;
    timestamp: string;
    latencyMs: number;
    mode: any;
    evaluationSource?: EvaluationSourceType;
    fallbackReason?: string;
    provider?: string;
    model?: string;
    promptVersion?: string;
    providerTier?: 'free' | 'paid';
  };
}

export type ReadonlyEvaluationResult = DeepReadonly<EvaluationResult>;

export interface CategoryScore {
  raw: number;
  weighted: number;
  maxWeight: number;
}

export interface StrictEvaluationReport {
  categories: {
    technicalAccuracy: CategoryScore;
    problemSolving: CategoryScore;
    practicalExecution: CategoryScore;
    communication: CategoryScore;
    adaptability: CategoryScore;
    cultureFit: CategoryScore;
    confidenceModifier: number;
  };
  totalScore: number;
  detailedAnalysis: {
    strengths: string[];
    failures: string[];
    missedOpportunities: string[];
    depthVsSurface: string;
  };
  redFlags: string[];
  finalVerdict: 'STRONG HIRE' | 'HIRE' | 'BORDERLINE' | 'REJECT';
  verdictJustification: string;
}

export interface WarningEvent {
  timestamp: string;
  type: 'GAZE' | 'FACE_MISSING' | 'MULTIPLE_FACES' | 'TAB_SWITCH';
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW PROCTORING TYPES (v7)
// ─────────────────────────────────────────────────────────────────────────────

export type InterviewMediaResources = {
  stream: MediaStream;
  videoTrack: MediaStreamTrack;
  audioTrack: MediaStreamTrack;
};

export type RawDetectionFrame = {
  faceCount: number;
  faceDetected: boolean;
  landmarkCount: number;
  trackingConfidence: number;  // 0.0–100 based on scale/centering/tracking
  gazeDirection: 'center' | 'left' | 'right' | 'up' | 'down' | 'away';
  isHeadTurned: boolean;
  isMouthMoving: boolean;
  expression: string;
  timestamp: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  facePosition: 'CENTERED' | 'PARTIAL_OUT';
};

export type ProctorViolation = {
  id: string;
  sessionId: string;           // Correlation ID
  type: 'TAB_HIDDEN' | 'NO_FACE' | 'GAZE_AWAY' | 'MULTIPLE_FACES'
       | 'CAMERA_LOST' | 'MICROPHONE_LOST' | 'REFRESH_ATTEMPT'
       | 'FULLSCREEN_EXIT' | 'COPY_PASTE';
  severity: number;
  timestamp: number;
  message: string;
  snapshot_url?: string;
  clip_url?: string;
};

export type TimelineEvent = {
  id?: string;
  sessionId: string;
  timestamp: number;
  event: string;
  severity: number;
  detail?: string;
};

export type ProctoringEngineState =
  | 'INITIALIZING' | 'READY' | 'PERMISSION_DENIED' | 'UNSUPPORTED_BROWSER'
  | 'ERROR' | 'RECOVERING' | 'CONNECTION_LOST' | 'TERMINATED';

export type HeartbeatMetrics = {
  fps: number;
  lastDetectionAgoMs: number;
  trackingConfidence: number;
  gazeDirection: string;
  detectionHealth: 'GOOD' | 'LOW_LIGHT' | 'PARTIAL_FACE' | 'UNSTABLE';
  engineState: ProctoringEngineState;
};

export type DashboardTelemetry = {
  faceDetected: boolean;
  trackingConfidence: number;
  monitoringQualityScore: number;
  gazeDirection: string;
  gazeDurationMs: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  fps: number;
  facePosition: string;
  detectionHealth: string;
  lastUpdated: number;
};

export type MonitoringHealthSummary = {
  monitoringCoveragePercent: number;
  averageTrackingConfidence: number;
  totalDetectionFrames: number;
  stalledPeriods: number;
  longestNoFaceDurationMs: number;
  longestGazeAwayDurationMs: number;
};

export type ProctoringReport = {
  sessionId: string;
  currentRiskScore: number;
  overallRiskScore: number;
  noFaceEvents: number;
  gazeAwayEvents: number;
  multipleFaceEvents: number;
  tabSwitchEvents: number;
  fullscreenExitEvents: number;
  copyPasteEvents: number;
  violationScore: number;
  integrityScore: number;
  totalGazeAwayDurationMs: number;
  microphoneLostEvents: number;
  violations: ProctorViolation[];
  timeline: TimelineEvent[];
  flushedEventIds?: string[];
  sessionDurationMs: number;
  monitoringDurationMs: number;
  heartbeatCount: number;        // Total heartbeats emitted during session
  heartbeatSamples: { timestamp: number; fps: number }[]; // For backend validation
  cameraReconnectCount: number;
  maxConcurrentFaces: number;
  browserInfo: {
    userAgent: string;
    platform: string;
    viewportWidth: number;
    viewportHeight: number;
  };
  healthSummary: MonitoringHealthSummary;
  isTerminated?: boolean;
  terminationReason?: string;
};

export type ProctoringState = {
  engineState: ProctoringEngineState;
  currentRiskScore: number;
  overallRiskScore: number;
  heartbeat: HeartbeatMetrics;
  violations: ProctorViolation[];
  timeline: TimelineEvent[];
  gazeState: 'LOOKING' | 'AWAY_START' | 'VIOLATION_CREATED' | 'COOLDOWN';
  gazeAwayStartTime: number | null;
  multiFaceState: 'SINGLE_FACE' | 'MULTI_FACE_START' | 'MULTI_FACE_CONFIRMED';
  multiFaceStartTime: number | null;
  noFaceState: 'FACE_PRESENT' | 'NO_FACE_START' | 'VIOLATION_CREATED';
  noFaceStartTime: number | null;
  sessionStartTime: number;
  monitoringStartTime: number | null;
  cameraReconnectCount: number;
  maxConcurrentFaces: number;
  microphoneHealthy: boolean;
  networkHealthy: boolean;
  heartbeatCount: number;
  fullscreenExitEvents: number;
  copyPasteEvents: number;
  violationScore: number;
  integrityScore: number;
  totalGazeAwayDurationMs: number;
  lastViolationTime: number;
  /**
   * Per-violation-type cooldown clock.
   *
   * `lastViolationTime` above is a single timestamp shared by every violation type, so any
   * violation suppressed every OTHER type for the next 5 seconds. A tab switch removes the
   * candidate's face from frame, so NO_FACE fired first and silently swallowed the TAB_HIDDEN
   * that followed milliseconds later — which is why tab-switch detection behaved inconsistently.
   *
   * Optional so existing state objects and any external constructor remain valid; the reducer
   * treats a missing entry as "no cooldown in effect".
   */
  lastViolationTimeByType?: Record<string, number>;
  settings?: ProctoringSettings;
  cameraOffStartTime?: number | null;
  micOffStartTime?: number | null;

  // ─── Phone Camera Proctoring State ──────────────────────────────────
  cameraProvider: 'local_webcam' | 'phone_camera' | 'none';
  phoneConnectionState: PhoneConnectionState;
  phoneConnectionId: string | null;
  phoneReconnectCount: number;
  lastReceivedSequence: number;
  phoneTimeOffsetMs: number;
  networkQuality: {
    avgLatencyMs: number;
    packetLossRate: number;
    heartbeatAgeMs: number;
    reconnectCount: number;
  };
  setupCheck: {
    microphone: boolean;
    cameraPermission: boolean;
    faceDetected: boolean;
    lightingGood: boolean;
    cameraStable: boolean;
    distanceAppropriate: boolean;
    networkStable: boolean;
    batteryOk: boolean;
  };
  setupProgressMs: number;
};

export type ProctoringAction = 
  | { type: 'DETECTION_FRAME'; frame: RawDetectionFrame }
  | { type: 'ENGINE_READY' }
  | { type: 'HEARTBEAT'; metrics: HeartbeatMetrics }
  // `trigger` distinguishes a tab switch from a window/application focus loss. Both are
  // recorded as TAB_HIDDEN, but they mean different things to a reviewer and the DOM already
  // tells them apart. Optional so existing dispatch sites remain valid.
  | { type: 'TAB_HIDDEN'; trigger?: 'visibilitychange' | 'blur' }
  | { type: 'FULLSCREEN_EXIT' }
  // `clipboardAction` carries which clipboard operation occurred. Paste suggests importing an
  // answer; copy suggests exfiltrating the question. Optional for backward compatibility.
  | { type: 'COPY_PASTE'; clipboardAction?: 'copy' | 'cut' | 'paste' }
  | { type: 'REFRESH_ATTEMPT' }
  | { type: 'CAMERA_LOST' }
  | { type: 'MICROPHONE_LOST' }
  | { type: 'MICROPHONE_RECOVERED' }
  | { type: 'NETWORK_LOST' }
  | { type: 'NETWORK_RECOVERED' }
  | { type: 'DECAY_RISK' }
  | { type: 'SET_UNSUPPORTED_BROWSER' }
  | { type: 'SET_PERMISSION_DENIED' }
  | { type: 'UPDATE_VIOLATION_MEDIA'; id: string; snapshotUrl: string | null; clipUrl: string | null }
  | { type: 'SET_SETTINGS'; settings: ProctoringSettings }
  // ─── Phone Camera Proctoring Actions ────────────────────────────────
  | { type: 'SET_CAMERA_PROVIDER'; provider: 'local_webcam' | 'phone_camera' | 'none' }
  | { type: 'SET_PHONE_CONNECTION_STATE'; state: PhoneConnectionState }
  | { type: 'PHONE_CONNECTED'; connectionId: string }
  | { type: 'PHONE_DISCONNECTED' }
  | { type: 'PHONE_RECONNECTED'; connectionId: string }
  | { type: 'REMOTE_DETECTION_FRAME'; frame: RawDetectionFrame; sequence: number }
  | { type: 'REMOTE_HEARTBEAT'; metrics: HeartbeatMetrics; sequence: number }
  | { type: 'UPDATE_NETWORK_QUALITY'; quality: ProctoringState['networkQuality'] }
  | { type: 'UPDATE_SETUP_CHECK'; check: Partial<ProctoringState['setupCheck']> }
  | { type: 'UPDATE_SETUP_PROGRESS'; progressMs: number }
  | { type: 'SET_PHONE_TIME_OFFSET'; offsetMs: number };

// ─────────────────────────────────────────────────────────────────────────────

export interface InterviewSession {
  id: string;
  candidate: Candidate;
  date: string;
  status: 'COMPLETED' | 'TERMINATED' | 'IN_PROGRESS' | 'QUEUED';
  overallScore: number; // 0-100
  results: ReadonlyEvaluationResult[];
  warnings: WarningEvent[];
  durationSeconds: number;
  isDeleted?: boolean;
  deletedAt?: string;
  evaluationReport?: any;
  proctoringReport?: any;
  interview_metadata?: {
    device_info?: any;
    job_settings_snapshot?: {
      proctoring?: ProctoringConfiguration;
      difficultyStrategy?: string;
      stageOverrides?: {
        Fundamentals?: string;
        Core?: string;
        Scenario?: string;
      };
      [key: string]: any;
    };
    runtime?: {
      cameraProvider?: 'local_webcam' | 'phone_camera' | 'none';
      [key: string]: any;
    };
    [key: string]: any;
  };
}

export interface AdminConfig {
  eyeTrackingSensitivity: number;
  warningThreshold: number;
  aiStrictness: number;
  enableEyeTracking: boolean;
  enableFaceDetection: boolean;
  defaultDifficulty: 'Easy' | 'Medium' | 'Hard';
  eyeAwayThreshold: number; // in frames
  faceMissingThreshold: number; // in frames
  headMovementThreshold: number; // translation delta
}

export enum InterviewStatus {
  IDLE = 'IDLE',
  READY = 'READY', // Camera ready, waiting for user "Start" gesture
  LOADING_QUESTION = 'LOADING_QUESTION',
  ASKING = 'ASKING', // TTS playing
  LISTENING = 'LISTENING', // Mic active
  THINKING = 'THINKING', // AI evaluating
  FEEDBACK = 'FEEDBACK', // Showing result
  COMPLETED = 'COMPLETED',
  LOCKED = 'LOCKED'
}

export interface SpeechState {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
}

export interface VisualMetrics {
  isPresent: boolean;
  isLookingAtCamera: boolean;
  currentExpression: string;
  confidenceLevel: number;
}

export type InterviewState = 'welcome' | 'setup' | 'camera-check' | 'active' | 'rules' | 'completed' | 'conduct-setup';

export enum EvaluationStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum InterviewCompletionState {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface InterviewCompletionResult {
  completionState: InterviewCompletionState;
  jobId?: string;
  reportId?: string;
  startedAt?: string; // ISO timestamp
  report?: MasterEvaluationReport;
  errorReason?: string;
}

export interface CompletionViewModel {
  mode: "report" | "processing" | "failed" | "queued";
  report?: MasterEvaluationReport;
  errorReason?: string;
  processingElapsedMs?: number;
}

export interface MasterEvaluationReport {
  reportType?: 'heuristic' | 'final_ai';
  evaluationStatus?: string;
  executiveSummary: {
    recommendation: 'Strong Hire' | 'Hire' | 'Consider' | 'Reject' | 'NOT GENERATED';
    recommendationStatus: 'normal' | 'insufficient_evidence' | 'processing';
    technicalScore: number; // 0-100
    trustScore: number; // 0-100 (trustAdjustedScore)
    readinessScore?: number; // NEW
    interviewPerformanceScore?: number; // NEW
    candidateLevel?: string; // NEW
    growthPotential?: number; // NEW
    improvementOpportunity?: number; // NEW
    confidenceGap?: number; // NEW
    answerReliabilityScore?: number; // NEW
    topicCoverage: number; // 0-100
    knowledgeStability: number; // 0-100 (knowledgeStabilityScore)
    reportConfidence: 'High' | 'Medium' | 'Low';
    summary: string;
    honestyScore?: number; // 0-100%
    bluffRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
    bluffIncidents?: number;
    knowledgeAdmissionScore?: number; // 0-100%
  };
  candidateOutcome?: CandidateOutcome;
  wasOverridden?: boolean;
  reviewerNotes?: string;
  reviewerName?: string;
  reviewedAt?: string;
  overallScores: {
    knowledgeScore: number; // 0-100
    reasoningScore: number; // 0-100
    communicationScore: number; // 0-100
    consistencyScore: number; // 0-100
    difficultyWeightedPerformance: number; // 0-100
    trustAdjustedScore: number; // 0-100
    readinessScore?: number; // NEW
    interviewPerformanceScore?: number; // NEW
    growthPotential?: number; // NEW
    improvementOpportunity?: number; // NEW
    confidenceGap?: number; // NEW
    answerReliabilityScore?: number; // NEW
    honestyScore?: number; // 0-100%
    bluffRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
    bluffIncidents?: number;
    knowledgeAdmissionScore?: number; // 0-100%
  };
  strengths: string[];
  weaknesses: string[];
  topImprovements?: string[]; // NEW
  validationResults: {
    parentQuestion: string;
    parentScore: number;
    followupQuestion: string;
    followupScore: number;
    reliability: number; // 0-100
  }[];
  contradictions: {
    qIndex1: number;
    qIndex2: number;
    explanation: string;
    severity: 'low' | 'medium' | 'high';
    status: 'confirmed' | 'possible' | 'insufficient_evidence';
    confidence: number; // 0-100
  }[];
  performanceTrend: {
    timeline: { qIndex: number; score: number }[];
    trend: 'improving' | 'stable' | 'declining';
  };
  proctoringSummary: {
    faceAwayEvents: number;
    multiplePersonEvents: number;
    tabSwitches: number;
    warningsIssued: number;
    integrityScore: number;
    totalGazeAwayDurationMs?: number;
    longestGazeAwayDurationMs?: number;
    /**
     * Elapsed wall-clock time of the interview.
     *
     * SessionReportView renders this as "Interview Duration". It was being read through an
     * `as any` cast against a type that never declared it and a value ReportGenerator never
     * populated, so every report displayed 0s. Declared here so the omission cannot recur
     * silently.
     */
    sessionDurationMs?: number;
    /** True when the proctoring engine ended the session rather than the candidate finishing it. */
    isTerminated?: boolean;
    /** Recorded cause of termination, when one was captured. */
    terminationReason?: string | null;
  };
  questionBreakdown: {
    questionText: string;
    difficulty: 'easy' | 'medium' | 'hard';
    score: number; // 0-10
    userAnswer: string;
    feedback: FeedbackStructure;
    questionAlignment?: QuestionAlignment;
    mentionedConcepts?: string[];
    explainedConcepts?: string[];
    matchedKeyPoints: string[];
    missingKeyPoints: string[];
    answerType?: 'honest_unknown' | 'keyword_list_only' | 'incorrect_attempt' | 'mixed_understanding' | 'partial_explanation' | 'full_explanation';
    answerQuality?: 'HONEST_UNKNOWN' | 'KEYWORD_LIST' | 'INCORRECT_ATTEMPT' | 'SURFACE_LEVEL' | 'COMPETENT' | 'STRONG' | 'EXPERT';
    honestyScore?: number;
    knowledgeAdmissionScore?: number;
    bluffRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
    misconceptionRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
    confidenceCalibration?: 'UNDERCONFIDENT' | 'CALIBRATED' | 'OVERCONFIDENT';
    technicalErrors: { error: string; severity: 'low' | 'medium' | 'high' }[];
    analysis: {
      coverage: number; // 0-10
      understanding: number; // 0-10
      reasoning: number; // 0-10
      communication: number; // 0-10
    };
    speechMetrics?: { fillerRate: number; pauseRate: number; speakingRate: number };
    transcriptionQualityScore: number; // 0-100
    followupResult?: {
      reliability: number; // 0-100
    };
    evaluationError?: string;
    // MCQ/Aptitude Extensions in Breakdown
    options?: string[];
    correctAnswer?: string;
    explanation?: string;
    imageUrl?: string;
    timeSpentSeconds?: number;
  }[];

  telemetry: {
    followupTriggerRate: number;
    tokenUsage?: TokenUsage;
    modelCalls: number;
  };
  metadata: {
    engineVersion: string;
    profileVersionId: string;
    promptVersion: string;
    pipelineVersion: string;
    schemaVersion: string;
    rubricVersion: string;
    questionBankVersion: string;
    evaluationMode: string;
    provider: string;
    model: string;
  };
  // Aptitude Summary Extension
  aptitudeSummary?: {
    correct: number;
    incorrect: number;
    unattempted: number;
    accuracy: number;
    trustScore: number;
    timeSpentSeconds: number;
    categoryBreakdown: {
      [category: string]: {
        total: number;
        correct: number;
        accuracy: number;
      }
    };
    improvements: string[];
  };
}

export interface EnrichedCompetencyScorecard_v1 {
  competencyKey: 'knowledge' | 'reasoning' | 'problem_solving' | 'communication';
  title: string;
  score: number; // 0-100
  ratingLevel: 'EXPERT' | 'STRONG' | 'COMPETENT' | 'DEVELOPING' | 'NEEDS_WORK';
  evidenceCoverage: 'HIGH' | 'MEDIUM' | 'LOW';
  evidenceSummary: string;
}

export interface EnrichedStrengthItem_v1 {
  skillName: string;
  mechanismExplained: string;
  businessImpact: string;
  evidenceQuestionIndex: number;
}

export interface EnrichedDevelopmentItem_v1 {
  areaName: string;
  tradeoffMissed: string;
  actionablePracticeFormula: string;
  evidenceQuestionIndex: number;
}

export interface EnrichedHiringSignal_v1 {
  signal: 'STRONG CONSIDERATION' | 'CONSIDERATION' | 'CAUTION';
  readinessLevel: string;
  recommendedNextStep: string;
  rationale: string;
}

export interface EnrichedReportDTO_v1 {
  schemaVersion: 'v1.0';
  generatedAt: string;
  layer1_snapshot: {
    overallScore: number;
    matchCategory: 'STRONG MATCH' | 'GOOD MATCH' | 'POTENTIAL MATCH' | 'DEVELOPMENT NEEDED';
    summaryNarrative: string;
    strengthCount: number;
    devAreaCount: number;
  };
  layer2_scorecard: EnrichedCompetencyScorecard_v1[];
  layer3_strengths: EnrichedStrengthItem_v1[];
  layer4_devAreas: EnrichedDevelopmentItem_v1[];
  layer5_evidenceChain: {
    questionIndex: number;
    questionText: string;
    score: number;
    userAnswer: string;
    conceptsCovered: string[];
    conceptsMissed: string[];
    technicalErrors: string[];
    adaptiveProbe?: string;
  }[];
  layer6_hiringSignal: EnrichedHiringSignal_v1;
}


export interface ErrorLog {
  id: string;
  timestamp: string;
  category: 'interview' | 'evaluation' | 'database' | 'system' | 'api' | 'proctoring';
  message: string;
  details?: string;
  sessionId?: string;
  candidateName?: string;
}

export interface ProctoringSettings {
  faceMissingWarningSec: number;
  faceMissingTerminateSec: number;
  tabSwitchWarningCount: number;
  tabSwitchTerminateCount: number;
  multipleFacesWarningCount: number;
  multipleFacesTerminateCount: number;
  cameraOffWarningSec: number;
  cameraOffTerminateSec: number;
  micOffWarningSec: number;
  micOffTerminateSec: number;
  fullscreenExitWarningCount: number;
  fullscreenExitTerminateCount: number;
}

export const DEFAULT_PROCTORING_SETTINGS: ProctoringSettings = {
  faceMissingWarningSec: 10,
  faceMissingTerminateSec: 30,
  tabSwitchWarningCount: 1,
  tabSwitchTerminateCount: 5,
  multipleFacesWarningCount: 1,
  multipleFacesTerminateCount: 3,
  cameraOffWarningSec: 10,
  cameraOffTerminateSec: 30,
  micOffWarningSec: 10,
  micOffTerminateSec: 30,
  fullscreenExitWarningCount: 1,
  fullscreenExitTerminateCount: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHONE CAMERA PROCTORING — CameraProvider Abstraction & Realtime Protocol
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Phone Connection States ─────────────────────────────────────────────────
export type PhoneConnectionState =
  | 'WAITING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'FAILED';

// ─── CameraProvider Interface ────────────────────────────────────────────────
// Interview screens never check if(phone) else(webcam).
// They call provider.initialize(), provider.getPreviewStream(), etc.

export interface CameraProviderStatus {
  connected: boolean;
  battery?: number;            // 0–100, phone only
  latencyMs?: number;          // phone only
  fps: number;
  thermal: 'normal' | 'warm' | 'hot';
}

export type CameraProviderError =
  | { code: 'PHONE_DISCONNECTED'; canReconnect: boolean }
  | { code: 'CAMERA_LOST'; reason: string }
  | { code: 'PERMISSION_DENIED' }
  | { code: 'THERMAL_THROTTLE'; currentFps: number }
  | { code: 'LOW_BATTERY'; level: number };

export interface CameraProviderListener {
  onDetectionFrame(frame: RawDetectionFrame): void;
  onHeartbeat(metrics: HeartbeatMetrics): void;
  onEngineReady(): void;
  onError(error: CameraProviderError): void;
  onStatusChange(status: CameraProviderStatus): void;
  onMediaUploaded?(violationId: string, snapshotUrl: string | null, clipUrl: string | null): void;
}

export interface CameraProvider {
  readonly type: 'local_webcam' | 'phone_camera';

  /** Request permissions and establish the feed. Resolves when ready. */
  initialize(): Promise<void>;

  /** Begin emitting detection frames via the subscriber. */
  start(): void;

  /** Pause frame emission without tearing down. */
  stop(): void;

  /**
   * Returns a MediaStream for live preview in the camera tile.
   * Local webcam: the getUserMedia stream directly.
   * Phone camera: the WebRTC remote video track (360p), or null if WebRTC failed.
   */
  getPreviewStream(): MediaStream | null;

  /** Returns current provider status for UI polling. */
  getStatus(): CameraProviderStatus;

  /** Register a listener for detection frames, heartbeats, and errors. */
  subscribe(listener: CameraProviderListener): void;

  /** Tear down all resources, streams, and connections. */
  dispose(): void;
}

// ─── Versioned Realtime Protocol ─────────────────────────────────────────────
// Every message between phone and desktop follows this structure.
// Sequence numbers enable out-of-order rejection.
// ACKs are required for critical messages (PHONE_CONNECTED, MEDIA_UPLOADED, CAPTURE_VIOLATION).

export const PROCTOR_PROTOCOL_VERSION = 1;

export const PHONE_PROCTORING = {
  HEARTBEAT_INTERVAL_MS: 3000,
  RECONNECT_TIMEOUT_MS: 9000,
  DISCONNECT_TIMEOUT_MS: 20000,
  PRE_FLIGHT_DURATION_MS: 5000,
  DETECTION_FPS: 3,
  TOKEN_EXPIRY_MINUTES: 10,
};

export type ProctorMessageType =
  | 'PHONE_CONNECTED'
  | 'PHONE_DISCONNECTED'
  | 'HEARTBEAT'
  | 'DETECTION_FRAME'
  | 'CAPTURE_VIOLATION'
  | 'MEDIA_UPLOADED'
  | 'WEBRTC_SIGNAL'
  | 'ACK';

export interface ProctorMessage<T = any> {
  version: number;               // Always PROCTOR_PROTOCOL_VERSION
  type: ProctorMessageType;
  timestamp: number;             // Date.now() on sender
  sequence: number;              // Monotonically increasing per sender
  ackSequence?: number;          // For ACK messages: which sequence is being acknowledged
  payload: T;
}

// ─── Typed Payloads ──────────────────────────────────────────────────────────

export interface PhoneConnectedPayload {
  connectionId: string;
  batteryLevel: number | null;
  screenResolution: string;
}

export interface DetectionFramePayload {
  frame: RawDetectionFrame;
  inferenceTimeMs: number;
}

export interface HeartbeatPayload {
  metrics: HeartbeatMetrics;
  batteryLevel: number | null;
  avgInferenceTimeMs: number;
  reconnectCount: number;
}

export interface TimeSyncPayload {
  desktopTimestamp: number;
  phoneTimestamp?: number;
  calculatedOffsetMs?: number;
}

export interface MediaUploadedPayload {
  violationId: string;
  snapshotUrl: string | null;
  clipUrl: string | null;
}

export interface WebRTCSignalPayload {
  signalType: 'offer' | 'answer' | 'ice-candidate';
  data: any;
}

// ─── Evaluation Engine Extensions ─────────────────────────────────────────────

export enum EvaluationMode {
  API = 'API',
  LOCAL = 'LOCAL',
  HYBRID = 'HYBRID'
}

export interface EvaluationConcept {
  id?: string;
  concept: string;
  importance: 'Critical' | 'critical' | 'Important' | 'NiceToHave' | 'high' | 'medium' | 'low';
  aliases?: string[];
  definitionPattern?: string; // regex pattern to detect explanation evidence
  examples?: string[];
  misconceptions?: string[];
}

export enum FatalIssue {
  DID_NOT_ANSWER = 'DID_NOT_ANSWER',
  OFF_TOPIC = 'OFF_TOPIC',
  MAJOR_MISCONCEPTION = 'MAJOR_MISCONCEPTION',
  ANSWERED_DIFFERENT_QUESTION = 'ANSWERED_DIFFERENT_QUESTION',
  NO_EXAMPLE_PROVIDED = 'NO_EXAMPLE_PROVIDED',
  MEMORIZED_TEMPLATE = 'MEMORIZED_TEMPLATE',
  INCOMPLETE_RESPONSE = 'INCOMPLETE_RESPONSE',
  HALLUCINATED_FACTS = 'HALLUCINATED_FACTS'
}

export interface QuestionAlignment {
  answeredQuestion: boolean;
  relevanceScore: number;
  intentScore: number;
  topicScore: number;
  scenarioScore: number;
  evidenceScore: number;
  completenessScore: number;
  misunderstandingDetected: boolean;
  offTopic: boolean;
  genericMemorizedAnswer: boolean;
  answeredDifferentQuestion: boolean;
  requiredElementsMissing: string[];
  fatalIssues: FatalIssue[];
  explanation: string;
}

// ==========================================
// INTERVIEW ASSIGNMENTS
// ==========================================

export type AssignmentStatus = 'INVITED' | 'VERIFIED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABSENT';

export interface InterviewAssignment {
  id: string;
  drive_id: string;
  candidate_email: string;
  candidate_id: string | null;
  assigned_by: string;
  status: AssignmentStatus;
  deadline: string | null;
  max_attempts: number;
  attempts_used: number;
  session_id: string | null;
  notes: string | null;
  company_name?: string;
  assigned_at: string;
  updated_at: string;
  job_title?: string;
  candidate_name?: string;
  overall_score?: number;
  session_started_at?: string;
  session_completed_at?: string;
}

export type ErrorType = 'RateLimitError' | 'TimeoutError' | 'ProviderUnavailableError' | 'InvalidResponseError' | 'NetworkError' | 'UnknownError';

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AIClientSuccess<T> {
  success: true;
  data: T;
  usage: TokenUsage;
  provider: string;
  model: string;
  latencyMs: number;
  tier?: 'free' | 'paid';
  fallbackReason?: string;
}

export interface AIClientFailure {
  success: false;
  errorType: ErrorType;
  retryable: boolean;
  message: string;
}

export type AIClientResponse<T> = AIClientSuccess<T> | AIClientFailure;

export function isFailureStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === 'FAILED' || s === 'FAILED_RETRYABLE' || s === 'FAILED_PERMANENT' || s === 'ERROR';
}

export function isTerminalStatus(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === 'COMPLETED' || s === 'FAILED_PERMANENT' || s === 'FAILED';
}


