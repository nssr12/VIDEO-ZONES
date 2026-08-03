// يحرس ألّا تنادي دالّةٌ عُليا دالّةً معرَّفةً في نطاقٍ لا تراه.
//
// ── العلّة التي وُلد منها (البند #82، 2026-08-03) ────────────────────────────
// `buildTimingList` **عُليا** تنادي `persistTiming` **المعرَّفة داخل دالّةٍ أخرى**
// ⇒ `ReferenceError: persistTiming is not defined` **عند أوّل لمسةٍ لضابط توقيت**،
// فلا حقلَ توقيتٍ يُحفَظ أصلاً (ثمانية من ثمانية).
//
// ⭐ **وهو عَرَضُ #77 الأوّل بسببٍ مختلف — والتمييز هو الفائدة:**
// هناك **دالّةٌ حُذفت** (`syncSpeedBadgeRow`)، وهنا **دالّةٌ موجودة في نطاقٍ لا
// يُرى**. ⇒ **وقاعدة «تحقّق من وقوع كلّ استبدالٍ آليّ» تُمسك الأولى ولا تُمسك
// الثانية** — فلا شيء استُبدل هنا ولا حُذف؛ الكودُ كلُّه حاضر، والنطاق هو الخطأ.
// **ولا يُمسكه إلا حارس.** ⇒ **فلا يُظنّ أن تلك القاعدة كافية.**
//
// ⚠️ **و`node --check` تمرّ عليهما معاً** — النحو صحيح في الحالتين، والمرجع
// يُحلّ **وقت التشغيل**. وهي المرّة الثالثة التي يُقرأ فيها سكوتُ فاحصٍ سلامةً.
//
// ── ما يفحصه بالضبط ─────────────────────────────────────────────────────────
// لكلّ `function اسم` معرَّفةٍ **داخل** دالّةٍ عُليا: يُحسب مدى الدالّة الحاضنة،
// ثمّ يُبحث عن نداءٍ باسمها **خارج** ذلك المدى. وُجد ⇒ **أحمر باسم الاثنين**.
//
// ── شاهدا القبول (قرار 26) ──────────────────────────────────────────────────
// **موجب:** مصدرٌ مُفتعَل فيه العطب بعينه **يجب أن يُحمَّر**.
// **سالب:** ومصدرٌ سليم (المُنادي داخل الحاضنة) **يجب أن يمرّ** — وإلا فحارسٌ
// يُحمّر السليم يُدرَّب الناس على تجاهله.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILES = ["options.js", "popup.js", "storage.js"];
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  ❌ ${msg}`); } };

// تعرية النصوص والتعليقات كي لا تُعدّ أقواسُها ولا تُقرأ أسماؤها نداءات
function strip(src) {
  let out = "", i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") { out += src[i] === "\n" ? "\n" : " "; i++; } continue; }
    if (c === "/" && d === "*") { i += 2; out += "  "; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; } i += 2; out += "  "; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; out += " "; i++;
      while (i < n && src[i] !== q) { if (src[i] === "\\") { out += "  "; i += 2; continue; } out += src[i] === "\n" ? "\n" : " "; i++; }
      out += " "; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

// ⛔ **أوّل نسخةٍ من هذا الكاشف طبعت أخضر على العطب المقيس نفسه** — لأنها كانت
// تبحث عن حاضنةٍ **دالّةٍ مسمّاة**، و`persistTiming` تعيش داخل
// `document.addEventListener("DOMContentLoaded", async () => {` — **دالّةٌ
// سهمية**. ⇒ **النطاق الحاضن أيُّ نطاقٍ دالّيّ لا الدالّة المسمّاة وحدها**،
// وإلا فالكاشف يرى شكلاً واحداً من أشكال الحاضنة ويُسمّي عماه سلامة.

// الكلمات التي تفتح كتلةً **ليست نطاقاً دالّياً**
const BLOCK_WORDS = new Set(["if", "for", "while", "switch", "catch", "with", "else", "do", "try", "finally"]);

// يبني مكدّس النطاقات: لكلّ `{` يُقرّر أهي جسم دالّة أم كتلة تحكّم
function functionScopes(code) {
  const scopes = [];     // { start, end, fn:boolean }
  const stack = [];
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === "{") {
      // ما قبل القوس: `=>` ⇒ دالّة سهمية · `)` ⇒ نتتبّع إلى `(` ونقرأ ما قبلها
      let j = i - 1;
      while (j >= 0 && /\s/.test(code[j])) j--;
      let fn = false;
      if (j >= 1 && code[j] === ">" && code[j - 1] === "=") fn = true;
      else if (j >= 0 && code[j] === ")") {
        let d = 0, k = j;
        for (; k >= 0; k--) {
          if (code[k] === ")") d++;
          else if (code[k] === "(") { d--; if (d === 0) break; }
        }
        let p = k - 1;
        while (p >= 0 && /\s/.test(code[p])) p--;
        let word = "";
        while (p >= 0 && /[A-Za-z0-9_$]/.test(code[p])) { word = code[p] + word; p--; }
        fn = !BLOCK_WORDS.has(word);       // اسمٌ أو `function` أو دالّة مجهولة
      }
      stack.push({ start: i, fn });
    } else if (ch === "}") {
      const s = stack.pop();
      if (s) scopes.push({ start: s.start, end: i + 1, fn: s.fn });
    }
  }
  return scopes.filter((s) => s.fn);
}

// أضيق نطاقٍ دالّيّ يحوي الموضع — و`null` يعني المستوى الأعلى
function hostScope(scopes, at) {
  let best = null;
  for (const s of scopes) {
    if (at > s.start && at < s.end) {
      if (!best || (s.end - s.start) < (best.end - best.start)) best = s;
    }
  }
  return best;
}

function lineOf(code, at) { return code.slice(0, at).split("\n").length; }

function outOfScopeCalls(code) {
  const scopes = functionScopes(code);
  const bad = [];
  const decl = /(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g;
  const declared = [];
  let m;
  while ((m = decl.exec(code))) declared.push({ name: m[1], at: m.index, host: hostScope(scopes, m.index) });

  for (const f of declared) {
    if (!f.host) continue;                                   // معرَّفةٌ عُلوياً: تُرى من كل مكان
    // اسمٌ معرَّفٌ عُلوياً كذلك ⇒ النداء يُحلّ إليه، فلا عطب
    if (declared.some((d) => d.name === f.name && !d.host)) continue;
    const call = new RegExp(`(^|[^.\\w$])${f.name}\\s*\\(`, "g");
    let c;
    while ((c = call.exec(code))) {
      const at = c.index + (c[1] ? c[1].length : 0);
      if (at >= f.host.start && at < f.host.end) continue;    // داخل الحاضنة: سليم
      if (Math.abs(at - f.at) < 20) continue;                 // التعريف نفسه
      bad.push({ name: f.name, declLine: lineOf(code, f.at), callLine: lineOf(code, at) });
    }
  }
  return bad;
}

console.log("\n[1] المصدر الحقيقي — لا نداء خارج النطاق");
for (const file of FILES) {
  const code = strip(fs.readFileSync(path.join(ROOT, file), "utf8"));
  const bad = outOfScopeCalls(code);
  ok(bad.length === 0,
     `${file}: نداءٌ خارج النطاق ⇒ ReferenceError وقت التشغيل — ` +
     bad.map((b) => `\`${b.name}\` معرَّفة في السطر ${b.declLine} وتُنادى من ${b.callLine}`).join(" · "));
  if (bad.length === 0) console.log(`  · ${file}: صفر نداء خارج النطاق`);
}

console.log("\n[2] الشاهد الموجب — مصدرٌ مُفتعَل بالعطب نفسه يجب أن يُحمَّر");
{
  const fake = strip(`
function buildTimingList() { wire(() => persistTiming("x")); }
function init() {
  async function persistTiming(id) { return id; }
  persistTiming("ok");
}`);
  const bad = outOfScopeCalls(fake);
  ok(bad.length === 1 && bad[0].name === "persistTiming",
     `الحارس لم يرَ العطب في مصدرٍ مُفتعَل — **لا يُصدَّق خضاره**: ${JSON.stringify(bad)}`);
}

console.log("\n[3] الشاهد السالب — السليم يجب أن يمرّ");
{
  const okSrc = strip(`
function init() {
  async function persistTiming(id) { return id; }
  persistTiming("ok");
  wire(() => persistTiming("y"));
}
function other() { return 1; }`);
  ok(outOfScopeCalls(okSrc).length === 0,
     "الحارس حمّر نداءً داخل حاضنته — **حارسٌ يُحمّر السليم يُدرَّب الناس على تجاهله**");
  // واسمٌ عُلويّ يحمل الاسم نفسه ⇒ النداء يُحلّ إليه، فلا عطب
  const shadowed = strip(`
function persistTiming(id) { return id; }
function init() { function persistTiming(id) { return id; } }
function build() { persistTiming("x"); }`);
  ok(outOfScopeCalls(shadowed).length === 0,
     "اسمٌ معرَّفٌ عُلوياً كذلك حُسب عطباً — **والنداء يُحلّ إليه فلا عطب**");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
