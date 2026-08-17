# Performance Tests

This directory contains load tests and benchmarks for the Reicrew AI system.

## Files

| File | What It Tests | How to Run |
|---|---|---|
| `k6_load_test.js` | **Database & API throughput** — CRUD operations, edge function availability. Progressive VUs (smoke → 10 → 25 → 50 → 100). | `k6 run -e STAGE=smoke performance-tests/k6_load_test.js` |
| `k6_evaluation_test.js` | **Evaluation mode infrastructure** — DB patterns for LOCAL, HYBRID, and API modes. Measures write throughput, edge function latency, session completion. | `k6 run -e EVAL_MODE=hybrid performance-tests/k6_evaluation_test.js` |
| `local-evaluation-benchmark.ts` | **Actual LOCAL pipeline (16 modules)** — runs the real EvaluationCore TypeScript pipeline in Node. Measures per-evaluation latency and throughput. | `npx tsx performance-tests/local-evaluation-benchmark.ts 500 10` |
| `run_k6.ps1` | Progressive runner — runs all 5 stages of `k6_load_test.js` with a single command. | `.\performance-tests\run_k6.ps1` |
| `run_k6.sh` | Linux/macOS equivalent of `run_k6.ps1`. | `bash performance-tests/run_k6.sh` |
| `config.env.example` | Template for Supabase credentials. | Copy to `config.env` and fill in keys. |

## Choosing the Right Test

### For production-readiness checks:
```
k6 run -e STAGE=50 performance-tests/k6_load_test.js
```
This tests DB + edge function infrastructure at 50 concurrent users.

### For comparing evaluation modes:
```
k6 run -e EVAL_MODE=all -e STAGE=10 performance-tests/k6_evaluation_test.js
```
Runs all three modes sequentially per iteration at 10 concurrent users.

### For LOCAL pipeline speed:
```
npx tsx performance-tests/local-evaluation-benchmark.ts 1000
```
Actually runs the 16-module TypeScript pipeline 1000 times and reports latency.

## Notes on Auth

- **DB operations** (REST API) use the `apikey` header (anon key). Works out of the box.
- **Edge function calls** (`openrouter-proxy`, `ai-fallback`) require a valid Clerk JWT in the `Authorization` header. Without one, the edge function returns 401. The test still measures response time and availability.

To get a real token for edge function testing:
1. Log in via the Reicrew AI frontend
2. Open DevTools → Application → Session Storage → `clerk-db-jwt`
3. Copy the JWT value
4. Pass it to k6: `k6 run -e CLERK_TOKEN="..." performance-tests/k6_evaluation_test.js`
