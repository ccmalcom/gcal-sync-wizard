'use client';

import { useState } from 'react';

export type TroubleshootItem = {
  symptom: string;
  fix: string;
};

export type ExecuteStepDef = {
  title: string;
  body: React.ReactNode;
  copyContent?: string;
  troubleshootItems?: TroubleshootItem[];
};

const preStyle = {
  background: '#1e1e1e',
  color: '#d4d4d4',
  padding: '1rem',
  overflowX: 'auto' as const,
  fontSize: '0.8rem',
  lineHeight: '1.5',
  borderRadius: '4px',
  whiteSpace: 'pre' as const,
  marginTop: '0.5rem',
};

export function TroubleshootAccordion({ items }: { items: TroubleshootItem[] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'sans-serif',
          fontSize: '0.85rem',
          color: '#555',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>Troubleshooting</span>
      </button>
      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          {items.map((item, i) => (
            <div key={i} style={{ marginBottom: '0.75rem' }}>
              <p style={{ fontFamily: 'sans-serif', fontSize: '0.85rem', margin: 0 }}>
                <strong>{item.symptom}</strong>
              </p>
              <p style={{ fontFamily: 'sans-serif', fontSize: '0.85rem', margin: '0.25rem 0 0', color: '#444' }}>
                {item.fix}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExecuteStep({ body, copyContent, troubleshootItems }: ExecuteStepDef) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!copyContent) return;
    navigator.clipboard.writeText(copyContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <div style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1rem' }}>
        {body}
      </div>

      {copyContent !== undefined && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={handleCopy}
            style={{
              marginBottom: '0.5rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              background: copied ? '#16a34a' : '#1d4ed8',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontFamily: 'sans-serif',
              fontSize: '0.85rem',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <pre style={preStyle}>{copyContent}</pre>
        </div>
      )}

      <TroubleshootAccordion items={troubleshootItems ?? []} />
    </div>
  );
}
