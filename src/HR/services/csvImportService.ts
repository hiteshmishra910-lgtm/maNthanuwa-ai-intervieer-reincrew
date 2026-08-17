// src/HR/services/csvImportService.ts
import { supabase } from "../../Core/database/supabaseClient";
import { CsvRow } from "../components/CsvImport/useCsvValidation";
import { getLimitsForMode } from "../../Evaluation/dispatch/pilotLimits";

export interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: string[];
  errors: string[];
}

async function upsertCandidate(row: CsvRow): Promise<string | null> {
  const email = row.email.toLowerCase().trim();
  const { data: existing } = await supabase
    .from("candidates")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("candidates")
    .insert({ name: row.name, email })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to insert candidate ${email}: ${error.message}`);
  return data.id;
}

async function isAlreadyAssigned(candidateId: string, driveId: string): Promise<boolean> {
  const { data } = await supabase
    .from("candidate_assignments")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("drive_id", driveId)
    .maybeSingle();
  return !!data;
}

async function assignToDrive(candidateId: string, driveId: string, row: CsvRow): Promise<"inserted" | "duplicate"> {
  // Check first to avoid Supabase logging a 23505 constraint error to console
  const already = await isAlreadyAssigned(candidateId, driveId);
  if (already) return "duplicate";

  const { error } = await supabase.from("candidate_assignments").insert({
    drive_id: driveId,
    candidate_id: candidateId,
    college_id: row.collegeId,
    college_email: row.email.toLowerCase().trim(),
    status: "INVITED",
  });

  if (error) throw new Error(`Failed to assign ${row.email}: ${error.message}`);
  return "inserted";
}

export async function importCandidates(rows: CsvRow[], driveId: string): Promise<ImportResult> {
  if (!driveId) throw new Error("No drive selected.");

  // ── Pilot batch cap: fetch drive mode and check total against limit ──
  const { data: drive } = await supabase
    .from("interview_drives")
    .select("evaluation_mode")
    .eq("id", driveId)
    .maybeSingle();

  const mode = (drive as any)?.evaluation_mode || "LOCAL";
  const limits = getLimitsForMode(mode);

  // Count existing assignments for this drive
  const { count: existingCount } = await supabase
    .from("candidate_assignments")
    .select("*", { count: "exact", head: true })
    .eq("drive_id", driveId);

  const totalAfterImport = (existingCount || 0) + rows.length;
  if (totalAfterImport > limits.maxCandidatesPerDrive) {
    console.warn(
      `[CsvImport] Batch cap warning: ${mode} mode allows ${limits.maxCandidatesPerDrive} candidates per drive. ` +
      `Current: ${existingCount}, importing: ${rows.length}, total would be: ${totalAfterImport}. ` +
      `Import proceeding — enforce at pilot review.`
    );
    // For pilot: warn but don't block. Remove this soft-check and throw when pilot is ready.
  }

  const result: ImportResult = { imported: 0, skipped: 0, duplicates: [], errors: [] };

  await Promise.all(
    rows.map(async (row) => {
      try {
        const candidateId = await upsertCandidate(row);
        if (!candidateId) { result.skipped++; return; }
        const status = await assignToDrive(candidateId, driveId, row);
        if (status === "duplicate") {
          result.duplicates.push(row.email);
          result.skipped++;
        } else {
          result.imported++;
        }
      } catch (err: any) {
        result.errors.push(err.message);
        result.skipped++;
      }
    })
  );

  // Update total_candidates count on the drive
  const { count: totalCount } = await supabase
    .from('candidate_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('drive_id', driveId);

  await supabase
    .from('interview_drives')
    .update({ total_candidates: totalCount ?? 0 })
    .eq('id', driveId);

  return result;
}