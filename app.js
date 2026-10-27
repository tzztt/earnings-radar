/* Earnings-Radar – liest dashboard.json aus dem Gist und zeigt Radar, Liste, Kunden, Ergebnisse.
   Keine Abhängigkeiten, kein Build. Alle Texte aus den Daten werden vor dem Einfügen maskiert (esc). */
(() => {
"use strict";

// ============================================================ Konstanten & Zustand
// Version der App: bei jeder Änderung hier hochzählen (wird in den Einstellungen angezeigt). Muster: x.xx
const APP_VERSION = "1.13";
const KEY = { url: "er.url", data: "er.data", crv: "er.crv", demo: "er.demo", seen: "er.seen" };
const TIME = { bmo: "vorbörslich", amc: "nachbörslich", dmh: "im Handel" };
const CUR = { USD: "$", EUR: "€", GBP: "£", GBp: "GBp", HKD: "HK$", CNY: "¥", CNH: "¥", KRW: "₩", AUD: "A$", JPY: "¥", CAD: "C$", CHF: "CHF" };
const CRV_NAMES = { A: "A Struktur", B: "B ATR", C: "C Pullback" };
const STALE_MIN = 30;

const state = {
  data: null, by: {}, sections: [], demo: false, fromCache: false, loading: false,
  crv: lsGet(KEY.crv) || "A",
  backHash: "#/", prevHash: "#/",
  ui: {
    range: "week", filter: "all", q: "", searchOpen: false,
    listSort: "earn", listFilter: "all",
    resDays: 30, resFilter: "all",
    cust: null,
    setupError: "", setupBusy: false,
  },
};

// ============================================================ Hilfsfunktionen
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch { /* egal */ } }

const nfCache = {};
function num(x, d = 2) {
  if (x == null || Number.isNaN(x) || !Number.isFinite(x)) return "–";
  if (Number(x.toFixed(d)) === 0) x = 0;
  const nf = (nfCache[d] ||= new Intl.NumberFormat("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }));
  return nf.format(x).replace(/^-/, "−");
}
function pct(x, d = 1, sign = true) {
  if (x == null || Number.isNaN(x)) return "–";
  const r = Number(x.toFixed(d));
  return (sign && r > 0 ? "+" : "") + num(x, d) + "\u00a0%";
}
function big(x, cur = "") {
  if (x == null || Number.isNaN(x)) return "–";
  const a = Math.abs(x);
  for (const [div, unit] of [[1e12, "Bio"], [1e9, "Mrd"], [1e6, "Mio"], [1e3, "Tsd"]]) {
    if (a >= div) return `${num(x / div, 1)} ${unit}${cur ? " " + cur : ""}`;
  }
  return num(x, 0) + (cur ? " " + cur : "");
}
const sym = (c) => CUR[c] || c || "";
function price(x, cur) {
  if (x == null) return "–";
  return `${num(x, Math.abs(x) >= 1 ? 2 : 4)} ${sym(cur)}`.trim();
}
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => new Date(s + "T12:00:00");
const todayIso = () => iso(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const dShort = (s) => { const d = parse(s); return `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
const dLong = (s) => { const d = parse(s); return `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`; };
const dDot = (s) => { const d = parse(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`; };
const dMini = (s) => { const d = parse(s); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`; };
function dayLabel(s) {
  const n = diffDays(s, todayIso());
  if (n === 0) return `Heute · ${dShort(s)}`;
  if (n === 1) return `Morgen · ${dShort(s)}`;
  if (n === -1) return `Gestern · ${dShort(s)}`;
  return dShort(s);
}
function clock(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}
function stamp(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    const date = d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });
    return `${date} ${clock(ts)} Uhr`;
  } catch { return ""; }
}
const surprise = (act, est) => (act == null || est == null || est === 0) ? null : (act - est) / Math.abs(est) * 100;

function verdict(h) {
  if (h.eps_act == null) return { k: "pending", label: "ausstehend", s: null };
  const s = surprise(h.eps_act, h.eps_est);
  if (s == null) return { k: "inline", label: "gemeldet", s: null };
  if (s > 2) return { k: "beat", label: `Beat ${pct(s, 0)}`, s };
  if (s < -2) return { k: "miss", label: `Miss ${pct(s, 0)}`, s };
  return { k: "inline", label: "im Rahmen", s };
}
const VCLASS = { beat: "b-up", miss: "b-down", inline: "b-n", pending: "b-dash" };
const lastOf = (s) => (s.history && s.history.length ? s.history[s.history.length - 1] : null);
const isCustomer = (s) => (s.suppliers || []).length > 0;
const custKind = (s) => (s.customer_type === "Hyperscaler" ? "Hyperscaler" : "Kunde");
const crvOf = (s, k = state.crv) => (s.tech && s.tech.crv && s.tech.crv[k]) || null;
const FRESH_DAYS = 3;
const NEW_DAYS = 14;   // so lange kann ein Ergebnis als "Neu" gelten, wenn es noch nicht angesehen wurde
/* "Neu seit deinem letzten Besuch": Das Gerät merkt sich, welche Ergebnisse (Ticker|Datum) du schon gesehen hast.
   Beim allerersten Start gilt alles Vorhandene als gesehen, damit nicht alles "Neu" ist. Im Demo-Modus ist die Funktion aus. */
const rkey = (s, h) => `${s.ticker}|${h.date}`;
function initSeen() {
  state.seen = null;
  if (state.demo || !state.data) return;
  let set = null;
  try { const j = JSON.parse(lsGet(KEY.seen) || "null"); if (Array.isArray(j)) set = new Set(j); } catch { /* neu anlegen */ }
  if (!set) {
    set = new Set();
    for (const s of state.data.stocks) for (const h of reportedList(s)) set.add(rkey(s, h));
    lsSet(KEY.seen, JSON.stringify([...set]));
  }
  state.seen = set;
}
const isNew = (s, h) => !!state.seen && h.eps_act != null && diffDays(todayIso(), h.date) <= NEW_DAYS && !state.seen.has(rkey(s, h));
const newOf = (s) => reportedList(s).filter((h) => isNew(s, h));
function newTotal() { let n = 0; if (state.seen && state.data) for (const s of state.data.stocks) n += newOf(s).length; return n; }
function markSeen(pairs) {
  if (!state.seen || !pairs.length) return;
  pairs.forEach(([s, h]) => state.seen.add(rkey(s, h)));
  lsSet(KEY.seen, JSON.stringify([...state.seen].slice(-2000)));
}
function markAllSeen() {
  const p = [];
  if (state.data) for (const s of state.data.stocks) for (const h of newOf(s)) p.push([s, h]);
  markSeen(p);
}
function updateTabDot() {
  const a = document.querySelector('#tabbar a[data-tab="ergebnisse"]');
  if (!a) return;
  const old = a.querySelector(".tabdot"); if (old) old.remove();
  const n = newTotal();
  if (n > 0) { const d = document.createElement("span"); d.className = "tabdot"; d.textContent = String(n); d.setAttribute("aria-label", `${n} neue Ergebnisse`); a.appendChild(d); }
}
/* Alle bereits gemeldeten Termine einer Aktie (Historie + heutiger Termin, falls Zahlen schon da sind). */
function reportedList(s) {
  const t = todayIso(), l = (s.history || []).slice();
  if (s.next && s.next.eps_act != null && s.next.date <= t) l.push(s.next);
  return l.sort((a, b) => a.date.localeCompare(b.date));
}
const lastReported = (s) => { const l = reportedList(s); return l.length ? l[l.length - 1] : null; };
const isUpcoming = (s) => !!s.next && !(s.next.eps_act != null && s.next.date <= todayIso());
/* Schätzung des nächsten Termins, solange noch keiner bestätigt ist: gleicher Termin im Vorjahr, sonst +91 Tage. */
function nextEstimate(s) {
  const last = lastReported(s);
  if (!last) return null;
  const base = addDays(last.date, 91);
  const prev = (s.history || []).find((h) => Math.abs(diffDays(addDays(h.date, 364), base)) <= 20);
  const est = prev ? addDays(prev.date, 364) : base;
  return est > todayIso() ? est : addDays(todayIso(), 1);
}

function relDate(ticker, refDate) {
  const c = state.by[ticker];
  if (!c) return null;
  const cand = [];
  if (c.next) cand.push(c.next.date);
  const l = lastOf(c);
  if (l) cand.push(l.date);
  if (!cand.length) return null;
  cand.sort((a, b) => Math.abs(diffDays(a, refDate)) - Math.abs(diffDays(b, refDate)));
  return cand[0];
}
const relWord = (d, ref) => (d < ref ? "vorher" : d === ref ? "gleicher Tag" : "danach");
const RELCLASS = { vorher: "b-kd", "gleicher Tag": "b-hot", danach: "b-n" };

// ============================================================ Daten laden
function toDataUrl(input) {
  let u = String(input || "").trim();
  if (!u) throw new Error("Bitte die Abo-Adresse des Kalenders einfügen.");
  u = u.replace(/^webcal:\/\//i, "https://");
  if (/^http:\/\//i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(u)) u = u.replace(/^http:/i, "https:");
  if (!/^https?:\/\//i.test(u)) throw new Error("Die Adresse muss mit webcal:// oder https:// beginnen.");
  if (/earnings\.ics(\?.*)?$/i.test(u)) u = u.replace(/earnings\.ics(\?.*)?$/i, "dashboard.json");
  else if (!/\.json(\?.*)?$/i.test(u)) throw new Error("Das sieht nicht nach der Kalender-Adresse aus. Sie endet auf earnings.ics.");
  return u;
}

async function fetchJson(url) {
  const sep = url.includes("?") ? "&" : "?";
  let res;
  try { res = await fetch(`${url}${sep}t=${Date.now()}`, { cache: "no-store" }); }
  catch { throw new Error("Keine Verbindung oder Abruf blockiert. Prüfe Internet und Adresse."); }
  if (res.status === 404) throw new Error("Datei nicht gefunden (404). Stimmt die Gist-ID in der Adresse? Wurde der Kalender-Lauf schon einmal ausgeführt?");
  if (!res.ok) throw new Error(`Abruf fehlgeschlagen (HTTP ${res.status}).`);
  let json;
  try { json = await res.json(); } catch { throw new Error("Die Datei ist kein gültiges JSON."); }
  return validate(json);
}
function validate(j) {
  if (!j || !Array.isArray(j.stocks)) throw new Error("Die Datei hat nicht das erwartete Format (dashboard.json).");
  return j;
}

function setData(data, opts = {}) {
  state.data = data;
  state.by = {};
  const secs = [];
  for (const s of data.stocks) {
    s.history ||= []; s.customers ||= []; s.suppliers ||= [];
    state.by[s.ticker] = s;
    if (!s.extra && s.section && s.section !== "Portfolio" && !secs.includes(s.section)) secs.push(s.section);
  }
  state.sections = secs;
  state.demo = !!opts.demo;
  state.fromCache = !!opts.fromCache;
  initSeen();
}

function shiftDates(data) {
  const base = data.generated ? iso(new Date(data.generated)) : todayIso();
  const n = diffDays(todayIso(), base);
  if (!n) return data;
  const mv = (o, k) => { if (o && o[k]) o[k] = addDays(o[k], n); };
  for (const s of data.stocks) {
    mv(s.tech, "asof"); mv(s.next, "date");
    for (const h of s.history) { mv(h, "date"); mv(h.reaction, "day"); }
  }
  data.generated = new Date().toISOString();
  return data;
}

async function loadDemo() {
  const res = await fetch("demo.json");
  const data = shiftDates(validate(await res.json()));
  lsSet(KEY.demo, "1");
  setData(data, { demo: true });
}

async function refresh(initial = false) {
  const url = lsGet(KEY.url);
  if (!url || url === "file" || state.demo) return;
  state.loading = true; paintLoading();
  try {
    const data = await fetchJson(url);
    setData(data);
    if (!lsSet(KEY.data, JSON.stringify(data))) lsDel(KEY.data);
    hideBanner();
  } catch (e) {
    if (state.data) {
      state.fromCache = true;
      showBanner(`Offline – Stand von ${stamp(state.data.generated) || "unbekannt"}`);
    } else {
      state.ui.setupError = e.message;
    }
  } finally {
    state.loading = false;
    if (initial || state.data) render({ keep: true }); else render();
  }
}

function paintLoading() {
  const b = $("#refreshBtn");
  if (b) b.classList.toggle("spin", state.loading);
}
function showBanner(t) { const b = $("#banner"); b.textContent = t; b.hidden = false; }
function hideBanner() { $("#banner").hidden = true; }

// ============================================================ Gemeinsame Bausteine
const ICON = {
  chev: '<svg class="chev" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>',
  ext: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
  search: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  refresh: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  gear: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
};

const badge = (txt, cls) => `<span class="badge ${cls}">${esc(txt)}</span>`;
function badgesFor(s) {
  let h = "";
  if (newOf(s).length) h += badge("Neu", "b-new");
  if (s.portfolio) h += badge("Portfolio", "b-pf");
  if (isCustomer(s)) h += badge(custKind(s), "b-kd");
  if (s.next && s.next.eps_act != null && s.next.date <= todayIso()) { const v = verdict(s.next); h += badge(v.label, VCLASS[v.k]); }
  else if (s.next && s.next.confirmed === false) h += badge("vorläufig", "b-dash");
  return h;
}
const rsiClass = (r) => (r == null ? "" : r >= 70 ? "amber" : r <= 30 ? "blue" : "");
const crvClass = (c) => (c == null ? "muted" : c >= 2 ? "up" : c < 1 ? "muted" : "");
function crvSwitch() {
  return `<div class="seg" role="group" aria-label="CRV-Variante">${["A", "B", "C"].map((k) =>
    `<button data-act="crv" data-v="${k}" aria-pressed="${state.crv === k}">CRV ${esc(CRV_NAMES[k])}</button>`).join("")}</div>`;
}

function stockRow(s, opts = {}) {
  const t = s.tech, c = crvOf(s);
  const n = s.next;
  let sub;
  if (opts.sub) sub = opts.sub;
  else if (n) {
    const when = [TIME[n.time], clock(n.ts) && `${clock(n.ts)} Uhr`].filter(Boolean).join(" · ") || "Uhrzeit offen";
    let extra = "";
    if (isCustomer(s)) extra = ` · ${s.suppliers.length} Zulieferer`;
    else {
      const before = (s.customers || []).filter((x) => { const cn = state.by[x]?.next; return cn && cn.date >= todayIso() && cn.date < n.date; }).length;
      if (before) extra = ` · ${before} Kunde${before > 1 ? "n" : ""} vorher`;
    }
    sub = `${when} · ${s.section || ""}${extra}`;
  } else sub = s.section || "";
  return `<a class="item" href="#/aktie/${encodeURIComponent(s.ticker)}">
    <div class="grow stack-sm" style="gap:4px">
      <div class="line"><span class="t">${esc(s.ticker)}</span>${badgesFor(s)}</div>
      <span class="sub ell">${esc(sub)}</span>
    </div>
    <div class="right">
      <span>RSI <b class="${rsiClass(t?.rsi)}">${t?.rsi != null ? num(t.rsi, 0) : "–"}</b></span>
      <span>CRV <b class="${crvClass(c?.crv)}">${c ? num(c.crv, 1) : "–"}</b></span>
    </div>${ICON.chev}</a>`;
}

function resultItem({ s, h, v }) {
  const rx = h.reaction, mv = rx ? rx.move_pct : null;
  const revS = surprise(h.rev_act, h.rev_est);
  const sub = h.eps_act == null ? "Zahlen folgen beim nächsten Lauf" : revS != null ? `Umsatz ${pct(revS)} vs. Erwartung` : `EPS ${num(h.eps_act)} vs. ${num(h.eps_est)}`;
  return `<a class="item" href="#/aktie/${encodeURIComponent(s.ticker)}"><div class="grow stack-sm" style="gap:4px"><div class="line"><span class="t">${esc(s.ticker)}</span>${isNew(s, h) ? badge("Neu", "b-new") : ""}${badge(v.label, VCLASS[v.k])}${s.portfolio ? badge("Portfolio", "b-pf") : ""}${isCustomer(s) ? badge(custKind(s), "b-kd") : ""}</div><span class="sub ell">${esc(sub)}</span></div>
    <div class="right"><b style="font-size:15px" class="${mv == null ? "muted" : mv >= 0 ? "up" : "down"}">${mv == null ? "–" : pct(mv)}</b><span>${rx && rx.rel_volume != null ? "Vol " + num(rx.rel_volume, 1) + "×" : ""}</span></div>${ICON.chev}</a>`;
}

function spark(values) {
  if (!values || values.length < 2) return "";
  const w = 358, h = 72;
  const min = Math.min(...values), max = Math.max(...values), rng = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / rng) * (h - 8)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  const col = up ? "var(--up)" : "var(--down)";
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Kursverlauf der letzten ${values.length} Handelstage, ${up ? "steigend" : "fallend"}"><path d="${d} L${w} ${h} L0 ${h} Z" fill="${col}" fill-opacity=".08"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

// ============================================================ Filter / Auswahl
function passFilter(s, f) {
  if (f === "all") return true;
  if (f === "pf") return s.portfolio;
  if (f === "cust") return isCustomer(s);
  if (f.startsWith("sec:")) return s.section === f.slice(4) || (s.sections || []).includes(f.slice(4));
  return true;
}
function filterOptions() {
  return [["all", "Alle"], ["pf", "Portfolio"], ["cust", "Kunden"], ...state.sections.map((x) => [`sec:${x}`, x])];
}
function rangeBounds(r) {
  const t = todayIso();
  const dow = parse(t).getDay();
  const weekEnd = addDays(t, (7 - dow) % 7);
  if (r === "week") return [t, weekEnd];
  if (r === "next") return [addDays(weekEnd, 1), addDays(weekEnd, 7)];
  if (r === "30") return [t, addDays(t, 30)];
  return [t, "9999-12-31"];
}

// ============================================================ Screen: Radar
function newBar() {
  const n = newTotal();
  return n ? `<a class="newbar" href="#/ergebnisse"><span><b>${n} neue${n === 1 ? "s" : ""} Ergebnis${n === 1 ? "" : "se"}</b> seit deinem letzten Besuch</span><span>ansehen ›</span></a>` : "";
}
function viewRadar() {
  const d = state.data;
  const [a, b] = rangeBounds(state.ui.range);
  const inRange = d.stocks.filter((s) => isUpcoming(s) && s.next.date >= a && s.next.date <= b);
  const tiles = `<div class="tiles">
    <div class="tile"><b>${inRange.length}</b><span>Termine</span></div>
    <div class="tile"><b class="amber">${inRange.filter((s) => s.portfolio).length}</b><span>aus dem Portfolio</span></div>
    <div class="tile"><b class="blue">${inRange.filter(isCustomer).length}</b><span>Kunden / Hyperscaler</span></div></div>`;
  const ranges = [["week", "Diese Woche"], ["next", "Nächste Woche"], ["30", "30 Tage"], ["all", "Alle"]];
  return `<div class="stack">
    <header class="hdr"><div><h1>Earnings-Radar</h1><p>${esc(dLong(todayIso()))} · Daten von ${esc(stamp(d.generated))}${state.demo ? " · DEMO" : ""}</p></div>
      <div class="hdr-actions">
        <button class="icon-btn" data-act="toggleSearch" aria-label="Suchen" aria-pressed="${state.ui.searchOpen}">${ICON.search}</button>
        <button class="icon-btn ${state.loading ? "spin" : ""}" id="refreshBtn" data-act="refresh" aria-label="Aktualisieren">${ICON.refresh}</button>
        <a class="icon-btn" href="#/einstellungen" aria-label="Einstellungen">${ICON.gear}</a>
      </div></header>
    ${state.ui.searchOpen ? `<div class="search">${ICON.search}<input id="q" type="search" inputmode="search" autocomplete="off" autocapitalize="characters" placeholder="Ticker oder Name suchen" aria-label="Suchen" value="${esc(state.ui.q)}"></div>` : ""}
    ${newBar()}
    ${tiles}
    <div class="seg" role="tablist" aria-label="Zeitraum">${ranges.map(([k, l]) => `<button role="tab" data-act="range" data-v="${k}" aria-selected="${state.ui.range === k}">${l}</button>`).join("")}</div>
    <div class="chips" role="group" aria-label="Filter">${filterOptions().map(([k, l]) => `<button class="chip" data-act="filter" data-v="${esc(k)}" aria-pressed="${state.ui.filter === k}">${esc(l)}</button>`).join("")}</div>
    ${crvSwitch()}
    <div id="radarList" class="stack">${radarList()}</div></div>`;
}

function matchQ(s) {
  const q = state.ui.q.trim().toLowerCase();
  return !q || s.ticker.toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q);
}
function recentRows() {
  const t = todayIso(), from = addDays(t, -FRESH_DAYS), out = [];
  for (const s of state.data.stocks) {
    if (!passFilter(s, state.ui.filter) || !matchQ(s)) continue;
    for (const h of reportedList(s)) if (h.date >= from && h.date <= t) out.push({ s, h, v: verdict(h) });
  }
  return out.sort((x, y) => y.h.date.localeCompare(x.h.date) || (y.s.portfolio - x.s.portfolio) || x.s.ticker.localeCompare(y.s.ticker));
}
function radarList() {
  const [a, b] = rangeBounds(state.ui.range);
  const items = state.data.stocks.filter((s) => isUpcoming(s) && s.next.date >= a && s.next.date <= b && passFilter(s, state.ui.filter) && matchQ(s));
  const rec = state.ui.range === "next" ? [] : recentRows();
  const recHtml = rec.length ? `<section class="day fresh"><h2>Gerade gemeldet · ${rec.length}</h2><div class="rows">${rec.map(resultItem).join("")}</div></section>` : "";
  if (!items.length && !rec.length) return `<div class="empty">Keine Termine für diese Auswahl.</div>`;
  items.sort((x, y) => x.next.date.localeCompare(y.next.date) || (y.portfolio - x.portfolio) || x.ticker.localeCompare(y.ticker));
  const groups = [];
  for (const s of items) {
    const g = groups[groups.length - 1];
    if (g && g.date === s.next.date) g.rows.push(s); else groups.push({ date: s.next.date, rows: [s] });
  }
  return recHtml + (groups.length ? groups.map((g) => `<section class="day ${g.date === todayIso() ? "today" : ""}"><h2>${esc(dayLabel(g.date))}</h2><div class="rows">${g.rows.map((s) => stockRow(s)).join("")}</div></section>`).join("")
    : `<div class="empty">Keine weiteren Termine in diesem Zeitraum.</div>`);
}

// ============================================================ Screen: Liste
function viewListe() {
  const d = state.data;
  let items = d.stocks.filter((s) => passFilter(s, state.ui.listFilter));
  const sort = state.ui.listSort;
  const val = {
    earn: (s) => (s.next ? s.next.date : "9999"),
    crv: (s) => { const c = crvOf(s); return c ? -c.crv : 1e9; },
    rsi: (s) => (s.tech && s.tech.rsi != null ? s.tech.rsi : 1e9),
    az: (s) => s.ticker,
  }[sort];
  items = items.slice().sort((x, y) => { const a = val(x), b = val(y); return a < b ? -1 : a > b ? 1 : x.ticker.localeCompare(y.ticker); });
  const sorts = [["earn", "Termin"], ["crv", "CRV"], ["rsi", "RSI"], ["az", "A–Z"]];
  const hint = { earn: "Nächster Termin zuerst.", crv: "Höchstes CRV zuerst (gewählte Variante).", rsi: "Niedrigster RSI zuerst (überverkauft oben).", az: "Alphabetisch." }[sort];
  return `<div class="stack">
    <header class="hdr"><div><h1>Watchlist</h1><p>${items.length} von ${d.stocks.length} Werten</p></div></header>
    <label class="sr" for="lf">Filter</label>
    <select id="lf" class="select" data-change="listFilter">${filterOptions().map(([k, l]) => `<option value="${esc(k)}" ${state.ui.listFilter === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
    <div class="seg" role="group" aria-label="Sortierung">${sorts.map(([k, l]) => `<button data-act="listSort" data-v="${k}" aria-pressed="${sort === k}">${l}</button>`).join("")}</div>
    ${crvSwitch()}
    <p class="warn">${esc(hint)}</p>
    <div class="rows">${items.map((s) => {
      const n = s.next;
      const sub = `${n ? dShort(n.date) + (n.time ? " · " + TIME[n.time] : "") : "kein Termin bekannt"} · ${s.section || ""}`;
      return stockRow(s, { sub });
    }).join("")}</div></div>`;
}

// ============================================================ Router, Rendering, Events
function route() {
  const h = location.hash || "#/";
  const parts = h.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  return { hash: h, name: parts[0] || "radar", arg: parts[1] || null };
}
function setTab(r) {
  const tabs = $("#tabbar");
  const hide = !state.data || r.name === "einstellungen";
  tabs.hidden = hide;
  document.body.classList.toggle("no-tabs", hide);
  let active = r.name === "aktie" ? (route2tab(state.backHash)) : r.name;
  if (active === "einstellungen") active = "";
  tabs.querySelectorAll("a").forEach((a) => {
    if (a.dataset.tab === active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}
function route2tab(h) {
  const n = (h || "#/").replace(/^#\/?/, "").split("/")[0] || "radar";
  return n;
}

function render(opts = {}) {
  const r = route();
  if (r.name !== "aktie" && r.name !== "einstellungen") state.backHash = r.hash;
  const view = $("#view");
  const sy = window.scrollY;
  const chips = view.querySelector(".chips");
  const chipX = chips ? chips.scrollLeft : 0;
  let html;
  if (!state.data) html = (window.__setup || (() => ""))();
  else {
    switch (r.name) {
      case "liste": html = viewListe(); break;
      case "kunden": html = window.__kunden(r.arg); break;
      case "ergebnisse": html = window.__ergebnisse(); break;
      case "aktie": html = window.__aktie(r.arg); break;
      case "einstellungen": html = window.__settings(); break;
      default: html = viewRadar();
    }
  }
  view.innerHTML = html;
  setTab(r);
  if (state.data && r.name === "aktie" && state.by[r.arg]) markSeen(newOf(state.by[r.arg]).map((h) => [state.by[r.arg], h]));
  updateTabDot();
  const nc = view.querySelector(".chips");
  if (nc && opts.keep) nc.scrollLeft = chipX;
  if (opts.keep) window.scrollTo(0, sy); else window.scrollTo(0, 0);
  const sel = view.querySelector(".chip[aria-pressed='true']");
  if (sel && !opts.keep) sel.scrollIntoView({ inline: "center", block: "nearest" });
}

function onClick(e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, v = el.dataset.v;
  const ui = state.ui;
  switch (a) {
    case "range": ui.range = v; render({ keep: true }); break;
    case "seenAll": markAllSeen(); render({ keep: true }); break;
    case "filter": ui.filter = v; render({ keep: true }); break;
    case "crv": state.crv = v; lsSet(KEY.crv, v); render({ keep: true }); break;
    case "listSort": ui.listSort = v; render({ keep: true }); break;
    case "resDays": ui.resDays = Number(v); render({ keep: true }); break;
    case "resFilter": ui.resFilter = v; render({ keep: true }); break;
    case "cust": ui.cust = v; render({ keep: true }); break;
    case "toggleSearch":
      ui.searchOpen = !ui.searchOpen; if (!ui.searchOpen) ui.q = "";
      render({ keep: true });
      if (ui.searchOpen) $("#q")?.focus();
      break;
    case "refresh": refresh(); break;
    case "setupGo": window.__setupGo(); break;
    case "demo": window.__startDemo(); break;
    case "reset": window.__reset(); break;
    case "endDemo": window.__reset(); break;
    case "reload": refresh(); break;
    case "saveUrl": window.__saveUrl(); break;
    default: break;
  }
}
function onInput(e) {
  if (e.target.id === "q") {
    state.ui.q = e.target.value;
    const box = $("#radarList");
    if (box) box.innerHTML = radarList();
  }
}
function onChange(e) {
  const k = e.target.dataset.change;
  if (k === "listFilter") { state.ui.listFilter = e.target.value; render({ keep: true }); }
  if (e.target.id === "file") window.__readFile(e.target.files && e.target.files[0]);
}
function onKey(e) {
  if (e.key === "Enter" && e.target.id === "setupUrl") { e.preventDefault(); window.__setupGo(); }
  if (e.key === "Enter" && e.target.id === "newUrl") { e.preventDefault(); window.__saveUrl(); }
}

window.__core = { state, KEY, TIME, CRV_NAMES, esc, num, pct, big, price, sym, dShort, dLong, dDot, dMini, dayLabel, clock, stamp, diffDays, addDays, todayIso, parse,
  verdict, VCLASS, lastOf, isCustomer, custKind, crvOf, relDate, relWord, RELCLASS, badge, badgesFor, rsiClass, crvClass, crvSwitch, stockRow, spark, ICON,
  APP_VERSION, isNew, newTotal, markAllSeen, reportedList, lastReported, isUpcoming, nextEstimate, resultItem, FRESH_DAYS, toDataUrl, fetchJson, setData, loadDemo, refresh, render, route, lsGet, lsSet, lsDel, hideBanner, showBanner, validate, surprise, STALE_MIN, filterOptions };

// ============================================================ Start
document.addEventListener("click", onClick);
document.addEventListener("input", onInput);
document.addEventListener("change", onChange);
document.addEventListener("keydown", onKey);
window.addEventListener("hashchange", () => {
  state.prevHash = location.hash || "#/";
  state.ui.setupError = ""; state.ui.setupVal = "";
  render();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || state.demo || !state.data || !lsGet(KEY.url) || lsGet(KEY.url) === "file") return;
  const age = (Date.now() - new Date(state.data.generated).getTime()) / 60000;
  if (age > STALE_MIN) refresh();
});

window.__start = async function start() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    // Updates zuverlässig übernehmen: sw.js nie aus dem HTTP-Cache, bei jedem Öffnen prüfen,
    // und die Seite einmal neu laden, sobald eine neue Fassung die Kontrolle übernimmt.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then((reg) => {
        reg.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      }).catch(() => {});
  }
  try {
    if (lsGet(KEY.demo) === "1") { await loadDemo(); render(); return; }
    const cached = lsGet(KEY.data);
    if (cached && lsGet(KEY.url)) {
      try { setData(validate(JSON.parse(cached)), { fromCache: true }); } catch { lsDel(KEY.data); }
    }
    render();
    if (lsGet(KEY.url) && lsGet(KEY.url) !== "file") refresh(true);
  } catch (e) {
    $("#view").innerHTML = `<div class="stack"><div class="error">${esc(e.message)}</div></div>`;
  }
};
})();
