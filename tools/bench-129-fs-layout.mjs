// قياسُ #129 — **ما يظهر في مشغّل يوتيوب في ملء الشاشة**: العناصرُ ومواضعُها.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يفتح **يوتيوب حيّاً**
// ثلاث مرّات (watch · قائمة تشغيل · بثّ) — **فالشبكةُ والحجبُ داخل بوّابة كومِت
// يُصيّران أحمرَه ضجيجاً يُقرأ إذناً بالتخطّي** (تحذير #97).
// ⇒ **ومُطلِقُه: رفعُ النسخة** (يُسحب مع الخمسة والثلاثين) · **وكلُّ تغييرٍ في
// إطار المحاكاة** — **فهو شاهدُ قبوله: أرقامُه هي ما رُسم عليه.**
// ⚠️ **ويوتيوب يُغيّر مشغّلَه** ⇒ **أحمرُه قد يكون خبراً عن المضيف لا عطباً
// عندنا** — يُقرأ نصُّه، ولا يُنسب بحجّة (قرار المالك).
//
//   node tools/bench-129-fs-layout.mjs        # JSON خامٌّ إلى المخرج
//
// ⛔ **يقيس بنيةَ المضيف لا ميزتَنا** ⇒ `withExtension:false` مقصود ومُعلَن:
// أزرارُنا تُرسم في الإطار من سجلّنا، والمقيسُ هنا شريطُ يوتيوب وحدَه.
// ⚠️ **وشواهدُ قرار 26 قبل أي رقم**: موجبٌ (زرُّ التشغيل يُرى) · سالبٌ (صنفٌ
// مخترَع ⇒ صفر) · **وشاهدُ الحال: ملءُ الشاشة وقع فعلاً** (`fullscreenElement`
// + صنف `ytp-fullscreen` + مستطيلُ الفيديو ≈ الشاشة) — **وبلا الثالث نقيس
// النافذةَ ونسمّيها ملءَ الشاشة** (قرار 22 · 125).
import { launch, openPage, evalIn, killChrome } from
  "./ext-harness.mjs";

const PORT = 9793;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const PLIST = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLMC9KNkIncKtGvr2kFRuXBVmBev6cAJ2u";
const LIVE  = "https://www.youtube.com/watch?v=jfKfPfyJRdk";

// مرشَّحو اللقطة + ما في الإطار اليوم + مفاتيح Clean Player ذات الصلة
const SELS = [
  ".ytp-fullscreen-metadata", ".ytp-title", ".ytp-title-channel",
  ".ytp-chrome-top", ".ytp-gradient-top", ".ytp-chrome-top-buttons",
  ".ytp-fullscreen-quick-actions", ".ytp-fullerscreen-edu-button", ".ytp-fullscreen-grid",
  ".ytp-fullscreen-grid-stills-container", ".ytp-expand-right-bottom-section-button",
  ".ytp-progress-bar-container", ".ytp-chrome-bottom", ".ytp-gradient-bottom",
  ".ytp-left-controls", ".ytp-right-controls",
  ".ytp-play-button", ".ytp-mute-button", ".ytp-volume-panel", ".ytp-volume-slider",
  ".ytp-time-display", ".ytp-live-badge", ".ytp-subtitles-button", ".ytp-settings-button",
  ".ytp-size-button", ".ytp-fullscreen-button", ".ytp-miniplayer-button", ".ytp-pip-button",
  ".ytp-prev-button", ".ytp-next-button", ".ytp-remote-button", ".ytp-chapter-container",
  ".ytp-heat-map-container", ".ytp-watermark", ".ytp-cards-button",
  "button.ytp-button[data-tooltip-target-id='ytp-autonav-toggle-button']",
  ".ytp-zzz-not-a-real-class"                                   // ⬅ الشاهد السالب
];

const PROBE = (sels) => `(() => {
  const P = document.querySelector("#movie_player");
  const V = document.querySelector("video");
  const cls = (el) => { const c = el.className;
    return (c && typeof c === "object" && "baseVal" in c ? c.baseVal : String(c || "")); };
  const box = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const op = parseFloat(cs.opacity);
    return { w: Math.round(r.width), h: Math.round(r.height),
             x: Math.round(r.left), y: Math.round(r.top), op,
             why: cs.display === "none" ? "display:none"
                : cs.visibility === "hidden" ? "visibility:hidden"
                : op === 0 ? "opacity:0"
                : (r.width > 0 && r.height > 0) ? "" : "مستطيل صفريّ" }; };
  const out = {};
  for (const s of ${JSON.stringify(sels)}) {
    let els; try { els = [...document.querySelectorAll(s)]; }
    catch (e) { out[s] = { err: String(e.message).slice(0, 60) }; continue; }
    out[s] = { n: els.length, els: els.slice(0, 2).map((el) => ({
      cls: cls(el).slice(0, 70),
      aria: (el.getAttribute("aria-label") || el.getAttribute("title") || "").slice(0, 46),
      txt: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40),
      ...box(el) })) };
  }
  // ── الاكتشاف: كلُّ ما يُنقر داخل المشغّل ويُرى — لا قائمةٌ نكتبها نحن ──────
  const btns = [];
  if (P) for (const el of P.querySelectorAll("button, [role='button'], a[href]")) {
    const b = box(el);
    if (b.why || b.w < 8 || b.h < 8) continue;
    btns.push({ cls: cls(el).slice(0, 62),
      aria: (el.getAttribute("aria-label") || el.getAttribute("title") || "").slice(0, 46),
      w: b.w, h: b.h, x: b.x, y: b.y });
  }
  const all = [...document.querySelectorAll("*")];
  const c2 = (e) => String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || "");
  return { out, btns, url: location.href,
           fs: !!document.fullscreenElement,
           fsCls: !!(P && /(^|\\s)ytp-fullscreen(\\s|$)/.test(c2(P))),
           vw: V ? Math.round(V.getBoundingClientRect().width) : 0,
           vh: V ? Math.round(V.getBoundingClientRect().height) : 0,
           sw: screen.width, sh: screen.height,
           paused: V ? V.paused : null, live: V && !isFinite(V.duration),
           ytp: all.filter((e) => /(^|\\s)ytp-/.test(c2(e))).length };
})()`;

const mouseMove = (c, x, y) => c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
async function click(c, x, y) {
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
async function centerOf(page, sel) {
  return await evalIn(page, `(() => { const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null; const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
}
async function hoverPlayer(page) {
  const p = await centerOf(page, "#movie_player");
  if (p) { await mouseMove(page, p.x, p.y); await mouseMove(page, p.x + 3, p.y + 2); }
  return p;
}
async function waitPlayer(page, ms = 30000, needMedia = true) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = await evalIn(page, `(() => { const v = document.querySelector("video");
      if (!v) return null; const b = v.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), rs: v.readyState,
               chrome: !!document.querySelector("#movie_player") }; })()`);
    if (r && r.w > 0 && r.h > 0 && (needMedia ? r.rs >= 2 : r.chrome)) return r;
    await sleep(500);
  }
  return null;
}

const report = { states: {}, notes: [] };
let h = null;
try {
  h = await launch(PORT, { withExtension: false, extra: ["--window-size=1600,1000"] });
  report.chrome = h.chrome;

  for (const [label, url, needMedia] of [["watch", WATCH, true], ["playlist", PLIST, true], ["live", LIVE, false]]) {
    let page = null;
    try {
      page = await openPage(PORT, url);
      const rdy = await waitPlayer(page, label === "live" ? 20000 : 30000, needMedia);
      if (!rdy) { report.states[label] = { skipped: "لم يستقرّ المستطيل — لم يُنتَج" }; continue; }
      await hoverPlayer(page); await sleep(1200);
      report.states[label + ":نافذة"] = await evalIn(page, PROBE(SELS));

      const fsb = await centerOf(page, ".ytp-fullscreen-button");
      if (!fsb) { report.states[label] = { skipped: "لا زرَّ ملء شاشة — لم يُنتَج" }; continue; }
      await click(page, fsb.x, fsb.y);
      await sleep(2500);
      await hoverPlayer(page); await sleep(1200);
      report.states[label + ":ملء"] = await evalIn(page, PROBE(SELS));

      // منزلقُ الصوت: يُعاد النظرُ فيه في ملء الشاشة (لا يُنقل بحكمه القديم)
      const mute = await centerOf(page, ".ytp-mute-button");
      if (mute) {
        await mouseMove(page, mute.x, mute.y); await mouseMove(page, mute.x + 2, mute.y);
        await sleep(900);
        report.states[label + ":ملء+تحويم-صوت"] = await evalIn(page, PROBE(
          [".ytp-volume-panel", ".ytp-volume-slider", ".ytp-mute-button"]));
      }
      if (label === "watch") {   // والإيقافُ: أيظهر «المزيد من الفيديوهات»؟
        await evalIn(page, `document.querySelector("video").pause()`);
        await sleep(1500); await hoverPlayer(page); await sleep(800);
        report.states["watch:ملء+موقوف"] = await evalIn(page, PROBE(SELS));
      }
    } catch (e) { report.states[label] = { skipped: String(e.message).slice(0, 80) }; }
    finally { try { page?.ws?.close(); } catch {} }
  }
} catch (e) {
  report.fatal = String(e?.message || e);
} finally {
  try { killChrome(h); } catch {}
}
console.log(JSON.stringify(report));
