/**
 * Load Test Comparison - Runs all 3 modes and compares results
 * 
 * Usage:
 *   npx tsx services/interviewLoadCompare.ts [students] [questions]
 */

const CONCURRENT_STUDENTS = parseInt(process.argv[2] || '10');
const QUESTIONS_PER_INTERVIEW = parseInt(process.argv[3] || '5');

// ─── Sample Questions ──────────────────────────────────────────────────────────
const SAMPLE_QUESTIONS = [
  { q: "What is the difference between an array and a linked list?", a: "Arrays use contiguous memory with O(1) access; linked lists use nodes with O(1) insertion." },
  { q: "Explain OOP concepts.", a: "Encapsulation, inheritance, polymorphism, and abstraction are the four pillars." },
  { q: "What is a database index?", a: "A data structure that speeds up queries on specific columns." },
  { q: "TCP vs UDP?", a: "TCP is reliable and ordered; UDP is faster but unreliable." },
  { q: "What is deadlock?", a: "Two processes blocked forever waiting for each other's resources." },
];

// ─── Evaluators ────────────────────────────────────────────────────────────────
async function localEval(q: string, a: string): Promise<number> {
  await new Promise(r => setTimeout(r, 5 + Math.random() * 45));
  return Math.round((6 + Math.random() * 4) * 10) / 10;
}

async function hybridEval(q: string, a: string): Promise<number> {
  return localEval(q, a); // During interview, same as local
}

async function apiEval(q: string, a: string): Promise<number> {
  await new Promise(r => setTimeout(r, 800 + Math.random() * 1700));
  if (Math.random() < 0.05) throw new Error('TIMEOUT');
  return Math.round((6 + Math.random() * 4) * 10) / 10;
}

// ─── Run Single Mode Test ──────────────────────────────────────────────────────
async function runModeTest(
  mode: 'local' | 'hybrid' | 'api',
  evaluator: (q: string, a: string) => Promise<number>
): Promise<{
  avgTime: number;
  p95Time: number;
  totalTime: number;
  successRate: number;
  apiCalls: number;
}> {
  const evalTimes: number[] = [];
  let failures = 0;
  const startTime = Date.now();

  const promises = [];
  for (let i = 0; i < CONCURRENT_STUDENTS; i++) {
    promises.push((async () => {
      for (let j = 0; j < QUESTIONS_PER_INTERVIEW; j++) {
        const qa = SAMPLE_QUESTIONS[j % SAMPLE_QUESTIONS.length];
        try {
          const t0 = Date.now();
          await evaluator(qa.q, qa.a);
          evalTimes.push(Date.now() - t0);
        } catch {
          failures++;
        }
      }
    })());
  }

  await Promise.all(promises);
  const totalTime = Date.now() - startTime;
  const sorted = evalTimes.sort((a, b) => a - b);

  return {
    avgTime: evalTimes.length > 0 ? Math.round(evalTimes.reduce((a, b) => a + b, 0) / evalTimes.length) : 0,
    p95Time: sorted[Math.floor(sorted.length * 0.95)] || 0,
    totalTime,
    successRate: Math.round((evalTimes.length / (CONCURRENT_STUDENTS * QUESTIONS_PER_INTERVIEW)) * 100),
    apiCalls: mode === 'api' ? evalTimes.length : mode === 'hybrid' ? CONCURRENT_STUDENTS : 0
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          EVALUATION MODE COMPARISON - LOAD TEST              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log(`Students: ${CONCURRENT_STUDENTS} | Questions: ${QUESTIONS_PER_INTERVIEW}`);
  console.log(`Total evaluations per mode: ${CONCURRENT_STUDENTS * QUESTIONS_PER_INTERVIEW}\n`);

  console.log('Running LOCAL mode...');
  const local = await runModeTest('local', localEval);
  
  console.log('Running HYBRID mode...');
  const hybrid = await runModeTest('hybrid', hybridEval);
  
  console.log('Running API mode...');
  const api = await runModeTest('api', apiEval);

  // Print comparison
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    MODE COMPARISON RESULTS                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('┌──────────────────────┬────────────┬────────────┬────────────┐');
  console.log('│ Metric               │   LOCAL    │   HYBRID   │    API     │');
  console.log('├──────────────────────┼────────────┼────────────┼────────────┤');
  console.log(`│ Avg Eval Time        │ ${String(local.avgTime).padStart(6)}ms  │ ${String(hybrid.avgTime).padStart(6)}ms  │ ${String(api.avgTime).padStart(6)}ms  │`);
  console.log(`│ P95 Eval Time        │ ${String(local.p95Time).padStart(6)}ms  │ ${String(hybrid.p95Time).padStart(6)}ms  │ ${String(api.p95Time).padStart(6)}ms  │`);
  console.log(`│ Total Duration       │ ${(local.totalTime/1000).toFixed(1).padStart(7)}s │ ${(hybrid.totalTime/1000).toFixed(1).padStart(7)}s │ ${(api.totalTime/1000).toFixed(1).padStart(7)}s │`);
  console.log(`│ Success Rate         │ ${String(local.successRate).padStart(6)}%  │ ${String(hybrid.successRate).padStart(6)}%  │ ${String(api.successRate).padStart(6)}%  │`);
  console.log(`│ API Calls            │ ${String(local.apiCalls).padStart(6)}   │ ${String(hybrid.apiCalls).padStart(6)}   │ ${String(api.apiCalls).padStart(6)}   │`);
  console.log('└──────────────────────┴────────────┴────────────┴────────────┘\n');

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  RECOMMENDATIONS                                           │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  LOCAL:  Use for high-volume screening, zero cost          │');
  console.log('│  HYBRID: Use for balanced speed + accuracy (recommended)   │');
  console.log('│  API:    Use when maximum accuracy is critical             │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');
}

main();
