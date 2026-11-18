/* =====================================================
   viz.js – التحليل البصري والجداول التفاعلية
   تطوير: بلال محمد سليمان | واتساب: 01128079357
   ملف إضافي يُحمَّل بعد ext.js: لا يغيّر منطق app.js، ويقرأ نفس بيانات biz (حسب kind) المحمَّلة أصلاً في الذاكرة.
   الفلترة والترتيب بـ JavaScript فقط: لا استعلامات جديدة على Firestore ولا تعديل في القواعد أو الصلاحيات. يعمل أوفلاين.
   رسوم SVG نقية بدون مكتبات.
   ===================================================== */
(() => {
"use strict";
const COL = { fuel: "#e85d04", parts: "#2a4d7c", adv: "#0ea5e9", rent: "#16a34a", other: "#94a3b8" };
const CAT_NAME = { fuel: "السولار", parts: "قطع الغيار والكاوتش", adv: "عُهد السائقين", rent: "الإيجارات", other: "مصروفات أخرى وصيانة" };
const TABS = [["overview", "نظرة عامة"], ["costs", "التكاليف"], ["fuel", "السولار"], ["sites", "المواقع والمعدات"]];
const SHOW = { overview: ["donut", "bar", "line"], costs: ["donut", "line", "sites"], fuel: ["bar", "equip"], sites: ["sites", "equip"] };
const CARDS = [["donut", "توزيع التكاليف", "fa-chart-pie"], ["bar", "معدل استهلاك السولار لكل معدة (لتر/ساعة)", "fa-gas-pump"], ["line", "تطور المصروفات وتكلفة الإنتاج (آخر 6 شهور)", "fa-chart-line"], ["sites", "ملخص المواقع", "fa-location-dot"], ["equip", "ملخص المعدات", "fa-truck-monster"]];
const ST = { mk: "", site: "", tab: "overview" };
const SORT = { sites: { k: "total", dir: -1 }, equip: { k: "exp", dir: -1 } };
const collapsed = new Set(), DON = {};
let A = null, BAR = [], LINE = [];
const g = id => document.getElementById(id);
const f1 = n => fmt(Math.round((+n || 0) * 10) / 10);
const compact = n => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "k" : String(Math.round(n)); };
const empty = t => `<p class="vz-empty">${esc(t)}</p>`;
const NODATA = "لا توجد بيانات لهذه الفترة / الموقع. جرّب «كل الفترات» أو «كل المواقع».";
const vk = (ic, l, v, s) => `<div class="kpi"><div class="ico"><i class="fa-solid ${ic}"></i></div><div class="min-w-0"><div class="text-sm text-slate-500">${l}</div><div class="text-xl font-extrabold leading-tight">${v}</div>${s ? `<div class="text-xs text-slate-500">${s}</div>` : ""}</div></div>`;

/* ---------- التحليل: كل الأرقام من الذاكرة (vehicles / expenses / advances / xbiz) ---------- */
function analyze(mk, site) {
  const inP = d => !mk || String(d || "").startsWith(mk);
  const sOk = s => !site || (!!s && normAr(s) === normAr(site));
  const loc = id => cleanName((vById(id) || {}).location);
  const [a, b] = mk ? monthRange(mk) : [-Infinity, Infinity];
  const from = mk ? mk + "-01" : "", to = mk ? mk + "-31" : "";
  const vm = {}, V = id => (vm[id] ||= { id, liters: 0, hours: 0, rl: 0, rh: 0, down: 0, exp: 0 });
  const C = { fuel: 0, parts: 0, adv: 0, rent: 0, other: 0 }, rates = fuelRates();
  XK("fuelout").filter(x => inP(x.date) && sOk(x.site || loc(x.vehicleId))).forEach(x => {
    const L = +x.liters || 0, c = L * priceAt(x.date), v = V(x.vehicleId);
    C.fuel += c; v.liters += L; v.exp += c;
    const r = rates[x.id]; if (r) { v.hours += r.dh; v.rl += L; v.rh += r.dh; }
  });
  expenses.filter(e => inP(e.date) && sOk(cleanName(e.project) || loc(e.vehicleId))).forEach(e => {
    const amt = +e.amount || 0, v = e.vehicleId ? V(e.vehicleId) : { liters: 0, exp: 0 };
    v.exp += amt;
    if (e.category === "fuel") { C.fuel += amt; v.liters += +e.liters || 0; }
    else if (e.category === "parts" || e.category === "tires") C.parts += amt;
    else C.other += amt;
  });
  XK("part").filter(p => inP(p.installDate) && sOk(loc(p.vehicleId))).forEach(p => { const c = +p.cost || 0; C.parts += c; if (p.vehicleId) V(p.vehicleId).exp += c; });
  XK("maint").filter(m => inP(m.date) && sOk(loc(m.vehicleId))).forEach(m => { const c = +m.cost || 0; C.other += c; if (m.vehicleId) V(m.vehicleId).exp += c; });
  advances.filter(x => sOk(cleanName(x.project))).forEach(x => (x.items || []).filter(i => inP(i.date)).forEach(i => { C.adv += +i.amount || 0; }));
  XK("rental").filter(c => c.dir === "in" && sOk(loc(c.vehicleId))).forEach(c => { C.rent += rcCalc(c, from, to).due || 0; });
  XK("downtime").filter(d => d.vehicleId && sOk(d.site || loc(d.vehicleId))).forEach(d => { const h = overlapH(d, a, b); if (h > 0) V(d.vehicleId).down += h; });
  const total = sumBy(Object.values(C), x => x);
  const veh = Object.values(vm).filter(v => vById(v.id)).map(v => {
    const ve = vById(v.id), lph = v.rh > 0 ? v.rl / v.rh : null;
    return { ...v, veh: ve, name: vLabel(ve), lph, level: lph == null ? "" : lphLevel(ve, lph) };
  }).filter(v => v.liters || v.hours || v.down || v.exp);
  const top = [...veh].sort((x, y) => y.liters - x.liters)[0];
  const names = site ? [site] : knownSites();
  const sites = names.map(s => siteCost(s, from, to)).filter(r => r.total > 0 || Object.keys(r.units).length)
    .map(r => ({ name: r.site, qty: sumBy(Object.values(r.units), x => x), qtyTxt: unitsTxt(r.units), total: r.total, cpu: r.cpu ? r.cpu.v : null, cpuTxt: r.cpu ? `${money(Math.round(r.cpu.v * 100) / 100)} / ${PU_SHORT[r.cpu.unit] || r.cpu.unit}` : (Object.keys(r.units).length > 1 ? "وحدات مختلطة" : "—"), mixed: Object.keys(r.units).length > 1, raw: r }));
  const cu = {};
  sites.forEach(s => { if (s.raw.cpu) { const u = s.raw.cpu.unit, c = (cu[u] ||= { cost: 0, qty: 0 }); c.cost += s.total; c.qty += s.raw.units[u]; } });
  return { C, total, veh, top, sites, cu, mk, site };
}
function trend(site) {
  return monthsBack(6).map(m => {
    const r = analyze(m, site);
    return { m, total: r.total, prod: sumBy(r.sites.filter(s => s.qty > 0), s => s.total) };
  });
}

/* ---------- Donut عام (SVG نقي) ---------- */
function donutBlock(key, segs, fv, top, sub) {
  segs = segs.filter(s => s.v > 0);
  const tot = sumBy(segs, s => s.v); if (!tot) return null;
  DON[key] = { segs, fv, tot, sel: -1 };
  let acc = 0;
  const circles = segs.map((s, i) => {
    const pct = s.v / tot * 100, dash = segs.length > 1 ? Math.max(0.01, pct - 0.8) : 100, off = 25 - acc; acc += pct;
    return `<circle class="vz-seg" data-vzseg="${key}:${i}" tabindex="0" role="button" aria-label="${esc(s.n)}" cx="21" cy="21" r="16" pathLength="100" fill="none" stroke="${s.c}" stroke-width="6" style="--d:${dash.toFixed(2)};--r:${(100 - dash).toFixed(2)};--o:${off.toFixed(2)}"/>`;
  }).join("");
  return `<div class="vz-dwrap"><div class="vz-donut vz-anim"><svg viewBox="0 0 42 42" role="img" aria-label="رسم دائري">${circles}</svg><div class="vz-center"><b>${top}</b><span>${sub}</span></div></div>
    <div class="vz-side"><div class="vz-legend">${segs.map((s, i) => `<button type="button" class="vz-lg" data-vzseg="${key}:${i}"><i style="background:${s.c}"></i><span>${esc(s.n)}</span><b>${esc(fv(s.v))}</b><em>${Math.round(s.v / tot * 100)}%</em></button>`).join("")}</div>
    <div class="vz-detail" id="vzd-${key}">المس أي جزء من الدائرة لعرض التفاصيل.</div></div></div>`;
}
function pickSeg(key, i) {
  const d = DON[key]; if (!d) return;
  d.sel = d.sel === i ? -1 : i;
  document.querySelectorAll(`[data-vzseg^="${key}:"]`).forEach(el => {
    const k = +el.dataset.vzseg.split(":")[1], on = k === d.sel;
    if (el.tagName.toLowerCase() === "circle") { el.setAttribute("stroke-width", on ? 8 : 6); el.style.opacity = d.sel < 0 || on ? 1 : .35; }
    else el.classList.toggle("on", on);
  });
  const box = g("vzd-" + key); if (!box) return;
  const s = d.segs[d.sel];
  box.innerHTML = !s ? "المس أي جزء من الدائرة لعرض التفاصيل."
    : `<div class="flex items-center gap-2"><i class="vz-dot" style="background:${s.c}"></i><b>${esc(s.n)}</b></div><div class="text-lg font-extrabold">${esc(d.fv(s.v))} <span class="text-sm text-slate-500">(${(s.v / d.tot * 100).toFixed(1)}%)</span></div>${s.items && s.items.length ? `<div class="text-xs text-slate-600 mt-1">${s.items.map(esc).join("، ")}</div>` : ""}`;
}
const animateIn = root => requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll(".vz-anim").forEach(x => x.classList.add("vz-on"))));

/* ---------- حالة الأسطول (الرئيسية) ---------- */
function fleetData() {
  const open = new Set(dtOpen().map(d => d.vehicleId)), last = {}, mx = (id, d) => { if (id && d && (!last[id] || d > last[id])) last[id] = d; };
  XK("fuelout").forEach(x => mx(x.vehicleId, x.date)); operations.forEach(o => mx(o.vehicleId, o.date));
  const r = { work: [], broken: [], stop: [] };
  activeVehicles().forEach(v => {
    const l = vLabel(v);
    if (open.has(v.id) || v.status === "maintenance") r.broken.push(l);
    else { const d = [v.hoursDate, last[v.id]].filter(Boolean).sort().pop(); (d && ageOf(d) <= 7 ? r.work : r.stop).push(l); }
  });
  return r;
}
function renderFleet() {
  const box = g("fleet-card"); if (!box) return;
  const r = fleetData(), n = r.work.length + r.broken.length + r.stop.length;
  const html = donutBlock("fleet", [{ n: "شغّالة في المواقع", v: r.work.length, c: "#16a34a", items: r.work }, { n: "عطلانة / قيد الإصلاح", v: r.broken.length, c: "#dc2626", items: r.broken }, { n: "متوقفة", v: r.stop.length, c: "#f59e0b", items: r.stop }], v => `${v} معدة`, n, "معدة");
  box.innerHTML = `<h3 class="font-extrabold mb-3"><i class="fa-solid fa-chart-pie text-orange-600 ml-2"></i>حالة الأسطول الآن</h3>` + (html || empty("لا توجد معدات نشطة بعد.")) +
    (html ? `<p class="text-xs text-slate-500 mt-2">«متوقفة» = معدة غير معطلة ولا تحت الصيانة لكن لم تُسجَّل لها قراءة عداد أو تفويل أو يومية تشغيل منذ أكثر من 7 أيام.</p>` : "");
  animateIn(box);
}

/* ---------- Bar: معدل لتر/ساعة ---------- */
const LV_COL = { red: "#dc2626", orange: "#f59e0b", ok: "#2a4d7c", "": "#94a3b8" };
function barSvg(rows) {
  const W = 360, rh = 34, ox = 250, mw = 170, H = rows.length * rh + 16;
  const max = Math.max(1, ...rows.map(r => Math.max(r.lph, +r.veh.normalLph || 0)));
  const body = rows.map((r, i) => {
    const y = 8 + i * rh, w = Math.max(2, r.lph / max * mw), nm = +r.veh.normalLph || 0, nm_x = ox - nm / max * mw;
    return `<g class="vz-bg" data-vzbar="${i}" tabindex="0" role="button" aria-label="${esc(r.name)}"><rect x="0" y="${y}" width="${W}" height="${rh}" fill="transparent"/>
      <text x="356" y="${y + rh / 2 + 4}" text-anchor="end" font-size="11" fill="#334155">${esc(r.name.length > 15 ? r.name.slice(0, 14) + "…" : r.name)}</text>
      <rect class="vz-bar" x="${(ox - w).toFixed(1)}" y="${y + 6}" width="${w.toFixed(1)}" height="${rh - 14}" rx="4" fill="${LV_COL[r.level]}"/>
      ${nm > 0 ? `<line x1="${nm_x.toFixed(1)}" x2="${nm_x.toFixed(1)}" y1="${y + 3}" y2="${y + rh - 5}" stroke="#0f172a" stroke-width="1.5" stroke-dasharray="2 2"/>` : ""}
      <text x="${(ox - w - 4).toFixed(1)}" y="${y + rh / 2 + 4}" text-anchor="end" font-size="11" font-weight="700" fill="#0f172a">${fmt(Math.round(r.lph * 100) / 100)}</text></g>`;
  }).join("");
  return `<div class="vz-anim"><svg viewBox="0 0 ${W} ${H}" class="w-full" role="img" aria-label="رسم أعمدة لمعدل استهلاك السولار">${body}</svg></div>
    <div class="vz-key"><span><i style="background:#2a4d7c"></i>طبيعي</span><span><i style="background:#f59e0b"></i>أعلى قليلاً</span><span><i style="background:#dc2626"></i>متجاوز</span><span><i style="background:#94a3b8"></i>بدون معدل طبيعي</span><span>┆ المعدل الطبيعي</span></div>
    <div class="vz-detail" id="vzd-bar">المس أي عمود لعرض التفاصيل.</div>`;
}
function pickBar(i) {
  const r = BAR[i], box = g("vzd-bar"); if (!r || !box) return;
  const n = +r.veh.normalLph, [c, t] = LVL[r.level];
  box.innerHTML = `<b>${esc(r.name)}</b> ${badge(c, t)}<div class="text-sm mt-1">المعدل: <b>${fmt(Math.round(r.lph * 100) / 100)}</b> لتر/ساعة${n > 0 ? ` · الطبيعي ${fmt(n)}` : ""}</div><div class="text-xs text-slate-600">السولار ${f1(r.liters)} لتر · ${f1(r.hours)} ساعة تشغيل محسوبة</div>`;
}

/* ---------- Line: المصروفات وتكلفة الإنتاج ---------- */
function lineSvg(pts) {
  const W = 360, H = 210, top = 14, bot = 170, x0 = 300, step = 280 / 5;
  const max = Math.max(1, ...pts.map(p => Math.max(p.total, p.prod))), X = i => x0 - i * step, Y = v => bot - v / max * (bot - top);
  const grid = [0, .25, .5, .75, 1].map(t => `<line x1="14" x2="306" y1="${Y(max * t).toFixed(1)}" y2="${Y(max * t).toFixed(1)}" stroke="#e2e8f0"/><text x="352" y="${(Y(max * t) + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748b">${compact(max * t)}</text>`).join("");
  const path = k => pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join(" ");
  const dots = (k, c) => pts.map((p, i) => `<circle data-vzpt="${i}" cx="${X(i).toFixed(1)}" cy="${Y(p[k]).toFixed(1)}" r="4" fill="#fff" stroke="${c}" stroke-width="2"/><circle data-vzpt="${i}" cx="${X(i).toFixed(1)}" cy="${Y(p[k]).toFixed(1)}" r="13" fill="transparent" tabindex="0" role="button" aria-label="${esc(p.m)}"/>`).join("");
  const lbl = pts.map((p, i) => `<text x="${X(i).toFixed(1)}" y="192" text-anchor="middle" font-size="10" fill="#475569">${p.m.slice(5)}/${p.m.slice(2, 4)}</text>`).join("");
  return `<div class="vz-anim"><svg viewBox="0 0 ${W} ${H}" class="w-full" role="img" aria-label="رسم خطي لتطور المصروفات">${grid}
    <path class="vz-ln" pathLength="1" d="${path("total")}" fill="none" stroke="#e85d04" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <path class="vz-ln" pathLength="1" d="${path("prod")}" fill="none" stroke="#1e3a5f" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <g class="vz-dots">${dots("total", "#e85d04")}${dots("prod", "#1e3a5f")}</g>${lbl}</svg></div>
    <div class="vz-key"><span><i style="background:#e85d04"></i>إجمالي المصروفات</span><span><i style="background:#1e3a5f"></i>تكلفة الإنتاج (المواقع ذات الإنتاج)</span></div>
    <div class="vz-detail" id="vzd-line">المس أي نقطة لعرض أرقام الشهر.</div>`;
}
function pickPt(i) {
  const p = LINE[i], box = g("vzd-line"); if (!p || !box) return;
  box.innerHTML = `<b>${esc(p.m)}</b><div class="text-sm mt-1">إجمالي المصروفات: <b class="text-orange-600">${money(Math.round(p.total))}</b></div><div class="text-sm">تكلفة الإنتاج: <b style="color:#1e3a5f">${money(Math.round(p.prod))}</b></div>`;
}

/* ---------- الجداول الذكية ---------- */
const SITE_COLS = [
  { k: "name", l: "الموقع", v: r => r.name, h: r => `<b>${esc(r.name)}</b>` },
  { k: "qty", l: "كمية الإنتاج", v: r => r.qty, h: r => esc(r.qtyTxt) },
  { k: "total", l: "إجمالي التكلفة", v: r => r.total, h: r => money(Math.round(r.total)) },
  { k: "cpu", l: "تكلفة المتر / الطن", v: r => r.cpu, h: r => r.cpu != null ? `<b class="text-orange-600">${esc(r.cpuTxt)}</b>` : (r.mixed ? badge("s", "وحدات مختلطة") : "—") }];
const EQ_COLS = [
  { k: "name", l: "المعدة", v: r => r.name, h: r => `<b>${esc(r.name)}</b>` },
  { k: "hours", l: "ساعات التشغيل", v: r => r.hours, h: r => r.hours ? f1(r.hours) : "—" },
  { k: "liters", l: "السولار المستهلك (لتر)", v: r => r.liters, h: r => r.liters ? f1(r.liters) : "—" },
  { k: "lph", l: "لتر/ساعة", v: r => r.lph, h: r => r.lph == null ? "—" : `<b>${fmt(Math.round(r.lph * 100) / 100)}</b> ${r.level ? badge(...LVL[r.level]) : ""}` },
  { k: "down", l: "ساعات الأعطال", v: r => r.down, h: r => r.down > 0 ? `${f1(r.down)} ${badge(r.down > 24 ? "r" : "o", r.down > 24 ? "توقف طويل" : "عطل")}` : "—" },
  { k: "exp", l: "إجمالي المصروف", v: r => r.exp, h: r => money(Math.round(r.exp)) }];
function sorted(id, cols, rows) {
  const s = SORT[id], c = cols.find(x => x.k === s.k); if (!c) return rows;
  return [...rows].sort((x, y) => {
    const a = c.v(x), b = c.v(y);
    if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1;
    return s.dir * (typeof a === "string" ? a.localeCompare(b, "ar") : a - b);
  });
}
function tbl(id, cols, rows) {
  if (!rows.length) return empty(NODATA);
  const s = SORT[id];
  return `<div class="vz-tw"><table class="vz-t"><thead><tr>${cols.map(c => `<th><button type="button" data-vzsort="${id}:${c.k}">${c.l}<span class="vz-ar">${s.k === c.k ? (s.dir > 0 ? "▲" : "▼") : "↕"}</span></button></th>`).join("")}</tr></thead>
    <tbody>${sorted(id, cols, rows).map(r => `<tr>${cols.map(c => `<td>${c.h(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/* ---------- اللوحة ---------- */
function ensurePanel(p) {
  if (p.dataset.ready) return; p.dataset.ready = "1";
  p.innerHTML = `<div class="card"><div class="grid sm:grid-cols-3 gap-3 items-end">
      <div><label class="lbl" for="vz-month">الشهر</label><select id="vz-month" class="inp"></select></div>
      <div><label class="lbl" for="vz-site">الموقع</label><select id="vz-site" class="inp"></select></div>
      <div><button type="button" id="vz-print" class="btn-dark w-full"><i class="fa-solid fa-print ml-2"></i>طباعة / حفظ PDF</button></div></div>
    <div id="vz-tabs" class="vz-tabs" role="tablist"></div></div>
    <div id="vz-sum" class="grid sm:grid-cols-3 gap-4"></div>
    <div class="space-y-4">${CARDS.map(([k, t, ic]) => `<section class="card vz-card" data-vzcard="${k}"><div class="flex items-center justify-between gap-2"><h3 class="font-extrabold"><i class="fa-solid ${ic} text-orange-600 ml-2"></i>${t}</h3>
      <button type="button" class="vz-col" data-vzcol="${k}" aria-expanded="true" aria-label="طي / فتح"><i class="fa-solid fa-chevron-up"></i></button></div><div class="vz-body mt-3" id="vz-${k}"></div></section>`).join("")}</div>`;
  g("vz-month").onchange = e => { ST.mk = e.target.value; renderPanel(); };
  g("vz-site").onchange = e => { ST.site = e.target.value; renderPanel(); };
  g("vz-print").onclick = printPanel;
}
function monthOpts() {
  const s = new Set([today().slice(0, 7)]), add = d => { if (/^\d{4}-\d{2}/.test(d || "")) s.add(d.slice(0, 7)); };
  expenses.forEach(e => add(e.date)); xbiz.forEach(x => add(x.date || x.installDate || x.start)); advances.forEach(x => (x.items || []).forEach(i => add(i.date)));
  return [...s].sort().reverse();
}
function renderPanel() {
  const p = g("vz-panel"); if (!p) return; ensurePanel(p);
  const ms = monthOpts(); if (ST.mk && !ms.includes(ST.mk)) ST.mk = "";
  const sites = knownSites(); if (ST.site && !sites.some(s => normAr(s) === normAr(ST.site))) ST.site = "";
  g("vz-month").innerHTML = `<option value="">كل الفترات</option>` + ms.map(m => `<option value="${m}">${m}</option>`).join(""); g("vz-month").value = ST.mk;
  g("vz-site").innerHTML = `<option value="">كل المواقع</option>` + sites.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join(""); g("vz-site").value = ST.site;
  g("vz-tabs").innerHTML = TABS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${ST.tab === k}" class="${ST.tab === k ? "on" : ""}" data-vztab="${k}">${l}</button>`).join("");
  A = analyze(ST.mk, ST.site);
  /* بطاقات الملخص */
  const cu = Object.entries(A.cu).map(([u, c]) => `${money(Math.round(c.cost / c.qty * 100) / 100)} / ${PU_SHORT[u] || u}`);
  g("vz-sum").innerHTML = vk("fa-coins", "إجمالي المصروفات", money(Math.round(A.total)), ST.mk || "كل الفترات") +
    vk("fa-scale-balanced", "متوسط تكلفة المتر / الطن", cu.length ? cu.map(x => `<div>${x}</div>`).join("") : "—", cu.length ? "من المواقع ذات الإنتاج" : "لا يوجد إنتاج مسجل") +
    vk("fa-gas-pump", "أعلى معدة استهلاكاً للسولار", A.top && A.top.liters ? esc(A.top.name) : "—", A.top && A.top.liters ? `${f1(A.top.liters)} لتر` : "");
  /* الدونات */
  const segs = Object.keys(CAT_NAME).map(k => ({ n: CAT_NAME[k], v: A.C[k], c: COL[k] }));
  g("vz-donut").innerHTML = donutBlock("cost", segs, v => `${money(Math.round(v))}`, compact(A.total), "ج.م") || empty(NODATA);
  /* الأعمدة */
  BAR = A.veh.filter(v => v.lph != null).sort((x, y) => y.lph - x.lph).slice(0, 12);
  g("vz-bar").innerHTML = BAR.length ? barSvg(BAR) : empty("لا توجد تفويلات كافية لحساب المعدل (تحتاج تفويلتين بقراءتي عداد على الأقل لكل معدة).");
  /* الخط */
  LINE = trend(ST.site);
  g("vz-line").innerHTML = LINE.some(x => x.total || x.prod) ? lineSvg(LINE) : empty(NODATA);
  /* الجداول */
  g("vz-sites").innerHTML = tbl("sites", SITE_COLS, A.sites);
  g("vz-equip").innerHTML = tbl("equip", EQ_COLS, A.veh);
  /* العرض حسب التبويب + الطي */
  document.querySelectorAll("[data-vzcard]").forEach(c => {
    const k = c.dataset.vzcard, off = collapsed.has(k);
    c.classList.toggle("hidden", !SHOW[ST.tab].includes(k));
    g("vz-" + k).classList.toggle("hidden", off);
    const b = c.querySelector("[data-vzcol]"); b.classList.toggle("vz-closed", off); b.setAttribute("aria-expanded", String(!off));
  });
  p.classList.remove("vz-fade"); void p.offsetWidth; p.classList.add("vz-fade");
  animateIn(p);
}
function reTable(id) { g("vz-" + id).innerHTML = tbl(id, id === "sites" ? SITE_COLS : EQ_COLS, id === "sites" ? A.sites : A.veh); }

/* ---------- طباعة / PDF: الجداول المعروضة فقط ---------- */
function printPanel() {
  if (!A) return;
  const shown = k => SHOW[ST.tab].includes(k) && !collapsed.has(k), secs = [];
  const cu = Object.entries(A.cu).map(([u, c]) => `${fmt(Math.round(c.cost / c.qty * 100) / 100)} ${SETTINGS.currency} / ${PU_SHORT[u] || u}`).join(" ، ") || "—";
  secs.push({ title: "الملخص", head: ["البند", "القيمة"], rows: [{ "البند": "إجمالي المصروفات", "القيمة": money(Math.round(A.total)) }, { "البند": "متوسط تكلفة المتر / الطن", "القيمة": cu }, { "البند": "أعلى معدة استهلاكاً للسولار", "القيمة": A.top && A.top.liters ? `${A.top.name} (${f1(A.top.liters)} لتر)` : "—" }] });
  if (shown("donut")) secs.push({ title: "توزيع التكاليف", head: ["البند", "المبلغ", "النسبة"], rows: Object.keys(CAT_NAME).map(k => ({ "البند": CAT_NAME[k], "المبلغ": money(Math.round(A.C[k])), "النسبة": A.total ? Math.round(A.C[k] / A.total * 100) + "%" : "0%" })) });
  if (shown("bar")) secs.push({ title: "معدل استهلاك السولار (لتر/ساعة)", head: ["المعدة", "لتر/ساعة", "المعدل الطبيعي", "الحالة"], rows: BAR.map(r => ({ "المعدة": r.name, "لتر/ساعة": fmt(Math.round(r.lph * 100) / 100), "المعدل الطبيعي": +r.veh.normalLph > 0 ? fmt(r.veh.normalLph) : "—", "الحالة": LVL[r.level][1] })) });
  if (shown("line")) secs.push({ title: "تطور المصروفات (آخر 6 شهور)", head: ["الشهر", "إجمالي المصروفات", "تكلفة الإنتاج"], rows: LINE.map(p => ({ "الشهر": p.m, "إجمالي المصروفات": money(Math.round(p.total)), "تكلفة الإنتاج": money(Math.round(p.prod)) })) });
  if (shown("sites")) secs.push({ title: "ملخص المواقع", head: ["الموقع", "كمية الإنتاج", "إجمالي التكلفة", "تكلفة المتر / الطن"], rows: sorted("sites", SITE_COLS, A.sites).map(r => ({ "الموقع": r.name, "كمية الإنتاج": r.qtyTxt, "إجمالي التكلفة": money(Math.round(r.total)), "تكلفة المتر / الطن": r.cpuTxt })) });
  if (shown("equip")) secs.push({ title: "ملخص المعدات", head: ["المعدة", "ساعات التشغيل", "السولار (لتر)", "لتر/ساعة", "ساعات الأعطال", "إجمالي المصروف"], rows: sorted("equip", EQ_COLS, A.veh).map(r => ({ "المعدة": r.name, "ساعات التشغيل": f1(r.hours), "السولار (لتر)": f1(r.liters), "لتر/ساعة": r.lph == null ? "—" : fmt(Math.round(r.lph * 100) / 100), "ساعات الأعطال": f1(r.down), "إجمالي المصروف": money(Math.round(r.exp)) })) });
  printDoc({ title: `التحليل البصري — ${ST.mk || "كل الفترات"} — ${ST.site || "كل المواقع"}`, sections: secs });
}

/* ---------- التفاعل ---------- */
document.addEventListener("click", ev => {
  const t = ev.target; let b;
  if ((b = t.closest("[data-vzseg]"))) { const [k, i] = b.dataset.vzseg.split(":"); return pickSeg(k, +i); }
  if ((b = t.closest("[data-vzbar]"))) return pickBar(+b.dataset.vzbar);
  if ((b = t.closest("[data-vzpt]"))) return pickPt(+b.dataset.vzpt);
  if ((b = t.closest("[data-vztab]"))) { ST.tab = b.dataset.vztab; return renderPanel(); }
  if ((b = t.closest("[data-vzcol]"))) { const k = b.dataset.vzcol; collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k); const off = collapsed.has(k); g("vz-" + k).classList.toggle("hidden", off); b.classList.toggle("vz-closed", off); b.setAttribute("aria-expanded", String(!off)); return; }
  if ((b = t.closest("[data-vzsort]"))) {
    const [id, k] = b.dataset.vzsort.split(":"), s = SORT[id];
    s.dir = s.k === k ? -s.dir : (k === "name" ? 1 : -1); s.k = k; return reTable(id);
  }
});
document.addEventListener("keydown", ev => {                       // لوحة المفاتيح: Enter / مسافة على عناصر الرسم
  if (ev.key !== "Enter" && ev.key !== " ") return;
  const el = ev.target.closest && ev.target.closest("[data-vzseg],[data-vzbar],[data-vzpt]");
  if (el && el.tagName.toLowerCase() !== "button") { ev.preventDefault(); el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
});

/* ---------- الربط بدورة التحميل ---------- */
const ld0 = loadData;
loadData = async function () {
  await ld0();
  try { renderFleet(); } catch (e) { console.error("fleet", e); }
  try { const v = g("view-reports"); if (v && !v.classList.contains("hidden")) renderPanel(); } catch (e) { console.error("viz", e); }
};
VIEW_HOOKS.reports = () => { try { renderPanel(); } catch (e) { console.error("viz", e); } };
})();
