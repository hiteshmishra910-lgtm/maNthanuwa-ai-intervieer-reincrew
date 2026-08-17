# Troubleshooting

## API Provider Failures
If you notice high failure rates in evaluations (scores capping unexpectedly at `60` with generic feedback), the API provider might be down.
1. Check the `evaluation_audit_log` table where `has_fallback = true`.
2. Inspect `debug_snapshot` to see the underlying error returned by the edge function (`ai-fallback`).
3. The application gracefully recovers by switching to `DeepSeek` or returning the Local fallback response, but latency will be inherently higher.

## Missing Profiles
If an interview fails to start or defaults to un-weighted scores:
- `ProfileService` likely failed to fetch from the DB.
- It falls back to `EVALUATION_PROFILES_REGISTRY`. Ensure `supabaseClient.ts` is configured correctly with active keys.

## Hybrid Mode Worker Crashes
If a candidate completes an interview but the report never appears:
1. Ensure the backend worker (Cron/Edge function) querying `status = 'QUEUED'` is active.
2. If the worker crashed mid-evaluation, the retry logic increments `retry_count`. Once it hits `max_retries`, it marks it as `FAILED`.
3. You can manually reset the status to `QUEUED` in the database to force re-processing.
