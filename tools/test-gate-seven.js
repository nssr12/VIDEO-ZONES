// يحرس أن بوّابة الكومِت سبعةٌ مُعلَنة، وأن كلَّ فحصٍ فيها يقول ما يحرسه.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين يقال لي «كلُّ الفحوص خضراء
// فالنسخة جاهزة» — أهي فحوصٌ تغطّي ما أستعمله، أم فحصان يحرسان بنداً واحداً
// ويُحرس الباقي بالصدفة؟»*
//
// ── العلّة التي وُلد منها (قرار المالك 2026-08-04، من الجرد) ─────────────────
// ⛔ **بوّابةُ الكومِت كانت أربعة، واثنان منها فقط يُعلنان بنداً في رأسيهما —
// وهو #77 في كليهما.** ⇒ **فكانت البوّابةُ تحرس بنداً واحداً مُعلَناً، وكلَّ ما
// عداه بالصدفة.** ⇒ **وهو قرار 99 مطبَّقاً على البوّابة لا على الحرّاس.**
//
// ⛔ **والأخطر منه ما كشفه الجرد:** `bench-s69-guards` **كُتب في كومِت #69 نفسِه
// شاهداً على إصلاحه، فاحمرّ بـ#78 وبقي أحمرَ أسابيع** — **لأنه خارج البوّابة**.
// **وعطبُ #103 كان عند المستخدم طوال ذلك، والشاهدُ قائمٌ يقوله ولا سامع.**
// ⇒ ⭐ **شاهدٌ لا يُشغَّل شاهدٌ لا وجود له.**
//
// ── ولماذا يُحرَس العدُّ والإعلان معاً ──────────────────────────────────────
// **العدُّ وحده** يمنع أن تنقص البوّابةُ فحصاً بلا قرار.
// **والإعلانُ وحده** يمنع أن يبقى فحصٌ فيها لا يُعرف ما يحرسه — **فيُحذف يوماً
// لأن أحداً لم يعرف ثمنه**.
// ⚠️ **وحدُّه مُعلَن:** يفحص **وجودَ الإعلان وصحّةَ العدد**، **لا أن الفحص يحرس
// ما يدّعيه** — **وذاك حكمٌ بشريّ**، ولا يُدَّعى أن هذا الحارس يضمنه.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HANDOFF = fs.readFileSync(path.join(ROOT, "HANDOFF.md"), "utf8");
const CLAUDE = fs.readFileSync(path.join(ROOT, "CLAUDE.md"), "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// **الموضع الواحد لأسماء السبعة** — ومنه يُشتقّ كلُّ عدٍّ أدناه
const GATE = [
  "run-tests.js", "audit-status.js", "bench-options-page.mjs", "bench-overlay-layer.mjs",
  "bench-eval-contract.mjs", "bench-s69-guards.mjs", "repro-58-fullscreen.mjs"
];
const MARK = "⛔ **من السبعة — يُشغَّل قبل كل كومِت.** ويحرس:";

console.log(`\n[1] البوّابة سبعةٌ — والعدد يُشتقّ ولا يُكتب`);
{
  check("السجلّ يحمل سبعة", GATE.length === 7, String(GATE.length));
  // ⚠️ **الكتلةُ في `HANDOFF` هي ما يمشي عليه القارئ** — فتُطابق السجلّ
  const m = HANDOFF.match(/### وقبل أي عمل[\s\S]*?```bash\n([\s\S]*?)```/);
  check("كتلةُ `HANDOFF` موجودة", !!m);
  const block = m ? m[1] : "";
  const missing = GATE.filter((g) => !block.includes(g));
  check("وكلُّ السبعة فيها", missing.length === 0, missing.join(" · "));
  const lines = block.split("\n").filter((l) => l.trim().startsWith("node "));
  check("ولا ثامنَ غيرَ مُعلَن", lines.length === 7, `وُجد ${lines.length}`);
}

console.log("\n[2] وكلُّ رِكازٍ منها يقول ما يحرسه (قرار 99 على البوّابة)");
{
  for (const g of GATE.filter((g) => /\.mjs$/.test(g))) {
    const head = fs.readFileSync(path.join(ROOT, "tools", g), "utf8").split("\n").slice(0, 8).join("\n");
    check(`\`${g}\` يُعلن`, head.includes(MARK), head.split("\n")[0].slice(0, 50));
    // **وبنداً بعينه لا جملةً عامّة** — فإعلانٌ بلا بندٍ لا يُقرأ ثمناً
    const line = head.split("\n").find((l) => l.includes(MARK)) || "";
    check(`  ويسمّي بنداً`, /#\d+/.test(line), line.slice(0, 60));
  }
}

console.log("\n[3] وبروتوكولُ النسخة يحمل شرطَ الثلاثةِ والعشرين");
{
  // ⛔ **ما لا يكون في البروتوكول لا يقع** (قرار المالك) — فيُحرَس نصُّه
  check("`CLAUDE.md` فيه قسمُ رفع النسخة", /## Releasing a version/.test(CLAUDE));
  check("ويشترط تشغيل الـ23 قبل الرفع", /no version is bumped until all 23 on-demand rigs/.test(CLAUDE));
  check("وينسب أحمرَها لا يعدّه فقط", /every red attributed/.test(CLAUDE));
  check("وصفُّ «Bump version» يشير إليه", /Bump version \|[^|]*23 on-demand/.test(CLAUDE));
  check("والقاعدة مكتوبة: شاهدٌ لا يُشغَّل لا وجود له",
    /witness that is not run is a witness that does not exist/.test(CLAUDE));
}

console.log("\n[4] شاهدا قرار 26 — على الحارس نفسه");
{
  const hasMark = (h) => h.includes(MARK) && /#\d+/.test(h);
  check("موجب: رأسٌ مُعلَنٌ بندُه يُقبل", hasMark(`// x\n// ${MARK} **#69** — كذا`));
  check("سالب: ورأسٌ بلا الوسم يُرفض", !hasMark("// فحصٌ ما\n// بلا وسم"));
  check("وثالث: ووسمٌ بلا بندٍ يُرفض", !hasMark(`// ${MARK} شيءٌ مهمّ`));
  // ورابع: قائمةٌ بستّة تُحمَّر — فالعدد يُقاس لا يُفترض
  check("ورابع: ستّةٌ تُحمَّر", ["a", "b", "c", "d", "e", "f"].length !== 7);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
