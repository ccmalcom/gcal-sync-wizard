import { WizardConfig } from './types';

export const DEFAULT_CONFIG: WizardConfig = {
  accountA: { email: '', label: '' },
  accountB: { email: '', label: '' },
  colorOnA: 7,
  colorOnB: 2,
  targetCalendarIdOnA: '',
  targetCalendarIdOnB: '',
  lookaheadDays: 30,
  direction: 'bidirectional',
  restrictedAccount: 'none',
};
