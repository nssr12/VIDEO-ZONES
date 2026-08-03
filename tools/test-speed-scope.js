// حارسا #94 و#96 — الزرّ لا يُرسم في نطاقٍ أدواتُه مخفيّة، والشريط من النطاق لا المستند.
//
// ⚠️ **حارسان لا واحد (أمر المالك)، وكلاهما سلوكيّ لا نصّيّ:** الأوّل يُحمّر إن
// رُسم الزرّ في نطاقٍ أدواتُه مخفيّة (**#94**)، والثاني يُحمّر إن طُلب الشريط من
// المستند بدل نطاق الفيديو (**#96**) — **والثاني يجعل العطب مستحيلاً بالبناء لا
// محروساً بحارس المستطيل الصفريّ** (قرار 16ج).
//
// ⚠️ **والدوالّ تُقرأ من `content.js` وتُقيَّم — لا تُنسخ ولا تُحاكى.** حارسٌ
// يُعيد كتابة ما يحرسه يقيس نفسه. والثوابت (`VZ_PLAYER_SCOPE_MAX_AREA` ·
// `PLAYER_CONTROL_SELECTOR` · `KNOWN_PLAYER_WRAPPER_SELECTOR` · العمق) تُستخرج من
// المصدر نفسه، **فرقمٌ يتغيّر في المنتج يتغيّر هنا معه**.
//
// ── والبنيات المقيسة هي التي بُني عليها القرار (2026-08-03) ─────────────────
//   · معاينة يوتيوب : `#inline-preview-player` بصفر أداة مرئية      ⇒ **امتناع**
//   · watch         : `#movie_player` بتسعة أزرار ومنزلق             ⇒ **رسم**
//   · فيميو         : `div.vp-video` بصفر أداة **والأدوات في `#player` ×1** ⇒ **رسم**
//   · فيديو خام     : بلا حاوية ولا شريط                              ⇒ **رسم**
//   · تويتش/`d.tube`: أدواتٌ تتلاشى بالسكون                          ⇒ **تثبيت**
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ── استخراجٌ بمطابقة الأقواس — لا نسخ ولا إعادة كتابة ───────────────────────
function fn(name) {
  const start = SRC.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`لم تُوجد الدالّة ${name} في content.js`);
  let depth = 0, i = SRC.indexOf("{", start);
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === "{") depth++;
    else if (SRC[j] === "}") { depth--; if (depth === 0) return SRC.slice(start, j + 1); }
  }
  throw new Error(`تعذّر إغلاق ${name}`);
}
// ⚠️ **الفاصلة المنقوطة قد يتبعها تعليقٌ في السطر نفسه** — والالتقاط حتى `;\n`
// وحده يبتلع الثابتَ التالي معه: **`;` نهايةُ جملةٍ لا نهايةُ سطر**.
function constOf(name) {
  const m = SRC.match(new RegExp(`const\\s+${name}\\s*=([\\s\\S]*?);(?=[ \\t]*(//[^\\n]*)?\\n)`));
  if (!m) throw new Error(`لم يُوجد الثابت ${name}`);
  return m[1].trim();
}

// ── DOM مصغَّر: ما تحتاجه الدوالّ بالضبط، ولا شيء غيره ──────────────────────
function makeDom() {
  const all = [];
  function el(tag, opts = {}) {
    const node = {
      nodeType: 1, tagName: tag.toUpperCase(), id: opts.id || "",
      className: opts.cls || "", attrs: opts.attrs || {},
      children: [], parentElement: null, isConnected: true,
      rect: opts.rect || { width: 0, height: 0 },
      style: { display: opts.display || "block", visibility: opts.visibility || "visible",
               opacity: opts.opacity == null ? "1" : String(opts.opacity) },
      controls: !!opts.controls,
      getBoundingClientRect() { return { width: this.rect.width, height: this.rect.height }; },
      getAttribute(k) { return k === "role" ? (this.attrs.role || null) : (this.attrs[k] ?? null); },
      matches(sel) { return matchAny(this, sel); },
      closest(sel) { let n = this; while (n) { if (matchAny(n, sel)) return n; n = n.parentElement; } return null; },
      querySelectorAll(sel) { const out = []; walk(this, (c) => { if (c !== this && matchAny(c, sel)) out.push(c); }); return out; },
      querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
      append(...kids) { for (const k of kids) { k.parentElement = this; this.children.push(k); } return this; }
    };
    all.push(node);
    return node;
  }
  const walk = (n, f) => { f(n); for (const c of n.children) walk(c, f); };
  // مطابقٌ مصغَّر: وسم · `#id` · `.class` · `[a]` · `[a='b']` · وتركيبها (`a[href]`)
  function matchOne(node, tok) {
    const t = tok.trim();
    if (!t) return false;
    const m = t.match(/^([a-zA-Z]*)((?:[#.\[][^#.\[]*(?:\]|(?=[#.\[])|$))*)$/);
    if (!m) return false;
    if (m[1] && node.tagName !== m[1].toUpperCase()) return false;
    const rest = m[2] || "";
    const parts = rest.match(/[#.\[][^#.\[]*\]?/g) || [];
    for (const p of parts) {
      if (p[0] === "#") { if (node.id !== p.slice(1)) return false; }
      else if (p[0] === ".") {
        const cls = String(node.className || "").split(/\s+/);
        if (!cls.includes(p.slice(1))) return false;
      } else {
        const a = p.slice(1, -1).match(/^([^=]+)(?:=["']?([^"']*)["']?)?$/);
        if (!a) return false;
        const v = node.attrs[a[1]];
        if (v === undefined) return false;
        if (a[2] !== undefined && String(v) !== a[2]) return false;
      }
    }
    return !!(m[1] || parts.length);
  }
  const matchAny = (node, sel) => String(sel).split(",").some((t) => matchOne(node, t));
  return { el };
}

// ── السياق: الدوالّ الحقيقية من `content.js` فوق الـDOM المصغَّر ─────────────
function makeCtx(dom, { youtube = true } = {}) {
  const ctx = {
    document: { body: dom.body, documentElement: dom.html },
    getComputedStyle: (n) => n.style,
    isYouTubeFamilyHost: () => youtube,
    WeakMap,
    console
  };
  vm.createContext(ctx);
  vm.runInContext(`
    const KNOWN_PLAYER_WRAPPER_SELECTOR = ${constOf("KNOWN_PLAYER_WRAPPER_SELECTOR")};
    const FS_CONTAINER_MAX_DEPTH = ${constOf("FS_CONTAINER_MAX_DEPTH")};
    const VZ_PLAYER_SCOPE_MAX_AREA = ${constOf("VZ_PLAYER_SCOPE_MAX_AREA")};
    const PLAYER_CONTROL_SELECTOR = ${constOf("PLAYER_CONTROL_SELECTOR")};
    const YT_CONTROLS_SELECTOR = ${constOf("YT_CONTROLS_SELECTOR")};
    ${fn("isOwnElement")}
    ${fn("looksLikePlayer")}
    ${fn("playerScopeForVideo")}
    ${fn("isVisibleEl")}
    ${fn("scopeShowsOwnControls")}
    const speedBtnControlsLatch = new WeakMap();
    ${fn("videoOwnsControls")}
    ${fn("speedBtnHostSlot")}
  `, ctx);
  return ctx;
}

// ── البنيات ─────────────────────────────────────────────────────────────────
const R = (w, h) => ({ width: w, height: h });

function buildYouTube({ preview }) {
  const dom = makeDom();
  const html = dom.el("html"), body = dom.el("body");
  html.append(body);
  const player = dom.el("div", {
    id: preview ? "inline-preview-player" : "movie_player",
    cls: preview ? "html5-video-player ytp-hide-controls" : "html5-video-player",
    rect: R(504, 283)
  });
  const cont = dom.el("div", { cls: "html5-video-container", rect: R(504, 283) });
  const video = dom.el("video", { rect: R(504, 283) });
  cont.append(video);
  player.append(cont);
  if (!preview) {
    const bar = dom.el("div", { cls: "ytp-right-controls", rect: R(304, 40) });
    for (let i = 0; i < 9; i++) bar.append(dom.el("button", { cls: "ytp-button", rect: R(40, 40) }));
    bar.append(dom.el("div", { cls: "ytp-progress-bar", attrs: { role: "slider" }, rect: R(300, 5) }));
    player.append(bar);
  }
  body.append(player);
  dom.body = body; dom.html = html;
  return { dom, video, player };
}

// فيميو: الأدوات **خارج** ما يملؤه الفيديو، بنسبة مساحة ×1 — وهي التي أسقطت #58.
function buildVimeo() {
  const dom = makeDom();
  const html = dom.el("html"), body = dom.el("body");
  html.append(body);
  const outer = dom.el("div", { id: "player", cls: "player", rect: R(1440, 813) });
  const wrap = dom.el("div", { cls: "vp-video-wrapper", rect: R(1440, 813) });
  const vp = dom.el("div", { cls: "vp-video", rect: R(1440, 813) });
  const tele = dom.el("div", { cls: "vp-telecine", rect: R(1440, 813) });
  const video = dom.el("video", { rect: R(1440, 813) });
  tele.append(video); vp.append(tele); wrap.append(vp); outer.append(wrap);
  const controls = dom.el("div", { cls: "vp-controls", rect: R(1440, 60) });
  for (let i = 0; i < 11; i++) controls.append(dom.el("button", { rect: R(30, 30) }));
  outer.append(controls);
  body.append(outer);
  dom.body = body; dom.html = html;
  return { dom, video, outer, controls };
}

function buildRaw() {
  const dom = makeDom();
  const html = dom.el("html"), body = dom.el("body");
  html.append(body);
  const video = dom.el("video", { rect: R(640, 360) });
  body.append(video);
  dom.body = body; dom.html = html;
  return { dom, video };
}

// ── [1] #94 — الحكم على البنيات الأربع ──────────────────────────────────────
console.log("\n[1] #94 — «فيديوٌ يملك أدواته» على البنيات المقيسة");
{
  const yt = buildYouTube({ preview: false });
  const c1 = makeCtx(yt.dom);
  check("watch: نطاقه `#movie_player`",
    c1.playerScopeForVideo(yt.video) === yt.player);
  check("و**يُرسم** — تسعة أزرار ومنزلق مرئيّة", c1.videoOwnsControls(yt.video) === true);

  const pv = buildYouTube({ preview: true });
  const c2 = makeCtx(pv.dom);
  check("معاينة: نطاقها `#inline-preview-player`",
    c2.playerScopeForVideo(pv.video) === pv.player);
  check("و**يمتنع** — صفر أداة مرئية داخله", c2.videoOwnsControls(pv.video) === false);

  const vm1 = buildVimeo();
  const c3 = makeCtx(vm1.dom, { youtube: false });
  check("فيميو: النطاق **أبعدُ سلفٍ** لا أقربه (`#player` لا `.vp-video`)",
    c3.playerScopeForVideo(vm1.video) === vm1.outer,
    c3.playerScopeForVideo(vm1.video)?.className);
  check("و**يُرسم** — أدواته على بُعد مستوى", c3.videoOwnsControls(vm1.video) === true);

  const raw = buildRaw();
  const c4 = makeCtx(raw.dom, { youtube: false });
  check("فيديو خام: لا نطاق", c4.playerScopeForVideo(raw.video) === null);
  check("و**يُرسم** — لا مشغّل هنا فلا أحد أخفى شيئاً", c4.videoOwnsControls(raw.video) === true);
}

// ── [2] #94 — التثبيت: يُتّخذ مرّةً، ويُبطَل ببناءٍ جديد ────────────────────
console.log("\n[2] #94 — التثبيت عند أوّل ظهور، وإبطالُه ببناءٍ جديد");
{
  const yt = buildYouTube({ preview: false });
  const c = makeCtx(yt.dom);
  check("أوّلاً: يُرسم والأدوات ظاهرة", c.videoOwnsControls(yt.video) === true);
  // تلاشي الشريط كما قِيس على تويتش و`d.tube` (4⇒0 · 6⇒0)
  const bar = yt.player.querySelector(".ytp-right-controls");
  bar.style.opacity = "0";
  check("وبعد تلاشي الشريط **يبقى مرسوماً** — التثبيت", c.videoOwnsControls(yt.video) === true);
  check("والتلاشي حقيقيّ (لولا التثبيت لسقط)", c.scopeShowsOwnControls(yt.player) === false);
  // إعادة بناء المشغّل: نطاقٌ جديد لنفس الفيديو ⇒ الحكم يُعاد لا يُورَث
  const fresh = yt.dom.el("div", { id: "movie_player", cls: "html5-video-player", rect: R(504, 283) });
  const holder = yt.video.parentElement;
  holder.parentElement.children.length = 0;
  fresh.append(holder);
  yt.dom.body.children.length = 0;
  yt.dom.body.append(fresh);
  check("وإعادة بناء المشغّل **تُبطل التثبيت** — نطاقٌ بلا أدوات ⇒ امتناع",
    c.videoOwnsControls(yt.video) === false);
}

// ── [3] #96 — الشريط من النطاق لا من المستند ────────────────────────────────
console.log("\n[3] #96 — شريطٌ في مشغّلٍ آخر لا يُصاب");
{
  // الصفحة المقيسة: مشغّلٌ ساكن يحمل الشريط، ومعاينةٌ هي المُحوَّم عليها.
  const dom = makeDom();
  const html = dom.el("html"), body = dom.el("body");
  html.append(body);
  const idle = dom.el("div", { id: "movie_player", cls: "html5-video-player", rect: R(0, 0) });
  const idleBar = dom.el("div", { cls: "ytp-right-controls", rect: R(0, 0) });
  idle.append(idleBar);
  const live = dom.el("div", { id: "inline-preview-player", cls: "html5-video-player", rect: R(504, 283) });
  const video = dom.el("video", { rect: R(504, 283) });
  live.append(video);
  body.append(idle, live);
  dom.body = body; dom.html = html;
  const c = makeCtx(dom);
  check("الشريط الأجنبيّ موجودٌ في المستند فعلاً",
    dom.body.querySelector(".ytp-right-controls") === idleBar);
  check("**ولا يُصاب** — النطاق لا يحويه", c.speedBtnHostSlot(video) === null);

  // **وشاهدٌ يفصل السببين**: لو كان الشريط الأجنبيّ مرئياً لسقط حارسُ المستطيل
  // الصفريّ — والبناء وحده يمنعه. ⇒ العطب مستحيلٌ لا مستور.
  idle.rect = R(640, 360); idleBar.rect = R(304, 40);
  check("⭐ وحتى وهو **مرئيّ 304×40** لا يُصاب — بالبناء لا بحارس المستطيل",
    c.speedBtnHostSlot(video) === null);

  // وشريطُ الفيديو نفسِه يُصاب — وإلّا كان الحارس يرفض كل شيء
  const own = dom.el("div", { cls: "ytp-right-controls", rect: R(304, 40) });
  live.append(own);
  check("وشريطُ مشغّله هو **يُصاب**", c.speedBtnHostSlot(video) === own);
  own.rect = R(0, 0);
  check("وحارسُ المستطيل الصفريّ باقٍ — سببُه الأوّل قائم", c.speedBtnHostSlot(video) === null);
}

// ── [4] شاهدا قرار 26/47 على الحارس نفسه ───────────────────────────────────
console.log("\n[4] شاهدا الحارس — يرى، ويُحمّر على العطب المعلوم");
{
  const pv = buildYouTube({ preview: true });
  const c = makeCtx(pv.dom);
  // موجب: أداةٌ واحدة مرئية داخل نطاق المعاينة **تقلب الحكم** ⇒ الحارس يرى
  pv.player.append(pv.dom.el("button", { rect: R(30, 30) }));
  check("موجب: زرٌّ مرئيّ واحد داخل النطاق يقلب الامتناع إلى رسم (العتبة ≥1)",
    makeCtx(pv.dom).videoOwnsControls(pv.video) === true);
  // سالب: الزرّ نفسه بشفافيةٍ صفر عبر السلسلة ⇒ لا يُعدّ (العمى الأوّل، `S7`)
  pv.player.style.opacity = "0";
  check("سالب: وبشفافية صفر على **السلف** لا يُعدّ — الرؤية على السلسلة",
    makeCtx(pv.dom).videoOwnsControls(pv.video) === false);
  pv.player.style.opacity = "1";
  // وعنصرُنا نحن لا يُثبت المضيف (قرار 66)
  const ours = pv.dom.el("button", { cls: "vzSpeedBtn", rect: R(56, 40) });
  pv.player.children.length = 0;
  pv.player.append(ours);
  check("وزرُّنا لا يُثبت المضيف — حارسٌ يعمى عن نفسه (قرار 66)",
    makeCtx(pv.dom).videoOwnsControls(pv.video) === false);
  void c;
}

// ── [5] موضعُ النداء محروسٌ أيضاً — **وإلّا حُذفت البوّابة والحارس أخضر** ────
// ⚠️ **حارسٌ يفحص الدالّة ولا يفحص استعمالها يحرس ما لا يُستعمل.** والقسم [1]
// يمرّ كاملاً على منتجٍ حُذفت منه البوّابة، لأنه ينادي الدالّة بنفسه.
console.log("\n[5] البوّابة منداةٌ فعلاً، والشريط لا يُطلب من المستند");
{
  const bodyOf = (name) => fn(name);
  check("`setSpeedBtnShown` تنادي `videoOwnsControls`",
    /videoOwnsControls\(/.test(bodyOf("setSpeedBtnShown")));
  check("و`placeSpeedBtn` تتلقّى الفيديو ولا تُعيد اشتقاقه صامتةً",
    /function placeSpeedBtn\(video\)/.test(SRC));
  check("و`speedBtnHostSlot` تسأل النطاق",
    /playerScopeForVideo\(video\)/.test(bodyOf("speedBtnHostSlot")));
  check("⭐ ولا `document.querySelector(YT_CONTROLS_SELECTOR)` في الملفّ كلِّه (#96)",
    !/document\.querySelector\(\s*YT_CONTROLS_SELECTOR\s*\)/.test(SRC));

  // ── الشاهد على العطب المعلوم: مصدرٌ مُفتعَل بالكود **السابق** يجب أن يُحمّر ──
  const before = SRC.replace("const scope = playerScopeForVideo(video);\n    if (!scope) return null;\n    const box = scope.querySelector(YT_CONTROLS_SELECTOR);",
                             "const box = document.querySelector(YT_CONTROLS_SELECTOR);");
  check("والمصدر المُفتعَل بالكود السابق **مختلفٌ فعلاً** (وإلّا فالشاهد وهم)", before !== SRC);
  check("⭐ ويُحمّر عليه القسم [5]",
    /document\.querySelector\(\s*YT_CONTROLS_SELECTOR\s*\)/.test(before));

  // وسلوكياً: الكود السابق **يصيب الشريط الأجنبيّ** — وهو #96 بعينه
  const dom = makeDom();
  const html = dom.el("html"), body = dom.el("body");
  html.append(body);
  const idle = dom.el("div", { id: "movie_player", cls: "html5-video-player", rect: R(640, 360) });
  const idleBar = dom.el("div", { cls: "ytp-right-controls", rect: R(304, 40) });
  idle.append(idleBar);
  const live = dom.el("div", { id: "inline-preview-player", cls: "html5-video-player", rect: R(504, 283) });
  const video = dom.el("video", { rect: R(504, 283) });
  live.append(video);
  body.append(idle, live);
  dom.body = body; dom.html = html;
  const ctx = {
    document: { body, documentElement: html, querySelector: (s) => body.querySelector(s) },
    getComputedStyle: (n) => n.style, isYouTubeFamilyHost: () => true, WeakMap, console
  };
  vm.createContext(ctx);
  vm.runInContext(`const YT_CONTROLS_SELECTOR = ${constOf("YT_CONTROLS_SELECTOR")};` +
    fn.call(null, "speedBtnHostSlot").replace(
      /const scope[\s\S]*?const box = scope\.querySelector\(YT_CONTROLS_SELECTOR\);/,
      "const box = document.querySelector(YT_CONTROLS_SELECTOR);"), ctx);
  check("⭐ وسلوكياً: الكود السابق **يصيب الشريط الأجنبيّ** — فالعطب كان حيّاً",
    ctx.speedBtnHostSlot(video) === idleBar);
}

console.log(`\nنجح ${pass} / فشل ${fail}`);
process.exit(fail ? 1 : 0);
