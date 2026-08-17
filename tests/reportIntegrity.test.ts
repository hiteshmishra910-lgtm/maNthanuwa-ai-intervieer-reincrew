import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { hasStoredEvaluation } from '../src/Analytics/components/EvaluationUnavailable';

/**
 * PHASES 9 & 12 regression guards.
 *
 * PHASE 9 — the candidate view (CompletedInterviews) and the recruiter view (HRDashboard) both
 * responded to a missing `evaluation_logic` by fabricating a complete report from constants:
 *   technicalScore: overall_score || 50   (invented 50/100; `||` also turned a genuine 0 into 50)
 *   trustScore: 100 - (risk_score || 0)   (100 = flawless integrity)
 *   reportConfidence: 'Medium'            (hardcoded)
 *   proctoringSummary: all zeros          (a clean record, fabricated)
 * It rendered identically to a real report with no indication anything was missing. In production
 * 85 of 122 sessions have overall_score = NULL, so this fired for most data.
 *
 * PHASE 12 — useSpeech kept only the normalized transcript, discarding the verbatim text, so
 * there was no record of what a candidate actually said once speechDictionary had rewritten it.
 * The low-confidence logger was also inverted: it fired only when normalization changed nothing.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/**
 * Strip comments before asserting. The fixes document the exact strings they removed (e.g.
 * "overall_score || 50") in explanatory comments, so a naive substring check would match the
 * comment describing the bug rather than the bug itself.
 */
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1');  // line comments (not URLs)

describe('Phase 9: reports are never fabricated', () => {
  it('treats null, undefined and an empty object as "no evaluation"', () => {
    expect(hasStoredEvaluation(null)).toBe(false);
    expect(hasStoredEvaluation(undefined)).toBe(false);
    expect(hasStoredEvaluation({})).toBe(false);
    // An upsert that wrote {} would pass a plain truthiness check and render a report whose
    // every field is undefined — which is why this checks key count, not truthiness.
    expect(hasStoredEvaluation({ evaluation_logic: {} })).toBe(false);
    expect(hasStoredEvaluation({ evaluation_logic: null })).toBe(false);
  });

  it('recognises a real stored evaluation', () => {
    expect(hasStoredEvaluation({ evaluation_logic: { executiveSummary: { technicalScore: 72 } } })).toBe(true);
  });

  it.each([
    ['src/candidate/components/CompletedInterviews.tsx', 'candidate view'],
    ['src/HR/components/HRDashboard.tsx', 'recruiter view'],
  ])('%s no longer fabricates a report', (file) => {
    const src = code(file);
    // The exact fabrications that shipped.
    expect(src).not.toContain('overall_score || 50');
    expect(src).not.toMatch(/reportConfidence:\s*'Medium'\s*as\s*const/);
    // And it must route through the shared guard instead.
    expect(src).toContain('hasStoredEvaluation');
    expect(src).toContain('EvaluationUnavailable');
  });

  it('the empty state renders no numeric score at all', () => {
    const src = code('src/Analytics/components/EvaluationUnavailable.tsx');
    // Showing 0 would assert "the candidate scored zero" — a different but equally wrong claim
    // than the fabricated 50 this replaced.
    expect(src).not.toMatch(/technicalScore/);
    expect(src).not.toMatch(/trustScore/);
    expect(src).not.toMatch(/proctoringSummary/);
  });

  it('both views share one guard so they cannot drift apart again', () => {
    const candidate = read('src/candidate/components/CompletedInterviews.tsx');
    const recruiter = read('src/HR/components/HRDashboard.tsx');
    for (const src of [candidate, recruiter]) {
      expect(src).toContain("from '../../Analytics/components/EvaluationUnavailable'");
    }
  });
});

describe('Phase 12: the verbatim transcript is retained', () => {
  const src = read('src/Interview/hooks/useSpeech.ts');
  const srcCode = code('src/Interview/hooks/useSpeech.ts');

  it('captures raw text alongside the normalized text', () => {
    expect(src).toContain('rawTranscriptRef');
    expect(src).toContain('rawFinalChunksRef');
    expect(src).toContain('newRawFinal += rawText');
  });

  it('exposes the raw transcript to callers', () => {
    expect(src).toMatch(/getRawTranscript:\s*\(\)\s*=>\s*rawTranscriptRef\.current/);
  });

  it('keeps raw and normalized chunk arrays index-aligned', () => {
    // Both must be pushed in the same block, or the Nth raw chunk stops corresponding to the
    // Nth normalized chunk and the audit trail becomes misleading.
    expect(src).toMatch(/finalChunksRef\.current\.push[\s\S]{0,300}rawFinalChunksRef\.current\.push/);
  });

  it('resets the raw transcript wherever the normalized one is reset', () => {
    const normalizedResets = (src.match(/finalTranscriptRef\.current = ''/g) || []).length;
    const rawResets = (src.match(/rawTranscriptRef\.current = ''/g) || []).length;
    // A missed reset would leak a previous answer's words into the next question.
    expect(rawResets).toBe(normalizedResets);
  });

  it('no longer logs low confidence only when normalization changed nothing', () => {
    // The old guard was `if (normalized.toLowerCase() === rawText.toLowerCase())`, which skipped
    // exactly the case worth recording: a dictionary rewrite applied to shaky audio.
    expect(srcCode).not.toMatch(/normalized\.toLowerCase\(\)\s*===\s*rawText\.toLowerCase\(\)/);
    expect(src).toContain('logLowConfidenceSTT(rawText, normalized, confidence');
  });
});
