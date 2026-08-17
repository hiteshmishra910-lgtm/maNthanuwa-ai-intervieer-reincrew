import { PipelineContext, EvaluationModule } from './interfaces';

export class EvaluationValidator implements EvaluationModule {
  readonly name = 'EvaluationValidator';

  execute(context: PipelineContext): void {
    // Stage 5.5: Invariant Validation & Sanity Enforcement

    // Invariant 1: All dimension scores must stay strictly bounded [0.0, 10.0]
    context.technicalAccuracyScore = Math.max(0, Math.min(10, context.technicalAccuracyScore));
    context.conceptUnderstandingScore = Math.max(0, Math.min(10, context.conceptUnderstandingScore));
    context.reasoningScore = Math.max(0, Math.min(10, context.reasoningScore));
    context.communicationClarityScore = Math.max(0, Math.min(10, context.communicationClarityScore));
    context.confidenceCalibrationScore = Math.max(0, Math.min(10, context.confidenceCalibrationScore));

    // Invariant 2: Honest unknown forces absolute 0 across all scores
    if (context.isHonestUnknown) {
      context.technicalAccuracyScore = 0;
      context.conceptUnderstandingScore = 0;
      context.reasoningScore = 0;
      context.communicationClarityScore = 0;
      context.confidenceCalibrationScore = 0;
    }

    // Invariant 3: Severe technical error suppresses top-tier scores
    const hasCriticalError = context.technicalErrors.some(e => e.severity === 'high');
    if (hasCriticalError) {
      context.technicalAccuracyScore = Math.min(4.0, context.technicalAccuracyScore);
      context.developerTrace.push('EvaluationValidator Invariant: Critical technical error suppressed Technical Accuracy to max 4.0.');
    }

    context.developerTrace.push('EvaluationValidator Stage 5.5 Invariant Checks Completed cleanly.');
  }
}
