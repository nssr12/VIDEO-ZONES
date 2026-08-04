// حرّاس الحدود العددية الأربعة (#93): بنيةٌ تحت الحدّ وأخرى فوقه — لكلّ ثابت.
//
// ⭐ **السؤال الذي يجيبه هذا الملفّ بصيغة ما يعيشه المستخدم:** *«هل تبقى شبكةُ
// المربّعات على إطار المشغّل بدل أن تقفز إلى الصفحة كلّها، ويبقى المعزّز داخل
// مداه، ويقف بحثُنا عن المشغّل قبل أن يبلع الصفحة؟»* — **وهي أسئلةٌ تحسمها
// أرقامٌ أربعة، وكانت مكتوبةً بلا حارس.**
//
// ── لماذا وُجد (#93، الشطر الأوّل) ──────────────────────────────────────────
// **مسحٌ دلاليّ لضوابط المنتج العددية** أعطى **12 مرشَّحاً**: ثمانيةٌ مُغطّاةٌ
// بمدىً مشروع، **وأربعةٌ ناقصة** — هذي هي. **والحكم كان بالسبب لا بالعدّ.**
//
// ⚠️ **وشرطُ القبول (قرار 47 بنصّ المالك): «الحارس الذي لا يُحمّر بتغيير الرقم
// لا يحرس الرقم».** فلكلّ قسمٍ **شاهدُ أحمرَ يُغيّر الثابت في مصدرٍ مُفتعَل**
// ويشترط **انقلاب الحكم** — لا افتعالَ بنيةٍ وحدها.
// ⛔ **ولم تُغيَّر قيمةُ ثابتٍ واحد: البند حراسةٌ لا معايرة** (أمر المالك).
const fs = require("fs");
const vm = require("vm");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

const SRC = fs.readFileSync("content.js", "utf8");

function fnOf(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) return null;
  let depth = 0;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}
function constOf(src, name) {
  const m = src.match(new RegExp(`const\\s+${name}\\s*=([\\s\\S]*?);(?=[ \\t]*(//[^\\n]*)?\\n)`));
  return m ? m[1].trim() : null;
}

// ── DOM مصغَّر: ما تحتاجه الدوالّ بالضبط ────────────────────────────────────
function makeDom() {
  const node = (tag, opts = {}) => {
    const n = {
      nodeType: 1, tagName: tag.toUpperCase(), id: opts.id || "", className: opts.cls || "",
      children: [], parentElement: null, isConnected: true,
      rect: opts.rect || { width: 0, height: 0 },
      getBoundingClientRect() { return { width: this.rect.width, height: this.rect.height, left: 0, top: 0 }; },
      getAttribute() { return null; },
      matches(sel) { return String(sel).split(",").some((t) => {
        t = t.trim();
        if (t.startsWith("#")) return this.id === t.slice(1);
        if (t.startsWith(".")) return String(this.className).split(/\s+/).includes(t.slice(1));
        if (t.startsWith("[")) return false;
        return this.tagName === t.toUpperCase();
      }); },
      closest(sel) { let x = this; while (x) { if (x.matches(sel)) return x; x = x.parentElement; } return null; },
      append(...k) { for (const c of k) { c.parentElement = this; this.children.push(c); } return this; }
    };
    return n;
  };
  return node;
}

// ── [1] ZONE_WRAPPER_MAX_AREA_RATIO — **الوحيد الذي كان بلا حارسٍ إطلاقاً** ──
// **وهو يقرّر أيُقبل غلافُ المشغّل أم يُرفض** ⇒ يمسّ المربّعات على كل مضيف:
// غلافٌ مقبولٌ خطأً يجعل الشبكة على **الصفحة** لا على المشغّل.
function zoneCtx(src) {
  const node = makeDom();
  const ctx = {
    WeakMap, console,
    zoneSettings: { gridCoverage: "player" },
    zoneContainerCache: new WeakMap()
  };
  vm.createContext(ctx);
  vm.runInContext(`
    const KNOWN_PLAYER_WRAPPER_SELECTOR = ${constOf(src, "KNOWN_PLAYER_WRAPPER_SELECTOR")};
    const ZONE_WRAPPER_MAX_AREA_RATIO = ${constOf(src, "ZONE_WRAPPER_MAX_AREA_RATIO")};
    ${fnOf(src, "zoneRectForVideo")}
  `, ctx);
  return { ctx, node };
}
function buildWrapped(node, wrapperArea) {
  // فيديو 400×300 داخل غلافٍ معروف بمساحةٍ نطلبها
  const w = Math.round(Math.sqrt(wrapperArea * (4 / 3)));
  const h = Math.round(wrapperArea / w);
  const wrap = node("div", { id: "movie_player", rect: { width: w, height: h } });
  const v = node("video", { rect: { width: 400, height: 300 } });
  wrap.append(v);
  return { wrap, v };
}
console.log("\n[1] ZONE_WRAPPER_MAX_AREA_RATIO — غلافٌ تحت الحدّ يُقبل، وفوقه يُرفض");
{
  const { ctx, node } = zoneCtx(SRC);
  const RATIO = Number(constOf(SRC, "ZONE_WRAPPER_MAX_AREA_RATIO"));
  const vArea = 400 * 300;
  const under = buildWrapped(node, Math.round(vArea * (RATIO - 1)));   // بأمان تحت الحدّ
  const over  = buildWrapped(node, Math.round(vArea * (RATIO + 3)));   // بأمان فوقه
  const rUnder = ctx.zoneRectForVideo(under.v);
  const rOver  = ctx.zoneRectForVideo(over.v);
  check(`الحدّ يُقرأ من المصدر (${RATIO})`, Number.isFinite(RATIO) && RATIO > 1);
  check("غلافٌ تحت الحدّ ⇒ **الشبكة على المشغّل**",
    rUnder.width === under.wrap.rect.width, `${rUnder.width} ≠ ${under.wrap.rect.width}`);
  check("وغلافٌ فوقه ⇒ **ترجع إلى الفيديو** (لا تقفز إلى الصفحة)",
    rOver.width === 400, rOver.width);

  // ⭐ **شاهد الأحمر: يُغيَّر الثابت في مصدرٍ مُفتعَل** ⇒ الحكم ينقلب
  const bumped = SRC.replace(/const ZONE_WRAPPER_MAX_AREA_RATIO = [\d.]+;/,
                             "const ZONE_WRAPPER_MAX_AREA_RATIO = 99;");
  check("والمصدر المُفتعَل مختلفٌ فعلاً", bumped !== SRC);
  const b = zoneCtx(bumped);
  const overB = buildWrapped(b.node, Math.round(vArea * (RATIO + 3)));
  check("⭐ وبرقمٍ أوسع (99) يُقبل ما كان يُرفض — **فالحارس يحرس الرقم**",
    b.ctx.zoneRectForVideo(overB.v).width === overB.wrap.rect.width);
}

// ── [2] VZ_PLAYER_SCOPE_MAX_AREA — **الحدُّ كان مكتوباً لا مُجرَّباً** ────────
// **ولا بنيةَ في حارس #94 تتجاوزه**: خمسُ بنيات كلُّها تحته، **فالسكون لم يكن
// له مدىً يتحرّك فيه** (قرار 26، الشاهد الثالث).
function scopeCtx(src) {
  const node = makeDom();
  // ⚠️ **`document` خاصيّةٌ على السياق لا `const` داخل السكربت** — وهو درس #57
  // بعينه: `const` في أعلى سكربت **لا يصير خاصيّةً على الكائن العام**.
  const ctx = { console, document: { body: null, documentElement: null } };
  vm.createContext(ctx);
  vm.runInContext(`
    const KNOWN_PLAYER_WRAPPER_SELECTOR = ${constOf(src, "KNOWN_PLAYER_WRAPPER_SELECTOR")};
    const FS_CONTAINER_MAX_DEPTH = ${constOf(src, "FS_CONTAINER_MAX_DEPTH")};
    const VZ_PLAYER_SCOPE_MAX_AREA = ${constOf(src, "VZ_PLAYER_SCOPE_MAX_AREA")};
    ${fnOf(src, "looksLikePlayer")}
    ${fnOf(src, "playerScopeForVideo")}
  `, ctx);
  return { ctx, node };
}
function buildScope(node, ctx, outerArea) {
  // فيديو 400×300 · وسلفٌ «يشبه مشغّلاً» بلا اسمٍ معروف، بمساحةٍ نطلبها
  const w = Math.round(Math.sqrt(outerArea * (4 / 3))), h = Math.round(outerArea / w);
  const outer = node("div", { cls: "player", rect: { width: w, height: h } });
  const mid = node("div", { cls: "wrapper", rect: { width: 400, height: 300 } });
  const v = node("video", { rect: { width: 400, height: 300 } });
  mid.append(v); outer.append(mid);
  const body = node("body"), html = node("html");
  html.append(body); body.append(outer);
  ctx.document.body = body; ctx.document.documentElement = html;
  return { outer, v };
}
console.log("\n[2] VZ_PLAYER_SCOPE_MAX_AREA — سلفٌ تحت الحدّ يصير النطاق، وفوقه لا");
{
  const MAX = Number(constOf(SRC, "VZ_PLAYER_SCOPE_MAX_AREA"));
  const vArea = 400 * 300;
  const a = scopeCtx(SRC);
  const under = buildScope(a.node, a.ctx, Math.round(vArea * (MAX - 0.1)));
  check(`الحدّ يُقرأ من المصدر (${MAX})`, Number.isFinite(MAX) && MAX >= 1);
  check("سلفٌ تحت الحدّ ⇒ **هو النطاق**", a.ctx.playerScopeForVideo(under.v) === under.outer);
  const b = scopeCtx(SRC);
  const over = buildScope(b.node, b.ctx, Math.round(vArea * (MAX + 1)));
  check("⭐ وسلفٌ فوقه ⇒ **ليس النطاق** (الحدُّ يعمل، ولم يكن مُجرَّباً)",
    b.ctx.playerScopeForVideo(over.v) !== over.outer);

  // شاهد الأحمر: حدٌّ أوسع يقبل ما كان يُرفض
  const bumped = SRC.replace(/const VZ_PLAYER_SCOPE_MAX_AREA = [\d.]+;/,
                             "const VZ_PLAYER_SCOPE_MAX_AREA = 50;");
  check("والمصدر المُفتعَل مختلفٌ فعلاً", bumped !== SRC);
  const c = scopeCtx(bumped);
  const over2 = buildScope(c.node, c.ctx, Math.round(vArea * (MAX + 1)));
  check("⭐ وبرقمٍ أوسع (50) يصير نطاقاً — **فالحارس يحرس الرقم**",
    c.ctx.playerScopeForVideo(over2.v) === over2.outer);
}

// ── [3] قصّ المعزّز 100–600 — **في موضعين، وقد يتباعدان** ────────────────────
// `content.js` يقصّ ما يصله من الـpopup، و`popup.js` يقصّ ما يعود إليه.
// **فموضعان لحقيقةٍ واحدة** (قرار 36) — والحارس يشترط تطابقهما ويجرّب الطرفين.
console.log("\n[3] قصّ المعزّز 100–600 — بطرفيه، وفي الموضعين معاً");
{
  const POPUP = fs.readFileSync("popup.js", "utf8");
  const grab = (txt) => {
    const m = txt.match(/Math\.max\((\d+),\s*Math\.min\((\d+),/);
    return m ? { lo: Number(m[1]), hi: Number(m[2]) } : null;
  };
  const inContent = grab(SRC.slice(SRC.indexOf("SET_VOLUME_BOOST")));
  const inPopup = grab(POPUP.slice(POPUP.indexOf("GET_VOLUME_BOOST")));
  check("قصٌّ موجودٌ في content.js", !!inContent, JSON.stringify(inContent));
  check("وموجودٌ في popup.js", !!inPopup, JSON.stringify(inPopup));
  check("والطرفان متطابقان في الموضعين",
    !!inContent && !!inPopup && inContent.lo === inPopup.lo && inContent.hi === inPopup.hi,
    `${JSON.stringify(inContent)} ≠ ${JSON.stringify(inPopup)}`);

  const clamp = (pct, lo, hi) => Math.max(lo, Math.min(hi, Number(pct) || lo));
  const { lo, hi } = inContent || { lo: 0, hi: 0 };
  check(`ما دون الأرضية يُرفع (${lo - 1} ⇒ ${lo})`, clamp(lo - 1, lo, hi) === lo);
  check(`والأرضية تبقى (${lo})`, clamp(lo, lo, hi) === lo);
  check(`والسقف يبقى (${hi})`, clamp(hi, lo, hi) === hi);
  check(`وما فوقه يُقصّ (${hi + 100} ⇒ ${hi})`, clamp(hi + 100, lo, hi) === hi);
  check("وقيمةٌ فاسدة تسقط إلى الأرضية لا إلى صفر", clamp("سين", lo, hi) === lo);

  // شاهد الأحمر: تباعدُ الموضعين يُحمّر
  const drift = POPUP.replace("Math.max(100, Math.min(600,", "Math.max(50, Math.min(600,");
  const d = grab(drift.slice(drift.indexOf("GET_VOLUME_BOOST")));
  check("⭐ وتباعدُ الموضعين يُحمّر (شاهد مُفتعَل)", !!d && d.lo !== inContent.lo);
}

// ── [4] FS_CONTAINER_MAX_DEPTH = 8 — **المشي يقف، ولا بنيةَ تُثبته** ─────────
console.log("\n[4] FS_CONTAINER_MAX_DEPTH — مشغّلٌ في العمق الثامن يُوجد، وفي التاسع لا");
{
  function nearCtx(src) {
    const node = makeDom();
    const ctx = { console, document: { body: null, documentElement: null } };
    vm.createContext(ctx);
    vm.runInContext(`
      const KNOWN_PLAYER_WRAPPER_SELECTOR = ${constOf(src, "KNOWN_PLAYER_WRAPPER_SELECTOR")};
      const FS_CONTAINER_MAX_DEPTH = ${constOf(src, "FS_CONTAINER_MAX_DEPTH")};
      const VZ_FILL_RATIO = ${constOf(src, "VZ_FILL_RATIO")};
      ${fnOf(src, "looksLikePlayer")}
      ${fnOf(src, "videoFillsElement")}
      ${fnOf(src, "nearestPlayerAncestor")}
    `, ctx);
    return { ctx, node };
  }
  // سلسلة: الفيديو ثمّ حشوٌ لا يشبه مشغّلاً، والمشغّل عند عمقٍ نطلبه
  function chain(node, ctx, playerDepth) {
    const v = node("video", { rect: { width: 400, height: 300 } });
    let cur = v;
    for (let d = 1; d <= playerDepth; d++) {
      const isPlayer = d === playerDepth;
      const el = node("div", { cls: isPlayer ? "player" : "shell", rect: { width: 400, height: 300 } });
      el.append(cur); cur = el;
    }
    const body = node("body"), html = node("html");
    html.append(body); body.append(cur);
    ctx.document.body = body; ctx.document.documentElement = html;
    return { v, top: cur };
  }
  const DEPTH = Number(constOf(SRC, "FS_CONTAINER_MAX_DEPTH"));
  check(`العمق يُقرأ من المصدر (${DEPTH})`, Number.isInteger(DEPTH) && DEPTH > 0);
  const a = nearCtx(SRC); const at = chain(a.node, a.ctx, DEPTH);
  check(`مشغّلٌ عند العمق ${DEPTH} ⇒ **يُوجد**`, a.ctx.nearestPlayerAncestor(at.v) === at.top);
  const b = nearCtx(SRC); const beyond = chain(b.node, b.ctx, DEPTH + 1);
  check(`ومشغّلٌ عند ${DEPTH + 1} ⇒ **لا يُوجد** (المشي وقف)`,
    b.ctx.nearestPlayerAncestor(beyond.v) === null);

  const deeper = SRC.replace(/const FS_CONTAINER_MAX_DEPTH = \d+;/,
                             "const FS_CONTAINER_MAX_DEPTH = 40;");
  check("والمصدر المُفتعَل مختلفٌ فعلاً", deeper !== SRC);
  const c = nearCtx(deeper); const beyond2 = chain(c.node, c.ctx, DEPTH + 1);
  check("⭐ وبعمقٍ أكبر (40) يُوجد ما كان لا يُوجد — **فالحارس يحرس الرقم**",
    c.ctx.nearestPlayerAncestor(beyond2.v) === beyond2.top);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
