// قياسُ #129 — **أيقع أثرُ مفاتيح Clean Player على عناصر ملء الشاشة؟**
//
// ⛔ **لا يُقرأ الربطُ من مطابقة نصّ المحدِّد للصنف** (قرار 109: أرمى؟ · أموجود؟
// · **أوقع الأثر؟**): **يُشغَّل المفتاحُ بحروفه في ملء الشاشة، ويُقاس ما اختفى.**
// ⭐ **وربحُه في أوّل تشغيلة:** النصُّ كان يقول إن زرَّ «المزيد من الفيديوهات»
// **بلا مفتاح** — **والقياسُ قال مربوط**: الزرُّ داخل `.ytp-fullscreen-grid` نفسِها.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يشتغل على **يوتيوب حيّ** ويحتاج شبكة (تحذير #97). **ومُطلِقُه رفعُ
// النسخة، وكلُّ تغييرٍ في مفاتيح Clean Player أو في الإطار.**
// ⚠️ **وشاهداه في الجدول نفسِه:** موجبٌ (`play_button` يُخفي زرَّ التشغيل) ·
// سالبٌ (صنفٌ مخترَع لا يُخفي شيئاً) — **ولا يُقرأ صفٌّ منه بلا الشاهدين.**
//
//   node tools/bench-129-fs-bind.mjs
import { launch, openPage, evalIn, killChrome } from
  "./ext-harness.mjs";
const PORT = 9795;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

// المفاتيح كما هي في `CLEAN_PLAYER_ITEMS` — تُنسخ بحروفها لا تُختصر
const KEYS = {
  top_titles: [".ytp-title", ".ytp-title-channel", ".ytp-fullscreen-metadata"],
  top_section: [".ytp-chrome-top", ".ytp-gradient-top", ".ytp-chrome-top-buttons"],
  quick_actions: [".ytp-fullscreen-quick-actions"],
  fullscreen_scroll_arrow: ["button.ytp-fullerscreen-edu-button", ".ytp-fullerscreen-edu-button", ".ytp-fullscreen-grid"],
  endscreen: [".html5-endscreen", ".ytp-ce-element", ".ytp-endscreen-content", ".ytp-fullscreen-grid-stills-container"],
  autoplay_toggle: ["button.ytp-button[data-tooltip-target-id='ytp-autonav-toggle-button']"],
  size_button: [".ytp-size-button"],
  watermark: [".ytp-watermark", ".iv-branding"],
  heatmap: [".ytp-heat-map-container", ".ytp-heat-map-chapter"],
  play_button: [".ytp-play-button"],                       // ⬅ الشاهد الموجب
  __fake__: [".ytp-zzz-not-a-real-class"]                  // ⬅ الشاهد السالب
};
// الأهداف: عناصرُ اللقطة كما قِيست
const TARGETS = {
  "العنوان": ".ytp-fullscreen-metadata",
  "صفّ الإجراءات": ".ytp-fullscreen-quick-actions",
  "زرّ إجراءٍ واحد": ".ytp-fullscreen-quick-actions button",
  "شبكة المزيد": ".ytp-fullscreen-grid",
  "صور الشبكة": ".ytp-fullscreen-grid-stills-container",
  "زرّ «المزيد من الفيديوهات»": ".ytp-fullscreen-grid-expand-button",
  "التشغيل التلقائيّ": ".ytp-autonav-toggle",
  "شريط التقدّم": ".ytp-progress-bar-container",
  "الشريط السفليّ": ".ytp-chrome-bottom",
  "زرّ التشغيل": ".ytp-play-button",
  "علامة القناة": ".branding-img-container",
  "الوقت": ".ytp-time-display"
};
const SNAP = `(() => {
  const box = (s) => { const el = document.querySelector(s); if (!el) return { n: 0 };
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const op = parseFloat(cs.opacity);
    return { n: 1, w: Math.round(r.width), h: Math.round(r.height),
             vis: !(cs.display === "none" || cs.visibility === "hidden" || op === 0 || r.width === 0 || r.height === 0) }; };
  const out = {};
  for (const [name, sel] of Object.entries(${JSON.stringify(TARGETS)})) out[name] = box(sel);
  const eb = document.querySelector(".ytp-fullscreen-grid-expand-button");
  const grid = document.querySelector(".ytp-fullscreen-grid");
  out.__parent = eb ? (eb.parentElement ? String(eb.parentElement.className).slice(0, 50) : "") : null;
  out.__inGrid = !!(eb && grid && grid.contains(eb));
  out.__fs = !!document.fullscreenElement;
  return out;
})()`;
const applyCss = (css) => `(() => { let s = document.getElementById("vz_probe_css");
  if (!s) { s = document.createElement("style"); s.id = "vz_probe_css"; document.documentElement.appendChild(s); }
  s.textContent = ${JSON.stringify("")} + ${JSON.stringify(css)}; return s.textContent.length; })()`;
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
let h = null; const report = { binds: {} };
try {
  h = await launch(PORT, { withExtension: false, extra: ["--window-size=1600,1000"] });
  const page = await openPage(PORT, WATCH);
  for (let i = 0; i < 60; i++) {
    const ok = await evalIn(page, `(() => { const v = document.querySelector("video");
      return !!(v && v.readyState >= 2 && v.getBoundingClientRect().width > 0); })()`);
    if (ok) break; await sleep(500);
  }
  const p = await centerOf(page, "#movie_player");
  const hover = async () => { if (p) { await mouseMove(page, p.x, p.y); await mouseMove(page, p.x + 3, p.y + 2); } };
  await hover(); await sleep(1000);
  const fsb = await centerOf(page, ".ytp-fullscreen-button");
  if (fsb) { await click(page, fsb.x, fsb.y); await sleep(2500); await hover(); await sleep(1200); }

  // ⛔⭐ **تُنتَج الحالُ ويُتحقَّق منها قبل أن يُقرأ عليها رقم** (قرار 22 · 125):
  // شريطُ يوتيوب يخبو من تلقائه، **وهدفٌ مخفيٌّ قبل المفتاح لا يستطيع أن يختفي به**
  // ⇒ فيُقرأ «لا أثر» وهو «لم تُنتَج الحال» (الأعمى الثاني في قرار 26).
  // ⛔ **ويُعاد حسابُ المركز بعد ملء الشاشة لا قبله** — أوّلُ صياغةٍ حسبته قبله
  // (`1105×622` في نافذة) **فوقعت الحركةُ خارج إطار `800×600`** ⇒ لم يستيقظ
  // الشريطُ قطّ، **ولولا شرطُ إنتاج الحال لَقُرئ ذلك «المفتاح لا يُخفي»**.
  async function ensureChrome(tag, strict = false) {
    const c = await centerOf(page, "#movie_player");
    for (let i = 0; i < 8; i++) {
      if (c) { await mouseMove(page, c.x + (i % 2 ? 4 : -4), c.y + (i % 3 ? 3 : -3)); }
      await sleep(220);
      const st = await evalIn(page, `(() => {
        const vis = (s) => { const el = document.querySelector(s); if (!el) return false;
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          return !(cs.display === "none" || cs.visibility === "hidden" ||
                   parseFloat(cs.opacity) === 0 || r.width === 0 || r.height === 0); };
        return { bar: vis(".ytp-chrome-bottom"), title: vis(".ytp-fullscreen-metadata"),
                 qa: vis(".ytp-fullscreen-quick-actions") }; })()`);
      // ⚠️ الشرطُ يختلف بالغرض: «قبل/بعد» تشترط الثلاثةَ ظاهرةً — **والمفتاحُ
      // المُشغَّل قد يُخفي هدفاً بحقّ**، فيكفي أن يكون الشريطُ صاحياً.
      if (st && st.bar && (!strict || (st.title && st.qa))) return { ok: true, tries: i + 1 };
    }
    return { ok: false, tag };
  }
  report.produce = { before: await ensureChrome("before", true) };
  report.before = await evalIn(page, SNAP);
  for (const [key, sels] of Object.entries(KEYS)) {
    await evalIn(page, applyCss(sels.map((s) => `html ${s}`).join(",") + "{display:none!important}"));
    await sleep(300);
    const pr = await ensureChrome(key);
    report.binds[key] = await evalIn(page, SNAP);
    report.binds[key].__produced = pr.ok;      // ⬅ الحالُ أُنتجت؟ وإلّا فالنتيجةُ لا تُقرأ
    await evalIn(page, applyCss(""));
    await sleep(250);
  }
  report.produce.after = await ensureChrome("after", true);
  report.after = await evalIn(page, SNAP);
  try { page.ws.close(); } catch {}
} catch (e) { report.fatal = String(e?.message || e); }
finally { try { killChrome(h); } catch {} }
console.log(JSON.stringify(report));
