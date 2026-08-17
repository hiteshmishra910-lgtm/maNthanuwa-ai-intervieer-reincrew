import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const singleItemSchema = z.object({
  accuracy: z.number().optional().nullable(),
  relevanceScore: z.number().optional().nullable(),
  questionSatisfactionScore: z.number().optional().nullable(),
  conceptCoverage: z.number().optional().nullable(),
  conceptUnderstanding: z.number().optional().nullable(),
  reasoning: z.number().optional().nullable(),
  depth: z.number().optional().nullable(),
  clarity: z.number().optional().nullable(),
  structure: z.number().optional().nullable(),
  confidence: z.number().optional().nullable(),
  consistency: z.number().optional().nullable(),
  mentionedConcepts: z.array(z.string()).optional().nullable(),
  explainedConcepts: z.array(z.string()).optional().nullable(),
  missingKeyPoints: z.array(z.string()).optional().nullable(),
  positiveEvidence: z.any().optional().nullable(),
  technicalErrors: z.array(z.any()).optional().nullable()
}).passthrough();

/**
 * Extract the outermost JSON array from LLM output by bracket-depth counting.
 *
 * The previous greedy regex /\[[\s\S]*\]/ captured everything from the first `[` to
 * the LAST `]` in the response — including trailing explanation text like
 * `...]\n\nHere is the evaluation...` which caused JSON.parse to fail with
 * "Unexpected non-whitespace character after JSON".
 *
 * This function counts bracket depth to find the matching `]` for the first `[`,
 * producing a clean extract that JSON.parse can handle.
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

  // No matching bracket found — try the whole text (may be truncated)
  return text.substring(startIdx);
}

export function parseEvaluationResult(rawContent: string) {
  console.log(`[Hybrid] Parsing response (${rawContent.length} chars)`);

  let cleaned = rawContent.trim();

  // Strip markdown code fences (```json ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // Extract JSON array using bracket-depth counting (not greedy regex)
  const jsonArrayStr = extractJsonArray(cleaned);

  if (!jsonArrayStr) {
    // Last resort: try the entire cleaned content
    console.warn(`[Hybrid] No JSON array found via bracket matching. Raw content starts with: "${cleaned.substring(0, 100)}..."`);
    throw new Error(`No JSON array found in LLM response. The model returned non-JSON content (${rawContent.length} chars). This usually means the API key has no credits or the model is unavailable.`);
  }

  let parsedJson: any;
  try {
    parsedJson = JSON.parse(jsonArrayStr);
  } catch (e: any) {
    console.warn(`[Hybrid] JSON parse failed. Extracted string starts with: "${jsonArrayStr.substring(0, 150)}..."`);
    throw new Error(`Failed to parse JSON: ${e.message}. The LLM response may be truncated or malformed.`, { cause: e });
  }

  // Handle case where LLM returned a JSON object containing the array (e.g. { "items": [...] }, { "evaluations": [...] })
  if (!Array.isArray(parsedJson) && parsedJson && typeof parsedJson === 'object') {
    const candidateArray = parsedJson.items || parsedJson.results || parsedJson.evaluations || parsedJson.records || Object.values(parsedJson).find((v: any) => Array.isArray(v));
    if (Array.isArray(candidateArray)) {
      parsedJson = candidateArray;
    }
  }

  // Edge case: LLM returned a single element inside an array
  if (Array.isArray(parsedJson) && parsedJson.length === 1) {
    if (typeof parsedJson[0] === 'string') {
      const innerStr = parsedJson[0].trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        const innerParsed = JSON.parse(innerStr);
        if (Array.isArray(innerParsed)) {
          console.warn(`[Hybrid] Detected double-stringified array — unwrapping ${innerParsed.length} items`);
          parsedJson = innerParsed;
        } else if (typeof innerParsed === 'object' && innerParsed !== null) {
          const nested = innerParsed.items || innerParsed.results || innerParsed.evaluations || Object.values(innerParsed).find((v: any) => Array.isArray(v));
          if (Array.isArray(nested)) {
            console.warn(`[Hybrid] Detected stringified object with nested array — unwrapping ${nested.length} items`);
            parsedJson = nested;
          } else {
            parsedJson = [innerParsed];
          }
        }
      } catch (_) {
        console.warn(`[Hybrid] Single string item could not be unwrapped, will fail validation below`);
      }
    } else if (typeof parsedJson[0] === 'object' && parsedJson[0] !== null) {
      // Check if this single object is a wrapper containing a nested array (e.g. [{ "evaluations": [...] }])
      const nested = parsedJson[0].items || parsedJson[0].results || parsedJson[0].evaluations || parsedJson[0].records || Object.values(parsedJson[0]).find((v: any) => Array.isArray(v));
      if (Array.isArray(nested)) {
        console.warn(`[Hybrid] Detected single-element array containing object with nested array — unwrapping ${nested.length} items`);
        parsedJson = nested;
      }
    }
  }

  if (!Array.isArray(parsedJson)) {
    throw new Error('Parsed LLM response is not a JSON array');
  }

  const validItems: any[] = [];
  const parseErrors: string[] = [];

  for (let i = 0; i < parsedJson.length; i++) {
    let item = parsedJson[i];

    // If item is a stringified JSON string (or wrapped in quotes/fences), parse it into an object
    if (typeof item === 'string') {
      const cleanedItem = item.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        item = JSON.parse(cleanedItem);
      } catch (_) {
        // If string cannot be parsed as JSON, keep original item (will fail Zod validation gracefully)
      }
    }

    const validationResult = singleItemSchema.safeParse(item);

    if (validationResult.success) {
      const data = validationResult.data;
      const accuracy = typeof data.accuracy === 'number' ? data.accuracy : 5;
      const relevanceScore = typeof data.relevanceScore === 'number' ? data.relevanceScore : accuracy;
      const questionSatisfactionScore = typeof data.questionSatisfactionScore === 'number' ? data.questionSatisfactionScore : accuracy;

      if (data.accuracy === undefined || data.accuracy === null || data.relevanceScore === undefined || data.relevanceScore === null) {
        console.warn(`[Hybrid] Question ${i + 1} omitted primary metrics - inferring from available accuracy (${accuracy})`);
      }

      validItems.push({
        ...data,
        accuracy,
        relevanceScore,
        questionSatisfactionScore,
        rawMissingFields: {
          accuracy: data.accuracy === undefined || data.accuracy === null,
          relevanceScore: data.relevanceScore === undefined || data.relevanceScore === null,
          questionSatisfactionScore: data.questionSatisfactionScore === undefined || data.questionSatisfactionScore === null,
        }
      });
    } else {
      console.warn(`[Hybrid] Question ${i + 1} schema validation failed - skipping item: ${validationResult.error.message}`);
      parseErrors.push(`Item ${i + 1}: ${validationResult.error.message}`);
    }
  }

  if (validItems.length === 0) {
    throw new Error(`Schema validation failed for all ${parsedJson.length} items in batch: ${parseErrors.join("; ")}`);
  }

  console.log(`[Hybrid] Parsing complete: ${validItems.length}/${parsedJson.length} valid items recovered.`);
  return validItems;
}
