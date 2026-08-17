import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  EVIDENCE_DISCIPLINE_POLICY,
  RUBRIC_DIMENSIONS_POLICY,
} from '../shared/promptSafety';
import { buildBatchEvaluationPrompt } from '../shared/promptBuilder';

/**
 * Guards for the reported symptom: "across all three modes the feedback is generic — vague
 * summaries of unrelated concepts, and the scores do not reflect what the candidate actually
 * stated."
 *
 * The prompts already carried scoring bands and answer-type ceilings, so the gap was not a missing
 * rubric. It was a missing GROUNDING constraint. Both prompts inject `IDEAL/REFERENCE ANSWER`
 * beside the candidate's response with nothing restricting how it may be used, and a model asked
 * to describe "the concepts demonstrated" will happily describe the concepts in the exemplar,
 * because that is the most complete text in its context.
 *
 * These tests pin the grounding rules and their presence on every LLM evaluation path, so the
 * protection cannot be dropped from one mode while surviving in another.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('the grounding policy states the rules that matter', () => {
  it('forbids crediting anything that appears only in the reference answer', () => {
    expect(EVIDENCE_DISCIPLINE_POLICY).toMatch(/reference answer/i);
    expect(EVIDENCE_DISCIPLINE_POLICY).toMatch(/NOT a source of things to credit/i);
    expect(EVIDENCE_DISCIPLINE_POLICY).toMatch(/never.*attribute a concept that appears only in the reference answer/i);
  });

  it('requires verbatim spans rather than paraphrase for evidence', () => {
    expect(EVIDENCE_DISCIPLINE_POLICY).toMatch(/VERBATIM/);
    expect(EVIDENCE_DISCIPLINE_POLICY).toMatch(/not a paraphrase/i);
  });

  it('defines what to do when evidence is absent, instead of leaving it to inference', () => {
    // Without a stated consequence the model fills the gap with a plausible guess, which is the
    // hallucination this is meant to prevent.
    expect(EVIDENCE_DISCIPLINE_POLICY).toMatch(/Absence of evidence is not neutral/i);
    expect(EVIDENCE_DISCIPLINE_POLICY).toMatch(/scored low|score that dimension at the floor/i);
  });

  it('disqualifies fluency, confidence and length as evidence of knowledge', () => {
    expect(EVIDENCE_DISCIPLINE_POLICY).toMatch(/Do not reward fluency, confidence, length/i);
  });

  it('names all four recruiter-facing rubric dimensions and maps them to score fields', () => {
    for (const dimension of ['KNOWLEDGE', 'REASONING', 'PROBLEM SOLVING', 'COMMUNICATION']) {
      expect(RUBRIC_DIMENSIONS_POLICY).toContain(dimension);
    }
    // Each dimension must name the concrete schema fields it governs, otherwise the mapping is
    // decorative and the model still scores field-by-field with no defined meaning.
    for (const field of ['accuracy', 'reasoning', 'answerDirectnessScore', 'clarity']) {
      expect(RUBRIC_DIMENSIONS_POLICY).toContain(field);
    }
  });

  it('protects a speech-to-text transcript from being marked down for delivery', () => {
    // Communication must score the structure of the reasoning, not the accent or the filler words.
    expect(RUBRIC_DIMENSIONS_POLICY).toMatch(/NOT accent or speech-to-text filler words/i);
  });

  it('keeps dimensions independent so one strength cannot inflate the rest', () => {
    expect(RUBRIC_DIMENSIONS_POLICY).toMatch(/strength in one must not raise another/i);
  });
});

describe('every LLM evaluation path carries the grounding rules', () => {
  it('the HYBRID batch prompt includes both policies', () => {
    const { userPrompt } = buildBatchEvaluationPrompt({
      items: [{ question: 'Explain indexing.', answer: 'B-trees keep keys sorted.' } as any],
    });
    expect(userPrompt).toContain('EVIDENCE DISCIPLINE');
    expect(userPrompt).toContain('RUBRIC DIMENSIONS');
  });

  it('the HYBRID prompt additionally warns against cross-contamination between records', () => {
    // Unique to batch mode: records share one context, so a strong answer can bleed into the
    // assessment of a weak one.
    const { userPrompt } = buildBatchEvaluationPrompt({
      items: [{ question: 'Q1', answer: 'A1' } as any, { question: 'Q2', answer: 'A2' } as any],
    });
    // `\s+` rather than literal spaces: the prompt is a wrapped template literal, so any of these
    // gaps may be a newline.
    expect(userPrompt).toMatch(/never\s+credit\s+record\s+N\s+with\s+a\s+concept\s+that\s+was\s+explained\s+in\s+record\s+M/i);
  });

  it('both API-mode prompts include both policies', () => {
    const src = read('src/Core/api/apiService.ts');
    // submitAnswer and retryEvaluation. Both are live evaluation paths; retryEvaluation is what a
    // recruiter triggers to re-grade a failed answer, so it must apply identical standards.
    expect([...src.matchAll(/\$\{EVIDENCE_DISCIPLINE_POLICY\}/g)]).toHaveLength(2);
    expect([...src.matchAll(/\$\{RUBRIC_DIMENSIONS_POLICY\}/g)]).toHaveLength(2);
  });

  it('the edge-function copy is regenerated, not hand-edited', () => {
    // supabase/functions/_shared_generated is produced by scripts/sync-edge-shared.cjs. If the
    // generated copy drifts, the deployed hybrid worker silently runs a different prompt from the
    // one under test here.
    const source = read('shared/promptSafety.ts');
    const generated = read('supabase/functions/_shared_generated/promptSafety.ts');
    expect(generated).toContain('AUTO-GENERATED FILE');
    for (const marker of ['EVIDENCE DISCIPLINE', 'RUBRIC DIMENSIONS', 'VERBATIM']) {
      expect(source, `shared/ must define ${marker}`).toContain(marker);
      expect(generated, `generated copy is stale — run npm run sync-shared (${marker})`).toContain(marker);
    }
  });
});
