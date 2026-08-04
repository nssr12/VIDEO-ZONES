// يحرس أن يكون لـ`runAction` موضعُ اشتقاقٍ واحد للفيديو: `actionVideo` وحدها.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يقع الأمر على الفيديو الذي أشرتُ إليه، لا على غيره في الصفحة؟»*
//
// ── العلّة التي وُلد منها (الجذر الأوّل في #72، 2026-08-03) ──────────────────
// `speedBtnClick` تُحلّ الفيديو صحيحاً وتُمرّره في `__videoUnderPointer`،
// **وفرعا `ACTION:SPEED:*` يتجاهلانه** ويناديان `findVideoLoose(e)`. والمؤشّر فوق
// زرّنا ⇒ `data-vz-owns` ⇒ `BLOCKED_BY_LAYER` ⇒ `findVideoAtPoint` تُرجع `null`
// **عمداً** ⇒ `return false` بلا أثر.
// ⇒ ⭐ **علامة الملكية تحمي الزرّ من مسار المربّعات وتُعمي أمرَ الزرّ نفسه** —
// تقول «هذا الحدث ليس لمسار المربّعات»، **فيقرؤها `runAction` «لا فيديو هنا».**
//
// **والمبدأ الذي يُغلق العائلة (قرار المالك): من يملك الحدث يعرف فيديوه، فلا
// يُعيد `runAction` اشتقاق ما تسلّمه.** وكان **2 من 8** فروعٍ تحترم المُمرَّر —
// **فالعلاج الموضعيّ خطأٌ معلومٌ سلفاً**: يُصلح فرعين ويترك ستّة تتفرّق.
//
// ── شاهدا القبول (قرار 47 — الحارس كالرِكاز) ────────────────────────────────
// **موجب:** مصدرٌ فيه فرعٌ يشتقّ بنفسه **يجب أن يُحمَّر**.
// **سالب:** ومصدرٌ كلُّه يستهلك `actionVideo` **يجب أن يمرّ**.
// ⚠️ **وأُثبت على الكود قبل الإصلاح فرآه أحمر** — لا بعده (قرار 47).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  ❌ ${msg}`); } };

// جسم `runAction` — **بعدّ الأقواس لا بأوّل `\n}`**.
// ⚠️ **أوّل نسخةٍ اقتطعت بـ`indexOf("\n}")` فعدّت 3 اشتقاقات والحقيقة 6** —
// **حارسٌ يقتطع ناقصاً يُجيز ما لم يره**، وهو عمى المرساة نفسه من بابٍ جديد.
// وقد كشفه أن الرقم خالف عدّاً يدوياً سابقاً — **ولولا المقارنة لمرّ**.
function runActionBody(src) {
  const at = src.indexOf("\nfunction runAction(action, e) {");
  if (at < 0) return null;                       // المرساة سقطت (قرار 33)
  const open = src.indexOf("{", at);
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return depth === 0 ? src.slice(at, i) : null;  // لم يُغلق ⇒ لا يُقرأ اقتطاعاً
}

function derivations(body) {
  return (body.match(/findVideoLoose\s*\(/g) || []).length;
}
function consumers(body) {
  return (body.match(/actionVideo\s*\(\s*e\s*\)/g) || []).length;
}

console.log("\n[1] موضع الاشتقاق واحد — والفروع تستهلكه");
const body = runActionBody(SRC);
ok(body !== null, "تعذّر اقتطاع `runAction` — **المرساة سقطت، أصلِح المرساة لا التأكيد** (قرار 33)");
if (body === null) { console.log(`\n❌ فشل: ${fail} · نجح: ${pass}`); process.exit(1); }

const der = derivations(body);
ok(der === 0,
   `فرعٌ يشتقّ بنفسه داخل \`runAction\` — ${der} نداءً لـ\`findVideoLoose\`. ` +
   `**المُمرَّر يُهدَر ويُعاد الاشتقاق**، وهو الجذر الأوّل في #72 بعينه`);

const cons = consumers(body);
ok(cons === 8, `الفروع المستهلِكة لـ\`actionVideo(e)\` ${cons} لا 8 — ` +
   `**فرعٌ خارج الموضع الواحد يتفرّق بصمت**`);

// والدالّة نفسها: تُرجع المُمرَّر إن وُجد وإلا تشتقّ — لا العكس
const fn = SRC.match(/function actionVideo\(e\)[\s\S]{0,240}?\n}/);
ok(!!fn, "`actionVideo` غير معرَّفة");
if (fn) {
  ok(/e\.__videoUnderPointer\s*\|\|\s*findVideoLoose\(e\)/.test(fn[0]),
     `\`actionVideo\` لا تُرجع المُمرَّر أوّلاً — **الترتيب هو الميزة كلُّها**: ${fn[0].slice(0, 90)}`);
  // وموضع الاشتقاق الوحيد: `findVideoLoose` تُنادى منها وحدها في مسار الأوامر
  const inFn = (fn[0].match(/findVideoLoose\s*\(/g) || []).length;
  ok(inFn === 1, `\`actionVideo\` تنادي \`findVideoLoose\` ${inFn} مرّة لا مرّة واحدة`);
}

console.log("\n[2] الشاهد الموجب — فرعٌ يشتقّ بنفسه يجب أن يُحمَّر");
{
  const fake = `
function runAction(action, e) {
  if (action === "A") { const video = actionVideo(e); return !!video; }
  if (action === "B") { const video = findVideoLoose(e); return !!video; }
}`;
  const b = runActionBody(fake);
  ok(b !== null && derivations(b) === 1,
     `الحارس لم يرَ فرعاً يشتقّ بنفسه — **لا يُصدَّق خضاره**: ${derivations(b || "")}`);
  ok(b !== null && consumers(b) === 1, "الحارس لم يعدّ المستهلكين");
}

console.log("\n[3] الشاهد السالب — الموضع الواحد يجب أن يمرّ");
{
  const good = `
function runAction(action, e) {
  if (action === "A") { const video = actionVideo(e); return !!video; }
  if (action === "B") { const video = actionVideo(e); return !!video; }
}`;
  const b = runActionBody(good);
  ok(b !== null && derivations(b) === 0,
     "الحارس حمّر مصدراً كلُّه يستهلك الموضع الواحد — **حارسٌ يُحمّر السليم يُدرَّب الناس على تجاهله**");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
