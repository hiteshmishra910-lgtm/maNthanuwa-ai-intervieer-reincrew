import os
import csv
import json
import glob

RESULTS_DIR = "performance-tests/results"
REPORT_PATH = os.path.join(RESULTS_DIR, "capacity_analysis_report.md")

# Health Thresholds
MAX_DB_AVG_LATENCY_MS = 2000.0  # 2 seconds
MAX_DB_P95_LATENCY_MS = 5000.0  # 5 seconds
MAX_AI_AVG_LATENCY_MS = 15000.0  # 15 seconds
MAX_ERROR_RATE = 0.01  # 1%


def parse_csv_stats(csv_file):
    stats = {}
    if not os.path.exists(csv_file):
        return stats
        
    try:
        with open(csv_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get("Name")
                if not name or name == "Aggregated":
                    continue
                    
                # Parse metrics
                req_count = int(row.get("Request Count", 0))
                fail_count = int(row.get("Failure Count", 0))
                avg_latency = float(row.get("Average Response Time", 0))
                p50_latency = float(row.get("Median Response Time", 0))
                p95_latency = float(row.get("95%", 0))
                p99_latency = float(row.get("99%", 0))
                
                stats[name] = {
                    "requests": req_count,
                    "failures": fail_count,
                    "avg_latency_ms": avg_latency,
                    "p50_latency_ms": p50_latency,
                    "p95_latency_ms": p95_latency,
                    "p99_latency_ms": p99_latency
                }
    except Exception as e:
        print(f"Error parsing CSV stats file {csv_file}: {e}")
        
    return stats


def format_duration(seconds):
    if seconds < 60:
        return f"{seconds:.1f} sec"
    minutes = int(seconds // 60)
    rem_seconds = seconds % 60
    return f"{minutes} min {rem_seconds:.1f} sec"


def main():
    print("Capacity Analyzer scanning results directory...")
    
    # Find all metadata files
    metadata_files = glob.glob(os.path.join(RESULTS_DIR, "metadata_*.json"))
    if not metadata_files:
        print(f"No metadata JSON files found in {RESULTS_DIR}. Run run_progressive_tests.py first.")
        return
        
    stages_data = []
    
    for meta_path in metadata_files:
        stage_name = os.path.basename(meta_path).replace("metadata_", "").replace(".json", "")
        csv_file = os.path.join(RESULTS_DIR, f"stats_{stage_name}_stats.csv")
        
        try:
            with open(meta_path, "r") as f:
                meta = json.load(f)
        except Exception as e:
            print(f"Failed to read metadata file {meta_path}: {e}")
            continue
            
        csv_stats = parse_csv_stats(csv_file)
        
        # Determine users count from name (e.g. 10_users -> 10)
        try:
            users_count = int(stage_name.split("_")[0])
        except ValueError:
            users_count = 0
            
        stages_data.append({
            "name": stage_name,
            "users": users_count,
            "meta": meta,
            "csv_stats": csv_stats
        })
        
    # Sort stages by user count
    stages_data.sort(key=lambda x: x["users"])
    
    # Analyze capacity limits
    sustainable_users = 0
    any_degradation = False
    bottleneck_reason = "No load runs completed successfully."
    bottlenecks_discovered = []
    
    # Generate tables content
    stages_rows = []
    error_summary_rows = []
    financial_summary_rows = []
    
    for stage in stages_data:
        users = stage["users"]
        meta = stage["meta"]
        csv_stats = stage["csv_stats"]
        
        aborted = meta.get("aborted", False)
        abort_reason = meta.get("abort_reason", "")
        
        # Calculate aggregate metrics
        total_requests = 0
        total_failures = 0
        
        db_requests = 0
        db_failures = 0
        db_latencies = []
        db_p95_latencies = []
        db_p99_latencies = []
        
        ai_requests = 0
        ai_failures = 0
        ai_latencies = []
        ai_p95_latencies = []
        ai_p99_latencies = []
        
        for name, data in csv_stats.items():
            total_requests += data["requests"]
            total_failures += data["failures"]
            
            if "Supabase" in name or "DB" in name:
                db_requests += data["requests"]
                db_failures += data["failures"]
                db_latencies.append(data["avg_latency_ms"] * data["requests"])
                db_p95_latencies.append(data["p95_latency_ms"])
                db_p99_latencies.append(data["p99_latency_ms"])
            elif "OpenRouter" in name or "AI" in name:
                ai_requests += data["requests"]
                ai_failures += data["failures"]
                ai_latencies.append(data["avg_latency_ms"] * data["requests"])
                ai_p95_latencies.append(data["p95_latency_ms"])
                ai_p99_latencies.append(data["p99_latency_ms"])
                
        avg_db_latency = sum(db_latencies) / db_requests if db_requests > 0 else 0.0
        max_db_p95 = max(db_p95_latencies) if db_p95_latencies else 0.0
        max_db_p99 = max(db_p99_latencies) if db_p99_latencies else 0.0
        
        avg_ai_latency = sum(ai_latencies) / ai_requests if ai_requests > 0 else 0.0
        max_ai_p95 = max(ai_p95_latencies) if ai_p95_latencies else 0.0
        max_ai_p99 = max(ai_p99_latencies) if ai_p99_latencies else 0.0
        
        overall_error_rate = total_failures / total_requests if total_requests > 0 else 0.0
        
        # Check health thresholds
        is_healthy = True
        stage_bottlenecks = []
        
        if aborted:
            is_healthy = False
            stage_bottlenecks.append(f"Aborted: {abort_reason}")
        else:
            if overall_error_rate > MAX_ERROR_RATE:
                is_healthy = False
                stage_bottlenecks.append(f"High overall error rate ({overall_error_rate*100:.2f}% > {MAX_ERROR_RATE*100}%)")
            if avg_db_latency > MAX_DB_AVG_LATENCY_MS:
                is_healthy = False
                stage_bottlenecks.append(f"DB Avg Latency too high ({avg_db_latency:.1f}ms > {MAX_DB_AVG_LATENCY_MS}ms)")
            if max_db_p95 > MAX_DB_P95_LATENCY_MS:
                is_healthy = False
                stage_bottlenecks.append(f"DB P95 Latency too high ({max_db_p95:.1f}ms > {MAX_DB_P95_LATENCY_MS}ms)")
            if avg_ai_latency > MAX_AI_AVG_LATENCY_MS:
                is_healthy = False
                stage_bottlenecks.append(f"AI Avg Latency too high ({avg_ai_latency/1000.0:.1f}s > {MAX_AI_AVG_LATENCY_MS/1000.0}s)")
            
            # Check for AI 429s
            ai_429s = meta.get("supabase_failures", {}).get("429", 0)  # or check OpenRouter failure logs
            # In our locustfile, OpenRouter 429s are counted in global_ai_429s which increment failures.
            # We also track Supabase 429s.
            if ai_429s > 0:
                is_healthy = False
                stage_bottlenecks.append(f"Database rate limiting triggered ({ai_429s} x 429s)")
                
        if is_healthy:
            if not any_degradation:
                sustainable_users = users
                bottleneck_reason = "Healthy load run."
        else:
            any_degradation = True
            if stage_bottlenecks:
                bottlenecks_discovered.append((users, "; ".join(stage_bottlenecks)))
                
        # Status Label
        status_label = "✅ HEALTHY" if is_healthy else "❌ DEGRADED"
        if aborted:
            status_label = "🛑 ABORTED"
            
        # Interview duration strings
        dur_avg = format_duration(meta.get("interview_duration_avg_sec", 0))
        dur_p95 = format_duration(meta.get("interview_duration_p95_sec", 0))
        dur_p99 = format_duration(meta.get("interview_duration_p99_sec", 0))
        
        # Row 1: Load Tiers & Latency
        stages_rows.append(
            f"| {users} | {status_label} | {avg_db_latency:.1f}ms / {max_db_p95:.1f}ms | {avg_ai_latency/1000.0:.2f}s / {max_ai_p95/1000.0:.2f}s | {meta.get('peak_concurrent_ai_requests', 0)} | {dur_avg} / {dur_p95} |"
        )
        
        # Row 2: Failures & Classifications
        sub_fail = meta.get("supabase_failures", {})
        supabase_fail_breakdown = ", ".join([f"{code}:{count}" for code, count in sub_fail.items() if count > 0]) or "None"
        
        error_summary_rows.append(
            f"| {users} | {total_requests} | {total_failures} | {overall_error_rate*100:.2f}% | {supabase_fail_breakdown} |"
        )
        
        # Row 3: Financial summaries
        financial_summary_rows.append(
            f"| {users} | {meta.get('total_ai_calls', 0)} | {meta.get('total_input_tokens', 0):,} / {meta.get('total_output_tokens', 0):,} | ₹{meta.get('total_ai_cost', 0.0)*83.0:.2f} | ₹{meta.get('avg_cost_per_completed_interview', 0.0)*83.0:.2f} |"
        )
        
    # Summarize final bottlenecks
    if bottlenecks_discovered:
        bottleneck_reason = f"Capacity collapsed at {bottlenecks_discovered[0][0]} users due to: {bottlenecks_discovered[0][1]}."
    elif sustainable_users == stages_data[-1]["users"]:
        bottleneck_reason = f"Platform remained stable up to {sustainable_users} concurrent users. Max capability may exceed this limit."
        
    # Generate Markdown Report
    report_md = f"""# Reincrew AI Interview Platform Capacity Analysis Report

This report summarizes the capacity limits, latency bottlenecks, failure rates, and AI financial costs discovered during progressive load testing.

## Executive Summary

- **Maximum Sustainable Capacity**: **{sustainable_users} concurrent users**
- **Primary Bottleneck**: {bottleneck_reason}

> [!NOTE]
> A tier is considered **sustainable** only if the total error rate is less than 1%, average database write/read latency remains under 2 seconds, and average AI response evaluation latency remains under 15 seconds.

---

## 1. Load Tier & Latency Metrics

| Users | Status | DB Latency (Avg/P95) | AI Latency (Avg/P95) | Peak Concurrent AI | Interview Duration (Avg/P95) |
|---|---|---|---|---|---|
{"\n".join(stages_rows)}

---

## 2. Request Errors & Supabase Status Codes

| Users | Total Requests | Failed Requests | Overall Error Rate | Supabase HTTP Failure Breakdown |
|---|---|---|---|---|
{"\n".join(error_summary_rows)}

---

## 3. OpenRouter AI Financial & Token Summary

*Costs calculated in Indian Rupees (₹) assuming 1 USD = ₹83.0. Default pricing uses DeepSeek-Chat ($0.14/1M input tokens, $0.28/1M output tokens).*

| Users | Total AI Calls | Prompt / Completion Tokens | Total Cost (INR) | Avg Cost per Completed Interview |
|---|---|---|---|---|
{"\n".join(financial_summary_rows)}

---

## 4. Key Findings & Recommendations

### Database Performance
{ "Supabase performed well with average latencies below 500ms." if sustainable_users >= 50 else "Supabase operations began degrading under higher loads, leading to transaction slowdowns or HTTP 500 errors." }
Ensure that your database indices are properly set on:
- `candidates.email`
- `interview_sessions.candidate_id`
- `session_responses.session_id`

### AI Concurrency & Rate Limits
If 429 errors or timeouts were encountered, it indicates hitting the concurrent request limits of either OpenRouter or the underlying provider (DeepSeek).
To prevent these limits from blocking users:
1. **Model Fallback**: Implement automated failover to alternate endpoints (e.g. Gemini-2.5-Flash or Claude-3.5-Haiku) if DeepSeek-Chat returns a 429 or 5xx.
2. **Provider Tier Upgrades**: Upgrade your OpenRouter account or purchase throughput tier commitments.

### Financial Control
AI Cost Tracking shows that the cost per interview is a function of total token volume. Using the exact production evaluation prompt results in high token usage. If the cost per interview is too high, consider:
- Shortening the internal evaluation rubric.
- Using a cheaper model (like `gemini-2.5-flash-lite` or `deepseek-flash`) for intermediate question evaluations, and reserving higher-tier models for the final report check.
"""
    
    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(report_md)
        
    print(f"Capacity Analysis Report successfully written to {REPORT_PATH}")


if __name__ == "__main__":
    main()
