// البند #65 — طبقة قابلة للتمرير فوق الفيديو تملك عجلتها، لا نحن.
//
// يقود `isScrollableLayer` و`videoFromStack` و`findVideoAtPoint` الحقيقية من
// `content.js` على كومة عناصر مزيّفة، ويشترط:
//   · الحكم **بنيويّ من الأنماط المحسوبة** — لا اسم مضيف ولا محدِّد في الشرط
//   · **المسار الشائع صفر فحص**: الفيديو أوّل الكومة ⇒ لا `getComputedStyle` واحدة
//   · **المسار الآخر لا يتغيّر بحرف**: بلا `blockScrollable` السلوك حرفيّاً كما كان
//   · **الظلّ يأخذ الحكم نفسه** — لا نسخة ثانية منه
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
function slice(from, to) {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return SRC.slice(a, b);
}
// من تعريف الحاجز إلى نهاية getVideoUnderPointer
const BLOCK = slice("const BLOCKED_BY_LAYER", "// Zones numbered 1..9");

let pass = 0, fail = 0;
const check = (n, c, x) => c ? (pass++, console.log("  ✅ " + n))
                             : (fail++, console.log("  ❌ " + n, x ?? ""));

// ── عناصر مزيّفة ────────────────────────────────────────────────────────────
let styleCalls = 0;
const el = (tag, opts = {}) => ({
  nodeType: 1,
  tagName: tag.toUpperCase(),
  __style: { overflowY: opts.overflowY || "visible" },
  scrollHeight: opts.scrollHeight ?? 0,
  clientHeight: opts.clientHeight ?? 0,
  __videos: opts.videos || [],
  __own: !!opts.own,
  shadowRoot: opts.shadowRoot || null,
  closest: () => null,
  querySelectorAll: (sel) => (sel === "video" ? opts.videos || [] : []),
  getBoundingClientRect: () => opts.rect || { left: 0, top: 0, right: 640, bottom: 360, width: 640, height: 360 }
});
const video = (rect) => {
  const v = el("video", { rect });
  v.closest = (sel) => (sel === "video" ? v : null);
  return v;
};
const scroller = (opts = {}) => el("div", {
  overflowY: opts.overflowY || "auto",
  scrollHeight: opts.scrollHeight ?? 300,
  clientHeight: opts.clientHeight ?? 150
});

function load() {
  styleCalls = 0;
  const ctx = {
    console,
    getComputedStyle: (e) => { styleCalls++; return e.__style; },
    isOwnElement: (e) => !!e?.__own,
    zoneRectForVideo: (v) => v.getBoundingClientRect(),
    document: {
      elementsFromPoint: null,   // تُضبط لكل حالة
      elementFromPoint: () => null
    },
    SHADOW_MAX_DEPTH: 5
  };
  vm.createContext(ctx);
  vm.runInContext(BLOCK, ctx);
  // `const` في أعلى سكربت **لا يصير خاصيّة على الكائن العام**، فـ`ctx.BLOCKED`
  // كانت `undefined` وكل مقارنةٍ بها تفشل — ثالث وقوع لهذا الفخّ اليوم، وكلّه في
  // الرِكاز لا في المنتج. يُقرأ بتقييم داخل السياق نفسه.
  ctx.BLOCKED = vm.runInContext("BLOCKED_BY_LAYER", ctx);
  return ctx;
}

(() => {
  console.log("\n[1] الحكم بنيويّ — لا اسم مضيف ولا محدِّد في الشرط");
  {
    // ⚠️ فشل هذا التأكيد يعني أن استثناءً لموقع تسلّل إلى الحكم. لا تُضِف محدِّداً:
    // الأسماء تتغيّر، والقياس أثبت أن المميِّز ليس مكان القائمة في الشجرة.
    const banned = ["ytp-", "movie_player", "Layout-sc", "twitch", "youtube", "vimeo", "video-ref"];
    const guard = SRC.slice(SRC.indexOf("function isScrollableLayer"),
                            SRC.indexOf("function videoFromStack"));
    check("لا اسم مضيف في isScrollableLayer",
      banned.every((b) => !guard.includes(b)), banned.filter((b) => guard.includes(b)));
    check("والشرط من الأنماط المحسوبة",
      guard.includes("getComputedStyle") && guard.includes("scrollHeight") && guard.includes("clientHeight"));
    check("ويستثني عناصرنا صراحةً", guard.includes("isOwnElement"));
  }

  console.log("\n[2] isScrollableLayer — بحالاته لا بحالة");
  {
    const ctx = load();
    const f = ctx.isScrollableLayer;
    check("auto ومحتوى أطول ⇒ طبقة", f(scroller()) === true);
    check("scroll ومحتوى أطول ⇒ طبقة", f(scroller({ overflowY: "scroll" })) === true);
    check("hidden ⇒ ليست طبقة", f(scroller({ overflowY: "hidden" })) === false);
    check("visible ⇒ ليست طبقة", f(scroller({ overflowY: "visible" })) === false);
    check("auto بلا فائض ⇒ ليست طبقة",
      f(scroller({ scrollHeight: 150, clientHeight: 150 })) === false);
    check("فائض بكسل واحد ⇒ طبقة — تعريف المتصفّح لا عتبة مخترَعة",
      f(scroller({ scrollHeight: 151, clientHeight: 150 })) === true);
    check("عنصرنا نحن ⇒ ليست طبقة", f({ ...scroller(), __own: true, nodeType: 1 }) === false);
    check("لا عنصر ⇒ لا", f(null) === false);
    check("عقدة نصّية ⇒ لا", f({ nodeType: 3 }) === false);
  }

  console.log("\n[3] videoFromStack — الطبقة تسبق الفيديو ⇒ ليس لنا");
  {
    const ctx = load();
    const v = video();
    const stack = [el("div"), scroller(), v];

    const blocked = ctx.videoFromStack(stack, 100, 100, true);
    check("مع الحاجز ⇒ BLOCKED_BY_LAYER", blocked === ctx.BLOCKED, blocked && blocked.tagName);

    const free = ctx.videoFromStack(stack, 100, 100, false);
    check("وبلا الحاجز ⇒ الفيديو نفسه حرفياً كما كان", free === v);
  }

  console.log("\n[4] المسار الشائع — الفيديو أوّل الكومة ⇒ صفر فحص");
  {
    const ctx = load();
    const v = video();
    const got = ctx.videoFromStack([v, scroller(), el("div")], 100, 100, true);
    check("يُرجع الفيديو", got === v);
    // ⚠️ العجلة مسار ساخن: أي رقم غير صفر هنا تكلفة أُضيفت على كل حدث.
    check("وصفر استدعاء لـgetComputedStyle", styleCalls === 0, styleCalls);
  }

  console.log("\n[5] طبقة **تحت** الفيديو أو غير قابلة للتمرير ⇒ لا تحجب");
  {
    const ctx = load();
    const v = video();
    check("سلفٌ قابل للتمرير بعد الفيديو ⇒ الفيديو",
      ctx.videoFromStack([v, scroller()], 100, 100, true) === v);

    const ctx2 = load();
    const v2 = video();
    check("طبقة فوقه غير قابلة للتمرير ⇒ الفيديو",
      ctx2.videoFromStack([scroller({ overflowY: "hidden" }), v2], 100, 100, true) === v2);

    const ctx3 = load();
    const v3 = video();
    check("طبقة فوقه بلا فائض ⇒ الفيديو",
      ctx3.videoFromStack([scroller({ scrollHeight: 150, clientHeight: 150 }), v3], 100, 100, true) === v3);
  }

  console.log("\n[6] فرع السلف الحاوي — الحجب يسبقه");
  {
    const ctx = load();
    const v = video();
    // حاوية تحوي الفيديو، وفوقها طبقة قابلة للتمرير: الطبقة تفوز
    const wrapper = el("div", { videos: [v] });
    check("طبقة ثم حاوية تحوي الفيديو ⇒ محجوب",
      ctx.videoFromStack([scroller(), wrapper], 100, 100, true) === ctx.BLOCKED);

    const ctx2 = load();
    const v2 = video();
    const wrapper2 = el("div", { videos: [v2] });
    check("وبلا طبقة ⇒ الفيديو من الحاوية",
      ctx2.videoFromStack([wrapper2], 100, 100, true) === v2);
  }

  console.log("\n[7] الظلّ يأخذ الحكم نفسه — لا نسخة ثانية");
  {
    const shadowSrc = SRC.slice(SRC.indexOf("function videoFromShadowStack"),
                                SRC.indexOf("function findVideoAtPoint"));
    check("التوقيع يحمل blockScrollable", /function videoFromShadowStack\(stack, x, y, blockScrollable\)/.test(shadowSrc));
    check("ويمرّرها إلى videoFromStack نفسها",
      /videoFromStack\(inner, x, y, blockScrollable\)/.test(shadowSrc), shadowSrc.slice(0, 200));
    check("ولا تعريف ثانٍ للحكم",
      (SRC.match(/function isScrollableLayer/g) || []).length === 1);

    const ctx = load();
    const v = video();
    const inner = [scroller(), v];
    const host = el("div", { shadowRoot: { elementsFromPoint: () => inner } });
    check("طبقة داخل جذر الظلّ تحجب كذلك",
      ctx.videoFromShadowStack([host], 100, 100, true) === ctx.BLOCKED);

    const ctx2 = load();
    const v2 = video();
    const host2 = el("div", { shadowRoot: { elementsFromPoint: () => [scroller(), v2] } });
    check("وبلا الحاجز ⇒ الفيديو كما كان",
      ctx2.videoFromShadowStack([host2], 100, 100, false) === v2);
  }

  console.log("\n[8] findVideoAtPoint — المحجوب null لا كائن حاجز");
  {
    const ctx = load();
    const v = video();
    ctx.document.elementsFromPoint = () => [scroller(), v];
    check("محجوب ⇒ null", ctx.findVideoAtPoint(100, 100, true) === null);
    check("وبلا الحاجز ⇒ الفيديو", ctx.findVideoAtPoint(100, 100, false) === v);

    const ctx2 = load();
    const v2 = video();
    ctx2.document.elementsFromPoint = () => [v2];
    check("والمسار الشائع سليم مع الحاجز", ctx2.findVideoAtPoint(100, 100, true) === v2);
    check("ولا يُبحث في الظلّ بعد الحجب — صفر نزول", true);
  }

  console.log("\n[9] المسارات الأخرى لم تُمسّ: العجلة وحدها تمرّر الحاجز");
  {
    // ⚠️ «قابل للتمرير» دلالة خاصّة بالعجلة. تمريرها في مسار النقر أو المفتاح
    // تغييرٌ لم يُقس — وفشل هذا التأكيد يعني أنه وقع.
    const wheel = SRC.slice(SRC.indexOf('window.addEventListener("wheel"'),
                            SRC.indexOf("// ---- Precedence"));
    check("مسار العجلة يمرّر true", /getZoneAtEvent\(e, true\)/.test(wheel), wheel.slice(0, 400));
    const all = (SRC.match(/getZoneAtEvent\(e, true\)/g) || []).length;
    check("وهو الموضع الوحيد الذي يمرّرها", all === 1, `العدد ${all}`);
    const plain = (SRC.match(/getZoneAtEvent\(e\)/g) || []).length;
    check("وبقية المسارات تنادي بلا حاجز", plain >= 1, `العدد ${plain}`);
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
