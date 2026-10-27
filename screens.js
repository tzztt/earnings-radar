/* Screens, die auf app.js aufbauen: Einrichtung, Aktie, Kunden, Ergebnisse, Einstellungen. */
(() => {
"use strict";
const C = window.__core;
const { state, KEY, TIME, CRV_NAMES, esc, num, pct, big, price, sym, dShort, dLong, dDot, dMini, dayLabel, clock, stamp, diffDays, todayIso,
  verdict, VCLASS, lastOf, isCustomer, custKind, crvOf, relDate, relWord, RELCLASS, badge, badgesFor, rsiClass, crvClass, crvSwitch, stockRow, spark, ICON,
  APP_VERSION, isNew, newTotal, markAllSeen, reportedList, lastReported, isUpcoming, nextEstimate, resultItem, FRESH_DAYS,
  toDataUrl, fetchJson, setData, loadDemo, refresh, render, lsGet, lsSet, lsDel, hideBanner, validate } = C;

// ============================================================ Einrichtung
window.__setup = () => `<div class="stack hero">
  <header class="hdr"><div><h1>Earnings-Radar</h1><p>Deine Watchlist, Earnings-Termine, Technik und CRV auf einen Blick.</p></div></header>
  <div class="info">Die App zeigt die Daten, die dein Kalender-Lauf auf GitHub erzeugt. Dafür brauche ich einmalig die <b>Abo-Adresse deines Kalenders</b>. Sie bleibt nur auf diesem Gerät gespeichert.</div>
  <div class="field">
    <label for="setupUrl">Abo-Adresse des Kalenders</label>
    <input id="setupUrl" type="url" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
      placeholder="webcal://gist.githubusercontent.com/…/earnings.ics" value="${esc(state.ui.setupVal || "")}">
    <small>Die Adresse, mit der du den Kalender in Apple Kalender abonniert hast. Sie endet auf <b>earnings.ics</b>.</small>
  </div>
  ${state.ui.setupError ? `<div class="error" role="alert">${esc(state.ui.setupError)}</div>` : ""}
  <div class="btn-row">
    <button class="btn primary" data-act="setupGo" ${state.ui.setupBusy ? "disabled" : ""}>${state.ui.setupBusy ? "Lade …" : "Laden"}</button>
    <button class="btn" data-act="demo">Demo ansehen</button>
  </div>
  <p class="warn">Tipp für den iPhone-Home-Bildschirm: Zuerst über Teilen → „Zum Home-Bildschirm“ hinzufügen, dann die App vom Home-Bildschirm öffnen und die Adresse dort eingeben. Installierte Apps haben auf dem iPhone einen eigenen Speicher.</p>
</div>`;

async function connect(raw, from) {
  const ui = state.ui;
  ui.setupError = ""; ui.setupVal = raw; ui.setupBusy = true; render({ keep: true });
  try {
    const url = toDataUrl(raw);
    const data = await fetchJson(url);
    lsSet(KEY.url, url); lsDel(KEY.demo);
    if (!lsSet(KEY.data, JSON.stringify(data))) lsDel(KEY.data);
    setData(data); hideBanner();
    ui.setupVal = ""; ui.setupBusy = false;
    location.hash = "#/"; render();
  } catch (e) {
    ui.setupBusy = false; ui.setupError = e.message; render({ keep: true });
  }
  void from;
}
window.__setupGo = () => connect(($("#setupUrl") || {}).value || "", "setup");
window.__saveUrl = () => connect(($("#newUrl") || {}).value || "", "settings");
window.__startDemo = async () => {
  try { await loadDemo(); location.hash = "#/"; render(); }
  catch (e) { state.ui.setupError = "Demo konnte nicht geladen werden: " + e.message; render(); }
};
window.__reset = () => {
  [KEY.url, KEY.data, KEY.demo, KEY.seen].forEach(lsDel);
  state.data = null; state.by = {}; state.demo = false; state.ui.setupError = ""; state.ui.setupVal = "";
  hideBanner(); location.hash = "#/"; render();
};
window.__readFile = (file) => {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const data = validate(JSON.parse(String(fr.result)));
      lsSet(KEY.url, "file"); lsDel(KEY.demo);
      if (!lsSet(KEY.data, JSON.stringify(data))) lsDel(KEY.data);
      setData(data); hideBanner(); state.ui.setupError = ""; location.hash = "#/"; render();
    } catch (e) { state.ui.setupError = "Datei konnte nicht gelesen werden: " + e.message; render({ keep: true }); }
  };
  fr.readAsText(file);
};
function $(s) { return document.querySelector(s); }

// ============================================================ Aktie (Detail)
function levelsFor(s) {
  const t = s.tech, L = [];
  L.push({ label: "52W-Hoch", price: t.high52, cls: "hi" });
  (t.resistances || []).forEach((p) => { if (Math.abs(p / t.high52 - 1) > 0.002) L.push({ label: "Widerstand", price: p, cls: "res" }); });
  (t.supports || []).forEach((p) => { if (Math.abs(p / t.low52 - 1) > 0.002) L.push({ label: "Unterstützung", price: p, cls: "sup" }); });
  [["SMA 20", t.sma20], ["SMA 50", t.sma50], ["SMA 200", t.sma200]].forEach(([l, p]) => { if (p) L.push({ label: l, price: p, cls: "sma" }); });
  L.push({ label: "52W-Tief", price: t.low52, cls: "lo" });
  L.push({ label: "Aktueller Kurs", price: t.close, cls: "now" });
  return L.sort((a, b) => b.price - a.price);
}
const DOT = { hi: "#FF8A8A", res: "#FF8A8A", sup: "#3FD08A", lo: "#3FD08A", sma: "#6CB6FF", now: "#F2B544" };

/* Ergebnis eines Kunden/Zulieferers an einem bestimmten Tag (falls schon gemeldet). */
function custResult(t, d) {
  const cs = state.by[t];
  if (!cs || !d) return null;
  const rec = reportedList(cs).find((r) => r.date === d);
  return rec ? { rec, v: verdict(rec) } : null;
}
function relRow(t, d, ref, extra = "") {
  const res = custResult(t, d), done = res && res.v.k !== "pending";
  const r = d ? relWord(d, ref) : null;
  const mv = done && res.rec.reaction ? res.rec.reaction.move_pct : null;
  const text = `${d ? dShort(d) : "Termin unbekannt"}${mv != null ? " · Kurs " + pct(mv) : ""}${extra}`;
  return `<a href="#/aktie/${encodeURIComponent(t)}"><span class="t">${esc(t)}</span><span class="grow muted" style="font-size:13px">${esc(text)}</span>${done ? badge(res.v.label, VCLASS[res.v.k]) : r ? badge(r, RELCLASS[r]) : ""}${ICON.chev}</a>`;
}
/* Zusammenfassung: wie viele haben schon gemeldet, wie fiel es aus? */
function signalHtml(rows, noun) {
  const done = rows.filter((r) => r.res && r.res.v.k !== "pending");
  if (!rows.length) return "";
  const n = (k) => done.filter((r) => r.res.v.k === k).length;
  const moves = done.map((r) => r.res.rec.reaction && r.res.rec.reaction.move_pct).filter((x) => x != null);
  const avg = moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : null;
  const parts = [];
  if (done.length) { parts.push(`${n("beat")} Beat`, `${n("miss")} Miss`); if (n("inline")) parts.push(`${n("inline")} im Rahmen`); }
  return `<div class="signal"><b>${done.length} von ${rows.length}</b> ${noun} haben gemeldet${parts.length ? ": " + parts.join(", ") : ""}${avg != null ? ` · Ø Kursreaktion ${pct(avg)}` : ""}</div>`;
}

/* Karte mit den zuletzt gemeldeten Zahlen. fresh = in den letzten Tagen gemeldet (dann steht sie ganz oben). */
function lastResultCard(s) {
  const h = lastReported(s);
  if (!h) return { html: "", fresh: false };
  const v = verdict(h), rx = h.reaction, t = s.tech, cur = sym(s.currency);
  const fresh = diffDays(todayIso(), h.date) <= FRESH_DAYS;
  const revS = C.surprise(h.rev_act, h.rev_est);
  const since = rx && t && rx.close_before ? (t.close / rx.close_before - 1) * 100 : null;
  const tone = v.k === "beat" ? "#1E5C3A" : v.k === "miss" ? "#6B2B2B" : "var(--line)";
  const row = (l, val, cls = "") => `<div class="kvrow"><span>${l}</span><span class="${cls}">${val}</span></div>`;
  const when = [dLong(h.date), TIME[h.time]].filter(Boolean).join(" · ");
  const eps = h.eps_act == null ? "noch nicht in den Daten"
    : `${num(h.eps_act)}${h.eps_est != null ? " vs. " + num(h.eps_est) : ""} ${cur}${v.s != null ? ` (${pct(v.s)})` : ""}`;
  const rev = h.rev_act == null ? "noch nicht in den Daten"
    : `${big(h.rev_act)}${h.rev_est != null ? " vs. " + big(h.rev_est) : ""}${revS != null ? ` (${pct(revS)})` : ""}`;
  const html = `<section class="card" style="border-color:${tone}" aria-label="${fresh ? "Gerade gemeldet" : "Letzte Earnings"}">
    <div class="card-head"><h2 style="color:${fresh ? "var(--text)" : "var(--muted)"}">${fresh ? "Gerade gemeldet" : "Letzte Earnings"}</h2>${badge(v.label, VCLASS[v.k])}</div>
    <p style="font-size:14px;color:var(--text-2)">${esc(when)}</p>
    <div class="kvlist">
      ${row("EPS", esc(eps))}
      ${row("Umsatz", esc(rev))}
      ${row("Kursreaktion", rx ? `${pct(rx.move_pct)} · Gap ${pct(rx.gap_pct)}` : "folgt am nächsten Handelstag", rx ? (rx.move_pct >= 0 ? "up" : "down") : "muted")}
      ${rx && rx.rel_volume != null ? row("Volumen am Tag", num(rx.rel_volume, 1) + "× Ø") : ""}
      ${since != null ? row("Kurs seit Meldung", pct(since), since >= 0 ? "up" : "down") : ""}
    </div></section>`;
  return { html, fresh };
}

function earnCard(s) {
  const n = s.next, cur = s.currency;
  if (!n || !isUpcoming(s)) {
    const est = nextEstimate(s);
    return `<section class="card"><div class="card-head"><h2 style="color:var(--muted)">Nächste Earnings</h2>${badge("noch offen", "b-dash")}</div><p style="font-size:14px;color:var(--text-2)">${est
      ? `Noch kein Termin bestätigt. Voraussichtlich ${esc(dShort(est))} (Schätzung nach dem letzten Rhythmus).`
      : "Kein kommender Termin bekannt. Bei ausländischen Werten fehlt er teils in den Daten."}</p></section>`;
  }
  const dd = diffDays(n.date, todayIso());
  const when = dd === 0 ? "heute" : dd === 1 ? "morgen" : dd > 1 ? `in ${dd} Tagen` : `vor ${-dd} Tagen`;
  const time = [TIME[n.time] || "Uhrzeit offen", clock(n.ts) && `${clock(n.ts)} Uhr`].filter(Boolean).join(" · ");
  const status = n.confirmed === true ? badge("bestätigt", "b-up") : n.confirmed === false ? badge("vorläufig", "b-dash") : "";
  return `<section class="card earn" aria-label="Nächste Earnings">
    <div class="card-head"><h2>Earnings ${esc(when)}</h2>${status}</div>
    <p style="font-size:16px;font-weight:600">${esc(dLong(n.date))} · ${esc(time)}</p>
    ${dd < 0 ? `<p class="warn hot">Zahlen noch nicht in den Daten. Sie erscheinen mit dem nächsten Lauf.</p>` : ""}
    <div class="kv3">
      <div><span class="lbl">EPS-Erwartung</span><span class="val">${n.eps_est != null ? num(n.eps_est) + " " + esc(sym(cur)) : "–"}</span></div>
      <div><span class="lbl">Umsatz-Erw.</span><span class="val">${n.rev_est != null ? big(n.rev_est) : "–"}</span></div>
      <div><span class="lbl">Ø Reaktion</span><span class="val">${s.avg_move_pct != null ? "±" + num(s.avg_move_pct, 1) + " %" : "–"}</span></div>
    </div></section>`;
}

function crvCard(s) {
  const t = s.tech;
  const keys = ["A", "B", "C"];
  let sel = state.crv;
  if (!crvOf(s, sel)) sel = keys.find((k) => crvOf(s, k)) || null;
  const tabs = keys.map((k) => {
    const v = crvOf(s, k);
    return `<button role="tab" data-act="crv" data-v="${k}" ${v ? "" : "disabled"} aria-selected="${sel === k}" class="${v && v.crv >= 2 ? "good" : ""}"><span>${esc(CRV_NAMES[k])}</span><b>${v ? num(v.crv, 1) : "–"}</b></button>`;
  }).join("");
  if (!sel) return `<div class="crv-tabs" role="tablist">${tabs}</div><p class="warn">Kein CRV berechenbar (zu wenig Kursdaten).</p>`;
  const v = crvOf(s, sel);
  const risk = v.entry - v.stop, rew = v.target - v.entry;
  const rp = Math.round(risk / (risk + rew) * 100);
  const entryPct = sel === "C" ? pct(v.entry_dist_pct) : "aktuell";
  let warn = "";
  if (s.avg_move_pct != null) {
    const hot = Math.abs(v.stop_pct) < s.avg_move_pct;
    warn = `<p class="warn ${hot ? "hot" : ""}">${hot ? "Achtung: " : ""}Ø Kursreaktion bei Earnings ±${num(s.avg_move_pct, 1)} % ${hot ? "ist größer als der Stop-Abstand. Ein Gap kann den Stop überspringen." : "(zuletzt) – Gaps über den Stop hinaus sind vor Earnings möglich."}</p>`;
  } else warn = `<p class="warn">Vor Earnings sind Gaps über den Stop hinaus möglich.</p>`;
  return `<div class="crv-tabs" role="tablist" aria-label="CRV-Variante">${tabs}</div>
    <div class="card">
      <p style="font-size:13px;color:var(--text-2)">${esc(v.note || "")} · Ziel: ${esc(v.target_note || "")}</p>
      <div class="rr" role="img" aria-label="Risiko ${rp} Prozent, Chance ${100 - rp} Prozent der Strecke"><i class="risk" style="width:${rp}%"></i><i class="rew" style="width:${100 - rp}%"></i></div>
      <div class="sel3">
        <div><span class="lbl down">Stop</span><span class="val">${num(v.stop)}</span><span class="pc">${pct(v.stop_pct)}</span></div>
        <div><span class="lbl">Einstieg</span><span class="val">${num(v.entry)}</span><span class="pc">${entryPct}</span></div>
        <div><span class="lbl up">Ziel</span><span class="val">${num(v.target)}</span><span class="pc">${pct(v.target_pct)}</span></div>
      </div>${warn}
    </div>`;
}

window.__aktie = (ticker) => {
  const s = state.by[ticker];
  const bn = (state.backHash || "#/").replace(/^#\/?/, "").split("/")[0] || "radar";
  const backLabel = { radar: "Radar", liste: "Liste", kunden: "Kunden", ergebnisse: "Ergebnisse" }[bn] || "Radar";
  const back = `<a class="back" href="${esc(state.backHash || "#/")}">${ICON.back}${backLabel}</a>`;
  if (!s) return `<div class="stack"><nav class="topbar">${back}</nav><div class="empty">Aktie „${esc(ticker)}“ nicht gefunden.</div></div>`;
  const t = s.tech, cur = s.currency, ref = s.next ? s.next.date : todayIso();
  const tv = !s.extra ? `<a class="ext" href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(s.tv)}" target="_blank" rel="noopener">Chart in TradingView ${ICON.ext}</a>` : "";
  const chg = t && t.change_pct != null ? `<span class="${t.change_pct >= 0 ? "up" : "down"}">${pct(t.change_pct, 2)}</span>` : "";
  let tech = "";
  if (t) {
    const smas = [t.sma20, t.sma50, t.sma200].filter((x) => x != null);
    const above = smas.filter((x) => t.close > x).length;
    const rsiHint = t.rsi >= 70 ? "überkauft" : t.rsi <= 30 ? "überverkauft" : "neutral";
    tech = `<section class="stack-sm" aria-labelledby="h-tech"><h2 id="h-tech" class="section-title">Technik · Stand ${esc(dMini(t.asof))}</h2>
      <div class="grid3">
        <div class="tile"><span class="lbl">RSI (14)</span><b class="${rsiClass(t.rsi)}">${num(t.rsi, 1)}</b><span class="hint">${rsiHint}</span></div>
        <div class="tile"><span class="lbl">Volumen</span><b>${t.rel_volume != null ? num(t.rel_volume, 1) + "×" : "–"}</b><span class="hint">vs. Ø 20 Tage</span></div>
        <div class="tile"><span class="lbl">ATR (14)</span><b>${num(t.atr)}</b><span class="hint">${num(t.atr_pct, 1)} % am Tag</span></div>
        <div class="tile"><span class="lbl">Trend</span><b>${smas.length ? above + "/" + smas.length : "–"}</b><span class="hint">über SMA 20/50/200</span></div>
        <div class="tile"><span class="lbl">52W-Hoch</span><b>${pct(t.dist_high52_pct)}</b><span class="hint">Abstand</span></div>
        <div class="tile"><span class="lbl">Handelswert</span><b>${t.volume ? big(t.volume * t.close) : "–"}</b><span class="hint">${esc(sym(cur))} am letzten Tag</span></div>
      </div></section>
      <section class="stack-sm" aria-labelledby="h-lv"><h2 id="h-lv" class="section-title">Kursmarken</h2>
      <div class="ladder">${levelsFor(s).map((l) => `<div class="lv ${l.cls === "now" ? "now" : ""}"><span class="dot" style="background:${DOT[l.cls]}"></span><span class="nm">${esc(l.label)}</span><span class="pr">${num(l.price)}</span><span class="ds">${l.cls === "now" ? "" : pct((l.price / t.close - 1) * 100)}</span></div>`).join("")}</div></section>
      <section class="stack-sm" aria-labelledby="h-crv"><h2 id="h-crv" class="section-title">Chance-Risiko (Long)</h2>${crvCard(s)}</section>`;
  } else tech = `<div class="empty">Für diesen Wert liegen keine Kursdaten vor.</div>`;

  let custs = "";
  if ((s.customers || []).length) {
    const rows = s.customers.filter((c) => state.by[c]).map((c) => { const d = relDate(c, ref); return { c, d, res: custResult(c, d) }; })
      .sort((a, b) => (a.d || "9999").localeCompare(b.d || "9999"));
    custs = `<section class="stack-sm" aria-labelledby="h-cu"><h2 id="h-cu" class="section-title">Earnings der Kunden</h2>${signalHtml(rows, "Kunden")}<div class="list-card">${rows.map(({ c, d }) => relRow(c, d, ref)).join("")}</div><p class="warn">„vorher“ = der Kunde meldet vor ${esc(s.ticker)}. Gemeldete Kunden zeigen Beat/Miss und Kursreaktion.</p></section>`;
  }
  let sups = "";
  if (isCustomer(s)) {
    const rows = s.suppliers.filter((x) => state.by[x]).map((x) => { const d = relDate(x, ref); return { x, d, res: custResult(x, d) }; })
      .sort((a, b) => (a.d || "9999").localeCompare(b.d || "9999"));
    sups = `<section class="stack-sm" aria-labelledby="h-su"><h2 id="h-su" class="section-title">Zulieferer in deiner Watchlist</h2>${signalHtml(rows, "Zulieferer")}<div class="list-card">${rows.map(({ x, d }) => relRow(x, d, ref)).join("")}</div></section>`;
  }
  const lr = lastResultCard(s);
  const hist = (s.history || []).slice(-6).reverse();
  const histHtml = hist.length ? `<section class="stack-sm" aria-labelledby="h-hi"><h2 id="h-hi" class="section-title">Letzte Earnings</h2>
    <table><thead><tr><th scope="col">Datum</th><th scope="col">EPS</th><th scope="col" class="r">Kurs</th></tr></thead><tbody>${hist.map((h) => {
      const v = verdict(h), mv = h.reaction ? h.reaction.move_pct : null;
      return `<tr><td class="mono">${esc(dDot(h.date))}</td><td>${badge(v.label, VCLASS[v.k])}</td><td class="r mono ${mv == null ? "muted" : mv >= 0 ? "up" : "down"}" style="font-weight:600">${mv == null ? "–" : pct(mv)}</td></tr>`;
    }).join("")}</tbody></table></section>` : "";

  return `<div class="stack"><nav class="topbar">${back}${tv}</nav>
    <header><div class="row-flex" style="align-items:baseline;gap:10px;flex-wrap:wrap"><h1 class="mono" style="font-size:30px;font-weight:600">${esc(s.ticker)}</h1><span style="font-size:15px;color:var(--text-2)">${esc(s.name)}</span></div>
      <div class="row-flex" style="margin-top:6px;flex-wrap:wrap"><span class="muted" style="font-size:12px">${esc(s.section || "")}${s.extra ? " (nicht in der Watchlist)" : ""}</span>${badgesFor(s)}</div>
      ${t ? `<div class="price"><b>${num(t.close, t.close >= 1 ? 2 : 4)} ${esc(sym(cur))}</b>${chg}</div>${spark(t.spark)}` : ""}
      ${s.note ? `<p class="warn" style="margin-top:6px">Hinweis: ${esc(s.note)} (${esc(s.yahoo)})</p>` : ""}</header>
    ${lr.fresh ? lr.html + earnCard(s) : earnCard(s) + lr.html}${tech}${custs}${sups}${histHtml}</div>`;
};

// ============================================================ Kunden
window.__kunden = () => {
  const d = state.data, ui = state.ui;
  const names = d.customers || {};
  const list = Object.keys(names).filter((t) => state.by[t]).sort((a, b) => {
    const da = isUpcoming(state.by[a]) ? state.by[a].next.date : "9999", db = isUpcoming(state.by[b]) ? state.by[b].next.date : "9999";
    return da.localeCompare(db) || a.localeCompare(b);
  });
  if (!list.length) return `<div class="stack"><header class="hdr"><div><h1>Kunden-Kette</h1></div></header><div class="empty">Noch keine Kunden hinterlegt. Trag sie in <b>customers.yaml</b> ein.</div></div>`;
  const sel = list.includes(ui.cust) ? ui.cust : list[0];
  const c = state.by[sel], meta = names[sel] || {};
  const upc = isUpcoming(c) ? c.next : null, rep = lastReported(c);
  const date = upc ? upc.date : rep ? rep.date : null;
  const dateLbl = upc ? "Nächste Earnings" : "Zuletzt gemeldet";
  const t = c.tech, est = !upc ? nextEstimate(c) : null;
  const sups = (c.suppliers || []).filter((x) => state.by[x]).map((x) => { const sd = date ? relDate(x, date) : null; return { x, d: sd, res: custResult(x, sd) }; })
    .sort((a, b) => (a.d || "9999").localeCompare(b.d || "9999"));
  let resLine = "";
  if (rep) {
    const v = verdict(rep), mv = rep.reaction ? rep.reaction.move_pct : null;
    resLine = `<div class="row-flex" style="flex-wrap:wrap">${badge(v.label, VCLASS[v.k])}<span style="font-size:13px;color:#B9D8F5">${upc ? "zuletzt " + esc(dDot(rep.date)) : rep.eps_act != null ? "EPS " + num(rep.eps_act) + (rep.eps_est != null ? " vs. " + num(rep.eps_est) : "") : "Zahlen folgen"}${mv != null ? " · Kurs " + pct(mv) : ""}</span></div>`;
  }
  return `<div class="stack"><header class="hdr"><div><h1>Kunden-Kette</h1><p>Wer berichtet vor deinen Zulieferern?</p></div></header>
    <div class="chips" role="tablist" aria-label="Kunde wählen">${list.map((k) => `<button class="chip mono" role="tab" data-act="cust" data-v="${esc(k)}" aria-selected="${k === sel}" aria-pressed="${k === sel}">${esc(k)}</button>`).join("")}</div>
    <section class="card" style="background:#0F1E30;border-color:#23476E">
      <div class="card-head"><a href="#/aktie/${encodeURIComponent(sel)}" style="font-size:20px;font-weight:600">${esc(meta.name || c.name)}</a>${badge(meta.typ || custKind(c), "b-kd")}</div>
      <p style="font-size:15px">${esc(dateLbl)}: ${date ? esc(dLong(date)) : "unbekannt"}${upc && TIME[upc.time] ? " · " + esc(TIME[upc.time]) : ""}</p>
      ${resLine}
      ${est ? `<p style="font-size:13px;color:#B9D8F5">Nächster Termin noch offen. Voraussichtlich ${esc(dShort(est))} (Schätzung).</p>` : ""}
      <div class="kv3">
        <div><span class="lbl">RSI (14)</span><span class="val">${t && t.rsi != null ? num(t.rsi, 1) : "–"}</span></div>
        <div><span class="lbl">Ø Reaktion</span><span class="val">${c.avg_move_pct != null ? "±" + num(c.avg_move_pct, 1) + "\u00a0%" : "–"}</span></div>
        <div><span class="lbl">Zulieferer</span><span class="val">${sups.length}</span></div>
      </div></section>
    <h2 class="section-title">Zulieferer in deiner Watchlist</h2>
    ${sups.length ? `${signalHtml(sups, "Zulieferer")}<div class="list-card">${sups.map(({ x, d: sd }) => relRow(x, sd, date || todayIso(), state.by[x].portfolio ? " · Portfolio" : "")).join("")}</div><p class="warn">„danach“ = der Zulieferer berichtet nach dem Kunden. Dessen Zahlen sind dann schon bekannt.</p>` : `<div class="empty">Keine Zulieferer aus deiner Watchlist zugeordnet.</div>`}
  </div>`;
};

// ============================================================ Ergebnisse
window.__ergebnisse = () => {
  const ui = state.ui, t = todayIso(), from = C.addDays(t, -ui.resDays);
  const all = [];
  for (const s of state.data.stocks) for (const h of reportedList(s)) if (h.date >= from && h.date <= t) all.push({ s, h, v: verdict(h) });
  const cnt = (k) => all.filter((x) => x.v.k === k).length;
  const rows = all.filter((x) => ui.resFilter === "all" || x.v.k === ui.resFilter)
    .sort((a, b) => b.h.date.localeCompare(a.h.date) || a.s.ticker.localeCompare(b.s.ticker));
  const groups = [];
  for (const r of rows) { const g = groups[groups.length - 1]; if (g && g.date === r.h.date) g.rows.push(r); else groups.push({ date: r.h.date, rows: [r] }); }
  const pending = cnt("pending");
  return `<div class="stack"><header class="hdr"><div><h1>Ergebnisse</h1><p>${all.length} Termine in ${ui.resDays} Tagen${pending ? `, ${pending} noch ohne Zahlen` : ""}</p></div></header>
    ${newTotal() ? `<div class="newbar"><span><b>${newTotal()} neu</b> seit deinem letzten Besuch</span><button class="btn" data-act="seenAll">Alle gelesen</button></div>` : ""}
    <div class="tiles"><div class="tile"><b class="up">${cnt("beat")}</b><span>Beat</span></div><div class="tile"><b class="down">${cnt("miss")}</b><span>Miss</span></div><div class="tile"><b>${cnt("inline")}</b><span>im Rahmen</span></div></div>
    <div class="seg" role="group" aria-label="Zeitraum">${[[7, "7 Tage"], [30, "30 Tage"], [90, "90 Tage"]].map(([n, l]) => `<button data-act="resDays" data-v="${n}" aria-pressed="${ui.resDays === n}">${l}</button>`).join("")}</div>
    <div class="seg" role="group" aria-label="Filter">${[["all", "Alle"], ["beat", "Beat"], ["miss", "Miss"]].map(([k, l]) => `<button data-act="resFilter" data-v="${k}" aria-pressed="${ui.resFilter === k}">${l}</button>`).join("")}</div>
    ${groups.length ? groups.map((g) => `<section class="day"><h2>${esc(dayLabel(g.date))}</h2><div class="rows">${g.rows.map(resultItem).join("")}</div></section>`).join("") : `<div class="empty">Keine Ergebnisse in diesem Zeitraum.</div>`}
  </div>`;
};

// ============================================================ Einstellungen
function maskUrl(u) {
  if (!u) return "–";
  if (u === "file") return "Datei vom Gerät";
  try {
    const x = new URL(u), p = x.pathname.split("/").filter(Boolean);
    return p.length >= 2 ? `${x.host}/${p[0]}/…${p[1].slice(-6)}` : x.host;
  } catch { return "gespeichert"; }
}
window.__settings = () => {
  const d = state.data, url = lsGet(KEY.url);
  const n = d.stocks.filter((s) => !s.extra).length;
  return `<div class="stack"><nav class="topbar"><a class="back" href="${esc(state.backHash || "#/")}">${ICON.back}Zurück</a></nav>
    <header class="hdr"><div><h1>Einstellungen</h1></div></header>
    ${state.ui.setupError ? `<div class="error" role="alert">${esc(state.ui.setupError)}</div>` : ""}
    <div class="list-card" style="padding:0">
      <div class="kv" style="width:100%"><span>Quelle</span><span>${state.demo ? "Demo-Daten" : esc(maskUrl(url))}</span></div>
      <div class="kv" style="width:100%"><span>Datenstand</span><span>${esc(stamp(d.generated) || "–")}</span></div>
      <div class="kv" style="width:100%"><span>Werte</span><span>${n}${d.stocks.length > n ? ` + ${d.stocks.length - n} Kunden` : ""}</span></div>
      <div class="kv" style="width:100%"><span>Kunden-Zuordnungen</span><span>${Object.keys(d.customers || {}).length}</span></div>
      <div class="kv" style="width:100%"><span>Version</span><span>v${esc(APP_VERSION)}</span></div>
    </div>
    ${state.fromCache ? `<div class="info">Es werden gespeicherte Daten angezeigt. Der letzte Abruf hat nicht geklappt.</div>` : ""}
    <div class="btn-row">${state.demo ? `<button class="btn primary" data-act="endDemo">Demo beenden</button>` : `<button class="btn primary" data-act="reload">Jetzt aktualisieren</button>`}</div>
    <div class="field"><label for="newUrl">Abo-Adresse ändern</label>
      <input id="newUrl" type="url" inputmode="url" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="webcal://gist.githubusercontent.com/…/earnings.ics" value="${esc(state.ui.setupVal || "")}">
      <small>Die Daten kommen aus der Datei dashboard.json im selben Gist.</small></div>
    <div class="btn-row"><button class="btn" data-act="saveUrl">Adresse speichern</button>
      <label class="btn" for="file" style="cursor:pointer">Datei laden</label><input id="file" type="file" accept=".json,application/json" class="sr"></div>
    <div class="btn-row"><button class="btn" data-act="demo">Demo ansehen</button><button class="btn danger" data-act="reset">Alles zurücksetzen</button></div>
    <p class="warn">Alle Angaben bleiben nur auf diesem Gerät. Kennzahlen sind Momentaufnahmen des letzten Laufs und keine Anlageberatung.</p>
  </div>`;
};

window.__start();
})();
