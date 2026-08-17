import { ReadonlyEvaluationResult } from '../../../types';
import { EvaluationContext } from '../types/EvaluationContext';

export interface EvaluationStrategy {
    supportsRealtime(): boolean;
    evaluateQuestion(context: EvaluationContext): Promise<ReadonlyEvaluationResult>;
    evaluateInterview?(context: EvaluationContext): Promise<readonly ReadonlyEvaluationResult[]>;
}

export interface IEvaluationDispatcher {
    evaluateQuestion(context: EvaluationContext): Promise<ReadonlyEvaluationResult>;
    evaluateInterview(context: EvaluationContext): Promise<readonly ReadonlyEvaluationResult[]>;
    finalizeInterview(sessionId: string, history: any[], proctoringReport: any, mode: string): Promise<any>;
}
