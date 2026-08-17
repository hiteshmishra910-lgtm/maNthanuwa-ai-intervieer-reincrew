import { PipelineContext, EvaluationModule } from './interfaces';

export class UncertaintyDetector implements EvaluationModule {
  readonly name = 'UncertaintyDetector';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting UncertaintyDetector...');

    const stemmedJoined = context.stemmedTokens.join(' ');

    const uncertaintyTriggers = [
      'i think', 'mayb', 'probabl', 'i guess', 'not sure', 'i believ',
      'might be', 'could be', 'not absolute sure', 'hard to say'
    ];

    const matched = uncertaintyTriggers.filter(trigger => stemmedJoined.includes(trigger));
    if (matched.length > 0) {
      context.uncertaintyDetected = true;
      context.developerTrace.push(`Uncertainty triggers matched: [${matched.join(', ')}]`);
    }

    context.detectorConfidences['uncertaintyDetector'] = 95;
    context.developerTrace.push(`UncertaintyDetector completed. Uncertainty detected: ${context.uncertaintyDetected}`);
  }
}
