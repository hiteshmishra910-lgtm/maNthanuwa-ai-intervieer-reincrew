# Reicrew AI — Services & API Reference

## Service Layer Overview

The service layer handles all business logic, external API calls, and data persistence.

---

## Core Services

### `aiService.ts`
Main AI interaction service for generating follow-up questions and evaluations.

**Key Methods:**
- `generateFollowUpQuestion()` — Creates adaptive follow-up questions
- `evaluateAnswer()` — AI-powered answer evaluation
- `generateReport()` — Creates comprehensive evaluation report

### `aiProviderManager.ts`
Manages multiple AI provider configurations and failover.

**Features:**
- Provider rotation and load balancing
- API key management
- Rate limiting
- Error handling and retry logic

### `aiProviders.config.ts`
Configuration for AI providers:
- OpenRouter API (primary)
- Gemini API (via Vite proxy)
- Fallback configurations

### `apiKeyManager.ts`
Secure API key management with encryption and rotation.

---

## Database Services

### `supabaseClient.ts`
Supabase client initialization with Clerk JWT integration.

```typescript
import { supabase, setSupabaseAuthToken } from './supabaseClient';
// Token is set from Clerk JWT
setSupabaseAuthToken(clerkToken);
```

### `supabaseService.ts`
Database operations for sessions, candidates, and evaluations.

**Key Methods:**
- `upsertCandidate()` — Create/update candidate record
- `createSession()` — Start new interview session
- `saveEvaluationReport()` — Store evaluation results
- `saveProctoringReport()` — Store proctoring data
- `completeSession()` — Mark session as completed
- `getAllJobs()` — Fetch job posts
- `seedDefaultJobsIfMissing()` — Initialize default jobs
- `initializeSystemSettings()` — Setup system config

### `storageService.ts`
File storage operations via Supabase Storage.

---

## Media Services

### `mediaPipeService.ts`
MediaPipe Tasks Vision integration for face/gaze tracking.

**Capabilities:**
- Face landmark detection
- Gaze direction estimation
- Head pose measurement
- Real-time frame processing

### `mediaCaptureService.ts`
Capture snapshots and video clips for violation evidence.

### `cloudinaryService.ts`
Cloudinary integration for media upload and management.

---

## Camera Providers (`services/cameraProviders/`)

### `CameraProviderFactory.ts`
Factory for selecting camera provider:
```typescript
const provider = CameraProviderFactory.create('phone_camera');
await provider.initialize();
provider.start();
```

### `LocalCameraProvider.ts`
Standard webcam implementation via `getUserMedia`.

### `PhoneCameraProvider.ts`
Phone camera implementation via WebRTC realtime channel.

---

## Monitoring Services

### `healthService.ts`
System health checks for database, storage, and auth.

```typescript
interface SystemHealth {
  database: boolean;
  storage: boolean;
  auth: boolean;
  errors: string[];
}
```

### `telemetryService.ts`
Telemetry data collection and reporting.

### `monitoringUtils.ts`
Utility functions for monitoring calculations.

### `PerformanceLogger.ts`
Performance metrics logging and tracking.

---

## Support Services

### `adminAccess.ts`
Admin email verification and access control.

### `cleanupService.ts`
Session and data cleanup operations.

### `deviceFingerprint.ts`
Device fingerprinting for session tracking.

### `errorLogService.ts`
Error logging and categorization.

```typescript
ErrorLogService.logError(
  category: 'interview' | 'evaluation' | 'database' | 'system' | 'api' | 'proctoring',
  message: string,
  details?: any,
  sessionId?: string,
  candidateName?: string
);
```

### `questionBank.ts`
Question bank management and retrieval.

### `speechDictionary.ts`
Speech recognition dictionary and custom words.

### `jobSeedRepository.ts`
Default job post data for seeding.

### `MobileProctorService.ts`
Mobile proctoring WebRTC connection management.

---

## Supabase Edge Functions (`supabase/functions/`)

### `openrouter-proxy/index.ts`
Proxies AI API requests to OpenRouter, keeping API keys server-side.

### `ai-fallback/index.ts`
Fallback AI handler when primary provider fails.

### `admin-auth/index.ts`
Server-side admin authentication verification.

### `cloudinary-sign/index.ts`
Generates signed upload URLs for Cloudinary.

### `cleaup-proctoring-media/index.ts`
Scheduled cleanup of old proctoring media files.

---

## API Flow Diagrams

### Interview Start Flow
```
1. Clerk Auth → JWT Token
2. upsertCandidate(name, email, role)
3. getAllJobs() → Match job post
4. createSession(candidateId, jobPostId, fingerprint)
5. Return session object
```

### Evaluation Flow
```
1. Receive question + answer
2. Pipeline processing (28+ modules)
3. Local scoring
4. AI evaluation (if available)
5. Generate EvaluationResult
6. Save to Supabase
```

### Proctoring Flow
```
1. Initialize MediaPipe
2. Start detection loop (3 FPS)
3. Process frames → DetectionFrame
4. Reducer processes events
5. Generate violations on threshold breach
6. Save ProctoringReport
```
