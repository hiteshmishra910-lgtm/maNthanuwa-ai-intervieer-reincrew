import { PipelineContext, EvaluationModule } from './interfaces';

export interface KnowledgeRule {
  readonly ruleId: string;
  readonly conceptId: string;
  readonly incorrectPattern: string[]; // stemmed stems that must all be present in a sentence
  readonly correctPattern: string[];   // qualification stems (if present in same sentence, negates error)
  readonly message: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly penalty: number;
}

export const KNOWLEDGE_RULES_REGISTRY: KnowledgeRule[] = [
  {
    ruleId: 'stack_fifo',
    conceptId: 'stacks',
    incorrectPattern: ['stack', 'fifo'],
    correctPattern: ['not', 'never', 'sorry', 'mean', 'instead'],
    message: 'Stated that Stacks are FIFO (First In First Out), whereas they are LIFO (Last In First Out).',
    severity: 'high',
    penalty: 0.8
  },
  {
    ruleId: 'stack_first_in_first_out',
    conceptId: 'stacks',
    incorrectPattern: ['stack', 'first in first out'],
    correctPattern: ['not', 'never', 'sorry', 'mean', 'instead'],
    message: 'Stated that Stacks are First In First Out (FIFO), whereas they are LIFO.',
    severity: 'high',
    penalty: 0.8
  },
  {
    ruleId: 'queue_lifo',
    conceptId: 'queues',
    incorrectPattern: ['queue', 'lifo'],
    correctPattern: ['not', 'never', 'sorry', 'mean', 'instead'],
    message: 'Stated that Queues are LIFO (Last In First Out), whereas they are FIFO (First In First Out).',
    severity: 'high',
    penalty: 0.8
  },
  {
    ruleId: 'queue_last_in_first_out',
    conceptId: 'queues',
    incorrectPattern: ['queue', 'last in first out'],
    correctPattern: ['not', 'never', 'sorry', 'mean', 'instead'],
    message: 'Stated that Queues are Last In First Out (LIFO), whereas they are FIFO.',
    severity: 'high',
    penalty: 0.8
  },
  {
    ruleId: 'java_multiple_inheritance',
    conceptId: 'inheritance',
    incorrectPattern: ['java', 'multi', 'inherit'],
    correctPattern: ['interfac', 'not', 'prevent', 'cannot', 'doesnt'],
    message: 'Asserted Java supports multiple class inheritance, but Java only supports single class inheritance.',
    severity: 'high',
    penalty: 0.8
  },
  {
    ruleId: 'hashmap_search_on',
    conceptId: 'hash_maps',
    incorrectPattern: ['hashmap', 'search', 'o(n)'],
    correctPattern: ['worst', 'collis', 'bucket', 'list'],
    message: 'Stated HashMap search/lookup is O(N) by default (it is O(1) average case).',
    severity: 'medium',
    penalty: 0.4
  },
  {
    ruleId: 'hashmap_lookup_on',
    conceptId: 'hash_maps',
    incorrectPattern: ['hashmap', 'lookup', 'o(n)'],
    correctPattern: ['worst', 'collis', 'bucket', 'list'],
    message: 'Stated HashMap search/lookup is O(N) by default (it is O(1) average case).',
    severity: 'medium',
    penalty: 0.4
  },
  {
    ruleId: 'binary_search_unsorted',
    conceptId: 'binary_search',
    incorrectPattern: ['binari', 'search', 'unsort'],
    correctPattern: ['must', 'sort', 'need', 'requir'],
    message: 'Asserted that Binary Search is performed on unsorted lists, whereas sorting is a prerequisite.',
    severity: 'medium',
    penalty: 0.4
  }
];

export class TechnicalRulesDetector implements EvaluationModule {
  readonly name = 'TechnicalRulesDetector';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting TechnicalRulesDetector...');

    // Run rules sentence-by-sentence to avoid false keyword correlations across different paragraphs
    context.sentences.forEach((sentenceTokens, idx) => {
      const sentenceStr = sentenceTokens.join(' ');

      for (const rule of KNOWLEDGE_RULES_REGISTRY) {
        // Check if all incorrect stems are present
        const hasAllIncorrect = rule.incorrectPattern.every(stem => sentenceStr.includes(stem));
        if (hasAllIncorrect) {
          // Check if any correct/negation stems are present
          const hasNegation = rule.correctPattern.some(stem => sentenceStr.includes(stem));
          
          if (!hasNegation) {
            context.technicalErrors.push({
              ruleId: rule.ruleId,
              matchedText: sentenceStr,
              expected: rule.correctPattern.join(' | '),
              explanation: rule.message,
              severity: rule.severity,
              penalty: rule.penalty
            });
            context.developerTrace.push(`[RULE FAILED] Sentence ${idx + 1} violated rule ${rule.ruleId}: "${sentenceStr}"`);
          }
        }
      }
    });

    context.detectorConfidences['technicalRulesDetector'] = 100;
    context.developerTrace.push(`TechnicalRulesDetector completed. Total errors: ${context.technicalErrors.length}`);
  }
}
