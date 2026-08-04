// البند #70 — إخفاء شريط تقدّم يوتيوب بالسكون: هدفٌ مقيس، وشرطان بنيويّان
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يختفي شريطُ يوتيوب كلُّه بالسكون، ولا يختفي وأنا ممسكٌ به؟»*
//
// **الهدف اختير بالقياس لا بالاسم** (`AUDIT.md` القسم الثالث عشر، خطّ أساس
// بتشغيلتين): `.ytp-progress-bar-container` أضيق مرشّح من ثمانية يجمع الاثني
// عشر التابعة ولا يمسّ الوقت ولا زرّاً واحداً. ⚠️ **فمن غيّره يُعيد القياس ولا
// يستبدله باسمٍ يشبهه.**
//
// **وطريقة الإخفاء من القياس كذلك**: `opacity:0` كما يفعل المضيف (مقيسٌ مع
// `ytp-autohide` في الحالتين 3 و8)، **لا `display:none`** — فلا إعادة تدفّق.
//
// ⚠️ **وفشل القسم [3] يعني أن صنف مضيفٍ تسلّل إلى شرط الامتناع.** الشرطان
// بنيويّان عمداً — **زرٌّ مضغوط** و**تركيزٌ داخل الهدف** — **وقد حلّا محلّ ثلاثة
// أصناف تموت** (`seeking-mode` · `ytp-probably-keyboard-focus` ·
// `ytp-settings-shown`). أخرِج الصنف ولا تُعدّل التأكيد.
//
// ⚠️ **وحدٌّ معروف مكتوب فلا يُضاف له حارسٌ لاحقاً بحسن نيّة (قرار المالك):**
// **قائمة الإعدادات لا تحتاج شرط امتناع** — `.ytp-popup` **خارج** الحاوية فتبقى
// ظاهرة. والقسم [5] يُثبّت أن أحداً لم يُضف لها حارساً.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

function body(name) {
  const i = SRC.indexOf(name);
  if (i === -1) return null;
  const j = SRC.indexOf("\n}", i);
  return j === -1 ? null : SRC.slice(i, j);
}
function slice(from, to) {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  return a === -1 || b === -1 ? null : SRC.slice(a, b);
}
const CODE = SRC.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");

console.log("\n=== #70 — إخفاء شريط التقدّم بالسكون ===\n");

// ── [1] الهدف — واحدٌ، ومقيس ────────────────────────────────────────────────
// ⛔ **انقلب هذا القسم بقرار المالك 2026-08-03، والانقلاب مقصود ومكتوب:**
// كان يشترط `.ytp-progress-bar-container` **ويُحرّم `.ytp-chrome-bottom` بوصفه
// «أوسع من المطلوب قطعاً»** — **وذلك المعيار سُحب** (قرار 21): لم يكن معيار صاحب
// المشروع. **والغرض بنصّه: «المفترض يختفي كل شيء، حتى الوقت والأزرار».**
// ⚠️ **ولم يُعدَّل التأكيد ليمرّ** (قرار 33) — **بل انقلب الشرط لأن المطلوب انقلب**،
// والفرق أن هذا يبقى تغطيةً: هدفٌ غيرُ المقصود اليوم **يُحمّر كما كان يُحمّر أمس**.
console.log("[1] الهدف: `.ytp-chrome-bottom` وحده — الشريط السفلي بكامله");
{
  check("[1] الثابت مسمّى لا نصٌّ مبعثر",
    /const YT_PROGRESS_SELECTOR = "\.ytp-chrome-bottom";/.test(SRC));
  const n = (CODE.match(/\.ytp-chrome-bottom/g) || []).length;
  check("[1] وموضع واحد في الكود", n === 1, `العدد ${n}`);
  // وما يجب ألّا يُستهدَف اليوم: الهدف الضيّق المسحوب — فالعودة إليه انحدارٌ
  check("[1] ولا يعود إلى `.ytp-progress-bar-container` (المعيار المسحوب)",
    !/YT_PROGRESS_SELECTOR = "\.ytp-progress-bar-container";/.test(SRC));
}

// ── [2] طريقة الإخفاء — مطابقةٌ للمضيف، مقيسة ──────────────────────────────
console.log("\n[2] `opacity:0` كما يفعل المضيف، لا `display:none`");
{
  const css = body("function ensureYtProgressCss()");
  check("[2] القاعدة تستعمل `opacity:0`", !!css && /opacity:0 !important/.test(css), css);
  check("[2] ومعها `pointer-events:none` — فلا يُسحَب شريطٌ غير مرئيّ",
    !!css && /pointer-events:none !important/.test(css), css);
  check("[2] ولا `display:none` فيها", !!css && !/display:\s*none/.test(css), css);
  check("[2] ولا `visibility:hidden`", !!css && !/visibility:\s*hidden/.test(css), css);

  // ورقةٌ تُحقَن مرّة وصنفٌ يُقلَب — لا حقن/نزع عند كل انتقال
  const set = body("function setYtProgressHidden(on)");
  check("[2] والانتقال قلبُ صنف لا حقن ورقة",
    !!set && /classList\.toggle/.test(set) && !/createElement/.test(set), set);
  check("[2] والورقة تُحقَن مرّة (حارس `isConnected`)",
    !!css && /ytProgressStyleEl\?\.isConnected/.test(css), css);
}

// ── [3] ⭐ شرطا الامتناع — بنيويّان، صفر صنف مضيف ──────────────────────────
console.log("\n[3] ⭐ الامتناع بنيويّ: صفر صنف مضيفٍ يموت");
{
  const consumer = slice("IDLE_CONSUMERS.progressBar = {", "\n};");
  check("[3] المستهلك مسجَّل في السجلّ نفسه", !!consumer);
  check("[3] وشرطه الأول: زرٌّ مضغوط", !!consumer && /idlePointerHeld/.test(consumer), consumer);
  check("[3] وشرطه الثاني: التركيز داخل الهدف",
    !!consumer && /focusInside\(YT_PROGRESS_SELECTOR\)/.test(consumer), consumer);
  for (const cls of ["seeking-mode", "ytp-probably-keyboard-focus", "ytp-settings-shown", "ytp-autohide"]) {
    check(`[3] ولا «${cls}» في الكود إطلاقاً`, !new RegExp(cls).test(CODE));
  }
}

// ── [4] البوّابة والمفتاح ──────────────────────────────────────────────────
console.log("\n[4] البوّابة #64 والمفتاح المطفأ افتراضاً");
{
  const gate = body("function progressHideActive()");
  check("[4] البوّابة تنادي `extensionActive()`", !!gate && gate.includes("extensionActive()"), gate);
  check("[4] ومحصورةٌ بعائلة يوتيوب", !!gate && /isYouTubeFamilyHost\(\)/.test(gate), gate);
  check("[4] ولا تفحص الحظر بنفسها", !!gate && !/isBlockedHost/.test(gate));
  const loader = body("async function loadOverlaySettings(pre)");
  check("[4] والمفتاح `!!` مطفأ افتراضاً",
    !!loader && /hideProgressBar: !!o\.hideProgressBar/.test(loader), loader);
  const entries = fs.readFileSync("tools/test-master-gate.js", "utf8");
  check("[4] وهي مسجَّلة في `ENTRIES`", /function progressHideActive\(\)/.test(entries));
}

// ── [5] ⭐ السلوك — على الكود نفسه ──────────────────────────────────────────
console.log("\n[5] ⭐ السلوك: يُخفي بالسكون، ويمتنع تحت اليد وتحت التركيز");
{
  const ENGINE = slice("const IDLE_MIN_MS", "// الدخول إلى ملء الشاشة");
  const FEATURE = slice("const YT_PROGRESS_SELECTOR", "\n};");
  if (!ENGINE || !FEATURE) {
    console.log("  ❌ تعذّر الاقتطاع — **المرساة سقطت، أصلِح المرساة لا التأكيد**");
    fail++;
  } else {
    const clock = { t: 1000, q: [], seq: 0 };
    const listeners = {};
    const htmlClasses = new Set();
    const injected = [];
    const ctx = {
      console,
      nowMs: () => clock.t,
      setTimeout: (fn, ms) => { const id = ++clock.seq; clock.q.push({ id, at: clock.t + (Number(ms) || 0), fn }); return id; },
      clearTimeout: (id) => { const i = clock.q.findIndex((x) => x.id === id); if (i > -1) clock.q.splice(i, 1); },
      extensionActive: () => ctx.__gate,
      isYouTubeFamilyHost: () => true,
      settingsRead: async () => ({ settings: {} }),
      getVideoUnderPointer: () => ({ tagName: "VIDEO" }),
      overlaySettings: { hideProgressBar: true },
      window: { addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); } },
      document: {
        addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
        hidden: false,
        activeElement: null,
        // #95 — المحرّك يسأل عن هدف المستهلك، فالسند يُقدّمه بمستطيلٍ معلوم.
        // **والمؤشّر خارجه افتراضاً** (lastPointer غير معرَّف) فلا يمتنع.
        querySelector: () => ({ isConnected: true,
          getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20 }) }),
        createElement: () => ({ isConnected: false, set textContent(v) { injected.push(v); }, get textContent() { return injected[injected.length - 1]; } }),
        documentElement: {
          classList: {
            toggle: (c, on) => { if (on) htmlClasses.add(c); else htmlClasses.delete(c); },
            has: (c) => htmlClasses.has(c)
          },
          appendChild: (el) => { el.isConnected = true; }
        }
      },
      lastPointer: { x: null, y: null },   // #95 — تقرؤها القاعدة العامّة
      __gate: true
    };
    vm.createContext(ctx);
    // ⚠️ **#106 — والمحدِّد يُؤخذ بنصّه من المنتَج، ولا يُكتب هنا نظيرٌ له:**
    // `KNOWN_PLAYER_WRAPPER_SELECTOR` خارج الشريحة، **و`const` في `vm` لا يصير
    // خاصّيةً في السياق** (`test-vm-scope.js`) ⇒ **فيُضمّ إلى السكربت نفسِه.**
    // ⛔ **وقد وقع العطبُ فعلاً في أوّل تشغيلة**: الاسمُ غيرُ مُحلّ ⇒ `catch`
    // في `playerRectForTarget` **يبتلع** ⇒ **القصُّ يسقط صامتاً ويبدو أن الهامش
    // بلا حدّ** — **والحارسُ هو من أمسكه، لا القراءة.**
    const WRAP = (SRC.match(/const KNOWN_PLAYER_WRAPPER_SELECTOR =[\s\S]*?;\n/) || [""])[0];
    check("[5] مرساة المحدِّد المشترك قائمة", WRAP.length > 0);
    vm.runInContext(WRAP + ENGINE + "\n" + FEATURE + "\n};", ctx);
    const hidden = () => htmlClasses.has("vz-idle-hide-progress");
    const fire = (t, ev = {}) => { for (const fn of listeners[t] || []) fn(ev); };
    const advance = (ms) => {
      const end = clock.t + ms;
      for (;;) {
        let next = null;
        for (const it of clock.q) if (it.at <= end && (!next || it.at < next.at)) next = it;
        if (!next) break;
        clock.q.splice(clock.q.indexOf(next), 1);
        clock.t = next.at; next.fn();
      }
      clock.t = end;
    };

    vm.runInContext("refreshIdleConsumers()", ctx);
    // ⭐ **لا نلمس المضيف قبل أن نرى نشاطاً ولو مرّة.** المحرّك يبدأ ساكناً —
    // وهو الصواب لزرّ #72 — **وعكسُه هنا**: صفحةٌ تُفتح والمؤشّر فوق المشغّل
    // كانت ستُخفي شريط المضيف **قبل أن تمضي مهلةٌ واحدة**.
    check("[5] ⭐ لا إخفاء قبل أول نشاط — لا نلمس المضيف بلا سبب",
      hidden() === false, hidden());
    vm.runInContext("markIdleActivity()", ctx);
    check("[5] وأول نشاط يُظهره", hidden() === false);
    advance(2100);
    check("[5] وبعد المهلة يختفي", hidden() === true);

    // ⭐ سحبٌ بلا حركة: mousedown ثمّ صمتٌ تامّ — **لا إخفاء**
    vm.runInContext("markIdleActivity()", ctx);
    fire("mousedown", { isTrusted: true, type: "mousedown" });
    advance(3000);
    check("[5] ⭐ سحبٌ بلا حركة (mousedown ثمّ صمت) ⇒ **لا يُخفى تحت اليد**",
      hidden() === false, { held: vm.runInContext("idlePointerHeld", ctx) });
    fire("mouseup", {});
    check("[5] والإفلات يرفع الامتناع", vm.runInContext("idlePointerHeld", ctx) === false);
    advance(2100);
    check("[5] ثمّ يختفي بعد المهلة", hidden() === true);

    // ⭐ التركيز داخل الهدف
    vm.runInContext("markIdleActivity()", ctx);
    // المرساة تتبع الهدف — وقد انقلب بقرار المالك. **إصلاح المرساة لا التأكيد** (قرار 33).
    ctx.document.activeElement = { closest: (s) => (s === ".ytp-chrome-bottom" ? {} : null) };
    advance(3000);
    check("[5] ⭐ والتركيز داخل الهدف ⇒ لا إخفاء (تنقّل لوحة المفاتيح لا ينكسر)",
      hidden() === false);
    ctx.document.activeElement = null;
    vm.runInContext("refreshIdleConsumers()", ctx);
    check("[5] ورفع التركيز يعيده إلى حالة المحرّك", hidden() === true);

    // وإطفاء المفتاح **يستعيد** الشريط ولا يتركه عالقاً
    ctx.overlaySettings.hideProgressBar = false;
    vm.runInContext("refreshIdleConsumers()", ctx);
    check("[5] ⭐ وإطفاء المفتاح يُعيد الشريط — لا إخفاء عالق", hidden() === false);

    // ── [6] ⭐ #106 — منطقةُ الامتناع أوسعُ من الهدف، ومحدودةٌ بالمشغّل ────────
    // **السؤال بلغة المستخدم:** *«هل يكفي أن أقترب من الشريط ليبقى، أم يلزمني أن
    // أُصيب تسعةً وخمسين بكسلاً؟»*
    // ⚠️ **والمقاسات من القياس لا من الخيال:** الشريط **59px** (القسم الرابع
    // عشر: `chrome.h = 59`)، **وأسفلُه على أسفل المشغّل** — وهي الشكل الذي يجعل
    // القصَّ مؤثّراً. **والهامش 40 قرارُ تصميم**، فالحدّ المقيس هنا **سلوكُ
    // المنطقة لا صوابُ الرقم**.
    console.log("\n[6] ⭐ #106 — الهامش العموديّ: يقع فوق، ويُقصّ عند حدّ المشغّل");
    const BAR = { left: 0, top: 100, right: 700, bottom: 159, width: 700, height: 59 };
    const PLAYER = { left: 0, top: 0, right: 700, bottom: 159, width: 700, height: 159 };
    ctx.document.querySelector = () => ({
      isConnected: true,
      getBoundingClientRect: () => BAR,
      closest: () => ({ getBoundingClientRect: () => PLAYER })
    });
    ctx.overlaySettings.hideProgressBar = true;
    // ⚠️ **المفتاح أُطفئ في السطر أعلاه فالمحرّك مطفأ** — وبلا هذا السطر
    // **يخرج القسم كلُّه أخضرَ عن عمى**: `markIdleActivity` لا تفعل شيئاً،
    // فتبقى الحالُ على آخر ما كانت عليه **فتُقرأ «لم يُخفَ» امتناعاً**.
    // ⇒ **وهو الصفر الكاذب بعينه، وقد وقع في أوّل تشغيلة لهذا القسم.**
    vm.runInContext("refreshIdleConsumers()", ctx);
    const rest = (x, y) => {
      ctx.lastPointer.x = x; ctx.lastPointer.y = y;
      vm.runInContext("markIdleActivity()", ctx);
      advance(3000);
      return hidden();
    };
    // **الشاهد الموجب**: داخل الهدف نفسِه — لو احمرّ فالمِجَسّ لا يرى أصلاً
    check("[6] المؤشّر داخل الشريط ⇒ لا إخفاء (الشاهد الموجب)", rest(350, 130) === false);
    // ⭐ **وهو الحدّ الذي وُلد له البند**: 30px فوق أعلى الشريط — كان يُخفى قبله
    check("[6] ⭐ و30px فوق أعلى الشريط ⇒ لا إخفاء (وهو ما كان يُخفى)", rest(350, 70) === false);
    // **الشاهد السالب**: خارج الهامش ⇒ يُخفى — فالمنطقة محدودة لا مفتوحة
    check("[6] ⭐ و50px فوقه ⇒ يُخفى (الهامش محدود لا مفتوح)", rest(350, 50) === true);
    // ⭐ **والقصّ عند حدّ المشغّل**: 20px **تحت** الشريط تقع خارج المشغّل هنا،
    // **فلا يمتدّ الهامش إليها** — وهي حالُ «الخروج من إطار المشغّل» ولها حكمُها.
    check("[6] ⭐ و20px تحت الشريط خارج المشغّل ⇒ يُخفى (الهامش مقصوصٌ بالمشغّل)",
      rest(350, 179) === true);
    // **ولا يُحيي الهامشُ هدفاً مخفيّاً** (حارس المستطيل الصفريّ يسبقه)
    ctx.document.querySelector = () => ({
      isConnected: true,
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
      closest: () => ({ getBoundingClientRect: () => PLAYER })
    });
    check("[6] ⭐ وهدفٌ `0×0` لا يُحييه الهامش (قرار 22 يسبقه)", rest(350, 130) === true);
  }
}

// ── [7] ⭐ #106 — الرقم في موضعٍ واحد، وحدُّه مكتوبٌ معه ─────────────────────
// ⚠️ **يُحرَس النصُّ هنا لأن الحدّ نفسَه هو المنتَج:** رقمٌ بلا «اختيارٌ لا قياس»
// **يُقرأ بعد سنة قياساً**، فيُبحث له عن سندٍ لا وجود له أو يُظنّ مقدّساً.
// **وهو قرار 96 مطبَّقاً على سطرٍ في الكود لا على تقرير.**
console.log("\n[7] ⭐ #106 — الرقم واحد، ومعه حدُّه");
{
  const decl = SRC.match(/const IDLE_NEAR_PAD_PX = (\d+);/);
  check("[7] الرقم معرَّفٌ مرّةً واحدة", !!decl && SRC.split("IDLE_NEAR_PAD_PX =").length === 2, decl && decl[1]);
  const head = SRC.slice(Math.max(0, SRC.indexOf("const IDLE_NEAR_PAD_PX") - 2400), SRC.indexOf("const IDLE_NEAR_PAD_PX"));
  check("[7] ⭐ ومعه أنه **اختيارٌ لا قياس**", /اختيارٌ لا قياس/.test(head), head.slice(-200));
  check("[7] ⭐ وسندُه مذكورٌ بتناقضه (دليلٌ تقريبيّ لا رقمٌ دقيق)",
    /تقريبيّ/.test(head) && /59/.test(head), head.slice(-200));
  check("[7] ⭐ وحكمُه ميدانُ المالك", /ميدانُ المالك/.test(head), head.slice(-200));
  // ⭐ **والقصُّ يحمل قيدَه معه — فلا يُزال بحسبانه كوداً ميتاً** (طلب المالك
  // 2026-08-05، بعد قياسه: أسفلُ الشريط على أسفل المشغّل `0px`). **الفرعُ لا يقع
  // على يوتيوب أبداً، ويقع على مضيفٍ يعلو شريطُه حافّةَ مشغّله** — **وحذفُه
  // يكسر ذاك المضيفَ صامتاً**، فالقيدُ في الكود شرطٌ لا زينة.
  const clampFn = SRC.match(/function playerRectForTarget\(el\)[\s\S]*?\n}/);
  check("[7] ⭐ والقصُّ قائم", !!clampFn && /closest\?\.\(KNOWN_PLAYER_WRAPPER_SELECTOR\)/.test(clampFn[0]));
  const clampNote = SRC.slice(SRC.indexOf("let top = r.top - padY") - 1500, SRC.indexOf("let top = r.top - padY") + 1500);
  check("[7] ⭐ ومعه «صفرٌ هنا بقياس يوتيوب، ولا يُحذف»",
    /صفرٌ هنا بقياس يوتيوب، ولا يُحذف/.test(clampNote));
  check("[7] ⭐ وسببُ بقائه مكتوبٌ (مضيفٌ يعلو شريطُه حافّتَه)",
    /فوق حافّة مشغّله/.test(clampNote));
  // **والمستهلك وحده يُعلنه** — لا المحرّك
  const cons = SRC.match(/IDLE_CONSUMERS\.progressBar = \{[\s\S]*?\n\};/);
  check("[7] والمستهلك يُعلنه (لا المحرّك)", !!cons && /nearPad: \(\) => IDLE_NEAR_PAD_PX/.test(cons[0]));
  // ⭐ **شاهد قرار 47: يُحمّر على كودٍ بلا حدّ** — لا على شبيهٍ يُفتعل
  check("[7] ⭐ والحارس يرى رقماً بلا حدّ فلا يُصدَّق خضاره",
    !/اختيارٌ لا قياس/.test("const IDLE_NEAR_PAD_PX = 40;"));
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
