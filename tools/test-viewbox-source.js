// #131 — **لا مقاسَ أيقونةٍ مكتوبٌ بيدٍ خارج السجلّ، والراسمُ واحدٌ لا يتباعد.**
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«أيقونةٌ في الإضافة تُرسم بمقاسٍ ليس
// مقاسَها فتخرج مشوّهةً أو مقصوصة — أيمكن أن يقع ذلك صامتاً؟»*
//
// ── العلّة التي وُلد منها (قرار 131، «صوابٌ مُعار») ──────────────────────────
// **عُومل `viewBox` كأنه مشترَك (`0 0 24 24`) — والمقيس ثمانيةٌ مختلفة في 41
// أيقونة.** ⇒ **الفرضيّةُ كانت خاطئةً ولم تُنتج عطباً**، لأن الكودَ يقرؤه من
// السجلّ لكلّ أيقونةٍ على حدة ⇒ **صوابٌ مُستعارٌ من بناءٍ آخر لا من صحّة الفرضيّة.**
// ⛔⭐⭐ **وخطرُه مؤجَّلٌ لا معدوم، وهذا الحارسُ هو ما يمنعه:** **من يكتب
// المقاسَ بيده غداً في موضعٍ جديد يرث الفرضيّةَ ولا يرث المُعير** —
// **ولا سابقةَ تُحذّره، لأن السجلّ لا يحمل إلا نتيجةً صحيحة.**
// ⚠️ **وكان الخطرُ واقعاً لا متوقَّعاً يومَ كُتب هذا:** `content.js` **المشحون**
// كان يحمل وسمَي SVG بمقاسٍ مكتوبٍ بيد، و`VZ_ICON_ATTRS` **كانت تخبّئ المقاسَ
// في وسمٍ جامع** — **فقُرئ خاصّةَ الأسلوب وهو خاصّةُ الأيقونة.**
//
// ⛔ **ولا يُعالَج بتوحيد المقاسات** (قرار المالك): **توحيدُها يجعل من يكتبه بيده يُصيب بالصدفة** ⇒ **فتُدفن الفرضيّةُ ولا تُحلّ، وتنكسر يومَ تأتي أيقونةٌ لا
// تقبل التحويل** · **وأيقوناتُ المالك مرسومةٌ بالخطوط، فتغييرُ المقاس يُغيّر
// سماكتَها فتخرج عن رسمه.**
// ⇒ ⭐ **والقاعدة: علاجُ فرضيّةٍ خاطئة ليس أن تُجعل صحيحة، بل أن تُلغى الحاجةُ
// إليها** (نصّ المالك).
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

let pass = 0, fail = 0;
const ok = (c, m, extra) => c
  ? (pass++, console.log("  ✅ " + m))
  : (fail++, console.log("  ❌ " + m, extra === undefined ? "" : String(extra).slice(0, 160)));

// ⚠️ **المُستثنى يُسمّى ويُعلَّل، ولا يُوسَّع بالسكوت:**
//   · `tools/icons.js` — **السجلّ نفسُه**: هو الموضع الذي يُكتب فيه المقاس.
//   · `tools/icons.html` و`tools/icons (1).html` — **مرجعُ المالك البصريّ**،
//     **لا يرسمان في المنتَج**، وقسمُ يوتيوب فيهما **مُولَّدٌ من السجلّ**.
const REGISTRY = "tools/icons.js";
const EXEMPT = new Set([REGISTRY, "tools/icons.html", "tools/icons (1).html"]);
const EXTS = new Set([".js", ".mjs", ".html", ".css"]);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === "icons") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(e.name))) out.push(path.relative(ROOT, p));
  }
  return out;
}

// **المقاسُ المكتوب بيد**: نصٌّ حرفيٌّ داخل الوسم — لا قراءةٌ من حقل.
// ⚠️ **ويُستثنى تركيبُ الراسم نفسِه** (`' viewBox="' + it.viewBox`)، فهو **قراءةٌ
// من الحقل لا كتابةٌ بيد** — **والفرقُ هو كلُّ الفرق.**
const VB_TOKEN = "view" + "Box";   // ⬅ ولا يُكتب الوسمُ حرفيّاً في حارسه
const HAND = new RegExp(VB_TOKEN + "\\s*=\\s*\\\\?\"[^\"]*[0-9][^\"]*\\\\?\"");
const VB_RE = new RegExp(VB_TOKEN);
const FROM_FIELD = new RegExp(VB_TOKEN + "=\"'\\s*\\+|" + VB_TOKEN + "=\"\\$\\{");

function handWritten(src) {
  return src.split("\n").map((l, i) => ({ l, i: i + 1 }))
    .filter(({ l }) => HAND.test(l) && !FROM_FIELD.test(l));
}

console.log("\n[1] لا viewBox مكتوبٌ بيدٍ خارج السجلّ");
{
  const files = walk(ROOT, []).filter((f) => !EXEMPT.has(f));
  const bad = [];
  for (const f of files) {
    const hits = handWritten(fs.readFileSync(path.join(ROOT, f), "utf8"));
    for (const h of hits) bad.push(`${f}:${h.i}`);
  }
  // ⛔ **فشلُ هذا يعني أن أحداً كتب مقاساً بيده** — **يُنقل إلى السجلّ ويُقرأ
  // منه، ولا يُضاف استثناءٌ ليمرّ الحارس** (قرار المالك: الاستثناءُ يقتله وهو حيّ).
  ok(bad.length === 0, `صفر — فُحص ${files.length} ملفّاً`, bad.slice(0, 4).join(" · "));
  console.log(`  · المُستثنى بسببه المكتوب: ${[...EXEMPT].join(" · ")}`);
}

console.log("\n[2] شاهدا قرار 26 — على الحارس نفسِه");
{
  const VB = "view" + "Box";                       // ⬅ لا يُكتب حرفيّاً هنا (قرار 93)
  ok(handWritten('<svg ' + VB + '="0 0 24 24" fill="none">').length === 1,
     "موجب: وسمٌ بمقاسٍ مكتوبٍ بيد ⇒ يُمسَك");
  ok(handWritten("' " + VB + "=\"' + it." + VB + " + '\"' +").length === 0,
     "سالب: وتركيبُ الراسم من الحقل ⇒ يمرّ");
  ok(handWritten("`<svg " + VB + "=\"${i." + VB + "}\" width=\"18\">`").length === 0,
     "وسالبٌ ثانٍ: قراءةٌ من حقلٍ في قالبٍ نصّيّ ⇒ يمرّ");
  ok(handWritten('const s = "' + VB + '=\\"0 -960 960 960\\"";').length === 1,
     "وموجبٌ ثانٍ: عائلةٌ أخرى مكتوبةٌ بيد ⇒ تُمسَك كذلك");
}

console.log("\n[3] الراسمُ الواحد — كتلةٌ مُقترنةٌ لا تتباعد");
{
  const grab = (f) => {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    const a = s.indexOf("// ---- BEGIN vzSvg ----");
    const b = s.indexOf("// ---- END vzSvg ----");
    return a === -1 || b === -1 ? null : s.slice(a, b);
  };
  const files = [REGISTRY, "settings-ui.js", "content.js"];
  const blocks = files.map(grab);
  ok(blocks.every(Boolean), "الكتلةُ موجودةٌ في الثلاثة", files.filter((f, i) => !blocks[i]).join(","));
  // ⛔ **والمقارنةُ نصّيّةٌ بحروفها** — كما يفعل `test-migration` بالكتل المقترنة:
  // **نسخةٌ تتباعد عن أصلها ترسم بأسلوبٍ آخر ولا يقول أحدٌ شيئاً.**
  ok(blocks[0] && blocks.every((b) => b === blocks[0]), "ولا تتباعد نسخةٌ عن أصلها");
}

console.log("\n[4] `viewBox` إجباريٌّ في السجلّ — ولا مدخلَ بلا مقاسه");
{
  const reg = require("./icons.js");
  const all = { ...reg.VZ_ICONS, ...reg.VZ_YT_ICONS, ...reg.VZ_YT_ICONS_ALL };
  const miss = Object.entries(all).filter(([, v]) => !v.viewBox).map(([k]) => k);
  ok(miss.length === 0, `كلُّ مدخلٍ يحمل مقاسَه (${Object.keys(all).length})`, miss.slice(0, 5).join(","));
  // ⭐ **والراسمُ يرمي على غيابه — لا يُكمل بمقاسٍ افتراضيّ**، وهذا هو الشرط
  // الذي يجعل الفرضيّةَ مستحيلةً لا محروسة.
  let threw = false;
  try { reg.vzSvg({ d: "<path/>" }, { cls: "بلا-مقاس" }); }
  catch (e) { threw = /viewBox/.test(e.message); }
  ok(threw, "⭐⭐ والراسمُ يرمي على أيقونةٍ بلا مقاس (لا افتراضيّ يُسكته)");
  ok(reg.vzSvg(null, {}) === "" && reg.vzIconSvg("لا-توجد") === "",
     "ومفتاحٌ مجهول يبقى فراغاً صامتاً — عقدٌ قائمٌ لم يتغيّر");
  const vbs = new Set(Object.values(all).map((v) => v.viewBox));
  console.log(`  · ${vbs.size} مقاساً مختلفاً في ${Object.keys(all).length} أيقونة — **ولا مشترَكَ يُفترض**`);
}

console.log("\n[5] ونسخُ الحقول المشحونة لا تتباعد عن السجلّ");
{
  // ⛔ **الحقلُ في نسخةٍ مشحونة مسموحٌ ومحروسٌ لا مُستثنى** (وهو الفرقُ عن
  // الاستثناء الصامت): `tools/` لا يُشحن، **فالنسخةُ ضرورة** — ⇒ **تُقارَن
  // قيمتُها بالسجلّ مفتاحاً مفتاحاً، فتباعدُها يُحمّر.**
  const reg = require("./icons.js");
  const all = { ...reg.VZ_ICONS, ...reg.VZ_YT_ICONS };
  const bad = [];
  for (const f of ["settings-ui.js", "content.js"]) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of src.matchAll(/"([a-zA-Z0-9_-]+)":\s*\{\s*viewBox:\s*"([^"]+)"/g)) {
      const [, key, vb] = m;
      if (all[key] && all[key].viewBox !== vb) bad.push(`${f}:${key} (${vb} ≠ ${all[key].viewBox})`);
      if (!all[key]) bad.push(`${f}:${key} — لا مدخلَ له في السجلّ`);
    }
  }
  ok(bad.length === 0, "كلُّ مقاسٍ في النسخ يطابق سجلَّه", bad.slice(0, 3).join(" · "));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
