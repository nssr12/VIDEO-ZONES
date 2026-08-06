// البند #78 — الحفظ يكتب حقلاً واحداً من ضابطٍ رُسم، لا كلَّ الحقول من الـDOM
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يُحفظ الضابطُ الذي لمستُه وحده بلا أن يُكتب فوق غيره؟»*
//
// **العطب المقيس (تخزين المالك 2026-08-02): `speedButtonPreset = 0.25`** والافتراض
// المكتوب في ثلاثة مواضع **2**. والآليّة: `persistOverlayTiming` كانت تكتب **9
// حقول من 8 ضوابط** عند أيّ تغيير، **فحقلٌ لم يُرسَم بعدُ يُحفَظ بما تركه
// المتصفّح فيه** — ومُنزلق مدىً بلا `value` يبدأ من طرفه.
//
// ⚠️ **والقاعدة التي وُلد منها (قرار 16د): الخطر يتناسب مع المسافة بين مَن يرسم
// الضابط ومَن يكتب الحقل.** ولذلك نجا `persistCleanPlayer` (يولّد ضوابطه من
// السجلّ الذي يكتبه ⇒ مسافةٌ صفر) وسقط جارُه (HTML بيد ⇄ JS بيد ⇒ أقصى مسافة).
//
// ⚠️ **وهذا الملف مكتوبٌ ليرثه مُولِّد #77 لا ليستبدله:** الحارس على **الختم**
// (`data-vz-rendered`) لا على أسماء الضوابط. **فمُولِّدٌ يرسم بلا ختم يُرفض
// حفظُه**، ومُولِّدٌ يختم يمرّ — **بلا سطرٍ جديد هنا**. ومن غيّر آليّة الرسم في
// #77 **يجد الأحمر هنا قبل أن يجده المستخدم في تخزينه**.
//
// ⛔ **ولا هجرة (قرار المالك):** `0.25` المشوَّهة **لا تُميَّز** عن `0.25` اختارها
// مستخدم عمداً. **القيم القائمة تبقى، والمالك يُعيد ضبط قيمته بيده** —
// **وتسجيلُ ما لا يُمكن إصلاحه أصدق من هجرةٍ تخمّن.**
const fs = require("fs");
const vm = require("vm");

const OPTIONS = fs.readFileSync("options.js", "utf8");
const POPUP = fs.readFileSync("popup.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

function slice(src, from, to) {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  return a === -1 || b === -1 ? null : src.slice(a, b);
}
function body(src, name) {
  const i = src.indexOf(name);
  if (i === -1) return null;
  const j = src.indexOf("\n}", i);
  return j === -1 ? null : src.slice(i, j);
}

console.log("\n=== #78 — الحفظ من الحالة لا من الـDOM ===\n");

// ── [1] لا معالجَ يكتب أكثر من حقلٍ من ضوابط متعدّدة ──────────────────────
console.log("[1] ضابطٌ واحد ⇒ حقلٌ واحد");
{
  // مرساة: الدالّة **صارت عُلوية** (#82) فتُقتطع عند إغلاقها في العمود الأول.
  // ⚠️ **أُصلحت المرساة لا التأكيد** (قرار 33): الكود انتقل، والتغطية باقية.
  const persist = slice(OPTIONS, "async function persistTiming(id)", "\n}");
  check("[1] `persistTiming` موجود ويأخذ مُعرّف الضابط", !!persist);
  // ⚠️ العَرَض بعينه: الدالّة القديمة كانت تقرأ ثمانية `$(...)` في جسمها
  const reads = persist ? (persist.match(/\$\("[A-Za-z]+"\)/g) || []).length : -1;
  check("[1] ولا يقرأ إلا ضابطه (`$(id)` وحده)", reads === 0, `قراءات معرَّفة صراحةً: ${reads}`);
  check("[1] ولا وجود لـ`persistOverlayTiming` القديمة",
    !/async function persistOverlayTiming/.test(OPTIONS));

  // كل ضابطٍ مربوطٌ باسمه هو — لا معالجٌ مشترك.
  // ⚠️ **ولا انهيار عند سقوط المرساة**: مِجَسٌّ ينهار يطبع خرْجاً لا يُفهَم بدل
  // أن يقول ما الناقص — وهو ما بُني `run-tests` على كشفه، لا على احتماله.
  const regSrc = slice(OPTIONS, "const TIMING_CONTROLS = {", "\n};");
  const ids = regSrc
    ? Object.keys(vm.runInNewContext(regSrc + "\n};\nTIMING_CONTROLS", {}, { timeout: 1000 }) || {})
    : [];
  check("[1] سجلّ `TIMING_CONTROLS` موجود", !!regSrc, "المرساة سقطت أو السجلّ غير مكتوب");
  // ⚠️ **العددُ يُشتقّ من سجلّ المُولِّد لا يُكتب هنا** (قرار 34، ودرسُ #108:
  // رقمٌ بيدٍ سقط مرّتين في يومين — بانتقال ضابطٍ ثمّ بإضافة ضابط).
  // **والتطابق بين السجلّين محروسٌ في التأكيد التالي، وهذا يمنع الفراغ وحده.**
  // ⛔ **كان يعدّ `{ id: "…", kind:` في نصّ الملفّ كلِّه** — **فلمّا دخلت سجلّاتٌ
  // أخرى بالشكل نفسِه (#79 · #113) عدَّ 21 والمطلوب 8.** ⇒ ⭐ **مطابقةٌ نصّية
  // تقيس جارَ المطلوب** (قرار 81): السؤالُ «كم ضابطَ توقيت؟» لا «كم إعلانَ ضابط؟».
  // ⇒ **فيُقرأ السجلُّ المقصود بعينه من المُولِّد.**
  const uiCount = (require("../settings-ui.js").VZ_UI_TIMING || []).length;
  check(`[1] وفيه ضوابطُ التوقيت (${uiCount})`, ids.length === uiCount && ids.length > 0, { ids: ids.length, uiCount });
  // ⚠️ **مرساةٌ صُحّحت لا تأكيدٌ أُضعف (قرار 33، #77):** الربط انتقل إلى
  // **المُولِّد الواحد** — فلا سطرَ ربطٍ مكتوبٌ بيدٍ لكل ضابط. **والنيّة نفسها
  // محروسةٌ أقوى**: المُولِّد يربط **كلَّ ما في السجلّ** بلا استثناء، فضابطٌ
  // جديد يُربط **بالبناء لا بالتذكّر**.
  const UI = fs.readFileSync("settings-ui.js", "utf8");
  check("[1] المُولِّد يربط كلَّ ضابطٍ بمُعرّفه",
    /if \(onChange\) input\.addEventListener\("change", \(\) => onChange\(c\.id\)\)/.test(UI));
  check("[1] و`options.js` تمرّر `persistTiming` لا معالجاً مشتركاً",
    /vzUiBuildTiming\(document, \$\("timingList"\), \(id, liveOnly\) =>/.test(OPTIONS) &&
    /persistTiming\(id\);/.test(OPTIONS));
  check("[1] ولا سطرَ ربطٍ مكتوبٌ بيدٍ لضابط توقيت",
    !/\$\("(gridDuration|volumeDuration|idleDuration|zoneHintEnabled|speedBadgeEnabled|hideProgressBar|speedButtonEnabled|speedButtonPreset)"\)\.addEventListener/.test(OPTIONS));
  // ⭐ وبالعدّ لا بالنظر: لكل حقلٍ ضابطٌ، ولكل ضابطٍ حقل
  const uiIds = (require("../settings-ui.js").VZ_UI_TIMING || []).map((c) => c.id);
  check("[1] ⭐ ولكل حقلٍ ضابطٌ ولكل ضابطٍ حقل",
    ids.every((i) => uiIds.includes(i)) && uiIds.every((i) => ids.includes(i)), { ids, uiIds });
}

// ── [2] ⭐ الحارس: ضابطٌ لم يُرسَم لا يُكتب منه ────────────────────────────
console.log("\n[2] ⭐ الختم شرطُ الكتابة — ويرثه مُولِّد #77");
{
  // مرساة: الدالّة **صارت عُلوية** (#82) فتُقتطع عند إغلاقها في العمود الأول.
  // ⚠️ **أُصلحت المرساة لا التأكيد** (قرار 33): الكود انتقل، والتغطية باقية.
  const persist = slice(OPTIONS, "async function persistTiming(id)", "\n}");
  check("[2] الكتابة تشترط الختم", !!persist && /dataset\[VZ_RENDERED\] !== "1"/.test(persist), persist);
  check("[2] والرفض قبل أي قراءة تخزين",
    !!persist && persist.indexOf("VZ_RENDERED") < persist.indexOf("await getSettings()"), persist);
  // ⚠️ ولا صمت: رفضٌ صامت يترك المستخدم يظنّ أنه حفظ (درسا #57 و#69)
  check("[2] ولا يُرفض صامتاً", !!persist && /showToast\("bad"/.test(persist), persist);
  // والختم يضعه الراسم وحده
  const render = body(OPTIONS, "function renderOverlayTiming(settings)");
  // **الملء هو الختم** — والمسافة صفر: الراسم يقرأ السجلّ الذي بنى الضوابط
  check("[2] والراسم يختم ما ملأه",
    !!render && /el\.dataset\[VZ_RENDERED\] = "1"/.test(render), render);
  check("[2] و`markRendered` تكتب الختم", /el\.dataset\[VZ_RENDERED\] = "1"/.test(OPTIONS));
  // ⚠️ الحارس على الختم لا على الأسماء — فمُولِّد #77 يرثه بلا تعديل
  const mark = body(OPTIONS, "function markRendered(id)");
  check("[2] ⭐ والختم عامّ لا مقصورٌ على ضوابط اليوم (يرثه مُولِّد #77)",
    !!mark && !/gridDuration|speedButton|hideProgress/.test(mark), mark);
}

// ── [3] ⭐ سلوكياً: الحقل الذي لم يُلمس لا يُكتب ───────────────────────────
console.log("\n[3] ⭐ لمسُ ضابطٍ لا يكتب حقلَ جاره");
{
  const REG = slice(OPTIONS, "const TIMING_CONTROLS = {", "\n};");
  if (!REG) {
    console.log("  ❌ تعذّر اقتطاع السجلّ — **المرساة سقطت، أصلِح المرساة لا التأكيد**");
    fail++;
  } else {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(REG + "\n};", ctx);
    const reg = vm.runInContext("TIMING_CONTROLS", ctx);

    // مخزَّنٌ فيه قيمةٌ اختارها المستخدم عمداً
    const stored = () => ({ overlay: { autoHideMs: 900, volumeAutoHideMs: 900, speedButtonPreset: 3 }, idle: { ms: 2500 } });

    // يلمس مربّعاً واحداً — والقيم الأخرى **يجب ألّا تُمَسّ**
    const s = stored();
    // ⚠️ **بُدِّل الضابطُ لا التأكيد (#107):** انتقل `hideProgressBar` إلى الـpopup
    // **بوضعٍ ثلاثيّ**، فلم يعد من ضوابط هذي الصفحة. **والمقيس هو الآليّة —
    // «لمسُ ضابطٍ لا يكتب حقلَ جاره» — لا اسمُ الضابط**، فأيُّ مربّعٍ يقوم مقامه.
    reg.zoneHintEnabled(s, { checked: false });
    check("[3] لمسُ مربّع يكتب حقله", s.overlay.hintEnabled === false);
    check("[3] ⭐ ولا يمسّ `speedButtonPreset` الذي اختاره المستخدم",
      s.overlay.speedButtonPreset === 3, s.overlay.speedButtonPreset);
    check("[3] ولا يمسّ `idle.ms`", s.idle.ms === 2500, s.idle.ms);

    // والمدى يكتب رقمه هو
    const s2 = stored();
    reg.speedButtonPreset(s2, { value: "1.5" });
    check("[3] والمُنزلق يكتب رقمه", s2.overlay.speedButtonPreset === 1.5, s2.overlay.speedButtonPreset);
    check("[3] ولا يمسّ مدّة الشبكة", s2.overlay.autoHideMs === 900);

    // و`idle` تُفرد لا تُستبدل — فحقلٌ مستقبليّ فيها لا يُمحى
    const s3 = { overlay: {}, idle: { ms: 2500, future: "x" } };
    reg.idleDuration(s3, { value: "3000" });
    check("[3] و`idle` تُفرد لا تُستبدل (نمط `popup.js`)",
      s3.idle.ms === 3000 && s3.idle.future === "x", s3.idle);
  }
}

// ── [4] Clean Player: مفتاحٌ واحد لا أربعون ────────────────────────────────
console.log("\n[4] Clean Player — كلُّ تغييرٍ يكتب مفتاحه وحده");
{
  const item = body(OPTIONS, "async function persistCleanPlayerItem(key)");
  check("[4] `persistCleanPlayerItem` موجود", !!item);
  check("[4] ولا يقرأ السجلّ كلّه", !!item && !/CLEAN_PLAYER_OPTIONS/.test(item), item);
  check("[4] ويفرد المخزَّن", !!item && /\.\.\.\(s\.cleanPlayer\?\.items \|\| \{\}\)/.test(item), item);
  check("[4] والمؤشَّر وحده يُخزَّن — وغيرُه يُحذف لا يُكتب `false` (#66 وحصّة 8KB)",
    !!item && /delete items\[key\]/.test(item), item);
  check("[4] والمربّع مربوطٌ بمفتاحه", /persistCleanPlayerItem\(key\)/.test(OPTIONS));
  const master = body(OPTIONS, "async function persistCleanPlayer()");
  check("[4] والمفتاح الرئيسي يكتب `enabled` وحده",
    !!master && /\.\.\.\(s\.cleanPlayer \|\| \{\}\), enabled:/.test(master), master);
  check("[4] ولا يُعيد بناء `items` من الـDOM",
    !!master && !/cp_\$\{key\}/.test(master), master);
}

// ── [5] النمط المرجع باقٍ في `popup.js` — لا صياغةٌ ثالثة ─────────────────
console.log("\n[5] النمط المرجع — عُمِّم ولم يُبتكَر");
{
  // `popup.js` كان صفراً في العدّ، وهو المرجع: يفرد ويستبدل حقلاً ويحتمل الغياب
  check("[5] `popup.js` ما زال يفرد المخزَّن", /\.\.\.\(settings\.subtitles \|\| \{\}\)/.test(POPUP));
  check("[5] ويحتمل غياب العنصر", /\$\("subtitlesEnabled"\)\?\.checked/.test(POPUP));
  check("[5] وببديلٍ صريح عند الغياب", /dur \? Number\(dur\.value\) : 900/.test(POPUP));
  // ولا معالجَ في options.js يعود إلى كتابة عدّة حقول من عدّة ضوابط
  const multi = (OPTIONS.match(/s\.overlay\.\w+ = \$\("/g) || []).length;
  check("[5] وصفر كتابةٍ مباشرة `s.overlay.x = $(...)` خارج السجلّ", multi === 0, `العدد ${multi}`);
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
