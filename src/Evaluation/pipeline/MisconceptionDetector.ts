import { PipelineContext, EvaluationModule } from './interfaces';
import { CONCEPT_REGISTRY } from './ConceptRegistry';
import { Normalizer } from './Normalizer';
import { Tokenizer } from './Tokenizer';
import { Stemmer } from './Stemmer';

export class MisconceptionDetector implements EvaluationModule {
  readonly name = 'MisconceptionDetector';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting MisconceptionDetector...');

    // Collect all expected or matched concept IDs
    const relevantConceptIds = new Set<string>();
    context.matchedConcepts.forEach(c => relevantConceptIds.add(c));
    if (context.question.knowledgeModel) {
      context.question.knowledgeModel.forEach(expectedConcept => {
        relevantConceptIds.add(expectedConcept.conceptId);
      });
    }

    const misconceptionsToLookFor: { sourceId: string; text: string }[] = [];

    // Global registry misconceptions
    relevantConceptIds.forEach(conceptId => {
      const entry = CONCEPT_REGISTRY[conceptId];
      if (entry && entry.misconceptions) {
        entry.misconceptions.forEach(m => misconceptionsToLookFor.push({ sourceId: conceptId, text: m }));
      }
    });

    // Question-specific rubric misconceptions (V3)
    if (context.question.rubric?.misconceptions) {
      context.question.rubric.misconceptions.forEach(m => {
        misconceptionsToLookFor.push({ sourceId: 'rubric_custom', text: m });
      });
    }

    // Legacy fallback for commonMistakes in knowledgeModel
    if (context.question.knowledgeModel) {
      context.question.knowledgeModel.forEach(expectedConcept => {
        if (expectedConcept.commonMistakes) {
          expectedConcept.commonMistakes.forEach(m => {
            misconceptionsToLookFor.push({ sourceId: expectedConcept.conceptId, text: m });
          });
        }
      });
    }

    misconceptionsToLookFor.forEach(misconceptionEntry => {
      const normalized = Normalizer.normalize(misconceptionEntry.text);
      const tokens = Tokenizer.tokenize(normalized);
      const stemmed = tokens.map(t => Stemmer.stem(t));
      if (stemmed.length === 0) return;

      context.sentences.forEach((sentenceTokens, sentenceIndex) => {
        let matchCount = 0;
        let negationFound = false;

        stemmed.forEach(w => {
          // Check if word exists in sentence normally
          if (sentenceTokens.includes(w)) {
            matchCount++;
          }
          // Check if word exists but is negated
          else if (sentenceTokens.includes(`not_${w}`)) {
            matchCount++;
            negationFound = true;
          }
        });

        const matchRatio = matchCount / stemmed.length;
        if (matchRatio >= 0.8) {
          // Add to V3 evidence
          context.misconceptionEvidence.push({
            misconceptionId: misconceptionEntry.sourceId,
            triggerPhrase: misconceptionEntry.text,
            sentenceIndex: sentenceIndex,
            negated: negationFound,
            confidence: matchRatio
          });

          // If it's NOT negated, we penalize it via legacy fields
          if (!negationFound) {
            context.misconceptions.push(misconceptionEntry.text);
            context.technicalErrors.push({
              ruleId: `misconception_${misconceptionEntry.sourceId}`,
              matchedText: sentenceTokens.join(' ').substring(0, 60) + '...',
              expected: `Correct understanding`,
              explanation: `Demonstrated misconception: "${misconceptionEntry.text}"`,
              severity: 'medium',
              penalty: 0.4
            });
            context.developerTrace.push(`[MISCONCEPTION] Flagged: "${misconceptionEntry.text}" (Source: ${misconceptionEntry.sourceId}, Sentence: ${sentenceIndex})`);
          } else {
            context.developerTrace.push(`[MISCONCEPTION NEGATED] Candidate successfully negated misconception: "${misconceptionEntry.text}" (Sentence: ${sentenceIndex})`);
          }
        }
      });
    });

    context.detectorConfidences['misconceptionDetector'] = 90;
    context.developerTrace.push(`MisconceptionDetector completed. Total misconceptions flagged: ${context.misconceptions.length}`);
  }
}
