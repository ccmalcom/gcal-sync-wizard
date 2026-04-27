import { DeploymentPlan } from '../config/types';
import { SCRIPT_BODY } from './template';

const q = (s: string) => JSON.stringify(s);

function renderConfigBlock(plan: DeploymentPlan): string {
  return [
    '// ============================================================',
    '// Cross-Calendar Busy Mirror',
    '// Deploy in BOTH accounts. Update CONFIG per account.',
    '// ============================================================',
    '',
    '// === CONFIG (set per deployment) ===',
    `const SOURCE_CALENDAR_ID = ${q(plan.sourceCalendarId)};`,
    `const SOURCE_OWNER_EMAIL  = ${q(plan.sourceOwnerEmail)};`,
    `const TARGET_CALENDAR_ID  = ${q(plan.targetCalendarId)};`,
    `const MIRROR_PREFIX       = ${q(plan.mirrorPrefix)};`,
    `const LOOKAHEAD_DAYS      = ${plan.lookaheadDays};`,
    `const TAG_KEY             = "busyMirror"; // do NOT change between deploys`,
    `const DRY_RUN             = true;         // flip to false when ready`,
    `const COLOR_ID            = ${plan.colorId};`,
    '// ===================================',
  ].join('\n');
}

export function generate(plan: DeploymentPlan): string {
  return [renderConfigBlock(plan), SCRIPT_BODY].join('\n\n');
}
