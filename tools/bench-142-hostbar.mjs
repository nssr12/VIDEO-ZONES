// #142 — شريطُ تقدّمٍ لمضيفٍ بلا أدوات: أيظهر حيث يجب، ويمتنع حيث يجب، وأيُنقِّل؟
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// **يُقلع كرومَين متتاليين ويزيّف مضيفَ يوتيوب باعتراض الطلبات**، وينتظر مهلَ
// سكونٍ حقيقيةً بين الحالات ⇒ **زمنُه بالدقائق**، وثمنٌ لا يُدفع في كلّ كومِت.
// ⭐ **وما يحرسه في البوّابة غيرُه**: عدُّ الوسم البنيويّ في `test-speed-button`
// وعدُّ مصادر النشاط في `test-idle-engine` وإسقاطُ المفتاح في `test-projection-keys`.
//
// ⚠️ أداة تشخيص. **لا تلمس أي ملفّ يُشحن** — تُحمّل الإضافة الحقيقية كما هي وتقيس.
//
//   node tools/bench-142-hostbar.mjs
//
// ── الشواهد قبل أي رقم (قرار 26) ────────────────────────────────────────────
//   • **موجب:** المفتاحُ مُشغَّل ومضيفٌ بلا أدوات ⇒ **الشريطُ يظهر بالحركة**
//     **ويختفي بالسكون**، **والسحبُ يُحرّك الموضع فعلاً** (رقمٌ يجب أن يتغيّر).
//   • **سالب (١):** المفتاحُ مطفأ ⇒ **لا شريط** — وهو الافتراضُ لكلّ مستخدمٍ اليوم.
//   • **سالب (٢):** مضيفٌ **يُظهر أدواته** ⇒ **لا شريط** (شرطُ #94 المقلوب).
//   • **سالب (٣):** ⭐ **يوتيوب ⇒ لا شريط ولو كان المفتاحُ مُشغَّلاً ولا أدواتِ في
//     الشجرة** — **وهو شرطُ المالك، ويُقاس هنا لا يُوعَد به.**
import http from "node:http";
import {
  launch, configure, openPage, openPageAsHost, contentWorld, evalIn,
  killChrome, refuseUnknownFlags
} from "./ext-harness.mjs";

refuseUnknownFlags([]);

const PORT = 9455, HTTP = 8861;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// صفحةُ القياس: مشغّلٌ بلا أدوات (شكلُ تيك توك) أو بأدوات (شكلُ مشغّلٍ عاديّ)
const PAGE = `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;background:#111;height:100%}
  .feed-video-shell{position:relative;width:900px;height:520px;background:#000}
  video{display:block;width:100%;height:100%;background:#222}
  #bar{position:absolute;left:0;right:0;bottom:0;height:44px;background:rgba(0,0,0,.6)}
  #bar button{height:30px;margin:7px 2px}
</style>
<div id="player" class="feed-video-shell"><video id="v" src="/tone.wav" loop muted autoplay playsinline></video><div id="bar"></div></div>
<div id="player2" class="feed-video-shell" style="margin-top:700px;width:420px;height:740px"><video id="v2" src="/tone.wav" loop muted autoplay playsinline></video></div>
<div id="player3" class="feed-video-shell" style="width:900px;height:506px"><video id="v3" src="/tone.wav" loop muted autoplay playsinline></video></div>
<script>
  var q = new URLSearchParams(location.search);
  var bar = document.getElementById("bar");
  var kind = q.get("ctrl");
  // ⛔⭐⭐ **ثلاثُ حالاتٍ لا حالتان — والتفريقُ بينها هو البند** (#142ب):
  //   "bar"  = شريطُ مشغّلٍ حقيقيّ: **فيه ما يُنقِّل** (منزلق) ⇒ نمتنع.
  //   "feed" = أزرارُ خلاصة (إعجاب/تعليق/مشاركة): **أزرارٌ بلا تنقّل** ⇒ نرسم.
  //   غيرُهما = بلا شيء ⇒ نرسم.
  // ⭐ **والثانيةُ هي حالُ تيك توك وإنستقرام، وهي التي كانت تُقرأ «مضيفٌ له أدواته».**
  if (kind === "bar") {
    var sl = document.createElement("div");
    sl.setAttribute("role", "slider");
    sl.style.cssText = "height:6px;margin:19px 12px;background:#888;border-radius:3px";
    bar.appendChild(sl);
    for (var i = 0; i < 4; i++) { var b = document.createElement("button"); b.textContent = "b" + i; bar.appendChild(b); }
  } else if (kind === "feed") {
    bar.style.cssText = "position:absolute;right:8px;bottom:60px;left:auto;height:auto;background:none";
    for (var j = 0; j < 4; j++) { var f = document.createElement("button"); f.textContent = "♥";
      f.style.cssText = "display:block;width:40px;height:40px;margin:6px 0"; bar.appendChild(f); }
  } else { bar.remove(); }
</script>`;

const M = `(() => {
  const bar = document.querySelector(".vzHostBar");
  const v = document.getElementById("v");
  const t = document.querySelector(".vzHbTrack");
  const cs = bar ? getComputedStyle(bar) : null;
  const r = t ? t.getBoundingClientRect() : null;
  return {
    exists: !!bar,
    shown: !!bar && !bar.classList.contains("vzHidden") && cs.display !== "none",
    live: bar ? bar.getAttribute("data-vz-live") : null,
    time: (document.querySelector(".vzHbTime") || {}).textContent || null,
    fill: (document.querySelector(".vzHbFill") || {}).style ? document.querySelector(".vzHbFill").style.width : null,
    track: r ? { x: Math.round(r.left), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) } : null,
    cur: v ? Math.round(v.currentTime * 100) / 100 : null,
    dur: v ? Math.round((v.duration || 0) * 100) / 100 : null
  };
})()`;

const SETTINGS = (hostBar) => ({
  settings: {
    enabled: true, idle: { ms: 1200 },
    overlay: { autoHideMs: 900, volumeAutoHideMs: 900, enabled: true, hintEnabled: true, hostBar },
    zones: { enabled: true, fullscreenOnly: false,
      wheel: { map: { "4": { up: ["ACTION:SPEED:+0.25"], down: ["ACTION:SPEED:-0.25"] } } } }
  },
  globalSiteRules: { enabled: true, mappings: [] }
});

async function wiggle(c, x, y, n = 3) {
  for (let i = 0; i < n; i++) {
    await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + i * 6, y: y + i * 4, buttons: 0 });
    await sleep(80);
  }
}

// ── ⛔⭐⭐ خادمٌ يدعم النطاقات — **وهو شرطُ القياس لا تحسينُه** ────────────────
// **المقيس أوّلاً:** خادمُ الفحص المشترك يُرسل الملفّ كاملاً بلا `Accept-Ranges`
// ⇒ **كروم يُعلن نافذةَ تنقّلٍ فارغة (`seekable.end(0) = 0`)** ⇒ **و`seek` ترفض
// بحقّ.** ⇒ ⭐ **فكانت الحمرةُ عن الفخّ لا عن الشريط** — **وحالٌ لم تُنتَج تُقرأ
// عطباً** (قرار 22 · والشاهد الثاني في قرار 26).
function wav(seconds = 30, rate = 8000) {
  const n = seconds * rate;
  const d = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + d.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(d.length, 40);
  return Buffer.concat([h, d]);
}
const WAV = wav();
const srv = http.createServer((q, res) => {
  if (q.url.startsWith("/tone.wav")) {
    const m = /bytes=(\d*)-(\d*)/.exec(q.headers.range || "");
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Number(m[2]) : WAV.length - 1;
      res.writeHead(206, {
        "content-type": "audio/wav",
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${WAV.length}`,
        "content-length": end - start + 1
      });
      return res.end(WAV.subarray(start, end + 1));
    }
    res.writeHead(200, { "content-type": "audio/wav", "accept-ranges": "bytes",
      "content-length": WAV.length });
    return res.end(WAV);
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(PAGE);
});
await new Promise((r) => srv.listen(HTTP, "127.0.0.1", r));
let h = null, code = 0;
const rows = [];
try {
  h = await launch(PORT, { withExtension: true, extra: ["--window-size=1440,900"] });

  for (const cell of [
    { label: "موجب — مفتاحٌ مُشغَّل ومضيفٌ بلا أدوات", on: true, ctrl: "0", yt: false, expect: true },
    { label: "سالب ١ — المفتاحُ مطفأ", on: false, ctrl: "0", yt: false, expect: false },
    { label: "سالب ٢ — مضيفٌ له شريطٌ يُنقِّل (منزلق)", on: true, ctrl: "bar", yt: false, expect: false },
    { label: "سالب ٣ — يوتيوب (والمفتاحُ مُشغَّل وبلا أدوات)", on: true, ctrl: "0", yt: true, expect: false },
    { label: "⭐ موجب ٢ — أزرارُ خلاصةٍ بلا تنقّل (حالُ تيك توك وإنستقرام)", on: true, ctrl: "feed", yt: false, expect: true }
  ]) {
    const out = { label: cell.label, expect: cell.expect };
    const cfg = await configure(PORT, h.extensionId, SETTINGS(cell.on));
    if (!cfg.ok) throw new Error("تعذّر ضبط التخزين");
    const path = `/?ctrl=${cell.ctrl}`;
    const page = cell.yt
      ? (await openPageAsHost(PORT, { host: "www.youtube.com", path, html: PAGE })).c
      : await openPage(PORT, `http://127.0.0.1:${HTTP}${path}`);
    try {
      await sleep(3000);
      out.world = !!(await contentWorld(page));
      const v0 = await evalIn(page, `(() => { const v = document.getElementById("v");
        if (!v) return null; const r = v.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height),
                 x: Math.round(r.left), y: Math.round(r.top) }; })()`);
      if (!v0 || v0.w <= 0) { out.why = "لا فيديو بمستطيلٍ غير صفريّ"; rows.push(out); continue; }
      // ⛔⭐ **الحالُ تُنتَج ويُتحقَّق منها قبل أن يُقرأ عليها رقم** (قرار 22):
      // **فيديو لم يُشغَّل قد تكون نافذةُ تنقّله فارغة** — و`seek` ترفض بحقّ،
      // **فيُقرأ رفضُها عطباً في الشريط وهو حالٌ لم تُنتَج.**
      out.ready = await evalIn(page, `(async () => { const v = document.getElementById("v");
        try { await v.play(); } catch (e) {}
        await new Promise((r) => setTimeout(r, 600));
        return { paused: v.paused, seekable: v.seekable.length,
                 end: v.seekable.length ? Math.round(v.seekable.end(0) * 100) / 100 : null }; })()`);
      await wiggle(page, v0.x + Math.round(v0.w / 2), v0.y + Math.round(v0.h / 2));
      await sleep(500);
      out.moved = await evalIn(page, M);

      // ── السحب — **يُقاس بالرقم الذي يجب أن يتغيّر** (قرار 26) ──────────────
      if (out.moved.shown && out.moved.track && out.moved.track.w > 20) {
        const t = out.moved.track;
        out.before = out.moved.cur;
        const x = t.x + Math.round(t.w * 0.7);
        await page.send("Input.dispatchMouseEvent",
          { type: "mousePressed", x, y: t.y, button: "left", buttons: 1, clickCount: 1 });
        await sleep(120);
        await page.send("Input.dispatchMouseEvent",
          { type: "mouseReleased", x, y: t.y, button: "left", buttons: 0, clickCount: 1 });
        await sleep(500);
        out.after = (await evalIn(page, M)).cur;
        out.seeked = typeof out.before === "number" && typeof out.after === "number" &&
                     Math.abs(out.after - out.before) > 1;
      }
      // ── ⭐⭐ #142ج — **الخلاصة: أيتبع الشريطُ الفيديوَ تحت المؤشّر؟** ────────
      // **العطبُ المقيس عند المالك (إنستقرام): الشريطُ ظاهرٌ ومرسومٌ خارج الشاشة**
      // — **يتبع منشوراً صعِد بالتمرير.** ⇒ **فيُنتَج الحال: يُربَط بالأوّل، ثمّ
      // يُمرَّر ويُحوَّم على الثاني، ويُقاس أين رُسم.**
      if (cell.expect) {
        out.feed = await evalIn(page, `(async () => {
          const p2 = document.getElementById("player2");
          window.scrollTo(0, p2.getBoundingClientRect().top + window.scrollY - 40);
          await new Promise((r) => setTimeout(r, 400));
          const r2 = p2.getBoundingClientRect();
          return { y: Math.round(r2.top + r2.height / 2), x: Math.round(r2.left + r2.width / 2),
                   top2: Math.round(r2.top) }; })()`);
        await wiggle(page, out.feed.x, out.feed.y, 3);
        await sleep(500);
        out.afterScroll = await evalIn(page, `(() => {
          const b = document.querySelector(".vzHostBar");
          const r = b ? b.getBoundingClientRect() : null;
          const v2 = document.getElementById("v2").getBoundingClientRect();
          return { shown: !!b && !b.classList.contains("vzHidden"),
                   top: r ? Math.round(r.top) : null,
                   onScreen: !!r && r.top >= 0 && r.top < window.innerHeight,
                   onSecond: !!r && Math.abs((r.top + r.height) - v2.bottom) < 6 }; })()`);
        await evalIn(page, "window.scrollTo(0, 0)");
        await sleep(300);
        // ── ⭐⭐ #142ز — **تمريرٌ بالعجلة والمؤشّرُ ثابت** (كما يفعل المستخدم) ─────
        // ⛔⭐⭐ **والمنشوران بعرضين مختلفين شرطٌ لا زينة**: بعرضٍ واحد **يطابق
        // الغلافُ الفيديوَ الخطأ بالمصادفة** ⇒ **فيخضرّ الشاهدُ عن لا شيء** —
        // **وقد وقع فعلاً: لم يُحمّر على النصّ السابق حتى فُرّق العرضان.**
        // ⛔ **والفرقُ عن الفحص أعلاه ليس تفصيلاً**: هناك يتحرّك المؤشّر فيُعاد
        // الربط، **وهنا لا يتحرّك** — **والعجلةُ حدثٌ يسبق التمرير فتقرأ الصفحةَ
        // قبل أن تتحرّك** ⇒ **فالربطُ يتأخّر خطوةً والشريطُ يخرج عن مكانه.**
        // ⛔⭐⭐ **والحالُ تُنتَج قبل أن تُقاس** (قرار 22): **يُثبَّت الربطُ على المنشور
        // الأوّل بحركةٍ صريحة، ثمّ يُمرَّر حتى يصير تحت المؤشّر منشورٌ آخر** ⇒
        // **فالربطُ الباتُّ يصير مكشوفاً.** ⚠️ **وبلا هذا التثبيت صادف الربطُ الصوابَ
        // فخضِر الشاهدُ على النصّ السابق** — **أخضرُ عن لا شيء، وقد وقع فعلاً.**
        await evalIn(page, "window.scrollTo(0, 0)");
        await sleep(300);
        await wiggle(page, out.feed.x, 140, 3);
        await sleep(450);
        for (let k = 0; k < 16; k++) {
          await page.send("Input.dispatchMouseEvent",
            { type: "mouseWheel", x: out.feed.x, y: 140, deltaX: 0, deltaY: 120 });
          await sleep(60);
        }
        await sleep(700);
        out.wheelBind = await evalIn(page, `((__PX, __PY) => {
          const w = document.querySelector(".vzWrap");
          const r = w ? w.getBoundingClientRect() : null;
          // ⚠️ **يُقرأ عند المؤشّر لا عند مركز الشاشة** — وأوّلُ صياغةٍ قرأت المركز
          // **والمنشورُ الثاني لا يبلغه** ⇒ **فأخذت فيديو منشورٍ آخر وطبعت «لا يطابق»
          // عن ربطٍ صحيح**: **مقيسٌ جارُ المطلوب** (قرار 81)، في مِجَسّي أنا.
          const at = document.elementFromPoint(__PX, __PY);
          const v = at ? (at.tagName === "VIDEO" ? at : (at.querySelector && at.querySelector("video"))) : null;
          const vr = v ? v.getBoundingClientRect() : null;
          return { has: !!(r && vr),
                   match: !!(r && vr && Math.abs(r.left - vr.left) < 4 && Math.abs(r.width - vr.width) < 4),
                   wrap: r ? [Math.round(r.left), Math.round(r.width)] : null,
                   vid: vr ? [Math.round(vr.left), Math.round(vr.width)] : null }; })(${out.feed.x}, 140)`);
        await evalIn(page, "window.scrollTo(0, 0)");
        await sleep(300);
      }
      // ── ⭐ #142د — **زرُّ ملء الشاشة: أموجود؟ أمرئيّ؟ أوقع الأثر؟** (قرار 109)
      // **وثلاثةُ أسئلةٍ لا واحد** — ومنها «مرئيّ» بمقاسٍ غيرِ صفريّ، **فأيقونةٌ
      // بلا قاعدةِ مقاسٍ تُقاس 0×0 وتُقرأ «موجودة»** (#108).
      if (cell.expect) {
        out.fsBtn = await evalIn(page, `(() => {
          const b = document.querySelector(".vzHbFs");
          const ic = document.querySelector(".vzHbIcon");
          const r = b ? b.getBoundingClientRect() : null;
          const ir = ic ? ic.getBoundingClientRect() : null;
          return { exists: !!b, w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null,
                   icon: ir ? [Math.round(ir.width), Math.round(ir.height)] : null,
                   x: r ? Math.round(r.left + r.width / 2) : null,
                   y: r ? Math.round(r.top + r.height / 2) : null }; })()`);
        if (out.fsBtn.exists && out.fsBtn.w > 0) {
          await page.send("Input.dispatchMouseEvent",
            { type: "mousePressed", x: out.fsBtn.x, y: out.fsBtn.y, button: "left", buttons: 1, clickCount: 1 });
          await page.send("Input.dispatchMouseEvent",
            { type: "mouseReleased", x: out.fsBtn.x, y: out.fsBtn.y, button: "left", buttons: 0, clickCount: 1 });
          // ⚠️ **يُقرأ قبل أن تنقضي مهلةُ التلميح (900ms)** — وأوّلُ صياغةٍ انتظرت
          // 900ms **فقرأت `null` عن سطرٍ ظهر واختفى**: حالٌ انقضت لا حالٌ لم تقع.
          await sleep(250);
          // ⛔⭐⭐ **حدٌّ مُعلَنٌ مُسجَّلٌ عندنا سلفاً، ولا يُقرأ عطباً:** نقرةٌ
          // مُرسَلة بـ`Input.dispatchMouseEvent` **لا تُحتسب إيماءةَ مستخدم**،
          // **فيرفض المتصفّحُ ملءَ الشاشة** — وهو مكتوبٌ بنصّه في رأس
          // `tools/repro-58-fullscreen.mjs` منذ يومه.
          // ⇒ ⭐ **فيُقاس ما يُستطاع: أوَصلت النقرةُ إلى مسارنا؟** — **ورفضُ
          // المتصفّح نفسُه أثرٌ يُرى**: مسارُنا يكتب سببَ الرفض في سطر التلميح
          // (#9 · #33) ⇒ **فوجودُه إثباتٌ أن الأمرَ دُفع، لا أن ملءَ الشاشة وقع.**
          // ⚠️ **ولا يُقال «ملءُ الشاشة يعمل»** — ذاك عند المالك في `ش6`.
          out.fsAfter = await evalIn(page, `(() => {
            const e = document.fullscreenElement;
            const h = document.querySelector(".vzHint");
            return { fsEl: e ? (e.tagName + "." + String(e.className).split(" ")[0]) : null,
                     hint: h && !h.classList.contains("vzHidden") ? (h.textContent || "").slice(0, 40) : null }; })()`);
          await evalIn(page, "document.fullscreenElement ? document.exitFullscreen() : 0");
          await sleep(600);
        }
      }
      // ── ⭐ #142هـ — **زرّا التشغيل والصوت: أثرُهما يُقاس ولا يُوعَد به** ──────
      // ⭐ **وخلافاً لزرّ ملء الشاشة، هذان لا يحتاجان إيماءةَ مستخدم** ⇒ **فالنقرةُ
      // الاصطناعية تكفي، والحكمُ برقمٍ يجب أن يتغيّر** (قرار 26).
      if (cell.expect) {
        out.btns = await evalIn(page, `(() => {
          const g = (sel) => { const b = document.querySelector(sel); if (!b) return null;
            const r = b.getBoundingClientRect();
            return { w: Math.round(r.width), x: Math.round(r.left + r.width / 2),
                     y: Math.round(r.top + r.height / 2) }; };
          const v = document.getElementById("v");
          const ic = (sel) => { const e = document.querySelector(sel);
            return e ? !e.classList.contains("vzHidden") : null; };
          return { play: g(".vzHbPlay"), mute: g(".vzHbMute"),
                   paused: v.paused, muted: v.muted,
                   iPlay: ic(".vzHbPlayIcon"), iPause: ic(".vzHbPauseIcon"),
                   iVol: ic(".vzHbVolIcon"), iMuted: ic(".vzHbMutedIcon") }; })()`);
        // ⛔⭐⭐ **سؤالان لا سؤال، وقياسان لا قياس** (قرار 109):
        //   **أمُصابٌ بالنقر؟** — `elementFromPoint` على مركزه: **يقيس إمكانَ النقر
        //   فعلاً** (الطبقةُ شفّافةٌ للأحداث إلا شريطَنا).
        //   **وأوقع الأثر؟** — نقرةٌ من الشجرة على العنصر نفسِه: **تُشغّل مستمعَنا
        //   الذي تُشغّله نقرةُ المستخدم بعينه.**
        // ⚠️ **ولماذا لا تُستعمل نقرةُ `Input.dispatchMouseEvent` هنا:** **مقيسٌ أنها
        // لا تبلغ عناصرَ طبقتنا في هذا الرِكاز** — لا `paused` تبدّل ولا `muted`
        // **ولا سطرُ تلميحٍ ظهر** ⇒ **وحالٌ لا تصل لا يُقاس عليها شيء**، **ونقرةُ
        // المالك الحقيقية تعمل (تحقّقُ `ش6`).** ⇒ **فيُقاس ما يُستطاع، ويُعلَن الحدّ.**
        // ⚠️ **والمؤشّرُ يُثبَّت على الفيديو الأوّل قبل النقر** — الصفحةُ فيها فيديوان
        // (نموذجُ الخلاصة)، **والشريطُ يتبع ما تحت المؤشّر** ⇒ **فبلا تثبيتٍ يُقاس
        // فيديوٌ غيرُ الذي يعمل عليه الزرّ.**
        await wiggle(page, v0.x + Math.round(v0.w / 2), v0.y + Math.round(v0.h / 2), 3);
        await sleep(400);
        // ⛔⭐ **«مُصاب» يُقاس بوجوده في كومة النقر لا بمطابقة العنصر الأعلى:**
        // **الأعلى هو `<svg>` داخل الزرّ**، **وأوّلُ صياغةٍ قارنت الأعلى بالزرّ
        // فطبعت «غيرُ مُصاب» عن زرٍّ مُصاب** — **مطابقةٌ أضيقُ من سؤالها هذي المرّة.**
        out.hit = await evalIn(page, `(() => {
          const at = (sel) => { const b = document.querySelector(sel); if (!b) return null;
            const r = b.getBoundingClientRect();
            const st = document.elementsFromPoint(Math.round(r.left + r.width / 2),
                                                  Math.round(r.top + r.height / 2));
            const i = st.indexOf(b);
            return i >= 0 && i <= 3; };
          return { play: at(".vzHbPlay"), mute: at(".vzHbMute"), fs: at(".vzHbFs") }; })()`);
        // ⛔⭐⭐ **وشكلُ الأيقونة يُقاس لا يُفترض** (عطبٌ حيٌّ 2026-09-06): **قاعدةُ
        // `fill` في CSS تغلب سمةَ العرض التي يضعها الراسم** ⇒ **أيقونةٌ مخطوطة
        // مُلئت فظهرت مربّعاً أبيض، وكلُّ الفحوص خضراء** (موجودةٌ · بمقاسٍ صحيح
        // · ومُصابةٌ بالنقر). ⇒ ⭐ **«موجودٌ ومرئيّ» لا يقول «الشكلُ صحيح».**
        out.fills = await evalIn(page, `(() => {
          const f = (sel) => { const e = document.querySelector(sel);
            return e ? getComputedStyle(e).fill : null; };
          return { fit: f(".vzHbIcon"), play: f(".vzHbPlayIcon"),
                   pause: f(".vzHbPauseIcon"), vol: f(".vzHbVolIcon") }; })()`);
        await evalIn(page, `(() => { document.querySelector(".vzHbPlay").click();
                                     document.querySelector(".vzHbMute").click(); })()`);
        await sleep(350);
        out.btnsAfter = await evalIn(page, `(() => {
          const v = document.getElementById("v");
          const ic = (sel) => { const e = document.querySelector(sel);
            return e ? !e.classList.contains("vzHidden") : null; };
          return { paused: v.paused, muted: v.muted,
                   iPlay: ic(".vzHbPlayIcon"), iPause: ic(".vzHbPauseIcon"),
                   iVol: ic(".vzHbVolIcon"), iMuted: ic(".vzHbMutedIcon") }; })()`);
        // ⚠️ **تُعاد الحالُ كما كانت**: خطوةٌ تُخلّف حالاً لمن بعدها تُفسد قياسَه (قرار 125)
        await evalIn(page, `(async () => { const v = document.getElementById("v");
          v.muted = true; try { await v.play(); } catch (e) {} })()`);
        await sleep(300);
      }
      // ⚠️ **والسكونُ يُقاس بعد الحركة لا قبلها**: الشريطُ يظهر بالحركة، **فاختفاؤه
      // بعد المهلة نصفُ العقد** — ومن قاس الظهور وحدَه قاس نصفَ الوعد.
      // ⛔⭐ **والمؤشّرُ يُزاح عن الشريط أوّلاً**: القاعدةُ العامّة (#95) **لا يُخفى
      // ما يستقرّ المؤشّر عليه** — **فقياسُ السكون والإصبعُ على الشريط يقيس
      // امتناعاً مقصوداً ويُسمّيه عطباً.**
      await wiggle(page, v0.x + Math.round(v0.w / 2), v0.y + 20, 2);
      await sleep(2200);
      out.idle = await evalIn(page, M);
      rows.push(out);
    } finally { try { page.ws.close(); } catch (e) { /* مغلقٌ سلفاً */ } }
  }
} catch (e) {
  console.log("⛔ رمى: " + (e?.message || e));
  code = 1;
} finally {
  if (h) killChrome(h);
  try { srv.close(); } catch (e) { /* أُغلق سلفاً */ }
}
console.log("\n══════ #142 — شريطُ تقدّمٍ لمضيفٍ بلا أدوات ══════\n");
for (const r of rows) {
  const shown = r.moved ? r.moved.shown : null;
  const ok = shown === r.expect;
  console.log(`${ok ? "✅" : "❌"} ${r.label}`);
  console.log(`   متوقَّع=${r.expect ? "يظهر" : "لا يظهر"} · مقيس=${shown}` +
    (r.why ? " · ⛔ " + r.why : "") + ` · عالمُ الإضافة=${r.world}`);
  if (r.moved) {
    console.log(`   عنصرٌ موجود=${r.moved.exists} · وقت=${r.moved.time} · تعبئة=${r.moved.fill}` +
      ` · بثّ=${r.moved.live} · مدّة=${r.moved.dur}`);
  }
  if (r.ready) console.log(`   الحالُ المُنتَجة: مُشغَّل=${!r.ready.paused} · نافذةُ التنقّل=${r.ready.seekable} · نهايتُها=${r.ready.end}`);
  if (r.wheelBind) {
    console.log(`   ⇒ تمريرٌ بالعجلة والمؤشّرُ ثابت: طابق=${r.wheelBind.match}` +
      ` غلاف=${r.wheelBind.wrap} فيديو=${r.wheelBind.vid}`);
  }
  if (r.fills) {
    console.log(`   ⇒ تعبئةُ الأيقونات: مخطوطة(fit)=${r.fills.fit} · ممتلئة(تشغيل/إيقاف/صوت)=` +
      `${r.fills.play}/${r.fills.pause}/${r.fills.vol}`);
  }
  if (r.hit) {
    console.log(`   ⇒ إصابةُ النقر (elementFromPoint): تشغيل=${r.hit.play} صوت=${r.hit.mute} ملءُ شاشة=${r.hit.fs}`);
  }
  if (r.btns) {
    console.log(`   ⇒ زرّا التشغيل والصوت: مقاس=${r.btns.play && r.btns.play.w}/${r.btns.mute && r.btns.mute.w}` +
      ` · قبل: paused=${r.btns.paused} muted=${r.btns.muted} أيقونة(تشغيل/إيقاف)=${r.btns.iPlay}/${r.btns.iPause}` +
      ` · بعد: paused=${r.btnsAfter && r.btnsAfter.paused} muted=${r.btnsAfter && r.btnsAfter.muted}` +
      ` أيقونة=${r.btnsAfter && r.btnsAfter.iPlay}/${r.btnsAfter && r.btnsAfter.iPause}` +
      ` صوت=${r.btnsAfter && r.btnsAfter.iVol}/${r.btnsAfter && r.btnsAfter.iMuted}`);
  }
  if (r.fsBtn) {
    console.log(`   ⇒ زرُّ ملء الشاشة: موجود=${r.fsBtn.exists} مقاس=${r.fsBtn.w}x${r.fsBtn.h}` +
      ` أيقونة=${r.fsBtn.icon} · بعد النقر: عنصر=${r.fsAfter && r.fsAfter.fsEl}` +
      ` تلميح=${r.fsAfter && r.fsAfter.hint}`);
  }
  if (r.afterScroll) {
    console.log(`   ⇒ الخلاصة: بعد التمرير والتحويم على الثاني — يظهر=${r.afterScroll.shown}` +
      ` رأسُه=${r.afterScroll.top} داخلَ الشاشة=${r.afterScroll.onScreen}` +
      ` على الفيديو الثاني=${r.afterScroll.onSecond}`);
  }
  if (r.idle) console.log(`   بعد السكون: يظهر=${r.idle.shown}`);
  if (r.seeked !== undefined) {
    console.log(`   ⇒ السحب: ${r.before} ⇒ ${r.after} — ${r.seeked ? "✅ تحرّك الموضع" : "❌ لم يتحرّك"}`);
  }
  console.log("");
}
const poss = rows.filter((r) => r.expect);
const pos = poss[0];
const negs = rows.filter((r) => !r.expect);
const posOk = !!pos && pos.moved && pos.moved.shown === true && pos.seeked === true &&
              pos.idle && pos.idle.shown === false &&
              poss.every((r) => r.moved && r.moved.shown === true) &&
              poss.every((r) => r.afterScroll && r.afterScroll.onScreen === true &&
                                r.afterScroll.onSecond === true) &&
              // ⛔⭐⭐ **الزرّ: موجودٌ · ومرئيٌّ بمقاسٍ غيرِ صفريّ — ولا يُقاس أثرُه هنا.**
              // **حدٌّ مُعلَنٌ مُسجَّلٌ عندنا منذ `repro-58`: نقرةُ `Input.dispatchMouseEvent`
              // لا تُحتسب إيماءةَ مستخدم، فيرفض المتصفّحُ ملءَ الشاشة.**
              // ✅ **والمسارُ نفسُه أُثبت بنداءٍ مباشرٍ تحت إيماءةٍ حقيقية**
              // (`Runtime.evaluate` بـ`userGesture`): **دخل ملءَ الشاشة على
              // `DIV.feed-video-shell`** — **فالمقيسُ أن المسار يعمل، لا أن النقرة تصل.**
              // ⇒ ⚠️ **و«أتصل النقرةُ؟» سؤالٌ بيد المالك في `ش6`، ولا يُدَّعى هنا.**
              poss.every((r) => r.fsBtn && r.fsBtn.w > 0 && r.fsBtn.icon && r.fsBtn.icon[0] > 0) &&
              // **الثلاثةُ مُصابةٌ بالنقر فعلاً** — والطبقةُ شفّافةٌ لما سواها
              poss.every((r) => r.hit && r.hit.play && r.hit.mute && r.hit.fs) &&
              // ⛔⭐⭐ **وفحصُ التمرير يُطبع ولا يدخل الحكم — لأنه لم يُثبَت أنه
              // يُحمّر** (قرار 47): **جُرّب على النصّ السابق بثلاث هيئاتٍ للصفحة
              // (منشوران بعرضٍ واحد · ثمّ بعرضين · ثمّ ثلاثةٌ متناوبة) فخضِر في
              // الثلاث** — **وهندسةُ هذي الصفحة لا تُنتج «الربطَ المتأخّر خطوة».**
              // ✅ **والعطبُ نفسُه مُعادٌ إنتاجُه بالقياس في مِجَسٍّ منفصل** (ثلاثةُ
              // منشورات 420/900/420، تمريرٌ بالعجلة والمؤشّرُ ثابت): **الغلاف
              // `[263,-180,900,506]` والمؤشّرُ على منشورٍ مستطيلُه `[503,366,420,740]`**
              // ⇒ **ثمّ طابق بعد الإصلاح.**
              // ⇒ ⛔ **فحكمٌ لا يُحمّر لا يُصدَّق أخضرُه، ويبقى سطراً يُقرأ** —
              // **ومُطلِقُ ترقيته: أن تُبنى للرِكاز صفحةُ خلاصةٍ تُنتج الحال.**
              // **المخطوطةُ بلا تعبئة، والممتلئةُ بلونها** — وإلا ظهرت مربّعاً
              poss.every((r) => r.fills && r.fills.fit === "none" &&
                                r.fills.play !== "none" && r.fills.pause !== "none" &&
                                r.fills.vol !== "none") &&
              // **الزرّان: مرئيّان · وأثرُهما وقع · والأيقونةُ تبعت الحال**
              poss.every((r) => r.btns && r.btnsAfter &&
                                r.btns.play && r.btns.play.w > 0 && r.btns.mute && r.btns.mute.w > 0 &&
                                r.btnsAfter.paused !== r.btns.paused &&
                                r.btnsAfter.muted !== r.btns.muted &&
                                r.btnsAfter.iPause === !r.btnsAfter.paused &&
                                r.btnsAfter.iMuted === !!r.btnsAfter.muted);
const negOk = negs.every((r) => r.moved && r.moved.shown === false);
console.log("── الشاهدان (قرار 26)");
console.log("   موجبان (يظهر · يُنقِّل · يختفي بالسكون · يبقى مع أزرار الخلاصة · يتبع المؤشّر · أزرارُه تُصاب ويقع أثرُها · ويطابق بعد التمرير): " + (posOk ? "✅" : "❌"));
console.log("   وسوالبُه الثلاثة (مطفأ · مضيفٌ له منزلق · يوتيوب): " + (negOk ? "✅" : "❌"));
if (!(posOk && negOk)) {
  console.log("\n⛔ **لا يُقرأ من هذا رقمٌ عن الميزة حتى يخضرّ الشاهدان.**");
  code = 1;
}
process.exitCode = code;
