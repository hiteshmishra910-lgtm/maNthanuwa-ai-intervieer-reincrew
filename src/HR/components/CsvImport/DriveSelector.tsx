// src/HR/components/CsvImport/DriveSelector.tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../../Core/database/supabaseClient";
import CsvImportWizard from "./CsvImportWizard";
import CreateDriveForm from "./CreateDriveForm";
import { useUser } from '@clerk/clerk-react';

interface Drive {
  id: string;
  title: string;
  status: string;
}

export default function DriveSelector() {
  const { user } = useUser();
  const hrEmail = user?.primaryEmailAddress?.emailAddress ?? '';
  const [searchParams] = useSearchParams();
  const [drives, setDrives] = useState<Drive[]>([]);
  const preselectedDriveId = searchParams.get('driveId');
  const [selectedDriveId, setSelectedDriveId] = useState<string>(preselectedDriveId ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  async function fetchDrives() {
    const { data, error } = await supabase
      .from("interview_drives")
      .select("id, title, status")
      .in("status", ["DRAFT", "SCHEDULED", "ACTIVE"])
      .eq("created_by", hrEmail)
      .order("created_at", { ascending: false });

    if (error) setError("Failed to load drives.");
    else {
      setError(null);
      setDrives(data ?? []);
    }
    setLoading(false);
  }

  function handleDriveCreated() {
    setShowCreateModal(false);
    fetchDrives();
  }

  useEffect(() => {
     if (hrEmail) fetchDrives();
  }, [hrEmail]);

  if (loading) return <p style={{ padding: 24, color: "#64748b" }}>Loading drives...</p>;
  if (error) return <p style={{ padding: 24, color: "#dc2626" }}>{error}</p>;

  if (drives.length === 0) {
      return (
      <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
        <button
          onClick={() => window.location.href = '/hr/dashboard'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 13, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Dashboard
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>No drives yet</h2>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
          Create an interview drive to get started importing candidates.
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
          Create a drive
        </button>
        {showCreateModal && (
          <CreateDriveForm
            createdBy={hrEmail}
            onCancel={() => setShowCreateModal(false)}
            onCreated={handleDriveCreated}
          />
        )}
      </div>
    );
  }

  async function toggleDriveStatus(e: React.MouseEvent, drive: Drive) {
    e.stopPropagation();
    const newStatus = drive.status === "ACTIVE" ? "DRAFT" : "ACTIVE";
    const { error } = await supabase
      .from("interview_drives")
      .update({ status: newStatus })
      .eq("id", drive.id);

    if (!error) {
      setDrives((prev) =>
        prev.map((d) => (d.id === drive.id ? { ...d, status: newStatus } : d))
      );
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
      <button
      onClick={() => window.location.href = '/hr/dashboard'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 20, fontSize: 13, color: '#6366f1',
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
      </svg>
      Back to Dashboard
    </button>
      {!selectedDriveId ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Select a Drive</h2>
              <p style={{ color: "#64748b", fontSize: 14 }}>
                Choose the interview drive you want to import candidates into.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              + New drive
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {drives.map((drive) => (
              <div
                key={drive.id}
                onClick={() => setSelectedDriveId(drive.id)}
                style={{
                  padding: "16px 20px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#fff",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
              >
                <div>
                  <p style={{ fontWeight: 500, fontSize: 15 }}>{drive.title}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={(e) => toggleDriveStatus(e, drive)}
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      cursor: "pointer",
                    }}
                  >
                    {drive.status === "ACTIVE" ? "Set Draft" : "Activate"}
                  </button>
                  <span style={{
                    fontSize: 12,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: drive.status === "ACTIVE" ? "#dcfce7" : "#f1f5f9",
                    color: drive.status === "ACTIVE" ? "#16a34a" : "#64748b",
                  }}>
                    {drive.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            onClick={() => setSelectedDriveId("")}
            style={{ marginBottom: 16, fontSize: 13, color: "#6366f1", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ← Change drive
          </button>
          <CsvImportWizard driveId={selectedDriveId} />
        </>
      )}

      {showCreateModal && (
        <CreateDriveForm
          createdBy={hrEmail}
          onCancel={() => setShowCreateModal(false)}
          onCreated={handleDriveCreated}
        />
      )}
    </div>
  );
}