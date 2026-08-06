// يحرس أن كلَّ مفتاحٍ يُكتب في التخزين يحمله إسقاطُه في `content.js` — أو يُستثنى بنصّه.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«ضبطتُ شيئاً في الإعدادات فحُفظ،
// ثمّ لا يقع شيءٌ في الصفحة ولا رسالةَ خطأ — أوَصَل ضبطي إلى المشغّل أصلاً؟»*
//
// ── ⛔ لماذا وُجد (2026-08-07، من عطبٍ حيّ عند المالك — #118/#120) ────────────
// `loadOverlaySettings` **إسقاطٌ حقلاً حقلاً**: يبني كائناً بحقولٍ مكتوبةٍ يدويّاً
// من `settings.overlay`. **فمفتاحٌ جديد لا يُضاف إليه يختفي صامتاً** — لا رميةَ
// ولا تحذير. ⇒ **ووقع:** `barButtons` **لم يُنسَخ**، والهجرةُ حذفت القديمين ⇒
// **صفرُ أزرارٍ عند المستخدم، والمحرِّرُ يقول «ظاهر»، والبوّابةُ التسعة خضراء.**
//
// ⭐ **والعلّةُ صنفٌ لا واقعة — مقيسٌ:** **أربعةُ إسقاطاتٍ بالشكل نفسِه**
// (`overlaySettings` 9 · `subtitleSettings` 9 · `soundDisplaySettings` 2 ·
// `cleanPlayerSettings` 2 = **22 حقلاً**). ⇒ **فيُحرَس الصنفُ لا الواقعة.**
//
// ⚠️ **والاستثناءُ يُعلَن ولا يُسكت عنه:** مفتاحٌ قديمٌ يُقرأ بكتلةٍ متناظرة
// (`hideProgressBar` ⇒ `progressBarModeOf`) **لا يُنسَخ عمداً** — **فيُكتب هنا
// باسمه وسببه**، **ولا يُوسَّع هذا السجلّ ليمرّ مفتاحٌ نُسي.**
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ⛔⭐ **والتعليقاتُ تُنزع قبل أيّ مطابقة** — **وإلا قرأ الحارسُ شرحاً يذكر
// المفتاحَ فحسبه كتابةً**، **وهي ثالثةُ «مطابقةٌ أوسع من سؤالها» في يومٍ واحد**
// (قرار 93): السؤالُ «أيُكتب هذا المفتاح؟» لا «أيُذكر اسمُه؟».
const stripComments = (t) => t.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const CONTENT = read("content.js");
const OPTIONS = stripComments(read("options.js")), STORAGE = stripComments(read("storage.js"));

// **المستثنى بنصّه وسببه** — والسجلّ هنا هو الموضع الواحد لهذي الحقيقة.
const DECLARED = {
  hideProgressBar: "مفتاحٌ قديم (#107) يُقرأ بالكتلة المتناظرة `progressBarModeOf` ولا يُنسَخ"
};

function projectionKeys(name) {
  const i = CONTENT.indexOf(`  ${name} = {`);
  if (i === -1) return null;
  const j = CONTENT.indexOf("\n  };", i);
  return [...CONTENT.slice(i, j).matchAll(/^\s{4}([a-zA-Z]+):/gm)].map((m) => m[1]);
}

console.log("\n[1] الإسقاطاتُ الأربعة موجودةٌ وتُقرأ");
const PROJ = ["overlaySettings", "subtitleSettings", "soundDisplaySettings", "cleanPlayerSettings"];
const keys = {};
for (const p of PROJ) {
  keys[p] = projectionKeys(p);
  check(`\`${p}\` يُقرأ`, Array.isArray(keys[p]) && keys[p].length > 0, keys[p]);
}

console.log("\n[2] ⭐ وكلُّ مفتاحٍ يُكتب في `settings.overlay` يحمله إسقاطُه أو يُستثنى بنصّه");
{
  // ما يُكتب فعلاً — من مسارات الحفظ والهجرة معاً، لا من قائمةٍ نكتبها هنا
  const written = new Set([
    ...[...OPTIONS.matchAll(/s\.overlay\.([a-zA-Z]+)\s*=/g)].map((m) => m[1]),
    ...[...OPTIONS.matchAll(/s\.overlay\s*=\s*\{[^}]*?([a-zA-Z]+):/g)].map((m) => m[1]),
    // ⛔ **و`=` لا يتبعها `=`** — وإلا طابق `o.speedButton === true` **قراءةً
    // فعُدَّت كتابة**، **فأبلغ الحارسُ عن مفتاحين محذوفين** ⇒ **مطابقةٌ أوسع من
    // سؤالها** (قرار 93) **واقعةً في الحارس المكتوب ضدّ الصنف نفسِه، في يومه.**
    ...[...STORAGE.matchAll(/\bo\.([a-zA-Z]+)\s*=(?!=)/g)].map((m) => m[1])
  ]);
  const carried = new Set(keys.overlaySettings || []);
  const missing = [...written].filter((k) => !carried.has(k) && !DECLARED[k]);
  check(`المكتوبُ ${written.size} · المحمولُ ${carried.size} · المستثنى ${Object.keys(DECLARED).length}`,
    written.size > 0 && carried.size > 0);
  // ⛔ **فشلُ هذا التأكيد يعني أن مفتاحاً يُحفَظ ولا يصل المنتَج** — **راجِع
  // `loadOverlaySettings` ولا تُصلح الاختبار**، أو أعلِن الاستثناءَ في `DECLARED`.
  check("⭐⭐ ولا مفتاحَ يُكتب ولا يصل المنتَج", missing.length === 0,
    missing.join(" · ") + "  ← يُحفَظ ولا يُقرأ: غيابٌ صامت");
}

console.log("\n[3] وشاهدا قرار 26 — على الحارس نفسه");
{
  // موجب: مفتاحٌ مفتعَلٌ غيرُ محمولٍ يجب أن يُكشف
  const carried = new Set(["a", "b"]);
  const written = ["a", "b", "c"];
  check("موجب: مفتاحٌ غيرُ محمولٍ يُكشف",
    written.filter((k) => !carried.has(k) && !DECLARED[k]).join() === "c");
  // سالب: ومحمولٌ كلُّه لا يُكشف
  check("سالب: والمحمولُ كلُّه لا يُكشف",
    ["a", "b"].filter((k) => !carried.has(k)).length === 0);
  // وثالث: المستثنى بنصّه يمرّ
  check("وثالث: المُعلَنُ في `DECLARED` يمرّ",
    ["hideProgressBar"].filter((k) => !carried.has(k) && !DECLARED[k]).length === 0);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
