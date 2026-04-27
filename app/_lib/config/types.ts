export type ColorId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type WizardConfig = {
  accountA: { email: string; label: string };
  accountB: { email: string; label: string };
  colorOnA: ColorId;
  colorOnB: ColorId;
  lookaheadDays: number;
  direction: 'bidirectional' | 'a-to-b-only' | 'b-to-a-only';
  restrictedAccount: 'A' | 'B' | 'none';
};

export type DeploymentPlan = {
  scriptId: 'mirrors-on-A' | 'mirrors-on-B';
  deployIn: 'A' | 'B';
  sourceCalendarId: string;
  sourceOwnerEmail: string;
  targetCalendarId: 'primary' | string;
  mirrorPrefix: string;
  colorId: ColorId;
  lookaheadDays: number;
};

export type GeneratedScript = {
  plan: DeploymentPlan;
  source: string;
  filename: string;
  appsScriptUrl: string;
};
