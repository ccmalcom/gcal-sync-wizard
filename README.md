# gcal-sync-wizard

A static Next.js site that walks non-technical users through setting up a
Google Apps Script-based calendar busy-block mirror between two Google Workspace
accounts. Replaces the Clockwise cross-calendar sync feature (shut down March 2026).

No backend, no auth, no telemetry. Everything runs in the user's browser and inside
Google's own Apps Script environment.

---

## What it does

The wizard generates a pre-configured Google Apps Script for each user, then walks
them step-by-step through deploying it. Once running, the script mirrors busy blocks
between two calendars on a 15-minute trigger so "Find a time" in one org sees
availability from the other.

The full 9-step flow:

| # | Phase | Step |
|---|-------|------|
| 1 | Config | Your accounts (emails, labels, colors) |
| 2 | Config | Sync settings (direction, lookahead, restricted account) |
| 3 | Config | Your scripts (generated code, copy-to-clipboard) |
| 4 | Execute | Share your calendars |
| 5 | Execute | Create the Apps Script project |
| 6 | Execute | Enable the Calendar API and paste the script |
| 7 | Execute | Run the script and authorize |
| 8 | Execute | Verify mirrors are appearing |
| 9 | Verify | Check your sync (interactive checklist + diagnostics) |

---

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test        # Vitest — 12 tests, all passing
npm run build   # TypeScript check + Next.js production build
```

---

## Project structure

```
app/
  page.tsx                      # Entire wizard UI (single page)
  components/
    ExecuteStep.tsx             # ExecuteStep + TroubleshootAccordion components
  _lib/
    config/
      types.ts                  # WizardConfig, DeploymentPlan, ColorId types
      defaults.ts               # DEFAULT_CONFIG
      derive.ts                 # derive(config) → DeploymentPlan[]
      derive.test.ts            # 12 Vitest tests
    script/
      template.ts               # SCRIPT_BODY (the Apps Script source with CONFIG stripped)
      generate.ts               # generate(plan) → fully configured script string
      generate.test.ts          # snapshot + injection tests
      colors.ts                 # COLOR_NAMES: colorId → human name
reference/
  busy-mirror.js                # The reference script (manually verified working)
```

### Key components in `page.tsx`

- **`CopyBlock`** — scrollable `<pre>` block with Copy + Expand/Collapse buttons
- **`ColorPicker`** — row of Google Calendar color swatches; accessible (`aria-pressed`, `title`)
- **`VerificationStep`** — interactive checklist for the final "Check your sync" step; shows a success banner when all items are checked
- **`getPhase2Steps(config, plans)`** — returns all 6 Phase 2+3 step definitions with personalized JSX bodies
- **`canAdvance(step, config)`** — validation guard; blocks Next on step 0 until both emails and labels are filled

### State

Two pieces of state saved to `localStorage` under key `gcal-wizard`:
- `config: WizardConfig` — all form values
- `step: number` — current step index

---

## Before deploying

1. **Set `GITHUB_URL`** in `app/page.tsx` (top of file, currently `''`). Once the
   repo is public, paste the URL here so the "View source on GitHub" trust link
   renders in the header.

2. **Deploy to Vercel** — push to GitHub, import the repo in Vercel, deploy.
   No environment variables needed; the site is fully static.

---

## How `derive()` works

`derive(config)` maps a `WizardConfig` to 1 or 2 `DeploymentPlan` objects. Each plan
describes one Apps Script deployment: which account it runs under (`deployIn`), where
it reads events from (`sourceCalendarId`), and where it writes mirrors
(`targetCalendarId`).

The `restrictedAccount` field handles the case where one Google Workspace org blocks
`script.google.com`. When an account is restricted, its script is redirected to deploy
in the *other* account instead, with `targetCalendarId` set to the restricted account's
email (requiring a "Make changes to events" calendar share).

All combinations are covered by tests in `derive.test.ts`.

---

## The generated script

`generate(plan)` injects a `CONFIG` block into `SCRIPT_BODY` (from `template.ts`).
The CONFIG block sets:

```js
const CONFIG = {
  SOURCE_CALENDAR_ID: '...',
  SOURCE_OWNER_EMAIL: '...',
  TARGET_CALENDAR_ID: '...',  // 'primary' or a calendar ID / email
  MIRROR_PREFIX: '...',
  COLOR_ID: N,
  LOOKAHEAD_DAYS: N,
  DRY_RUN: true,              // user flips to false after verifying
};
```

The rest of the script (`SCRIPT_BODY`) is identical across all deployments and can be
audited in `reference/busy-mirror.js`.

---

## Potential follow-on work

- Add a GitHub link once the repo is public (set `GITHUB_URL` in `app/page.tsx`)
- Screenshots or a short Loom walkthrough for users who get stuck
- Direct `script.google.com` links with `?authuser=email` hints to help users
  land in the right Google account
- A "send me a copy" mailto link so users can email themselves the generated
  scripts for reference
- Mobile layout (currently desktop-only; setup is typically done at a desk)
