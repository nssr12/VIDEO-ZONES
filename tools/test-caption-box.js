// Audit #53: the caption box was painted on THREE nested elements at once.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تخرج خلفيةُ الترجمة بالتعتيم الذي ضبطتُه، لا أغمقَ منه؟»*
//
// Our selectors `html .ytp-caption-window-container span`, `html .caption-visual-line *`
// and `html .captions-text *` all match, and .captions-text > .caption-visual-line >
// .ytp-caption-segment are nested. Measured in Chrome on the real chain: every one of
// those levels got background rgba(0,0,0,0.6) AND padding — so
//   * a 0.6 alpha stacked three deep into an effective 0.936,
//   * the horizontal padding tripled (8.01px -> ~24px a side),
//   * and each line became its own box of a different width (209px vs 142px),
//     which is the ragged, unbalanced block the owner reported.
//
// YouTube itself paints ONE box, on .ytp-caption-segment, padding `0 .25em` — measured
// live on a watch page with no extension present, at five player sizes, ratio 0.25
// horizontal / 0 vertical every time because it is em in YouTube's own stylesheet.
//
// Owner's decision: one carrier — the caption window as a whole — using YouTube's
// ratios rather than any invented number. This test guards both halves.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const head = SRC.indexOf("// YouTube's homepage/search hover preview");
const tail = SRC.indexOf("function applySubtitleTrack");
if (head === -1 || tail === -1) { console.log("  ❌ تعذّر استخراج applySubtitleStyles"); process.exit(1); }

// نسبة يوتيوب المقيسة حيّة — المرجع الذي يُقاس عليه
const YT_PAD_X_RATIO = 0.25;
const YT_PAD_Y_RATIO = 0;

const BG = "rgba(0,0,0,0.6)";
function generate(over = {}) {
  let css = null;
  const c = {
    console, subtitleStyleEl: null, isBlockedHost: () => false, extensionActive: () => true,
    subtitleSettings: { enabled: true, hideOnPreviews: false, defaultLang: "ar", fontSize: 22,
      color: "#ffffff", bgColor: "#000000", bgOpacity: 0.6, fontFamily: "sans-serif",
      position: "bottom", ...over },
    hexToRgb: () => "0,0,0",
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

// كل قاعدة كزوج [محدّدات، جسم]
function rules(css) {
  const out = [];
  for (const raw of strip(css).replace(/@container[^{]*\{/g, "").split("}")) {
    const i = raw.indexOf("{");
    if (i === -1) continue;
    out.push([raw.slice(0, i).trim(), raw.slice(i + 1)]);
  }
  return out;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

const css = generate();

console.log("\n[1] حامل واحد للصندوق — لا تراكم للخلفية");
{
  const painters = rules(css).filter(([, body]) => body.includes(BG));
  check("عدد القواعد التي تلوّن خلفية = 4 (::cue + يوتيوب + نتفلكس + JW)",
    painters.length === 4, painters.map(([s]) => s.split("\n")[0]));

  const ytPainters = painters.filter(([sel]) => /caption/.test(sel));
  check("قاعدة واحدة فقط تلوّن في مسار يوتيوب", ytPainters.length === 1, ytPainters.map(([s]) => s));
  check("وحاملها هو نافذة الترجمة ككل",
    ytPainters[0] && ytPainters[0][0].includes(".caption-window"), ytPainters[0] && ytPainters[0][0]);
  check("لا الأسطر منفردة", ytPainters[0] && !/caption-visual-line|captions-text \*/.test(ytPainters[0][0]));
}

console.log("\n[2] كل ما داخل النافذة شفاف صراحةً — يشمل خلفية يوتيوب السطرية");
{
  const clear = rules(css).find(([sel, body]) =>
    sel.includes(".ytp-caption-segment") && /background-color:transparent/.test(body));
  check("توجد قاعدة تصفير", !!clear, rules(css).map(([s]) => s.split("\n")[0]));
  for (const lvl of [".ytp-caption-segment", ".caption-visual-line *", ".captions-text *",
                     ".ytp-caption-window-container span"]) {
    check(`«${lvl}» مُصفَّر`, clear && clear[0].includes(lvl), clear && clear[0]);
  }
  check("وحشوه صفر فلا يتراكم", clear && /padding:0 !important;/.test(clear[1]), clear && clear[1]);
  check("ولا يشمل النافذة نفسها", clear && !/\.caption-window/.test(clear[0]), clear && clear[0]);
}

console.log("\n[3] النسبة = نسبة يوتيوب المقيسة، لا رقماً مخترعاً");
{
  const box = rules(css).find(([sel, body]) => sel.includes(".caption-window") && body.includes(BG));
  const pad = box && /padding:([\d.]+)em ([\d.]+)em !important;/.exec(box[1]);
  check("الحشو معبَّر بـ em", !!pad, box && box[1]);
  check(`النسبة الرأسية = ${YT_PAD_Y_RATIO}`, pad && Number(pad[1]) === YT_PAD_Y_RATIO, pad && pad[1]);
  check(`النسبة الأفقية = ${YT_PAD_X_RATIO}`, pad && Number(pad[2]) === YT_PAD_X_RATIO, pad && pad[2]);
  check("ولا أثر للنسب القديمة المشتقّة (0.091 / 0.364)",
    !css.includes("0.091") && !css.includes("0.364"));
}

console.log("\n[4] الجدول الحاكم: النسبة ثابتة على المقاسات الثلاثة وتساوي نسبة يوتيوب");
{
  const box = rules(css).find(([sel, body]) => sel.includes(".caption-window") && body.includes(BG));
  const pad = /padding:([\d.]+)em ([\d.]+)em/.exec(box[1]);
  const padYem = Number(pad[1]), padXem = Number(pad[2]);
  // حجم الخط عند كل مقاس من نفس دالة الحجم النسبي
  // نشغّل من إعلان الثابت لا من الدالة وحدها: relativeCaptionFont تعتمد عليه
  const fctx = { console };
  vm.createContext(fctx);
  vm.runInContext(SRC.slice(SRC.indexOf("const CAPTION_REFERENCE_PLAYER_W"),
    SRC.indexOf("function applySubtitleStyles")), fctx);
  const clamp = vm.runInContext("relativeCaptionFont(22)", fctx);
  const m = /clamp\(([\d.]+)px, ([\d.]+)cqw, ([\d.]+)px\)/.exec(clamp);
  const fontAt = (w) => Math.min(Number(m[3]), Math.max(Number(m[1]), Number(m[2]) * w / 100));
  console.log("     المقاس        عرض    حجم الخط   حشو أفقي   نسبتنا   يوتيوب");
  for (const [label, w] of [["معاينة", 531], ["مشاهدة", 1280], ["ملء شاشة", 1920]]) {
    const f = fontAt(w), px = padXem * f;
    console.log(`     ${label.padEnd(10)} ${String(w).padStart(5)}px ${f.toFixed(2).padStart(8)}px ${px.toFixed(2).padStart(9)}px ${padXem.toFixed(2).padStart(8)} ${String(YT_PAD_X_RATIO).padStart(8)}`);
    check(`  ${label}: النسبة الأفقية تطابق يوتيوب`, Math.abs(padXem - YT_PAD_X_RATIO) < 1e-9);
    check(`  ${label}: النسبة الرأسية تطابق يوتيوب`, Math.abs(padYem - YT_PAD_Y_RATIO) < 1e-9);
  }
  check("وعند العرض المرجعي الحشو = حشو يوتيوب بالبكسل (5.5px)",
    Math.abs(padXem * fontAt(1280) - 5.5) < 0.02, padXem * fontAt(1280));
}

console.log("\n[5] نتفلكس و JW: حامل واحد كذلك");
{
  const nf = rules(css).filter(([sel, body]) => sel.includes("player-timedtext") && body.includes(BG));
  check("نتفلكس: قاعدة تلوين واحدة", nf.length === 1, nf.map(([s]) => s));
  check("وحاملها الحاوية لا الأحفاد", nf[0] && !nf[0][0].includes("*"), nf[0] && nf[0][0]);
  const jw = rules(css).filter(([sel, body]) => sel.includes("jw-text-track") && body.includes(BG));
  check("JW: قاعدة تلوين واحدة", jw.length === 1, jw.map(([s]) => s));
  check("وحاملها الـ cue لا الأحفاد", jw[0] && !jw[0][0].includes("*"), jw[0] && jw[0][0]);
}

console.log("\n[6] النافذة تأخذ حجم الخط النسبي فتُحسب em على حجم الترجمة");
{
  check("النافذة ضمن مجموعة الحجم الاحتياطي", /html \.caption-window\b/.test(strip(css)));
  const guard = strip(css).slice(strip(css).indexOf("@container"));
  check("وضمن مجموعة الحجم النسبي داخل الحارس", guard.includes(".caption-window"), guard.slice(0, 300));
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
