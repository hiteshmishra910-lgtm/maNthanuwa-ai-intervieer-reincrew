# Reicrew AI — Proctoring System

## Overview

The proctoring system provides real-time candidate monitoring during interviews using computer vision, behavioral analysis, and browser event tracking. It generates integrity reports and detects potential cheating behaviors.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Proctoring Engine                   │
│                                                  │
│  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ MediaPipe    │  │  Browser Event Monitor  │  │
│  │ Vision       │  │  - Tab visibility       │  │
│  │ - Face       │  │  - Fullscreen           │  │
│  │ - Gaze       │  │  - Copy/Paste           │  │
│  │ - Landmarks  │  │  - Refresh attempts     │  │
│  └──────┬───────┘  └──────────┬──────────────┘  │
│         │                     │                  │
│  ┌──────▼─────────────────────▼──────────────┐  │
│  │           Proctoring Reducer              │  │
│  │  (State machine for violation tracking)   │  │
│  └──────────────────┬────────────────────────┘  │
│                     │                           │
│  ┌──────────────────▼────────────────────────┐  │
│  │         Violation Logger                  │  │
│  │  (Timeline events + media capture)        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                     │
                     ▼
            ProctoringReport
```

---

## Detection Capabilities

### Face Detection
- **No Face**: Candidate not visible in frame
- **Multiple Faces**: More than one person detected
- **Face Position**: CENTERED / PARTIAL_OUT

### Gaze Tracking
- **Gaze Direction**: center, left, right, up, down, away
- **Gaze Away Duration**: Tracked for threshold violations
- **Head Pose**: Pitch, yaw, roll measurements

### Browser Events
- **Tab Switch**: Background/foreground detection
- **Fullscreen Exit**: Leaving fullscreen mode
- **Copy/Paste**: Clipboard operations
- **Refresh Attempt**: Page refresh detection

### Audio Monitoring
- **Microphone Lost**: Microphone disconnect
- **Camera Lost**: Camera disconnect

---

## Violation Types

| Type | Severity | Description |
|------|----------|-------------|
| `TAB_HIDDEN` | Medium | Tab moved to background |
| `NO_FACE` | High | Face not detected for threshold duration |
| `GAZE_AWAY` | Medium | Gaze away for extended period |
| `MULTIPLE_FACES` | High | Multiple faces in frame |
| `CAMERA_LOST` | High | Camera stream lost |
| `MICROPHONE_LOST` | Medium | Microphone disconnected |
| `REFRESH_ATTEMPT` | High | Page refresh detected |
| `FULLSCREEN_EXIT` | Medium | Exited fullscreen |
| `COPY_PASTE` | Low | Clipboard operation |

---

## State Machine

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│INITIALIZING│───▶│    READY     │───▶│   PERMISSION_   │
└──────────┘     └──────────────┘     │   DENIED        │
                                      └─────────────────┘
     │                                      │
     ▼                                      ▼
┌──────────┐                        ┌─────────────────┐
│  ERROR   │◀───────────────────────│UNSUPPORTED_     │
└──────────┘                        │BROWSER          │
     │                              └─────────────────┘
     ▼
┌──────────┐
│RECOVERING│
└──────────┘
```

---

## Phone Camera Proctoring

### CameraProvider Abstraction
Interview screens use a unified `CameraProvider` interface:

```typescript
interface CameraProvider {
  type: 'local_webcam' | 'phone_camera';
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  getPreviewStream(): MediaStream | null;
  getStatus(): CameraProviderStatus;
  subscribe(listener: CameraProviderListener): void;
  dispose(): void;
}
```

### Implementations
- `LocalCameraProvider` — Standard webcam via `getUserMedia`
- `PhoneCameraProvider` — Phone camera via WebRTC
- `CameraProviderFactory` — Factory for provider selection

### Realtime Protocol
Versioned message protocol for phone-desktop communication:

| Message | Direction | Purpose |
|---------|-----------|---------|
| `PHONE_CONNECTED` | Phone→Desktop | Connection established |
| `HEARTBEAT` | Both | Keepalive with metrics |
| `DETECTION_FRAME` | Phone→Desktop | Face/gaze detection data |
| `CAPTURE_VIOLATION` | Both | Violation snapshot request |
| `MEDIA_UPLOADED` | Phone→Desktop | Violation media upload |
| `WEBRTC_SIGNAL` | Both | WebRTC signaling |
| `ACK` | Both | Message acknowledgment |

### Constants
```typescript
HEARTBEAT_INTERVAL_MS: 3000
RECONNECT_TIMEOUT_MS: 9000
DISCONNECT_TIMEOUT_MS: 20000
DETECTION_FPS: 3
TOKEN_EXPIRY_MINUTES: 10
```

---

## Proctoring Report

```typescript
interface ProctoringReport {
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
  violations: ProctorViolation[];
  timeline: TimelineEvent[];
  sessionDurationMs: number;
  monitoringDurationMs: number;
  healthSummary: MonitoringHealthSummary;
}
```

---

## Proctoring Settings

Default thresholds (configurable per job post):

| Setting | Default | Description |
|---------|---------|-------------|
| `faceMissingWarningSec` | 10s | Warning before termination |
| `faceMissingTerminateSec` | 30s | Auto-terminate threshold |
| `tabSwitchWarningCount` | 2 | Warnings before termination |
| `tabSwitchTerminateCount` | 5 | Auto-terminate threshold |
| `multipleFacesWarningCount` | 1 | Warning before termination |
| `multipleFacesTerminateCount` | 3 | Auto-terminate threshold |
| `cameraOffWarningSec` | 10s | Warning before termination |
| `cameraOffTerminateSec` | 30s | Auto-terminate threshold |
| `micOffWarningSec` | 10s | Warning before termination |
| `micOffTerminateSec` | 30s | Auto-terminate threshold |
| `fullscreenExitWarningCount` | 1 | Warning before termination |
| `fullscreenExitTerminateCount` | 3 | Auto-terminate threshold |

---

## Telemetry

### Heartbeat Metrics
```typescript
interface HeartbeatMetrics {
  fps: number;
  lastDetectionAgoMs: number;
  trackingConfidence: number;
  gazeDirection: string;
  detectionHealth: 'GOOD' | 'LOW_LIGHT' | 'PARTIAL_FACE' | 'UNSTABLE';
  engineState: ProctoringEngineState;
}
```

### Monitoring Health Summary
```typescript
interface MonitoringHealthSummary {
  monitoringCoveragePercent: number;
  averageTrackingConfidence: number;
  totalDetectionFrames: number;
  stalledPeriods: number;
  longestNoFaceDurationMs: number;
  longestGazeAwayDurationMs: number;
}
```
