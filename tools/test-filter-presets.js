// #109 — حفظُ الفلاتر بأسماء: **الاستبدالُ لا الدمج** · المتفرّق · وحدُّ السقف
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن حفظتُ فلتراً ثمّ طبّقتُه، أأرى
// ما حفظتُه بعينه — أم يبقى تحته أثرُ فلترٍ حرّكتُه قبله فأرى صورةً لا أعرف من
// أين جاءت؟»*
//
// ⛔⭐⭐ **أثمنُ ما فيه القسم [1]:** العقدُ الذي أمر المالكُ بتثبيته **بشاهدٍ لا
// بوسم** — **ما ليس في المدخل يعود إلى افتراضه.** والدمجُ الصامت يُبقي بقايا
// الفلتر السابق تحت الجديد ⇒ **فيرى المستخدم نتيجةً لم يحفظها ولا يعرف من أين
// جاءت**، **وهو أخطرُ ما في الشكل المتفرّق** (وسقوطٌ صامتٌ يُبقي السابقَ أخطرُ
// من سقوطٍ يُظهر فراغاً — قرار 144).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
const STORAGE = fs.readFileSync(path.join(ROOT, "storage.js"), "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`, extra === undefined ? "" : JSON.stringify(extra)); }
};
const slice = (from, to) => {
  const a = SRC.indexOf(from);
  if (a === -1) return "";
  const b = SRC.indexOf(to, a + from.length);
  return b === -1 ? "" : SRC.slice(a, b + to.length);
};
const body = (sig) => {
  const a = SRC.indexOf(sig);
  if (a === -1) return "";
  let d = 0, started = false;
  for (let i = a; i < SRC.length; i++) {
    if (SRC[i] === "{") { d++; started = true; }
    else if (SRC[i] === "}") { d--; if (started && d === 0) return SRC.slice(a, i + 1); }
  }
  return "";
};

// ── [1] ⭐⭐ العقد: الاستبدالُ لا الدمج — **سلوكياً على الدالّة نفسِها** ────────
console.log("\n[1] ⭐⭐ التطبيقُ استبدالٌ لا دمج — وما ليس في المدخل يعود إلى افتراضه");
{
  const ctx = vm.createContext({ Number, Math, Object, console });
  const items = slice("const pct = ", "];");   // ⭐ ومعها `pct` من المصدر، لا نسخةٌ تُكتب هنا
  const defs = body("function vzFilterDefaults()");
  const from = body("function vzFilterValuesFromPreset(preset)");
  check("[1] الثلاثةُ حاضرة في المصدر", !!items && !!defs && !!from);
  vm.runInContext(`${items}\n${defs}\n${from}`, ctx);
  // ⛔⭐⭐ **حالةٌ سابقة تُزرع في السند عمداً** — **وبلا زرعها لا يستطيع الشاهدُ أن
  // يُعبّر عن العطب أصلاً**: نسخةٌ تدمج تُصبح `ReferenceError` فيحمرّ الملفُّ رميةً
  // لا حكماً. ⇒ **والرميةُ حمرةٌ ضعيفة: تقول «سقط» ولا تقول «الرابعُ لم يعد».**
  // ⭐ **فالزرعُ يجعل الحمرة أثراً مقيساً** (قرار 109: أرمى؟ · أموجود؟ · **أوقع الأثر؟**).
  vm.runInContext("var vzFilterValues = { blur: 8, saturate: 2.5, hue: 200 };", ctx);

  const D = vm.runInContext("vzFilterDefaults()", ctx);
  check("[1] والافتراضاتُ تسعة", Object.keys(D).length === 9, Object.keys(D));

  // **الحالُ التي أمر المالكُ بتجربتها بعينها:** محفوظٌ فيه ثلاثة، ورابعٌ حُرِّك بيده
  ctx.محفوظ = { n: "ليل", v: { brightness: 1.4, contrast: 1.2, gamma: 1.3 } };
  const out = vm.runInContext("vzFilterValuesFromPreset(محفوظ)", ctx);
  check("[1] المحفوظُ يصل بقيمه", out.brightness === 1.4 && out.contrast === 1.2 && out.gamma === 1.3, out);
  check("[1] ⭐⭐ والرابعُ (`blur`) عاد إلى افتراضه ولم يبقَ", out.blur === D.blur, { blur: out.blur, افتراض: D.blur });
  check("[1] ⭐⭐ وكذلك `saturate` و`hue` و`invert`",
    out.saturate === D.saturate && out.hue === D.hue && out.invert === D.invert, out);

  // ⛔ **والشاهد الحاسم: الدالّةُ لا تقرأ الحالةَ الجارية أصلاً** — فقراءتُها هي
  // الدمجُ بعينه. **ونصٌّ لا سلوك، لأن السلوك وحده يمرّ على تنفيذٍ يقرأ ثمّ يكتب.**
  // ⛔⭐ **وحدُّ المطابقة يُضيَّق لأنها اتّسعت فعلاً** (قرار 93، ووقع هنا في أوّل
  // تشغيلة): `/vzFilterValues/` **تطابق اسمَ الدالّة نفسِها** `vzFilterValuesFromPreset`
  // ⇒ **حارسٌ يُحمّر على نفسه.** فالمطلوب الاسمُ **مفرداً** لا جزءاً من اسمٍ أطول.
  check("[1] ⭐ ولا تذكر `vzFilterValues` مفردةً بحال",
    !/\bvzFilterValues(?![A-Za-z0-9_$])/.test(from), from.slice(0, 160));

  // **مدخلٌ فاسد لا يكسرها، ويعود إلى الافتراض** (لا يُخزَّن NaN ولا يُطبَّق)
  ctx.فاسد = { n: "x", v: { brightness: "abc", blur: 999 } };
  const bad = vm.runInContext("vzFilterValuesFromPreset(فاسد)", ctx);
  check("[1] قيمةٌ غيرُ عددية ⇒ الافتراض", bad.brightness === D.brightness, bad.brightness);
  check("[1] وقيمةٌ خارج المدى تُقصّ إلى الحدّ", bad.blur === 12, bad.blur);
}

// ── [2] المتفرّق: ما غادر افتراضه وحدَه ──────────────────────────────────────
console.log("\n[2] المخزَّن متفرّق — كنمط `cleanPlayer.items`");
{
  const ctx = vm.createContext({ Number, Object, console });
  vm.runInContext(`${slice("const pct = ", "];")}\n${body("function vzFilterDefaults()")}\n${body("function vzFilterSparse(values)")}`, ctx);
  const D = vm.runInContext("vzFilterDefaults()", ctx);
  check("[2] الافتراضاتُ وحدَها ⇒ كائنٌ فارغ", Object.keys(vm.runInContext(`vzFilterSparse(${JSON.stringify(D)})`, ctx)).length === 0);
  const one = { ...D, brightness: 1.4 };
  const sp = vm.runInContext(`vzFilterSparse(${JSON.stringify(one)})`, ctx);
  check("[2] وواحدٌ مغيَّر ⇒ مفتاحٌ واحد", Object.keys(sp).length === 1 && sp.brightness === 1.4, sp);
  // ⭐ **وذهاباً وإياباً**: المتفرّق ثمّ الاستبدال يُعيد الحالَ نفسَها
  const back = vm.runInContext(`(${body("function vzFilterValuesFromPreset(preset)")})({ v: ${JSON.stringify(sp)} })`, ctx);
  check("[2] ⭐ ذهاباً وإياباً: الحالُ نفسُها", JSON.stringify(back) === JSON.stringify(one), { back, one });
}

// ── [3] السقفُ نسخةُ رقمٍ محروسة لا منطقٌ ثانٍ ───────────────────────────────
console.log("\n[3] حدُّ السقف — والرقمُ يطابق `storage.js` ولا يتخلّف");
{
  const a = /const VZ_SYNC_ITEM_LIMIT = (\d+);/.exec(SRC);
  const b = /const SYNC_ITEM_LIMIT = (\d+);/.exec(STORAGE);
  check("[3] الرقمان معرَّفان", !!a && !!b);
  check("[3] ⭐ ومتطابقان (نسخةُ رقمٍ محروسة لا كتلةٌ مُقترنة)", a && b && a[1] === b[1], { content: a?.[1], storage: b?.[1] });
  const per = body("async function persistFilterPresets(list)");
  check("[3] والفحصُ **قبل** الكتابة لا بعدها",
    per.indexOf("VZ_SYNC_ITEM_LIMIT") > 0 && per.indexOf("VZ_SYNC_ITEM_LIMIT") < per.indexOf("storage.sync.set"), per.slice(0, 80));
  check("[3] وترجع سبباً عند الرفض ولا ترجع نجاحاً لم يقع",
    /ok: false/.test(per) && /catch/.test(per));
}

// ── [4] `Escape` سلطتُها واحدة — وفي الحقل تُغادره ولا تُغلق اللوحة ───────────
console.log("\n[4] ⛔ `Escape` في حقل الاسم: يُغادر الحقلَ ولا يُغلق اللوحة");
{
  const esc = body("function filterEscKeydown(e)");
  check("[4] الشرطُ في مُغلِق اللوحة نفسِه", /vzFpPresetName/.test(esc), esc.slice(0, 120));
  check("[4] ⭐ ويسبق `setFilterPanelOpen(false)`",
    esc.indexOf("vzFpPresetName") < esc.indexOf("setFilterPanelOpen(false)"));
  check("[4] ويوقف الانتشار (المستمعُ بالالتقاط على `document`)", /stopPropagation/.test(esc));
  // ⛔ **وشرطٌ لا يستطيع أن يقع ليس حارساً**: مستمعُ اللوحة يبطل بالبناء
  const kd = body("function filterPanelKeydown(e)");
  check("[4] ⭐ ولا شرطَ `Escape` في مستمع اللوحة (يسبقه الالتقاطُ بنيوياً)", !/Escape/.test(kd), kd);
}

// ── [5] الوسومُ تقول الحدود، ولا ضابطَ يُضغط بلا أثر ─────────────────────────
console.log("\n[5] الحدودُ مكتوبةٌ حيث تُقرأ");
{
  const build = body("function buildFilterPanel()");
  check("[5] وسمُ التطبيق يقول «استبدال» و«ما ليس فيه يعود»",
    /يستبدل/.test(build) && /يعود إلى افتراضه/.test(build));
  check("[5] ⭐ ويقول إن المُطبَّق يزول مع الفيديو التالي (حفظٌ للقيم لا تثبيت)",
    /يزول مع الفيديو التالي/.test(build));
  check("[5] ووسمُ المفتاح يقول إنه يعود مُشغَّلاً بتطبيق محفوظ",
    /يعود مُشغَّلاً إن طبّقتَ محفوظاً/.test(build));
  check("[5] وبلا محفوظاتٍ يُعطَّل زرّا التطبيق والحذف (#24)",
    /b\.disabled = !vzFilterPresets\.length/.test(SRC));
  const apply = body("function applyFilterPreset(preset)");
  check("[5] والتطبيقُ يُشغّل المفتاح", /vzFilterOn = true/.test(apply), apply);
}

// ── [6] الاسمُ نصٌّ من المستخدم — ولا `innerHTML` في مساره ────────────────────
console.log("\n[6] الاسمُ يُكتب نصّاً لا HTML (جرد #32)");
{
  const r = body("function renderFilterPresetList()");
  check("[6] بـ`textContent` ولا `innerHTML`", /textContent/.test(r) && !/innerHTML/.test(r));
  check("[6] ⭐ ولا يُمسّ حقلُ الاسم في إعادة الرسم", !/vzFpPresetName/.test(r), r.slice(0, 120));
  check("[6] والمُحمِّل يرفض ما ليس باسمٍ نصّيّ",
    /typeof p\.n === "string"/.test(body("function loadFilterPresetsFrom(settings)")));
}

// ── [7] المُحمِّل في المسارين: البدء وإعادة القراءة ──────────────────────────
console.log("\n[7] يُحمَّل في البدء وفي إعادة القراءة معاً");
{
  check("[7] في `runStartupSteps`", /startup\("filterPresets"/.test(SRC));
  check("[7] وفي `flushReload`", /loadFilterPresets\(data\)/.test(body("async function flushReload()")));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} #109 — النتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail === 0 ? 0 : 1);
