// Shared math used by both the website and the daily price-update job.

export const BELKA_TAX = 0.19;

const DAY = 86400000;

export function toDate(d) {
  // A Date means "that day on the user's clock"; strings are plain YYYY-MM-DD dates.
  if (d instanceof Date) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addYears(d, n) {
  return new Date(Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate()));
}

const round2 = (x) => Math.round(x * 100 + 1e-9) / 100;
const floor2 = (x) => Math.floor(x * 100 + 1e-9) / 100;

/**
 * Value of one Polish treasury bond (EDO/COI/ROD style, yearly interest periods).
 * Interest is capitalised every anniversary; the current year accrues day by day.
 * rates[i] = interest rate (%) for year i+1. If the current year's rate is not
 * entered yet, the last known rate is used and `missingYear` is set.
 */
export function bondUnitValue(purchaseDate, rates, asOf = new Date(), nominal = 100, years = 10) {
  const start = toDate(purchaseDate);
  const end = toDate(asOf);
  const known = (rates || []).map(Number).filter((r) => !Number.isNaN(r));
  let value = nominal;
  let missingYear = null;
  for (let y = 0; y < years; y++) {
    const periodStart = addYears(start, y);
    const periodEnd = addYears(start, y + 1);
    if (end <= periodStart) break;
    let rate = known[y];
    if (rate === undefined) {
      rate = known.length ? known[known.length - 1] : 0;
      if (missingYear === null) missingYear = y + 1;
    }
    if (end >= periodEnd) {
      value = round2(value * (1 + rate / 100));
    } else {
      const days = (end - periodStart) / DAY;
      const len = (periodEnd - periodStart) / DAY;
      value = value + floor2((value * rate) / 100 * (days / len));
      break;
    }
  }
  return { value: round2(value), missingYear, currentYear: currentBondYear(start, end) };
}

function currentBondYear(start, end) {
  let y = 0;
  while (addYears(start, y + 1) <= end) y++;
  return y + 1;
}

/**
 * Turns the list of transactions into current positions.
 * ETFs are grouped per account + instrument (average cost method).
 * Bonds are valued per purchase (each purchase has its own anniversary date).
 */
export function computePortfolio({ accounts, instruments, transactions }, asOf = new Date()) {
  const accById = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const insById = Object.fromEntries(instruments.map((i) => [i.id, i]));
  const map = new Map();
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const warnings = [];
  const oversold = []; // sales of more units than were held on that date

  for (const t of sorted) {
    const ins = insById[t.instrument_id];
    if (!ins) continue;
    const key = `${t.account_id}|${t.instrument_id}`;
    let p = map.get(key);
    if (!p) {
      p = { key, account: accById[t.account_id], instrument: ins, units: 0, cost: 0, lots: [], realized: 0 };
      map.set(key, p);
    }
    const units = Number(t.units);
    const price = Number(t.price_pln);
    const fee = Number(t.fee_pln || 0);
    if (t.type === 'sell') {
      if (units > p.units + 1e-9) oversold.push({ tx: t, held: p.units });
      if (p.units <= 0) continue;
      const share = Math.min(1, units / p.units);
      const costSold = p.cost * share;
      p.realized += units * price - fee - costSold;
      p.cost -= costSold;
      p.units = Math.max(0, p.units - units);
      if (ins.kind === 'bond') {
        // Sell oldest bonds first.
        let left = units;
        for (const lot of p.lots) {
          const take = Math.min(lot.units, left);
          lot.units -= take;
          left -= take;
          if (left <= 0) break;
        }
        p.lots = p.lots.filter((l) => l.units > 1e-9);
      }
    } else {
      p.units += units;
      p.cost += units * price + fee;
      if (ins.kind === 'bond') p.lots.push({ date: t.date, units });
    }
  }

  const positions = [];
  for (const p of map.values()) {
    if (p.units <= 1e-9) continue;
    const ins = p.instrument;
    let value;
    let prevValue;
    let price;
    if (ins.kind === 'bond') {
      value = 0;
      prevValue = 0;
      const yesterday = new Date(toDate(asOf).getTime() - DAY).toISOString().slice(0, 10);
      for (const lot of p.lots) {
        const v = bondUnitValue(lot.date, ins.bond_rates, asOf);
        value += lot.units * v.value;
        prevValue += lot.units * bondUnitValue(lot.date, ins.bond_rates, yesterday).value;
        if (v.missingYear) warnings.push({ instrument: ins, year: v.missingYear });
      }
      price = value / p.units;
    } else {
      price = ins.price_pln == null ? null : Number(ins.price_pln);
      const prev = ins.prev_price_pln == null ? price : Number(ins.prev_price_pln);
      value = price == null ? p.cost : p.units * price;
      prevValue = price == null ? value : p.units * prev;
    }
    positions.push({
      ...p,
      price,
      value,
      dayChange: value - prevValue,
      avgCost: p.cost / p.units,
      gain: value - p.cost,
      gainPct: p.cost > 0 ? (value - p.cost) / p.cost : 0,
      countsForGoal: p.account ? p.account.counts_for_goal !== false : true,
    });
  }

  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const goalPositions = positions.filter((p) => p.countsForGoal);
  const uniqueWarnings = [...new Map(warnings.map((w) => [w.instrument.id + w.year, w])).values()];
  return {
    positions,
    total: sum(positions, (p) => p.value),
    cost: sum(positions, (p) => p.cost),
    dayChange: sum(positions, (p) => p.dayChange),
    goalValue: sum(goalPositions, (p) => p.value),
    goalCost: sum(goalPositions, (p) => p.cost),
    warnings: uniqueWarnings,
    oversold,
  };
}

/**
 * Month-by-month forecast. Money is added at the end of each month and grows at
 * `annualReturn` (%) per year. With afterTax, 19% Belka tax on the gains is
 * subtracted (what you'd actually have after selling everything).
 */
export function projectGoal({ start, startCost, monthly, annualReturn, target, afterTax = false, maxMonths = 600 }) {
  const i = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  let value = start;
  let cost = startCost;
  const net = () => (afterTax ? value - BELKA_TAX * Math.max(0, value - cost) : value);
  const series = [net()];
  let months = net() >= target ? 0 : null;
  for (let m = 1; m <= maxMonths && months === null; m++) {
    value = value * (1 + i) + monthly;
    cost += monthly;
    series.push(net());
    if (net() >= target) months = m;
  }
  return { months, series };
}

export function addMonths(date, n) {
  const d = new Date(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}
