import { ReadonlyEvaluationResult } from '../../../types';
import { EvaluationStrategy } from '../dispatch/EvaluationStrategy';
import { EvaluationContext } from '../types/EvaluationContext';
import { LocalEvaluationStrategy } from './LocalEvaluationStrategy';

export class BatchEvaluationStrategy implements EvaluationStrategy {
  private static instance: BatchEvaluationStrategy;
  private localStrategy: LocalEvaluationStrategy;

  private constructor() {
    this.localStrategy = LocalEvaluationStrategy.getInstance();
  }

  public static getInstance(): BatchEvaluationStrategy {
    if (!BatchEvaluationStrategy.instance) {
      BatchEvaluationStrategy.instance = new BatchEvaluationStrategy();
    }
    return BatchEvaluationStrategy.instance;
  }

  supportsRealtime(): boolean {
    // It supports realtime question evaluation via local fallback, but batch evaluation for the interview
    return true;
  }

  async evaluateQuestion(context: EvaluationContext): Promise<ReadonlyEvaluationResult> {
    // During Interview: Use Local Strategy for instant feedback (0 API calls)
    return this.localStrategy.evaluateQuestion(context);
  }
}
