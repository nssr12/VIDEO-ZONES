// يحرس سجلّ الأيقونات: ما يُشحن موجودٌ في السجلّ ومُستعمَل، ولا مسارَ مبعثر.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تظهر كلُّ أيقونةٍ في الواجهة كما رُسمت؟»*
//
// ── العلّة التي وُلد منها (#89، 2026-08-03) ──────────────────────────────────
// الأيقونات **من تصميم صاحب المشروع**، فهي **مصدرٌ لا مرجع**. وكانت ستعيش في
// **موضعين**: صفحةُ عرضٍ مكتوبةٌ بيد، ومسارٌ منسوخٌ في `content.js` — **وهو شكل
// «موضعان للحقيقة الواحدة»** الذي طاردناه في عدّ التأكيدات وفي حالة البنود
// (قرارا 34 و36). ⇒ **السجلّ `tools/icons.js` هو الموضع، والصفحة تُولَّد منه.**
//
// ⛔ **وقرار المالك في الوزن: لا يُشحن إلا ما يُستعمل.** التسعة عشر تبقى في
// السجلّ **جاهزةً**، **ووزنٌ يُشحن بلا مستعمِل كودٌ ميت**.
// ⚠️ **وتفسيرٌ مكتوبٌ لا مُضمَر:** «أيقونةٌ في السجلّ بلا مستعمِل تُحمَّر» تسري
// على **المشحون** لا على السجلّ نفسه — **وإلا ناقض الشرطُ شرطَ «الباقي يبقى
// جاهزاً»**. فالسجلّ مكتبة، والمشحون هو ما يُحاسَب.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REG = require("./icons.js");
const CONTENT = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ❌ " + m); } };

console.log("\n[1] السجلّ موضعٌ واحد، وأسلوبُه موحَّد");
const keys = Object.keys(REG.VZ_ICONS);
ok(keys.length > 0, "السجلّ فارغ — **المرساة سقطت** (قرار 33)");
ok(REG.VZ_ICONS_SHIPPED.length > 0, "لا أيقونة مشحونة معلَنة");
for (const k of keys) {
  const it = REG.VZ_ICONS[k];
  ok(typeof it.d === "string" && it.d.trim().length > 0, `الأيقونة ${k} بلا مسار`);
  ok(typeof it.ar === "string" && it.ar.trim().length > 0, `الأيقونة ${k} بلا اسم عربيّ`);
}
console.log(`  · ${keys.length} أيقونة في السجلّ · المشحون: ${REG.VZ_ICONS_SHIPPED.join(", ")}`);

console.log("\n[2] ⭐ المشحون ⊆ السجلّ، وكلُّ مشحونٍ له مستعمِل");
for (const k of REG.VZ_ICONS_SHIPPED) {
  ok(!!REG.VZ_ICONS[k], `مشحونٌ ليس في السجلّ: ${k} — **أيقونةٌ لا مصدر لها**`);
  // مستعمِلٌ فعليّ: مسارُها حاضرٌ في الكود المشحون
  const d = REG.VZ_ICONS[k]?.d || "";
  const head = d.slice(0, 40);
  ok(head.length > 0 && CONTENT.includes(head),
     `مشحونٌ بلا مستعمِل: ${k} — **وزنٌ يُشحن بلا أن يراه أحد، وهو كودٌ ميت**`);
}

console.log("\n[3] ⭐ ولا مسارَ في `content.js` خارج السجلّ");
{
  // كلّ `d="…"` في الكود المشحون يجب أن يكون من السجلّ
  const inCode = [...CONTENT.matchAll(/\sd="([^"]{12,})"/g)].map((m) => m[1]);
  const known = new Set();
  for (const k of keys) for (const m of REG.VZ_ICONS[k].d.matchAll(/\sd="([^"]+)"/g)) known.add(m[1]);
  const stray = inCode.filter((d) => !known.has(d));
  ok(stray.length === 0,
     `مسارٌ في الكود ليس من السجلّ (${stray.length}) — **موضعان لأيقونةٍ واحدة**: ` +
     stray.slice(0, 2).map((d) => d.slice(0, 46) + "…").join(" · "));
  if (!stray.length) console.log(`  · ${inCode.length} مساراً في الكود، كلُّها من السجلّ`);
}

console.log("\n[4] الشاهد الموجب — يُحمّر على ما بُني لأجله");
{
  const fakeShipped = ["ghost"];
  ok(!REG.VZ_ICONS["ghost"], "الحارس لا يرى مشحوناً خارج السجلّ — **لا يُصدَّق خضاره**");
  // مسارٌ دخيل يجب أن يُرصد
  const strayCode = ' d="M0 0 L9 9 L1 4 Z zzz"';
  const found = [...strayCode.matchAll(/\sd="([^"]{12,})"/g)].map((m) => m[1]);
  ok(found.length === 1, "الحارس لا يرى مساراً دخيلاً في الكود");
  ok(fakeShipped.every((k) => !REG.VZ_ICONS[k]), "مرساة الشاهد سقطت");
}

console.log("\n[5] الشاهد السالب — السليم يمرّ");
ok(REG.vzIconSvg("speed", "x").includes('class="x"') && REG.vzIconSvg("speed", "x").includes("<svg"),
   "بناء الوسم من السجلّ لا يُنتج SVG صالحاً");
ok(REG.vzIconSvg("لا-توجد") === "", "مفتاحٌ مجهول لم يُرجع فراغاً — **يُخترع ما لا يُعرف**");



// ── [5] ⭐⭐ #124 — نسخةُ `settings-ui.js` لا تتباعد عن السجلّ ────────────────
// **النمطُ نفسُه الذي يحمله `content.js`**: `tools/` لا يُشحن، **فالإطارُ يحمل
// نسخةً** — ⛔ **ونسخةٌ بلا حارسٍ تتباعد عن أصلها فتُري المعاينةُ ما لا يقع.**
console.log("\n[5] نسخةُ الإطار في `settings-ui.js` — لا تتباعد عن السجلّ");
{
  const UI = fs.readFileSync(path.join(ROOT, "settings-ui.js"), "utf8");
  const reg = require("./icons.js");
  const known = new Set();
  for (const v of Object.values(reg.VZ_ICONS)) for (const m of v.d.matchAll(/d="([^"]+)"/g)) known.add(m[1]);
  for (const v of Object.values(reg.VZ_YT_ICONS)) for (const m of v.d.matchAll(/d="([^"]+)"/g)) known.add(m[1]);
  const inUi = [...UI.matchAll(/<path[^>]*?d=\\"([^\\"]+)\\"/g)].map((m) => m[1]);
  ok(inUi.length > 0, `[5] النسخةُ تحمل مساراتٍ — وُجد ${inUi.length}`);
  const stray = inUi.filter((d) => !known.has(d));
  // ⛔ **فشلُ هذا يعني أن الإطارَ يرسم ما ليس في السجلّ** — راجِع `tools/icons.js`
  // **ولا تُصلح الاختبار**، فالسجلُّ هو الموضع الواحد.
  ok(stray.length === 0, "[5] ⭐⭐ ولا مسارَ فيها خارج السجلّ — " + stray.slice(0, 1).join("").slice(0, 40));
  ok(new RegExp(`VZ_SIM_ICONS_DATE = "${reg.VZ_YT_ICONS_DATE}"`).test(UI),
     "[5] ⭐ وتاريخُ نسخِ أيقونات يوتيوب واحدٌ في الطرفين");
  const REG_SRC = fs.readFileSync(path.join(ROOT, "tools", "icons.js"), "utf8");
  ok(/يوتيوب يُغيّر رسومَه/.test(REG_SRC) && /يوتيوب يُغيّر/.test(UI),
     "[5] وحدُّ المراجعة مكتوبٌ في الطرفين");
  console.log(`  · ${inUi.length} مساراً في النسخة · ${known.size} في السجلّ · تاريخ يوتيوب ${reg.VZ_YT_ICONS_DATE}`);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
