// عضوُ البوّابة الثامن — أسماءٌ لا تُحلّ حيث تُستعمل (`no-undef`).
//
// ⛔ **من الثمانية — يُشغَّل قبل كل كومِت.** ويحرس: **#77 · #82 · #100 · #101** —
// اسمٌ يُنادى أو يُمرَّر ولا يُحلّ: محذوفاً · أو خارجَ نطاق مُناديه · أو غيرَ
// مستورَد. **وهو الصنف الذي أخرجت فيه حرّاسُنا النصّية صفراً وأخرج هو 13.**
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين تُفتح صفحةُ الإعدادات فلا تعمل،
// أو يُرفض حفظُ إعدادي بلا سبب — أهو عطبٌ في الميزة، أم اسمٌ استعمله كودُنا وليس
// موجوداً أصلاً فمات كلُّ ما بعده؟»*
//
// ── ⚠️ **ولماذا غلافٌ بدل `eslint` مباشرةً — وهو شرطُ المالك لا تحسين** ───────
// **نُقض الثابت «لا تبعيّات» صراحةً 2026-08-04** (حجّتُه في `CLAUDE.md`)،
// **وشرطُه أن يُعلن غيابُ التبعيّة نفسَه**: جلسةٌ جديدة على نسخةٍ عارية تصطدم
// بهذا أوّلَ ما تصطدم، **وفشلٌ غامضٌ في بوّابة الكومِت يُقرأ عطباً في المنتج**.
// ⇒ **فيُقال بسطرٍ واحد ما يُفعل، ولا يُترك رمزُ خروجٍ عارياً.**
// ⚠️ **والرسالةُ مُجرَّبةٌ على شجرةٍ بلا `node_modules` فعلاً لا افتراضاً** —
// **فرسالةٌ لطيفةٌ لم تُجرَّب هي «قِيل ولم يُنفَّذ» بعينه.**
//
// ⛔ **و`node tools/run-tests.js` يبقى بلا تبعيّة** — نسخةٌ عارية تُشغّل المجموعة
// كاملةً بلا تثبيت. **فالخاصيّةُ المفقودة محصورةٌ في البوّابة لا في المجموعة.**
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// ⛔ **تُحلُّ الحزمةُ ولا يُخمَّن مسارُها** (2026-08-04): أوّلُ صياغةٍ فحصت
// `node_modules/eslint/lib/index.js` — **وهو ليس مدخلَ الحزمة** — **فطبعت «غير
// مثبَّتة» والتثبيتُ قائم** ⇒ **غلافٌ يطبع رسالتَه دائماً ولا يُشغّل الأداة
// أبداً**. ⭐ **وهو «فحصٌ لا يفحص» في الغلاف الذي كُتب ليمنعه.**
// ⇒ **فالوجودُ يُقاس بالحلّ لا بمسارٍ نكتبه** — والحلُّ هو ما يفعله `import`.
let ESLintCtor = null;
try { ({ ESLint: ESLintCtor } = await import("eslint")); } catch { ESLintCtor = null; }

if (!ESLintCtor) {
  console.log("\n⛔ **أدواتُ الفحص غير مثبَّتة — ولا يُقاس شيء.**");
  console.log("   شغّل:  npm install");
  console.log("   (أدواتُ تطويرٍ لا تُشحن — انظر Packaging في CLAUDE.md.");
  console.log("    و`node tools/run-tests.js` يعمل بلا تثبيت.)\n");
  process.exit(2);          // **2 ≠ 1**: «لم يُقس» لا «سقط الفحص»
}

const eslint = new ESLintCtor({ overrideConfigFile: path.join(ROOT, "eslint.config.mjs"), cwd: ROOT });
const results = await eslint.lintFiles(["*.js", "tools/**/*.js", "tools/**/*.mjs"]);

const msgs = [];
for (const r of results) for (const m of r.messages) {
  msgs.push({ f: path.relative(ROOT, r.filePath), l: m.line, c: m.column, t: m.message });
}

console.log(`\n=== أسماءٌ لا تُحلّ — ${results.length} ملفّاً ===\n`);
if (!msgs.length) console.log("   ✅ صفر — كلُّ اسمٍ مستعمَلٍ يُحلّ حيث استُعمل");
else {
  const by = {};
  for (const m of msgs) (by[(m.t.match(/'([^']+)'/) || [])[1] || m.t] ||= []).push(`${m.f}:${m.l}`);
  for (const [n, v] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`   ❌ ${String(v.length).padStart(3)} × ${n}`);
    for (const w of v) console.log(`        ${w}`);
  }
}
console.log(`\n⇒ ${msgs.length ? `**${msgs.length} اسماً لا يُحلّ**` : "**العقد قائم**"}\n`);
process.exit(msgs.length ? 1 : 0);
