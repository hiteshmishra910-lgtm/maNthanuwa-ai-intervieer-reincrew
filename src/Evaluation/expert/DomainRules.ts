import { DomainRuleResult } from './types';
import { SentenceEmbedding } from './Embeddings';
import type { DomainRule } from '../pipeline/interfaces';

/**
 * Domain rules — topic-specific expectations contributed by domain packs.
 *
 * A rule is *active* when any trigger phrase appears in the answer. While active, the answer
 * must also mention at least one expected phrase, otherwise the rule fails and becomes a
 * negative mark (e.g. "you discussed transactions but never mentioned commit/rollback").
 *
 * Matching is whole-phrase and normalization-aware (hyphens folded to spaces, lower-cased), so it
 * is deterministic and cheap. Pure — no shared state.
 */

export function evaluateDomainRules(
  rules: DomainRule[],
  sentences: SentenceEmbedding[],
): DomainRuleResult[] {
  const text = ` ${sentences.map(s => normalizePhrase(s.text)).join(' \n ')} `;

  return rules.map(rule => {
    const matchedTriggers = rule.triggerPhrases.filter(phrase => containsPhrase(text, phrase));
    const triggered = matchedTriggers.length > 0;

    const matchedExpected = rule.expectedPhrases.filter(phrase => containsPhrase(text, phrase));
    const missingPhrases = rule.expectedPhrases.filter(phrase => !containsPhrase(text, phrase));

    return {
      ruleId: rule.id,
      domain: rule.domain,
      description: rule.description,
      triggered,
      passed: !triggered || matchedExpected.length > 0,
      matchedTriggers,
      missingPhrases,
      severity: rule.severity,
      penalty: rule.penalty,
    };
  });
}

function containsPhrase(text: string, phrase: string): boolean {
  const normalized = normalizePhrase(phrase);
  if (!normalized) return false;
  const escaped = escapeRegExp(normalized);
  const re = new RegExp(`[^a-z0-9]${escaped}[^a-z0-9]`);
  return re.test(text);
}

function normalizePhrase(value: string): string {
  return value.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
