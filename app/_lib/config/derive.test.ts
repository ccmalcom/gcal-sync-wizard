import { expect, test } from 'vitest';
import { derive } from './derive';
import { WizardConfig } from './types';

const BASE: WizardConfig = {
  accountA: { email: 'a@example.com', label: '[AA]' },
  accountB: { email: 'b@example.com', label: '[BB]' },
  colorOnA: 7,
  colorOnB: 2,
  lookaheadDays: 30,
  direction: 'bidirectional',
  restrictedAccount: 'none',
};

test('bidirectional / none → 2 plans, both deploy in their own account', () => {
  const plans = derive(BASE);
  expect(plans).toHaveLength(2);
  expect(plans[0]).toMatchObject({ scriptId: 'mirrors-on-A', deployIn: 'A', targetCalendarId: 'primary' });
  expect(plans[1]).toMatchObject({ scriptId: 'mirrors-on-B', deployIn: 'B', targetCalendarId: 'primary' });
});

test('bidirectional / A restricted → both deploy in B, mirrors-on-A targets a@example.com', () => {
  const plans = derive({ ...BASE, restrictedAccount: 'A' });
  expect(plans).toHaveLength(2);
  expect(plans[0]).toMatchObject({ scriptId: 'mirrors-on-A', deployIn: 'B', targetCalendarId: 'a@example.com' });
  expect(plans[1]).toMatchObject({ scriptId: 'mirrors-on-B', deployIn: 'B', targetCalendarId: 'primary' });
});

test('bidirectional / B restricted → both deploy in A, mirrors-on-B targets b@example.com', () => {
  const plans = derive({ ...BASE, restrictedAccount: 'B' });
  expect(plans).toHaveLength(2);
  expect(plans[0]).toMatchObject({ scriptId: 'mirrors-on-A', deployIn: 'A', targetCalendarId: 'primary' });
  expect(plans[1]).toMatchObject({ scriptId: 'mirrors-on-B', deployIn: 'A', targetCalendarId: 'b@example.com' });
});

test('a-to-b-only / none → 1 plan (mirrors-on-B), deploys in B', () => {
  const plans = derive({ ...BASE, direction: 'a-to-b-only' });
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({ scriptId: 'mirrors-on-B', deployIn: 'B', targetCalendarId: 'primary' });
});

test('a-to-b-only / B restricted → mirrors-on-B redirected to A, targets b@example.com', () => {
  const plans = derive({ ...BASE, direction: 'a-to-b-only', restrictedAccount: 'B' });
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({ scriptId: 'mirrors-on-B', deployIn: 'A', targetCalendarId: 'b@example.com' });
});

test('b-to-a-only / none → 1 plan (mirrors-on-A), deploys in A', () => {
  const plans = derive({ ...BASE, direction: 'b-to-a-only' });
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({ scriptId: 'mirrors-on-A', deployIn: 'A', targetCalendarId: 'primary' });
});

test('b-to-a-only / A restricted → mirrors-on-A redirected to B, targets a@example.com', () => {
  const plans = derive({ ...BASE, direction: 'b-to-a-only', restrictedAccount: 'A' });
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({ scriptId: 'mirrors-on-A', deployIn: 'B', targetCalendarId: 'a@example.com' });
});

test('derive full snapshot (bidirectional / none)', () => {
  expect(derive(BASE)).toMatchSnapshot();
});
