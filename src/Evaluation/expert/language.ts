import {
  ContradictionReport,
  ExpertLanguageAnalysis,
  GrammarReport,
  ReadabilityReport,
  RepetitionReport,
  SyntaxSummary,
} from './types';
import { ParsedSentence } from './syntax';

/**
 * Blend the writing-quality sub-analyses into a single explainable `ExpertLanguageAnalysis`.
 *
 * Weights:
 *  - grammar      0.35
 *  - readability  0.30
 *  - repetition   0.35
 *
 * Contradictions are deliberately NOT part of this blend: they are correctness issues, so they
 * surface as negative marks (deducted from the final weighted score) rather than as a
 * writing-quality signal. The contradictions report is still attached for diagnostics.
 */

const LANGUAGE_WEIGHTS = {
  grammar: 0.35,
  readability: 0.3,
  repetition: 0.35,
} as const;

export function buildSyntaxSummary(parsed: ParsedSentence[]): SyntaxSummary {
  const subjects: string[] = [];
  const mainVerbs: string[] = [];
  let clauseCount = 0;

  for (const sentence of parsed) {
    clauseCount += sentence.clauses.length;
    if (sentence.subjectIndex !== -1) subjects.push(sentence.tokens[sentence.subjectIndex].text);
    if (sentence.verbIndex !== -1) mainVerbs.push(sentence.tokens[sentence.verbIndex].text);
  }

  return {
    sentenceCount: parsed.length,
    clauseCount,
    subjects,
    mainVerbs,
    sentences: parsed.map(s => ({
      index: s.index,
      text: s.text,
      subject: s.subjectIndex !== -1 ? s.tokens[s.subjectIndex].text : '',
      verb: s.verbIndex !== -1 ? s.tokens[s.verbIndex].text : '',
      hasNegation: s.hasNegation,
      clauseCount: s.clauses.length,
    })),
  };
}

export function synthesizeLanguage(
  grammar: GrammarReport,
  readability: ReadabilityReport,
  repetition: RepetitionReport,
  contradictions: ContradictionReport,
  sentenceCount: number,
): ExpertLanguageAnalysis {
  const score =
    grammar.score * LANGUAGE_WEIGHTS.grammar +
    readability.score * LANGUAGE_WEIGHTS.readability +
    repetition.score * LANGUAGE_WEIGHTS.repetition;

  return {
    score: round1(Math.max(0, Math.min(10, score))),
    sentenceCount,
    grammar,
    readability,
    repetition,
    contradictions,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
