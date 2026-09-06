// البندان #148 · #149 — المشغّلُ المصغّر: منعُ اختصارات الفأرة والأزرار عنه.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«في المشغّل المصغّر الذي يُتابع
// آخرَ مقطعٍ أسفلَ صفحة يوتيوب — أتكفّ اختصاراتُ الفأرة وأزرارُنا عنه، وتبقى
// شبكةُ المربّعات تعمل بالعجلة؟ وهل يبقى مشغّلُ صفحة المشاهدة كما هو؟»*
//
// ⛔⭐⭐ **والفصلُ ليس بالمشغّل بل بالسلف**: `#movie_player` هو **العنصرُ نفسُه**
// في الحالين — **يوتيوب ينقله نقلاً** — **و`<ytd-miniplayer>` موجودٌ في صفحة
// المشاهدة أيضاً** (مقيسٌ في لقطة الشجرة: مرّتان) ⇒ **فالاحتواءُ هو السؤال لا
// الوجود.**
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));
const slice = (from, to) => {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return SRC.slice(a, b);
};
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

console.log("\n[1] الاحتواءُ هو السؤال — لا الوجود ولا المشغّل");
{
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(slice("const MINI_PLAYER_SELECTOR", "// ── البند"), ctx);
  const f = ctx.isInMiniPlayer;

  // شجرةٌ صغيرة: كلُّ عقدةٍ تعرف `closest` بالوسم
  const node = (tag, parent) => {
    const n = { tagName: tag.toUpperCase(), parentElement: parent || null };
    n.closest = (sel) => {
      for (let p = n; p; p = p.parentElement) if (p.tagName === sel.toUpperCase()) return p;
      return null;
    };
    return n;
  };
  const page = node("DIV");
  const mini = node("YTD-MINIPLAYER", page);
  const player = node("DIV", mini);         // #movie_player داخل المصغّر
  const vMini = node("VIDEO", player);
  const watchPlayer = node("DIV", page);    // **المشغّلُ نفسُه لو كان في المشاهدة**
  const vWatch = node("VIDEO", watchPlayer);

  check("فيديو داخل المصغّر ⇒ نعم", f(vMini) === true);
  check("⭐ والمشغّلُ نفسُه خارجَه ⇒ لا (والوسمُ موجودٌ في الصفحة)", f(vWatch) === false);
  check("و`null` لا ترمي", f(null) === false);
  check("وعنصرٌ بلا `closest` لا يرمي", f({}) === false);
}

console.log("\n[2] الأزرارُ الثلاثة كلُّها — ولا واحدٌ يُنسى");
{
  // ⭐ **العددُ يُقاس ولا يُكتب**: كلُّ مُظهِرٍ يسأل «أيملك أدواته؟» **يجب أن
  // يسأل «أفي مصغّر؟» معه** — فزرٌّ رابعٌ يُضاف بلا الشرط يُحمِّر هذا السطر.
  const owns = (CODE.match(/if \(!videoOwnsControls\(video\)\) on = false;/g) || []).length;
  const mini = (CODE.match(/else if \(isInMiniPlayer\(video\)\) on = false;/g) || []).length;
  check(`كلُّ مُظهِرٍ يسأل الاثنين (${owns} مُظهِراً)`, owns > 0 && owns === mini, `${owns} / ${mini}`);
  check("والثلاثةُ موجودةٌ فعلاً", owns === 3, owns);
}

console.log("\n[3] الشبكةُ تبقى تعمل — والموضعُ شرطٌ لا ترتيب");
{
  const body = CODE.slice(CODE.indexOf("function handleMouse(e) {"),
                          CODE.indexOf("function handleMouse(e) {") + 1400);
  const iZone = body.indexOf("if (zoneClickBinding(e)) return;");
  const iMini = body.indexOf("if (isInMiniPlayer(e.target)) return;");
  check("منعُ العامّ موجودٌ في مسار الفأرة", iMini > -1, iMini);
  check("⭐ وبعد طبقةِ المربّعات لا قبلها — وإلا ماتت الشبكةُ معه",
    iZone > -1 && iMini > iZone, `${iZone} / ${iMini}`);
  // ⛔ **ولا يُمنع مسارُ المربّعات نفسُه**: أمرُ المالك «اترك الشبكة تعمل بالعجلة»
  const zoneBody = CODE.slice(CODE.indexOf("function handleZoneClick(e) {"),
                              CODE.indexOf("function handleZoneClick(e) {") + 1200);
  check("⛔ ولا شرطَ مصغّرٍ في مسار المربّعات", !zoneBody.includes("isInMiniPlayer"));
  const wheel = CODE.slice(CODE.indexOf('window.addEventListener("wheel"'),
                           CODE.indexOf('window.addEventListener("wheel"') + 1200);
  check("⛔ ولا في مسار العجلة", !wheel.includes("isInMiniPlayer"));
}

console.log("\n[4] المُحدِّدُ اسمُ وسمٍ لا صنفٌ مولَّد (قرار 148)");
{
  const m = /const MINI_PLAYER_SELECTOR = "([^"]+)";/.exec(SRC);
  check("المُحدِّد معرَّف", !!m, m && m[1]);
  check("ولا نقطةَ صنفٍ فيه", !!m && !m[1].includes("."), m && m[1]);
  check("ولا حروفَ كبيرةٍ (أسماءُ البناء المولَّدة كذلك)", !!m && m[1] === m[1].toLowerCase(), m && m[1]);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
