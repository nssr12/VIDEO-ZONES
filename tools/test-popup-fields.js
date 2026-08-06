// حارس المسافة في الـpopup — لكلّ ضابطٍ مرسومٍ كاتبٌ يقرؤه، ولا حقلَ بلا ضابط
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«الضابط الذي أراه في الـpopup — أثمّة
// من يقرؤه أصلاً حين ألمسه، أم رسمٌ بلا أثر؟»*
//
// ── ⛔ لماذا هنا بالذات (قرار 16د، وشرط قبولٍ من المالك 2026-08-05) ───────────
// **الخطر يتناسب مع المسافة بين مَن يرسم الضابط ومَن يكتب الحقل.** وصفحةُ
// الإعدادات **أنزلت المسافة إلى صفر** بمُولِّد #77 (السجلّ نفسه يرسم ويكتب)،
// **وختمُ #78 (`vzRendered`) يحرس ما بقي**. ⛔ **والـpopup ليس فيه واحدٌ منهما:**
// HTML مكتوبٌ بيد ⇄ JS مكتوبٌ بيد ⇒ **أقصى مسافة، وبلا ختم.**
// ⇒ **فوضعُ ضابطٍ جديد فيه (#107) بلا حارسٍ هو إعادةُ #78 إلى الموضع الذي وُلد
// فيه** — **والحارسُ شرطُ قبولٍ لا تحسين** (نصّ المالك).
//
// ⚠️ **وما يحرسه بالضبط: الوصلُ لا الصواب.** يقول «ثمّة كاتبٌ يقرأ هذا الحقل»،
// **ولا يقول إنه يكتب المفتاح الصحيح** — وذاك حدٌّ مُعلَن، لا صمتٌ عنه.
const fs = require("fs");

const HTML = fs.readFileSync("popup.html", "utf8");
const JS = fs.readFileSync("popup.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// **الضوابط تُقرأ بشكلها لا بقائمةٍ نكتبها**: أيّ `input`/`select`/`textarea` له `id`.
function controlIds(html) {
  return [...html.matchAll(/<(input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[2]);
}
// **وما يمسّه الكاتب**: `$("id")` أو `getElementById("id")`.
function touchedIds(js) {
  return new Set([
    ...[...js.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]),
    ...[...js.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1])
  ]);
}

console.log("\n=== حارس المسافة في الـpopup (16د) ===\n");

console.log("[1] لكلّ ضابطٍ مرسومٍ من يقرؤه");
const ids = controlIds(HTML);
const touched = touchedIds(JS);
{
  check("[1] القارئ وجد ضوابط", ids.length > 5, ids.length);
  const orphans = ids.filter((id) => !touched.has(id));
  // ⚠️ **الصفوف المُولَّدة مستثناةٌ بالبناء لا بقائمة**: حقول القواعد تُبنى في
  // `ruleRow()` بلا `id` أصلاً، فلا تدخل هذا القياس.
  check("[1] ⭐ ولا ضابطَ مرسومٍ بلا كاتبٍ يمسّه", orphans.length === 0, orphans);
}

console.log("\n[2] ولا حقلَ يقرؤه الكاتبُ ولا وجودَ له في الصفحة");
{
  // **الاستثناءات بأسبابها لا بأسمائها**: عناصرُ عرضٍ لا ضوابط — يمسّها الكاتب
  // ولا تظهر في `controlIds` لأنها ليست حقولاً.
  const displayOnly = new Set(
    [...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
  );
  const phantom = [...touched].filter((id) => !displayOnly.has(id));
  check("[2] ⭐ ولا حقلَ يُنادى وهو غير موجود", phantom.length === 0, phantom);
}

// ── [3] ⭐ الشاهدان (قرار 26 · 47) — على المنطق نفسِه لا على شبيهٍ يُفتعَل ────
// **ولا يكفي أن يمرّ على شجرتنا اليوم**: حارسٌ يمرّ ولا يستطيع أن يُحمّر يُقرأ
// خضارُه سلامةً وهو عمىً (`test-scope-reach` طبع أخضر على عطبٍ مقيس).
console.log("\n[3] ⭐ الشاهدان: يرى الوصل ويرى انقطاعه");
{
  const goodHtml = '<select id="x"></select><input id="y">';
  const goodJs = 'const a = $("x"); const b = document.getElementById("y");';
  check("[3] شاهد سالب: وصلٌ تامّ يمرّ",
    controlIds(goodHtml).filter((i) => !touchedIds(goodJs).has(i)).length === 0);

  const badHtml = '<select id="x"></select><input id="orphanField">';
  check("[3] ⭐ شاهد موجب: ضابطٌ بلا كاتب يُكشف",
    controlIds(badHtml).filter((i) => !touchedIds(goodJs).has(i)).join() === "orphanField");

  const badJs = 'const c = $("noSuchField");';
  check("[3] ⭐ وشاهدٌ موجب ثانٍ: حقلٌ يُنادى ولا وجودَ له يُكشف",
    [...touchedIds(badJs)].filter((i) => !controlIds(goodHtml).includes(i)).join() === "noSuchField");
}

// ── [4] #107 **مُنقولاً** — الضابط موصولٌ بمساريه، في موضعه الجديد ──────────
// ⚠️ **[1] يقول «ثمّة من يمسّه»، وهذا يقول «يُقرأ ويُكتب»** — ولمسةٌ واحدة في
// مسارٍ واحد تمرّ على [1] **وتترك الضابط لا يُحفظ أو لا يُملأ**، وكلاهما وقع في
// هذا المشروع (#69: يُعلن ولا يُرجِع · #78: يكتب ما لم يُرسم).
// ⛔⭐ **وانتقل من الـpopup إلى قسم YouTube 2026-08-06** (قرار المالك، **عكسُ
// قراره في #107**) ⇒ **فالحارسُ يتبعه ولا يُحذف**: **حارسٌ يُحذف لأن ما يحرسه
// انتقل يترك المسارين بلا حارسٍ ويُقرأ محروساً.**
// ⚠️ **والشرطُ المقلوب باقٍ بعينه: «ولا نسخةَ منه في الموضع الآخر»** — فعلّةُ
// القرار الأوّل (مرآةٌ تتباعد) **لم تسقط، وإنما تبدّل أيُّهما المرآة.**
console.log("\n[4] #107 — وضعُ شريط يوتيوب موصولٌ قراءةً وكتابةً (في صفحة الإعدادات)");
{
  const UI = fs.readFileSync("settings-ui.js", "utf8");
  const OPTIONS = fs.readFileSync("options.js", "utf8");
  check("[4] الضابط مُعلَنٌ قائمةَ اختيارٍ واحدة في السجلّ",
    /id: "progressBarMode", kind: "select"/.test(UI));
  const i = UI.indexOf('id: "progressBarMode"');
  const decl = i === -1 ? "" : UI.slice(i, i + 900);
  const opts = [...decl.matchAll(/value: "(off|idle|near)"/g)].map((m) => m[1]);
  check("[4] وبأوضاعه الثلاثة", JSON.stringify(opts) === JSON.stringify(["off", "idle", "near"]), opts);
  check("[4] ⭐ ولا مفتاحَ ثانياً له (وضعٌ لا مفتاحان)",
    !/id="hideProgressBar"|id: "hideProgressBar"/.test(UI + HTML + OPTIONS));
  check("[4] يُملأ عند الفتح", /renderProgressBarMode\(s\.overlay\);/.test(OPTIONS));
  check("[4] ويُحفظ عند التغيير",
    /\$\("progressBarMode"\)\.addEventListener\("change", persistProgressBarMode\)/.test(OPTIONS));
  check("[4] ⭐ والكتابة عبر مخرج الحفظ الواحد وحدَه",
    /async function persistProgressBarMode[\s\S]*?await saveSettings\(s\)/.test(OPTIONS));
  check("[4] ⭐ والقراءة من الكتلة المتناظرة لا من تطبيعٍ ثانٍ",
    /progressBarModeOf\(overlay\)/.test(OPTIONS));
  check("[4] ⭐ وقيمةٌ خارج الأوضاع لا تُكتب",
    /PROGRESS_BAR_MODES\.includes\(mode\)/.test(OPTIONS));
  // **ولا نسخةَ منه في الـpopup** — الاتّجاه انقلب والشرط لم ينقلب
  // ⚠️ **ويُقاس الضابطُ لا ذكرُ اسمه:** السجلُّ المشطوب (قرار 21) يذكر الاسمَ
  // في تعليقٍ **وهو الغرضُ منه** — **ومطابقةٌ على الاسم وحده تُحمّر على السجلّ
  // الذي أمرنا بإبقائه**، وهي «مطابقةٌ أوسع من سؤالها» (قرار 93).
  check("[4] ⭐ ولا نسخةَ منه في الـpopup — ضابطاً لا ذكراً",
    !/id="progressBarMode"/.test(fs.readFileSync("popup.html", "utf8")) &&
    !/\$\("progressBarMode"\)/.test(JS));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
