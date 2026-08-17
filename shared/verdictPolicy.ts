/**
 * Centralized Verdict Policy
 * 
 * Single source of truth for mapping a raw evaluation score (0-10) to a canonical database verdict.
 * Enforces the database constraint of ('Pass', 'Borderline', 'Fail').
 */

export type DatabaseVerdict = "Pass" | "Borderline" | "Fail";

/**
 * Determines the final canonical verdict for a single question based on its technical score.
 * @param score Technical accuracy/content score from 0 to 10
 * @returns {DatabaseVerdict} The canonical verdict safe for database insertion
 */
export function determineVerdict(score: number): DatabaseVerdict {
  if (score >= 7) {
    return "Pass";
  }
  if (score >= 5) {
    return "Borderline";
  }
  return "Fail";
}
