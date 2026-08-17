/**
 * REAL Load Test - Uses Actual EvaluationCore Pipeline
 * 
 * This test calls the real NLP pipeline:
 * - Tokenization, Stemming, Normalization
 * - Concept Matching, Misconception Detection
 * - Technical Rules, Contradiction Detection
 * - Score Aggregation, Verdict Generation
 * 
 * Usage:
 *   npx tsx services/interviewLoadTestReal.ts [concurrentStudents] [questionsPerInterview]
 */

import { EvaluationCore } from '../src/Evaluation/dispatch/EvaluationCore';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';
import { Question, EvaluationMode } from '../types';

// ─── Configuration ─────────────────────────────────────────────────────────────
const CONCURRENT_STUDENTS = parseInt(process.argv[2] || '10');
const QUESTIONS_PER_INTERVIEW = parseInt(process.argv[3] || '5');

// ─── Real Interview Questions with Key Concepts ────────────────────────────────
const REAL_QUESTIONS: Question[] = [
  {
    id: 1,
    question: "What is the difference between an array and a linked list?",
    questionType: 'Comparison',
    keyConcepts: [
      { concept: "contiguous memory", importance: 'high', aliases: ["continuous memory", "adjacent memory"] },
      { concept: "random access", importance: 'high', aliases: ["direct access", "index access"] },
      { concept: "linked nodes", importance: 'high', aliases: ["node-based", "pointer-based"] },
      { concept: "insertion deletion", importance: 'medium', aliases: ["add remove", "insert remove"] },
      { concept: "time complexity", importance: 'medium', aliases: ["big o", "complexity"] }
    ],
    evaluationGuide: [
      "Arrays store elements in contiguous memory locations",
      "Linked lists use nodes with pointers to next element",
      "Arrays provide O(1) random access",
      "Linked lists provide O(1) insertion/deletion at known positions",
      "Arrays have cache locality advantage"
    ]
  },
  {
    id: 2,
    question: "Explain the concept of object-oriented programming.",
    questionType: 'Definition',
    keyConcepts: [
      { concept: "encapsulation", importance: 'Critical', aliases: ["data hiding", "abstraction"] },
      { concept: "inheritance", importance: 'Critical', aliases: ["parent class", "child class", "derived class"] },
      { concept: "polymorphism", importance: 'Critical', aliases: ["method overriding", "method overloading"] },
      { concept: "abstraction", importance: 'high', aliases: ["abstract class", "interface"] },
      { concept: "class", importance: 'high', aliases: ["object", "instance"] }
    ],
    evaluationGuide: [
      "OOP is a programming paradigm based on objects",
      "Encapsulation hides internal state and requires methods for access",
      "Inheritance allows creating new classes from existing ones",
      "Polymorphism allows same interface for different implementations",
      "Abstraction simplifies complex systems by modeling classes"
    ]
  },
  {
    id: 3,
    question: "What is a database index and when should you use one?",
    questionType: 'Definition',
    keyConcepts: [
      { concept: "B-tree", importance: 'high', aliases: ["balanced tree", "btree"] },
      { concept: "query performance", importance: 'Critical', aliases: ["fast lookup", "speed up queries"] },
      { concept: "WHERE clause", importance: 'medium', aliases: ["filter condition", "search condition"] },
      { concept: "trade-off", importance: 'medium', aliases: ["tradeoff", "cost benefit"] },
      { concept: "write overhead", importance: 'medium', aliases: ["insertion cost", "update cost"] }
    ],
    evaluationGuide: [
      "Index is a data structure that improves query speed",
      "B-tree is common index implementation",
      "Use indexes on frequently queried columns",
      "Indexes speed up reads but slow down writes",
      "Composite indexes cover multiple columns"
    ]
  },
  {
    id: 4,
    question: "What is deadlock in operating systems?",
    questionType: 'Definition',
    keyConcepts: [
      { concept: "mutual exclusion", importance: 'Critical', aliases: ["exclusive access"] },
      { concept: "hold and wait", importance: 'Critical', aliases: ["holding resource while waiting"] },
      { concept: "circular wait", importance: 'Critical', aliases: ["cycle", "circular dependency"] },
      { concept: "no preemption", importance: 'high', aliases: ["non-preemptive"] },
      { concept: "resource allocation", importance: 'high', aliases: ["resource management"] }
    ],
    evaluationGuide: [
      "Deadlock is when processes block forever waiting for resources",
      "Four necessary conditions: mutual exclusion, hold and wait, no preemption, circular wait",
      "Prevention involves breaking one of the four conditions",
      "Detection uses resource allocation graphs",
      "Recovery can involve terminating processes or resource preemption"
    ]
  },
  {
    id: 5,
    question: "Explain REST API design principles.",
    questionType: 'Definition',
    keyConcepts: [
      { concept: "stateless", importance: 'Critical', aliases: ["no state", "state-free"] },
      { concept: "resource-based", importance: 'Critical', aliases: ["resource oriented", "URL as resource"] },
      { concept: "HTTP methods", importance: 'high', aliases: ["GET POST PUT DELETE", "CRUD operations"] },
      { concept: "status codes", importance: 'medium', aliases: ["response codes", "HTTP status"] },
      { concept: "HATEOAS", importance: 'low', aliases: ["hypermedia", "hypermedia as engine"] }
    ],
    evaluationGuide: [
      "REST is an architectural style for APIs",
      "Stateless - each request contains all needed information",
      "Resources identified by URIs",
      "Use HTTP methods for CRUD: GET, POST, PUT, DELETE",
      "Return appropriate HTTP status codes"
    ]
  }
];

// ─── Sample Student Answers (Varying Quality) ──────────────────────────────────
const SAMPLE_ANSWERS: string[][] = [
  // Question 1: Array vs Linked List
  [
    "Arrays store elements in contiguous memory locations, allowing O(1) random access using index. Linked lists use nodes where each node contains data and a pointer to the next node, providing O(1) insertion and deletion at known positions but O(n) access time.",
    "Arrays are like parking spots in a row - you can go directly to spot 5. Linked lists are like a treasure hunt where each clue leads to the next.",
    "I think arrays are better because they're faster. Linked lists are slower.",
    "Arrays use continuous memory. Linked lists use nodes. Arrays have O(1) access. Lists have O(1) insert.",
    "An array is a collection of elements stored at contiguous memory locations. The elements can be accessed randomly using their index. A linked list is a linear data structure where elements are stored in nodes, each containing data and a reference to the next node."
  ],
  // Question 2: OOP
  [
    "Object-oriented programming has four pillars: encapsulation (hiding internal state), inheritance (creating new classes from existing ones), polymorphism (same interface, different implementations), and abstraction (simplifying complexity).",
    "OOP is about objects and classes. You create classes and make objects from them. It helps organize code.",
    "Encapsulation means hiding data. Inheritance is when a child class gets parent's features. Polymorphism means many forms.",
    "OOP uses objects that combine data and methods. Key principles include encapsulation, inheritance, polymorphism, and abstraction.",
    "Object-oriented programming is a paradigm based on the concept of objects, which can contain data and code. The main principles are encapsulation, inheritance, polymorphism, and abstraction."
  ],
  // Question 3: Database Index
  [
    "A database index is a data structure like a B-tree that speeds up queries by creating a lookup structure. Use indexes on columns in WHERE clauses, JOIN conditions, and ORDER BY. However, indexes add overhead to write operations and consume storage space.",
    "Indexes make queries faster. You should use them on columns you search often. But they slow down inserts and updates.",
    "A database index is like a book's table of contents. It helps find data quickly without scanning the whole table.",
    "Database index improves query performance by creating a separate structure for fast lookup. Use on frequently queried columns.",
    "An index in a database is a data structure that improves the speed of data retrieval operations. It works similarly to an index in a book."
  ],
  // Question 4: Deadlock
  [
    "Deadlock occurs when two or more processes are blocked forever, each waiting for resources held by the other. Four conditions must hold: mutual exclusion, hold and wait, no preemption, and circular wait. Prevention involves breaking one of these conditions.",
    "Deadlock is when processes are stuck waiting for each other. It needs four conditions: mutual exclusion, hold and wait, no preemption, and circular wait.",
    "A deadlock happens when processes can't proceed because they're waiting for resources held by other processes.",
    "Deadlock in OS occurs when processes are in a waiting state indefinitely. Four conditions: mutual exclusion, hold and wait, no preemption, circular wait.",
    "Deadlock is a situation where two or more processes are unable to proceed because each is waiting for a resource held by another."
  ],
  // Question 5: REST API
  [
    "REST APIs follow principles like statelessness (each request is independent), resource-based URLs (identifying resources by URIs), using HTTP methods (GET, POST, PUT, DELETE) for CRUD operations, and returning appropriate HTTP status codes.",
    "REST is about using HTTP methods to do CRUD operations on resources. Resources are identified by URLs. It should be stateless.",
    "REST APIs use URLs to identify resources and HTTP methods to perform actions. They should be stateless.",
    "REST stands for Representational State Transfer. It uses HTTP methods for CRUD, is stateless, and uses resource-based URLs.",
    "REST API design principles include statelessness, uniform interface, resource-based URLs, proper HTTP methods, and status codes."
  ]
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
  scores: number[];
}

interface TestResults {
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
  avgScore: number;
  minScore: number;
  maxScore: number;
  scoreDistribution: Record<string, number>;
  errorSummary: Record<string, number>;
}

// ─── Create Evaluation Context ─────────────────────────────────────────────────
function createEvaluationContext(
  question: Question,
  answer: string,
  studentId: number
): EvaluationContext {
  return {
    session: {
      id: `load-test-session-${studentId}-${Date.now()}`,
      mode: 'LOCAL'
    },
    candidate: {
      name: `Student ${studentId}`,
      role: 'CSE'
    },
    question,
    response: answer,
    evaluationProfile: {
      id: 'default',
      version_number: 1,
      accuracyWeight: 30,
      understandingWeight: 25,
      reasoningWeight: 20,
      communicationWeight: 15,
      confidenceWeight: 10,
      requiredDimensions: ['definition', 'mechanism', 'purpose', 'useCase']
    }
  };
}

// ─── Run Real Evaluation ───────────────────────────────────────────────────────
function runRealEvaluation(
  question: Question,
  answer: string,
  studentId: number
): { score: number; latencyMs: number; result: any } {
  const start = performance.now();
  
  const context = createEvaluationContext(question, answer, studentId);
  const result = EvaluationCore.evaluateAnswer(context);
  
  const latencyMs = Math.round(performance.now() - start);
  
  return {
    score: result.technicalAccuracyScore || 0,
    latencyMs,
    result
  };
}

// ─── Run Student Interview ─────────────────────────────────────────────────────
async function runStudentInterview(studentId: number): Promise<StudentMetrics> {
  const startTime = Date.now();
  
  const metrics: StudentMetrics = {
    id: studentId,
    name: `Student ${studentId}`,
    status: 'running',
    questionsAnswered: 0,
    evaluationTimes: [],
    totalDurationMs: 0,
    errors: [],
    scores: []
  };

  try {
    // Simulate session creation
    await new Promise(r => setTimeout(r, 10 + Math.random() * 20));

    // Answer questions
    for (let i = 0; i < QUESTIONS_PER_INTERVIEW; i++) {
      const question = REAL_QUESTIONS[i % REAL_QUESTIONS.length];
      const answers = SAMPLE_ANSWERS[i % SAMPLE_ANSWERS.length];
      const answer = answers[studentId % answers.length];

      try {
        // Run REAL evaluation
        const evalResult = runRealEvaluation(question, answer, studentId);
        
        metrics.evaluationTimes.push(evalResult.latencyMs);
        metrics.scores.push(evalResult.score);
        metrics.questionsAnswered++;
      } catch (error: any) {
        metrics.errors.push(`EVAL_FAILED: ${error.message}`);
      }

      // Small delay between questions
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
  console.log('║        REAL LOAD TEST - ACTUAL EVALUATIONCORE PIPELINE      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log('Testing REAL NLP Pipeline:');
  console.log('  • Tokenization & Stemming');
  console.log('  • Concept Matching');
  console.log('  • Misconception Detection');
  console.log('  • Technical Rules');
  console.log('  • Score Aggregation');
  console.log('─'.repeat(60));
  console.log(`Concurrent Students: ${CONCURRENT_STUDENTS}`);
  console.log(`Questions per Interview: ${QUESTIONS_PER_INTERVIEW}`);
  console.log(`Total Real Evaluations: ${CONCURRENT_STUDENTS * QUESTIONS_PER_INTERVIEW}`);
  console.log('\nStarting test...\n');

  const testStartTime = Date.now();
  const allMetrics: StudentMetrics[] = [];

  // Run all students concurrently
  const promises = [];
  for (let i = 1; i <= CONCURRENT_STUDENTS; i++) {
    promises.push(runStudentInterview(i));
  }

  const completed = 0;
  const progressInterval = setInterval(() => {
    process.stdout.write(`\r  Progress: ${completed}/${CONCURRENT_STUDENTS} students completed`);
  }, 100);

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
        scores: []
      });
    }
  }

  const totalDurationMs = Date.now() - testStartTime;
  const successful = allMetrics.filter(m => m.status === 'completed').length;
  const failed = allMetrics.filter(m => m.status === 'failed').length;
  
  const allEvalTimes = allMetrics
    .flatMap(m => m.evaluationTimes)
    .sort((a, b) => a - b);

  const allScores = allMetrics.flatMap(m => m.scores);
  
  const p95Index = Math.floor(allEvalTimes.length * 0.95);
  const p99Index = Math.floor(allEvalTimes.length * 0.99);

  const errorSummary: Record<string, number> = {};
  allMetrics.forEach(m => {
    m.errors.forEach(err => {
      const type = err.split(':')[0];
      errorSummary[type] = (errorSummary[type] || 0) + 1;
    });
  });

  // Score distribution
  const scoreDistribution: Record<string, number> = {
    '0-2': 0,
    '2-4': 0,
    '4-6': 0,
    '6-8': 0,
    '8-10': 0
  };
  allScores.forEach(score => {
    if (score < 2) scoreDistribution['0-2']++;
    else if (score < 4) scoreDistribution['2-4']++;
    else if (score < 6) scoreDistribution['4-6']++;
    else if (score < 8) scoreDistribution['6-8']++;
    else scoreDistribution['8-10']++;
  });

  return {
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
    avgScore: allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 10) / 10 : 0,
    minScore: allScores.length > 0 ? Math.min(...allScores) : 0,
    maxScore: allScores.length > 0 ? Math.max(...allScores) : 0,
    scoreDistribution,
    errorSummary
  };
}

// ─── Print Report ──────────────────────────────────────────────────────────────
function printReport(results: TestResults): void {
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              REAL LOAD TEST RESULTS                         ║');
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

  // Real Pipeline Performance
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  REAL NLP PIPELINE PERFORMANCE                             │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Evaluations:     ${String(results.totalEvaluations).padStart(6)}                           │`);
  console.log(`│  Failed Evaluations:    ${String(results.failedEvaluations).padStart(6)}                           │`);
  console.log(`│  Avg Eval Time:         ${String(results.avgEvaluationTimeMs).padStart(6)}ms  (REAL pipeline)      │`);
  console.log(`│  Min Eval Time:         ${String(results.minEvaluationTimeMs).padStart(6)}ms                        │`);
  console.log(`│  Max Eval Time:         ${String(results.maxEvaluationTimeMs).padStart(6)}ms                        │`);
  console.log(`│  P95 Eval Time:         ${String(results.p95EvaluationTimeMs).padStart(6)}ms                        │`);
  console.log(`│  P99 Eval Time:         ${String(results.p99EvaluationTimeMs).padStart(6)}ms                        │`);
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Score Analysis
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  REAL EVALUATION SCORES                                    │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Average Score:         ${String(results.avgScore).padStart(5)}  (0-10 scale)                │`);
  console.log(`│  Min Score:             ${String(results.minScore).padStart(5)}                              │`);
  console.log(`│  Max Score:             ${String(results.maxScore).padStart(5)}                              │`);
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  Score Distribution:                                        │');
  Object.entries(results.scoreDistribution).forEach(([range, count]) => {
    const bar = '█'.repeat(Math.min(20, Math.round(count / results.totalEvaluations * 20)));
    console.log(`│    ${range.padEnd(5)}: ${String(count).padStart(4)} ${bar.padEnd(20)} │`);
  });
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Throughput
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  THROUGHPUT                                               │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Total Duration:        ${String((results.totalDurationMs / 1000).toFixed(1)).padStart(7)}s                         │`);
  console.log(`│  Evaluations/Second:    ${String(results.evaluationsPerSecond.toFixed(1)).padStart(7)}  (REAL evaluations)    │`);
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

  // Pipeline Comparison
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  SIMULATED vs REAL PIPELINE COMPARISON                     │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  Metric              │ Simulated    │ REAL Pipeline     │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│  Avg Eval Time       │ ~34ms        │ ${String(results.avgEvaluationTimeMs).padStart(4)}ms           │`);
  console.log('│  Tokenization        │ None         │ Yes (real)        │');
  console.log('│  Concept Matching    │ None         │ Yes (real)        │');
  console.log('│  Misconception Det.  │ None         │ Yes (real)        │');
  console.log('│  Score Aggregation   │ Random       │ Real rules        │');
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
