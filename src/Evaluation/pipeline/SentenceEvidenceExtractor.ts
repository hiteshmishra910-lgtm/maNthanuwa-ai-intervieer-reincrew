import { PipelineContext, EvaluationModule, Evidence } from './interfaces';
import { Normalizer } from './Normalizer';
import { Tokenizer } from './Tokenizer';
import { Stemmer } from './Stemmer';

export class SentenceEvidenceExtractor implements EvaluationModule {
  readonly name = 'SentenceEvidenceExtractor';

  execute(context: PipelineContext): void {
    if (!context.evidences) {
      context.evidences = [];
    }

    const rawText = context.answer || '';
    if (!rawText.trim()) return;

    // Segment answer into sentences
    const rawSentences = rawText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);

    rawSentences.forEach((sentenceText, index) => {
      const normalized = Normalizer.normalize(sentenceText);
      const tokens = Tokenizer.tokenize(normalized);
      const stemmed = tokens.map(t => Stemmer.stem(t));
      const stemmedJoined = stemmed.join(' ');

      // Extract mechanism evidence
      if (/how it work|under the hood|internall|mechanis|pointer|allocat|implement|architectur/i.test(normalized)) {
        context.evidences!.push({
          id: `ev_mech_${index}`,
          type: 'mechanism',
          sentenceIndex: index,
          span: sentenceText,
          confidence: 0.9,
          source: 'SentenceEvidenceExtractor'
        });
      }

      // Extract example evidence
      if (/for example|for instanc|such as|e\.g\.|like a|code snippet|example/i.test(normalized)) {
        context.evidences!.push({
          id: `ev_ex_${index}`,
          type: 'example',
          sentenceIndex: index,
          span: sentenceText,
          confidence: 0.95,
          source: 'SentenceEvidenceExtractor'
        });
      }

      // Extract tradeoff evidence
      if (/tradeoff|trade-off|advantage|disadvantage|downside|pros and cons|bottleneck|limitation/i.test(normalized)) {
        context.evidences!.push({
          id: `ev_trade_${index}`,
          type: 'tradeoff',
          sentenceIndex: index,
          span: sentenceText,
          confidence: 0.88,
          source: 'SentenceEvidenceExtractor'
        });
      }
    });

    context.developerTrace.push(`SentenceEvidenceExtractor completed. Extracted ${context.evidences.length} evidence items from ${rawSentences.length} sentences.`);
  }
}
