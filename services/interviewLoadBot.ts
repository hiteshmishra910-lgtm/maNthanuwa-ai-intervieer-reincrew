/**
 * Interview Load Testing Bot
 * Simulates multiple concurrent student interviews to test platform capacity
 */

// ─── Configuration ────────────────────────────────────────────────────────────
interface LoadTestConfig {
  baseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  concurrentStudents: number;
  questionsPerInterview: number;
  delayBetweenQuestionsMs: number;
  interviewRole: string;
  jobPostId?: string;
}

interface BotMetrics {
  totalStudents: number;
  successfulSessions: number;
  failedSessions: number;
  totalQuestionsAsked: number;
  totalQuestionsAnswered: number;
  totalAiEvaluations: number;
  failedAiEvaluations: number;
  averageResponseTimeMs: number;
  maxResponseTimeMs: number;
  minResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  totalDurationMs: number;
  sessionsPerSecond: number;
  errors: Array<{ type: string; count: number; lastMessage: string }>;
  timestamps: number[];
}

interface StudentBot {
  id: number;
  name: string;
  email: string;
  sessionId: string | null;
  status: 'idle' | 'connecting' | 'in-interview' | 'completed' | 'failed';
  metrics: {
    questionsAnswered: number;
    aiResponseTimes: number[];
    startTime: number;
    endTime: number | null;
    errors: string[];
  };
}

// ─── Sample Interview Questions & Answers ──────────────────────────────────────
const SAMPLE_QUESTIONS = [
  {
    question: "What is the difference between an array and a linked list?",
    answer: "An array stores elements in contiguous memory locations, allowing O(1) random access. A linked list stores elements in nodes where each node contains data and a pointer to the next node, allowing O(1) insertion/deletion but O(n) access time."
  },
  {
    question: "Explain the concept of object-oriented programming.",
    answer: "Object-oriented programming is a paradigm based on objects that encapsulate data and methods. Key principles include encapsulation (hiding internal state), inheritance (reusing code through class hierarchies), polymorphism (same interface for different types), and abstraction (simplifying complex systems)."
  },
  {
    question: "What is a database index and when should you use one?",
    answer: "A database index is a data structure that improves query speed by creating a lookup structure for specific columns. Use indexes on columns frequently used in WHERE clauses, JOIN conditions, and ORDER BY. However, they add overhead to writes and consume storage space."
  },
  {
    question: "Explain the difference between TCP and UDP.",
    answer: "TCP is connection-oriented, reliable, and ensures ordered delivery through acknowledgments and retransmission. UDP is connectionless, faster, but doesn't guarantee delivery or ordering. TCP is used for HTTP, email; UDP for video streaming, gaming, DNS."
  },
  {
    question: "What is a dead lock in operating systems?",
    answer: "A deadlock occurs when two or more processes are blocked forever, each waiting for resources held by the other. Four conditions must hold: mutual exclusion, hold and wait, no preemption, and circular wait. Prevention involves breaking one of these conditions."
  },
  {
    question: "Explain the REST API design principles.",
    answer: "REST APIs use HTTP methods (GET, POST, PUT, DELETE) for CRUD operations. Key principles include stateless requests, resource-based URLs, proper HTTP status codes, HATEOAS, and uniform interface. Resources are identified by URIs and represented as JSON or XML."
  },
  {
    question: "What is the difference between SQL and NoSQL databases?",
    answer: "SQL databases are relational with structured schemas, ACID compliance, and use SQL for queries. NoSQL databases are non-relational with flexible schemas, horizontal scaling, and various data models (document, key-value, graph). SQL is better for complex queries; NoSQL for scalability."
  },
  {
    question: "Explain the concept of microservices architecture.",
    answer: "Microservices architecture structures an application as a collection of loosely coupled, independently deployable services. Each service runs its own process, communicates via APIs, and can be developed/deployed independently. Benefits include scalability, technology flexibility, and fault isolation."
  },
  {
    question: "What is the time complexity of common sorting algorithms?",
    answer: "Bubble sort, insertion sort, selection sort are O(n²). Merge sort, quicksort (average), heap sort are O(n log n). Quick sort worst case is O(n²) but typically faster in practice. Counting sort, radix sort are O(n+k) for specific cases."
  },
  {
    question: "Explain the concept of virtual memory.",
    answer: "Virtual memory uses disk space to extend physical RAM, allowing programs to use more memory than physically available. It uses paging or segmentation to map virtual addresses to physical addresses. The OS handles page faults when data isn't in RAM."
  },
  {
    question: "What is the difference between process and thread?",
    answer: "A process is an independent program with its own memory space. A thread is a lightweight process within a process, sharing memory with other threads. Processes are isolated; threads can communicate easily but risk race conditions. Context switching threads is faster."
  },
  {
    question: "Explain the CAP theorem.",
    answer: "CAP theorem states a distributed system can only guarantee two of three properties: Consistency (all nodes see same data), Availability (every request gets a response), Partition tolerance (system works despite network failures). In practice, partition tolerance is required, so you choose between CP and AP systems."
  }
];

// ─── Mock Supabase Client ──────────────────────────────────────────────────────
class MockSupabaseClient {
  private sessions: Map<string, any> = new Map();
  
  constructor(private url: string, private anonKey: string) {}

  from(table: string) {
    return {
      insert: (data: any) => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: crypto.randomUUID(), ...data }, error: null })
        })
      }),
      update: (data: any) => ({
        eq: (field: string, value: string) => ({
          eq: (field2: string, value2: string) => Promise.resolve({ data: null, error: null })
        })
      }),
      select: (fields?: string) => ({
        eq: (field: string, value: string) => ({
          order: (field2: string, opts: any) => ({
            limit: (n: number) => ({
              single: () => Promise.resolve({ data: null, error: null })
            })
          })
        })
      })
    };
  }
}

// ─── Simulated AI Evaluation ───────────────────────────────────────────────────
async function simulateAiEvaluation(question: string, answer: string): Promise<{
  score: number;
  responseTimeMs: number;
  evaluation: any;
}> {
  const startTime = Date.now();
  
  // Simulate AI processing time (realistic latency)
  const processingTime = 800 + Math.random() * 1200; // 800-2000ms
  await new Promise(r => setTimeout(r, processingTime));
  
  // Simulate occasional failures (5% failure rate)
  if (Math.random() < 0.05) {
    throw new Error('AI_PROVIDER_TIMEOUT');
  }
  
  // Generate mock evaluation
  const score = 6 + Math.random() * 4; // Score between 6-10
  const responseTimeMs = Date.now() - startTime;
  
  return {
    score: Math.round(score * 10) / 10,
    responseTimeMs,
    evaluation: {
      technicalAccuracy: Math.round((7 + Math.random() * 3) * 10) / 10,
      conceptUnderstanding: Math.round((6 + Math.random() * 4) * 10) / 10,
      reasoning: Math.round((5 + Math.random() * 5) * 10) / 10,
      communication: Math.round((7 + Math.random() * 3) * 10) / 10,
      verdict: score >= 7 ? 'Pass' : score >= 5 ? 'Borderline' : 'Fail'
    }
  };
}

// ─── Simulated WebRTC/Proctoring ───────────────────────────────────────────────
async function simulateProctoring(sessionId: string): Promise<void> {
  // Simulate proctoring initialization
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  
  // Simulate periodic proctoring updates (every 3 seconds)
  const interval = setInterval(() => {
    // Simulate face detection, gaze tracking
  }, 3000);
  
  // Store interval to clear later
  return new Promise(() => {}); // Never resolves until cleared
}

// ─── Student Interview Bot ─────────────────────────────────────────────────────
class InterviewBot {
  private student: StudentBot;
  private config: LoadTestConfig;
  private supabase: MockSupabaseClient;

  constructor(id: number, config: LoadTestConfig) {
    this.config = config;
    this.supabase = new MockSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
    this.student = {
      id,
      name: `Student ${id}`,
      email: `student${id}@loadtest.com`,
      sessionId: null,
      status: 'idle',
      metrics: {
        questionsAnswered: 0,
        aiResponseTimes: [],
        startTime: 0,
        endTime: null,
        errors: []
      }
    };
  }

  async run(): Promise<StudentBot> {
    this.student.metrics.startTime = Date.now();
    this.student.status = 'connecting';

    try {
      // Step 1: Create interview session
      await this.createSession();
      this.student.status = 'in-interview';

      // Step 2: Answer questions
      const questionsToAsk = this.config.questionsPerInterview || SAMPLE_QUESTIONS.length;
      for (let i = 0; i < questionsToAsk; i++) {
        const questionData = SAMPLE_QUESTIONS[i % SAMPLE_QUESTIONS.length];
        
        // Simulate student answering (thinking time)
        const thinkingTime = 3000 + Math.random() * 7000; // 3-10 seconds
        await new Promise(r => setTimeout(r, thinkingTime));

        // Get AI evaluation
        try {
          const evaluation = await simulateAiEvaluation(
            questionData.question,
            questionData.answer
          );
          
          this.student.metrics.aiResponseTimes.push(evaluation.responseTimeMs);
          this.student.metrics.questionsAnswered++;
        } catch (error: any) {
          this.student.metrics.errors.push(`AI evaluation failed: ${error.message}`);
        }

        // Delay between questions
        if (i < questionsToAsk - 1) {
          await new Promise(r => setTimeout(r, this.config.delayBetweenQuestionsMs));
        }
      }

      // Step 3: Complete session
      await this.completeSession();
      this.student.status = 'completed';
    } catch (error: any) {
      this.student.status = 'failed';
      this.student.metrics.errors.push(`Session failed: ${error.message}`);
    }

    this.student.metrics.endTime = Date.now();
    return this.student;
  }

  private async createSession(): Promise<void> {
    // Simulate session creation API call
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
    
    this.student.sessionId = `session-${this.student.id}-${Date.now()}`;
    
    // Simulate occasional connection failures (2% failure rate)
    if (Math.random() < 0.02) {
      throw new Error('CONNECTION_TIMEOUT');
    }
  }

  private async completeSession(): Promise<void> {
    // Simulate session completion
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
  }

  getMetrics(): StudentBot {
    return this.student;
  }
}

// ─── Load Test Runner ──────────────────────────────────────────────────────────
export class InterviewLoadTester {
  private config: LoadTestConfig;
  private bots: InterviewBot[] = [];
  private startTime: number = 0;

  constructor(config: LoadTestConfig) {
    this.config = config;
  }

  async run(): Promise<BotMetrics> {
    this.startTime = Date.now();
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('          INTERVIEW LOAD TEST - SIMULATING STUDENT INTERVIEWS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Concurrent Students: ${this.config.concurrentStudents}`);
    console.log(`Questions per Interview: ${this.config.questionsPerInterview || SAMPLE_QUESTIONS.length}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Create bots
    for (let i = 1; i <= this.config.concurrentStudents; i++) {
      this.bots.push(new InterviewBot(i, this.config));
    }

    // Run all bots concurrently
    console.log(`Starting ${this.bots.length} concurrent interview sessions...\n`);
    
    const botPromises = this.bots.map(bot => bot.run());
    const results = await Promise.allSettled(botPromises);

    // Collect metrics
    const metrics = this.collectMetrics(results);
    
    // Print report
    this.printReport(metrics);

    return metrics;
  }

  private collectMetrics(results: PromiseSettledResult<StudentBot>[]): BotMetrics {
    const successfulBots = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<StudentBot>).value);

    const failedBots = results
      .filter(r => r.status === 'rejected')
      .map(r => r.reason);

    const allResponseTimes = successfulBots
      .flatMap(bot => bot.metrics.aiResponseTimes)
      .sort((a, b) => a - b);

    const totalDurationMs = Date.now() - this.startTime;
    
    // Calculate percentiles
    const p95Index = Math.floor(allResponseTimes.length * 0.95);
    const p99Index = Math.floor(allResponseTimes.length * 0.99);

    // Count errors by type
    const errorCounts: Record<string, { count: number; lastMessage: string }> = {};
    successfulBots.forEach(bot => {
      bot.metrics.errors.forEach(error => {
        const type = error.split(':')[0];
        if (!errorCounts[type]) {
          errorCounts[type] = { count: 0, lastMessage: error };
        }
        errorCounts[type].count++;
        errorCounts[type].lastMessage = error;
      });
    });

    return {
      totalStudents: this.config.concurrentStudents,
      successfulSessions: successfulBots.filter(b => b.status === 'completed').length,
      failedSessions: successfulBots.filter(b => b.status === 'failed').length + failedBots.length,
      totalQuestionsAsked: successfulBots.reduce((sum, b) => sum + (this.config.questionsPerInterview || SAMPLE_QUESTIONS.length), 0),
      totalQuestionsAnswered: successfulBots.reduce((sum, b) => sum + b.metrics.questionsAnswered, 0),
      totalAiEvaluations: allResponseTimes.length,
      failedAiEvaluations: successfulBots.reduce((sum, b) => sum + b.metrics.errors.filter(e => e.includes('AI')).length, 0),
      averageResponseTimeMs: allResponseTimes.length > 0 
        ? Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length)
        : 0,
      maxResponseTimeMs: allResponseTimes.length > 0 ? Math.max(...allResponseTimes) : 0,
      minResponseTimeMs: allResponseTimes.length > 0 ? Math.min(...allResponseTimes) : 0,
      p95ResponseTimeMs: allResponseTimes[p95Index] || 0,
      p99ResponseTimeMs: allResponseTimes[p99Index] || 0,
      totalDurationMs,
      sessionsPerSecond: (this.config.concurrentStudents / (totalDurationMs / 1000)) || 0,
      errors: Object.entries(errorCounts).map(([type, data]) => ({
        type,
        count: data.count,
        lastMessage: data.lastMessage
      })),
      timestamps: successfulBots.map(b => b.metrics.endTime! - b.metrics.startTime)
    };
  }

  private printReport(metrics: BotMetrics): void {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    LOAD TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Session Overview
    console.log('SESSION OVERVIEW');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`Total Students Simulated:     ${metrics.totalStudents}`);
    console.log(`Successful Sessions:          ${metrics.successfulSessions}`);
    console.log(`Failed Sessions:              ${metrics.failedSessions}`);
    console.log(`Success Rate:                 ${Math.round((metrics.successfulSessions / metrics.totalStudents) * 100)}%`);
    console.log('');

    // Question Metrics
    console.log('QUESTION METRICS');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`Total Questions Asked:        ${metrics.totalQuestionsAsked}`);
    console.log(`Total Questions Answered:     ${metrics.totalQuestionsAnswered}`);
    console.log(`Answer Rate:                  ${Math.round((metrics.totalQuestionsAnswered / metrics.totalQuestionsAsked) * 100)}%`);
    console.log('');

    // AI Evaluation Performance
    console.log('AI EVALUATION PERFORMANCE');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`Total AI Evaluations:         ${metrics.totalAiEvaluations}`);
    console.log(`Failed Evaluations:           ${metrics.failedAiEvaluations}`);
    console.log(`Average Response Time:        ${metrics.averageResponseTimeMs}ms`);
    console.log(`Min Response Time:            ${metrics.minResponseTimeMs}ms`);
    console.log(`Max Response Time:            ${metrics.maxResponseTimeMs}ms`);
    console.log(`P95 Response Time:            ${metrics.p95ResponseTimeMs}ms`);
    console.log(`P99 Response Time:            ${metrics.p99ResponseTimeMs}ms`);
    console.log('');

    // Throughput
    console.log('THROUGHPUT');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`Total Test Duration:          ${metrics.totalDurationMs}ms (${(metrics.totalDurationMs / 1000).toFixed(1)}s)`);
    console.log(`Sessions Per Second:          ${metrics.sessionsPerSecond.toFixed(2)}`);
    console.log(`Questions Per Minute:         ${Math.round((metrics.totalQuestionsAnswered / (metrics.totalDurationMs / 60000)))}`);
    console.log('');

    // Errors
    if (metrics.errors.length > 0) {
      console.log('ERRORS');
      console.log('───────────────────────────────────────────────────────────────');
      metrics.errors.forEach(err => {
        console.log(`${err.type}: ${err.count} occurrences`);
      });
      console.log('');
    }

    // Capacity Analysis
    console.log('CAPACITY ANALYSIS');
    console.log('───────────────────────────────────────────────────────────────');
    
    const estimatedConcurrent = Math.floor(60000 / metrics.averageResponseTimeMs);
    console.log(`Estimated Max Concurrent AI Evaluations: ~${estimatedConcurrent}`);
    
    if (metrics.p95ResponseTimeMs < 2000) {
      console.log('✓ P95 response time under 2s - GOOD');
    } else if (metrics.p95ResponseTimeMs < 5000) {
      console.log('⚠ P95 response time between 2-5s - ACCEPTABLE');
    } else {
      console.log('✗ P95 response time over 5s - NEEDS OPTIMIZATION');
    }

    if (metrics.failedSessions === 0) {
      console.log('✓ No session failures - GOOD');
    } else {
      console.log(`⚠ ${metrics.failedSessions} session failures - INVESTIGATE`);
    }
    console.log('');

    // Recommendations
    console.log('RECOMMENDATIONS');
    console.log('───────────────────────────────────────────────────────────────');
    
    if (metrics.averageResponseTimeMs > 3000) {
      console.log('• Consider implementing AI response caching');
      console.log('• Evaluate faster AI models for evaluation');
    }
    
    if (metrics.failedAiEvaluations > metrics.totalAiEvaluations * 0.1) {
      console.log('• AI failure rate > 10% - check rate limiting');
      console.log('• Consider implementing retry with exponential backoff');
    }
    
    if (metrics.sessionsPerSecond < 1) {
      console.log('• Low session throughput - check database connection pooling');
      console.log('• Consider implementing session queuing');
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');
  }
}

// ─── CLI Entry Point ───────────────────────────────────────────────────────────
async function main() {
  const config: LoadTestConfig = {
    baseUrl: process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
    supabaseUrl: process.env.VITE_SUPABASE_URL || 'http://localhost:54321',
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || 'test-key',
    concurrentStudents: parseInt(process.argv[2] || '10'),
    questionsPerInterview: parseInt(process.argv[3] || '5'),
    delayBetweenQuestionsMs: parseInt(process.argv[4] || '1000'),
    interviewRole: 'CSE'
  };

  const tester = new InterviewLoadTester(config);
  await tester.run();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
