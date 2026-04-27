import { WizardConfig, DeploymentPlan } from './types';

export function derive(config: WizardConfig): [DeploymentPlan, ...DeploymentPlan[]] {
  const { accountA, accountB, colorOnA, colorOnB, lookaheadDays, direction } = config;

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

  const plans: DeploymentPlan[] =
    direction === 'bidirectional' ? [planA, planB] :
    direction === 'b-to-a-only'  ? [planA] :
    direction === 'a-to-b-only'  ? [planB] :
    [];

  if (plans.length === 0) throw new Error(
    `derive() produced no plans for direction="${config.direction}". This is a bug.`
  );

  return plans as [DeploymentPlan, ...DeploymentPlan[]];
}
