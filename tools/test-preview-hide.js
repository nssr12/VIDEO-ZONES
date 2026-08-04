// Audit #51: a setting to hide captions entirely on YouTube's homepage/search hover
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تختفي الترجمة عن معاينات الصفحة الرئيسية كما طلبتُ؟»*
// previews, ON by default.
//
// Two properties this test exists to protect:
//   1. It hides the CAPTIONS THEMSELVES, not merely our styling — the rule targets
//      YouTube's own caption container with display:none.
//   2. It reaches previews ONLY. The watch page, theater mode and fullscreen must be
//      untouchable by this switch, so the selectors may never contain a player id or
//      class that those modes use.
// Plus: it is independent of the "custom caption styling" toggle — someone who turned
// styling off still gets preview hiding.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const OPTS_JS = fs.readFileSync("options.js", "utf8");
const OPTS_HTML = fs.readFileSync("options.html", "utf8");

const head = SRC.indexOf("// YouTube's homepage/search hover preview");
const tail = SRC.indexOf("function applySubtitleTrack");
if (head === -1 || tail === -1 || !SRC.includes("hideOnPreviews")) {
  console.log("  ❌ hideOnPreviews غير موجود — البند #51 غير منفَّذ");
  process.exit(1);
}

const BASE = { enabled: true, defaultLang: "ar", fontSize: 22, color: "#fff",
               bgColor: "#000", bgOpacity: 0.6, fontFamily: "sans-serif", position: "bottom" };

function generate(sub, { blocked = false } = {}) {
  let css = null;
  const c = {
    console, subtitleStyleEl: null, isBlockedHost: () => blocked, extensionActive: () => !blocked,
    subtitleSettings: sub, hexToRgb: () => "0,0,0",
    KNOWN_PLAYER_WRAPPER_SELECTOR: "#movie_player,.html5-video-player",
    document: { createElement: () => ({ id: "", textContent: "", remove() {} }),
                documentElement: { appendChild: (el) => { css = el.textContent; } } }
  };
  vm.createContext(c);
  vm.runInContext(SRC.slice(head, tail), c);
  vm.runInContext("applySubtitleStyles()", c);
  return css || "";
}

// يستخرج بلوك الإخفاء وحده لفحص محدّداته
function hideBlock(css) {
  const i = css.indexOf("display:none !important;");
  if (i === -1) return null;
  const open = css.lastIndexOf("{", i);
  let start = open;
  while (start > 0 && css[start - 1] !== "}" && css.lastIndexOf("*/", start) !== start - 2) start--;
  return css.slice(css.lastIndexOf("\n", css.lastIndexOf(",", open) > 0 ? css.indexOf("html", css.lastIndexOf("*/", open)) : open) , css.indexOf("}", i) + 1);
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log("\n[1] مُفعَّل افتراضياً — الغياب يعني إخفاء");
{
  const c = generate({ ...BASE, hideOnPreviews: true });
  check("القاعدة موجودة عند التفعيل", c.includes("display:none !important;"));

  const off = generate({ ...BASE, hideOnPreviews: false });
  check("وغائبة عند التعطيل", !off.includes("display:none !important;"));

  check("الافتراضي في content.js هو true (‎!== false)", SRC.includes("hideOnPreviews: sub.hideOnPreviews !== false"));
  check("والافتراضي في options.js هو true",
    /hideOnPreviews !== "boolean"\) s\.hideOnPreviews = true;/.test(OPTS_JS));
}

console.log("\n[2] يُخفي الترجمة نفسها لا تنسيقنا وحده");
{
  const c = generate({ ...BASE, hideOnPreviews: true });
  check("يستهدف حاوية ترجمة يوتيوب نفسها", c.includes(".ytp-caption-window-container") && c.includes("display:none"));
  check("و caption-window كذلك", c.includes(".caption-window"));
  check("بـ display:none لا بتغيير حجم أو لون", /display:none !important;/.test(c));
}

console.log("\n[3] المعاينات وحدها — لا مساس بالمشاهدة ولا المسرح ولا ملء الشاشة");
{
  const c = generate({ ...BASE, hideOnPreviews: true });
  // كل سطر فيه محدّد إخفاء يجب أن يذكر مُحدِّد معاينة
  const lines = c.split("\n");
  const hideIdx = lines.findIndex((l) => l.includes("display:none !important;"));
  const selectors = [];
  for (let i = hideIdx - 1; i >= 0; i--) {
    const l = lines[i].trim();
    if (l.endsWith("{")) { selectors.push(l.replace("{", "").trim()); break; }
    if (l.startsWith("html")) selectors.push(l.replace(/,$/, "").trim());
    else if (l === "" || l.startsWith("/*") || l.startsWith("*")) break;
  }
  check("وُجدت محدّدات الإخفاء", selectors.length > 0, selectors);
  const previewOnly = selectors.every((sel) =>
    sel.includes("#inline-preview-player") || sel.includes("ytd-video-preview"));
  check("كل محدّد إخفاء مقيَّد بمُحدِّد معاينة", previewOnly, selectors);
  check("ولا محدّد إخفاء يذكر #movie_player", !selectors.some((s) => s.includes("#movie_player")), selectors);
  check("ولا .html5-video-player المجرّدة",
    !selectors.some((s) => /\.html5-video-player(?![\w-])/.test(s)), selectors);
  check("ولا :fullscreen أو المسرح", !selectors.some((s) => /fullscreen|theater/i.test(s)), selectors);
}

console.log("\n[4] مستقل عن مفتاح تنسيق الترجمة");
{
  const styleOff = generate({ ...BASE, enabled: false, hideOnPreviews: true });
  check("التنسيق مطفأ والإخفاء مفعّل ⇒ الإخفاء يعمل", styleOff.includes("display:none !important;"), styleOff.slice(0, 120));
  check("وبلا أي قاعدة تنسيق", !styleOff.includes("font-size:"), styleOff.slice(0, 200));

  const bothOff = generate({ ...BASE, enabled: false, hideOnPreviews: false });
  check("الاثنان مطفآن ⇒ لا CSS إطلاقاً", bothOff === "", bothOff.slice(0, 80));

  const both = generate({ ...BASE, enabled: true, hideOnPreviews: true });
  check("الاثنان مفعّلان ⇒ إخفاء + تنسيق معاً",
    both.includes("display:none !important;") && both.includes("font-size:"));
}

console.log("\n[5] الموقع المحظور يمنع كل شيء");
{
  check("محظور ⇒ لا CSS ولو كان الإخفاء مفعّلاً",
    generate({ ...BASE, hideOnPreviews: true }, { blocked: true }) === "");
}

console.log("\n[6] توصيل الواجهة");
{
  check("مربع الاختيار موجود في options.html", OPTS_HTML.includes('id="subHidePreviews"'));
  check("ونصّه يذكر المعاينات", /إخفاء الترجمة في معاينات/.test(OPTS_HTML));
  check("ويُقرأ عند العرض", OPTS_JS.includes('$("subHidePreviews").checked = sub.hideOnPreviews !== false'));
  check("ويُحفظ عند التغيير", OPTS_JS.includes('hideOnPreviews: $("subHidePreviews").checked'));
  check("والتبديل يحفظ فوراً", OPTS_JS.includes('$("subHidePreviews").addEventListener("change", persistSubtitles)'));
  check("ولا يُفعّل تنسيق الترجمة من تلقائه",
    !/for \(const id of \[[^\]]*subHidePreviews/.test(OPTS_JS));
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
