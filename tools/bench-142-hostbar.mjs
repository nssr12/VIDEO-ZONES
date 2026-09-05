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
<div id="player2" class="feed-video-shell" style="margin-top:700px"><video id="v2" src="/tone.wav" loop muted autoplay playsinline></video></div>
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
                                r.afterScroll.onSecond === true);
const negOk = negs.every((r) => r.moved && r.moved.shown === false);
console.log("── الشاهدان (قرار 26)");
console.log("   موجبان (يظهر · يُنقِّل · يختفي بالسكون · يبقى مع أزرار الخلاصة · ويتبع المؤشّر في الخلاصة): " + (posOk ? "✅" : "❌"));
console.log("   وسوالبُه الثلاثة (مطفأ · مضيفٌ له منزلق · يوتيوب): " + (negOk ? "✅" : "❌"));
if (!(posOk && negOk)) {
  console.log("\n⛔ **لا يُقرأ من هذا رقمٌ عن الميزة حتى يخضرّ الشاهدان.**");
  code = 1;
}
process.exitCode = code;
