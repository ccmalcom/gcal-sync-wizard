# gcal-sync-wizard — Architecture Plan

This document is the agreed-upon architecture for the wizard. Future Claude
Code agents should read this alongside `CLAUDE.md` and `reference/busy-mirror.js`
before making structural changes. Where this document and `CLAUDE.md` disagree,
**this document wins** — `CLAUDE.md` was a quick brief; this is the reviewed plan.

---

## Corrections to CLAUDE.md (authoritative)

These items in `CLAUDE.md` were wrong or underspecified. The plan below assumes
the corrected versions.

1. **Drop the `next export` / static-export requirement.** Vercel runs SSR for
   free; static export imposes constraints (no dynamic routes without
   `generateStaticParams`, etc.) for no benefit. The constraint that matters is
   "no API routes, no server logic" — keep that.
2. **Drop the free/busy pre-flight check from v1.** Google's free/busy API
   requires OAuth or an API key; neither is doable from a static client-side
   site without exposing secrets. Replace with a manual "open this calendar
   URL and confirm you can see it" check.
3. **`SOURCE_OWNER_EMAIL` is derived, not asked.** For the consultant use case
   it always equals `SOURCE_CALENDAR_ID`. The generator emits both, but the
   form only asks for the source email.
4. **`LOOKAHEAD_DAYS` default is 30, not 60.** Match the tested reference
   value. Users can bump it.
5. **Color picker copy must say "color of mirrors that appear ON
   account X"**, not "color FOR account X." Each script has one `COLOR_ID`;
   the script that writes to A's calendar controls the color users see on A.
6. **Bidirectional + one restricted account is achievable.** Both scripts
   deploy in the unrestricted account with different CONFIGs. The
   restricted-account branch changes *where* a script is pasted, not whether
   it exists.
7. **Storing emails in localStorage requires a visible "Clear my data" button
   on every screen.** Privacy trust signal; non-negotiable.
8. **Next.js 16 has breaking changes** (per `AGENTS.md`). Read
   `node_modules/next/dist/docs/` before writing Next-specific code.

---

## Data model

Three layers — form input → deployment plan → generated script.

```ts
// app/_lib/config/types.ts
type ColorId = 1|2|3|4|5|6|7|8|9|10|11;

type WizardConfig = {
  accountA: { email: string; label: string };  // label e.g. "[CM]"
  accountB: { email: string; label: string };
  colorOnA: ColorId;                            // color of mirrors appearing ON A
  colorOnB: ColorId;
  lookaheadDays: number;                        // default 30
  direction: 'bidirectional' | 'a-to-b-only' | 'b-to-a-only';
  restrictedAccount: 'A' | 'B' | 'none';        // which account blocks Apps Script
};

// Output of derive()
type DeploymentPlan = {
  scriptId: 'mirrors-on-A' | 'mirrors-on-B';
  deployIn: 'A' | 'B';                          // which account hosts the project
  sourceCalendarId: string;                     // email
  sourceOwnerEmail: string;                     // == sourceCalendarId for our use case
  targetCalendarId: 'primary' | string;         // 'primary' iff deployIn === target's account
  mirrorPrefix: string;
  colorId: ColorId;
  lookaheadDays: number;
};

type GeneratedScript = {
  plan: DeploymentPlan;
  source: string;
  filename: string;
  appsScriptUrl: string;
};
```

`derive(config: WizardConfig): [DeploymentPlan, ...DeploymentPlan[]]` is the
architectural keystone. All branching for one-way / bidirectional /
restricted-account collapses into this one pure function. Returns 1 or 2 plans.
Trivially unit-testable.

The return type is a non-empty tuple — zero plans is unrepresentable at the
type level. `derive()` should also throw explicitly at runtime if it somehow
produces an empty array (i.e., an unhandled `direction` value slips through):

```ts
if (plans.length === 0) throw new Error(
  `derive() produced no plans for direction="${config.direction}". This is a bug.`
);
```

Callers in the wizard never need to handle the zero case, and if it ever fires
the error message points directly at the cause.

**Empty state / first-load defaults:** the form should never be blank.
`defaults.ts` exports the initial `WizardConfig`:

```ts
export const DEFAULT_CONFIG: WizardConfig = {
  accountA: { email: '', label: '' },   // emails intentionally blank — no good guess
  accountB: { email: '', label: '' },
  colorOnA: 7,                          // Peacock
  colorOnB: 2,                          // Sage
  lookaheadDays: 30,
  direction: 'bidirectional',
  restrictedAccount: 'none',
};
```

Emails and labels are the only fields left blank — there's no sensible
default. Everything else is pre-filled. The chosen color pair (Peacock +
Sage) is visually distinct and unlikely to collide with common calendar
colors (the default Google Calendar event palette uses blue, green, red).

**Validation rules:**
- email format (RFC-lite regex; reject empty)
- `accountA.email !== accountB.email` (hard error, not a warning)
- labels: trim, auto-bracket (`CM` → `[CM]`), max ~8 chars
- direction × restrictedAccount must be coherent — derive() enforces routing
- lookaheadDays: integer 1–365

---

## Script generator

**Single template string, marker-based substitution. Not fragments, not AST,
not handlebars.** The script body is byte-identical across deployments; only
the 8-line CONFIG block changes.

```
app/_lib/script/
  template.ts    # exports SCRIPT_BODY: the static body, verbatim from reference
  generate.ts    # generate(plan) → string; renders CONFIG block + body
  colors.ts      # colorId → name table
```

```ts
export function generate(plan: DeploymentPlan): string {
  return [renderConfigBlock(plan), SCRIPT_BODY].join('\n\n');
}

const q = (s: string) => JSON.stringify(s); // safe escape for any UTF-8
```

**Invariants:**
- `TAG_KEY` is hard-coded `"busyMirror"` in the template — NOT user-configurable.
  This is the loop-prevention contract between the two scripts.
- `DRY_RUN` defaults to `true`. The wizard's "go live" step is where users
  flip it. Never ship a live script on first paste.
- The static body lives in `template.ts`, not read from
  `reference/busy-mirror.js` at runtime. Add a test that the template body
  matches the reference body (with CONFIG stripped) to prevent drift.

**One-way-with-restricted-account is just a different `DeploymentPlan`,
not a different template.** The generator does not branch on it.

---

## File and folder structure

```
app/
  layout.tsx
  page.tsx                           # renders <Wizard/>
  globals.css

  _wizard/                           # underscore = not a route segment
    Wizard.tsx                       # orchestrator: state + step router
    StepShell.tsx                    # progress, prev/next, troubleshooting slot
    steps/
      Phase1Configure.tsx            # the form (emails, labels, colors, lookahead)
      Phase1Direction.tsx            # one-way vs bidirectional + restricted account
      Phase1Review.tsx               # show derived plan summary
      Phase2Execute.tsx              # generic; takes (plan, stepDefinition) as props
      Phase3Verify.tsx               # diagnostic flow
      stepDefinitions.ts             # data: per-step content for Phase 2 (and intro/copy)
    components/
      EmailInput.tsx
      LabelInput.tsx
      ColorSwatchPicker.tsx
      CodeBlock.tsx                  # <pre> + copy + line numbers
      CopyButton.tsx
      Troubleshooting.tsx            # accordion (co-located content per step)
      Disclaimer.tsx
      ResetButton.tsx                # "start over" — clears localStorage

  _lib/
    config/
      types.ts
      defaults.ts                        # see "Empty state" below
      validate.ts
      derive.ts                      # WizardConfig → DeploymentPlan[]
    script/
      template.ts
      generate.ts
      colors.ts
    persistence/
      storage.ts                     # versioned load/save/clear
      schema.ts                      # WIZARD_STATE_VERSION + migration fns
    instructions/
      copy.ts                        # shared text snippets / templating helpers
                                     # (per-step content lives in stepDefinitions.ts)

reference/
  busy-mirror.js                     # human-readable source of truth
```

**Conventions:**
- Underscore-prefixed dirs (`_wizard`, `_lib`) are non-routable per Next.js
  App Router. Keeps `app/` clean while allowing colocation.
- **Per-step files are an anti-pattern here.** Phase 2 has ~10 steps that
  differ only in copy and per-step targets (which calendar to share, which
  account to use, which script to paste). One generic `Phase2Execute.tsx`
  component reads from a `stepDefinitions.ts` data file. Ten data entries,
  not ten components.
- Phase 1 stays as ~3 dedicated components because each phase-1 screen has
  genuinely different layout (form vs. radio choices vs. summary).
- Troubleshooting content lives inside each `StepDefinition` entry, not in
  a separate file or component.

**`stepDefinitions.ts` shape (sketch):**

```ts
type StepDefinition = {
  id: string;                                  // 'share-calendar', 'create-project', ...
  phase: 2;
  title: (plan: DeploymentPlan) => string;     // personalized
  body: (plan: DeploymentPlan) => ReactNode;   // instructions w/ user's emails
  showsScript?: boolean;                       // render generated script in this step
  externalLink?: (plan: DeploymentPlan) => { href: string; label: string };
  troubleshooting: Array<{ q: string; a: ReactNode }>;
  appliesTo?: (plan: DeploymentPlan) => boolean; // default: all plans
};

export const PHASE_2_STEPS: StepDefinition[] = [
  { id: 'share-calendar',  ... },
  { id: 'create-project',  ... },
  { id: 'paste-script',    ... },
  { id: 'first-run',       ... },
  { id: 'go-live',         ... },
];
```

The wizard expands this into a flat list at runtime:
`plans.flatMap(plan => PHASE_2_STEPS.filter(s => s.appliesTo?.(plan) ?? true).map(s => ({plan, step: s})))`.
That's the queue `Phase2Execute` walks through.

---

## Wizard structure — three phases

**Phase 1: Configure** (no progress bar; jump-around-able)
- Step 0: Intro / GitHub link / disclaimers
- Step 1: Form (emails, labels, colors, lookahead)
- Step 2: Direction + restricted-account question
- Step 3: Review — plain-English summary of derived plans

**Phase 2: Execute** (progress bar; per-plan, sequential)
For each `DeploymentPlan`:
- Share calendar (prerequisite for that plan's read direction)
- Create Apps Script project in the right account
- Paste script
- First run + OAuth + DRY_RUN check
- Flip DRY_RUN, install trigger

**Phase 3: Verify** — diagnostic checkpoint with branching to symptom-routed fixes.

**Navigation rules:**
- Phase 1 is freely editable.
- Phase 2 allows back-nav with a warning if the user re-enters Phase 1
  (regenerated plans may invalidate completed steps).
- Phase 3 is read-only.
- Single page; no per-step URL routes. localStorage is the source of truth.
- Generated scripts are visible (`<pre>`) at their paste step AND available
  in a persistent drawer so users don't have to navigate back.

---

## State and persistence

- **`useReducer<WizardState>`.** `WizardConfig` has enough fields that edits
  need to be transactional — changing `direction` should atomically reset
  `restrictedAccount` to `'none'` if it's no longer applicable, rather than
  leaving that logic scattered across component event handlers. The reducer
  is the single place where field coherence is enforced. Even if useState
  is used instead, coherence/validation logic must never live in event
  handlers across multiple components — it belongs in one place.
- **Wizard is a client component** (`'use client'`). Simpler than gating
  localStorage reads behind `useEffect`. No SEO concerns.
- **Persisted shape:**
  ```ts
  type PersistedState = {
    version: number;              // bump on breaking changes
    config: WizardConfig;
    currentStep: string;          // step id, not index
    completedSteps: string[];
    createdAt: number;
  };
  ```
- **Storage key:** `gcal-wizard-v1`.
- **Migrations:** sequential migration fns by version. If no migration
  registered for a version mismatch, discard and show a banner. Don't build
  a framework before we have migrations.
- **"Start over"** button visible from every screen, with confirmation modal,
  clears localStorage and resets state.
- **Do NOT sync state to URL params** — emails-in-URL leaks via history and
  referer headers.

---

## Build order — smallest shippable increments first

1. **Walking skeleton:** `template.ts` + `generate.ts` + a hard-coded
   `DeploymentPlan` rendered in a `<pre>` on `app/page.tsx`. Copy-paste the
   output into a real Apps Script project; verify it runs. *(This validates
   the template approach end-to-end before any UI work.)*
2. Replace hard-coded plan with a real form (Phase 1 step 1 only). useState,
   no persistence.
3. Add `derive()` and render `DeploymentPlan[]` summary.
4. Bidirectional + restricted-account branching in `derive()`. Snapshot
   tests for `derive()` and `generate()`.
5. Multi-step shell: Phase 1 only, prev/next.
6. localStorage persistence + "Start over" button.
7. Phase 2 step shell: one generic "execute step" component parameterized by
   plan + step metadata.
8. Personalized instruction copy per Phase 2 step.
9. Troubleshooting accordions per step.
10. Phase 3 diagnostic flow.
11. Polish: validation, color picker UI, GitHub links, disclaimers,
    accessibility pass.

**Testing:** Vitest (or node test runner) for `derive()` and `generate()`.
One component test: render `Phase2Execute` with a real `DeploymentPlan` on the
`paste-script` step and assert the full generated script appears verbatim
somewhere in the DOM. Catches "I refactored and now the script doesn't render"
permanently with minimal setup. All other component tests optional.

---

## Risks and open questions

**Known foot-guns:**
- **Apps Script account-hint URLs** (`script.google.com/u/0/`) use
  position-in-account-list, not email. No reliable way to pre-select.
  Mitigation: tell the user "make sure you're signed in as X" + link to a
  Google account switcher.
- **Calendar share propagation lag** can be hours. Without the free/busy
  pre-flight, we lean on copy: "if step N fails with 'cannot access
  calendar,' wait 30 min and retry."
- **Template/reference drift.** If a bug fix lands in
  `reference/busy-mirror.js` but not `template.ts`, all generated scripts
  ship the bug. Mitigation: test that `SCRIPT_BODY` matches reference's body
  (with CONFIG stripped).
- **Generated script length.** The reference is ~200 lines; generated output
  is ~210. If the template ever grows past ~400 lines, users will balk at
  pasting it and Apps Script's inline editor becomes painful to navigate.
  Not worth solving now, but if it happens: split the bulk into a Google
  Apps Script Library (shared once per account, versioned separately) and
  have the generated script call into it. The wizard would then also need
  to walk users through adding the library dependency — a meaningful UX
  cost, so don't do it until line count actually forces it.

- **Apps Script API surface drift.** Out of our control, but triage time
  matters. Mitigation: pin the Apps Script runtime version in the generated
  script header (`// @OnlyCurrentDoc`, V8 runtime declaration, etc.), and
  emit a footer comment with the wizard version and generation date. When
  someone reports "this stopped working," those two data points let you
  correlate against Google's changelog in 30 seconds instead of 3 hours.
  Wizard version should be a constant in `_lib/script/generate.ts` and
  bumped on any change to `template.ts`.
- **Color collisions** with the user's existing event colors — we can't
  detect them. Warn at picker time.

**Decisions to revisit later:**
- Whether to skip the multi-step shell entirely and use three scrolling
  pages instead. For 10 users that might be simpler.
- Whether to add an "I already set up sharing, skip ahead" shortcut. Not v1.
- Whether `SOURCE_OWNER_EMAIL` ever needs to differ from `SOURCE_CALENDAR_ID`
  (e.g., for shared resource calendars). Currently derived; expose if a real
  use case appears.

**Nice-to-haves not in v1:**
- Print / save-as-PDF for users who need a hardcopy for security review.
- Wizard version + script version visible in footer for bug reports.
- Accessibility audit (semantic HTML from the start makes this nearly free).
