// البند #38ج — التفعيل اليدوي يحقن ما يحقنه المانيفست، لا أقلّ ولا أوسع.
//
// **العَرَض:** ضبط الجودة لا يعمل بعد **التفعيل اليدوي** على يوتيوب، **وبلا أي
// رسالة**. والسبب المقيس: المانيفست يحقن **سكربتين** — `content.js` في العالم
// المعزول و`yt_quality_main.js` في عالم الصفحة — بينما `activateOnCurrentPage`
// كان يحقن **واحداً**، فلا مستمع لـ`__vz_setq__` وتذهب رسالة `content.js` إلى
// لا أحد **بصمت**.
//
// ⚠️ **ولا يُبنى أي تأكيد هنا على «تغيّرت الجودة».** قِيس ميدانياً أن **ABR
// يوتيوب** يغيّر الجودة من تلقائه (`large ⇒ hd1080` و`⇒ hd720` بلا أي ردّ منّا)،
// فشاهدٌ مبنيّ على القيمة **يكذب في الاتجاهين**: يُثبت نجاحاً لم يقع ويخفي فشلاً
// وقع. **الشاهد هنا ردّ المستمع وحده** — كما في المقياس الميداني
// `tools/bench-yt-quality-manual.mjs`.
//
// ⚠️ وفشل قسم [٣] يعني أن `window.__vzQB` عاد إلى أعلى الملف. **لا تُعِده:**
// العلم يجب أن يصف **مستمعين مسجَّلين بالفعل** لا نيّةً أُطلقت، وإلا صارت حالة
// «علمٌ مرفوع بلا مستمع» ممكنة — **وهي مقيسة** — فيمنع الحارسُ حقناً صحيحاً لاحقاً.
const fs = require("fs");
const vm = require("vm");

const POPUP = fs.readFileSync("popup.js", "utf8");
const MAIN = fs.readFileSync("yt_quality_main.js", "utf8");
const MANIFEST = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

console.log("\n=== #38ج — الحقن اليدوي ===\n");

// ---------------------------------------------------------------- [١] الحقن
console.log("[١] `activateOnCurrentPage` يحقن السكربتين");
{
  const fn = POPUP.slice(POPUP.indexOf("async function activateOnCurrentPage"),
                         POPUP.indexOf("async function loadGlobalData"));
  check("[١] يحقن yt_quality_main.js", fn.includes(`files: ["yt_quality_main.js"]`), "غائب");
  check("[١] في عالم الصفحة world: \"MAIN\"", /world:\s*"MAIN"/.test(fn), "غائب");
  check("[١] ويحقن content.js كما كان", fn.includes(`files: ["content.js"]`));
  check("[١] مقيَّداً بمضيفي يوتيوب (لا يُحقن حيث لا فائدة)", /isYouTubeUrl\(url\)/.test(fn));

  // **الترتيب شرط لا تجميل**: بدء `content.js` ينادي triggerYtQuality مباشرةً،
  // فبوجود المستمع سلفاً تُطبَّق الجودة فوراً بلا انتظار yt-navigate-start.
  const iMain = fn.indexOf("yt_quality_main.js");
  const iContent = fn.indexOf(`files: ["content.js"]`);
  check("[١] وسكربت العالم الرئيسي **قبل** content.js", iMain !== -1 && iMain < iContent,
    `main=${iMain} content=${iContent}`);
}

// ------------------------------------------------- [٢] نطاق مطابق للمانيفست
console.log("\n[٢] النطاق نظير المانيفست حرفياً — لا أوسع ولا أضيق");
{
  const entry = (MANIFEST.content_scripts || []).find(
    (c) => (c.js || []).includes("yt_quality_main.js"));
  check("[٢] المانيفست يعلن yt_quality_main.js", !!entry);
  check("[٢] وعالمه MAIN", entry?.world === "MAIN", entry?.world);
  check("[٢] ومطابقاته *://*.youtube.com/*",
    JSON.stringify(entry?.matches) === JSON.stringify(["*://*.youtube.com/*"]),
    JSON.stringify(entry?.matches));

  // تُقتطع الدالّة من `popup.js` نفسه إلى **نهاية جسمها** لا بعدد أحرف: القطع
  // بالطول كسر البناء في أول تشغيلة، وهو خطأ أداة لا خطأ كود.
  const at = POPUP.indexOf("function isYouTubeUrl");
  const end = POPUP.indexOf("\n}\n", at);
  const SRC = at === -1 || end === -1 ? null : POPUP.slice(at, end + 3);
  check("[٢] `isYouTubeUrl` مقتطعة من popup.js", !!SRC);
  const isYouTubeUrl = SRC && vm.runInNewContext(
    `(function () { ${SRC}; return isYouTubeUrl; })()`, { URL });
  for (const [u, want] of [
    ["https://www.youtube.com/watch?v=x", true],
    ["https://youtube.com/watch?v=x", true],
    ["https://m.youtube.com/watch?v=x", true],
    ["http://www.youtube.com/", true],
    ["https://www.youtube-nocookie.com/embed/x", false], // خارج مطابقات المانيفست
    ["https://notyoutube.com/", false],
    ["https://youtube.com.evil.test/", false],           // لا يُخدع باللاحقة
    ["https://vimeo.com/1", false],
    ["", false]
  ]) {
    check(`[٢] ${u || "(فارغ)"} ⇒ ${want}`, isYouTubeUrl(u) === want, isYouTubeUrl(u));
  }
}

// ------------------------------------- [٣] العلم يصف واقعاً لا نيّة + المستمع
console.log("\n[٣] `__vzQB` بعد تسجيل المستمعين، والمستمع يردّ");
{
  // نافذة/مستند مزيّفان بواجهة الأحداث وحدها — ما يحتاجه السكربت لا أكثر.
  const mk = () => {
    const L = new Map();
    return {
      listeners: L,
      addEventListener: (t, h) => { (L.get(t) || L.set(t, []).get(t)).push(h); },
      dispatchEvent: (e) => { (L.get(e.type) || []).forEach((h) => h(e)); return true; }
    };
  };
  const win = mk(), doc = mk();
  doc.querySelector = () => null;               // لا مشغّل: يكفي لفحص وجود المستمع
  const flagWhenRegistered = [];
  const origAdd = win.addEventListener;
  win.addEventListener = (t, h) => {
    origAdd(t, h);
    if (t === "__vz_setq__") flagWhenRegistered.push(win.__vzQB);
  };

  const sandbox = {
    window: win, document: doc, setTimeout, Date,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  };
  sandbox.window.CustomEvent = sandbox.CustomEvent;
  vm.runInNewContext(MAIN, sandbox);

  check("[٣] العلم مرفوع بعد التشغيل", win.__vzQB === true);
  // **جوهر القلب**: لحظةَ سُجّل المستمع لم يكن العلم مرفوعاً بعد
  check("[٣] وعند تسجيل المستمع لم يكن مرفوعاً — أي أنه يصف واقعاً وقع",
    flagWhenRegistered.length === 1 && !flagWhenRegistered[0], JSON.stringify(flagWhenRegistered));
  check("[٣] المستمع مسجَّل فعلاً", (win.listeners.get("__vz_setq__") || []).length === 1);

  // **الشاهد: ردّ المستمع، لا قيمة الجودة.** طلب فارغ يردّ فوراً بلا مشغّل.
  const replies = [];
  win.addEventListener("__vz_setq_done__", (e) => replies.push(e.detail));
  win.dispatchEvent(new sandbox.CustomEvent("__vz_setq__", { detail: { q: "" } }));
  const settled = new Promise((r) => setTimeout(r, 50));
  module.exports = settled.then(() => {
    check("[٣] الطلب الفارغ يردّ `no-quality-requested` — وجود المستمع مُثبَت بردّه",
      replies.length === 1 && replies[0]?.result === "no-quality-requested",
      JSON.stringify(replies));

    // الحارس يمنع تسجيلاً ثانياً على نافذة رُفع علمها
    vm.runInNewContext(MAIN, sandbox);
    check("[٣] إعادة التشغيل لا تسجّل مستمعاً ثانياً",
      (win.listeners.get("__vz_setq__") || []).length === 1);

    console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
    process.exit(fail ? 1 : 0);
  });
}
