// البند #58 — كومِت ب: بوابة القياس وقاعدة تمديد الفيديو.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يملأ الفيديو الشاشةَ بعد ملء الشاشة أم يبقى صغيراً في وسطها؟»*
//
// شرط القبول الأول (وهو الأهم): **القاعدة لا تُطبَّق على d.tube إطلاقاً.** بعد
// كومِت أ صارت الحاوية هي المشغّل والفيديو يملؤه، فالبوابة يجب أن ترفض. إن أُضيفت
// سمة على بصمة d.tube فالبوابة فاشلة لا القاعدة.
//
// ويحرس ما لا يجوز أن يُفترض: **إزالة السمتين في كل مخارج ملء الشاشة** —
// Esc، وخروج يبدؤه الموقع، وذهاب عنصر آخر إلى ملء الشاشة، ورفض الطلب.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  return a === -1 || b === -1 ? null : t.slice(a, b);
}

const CONTENT = fs.readFileSync("content.js", "utf8");
const FILL = slice("content.js", "// ── البند #58: تعريف واحد", "function pickFullscreenContainer");
const READY = !!FILL;

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ---------------------------------------------------------------- fake DOM
function node(tag, cls, rect) {
  const attrs = {};
  return {
    nodeType: 1, tagName: tag, className: cls || "", id: "",
    parentElement: null, __rect: rect,
    attrs,
    hasAttribute: (n) => n in attrs,
    setAttribute: (n, v) => { attrs[n] = String(v); },
    removeAttribute: (n) => { delete attrs[n]; },
    getAttribute: (n) => (n === "role" ? null : (attrs[n] ?? null)),
    getBoundingClientRect: () => ({
      width: rect[0], height: rect[1], left: 0, top: 0, right: rect[0], bottom: rect[1]
    }),
    matches: () => false,
    closest: () => null,
    querySelector: () => ({})
  };
}

// عالم صغير: مستند فيه رأس، وقائمة عناصر يُبحث فيها بمسح المستند
function makeWorld() {
  const created = [];
  const all = [];
  const head = { children: [], appendChild(c) { this.children.push(c); } };
  const doc = {
    head,
    documentElement: head,
    fullscreenElement: null,
    listeners: {},
    getElementById: (id) => created.find((c) => c.id === id) || null,
    createElement: (t) => { const e = { tagName: t.toUpperCase(), id: "", textContent: "" }; created.push(e); return e; },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    querySelectorAll(sel) {
      // يدعم الصيغة المستعملة فقط: [a],[b]
      const names = sel.split(",").map((s) => s.replace(/[\[\]]/g, "").trim());
      return all.filter((el) => names.some((n) => el.hasAttribute(n)));
    },
    __register: (el) => { all.push(el); return el; },
    __fire(type) { for (const fn of this.listeners[type] || []) fn(); },
    __styles: () => created.filter((c) => c.id === "vz_fs_fill_css")
  };
  const ctx = { document: doc, console, KNOWN_PLAYER_WRAPPER_SELECTOR: ".video-player" };
  vm.createContext(ctx);
  // fullscreenElementFor تعيش في قسم الـ overlay؛ نمثّلها بالمستند وحده هنا
  vm.runInContext("function fullscreenElementFor(v){ return document.fullscreenElement || null; }\n" + FILL, ctx);
  return { ctx, doc };
}

// بنية: [عرض/ارتفاع الفيديو], [عرض/ارتفاع الحاوية بعد ملء الشاشة]
const SCREEN = [1440, 900];
const SHAPES = [
  { key: "ج — حاوية عادية + فيديو ثابت", video: [640, 360], container: SCREEN, expectStamp: true },
  { key: "د — .video-player + فيديو ثابت", video: [640, 360], container: SCREEN, expectStamp: true },
  { key: "ز — فيديو سطريّ + قاعدة الموقع", video: [640, 360], container: SCREEN, expectStamp: true },
  { key: "ي — بصمة d.tube بعد كومِت أ", video: SCREEN, container: SCREEN, expectStamp: false },
  { key: "هـ — فيديو نسبيّ يملأ الحاوية", video: SCREEN, container: SCREEN, expectStamp: false },
  { key: "و — فيديو ثابت + قاعدة الموقع تنجح", video: SCREEN, container: SCREEN, expectStamp: false }
];

// ⚠️ `vzFsRequestedEl` و`vzFsRequestedVideo` معرَّفتان بـ `let` في أعلى الكتلة،
// و`let` **لا يصير خاصية على كائن السياق** — الفخّ نفسه الموثّق في
// tools/test-zone-defaults.js. فالكتابة والقراءة تمرّان بتقييم داخل السياق.
const setRefs = (ctx, el, video) => {
  ctx.__el = el; ctx.__v = video;
  vm.runInContext("vzFsRequestedEl = __el; vzFsRequestedVideo = __v;", ctx);
};
const refs = (ctx) => vm.runInContext("[vzFsRequestedEl, vzFsRequestedVideo]", ctx);

function enter(shape) {
  const { ctx, doc } = makeWorld();
  const video = doc.__register(node("VIDEO", "", shape.video));
  const el = doc.__register(node("DIV", "wrap", shape.container));
  video.parentElement = el;
  setRefs(ctx, el, video);
  doc.fullscreenElement = el;
  doc.__fire("fullscreenchange");
  return { ctx, doc, video, el };
}

if (!READY) {
  console.log("\n⛔ لا كتلة #58 كومِت ب في content.js — تُتخطّى فحوص السلوك");
  fail += 6;
}

if (READY) {
console.log("\n[1] شرط القبول الأول — البوابة ترفض حيث الفيديو يملأ (d.tube أولاً)");
{
  let stamped = 0, refused = 0;
  for (const shape of SHAPES) {
    const { video, el } = enter(shape);
    const marked = el.hasAttribute("data-vz-fs") && video.hasAttribute("data-vz-fs-video");
    if (marked) stamped++; else refused++;
    check(`${shape.key} ⇒ ${shape.expectStamp ? "تُضاف السمة" : "**ترفض**"}`,
      marked === shape.expectStamp, `حصلنا على ${marked ? "مُضافة" : "مرفوضة"}`);
  }
  check("العدّ: ثلاث بنيات وُسِمت لا أكثر", stamped === 3, stamped);
  check("والباقيات رُفضت", refused === SHAPES.length - 3, refused);
}

console.log("\n[2] الحقن الكسول — لا بايت CSS للموقع الذي ترفض بوابته");
{
  const dtube = SHAPES.find((s) => s.key.startsWith("ي"));
  const r = enter(dtube);
  check("بصمة d.tube: صفر ورقة أنماط", r.doc.__styles().length === 0, r.doc.__styles().length);

  const j = enter(SHAPES[0]);
  check("البنية ج: أُدخلت ورقة واحدة", j.doc.__styles().length === 1, j.doc.__styles().length);
  const css = j.doc.__styles()[0]?.textContent || "";
  check("القاعدة محصورة بالسمتين معاً",
    /\[data-vz-fs\]:fullscreen video\[data-vz-fs-video\]/.test(css), css.slice(0, 120));
  check("فيها object-fit:contain — بلا تشويه النسبة", /object-fit:contain!important/.test(css));
  check("وتُصفّر max-width و max-height", /max-width:none!important/.test(css) && /max-height:none!important/.test(css));
  check("ولا محدِّد بلا سمة", !/^\s*video\s*\{/m.test(css));
}

console.log("\n[3] لا سمة حيث لا معنى للقاعدة");
{
  const { ctx, doc } = makeWorld();
  const video = doc.__register(node("VIDEO", "", [640, 360]));
  setRefs(ctx, video, video);        // كبّرنا الفيديو نفسه (البنيتان ب و ط)
  doc.fullscreenElement = video;
  doc.__fire("fullscreenchange");
  check("المكبَّر هو الفيديو ⇒ صفر سمة", !video.hasAttribute("data-vz-fs-video"));
  check("وصفر ورقة أنماط", doc.__styles().length === 0);
}
{
  const { ctx, doc } = makeWorld();   // مسار الزر الأصلي: لا تسجيل إطلاقاً
  doc.fullscreenElement = doc.__register(node("DIV", "video-js", SCREEN));
  doc.__fire("fullscreenchange");
  const [rEl, rV] = refs(ctx);
  check("مسار الزر الأصلي ⇒ لا مرجع ولا سمة", rEl === null && rV === null);
  check("وصفر ورقة أنماط", doc.__styles().length === 0);
}

console.log("\n[4] الإزالة في كل مخارج ملء الشاشة — مُختبَرة لا مفترضة");
{
  const exits = [
    ["Esc / خروج عادي", (doc) => { doc.fullscreenElement = null; }],
    ["خروج يبدؤه الموقع", (doc) => { doc.fullscreenElement = null; }],
    ["عنصر آخر يذهب لملء الشاشة", (doc, w) => { doc.fullscreenElement = doc.__register(node("DIV", "other", SCREEN)); }]
  ];
  for (const [name, mutate] of exits) {
    const r = enter(SHAPES[0]);
    check(`${name}: السمة موجودة قبل الخروج`,
      r.el.hasAttribute("data-vz-fs") && r.video.hasAttribute("data-vz-fs-video"));
    mutate(r.doc, r);
    r.doc.__fire("fullscreenchange");
    check(`${name}: صفر سمة بعده`,
      !r.el.hasAttribute("data-vz-fs") && !r.video.hasAttribute("data-vz-fs-video"),
      JSON.stringify({ el: r.el.attrs, v: r.video.attrs }));
    const [eEl, eV] = refs(r.ctx);
    check(`${name}: المرجعان صُفِّرا`, eEl === null && eV === null);
  }

  // fullscreenerror
  const e = enter(SHAPES[0]);
  e.doc.__fire("fullscreenerror");
  check("fullscreenerror ⇒ صفر سمة",
    !e.el.hasAttribute("data-vz-fs") && !e.video.hasAttribute("data-vz-fs-video"));

  // شاردة نجت من إعادة بناء الموقع: المسح يلتقطها ولو ضاع المرجع
  const s = enter(SHAPES[0]);
  const orphan = s.doc.__register(node("DIV", "orphan", SCREEN));
  orphan.setAttribute("data-vz-fs", "");
  setRefs(s.ctx, null, null);
  s.ctx.clearFsFillMarks();
  check("مسح المستند يلتقط الشاردة بلا مرجع", !orphan.hasAttribute("data-vz-fs"));
}

console.log("\n[5] دورات متكرّرة لا تتراكم");
{
  const r = enter(SHAPES[0]);
  for (let i = 0; i < 5; i++) {
    r.doc.fullscreenElement = null; r.doc.__fire("fullscreenchange");
    setRefs(r.ctx, r.el, r.video);
    r.doc.fullscreenElement = r.el; r.doc.__fire("fullscreenchange");
  }
  check("ورقة أنماط واحدة بعد خمس دورات", r.doc.__styles().length === 1, r.doc.__styles().length);
  r.doc.fullscreenElement = null; r.doc.__fire("fullscreenchange");
  check("وانتهت بلا سمة", !r.el.hasAttribute("data-vz-fs") && !r.video.hasAttribute("data-vz-fs-video"));
}
}

console.log("\n[6] البوابة تستعمل الثابت نفسه لا رقماً ثانياً");
{
  const CODE = CONTENT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  check("0.95 مرة واحدة في الكود", (CODE.match(/0\.95/g) || []).length === 1, (CODE.match(/0\.95/g) || []).length);
  check("البوابة تنادي videoFillsElement", /if\s*\(videoFillsElement\(video,\s*el\)\)\s*return false/.test(CONTENT));
  check("ولا نسبة أخرى في مسار البوابة", !/0\.9(?!5)|0\.8|>=\s*0\.[0-9]+/.test(CODE.split("applyFsFillIfNeeded")[1]?.slice(0, 600) || ""));
}

console.log("\n[7] الترتيب: التسجيل بعد مسار الزر الأصلي لا قبله");
{
  const squash = (s) => s.replace(/\s+/g, "");
  const s = squash(CONTENT);
  const iBtn = s.indexOf("constnativeBtn=findNativeFullscreenButton(v)");
  const iSet = s.indexOf("vzFsRequestedEl=container");
  check("مسار الزر الأصلي أولاً", iBtn > -1 && iBtn < iSet, `${iBtn}/${iSet}`);
  check("والتسجيل بعده", iSet > -1);
  check("ورفض الوعد يُصفّر السمات", /clearFsFillMarks\(\);\s*notifyVideoActionFailed/.test(CONTENT));
  check("ومستمعا الخروج مسجَّلان",
    /addEventListener\("fullscreenchange",\s*syncFsFillMarks\)/.test(CONTENT) &&
    /addEventListener\("fullscreenerror",\s*clearFsFillMarks\)/.test(CONTENT));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
