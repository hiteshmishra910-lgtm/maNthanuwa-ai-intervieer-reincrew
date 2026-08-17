import React, { useState } from 'react';
import { SupabaseService } from '../../Core/database/supabaseService';
import { getCandidateJoinLink, copyToClipboard } from '../../Core/utils/driveLinks';

interface CopyDriveLinkButtonProps {
  driveId: string;
  label?: string;
}

export default function CopyDriveLinkButton({ driveId, label = 'Copy join link' }: CopyDriveLinkButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');

  async function handleClick() {
    setState('loading');
    try {
      const accessKey = await SupabaseService.getAccessKeyForDrive(driveId);
      if (!accessKey) {
        setState('error');
        return;
      }
      const ok = await copyToClipboard(getCandidateJoinLink(accessKey));
      setState(ok ? 'copied' : 'error');
    } catch {
      setState('error');
    } finally {
      setTimeout(() => setState('idle'), 2000);
    }
  }

  const text = state === 'loading' ? 'Copying…' : state === 'copied' ? 'Copied!' : state === 'error' ? 'No active key' : label;

  return (
    <button type="button" onClick={handleClick} disabled={state === 'loading'}
      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: state === 'copied' ? '#dcfce7' : '#fff', fontSize: 12, cursor: state === 'loading' ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
      {text}
    </button>
  );
}