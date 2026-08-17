<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Reincrew.AI — Smart AI Interview & Proctoring Platform

Reincrew.AI is a state-of-the-art, AI-driven candidate evaluation and interview platform designed to automate and streamline the recruitment pipeline. Combining conversational artificial intelligence with real-time video proctoring, aptitude testing, multi-category evaluation metrics, and dual-engine scoring (AI LLM + Local Heuristics), Reincrew.AI provides a comprehensive, recruiter-grade assessment of candidate capabilities and integrity.

---

## 🚀 Key Features

- **Dynamic AI-Guided Interviews**: Conducts live verbal assessments where candidate responses are transcribed in real-time with automatic speech-to-text (STT) recovery, followed by adaptive follow-up questions targeting specific candidate claims to verify depth and detect bluffing.
- **Multi-Category Question Routing**: Automatically categorizes questions into **Technical Engineering**, **Behavioral Experience**, **Situational Scenarios**, and **Introductory HR** categories with realistic, evidence-grounded scoring bands.
- **Dynamic Content Evidence Inspector**: Guarantees non-hallucinatory evaluation report cards by dynamically analyzing spoken transcript text—ensuring breakdown notes only cite concepts and claims the candidate actually stated.
- **Dual AI Provider Load-Balancing & Failover**: High-speed multi-provider AI routing with dynamic load balancing, fallback key rotation, and instant local engine fallback (< 5ms).
- **Real-Time Video Proctoring & Trust Score**: Integrated video proctoring utilizing MediaPipe Vision (Face Landmarker) and browser proctoring to track gaze-away events, tab switching, and compute an overall candidate integrity score (0–100).
- **Aptitude Testing Module**: Time-tracked multiple-choice assessments across key reasoning categories (Quantitative, Logical, Analytical, Verbal) with automated scoring.
- **Executive Recruiter Dashboard**: Secure administrative console allowing recruiters to view candidate session reports, playback video proctoring snapshots/clips, inspect detailed transcripts, and review synthesized hiring recommendations (*Strong Hire*, *Hire*, *Consider*, *Reject*).

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons.
- **Authentication**: Clerk Authentication.
- **Backend & Database**: Supabase (PostgreSQL, Storage, Edge Functions).
- **AI Orchestration**: Multi-provider AI services with dynamic load balancing and instant local fallback (< 5ms).
- **Computer Vision**: MediaPipe Tasks Vision for real-time gaze and face tracking.

---

## ⚙️ Environment Configuration

To run the application locally, create a `.env` or `.env.local` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# AI Service Key
VITE_AI_SERVICE_KEY=your_ai_service_key

# Storage & Admin Configuration
VITE_ADMIN_PASSWORD=your_admin_password
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

---

## 💻 Getting Started

### Prerequisites

Ensure you have **Node.js** (v18.0.0 or higher) installed.

### Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/pranitakhobe22-cell/Reincrew.AI.git
   cd Reincrew.AI
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create `.env.local` as detailed in the [Environment Configuration](#️-environment-configuration) section.

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 📊 Evaluation Modes & Load Testing

Reincrew.AI supports 3 distinct evaluation execution modes depending on speed and depth requirements:

| Mode | Evaluator Engine | Latency | Primary Use Case |
| :--- | :--- | :--- | :--- |
| **LOCAL** | Heuristic NLP Core (`EvaluationCore`) | **~2ms** | High-volume instant screening & zero API cost |
| **HYBRID** | Instant LOCAL + Queued AI Async Batch | **~2ms + 1.6s async** | Balanced live candidate flow with async LLM report generation |
| **API** | Real-time Multi-Provider LLM | **~1.2s** | Real-time critical assessments requiring deep qualitative LLM feedback |

### Running Load Tests

```bash
# Local pipeline load tests
npm run load-test:local:small     # 5 candidates, 3 questions
npm run load-test:local           # 10 candidates, 5 questions
npm run load-test:local:large     # 30 candidates, 10 questions

# Hybrid and API mode tests
npm run load-test:hybrid          # HYBRID mode
npm run load-test:api             # API mode
```

---

## 📁 Project Structure

```
├── src/
│   ├── Admin/          # Administrative console & candidate management
│   ├── Analytics/      # Session reports & recruiter breakdown views
│   ├── Core/           # AI clients, database & monitoring
│   ├── Evaluation/     # NLP heuristic engines & AI dispatchers
│   ├── Interview/      # Speech recognition, audio capture & interview state
│   └── Proctoring/     # MediaPipe vision, face tracking & proctoring queue
├── shared/             # Shared scoring policies, rubrics & prompt safety
├── supabase/           # Database migrations & Edge Functions
└── services/           # Load testing & simulation suites
```
