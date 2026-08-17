import { PipelineContext, EvaluationModule } from './interfaces';
import { AliasResolver } from './AliasResolver';
import { Normalizer } from './Normalizer';
import { Tokenizer } from './Tokenizer';
import { Stemmer } from './Stemmer';

export class ConceptMatcher implements EvaluationModule {
  readonly name = 'ConceptMatcher';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting ConceptMatcher...');

    // Resolve all concept aliases globally
    AliasResolver.compileRegistry(); // ensure registry is compiled

    // If question has a rubric with synonymGroups, we should theoretically compile those too,
    // but for now we focus on the global aliases as per the registry, plus any specific to the question.
    const questionSpecificAliases: {conceptId: string, original: string, stemmedJoined: string}[] = [];
    if (context.question.rubric?.synonymGroups) {
      for (const [conceptId, aliases] of Object.entries(context.question.rubric.synonymGroups)) {
        aliases.forEach(alias => {
          const normalized = Normalizer.normalize(alias);
          const tokens = Tokenizer.tokenize(normalized);
          const stemmed = tokens.map(t => Stemmer.stem(t)).join(" ");
          questionSpecificAliases.push({ conceptId, original: alias, stemmedJoined: stemmed });
        });
      }
    }

    if (context.question.keyConcepts) {
      context.question.keyConcepts.forEach(kc => {
        const conceptId = kc.id || Normalizer.normalize(kc.concept).replace(/\s+/g, '_');
        const aliases = [kc.concept, ...(kc.aliases || [])];
        aliases.forEach(alias => {
          const normalized = Normalizer.normalize(alias);
          const tokens = Tokenizer.tokenize(normalized);
          const stemmed = tokens.map(t => Stemmer.stem(t)).join(" ");
          questionSpecificAliases.push({ conceptId, original: alias, stemmedJoined: stemmed });
        });
      });
    }

    const allAliases = [...AliasResolver.getCompiledAliases(), ...questionSpecificAliases];

    context.sentences.forEach((sentenceTokens, sentenceIndex) => {
      const sentenceStemmedJoined = sentenceTokens.join(' ');
      if (!sentenceStemmedJoined) return;

      for (const alias of allAliases) {
        if (!alias.stemmedJoined) continue;

        const escaped = alias.stemmedJoined.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
        
        if (regex.test(sentenceStemmedJoined)) {
          context.matchedConcepts.add(alias.conceptId);
          
          // Determine match strength
          let matchStrength: 'EXACT_ALIAS' | 'FUZZY_ALIAS' | 'STEM_MATCH' | 'PARTIAL_MATCH' | 'SEMANTIC_PATTERN' = 'STEM_MATCH';
          if (context.normalizedAnswer.includes(alias.original.toLowerCase())) {
            matchStrength = 'EXACT_ALIAS';
          }

          context.conceptEvidence.push({
            conceptId: alias.conceptId,
            matchedAlias: alias.original,
            sentenceIndex: sentenceIndex,
            matchStrength: matchStrength,
            confidence: matchStrength === 'EXACT_ALIAS' ? 1.0 : 0.8
          });

          // Initialize completeness map if needed
          let comp = context.conceptCompleteness.get(alias.conceptId);
          if (!comp) {
            comp = {
              satisfiedDimensions: [],
              completenessRatio: 0.0
            };
            context.conceptCompleteness.set(alias.conceptId, comp);
          }
          
          context.developerTrace.push(`Concept [${alias.conceptId}] matched via alias: [${alias.original}] in sentence ${sentenceIndex} (${matchStrength})`);
        }
      }
    });

    context.detectorConfidences['aliasResolver'] = 100;
    context.detectorConfidences['conceptMatcher'] = 95;
    context.developerTrace.push(`ConceptMatcher completed. Total matched concepts: ${context.matchedConcepts.size}`);
  }

  // Backward compatible static match method for existing test suite
  public static match(answer: string): any[] {
    const normalized = Normalizer.normalize(answer);
    const tokens = Tokenizer.tokenize(normalized);
    const stemmed = tokens.map(t => Stemmer.stem(t));
    const stemmedJoined = stemmed.join(' ');
    
    const resolved = AliasResolver.resolve(stemmedJoined);
    const result: any[] = [];
    
    const definitionTriggers = ["is a", "refers to", "mean", "defined as", "stand for", "is an"];
    const exampleTriggers = ["for example", "eg", "like", "such as", "instance of", "example of", "let say"];
    const comparisonTriggers = ["vs", "versus", "difference", "compare", "contrast", "on the other hand", "while", "wherea", "different from"];
    const useCaseTriggers = ["used to", "used for", "use case", "advantage", "benefit", "we use", "help to", "allow us to", "purpose of"];

    const stemTriggers = (triggers: string[]) => 
      triggers.map(t => Tokenizer.tokenize(Normalizer.normalize(t)).map(tok => Stemmer.stem(tok)).join(" "));

    const stemmedDefinitionTriggers = stemTriggers(definitionTriggers);
    const stemmedExampleTriggers = stemTriggers(exampleTriggers);
    const stemmedComparisonTriggers = stemTriggers(comparisonTriggers);
    const stemmedUseCaseTriggers = stemTriggers(useCaseTriggers);

    const hasTrigger = (stemmedTriggers: string[]) => 
      stemmedTriggers.some(trigger => stemmedJoined.includes(trigger));

    resolved.forEach((aliases, conceptId) => {
      const evidence: string[] = [];
      if (hasTrigger(stemmedDefinitionTriggers)) evidence.push('definition');
      if (hasTrigger(stemmedExampleTriggers)) evidence.push('example');
      if (hasTrigger(stemmedComparisonTriggers)) evidence.push('comparison');
      if (hasTrigger(stemmedUseCaseTriggers)) evidence.push('use_case');

      result.push({
        conceptId,
        matchedAliases: aliases,
        evidence,
        confidence: 0.8
      });
    });

    return result;
  }
}
