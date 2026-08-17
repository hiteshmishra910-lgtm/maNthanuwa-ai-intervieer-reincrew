import { describe, it, expect, vi } from 'vitest';
import { EvaluationDispatcher } from '../src/Evaluation/dispatch/EvaluationDispatcher';
import { ReportGenerator } from '../src/Evaluation/pipeline/ReportGenerator';
import { resolveCanonicalOverallScore } from '../src/Core/utils/sessionStatusResolver';
import * as apiService from '../src/Core/api/apiService';

describe('End-to-End Evaluation Failover and Score Persistence Integration', () => {
  it('should process transcript through failover, compute report, tag provenance, and resolve canonical score', async () => {
    // 1. Simulate OpenRouter API quota failure (429)
    vi.spyOn(apiService, 'submitAnswer').mockRejectedValue(
      new Error('429 Too Many Requests: free-models-per-day cap reached')
    );

    const sessionId = 'integration_sess_429';
    const evalContext: any = {
      session: { id: sessionId, mode: 'API' },
      candidate: { name: 'Integration Candidate', email: 'integ@example.com', role: 'Fullstack' },
      question: { id: 'q_int_1', question: 'What is CORS?', ideal_answer: 'Cross Origin Resource Sharing policy' },
      response: 'CORS stands for Cross-Origin Resource Sharing. It controls cross domain requests.',
      configuration: { mode: 'API' }
    };

    // 2. Dispatch turn evaluation
    const turnResult = await EvaluationDispatcher.getInstance().evaluateQuestion(evalContext);

    expect(turnResult).toBeDefined();
    expect((turnResult as any).evaluationMetadata?.evaluationSource).toBe('API_FALLBACK_LOCAL');

    // 3. Compute final interview report
    const history = [
      {
        questionId: 'q_int_1',
        question: evalContext.question.question,
        answer: evalContext.response,
        evaluation: turnResult,
        topic: 'Web Security'
      }
    ];

    const finalReport = ReportGenerator.computeFinalReport(history as any, null, { evaluationMode: 'API' });

    expect(finalReport).toBeDefined();
    expect(finalReport.executiveSummary.technicalScore).toBeGreaterThan(0);

    // 4. Resolve score using canonical resolver
    const canonicalScore = resolveCanonicalOverallScore(finalReport);
    expect(canonicalScore).not.toBeNull();
    expect(typeof canonicalScore).toBe('number');
  });
});
