// Audit #54: the four opacity sliders were labelled «شفافية» (transparency) while
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يقول وسمُ المُنزلق ما يفعله فعلاً حين أحرّكه؟»*
// every one of them measures OPACITY — 0% is fully transparent and 100% fully opaque.
//
// This is a naming defect, not a functional one: the caption slider and the three
// grid sliders always ran in the SAME direction, so there was never a contradiction
// between the two sections to migrate away. Renaming to «تعتيم» costs no migration
// and changes no stored value.
//
// So this test has two halves, and the second matters more than the first: the label
// must not say «شفافية», AND the direction must stay exactly as it was, because the
// whole justification for renaming instead of flipping is that nothing behaves
// differently afterwards.
const fs = require("fs");
const vm = require("vm");

const HTML = fs.readFileSync("options.html", "utf8");
const OPTS_JS = fs.readFileSync("options.js", "utf8");
const SRC = fs.readFileSync("content.js", "utf8");

const SLIDERS = [
  { id: "subBgOpacity",          label: "تعتيم الخلفية" },
  { id: "gridCellBgOpacity",     label: "تعتيم خلفية المربعات" },
  { id: "gridCellBorderOpacity", label: "تعتيم حدود المربعات" },
  { id: "gridNumberOpacity",     label: "تعتيم رقم المربع" }
];

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log("\n[1] لا يبقى «شفافية» في أي نصّ واجهة");
{
  check("options.html خالٍ منها تماماً", !HTML.includes("شفافية"),
    HTML.split("\n").filter((l) => l.includes("شفافية")).slice(0, 4));
  check("ويشمل ذلك نصّ الدليل لا العناوين وحدها",
    !/شفافية الرقم/.test(HTML) && /تعتيم الرقم/.test(HTML));
}

console.log("\n[2] العناوين الأربعة تقول «تعتيم»");
{
  for (const { id, label } of SLIDERS) {
    // العنوان هو الـ label الذي يحتوي المُنزلق
    const i = HTML.indexOf(`id="${id}"`);
    check(`«${id}» موجود`, i !== -1);
    const open = HTML.lastIndexOf("<label>", i);
    const text = HTML.slice(open, i);
    check(`  وعنوانه «${label}»`, text.includes(label), text.replace(/\s+/g, " ").slice(0, 70));
  }
}

console.log("\n[3] ⭐ الاتجاه لم يتغيّر — وهذا مبرّر إعادة التسمية بدل القلب");
{
  // الترجمة: قيمة المُنزلق تُقسَم على 100 وتُستعمل كـ alpha كما هي
  check("الترجمة: value/100 ⇒ alpha مباشرةً",
    /bgOpacity: Number\(\$\("subBgOpacity"\)\.value\) \/ 100/.test(OPTS_JS));
  check("وعند العرض تُضرب في 100 بلا قلب",
    /Math\.round\(\(sub\.bgOpacity \?\? 0\.6\) \* 100\)/.test(OPTS_JS));
  check("ولا طرح من 100 في أي مسار تعتيم",
    !/100\s*-\s*(Number\()?\$\("(sub|grid)\w*Opacity"\)/.test(OPTS_JS));

  // الشبكة: نفس الاتجاه عبر rgbaFrom
  const a = SRC.indexOf("const GRID_APPEARANCE_DEFAULTS");
  const b = SRC.indexOf("function applyGridVars");
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(a, b), ctx);
  check("الشبكة: 0 ⇒ transparent", ctx.rgbaFrom("#ff0000", 0) === "transparent", ctx.rgbaFrom("#ff0000", 0));
  check("الشبكة: 0.32 ⇒ alpha 0.32", ctx.rgbaFrom("#ff0000", 0.32) === "rgba(255,0,0,0.32)", ctx.rgbaFrom("#ff0000", 0.32));
  check("الشبكة: 1 ⇒ معتم", ctx.rgbaFrom("#ff0000", 1) === "rgb(255,0,0)", ctx.rgbaFrom("#ff0000", 1));
}

console.log("\n[4] القسمان في اتجاه واحد — لا تناقض يستدعي هجرة");
{
  const head = SRC.indexOf("// YouTube's homepage/search hover preview");
  const tail = SRC.indexOf("function applySubtitleTrack");
  const alphaFor = (op) => {
    let css = null;
    const c = {
      console, subtitleStyleEl: null, isBlockedHost: () => false, extensionActive: () => true,
      subtitleSettings: { enabled: true, hideOnPreviews: false, defaultLang: "ar", fontSize: 22,
        color: "#fff", bgColor: "#ff0000", bgOpacity: op, fontFamily: "sans-serif", position: "bottom" },
      hexToRgb: () => "255,0,0", KNOWN_PLAYER_WRAPPER_SELECTOR: "#movie_player",
      document: { createElement: () => ({ id: "", textContent: "", remove() {} }),
                  documentElement: { appendChild: (el) => { css = el.textContent; } } }
    };
    vm.createContext(c);
    vm.runInContext(SRC.slice(head, tail), c);
    vm.runInContext("applySubtitleStyles()", c);
    const m = /html \.caption-window \{[^}]*background-color:rgba\(255,0,0,([\d.]+)\)/
      .exec(css.replace(/\/\*[\s\S]*?\*\//g, ""));
    return m ? Number(m[1]) : null;
  };
  const a = SRC.indexOf("const GRID_APPEARANCE_DEFAULTS");
  const b = SRC.indexOf("function applyGridVars");
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(a, b), ctx);

  console.log("     القيمة   الترجمة        الشبكة");
  for (const v of [0, 0.6, 1]) {
    const sub = alphaFor(v);
    const grid = ctx.rgbaFrom("#ff0000", v);
    console.log(`     ${String(v * 100 + "%").padEnd(8)} alpha=${String(sub).padEnd(8)} ${grid}`);
  }
  check("0% شفاف في القسمين", alphaFor(0) === 0 && ctx.rgbaFrom("#ff0000", 0) === "transparent");
  check("100% معتم في القسمين", alphaFor(1) === 1 && ctx.rgbaFrom("#ff0000", 1) === "rgb(255,0,0)");
  check("والقيم الوسطى متطابقة", alphaFor(0.6) === 0.6 && ctx.rgbaFrom("#ff0000", 0.6) === "rgba(255,0,0,0.6)");
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
