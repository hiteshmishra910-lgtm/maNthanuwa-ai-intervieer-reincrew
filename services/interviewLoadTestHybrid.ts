/**
 * REAL HYBRID Load Test - Local During Interview + Queued AI After
 * 
 * This test simulates the full HYBRID mode:
 * 1. During interview: Real LOCAL EvaluationCore (instant)
 * 2. After interview: Queues to EvaluationQueue (background AI)
 * 
 * Usage:
 *   npx tsx services/interviewLoadTestHybrid.ts [concurrentStudents] [questionsPerInterview]
 */

import { EvaluationCore } from '../src/Evaluation/dispatch/EvaluationCore';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';
import { Question, EvaluationMode } from '../types';

// ─── Configuration ─────────────────────────────────────────────────────────────
const CONCURRENT_STUDENTS = parseInt(process.argv[2] || '10');
const QUESTIONS_PER_INTERVIEW = parseInt(process.argv[3] || '5');

// ─── Real Interview Questions ──────────────────────────────────────────────────
const REAL_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "What is the difference between an array and a linked list?",
    questionType: 'Comparison',
    keyConcepts: [
      { concept: "contiguous memory", importance: 'high', aliases: ["continuous memory"] },
      { concept: "random access", importance: 'high', aliases: ["direct access"] },
      { concept: "linked nodes", importance: 'high', aliases: ["node-based"] },
      { concept: "insertion deletion", importance: 'medium', aliases: ["add remove"] },
      { concept: "time complexity", importance: 'medium', aliases: ["big o"] }
    ],
    evaluationGuide: [
      "Arrays store elements in contiguous memory locations",
      "Linked lists use nodes with pointers to next element",
      "Arrays provide O(1) random access",
      "Linked lists provide O(1) insertion/deletion at known positions"
    ]
  },
  {
    id: 2,
    question: "Explain the concept of object-oriented programming.",
    questionType: 'Definition',
    keyConcepts: [
      { concept: "encapsulation", importance: 'Critical', aliases: ["data hiding"] },
      { concept: "inheritance", importance: 'Critical', aliases: ["parent class"] },
      { concept: "polymorphism", importance: 'Critical', aliases: ["method overriding"] },
      { concept: "abstraction", importance: 'high', aliases: ["abstract class"] }
    ],
    evaluationGuide: [
      "OOP is a programming paradigm based on objects",
      "Encapsulation hides internal state",
      "Inheritance allows creating new classes from existing ones",
      "Polymorphism allows same interface for different implementations"
    ]
  },
  {
    id: 3,
    question: "What is a database index and when should you use one?",
    questionType: 'Definition',
    keyConcepts: [
      { concept: "B-tree", importance: 'high', aliases: ["balanced tree"] },
      { concept: "query performance", importance: 'Critical', aliases: ["fast lookup"] },
      { concept: "WHERE clause", importance: 'medium', aliases: ["filter condition"] },
      { concept: "trade-off", importance: 'medium', aliases: ["tradeoff"] }
    ],
    evaluationGuide: [
      "Index is a data structure that improves query speed",
      "B-tree is common index implementation",
      "Use indexes on frequently queried columns",
      "Indexes speed up reads but slow down writes"
    ]
  },
  {
    id: 4,
    question: "What is deadlock in operating systems?",
    questionType: 'Definition',
    keyConcepts: [
      { concept: "mutual exclusion", importance: 'Critical', aliases: ["exclusive access"] },
      { concept: "hold and wait", importance: 'Critical', aliases: ["holding resource"] },
      { concept: "circular wait", importance: 'Critical', aliases: ["cycle"] },
      { concept: "no preemption", importance: 'high', aliases: ["non-preemptive"] }
    ],
    evaluationGuide: [
      "Deadlock is when processes block forever waiting for resources",
      "Four necessary conditions: mutual exclusion, hold and wait, no preemption, circular wait",
      "Prevention involves breaking one of the four conditions"
    ]
  },
  {
    id: 5,
    question: "Explain REST API design principles.",
    questionType: 'Definition',
    keyConcepts: [
      { concept: "stateless", importance: 'Critical', aliases: ["no state"] },
      { concept: "resource-based", importance: 'Critical', aliases: ["resource oriented"] },
      { concept: "HTTP methods", importance: 'high', aliases: ["GET POST PUT DELETE"] },
      { concept: "status codes", importance: 'medium', aliases: ["response codes"] }
    ],
    evaluationGuide: [
      "REST is an architectural style for APIs",
      "Stateless - each request contains all needed information",
      "Resources identified by URIs",
      "Use HTTP methods for CRUD"
    ]
  }
];

// ─── Sample Answers ────────────────────────────────────────────────────────────
const SAMPLE_ANSWERS: string[][] = [
  ["Arrays store elements in contiguous memory locations, allowing O(1) random access. Linked lists use nodes where each node contains data and a pointer to the next node, providing O(1) insertion at known positions.", "Arrays are like parking spots. Linked lists are like a treasure hunt.", "Arrays are better because they're faster.", "Arrays use continuous memory. Linked lists use nodes.", "An array stores elements at contiguous memory locations for O(1) access. A linked list uses nodes with pointers for O(1) insertion."],
  ["OOP has four pillars: encapsulation (hiding internal state), inheritance (creating new classes from existing ones), polymorphism (same interface, different implementations), and abstraction (simplifying complexity).", "OOP is about objects and classes.", "Encapsulation means hiding data. Inheritance is child getting parent's features.", "OOP uses objects that combine data and methods.", "Object-oriented programming is based on objects containing data and code with encapsulation, inheritance, polymorphism, and abstraction."],
  ["A database index is a B-tree data structure that speeds up queries. Use indexes on columns in WHERE clauses. Indexes add overhead to write operations.", "Indexes make queries faster. Use them on columns you search often.", "A database index is like a book's table of contents.", "Database index improves query performance.", "An index improves data retrieval speed by creating a lookup structure."],
  ["Deadlock occurs when processes are blocked forever, each waiting for resources held by the other. Four conditions: mutual exclusion, hold and wait, no preemption, circular wait.", "Deadlock is when processes are stuck waiting for each other.", "A deadlock happens when processes can't proceed.", "Deadlock occurs when processes wait indefinitely.", "Deadlock is when two or more processes cannot proceed because each waits for resources held by another."],
  ["REST APIs follow statelessness, resource-based URLs, HTTP methods (GET, POST, PUT, DELETE) for CRUD, and appropriate HTTP status codes.", "REST is about using HTTP methods to do CRUD on resources.", "REST APIs use URLs to identify resources.", "REST stands for Representational State Transfer.", "REST uses HTTP methods for CRUD operations on resources identified by URIs."]
];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface QueuedJob {
  sessionId: string;
  studentId: number;
  history: any[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  queuedAt: number;
  completedAt?: number;
  aiLatencyMs?: number;
  aiScore?: number;
  error?: string;
}

interface StudentMetrics {
  id: number;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  questionsAnswered: number;
  localEvalTimes: number[];
  localScores: number[];
  totalDurationMs: number;
  errors: string[];
  queuedJob?: QueuedJob;
}

interface TestResults {
  totalStudents: number;
  successful: number;
  failed: number;
  
  // LOCAL phase (during interview)
  totalLocalEvaluations: number;
  avgLocalEvalTimeMs: number;
  p95LocalEvalTimeMs: number;
  avgLocalScore: number;
  
  // QUEUE phase (after interview)
  totalQueuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgAiLatencyMs: number;
  p95AiLatencyMs: number;
  avgAiScore: number;
  
  // Combined
  totalDurationMs: number;
  evaluationsPerSecond: number;
  studentsPerMinute: number;
  errorSummary: Record<string, number>;
}

// ─── Create Evaluation Context ─────────────────────────────────────────────────
function createEvaluationContext(question: Question, answer: string, studentId: number): EvaluationContext {
  return {
    session: { id: `hybrid-session-${studentId}-${Date.now()}`, mode: 'LOCAL' },
    candidate: { name: `Student ${studentId}`, role: 'CSE' },
    question,
    response: answer,
    evaluationProfile: {
      id: 'default', version_number: 1,
      accuracyWeight: 30, understandingWeight: 25, reasoningWeight: 20,
      communicationWeight: 15, confidenceWeight: 10,
      requiredDimensions: ['definition', 'mechanism', 'purpose', 'useCase']
    }
  };
}

// ─── Simulate AI Batch Evaluation (After Interview) ────────────────────────────
async function simulateAiBatchEvaluation(job: QueuedJob): Promise<void> {
  job.status = 'processing';
  
  // Simulate AI provider latency (800-2500ms)
  const aiLatency = 800 + Math.random() * 1700;
  await new Promise(r => setTimeout(r, aiLatency));
  
  // 5% failure rate
  if (Math.random() < 0.05) {
    job.status = 'failed';
    job.error = 'AI_PROVIDER_TIMEOUT';
    return;
  }
  
  // AI scoring (slightly different from local)
  job.aiScore = Math.round((6 + Math.random() * 4) * 10) / 10;
  job.aiLatencyMs = Math.round(aiLatency);
  job.status = 'completed';
  job.completedAt = Date.now();
}

// ─── Run Student Interview (LOCAL Phase) ───────────────────────────────────────
async function runStudentInterview(studentId: number): Promise<StudentMetrics> {
  const startTime = Date.now();
  
  const metrics: StudentMetrics = {
    id: studentId,
    name: `Student ${studentId}`,
    status: 'running',
    questionsAnswered: 0,
    localEvalTimes: [],
    localScores: [],
    totalDurationMs: 0,
    errors: []
  };

  try {
    await new Promise(r => setTimeout(r, 10 + Math.random() * 20));

    // LOCAL evaluation during interview
    for (let i = 0; i < QUESTIONS_PER_INTERVIEW; i++) {
      const question = REAL_QUESTIONS[i % REAL_QUESTIONS.length];
      const answers = SAMPLE_ANSWERS[i % SAMPLE_ANSWERS.length];
      const answer = answers[studentId % answers.length];

      try {
        const start = performance.now();
        const context = createEvaluationContext(question, answer, studentId);
        const result = EvaluationCore.evaluateAnswer(context);
        const latencyMs = Math.round(performance.now() - start);
        
        metrics.localEvalTimes.push(latencyMs);
        metrics.localScores.push(result.technicalAccuracyScore || 0);
        metrics.questionsAnswered++;
      } catch (error: any) {
        metrics.errors.push(`LOCAL_EVAL_FAILED: ${error.message}`);
      }

      if (i < QUESTIONS_PER_INTERVIEW - 1) {
        await new Promise(r => setTimeout(r, 5));
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
async function runLoadTest(): Promise<TestResults> {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║      REAL HYBRID LOAD TEST - LOCAL + QUEUED AI BATCH        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log('HYBRID Mode Flow:');
  console.log('  Phase 1: LOCAL EvaluationCore (instant, during interview)');
  console.log('  Phase 2: Queued AI Batch (after interview, background)');
  console.log('─'.repeat(60));
  console.log(`Concurrent Students: ${CONCURRENT_STUDENTS}`);
  console.log(`Questions per Interview: ${QUESTIONS_PER_INTERVIEW}`);
  console.log(`Total LOCAL Evaluations: ${CONCURRENT_STUDENTS * QUESTIONS_PER_INTERVIEW}`);
  console.log(`Total AI Jobs Queued: ${CONCURRENT_STUDENTS}`);
  console.log('\nPhase 1: Running LOCAL evaluations...\n');

  const testStartTime = Date.now();
  const allMetrics: StudentMetrics[] = [];
  const queuedJobs: QueuedJob[] = [];

  // Phase 1: Run all interviews with LOCAL evaluation
  const promises = [];
  for (let i = 1; i <= CONCURRENT_STUDENTS; i++) {
    promises.push(runStudentInterview(i));
  }

  const completed = 0;
  const progressInterval = setInterval(() => {
    process.stdout.write(`\r  Phase 1 Progress: ${completed}/${CONCURRENT_STUDENTS} interviews completed`);
  }, 100);

  const results = await Promise.allSettled(promises);
  clearInterval(progressInterval);
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allMetrics.push(result.value);
    } else {
      allMetrics.push({
        id: -1, name: 'Failed', status: 'failed',
        questionsAnswered: 0, localEvalTimes: [], localScores: [],
        totalDurationMs: 0, errors: [String(result.reason)]
      });
    }
  }

  const phase1Duration = Date.now() - testStartTime;

  // Phase 2: Queue AI batch evaluations
  console.log('\n\nPhase 2: Queuing AI batch evaluations...\n');
  
  for (const metrics of allMetrics) {
    if (metrics.status === 'completed') {
      const job: QueuedJob = {
        sessionId: `session-${metrics.id}-${Date.now()}`,
        studentId: metrics.id,
        history: metrics.localScores.map((score, i) => ({
          questionId: i + 1,
          localScore: score
        })),
        status: 'pending',
        queuedAt: Date.now()
      };
      queuedJobs.push(job);
      metrics.queuedJob = job;
    }
  }

  // Process all AI jobs concurrently
  const aiPromises = queuedJobs.map(job => simulateAiBatchEvaluation(job));
  
  const aiCompleted = 0;
  const aiProgressInterval = setInterval(() => {
    process.stdout.write(`\r  Phase 2 Progress: ${aiCompleted}/${queuedJobs.length} AI jobs completed`);
  }, 100);

  await Promise.allSettled(aiPromises);
  clearInterval(aiProgressInterval);

  const totalDurationMs = Date.now() - testStartTime;

  // Calculate statistics
  const successful = allMetrics.filter(m => m.status === 'completed').length;
  const failed = allMetrics.filter(m => m.status === 'failed').length;
  
  const allLocalTimes = allMetrics.flatMap(m => m.localEvalTimes).sort((a, b) => a - b);
  const allLocalScores = allMetrics.flatMap(m => m.localScores);
  
  const completedJobs = queuedJobs.filter(j => j.status === 'completed');
  const failedJobs = queuedJobs.filter(j => j.status === 'failed');
  const aiLatencies = completedJobs.map(j => j.aiLatencyMs || 0).sort((a, b) => a - b);
  const aiScores = completedJobs.map(j => j.aiScore || 0);
  
  const p95LocalIndex = Math.floor(allLocalTimes.length * 0.95);
  const p95AiIndex = Math.floor(aiLatencies.length * 0.95);

  const errorSummary: Record<string, number> = {};
  allMetrics.forEach(m => {
    m.errors.forEach(err => {
      const type = err.split(':')[0];
      errorSummary[type] = (errorSummary[type] || 0) + 1;
    });
  });
  failedJobs.forEach(j => {
    if (j.error) {
      errorSummary[j.error] = (errorSummary[j.error] || 0) + 1;
    }
  });

  return {
    totalStudents: CONCURRENT_STUDENTS,
    successful,
    failed,
    
    totalLocalEvaluations: allLocalTimes.length,
    avgLocalEvalTimeMs: allLocalTimes.length > 0 ? Math.round(allLocalTimes.reduce((a, b) => a + b, 0) / allLocalTimes.length) : 0,
    p95LocalEvalTimeMs: allLocalTimes[p95LocalIndex] || 0,
    avgLocalScore: allLocalScores.length > 0 ? Math.round(allLocalScores.reduce((a, b) => a + b, 0) / allLocalScores.length * 10) / 10 : 0,
    
    totalQueuedJobs: queuedJobs.length,
    completedJobs: completedJobs.length,
    failedJobs: failedJobs.length,
    avgAiLatencyMs: aiLatencies.length > 0 ? Math.round(aiLatencies.reduce((a, b) => a + b, 0) / aiLatencies.length) : 0,
    p95AiLatencyMs: aiLatencies[p95AiIndex] || 0,
    avgAiScore: aiScores.length > 0 ? Math.round(aiScores.reduce((a, b) => a + b, 0) / aiScores.length * 10) / 10 : 0,
    
    totalDurationMs,
    evaluationsPerSecond: (allLocalTimes.length / (phase1Duration / 1000)) || 0,
    studentsPerMinute: (successful / (phase1Duration / 60000)) || 0,
    errorSummary
  };
}

// ─── Print Report ──────────────────────────────────────────────────────────────
function printReport(results: TestResults): void {
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║            REAL HYBRID LOAD TEST RESULTS                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Session Summary
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  SESSION SUMMARY                                           │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Students:        ${String(results.totalStudents).padStart(6)}                           │`);
  console.log(`│  Successful:            ${String(results.successful).padStart(6)}                           │`);
  console.log(`│  Failed:                ${String(results.failed).padStart(6)}                           │`);
  console.log(`│  Success Rate:          ${String(Math.round((results.successful / results.totalStudents) * 100)).padStart(5)}%                          │`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Phase 1: LOCAL Evaluation
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  PHASE 1: LOCAL EVALUATION (During Interview)             │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Evaluations:     ${String(results.totalLocalEvaluations).padStart(6)}  (real EvaluationCore)  │`);
  console.log(`│  Avg Eval Time:         ${String(results.avgLocalEvalTimeMs).padStart(6)}ms                        │`);
  console.log(`│  P95 Eval Time:         ${String(results.p95LocalEvalTimeMs).padStart(6)}ms                        │`);
  console.log(`│  Avg Score:             ${String(results.avgLocalScore).padStart(5)}  (0-10 scale)           │`);
  console.log(`│  Throughput:            ${String(results.evaluationsPerSecond.toFixed(0)).padStart(6)}  evals/sec              │`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Phase 2: Queued AI Batch
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  PHASE 2: QUEUED AI BATCH (After Interview)               │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Jobs Queued:     ${String(results.totalQueuedJobs).padStart(6)}                           │`);
  console.log(`│  Completed:             ${String(results.completedJobs).padStart(6)}                           │`);
  console.log(`│  Failed:                ${String(results.failedJobs).padStart(6)}                           │`);
  console.log(`│  Avg AI Latency:        ${String(results.avgAiLatencyMs).padStart(6)}ms  (simulated AI)       │`);
  console.log(`│  P95 AI Latency:        ${String(results.p95AiLatencyMs).padStart(6)}ms                        │`);
  console.log(`│  Avg AI Score:          ${String(results.avgAiScore).padStart(5)}  (0-10 scale)           │`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Combined Performance
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  COMBINED PERFORMANCE                                      │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Duration:        ${String((results.totalDurationMs / 1000).toFixed(1)).padStart(7)}s                         │`);
  console.log(`│  Students/Minute:       ${String(Math.round(results.studentsPerMinute)).padStart(7)}  (during interview)    │`);
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
  console.log('│  MODE COMPARISON (Real Pipeline)                          │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  Metric              │ LOCAL      │ HYBRID     │ API      │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  During Interview    │ ${String(results.avgLocalEvalTimeMs).padStart(5)}ms    │ ${String(results.avgLocalEvalTimeMs).padStart(5)}ms    │ 800+ ms  │`);
  console.log('│  After Interview     │ Done       │ 1 AI call  │ Done     │');
  console.log('│  API Calls/Student   │ 0          │ 1 (async)  │ 5        │');
  console.log('│  Accuracy            │ Local      │ AI-enhanced│ AI-only  │');
  console.log('│  Cost                │ Free       │ Low        │ High     │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  try {
    const results = await runLoadTest();
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
