~~@AGENTS.md

# Cross-Calendar Busy Mirror — Setup Wizard

## Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- React 19
- Deploy target: Vercel
- Package manager: npm

## Project goal

Build a static Next.js site (deployable to Vercel) that walks non-technical
coworkers through setting up a Google Apps Script-based calendar busy-block
mirror between two Google Workspace accounts (typically a primary employer
calendar and a consulting/secondary employer calendar).

The site is a **config generator + guided walkthrough**, not a backend service.
Everything happens client-side. No auth, no API routes, no database, no
telemetry.

## Current state

Build order steps 1–4 complete. Live form with full restricted-account branching:

- `app/_lib/config/types.ts` — `ColorId`, `WizardConfig`, `DeploymentPlan`, `GeneratedScript`
- `app/_lib/config/defaults.ts` — `DEFAULT_CONFIG` (colorOnA=7/Peacock, colorOnB=2/Sage, 30 days, bidirectional)
- `app/_lib/config/derive.ts` — `derive(config) → DeploymentPlan[]`; handles all direction + restrictedAccount combos
- `app/_lib/script/template.ts` — `SCRIPT_BODY` (reference script body, CONFIG stripped)
- `app/_lib/script/generate.ts` — `generate(plan: DeploymentPlan): string`
- `app/_lib/script/colors.ts` — `COLOR_NAMES` lookup table (colorId → human name)
- `app/page.tsx` — live form (`useState<WizardConfig>`); calls `derive()`, renders per-plan summary + copy button + `<pre>`
- `app/_lib/config/derive.test.ts` — 8 Vitest tests covering all direction × restriction combos + snapshot
- `app/_lib/script/generate.test.ts` — snapshot + config injection assertions

Test framework: Vitest (`npm test`). All 10 tests pass.

The generated script has been pasted into a real Apps Script project and
confirmed to run in dry-run mode. Next step: multi-step wizard shell (build order step 5).

## Reference: current working Apps Script

The script the wizard generates is at `reference/busy-mirror.js`. The wizard
substitutes CONFIG values; the rest is identical between deployments.

## Background context

### The problem being solved

Many consultants/contractors work across two organizations and maintain two
Google Workspace calendars (e.g., a primary employer calendar and a client
project calendar). When someone in Org A uses Google Calendar's "Find a time"
feature to schedule with them, it only checks Org A's calendar — so meetings
on Org B's calendar don't block availability, leading to double-booking.

Clockwise solved this with cross-calendar busy block mirroring, but Salesforce
acquired Clockwise and shut it down on March 27, 2026. Reclaim.ai is the
official migration partner, but many users in regulated industries (healthcare,
finance) can't get third-party calendar OAuth apps approved by their security
teams.

### The solution

A pure Google Apps Script approach that:

- Runs entirely inside Google's own environment (no third-party servers)
- Requires no admin privileges
- Uses native Google Calendar sharing as the auth mechanism
- Mirrors busy blocks between two calendars on a 15-minute trigger
- Is free and self-hosted (each user runs it in their own Apps Script project)

### The setup process (what we're trying to make easier)

This is currently a manual ~10-step process that requires technical comfort:

1. Determine which account (if any) has Apps Script access blocked by org admin
2. Set up Google Calendar sharing in the right direction(s) with correct permissions
3. Wait for sharing to propagate (can take minutes to hours)
4. Create Apps Script project(s) at script.google.com under the right account(s)
5. Enable the Calendar API service in each project
6. Copy and paste the script
7. Update the CONFIG block with correct values per deployment
8. Run syncCalendars manually to trigger OAuth consent
9. Click through "unverified app" warning
10. Verify dry-run output looks correct
11. Flip DRY_RUN to false, run again, verify mirrors appear
12. Run installTrigger to schedule it
13. Optionally deploy a second copy for bidirectional sync

Most coworkers will give up around step 4. The wizard's job is to hold their
hand through every step with their actual email addresses substituted into
the instructions, generate pre-configured scripts they can copy-paste, and
provide diagnostic flows for common failure modes.

## Key technical decisions already made

### Why Apps Script (not a SaaS tool)

- Runs as the user's own account inside Google's environment
- No data leaves Google
- No vendor approval needed for security-conscious orgs
- Free
- The user owns the code

### Why bidirectional but with conditional second deployment

- Some orgs (especially healthcare-adjacent like Spring Health) block
  script.google.com entirely
- In those cases, only one direction can be set up — the other side's script
  must be deployed in the _unrestricted_ account, writing to the restricted
  account via "Make changes to events" calendar share permission
- The wizard needs to detect or ask about this constraint and branch accordingly

### Critical script behaviors (must be preserved)

- **Idempotent updates via extended properties**: each mirror tagged with
  source event ID; update in place, never delete-and-recreate (prevents
  notification spam)
- **No notifications on mirror events**: `reminders: { useDefault: false, overrides: [] }`
- **`sendUpdates: 'none'`** on every API call (belt-and-suspenders)
- **Loop prevention**: scripts skip events tagged with `busyMirror=true` so
  bidirectional setups don't mirror each other's mirrors
- **Filter declined/maybe/no-response invitations**: only mirror events where
  the source owner has `responseStatus === 'accepted'` or is the organizer
- **Skip transparent events**: events the user marked as "Free"
- **Skip noise types**: workingLocation, birthday, fromGmail
- **Always mirror OOO and Focus Time**: explicit personal blocks
- **Dedupe events already on target calendar**: when the same meeting invites
  both addresses, both copies share an iCalUID — skip mirroring if target
  calendar already has an event with that iCalUID
- **Configurable color, prefix, and lookahead window**

## Site requirements

### Form inputs (the user provides)

- Email address for Account A (e.g., the primary employer calendar)
- Email address for Account B (e.g., the consulting calendar)
- Friendly label for Account A (used as MIRROR_PREFIX, e.g., "[CM]")
- Friendly label for Account B (used as MIRROR_PREFIX, e.g., "[SH]")
- Color choice for Account A mirrors (visual swatch picker → colorId)
- Color choice for Account B mirrors (visual swatch picker → colorId)
- Lookahead days (default 30)
- Bidirectional vs one-way (with explanation of when you'd pick each)
- If one-way: which account has Apps Script blocked? (drives the deployment
  configuration — the script gets deployed in the _unrestricted_ account
  with TARGET_CALENDAR_ID pointed at the restricted account's email)

### Generated outputs

- Fully-configured Script 1 (with their values pre-filled, ready to paste)
- Fully-configured Script 2 if bidirectional (or only Script 1 if one-way)
- Personalized step-by-step setup checklist with their actual emails
  substituted in
- Direct links to script.google.com (with appropriate account hint URL params)

### Wizard structure

- Multi-step flow with progress persisted in localStorage so they can close
  and resume
- Each step has:
  - Clear single action to take
  - Copy-to-clipboard button where applicable (use `navigator.clipboard.writeText`)
  - "Done, next step" button
  - Expandable troubleshooting accordion for that step's common failures
- Show generated script in a `<pre>` block in full (not hidden behind a copy
  button) so users can read what they're pasting — credibility/trust is
  important for security-conscious users

### Diagnostic flow at the end

- "Verify it's working" checkpoint with branching:
  - ✅ Test event on source calendar created
  - ✅ Mirror appeared on target within 15 min
  - ✅ Mirror has correct color and prefix
  - ✅ No notifications received
- If any fail, branch to a "which symptom?" diagnostic that routes to fix

### What the wizard CAN'T do (must communicate clearly)

- Cannot create Apps Script projects programmatically (would require Google
  app verification for sensitive scopes; not worth pursuing for a
  personal-use tool)
- Cannot set up calendar sharing on behalf of users
- Cannot install triggers remotely
- Cannot detect Workspace policy restrictions in advance (user has to try
  and report back)

## Architecture

- **No backend** — everything client-side
- **No auth** — users paste their own emails into a local form
- **No telemetry, no accounts, no server-side anything**
- **State**: useReducer for form state, localStorage for persistence
- **Deploy**: Vercel free tier
- **Source**: link prominently to a public GitHub repo with the script
  source so users can verify what they're pasting

## Trust and safety considerations

Coworkers will be pasting code into Apps Script that touches their work
calendars. The site needs to:

- Make the generated script fully visible (not hidden behind copy buttons)
- Link to the GitHub source for both the script and the wizard site itself
- Include a clear "review the code before running" disclaimer
- Suggest users in regulated orgs get security-team sign-off before deploying
- Frame the site as a "config helper," not a black box service
- Have no analytics or tracking — privacy-respecting by default

## Color reference (Google Calendar event colorIds)

| ID  | Color     |
| --- | --------- |
| 1   | Lavender  |
| 2   | Sage      |
| 3   | Grape     |
| 4   | Flamingo  |
| 5   | Banana    |
| 6   | Tangerine |
| 7   | Peacock   |
| 8   | Graphite  |
| 9   | Blueberry |
| 10  | Basil     |
| 11  | Tomato    |

## Out of scope for v1

- Programmatic Apps Script project creation
- OAuth flows of any kind
- Server-side anything
- Multi-user accounts on the wizard itself
- Mobile-optimized UI (desktop-only is fine; this is a setup task done at a desk)
- Screenshots in the walkthrough (text instructions only for v1)

## Suggested build order

1. ✅ Walking skeleton: `template.ts` + `generate.ts` + hard-coded `DeploymentPlan` in `page.tsx`
2. Real form for Phase 1 step 1 (emails, labels, colors, lookahead). `useState`, no persistence.
3. `derive()` + render `DeploymentPlan[]` summary.
4. Bidirectional + restricted-account branching in `derive()`. Snapshot tests.
5. Multi-step shell: Phase 1 only, prev/next.
6. localStorage persistence + "Start over" button.
7. Phase 2 step shell: generic execute-step component.
8. Personalized instruction copy per Phase 2 step.
9. Troubleshooting accordions per step.
10. Phase 3 diagnostic flow.
11. Polish: validation, color picker UI, GitHub links, disclaimers, a11y.

## Notes for Claude Code

- This is a personal project, not a commercial product. Keep it simple.
- Prioritize trust signals (visible code, no telemetry, GitHub link) over
  fancy UI.
- The wizard is meant for ~10 coworkers, not scale. Don't over-engineer.
- The actual script IS the product; the wizard is just a wrapper. If a
  decision tradeoff comes up, prefer making the wizard simpler over making
  it cleverer.
  ~~
