import { PipelineContext, EvaluationModule } from './interfaces';
import { CONCEPT_REGISTRY } from './ConceptRegistry';

export class NegativeEvidenceDetector implements EvaluationModule {
  readonly name = 'NegativeEvidenceDetector';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting NegativeEvidenceDetector...');

    const stemmedJoined = context.stemmedTokens.join(' ');

    // 1. Circular Explanation Detection
    // Check if the concept name or alias repeats in a circular pattern: "X is X because X allows X"
    context.sentences.forEach((sentenceTokens, idx) => {
      const sentenceStr = sentenceTokens.join(' ');
      
      context.matchedConcepts.forEach(conceptId => {
        const canonical = CONCEPT_REGISTRY[conceptId]?.concept.toLowerCase();
        if (!canonical) return;
        
        // Count occurrences of canonical concept word in this single sentence
        const count = sentenceTokens.filter(t => t === canonical || canonical.includes(t)).length;
        
        // If a single short sentence has the concept name repeated 3+ times, flag circularity
        if (count >= 3 && sentenceTokens.length < 15) {
          context.circularExplanationDetected = true;
          context.developerTrace.push(`[CIRCULAR EXPLANATION] Sentence ${idx + 1} repeats concept name "${canonical}" ${count} times: "${sentenceStr}"`);
        }
      });
    });

    // 2. Buzzword Stuffing Detection
    // Matched many concepts but explained none (completeness is 0 across all matched concepts)
    const totalMatched = context.matchedConcepts.size;
    let totalExplained = 0;

    context.conceptCompleteness.forEach(comp => {
      if (comp.satisfiedDimensions.length > 0) {
        totalExplained++;
      }
    });

    // If candidate matched 3+ concepts but explained fewer than 35% of them (and didn't cover all core rubric concepts), flag buzzword stuffing
    const rubricCore = context.question.rubric?.coreConcepts || [];
    const coreMatchedCount = rubricCore.filter(id => context.matchedConcepts.has(id)).length;
    const answeredAllCore = rubricCore.length > 0 && coreMatchedCount >= rubricCore.length;

    const isOpenEnded = ['hr', 'behavioral', 'scenario', 'introductory'].includes(String(context.questionType || (context.question as any).questionType || '').toLowerCase());
    if (!isOpenEnded && !answeredAllCore && totalMatched >= 3 && (totalExplained === 0 || (totalExplained / totalMatched) < 0.35)) {
      context.buzzwordStuffingDetected = true;
      context.developerTrace.push('[BUZZWORD STUFFING] Candidate listed multiple concepts but explained fewer than 35%.');
    }

    context.detectorConfidences['negativeEvidenceDetector'] = 95;
    context.developerTrace.push(`NegativeEvidenceDetector completed. Buzzwords: ${context.buzzwordStuffingDetected}, Circular: ${context.circularExplanationDetected}`);
  }
}
