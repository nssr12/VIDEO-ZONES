// Audit #46: after a fullscreen round-trip the overlay was never moved back.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تعود الشبكة إلى مكانها بعد الخروج من ملء الشاشة؟»*
//
// attachOverlayToHost guarded with host.contains(vzOverlay). Once the overlay
// had been parked inside ANY element under <body> — which is what a fullscreen
// enter does — document.body.contains() answered "already here" on the way out,
// so the overlay stayed parked for the rest of the page's life. On YouTube the
// symptom is invisible because #movie_player has a layout box; inside a shadow
// host without a <slot> the overlay has no box at all and simply disappears.
//
// The second half: document.fullscreenElement is RETARGETED to the shadow host,
// so the old code picked a container that can never render children.
//
// This test must FAIL on the pre-fix content.js — that is the point of it.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}
const SRC = "content.js";
// يبدأ من fullscreenElementFor لا من preferredOverlayHost: الأولى هي المصدر
// الواحد لعنصر ملء الشاشة وتستدعيها الثانية (البند #47).
const HOST_PICK = slice(SRC, "function fullscreenElementFor", "function positionOverlayToVideo");
const ATTACH = slice(SRC, "function attachOverlayToHost", "function teardownOverlay");

// ---------------------------------------------------------------- fake DOM
// Faithful on the two points the bug turns on: appendChild re-parents, and
// contains() walks the whole ancestor chain (not just direct children).
function node(tag, extra = {}) {
  return {
    tagName: tag,
    childNodes: [],
    parentNode: null,
    adoptedStyleSheets: [],
    // البند #47: attachOverlayToHost صار يمرّ بـ setOverlayTopLayer، وهي تسأل
    // عن السمة. لا دعم popover في هذا العالم فالمسار كلّه لا يُلمس — وهذا
    // بالضبط ما يجب أن يبقى صحيحاً هنا. تغطيته في tools/test-top-layer.js
    attrs: {},
    hasAttribute(n) { return n in this.attrs; },
    setAttribute(n, v) { this.attrs[n] = String(v); },
    removeAttribute(n) { delete this.attrs[n]; },
    appendChild(child) {
      if (child.parentNode) {
        const i = child.parentNode.childNodes.indexOf(child);
        if (i >= 0) child.parentNode.childNodes.splice(i, 1);
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

// A shadow root is its own root and carries .host — that is how the production
// code tells it apart from the document.
function shadowRootFor(host) {
  const root = node("#shadow-root", { host });
  root.getRootNode = () => root;
  host.__shadowRoot = root;
  return root;
}

function makeWorld() {
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
  vm.createContext(ctx);
  vm.runInContext(HOST_PICK + "\n" + ATTACH, ctx);
  ctx.body = body;
  return ctx;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// Runs one attach cycle exactly as ensureVideoOverlay / fullscreenchange do —
// including setting vzOverlayVideo first, which is the order in ensureVideoOverlay.
const attachFor = (ctx, video) => {
  ctx.vzOverlayVideo = video;
  ctx.attachOverlayToHost(ctx.preferredOverlayHost(video));
};
const parentOf = (ctx) => ctx.vzOverlay.parentNode;

console.log("\n[1] المسار العادي — فيديو في DOM عادي بلا ملء شاشة");
{
  const ctx = makeWorld();
  const player = ctx.body.appendChild(node("DIV"));
  const video = player.appendChild(node("VIDEO"));

  attachFor(ctx, video);
  check("الأب هو body", parentOf(ctx) === ctx.body, parentOf(ctx)?.tagName);
  check("لا أنماط مُتبنّاة في المسار العادي — صفر تكلفة",
    ctx.document.adoptedStyleSheets.length === 0 && ctx.body.adoptedStyleSheets.length === 0);
}

console.log("\n[2] دورة ملء شاشة كاملة في DOM عادي — العطب ليس خاصاً بجذور الظل");
{
  const ctx = makeWorld();
  const player = ctx.body.appendChild(node("DIV"));
  const video = player.appendChild(node("VIDEO"));

  attachFor(ctx, video);
  check("قبل: الأب body", parentOf(ctx) === ctx.body, parentOf(ctx)?.tagName);

  ctx.document.fullscreenElement = player;          // دخول ملء الشاشة
  attachFor(ctx, video);
  check("أثناء: الأب هو عنصر ملء الشاشة", parentOf(ctx) === player, parentOf(ctx)?.tagName);

  ctx.document.fullscreenElement = null;            // خروج
  attachFor(ctx, video);
  check("بعد الخروج: عاد الأب إلى body", parentOf(ctx) === ctx.body, parentOf(ctx)?.tagName);
  check("لم يبقَ عالقاً داخل عنصر ملء الشاشة", !player.childNodes.includes(ctx.vzOverlay));
}

console.log("\n[3] فيديو داخل جذر ظل — بلا ملء شاشة يبقى داخل جذر الظل");
{
  const ctx = makeWorld();
  const host = ctx.body.appendChild(node("VZ-TEST-PLAYER"));
  const root = shadowRootFor(host);
  const video = root.appendChild(node("VIDEO"));

  const picked = ctx.preferredOverlayHost(video);
  check("المضيف المختار ليس مضيف الظل (بلا slot لا يُرسم)", picked !== host, picked?.tagName);
  check("المضيف المختار هو جذر الظل", picked === root);

  attachFor(ctx, video);
  check("الأب هو جذر الظل", parentOf(ctx) === root);
  check("وصلت الأنماط داخل جذر الظل", root.adoptedStyleSheets.length === 1);
  check("نصّ الأنماط هو OVERLAY_CSS نفسه",
    root.adoptedStyleSheets[0]?.cssText === ctx.OVERLAY_CSS);
}

console.log("\n[4] دورة ملء شاشة كاملة داخل مكوّن ويب");
{
  const ctx = makeWorld();
  const host = ctx.body.appendChild(node("VZ-TEST-PLAYER"));
  const root = shadowRootFor(host);
  const video = root.appendChild(node("VIDEO"));

  // زر ملء الشاشة الأصلي يكبّر الفيديو نفسه:
  // document.fullscreenElement يُعاد استهدافه إلى المضيف، والجذر وحده يعرف الحقيقة
  ctx.document.fullscreenElement = host;
  root.fullscreenElement = video;
  const picked = ctx.preferredOverlayHost(video);
  check("لم يُختر المضيف المُعاد استهدافه", picked !== host, picked?.tagName);
  check("لم يُختر <video> — أبناؤه محتوى بديل لا يُرسم", picked !== video, picked?.tagName);

  attachFor(ctx, video);
  ctx.document.fullscreenElement = null;
  root.fullscreenElement = null;
  attachFor(ctx, video);
  check("بعد الخروج: الأب جذر الظل لا المضيف", parentOf(ctx) === root, parentOf(ctx)?.tagName);
  check("لم يعلق داخل المضيف", !host.childNodes.includes(ctx.vzOverlay));
}

console.log("\n[5] ملء شاشة على حاوية داخل جذر الظل");
{
  const ctx = makeWorld();
  const host = ctx.body.appendChild(node("VZ-TEST-PLAYER"));
  const root = shadowRootFor(host);
  const wrapper = root.appendChild(node("DIV"));
  const video = wrapper.appendChild(node("VIDEO"));

  ctx.document.fullscreenElement = host;   // مُعاد استهدافه
  root.fullscreenElement = wrapper;        // الحقيقة
  attachFor(ctx, video);
  check("الأب هو الحاوية المكبَّرة داخل الظل", parentOf(ctx) === wrapper, parentOf(ctx)?.tagName);

  ctx.document.fullscreenElement = null;
  root.fullscreenElement = null;
  attachFor(ctx, video);
  check("بعد الخروج: عاد إلى جذر الظل", parentOf(ctx) === root, parentOf(ctx)?.tagName);
}

console.log("\n[6] الأنماط تُتبنّى مرة واحدة لكل جذر مهما تكرّر التنقّل");
{
  const ctx = makeWorld();
  const host = ctx.body.appendChild(node("VZ-TEST-PLAYER"));
  const root = shadowRootFor(host);
  const wrapper = root.appendChild(node("DIV"));
  const video = wrapper.appendChild(node("VIDEO"));

  for (let i = 0; i < 5; i++) {
    ctx.document.fullscreenElement = host;
    root.fullscreenElement = wrapper;
    attachFor(ctx, video);
    ctx.document.fullscreenElement = null;
    root.fullscreenElement = null;
    attachFor(ctx, video);
  }
  check("ورقة أنماط واحدة بعد 5 دورات", root.adoptedStyleSheets.length === 1,
    root.adoptedStyleSheets.length);
  check("الأب الأخير هو جذر الظل", parentOf(ctx) === root);
}

console.log("\n[7] استدعاء متكرّر بنفس المضيف لا يُعيد الإلحاق");
{
  const ctx = makeWorld();
  const player = ctx.body.appendChild(node("DIV"));
  const video = player.appendChild(node("VIDEO"));
  attachFor(ctx, video);
  const before = ctx.body.childNodes.length;
  attachFor(ctx, video);
  attachFor(ctx, video);
  check("لم يتضاعف العنصر", ctx.body.childNodes.length === before, ctx.body.childNodes.length);
  check("vzOverlayHost محدَّث", ctx.vzOverlayHost === ctx.body);
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
