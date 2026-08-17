// src/HR/components/CsvImport/CsvPreviewStep.tsx
import React from "react";
import { ValidationResult } from "./useCsvValidation";
import { getLimitsForMode } from "../../../Evaluation/dispatch/pilotLimits";

interface Props {
  result: ValidationResult;
  fileName: string;
  evaluationMode?: string;
  onConfirm: () => void;
  onReset: () => void;
}

const th: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontSize: 13, color: "#64748b", borderBottom: "1px solid #e2e8f0" };
const td: React.CSSProperties = { padding: "8px 12px", fontSize: 13 };

export default function CsvPreviewStep({ result, fileName, evaluationMode, onConfirm, onReset }: Props) {
  const { valid, invalid } = result;
  const limits = getLimitsForMode(evaluationMode || 'LOCAL');
  const exceedsCap = valid.length > limits.maxCandidatesPerDrive;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary */}
      <div style={{ display: "flex", gap: 12 }}>
        <Chip color="#dcfce7" text={`✅ ${valid.length} valid`} />
        <Chip color="#fee2e2" text={`❌ ${invalid.length} invalid`} />
        <Chip color="#f1f5f9" text={`📄 ${fileName}`} />
      </div>

      {/* Pilot batch cap warning */}
      {exceedsCap && (
        <div style={{
          background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
          padding: "12px 16px", fontSize: 13, color: "#92400e",
        }}>
          <strong>⚠️ Batch size exceeds pilot limit for {evaluationMode || 'LOCAL'} mode.</strong>
          <p style={{ marginTop: 4 }}>
            Recommended max: <strong>{limits.maxCandidatesPerDrive}</strong> candidates.
            You're importing <strong>{valid.length}</strong>. This may overload the evaluation pipeline.
          </p>
          <p style={{ marginTop: 4, fontSize: 12 }}>
            Consider splitting into smaller batches or switching to LOCAL mode for large cohorts.
          </p>
        </div>
      )}

      {/* Invalid rows */}
      {invalid.length > 0 && (
        <section>
          <p style={{ fontWeight: 600, color: "#dc2626", marginBottom: 8 }}>Rows with errors (will be skipped)</p>
          <Table>
            <thead><tr><th style={th}>#</th><th style={th}>Name</th><th style={th}>Email</th><th style={th}>College ID</th><th style={th}>Errors</th></tr></thead>
            <tbody>
              {invalid.map(({ row, index, errors }) => (
                <tr key={index} style={{ background: "#fff5f5" }}>
                  <td style={td}>{index}</td>
                  <td style={td}>{row.name || "—"}</td>
                  <td style={td}>{row.email || "—"}</td>
                  <td style={td}>{row.collegeId || "—"}</td>
                  <td style={{ ...td, color: "#dc2626" }}>{errors.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {/* Valid rows */}
      {valid.length > 0 && (
        <section>
          <p style={{ fontWeight: 600, color: "#16a34a", marginBottom: 8 }}>Valid candidates</p>
          <Table>
            <thead><tr><th style={th}>#</th><th style={th}>Name</th><th style={th}>Email</th><th style={th}>College ID</th></tr></thead>
            <tbody>
              {valid.map(({ row, index }) => (
                <tr key={index}>
                  <td style={td}>{index}</td>
                  <td style={td}>{row.name}</td>
                  <td style={td}>{row.email}</td>
                  <td style={td}>{row.collegeId}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button onClick={onReset} style={{ padding: "8px 20px", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", background: "#fff" }}>
          Upload different file
        </button>
        <button
          onClick={onConfirm}
          disabled={valid.length === 0}
          style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: valid.length ? "pointer" : "not-allowed", background: valid.length ? "#6366f1" : "#c7d2fe", color: "#fff" }}
        >
          Import {valid.length} candidates
        </button>
      </div>
    </div>
  );
}

function Chip({ color, text }: { color: string; text: string }) {
  return <span style={{ background: color, borderRadius: 6, padding: "4px 10px", fontSize: 13 }}>{text}</span>;
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
    </div>
  );
}