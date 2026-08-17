/**
 * Interview Load Testing Bot - Tests Each Evaluation Mode
 * 
 * Modes:
 *   - LOCAL:  Zero API calls, instant local heuristics
 *   - HYBRID: Instant local + queued AI batch after interview
 *   - API:    Real-time AI evaluation per question
 * 
 * Usage:
 *   npx tsx services/interviewLoadTest.ts [mode] [concurrentStudents] [questionsPerInterview]
 * 
 * Examples:
 *   npx tsx services/interviewLoadTest.ts local 10 5
 *   npx tsx services/interviewLoadTest.ts hybrid 15 5
 *   npx tsx services/interviewLoadTest.ts api 10 5
 */

// ─── Configuration ─────────────────────────────────────────────────────────────
type EvaluationMode = 'local' | 'hybrid' | 'api';

const MODE = (process.argv[2] || 'local').toLowerCase() as EvaluationMode;
const CONCURRENT_STUDENTS = parseInt(process.argv[3] || '10');
const QUESTIONS_PER_INTERVIEW = parseInt(process.argv[4] || '5');

// ─── Sample Questions ──────────────────────────────────────────────────────────
const SAMPLE_QUESTIONS = [
  { q: "What is the difference between an array and a linked list?", a: "Arrays use contiguous memory with O(1) access; linked lists use nodes with O(1) insertion." },
  { q: "Explain the concept of object-oriented programming.", a: "Encapsulation, inheritance, polymorphism, and abstraction are the four pillars." },
  { q: "What is a database index and when should you use one?", a: "A data structure that speeds up queries on specific columns used in WHERE/JOIN." },
  { q: "TCP vs UDP?", a: "TCP is reliable and ordered; UDP is faster but unreliable." },
  { q: "What is deadlock in operating systems?", a: "Two processes blocked forever waiting for each other's resources." },
  { q: "REST API design principles?", a: "Stateless, resource-based URLs, HTTP methods for CRUD." },
  { q: "SQL vs NoSQL databases?", a: "SQL is relational with schemas; NoSQL is flexible and scalable." },
  { q: "Microservices architecture?", a: "Independent, loosely coupled services communicating via APIs." },
  { q: "Time complexity of sorting algorithms?", a: "Merge sort O(n log n), bubble sort O(n²), quicksort average O(n log n)." },
  { q: "Virtual memory?", a: "Uses disk to extend RAM, mapping virtual to physical addresses." },
];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface StudentMetrics {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  questionsAnswered: number;
  evaluationTimes: number[];
  totalDurationMs: number;
  errors: string[];
  mode: EvaluationMode;
}

interface ModeResults {
  mode: EvaluationMode;
  totalStudents: number;
  successful: number;
  failed: number;
  totalQuestions: number;
  answeredQuestions: number;
  totalEvaluations: number;
  failedEvaluations: number;
  avgEvaluationTimeMs: number;
  minEvaluationTimeMs: number;
  maxEvaluationTimeMs: number;
  p95EvaluationTimeMs: number;
  p99EvaluationTimeMs: number;
  totalDurationMs: number;
  evaluationsPerSecond: number;
  apiCalls: number;
  errorSummary: Record<string, number>;
}

// ─── Local Evaluation (Heuristics Only) ────────────────────────────────────────
async function localEvaluate(question: string, answer: string): Promise<number> {
  // Simulate local heuristic evaluation (5-50ms)
  const processingTime = 5 + Math.random() * 45;
  await new Promise(r => setTimeout(r, processingTime));
  
  // Simple scoring based on answer length and keywords
  const wordCount = answer.split(' ').length;
  const hasKeyTerms = question.toLowerCase().split(' ').some(w => 
    answer.toLowerCase().includes(w) && w.length > 3
  );
  
  let score = 5;
  if (wordCount > 10) score += 1;
  if (wordCount > 20) score += 1;
  if (hasKeyTerms) score += 1;
  if (answer.includes('O(') || answer.includes('complexity')) score += 0.5;
  
  return Math.min(10, Math.round(score * 10) / 10);
}

// ─── Hybrid Evaluation (Local + Queued AI) ─────────────────────────────────────
async function hybridEvaluate(question: string, answer: string): Promise<number> {
  // During interview: returns local result instantly
  return localEvaluate(question, answer);
  
  // After interview: AI batch evaluation queued (not measured here)
}

// ─── API Evaluation (Real-time AI) ─────────────────────────────────────────────
async function apiEvaluate(question: string, answer: string): Promise<number> {
  // Simulate real AI API call (800-2500ms)
  const processingTime = 800 + Math.random() * 1700;
  await new Promise(r => setTimeout(r, processingTime));
  
  // 5% failure rate (rate limiting)
  if (Math.random() < 0.05) {
    throw new Error('AI_PROVIDER_TIMEOUT');
  }
  
  // AI scoring
  return Math.round((6 + Math.random() * 4) * 10) / 10;
}

// ─── Get Evaluator by Mode ─────────────────────────────────────────────────────
function getEvaluator(mode: EvaluationMode) {
  switch (mode) {
    case 'local': return localEvaluate;
    case 'hybrid': return hybridEvaluate;
    case 'api': return apiEvaluate;
    default: return localEvaluate;
  }
}

// ─── Run Student Interview ─────────────────────────────────────────────────────
async function runStudentInterview(
  studentId: number,
  mode: EvaluationMode
): Promise<StudentMetrics> {
  const evaluator = getEvaluator(mode);
  const startTime = Date.now();
  
  const metrics: StudentMetrics = {
    id: studentId,
    name: `Student ${studentId}`,
    status: 'running',
    questionsAnswered: 0,
    evaluationTimes: [],
    totalDurationMs: 0,
    errors: [],
    mode
  };

  try {
    // Simulate session creation
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

    // Answer questions
    for (let i = 0; i < QUESTIONS_PER_INTERVIEW; i++) {
      const qa = SAMPLE_QUESTIONS[i % SAMPLE_QUESTIONS.length];

      // Student thinking time
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 5000));

      // Evaluate answer
      try {
        const evalStart = Date.now();
        await evaluator(qa.q, qa.a);
        metrics.evaluationTimes.push(Date.now() - evalStart);
        metrics.questionsAnswered++;
      } catch (error: any) {
        metrics.errors.push(`EVAL_FAILED: ${error.message}`);
      }

      // Delay between questions
      if (i < QUESTIONS_PER_INTERVIEW - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    metrics.status = 'completed';
  } catch (error: any) {
    metrics.status = 'failed';
    metrics.errors.push(`SESSION_FAILED: ${error.message}`);
  }

  metrics.totalDurationMs = Date.now() - startTime;
  return metrics;
}

// ─── Run Load Test ─────────────────────────────────────────────────────────────
async function runLoadTest(mode: EvaluationMode): Promise<ModeResults> {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              INTERVIEW LOAD TEST - MODE COMPARISON           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Testing Mode: ${mode.toUpperCase()}`);
  console.log('─'.repeat(60));
  
  switch (mode) {
    case 'local':
      console.log('Behavior: Zero API calls, instant local heuristics');
      console.log('Use case: High throughput, zero cost');
      break;
    case 'hybrid':
      console.log('Behavior: Instant local + queued AI batch after interview');
      console.log('Use case: Balanced speed and accuracy');
      break;
    case 'api':
      console.log('Behavior: Real-time AI evaluation per question');
      console.log('Use case: Maximum accuracy, higher latency');
      break;
  }
  
  console.log('─'.repeat(60));
  console.log(`Concurrent Students: ${CONCURRENT_STUDENTS}`);
  console.log(`Questions per Interview: ${QUESTIONS_PER_INTERVIEW}`);
  console.log(`Total Evaluations: ${CONCURRENT_STUDENTS * QUESTIONS_PER_INTERVIEW}`);
  console.log('\nStarting test...\n');

  const testStartTime = Date.now();
  const allMetrics: StudentMetrics[] = [];

  // Run all students concurrently
  const promises = [];
  for (let i = 1; i <= CONCURRENT_STUDENTS; i++) {
    promises.push(runStudentInterview(i, mode));
  }

  const completed = 0;
  const progressInterval = setInterval(() => {
    process.stdout.write(`\r  Progress: ${completed}/${CONCURRENT_STUDENTS} students completed`);
  }, 200);

  const results = await Promise.allSettled(promises);
  clearInterval(progressInterval);
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allMetrics.push(result.value);
    } else {
      allMetrics.push({
        id: -1,
        name: 'Failed',
        status: 'failed',
        questionsAnswered: 0,
        evaluationTimes: [],
        totalDurationMs: 0,
        errors: [String(result.reason)],
        mode
      });
    }
  }

  const totalDurationMs = Date.now() - testStartTime;
  const successful = allMetrics.filter(m => m.status === 'completed').length;
  const failed = allMetrics.filter(m => m.status === 'failed').length;
  
  const allEvalTimes = allMetrics
    .flatMap(m => m.evaluationTimes)
    .sort((a, b) => a - b);

  const p95Index = Math.floor(allEvalTimes.length * 0.95);
  const p99Index = Math.floor(allEvalTimes.length * 0.99);

  const errorSummary: Record<string, number> = {};
  allMetrics.forEach(m => {
    m.errors.forEach(err => {
      const type = err.split(':')[0];
      errorSummary[type] = (errorSummary[type] || 0) + 1;
    });
  });

  // Count API calls based on mode
  let apiCalls = 0;
  if (mode === 'api') {
    apiCalls = allEvalTimes.length;
  } else if (mode === 'hybrid') {
    apiCalls = successful; // 1 API call per completed session after interview
  }
  // local = 0 API calls

  return {
    mode,
    totalStudents: CONCURRENT_STUDENTS,
    successful,
    failed,
    totalQuestions: CONCURRENT_STUDENTS * QUESTIONS_PER_INTERVIEW,
    answeredQuestions: allMetrics.reduce((sum, m) => sum + m.questionsAnswered, 0),
    totalEvaluations: allEvalTimes.length,
    failedEvaluations: allMetrics.reduce((sum, m) => sum + m.errors.filter(e => e.includes('EVAL')).length, 0),
    avgEvaluationTimeMs: allEvalTimes.length > 0 
      ? Math.round(allEvalTimes.reduce((a, b) => a + b, 0) / allEvalTimes.length)
      : 0,
    minEvaluationTimeMs: allEvalTimes.length > 0 ? Math.min(...allEvalTimes) : 0,
    maxEvaluationTimeMs: allEvalTimes.length > 0 ? Math.max(...allEvalTimes) : 0,
    p95EvaluationTimeMs: allEvalTimes[p95Index] || 0,
    p99EvaluationTimeMs: allEvalTimes[p99Index] || 0,
    totalDurationMs,
    evaluationsPerSecond: (allEvalTimes.length / (totalDurationMs / 1000)) || 0,
    apiCalls,
    errorSummary
  };
}

// ─── Print Report ──────────────────────────────────────────────────────────────
function printReport(results: ModeResults): void {
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log(`║              LOAD TEST RESULTS - ${results.mode.toUpperCase().padEnd(25)}║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Mode Info
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  MODE CONFIGURATION                                        │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Mode:                 ${results.mode.toUpperCase().padEnd(37)}│`);
  console.log(`│  API Calls per Student: ${results.mode === 'api' ? String(QUESTIONS_PER_INTERVIEW).padEnd(36) : 
                            results.mode === 'hybrid' ? '1 (after interview)'.padEnd(36) : 
                            '0 (local only)'.padEnd(36)}│`);
  console.log(`│  Total API Calls:      ${String(results.apiCalls).padEnd(37)}│`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Session Summary
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  SESSION SUMMARY                                           │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Students:        ${String(results.totalStudents).padStart(6)}                           │`);
  console.log(`│  Successful:            ${String(results.successful).padStart(6)}                           │`);
  console.log(`│  Failed:                ${String(results.failed).padStart(6)}                           │`);
  console.log(`│  Success Rate:          ${String(Math.round((results.successful / results.totalStudents) * 100)).padStart(5)}%                          │`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Evaluation Performance
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  EVALUATION PERFORMANCE                                    │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Evaluations:     ${String(results.totalEvaluations).padStart(6)}                           │`);
  console.log(`│  Failed Evaluations:    ${String(results.failedEvaluations).padStart(6)}                           │`);
  console.log(`│  Avg Time:              ${String(results.avgEvaluationTimeMs).padStart(6)}ms                        │`);
  console.log(`│  Min Time:              ${String(results.minEvaluationTimeMs).padStart(6)}ms                        │`);
  console.log(`│  Max Time:              ${String(results.maxEvaluationTimeMs).padStart(6)}ms                        │`);
  console.log(`│  P95 Time:              ${String(results.p95EvaluationTimeMs).padStart(6)}ms                        │`);
  console.log(`│  P99 Time:              ${String(results.p99EvaluationTimeMs).padStart(6)}ms                        │`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Throughput
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  THROUGHPUT                                               │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Duration:        ${String((results.totalDurationMs / 1000).toFixed(1)).padStart(7)}s                         │`);
  console.log(`│  Evaluations/Second:    ${String(results.evaluationsPerSecond.toFixed(1)).padStart(7)}                           │`);
  console.log(`│  Students/Minute:       ${String(Math.round(results.successful / (results.totalDurationMs / 60000))).padStart(7)}                           │`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Errors
  if (Object.keys(results.errorSummary).length > 0) {
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log('│  ERRORS                                                   │');
    console.log('├─────────────────────────────────────────────────────────────┤');
    Object.entries(results.errorSummary).forEach(([type, count]) => {
      console.log(`│  ${type.padEnd(50)} ${String(count).padStart(4)}x  │`);
    });
    console.log('└─────────────────────────────────────────────────────────────┘\n');
  }

  // Mode Comparison
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  MODE COMPARISON                                           │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  Metric            │ LOCAL    │ HYBRID   │ API      │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  Eval Latency      │ 5-50ms   │ 5-50ms   │ 800-2500ms│');
  console.log('│  API Calls         │ 0        │ 1/session│ 1/question│');
  console.log('│  Accuracy          │ Medium   │ High     │ Highest  │');
  console.log('│  Cost              │ Free     │ Low      │ Variable │');
  console.log('│  Best For          │ High vol │ Balanced │ Accuracy │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!['local', 'hybrid', 'api'].includes(MODE)) {
    console.error('Usage: npx tsx services/interviewLoadTest.ts [local|hybrid|api] [students] [questions]');
    process.exit(1);
  }

  try {
    const results = await runLoadTest(MODE);
    printReport(results);
    
    if (results.failed / results.totalStudents > 0.2) {
      console.log('\n⚠ More than 20% of sessions failed.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Load test failed:', error);
    process.exit(1);
  }
}

main();
