// src/HR/components/CsvImport/CsvUploadStep.tsx
import { useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
}

export default function CsvUploadStep({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    if (file?.name.endsWith(".csv")) onFile(file);
    else alert("Please upload a .csv file");
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${dragging ? "#6366f1" : "#cbd5e1"}`,
        borderRadius: 12,
        padding: "48px 24px",
        textAlign: "center",
        cursor: "pointer",
        background: dragging ? "#eef2ff" : "#f8fafc",
        transition: "all 0.2s",
      }}
    >
      <p style={{ fontSize: 16, color: "#475569", marginBottom: 8 }}>
        Drag & drop a CSV file here, or <span style={{ color: "#6366f1" }}>browse</span>
      </p>
      <p style={{ fontSize: 13, color: "#94a3b8" }}>Required columns: Name, Email, College ID</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}