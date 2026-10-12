import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { computePortfolio, projectGoal, addMonths, todayISO, toDate, bondUnitValue } from './calc.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0, useGrouping: true });
const fmt2 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
const fmtN = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 4, useGrouping: true });
const zl = (x) => `${fmt0.format(Math.round(x))} zł`; // no line break before zł
const zl2 = (x) => `${fmt2.format(x)} zł`;
const sign = (x) => (x > 0.004 ? '+' : x < -0.004 ? '−' : '');
const szl = (x) => sign(x) + zl(Math.abs(x));
const pct = (x, d = 1) => `${sign(x)}${Math.abs(x * 100).toFixed(d).replace('.', ',')}%`;
const rate = (r) => `${fmtN.format(r)}%`;
const cls = (x) => (x > 0.004 ? 'up' : x < -0.004 ? 'down' : '');
const monthYear = (d) => d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
const monthShort = (d) => d.toLocaleDateString('pl-PL', { month: 'short', year: 'numeric' });
// "do grudnia 2028": Polish needs the genitive month, which Intl only gives next to a day number.
const monthGen = (d) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/^\d+\s/, '');
const niceDate = (iso) => toDate(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const parseNum = (s) => Number(String(s ?? '').replace(/\s/g, '').replace(',', '.'));
// Polish plural: 1 rok, 2–4 lata, 5+ lat (but 12–14 lat, 22–24 lata).
const plural = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);
const duration = (m) => {
  if (m === 0) return 'już teraz';
  const y = Math.floor(m / 12), mo = m % 12;
  return [y ? `${y} ${plural(y, 'rok', 'lata', 'lat')}` : '', mo ? `${mo} mies.` : ''].filter(Boolean).join(' ');
};
// Names stored in the database are partly English; show them in Polish.
const ACCOUNT_NAMES = { bonds: 'Obligacje (Pekao)' };
const accName = (a) => ACCOUNT_NAMES[a?.id] ?? a?.name ?? '';
const NOTES = { 'Starting balance from XTB': 'Stan początkowy z XTB', 'Starting balance': 'Stan początkowy' };
const noteText = (n) => NOTES[n] ?? n;
const insName = (ins) => {
  const m = ins.kind === 'bond' && /^([A-Z]{3})(\d\d)(\d\d)$/.exec(ins.id);
  return m ? `Obligacje ${m[1]}, wykup: ${monthYear(new Date(2000 + Number(m[3]), Number(m[2]) - 1, 1))}` : ins.name;
};
const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// Brochure inks: navy, sage, ochre, dusty blue, plum, teal, stone, brick, olive, slate.
// Terracotta is left out on purpose: in this app orange only ever means progress toward the home.
const PALETTE = ['#2b3a55', '#7aa37a', '#d2a24c', '#7d9ac2', '#8e5b7a', '#4f8a8b', '#a39b8b', '#a8553a', '#8a8d4f', '#5e6b8a'];
const WARN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01"/></svg>';

// Plain-language version of an error from the network or the database.
function friendly(e) {
  const m = String(e?.message ?? e ?? '');
  if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Brak połączenia. Sprawdźcie internet i spróbujcie ponownie.';
  if (/jwt|token|not authenticated|401/i.test(m)) return 'Sesja wygasła. Wylogujcie się i zalogujcie ponownie.';
  return m || 'Coś poszło nie tak. Spróbujcie ponownie.';
}

// Short message above the tab bar, optionally with one action (e.g. Undo).
let toastTimer;
function toast(message, { action, error = false, ms = 4000 } = {}) {
  const el = $('#toast');
  clearTimeout(toastTimer);
  el.className = `toast${error ? ' error' : ''}`;
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="toast-action">${esc(action.label)}</button>` : ''}`;
  el.hidden = false;
  if (action) $('.toast-action', el).addEventListener('click', () => { el.hidden = true; action.run(); });
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? Math.max(ms, 8000) : ms);
}

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

// Vertical gradient under a line: colour at the top fading to transparent.
const fade = (hex) => ({ chart: c }) => {
  if (!c.chartArea) return 'transparent';
  const g = c.ctx.createLinearGradient(0, c.chartArea.top, 0, c.chartArea.bottom);
  g.addColorStop(0, `${hex}40`);
  g.addColorStop(1, `${hex}00`);
  return g;
};

function chart(id, config, { live = false } = {}) {
  // Live charts (moved by sliders) update in place without animation instead of being rebuilt.
  const existing = charts[id];
  if (live && existing && existing.canvas === document.getElementById(id)) {
    existing.data = config.data;
    existing.update('none');
    return;
  }
  existing?.destroy();
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
    settings: settings[0] || { home_price: 1000000, down_payment_pct: 30, monthly_pln: 5000, expected_return: 4.5 },
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
    toast(`Nie udało się odświeżyć: ${friendly(e)}`, { error: true, action: { label: 'Ponów', run: refresh } });
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
    $('#loading').innerHTML = `<div class="card"><p class="error">Nie udało się wczytać danych: ${esc(friendly(e))}</p>
      <p><button class="primary" onclick="location.reload()">Spróbuj ponownie</button> <button class="ghost" id="err-out">Wyloguj się</button></p></div>`;
    $('#err-out').addEventListener('click', async () => { await db.auth.signOut(); location.reload(); });
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
    err.textContent = error.message === 'Invalid login credentials' ? 'Nieprawidłowy e-mail lub hasło.' : friendly(error);
    err.hidden = false;
    return;
  }
  enterApp();
});

db.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') showLogin();
});

// ---------- navigation ----------
const TITLES = { overview: 'Przegląd', goal: 'Mieszkanie', history: 'Historia', activity: 'Transakcje' };
const RENDER = { overview: renderOverview, goal: renderGoal, history: renderHistory, activity: renderActivity };

function showTab(name) {
  if (!RENDER[name]) name = 'overview';
  tab = name;
  store.set('tab', name);
  document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== `tab-${name}`; });
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === name);
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('#page-title').textContent = TITLES[name];
  document.title = `${TITLES[name]} · Nasze inwestycje`;
  RENDER[name]($(`#tab-${name}`));
}

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => { showTab(b.dataset.tab); window.scrollTo(0, 0); }));
$('#refresh').addEventListener('click', refresh);
// The sticky header gets a hairline once content scrolls under it.
addEventListener('scroll', () => $('.top').classList.toggle('scrolled', scrollY > 4), { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && data && Date.now() - loadedAt > 60000) refresh();
});

// ---------- overview ----------
// One row per investment; the same ETF held in two accounts is one row with the split underneath.
function holdingRow(h, color, share) {
  const ins = h.instrument;
  const accounts = h.parts.map((x) => accName(x.account).replace('XTB ', ''));
  const where = h.parts.length > 1
    ? h.parts.map((x, i) => `${esc(accounts[i])} ${zl(x.value)}`).join(' · ')
    : esc(accounts[0]);
  return `<div class="pos">
    <span class="swatch" style="--c:${color}" aria-hidden="true"></span>
    <div class="pos-main">
      <div class="pos-title"><b>${esc(ins.id)}</b><span class="muted">${(share * 100).toFixed(share < 0.1 ? 1 : 0).replace('.', ',')}%</span></div>
      <div class="sub">${esc(insName(ins))}</div>
      <div class="sub">${fmtN.format(h.units)} × ${h.price == null ? 'cena wkrótce' : zl2(h.price)} · ${where}</div>
    </div>
    <div class="pos-num">
      <b>${zl(h.value)}</b>
      <span class="${cls(h.gain)}">${pct(h.cost ? h.gain / h.cost : 0)} · ${szl(h.gain)}</span>
    </div>
  </div>`;
}

function groupHoldings(positions) {
  const map = new Map();
  for (const x of positions) {
    const h = map.get(x.instrument.id) || { instrument: x.instrument, parts: [], units: 0, value: 0, cost: 0, gain: 0, price: x.price };
    h.parts.push(x);
    h.units += x.units; h.value += x.value; h.cost += x.cost; h.gain += x.gain;
    map.set(x.instrument.id, h);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

// Floor plan of the home being saved for: rooms fill in order as the savings grow.
const ROOMS = [
  { name: 'Przedpokój', x: 84, y: 110, w: 112, h: 66, ly: 130 }, // label clear of the front door
  { name: 'Kuchnia', x: 196, y: 4, w: 120, h: 76 },
  { name: 'Łazienka', x: 4, y: 110, w: 80, h: 66 },
  { name: 'Sypialnia', x: 196, y: 80, w: 120, h: 96 },
  { name: 'Salon', x: 4, y: 4, w: 192, h: 106 },
];

function floorPlan(progress, saved, target) {
  const total = ROOMS.reduce((s, r) => s + r.w * r.h, 0);
  let left = progress * total;
  const rooms = ROOMS.map((r, i) => {
    const part = Math.max(0, Math.min(1, left / (r.w * r.h)));
    left -= r.w * r.h;
    const fh = r.h * part;
    return `<rect class="room" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>
      ${part > 0 ? `<rect class="room-fill" style="--i:${i}" x="${r.x}" y="${r.y + r.h - fh}" width="${r.w}" height="${fh}"/>` : ''}
      <text class="room-name${part >= 0.5 ? ' on' : ''}" x="${r.x + r.w / 2}" y="${r.ly ?? r.y + r.h / 2 + 3}" text-anchor="middle">${r.name}</text>`;
  }).join('');
  const dx = 4 + 312 * progress;
  return `<svg class="plan" viewBox="0 0 320 214" role="img" aria-label="Plan mieszkania: zebrano ${Math.round(progress * 100)}% wkładu własnego">
    ${rooms}
    <path class="walls" d="M196 4V30M196 52V130M196 152V176M4 110H120M146 110H196M84 110V130M84 152V176M196 80H230M252 80H316"/>
    <path class="walls outer" d="M120 176H4V4H316V176H150"/>
    <rect class="window" x="40" y="1.5" width="64" height="5"/><rect class="window" x="230" y="1.5" width="52" height="5"/>
    <rect class="window" x="313.5" y="104" width="5" height="46"/><rect class="window" x="1.5" y="34" width="5" height="46"/>
    <path class="door" d="M120 176V146A30 30 0 0 1 150 176"/>
    <path class="dim" d="M4 190H316M4 185V195M316 185V195"/>
    ${progress > 0 ? `<path class="dim-fill" d="M4 190H${dx.toFixed(1)}"/>` : ''}
    <text class="dim-text" x="4" y="208">zebrano ${zl(saved)}</text>
    <text class="dim-text" x="316" y="208" text-anchor="end">${zl(target)}</text>
  </svg>`;
}

function planCard() {
  const b = goalBase();
  const s = data.settings;
  const progress = Math.min(1, b.start / b.target);
  const res = projectGoal({ start: b.start, startCost: b.startCost, monthly: Number(s.monthly_pln), annualReturn: Number(s.expected_return), target: b.target });
  const when = res.months == null ? 'ponad 50 lat' : res.months === 0 ? 'teraz' : monthYear(addMonths(new Date(), res.months));
  return `${floorPlan(progress, b.start, b.target)}
    <div class="plan-text">
    <div class="plan-when"><span class="lead">Klucze</span><span class="big">${when}</span>${res.months ? `<span class="lead">za ${duration(res.months)}</span>` : ''}</div>
    <div class="plan-foot"><span><b>${(progress * 100).toFixed(0)}%</b> zebrane · ${zl(s.monthly_pln)} miesięcznie, ${rate(Number(s.expected_return))} rocznie</span><button class="link" data-go="goal">Otwórz plan</button></div>
    </div>`;
}

function renderOverview(el) {
  const p = data.portfolio;
  const gain = p.total - p.cost;
  const priceDates = data.instruments.filter((i) => i.kind === 'etf' && i.price_date).map((i) => i.price_date).sort();
  const lastPrice = priceDates.at(-1);
  const groups = [['etf', 'ETF-y'], ['bond', 'Obligacje skarbowe']];

  const holdings = groupHoldings(p.positions);
  const sum = holdings.reduce((t, h) => t + h.value, 0);
  // The first ink follows the theme so the biggest holding stays visible on a dark ground.
  const pal = [css('--ink'), ...PALETTE.slice(1)];
  const colorOf = Object.fromEntries(holdings.map((h, i) => [h.instrument.id, pal[i % pal.length]]));
  const top = holdings.slice(0, 3);
  const other = holdings.slice(3).reduce((t, h) => t + h.value, 0);
  const share = (v) => `${(v / sum * 100).toFixed(0)}%`;

  el.innerHTML = `
    <div class="card plan-card">
      ${planCard()}
      <p class="summary">Inwestycje warte <b>${zl(p.total)}</b> · dziś <span class="${cls(p.dayChange)}">${szl(p.dayChange)}</span><br>
        Wpłaciliście ${zl(p.cost)}, zysk <span class="${cls(gain)}">${szl(gain)} (${pct(p.cost ? gain / p.cost : 0)})</span>
        <span class="summary-foot">${lastPrice ? `Ceny z ${niceDate(lastPrice)} · aktualizacja w dni robocze wieczorem` : 'Ceny pojawią się po pierwszej wieczornej aktualizacji'}</span></p>
    </div>
    <button class="ghost add-btn" id="ov-add"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Dodaj zakup lub sprzedaż</button>
    ${p.warnings.map((w) => `<div class="warn">${WARN_ICON}<div>Obligacje <b>${esc(w.instrument.id)}</b> weszły w ${w.year}. rok. Wpiszcie nowe oprocentowanie, żeby wartość była dokładna (do tego czasu liczone według zeszłorocznego).
      <div><button class="ghost small-btn" data-rates="${esc(w.instrument.id)}">Wpisz oprocentowanie</button></div></div></div>`).join('')}
    ${p.oversold.map((o) => `<div class="warn">${WARN_ICON}<div>Sprzedaż ${fmtN.format(o.tx.units)} <b>${esc(o.tx.instrument_id)}</b> z ${niceDate(o.tx.date)} to więcej, niż wtedy mieliście (${fmtN.format(o.held)}). Sprawdźcie jej datę w Transakcjach.</div></div>`).join('')}
    <div class="card band">
      <h2>Co macie <span class="muted">${zl(sum)}</span></h2>
      ${holdings.length ? `
      <div class="mix" role="img" aria-label="Podział: ${top.map((h) => `${esc(h.instrument.id)} ${share(h.value)}`).join(', ')}${other ? `, inne ${share(other)}` : ''}">
        ${holdings.map((h) => `<i style="width:${(h.value / sum * 100).toFixed(2)}%;background:${colorOf[h.instrument.id]}"></i>`).join('')}
      </div>
      <p class="mix-legend" aria-hidden="true">${top.map((h) => `<span><i style="background:${colorOf[h.instrument.id]}"></i>${esc(h.instrument.id)} ${share(h.value)}</span>`).join('')}${other ? `<span>Inne ${(other / sum * 100).toFixed(1).replace('.', ',')}%</span>` : ''}</p>
      ${groups.map(([kind, title]) => {
        const rows = holdings.filter((h) => h.instrument.kind === kind);
        if (!rows.length) return '';
        const g = rows.reduce((t, h) => t + h.gain, 0);
        return `<h3 class="group-head">${title} <span class="muted">${zl(rows.reduce((t, h) => t + h.value, 0))} · <span class="${cls(g)}">${szl(g)}</span></span></h3>
          <div class="rows">${rows.map((h) => holdingRow(h, colorOf[h.instrument.id], h.value / sum)).join('')}</div>`;
      }).join('')}`
      : '<p class="muted">Jeszcze nic tu nie ma. Dodajcie pierwszy zakup, a pojawi się tutaj.</p>'}
    </div>`;

  el.querySelectorAll('[data-rates]').forEach((b) => b.addEventListener('click', () => editBondForm(b.dataset.rates)));
  $('#ov-add', el).addEventListener('click', () => txForm());
  el.querySelectorAll('[data-go]').forEach((x) => x.addEventListener('click', () => { showTab('goal'); window.scrollTo(0, 0); }));
}

// ---------- goal ----------
function goalBase() {
  const s = data.settings;
  const p = data.portfolio;
  return {
    target: Number(s.home_price) * Number(s.down_payment_pct) / 100,
    start: p.goalValue,
    startCost: p.goalCost,
  };
}

let saveTimer;
function saveSettingsSoon(patch) {
  Object.assign(data.settings, patch);
  clearTimeout(saveTimer);
  // The plan is shared, so say when a change has been saved for both of you.
  saveTimer = setTimeout(() => db.from('settings').update(patch).eq('id', 1).then(({ error }) => {
    if (error) toast(`Plan nie został zapisany: ${friendly(error)}`, { error: true });
    else toast('Plan zapisany dla was obojga');
  }), 800);
}

function renderGoal(el) {
  const b = goalBase();
  const s = data.settings;
  const now = new Date();
  let afterTax = store.get('afterTax', '0') === '1';
  let mode = store.get('goalMode', 'when');
  const byDefault = store.get('goalBy', `${now.getFullYear() + 2}-12`);

  // One answer at a time: "when do we get the keys?" or "how much do we need to save for a date?".
  el.innerHTML = `
    <div class="card goal-card">
      <div class="seg" role="radiogroup" aria-label="Pytanie">
        <label><input type="radio" name="g-mode" value="when" ${mode === 'when' ? 'checked' : ''}>Kiedy kupimy?</label>
        <label><input type="radio" name="g-mode" value="need" ${mode === 'need' ? 'checked' : ''}>Ile odkładać?</label>
      </div>

      <div class="result" aria-live="polite">
        <div class="label" id="g-q"></div>
        <div class="big" id="g-a"></div>
        <div class="muted" id="g-dur"></div>
        <div class="result-sub" id="g-sub"></div>
      </div>

      <div class="control" data-mode="when">
        <div class="slider-head"><span class="label" id="g-monthly-l">Inwestujemy miesięcznie</span><b id="g-monthly-v"></b></div>
        <div class="chips" id="g-presets">${[4000, 5000, 6000].map((m) => `<button data-m="${m}" aria-label="${zl(m)} miesięcznie">${m / 1000} tys.</button>`).join('')}</div>
        <input type="range" id="g-monthly" min="0" max="15000" step="250" value="${s.monthly_pln}" aria-labelledby="g-monthly-l">
      </div>
      <div class="control" data-mode="need">
        <label>Klucze chcemy mieć do<input type="month" id="g-by" value="${byDefault}" min="${now.toISOString().slice(0, 7)}"></label>
      </div>
      <div class="control">
        <div class="slider-head"><span class="label" id="g-return-l">Zakładany zwrot roczny</span><b id="g-return-v"></b></div>
        <input type="range" id="g-return" min="0" max="10" step="0.5" value="${s.expected_return}" aria-labelledby="g-return-l" aria-describedby="g-return-h">
        <p class="hint" id="g-return-h">Ostrożne założenie to 4–5% rocznie. Więcej jest możliwe, ale niepewne.</p>
      </div>
      <label class="check"><input type="checkbox" id="g-tax" ${afterTax ? 'checked' : ''}> Uwzględnij 19% podatku od zysków (Belka) przy sprzedaży</label>

      <div class="goal-line">
        <span>Cel <b>${zl(b.target)}</b>, czyli ${fmtN.format(s.down_payment_pct)}% mieszkania za ${zl(s.home_price)} · zebrano ${zl(b.start)}</span>
        <button class="link" id="edit-goal">Zmień cel</button>
      </div>
    </div>

    <details class="card compare" id="g-compare">
      <summary><h2>Porównaj scenariusze</h2><span class="muted small" id="g-scen-note"></span></summary>
      <table class="grid" id="g-table"></table>
      <div class="chart-wrap tall"><canvas id="c-goal" role="img" aria-label="Prognoza oszczędności przy 4 000, 5 000 i 6 000 zł miesięcznie na tle celu"></canvas></div>
    </details>`;

  const monthly = $('#g-monthly', el);
  const ret = $('#g-return', el);
  const compare = $('#g-compare', el);
  compare.open = store.get('goalCompare', '0') === '1';

  const calc = (m, r, tax = afterTax) => projectGoal({ start: b.start, startCost: b.startCost, monthly: m, annualReturn: r, target: b.target, afterTax: tax });
  const dateText = (months, short = false) => (months == null ? 'ponad 50 lat' : months === 0 ? 'teraz' : (short ? monthShort : monthYear)(addMonths(now, months)));

  // Smallest monthly amount that reaches the goal within `months` (null when the date is too close).
  function needFor(months, r) {
    if (calc(0, r).months !== null && calc(0, r).months <= months) return 0;
    let lo = 0, hi = 500000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const res = calc(mid, r);
      if (res.months !== null && res.months <= months) hi = mid; else lo = mid;
    }
    return hi >= 499999 ? null : Math.ceil(hi / 50) * 50;
  }

  function answer() {
    const m = Number(monthly.value);
    const r = Number(ret.value);
    el.querySelectorAll('[data-mode]').forEach((x) => { x.hidden = x.dataset.mode !== mode; });
    $('#g-monthly-v', el).textContent = zl(m);
    monthly.setAttribute('aria-valuetext', `${zl(m)} miesięcznie`);
    $('#g-return-v', el).textContent = rate(r);
    ret.setAttribute('aria-valuetext', `${rate(r)} rocznie`);
    el.querySelectorAll('#g-presets button').forEach((x) => { x.classList.toggle('on', Number(x.dataset.m) === m); x.setAttribute('aria-pressed', String(Number(x.dataset.m) === m)); });
    const q = $('#g-q', el), a = $('#g-a', el), dur = $('#g-dur', el), sub = $('#g-sub', el);

    if (mode === 'when') {
      const res = calc(m, r);
      const other = calc(m, r, !afterTax);
      q.textContent = `Klucze${afterTax ? ', po podatku' : ''}`;
      a.textContent = dateText(res.months);
      dur.textContent = res.months ? `za ${duration(res.months)}` : '';
      sub.innerHTML = res.months == null ? '' : `<div><span>Dołożycie</span><b>${zl(m * res.months)}</b></div>
        <div><span>Wzrost</span><b>${zl(res.series.at(-1) - b.start - m * res.months)}</b></div>
        <div><span>${afterTax ? 'Przed podatkiem' : 'Po podatku'}</span><b>${dateText(other.months, true)}</b></div>`;
    } else {
      const by = $('#g-by', el).value;
      if (by) store.set('goalBy', by);
      const [y, mo] = (by || byDefault).split('-').map(Number);
      const months = (y - now.getFullYear()) * 12 + (mo - 1 - now.getMonth());
      const need = months > 0 ? needFor(months, r) : null;
      q.textContent = `Klucze do ${monthGen(new Date(y, mo - 1, 1))}${afterTax ? ', po podatku' : ''}`;
      dur.textContent = '';
      sub.innerHTML = '';
      if (months <= 0) { a.textContent = '—'; dur.textContent = 'Wybierzcie miesiąc w przyszłości.'; return; }
      if (need === null) { a.textContent = '—'; dur.textContent = 'Ten termin jest zbyt bliski, żeby zdążyć z oszczędzaniem.'; return; }
      if (need === 0) { a.textContent = 'Nic więcej'; dur.textContent = `Zdążycie bez dokładania, przy ${rate(r)} rocznie.`; return; }
      a.innerHTML = `${zl(need)}<span class="per"> miesięcznie</span>`;
      dur.textContent = need > m ? `o ${zl(need - m)} więcej niż teraz` : `o ${zl(m - need)} mniej niż teraz`;
    }
  }

  function scenarios() {
    if (!compare.open) return;
    const m = Number(monthly.value);
    const r = Number(ret.value);
    // Fixed 3×3 grid so it never changes size while a slider moves.
    const rets = [4, 4.5, 5];
    const ms = [4000, 5000, 6000];
    $('#g-scen-note', el).textContent = afterTax ? 'po podatku' : 'przed podatkiem';
    $('#g-table', el).innerHTML = `<tr><th>Miesięcznie</th>${rets.map((x) => `<th>${rate(x)} / rok</th>`).join('')}</tr>` +
      ms.map((mm) => `<tr><td><b>${zl(mm)}</b></td>${rets.map((rr) => {
        const mo = calc(mm, rr).months;
        return `<td class="${mm === m && rr === r ? 'hl' : ''}">${dateText(mo, true)}<div class="small muted">${mo == null ? '' : duration(mo)}</div></td>`;
      }).join('')}</tr>`).join('');

    const lines = [...new Set([4000, 5000, 6000, m])].sort((a, c) => a - c);
    const runs = lines.map((mm) => ({ mm, ...calc(mm, r) }));
    const horizon = Math.min(240, Math.max(12, ...runs.map((x) => (x.months ?? 240) + 3)));
    const labels = Array.from({ length: horizon + 1 }, (_, i) => monthShort(addMonths(now, i)));
    const series = (mm) => projectGoal({ start: b.start, startCost: b.startCost, monthly: mm, annualReturn: r, target: Infinity, afterTax, maxMonths: horizon }).series.map((v) => Math.round(v));
    chart('c-goal', {
      type: 'line',
      data: {
        labels,
        datasets: [
          ...runs.map((x, i) => ({
            label: `${zl(x.mm)}/mies.`,
            data: series(x.mm),
            borderColor: x.mm === m ? css('--accent') : PALETTE[(i + 1) % PALETTE.length],
            borderWidth: x.mm === m ? 3 : 1.5,
            fill: x.mm === m ? 'origin' : false,
            backgroundColor: fade(css('--accent')),
            pointRadius: 0,
            tension: 0.2,
          })),
          { label: 'Cel', data: labels.map(() => b.target), borderColor: css('--fill'), borderDash: [6, 5], borderWidth: 2, pointRadius: 0 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { ticks: { maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: (v) => `${Math.round(v / 1000)} tys.` } },
        },
        plugins: {
          legend: { labels: { boxWidth: 12, boxHeight: 2 } },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${zl(c.raw)}` } },
        },
      },
    }, { live: true });
  }

  function update(save = true) {
    answer();
    scenarios();
    if (save) saveSettingsSoon({ monthly_pln: Number(monthly.value), expected_return: Number(ret.value) });
  }

  el.querySelectorAll('input[name=g-mode]').forEach((x) => x.addEventListener('change', () => { mode = x.value; store.set('goalMode', mode); update(false); }));
  monthly.addEventListener('input', () => update());
  ret.addEventListener('input', () => update());
  $('#g-by', el).addEventListener('change', () => update(false));
  $('#g-tax', el).addEventListener('change', (e) => { afterTax = e.target.checked; store.set('afterTax', afterTax ? '1' : '0'); update(false); });
  el.querySelectorAll('#g-presets button').forEach((x) => x.addEventListener('click', () => { monthly.value = x.dataset.m; update(); }));
  compare.addEventListener('toggle', () => { store.set('goalCompare', compare.open ? '1' : '0'); scenarios(); });
  $('#edit-goal', el).addEventListener('click', editGoalForm);
  update(false);
}

function editGoalForm() {
  const s = data.settings;
  openForm('Cel: mieszkanie', `
    <label>Cena mieszkania (zł)<input name="home_price" inputmode="decimal" value="${fmt0.format(s.home_price)}" required></label>
    <label>Wkład własny (%)<input name="down_payment_pct" inputmode="decimal" value="${fmtN.format(s.down_payment_pct)}" required>
      <small>Część ceny, którą trzeba mieć na start z własnych pieniędzy.</small></label>`,
  async (f) => {
    const patch = { home_price: parseNum(f.home_price), down_payment_pct: parseNum(f.down_payment_pct) };
    if (Object.values(patch).some((v) => !Number.isFinite(v) || v < 0)) throw new Error('Wpiszcie poprawne liczby.');
    await must(db.from('settings').update(patch).eq('id', 1));
  });
}

// ---------- history ----------
function renderHistory(el) {
  const all = data.snapshots;
  const ranges = { '1m': 31, '3m': 92, '1y': 366, all: Infinity };
  const RANGE_LABELS = { '1m': '1 mies.', '3m': '3 mies.', '1y': '1 rok', all: 'Całość' };
  const cutoff = ranges[historyRange] === Infinity ? '' : new Date(Date.now() - ranges[historyRange] * 86400000).toISOString().slice(0, 10);
  const snaps = all.filter((s) => s.date >= cutoff);

  el.innerHTML = `
    ${snaps.length >= 2 ? historySummary(snaps) : ''}
    <div class="card">
      <div class="toolbar" style="margin-bottom:10px">
        <h2>Wartość portfela</h2>
        <div class="chips" id="h-range" role="group" aria-label="Okres">${Object.keys(ranges).map((k) => `<button data-r="${k}" class="${k === historyRange ? 'on' : ''}" aria-pressed="${k === historyRange}">${RANGE_LABELS[k]}</button>`).join('')}</div>
      </div>
      ${snaps.length < 2
        ? `<p class="muted">Historia buduje się sama: w każdy dzień roboczy wieczorem zapisuje się jeden punkt. ${all.length ? `Pierwszy punkt zapisano ${niceDate(all[0].date)}.` : 'Pierwszy punkt zapisze się dziś wieczorem.'} Zajrzyjcie za kilka dni, żeby zobaczyć linię.</p>`
        : `<div class="chart-wrap tall"><canvas id="c-hist" role="img" aria-label="Wartość portfela od ${niceDate(snaps[0].date)} do ${niceDate(snaps.at(-1).date)}: z ${zl(snaps[0].total_pln)} do ${zl(snaps.at(-1).total_pln)}; wpłacone ${zl(snaps.at(-1).cost_pln)}"></canvas></div>`}
    </div>`;

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
        { label: 'Wartość', data: snaps.map((s) => +s.total_pln), borderColor: css('--accent'), backgroundColor: fade(css('--accent')), fill: true, borderWidth: 2.5, pointRadius: 0, tension: 0.25 },
        { label: 'Wpłacone', data: snaps.map((s) => +s.cost_pln), borderColor: css('--text-2'), borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { maxTicksLimit: 5, maxRotation: 0 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { callback: (v) => `${Math.round(v / 1000)} tys.` } },
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
  // Money moved in (buys) or out (sales) between the two snapshots.
  const dc = data.transactions
    .filter((t) => t.date > a.date && t.date <= z.date)
    .reduce((s, t) => s + (t.type === 'sell' ? -(t.units * t.price_pln - (t.fee_pln || 0)) : t.units * t.price_pln + Number(t.fee_pln || 0)), 0);
  const growth = dv - dc;
  return `<div class="card"><h2>W tym okresie</h2>
    <div class="rows">
      <div class="row"><span>Zmiana wartości</span><b class="${cls(dv)}">${szl(dv)}</b></div>
      <div class="row"><span>Nowe wpłaty</span><b>${szl(dc)}</b></div>
      <div class="row"><span>Wzrost rynku</span><b class="${cls(growth)}">${szl(growth)}</b></div>
    </div></div>`;
}

// ---------- activity ----------
function renderActivity(el) {
  const insById = Object.fromEntries(data.instruments.map((i) => [i.id, i]));
  const accById = Object.fromEntries(data.accounts.map((a) => [a.id, a]));
  let lastMonth = '';
  const txRows = data.transactions.map((t) => {
    const month = cap(toDate(t.date).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
    const head = month !== lastMonth ? `<div class="month-head">${month}</div>` : '';
    lastMonth = month;
    const total = t.units * t.price_pln + (t.type === 'sell' ? -1 : 1) * Number(t.fee_pln || 0);
    const sell = t.type === 'sell';
    return `${head}<button class="pos tx" data-tx="${t.id}" aria-label="${sell ? 'Sprzedaż' : 'Kupno'} ${esc(t.instrument_id)}, ${zl2(total)}, ${niceDate(t.date)}. Otwórz, żeby edytować lub usunąć">
      <div class="pos-main">
        <div class="pos-title"><b>${esc(t.instrument_id)}</b><span class="chip ${t.type}">${sell ? 'Sprzedaż' : 'Kupno'}</span></div>
        <div class="sub">${niceDate(t.date)} · ${esc(accName(accById[t.account_id]) || t.account_id)}</div>
        <div class="sub">${fmtN.format(t.units)} × ${zl2(t.price_pln)}${t.note ? ` · ${esc(noteText(t.note))}` : ''}</div>
      </div>
      <div class="pos-num"><b>${zl2(total)}</b><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></div>
    </button>`;
  }).join('');

  const etfs = data.instruments.filter((i) => i.kind === 'etf');
  const bonds = data.instruments.filter((i) => i.kind === 'bond');

  el.innerHTML = `
    <div class="card"><div class="card-head"><h2>Transakcje</h2><button class="ghost small-btn" id="add-tx" aria-label="Dodaj zakup lub sprzedaż">+ Dodaj</button></div><div class="rows">${txRows || '<p class="muted">Brak transakcji. Użyjcie „+ Dodaj”, gdy coś kupicie.</p>'}</div></div>
    <h2 class="band-title">Wasze inwestycje</h2>
    <div class="card">
      <div class="card-head"><h2>ETF-y</h2><button class="link small" id="add-etf">+ Dodaj ETF</button></div>
      <div class="rows">${etfs.length ? '' : '<p class="muted">Brak ETF-ów.</p>'}${etfs.map((i) => `<div class="row">
        <div class="left"><b>${esc(i.id)}</b><div class="sub">${esc(i.name)}</div><div class="sub">Cena z Yahoo Finance: ${esc(i.yahoo_symbol || '—')}</div></div>
        <div class="right">${i.price_pln == null ? '<span class="muted">wkrótce</span>' : `<b>${zl2(i.price_pln)}</b>`}
          <div class="small muted">${i.price_date ? niceDate(i.price_date) : ''}</div></div></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Obligacje skarbowe</h2><button class="link small" id="add-bond">+ Dodaj serię</button></div>
      <div class="rows">${bonds.length ? '' : '<p class="muted">Brak serii obligacji.</p>'}${bonds.map((i) => `<div class="row">
        <div class="left"><b>${esc(i.id)}</b><div class="sub">${esc(insName(i))}</div>
          <div class="sub">Oprocentowanie: ${(i.bond_rates || []).map((r, k) => `${k + 1}. rok ${rate(r)}`).join(' · ') || '—'}</div></div>
        <div class="right"><button class="ghost small-btn" data-rates="${esc(i.id)}" aria-label="Oprocentowanie ${esc(i.id)}">Oprocentowanie</button></div></div>`).join('')}</div>
    </div>
    <p class="footnote"><button class="link" id="signout">Wyloguj się</button></p>`;

  $('#add-tx', el).addEventListener('click', () => txForm());
  $('#add-etf', el).addEventListener('click', etfForm);
  $('#add-bond', el).addEventListener('click', bondForm);
  $('#signout', el).addEventListener('click', () => db.auth.signOut());
  el.querySelectorAll('[data-rates]').forEach((b) => b.addEventListener('click', () => editBondForm(b.dataset.rates)));
  el.querySelectorAll('[data-tx]').forEach((b) => b.addEventListener('click', () => {
    const t = data.transactions.find((x) => String(x.id) === b.dataset.tx);
    if (t) txSheet(t);
  }));
}

const txTotal = (t) => t.units * t.price_pln + (t.type === 'sell' ? -1 : 1) * Number(t.fee_pln || 0);

// "Keys by" month for a given list of transactions, to show what a change would do to the plan.
function keysBy(transactions) {
  const s = data.settings;
  const p = computePortfolio({ ...data, transactions });
  const target = Number(s.home_price) * Number(s.down_payment_pct) / 100;
  const res = projectGoal({ start: p.goalValue, startCost: p.goalCost, monthly: Number(s.monthly_pln), annualReturn: Number(s.expected_return), target });
  return res.months == null ? 'ponad 50 lat' : res.months === 0 ? 'teraz' : monthYear(addMonths(new Date(), res.months));
}

function txSheet(t) {
  const dlg = $('#dlg');
  const account = accName(data.accounts.find((a) => a.id === t.account_id)) || t.account_id;
  const sell = t.type === 'sell';
  const what = sell ? 'sprzedaż' : 'zakup';
  dlg.innerHTML = `<div class="form">
    <h2>${sell ? 'Sprzedaż' : 'Kupno'} ${esc(t.instrument_id)}</h2>
    <div class="rows detail">
      <div class="row"><span>Kwota</span><b>${zl2(txTotal(t))}</b></div>
      <div class="row"><span>Jednostki</span><b>${fmtN.format(t.units)} × ${zl2(t.price_pln)}</b></div>
      <div class="row"><span>Data</span><b>${niceDate(t.date)}</b></div>
      <div class="row"><span>Konto</span><b>${esc(account)}</b></div>
      ${t.note ? `<div class="row"><span>Notatka</span><b>${esc(noteText(t.note))}</b></div>` : ''}
    </div>
    <div class="confirm" role="alert" hidden></div>
    <div class="actions three"><button type="button" class="ghost" data-close>Zamknij</button><button type="button" class="ghost danger" data-delete>Usuń</button><button type="button" class="primary" data-edit>Edytuj</button></div>
  </div>`;
  const box = $('.confirm', dlg);
  $('[data-close]', dlg).addEventListener('click', () => dlg.close());
  $('[data-edit]', dlg).addEventListener('click', () => txForm(t));
  $('[data-delete]', dlg).addEventListener('click', () => {
    const rest = data.transactions.filter((x) => x.id !== t.id);
    if (computePortfolio({ ...data, transactions: rest }).oversold.length > data.portfolio.oversold.length) {
      box.innerHTML = `<p class="error">Tego zakupu nie można usunąć: zależy od niego późniejsza sprzedaż ${esc(t.instrument_id)}. Najpierw usuńcie tę sprzedaż.</p>`;
      box.hidden = false;
      return;
    }
    const now = keysBy(data.transactions), after = keysBy(rest);
    box.innerHTML = `<p><b>Usunąć ${sell ? 'tę sprzedaż' : 'ten zakup'}?</b> Znika ${zl2(txTotal(t))} z ${niceDate(t.date)}${now !== after ? `, a termin kluczy przesunie się: ${now} → ${after}` : ''}. Przez kilka sekund będzie można to cofnąć.</p>
      <div class="actions"><button type="button" class="ghost" data-no>Zostaw</button><button type="button" class="primary danger-fill" data-yes>Usuń ${what}</button></div>`;
    box.hidden = false;
    $('.actions.three', dlg).hidden = true;
    $('[data-no]', box).addEventListener('click', () => { box.hidden = true; $('.actions.three', dlg).hidden = false; });
    $('[data-yes]', box).addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await must(db.from('transactions').delete().eq('id', t.id));
        dlg.close();
        await refresh();
        toast(`Usunięto ${what} ${t.instrument_id}`, { action: { label: 'Cofnij', run: () => restoreTx(t) } });
      } catch (ex) {
        box.innerHTML = `<p class="error">Nie usunięto: ${esc(friendly(ex))}</p>`;
      }
    });
  });
  dlg.showModal();
}

async function restoreTx(t) {
  const { id, created_at, ...row } = t;
  try {
    await must(db.from('transactions').insert(row));
    await refresh();
    toast('Przywrócono');
  } catch (ex) {
    toast(`Nie udało się przywrócić: ${friendly(ex)}`, { error: true });
  }
}

// ---------- forms ----------
function openForm(title, fields, onSubmit, saveLabel = 'Zapisz', done = 'Zapisano') {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form method="dialog" class="form">
    <h2>${esc(title)}</h2>${fields}
    <p class="error" role="alert" hidden></p>
    <div class="actions"><button type="button" class="ghost" data-cancel>Anuluj</button><button type="submit" class="primary">${esc(saveLabel)}</button></div>
  </form>`;
  const form = $('form', dlg);
  $('[data-cancel]', form).addEventListener('click', () => dlg.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.error', form);
    const btn = $('button.primary', form);
    err.hidden = true;
    btn.disabled = true;
    try {
      await onSubmit(Object.fromEntries(new FormData(form)), form);
      dlg.close();
      await refresh();
      if (done) toast(done);
    } catch (ex) {
      err.textContent = friendly(ex);
      err.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
  if (!dlg.open) dlg.showModal();
  return form;
}

const TX_HINT = 'Wpiszcie łączną kwotę w zł, która zeszła z konta (XTB pokazuje ją w historii transakcji).';

function txForm(edit = null) {
  const acc = edit?.account_id ?? store.get('lastAccount', 'poboczne');
  const sellNow = edit?.type === 'sell';
  // Most-held investment first, then ETFs and bonds in their own groups.
  const held = Object.fromEntries(groupHoldings(data.portfolio.positions).map((h) => [h.instrument.id, h.value]));
  const option = (i) => `<option value="${esc(i.id)}" ${i.id === (edit?.instrument_id ?? firstIns) ? 'selected' : ''}>${esc(i.id)} — ${esc(insName(i))}</option>`;
  const byHeld = (kind) => data.instruments.filter((i) => i.kind === kind).sort((a, b) => (held[b.id] || 0) - (held[a.id] || 0));
  const firstIns = byHeld('etf')[0]?.id;
  const form = openForm(edit ? `Edytuj ${edit.type === 'sell' ? 'sprzedaż' : 'zakup'}` : 'Dodaj zakup lub sprzedaż', `
    <div class="seg"><label><input type="radio" name="type" value="buy" ${sellNow ? '' : 'checked'}>Kupno</label><label><input type="radio" name="type" value="sell" ${sellNow ? 'checked' : ''}>Sprzedaż</label></div>
    <label>Inwestycja<select name="instrument_id" required>
      <optgroup label="ETF-y">${byHeld('etf').map(option).join('')}</optgroup>
      <optgroup label="Obligacje skarbowe">${byHeld('bond').map(option).join('')}</optgroup>
    </select></label>
    <label>Konto<select name="account_id" required>
      ${data.accounts.map((a) => `<option value="${esc(a.id)}" ${a.id === acc ? 'selected' : ''}>${esc(accName(a))}</option>`).join('')}
    </select></label>
    <label>Data<input type="date" name="date" value="${edit?.date ?? todayISO()}" max="${todayISO()}" required></label>
    <div class="two">
      <label>Jednostki<input name="units" inputmode="decimal" placeholder="np. 2,5" value="${edit ? fmtN.format(edit.units).replace(/\s/g, '') : ''}" required></label>
      <label><span id="tx-total-label">Zapłacono łącznie (zł)</span><input name="total" inputmode="decimal" placeholder="z prowizją" value="${edit ? fmt2.format(txTotal(edit)).replace(/\s/g, '') : ''}" required></label>
    </div>
    <p class="hint" id="tx-hint">${TX_HINT}</p>
    <label>Notatka (opcjonalnie)<input name="note" maxlength="120" value="${esc(edit?.note ?? '')}"></label>`,
  async (f) => {
    const units = parseNum(f.units);
    const total = parseNum(f.total);
    if (!(units > 0) || !(total >= 0)) throw new Error('Wpiszcie liczbę jednostek i łączną kwotę.');
    const tx = {
      date: f.date, account_id: f.account_id, instrument_id: f.instrument_id, type: f.type,
      units, price_pln: total / units, fee_pln: 0, note: f.note || null,
    };
    // Replay the whole history with this change, so a sale dated before its purchase, or an edit
    // that leaves a later sale without enough units, is caught before anything is saved.
    const others = data.transactions.filter((x) => x.id !== edit?.id);
    const check = computePortfolio({ ...data, transactions: [...others, { ...tx, id: Infinity }] });
    const bad = check.oversold.find((o) => o.tx.id === Infinity);
    if (bad) throw new Error(`${niceDate(f.date)} mieliście na tym koncie tylko ${fmtN.format(bad.held)} jedn. ${f.instrument_id}.`);
    if (check.oversold.length > computePortfolio({ ...data, transactions: others }).oversold.length) {
      throw new Error(`Po tej zmianie późniejsza sprzedaż ${f.instrument_id} nie miałaby wystarczająco jednostek. Najpierw sprawdźcie tę sprzedaż.`);
    }
    if (edit) await must(db.from('transactions').update(tx).eq('id', edit.id));
    else await must(db.from('transactions').insert(tx));
    store.set('lastAccount', f.account_id);
  }, edit ? 'Zapisz zmiany' : 'Zapisz', edit ? 'Zmiany zapisane' : 'Zapisano');

  const hint = $('#tx-hint', form);
  const upd = () => {
    const ins = data.instruments.find((i) => i.id === form.instrument_id.value);
    const isBond = ins?.kind === 'bond';
    const sell = form.querySelector('input[name=type]:checked').value === 'sell';
    $('#tx-total-label', form).textContent = sell ? 'Otrzymano łącznie (zł)' : 'Zapłacono łącznie (zł)';
    const u = parseNum(form.units.value), t = parseNum(form.total.value);
    if (u > 0 && t > 0) hint.textContent = `= ${zl2(t / u)} za jednostkę`;
    else hint.textContent = isBond ? 'Jedna obligacja kosztuje 100 zł (albo 99,90 zł przy zamianie starych na nowe).' : TX_HINT;
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
  openForm('Dodaj ETF', `
    <label>Skrót (ticker)<input name="id" placeholder="np. VWCE" required maxlength="20"></label>
    <label>Nazwa<input name="name" placeholder="np. Vanguard FTSE All-World" required></label>
    <label>Symbol w Yahoo Finance<input name="yahoo_symbol" placeholder="np. VWCE.DE" required>
      <small>Stąd aplikacja co wieczór bierze cenę. Wyszukajcie ETF na finance.yahoo.com i skopiujcie symbol. Końcówka: .DE = Niemcy (Xetra), .WA = Warszawa, .L = Londyn, .AS = Amsterdam.</small></label>
    <label>Obecna cena w zł (opcjonalnie)<input name="price" inputmode="decimal">
      <small>Widoczna do wieczornej aktualizacji.</small></label>`,
  async (f) => {
    const id = f.id.trim().toUpperCase();
    if (data.instruments.some((i) => i.id === id)) throw new Error(`${id} już jest na liście.`);
    const price = f.price ? parseNum(f.price) : null;
    if (price !== null && !(price > 0)) throw new Error('Cena musi być liczbą, np. 512,40');
    await must(db.from('instruments').insert({
      id, name: f.name.trim(), kind: 'etf', yahoo_symbol: f.yahoo_symbol.trim().toUpperCase(),
      price_pln: price, prev_price_pln: price, price_date: price ? todayISO() : null,
    }));
  });
}

function bondForm() {
  openForm('Dodaj serię obligacji', `
    <label>Kod serii<input name="id" placeholder="np. EDO1036" required maxlength="20">
      <small>Widnieje na rachunku obligacji, np. EDO1036 = 10-letnie EDO z wykupem w październiku 2036.</small></label>
    <div class="two">
      <label>Oprocentowanie w 1. roku (%)<input name="first" inputmode="decimal" placeholder="np. 6,00" required></label>
      <label>Marża (%)<input name="margin" inputmode="decimal" placeholder="np. 2,00" required></label>
    </div>
    <p class="hint">Oba znajdziecie w ofercie na <a href="https://www.obligacjeskarbowe.pl" target="_blank" rel="noopener">obligacjeskarbowe.pl</a> z miesiąca zakupu. Marża to stała część, którą co roku dodaje się do inflacji. Potem dodajcie sam zakup przyciskiem „Dodaj zakup lub sprzedaż”.</p>`,
  async (f) => {
    const id = f.id.trim().toUpperCase();
    if (data.instruments.some((i) => i.id === id)) throw new Error(`${id} już jest na liście.`);
    const first = parseNum(f.first.replace('%', ''));
    const margin = parseNum(f.margin.replace('%', ''));
    if (!Number.isFinite(first) || !Number.isFinite(margin)) throw new Error('Oprocentowanie i marża muszą być liczbami, np. 6,00 i 2,00');
    await must(db.from('instruments').insert({
      id, name: `Obligacje ${id.slice(0, 3)}, seria ${id}`, kind: 'bond', currency: 'PLN',
      bond_margin: margin, bond_rates: [first],
    }));
  });
}

// One box per bond year, labelled with the date that year starts, so nobody has to keep a list in their head.
function editBondForm(id) {
  const ins = data.instruments.find((i) => i.id === id);
  if (!ins) return;
  const rates = (ins.bond_rates || []).map(Number);
  const firstBuy = data.transactions.filter((t) => t.instrument_id === id && t.type === 'buy').map((t) => t.date).sort()[0];
  const current = firstBuy ? bondUnitValue(firstBuy, rates).currentYear : rates.length;
  const years = Math.min(10, Math.max(rates.length, current, 1));
  const yearStart = (k) => {
    if (!firstBuy) return '';
    const d = toDate(firstBuy);
    return ` · od ${niceDate(new Date(Date.UTC(d.getUTCFullYear() + k, d.getUTCMonth(), d.getUTCDate())).toISOString())}`;
  };
  const margin = ins.bond_margin == null ? null : Number(ins.bond_margin);
  const form = openForm(`Oprocentowanie ${id}`, `
    <div class="two">${Array.from({ length: years }, (_, k) => `
      <label>${k + 1}. rok${yearStart(k)}<input name="y${k}" inputmode="decimal" value="${rates[k] == null ? '' : fmtN.format(rates[k])}" placeholder="${k ? 'np. 5,95' : 'np. 7,25'}" ${k === 0 ? 'required' : ''}></label>`).join('')}
    </div>
    <label>Marża (%)<input name="margin" inputmode="decimal" value="${margin == null ? '' : fmtN.format(margin)}"></label>
    <p class="hint">Każdy kolejny rok: marża${margin == null ? '' : ` (${rate(margin)})`} + inflacja podana przez GUS w miesiącu przed rocznicą zakupu.
      Gotową stopę znajdziecie na rachunku w Pekao albo na <a href="https://www.obligacjeskarbowe.pl" target="_blank" rel="noopener">obligacjeskarbowe.pl</a>.</p>`,
  async (f) => {
    const list = Array.from({ length: years }, (_, k) => String(f[`y${k}`] ?? '').replace('%', '').trim());
    while (list.length && !list.at(-1)) list.pop();
    if (!list.length) throw new Error('Wpiszcie przynajmniej oprocentowanie z 1. roku.');
    const missing = list.findIndex((x) => !x);
    if (missing >= 0) throw new Error(`Brakuje oprocentowania z ${missing + 1}. roku.`);
    const values = list.map(parseNum);
    if (values.some((x) => !Number.isFinite(x))) throw new Error('Oprocentowanie musi być liczbą, np. 7,25');
    await must(db.from('instruments').update({ bond_rates: values, bond_margin: f.margin ? parseNum(f.margin) : null }).eq('id', id));
  });
  // Put the cursor in the first empty year: that is the one the reminder asked for.
  const empty = [...form.querySelectorAll('input[name^=y]')].find((x) => !x.value);
  if (empty) { empty.closest('label').classList.add('due'); setTimeout(() => empty.focus(), 50); }
}

// ---------- start ----------
const { data: { session } } = await db.auth.getSession();
if (session) enterApp(); else showLogin();
