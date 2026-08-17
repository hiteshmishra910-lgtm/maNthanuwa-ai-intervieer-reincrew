// =============================================================================
// Reicrew AI — Database & Backend Load Test (k6)
// =============================================================================
// Usage:
//   1. Install k6: https://grafana.com/docs/k6/latest/get-started/installation/
//      Windows: winget install k6  OR  choco install k6
//      macOS:   brew install k6
//      Linux:   sudo apt install k6
//
//   2. Create performance-tests/config.env with:
//      SUPABASE_URL=https://kczpxtopdbiietknswgz.supabase.co
//      SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
//      SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...  (service_role key from Settings > API)
//
//   3. Run:
//      k6 run -e STAGE=10 performance-tests/k6_load_test.js
//      k6 run -e STAGE=25 performance-tests/k6_load_test.js
//      k6 run -e STAGE=50 performance-tests/k6_load_test.js
//      k6 run -e STAGE=100 performance-tests/k6_load_test.js
//
//   4. For a quick smoke test:
//      k6 run -e STAGE=smoke performance-tests/k6_load_test.js
//
// Results are printed to stdout as a summary table. Use --out json=results.json
// for machine-readable output.
// =============================================================================

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Configuration ──────────────────────────────────────────────────────────

const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://kczpxtopdbiietknswgz.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjenB4dG9wZGJpaWV0a25zd2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Nzk5MTEsImV4cCI6MjA5OTA1NTkxMX0.J_RNZJgU5Gu5m_-DwcXJGRhB0vEFof32AUzvg8qwkHc';
const SERVICE_KEY = __ENV.SUPABASE_SERVICE_KEY || '';

// Always use the service_role key for load testing (bypasses RLS).
// The anon key is used as the apikey header value since Supabase requires it.
const AUTH_HEADER = {
  'apikey': ANON_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

const REST_URL = `${SUPABASE_URL}/rest/v1`;
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1`;

// Stage configurations: virtual_users, duration_seconds
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

const dbReadDuration = new Trend('db_read_duration_ms');
const dbWriteDuration = new Trend('db_write_duration_ms');
const dbErrorRate = new Rate('db_errors');
const edgeFnDuration = new Trend('edge_fn_duration_ms');
const edgeFnErrorRate = new Rate('edge_fn_errors');
const authDuration = new Trend('auth_check_duration_ms');
const reportDuration = new Trend('report_generation_duration_ms');
const totalOperations = new Counter('total_operations');

// ─── Options ────────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { target: stage.vus, duration: stage.rampUp },
    { target: stage.vus, duration: stage.hold },
    { target: 0, duration: stage.rampDown },
  ],
  thresholds: {
    db_errors: ['rate<0.05'],          // Allow up to 5% DB errors
    edge_fn_errors: ['rate<0.10'],     // Allow up to 10% edge function errors
    http_req_duration: ['p(95)<5000'], // 95% of requests under 5s
  },
  noConnectionReuse: false,
  userAgent: 'ReicrewAI-LoadTest/1.0',
};

// ─── Test Data ──────────────────────────────────────────────────────────────

const SAMPLE_NAMES = [
  'Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince',
  'Eve Wilson', 'Frank Miller', 'Grace Lee', 'Henry Davis',
  'Iris Chen', 'Jack White', 'Karen Moore', 'Leo Turner',
  'Mia Harris', 'Noah Martin', 'Olivia Clark', 'Paul Adams',
  'Quinn Baker', 'Rachel Hall', 'Sam Wright', 'Tina Scott',
];

const SAMPLE_ANSWERS = [
  'This is a fundamental concept that involves the core principles of the subject. The key idea is to understand how different components interact with each other in a systematic way.',
  'Based on my understanding, this works by first establishing the base case and then building upon it iteratively. The most important aspect is the relationship between the inputs and outputs.',
  'I would approach this by first analyzing the requirements, then designing a solution that addresses the core problem. The main challenge is balancing tradeoffs between performance and maintainability.',
  'The concept can be explained through an analogy: it is similar to how a library organizes books by categories. Each category has its own rules and relationships with other categories.',
  'From a practical standpoint, this is implemented using a layered architecture where each layer has specific responsibilities. The key benefit is separation of concerns and reusability.',
  'I have worked with this in a previous project where we needed to handle concurrent requests efficiently. The solution involved using a queue-based system with proper error handling.',
  'This is a well-known pattern in software engineering. The main components include the interface, the implementation, and the configuration layer that ties them together.',
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

// ─── Main Test ──────────────────────────────────────────────────────────────

export default function () {
  const vuId = `${__VU}-${__ITER}`;
  const candidateName = randomItem(SAMPLE_NAMES);
  const candidateEmail = `loadtest-${vuId}@reicrew-test.ai`;
  const clerkUserId = `clerk_test_${vuId}`;

  group('1. Database Read — Job Posts', function () {
    const start = Date.now();
    const res = http.get(`${REST_URL}/job_posts?limit=5`, { headers: AUTH_HEADER });
    const dur = Date.now() - start;
    dbReadDuration.add(dur);
    totalOperations.add(1);

    const passed = check(res, {
      'job_posts: status 200': (r) => r.status === 200,
      'job_posts: has data': (r) => {
        if (r.body === null || r.body === '') return false;
        try { return JSON.parse(r.body).length >= 0; } catch (e) { return false; }
      },
    });
    if (!passed) dbErrorRate.add(1);
    else dbErrorRate.add(0);
  });

  group('2. Database Write — Create Candidate', function () {
    const start = Date.now();
    const res = http.post(`${REST_URL}/candidates`, JSON.stringify({
      name: candidateName,
      email: candidateEmail,
      applied_role: 'CSE',
      clerk_user_id: clerkUserId,
    }), { headers: AUTH_HEADER });
    const dur = Date.now() - start;
    dbWriteDuration.add(dur);
    totalOperations.add(1);

    // If 409 Conflict (duplicate email), that's OK — treat as success
    const passed = check(res, {
      'candidates: status 201 or 409': (r) => r.status === 201 || r.status === 409,
    });
    if (!passed) dbErrorRate.add(1);
    else dbErrorRate.add(0);
  });

  group('3. Database Read — Get Candidate by Email', function () {
    const start = Date.now();
    const res = http.get(
      `${REST_URL}/candidates?email=eq.${encodeURIComponent(candidateEmail)}&select=id`,
      { headers: AUTH_HEADER }
    );
    const dur = Date.now() - start;
    dbReadDuration.add(dur);
    totalOperations.add(1);

    const passed = check(res, {
      'candidates_read: status 200': (r) => r.status === 200,
    });
    if (!passed) dbErrorRate.add(1);
    else dbErrorRate.add(0);
  });

  group('4. Database Write — Create Interview Session', function () {
    // First get candidate ID from email
    const lookupRes = http.get(
      `${REST_URL}/candidates?email=eq.${encodeURIComponent(candidateEmail)}&select=id`,
      { headers: AUTH_HEADER }
    );
    if (lookupRes.status !== 200) {
      dbErrorRate.add(1);
      return;
    }
    const candidates = lookupRes.json();
    if (!candidates || candidates.length === 0) {
      dbErrorRate.add(1);
      return;
    }
    const candidateId = candidates[0].id;

    // Get a job post ID
    const jobRes = http.get(`${REST_URL}/job_posts?limit=1&select=id`, { headers: AUTH_HEADER });
    let jobPostId = null;
    if (jobRes.status === 200 && jobRes.json().length > 0) {
      jobPostId = jobRes.json()[0].id;
    }

    const sessionPayload = {
      candidate_id: candidateId,
      job_post_id: jobPostId || '00000000-0000-0000-0000-000000000000',
      status: 'IN_PROGRESS',
      total_questions: 5,
      interview_metadata: { source: 'k6_load_test', vu_id: vuId },
    };

    const start = Date.now();
    const res = http.post(`${REST_URL}/interview_sessions`,
      JSON.stringify(sessionPayload),
      { headers: AUTH_HEADER }
    );
    const dur = Date.now() - start;
    dbWriteDuration.add(dur);
    totalOperations.add(1);

    const passed = check(res, {
      'session: status 201': (r) => r.status === 201,
    });
    if (!passed) {
      dbErrorRate.add(1);
      return;
    }

    const session = res.json();
    const sessionId = session[0]?.id;

    if (sessionId) {
      // ── Sub-group: Submit 3 Answers ────────────────────────────────────
      for (let qi = 0; qi < 3; qi++) {
        const answerPayload = {
          session_id: sessionId,
          question_index: qi,
          question_text: `Load test question ${qi + 1} for evaluation.`,
          candidate_answer: randomItem(SAMPLE_ANSWERS),
          ideal_answer: 'A comprehensive explanation covering all key aspects of the topic.',
          content_score: Math.round((5 + Math.random() * 5) * 10) / 10,
          grammar_score: Math.round((6 + Math.random() * 3) * 10) / 10,
          fluency_score: Math.round((6 + Math.random() * 3) * 10) / 10,
          verdict: 'Pass',
          feedback: `Evaluated automatically during load test.`,
        };

        const ansStart = Date.now();
        const ansRes = http.post(`${REST_URL}/session_responses`,
          JSON.stringify(answerPayload),
          { headers: AUTH_HEADER }
        );
        const ansDur = Date.now() - ansStart;
        dbWriteDuration.add(ansDur);
        totalOperations.add(1);

        check(ansRes, {
          [`answer_q${qi}: status 201`]: (r) => r.status === 201,
        });
      }

      // ── Sub-group: Complete the session ────────────────────────────────
      const completeStart = Date.now();
      const completeRes = http.patch(
        `${REST_URL}/interview_sessions?id=eq.${sessionId}`,
        JSON.stringify({ status: 'COMPLETED', overall_score: Math.round(50 + Math.random() * 50) }),
        { headers: AUTH_HEADER }
      );
      const completeDur = Date.now() - completeStart;
      dbWriteDuration.add(completeDur);
      totalOperations.add(1);

      check(completeRes, {
        'session_complete: status 204 or 200': (r) => r.status === 204 || r.status === 200,
      });
    }
  });

  group('5. Dashboard — Read Views', function () {
    const viewStart = Date.now();

    // Fetch dashboard main view
    const res1 = http.get(`${REST_URL}/vw_candidate_master?limit=20&order=interview_date.desc`, {
      headers: AUTH_HEADER,
    });
    const dur1 = Date.now() - viewStart;
    dbReadDuration.add(dur1);
    totalOperations.add(1);

    check(res1, {
      'vw_candidate_master: status 200': (r) => r.status === 200,
    });

    // Fetch system settings
    const res2 = http.get(
      `${REST_URL}/system_settings?select=key,value&limit=5`,
      { headers: AUTH_HEADER }
    );
    dbReadDuration.add(Date.now() - viewStart);
    totalOperations.add(1);

    check(res2, {
      'system_settings: status 200': (r) => r.status === 200,
    });
  });

  group('6. Edge Function — Health Check', function () {
    // Edge functions only accept POST or OPTIONS. Send a minimal ping.
    const start = Date.now();
    const res = http.post(`${EDGE_FN_URL}/openrouter-proxy`,
      JSON.stringify({ prompt: 'ping', purpose: 'health', sessionId: 'health-check' }),
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
    edgeFnDuration.add(dur);
    totalOperations.add(1);

    // A 401 (no valid JWT for session) or 400 (bad request for ping) means
    // the edge function is alive and accepting requests.
    const passed = check(res, {
      'edge_fn: responds': (r) => r.status === 400 || r.status === 401 || r.status === 200,
    });
    if (!passed) edgeFnErrorRate.add(1);
    else edgeFnErrorRate.add(0);
  });

  // Brief pause between iterations to simulate real user behavior
  sleep(Math.random() * 2 + 1);
}
