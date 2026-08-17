import { EvaluationResult, Question, QuestionType } from '../../../types';
import { EvaluationContext } from '../types/EvaluationContext';
import { PipelineContext, EvaluationModule, EVALUATION_PROFILES_REGISTRY } from '../pipeline/interfaces';
import { Normalizer } from '../pipeline/Normalizer';
import { Tokenizer } from '../pipeline/Tokenizer';
import { Stemmer } from '../pipeline/Stemmer';
import { ScoreAggregator } from '../pipeline/ScoreAggregator';
import { determineVerdict } from '../../../shared/verdictPolicy';
import { calculateRequiredElementCoverageCap } from '../../../shared/scoringPolicy';

// Import all pipeline modules
import { ConceptMatcher } from '../pipeline/ConceptMatcher';
import { UnderstandingAnalyzer } from '../pipeline/UnderstandingAnalyzer';
import { IntentDetector } from '../pipeline/IntentDetector';
import { DependencyGraphAnalyzer } from '../pipeline/DependencyGraphAnalyzer';
import { RelationshipGraphValidator } from '../pipeline/RelationshipGraphValidator';
import { TechnicalRulesDetector } from '../pipeline/TechnicalRulesDetector';
import { MisconceptionDetector } from '../pipeline/MisconceptionDetector';
import { StructuralContradictionDetector } from '../pipeline/StructuralContradictionDetector';
import { UnrecognizedClaimDetector } from '../pipeline/UnrecognizedClaimDetector';
import { RelevanceAnalyzer } from '../pipeline/RelevanceAnalyzer';
import { CommunicationAnalyzer } from '../pipeline/CommunicationAnalyzer';
import { ConfidenceAnalyzer } from '../pipeline/ConfidenceAnalyzer';
import { SelfCorrectionDetector } from '../pipeline/SelfCorrectionDetector';
import { UncertaintyDetector } from '../pipeline/UncertaintyDetector';
import { NegativeEvidenceDetector } from '../pipeline/NegativeEvidenceDetector';
import { QuestionAlignmentEvaluator } from '../pipeline/QuestionAlignmentEvaluator';
import { EvaluationPolicyEngine } from '../pipeline/EvaluationPolicyEngine';
import { RubricValidator } from '../pipeline/RubricValidator';
import { ExplainabilityFormatter } from '../pipeline/ExplainabilityFormatter';
import { RubricCompiler } from '../pipeline/RubricCompiler';
import { SentenceEvidenceExtractor } from '../pipeline/SentenceEvidenceExtractor';
import { GenericDomainEvaluator } from '../pipeline/GenericDomainEvaluator';
import { EvaluationValidator } from '../pipeline/EvaluationValidator';
import { ExpertEvaluationModule } from '../expert/module';
import { isExpertEngineEnabled } from '../expert/config';

export class EvaluationCore {
  private static modules: EvaluationModule[] = [
    new RubricValidator(),
    new SentenceEvidenceExtractor(),
    new GenericDomainEvaluator(),
    new ConceptMatcher(),
    new UnderstandingAnalyzer(),
    new IntentDetector(),
    new DependencyGraphAnalyzer(),
    new RelationshipGraphValidator(),
    new TechnicalRulesDetector(),
    new MisconceptionDetector(),
    new StructuralContradictionDetector(),
    new UnrecognizedClaimDetector(),
    new RelevanceAnalyzer(),
    new CommunicationAnalyzer(),
    new ConfidenceAnalyzer(),
    new SelfCorrectionDetector(),
    new UncertaintyDetector(),
    new NegativeEvidenceDetector(),
    new QuestionAlignmentEvaluator(),
    new ScoreAggregator(),
    new EvaluationPolicyEngine(),
    new EvaluationValidator(),
    new ExplainabilityFormatter()
  ];

  public static registerModule(module: EvaluationModule) {
    if (!EvaluationCore.modules.some(m => m.name === module.name)) {
      EvaluationCore.modules.push(module);
    }
  }

  public static getModules(): EvaluationModule[] {
    return EvaluationCore.modules;
  }


  public static clearModules() {
    EvaluationCore.modules = [];
  }

  // Preprocess text into tokenized/stemmed sentences
  private static segmentSentences(text: string): string[][] {
    if (!text) return [];
    
    // Split by common sentence delimiters
    const rawSentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    
    return rawSentences.map(sentence => {
      const normalized = Normalizer.normalize(sentence);
      let tokens = Tokenizer.tokenize(normalized);
      tokens = Tokenizer.applyNegationScope(tokens);
      return tokens.map(t => Stemmer.stem(t));
    });
  }

  // Fallback profile and questionType detection
  public static detectQuestionType(question: Question): QuestionType {
    if ((question as any).questionType && EVALUATION_PROFILES_REGISTRY[(question as any).questionType as QuestionType]) {
      return (question as any).questionType as QuestionType;
    }
    const textLower = (question.question || '').toLowerCase();
    
    if (textLower.includes('difference between') || textLower.includes('vs') || textLower.includes('versus') || textLower.includes('compare')) {
      return 'Comparison';
    }
    if (textLower.includes('design') || textLower.includes('architecture') || textLower.includes('scale')) {
      return 'Architecture';
    }
    if (textLower.includes('why use') || textLower.includes('tradeoff') || textLower.includes('trade-off') || textLower.includes('advantage') || textLower.includes('limitation')) {
      return 'Tradeoff';
    }
    if (textLower.includes('scenario') || textLower.includes('what would you do') || textLower.includes('situation')) {
      return 'Scenario';
    }
    if (textLower.includes('debug') || textLower.includes('fix') || textLower.includes('broken')) {
      return 'Debugging';
    }
    if (
      textLower.includes('tell me about') ||
      textLower.includes('describe a time') ||
      textLower.includes('describe a situation') ||
      textLower.includes('introduce yourself') ||
      textLower.includes('background') ||
      textLower.includes('experience') ||
      textLower.includes('strength') ||
      textLower.includes('weakness') ||
      textLower.includes('motivation') ||
      textLower.includes('project') ||
      textLower.includes('hr')
    ) {
      return 'HR';
    }
    if (textLower.includes('what is') || textLower.includes('define') || textLower.includes('explain')) {
      return 'Definition';
    }
    
    return 'Technical'; // Safe default
  }

  // Build the fallback ConceptExpectations from keyConcepts or evaluationGuide
  public static getOrCreateKnowledgeModel(question: Question): any[] {
    if (question.knowledgeModel && question.knowledgeModel.length > 0) {
      return question.knowledgeModel;
    }

    const fallbackModel: any[] = [];
    if (question.keyConcepts && question.keyConcepts.length > 0) {
      question.keyConcepts.forEach((kc: any) => {
        fallbackModel.push({
          conceptId: kc.id || kc.concept.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          expected: {
            definition: true,
            mechanism: kc.importance === 'high' || kc.importance === 'Critical',
            purpose: true,
            useCase: kc.importance === 'medium' || kc.importance === 'Important',
            limitations: false
          }
        });
      });
    } else if (question.evaluationGuide && question.evaluationGuide.length > 0) {
      question.evaluationGuide.forEach((guide, idx) => {
        fallbackModel.push({
          conceptId: `concept_${idx}`,
          expected: {
            definition: true,
            mechanism: idx === 0,
            purpose: true,
            useCase: idx === 1,
            limitations: false
          }
        });
      });
    }
    return fallbackModel;
  }

  public static evaluateAnswer(
    context: EvaluationContext
  ): EvaluationResult {
    const start = performance.now();
    const answer = context.response || '';
    const question = context.question;
    
    const questionType = EvaluationCore.detectQuestionType(question);
    const weightsProfile = EVALUATION_PROFILES_REGISTRY[questionType];

    // Preprocessing
    const normalizedAnswer = Normalizer.normalize(answer);
    let tokens = Tokenizer.tokenize(normalizedAnswer);
    tokens = Tokenizer.applyNegationScope(tokens);
    const stemmedTokens = tokens.map(t => Stemmer.stem(t));
    const sentences = EvaluationCore.segmentSentences(answer);

    const honestUnknownPatterns = [
      "i dont know", "i do not know", "not sure", "havent learned", "never studied",
      "dont remember", "not familiar", "no idea", "cant recall", "cannot recall",
      "havent worked with", "not confident answering", "dont know much",
      "no clue", "dunno", "not really sure", "not too sure",
      "notsure", "idk", "nope", "nah", "no idea at all",
      "not aware", "im not aware", "i am not aware", "not aware about", "not aware of",
      "no awareness", "lack awareness", "no knowledge", "dont have knowledge", "do not have knowledge",
      "unfamiliar", "not well versed", "not versed", "havent encountered", "have not encountered",
      "havent come across", "have not come across", "never come across", "not come across",
      "no experience", "dont have experience", "do not have experience", "lack experience",
      "outside my domain", "outside my scope", "outside my expertise", "outside my knowledge",
      "no background", "clueless", "cannot answer", "cant answer", "not clear about", "not clear on"
    ].map(pat => Normalizer.normalize(pat));

    const matchesGapPhrase = honestUnknownPatterns.some(pat => {
      const escaped = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(normalizedAnswer);
    });

    const isHonestUnknown = matchesGapPhrase && (
      answer.split(/\s+/).length < 35 ||
      !(question.evaluationGuide || []).some(g => normalizedAnswer.includes(Normalizer.normalize(g)))
    );

    // Compile immutable EvaluationGraph DAG
    const evaluationGraph = RubricCompiler.compile(question);

    // Initialize PipelineContext
    const pipelineCtx: PipelineContext = {
      question,
      answer,
      questionType: (question as any).questionType || questionType,
      weightsProfile,
      evaluationGraph,
      evidences: [],
      scoreTrace: [],
      visualMetrics: context.metadata?.visualMetrics,
      audioMetrics: undefined,
      isHonestUnknown,
      
      ruleVersion: 'v1.0.0',
      engineVersion: 'v4.2.0',
      evaluationSchemaVersion: 'v1.0.0',
      knowledgeModelVersion: question.version?.toString() || 'v1.0.0',
      developerTrace: [`EvaluationCore (v4.2.0) initialized for Question ID: ${question.id}`, `Question Type: ${questionType}`],
      detectorConfidences: {},

      normalizedAnswer,
      tokens,
      stemmedTokens,
      sentences,

      matchedConcepts: new Set<string>(),
      conceptCompleteness: new Map(),
      reachedDepth: [],
      missedDependencies: [],
      validConnections: [],
      invalidConnections: [],

      conceptEvidence: [],
      misconceptionEvidence: [],
      confidenceEvidence: [],

      technicalErrors: [],
      misconceptions: [],
      contradictions: [],
      unrecognizedClaims: [],
      uncertaintyDetected: false,
      selfCorrectionsCount: 0,
      relevantContentRatio: 1.0, // default full
      buzzwordStuffingDetected: false,
      circularExplanationDetected: false,
      knowledgeBoundaryExceeded: false,

      localClarityScore: 10,
      localRepetitionPenalties: 0,

      technicalAccuracyScore: 0,
      conceptUnderstandingScore: 0,
      reasoningScore: 0,
      communicationClarityScore: 0,
      confidenceCalibrationScore: 0,
      evaluationConfidence: 100
    };

    // Run registered pipeline modules
    const expertEnabled = isExpertEngineEnabled();
    if (expertEnabled) ExpertEvaluationModule.install();
    for (const mod of EvaluationCore.modules) {
      const modStart = performance.now();
      try {
        mod.execute(pipelineCtx);
        const latency = Math.round(performance.now() - modStart);
        pipelineCtx.developerTrace.push(`Module [${mod.name}] executed in ${latency}ms`);
      } catch (err: any) {
        pipelineCtx.developerTrace.push(`Error executing module [${mod.name}]: ${err.message || err}`);
      }
    }
    if (expertEnabled) ExpertEvaluationModule.uninstall();

    // Always run ScoreAggregator last if not explicitly in the modules list
    if (!EvaluationCore.modules.some(m => m.name === 'ScoreAggregator')) {
      new ScoreAggregator().execute(pipelineCtx);
    }
    // Always run EvaluationPolicyEngine last if not explicitly in the modules list
    if (!EvaluationCore.modules.some(m => m.name === 'EvaluationPolicyEngine')) {
      new EvaluationPolicyEngine().execute(pipelineCtx);
    }

    const latencyMs = Math.round(performance.now() - start);

    // Phase 12 Strict Required-Element Coverage Ceiling (Non-Destructive Upper Bound)

    const keyConcepts = question.keyConcepts || [];
    const hasRequiredElements = keyConcepts.some((kc: any) => kc.required === true || kc.importance === 'critical' || kc.importance === 'Critical');

    const hasOmittedRequiredElement = hasRequiredElements && (
      (pipelineCtx.missingKeyPoints && pipelineCtx.missingKeyPoints.length > 0) ||
      (pipelineCtx.technicalErrors && pipelineCtx.technicalErrors.length > 0)
    );

    const coverageCap = calculateRequiredElementCoverageCap(hasRequiredElements, hasOmittedRequiredElement);
    const finalAccuracyScore = Math.min(pipelineCtx.technicalAccuracyScore, coverageCap);
    const finalKnowledgeScore = Math.min(pipelineCtx.conceptUnderstandingScore, coverageCap);

    // Build the final EvaluationResult object matching the extended interfaces in types.ts
    const result: EvaluationResult = {
      questionId: Number(question.id) || 0,
      questionText: question.question || (question as any).text || "Unknown Question",
      userAnswer: answer,
      questionAlignment: pipelineCtx.questionAlignment,
      
      // Legacy compliance scores (blended scores)
      contentScore: finalAccuracyScore, // Map core accuracy to legacy contentScore
      knowledgeScore: finalKnowledgeScore,
      problemSolvingScore: pipelineCtx.reasoningScore,
      learningPotentialScore: pipelineCtx.confidenceCalibrationScore, // Map calibration to learningPotential
      confidenceGap: Math.round((pipelineCtx.confidenceCalibrationScore - finalAccuracyScore) * 10) / 10,
      grammarScore: 0,
      fluencyScore: 0,
      communicationScore: pipelineCtx.communicationClarityScore,
      confidenceScore: context.metadata?.visualMetrics?.confidenceLevel ?? 0,
      expressionAnalysis: "Visual analysis processed.",
      timestamp: new Date().toISOString(),

      // Structured 5-Dimension Scores (Core)
      technicalAccuracyScore: finalAccuracyScore,
      conceptUnderstandingScore: finalKnowledgeScore,
      reasoningScore: pipelineCtx.reasoningScore,
      communicationClarityScore: pipelineCtx.communicationClarityScore,
      confidenceCalibrationScore: pipelineCtx.confidenceCalibrationScore,
      evaluationConfidence: pipelineCtx.evaluationConfidence,


      technicalAccuracyBreakdown: pipelineCtx.technicalAccuracyScore === 0 ? {
        factsScore: 0,
        questionSatisfactionScore: 0,
        misconceptionsScore: 0,
        completenessScore: 0,
        relevanceScore: 0
      } : pipelineCtx.technicalAccuracyBreakdown,

      questionSatisfaction: pipelineCtx.questionSatisfaction || 'YES',
      explanationCompletenessPercent: pipelineCtx.explanationCompletenessPercent,
      relevantContentRatio: pipelineCtx.relevantContentRatio,
      conceptGraphDetails: {
        reachedDepth: pipelineCtx.reachedDepth,
        missedDependencies: pipelineCtx.missedDependencies,
        validConnections: pipelineCtx.validConnections,
        invalidConnections: pipelineCtx.invalidConnections
      },
      misconceptionsDetected: pipelineCtx.technicalErrors.map(e => e.explanation).concat(pipelineCtx.misconceptions),
      uncertaintyDetected: pipelineCtx.uncertaintyDetected,
      explainabilityReport: (pipelineCtx as any).explainabilityReport || "Analysis complete.",
      selfCorrectionsCount: pipelineCtx.selfCorrectionsCount,
      unsupportedClaimsCount: pipelineCtx.unrecognizedClaims.length,
      knowledgeBoundaryExceeded: pipelineCtx.knowledgeBoundaryExceeded,

      mentionedConcepts: Array.from(pipelineCtx.matchedConcepts),
      explainedConcepts: Array.from(pipelineCtx.matchedConcepts).filter(c => {
        const comp = pipelineCtx.conceptCompleteness.get(c);
        return comp && comp.completenessRatio >= 0.5;
      }),
      matchedKeyPoints: Array.from(pipelineCtx.matchedConcepts),
      missingKeyPoints: question.evaluationGuide ? question.evaluationGuide.filter(g => {
        const matchedNames = Array.from(pipelineCtx.matchedConcepts).map(c => c.toLowerCase());
        return !matchedNames.some(m => g.toLowerCase().includes(m));
      }) : [],

      isHonestUnknown: pipelineCtx.isHonestUnknown,
      buzzwordStuffingDetected: pipelineCtx.buzzwordStuffingDetected,

      answerType: pipelineCtx.isHonestUnknown ? 'honest_unknown' :
                  pipelineCtx.buzzwordStuffingDetected ? 'incorrect_attempt' :
                  pipelineCtx.technicalAccuracyScore >= 8 ? 'full_explanation' :
                  pipelineCtx.technicalAccuracyScore >= 5 ? 'partial_explanation' :
                  pipelineCtx.technicalAccuracyScore >= 3 ? 'mixed_understanding' : 'incorrect_attempt',
      answerQuality: pipelineCtx.isHonestUnknown ? 'HONEST_UNKNOWN' :
                     pipelineCtx.technicalAccuracyScore >= 9 ? 'EXPERT' :
                     pipelineCtx.technicalAccuracyScore >= 7 ? 'STRONG' :
                     pipelineCtx.technicalAccuracyScore >= 5 ? 'COMPETENT' :
                     pipelineCtx.technicalAccuracyScore >= 3 ? 'SURFACE_LEVEL' : 'INCORRECT_ATTEMPT',
      verdict: pipelineCtx.isHonestUnknown ? 'Fail' : determineVerdict(pipelineCtx.technicalAccuracyScore),
      
      feedback: {
        observation: pipelineCtx.isHonestUnknown 
          ? "Candidate explicitly acknowledged a gap in knowledge for this topic." 
          : pipelineCtx.technicalErrors.length > 0 
          ? `Specific conceptual gaps identified: ${pipelineCtx.technicalErrors.map(e => e.explanation).join('; ')}.` 
          : String(questionType) === 'HR'
          ? "Articulated background and personal introduction clearly."
          : String(questionType) === 'Scenario' || String(questionType).includes('Behavioral')
          ? "Demonstrated relevant experience with clear communication."
          : "Demonstrated core technical understanding of key concepts.",
        demonstrated: Array.from(pipelineCtx.matchedConcepts).map(c => c.replace(/_/g, ' ')),
        gaps: pipelineCtx.technicalErrors.map(e => e.explanation),
        nextSteps: pipelineCtx.isHonestUnknown 
          ? (question.evaluationGuide || []).slice(0, 3).map(g => `Study fundamental principles of ${g.toLowerCase()}`)
          : String(questionType) === 'HR'
          ? ["Highlight specific technical projects and hands-on achievements in future self-introductions."]
          : String(questionType) === 'Scenario' || String(questionType).includes('Behavioral')
          ? ["Use the STAR method (Situation, Task, Action, Result) with explicit individual ownership metrics."]
          : ["Deepen explanation of underlying implementation mechanics and performance trade-offs."]
      },

      developerTrace: pipelineCtx.developerTrace,
      detectorConfidences: pipelineCtx.detectorConfidences,
      ruleVersion: pipelineCtx.ruleVersion,
      knowledgeModelVersion: pipelineCtx.knowledgeModelVersion,

      evaluationMetadata: {
        engineId: 'local-core-v1',
        version: 'v1.0.0',
        timestamp: new Date().toISOString(),
        latencyMs,
        mode: context.session.mode,
        evaluationSource: 'LOCAL',
        fallbackReason: 'LOCAL_ENGINE',
        provider: 'local-core-v1',
        model: 'core-heuristics',
        promptVersion: 'v2.2.0'
      },
      expert: pipelineCtx.expert
    };

    return result;
  }
}
