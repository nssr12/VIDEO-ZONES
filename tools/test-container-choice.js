// البند #58 — كومِت أ: الأخصّ يفوز في اختيار حاوية ملء الشاشة، **وحتمياً**.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أطلب ملء الشاشة، أيُكبَّر المشغّل أم عنصرٌ آخر يبتلع الصفحة؟»*
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
// #140 — البوّابةُ الثالثة تنادي `isOwnElement`، **وهي خارج شريحة #58** —
// فتُحمَّل الدالّةُ الحقيقية لا بديلٌ عنها (بديلٌ يُصحّح الاختبارَ لا الكود).
const OWN = slice("content.js", "function isOwnElement", "function makeKeyStepAdapter");
const READY = !!(PICK && KNOWN && OWN);

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
      controls: !!s.controls,
      __name: s.name,
      __ctrls: []
    };
  });
  // ضوابطُ المضيف: عقدٌ بسيطة تحمل ما يقرؤه المحدِّد وما تقرؤه `isOwnElement`
  spec.forEach((sp, i) => {
    const total = (sp.ctrls || 0) + (sp.ownCtrls || 0);
    for (let k = 0; k < total; k++) {
      const mine = k >= (sp.ctrls || 0);   // #141 — أزرارُنا تحمل صنفَنا
      // #140ج — **مستطيلٌ غير صفريّ**: `isVisibleEl` تقرؤه، وبلا مستطيلٍ ترمي
      const btn = { nodeType: 1, tagName: "BUTTON", className: mine ? "vzSpeedBtn" : "", id: "",
                    parentElement: nodes[i],
                    getBoundingClientRect: () => ({ width: 40, height: 32, left: 0, top: 0, right: 40, bottom: 32 }) };
      btn.matches = (sel) => sel.split(",").some((x) => x.trim() === "button");
      btn.closest = (sel) => {
        for (let q = btn; q; q = q.parentElement) if (q.matches && q.matches(sel)) return q;
        return null;
      };
      nodes[i].__ctrls.push(btn);
    }
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
    // ⭐ #140 — **ضوابطُ المضيف تُصرَّح في المواصفة ولا تُحاكى**: `ctrls: n` تعني
    // «هذا العنصر يملك n ضابطاً». **وبدون هذا لا يستطيع الحارسُ أن يرى البوّابة
    // الثالثة أصلاً** — و`querySelectorAll` غيرُ معرَّفةٍ تعني بوّابةً لا تُشغَّل.
    n.contains = (x) => { for (let p = x; p; p = p.parentElement) if (p === n) return true; return false; };
    n.querySelectorAll = () => {
      const out = [];
      for (const m of nodes) if (n.contains(m)) out.push(...m.__ctrls);
      return out;
    };
  }
  return nodes;
}

function load(spec, scale, styleSheets) {
  const nodes = build(spec, scale);
  // كتلة #58 كومِت ب تسجّل مستمعَي خروج وتحقن ورقة أنماط عند التحميل،
  // فالمستند المزيّف يلزمه هذا القدر — ولا يُستعمل في فحوص هذا الملف.
  const last = nodes[nodes.length - 1];
  const doc = {
    // #146 — **غيابُ `styleSheets` يعني «الموقعُ لا يُعلن»**، وهو حالُ كلّ
    // البنيات القائمة: `siteDeclaredFsSelectors` ترمي فتُبتلع فتُرجع `null`.
    styleSheets: styleSheets || [],
    body: last, documentElement: last, head: { appendChild() {} },
    fullscreenElement: null,
    addEventListener() {}, getElementById: () => null,
    createElement: () => ({ id: "", textContent: "" }),
    querySelectorAll: () => []
  };
  // ⛔⭐ **`getComputedStyle` تُقدَّم صراحةً** — وبدونها يبتلع `isVisibleEl` رميتَه
  // ويُرجع `false` **دائماً**، فيخضرّ فحصُ الصنف الثالث عن عمى لا عن حكم.
  const ctx = { document: doc, console,
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }) };
  vm.createContext(ctx);
  vm.runInContext(OWN + "\n" + KNOWN + "\n" + PICK, ctx);
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

if (READY) {
console.log("\n[9] البند #59 كومِت ب — المسار الاحتياطي لا يُرجع إلا الفيديو");
{
  // كل المرشّحين مرفوضون: مستطيلات صفرية ⇒ scored فارغة ⇒ الاحتياطي.
  // هذا هو التخطيط المنهار الوحيد الذي يُدخِل المسار.
  const COLLAPSED = [
    {
      key: "تخطيط منهار — كل المستطيلات صفرية",
      spec: [
        { name: "VIDEO", tag: "VIDEO", cls: "", rect: () => [0, 0] },
        { name: "DIV.hid", cls: "hid", rect: () => [0, 0] },
        { name: "BODY", tag: "BODY", cls: "", rect: () => [0, 0] }
      ]
    },
    {
      key: "منهار داخل حاوية تشبه مشغّلاً",
      spec: [
        { name: "VIDEO", tag: "VIDEO", cls: "", rect: () => [0, 0] },
        { name: "DIV.player", cls: "some-player", rect: () => [0, 0] },
        { name: "BODY", tag: "BODY", cls: "", rect: () => [0, 0] }
      ]
    },
    {
      key: "فيديو صفريّ وأب ضخم (النسبة > 3.5)",
      spec: [
        { name: "VIDEO", tag: "VIDEO", cls: "", rect: () => [0, 0] },
        { name: "DIV.big", cls: "big", rect: () => [4000, 4000] },
        { name: "BODY", tag: "BODY", cls: "", rect: () => [4000, 4000] }
      ]
    }
  ];
  for (const shape of COLLAPSED) {
    for (const scale of [1, 0.6]) {
      const { ctx, video, nodes } = load(shape.spec, scale);
      const got = ctx.pickFullscreenContainer(video);
      const body = nodes[nodes.length - 1];
      check(`${shape.key} @${scale}: يُرجع الفيديو`, got === video, got && got.__name);
      check(`${shape.key} @${scale}: ولا BODY`, got !== body, got && got.__name);
      check(`${shape.key} @${scale}: ولا أب الفيديو`, got !== video.parentElement,
        got && got.__name);
    }
  }
  check("الكود لا يُرجع video.parentElement في الاحتياطي",
    !/scored\[0\]\?\.el\|\|video\.parentElement/.test(CONTENT.replace(/\s+/g, "")),
    "ما زال video.parentElement في المسار الاحتياطي");
  check("بل يُرجع الفيديو وحده",
    /scored\[0\]\?\.el\|\|video;/.test(CONTENT.replace(/\s+/g, "")));
  check("والتعليق يذكر شرط دخول المسار",
    /رُفض كل المرشّحين أو كانت مستطيلاتهم صفرية/.test(CONTENT));
}
}

if (READY) {
console.log("\n[10] #140 — ما نُكبّره لا يُخرج أدواتِ المضيف من الرسم");
{
  // ⭐ **البنيةُ الكاسرة**: الشريطُ **خارج** أضيقِ حاويةٍ يملؤها الفيديو —
  // بصمةُ فيميو المقيسة في CLAUDE.md منذ #94 (`div.vp-video` بصفر ضابط،
  // والضوابطُ مستوىً أعلى). ⚠️ **والفارقُ عن d.tube سطرٌ واحد: هناك الشريطُ داخلها.**
  const OUTSIDE = [
    { name: "VIDEO", tag: "VIDEO", cls: "", rect: (s) => [960 * s, 540 * s] },
    { name: "DIV.vp-video", cls: "vp-video", rect: (s) => [960 * s, 540 * s] },
    { name: "DIV.player", cls: "player", rect: (s) => [960 * s, 588 * s], ctrls: 12 },
    { name: "BODY", tag: "BODY", cls: "", rect: (s) => [1440 * s, 900] }
  ];
  const INSIDE = [
    { name: "VIDEO", tag: "VIDEO", cls: "", rect: (s) => [960 * s, 540 * s] },
    { name: "DIV.vp-video", cls: "vp-video", rect: (s) => [960 * s, 540 * s], ctrls: 12 },
    { name: "DIV.player", cls: "player", rect: (s) => [960 * s, 588 * s] },
    { name: "BODY", tag: "BODY", cls: "", rect: (s) => [1440 * s, 900] }
  ];
  // ⭐ **#141 — أزرارُنا ليست أدواتِ مضيف**: البنيةُ نفسُها والضوابطُ ضوابطُنا
  const MINE = [
    { name: "VIDEO", tag: "VIDEO", cls: "", rect: (s) => [960 * s, 540 * s] },
    { name: "DIV.vp-video", cls: "vp-video", rect: (s) => [960 * s, 540 * s] },
    { name: "DIV.player", cls: "player", rect: (s) => [960 * s, 588 * s], ownCtrls: 12 },
    { name: "BODY", tag: "BODY", cls: "", rect: (s) => [1440 * s, 900] }
  ];

  const out = load(OUTSIDE, 1);
  // ⛔⭐ **حمرةٌ عن السبب لا عن العَرَض** (درسُ #109): على النصّ السابق من السجلّ
  // لا وجودَ للبوّابة، **فالنداءُ يرمي `TypeError`** — **ورميةٌ تقول «سقط» ولا
  // تقول «البوّابةُ غائبة»**. ⇒ **يُقاس وجودُها أوّلاً ويُسمّى الغياب.**
  if (typeof out.ctx.hostControlsLostBy !== "function") {
    check("بوّابةُ #140 (`hostControlsLostBy`) موجودةٌ في content.js", false, "غائبة");
    fail += 9;   // بقيّةُ فحوص القسم لا تُشغَّل، ولا تُحسب نجاحاً
    console.log("  ⛔ بقيّةُ [10] لا تُشغَّل: لا بوّابةَ تُقاس.");
  } else {
  check("بوّابةُ #140 (`hostControlsLostBy`) موجودةٌ في content.js", true);
  const nearOut = out.ctx.nearestPlayerAncestor(out.video);
  check("الحكم القاطع ما زال يجد الحاوية الضيّقة", nearOut && nearOut.__name === "DIV.vp-video",
    nearOut && nearOut.__name);
  check("والبوّابةُ تقول: اختيارُه يُخرج أدواتِ المضيف",
    out.ctx.hostControlsLostBy(out.video, nearOut) === true);
  const pickOut = out.ctx.pickFullscreenContainer(out.video);
  check("فيُستأنَف السكور ويختار الحاوية التي تحوي الشريط",
    pickOut && pickOut.__name === "DIV.player", pickOut && pickOut.__name);
  check("ولا يُفقد ضابطٌ واحد بالمختار",
    out.ctx.hostControlsLostBy(out.video, pickOut) === false);
  const pickOut2 = load(OUTSIDE, 0.6).ctx.pickFullscreenContainer(load(OUTSIDE, 0.6).video);
  check("وحتميّ على المقاسين (شرط قبول المالك في #58)",
    pickOut2 && pickOut2.__name === "DIV.player", pickOut2 && pickOut2.__name);

  // ⛔ **الشاهد السالب — وهو ما يمنع بوّابةً تُطلق على كل شيء:** الشريطُ داخل
  // الحاوية الضيّقة ⇒ **لا تُطلَق، والحكمُ القاطع يبقى كما كان** (شكلُ d.tube).
  const ins = load(INSIDE, 1);
  const nearIn = ins.ctx.nearestPlayerAncestor(ins.video);
  check("سالب: شريطٌ داخل ما يملؤه الفيديو ⇒ لا فقد",
    ins.ctx.hostControlsLostBy(ins.video, nearIn) === false);
  const pickIn = ins.ctx.pickFullscreenContainer(ins.video);
  check("وسالب: والحكم القاطع يبقى صاحبَ القرار",
    pickIn === nearIn, pickIn && pickIn.__name);

  // ⛔ **#141 — ولا يُحسب زرُّنا أداةَ مضيف**: بوّابةٌ تعدّ طبقتَنا تقيس نفسها
  const mine = load(MINE, 1);
  const nearMine = mine.ctx.nearestPlayerAncestor(mine.video);
  check("سالب (#141): ضوابطُ الصفحة كلُّها لنا ⇒ لا فقد",
    mine.ctx.hostControlsLostBy(mine.video, nearMine) === false);
  check("والحكمُ القاطع يبقى صاحبَ القرار",
    mine.ctx.pickFullscreenContainer(mine.video) === nearMine);

  // **والمدى مدى الحكم القاطع نفسِه** — مسحٌ أوسعُ يُحمّر على ما لا يُغيّره
  check("المسحُ يستعمل حدَّ العمق نفسَه",
    /for\(leti=0;i<FS_CONTAINER_MAX_DEPTH&&el&&/.test(CONTENT.replace(/\s+/g, "")));
  }
}
}

if (READY) {
console.log("\n[11] #140ج — ضوابطُ المتصفّح صنفٌ يُفصل قبل الصعود");
{
  // ⭐⭐ **متغيّرٌ واحد لا غير: `video.controls`.** البنيةُ نفسُها، والأزرارُ نفسُها
  // (أزرارُ صفحةٍ حول المشغّل: Save · Try · HD…) — **والحكمُ ينقلب.**
  const spec = (controls) => ([
    { name: "VIDEO", tag: "VIDEO", cls: "", controls, rect: (s) => [800 * s, 450 * s] },
    { name: "DIV.shell", cls: "video-shell", rect: (s) => [800 * s, 450 * s] },
    { name: "DIV.page", cls: "page", rect: (s) => [900 * s, 700 * s], ctrls: 5 },
    { name: "BODY", tag: "BODY", cls: "", rect: (s) => [1440 * s, 900] }
  ]);
  const withC = load(spec(true), 1);
  const nearC = withC.ctx.nearestPlayerAncestor(withC.video);
  check("الحكم القاطع يجد غلافَ الفيديو", nearC && nearC.__name === "DIV.shell", nearC && nearC.__name);
  check("وضوابطُ المتصفّح ⇒ لا شيءَ يُفقد بالصعود",
    withC.ctx.hostControlsLostBy(withC.video, nearC) === false);
  const pickC = withC.ctx.pickFullscreenContainer(withC.video);
  // ⭐ **الفيديو نفسُه هو الهدف** (بنصّ المالك): ضوابطُه داخله، فلا صعودَ يشتري شيئاً
  // — **ولا صفحةٌ فوقه**، وهو العطبُ الذي رآه على شترستوك.
  check("فالفيديو نفسُه هو المختار", pickC === withC.video, pickC && pickC.__name);
  check("⛔ ولا صفحةٌ فوقه", !pickC || pickC.__name !== "DIV.page", pickC && pickC.__name);

  // ⛔ **والسالب هو ما يجعل الموجبَ خبراً**: بلا `controls` تُقرأ أزرارُ الصفحة
  // أدواتِ مضيفٍ تُفقد ⇒ **يصعد إلى الصفحة** — وهو العطبُ الذي رآه المالك.
  const noC = load(spec(false), 1);
  const nearN = noC.ctx.nearestPlayerAncestor(noC.video);
  check("سالب: بلا ضوابط متصفّح ⇒ البوّابةُ تُطلق",
    noC.ctx.hostControlsLostBy(noC.video, nearN) === true);
  // ⛔⭐⭐ **وحدُّ هذا الملفّ يُكتب هنا لا يُسكت عنه:** الشجرةُ المزيّفة تُعطي
  // **كلَّ سلفٍ أزراراً** (`querySelector` ثابتةُ الصدق — نموذجُ d.tube المقيس)
  // ⇒ **فأثرُ البوّابة على اختيار السكور لا يُقاس هنا**، والسكورُ يُبقي الغلافَ
  // في الحالين. **والمقيسُ هنا حكمُ الصنف وحدَه، وأثرُه في `repro-58` (بنية ك).**
  // ⚠️ **وأوّلُ صياغةٍ ادّعت «فيصعد إلى الصفحة» فسقطت بالقياس** — **ومعها فحصٌ
  // قارَن كائنين من سياقين (`pickC !== pickN`) فكان أخضرَ دائماً بلا معنى.**
  check("⇒ والمتغيّرُ واحد وحدَه: الحكمان متعاكسان على البنية نفسِها",
    withC.ctx.hostControlsLostBy(withC.video, nearC) === false &&
    noC.ctx.hostControlsLostBy(noC.video, nearN) === true);

  // **وشرطُ الصنف يُقرأ من الدالّة لا من نصٍّ**: زوالُه يُحمّر السطر أعلاه
  check("الشرطُ في content.js بحروفه",
    /video\.controls===true&&!scopeShowsOwnControls\(playerScopeForVideo\(video\)\)/
      .test(CONTENT.replace(/\s+/g, "")));
}
}


// ── [12] #146 — الموقعُ يُعلن عنصرَ ملء شاشته، فنقرأ ما كتبه ولا نحدس ────────
// ⭐ **بصمةُ xhamster المقيسة عند المالك 2026-09-06**: صندوقان، والموقعُ يُعلن
// الداخليَّ في ورقته، **والداخليُّ ارتفاعُه مكتوبٌ** فيبقى بمقاسه لو كبّرنا
// الخارجيَّ ⇒ سوادٌ أسفلَ الصورة (سلسلتُه: xplayer[562·562px] ← fsEl).
// ⛔⭐⭐ **ولماذا هنا لا في `repro-58`**: بُنيت هناك أوّلاً **فخضِرت على النصّ
// السابق أيضاً** — السكورُ اختار الداخليَّ من تلقائه. **والسببُ بنيويٌّ لا
// تفصيلُ أرقام**: حدُّ السكور ذروتُه عند 1.15، **ونسبةُ الخارجيّ أكبرُ من
// نسبة الداخليّ دائماً** (الخارجيُّ يحويه) ⇒ **ففوزُ الخارجيّ لا يقع إلا في
// شريطٍ ضيّق، وحكمٌ يركب فارقاً بحجم 0.07 مصادفةٌ مُرتَّبة لا بنية.**
// ⇒ **وهنا يُصنع الفارقُ حاسماً بمتغيّرٍ واحد: صنفُ الداخليّ لا يشبه مشغّلاً**
// ⇒ **يفوز الخارجيُّ بنقطتين كاملتين، لا بكسرٍ عشريّ.**
console.log("\n[12] #146 — إعلانُ الموقع يغلب السكور، ولا يغلب حكماً قاطعاً");
{
  const SHEET = [{ ownerNode: null, cssRules: [
    { selectorText: ".xp-stage:fullscreen", cssRules: [] },
    { selectorText: ".xp-stage:fullscreen video", cssRules: [] }
  ] }];
  const SPEC = [
    { name: "VIDEO", tag: "VIDEO", cls: "", rect: () => [897, 522] },
    { name: "DIV.xp-stage", cls: "xp-stage", ctrls: 3, rect: () => [897, 562] },
    { name: "DIV.player-container", cls: "player-container", ctrls: 0, rect: () => [1024, 678] },
    { name: "BODY", cls: "", rect: () => [1024, 900] }
  ];
  const pick = (spec, sheets) => {
    const { ctx, video } = load(spec, 1, sheets);
    const r = ctx.pickFullscreenContainer(video);
    return r && r.__name;
  };
  check("بلا إعلانٍ من الموقع ⇒ السكور يختار الخارجيّ",
    pick(SPEC) === "DIV.player-container", pick(SPEC));
  check("⭐ ومع إعلانه ⇒ نختار ما أعلنه هو",
    pick(SPEC, SHEET) === "DIV.xp-stage", pick(SPEC, SHEET));
  // ⛔ **ومُحدِّدٌ عامٌّ ليس هويّةَ عنصر**: تصريحٌ عن شكلٍ لا عن هويّة —
  // **وقبولُه يجعلنا نُكبّر ما لم يقصده أحد.**
  check("ومُحدِّدٌ عامّ (video:fullscreen) يُقصى",
    pick(SPEC, [{ ownerNode: null, cssRules: [{ selectorText: "video:fullscreen", cssRules: [] }] }])
      === "DIV.player-container");
  // ⛔ **وورقتُنا تُقصى** — تحمل [data-vz-fs]:fullscreen، وبلا الإقصاء نُطابق إعلانَنا
  check("وورقتُنا نحن تُقصى",
    pick(SPEC, [{ ownerNode: { id: "vz_fs_fill_css" },
      cssRules: [{ selectorText: "[data-vz-fs]:fullscreen video[data-vz-fs-video]", cssRules: [] }] }])
      === "DIV.player-container");
  // ⛔ **وشرطُ #140 يسري عليه**: إعلانٌ يُخرج أدواتِ المضيف من الرسم يُرفض
  const LOST = [
    { name: "VIDEO", tag: "VIDEO", cls: "", rect: () => [897, 522] },
    { name: "DIV.xp-stage", cls: "xp-stage", ctrls: 0, rect: () => [897, 562] },
    { name: "DIV.player-container", cls: "player-container", ctrls: 3, rect: () => [1024, 678] },
    { name: "BODY", cls: "", rect: () => [1024, 900] }
  ];
  check("⛔ وإعلانٌ يُفقد أدواتِ المضيف يُرفض (#140)",
    pick(LOST, SHEET) !== "DIV.xp-stage", pick(LOST, SHEET));
  // ⭐ **ولا يغلب حكماً قاطعاً**: الحاويةُ المعروفة أوّلاً — موضعُه بعدها لا قبلها
  const KNOWN_FIRST = [
    { name: "VIDEO", tag: "VIDEO", cls: "", rect: () => [897, 522] },
    { name: "DIV.xp-stage", cls: "xp-stage", ctrls: 3, rect: () => [897, 562] },
    { name: "DIV.video-js", cls: "video-js", ctrls: 3, rect: () => [1024, 678] },
    { name: "BODY", cls: "", rect: () => [1024, 900] }
  ];
  check("والحاويةُ المعروفة تبقى أوّلاً",
    pick(KNOWN_FIRST, SHEET) === "DIV.video-js", pick(KNOWN_FIRST, SHEET));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
