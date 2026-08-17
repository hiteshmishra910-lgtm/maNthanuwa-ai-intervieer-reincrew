import { PipelineContext, EvaluationModule } from './interfaces';

export class ExplainabilityFormatter implements EvaluationModule {
  readonly name = 'ExplainabilityFormatter';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting ExplainabilityFormatter...');

    let report = '';
    
    // 1. Concept Evidence
    if (context.conceptEvidence && context.conceptEvidence.length > 0) {
      report += '## Matched Concepts\n';
      context.conceptEvidence.forEach(ev => {
        report += `- **${ev.conceptId}** (Matched phrase: "${ev.matchedAlias}", Strength: ${ev.matchStrength})\n`;
      });
      report += '\n';
    } else {
      report += '## Matched Concepts\nNo core concepts were detected in the answer.\n\n';
    }

    // 2. Misconceptions
    if (context.misconceptionEvidence && context.misconceptionEvidence.length > 0) {
      report += '## Misconceptions\n';
      context.misconceptionEvidence.forEach(ev => {
        if (ev.negated) {
          report += `- ✅ **Avoided Misconception**: Candidate correctly negated "${ev.triggerPhrase}"\n`;
        } else {
          report += `- ❌ **Detected Misconception**: "${ev.triggerPhrase}"\n`;
        }
      });
      report += '\n';
    }

    // 3. Confidence Factors
    if (context.confidenceEvidence && context.confidenceEvidence.length > 0) {
      report += '## Confidence Factors\n';
      context.confidenceEvidence.forEach(ev => {
        report += `- ${ev.adjustment > 0 ? '+' : ''}${ev.adjustment}: ${ev.factor} (${ev.reason})\n`;
      });
      report += '\n';
    }

    // Assign to a new property or existing explanation property
    (context as any).explainabilityReport = report;

    context.detectorConfidences['explainabilityFormatter'] = 100;
    context.developerTrace.push('ExplainabilityFormatter completed.');
  }
}
