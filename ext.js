/* =====================================================
   ext.js – الشركات • خزينة المحاسب (العهدة) • السائقين والصيانة • البحث الشامل
   ملف إضافي فوق app.js: لا يغيّر منطقه ويعتمد على دوالّه.
   مجموعتان جديدتان في Firestore: biz (شركات/توريدات/دفعات/سائقين/صيانة) و acct (فترات خزينة المحاسب)
   ===================================================== */
(() => {
"use strict";
const LATE_DAYS = 30, STALE_DAYS = 7;
let biz = [], acct = [], curP = "", curS = "";
const tabs = { biz: "co", crew: "dr" };
const TABS = { biz: [["co", "الشركات"], ["sp", "التوريدات"], ["pay", "الدفعات"], ["pf", "الأرباح"], ["rp", "تقارير"]], crew: [["dr", "السائقين"], ["ins", "تأمين وفحص"], ["mt", "سجل الصيانة"]] };
const DEF_SHEETS = ["كشف إعاشة", "كشف مرتبات وسلفيات", "كشف بدلات", "كشف إيجارات شقق الموقع", "كشف مصروفات يومية", "كشف مصروفات نثرية", "كشف مشتريات مخزن", "فواتير ضريبية", "مصاريف خلاطة الخرسانة", "دفعات موردين", "كشف مصاريف موقع"];

/* ---------- أدوات ---------- */
const K = k => biz.filter(x => x.kind === k);
const byId = (a, id) => a.find(x => x.id === id);
const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);
const byDate = (a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || 0) - (b.createdAt || 0);
const age = d => d ? Math.round((Date.parse(today()) - Date.parse(d)) / 864e5) : 0;
const opts = (arr, v, l, ph) => (ph ? `<option value="">${ph}</option>` : "") + arr.map(x => `<option value="${esc(v(x))}">${esc(l(x))}</option>`).join("");
const F = (l, i, c = "") => `<div class="${c}"><label class="lbl">${l}</label>${i}</div>`;
const I = (n, o = "") => `<input name="${n}" class="inp" autocomplete="off" ${o}>`;
const D = n => I(n, 'type="date"');
const N = (n, o = "") => I(n, `type="number" min="0" step="any" ${o}`);
const TB = (head, id) => `<div class="card overflow-x-auto"><table class="w-full text-sm text-right whitespace-nowrap"><thead class="text-slate-500 border-b"><tr>${head.map(h => `<th class="py-2">${h}</th>`).join("")}</tr></thead><tbody id="${id}"></tbody></table></div>`;
const none = (c, t = "لا توجد بيانات.") => `<tr><td colspan="${c}" class="py-4 text-slate-500">${t}</td></tr>`;
const delBtn = (a, id) => `<button type="button" data-${a}="${esc(id)}" class="text-red-600" aria-label="حذف"><i class="fa-solid fa-trash"></i></button>`;
const fd = f => Object.fromEntries(new FormData(f).entries());
const coName = id => (byId(K("company"), id) || {}).name || "—";
const keep = (el, html) => { if (!el) return; const c = el.value; el.innerHTML = html; el.value = c; };
const dleft = d => d ? daysUntil(d) : null;
const when = d => { const n = daysUntil(d); return n < 0 ? `منتهي منذ ${-n} يوم` : n === 0 ? "ينتهي اليوم" : `بعد ${n} يوم`; };
const tone = d => { if (!d) return "text-slate-400"; const n = daysUntil(d); return n < 0 ? "text-red-600 font-bold" : n <= SETTINGS.licenseWarnDays ? "text-orange-600 font-bold" : "text-green-700"; };
const SIG = `<div class="sig"><div>توقيع المحاسب</div><div>اعتماد المدير</div></div>`;
const kpi = (ic, l, v, warn) => `<div class="kpi ${warn ? "warn" : ""}"><div class="ico"><i class="fa-solid ${ic}"></i></div><div><div class="text-sm text-slate-500">${l}</div><div class="text-2xl font-extrabold">${v}</div></div></div>`;
const exportBtns = key => ["xlsx:Excel", "docx:Word", "pdf:PDF", "print:طباعة"].map(x => { const [k, l] = x.split(":"); return `<button type="button" data-export="${key.replace("#", k)}" class="btn-dark !px-3 !py-1.5">${l}</button>`; }).join("");

/* ---------- حفظ وتحميل ---------- */
async function extLoad() { [biz, acct] = await Promise.all(["biz", "acct"].map(listSafe)); }
const refresh = async () => { await extLoad(); renderAll(); try { renderNotifs(); } catch (e) { /* لم تُحمَّل الرئيسية */ } };
const sv = async (col, d, id) => { try { const r = await S.save(col, d, id); await refresh(); return r; } catch (e) { dbErr(e); } };
const rm = async (col, id) => { try { await S.remove(col, id); await refresh(); } catch (e) { dbErr(e); } };
const upl = async file => file && file.size ? await S.upload(file) : "";
const savePeriod = async p => { try { const { id, ...r } = p; await S.save("acct", r, id); await refresh(); } catch (e) { dbErr(e); } };
const logP = (p, txt) => (p.log ||= []).push({ at: Date.now(), day: today(), user: $("#user-email").textContent || "", txt });

/* ---------- الشركات: حسابات ---------- */
function coStat(id) {
  const s = K("supply").filter(x => x.companyId === id).sort(byDate), p = K("payment").filter(x => x.companyId === id).sort(byDate);
  const sup = sum(s, x => x.total), paid = sum(p, x => x.amount);
  let rest = paid, oldest = "";
  for (const x of s) { if (rest >= (+x.total || 0) - 0.001) rest -= (+x.total || 0); else { oldest = x.date; break; } }
  return { s, p, sup, paid, bal: sup - paid, oldest, age: oldest && sup > paid ? age(oldest) : 0 };
}

/* ---------- بناء الصفحات ---------- */
const main = $("main");
const mk = (id, html) => { const d = document.createElement("div"); d.id = "view-" + id; d.className = "view hidden space-y-5"; d.innerHTML = html; main.appendChild(d); };
const navBtn = (k, ic, t) => { const b = document.createElement("button"); b.className = "nav-btn leading-tight"; b.dataset.nav = k; b.innerHTML = `<i class="fa-solid ${ic} w-5"></i>${t}`; b.onclick = () => show(k); $('[data-nav="audit"]').before(b); };
const WARN = `<p class="xwarn hidden text-sm bg-red-50 text-red-700 border border-red-200 rounded-xl p-3"></p>`;
const SAVEBTN = (t, cancel) => `<div class="flex gap-2"><button class="btn flex-1">${t}</button>${cancel ? `<button type="button" id="${cancel}" class="hidden px-4 py-2.5 rounded-xl bg-slate-200 font-bold">إلغاء</button>` : ""}</div>`;

mk("biz", `
<h2 class="text-xl font-extrabold">الشركات والتوريدات</h2>${WARN}
<div class="xtabs flex flex-wrap gap-2 text-sm" data-v="biz"></div>
<section data-xp="biz:co" class="space-y-4">
  <form id="co-form" class="card grid sm:grid-cols-3 gap-3 items-end"><input type="hidden" name="cid">
    ${F("اسم الشركة", I("name", "required"))}${F("التليفون", I("phone", 'dir="ltr"'))}${F("سعر خاص للمتر المكعب", N("priceM3"))}${F("سعر خاص للرحلة", N("priceTrip"))}${F("ملاحظات", I("notes"))}${SAVEBTN("حفظ الشركة", "co-cancel")}
  </form>
  ${TB(["الشركة", "التليفون", "سعر م³", "سعر الرحلة", "التوريدات", "المدفوع", "المتبقي", "كشف حساب", ""], "co-body")}
  <p class="text-xs text-slate-500">كتابة اسم شركة بصيغة مختلفة (همزة/تاء مربوطة/مسافات) تتوحد تلقائياً مع الشركة الموجودة. تظهر الشركة المتأخرة في الدفع أكثر من ${LATE_DAYS} يوم في إشعارات الرئيسية.</p>
</section>
<section data-xp="biz:sp" class="space-y-4">
  <form id="sp-form" class="card grid sm:grid-cols-4 gap-3 items-end">
    ${F("الشركة", `<select name="companyId" class="inp" required></select>`)}${F("التاريخ", D("date"))}
    ${F("نوع التسعير", `<select name="unit" class="inp"><option value="m3">م³ خرسانة</option><option value="trips">رحلة / نقلة</option></select>`)}${F("المعدة (اختياري)", `<select name="vehicleId" class="inp"></select>`)}
    ${F("المشروع", I("project", 'list="dl-xproj"'))}${F("الكمية", N("qty", "required"))}${F("السعر (مقترح من الشركة)", N("price", "required"))}
    <div><label class="lbl">الإجمالي</label><div id="sp-total" class="font-extrabold py-2.5">0</div></div>
    ${F("ملاحظات", I("notes"), "sm:col-span-3")}${SAVEBTN("تسجيل توريد")}
  </form>
  ${TB(["التاريخ", "الشركة", "المشروع", "المعدة", "الكمية", "السعر", "الإجمالي", ""], "sp-body")}
</section>
<section data-xp="biz:pay" class="space-y-4">
  <form id="pay-form" class="card grid sm:grid-cols-4 gap-3 items-end">
    ${F("الشركة", `<select name="companyId" class="inp" required></select>`)}${F("التاريخ", D("date"))}${F("المبلغ المستلم", N("amount", "required"))}${F("ملاحظات", I("notes"))}${SAVEBTN("تسجيل دفعة")}
  </form>
  ${TB(["التاريخ", "الشركة", "المبلغ", "ملاحظات", "متبقي الشركة", ""], "pay-body")}
</section>
<section data-xp="biz:pf" class="space-y-4"><div id="pf-out" class="space-y-4"></div></section>
<section data-xp="biz:rp" class="space-y-4"><div id="rp-out" class="space-y-4"></div></section>
<datalist id="dl-xproj"></datalist>`);

mk("crew", `
<h2 class="text-xl font-extrabold">السائقين والصيانة</h2>${WARN}
<div class="xtabs flex flex-wrap gap-2 text-sm" data-v="crew"></div>
<section data-xp="crew:dr" class="space-y-4">
  <form id="dr-form" class="card grid sm:grid-cols-3 gap-3 items-end"><input type="hidden" name="did">
    ${F("اسم السائق", I("name", "required"))}${F("التليفون", I("phone", 'dir="ltr"'))}${F("رقم رخصة القيادة", I("licNo", 'dir="ltr"'))}
    ${F("تاريخ انتهاء الرخصة", D("licExp"))}${F("المعدة", `<select name="vehicleId" class="inp"></select>`)}${SAVEBTN("حفظ السائق", "dr-cancel")}
  </form>
  ${TB(["السائق", "التليفون", "رقم الرخصة", "انتهاء الرخصة", "المعدة", ""], "dr-body")}
</section>
<section data-xp="crew:ins" class="space-y-4">
  <div class="card overflow-x-auto"><table class="w-full text-sm text-right whitespace-nowrap"><thead class="text-slate-500 border-b"><tr><th class="py-2">المعدة</th><th>الرخصة</th><th>انتهاء التأمين</th><th>انتهاء الفحص الفني</th></tr></thead><tbody id="ins-body"></tbody></table></div>
  <p class="text-xs text-slate-500">اختيار التاريخ يُحفظ فوراً ويظهر التنبيه في الرئيسية قبل ${SETTINGS.licenseWarnDays} يوم من الانتهاء، بنفس نظام الرخصة.</p>
</section>
<section data-xp="crew:mt" class="space-y-4">
  <form id="mt-form" class="card grid sm:grid-cols-4 gap-3 items-end">
    ${F("المعدة", `<select name="vehicleId" class="inp" required></select>`)}${F("التاريخ", D("date"))}
    ${F("النوع", `<select name="type" class="inp"><option>عطل</option><option>إصلاح</option><option>قطعة غيار</option><option>أخرى</option></select>`)}${F("التكلفة", N("cost"))}
    ${F("الوصف", I("desc", "required"), "sm:col-span-2")}${F("صورة / فاتورة", `<input name="img" type="file" accept="image/*" class="inp">`)}${SAVEBTN("تسجيل")}
  </form>
  <div id="mt-sum" class="grid sm:grid-cols-3 gap-3"></div>
  ${TB(["التاريخ", "المعدة", "النوع", "الوصف", "التكلفة", "صورة", ""], "mt-body")}
</section>`);

mk("acct", `
<h2 class="text-xl font-extrabold">خزينة المحاسب (العهدة)</h2>${WARN}
<div class="card flex flex-wrap items-end gap-3"><div class="flex-1 min-w-[14rem]"><label class="lbl">الفترة</label><select id="ac-sel" class="inp"></select></div><button type="button" id="ac-new" class="btn"><i class="fa-solid fa-plus ml-1"></i>فترة جديدة</button></div>
<form id="ac-form" class="hidden card grid sm:grid-cols-3 gap-3 items-end">
  ${F("المشروع", I("project", 'list="dl-xproj" required'))}${F("محاسب المشروع", I("accountant", "required"))}${F("عهدة مرحّلة (تلقائي من الفترة السابقة)", N("opening"))}
  ${F("من تاريخ", D("from"))}${F("إلى تاريخ", D("to"))}${SAVEBTN("فتح الفترة", "ac-cancel")}
</form>
<div id="ac-main" class="space-y-5"></div>`);

navBtn("biz", "fa-building", "الشركات والتوريدات");
navBtn("acct", "fa-vault", "خزينة المحاسب (العهدة)");
navBtn("crew", "fa-id-badge", "السائقين والصيانة");
Object.assign(PAGES, { biz: "الشركات والتوريدات", acct: "خزينة المحاسب (العهدة)", crew: "السائقين والصيانة" });
Object.assign(NOTIF_TYPES, { late: "مستحقات الشركات", ins: "تأمين / فحص / رخص قيادة" });
Object.assign(BK_COLS, { biz: "الشركات والسائقين والصيانة", acct: "خزينة المحاسب" });
Object.assign(AUD_COLS, { biz: "الشركات والسائقين", acct: "خزينة المحاسب" });
$("#au-col").innerHTML = `<option value="">كل الأقسام</option>` + Object.entries(AUD_COLS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
applyPages();

/* ---------- حاسبة سريعة: اختيار الشركة + عرض سعر ---------- */
(() => {
  const nameCard = $("#q-name").closest(".card");
  const c = document.createElement("div"); c.className = "card grid sm:grid-cols-3 gap-3 items-end";
  c.innerHTML = `${F("الشركة (تُربط بها الحسبة المحفوظة)", `<select id="xq-co" class="inp"></select>`)}<div id="xq-hint" class="text-sm text-slate-600 pb-2"></div><button type="button" id="xq-price" class="btn-dark hidden">أضف بنداً بسعر الشركة</button>`;
  nameCard.after(c);
  const last = $("#q-save").closest(".card");
  last.insertAdjacentHTML("beforeend", `<button type="button" data-export="xquote:docx" class="btn-dark"><i class="fa-solid fa-file-signature ml-1"></i>عرض سعر Word</button><button type="button" data-export="xquote:pdf" class="btn-dark"><i class="fa-solid fa-file-pdf ml-1"></i>عرض سعر PDF</button>`);
  $("#xq-co").onchange = () => {
    const co = byId(K("company"), $("#xq-co").value);
    $("#xq-hint").textContent = co ? `أسعار ${co.name}: ${co.priceM3 != null ? "م³ " + money(co.priceM3) : "—"} · ${co.priceTrip != null ? "رحلة " + money(co.priceTrip) : "—"}` : "";
    $("#xq-price").classList.toggle("hidden", !co || (co.priceM3 == null && co.priceTrip == null));
    if (co && !$("#q-name").value.trim()) $("#q-name").value = co.name;
  };
  $("#xq-price").onclick = () => {
    const co = byId(K("company"), $("#xq-co").value); if (!co) return;
    const isM3 = co.priceM3 != null, row = { name: isM3 ? "خرسانة جاهزة" : "نقلة", unit: isM3 ? "م³" : "رحلة", qty: "", price: isM3 ? co.priceM3 : co.priceTrip };
    const e = qLines.findIndex(l => !l.name && !l.qty && !l.price); e >= 0 ? qLines[e] = row : qLines.push(row); renderQuickLines();
  };
})();
EXPORTS.xquote = () => {
  const co = byId(K("company"), $("#xq-co").value), i = readQuick(), r = quickCalc(i), used = i.lines.filter(l => l.name || l.qty || l.price);
  return {
    file: `عرض-سعر-${co ? co.name : "عميل"}`, title: `عرض سعر${co ? " — " + co.name : ""}`, sections: [
      { title: `بتاريخ ${today()}`, head: ["البند", "الوحدة", "الكمية", "سعر الوحدة", "الإجمالي"], rows: used.map(l => ({ "البند": l.name, "الوحدة": l.unit, "الكمية": qQty(l) || "", "سعر الوحدة": qPrice(l) || "", "الإجمالي": r2(qSub(l)) })) },
      { title: "الإجمالي", head: ["البند", "القيمة"], rows: [{ "البند": "المجموع", "القيمة": r2(r.sub) }, ...(i.pct ? [{ "البند": `إضافة ${i.pct}%`, "القيمة": r2(r.extra) }] : []), { "البند": "الإجمالي النهائي", "القيمة": r2(r.total) }, ...(r.perUnit != null ? [{ "البند": `السعر لكل ${i.divUnit || "وحدة"}`, "القيمة": r2(r.perUnit) }] : [])] }],
    footer: `<p>العرض ساري لمدة 7 أيام من تاريخه.</p>${SIG}`
  };
};

/* ---------- عرض الشركات ---------- */
function renderBiz() {
  const cos = K("company").sort((a, b) => a.name.localeCompare(b.name, "ar"));
  $("#co-body").innerHTML = cos.map(c => {
    const st = coStat(c.id), late = st.bal > 0 && st.age > LATE_DAYS;
    return `<tr class="border-b last:border-0"><td class="py-2 font-bold">${esc(c.name)}${late ? ` <span class="text-[11px] bg-red-100 text-red-700 rounded-full px-2">متأخرة ${st.age} يوم</span>` : ""}</td><td dir="ltr" class="text-right">${esc(c.phone || "")}</td>
    <td>${c.priceM3 != null ? money(c.priceM3) : "—"}</td><td>${c.priceTrip != null ? money(c.priceTrip) : "—"}</td><td>${money(st.sup)}</td><td>${money(st.paid)}</td>
    <td class="font-extrabold ${st.bal > 0 ? "text-red-600" : "text-green-700"}">${money(st.bal)}</td>
    <td><div class="flex gap-2 font-bold text-xs">${["xlsx:Excel:text-green-700", "docx:Word:text-blue-700", "pdf:PDF:text-red-700", "print:طباعة:text-slate-700"].map(x => { const [k, l, cl] = x.split(":"); return `<button type="button" data-export="costmt:${k}:${esc(c.id)}" class="${cl}">${l}</button>`; }).join("")}</div></td>
    <td><div class="flex gap-3"><button type="button" data-co-edit="${esc(c.id)}" class="text-orange-600" aria-label="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>${delBtn("co-del", c.id)}</div></td></tr>`;
  }).join("") || none(9, "لا توجد شركات بعد. أضف أول شركة من النموذج.");
  const sp = K("supply").sort(byDate).reverse();
  $("#sp-body").innerHTML = sp.slice(0, 200).map(x => `<tr class="border-b last:border-0"><td class="py-2">${esc(x.date)}</td><td class="font-bold">${esc(coName(x.companyId))}</td><td>${esc(x.project || "")}</td><td>${esc(x.vehicleNo || "")}</td><td>${fmt(x.qty)} ${esc(unitLabel(x.unit))}</td><td>${money(x.price)}</td><td class="font-bold">${money(x.total)}</td><td>${delBtn("sp-del", x.id)}</td></tr>`).join("") || none(8);
  $("#pay-body").innerHTML = K("payment").sort(byDate).reverse().slice(0, 200).map(x => `<tr class="border-b last:border-0"><td class="py-2">${esc(x.date)}</td><td class="font-bold">${esc(coName(x.companyId))}</td><td class="text-green-700 font-bold">${money(x.amount)}</td><td>${esc(x.notes || "")}</td><td>${money(coStat(x.companyId).bal)}</td><td>${delBtn("pay-del", x.id)}</td></tr>`).join("") || none(6);
  renderPf(); renderRp();
}
function profitData() {
  const sp = K("supply");
  const eq = activeVehicles().map(v => { const rev = sum(sp.filter(x => x.vehicleId === v.id), x => x.total), cost = sum(expenses.filter(e => e.vehicleId === v.id), e => e.amount); return { name: `${v.number} - ${v.type}`, rev, cost, pr: rev - cost }; }).sort((a, b) => b.pr - a.pr);
  const m = {}; const g = n => (m[normAr(n) || "_"] ||= { name: n || "بدون مشروع", rev: 0, cost: 0 });
  sp.forEach(x => { g(cleanName(x.project)).rev += +x.total || 0; });
  expenses.forEach(e => { g(cleanName(e.project)).cost += +e.amount || 0; });
  const pj = Object.values(m).filter(p => p.rev || p.cost).map(p => ({ ...p, pr: p.rev - p.cost })).sort((a, b) => b.pr - a.pr);
  return { eq, pj };
}
function renderPf() {
  const { eq, pj } = profitData();
  const tbl = (t, rows) => `<div class="card overflow-x-auto"><div class="font-extrabold mb-2">${t}</div><table class="w-full text-sm text-right whitespace-nowrap"><thead class="text-slate-500 border-b"><tr><th class="py-2">الاسم</th><th>الإيراد</th><th>المصروفات</th><th>الربح / الخسارة</th></tr></thead><tbody>${rows.map(r => `<tr class="border-b last:border-0"><td class="py-2 font-bold">${esc(r.name)}</td><td>${money(r.rev)}</td><td>${money(r.cost)}</td><td class="font-extrabold ${r.pr >= 0 ? "text-green-700" : "text-red-600"}">${money(r.pr)}</td></tr>`).join("") || none(4)}</tbody></table></div>`;
  $("#pf-out").innerHTML = `<div class="flex gap-2 text-sm">${exportBtns("xprofit:#")}</div>${tbl("أرباح كل معدة (التوريدات المسجلة عليها − مصروفاتها)", eq)}${tbl("أرباح كل مشروع (التوريدات − مصروفات المعدات)", pj)}<p class="text-xs text-slate-500">الإيراد يُحسب من «التوريدات» ويحتاج تحديد المعدة والمشروع عند التسجيل ليظهر هنا.</p>`;
}
EXPORTS.xprofit = () => { const { eq, pj } = profitData(), f = r => ({ "الاسم": r.name, "الإيراد": r2(r.rev), "المصروفات": r2(r.cost), "الربح": r2(r.pr) }); return { file: "الأرباح", title: "أرباح المعدات والمشاريع", sections: [{ title: "المعدات", rows: eq.map(f) }, { title: "المشاريع", rows: pj.map(f) }] }; };
EXPORTS.costmt = id => {
  const c = byId(K("company"), id); if (!c) return; const st = coStat(id);
  return {
    file: `كشف-حساب-${c.name}`, title: `كشف حساب شركة ${c.name}`, sections: [
      { title: "الملخص", head: ["البند", "القيمة"], rows: [{ "البند": "إجمالي ما تم توريده", "القيمة": money(st.sup) }, { "البند": "إجمالي المدفوع", "القيمة": money(st.paid) }, { "البند": "المتبقي على الشركة", "القيمة": money(st.bal) }] },
      { title: "التوريدات", rows: st.s.map(x => ({ "التاريخ": x.date, "المشروع": x.project || "", "المعدة": x.vehicleNo || "", "الكمية": `${fmt(x.qty)} ${unitLabel(x.unit)}`, "السعر": x.price, "الإجمالي": x.total })) },
      { title: "الدفعات", rows: st.p.map(x => ({ "التاريخ": x.date, "المبلغ": x.amount, "ملاحظات": x.notes || "" })) }], footer: SIG
  };
};

/* ---------- تقارير: أسبوعي + مقارنة الشهور ---------- */
const inR = (d, a, b) => (d || "") >= a && (d || "") <= b;
const monthKey = off => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
function weekData() {
  const a = dayStr(-6), b = today(), ex = expenses.filter(e => inR(e.date, a, b)), by = {};
  ex.forEach(e => { const k = catName(e.category); by[k] = (by[k] || 0) + (+e.amount || 0); });
  const sp = K("supply").filter(x => inR(x.date, a, b)), pay = K("payment").filter(x => inR(x.date, a, b)), ops = operations.filter(o => inR(o.date, a, b));
  const dues = K("company").map(c => ({ c, st: coStat(c.id) })).filter(x => x.st.bal > 0);
  return { a, b, ex, by, sp, pay, ops, dues, al: buildNotifs() };
}
EXPORTS.xweek = () => {
  const w = weekData();
  return {
    file: "التقرير-الأسبوعي", title: `التقرير الأسبوعي (${w.a} إلى ${w.b})`, sections: [
      { title: "الملخص", head: ["البند", "القيمة"], rows: [{ "البند": "مصروفات الأسبوع", "القيمة": money(sum(w.ex, e => e.amount)) }, { "البند": "رحلات / تشغيل مسجّل", "القيمة": w.ops.length }, { "البند": "توريدات للشركات", "القيمة": money(sum(w.sp, x => x.total)) }, { "البند": "دفعات مستلمة", "القيمة": money(sum(w.pay, x => x.amount)) }, { "البند": "عدد التنبيهات", "القيمة": w.al.length }] },
      { title: "المصروفات حسب النوع", head: ["النوع", "المبلغ"], rows: Object.entries(w.by).map(([k, v]) => ({ "النوع": k, "المبلغ": money(v) })) },
      { title: "مستحقات الشركات", head: ["الشركة", "المتبقي"], rows: w.dues.map(x => ({ "الشركة": x.c.name, "المتبقي": money(x.st.bal) })) },
      { title: "التنبيهات", head: ["البند", "التفاصيل"], rows: w.al.map(n => ({ "البند": n.title, "التفاصيل": n.text })) }]
  };
};
const weekText = () => { const w = weekData(); return [`*التقرير الأسبوعي — شركة فوزي عبده*`, `${w.a} إلى ${w.b}`, `المصروفات: ${money(sum(w.ex, e => e.amount))}`, ...Object.entries(w.by).map(([k, v]) => `  • ${k}: ${money(v)}`), `رحلات/تشغيل: ${w.ops.length}`, `توريدات: ${money(sum(w.sp, x => x.total))} · دفعات: ${money(sum(w.pay, x => x.amount))}`, ...(w.dues.length ? ["مستحقات الشركات:", ...w.dues.map(x => `  • ${x.c.name}: ${money(x.st.bal)}`)] : []), `التنبيهات: ${w.al.length}`, ...w.al.slice(0, 8).map(n => `  ⚠ ${n.title}: ${n.text}`)].join("\n"); };
function monthRows() {
  const m0 = monthKey(0), m1 = monthKey(-1), g = (arr, f, m) => sum(arr.filter(x => (x.date || "").startsWith(m)), f);
  return [["المصروفات", expenses, e => e.amount], ["التوريدات (الإيراد)", K("supply"), x => x.total], ["الدفعات المستلمة", K("payment"), x => x.amount]].map(([n, arr, f]) => { const a = g(arr, f, m0), b = g(arr, f, m1); return { "البند": n, "الشهر السابق": r2(b), "هذا الشهر": r2(a), "الفرق": r2(a - b), "النسبة": b ? Math.round((a - b) / b * 100) + "%" : "—" }; });
}
EXPORTS.xmonth = () => ({ file: "مقارنة-الشهور", title: `مقارنة ${monthKey(-1)} مع ${monthKey(0)}`, sections: [{ title: "المقارنة", rows: monthRows() }] });
function renderRp() {
  $("#rp-out").innerHTML = `<div class="card space-y-3"><div class="font-extrabold">التقرير الأسبوعي الجاهز</div><div class="flex flex-wrap gap-2 text-sm">${exportBtns("xweek:#")}<button type="button" id="wk-wa" class="btn !px-3 !py-1.5"><i class="fa-brands fa-whatsapp ml-1"></i>إرسال واتساب</button></div></div>
  <div class="card overflow-x-auto"><div class="flex justify-between flex-wrap gap-2 mb-2"><div class="font-extrabold">مقارنة الشهر الحالي بالسابق</div><div class="flex gap-2 text-sm">${exportBtns("xmonth:#")}</div></div>
  <table class="w-full text-sm text-right whitespace-nowrap"><thead class="text-slate-500 border-b"><tr><th class="py-2">البند</th><th>الشهر السابق</th><th>هذا الشهر</th><th>الفرق</th><th>النسبة</th></tr></thead><tbody>${monthRows().map(r => `<tr class="border-b last:border-0"><td class="py-2 font-bold">${r["البند"]}</td><td>${money(r["الشهر السابق"])}</td><td>${money(r["هذا الشهر"])}</td><td class="font-bold">${money(r["الفرق"])}</td><td>${r["النسبة"]}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ---------- السائقين والصيانة ---------- */
function renderCrew() {
  $("#dr-body").innerHTML = K("driver").sort((a, b) => a.name.localeCompare(b.name, "ar")).map(d => `<tr class="border-b last:border-0"><td class="py-2 font-bold">${esc(d.name)}</td><td dir="ltr" class="text-right">${esc(d.phone || "")}</td><td dir="ltr" class="text-right">${esc(d.licNo || "")}</td>
    <td class="${tone(d.licExp)}">${d.licExp ? `${esc(d.licExp)} (${when(d.licExp)})` : "—"}</td><td>${esc(d.vehicleNo || "—")}</td><td><div class="flex gap-3"><button type="button" data-dr-edit="${esc(d.id)}" class="text-orange-600"><i class="fa-solid fa-pen-to-square"></i></button>${delBtn("dr-del", d.id)}</div></td></tr>`).join("") || none(6, "لا يوجد سائقون مسجلون.");
  $("#ins-body").innerHTML = activeVehicles().map(v => `<tr class="border-b last:border-0"><td class="py-2 font-bold">${esc(v.number)} - ${esc(v.type)}</td><td class="${tone(v.licenseExpiry)}">${v.licenseExpiry ? when(v.licenseExpiry) : "—"}</td>
    ${["insuranceExpiry", "inspectionExpiry"].map(f => `<td><input type="date" data-vf="${f}" data-vid="${esc(v.id)}" value="${esc(v[f] || "")}" class="inp !w-44 !py-1.5"> <span class="text-xs ${tone(v[f])}">${v[f] ? when(v[f]) : ""}</span></td>`).join("")}</tr>`).join("") || none(4);
  const mt = K("maint").sort(byDate).reverse();
  $("#mt-body").innerHTML = mt.slice(0, 200).map(x => `<tr class="border-b last:border-0"><td class="py-2">${esc(x.date)}</td><td class="font-bold">${esc(x.vehicleNo || "")}</td><td>${esc(x.type)}</td><td>${esc(x.desc)}</td><td>${x.cost ? money(x.cost) : "—"}</td><td>${x.img ? `<a href="${esc(x.img)}" target="_blank" rel="noopener" class="text-blue-700 font-bold">عرض</a>` : ""}</td><td>${delBtn("mt-del", x.id)}</td></tr>`).join("") || none(7);
  const by = {}; mt.forEach(x => { by[x.vehicleNo] = (by[x.vehicleNo] || 0) + (+x.cost || 0); });
  $("#mt-sum").innerHTML = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => kpi("fa-screwdriver-wrench", `صيانة ${esc(k)}`, money(v))).join("");
}

/* ---------- خزينة المحاسب ---------- */
const sTot = s => sum(s.items || [], i => i.amount);
const pExp = p => sum(p.sheets || [], sTot);
const pInc = p => (+p.opening || 0) + sum(p.incoming || [], i => i.amount);
const pRem = p => pInc(p) - pExp(p);
const curPeriod = () => byId(acct, curP) || [...acct].sort((a, b) => (b.from || "").localeCompare(a.from || ""))[0];
const knownProjects = () => [...new Set([...acct.map(p => p.project), ...projects()])].filter(Boolean);
const guardClosed = (p, s, txt) => { if (p.status === "closed" || (s && s.status === "closed")) { if (!confirm(`${p.status === "closed" ? "الفترة" : "الكشف"} مقفول. التعديل سيُسجَّل في السجل. متابعة؟`)) return false; logP(p, `${s ? s.name + ": " : ""}${txt}`); } return true; };
function renderAcct() {
  const list = [...acct].sort((a, b) => (b.from || "").localeCompare(a.from || "")), p = curPeriod(); if (p) curP = p.id;
  keep($("#ac-sel"), opts(list, x => x.id, x => `${x.project} · ${x.from} → ${x.to}${x.status === "closed" ? " (مقفولة)" : ""}`)); $("#ac-sel").value = curP;
  const box = $("#ac-main");
  if (!p) { box.innerHTML = `<div class="card text-slate-500">لا توجد فترات بعد. اضغط «فترة جديدة» لفتح عهدة مشروع، وتتولّد الكشوف الـ11 تلقائياً.</div>`; return; }
  const inc = pInc(p), ex = pExp(p), rem = inc - ex, closed = p.status === "closed";
  const al = [];
  (p.sheets || []).forEach(s => { if (s.status !== "closed" && (s.items || []).length) { const a = age(s.items.map(i => i.date).sort()[0]); if (a > STALE_DAYS) al.push(`${s.name}: مفتوح من ${a} يوم`); } });
  if (rem < 0) al.push(`المصروف أكبر من الوارد بمقدار ${money(-rem)}`); else if (inc > 0 && rem < inc * 0.1) al.push(`المتبقي قرب يخلص: ${money(rem)}`);
  const lastPrice = [...acct.flatMap(x => x.incoming || [])].filter(i => i.type === "sales" && i.price).sort((a, b) => (a.date || "").localeCompare(b.date || "")).pop();
  const s = (p.sheets || []).find(x => x.id === curS);
  box.innerHTML = `
  <div class="card flex flex-wrap items-center justify-between gap-3"><div><div class="text-xs text-slate-500">محاسب المشروع</div><div class="font-extrabold text-lg">${esc(p.accountant)} / ${esc(p.project)}</div>
    <div class="text-sm text-slate-500">من ${esc(p.from)} إلى ${esc(p.to)} · ${closed ? `فترة مقفولة (${p.handed ? "سُلِّم المتبقي للمدير" : "رُحِّل المتبقي للفترة التالية"})` : "فترة مفتوحة"}</div></div>
    <div class="flex flex-wrap gap-2 text-sm">${exportBtns(`acct:#:${p.id}`)}${closed ? `<button type="button" data-a-preopen class="btn-dark !px-3 !py-1.5">إعادة فتح</button>` : `<button type="button" data-a-pclose class="btn !px-3 !py-1.5">تسوية وقفل الفترة</button>`}<button type="button" data-a-pdel class="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 font-bold">حذف</button></div></div>
  <div class="grid sm:grid-cols-3 gap-4">${kpi("fa-arrow-down", "إجمالي الوارد", money(inc))}${kpi("fa-arrow-up", "إجمالي المنصرف", money(ex))}${kpi("fa-wallet", "المتبقي", money(rem), rem < 0)}</div>
  ${al.length ? `<div class="card space-y-2">${al.map(t => `<div class="p-3 rounded-xl bg-orange-50 text-orange-700 text-sm"><i class="fa-solid fa-triangle-exclamation ml-2"></i>${esc(t)}</div>`).join("")}</div>` : ""}
  <div class="card space-y-3"><div class="font-extrabold">الوارد</div>
    <form data-aform="inc" class="grid sm:grid-cols-6 gap-2 items-end">
      ${F("التاريخ", D("date").replace("<input", `<input value="${today()}"`))}${F("النوع", `<select name="type" class="inp"><option value="custody">عهدة مستلمة</option><option value="sales">مبيعات خرسانة</option><option value="other">أخرى</option></select>`)}
      ${F("البيان", I("desc"), "sm:col-span-2")}${F("الكمية (م³)", N("qty"))}${F("سعر المتر", N("price", lastPrice ? `value="${lastPrice.price}"` : ""))}${F("المبلغ (يُحسب للمبيعات)", N("amount"))}<div class="sm:col-span-2"><button class="btn w-full">إضافة وارد</button></div>
    </form>
    <div class="overflow-x-auto"><table class="w-full text-sm text-right whitespace-nowrap"><thead class="text-slate-500 border-b"><tr><th class="py-2">التاريخ</th><th>البيان</th><th>الوارد</th><th></th></tr></thead><tbody>
      <tr class="border-b bg-yellow-50"><td class="py-2">${esc(p.from)}</td><td class="font-bold">عهدة مرحّلة</td><td>${money(p.opening || 0)}</td><td><button type="button" data-a-opening class="text-orange-600 text-xs font-bold">تعديل</button></td></tr>
      ${(p.incoming || []).map(i => `<tr class="border-b last:border-0 bg-yellow-50"><td class="py-2">${esc(i.date)}</td><td>${esc(i.desc)}</td><td>${money(i.amount)}</td><td>${delBtn("a-incdel", i.id)}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card overflow-x-auto"><div class="flex justify-between items-center mb-2"><div class="font-extrabold">الكشوف</div><button type="button" data-a-newsheet class="text-sm font-bold text-orange-600"><i class="fa-solid fa-plus ml-1"></i>كشف جديد</button></div>
    <table class="w-full text-sm text-right whitespace-nowrap"><thead class="text-slate-500 border-b"><tr><th class="py-2">الكشف</th><th>الحالة</th><th>رقم التسوية</th><th>المنصرف</th><th>نسبته</th></tr></thead><tbody>
    ${(p.sheets || []).map(x => `<tr class="border-b last:border-0 cursor-pointer ${x.id === curS ? "bg-orange-50" : ""}" data-a-sheet="${esc(x.id)}"><td class="py-2 font-bold text-blue-700 underline">${esc(x.name)}</td><td>${x.status === "closed" ? '<span class="text-green-600 text-lg font-black">✓</span>' : '<span class="text-red-600 text-lg font-black">✗</span>'}</td><td>${x.settleNo || 0}</td><td>${money(sTot(x))}</td><td>${ex ? Math.round(sTot(x) / ex * 100) : 0}%</td></tr>`).join("")}</tbody></table></div>
  ${s ? sheetCard(p, s) : ""}`;
}
function sheetCard(p, s) {
  const cl = s.status === "closed", logs = (p.log || []).filter(l => l.txt.startsWith(s.name + ":")).slice(-5).reverse();
  return `<div class="card space-y-3" id="ac-sheet"><div class="flex flex-wrap items-center justify-between gap-2"><div class="font-extrabold">${esc(s.name)} ${cl ? '<span class="text-green-600">✓ مقفول · تسوية ' + (s.settleNo || 0) + "</span>" : '<span class="text-red-600">✗ مفتوح</span>'}</div>
    <div class="flex flex-wrap gap-2 text-sm"><button type="button" data-a-sclose class="btn !px-3 !py-1.5">${cl ? "إعادة فتح الكشف" : "قفل الكشف وتوليد رقم التسوية"}</button><button type="button" data-export="acsheet:print:${esc(p.id)}~${esc(s.id)}" class="btn-dark !px-3 !py-1.5">طباعة للتوقيع</button><button type="button" data-export="acsheet:xlsx:${esc(p.id)}~${esc(s.id)}" class="btn-dark !px-3 !py-1.5">Excel</button>
    <button type="button" data-a-rename class="btn-dark !px-3 !py-1.5">تسمية</button>${(s.items || []).length ? "" : `<button type="button" data-a-sdel class="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 font-bold">حذف الكشف</button>`}</div></div>
  <form data-aform="item" class="grid sm:grid-cols-5 gap-2 items-end">${F("التاريخ", D("date").replace("<input", `<input value="${today()}"`))}${F("البيان", I("desc", "required"), "sm:col-span-2")}${F("المبلغ", N("amount", "required"))}${F("صورة الفاتورة", `<input name="img" type="file" accept="image/*" class="inp">`)}<div class="sm:col-span-5 flex flex-wrap gap-3 items-center"><button class="btn">إضافة بند</button><label class="text-sm font-bold text-blue-700 cursor-pointer"><i class="fa-solid fa-file-import ml-1"></i>استيراد من Excel (تاريخ / بيان / مبلغ)<input type="file" accept=".xlsx,.xls,.csv" data-a-import class="hidden"></label></div></form>
  <div class="overflow-x-auto"><table class="w-full text-sm text-right whitespace-nowrap"><thead class="text-slate-500 border-b"><tr><th class="py-2">التاريخ</th><th>البيان</th><th>المبلغ</th><th>صورة</th><th></th></tr></thead><tbody>
    ${[...(s.items || [])].sort(byDate).map(i => `<tr class="border-b last:border-0"><td class="py-2">${esc(i.date)}</td><td>${esc(i.desc)}</td><td class="font-bold">${money(i.amount)}</td><td>${i.img ? `<a href="${esc(i.img)}" target="_blank" rel="noopener" class="text-blue-700 font-bold">عرض</a>` : ""}</td><td>${delBtn("a-itemdel", i.id)}</td></tr>`).join("") || none(5, "لا توجد بنود.")}
    <tr class="font-extrabold"><td class="py-2" colspan="2">الإجمالي</td><td colspan="3">${money(sTot(s))}</td></tr></tbody></table></div>
  ${logs.length ? `<div class="text-xs text-slate-500 space-y-1"><div class="font-bold">سجل التعديلات بعد القفل</div>${logs.map(l => `<div>${esc(l.day)} · ${esc(l.user)} · ${esc(l.txt)}</div>`).join("")}</div>` : ""}</div>`;
}
EXPORTS.acct = id => {
  const p = byId(acct, id); if (!p) return; let run = +p.opening || 0, n = 1;
  const rows = [{ "م": n++, "التاريخ": p.from, "الوارد": +p.opening || 0, "المنصرف": "", "المتبقي": run, "البيان": "عهدة مرحّلة", "رقم التسوية": "" }];
  [...(p.incoming || [])].sort(byDate).forEach(i => { run += +i.amount || 0; rows.push({ "م": n++, "التاريخ": i.date, "الوارد": +i.amount || 0, "المنصرف": "", "المتبقي": run, "البيان": i.desc, "رقم التسوية": "" }); });
  (p.sheets || []).forEach(s => { run -= sTot(s); rows.push({ "م": n++, "التاريخ": s.closedAt || "", "الوارد": "", "المنصرف": sTot(s), "المتبقي": run, "البيان": `${s.name} ${s.status === "closed" ? "✓" : "✗"}`, "رقم التسوية": s.settleNo || 0 }); });
  rows.push({ "م": "", "التاريخ": "", "الوارد": pInc(p), "المنصرف": pExp(p), "المتبقي": pRem(p), "البيان": "الإجماليات", "رقم التسوية": "" });
  return { file: `خزينة-${p.project}`, title: `محاسب المشروع / ${p.accountant} — ${p.project} (${p.from} → ${p.to})`, sections: [{ title: "خزينة إجمالية", head: ["م", "التاريخ", "الوارد", "المنصرف", "المتبقي", "البيان", "رقم التسوية"], rows }], footer: SIG };
};
EXPORTS.acsheet = arg => {
  const [pid, sid] = arg.split("~"), p = byId(acct, pid), s = p && (p.sheets || []).find(x => x.id === sid); if (!s) return;
  return { file: `${s.name}-${p.project}`, title: `${s.name} — ${p.project}`, sections: [{ title: `المحاسب: ${p.accountant} · ${p.from} → ${p.to} · رقم التسوية ${s.settleNo || 0} · ${s.status === "closed" ? "مقفول" : "مفتوح"}`, head: ["م", "التاريخ", "البيان", "المبلغ"], rows: [...(s.items || [])].sort(byDate).map((i, k) => ({ "م": k + 1, "التاريخ": i.date, "البيان": i.desc, "المبلغ": i.amount })), note: `الإجمالي: ${money(sTot(s))}` }], footer: SIG };
};

/* ---------- قوائم الاختيار ---------- */
function fillSelects() {
  const cos = K("company").sort((a, b) => a.name.localeCompare(b.name, "ar")), co = x => x.name, vo = `<option value="">— بدون —</option>` + activeVehicles().map(v => `<option value="${esc(v.id)}">${esc(v.number)} - ${esc(v.type)}</option>`).join("");
  ["#sp-form", "#pay-form"].forEach(f => keep($(f).elements.companyId, opts(cos, c => c.id, co, "اختر الشركة")));
  keep($("#xq-co"), opts(cos, c => c.id, co, "— بدون شركة —"));
  keep($("#sp-form").elements.vehicleId, vo); keep($("#dr-form").elements.vehicleId, vo);
  keep($("#mt-form").elements.vehicleId, `<option value="">اختر المعدة</option>` + activeVehicles().map(v => `<option value="${esc(v.id)}">${esc(v.number)} - ${esc(v.type)}</option>`).join(""));
  $("#dl-xproj").innerHTML = knownProjects().map(x => `<option value="${esc(x)}"></option>`).join("");
}
function renderTabs(v) {
  $(`.xtabs[data-v="${v}"]`).innerHTML = TABS[v].map(([k, l]) => `<button type="button" data-xt="${v}:${k}" class="px-4 py-1.5 rounded-full font-bold ${tabs[v] === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}">${l}</button>`).join("");
  $$(`[data-xp^="${v}:"]`).forEach(s => s.classList.toggle("hidden", s.dataset.xp !== `${v}:${tabs[v]}`));
}
function renderAll() {
  const warn = col => modErr[col] === "perm" ? `لا توجد صلاحية لمجموعة «${col}» في Firestore. أضف لها قواعد الصلاحيات (مثل باقي المجموعات) من Firebase Console ← Firestore ← Rules ثم حدّث الصفحة.` : modErr[col] ? `تعذر تحميل بيانات هذه الوحدة (${col}). تأكد من الاتصال ثم حدّث الصفحة.` : "";
  [["biz", "biz"], ["crew", "biz"], ["acct", "acct"]].forEach(([v, c]) => { const el = $(`#view-${v} .xwarn`), t = warn(c); el.textContent = t; el.classList.toggle("hidden", !t); });
  [fillSelects, () => { renderTabs("biz"); renderTabs("crew"); }, renderBiz, renderCrew, renderAcct].forEach(fn => { try { fn(); } catch (e) { console.error(fn.name, e); } });
}

/* ---------- النماذج ---------- */
const sp = $("#sp-form"), spTotal = () => { $("#sp-total").textContent = money((+sp.qty.value || 0) * (+sp.price.value || 0)); };
const suggest = () => { const c = byId(K("company"), sp.companyId.value); if (c) { const p = sp.unit.value === "trips" ? c.priceTrip : c.priceM3; if (p != null && (!sp.price.value || sp.price.dataset.auto === "1")) { sp.price.value = p; sp.price.dataset.auto = "1"; } } spTotal(); };
sp.companyId.onchange = sp.unit.onchange = () => { sp.price.dataset.auto = "1"; sp.price.value = ""; suggest(); };
sp.qty.oninput = spTotal; sp.price.oninput = () => { sp.price.dataset.auto = "0"; spTotal(); };
sp.date.value = $("#pay-form").date.value = today();
const clearEdit = (f, cancel) => { f.reset(); f.querySelector("input[type=hidden]").value = ""; $("#" + cancel).classList.add("hidden"); };
$("#co-cancel").onclick = () => clearEdit($("#co-form"), "co-cancel");
$("#dr-cancel").onclick = () => clearEdit($("#dr-form"), "dr-cancel");

$("#co-form").addEventListener("submit", async ev => {
  ev.preventDefault(); const f = fd(ev.target), cos = K("company"), name = smartName(f.name, cos.map(c => c.name)); if (!name) return;
  const id = f.cid || (cos.find(c => normAr(c.name) === normAr(name)) || {}).id;
  const d = { kind: "company", name, phone: cleanName(f.phone), priceM3: toNum(f.priceM3), priceTrip: toNum(f.priceTrip), notes: cleanName(f.notes) }; if (!id) d.createdAt = Date.now();
  await sv("biz", d, id); clearEdit(ev.target, "co-cancel");
});
sp.addEventListener("submit", async ev => {
  ev.preventDefault(); const f = fd(sp), qty = toNum(f.qty), price = toNum(f.price), c = byId(K("company"), f.companyId), v = byId(vehicles, f.vehicleId);
  if (!c || !qty || qty <= 0 || price == null) return alert("اختر الشركة واكتب الكمية والسعر.");
  const total = r2(qty * price);
  await sv("biz", { kind: "supply", name: `${c.name} ${total}`, companyId: c.id, date: f.date || today(), project: smartName(f.project, knownProjects()), vehicleId: v ? v.id : "", vehicleNo: v ? v.number : "", unit: f.unit, qty, price, total, notes: cleanName(f.notes), createdAt: Date.now() });
  sp.qty.value = ""; sp.price.value = ""; sp.notes.value = ""; spTotal();
});
$("#pay-form").addEventListener("submit", async ev => {
  ev.preventDefault(); const f = fd(ev.target), amount = toNum(f.amount), c = byId(K("company"), f.companyId); if (!c || !amount || amount <= 0) return alert("اختر الشركة واكتب مبلغاً صحيحاً.");
  await sv("biz", { kind: "payment", name: `${c.name} ${amount}`, companyId: c.id, date: f.date || today(), amount, notes: cleanName(f.notes), createdAt: Date.now() }); ev.target.amount.value = ""; ev.target.notes.value = "";
});
$("#dr-form").addEventListener("submit", async ev => {
  ev.preventDefault(); const f = fd(ev.target), drs = K("driver"), name = smartName(f.name, drs.map(d => d.name)), v = byId(vehicles, f.vehicleId);
  const id = f.did || (drs.find(d => normAr(d.name) === normAr(name)) || {}).id;
  const d = { kind: "driver", name, phone: cleanName(f.phone), licNo: cleanName(f.licNo), licExp: f.licExp || "", vehicleId: v ? v.id : "", vehicleNo: v ? v.number : "" }; if (!id) d.createdAt = Date.now();
  await sv("biz", d, id); clearEdit(ev.target, "dr-cancel");
});
$("#mt-form").addEventListener("submit", async ev => {
  ev.preventDefault(); const f = fd(ev.target), v = byId(vehicles, f.vehicleId); if (!v) return;
  const btn = ev.target.querySelector("button.btn"); btn.disabled = true;
  try { const img = await upl(f.img); await sv("biz", { kind: "maint", name: `${v.number} ${cleanName(f.desc)}`, vehicleId: v.id, vehicleNo: v.number, date: f.date || today(), type: f.type, desc: cleanName(f.desc), cost: toNum(f.cost) || 0, img, createdAt: Date.now() }); ev.target.desc.value = ""; ev.target.cost.value = ""; ev.target.img.value = ""; }
  catch (e) { dbErr(e); }
  btn.disabled = false;
});
$("#ac-new").onclick = () => { const f = $("#ac-form"); f.classList.toggle("hidden"); f.from.value ||= today(); f.to.value ||= dayStr(10); };
$("#ac-cancel").onclick = () => $("#ac-form").classList.add("hidden");
$("#ac-sel").onchange = () => { curP = $("#ac-sel").value; curS = ""; renderAcct(); };
$("#ac-form").addEventListener("change", ev => {                    // ترحيل تلقائي لمتبقي الفترة السابقة لنفس المشروع
  if (ev.target.name !== "project") return;
  const prev = acct.filter(p => normAr(p.project) === normAr(ev.target.value)).sort((a, b) => (b.to || "").localeCompare(a.to || ""))[0];
  if (prev && !prev.handed) $("#ac-form").opening.value = pRem(prev);
});
$("#ac-form").addEventListener("submit", async ev => {
  ev.preventDefault(); const f = fd(ev.target); if (f.to < f.from) return alert("تاريخ النهاية قبل البداية.");
  const id = await sv("acct", { project: smartName(f.project, knownProjects()), accountant: cleanName(f.accountant), from: f.from, to: f.to, opening: toNum(f.opening) || 0, status: "open", handed: false, incoming: [], log: [], createdAt: Date.now(),
    sheets: DEF_SHEETS.map(n => ({ id: uid(), name: n, status: "open", settleNo: 0, items: [] })) });
  if (id) { curP = id; curS = ""; ev.target.reset(); ev.target.classList.add("hidden"); renderAcct(); }
});

/* نماذج داخل خزينة المحاسب (وارد / بند) */
$("#ac-main").addEventListener("submit", async ev => {
  const form = ev.target.closest("[data-aform]"); if (!form) return; ev.preventDefault();
  const p = byId(acct, curP); if (!p) return; const f = fd(form);
  if (form.dataset.aform === "inc") {
    const qty = toNum(f.qty), price = toNum(f.price); let amount = toNum(f.amount), desc = cleanName(f.desc);
    if (f.type === "sales" && qty && price) { amount = r2(qty * price); desc ||= `بيع ${fmt(qty)} متر خرسانة بسعر ${fmt(price)} للمتر`; }
    if (!amount || amount <= 0) return alert("اكتب المبلغ، أو الكمية وسعر المتر للمبيعات.");
    if (!guardClosed(p, null, `إضافة وارد ${amount}`)) return;
    (p.incoming ||= []).push({ id: uid(), date: f.date || today(), type: f.type, desc: desc || "عهدة مستلمة", qty: qty || null, price: price || null, amount });
  } else {
    const s = (p.sheets || []).find(x => x.id === curS), amount = toNum(f.amount); if (!s || !amount || amount <= 0) return;
    if (!guardClosed(p, s, `إضافة بند ${amount}`)) return;
    const btn = form.querySelector("button.btn"); btn.disabled = true;
    try { (s.items ||= []).push({ id: uid(), date: f.date || today(), desc: cleanName(f.desc), amount, img: await upl(f.img) }); } catch (e) { btn.disabled = false; return dbErr(e); }
  }
  await savePeriod(p);
});
$("#ac-main").addEventListener("change", async ev => {                 // استيراد بنود من Excel
  if (!ev.target.matches("[data-a-import]")) return;
  const p = byId(acct, curP), s = p && (p.sheets || []).find(x => x.id === curS), file = ev.target.files[0]; if (!s || !file) return;
  if (typeof XLSX === "undefined") return alert("تعذر تحميل مكتبة Excel.");
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    let h = rows.findIndex(r => r.some(c => /مبلغ|المبلغ|amount/i.test(S_(c)))), c = { d: 0, t: 1, a: 2 };
    if (h >= 0) rows[h].forEach((x, i) => { if (/تاريخ/.test(S_(x))) c.d = i; else if (/بيان/.test(S_(x))) c.t = i; else if (/مبلغ|amount/i.test(S_(x))) c.a = i; });
    const dt = v => typeof v === "number" ? new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10) : /^\d{4}-\d{2}-\d{2}/.test(S_(v)) ? S_(v).slice(0, 10) : today();
    const items = rows.slice(h + 1).map(r => ({ id: uid(), date: dt(r[c.d]), desc: cleanName(r[c.t]), amount: toNum(String(r[c.a]).replace(/,/g, "")), img: "" })).filter(i => i.amount > 0 && i.desc);
    if (!items.length) return alert("لم أجد بنوداً صالحة. رتّب الأعمدة: التاريخ، البيان، المبلغ.");
    if (!confirm(`استيراد ${items.length} بنداً بإجمالي ${money(sum(items, i => i.amount))} إلى «${s.name}»؟`) || !guardClosed(p, s, `استيراد ${items.length} بنداً`)) return;
    s.items = [...(s.items || []), ...items]; await savePeriod(p);
  } catch (e) { console.error(e); alert("تعذر قراءة الملف."); }
  ev.target.value = "";
});

/* ---------- النقرات ---------- */
document.addEventListener("click", async ev => {
  const t = ev.target, q = s => t.closest(s); let b;
  if ((b = q("[data-xt]"))) { const [v, k] = b.dataset.xt.split(":"); tabs[v] = k; renderTabs(v); return; }
  if ((b = q("[data-co-edit]"))) { const c = byId(K("company"), b.dataset.coEdit), f = $("#co-form"); if (!c) return; f.cid.value = c.id; f.name.value = c.name; f.phone.value = c.phone || ""; f.priceM3.value = c.priceM3 ?? ""; f.priceTrip.value = c.priceTrip ?? ""; f.notes.value = c.notes || ""; $("#co-cancel").classList.remove("hidden"); f.scrollIntoView({ behavior: "smooth" }); return; }
  if ((b = q("[data-co-del]"))) { const c = byId(K("company"), b.dataset.coDel), st = c && coStat(c.id); if (!c) return; if (st.s.length || st.p.length) return alert("للشركة توريدات أو دفعات مسجلة. احذفها أولاً أو أبقِ الشركة."); if (confirm(`حذف الشركة «${c.name}»؟`)) rm("biz", c.id); return; }
  if ((b = q("[data-sp-del]"))) { if (confirm("حذف هذا التوريد؟")) rm("biz", b.dataset.spDel); return; }
  if ((b = q("[data-pay-del]"))) { if (confirm("حذف هذه الدفعة؟")) rm("biz", b.dataset.payDel); return; }
  if ((b = q("[data-mt-del]"))) { if (confirm("حذف هذا السجل؟")) rm("biz", b.dataset.mtDel); return; }
  if ((b = q("[data-dr-del]"))) { if (confirm("حذف السائق؟")) rm("biz", b.dataset.drDel); return; }
  if ((b = q("[data-dr-edit]"))) { const d = byId(K("driver"), b.dataset.drEdit), f = $("#dr-form"); if (!d) return; f.did.value = d.id; f.name.value = d.name; f.phone.value = d.phone || ""; f.licNo.value = d.licNo || ""; f.licExp.value = d.licExp || ""; f.vehicleId.value = d.vehicleId || ""; $("#dr-cancel").classList.remove("hidden"); f.scrollIntoView({ behavior: "smooth" }); return; }
  if (q("#wk-wa")) return window.open("https://wa.me/?text=" + encodeURIComponent(weekText()), "_blank");
  /* خزينة المحاسب */
  const p = byId(acct, curP); if (!p || !q("#ac-main")) return;
  const s = (p.sheets || []).find(x => x.id === curS);
  if ((b = q("[data-a-sheet]"))) { curS = curS === b.dataset.aSheet ? "" : b.dataset.aSheet; renderAcct(); if (curS) $("#ac-sheet")?.scrollIntoView({ behavior: "smooth" }); return; }
  if (q("[data-a-newsheet]")) { const n = cleanName(prompt("اسم الكشف الجديد:")); if (!n || !guardClosed(p, null, `إضافة كشف ${n}`)) return; p.sheets.push({ id: uid(), name: n, status: "open", settleNo: 0, items: [] }); return savePeriod(p); }
  if (q("[data-a-opening]")) { const v = toNum(prompt("العهدة المرحّلة:", p.opening || 0)); if (v == null || v < 0 || !guardClosed(p, null, `تعديل العهدة المرحّلة إلى ${v}`)) return; p.opening = v; return savePeriod(p); }
  if ((b = q("[data-a-incdel]"))) { if (!confirm("حذف هذا الوارد؟") || !guardClosed(p, null, "حذف وارد")) return; p.incoming = p.incoming.filter(i => i.id !== b.dataset.aIncdel); return savePeriod(p); }
  if ((b = q("[data-a-itemdel]")) && s) { if (!confirm("حذف هذا البند؟") || !guardClosed(p, s, "حذف بند")) return; s.items = s.items.filter(i => i.id !== b.dataset.aItemdel); return savePeriod(p); }
  if (q("[data-a-sclose]") && s) {
    if (s.status === "closed") { if (!confirm("إعادة فتح الكشف المقفول؟")) return; logP(p, `${s.name}: إعادة فتح الكشف`); s.status = "open"; }
    else { s.status = "closed"; s.settleNo = (s.settleNo || 0) + 1; s.closedAt = today(); }
    return savePeriod(p);
  }
  if (q("[data-a-rename]") && s) { const n = cleanName(prompt("اسم الكشف:", s.name)); if (!n || !guardClosed(p, s, `تغيير الاسم إلى ${n}`)) return; s.name = n; return savePeriod(p); }
  if (q("[data-a-sdel]") && s) { if (!confirm(`حذف الكشف «${s.name}»؟`)) return; p.sheets = p.sheets.filter(x => x.id !== s.id); curS = ""; return savePeriod(p); }
  if (q("[data-a-pclose]")) {
    const open = (p.sheets || []).filter(x => x.status !== "closed" && (x.items || []).length).length;
    if (open && !confirm(`يوجد ${open} كشف مفتوح فيه بنود. تقفل الفترة رغم ذلك؟`)) return;
    const rem = pRem(p); p.handed = rem > 0 && confirm(`المتبقي ${money(rem)}.\nموافق = تسليمه للمدير\nإلغاء = ترحيله للفترة القادمة كعهدة مرحّلة`);
    p.status = "closed"; p.closedAt = today(); p.closingRemainder = rem; return savePeriod(p);
  }
  if (q("[data-a-preopen]")) { if (!confirm("إعادة فتح الفترة المقفولة؟")) return; logP(p, "إعادة فتح الفترة"); p.status = "open"; p.handed = false; return savePeriod(p); }
  if (q("[data-a-pdel]")) { if (confirm(`حذف فترة «${p.project}» بكل كشوفها وبنودها؟ لا يمكن التراجع.`)) { curP = ""; curS = ""; rm("acct", p.id); } }
});
document.addEventListener("change", async ev => {                       // تأمين / فحص فني: يُحفظ فور اختيار التاريخ
  const i = ev.target.closest("[data-vf]"); if (!i) return;
  try { await S.save("vehicles", { [i.dataset.vf]: i.value || "" }, i.dataset.vid); await loadData(); } catch (e) { dbErr(e); }
});

/* ---------- تنبيهات إضافية (نفس مركز الإشعارات) ---------- */
const bn0 = buildNotifs;
buildNotifs = function () {
  const out = bn0();
  try {
    if (!pageOff("biz")) K("company").forEach(c => { const st = coStat(c.id); if (st.bal > 0 && st.age > LATE_DAYS) out.push({ type: "late", sev: st.age > 60 ? 2 : 1, icon: "fa-building", title: c.name, text: `متأخرة في الدفع: ${money(st.bal)} من ${st.age} يوم` }); });
    if (!pageOff("crew")) {
      const chk = (d, title, label) => { if (!d) return; const n = daysUntil(d); if (n <= SETTINGS.licenseWarnDays) out.push({ type: "ins", sev: n <= 0 ? 2 : 1, icon: "fa-shield-halved", title, text: `${label}: ${when(d)}` }); };
      activeVehicles().forEach(v => { chk(v.insuranceExpiry, v.number, "التأمين"); chk(v.inspectionExpiry, v.number, "الفحص الفني"); });
      K("driver").forEach(d => chk(d.licExp, d.name, "رخصة القيادة"));
    }
  } catch (e) { console.error("ext notifs", e); }
  return out.sort((a, b) => b.sev - a.sev);
};

/* ---------- ربط بدورة التحميل والتدقيق ---------- */
const ld0 = loadData;
loadData = async function () { await ld0(); try { await extLoad(); renderAll(); renderNotifs(); } catch (e) { console.error("ext load", e); } };
const wa0 = wrapAudit;
wrapAudit = function () {
  wa0(); const s0 = S.save.bind(S);
  S.save = async (col, d, id) => {                                       // الحسبة المحفوظة تُربط بالشركة المختارة
    if (col === "costings" && d && d.type === "quick") { const c = byId(K("company"), $("#xq-co").value); if (c) d = { ...d, companyId: c.id, companyName: c.name }; }
    return s0(col, d, id);
  };
};
VIEW_HOOKS.biz = VIEW_HOOKS.crew = VIEW_HOOKS.acct = async () => { await refresh(); };

/* ---------- البحث الشامل ---------- */
const hb = document.createElement("button"); hb.type = "button"; hb.id = "xs-btn"; hb.className = "text-sm font-bold text-slate-600"; hb.innerHTML = `<i class="fa-solid fa-magnifying-glass ml-1"></i><span class="hidden sm:inline">بحث</span>`;
$("#print-page").before(hb);
const ov = document.createElement("div"); ov.id = "xs-ov"; ov.className = "hidden fixed inset-0 z-50 bg-black/50 p-4 overflow-y-auto no-print";
ov.innerHTML = `<div class="max-w-xl mx-auto bg-white rounded-2xl p-4 space-y-3 mt-10"><div class="flex gap-2"><input id="xs-q" class="inp" placeholder="ابحث في المعدات والمصروفات والشركات والسائقين والعهد..." autocomplete="off"><button type="button" id="xs-x" class="px-4 rounded-xl bg-slate-200 font-bold">إغلاق</button></div><div id="xs-res" class="space-y-1 text-sm"></div></div>`;
document.body.appendChild(ov);
let found = [];
function searchAll(qs) {
  const q = normAr(qs); if (q.length < 2) return []; const out = [], add = (t, txt, view, fn) => { if (normAr(txt).includes(q)) out.push({ t, txt: txt.replace(/\s+/g, " ").trim(), view, fn }); };
  vehicles.forEach(v => add("معدة", `${v.number} ${v.type} ${v.driver || ""} ${v.location || ""}`, "vehicles"));
  expenses.forEach(e => add("مصروف", `${vNo(e)} ${catName(e.category)} ${e.amount} ${e.project || ""} ${e.notes || ""} ${e.date || ""}`, "expenses"));
  advances.forEach(a => add("عهدة سائق", `${a.driver} ${a.amount} ${a.notes || ""}`, "advances"));
  operations.forEach(o => add("تشغيل", `${vNo(o)} ${o.project || ""} ${o.notes || ""}`, "ops"));
  inventory.forEach(i => add("مخزن", `${i.name} ${i.category || ""}`, "inventory"));
  const KN = { company: "شركة", supply: "توريد", payment: "دفعة", driver: "سائق", maint: "صيانة" };
  biz.forEach(x => add(KN[x.kind] || "", `${x.name || ""} ${x.project || ""} ${x.phone || ""} ${x.desc || ""} ${x.notes || ""} ${x.date || ""}`, x.kind === "driver" || x.kind === "maint" ? "crew" : "biz", () => { tabs[x.kind === "driver" ? "crew" : x.kind === "maint" ? "crew" : "biz"] = { company: "co", supply: "sp", payment: "pay", driver: "dr", maint: "mt" }[x.kind]; }));
  acct.forEach(p => { add("خزينة", `${p.project} ${p.accountant}`, "acct", () => { curP = p.id; curS = ""; }); (p.sheets || []).forEach(s => (s.items || []).forEach(i => add("بند كشف", `${s.name} ${i.desc} ${i.amount} ${p.project}`, "acct", () => { curP = p.id; curS = s.id; }))); });
  return out.slice(0, 40);
}
hb.onclick = () => { ov.classList.remove("hidden"); $("#xs-q").focus(); };
$("#xs-x").onclick = () => ov.classList.add("hidden");
$("#xs-q").oninput = () => { found = searchAll($("#xs-q").value); $("#xs-res").innerHTML = found.map((r, i) => `<button type="button" data-xs="${i}" class="w-full text-right p-2 rounded-xl bg-slate-50 hover:bg-orange-50 flex gap-2"><b class="text-orange-600 shrink-0">${esc(r.t)}</b><span>${esc(r.txt)}</span></button>`).join("") || `<p class="text-slate-500 p-2">${$("#xs-q").value.trim().length < 2 ? "اكتب حرفين على الأقل." : "لا توجد نتائج."}</p>`; };
$("#xs-res").addEventListener("click", ev => { const b = ev.target.closest("[data-xs]"); if (!b) return; const r = found[+b.dataset.xs]; ov.classList.add("hidden"); if (r.fn) r.fn(); show(r.view); if (["biz", "crew", "acct"].includes(r.view)) renderAll(); });
})();
