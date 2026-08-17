import { describe, it, expect } from 'vitest';
import { Tokenizer } from '../src/Evaluation/pipeline/Tokenizer';
import { Normalizer } from '../src/Evaluation/pipeline/Normalizer';
import { Stemmer } from '../src/Evaluation/pipeline/Stemmer';
import { ConceptMatcher } from '../src/Evaluation/pipeline/ConceptMatcher';
import { LocalEvaluationStrategy } from '../src/Evaluation/engines/LocalEvaluationStrategy';
import { EvaluationMode, Question } from '../types';
import { EvaluationContext } from '../src/Evaluation/types/EvaluationContext';

describe('Evaluation Tokenization Pipeline', () => {
  it('should split text into tokens correctly', () => {
    const text = 'class Dog extends Animal';
    const tokens = Tokenizer.tokenize(text);
    expect(tokens).toEqual(['class', 'Dog', 'extends', 'Animal']);
  });

  it('should normalize tokens by lowercasing and stripping punctuation', () => {
    const text = 'Inheritance, (polymorphism!) "encapsulation".';
    const normalized = Normalizer.normalize(text);
    expect(normalized).toBe('inheritance polymorphism encapsulation');
  });

  it('should stem plurals and developer suffixes', () => {
    expect(Stemmer.stem('classes')).toBe('class');
    expect(Stemmer.stem('interfaces')).toBe('interface');
    expect(Stemmer.stem('variables')).toBe('variable');
    expect(Stemmer.stem('inherited')).toBe('inherit');
  });
});

describe('Concept Matcher & Evidence Detector', () => {
  it('should match inheritance concept by parent/base class alias', () => {
    const answer = 'In OOP, a child class inherits properties from its parent class.';
    const matches = ConceptMatcher.match(answer);
    const inheritanceMatch = matches.find(m => m.conceptId === 'inheritance');
    expect(inheritanceMatch).toBeDefined();
    expect(inheritanceMatch?.matchedAliases).toContain('parent class');
  });

  it('should detect definition and example evidence', () => {
    const answer = 'Inheritance refers to extending a base class. For example, a Dog extends Animal.';
    const matches = ConceptMatcher.match(answer);
    const inheritanceMatch = matches.find(m => m.conceptId === 'inheritance');
    expect(inheritanceMatch?.evidence).toContain('definition');
    expect(inheritanceMatch?.evidence).toContain('example');
  });
});

describe('Local Evaluation Engine', () => {
  it('should score an honest unknown answer as 0 contentScore', async () => {
    const engine = LocalEvaluationStrategy.getInstance();
    const question: Question = {
      id: 'test_q_1',
      question: 'Explain inheritance.',
      evaluationGuide: ['Inheritance']
    };
    const context: EvaluationContext = {
      session: { id: 'test_session', mode: EvaluationMode.LOCAL },
      candidate: { name: 'Test Candidate', email: 'test@example.com', role: 'CSE' },
      question: question,
      response: 'I do not know about this concept.',
      evaluationProfile: { id: 'default', version_number: 1 } as any
    };

    const result = await engine.evaluateQuestion(context);
    expect(result.contentScore).toBe(0);
    expect(result.answerType).toBe('honest_unknown');
  });

  it('should score a keyword-only answer as <= 2.0 contentScore', async () => {
    const engine = LocalEvaluationStrategy.getInstance();
    const question: Question = {
      id: 'test_q_2',
      question: 'What is an API?',
      evaluationGuide: ['API']
    };
    const context: EvaluationContext = {
      session: { id: 'test_session', mode: EvaluationMode.LOCAL },
      candidate: { name: 'Test Candidate', email: 'test@example.com', role: 'CSE' },
      question: question,
      response: 'API',
      evaluationProfile: { id: 'default', version_number: 1 } as any
    };

    const result = await engine.evaluateQuestion(context);
    expect(result.contentScore).toBeLessThanOrEqual(2.0);
  });

  it('should score conversational honest unknowns as 0 contentScore', async () => {
    const engine = LocalEvaluationStrategy.getInstance();
    const question: Question = {
      id: 'test_q_3',
      question: 'What is polymorphism?',
      evaluationGuide: ['Polymorphism']
    };
    const context: EvaluationContext = {
      session: { id: 'test_session', mode: EvaluationMode.LOCAL },
      candidate: { name: 'Test Candidate', email: 'test@example.com', role: 'CSE' },
      question: question,
      response: "I'm not sure",
      evaluationProfile: { id: 'default', version_number: 1 } as any
    };

    const result = await engine.evaluateQuestion(context);
    expect(result.contentScore).toBe(0);
    expect(result.answerType).toBe('honest_unknown');
  });
});
