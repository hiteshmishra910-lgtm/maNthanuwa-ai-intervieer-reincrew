import React, { useState } from 'react';
import { getCandidateJoinLink, copyToClipboard, buildShareText } from '../../Core/utils/driveLinks';

interface DriveLinkShareProps {
  driveTitle: string;
  accessKey: string;
}

export default function DriveLinkShare({ driveTitle, accessKey }: DriveLinkShareProps) {
  const [copied, setCopied] = useState<'link' | 'key' | null>(null);
  const link = getCandidateJoinLink(accessKey);

  async function handleCopy(value: string, which: 'link' | 'key') {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  const shareText = buildShareText(driveTitle, link, accessKey);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const mailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(`Interview invite: ${driveTitle}`)}&body=${encodeURIComponent(shareText)}`;
  
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, background: '#f8fafc' }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
        Candidate join link
      </label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          style={{
            flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8,
            fontSize: 13, fontFamily: 'monospace', background: '#fff',
          }}
        />
        <button
          type="button"
          onClick={() => handleCopy(link, 'link')}
          style={{
            padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1',
            background: copied === 'link' ? '#dcfce7' : '#fff', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {copied === 'link' ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>Access key:</span>
        <code style={{ fontSize: 13, fontFamily: 'monospace', letterSpacing: 1 }}>{accessKey}</code>
        <button
          type="button"
          onClick={() => handleCopy(accessKey, 'key')}
          style={{
            padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
            background: copied === 'key' ? '#dcfce7' : '#fff', fontSize: 12, cursor: 'pointer',
          }}
        >
          {copied === 'key' ? 'Copied!' : 'Copy key'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
           style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, textDecoration: 'none', color: '#1e293b' }}>
          Share via WhatsApp
        </a>
        <a href={mailUrl}
           style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 13, textDecoration: 'none', color: '#1e293b' }}>
          Share via Email
        </a>
      </div>
    </div>
  );
}