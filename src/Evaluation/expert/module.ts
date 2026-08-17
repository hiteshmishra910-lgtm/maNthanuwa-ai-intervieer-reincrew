import { PipelineContext, EvaluationModule } from '../pipeline/interfaces';
import { EvaluationCore } from '../dispatch/EvaluationCore';
import { ExpertEvaluator } from './ExpertEvaluator';
import { ExpertMatchKind } from './SemanticMatcher';
import { ExpertDimension } from './WeightedRubric';

/**
 * ExpertEvaluationModule — optional bridge between the expert engine and the existing
 * heuristic pipeline.
 *
 * It is intentionally NOT part of the default module list: enabling it changes scoring
 * behaviour (extra concept evidence, extra misconception rules), so it must be opted into
 * explicitly with `ExpertEvaluationModule.install()`. When installed, it runs just before
 * `ScoreAggregator` and writes its findings into the shared `PipelineContext`:
 *   - `context.expert`  -> full expert analysis for downstream report/display,
 *   - matchedConcepts / conceptEvidence / conceptCompleteness -> concept evidence union,
 *   - technicalErrors  -> active misconception rules,
 *   - developerTrace / detectorConfidences -> diagnostics.
 */

const MATCH_KIND_TO_STRENGTH: Record<ExpertMatchKind, 'EXACT_ALIAS' | 'FUZZY_ALIAS' | 'STEM_MATCH' | 'PARTIAL_MATCH' | 'SEMANTIC_PATTERN'> = {
  lexical: 'EXACT_ALIAS',
  stem: 'STEM_MATCH',
  semantic: 'SEMANTIC_PATTERN',
  none: 'PARTIAL_MATCH',
};

export class ExpertEvaluationModule implements EvaluationModule {
  readonly name = 'ExpertEvaluationModule';

  execute(context: PipelineContext): void {
    try {
      const evaluation = ExpertEvaluator.evaluate({ question: context.question, answer: context.answer });
      context.expert = evaluation.analysis;

      for (const match of evaluation.analysis.concepts) {
        if (!match.matched) continue;

        context.matchedConcepts.add(match.conceptId);
        context.conceptEvidence.push({
          conceptId: match.conceptId,
          matchedAlias: match.matchedPhrases[0] || match.label,
          sentenceIndex: match.bestSentenceIndex,
          matchStrength: MATCH_KIND_TO_STRENGTH[match.matchKind],
          confidence: match.confidence,
        });

        const existing = context.conceptCompleteness.get(match.conceptId) || { satisfiedDimensions: [], completenessRatio: 0 };
        const dims = new Set<ExpertDimension>(existing.satisfiedDimensions as ExpertDimension[]);
        for (const dim of match.satisfiedDimensions) dims.add(dim);
        existing.satisfiedDimensions = Array.from(dims);
        const expected = new Set([...match.satisfiedDimensions, ...match.missingDimensions]);
        existing.completenessRatio =
          expected.size > 0
            ? Array.from(dims).filter(d => expected.has(d)).length / expected.size
            : match.matched ? 1 : 0;
        context.conceptCompleteness.set(match.conceptId, existing);
      }

      for (const hit of evaluation.misconceptionHits) {
        if (hit.negated) continue;
        const rule = evaluation.rubric.misconceptions.find(m => m.id === hit.misconceptionId);
        context.technicalErrors.push({
          ruleId: `expert_misconception_${hit.misconceptionId}`,
          matchedText: hit.triggerPhrase,
          expected: 'Correct technical principle',
          explanation: rule ? rule.explanation : hit.triggerPhrase,
          severity: rule
            ? rule.severity === 'critical' ? 'high' : rule.severity === 'moderate' ? 'medium' : 'low'
            : 'medium',
          penalty: rule ? rule.penalty : 1.0,
        });
      }

      context.detectorConfidences['expertEngine'] = 100;
      const matchedCount = evaluation.analysis.concepts.filter(c => c.matched).length;
      context.developerTrace.push(
        `ExpertEvaluationModule: ${matchedCount}/${evaluation.analysis.concepts.length} concepts matched, weightedTotal=${evaluation.analysis.scores.weightedTotal}.`,
      );
    } catch (err: any) {
      context.developerTrace.push(`ExpertEvaluationModule error: ${err?.message || String(err)}`);
    }
  }

  /** Install just before `ScoreAggregator` so its concept/misconception evidence feeds the scores. */
  static install(): void {
    const modules = EvaluationCore.getModules();
    if (modules.some(m => m.name === 'ExpertEvaluationModule')) return;
    const scoreIndex = modules.findIndex(m => m.name === 'ScoreAggregator');
    const instance = new ExpertEvaluationModule();
    if (scoreIndex === -1) modules.push(instance);
    else modules.splice(scoreIndex, 0, instance);
  }

  static uninstall(): void {
    const modules = EvaluationCore.getModules();
    const index = modules.findIndex(m => m.name === 'ExpertEvaluationModule');
    if (index !== -1) modules.splice(index, 1);
  }
}
