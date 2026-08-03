// قياس تكلفة محرّك السكون وحلقة الرسم — **عدُّ عمليات لا ساعة حائط**
//
// **رقمان طلبهما المالك مع كومِت #72:**
//   (١) التكلفة **بالمفتاحين مطفأين** — والمتوقَّع صفر عمل.
//   (٢) والتكلفة **وزرّ #72 ظاهر** — وهي ثمن اختيارنا الطبقة، مكتوبٌ منذ يومه.
//
// ⚠️ **لماذا عدُّ عمليات لا ميلي-ثانية؟** «رقمٌ لا يُقارن بضجيجه ليس رقماً»
// (الشاهد السادس عشر): زمنُ 1000 حركة مؤشّر على هذه الآلة **دون تشتّت الحِمل
// نفسه**، فيُقرأ رقمٌ يتغيّر بين تشغيلتين ويبدو حكماً. **وعدُّ العمليات حتميّ**:
// يُعاد فيخرج هو هو، ويُقارَن بعد أي تعديل بلا تفسير.
//
// ولا يحتاج متصفّحاً: يقتطع الكودَ من `content.js` نفسه ويشغّله بمِجَسّات عادّة،
// **فالمقيس هو المشحون لا نسخةٌ منه**.
//
//   node tools/bench-idle-cost.js
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const slice = (from, to) => {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  return a === -1 || b === -1 ? null : SRC.slice(a, b);
};

const ENGINE = slice("const IDLE_MIN_MS", "// الدخول إلى ملء الشاشة");
// المرساة: من دالّة العدّ إلى ما بعد حلقة التتبّع مباشرةً
const TRACK = slice("function positionOverlayToVideo()", "function attachOverlayToHost");
if (!ENGINE || !TRACK) {
  console.log("❌ تعذّر الاقتطاع — **المرساة سقطت، أصلِح المرساة لا الرقم**");
  process.exit(1);
}

const N = 1000;   // حركات مؤشّر

// ── (١) المحرّك: مع مستهلكٍ مُفعَّل وبدونه ─────────────────────────────────
function runEngine({ wanted }) {
  const ops = { domReads: 0, timersSet: 0, timersCleared: 0, containment: 0 };
  const clock = { t: 1000 };
  const ctx = {
    console: { log() {}, debug() {}, warn() {} },
    nowMs: () => (clock.t += 4),          // ~4ms بين الحركات: 250 حركة/ثانية
    setTimeout: () => { ops.timersSet++; return 1; },
    clearTimeout: () => { ops.timersCleared++; },
    extensionActive: () => true,
    settingsRead: async () => ({ settings: {} }),
    getVideoUnderPointer: () => { ops.containment++; ops.domReads++; return { tagName: "VIDEO" }; },
    window: { addEventListener() {} },
    document: { addEventListener() {}, hidden: false, activeElement: null }
  };
  vm.createContext(ctx);
  vm.runInContext(ENGINE, ctx);
  if (wanted) {
    ctx.__c = { enabled: () => true, onActive() {}, onIdle() {} };
    vm.runInContext("IDLE_CONSUMERS.only = __c; refreshIdleConsumers();", ctx);
  } else {
    vm.runInContext("refreshIdleConsumers();", ctx);
  }
  const before = { ...ops };
  ctx.__ev = { type: "mousemove", isTrusted: true, target: null };
  for (let i = 0; i < N; i++) vm.runInContext("noteIdleFromPointerEvent(__ev, true)", ctx);
  return {
    domReads: ops.domReads - before.domReads,
    timersSet: ops.timersSet - before.timersSet,
    containment: ops.containment - before.containment
  };
}

// ── (٢) حلقة الرسم: بشيءٍ ظاهر وبلا شيء ────────────────────────────────────
function runTrack({ visible }) {
  const ops = { raf: 0, rects: 0 };
  const el = (hidden) => ({ classList: { contains: () => hidden } });
  const ctx = {
    console: { log() {} },
    requestAnimationFrame: (fn) => { ops.raf++; if (ops.raf < 60) fn(); return ops.raf; },
    cancelAnimationFrame() {},
    vzGridEl: el(true), vzHintEl: el(true), vzVolumeBadge: el(true), vzSpeedBadge: el(true),
    vzSpeedBtn: el(!visible),
    vzTrackRafId: null,
    vzOverlay: { style: { left: "", top: "", width: "", height: "" } },
    vzOverlayVideo: { isConnected: true },
    zoneRectForVideo: () => { ops.rects++; return { left: 0, top: 0, width: 800, height: 450 }; },
    OVERLAY_PARTS: null
  };
  vm.createContext(ctx);
  vm.runInContext(`const OVERLAY_PARTS = {
    grid: () => vzGridEl, hint: () => vzHintEl, volume: () => vzVolumeBadge,
    speed: () => vzSpeedBadge, speedBtn: () => vzSpeedBtn };\n` + TRACK, ctx);
  vm.runInContext("startOverlayTracking()", ctx);
  return { framesRequested: ops.raf, rectReads: ops.rects };
}

const off = runEngine({ wanted: false });
const on = runEngine({ wanted: true });
const idleLoop = runTrack({ visible: false });
const busyLoop = runTrack({ visible: true });

console.log("\n=== تكلفة محرّك السكون — عدُّ عمليات على " + N + " حركة مؤشّر ===\n");
console.log("(١) المحرّك:");
console.log(`  بالمفتاحين مطفأين : قراءات DOM ${off.domReads} · فحوص احتواء ${off.containment} · مؤقّتات ${off.timersSet}`);
console.log(`  وبمستهلكٍ مُفعَّل  : قراءات DOM ${on.domReads} · فحوص احتواء ${on.containment} · مؤقّتات ${on.timersSet}`);
console.log(`  ⇒ الخنق: ${N} حركة (بفاصل 4ms ⇒ ${(N * 4 / 1000).toFixed(1)} ثانية) ⇒ ${on.containment} فحصاً`);
console.log("\n(٢) حلقة الرسم (60 إطاراً):");
console.log(`  ولا شيء ظاهر     : إطارات ${idleLoop.framesRequested} · قراءات مستطيل ${idleLoop.rectReads}`);
console.log(`  وزرّ #72 ظاهر     : إطارات ${busyLoop.framesRequested} · قراءات مستطيل ${busyLoop.rectReads}`);
console.log("\n⚠️ الأرقام حتميّة — تُعاد فتخرج هي هي، وتُقارَن بعد أي تعديل بلا تفسير.\n");
