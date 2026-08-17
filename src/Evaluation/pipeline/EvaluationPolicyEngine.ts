import { PipelineContext, EvaluationModule } from './interfaces';
import { FatalIssue } from '../../../types';

export class EvaluationPolicyEngine implements EvaluationModule {
  readonly name = 'EvaluationPolicyEngine';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting EvaluationPolicyEngine...');

    const alignment = context.questionAlignment;
    if (!alignment) {
      context.developerTrace.push('No question alignment data found. Skipping policy rules.');
      return;
    }

    // Capture original scores in trace
    context.developerTrace.push(`Original scores before policy: Accuracy=${context.technicalAccuracyScore}, Understanding=${context.conceptUnderstandingScore}, Reasoning=${context.reasoningScore}, Communication=${context.communicationClarityScore}, Confidence=${context.confidenceCalibrationScore}`);

    // Rule 1: Didn't answer the question (answeredQuestion = false)
    if (!alignment.answeredQuestion) {
      const hasFatalIssue = alignment.fatalIssues && alignment.fatalIssues.length > 0;
      if (hasFatalIssue) {
        // Hard cap — explicit fatal issue detected (DID_NOT_ANSWER, OFF_TOPIC, etc.)
        context.developerTrace.push('[POLICY APPLIED] Fatal issue + did not answer. Hard capping all scores to 3.0.');
        context.technicalAccuracyScore = Math.min(3.0, context.technicalAccuracyScore);
        context.conceptUnderstandingScore = Math.min(3.0, context.conceptUnderstandingScore);
        context.reasoningScore = Math.min(3.0, context.reasoningScore);
        context.communicationClarityScore = Math.min(3.0, context.communicationClarityScore);
        context.confidenceCalibrationScore = Math.min(3.0, context.confidenceCalibrationScore);
      } else {
        // Soft cap — relevance just below threshold but no explicit fatal issue
        // (common when question has no knowledgeModel and concept matching can't run)
        context.developerTrace.push('[POLICY APPLIED] Low relevance, no fatal issue. Soft capping technical scores to 5.0.');
        context.technicalAccuracyScore = Math.min(5.0, context.technicalAccuracyScore);
        context.conceptUnderstandingScore = Math.min(5.0, context.conceptUnderstandingScore);
      }
    }

    // Rule 2: Misunderstanding detected
    if (alignment.misunderstandingDetected) {
      context.developerTrace.push('[POLICY APPLIED] Misunderstanding detected. Capping reasoning score to maximum of 2.0.');
      context.reasoningScore = Math.min(2.0, context.reasoningScore);
    }

    // Rule 3: Off-topic response
    if (alignment.offTopic) {
      context.developerTrace.push('[POLICY APPLIED] Off-topic response. Capping communication and accuracy to maximum of 4.0.');
      context.communicationClarityScore = Math.min(4.0, context.communicationClarityScore);
      context.technicalAccuracyScore = Math.min(4.0, context.technicalAccuracyScore);
    }

    // Rule 4: Generic memorized/templated answer
    if (alignment.genericMemorizedAnswer) {
      context.developerTrace.push('[POLICY APPLIED] Generic memorized/templated response. Deducting 3.0 points from confidence calibration.');
      context.confidenceCalibrationScore = Math.max(0, context.confidenceCalibrationScore - 3.0);
    }

    // Rule 5: Answered different question
    if (alignment.answeredDifferentQuestion) {
      context.developerTrace.push('[POLICY APPLIED] Answered different question. Capping all technical scores to maximum of 1.5.');
      context.technicalAccuracyScore = Math.min(1.5, context.technicalAccuracyScore);
      context.conceptUnderstandingScore = Math.min(1.5, context.conceptUnderstandingScore);
      context.reasoningScore = Math.min(1.5, context.reasoningScore);
    }

    // Rule 6: Fatal issues cap
    if (alignment.fatalIssues && alignment.fatalIssues.length > 0) {
      context.developerTrace.push(`[POLICY APPLIED] Fatal issues detected: [${alignment.fatalIssues.join(', ')}]. Applying generic penalty.`);
      // If there are multiple fatal issues, restrict total score
      if (alignment.fatalIssues.length >= 2) {
        context.technicalAccuracyScore = Math.min(2.0, context.technicalAccuracyScore);
        context.conceptUnderstandingScore = Math.min(2.0, context.conceptUnderstandingScore);
      }
    }

    context.developerTrace.push(`Final scores after policy: Accuracy=${context.technicalAccuracyScore}, Understanding=${context.conceptUnderstandingScore}, Reasoning=${context.reasoningScore}, Communication=${context.communicationClarityScore}, Confidence=${context.confidenceCalibrationScore}`);
  }
}
