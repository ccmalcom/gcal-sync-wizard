'use client';

import { useState } from 'react';
import { DeploymentPlan } from './_lib/config/types';
import { generate } from './_lib/script/generate';

const plan: DeploymentPlan = {
  scriptId: 'mirrors-on-A',
  deployIn: 'A',
  sourceCalendarId: 'jane.doe@clientco.com',
  sourceOwnerEmail: 'jane.doe@clientco.com',
  targetCalendarId: 'primary',
  mirrorPrefix: '[CM]',
  colorId: 7,
  lookaheadDays: 30,
};

export default function Home() {
  const [copied, setCopied] = useState(false);
  const script = generate(plan);

  function handleCopy() {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'sans-serif', marginBottom: '0.5rem' }}>gcal-sync-wizard — walking skeleton</h1>
      <p style={{ fontFamily: 'sans-serif', color: '#666', marginBottom: '1rem' }}>
        Hard-coded plan: <code>{plan.scriptId}</code>, deploy in {plan.deployIn},
        source <code>{plan.sourceCalendarId}</code>
      </p>
      <button
        onClick={handleCopy}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          background: copied ? '#16a34a' : '#1d4ed8',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        {copied ? 'Copied!' : 'Copy script'}
      </button>
      <pre style={{
        background: '#f4f4f4',
        padding: '1rem',
        overflowX: 'auto',
        fontSize: '0.8rem',
        lineHeight: '1.5',
        borderRadius: '4px',
        whiteSpace: 'pre',
      }}>
        {script}
      </pre>
    </main>
  );
}
