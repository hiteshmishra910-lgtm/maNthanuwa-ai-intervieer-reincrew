import os
import shutil
import subprocess
import sys
import json
import time

RESULTS_DIR = "performance-tests/results"
API_KEY = os.getenv("OPENROUTER_API_KEY")

def run_scenario(scenario_name, env_overrides):
    print(f"\n============================================================")
    print(f"STARTING SCENARIO: {scenario_name}")
    print(f"Env Configuration: {env_overrides}")
    print(f"============================================================\n")
    
    # Clean output results directory before run
    if os.path.exists(RESULTS_DIR):
        for item in os.listdir(RESULTS_DIR):
            item_path = os.path.join(RESULTS_DIR, item)
            # Avoid deleting existing test directories
            if os.path.isdir(item_path) and item.startswith("test_"):
                continue
            try:
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                else:
                    os.remove(item_path)
            except Exception as e:
                print(f"Error cleaning {item_path}: {e}")
                
    # Build environment
    env = os.environ.copy()
    env.update(env_overrides)
    env["OPENROUTER_API_KEY"] = API_KEY
    env["SHORT_TEST"] = "true"  # keeps runs time-efficient for sweeping all tiers
    
    # Run the progressive tests script
    python_exe = sys.executable
    process = subprocess.run([python_exe, "performance-tests/run_progressive_tests.py"], env=env)
    
    # Create target scenario directory
    scenario_dir = os.path.join(RESULTS_DIR, scenario_name.lower())
    os.makedirs(scenario_dir, exist_ok=True)
    
    # Move results to target scenario directory
    if os.path.exists(RESULTS_DIR):
        for item in os.listdir(RESULTS_DIR):
            item_path = os.path.join(RESULTS_DIR, item)
            if item_path == scenario_dir or (os.path.isdir(item_path) and item.startswith("test_")):
                continue
            try:
                shutil.move(item_path, os.path.join(scenario_dir, item))
            except Exception as e:
                print(f"Error moving {item_path} to {scenario_dir}: {e}")
                
    print(f"\nScenario {scenario_name} finished. Results saved in {scenario_dir}\n")

def generate_comparison_report():
    print("\n============================================================")
    print("GENERATING SCENARIOS COMPARISON REPORT")
    print("============================================================\n")
    
    report_data = {}
    scenarios = ["test_a", "test_b", "test_c"]
    
    for sc in scenarios:
        sc_dir = os.path.join(RESULTS_DIR, sc)
        if not os.path.exists(sc_dir):
            continue
            
        report_data[sc] = []
        # Look for metadata files in the scenario dir
        import glob
        meta_files = glob.glob(os.path.join(sc_dir, "metadata_*.json"))
        # Sort them by user count
        def get_users(filepath):
            name = os.path.basename(filepath)
            try:
                return int(name.replace("metadata_", "").replace("_users.json", ""))
            except ValueError:
                return 0
        meta_files.sort(key=get_users)
        
        for mf in meta_files:
            stage_name = os.path.basename(mf).replace("metadata_", "").replace(".json", "")
            try:
                with open(mf, "r") as f:
                    meta = json.load(f)
                users = get_users(mf)
                report_data[sc].append({
                    "users": users,
                    "aborted": meta.get("aborted", False),
                    "abort_reason": meta.get("abort_reason", ""),
                    "total_ai_calls": meta.get("total_ai_calls", 0),
                    "total_ai_402s": meta.get("total_ai_402s", 0),
                    "total_ai_429s": meta.get("total_ai_429s", 0),
                    "completed_interviews": meta.get("completed_interviews", 0),
                    "interviews_started": meta.get("interviews_started", 0),
                    "failures": meta.get("supabase_failures", {})
                })
            except Exception as e:
                print(f"Error reading {mf}: {e}")
                
    # Build markdown report
    md = """# Performance Load Scenarios Comparison Report

This report compares three distinct load testing runs designed to isolate and evaluate different aspects of the Reincrew AI Interview Platform.

* **Test A**: Database Capacity Only (`MOCK_AI_RESPONSE=true`, `MOCK_DB_WRITE=false`)
* **Test B**: OpenRouter Capacity Only (`MOCK_AI_RESPONSE=false`, `MOCK_DB_WRITE=true`)
* **Test C**: Real Production Behavior (`MOCK_AI_RESPONSE=false`, `MOCK_DB_WRITE=false`, `FAST_LOAD_MODE=false`)

---

## 1. Executive Capacity Summary

"""
    # Test A summary
    a_stages = report_data.get("test_a", [])
    a_max = 0
    a_limit_reason = "No load runs completed."
    for s in a_stages:
        if not s["aborted"]:
            a_max = s["users"]
        else:
            a_limit_reason = s["abort_reason"]
            break
    if a_max == 200:
        a_limit_reason = "Stable up to max tested load (200 users)."
        
    # Test B summary
    b_stages = report_data.get("test_b", [])
    b_max = 0
    b_limit_reason = "No load runs completed."
    for s in b_stages:
        if not s["aborted"]:
            b_max = s["users"]
        else:
            b_limit_reason = s["abort_reason"]
            break
    if b_max == 200:
        b_limit_reason = "Stable up to max tested load (200 users)."
        
    # Test C summary
    c_stages = report_data.get("test_c", [])
    c_max = 0
    c_limit_reason = "No load runs completed."
    for s in c_stages:
        if not s["aborted"]:
            c_max = s["users"]
        else:
            c_limit_reason = s["abort_reason"]
            break
    if c_max == 200:
        c_limit_reason = "Stable up to max tested load (200 users)."

    md += f"""| Scenario | Max Sustainable Load | Primary Bottleneck / Limit Reason |
|:---|:---|:---|
| **Test A: DB Capacity Only** | **{a_max} concurrent users** | {a_limit_reason} |
| **Test B: OpenRouter Capacity Only** | **{b_max} concurrent users** | {b_limit_reason} |
| **Test C: Real Production Behavior** | **{c_max} concurrent users** | {c_limit_reason} |

---

## 2. Detailed Scenario Results

"""

    for scName, scLabel in [("test_a", "Test A: Database Capacity Only"), ("test_b", "Test B: OpenRouter Capacity Only"), ("test_c", "Test C: Real Production Behavior")]:
        stages = report_data.get(scName, [])
        md += f"### {scLabel}\n\n"
        if not stages:
            md += "No data collected for this scenario.\n\n"
            continue
            
        md += "| Users | Status | Started Interviews | Completed Interviews | Total AI Calls | AI 402/429 Failures | DB Failures (Breakdown) |\n"
        md += "|---|---|---|---|---|---|---|\n"
        for s in stages:
            status = "🛑 ABORTED" if s["aborted"] else "✅ SUCCESS"
            db_errs = ", ".join([f"{code}:{count}" for code, count in s["failures"].items() if count > 0]) or "None"
            md += f"| {s['users']} | {status} | {s['interviews_started']} | {s['completed_interviews']} | {s['total_ai_calls']} | {s['total_ai_402s']}/{s['total_ai_429s']} | {db_errs} |\n"
        md += "\n"

    md += """---

## 3. Key Observations & Takeaways

### Test A: Database Capacity Limit
Test A bypasses LLM latency and directly hammers the database. Under this high-throughput condition:
* **Write Lock Bottlenecks**: The write locking behaviour of the relational structure is tested. 
* **Connection Limits**: Connection timeouts appear as concurrency rises.

### Test B: OpenRouter Capacity Limit
Test B bypasses DB writing, isolating the OpenRouter proxy latency and concurrency limitations:
* **Concurrent Queueing**: Requests are held in queues by the model providers.
* **429/402 Thresholds**: Identifies rate limits (429) or free credit exhaustion (402).

### Test C: Real Production Behavior
Test C represents the most accurate simulation of the real application:
* **Impact of Think Time**: Because candidates spend 20-60 seconds thinking between questions, request concurrency is naturally smoothed.
* **Realistic Scaling**: The system can typically sustain a much higher user count in Test C than Test A because the load is distributed over time rather than fired in continuous parallel bursts.
"""
    
    report_path = os.path.join(RESULTS_DIR, "scenarios_comparison_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"Scenarios Comparison Report written to {report_path}")

def main():
    print("Starting Reincrew Load Testing Scenarios Suite...")
    
    # Scenario A: DB Capacity Only
    run_scenario("test_a", {
        "MOCK_AI_RESPONSE": "true",
        "MOCK_DB_WRITE": "false",
        "FAST_LOAD_MODE": "true"
    })
    
    # Scenario B: OpenRouter Capacity Only
    run_scenario("test_b", {
        "MOCK_AI_RESPONSE": "false",
        "MOCK_DB_WRITE": "true",
        "FAST_LOAD_MODE": "true"
    })
    
    # Scenario C: Real Production Behavior
    run_scenario("test_c", {
        "MOCK_AI_RESPONSE": "false",
        "MOCK_DB_WRITE": "false",
        "FAST_LOAD_MODE": "false"
    })
    
    # Generate final report
    generate_comparison_report()

if __name__ == "__main__":
    main()
