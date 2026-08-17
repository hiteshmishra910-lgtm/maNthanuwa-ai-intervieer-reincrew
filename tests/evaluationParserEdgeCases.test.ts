import { describe, it, expect } from 'vitest';

/**
 * Mirror of parseEvaluationResult parsing and unwrapping logic for node/vitest environment testing.
 */
function extractJsonArray(text: string): string | null {
  const startIdx = text.indexOf('[');
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        return text.substring(startIdx, i + 1);
      }
    }
  }
  return text.substring(startIdx);
}

function testParseEvaluation(rawContent: string) {
  let cleaned = rawContent.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  const jsonArrayStr = extractJsonArray(cleaned);
  if (!jsonArrayStr) {
    throw new Error('No JSON array found in LLM response');
  }

  let parsedJson: any;
  try {
    parsedJson = JSON.parse(jsonArrayStr);
  } catch (e: any) {
    throw new Error(`Failed to parse JSON: ${e.message}`, { cause: e });
  }

  if (!Array.isArray(parsedJson) && parsedJson && typeof parsedJson === 'object') {
    const candidateArray = parsedJson.items || parsedJson.results || parsedJson.evaluations || parsedJson.records || Object.values(parsedJson).find((v: any) => Array.isArray(v));
    if (Array.isArray(candidateArray)) {
      parsedJson = candidateArray;
    }
  }

  if (Array.isArray(parsedJson) && parsedJson.length === 1) {
    if (typeof parsedJson[0] === 'string') {
      const innerStr = parsedJson[0].trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        const innerParsed = JSON.parse(innerStr);
        if (Array.isArray(innerParsed)) {
          parsedJson = innerParsed;
        } else if (typeof innerParsed === 'object' && innerParsed !== null) {
          const nested = innerParsed.items || innerParsed.results || innerParsed.evaluations || Object.values(innerParsed).find((v: any) => Array.isArray(v));
          if (Array.isArray(nested)) {
            parsedJson = nested;
          } else {
            parsedJson = [innerParsed];
          }
        }
      } catch (_) {
        // Ignored
      }
    } else if (typeof parsedJson[0] === 'object' && parsedJson[0] !== null) {
      const nested = parsedJson[0].items || parsedJson[0].results || parsedJson[0].evaluations || parsedJson[0].records || Object.values(parsedJson[0]).find((v: any) => Array.isArray(v));
      if (Array.isArray(nested)) {
        parsedJson = nested;
      }
    }
  }

  if (!Array.isArray(parsedJson)) {
    throw new Error('Parsed LLM response is not a JSON array');
  }

  return parsedJson;
}

describe('Free LLM Evaluation Parser Edge-Case Resilience Suite', () => {
  it('1. Parses normal JSON array of evaluation objects', () => {
    const raw = '[{"accuracy": 8, "relevanceScore": 9}]';
    const result = testParseEvaluation(raw);
    expect(result).toHaveLength(1);
    expect(result[0].accuracy).toBe(8);
  });

  it('2. Unwraps markdown code fences with leading/trailing commentary', () => {
    const raw = 'Here is the evaluation:\n```json\n[{"accuracy": 7}]\n```\nHope this helps!';
    const result = testParseEvaluation(raw);
    expect(result).toHaveLength(1);
    expect(result[0].accuracy).toBe(7);
  });

  it('3. Unwraps double-stringified array e.g. ["[{...}]"] (common with free OpenRouter models)', () => {
    const raw = '["[{\\"accuracy\\": 9, \\"relevanceScore\\": 8}]"]';
    const result = testParseEvaluation(raw);
    expect(result).toHaveLength(1);
    expect(result[0].accuracy).toBe(9);
  });

  it('4. Unwraps single-element array containing object with nested evaluations array', () => {
    const raw = '[{"evaluations": [{"accuracy": 10}]}]';
    const result = testParseEvaluation(raw);
    expect(result).toHaveLength(1);
    expect(result[0].accuracy).toBe(10);
  });

  it('5. Unwraps single-element array containing stringified object with nested items', () => {
    const raw = '["{\\"items\\": [{\\"accuracy\\": 6}]}"]';
    const result = testParseEvaluation(raw);
    expect(result).toHaveLength(1);
    expect(result[0].accuracy).toBe(6);
  });

  it('6. Predictably throws Error on unparseable malformed JSON', () => {
    const raw = '[{"accuracy": 8, "relevanceScore": }]';
    expect(() => testParseEvaluation(raw)).toThrow(/Failed to parse JSON/);
  });

  it('7. Predictably throws Error on non-JSON prose response', () => {
    const raw = 'I am sorry, as an AI language model I cannot perform this task.';
    expect(() => testParseEvaluation(raw)).toThrow(/No JSON array found/);
  });

  it('8. Predictably throws Error on empty content', () => {
    const raw = '   ';
    expect(() => testParseEvaluation(raw)).toThrow(/No JSON array found/);
  });
});
