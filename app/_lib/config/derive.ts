import { WizardConfig, DeploymentPlan } from './types';

function redirectIfRestricted(
  plan: DeploymentPlan,
  restrictedAccount: WizardConfig['restrictedAccount'],
  emails: { A: string; B: string }
): DeploymentPlan {
  if (restrictedAccount === 'none' || plan.deployIn !== restrictedAccount) return plan;
  const other = plan.deployIn === 'A' ? 'B' : 'A';
  return { ...plan, deployIn: other, targetCalendarId: emails[plan.deployIn] };
}

export function derive(config: WizardConfig): [DeploymentPlan, ...DeploymentPlan[]] {
  const { accountA, accountB, colorOnA, colorOnB, lookaheadDays, direction, restrictedAccount } = config;

  const planA: DeploymentPlan = {
    scriptId: 'mirrors-on-A',
    deployIn: 'A',
    sourceCalendarId: accountB.email,
    sourceOwnerEmail: accountB.email,
    targetCalendarId: 'primary',
    mirrorPrefix: accountA.label,
    colorId: colorOnA,
    lookaheadDays,
  };

  const planB: DeploymentPlan = {
    scriptId: 'mirrors-on-B',
    deployIn: 'B',
    sourceCalendarId: accountA.email,
    sourceOwnerEmail: accountA.email,
    targetCalendarId: 'primary',
    mirrorPrefix: accountB.label,
    colorId: colorOnB,
    lookaheadDays,
  };

  const emails = { A: accountA.email, B: accountB.email };

  const rawPlans: DeploymentPlan[] =
    direction === 'bidirectional' ? [planA, planB] :
    direction === 'b-to-a-only'  ? [planA] :
    direction === 'a-to-b-only'  ? [planB] :
    [];

  if (rawPlans.length === 0) throw new Error(
    `derive() produced no plans for direction="${config.direction}". This is a bug.`
  );

  const plans = rawPlans.map(p => redirectIfRestricted(p, restrictedAccount, emails));
  return plans as [DeploymentPlan, ...DeploymentPlan[]];
}
