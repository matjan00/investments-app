// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bondUnitValue, computePortfolio, projectGoal } from '../docs/calc.js';

test('EDO bond values match the broker (27 Sep 2026)', () => {
  assert.equal(bondUnitValue('2023-02-23', [7.25, 7.45, 5.95, 3.65], '2026-09-27').value, 124.73);
  assert.equal(bondUnitValue('2023-05-16', [7.25, 3.25, 6.15, 4.25], '2026-09-27').value, 119.38);
});

test('bond on purchase day and on first anniversary', () => {
  assert.equal(bondUnitValue('2023-02-23', [7.25], '2023-02-23').value, 100);
  assert.equal(bondUnitValue('2023-02-23', [7.25, 7.45], '2024-02-23').value, 107.25);
});

test('missing yearly rate is flagged and last rate is used', () => {
  const v = bondUnitValue('2023-05-16', [7.25, 3.25, 6.15], '2026-09-27');
  assert.equal(v.missingYear, 4);
  assert.ok(v.value > 119.38);
});

const accounts = [
  { id: 'a', name: 'Main', counts_for_goal: true },
  { id: 'ike', name: 'IKE', counts_for_goal: false },
];
const instruments = [{ id: 'X', kind: 'etf', price_pln: 120, prev_price_pln: 110, bond_rates: [] }];

test('average cost after buys and a partial sell', () => {
  const p = computePortfolio({
    accounts, instruments,
    transactions: [
      { id: 1, date: '2025-01-01', account_id: 'a', instrument_id: 'X', type: 'buy', units: 10, price_pln: 100 },
      { id: 2, date: '2025-02-01', account_id: 'a', instrument_id: 'X', type: 'buy', units: 10, price_pln: 80 },
      { id: 3, date: '2025-03-01', account_id: 'a', instrument_id: 'X', type: 'sell', units: 5, price_pln: 130 },
    ],
  });
  const pos = p.positions[0];
  assert.equal(pos.units, 15);
  assert.equal(pos.avgCost, 90);
  assert.equal(pos.value, 1800);
  assert.equal(pos.dayChange, 150);
});

test('IKE is excluded from the goal', () => {
  const p = computePortfolio({
    accounts, instruments,
    transactions: [
      { id: 1, date: '2025-01-01', account_id: 'a', instrument_id: 'X', type: 'buy', units: 1, price_pln: 100 },
      { id: 2, date: '2025-01-01', account_id: 'ike', instrument_id: 'X', type: 'buy', units: 2, price_pln: 100 },
    ],
  });
  assert.equal(p.total, 360);
  assert.equal(p.goalValue, 120);
});

test('down payment forecast matches the table shown to the user', () => {
  const base = { start: 135962.66, startCost: 120000, target: 300000 };
  assert.equal(projectGoal({ ...base, monthly: 4000, annualReturn: 4 }).months, 35);
  assert.equal(projectGoal({ ...base, monthly: 5000, annualReturn: 4.5 }).months, 29);
  assert.equal(projectGoal({ ...base, monthly: 6000, annualReturn: 5 }).months, 24);
});

test('after-tax forecast is never earlier than before-tax', () => {
  const base = { start: 135962.66, startCost: 120000, target: 300000, annualReturn: 5 };
  for (const monthly of [0, 2000, 4000, 6000]) {
    const pre = projectGoal({ ...base, monthly }).months;
    const post = projectGoal({ ...base, monthly, afterTax: true }).months;
    assert.ok(post >= pre);
  }
});
