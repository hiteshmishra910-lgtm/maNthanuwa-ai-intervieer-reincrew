/**
 * EvidenceEngine.ts (Phase 1 Infrastructure Stub)
 * Implements IEvidenceEngine interface behind NEW_REPORTS_ENABLED feature flag.
 * Default behavior: Inert stub returning empty evidence graph when flag is false.
 */

import { EvidenceInputDTO_v1, EvidenceGraphDTO_v1, IEvidenceEngine } from '../pipeline/interfaces';
import { isFeatureFlagEnabled } from '../expert/config';

export class EvidenceEngine implements IEvidenceEngine {
  public readonly version = 'v1' as const;
  public readonly stabilityTier = 'Internal' as const;

  /**
   * Extracts evidence quotes from candidate transcript.
   * Inert stub: Returns empty evidence graph if feature flag is disabled.
   */
  public async extractEvidence(input: EvidenceInputDTO_v1): Promise<EvidenceGraphDTO_v1> {
    if (!isFeatureFlagEnabled('NEW_REPORTS_ENABLED')) {
      return {
        schemaVersion: 'v1.0',
        demonstratedQuotes: [],
        missingGaps: [],
        technicalErrors: []
      };
    }

    return {
      schemaVersion: 'v1.0',
      demonstratedQuotes: [],
      missingGaps: [],
      technicalErrors: []
    };
  }
}
