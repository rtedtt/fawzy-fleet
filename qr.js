/* =====================================================
   qr.js – مولّد QR Code محلي (SVG) + باركود المطور vCard
   المطور: بلال محمد سليمان | واتساب: 01128079357 | https://wa.me/201128079357
   بدون أي مكتبة خارجية أو اتصال بالإنترنت (بايت-مود UTF-8، تصحيح أخطاء M، إصدارات 1–10)
   ===================================================== */
(function (g) {
  "use strict";

  /* ---------- 1) خوارزمية QR ---------- */
  const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // المستوى M، الإصدارات 1..10
  const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

  function rawModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) { const na = Math.floor(ver / 7) + 2; r -= (25 * na - 10) * na - 55; if (ver >= 7) r -= 36; }
    return r;
  }
  const dataCapacity = ver => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver];

  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function rsDivisor(n) {
    const r = new Array(n).fill(0); r[n - 1] = 1;
    let root = 1;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) { r[j] = gfMul(r[j], root); if (j + 1 < n) r[j] ^= r[j + 1]; }
      root = gfMul(root, 2);
    }
    return r;
  }
  function rsRemainder(data, div) {
    const r = new Array(div.length).fill(0);
    for (const b of data) {
      const f = b ^ r.shift(); r.push(0);
      div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
    }
    return r;
  }

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    let ver = 1;
    for (; ver <= 10; ver++) {
      const countBits = ver < 10 ? 8 : 16;
      if (4 + countBits + bytes.length * 8 <= dataCapacity(ver) * 8) break;
    }
    if (ver > 10) throw new Error("النص أطول من سعة الباركود");

    /* تيار البتات: النمط + العدد + البيانات + الإنهاء + الحشو */
    const bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(0x4, 4); put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(b => put(b, 8));
    const cap = dataCapacity(ver) * 8;
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

    /* تقسيم إلى كتل + رموز تصحيح الأخطاء + التداخل */
    const nb = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver], rawCw = Math.floor(rawModules(ver) / 8);
    const nShort = nb - rawCw % nb, shortLen = Math.floor(rawCw / nb), div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const all = [];
    for (let i = 0; i < blocks[0].length; i++)
      blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) all.push(b[i]); });

    /* رسم المصفوفة */
    const size = ver * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setF = (x, y, v) => { m[y][x] = v; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, Math.max(Math.abs(dx), Math.abs(dy)) !== 2 && Math.max(Math.abs(dx), Math.abs(dy)) !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (ver > 1) {
      const na = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
      for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
      pos.forEach((cy, i) => pos.forEach((cx, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));
    }
    const fmt = mask => {                                   // مستوى M = 0
      const d = mask; let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412, bit = i => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
      setF(8, size - 8, true);
    };
    fmt(0);
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const b = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const c = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, d = Math.floor(i / 3);
        setF(a, d, c); setF(d, a, c);
      }
    }
    for (let i = 0, right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && i < all.length * 8) { m[y][x] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
      }
    }

    /* اختيار أفضل قناع (أقل عقوبة) */
    const cond = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const mask = k => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && cond[k](x, y)) m[y][x] = !m[y][x]; };
    const penalty = () => {
      let s = 0, dark = 0;
      const lines = [];
      for (let y = 0; y < size; y++) lines.push(m[y]);
      for (let x = 0; x < size; x++) lines.push(m.map(r => r[x]));
      lines.forEach(L => {
        let run = 1;
        for (let i = 1; i <= size; i++) {
          if (i < size && L[i] === L[i - 1]) run++; else { if (run >= 5) s += 3 + run - 5; run = 1; }
        }
        for (let i = 0; i + 11 <= size; i++) {
          const w = L.slice(i, i + 11).map(v => +v).join("");
          if (w === "10111010000" || w === "00001011101") s += 40;
        }
      });
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (m[y][x]) dark++;
        if (x + 1 < size && y + 1 < size && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) s += 3;
      }
      return s + (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
    };
    let best = 0, bestP = Infinity;
    for (let k = 0; k < 8; k++) {
      mask(k); fmt(k);
      const p = penalty();
      if (p < bestP) { bestP = p; best = k; }
      mask(k);                                              // إلغاء القناع (XOR مرتين)
    }
    mask(best); fmt(best);
    return { size, modules: m, version: ver };
  }

  /* ---------- 2) إخراج SVG بألوان الهوية وحواف دائرية ---------- */
  function svg(text, o) {
    o = Object.assign({ fg: "#1e3a5f", bg: "#ffffff", quiet: 2, radius: 3, label: "QR Code" }, o);
    const q = encode(text), n = q.size, t = n + o.quiet * 2;
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n;) {
        if (!q.modules[y][x]) { x++; continue; }
        let x2 = x; while (x2 < n && q.modules[y][x2]) x2++;
        d += `M${x + o.quiet} ${y + o.quiet}h${x2 - x}v1h-${x2 - x}z`; x = x2;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" role="img" aria-label="${o.label}" shape-rendering="crispEdges">` +
      `<rect width="${t}" height="${t}" rx="${o.radius}" fill="${o.bg}"/><path d="${d}" fill="${o.fg}"/></svg>`;
  }

  /* ---------- 3) بيانات المطور (vCard 3.0) ---------- */
  const DEV = {
    name: "بلال محمد سليمان", phone: "01128079357", wa: "https://wa.me/201128079357",
    vcard: "BEGIN:VCARD\r\nVERSION:3.0\r\nN:سليمان;بلال محمد;;;\r\nFN:بلال محمد سليمان\r\nTEL;TYPE=CELL,VOICE:01128079357\r\nEND:VCARD"
  };

  g.FZ = g.FZ || {};
  g.FZ.qr = { encode, svg };
  g.FZ.dev = DEV;

  /* ---------- 4) زر الهيدر + النافذة المنبثقة ---------- */
  if (typeof document === "undefined") return;
  function mount() {
    const header = document.querySelector("#app header");
    if (!header || document.querySelector("#dev-qr-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button"; btn.id = "dev-qr-btn"; btn.className = "dev-qr-btn no-print";
    btn.setAttribute("aria-label", "باركود المطور: " + DEV.name);
    btn.title = "تواصل مع المطور";
    btn.innerHTML = svg(DEV.vcard, { quiet: 1, radius: 2, label: "باركود المطور" });
    header.appendChild(btn);                                // آخر عنصر = أقصى يسار الشريط في الواجهة العربية

    const ov = document.createElement("div");
    ov.id = "dev-qr-modal"; ov.className = "hidden fixed inset-0 z-[70] bg-black/60 p-4 overflow-y-auto no-print";
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "dev-qr-title");
    ov.innerHTML = `<div class="dev-qr-card">
      <div class="dev-qr-big">${svg(DEV.vcard, { quiet: 2, radius: 4, label: "باركود المطور مكبّر" })}</div>
      <div id="dev-qr-title" class="font-extrabold text-lg mt-3">${DEV.name}</div>
      <div class="text-sm text-slate-500" dir="ltr">${DEV.phone}</div>
      <p class="text-xs text-slate-500 mt-2">امسح الباركود بكاميرا الهاتف لحفظ جهة الاتصال مباشرة.</p>
      <div class="flex gap-2 mt-4">
        <a href="${DEV.wa}" target="_blank" rel="noopener" class="btn flex-1 text-center"><i class="fa-brands fa-whatsapp ml-2"></i>تواصل واتساب</a>
        <button type="button" id="dev-qr-close" class="px-4 py-2.5 rounded-xl bg-slate-200 font-bold">إغلاق</button>
      </div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.classList.add("hidden");
    btn.onclick = () => { ov.classList.remove("hidden"); ov.querySelector("#dev-qr-close").focus(); };
    ov.querySelector("#dev-qr-close").onclick = close;
    ov.onmousedown = e => { if (e.target === ov) close(); };
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})(typeof window !== "undefined" ? window : globalThis);
