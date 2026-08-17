import { PipelineContext, EvaluationModule } from './interfaces';

export class StructuralContradictionDetector implements EvaluationModule {
  readonly name = 'StructuralContradictionDetector';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting StructuralContradictionDetector...');

    const stemmedJoined = context.stemmedTokens.join(' ');

    // Contradiction 1: FIFO vs LIFO
    if (stemmedJoined.includes('fifo') && stemmedJoined.includes('lifo')) {
      context.contradictions.push('Stated both FIFO (First In First Out) and LIFO (Last In First Out) structures.');
      context.technicalErrors.push({
        ruleId: 'contradiction_fifo_lifo',
        matchedText: 'FIFO + LIFO',
        expected: 'Consistent description of access patterns (either FIFO or LIFO, not both)',
        explanation: 'Contradiction: Described structure as both FIFO and LIFO.',
        severity: 'high',
        penalty: 0.6
      });
      context.developerTrace.push('[CONTRADICTION] FIFO vs LIFO');
    }

    // Contradiction 2: Multiple vs Single Class Inheritance in Java
    if (stemmedJoined.includes('java')) {
      const hasMulti = stemmedJoined.includes('multi inherit') || stemmedJoined.includes('extend multi class');
      const hasSingle = stemmedJoined.includes('singl inherit') || stemmedJoined.includes('onli inherit from one') || stemmedJoined.includes('extend one class');
      
      if (hasMulti && hasSingle) {
        context.contradictions.push('Asserted both multiple inheritance and single inheritance in Java.');
        context.technicalErrors.push({
          ruleId: 'contradiction_java_inheritance',
          matchedText: 'Multiple + Single Class Inheritance',
          expected: 'Consistent assertion of Java inheritance limits (only single class inheritance supported)',
          explanation: 'Contradiction: Claimed Java supports both single and multiple class inheritance.',
          severity: 'high',
          penalty: 0.6
        });
        context.developerTrace.push('[CONTRADICTION] Java Single vs Multiple Class Inheritance');
      }
    }

    // Contradiction 3: Complexity mismatch (e.g. O(1) vs O(N) access/search without qualification)
    const mentionsO1 = stemmedJoined.includes('o(1)') || stemmedJoined.includes('constant time');
    const mentionsON = stemmedJoined.includes('o(n)') || stemmedJoined.includes('linear time');
    
    if (mentionsO1 && mentionsON) {
      // Check if they are referring to HashMaps or Arrays without context split
      if (stemmedJoined.includes('hashmap') && !stemmedJoined.includes('worst') && !stemmedJoined.includes('collis')) {
        context.contradictions.push('Stated HashMap operations are both O(1) and O(N) without qualifying collisions/worst case.');
        context.technicalErrors.push({
          ruleId: 'contradiction_complexity',
          matchedText: 'O(1) + O(N) without worst case',
          expected: 'Consistent time complexity explanations (O(1) average case, O(N) worst case if qualified)',
          explanation: 'Contradiction: Claimed HashMap search is both O(1) and O(N) without mentioning collisions.',
          severity: 'medium',
          penalty: 0.4
        });
        context.developerTrace.push('[CONTRADICTION] O(1) vs O(N) complexity');
      }
    }

    context.detectorConfidences['structuralContradictionDetector'] = 95;
    context.developerTrace.push(`StructuralContradictionDetector completed. Total contradictions: ${context.contradictions.length}`);
  }
}
