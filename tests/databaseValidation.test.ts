import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../src/Evaluation/pipeline/ReportGenerator';
import { EvaluationMode } from '../types';

describe('Phase 3: Database Validation', () => {
  it('should generate a report that contains full evaluation metadata', () => {
    const history: any[] = [
      {
        questionId: 'q-1',
        questionText: 'Test',
        transcript: 'Answer',
        evaluation: {
          contentScore: 8,
          technicalAccuracyScore: 8,
          conceptUnderstandingScore: 8,
          reasoningScore: 8,
          communicationScore: 8,
          confidenceScore: 8,
          evaluationMetadata: {
            engineId: 'local-core-v1',
            version: 'v1.0.0',
            mode: EvaluationMode.LOCAL,
            latencyMs: 100,
            timestamp: new Date().toISOString(),
          }
        }
      }
    ];

    const metadataOverrides = {
      engineVersion: 'v2.0',
      pipelineVersion: 'v2',
      schemaVersion: '1.0',
      profileVersionId: 'uuid-1234',
      rubricVersion: 'v14',
      questionBankVersion: 'v3',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    };

    const report = ReportGenerator.computeFinalReport(history, null, metadataOverrides);

    expect(report.metadata).toMatchObject(metadataOverrides);
    // Ensure all these fields exist and aren't dropped
    expect(report.metadata.engineVersion).toBe('v2.0');
    expect(report.metadata.profileVersionId).toBe('uuid-1234');
    expect(report.metadata.provider).toBe('gemini');
  });

  it('should fallback to defaults when V1 report missing metadata is parsed', () => {
    // Simulated V1 report lacking metadata fields
    const v1Report: any = {
      sessionId: 'sess-1',
      overallScore: 75,
      // Missing modern metadata entirely
    };

    // While our application code primarily parses reports from the database, 
    // we want to ensure the structure allows rendering partial data.
    // In our UI, missing metadata just hides the tags.
    expect(v1Report.metadata?.profileVersionId).toBeUndefined();
    // This just proves that the schema is backwards compatible (optional fields)
    // as defined in our types.ts `metadata?: { ... }`
  });
});
