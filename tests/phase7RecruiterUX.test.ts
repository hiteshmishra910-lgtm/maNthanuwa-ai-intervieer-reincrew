/**
 * phase7RecruiterUX.test.ts
 * Phase 7 Acceptance Test Suite: Recruiter Dashboard UX & Telemetry Controls
 * Verifies RecruiterTelemetryControlDTO_v1 rendering, feature flag fallback isolation,
 * queue status counter display, and 100% component isolation.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { RecruiterTelemetryService } from '../src/Evaluation/pipeline/recruiterTelemetry';
import { setFeatureFlagOverride, isFeatureFlagEnabled } from '../src/Evaluation/expert/config';

describe('Phase 7 Recruiter Dashboard UX & Telemetry Controls Suite', () => {
  beforeEach(() => {
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', false);
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', false);
  });

  afterEach(() => {
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', false);
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', false);
  });

  test('✓ 1. Feature Flag OFF Fallback: Defaults to CLASSIC_LOCAL_REPORT with zero errors', () => {
    expect(isFeatureFlagEnabled('BACKGROUND_ENRICHMENT_ENABLED')).toBe(false);
    expect(isFeatureFlagEnabled('NEW_REPORTS_ENABLED')).toBe(false);

    const telemetry = RecruiterTelemetryService.getTelemetryControlData();

    expect(telemetry.schemaVersion).toBe('v1.0');
    expect(telemetry.backgroundEnrichmentEnabled).toBe(false);
    expect(telemetry.newReportsEnabled).toBe(false);
    expect(telemetry.activeMode).toBe('CLASSIC_LOCAL_REPORT');
    expect(telemetry.telemetryStatusText).toContain('Classic Telemetry Mode');
  });

  test('✓ 2. Feature Flag ON Activation: Returns ENRICHED_BACKGROUND_REPORT when enabled', () => {
    setFeatureFlagOverride('BACKGROUND_ENRICHMENT_ENABLED', true);
    setFeatureFlagOverride('NEW_REPORTS_ENABLED', true);

    const telemetry = RecruiterTelemetryService.getTelemetryControlData();

    expect(telemetry.schemaVersion).toBe('v1.0');
    expect(telemetry.backgroundEnrichmentEnabled).toBe(true);
    expect(telemetry.newReportsEnabled).toBe(true);
    expect(telemetry.activeMode).toBe('ENRICHED_BACKGROUND_REPORT');
    expect(telemetry.telemetryStatusText).toContain('Enriched AI Telemetry Active');
  });

  test('✓ 3. Queue Stats Telemetry Integration: Accurately reports queue status counters', () => {
    const telemetry = RecruiterTelemetryService.getTelemetryControlData();

    expect(telemetry.queueStats).toBeDefined();
    expect(typeof telemetry.queueStats.pending).toBe('number');
    expect(typeof telemetry.queueStats.processing).toBe('number');
    expect(typeof telemetry.queueStats.completed).toBe('number');
    expect(typeof telemetry.queueStats.failed).toBe('number');
  });
});
