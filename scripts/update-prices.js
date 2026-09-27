// Runs every weekday on GitHub: downloads ETF prices, converts them to zł,
// saves them in Supabase, and records today's portfolio value for the history chart.
import { createClient } from '@supabase/supabase-js';
import { computePortfolio, todayISO } from '../docs/calc.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set');
const db = createClient(url, key, { auth: { persistSession: false } });

async function yahoo(symbol) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10d&interval=1d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  );
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const r = (await res.json()).chart?.result?.[0];
  if (!r) throw new Error(`${symbol}: no data`);
  const day = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
  const closes = r.indicators?.quote?.[0]?.close || [];
  const bars = (r.timestamp || []).map((ts, i) => ({ date: day(ts), close: closes[i] })).filter((b) => b.close != null);
  const price = r.meta.regularMarketPrice ?? bars.at(-1)?.close;
  if (!Number.isFinite(price) || price <= 0) throw new Error(`${symbol}: no valid price`);
  const date = day(r.meta.regularMarketTime);
  // Previous close = last trading day before the day of the latest price.
  const prev = bars.filter((b) => b.date < date).at(-1)?.close ?? price;
  let currency = r.meta.currency;
  let factor = 1;
  if (currency === 'GBp' || currency === 'GBX') { currency = 'GBP'; factor = 0.01; }
  // Exchange closed today (holiday): nothing changed today.
  const prevClose = date < todayISO() ? price : prev;
  return { price: price * factor, prev: prevClose * factor, currency, date };
}

const fxCache = { PLN: 1 };
async function fx(currency) {
  if (!(currency in fxCache)) fxCache[currency] = (await yahoo(`${currency}PLN=X`)).price;
  return fxCache[currency];
}

async function must(q) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

const instruments = await must(db.from('instruments').select('*'));
let failures = 0;

for (const ins of instruments) {
  if (ins.kind !== 'etf' || !ins.yahoo_symbol) continue;
  try {
    const q = await yahoo(ins.yahoo_symbol);
    const rate = await fx(q.currency);
    const update = {
      currency: q.currency,
      price_native: q.price,
      price_pln: q.price * rate,
      prev_price_pln: q.prev * rate,
      price_date: q.date,
    };
    await must(db.from('instruments').update(update).eq('id', ins.id));
    Object.assign(ins, update);
    console.log(`${ins.id}: ${q.price} ${q.currency} = ${update.price_pln.toFixed(2)} zł`);
  } catch (e) {
    failures++;
    console.error(`Could not update ${ins.id}: ${e.message}`);
  }
}

const [accounts, transactions, settingsRows] = await Promise.all([
  must(db.from('accounts').select('*')),
  must(db.from('transactions').select('*')),
  must(db.from('settings').select('*')),
]);
const cash = Number(settingsRows[0]?.cash_pln || 0);
const p = computePortfolio({ accounts, instruments, transactions });
const snapshot = {
  date: todayISO(),
  total_pln: Math.round(p.total * 100) / 100,
  cost_pln: Math.round(p.cost * 100) / 100,
  goal_pln: Math.round((p.goalValue + cash) * 100) / 100,
  goal_cost_pln: Math.round((p.goalCost + cash) * 100) / 100,
};
await must(db.from('snapshots').upsert(snapshot));
console.log('Snapshot saved:', snapshot);

if (failures) process.exitCode = 1; // shows a red mark on GitHub so you notice
