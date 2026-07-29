// Audit #13b: skip the whole startup in frames that hold no video.
//
// Measured with CDP on real pages: 121 of 122 execution contexts on aljazeera.net and
// 62 of 63 on cnn.com contain no video at all. Every one of them used to do a storage
// read, eight loaders, a stylesheet and a MutationObserver for nothing.
//
// PROVING THE EXIT IS THE EASY HALF AND IT IS NOT WHAT THIS TEST IS FOR. The exit must
// not be permanent: a frame can gain a video later — lazy loading, a player injected
// after interaction, SPA navigation inside the frame, an ad slot replaced by content —
// and it must then come back with EVERY feature, not some of them. So the assertions
// below enumerate the startup steps from the source itself and demand the full set.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
if (!SRC.includes("function armLazyStartup")) {
  console.log("  ❌ armLazyStartup غائبة — البند #13ب غير منفَّذ");
  process.exit(1);
}

function extract(name) {
  const head = SRC.indexOf(`function ${name}(`);
  if (head === -1) throw new Error(`لم يُعثر على ${name}`);
  const start = SRC.indexOf("{", SRC.indexOf(")", head));
  let depth = 0;
  for (let i = start; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) return SRC.slice(head, i + 1);
  }
  throw new Error(`قوس غير مغلق في ${name}`);
}
const CONSTS = SRC.slice(SRC.indexOf("const MEDIA_WAKE_EVENTS"), SRC.indexOf("function armLazyStartup")) +
  SRC.slice(SRC.indexOf("const startupRead ="), SRC.indexOf("function runStartupSteps"));
const CODE = [
  "let startupBegun = false;",
  CONSTS,
  extract("frameStartsEagerly"), extract("beginStartup"), extract("armLazyStartup"),
  extract("wakeIfVideoPresent"), extract("runStartupSteps")
].join("\n");

// خطوات البدء تُستخرج من المصدر لا تُكتب هنا، فلا ينحرف الاختبار عن الكود
const EXPECTED_STEPS = [...extract("runStartupSteps").matchAll(/startup\("([^"]+)"/g)].map((m) => m[1]);

const LOADERS = ["loadRulesForThisHost", "loadSiteProfile", "loadZoneSettings", "loadOverlaySettings",
  "loadBlockedHosts", "loadSoundDisplaySettings", "loadGridAppearance", "loadSubtitleSettings",
  "startSubtitleTrackObserver", "loadYtAutoQualitySettings", "startYtAutoQuality", "triggerYtQuality",
  "loadYtShortsRedirectSetting", "startYtShortsRedirect", "loadCleanPlayerSettings", "startBoostReapply"];

function makeFrame({ youtube = false, videoPresent = false, readyState = "loading" } = {}) {
  const state = { steps: [], reads: 0, listeners: [], removed: [], observers: 0, videoPresent };
  const doc = {
    readyState,
    addEventListener: (type, fn, opt) => state.listeners.push({ type, fn, opt }),
    removeEventListener: (type, fn) => state.removed.push(type),
    querySelector: (sel) => (sel === "video" && state.videoPresent ? { tagName: "VIDEO" } : null)
  };
  const ctx = {
    document: doc,
    location: { host: "example.com", hostname: youtube ? "www.youtube.com" : "example.com" },
    isYouTubeFamilyHost: () => youtube,
    spKeyFor: (h) => `sp:${h}`,
    baseDomain: () => "example.com",
    MutationObserver: class { constructor() { state.observers++; } observe() {} disconnect() {} },
    chrome: { storage: { sync: { get: () => { state.reads++; return Promise.resolve({}); } } } },
    startup: (label, run) => { state.steps.push(label); try { return Promise.resolve().then(run).catch(() => {}); } catch { } },
    console
  };
  for (const fn of LOADERS) ctx[fn] = () => Promise.resolve();
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  state.ctx = ctx;
  state.fire = (type) => {
    for (const l of state.listeners.filter((x) => x.type === type)) l.fn();
  };
  state.begun = () => vm.runInContext("startupBegun", ctx);
  return state;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log(`\n[0] خطوات البدء المستخرجة من المصدر: ${EXPECTED_STEPS.length}`);
check("العدد معقول ويشمل كل الميزات", EXPECTED_STEPS.length >= 13, EXPECTED_STEPS);

console.log("\n[1] إطار بلا فيديو: لا يبدأ شيئاً ولا يقرأ التخزين");
{
  const f = makeFrame();
  f.ctx.armLazyStartup();
  check("لم تُنفَّذ أي خطوة بدء", f.steps.length === 0, f.steps);
  check("ولا قراءة تخزين واحدة", f.reads === 0, f.reads);
  check("ولا MutationObserver — الإيقاظ بالأحداث لا بالمراقبة", f.observers === 0, f.observers);
  check("ومستمعات الوسائط مُسلَّحة", f.listeners.filter((l) => l.type === "loadedmetadata").length === 1,
    f.listeners.map((l) => l.type));
}

console.log("\n[2] ⭐ الدورة كاملة: يخرج ⇒ يُضاف فيديو ⇒ يعمل بكل ميزاته");
{
  const f = makeFrame();
  f.ctx.armLazyStartup();
  check("نائم قبل الفيديو", f.steps.length === 0);

  f.videoPresent = true;
  f.fire("loadedmetadata");           // ما يُطلقه فيديو حقيقي فور بدء تحميله

  check("استيقظ", f.begun() === true);
  check(`ونفّذ كل الخطوات الـ${EXPECTED_STEPS.length} لا بعضها`,
    f.steps.length === EXPECTED_STEPS.length, { ran: f.steps.length, expected: EXPECTED_STEPS.length });
  for (const step of EXPECTED_STEPS) check(`  «${step}» عملت`, f.steps.includes(step), f.steps);
  check("وقراءة تخزين واحدة فقط", f.reads === 1, f.reads);
  check("ومستمعات الوسائط أُزيلت فلا تتسرّب", f.removed.includes("loadedmetadata"), f.removed);
}

console.log("\n[3] لا بدء مزدوج مهما تكرّر الإيقاظ");
{
  const f = makeFrame();
  f.ctx.armLazyStartup();
  f.videoPresent = true;
  f.fire("loadedmetadata"); f.fire("canplay"); f.fire("play");
  f.ctx.wakeIfVideoPresent(); f.ctx.wakeIfVideoPresent();
  check("الخطوات لم تتضاعف", f.steps.length === EXPECTED_STEPS.length, f.steps.length);
  check("والقراءة واحدة", f.reads === 1, f.reads);
}

console.log("\n[4] الاستثناءات: ما لا علاقة له بالفيديو يبدأ فوراً");
{
  const yt = makeFrame({ youtube: true });
  check("مضيف يوتيوب يبدأ فوراً ولو بلا فيديو", yt.ctx.frameStartsEagerly() === true);
  yt.ctx.beginStartup();
  check("  وتشمل تحويل Shorts", yt.steps.includes("ytShorts"), yt.steps);
  check("  و Clean Player", yt.steps.includes("cleanPlayer"), yt.steps);

  const other = makeFrame({ youtube: false });
  check("وغير يوتيوب لا يبدأ فوراً", other.ctx.frameStartsEagerly() === false);
}

console.log("\n[5] شبكة الأمان: فيديو لا يُطلق أحداث وسائط");
{
  // <video preload="none"> لا يُطلق شيئاً حتى يُلمس
  const f = makeFrame();
  f.ctx.armLazyStartup();
  f.videoPresent = true;
  check("لم يستيقظ بلا حدث وسائط", f.steps.length === 0);
  f.ctx.wakeIfVideoPresent();          // ما تفعله معالجات العجلة/النقر/المفاتيح
  check("لكن أول تفاعل مقصود يوقظه", f.begun() === true && f.steps.length === EXPECTED_STEPS.length,
    f.steps.length);

  // فيديو موجود في HTML الأصلي: DOMContentLoaded يلتقطه
  const g = makeFrame({ readyState: "loading" });
  g.ctx.armLazyStartup();
  g.videoPresent = true;
  g.fire("DOMContentLoaded");
  check("و DOMContentLoaded يلتقط فيديو HTML الأصلي", g.begun() === true, g.steps.length);

  // وإطار بلا فيديو يبقى نائماً مهما نقر المستخدم فيه
  const h = makeFrame();
  h.ctx.armLazyStartup();
  for (let i = 0; i < 50; i++) h.ctx.wakeIfVideoPresent();
  check("وإطار بلا فيديو يبقى نائماً بعد 50 تفاعلاً", h.steps.length === 0 && h.reads === 0, h.steps.length);
}

console.log("\n[6] ⭐ ما يقوله النائم — لا ما يستيقظ له (فجوة منهج كشفها #56)");
{
  // غطّى هذا الملف الإيقاظ ولم يغطِّ ما يردّ به النائم، فأفلت انحدار #56 كاملاً:
  // إطار نائم كان يردّ على GVZ_STATUS بقيم البدء الافتراضية فيقول الـ popup
  // «الإضافة متوقفة» والإضافة شغّالة. هذا القسم يسدّ الفجوة.
  const handler = SRC.slice(SRC.indexOf('if (msg?.type === "GVZ_STATUS")'),
    SRC.indexOf('if (msg?.type === "SITE_RULES_UPDATED")'));
  const ask = (begun) => {
    let answer = null, woke = false;
    const c = {
      msg: { type: "GVZ_STATUS" }, startupBegun: begun,
      sendResponse: (r) => { answer = r; },
      document: { querySelector: () => ({}) },
      getVideoFromPointerPosition: () => null, ytQualityGap: () => null,
      beginStartup: () => { woke = true; }, wakeIfVideoPresent: () => { woke = true; },
      console
    };
    vm.createContext(c);
    vm.runInContext(`(function(){ ${handler} })()`, c);
    return { answer, woke };
  };
  const asleep = ask(false);
  check("النائم يردّ not-started", asleep.answer?.ok === false && asleep.answer?.reason === "not-started", asleep.answer);
  check("ولا يستيقظ لرسالة — وإلا بطل #13ب كلّه", asleep.woke === false);
  check("ولا يفشي تفعيلاً ولا حظراً من قيم افتراضية",
    !("globalEnabled" in (asleep.answer || {})) && !("blocked" in (asleep.answer || {})), asleep.answer);

  // ولا مسار رسائل آخر يوقظ الإطار
  check("ولا معالج رسائل يستدعي beginStartup",
    !/onMessage[\s\S]{0,4000}beginStartup\(\)/.test(SRC));
}

console.log("\n[7] الإيقاظ موصول بمسارات التفاعل المقصود لا بـ mousemove");
{
  const wheel = SRC.slice(SRC.indexOf('window.addEventListener("wheel"'), SRC.indexOf('window.addEventListener("wheel"') + 300);
  check("مسار العجلة يوقظ", wheel.includes("wakeIfVideoPresent()"));
  check("مسار المفاتيح يوقظ",
    /addEventListener\("keydown"[\s\S]{0,200}wakeIfVideoPresent\(\)/.test(SRC));
  check("ومسار الفأرة يوقظ",
    /function handleMouse\(e\) \{[\s\S]{0,160}wakeIfVideoPresent\(\)/.test(SRC));
  // معالج mousemove هو updatePointerFromEvent نفسه — نفحص جسمه لا ما يليه في الملف
  check("و mousemove لا يوقظ — يقع آلاف المرات",
    !extract("updatePointerFromEvent").includes("wakeIfVideoPresent"),
    extract("updatePointerFromEvent"));
  check("ومعالج mousemove المسجَّل هو هي",
    /addEventListener\("mousemove", updatePointerFromEvent, true\)/.test(SRC));
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
