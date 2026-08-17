import { describe, it, expect, vi } from 'vitest';
import { LocalEvaluationStrategy } from '../src/Evaluation/engines/LocalEvaluationStrategy';
import { InteractiveEvaluationStrategy } from '../src/Evaluation/engines/InteractiveEvaluationStrategy';
import { EvaluationMode, Question } from '../types';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';
import * as apiService from '../src/Core/api/apiService';
import { evaluationQueue } from '../src/Evaluation/dispatch/EvaluationQueue';

vi.mock('../src/Core/api/apiService', () => ({
  submitAnswer: vi.fn().mockResolvedValue({
    evaluation: {
      analysis: { technicalAccuracy: 8, understanding: 7, reasoning: 6 },
      score: 7,
      feedback: 'Good',
      isCorrect: true,
      relevanceScore: 0.9,
      questionSatisfactionScore: 8
    },
    cache_hit: false,
    fallback_used: false
  }),
}));

vi.mock('../src/Evaluation/dispatch/EvaluationQueue', () => ({
  evaluationQueue: {
    enqueue: vi.fn(),
  },
}));

describe('Phase 5: Load Testing', () => {
  const mockQuestion: Question = {
    id: 'q-1',
    question: 'Explain closure in JavaScript.',
    questionType: 'Definition',
    evaluationGuide: ['Scope', 'Functions'],
  };

  const getContext = (mode: EvaluationMode, response: string): EvaluationContext => ({
    session: { id: `test-session-${Math.random()}`, mode },
    candidate: { name: 'Test User', role: 'Candidate' },
    question: mockQuestion,
    response,
    evaluationProfile: {
      id: 'prof-1',
      version: 'v1',
      name: 'Default Profile',
      description: '',
      weights: { Critical: 50, Important: 30, NiceToHave: 20 },
      rubricVersion: 'v1',
    } as any,
  });

  it('Test A: Local Evaluation Throughput (1000 evaluations)', async () => {
    const strategy = LocalEvaluationStrategy.getInstance();
    const iterations = 1000;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await strategy.evaluateQuestion(getContext(EvaluationMode.LOCAL, 'A closure is a function with its lexical scope.'));
    }
    const end = performance.now();
    
    const totalMs = end - start;
    console.log(`\n[Load Test] Executed ${iterations} LOCAL evaluations in ${totalMs.toFixed(2)}ms`);
    console.log(`[Load Test] Average latency: ${(totalMs / iterations).toFixed(2)}ms per evaluation`);
    
    // Assert average time is under 15ms per eval (heuristic check)
    expect(totalMs / iterations).toBeLessThan(15);
  }, 15000);

  it('Test B: Hybrid Queue Processing (100 interviews)', async () => {
    const iterations = 100;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      evaluationQueue.enqueue({
        sessionId: `hybrid-session-${i}`,
        history: [],
        proctoringReport: null
      });
    }
    const end = performance.now();
    
    const totalMs = end - start;
    console.log(`\n[Load Test] Queued ${iterations} sessions in ${totalMs.toFixed(2)}ms`);
    expect(evaluationQueue.enqueue).toHaveBeenCalledTimes(100);
  });

  it('Test C: API Provider Load Simulation (100 concurrent requests)', async () => {
    const strategy = InteractiveEvaluationStrategy.getInstance();
    const iterations = 100;
    
    const start = performance.now();
    const promises = [];
    
    for (let i = 0; i < iterations; i++) {
      promises.push(strategy.evaluateQuestion(getContext(EvaluationMode.API, 'API Response')));
    }
    
    await Promise.all(promises);
    const end = performance.now();
    
    const totalMs = end - start;
    console.log(`\n[Load Test] Executed ${iterations} mocked API evaluations in ${totalMs.toFixed(2)}ms`);
    console.log(`[Load Test] Average simulated throughput: ${(totalMs / iterations).toFixed(2)}ms per request`);
    
    expect(apiService.submitAnswer).toHaveBeenCalledTimes(100);
  });
});
