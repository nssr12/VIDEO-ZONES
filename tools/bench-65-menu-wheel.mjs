// البند #65 — العجلة تُختطف فوق قائمة قابلة للتمرير موضوعة على الفيديو.
//
// **تشخيص فقط. لا سطر إصلاح.**
//
// ⚠️ يحتاج كروم مثبَّتاً. **لا يُشحن.**
//   node tools/bench-65-menu-wheel.mjs           # المنصّة المحلية (بلا شبكة)
//   node tools/bench-65-menu-wheel.mjs --hosts   # ومعها يوتيوب وتويتش (شبكة)
//
// ── شاهدا قرار 26، ويُشغَّلان قبل أي رقم ────────────────────────────────────
//  · **موجب:** على صفحة **بلا إضافة**، عجلة فوق القائمة **تُمرّرها فعلاً**
//    (`scrollTop` يتغيّر). بلا هذا الشاهد يكون «لم تُمرَّر» عديم المعنى: قائمة
//    لا تُمرَّر أصلاً تطبع الرقم نفسه الذي تطبعه قائمة مختطَفة.
//  · **سالب:** نفس الصفحة بلا إضافة **لا تُظهر عنصر overlay واحداً** ولا تغيّر
//    مستوى الصوت — فما يظهر مع الإضافة يُنسب إليها لا إلى الصفحة.
//
// ⚠️ **وأولى تشغيلة أسقطت الشاهد الموجب، والعلّة في الأداة لا في المنتج:**
// `element.dispatchEvent(new WheelEvent(...))` من الصفحة **لا يُمرّر شيئاً**
// (`scrollTop 0 ⇒ 0` بلا إضافة) — الحدث **غير موثوق فلا سلوك افتراضي له**.
// ⇒ **أداةٌ تقيس الاختطاف بحدث مُرسَل من الصفحة تطبع «لم تُمرَّر» دائماً، فتقيس
// عجزها لا عطبنا.** فصارت العجلة هنا **عجلة CDP موثوقة**.
// وهذا يحسم بالمناسبة أحد مرشَّحَي عمى `bench-zero-change.mjs` القديمين:
// **عجلة CDP تصل إلى مستمع سكربت المحتوى فعلاً** — يُبرهَن أدناه بتنفيذ أمر
// المربّع 4 عليها.
import {
  launch, configure, openPage, contentWorld, evalIn, serveTestPage
, killChrome } from "./ext-harness.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── منصّة محايدة: فيديو + طبقة قابلة للتمرير فوقه، كقائمة مشغّل ──────────────
// القائمة في **الربع السفلي الأيمن من مستطيل الفيديو** — أي فوق المربّعين
// C3 و B3، وهما اللذان أبلغ عنهما المالك على يوتيوب.
const PAGE = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#111">
<div id="player" style="position:relative;width:640px;height:360px">
  <video id="v" width="640" height="360" src="/tone.wav" loop muted playsinline
         style="display:block;background:#222"></video>
  <div id="menu" style="position:absolute;right:8px;bottom:8px;width:200px;height:150px;
       overflow-y:auto;background:#000c;color:#fff;font:14px sans-serif;z-index:60">
    ${Array.from({ length: 40 }, (_, i) => `<div style="padding:8px">خيار ${i + 1}</div>`).join("")}
  </div>
</div></body>`;

const SETUP = `(() => {
  const v = document.querySelector("video");
  const menu = document.getElementById("menu");
  if (!v || !menu) return { ok: false, why: "الصفحة ليست المنصّة" };
  try { v.muted = true; v.volume = 0.5; v.play().catch(() => {}); } catch {}
  const desc = (el) => el ? (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\\s+/).slice(0, 3).join(".") : "")) : "—";
  const mr = menu.getBoundingClientRect(), vr = v.getBoundingClientRect();
  const mx = Math.round(mr.left + mr.width / 2), my = Math.round(mr.top + mr.height / 2);
  const stack = (document.elementsFromPoint(mx, my) || []).slice(0, 7).map(desc);
  const scrollableAbove = (() => {
    let el = document.elementFromPoint(mx, my); const out = [];
    while (el && el !== document.body) {
      const st = getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        out.push({ el: desc(el), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
      }
      el = el.parentElement;
    }
    return out;
  })();
  return { ok: true, stack, scrollableAbove,
    menuPoint: { x: mx, y: my },
    videoPoint: { x: Math.round(vr.left + vr.width / 6), y: Math.round(vr.top + vr.height / 2) },
    menuRect: { w: Math.round(mr.width), h: Math.round(mr.height) } };
})()`;

const READ = `(() => {
  const v = document.querySelector("video"), menu = document.getElementById("menu");
  return { scrollTop: menu ? menu.scrollTop : null,
           volume: v ? Math.round(v.volume * 1e4) / 1e4 : null,
           vz: document.querySelectorAll('[class^="vz"], [class*=" vz"]').length };
})()`;

// عجلة موثوقة: تحريك المؤشّر أولاً ثم الدولاب، كما يفعل المستخدم.
async function trustedWheel(page, x, y, deltaY) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await sleep(150);
  await page.send("Input.dispatchMouseEvent",
    { type: "mouseWheel", x, y, deltaX: 0, deltaY, pointerType: "mouse" });
  await sleep(700);
}

async function run({ withExtension, url, port }) {
  let h = null, page = null;
  try {
    h = await launch(port, { withExtension });
    if (h.extensionId) {
      // ⚠️ **الربط تحت القائمة شرطُ إعادة الإنتاج، لا تفصيل إعداد.** الافتراضي
      // يربط المربّعات **4 و6 و7 فقط** (`FIRST_RUN_ZONES`)، وقائمة يوتيوب تقع على
      // **C3 (9) و B3 (6)** — فأوّل تشغيلة بلا ربط على 9 **مرّرت القائمة ولم
      // تختطف**، وكادت تُقرأ «لا عطب». فيُضبط ربطٌ صريح على 6 و9 كما في إعداد
      // المالك. **والفخّ لا يقع إلا حيث يوجد ربط — وهذا نصف التشخيص.**
      const cfg = await configure(port, h.extensionId, {
        globalSiteRules: { enabled: true, mappings: [] },
        settings: {
          zones: {
            enabled: true, fullscreenOnly: false, gridCoverage: "player",
            wheel: { map: {
              "4": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] },
              "6": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] },
              "9": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] }
            } } }
        }
      });
      if (!cfg.ok) return { ok: false, note: "تعذّر ضبط التخزين" };
    }
    page = await openPage(port, url);
    await sleep(2500);
    const world = withExtension ? await contentWorld(page) : null;

    const setup = await evalIn(page, SETUP);
    if (!setup?.ok) return { ok: false, note: setup?.why || "لم يُقرأ المِجَسّ" };
    await sleep(600);

    const menuBefore = await evalIn(page, READ);
    await trustedWheel(page, setup.menuPoint.x, setup.menuPoint.y, 120);
    const menuAfter = await evalIn(page, READ);

    const videoBefore = await evalIn(page, READ);
    await trustedWheel(page, setup.videoPoint.x, setup.videoPoint.y, -120);
    const videoAfter = await evalIn(page, READ);

    return { ok: true, world: !!world, ...setup, menuBefore, menuAfter, videoBefore, videoAfter };
  } catch (e) {
    return { ok: false, note: "فشل: " + String(e?.message || e).slice(0, 90) };
  } finally {
    try { page?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {}
    killChrome(h);
  }
}

// ── مضيف حقيقي: تُفتح قائمة المشغّل ثم تُقاس بنفس العجلة الموثوقة ────────────
const HOST_OPEN = (openSelectors) => `(async () => {
  const q = (list) => { for (const s of list) { const el = document.querySelector(s); if (el) return el; } return null; };
  const v = [...document.querySelectorAll("video")].sort(
    (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  if (!v) return { ok: false, why: "لا فيديو" };
  try { v.muted = true; await v.play().catch(() => {}); } catch {}
  await new Promise((r) => setTimeout(r, 2000));
  const opener = q(${JSON.stringify(openSelectors)});
  if (!opener) return { ok: false, why: "لم يُوجد زرّ فتح القائمة" };
  opener.click();
  await new Promise((r) => setTimeout(r, 1500));
  return { ok: true };
})()`;

const HOST_STATE = (menuSelectors, playerSelectors) => `(() => {
  const q = (list) => { for (const s of list) { const el = document.querySelector(s); if (el) return el; } return null; };
  const menu = q(${JSON.stringify(menuSelectors)});
  if (!menu) return { ok: false, why: "القائمة لم تُفتح أو تغيّر محدّدها" };
  const mr = menu.getBoundingClientRect();
  if (!(mr.width > 0 && mr.height > 0)) return { ok: false, why: "مستطيل القائمة صفريّ — لا يُقاس" };
  const desc = (el) => el ? (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\\s+/).slice(0, 3).join(".") : "")) : "—";
  const mx = Math.round(mr.left + mr.width / 2), my = Math.round(mr.top + mr.height / 2);
  const stack = (document.elementsFromPoint(mx, my) || []).slice(0, 7).map(desc);
  let el = document.elementFromPoint(mx, my), scroller = null;
  while (el && el !== document.body) {
    const st = getComputedStyle(el);
    if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      scroller = el; break;
    }
    el = el.parentElement;
  }
  const v = [...document.querySelectorAll("video")].sort(
    (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  window.__vz65 = scroller || menu;

  // ── كيف عثرنا على الفيديو أصلاً؟ آليّتان مختلفتان، تُقاسان ولا تُفترضان ──
  const full = document.elementsFromPoint(mx, my) || [];
  const videoInStack = full.some((el) => el && el.tagName === "VIDEO");
  const ancestorWithVideo = (() => {
    for (const el of full) {
      if (!el || el.tagName === "VIDEO") continue;
      const vids = el.querySelectorAll ? el.querySelectorAll("video") : [];
      for (const vid of vids) {
        const r = vid.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return desc(el);
      }
    }
    return null;
  })();
  const vr = v ? v.getBoundingClientRect() : null;
  const pointInVideoRect = !!vr && mx >= vr.left && mx <= vr.right && my >= vr.top && my <= vr.bottom;

  return { ok: true, stack, point: { x: mx, y: my }, stackDepth: full.length,
    videoInStack, ancestorWithVideo, pointInVideoRect,
    videoRect: vr ? { x: Math.round(vr.left), y: Math.round(vr.top), w: Math.round(vr.width), h: Math.round(vr.height) } : null,
    scroller: scroller ? { el: desc(scroller), scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight } : null,
    menuRect: { w: Math.round(mr.width), h: Math.round(mr.height) },
    inPlayer: !!menu.closest(${JSON.stringify(playerSelectors.join(", "))}),
    scrollTop: (scroller || menu).scrollTop,
    volume: v ? Math.round(v.volume * 1e4) / 1e4 : null,
    vz: document.querySelectorAll('[class^="vz"], [class*=" vz"]').length };
})()`;

const HOST_READ = `(() => {
  const t = window.__vz65;
  const v = [...document.querySelectorAll("video")].sort(
    (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  return { scrollTop: t ? t.scrollTop : null,
           volume: v ? Math.round(v.volume * 1e4) / 1e4 : null,
           vz: document.querySelectorAll('[class^="vz"], [class*=" vz"]').length };
})()`;

async function runHost({ withExtension, url, port, open, menu, player }) {
  let h = null, page = null;
  try {
    h = await launch(port, { withExtension });
    if (h.extensionId) await configure(port, h.extensionId, {
      globalSiteRules: { enabled: true, mappings: [] },
      settings: { zones: { enabled: true, fullscreenOnly: false, gridCoverage: "player",
        wheel: { map: {
          "4": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] },
          "6": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] },
          "9": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] } } } } }
    });
    page = await openPage(port, url);
    await sleep(7000);
    const opened = await evalIn(page, HOST_OPEN(open));
    if (!opened?.ok) return { ok: false, why: opened?.why || "لم تُفتح الصفحة" };
    const st = await evalIn(page, HOST_STATE(menu, player));
    if (!st?.ok) return st || { ok: false, why: "لم تُقرأ الحالة" };
    await trustedWheel(page, st.point.x, st.point.y, 120);
    const after = await evalIn(page, HOST_READ);
    return { ok: true, ...st, after };
  } catch (e) {
    return { ok: false, why: "فشل: " + String(e?.message || e).slice(0, 90) };
  } finally {
    try { page?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {}
    killChrome(h);
  }
}

// ── طرفا القائمة: ماذا يفعل المضيف **بلا إضافة** عند الحافة؟ ────────────────
// السؤال ليس تنظيمياً: القيد 2 يقترح أن نترك الحدث لنا عند الطرف. فإن كان
// المضيف يُطبق القائمة أو يُمرّر الصفحة خلفها عند الحافة، فتركُ الحدث لنا يغيّر
// سلوكاً قائماً — والقرار عندها للمالك لا للتنفيذ (قرار 16).
const EDGE_SET = (which) => `(() => {
  const t = window.__vz65;
  if (!t) return { ok: false, why: "لا عنصر مقيس" };
  t.scrollTop = ${which === "top" ? "0" : "t.scrollHeight"};
  const menu = t.getBoundingClientRect();
  return { ok: true, scrollTop: t.scrollTop, max: t.scrollHeight - t.clientHeight,
    visible: menu.width > 0 && menu.height > 0,
    pageY: window.scrollY, docY: document.documentElement.scrollTop };
})()`;

const EDGE_READ = `(() => {
  const t = window.__vz65;
  const r = t ? t.getBoundingClientRect() : null;
  return { scrollTop: t ? t.scrollTop : null,
    visible: !!r && r.width > 0 && r.height > 0,
    inDom: !!t && document.contains(t),
    pageY: window.scrollY, docY: document.documentElement.scrollTop };
})()`;

async function runEdges({ url, port, open, menu, player }) {
  let h = null, page = null;
  try {
    h = await launch(port, { withExtension: false });
    page = await openPage(port, url);
    await sleep(7000);
    const opened = await evalIn(page, HOST_OPEN(open));
    if (!opened?.ok) return { ok: false, why: opened?.why || "لم تُفتح" };
    const st = await evalIn(page, HOST_STATE(menu, player));
    if (!st?.ok) return st || { ok: false, why: "لم تُقرأ الحالة" };

    const out = { ok: true, point: st.point };
    for (const which of ["top", "bottom"]) {
      const before = await evalIn(page, EDGE_SET(which));
      await trustedWheel(page, st.point.x, st.point.y, which === "top" ? -120 : 120);
      const after = await evalIn(page, EDGE_READ);
      out[which] = { before, after };
    }
    return out;
  } catch (e) {
    return { ok: false, why: "فشل: " + String(e?.message || e).slice(0, 90) };
  } finally {
    try { page?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {}
    killChrome(h);
  }
}

// ── تكلفة الحكم في المسار الساخن — تُقاس قبل القبول لا بعده ─────────────────
// تُنفَّذ **داخل العالم المعزول** فتنادي `findVideoAtPoint` نفسها لا محاكياً لها،
// و`getComputedStyle` مرقَّعة هناك فيُعدّ كم عنصراً يُفحص فعلاً.
const COST = (point, n) => `(() => {
  const orig = getComputedStyle;
  let calls = 0;
  window.getComputedStyle = function (...a) { calls++; return orig.apply(this, a); };
  const round = (flag) => {
    calls = 0;
    const t0 = performance.now();
    for (let i = 0; i < ${n}; i++) findVideoAtPoint(${point.x}, ${point.y}, flag);
    return { ms: (performance.now() - t0) / ${n}, styleCalls: calls / ${n} };
  };
  try {
    for (let i = 0; i < 200; i++) { findVideoAtPoint(${point.x}, ${point.y}, true); findVideoAtPoint(${point.x}, ${point.y}, false); }
    // ⚠️ الترتيب متبادل (A·B·B·A): أوّل قياس طبع فارقاً على مسارٍ **صفر عمل
    // إضافي فيه**، أي أنه كان يقيس ترتيب التشغيل لا التكلفة.
    const w1 = round(true), o1 = round(false), o2 = round(false), w2 = round(true);
    const avg = (a, b) => ({ ms: (a.ms + b.ms) / 2, styleCalls: (a.styleCalls + b.styleCalls) / 2 });
    return { ok: true, withGuard: avg(w1, w2), without: avg(o1, o2),
             spread: { withGuard: Math.abs(w1.ms - w2.ms), without: Math.abs(o1.ms - o2.ms) } };
  } finally { window.getComputedStyle = orig; }
})()`;

async function runCost({ url, port }) {
  let h = null, page = null;
  try {
    h = await launch(port, { withExtension: true });
    await configure(port, h.extensionId, {
      globalSiteRules: { enabled: true, mappings: [] },
      settings: { zones: { enabled: true, fullscreenOnly: false, gridCoverage: "player",
        wheel: { map: { "4": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] },
                        "6": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] },
                        "9": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] } } } } }
    });
    page = await openPage(port, url);
    await sleep(2500);
    const world = await contentWorld(page);
    if (!world) return { ok: false, why: "لا عالم معزول — لا يُقاس" };
    const setup = await evalIn(page, SETUP);
    if (!setup?.ok) return { ok: false, why: setup?.why || "لم يُقرأ المِجَسّ" };
    const onVideo = await evalIn(page, COST(setup.videoPoint, 2000), world.id);
    const onMenu = await evalIn(page, COST(setup.menuPoint, 2000), world.id);
    return { ok: true, onVideo, onMenu };
  } catch (e) {
    return { ok: false, why: "فشل: " + String(e?.message || e).slice(0, 90) };
  } finally {
    try { page?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {}
    killChrome(h);
  }
}

// ── التشغيل ──────────────────────────────────────────────────────────────────
let port = 9701;
const srv = await serveTestPage(8951, PAGE);

console.log("\n=== #65 — العجلة فوق قائمة على الفيديو ===");
console.log("\n── الشاهدان (قرار 26): صفحة بلا إضافة");
const neg = await run({ withExtension: false, url: srv.url, port: port++ });
const negScrolled = neg.ok && neg.menuAfter.scrollTop > neg.menuBefore.scrollTop;
const negClean = neg.ok && neg.menuAfter.vz === 0 && neg.videoBefore.volume === neg.videoAfter.volume;
console.log(`  القائمة تُمرَّر فعلاً : scrollTop ${neg.menuBefore?.scrollTop} ⇒ ${neg.menuAfter?.scrollTop}` +
  `   ${negScrolled ? "✅ موجب — الأداة ترى التمرير" : "❌ **ساقط** — لا يُحكم على اختطاف"}`);
console.log(`  ولا أثر للإضافة     : overlay ${neg.menuAfter?.vz} · المستوى ${neg.videoBefore?.volume} ⇒ ${neg.videoAfter?.volume}` +
  `   ${negClean ? "✅ سالب" : "❌ **ساقط**"}`);

if (!(negScrolled && negClean)) {
  console.log(`\n⚠️ **الشاهدان لم يستوفيا ⇒ لا رقم يُنشر.** ${neg.note || ""}\n`);
  srv.srv.close();
  process.exit(1);
}

console.log("\n── مع الإضافة");
const pos = await run({ withExtension: true, url: srv.url, port: port++ });
if (!pos.ok) {
  console.log(`  ⚠️ ${pos.note}`);
} else {
  const scrolled = pos.menuAfter.scrollTop > pos.menuBefore.scrollTop;
  console.log(`  [أ] عجلة فوق القائمة`);
  console.log(`      تمرير القائمة  : scrollTop ${pos.menuBefore.scrollTop} ⇒ ${pos.menuAfter.scrollTop}` +
    `   ${scrolled ? "✅ مُرِّرت" : "❌ **لم تُمرَّر — مختطَفة**"}`);
  console.log(`      شبكة المربّعات : ${pos.menuBefore.vz} ⇒ ${pos.menuAfter.vz} عنصر` +
    `   ${pos.menuAfter.vz > 0 ? "⇐ الإضافة تصرّفت" : "—"}`);
  console.log(`      المستوى        : ${pos.menuBefore.volume} ⇒ ${pos.menuAfter.volume}` +
    `   ${pos.menuAfter.volume !== pos.menuBefore.volume ? "⇐ نُفِّذ أمر مربّع" : "—"}`);
  console.log(`  [ب] عجلة فوق الفيديو (B1، بعيداً عن القائمة)`);
  console.log(`      المستوى        : ${pos.videoBefore.volume} ⇒ ${pos.videoAfter.volume}` +
    `   ${pos.videoAfter.volume !== pos.videoBefore.volume ? "✅ الميزة الأساسية تعمل" : "❌ **انكسرت**"}`);
  console.log(`  [ج] كومة العناصر تحت المؤشّر والقائمة مفتوحة:`);
  for (const d of pos.stack) console.log(`      · ${d}`);
  console.log(`      قابل للتمرير فوق الفيديو: ` +
    (pos.scrollableAbove?.length
      ? pos.scrollableAbove.map((x) => `${x.el} (${x.scrollHeight}px محتوى في ${x.clientHeight}px)`).join(" · ")
      : "لا شيء"));
}
srv.srv.close();

if (process.argv.includes("--cost")) {
  const s2 = await serveTestPage(8952, PAGE);
  const c = await runCost({ url: s2.url, port: port++ });
  console.log("\n=== تكلفة الحكم في المسار الساخن (2000 نداء لكل قياس) ===\n");
  if (!c.ok) console.log(`  ⚠️ ${c.why}`);
  else {
    for (const [name, r] of [["على الفيديو (المسار الشائع)", c.onVideo], ["على القائمة", c.onMenu]]) {
      if (!r?.ok) { console.log(`  ⚠️ ${name}: لم يُقس`); continue; }
      console.log(`  ${name}`);
      console.log(`     بالحكم : ${r.withGuard.ms.toFixed(5)}ms · getComputedStyle ${r.withGuard.styleCalls} لكل نداء`);
      console.log(`     بدونه  : ${r.without.ms.toFixed(5)}ms · getComputedStyle ${r.without.styleCalls}`);
      const d = (r.withGuard.ms - r.without.ms) * 1e6;      // ms ⇒ نانوثانية
      const noise = Math.max(r.spread.withGuard, r.spread.without) * 1e6;
      console.log(`     الفارق : ${d.toFixed(0)} نانوثانية لكل نداء · وتشتّت التكرار ${noise.toFixed(0)}ns` +
        `${Math.abs(d) <= noise ? "  ⇒ **داخل الضجيج، لا فارق مقيس**" : ""}`);
    }
  }
  s2.srv.close();
  console.log("");
  process.exit(0);
}

if (process.argv.includes("--edges")) {
  const HOSTS_E = [
    { name: "youtube.com", url: "https://www.youtube.com/watch?v=V9PVRfjEBTI",
      open: [".ytp-settings-button"],
      menu: [".ytp-panel-menu", ".ytp-settings-menu", ".ytp-popup.ytp-settings-menu"],
      player: ["#movie_player"] },
    { name: "twitch.tv", url: "https://www.twitch.tv/",
      open: ["[data-a-target='player-settings-button']", "button[aria-label*='Settings']"],
      menu: ["[data-a-target='player-settings-menu']", ".tw-balloon", "[role='dialog']"],
      player: ["[data-a-target='video-player']", ".video-player"] }
  ];
  console.log("\n=== طرفا القائمة — بلا إضافة، سلوك المضيف وحده ===");
  for (const host of HOSTS_E) {
    const r = await runEdges({ port: port++, ...host });
    console.log(`\n── ${host.name}`);
    if (!r.ok) { console.log(`   ⚠️ ${r.why}`); continue; }
    for (const which of ["top", "bottom"]) {
      const e = r[which];
      console.log(`   ${which === "top" ? "أعلى القائمة + عجلة لأعلى " : "أسفل القائمة + عجلة لأسفل"}: ` +
        `scrollTop ${e.before.scrollTop} ⇒ ${e.after.scrollTop} (السقف ${e.before.max})` +
        ` · القائمة ظاهرة ${e.before.visible} ⇒ ${e.after.visible}` +
        ` · في الشجرة ${e.after.inDom}` +
        ` · الصفحة خلفها ${e.before.pageY}/${e.before.docY} ⇒ ${e.after.pageY}/${e.after.docY}`);
    }
  }
  console.log("");
  process.exit(0);
}

if (process.argv.includes("--hosts")) {
  const HOSTS = [
    { name: "youtube.com", url: "https://www.youtube.com/watch?v=V9PVRfjEBTI",
      open: [".ytp-settings-button"],
      menu: [".ytp-panel-menu", ".ytp-settings-menu", ".ytp-popup.ytp-settings-menu"],
      player: ["#movie_player"] },
    { name: "twitch.tv", url: "https://www.twitch.tv/",
      open: ["[data-a-target='player-settings-button']", "button[aria-label*='Settings']"],
      menu: ["[data-a-target='player-settings-menu']", ".tw-balloon", "[role='dialog']"],
      player: ["[data-a-target='video-player']", ".video-player"] }
  ];
  const only = (process.argv.find((x) => x.startsWith("--only=")) || "").split("=")[1];
  for (const host of HOSTS) {
    if (only && !host.name.includes(only)) continue;
    console.log(`\n── ${host.name}`);
    const off = await runHost({ withExtension: false, url: host.url, port: port++, ...host });
    if (!off.ok) { console.log(`   ⚠️ بلا إضافة: ${off.why}  ⇒ لا شاهد موجب، ولا حكم`); continue; }
    const offScrolled = off.after.scrollTop > off.scrollTop;
    console.log(`   شاهد موجب (بلا إضافة): scrollTop ${off.scrollTop} ⇒ ${off.after.scrollTop}` +
      `   ${offScrolled ? "✅ تُمرَّر" : "❌ **لا تُمرَّر أصلاً — لا حكم على الاختطاف**"}`);
    console.log(`   القائمة: ${off.menuRect.w}×${off.menuRect.h} · داخل حاوية المشغّل: ${off.inPlayer}`);
    console.log(`   الكومة: ${off.stack.join(" › ")}`);
    console.log(`   العنصر القابل للتمرير: ${off.scroller ? `${off.scroller.el} (${off.scroller.scrollHeight}>${off.scroller.clientHeight})` : "لم يُعثر عليه"}`);
    console.log(`   كيف يُعثر على الفيديو: الفيديو في الكومة=${off.videoInStack}` +
      ` · سلفٌ يحويه=${off.ancestorWithVideo || "—"} · النقطة داخل مستطيل الفيديو=${off.pointInVideoRect}` +
      ` · عمق الكومة=${off.stackDepth}`);
    if (!offScrolled) continue;

    const on = await runHost({ withExtension: true, url: host.url, port: port++, ...host });
    if (!on.ok) { console.log(`   ⚠️ مع الإضافة: ${on.why}`); continue; }
    console.log(`   مع الإضافة           : scrollTop ${on.scrollTop} ⇒ ${on.after.scrollTop}` +
      ` · overlay ${on.vz} ⇒ ${on.after.vz} · المستوى ${on.volume} ⇒ ${on.after.volume}` +
      `   ${on.after.scrollTop > on.scrollTop ? "✅ مُرِّرت" : "❌ **مختطَفة**"}`);
  }
}
console.log("");
process.exit(0);
