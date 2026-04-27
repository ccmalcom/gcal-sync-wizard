'use client';

import { useState } from 'react';
import { WizardConfig, DeploymentPlan, ColorId } from './_lib/config/types';
import { DEFAULT_CONFIG } from './_lib/config/defaults';
import { generate } from './_lib/script/generate';
import { COLOR_NAMES } from './_lib/script/colors';

const COLOR_IDS = Object.keys(COLOR_NAMES).map(Number) as ColorId[];

const fieldStyle = {
  display: 'block',
  width: '100%',
  padding: '0.35rem 0.5rem',
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  boxSizing: 'border-box' as const,
};

const labelStyle = {
  display: 'block',
  fontFamily: 'sans-serif',
  fontSize: '0.8rem',
  color: '#222',
  marginBottom: '0.25rem',
};

const groupStyle = {
  marginBottom: '0.75rem',
};

export default function Home() {
  const [config, setConfig] = useState<WizardConfig>(DEFAULT_CONFIG);
  const [copied, setCopied] = useState(false);

  function setA(patch: Partial<WizardConfig['accountA']>) {
    setConfig(c => ({ ...c, accountA: { ...c.accountA, ...patch } }));
  }
  function setB(patch: Partial<WizardConfig['accountB']>) {
    setConfig(c => ({ ...c, accountB: { ...c.accountB, ...patch } }));
  }

  const plan: DeploymentPlan = {
    scriptId: 'mirrors-on-A',
    deployIn: 'A',
    sourceCalendarId: config.accountB.email,
    sourceOwnerEmail: config.accountB.email,
    targetCalendarId: 'primary',
    mirrorPrefix: config.accountA.label,
    colorId: config.colorOnA,
    lookaheadDays: config.lookaheadDays,
  };

  const script = generate(plan);

  function handleCopy() {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'sans-serif', marginBottom: '0.25rem' }}>gcal-sync-wizard</h1>
      <p style={{ fontFamily: 'sans-serif', color: '#333', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Fill in your details — the script updates live.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

        <section>
          <h2 style={{ fontFamily: 'sans-serif', fontSize: '1rem', marginBottom: '0.75rem' }}>Account A</h2>
          <div style={groupStyle}>
            <label style={labelStyle}>Email</label>
            <input
              type="text"
              value={config.accountA.email}
              onChange={e => setA({ email: e.target.value })}
              placeholder="you@primaryorg.com"
              style={fieldStyle}
            />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Label (used as mirror prefix)</label>
            <input
              type="text"
              value={config.accountA.label}
              onChange={e => setA({ label: e.target.value })}
              placeholder="[CM]"
              style={fieldStyle}
            />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Color of mirrors appearing on A</label>
            <select
              value={config.colorOnA}
              onChange={e => setConfig(c => ({ ...c, colorOnA: Number(e.target.value) as ColorId }))}
              style={fieldStyle}
            >
              {COLOR_IDS.map(id => (
                <option key={id} value={id}>{COLOR_NAMES[id]}</option>
              ))}
            </select>
          </div>
        </section>

        <section>
          <h2 style={{ fontFamily: 'sans-serif', fontSize: '1rem', marginBottom: '0.75rem' }}>Account B</h2>
          <div style={groupStyle}>
            <label style={labelStyle}>Email</label>
            <input
              type="text"
              value={config.accountB.email}
              onChange={e => setB({ email: e.target.value })}
              placeholder="you@consultingclient.com"
              style={fieldStyle}
            />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Label (used as mirror prefix)</label>
            <input
              type="text"
              value={config.accountB.label}
              onChange={e => setB({ label: e.target.value })}
              placeholder="[SH]"
              style={fieldStyle}
            />
          </div>
          <div style={groupStyle}>
            <label style={labelStyle}>Color of mirrors appearing on B</label>
            <select
              value={config.colorOnB}
              onChange={e => setConfig(c => ({ ...c, colorOnB: Number(e.target.value) as ColorId }))}
              style={fieldStyle}
            >
              {COLOR_IDS.map(id => (
                <option key={id} value={id}>{COLOR_NAMES[id]}</option>
              ))}
            </select>
          </div>
        </section>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={groupStyle}>
          <label style={labelStyle}>Lookahead days</label>
          <input
            type="number"
            min={1}
            max={365}
            value={config.lookaheadDays}
            onChange={e => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) setConfig(c => ({ ...c, lookaheadDays: v }));
            }}
            style={fieldStyle}
          />
        </div>
        <div style={groupStyle}>
          <label style={labelStyle}>Direction</label>
          <select
            value={config.direction}
            onChange={e => {
              const dir = e.target.value as WizardConfig['direction'];
              setConfig(c => ({
                ...c,
                direction: dir,
                restrictedAccount: dir === 'bidirectional' ? 'none' : c.restrictedAccount,
              }));
            }}
            style={fieldStyle}
          >
            <option value="bidirectional">Bidirectional</option>
            <option value="a-to-b-only">A → B only</option>
            <option value="b-to-a-only">B → A only</option>
          </select>
        </div>
        {config.direction !== 'bidirectional' && (
          <div style={groupStyle}>
            <label style={labelStyle}>Which account has Apps Script blocked?</label>
            <select
              value={config.restrictedAccount}
              onChange={e => setConfig(c => ({ ...c, restrictedAccount: e.target.value as WizardConfig['restrictedAccount'] }))}
              style={fieldStyle}
            >
              <option value="none">Neither</option>
              <option value="A">Account A</option>
              <option value="B">Account B</option>
            </select>
          </div>
        )}
      </div>

      <p style={{
        fontFamily: 'sans-serif',
        fontSize: '0.8rem',
        background: '#fffbeb',
        border: '1px solid #fbbf24',
        borderRadius: '4px',
        padding: '0.5rem 0.75rem',
        marginBottom: '0.75rem',
      }}>
        ⚠ Only showing Script 1 of 2. Full bidirectional/one-way logic comes in step 3.
      </p>

      <button
        onClick={handleCopy}
        style={{
          marginBottom: '0.75rem',
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
        {copied ? 'Copied!' : 'Copy script'}
      </button>

      <pre style={{
        background: '#1e1e1e',
        color: '#d4d4d4',
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
