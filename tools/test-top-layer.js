// البند #47 — الـ overlay يصعد إلى الطبقة العليا بـ popover حين يكون عنصر ملء
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تظهر الشبكة فوق الفيديو حين يكون الفيديو نفسُه في ملء الشاشة؟»*
// الشاشة هو <video> نفسه.
//
// هذا **تحصين لا إصلاح عطب يومي**: القياس الميداني على ثمانية مواقع (2026-07-29)
// أظهر أن الحالة لا تقع اليوم. فالشرط الأول على هذا الاختبار ليس أن يثبت أن
// الطبقة العليا تعمل، بل أن يثبت أن **المسار الحالي لم يتغيّر بشيء**: لا سمة
// popover تُضاف، ولا استدعاء يقع، في أي حالة غير الحالة المعطوبة وحدها.
//
// المسارات الثلاثة المطلوبة: عادي · ملء شاشة بحاوية أعلى · ملء شاشة بالفيديو نفسه.
const fs = require("fs");
const vm = require("vm");

// يُرجع null بدل أن يرمي: على الكود السابق لا وجود لـ fullscreenElementFor،
// والمطلوب أن يفشل الاختبار **بعدّ** لا أن ينهار قبل أن يقول شيئاً.
function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  return a === -1 || b === -1 ? null : t.slice(a, b);
}
const SRC = "content.js";
const CONTENT = fs.readFileSync(SRC, "utf8");
const HOST_PICK = slice(SRC, "function fullscreenElementFor", "function positionOverlayToVideo");
const ATTACH = slice(SRC, "function attachOverlayToHost", "function teardownOverlay");
const CSS = slice(SRC, "const OVERLAY_CSS", "function injectOverlayCSS") || "";
const READY = !!(HOST_PICK && ATTACH);

// ---------------------------------------------------------------- fake DOM
// أمين على النقطتين اللتين يدور عليهما البند: نقل العنصر في الـ DOM **يُغلق**
// أي popover مفتوح، و showPopover يرمي إن كان مفتوحاً أو بلا سمة popover.
function node(tag, extra = {}) {
  return {
    tagName: tag,
    childNodes: [],
    parentNode: null,
    adoptedStyleSheets: [],
    attrs: {},
    popoverOpen: false,
    calls: [],
    failShow: false,
    hasAttribute(n) { return n in this.attrs; },
    getAttribute(n) { return this.attrs[n] ?? null; },
    setAttribute(n, v) { this.attrs[n] = String(v); this.calls.push(`set:${n}=${v}`); },
    removeAttribute(n) { delete this.attrs[n]; this.calls.push(`remove:${n}`); },
    matches(sel) {
      if (sel === ":popover-open") return this.popoverOpen;
      throw new Error("محدِّد غير مدعوم: " + sel);
    },
    showPopover() {
      this.calls.push("showPopover");
      if (!this.hasAttribute("popover")) throw new Error("NotSupportedError");
      if (this.popoverOpen) throw new Error("InvalidStateError");
      if (this.failShow) throw new Error("فشل مفتعل");
      this.popoverOpen = true;
    },
    hidePopover() {
      this.calls.push("hidePopover");
      this.popoverOpen = false;
    },
    appendChild(child) {
      if (child.parentNode) {
        const i = child.parentNode.childNodes.indexOf(child);
        if (i >= 0) child.parentNode.childNodes.splice(i, 1);
        // إزالة العنصر من الـ DOM تُغلق أي popover مفتوح — سلوك المتصفح.
        if (child.popoverOpen) { child.popoverOpen = false; child.calls.push("closedByMove"); }
      }
      child.parentNode = this;
      this.childNodes.push(child);
      return child;
    },
    contains(other) {
      for (let p = other; p; p = p.parentNode) if (p === this) return true;
      return false;
    },
    getRootNode() {
      let p = this;
      while (p.parentNode) p = p.parentNode;
      return p;
    },
    ...extra
  };
}

function shadowRootFor(host) {
  const root = node("#shadow-root", { host });
  root.getRootNode = () => root;
  return root;
}

// popover: true ⇒ متصفح يدعم الطبقة العليا. false ⇒ متصفح قديم، ويجب أن يبقى
// السلوك مطابقاً لما قبل البند حرفياً.
function makeWorld({ popover = true } = {}) {
  const doc = node("#document");
  const body = node("BODY");
  doc.appendChild(body);
  doc.body = body;
  doc.documentElement = node("HTML");
  doc.fullscreenElement = null;
  doc.createElement = (t) => node(t.toUpperCase(), { textContent: "" });

  const ctx = {
    document: doc,
    OVERLAY_CSS: ".vzWrap{position:fixed}",
    CSSStyleSheet: class { replaceSync(t) { this.cssText = t; } },
    vzOverlay: node("DIV"),
    vzOverlayHost: null,
    vzOverlayVideo: null,
    console
  };
  if (popover) ctx.HTMLElement = function HTMLElement() {};
  if (popover) ctx.HTMLElement.prototype.showPopover = function () {};
  vm.createContext(ctx);
  vm.runInContext(HOST_PICK + "\n" + ATTACH, ctx);
  ctx.body = body;
  return ctx;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// دورة إلحاق واحدة بترتيب ensureVideoOverlay نفسه
const attachFor = (ctx, video) => {
  ctx.vzOverlayVideo = video;
  ctx.attachOverlayToHost(ctx.preferredOverlayHost(video));
};
const ov = (ctx) => ctx.vzOverlay;
const untouched = (ctx) => ov(ctx).calls.length === 0 && !ov(ctx).hasAttribute("popover");

if (!READY) {
  console.log("\n⛔ لا fullscreenElementFor في content.js — تُتخطّى فحوص الـ DOM");
  fail++;
}

if (READY) {
console.log("\n[1] المسار العادي — بلا ملء شاشة: لا يُلمس شيء إطلاقاً");
{
  const ctx = makeWorld();
  const player = ctx.body.appendChild(node("DIV"));
  const video = player.appendChild(node("VIDEO"));

  attachFor(ctx, video);
  check("الأب هو body كما كان", ov(ctx).parentNode === ctx.body, ov(ctx).parentNode?.tagName);
  check("لا سمة popover", !ov(ctx).hasAttribute("popover"));
  check("صفر استدعاء على الـ overlay — المسار لم يُلمس", untouched(ctx), ov(ctx).calls);

  // عشر دورات متتالية: ولا استدعاء واحد
  for (let i = 0; i < 10; i++) attachFor(ctx, video);
  check("بعد عشر دورات: ما زال صفر استدعاء", untouched(ctx), ov(ctx).calls);
}

console.log("\n[2] ملء شاشة بحاوية أعلى — المسار الذي يعمل اليوم، بلا تغيير");
{
  const ctx = makeWorld();
  const player = ctx.body.appendChild(node("DIV"));
  const video = player.appendChild(node("VIDEO"));

  attachFor(ctx, video);
  ctx.document.fullscreenElement = player;
  attachFor(ctx, video);
  check("الأب هو الحاوية المكبَّرة", ov(ctx).parentNode === player, ov(ctx).parentNode?.tagName);
  check("لا سمة popover — لا حاجة للطبقة العليا", !ov(ctx).hasAttribute("popover"));
  check("صفر استدعاء", untouched(ctx), ov(ctx).calls);

  ctx.document.fullscreenElement = null;
  attachFor(ctx, video);
  check("بعد الخروج: عاد إلى body", ov(ctx).parentNode === ctx.body);
  check("وما زال بلا أي استدعاء", untouched(ctx), ov(ctx).calls);
}

console.log("\n[3] ملء شاشة بالفيديو نفسه — الحالة المعطوبة");
{
  const ctx = makeWorld();
  const player = ctx.body.appendChild(node("DIV"));
  const video = player.appendChild(node("VIDEO"));
  attachFor(ctx, video);

  ctx.document.fullscreenElement = video;          // العنصر المكبَّر هو الفيديو
  attachFor(ctx, video);
  check("لم يُلحَق داخل <video> — أبناؤه محتوى بديل لا يُرسم",
    ov(ctx).parentNode !== video, ov(ctx).parentNode?.tagName);
  check("بقي في body", ov(ctx).parentNode === ctx.body, ov(ctx).parentNode?.tagName);
  check("سمة popover أُضيفت", ov(ctx).hasAttribute("popover"));
  check("وقيمتها manual لا auto", ov(ctx).getAttribute("popover") === "manual",
    ov(ctx).getAttribute("popover"));
  check("رُفع إلى الطبقة العليا فعلاً", ov(ctx).popoverOpen);
  check("showPopover مرة واحدة",
    ov(ctx).calls.filter((c) => c === "showPopover").length === 1, ov(ctx).calls);

  // إلحاق متكرّر وهو مفتوح: لا يُعاد فتحه ولا يرمي
  ov(ctx).calls.length = 0;
  attachFor(ctx, video);
  attachFor(ctx, video);
  check("الإلحاق المتكرّر لا يُعيد الفتح", ov(ctx).calls.length === 0, ov(ctx).calls);
  check("وما زال مفتوحاً", ov(ctx).popoverOpen);

  ctx.document.fullscreenElement = null;           // الخروج
  attachFor(ctx, video);
  check("بعد الخروج: أُغلق", !ov(ctx).popoverOpen);
  check("وأُزيلت السمة فلا display:none", !ov(ctx).hasAttribute("popover"));
  check("عاد الأب إلى body", ov(ctx).parentNode === ctx.body);
}

console.log("\n[4] المسارات الثلاثة داخل جذر ظل");
{
  const ctx = makeWorld();
  const host = ctx.body.appendChild(node("VZ-TEST-PLAYER"));
  const root = shadowRootFor(host);
  const wrapper = root.appendChild(node("DIV"));
  const video = wrapper.appendChild(node("VIDEO"));

  attachFor(ctx, video);
  check("عادي: الأب جذر الظل بلا popover",
    ov(ctx).parentNode === root && !ov(ctx).hasAttribute("popover"));

  // ملء شاشة بحاوية: document.fullscreenElement يُعاد استهدافه إلى المضيف
  ctx.document.fullscreenElement = host;
  root.fullscreenElement = wrapper;
  attachFor(ctx, video);
  check("حاوية أعلى: الأب هو الحاوية بلا popover",
    ov(ctx).parentNode === wrapper && !ov(ctx).hasAttribute("popover"),
    ov(ctx).parentNode?.tagName);

  // ملء شاشة بالفيديو نفسه داخل الظل
  root.fullscreenElement = video;
  attachFor(ctx, video);
  check("الفيديو نفسه: الأب جذر الظل لا الفيديو",
    ov(ctx).parentNode === root, ov(ctx).parentNode?.tagName);
  check("ورُفع إلى الطبقة العليا", ov(ctx).popoverOpen && ov(ctx).hasAttribute("popover"));

  ctx.document.fullscreenElement = null;
  root.fullscreenElement = null;
  attachFor(ctx, video);
  check("بعد الخروج: أُغلق وأُزيلت السمة",
    !ov(ctx).popoverOpen && !ov(ctx).hasAttribute("popover"));
}

console.log("\n[5] نقل العنصر يُغلق الـ popover ⇒ يُعاد فتحه بعد كل نقلة");
{
  const ctx = makeWorld();
  const host = ctx.body.appendChild(node("VZ-TEST-PLAYER"));
  const root = shadowRootFor(host);
  const video = root.appendChild(node("VIDEO"));

  root.fullscreenElement = video;
  attachFor(ctx, video);
  check("مفتوح داخل جذر الظل", ov(ctx).popoverOpen && ov(ctx).parentNode === root);

  // انتقال إلى حاوية ثم عودة إلى حالة الفيديو المكبَّر: النقلة تُغلقه
  const wrapper = root.appendChild(node("DIV"));
  root.fullscreenElement = wrapper;
  attachFor(ctx, video);
  check("انتقل إلى الحاوية وأُغلق وأُزيلت السمة",
    ov(ctx).parentNode === wrapper && !ov(ctx).popoverOpen && !ov(ctx).hasAttribute("popover"));

  root.fullscreenElement = video;
  attachFor(ctx, video);
  check("رجع إلى جذر الظل ورُفع من جديد",
    ov(ctx).parentNode === root && ov(ctx).popoverOpen);
}

console.log("\n[6] خمس دورات كاملة — لا تراكم ولا تسرّب");
{
  const ctx = makeWorld();
  const player = ctx.body.appendChild(node("DIV"));
  const video = player.appendChild(node("VIDEO"));
  attachFor(ctx, video);
  ov(ctx).calls.length = 0;

  for (let i = 0; i < 5; i++) {
    ctx.document.fullscreenElement = video;
    attachFor(ctx, video);
    ctx.document.fullscreenElement = null;
    attachFor(ctx, video);
  }
  const shows = ov(ctx).calls.filter((c) => c === "showPopover").length;
  const hides = ov(ctx).calls.filter((c) => c === "hidePopover").length;
  check("خمس رفعات لا أكثر", shows === 5, shows);
  check("وخمس إغلاقات", hides === 5, hides);
  check("انتهى مغلقاً بلا سمة", !ov(ctx).popoverOpen && !ov(ctx).hasAttribute("popover"));
  check("والأب body", ov(ctx).parentNode === ctx.body);
}

console.log("\n[7] فشل الرفع لا يترك display:none — درس البند #50");
{
  const ctx = makeWorld();
  const player = ctx.body.appendChild(node("DIV"));
  const video = player.appendChild(node("VIDEO"));
  ov(ctx).failShow = true;

  ctx.document.fullscreenElement = video;
  attachFor(ctx, video);
  check("حاول الرفع", ov(ctx).calls.includes("showPopover"));
  check("وفشل", !ov(ctx).popoverOpen);
  check("فأُزيلت السمة فوراً — لا إخفاء دائم", !ov(ctx).hasAttribute("popover"), ov(ctx).attrs);
}

console.log("\n[8] متصفح بلا دعم popover — السلوك مطابق لما قبل البند");
{
  const ctx = makeWorld({ popover: false });
  const player = ctx.body.appendChild(node("DIV"));
  const video = player.appendChild(node("VIDEO"));

  ctx.document.fullscreenElement = video;
  attachFor(ctx, video);
  check("لا سمة ولا استدعاء", untouched(ctx), ov(ctx).calls);
  check("والأب body لا <video>", ov(ctx).parentNode === ctx.body, ov(ctx).parentNode?.tagName);

  ctx.document.fullscreenElement = null;
  attachFor(ctx, video);
  check("وبعد الخروج ما زال صفر استدعاء", untouched(ctx), ov(ctx).calls);
}
}

console.log("\n[9] الأنماط — القاعدة مقيَّدة بالسمة ولا تمسّ المسار العادي");
{
  const rule = /\.vzWrap\[popover\]\{([^}]*)\}/.exec(CSS.replace(/\s+/g, ""));
  check("قاعدة .vzWrap[popover] موجودة", !!rule);
  for (const prop of ["inset:auto", "margin:0", "border:0", "padding:0",
                      "background:transparent", "overflow:visible"]) {
    check(`تُصفّر ${prop}`, (rule?.[1] || "").includes(prop), rule?.[1]);
  }
  check("لا width/height في القاعدة — السطرية هي المصدر",
    !/width|height/.test(rule?.[1] || ""), rule?.[1]);
  check("::backdrop شفاف ولا يلتقط النقر",
    /\.vzWrap::backdrop\{background:transparent;pointer-events:none;\}/.test(CSS.replace(/\s+/g, "")));
  // لا قاعدة popover بلا قيد السمة: لو انفلتت لأصابت المسار العادي
  check("لا قاعدة popover غير مقيَّدة بـ [popover]",
    !/(^|[^\]])\.vzWrap\{[^}]*popover/.test(CSS));
}

console.log("\n[10] فحص بنيوي في content.js");
{
  check("manual لا auto", /setAttribute\("popover",\s*"manual"\)/.test(CONTENT));
  check("لا popover=auto في أي موضع", !/"popover",\s*"auto"/.test(CONTENT));
  check("مصدر واحد لعنصر ملء الشاشة",
    (CONTENT.match(/function fullscreenElementFor/g) || []).length === 1);
  check("preferredOverlayHost لا تقرأ fullscreenElement مباشرة",
    !/function preferredOverlayHost[\s\S]{0,700}?(document|root)\.fullscreenElement/.test(CONTENT));
  check("الرفع يمرّ من attachOverlayToHost وحدها",
    (CONTENT.match(/setOverlayTopLayer\(overlayNeedsTopLayer/g) || []).length === 1);
  check("لا مستمع popover جديد", !/addEventListener\(\s*["'](toggle|beforetoggle)["']/.test(CONTENT));
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
