/**
 * IntentEngine.ts (Phase 3 Local Intent Engine)
 * Implements IIntentEngine interface behind INTENT_ENGINE_ENABLED feature flag.
 * Operates in Shadow Mode during Phase 3 validation to log semantic intent diagnostics,
 * explainable evidence quotes, and sub-score deltas without altering candidate scores.
 */

import { IntentInputDTO_v1, IntentResultDTO_v1, IIntentEngine } from '../pipeline/interfaces';
import { isFeatureFlagEnabled } from '../expert/config';
import { CONCEPT_REGISTRY } from '../pipeline/ConceptRegistry';
import { Normalizer } from '../pipeline/Normalizer';
import { Tokenizer } from '../pipeline/Tokenizer';

export interface IntentDiagnosticLogDTO {
  readonly schemaVersion: 'v1.0';
  readonly shadowModeActive: boolean;
  readonly conceptId: string;
  readonly matchedIntent: string;
  readonly semanticSimilarityScore: number;
  readonly confidence: number;
  readonly matchedKeywords: readonly string[];
  readonly scoreDelta: number;
  readonly subScoreDeltas: Readonly<{
    technicalAccuracyDelta: number;
    understandingDelta: number;
    reasoningDelta: number;
    communicationDelta: number;
  }>;
}

export class IntentEngine implements IIntentEngine {
  public readonly version = 'v1' as const;
  public readonly stabilityTier = 'Internal' as const;

  private diagnosticLogs: IntentDiagnosticLogDTO[] = [];

  /**
   * Evaluates candidate utterance for semantic intent matches.
   * In Shadow Mode, logs telemetry diagnostics and guarantees zero score drift.
   */
  public async evaluateIntent(input: IntentInputDTO_v1): Promise<IntentResultDTO_v1[]> {
    if (!isFeatureFlagEnabled('INTENT_ENGINE_ENABLED')) {
      return [];
    }

    const question = input.context?.question;
    const utterance = input.context?.response || '';
    if (!question || !utterance.trim()) {
      return [];
    }

    const normalizedUtterance = Normalizer.normalize(utterance);
    const tokens = Tokenizer.tokenize(normalizedUtterance);

    // Extract concept matching keywords from keyConcepts or CONCEPT_REGISTRY
    const matchedPhrases: string[] = [];
    let bestSimilarity = 0.0;

    const conceptsToMatch = question.keyConcepts && question.keyConcepts.length > 0
      ? question.keyConcepts
      : [question.category || 'General'];

    for (const conceptKey of conceptsToMatch) {
      const lowerKey = conceptKey.toLowerCase();
      const entry = CONCEPT_REGISTRY[lowerKey];
      if (entry && entry.aliases) {
        for (const alias of entry.aliases) {
          if (normalizedUtterance.includes(alias.toLowerCase())) {
            matchedPhrases.push(alias);
            bestSimilarity = Math.max(bestSimilarity, 0.85);
          }
        }
      } else if (normalizedUtterance.includes(lowerKey)) {
        matchedPhrases.push(conceptKey);
        bestSimilarity = Math.max(bestSimilarity, 0.75);
      }
    }

    const confidence = matchedPhrases.length > 0 ? Math.min(1.0, 0.5 + matchedPhrases.length * 0.15) : 0.0;
    const conceptId = question.id || 'q_intent';
    const matchedIntent = matchedPhrases.length > 0 ? `DEMONSTRATED_${matchedPhrases[0].toUpperCase()}` : 'GENERIC_EXPLANATION';

    const intentResult: IntentResultDTO_v1 = {
      schemaVersion: 'v1.0',
      conceptId,
      matchedIntent,
      semanticSimilarityScore: bestSimilarity,
      confidence,
      matchedPhrases
    };

    // Shadow Mode Telemetry Logging (Zero Score Alteration)
    const logEntry: IntentDiagnosticLogDTO = {
      schemaVersion: 'v1.0',
      shadowModeActive: true,
      conceptId,
      matchedIntent,
      semanticSimilarityScore: bestSimilarity,
      confidence,
      matchedKeywords: matchedPhrases,
      scoreDelta: 0.0,
      subScoreDeltas: {
        technicalAccuracyDelta: 0.0,
        understandingDelta: 0.0,
        reasoningDelta: 0.0,
        communicationDelta: 0.0
      }
    };
    this.diagnosticLogs.push(logEntry);

    return [intentResult];
  }

  /**
   * Returns captured diagnostic logs for shadow mode validation audit.
   */
  public getDiagnosticLogs(): readonly IntentDiagnosticLogDTO[] {
    return [...this.diagnosticLogs];
  }

  /**
   * Clears accumulated diagnostic logs.
   */
  public clearDiagnosticLogs(): void {
    this.diagnosticLogs = [];
  }
}
