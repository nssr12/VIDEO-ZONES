// Audit #21 (what remained after #13b): the subtitle track observer was created
// UNCONDITIONALLY with its guard inside the callback — so the browser collected and
// delivered mutations even to someone who had turned subtitles off entirely — and it
// was never disconnected.
//
// #13b already removed it from frames with no video (121 of 122 contexts on
// aljazeera.net). What was left is the frames that DO have a video, and that is what
// this test covers.
//
// EVERY ASSERTION HERE COUNTS. A visual check would not catch the failure that
// matters: an observer that is created again without the previous one being
// disconnected leaks silently and behaves correctly, so only the instantiation and
// disconnect counters can tell the difference.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
if (!SRC.includes("function syncSubtitleTrackObserver")) {
  console.log("  ❌ syncSubtitleTrackObserver غائبة — ما تبقّى من #21 غير منفَّذ");
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
const CODE = ["let subtitleTrackObserver = null;",
  extract("subtitleTrackWatchWanted"), extract("syncSubtitleTrackObserver")].join("\n");

function makeWorld({ enabled = true, lang = "ar", blocked = false, hasBody = true } = {}) {
  const st = { created: 0, disconnected: 0, observed: [], live: 0 };
  class FakeObserver {
    constructor(cb) { st.created++; st.live++; this.cb = cb; }
    observe(target, opts) { st.observed.push({ target: target && target.tag, opts }); }
    disconnect() { st.disconnected++; st.live--; }
  }
  const ctx = {
    MutationObserver: FakeObserver,
    subtitleSettings: { enabled, defaultLang: lang },
    isBlockedHost: () => blocked,
    enableMatchingTextTrack: () => {},
    document: { body: hasBody ? { tag: "BODY" } : null, documentElement: { tag: "HTML" } },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  st.ctx = ctx;
  st.set = (patch) => Object.assign(ctx.subtitleSettings, patch);
  st.hasObserver = () => vm.runInContext("!!subtitleTrackObserver", ctx);
  return st;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log("\n[1] لا يُنشأ إلا عند تفعيل الترجمة");
{
  const off = makeWorld({ enabled: false });
  off.ctx.syncSubtitleTrackObserver();
  check("الترجمة مطفأة ⇒ لا مراقب إطلاقاً", off.created === 0 && !off.hasObserver(), off.created);

  const noLang = makeWorld({ enabled: true, lang: "" });
  noLang.ctx.syncSubtitleTrackObserver();
  check("مفعّلة بلا لغة ⇒ لا مراقب", noLang.created === 0, noLang.created);

  const blocked = makeWorld({ blocked: true });
  blocked.ctx.syncSubtitleTrackObserver();
  check("موقع محظور ⇒ لا مراقب", blocked.created === 0, blocked.created);

  const on = makeWorld();
  on.ctx.syncSubtitleTrackObserver();
  check("مفعّلة بلغة ⇒ مراقب واحد", on.created === 1 && on.live === 1, on);
}

console.log("\n[2] ⭐ عشر دورات تفعيل/إطفاء — بالعدّ لا بالنظر");
{
  const w = makeWorld({ enabled: false });
  for (let i = 0; i < 10; i++) {
    w.set({ enabled: true });  w.ctx.syncSubtitleTrackObserver();
    check(`  الدورة ${i + 1}: مراقب حيّ واحد لا أكثر`, w.live === 1, w.live);
    w.set({ enabled: false }); w.ctx.syncSubtitleTrackObserver();
  }
  check("أُنشئ 10 مرات بالضبط", w.created === 10, w.created);
  check("وفُصل 10 مرات بالضبط", w.disconnected === 10, w.disconnected);
  check("ولا مراقب متسرّب في النهاية", w.live === 0 && !w.hasObserver(), { live: w.live });
}

console.log("\n[3] لا مراقبان على نفس العنصر — الاستدعاء المتكرّر لا يُنشئ");
{
  const w = makeWorld();
  for (let i = 0; i < 10; i++) w.ctx.syncSubtitleTrackObserver();
  check("عشر مزامنات متتالية ⇒ إنشاء واحد", w.created === 1, w.created);
  check("و observe مرة واحدة", w.observed.length === 1, w.observed.length);

  // والإطفاء المتكرّر لا يفصل مرتين
  w.set({ enabled: false });
  for (let i = 0; i < 10; i++) w.ctx.syncSubtitleTrackObserver();
  check("وعشر مزامنات بعد الإطفاء ⇒ فصل واحد", w.disconnected === 1, w.disconnected);
  check("ولا مراقب حيّ", w.live === 0);
}

console.log("\n[4] النطاق: body لا documentElement");
{
  const w = makeWorld();
  w.ctx.syncSubtitleTrackObserver();
  check("يراقب body", w.observed[0]?.target === "BODY", w.observed[0]);
  check("بـ childList و subtree", w.observed[0]?.opts?.childList === true && w.observed[0]?.opts?.subtree === true,
    w.observed[0]?.opts);

  const noBody = makeWorld({ hasBody: false });
  noBody.ctx.syncSubtitleTrackObserver();
  check("وإن غاب body يسقط إلى documentElement فلا تُهمَل المراقبة",
    noBody.observed[0]?.target === "HTML", noBody.observed[0]);
}

console.log("\n[5] الحارس خرج من الـ callback إلى شرط الإنشاء");
{
  check("لا فحص enabled داخل جسم المراقب",
    !/new MutationObserver\(\(mutations\) => \{\s*if \(!subtitleSettings\.enabled/.test(SRC));
  check("والشرط في دالة واحدة مشتركة", SRC.includes("function subtitleTrackWatchWanted()"));
  check("ويُستدعى من مُحمِّل الترجمة فيسري فوراً",
    /applyCleanPlayerCSS\(\);[\s\S]{0,220}syncSubtitleTrackObserver\(\);/.test(SRC));
  check("ومن مُحمِّل قائمة الحظر كذلك",
    /blockedHosts = Array\.isArray[\s\S]{0,260}syncSubtitleTrackObserver\(\);/.test(SRC));
}

console.log("\n[6] الإطار النائم (#13ب): لا مراقب، وعند الاستيقاظ حسب الحالة وقتها");
{
  check("الإنشاء يمرّ بخطوة بدء فلا يقع في إطار نائم",
    /startup\("subtitleObserver", startSubtitleTrackObserver\)/.test(SRC));
  // يستيقظ والترجمة مطفأة ⇒ لا مراقب
  const asleepThenOff = makeWorld({ enabled: false });
  asleepThenOff.ctx.syncSubtitleTrackObserver();
  check("استيقظ والترجمة مطفأة ⇒ لا مراقب", asleepThenOff.created === 0);
  // يستيقظ والترجمة مفعّلة ⇒ مراقب واحد
  const asleepThenOn = makeWorld({ enabled: true });
  asleepThenOn.ctx.syncSubtitleTrackObserver();
  check("استيقظ والترجمة مفعّلة ⇒ مراقب واحد", asleepThenOn.created === 1 && asleepThenOn.live === 1);
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
