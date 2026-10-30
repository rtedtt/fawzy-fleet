/* =====================================================
   شركة فوزي عبده – إدارة الأسطول والصيانة | app.js
   ===================================================== */

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
  currency: "ج.م",   // العملة
  oilInterval: 250,  // ساعات التشغيل بين كل تغيير زيت
  oilWarnBefore: 30  // التنبيه قبل الموعد بكم ساعة
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
    async listWhere(col, field, value) {   // استعلام مباشر من Firestore (بيانات حديثة وليست من الذاكرة)
      const s = await fs.getDocs(fs.query(fs.collection(db, col), fs.where(field, "==", value)));
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
  const t = new Date().toISOString().slice(0, 10);
  const wk = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const store = {
    vehicles: [
      { id: "1", type: "خلاطة", number: "خ 1234", chassis: "CH-1001", driver: "أحمد علي", hours: 1180, lastOil: 950, status: "active" },
      { id: "2", type: "لودر", number: "ل 5678", chassis: "CH-2002", driver: "محمد حسن", hours: 600, lastOil: 400, status: "maintenance" },
      { id: "3", type: "مضخة", number: "م 9012", chassis: "CH-3003", driver: "سعيد عمر", hours: 300, lastOil: 100, status: "active" }
    ],
    expenses: [
      { id: "1", vehicleId: "1", vehicleNo: "خ 1234", category: "fuel", amount: 3500, date: t, notes: "تعبئة", invoiceUrl: "", liters: 240, engineHours: 1180 },
      { id: "2", vehicleId: "1", vehicleNo: "خ 1234", category: "fuel", amount: 2900, date: wk, notes: "تعبئة", invoiceUrl: "", liters: 200, engineHours: 1100 },
      { id: "3", vehicleId: "2", vehicleNo: "ل 5678", category: "غسيل المعدة", amount: 150, date: t, notes: "", invoiceUrl: "" }
    ]
  };
  let user = null, cb = () => {};
  return {
    login: async (e, p) => { if (!e || !p) throw 0; user = { email: e }; cb(user); },
    logout: async () => { user = null; cb(null); },
    onAuth: f => { cb = f; f(user); },
    list: async c => store[c].map(x => ({ ...x })),
    listWhere: async (c, field, value) => store[c].filter(x => x[field] === value).map(x => ({ ...x })),
    save: async (c, d, id) => {
      if (id) { Object.assign(store[c].find(x => x.id === id), d); return id; }
      const n = String(Date.now()); store[c].push({ ...d, id: n }); return n;
    },
    upload: async f => URL.createObjectURL(f),
    remove: async (c, id) => { store[c] = store[c].filter(x => x.id !== id); }
  };
}

/* ---------- 4) أدوات مساعدة ---------- */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const CATS = { fuel: "وقود", parts: "قطع غيار", oil: "تغيير زيت", tires: "إطارات" };
const catName = c => CATS[c] || c || "";   // التصنيف المخصص (أخرى) يُحفظ باسمه مباشرة ويُعرض كما هو
const OTHER = "other";                     // قيمة خيار "أخرى" في القوائم المنسدلة
const num = n => Number(n || 0).toLocaleString("en-US");
const dec = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const money = n => `${num(n)} ${SETTINGS.currency}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const hasNum = v => typeof v === "number" && Number.isFinite(v);
let S, vehicles = [], expenses = [];

/* توحيد الكتابة العربية للمقارنة فقط (تشكيل/تطويل/همزات/ة-ه/ى-ي) */
const normAr = s => String(s || "").trim().replace(/\s+/g, " ")
  .replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا")
  .replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase();

/* أسماء المصروفات المخصصة المستخدمة سابقاً، الأكثر استخداماً أولاً.
   الأسماء المتشابهة (مسافات/همزات/تشكيل) تُدمج تحت أكثر صيغة مستخدمة. */
function customCats() {
  const groups = new Map();
  expenses.forEach(e => {
    const c = String(e.category || "").trim();
    if (!c || CATS[c] || c === OTHER) return;
    const k = normAr(c), g = groups.get(k) || { count: 0, variants: {} };
    g.count++; g.variants[c] = (g.variants[c] || 0) + 1;
    groups.set(k, g);
  });
  return [...groups.entries()].map(([key, g]) => ({
    key, count: g.count,
    name: Object.entries(g.variants).sort((a, b) => b[1] - a[1])[0][0]
  })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar"));
}

/* تحويل اختيار القائمة (+ الاسم المكتوب في "أخرى") إلى قيمة التصنيف النهائية:
   - اسم يطابق تصنيفاً أساسياً (مثل "وقود") ⇐ يُحفظ بمفتاحه الأساسي
   - اسم يطابق تصنيفاً مخصصاً سابقاً ⇐ يُعاد استخدام نفس الصيغة المسجّلة */
function resolveCategory(sel, custom) {
  if (sel !== OTHER) return sel;
  const name = String(custom || "").trim().replace(/\s+/g, " ");
  if (!name) return "";
  const k = normAr(name);
  const std = Object.keys(CATS).find(key => key === k || normAr(CATS[key]) === k);
  if (std) return std;
  const known = customCats().find(c => c.key === k);
  return known ? known.name : name;
}
const currentCategory = form => resolveCategory(form.elements.category.value, form.elements.customCategory.value);

/* إظهار/إخفاء حقل النص الخاص بخيار "أخرى" (ومعه شرائح الاقتراحات إن وُجدت) */
function toggleOther(form, selName, inpName) {
  const on = form.elements[selName].value === OTHER, el = form.elements[inpName];
  el.classList.toggle("hidden", !on);
  el.required = on;
  const box = el.parentElement.querySelector("[data-sugg]");
  if (box) box.classList.toggle("hidden", !on);
  if (!on) el.value = "";
  else el.focus();
}

/* إظهار حقول اللترات والساعات عند اختيار "وقود" فقط */
function toggleFuel(form) {
  const on = currentCategory(form) === "fuel";
  form.querySelector("[data-fuel]").classList.toggle("hidden", !on);
  if (!on) { form.elements.liters.value = ""; form.elements.engineHours.value = ""; }
  if (form === eForm) hintHours();
}
function hintHours() {   // يعرض ساعات المعدة الحالية كتلميح داخل الحقل
  const v = vehicles.find(x => x.id === eForm.elements.vehicleId.value);
  eForm.elements.engineHours.placeholder = v ? `الحالي: ${num(v.hours)}` : "";
}
function bindCategory(form) {
  form.elements.category.onchange = () => { toggleOther(form, "category", "customCategory"); toggleFuel(form); };
  form.elements.customCategory.oninput = () => toggleFuel(form);
}

/* تحديث قائمة الاقتراحات (datalist + شرائح قابلة للضغط) */
function renderSuggestions() {
  const list = customCats();
  $("#cat-suggestions").innerHTML = list.map(c => `<option value="${esc(c.name)}"></option>`).join("");
  $$("[data-sugg]").forEach(box => {
    box.innerHTML = list.length
      ? `<span class="text-xs text-slate-500">استخدمتها سابقاً:</span>` +
        list.slice(0, 8).map(c => `<button type="button" class="chip" data-sugg-val="${esc(c.name)}">${esc(c.name)}</button>`).join("")
      : "";
  });
}
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-sugg-val]"); if (!b) return;
  const f = b.closest("form"), inp = f.elements.customCategory;
  inp.value = b.dataset.suggVal; inp.focus();
  toggleFuel(f);
});

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
$("#menu-btn").onclick = () => menu(true);
$("#overlay").onclick = () => menu(false);

/* ---------- 6) العرض ---------- */
async function loadData() {
  [vehicles, expenses] = await Promise.all([S.list("vehicles"), S.list("expenses")]);
  renderDashboard(); renderVehicles(); renderReport(); renderSuggestions();
  const sel = $("#exp-vehicle"), keep = sel.value;
  sel.innerHTML = `<option value="">اختر المعدة</option>` +
    vehicles.map(v => `<option value="${esc(v.id)}">${esc(v.number)} - ${esc(v.type)}</option>`).join("");
  if (vehicles.some(v => v.id === keep)) sel.value = keep;
  hintHours();
}

function renderDashboard() {
  const ym = today().slice(0, 7);
  $("#k-exp").textContent = money(expenses.filter(e => (e.date || "").startsWith(ym)).reduce((s, e) => s + e.amount, 0));
  $("#k-active").textContent = vehicles.filter(v => v.status === "active").length;
  $("#k-maint").textContent = vehicles.filter(v => v.status === "maintenance").length;
  const al = vehicles.map(v => ({ v, left: (v.lastOil || 0) + SETTINGS.oilInterval - v.hours }))
    .filter(a => a.left <= SETTINGS.oilWarnBefore).sort((a, b) => a.left - b.left);
  $("#alerts").innerHTML = al.length ? al.map(({ v, left }) => `
    <div class="flex items-center gap-3 p-3 rounded-xl ${left <= 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}">
      <i class="fa-solid fa-oil-can"></i><b>${esc(v.number)}</b>
      <span class="text-sm">${left <= 0 ? `تجاوزت موعد تغيير الزيت بـ ${num(-left)} ساعة` : `متبقي ${num(left)} ساعة على تغيير الزيت`}</span>
    </div>`).join("") : `<p class="text-sm text-slate-500">لا توجد تنبيهات حالياً.</p>`;
}

function renderVehicles() {
  $("#v-list").innerHTML = vehicles.map(v => `
    <div class="card">
      <div class="flex justify-between items-start">
        <div><div class="text-xs text-slate-500">${esc(v.type)}</div><div class="text-lg font-extrabold">${esc(v.number)}</div></div>
        <span class="text-xs px-2 py-1 rounded-full ${v.status === "active" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}">${v.status === "active" ? "يعمل" : "في الصيانة"}</span>
      </div>
      <div class="mt-3 text-sm text-slate-600 space-y-1">
        <div>الشاسيه: ${esc(v.chassis || "-")}</div>
        <div>السائق: ${esc(v.driver || "-")}</div>
        <div>ساعات التشغيل: ${num(v.hours)}</div>
      </div>
      <div class="mt-3 flex gap-4 text-sm font-bold">
        <button data-edit="${esc(v.id)}" class="text-orange-600"><i class="fa-solid fa-pen ml-1"></i>تعديل</button>
        <button data-del="${esc(v.id)}" class="text-red-600"><i class="fa-solid fa-trash ml-1"></i>حذف</button>
      </div>
    </div>`).join("") || `<p class="text-slate-500">أضف أول معدة من النموذج أعلاه.</p>`;
}

function filtered() {
  const f = $("#r-from").value, t = $("#r-to").value, q = $("#r-q").value.trim().toLowerCase();
  return expenses.filter(e => (!f || e.date >= f) && (!t || e.date <= t) && (!q || (e.vehicleNo || "").toLowerCase().includes(q)))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/* إحصائيات استهلاك الوقود لكل معدة.
   طريقة "التعبئات المتتالية": لترات كل تعبئة عدا الأولى ÷ ساعات التشغيل بين أول وآخر تعبئة،
   لأن لترات التعبئة تغطي الساعات التي عملتها المعدة قبلها. */
function fuelStats(rows) {
  const by = new Map();
  rows.filter(e => e.category === "fuel").forEach(e => {
    const k = e.vehicleId || e.vehicleNo;
    if (!by.has(k)) by.set(k, { no: e.vehicleNo, fills: [] });
    by.get(k).fills.push(e);
  });
  const sum = (a, key) => a.reduce((s, e) => s + (+e[key] || 0), 0);
  return [...by.values()].map(g => {
    const wl = g.fills.filter(e => e.liters > 0);
    const liters = sum(wl, "liters"), cost = sum(wl, "amount");
    const wh = wl.filter(e => hasNum(e.engineHours)).sort((a, b) => a.engineHours - b.engineHours);
    let span = null, lph = null, cph = null;
    if (wh.length >= 2) {
      span = wh[wh.length - 1].engineHours - wh[0].engineHours;
      if (span > 0) {
        const used = wh.slice(1);
        lph = sum(used, "liters") / span;
        cph = sum(used, "amount") / span;
      }
    }
    return { no: g.no, fills: g.fills.length, liters, ppl: liters ? cost / liters : null, span, lph, cph };
  }).sort((a, b) => String(a.no).localeCompare(String(b.no), "ar"));
}

function renderFuel(rows) {
  const st = fuelStats(rows), dash = `<span class="text-slate-400">—</span>`;
  $("#fuel-body").innerHTML = st.map(s => `
    <tr class="border-b last:border-0"><td class="py-2 font-bold">${esc(s.no)}</td><td>${num(s.fills)}</td>
    <td>${s.liters ? dec(s.liters) : dash}</td><td>${s.ppl != null ? money(dec(s.ppl)) : dash}</td>
    <td>${s.span != null ? dec(s.span) : dash}</td>
    <td class="font-bold text-orange-600">${s.lph != null ? dec(s.lph) : dash}</td>
    <td>${s.cph != null ? money(dec(s.cph)) : dash}</td></tr>`).join("")
    || `<tr><td colspan="7" class="py-4 text-slate-500">لا توجد تعبئات وقود في هذه الفترة. سجّل اللترات وساعات التشغيل مع كل مصروف وقود.</td></tr>`;
}

function renderReport() {
  const rows = filtered();
  $("#r-body").innerHTML = rows.map(e => `
    <tr class="border-b last:border-0"><td class="py-2">${esc(e.date)}</td><td>${esc(e.vehicleNo)}</td><td>${esc(catName(e.category))}</td>
    <td>${money(e.amount)}</td>
    <td>${e.liters > 0 ? dec(e.liters) : "-"}</td><td>${hasNum(e.engineHours) ? dec(e.engineHours) : "-"}</td>
    <td>${esc(e.notes)}</td>
    <td>${e.invoiceUrl ? `<a href="${esc(e.invoiceUrl)}" target="_blank" rel="noopener" class="text-orange-600"><i class="fa-solid fa-image"></i></a>` : "-"}</td>
    <td>
      <button data-edit-exp="${esc(e.id)}" class="text-orange-600 ml-3" aria-label="تعديل"><i class="fa-solid fa-pen"></i></button>
      <button data-del-exp="${esc(e.id)}" class="text-red-600" aria-label="حذف"><i class="fa-solid fa-trash"></i></button>
    </td></tr>`).join("")
    || `<tr><td colspan="9" class="py-4 text-slate-500">لا توجد نتائج.</td></tr>`;
  $("#r-total").textContent = `الإجمالي: ${money(rows.reduce((s, e) => s + e.amount, 0))}`;
  renderFuel(rows);
}
["#r-from", "#r-to", "#r-q"].forEach(s => $(s).oninput = renderReport);

$("#export-btn").onclick = () => {
  const list = filtered();
  const rows = list.map(e => ({
    "التاريخ": e.date, "رقم المعدة": e.vehicleNo, "النوع": catName(e.category),
    "المبلغ": e.amount, "عدد اللترات": e.liters ?? "", "ساعات التشغيل": e.engineHours ?? "",
    "ملاحظات": e.notes || "", "رابط الفاتورة": e.invoiceUrl || ""
  }));
  if (!rows.length) return alert("لا توجد بيانات للتصدير.");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "المصروفات");
  const st = fuelStats(list).map(s => ({
    "رقم المعدة": s.no, "عدد التعبئات": s.fills, "إجمالي اللترات": s.liters || "",
    "سعر اللتر": s.ppl != null ? +s.ppl.toFixed(2) : "", "ساعات التشغيل": s.span ?? "",
    "لتر/ساعة": s.lph != null ? +s.lph.toFixed(2) : "", "تكلفة/ساعة": s.cph != null ? +s.cph.toFixed(2) : ""
  }));
  if (st.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(st), "كفاءة الوقود");
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

/* --- المعدات --- */
const vForm = $("#vehicle-form"), eForm = $("#expense-form"), edForm = $("#edit-form");
vForm.elements.type.onchange = () => toggleOther(vForm, "type", "customType");
bindCategory(eForm);
bindCategory(edForm);
eForm.elements.vehicleId.onchange = hintHours;

function resetVehicleForm() {
  vForm.reset(); vForm.elements.vid.value = "";
  toggleOther(vForm, "type", "customType");
  $("#v-cancel").classList.add("hidden");
}
$("#v-cancel").onclick = resetVehicleForm;

vForm.onsubmit = e => guarded(e, async f => {
  const id = f.vid; delete f.vid;
  if (f.type === OTHER) f.type = (f.customType || "").trim();   // "أخرى" ⇐ نحفظ النوع المكتوب
  delete f.customType;
  if (!f.type) return alert("أدخل نوع المعدة.");
  f.hours = +f.hours; f.lastOil = +f.lastOil || 0;
  await S.save("vehicles", f, id || undefined);
  resetVehicleForm(); await loadData();
});

async function removeItem(col, id, msg) {
  if (!confirm(msg)) return;
  try { await S.remove(col, id); await loadData(); }
  catch (err) { console.error(err); alert("تعذر الحذف. حاول مرة أخرى."); }
}

/* حذف معدة: يُمنع إذا كانت لها مصروفات مسجلة للحفاظ على سلامة البيانات.
   الفحص يتم بالاستعلام المباشر من Firestore وليس من الذاكرة المحلية. */
async function deleteVehicle(id) {
  const v = vehicles.find(x => x.id === id); if (!v) return;
  let linked;
  try { linked = await S.listWhere("expenses", "vehicleId", v.id); }
  catch (err) {
    console.error(err);
    return alert("تعذر التحقق من مصروفات المعدة، لذلك لم يتم الحذف. حاول مرة أخرى.");
  }
  if (linked.length) {
    return alert(`لا يمكن حذف المعدة ${v.number} لأن لها مصروفات مسجّلة (العدد: ${linked.length}).\n` +
      `حذفها سيُفقد سجل مصروفاتها ويخلّ بالتقارير. إذا كانت المعدة خرجت من الخدمة غيّر حالتها بدلاً من حذفها، ` +
      `أو احذف مصروفاتها أولاً من صفحة البحث والتقارير إن كنت متأكداً.`);
  }
  if (vForm.elements.vid.value === v.id) resetVehicleForm();
  await removeItem("vehicles", v.id, `هل تريد حذف المعدة ${v.number}؟`);
}

$("#v-list").onclick = ev => {
  const d = ev.target.closest("[data-del]");
  if (d) return deleteVehicle(d.dataset.del);
  const b = ev.target.closest("[data-edit]"); if (!b) return;
  const v = vehicles.find(x => x.id === b.dataset.edit), f = vForm;
  f.elements.vid.value = v.id;
  ["number", "chassis", "driver", "hours", "lastOil", "status"].forEach(k => f.elements[k].value = v[k] ?? "");
  // نوع غير موجود في القائمة = نوع مخصص ⇐ نعرضه في خانة "أخرى"
  const std = [...f.elements.type.options].map(o => o.value).filter(x => x !== OTHER);
  const isStd = std.includes(v.type);
  f.elements.type.value = isStd ? v.type : OTHER;
  toggleOther(f, "type", "customType");
  if (!isStd) f.elements.customType.value = v.type || "";
  $("#v-cancel").classList.remove("hidden");
  f.scrollIntoView({ behavior: "smooth" });
};

/* --- تعديل المصروف (نافذة منبثقة) --- */
const modal = $("#edit-modal");
function openEdit(e) {
  const f = edForm;
  f.elements.eid.value = e.id;
  $("#edit-vehicle").textContent = e.vehicleNo || "";
  const isStd = !!CATS[e.category];
  f.elements.category.value = isStd ? e.category : OTHER;
  toggleOther(f, "category", "customCategory");
  if (!isStd) f.elements.customCategory.value = e.category || "";
  toggleFuel(f);
  f.elements.amount.value = e.amount ?? "";
  f.elements.date.value = e.date || "";
  f.elements.notes.value = e.notes || "";
  f.elements.liters.value = e.liters ?? "";
  f.elements.engineHours.value = e.engineHours ?? "";
  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
  f.elements.amount.focus();
}
function closeEdit() {
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
  edForm.reset(); toggleOther(edForm, "category", "customCategory"); toggleFuel(edForm);
}
$("#edit-close").onclick = $("#edit-cancel").onclick = closeEdit;
modal.onclick = ev => { if (ev.target === modal) closeEdit(); };
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !modal.classList.contains("hidden")) closeEdit(); });

edForm.onsubmit = e => guarded(e, async f => {
  const old = expenses.find(x => x.id === f.eid);
  if (!old) return alert("تعذر العثور على هذا المصروف. حدّث الصفحة وحاول مرة أخرى.");
  const category = resolveCategory(f.category, f.customCategory);
  if (!category) return alert("أدخل اسم المصروف.");
  const isFuel = category === "fuel";
  await S.save("expenses", {
    category, amount: +f.amount, date: f.date, notes: (f.notes || "").trim(),
    liters: isFuel && f.liters !== "" ? +f.liters : null,
    engineHours: isFuel && f.engineHours !== "" ? +f.engineHours : null
  }, old.id);
  closeEdit(); await loadData();
  alert("تم تعديل المصروف.");
});

$("#r-body").onclick = ev => {
  const ed = ev.target.closest("[data-edit-exp]");
  if (ed) { const e = expenses.find(x => x.id === ed.dataset.editExp); if (e) openEdit(e); return; }
  const d = ev.target.closest("[data-del-exp]"); if (!d) return;
  const e = expenses.find(x => x.id === d.dataset.delExp);
  removeItem("expenses", e.id, `هل تريد حذف مصروف ${catName(e.category)} بقيمة ${money(e.amount)}؟`);
};

/* --- المصروفات --- */
function resetExpenseForm() {
  eForm.reset(); eForm.elements.date.value = today();
  toggleOther(eForm, "category", "customCategory");
  toggleFuel(eForm);
}

eForm.onsubmit = e => guarded(e, async f => {
  const v = vehicles.find(x => x.id === f.vehicleId);
  if (!v) return alert("اختر المعدة أولاً.");
  const category = resolveCategory(f.category, f.customCategory);   // "أخرى" ⇐ نحفظ الاسم المكتوب (موحّداً مع السابق)
  if (!category) return alert("أدخل اسم المصروف.");

  const isFuel = category === "fuel";
  const liters = isFuel && f.liters !== "" ? +f.liters : null;
  const engineHours = isFuel && f.engineHours !== "" ? +f.engineHours : null;
  if (engineHours !== null && engineHours < v.hours &&
      !confirm(`ساعات التشغيل المُدخلة (${num(engineHours)}) أقل من الساعات الحالية للمعدة (${num(v.hours)}). هل تريد المتابعة؟`)) return;

  const file = f.invoice;
  const invoiceUrl = file && file.size ? await S.upload(file) : "";
  const data = { vehicleId: v.id, vehicleNo: v.number, category, amount: +f.amount, date: f.date, notes: f.notes, invoiceUrl };
  if (liters !== null) data.liters = liters;
  if (engineHours !== null) data.engineHours = engineHours;
  await S.save("expenses", data);

  if (category === "oil") await S.save("vehicles", { lastOil: v.hours }, v.id);   // يصفّر عداد تنبيه الزيت
  else if (engineHours !== null && f.syncHours && engineHours > v.hours)          // يحدّث ساعات المعدة بآخر قراءة
    await S.save("vehicles", { hours: engineHours }, v.id);

  resetExpenseForm(); await loadData();
  alert("تم حفظ المصروف.");
});

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
  "auth/unauthorized-domain": "هذا الدومين غير مضاف في Authorized domains داخل Firebase.",
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
