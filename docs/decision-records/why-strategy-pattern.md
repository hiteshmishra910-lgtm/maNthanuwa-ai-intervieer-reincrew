# ADR: Why Strategy Pattern for Evaluation?

## Context
During the V2 architecture migration, we encountered a tight coupling between the interview lifecycle (recording audio, advancing screens) and the evaluation logic (hitting LLMs, parsing tokens). The UI component `DynamicInterviewScreen` knew too much about *how* to evaluate answers.

## Decision
We implemented the Strategy Pattern via `EvaluationStrategy` and `EvaluationDispatcher`.

## Consequences
- **Decoupling**: The React components just say `finalizeInterview(history, mode)`. They don't know if it goes to Gemini or a local token matcher.
- **Testability**: We can test the LLM logic in isolation without spinning up React contexts.
- **Scalability**: Adding a new evaluation mode (e.g. "Strict Video Analysis Mode") just requires implementing a new `EvaluationStrategy` rather than muddying the core lifecycle controllers.
