import { PipelineContext, EvaluationModule } from './interfaces';
import { CONCEPT_REGISTRY } from './ConceptRegistry';
import { Normalizer } from './Normalizer';
import { Tokenizer } from './Tokenizer';
import { Stemmer } from './Stemmer';

export class RelevanceAnalyzer implements EvaluationModule {
  readonly name = 'RelevanceAnalyzer';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting RelevanceAnalyzer...');

    const wordCount = context.tokens.length;
    if (wordCount === 0) {
      context.relevantContentRatio = 0;
      return;
    }

    // Determine expected concept set for the question
    const expectedIds = new Set<string>();
    if (context.question.knowledgeModel) {
      context.question.knowledgeModel.forEach(c => expectedIds.add(c.conceptId));
    } else {
      // Map evaluation guide words to concept registry keys
      context.question.evaluationGuide?.forEach(guide => {
        const itemLower = guide.toLowerCase();
        for (const [id, entry] of Object.entries(CONCEPT_REGISTRY)) {
          if (itemLower.includes(entry.concept.toLowerCase()) || (entry.aliases && entry.aliases.some(a => itemLower.includes(a.toLowerCase())))) {
            expectedIds.add(id);
          }
        }
      });
    }

    // Always allow basic data structure / programming terms as general context, not off-topic
    const generalScopeIds = ['variables', 'functions', 'classes', 'objects'];

    // Identify which sentences contain expected concepts
    let relevantWordCount = 0;
    let outOfScopeConceptCount = 0;

    context.sentences.forEach(sentenceTokens => {
      const sentenceStr = sentenceTokens.join(' ');
      let sentenceIsRelevant = false;

      // Check if sentence matches any expected concepts
      for (const conceptId of expectedIds) {
        const aliases = CONCEPT_REGISTRY[conceptId]?.aliases || [conceptId];
        const stemmedAliases = aliases.map(a => Tokenizer.tokenize(Normalizer.normalize(a)).map(t => Stemmer.stem(t)).join(' '));
        if (stemmedAliases.some(a => sentenceStr.includes(a))) {
          sentenceIsRelevant = true;
          break;
        }
      }

      if (sentenceIsRelevant) {
        relevantWordCount += sentenceTokens.length;
      } else {
        // Check if sentence introduces many non-expected concepts (out-of-scope rambling)
        for (const [conceptId, entry] of Object.entries(CONCEPT_REGISTRY)) {
          if (expectedIds.has(conceptId) || generalScopeIds.includes(conceptId)) continue;
          
          const aliases = entry.aliases || [conceptId];
          const stemmedAliases = aliases.map(a => Tokenizer.tokenize(Normalizer.normalize(a)).map(t => Stemmer.stem(t)).join(' '));
          if (stemmedAliases.some(a => sentenceStr.includes(a))) {
            outOfScopeConceptCount++;
            break;
          }
        }
      }
    });

    // Conversational Fluff & Non-Substantial Content Filter
    const fluffPatterns = [
      "good question", "great question", "nice question", "thank you for asking",
      "in my opinion", "software engineering best practice", "best practice",
      "very important topic", "crucial topic", "broadly speaking", "as far as i know",
      "to be honest", "as mentioned before", "in modern software development",
      "important concept", "key aspect", "general concept"
    ];

    const hasFluffPhrases = fluffPatterns.some(fp => context.normalizedAnswer.includes(fp));
    const hasZeroMatchedConcepts = context.matchedConcepts.size === 0;
    const qTypeStr = String(context.question.type || '').toLowerCase();
    const categoryStr = String((context.question as any).interviewCategory || '').toLowerCase();
    const isOpenEnded = qTypeStr.includes('behavioral') || qTypeStr.includes('introduction') || categoryStr.includes('intro') || categoryStr.includes('behavioral') || context.questionType === 'HR' || context.questionType === 'Scenario';

    // Compute relevant content ratio
    let ratio = expectedIds.size > 0 ? (relevantWordCount / wordCount) : 1.0;

    // Strict Gating: If answer has zero technical concept matches and consists of conversational fluff, gate ratio to 0
    if (hasZeroMatchedConcepts && !isOpenEnded && (hasFluffPhrases || relevantWordCount === 0)) {
      ratio = 0.0;
      context.buzzwordStuffingDetected = hasFluffPhrases;
      context.developerTrace.push('[RELEVANCE GATING] Answer contains non-substantial filler without technical concept matches. Ratio set to 0.0.');
    } else if (isOpenEnded && hasFluffPhrases) {
      ratio = 0.4;
      context.buzzwordStuffingDetected = true;
    }

    context.relevantContentRatio = Math.max(0.0, Math.min(1.0, ratio));

    // Knowledge boundary check
    if (outOfScopeConceptCount >= 4) {
      context.knowledgeBoundaryExceeded = true;
      // Add a minor penalty to technical accuracy (deducted in ScoreAggregator or logged)
      context.technicalErrors.push({
        ruleId: 'knowledge_boundary_exceeded',
        matchedText: 'Multiple out-of-scope concepts matched',
        expected: 'Focus on the specific concept asked',
        explanation: 'Rambled too far out-of-scope into unrelated technical topics.',
        severity: 'low',
        penalty: 0.2
      });
      context.developerTrace.push(`[KNOWLEDGE BOUNDARY EXCEEDED] Met ${outOfScopeConceptCount} out-of-scope concepts.`);
    }

    context.detectorConfidences['relevanceAnalyzer'] = 80;
    context.developerTrace.push(`RelevanceAnalyzer completed. Relevant content ratio: ${Math.round(context.relevantContentRatio * 100)}%`);
  }
}
