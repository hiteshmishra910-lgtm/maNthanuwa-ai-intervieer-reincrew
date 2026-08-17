import { describe, it, expect } from 'vitest';
import { EvaluationCore } from '../src/Evaluation/dispatch/EvaluationCore';
import { EvaluationMode, Question } from '../types';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';
import { EVALUATION_PROFILES_REGISTRY } from '../src/Evaluation/pipeline/interfaces';

describe('Domain Gap Awareness & Conversational Fluff Gating Suite', () => {
  const dbmsQuestion: Question = {
    id: 'test_dbms_q',
    question: 'Explain B-Tree indexing and why it is used in relational databases.',
    questionType: 'Definition',
    evaluationGuide: ['B-Tree structure', 'Logarithmic search time', 'Disk block I/O optimization'],
    keyConcepts: [
      { id: 'b_tree', concept: 'B-Tree', importance: 'Critical' },
      { id: 'indexing', concept: 'Database Indexing', importance: 'Critical' }
    ]
  };

  it('should consistently recognize "I am not aware about this concept" as an Honest Unknown gap', () => {
    const context: EvaluationContext = {
      session: { id: 'sess_gap_1', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate Gap 1', email: 'gap1@example.com', role: 'Dev' },
      question: dbmsQuestion,
      response: 'Thank you for the question, but I am not aware about this concept and have not encountered it in my past work.'
    };

    const result = EvaluationCore.evaluateAnswer(context);

    expect(result.isHonestUnknown).toBe(true);
    expect(result.technicalAccuracyScore).toBe(0.0);
    expect(result.feedback?.observation).toContain('acknowledged a gap');
  });

  it('should consistently recognize "outside my domain" and "no experience" as Honest Unknown gaps', () => {
    const context: EvaluationContext = {
      session: { id: 'sess_gap_2', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate Gap 2', email: 'gap2@example.com', role: 'Dev' },
      question: dbmsQuestion,
      response: 'This topic is outside my domain and I have no experience with B-Tree indexing.'
    };

    const result = EvaluationCore.evaluateAnswer(context);

    expect(result.isHonestUnknown).toBe(true);
    expect(result.technicalAccuracyScore).toBe(0.0);
  });

  it('should gate conversational fluff with zero technical concepts to 0.0 relevant content ratio', () => {
    const context: EvaluationContext = {
      session: { id: 'sess_fluff_1', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate Fluff 1', email: 'fluff1@example.com', role: 'Dev' },
      question: dbmsQuestion,
      response: 'That is a very good question. In my opinion, software engineering best practice is crucial for system architecture.'
    };

    const result = EvaluationCore.evaluateAnswer(context);

    expect(result.buzzwordStuffingDetected).toBe(true);
    expect(result.relevantContentRatio).toBe(0.0);
    expect(result.technicalAccuracyScore).toBeLessThanOrEqual(3.0);
  });

  it('should match STAR method and personal ownership concepts in behavioral questions', () => {
    const behavioralQuestion: Question = {
      id: 'test_beh_q',
      question: 'Describe a situation where you led incident triage during a outage.',
      questionType: 'Scenario',
      evaluationGuide: ['STAR method', 'Personal ownership', 'Incident triage'],
      keyConcepts: [
        { id: 'star_framework', concept: 'STAR Framework', importance: 'Critical' },
        { id: 'personal_ownership', concept: 'Personal Ownership', importance: 'Critical' },
        { id: 'incident_triage', concept: 'Incident Triage & Response', importance: 'Critical' }
      ]
    };

    const context: EvaluationContext = {
      session: { id: 'sess_beh_1', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Scenario'],
      candidate: { name: 'Candidate Beh 1', email: 'beh1@example.com', role: 'Dev' },
      question: behavioralQuestion,
      response: 'In my previous role, the situation was a production outage. I personally implemented the rollback plan and led incident triage by analyzing server logs.'
    };

    const result = EvaluationCore.evaluateAnswer(context);

    expect(result.mentionedConcepts.map(c => c.toLowerCase())).toContain('personal_ownership');
    expect(result.technicalAccuracyScore).toBeGreaterThan(6.0);
  });
});
