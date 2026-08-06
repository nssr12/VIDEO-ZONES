// البند #108 — لوحةُ فلاتر الصورة: سجلٌّ واحد · فلترٌ على الفيديو وحده · وامتناعٌ مُعلَن
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أفتح لوحةَ الفلاتر وأحرّك
// منزلقاً — أتتغيّر الصورة، ويبقى شريطُ يوتيوب ظاهراً تحتها، ولا يختفي كلُّه بلمسة؟»*
//
// ⚠️ **وثلاثةٌ يحرسها هذا الملفّ لأن سقوطها صامتٌ:**
//  · **الفلترُ على `<video>` وحدَه** — و`filter` على سلفٍ **يبتلع `position:fixed`
//    من نسله** ⇒ **طبقتُنا في ملء الشاشة تُفلتَر معه وينزاح موضعُها**. **والقيدُ
//    مكتوبٌ في الكود بجواره** (طلب المالك)، **وهذا يحرس بقاءه.**
//  · **وفلترُ SVG لا يدخل السلسلة إلا إذا غادرت الجاما افتراضَها** — **وهو ثمنٌ
//    مقيس** (‏SVG وحدَه 41–53fps من 60 مقابل ~58 لـCSS)، **فدخولُه بلا طلبٍ
//    يدفع الثمنَ على من لم يطلبه.**
//  · **ولوحةٌ مفتوحة ⇒ لا يُخفى شريطُ المضيف تحتها** — إعلانُ امتناعٍ من
//    المستهلك، **سابعةُ الحدّ المعماريّ**.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const UI = fs.readFileSync("settings-ui.js", "utf8");
const OPTIONS = fs.readFileSync("options.js", "utf8");

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

console.log("\n=== #108 — لوحة فلاتر الصورة ===\n");

// ── [1] السجلُّ واحد، ومنه يُرسم ويُبنى ويُقرأ ─────────────────────────────
console.log("[1] ⭐ سجلٌّ واحد: منه الصفوف، ومنه السلسلة، ومنه الافتراضات");
{
  const reg = slice("const VZ_FILTER_ITEMS = [", "\n];");
  check("[1] السجلّ موجود", !!reg);
  const keys = [...(reg || "").matchAll(/\{ key: "([a-z]+)"/g)].map((m) => m[1]);
  check("[1] وفيه المجموعتان بمفاتيحهما", keys.length >= 9, keys);
  for (const k of ["brightness", "contrast", "saturate", "gamma", "hue", "grayscale", "sepia", "invert", "blur"])
    check(`[1] وفيه «${k}»`, keys.includes(k));
  // ⛔ الثلاثةُ خارج النطاق بقرار المالك — **حضورُها انحدارٌ لا إضافة**
  check("[1] ⛔ ولا سرعةَ في اللوحة (موضعان لقيمةٍ واحدة)", !keys.includes("speed"));
  check("[1] ⛔ ولا `opacity`", !keys.includes("opacity"));
  check("[1] ⛔ ولا Experimental Shaders (لا `canvas` ولا WebGL في مسار الفلاتر)",
    !/getContext\(["'](webgl|2d)/.test(SRC), "مسارٌ يرسم الفيديو من جديد");
  // والرسمُ من السجلّ نفسه ⇒ المسافة صفر (16د)
  const build = body("function buildFilterPanel()");
  check("[1] ⭐ واللوحة تُرسم من السجلّ لا بيد",
    !!build && /for \(const it of VZ_FILTER_ITEMS/.test(build), build && build.slice(0, 200));
  check("[1] ولا `innerHTML` بقيمٍ في بنائها", !!build && !/innerHTML/.test(build));
}

// ── [2] ⭐ الفلترُ على الفيديو وحدَه — والقيدُ مكتوبٌ بجواره ────────────────
console.log("\n[2] ⭐ على `<video>` وحدَه، ولا على سلف");
{
  const fn = body("function applyVideoFilter(video)");
  check("[2] الكتابة على العنصر نفسه", !!fn && /v\.style\.filter = /.test(fn), fn);
  check("[2] ⭐ ولا كتابةَ على سلف",
    !!fn && !/parentElement\.style/.test(fn) && !/closest\([^)]*\)\.style/.test(fn), fn);
  const head = SRC.slice(Math.max(0, SRC.indexOf("function applyVideoFilter") - 1400),
    SRC.indexOf("function applyVideoFilter"));
  check("[2] ⭐ والقيد مكتوبٌ بجواره: يبتلع `position:fixed` من نسله",
    /position:fixed/.test(head) && /سياقَ احتواء/.test(head), head.slice(-160));
  check("[2] وسببُ بقائه للقارئ بعد سنة", /تبسيطاً/.test(head), head.slice(-160));
  // ولا مسارَ ثانٍ يكتب `style.filter` على غير الفيديو
  const writes = (SRC.match(/\.style\.filter\s*=/g) || []).length;
  check("[2] ومواضع الكتابة محصورة (تطبيقٌ · تصفيرٌ · تهديم)", writes === 4, `العدد ${writes}`);
}

// ── [3] ⭐ الجاما: SVG لا CSS، ولا تدخل السلسلة بلا طلب ────────────────────
console.log("\n[3] ⭐ الجاما فلترُ SVG، وثمنُها لا يُدفع بلا طلب");
{
  const chain = body("function vzFilterChain()");
  check("[3] ⭐ ما لم يغادر افتراضَه لا يدخل السلسلة",
    !!chain && /val === it\.def\) continue;/.test(chain), chain);
  check("[3] والجاما تُفرَز إلى مسارها",
    !!chain && /if \(it\.svg\)/.test(chain), chain);
  const svg = body("function ensureGammaFilter(video, exponent)");
  check("[3] وتُنفَّذ بـ`feComponentTransfer` و`type=gamma`",
    !!svg && /feComponentTransfer/.test(svg) && /"type", "gamma"/.test(svg), svg && svg.slice(0, 200));
  check("[3] ⭐ والورقة في شجرة الفيديو نفسِه (فـ`url(#id)` لا يعبر حدّ الظلّ)",
    !!svg && /getRootNode/.test(svg), svg && svg.slice(0, 200));
  const apply = body("function applyVideoFilter(video)");
  check("[3] ⭐ ولا `url(#…)` في السلسلة إلا حين تُطلب الجاما",
    !!apply && /if \(gamma !== null\)/.test(apply), apply);
  // ⛔ **انقلب هذا التأكيد بقاعدة #77 لا ليمرّ** (2026-08-06، قرار المالك):
  // كان يشترط أن **يحمل الوسمُ شرحَه** («الجاما — تُوضّح الظلال…»)، **والقاعدة
  // المُقرّة عكسُه: الوسمُ يقول ما يفعله الضابط، والشرحُ خلفه.**
  // ⭐ **وللمخالفة ثمنٌ ظاهر: وسمٌ طويل يكسر صفَّ السطر الواحد بالبناء.**
  // ⇒ **والشرحُ في تلميح الميزة بصفحة الإعدادات، حيث يوجد وصفُها أصلاً** —
  // **ولا قناةَ تلميحٍ ثانية تُبنى في اللوحة** (⇊ [7] بسببها المقيس).
  const regSrc = slice("const VZ_FILTER_ITEMS = [", "\n];") || "";
  const labels = [...regSrc.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
  check("[3] الوسوم تُقرأ", labels.length >= 9, labels.length);
  const carriers = labels.filter((l) => /[—:(]/.test(l) || l.length > 16);
  check("[3] ⭐ ولا وسمَ يحمل شرحَه (#77)", carriers.length === 0, carriers);
  check("[3] والشرحُ في تلميح الإعدادات", /والجاما ليست الإضاءة/.test(UI));
}

// ── [4] المفتاح والبوّابة والتخزين ─────────────────────────────────────────
console.log("\n[4] مفتاحٌ واحد يُخزَّن: أيظهر الزرّ — ولا قيمةَ فلترٍ تُخزَّن");
{
  const gate = body("function filterButtonActive()");
  check("[4] البوّابة تنادي `extensionActive()`", !!gate && /extensionActive\(\)/.test(gate), gate);
  // ⛔⭐ **كان يطابق `filterButton === true` نصّاً في البوّابة** — **والشكل تغيّر
  // بـ#118** (صارت تقرأ القائمة). ⇒ **والمقصود لم يتغيّر: مطفأٌ افتراضاً.**
  // **فيُقاس سلوكاً بدل مطابقةٍ على شكل** — **والتغطية أقوى**: مطابقةُ الشكل
  // تمرّ على `=== true` **ولو كان الافتراضُ مشغَّلاً في مسارٍ آخر**.
  check("[4] والبوّابة تقرأ القائمة الواحدة لا مفتاحاً مفرداً",
    !!gate && /barButtonOn\(overlaySettings, "filter"\)/.test(gate), gate);
  {
    const vm2 = require("vm");
    const paired = (() => { const t = fs.readFileSync("content.js", "utf8");
      const a = t.indexOf("// ---- BEGIN barButtons ----"), b = t.indexOf("// ---- END barButtons ----");
      return a === -1 || b === -1 ? null : t.slice(a, b); })();
    const c2 = { console };
    vm2.createContext(c2);
    if (paired) vm2.runInContext(paired, c2);
    const off = (ov) => vm2.runInContext(`barButtonOn(${JSON.stringify(ov)}, "filter")`, c2);
    check("[4] ⭐ ومطفأٌ افتراضاً سلوكاً: تخزينٌ فارغ ⇒ لا زرّ", paired && off({}) === false);
    check("[4] وقائمةٌ فيها الزرّ مطفأً ⇒ لا زرّ",
      paired && off({ barButtons: [{ id: "filter", on: false }] }) === false);
    check("[4] وقائمةٌ فيها مشغَّلاً ⇒ زرّ",
      paired && off({ barButtons: [{ id: "filter", on: true }] }) === true);
    check("[4] ⭐ والقديمُ يُقرأ ولا يُكتب: `filterButton:true` بلا قائمة ⇒ زرّ",
      paired && off({ filterButton: true }) === true);
    check("[4] ⭐ وقائمةٌ موجودةٌ تُلغي القديم — فلا يعود مفتاحٌ مهاجَر",
      paired && off({ filterButton: true, barButtons: [{ id: "speed", on: true }] }) === false);
  }
  const loader = body("async function loadOverlaySettings(pre)");
  check("[4] والمُحمِّل يقرؤه بـ`!!` (ميزةٌ جديدة لا تُشغَّل بلا طلب)",
    !!loader && /filterButton: !!o\.filterButton/.test(loader), loader);
  // ⛔⭐ **المسارُ تبدّل بـ#118 والنيّةُ باقية** (قرار 33: تُصحَّح المرساة لا
  // يُضعَّف التأكيد): **المفتاحُ صار `on` في قائمةٍ مرتَّبة**، فلا ضابطَ مفردٌ في
  // سجلّ الإعدادات ولا حقلَ له في `TIMING_CONTROLS`. ⇒ **والمطلوبُ نفسُه يُقاس
  // على المسار الجديد: مُعلَنٌ في سجلّ الأزرار · ويُكتب · ويُملأ.**
  check("[4] وضابطُه مُعلَنٌ في سجلّ أزرار الشريط", /\{ id: "filter",/.test(UI));
  check("[4] وله مسارٌ يكتبه", /async function persistBarButtons\(\)[\s\S]{0,400}?barButtons: barList\.map/.test(OPTIONS));
  check("[4] وقارئٌ يملؤه", /function renderBarButtons\(overlay\)[\s\S]{0,200}?barButtonsOf\(overlay\)/.test(OPTIONS));
  // ⭐ **ولا قيمةَ فلترٍ في التخزين** — الفلتر يزول مع كلّ فيديو
  check("[4] ⭐ ولا قيمةَ فلترٍ تُكتب في التخزين",
    !/vzFilterValues[\s\S]{0,80}safeSyncSet/.test(SRC) && !/filterValues/.test(OPTIONS));
  const reset = body("function resetVideoFilter(video)");
  check("[4] والتصفير يُعيد الافتراضات ويرفع الفلتر", !!reset && /vzFilterDefaults\(\)/.test(reset), reset);
}

// ── [5] ⭐ الامتناع — إعلانٌ من المستهلك لا منطقٌ في المحرّك ───────────────
console.log("\n[5] ⭐ لوحةٌ مفتوحة ⇒ لا يُخفى شريطُ المضيف تحتها");
{
  const prog = slice("IDLE_CONSUMERS.progressBar = {", "\n};");
  check("[5] ⭐ #70 يُعلن الامتناع على اللوحة", !!prog && /vzFilterPanelOpen\(\)/.test(prog), prog);
  const own = slice("IDLE_CONSUMERS.filterBtn = {", "\n};");
  check("[5] ولزرّها مستهلكُه", !!own);
  check("[5] ⭐ ويمتنع ما دامت لوحتُه مفتوحة", !!own && /suspended: vzFilterPanelOpen/.test(own), own);
  check("[5] ويُعلن معنى إطفائه (`onDisabled`)", !!own && /onDisabled:/.test(own), own);
  // والمحرّك لا يعرف اللوحة
  const apply = body("function applyIdleState()");
  check("[5] ⭐ والمحرّك لا يذكر اللوحة إطلاقاً",
    !!apply && !/vzFilter/.test(apply), apply);
}

// ── [6] ⭐ السلوك — على الكود نفسه، لا على وصفه ────────────────────────────
console.log("\n[6] ⭐ السلوك: منزلقٌ يُغيّر السلسلة، ومفتاحٌ يُوقف ولا يُضيّع");
{
  const REG = slice("const pct = (v) =>", "const VZ_GAMMA_ID");   // `pct` جزءٌ من السجلّ
  // ⚠️ **المرساة تنتهي عند `resetVideoFilter` لا عند `setFilterPanelOpen`**:
  // الثانية بعد `IDLE_CONSUMERS.speedButton`، **فالشريحةُ كانت تبتلع سجلَّ
  // المستهلكين فترمي** — وهو خطأُ مرساةٍ أمسكه التشغيل الأوّل.
  const FNS = slice("function vzFilterDefaults()", "// ⚠️ **والتسجيلُ أسفل");   // يشمل resetVideoFilter و filterVideoLoadStart
  if (!REG || !FNS) { console.log("  ❌ تعذّر الاقتطاع — أصلِح المرساة لا التأكيد"); fail++; }
  else {
    // **`tagName` جزءٌ من العقد لا زينة**: `filterVideoLoadStart` تفحصه قبل أن
    // تُصفّر — **وبلا هذا الحقل يمرّ الحدثُ صامتاً فيُقرأ «لم يُصفّر» عطباً في
    // المنتج وهو نقصُ سند** (الشاهد الثاني في قرار 26).
    const video = { tagName: "VIDEO", isConnected: true, style: { filter: "" }, getRootNode: () => null };
    const ctx = {
      console, vzOverlayVideo: video, vzFilterPanel: null,
      filterButtonActive: () => true,
      speedBtnVideo: () => video,   // **الفيديو الجاري** — النمط القائم (#108)
      syncFilterPanel: () => {},
      // **سندٌ يكفي `ensureGammaFilter`**: شجرةٌ لها `body` يُلحَق بها، و`getElementById`
      // — **وبلا `body` كانت تُرجع `null` فيُقرأ «الجاما لا تدخل» وهو نقصُ السند لا المنتج**
      // (وقد وقع في أوّل تشغيلة، فأمسكه الشاهدُ الموجب).
      document: {
        getElementById: () => null,
        body: { appendChild() {} },
        createElementNS: () => ({ setAttribute() {}, appendChild() {}, querySelectorAll: () => [], style: {} })
      }
    };
    vm.createContext(ctx);
    vm.runInContext(REG + "\nconst VZ_GAMMA_ID = 'g';\n" +
      // **حالةُ الوحدة تُعلَن كما في المنتج** — و`vzFilteredVideo` جزءٌ منها (#108)
      "let vzFilterValues = null; let vzFilterOn = true; let vzFilteredVideo = null;\n" + FNS, ctx);
    vm.runInContext("vzFilterValues = vzFilterDefaults()", ctx);

    check("[6] بلا تغييرٍ: سلسلةٌ فارغة (فلا ثمنَ بلا طلب)",
      vm.runInContext("applyVideoFilter()", ctx) === "", video.style.filter);
    vm.runInContext("vzFilterValues.brightness = 1.2; ", ctx);
    check("[6] ⭐ ومنزلقٌ واحد يُدخل بنداً واحداً",
      vm.runInContext("applyVideoFilter()", ctx) === "brightness(1.2)", video.style.filter);
    vm.runInContext("vzFilterValues.gamma = 1.4;", ctx);
    const withGamma = vm.runInContext("applyVideoFilter()", ctx);
    check("[6] ⭐ والجاما تُضيف `url(#…)` **وتتقدّم**", /^url\(#/.test(withGamma) && /brightness/.test(withGamma), withGamma);
    vm.runInContext("vzFilterValues.gamma = 1;", ctx);
    check("[6] ⭐ وإرجاعُها يُخرج فلتر SVG من السلسلة",
      !/url\(#/.test(vm.runInContext("applyVideoFilter()", ctx)), video.style.filter);
    vm.runInContext("vzFilterOn = false;", ctx);
    check("[6] ⭐ والمفتاح يُوقف الفلتر كلَّه",
      vm.runInContext("applyVideoFilter()", ctx) === "" && video.style.filter === "", video.style.filter);
    check("[6] ⭐ ولا يُضيّع القيم", vm.runInContext("vzFilterValues.brightness", ctx) === 1.2);
    vm.runInContext("vzFilterOn = true;", ctx);
    check("[6] وإعادتُه تُرجع ما كان", vm.runInContext("applyVideoFilter()", ctx) === "brightness(1.2)", video.style.filter);
    // ⭐ الشاهد السالب (قرار 47): بوّابةٌ مغلقة ⇒ لا فلتر مهما كانت القيم
    ctx.filterButtonActive = () => false;
    check("[6] ⭐ وبوّابةٌ مغلقة ⇒ لا فلتر مهما كانت القيم",
      vm.runInContext("applyVideoFilter()", ctx) === "" && video.style.filter === "");

    // ── [8] ⭐⭐ **الحالةُ تتبع الفيديو لا العنصر** (#108، عطبُ «١٠») ──────────
    // ⛔ **الوعدُ «يزول مع كل فيديو» كان مُعلَّقاً على تبدّل العنصر** — **ويوتيوب
    // يُبقي العنصر ويُبدّل المصدر** ⇒ **الفلترُ يبقى عبر الانتقال الداخليّ.**
    // ⚠️ **و«فارغ» لا تُقرأ تصفيراً** (شرط المالك): **الحالةُ تُصفَّر والمنزلقاتُ
    // تعود إلى افتراضها** — لا أن يخلو عنصرٌ جديد من فلترٍ لم يُوضع عليه.
    ctx.filterButtonActive = () => true;
    vm.runInContext("vzFilterValues.brightness = 1.3; applyVideoFilter();", ctx);
    check("[8] مهّدنا: فلترٌ قائمٌ وقيمةٌ محفوظة",
      video.style.filter === "brightness(1.3)" && vm.runInContext("vzFilterValues.brightness", ctx) === 1.3);
    // **(أ) المصدرُ يتبدّل والعنصرُ باقٍ** — حدثُ المنصّة لا اسمُ مضيف
    vm.runInContext("filterVideoLoadStart({ target: vzFilteredVideo })", ctx);
    check("[8] ⭐ تبدّلُ المصدر ⇒ الفلترُ يزول **والقيمُ تعود لافتراضها**",
      video.style.filter === "" && vm.runInContext("vzFilterValues.brightness", ctx) === 1);
    // **(ب) وحدثٌ لعنصرٍ آخر لا يمسّنا** — فـ`loadstart` يقع كثيراً (إعلانات · معاينات)
    vm.runInContext("vzFilterValues.brightness = 1.2; applyVideoFilter();", ctx);
    vm.runInContext("filterVideoLoadStart({ target: { tagName: 'VIDEO' } })", ctx);
    check("[8] ⭐ وحدثٌ لفيديو آخر لا يُصفّرنا (وهو يقع كثيراً)",
      video.style.filter === "brightness(1.2)");
    // **(ج) وتبدّلُ الهُويّة تصفيرٌ كذلك** — والعنصرُ الميّت لا تُكتب عليه
    const other = { tagName: "VIDEO", isConnected: true, style: { filter: "" }, getRootNode: () => null };
    ctx.speedBtnVideo = () => other;
    const applied = vm.runInContext("applyVideoFilter()", ctx);
    check("[8] ⭐ وفيديو آخر ⇒ تصفيرٌ ثمّ تطبيقٌ على الجاري لا على الميّت",
      applied === "" && other.style.filter === "" && video.style.filter === "" &&
      vm.runInContext("vzFilterValues.brightness", ctx) === 1, { applied, other: other.style.filter });
  }
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
