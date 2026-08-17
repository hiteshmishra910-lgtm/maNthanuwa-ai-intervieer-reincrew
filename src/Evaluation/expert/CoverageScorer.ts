import { ExpertRubric, ExpertImportance } from './WeightedRubric';
import { CoverageReport, ExpertConceptMatchSummary, TierCoverage } from './types';
import { ConceptGraph, ConceptGraphAnalysis } from './ConceptGraph';

/**
 * Coverage scoring for the expert engine.
 *
 * Produces the structured coverage report that drives `scores.conceptCoverage`:
 *  - `overall` — dimension-adjusted weighted coverage (sum of concept.weight * the share of
 *    expected dimensions actually satisfied), identical to the legacy single-number formula,
 *  - `tiers` — the same signal broken down by importance (critical / important / supporting / bonus),
 *  - `dimensionCoverage` — satisfied dimension weight / expected dimension weight,
 *  - `relationshipCoverage` — evidenced relationship edges / expected relationship edges.
 *
 * Pure function — derives everything from the rubric, match summaries and the concept graph.
 */

const TIER_ORDER: ExpertImportance[] = ['critical', 'important', 'supporting', 'bonus'];

interface TierAcc {
  expectedConcepts: number;
  matchedConcepts: number;
  expectedWeight: number;
  matchedWeight: number;
}

export function computeCoverage(
  summaries: ExpertConceptMatchSummary[],
  rubric: ExpertRubric,
  graph: ConceptGraph,
  graphAnalysis: ConceptGraphAnalysis,
): CoverageReport {
  const conceptById = new Map(rubric.concepts.map(c => [c.id, c]));
  const totalWeight = graph.totalWeight > 0
    ? graph.totalWeight
    : rubric.concepts.reduce((sum, c) => sum + c.weight, 0);

  const tierStats = new Map<ExpertImportance, TierAcc>();
  for (const tier of TIER_ORDER) {
    tierStats.set(tier, {
      expectedConcepts: 0,
      matchedConcepts: 0,
      expectedWeight: 0,
      matchedWeight: 0,
    });
  }

  let coveredWeight = 0;
  let satisfiedDimWeight = 0;
  let expectedDimWeight = 0;
  let matchedConceptCount = 0;

  for (const summary of summaries) {
    const concept = conceptById.get(summary.conceptId);
    if (!concept) continue;

    const tier = tierStats.get(concept.importance)!;
    tier.expectedConcepts += 1;
    tier.expectedWeight += concept.weight;
    if (!summary.matched) continue;

    tier.matchedConcepts += 1;
    tier.matchedWeight += concept.weight;
    matchedConceptCount += 1;

    const expectedDims = [...summary.satisfiedDimensions, ...summary.missingDimensions];
    if (expectedDims.length === 0) {
      coveredWeight += concept.weight;
      satisfiedDimWeight += concept.weight;
      expectedDimWeight += concept.weight;
      continue;
    }

    let sat = 0;
    let exp = 0;
    for (const dim of summary.satisfiedDimensions) sat += concept.dimensions[dim] ?? 0;
    for (const dim of summary.missingDimensions) exp += concept.dimensions[dim] ?? 0;
    const dimTotal = sat + exp;
    coveredWeight += concept.weight * (dimTotal > 0 ? sat / dimTotal : 0);
    satisfiedDimWeight += sat;
    expectedDimWeight += dimTotal;
  }

  const ratio = totalWeight > 0 ? coveredWeight / totalWeight : 0;
  const dimensionCoverage = matchedConceptCount > 0
    ? expectedDimWeight > 0 ? (satisfiedDimWeight / expectedDimWeight) * 10 : 10
    : 0;

  const relatesEdges = graph.edges.filter(e => e.kind === 'relates').length;
  const relationshipCoverage = relatesEdges > 0
    ? (graphAnalysis.validRelations.length / relatesEdges) * 10
    : 10;

  const tiers: TierCoverage[] = TIER_ORDER.map(tier => {
    const s = tierStats.get(tier)!;
    return {
      tier,
      expectedConcepts: s.expectedConcepts,
      matchedConcepts: s.matchedConcepts,
      expectedWeight: round3(s.expectedWeight),
      matchedWeight: round3(s.matchedWeight),
      ratio: s.expectedWeight > 0 ? round3(s.matchedWeight / s.expectedWeight) : 0,
    };
  });

  return {
    overall: round1(ratio * 10),
    ratio: round3(ratio),
    tiers,
    dimensionCoverage: round1(dimensionCoverage),
    relationshipCoverage: round1(relationshipCoverage),
    coveredWeight: round3(coveredWeight),
    totalWeight: round3(totalWeight),
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
