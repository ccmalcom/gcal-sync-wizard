'use client';

import { useState, useEffect } from 'react';
import { WizardConfig, DeploymentPlan, ColorId } from './_lib/config/types';
import { DEFAULT_CONFIG } from './_lib/config/defaults';
import { derive } from './_lib/config/derive';
import { generate } from './_lib/script/generate';
import { COLOR_NAMES } from './_lib/script/colors';
import { ExecuteStep, ExecuteStepDef } from './components/ExecuteStep';

const COLOR_IDS = Object.keys(COLOR_NAMES).map(Number) as ColorId[];

const PHASE2_STEPS: ExecuteStepDef[] = [
  {
    title: 'Share your calendars',
    body: 'Personalized sharing instructions will appear here in Step 8.',
    troubleshootItems: [
      {
        symptom: 'Sharing option is greyed out or unavailable',
        fix: 'Your Google Workspace admin may restrict external calendar sharing. Ask your IT admin to allow "Share with specific people" for your account.',
      },
      {
        symptom: 'The other person says they never received the sharing invitation',
        fix: 'Try removing the share and re-adding it. The invitation email can sometimes be delayed or land in spam.',
      },
    ],
  },
  {
    title: 'Create the Apps Script project',
    body: 'Personalized project creation instructions will appear here in Step 8.',
    troubleshootItems: [
      {
        symptom: 'script.google.com shows an error or redirects away',
        fix: 'Your organization may block Google Apps Script. Go back to "Sync settings" and set the restricted account — the wizard will redirect that script to deploy in your other account instead.',
      },
    ],
  },
  {
    title: 'Enable the Calendar API and paste the script',
    body: 'Personalized paste instructions will appear here in Step 8.',
    troubleshootItems: [
      {
        symptom: "Can't find the Calendar API service",
        fix: 'In the Apps Script editor, go to Services (+ icon in the left sidebar), scroll to "Google Calendar API", and click Add.',
      },
    ],
  },
  {
    title: 'Run the script and authorize',
    body: 'Personalized run instructions will appear here in Step 8.',
    troubleshootItems: [
      {
        symptom: '"This app isn\'t verified" warning',
        fix: 'This is expected — the script is running under your own account, not a published app. Click "Advanced" → "Go to [project name] (unsafe)" to proceed.',
      },
      {
        symptom: 'Authorization dialog never appears',
        fix: 'Make sure you are running syncCalendars (not installTrigger) for the first run. Check that pop-ups are allowed for script.google.com in your browser.',
      },
    ],
  },
  {
    title: 'Verify mirrors are appearing',
    body: 'Personalized verification instructions will appear here in Step 8.',
    troubleshootItems: [
      {
        symptom: 'No mirrors appeared after running',
        fix: 'Check the Apps Script execution log (View → Executions) for errors. Make sure DRY_RUN is false and the calendar share was accepted.',
      },
      {
        symptom: 'Mirrors appeared but have the wrong color or prefix',
        fix: 'Go back to step 1 ("Your accounts") and double-check the label and color settings, then regenerate and re-paste the script.',
      },
    ],
  },
];

const PHASE1_TITLES = ['Your accounts', 'Sync settings', 'Your scripts'];
const STEP_TITLES = [...PHASE1_TITLES, ...PHASE2_STEPS.map(s => s.title)];

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

function planSummary(plan: DeploymentPlan, config: WizardConfig): string {
  const deployEmail = plan.deployIn === 'A' ? config.accountA.email : config.accountB.email;
  const sourceAccount = plan.sourceCalendarId === config.accountA.email ? 'A' : 'B';
  const writesTo = plan.targetCalendarId === 'primary'
    ? plan.deployIn
    : plan.targetCalendarId === config.accountA.email ? 'A' : 'B';
  return `Deploy in Account ${plan.deployIn}${deployEmail ? ` (${deployEmail})` : ''} · reads from Account ${sourceAccount} · writes busy blocks to Account ${writesTo}'s calendar`;
}

const LS_KEY = 'gcal-wizard';

export default function Home() {
  const [config, setConfig] = useState<WizardConfig>(DEFAULT_CONFIG);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.config) setConfig(saved.config);
        if (typeof saved.step === 'number') setStep(saved.step);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ config, step }));
    } catch { /* ignore */ }
  }, [config, step]);

  function handleStartOver() {
    if (!window.confirm('Clear all entered data and start over?')) return;
    localStorage.removeItem(LS_KEY);
    setConfig(DEFAULT_CONFIG);
    setStep(0);
  }

  function setA(patch: Partial<WizardConfig['accountA']>) {
    setConfig(c => ({ ...c, accountA: { ...c.accountA, ...patch } }));
  }
  function setB(patch: Partial<WizardConfig['accountB']>) {
    setConfig(c => ({ ...c, accountB: { ...c.accountB, ...patch } }));
  }

  const plans = derive(config);

  function handleCopy(plan: DeploymentPlan) {
    navigator.clipboard.writeText(generate(plan)).then(() => {
      setCopiedId(plan.scriptId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <main style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'sans-serif', marginBottom: '0.25rem' }}>gcal-sync-wizard</h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.25rem' }}>
        <h2 style={{ fontFamily: 'sans-serif', fontSize: '1rem', margin: 0 }}>
          {STEP_TITLES[step]}
        </h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'sans-serif', fontSize: '0.8rem', color: '#888' }}>
            Step {step + 1} of {STEP_TITLES.length}
          </span>
          <button
            onClick={handleStartOver}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontFamily: 'sans-serif',
              fontSize: '0.8rem',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Start over
          </button>
        </div>
      </div>

      {step === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

          <section>
            <h3 style={{ fontFamily: 'sans-serif', fontSize: '1rem', marginBottom: '0.75rem' }}>Account A</h3>
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
            <h3 style={{ fontFamily: 'sans-serif', fontSize: '1rem', marginBottom: '0.75rem' }}>Account B</h3>
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
      )}

      {step === 1 && (
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
      )}

      {step >= PHASE1_TITLES.length && (
        <ExecuteStep {...PHASE2_STEPS[step - PHASE1_TITLES.length]} />
      )}

      {step === 2 && plans.map((plan, i) => (
        <div key={plan.scriptId} style={{ marginBottom: '2rem' }}>
          <p style={{ fontFamily: 'sans-serif', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <strong>Script {i + 1}</strong> — {planSummary(plan, config)}
          </p>
          <button
            onClick={() => handleCopy(plan)}
            style={{
              marginBottom: '0.5rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              background: copiedId === plan.scriptId ? '#16a34a' : '#1d4ed8',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontFamily: 'sans-serif',
              fontSize: '0.85rem',
            }}
          >
            {copiedId === plan.scriptId ? 'Copied!' : 'Copy script'}
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
            {generate(plan)}
          </pre>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          style={{
            padding: '0.5rem 1rem',
            cursor: step === 0 ? 'default' : 'pointer',
            opacity: step === 0 ? 0.4 : 1,
            background: '#fff',
            color: '#1d4ed8',
            border: '1px solid #1d4ed8',
            borderRadius: '4px',
            fontFamily: 'sans-serif',
            fontSize: '0.85rem',
          }}
        >
          ← Back
        </button>
        {step < STEP_TITLES.length - 1 && (
          <button
            onClick={() => setStep(s => s + 1)}
            style={{
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              background: '#1d4ed8',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontFamily: 'sans-serif',
              fontSize: '0.85rem',
            }}
          >
            Next →
          </button>
        )}
      </div>
    </main>
  );
}
