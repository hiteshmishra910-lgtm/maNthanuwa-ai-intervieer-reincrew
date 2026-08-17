# Reicrew AI — Load Testing Guide

## Overview

This guide explains how to run mass load tests against the Reicrew AI platform to determine its capacity limits, identify bottlenecks, and measure AI cost at scale.

---

## Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Locust Load Generator                     │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ User 1   │  │ User 2   │  │ User 3   │  │ User N   │   │
│  │(interview)│  │(interview)│  │(interview)│  │(interview)│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │              │              │         │
│  ┌────▼──────────────▼──────────────▼──────────────▼─────┐  │
│  │              Simulated Candidate Lifecycle            │  │
│  │  1. Upsert candidate → 2. Create session              │  │
│  │  3. Answer 5 questions (with AI evaluation)           │  │
│  │  4. Follow-up questions (20% probability)             │  │
│  │  5. Contradiction check → 6. Save reports             │  │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ Supabase │ │OpenRouter│ │ MediaPipe│
       │   (DB)   │ │  (AI)   │ │ (Vision) │
       └──────────┘ └──────────┘ └──────────┘
```

---

## Three Test Scenarios

| Scenario | Mock AI | Mock DB | Think Time | What It Tests |
|----------|---------|---------|------------|---------------|
| **Test A** | Yes | No | None | Database write capacity only |
| **Test B** | No | Yes | None | OpenRouter API concurrency only |
| **Test C** | No | No | 20-60s | Real production behavior |

---

## Prerequisites

### 1. Python Environment

```bash
# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (Mac/Linux)
source .venv/bin/activate

# Install dependencies
pip install locust gevent numpy requests psycopg2-binary
```

### 2. Configuration

Edit `performance-tests/config.env` with your actual credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
OPENROUTER_API_KEY=sk-or-your_key
```

### 3. Verify Connectivity

```bash
# Test OpenRouter API
python performance-tests/test_openrouter.py

# Test full database connectivity
python performance-tests/connectivity_audit.py
```

---

## Running Tests

### Quick Start: All Three Scenarios

```bash
python performance-tests/run_scenarios.py
```

This runs Test A → Test B → Test C sequentially and generates a comparison report.

### Run Individual Scenarios

#### Test A: Database Capacity Only
```bash
# Mock AI responses, real DB writes
set MOCK_AI_RESPONSE=true
set MOCK_DB_WRITE=false
set FAST_LOAD_MODE=true
python performance-tests/run_progressive_tests.py
```

#### Test B: OpenRouter Capacity Only
```bash
# Real AI calls, mock DB writes
set MOCK_AI_RESPONSE=false
set MOCK_DB_WRITE=true
set FAST_LOAD_MODE=true
python performance-tests/run_progressive_tests.py
```

#### Test C: Real Production Behavior
```bash
# Real everything, real think time
set MOCK_AI_RESPONSE=false
set MOCK_DB_WRITE=false
set FAST_LOAD_MODE=false
python performance-tests/run_progressive_tests.py
```

### Run with Locust Web UI

```bash
locust -f performance-tests/locustfile.py --host http://localhost
```

Then open `http://localhost:8089` to configure and monitor the test visually.

---

## Progressive Load Tiers

Each scenario tests these user tiers:

### Short Test Mode (Framework Validation)
| Users | Ramp-up | Hold Time |
|-------|---------|-----------|
| 10 | 5s | 10s |
| 25 | 5s | 15s |
| 50 | 10s | 20s |
| 100 | 10s | 30s |
| 200 | 15s | 40s |

### Full Test Mode (Production Validation)
| Users | Ramp-up | Hold Time |
|-------|---------|-----------|
| 10 | 60s | 180s |
| 25 | 120s | 300s |
| 50 | 180s | 300s |
| 100 | 300s | 600s |
| 200 | 600s | 600s |

---

## Hard Stop Conditions

The test automatically aborts if any of these thresholds are breached:

| Condition | Threshold | Description |
|-----------|-----------|-------------|
| Total Error Rate | > 20% | Combined failure rate across all endpoints |
| AI 402 Rate | > 20% | Payment required / free tier exhausted |
| AI 429 Rate | > 30% | Rate limiting triggered |
| P95 Latency | > 30s | 95th percentile response time |

---

## What Each Virtual User Does

Each Locust user simulates a complete candidate interview:

```
1. UPSERT candidate (email-based dedup)
2. GET job_posts → match CSE role
3. CREATE interview_session
4. FOR each of 5 questions:
   a. CALL OpenRouter → AI evaluation
   b. INSERT session_response with scores
   c. 20% chance → generate follow-up question
   d. 20% chance → evaluate follow-up answer
   e. INSERT follow-up response
5. CALL OpenRouter → contradiction check
6. UPSERT evaluation_report
7. INSERT proctoring_events
8. PATCH session → COMPLETED
9. STOP user (one interview per user)
```

---

## Output Files

After each test run, results are saved to `performance-tests/results/`:

| File | Description |
|------|-------------|
| `metadata_{stage}.json` | Core metrics (AI calls, costs, durations) |
| `ai_call_log_{stage}.json` | Detailed per-call latency and status |
| `stats_{stage}_stats.csv` | Locust CSV statistics |
| `report_{stage}.html` | Locust HTML report |
| `capacity_analysis_report.md` | Auto-generated capacity analysis |

### Metadata JSON Structure

```json
{
  "aborted": false,
  "peak_concurrent_ai_requests": 12,
  "total_ai_calls": 350,
  "total_ai_402s": 0,
  "total_ai_429s": 5,
  "total_input_tokens": 1250000,
  "total_output_tokens": 890000,
  "total_ai_cost": 0.42,
  "avg_cost_per_completed_interview": 0.012,
  "supabase_failures": { "401": 0, "429": 3, "500": 0 },
  "interview_duration_avg_sec": 45.2,
  "interview_duration_p95_sec": 62.1,
  "interview_duration_p99_sec": 78.5,
  "completed_interviews": 35,
  "interviews_started": 38
}
```

---

## Capacity Analysis

After running tests, generate the analysis report:

```bash
python performance-tests/analyze_capacity.py
```

This reads all `metadata_*.json` files and produces `capacity_analysis_report.md` with:

- Maximum sustainable concurrent users
- DB vs AI latency breakdown
- Error rate analysis
- Financial cost summary (in INR)
- Bottleneck identification
- Optimization recommendations

---

## Database Audit

Run a comprehensive database performance audit:

```bash
python performance-tests/db_audit.py
```

This checks:
- Table sizes and row counts
- Existing indexes and missing indexes
- Foreign key index status
- pg_stat_statements slow queries
- EXPLAIN ANALYZE benchmarks
- Generates migration SQL for missing indexes

---

## Full Connectivity Audit

```bash
python performance-tests/connectivity_audit.py
```

Tests:
- CRUD operations on all 8 core tables
- Foreign key relationship integrity
- Orphaned row detection
- View accessibility (7 views)
- Storage bucket accessibility
- End-to-end interview pipeline simulation

---

## Interpreting Results

### Healthy System Indicators
- Error rate < 1%
- DB avg latency < 2000ms
- AI avg latency < 15s
- No 429/402 errors
- All interviews completed

### Bottleneck Signs
- Rising error rates at higher tiers
- DB latency spikes (connection pool exhaustion)
- AI 429 errors (rate limiting)
- AI 402 errors (budget exhaustion)
- P95 latency > 30s

### Cost Estimation
Default DeepSeek Chat pricing:
- Input: $0.14 / 1M tokens
- Output: $0.28 / 1M tokens
- ~1 interview = ~5 AI calls (evaluation + follow-ups + contradiction check)
- Approximate cost per interview: $0.01-0.05 depending on answer length

---

## Customization

### Adding More Questions

Edit `CANDIDATE_FLOW_DATA` in `locustfile.py` to add more question/answer pairs.

### Changing User Tiers

Edit `STAGES` in `run_progressive_tests.py`:

```python
STAGES = [
    {"users": 50, "ramp_sec": 30, "hold_sec": 120, "name": "50_users"},
    {"users": 100, "ramp_sec": 60, "hold_sec": 300, "name": "100_users"},
    {"users": 500, "ramp_sec": 120, "hold_sec": 600, "name": "500_users"},
]
```

### Adjusting Hard Stop Thresholds

Edit `monitor_hard_stop()` in `locustfile.py`:

```python
if error_rate > 0.15:  # Lower threshold
    reason = f"Error Rate > 15%"
```

### Mock Response Tuning

Adjust mock AI latency in `call_openrouter()`:

```python
# Currently 800ms-1500ms
sleep_time = random.uniform(0.8, 1.5)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `locust: command not found` | Use `.venv/Scripts/locust` or add to PATH |
| `config.env not found` | Ensure file is at `performance-tests/config.env` |
| All interviews aborted | Check OpenRouter API key validity |
| DB connection errors | Verify Supabase URL and anon key |
| 402 errors immediately | OpenRouter credits exhausted — add funds |
| Tests run too fast | Set `FAST_LOAD_MODE=false` for realistic timing |
