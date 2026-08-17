# Evaluation Lifecycle

This document explains the lifecycle of a candidate's answer from submission to the final generated report.

## The Journey of an Answer

### 1. Interview Start
- The candidate begins the interview. The UI loads `DynamicInterviewScreen`.
- `InterviewFlowController` takes over routing questions.
- It pulls the current question from the `QuestionBank` based on the selected `EvaluationProfile`.

### 2. Answer Submission
- Candidate submits an answer via voice or text.
- `InterviewFlowController` wraps this answer into the standard `EvaluationContext` format.

### 3. Dispatching
- The context is passed to `EvaluationDispatcher`.
- The dispatcher inspects the session mode (Local, Interactive, Hybrid) and resolves the appropriate `EvaluationStrategy`.

### 4. Engine Processing
- **Local**: Immediately processed via `EvaluationCore` using heuristic tokenization and concept matching.
- **Interactive**: Passed to `apiService` where an LLM processes it in real-time. If the LLM fails, it triggers a fallback.
- **Hybrid**: Processed locally for real-time flow, but marked for deep LLM evaluation later.

### 5. Final Report Generation
- Once the interview concludes, `EvaluationDispatcher.finalizeInterview()` is called.
- For Hybrid mode, it queues a background job.
- For Local/Interactive, it immediately calls `ReportGenerator.computeFinalReport()`.
- The `MasterEvaluationReport` is created and stored in the database, containing a full snapshot of all active versions (`engineVersion`, `rubricVersion`, etc.).
