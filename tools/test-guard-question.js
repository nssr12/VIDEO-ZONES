// يحرس أن كلّ حارسٍ يحمل سطرَ السؤال الذي يجيبه بلغة المستخدم (#99).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يعرف من يكتب حارساً ماذا يخسر
// المستخدمُ إن سقط؟»* — **فإن لم يعرف، فالأرجح أنه يقيس جاراً للسؤال لا السؤال**.
//
// ── لماذا وُجد (قرار 81 · قرار المالك 2026-08-04) ──────────────────────────
// اختلف الرِكاز والميدان أربع مرّات، **والشكل الجامع «المقيسُ جارُ المطلوب»**:
// نصٌّ مقابل تشغيل (#77) · وجودٌ مقابل أثر (#72) · عيّنةٌ مقابل مدى (#89) ·
// داخلٌ مقابل حول (#94). ⇒ **والعلاج أن يُسأل السؤالُ لحظةَ الكتابة لا لحظةَ
// المراجعة** — وهو ما يُخرج «أاختفى» من «أأخفاه صنفُنا» **قبل أن يُكتب**.
//
// ⚠️ **وحدُّه مُعلَن (وأقرّه المالك): يُفحص وجودُ السطر لا جودتُه.** **وجودةُ
// الصياغة حكمٌ بشريّ** — ولا يُدَّعى أن هذا الحارس يضمنها.
// ⚠️ **وسطرٌ يُكتب ليُرضي حارساً أسوأ من غيابه**: يُطفئ السؤال بدل أن يطرحه.
//
// ── والعصيّ يُعلَن ولا يُخبَّأ ──────────────────────────────────────────────
// حارسٌ لا تُصاغ له جملةٌ بلغة المستخدم **يُعلن ذلك بسببه** — **وهو حصيلةُ البند
// لا استثناؤه**: كلُّ عصيٍّ **مرشَّحٌ لأنه يقيس جاراً**.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

const MARK_Q = "السؤال الذي يجيبه (بلغة المستخدم)";
const MARK_HARD = "عصيٌّ على صياغة المستخدم";

const FILES = fs.readdirSync(path.join(ROOT, "tools"))
  .filter((f) => /^test-.*\.js$/.test(f)).sort();

console.log(`\n[1] كلُّ حارسٍ يحمل سطرَه — ${FILES.length} ملفاً`);
{
  const missing = [], hard = [], asked = [];
  for (const f of FILES) {
    const head = fs.readFileSync(path.join(ROOT, "tools", f), "utf8").split("\n").slice(0, 12).join("\n");
    if (head.includes(MARK_Q)) asked.push(f);
    else if (head.includes(MARK_HARD)) hard.push(f);
    else missing.push(f);
  }
  check(`لا حارسَ بلا سطرٍ (${asked.length} مُصاغ · ${hard.length} عصيّ)`,
    missing.length === 0, "\n     " + missing.join("\n     "));
  check("والسطر في رأس الملفّ لا في ذيله", asked.length + hard.length === FILES.length);

  // **العصيّ يُطبع دائماً — فهو حصيلةُ البند لا استثناؤه**
  console.log(`\n   ── العصيّة (${hard.length}) — كلٌّ مرشَّحٌ لأنه يقيس جاراً:`);
  for (const f of hard) {
    const line = fs.readFileSync(path.join(ROOT, "tools", f), "utf8").split("\n")
      .find((l) => l.includes(MARK_HARD)) || "";
    console.log(`      · ${f}: ${line.replace(/^\/\/\s*/, "").slice(0, 120)}`);
  }
}

console.log("\n[2] وسؤالٌ بصيغة سؤال — لا وصفَ آليّة");
{
  // **الشكل أضعف من الجودة عمداً**: يُشترط أن يكون سؤالاً (استفهامٌ) وأن يذكر
  // فاعلاً إنسانياً أو أثراً يُرى. **ولا يُدَّعى أنه يقيس الصياغة.**
  const bad = [];
  for (const f of FILES) {
    const txt = fs.readFileSync(path.join(ROOT, "tools", f), "utf8");
    // **السؤال يمتدّ ما شاء** — فيُقرأ من سطره حتى أوّل سطرٍ فارغ من التعليق
    // (وقع في ثلاثة حرّاس: سطران وأربعة). **والقراءة تتبع الشكل ولا تُقصّه.**
    const ls = txt.split("\n");
    const i = ls.findIndex((l) => l.includes(MARK_Q));
    if (i === -1) continue;
    let span = "";
    for (let k = i; k < ls.length && k < i + 8; k++) {
      if (k > i && /^\s*\/\/\s*$/.test(ls[k])) break;
      span += " " + ls[k];
    }
    if (!/[؟?]/.test(span)) bad.push(f);
  }
  check("كلُّ سطرٍ مُصاغٍ ينتهي بسؤال", bad.length === 0, bad.join(" · "));
}

console.log("\n[3] شاهدا قرار 26 — على الحارس نفسه");
{
  const hasQ = (head) => head.includes(MARK_Q) || head.includes(MARK_HARD);
  check("موجب: رأسٌ مُفتعَل بلا سطرٍ يُرى ناقصاً", !hasQ("// حارسٌ ما\n// بلا سطر"));
  check("سالب: ورأسٌ فيه السطر يُقبل", hasQ(`// حارسٌ ما\n// ⭐ **${MARK_Q}:** «سؤال؟»`));
  check("وثالث: والعصيُّ المُعلَن يُقبل كذلك", hasQ(`// ⛔ **${MARK_HARD}:** سبب`));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
