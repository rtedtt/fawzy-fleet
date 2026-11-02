/* =====================================================
   شركة فوزي عبده – إدارة الأسطول والصيانة | app.js
   ===================================================== */

/* ---------- 0) حماية الكاش ----------
   لو المتصفح حمّل index.html قديماً (من الكاش) مع app.js جديد، يتعطل كل شيء بصمت.
   نكتشف ذلك ونعيد تحميل الصفحة مرة واحدة، وإن استمرت المشكلة نعرض رسالة واضحة. */
if (!document.querySelector("#edit-modal")) {
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
  recentCount: 5       // عدد أحدث المصروفات في الرئيسية
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
  const sel = $("#exp-vehicle"), cur = sel.value;
  sel.innerHTML = vehicleOptions(); sel.value = cur;
  renderSuggestions(); renderDashboard(); renderVehicles(); renderReport();
}

function renderDashboard() {
  const ym = today().slice(0, 7);
  $("#k-exp").textContent = money(expenses.filter(e => (e.date || "").startsWith(ym)).reduce((s, e) => s + e.amount, 0));
  $("#k-active").textContent = vehicles.filter(v => v.status === "active").length;
  $("#k-maint").textContent = vehicles.filter(v => v.status === "maintenance").length;

  const lic = licenseAlerts();
  $("#k-lic").textContent = lic.length;
  $("#k-lic").classList.toggle("text-red-600", lic.length > 0);

  // تنبيهات الزيت: تعتمد على فاصل كل معدة (oilInterval)
  const al = vehicles.map(v => ({ v, left: oilLeft(v) })).filter(a => a.left <= SETTINGS.oilWarnBefore).sort((a, b) => a.left - b.left);
  $("#alerts").innerHTML = al.length ? al.map(({ v, left }) => `
    <div class="flex items-center gap-3 p-3 rounded-xl ${left <= 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}">
      <i class="fa-solid fa-oil-can"></i><b>${esc(v.number)}</b>
      <span class="text-sm">${left < 0 ? `تجاوزت موعد تغيير الزيت بـ ${num(-left)} ساعة` : left === 0 ? "حان موعد تغيير الزيت الآن" : `متبقي ${num(left)} ساعة على تغيير الزيت`}</span>
    </div>`).join("") : `<p class="text-sm text-slate-500">لا توجد تنبيهات حالياً.</p>`;

  // تنبيهات الرخص: أحمر = منتهية/اليوم، برتقالي = خلال المهلة
  $("#lic-alerts").innerHTML = lic.length ? lic.map(({ v, days }) => `
    <div class="flex items-center gap-3 p-3 rounded-xl ${days <= 0 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}">
      <i class="fa-solid fa-id-card"></i><b>${esc(v.number)}</b>
      <span class="text-sm">${esc(licenseInfo(v).text)}</span>
    </div>`).join("") : `<p class="text-sm text-slate-500">لا توجد رخص منتهية أو قاربت على الانتهاء.</p>`;

  // أحدث المصروفات
  const rec = [...expenses].sort(byRecent).slice(0, SETTINGS.recentCount);
  $("#recent-body").innerHTML = rec.map(e => `
    <tr class="border-b last:border-0"><td class="py-2">${esc(e.date)}</td><td>${esc(vNo(e))}</td><td>${esc(catName(e.category))}</td>
    <td>${money(e.amount)}</td><td>${esc(e.notes)}</td></tr>`).join("")
    || `<tr><td colspan="5" class="py-4 text-slate-500">لا توجد مصروفات بعد.</td></tr>`;
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
  resetExpenseForm();
  S.onAuth(user => {
    $("#login").classList.toggle("hidden", !!user);
    $("#app").classList.toggle("hidden", !user);
    if (user) { $("#user-email").textContent = user.email; show("dashboard"); loadData(); }
  });
})();
