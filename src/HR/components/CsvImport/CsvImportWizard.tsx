// src/HR/components/CsvImport/CsvImportWizard.tsx
import { useState, useEffect } from "react";
import CsvUploadStep from "./CsvUploadStep";
import CsvPreviewStep from "./CsvPreviewStep";
import { useCsvValidation } from "./useCsvValidation";
import { importCandidates, ImportResult } from "../../services/csvImportService";

import DriveLinkShare from '../DriveLinkShare';

import { SupabaseService } from '../../../Core/database/supabaseService';
import { supabase } from "../../../Core/database/supabaseClient";


interface Props {
  driveId: string;
}

export default function CsvImportWizard({ driveId }: Props) {
  const { result, fileName, processFile, reset } = useCsvValidation();
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [driveAccessKey, setDriveAccessKey] = useState<string | null>(null);
  const [driveMode, setDriveMode] = useState<string>("LOCAL");

  // Fetch the drive's evaluation mode for batch cap display
  useEffect(() => {
    if (!driveId) return;
    const fetchMode = async () => {
      try {
        const { data } = await supabase
          .from("interview_drives")
          .select("evaluation_mode")
          .eq("id", driveId)
          .maybeSingle();
        if (data?.evaluation_mode) setDriveMode(data.evaluation_mode);
      } catch {
        /* ignore — defaults to LOCAL */
      }
    };
    void fetchMode();
  }, [driveId]);


  async function handleConfirm() {
  if (!result) return;

  setLoading(true);

  try {
    const res = await importCandidates(
      result.valid.map((r) => r.row),
      driveId
    );

    setImportResult(res);
    const key = await SupabaseService.getAccessKeyForDrive(driveId);
    if (key) setDriveAccessKey(key);
  } catch (err) {
    console.error("Import failed:", err);
  } finally {
    setLoading(false);
  }
}

  // Success screen
  if (importResult) return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Import complete</h2>

      <p>✅ {importResult.imported} candidates imported successfully</p>

      {driveAccessKey && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>
            Share this link with all {importResult.imported} candidates:
          </p>
          <DriveLinkShare driveTitle="Interview Drive" accessKey={driveAccessKey} />
        </div>
      )}

      {importResult.duplicates.length > 0 && (
        <div style={{ marginTop: 12, padding: "12px 16px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8 }}>
          <p style={{ fontWeight: 500, color: "#92400e", marginBottom: 6 }}>
            ⚠️ {importResult.duplicates.length} candidates already assigned to this drive (skipped):
          </p>
          <ul style={{ fontSize: 13, color: "#92400e", paddingLeft: 16 }}>
            {importResult.duplicates.map((email, i) => <li key={i}>{email}</li>)}
          </ul>
        </div>
      )}

      {importResult.errors.length > 0 && (
        <div style={{ marginTop: 12, padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
          <p style={{ fontWeight: 500, color: "#dc2626", marginBottom: 6 }}>❌ Failed to import:</p>
          <ul style={{ fontSize: 13, color: "#dc2626", paddingLeft: 16 }}>
            {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <button
        onClick={() => { setImportResult(null); reset(); }}
        style={{ marginTop: 20, padding: "8px 20px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer" }}
      >
        Import another file
      </button>
    </div>
  );

  // Main wizard
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Import candidates</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
        Upload a CSV with Name, Email, and College ID columns.
      </p>

      {!result ? (
        <CsvUploadStep onFile={processFile} />
      ) : (
        <>
          {loading && <p style={{ color: "#6366f1", marginBottom: 12 }}>Importing, please wait...</p>}
          <CsvPreviewStep
            result={result}
            fileName={fileName}
            evaluationMode={driveMode}
            onConfirm={handleConfirm}
            onReset={reset}
          />
        </>
      )}
    </div>
  );
}