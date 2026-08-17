import { PipelineContext, EvaluationModule } from './interfaces';

export class IntentDetector implements EvaluationModule {
  readonly name = 'IntentDetector';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting IntentDetector...');

    const questionText = (context.question.question || (context.question as any).text || "").toLowerCase();
    const stemmedJoined = context.stemmedTokens.join(' ');

    let satisfaction: 'YES' | 'PARTIAL' | 'NO' = 'YES';
    let satisfiedTriggersCount = 0;

    // 1. "WHY" intent
    if (questionText.includes('why') || questionText.includes('reason') || questionText.includes('benefit') || questionText.includes('advantage')) {
      const whyTriggers = ['becaus', 'so that', 'prevent', 'ensur', 'avoid', 'reason', 'allow', 'benefit', 'purpos', 'help', 'keep'];
      const matched = whyTriggers.filter(t => stemmedJoined.includes(t));
      satisfiedTriggersCount += matched.length;
      
      if (matched.length === 0) {
        satisfaction = 'NO';
      } else if (matched.length < 2) {
        satisfaction = 'PARTIAL';
      }
      context.developerTrace.push(`Intent: "WHY" check. Matched triggers: [${matched.join(', ')}]`);
    }

    // 2. "HOW" or "DIFFERENCE" intent
    if (questionText.includes('how') || questionText.includes('explain the difference') || questionText.includes('vs') || questionText.includes('versus') || questionText.includes('compare')) {
      const howOrDiffTriggers = ['work', 'implement', 'via', 'through', 'use', 'intern', 'vs', 'versus', 'differ', 'compar', 'contrast', 'while', 'wherea', 'instead', 'includ', 'ensur', 'stor', 'guarante', 'provid', 'proper', 'mechan', 'trigger', 'function', 'operat'];
      const matched = howOrDiffTriggers.filter(t => stemmedJoined.includes(t));
      satisfiedTriggersCount += matched.length;

      if (matched.length === 0) {
        satisfaction = context.matchedConcepts.size > 0 ? 'PARTIAL' : 'NO';
      } else if (matched.length < 2 && satisfaction !== 'NO') {
        satisfaction = 'PARTIAL';
      }
      context.developerTrace.push(`Intent: "HOW/DIFF" check. Matched triggers: [${matched.join(', ')}]`);
    }

    // Direct check: if answer matched zero expected concepts, downgrade.
    // BUT only do this when the question actually has a knowledgeModel or keyConcepts —
    // meaning we have a defined set of concepts to expect. If the question has no registry
    // attachment, matching zero concepts is expected (not a failure).
    const hasExpectedConcepts = (
      (context.question.knowledgeModel && context.question.knowledgeModel.length > 0) ||
      (context.question.keyConcepts && context.question.keyConcepts.length > 0)
    );
    const isOpenEnded = ['hr', 'behavioral', 'scenario', 'introductory'].includes(String(context.questionType || (context.question as any).questionType || '').toLowerCase());
    if (context.matchedConcepts.size === 0 && hasExpectedConcepts && satisfaction === 'YES' && !isOpenEnded) {
      satisfaction = 'PARTIAL'; // Downgrade but don't fully penalise — other signals may still be valid
      context.developerTrace.push('IntentDetector: Expected concepts but matched none. Downgrading satisfaction to PARTIAL.');
    }

    context.questionSatisfaction = satisfaction;
    context.detectorConfidences['intentDetector'] = 90;
    context.developerTrace.push(`IntentDetector completed. Satisfaction result: ${satisfaction}`);
  }
}
