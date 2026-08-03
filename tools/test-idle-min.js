// يحرس أن الحدّ الأدنى لمهلة السكون رقمٌ واحد لا أربعة تتباعد.
//
// ── العلّة التي وُلد منها (#89، 2026-08-03) ──────────────────────────────────
// نُقل الحدّ 500 ⇒ 100 في #86، **فنُقل في ثلاثة مواضع ونُسي رابع**:
// `getSettings()` في `options.js` بقي يقصّ `Math.max(500, …)` — **وهو مسار
// العرض**. ⇒ **التخزين يحمل `100` والمُنزلق يُظهر `500`**.
// ⭐ **فالميزة كانت تعمل، والواجهة هي التي تكذب** — وأبلغ المالك «لا يُحفظ»
// **وهو محفوظ**. ⚠️ **وهذا فرعٌ ثالث لم يكن في التفريق**: لا الكتابة فشلت ولا
// القراءة سقطت — **العرض قصّ بحدٍّ بائت**.
//
// ⚠️ **ولماذا مرّ الحارس؟** `bench-options-page` يُبدّل كل ضابطٍ **بخطوةٍ واحدة
// من قيمته الحالية** — فلم ينزل تحت 500 قطّ، **فلم يدخل المدى الذي فُتح للتوّ**.
// ⇒ ⭐ **حارسٌ يُجرّب قيمةً واحدة يُثبت أن الضابط يستجيب، لا أن مداه صحيح.**
// **والعلاج هناك: يُدفع كلُّ مدىً إلى طرفيه** — وهو ما صار يفعله.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ❌ " + m); } };

const CONTENT = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
const UI = fs.readFileSync(path.join(ROOT, "settings-ui.js"), "utf8");
const OPTS = fs.readFileSync(path.join(ROOT, "options.js"), "utf8");

console.log("\n[1] الحدّ رقمٌ واحد، والمواضع تشتقّه");
const cm = CONTENT.match(/const IDLE_MIN_MS = (\d+);/);
const um = UI.match(/const VZ_IDLE_MIN_MS = (\d+);/);
ok(!!cm, "لا `IDLE_MIN_MS` في content.js — **المرساة سقطت** (قرار 33)");
ok(!!um, "لا `VZ_IDLE_MIN_MS` في settings-ui.js — **المرساة سقطت**");
if (cm && um) {
  ok(cm[1] === um[1],
     `الحدّان مختلفان: content.js ${cm[1]} · settings-ui.js ${um[1]} — ` +
     `**رقمٌ يُكتب بيد يتباعد** (قرار 34)`);
  console.log(`  · الحدّ ${cm[1]}ms في الموضعين`);
}

console.log("\n[2] ⭐ ولا رقمَ حدٍّ مكتوبٌ بيد في مسارات الإعدادات");
{
  // كلّ قصٍّ لـ`idle.ms` يجب أن يشتقّ من الثابت لا أن يحمل عدداً
  const clamps = [...OPTS.matchAll(/Math\.max\(\s*([A-Za-z_$][\w$]*|\d+)\s*,[^)]*idle[^)]*\)/g)]
    .map((m) => m[1]);
  const literal = clamps.filter((c) => /^\d+$/.test(c));
  ok(literal.length === 0,
     `قصٌّ بعددٍ مكتوب بيد في options.js: ${literal.join(", ")} — **وهو الموضع الذي نُسي**`);
  ok(clamps.length > 0, "لا قصَّ لـ`idle.ms` إطلاقاً — **المرساة سقطت، أصلِحها لا التأكيد**");
  if (!literal.length) console.log(`  · ${clamps.length} قصّاً، كلُّها مشتقّة: ${[...new Set(clamps)].join(", ")}`);
  // والضابط نفسه يشتقّ حدّه
  ok(/min:\s*VZ_IDLE_MIN_MS/.test(UI),
     "ضابط `idleDuration` يحمل حدّاً مكتوباً بيد بدل الثابت");
}

console.log("\n[3] الشاهد الموجب — يُحمّر على التفرّق نفسه");
{
  const a = "const IDLE_MIN_MS = 100;", b = "const VZ_IDLE_MIN_MS = 500;";
  ok(a.match(/(\d+)/)[1] !== b.match(/(\d+)/)[1],
     "الحارس لا يرى حدَّين مختلفين — **لا يُصدَّق خضاره**");
  const fake = "settings.idle.ms = Math.max(500, settings.idle.ms);";
  const got = [...fake.matchAll(/Math\.max\(\s*([A-Za-z_$][\w$]*|\d+)\s*,[^)]*idle[^)]*\)/g)].map((m) => m[1]);
  ok(got.length === 1 && got[0] === "500",
     `الحارس لا يرى قصّاً بعددٍ مكتوب بيد — **وهو العطب بعينه**: ${JSON.stringify(got)}`);
}

console.log("\n[4] الشاهد السالب — المشتقّ يمرّ");
{
  const good = "settings.idle.ms = Math.max(VZ_IDLE_MIN_MS, settings.idle.ms);";
  const got = [...good.matchAll(/Math\.max\(\s*([A-Za-z_$][\w$]*|\d+)\s*,[^)]*idle[^)]*\)/g)].map((m) => m[1]);
  ok(got.length === 1 && !/^\d+$/.test(got[0]),
     "الحارس حمّر قصّاً مشتقّاً — **حارسٌ يُحمّر السليم يُدرَّب الناس على تجاهله**");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
