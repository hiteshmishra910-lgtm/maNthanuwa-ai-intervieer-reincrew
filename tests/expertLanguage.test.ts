import { describe, it, expect } from 'vitest';
import { Question } from '../types';
import { embedSentences } from '../src/Evaluation/expert/Embeddings';
import {
  tagToken,
  parseDependencies,
  parseSentence,
  sentenceStemTokens,
} from '../src/Evaluation/expert/syntax';
import { analyzeGrammar } from '../src/Evaluation/expert/GrammarAnalyzer';
import { countSyllables, analyzeReadability } from '../src/Evaluation/expert/ReadabilityAnalyzer';
import { detectRepetition } from '../src/Evaluation/expert/RepetitionDetector';
import { detectContradictions } from '../src/Evaluation/expert/ContradictionDetector';
import { synthesizeLanguage, buildSyntaxSummary } from '../src/Evaluation/expert/language';
import { ExpertEvaluator } from '../src/Evaluation/expert/ExpertEvaluator';
import {
  ContradictionReport,
  GrammarReport,
  ReadabilityReport,
  RepetitionReport,
} from '../src/Evaluation/expert/types';

const stackQuestion: Question = {
  id: 'expert_language_stack_q',
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
        limitations: true,
      },
      relationships: ['arrays -> stacks', 'linked_lists -> stacks'],
      commonMistakes: ['FIFO', 'First In First Out'],
    },
  ],
};

const DETAILED_ANSWER =
  'A stack is a data structure based on LIFO, meaning Last In First Out. ' +
  'Internally it works by pushing elements onto the stack and popping them off. ' +
  'We implement it using arrays or linked lists, which allows us to keep track of call stacks or undo histories.';

describe('Syntax layer (dependency parsing)', () => {
  it('tags closed-class and inflection-aware verbs', () => {
    expect(tagToken('the').pos).toBe('DET');
    expect(tagToken('not').pos).toBe('NEG');
    expect(tagToken('not').isNegation).toBe(true);
    expect(tagToken('store').pos).toBe('VERB');
    expect(tagToken('stores').pos).toBe('VERB');
    expect(tagToken('storing').pos).toBe('VERB');
    expect(tagToken('stack').pos).toBe('OTHER');
  });

  it('extracts subject, verb and object for a simple sentence', () => {
    const [sentence] = parseDependencies(embedSentences('The stack stores elements in order.'));
    expect(sentence.subjectIndex).toBe(1);
    expect(sentence.tokens[sentence.subjectIndex].text).toBe('stack');
    expect(sentence.verbIndex).toBe(2);
    expect(sentence.objectIndex).toBe(3);
    expect(sentence.relations.some(r => r.type === 'SBJ')).toBe(true);
    expect(sentence.relations.some(r => r.type === 'OBJ')).toBe(true);
    expect(sentence.relations.some(r => r.type === 'ROOT')).toBe(true);
  });

  it('marks negation and splits clauses on conjunctions', () => {
    const parsed = parseDependencies(
      embedSentences('A stack is not FIFO. Stacks use arrays and they use linked lists.'),
    );
    expect(parsed[0].hasNegation).toBe(true);
    expect(parsed[0].relations.some(r => r.type === 'NEG')).toBe(true);
    expect(parsed[1].clauses.length).toBe(2);
  });

  it('produces stemmed surfaces for downstream analyzers', () => {
    const parsed = parseSentence({ text: 'stacks store elements', tokens: ['stacks', 'store', 'elements'], embedding: new Float32Array(0) }, 0);
    const stems = sentenceStemTokens(parsed);
    expect(stems[0]).toBe('stack');
  });
});

describe('Grammar analyzer', () => {
  it('flags subject-verb agreement errors', () => {
    const report = analyzeGrammar(parseDependencies(embedSentences('He work in the company.')));
    expect(report.issues.some(i => i.ruleId === 'verb_agreement')).toBe(true);
    expect(report.score).toBeLessThan(10);
  });

  it('flags copula agreement errors', () => {
    const report = analyzeGrammar(parseDependencies(embedSentences('It are fast.')));
    expect(report.issues.some(i => i.ruleId === 'copula_agreement')).toBe(true);
  });

  it('flags double negation within a clause', () => {
    const report = analyzeGrammar(parseDependencies(embedSentences('I dont know nothing.')));
    expect(report.issues.some(i => i.ruleId === 'double_negation')).toBe(true);
  });

  it('flags consecutive determiners', () => {
    const report = analyzeGrammar(parseDependencies(embedSentences('It uses a the array.')));
    expect(report.issues.some(i => i.ruleId === 'double_determiner')).toBe(true);
  });

  it('gives a clean answer a perfect grammar score', () => {
    const report = analyzeGrammar(parseDependencies(embedSentences('The stack stores elements in order.')));
    expect(report.issues.length).toBe(0);
    expect(report.score).toBe(10);
  });
});

describe('Readability analyzer', () => {
  it('counts syllables deterministically', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('example')).toBe(3);
  });

  it('ranks simple text above dense jargon', () => {
    const simple = analyzeReadability(embedSentences('Cats are small. Dogs are big. Birds can fly.'));
    const complex = analyzeReadability(
      embedSentences('The constitutional jurisprudence delineates the multifaceted legislative prerogatives of the governing body.'),
    );
    expect(simple.readingEase).toBeGreaterThan(complex.readingEase);
    expect(simple.score).toBeGreaterThan(complex.score);
  });

  it('returns a zero report for empty input', () => {
    const report = analyzeReadability([]);
    expect(report.score).toBe(0);
    expect(report.avgWordsPerSentence).toBe(0);
  });
});

describe('Repetition detector', () => {
  it('detects filler words', () => {
    const report = detectRepetition(
      embedSentences('Basically, you know, it is like, sort of, kind of a stack structure stuff.'),
    );
    expect(report.fillerCount).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(10);
  });

  it('detects duplicate sentences', () => {
    const report = detectRepetition(embedSentences('A stack uses LIFO ordering. A stack uses LIFO ordering.'));
    expect(report.duplicateSentencePairs.length).toBe(1);
    expect(report.score).toBeLessThan(10);
  });

  it('detects repeated content chunks', () => {
    const report = detectRepetition(
      embedSentences('Sorting algorithms compare adjacent elements. Sorting algorithms compare adjacent elements.'),
    );
    expect(report.repeatedChunks.length).toBeGreaterThan(0);
  });

  it('gives a clean answer a perfect repetition score', () => {
    const report = detectRepetition(embedSentences(DETAILED_ANSWER));
    expect(report.fillerCount).toBe(0);
    expect(report.duplicateSentencePairs.length).toBe(0);
    expect(report.score).toBe(10);
  });
});

describe('Contradiction detector', () => {
  it('does not fire when poles belong to different concepts', () => {
    const report = detectContradictions(
      embedSentences('A stack is LIFO. A queue is FIFO.'),
      parseDependencies(embedSentences('A stack is LIFO. A queue is FIFO.')),
      new Set(['stacks']),
    );
    expect(report.contradictions.length).toBe(0);
    expect(report.score).toBe(10);
  });

  it('fires when the same subject is both LIFO and FIFO', () => {
    const report = detectContradictions(
      embedSentences('A stack is LIFO. A stack follows FIFO.'),
      parseDependencies(embedSentences('A stack is LIFO. A stack follows FIFO.')),
      new Set(['stacks']),
    );
    expect(report.contradictions.some(c => c.ruleId === 'fifo_lifo')).toBe(true);
    expect(report.score).toBeLessThan(10);
  });

  it('suppresses O(1)/O(N) when qualified as worst case', () => {
    const text = 'HashMap get is O(1) and the worst case is O(N).';
    const report = detectContradictions(
      embedSentences(text),
      parseDependencies(embedSentences(text)),
      new Set(['hashmap']),
    );
    expect(report.contradictions.length).toBe(0);
  });

  it('fires O(1)/O(N) across separate claims without qualification', () => {
    const report = detectContradictions(
      embedSentences('HashMap get is O(1). HashMap search is O(N).'),
      parseDependencies(embedSentences('HashMap get is O(1). HashMap search is O(N).')),
      new Set(['hashmap']),
    );
    expect(report.contradictions.some(c => c.ruleId === 'complexity_o1_on')).toBe(true);
  });

  it('detects affirm-vs-negate of the same claim', () => {
    const report = detectContradictions(
      embedSentences('A stack is LIFO. A stack is not LIFO.'),
      parseDependencies(embedSentences('A stack is LIFO. A stack is not LIFO.')),
      new Set(['stacks']),
    );
    expect(report.contradictions.some(c => c.ruleId === 'affirm_negate')).toBe(true);
  });
});

describe('Language synthesis', () => {
  it('blends sub-analyses with documented weights', () => {
    const grammar: GrammarReport = { score: 10, issues: [] };
    const readability: ReadabilityReport = {
      score: 5,
      readingEase: 60,
      gradeLevel: 8,
      avgWordsPerSentence: 15,
      avgSyllablesPerWord: 1.5,
      longWordRatio: 0.2,
      lexicalDiversity: 0.8,
    };
    const repetition: RepetitionReport = {
      score: 10,
      fillerCount: 0,
      fillerRatio: 0,
      typeTokenRatio: 1,
      repeatedChunks: [],
      duplicateSentencePairs: [],
    };
    const contradictions: ContradictionReport = { score: 10, contradictions: [] };
    const blended = synthesizeLanguage(grammar, readability, repetition, contradictions, 2);
    expect(blended.score).toBe(8.5);
    expect(blended.sentenceCount).toBe(2);
  });

  it('builds a sentence-level syntax summary', () => {
    const parsed = parseDependencies(embedSentences(DETAILED_ANSWER));
    const summary = buildSyntaxSummary(parsed);
    expect(summary.sentenceCount).toBe(3);
    expect(summary.sentences.length).toBe(3);
    expect(summary.subjects.length).toBe(3);
    expect(summary.clauseCount).toBeGreaterThan(summary.sentenceCount);
    expect(summary.sentences[0].subject).toBe('stack');
  });
});

describe('ExpertEvaluator language integration', () => {
  it('populates syntax, language and the language score', () => {
    const evaluation = ExpertEvaluator.evaluate({ question: stackQuestion, answer: DETAILED_ANSWER });
    expect(evaluation.analysis.syntax.sentenceCount).toBe(3);
    expect(evaluation.analysis.language.sentenceCount).toBe(3);
    expect(evaluation.analysis.scores.language).toBeGreaterThanOrEqual(7);
    expect(evaluation.analysis.language.grammar.score).toBe(10);
    expect(evaluation.analysis.language.contradictions.contradictions.length).toBe(0);
    expect(evaluation.trace.some(line => line.includes('Language layer'))).toBe(true);
  });

  it('penalizes a self-contradicting answer in the language layer', () => {
    const contradiction = ExpertEvaluator.evaluate({
      question: stackQuestion,
      answer: 'A stack is LIFO. A stack follows FIFO.',
    });
    expect(contradiction.analysis.language.contradictions.contradictions.length).toBeGreaterThan(0);
    expect(contradiction.analysis.language.score).toBeLessThan(10);
  });
});
