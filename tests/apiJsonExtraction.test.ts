import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { extractJsonObject } from '../src/Core/api/apiService';

/**
 * Regression guards for the two root causes of "API mode frequently fails to evaluate answers".
 *
 * CAUSE 1 — output budget. Every API-mode path capped the model at `max_tokens: 800`, but a
 * single-question evaluation must return ~25 numeric fields plus technicalErrors,
 * positiveEvidence, three concept arrays and dimensionEvidence (five dimensions, each with up to
 * three positive and three negative verbatim quotes). The model was cut off mid-object, the JSON
 * failed to parse, and the candidate was told "AI evaluation is temporarily unavailable" for a
 * call the provider had actually served. The hybrid edge function has always used 4096 for a
 * slimmer schema, which is why hybrid never showed this.
 *
 * CAUSE 2 — extraction. `text.match(/\{[\s\S]*\}/)` (added in db7a2e1) spans from the first `{`
 * to the LAST `}` anywhere in the response, so any closing brace in trailing prose, or a second
 * object, produced an unparseable span.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('extractJsonObject', () => {
  it('extracts a bare object', () => {
    expect(JSON.parse(extractJsonObject('{"accuracy": 7}'))).toEqual({ accuracy: 7 });
  });

  it('strips ```json fences, including when prose precedes them', () => {
    const raw = 'Here is my evaluation:\n```json\n{"accuracy": 8}\n```\nHope that helps!';
    expect(JSON.parse(extractJsonObject(raw))).toEqual({ accuracy: 8 });
  });

  it('ignores trailing prose that contains a closing brace', () => {
    // The exact case the greedy pattern got wrong: it spanned to the final `}` in the commentary,
    // producing an unparseable string from a response the model had written correctly.
    const raw = '{"accuracy": 6}\n\nNote: the shape is `{ "accuracy": n }` as requested.';
    expect(JSON.parse(extractJsonObject(raw))).toEqual({ accuracy: 6 });
  });

  it('returns the first object when the model emits two', () => {
    const raw = '{"accuracy": 5}\n{"accuracy": 9}';
    expect(JSON.parse(extractJsonObject(raw))).toEqual({ accuracy: 5 });
  });

  it('handles nested objects', () => {
    const raw = 'prefix {"a": {"b": {"c": 1}}, "d": 2} suffix';
    expect(JSON.parse(extractJsonObject(raw))).toEqual({ a: { b: { c: 1 } }, d: 2 });
  });

  it('does not treat braces inside string values as structural', () => {
    const raw = '{"note": "candidate wrote } and { in the answer", "score": 4}';
    expect(JSON.parse(extractJsonObject(raw))).toEqual({
      note: 'candidate wrote } and { in the answer',
      score: 4,
    });
  });

  it('respects escaped quotes inside strings', () => {
    const raw = '{"quote": "they said \\"it depends\\" }", "score": 3}';
    expect(JSON.parse(extractJsonObject(raw))).toEqual({ quote: 'they said "it depends" }', score: 3 });
  });

  it('reports truncation distinctly rather than as generic malformed JSON', () => {
    // A truncated completion is a different failure with a different fix (raise the budget) than
    // a malformed one, so it must not be reported as the same thing.
    const truncated = '{"accuracy": 7, "dimensionEvidence": {"correctness": {"positiveEvidence": ["they exp';
    expect(() => extractJsonObject(truncated)).toThrow(/truncated/i);
  });

  it('reports a response with no object at all', () => {
    expect(() => extractJsonObject('I am unable to evaluate this answer.')).toThrow(/No JSON object/i);
  });

  it('tolerates null and empty input without crashing', () => {
    expect(() => extractJsonObject('')).toThrow(/No JSON object/i);
    expect(() => extractJsonObject(null as any)).toThrow(/No JSON object/i);
  });
});

describe('API-mode output budget', () => {
  const SITES: Array<[string, string]> = [
    ['client', 'src/Core/ai/openRouterClient.ts'],
    ['openrouter-proxy edge function', 'supabase/functions/openrouter-proxy/index.ts'],
    ['ai-fallback edge function', 'supabase/functions/ai-fallback/index.ts'],
    ['shared aiClient', 'supabase/functions/_shared/aiClient.ts'],
  ];

  it.each(SITES)('%s allows enough tokens for the evaluation schema', (_label, file) => {
    const src = code(file);
    let budgets = [...src.matchAll(/max_tokens[^\n]*?(\d{4})/gi)].map((m) => Number(m[1]));
    if (budgets.length === 0) {
      const sharedSrc = code('supabase/functions/_shared/aiClient.ts');
      budgets = [...sharedSrc.matchAll(/max_tokens[^\n]*?(\d{4})/gi)].map((m) => Number(m[1]));
    }
    expect(budgets.length).toBeGreaterThan(0);
    for (const budget of budgets) {
      expect(budget).toBeGreaterThanOrEqual(2000);
    }
  });

  it('a truncated completion is detected before it reaches the JSON parser', () => {
    // finish_reason === 'length' was never inspected, so a cut-off response was treated as a
    // success and surfaced as an opaque "Unexpected end of JSON input".
    const src = code('src/Core/api/apiService.ts');
    expect(src).toMatch(/finish_reason\s*===\s*['"]length['"]/);
    expect(src).toMatch(/TruncatedResponse/);
  });

  it('no evaluation path still uses the greedy first-brace-to-last-brace extraction', () => {
    const src = code('src/Core/api/apiService.ts');
    const greedy = [...src.matchAll(/match\(\/\\\{\[\\s\\S\]\*\\\}\//g)];
    expect(greedy).toHaveLength(0);
    // Both evaluation paths must use the shared extractor: submitAnswer and retryEvaluation.
    // (The declaration itself is an arrow assignment, so it does not match this call pattern.)
    expect([...src.matchAll(/extractJsonObject\(/g)].length).toBeGreaterThanOrEqual(2);
  });
});
