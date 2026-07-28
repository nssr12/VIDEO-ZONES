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
const SRC = slice("content.js", "// ---- BEGIN gridAppearance ----", "async function loadSoundDisplaySettings");

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
  const R = (stored) => load({}).ctx.resolveGridAppearance(stored);
  const rgba = (h, a) => load({}).ctx.rgbaFrom(h, a);

  console.log("\n[1] غياب gridAppearance كلياً ⇒ المظهر القديم حرفياً");
  {
    const g = R(undefined);
    check("خلفية شفافة تماماً", g.cellBgOpacity === 0, g);
    check("شفافية الحدود 32%", g.cellBorderOpacity === 0.32, g);
    check("لا استدارة", g.radius === 0, g.radius);
    check("الحدّ يُنتج rgba القديمة", rgba(g.cellBorder, g.cellBorderOpacity) === "rgba(255,255,255,0.32)", rgba(g.cellBorder, g.cellBorderOpacity));
  }

  console.log("\n[2] شفافية 0 للخلفية ⇒ transparent لا rgba(x,y,z,0)");
  {
    check("transparent", rgba("#123456", 0) === "transparent", rgba("#123456", 0));
    check("قيمة سالبة أيضاً", rgba("#123456", -1) === "transparent");
    check("لون تالف ⇒ transparent", rgba("nope", 1) === "transparent");
    check("شفافية كاملة ⇒ rgb بلا ألفا", rgba("#ff0000", 1) === "rgb(255,0,0)", rgba("#ff0000", 1));
  }

  console.log("\n[3] حقل مضبوط سلفاً بلا شفافية مخزَّنة ⇒ 100%");
  {
    const g = R({ cellBg: "#ff0000", cellBorder: "#00ff00" });
    check("خلفية اختارها المستخدم ⇒ 1", g.cellBgOpacity === 1, g);
    check("حدود اختارها المستخدم ⇒ 1", g.cellBorderOpacity === 1, g);
    check("اللون محفوظ كما اختاره", g.cellBg === "#ff0000" && g.cellBorder === "#00ff00", g);
  }

  console.log("\n[4] تعبئة options التلقائية ليست اختياراً ⇒ المظهر القديم");
  {
    const g = R({ cellBg: "#10131a", cellBorder: "#2a2f3a", numberColor: "#a3a3a3", radius: 12 });
    check("لا جدار صلب", g.cellBgOpacity === 0, g);
    check("الحدود تعود لـ 32%", g.cellBorderOpacity === 0.32, g);
    check("الاستدارة تعود 0", g.radius === 0, g.radius);
  }

  console.log("\n[5] تغيير جزئي: المُختار يبقى والباقي يعود للأصل");
  {
    const g = R({ cellBg: "#10131a", cellBorder: "#ff0000", numberColor: "#a3a3a3", radius: 12 });
    check("الحدود المُختارة ⇒ 100%", g.cellBorderOpacity === 1 && g.cellBorder === "#ff0000", g);
    check("الخلفية التلقائية ⇒ شفافة", g.cellBgOpacity === 0, g);
  }

  console.log("\n[6] شفافية مخزَّنة صراحةً تُحترم ولا تُشتقّ");
  {
    const g = R({ cellBg: "#ff0000", cellBgOpacity: 0.5, cellBorder: "#00ff00", cellBorderOpacity: 0 });
    check("0.5 كما هي", g.cellBgOpacity === 0.5, g);
    check("0 صراحةً تبقى 0 لا 1", g.cellBorderOpacity === 0, g);
    check("قيمة خارج المدى تُقصّ", R({ cellBgOpacity: 5 }).cellBgOpacity === 1);
  }

  console.log("\n[6b] شفافية رقم المربع");
  {
    check("الافتراضي 100% (لا تغيير للمظهر)", R(undefined).numberOpacity === 1, R(undefined));
    check("#a3a3a3 التلقائي ⇒ اللون يعود أبيض", R({ numberColor: "#a3a3a3", cellBorder: "#ff0000" }).numberColor === "#ffffff",
      R({ numberColor: "#a3a3a3", cellBorder: "#ff0000" }));
    check("لون مختار ⇒ يبقى وشفافيته 100%",
      R({ numberColor: "#00ffff" }).numberColor === "#00ffff" && R({ numberColor: "#00ffff" }).numberOpacity === 1);
    check("شفافية 0 مخزَّنة تُحترم", R({ numberOpacity: 0 }).numberOpacity === 0, R({ numberOpacity: 0 }));
    check("0 تُنتج transparent", rgba(R({ numberOpacity: 0 }).numberColor, 0) === "transparent");

    const css = fs.readFileSync("content.js", "utf8");
    check("0 تحذف العنصر من الـ DOM لا تُشفّفه", /function syncZoneNumbers[\s\S]*?existing\.remove\(\)/.test(css));
    check("الأرقام تُزرع بـ textContent", /num\.textContent = ZONE_LABELS/.test(css));
    check("لا قالب innerHTML للأرقام", !/vzNum">\$\{/.test(css));
  }

  console.log("\n[6c] الاستدلالية موثّقة فوق الكتلة");
  {
    const st = fs.readFileSync("storage.js", "utf8");
    check("يشرح أن options.js كانت تكتبها تلقائياً", /بمجرد \*\*فتح\*\* الصفحة/.test(st));
    check("يذكر حالة من اختار #10131a عمداً", /مستخدم اختار #10131a عمداً/.test(st));
    check("يعلّل قبول الأثر", /الأثر مقبول/.test(st));
    check("يوضّح استثناء radius", /أما radius فلا يُعاد إلا/.test(st));
  }

  console.log("\n[7] الافتراضيات مصدر واحد بين الملفات");
  {
    const st = fs.readFileSync("storage.js", "utf8"), ct = fs.readFileSync("content.js", "utf8");
    const blk = (t) => t.slice(t.indexOf("// ---- BEGIN gridAppearance ----"), t.indexOf("// ---- END gridAppearance ----"));
    check("النسختان متطابقتان حرفياً", blk(st) === blk(ct));
    const opt = fs.readFileSync("options.js", "utf8");
    check("options.js بلا افتراضيات مكرَّرة", !/10131a|2a2f3a|a3a3a3/.test(opt));
    check("options.js يستورد GRID_APPEARANCE_DEFAULTS", /GRID_APPEARANCE_DEFAULTS/.test(opt));
  }

  console.log("\n[8] الأرقام داخل .vzGrid، وبلا التقاط للمؤشر");
  {
    const css = fs.readFileSync("content.js", "utf8");
    check("الخلايا التسع داخل .vzGrid", /vzGrid vzHidden">\$\{'<div class="vzCell"><\/div>'\.repeat\(9\)\}/.test(css));
    check("الرقم يُضاف داخل الخلية", /cell\.appendChild\(num\)/.test(css));
    check("pointer-events:none على .vzNum", /\.vzNum\{[^}]*pointer-events:none/.test(css));
    check("الحجم نسبي للشبكة بلا إعداد جديد", /font-size:clamp\(9px, 6cqmin/.test(css));
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
