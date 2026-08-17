/**
 * recruiterTelemetry.ts (Phase 7 Recruiter Dashboard UX & Telemetry Controls)
 * Exposes recruiter-facing telemetry control DTOs and queue status indicators behind feature flags.
 * Operates with 100% component isolation: Reads telemetry via DTOs without direct DB writes or API invocations.
 */

import { isFeatureFlagEnabled } from '../expert/config';
import { evaluationQueue } from '../dispatch/EvaluationQueue';

export interface RecruiterTelemetryControlDTO_v1 {
  readonly schemaVersion: 'v1.0';
  readonly backgroundEnrichmentEnabled: boolean;
  readonly newReportsEnabled: boolean;
  readonly queueStats: {
    readonly pending: number;
    readonly processing: number;
    readonly completed: number;
    readonly failed: number;
  };
  readonly activeMode: 'CLASSIC_LOCAL_REPORT' | 'ENRICHED_BACKGROUND_REPORT';
  readonly telemetryStatusText: string;
}

export class RecruiterTelemetryService {
  public static getTelemetryControlData(): RecruiterTelemetryControlDTO_v1 {
    const backgroundEnrichmentEnabled = isFeatureFlagEnabled('BACKGROUND_ENRICHMENT_ENABLED');
    const newReportsEnabled = isFeatureFlagEnabled('NEW_REPORTS_ENABLED');
    const stats = evaluationQueue.getStats();

    const isEnriched = backgroundEnrichmentEnabled && newReportsEnabled;
    const activeMode = isEnriched ? 'ENRICHED_BACKGROUND_REPORT' : 'CLASSIC_LOCAL_REPORT';

    const telemetryStatusText = isEnriched
      ? 'Enriched AI Telemetry Active: Background Worker Queue Online'
      : 'Classic Telemetry Mode: Baseline Local Evidence Reports';

    return {
      schemaVersion: 'v1.0',
      backgroundEnrichmentEnabled,
      newReportsEnabled,
      queueStats: {
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed
      },
      activeMode,
      telemetryStatusText
    };
  }
}
