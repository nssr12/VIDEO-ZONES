// يحرس أن مَن يأخذ اتّصالَه من `ext-harness` يأخذ `evalIn` منها — لا نسخةً محلّية.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين تُصلح أداةً مشترَكة، أيبلغ
// إصلاحُها كلَّ من يستعملها — أم يبقى فيها من ينسخها فيبقى على عطبه؟»*
//
// ── العلّة التي وُلد منها (#93، مقيسةٌ 2026-08-04) ──────────────────────────
// `evalIn` أُصلحت في `ext-harness.mjs` (الرمية تُقال ولا تُبتلع)، **ولم يبلغ
// الإصلاحُ قسمَ [٣] في `bench-options-page.mjs` أصلاً** — لأنه **يُعرّف نسختَه**
// منها وهو يأخذ اتّصالَه (`openPage`/`connect`) من الوحدة نفسِها.
// ⇒ ⭐ **ولو دُمج الإصلاحان لَقُرئ أخضرُه بعد الدمج إصلاحاً وهو على حاله** —
// وذاك أخطر من بقائه أحمر. **والداءُ لاحقناه في المنتج مراراً (عدّادُ التأكيدات
// في أربعة مواضع · المُولِّدان) — وهذي أوّلُ مرّةٍ يُمسك في أدواتنا.**
//
// ── ⛔ حدُّه مُعلَنٌ ولا يُوسَّع ─────────────────────────────────────────────
// **يحرس النسخة، لا الابتلاع.** ملفٌّ ينادي `Runtime.evaluate` بيده ويُرجع
// `result.result.value` بلا قراءة `exceptionDetails` **يمرّ من هنا** — وذاك صنفٌ
// آخر، **يُسمّى ولا يُدّعى أنه محروس**. ويطبع هذا الحارسُ عددَه كي لا يُنسى.
//
// ── وشاهداه (قرار 26 · 47) ─────────────────────────────────────────────────
//  · **موجب:** الصنف غيرُ فارغ — فلو صار صفراً لصار «لا أرى» يُقرأ «لا يوجد».
//  · **سالب:** عيّنةٌ مخالفة تُصنَّع فتُحمَّر، وسليمةٌ تمرّ.
//  · **وعلى العطب نفسِه لا على شبيهه** (قرار المالك):
//      git show HEAD:tools/bench-options-page.mjs > /tmp/prev.mjs
//      node tools/test-shared-eval.js /tmp/prev.mjs      # يجب أن يُحمّر
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra === undefined ? "" : String(extra).slice(0, 220)));

const DIR = path.join(__dirname);

// ── استثناءٌ واحد مُعلَنٌ بسببه — **ولا يُقبل استثناءٌ بلا سببٍ يُفحص** ───────
// «الاستثناءُ الذي يُضاف ليمرّ الحارسُ يقتله وهو حيّ» — فيُشترط أن يبقى سببُه
// قائماً في الملفّ نفسِه، وإلا سقط الاستثناء معه.
const DECLARED = {
  "bench-eval-contract.mjs": {
    ident: "evalInBefore",
    why: "نسخةُ السلوك السابق **حرفاً** — شاهدُ قرار 47 في وضع `--before`",
    stillEarned: (src) => src.includes("--before")
  }
};

// ── القاعدة، دالّةً نقيّة كي تُختبَر على عيّنةٍ كما تُختبَر على ملفّ ─────────
// **«من يُقدِّم له الاتّصالَ يُقدِّم له قارئَه»**: ملفٌّ يستورد `openPage` أو
// `connect` من `ext-harness` يتعامل مع كائن الاتّصال نفسِه الذي تقبله `evalIn`
// المشترَكة — **فنسخةٌ محلّية عنده نسخةٌ بلا سبب**. أمّا من يبني اتّصالَه بنفسه
// فخارج الصنف: توقيعُه آخر، **ويُسمّى في الخرْج ولا يُبتلع صامتاً**.
function classify(file, src) {
  const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']\.\/ext-harness\.mjs["']/g)]
    .flatMap((m) => m[1].split(",").map((s) => s.trim()).filter(Boolean));
  const declared = [...src.matchAll(/(?:^|\n)\s*(?:const|let|var|function|async function)\s+(evalIn\w*)\s*[=(]/g)]
    .map((m) => m[1]);
  return {
    file,
    usesHarnessConn: imports.includes("openPage") || imports.includes("connect"),
    importsEvalIn: imports.includes("evalIn"),
    declared
  };
}

function violations(rows) {
  const out = [];
  for (const r of rows) {
    if (!r.usesHarnessConn) continue;
    for (const ident of r.declared) {
      const d = DECLARED[r.file];
      if (d && d.ident === ident) continue;
      out.push(`${r.file}: يُعرّف \`${ident}\` وهو يأخذ اتّصالَه من ext-harness`);
    }
  }
  return out;
}

// ── وضعُ الملفّ الواحد: للإثبات على العطب نفسِه من السجلّ ────────────────────
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (args.length) {
  console.log("\n[٠] وضعُ الإثبات — على ملفٍّ بعينه");
  const rows = args.map((p) => classify(path.basename(p), fs.readFileSync(p, "utf8")));
  const v = violations(rows);
  check("الملفّ المُمرَّر يأخذ `evalIn` من الوحدة المشترَكة", v.length === 0, v.join(" · "));
  console.log(`\n${fail ? "❌" : "✅"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
}

const files = fs.readdirSync(DIR).filter((f) => /\.mjs$/.test(f) && f !== "ext-harness.mjs").sort();
const rows = files.map((f) => classify(f, fs.readFileSync(path.join(DIR, f), "utf8")));

console.log("\n[١] ⭐ لا نسخةَ محلّية عند من يأخذ اتّصالَه من الوحدة المشترَكة");
{
  const v = violations(rows);
  check("صفر نسخةٍ محلّية في الصنف", v.length === 0, v.join(" · "));

  // **ومن يستعملها يستوردها** — فلا نداءٌ لاسمٍ لا مصدرَ له في الملفّ
  const ghost = rows.filter((r) => r.usesHarnessConn && !r.importsEvalIn &&
    !r.declared.length && /\bevalIn\s*\(/.test(fs.readFileSync(path.join(DIR, r.file), "utf8")));
  check("ولا ينادي `evalIn` من لم يستوردها ولم يُعرّفها", ghost.length === 0,
    ghost.map((r) => r.file).join(", "));
}

console.log("\n[٢] شاهدا قرار 26 — على الحارس نفسِه");
{
  // **موجب: الصنف غيرُ فارغ.** حارسٌ صنفُه فارغ يطبع أخضرَ ولا يرى شيئاً —
  // «لا أرى» و«لا يوجد» يطبعان الرقم نفسه.
  const inClass = rows.filter((r) => r.usesHarnessConn);
  check(`موجب: الصنف مسكونٌ — ${inClass.length} ملفّاً يأخذ اتّصالَه من الوحدة`,
    inClass.length >= 10, inClass.length);
  check("وموجبٌ ثانٍ: والوحدةُ تُصدّر `evalIn` أصلاً",
    /export const evalIn\b/.test(fs.readFileSync(path.join(DIR, "ext-harness.mjs"), "utf8")));

  // **سالب: عيّنةٌ مخالفة تُحمَّر، وسليمةٌ تمرّ** — فالقاعدة تُميّز ولا تُجيز الكلّ
  const bad = `import { launch, openPage, killChrome } from "./ext-harness.mjs";
const evalIn = async (expr) => (await c.send("Runtime.evaluate", { expression: expr })).result;`;
  const good = `import { launch, openPage, evalIn, killChrome } from "./ext-harness.mjs";
const x = await evalIn(c, "1+1");`;
  check("سالب: عيّنةٌ تُعرّف نسختَها تُحمَّر",
    violations([classify("عيّنة-مخالفة.mjs", bad)]).length === 1);
  check("وسليمةٌ تمرّ — فالحارس يُميّز ولا يُحمّر على كلّ شيء",
    violations([classify("عيّنة-سليمة.mjs", good)]).length === 0);
}

console.log("\n[٣] والاستثناءُ المُعلَن يبقى مسنوداً — أو يسقط معه");
{
  for (const [file, d] of Object.entries(DECLARED)) {
    const p = path.join(DIR, file);
    check(`\`${file}\` ما زال موجوداً فاستثناؤه محلٌّ للفحص`, fs.existsSync(p), file);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, "utf8");
    check(`و\`${d.ident}\` ما زالت فيه — ${d.why}`,
      classify(file, src).declared.includes(d.ident));
    check("وسببُه ما زال قائماً في نصّه", d.stillEarned(src));
  }
}

// ── ⛔ الحدُّ يُطبع ولا يُدّعى أنه محروس ──────────────────────────────────────
{
  const own = rows.filter((r) => !r.usesHarnessConn && r.declared.length);
  console.log(`\n  · خارج الصنف — يبني اتّصالَه بنفسه فتوقيعُه آخر: ` +
    `${own.map((r) => r.file).join(", ") || "لا شيء"}`);
  const swallow = files.filter((f) => {
    const s = fs.readFileSync(path.join(DIR, f), "utf8");
    return /result\?*\.\s*result\?*\.\s*value/.test(s) && !/exceptionDetails/.test(s);
  });
  console.log(`  · ⛔ **وما لا يحرسه هذا الملفّ**: ابتلاعٌ بيدٍ أخرى — ` +
    `${swallow.length} ملفّاً يقرأ \`result.result.value\` بلا ذكر \`exceptionDetails\`` +
    ` (صنفٌ يُسمّى ولا يُدّعى أنه محروس)`);
}

console.log(`\n${fail ? "❌" : "✅"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
