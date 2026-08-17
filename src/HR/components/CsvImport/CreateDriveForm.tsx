import { useState } from "react";
import { DriveRepository } from "../../../Core/database/driveRepository";
import { getLimitsForMode } from "../../../Evaluation/dispatch/pilotLimits";

interface CreateDriveFormProps {
  onCreated: (drive: {
    id: string;
    title: string;
    accessKey: string;
  }) => void;

  onCancel: () => void;
  createdBy?: string;
}

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function suggestAccessKey(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join("");
}

const ROLE_OPTIONS = [
  { value: "CSE",   label: "Computer Science Engineering (CSE)" },
  { value: "ETC",   label: "Electronics & Telecommunication (ETC)" },
  { value: "DS",    label: "Data Science (DS)" },
  { value: "AI",    label: "Artificial Intelligence (AI)" },
  { value: "CYBER", label: "Cyber Security (CYBER)" },
  { value: "EE",    label: "Electrical Engineering (EE)" },
  { value: "ME",    label: "Mechanical Engineering (ME)" },
  { value: "CE",    label: "Civil Engineering (CE)" },
  { value: "IT",    label: "Information Technology (IT)" },
];

const fieldLabel: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 500, color: "#334155", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1",
  borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" as const,
};

import { CandidateTargetProfile, CandidateTargetProfileOptions } from "../../../../types";

export default function CreateDriveForm({ onCreated, onCancel, createdBy }: CreateDriveFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("CSE");
  const [targetProfile, setTargetProfile] = useState<CandidateTargetProfile>("FRESHER");
  const [evaluationMode, setEvaluationMode] = useState<"LOCAL" | "AI" | "HYBRID">("LOCAL");
  const [accessKey, setAccessKey] = useState(suggestAccessKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  const normalisedKey = accessKey.trim().toUpperCase();
  const keyIsValid = /^[A-Z0-9]{6,10}$/.test(normalisedKey);
  const canSubmit = trimmedTitle.length >= 3 && keyIsValid && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const drive = await DriveRepository.createDrive({
        title: trimmedTitle,
        description: description.trim() || undefined,
        access_key: normalisedKey,
        created_by: createdBy,
        role,
        evaluation_mode: evaluationMode,
        metadata: { target_seniority_level: targetProfile }
      } as any);
      onCreated({ id: drive.id, title: trimmedTitle, accessKey: drive.access_key });

    } catch (err: any) {
      const message = String(err?.message || "");
      setError(
        message.toLowerCase().includes("duplicate") || err?.code === "23505"
          ? "That access key is already in use. Generate a new one and try again."
          : message || "Could not create the drive. Please try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Create an Interview Drive</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
        A drive groups candidates for one hiring round. It starts as a draft —
        nothing is visible to candidates until you activate it.
      </p>

      {/* Drive name */}
      <div style={{ marginBottom: 16 }}>
        <label style={fieldLabel} htmlFor="driveTitle">Drive name</label>
        <input
          id="driveTitle"
          style={inputStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Campus Hiring 2026 — Computer Science"
          maxLength={120}
          autoFocus
        />
        {title.length > 0 && trimmedTitle.length < 3 && (
          <p style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>Use at least 3 characters.</p>
        )}
      </div>

      {/* Description */}
      <div style={{ marginBottom: 16 }}>
        <label style={fieldLabel} htmlFor="driveDescription">
          Description <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span>
        </label>
        <input
          id="driveDescription"
          style={inputStyle}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Round 1 technical screening"
          maxLength={300}
        />
      </div>

      {/* Role */}
      <div style={{ marginBottom: 16 }}>
        <label style={fieldLabel} htmlFor="driveRole">Interview role</label>
        <select
          id="driveRole"
          style={inputStyle}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
          Determines which technical question set candidates receive.
        </p>
      </div>

      {/* Target Candidate Profile */}
      <div style={{ marginBottom: 16 }}>
        <label style={fieldLabel} htmlFor="targetProfile">Target Candidate Profile</label>
        <select
          id="targetProfile"
          style={inputStyle}
          value={targetProfile}
          onChange={(e) => setTargetProfile(e.target.value as CandidateTargetProfile)}
        >
          {CandidateTargetProfileOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label} — {opt.desc}</option>
          ))}
        </select>
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
          Calibrates role readiness assessment without modifying raw test scoring math.
        </p>
      </div>


      {/* Evaluation mode */}
      <div style={{ marginBottom: 16 }}>
        <label style={fieldLabel}>Evaluation mode</label>
        <div style={{ display: "flex", gap: 10 }}>
          {(["LOCAL", "AI", "HYBRID"] as const).map((mode) => (
            <label
              key={mode}
              style={{
                flex: 1, padding: "10px 14px",
                border: `2px solid ${evaluationMode === mode ? "#6366f1" : "#cbd5e1"}`,
                borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "flex-start", gap: 10,
                background: evaluationMode === mode ? "#eef2ff" : "#fff",
              }}
            >
              <input
                type="radio"
                name="evaluationMode"
                value={mode}
                checked={evaluationMode === mode}
                onChange={() => setEvaluationMode(mode)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>
                  {mode === "LOCAL" ? "Local mode" : mode === "AI" ? "AI mode" : "Hybrid mode"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {mode === "LOCAL"
                    ? "Fast heuristic scoring, no AI API calls"
                    : mode === "AI"
                    ? "AI-powered evaluation via OpenRouter"
                    : "Local scoring + AI verification combined"}
                </div>
              </div>
            </label>
          ))}
        </div>
        <p style={{ color: "#6366f1", fontSize: 12, marginTop: 8, fontWeight: 500 }}>
          Pilot limit: {getLimitsForMode(evaluationMode).maxCandidatesPerDrive} candidates max for {evaluationMode} mode
        </p>
      </div>

      {/* Access key */}
      <div style={{ marginBottom: 20 }}>
        <label style={fieldLabel} htmlFor="driveAccessKey">Access key</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="driveAccessKey"
            style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: 1.5, textTransform: "uppercase" }}
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            maxLength={10}
          />
          <button
            type="button"
            onClick={() => setAccessKey(suggestAccessKey())}
            style={{
              padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8,
              background: "#fff", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Regenerate
          </button>
        </div>
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
          Candidates enter this key to join. 6–10 letters and digits.
        </p>
        {accessKey.length > 0 && !keyIsValid && (
          <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>Use 6–10 letters and digits only.</p>
        )}
      </div>

      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c",
          borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: "10px 18px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 500,
            background: canSubmit ? "#6366f1" : "#c7d2fe",
            color: "#fff", cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {submitting ? "Creating…" : "Create drive"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          style={{
            padding: "10px 18px", borderRadius: 8, border: "1px solid #cbd5e1",
            background: "#fff", fontSize: 14, cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}