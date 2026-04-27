import { expect, test } from 'vitest';
import { generate } from './generate';
import { DeploymentPlan } from '../config/types';

const PLAN: DeploymentPlan = {
  scriptId: 'mirrors-on-A',
  deployIn: 'A',
  sourceCalendarId: 'b@example.com',
  sourceOwnerEmail: 'b@example.com',
  targetCalendarId: 'primary',
  mirrorPrefix: '[CM]',
  colorId: 7,
  lookaheadDays: 30,
};

test('generate snapshot', () => {
  expect(generate(PLAN)).toMatchSnapshot();
});

test('generate injects config values', () => {
  const out = generate(PLAN);
  expect(out).toContain('"b@example.com"');
  expect(out).toContain('"primary"');
  expect(out).toContain('"[CM]"');
  expect(out).toContain('COLOR_ID            = 7');
  expect(out).toContain('LOOKAHEAD_DAYS      = 30');
});
