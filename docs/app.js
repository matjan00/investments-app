import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { computePortfolio, projectGoal, addMonths, todayISO, toDate } from './calc.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0, useGrouping: true });
const fmt2 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
const fmtN = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 4, useGrouping: true });
const zl = (x) => `${fmt0.format(Math.round(x))} zł`;
const zl2 = (x) => `${fmt2.format(x)} zł`;
const sign = (x) => (x > 0.004 ? '+' : x < -0.004 ? '−' : '');
const szl = (x) => sign(x) + zl(Math.abs(x));
const pct = (x, d = 1) => `${sign(x)}${Math.abs(x * 100).toFixed(d)}%`;
const cls = (x) => (x > 0.004 ? 'up' : x < -0.004 ? 'down' : '');
const monthYear = (d) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
const niceDate = (iso) => toDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const parseNum = (s) => Number(String(s ?? '').replace(/\s/g, '').replace(',', '.'));
const duration = (m) => {
  if (m === 0) return 'already there';
  const y = Math.floor(m / 12), mo = m % 12;
  return [y ? `${y} yr` : '', mo ? `${mo} mo` : ''].filter(Boolean).join(' ');
};
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const PALETTE = ['#2f6fe4', '#16a37f', '#e0892b', '#8b5cf6', '#e0527a', '#0ea5c6', '#a3a33a', '#6b7280', '#c2410c', '#65a30d'];

async function must(q) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

// ---------- state ----------
let data = null;
let loadedAt = 0;
let tab = store.get('tab', 'overview');
let historyRange = store.get('range', 'all');
const charts = {};

function chart(id, config) {
  charts[id]?.destroy();
  const el = document.getElementById(id);
  if (!el) return;
  Chart.defaults.color = css('--text-2');
  Chart.defaults.borderColor = css('--line');
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  charts[id] = new Chart(el, config);
}

async function load() {
  const [accounts, instruments, transactions, snapshots, settings] = await Promise.all([
    must(db.from('accounts').select('*').order('sort')),
    must(db.from('instruments').select('*').order('id')),
    must(db.from('transactions').select('*').order('date', { ascending: false }).order('id', { ascending: false })),
    must(db.from('snapshots').select('*').order('date')),
    must(db.from('settings').select('*')),
  ]);
  data = {
    accounts, instruments, transactions, snapshots,
    settings: settings[0] || { home_price: 1000000, down_payment_pct: 30, cash_pln: 0, monthly_pln: 5000, expected_return: 4.5 },
  };
  data.portfolio = computePortfolio(data);
  loadedAt = Date.now();
}

async function refresh() {
  const btn = $('#refresh');
  btn.classList.add('spinning');
  try {
    await load();
    showTab(tab);
  } catch (e) {
    alert('Could not load data: ' + e.message);
  } finally {
    btn.classList.remove('spinning');
  }
}

// ---------- auth ----------
function showLogin() {
  $('#loading').hidden = true;
  $('#app').hidden = true;
  $('#login').hidden = false;
}

async function enterApp() {
  $('#login').hidden = true;
  $('#loading').hidden = false;
  try {
    await load();
  } catch (e) {
    $('#loading').innerHTML = `<div class="card"><p class="error">Could not load data: ${esc(e.message)}</p></div>`;
    return;
  }
  $('#loading').hidden = true;
  $('#app').hidden = false;
  showTab(tab);
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const err = $('.error', form);
  const btn = $('button', form);
  err.hidden = true;
  btn.disabled = true;
  const { email, password } = Object.fromEntries(new FormData(form));
  const { error } = await db.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  if (error) {
    err.textContent = error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message;
    err.hidden = false;
    return;
  }
  enterApp();
});

db.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') showLogin();
});

// ---------- navigation ----------
const TITLES = { overview: 'Overview', goal: 'Home goal', history: 'History', activity: 'Activity' };
const RENDER = { overview: renderOverview, goal: renderGoal, history: renderHistory, activity: renderActivity };

function showTab(name) {
  if (!RENDER[name]) name = 'overview';
  tab = name;
  store.set('tab', name);
  document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== `tab-${name}`; });
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $('#page-title').textContent = TITLES[name];
  RENDER[name]($(`#tab-${name}`));
}

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { showTab(b.dataset.tab); window.scrollTo(0, 0); }));
$('#refresh').addEventListener('click', refresh);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && data && Date.now() - loadedAt > 60000) refresh();
});

// ---------- overview ----------
function positionRow(p) {
  const ins = p.instrument;
  const priceText = p.price == null ? 'price pending' : zl2(p.price);
  return `<div class="row">
    <div class="left">
      <b>${esc(ins.id)}</b><span class="chip">${esc(p.account?.name.replace('XTB ', '') ?? '')}</span>
      <div class="sub">${esc(ins.name)}</div>
      <div class="sub">${fmtN.format(p.units)} × ${priceText} · avg ${zl2(p.avgCost)}</div>
    </div>
    <div class="right">
      <b>${zl(p.value)}</b>
      <div class="small ${cls(p.gain)}">${szl(p.gain)} (${pct(p.gainPct)})</div>
      ${Math.abs(p.dayChange) >= 0.5 ? `<div class="small muted">today <span class="${cls(p.dayChange)}">${szl(p.dayChange)}</span></div>` : ''}
    </div>
  </div>`;
}

function renderOverview(el) {
  const p = data.portfolio;
  const cash = Number(data.settings.cash_pln || 0);
  const gain = p.total - p.cost;
  const priceDates = data.instruments.filter((i) => i.kind === 'etf' && i.price_date).map((i) => i.price_date).sort();
  const lastPrice = priceDates.at(-1);
  const groups = [['etf', 'ETFs'], ['bond', 'Treasury bonds']];

  el.innerHTML = `
    <div class="card hero">
      <div class="label">Total portfolio</div>
      <div class="big">${zl(p.total)}</div>
      <div class="${cls(gain)}"><b>${szl(gain)}</b> (${pct(p.cost ? gain / p.cost : 0)}) <span class="muted">all time</span></div>
      <div class="meta">
        <span>Today <b class="${cls(p.dayChange)}">${szl(p.dayChange)}</b></span>
        <span>Invested <b>${zl(p.cost)}</b></span>
        ${cash ? `<span>Cash to invest <b>${zl(cash)}</b></span>` : ''}
      </div>
      <div class="small muted">${lastPrice ? `ETF prices from ${niceDate(lastPrice)} · updated automatically every weekday evening` : 'Prices will appear after the first daily update'}</div>
    </div>
    ${p.warnings.map((w) => `<div class="warn">⚠️ <b>${esc(w.instrument.id)}</b> started interest year ${w.year}. Enter the new rate so the value is exact (using last year's rate for now).
      <div><button class="ghost small-btn" data-rates="${esc(w.instrument.id)}">Enter rate</button></div></div>`).join('')}
    <div class="card"><h2>Allocation</h2><div class="chart-wrap pie"><canvas id="c-alloc"></canvas></div></div>
    ${groups.map(([kind, title]) => {
      const rows = p.positions.filter((x) => x.instrument.kind === kind).sort((a, b) => b.value - a.value);
      if (!rows.length) return '';
      const v = rows.reduce((s, x) => s + x.value, 0);
      const g = rows.reduce((s, x) => s + x.gain, 0);
      return `<div class="card"><h2>${title} <span class="muted">${zl(v)} · <span class="${cls(g)}">${szl(g)}</span></span></h2>
        <div class="rows">${rows.map(positionRow).join('')}</div></div>`;
    }).join('')}
    <p class="small muted" style="text-align:center">IKE money is shown here but not counted toward the home goal.
      <br><button class="link small" id="signout">Log out</button></p>`;

  el.querySelectorAll('[data-rates]').forEach((b) => b.addEventListener('click', () => editBondForm(b.dataset.rates)));
  $('#signout', el).addEventListener('click', () => db.auth.signOut());

  // Allocation doughnut: combine the same ETF across accounts.
  const byIns = new Map();
  for (const x of p.positions) {
    const k = x.instrument.kind === 'bond' ? 'EDO bonds' : x.instrument.id;
    byIns.set(k, (byIns.get(k) || 0) + x.value);
  }
  if (cash > 0) byIns.set('Cash', cash);
  const entries = [...byIns.entries()].sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((s, e) => s + e[1], 0);
  chart('c-alloc', {
    type: 'doughnut',
    data: {
      labels: entries.map(([k, v]) => `${k}  ${(v / sum * 100).toFixed(1)}%`),
      datasets: [{ data: entries.map((e) => Math.round(e[1])), backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]), borderColor: css('--card'), borderWidth: 2 }],
    },
    options: {
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: window.innerWidth < 500 ? 'bottom' : 'right', labels: { boxWidth: 12, boxHeight: 12, padding: 10 } },
        tooltip: { callbacks: { label: (c) => ` ${zl(c.raw)}` } },
      },
    },
  });
}

// ---------- goal ----------
function goalBase() {
  const s = data.settings;
  const p = data.portfolio;
  const cash = Number(s.cash_pln || 0);
  return {
    target: Number(s.home_price) * Number(s.down_payment_pct) / 100,
    start: p.goalValue + cash,
    startCost: p.goalCost + cash,
    invested: p.goalValue,
    cash,
  };
}

let saveTimer;
function saveSettingsSoon(patch) {
  Object.assign(data.settings, patch);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => db.from('settings').update(patch).eq('id', 1).then(({ error }) => error && console.error(error)), 800);
}

function renderGoal(el) {
  const b = goalBase();
  const s = data.settings;
  const progress = Math.min(1, b.start / b.target);
  let afterTax = store.get('afterTax', '0') === '1';

  el.innerHTML = `
    <div class="card">
      <div class="toolbar"><div class="label">Down payment goal</div><button class="link small" id="edit-goal">Edit</button></div>
      <div class="big">${zl(b.target)}</div>
      <div class="muted small">${fmt0.format(s.down_payment_pct)}% of a ${zl(s.home_price)} home</div>
      <div class="progress"><div style="width:${(progress * 100).toFixed(1)}%"></div></div>
      <div class="toolbar small"><span><b>${zl(b.start)}</b> saved (${(progress * 100).toFixed(0)}%)</span><span class="muted">${zl(Math.max(0, b.target - b.start))} to go</span></div>
      <div class="small muted" style="margin-top:6px">Investments without IKE ${zl(b.invested)} + cash ${zl(b.cash)}</div>
    </div>

    <div class="card">
      <div class="control">
        <div class="slider-head"><span class="label">We invest monthly</span><b id="g-monthly-v"></b></div>
        <div class="chips" id="g-presets">${[4000, 5000, 6000].map((m) => `<button data-m="${m}">${m / 1000}k</button>`).join('')}</div>
        <input type="range" id="g-monthly" min="0" max="15000" step="250" value="${s.monthly_pln}">
      </div>
      <div class="control">
        <div class="slider-head"><span class="label">Expected yearly return</span><b id="g-return-v"></b></div>
        <input type="range" id="g-return" min="0" max="10" step="0.5" value="${s.expected_return}">
      </div>
      <label class="check"><input type="checkbox" id="g-tax" ${afterTax ? 'checked' : ''}> Count 19% tax on gains (Belka) when selling</label>
      <div class="result">
        <div class="label">You reach the down payment in</div>
        <div class="big" id="g-date"></div>
        <div class="muted" id="g-dur"></div>
        <div class="result-sub" id="g-sub"></div>
      </div>
    </div>

    <div class="card">
      <h2>Scenarios <span class="muted" id="g-scen-note"></span></h2>
      <table class="grid" id="g-table"></table>
    </div>

    <div class="card">
      <h2>Projected savings</h2>
      <div class="chart-wrap tall"><canvas id="c-goal"></canvas></div>
    </div>

    <div class="card">
      <h2>Reach it by a specific date</h2>
      <label>Target date<input type="month" id="g-by" value="${store.get('goalBy', `${new Date().getFullYear() + 2}-12`)}"></label>
      <p class="hint" id="g-need" style="margin-top:10px"></p>
    </div>`;

  const monthly = $('#g-monthly', el);
  const ret = $('#g-return', el);
  const now = new Date();

  const calc = (m, r, tax = afterTax) => projectGoal({ start: b.start, startCost: b.startCost, monthly: m, annualReturn: r, target: b.target, afterTax: tax });
  const dateText = (months) => (months == null ? 'more than 50 years' : months === 0 ? 'Now 🎉' : monthYear(addMonths(now, months)));

  function update(save = true) {
    const m = Number(monthly.value);
    const r = Number(ret.value);
    $('#g-monthly-v', el).textContent = zl(m);
    $('#g-return-v', el).textContent = `${r.toFixed(1)}%`;
    el.querySelectorAll('#g-presets button').forEach((x) => x.classList.toggle('on', Number(x.dataset.m) === m));

    const res = calc(m, r);
    const other = calc(m, r, !afterTax);
    $('#g-date', el).textContent = dateText(res.months);
    $('#g-dur', el).textContent = res.months ? `in ${duration(res.months)}` : '';
    if (res.months != null) {
      const put = b.start + m * res.months;
      $('#g-sub', el).innerHTML = `<span>You add <b>${zl(m * res.months)}</b></span><span>Growth <b>${zl(res.series.at(-1) - put)}</b></span>
        <span>${afterTax ? 'Before tax' : 'After tax'}: <b>${dateText(other.months)}</b></span>`;
    } else {
      $('#g-sub', el).innerHTML = '';
    }

    // Scenario table: monthly amount × return
    const rets = [4, 4.5, 5];
    if (!rets.includes(r)) rets.push(r);
    rets.sort((a, c) => a - c);
    const ms = [...new Set([4000, 5000, 6000, m])].sort((a, c) => a - c);
    $('#g-scen-note', el).textContent = afterTax ? 'after tax' : 'before tax';
    $('#g-table', el).innerHTML = `<tr><th>Monthly</th>${rets.map((x) => `<th>${x}% / yr</th>`).join('')}</tr>` +
      ms.map((mm) => `<tr><td><b>${zl(mm)}</b></td>${rets.map((rr) => {
        const mo = calc(mm, rr).months;
        return `<td class="${mm === m && rr === r ? 'hl' : ''}">${dateText(mo)}<div class="small muted">${mo == null ? '' : duration(mo)}</div></td>`;
      }).join('')}</tr>`).join('');

    // Chart
    const lines = [...new Set([4000, 5000, 6000, m])].sort((a, c) => a - c);
    const runs = lines.map((mm) => ({ mm, ...calc(mm, r) }));
    const horizon = Math.min(240, Math.max(12, ...runs.map((x) => (x.months ?? 240) + 3)));
    const labels = Array.from({ length: horizon + 1 }, (_, i) => monthYear(addMonths(now, i)));
    const series = (mm) => {
      const full = projectGoal({ start: b.start, startCost: b.startCost, monthly: mm, annualReturn: r, target: Infinity, afterTax, maxMonths: horizon });
      return full.series.map((v) => Math.round(v));
    };
    chart('c-goal', {
      type: 'line',
      data: {
        labels,
        datasets: [
          ...runs.map((x, i) => ({
            label: `${zl(x.mm)}/mo`,
            data: series(x.mm),
            borderColor: x.mm === m ? css('--accent') : PALETTE[(i + 1) % PALETTE.length],
            borderWidth: x.mm === m ? 3 : 1.5,
            pointRadius: 0,
            tension: 0.2,
          })),
          { label: 'Goal', data: labels.map(() => b.target), borderColor: css('--up'), borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false } },
          y: { ticks: { callback: (v) => `${Math.round(v / 1000)}k` } },
        },
        plugins: {
          legend: { labels: { boxWidth: 12, boxHeight: 2 } },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${zl(c.raw)}` } },
        },
      },
    });

    updateNeed();
    if (save) saveSettingsSoon({ monthly_pln: m, expected_return: r });
  }

  function updateNeed() {
    const by = $('#g-by', el).value;
    if (!by) return;
    store.set('goalBy', by);
    const [y, mo] = by.split('-').map(Number);
    const months = (y - now.getFullYear()) * 12 + (mo - 1 - now.getMonth());
    const r = Number(ret.value);
    const out = $('#g-need', el);
    if (months <= 0) { out.textContent = 'Pick a date in the future.'; return; }
    if (calc(0, r).months !== null && calc(0, r).months <= months) {
      out.innerHTML = `You'll get there by then <b>without adding anything</b> (at ${r}% a year).`;
      return;
    }
    let lo = 0, hi = 500000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const res = calc(mid, r);
      if (res.months !== null && res.months <= months) hi = mid; else lo = mid;
    }
    const need = Math.ceil(hi / 50) * 50;
    out.innerHTML = `To have ${zl(b.target)}${afterTax ? ' after tax' : ''} by <b>${monthYear(new Date(y, mo - 1, 1))}</b>, invest about <b>${zl(need)} per month</b> (at ${r}% a year).`;
  }

  monthly.addEventListener('input', () => update());
  ret.addEventListener('input', () => update());
  $('#g-tax', el).addEventListener('change', (e) => { afterTax = e.target.checked; store.set('afterTax', afterTax ? '1' : '0'); update(false); });
  el.querySelectorAll('#g-presets button').forEach((x) => x.addEventListener('click', () => { monthly.value = x.dataset.m; update(); }));
  $('#g-by', el).addEventListener('change', updateNeed);
  $('#edit-goal', el).addEventListener('click', editGoalForm);
  update(false);
}

function editGoalForm() {
  const s = data.settings;
  openForm('Home goal', `
    <label>Home price (zł)<input name="home_price" inputmode="decimal" value="${s.home_price}" required></label>
    <label>Down payment (%)<input name="down_payment_pct" inputmode="decimal" value="${s.down_payment_pct}" required></label>
    <label>Cash waiting to invest (zł)<input name="cash_pln" inputmode="decimal" value="${s.cash_pln}" required>
      <small>Money in the bank set aside for the home. It counts toward the goal.</small></label>`,
  async (f) => {
    const patch = { home_price: parseNum(f.home_price), down_payment_pct: parseNum(f.down_payment_pct), cash_pln: parseNum(f.cash_pln) };
    if (Object.values(patch).some((v) => !Number.isFinite(v) || v < 0)) throw new Error('Please enter valid numbers.');
    await must(db.from('settings').update(patch).eq('id', 1));
  });
}

// ---------- history ----------
function renderHistory(el) {
  const all = data.snapshots;
  const ranges = { '1m': 31, '3m': 92, '1y': 366, all: Infinity };
  const cutoff = ranges[historyRange] === Infinity ? '' : new Date(Date.now() - ranges[historyRange] * 86400000).toISOString().slice(0, 10);
  const snaps = all.filter((s) => s.date >= cutoff);

  el.innerHTML = `
    <div class="card">
      <div class="toolbar" style="margin-bottom:10px">
        <h2>Portfolio value</h2>
        <div class="chips" id="h-range">${Object.keys(ranges).map((k) => `<button data-r="${k}" class="${k === historyRange ? 'on' : ''}">${k.toUpperCase()}</button>`).join('')}</div>
      </div>
      ${snaps.length < 2
        ? `<p class="muted">The history builds up automatically: one point is saved every weekday evening. ${all.length ? `First point saved on ${niceDate(all[0].date)}.` : 'The first point will be saved tonight.'} Come back in a few days to see the line.</p>`
        : `<div class="chart-wrap tall"><canvas id="c-hist"></canvas></div>`}
    </div>
    ${snaps.length >= 2 ? historySummary(snaps) : ''}`;

  el.querySelectorAll('#h-range button').forEach((b) => b.addEventListener('click', () => {
    historyRange = b.dataset.r;
    store.set('range', historyRange);
    renderHistory(el);
  }));
  if (snaps.length < 2) return;

  chart('c-hist', {
    type: 'line',
    data: {
      labels: snaps.map((s) => niceDate(s.date)),
      datasets: [
        { label: 'Total value', data: snaps.map((s) => +s.total_pln), borderColor: css('--accent'), backgroundColor: css('--accent-soft'), fill: true, borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
        { label: 'Amount invested', data: snaps.map((s) => +s.cost_pln), borderColor: css('--text-2'), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 },
        { label: 'Home goal money', data: snaps.map((s) => +s.goal_pln), borderColor: css('--up'), borderWidth: 1.5, pointRadius: 0, tension: 0.2, hidden: true },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { maxTicksLimit: 5, maxRotation: 0 }, grid: { display: false } },
        y: { ticks: { callback: (v) => `${Math.round(v / 1000)}k` } },
      },
      plugins: {
        legend: { labels: { boxWidth: 12, boxHeight: 2 } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${zl(c.raw)}` } },
      },
    },
  });
}

function historySummary(snaps) {
  const a = snaps[0], z = snaps.at(-1);
  const dv = z.total_pln - a.total_pln;
  const dc = z.cost_pln - a.cost_pln;
  const growth = dv - dc;
  return `<div class="card"><h2>In this period</h2>
    <div class="rows">
      <div class="row"><span>Value change</span><b class="${cls(dv)}">${szl(dv)}</b></div>
      <div class="row"><span>New money put in</span><b>${szl(dc)}</b></div>
      <div class="row"><span>Market growth</span><b class="${cls(growth)}">${szl(growth)}</b></div>
    </div></div>`;
}

// ---------- activity ----------
function renderActivity(el) {
  const insById = Object.fromEntries(data.instruments.map((i) => [i.id, i]));
  const accById = Object.fromEntries(data.accounts.map((a) => [a.id, a]));
  let lastMonth = '';
  const txRows = data.transactions.map((t) => {
    const month = toDate(t.date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const head = month !== lastMonth ? `<div class="month-head">${month}</div>` : '';
    lastMonth = month;
    const total = t.units * t.price_pln + (t.type === 'sell' ? -1 : 1) * Number(t.fee_pln || 0);
    return `${head}<div class="row">
      <div class="left">
        <b>${esc(t.instrument_id)}</b><span class="chip ${t.type}">${t.type === 'sell' ? 'Sell' : 'Buy'}</span>
        <div class="sub">${niceDate(t.date)} · ${esc(accById[t.account_id]?.name ?? t.account_id)}</div>
        <div class="sub">${fmtN.format(t.units)} × ${zl2(t.price_pln)}${t.note ? ` · ${esc(t.note)}` : ''}</div>
      </div>
      <div class="right"><b>${zl2(total)}</b><div><button class="danger-link small" data-del="${t.id}">Delete</button></div></div>
    </div>`;
  }).join('');

  const etfs = data.instruments.filter((i) => i.kind === 'etf');
  const bonds = data.instruments.filter((i) => i.kind === 'bond');

  el.innerHTML = `
    <button class="primary" id="add-tx">+ Add purchase or sale</button>
    <div class="card"><h2>Transactions</h2><div class="rows">${txRows || '<p class="muted">No transactions yet.</p>'}</div></div>
    <div class="card">
      <h2>ETFs <button class="link small" id="add-etf">+ Add ETF</button></h2>
      <div class="rows">${etfs.map((i) => `<div class="row">
        <div class="left"><b>${esc(i.id)}</b><div class="sub">${esc(i.name)}</div><div class="sub">Price source: ${esc(i.yahoo_symbol || '—')}</div></div>
        <div class="right">${i.price_pln == null ? '<span class="muted">pending</span>' : `<b>${zl2(i.price_pln)}</b>`}
          <div class="small muted">${i.price_date ? niceDate(i.price_date) : ''}</div></div></div>`).join('')}</div>
    </div>
    <div class="card">
      <h2>Treasury bonds <button class="link small" id="add-bond">+ Add bond series</button></h2>
      <div class="rows">${bonds.map((i) => `<div class="row">
        <div class="left"><b>${esc(i.id)}</b><div class="sub">${esc(i.name)}</div>
          <div class="sub">Yearly rates: ${(i.bond_rates || []).map((r, k) => `Y${k + 1} ${r}%`).join(' · ') || '—'}</div></div>
        <div class="right"><button class="ghost small-btn" data-rates="${esc(i.id)}">Edit rates</button></div></div>`).join('')}</div>
    </div>`;

  $('#add-tx', el).addEventListener('click', () => txForm());
  $('#add-etf', el).addEventListener('click', etfForm);
  $('#add-bond', el).addEventListener('click', bondForm);
  el.querySelectorAll('[data-rates]').forEach((b) => b.addEventListener('click', () => editBondForm(b.dataset.rates)));
  el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const t = data.transactions.find((x) => String(x.id) === b.dataset.del);
    if (!confirm(`Delete this ${t.type} of ${fmtN.format(t.units)} ${t.instrument_id} from ${niceDate(t.date)}?`)) return;
    try {
      await must(db.from('transactions').delete().eq('id', t.id));
      await refresh();
    } catch (e) { alert(e.message); }
  }));
}

// ---------- forms ----------
function openForm(title, fields, onSubmit, saveLabel = 'Save') {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" class="form">
    <h2>${esc(title)}</h2>${fields}
    <p class="error" hidden></p>
    <div class="actions"><button value="cancel" formnovalidate class="ghost">Cancel</button><button value="ok" class="primary">${esc(saveLabel)}</button></div>
  </form>`;
  const form = $('form', dlg);
  form.addEventListener('submit', async (e) => {
    if (e.submitter?.value === 'cancel') return;
    e.preventDefault();
    const err = $('.error', form);
    const btn = $('button.primary', form);
    err.hidden = true;
    btn.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)), form);
      dlg.close();
      await refresh();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
  dlg.showModal();
  return form;
}

function txForm() {
  const lastAcc = store.get('lastAccount', 'poboczne');
  const cash = Number(data.settings.cash_pln || 0);
  const form = openForm('Add transaction', `
    <div class="seg"><label><input type="radio" name="type" value="buy" checked>Buy</label><label><input type="radio" name="type" value="sell">Sell</label></div>
    <label>Investment<select name="instrument_id" required>
      ${data.instruments.map((i) => `<option value="${esc(i.id)}">${esc(i.id)} — ${esc(i.name)}</option>`).join('')}
    </select></label>
    <label>Account<select name="account_id" required>
      ${data.accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === lastAcc ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
    </select></label>
    <label>Date<input type="date" name="date" value="${todayISO()}" required></label>
    <div class="two">
      <label>Units<input name="units" inputmode="decimal" placeholder="e.g. 2.5" required></label>
      <label><span id="tx-total-label">Total paid (zł)</span><input name="total" inputmode="decimal" placeholder="incl. fees" required></label>
    </div>
    <p class="hint" id="tx-hint">Use the total in zł that left your account (XTB shows it in the transaction history).</p>
    ${cash > 0 ? `<label class="check"><input type="checkbox" name="from_cash" checked> Paid from the ${zl(cash)} cash savings (reduces it)</label>` : ''}
    <label>Note (optional)<input name="note" maxlength="120"></label>`,
  async (f) => {
    const units = parseNum(f.units);
    const total = parseNum(f.total);
    if (!(units > 0) || !(total >= 0)) throw new Error('Enter the number of units and the total amount.');
    if (f.type === 'sell') {
      const pos = data.portfolio.positions.find((p) => p.instrument.id === f.instrument_id && p.account?.id === f.account_id);
      if (!pos || pos.units + 1e-9 < units) throw new Error(`You only have ${fmtN.format(pos?.units ?? 0)} units of ${f.instrument_id} in that account.`);
    }
    await must(db.from('transactions').insert({
      date: f.date, account_id: f.account_id, instrument_id: f.instrument_id, type: f.type,
      units, price_pln: total / units, fee_pln: 0, note: f.note || null,
    }));
    store.set('lastAccount', f.account_id);
    if (f.from_cash && f.type === 'buy') {
      await must(db.from('settings').update({ cash_pln: Math.max(0, cash - total) }).eq('id', 1));
    }
  });

  const hint = $('#tx-hint', form);
  const upd = () => {
    const ins = data.instruments.find((i) => i.id === form.instrument_id.value);
    const isBond = ins?.kind === 'bond';
    const sell = form.querySelector('input[name=type]:checked').value === 'sell';
    $('#tx-total-label', form).textContent = sell ? 'Total received (zł)' : 'Total paid (zł)';
    const cashBox = form.querySelector('input[name=from_cash]');
    if (cashBox) cashBox.closest('label').hidden = sell;
    const u = parseNum(form.units.value), t = parseNum(form.total.value);
    if (u > 0 && t > 0) hint.textContent = `= ${zl2(t / u)} per unit`;
    else hint.textContent = isBond ? 'Bonds cost 100 zł each (or 99.90 zł when rolled over).' : 'Use the total in zł that left your account (XTB shows it in the transaction history).';
  };
  form.instrument_id.addEventListener('change', () => {
    const ins = data.instruments.find((i) => i.id === form.instrument_id.value);
    if (ins?.kind === 'bond' && data.accounts.some((a) => a.id === 'bonds')) form.account_id.value = 'bonds';
    upd();
  });
  form.units.addEventListener('input', () => {
    const ins = data.instruments.find((i) => i.id === form.instrument_id.value);
    if (ins?.kind === 'bond' && parseNum(form.units.value) > 0) form.total.value = parseNum(form.units.value) * 100;
    upd();
  });
  form.total.addEventListener('input', upd);
  form.querySelectorAll('input[name=type]').forEach((r) => r.addEventListener('change', upd));
}

function etfForm() {
  openForm('Add ETF', `
    <label>Short code<input name="id" placeholder="e.g. VWCE" required maxlength="20"></label>
    <label>Name<input name="name" placeholder="e.g. Vanguard FTSE All-World" required></label>
    <label>Price source (Yahoo Finance symbol)<input name="yahoo_symbol" placeholder="e.g. VWCE.DE" required>
      <small>Search the ETF on finance.yahoo.com and copy the symbol. Ending: .DE = Germany (Xetra), .WA = Warsaw, .L = London, .AS = Amsterdam.</small></label>
    <label>Current price in zł (optional)<input name="price" inputmode="decimal">
      <small>Shown until the automatic update runs tonight.</small></label>`,
  async (f) => {
    const id = f.id.trim().toUpperCase();
    if (data.instruments.some((i) => i.id === id)) throw new Error(`${id} already exists.`);
    const price = f.price ? parseNum(f.price) : null;
    await must(db.from('instruments').insert({
      id, name: f.name.trim(), kind: 'etf', yahoo_symbol: f.yahoo_symbol.trim().toUpperCase(),
      price_pln: price, prev_price_pln: price, price_date: price ? todayISO() : null,
    }));
  });
}

function bondForm() {
  openForm('Add bond series', `
    <label>Series code<input name="id" placeholder="e.g. EDO1036" required maxlength="20">
      <small>Printed on your bond account, e.g. EDO1036 = 10-year EDO maturing Oct 2036.</small></label>
    <div class="two">
      <label>Year 1 rate (%)<input name="first" inputmode="decimal" placeholder="e.g. 6.00" required></label>
      <label>Margin (%)<input name="margin" inputmode="decimal" placeholder="e.g. 2.00" required></label>
    </div>
    <p class="hint">Both are in the offer on obligacjeskarbowe.pl for the month you buy. After adding, record the purchase with "Add purchase".</p>`,
  async (f) => {
    const id = f.id.trim().toUpperCase();
    if (data.instruments.some((i) => i.id === id)) throw new Error(`${id} already exists.`);
    await must(db.from('instruments').insert({
      id, name: `${id.slice(0, 3)} bonds, series ${id}`, kind: 'bond', currency: 'PLN',
      bond_margin: parseNum(f.margin), bond_rates: [parseNum(f.first)],
    }));
  });
}

function editBondForm(id) {
  const ins = data.instruments.find((i) => i.id === id);
  if (!ins) return;
  openForm(`${id} interest rates`, `
    <label>Rates per year (%), separated by semicolons<input name="rates" value="${(ins.bond_rates || []).join('; ')}" required></label>
    <label>Margin (%)<input name="margin" inputmode="decimal" value="${ins.bond_margin ?? ''}"></label>
    <p class="hint">Each new year's rate = margin + inflation published by GUS the month before the anniversary.
      You'll find it in your bond account at Pekao or on obligacjeskarbowe.pl. Example for this series: margin ${ins.bond_margin ?? '?'}% + inflation 2.4% = ${((ins.bond_margin ?? 0) + 2.4).toFixed(2)}%.</p>`,
  async (f) => {
    const rates = f.rates.split(/[;\n]+/).map((x) => x.trim()).filter(Boolean).map(parseNum);
    if (rates.some((x) => !Number.isFinite(x))) throw new Error('Rates must be numbers, e.g. 7.25; 7.45; 5.95');
    if (!rates.length) throw new Error('Enter at least the first year rate.');
    await must(db.from('instruments').update({ bond_rates: rates, bond_margin: f.margin ? parseNum(f.margin) : null }).eq('id', id));
  });
}

// ---------- start ----------
const { data: { session } } = await db.auth.getSession();
if (session) enterApp(); else showLogin();
