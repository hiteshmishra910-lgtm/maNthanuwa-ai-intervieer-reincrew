import { Question } from '../../../types';
import { EvaluationGraph, EvaluationGraphNode } from './interfaces';

export class RubricCompiler {
  private static cache = new Map<string, EvaluationGraph>();

  public static compile(question: Question): EvaluationGraph {
    const key = question.id ? String(question.id) : `q_raw_${hashString(question.question || '')}`;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const nodes = new Map<string, EvaluationGraphNode>();
    const expectedTradeoffs: string[] = [];
    const expectedExamples: string[] = [];
    const misconceptions: { id: string; trigger: string; severity: 'minor' | 'moderate' | 'critical'; explanation: string }[] = [];

    // Parse Rubric core concepts
    if (question.rubric) {
      (question.rubric.coreConcepts || []).forEach(cId => {
        nodes.set(cId, {
          conceptId: cId,
          importance: 'critical',
          weight: 4.0,
          prerequisites: [],
          expectedDimensions: ['definition', 'mechanism']
        });
      });

      (question.rubric.supportingConcepts || []).forEach(cId => {
        if (!nodes.has(cId)) {
          nodes.set(cId, {
            conceptId: cId,
            importance: 'supporting',
            weight: 2.0,
            prerequisites: [],
            expectedDimensions: ['definition', 'useCase']
          });
        }
      });
    }

    // Parse Knowledge Model
    if (question.knowledgeModel) {
      question.knowledgeModel.forEach(km => {
        const cId = km.conceptId;
        const importance: 'critical' | 'important' | 'supporting' | 'bonus' = (km as any).importance || 'important';
        const weightMap = { critical: 4.0, important: 3.0, supporting: 2.0, bonus: 1.0 };
        
        nodes.set(cId, {
          conceptId: cId,
          importance,
          weight: weightMap[importance] || 3.0,
          prerequisites: (km as any).prerequisites || [],
          expectedDimensions: ['definition', 'mechanism', 'purpose']
        });
      });
    }

    // Parse keyConcepts
    if (question.keyConcepts) {
      question.keyConcepts.forEach(kc => {
        const cId = kc.id || kc.concept.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        if (!nodes.has(cId)) {
          nodes.set(cId, {
            conceptId: cId,
            importance: (kc.importance as any) === 'high' ? 'critical' : 'important',
            weight: 3.5,
            prerequisites: [],
            expectedDimensions: ['definition', 'mechanism']
          });
        }
      });
    }

    // Fallback compilation from evaluationGuide
    if (nodes.size === 0 && question.evaluationGuide) {
      question.evaluationGuide.forEach((guide, idx) => {
        const cId = `concept_${idx}`;
        nodes.set(cId, {
          conceptId: cId,
          importance: idx === 0 ? 'critical' : 'important',
          weight: idx === 0 ? 4.0 : 3.0,
          prerequisites: idx > 0 ? [`concept_${idx - 1}`] : [],
          expectedDimensions: ['definition', 'mechanism']
        });
      });
    }

    const graph: EvaluationGraph = {
      questionId: key,
      nodes,
      expectedTradeoffs,
      expectedExamples,
      misconceptions
    };

    this.cache.set(key, graph);
    return graph;
  }

  public static clearCache() {
    this.cache.clear();
  }
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
