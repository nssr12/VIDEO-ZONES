// يحرس أن مِجَسّاً ينادي دالّةً من `content.js` يُقيَّم في عالم الإضافة لا الصفحة.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تقيس أدواتُنا الإضافةَ فعلاً، أم
// تقرأ `null` من عالمٍ لا تعيش فيه فتطبع أخضرَ عن شيءٍ لم تره؟»*
//
// ── ثالثُ إخوة «النطاق»، والمُطلِق واقعٌ لا مفترض (قرار 82 · 85) ─────────────
// **وقع مرّتين وعولج أثناء العمل**: `bench-98-fs-scope` قرأ `vzIdleSnapshot()`
// من **عالم الصفحة** فرجع `null`، وكذلك `bench-overlay-layer`.
// **والأخوان الأوّلان**: `test-scope-reach` (الكود المشحون) · `test-vm-scope`
// (أُطر `vm`). ⇒ **وهذا الثالث: تعبيرُ مِجَسٍّ يُقيَّم في العالم الخطأ.**
//
// ⚠️ **وشرطٌ من زلّةٍ وقعت في قياسه نفسه:** أوّلُ عدٍّ أعطى **خمسة مواضع فاسدة
// وكانت كاذبة** — **لأن المِجَسّ يُعرّف نسختَه** من `looksLikePlayer` ولا ينادي
// دالّتنا. ⇒ **فالحارس يفرّق النداء من التعريف**، وإلّا ورث العيب **فأحمرَ على
// السليم** — وهو «Rescued» من بابٍ ثانٍ: **مطابقةٌ نصّية تُنتج إثباتاً كاذباً**.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// أسماءُ دوالّ المنتج — تُقرأ منه ولا تُكتب هنا
const CONTENT_FNS = new Set(
  [...fs.readFileSync(path.join(ROOT, "content.js"), "utf8")
    .matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)].map((m) => m[1]));

// ── التحليل: ثوابتُ المِجَسّ، وما تناديه ولا تُعرّفه، وأين تُقيَّم ────────────
function analyse(src) {
  const out = [];
  for (const m of src.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*(?:\([^)]*\)\s*=>\s*)?`/g)) {
    const name = m.group ? m.group(1) : m[1];
    let i = m.index + m[0].length - 1, j = i + 1;
    while (j < src.length && !(src[j] === "`" && src[j - 1] !== "\\")) j++;
    const body = src.slice(i, j);
    // **مُنادىً ولا يُعرَّف داخل المِجَسّ** — وهو الفرق الذي أسقط أوّل عدّة
    const foreign = [...CONTENT_FNS].filter((n) =>
      new RegExp(`(?<![\\w.])${n}\\s*\\(`).test(body) &&
      !new RegExp(`(?:function|const|let|var)\\s+${n}\\b`).test(body) &&
      !new RegExp(`\\b${n}\\s*=\\s*(?:\\(|function)`).test(body));
    if (!foreign.length) continue;
    for (const u of src.matchAll(
      new RegExp(`evalIn\\(\\s*\\w+\\s*,\\s*${name}(\\([^)]*\\))?\\s*(,\\s*([^)]+))?\\)`, "g"))) {
      out.push({ probe: name, foreign, hasWorld: !!u[3] });
    }
  }
  return out;
}

const FILES = fs.readdirSync(path.join(ROOT, "tools"))
  .filter((f) => f.endsWith(".mjs"))
  .filter((f) => fs.readFileSync(path.join(ROOT, "tools", f), "utf8").includes("evalIn("));

console.log(`\n[1] مِجَسّاتُ الرِكاز — ${FILES.length} ملفاً يستعمل evalIn`);
{
  const bad = [], all = [];
  for (const f of FILES) {
    for (const r of analyse(fs.readFileSync(path.join(ROOT, "tools", f), "utf8"))) {
      all.push(r);
      if (!r.hasWorld) bad.push(`${f}: ${r.probe} ⇒ ${r.foreign.join(" · ")}`);
    }
  }
  check(`ثمّة مِجَسّاتٌ تنادي دوالَّ المنتج (${all.length} موضعاً)`, all.length > 0, all.length);
  check("وكلُّها تُقيَّم في عالم الإضافة — لا في عالم الصفحة",
    bad.length === 0, "\n     " + bad.join("\n     "));
}

console.log("\n[2] شاهدان لا واحد — والثاني هو الذي يمنع الأحمر على السليم");
{
  const anyFn = [...CONTENT_FNS][0];
  // **موجب: العطب المُفتعَل** — نداءٌ لدالّتنا بلا عالَم ⇒ يجب أن يُرى
  const broken = `const PROBE = \`(() => ${anyFn}(1))()\`;\n await evalIn(page, PROBE);`;
  const rb = analyse(broken);
  check("موجب: نداءٌ بلا عالَم يُرى", rb.length === 1 && rb[0].hasWorld === false,
    JSON.stringify(rb));

  // **سالب أوّل: المُمرَّر له عالَم يمرّ**
  const ok = `const PROBE = \`(() => ${anyFn}(1))()\`;\n await evalIn(page, PROBE, world);`;
  const ro = analyse(ok);
  check("سالب: ومُمرَّرٌ له عالَم يمرّ", ro.length === 1 && ro[0].hasWorld === true);

  // ⭐ **وسالبٌ ثانٍ — من الزلّة نفسها: المِجَسّ يُعرّف نسختَه ⇒ لا يُحمَّر**
  const own = "const PROBE = `(() => { const looksLikePlayer = (e) => !!e;" +
              " return looksLikePlayer(1); })()`;\n await evalIn(page, PROBE);";
  check("⭐ وثالث: مِجَسٌّ يُعرّف نسختَه **لا يُحمَّر** — النداء غير التعريف",
    analyse(own).length === 0, JSON.stringify(analyse(own)));

  const ownFn = "const PROBE = `(() => { function zoneRectForVideo(v) { return v; }" +
                " return zoneRectForVideo(1); })()`;\n await evalIn(page, PROBE);";
  check("ورابع: وبتعريفٍ بصيغة `function` كذلك", analyse(ownFn).length === 0);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
