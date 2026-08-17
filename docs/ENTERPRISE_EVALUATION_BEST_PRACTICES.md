# Reincrew.AI: Enterprise Evaluation Architecture & Best Practices Guide

## 1. Overview of Evaluation Engine Overhaul

Reincrew.AI utilizes a 3-tier evaluation architecture (**Local**, **API**, and **Hybrid**). The evaluation logic underwent a comprehensive engineering overhaul to eliminate score inflation, remove participation trophies, and ensure defensible reporting for recruiters and candidates.

### Key Solved Issues:
1. **Eradication of "Name & College" Score Inflation (Local Mode):**
   - Removed the automatic `4.0/10` fallback floor on schema-less technical questions.
   - Bound **Score Gravity** directly to `KNOWLEDGE_GATE_CAP` (`<= 3.0`). When a candidate demonstrates zero technical concepts, peripheral scores (communication, confidence, reasoning) are automatically clamped down to **0.0–2.0 / 10 (0–20%)**, forcing the hiring recommendation to **"Reject"**.
   - Removed the unconditional `8.0/10` communication score floor.
2. **Unclogging API Mode Reports:**
   - Connected `aiAnalysis` payload in `EvaluationDispatcher.ts`, ensuring API mode generates custom qualitative narrative summaries instead of boilerplate fallback text.
   - Un-hardcoded `technicalErrors: []` in `ReportGenerator.ts`, preserving exact syntax and conceptual blunders on candidate report cards.
   - Removed participation trophies like *"Attempted an explanation"* and *"Kept communication active"* for failing attempts.
3. **Hybrid Mode Calibration & Clean Technical Debt:**
   - Cleaned up deprecated legacy batch files (`runBatchEvaluation()`, `BatchLLMEvaluator.ts`, `BatchLLMSynthesizer.ts`).
   - Hardened `buildBatchEvaluationPrompt` in `shared/promptBuilder.ts` for the live Deno Edge Function (`evaluate-hybrid-job`), setting strict `0–1 / 0–2` score ceilings for fluff and bluffing while preserving candidate-fairness rules (STT glitches, own words, honest unknowns).

---

## 2. Platform Evaluation Modes Comparison

| Mode | Real-Time Latency | Cost per Interview | Evaluation Depth | Recommended Best Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **LOCAL** | ⚡ Instant (~5ms) | 🟢 $0 (Zero API costs) | 🟡 Heuristic / Keyword-based | **Free Candidate Practice & Mock Interviews** |
| **API** | ⏱️ ~1–2 seconds | 🟡 Per-turn LLM cost | 🔵 Full Semantic LLM | **Live Deep Technical Assessments** |
| **HYBRID (Flagship)** | ⚡ Instant (~5ms live) | 🟢 Low Batch LLM cost | 🟢 **100% LLM-Calibrated Reports** | **Enterprise Recruiting & Candidate Hiring** |

---

## 3. Best Practices as You Scale to Enterprise Recruiters

To ensure 100% platform trust, accuracy, and recruiter satisfaction as Reincrew.AI scales, adhere to the following 4 operational best practices:

### 1. Question Taxonomy & Category Tagging Discipline
* **Rule:** Ensure all technical questions in the question bank are explicitly tagged with `type: "technical"` or `interviewCategory: "technical"`.
* **Rationale:** Open-ended behavioral questions (e.g., *"Tell me about yourself"*) carry a legitimate open-ended floor (~7.0) for self-introductions. If a technical Docker or SQL question is accidentally tagged as an "Introduction" or "Behavioral" question, it will inherit the open-ended path. Keeping question metadata clean ensures strict technical evaluation.

### 2. Rich Rubric & Keyword Coverage
* **Rule:** When creating custom company-specific technical questions, always define 3–5 explicit `requiredConcepts` and `rubricRules` in the question bank.
* **Rationale:** Rich rubrics give the Local Heuristic Engine pinpoint precision during real-time client-side scoring, while giving the API/Hybrid LLMs exact criteria to evaluate against.

### 3. Default to HYBRID Mode for Enterprise Hiring Links
* **Rule:** Set **HYBRID** as the default evaluation mode when enterprise recruiters generate interview links.
* **Rationale:** Hybrid mode offers candidates zero-latency live voice interaction during the interview, while delivering recruiters an LLM-audited, 100% calibrated evaluation report upon completion.

### 4. Proctoring Sensor Calibration
* **Rule:** Maintain calibration on anti-cheat telemetry (gaze tracking, multiple face detection, tab switching).
* **Rationale:** The final score presented to recruiters is a **Trust-Adjusted Score** (`technicalScore × integrityScore`). Keeping proctoring sensors accurate ensures cheating candidates are penalized without generating false positives for honest candidates.
