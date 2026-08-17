# Reicrew AI — React Components

## Component Tree

```
App (App.tsx)
├── ErrorBoundary
│   ├── LandingScreen
│   ├── DynamicInterviewScreen
│   │   ├── PreFlightCheck
│   │   ├── CameraCheckScreen
│   │   ├── AptitudeTestScreen
│   │   ├── MonitoringDashboard
│   │   ├── CameraMonitor / CameraPreview
│   │   ├── CameraAnalysis
│   │   └── EndScreen
│   ├── AdminDashboard
│   │   └── SessionReportView
│   └── MobileProctorScreen
```

---

## Component Reference

### `App.tsx` — Root Application
- Entry point with state management for interview flow
- Handles Clerk authentication and Supabase token refresh
- Routes: `/admin`, `/proctor/phone-camera`, default interview flow
- States: `landing → interview → completed`

### `LandingScreen.tsx`
- Candidate intake form (name, email, role selection)
- Clerk sign-in integration
- Admin access trigger
- Role options: CSE, ETC, AI, DS, CYBER, EE, ME, CE, IT

### `DynamicInterviewScreen.tsx`
- Main interview orchestrator component
- Manages interview lifecycle: camera check → aptitude test → voice interview
- Coordinates proctoring engine, speech recognition, and AI evaluation
- Handles question flow, follow-ups, and session completion

### `PreFlightCheck.tsx`
- Pre-interview system check
- Validates camera, microphone, lighting, network
- Displays setup progress with status indicators

### `CameraCheckScreen.tsx`
- Camera preview and validation before interview
- Tests webcam functionality
- Displays camera feed quality metrics

### `AptitudeTestScreen.tsx`
- Time-tracked MCQ assessment
- Categories: Quantitative, Logical, Analytical, Verbal
- Auto-scoring with difficulty weighting
- Timer per question with navigation

### `MonitoringDashboard.tsx`
- Real-time proctoring display
- Shows face detection, gaze tracking, violation count
- Live telemetry metrics (FPS, tracking confidence)
- Risk score visualization

### `CameraMonitor.tsx` / `CameraPreview.tsx`
- Camera feed display components
- CameraMonitor: Proctoring-annotated feed
- CameraPreview: Simple preview for setup

### `CameraAnalysis.tsx`
- Displays camera analysis results
- Face detection status and gaze direction
- Visual metrics overlay

### `AdminDashboard.tsx`
- Secure admin console
- View all interview sessions
- Access session recordings, transcripts, evaluations
- Proctoring heatmaps and violation logs
- Job post configuration and seeding

### `SessionReportView.tsx`
- Detailed session report viewer
- Question-by-question breakdown
- Evaluation scores and feedback
- Proctoring summary

### `EndScreen.tsx`
- Post-interview completion screen
- Displays final score and summary
- Session feedback summary

### `MobileProctorScreen.tsx`
- Phone camera proctoring interface
- WebRTC connection to desktop client
- QR code pairing for device linking
- Real-time frame streaming

### `ErrorBoundary.tsx`
- React error boundary
- Catches and displays component errors gracefully

### `Logo.tsx`
- Reicrew AI logo component

### `PasswordReset.tsx`
- Password reset flow UI

---

## Key Props Patterns

### Candidate Object
```typescript
interface Candidate {
  name: string;
  email: string;
  role: string;
  clerkUserId: string;
  clerkToken: string;
  jobPostId?: string;
  session?: InterviewSession;
}
```

### Interview Complete Callback
```typescript
onComplete: (
  history: { question: string; answer: string; ideal_answer: string }[],
  proctoringReport: ProctoringReport,
  evalReport: MasterEvaluationReport
) => void
```
