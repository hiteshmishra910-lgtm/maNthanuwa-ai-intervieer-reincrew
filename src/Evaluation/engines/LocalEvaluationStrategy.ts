import { ReadonlyEvaluationResult } from '../../../types';
import { EvaluationStrategy } from '../dispatch/EvaluationStrategy';
import { EvaluationContext } from '../types/EvaluationContext';
import { EvaluationCore } from '../dispatch/EvaluationCore';

export class LocalEvaluationStrategy implements EvaluationStrategy {
  private static instance: LocalEvaluationStrategy;

  private constructor() {}

  public static getInstance(): LocalEvaluationStrategy {
    if (!LocalEvaluationStrategy.instance) {
      LocalEvaluationStrategy.instance = new LocalEvaluationStrategy();
    }
    return LocalEvaluationStrategy.instance;
  }

  supportsRealtime(): boolean {
    return true;
  }

  async evaluateQuestion(context: EvaluationContext): Promise<ReadonlyEvaluationResult> {
    const result = EvaluationCore.evaluateAnswer(context);
    return Object.freeze(result);
  }
}
