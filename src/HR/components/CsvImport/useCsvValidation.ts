// src/HR/components/CsvImport/useCsvValidation.ts
import { useState } from "react";
import Papa from "papaparse";

export interface CsvRow {
  name: string;
  email: string;
  collegeId: string;
}

export interface ValidatedRow {
  row: CsvRow;
  index: number;
  errors: string[];
}

export interface ValidationResult {
  valid: ValidatedRow[];
  invalid: ValidatedRow[];
}

function validateRows(rows: Record<string, string>[]): ValidationResult {
  const seenEmails = new Set<string>();
  const seenIds = new Set<string>();
  const valid: ValidatedRow[] = [];
  const invalid: ValidatedRow[] = [];

  rows.forEach((raw, index) => {
    const row: CsvRow = {
      name: raw["name"] ?? "",
      email: raw["email"] ?? "",
      collegeId: raw["college id"] ?? raw["collegeid"] ?? raw["college_id"] ?? "",
    };
    const errors: string[] = [];

    if (!row.name) errors.push("Missing name");
    if (!row.email) errors.push("Missing email");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("Invalid email");
    else if (seenEmails.has(row.email.toLowerCase())) errors.push("Duplicate email");
    else seenEmails.add(row.email.toLowerCase());

    if (!row.collegeId) errors.push("Missing college ID");
    else if (seenIds.has(row.collegeId)) errors.push("Duplicate college ID");
    else seenIds.add(row.collegeId);

    const entry = { row, index: index + 1, errors };
    // Was a ternary used for its side effects, which reads as a value expression that was
    // accidentally discarded. Same behaviour, stated as the branch it actually is.
    if (errors.length) invalid.push(entry);
    else valid.push(entry);
  });

  return { valid, invalid };
}

export function useCsvValidation() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [fileName, setFileName] = useState("");

  function processFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: ({ data }) => setResult(validateRows(data)),
    });
  }

  function reset() {
    setResult(null);
    setFileName("");
  }

  return { result, fileName, processFile, reset };
}