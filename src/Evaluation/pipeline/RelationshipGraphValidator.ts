import { PipelineContext, EvaluationModule } from './interfaces';
import { CONCEPT_REGISTRY } from './ConceptRegistry';
import { Normalizer } from './Normalizer';
import { Tokenizer } from './Tokenizer';
import { Stemmer } from './Stemmer';

export class RelationshipGraphValidator implements EvaluationModule {
  readonly name = 'RelationshipGraphValidator';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting RelationshipGraphValidator...');

    // Collect expected relationships from question model
    const expectedRelations: string[] = [];
    if (context.question.knowledgeModel) {
      context.question.knowledgeModel.forEach(expectedConcept => {
        if (expectedConcept.relationships) {
          expectedConcept.relationships.forEach(rel => {
            if (!expectedRelations.includes(rel)) {
              expectedRelations.push(rel);
            }
          });
        }
      });
    }

    if (expectedRelations.length === 0) {
      // Default fallback expected relations if none defined:
      // E.g., if both inheritance and polymorphism are expected, expect inheritance -> polymorphism
      const expectedIds = context.question.knowledgeModel?.map(c => c.conceptId) || [];
      if (expectedIds.includes('inheritance') && expectedIds.includes('polymorphism')) {
        expectedRelations.push('inheritance -> polymorphism');
      }
      if (expectedIds.includes('classes') && expectedIds.includes('objects')) {
        expectedRelations.push('classes -> objects');
      }
      if (expectedIds.includes('stacks') && expectedIds.includes('arrays')) {
        expectedRelations.push('arrays -> stacks');
      }
    }

    const transitionVerbs = ['enabl', 'lead', 'achiev', 'implement', 'allow', 'provid', 'through', 'via', 'creat', 'overrid', 'extend', 'us'];

    // Check sentence by sentence for concept connections
    context.sentences.forEach((sentenceTokens, idx) => {
      const sentenceStr = sentenceTokens.join(' ');

      expectedRelations.forEach(relation => {
        const parts = relation.split('->').map(p => p.trim().toLowerCase());
        if (parts.length !== 2) return;
        const [conceptA, conceptB] = parts;

        // Retrieve aliases for both concepts to check matching in sentence
        const aliasesA = CONCEPT_REGISTRY[conceptA]?.aliases || [conceptA];
        const aliasesB = CONCEPT_REGISTRY[conceptB]?.aliases || [conceptB];

        const stemmedAliasesA = aliasesA.map(a => Tokenizer.tokenize(Normalizer.normalize(a)).map(t => Stemmer.stem(t)).join(' '));
        const stemmedAliasesB = aliasesB.map(b => Tokenizer.tokenize(Normalizer.normalize(b)).map(t => Stemmer.stem(t)).join(' '));

        const matchedA = stemmedAliasesA.find(a => sentenceStr.includes(a));
        const matchedB = stemmedAliasesB.find(b => sentenceStr.includes(b));

        if (matchedA && matchedB) {
          // Both concepts present in the same sentence. Check if linked by a transition verb.
          const hasTransition = transitionVerbs.some(verb => sentenceStr.includes(verb));
          
          if (hasTransition) {
            // Check directionality: index of A vs index of B in sentence
            const indexA = sentenceStr.indexOf(matchedA);
            const indexB = sentenceStr.indexOf(matchedB);

            if (indexA < indexB) {
              // Correct direction: A leads to B / enables B
              if (!context.validConnections.includes(relation)) {
                context.validConnections.push(relation);
              }
              context.developerTrace.push(`[VALID RELATIONSHIP] Sentence ${idx + 1} connected: ${conceptA} -> ${conceptB}`);
            } else {
              // Reversed direction: B leads to A (incorrect statement)
              if (!context.invalidConnections.includes(relation)) {
                context.invalidConnections.push(relation);
              }
              // Add a technical error penalty for reversed connection
              context.technicalErrors.push({
                ruleId: `reversed_connection_${conceptA}_${conceptB}`,
                matchedText: sentenceStr,
                expected: `${conceptA} enables/leads to ${conceptB}`,
                explanation: `Reversed logical relationship: Claimed ${conceptB} enables/leads to ${conceptA}.`,
                severity: 'medium',
                penalty: 0.4
              });
              context.developerTrace.push(`[REVERSED RELATIONSHIP] Sentence ${idx + 1} flipped: ${conceptB} -> ${conceptA}`);
            }
          }
        }
      });
    });

    context.detectorConfidences['relationshipValidator'] = 85;
    context.developerTrace.push(`RelationshipGraphValidator completed. Valid: ${context.validConnections.length}, Invalid: ${context.invalidConnections.length}`);
  }
}
