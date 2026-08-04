// يحرس ألّا يُنادى اسمٌ لا يُحلّ في ملفّه — لا محذوفاً ولا غيرَ مستورَد (#101).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين تُفتح صفحةُ الإعدادات فلا تعمل،
// أو يُرفض حفظُ إعدادي بلا سبب — أهو عطبٌ في الميزة، أم اسمٌ نادى عليه كودُنا
// وليس موجوداً أصلاً فمات كلُّ ما بعده؟»*
//
// ── العلّة: عطبٌ واحد بثلاث وقائع (قرار المالك 2026-08-04، وحدُّ قرار 85) ────
// **الاسمُ يُنادى حيث لا يُحلّ**، وثلاثتُها كلّفت جلسات:
//   · **`syncSpeedBadgeRow` (#77)** — دالّةٌ **حُذفت** ونداؤها باقٍ ⇒ الصفحة ميتة.
//   · **`persistTiming` (#82)** — معرَّفةٌ **داخل دالّةٍ أخرى** والمُنادي عليا ⇒
//     `ReferenceError` عند أوّل لمسة، **فلا ضابط توقيتٍ يُحفَظ**.
//   · **`killChrome` (#100)** — **مُصدَّرةٌ وغيرُ مستورَدة** في ستّة رِكازات،
//     **21 نداءً كلُّها في `finally`** ⇒ رميةٌ حتميّة **وكرومُ لا يُقتل**.
// ⚠️ **و`node --check` تمرّ على الثلاث**: تفحص **النحو** لا المراجع وقت التشغيل.
//
// ── حدُّه مُعلَنٌ ولا يُوسَّع ────────────────────────────────────────────────
// يمسك **«الاسمُ غيرُ موجودٍ في الملفّ أصلاً»** — أي الواقعتين الأولى والثالثة.
// ⛔ **ولا يمسك الثانية** (معرَّفٌ في نطاقٍ لا يراه المُنادي): **تلك أخوه
// `tools/test-scope-reach.js`**، وهو مكتوبٌ سلفاً. **فيُعلَن التقسيم ولا يُدَّعى
// شمول.** ⚠️ **وتحليلُه نصّيّ لا شجرةُ نحو** — فقد يُخطئ في صيغةٍ لم تُجرَّب،
// **وقائمةُ العوالم أدناه هي ثمن ذلك، وتُقرأ اعترافاً لا تزييناً**.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ⚠️ **العوالمُ المعروفة — تُكتب لأن التحليل نصّيّ، وكلُّ اسمٍ هنا ثغرةٌ محتملة**
const GLOBALS = new Set([
  // JS
  "Object","Array","String","Number","Boolean","Math","JSON","Date","RegExp","Error",
  "TypeError","ReferenceError","SyntaxError","RangeError","Promise","Map","Set","WeakMap",
  "WeakSet","Symbol","Proxy","Reflect","BigInt","parseInt","parseFloat","isNaN","isFinite",
  "encodeURIComponent","decodeURIComponent","encodeURI","decodeURI","structuredClone",
  "setTimeout","clearTimeout","setInterval","clearInterval","queueMicrotask","fetch",
  "require","import","Function","eval","Intl","AbortController","URL","URLSearchParams","atob","btoa",
  // DOM / المتصفّح
  "document","window","navigator","location","history","console","alert","confirm","prompt",
  "getComputedStyle","requestAnimationFrame","cancelAnimationFrame","matchMedia","screen",
  "MutationObserver","ResizeObserver","IntersectionObserver","CustomEvent","Event","MouseEvent",
  "KeyboardEvent","WheelEvent","FocusEvent","PointerEvent","Blob","File","FileReader","Image",
  "AudioContext","webkitAudioContext","GainNode","MediaStream","WebSocket","XMLHttpRequest",
  "HTMLElement","Node","Element","DOMParser","TextEncoder","TextDecoder","performance","crypto",
  "localStorage","sessionStorage","chrome","browser","CSS","Range","Selection","ShadowRoot",
  // Node
  "process","Buffer","__dirname","__filename","module","exports","global","globalThis","importScripts","setImmediate","clearImmediate",
  "Float32Array","Uint8Array","Int16Array","Int8Array","Uint16Array","Uint32Array","Int32Array",
  "Float64Array","ArrayBuffer","DataView","CSSStyleSheet","OffscreenCanvas","Worker","Response","Request","Headers",
  // توابعُ `window` تُنادى مجرّدةً — و**عوالمُ كونسول المطوّر** في مِجَسّات اللصق
  "addEventListener","removeEventListener","dispatchEvent","scrollTo","scrollBy","postMessage",
  "open","close","focus","blur","getSelection","copy","getEventListeners","inspect","monitorEvents",
]);

const KEYWORDS = new Set(["if","for","while","switch","catch","return","typeof","instanceof",
  "new","delete","void","await","yield","function","class","do","else","try","finally","case",
  "in","of","let","const","var","export","default","throw","super","this","null","true","false","async","static","get","set"]);

// **يُجرَّد النصُّ من التعليقات والسلاسل** — فاسمٌ في شرحٍ ليس نداءً
function strip(src) {
  // ⚠️ **يُبقى سطرُ كلّ شيء مكانه:** أوّلُ صياغةٍ ابتلعت أسطرَ القوالب النصّية
  // **فانزاحت الأرقام والتصقت الرموز**، فطُبع اسمٌ من تعليقٍ نداءً — وهو الشكل
  // الذي نحرسه، واقعاً في الحارس. **فيُستبدل بالفراغ ويُحفظ السطر.**
  let out = "", i = 0; const n = src.length;
  const blank = (s) => s.replace(/[^\n]/g, " ");
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { const j = src.indexOf("\n", i); const e = j < 0 ? n : j; out += blank(src.slice(i, e)); i = e; continue; }
    if (c === "/" && d === "*") { let j = src.indexOf("*/", i + 2); j = j < 0 ? n : j + 2; out += blank(src.slice(i, j)); i = j; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; let j = i + 1;
      while (j < n && src[j] !== q) { if (src[j] === "\\") j++; j++; }
      j = Math.min(j + 1, n); out += blank(src.slice(i, j)); i = j; continue;
    }
    // ⛔ **الحرفيّةُ النمطية تُجرَّد كالسلسلة** — وبلا هذا وقع عيبان مقيسان:
    // `/(^|\\.)youtube(-nocookie)?\\.com$/` قُرئ **نداءً لـ`youtube`**،
    // **ونمطٌ فيه علامةُ اقتباس فتح سلسلةً وهميّة فابتلع تعريفاتٍ بعده**
    // فطُبعت `wiggle` و`PROBE` غيرَ معرَّفتين وهما معرَّفتان.
    // ⚠️ **والتمييزُ بين النمط والقسمة نصّياً غيرُ حاسم** — فيُعتمد ما قبله:
    // `( , = : [ ! & | ? { } ; return` أو بدايةُ سطر. **حدٌّ مُعلَن.**
    if (c === "/") {
      const prev = out.replace(/\s+$/, "").slice(-1);
      const kw = /(^|[^\w$])return\s*$/.test(out);
      if (prev === "" || kw || "(,=:[!&|?{};+-*%<>~^".includes(prev)) {
        let j = i + 1, cls = false;
        while (j < n && (cls || src[j] !== "/") && src[j] !== "\n") {
          if (src[j] === "\\") j++;
          else if (src[j] === "[") cls = true;
          else if (src[j] === "]") cls = false;
          j++;
        }
        if (src[j] === "/") { j++; while (j < n && /[gimsuyd]/.test(src[j])) j++;
          out += blank(src.slice(i, j)); i = j; continue; }
      }
    }
    out += c; i++;
  }
  return out;
}

// ما يُصرَّح به في الملفّ — بأي صيغة، فالغائبُ وحده يُبلَّغ
function declared(code) {
  const d = new Set();
  const add = (s) => { for (const x of String(s).split(/[,\s]+/)) { const m = x.match(/^[A-Za-z_$][\w$]*/); if (m) d.add(m[0]); } };
  for (const m of code.matchAll(/\b(?:function|class)\s*\*?\s*([A-Za-z_$][\w$]*)/g)) d.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) d.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) add(m[1].replace(/:/g, " "));
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]/g)) add(m[1]);
  for (const m of code.matchAll(/import\s*\{([^}]*)\}/g)) add(m[1].replace(/\bas\b/g, " "));
  for (const m of code.matchAll(/import\s+([A-Za-z_$][\w$]*)/g)) d.add(m[1]);
  // معاملات الدوالّ والسهميّة و`catch`
  for (const m of code.matchAll(/\(([^()]*)\)\s*=>/g)) add(m[1]);
  for (const m of code.matchAll(/function\s*\*?\s*[A-Za-z_$\w$]*\s*\(([^()]*)\)/g)) add(m[1]);
  for (const m of code.matchAll(/catch\s*\(([^)]*)\)/g)) add(m[1]);
  for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)) d.add(m[1]);
  for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g)) d.add(m[1]);   // طرائق الكائنات
  return d;
}

// ما يُنادى: `اسم(` ولا نقطةَ قبله — فـ`a.b()` استدعاءُ خاصيّة لا اسمٍ حرّ
function calls(code) {
  const c = new Map();
  const lines = code.split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(^|[^\w$.?])([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = m[2];
      if (KEYWORDS.has(name)) continue;
      if (!c.has(name)) c.set(name, i + 1);
    }
  });
  return c;
}

// ⭐ **نطاقُ الصفحة يُقرأ من HTML لا يُفترض** — `options.js` و`popup.js`
// سكربتاتٌ كلاسيكية، **فما تُعلنه `storage.js` و`settings-ui.js` مرئيٌّ لها
// بحكم `<script src>` في صفحتها**. ⛔ **وأوّلُ صياغةٍ لهذا الحارس فحصت كلَّ
// ملفٍّ وحده فطبعت 19 اسماً سليماً عطباً** — **وهو المقيسُ جارُ المطلوب واقعاً
// فيه**: قِيس «أمعرَّفٌ في ملفّه؟» والمطلوب «أيُحلّ عند ندائه؟».
function pageScripts(html) {
  const src = fs.readFileSync(path.join(ROOT, html), "utf8");
  return [...src.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((s) => /\.js$/.test(s));
}
const GROUPS = [];
for (const html of ["options.html", "popup.html"]) {
  try { GROUPS.push({ html, files: pageScripts(html) }); } catch {}
}
// و`background.js` عاملُ خدمةٍ يجلب بـ`importScripts`
const bgSrc = fs.readFileSync(path.join(ROOT, "background.js"), "utf8");
GROUPS.push({ html: "background.js", files: ["background.js",
  ...[...bgSrc.matchAll(/importScripts\(\s*["']([^"']+)["']/g)].map((m) => m[1])] });

const groupOf = (rel) => GROUPS.find((g) => g.files.includes(rel));

const FILES = [
  ...fs.readdirSync(ROOT).filter((f) => /\.js$/.test(f)).map((f) => f),
  ...fs.readdirSync(path.join(ROOT, "tools")).filter((f) => /\.(mjs|js)$/.test(f)).map((f) => "tools/" + f),
];

const declCache = new Map();
const declOf = (rel) => {
  if (!declCache.has(rel)) declCache.set(rel, declared(strip(fs.readFileSync(path.join(ROOT, rel), "utf8"))));
  return declCache.get(rel);
};

const bad = [];
for (const rel of FILES) {
  const code = strip(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  const g = groupOf(rel);
  // **المرئيُّ للملفّ = ما يُعلنه هو + ما تُعلنه أخواتُه في صفحته**
  const visible = new Set(declOf(rel));
  if (g) for (const sib of g.files) { try { for (const n of declOf(sib)) visible.add(n); } catch {} }
  for (const [name, line] of calls(code)) {
    if (visible.has(name) || GLOBALS.has(name)) continue;
    bad.push({ rel, name, line });
  }
}

console.log(`\n[1] كلُّ اسمٍ يُنادى يُحلّ في ملفّه — ${FILES.length} ملفّاً`);
{
  // ⛔ **تثبيتُ عطبٍ مفتوح (قرار 20):** #100 لم يُصلَح بعد — ستّةُ رِكازات تنادي
  // `killChrome` بلا استيراد. **فشلُ هذا التثبيت يعني أن #100 أُصلح، فحدّثه
  // ولا تُصلح الاختبار.**
  const known = bad.filter((b) => b.name === "killChrome");
  const other = bad.filter((b) => b.name !== "killChrome");
  check("لا اسمَ غيرَ محلولٍ خارج العطب المُثبَّت", other.length === 0,
    "\n     " + other.map((b) => `${b.rel}:${b.line} ⇒ ${b.name}`).join("\n     "));
  check("⛔ تثبيت #100: ستّةُ ملفّات تنادي `killChrome` بلا استيراد", known.length === 6,
    known.map((b) => b.rel).join(" · ") + `  (وُجد ${known.length})`);
}

console.log("\n[2] شاهدا قرار 26 — على الحارس نفسه");
{
  const probe = (src) => { const c = strip(src); const d = declared(c);
    return [...calls(c).keys()].filter((n) => !d.has(n) && !GLOBALS.has(n)); };
  // **موجب:** الوقائع الثلاث بصيغها الحقيقية
  check("موجب: نداءٌ لاسمٍ محذوف يُرى", probe(`function a(){ syncSpeedBadgeRow(1); }`).includes("syncSpeedBadgeRow"));
  check("وموجبٌ ثانٍ: نداءٌ لاسمٍ مُصدَّرٍ غير مستورَد يُرى",
    probe(`import { launch } from "./x.mjs";\ntry{}finally{ killChrome(h); }`).includes("killChrome"));
  // **سالب:** المستورَد والمعرَّف والعالميّ لا تُبلَّغ — فالحارس لا يُحمّر على كل شيء
  check("سالب: المستورَدُ لا يُبلَّغ", !probe(`import { killChrome } from "./x.mjs"; killChrome(h);`).includes("killChrome"));
  check("وسالبٌ ثانٍ: المعرَّفُ محلياً لا يُبلَّغ", !probe(`function f(){} f();`).includes("f"));
  check("وثالث: العالميُّ لا يُبلَّغ", !probe(`setTimeout(() => {}, 1); document.querySelector("x");`).length);
  check("ورابع: استدعاءُ خاصيّةٍ ليس اسماً حرّاً", !probe(`obj.method(); a?.b();`).includes("method"));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
