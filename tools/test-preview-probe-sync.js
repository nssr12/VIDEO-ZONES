// حارس انحراف بين tools/report-preview-scope.js و content.js (مِجَسّ #94).
//
// المِجَسّ يعيش في **عالم الصفحة** فلا يستطيع استدعاء دوال سكربت المحتوى، فنسخُ
// محدّد الحاويات وحكم #58 فيه ضرورة لا خيار. وما دامت نسخةً فلها حارس: أي تغيير
// في `KNOWN_PLAYER_WRAPPER_SELECTOR` أو `VZ_FILL_RATIO` أو عمق المشي **يجب** أن
// يُسقط هذا الاختبار حتى يُنقل معه — وإلا **قاس المِجَسّ الماضي وطبع حاضراً**.
//
// وله شاهدا قرار 26/47: مصدرٌ مُفتعَل منحرف **يجب أن يُحمّره**، والحقيقيّ يمرّ.
const fs = require("fs");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

const squash = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1")
  .replace(/\s+/g, "");

// ── المقارنات كلُّها دوالّ على (مصدر المنتج، مصدر المِجَسّ) ─────────────────
// **فيُستطاع تشغيلها على مصدرٍ مُفتعَل**، وهو ما يجعل الشاهد ممكناً أصلاً.
function selectorOf(src, name) {
  const m = src.match(new RegExp("const\\s+" + name + "\\s*=([\\s\\S]*?);"));
  if (!m) return null;
  const parts = [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
  return parts.length ? parts.join("") : null;
}
const numberOf = (src, re) => (src.match(re) || [])[1] || null;

function compare(content, probe) {
  const cSel = selectorOf(content, "KNOWN_PLAYER_WRAPPER_SELECTOR");
  const pSel = selectorOf(probe, "KNOWN");
  const cs = squash(content), ps = squash(probe);
  return {
    cSel, pSel,
    selEqual: !!cSel && cSel === pSel,
    cFill: numberOf(cs, /constVZ_FILL_RATIO=([\d.]+)/),
    pFill: numberOf(ps, /constFILL=([\d.]+)/),
    cDepth: numberOf(cs, /constFS_CONTAINER_MAX_DEPTH=(\d+)/),
    pDepth: numberOf(ps, /constMAXD=(\d+)/),
    // نصّ حكم «يشبه مشغّلاً» — التعبير النمطي نفسه حرفياً
    cRe: (cs.match(/\/player\|video\|controls\|overlay\|container\/i/) || [])[0],
    pRe: (ps.match(/\/player\|video\|controls\|overlay\|container\/i/) || [])[0]
  };
}

const CONTENT = fs.readFileSync("content.js", "utf8");
const PROBE = fs.readFileSync("tools/report-preview-scope.js", "utf8");
const real = compare(CONTENT, PROBE);

console.log("\n[1] محدّد الحاويات المعروفة متطابق نصّاً");
check("موجود في content.js", !!real.cSel, real.cSel);
check("وموجود في المِجَسّ", !!real.pSel, real.pSel);
check("ومتطابقان", real.selEqual, `${real.cSel} ≠ ${real.pSel}`);

console.log("\n[2] ثوابت حكم #58 متطابقة");
check(`نسبة الملء (${real.cFill} = ${real.pFill})`, !!real.cFill && real.cFill === real.pFill);
check(`عمق المشي (${real.cDepth} = ${real.pDepth})`, !!real.cDepth && real.cDepth === real.pDepth);
check("وتعبير «يشبه مشغّلاً» نفسه حرفياً", !!real.cRe && real.cRe === real.pRe, `${real.cRe} ≠ ${real.pRe}`);

// ── شرط «مرئيّ» المقيس (`S7`) — أربعة لا ثلاثة ──────────────────────────────
console.log("\n[3] «مرئيّ» في المِجَسّ يحمل شروطه الأربعة");
{
  const ps = squash(PROBE);
  check("عرض (display)", /cs\.display!=="none"/.test(ps));
  check("ورؤية (visibility)", /cs\.visibility!=="hidden"/.test(ps));
  check("وشفافية فعّالة عبر السلسلة", /effOpacity\(el\)>0/.test(ps) && /o\*=Number\(getComputedStyle\(n\)\.opacity\)/.test(ps));
  check("ومستطيل غير صفريّ", /r\.width>0&&r\.height>0/.test(ps));
}

// ── الحسم بـ`contains` لا بالنظر (أمر المالك) ───────────────────────────────
console.log("\n[4] الداخل والخارج يُحسمان بـ`contains`");
check("`scope.contains(el)` موجود في المِجَسّ", /scope&&scope\.contains\(el\)/.test(squash(PROBE)));
check("والشاهدان مطبوعان مع الرقم", /شاهد\+/.test(PROBE) && /شاهد−/.test(PROBE));
check("ولا يُطبع رقم عن حالٍ لم تُنتَج", /لم تعمل أي معاينة/.test(PROBE));

// ── شاهدا قرار 26 على الحارس نفسه ───────────────────────────────────────────
console.log("\n[5] شاهدا الحارس — يُحمّر على انحرافٍ مُفتعَل");
{
  const drifted = CONTENT.replace('".vjs-fluid";', '".vjs-fluid,.new-player";');
  const d = compare(drifted, PROBE);
  check("انحراف المحدّد يُحمّر", d.selEqual === false, JSON.stringify(d.pSel));

  const driftedFill = CONTENT.replace(/const VZ_FILL_RATIO = 0\.95;/, "const VZ_FILL_RATIO = 0.9;");
  const d2 = compare(driftedFill, PROBE);
  check("وانحراف نسبة الملء يُحمّر", d2.cFill !== d2.pFill, `${d2.cFill} / ${d2.pFill}`);

  // شاهد موجب: المصدر الحقيقيّ **يمرّ** — وإلا كان الحارس يُحمّر على كل شيء
  check("والمصدر الحقيقيّ يمرّ", real.selEqual && real.cFill === real.pFill && real.cDepth === real.pDepth);
}

console.log(`\nنجح ${pass} / فشل ${fail}`);
process.exit(fail ? 1 : 0);
