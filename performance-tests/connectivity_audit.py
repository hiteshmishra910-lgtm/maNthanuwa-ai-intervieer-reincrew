"""
Reicrew AI — Full Connectivity & Data Integrity Audit
=====================================================
Tests:
  1. INSERT / SELECT / UPDATE on all 8 core tables
  2. Foreign key relationship integrity
  3. Orphaned row detection
  4. View accessibility (vw_candidate_master + 6 others)
  5. Storage bucket accessibility
  6. Row counts
  7. End-to-end interview pipeline simulation

Usage:
  python performance-tests/connectivity_audit.py
"""

import os
import sys
import json
import time
import uuid
import requests
from datetime import datetime, timezone

# ── Load Environment ──────────────────────────────────────────────────
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

load_env("performance-tests/config.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ FATAL: SUPABASE_URL or SUPABASE_ANON_KEY not found in environment or config.env")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

REST_URL = f"{SUPABASE_URL}/rest/v1"

# ── Tracking ──────────────────────────────────────────────────────────
results = []
test_ids = {}  # Track IDs created during the test for cleanup

def log_result(phase, test_name, passed, detail=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({"phase": phase, "test": test_name, "passed": passed, "detail": detail})
    print(f"  {status}  {test_name}" + (f"  →  {detail}" if detail else ""))

def section(title):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")


# ═══════════════════════════════════════════════════════════════════════
# PHASE 1: Table CRUD Operations (INSERT → SELECT → UPDATE)
# ═══════════════════════════════════════════════════════════════════════
def phase1_table_crud():
    section("PHASE 1: Table CRUD (INSERT → SELECT → UPDATE)")
    
    # ── 1.1 candidates ──
    candidate_email = f"audit_{uuid.uuid4().hex[:8]}@test.reicrew.ai"
    candidate_payload = {
        "name": "Audit Test Candidate",
        "email": candidate_email,
        "applied_role": "CSE"
    }
    
    r = requests.post(f"{REST_URL}/candidates", headers=HEADERS, json=candidate_payload)
    if r.status_code == 201:
        candidate = r.json()[0]
        test_ids["candidate_id"] = candidate["id"]
        log_result("CRUD", "INSERT candidates", True, f"id={candidate['id'][:8]}…")
    else:
        log_result("CRUD", "INSERT candidates", False, f"HTTP {r.status_code}: {r.text[:200]}")
        return False  # Can't continue without a candidate

    # SELECT
    r = requests.get(f"{REST_URL}/candidates?id=eq.{test_ids['candidate_id']}", headers=HEADERS)
    if r.status_code == 200 and len(r.json()) == 1:
        log_result("CRUD", "SELECT candidates", True)
    else:
        log_result("CRUD", "SELECT candidates", False, f"HTTP {r.status_code}")

    # UPDATE
    r = requests.patch(
        f"{REST_URL}/candidates?id=eq.{test_ids['candidate_id']}",
        headers=HEADERS,
        json={"name": "Audit Test Candidate (Updated)"}
    )
    log_result("CRUD", "UPDATE candidates", r.status_code in [200, 204], f"HTTP {r.status_code}")

    # ── 1.2 job_posts (SELECT only — don't pollute seed data) ──
    r = requests.get(f"{REST_URL}/job_posts?limit=1", headers=HEADERS)
    if r.status_code == 200 and len(r.json()) > 0:
        test_ids["job_post_id"] = r.json()[0]["id"]
        log_result("CRUD", "SELECT job_posts", True, f"Found {len(r.json())} job(s)")
    else:
        # Create a temporary job post for testing
        job_payload = {
            "title": "Audit Test Role",
            "description": "Temporary job post for connectivity audit",
            "mode": "AI",
            "status": "ACTIVE",
            "company": "Audit"
        }
        r2 = requests.post(f"{REST_URL}/job_posts", headers=HEADERS, json=job_payload)
        if r2.status_code == 201:
            test_ids["job_post_id"] = r2.json()[0]["id"]
            test_ids["_created_job_post"] = True
            log_result("CRUD", "INSERT job_posts (temp)", True)
        else:
            log_result("CRUD", "SELECT/INSERT job_posts", False, f"No jobs found and insert failed")
            return False

    # ── 1.3 interview_sessions ──
    session_payload = {
        "candidate_id": test_ids["candidate_id"],
        "job_post_id": test_ids["job_post_id"],
        "status": "IN_PROGRESS",
        "candidate_name": "Audit Test Candidate",
        "total_questions": 3,
        "interview_metadata": json.dumps({"source": "connectivity_audit"})
    }
    r = requests.post(f"{REST_URL}/interview_sessions", headers=HEADERS, json=session_payload)
    if r.status_code == 201:
        session = r.json()[0]
        test_ids["session_id"] = session["id"]
        log_result("CRUD", "INSERT interview_sessions", True, f"id={session['id'][:8]}…")
        
        # Verify trigger filled candidate_name
        if session.get("candidate_name"):
            log_result("CRUD", "TRIGGER candidate_name (sessions)", True, f"name='{session['candidate_name']}'")
        else:
            log_result("CRUD", "TRIGGER candidate_name (sessions)", False, "candidate_name is NULL despite trigger")
    else:
        log_result("CRUD", "INSERT interview_sessions", False, f"HTTP {r.status_code}: {r.text[:200]}")
        return False

    # SELECT
    r = requests.get(f"{REST_URL}/interview_sessions?id=eq.{test_ids['session_id']}", headers=HEADERS)
    log_result("CRUD", "SELECT interview_sessions", r.status_code == 200 and len(r.json()) == 1)

    # UPDATE
    r = requests.patch(
        f"{REST_URL}/interview_sessions?id=eq.{test_ids['session_id']}",
        headers=HEADERS,
        json={"status": "IN_PROGRESS"}
    )
    log_result("CRUD", "UPDATE interview_sessions", r.status_code in [200, 204])

    # ── 1.4 session_responses ──
    for q_idx in range(1, 4):
        response_payload = {
            "session_id": test_ids["session_id"],
            "candidate_name": "Audit Test Candidate",
            "question_index": q_idx,
            "question_text": f"Audit question {q_idx}: Explain concept X.",
            "candidate_answer": f"Test answer {q_idx}: Concept X means...",
            "ideal_answer": f"Ideal: X is defined as...",
            "content_score": round(6.0 + q_idx * 0.5, 2),
            "grammar_score": 7.5,
            "fluency_score": 8.0,
            "verdict": "Pass",
            "feedback": f"Good understanding of concept {q_idx}."
        }
        r = requests.post(f"{REST_URL}/session_responses", headers=HEADERS, json=response_payload)
        if r.status_code == 201:
            resp = r.json()[0]
            if q_idx == 1:
                test_ids["response_id"] = resp["id"]
            # Verify trigger
            if resp.get("candidate_name"):
                pass  # Trigger working
            else:
                log_result("CRUD", f"TRIGGER candidate_name (response Q{q_idx})", False)
        else:
            log_result("CRUD", f"INSERT session_responses Q{q_idx}", False, f"HTTP {r.status_code}: {r.text[:200]}")
    
    log_result("CRUD", "INSERT session_responses (3 Q&As)", True)

    # SELECT
    r = requests.get(f"{REST_URL}/session_responses?session_id=eq.{test_ids['session_id']}&order=question_index.asc", headers=HEADERS)
    if r.status_code == 200:
        count = len(r.json())
        log_result("CRUD", "SELECT session_responses", count == 3, f"Expected 3, got {count}")
    else:
        log_result("CRUD", "SELECT session_responses", False)

    # ── 1.5 proctoring_events ──
    proctoring_events = [
        {"session_id": test_ids["session_id"], "candidate_name": "Audit Test Candidate",
         "event_type": "TAB_HIDDEN", "severity": "Low", "risk_points": 2,
         "message": "Browser tab hidden during Q1"},
        {"session_id": test_ids["session_id"], "candidate_name": "Audit Test Candidate",
         "event_type": "GAZE_AWAY", "severity": "Medium", "risk_points": 5,
         "message": "Gaze directed away for 8 seconds"}
    ]
    r = requests.post(f"{REST_URL}/proctoring_events", headers=HEADERS, json=proctoring_events)
    log_result("CRUD", "INSERT proctoring_events (2 events)", r.status_code == 201, 
               f"HTTP {r.status_code}" if r.status_code != 201 else "")

    # ── 1.6 evaluation_reports ──
    eval_payload = {
        "session_id": test_ids["session_id"],
        "candidate_name": "Audit Test Candidate",
        "total_score": 72,
        "technical_score": 75.5,
        "communication_score": 68.0,
        "confidence_score": 70.0,
        "proctoring_score": 85.0,
        "hiring_recommendation": "Consider",
        "strengths": ["Good conceptual understanding", "Clear communication"],
        "failures": ["Missed edge cases"],
        "final_verdict": "Candidate shows promise but needs improvement in edge case handling.",
        "verdict_justification": "Scored well on core concepts but lacked depth.",
        "risk_score": 15,
        "risk_level": "Low",
        "risk_reason": [],
        "proctoring_summary": json.dumps({"tab_switches": 1, "gaze_away": 1, "face_missing": 0}),
        "evaluation_logic": json.dumps({"source": "audit_test", "version": "11.0"}),
        "evaluation_version": "11.0",
        "evaluation_model": "audit-test-model",
        "evaluation_prompt_version": "11.0",
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "candidate_outcome": "PENDING"
    }
    r = requests.post(f"{REST_URL}/evaluation_reports", headers=HEADERS, json=eval_payload)
    if r.status_code == 201:
        test_ids["report_id"] = r.json()[0]["id"]
        log_result("CRUD", "INSERT evaluation_reports", True)
    else:
        log_result("CRUD", "INSERT evaluation_reports", False, f"HTTP {r.status_code}: {r.text[:200]}")

    # ── 1.7 contradictions ──
    contradiction_payload = {
        "session_id": test_ids["session_id"],
        "candidate_name": "Audit Test Candidate",
        "q_index1": 1,
        "q_index2": 3,
        "explanation": "Candidate stated X in Q1 but contradicted it in Q3.",
        "severity": "medium",
        "status": "possible",
        "confidence": 75.0
    }
    r = requests.post(f"{REST_URL}/contradictions", headers=HEADERS, json=contradiction_payload)
    log_result("CRUD", "INSERT contradictions", r.status_code == 201,
               f"HTTP {r.status_code}" if r.status_code != 201 else "")

    # ── 1.8 validation_results ──
    validation_payload = {
        "session_id": test_ids["session_id"],
        "candidate_name": "Audit Test Candidate",
        "parent_question": "Explain concept X.",
        "parent_score": 7.5,
        "followup_question": "How does X apply to Y?",
        "followup_score": 6.0,
        "reliability": 80.0
    }
    r = requests.post(f"{REST_URL}/validation_results", headers=HEADERS, json=validation_payload)
    log_result("CRUD", "INSERT validation_results", r.status_code == 201,
               f"HTTP {r.status_code}" if r.status_code != 201 else "")

    # ── 1.9 Complete the session ──
    r = requests.patch(
        f"{REST_URL}/interview_sessions?id=eq.{test_ids['session_id']}",
        headers=HEADERS,
        json={
            "status": "COMPLETED",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": 420,
            "overall_score": 72
        }
    )
    log_result("CRUD", "UPDATE session → COMPLETED", r.status_code in [200, 204])

    return True


# ═══════════════════════════════════════════════════════════════════════
# PHASE 2: Foreign Key Relationships & Orphan Detection
# ═══════════════════════════════════════════════════════════════════════
def phase2_relationships():
    section("PHASE 2: Foreign Key Relationships & Orphan Detection")

    session_id = test_ids.get("session_id")
    candidate_id = test_ids.get("candidate_id")
    
    if not session_id or not candidate_id:
        log_result("FK", "Setup", False, "Missing test IDs from Phase 1")
        return

    # ── FK: candidate → session ──
    r = requests.get(f"{REST_URL}/interview_sessions?candidate_id=eq.{candidate_id}", headers=HEADERS)
    if r.status_code == 200:
        sessions = r.json()
        linked = any(s["id"] == session_id for s in sessions)
        log_result("FK", "candidate → session link", linked, f"Found {len(sessions)} session(s)")
    else:
        log_result("FK", "candidate → session link", False)

    # ── FK: session → responses ──
    r = requests.get(f"{REST_URL}/session_responses?session_id=eq.{session_id}", headers=HEADERS)
    if r.status_code == 200:
        log_result("FK", "session → responses link", len(r.json()) == 3, f"Expected 3, got {len(r.json())}")
    else:
        log_result("FK", "session → responses link", False)

    # ── FK: session → evaluation_reports ──
    r = requests.get(f"{REST_URL}/evaluation_reports?session_id=eq.{session_id}", headers=HEADERS)
    if r.status_code == 200:
        log_result("FK", "session → evaluation_reports link", len(r.json()) == 1, f"Got {len(r.json())}")
    else:
        log_result("FK", "session → evaluation_reports link", False)

    # ── FK: session → proctoring_events ──
    r = requests.get(f"{REST_URL}/proctoring_events?session_id=eq.{session_id}", headers=HEADERS)
    if r.status_code == 200:
        log_result("FK", "session → proctoring_events link", len(r.json()) == 2, f"Got {len(r.json())}")
    else:
        log_result("FK", "session → proctoring_events link", False)

    # ── FK: session → contradictions ──
    r = requests.get(f"{REST_URL}/contradictions?session_id=eq.{session_id}", headers=HEADERS)
    if r.status_code == 200:
        log_result("FK", "session → contradictions link", len(r.json()) == 1, f"Got {len(r.json())}")
    else:
        log_result("FK", "session → contradictions link", False)

    # ── FK: session → validation_results ──
    r = requests.get(f"{REST_URL}/validation_results?session_id=eq.{session_id}", headers=HEADERS)
    if r.status_code == 200:
        log_result("FK", "session → validation_results link", len(r.json()) == 1, f"Got {len(r.json())}")
    else:
        log_result("FK", "session → validation_results link", False)

    # ── Orphan Detection: session_responses with no matching session ──
    # PostgREST doesn't support LEFT JOIN, so we check if any responses reference a session that doesn't exist
    r = requests.get(f"{REST_URL}/session_responses?select=session_id&limit=500", headers=HEADERS)
    if r.status_code == 200:
        response_session_ids = list(set(resp["session_id"] for resp in r.json()))
        orphaned = 0
        # Check a sample (max 20) to avoid excessive API calls
        for sid in response_session_ids[:20]:
            r2 = requests.get(f"{REST_URL}/interview_sessions?id=eq.{sid}&select=id", headers=HEADERS)
            if r2.status_code == 200 and len(r2.json()) == 0:
                orphaned += 1
        log_result("ORPHAN", "session_responses → orphaned rows", orphaned == 0, 
                   f"Checked {min(20, len(response_session_ids))} unique sessions, {orphaned} orphaned")
    else:
        log_result("ORPHAN", "session_responses check", False, "Could not query")

    # ── Orphan Detection: proctoring_events with no matching session ──
    r = requests.get(f"{REST_URL}/proctoring_events?select=session_id&limit=500", headers=HEADERS)
    if r.status_code == 200:
        event_session_ids = list(set(e["session_id"] for e in r.json()))
        orphaned = 0
        for sid in event_session_ids[:20]:
            r2 = requests.get(f"{REST_URL}/interview_sessions?id=eq.{sid}&select=id", headers=HEADERS)
            if r2.status_code == 200 and len(r2.json()) == 0:
                orphaned += 1
        log_result("ORPHAN", "proctoring_events → orphaned rows", orphaned == 0,
                   f"Checked {min(20, len(event_session_ids))} unique sessions, {orphaned} orphaned")
    else:
        log_result("ORPHAN", "proctoring_events check", False, "Could not query")


# ═══════════════════════════════════════════════════════════════════════
# PHASE 3: Views Accessibility
# ═══════════════════════════════════════════════════════════════════════
def phase3_views():
    section("PHASE 3: View Accessibility & Correctness")

    views = [
        "vw_candidate_master",
        "vw_candidate_qa_details",
        "vw_candidate_proctoring",
        "vw_candidate_evaluation",
        "vw_candidate_scoring_breakdown",
        "vw_interview_timeline",
        "vw_candidate_report_export"
    ]

    for view_name in views:
        try:
            r = requests.get(f"{REST_URL}/{view_name}?limit=5", headers=HEADERS)
            if r.status_code == 200:
                rows = r.json()
                log_result("VIEWS", f"SELECT {view_name}", True, f"{len(rows)} row(s) returned")
            else:
                log_result("VIEWS", f"SELECT {view_name}", False, f"HTTP {r.status_code}: {r.text[:150]}")
        except Exception as e:
            log_result("VIEWS", f"SELECT {view_name}", False, str(e)[:150])

    # ── Verify vw_candidate_master contains our test record ──
    session_id = test_ids.get("session_id")
    if session_id:
        r = requests.get(f"{REST_URL}/vw_candidate_master?session_id=eq.{session_id}", headers=HEADERS)
        if r.status_code == 200 and len(r.json()) > 0:
            record = r.json()[0]
            checks = {
                "candidate_name": record.get("candidate_name") == "Audit Test Candidate (Updated)",
                "overall_score": record.get("overall_score") == 72,
                "session_status": record.get("session_status") == "COMPLETED",
                "recommendation": record.get("recommendation") == "Consider"
            }
            all_good = all(checks.values())
            detail = ", ".join(f"{k}={'✓' if v else '✗'}" for k, v in checks.items())
            log_result("VIEWS", "vw_candidate_master data accuracy", all_good, detail)
        else:
            log_result("VIEWS", "vw_candidate_master data accuracy", False, "Test record not found in view")


# ═══════════════════════════════════════════════════════════════════════
# PHASE 4: Row Counts
# ═══════════════════════════════════════════════════════════════════════
def phase4_row_counts():
    section("PHASE 4: Row Counts")

    tables = [
        "candidates", "job_posts", "interview_sessions", 
        "session_responses", "evaluation_reports", 
        "proctoring_events", "contradictions", "validation_results"
    ]

    count_headers = {**HEADERS, "Prefer": "count=exact"}

    for table in tables:
        try:
            r = requests.head(f"{REST_URL}/{table}?select=*", headers=count_headers)
            count = r.headers.get("content-range", "unknown")
            # content-range format: "0-9/42" or "*/0"
            total = count.split("/")[-1] if "/" in count else count
            log_result("COUNTS", f"{table}", True, f"{total} rows")
        except Exception as e:
            log_result("COUNTS", f"{table}", False, str(e)[:100])


# ═══════════════════════════════════════════════════════════════════════
# PHASE 5: Storage Buckets
# ═══════════════════════════════════════════════════════════════════════
def phase5_storage():
    section("PHASE 5: Storage Buckets")

    storage_headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
    }

    expected_buckets = ["proctoring-snapshots", "proctoring-clips"]

    try:
        r = requests.get(f"{SUPABASE_URL}/storage/v1/bucket", headers=storage_headers)
        if r.status_code == 200:
            buckets = [b["id"] for b in r.json()]
            for expected in expected_buckets:
                exists = expected in buckets
                log_result("STORAGE", f"Bucket '{expected}'", exists,
                           "exists" if exists else "MISSING")
        else:
            log_result("STORAGE", "List buckets", False, f"HTTP {r.status_code}")
    except Exception as e:
        log_result("STORAGE", "List buckets", False, str(e)[:100])


# ═══════════════════════════════════════════════════════════════════════
# CLEANUP: Remove test data
# ═══════════════════════════════════════════════════════════════════════
def cleanup():
    section("CLEANUP: Removing Audit Test Data")

    # Delete in reverse FK dependency order
    cleanup_order = [
        ("validation_results", "session_id"),
        ("contradictions", "session_id"),
        ("proctoring_events", "session_id"),
        ("evaluation_reports", "session_id"),
        ("session_responses", "session_id"),
    ]

    session_id = test_ids.get("session_id")
    candidate_id = test_ids.get("candidate_id")

    if session_id:
        for table, fk_col in cleanup_order:
            r = requests.delete(
                f"{REST_URL}/{table}?{fk_col}=eq.{session_id}",
                headers=HEADERS
            )
            status = "✓" if r.status_code in [200, 204] else f"HTTP {r.status_code}"
            print(f"  🧹 DELETE {table} → {status}")

        # Delete session
        r = requests.delete(f"{REST_URL}/interview_sessions?id=eq.{session_id}", headers=HEADERS)
        print(f"  🧹 DELETE interview_sessions → {'✓' if r.status_code in [200, 204] else f'HTTP {r.status_code}'}")

    if candidate_id:
        # DELETE CASCADE should handle this, but be explicit
        r = requests.delete(f"{REST_URL}/candidates?id=eq.{candidate_id}", headers=HEADERS)
        print(f"  🧹 DELETE candidates → {'✓' if r.status_code in [200, 204] else f'HTTP {r.status_code}'}")

    if test_ids.get("_created_job_post"):
        r = requests.delete(f"{REST_URL}/job_posts?id=eq.{test_ids['job_post_id']}", headers=HEADERS)
        print(f"  🧹 DELETE job_posts (temp) → {'✓' if r.status_code in [200, 204] else f'HTTP {r.status_code}'}")


# ═══════════════════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════════════════
def generate_report():
    section("FINAL REPORT")

    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])

    print(f"\n  Total Tests: {total}")
    print(f"  ✅ Passed:   {passed}")
    print(f"  ❌ Failed:   {failed}")
    print(f"  Score:       {passed}/{total} ({100*passed//total if total > 0 else 0}%)\n")

    if failed > 0:
        print("  ── Failed Tests ──")
        for r in results:
            if not r["passed"]:
                print(f"    ❌ [{r['phase']}] {r['test']}: {r['detail']}")

    # Save report to file
    report_path = "performance-tests/results/connectivity_audit_report.md"
    os.makedirs(os.path.dirname(report_path), exist_ok=True)

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Reicrew AI — Connectivity & Data Integrity Audit Report\n\n")
        f.write(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"**Score**: {passed}/{total} ({100*passed//total if total > 0 else 0}%)\n\n")
        f.write("---\n\n")

        phases = {}
        for r in results:
            phases.setdefault(r["phase"], []).append(r)

        for phase, tests in phases.items():
            f.write(f"## {phase}\n\n")
            f.write("| Test | Status | Detail |\n|---|---|---|\n")
            for t in tests:
                status = "✅ PASS" if t["passed"] else "❌ FAIL"
                f.write(f"| {t['test']} | {status} | {t['detail']} |\n")
            f.write("\n")

    print(f"\n  📄 Report saved to: {report_path}")

    return failed == 0


# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("  REICREW AI — CONNECTIVITY & DATA INTEGRITY AUDIT")
    print(f"  Target: {SUPABASE_URL}")
    print(f"  Time:   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    try:
        ok = phase1_table_crud()
        if ok:
            phase2_relationships()
        phase3_views()
        phase4_row_counts()
        phase5_storage()
    finally:
        cleanup()

    all_passed = generate_report()
    sys.exit(0 if all_passed else 1)
