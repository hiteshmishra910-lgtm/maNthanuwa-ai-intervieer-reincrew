import { GrammarIssue, GrammarReport } from './types';
import { ParsedSentence, COMMON_VERB_BASES } from './syntax';

/**
 * Conservative, rule-based grammar analysis.
 *
 * Deliberately avoids full parsers and NN models: only checks that are reliable enough to
 * not embarrass an interviewer answer are emitted. Every issue carries a small penalty and a
 * human-readable explanation, so `score` is fully explainable.
 */

const SEVERITY_PENALTY: Record<GrammarIssue['severity'], number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

const PLURAL_PRONOUNS = new Set(['we', 'you', 'they', 'i']);
const SINGULAR_PRONOUNS = new Set(['he', 'she', 'it']);

export function analyzeGrammar(sentences: ParsedSentence[]): GrammarReport {
  const issues: GrammarIssue[] = [];

  for (const sentence of sentences) {
    if (sentence.tokens.length === 0) continue;
    checkAgreement(sentence, issues);
    checkDoubleDeterminers(sentence, issues);
    checkDoubleNegation(sentence, issues);
    checkRunOn(sentence, issues);
    checkStutter(sentence, issues);
    checkArticleVowel(sentence, issues);
  }

  const totalPenalty = issues.reduce((sum, i) => sum + i.penalty, 0);
  return {
    score: round1(Math.max(0, Math.min(10, 10 - totalPenalty))),
    issues,
  };
}

function pushIssue(
  issues: GrammarIssue[],
  ruleId: string,
  sentenceIndex: number,
  matchedText: string,
  explanation: string,
  severity: GrammarIssue['severity'],
): void {
  issues.push({ ruleId, sentenceIndex, matchedText, explanation, severity, penalty: SEVERITY_PENALTY[severity] });
}

function checkAgreement(sentence: ParsedSentence, issues: GrammarIssue[]): void {
  if (sentence.subjectIndex === -1 || sentence.verbIndex === -1) return;
  const subject = sentence.tokens[sentence.subjectIndex];
  const verb = sentence.tokens[sentence.verbIndex];
  if (subject.pos !== 'PRON') return;

  const text = `${subject.text} ${verb.text}`;
  const singular = SINGULAR_PRONOUNS.has(subject.text);
  const plural = PLURAL_PRONOUNS.has(subject.text);
  if (!singular && !plural) return;

  const v = verb.text;
  if (v === 'is' || v === 'are' || v === 'was' || v === 'were' || v === 'am') {
    if (singular && (v === 'are' || v === 'were' || v === 'am')) {
      pushIssue(issues, 'copula_agreement', sentence.index, text,
        `"${subject.text}" takes the singular copula (e.g. "${subject.text} is"), not "${v}".`, 'high');
    } else if (plural && (v === 'is' || v === 'was')) {
      pushIssue(issues, 'copula_agreement', sentence.index, text,
        `"${subject.text}" takes the plural copula (e.g. "${subject.text} are"), not "${v}".`, 'high');
    }
  } else if (v === 'has' || v === 'have') {
    if (plural && v === 'has') {
      pushIssue(issues, 'have_agreement', sentence.index, text,
        `"${subject.text}" takes "have", not "has".`, 'high');
    } else if (singular && v === 'have') {
      pushIssue(issues, 'have_agreement', sentence.index, text,
        `"${subject.text}" takes "has", not "have".`, 'high');
    }
  } else if (v === 'does' || v === 'do') {
    if (plural && v === 'does') {
      pushIssue(issues, 'do_agreement', sentence.index, text,
        `"${subject.text}" takes "do", not "does".`, 'high');
    } else if (singular && v === 'do') {
      pushIssue(issues, 'do_agreement', sentence.index, text,
        `"${subject.text}" takes "does", not "do".`, 'high');
    }
  } else if (COMMON_VERB_BASES.has(v)) {
    const endsWithS = v.endsWith('s');
    if (singular && !endsWithS) {
      pushIssue(issues, 'verb_agreement', sentence.index, text,
        `Third-person singular subject "${subject.text}" needs "${v}s" (e.g. "${subject.text} ${v}s").`, 'medium');
    } else if (plural && endsWithS) {
      pushIssue(issues, 'verb_agreement', sentence.index, text,
        `Plural subject "${subject.text}" takes the base form "${v.slice(0, -1)}", not "${v}".`, 'medium');
    }
  }
}

function checkDoubleDeterminers(sentence: ParsedSentence, issues: GrammarIssue[]): void {
  for (let i = 0; i + 1 < sentence.tokens.length; i++) {
    const a = sentence.tokens[i];
    const b = sentence.tokens[i + 1];
    if (a.pos !== 'DET' || b.pos !== 'DET') continue;
    pushIssue(issues, 'double_determiner', sentence.index, `${a.text} ${b.text}`,
      `Two determiners in a row ("${a.text} ${b.text}") — use one.`, 'medium');
  }
}

function checkDoubleNegation(sentence: ParsedSentence, issues: GrammarIssue[]): void {
  for (const clause of sentence.clauses) {
    let count = 0;
    for (const idx of clause) {
      if (sentence.tokens[idx].isNegation) count++;
    }
    if (count >= 2) {
      const matched = clause.map(i => sentence.tokens[i].text).join(' ');
      pushIssue(issues, 'double_negation', sentence.index, matched.slice(0, 80),
        'Double negation ("not ... no/never/none") is ambiguous and usually an error.', 'high');
    }
  }
}

function checkRunOn(sentence: ParsedSentence, issues: GrammarIssue[]): void {
  if (sentence.tokens.length <= 45) return;
  if (sentence.clauses.length >= 2) return;
  pushIssue(issues, 'run_on_sentence', sentence.index, sentence.text.slice(0, 80),
    `Very long sentence (${sentence.tokens.length} words) with no conjunction — consider splitting it.`, 'low');
}

function checkStutter(sentence: ParsedSentence, issues: GrammarIssue[]): void {
  for (let i = 0; i + 1 < sentence.tokens.length; i++) {
    const a = sentence.tokens[i];
    const b = sentence.tokens[i + 1];
    if (a.text.length < 3 || a.text !== b.text) continue;
    pushIssue(issues, 'repeated_word', sentence.index, `${a.text} ${b.text}`,
      `"${a.text}" is immediately repeated.`, 'low');
  }
}

function checkArticleVowel(sentence: ParsedSentence, issues: GrammarIssue[]): void {
  for (let i = 0; i + 1 < sentence.tokens.length; i++) {
    const a = sentence.tokens[i];
    const b = sentence.tokens[i + 1];
    if (a.pos !== 'DET') continue;
    const isVowelStart = /^[aeiou]/.test(b.text) && b.text.length > 2;
    const isConsonantStart = /^[^aeiou]/.test(b.text) && b.text.length > 2;
    if (a.text === 'a' && isVowelStart) {
      pushIssue(issues, 'article_an', sentence.index, `a ${b.text}`,
        `"${b.text}" starts with a vowel sound — use "an".`, 'low');
    } else if (a.text === 'an' && isConsonantStart) {
      pushIssue(issues, 'article_a', sentence.index, `an ${b.text}`,
        `"${b.text}" starts with a consonant sound — use "a".`, 'low');
    }
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
