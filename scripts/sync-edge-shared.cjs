/**
 * sync-edge-shared.cjs
 *
 * Recursively mirrors root shared/ → supabase/functions/_shared_generated/
 * This is a BUILD STEP. _shared_generated/ is a generated artifact — never edit it manually.
 *
 * Usage:
 *   node scripts/sync-edge-shared.cjs
 *
 * Must be run before:
 *   supabase functions deploy
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../shared');
const DEST = path.resolve(__dirname, '../supabase/functions/_shared_generated');
const AUTO_HEADER = '// AUTO-GENERATED FILE — DO NOT EDIT.\n// Source: shared/';

// ── Fail fast ──────────────────────────────────────────────────────────────
if (!fs.existsSync(SRC)) {
  console.error(`[SyncShared] FATAL: Source directory does not exist: ${SRC}`);
  process.exit(1);
}

// ── Clean destination completely (it is 100% generated) ────────────────────
if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
}

// ── Recursive mirror ───────────────────────────────────────────────────────
function syncDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      syncDir(srcPath, destPath);
    } else {
      const content = fs.readFileSync(srcPath, 'utf-8');
      const header = `${AUTO_HEADER}${entry.name}\n\n`;
      fs.writeFileSync(destPath, header + content, 'utf-8');
    }
  }
}

syncDir(SRC, DEST);

// ── Summary ────────────────────────────────────────────────────────────────
const fileCount = fs.readdirSync(DEST).length;
console.log(`[SyncShared] ✓ Mirrored ${fileCount} files: shared/ → supabase/functions/_shared_generated/`);
