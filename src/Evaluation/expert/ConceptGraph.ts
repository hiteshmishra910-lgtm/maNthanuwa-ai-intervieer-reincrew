import { ExpertConcept, ExpertRubric } from './WeightedRubric';

/**
 * Concept graph for the expert engine.
 *
 * Builds a DAG from a weighted rubric: concepts are nodes (weighted), `prerequisites` and
 * `relatesTo` entries become directed edges. Analysis then answers the questions that matter
 * for an interview answer:
 *  - how much of the rubric's expected weight was actually demonstrated (weighted coverage),
 *  - how deep the candidate travelled down prerequisite chains (reached depth),
 *  - which prerequisites were skipped on the way to a demonstrated concept,
 *  - which expected relationships were evidenced vs left open.
 *
 * All functions are pure — the graph is derived data, so nothing here mutates shared state.
 */

export interface ConceptGraphEdge {
  from: string;
  to: string;
  relation: string;
  weight: number;
  kind: 'prerequisite' | 'relates';
}

export interface ConceptGraph {
  nodes: Map<string, ExpertConcept>;
  edges: ConceptGraphEdge[];
  adjacency: Map<string, string[]>;
  /** Direct prerequisite edges, as a map from a concept to the concept ids it requires. */
  prerequisites: Map<string, string[]>;
  roots: string[];
  maxDepth: number;
  totalWeight: number;
}

export interface ConceptGraphAnalysis {
  /** Sum of weights of matched concepts / total rubric weight. */
  weightedCoverage: number;
  /** Longest fully-matched path from a root (1-based depth of a single matched node). */
  reachedDepth: number;
  maxDepth: number;
  /** Concepts that were matched but whose prerequisites were not. */
  missedPrerequisites: { conceptId: string; missing: string[] }[];
  /** Expected relationships where both endpoints were matched. */
  validRelations: string[];
  /** Expected relationships where at least one endpoint was missing. */
  missedRelations: { relation: string; missing: string[] }[];
  /** Depth score 0..1 = reachedDepth / maxDepth (1 when graph has no edges). */
  depthRatio: number;
}

export function buildConceptGraph(rubric: ExpertRubric): ConceptGraph {
  const nodes = new Map<string, ExpertConcept>();
  const adjacency = new Map<string, string[]>();
  const prerequisites = new Map<string, string[]>();
  const edges: ConceptGraphEdge[] = [];
  let totalWeight = 0;

  for (const concept of rubric.concepts) {
    nodes.set(concept.id, concept);
    totalWeight += concept.weight;
  }

  for (const concept of rubric.concepts) {
    // Prerequisite edges (deduplicated).
    for (const prereqId of concept.prerequisites) {
      if (!nodes.has(prereqId)) continue;
      pushEdge(edges, adjacency, {
        from: prereqId,
        to: concept.id,
        relation: `${prereqId} -> ${concept.id}`,
        weight: concept.weight,
        kind: 'prerequisite',
      });
      const deps = prerequisites.get(concept.id) || [];
      if (!deps.includes(prereqId)) deps.push(prereqId);
      prerequisites.set(concept.id, deps);
    }

    // Relationship edges (weighted by concept weight).
    for (const rel of concept.relatesTo) {
      if (!nodes.has(rel.id)) continue;
      pushEdge(edges, adjacency, {
        from: rel.from || concept.id,
        to: rel.id,
        relation: rel.relation,
        weight: rel.weight,
        kind: 'relates',
      });
    }
  }

  const roots = Array.from(nodes.values())
    .filter(c => (prerequisites.get(c.id) || []).length === 0)
    .map(c => c.id);

  return {
    nodes,
    edges,
    adjacency,
    prerequisites,
    roots,
    maxDepth: computeMaxDepth(roots, prerequisites, new Set(nodes.keys())),
    totalWeight,
  };
}

function pushEdge(edges: ConceptGraphEdge[], adjacency: Map<string, string[]>, edge: ConceptGraphEdge): void {
  const existing = edges.find(
    e => e.from === edge.from && e.to === edge.to && e.kind === edge.kind,
  );
  if (existing) return;
  edges.push(edge);
  const adj = adjacency.get(edge.from) || [];
  adj.push(edge.to);
  adjacency.set(edge.from, adj);
}

export function analyzeConceptGraph(graph: ConceptGraph, matched: Set<string>): ConceptGraphAnalysis {
  const missedPrerequisites: { conceptId: string; missing: string[] }[] = [];
  for (const [conceptId, deps] of graph.prerequisites) {
    if (!matched.has(conceptId)) continue;
    const missing = deps.filter(d => !matched.has(d));
    if (missing.length > 0) missedPrerequisites.push({ conceptId, missing });
  }

  const validRelations: string[] = [];
  const missedRelations: { relation: string; missing: string[] }[] = [];
  for (const edge of graph.edges) {
    if (edge.kind !== 'relates') continue;
    const fromMatched = matched.has(edge.from);
    const toMatched = matched.has(edge.to);
    if (fromMatched && toMatched) {
      validRelations.push(edge.relation);
    } else {
      const missing: string[] = [];
      if (!fromMatched) missing.push(edge.from);
      if (!toMatched) missing.push(edge.to);
      missedRelations.push({ relation: edge.relation, missing });
    }
  }

  let coveredWeight = 0;
  for (const conceptId of matched) {
    const node = graph.nodes.get(conceptId);
    if (node) coveredWeight += node.weight;
  }
  const weightedCoverage = graph.totalWeight > 0 ? coveredWeight / graph.totalWeight : 0;

  const reachedDepth = computeReachedDepth(graph, matched);
  const depthRatio = graph.maxDepth > 0 ? reachedDepth / graph.maxDepth : 1;

  return {
    weightedCoverage,
    reachedDepth,
    maxDepth: graph.maxDepth,
    missedPrerequisites,
    validRelations,
    missedRelations,
    depthRatio,
  };
}

/**
 * Depth of the deepest fully-matched prerequisite path. A matched node's depth is
 * 1 + the max depth of its matched prerequisites; unmatched nodes contribute 0.
 */
function computeReachedDepth(graph: ConceptGraph, matched: Set<string>): number {
  const memo = new Map<string, number>();

  const depthOf = (id: string): number => {
    if (!matched.has(id)) return 0;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;

    const deps = graph.prerequisites.get(id) || [];
    let best = 0;
    for (const dep of deps) {
      best = Math.max(best, depthOf(dep));
    }
    const depth = best + 1;
    memo.set(id, depth);
    return depth;
  };

  let maxDepth = 0;
  for (const id of matched) {
    maxDepth = Math.max(maxDepth, depthOf(id));
  }
  return maxDepth;
}

function computeMaxDepth(roots: string[], prerequisites: Map<string, string[]>, allNodes: Set<string>): number {
  if (prerequisites.size === 0 || roots.length === 0) return 1;

  const memo = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    let best = 0;
    for (const [dependent, deps] of prerequisites) {
      if (deps.includes(id)) {
        best = Math.max(best, depthOf(dependent));
      }
    }
    const depth = best + 1;
    memo.set(id, depth);
    return depth;
  };

  let maxDepth = 0;
  for (const root of roots) {
    if (allNodes.has(root)) maxDepth = Math.max(maxDepth, depthOf(root));
  }
  return Math.max(1, maxDepth);
}
