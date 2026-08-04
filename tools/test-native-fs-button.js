// Audit #17: findNativeFullscreenButton fell back to a document-wide search when
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يُكبَّر مشغّلي أنا لا مشغّلٌ آخر في الصفحة؟»*
// the video was not inside a KNOWN_PLAYER_WRAPPER_SELECTOR, so on a page with two
// players it clicked whichever matching button came first in document order —
// the neighbour's. This test must FAIL on the pre-fix content.js.
//
// The fake DOM matches by an explicit `match` list instead of parsing CSS: the
// selector strings are unchanged data, what #17 is about is the SCOPE of the
// search, so the traversal is what gets exercised.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}
const SRC = "content.js";
const FIND = slice(SRC, "const NATIVE_FS_BUTTON_SELECTORS", "// requestFullscreen / requestPictureInPicture");

// ------------------------------------------------------------- fake DOM
const VISIBLE = { width: 640, height: 360 };
function el(tag, match = [], kids = [], rect = VISIBLE) {
  const node = {
    tagName: tag.toUpperCase(),
    __match: new Set([tag, ...match]),
    children: [],
    parentElement: null,
    getBoundingClientRect: () => ({ ...rect }),
    closest(list) {
      const wanted = list.split(",").map(s => s.trim());
      for (let p = node; p; p = p.parentElement) {
        if (wanted.some(w => p.__match.has(w))) return p;
      }
      return null;
    },
    querySelectorAll(sel) {
      const out = [];
      (function walk(n) {
        for (const c of n.children) { if (c.__match.has(sel)) out.push(c); walk(c); }
      })(node);
      return out;
    },
    querySelector(sel) { return node.querySelectorAll(sel)[0] || null; }
  };
  for (const k of kids) { k.parentElement = node; node.children.push(k); }
  return node;
}
const YT_BTN = ".ytp-fullscreen-button";
const VJS_BTN = ".vjs-fullscreen-control";

function run(video, body) {
  // document is searchable on purpose: the pre-fix code falls back to a
  // document-wide querySelector, and it has to reach the WRONG button so the
  // failure is visible instead of a TypeError.
  const doc = el("#document", [], [body]);
  doc.body = body;
  const ctx = {
    KNOWN_PLAYER_WRAPPER_SELECTOR: "#movie_player,.html5-video-player,.video-player,.jw-wrapper,.video-js,.plyr,.vjs-fluid",
    document: doc,
    console
  };
  vm.createContext(ctx);
  vm.runInContext(FIND, ctx);
  return ctx.findNativeFullscreenButton(video);
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

console.log("\n[1] مشغّلان على الصفحة — لا يُضغط زر الجار");
{
  const btnA = el("button", [VJS_BTN]);
  const vidA = el("video");
  const playerA = el("div", [], [vidA, btnA]);       // مشغّل غير معروف

  const btnB = el("button", [VJS_BTN]);
  const vidB = el("video");
  const playerB = el("div", [], [vidB, btnB]);

  // A أولاً في ترتيب المستند — فالبحث الكامل كان يُرجع زر A دائماً
  const body = el("body", [], [playerA, playerB]);

  check("الفيديو الأول ← زر مشغّله", run(vidA, body) === btnA);
  check("الفيديو الثاني ← زر مشغّله لا زر الأول", run(vidB, body) === btnB,
    run(vidB, body) === btnA ? "أرجع زر المشغّل الأول" : "");
}

console.log("\n[2] حاوية مشغّل معروفة — البحث محصور فيها");
{
  const btnMine = el("button", [YT_BTN]);
  const vid = el("video");
  const mine = el("div", ["#movie_player"], [vid, btnMine]);
  const btnOther = el("button", [YT_BTN]);
  const other = el("div", ["#movie_player"], [el("video"), btnOther]);
  const body = el("body", [], [other, mine]);   // الجار أولاً في ترتيب المستند
  check("يُرجع زر حاويته هو", run(vid, body) === btnMine,
    run(vid, body) === btnOther ? "أرجع زر الجار" : "");
}

console.log("\n[3] مشغّل غير معروف — أقرب سلف يحمل الزر");
{
  const btn = el("button", [VJS_BTN]);
  const vid = el("video");
  const inner = el("div", [], [vid]);
  const wrap = el("div", [], [inner, btn]);
  const body = el("body", [], [wrap]);
  check("يصعد حتى يجده", run(vid, body) === btn);
}

console.log("\n[4] لا يصل إلى <body> إطلاقاً");
{
  const strayBtn = el("button", [VJS_BTN]);          // زر عائم في الصفحة
  const vid = el("video");
  const wrap = el("div", [], [vid]);
  const body = el("body", [], [wrap, strayBtn]);
  check("زر خارج شجرة المشغّل لا يُرجَع", run(vid, body) === null, run(vid, body) && "أرجع الزر العائم");
}

console.log("\n[5] يتوقف عند أول سلف يضمّ فيديو آخر مرئياً");
{
  const btn = el("button", [VJS_BTN]);
  const vid = el("video");
  const mine = el("div", [], [vid]);
  const neighbour = el("div", [], [el("video")]);
  const common = el("div", [], [mine, neighbour, btn]);  // الزر على السلف المشترك
  const body = el("body", [], [common]);
  check("لا يُرجع زراً من سلف مشترك بين فيديوين", run(vid, body) === null,
    run(vid, body) && "تجاوز الحدّ");
}
{
  // فيديو مخفي (0×0) لا يوقف الصعود — إعلانات ومشغّلات مسبقة التحميل
  const btn = el("button", [VJS_BTN]);
  const vid = el("video");
  const mine = el("div", [], [vid]);
  const hidden = el("video", [], [], { width: 0, height: 0 });
  const common = el("div", [], [mine, hidden, btn]);
  const body = el("body", [], [common]);
  check("فيديو مخفي لا يُعتبر جاراً", run(vid, body) === btn);
}

console.log("\n[6] حالات الحدود");
{
  check("بلا فيديو ⇒ null", run(null, el("body")) === null);

  const vid = el("video");
  const body = el("body", [], [el("div", [], [vid])]);
  check("لا زر في أي مكان ⇒ null", run(vid, body) === null);

  // فيديو ابن مباشر لجذر ظل: parentElement = null ⇒ لا صعود ولا انهيار
  const orphan = el("video");
  orphan.parentElement = null;
  check("فيديو بلا سلف ⇒ null بلا استثناء", run(orphan, el("body")) === null);
}
{
  // سقف العمق: زر أبعد من FS_BUTTON_MAX_DEPTH لا يُلتقط
  const btn = el("button", [VJS_BTN]);
  const vid = el("video");
  let node = el("div", [], [vid]);
  for (let i = 0; i < 10; i++) node = el("div", [], [node]);
  node.children.push(btn); btn.parentElement = node;
  const body = el("body", [], [node]);
  const cap = Number(FIND.match(/const FS_BUTTON_MAX_DEPTH = (\d+)/)?.[1] ?? 8);
  check(`لا يتجاوز سقف العمق ${cap}`, run(vid, body) === null, run(vid, body) && "تجاوز السقف");
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
