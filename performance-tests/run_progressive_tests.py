import os
import sys
import time
import json
import subprocess

def load_env(filepath):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    if k not in os.environ:
                        os.environ[k] = v.strip().strip("'\"")

# Load environment configuration
load_env("performance-tests/config.env")

SHORT_TEST = os.getenv("SHORT_TEST", "false").lower() == "true"

# Define progressive tiers
if SHORT_TEST:
    print("Running in SHORT_TEST mode for quick framework validation.")
    STAGES = [
        {"users": 10, "ramp_sec": 5, "hold_sec": 10, "name": "10_users"},
        {"users": 25, "ramp_sec": 5, "hold_sec": 15, "name": "25_users"},
        {"users": 50, "ramp_sec": 10, "hold_sec": 20, "name": "50_users"},
        {"users": 100, "ramp_sec": 10, "hold_sec": 30, "name": "100_users"},
        {"users": 200, "ramp_sec": 15, "hold_sec": 40, "name": "200_users"}
    ]
else:
    STAGES = [
        {"users": 10, "ramp_sec": 60, "hold_sec": 180, "name": "10_users"},
        {"users": 25, "ramp_sec": 120, "hold_sec": 300, "name": "25_users"},
        {"users": 50, "ramp_sec": 180, "hold_sec": 300, "name": "50_users"},
        {"users": 100, "ramp_sec": 300, "hold_sec": 600, "name": "100_users"},
        {"users": 200, "ramp_sec": 600, "hold_sec": 600, "name": "200_users"}
    ]


def run_locust_stage(users, ramp_sec, hold_sec, stage_name):
    # Total duration is ramp-up + hold
    total_sec = ramp_sec + hold_sec
    spawn_rate = round(users / ramp_sec, 3)
    duration_str = f"{total_sec}s"
    
    print("\n" + "="*60)
    print(f"STARTING TIER: {users} Concurrent Users")
    print(f"Ramp-up: {ramp_sec}s (Rate: {spawn_rate} users/sec) | Hold: {hold_sec}s")
    print(f"Total Stage Duration: {duration_str}")
    print("="*60 + "\n")
    
    # Configure environment for this worker process
    env = os.environ.copy()
    env["TEST_STAGE"] = stage_name
    
    csv_prefix = f"performance-tests/results/stats_{stage_name}"
    html_report = f"performance-tests/results/report_{stage_name}.html"
    
    # Ensure results directory exists
    os.makedirs("performance-tests/results", exist_ok=True)
    
    # Resolve locust executable path
    locust_bin = os.path.join(".venv", "Scripts", "locust") if os.name == "nt" else os.path.join(".venv", "bin", "locust")
    if not os.path.exists(locust_bin) and not os.path.exists(locust_bin + ".exe"):
        locust_bin = "locust"  # fallback to system PATH
        
    cmd = [
        locust_bin,
        "-f", "performance-tests/locustfile.py",
        "--headless",
        "-u", str(users),
        "-r", str(spawn_rate),
        "-t", duration_str,
        "--csv", csv_prefix,
        "--html", html_report,
        "--host", "http://localhost"  # default base placeholder
    ]
    
    process = subprocess.Popen(cmd, env=env)
    
    # Monitor the process and check for early abort metadata
    meta_file = f"performance-tests/results/metadata_{stage_name}.json"
    
    while process.poll() is None:
        time.sleep(2)
        # Check if locustfile wrote an abort status to the metadata file
        if os.path.exists(meta_file):
            try:
                with open(meta_file, "r") as f:
                    meta = json.load(f)
                    if meta.get("aborted"):
                        print(f"\n[ALERT] Hard Stop condition detected in metadata: {meta.get('abort_reason')}")
                        print("Terminating Locust execution immediately.")
                        process.terminate()
                        process.wait()
                        return False
            except Exception:
                pass
                
    # Verify stage success using metadata file status
    if os.path.exists(meta_file):
        try:
            with open(meta_file, "r") as f:
                meta = json.load(f)
                if meta.get("aborted"):
                    print(f"\n[ALERT] Locust run aborted: {meta.get('abort_reason')}")
                    return False
                else:
                    print(f"Locust run completed successfully for stage {stage_name}.")
                    return True
        except Exception as e:
            print(f"Error reading metadata file {meta_file}: {e}")
            
    if process.returncode != 0:
        print(f"Locust exited with error code: {process.returncode} and metadata is missing.")
        return False
        
    return True


def main():
    print("Starting Progressive Capacity Testing for Reincrew AI Interview Platform.")
    print(f"Mock AI Responses: {os.getenv('MOCK_AI_RESPONSE')}")
    print(f"Mock DB Writes: {os.getenv('MOCK_DB_WRITE')}")
    print(f"Fast Load Mode (No Think Time): {os.getenv('FAST_LOAD_MODE')}\n")
    
    success = True
    for stage in STAGES:
        start_time = time.time()
        stage_ok = run_locust_stage(stage["users"], stage["ramp_sec"], stage["hold_sec"], stage["name"])
        stage_duration = time.time() - start_time
        
        if not stage_ok:
            print(f"\n[ABORTED] progressive execution stopped at tier {stage['users']} users.")
            success = False
            break
            
        print(f"Completed tier {stage['users']} users in {stage_duration:.1f}s.")
        time.sleep(5)  # brief cool-down between tiers
        
    # Trigger Capacity Analyzer
    print("\n" + "="*60)
    print("RUNNING CAPACITY ANALYZER")
    print("="*60 + "\n")
    
    try:
        # Run analyze_capacity.py via subprocess
        result = subprocess.run([sys.executable, "performance-tests/analyze_capacity.py"], capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print("Errors in capacity analyzer:", result.stderr, file=sys.stderr)
    except Exception as e:
        print("Failed to run capacity analyzer script:", e)


if __name__ == "__main__":
    main()
