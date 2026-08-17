// src/services/cleanupService.ts
import { supabase } from "../database/supabaseClient";

// ─────────────────────────────────────────────
// Called at end of saveEvaluationReport()
// Stamps the timestamp that starts the 7-day countdown
// ─────────────────────────────────────────────
export async function markReportGenerated(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("proctoring_events")
    .update({ report_generated_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .is("report_generated_at", null); // safety: only stamp once

  if (error) {
    console.error(
      `[Cleanup] Failed to mark report_generated_at for session ${sessionId}:`,
      error.message
    );
  } else {
    console.log(
      `[Cleanup] report_generated_at stamped for session ${sessionId}`
    );
  }
}