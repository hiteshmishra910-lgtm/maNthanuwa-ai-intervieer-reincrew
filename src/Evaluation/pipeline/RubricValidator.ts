import { PipelineContext, EvaluationModule } from './interfaces';

export class RubricValidator implements EvaluationModule {
  readonly name = 'RubricValidator';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting RubricValidator...');

    const rubric = context.question.rubric;
    if (!rubric) {
      context.developerTrace.push('No V3 rubric found. Operating in legacy mode.');
      return;
    }

    // Validate core concepts
    if (!rubric.coreConcepts || !Array.isArray(rubric.coreConcepts) || rubric.coreConcepts.length === 0) {
      context.developerTrace.push('[WARNING] Rubric validation failed: coreConcepts must be a non-empty array.');
      context.technicalErrors.push({
        ruleId: 'rubric_validation_error',
        matchedText: '',
        expected: 'Valid rubric coreConcepts array',
        explanation: 'The rubric is malformed and missing coreConcepts.',
        severity: 'high',
        penalty: 0
      });
      return;
    }

    // Validate synonym groups (no duplicate keys, valid arrays)
    if (rubric.synonymGroups) {
      for (const [key, aliases] of Object.entries(rubric.synonymGroups)) {
        if (!Array.isArray(aliases)) {
          context.developerTrace.push(`[WARNING] Rubric validation failed: synonym group '${key}' is not an array.`);
        }
      }
    }

    // Ensure scoring sum is 100 if present
    if (context.question.scoring) {
      const s = context.question.scoring;
      const total = s.technicalAccuracy + s.conceptUnderstanding + s.reasoning + s.communication + s.confidence;
      if (Math.abs(total - 100) > 0.01) {
        context.developerTrace.push(`[WARNING] Rubric scoring weights do not sum to 100 (Sum: ${total}).`);
      }
    }

    context.detectorConfidences['rubricValidator'] = 100;
    context.developerTrace.push('RubricValidator completed. Rubric is valid.');
  }
}
