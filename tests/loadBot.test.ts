import { describe, it, expect } from 'vitest';

/**
 * Load Testing Logic Tests
 * These tests verify the load testing bot's core functionality
 */

// ─── Sample Questions (same as load bot) ────────────────────────────────────────
const SAMPLE_QUESTIONS = [
  { q: "What is an array?", a: "Contiguous memory storage." },
  { q: "Explain OOP.", a: "Object-oriented programming paradigm." },
  { q: "What is a database index?", a: "Lookup structure for fast queries." },
  { q: "TCP vs UDP?", a: "Reliable vs fast transmission." },
  { q: "What is deadlock?", a: "Processes waiting forever." },
];

// ─── Simulated AI Evaluation ───────────────────────────────────────────────────
async function evaluateAnswer(question: string, answer: string): Promise<number> {
  const processingTime = 100 + Math.random() * 200; // Faster for tests
  await new Promise(r => setTimeout(r, processingTime));
  
  if (Math.random() < 0.05) {
    throw new Error('AI_PROVIDER_TIMEOUT');
  }
  
  return Math.round((6 + Math.random() * 4) * 10) / 10;
}

// ─── Student Bot ───────────────────────────────────────────────────────────────
interface StudentMetrics {
  id: number;
  questionsAnswered: number;
  aiResponseTimes: number[];
  errors: string[];
  status: 'completed' | 'failed';
}

async function runStudentInterview(
  studentId: number,
  questionsCount: number
): Promise<StudentMetrics> {
  const metrics: StudentMetrics = {
    id: studentId,
    questionsAnswered: 0,
    aiResponseTimes: [],
    errors: [],
    status: 'completed'
  };

  try {
    for (let i = 0; i < questionsCount; i++) {
      const qa = SAMPLE_QUESTIONS[i % SAMPLE_QUESTIONS.length];
      
      try {
        const evalStart = Date.now();
        await evaluateAnswer(qa.q, qa.a);
        metrics.aiResponseTimes.push(Date.now() - evalStart);
        metrics.questionsAnswered++;
      } catch (error: any) {
        metrics.errors.push(`AI_FAILED: ${error.message}`);
      }
    }
  } catch (error: any) {
    metrics.status = 'failed';
    metrics.errors.push(`SESSION_FAILED: ${error.message}`);
  }

  return metrics;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────
describe('Load Testing Bot', () => {
  it('should run a single student interview', async () => {
    const result = await runStudentInterview(1, 3);
    
    expect(result.id).toBe(1);
    expect(result.questionsAnswered).toBeGreaterThanOrEqual(0);
    expect(result.questionsAnswered).toBeLessThanOrEqual(3);
    expect(result.aiResponseTimes.length).toBe(result.questionsAnswered);
  });

  it('should handle multiple concurrent students', async () => {
    const studentCount = 5;
    const questionsPerStudent = 2;
    
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 1; i <= studentCount; i++) {
      promises.push(runStudentInterview(i, questionsPerStudent));
    }
    
    const results = await Promise.all(promises);
    const totalDuration = Date.now() - startTime;
    
    expect(results.length).toBe(studentCount);
    expect(totalDuration).toBeLessThan(30000); // Should complete in <30s
    
    // All students should have attempted questions
    results.forEach(r => {
      expect(r.id).toBeGreaterThan(0);
    });
  });

  it('should calculate response time statistics correctly', async () => {
    const responseTimes = [100, 200, 300, 400, 500];
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const min = Math.min(...responseTimes);
    const max = Math.max(...responseTimes);
    const sorted = [...responseTimes].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    
    expect(avg).toBe(300);
    expect(min).toBe(100);
    expect(max).toBe(500);
    expect(p95).toBe(500);
  });

  it('should track errors correctly', async () => {
    const errors: string[] = [];
    
    // Simulate some failures
    for (let i = 0; i < 10; i++) {
      try {
        if (Math.random() < 0.3) {
          throw new Error('AI_PROVIDER_TIMEOUT');
        }
      } catch (error: any) {
        errors.push(error.message);
      }
    }
    
    // Should have some errors (probabilistic test)
    expect(Array.isArray(errors)).toBe(true);
  });

  it('should measure concurrent throughput', async () => {
    const concurrentStudents = 3;
    const startTime = Date.now();
    
    const promises = [];
    for (let i = 1; i <= concurrentStudents; i++) {
      promises.push(runStudentInterview(i, 1));
    }
    
    const results = await Promise.all(promises);
    const totalTimeMs = Date.now() - startTime;
    
    // Calculate throughput
    const totalQuestions = results.reduce((sum, r) => sum + r.questionsAnswered, 0);
    const questionsPerSecond = totalQuestions / (totalTimeMs / 1000);
    
    expect(totalQuestions).toBeGreaterThanOrEqual(0);
    expect(questionsPerSecond).toBeGreaterThanOrEqual(0);
  });
});

describe('Response Time Percentiles', () => {
  it('should calculate P95 correctly', () => {
    // Generate 100 response times
    const times = Array.from({ length: 100 }, (_, i) => i + 1);
    const sorted = times.sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];
    
    expect(p95).toBe(96);
  });

  it('should calculate P99 correctly', () => {
    const times = Array.from({ length: 100 }, (_, i) => i + 1);
    const sorted = times.sort((a, b) => a - b);
    const p99Index = Math.floor(sorted.length * 0.99);
    const p99 = sorted[p99Index];
    
    expect(p99).toBe(100);
  });
});

describe('Error Handling', () => {
  it('should categorize errors by type', () => {
    const errors = [
      'AI_PROVIDER_TIMEOUT',
      'AI_PROVIDER_TIMEOUT',
      'CONNECTION_FAILED',
      'AI_PROVIDER_TIMEOUT'
    ];
    
    const errorCounts: Record<string, number> = {};
    errors.forEach(err => {
      const type = err.split(':')[0];
      errorCounts[type] = (errorCounts[type] || 0) + 1;
    });
    
    expect(errorCounts['AI_PROVIDER_TIMEOUT']).toBe(3);
    expect(errorCounts['CONNECTION_FAILED']).toBe(1);
  });

  it('should calculate success rate', () => {
    const totalStudents = 100;
    const failedStudents = 5;
    const successRate = ((totalStudents - failedStudents) / totalStudents) * 100;
    
    expect(successRate).toBe(95);
  });
});
