// يحرس أن الأربع الميتة في التضمين تقول ذلك في وسومها — وأن العدّ لا يتفرّق.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«أضبط لغة الترجمة والجودة و Clean
// Player على فيديو يوتيوب مضمَّنٍ في مدوّنة، فلا يقع شيء ولا تخبرني الواجهة أنه
// لن يقع — فأظنّ العطبَ فيّ أو في إعدادي. أتقول لي الواجهة أين يعمل هذا وأين
// لا يعمل؟»*
//
// ── لماذا وُجد (قرار المالك 2026-08-04، بعد `S10` و`S9`) ────────────────────
// **أربعُ ميزاتٍ قِيس أنها لا تعمل في التضمين، ووسومُها لا تقول ذلك** — وهي
// **«اسمٌ يَعِد بما لا يفعل» بعينها**، وقد صُرف #66 و#67 في إزالتها.
// ⛔ **والقرار: لا تُبنى التغطية (#68ب يبقى مؤجَّلاً) — بل يُصحَّح الوعد.**
// ⇒ **فالوسمُ بنيةٌ لا نثر**: `data-vz-embed="<مفتاح>"`، **وسقوطُ مفتاحٍ يُحمّر**.
//
// ⚠️ **وحدُّه مُعلَن:** يفحص **وجودَ الوسم وذِكرَه التضمينَ**، لا جودةَ صياغته
// — **وجودةُ الصياغة حكمٌ بشريّ**، ولا يُدَّعى أن هذا الحارس يضمنها.
// ⚠️ **ولا يقيس المنتَجَ حيّاً**: أن الميزة ميتةٌ في التضمين **مقيسٌ في
// `tools/bench-s10-embed.mjs`** لا هنا. **هذا يحرس أن ما قِيس قيل للمستخدم.**
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ── الأربعُ ومواضعُها — **الموضع الواحد لهذي الحقيقة** ─────────────────────
// المفتاح ⇒ { الملفّ · مُرساةُ الضابط الذي يخصّه · ما يجب أن يُذكر }
const PROMISES = {
  quality:        { file: "options.html", anchor: 'id="ytQuality"' },
  cleanPlayer:    { file: "options.html", anchor: 'id="cleanPlayerEnabled"' },
  subtitles:      { file: "options.html", anchor: 'id="subEnabled"' },
  subLang:        { file: "options.html", anchor: 'id="subLang"' },
  popupSubtitles: { file: "popup.html",   anchor: 'id="subtitlesEnabled"' }
};
const MUST_SAY = "المضمَّن";

const html = { "options.html": read("options.html"), "popup.html": read("popup.html") };

console.log(`\n[1] كلُّ وعدٍ يحمل وسمَه — ${Object.keys(PROMISES).length} مفاتيح`);
{
  for (const [key, p] of Object.entries(PROMISES)) {
    const hits = (html[p.file].match(new RegExp(`data-vz-embed="${key}"`, "g")) || []).length;
    check(`\`${key}\` في ${p.file} — مرّةً واحدة`, hits === 1, `وُجد ${hits}`);
  }
  // **ولا مفتاحَ زائدٌ بلا سجلّ** — فالسجلّ أعلاه هو الموضع الواحد، لا قائمةٌ
  // تُحصي ما في الملفّ. مفتاحٌ يُضاف في الوسم ولا يُضاف هنا **يُحمَّر**.
  const all = [...Object.values(html).join("\n").matchAll(/data-vz-embed="([^"]+)"/g)].map((m) => m[1]);
  const orphan = all.filter((k) => !PROMISES[k]);
  check("ولا وسمَ بلا سجلّ في هذا الحارس", orphan.length === 0, orphan.join(" · "));
  check("ولا تكرارَ في الوسوم كلِّها", new Set(all).size === all.length, all.join(" · "));
}

console.log("\n[2] وكلُّ وسمٍ يقول أين لا يعمل — لا مجرّد وجوده");
{
  for (const [key, p] of Object.entries(PROMISES)) {
    // النصّ من فتحة الوسم إلى إغلاق عنصره — يكفي مدىً محافظاً
    const i = html[p.file].indexOf(`data-vz-embed="${key}"`);
    const span = i === -1 ? "" : html[p.file].slice(i, i + 460);
    check(`\`${key}\` يذكر «${MUST_SAY}»`, span.includes(MUST_SAY), span.slice(0, 80));
  }
}

console.log("\n[3] والوسمُ عند ضابطه لا في زاويةٍ من الصفحة");
{
  // ⚠️ **وسمٌ صادق في مكانٍ لا يراه من يضبط الضابط وسمٌ لا يُقرأ.** فيُشترط أن
  // يقع في **نفس القسم**: بين مُرساة الضابط ونهاية `</section>` التي تليه.
  for (const [key, p] of Object.entries(PROMISES)) {
    const src = html[p.file];
    const a = src.indexOf(p.anchor);
    const tag = src.indexOf(`data-vz-embed="${key}"`);
    const end = p.file === "popup.html"
      ? (a === -1 ? -1 : src.indexOf("</div>", src.indexOf("toggleRow", a)))
      : (a === -1 ? -1 : src.indexOf("</section>", a));
    const near = a !== -1 && tag !== -1 && Math.abs(tag - a) < 3000 &&
                 (end === -1 || tag < end + 400);
    check(`\`${key}\` قريبٌ من \`${p.anchor}\``, near, `مُرساة=${a} وسم=${tag}`);
  }
}

console.log("\n[4] والتوثيق يقولها كما تقولها الواجهة (قرار المالك: الوسوم والتوثيق معاً)");
{
  const claude = read("CLAUDE.md"), readme = read("README.md");
  check("`CLAUDE.md` فيه جدولُ الأربع", /Four features that are dead in the YouTube embed/.test(claude));
  for (const key of Object.keys(PROMISES)) {
    if (key === "popupSubtitles") continue;   // الوسم نفسه، والجدول يذكر الميزة مرّةً
    check(`  ويذكر \`${key}\``, claude.includes(`\`${key}\``), "غائبٌ من CLAUDE.md");
  }
  check("ويذكر أن #68ب يبقى مؤجَّلاً", /#68ب stays deferred/.test(claude));
  check("ويذكر أن العلّتين قِيستا منفصلتين", /isolates one of them/.test(claude));
  check("و`README.md` يقول إن الأربع لا تعمل في التضمين",
    /لا تعمل[\s\S]{0,90}مشغّل يوتيوب المضمَّن/.test(readme));
  check("ولا يَعِد البوب-أب بـ«جميع المواقع»", !html["popup.html"].includes("الترجمة على جميع المواقع"));
}

console.log("\n[5] شاهدا قرار 26 — على الحارس نفسه");
{
  const has = (s, k) => (s.match(new RegExp(`data-vz-embed="${k}"`, "g")) || []).length === 1;
  check("موجب: نصٌّ فيه الوسم يُقبل", has('<p data-vz-embed="quality">x</p>', "quality"));
  check("سالب: ونصٌّ بلا وسمٍ يُرفض", !has("<p>الجودة الافتراضية</p>", "quality"));
  check("وثالث: ووسمٌ بلا ذكر «المضمَّن» يُرفض في [2]",
    !'<p data-vz-embed="quality">صفحة المشاهدة</p>'.includes(MUST_SAY));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
