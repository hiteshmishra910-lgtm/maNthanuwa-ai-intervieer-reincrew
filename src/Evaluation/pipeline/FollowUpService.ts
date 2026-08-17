import { EvaluationResult } from '../../../types';
import { InterviewContext, FollowUpDecision } from './types';

export class FollowUpService {
  
  evaluateNeedForFollowUp(result: EvaluationResult, context: InterviewContext): FollowUpDecision {
    if (!result) {
      return {
        requiresFollowUp: false,
        reason: "No evaluation result available.",
        missingConcepts: [],
        confidence: 1.0
      };
    }

    const isFollowUpEnabled = context.configuration?.enableFollowUpQuestions ?? true;
    
    // 1. Is Follow-up Enabled globally by config?
    if (!isFollowUpEnabled) {
      return {
        requiresFollowUp: false,
        reason: "Follow-up questions are disabled by configuration.",
        missingConcepts: [],
        confidence: 1.0
      };
    }

    // 2. Is this already a follow-up question?
    if (context.currentQuestion?.isFollowUp) {
      return {
        requiresFollowUp: false,
        reason: "Already answering a follow-up question. Preventing endless chain.",
        missingConcepts: [],
        confidence: 1.0
      };
    }

    // 2b. Have we exceeded the session limit for follow-ups?
    const maxFollowUps = context.configuration?.maxFollowUps ?? 1;
    const currentFollowUps = context.sessionMetrics?.followUpsAsked || 0;
    if (currentFollowUps >= maxFollowUps) {
      return {
        requiresFollowUp: false,
        reason: `Session follow-up limit reached (${maxFollowUps}).`,
        missingConcepts: [],
        confidence: 1.0
      };
    }

    const missing = result.missingKeyPoints || [];

    // 3. Evaluate Signals
    
    // 3a. Honest Unknown
    if (result.answerQuality === 'HONEST_UNKNOWN' || result.answerType === 'honest_unknown') {
      return {
        requiresFollowUp: false,
        reason: "Candidate explicitly admitted lack of knowledge.",
        missingConcepts: missing,
        confidence: 0.95
      };
    }

    // 3b. Perfect or Excellent Answer — no follow-up, they nailed it
    const coverageScore = result.dimensions?.coverage?.score ?? (result.technicalAccuracyBreakdown?.completenessScore ?? 0);
    const correctnessScore = result.dimensions?.correctness?.score ?? (result.technicalAccuracyBreakdown?.factsScore ?? 0);

    if (coverageScore >= 9 && correctnessScore >= 9) {
      return {
        requiresFollowUp: false,
        reason: "Answer was comprehensive. No follow-up needed.",
        missingConcepts: [],
        confidence: 0.9
      };
    }

    // 3c. Only follow up when answer is STRONG but has specific gaps (score >= 8)
    // Following up on weak/unknown answers is unproductive — candidate just doesn't know.
    // In V3, we check the Confidence Band via `evaluationConfidence`.
    // If evaluationConfidence is between 40 and 60, we might follow up.
    // For legacy, we keep the correctness/coverage check but tighten it to 8.
    const confidence = result.evaluationConfidence ?? 0;
    const v3FollowUpNeeded = confidence >= 40 && confidence < 60;
    const legacyFollowUpNeeded = coverageScore < 9 && correctnessScore >= 8 && missing.length > 0;

    if (v3FollowUpNeeded || legacyFollowUpNeeded) {
      // Find a suitable branchId from V3 followups definition
      let selectedBranchId: string | undefined = undefined;
      let matchedReason = "Candidate showed strong understanding but missed specific key concepts — worth probing.";
      
      if (context.currentQuestion?.followups) {
        for (const followup of context.currentQuestion.followups) {
          if (missing.includes(followup.whenMissing)) {
            selectedBranchId = followup.branchId;
            matchedReason = `V3 Rule: Follow-up triggered for missing concept: ${followup.whenMissing}`;
            break;
          }
        }
      }

      return {
        requiresFollowUp: true,
        reason: matchedReason,
        missingConcepts: missing,
        confidence: 0.9,
        branchId: selectedBranchId
      };
    }
    
    // Default fallback
    return {
      requiresFollowUp: false,
      reason: "Answer did not trigger specific follow-up criteria.",
      missingConcepts: missing,
      confidence: 0.5
    };
  }
}
