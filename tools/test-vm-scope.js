// يحرس أن سكربتات `vm` لا تُعرّف بـ`const`/`let` ما يُقرأ بعدها من كائن السياق.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تقيس حرّاسُنا الكودَ فعلاً، أم
// تقرأ `undefined` وتطبع أخضرَ عن شيءٍ لم تره؟»* — **فحارسٌ أعمى يُجيز عطباً
// يصل المستخدم.**
//
// ── العلّة، وهي **الثانية** من نوعها ────────────────────────────────────────
// **`const` في أعلى سكربت لا يصير خاصيّةً على الكائن العام** — وقع أوّلاً في
// اختبار #57 (سجلّ النصوص قُرئ `{}` **فكان الحارس سيمرّ على كل شيء وهو لا يرى
// شيئاً**)، **ووقع ثانيةً 2026-08-04** في `test-numeric-bounds.js`:
// `const document` داخل السكربت ⇒ `ctx.document` **غير معرَّف**.
// ⇒ ⭐ **وقاعدةٌ مكتوبة لا تمنع تكراراً، والحارس يمنع** (قرار المالك 82).
//
// ⚠️ **والفرق عن `test-scope-reach.js`**: ذاك يحرس **الكود المشحون**، وهذا يحرس
// **أُطر القياس** — **وهما إخوة، وقد بُني للأوّل ولم يُجَرّ إلى جارته حتى تكرّر.**
//
// ── ما يفحصه بالضبط ─────────────────────────────────────────────────────────
// لكلّ ملفٍّ ينادي `vm.runInContext`: تُجمع أسماءُ `const`/`let` المعرَّفة **داخل**
// نصّ السكربت، ثمّ يُبحث عن قراءتها **خاصيّةً على كائن السياق** (`ctx.NAME`).
// **ودالّةٌ معرَّفةٌ في السكربت مستثناةٌ عمداً**: `function` **يصير خاصيّةً على
// الكائن العام** — وهو الفرق الذي جعل `pointerInsideEl` تُقرأ و`idleState` لا.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// أسماءُ كائنات السياق في الملفّ: `vm.createContext(X)` و`runInContext(..., X)`
function contextNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/vm\.createContext\(\s*([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/runInContext\([\s\S]{0,4000}?,\s*([A-Za-z_$][\w$]*)\s*[,)]/g)) names.add(m[1]);
  return names;
}
// نصوص السكربتات: الحرفيّات القالبية في ملفٍّ يستعمل `runInContext`
function templateBodies(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const a = src.indexOf("`", i);
    if (a === -1) break;
    let j = a + 1;
    while (j < src.length && !(src[j] === "`" && src[j - 1] !== "\\")) j++;
    out.push(src.slice(a + 1, j));
    i = j + 1;
  }
  return out;
}
function declaredInVm(src) {
  const names = new Set();
  for (const body of templateBodies(src)) {
    for (const m of body.matchAll(/^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  }
  return names;
}
// القراءة خاصيّةً على السياق — **خارج** الحرفيّات القالبية
function violations(src) {
  const ctxs = contextNames(src);
  const decl = declaredInVm(src);
  if (!ctxs.size || !decl.size) return [];
  let outside = src;
  for (const b of templateBodies(src)) outside = outside.split(b).join("\n");
  const bad = [];
  for (const c of ctxs) {
    for (const n of decl) {
      const re = new RegExp(`\\b${c}\\.${n}\\b`);
      if (re.test(outside)) bad.push(`${c}.${n}`);
    }
  }
  return bad;
}

const FILES = fs.readdirSync(path.join(ROOT, "tools"))
  .filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))
  .map((f) => path.join("tools", f))
  .filter((f) => fs.readFileSync(path.join(ROOT, f), "utf8").includes("vm.runInContext"));

console.log(`\n[1] أُطر القياس التي تستعمل vm — ${FILES.length} ملفاً`);
{
  check("ثمّة ملفّاتٌ تستعمل vm (وإلّا فالحارس بلا موضوع)", FILES.length > 0, FILES.length);
  const bad = [];
  for (const f of FILES) {
    const v = violations(fs.readFileSync(path.join(ROOT, f), "utf8"));
    if (v.length) bad.push(`${f}: ${v.join(" · ")}`);
  }
  check("ولا ملفَّ يقرأ من السياق ما عرّفه بـ`const`/`let` داخل السكربت",
    bad.length === 0, "\n     " + bad.join("\n     "));
}

console.log("\n[2] شاهدا قرار 26 — على الحارس نفسه");
{
  // **موجب:** مصدرٌ مُفتعَل فيه العطب بعينه (وهو ما وقع فعلاً) ⇒ يجب أن يُحمَّر
  const broken = `
    const ctx = { console };
    vm.createContext(ctx);
    vm.runInContext(\`
      const document = { body: null };
      function f() { return 1; }
    \`, ctx);
    ctx.document.body = 1;
  `;
  check("موجب: العطب المُفتعَل يُرى", violations(broken).includes("ctx.document"),
    JSON.stringify(violations(broken)));

  // **سالب:** الشكل الصحيح — الخاصيّة على السياق قبل التقييم ⇒ يجب أن يمرّ
  const ok = `
    const ctx = { console, document: { body: null } };
    vm.createContext(ctx);
    vm.runInContext(\`
      const KNOWN = "#x";
      function f() { return 1; }
    \`, ctx);
    ctx.document.body = 1;
  `;
  check("سالب: والشكل الصحيح يمرّ", violations(ok).length === 0, JSON.stringify(violations(ok)));

  // **وثالث:** دالّةٌ معرَّفةٌ في السكربت تُقرأ من السياق **مشروعة** ولا تُحمَّر
  const fnOk = `
    const ctx = { console };
    vm.createContext(ctx);
    vm.runInContext(\`function zoneRectForVideo(v) { return v; }\`, ctx);
    ctx.zoneRectForVideo(1);
  `;
  check("وثالث: نداءُ دالّةٍ من السياق مشروعٌ ولا يُحمَّر", violations(fnOk).length === 0);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
