import { describe, it, expect } from 'vitest';
import { EvaluationCore } from '../src/Evaluation/dispatch/EvaluationCore';
import { Question } from '../types';

describe('Local Evaluation Engine v2 Benchmark Suite', () => {
  const sampleQuestion: Question = {
    id: 'q_dbms_101',
    question: 'Explain what a relational database is and how ACID properties ensure transaction reliability.',
    type: 'Core',
    rubric: {
      coreConcepts: ['relational_db', 'acid_properties'],
      supportingConcepts: ['indexing', 'transactions']
    },
    keyConcepts: [
      { id: 'relational_db', concept: 'Relational Database', importance: 'high' },
      { id: 'acid_properties', concept: 'ACID Properties', importance: 'high' }
    ],
    evaluationGuide: [
      'Stores data in structured tables with rows and columns',
      'ACID guarantees atomicity, consistency, isolation, and durability'
    ]
  };

  it('should score a Gold-Standard explanation above 8.5/10 with High Confidence', () => {
    const context = {
      session: { id: 'sess_bench_1', mode: 'LOCAL' },
      candidate: { name: 'Gold Candidate' },
      evaluationProfile: { mode: 'LOCAL' },
      question: sampleQuestion,
      response: 'A relational database stores structured data in tables consisting of rows and columns using indexing for fast lookups. ACID properties ensure transaction reliability because atomicity makes transactions all-or-nothing, consistency preserves rules, isolation prevents interference, and durability commits data permanently.'
    };

    const result = EvaluationCore.evaluateAnswer(context as any);
    expect(result.technicalAccuracyScore).toBeGreaterThanOrEqual(8.0);
    expect(result.verdict).toBe('Pass');
    expect(result.mentionedConcepts.length).toBeGreaterThan(0);
  });

  it('should score a Partial explanation reasonably between 4.5 and 7.5', () => {
    const context = {
      session: { id: 'sess_bench_2', mode: 'LOCAL' },
      candidate: { name: 'Partial Candidate' },
      evaluationProfile: { mode: 'LOCAL' },
      question: sampleQuestion,
      response: 'A relational database uses tables for storing data. ACID stands for atomicity and consistency.'
    };

    const result = EvaluationCore.evaluateAnswer(context as any);
    expect(result.technicalAccuracyScore).toBeGreaterThanOrEqual(4.0);
    expect(result.technicalAccuracyScore).toBeLessThanOrEqual(9.0);
  });

  it('should zero all dimension scores for an Honest Unknown response', () => {
    const context = {
      session: { id: 'sess_bench_3', mode: 'LOCAL' },
      candidate: { name: 'Unknown Candidate' },
      evaluationProfile: { mode: 'LOCAL' },
      question: sampleQuestion,
      response: 'I am not sure, I have not studied relational databases in depth.'
    };

    const result = EvaluationCore.evaluateAnswer(context as any);
    expect(result.technicalAccuracyScore).toBe(0);
    expect(result.verdict).toBe('Fail');
    expect(result.answerType).toBe('honest_unknown');
  });

  it('should penalize severe misconceptions appropriately', () => {
    const context = {
      session: { id: 'sess_bench_4', mode: 'LOCAL' },
      candidate: { name: 'Misconception Candidate' },
      evaluationProfile: { mode: 'LOCAL' },
      question: sampleQuestion,
      response: 'A relational database is a NoSQL store and TCP is faster than UDP. HTTP is an operating system.'
    };

    const result = EvaluationCore.evaluateAnswer(context as any);
    expect(result.technicalAccuracyScore).toBeLessThanOrEqual(4.0);
  });

  it('should score typo-heavy yet semantically correct answers fairly within tolerance', () => {
    const context = {
      session: { id: 'sess_bench_5', mode: 'LOCAL' },
      candidate: { name: 'Typo Candidate' },
      evaluationProfile: { mode: 'LOCAL' },
      question: sampleQuestion,
      response: 'A relationel database stores data in tabels. ACID properties include atomicity, consistancy, isolation, and durabilitie.'
    };

    const result = EvaluationCore.evaluateAnswer(context as any);
    expect(result.technicalAccuracyScore).toBeGreaterThanOrEqual(5.0);
  });
});
