import type { BatchLLMResult } from './types';

// We use 'any' or an imported type for MasterEvaluationReport.
// To keep this strictly environment-agnostic, we can assume the shape.
export function mergeBatchLLMResult(
  heuristicReport: any, 
  llmResult: BatchLLMResult, 
  promptVersion: string = "batch-v1"
): any {
  // Clone the report to avoid mutating the original
  const mergedReport = JSON.parse(JSON.stringify(heuristicReport));

  // Replace the heuristic summary with the richer LLM summary
  if (mergedReport.executiveSummary) {
    mergedReport.executiveSummary.summary = llmResult.overallSummary;
    
    // Update metadata to track prompt version
    mergedReport.metadata = {
      ...(mergedReport.metadata || {}),
      promptVersion,
      hybridSynthesis: 'success'
    };
  }

  // PHASE 6: the LLM narrative becomes the headline, but the heuristic lists are retained
  // rather than destroyed.
  //
  // These two assignments previously discarded the local engine's output outright. Those lists
  // are derived from concepts the candidate demonstrably matched (ReportGenerator builds them
  // from matchedConceptsSet / missedConceptsSet), whereas the LLM's are free-text and can
  // include claims not present in the transcript. Overwriting them left no way to check the
  // narrative against the evidence, which is exactly what a disputed score needs.
  //
  // Displayed fields keep the LLM values, so this is not a behaviour change for the report UI.
  mergedReport.heuristicStrengths = heuristicReport?.strengths ?? [];
  mergedReport.heuristicWeaknesses = heuristicReport?.weaknesses ?? [];
  mergedReport.strengths = llmResult.strengths;
  mergedReport.weaknesses = llmResult.weaknesses;

  // Optional: Overwrite or append recommendations
  if (llmResult.recommendations && llmResult.recommendations.length > 0) {
    mergedReport.topImprovements = llmResult.recommendations;
  }

  return mergedReport;
}
