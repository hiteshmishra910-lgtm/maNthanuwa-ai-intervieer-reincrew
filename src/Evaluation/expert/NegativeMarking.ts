import { Contradiction, NegativeMark, NegativeMarkSource } from './types';
import { ExpertRubric } from './WeightedRubric';
import { DomainRuleResult } from './types';

/**
 * Negative marking — every score deduction the engine applies, in one explainable list.
 *
 * Sources:
 *  - `misconception`  — un-negated misconception rules (penalty from the rubric rule),
 *  - `contradiction`  — internally contradictory claims (severity-mapped penalty),
 *  - `domain_rule`    — failed domain-pack expectations (e.g. discussed X without Y).
 *
 * `penalty` is the capped total actually deducted from the final weighted score;
 * `misconceptionPenalty` mirrors the legacy field (misconceptions only, legacy cap).
 */

export const MISCONCEPTION_PENALTY_CAP = 3.0;
export const NEGATIVE_PENALTY_CAP = 4.0;

const CONTRADICTION_SEVERITY_PENALTY: Record<Contradiction['severity'], number> = {
  high: 2.0,
  medium: 1.0,
  low: 0.5,
};

export interface MisconceptionHitInput {
  misconceptionId: string;
  triggerPhrase: string;
  negated: boolean;
}

export interface NegativeMarkingResult {
  negativeMarks: NegativeMark[];
  /** Capped total deduction applied to the weighted score. */
  penalty: number;
  /** Legacy misconception-only penalty (cap 3.0). */
  misconceptionPenalty: number;
  /** Uncapped sum for diagnostics. */
  rawPenalty: number;
}

export interface NegativeMarkingInput {
  misconceptionHits: MisconceptionHitInput[];
  rubric: ExpertRubric;
  contradictions: Contradiction[];
  domainRuleFailures: DomainRuleResult[];
}

export function computeNegativeMarks(input: NegativeMarkingInput): NegativeMarkingResult {
  const negativeMarks: NegativeMark[] = [];

  for (const hit of input.misconceptionHits) {
    if (hit.negated) continue;
    const rule = input.rubric.misconceptions.find(m => m.id === hit.misconceptionId);
    negativeMarks.push({
      id: `misconception_${hit.misconceptionId}`,
      source: 'misconception',
      description: rule ? rule.explanation : `Stated "${hit.triggerPhrase}", which contradicts the expected model.`,
      matchedText: hit.triggerPhrase,
      severity: rule ? severityToMark(rule.severity) : 'medium',
      penalty: rule ? rule.penalty : 1.0,
    });
  }

  for (const c of input.contradictions) {
    negativeMarks.push({
      id: `contradiction_${c.sentenceA}_${c.sentenceB}`,
      source: 'contradiction',
      description: c.explanation,
      severity: c.severity,
      penalty: CONTRADICTION_SEVERITY_PENALTY[c.severity],
    });
  }

  for (const failure of input.domainRuleFailures) {
    negativeMarks.push({
      id: `domain_rule_${failure.ruleId}`,
      source: 'domain_rule',
      description: failure.description,
      matchedText: failure.matchedTriggers[0],
      severity: failure.severity,
      penalty: failure.penalty,
    });
  }

  const bySource = (source: NegativeMarkSource) => negativeMarks.filter(m => m.source === source);

  const rawPenalty = round1(negativeMarks.reduce((sum, m) => sum + m.penalty, 0));
  const misconceptionPenalty = round1(
    Math.min(
      MISCONCEPTION_PENALTY_CAP,
      bySource('misconception').reduce((sum, m) => sum + m.penalty, 0),
    ),
  );
  const penalty = round1(Math.min(NEGATIVE_PENALTY_CAP, rawPenalty));

  return { negativeMarks, penalty, misconceptionPenalty, rawPenalty };
}

function severityToMark(severity: 'minor' | 'moderate' | 'critical'): NegativeMark['severity'] {
  if (severity === 'critical') return 'high';
  if (severity === 'moderate') return 'medium';
  return 'low';
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
