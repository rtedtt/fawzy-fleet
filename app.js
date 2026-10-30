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
  const store = {
    vehicles: [
      { id: "1", type: "خلاطة", number: "خ 1234", chassis: "CH-1001", driver: "أحمد علي", hours: 1180, lastOil: 950, status: "active" },
      { id: "2", type: "لودر", number: "ل 5678", chassis: "CH-2002", driver: "محمد حسن", hours: 600, lastOil: 400, status: "maintenance" },
      { id: "3", type: "مضخة", number: "م 9012", chassis: "CH-3003", driver: "سعيد عمر", hours: 300, lastOil: 100, status: "active" }
    ],
    expenses: [{ id: "1", vehicleId: "1", vehicleNo: "خ 1234", category: "fuel", amount: 3500, date: t, notes: "تعبئة", invoiceUrl: "" }]
  };
  let user = null, cb = () => {};
  return {
    login: async (e, p) => { if (!e || !p) throw 0; user = { email: e }; cb(user); },
    logout: async () => { user = null; cb(null); },
    onAuth: f => { cb = f; f(user); },
    list: async c => store[c].map(x => ({ ...x })),
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
const num = n => Number(n || 0).toLocaleString("en-US");
const money = n => `${num(n)} ${SETTINGS.currency}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
let S, vehicles = [], expenses = [];

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
  renderDashboard(); renderVehicles(); renderReport();
  $("#exp-vehicle").innerHTML = `<option value="">اختر المعدة</option>` +
    vehicles.map(v => `<option value="${esc(v.id)}">${esc(v.number)} - ${esc(v.type)}</option>`).join("");
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
function renderReport() {
  const rows = filtered();
  $("#r-body").innerHTML = rows.map(e => `
    <tr class="border-b last:border-0"><td class="py-2">${esc(e.date)}</td><td>${esc(e.vehicleNo)}</td><td>${CATS[e.category] || ""}</td>
    <td>${money(e.amount)}</td><td>${esc(e.notes)}</td>
    <td>${e.invoiceUrl ? `<a href="${esc(e.invoiceUrl)}" target="_blank" rel="noopener" class="text-orange-600"><i class="fa-solid fa-image"></i></a>` : "-"}</td>
    <td><button data-del-exp="${esc(e.id)}" class="text-red-600" aria-label="حذف"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("")
    || `<tr><td colspan="7" class="py-4 text-slate-500">لا توجد نتائج.</td></tr>`;
  $("#r-total").textContent = `الإجمالي: ${money(rows.reduce((s, e) => s + e.amount, 0))}`;
}
["#r-from", "#r-to", "#r-q"].forEach(s => $(s).oninput = renderReport);

$("#export-btn").onclick = () => {
  const rows = filtered().map(e => ({
    "التاريخ": e.date, "رقم المعدة": e.vehicleNo, "النوع": CATS[e.category] || "",
    "المبلغ": e.amount, "ملاحظات": e.notes || "", "رابط الفاتورة": e.invoiceUrl || ""
  }));
  if (!rows.length) return alert("لا توجد بيانات للتصدير.");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "المصروفات");
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

function resetVehicleForm() {
  const f = $("#vehicle-form"); f.reset(); f.elements.vid.value = "";
  $("#v-cancel").classList.add("hidden");
}
$("#v-cancel").onclick = resetVehicleForm;

$("#vehicle-form").onsubmit = e => guarded(e, async f => {
  const id = f.vid; delete f.vid;
  f.hours = +f.hours; f.lastOil = +f.lastOil || 0;
  await S.save("vehicles", f, id || undefined);
  resetVehicleForm(); await loadData();
});

async function removeItem(col, id, msg) {
  if (!confirm(msg)) return;
  try { await S.remove(col, id); await loadData(); }
  catch (err) { console.error(err); alert("تعذر الحذف. حاول مرة أخرى."); }
}

$("#v-list").onclick = ev => {
  const d = ev.target.closest("[data-del]");
  if (d) {
    const v = vehicles.find(x => x.id === d.dataset.del);
    if ($("#vehicle-form").elements.vid.value === v.id) resetVehicleForm();
    return removeItem("vehicles", v.id, `هل تريد حذف المعدة ${v.number}؟ لن تُحذف مصروفاتها المسجلة.`);
  }
  const b = ev.target.closest("[data-edit]"); if (!b) return;
  const v = vehicles.find(x => x.id === b.dataset.edit), f = $("#vehicle-form");
  f.elements.vid.value = v.id;
  ["type", "number", "chassis", "driver", "hours", "lastOil", "status"].forEach(k => f.elements[k].value = v[k] ?? "");
  $("#v-cancel").classList.remove("hidden");
  f.scrollIntoView({ behavior: "smooth" });
};

$("#r-body").onclick = ev => {
  const d = ev.target.closest("[data-del-exp]"); if (!d) return;
  const e = expenses.find(x => x.id === d.dataset.delExp);
  removeItem("expenses", e.id, `هل تريد حذف مصروف ${CATS[e.category] || ""} بقيمة ${money(e.amount)}؟`);
};

function resetExpenseForm() { $("#expense-form").reset(); $("#expense-form").elements.date.value = today(); }

$("#expense-form").onsubmit = e => guarded(e, async f => {
  const v = vehicles.find(x => x.id === f.vehicleId);
  if (!v) return alert("اختر المعدة أولاً.");
  const file = f.invoice;
  const invoiceUrl = file && file.size ? await S.upload(file) : "";
  await S.save("expenses", { vehicleId: v.id, vehicleNo: v.number, category: f.category, amount: +f.amount, date: f.date, notes: f.notes, invoiceUrl });
  if (f.category === "oil") await S.save("vehicles", { lastOil: v.hours }, v.id); // يصفّر عداد تنبيه الزيت
  resetExpenseForm(); await loadData();
  alert("تم حفظ المصروف.");
});

/* ---------- 8) تسجيل الدخول والتشغيل ---------- */
async function doLogin() {
  const err = $("#login-error"), btn = $("#login-btn");
  const fail = m => { err.textContent = m; err.classList.remove("hidden"); };
  err.classList.add("hidden");
  const email = $("#email").value.trim(), pass = $("#password").value;
  if (!email || !pass) return fail("أدخل البريد الإلكتروني وكلمة المرور.");
  if (!S) return fail("لم يكتمل الاتصال بـ Firebase. تأكد من الإنترنت ثم حدّث الصفحة.");
  btn.disabled = true;
  try { await S.login(email, pass); }
  catch (ex) { console.error(ex); fail("تعذر تسجيل الدخول. تأكد من البريد وكلمة المرور." + (ex && ex.code ? ` (${ex.code})` : "")); }
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
