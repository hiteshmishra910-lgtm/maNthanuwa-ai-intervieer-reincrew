import { PipelineContext, EvaluationModule } from './interfaces';

export class UnrecognizedClaimDetector implements EvaluationModule {
  readonly name = 'UnrecognizedClaimDetector';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting UnrecognizedClaimDetector...');

    // A list of general, valid developer terminology that might not be registered in the simple concept registry
    const advancedDeveloperTerms = [
      'jvm', 'garbag collector', 'thread', 'synchron', 'reflect', 'balanc tree',
      'red-black tree', 'hash collis', 'load factor', 'concurr', 'distribut',
      'cach', 'solid', 'dry', 'kiss', 'dependen-inject', 'auto-resiz', 'amort',
      'rehash', 'scalabl', 'thread-saf', 'linear-prob', 'chaining'
    ];

    const stemmedJoined = context.stemmedTokens.join(' ');
    
    // Determine expected concept IDs or registry IDs already matched
    const knownTermsMatched = new Set<string>();
    context.matchedConcepts.forEach(c => knownTermsMatched.add(c));
    
    if (context.question.knowledgeModel) {
      context.question.knowledgeModel.forEach(c => knownTermsMatched.add(c.conceptId));
    }

    advancedDeveloperTerms.forEach(term => {
      // If the term is matched but is not in our known expected/matched concepts, flag it
      if (stemmedJoined.includes(term) && !knownTermsMatched.has(term)) {
        context.unrecognizedClaims.push(term);
        context.developerTrace.push(`[UNRECOGNIZED TECHNICAL CLAIM] Candidate mentioned "${term}". Lowering confidence calibration to request AI verification.`);
      }
    });

    context.detectorConfidences['unrecognizedClaimDetector'] = 90;
    context.developerTrace.push(`UnrecognizedClaimDetector completed. Total unrecognized claims: ${context.unrecognizedClaims.length}`);
  }
}
