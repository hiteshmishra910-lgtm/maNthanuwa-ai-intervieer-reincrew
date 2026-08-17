import { Question, QuestionType } from '../../../types';
import { DomainPack, DomainRule, EVALUATION_PROFILES_REGISTRY } from '../pipeline/interfaces';
import { CONCEPT_REGISTRY } from '../pipeline/ConceptRegistry';

/**
 * Weighted rubric model + compiler for the expert engine.
 *
 * The existing `RubricCompiler` produces flat concept nodes with a coarse weight map
 * (critical=4.0 ... bonus=1.0) and no per-dimension weighting. This model is richer:
 *  - each concept carries a normalised weight (importance-derived, summing to 1 across rubric),
 *  - each concept carries per-dimension weights (definition/mechanism/purpose/useCase/...),
 *  - explicit weighted `relatesTo` edges feed the concept graph,
 *  - misconception rules carry a concrete score penalty.
 *
 * `compileWeightedRubric` merges every authoritative source the codebase already understands:
 * knowledgeModel, V3 rubric, keyConcepts, evaluationGuide, and optional domain packs.
 */

export type ExpertImportance = 'critical' | 'important' | 'supporting' | 'bonus';

export type ExpertDimension =
  | 'definition'
  | 'mechanism'
  | 'purpose'
  | 'useCase'
  | 'limitations'
  | 'tradeoffs'
  | 'alternatives'
  | 'failureCases'
  | 'dependencies';

export const ALL_DIMENSIONS: ExpertDimension[] = [
  'definition', 'mechanism', 'purpose', 'useCase', 'limitations',
  'tradeoffs', 'alternatives', 'failureCases', 'dependencies',
];

export type ExpertDimensionWeights = Record<ExpertDimension, number>;

export interface ExpertConcept {
  id: string;
  label: string;
  aliases: string[];
  importance: ExpertImportance;
  /** Relative importance of the concept within the rubric; sum across concepts = 1. */
  weight: number;
  prerequisites: string[];
  relatesTo: { from?: string; id: string; relation: string; weight: number }[];
  /** Per-dimension relative weights; only non-zero dimensions are expected. */
  dimensions: ExpertDimensionWeights;
}

export interface ExpertMisconception {
  id: string;
  triggerPhrases: string[];
  severity: 'minor' | 'moderate' | 'critical';
  /** Human-readable explanation surfaced in reports. */
  explanation: string;
  /** Penalty in 0-10 score space. */
  penalty: number;
}

export interface ExpertRubric {
  version: string;
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  concepts: ExpertConcept[];
  misconceptions: ExpertMisconception[];
  expectedExamples: string[];
  expectedTradeoffs: string[];
  /** Domain packs that contributed to this rubric. */
  domains: string[];
  /** Topic-specific rules from the domain packs (evaluated by the domain-rules pass). */
  domainRules: DomainRule[];
  idealAnswer?: string;
}

export interface WeightedRubricOptions {
  questionType?: QuestionType;
  domainPacks?: DomainPack[];
  version?: string;
}

const IMPORTANCE_BASE_WEIGHT: Record<ExpertImportance, number> = {
  critical: 1.0,
  important: 0.65,
  supporting: 0.4,
  bonus: 0.22,
};

const DIMENSION_BASE_WEIGHTS: ExpertDimensionWeights = {
  definition: 0.32,
  mechanism: 0.24,
  purpose: 0.14,
  useCase: 0.10,
  limitations: 0.07,
  tradeoffs: 0.06,
  alternatives: 0.03,
  failureCases: 0.02,
  dependencies: 0.02,
};

/** Dimensions that matter for every question regardless of the profile. */
const ALWAYS_EXPECTED: ExpertDimension[] = ['definition', 'mechanism'];

const RUBRIC_CACHE = new Map<string, ExpertRubric>();

export function compileWeightedRubric(question: Question, options: WeightedRubricOptions = {}): ExpertRubric {
  const questionType = options.questionType || detectQuestionType(question);
  const cacheKey = `${String(question.id)}::${questionType}::${options.version || 'v1'}`;
  const cached = RUBRIC_CACHE.get(cacheKey);
  if (cached) return cached;

  const rubric = buildRubric(question, questionType, options);
  RUBRIC_CACHE.set(cacheKey, rubric);
  return rubric;
}

export function clearWeightedRubricCache(): void {
  RUBRIC_CACHE.clear();
}

function buildRubric(question: Question, questionType: QuestionType, options: WeightedRubricOptions): ExpertRubric {
  const concepts = new Map<string, ExpertConcept>();
  const misconceptions: ExpertMisconception[] = [];
  const expectedExamples: string[] = [];
  const expectedTradeoffs: string[] = [];
  const domains: string[] = [];
  const domainRules: DomainRule[] = [];

  // ── 1. knowledgeModel (richest source) ────────────────────────────────────
  for (const km of question.knowledgeModel || []) {
    const id = km.conceptId;
    const registry = CONCEPT_REGISTRY[id];
    const base: ExpertConcept = getOrCreate(concepts, id, id.replace(/_/g, ' '));
    base.aliases = registry ? registry.aliases || [] : [];
    base.dimensions = dimensionsFromExpectation(km.expected, questionType);
    base.importance = 'important';
    for (const rel of km.relationships || []) {
      const [from, to] = rel.split('->').map(s => s.trim());
      if (from && to) {
        base.relatesTo.push({ from, id: to, relation: rel, weight: 0.5 });
      }
    }
    for (const mistake of km.commonMistakes || []) {
      misconceptions.push({
        id: `km_misconception_${id}_${mistake.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        triggerPhrases: [mistake],
        severity: 'moderate',
        explanation: `Stated "${mistake}", which contradicts the expected model for ${id.replace(/_/g, ' ')}.`,
        penalty: 1.5,
      });
    }
  }

  // ── 2. V3 rubric (explicit concept lists + synonym groups) ────────────────
  const v3 = question.rubric;
  if (v3) {
    for (const cId of v3.coreConcepts || []) {
      const c = getOrCreate(concepts, cId, cId.replace(/_/g, ' '));
      c.importance = 'critical';
      c.aliases = mergeAliases(c.aliases, v3.synonymGroups?.[cId]);
    }
    for (const cId of v3.supportingConcepts || []) {
      const c = getOrCreate(concepts, cId, cId.replace(/_/g, ' '));
      if (c.importance === 'important') c.importance = 'supporting';
      c.aliases = mergeAliases(c.aliases, v3.synonymGroups?.[cId]);
    }
    if (v3.misconceptions) {
      v3.misconceptions.forEach((text, i) => {
        misconceptions.push({
          id: `rubric_misconception_${i}`,
          triggerPhrases: [text],
          severity: 'moderate',
          explanation: text,
          penalty: 1.5,
        });
      });
    }
  }

  // ── 3. keyConcepts (per-concept aliases + explicit importance) ─────────────
  for (const kc of question.keyConcepts || []) {
    const id = kc.id || kc.concept.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const c = getOrCreate(concepts, id, kc.concept);
    c.importance = normalizeImportance(kc.importance);
    c.aliases = mergeAliases(c.aliases, kc.aliases);
  }

  // ── 4. evaluationGuide fallback (schema-less questions) ───────────────────
  if (concepts.size === 0 && question.evaluationGuide && question.evaluationGuide.length > 0) {
    question.evaluationGuide.forEach((guide, idx) => {
      const id = `concept_${idx}`;
      concepts.set(id, {
        id,
        label: guide,
        aliases: [guide],
        importance: idx === 0 ? 'critical' : 'important',
        weight: 0,
        prerequisites: idx > 0 ? [`concept_${idx - 1}`] : [],
        relatesTo: [],
        dimensions: defaultDimensions(questionType),
      });
    });
  }

  // ── 5. Domain packs (cross-domain surface + misconception rules + topic rules) ──
  for (const pack of options.domainPacks || []) {
    for (const dc of pack.concepts || []) {
      const id = dc.id;
      const c = getOrCreate(concepts, id, id.replace(/_/g, ' '));
      c.importance = normalizeImportance(dc.importance);
      c.aliases = mergeAliases(c.aliases, dc.aliases);
    }
    for (const dm of pack.misconceptions || []) {
      misconceptions.push({
        id: `domain_${pack.domain}_${dm.id}`,
        triggerPhrases: dm.keywords || [],
        severity: dm.severity,
        explanation: dm.explanation,
        penalty: dm.severity === 'critical' ? 2.5 : dm.severity === 'moderate' ? 1.5 : 0.5,
      });
    }
    for (const rule of pack.rules || []) {
      domainRules.push({ ...rule, domain: pack.domain });
    }
    domains.push(pack.domain);
  }

  // ── 6. ideal answer / examples / tradeoffs ────────────────────────────────
  const idealAnswer = question.ideal_answer || question.answer;
  if (question.evaluationGuide) {
    // Keep first four guide items as expected example phrases.
    expectedExamples.push(...question.evaluationGuide.slice(0, 4));
  }
  if (Array.isArray((question as any).expectedTradeoffs)) {
    expectedTradeoffs.push(...(question as any).expectedTradeoffs);
  }

  // ── 7. Normalise concept weights so they sum to 1 ─────────────────────────
  const list = Array.from(concepts.values());
  const rawTotal = list.reduce((sum, c) => sum + IMPORTANCE_BASE_WEIGHT[c.importance], 0);
  for (const c of list) {
    c.weight = rawTotal > 0 ? IMPORTANCE_BASE_WEIGHT[c.importance] / rawTotal : 0;
  }

  const rubric: ExpertRubric = {
    version: options.version || 'expert-rubric-v1',
    questionId: String(question.id),
    questionText: question.question || '',
    questionType,
    concepts: list,
    misconceptions,
    expectedExamples,
    expectedTradeoffs,
    domains,
    domainRules,
    idealAnswer,
  };

  return rubric;
}

function getOrCreate(concepts: Map<string, ExpertConcept>, id: string, label: string): ExpertConcept {
  const existing = concepts.get(id);
  if (existing) return existing;
  const created: ExpertConcept = {
    id,
    label,
    aliases: [],
    importance: 'important',
    weight: 0,
    prerequisites: [],
    relatesTo: [],
    dimensions: defaultDimensions('Technical'),
  };
  concepts.set(id, created);
  return created;
}

function mergeAliases(current: string[], extra?: string[]): string[] {
  if (!extra || extra.length === 0) return current;
  const seen = new Set(current.map(a => a.toLowerCase()));
  const merged = [...current];
  for (const alias of extra) {
    const key = alias.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(alias);
    }
  }
  return merged;
}

function dimensionsFromExpectation(
  expected: { [k: string]: boolean } | undefined,
  questionType: QuestionType,
): ExpertDimensionWeights {
  const dims = defaultDimensions(questionType);
  for (const dim of ALL_DIMENSIONS) {
    if (expected && expected[dim] === true) {
      dims[dim] = DIMENSION_BASE_WEIGHTS[dim];
    }
  }
  return normalizeDimensions(dims);
}

function defaultDimensions(questionType: QuestionType): ExpertDimensionWeights {
  const profile = EVALUATION_PROFILES_REGISTRY[questionType];
  const dims = { ...DIMENSION_BASE_WEIGHTS };
  for (const dim of ALL_DIMENSIONS) {
    if (!ALWAYS_EXPECTED.includes(dim) && !(profile && profile.requiredDimensions.includes(dim))) {
      dims[dim] = DIMENSION_BASE_WEIGHTS[dim] * 0.15;
    }
  }
  return normalizeDimensions(dims);
}

function normalizeDimensions(dims: ExpertDimensionWeights): ExpertDimensionWeights {
  let sum = 0;
  for (const dim of ALL_DIMENSIONS) sum += dims[dim];
  if (sum === 0) {
    return { ...DIMENSION_BASE_WEIGHTS };
  }
  const out = {} as ExpertDimensionWeights;
  for (const dim of ALL_DIMENSIONS) out[dim] = Math.round((dims[dim] / sum) * 1000) / 1000;
  return out;
}

function normalizeImportance(value?: string): ExpertImportance {
  const v = (value || '').toLowerCase().trim();
  if (v === 'critical' || v === 'high') return 'critical';
  if (v === 'supporting' || v === 'nice to have' || v === 'nice-to-have' || v === 'nice') return 'supporting';
  if (v === 'bonus') return 'bonus';
  return 'important';
}

/** Fallback question-type detection matching EvaluationCore's heuristics. */
export function detectQuestionType(question: Question): QuestionType {
  const explicit = (question as any).questionType;
  if (explicit && EVALUATION_PROFILES_REGISTRY[explicit as QuestionType]) {
    return explicit as QuestionType;
  }
  const textLower = (question.question || '').toLowerCase();

  if (textLower.includes('difference between') || textLower.includes(' vs ') || textLower.includes('versus') || textLower.includes('compare')) return 'Comparison';
  if (textLower.includes('design') || textLower.includes('architecture') || textLower.includes('scale')) return 'Architecture';
  if (textLower.includes('why use') || textLower.includes('tradeoff') || textLower.includes('trade-off') || textLower.includes('advantage') || textLower.includes('limitation')) return 'Tradeoff';
  if (textLower.includes('scenario') || textLower.includes('what would you do') || textLower.includes('situation')) return 'Scenario';
  if (textLower.includes('debug') || textLower.includes('fix') || textLower.includes('broken')) return 'Debugging';
  if (textLower.includes('tell me about') || textLower.includes('describe a time') || textLower.includes('introduce yourself') || textLower.includes('background') || textLower.includes('experience') || textLower.includes('strength') || textLower.includes('weakness') || textLower.includes('motivation') || textLower.includes('project') || textLower.includes('hr')) return 'HR';
  if (textLower.includes('what is') || textLower.includes('define') || textLower.includes('explain')) return 'Definition';
  return 'Technical';
}
