// Audit #12: middle-clicking a zone ran the command AND opened Chrome's
// autoscroll cursor. The default is armed on mousedown, but the zone path only
// listened on auxclick, so nothing ever suppressed it — unlike the generic remap
// path, which preventDefaults on mousedown.
//
// The two properties that matter and that a code read cannot guarantee:
//   1. mousedown suppresses the default when a middle binding exists,
//   2. and the binding still fires EXACTLY ONCE — on auxclick, never twice.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}
const SRC = "content.js";
// One slice covers handleZoneClick + suppressMiddleClickDefault, so the two are
// always tested against each other as the browser sees them.
const CLICK = slice(SRC, "function handleZoneClick", 'window.addEventListener("click", handleZoneClick');
const NORMALIZE = slice(SRC, "function normalizeMappedActions", 'window.addEventListener("mousemove"');

function makeWorld({ active = true, video = { tagName: "VIDEO" }, zone = 5, middle = ["ACTION:TOGGLE_PLAY"] } = {}) {
  const log = { ran: [], prevented: 0, stopped: 0, overlay: [] };
  const ctx = {
    zonesActive: () => active,
    getZoneAtEvent: () => (video ? { video, zone } : null),
    zoneSettings: { click: { map: { [String(zone)]: middle ? { middle } : {} } } },
    zoneLabel: (z) => "B" + z,
    showOverlay: (t) => log.overlay.push(t),
    runAction: (a) => { log.ran.push(a); return true; },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(NORMALIZE + "\n" + CLICK, ctx);
  // غائبة في الكود السابق للإصلاح: عرّفها كلا-عملية حتى تفشل التأكيدات بوضوح
  // بدل أن ينهار الاختبار بـ TypeError
  if (typeof ctx.suppressMiddleClickDefault !== "function") ctx.suppressMiddleClickDefault = () => false;
  ctx.log = log;
  ctx.event = (type, button) => ({
    type, button,
    preventDefault() { log.prevented++; },
    stopPropagation() { log.stopped++; },
    stopImmediatePropagation() {}
  });
  return ctx;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

console.log("\n[1] الزر الأوسط على مربع مربوط — يُمنع الافتراضي بلا تنفيذ");
{
  const ctx = makeWorld();
  const handled = ctx.suppressMiddleClickDefault(ctx.event("mousedown", 1));
  check("عولج", handled === true);
  check("مُنع الافتراضي — لا مؤشر تمرير تلقائي", ctx.log.prevented === 1, ctx.log.prevented);
  check("لم يُنفَّذ أي أمر على mousedown", ctx.log.ran.length === 0, ctx.log.ran);
  check("لا stopPropagation — الصفحة ما زالت ترى الحدث", ctx.log.stopped === 0, ctx.log.stopped);
}

console.log("\n[2] الأمر ينفَّذ مرة واحدة فقط عبر الدورة الكاملة");
{
  const ctx = makeWorld();
  ctx.suppressMiddleClickDefault(ctx.event("mousedown", 1));
  ctx.handleZoneClick(ctx.event("auxclick", 1));
  check("نُفِّذ مرة واحدة", ctx.log.ran.length === 1, ctx.log.ran);
  check("وهو الأمر المربوط", ctx.log.ran[0] === "ACTION:TOGGLE_PLAY", ctx.log.ran);
  check("مُنع الافتراضي مرتين — mousedown و auxclick", ctx.log.prevented === 2, ctx.log.prevented);
}

console.log("\n[3] مربع بلا ربط أوسط — الصفحة تحتفظ بسلوكها");
{
  const ctx = makeWorld({ middle: null });
  const handled = ctx.suppressMiddleClickDefault(ctx.event("mousedown", 1));
  check("لم يُعالَج", handled === false);
  check("لم يُمنع الافتراضي — التمرير التلقائي يبقى للصفحة", ctx.log.prevented === 0);
}
{
  const ctx = makeWorld({ middle: [] });
  check("قائمة أوامر فارغة تُعامَل كغياب ربط",
    ctx.suppressMiddleClickDefault(ctx.event("mousedown", 1)) === false && ctx.log.prevented === 0);
}

console.log("\n[4] لا يمسّ بقية الأزرار");
{
  for (const [name, btn] of [["الأيسر", 0], ["الأيمن", 2], ["الرابع", 3]]) {
    const ctx = makeWorld();
    const handled = ctx.suppressMiddleClickDefault(ctx.event("mousedown", btn));
    check(`الزر ${name} لا يُمسّ`, handled === false && ctx.log.prevented === 0);
  }
}

console.log("\n[5] البوابات: المربعات معطّلة أو لا فيديو تحت المؤشر");
{
  const off = makeWorld({ active: false });
  check("المربعات معطّلة ⇒ لا منع",
    off.suppressMiddleClickDefault(off.event("mousedown", 1)) === false && off.log.prevented === 0);

  const noVideo = makeWorld({ video: null });
  check("لا فيديو تحت المؤشر ⇒ لا منع",
    noVideo.suppressMiddleClickDefault(noVideo.event("mousedown", 1)) === false && noVideo.log.prevented === 0);
}

console.log("\n[6] عدم انحدار: handleZoneClick نفسه لم يتغيّر سلوكه");
{
  const ctx = makeWorld();
  check("mousedown لا يُشغّل مسار المربعات", ctx.handleZoneClick(ctx.event("mousedown", 1)) === false);
  check("لم يُنفَّذ شيء", ctx.log.ran.length === 0, ctx.log.ran);

  const left = makeWorld({ middle: null });
  left.zoneSettings.click.map["5"] = { left: ["ACTION:TOGGLE_PLAY"] };
  check("النقر الأيسر ما زال يعمل", left.handleZoneClick(left.event("click", 0)) === true);
  check("والزر الأوسط لا يمنع افتراضياً حين الربط أيسر فقط",
    left.suppressMiddleClickDefault(left.event("mousedown", 1)) === false);
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
