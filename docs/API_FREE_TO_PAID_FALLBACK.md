# Free → Paid API Fallback Architecture & Deployment Guide

## 📌 Overview

This document explains the **Automatic Free → Paid API Tier Fallback System** implemented for Reincrew AI interview evaluation.

### Problem Solved
Previously, when the free API key (e.g., OpenRouter `free-models-per-day` quota) ran out of credits or encountered a `429 Too Many Requests` rate limit, interview evaluations would fail, degrading candidate experience. 

### Solution
The system now implements **automatic tiered failover**:
1. **Free-First Routing**: All interview evaluations try the free API tier first to conserve paid credits.
2. **Instant Fallback**: If the free tier encounters rate limits (429), quota exhaustion, timeouts, 5xx server errors, or network failures, the request automatically escalates to the paid API tier.
3. **Session Latching**: When a candidate's session escalates to paid mid-interview, subsequent questions in that session use the paid tier directly to prevent repeated 25-second timeouts on every question. The latch automatically expires after **5 minutes** so subsequent interviews retry the free tier.
4. **Zero UI / 100% Invisible**: No candidate or admin dropdowns/toggles exist. Routing is completely automatic behind the scenes.
5. **Strict Secret Security**: Paid API keys live **exclusively** in Supabase Edge Function secrets on the server. No paid keys ever reach the client JS bundle.

---

## 🛠️ System Architecture

```
[Candidate Client (SPA)]
          │
          ▼ 1. Try Free Tier
  [openrouter-proxy Edge Function] ──── (Status: 200 OK) ──► Evaluation Complete
          │
          ▼ 2. Free Tier Fails (429 / Quota / Timeout)
  [OpenRouterClient Escalation]
          │
          ▼ 3. Request { tier: "paid" }
  [openrouter-proxy / ai-fallback]
          │ (Reads PAID_OPENROUTER_API_KEY / PAID_GEMINI_API_KEY from Server Secrets)
          ▼
  [Paid LLM Provider (Gemini 2.0 Flash / OpenRouter Paid)]
          │
          ▼ 4. Success ──► Latch Session to Paid (5 min TTL) & Log to ai_provider_logs
```

---

## 📂 Changed & Added Files

| File | Type | Description |
|---|---|---|
| `src/Core/ai/apiTierManager.ts` | 🆕 New | Manages session tier state, 5-minute TTL latches, reason classification, and fallback event logging. |
| `src/Core/ai/openRouterClient.ts` | ✏️ Modified | Orchestrates tiered generation (`runFreeTier` → `invokePaidTier`) and guards browser environment calls. |
| `supabase/functions/_shared/aiClient.ts` | ✏️ Modified | Accepts `tier: "paid"` and routes calls to server-side paid secrets (`PAID_OPENROUTER_API_KEY`, `PAID_GEMINI_API_KEY`). |
| `supabase/functions/openrouter-proxy/index.ts` | ✏️ Modified | Passes tier parameters and records `provider_tier` and `fallback_reason` in `ai_provider_logs`. |
| `supabase/functions/ai-fallback/index.ts` | ✏️ Modified | Added session validation, telemetry logging, and updated rate limits to filter on `provider_tier = 'free'`. |
| `supabase/migrations/20260812000001_add_tier_columns_provider_logs.sql` | 🆕 New | Adds `provider_tier` and `fallback_reason` columns to `ai_provider_logs`. |
| `tests/apiTierFallback.test.ts` | 🆕 New | Comprehensive suite of 16 unit tests covering all failover, latching, and edge-case scenarios. |
| `.env.example` | ✏️ Modified | Updated comments describing server-side secret configuration. |

---

## 🚀 Setup & Deployment Checklist for the Team

Follow these steps to enable paid API fallback in any environment (Staging / Production):

### Step 1: Apply Database Migration
Apply the column additions to `ai_provider_logs`.

**Option A: Supabase Dashboard (Recommended)**
Open **Supabase Dashboard** → **SQL Editor**, paste and run:
```sql
ALTER TABLE ai_provider_logs
  ADD COLUMN IF NOT EXISTS provider_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS fallback_reason TEXT;
```

**Option B: Supabase CLI**
```bash
npx supabase db push
```

---

### Step 2: Configure Server-Side Paid Secrets
Set your paid API key(s) as Supabase Edge Function secrets. (No client environment variables are needed).

**Using Supabase CLI:**
```bash
# Set OpenRouter paid key
supabase secrets set PAID_OPENROUTER_API_KEY=sk-or-v1-your-paid-key

# OR set Gemini paid key
supabase secrets set PAID_GEMINI_API_KEY=AIzaSy-your-paid-key

# (Optional) Set paid model override (defaults to gemini-2.0-flash)
supabase secrets set PAID_MODEL=gemini-2.0-flash
```

**Or via Supabase Dashboard:**
Navigate to **Project Settings** → **Edge Functions** → **Secrets** and add:
- `PAID_OPENROUTER_API_KEY` (or `PAID_GEMINI_API_KEY`)
- `PAID_MODEL` (optional, e.g., `gemini-2.0-flash`)

---

### Step 3: Deploy Edge Functions
Deploy the updated edge functions to your Supabase project:
```bash
supabase functions deploy openrouter-proxy
supabase functions deploy ai-fallback
```

---

## 🧪 Verification & Testing

### Running Automated Unit Tests
Run the Vitest suite to verify tier fallback logic:
```bash
npx vitest run tests/apiTierFallback.test.ts
```
*Expected Output: 16 passed (16)*

### Observing Fallback Events in Database
To inspect fallback events in production, query the `ai_provider_logs` table:
```sql
SELECT session_id, provider_name, model_used, provider_tier, fallback_reason, created_at
FROM ai_provider_logs
WHERE provider_tier = 'paid'
ORDER BY created_at DESC;
```

---

## 🛡️ Maintenance & Behavior Notes
- **What happens if no paid key is configured on the server?**  
  If the free tier fails and no paid secret is configured on Supabase, the request returns a clean failure message without crashing the UI.
- **How long does session latching last?**  
  5 minutes (`LATCH_TTL_MS = 300,000`). After 5 minutes of inactivity, the session unlatches and subsequent requests attempt the free tier first.
