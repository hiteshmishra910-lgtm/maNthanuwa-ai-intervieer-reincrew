# Scoring Model

Our evaluation engine produces five core dimension scores (0-10):

## Core Dimensions
1. **Technical Accuracy**: Does the answer correctly describe the facts?
2. **Concept Understanding**: How completely does the candidate understand the underlying mechanisms (e.g., LIFO, memory allocation)?
3. **Reasoning**: Is the logic sound?
4. **Communication**: Is the explanation concise and structured?
5. **Confidence**: Derived from audio/visual cues (if proctoring is enabled) or text pacing.

## Local Mode Heuristics
In `EvaluationCore`, scoring is primarily based on heuristic text analysis:
- **Concept Matching**: Exact or alias matching against a predefined `KnowledgeModel`.
- **Anaphora Resolution**: Replacing pronouns ("it", "they") with recent subjects to improve matching accuracy.
- **Negative Evidence**: Penalizing circular definitions (e.g., "A closure is when you close something").
- **Communication Caps**: Excessively short or excessively long rambling answers have their maximum potential scores capped via the `EvaluationPolicyEngine`.

## Interactive/Hybrid Models
In API-driven modes, we pass the rubric version and `KnowledgeModel` directly to the LLM via prompt injection. The LLM acts as the evaluator and returns a strictly typed JSON matching the dimensions above.
