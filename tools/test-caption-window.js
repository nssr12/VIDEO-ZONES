// Audit #52: YouTube exposes TWO caption colour settings — "background colour" (the
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يختفي مربّعُ يوتيوب الأسود خلف ترجمتي بدل أن يظهر تحت صندوقي؟»*
// text box) and "window colour" (the slab behind the whole caption window). This
// extension only ever styled the first. A user with a window colour set therefore saw
// OUR box sitting inside THEIR window: a wide slab in a colour the extension never
// chose, which stayed after disabling the extension and read as our bug.
//
// Owner decision: while custom styling is on we own the look, so the window is made
// fully transparent and our background setting is the only visible background.
//
// THE ASSERTION THAT MATTERS MOST is the mirror of that: with custom styling OFF, our
// rules must have ZERO effect on captions in ANY context — window included — so the
// user's YouTube window colour comes back exactly as they set it, with no residue.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const OPTS_HTML = fs.readFileSync("options.html", "utf8");
const head = SRC.indexOf("// YouTube's homepage/search hover preview");
const tail = SRC.indexOf("function applySubtitleTrack");
if (head === -1 || tail === -1) {
  console.log("  ❌ تعذّر استخراج applySubtitleStyles");
  process.exit(1);
}

const BASE = { defaultLang: "ar", fontSize: 22, color: "#ffffff", bgColor: "#0000ff",
               bgOpacity: 0.6, fontFamily: "sans-serif", position: "bottom" };

function generate(sub) {
  let css = null;
  const c = {
    console, subtitleStyleEl: null, isBlockedHost: () => false, extensionActive: () => true,
    subtitleSettings: sub, hexToRgb: () => "0,0,255",
    KNOWN_PLAYER_WRAPPER_SELECTOR: "#movie_player,.html5-video-player",
    document: { createElement: () => ({ id: "", textContent: "", remove() {} }),
                documentElement: { appendChild: (el) => { css = el.textContent; } } }
  };
  vm.createContext(c);
  vm.runInContext(SRC.slice(head, tail), c);
  vm.runInContext("applySubtitleStyles()", c);
  return css || "";
}
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");

// يعزل بلوك القاعدة الذي يطابق محدّداً معيّناً
function blockFor(css, selector) {
  const clean = strip(css);
  for (const raw of clean.split("}")) {
    const [sel, body] = raw.split("{");
    if (sel && body && sel.includes(selector)) return body;
  }
  return null;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

// منذ #53 صارت النافذة هي حاملة الصندوق: نطليها بلوننا بدل تركها شفافة، وهو ما
// يطمس «لون النافذة» عند يوتيوب بنفس القوة — ومع ذلك يبقى شرط #52 قائماً: لا أثر
// باقياً عند الإطفاء، وهو ما يفحصه القسم [4].
const painted = (css, sel) => rulesOf(css).find(([s, b]) => s.includes(sel) && /background-color:rgba/.test(b));
function rulesOf(css) {
  const out = [];
  for (const raw of strip(css).replace(/@container[^{]*\{/g, "").split("}")) {
    const i = raw.indexOf("{");
    if (i !== -1) out.push([raw.slice(0, i).trim(), raw.slice(i + 1)]);
  }
  return out;
}

console.log("\n[1] التنسيق مُفعَّل ⇒ لوننا يطمس «لون النافذة» عند يوتيوب");
{
  const css = generate({ ...BASE, enabled: true, hideOnPreviews: false });
  const win = painted(css, ".caption-window");
  check("النافذة تُطلى بلوننا", !!win, rulesOf(css).map(([x]) => x.split("\n")[0]));
  check("بـ !important فيتجاوز لون نافذة يوتيوب",
    win && /background-color:rgba\(0,0,255,0\.6\) !important;/.test(win[1]), win && win[1]);
  check("والاختصار background كذلك", win && /background:rgba\(0,0,255,0\.6\) !important;/.test(win[1]));
  check("ولا صورة خلفية باقية", win && /background-image:none !important;/.test(win[1]));
  // القاعدة التي محدّدها هو الحاوية وحدها، لا التي تذكرها ضمن سلالة
  const outer = rulesOf(css).find(([sel]) => sel === "html .ytp-caption-window-container");
  check("والحاوية الخارجية تبقى شفافة فلا تصير لوحاً عريضاً",
    outer && /background-color:transparent !important;/.test(outer[1]),
    outer ? outer[1] : rulesOf(css).map(([x]) => x.split("\n")[0]));
}

console.log("\n[2] خلفيتنا هي المصدر الوحيد للخلفية المرئية");
{
  const css = generate({ ...BASE, enabled: true, hideOnPreviews: false });
  const painters = rulesOf(css).filter(([s, b]) => /caption/.test(s) && /background-color:rgba\(0,0,255/.test(b));
  check("قاعدة تلوين واحدة في مسار يوتيوب", painters.length === 1, painters.map(([x]) => x));
  const clear = rulesOf(css).find(([s, b]) => s.includes(".ytp-caption-segment") && /background-color:transparent/.test(b));
  check("وكل ما داخلها مُصفَّر صراحةً", !!clear, clear && clear[0]);
}

console.log("\n[3] لا بُعد ثابت بالبكسل في أي قاعدة من قواعدنا");
{
  const raw = strip(generate({ ...BASE, enabled: true, hideOnPreviews: true }));
  // نُسقط شروط @container أولاً: «(min-width: 0px)» شرط استعلام لا إعلان أبعاد
  const css = raw.replace(/@container[^{]*\{/g, "{");
  const dims = [...css.matchAll(/(?:^|[;{\s])(padding|margin|width|height|inset)\s*:\s*([^;]+);/g)]
    .filter((m) => /\d+px/.test(m[2]));
  check("لا padding/width/height بالبكسل", dims.length === 0, dims.map((m) => m[1] + ":" + m[2].trim()));
  check("الحشو صار em", /padding:[\d.]+em [\d.]+em !important;/.test(css), css.match(/padding:[^;]*/g));
  check("و max-width نسبية كما كانت", css.includes("max-width:90% !important;"));

  // النسبة نفسها يحكمها tools/test-caption-box.js — هنا يكفي أن الداخل مُصفَّر
  check("وحشو ما داخل النافذة صفر فلا يتراكم", /padding:0 !important;/.test(css));
}

console.log("\n[4] ⭐ التنسيق مطفأ ⇒ صفر أثر على الترجمة في أي سياق، النافذة منها");
{
  const bare = generate({ ...BASE, enabled: false, hideOnPreviews: false });
  check("لا CSS إطلاقاً — ولا حتى وسم style", bare === "", bare.slice(0, 120));

  // مع مفتاح إخفاء المعاينات وحده: بلوك الإخفاء فقط، ولا شيء غيره
  const onlyHide = strip(generate({ ...BASE, enabled: false, hideOnPreviews: true }));
  check("قاعدة الإخفاء وحدها موجودة", onlyHide.includes("display:none !important;"));
  for (const prop of ["background", "color:", "font-size", "font-family", "padding",
                      "transform", "z-index", "max-width", "text-shadow", "container-type"]) {
    check(`ولا «${prop}» في أي مكان`, !onlyHide.includes(prop), onlyHide.slice(0, 200));
  }
  check("ولا ذكر للنافذة خارج مُحدِّدات المعاينة",
    !/\.caption-window[^,\n]*\n?\s*\{/.test(onlyHide.replace(/#inline-preview-player[^,{]*,?|ytd-video-preview[^,{]*,?/g, "")),
    onlyHide.slice(0, 200));

  // ولا قاعدة واحدة تُطبَّق على مشغّل المشاهدة
  check("ولا محدّد يذكر #movie_player", !onlyHide.includes("#movie_player"));
}

console.log("\n[5] الإطفاء لا يترك أثراً — لا شيء يُكتب خارج ورقة الأنماط");
{
  // الورقة كلها تُحذف وتُعاد بناءً في كل استدعاء: لا حالة تتراكم
  const a = generate({ ...BASE, enabled: true, hideOnPreviews: true });
  const b = generate({ ...BASE, enabled: false, hideOnPreviews: true });
  const c = generate({ ...BASE, enabled: true, hideOnPreviews: true });
  check("تفعيل ⇒ إطفاء ⇒ تفعيل يُنتج نفس الورقة الأولى", a === c);
  check("والإطفاء بينهما أقصر بكثير", b.length < a.length / 3, { on: a.length, off: b.length });
  check("ولا قاعدة تمسّ مظهر الترجمة في حالة الإطفاء",
    !strip(b).includes("background") && !strip(b).includes("font-size"));
}

console.log("\n[6] الواجهة تشرح التجاوز");
{
  check("سطر توضيحي يذكر «لون النافذة»", /لون النافذة/.test(OPTS_HTML));
  check("ويذكر أن الإطفاء يعيدها", /إطفاؤه يعيد لون النافذة/.test(OPTS_HTML));
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
