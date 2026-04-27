'use client';

import { useState, useEffect } from 'react';
import { WizardConfig, DeploymentPlan, ColorId } from './_lib/config/types';
import { DEFAULT_CONFIG } from './_lib/config/defaults';
import { derive } from './_lib/config/derive';
import { generate } from './_lib/script/generate';
import { COLOR_NAMES } from './_lib/script/colors';
import { ExecuteStep, ExecuteStepDef, TroubleshootAccordion, TroubleshootItem } from './components/ExecuteStep';

const COLOR_IDS = Object.keys(COLOR_NAMES).map(Number) as ColorId[];

function CopyBlock({ content, label }: { content: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div style={{ marginBottom: '1rem' }}>
      {label && (
        <p style={{ fontFamily: 'sans-serif', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
          {label}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          onClick={handleCopy}
          style={{
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
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            background: 'none',
            color: '#555',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontFamily: 'sans-serif',
            fontSize: '0.85rem',
          }}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <pre
        style={{
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: '1rem',
          overflowX: 'auto' as const,
          overflowY: 'auto' as const,
          fontSize: '0.8rem',
          lineHeight: '1.5',
          borderRadius: '4px',
          whiteSpace: 'pre' as const,
          maxHeight: expanded ? 'none' : '22vh',
        }}
      >
        {content}
      </pre>
    </div>
  );
}

function getPhase2Steps(config: WizardConfig, plans: DeploymentPlan[]): ExecuteStepDef[] {
  const emailA = config.accountA.email || 'Account A email';
  const emailB = config.accountB.email || 'Account B email';

  const shares = new Map<string, { from: string; to: string; permission: 'see' | 'edit' }>();
  for (const plan of plans) {
    const deployEmail = plan.deployIn === 'A' ? emailA : emailB;
    if (plan.sourceOwnerEmail !== deployEmail) {
      const key = `${plan.sourceOwnerEmail}→${deployEmail}`;
      if (!shares.has(key)) {
        shares.set(key, { from: plan.sourceOwnerEmail, to: deployEmail, permission: 'see' });
      }
    }
    if (plan.targetCalendarId !== 'primary') {
      const key = `${plan.targetCalendarId}→${deployEmail}`;
      shares.set(key, { from: plan.targetCalendarId, to: deployEmail, permission: 'edit' });
    }
  }
  const shareList = [...shares.values()];

  const liSt = { marginBottom: '0.75rem', fontFamily: 'sans-serif', fontSize: '0.9rem', lineHeight: '1.6' };
  const codeSt = { fontFamily: 'monospace', fontSize: '0.85em', background: '#343435', padding: '0.1em 0.3em', borderRadius: '3px' };

  return [
    {
      title: 'Share your calendars',
      body: (
        <div>
          <p style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '0.75rem' }}>
            Open Google Calendar for each account below and share as instructed:
          </p>
          <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
            {shareList.map(({ from, to, permission }, i) => (
              <li key={i} style={liSt}>
                Sign in to <code style={codeSt}>{from}</code> → open{' '}
                <strong>Google Calendar Settings</strong> → under <strong>My calendars</strong>,
                click your primary calendar → <strong>Share with specific people or groups</strong>.
                <br />
                Add <code style={codeSt}>{to}</code> with permission{' '}
                <strong>&ldquo;{permission === 'edit' ? 'Make changes to events' : 'See all event details'}&rdquo;</strong>.
              </li>
            ))}
          </ol>
          <p style={{ fontFamily: 'sans-serif', fontSize: '0.85rem', color: '#555', marginTop: '0.75rem', marginBottom: 0 }}>
            Wait a few minutes for sharing to propagate before moving on.
          </p>
        </div>
      ),
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
      body: (
        <div>
          {plans.map((plan, i) => {
            const deployEmail = plan.deployIn === 'A' ? emailA : emailB;
            return (
              <div key={plan.scriptId} style={{ marginBottom: plans.length > 1 ? '1.25rem' : 0 }}>
                {plans.length > 1 && (
                  <p style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Script {i + 1}
                  </p>
                )}
                <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  <li style={liSt}>
                    Go to{' '}
                    <a href="https://script.google.com" target="_blank" rel="noreferrer" style={{ color: '#1d4ed8' }}>
                      script.google.com
                    </a>{' '}
                    — make sure you are signed in as <code style={codeSt}>{deployEmail}</code>.
                  </li>
                  <li style={liSt}>Click <strong>New project</strong>.</li>
                  <li style={liSt}>
                    Click <strong>Untitled project</strong> at the top and rename it to{' '}
                    <strong>Busy Mirror</strong>.
                  </li>
                </ol>
              </div>
            );
          })}
        </div>
      ),
      troubleshootItems: [
        {
          symptom: 'script.google.com shows an error or redirects away',
          fix: 'Your organization may block Google Apps Script. Go back to "Sync settings" and set the restricted account — the wizard will redirect that script to deploy in your other account instead.',
        },
      ],
    },
    {
      title: 'Enable the Calendar API and paste the script',
      body: (
        <div>
          {plans.map((plan, i) => {
            const deployEmail = plan.deployIn === 'A' ? emailA : emailB;
            return (
              <div key={plan.scriptId} style={{ marginBottom: '1.5rem' }}>
                {plans.length > 1 && (
                  <p style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Script {i + 1} — deployed as <code style={codeSt}>{deployEmail}</code>
                  </p>
                )}
                <ol style={{ paddingLeft: '1.25rem', margin: '0 0 0.75rem' }}>
                  <li style={liSt}>
                    In the left sidebar, click the <strong>+</strong> next to <strong>Services</strong>.
                    Find <strong>Google Calendar API</strong> and click <strong>Add</strong>.
                  </li>
                  <li style={liSt}>
                    Click <strong>Code.gs</strong> in the left sidebar. Select all existing code (
                    <kbd>Ctrl+A</kbd> / <kbd>Cmd+A</kbd>) and delete it.
                  </li>
                  <li style={liSt}>
                    Paste the script below, then save (<kbd>Ctrl+S</kbd> / <kbd>Cmd+S</kbd>):
                  </li>
                </ol>
                <CopyBlock
                  content={generate(plan)}
                  label={plans.length > 1 ? `Script ${i + 1}` : undefined}
                />
              </div>
            );
          })}
        </div>
      ),
      troubleshootItems: [
        {
          symptom: "Can't find the Calendar API service",
          fix: 'In the Apps Script editor, go to Services (+ icon in the left sidebar), scroll to "Google Calendar API", and click Add.',
        },
      ],
    },
    {
      title: 'Run the script and authorize',
      body: (
        <div>
          {plans.map((plan, i) => {
            const deployEmail = plan.deployIn === 'A' ? emailA : emailB;
            return (
              <div key={plan.scriptId} style={{ marginBottom: plans.length > 1 ? '1.25rem' : 0 }}>
                {plans.length > 1 && (
                  <p style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Script {i + 1} — signed in as <code style={codeSt}>{deployEmail}</code>
                  </p>
                )}
                <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  <li style={liSt}>
                    At the top of the editor, select <strong>syncCalendars</strong> from the
                    function dropdown (to the left of the Run button).
                  </li>
                  <li style={liSt}>Click <strong>Run</strong> (▶).</li>
                  <li style={liSt}>
                    If an authorization dialog appears:
                    <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
                      <li style={{ ...liSt, marginBottom: '0.25rem' }}>
                        Click <strong>Review permissions</strong> and select{' '}
                        <code style={codeSt}>{deployEmail}</code>.
                      </li>
                      <li style={{ ...liSt, marginBottom: '0.25rem' }}>
                        Click <strong>Advanced</strong> →{' '}
                        <strong>Go to [project name] (unsafe)</strong>.
                      </li>
                      <li style={{ ...liSt, marginBottom: 0 }}>Click <strong>Allow</strong>.</li>
                    </ul>
                  </li>
                  <li style={liSt}>
                    After the run completes, click <strong>View → Executions</strong> and confirm
                    you see a &ldquo;Dry run complete&rdquo; message (no errors).
                  </li>
                </ol>
              </div>
            );
          })}
        </div>
      ),
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
      body: (
        <div>
          <p style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '0.75rem' }}>
            First confirm the dry-run output looks correct, then flip{' '}
            <code style={codeSt}>DRY_RUN</code> to go live and install the trigger.
          </p>
          {plans.map((plan, i) => {
            const deployEmail = plan.deployIn === 'A' ? emailA : emailB;
            const targetDesc = plan.targetCalendarId === 'primary'
              ? `${deployEmail}'s calendar`
              : plan.targetCalendarId;
            const colorName = COLOR_NAMES[plan.colorId] ?? `color ${plan.colorId}`;
            return (
              <div key={plan.scriptId} style={{ marginBottom: '1.25rem' }}>
                {plans.length > 1 && (
                  <p style={{ fontFamily: 'sans-serif', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Script {i + 1}
                  </p>
                )}
                <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  <li style={liSt}>
                    Open the Apps Script editor for this script (signed in as{' '}
                    <code style={codeSt}>{deployEmail}</code>).
                  </li>
                  <li style={liSt}>
                    Find <code style={codeSt}>DRY_RUN = true</code> and change it to{' '}
                    <code style={codeSt}>DRY_RUN = false</code>. Save (<kbd>Ctrl+S</kbd> / <kbd>Cmd+S</kbd>).
                  </li>
                  <li style={liSt}>
                    Select <strong>syncCalendars</strong> and click <strong>Run</strong> again.
                  </li>
                  <li style={liSt}>
                    Open Google Calendar as <code style={codeSt}>{deployEmail}</code> and check{' '}
                    <strong>{targetDesc}</strong> for events prefixed{' '}
                    <strong>{plan.mirrorPrefix}</strong> in <strong>{colorName}</strong> color.
                  </li>
                  <li style={liSt}>
                    Once mirrors look correct, select <strong>installTrigger</strong> from the
                    dropdown and click <strong>Run</strong> — this schedules the 15-minute
                    automatic sync.
                  </li>
                </ol>
              </div>
            );
          })}
        </div>
      ),
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
}

const PHASE1_TITLES = ['Your accounts', 'Sync settings', 'Your scripts'];
const PHASE2_TITLES = [
  'Share your calendars',
  'Create the Apps Script project',
  'Enable the Calendar API and paste the script',
  'Run the script and authorize',
  'Verify mirrors are appearing',
];
const STEP_TITLES = [...PHASE1_TITLES, ...PHASE2_TITLES];

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

const STEP0_TROUBLESHOOT: TroubleshootItem[] = [
  {
    symptom: "I'm not sure which account should be A vs B",
    fix: "The labels are just for your reference. A common convention is Account A = primary employer, Account B = consulting client. It only matters that you're consistent — the scripts reference these labels in event titles.",
  },
  {
    symptom: 'What should the label look like?',
    fix: "Use a short bracketed tag under 6 characters, e.g. [CM] or [SH]. It will be prepended to every mirrored event title so you can tell mirrors apart from real events at a glance.",
  },
  {
    symptom: "I don't know where to find a calendar's ID",
    fix: "In Google Calendar, click the gear icon → Settings → find your calendar in the left sidebar → click it → scroll to \"Integrate calendar\" → copy the Calendar ID shown there.",
  },
];

const STEP1_TROUBLESHOOT: TroubleshootItem[] = [
  {
    symptom: "I'm not sure which sync direction to pick",
    fix: "If both orgs need to see your availability when scheduling, use Bidirectional. If only one org has the scheduling problem (e.g. you only get double-booked on your primary calendar), pick the one-way direction that places mirrors there.",
  },
  {
    symptom: "I don't know if Apps Script is blocked for my account",
    fix: "Try opening script.google.com while signed in as that account. If it shows an admin restriction error or immediately redirects you away, mark that account as restricted — the wizard will redirect both scripts to deploy in your other account instead.",
  },
  {
    symptom: "What does 'Apps Script blocked' mean exactly?",
    fix: "Some Google Workspace admins disable Google Apps Script at the domain level for security reasons. If that's the case for one account, you can't create or run scripts under it — but you can still sync by running both scripts under the unrestricted account and sharing calendar access.",
  },
];

const STEP2_TROUBLESHOOT: TroubleshootItem[] = [
  {
    symptom: "I see two scripts — do I really need both?",
    fix: "For bidirectional sync, yes — each script runs under one account and mirrors the other direction. To set up only one script, go back to Sync settings and change the direction to one-way.",
  },
  {
    symptom: 'The script looks long. Do I need to read all of it?',
    fix: "You don't have to, but we show the full source so you can verify what it does before authorizing it. It only reads and writes calendar events — no data leaves Google's environment. If you're in a regulated org, consider sharing this code with your security team before deploying.",
  },
  {
    symptom: "Can I paste both scripts into the same Apps Script project?",
    fix: "No — each script must run in its own project under the appropriate Google account, so it can authenticate correctly. Mixing them would cause the wrong account to read the wrong calendar.",
  },
];

function loadSaved() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); } catch { return null; }
}

export default function Home() {
  const [config, setConfig] = useState<WizardConfig>(() => loadSaved()?.config ?? DEFAULT_CONFIG);
  const [step, setStep] = useState<number>(() => loadSaved()?.step ?? 0);

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
  const phase2Steps = getPhase2Steps(config, plans);

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
        <>
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
            <div style={groupStyle}>
              <label style={labelStyle}>Target calendar on A (blank = primary)</label>
              <input
                type="text"
                value={config.targetCalendarIdOnA}
                onChange={e => setConfig(c => ({ ...c, targetCalendarIdOnA: e.target.value }))}
                placeholder="Leave blank to use Account A's main calendar"
                style={fieldStyle}
              />
              <p style={{ fontFamily: 'sans-serif', fontSize: '0.75rem', color: '#666', margin: '0.3rem 0 0', lineHeight: '1.4' }}>
                <strong>Blank (recommended):</strong> mirrors land on A&apos;s main calendar, visible by default.{' '}
                <strong>Custom ID:</strong> paste a specific calendar&apos;s ID (e.g. a dedicated &ldquo;Busy Blocks&rdquo; calendar)
                to keep mirrors separate — useful if you don&apos;t want them mixed with real events.
                Find a calendar&apos;s ID in Google Calendar Settings → your calendar → &ldquo;Integrate calendar&rdquo;.
              </p>
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
            <div style={groupStyle}>
              <label style={labelStyle}>Target calendar on B (blank = primary)</label>
              <input
                type="text"
                value={config.targetCalendarIdOnB}
                onChange={e => setConfig(c => ({ ...c, targetCalendarIdOnB: e.target.value }))}
                placeholder="Leave blank to use Account B's main calendar"
                style={fieldStyle}
              />
              <p style={{ fontFamily: 'sans-serif', fontSize: '0.75rem', color: '#666', margin: '0.3rem 0 0', lineHeight: '1.4' }}>
                <strong>Blank (recommended):</strong> mirrors land on B&apos;s main calendar, visible by default.{' '}
                <strong>Custom ID:</strong> paste a specific calendar&apos;s ID (e.g. a dedicated &ldquo;Busy Blocks&rdquo; calendar)
                to keep mirrors separate — useful if you don&apos;t want them mixed with real events.
                Find a calendar&apos;s ID in Google Calendar Settings → your calendar → &ldquo;Integrate calendar&rdquo;.
              </p>
            </div>
          </section>

        </div>
        <TroubleshootAccordion items={STEP0_TROUBLESHOOT} />
        </>
      )}

      {step === 1 && (
        <>
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
        <TroubleshootAccordion items={STEP1_TROUBLESHOOT} />
        </>
      )}

      {step === 2 && (
        <>
          {plans.map((plan, i) => (
            <div key={plan.scriptId} style={{ marginBottom: '2rem' }}>
              <p style={{ fontFamily: 'sans-serif', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <strong>Script {i + 1}</strong> — {planSummary(plan, config)}
              </p>
              <CopyBlock content={generate(plan)} />
            </div>
          ))}
          <TroubleshootAccordion items={STEP2_TROUBLESHOOT} />
        </>
      )}

      {step >= PHASE1_TITLES.length && (
        <ExecuteStep {...phase2Steps[step - PHASE1_TITLES.length]} />
      )}

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
