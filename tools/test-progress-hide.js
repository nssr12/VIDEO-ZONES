// البند #70 — إخفاء شريط تقدّم يوتيوب بالسكون: هدفٌ مقيس، وشرطان بنيويّان
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
        createElement: () => ({ isConnected: false, set textContent(v) { injected.push(v); }, get textContent() { return injected[injected.length - 1]; } }),
        documentElement: {
          classList: {
            toggle: (c, on) => { if (on) htmlClasses.add(c); else htmlClasses.delete(c); },
            has: (c) => htmlClasses.has(c)
          },
          appendChild: (el) => { el.isConnected = true; }
        }
      },
      __gate: true
    };
    vm.createContext(ctx);
    vm.runInContext(ENGINE + "\n" + FEATURE + "\n};", ctx);
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
  }
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
