/* =====================================================
   شركة فوزي عبده – إدارة الأسطول والصيانة | app.js
   ===================================================== */

/* ---------- 0) حماية الكاش ----------
   لو المتصفح حمّل index.html قديماً (من الكاش) مع app.js جديد، يتعطل كل شيء بصمت.
   نكتشف ذلك ونعيد تحميل الصفحة مرة واحدة، وإن استمرت المشكلة نعرض رسالة واضحة. */
if (!document.querySelector("#view-ops")) {
  let again = false;
  try { again = !!sessionStorage.getItem("fa-reload"); sessionStorage.setItem("fa-reload", "1"); } catch (e) { again = true; }
  if (!again) location.reload();
  else {
    const p = document.querySelector("#login-error");
    if (p) { p.textContent = "نسخة الصفحة قديمة في ذاكرة المتصفح. امسح بيانات الموقع أو افتحه في نافذة خاصة ثم حدّث الصفحة."; p.classList.remove("hidden"); }
  }
  throw new Error("index.html قديم (كاش): حدّث الصفحة");
}
try { sessionStorage.removeItem("fa-reload"); } catch (e) {}

/* ---------- 1) مفاتيح Firebase: استبدل القيم أدناه فقط ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyAiFhd_0xUrkDLv1v3dH_27FMUjVdx932g",
  authDomain: "fawzy-abdo.firebaseapp.com",
  projectId: "fawzy-abdo",
  storageBucket: "fawzy-abdo.firebasestorage.app",
  messagingSenderId: "589564594916",
  appId: "1:589564594916:web:b5a701c475df9adfb67af1",
  measurementId: "G-7J4Y5H9HMG"
};

/* ---------- 2) إعدادات عامة ---------- */
const SETTINGS = {
  currency: "ج.م",     // العملة
  oilInterval: 250,    // فاصل تغيير الزيت الافتراضي (للمعدات التي لا تحمل فاصلاً خاصاً بها)
  oilWarnBefore: 30,   // التنبيه قبل موعد الزيت بكم ساعة
  licenseWarnDays: 30, // التنبيه قبل انتهاء الرخصة بكم يوم
  recentCount: 5,      // عدد أحدث المصروفات في الرئيسية
  lowStock: 5          // تنبيه المخزن عندما تقل كمية الصنف عن هذا الرقم
};

const LIVE = !firebaseConfig.apiKey.startsWith("YOUR_");
const FB = "https://www.gstatic.com/firebasejs/9.23.0/";
const IMGBB_API_KEY = "77178c823c131bbbe883c397b8ee363e"; // مفتاح ImgBB لرفع صور الفواتير

/* ---------- 3) طبقة البيانات (Firebase v9) ----------
   كل الاتصال بـ Firebase داخل هذه الدالة فقط. */
async function initLive() {
  const [a, au, fs] = await Promise.all(
    ["app", "auth", "firestore"].map(m => import(`${FB}firebase-${m}.js`))
  );
  const app = a.initializeApp(firebaseConfig);
  const auth = au.getAuth(app), db = fs.getFirestore(app);
  return {
    login: (e, p) => au.signInWithEmailAndPassword(auth, e, p),
    logout: () => au.signOut(auth),
    onAuth: cb => au.onAuthStateChanged(auth, cb),
    async list(col) {
      const s = await fs.getDocs(fs.collection(db, col));
      return s.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async save(col, data, id) {            // id موجود = تعديل، بدونه = إضافة
      if (id) { await fs.setDoc(fs.doc(db, col, id), data, { merge: true }); return id; }
      return (await fs.addDoc(fs.collection(db, col), data)).id;
    },
    async remove(col, id) {                // حذف مستند من Firestore
      await fs.deleteDoc(fs.doc(db, col, id));
    },
    async upload(file) {                   // رفع صورة الفاتورة إلى ImgBB وإرجاع الرابط
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd });
      const j = await r.json();
      if (!j.success) throw new Error("ImgBB upload failed");
      return j.data.url;
    }
  };
}

/* وضع تجريبي (بدون Firebase) لتجربة الواجهة */
function initDemo() {
  const t = Date.now();
  const store = {
    vehicles: [
      { id: "1", type: "خلاطة", number: "خ 1234", chassis: "CH-1001", modelYear: "2019", driver: "أحمد علي", location: "محطة الخلط", hours: 1180, lastOil: 950, oilInterval: 250, licenseExpiry: dayStr(12), status: "active" },
      { id: "2", type: "لودر", number: "ل 5678", chassis: "CH-2002", modelYear: "2016", driver: "محمد حسن", location: "الورشة", hours: 600, lastOil: 400, oilInterval: 300, licenseExpiry: dayStr(-5), status: "maintenance" },
      { id: "3", type: "مضخة", number: "م 9012", chassis: "CH-3003", modelYear: "2021", driver: "سعيد عمر", location: "موقع المشروع", hours: 300, lastOil: 100, oilInterval: 250, licenseExpiry: dayStr(200), status: "active" }
    ],
    expenses: [
      { id: "1", vehicleId: "1", vehicleNo: "خ 1234", category: "fuel", amount: 3500, date: dayStr(-10), notes: "تعبئة", invoiceUrl: "", liters: 100, hoursAtFill: 1100, createdAt: t - 4000 },
      { id: "2", vehicleId: "1", vehicleNo: "خ 1234", category: "fuel", amount: 4200, date: dayStr(-4), notes: "تعبئة", invoiceUrl: "", liters: 120, hoursAtFill: 1140, createdAt: t - 3000 },
      { id: "3", vehicleId: "2", vehicleNo: "ل 5678", category: "parts", amount: 1800, date: dayStr(-3), notes: "طلمبة", invoiceUrl: "", liters: null, hoursAtFill: null, createdAt: t - 2000 },
      { id: "4", vehicleId: "3", vehicleNo: "م 9012", category: "فحص كمبيوتر", amount: 600, date: dayStr(0), notes: "", invoiceUrl: "", liters: null, hoursAtFill: null, createdAt: t - 1000 }
    ],
    advances: [
      { id: "a1", driver: "أحمد علي", amount: 3000, date: dayStr(-6), notes: "رحلة أسوان", status: "open", closedAt: null, createdAt: t - 6000,
        items: [{ id: "i1", type: "كارتة", amount: 450, date: dayStr(-5), notes: "" }, { id: "i2", type: "نثريات", amount: 300, date: dayStr(-4), notes: "مياه" }] },
      { id: "a2", driver: "سعيد عمر", amount: 1500, date: dayStr(-20), notes: "", status: "closed", closedAt: t - 90000, closedDate: dayStr(-15), spent: 1200, balance: 300, createdAt: t - 7000,
        items: [{ id: "i3", type: "إعاشة", amount: 1200, date: dayStr(-18), notes: "" }] }
    ],
    inventory: [
      { id: "s1", name: "فلتر زيت لودر", category: "فلاتر", unit: "قطعة", qty: 3, createdAt: t - 8000,
        log: [{ d: dayStr(-10), t: "init", q: 8, bal: 8, note: "رصيد افتتاحي" }, { d: dayStr(-2), t: "out", q: 5, bal: 3, note: "صيانة ل 5678" }] },
      { id: "s2", name: "سير مروحة", category: "سيور", unit: "قطعة", qty: 12, log: [], createdAt: t - 7500 },
      { id: "s3", name: "زيت محرك 15W40", category: "براميل زيت", unit: "برميل", qty: 6, log: [], createdAt: t - 7000 }
    ],
    operations: [
      { id: "o1", vehicleId: "1", vehicleNo: "خ 1234", vehicleType: "خلاطة", project: "مشروع الطريق الإقليمي", date: dayStr(-1), amount: 12, unit: "trips", notes: "", createdAt: t - 500 },
      { id: "o2", vehicleId: "3", vehicleNo: "م 9012", vehicleType: "مضخة", project: "مشروع الطريق الإقليمي", date: dayStr(0), amount: 45, unit: "m3", notes: "صب أساسات", createdAt: t - 400 }
    ]
  };
  let user = null, cb = () => {};
  return {
    login: async (e, p) => { if (!e || !p) throw 0; user = { email: e }; cb(user); },
    logout: async () => { user = null; cb(null); },
    onAuth: f => { cb = f; f(user); },
    list: async c => store[c].map(x => ({ ...x })),
    save: async (c, d, id) => {
      if (id) { Object.assign(store[c].find(x => x.id === id), d); return id; }
      const n = String(Date.now()) + Math.random().toString(36).slice(2, 6); store[c].push({ ...d, id: n }); return n;
    },
    upload: async f => URL.createObjectURL(f),
    remove: async (c, id) => { store[c] = store[c].filter(x => x.id !== id); }
  };
}

/* ---------- 4) أدوات مساعدة ---------- */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const OTHER = "other";                     // قيمة خيار "أخرى" في القوائم المنسدلة
const CATS = { fuel: "وقود", parts: "قطع غيار", oil: "تغيير زيت", tires: "إطارات" };
const isStdCat = c => Object.prototype.hasOwnProperty.call(CATS, c);
const catName = c => isStdCat(c) ? CATS[c] : (c || ""); // التصنيف المخصص (أخرى) يُحفظ باسمه مباشرة ويُعرض كما هو
const statusName = s => s === "active" ? "يعمل" : "في الصيانة";
const num = n => Number(n || 0).toLocaleString("en-US");
const fmt = n => Number(Number(n).toFixed(2)).toLocaleString("en-US");
const money = n => `${num(n)} ${SETTINGS.currency}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toNum = v => (v === "" || v == null || !Number.isFinite(+v)) ? null : +v;
const pad = n => String(n).padStart(2, "0");
const dayStr = (off = 0) => {              // تاريخ اليوم (بتوقيت الجهاز) مع إزاحة بالأيام
  const d = new Date(); d.setDate(d.getDate() + off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const today = () => dayStr(0);
function daysUntil(s) {                    // عدد الأيام حتى تاريخ معين (سالب = منتهي)
  const [y, m, d] = String(s || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const n = new Date();
  return Math.round((new Date(y, m - 1, d) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
}
const byRecent = (a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0);
let S, vehicles = [], expenses = [];

/* فاصل الزيت الخاص بكل معدة (والافتراضي للمعدات القديمة) والساعات المتبقية */
const oilInt = v => Number(v.oilInterval) > 0 ? Number(v.oilInterval) : SETTINGS.oilInterval;
const oilLeft = v => (v.lastOil || 0) + oilInt(v) - (v.hours || 0);
const vNo = e => (vehicles.find(v => v.id === e.vehicleId) || {}).number || e.vehicleNo || "";

/* حالة الرخصة */
function licenseInfo(v) {
  const days = daysUntil(v.licenseExpiry);
  if (days === null) return { days, cls: "", text: "-" };
  if (days < 0) return { days, cls: "text-red-600 font-bold", text: `منتهية منذ ${num(-days)} يوم (${v.licenseExpiry})` };
  if (days === 0) return { days, cls: "text-red-600 font-bold", text: `تنتهي اليوم (${v.licenseExpiry})` };
  if (days <= SETTINGS.licenseWarnDays) return { days, cls: "text-orange-600 font-bold", text: `تنتهي خلال ${num(days)} يوم (${v.licenseExpiry})` };
  return { days, cls: "", text: v.licenseExpiry };
}
const licenseAlerts = () => vehicles.map(v => ({ v, days: daysUntil(v.licenseExpiry) }))
  .filter(a => a.days !== null && a.days <= SETTINGS.licenseWarnDays).sort((a, b) => a.days - b.days);

/* استهلاك الوقود لكل معدة: إجمالي اللترات + المعدل (لتر/ساعة) بين أول وآخر تعبئة */
function fuelStats(vid) {
  const rows = expenses.filter(e => e.vehicleId === vid && e.category === "fuel" && e.liters > 0);
  if (!rows.length) return null;
  const liters = rows.reduce((s, e) => s + e.liters, 0);
  const withH = rows.filter(e => Number.isFinite(e.hoursAtFill)).sort((a, b) => a.hoursAtFill - b.hoursAtFill);
  let rate = null;
  if (withH.length >= 2) {
    const span = withH[withH.length - 1].hoursAtFill - withH[0].hoursAtFill;
    if (span > 0) rate = withH.slice(1).reduce((s, e) => s + e.liters, 0) / span; // لترات التعبئات بعد الأولى ÷ الساعات المقطوعة
  }
  return { liters, rate, fills: rows.length };
}

/* ---------- الأسماء المخصصة والاقتراحات الذكية ---------- */
const normAr = s => String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "")   // يتجاهل التشكيل والمسافات والهمزات و"ال" التعريف
  .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
  .replace(/(^|\s)ال(?=\S)/g, "$1").replace(/\s+/g, "");
const uniq = arr => { const seen = new Set(); return arr.filter(x => x && !seen.has(normAr(x)) && seen.add(normAr(x))); };
const customCats = () => uniq(expenses.map(e => e.category).filter(c => c && !isStdCat(c)));
const stdTypes = () => [...vForm.elements.type.options].map(o => o.value).filter(x => x !== OTHER);
const customTypes = () => uniq(vehicles.map(v => v.type).filter(t => t && !stdTypes().some(s => normAr(s) === normAr(t))));
const cleanName = s => String(s || "").trim().replace(/\s+/g, " ");

/* يطابق الاسم المكتوب مع الموجود (بصرف النظر عن المسافات/الهمزات/التاء المربوطة) لمنع تكرار نفس الاسم بصيغ مختلفة */
function smartName(input, known) {
  const clean = cleanName(input), k = normAr(clean);
  return known.find(x => normAr(x) === k) || clean;
}
function smartCategory(input) {
  const clean = cleanName(input); if (!clean) return "";
  const key = Object.keys(CATS).find(k => normAr(CATS[k]) === normAr(clean)); // كتب "وقود" داخل أخرى ⇐ نفس تصنيف الوقود
  return key || smartName(clean, customCats());
}
const smartType = input => smartName(input, [...stdTypes(), ...customTypes()]);

function renderSuggestions() {
  $("#dl-cats").innerHTML = customCats().map(c => `<option value="${esc(c)}"></option>`).join("");
  $("#dl-types").innerHTML = customTypes().map(t => `<option value="${esc(t)}"></option>`).join("");
}

/* إظهار/إخفاء حقل النص الخاص بخيار "أخرى" أسفل القائمة المنسدلة */
function toggleOther(form, selName, inpName) {
  const on = form.elements[selName].value === OTHER, el = form.elements[inpName];
  el.classList.toggle("hidden", !on);
  el.required = on;
  if (!on) el.value = "";
  else el.focus();
}
/* حقول الوقود تظهر عند اختيار "وقود" فقط، وساعات التعبئة تُملأ تلقائياً بساعات المعدة الحالية */
function prefillHours(form) {
  const h = form.elements.hoursAtFill;
  if (h.dataset.touched) return;
  const v = vehicles.find(x => x.id === form.elements.vehicleId.value);
  h.value = v && Number.isFinite(+v.hours) ? v.hours : "";
}
function toggleFuel(form) {
  const on = form.elements.category.value === "fuel";
  form.querySelector("[data-fuel]").classList.toggle("hidden", !on);
  if (on) prefillHours(form);
}
function syncCategory(form) { toggleOther(form, "category", "customCategory"); toggleFuel(form); }

/* ---------- 5) التنقل ---------- */
function menu(open) {
  $("#sidebar").classList.toggle("translate-x-full", !open);
  $("#overlay").classList.toggle("hidden", !open);
}
function show(view) {
  $$(".view").forEach(v => v.classList.toggle("hidden", v.id !== "view-" + view));
  $$("[data-nav]").forEach(b => b.classList.toggle("active", b.dataset.nav === view));
  menu(false);
  window.scrollTo(0, 0);
}
$$("[data-nav]").forEach(b => b.onclick = () => show(b.dataset.nav));
$$("[data-go]").forEach(b => b.onclick = () => {                 // الإجراءات السريعة
  show(b.dataset.go);
  if (b.dataset.go === "expenses") $("#exp-vehicle").focus();
});
$("#menu-btn").onclick = () => menu(true);
$("#overlay").onclick = () => menu(false);

/* ---------- 6) العرض ---------- */
const vehicleOptions = extra => `<option value="">اختر المعدة</option>` + (extra || "") +
  vehicles.map(v => `<option value="${esc(v.id)}">${esc(v.number)} - ${esc(v.type)}</option>`).join("");

async function loadData() {
  [vehicles, expenses] = await Promise.all([S.list("vehicles"), S.list("expenses")]);
  // المجموعات الجديدة: فشل قراءتها (مثلاً قواعد Firestore) لا يعطّل بقية النظام
  [advances, inventory, operations] = await Promise.all(["advances", "inventory", "operations"].map(listSafe));
  const sel = $("#exp-vehicle"), cur = sel.value;
  sel.innerHTML = vehicleOptions(); sel.value = cur;
  refreshModuleSelects();
  // كل دالة عرض معزولة: خطأ في واحدة لا يمنع الباقي
  [renderSuggestions, renderModSuggestions, renderDashboard, renderVehicles, renderReport,
   renderAdvances, renderInventory, renderOps, renderModWarn].forEach(fn => {
    try { fn(); } catch (err) { console.error(fn.name, err); }
  });
}

const CAT_COLORS = { fuel: "#f59e0b", parts: "#3b82f6", oil: "#10b981", tires: "#64748b", other: "#ef4444" };
const CAT_LABELS = { ...CATS, other: "أخرى" };
const NOTIF_TYPES = { oil: "الزيت", license: "الرخص", stock: "المخزون" };
let expChart = null, notifFilter = "all";

function renderDashboard() {
  const ym = today().slice(0, 7);
  const monthExp = expenses.filter(e => (e.date || "").startsWith(ym));
  $("#dash-month").textContent = `بيانات شهر ${ym}`;
  $("#k-exp").textContent = money(monthExp.reduce((s, e) => s + e.amount, 0));
  $("#k-active").textContent = vehicles.filter(v => v.status === "active").length;
  $("#k-maint").textContent = vehicles.filter(v => v.status === "maintenance").length;

  const lic = licenseAlerts();
  $("#k-lic").textContent = lic.length;
  $("#k-lic").classList.toggle("text-red-600", lic.length > 0);

  // إجمالي العهد المفتوحة (مبالغ العهد التي لم تُصفَّ بعد)
  const openAdv = advances.filter(a => a.status === "open");
  const given = openAdv.reduce((s, a) => s + (+a.amount || 0), 0), spentOpen = openAdv.reduce((s, a) => s + advSpent(a), 0);
  $("#k-adv").textContent = money(given);
  $("#k-adv-sub").textContent = openAdv.length ? `${openAdv.length} عهدة · المصروف ${money(spentOpen)} · المتبقي ${money(given - spentOpen)}` : "لا توجد عهد مفتوحة";
  const low = lowStockItems();
  $("#k-stock").textContent = low.length;
  $("#k-stock").classList.toggle("text-red-600", low.length > 0);

  // رسم توزيع مصروفات الشهر
  const totals = {};
  monthExp.forEach(e => { const k = isStdCat(e.category) ? e.category : "other"; totals[k] = (totals[k] || 0) + e.amount; });
  renderExpenseChart(["fuel", "parts", "oil", "tires", "other"].filter(k => totals[k] > 0)
    .map(k => ({ key: k, label: CAT_LABELS[k], value: totals[k], color: CAT_COLORS[k] })));

  renderTopVehicles(monthExp);
  renderNotifs();

  // أحدث المصروفات
  const rec = [...expenses].sort(byRecent).slice(0, SETTINGS.recentCount);
  $("#recent-body").innerHTML = rec.map(e => `
    <tr class="border-b last:border-0"><td class="py-2">${esc(e.date)}</td><td>${esc(vNo(e))}</td><td>${esc(catName(e.category))}</td>
    <td>${money(e.amount)}</td><td>${esc(e.notes)}</td></tr>`).join("")
    || `<tr><td colspan="5" class="py-4 text-slate-500">لا توجد مصروفات بعد.</td></tr>`;
}

function renderExpenseChart(groups) {
  const total = groups.reduce((s, g) => s + g.value, 0);
  $("#chart-wrap").classList.toggle("hidden", total <= 0);
  $("#chart-empty").classList.toggle("hidden", total > 0);
  $("#exp-legend").innerHTML = groups.map(g => `
    <li class="flex items-center gap-2 text-sm"><span class="w-3 h-3 rounded-full shrink-0" style="background:${g.color}"></span>
    <span class="flex-1">${esc(g.label)}</span><b>${money(g.value)}</b><span class="text-xs text-slate-500 w-10 text-left">${Math.round(g.value / total * 100)}%</span></li>`).join("");
  if (typeof Chart === "undefined") return;                       // تعذر تحميل Chart.js: تبقى القائمة النصية
  if (total <= 0) { if (expChart) { expChart.destroy(); expChart = null; } return; }
  const data = { labels: groups.map(g => g.label), datasets: [{ data: groups.map(g => g.value), backgroundColor: groups.map(g => g.color), borderColor: "#fff", borderWidth: 2 }] };
  if (expChart) { expChart.data = data; expChart.update(); return; }
  Chart.defaults.font.family = "Cairo, sans-serif";
  expChart = new Chart($("#exp-chart"), {
    type: "doughnut", data,
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "62%",
      plugins: { legend: { display: false }, tooltip: { rtl: true, textDirection: "rtl", callbacks: { label: c => ` ${c.label}: ${money(c.parsed)}` } } }
    }
  });
}

function renderTopVehicles(monthExp) {
  const by = {};
  monthExp.forEach(e => { const k = e.vehicleId || e.vehicleNo || "?"; (by[k] ||= { e, total: 0 }).total += e.amount; });
  const top = Object.values(by).sort((a, b) => b.total - a.total).slice(0, 3);
  const max = top.length ? top[0].total : 0, rank = ["bg-amber-500 text-slate-900", "bg-slate-300 text-slate-800", "bg-orange-300 text-slate-900"];
  $("#top-vehicles").innerHTML = top.length ? top.map((t, i) => {
    const v = vehicles.find(x => x.id === t.e.vehicleId);
    return `<div>
      <div class="flex items-center gap-3 mb-1">
        <span class="w-7 h-7 rounded-full grid place-items-center text-sm font-black ${rank[i]}">${i + 1}</span>
        <div class="flex-1"><b>${esc(vNo(t.e))}</b><span class="text-xs text-slate-500 mr-2">${esc(v ? v.type : "")}</span></div>
        <b>${money(t.total)}</b>
      </div>
      <div class="h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full bg-amber-500" style="width:${max ? Math.round(t.total / max * 100) : 0}%"></div></div>
    </div>`;
  }).join("") : `<p class="text-sm text-slate-500">لا توجد مصروفات هذا الشهر.</p>`;
}

/* مركز الإشعارات الموحد: الزيت + الرخص + المخزون (الأحمر أولاً) */
function buildNotifs() {
  const out = [];
  vehicles.map(v => ({ v, left: oilLeft(v) })).filter(a => a.left <= SETTINGS.oilWarnBefore).sort((a, b) => a.left - b.left)
    .forEach(({ v, left }) => out.push({
      type: "oil", sev: left <= 0 ? 2 : 1, icon: "fa-oil-can", title: v.number,
      text: left < 0 ? `تجاوزت موعد تغيير الزيت بـ ${num(-left)} ساعة` : left === 0 ? "حان موعد تغيير الزيت الآن" : `متبقي ${num(left)} ساعة على تغيير الزيت`
    }));
  licenseAlerts().forEach(({ v, days }) => out.push({ type: "license", sev: days <= 0 ? 2 : 1, icon: "fa-id-card", title: v.number, text: "الرخصة: " + licenseInfo(v).text }));
  lowStockItems().forEach(i => {
    const q = Number(i.qty) || 0;
    out.push({ type: "stock", sev: q <= 0 ? 2 : 1, icon: "fa-boxes-stacked", title: i.name, text: q <= 0 ? "نفد من المخزن" : `كمية منخفضة: ${fmt(q)} ${i.unit || ""} فقط` });
  });
  return out.sort((a, b) => b.sev - a.sev);
}
function renderNotifs() {
  const all = buildNotifs();
  $("#notif-tabs").innerHTML = [["all", "الكل"], ...Object.entries(NOTIF_TYPES)].map(([k, l]) => {
    const c = k === "all" ? all.length : all.filter(n => n.type === k).length;
    return `<button type="button" data-notif="${k}" class="px-3 py-1 rounded-full font-bold ${notifFilter === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"}">${l} <span class="opacity-70">${c}</span></button>`;
  }).join("");
  const badge = $("#notif-count"); badge.textContent = all.length; badge.classList.toggle("hidden", !all.length);
  const rows = all.filter(n => notifFilter === "all" || n.type === notifFilter);
  $("#notif-list").innerHTML = rows.length ? rows.map(n => `
    <div class="flex items-center gap-3 p-3 rounded-xl ${n.sev === 2 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}">
      <i class="fa-solid ${n.icon}"></i><b>${esc(n.title)}</b><span class="text-sm flex-1">${esc(n.text)}</span>
      <span class="text-[11px] px-2 py-0.5 rounded-full bg-white/70 border border-current">${NOTIF_TYPES[n.type]}</span>
    </div>`).join("") : `<p class="text-sm text-slate-500">لا توجد إشعارات حالياً. كل شيء على ما يرام.</p>`;
}

function renderVehicles() {
  $("#v-list").innerHTML = vehicles.map(v => {
    const lic = licenseInfo(v), left = oilLeft(v), fs = fuelStats(v.id);
    return `
    <div class="card">
      <div class="flex justify-between items-start">
        <div><div class="text-xs text-slate-500">${esc(v.type)}</div><div class="text-lg font-extrabold">${esc(v.number)}</div></div>
        <span class="text-xs px-2 py-1 rounded-full ${v.status === "active" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}">${statusName(v.status)}</span>
      </div>
      <div class="mt-3 text-sm text-slate-600 space-y-1">
        <div>الشاسيه: ${esc(v.chassis || "-")}</div>
        <div>الموديل: ${esc(v.modelYear || "-")}</div>
        <div>السائق: ${esc(v.driver || "-")}</div>
        <div>الموقع: ${esc(v.location || "-")}</div>
        <div>ساعات التشغيل: ${num(v.hours)}</div>
        <div>الزيت: كل ${num(oilInt(v))} ساعة · ${left <= 0 ? "مستحق التغيير" : `متبقي ${num(left)} ساعة`}</div>
        <div>الرخصة: <span class="${lic.cls}">${esc(lic.text)}</span></div>
        ${fs ? `<div>الوقود: ${fmt(fs.liters)} لتر${fs.rate != null ? ` · ${fmt(fs.rate)} لتر/ساعة` : ""}</div>` : ""}
      </div>
      <div class="mt-3 flex gap-4 text-sm font-bold">
        <button data-edit="${esc(v.id)}" class="text-orange-600"><i class="fa-solid fa-pen ml-1"></i>تعديل</button>
        <button data-del="${esc(v.id)}" class="text-red-600"><i class="fa-solid fa-trash ml-1"></i>حذف</button>
      </div>
    </div>`;
  }).join("") || `<p class="text-slate-500">أضف أول معدة من النموذج أعلاه.</p>`;
}

function filtered() {
  const f = $("#r-from").value, t = $("#r-to").value, q = $("#r-q").value.trim().toLowerCase();
  return expenses.filter(e => (!f || e.date >= f) && (!t || e.date <= t) && (!q || vNo(e).toLowerCase().includes(q))).sort(byRecent);
}
function renderReport() {
  const rows = filtered();
  $("#r-body").innerHTML = rows.map(e => `
    <tr class="border-b last:border-0"><td class="py-2">${esc(e.date)}</td><td>${esc(vNo(e))}</td><td>${esc(catName(e.category))}</td>
    <td>${money(e.amount)}</td><td>${e.liters ? fmt(e.liters) : "-"}</td><td>${esc(e.notes)}</td>
    <td>${e.invoiceUrl ? `<a href="${esc(e.invoiceUrl)}" target="_blank" rel="noopener" class="text-orange-600"><i class="fa-solid fa-image"></i></a>` : "-"}</td>
    <td><button data-edit-exp="${esc(e.id)}" class="text-orange-600" aria-label="تعديل"><i class="fa-solid fa-pen"></i></button></td>
    <td><button data-del-exp="${esc(e.id)}" class="text-red-600" aria-label="حذف"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("")
    || `<tr><td colspan="9" class="py-4 text-slate-500">لا توجد نتائج.</td></tr>`;
  $("#r-total").textContent = `الإجمالي: ${money(rows.reduce((s, e) => s + e.amount, 0))}`;
}
["#r-from", "#r-to", "#r-q"].forEach(s => $(s).oninput = renderReport);

/* ---------- تصدير Excel: شيت المصروفات + شيت المعدات ---------- */
const EXP_HEAD = ["التاريخ", "رقم المعدة", "النوع", "المبلغ", "اللترات", "ساعات التشغيل عند التعبئة", "ملاحظات", "رابط الفاتورة"];
function sheetOf(rows, header) {
  const ws = XLSX.utils.json_to_sheet(rows, { header });
  ws["!cols"] = header.map(h => ({ wch: Math.max(h.length, 12) + 2 }));
  return ws;
}
$("#export-btn").onclick = () => {
  const rows = filtered().map(e => ({
    "التاريخ": e.date, "رقم المعدة": vNo(e), "النوع": catName(e.category),
    "المبلغ": e.amount, "اللترات": e.liters ?? "", "ساعات التشغيل عند التعبئة": e.hoursAtFill ?? "",
    "ملاحظات": e.notes || "", "رابط الفاتورة": e.invoiceUrl || ""
  }));
  const vrows = vehicles.map(v => {
    const lic = licenseInfo(v), fs = fuelStats(v.id);
    return {
      "النوع": v.type || "", "رقم المعدة": v.number || "", "رقم الشاسيه": v.chassis || "",
      "سنة الصنع / الموديل": v.modelYear || "", "اسم السائق": v.driver || "", "الموقع الحالي": v.location || "",
      "الحالة": statusName(v.status), "ساعات التشغيل الحالية": v.hours ?? 0, "ساعات آخر تغيير زيت": v.lastOil || 0,
      "فاصل تغيير الزيت (ساعات)": oilInt(v), "الساعات المتبقية لتغيير الزيت": oilLeft(v),
      "تاريخ انتهاء الرخصة": v.licenseExpiry || "", "حالة الرخصة": lic.days === null ? "" : lic.text,
      "إجمالي لترات الوقود": fs ? +fs.liters.toFixed(2) : "", "استهلاك الوقود (لتر/ساعة)": fs && fs.rate != null ? +fs.rate.toFixed(2) : ""
    };
  });
  if (!rows.length && !vrows.length) return alert("لا توجد بيانات للتصدير.");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetOf(rows, EXP_HEAD), "المصروفات");
  if (vrows.length) XLSX.utils.book_append_sheet(wb, sheetOf(vrows, Object.keys(vrows[0])), "المعدات");
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.writeFile(wb, `تقرير-فوزي-عبده-${today()}.xlsx`);
};

/* ---------- 7) النماذج ---------- */
async function guarded(e, fn) {
  e.preventDefault();
  const b = e.target.querySelector("button.btn"); b.disabled = true;
  try { await fn(Object.fromEntries(new FormData(e.target))); }
  catch (err) { console.error(err); alert("حدث خطأ أثناء الحفظ. حاول مرة أخرى."); }
  b.disabled = false;
}

const vForm = $("#vehicle-form"), eForm = $("#expense-form"), mForm = $("#edit-form"), modal = $("#edit-modal");
vForm.elements.type.onchange = () => toggleOther(vForm, "type", "customType");

/* --- المعدات --- */
function resetVehicleForm() {
  vForm.reset(); vForm.elements.vid.value = "";   // reset يعيد فاصل الزيت إلى 250
  toggleOther(vForm, "type", "customType");
  $("#v-cancel").classList.add("hidden");
}
$("#v-cancel").onclick = resetVehicleForm;

vForm.onsubmit = e => guarded(e, async f => {
  const id = f.vid; delete f.vid;
  if (f.type === OTHER) f.type = smartType(f.customType);   // "أخرى" ⇐ نحفظ النوع المكتوب
  delete f.customType;
  if (!f.type) return alert("أدخل نوع المعدة.");
  f.hours = +f.hours; f.lastOil = +f.lastOil || 0;
  f.oilInterval = +f.oilInterval > 0 ? +f.oilInterval : SETTINGS.oilInterval;
  f.modelYear = cleanName(f.modelYear); f.location = cleanName(f.location);
  f.licenseExpiry = f.licenseExpiry || "";
  await S.save("vehicles", f, id || undefined);
  resetVehicleForm(); await loadData();
});

async function removeItem(col, id, msg) {
  if (!confirm(msg)) return false;
  try { await S.remove(col, id); await loadData(); return true; }
  catch (err) { console.error(err); alert("تعذر الحذف. حاول مرة أخرى."); return false; }
}

/* لا يمكن حذف معدة لها مصروفات مسجّلة (يُفحص من قاعدة البيانات مباشرة) */
async function deleteVehicle(v) {
  let linked;
  try { linked = (await S.list("expenses")).filter(e => e.vehicleId === v.id); }
  catch (err) { console.error(err); return alert("تعذر التحقق من مصروفات المعدة. حاول مرة أخرى."); }
  if (linked.length) return alert(`لا يمكن حذف المعدة ${v.number} لأن لها ${linked.length} مصروف مسجّل. احذف مصروفاتها أولاً.`);
  if (await removeItem("vehicles", v.id, `هل تريد حذف المعدة ${v.number}؟`) && vForm.elements.vid.value === v.id) resetVehicleForm();
}

$("#v-list").onclick = ev => {
  const d = ev.target.closest("[data-del]");
  if (d) { const v = vehicles.find(x => x.id === d.dataset.del); return v && deleteVehicle(v); }
  const b = ev.target.closest("[data-edit]"); if (!b) return;
  const v = vehicles.find(x => x.id === b.dataset.edit), f = vForm;
  f.elements.vid.value = v.id;
  ["number", "chassis", "driver", "hours", "lastOil", "status", "modelYear", "location", "licenseExpiry"].forEach(k => f.elements[k].value = v[k] ?? "");
  f.elements.oilInterval.value = oilInt(v);
  // نوع غير موجود في القائمة = نوع مخصص ⇐ نعرضه في خانة "أخرى"
  const isStd = stdTypes().includes(v.type);
  f.elements.type.value = isStd ? v.type : OTHER;
  toggleOther(f, "type", "customType");
  if (!isStd) f.elements.customType.value = v.type || "";
  $("#v-cancel").classList.remove("hidden");
  f.scrollIntoView({ behavior: "smooth" });
};

/* --- المصروفات --- */
const fuelFields = (category, f) => category === "fuel"
  ? { liters: toNum(f.liters), hoursAtFill: toNum(f.hoursAtFill) }
  : { liters: null, hoursAtFill: null };
const resolveCategory = f => f.category === OTHER ? smartCategory(f.customCategory) : f.category; // "أخرى" ⇐ الاسم المكتوب

eForm.elements.category.onchange = () => syncCategory(eForm);
eForm.elements.vehicleId.onchange = () => prefillHours(eForm);
eForm.elements.hoursAtFill.oninput = e => { e.target.dataset.touched = "1"; };

function resetExpenseForm() {
  eForm.reset(); eForm.elements.date.value = today();
  delete eForm.elements.hoursAtFill.dataset.touched;
  syncCategory(eForm);
}

eForm.onsubmit = e => guarded(e, async f => {
  const v = vehicles.find(x => x.id === f.vehicleId);
  if (!v) return alert("اختر المعدة أولاً.");
  const category = resolveCategory(f);
  if (!category) return alert("أدخل اسم المصروف.");
  const file = f.invoice;
  const invoiceUrl = file && file.size ? await S.upload(file) : "";
  await S.save("expenses", { vehicleId: v.id, vehicleNo: v.number, category, amount: +f.amount, date: f.date, notes: f.notes, invoiceUrl, createdAt: Date.now(), ...fuelFields(category, f) });
  if (category === "oil") await S.save("vehicles", { lastOil: v.hours }, v.id); // يصفّر عداد تنبيه الزيت
  resetExpenseForm(); await loadData();
  alert("تم حفظ المصروف.");
});

/* --- نافذة تعديل المصروف --- */
mForm.elements.category.onchange = () => syncCategory(mForm);
mForm.elements.vehicleId.onchange = () => prefillHours(mForm);
mForm.elements.hoursAtFill.oninput = e => { e.target.dataset.touched = "1"; };

function closeEdit() {
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
  mForm.reset(); mForm.elements.eid.value = "";
  delete mForm.elements.hoursAtFill.dataset.touched;
}
$("#edit-cancel").onclick = closeEdit;
modal.onmousedown = ev => { if (ev.target === modal) closeEdit(); };
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !modal.classList.contains("hidden")) closeEdit(); });

function openEdit(e) {
  const f = mForm;
  f.reset(); delete f.elements.hoursAtFill.dataset.touched;
  f.elements.eid.value = e.id;
  const gone = !vehicles.some(v => v.id === e.vehicleId);        // معدة محذوفة سابقاً: نُبقي اختيارها كما هو
  f.elements.vehicleId.innerHTML = vehicleOptions(gone ? `<option value="${esc(e.vehicleId)}">${esc(e.vehicleNo)} (معدة محذوفة)</option>` : "");
  f.elements.vehicleId.value = e.vehicleId || "";
  const std = isStdCat(e.category);
  f.elements.category.value = std ? e.category : OTHER;
  if (Number.isFinite(e.hoursAtFill)) f.elements.hoursAtFill.dataset.touched = "1";
  syncCategory(f);
  if (!std) f.elements.customCategory.value = e.category || "";
  f.elements.amount.value = e.amount ?? "";
  f.elements.date.value = e.date || "";
  f.elements.notes.value = e.notes || "";
  f.elements.liters.value = e.liters ?? "";
  f.elements.hoursAtFill.value = e.hoursAtFill ?? f.elements.hoursAtFill.value;
  $("#edit-invoice-cur").innerHTML = e.invoiceUrl
    ? `<a href="${esc(e.invoiceUrl)}" target="_blank" rel="noopener" class="text-orange-600"><i class="fa-solid fa-image ml-1"></i>عرض الفاتورة الحالية</a>`
    : `<span class="text-slate-500">لا توجد فاتورة مرفوعة.</span>`;
  $("#edit-remove-wrap").classList.toggle("hidden", !e.invoiceUrl);
  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

mForm.onsubmit = e => guarded(e, async f => {
  const old = expenses.find(x => x.id === f.eid);
  if (!old) return alert("المصروف غير موجود.");
  const v = vehicles.find(x => x.id === f.vehicleId);
  let vehicleNo;
  if (v) vehicleNo = v.number;
  else if (f.vehicleId && f.vehicleId === old.vehicleId) vehicleNo = old.vehicleNo;
  else return alert("اختر المعدة أولاً.");
  const category = resolveCategory(f);
  if (!category) return alert("أدخل اسم المصروف.");
  let invoiceUrl = old.invoiceUrl || "";
  if (f.removeInvoice) invoiceUrl = "";
  if (f.invoice && f.invoice.size) invoiceUrl = await S.upload(f.invoice);
  await S.save("expenses", { vehicleId: f.vehicleId, vehicleNo, category, amount: +f.amount, date: f.date, notes: f.notes, invoiceUrl, ...fuelFields(category, f) }, old.id);
  closeEdit(); await loadData();
});

$("#r-body").onclick = ev => {
  const ed = ev.target.closest("[data-edit-exp]");
  if (ed) { const e = expenses.find(x => x.id === ed.dataset.editExp); return e && openEdit(e); }
  const d = ev.target.closest("[data-del-exp]"); if (!d) return;
  const e = expenses.find(x => x.id === d.dataset.delExp);
  if (e) removeItem("expenses", e.id, `هل تريد حذف مصروف ${catName(e.category)} بقيمة ${money(e.amount)}؟`);
};

/* =====================================================
   وحدات ERP الجديدة: العهد • مخزن قطع الغيار • التشغيل والمشاريع
   مستقلة تماماً عن المعدات والمصروفات والوقود والتصدير
   ===================================================== */
let advances = [], inventory = [], operations = [];
const modErr = {};                                    // أخطاء قراءة المجموعات الجديدة (غالباً قواعد Firestore)
async function listSafe(col) {
  try { modErr[col] = ""; return await S.list(col); }
  catch (err) { console.error(col, err); modErr[col] = err && err.code === "permission-denied" ? "perm" : "other"; return []; }
}
const MOD_WARN = { advances: "#adv-warn", inventory: "#inv-warn", operations: "#ops-warn" };
function renderModWarn() {
  Object.entries(MOD_WARN).forEach(([col, sel]) => {
    const el = $(sel), e = modErr[col];
    el.classList.toggle("hidden", !e);
    el.textContent = e === "perm"
      ? `لا توجد صلاحية لقراءة مجموعة «${col}» في Firestore. أضف لها قواعد الصلاحيات من Firebase Console ← Firestore ← Rules ثم حدّث الصفحة.`
      : e ? `تعذر تحميل بيانات هذه الوحدة (${col}). تأكد من الاتصال ثم حدّث الصفحة.` : "";
  });
}
function dbErr(err) {
  console.error(err);
  alert(err && err.code === "permission-denied"
    ? "لا توجد صلاحية للكتابة في Firestore لهذه الوحدة. أضف قواعد الصلاحيات للمجموعات الجديدة (advances / inventory / operations) ثم أعد المحاولة."
    : "حدث خطأ أثناء الحفظ. حاول مرة أخرى.");
}
const mod = fn => async (...a) => { try { return await fn(...a); } catch (err) { dbErr(err); } };
const freshDoc = async (col, id) => (await S.list(col)).find(x => x.id === id);   // قراءة حديثة قبل أي تعديل
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function refreshModuleSelects() {
  const keep = (sel, html) => { const cur = sel.value; sel.innerHTML = html; sel.value = cur; };
  keep($("#ops-vehicle"), vehicleOptions());
  keep($("#o-vehicle"), `<option value="">كل المعدات</option>` + vehicles.map(v => `<option value="${esc(v.id)}">${esc(v.number)} - ${esc(v.type)}</option>`).join(""));
}

/* ---------- 1) العهد والسلف ---------- */
const ADV_TYPES = ["كارتة", "نثريات", "إعاشة", "إصلاح طارئ"];
const aForm = $("#adv-form");
const advSpent = a => (a.items || []).reduce((s, i) => s + (+i.amount || 0), 0);
const advBal = a => (+a.amount || 0) - advSpent(a);
const drivers = () => uniq([...advances.map(a => a.driver), ...vehicles.map(v => v.driver)]);
const advTypesKnown = () => uniq([...ADV_TYPES, ...advances.flatMap(a => (a.items || []).map(i => i.type))]);

function resetAdvForm() { aForm.reset(); aForm.elements.date.value = today(); }

aForm.onsubmit = e => guarded(e, mod(async f => {
  const driver = smartName(f.driver, drivers());            // يوحّد كتابة اسم السائق
  if (!driver) return alert("أدخل اسم السائق.");
  const amount = toNum(f.amount);
  if (!(amount > 0)) return alert("أدخل مبلغ العهدة.");
  await S.save("advances", { driver, amount, date: f.date, notes: cleanName(f.notes), status: "open", items: [], createdAt: Date.now(), closedAt: null });
  resetAdvForm(); await loadData();
}));

function driverSummary() {
  const m = {};
  advances.forEach(a => {
    const d = (m[normAr(a.driver)] ||= { name: a.driver, n: 0, open: 0, given: 0, spent: 0, openBal: 0 });
    d.n++; d.given += +a.amount || 0; d.spent += advSpent(a);
    if (a.status === "open") { d.open++; d.openBal += advBal(a); }
  });
  return Object.values(m).sort((a, b) => b.openBal - a.openBal);
}

function advCard(a) {
  const spent = advSpent(a), bal = advBal(a), open = a.status === "open";
  const items = (a.items || []).map(i => `
    <li class="flex items-center gap-2 text-sm border-b last:border-0 py-1.5">
      <span class="flex-1"><b>${esc(i.type)}</b>${i.notes ? ` <span class="text-slate-500">· ${esc(i.notes)}</span>` : ""}<span class="block text-xs text-slate-400">${esc(i.date)}</span></span>
      <span class="font-bold">${money(i.amount)}</span>
      ${open ? `<button type="button" data-adv-item-del="${esc(a.id)}|${esc(i.id)}" class="text-red-600" aria-label="حذف المصروف"><i class="fa-solid fa-xmark"></i></button>` : ""}
    </li>`).join("") || `<li class="text-sm text-slate-500 py-1.5">لا توجد مصروفات طريق مسجلة.</li>`;
  const tail = open ? `
    <form data-adv-exp="${esc(a.id)}" class="mt-3 grid grid-cols-2 gap-2 bg-slate-50 rounded-xl p-3">
      <select name="type" data-adv-type class="inp">${ADV_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}<option value="other">أخرى</option></select>
      <input name="amount" type="number" min="0.01" step="0.01" class="inp" placeholder="المبلغ" required>
      <input name="customType" class="inp hidden col-span-2" placeholder="أدخل نوع المصروف" list="dl-adv-types" autocomplete="off">
      <input name="date" type="date" class="inp" value="${today()}" required>
      <input name="notes" class="inp" placeholder="ملاحظات">
      <button class="btn col-span-2">إضافة مصروف طريق</button>
    </form>
    <button type="button" data-adv-settle="${esc(a.id)}" class="btn-dark w-full mt-2"><i class="fa-solid fa-scale-balanced ml-2"></i>تصفية العهدة</button>`
    : `<div class="mt-3 rounded-xl p-3 text-sm ${bal > 0 ? "bg-amber-50 text-amber-800" : bal < 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}">
        <b>تمت التصفية</b> ${esc(a.closedDate || "")} — ${bal > 0 ? `الرصيد المتبقي ${money(bal)} يُرد للشركة` : bal < 0 ? `مستحق للسائق ${money(-bal)}` : "مسوّاة بالكامل"}
      </div>
      <button type="button" data-adv-reopen="${esc(a.id)}" class="mt-2 text-sm text-orange-600 font-bold">إعادة فتح العهدة</button>`;
  return `
    <div class="card" data-adv-card="${esc(a.id)}">
      <div class="flex justify-between items-start gap-2">
        <div><div class="font-extrabold text-lg">${esc(a.driver)}</div><div class="text-xs text-slate-500">${esc(a.date)}${a.notes ? ` · ${esc(a.notes)}` : ""}</div></div>
        <div class="flex items-center gap-2">
          <span class="text-xs px-2 py-1 rounded-full ${open ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}">${open ? "مفتوحة" : "مصفّاة"}</span>
          <button type="button" data-adv-del="${esc(a.id)}" class="text-red-600" aria-label="حذف العهدة"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-3 text-center">
        <div class="bg-slate-50 rounded-xl p-2"><div class="text-xs text-slate-500">العهدة</div><b>${money(a.amount)}</b></div>
        <div class="bg-slate-50 rounded-xl p-2"><div class="text-xs text-slate-500">المصروف</div><b>${money(spent)}</b></div>
        <div class="bg-slate-50 rounded-xl p-2"><div class="text-xs text-slate-500">الرصيد</div><b class="${bal < 0 ? "text-red-600" : ""}">${money(bal)}</b></div>
      </div>
      <ul class="mt-3">${items}</ul>
      ${tail}
    </div>`;
}

function renderAdvances() {
  $("#adv-summary").innerHTML = driverSummary().map(d => `
    <tr class="border-b last:border-0"><td class="py-2 font-bold">${esc(d.name)}</td><td>${d.n}</td><td>${d.open}</td>
    <td>${money(d.given)}</td><td>${money(d.spent)}</td><td class="font-bold ${d.openBal < 0 ? "text-red-600" : ""}">${money(d.openBal)}</td></tr>`).join("")
    || `<tr><td colspan="6" class="py-4 text-slate-500">لا توجد عهد بعد.</td></tr>`;
  const st = $("#adv-status").value, q = normAr($("#adv-q").value);
  const rows = advances.filter(a => (!st || a.status === st) && (!q || normAr(a.driver).includes(q)))
    .sort((a, b) => (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
  $("#adv-list").innerHTML = rows.map(advCard).join("") || `<p class="text-slate-500">لا توجد عهد مطابقة.</p>`;
}
["#adv-status", "#adv-q"].forEach(s => { $(s).oninput = renderAdvances; $(s).onchange = renderAdvances; });

const advRemoveItem = mod(async (aid, iid) => {
  const a = await freshDoc("advances", aid);
  if (!a || a.status !== "open") return alert("العهدة غير موجودة أو تمت تصفيتها.");
  if (!confirm("هل تريد حذف هذا المصروف من العهدة؟")) return;
  await S.save("advances", { items: (a.items || []).filter(i => i.id !== iid) }, aid);
  await loadData();
});
const advSettle = mod(async id => {
  const a = await freshDoc("advances", id);
  if (!a || a.status !== "open") return alert("العهدة غير موجودة أو تمت تصفيتها.");
  const spent = advSpent(a), bal = advBal(a);
  const res = bal > 0 ? `الرصيد المتبقي ${money(bal)} يرده السائق للشركة.` : bal < 0 ? `السائق صرف ${money(-bal)} زيادة عن العهدة (مستحق له).` : "العهدة مسوّاة بالكامل.";
  if (!confirm(`تصفية عهدة ${a.driver}؟\nالعهدة: ${money(a.amount)}\nالمصروف: ${money(spent)}\n${res}`)) return;
  await S.save("advances", { status: "closed", closedAt: Date.now(), closedDate: today(), spent, balance: bal }, id);
  await loadData();
});
const advReopen = mod(async id => {
  if (!confirm("إعادة فتح العهدة لتعديل مصروفاتها؟")) return;
  await S.save("advances", { status: "open", closedAt: null }, id);
  await loadData();
});

$("#adv-list").addEventListener("click", ev => {
  const t = ev.target, del = t.closest("[data-adv-del]"), itDel = t.closest("[data-adv-item-del]"),
    st = t.closest("[data-adv-settle]"), ro = t.closest("[data-adv-reopen]");
  if (del) { const a = advances.find(x => x.id === del.dataset.advDel); return a && removeItem("advances", a.id, `هل تريد حذف عهدة ${a.driver} بقيمة ${money(a.amount)} مع كل مصروفاتها؟`); }
  if (itDel) { const [aid, iid] = itDel.dataset.advItemDel.split("|"); return advRemoveItem(aid, iid); }
  if (st) return advSettle(st.dataset.advSettle);
  if (ro) return advReopen(ro.dataset.advReopen);
});
$("#adv-list").addEventListener("change", ev => {
  const sel = ev.target.closest("[data-adv-type]"); if (sel) toggleOther(sel.form, "type", "customType");
});
$("#adv-list").addEventListener("submit", ev => {            // إضافة مصروف طريق (كارتة، نثريات...)
  const form = ev.target.closest("[data-adv-exp]"); if (!form) return;
  guarded(ev, mod(async f => {
    const a = await freshDoc("advances", form.dataset.advExp);
    if (!a || a.status !== "open") return alert("العهدة غير موجودة أو تمت تصفيتها.");
    const amount = toNum(f.amount);
    if (!(amount > 0)) return alert("أدخل المبلغ.");
    const type = f.type === OTHER ? smartName(f.customType, advTypesKnown()) : f.type;
    if (!type) return alert("أدخل نوع المصروف.");
    const items = [...(a.items || []), { id: uid(), type, amount, date: f.date || today(), notes: cleanName(f.notes) }];
    await S.save("advances", { items }, a.id);
    await loadData();
  }));
});

/* ---------- 2) مخزن قطع الغيار ---------- */
const iForm = $("#inv-form");
const invStd = () => [...iForm.elements.category.options].map(o => o.value).filter(v => v !== OTHER);
const invCats = () => uniq([...invStd(), ...inventory.map(i => i.category)]);
const isLow = i => (Number(i.qty) || 0) < SETTINGS.lowStock;
function lowStockItems() { return inventory.filter(isLow).sort((a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0)); }
iForm.elements.category.onchange = () => toggleOther(iForm, "category", "customCategory");

function resetInvForm() {
  iForm.reset(); iForm.elements.iid.value = ""; iForm.elements.qty.disabled = false;
  $("#inv-qty-note").classList.add("hidden");
  toggleOther(iForm, "category", "customCategory");
  $("#inv-cancel").classList.add("hidden");
}
$("#inv-cancel").onclick = resetInvForm;

iForm.onsubmit = e => guarded(e, mod(async f => {
  const id = f.iid, name = cleanName(f.name);
  if (!name) return alert("أدخل اسم الصنف.");
  const category = f.category === OTHER ? smartName(f.customCategory, invCats()) : f.category;
  if (!category) return alert("أدخل اسم التصنيف.");
  const unit = cleanName(f.unit) || "قطعة";
  if (inventory.some(i => i.id !== id && normAr(i.name) === normAr(name))) return alert("هذا الصنف موجود بالفعل في المخزن.");
  if (id) await S.save("inventory", { name, category, unit }, id);          // الكمية تتعدل من أزرار الإضافة/الصرف فقط
  else {
    const qty = toNum(f.qty);
    if (qty === null || qty < 0) return alert("أدخل كمية صحيحة.");
    await S.save("inventory", { name, category, unit, qty, createdAt: Date.now(),
      log: qty > 0 ? [{ d: today(), t: "init", q: qty, bal: qty, note: "رصيد افتتاحي" }] : [] });
  }
  resetInvForm(); await loadData();
}));

function editInv(i) {
  const f = iForm;
  f.elements.iid.value = i.id; f.elements.name.value = i.name || ""; f.elements.unit.value = i.unit || "قطعة";
  const std = invStd().includes(i.category);
  f.elements.category.value = std ? i.category : OTHER;
  toggleOther(f, "category", "customCategory");
  if (!std) f.elements.customCategory.value = i.category || "";
  f.elements.qty.value = i.qty ?? 0; f.elements.qty.disabled = true;
  $("#inv-qty-note").classList.remove("hidden");
  $("#inv-cancel").classList.remove("hidden");
  f.scrollIntoView({ behavior: "smooth" });
}

function invCard(i) {
  const q = Number(i.qty) || 0, low = isLow(i), log = i.log || [];
  const rows = [...log].reverse().slice(0, 10).map(l => `
    <li class="flex justify-between gap-2 text-xs"><span>${esc(l.d)} · ${l.t === "out" ? "صرف" : l.t === "in" ? "إضافة" : "افتتاحي"} ${fmt(l.q)}${l.note ? ` · ${esc(l.note)}` : ""}</span><span class="text-slate-500">الرصيد ${fmt(l.bal)}</span></li>`).join("");
  return `
    <div class="card ${low ? "border-red-300 bg-red-50/50" : ""}" data-inv-card>
      <div class="flex justify-between items-start gap-2">
        <div><div class="text-xs text-slate-500">${esc(i.category)}</div><div class="font-extrabold">${esc(i.name)}</div></div>
        <span class="text-xs px-2 py-1 rounded-full font-bold ${low ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}">${q <= 0 ? "نفد" : low ? "منخفض" : "متوفر"}</span>
      </div>
      <div class="mt-2 text-3xl font-black ${low ? "text-red-600" : ""}">${fmt(q)} <span class="text-sm font-semibold text-slate-500">${esc(i.unit || "")}</span></div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <input data-qty type="number" min="0" step="any" class="inp" placeholder="الكمية">
        <input data-note class="inp" placeholder="ملاحظة / المعدة">
        <button type="button" data-inv-in="${esc(i.id)}" class="rounded-xl px-3 py-2 font-bold bg-green-600 hover:bg-green-700 text-white"><i class="fa-solid fa-plus ml-1"></i>إضافة</button>
        <button type="button" data-inv-out="${esc(i.id)}" class="rounded-xl px-3 py-2 font-bold bg-red-600 hover:bg-red-700 text-white"><i class="fa-solid fa-minus ml-1"></i>صرف</button>
      </div>
      <div class="mt-3 flex gap-4 text-sm font-bold">
        <button type="button" data-inv-edit="${esc(i.id)}" class="text-orange-600"><i class="fa-solid fa-pen ml-1"></i>تعديل</button>
        <button type="button" data-inv-del="${esc(i.id)}" class="text-red-600"><i class="fa-solid fa-trash ml-1"></i>حذف</button>
      </div>
      <details class="mt-3"><summary class="cursor-pointer text-sm text-slate-500">سجل الحركات (${log.length})</summary>
        <ul class="mt-2 space-y-1">${rows || `<li class="text-xs text-slate-500">لا توجد حركات.</li>`}</ul></details>
    </div>`;
}

function renderInventory() {
  const sel = $("#inv-cat"), cur = sel.value;
  sel.innerHTML = `<option value="">كل التصنيفات</option>` + uniq(inventory.map(i => i.category)).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  sel.value = cur;
  const q = normAr($("#inv-q").value), cat = sel.value, lowOnly = $("#inv-low").checked;
  const rows = inventory.filter(i => (!q || normAr(i.name).includes(q)) && (!cat || i.category === cat) && (!lowOnly || isLow(i)))
    .sort((a, b) => (isLow(a) ? 0 : 1) - (isLow(b) ? 0 : 1) || String(a.name).localeCompare(String(b.name), "ar"));
  $("#inv-list").innerHTML = rows.map(invCard).join("") || `<p class="text-slate-500">لا توجد أصناف. أضف أول صنف من النموذج أعلاه.</p>`;
}
["#inv-q", "#inv-cat", "#inv-low"].forEach(s => { $(s).oninput = renderInventory; $(s).onchange = renderInventory; });

const invAdjust = mod(async btn => {                         // إضافة / صرف كمية مع تسجيل الحركة
  const out = "invOut" in btn.dataset, id = btn.dataset.invIn || btn.dataset.invOut;
  const card = btn.closest("[data-inv-card]");
  const q = toNum(card.querySelector("[data-qty]").value), note = cleanName(card.querySelector("[data-note]").value);
  if (!(q > 0)) return alert("أدخل كمية أكبر من صفر.");
  const item = await freshDoc("inventory", id);
  if (!item) return alert("الصنف غير موجود.");
  const cur = Number(item.qty) || 0;
  if (out && q > cur) return alert(`الكمية المتاحة ${fmt(cur)} ${item.unit || ""} فقط.`);
  const bal = Math.round((out ? cur - q : cur + q) * 1000) / 1000;
  const log = [...(item.log || []), { d: today(), t: out ? "out" : "in", q, bal, note }].slice(-50);
  await S.save("inventory", { qty: bal, log }, id);
  await loadData();
});
$("#inv-list").addEventListener("click", ev => {
  const adj = ev.target.closest("[data-inv-in],[data-inv-out]"); if (adj) return invAdjust(adj);
  const ed = ev.target.closest("[data-inv-edit]");
  if (ed) { const i = inventory.find(x => x.id === ed.dataset.invEdit); return i && editInv(i); }
  const d = ev.target.closest("[data-inv-del]"); if (!d) return;
  const i = inventory.find(x => x.id === d.dataset.invDel);
  if (i) removeItem("inventory", i.id, `هل تريد حذف الصنف «${i.name}» من المخزن؟`).then(ok => { if (ok && iForm.elements.iid.value === i.id) resetInvForm(); });
});

/* ---------- 3) يومية التشغيل والمشاريع ---------- */
const UNITS = { trips: "نقلة", m3: "م³ خرسانة", hours: "ساعة عمل", ton: "طن أسفلت" };
const unitLabel = u => Object.prototype.hasOwnProperty.call(UNITS, u) ? UNITS[u] : (u || "");
const oForm = $("#ops-form");
const projects = () => uniq(operations.map(o => o.project));

function resetOpsForm() {
  oForm.reset(); oForm.elements.oid.value = ""; oForm.elements.date.value = today();
  $("#ops-cancel").classList.add("hidden");
}
$("#ops-cancel").onclick = resetOpsForm;

oForm.onsubmit = e => guarded(e, mod(async f => {
  const id = f.oid, old = id ? operations.find(x => x.id === id) : null;
  let v = vehicles.find(x => x.id === f.vehicleId);
  if (!v && old && old.vehicleId === f.vehicleId) v = { id: old.vehicleId, number: old.vehicleNo, type: old.vehicleType };   // معدة محذوفة
  if (!v) return alert("اختر المعدة أولاً.");
  const project = smartName(f.project, projects());           // يوحّد كتابة اسم المشروع
  if (!project) return alert("أدخل اسم الموقع / المشروع.");
  const amount = toNum(f.amount);
  if (!(amount > 0)) return alert("أدخل كمية الإنتاج.");
  const data = { vehicleId: v.id, vehicleNo: v.number, vehicleType: v.type || "", project, date: f.date, amount, unit: f.unit, notes: cleanName(f.notes) };
  await S.save("operations", id ? data : { ...data, createdAt: Date.now() }, id || undefined);
  resetOpsForm(); await loadData();
}));

function opsFiltered() {
  const fr = $("#o-from").value, to = $("#o-to").value, q = normAr($("#o-q").value), vid = $("#o-vehicle").value;
  return operations.filter(o => (!fr || o.date >= fr) && (!to || o.date <= to) && (!q || normAr(o.project).includes(q)) && (!vid || o.vehicleId === vid)).sort(byRecent);
}
function renderOps() {
  const rows = opsFiltered(), t = {}, pm = {};
  rows.forEach(o => {
    t[o.unit] = (t[o.unit] || 0) + (+o.amount || 0);
    const p = (pm[normAr(o.project)] ||= { name: o.project, n: 0 }); p.n++; p[o.unit] = (p[o.unit] || 0) + (+o.amount || 0);
  });
  $("#ops-totals").innerHTML = Object.keys(UNITS).filter(u => t[u]).map(u => `
    <div class="card py-2 px-4"><div class="text-xs text-slate-500">${UNITS[u]}</div><div class="text-xl font-extrabold">${fmt(t[u])}</div></div>`).join("")
    || `<p class="text-sm text-slate-500">لا توجد سجلات تشغيل ضمن الفلتر.</p>`;
  $("#ops-projects").innerHTML = Object.values(pm).sort((a, b) => b.n - a.n).map(p => `
    <tr class="border-b last:border-0"><td class="py-2 font-bold">${esc(p.name)}</td><td>${p.n}</td>
    ${["trips", "m3", "hours", "ton"].map(u => `<td>${p[u] ? fmt(p[u]) : "-"}</td>`).join("")}</tr>`).join("")
    || `<tr><td colspan="6" class="py-4 text-slate-500">لا توجد بيانات.</td></tr>`;
  $("#ops-body").innerHTML = rows.map(o => `
    <tr class="border-b last:border-0"><td class="py-2">${esc(o.date)}</td><td>${esc(vNo(o))}</td><td>${esc(o.project)}</td>
    <td class="font-bold">${fmt(o.amount)} ${esc(unitLabel(o.unit))}</td><td>${esc(o.notes)}</td>
    <td><button type="button" data-edit-op="${esc(o.id)}" class="text-orange-600" aria-label="تعديل"><i class="fa-solid fa-pen"></i></button></td>
    <td><button type="button" data-del-op="${esc(o.id)}" class="text-red-600" aria-label="حذف"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("")
    || `<tr><td colspan="7" class="py-4 text-slate-500">لا توجد سجلات.</td></tr>`;
}
["#o-from", "#o-to", "#o-q", "#o-vehicle"].forEach(s => { $(s).oninput = renderOps; $(s).onchange = renderOps; });

function editOp(o) {
  const f = oForm, gone = !vehicles.some(v => v.id === o.vehicleId);
  f.elements.vehicleId.innerHTML = vehicleOptions(gone ? `<option value="${esc(o.vehicleId)}">${esc(o.vehicleNo)} (معدة محذوفة)</option>` : "");
  f.elements.oid.value = o.id; f.elements.vehicleId.value = o.vehicleId || "";
  ["project", "date", "amount", "notes"].forEach(k => f.elements[k].value = o[k] ?? "");
  f.elements.unit.value = Object.prototype.hasOwnProperty.call(UNITS, o.unit) ? o.unit : "trips";
  $("#ops-cancel").classList.remove("hidden");
  f.scrollIntoView({ behavior: "smooth" });
}
$("#ops-body").onclick = ev => {
  const ed = ev.target.closest("[data-edit-op]");
  if (ed) { const o = operations.find(x => x.id === ed.dataset.editOp); return o && editOp(o); }
  const d = ev.target.closest("[data-del-op]"); if (!d) return;
  const o = operations.find(x => x.id === d.dataset.delOp);
  if (o) removeItem("operations", o.id, `هل تريد حذف يومية ${o.project} بتاريخ ${o.date}؟`).then(ok => { if (ok && oForm.elements.oid.value === o.id) resetOpsForm(); });
};

/* ---------- اقتراحات الوحدات الجديدة + مركز الإشعارات ---------- */
function renderModSuggestions() {
  const opt = arr => arr.map(x => `<option value="${esc(x)}"></option>`).join("");
  $("#dl-drivers").innerHTML = opt(drivers());
  $("#dl-adv-types").innerHTML = opt(advTypesKnown().filter(t => !ADV_TYPES.includes(t)));
  $("#dl-inv-cats").innerHTML = opt(invCats().filter(c => !invStd().includes(c)));
  $("#dl-units").innerHTML = opt(uniq(["قطعة", "برميل", "لتر", "علبة", "كيس", "متر", ...inventory.map(i => i.unit)]));
  $("#dl-projects").innerHTML = opt(projects());
}
$("#notif-tabs").onclick = ev => { const b = ev.target.closest("[data-notif]"); if (b) { notifFilter = b.dataset.notif; renderNotifs(); } };

/* ---------- 8) تسجيل الدخول والتشغيل ---------- */
const AUTH_MSG = {
  "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "auth/wrong-password": "كلمة المرور غير صحيحة.",
  "auth/user-not-found": "لا يوجد مستخدم بهذا البريد.",
  "auth/invalid-email": "صيغة البريد الإلكتروني غير صحيحة.",
  "auth/user-disabled": "هذا الحساب معطّل.",
  "auth/too-many-requests": "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.",
  "auth/network-request-failed": "مشكلة في الاتصال بالإنترنت.",
  "auth/operation-not-allowed": "تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في Firebase.",
  "auth/unauthorized-domain": `الدومين (${location.hostname || "هذا الموقع"}) غير مضاف في Firebase: Authentication ← Settings ← Authorized domains ← Add domain.`,
  "auth/invalid-api-key": "مفتاح Firebase (apiKey) غير صحيح.",
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "مفتاح Firebase (apiKey) غير صحيح."
};

async function doLogin() {
  const err = $("#login-error"), btn = $("#login-btn");
  const fail = (m, code) => {
    err.innerHTML = esc(m) + (code ? ` <span dir="ltr" class="font-mono">[${esc(code)}]</span>` : "");
    err.classList.remove("hidden");
  };
  err.classList.add("hidden");
  const email = $("#email").value.trim(), pass = $("#password").value;
  if (!email || !pass) return fail("أدخل البريد الإلكتروني وكلمة المرور.");
  if (!S) return fail("لم يكتمل الاتصال بـ Firebase. تأكد من الإنترنت ثم حدّث الصفحة.");
  btn.disabled = true;
  try { await S.login(email, pass); }
  catch (ex) {
    console.error(ex);
    const code = String((ex && (ex.code || ex.message)) || "");
    fail(AUTH_MSG[code] || "تعذر تسجيل الدخول. تأكد من البريد وكلمة المرور.", code);
  }
  btn.disabled = false;
}
$("#login-btn").onclick = doLogin;
$("#login-form").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); doLogin(); } }); // زر Enter
$("#logout").onclick = () => S.logout();

(async function boot() {
  try { S = LIVE ? await initLive() : initDemo(); }
  catch (err) { console.error(err); return alert("تعذر الاتصال بـ Firebase. راجع المفاتيح في app.js."); }
  $("#demo-note").classList.toggle("hidden", LIVE);
  resetExpenseForm(); resetAdvForm(); resetInvForm(); resetOpsForm();
  S.onAuth(user => {
    $("#login").classList.toggle("hidden", !!user);
    $("#app").classList.toggle("hidden", !user);
    if (user) { $("#user-email").textContent = user.email; show("dashboard"); loadData(); }
  });
})();
