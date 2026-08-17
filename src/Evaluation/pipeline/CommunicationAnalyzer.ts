import { PipelineContext, EvaluationModule } from './interfaces';

export class CommunicationAnalyzer implements EvaluationModule {
  readonly name = 'CommunicationAnalyzer';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting CommunicationAnalyzer...');

    const tokens = context.tokens;
    if (tokens.length === 0) {
      context.localClarityScore = 0;
      return;
    }

    // 1. Match filler words
    const fillerWords = ['like', 'basicari', 'actuali', 'basic', 'actual', 'you know', 'sort of', 'kind of', 'stuff', 'thing'];
    let fillerCount = 0;
    
    context.stemmedTokens.forEach(t => {
      if (fillerWords.includes(t)) fillerCount++;
    });

    const fillerRatio = fillerCount / tokens.length;
    if (fillerRatio > 0.15) {
      context.localRepetitionPenalties += 1.5;
      context.developerTrace.push(`Communication warning: High density of filler words (${Math.round(fillerRatio * 100)}%)`);
    } else if (fillerRatio > 0.08) {
      context.localRepetitionPenalties += 0.5;
    }

    // 2. Repetition check: count unique words ratio
    const uniqueTokens = new Set(context.stemmedTokens);
    // Ignore small stop words
    const significantTokens = context.stemmedTokens.filter(t => t.length > 3);
    const uniqueSigTokens = new Set(significantTokens);
    
    const uniqueRatio = significantTokens.length > 0 ? uniqueSigTokens.size / significantTokens.length : 1.0;
    
    if (uniqueRatio < 0.4 && tokens.length > 20) {
      context.localRepetitionPenalties += 1.5;
      context.developerTrace.push(`Communication warning: High redundancy/repetition of vocabulary (Unique ratio: ${Math.round(uniqueRatio * 100)}%)`);
    }

    // 3. Sentence length variance
    const lengths = context.sentences.map(s => s.length);
    if (lengths.length > 2) {
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance = lengths.reduce((acc, len) => acc + Math.pow(len - avg, 2), 0) / lengths.length;
      
      if (variance < 2.0 && avg > 15) {
        // Monotonous sentence structures
        context.localRepetitionPenalties += 0.5;
        context.developerTrace.push('Communication warning: Low sentence length variance (monotonous flow)');
      }
    }

    context.localClarityScore = Math.max(0, 10 - context.localRepetitionPenalties);
    context.detectorConfidences['communicationAnalyzer'] = 85;
    context.developerTrace.push(`CommunicationAnalyzer completed. Local Clarity Score: ${context.localClarityScore}`);
  }
}
