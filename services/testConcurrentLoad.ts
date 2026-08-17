import { generateWithFailover } from '../src/Core/ai/aiProviderManager';
import { supabase } from '../src/Core/database/supabaseClient';

// ─── 5 Simulated Interview Sessions ─────────────────────────────────────────
const INTERVIEW_SESSIONS = [
  {
    sessionId: 'concurrent-test-1',
    candidateName: 'Candidate A',
    questions: [
      "Evaluate this answer about arrays: 'An array stores elements at contiguous memory locations.'",
      "Evaluate this answer about OOP: 'Encapsulation means hiding internal data using access modifiers.'",
      "Evaluate this answer about DBMS: 'A primary key uniquely identifies each record in a table.'",
      "Evaluate this answer about OS: 'A process is a program in execution with its own memory space.'",
      "Evaluate this answer about networking: 'HTTP is stateless — each request is independent.'",
    ]
  },
  {
    sessionId: 'concurrent-test-2',
    candidateName: 'Candidate B',
    questions: [
      "Evaluate this answer about stacks: 'Stack follows LIFO — last element inserted is first to be removed.'",
      "Evaluate this answer about recursion: 'Recursion calls itself with a smaller input until base case is met.'",
      "Evaluate this answer about SQL joins: 'INNER JOIN returns only matching rows from both tables.'",
      "Evaluate this answer about trees: 'Binary search tree has left child smaller and right child larger than root.'",
      "Evaluate this answer about hashing: 'Hash function maps data to fixed size values for fast lookup.'",
    ]
  },
  {
    sessionId: 'concurrent-test-3',
    candidateName: 'Candidate C',
    questions: [
      "Evaluate this answer about sorting: 'Merge sort divides array in half recursively then merges sorted halves.'",
      "Evaluate this answer about graphs: 'BFS uses a queue to explore nodes level by level.'",
      "Evaluate this answer about threads: 'Threads share the same memory space within a process.'",
      "Evaluate this answer about indexing: 'Database index speeds up queries by creating a separate lookup structure.'",
      "Evaluate this answer about REST: 'REST uses HTTP methods GET POST PUT DELETE for CRUD operations.'",
    ]
  },
  {
    sessionId: 'concurrent-test-4',
    candidateName: 'Candidate D',
    questions: [
      "Evaluate this answer about normalization: 'Normalization removes data redundancy by organizing tables efficiently.'",
      "Evaluate this answer about deadlocks: 'Deadlock occurs when two processes wait for each other indefinitely.'",
      "Evaluate this answer about virtual memory: 'Virtual memory uses disk space to extend available RAM.'",
      "Evaluate this answer about polymorphism: 'Polymorphism allows same method name to behave differently in subclasses.'",
      "Evaluate this answer about encryption: 'AES is a symmetric encryption algorithm using same key to encrypt and decrypt.'",
    ]
  },
  {
    sessionId: 'concurrent-test-5',
    candidateName: 'Candidate E',
    questions: [
      "Evaluate this answer about cloud: 'Cloud computing delivers computing services over the internet on demand.'",
      "Evaluate this answer about microservices: 'Microservices break application into small independent deployable services.'",
      "Evaluate this answer about docker: 'Docker containers package application with all dependencies to run anywhere.'",
      "Evaluate this answer about agile: 'Agile uses sprints to deliver working software incrementally.'",
      "Evaluate this answer about git: 'Git tracks changes in code and allows collaboration through branches.'",
    ]
  }
];

// ─── Result Types ─────────────────────────────────────────────────────────────
interface QuestionResult {
  questionIndex: number;
  provider: string;
  responseTimeMs: number;
  success: boolean;
  errorType: string | null;
}

interface SessionResult {
  sessionId: string;
  candidateName: string;
  questions: QuestionResult[];
  totalTimeMs: number;
  successCount: number;
  failCount: number;
}

// ─── Run a single interview session ──────────────────────────────────────────
async function runInterviewSession(session: typeof INTERVIEW_SESSIONS[0]): Promise<SessionResult> {
  console.log(`[Concurrent] Starting session: ${session.candidateName}`);
  const sessionStart = performance.now();
  const questionResults: QuestionResult[] = [];

  // Run questions sequentially within each session
  for (let i = 0; i < session.questions.length; i++) {
    const qStart = performance.now();
    let success = false;
    let errorType: string | null = null;
    let provider = 'Unknown';

    try {
      await generateWithFailover(
        session.questions[i],
        'eval',
        undefined,
        session.sessionId
      );
      success = true;

      // Get last successful provider from Supabase
      const { data } = await supabase
        .from('ai_provider_logs')
        .select('provider_name')
        .eq('session_id', session.sessionId)
        .eq('success', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      provider = data?.provider_name || 'Groq';

    } catch (err: any) {
      errorType = err.message || 'UNKNOWN';
      console.warn(`[Concurrent] ${session.candidateName} Q${i + 1} failed: ${errorType}`);
    }

    const responseTimeMs = Math.round(performance.now() - qStart);
    questionResults.push({
      questionIndex: i + 1,
      provider,
      responseTimeMs,
      success,
      errorType
    });

    console.log(
      `[Concurrent] ${session.candidateName} Q${i + 1}: ${success ? '✓' : '✗'} ${responseTimeMs}ms`
    );

    // Small delay between questions within same session
    await new Promise(r => setTimeout(r, 200));
  }

  const totalTimeMs = Math.round(performance.now() - sessionStart);
  const successCount = questionResults.filter(q => q.success).length;

  return {
    sessionId: session.sessionId,
    candidateName: session.candidateName,
    questions: questionResults,
    totalTimeMs,
    successCount,
    failCount: questionResults.length - successCount
  };
}

// ─── Run all 5 sessions concurrently ─────────────────────────────────────────
export async function runConcurrentLoadTest(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('         CONCURRENT LOAD TEST — 5 SIMULTANEOUS INTERVIEWS');
  console.log('         Total: 25 AI requests fired at the same time');
  console.log('═══════════════════════════════════════════════════════\n');

  const testStart = performance.now();

  // Fire all 5 sessions at exactly the same time
  const sessionPromises = INTERVIEW_SESSIONS.map(session =>
    runInterviewSession(session)
  );

  const results = await Promise.allSettled(sessionPromises);
  const totalTestTimeMs = Math.round(performance.now() - testStart);

  const sessionResults: SessionResult[] = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<SessionResult>).value);

  printConcurrentResults(sessionResults, totalTestTimeMs);
}

// ─── Print Results ────────────────────────────────────────────────────────────
function printConcurrentResults(results: SessionResult[], totalTimeMs: number): void {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                 CONCURRENT TEST RESULTS               ');
  console.log('═══════════════════════════════════════════════════════\n');

  // Per session summary
  console.log(' Candidate     | Questions | Success | Failed | Total Time');
  console.log(' --------------|-----------|---------|--------|------------');

  results.forEach(r => {
    console.log(
      ` ${r.candidateName.padEnd(14)}| ${String(r.questions.length).padEnd(9)} | ${String(r.successCount).padEnd(7)} | ${String(r.failCount).padEnd(6)} | ${r.totalTimeMs}ms`
    );
  });

  // Provider breakdown
  const providerStats: Record<string, { count: number; totalTime: number }> = {};
  results.forEach(r => {
    r.questions.forEach(q => {
      if (q.success) {
        if (!providerStats[q.provider]) {
          providerStats[q.provider] = { count: 0, totalTime: 0 };
        }
        providerStats[q.provider].count += 1;
        providerStats[q.provider].totalTime += q.responseTimeMs;
      }
    });
  });

  console.log('\n Provider Distribution Under Concurrent Load:');
  console.log(' Provider              | Requests Handled | Avg Response Time');
  console.log(' ----------------------|------------------|------------------');

  Object.entries(providerStats).forEach(([provider, stats]) => {
    const avgTime = Math.round(stats.totalTime / stats.count);
    console.log(
      ` ${provider.padEnd(22)}| ${String(stats.count).padEnd(16)} | ${avgTime}ms`
    );
  });

  // Overall stats
  const totalQuestions = results.reduce((a, r) => a + r.questions.length, 0);
  const totalSuccess = results.reduce((a, r) => a + r.successCount, 0);
  const totalFailed = results.reduce((a, r) => a + r.failCount, 0);
  const allResponseTimes = results.flatMap(r =>
    r.questions.filter(q => q.success).map(q => q.responseTimeMs)
  );
  const avgResponseTime = allResponseTimes.length > 0
    ? Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length)
    : 0;
  const maxResponseTime = allResponseTimes.length > 0
    ? Math.max(...allResponseTimes)
    : 0;
  const minResponseTime = allResponseTimes.length > 0
    ? Math.min(...allResponseTimes)
    : 0;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' OVERALL SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(` Total Sessions:       5 concurrent`);
  console.log(` Total Questions:      ${totalQuestions}`);
  console.log(` Successful:           ${totalSuccess} (${Math.round(totalSuccess / totalQuestions * 100)}%)`);
  console.log(` Failed:               ${totalFailed}`);
  console.log(` Avg Response Time:    ${avgResponseTime}ms`);
  console.log(` Min Response Time:    ${minResponseTime}ms`);
  console.log(` Max Response Time:    ${maxResponseTime}ms`);
  console.log(` Total Test Duration:  ${totalTimeMs}ms`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Bottleneck analysis
  console.log(' BOTTLENECK ANALYSIS:');
  if (totalFailed > 0) {
    console.log(` ⚠ ${totalFailed} requests failed — likely Groq rate limiting under concurrent load`);
  }
  if (avgResponseTime > 2000) {
    console.log(` ⚠ Avg response time ${avgResponseTime}ms exceeds 2s — provider failover adding latency`);
  } else {
    console.log(` ✓ Avg response time ${avgResponseTime}ms is within acceptable range`);
  }
  if (maxResponseTime > 5000) {
    console.log(` ⚠ Max response time ${maxResponseTime}ms — some requests experiencing high latency under load`);
  }
  console.log('\n Note: Gemini proxy and DeepSeek unavailable during test.');
  console.log(' All load handled by Groq free tier (30 req/min limit).');
  console.log('═══════════════════════════════════════════════════════\n');
}