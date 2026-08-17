# Reicrew AI — System Architecture

## Overview

Reicrew AI is an AI-driven candidate evaluation and interview platform built with React, TypeScript, and Supabase. The system combines conversational AI interviews, real-time video proctoring, aptitude testing, and comprehensive evaluation reports.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (React SPA)                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Interview   │  │  Proctoring  │  │   Admin Dashboard  │  │
│  │   Screen     │  │    Engine    │  │                    │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                │                    │              │
│  ┌──────▼────────────────▼────────────────────▼───────────┐  │
│  │              Services Layer                            │  │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │ AI Svc  │ │ Eval     │ │ Pipeline │ │ Proctor   │  │  │
│  │  │         │ │ Engine   │ │ Modules  │ │ Service   │  │  │
│  │  └────┬────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │  │
│  └───────┼───────────┼────────────┼──────────────┼────────┘  │
└──────────┼───────────┼────────────┼──────────────┼──────────┘
           │           │            │              │
    ┌──────▼───────────▼────────────▼──────────────▼──────────┐
    │                   Backend Services                       │
    │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
    │  │ Supabase │  │ OpenRouter│  │ MediaPipe Vision     │  │
    │  │ (DB/Auth)│  │ (AI API) │  │ (Face/Gaze Tracking) │  │
    │  └──────────┘  └──────────┘  └──────────────────────┘  │
    └─────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. Interview Flow Controller
- **File**: `hooks/useInterviewFlowController.ts`
- Manages interview state machine: `welcome → setup → camera-check → active → completed`
- Orchestrates question loading, answer capture, evaluation, and follow-up generation

### 2. Evaluation Engine (`services/evaluation/`)
- **Strategy Pattern**: Multiple evaluation engines behind a common interface
  - `ApiInterviewEvaluationEngine` — Full AI-powered evaluation via OpenRouter
  - `LocalInterviewEvaluationEngine` — Local heuristic-based fallback
  - `HybridInterviewEvaluationEngine` — Combines API and local evaluation
- **Factory**: `EvaluationFactory.ts` selects the appropriate engine
- **Queue**: `EvaluationQueue.ts` manages concurrent evaluation requests

### 3. Evaluation Pipeline (`services/pipeline/`)
- Modular pipeline of 28+ analysis modules
- Each module implements `EvaluationModule` interface
- Modules execute sequentially on a shared `PipelineContext`
- Key modules:
  - `ConceptMatcher` — Matches answer concepts against knowledge model
  - `TechnicalRulesDetector` — Detects technical errors
  - `ConfidenceAnalyzer` — Measures answer confidence calibration
  - `CommunicationAnalyzer` — Evaluates clarity and structure
  - `MisconceptionDetector` — Identifies misconceptions
  - `StructuralContradictionDetector` — Finds contradictions

### 4. Proctoring System
- Real-time face/gaze tracking via MediaPipe Tasks Vision
- Violation detection: gaze away, multiple faces, tab switching
- Phone camera support via WebRTC with `CameraProvider` abstraction
- Generates `ProctoringReport` with integrity score

### 5. AI Service Layer
- `aiService.ts` — Main AI interaction service
- `aiProviderManager.ts` — Manages multiple AI providers
- `aiProviders.config.ts` — Provider configuration
- Primary provider: OpenRouter API (DeepSeek Chat model)

---

## Data Flow

```
Candidate Session Start
        │
        ▼
┌─────────────────┐
│  Clerk Auth     │──► Supabase JWT Token
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Create Session │──► Supabase DB
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Ask Question   │◄────│  Question Bank   │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Capture Answer │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────────┐
│ Evaluate│ │ Proctoring │
│ (AI)   │ │ (MediaPipe)│
└───┬────┘ └─────┬──────┘
    │             │
    ▼             ▼
┌─────────────────────┐
│  Follow-up or Next  │
│  Question           │
└─────────┬───────────┘
          │
          ▼ (repeat until done)
┌─────────────────────┐
│  Generate Report    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Save to Supabase   │
└─────────────────────┘
```

---

## Directory Structure

```
├── App.tsx                    # Root app component with routing
├── index.tsx                  # Entry point
├── types.ts                   # Global TypeScript definitions
├── components/                # React UI components
│   ├── LandingScreen.tsx      # Candidate intake form
│   ├── DynamicInterviewScreen.tsx  # Main interview orchestrator
│   ├── AptitudeTestScreen.tsx # MCQ aptitude test
│   ├── AdminDashboard.tsx     # Admin console
│   ├── MonitoringDashboard.tsx # Proctoring monitoring UI
│   ├── MobileProctorScreen.tsx # Phone camera proctoring
│   ├── SessionReportView.tsx  # Session report display
│   └── ...
├── services/                  # Business logic
│   ├── aiService.ts           # AI API interactions
│   ├── aiProviderManager.ts   # Multi-provider AI management
│   ├── supabaseService.ts     # Database operations
│   ├── supabaseClient.ts      # Supabase client setup
│   ├── healthService.ts       # System health checks
│   ├── mediaPipeService.ts    # MediaPipe vision integration
│   ├── evaluation/            # Evaluation engine modules
│   ├── pipeline/              # Evaluation pipeline modules
│   ├── cameraProviders/       # Camera abstraction layer
│   └── telemetry/             # Telemetry and logging
├── hooks/                     # React hooks
│   ├── useInterviewFlowController.ts
│   ├── useSpeech.ts
│   └── useAudioLevel.ts
├── supabase/                  # Supabase Edge Functions
│   └── functions/
│       ├── openrouter-proxy/  # AI API proxy
│       ├── ai-fallback/       # Fallback AI handler
│       ├── admin-auth/        # Admin authentication
│       └── ...
├── tests/                     # Unit/integration tests
├── performance-tests/         # Load testing scripts (Python)
└── styles/                    # CSS/Tailwind styles
```

---

## Key Design Patterns

| Pattern | Usage |
|---------|-------|
| Strategy | Evaluation engines (API, Local, Hybrid) |
| Pipeline | Modular evaluation processing |
| Factory | Engine selection via `EvaluationFactory` |
| Observer | Proctoring event system |
| Abstraction | `CameraProvider` for webcam/phone |
| State Machine | Interview flow states |
| Queue | `EvaluationQueue` for async evaluation |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, TypeScript 5.8, Tailwind CSS |
| Auth | Clerk Authentication |
| Database | Supabase (PostgreSQL) |
| AI | OpenRouter API (DeepSeek Chat) |
| Vision | MediaPipe Tasks Vision |
| Testing | Vitest, Testing Library |
| Deployment | Vercel, Docker |
| Icons | Lucide React |
