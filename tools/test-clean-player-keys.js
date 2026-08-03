// يحرس تطابق مفاتيح Clean Player بين CLEAN_PLAYER_ITEMS و CLEAN_PLAYER_OPTIONS.
//
// ── العلّة التي وُلد منها (البند #66، 2026-08-02) ────────────────────────────
// المفاتيح تعيش في **موضعين**: `CLEAN_PLAYER_ITEMS` في `content.js` (مفتاح ⇐
// محدِّدات) و`CLEAN_PLAYER_OPTIONS` في `options.js` (مفتاح ⇐ تسمية الواجهة).
// و`CLAUDE.md` يقول «keys must stay in sync» — **قولاً بلا حارس**. وهذا هو الشكل
// نفسه الذي كذب في عدد التأكيدات وفي حالة البنود: **موضعان للحقيقة الواحدة**
// (قرارا 34 و36). وقد أمسكه فحص `S7` بيده: مفتاحٌ في السجلّين ومحدِّده ميّت.
//
// **والخطر ليس نظرياً:** مفتاح في `content.js` وحده ⇒ **لا مربّع له في الواجهة،
// فلا يستطيع المستخدم تشغيله أبداً** — ميزةٌ مشحونة لا يمكن بلوغها. ومفتاح في
// `options.js` وحده ⇒ **مربّع يَعِد بما لا محدِّد له**، وهو «اسم يَعِد بما لا يفعل»
// نفسه الذي وُلد منه #66. **فالتفرّق يُمنع بالبناء لا يُحصى في قائمة** (قرار 16ج).
//
// ── شاهدا القبول (قرار 26) ──────────────────────────────────────────────────
// حارسٌ لا يُثبت أنه يُحمّر ليس حارساً: يُشغَّل على **مصدرين مُفتعَلين** يجب أن
// يرفضهما (نقص في كل جهة)، وعلى **المصدر الحقيقي** الذي يجب أن يمرّ.
// **والمرساة محروسة كذلك** (قرار 33): تعذُّر إيجاد أي سجلّ **يُفشل الاختبار**
// بدل أن يُقرأ تطابقاً — سجلٌّ لم يُقرأ يُطابق كلَّ شيء.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  ❌ ${msg}`); } };

// ── استخراج السجلّين نصّياً ─────────────────────────────────────────────────
function itemKeys(src) {
  const m = src.match(/const CLEAN_PLAYER_ITEMS = (\{[\s\S]*?\n\});/);
  if (!m) return null;                       // المرساة سقطت — لا يُقرأ تطابقاً
  return Object.keys(vm.runInNewContext("(" + m[1] + ")"));
}
function optionKeys(src) {
  const m = src.match(/const CLEAN_PLAYER_OPTIONS = (\[[\s\S]*?\n\]);/);
  if (!m) return null;
  return vm.runInNewContext("(" + m[1] + ")").map((o) => o.key);
}

// يُرجع قائمة الفروق: ما في المنتج وليس في الواجهة، والعكس
function diff(items, options) {
  if (!items || !options) return null;
  const a = new Set(items), b = new Set(options);
  return {
    onlyContent: items.filter((k) => !b.has(k)),
    onlyOptions: options.filter((k) => !a.has(k)),
    dupItems: items.filter((k, i) => items.indexOf(k) !== i),
    dupOptions: options.filter((k, i) => options.indexOf(k) !== i)
  };
}

console.log("\n[1] المصدر الحقيقي — يجب أن يمرّ");
const contentSrc = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
const optionsSrc = fs.readFileSync(path.join(ROOT, "options.js"), "utf8");
const items = itemKeys(contentSrc);
const options = optionKeys(optionsSrc);

ok(items !== null, "تعذّر إيجاد CLEAN_PLAYER_ITEMS في content.js — **المرساة سقطت، أصلِح المرساة لا التأكيد** (قرار 33)");
ok(options !== null, "تعذّر إيجاد CLEAN_PLAYER_OPTIONS في options.js — **المرساة سقطت، أصلِح المرساة لا التأكيد** (قرار 33)");
if (items === null || options === null) {
  console.log(`\n❌ فشل: ${fail} · نجح: ${pass}`);
  process.exit(1);
}
ok(items.length > 0, "سجلّ content.js فارغ");
ok(options.length > 0, "سجلّ options.js فارغ");

const d = diff(items, options);
ok(d.onlyContent.length === 0, `مفاتيح في content.js بلا مربّع في الواجهة — **لا يستطيع المستخدم تشغيلها**: ${d.onlyContent.join(", ")}`);
ok(d.onlyOptions.length === 0, `مفاتيح في options.js بلا محدِّد في المنتج — **مربّع يَعِد بما لا يفعل**: ${d.onlyOptions.join(", ")}`);
ok(d.dupItems.length === 0, `مفتاح مكرَّر في content.js: ${d.dupItems.join(", ")}`);
ok(d.dupOptions.length === 0, `مفتاح مكرَّر في options.js: ${d.dupOptions.join(", ")}`);
ok(items.length === options.length, `العدد مختلف: content.js ${items.length} · options.js ${options.length}`);
// ⚠️ الوصف يتبع الحالة ولا يسبقها: كان يقول «متطابقاً» في كل الأحوال، فيطبع
// رقماً صحيحاً تحت وصفٍ كاذب حين يقع التفرّق — وهو النوع الرابع من العمى نفسه
// (شاهد ثامن عشر، قرار 26).
const same = d.onlyContent.length === 0 && d.onlyOptions.length === 0 && items.length === options.length;
console.log(same ? `  · ${items.length} مفتاحاً متطابقاً في السجلّين`
                 : `  · content.js ${items.length} مفتاحاً · options.js ${options.length} — **غير متطابقين**`);

// كل محدِّد نصّ غير فارغ — سجلٌّ بمفتاح بلا محدِّد يمرّ بالمقارنة ويُخفي لا شيء
const itemsObj = vm.runInNewContext("(" + contentSrc.match(/const CLEAN_PLAYER_ITEMS = (\{[\s\S]*?\n\});/)[1] + ")");
for (const [k, sels] of Object.entries(itemsObj)) {
  ok(Array.isArray(sels) && sels.length > 0 && sels.every((s) => typeof s === "string" && s.trim()),
     `المفتاح ${k} بلا محدِّدات صالحة`);
}

console.log("\n[2] الشاهد الموجب — مصدران مُفتعَلان يجب أن يرفضهما الحارس");
// (أ) مفتاح في المنتج وحده
const fakeContentA = `const CLEAN_PLAYER_ITEMS = {\n  a: [".x"],\n  b: [".y"]\n};`;
const fakeOptionsA = `const CLEAN_PLAYER_OPTIONS = [\n  { key: "a", label: "A" }\n];`;
const dA = diff(itemKeys(fakeContentA), optionKeys(fakeOptionsA));
ok(dA && dA.onlyContent.length === 1 && dA.onlyContent[0] === "b",
   "الحارس لم يرَ مفتاحاً في content.js وحده — **لا يُصدَّق خضاره**");
// (ب) مفتاح في الواجهة وحدها
const fakeContentB = `const CLEAN_PLAYER_ITEMS = {\n  a: [".x"]\n};`;
const fakeOptionsB = `const CLEAN_PLAYER_OPTIONS = [\n  { key: "a", label: "A" },\n  { key: "c", label: "C" }\n];`;
const dB = diff(itemKeys(fakeContentB), optionKeys(fakeOptionsB));
ok(dB && dB.onlyOptions.length === 1 && dB.onlyOptions[0] === "c",
   "الحارس لم يرَ مفتاحاً في options.js وحده — **لا يُصدَّق خضاره**");
// (ج) والمرساة الساقطة تُرجع null لا تطابقاً
ok(itemKeys("const SOMETHING_ELSE = {};") === null, "مصدر بلا سجلّ قُرئ تطابقاً بدل أن يسقط");
ok(optionKeys("const SOMETHING_ELSE = [];") === null, "مصدر بلا سجلّ قُرئ تطابقاً بدل أن يسقط");

// ── #91 — المحدِّد المقيس لعنوان ملء الشاشة، مثبَّتٌ باسمه ──────────────────
// ⚠️ **فشل هذا التثبيت يعني أن `top_titles` فقد عنصر ملء الشاشة** — والعَرَض
// عندها: المفتاح مؤشَّرٌ والعنوان ظاهرٌ في ملء الشاشة، **وهو #91 عائداً**.
// **قِيس 2026-08-04** (`tools/bench-91-title.mjs`): `.ytp-title` يُخفى فعلاً
// (شاهدٌ من صنعنا)، **والظاهر عنصرٌ آخر** `.ytp-fullscreen-metadata` — **مرئيّ
// 466×56 في ملء الشاشة و`0×0` خارجه**، ويحمل العنوان والقناة والمشاهدات وحدها.
{
  const CONTENT = require("fs").readFileSync("content.js", "utf8");
  const row = (CONTENT.match(/top_titles:\s*\[([^\]]*)\]/) || [])[1] || "";
  ok(/\.ytp-title\b/.test(row), "top_titles ما زال يحمل `.ytp-title`");
  ok(/\.ytp-fullscreen-metadata/.test(row),
     "top_titles يحمل `.ytp-fullscreen-metadata` (#91) — **وبدونه يعود العَرَض**");
  // شاهدٌ على الحارس: سجلٌّ بلا المحدِّد **يجب أن يُقرأ ناقصاً**
  const fakeRow = (`top_titles: [".ytp-title", ".ytp-title-channel"],`
    .match(/top_titles:\s*\[([^\]]*)\]/) || [])[1] || "";
  ok(!/\.ytp-fullscreen-metadata/.test(fakeRow),
     "والحارس يرى غيابه في سجلٍّ مُفتعَل — **وإلّا فخضرتُه لا تعني شيئاً**");
}

// الصيغة هي التي يفهمها `tools/run-tests.js` — ملفٌ بخرْج آخر يُحسب **مجهولاً
// لا صفراً**، فيُحمّر المجموعة بدل أن يُتخطّى صامتاً.
console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
