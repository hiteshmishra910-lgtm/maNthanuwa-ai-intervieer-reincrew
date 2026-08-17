// =============================================================================
// Reicrew AI — Evaluation Mode Performance Test (k6)
// =============================================================================
// Tests ALL three evaluation modes (LOCAL, HYBRID, API) with realistic
// database operations and edge function calls.
//
// HOW THIS TEST WORKS:
//   Since the actual 16-module LOCAL evaluation pipeline runs in-browser
//   (TypeScript), k6 tests the INFRASTRUCTURE layer: database throughput,
//   edge function availability, and each mode's unique data-flow pattern.
//
//   For a companion Node.js benchmark of the actual LOCAL pipeline, run:
//     npx tsx performance-tests/local-evaluation-benchmark.ts
//
// MODE PROFILES:
//   LOCAL  → Fast DB writes, no API calls (0 edge functions per answer)
//   HYBRID ��� Fast DB writes with evaluation_pending flag, 1 batch API call per session
//   API    → Each answer attempts 1 edge function call + DB write (5-9 calls total)
//
// Usage:
//   k6 run -e EVAL_MODE=hybrid  performance-tests/k6_evaluation_test.js
//   k6 run -e EVAL_MODE=api     performance-tests/k6_evaluation_test.js
//   k6 run -e EVAL_MODE=local   performance-tests/k6_evaluation_test.js
//   k6 run -e EVAL_MODE=all     performance-tests/k6_evaluation_test.js
//
//   Optional: -e STAGE=10  (default: smoke)
//            -e QUESTIONS=3 (answers per interview, default: 5)
// =============================================================================

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Configuration ──────────────────────────────────────────────────────────

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://kczpxtopdbiietknswgz.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjenB4dG9wZGJpaWV0a25zd2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Nzk5MTEsImV4cCI6MjA5OTA1NTkxMX0.J_RNZJgU5Gu5m_-DwcXJGRhB0vEFof32AUzvg8qwkHc';

const EVAL_MODE = (__ENV.EVAL_MODE || 'hybrid').toLowerCase();
const QUESTION_COUNT = parseInt(__ENV.QUESTIONS || '5');

const AUTH_HEADER = {
  'apikey': ANON_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

const REST_URL = `${SUPABASE_URL}/rest/v1`;
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1`;

// Stage configs (shared with k6_load_test.js)
const STAGES = {
  smoke:  { vus: 2,  duration: '30s',   rampUp: '5s',   hold: '20s',  rampDown: '5s' },
  10:     { vus: 10, duration: '2m',    rampUp: '15s',  hold: '1m30s', rampDown: '15s' },
  25:     { vus: 25, duration: '3m',    rampUp: '25s',  hold: '2m',    rampDown: '15s' },
  50:     { vus: 50, duration: '4m',    rampUp: '40s',  hold: '2m30s', rampDown: '20s' },
  100:    { vus: 100,duration: '5m',    rampUp: '60s',  hold: '3m',    rampDown: '30s' },
};

const stageName = __ENV.STAGE || 'smoke';
const stage = STAGES[stageName] || STAGES.smoke;

// ─── Custom Metrics ─────────────────────────────────────────────────────────

const responseWriteDuration = new Trend('eval_response_write_ms');
const sessionCreateDuration = new Trend('eval_session_create_ms');
const sessionCompleteDuration = new Trend('eval_session_complete_ms');
const reportSaveDuration = new Trend('eval_report_save_ms');
const edgeFnAttemptDuration = new Trend('eval_edge_fn_attempt_ms');
const iterationDuration = new Trend('eval_iteration_duration_ms');

const responseWriteErrors = new Rate('eval_response_write_errors');
const edgeFnErrors = new Rate('eval_edge_fn_errors');
const sessionErrors = new Rate('eval_session_errors');

const totalAnswersSubmitted = new Counter('eval_answers_submitted');
const totalSessionsCompleted = new Counter('eval_sessions_completed');
const totalEdgeFnCalls = new Counter('eval_edge_fn_calls');

// ─── Options ────────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { target: stage.vus, duration: stage.rampUp },
    { target: stage.vus, duration: stage.hold },
    { target: 0, duration: stage.rampDown },
  ],
  thresholds: {
    eval_response_write_errors: ['rate<0.10'],
    eval_edge_fn_errors: ['rate<0.20'],
    eval_session_errors: ['rate<0.10'],
    http_req_duration: ['p(95)<10000'],
  },
  noConnectionReuse: true,
  userAgent: 'ReicrewAI-EvalTest/1.0',
};

// ─── Sample Interview Questions ─────────────────────────────────────────────

const SAMPLE_QUESTIONS = [
  {
    id: 'q_eval_1',
    question: 'What is the difference between an array and a linked list?',
    ideal_answer: 'Arrays use contiguous memory with O(1) access by index; linked lists use nodes with pointers, O(1) insertion/deletion.',
    category: 'Technical_Fundamentals',
    type: 'Fundamentals',
    evaluationGuide: ['Compare memory layout', 'Discuss time complexity', 'Mention use cases'],
  },
  {
    id: 'q_eval_2',
    question: 'Explain encapsulation in object-oriented programming.',
    ideal_answer: 'Encapsulation bundles data and methods, hides internal state, exposes only necessary interfaces.',
    category: 'Technical_Core',
    type: 'Core',
    evaluationGuide: ['Define encapsulation', 'Explain data hiding', 'Give a code example'],
  },
  {
    id: 'q_eval_3',
    question: 'Describe a time you solved a complex technical problem.',
    ideal_answer: 'A structured answer using STAR method: situation, task, action, result.',
    category: 'Behavioral',
    type: 'Behavioral Experience',
    evaluationGuide: ['Situation context', 'Actions taken', 'Measurable outcome'],
  },
  {
    id: 'q_eval_4',
    question: 'What is a database index and how does it improve query performance?',
    ideal_answer: 'A B-tree or hash structure that speeds up lookups on indexed columns at the cost of slower writes.',
    category: 'Technical_Core',
    type: 'Core',
    evaluationGuide: ['Define database index', 'Explain how it works', 'Discuss trade-offs'],
  },
  {
    id: 'q_eval_5',
    question: 'How would you debug a memory leak in production?',
    ideal_answer: 'Use heap profiling tools, analyze garbage collection logs, inspect retained objects, reproduce locally.',
    category: 'Technical_Scenario',
    type: 'Scenario',
    evaluationGuide: ['Detection approach', 'Tools used', 'Fix strategy'],
  },
];

const SAMPLE_ANSWERS = [
  'Arrays store elements in contiguous memory locations so accessing any index is O(1), while linked lists store elements in nodes with pointers and insertion is O(1) but access is O(n). I would use arrays for random access patterns and linked lists for frequent insertions.',
  'Encapsulation is about bundling related data and methods together in a class and controlling access through visibility modifiers. It helps maintain code by hiding implementation details behind a public interface, which reduces complexity and prevents unintended interference.',
  'In my previous project, we faced frequent database deadlocks during peak hours. I analyzed the slow query log, identified a missing index causing full table scans, and implemented proper indexing and query optimization. This reduced deadlocks by 90 percent.',
  'A database index is like a book index — it creates a separate data structure that maps indexed columns to row locations. B-tree indexes allow log(n) lookups instead of full table scans. However, indexes slow down write operations since the index must be updated on each insert.',
  'I would start by checking memory usage patterns in production monitoring. Then take heap dumps during reported slow periods, compare them with baseline dumps, and look for objects that should have been garbage collected but are still retained. I would use tools like Chrome DevTools or YourKit.',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function pickQuestion(index) {
  return SAMPLE_QUESTIONS[index % SAMPLE_QUESTIONS.length];
}

function pickAnswer(index) {
  return SAMPLE_ANSWERS[index % SAMPLE_ANSWERS.length];
}

// ─── Edge Function Call (with realistic eval prompt) ────────────────────────

function callEdgeFunction(sessionId, questionObj, answerText) {
  const guideStr = (questionObj.evaluationGuide || [])
    .map(g => `- ${g}`).join('\n');

  const evalPrompt = `You are evaluating a SPOKEN interview answer.
QUESTION: "${questionObj.question}"
IDEAL/REFERENCE ANSWER: "${questionObj.ideal_answer || ''}"
TYPE: ${questionObj.type || 'Technical'}

EVALUATION CHECKLIST:
${guideStr}

CANDIDATE'S SPOKEN ANSWER: "${answerText}"

FIRST, classify the answer as one of:
- "honest_unknown" | "keyword_list_only" | "incorrect_attempt"
- "mixed_understanding" | "partial_explanation" | "full_explanation"

Return JSON with: answerType, accuracy, conceptCoverage, conceptUnderstanding,
reasoning, depth, clarity, structure, confidence, consistency, honestyScore,
misconceptionRisk, and mentionedConcepts.`;

  const start = Date.now();
  const res = http.post(
    `${EDGE_FN_URL}/openrouter-proxy`,
    JSON.stringify({
      prompt: evalPrompt,
      purpose: 'eval',
      sessionId: sessionId,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Origin': 'http://localhost:5173',
      },
    }
  );
  const dur = Date.now() - start;
  edgeFnAttemptDuration.add(dur);
  totalEdgeFnCalls.add(1);

  // Edge function requires real Clerk JWT — 401 means auth rejected (expected
  // in load test without a real token). 400 means it got through auth but
  // something else was wrong (good sign). 200 means it actually worked.
  // 429 means rate limited (our own cap).
  const passed = check(res, {
    'edge_fn: auth challenge or better': (r) =>
      r.status === 401 || r.status === 400 || r.status === 429 || r.status === 200,
  });
  if (!passed) edgeFnErrors.add(1);
  else edgeFnErrors.add(0);

  return { status: res.status, duration: dur };
}

// ─── Database Operations ────────────────────────────────────────────────────

function createCandidate(vuId, name, email) {
  const start = Date.now();
  const res = http.post(
    `${REST_URL}/candidates`,
    JSON.stringify({
      name: name,
      email: email,
      applied_role: 'CSE',
      clerk_user_id: `clerk_evaltest_${vuId}`,
    }),
    { headers: AUTH_HEADER }
  );
  const ok = res.status === 201 || res.status === 409;
  return { ok, id: ok && res.status === 201 ? (res.json()[0]?.id || null) : null, dur: Date.now() - start };
}

function getCandidateId(email) {
  const res = http.get(
    `${REST_URL}/candidates?email=eq.${encodeURIComponent(email)}&select=id`,
    { headers: AUTH_HEADER }
  );
  if (res.status !== 200) return null;
  const data = res.json();
  return data && data.length > 0 ? data[0].id : null;
}

function getJobPostId() {
  const res = http.get(`${REST_URL}/job_posts?limit=1&select=id`, { headers: AUTH_HEADER });
  if (res.status === 200 && res.json().length > 0) {
    return res.json()[0].id;
  }
  return null;
}

function createSession(candidateId, mode) {
  const jobPostId = getJobPostId();
  const start = Date.now();
  const payload = {
    candidate_id: candidateId,
    job_post_id: jobPostId || '00000000-0000-0000-0000-000000000000',
    status: 'IN_PROGRESS',
    total_questions: QUESTION_COUNT,
    interview_metadata: {
      source: 'k6_eval_test',
      evaluation_mode: mode,
      question_count: QUESTION_COUNT,
    },
  };
  const res = http.post(`${REST_URL}/interview_sessions`,
    JSON.stringify(payload), { headers: AUTH_HEADER }
  );
  sessionCreateDuration.add(Date.now() - start);
  if (res.status !== 201) {
    sessionErrors.add(1);
    return null;
  }
  const session = res.json();
  return session[0]?.id || null;
}

function submitAnswer(sessionId, questionIndex, questionObj, answerText, mode) {
  const isLocalOrHybrid = (mode === 'local' || mode === 'hybrid');

  const payload = {
    session_id: sessionId,
    question_index: questionIndex,
    question_text: questionObj.question,
    candidate_answer: answerText,
    ideal_answer: questionObj.ideal_answer || '',
    content_score: isLocalOrHybrid ? Math.round((6 + Math.random() * 3) * 10) / 10 : null,
    grammar_score: isLocalOrHybrid ? Math.round((7 + Math.random() * 2) * 10) / 10 : null,
    fluency_score: isLocalOrHybrid ? Math.round((7 + Math.random() * 2) * 10) / 10 : null,
    verdict: isLocalOrHybrid ? 'Pass' : null,
    feedback: isLocalOrHybrid ? 'Load test local evaluation.' : null,
    // API mode: scores are null (filled by edge function later)
  };

  const start = Date.now();
  const res = http.post(`${REST_URL}/session_responses`,
    JSON.stringify(payload), { headers: AUTH_HEADER }
  );
  responseWriteDuration.add(Date.now() - start);
  totalAnswersSubmitted.add(1);

  const passed = check(res, {
    [`answer_q${questionIndex}: status 201`]: (r) => r.status === 201,
  });
  if (!passed) responseWriteErrors.add(1);

  return { ok: passed, status: res.status };
}

function completeSession(sessionId, mode) {
  const start = Date.now();
  const overallScore = mode === 'local'
    ? Math.round(50 + Math.random() * 40)
    : null; // API/HYBRID: score comes from AI, not us

  const updatePayload = {
    status: 'COMPLETED',
  };
  if (overallScore !== null) {
    updatePayload.overall_score = overallScore;
  }

  const res = http.patch(
    `${REST_URL}/interview_sessions?id=eq.${sessionId}`,
    JSON.stringify(updatePayload),
    { headers: AUTH_HEADER }
  );
  sessionCompleteDuration.add(Date.now() - start);
  totalSessionsCompleted.add(1);

  check(res, {
    'session_complete: 204 or 200': (r) => r.status === 204 || r.status === 200,
  });
}

function saveEvaluationReport(sessionId) {
  const reportPayload = {
    session_id: sessionId,
    total_score: Math.round(50 + Math.random() * 40),
    final_verdict: 'Pass',
    hiring_recommendation: 'Hire',
    strengths: ['Good technical understanding', 'Clear communication'],
    failures: [],
    evaluation_logic: {
      answerType: 'partial_explanation',
      misconceptionRisk: 'LOW',
      totalScore: 65,
    },
    evaluation_model: 'gemini-2.5-flash-lite',
    evaluated_at: new Date().toISOString(),
  };

  const start = Date.now();
  const res = http.post(`${REST_URL}/evaluation_reports`,
    JSON.stringify(reportPayload),
    { headers: AUTH_HEADER }
  );
  reportSaveDuration.add(Date.now() - start);

  check(res, {
    'report_save: 201': (r) => r.status === 201,
  });
}

// ─── Mode-Specific Interview Simulation ─────────────────────────────────────

function runLocalModeInterview(vuId, iter) {
  const label = `${vuId}-${iter}`;
  const name = `EvalLocal_${label}`;
  const email = `eval-local-${label}@reicrew-test.ai`;

  // 1. Create candidate
  createCandidate(label, name, email);
  const candidateId = getCandidateId(email);
  if (!candidateId) { sessionErrors.add(1); return; }

  // 2. Create session
  const sessionId = createSession(candidateId, 'local');
  if (!sessionId) return;

  // 3. Answer questions (LOCAL = fast, no API calls)
  for (let qi = 0; qi < QUESTION_COUNT; qi++) {
    const q = pickQuestion(qi);
    const a = pickAnswer(qi);
    submitAnswer(sessionId, qi, q, a, 'local');
  }

  // 4. Complete session
  completeSession(sessionId, 'local');
}

function runHybridModeInterview(vuId, iter) {
  const label = `${vuId}-${iter}`;
  const name = `EvalHybrid_${label}`;
  const email = `eval-hybrid-${label}@reicrew-test.ai`;

  // 1. Create candidate
  createCandidate(label, name, email);
  const candidateId = getCandidateId(email);
  if (!candidateId) { sessionErrors.add(1); return; }

  // 2. Create session
  const sessionId = createSession(candidateId, 'hybrid');
  if (!sessionId) return;

  // 3. Answer questions (HYBRID = fast local eval, mark as pending)
  for (let qi = 0; qi < QUESTION_COUNT; qi++) {
    const q = pickQuestion(qi);
    const a = pickAnswer(qi);
    submitAnswer(sessionId, qi, q, a, 'hybrid');
  }

  // 4. Complete session — evaluation_pending triggers bg queue
  completeSession(sessionId, 'hybrid');
}

function runApiModeInterview(vuId, iter) {
  const label = `${vuId}-${iter}`;
  const name = `EvalApi_${label}`;
  const email = `eval-api-${label}@reicrew-test.ai`;

  // 1. Create candidate
  createCandidate(label, name, email);
  const candidateId = getCandidateId(email);
  if (!candidateId) { sessionErrors.add(1); return; }

  // 2. Create session
  const sessionId = createSession(candidateId, 'api');
  if (!sessionId) return;

  // 3. Answer questions (API = try edge function for each)
  for (let qi = 0; qi < QUESTION_COUNT; qi++) {
    const q = pickQuestion(qi);
    const a = pickAnswer(qi);

    // API mode: attempt edge function call
    callEdgeFunction(sessionId, q, a);

    // Then save response to DB (scores come from edge function in real flow)
    // In load test, we simulate with placeholder scores
    const apiPayload = {
      session_id: sessionId,
      question_index: qi,
      question_text: q.question,
      candidate_answer: a,
      ideal_answer: q.ideal_answer || '',
      content_score: Math.round((5 + Math.random() * 4) * 10) / 10,
      grammar_score: Math.round((6 + Math.random() * 3) * 10) / 10,
      fluency_score: Math.round((6 + Math.random() * 3) * 10) / 10,
      verdict: 'Pass',
      feedback: 'AI evaluation completed.',
    };

    const start = Date.now();
    const res = http.post(`${REST_URL}/session_responses`,
      JSON.stringify(apiPayload), { headers: AUTH_HEADER }
    );
    responseWriteDuration.add(Date.now() - start);
    totalAnswersSubmitted.add(1);

    check(res, {
      [`api_answer_q${qi}: status 201`]: (r) => r.status === 201,
    });
  }

  // 4. Complete session
  completeSession(sessionId, 'api');

  // 5. Save evaluation report (simulates the AI-generated report)
  saveEvaluationReport(sessionId);
}

// ─── Main Test ──────────────────────────────────────────────────────────────

export default function () {
  const vuId = `${__VU}`;
  const iter = `${__ITER}`;
  const iterStart = Date.now();

  if (EVAL_MODE === 'local') {
    group('LOCAL Mode — 0 API Calls, Fast DB Writes', function () {
      runLocalModeInterview(vuId, iter);
    });
  } else if (EVAL_MODE === 'hybrid') {
    group('HYBRID Mode — Local Eval + Pending Flag, Background AI', function () {
      runHybridModeInterview(vuId, iter);
    });
  } else if (EVAL_MODE === 'api') {
    group('API Mode — Edge Function Per Answer + Report Save', function () {
      runApiModeInterview(vuId, iter);
    });
  } else if (EVAL_MODE === 'all') {
    // Run all three modes sequentially per iteration for comparison
    group('A: LOCAL Mode', function () { runLocalModeInterview(vuId, iter); });
    group('B: HYBRID Mode', function () { runHybridModeInterview(vuId, iter); });
    group('C: API Mode', function () { runApiModeInterview(vuId, iter); });
  }

  iterationDuration.add(Date.now() - iterStart);

  // Brief pause between iterations
  sleep(Math.random() * 1.5 + 0.5);
}
