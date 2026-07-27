// Audit #7: the Grid Appearance panel must actually reach the in-video overlay,
// and an unset field must fall back to the value the overlay was hardcoded with
// — never to a new one, or every existing user sees an unrequested visual change.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}
const SRC = slice("content.js", "const GRID_APPEARANCE_DEFAULTS", "async function loadSoundDisplaySettings");

function load(settings) {
  const vars = {};
  const ctx = {
    chrome: { storage: { sync: { get: (d) => Promise.resolve({ settings }) } } },
    vzOverlay: { style: { setProperty: (k, v) => { vars[k] = v; } } },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, vars, read: () => vm.runInContext("gridAppearance", ctx) };
}

let pass = 0, fail = 0;
const check = (n, c, x) => c ? (pass++, console.log("  ✅ " + n))
                             : (fail++, console.log("  ❌ " + n, x ?? ""));

// القيم التي كانت مكتوبة يدوياً في overlay قبل هذا البند
const OLD_BORDER = "rgba(255,255,255,.32)";

(async () => {
  console.log("\n[1] لا إعدادات إطلاقاً ⇒ مظهر الـ overlay القديم حرفياً");
  {
    const l = load({});
    await l.ctx.loadGridAppearance();
    const g = l.read();
    check("الحدّ = قيمة overlay القديمة", g.cellBorder === OLD_BORDER, g.cellBorder);
    check("الخلفية شفافة كما كانت", g.cellBg === "transparent", g.cellBg);
    check("لا استدارة كما كان", g.radius === 0, g.radius);
    check("لون الرقم أبيض مثل بقية نصوص الـ overlay", g.numberColor === "#ffffff", g.numberColor);
  }

  console.log("\n[2] إعدادات المستخدم تصل للمتغيرات فعلاً");
  {
    const l = load({ gridAppearance: { cellBg: "#101010", cellBorder: "#ff0000", numberColor: "#00ff00", radius: 14 } });
    await l.ctx.loadGridAppearance();
    check("--vz-cell-bg", l.vars["--vz-cell-bg"] === "#101010", l.vars);
    check("--vz-cell-border", l.vars["--vz-cell-border"] === "#ff0000", l.vars);
    check("--vz-num-color", l.vars["--vz-num-color"] === "#00ff00", l.vars);
    check("--vz-cell-radius بوحدة px", l.vars["--vz-cell-radius"] === "14px", l.vars);
  }

  console.log("\n[3] حقل واحد ناقص ⇒ الباقي يُحترم والناقص يعود للقديم");
  {
    const l = load({ gridAppearance: { cellBorder: "#abcdef" } });
    await l.ctx.loadGridAppearance();
    const g = l.read();
    check("المضبوط يُحترم", g.cellBorder === "#abcdef", g.cellBorder);
    check("الناقص يعود للقيمة القديمة", g.cellBg === "transparent" && g.radius === 0, g);
  }

  console.log("\n[4] قيم تالفة لا تُمرَّر");
  {
    const l = load({ gridAppearance: { radius: "abc", cellBg: "" } });
    await l.ctx.loadGridAppearance();
    const g = l.read();
    check("radius غير رقمي ⇒ 0", g.radius === 0, g.radius);
    check("نص فارغ ⇒ الافتراضي", g.cellBg === "transparent", g.cellBg);
  }

  console.log("\n[5] تحميل متكرر لا يُراكم القيم");
  {
    const l = load({ gridAppearance: { cellBorder: "#111111" } });
    await l.ctx.loadGridAppearance();
    // تحميل ثانٍ بإعدادات فارغة يجب أن يعود للافتراضي لا لقيمة التحميل السابق
    const l2 = load({});
    await l2.ctx.loadGridAppearance();
    check("لا تسرّب بين التحميلات", l2.read().cellBorder === OLD_BORDER, l2.read().cellBorder);
  }

  console.log("\n[6] الأرقام داخل .vzGrid فتختفي معها، وبلا التقاط للمؤشر");
  {
    const css = fs.readFileSync("content.js", "utf8");
    check("الرقم داخل الخلية داخل الشبكة",
      /vzGrid vzHidden">\$\{cells\}/.test(css) && /class="vzCell"><div class="vzNum">/.test(css));
    check("pointer-events:none على .vzNum", /\.vzNum\{[^}]*pointer-events:none/.test(css));
    check("لا إعداد حجم جديد — الحجم نسبي للشبكة", /font-size:clamp\(9px, 6cqmin/.test(css));
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
