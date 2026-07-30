// البند #58 — كومِت أ: الأخصّ يفوز في اختيار حاوية ملء الشاشة، **وحتمياً**.
//
// شرط القبول الذي أضافه المالك: **الحتمية**. المستطيلات تتغيّر مع مقاس إطار
// العرض، والسكور يحسم بفوارق ناعمة (0.1037 نقطة بين حاوية الصفحة والمشغّل على
// d.tube)، فأي اعتماد عليه هشّ بطبعه. هذا الاختبار يشغّل كل بنية على **مقاسي
// إطار عرض** ويشترط أن يكون العنصر المختار واحداً في المرتين.
//
// ⚠️ لا تكتب أن العنصر «ينقلب بين مقاسين»: ذاك شاهد **سُحب** — كان أثر توقيت في
// منصّة القياس لا سلوكاً (`AUDIT.md` §7).
//
// الدالة المختبَرة خالصة على (العنصر، مستطيله، أصنافه)، فالمستطيلات المُمرَّرة
// هنا **بيانات مقيسة** لا تخطيط مُحاكى: بصمة d.tube منسوخة من قياس حقيقي
// (`AUDIT.md` §6)، والبقية من `tools/repro-58-fullscreen.mjs`.
const fs = require("fs");
const vm = require("vm");

// يُرجع null بدل أن يرمي: على الكود السابق لا وجود لكتلة #58، والمطلوب أن يفشل
// الاختبار **بعدّ** لا أن ينهار قبل أن يقول شيئاً.
function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  return a === -1 || b === -1 ? null : t.slice(a, b);
}

const CONTENT = fs.readFileSync("content.js", "utf8");
const REPORT = fs.existsSync("tools/report-fullscreen-bug.js")
  ? fs.readFileSync("tools/report-fullscreen-bug.js", "utf8") : "";
const PICK = slice("content.js", "// ── البند #58: تعريف واحد", "// Selectors for sites that expose");
const KNOWN = slice("content.js", "const KNOWN_PLAYER_WRAPPER_SELECTOR", "const zoneContainerCache");
const READY = !!(PICK && KNOWN);

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ---------------------------------------------------------------- fake DOM
// أمين على ما تقرأه الدالة فقط: className · role · getBoundingClientRect ·
// parentElement · matches · closest. المستطيلات تُمرَّر صراحةً لكل مقاس.
function build(spec, scale) {
  const nodes = spec.map((s) => {
    const r = s.rect(scale);
    return {
      nodeType: 1,
      tagName: s.tag || "DIV",
      className: s.cls || "",
      id: s.id || "",
      parentElement: null,
      requestFullscreen() {},
      getAttribute(n) { return n === "role" ? (s.role || null) : null; },
      getBoundingClientRect: () => ({
        width: r[0], height: r[1], left: r[2] ?? 0, top: r[3] ?? 0,
        right: (r[2] ?? 0) + r[0], bottom: (r[3] ?? 0) + r[1]
      }),
      __name: s.name
    };
  });
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].parentElement = nodes[i + 1];
  const sels = (sel) => sel.split(",").map((x) => x.trim()).filter(Boolean);
  const matchOne = (node, sel) => {
    if (sel.startsWith("#")) return node.id === sel.slice(1);
    if (sel.startsWith("[")) {
      const m = /^\[([^=\]]+)='([^']*)'\]$/.exec(sel);
      return !!m && node.getAttribute(m[1]) === m[2];
    }
    if (sel.startsWith(".")) {
      return String(node.className).split(/\s+/).includes(sel.slice(1));
    }
    return node.tagName.toLowerCase() === sel.toLowerCase();
  };
  for (const n of nodes) {
    n.matches = (sel) => sels(sel).some((s) => matchOne(n, s));
    n.closest = (sel) => {
      for (let p = n; p; p = p.parentElement) if (p.matches(sel)) return p;
      return null;
    };
    n.querySelector = () => ({});   // كل سلف فيه أزرار — كما قِيس على d.tube
  }
  return nodes;
}

function load(spec, scale) {
  const nodes = build(spec, scale);
  // كتلة #58 كومِت ب تسجّل مستمعَي خروج وتحقن ورقة أنماط عند التحميل،
  // فالمستند المزيّف يلزمه هذا القدر — ولا يُستعمل في فحوص هذا الملف.
  const last = nodes[nodes.length - 1];
  const doc = {
    body: last, documentElement: last, head: { appendChild() {} },
    fullscreenElement: null,
    addEventListener() {}, getElementById: () => null,
    createElement: () => ({ id: "", textContent: "" }),
    querySelectorAll: () => []
  };
  const ctx = { document: doc, console };
  vm.createContext(ctx);
  vm.runInContext(KNOWN + "\n" + PICK, ctx);
  return { ctx, video: nodes[0], nodes };
}

// ---------------------------------------------------------------- البنيات
// scale = 1 ⇒ إطار عرض 1440، scale = 0.6 ⇒ إطار عرض ~864. المستطيلات تتناسب
// كما يتناسب التخطيط الحقيقي، والحاويات ذات الحشو تحتفظ بفرقها المطلق.
const SHAPES = [
  {
    key: "ي — بصمة d.tube",
    expect: "DIV.dt-player-wrapper",
    spec: [
      { name: "VIDEO", tag: "VIDEO", cls: "dtube-video shaka-video", rect: (s) => [1336 * s, 751.5 * s] },
      { name: "DIV.dt-player-wrapper", cls: "dtube-player-wrapper shaka-video-container", rect: (s) => [1336 * s, 751.5 * s] },
      { name: "DIV.dt-player-host", cls: "dtube-player-host w-full h-full", rect: (s) => [1336 * s, 751.5 * s] },
      { name: "DIV.dt-rel", cls: "relative w-full h-full", rect: (s) => [1336 * s, 751.5 * s] },
      { name: "DIV.dt-aspect", cls: "bg-black md:rounded-xl aspect-video", rect: (s) => [1336 * s, 751.5 * s] },
      { name: "DIV.anon", cls: "", rect: (s) => [1336 * s, 751.5 * s] },
      { name: "DIV.dt-container", cls: "md:container md:pt-6 md:pb-4", rect: (s) => [1336 * s + 64, 751.5 * s + 40] },
      { name: "BODY", tag: "BODY", cls: "", rect: (s) => [1425 * s, 1880 * s] }
    ]
  },
  {
    key: "ج — حاوية عادية + فيديو ثابت",
    expect: null,     // لا حكم قاطع: يسقط إلى السكور (وهو مجال كومِت ب)
    spec: [
      { name: "VIDEO", tag: "VIDEO", cls: "", rect: () => [640, 360] },
      { name: "DIV.wrap", cls: "wrap", rect: () => [640, 360] },
      { name: "BODY", tag: "BODY", cls: "", rect: (s) => [1440 * s, 400] }
    ]
  },
  {
    key: "أ — فيديو ابن body",
    expect: null,     // #59: لا سلف يشبه مشغّلاً ⇒ السكور، وهناك يفوز BODY حتمياً
    spec: [
      { name: "VIDEO", tag: "VIDEO", cls: "", rect: () => [640, 360] },
      { name: "BODY", tag: "BODY", cls: "", rect: (s) => [1440 * s, 360] }
    ]
  },
  {
    key: "هـ — .video-player معروفة + فيديو نسبيّ",
    expect: "DIV.video-player",   // الحاوية المعروفة تُحسم قبل الحكم القاطع
    spec: [
      { name: "VIDEO", tag: "VIDEO", cls: "", rect: (s) => [640 * s, 360 * s] },
      { name: "DIV.video-player", cls: "video-player", rect: (s) => [640 * s, 360 * s] },
      { name: "BODY", tag: "BODY", cls: "", rect: (s) => [1440 * s, 800] }
    ]
  },
  {
    key: "مشغّل مُحاط بحاوية صفحة أوسع بقليل",
    expect: "DIV.some-player",
    spec: [
      { name: "VIDEO", tag: "VIDEO", cls: "", rect: (s) => [800 * s, 450 * s] },
      { name: "DIV.some-player", cls: "some-player-shell", rect: (s) => [800 * s, 450 * s] },
      { name: "DIV.page", cls: "page-container", rect: (s) => [800 * s + 48, 450 * s + 32] },
      { name: "BODY", tag: "BODY", cls: "", rect: (s) => [1440 * s, 1200] }
    ]
  }
];

if (!READY) {
  console.log("\n⛔ لا كتلة #58 في content.js — تُتخطّى فحوص السلوك");
  fail += 4;
}

if (READY) {
console.log("\n[1] الحكم القاطع يختار الأقرب لا الأعلى سكوراً");
for (const shape of SHAPES) {
  const { ctx, video } = load(shape.spec, 1);
  const got = ctx.nearestPlayerAncestor(video);
  const name = got ? got.__name : null;
  check(`${shape.key} ⇒ ${shape.expect ?? "لا حكم قاطع (يسقط للسكور)"}`,
    name === shape.expect, `حصلنا على ${name}`);
}

console.log("\n[2] الحتمية — نفس العنصر على مقاسي إطار عرض (شرط قبول المالك)");
for (const shape of SHAPES) {
  const a = load(shape.spec, 1);
  const b = load(shape.spec, 0.6);
  const na = a.ctx.nearestPlayerAncestor(a.video);
  const nb = b.ctx.nearestPlayerAncestor(b.video);
  const same = (na ? na.__name : null) === (nb ? nb.__name : null);
  check(`${shape.key}: حتميّ عبر المقاسين`, same,
    `1440 ⇒ ${na ? na.__name : null} · 864 ⇒ ${nb ? nb.__name : null}`);
}

console.log("\n[3] d.tube: الحكم القاطع يسبق السكور الناعم");
{
  const shape = SHAPES[0];
  const { ctx, video, nodes } = load(shape.spec, 1);
  const picked = ctx.pickFullscreenContainer(video);
  check("pickFullscreenContainer ترجع المشغّل لا حاوية الصفحة",
    picked && picked.__name === "DIV.dt-player-wrapper", picked && picked.__name);
  check("ولا ترجع DIV.dt-container التي كانت تفوز بـ0.1037",
    !picked || picked.__name !== "DIV.dt-container");
  const container = nodes.find((n) => n.__name === "DIV.dt-container");
  check("حاوية الصفحة **لا** يملؤها الفيديو بحسب التعريف الواحد",
    ctx.videoFillsElement(video, container) === false);
  check("والمشغّل يملؤه الفيديو",
    ctx.videoFillsElement(video, nodes[1]) === true);
}

console.log("\n[4] تعريف «يملأ» واحد — 0.95 في المحورين معاً");
{
  const mk = (w, h) => ({ getBoundingClientRect: () => ({ width: w, height: h, left: 0, top: 0, right: w, bottom: h }) });
  const { ctx } = load(SHAPES[1].spec, 1);
  const v = mk(100, 100);
  check("100/100 يملأ", ctx.videoFillsElement(v, mk(100, 100)) === true);
  check("95/100 يملأ (الحدّ بالضبط)", ctx.videoFillsElement(mk(95, 95), mk(100, 100)) === true);
  check("94.9 لا يملأ", ctx.videoFillsElement(mk(94.9, 100), mk(100, 100)) === false);
  check("عرض يملأ وارتفاع لا ⇒ لا يملأ", ctx.videoFillsElement(mk(100, 80), mk(100, 100)) === false);
  check("ارتفاع يملأ وعرض لا ⇒ لا يملأ", ctx.videoFillsElement(mk(80, 100), mk(100, 100)) === false);
  check("عنصر بمستطيل صفري ⇒ لا يملأ", ctx.videoFillsElement(v, mk(0, 0)) === false);
}
}   // ← نهاية if (READY): ما بعده فحوص نصّية لا تحتاج تحميل الكتلة

console.log("\n[4ب] ثابت التعريف الواحد");
{
  check("0.95 معرَّف مرة واحدة في content.js",
    (CONTENT.match(/VZ_FILL_RATIO\s*=\s*0\.95/g) || []).length === 1);
  // على **الكود** لا التعليقات: التعليق أعلى الثابت يذكر 0.95 نصّاً، فقياسه
  // على النصّ الخام يُسقط الفحص بلا سبب. أُسقطني فعلاً عند كتابته.
  const CODE = CONTENT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  check("ولا 0.95 حرفيّ آخر في الكود",
    (CODE.match(/0\.95/g) || []).length === 1, (CODE.match(/0\.95/g) || []).length);
}

console.log("\n[5] السكور القائم لم يُعدَّل بحرف (قرار المالك)");
{
  const squash = (s) => s.replace(/\s+/g, "");
  const expr = /\(hasButtons\?3:0\)\+\(looksPlayer\?2:0\)\+\(el===video\?0:1\)\+Math\.max\(0,2-Math\.abs\(areaRatio-1\.15\)\)/;
  check("معادلة السكور كما هي", expr.test(squash(CONTENT)));
  check("النسبة المثالية ما زالت 1.15 — لم تُغيَّر", /areaRatio-1\.15/.test(squash(CONTENT)));
  check("سقف النسبة ما زال 3.5", /areaRatio>3\.5\)returnnull/.test(squash(CONTENT)));
  check("عمق المرشّحين ما زال 8", /i<8&&cur;i\+\+/.test(squash(CONTENT)));
  check("عمق الحكم القاطع مساوٍ له", /FS_CONTAINER_MAX_DEPTH=8/.test(squash(CONTENT)));
}

console.log("\n[6] التعبير النمطي مكرّر عن قصد — والنسختان متطابقتان نصّاً");
{
  const rx = /\/player\|video\|controls\|overlay\|container\/i/g;
  const inContent = CONTENT.match(rx) || [];
  check("نسختان في content.js لا أكثر", inContent.length === 2, inContent.length);
  check("والمقطع التشخيصي يحمل النسخة نفسها", (REPORT.match(rx) || []).length === 2, (REPORT.match(rx) || []).length);
}

console.log("\n[7] الحكم القاطع يسبق السكور ويأتي بعد الحاوية المعروفة");
{
  const squash = (s) => s.replace(/\s+/g, "");
  const s = squash(CONTENT);
  const iKnown = s.indexOf("constknownPlayer=video.closest");
  const iNear = s.indexOf("constnearest=nearestPlayerAncestor(video)");
  const iScore = s.indexOf("constvideoRect=video.getBoundingClientRect();constvideoArea");
  check("الحاوية المعروفة أولاً", iKnown > -1 && iKnown < iNear, `${iKnown}/${iNear}`);
  check("ثم الحكم القاطع", iNear > -1 && iNear < iScore, `${iNear}/${iScore}`);
  check("ثم السكور", iScore > -1);
  check("body و documentElement مستثنيان من المشي",
    /el!==document\.body&&el!==document\.documentElement/.test(s));
}

// ═════════════════════════════════════════════════════════════════════════════
// البند #59 — **مُصلح في كومِت أ**: `body` و`documentElement` مستثنيان من مرشّحي
// السكور. التثبيت القديم (الذي كان يبرهن أن العطب قائم) أُزيل في **كومِت الإصلاح
// نفسه** لا بعده، وحلّ محلّه فحص موجب يحرس الإصلاح — وكذلك سطره في
// tools/KNOWN-DEFECTS.md. هذا ما يعنيه «حدّثه ولا تُصلح الاختبار».
// ═════════════════════════════════════════════════════════════════════════════
if (READY) {
console.log("\n[8] البند #59 — body و documentElement خارج المرشّحين");
{
  const shape = SHAPES.find((s) => s.key.startsWith("أ"));
  const a = load(shape.spec, 1);
  const b = load(shape.spec, 0.6);
  const pa = a.ctx.pickFullscreenContainer(a.video);
  const pb = b.ctx.pickFullscreenContainer(b.video);
  check("لا حكم قاطع للحالة أ — لا سلف يشبه مشغّلاً",
    a.ctx.nearestPlayerAncestor(a.video) === null);
  check("والسكور لم يعد يُرجع BODY", pa && pa.__name !== "BODY", pa && pa.__name);
  check("ولا HTML", pa && pa.__name !== "HTML", pa && pa.__name);
  check("بل الفيديو نفسه", pa === a.video, pa && pa.__name);
  check("وحتميّ على المقاسين", (pa === a.video) && (pb === b.video),
    `${pa && pa.__name} / ${pb && pb.__name}`);
  check("body مستثنى نصّاً من حلقة المرشّحين",
    /cur!==document\.body&&cur!==document\.documentElement/.test(CONTENT.replace(/\s+/g, "")));
  // لا فاصل تعادل: المقارِن يبقى مقارنة سكور واحدة بلا شرط ثانٍ.
  // (regex ساذج على /tie/ يطابق "properties" — أُسقطني فعلاً عند كتابته.)
  check("مقارِن الترتيب بلا فاصل تعادل",
    /\.sort\(\(a,b\)=>b\.score-a\.score\)/.test(CONTENT.replace(/\s+/g, "")));
  check("والسكور نفسه لم يُعدَّل بحرف",
    /\(hasButtons\?3:0\)\+\(looksPlayer\?2:0\)\+\(el===video\?0:1\)\+Math\.max\(0,2-Math\.abs\(areaRatio-1\.15\)\)/
      .test(CONTENT.replace(/\s+/g, "")));
  // لافتة التثبيت كانت تبدأ بثلاث علامات تحذير متتالية — غيابها هو الدليل.
  // (لا يصحّ البحث عن نصّ الجملة نفسها: هذا الملف يذكرها فيطابق نفسه.)
  check("ولا لافتة تثبيت عطب باقية في هذا الملف",
    !fs.readFileSync("tools/test-container-choice.js", "utf8").includes("\u26a0\ufe0f\u26a0\ufe0f\u26a0\ufe0f"));
  check("ولا سطر #59 باقياً في KNOWN-DEFECTS كعطب متوقَّع",
    !/### ❌ متوقَّعة — البنية \*\*أ\*\* تُكبِّر/.test(fs.readFileSync("tools/KNOWN-DEFECTS.md", "utf8")));
}
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
