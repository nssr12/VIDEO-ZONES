// إعادة إنتاج #140 — شريطُ المضيف لا يعود في ملء الشاشة، والسببُ يُعزل بمتغيّرٍ واحد
//
// ⚠️ أداة تشخيص. **لا تلمس أي ملفّ يُشحن** — تُحمّل الإضافة الحقيقية كما هي وتقيس.
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// **يُقلع كرومان متتاليان (بإضافةٍ وبلا إضافة) وينتظر مهلَ سكونِ مضيفٍ حقيقية**
// ⇒ **زمنُه بالدقائق لا بالثواني**، وهو ثمنٌ لا يُدفع في كلّ كومِت.
// ⭐ **وما يحرسه في البوّابة غيرُه**: `repro-58-fullscreen` يحمل بنيةَ #140
// وحكمَها، **وهذا يبقى للتشخيص وإعادة الإنتاج عند بلاغٍ جديد.**
//
//   node tools/repro-140-fs-bar.mjs
//
// ── ما تجيب عنه بالضبط ──────────────────────────────────────────────────────
// بلاغُ المالك (#140): **شريطُ تقدّم المضيف يبقى مخفيّاً في ملء الشاشة وحدَه**،
// ولا يعود إلا بإطفاء الإضافة أو حجب الموقع أو الخروج من ملء الشاشة.
// **ومرشَّحُه: طبقتُنا تبتلع حركةَ المؤشّر فلا يرى المضيفُ حركةً فلا يُظهر شريطه.**
//
// ⛔ **والمرشَّح لا يُصدَّق لأنه يفسّر كلَّ شيء** (شرط المالك: التفسيرُ المريح
// أخطرُ من الخاطئ) — **فيُقاس بمتغيّرٍ واحد**: الصفحةُ نفسُها، وملءُ الشاشة نفسُه،
// **والطبقةُ مبنيّةٌ وغيرُ مبنيّة**.
//
// ⭐ **وثلاثةُ أسئلةٍ لا واحد** (قرار 109 · قرار 48):
//   • **أرمى؟**  — لا يُسأل هنا؛ `bench-content-errors` يسأله.
//   • **أموجود؟** — أموجودٌ الشريطُ في شجرة عنصر ملء الشاشة أصلاً؟
//   • **أوقع الأثر؟** — أيصل `mousemove` إلى مستمع المضيف، وأيتغيّر مظهرُ شريطه؟
// **والثلاثة تُقاس معاً لأن كلَّ واحدٍ وحدَه يُنتج حكماً مختلفاً عن السبب.**
//
// ⚠️ **وقرار 48 محفوظٌ بحرفه: المضيفُ يُخفي شريطَه بنفسه بالسكون** — فصفحةُ
// القياس تحمل **نموذجَ سكونٍ للمضيف** كما تفعل المشغّلاتُ الحقيقية، **ويُقاس
// عدّادُ حركةِ المضيف (`__hostMoves`) لا مظهرُ الشريط وحدَه**: المظهرُ لا يقول
// من أخفى، **والعدّادُ يقول أوصلت الحركةُ أم لا**.
//
// ── الشواهد قبل أي رقم (قرار 26) ────────────────────────────────────────────
//   • **موجب:** بلا إضافةٍ محمَّلة، في ملء الشاشة، حركةٌ حقيقية ⇒ **الشريط يظهر**
//     و`__hostMoves` يزيد. **فإن لم يقع فالمِجَسّ لا يرى ولا يُقرأ منه رقم.**
//   • **سالب:** بلا إضافة، وبلا حركة، بعد سكونٍ يتجاوز مهلة المضيف ⇒ **الشريط
//     مخفيّ**. **فإن لم يُحمّر فالمِجَسّ لا يُميّز المخفيَّ من الظاهر.**
//
// ⚠️ **وحدُّ هذا الشاهد مكتوبٌ فيه:** ثلاثُ بنياتٍ مصنوعة لا مواقعُ حيّة، ونافذتُه
// **1200ms بعد كلّ حركة** — و«لم يظهر» فيه يعني **حتى 1200ms ولا شيء بعدها**.
import {
  launch, configure, openPage, contentWorld, evalIn, serveTestPage, killChrome, refuseUnknownFlags
} from "./ext-harness.mjs";

refuseUnknownFlags([]);

const PORT = 9412, HTTP = 8842;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── صفحةُ القياس: مشغّلٌ غيرُ يوتيوبيّ بنموذج سكونٍ للمضيف ────────────────────
// **ثلاثُ بنياتٍ لأن شكلَ الشريط يقرّر ما الذي يُخفيه ماذا:**
//   abs     — شريطٌ `position:absolute` أسفل المشغّل (شكلُ يوتيوب وتويتش)، والفيديو يملأ.
//   flow    — شريطٌ في التدفّق تحت الفيديو (عمودٌ مرن)، **وهو ما تُزيحه قاعدةُ الملء**.
//   fixed   — فيديو بمقاسٍ ثابت داخل مشغّل (بنية «ج» في #58) ⇒ **بوّابةُ الملء تقبل**.
//   outside — ⭐ **الشريطُ خارج أضيقِ حاويةٍ تشبه مشغّلاً** (شكلُ فيميو المقيس في
//             `CLAUDE.md`: `div.vp-video` بصفر ضابط، **و11 زرّاً ومنزلقٌ مستوىً أعلى**)
//             ⇒ **وهي البنيةُ التي لا يقيسها `repro-58` ولا أيُّ شاهدٍ عندنا.**
const PAGE = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;background:#111;height:100%}
  #player{position:relative;width:960px;height:540px;background:#000}
  #player.abs video{display:block;width:100%;height:100%;background:#222}
  #player.abs #bar{position:absolute;left:0;right:0;bottom:0;height:48px;background:rgba(0,0,0,.65)}
  #player.flow{display:flex;flex-direction:column}
  #player.flow video{display:block;flex:1 1 auto;width:100%;min-height:0;background:#222}
  #player.flow #bar{flex:0 0 48px;height:48px;background:rgba(0,0,0,.65)}
  #player.fixed video{display:block;width:640px;height:360px;background:#222}
  #player.fixed #bar{position:absolute;left:0;right:0;bottom:0;height:48px;background:rgba(0,0,0,.65)}
  #player.outside{height:588px}
  #player.outside .vp-video{position:relative;width:100%;height:540px}
  #player.outside video{display:block;width:100%;height:100%;background:#222}
  #player.outside #bar{position:absolute;left:0;right:0;bottom:0;height:48px;background:rgba(0,0,0,.65)}
  #bar{opacity:0}
  #bar button{height:32px;margin:8px 2px}
</style>
<div id="player"><video id="v" src="/tone.wav" loop muted playsinline></video><div id="bar"></div></div>
<script>
  var p = document.getElementById("player");
  var bar = document.getElementById("bar");
  var v = document.getElementById("v");
  p.className = new URLSearchParams(location.search).get("bar") || "abs";
  // **الشريطُ خارج حاوية الفيديو الضيّقة** — الفيديو يُلَفّ ويبقى الشريط أخاً لها.
  if (p.className === "outside") {
    var inner = document.createElement("div");
    inner.className = "vp-video";
    p.insertBefore(inner, v);
    inner.appendChild(v);
  }
  for (var i = 0; i < 12; i++) { var b = document.createElement("button"); b.textContent = "b" + i; bar.appendChild(b); }
  // **نموذجُ سكون المضيف** — الشكل الذي تتبعه المشغّلات الحقيقية: تظهر بالحركة
  // وتختفي بالسكون. **وهو ما يجعل «مخفيّ» لا يقول من أخفى** (قرار 48).
  window.__hostMoves = 0;
  var t = null;
  p.addEventListener("mousemove", function () {
    window.__hostMoves++;
    bar.style.opacity = "1";
    clearTimeout(t);
    t = setTimeout(function () { bar.style.opacity = "0"; }, 2500);
  });
  window.__hostFs = function () { return p.requestFullscreen(); };
  window.__exitFs = function () { return document.fullscreenElement ? document.exitFullscreen() : Promise.resolve(); };
</script>`;

// ── المِجَسّ: يُقاس في عالم الصفحة، والشجرةُ مشتركة فيرى طبقتنا ────────────────
const MEASURE = `(() => {
  const desc = (el) => {
    if (!el) return null;
    const cls = (el.className || "").toString().trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
  };
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
             x: Math.round(r.left), y: Math.round(r.top),
             inView: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight };
  };
  const bar = document.getElementById("bar");
  const v = document.getElementById("v");
  const fsEl = document.fullscreenElement;
  const cs = bar ? getComputedStyle(bar) : null;
  const br = box(bar);
  const wrap = document.querySelector(".vzWrap");
  const wcs = wrap ? getComputedStyle(wrap) : null;
  const vr = v ? v.getBoundingClientRect() : null;
  const cx = vr ? Math.round(vr.left + vr.width / 2) : 0;
  const cy = vr ? Math.round(vr.top + vr.height / 2) : 0;
  let popoverOpen = null;
  try { popoverOpen = wrap ? wrap.matches(":popover-open") : null; } catch (e) { popoverOpen = "throw"; }
  return {
    screen: [window.innerWidth, window.innerHeight],
    fsEl: desc(fsEl),
    fsIsVideo: !!fsEl && fsEl === v,
    fsHasBar: fsEl && bar ? fsEl.contains(bar) : null,
    hostMoves: window.__hostMoves,
    // ⛔⭐⭐ **«مرئيّ» يُشتقّ من الشرط المقيس ولا يسبقه** (العمى الأوّل، S7).
    // ⛔ ولا علامةَ اقتباسٍ خلفية في هذي الكتلة — هي قالبٌ نصّيّ (العائلةُ الثامنة).
    // **وأوّلُ صياغةٍ لهذا الحقل وقعت فيه بعينه:** حكمت بـ«ظاهر» على شفافيةٍ 1
    // ومستطيلٍ غير صفريّ **وعنصرُ ملء الشاشة لا يحويه** — **والمتصفّح لا يرسم إلا
    // شجرةَ عنصر ملء الشاشة**، فالشريطُ يحمل مستطيلاً محسوباً ولا يُرسم.
    // ⇒ **فشرطُ الرسم جزءٌ من الحكم، لا خبرٌ بجانبه.**
    bar: bar ? { opacity: cs.opacity, display: cs.display, visibility: cs.visibility,
                 pointerEvents: cs.pointerEvents, box: br,
                 paintable: fsEl ? fsEl.contains(bar) : true,
                 shown: cs.display !== "none" && cs.visibility !== "hidden" &&
                        parseFloat(cs.opacity) > 0.05 && !!br && br.inView &&
                        (fsEl ? fsEl.contains(bar) : true) } : null,
    video: box(v),
    topAtCenter: desc(document.elementFromPoint(cx, cy)),
    topAtBar: br && br.h > 0 ? desc(document.elementFromPoint(br.x + 20, br.y + Math.round(br.h / 2))) : null,
    wrap: wrap ? { parent: desc(wrap.parentElement), popoverOpen,
                   pointerEvents: wcs.pointerEvents, zIndex: wcs.zIndex,
                   position: wcs.position, box: box(wrap),
                   visibleKids: [...wrap.children].filter((k) => !k.classList.contains("vzHidden")).map((k) => desc(k)) } : null,
    fsMarks: document.querySelectorAll("[data-vz-fs],[data-vz-fs-video]").length,
    fillCss: !!document.getElementById("vz_fs_fill_css"),
    htmlClass: document.documentElement.className || "",
    ownStyles: [...document.querySelectorAll("style[id^=vz_]")].map((s) => s.id)
  };
})()`;

// ── حالةُ سكربت المحتوى نفسِه — تُقرأ من عالمه، ولا تُستنتج من الشجرة ──────────
// ⚠️ **متغيّرات `let` في سكربت المحتوى غيرُ مقروءةٍ من `Runtime.evaluate`** (مُقاسٌ
// هنا: `vzOverlay is not defined` بينما `zonesActive()` تُنادى) — **تصريحاتُ الدوالّ
// تصل ولا تصل الروابطُ المعجميّة.** ⇒ **فما لا يُقرأ يُشتقّ من الشجرة** (الطبقة
// ووسومُ `data-vz-fs` تُقاس في `MEASURE`)، **ولا يُترك مجهولاً ولا يُدَّعى.**
const INNER = `(() => {
  const safe = (f) => { try { return f(); } catch (e) { return "throw:" + (e && e.message); } };
  const desc = (el) => {
    if (!el || !el.tagName) return el === null ? null : String(el);
    const cls = (el.className || "").toString().trim().split(/\\s+/).filter(Boolean).slice(0, 2).join(".");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
  };
  const v = document.getElementById("v");
  const bar = document.getElementById("bar");
  const has = (el) => (el && el.contains && bar ? el.contains(bar) : null);
  const known = safe(() => typeof KNOWN_PLAYER_WRAPPER_SELECTOR === "string"
    ? desc(v.closest(KNOWN_PLAYER_WRAPPER_SELECTOR)) : "missing");
  const nearest = safe(() => typeof nearestPlayerAncestor === "function" ? nearestPlayerAncestor(v) : "missing");
  const picked = safe(() => typeof pickFullscreenContainer === "function" ? pickFullscreenContainer(v) : "missing");
  return {
    zonesActive: safe(() => typeof zonesActive === "function" ? zonesActive() : "missing"),
    extensionActive: safe(() => typeof extensionActive === "function" ? extensionActive() : "missing"),
    knownWrapper: known,
    // ⭐ **الطبقةُ الثانية في «pickFullscreenContainer» — وهي التي تُرجع وتخرج**
    nearestPlayerAncestor: desc(nearest),
    nearestHasBar: has(nearest),
    picked: desc(picked),
    pickedHasBar: has(picked),
    // ⭐ **وما كان السكور سيختاره لو بُلِغ** — «hasButtons» ثلاثُ نقاط
    scorerWouldPick: safe(() => {
      const cands = [];
      let cur = v;
      for (let i = 0; i < 8 && cur; i++) {
        if (cur !== document.body && cur !== document.documentElement) cands.push(cur);
        cur = cur.parentElement;
      }
      const withBtns = cands.filter((el) => el.querySelector("button, [role='button'], input[type='range']"));
      return withBtns.length ? desc(withBtns[0]) : null;
    }),
    nativeBtn: safe(() => {
      const el = typeof findNativeFullscreenButton === "function" ? findNativeFullscreenButton(v) : "missing";
      return desc(el);
    })
  };
})()`;

// حركةٌ حقيقية من المتصفّح لا من الصفحة — **والحركةُ حركتان بموضعين مختلفين**،
// فحدثٌ بلا إزاحة ليس نشاطاً (شرطُ محرّك السكون، وشرطُ أيّ مضيفٍ يقيس الحركة).
async function wiggle(c, x, y, times = 3) {
  for (let i = 0; i < times; i++) {
    await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + i * 7, y: y + i * 5, buttons: 0 });
    await sleep(90);
  }
}

async function gesture(c, expression, contextId) {
  const r = await c.send("Runtime.evaluate",
    contextId ? { expression, contextId, returnByValue: true, awaitPromise: true, userGesture: true }
              : { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  const ex = r?.result?.exceptionDetails;
  if (ex) return { threw: String(ex.exception?.description || ex.text || "").split("\n")[0].slice(0, 120) };
  return { value: r?.result?.result?.value };
}

const SETTINGS = {
  settings: {
    enabled: true,
    idle: { ms: 1500 },
    overlay: { autoHideMs: 900, volumeAutoHideMs: 900, enabled: true, hintEnabled: true },
    zones: {
      enabled: true, fullscreenOnly: true,
      wheel: { map: { "4": { up: ["ACTION:SPEED:+0.25"], down: ["ACTION:SPEED:-0.25"] } } }
    }
  },
  globalSiteRules: { enabled: true, mappings: [] }
};

// عجلةٌ على المربّع 4 — **مسارُ العرض هو ما يبني الطبقة** (#38أ)، فبلا ربطٍ مُصاب
// لا `.vzWrap` أصلاً. والحدث يُرسَل من الصفحة كما في بقيّة رِكازاتنا.
const WHEEL_AT_ZONE4 = `(async () => {
  const v = document.getElementById("v");
  if (!v) return { ok: false, why: "لا فيديو" };
  try { v.muted = true; v.volume = 0.5; await v.play().catch(() => {}); } catch (e) {}
  const r = v.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return { ok: false, why: "مستطيل صفريّ — لا يُقاس" };
  const x = Math.round(r.left + r.width / 6), y = Math.round(r.top + r.height / 2);
  window.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }));
  v.dispatchEvent(new WheelEvent("wheel", { clientX: x, clientY: y, deltaY: -120,
    bubbles: true, cancelable: true, composed: true }));
  await new Promise((z) => setTimeout(z, 700));
  return { ok: true, wrap: !!document.querySelector(".vzWrap"), rate: v.playbackRate };
})()`;

const rows = [];

async function cell({ h, label, structure, ext, fsPath, buildLayer = true, stayWindowed = false }) {
  const out = { label, structure, ext, fsPath, steps: {} };
  const page = await openPage(PORT, `http://127.0.0.1:${HTTP}/?bar=${structure}`);
  try {
    await sleep(ext ? 2600 : 1200);
    out.world = ext ? !!(await contentWorld(page)) : null;
    const ctx = ext ? (await contentWorld(page))?.id : null;

    // (١) الحال الأولى تُنتَج وتُتحقَّق قبل أي رقم (قرار 22)
    const v0 = await evalIn(page, MEASURE);
    if (!v0?.video || v0.video.w <= 0) { out.why = "لا فيديو بمستطيلٍ غير صفريّ"; return out; }
    out.steps.start = v0;

    // (٢) شاهدُ النافذة: حركةٌ حقيقية ⇒ الشريط يظهر — **قبل ملء الشاشة**
    const c0 = v0.video;
    await wiggle(page, c0.x + Math.round(c0.w / 2), c0.y + Math.round(c0.h / 2));
    await sleep(400);
    out.steps.windowedMoved = await evalIn(page, MEASURE);

    // (٣) وسكونٌ يتجاوز مهلة المضيف ⇒ الشريط يختفي (الشاهد السالب)
    await sleep(2900);
    out.steps.windowedIdle = await evalIn(page, MEASURE);

    if (stayWindowed) {
      if (buildLayer && ext) out.steps.wheel = await evalIn(page, WHEEL_AT_ZONE4);
      await wiggle(page, c0.x + Math.round(c0.w / 2), c0.y + Math.round(c0.h / 2));
      await sleep(400);
      out.steps.windowedWithLayer = await evalIn(page, MEASURE);
      if (ext) out.steps.inner = await evalIn(page, INNER, ctx);
      return out;
    }

    // (٤) الدخول إلى ملء الشاشة — بالمسار المطلوب، تحت إيماءةٍ حقيقية
    if (fsPath === "host") {
      out.steps.enter = await gesture(page, "window.__hostFs()");
    } else {
      if (ext) out.steps.inner0 = await evalIn(page, INNER, ctx);
      out.steps.enter = await gesture(page,
        `(() => { const v = document.getElementById("v");
           return typeof toggleFullscreen === "function" ? toggleFullscreen(v) : "missing"; })()`, ctx);
    }
    await sleep(1400);
    const f0 = await evalIn(page, MEASURE);
    out.steps.enteredFs = f0;
    if (!f0.fsEl) { out.why = "لم يقع ملءُ الشاشة — لا حكمَ يُبنى"; return out; }

    // (٥) الطبقةُ تُبنى داخل ملء الشاشة (وهي حالُ المالك: مربّعاتٌ في ملء الشاشة وحدَه)
    if (buildLayer && ext) {
      out.steps.wheel = await evalIn(page, WHEEL_AT_ZONE4);
      await sleep(500);
      out.steps.afterWheel = await evalIn(page, MEASURE);
    }

    // (٦) وسكونٌ يُخفي شريطَ المضيف بيده هو — ثم حركةٌ حقيقية: **أيعود؟**
    await sleep(2900);
    out.steps.fsIdle = await evalIn(page, MEASURE);
    const fr = out.steps.fsIdle.video || f0.video;
    await wiggle(page, fr.x + Math.round(fr.w / 2), fr.y + Math.round(fr.h / 2), 4);
    await sleep(1200);
    out.steps.fsMoved = await evalIn(page, MEASURE);
    if (ext) out.steps.inner = await evalIn(page, INNER, ctx);

    // (٧) والخروج — المخرجُ الثالث في بلاغ المالك
    await gesture(page, "window.__exitFs()");
    await sleep(900);
    await wiggle(page, c0.x + Math.round(c0.w / 2), c0.y + Math.round(c0.h / 2));
    await sleep(400);
    out.steps.afterExit = await evalIn(page, MEASURE);
    // ── #141 — **أيبلغ تلوّثُ طبقتنا المسارَ الذي يختار الحاوية؟** ─────────────
    // `pickFullscreenContainer` **لا تُنادى إلا خارج ملء الشاشة** (فرعُ الخروج
    // يسبقها في `toggleFullscreen`)، **وخارجَه طبقتُنا على `body`** — و`body`
    // مستثنىً من المرشّحين بالبناء (#59). ⛔ **والمقدّمةُ تُقاس ولا تُقرَّر.**
    if (ext) out.steps.innerAfterExit = await evalIn(page, INNER, ctx);
    return out;
  } catch (e) {
    out.threw = String(e?.message || e).slice(0, 200);
    return out;
  } finally {
    try { page.ws.close(); } catch (e) { /* الاتصال مغلقٌ سلفاً */ }
  }
}

function line(tag, m) {
  if (!m) return `${tag}: —`;
  const b = m.bar;
  return `${tag}: شريط=${b ? (b.shown ? "ظاهر" : (b.paintable === false ? "لا يُرسم أصلاً" : "مخفيّ")) : "غائب"}` +
    ` opacity=${b?.opacity} rect=${b?.box?.w}×${b?.box?.h}@${b?.box?.y}` +
    ` حركات=${m.hostMoves} fs=${m.fsEl || "—"} fsHasBar=${m.fsHasBar}` +
    ` أعلى-المركز=${m.topAtCenter} أعلى-الشريط=${m.topAtBar}` +
    ` طبقة=${m.wrap ? m.wrap.parent + " pe=" + m.wrap.pointerEvents + " " + m.wrap.box.w + "×" + m.wrap.box.h : "لا"}` +
    ` وسوم=${m.fsMarks} fillCss=${m.fillCss}`;
}

const { srv } = await serveTestPage(HTTP, PAGE);
let h = null;
let code = 0;
try {
  for (const ext of [false, true]) {
    h = await launch(PORT, { withExtension: ext, extra: ["--window-size=1440,900"] });
    if (ext) {
      const cfg = await configure(PORT, h.extensionId, SETTINGS);
      if (!cfg.ok) throw new Error("تعذّر ضبط التخزين: " + (cfg.why || cfg.error));
    }
    const plan = ext
      ? [
          { structure: "abs",     fsPath: "host", label: "abs · بالإضافة · ملءُ شاشة المضيف" },
          { structure: "abs",     fsPath: "ours", label: "abs · بالإضافة · ملءُ شاشتنا" },
          { structure: "flow",    fsPath: "ours", label: "flow · بالإضافة · ملءُ شاشتنا" },
          { structure: "fixed",   fsPath: "ours", label: "fixed · بالإضافة · ملءُ شاشتنا" },
          { structure: "outside", fsPath: "host", label: "outside · بالإضافة · ملءُ شاشة المضيف" },
          { structure: "outside", fsPath: "ours", label: "⭐ outside · بالإضافة · ملءُ شاشتنا" },
          { structure: "abs",     fsPath: "—", stayWindowed: true, label: "abs · بالإضافة · نافذةٌ بلا ملء شاشة" }
        ]
      : [
          { structure: "abs",     fsPath: "host", label: "abs · بلا إضافة · شاهدٌ موجب/سالب" },
          { structure: "flow",    fsPath: "host", label: "flow · بلا إضافة · شاهدٌ موجب/سالب" },
          { structure: "fixed",   fsPath: "host", label: "fixed · بلا إضافة · شاهدٌ موجب/سالب" },
          { structure: "outside", fsPath: "host", label: "outside · بلا إضافة · شاهدٌ موجب/سالب" }
        ];
    for (const p of plan) rows.push(await cell({ h, ext, ...p }));
    killChrome(h); h = null;
    await sleep(600);
  }

  console.log("\n══════ #140 — شريطُ المضيف في ملء الشاشة ══════\n");
  for (const r of rows) {
    console.log("── " + r.label + (r.why ? "   ⛔ " + r.why : "") + (r.threw ? "   ⛔ رمى: " + r.threw : ""));
    if (r.ext) console.log("   عالمُ الإضافة: " + (r.world ? "✅ حاضر" : "❌ غائب — لا يُقاس"));
    console.log("   " + line("نافذة/حركة ", r.steps.windowedMoved));
    console.log("   " + line("نافذة/سكون ", r.steps.windowedIdle));
    if (r.steps.windowedWithLayer) console.log("   " + line("نافذة/بالطبقة", r.steps.windowedWithLayer));
    if (r.steps.enteredFs) console.log("   " + line("ملء شاشة    ", r.steps.enteredFs));
    if (r.steps.afterWheel) console.log("   " + line("بعد العجلة  ", r.steps.afterWheel));
    if (r.steps.fsIdle) console.log("   " + line("ملء/سكون    ", r.steps.fsIdle));
    if (r.steps.fsMoved) console.log("   " + line("ملء/حركة    ", r.steps.fsMoved));
    if (r.steps.afterExit) console.log("   " + line("بعد الخروج  ", r.steps.afterExit));
    if (r.steps.wheel) console.log("   عجلة: " + JSON.stringify(r.steps.wheel));
    if (r.steps.enter) console.log("   دخول: " + JSON.stringify(r.steps.enter));
    if (r.steps.inner) console.log("   داخل السكربت: " + JSON.stringify(r.steps.inner));
    if (r.steps.inner0) console.log("   قبل الدخول:   " + JSON.stringify(r.steps.inner0));
    if (r.steps.innerAfterExit) console.log("   بعد الخروج:   " + JSON.stringify(r.steps.innerAfterExit));
    const fm = r.steps.fsMoved;
    if (fm) {
      const ok = fm.bar?.shown === true;
      console.log("   ⇒ الحكم: بعد حركةٍ حقيقية في ملء الشاشة — " +
        (ok ? "✅ الشريط يعود"
            : (fm.bar?.paintable === false
                ? "❌ **لا يعود، وليس لأنه مخفيّ: هو خارج شجرة عنصر ملء الشاشة فلا يُرسم**"
                : "❌ لا يعود، وهو داخل الشجرة ⇒ سببٌ آخر")) +
        `  (حركاتُ المضيف ${r.steps.enteredFs?.hostMoves} ⇒ ${fm.hostMoves})`);
    }
    console.log("");
  }

  // ── الشاهدان: يُقرآن قبل أيّ حكم، ولا يُنشر رقمٌ بلا نجاحهما (قرار 26) ────────
  const base = rows.filter((r) => !r.ext);
  const posOk = base.every((r) => r.steps.windowedMoved?.bar?.shown === true &&
                                  r.steps.windowedMoved?.hostMoves > 0);
  const negOk = base.every((r) => r.steps.windowedIdle?.bar?.shown === false);
  const fsPosOk = base.every((r) => r.steps.fsMoved?.bar?.shown === true);
  console.log("── الشاهدان (قرار 26)");
  console.log("   موجب (بلا إضافة، حركةٌ في النافذة ⇒ ظاهر): " + (posOk ? "✅" : "❌"));
  console.log("   موجب (بلا إضافة، حركةٌ في ملء الشاشة ⇒ ظاهر): " + (fsPosOk ? "✅" : "❌"));
  console.log("   سالب (بلا إضافة، سكونٌ ⇒ مخفيّ): " + (negOk ? "✅" : "❌"));
  // ── المتغيّرُ الواحد: البنيةُ نفسُها، وملءُ الشاشة نفسُه، **ومن اختار الحاوية يختلف** ──
  const oursOutside = rows.find((r) => r.ext && r.structure === "outside" && r.fsPath === "ours");
  const hostOutside = rows.find((r) => r.ext && r.structure === "outside" && r.fsPath === "host");
  if (oursOutside && hostOutside) {
    console.log("\n── المتغيّرُ الواحد (البنيةُ `outside`، الإضافةُ محمَّلةٌ في الحالين)");
    console.log("   ملءُ شاشة المضيف : حاوية=" + hostOutside.steps.fsMoved?.fsEl +
      " · فيها الشريط=" + hostOutside.steps.fsMoved?.fsHasBar +
      " · الشريط=" + (hostOutside.steps.fsMoved?.bar?.shown ? "يعود ✅" : "لا يعود ❌"));
    console.log("   ملءُ شاشتنا     : حاوية=" + oursOutside.steps.fsMoved?.fsEl +
      " · فيها الشريط=" + oursOutside.steps.fsMoved?.fsHasBar +
      " · الشريط=" + (oursOutside.steps.fsMoved?.bar?.shown ? "يعود ✅" : "لا يعود ❌"));
    console.log("   ⇒ **الطبقةُ حاضرةٌ في الحالين، وحركةُ المضيف تصل في الحالين** ⇒ " +
      "**الفارقُ هو العنصرُ الذي طُلب له ملءُ الشاشة، لا الطبقة.**");
  }
  if (!(posOk && negOk && fsPosOk)) {
    console.log("\n⛔ **المِجَسّ لم يُثبت أنه يرى أو أنه يُحمّر — ولا يُقرأ منه رقمٌ عن الإضافة.**");
    code = 1;
  }
} catch (e) {
  console.log("⛔ رمى: " + (e?.message || e));
  code = 1;
} finally {
  if (h) killChrome(h);
  try { srv.close(); } catch (e) { /* أُغلق سلفاً */ }
}
// ⚠️ الخرْجُ يُؤجَّل بعد التنظيف (#103) — والافتراضُ فشلٌ لا نجاح
process.exitCode = code;
