// يحرس ألّا يُستعمل متغيّر CSS لم يُعرَّف — فيسقط صامتاً إلى قيمةٍ ابتدائية.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تظهر ألوانُ صفحة الإعدادات كما صُمّمت أم تسقط إلى ألوانٍ ابتدائية؟»*
//
// ── العلّة التي وُلد منها (#87، 2026-08-03) ──────────────────────────────────
// `var(--acc)` مستعملة **خمس مرّات في `options.css` وغيرُ معرَّفة إطلاقاً** —
// واللوحة تعرّف `--accent`. **فحالة «مُشغَّل» في المفتاح كانت خلفيتُها شفافة
// وحدُّها أسود** (`rgb(0,0,0)`، سقوطُ `currentColor`) على خلفيةٍ داكنة.
// ⇒ ⭐ **وشكوى المالك «اللونان غير واضحين» كانت عطباً لا ذوقاً** — أحدهما لم
// يُرسَم أصلاً. **والفرق أن الذوق يُناقَش والعطب يُصلَح.**
//
// ⚠️ **وسقوطُه صامت بالتعريف:** `var()` بمتغيّرٍ غير معرَّف **لا يُحمّر شيئاً** —
// تُلغى الخاصّية وتعود إلى قيمتها الابتدائية. **وهو «الصمت ليس نجاحاً» في
// الأنماط** (قرار 46) — طريقٌ يفشل ولا يقول.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const FILES = ["options.css"];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ❌ " + m); } };

function scan(raw) {
  // ⚠️ **التعليقات تُنزع أوّلاً — وهذا تدقيقٌ لا إضعاف:** متغيّرٌ يُذكَر في تعليقٍ
  // **ليس استعمالاً**، ولا تسقط عنه خاصّية. **والفرق عن «إضعاف حارسٍ ليمرّ عليه
  // كودُنا» أن ذاك يُسقط تغطية وهذا يُسقط إنذاراً كاذباً** — والشاهد [4] يُثبت
  // أن الحقيقيّ ما زال يُرى بعد النزع.
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, " ");
  const defined = new Set();
  for (const m of css.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) defined.add(m[1]);
  const used = new Map();
  for (const m of css.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*(,|\))/g)) {
    // ⚠️ **`var(--x, fallback)` ليست عطباً**: لها بديلٌ مكتوب فلا تسقط صامتة
    if (m[2] === ",") continue;
    used.set(m[1], (used.get(m[1]) || 0) + 1);
  }
  const missing = [...used.keys()].filter((v) => !defined.has(v));
  return { defined, used, missing };
}

console.log("\n[1] المصدر الحقيقي — كل متغيّر يُستعمل بلا بديل يجب أن يكون معرَّفاً");
for (const f of FILES) {
  const css = fs.readFileSync(path.join(ROOT, f), "utf8");
  const r = scan(css);
  ok(r.defined.size > 0, `${f}: لا تعريف واحد — **المرساة سقطت** (قرار 33)`);
  ok(r.missing.length === 0,
     `${f}: متغيّرات تُستعمل ولا تُعرَّف ⇒ **الخاصّية تسقط صامتة**: ` +
     r.missing.map((v) => `${v} (${r.used.get(v)} مرّة)`).join(" · "));
  if (r.missing.length === 0)
    console.log(`  · ${f}: ${r.defined.size} معرَّفاً · ${r.used.size} مستعملاً · صفر ناقص`);
}

console.log("\n[2] الشاهد الموجب — مصدرٌ مُفتعَل يجب أن يُحمَّر");
ok(scan(":root{--a:1}\n.x{color:var(--b)}").missing.length === 1,
   "الحارس لم يرَ متغيّراً غير معرَّف — **لا يُصدَّق خضاره**");
ok(scan(":root{--a:1}\n.x{color:var(--acc);border-color:var(--acc)}").missing.length === 1,
   "الحارس لم يجمع تكرار المتغيّر الواحد");

console.log("\n[4] ⭐ نزعُ التعليقات لا يُعمي الحارس");
ok(scan("/* var(--ghost) */\n:root{--a:1}\n.x{color:var(--a)}").missing.length === 0,
   "متغيّرٌ في تعليقٍ حُسب استعمالاً — **إنذارٌ كاذب**");
ok(scan("/* var(--ghost) */\n:root{--a:1}\n.x{color:var(--real)}").missing.length === 1,
   "⭐ نزعُ التعليقات أعمى الحارس عن استعمالٍ حقيقيّ — **تدقيقٌ صار إضعافاً**");

console.log("\n[3] الشاهد السالب — السليم يجب أن يمرّ");
ok(scan(":root{--a:1}\n.x{color:var(--a)}").missing.length === 0,
   "الحارس حمّر متغيّراً معرَّفاً — **حارسٌ يُحمّر السليم يُدرَّب الناس على تجاهله**");
ok(scan(":root{--a:1}\n.x{color:var(--b,#fff)}").missing.length === 0,
   "الحارس حمّر `var(--b,#fff)` ولها بديلٌ مكتوب — **فلا تسقط صامتة**");

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
