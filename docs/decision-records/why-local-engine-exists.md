# ADR: Why Does LocalEvaluationEngine Exist?

## Context
During the V2 architecture migration, it was tempting to delete `EvaluationCore` entirely and rely 100% on cloud LLMs (Interactive Mode).

## Decision
We actively preserved `EvaluationCore` and wired it into `LocalEvaluationStrategy`.

## Consequences
- **Cost Efficiency**: Not every mock interview or practice round needs a $0.05 LLM call.
- **Latency**: Local processing is deterministic and takes ~20ms, allowing instantaneous UI feedback in Hybrid mode before the final LLM report is generated.
- **Resilience**: If the API goes down, the application can gracefully fall back to Local Mode. A purely cloud-based evaluation engine would result in total system failure during an outage.
