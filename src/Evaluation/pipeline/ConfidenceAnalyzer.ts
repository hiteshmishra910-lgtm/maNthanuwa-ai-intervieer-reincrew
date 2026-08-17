import { PipelineContext, EvaluationModule } from './interfaces';

export class ConfidenceAnalyzer implements EvaluationModule {
  readonly name = 'ConfidenceAnalyzer';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting ConfidenceAnalyzer...');
    
    /**
     * CONFIDENCE IS NOT SCORE.
     * This metric measures the system's certainty about the evaluation it produced,
     * not the candidate's performance. It MUST NOT be used to penalize a candidate's 
     * actual score.
     * 
     * For example:
     * Candidate Score: 0, Confidence: 90 
     * -> "The candidate failed completely, and we have very strong evidence."
     * 
     * Candidate Score: 80, Confidence: 30
     * -> "The candidate might be good, but they gave a very brief answer so we lack evidence."
     */
    
    let confidence = 20; // Baseline starting confidence
    
    const wordCount = context.tokens.length;
    
    // 1. Answer length / Verbosity provides surface area for evaluation
    if (wordCount >= 50) {
      confidence += 30;
      context.confidenceEvidence.push({ factor: 'Detailed Answer', adjustment: 30, reason: `Answer has ${wordCount} words.` });
    } else if (wordCount >= 20) {
      confidence += 15;
      context.confidenceEvidence.push({ factor: 'Moderate length', adjustment: 15, reason: `Answer has ${wordCount} words.` });
    }

    // 2. Concept Coverage (Are they touching on known entities?)
    if (context.matchedConcepts.size >= 3) {
      confidence += 20;
      context.confidenceEvidence.push({ factor: 'Strong Concept Match', adjustment: 20, reason: 'Candidate matched 3+ core concepts.' });
    } else if (context.matchedConcepts.size > 0) {
      confidence += 10;
      context.confidenceEvidence.push({ factor: 'Partial Concept Match', adjustment: 10, reason: 'Candidate matched some core concepts.' });
    }

    // 3. Reasoning Depth (Are they connecting concepts logically?)
    if (context.validConnections && context.validConnections.length > 0) {
      confidence += 15;
      context.confidenceEvidence.push({ factor: 'Reasoning Displayed', adjustment: 15, reason: 'Detected valid connections between concepts.' });
    }

    // 4. Consistency (Lack of contradictions makes evaluation easier)
    if (context.contradictions && context.contradictions.length === 0) {
      confidence += 15;
      context.confidenceEvidence.push({ factor: 'Consistent Answer', adjustment: 15, reason: 'No contradictions detected.' });
    } else {
      context.confidenceEvidence.push({ factor: 'Contradictions Detected', adjustment: 0, reason: 'Contradictions lower our certainty of their true knowledge.' });
    }

    // 5. Speech Completeness & Explicit Unknowns
    if (context.isHonestUnknown) {
      // If a candidate explicitly says "I don't know", the system is highly confident in its evaluation (0 score).
      confidence = 95;
      context.confidenceEvidence.push({ factor: 'Explicit Unknown', adjustment: 95, reason: 'Candidate explicitly admitted lack of knowledge, making evaluation highly certain.' });
    } else if (context.uncertaintyDetected) {
      confidence -= 10; // Candidate is unsure, making our evaluation of their rigid knowledge slightly less confident
      context.confidenceEvidence.push({ factor: 'Uncertainty Detected', adjustment: -10, reason: 'Candidate used uncertain language.' });
    }
    
    // Fallback mode deduction (lack of baseline data makes us inherently less confident)
    if (!context.question.rubric && (!context.question.knowledgeModel || context.question.knowledgeModel.length === 0)) {
      confidence -= 20;
      context.confidenceEvidence.push({ factor: 'Missing Rubric', adjustment: -20, reason: 'Evaluating blindly without a rubric or knowledge model.' });
    }

    // Ensure bounded
    confidence = Math.max(20, Math.min(100, confidence));
    
    // Confidence Bands
    let band = 'Abstain';
    if (confidence >= 80) band = 'Accept';
    else if (confidence >= 50) band = 'Accept + Warning';
    else band = 'Accept + Follow-up';

    context.developerTrace.push(`Confidence Band: ${band} (Score: ${confidence})`);

    // Override score aggregator's evaluationConfidence
    context.evaluationConfidence = confidence;

    context.detectorConfidences['confidenceAnalyzer'] = 95;
    context.developerTrace.push('ConfidenceAnalyzer completed.');
  }
}
