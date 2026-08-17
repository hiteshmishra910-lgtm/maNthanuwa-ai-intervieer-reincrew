import { determineVerdict } from '../../../shared/verdictPolicy';
import { ExpertDimension, ExpertImportance, ExpertRubric } from './WeightedRubric';
import { CoverageReport, ExpertConceptMatchSummary, ExpertFeedback, ExpertLanguageAnalysis, NegativeMark } from './types';

/**
 * Feedback generation — turns the expert engine's numeric outputs into human-readable,
 * evidence-grounded feedback:
 *  - `strengths`       — matched concepts + satisfied dimensions, evidenced relationships, language quality,
 *  - `weaknesses`      — every negative mark plus low language sub-scores / poor critical coverage,
 *  - `missingConcepts` — unmatched concepts ranked by importance then weight, with expected dimensions,
 *  - `suggestions`     — actionable next steps derived from the gaps.
 *
 * Pure and deterministic — every string is derived from the analysis objects, never from an LLM.
 */

export interface FeedbackInput {
  rubric: ExpertRubric;
  coverage: CoverageReport;
  summaries: ExpertConceptMatchSummary[];
  validRelations: string[];
  negativeMarks: NegativeMark[];
  language: ExpertLanguageAnalysis;
  positiveScore: number;
  negativePenalty: number;
  finalScore: number;
}

const DIMENSION_LABEL: Record<ExpertDimension, string> = {
  definition: 'definition',
  mechanism: 'mechanism',
  purpose: 'purpose',
  useCase: 'use cases',
  limitations: 'limitations',
  tradeoffs: 'trade-offs',
  alternatives: 'alternatives',
  failureCases: 'failure cases',
  dependencies: 'dependencies',
};

const TIER_RANK: Record<ExpertImportance, number> = {
  critical: 0,
  important: 1,
  supporting: 2,
  bonus: 3,
};

export function generateFeedback(input: FeedbackInput): ExpertFeedback {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  const matched = input.summaries.filter(s => s.matched);

  // ── Strengths ────────────────────────────────────────────────────────────────
  for (const summary of matched.slice(0, 3)) {
    const dims = summary.satisfiedDimensions.map(d => DIMENSION_LABEL[d]).filter(Boolean);
    strengths.push(
      dims.length > 0 ? `Explained ${summary.label} (${dims.join(', ')}).` : `Mentioned ${summary.label}.`,
    );
  }
  for (const relation of input.validRelations.slice(0, 2)) {
    strengths.push(`Correctly connected ${relation.replace(/\s*->\s*/g, ' to ')}.`);
  }
  if (input.language.grammar.score >= 9) strengths.push('Grammar and sentence structure were clean.');
  if (input.language.readability.score >= 7) strengths.push('The answer was easy to read and well-paced.');
  if (input.language.repetition.score === 10) strengths.push('No unnecessary repetition or filler words.');

  // ── Weaknesses ───────────────────────────────────────────────────────────────
  for (const mark of input.negativeMarks.slice(0, 4)) {
    weaknesses.push(mark.description);
  }
  if (input.language.grammar.score < 8 && input.language.grammar.issues.length > 0) {
    weaknesses.push('Several grammar issues reduce the clarity of the answer.');
  }
  if (input.language.readability.score < 6) {
    weaknesses.push('Sentences are long and hard to follow.');
  }
  if (input.language.repetition.score < 8) {
    weaknesses.push('The answer repeats itself or leans on filler words.');
  }
  const criticalTier = input.coverage.tiers.find(t => t.tier === 'critical');
  if (criticalTier && criticalTier.expectedConcepts > 0 && criticalTier.ratio < 0.5) {
    weaknesses.push('Most critical concepts were not covered.');
  }

  // ── Missing concepts (ranked critical-first, then by weight) ────────────────
  const unmatched = input.summaries
    .filter(s => !s.matched)
    .sort((a, b) => TIER_RANK[a.importance] - TIER_RANK[b.importance] || b.weight - a.weight);

  const missingConcepts = unmatched.slice(0, 6).map(summary => {
    const dims = summary.missingDimensions.map(d => DIMENSION_LABEL[d]).filter(Boolean);
    const detail = dims.length > 0 ? ` — expected: ${dims.join(', ')}` : '';
    return `${summary.label} (${summary.importance})${detail}`;
  });

  // ── Suggestions ──────────────────────────────────────────────────────────────
  for (const summary of unmatched.slice(0, 3)) {
    const dims = summary.missingDimensions.slice(0, 3).map(d => DIMENSION_LABEL[d]).filter(Boolean);
    suggestions.push(
      `Explain ${summary.label}, covering ${dims.length > 0 ? dims.join(', ') : 'at least a definition'}.`,
    );
  }
  if (matched.length === 0) suggestions.push('Start by defining the core concept of the question.');
  if (input.negativeMarks.some(m => m.source === 'contradiction')) {
    suggestions.push('Re-check statements for consistency — avoid contradicting earlier claims.');
  }
  if (input.language.readability.score < 6) {
    suggestions.push('Break long sentences into shorter, clearer ones.');
  }

  const verdict = determineVerdict(input.finalScore);
  const tone = input.finalScore >= 7 ? 'Strong answer' : input.finalScore >= 5 ? 'Competent but incomplete answer' : 'Weak answer';
  const summary = `${tone} — ${input.finalScore.toFixed(1)}/10 (${verdict}).`;

  return {
    summary,
    verdict,
    strengths,
    weaknesses,
    missingConcepts,
    suggestions,
    positiveScore: input.positiveScore,
    negativePenalty: input.negativePenalty,
    finalScore: input.finalScore,
  };
}
