import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * PHASE 3 regression guard: a recruiter must be able to create an interview drive.
 *
 * Before this fix there was no drive-creation UI anywhere in the application. DriveSelector only
 * SELECTed existing drives and, when the list was empty, rendered
 *   "No active drives found. Create a drive first."
 * pointing at a screen that did not exist. DriveRepository.createDrive() was fully implemented
 * but the module was dead code, imported nowhere.
 *
 * Production matched that exactly: interview_drives = 0 rows, drive_access_keys = 0 rows. The
 * entire downstream workflow (access keys, candidate join, CSV import) was unreachable because
 * the first step could not be performed.
 *
 * These are static-source assertions — the components need React + a live Supabase client to
 * render — but they pin the properties that actually regressed.
 */

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('Phase 3: recruiter can create an interview drive', () => {
  const selector = read('src/HR/components/CsvImport/DriveSelector.tsx');
  const form = read('src/HR/components/CsvImport/CreateDriveForm.tsx');

  it('DriveRepository is no longer dead code — the creation form imports it', () => {
    expect(form).toContain("from \"../../../Core/database/driveRepository\"");
    expect(form).toContain('DriveRepository.createDrive');
  });

  it('DriveSelector renders the creation form instead of a dead end', () => {
    expect(selector).toContain('CreateDriveForm');
    // The old dead-end copy must be gone.
    expect(selector).not.toContain('No active drives found. Create a drive first.');
  });

  it('offers drive creation both when the list is empty and when it is populated', () => {
    // Empty state gets a primary action...
    expect(selector).toContain('Create a drive');
    // ...and the populated list keeps an affordance so a second drive can be added.
    expect(selector).toContain('+ New drive');
  });

  it('refreshes the list after creation rather than leaving stale state', () => {
    expect(selector).toMatch(/handleDriveCreated[\s\S]{0,200}fetchDrives\(\)/);
  });

  it('creates the drive and its access key together', () => {
    const repo = read('src/Core/database/driveRepository.ts');
    expect(repo).toContain("from('interview_drives')");
    expect(repo).toContain("from('drive_access_keys')");
  });

  it('generates access keys without ambiguous characters', () => {
    // Candidates type these by hand on the join screen, so I/O/0/1 must not appear.
    const alphabet = form.match(/KEY_ALPHABET\s*=\s*"([^"]+)"/)?.[1];
    expect(alphabet).toBeTruthy();
    for (const ch of ['I', 'O', '0', '1']) {
      expect(alphabet).not.toContain(ch);
    }
  });

  it('validates the access key against the stored (uppercased) form', () => {
    // createDrive() uppercases before insert, so validating the raw input would reject
    // lowercase entry that would actually have succeeded.
    expect(form).toContain('normalisedKey');
    expect(form).toMatch(/\/\^\[A-Z0-9\]\{6,10\}\$\/\.test\(normalisedKey\)/);
  });

  it('surfaces a duplicate-key failure as an actionable message', () => {
    expect(form).toContain('23505');
    expect(form).toMatch(/already in use/i);
  });
});
