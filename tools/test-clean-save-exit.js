// يحرس أن طريقَي حفظ Clean Player يمرّان بمخرجٍ واحد — فلا نظيرَ ينقصه نداء.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين يرفض المتصفّحُ حفظَ إعدادي
// فتظهر لي رسالةٌ حمراء — أيعود المربّعُ إلى حالته المحفوظة، أم يبقى مؤشَّراً
// فأظنّ إعدادي محفوظاً حتى أُعيد فتح الصفحة فأجده ذهب؟»*
//
// ── العلّة التي وُلد منها (#103، مقيسةٌ 2026-08-04) ─────────────────────────
// كان لِـClean Player طريقان يرفعان الحارس نفسَه: `persistCleanPlayer` (المفتاح
// الرئيسي) و`persistCleanPlayerItem` (المربّع — **أدخلها #78 بعد #69**).
// **وأولاهما تنادي `flushPendingRevert()` في `finally` والأخرى لا** ⇒ **الإرجاع
// المؤجَّل يبقى معلَّقاً إلى الأبد** والمربّع يكذب.
// **والمقيس حيّاً:** بعد الفشل `pendingRevertSeq = 2` و`cleanPlayerSaving = 0`
// **ولا مُنادي**؛ ونداءُ `flushPendingRevert()` وحدَه أوقع الإرجاع.
//
// ⚠️ **ولماذا يُحرَس العدُّ لا النداء:** حارسٌ يشترط «النداء موجود في الاثنين»
// **يمرّ على ثالثةٍ تُكتب غداً بلا نداء**. **والعدُّ يمنعها بالبناء**: موضعٌ واحد
// يرفع الحارس، وواحدٌ يُسقطه، **وفي `finally` نفسِه يقع التفريغ**.
// ⇒ **وهو درسُ البوّابة الواحدة في #64 مطبَّقاً على مخرجٍ بدل مدخل** (قرار 16ج).
//
// ⚠️ **وحدُّه مُعلَن:** يفحص **البنية** لا السلوك الحيّ — والسلوك يقيسه
// `tools/bench-s69-guards.mjs` (القسم ٣)، **وهو أحمرُ قبل هذا الإصلاح وأخضرُ
// بعده**. ⭐ **وشاهدٌ لا يُشغَّل شاهدٌ لا وجود له** (قرار المالك): ذلك القسم
// **بقي أحمرَ أسابيع لأن رِكازه ليس من الأربعة** — فهذا الحارس هنا **ليُقرأ كلَّ
// كومِت**، لا ليُغني عنه.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "options.js"), "utf8");
// بلا تعليقات — فذِكرُ العطب في الشرح لا يُقرأ عطباً
const CODE = SRC.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

console.log("\n[1] الحارس يُرفع ويُسقط في موضعٍ واحد — لا في اثنين");
{
  const up = (CODE.match(/cleanPlayerSaving\+\+/g) || []).length;
  const down = (CODE.match(/cleanPlayerSaving--/g) || []).length;
  check("موضعٌ واحد يرفعه", up === 1, `وُجد ${up}`);
  check("وموضعٌ واحد يُسقطه", down === 1, `وُجد ${down}`);
}

console.log("\n[2] والتفريغُ في `finally` الذي يُسقطه — لا في أحد الطريقين");
{
  // ⛔ **هذا هو التثبيت على العطب:** الإسقاطُ والتفريغُ متلازمان نصّاً.
  check("`cleanPlayerSaving--` يتبعها `flushPendingRevert()` مباشرةً",
    /cleanPlayerSaving--;[^\n]*\n\s*flushPendingRevert\(\);/.test(CODE));
  const m = CODE.match(/async function withCleanPlayerSave\(([\s\S]*?)\n\}/);
  check("والمخرجُ الواحد معرَّف (`withCleanPlayerSave`)", !!m);
  check("وفيه `finally`", !!m && /finally\s*\{/.test(m[1]), (m ? m[1] : "").slice(0, 60));
}

console.log("\n[3] والطريقان يستهلكانه — ولا يكتب أحدهما مخرجَه");
{
  for (const fn of ["persistCleanPlayerItem", "persistCleanPlayer"]) {
    const m = CODE.match(new RegExp(`async function ${fn}\\(([\\s\\S]*?)\\n\\}`));
    check(`\`${fn}\` ينادي المخرج الواحد`, !!m && /withCleanPlayerSave\(/.test(m[1]),
      (m ? m[1] : "لم يُعثر عليها").slice(0, 70));
    check(`  ولا يرفع الحارس بنفسه`, !!m && !/cleanPlayerSaving/.test(m[1]));
  }
}

console.log("\n[4] ولا يُبلَّغ التبويبات إلا بعد حفظٍ نجح");
{
  // ⚠️ **فرقٌ ثالث سُمّي ولم يُبتلع:** المفتاح الرئيسي كان يُبلّغ حتى عند الفشل.
  const m = CODE.match(/async function withCleanPlayerSave\(([\s\S]*?)\n\}/);
  const body = m ? m[1] : "";
  const iSave = body.indexOf("saveSettings");
  const iMsg = body.indexOf("RELOAD_CLEAN_PLAYER");
  check("الحفظُ قبل التبليغ", iSave !== -1 && iMsg !== -1 && iSave < iMsg);
  check("وفشلُه يمنع التبليغ", /if\s*\(!\(await saveSettings\(s\)\)\)\s*return false;/.test(body));
}

console.log("\n[5] شاهدا قرار 26 — على الحارس نفسه");
{
  // **موجب: الكود السابق حرفاً** — موضعان يرفعان، والتفريغ في أحدهما وحده
  const before = `
  cleanPlayerSaving++;
  try { const s = await getSettings(); if (!(await saveSettings(s))) return; } finally {
    cleanPlayerSaving--;
  }
  cleanPlayerSaving++;
  try { await saveSettings(s); } finally {
    cleanPlayerSaving--;
    flushPendingRevert();
  }`;
  check("موجب: السابقُ يحمل موضعَي رفع ⇒ يُحمّر [1]",
    (before.match(/cleanPlayerSaving\+\+/g) || []).length === 2);
  check("وموجبٌ ثانٍ: وفيه إسقاطٌ بلا تفريغ بعده",
    /cleanPlayerSaving--;[^\n]*\n\s*\}/.test(before));
  // **سالب: الحاليّ يمرّ** — فالحارس لا يُحمّر على كل شيء
  check("سالب: والحاليُّ يمرّ في الشرطين",
    (CODE.match(/cleanPlayerSaving\+\+/g) || []).length === 1 &&
    !/cleanPlayerSaving--;[^\n]*\n\s*\}/.test(CODE));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
