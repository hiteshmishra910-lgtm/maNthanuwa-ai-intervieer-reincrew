import { describe, it, expect } from 'vitest';
import { EvaluationCore } from '../src/Evaluation/dispatch/EvaluationCore';
import { EvaluationMode, Question } from '../types';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';
import { EVALUATION_PROFILES_REGISTRY } from '../src/Evaluation/pipeline/interfaces';

describe('Advanced EvaluationCore Pipeline Tests', () => {
  

  // 1. Expected Concepts & Relationship Mock Question
  const stackQuestion: Question = {
    id: 'test_stack_q',
    question: 'Explain Stacks in detail and why we use them.',
    questionType: 'Definition',
    evaluationGuide: ['LIFO pattern', 'Push and Pop operations'],
    knowledgeModel: [
      {
        conceptId: 'stacks',
        expected: {
          definition: true,
          mechanism: true,
          purpose: true,
          useCase: true,
          limitations: true
        },
        relationships: ['arrays -> stacks', 'linked_lists -> stacks'],
        commonMistakes: ['FIFO', 'First In First Out']
      }
    ]
  };

  it('should score Candidate A (detailed, correct explanation) higher than Candidate B (keyword listing)', () => {
    // Candidate A explains Stacks correctly, explaining Mechanism, Purpose, and LIFO structure
    const contextA: EvaluationContext = {
      session: { id: 'session_a', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate A', email: 'a@example.com', role: 'Dev' },
      question: stackQuestion,
      response: 'A stack is a data structure based on LIFO, meaning Last In First Out. Internally it works by pushing elements onto the stack and popping them off. We implement it using arrays or linked lists, which allows us to keep track of call stacks or undo histories.',
      
    };

    // Candidate B just lists keywords
    const contextB: EvaluationContext = {
      session: { id: 'session_b', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate B', email: 'b@example.com', role: 'Dev' },
      question: stackQuestion,
      response: 'Stack. LIFO. Push. Pop. Array. Linked list. Undo operation.',
      
    };

    const resultA = EvaluationCore.evaluateAnswer(contextA);
    const resultB = EvaluationCore.evaluateAnswer(contextB);

    // Assert Candidate A scored much higher than Candidate B
    expect(resultA.technicalAccuracyScore).toBeGreaterThan(6.0);
    expect(resultA.conceptUnderstandingScore).toBeGreaterThan(6.0);
    expect(resultA.explanationCompletenessPercent).toBeGreaterThan(60);

    // Candidate B should be capped due to buzzword stuffing/no explanation depth
    expect(resultB.technicalAccuracyScore).toBeLessThanOrEqual(4.0);
    expect(resultB.conceptUnderstandingScore).toBe(0.0); // Explained 0 expected dimensions
    expect(resultB.explanationCompletenessPercent).toBe(0);
    expect(resultB.answerType).toBe('incorrect_attempt'); // Listed terms without explaining
  });

  it('should apply misconception penalties when Stack is declared as FIFO', () => {
    const context: EvaluationContext = {
      session: { id: 'session_c', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate C', email: 'c@example.com', role: 'Dev' },
      question: stackQuestion,
      response: 'A stack is a contiguous structure that follows FIFO. We add elements via push and remove them via pop.',
      
    };

    const result = EvaluationCore.evaluateAnswer(context);

    // Stating Stack is FIFO should trigger misconception penalty
    expect(result.misconceptionsDetected).toContain('Stated that Stacks are FIFO (First In First Out), whereas they are LIFO (Last In First Out).');
    expect(result.technicalAccuracyBreakdown?.misconceptionsScore).toBeLessThan(10.0);
  });

  it('should reverse technical error penalties when candidate self-corrects', () => {
    const context: EvaluationContext = {
      session: { id: 'session_d', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate D', email: 'd@example.com', role: 'Dev' },
      question: stackQuestion,
      // Candidate makes stack FIFO mistake but immediately self-corrects in the next sentence
      response: 'A stack is a contiguous structure that is FIFO. Actually, sorry, I mean LIFO, Last In First Out. We push elements on top and pop them.',
      
    };

    const result = EvaluationCore.evaluateAnswer(context);

    // The FIFO error should have been corrected and penalty reversed
    expect(result.selfCorrectionsCount).toBe(1);
    expect(result.technicalAccuracyBreakdown?.misconceptionsScore).toBe(10.0); // 0 active misconception penalties
  });

  it('should detect when candidate fails to answer the question intent', () => {
    const whyQuestion: Question = {
      id: 'test_why_q',
      question: 'Why do we use interfaces?',
      questionType: 'Tradeoff',
      evaluationGuide: ['Loose coupling', 'API contracts']
    };

    const context: EvaluationContext = {
      session: { id: 'session_e', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate E', email: 'e@example.com', role: 'Dev' },
      question: whyQuestion,
      // Answers what an interface is in Java, but not WHY we use it (loose coupling/contracts/etc.)
      response: 'Interfaces support abstraction. Java runs on the JVM. OOP has encapsulation. SOLID principles are important.',
      
    };

    const result = EvaluationCore.evaluateAnswer(context);

    // Satisfaction should be PARTIAL or NO, not YES
    expect(result.questionSatisfaction).not.toBe('YES');
  });

  it('should decrease confidence calibration when uncertainty is detected, without altering accuracy', () => {
    const context: EvaluationContext = {
      session: { id: 'session_f', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate F', email: 'f@example.com', role: 'Dev' },
      question: stackQuestion,
      response: 'I think a stack is LIFO, Last In First Out, probably using push and pop operations to help keep track of undo operations, I guess.',
      
    };

    const result = EvaluationCore.evaluateAnswer(context);

    expect(result.uncertaintyDetected).toBe(true);
    expect(result.confidenceCalibrationScore).toBeLessThan(8.0); // uncertainty reduces calibration
    expect(result.technicalAccuracyScore).toBeGreaterThan(6.0); // correctness is preserved
  });

  // ── Phase 2: Word-Boundary & Anaphora Resolution Tests ────────────────────

  it('[Phase 2] should NOT match "oop" inside "loops" (false positive prevention)', () => {
    // The word "loops" contains "oop" as a substring. The engine must NOT fire
    // the OOP / Object-Oriented-Programming concept just because "loops" appears.
    const loopQuestion: Question = {
      id: 'test_loop_q',
      question: 'What is a loop?',
      questionType: 'Definition',
      evaluationGuide: ['Repeating code', 'Iteration']
    };

    const context: EvaluationContext = {
      session: { id: 'session_g', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate G', email: 'g@example.com', role: 'Dev' },
      question: loopQuestion,
      // "loops" contains "oop" — must NOT trigger OOP concept match
      response: 'Loops are used to iterate over data. For loops and while loops help repeat code blocks.',
      
    };

    const result = EvaluationCore.evaluateAnswer(context);

    // OOP / oop should NOT appear in mentioned concepts
    const mentionedLower = (result.mentionedConcepts ?? []).map(c => c.toLowerCase());
    expect(mentionedLower).not.toContain('oop');
    expect(mentionedLower).not.toContain('object-oriented programming');
  });

  it('[Phase 2] should resolve anaphora so multi-sentence explanations score correctly', () => {
    // Candidate explains the concept across two sentences, using "It" in the second.
    // Without anaphora resolution: sentence 2 is ignored (no direct concept match).
    // With anaphora resolution: "It works by…" is correctly attributed to stacks.
    const context: EvaluationContext = {
      session: { id: 'session_h', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate H', email: 'h@example.com', role: 'Dev' },
      question: stackQuestion,
      // Sentence 1: names the concept. Sentence 2: explains mechanism via pronoun.
      response: 'A stack is a linear data structure. It works by pushing elements onto the top and popping them off, following a LIFO order. It is used for undo operations and call stacks in real world applications.',
      
    };

    const contextNoAnaphora: EvaluationContext = {
      session: { id: 'session_h2', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
      candidate: { name: 'Candidate H2', email: 'h2@example.com', role: 'Dev' },
      question: stackQuestion,
      // Same content, but every sentence explicitly names "stack" — no pronoun needed.
      response: 'A stack is a linear data structure. A stack works by pushing elements onto the top and popping them off, following LIFO order. A stack is used for undo operations and call stacks in real world applications.',
      
    };

    const resultWithAnaphora = EvaluationCore.evaluateAnswer(context);
    const resultExplicit = EvaluationCore.evaluateAnswer(contextNoAnaphora);

    // Both should score similarly — anaphoric form should not be heavily penalised
    expect(resultWithAnaphora.conceptUnderstandingScore).toBeGreaterThan(4.0);
    expect(resultWithAnaphora.conceptUnderstandingScore ?? 0).toBeGreaterThanOrEqual(
      (resultExplicit.conceptUnderstandingScore ?? 0) * 0.75  // within 25% of explicit form
    );
  });

  describe('Relevance-First Gating & Alignment Policy', () => {
    const behavioralQuestion: Question = {
      id: 'test_behavioral_q',
      question: 'Describe a time you had to explain a technical concept to a non-technical person.',
      questionType: 'HR',
      evaluationGuide: ['STAR method', 'Communication', 'Example scenario'],
      keyConcepts: [
        { id: 'communication', concept: 'Communication', importance: 'Critical' },
        { id: 'indexing', concept: 'Database Indexing', importance: 'Important', aliases: ['index', 'indexing'] }
      ]
    };

    it('should detect a generic memorized definition for a behavioral question and cap score to <= 3', () => {
      const context: EvaluationContext = {
        session: { id: 'session_behavioral_1', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
        candidate: { name: 'Candidate X', email: 'x@example.com', role: 'Dev' },
        question: behavioralQuestion,
        // Answer is purely a definition of STAR without personal narrative
        response: 'The STAR method stands for Situation, Task, Action, and Result. Situation sets the context, Task describes the challenge or objective, Action details the specific steps, and Result highlights outcomes.',
        
      };

      const result = EvaluationCore.evaluateAnswer(context);

      expect(result.questionAlignment).toBeDefined();
      expect(result.questionAlignment?.answeredQuestion).toBe(false);
      expect(result.questionAlignment?.genericMemorizedAnswer).toBe(true);
      expect(result.technicalAccuracyScore).toBeLessThanOrEqual(3.0);
      expect(result.problemSolvingScore).toBeLessThanOrEqual(3.0);
    });

    it('should pass alignment and score highly when candidate actually tells a personal story', () => {
      const context: EvaluationContext = {
        session: { id: 'session_behavioral_2', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
        candidate: { name: 'Candidate Y', email: 'y@example.com', role: 'Dev' },
        question: behavioralQuestion,
        // Answer contains personal narrative (pronoun 'I') and actual situation details
        response: 'Last semester, I had to explain database indexing to a marketing manager. I compared it to a library card catalog. The action I took was drawing a diagram to show how a table search goes page-by-page versus catalog search. The result was they understood why queries were faster.',
        
      };

      const result = EvaluationCore.evaluateAnswer(context);

      expect(result.questionAlignment).toBeDefined();
      expect(result.questionAlignment?.answeredQuestion).toBe(true);
      expect(result.questionAlignment?.genericMemorizedAnswer).toBe(false);
      expect(result.technicalAccuracyScore).toBeGreaterThan(5.0);
    });

    it('should detect off-topic responses and cap communication and accuracy to <= 4', () => {
      const context: EvaluationContext = {
        session: { id: 'session_behavioral_3', mode: EvaluationMode.LOCAL },
      evaluationProfile: EVALUATION_PROFILES_REGISTRY['Technical'],
        candidate: { name: 'Candidate Z', email: 'z@example.com', role: 'Dev' },
        question: behavioralQuestion,
        // Completely off-topic answer about git merge conflicts
        response: 'Git merge conflicts happen when two developers edit the same line of code in a file and try to merge them. To fix it, you have to open the file, select the correct lines, and run git commit.',
        
      };

      const result = EvaluationCore.evaluateAnswer(context);

      expect(result.questionAlignment).toBeDefined();
      expect(result.questionAlignment?.offTopic).toBe(true);
      expect(result.technicalAccuracyScore).toBeLessThanOrEqual(4.0);
      expect(result.communicationScore).toBeLessThanOrEqual(4.0);
    });
  });
});

