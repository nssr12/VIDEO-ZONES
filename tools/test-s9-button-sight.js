// يحرس أن حكم «قُتل الحدث» يُقاس بحدث الزرّ المضغوط لا بحدث الزرّ الأيسر (S9).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أربط أمراً على نقرة اليمين أو
// النقرة الوسطى، هل تُخبرني أداتُنا بالحقيقة عمّا وقع — أم تقول «نجح الحجب» عن
// نقرةٍ لم تُحجب أصلاً، فأبني على وعدٍ لم يقع؟»*
//
// ── العطب الذي كان حيّاً، ورُئي أحمرَ قبل إصلاحه (قرار 47) ──────────────────
// `tools/bench-s6-click.mjs` كان يحسم «قُتل الحدث عند window/capture» بغياب
// **`win-cap:click` وحده**. و`click` **لا يقع على زرٍّ أوسط ولا أيمن** — يقع
// `auxclick` و`contextmenu`. ⇒ **فحالات S9 الأربع كانت ستُطبع «قُتل الحدث»،
// ومنها اثنتان بلا إضافةٍ محمَّلة إطلاقاً.**
// ⇒ **إثباتٌ كاذب لا صفرٌ كاذب**: الصفرُ الكاذب يُغلق بحثاً، **والإثباتُ الكاذب
// يفتح بناءً** على ما لم يقع — وهو أخطرهما (`HANDOFF.md`، من #92).
//
// ── ولماذا حارسٌ لا تصحيحٌ صامت ────────────────────────────────────────────
// الخطأ **لا يُرى في خرج الأداة**: السطر مكتوبٌ بلغةٍ واثقة ويقرؤه القارئ حكماً.
// **ولا تُمسكه مجموعةُ الاختبارات** لأن الأداة لا تُشحن ولا تُستدعى منها.
// ⇒ **فيُحرَس نصّاً ودلالةً**: أن الخريطة موجودة، وأن الحكم يستهلكها، وأن
// وسمَ الزرّ يُشتقّ منها — **ويُحمّر على عودة الثابت المشدود**.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "tools", "bench-s6-click.mjs"), "utf8");
// السطور بلا تعليقات — فالحديث عن العطب في الرأس لا يُقرأ عطباً
const CODE = SRC.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

console.log("\n[1] خريطةُ الحدث المميِّز — موضعٌ واحد للأزرار الثلاثة");
{
  const m = CODE.match(/const\s+EVENT_BY_BUTTON\s*=\s*\{([^}]*)\}/);
  check("`EVENT_BY_BUTTON` معرَّفة", !!m);
  const body = m ? m[1] : "";
  check("والأيسر ⇒ click", /left\s*:\s*"click"/.test(body), body);
  check("والأوسط ⇒ auxclick", /middle\s*:\s*"auxclick"/.test(body), body);
  check("والأيمن ⇒ contextmenu", /right\s*:\s*"contextmenu"/.test(body), body);
}

console.log("\n[2] والحكم يستهلكها — لا وسمَ مشدوداً في `verdict`");
{
  // ⛔ **هذا هو التثبيت على العطب نفسه.** `"win-cap:click"` مكتوباً في الكود
  // خارج تعريف الخريطة هو الشكل الذي كان يكذب.
  const hard = (CODE.match(/"win-cap:click"/g) || []).length;
  check("لا `\"win-cap:click\"` مشدوداً في الكود", hard === 0, `وُجد ${hard}`);
  check("`killTag` تُشتقّ من الخريطة", /killTag\s*=\s*\(o\)\s*=>\s*"win-cap:"\s*\+\s*EVENT_BY_BUTTON\[/.test(CODE));
  check("و`blocked` تنادي `killTag`", /const\s+blocked\s*=\s*sent\s*&&\s*!has\(o,\s*killTag\(o\)\)/.test(CODE));
  check("والزرّ محفوظ في نتيجة الحالة", /out\s*=\s*\{[^}]*button:\s*c\.button\s*\|\|\s*"left"/.test(CODE));
}

console.log("\n[3] وأثرُ المضيف يُقاس بأثرٍ يخصّ ذلك الزرّ");
{
  check("الأيمن بقائمة المضيف", /btnOf\(o\)\s*===\s*"right"\)\s*return\s+menuAppeared\(o\)/.test(CODE));
  check("والأوسط بفتح تبويب", /btnOf\(o\)\s*===\s*"middle"\)\s*return\s+tabOpened\(o\)/.test(CODE));
  check("والتبويبات تُعدّ من `/json/list` لا بالعين",
    /pageTargets[\s\S]{0,220}json\/list[\s\S]{0,160}type\s*===\s*"page"/.test(CODE));
  // ⛔ **حقلٌ لم يُقرأ ليس حقلاً قُرئ فوُجد كاذباً** — وقع في هذا الملفّ نفسه:
  // سجلٌّ قديم بلا `hostMenu` طبع «✅ لا قائمة».
  check("وقائمةُ المضيف تُشترط مقروءةً (`boolean`) لا غائبةً",
    /menuRead\s*=\s*\(o,\s*when\)\s*=>\s*typeof\s+o\?\.\[when\]\?\.hostMenu\s*===\s*"boolean"/.test(CODE));
  check("والظهور يشترط «غائبةٌ قبلُ»", /menuAppeared[\s\S]{0,160}!o\.before\.hostMenu/.test(CODE));
}

console.log("\n[4] وشاهدُ كل زرّ مُنتَجٌ لا مفترَض، والحالة لا تُقرأ بلا شاهدها");
{
  check("شاهدٌ موجب للأوسط: نقرةٌ وسطى على رابط", /key:\s*"s9_mid_wit_pos"/.test(CODE));
  check("وسالبٌ له: بلا نقرة", /key:\s*"s9_mid_wit_neg"/.test(CODE));
  check("وشاهدٌ على المضيف نفسِه", /key:\s*"s9_mid_wit_host"/.test(CODE));
  check("و`--witness` يشمل شاهدَي الأوسط لا الأيسر وحده",
    /WITNESS_ONLY[\s\S]{0,220}s9_mid_wit_pos[\s\S]{0,60}s9_mid_wit_neg/.test(CODE));
  check("وحالةُ زرٍّ غير مُبصَر تُعلَن «لم تُقس» ولا يُطبع رقمُها",
    /sight\s*=\s*b\s*===\s*"middle"[\s\S]{0,200}لم تُقس/.test(CODE));
}

console.log("\n[5] شاهدا قرار 26 — على الحارس نفسه");
{
  // **موجب:** الكود السابق حرفاً (الوسم مشدوداً) **يجب أن يُحمّر**.
  const before = `const blocked = sent && !has(o, "win-cap:click");`;
  const hardHits = (before.match(/"win-cap:click"/g) || []).length;
  check("موجب: الكود السابق يُحمّر القسم [2]", hardHits > 0);
  // **سالب:** الكود الحاليّ **يجب أن يمرّ** — فلا يُحمّر الحارس على كل شيء.
  const after = `const blocked = sent && !has(o, killTag(o));`;
  check("سالب: والكود الحاليّ يمرّ", (after.match(/"win-cap:click"/g) || []).length === 0);
  // وثالث: خريطةٌ ناقصةُ زرّ تُحمَّر — فالحارس يقيس المحتوى لا الاسم
  const partial = `const EVENT_BY_BUTTON = { left: "click", middle: "auxclick" };`;
  check("وثالث: خريطةٌ بلا الأيمن تُحمَّر",
    !/right\s*:\s*"contextmenu"/.test(partial.match(/\{([^}]*)\}/)[1]));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
