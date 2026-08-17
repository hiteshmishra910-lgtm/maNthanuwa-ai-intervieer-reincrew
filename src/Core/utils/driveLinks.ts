// src/Core/utils/driveLinks.ts

/**
 * Path (relative to origin) where candidates land to enter their access key.
 * ⚠️ Check App.tsx for the actual route JoinDriveScreen is mounted on and
 * adjust this if it isn't "/join".
 */
const CANDIDATE_JOIN_PATH = '/join';

export function getCandidateJoinLink(accessKey: string): string {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : '';
  const key = accessKey.trim().toUpperCase();
  return `${origin}${CANDIDATE_JOIN_PATH}?key=${encodeURIComponent(key)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function buildShareText(driveTitle: string, link: string, accessKey: string): string {
  return `You've been invited to an interview: ${driveTitle}\n\nJoin here: ${link}\n\nAccess key (if asked): ${accessKey}`;
}