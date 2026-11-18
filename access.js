/* access.js (v17) — التسجيل الذاتي واعتماد الحسابات | يعتمد على app.js (S, $, esc, smartName, show) */
const DEV_EMAIL = "belal.dev@fawzy-fleet.com", ADMIN_EMAIL = "admin@admin.com";
const ACCESS = { role: "", site: "", appRole: "" };
const ownerRole = e => { e = String(e || "").toLowerCase(); return e === DEV_EMAIL ? "dev" : e === ADMIN_EMAIL ? "admin" : ""; };
const ACC_ROLES = { accountant: "محاسب / مهندس موقع", admin: "مدير" };
const accUsers = () => (typeof xbiz !== "undefined" ? xbiz : []).filter(x => x.kind === "user");

/* ---------- شاشة الدخول: تبديل / إنشاء حساب / نسيت كلمة المرور ---------- */
(function injectLoginUI() {
  const btn = $("#login-btn"); if (!btn) return;
  const inp = (id, ph, t = "text") => `<input id="${id}" type="${t}" placeholder="${ph}" class="inp mb-2" ${t !== "text" ? 'dir="ltr"' : ""}>`;
  const reg = document.createElement("div");
  reg.id = "reg-box"; reg.className = "hidden";
  reg.innerHTML = inp("reg-name", "الاسم بالكامل") + inp("reg-job", "المهنة") + inp("reg-site", "اسم الموقع") +
    inp("reg-email", "البريد الإلكتروني", "email") + inp("reg-pass", "كلمة المرور (6 أحرف على الأقل)", "password") +
    `<button type="button" id="reg-btn" class="btn w-full">إنشاء الحساب</button>`;
  btn.before(reg);
  const links = document.createElement("div");
  links.className = "mt-3 flex justify-between text-sm font-bold text-orange-600";
  links.innerHTML = `<button type="button" id="to-reg">إنشاء حساب جديد</button><button type="button" id="to-forgot">نسيت كلمة المرور؟</button>`;
  btn.after(links);
  let mode = "login";
  const setMode = m => {
    mode = m;
    $("#reg-box").classList.toggle("hidden", m !== "reg");
    ["#email", "#password", "#login-btn"].forEach(s => { const el = $(s); (el.previousElementSibling && el.tagName === "INPUT" ? [el.previousElementSibling, el] : [el]).forEach(x => x.classList.toggle("hidden", m === "reg")); });
    $("#to-reg").textContent = m === "reg" ? "لدي حساب — تسجيل الدخول" : "إنشاء حساب جديد";
    $("#login-error").classList.add("hidden");
  };
  const fail = m => { const e = $("#login-error"); e.textContent = m; e.classList.remove("hidden"); };
  $("#to-reg").onclick = () => setMode(mode === "reg" ? "login" : "reg");
  $("#to-forgot").onclick = async () => {
    const e = $("#email").value.trim(); if (!e) return fail("اكتب بريدك في خانة البريد أولاً.");
    if (!S.resetPassword) return fail("متاح مع Firebase فقط.");
    try { await S.resetPassword(e); alert("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك."); } catch (ex) { fail("تعذر الإرسال (" + (ex.code || "") + ")"); }
  };
  $("#reg-btn").onclick = async () => {
    const b = $("#reg-btn"), v = id => $("#" + id).value.trim();
    const [name, job, site, email, pass] = ["reg-name", "reg-job", "reg-site", "reg-email", "reg-pass"].map(v);
    if (!name || !job || !site || !email || pass.length < 6) return fail("أكمل كل الحقول (كلمة المرور 6 أحرف على الأقل).");
    if (!S.register) return fail("إنشاء الحساب يعمل مع Firebase فقط.");
    b.disabled = true;
    try {
      const u = await S.register(email, pass);
      await S.rawSet("biz", u.user.uid, { kind: "user", name, job, site: smartName(site, []), email: email.toLowerCase(), role: "accountant", status: "pending", createdAt: Date.now() });
    } catch (ex) { fail(ex.code === "auth/email-already-in-use" ? "هذا البريد مسجّل بالفعل." : "تعذر إنشاء الحساب (" + (ex.code || "") + ")"); }
    b.disabled = false;
  };
})();

/* ---------- البوابة: تُستدعى بعد كل دخول، false = ممنوع من التطبيق ---------- */
async function accessGate(user) {
  $("#pending")?.remove();
  if (!S.get) return true;                                              // الوضع التجريبي بدون Firebase
  const own = ownerRole(user.email);
  let rec = null;
  try { rec = await S.get("biz", user.uid); } catch (e) { console.warn("gate", e && e.code); }
  if (own) {                                                             // مطور / مدير مثبّتان بالكود: تفعيل تلقائي ولا يمكن إيقافهما
    if (!rec || rec.status !== "active" || rec.role !== own)
      await S.rawSet("biz", user.uid, { kind: "user", name: rec?.name || (own === "dev" ? "المطور" : "المدير"), email: user.email.toLowerCase(), role: own, status: "active" });
    ACCESS.role = own; ACCESS.appRole = "manager"; return true;
  }
  if (rec && rec.status === "active") { ACCESS.role = rec.role; ACCESS.site = rec.site || ""; ACCESS.appRole = rec.role === "admin" ? "manager" : "accountant"; return true; }
  const off = rec && rec.status === "disabled", el = document.createElement("section");
  el.id = "pending"; el.className = "fixed inset-0 z-50 grid place-items-center bg-slate-900 p-4";
  el.innerHTML = `<div class="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4"><div class="text-4xl">${off ? "⛔" : "⏳"}</div>
    <h2 class="font-extrabold">${off ? "تم إيقاف حسابك، تواصل مع الإدارة" : "تم إرسال طلبك للإدارة وبانتظار التفعيل"}</h2>
    <button id="pd-refresh" class="btn w-full">تحديث الحالة</button><button id="pd-out" class="w-full py-2.5 rounded-xl bg-slate-200 font-bold">تسجيل الخروج</button></div>`;
  document.body.appendChild(el);
  $("#pd-refresh").onclick = () => location.reload();
  $("#pd-out").onclick = async () => { await S.logout(); el.remove(); };
  return false;
}

/* ---------- لوحة الاعتماد (مدير / مطور) ---------- */
function renderAccess() {
  const mgr = ACCESS.appRole === "manager";
  let card = $("#acc-card"), note = $("#acc-note");
  if (!card) {
    card = document.createElement("div"); card.id = "acc-card"; card.className = "card space-y-3 hidden";
    $("#view-settings").prepend(card);
    note = document.createElement("div"); note.id = "acc-note";
    note.className = "hidden p-3 rounded-xl bg-orange-50 text-orange-800 border border-orange-200 text-sm font-bold flex justify-between items-center";
    $("#view-dashboard").prepend(note);
    note.onclick = () => show("settings");
    card.onclick = async ev => {
      const b = ev.target.closest("[data-acc]"); if (!b) return;
      const id = b.dataset.id, row = b.closest("tr"), st = b.dataset.acc;
      const site = smartName(row.querySelector("[data-site]").value, []), role = row.querySelector("[data-role]").value;
      if (st === "disabled" && !confirm("رفض / إيقاف هذا الحساب؟")) return;
      b.disabled = true;
      try { await S.save("biz", { status: st, site, role }, id); await loadData(); } catch (e) { dbErr(e); }
      b.disabled = false;
    };
  }
  card.classList.toggle("hidden", !mgr);
  const list = accUsers(), pend = list.filter(u => u.status === "pending");
  note.classList.toggle("hidden", !mgr || !pend.length);
  note.innerHTML = `<span>⏳ ${pend.length} حساب جديد بانتظار الاعتماد</span><span class="underline">مراجعة</span>`;
  if (!mgr) return;
  const badge = u => u.status === "active" ? "✔ مفعّل" : u.status === "disabled" ? "⛔ موقوف" : "⏳ بانتظار";
  card.innerHTML = `<h3 class="font-extrabold">إدارة الحسابات والمواقع</h3><div class="overflow-x-auto"><table class="w-full text-sm text-right"><thead class="text-slate-500 border-b"><tr><th class="py-2">الاسم / المهنة</th><th>الموقع</th><th>البريد</th><th>الدور</th><th>الحالة</th><th></th></tr></thead><tbody>` +
    list.sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1)).map(u => {
      const fixed = ownerRole(u.email);
      return `<tr class="border-b last:border-0"><td class="py-2"><b>${esc(u.name)}</b><div class="text-xs text-slate-500">${esc(u.job || "")}</div></td>
      <td>${fixed ? "كل المواقع" : `<input data-site class="inp !py-1 w-32" value="${esc(u.site || "")}">`}</td><td dir="ltr" class="text-xs">${esc(u.email)}</td>
      <td>${fixed ? (fixed === "dev" ? "مطور" : "مدير") : `<select data-role class="inp !py-1">${Object.entries(ACC_ROLES).map(([k, l]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${l}</option>`).join("")}</select>`}</td>
      <td>${badge(u)}</td><td class="whitespace-nowrap">${fixed ? "" : `<button data-acc="active" data-id="${esc(u.id)}" class="text-green-700 font-bold ml-3">قبول وتفعيل</button><button data-acc="disabled" data-id="${esc(u.id)}" class="text-red-600 font-bold">رفض / إيقاف</button>`}</td></tr>`;
    }).join("") + `</tbody></table></div>`;
}
