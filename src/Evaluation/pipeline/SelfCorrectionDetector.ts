import { PipelineContext, EvaluationModule } from './interfaces';

export class SelfCorrectionDetector implements EvaluationModule {
  readonly name = 'SelfCorrectionDetector';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting SelfCorrectionDetector...');

    const correctionTriggers = ['sorri', 'i mean', 'actuali', 'correct', 'to be precis'];

    // Check sentence-by-sentence for correction triggers
    context.sentences.forEach((sentenceTokens, idx) => {
      const sentenceStr = sentenceTokens.join(' ');
      const hasCorrection = correctionTriggers.some(t => sentenceStr.includes(t));

      if (hasCorrection && idx > 0) {
        // Find if the previous sentence was flagged for a technical error
        const previousSentenceStr = context.sentences[idx - 1].join(' ');
        
        const matchingErrorIdx = context.technicalErrors.findIndex(err => 
          err.matchedText.includes(previousSentenceStr) || previousSentenceStr.includes(err.matchedText)
        );

        if (matchingErrorIdx !== -1) {
          const reversedError = context.technicalErrors[matchingErrorIdx];
          context.technicalErrors.splice(matchingErrorIdx, 1);
          context.selfCorrectionsCount++;
          
          // Also clear contradiction errors that were triggered by this error's concept
          const conceptId = reversedError.ruleId.split('_')[0]; // stack, queue, java, etc.
          const contradictionIdx = context.technicalErrors.findIndex(err => 
            err.ruleId.startsWith('contradiction') && 
            (err.ruleId.includes(conceptId) || err.explanation.toLowerCase().includes(conceptId) || (conceptId === 'stack' && err.ruleId.includes('fifo')))
          );
          if (contradictionIdx !== -1) {
            const reversedContradiction = context.technicalErrors[contradictionIdx];
            context.technicalErrors.splice(contradictionIdx, 1);
            context.developerTrace.push(`[SELF-CORRECTION] Reversed contradiction error: "${reversedContradiction.explanation}"`);
          }
          
          // Clean context contradictions list
          context.contradictions = context.contradictions.filter(c => 
            !(c.toLowerCase().includes(conceptId) || (conceptId === 'stack' && c.toLowerCase().includes('fifo')) || (conceptId === 'queue' && c.toLowerCase().includes('lifo')))
          );

          context.developerTrace.push(`[SELF-CORRECTION VALIDATED] Reversed technical error: "${reversedError.explanation}" due to correction in sentence ${idx + 1}: "${sentenceStr}"`);
        }
      }
    });

    context.detectorConfidences['selfCorrectionDetector'] = 90;
    context.developerTrace.push(`SelfCorrectionDetector completed. Total self-corrections validated: ${context.selfCorrectionsCount}`);
  }
}
