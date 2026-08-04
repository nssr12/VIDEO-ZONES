// عقدُ `evalIn` مقيساً على متصفّحٍ حيّ — **لا مُمثَّلاً** (#93، 2026-08-04).
//
// ⛔ **من الثمانية — يُشغَّل قبل كل كومِت.** ويحرس: **#93** — عقدُ `evalIn`: الرمية تُقال ولا تُبتلع، و«رمى» يُفرَّق عن «أرجع undefined».
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين تقول أدواتُنا إن الإضافة سليمة،
// أهي رأت فحكمت — أم عميت فسكتت؟»*
//
//   node tools/bench-eval-contract.mjs            # الأوجه الأربعة
//   node tools/bench-eval-contract.mjs --before   # سلوكُ الدالّة **قبل** الإصلاح
//
// ── لماذا حيٌّ ولِمَ يبقى مع الحارس الوحدويّ ────────────────────────────────
// `tools/test-eval-throw.js` يُمثّل ردودَ CDP **الأربعة كما قِيست هنا**، فيحرس
// العقد قبل كل كومِت بلا متصفّح. **وهذا يُثبت أن التمثيل يصف الواقع** — فلو
// غيّر كروم شكلَ ردّه لبقي الحارس أخضرَ على ماضٍ.
// ⇒ **حارسٌ يُمثّل ولا يُقاس يحرس ظنَّنا، وقياسٌ لا يُشغَّل قبل الكومِت لا يحرس.**
//
// ── `--before` ولماذا يبقى في الأداة ───────────────────────────────────────
// **شرطُ قبول الإصلاح (قرار 47): يُرى الفرقُ على العطب نفسِه لا على شبيهٍ له.**
// فالوضعُ `--before` يُعيد المنطق السابق **حرفاً** (`return value` بلا قراءة
// الرمية) ويُشغّله على الأوجه الأربعة نفسِها — **فيُطبع القطبان جنباً إلى جنب**.
import { launch, openPage, evalIn, serveTestPage, killChrome, waitPortFree, connect }
  from "./ext-harness.mjs";

const PORT = 9953, HTTP = 8953;
const BEFORE = process.argv.includes("--before");

// **المنطق السابق حرفاً** — لا إعادةُ صياغةٍ له: شبيهٌ لا يُثبت شيئاً عن الأصل
const evalInBefore = async (c, expression) => {
  const r = await c.send("Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true, allowUnsafeEvalBlockedByCSP: true });
  return r?.result?.result?.value;
};

// ⚠️ **الأوجه الأربعة هي ما يقع في رِكازنا فعلاً، لا حالاتٌ مُصطنعة:**
// مِجَسّاتُنا إمّا `(() => {...})()` متزامنة أو `(async () => {...})()` تُنتظر،
// وأشيعُ عطبٍ فيها **مرجعٌ غير معرَّف** — وهو ما وقع في قسم [٣] بنصّه.
const FACES = [
  ["قيمةٌ سليمة            ", `({ ok: true, n: 5 })`],
  ["وعدٌ مرفوض             ", `(async () => { throw new ReferenceError("a is not defined"); })()`],
  ["رميةٌ متزامنة           ", `(() => { throw new ReferenceError("a is not defined"); })()`],
  ["مرجعٌ غير معرَّف         ", `(() => ({ v: nope.x }))()`],
  ["‏`undefined` صريحة      ", `undefined`]
];

let h = null, page = null, srv = null, rows = [];
try {
  const s = await serveTestPage(HTTP); srv = s.srv;
  // ⛔ **بلا إضافة عمداً:** السؤال عن **أداتنا** لا عن المنتَج، وتحميلُ الإضافة
  // يُدخل متغيّراً لا يخصّ العقد.
  h = await launch(PORT, { withExtension: false });
  page = await openPage(PORT, s.url);
  await new Promise((r) => setTimeout(r, 1200));

  for (const [name, expr] of FACES) {
    let row = { name, expr };
    try {
      const v = BEFORE ? await evalInBefore(page, expr) : await evalIn(page, expr);
      row.threw = false; row.value = v; row.truthy = !!v; row.type = typeof v;
    } catch (e) {
      row.threw = true; row.msg = String(e?.message || e).slice(0, 110); row.mark = !!e?.vzEvalThrew;
    }
    rows.push(row);
  }
} catch (e) {
  console.log("⚠️ تعذّر القياس: " + String(e?.message || e).slice(0, 140));
} finally {
  try { page?.ws?.close(); } catch {} killChrome(h); try { srv?.close(); } catch {}
  await waitPortFree(PORT);
}

console.log(`\n=== عقدُ \`evalIn\` — ${BEFORE ? "**السلوك السابق** (بلا قراءة الرمية)" : "السلوك الحاليّ"} ===\n`);
for (const r of rows) {
  console.log(`  ${r.name} ⇒ ` + (r.threw
    ? `**رمى** ${r.mark ? "(بعلامة `vzEvalThrew`)" : "⚠️ بلا علامة"} — ${r.msg}`
    : `أرجع ${JSON.stringify(r.value)} · النوع=${r.type} · صادقٌ في \`if\`=${r.truthy ? "**نعم** ⛔" : "لا"}`));
}

// ── الحكم: **العقدُ يُقاس بشرطين، وسقوطُ أيٍّ منهما يُخرج بـ1** ───────────────
const by = (i) => rows[i] || {};
const valueOk = by(0).threw === false && by(0).value?.n === 5;
const noSilentTruthy = rows.slice(1, 4).every((r) => r.threw === true);
// ⭐ **والثاني هو نصفُ العلّة: «رمى» و«أرجع undefined» لم يعودا شيئاً واحداً**
const separates = by(2).threw === true && by(4).threw === false && by(4).value === undefined;

console.log(`\n── الحكم`);
console.log(`   القيمةُ السليمة تمرّ            : ${valueOk ? "✅" : "❌"}`);
console.log(`   ولا رميةً تمرّ صامتة           : ${noSilentTruthy ? "✅" : "❌ **تمرّ**"}`);
console.log(`   و«رمى» ≠ «أرجع undefined»      : ${separates ? "✅" : "❌ **شيءٌ واحد**"}`);
if (BEFORE) {
  console.log(`\n   ⛔ **وهذا هو المتوقَّع من \`--before\`: يسقط الشرطان الأخيران.**` +
    ` وهو شاهدُ قرار 47 — الفرقُ يُرى على العطب نفسِه لا على شبيهٍ له.`);
  process.exit(0);
}
const ok = valueOk && noSilentTruthy && separates;
console.log(`\n⇒ ${ok ? "**العقد قائم — والرمية تُقال ولا تُبتلع**"
  : "**العقد ساقط — ولا يُصدَّق خرجُ أي أداةٍ تستعمل `evalIn`**"}\n`);
process.exit(ok ? 0 : 1);
