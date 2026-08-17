import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = __ENV.SUPABASE_URL || "https://kczpxtopdbiietknswgz.supabase.co";
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const JOB_POST_ID = "013eaad4-7295-443d-a54a-3c4533d2abe2";

// local | hybrid
const MODE = (__ENV.MODE || "local").toLowerCase();
const ANSWER_COUNT = Number(__ENV.ANSWER_COUNT || 5);

const RESULT_TABLE = __ENV.RESULT_TABLE || "interview_sessions";
const RESULT_FILTER_COLUMN = __ENV.RESULT_FILTER_COLUMN || "id";

// ============================================================
// VALIDATION
// ============================================================

if (!SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY is missing. Run k6 with -e SUPABASE_ANON_KEY=\"...\"");
}
if (!JOB_POST_ID) {
  throw new Error("JOB_POST_ID is missing. Run k6 with -e JOB_POST_ID=\"...\"");
}

// ============================================================
// CUSTOM METRICS
// ============================================================

const candidateCreateTime = new Trend("candidate_create_time");
const sessionCreateTime = new Trend("session_create_time");
const answerSubmitTime = new Trend("answer_submit_time");
const sessionCompleteTime = new Trend("session_complete_time");
const evaluationSaveTime = new Trend("evaluation_save_time");
const resultFetchTime = new Trend("result_fetch_time");

const failedRequests = new Counter("failed_requests");
const interviewSuccessRate = new Rate("interview_success_rate");
const interviewFailRate = new Rate("interview_fail_rate");

// ============================================================
// K6 LOAD TEST CONFIGURATION
// ============================================================

export const options = {
  scenarios: {
    interview_flow: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: '30s', target: 200 },
        { duration: '30s', target: 200 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<3000"],
    interview_success_rate: ["rate>0.90"], // Fails if success rate drops below 90%
  },
};

// ============================================================
// HEADERS & HELPERS
// ============================================================

function getHeaders(returnRepresentation = false) {
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  if (returnRepresentation) {
    headers["Prefer"] = "return=representation";
  } else {
    headers["Prefer"] = "return=minimal";
  }
  return headers;
}

function supabaseInsert(table, payload, returnRepresentation = false) {
  return http.post(`${SUPABASE_URL}/rest/v1/${table}`, JSON.stringify(payload), { headers: getHeaders(returnRepresentation), timeout: "30s" });
}

function supabaseUpdate(table, filter, payload, returnRepresentation = false) {
  return http.patch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, JSON.stringify(payload), { headers: getHeaders(returnRepresentation), timeout: "30s" });
}

function supabaseUpsert(table, payload) {
  // Candidate Create NEEDS return=representation to get the ID
  return http.post(`${SUPABASE_URL}/rest/v1/${table}`, JSON.stringify(payload), {
    headers: Object.assign({}, getHeaders(true), { Prefer: "resolution=merge-duplicates,return=representation" }),
    timeout: "30s",
  });
}

function supabaseSelect(table, filter) {
  return http.get(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { headers: getHeaders(false), timeout: "30s" });
}

// --- ROBUST JSON PARSING HELPERS ---

function getJsonBody(response) {
  if (!response.body) return null;
  try {
    return JSON.parse(response.body);
  } catch (e) {
    return null;
  }
}

function getIdFromResponse(response) {
  const data = getJsonBody(response);
  if (!data) return null;
  if (Array.isArray(data) && data.length > 0) return data[0].id;
  return data.id || null;
}

function logFailure(stepName, response) {
  console.error(`\n❌ ${stepName} FAILED\n   Status : ${response.status}\n   Body   : ${response.body}\n`);
  failedRequests.add(1);
}

function logSuccess(stepName, response) {
  console.log(`✅ ${stepName} PASSED — status=${response.status}`);
}

// ============================================================
// MAIN VIRTUAL CANDIDATE FLOW
// ============================================================

export default function () {
  const uniqueId = `${__VU}_${__ITER}_${Date.now()}`;
  const candidateName = `K6 Candidate ${uniqueId}`;
  const candidateEmail = `k6_${uniqueId}@k6test.reincrew.ai`;

  let candidateId = null;
  let sessionId = null;
  const interviewStartTime = Date.now();

  console.log(`\n============================================================`);
  console.log(`STARTING VIRTUAL CANDIDATE ${uniqueId} | MODE: ${MODE.toUpperCase()}`);
  console.log(`============================================================`);

  // ==========================================================
  // STEP 1 — CREATE / UPSERT CANDIDATE
  // ==========================================================
  const candidateStart = Date.now();
  const candidateResponse = supabaseUpsert("candidates", {
    name: candidateName,
    email: candidateEmail,
    applied_role: "CSE",
    clerk_user_id: `k6_${uniqueId}`,
  });
  candidateCreateTime.add(Date.now() - candidateStart);

  const candidateChecks = {
    "Step 1: HTTP 201 Created": (r) => r.status === 201,
    "Step 1: Valid JSON response": (r) => getJsonBody(r) !== null,
    "Step 1: Candidate ID actually returned": (r) => getIdFromResponse(r) !== null,
  };

  if (!check(candidateResponse, candidateChecks)) {
    logFailure("Step 1 — Candidate Creation", candidateResponse);
    interviewSuccessRate.add(false); interviewFailRate.add(true);
    return;
  }
  logSuccess("Step 1 — Candidate Creation", candidateResponse);
  candidateId = getIdFromResponse(candidateResponse);

  // ==========================================================
  // STEP 2 — CREATE INTERVIEW SESSION
  // ==========================================================
  const sessionStart = Date.now();
  const sessionResponse = supabaseInsert("interview_sessions", {
    candidate_id: candidateId,
    job_post_id: JOB_POST_ID,
    status: "IN_PROGRESS",
    interview_metadata: { source: "k6-load-test", mode: MODE, virtual_user: __VU, iteration: __ITER, test_id: uniqueId },
  }, true); // Need representation to get the Session ID
  sessionCreateTime.add(Date.now() - sessionStart);

  const sessionChecks = {
    "Step 2: HTTP 201 Created": (r) => r.status === 201,
    "Step 2: Valid JSON response": (r) => getJsonBody(r) !== null,
    "Step 2: Session ID actually returned": (r) => getIdFromResponse(r) !== null,
  };

  if (!check(sessionResponse, sessionChecks)) {
    logFailure("Step 2 — Interview Session Creation", sessionResponse);
    interviewSuccessRate.add(false); interviewFailRate.add(true);
    return;
  }
  logSuccess("Step 2 — Interview Session Creation", sessionResponse);
  sessionId = getIdFromResponse(sessionResponse);

  // ==========================================================
  // STEP 3 — SUBMIT MULTIPLE ANSWERS
  // ==========================================================
  let allAnswersPassed = true;
  for (let i = 0; i < ANSWER_COUNT; i++) {
    sleep(2 + Math.random() * 4); // Realistic thinking time
    const answerStart = Date.now();

    const answerPayload = {
      session_id: sessionId,
      question_index: i,
      question_text: `Simulated interview question ${i + 1}.`,
      candidate_answer: `Simulated candidate answer for question ${i + 1}.`,
      ideal_answer: `Simulated ideal answer for question ${i + 1}.`,
      content_score: 75, grammar_score: 75, fluency_score: 75,
      coverage: 75, understanding: 75, reasoning: 75, depth: 75,
      clarity: 75, structure: 75, confidence: 75, consistency: 75, answer_directness_score: 75,
      verdict: "Pass",
      feedback: "Simulated k6 evaluation feedback.",
      expected_key_points: ["Simulated key point 1", "Simulated key point 2"],
      detected_key_points: ["Simulated key point 1"],
      missing_key_points: ["Simulated key point 2"],
      deduction_reason: null,
    };

    const answerResponse = http.post(`${SUPABASE_URL}/rest/v1/session_responses`, JSON.stringify(answerPayload), { headers: getHeaders(), timeout: "30s" });
    answerSubmitTime.add(Date.now() - answerStart);

    const answerChecks = {
      [`Step 3.${i + 1}: HTTP 201 Created`]: (r) => r.status === 201,
    };

    if (!check(answerResponse, answerChecks)) {
      logFailure(`Step 3.${i + 1} — Answer Submission`, answerResponse);
      interviewSuccessRate.add(false); interviewFailRate.add(true);
      return;
    }
    logSuccess(`Step 3.${i + 1} — Answer Submission`, answerResponse);
    sleep(1);
  }

  // ==========================================================
  // STEP 4 — COMPLETE SESSION
  // ==========================================================
  const completeStart = Date.now();
  const completeRes = supabaseUpdate("interview_sessions", `id=eq.${sessionId}`, {
    status: "COMPLETED",
  });
  sessionCompleteTime.add(Date.now() - completeStart);

  const completeChecks = {
    "Step 4: HTTP 200 OK": (r) => r.status === 200 || r.status === 204,
  };

  if (!check(completeRes, completeChecks)) {
    logFailure("Step 4 — Session Completion", completeRes);
    interviewSuccessRate.add(false); interviewFailRate.add(true);
    return;
  }
  logSuccess("Step 4 — Session Completion", completeRes);
  sleep(1);

  // ==========================================================
  // STEP 5 — EVALUATION SAVE
  // ==========================================================
  const evaluationStart = Date.now();
  const evaluationResponse = supabaseUpdate("interview_sessions", `id=eq.${sessionId}`, {
    total_score: 75,
    final_verdict: "Pass",
    evaluation_report: {
      score: 75,
      feedback: "Simulated k6 evaluation report.",
      metadata: { source: "k6-load-test", mode: MODE },
    },
    evaluation_metadata: {
      source: "k6-load-test",
      mode: MODE,
      evaluated_at: new Date().toISOString(),
    },
  });
  evaluationSaveTime.add(Date.now() - evaluationStart);

  const evalChecks = {
    "Step 5: HTTP 200 OK": (r) => r.status === 200 || r.status === 204,
  };

  if (!check(evaluationResponse, evalChecks)) {
    logFailure("Step 5 — Evaluation Report Save", evaluationResponse);
    interviewSuccessRate.add(false); interviewFailRate.add(true);
    return;
  }
  logSuccess("Step 5 — Evaluation Report Save", evaluationResponse);
  sleep(1);

  // ==========================================================
  // STEP 5B — HYBRID EVALUATION TRIGGER (Conditional)
  // ==========================================================
  if (MODE === "hybrid" && sessionId) {
    console.log(`🔄 Triggering Hybrid Evaluation for session ${sessionId}`);
    const edgeResponse = http.post(`${SUPABASE_URL}/functions/v1/evaluate-hybrid-job`, JSON.stringify({ sessionId }), {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      timeout: "30s",
    });

    const edgeChecks = {
      "Step 5B: HTTP 200 OK": (r) => r.status === 200,
      "Step 5B: Valid JSON response": (r) => getJsonBody(r) !== null,
      "Step 5B: Edge function did not return an error": (r) => {
        const data = getJsonBody(r);
        // Catches cases where Edge Function returns 200 OK but body is { "error": "Failed" }
        return data && !data.error; 
      }
    };

    if (!check(edgeResponse, edgeChecks)) {
      logFailure("Step 5B — Hybrid Evaluation Trigger", edgeResponse);
      interviewSuccessRate.add(false); interviewFailRate.add(true);
      return;
    }
    logSuccess("Step 5B — Hybrid Evaluation Trigger", edgeResponse);
  }

  // ==========================================================
  // STEP 6 — FETCH FINAL RESULT
  // ==========================================================
  sleep(1); // Allow DB propagation
  const resultStart = Date.now();
  const resultResponse = supabaseSelect(RESULT_TABLE, `${RESULT_FILTER_COLUMN}=eq.${sessionId}&limit=1`);
  resultFetchTime.add(Date.now() - resultStart);

  const fetchChecks = {
    "Step 6: HTTP 200 OK": (r) => r.status === 200,
    "Step 6: Response is a valid JSON array": (r) => Array.isArray(getJsonBody(r)),
    "Step 6: Result found (not blocked by RLS)": (r) => {
      const data = getJsonBody(r);
      return Array.isArray(data) && data.length > 0;
    },
    "Step 6: Fetched Session ID matches": (r) => {
      const data = getJsonBody(r);
      return data[0].id === sessionId;
    },
    "Step 6: Final status is definitively COMPLETED": (r) => {
      const data = getJsonBody(r);
      return data[0].status === "COMPLETED";
    }
  };

  if (!check(resultResponse, fetchChecks)) {
    logFailure("Step 6 — Final Result Fetch", resultResponse);
    interviewSuccessRate.add(false); interviewFailRate.add(true);
    return;
  }
  logSuccess("Step 6 — Final Result Fetch", resultResponse);

  // ==========================================================
  // FINAL RESULT
  // ==========================================================
  const totalInterviewTime = (Date.now() - interviewStartTime) / 1000;
  interviewSuccessRate.add(true);
  interviewFailRate.add(false);
  console.log(`\n🎉 INTERVIEW FLOW SUCCESSFUL | Candidate: ${candidateId} | Session: ${sessionId} | Duration: ${totalInterviewTime.toFixed(2)}s\n`);
}

// ============================================================
// FINAL SUMMARY
// ============================================================
function safeGet(obj, path, defaultValue = 0) {
  try {
    const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
    return value !== undefined && value !== null ? value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function handleSummary(data) {
  const m = data.metrics || {};
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           REINCREW AI — k6 LOAD TEST SUMMARY                   ║
╠══════════════════════════════════════════════════════════════════╣
║  Evaluation Mode : ${MODE.toUpperCase().padEnd(39)}║
╠══════════════════════════════════════════════════════════════════╣
║  Success Rate      : ${(safeGet(m, 'interview_success_rate.values.rate') * 100).toFixed(1).padStart(5)}%                                  ║
║  Failure Rate      : ${(safeGet(m, 'interview_fail_rate.values.rate') * 100).toFixed(1).padStart(5)}%                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  P95 Request Time  : ${safeGet(m, 'http_req_duration.values.p(95)').toFixed(0).padStart(5)} ms                                ║
║  Candidate Create  : ${safeGet(m, 'candidate_create_time.values.avg').toFixed(0).padStart(5)} ms                                ║
║  Session Create    : ${safeGet(m, 'session_create_time.values.avg').toFixed(0).padStart(5)} ms                                ║
║  Answer Submit     : ${safeGet(m, 'answer_submit_time.values.avg').toFixed(0).padStart(5)} ms                                ║
║  Session Complete  : ${safeGet(m, 'session_complete_time.values.avg').toFixed(0).padStart(5)} ms                                ║
║  Eval Report Save  : ${safeGet(m, 'evaluation_save_time.values.avg').toFixed(0).padStart(5)} ms                                ║
║  Result Fetch      : ${safeGet(m, 'result_fetch_time.values.avg').toFixed(0).padStart(5)} ms                                ║
╠══════════════════════════════════════════════════════════════════╣
║  HTTP FAILED RATE  : ${(safeGet(m, 'http_req_failed.values.rate') * 100).toFixed(1).padStart(5)}%                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
  return {};
}