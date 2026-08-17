import { PipelineContext, EvaluationModule } from './interfaces';
import {
  classifyAnswerSubstance,
  computeOpenEndedFactsScore,
  computeSubstanceBasedCommunicationStart,
  computeEvidenceBasedConfidenceStart,
  computeEvidenceBasedReasoningStart,
  applyUnifiedScoringPolicy,
} from '../../../shared/evaluationScoringPolicy';

/**
 * Ceiling applied when a candidate demonstrates none of a question's expected concepts.
 * 3.0/10 -> 30/100, comfortably inside the Reject band, while still ranking such answers above
 * an explicit non-answer (which the Honest Unknown override forces to 0).
 *
 * PASS 2 / FINDING 1C: hoisted to module scope so Score Gravity can derive its own trigger from
 * this exact value. Previously the gate capped at 3.0 while gravity only engaged at <= 2.0, so
 * `3.0 <= 2.0` was false and gravity never fired for the answers it exists to catch. Keeping one
 * constant means the two cannot drift apart again.
 */
export const KNOWLEDGE_GATE_CAP = 3.0;

export class ScoreAggregator implements EvaluationModule {
  readonly name = 'ScoreAggregator';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting ScoreAggregator...');

    // ─── PRE-COMPUTE SUBSTANCE ANALYSIS ─────────────────────────────────────
    const rawText = context.answer || (context as any).transcript || (context.tokens ? context.tokens.join(' ') : '');

    // Detect open-ended / introductory / behavioral questions
    const questionTypeStr = String(context.question.type || '').toLowerCase();
    const questionCategoryStr = String((context.question as any).interviewCategory || '').toLowerCase();
    const pipelineTypeStr = String((context.question as any).questionType || context.questionType || '').toLowerCase();
    const textLowerStr = String(context.question.question || '').toLowerCase();
    const isOpenEnded =
      questionTypeStr.includes('behavioral') ||
      questionTypeStr.includes('introduction') ||
      pipelineTypeStr === 'hr' ||
      pipelineTypeStr === 'introductory' ||
      pipelineTypeStr === 'scenario' ||
      /tell me about|introduce|background|experience|project|situation|strength|weakness|non-technical|explain a|describe a/i.test(textLowerStr) ||
      ['introduction', 'communication', 'behavioral', 'project', 'situational'].includes(questionCategoryStr);

    const substance = classifyAnswerSubstance(rawText, context.conceptEvidence.length, isOpenEnded, context.questionSatisfaction);
    context.developerTrace.push(
      `Substance analysis: words=${substance.wordCount}, sentences=${substance.sentenceCount}, ` +
      `fragment=${substance.isFragment}, evidence=${substance.evidenceCount}, ` +
      `STAR=${substance.starCoverage}/4, factor=${substance.substanceFactor}`
    );

    // ─── 1. TECHNICAL ACCURACY ───────────────────────────────────────────────
    // Facts Score (base correctness of matched assertions)
    let factsScore = 0;
    
    // V3: Calculate based on conceptEvidence and rubric
    if (context.question.rubric) {
      const coreConcepts = context.question.rubric.coreConcepts || [];
      const supportingConcepts = context.question.rubric.supportingConcepts || [];
      
      let coreMatched = 0;
      let supportingMatched = 0;

      context.conceptEvidence.forEach(ev => {
        if (coreConcepts.includes(ev.conceptId)) coreMatched++;
        else if (supportingConcepts.includes(ev.conceptId)) supportingMatched++;
      });

      const coreRatio = coreConcepts.length > 0 ? Math.min(1.0, coreMatched / coreConcepts.length) : 1.0;

      if (supportingConcepts.length > 0) {
        const supportingRatio = Math.min(1.0, supportingMatched / supportingConcepts.length);
        factsScore = (coreRatio * 8.5) + (supportingRatio * 1.5);
      } else {
        factsScore = coreRatio * 10.0;
      }
    } 
    // Legacy calculation
    else if (context.matchedConcepts.size > 0) {
      let totalRatio = 0;
      context.matchedConcepts.forEach(conceptId => {
        const comp = context.conceptCompleteness.get(conceptId);
        totalRatio += comp ? comp.completenessRatio : 0;
      });
      const avgCompleteness = totalRatio / context.matchedConcepts.size;
      factsScore = 2.0 + (avgCompleteness * 8.0);
    }

    // Fallback-mode: when concept matching produces no factsScore
    const hasKnowledgeModel = context.question.knowledgeModel && context.question.knowledgeModel.length > 0;
    const hasRubric = !!context.question.rubric;
    let factualBaselineSuppressed = false;

    if (factsScore === 0) {
      if (isOpenEnded) {
        const sat = context.questionSatisfaction || 'YES';
        factsScore = computeOpenEndedFactsScore(sat, context.relevantContentRatio || 0.5, substance);
        context.developerTrace.push(
          `Fallback Floor: open-ended question satisfied intent. factsScore=${factsScore.toFixed(1)} (substanceFactor=${substance.substanceFactor}).`
        );
      } else if (!hasKnowledgeModel && !hasRubric) {
        factualBaselineSuppressed = true;
        context.developerTrace.push(
          'Fallback Floor SUPPRESSED: question is technical but has no knowledgeModel/rubric. ' +
          'A coherent non-answer must not earn a factual baseline.'
        );
      }
    }
    
    // Misconceptions Score (rules deductions)
    let misconceptionsPenalty = 0;
    if (context.question.rubric && context.misconceptionEvidence && context.misconceptionEvidence.length > 0) {
      context.misconceptionEvidence.forEach(ev => {
        if (!ev.negated) misconceptionsPenalty += 1.5; // V3 Penalty
      });
    } else {
      // Legacy
      for (const error of context.technicalErrors) {
        if (error.ruleId.startsWith('misconception_')) {
          misconceptionsPenalty += error.penalty;
        }
      }
    }

    // Reduce penalty if candidate self-corrected
    if (context.selfCorrectionsCount > 0) {
      misconceptionsPenalty = Math.max(0, misconceptionsPenalty - (context.selfCorrectionsCount * 1.5));
    }

    // Bound misconception penalty to maximum of 3.0 points (30%)
    misconceptionsPenalty = Math.min(3.0, misconceptionsPenalty);
    const misconceptionsScore = Math.max(0, 10 - misconceptionsPenalty * 3.33); // scale 3.0 to 10 points

    // Question Satisfaction Score
    let questionSatisfactionScore = 10;
    const satisfaction = context.questionSatisfaction || 'YES';
    if (satisfaction === 'PARTIAL') {
      questionSatisfactionScore = 5.0;
    } else if (satisfaction === 'NO') {
      questionSatisfactionScore = 0.0;
    }

    // Relevance Score
    const relevanceScore = Math.round(context.relevantContentRatio * 100) / 10;

    // Completeness Score
    let completenessRatio = 0;
    if (context.question.rubric) {
      const coreConcepts = context.question.rubric.coreConcepts || [];
      const coreMatched = new Set(context.conceptEvidence.filter(ev => coreConcepts.includes(ev.conceptId)).map(ev => ev.conceptId)).size;
      completenessRatio = coreConcepts.length > 0 ? coreMatched / coreConcepts.length : 1.0;
    } else if (context.question.knowledgeModel && context.question.knowledgeModel.length > 0) {
      let expectedCount = 0;
      let explainedCount = 0;
      context.question.knowledgeModel.forEach(expectedConcept => {
        expectedCount++;
        const completeness = context.conceptCompleteness.get(expectedConcept.conceptId);
        if (completeness && completeness.completenessRatio >= 0.5) {
          explainedCount++;
        }
      });
      completenessRatio = expectedCount > 0 ? Math.min(1.0, explainedCount / expectedCount) : 0;
    } else {
      // Fallback
      const expectedCount = context.question.evaluationGuide?.length || 1;
      const explainedCount = context.matchedConcepts.size;
      completenessRatio = expectedCount > 0 ? Math.min(1.0, explainedCount / expectedCount) : (isOpenEnded ? 0.7 : 0);
    }
    
    const completenessScore = Math.round(completenessRatio * 100) / 10;
    context.explanationCompletenessPercent = Math.round(completenessRatio * 100);

    // Calculate aggregated Technical Accuracy Score (weighted)
    // Facts: 30%, Misconceptions: 25%, Satisfaction: 20%, Relevance: 15%, Completeness: 10%
    let aggregatedAccuracy =
      (factsScore * 0.30) +
      (misconceptionsScore * 0.25) +
      (questionSatisfactionScore * 0.20) +
      (relevanceScore * 0.15) +
      (completenessScore * 0.10);

    // ─── KNOWLEDGE GATE ──────────────────────────────────────────────────────
    const expectedConceptCount =
      (context.question.rubric?.coreConcepts?.length || 0) +
      (context.question.knowledgeModel?.length || 0);
    const demonstratedConceptCount =
      context.conceptEvidence.length > 0 ? context.conceptEvidence.length : context.matchedConcepts.size;

    // Knowledge Gate applies strictly to technical questions, not open-ended/HR questions
    const demonstratedNothing =
      !isOpenEnded &&
      ((expectedConceptCount > 0 && demonstratedConceptCount === 0 && completenessRatio === 0) ||
      (factualBaselineSuppressed && demonstratedConceptCount === 0));

    if (demonstratedNothing) {
      if (aggregatedAccuracy > KNOWLEDGE_GATE_CAP) {
        context.developerTrace.push(
          `Knowledge Gate: 0 of ${expectedConceptCount} expected concepts demonstrated on technical question. ` +
          `Capping accuracy ${aggregatedAccuracy.toFixed(2)} -> ${KNOWLEDGE_GATE_CAP}.`
        );
        aggregatedAccuracy = KNOWLEDGE_GATE_CAP;
      }
    }

    context.technicalAccuracyScore = Math.round(Math.max(0, Math.min(10, aggregatedAccuracy)) * 10) / 10;
    context.technicalAccuracyBreakdown = {
      factsScore,
      questionSatisfactionScore,
      misconceptionsScore: Math.round(misconceptionsScore * 10) / 10,
      completenessScore,
      relevanceScore
    };

    // ─── 2. CONCEPT UNDERSTANDING ──────────────────────────────────────────
    let totalExpectedDimensions = 0;
    let satisfiedExpectedDimensions = 0;

    if (context.question.knowledgeModel && context.question.knowledgeModel.length > 0) {
      context.question.knowledgeModel.forEach(expectedConcept => {
        const dims = expectedConcept.expected;
        const keys: ('definition' | 'mechanism' | 'purpose' | 'useCase' | 'limitations' | 'tradeoffs' | 'alternatives' | 'failureCases' | 'dependencies')[] = [
          'definition', 'mechanism', 'purpose', 'useCase', 'limitations', 'tradeoffs', 'alternatives', 'failureCases', 'dependencies'
        ];
        
        keys.forEach(k => {
          if (dims[k]) {
            totalExpectedDimensions++;
            const comp = context.conceptCompleteness.get(expectedConcept.conceptId);
            if (comp?.satisfiedDimensions.includes(k)) {
              satisfiedExpectedDimensions++;
            }
          }
        });
      });
    } else {
      // Fallback
      totalExpectedDimensions = (context.question.evaluationGuide?.length || 1) * 2;
      satisfiedExpectedDimensions = context.matchedConcepts.size * 1.5;
    }

    const understandingRatio = totalExpectedDimensions > 0 ? satisfiedExpectedDimensions / totalExpectedDimensions : 0;
    const totalPrereqs = context.reachedDepth.length + context.missedDependencies.length;
    const prereqRatio = totalPrereqs > 0 ? context.reachedDepth.length / totalPrereqs : 1.0;
    
    const aggregatedUnderstanding = (understandingRatio * 0.70) + (prereqRatio * 0.30);
    context.conceptUnderstandingScore = Math.round(Math.max(0, Math.min(10, aggregatedUnderstanding * 10)) * 10) / 10;

    // ─── 3. REASONING & PROBLEM SOLVING ─────────────────────────────────────
    // SCORING RIGOR FIX: Reasoning now uses evidence-based start instead of defaulting to 5.0.
    let expectedRelations = 0;
    if (context.question.knowledgeModel) {
      context.question.knowledgeModel.forEach(expectedConcept => {
        if (expectedConcept.relationships) {
          expectedRelations += expectedConcept.relationships.length;
        }
      });
    }

    const reasoningVal = computeEvidenceBasedReasoningStart(
      context.validConnections.length,
      expectedRelations,
      substance.wordCount,
    );
    // Apply deductions for invalid connections
    const invalidDeduction = context.invalidConnections.length * 1.0;
    context.reasoningScore = Math.round(Math.max(0, Math.min(10, reasoningVal - invalidDeduction)) * 10) / 10;

    // ─── 4. COMMUNICATION & CLARITY ──────────────────────────────────────────
    // SCORING RIGOR FIX: Communication starts from substance-based value, not 10.
    let commScore = computeSubstanceBasedCommunicationStart(
      substance.wordCount, substance.sentenceCount, substance.hasCompleteSentence,
    );
    context.developerTrace.push(`Communication start: ${commScore.toFixed(1)} (substance-based, was 10.0 unconditionally).`);
    
    // repetition penalties
    commScore -= context.localRepetitionPenalties;
    
    // negative evidence filters
    if (context.buzzwordStuffingDetected) {
      commScore -= 4.0;
      context.developerTrace.push('Communication deduction: Buzzword stuffing detected (-4.0)');
    }
    if (context.circularExplanationDetected) {
      commScore -= 3.0;
      context.developerTrace.push('Communication deduction: Circular explanation detected (-3.0)');
    }

    if (context.buzzwordStuffingDetected || context.circularExplanationDetected) {
      commScore = Math.max(3.0, commScore); // absolute floor for severe cases only
    }
    commScore = Math.max(0, Math.min(10, commScore));
    
    context.communicationClarityScore = Math.round(commScore * 10) / 10;

    // ─── 5. CONFIDENCE CALIBRATION ─────────────────────────────────────────
    // SCORING RIGOR FIX: Confidence starts from evidence-based value, not 8.0.
    let confidenceVal = computeEvidenceBasedConfidenceStart(
      context.conceptEvidence.length, substance.wordCount,
    );
    context.developerTrace.push(`Confidence start: ${confidenceVal.toFixed(1)} (evidence-based, was 8.0 unconditionally).`);

    if (context.uncertaintyDetected) {
      confidenceVal -= 1.0;
      context.developerTrace.push('Confidence deduction: Uncertainty detected (-1.0)');
    }
    if (context.selfCorrectionsCount > 0) {
      confidenceVal += Math.min(1.5, context.selfCorrectionsCount * 0.5);
      context.developerTrace.push(`Confidence bonus: Self-correction count = ${context.selfCorrectionsCount}`);
    }
    if (context.unrecognizedClaims.length > 0) {
      confidenceVal -= Math.min(1.0, context.unrecognizedClaims.length * 0.25);
    }
    
    context.confidenceCalibrationScore = Math.round(Math.max(0, Math.min(10, confidenceVal)) * 10) / 10;

    // ─── 6. EVALUATION CONFIDENCE ──────────────────────────────────────────
    // Moved to ConfidenceAnalyzer.ts


    context.developerTrace.push(`Scores computed (pre-policy): Accuracy=${context.technicalAccuracyScore}, Understanding=${context.conceptUnderstandingScore}, Reasoning=${context.reasoningScore}, Comm=${context.communicationClarityScore}, Calibration=${context.confidenceCalibrationScore}`);

    // Apply final score capping rules (these override before unified policy)
    if (context.buzzwordStuffingDetected) {
      context.technicalAccuracyScore = Math.min(3.0, context.technicalAccuracyScore);
      context.conceptUnderstandingScore = 0;
      context.reasoningScore = 0;
      context.developerTrace.push('Applying Buzzword Stuffing Cap: Technical Accuracy capped to 3.0, Understanding/Reasoning to 0.');
    }

    if (context.isHonestUnknown) {
      context.technicalAccuracyScore = 0;
      context.conceptUnderstandingScore = 0;
      context.reasoningScore = 0;
      context.communicationClarityScore = 0;
      context.confidenceCalibrationScore = 0;
      context.technicalAccuracyBreakdown = {
        factsScore: 0,
        questionSatisfactionScore: 0,
        misconceptionsScore: 0,
        completenessScore: 0,
        relevanceScore: 0
      };
      context.questionSatisfaction = 'NO';
      context.developerTrace.push('Applying Honest Unknown Overrides: All scores forced to 0.');
      return; // Skip unified policy — scores are already 0
    }

    // ─── UNIFIED SCORING POLICY (Length + Substance + Gravity) ──────────────
    // Score Gravity engages when context.technicalAccuracyScore <= KNOWLEDGE_GATE_CAP
    if (context.technicalAccuracyScore <= KNOWLEDGE_GATE_CAP) {
      context.developerTrace.push(`[SCORE GRAVITY GATE] Accuracy is critically low (${context.technicalAccuracyScore} <= ${KNOWLEDGE_GATE_CAP}).`);
    }

    const isIntroductory = questionCategoryStr === 'introduction' || pipelineTypeStr === 'introductory' || /introduce|background/i.test(textLowerStr);

    const policyResult = applyUnifiedScoringPolicy(
      {
        technicalAccuracy: context.technicalAccuracyScore,
        conceptUnderstanding: context.conceptUnderstandingScore,
        reasoning: context.reasoningScore,
        communication: context.communicationClarityScore,
        confidence: context.confidenceCalibrationScore,
      },
      rawText,
      context.conceptEvidence.length,
      isOpenEnded,
      context.technicalAccuracyScore,
      isIntroductory,
      context.questionSatisfaction,
    );

    context.technicalAccuracyScore = policyResult.scores.technicalAccuracy;
    context.conceptUnderstandingScore = policyResult.scores.conceptUnderstanding;
    context.reasoningScore = policyResult.scores.reasoning;
    context.communicationClarityScore = policyResult.scores.communication;
    context.confidenceCalibrationScore = policyResult.scores.confidence;

    for (const cap of policyResult.appliedCaps) {
      context.developerTrace.push(`[UNIFIED POLICY] ${cap}`);
    }
    context.developerTrace.push(`Scores after unified policy: Accuracy=${context.technicalAccuracyScore}, Understanding=${context.conceptUnderstandingScore}, Reasoning=${context.reasoningScore}, Comm=${context.communicationClarityScore}, Calibration=${context.confidenceCalibrationScore}`);
  }
}
