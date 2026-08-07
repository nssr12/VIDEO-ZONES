// قياسُ #129 — **أتُسحب أيقوناتُ عناصر ملء الشاشة بحروفها، أم لا مادّةَ لها؟**
//
// ⛔ **يقرّر إمكانَ النسخ لا الشكل** (شرط المالك: لا رسمَ بيد ولا تقريب).
// **والمقيس 2026-08-07:** الخمسةُ في صفّ الإجراءات وزرُّ «المزيد» — **`svg` واحد
// و`path` واحد و`viewBox 0 0 24 24` لكلٍّ** ⇒ **فسُحبت ودخلت `tools/icons.js`.**
// ⭐ **وواحدٌ خرج بلا مادّة: مفتاحُ التشغيل التلقائيّ** — `svg=0 · img=0 · لا
// صورةَ خلفية` ⇒ **بحثنا عمّا يرسمه فوجدناه `div` أبيضَ `30×18` بنصف قطر `9px`
// داخل `48×40`** ⇒ **فنُسخت أرقامُه شكلاً، ولم تُخترع له أيقونة.**
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يسحب المادّة من **مشغّلٍ حيّ** فيحتاج شبكة. **ومُطلِقُه: تغيّرُ رسوم
// يوتيوب** (وهو الحدُّ المكتوب على `VZ_YT_ICONS_DATE`) **أو دخولُ عنصرٍ جديد.**
//
//   node tools/bench-129-fs-icons.mjs
import { launch, openPage, evalIn, killChrome } from
  "./ext-harness.mjs";
const PORT = 9796;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
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
const PULL = `(() => {
  const cls = (el) => { const c = el.className;
    return (c && typeof c === "object" && "baseVal" in c ? c.baseVal : String(c || "")); };
  const pull = (el) => {
    if (!el) return null;
    const svg = el.querySelector("svg");
    const ps = svg ? [...svg.querySelectorAll("path")] : [];
    return { cls: cls(el).slice(0, 80), aria: (el.getAttribute("aria-label") || "").slice(0, 50),
             viewBox: svg ? svg.getAttribute("viewBox") : null,
             fill: svg ? svg.getAttribute("fill") : null,
             paths: ps.map((p) => ({ d: p.getAttribute("d"), cls: cls(p).slice(0, 40),
                                     fill: p.getAttribute("fill") })) };
  };
  const out = { quick: [], fs: !!document.fullscreenElement };
  const qa = document.querySelector(".ytp-fullscreen-quick-actions");
  if (qa) for (const b of qa.querySelectorAll("button, [role='button']")) out.quick.push(pull(b));
  out.expand = pull(document.querySelector(".ytp-fullscreen-grid-expand-button"));
  // ── التشغيلُ التلقائيّ: بأيّ شيءٍ يُرسم؟ ────────────────────────────────
  // ⛔⭐⭐ أوّلُ قياسٍ أصاب عنصراً واحداً فأنتج رسماً كاذباً (#130): قُرئ المقبضُ
  // وحدَه (30×18 أبيضُ نصفُ قطره 9) فرُسم شكلاً أبيضَ صلباً — والحقيقيُّ مسارٌ
  // داكن وفيه مقبضٌ أبيضُ دائريّ. ⇒ فالبنيةُ تُقرأ كاملةً لا عنصراً منها.
  // ⚠️ ولا علاماتِ قوالبَ في هذي التعليقات: هي داخل قالبٍ نصّيّ، وقد كسرته مرّةً.
  const full = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    const ps = ["::before", "::after"].map((p) => {
      const c2 = getComputedStyle(el, p);
      // ⛔⭐⭐ وثالثةً في العنصر نفسِه (#132): قِيس المقبضُ ولم يُقَس ما فيه —
      // فالرسمُ قد يكون صورةَ خلفيةٍ أو قناعاً أو محتوى، ولا يُخمَّن أيُّها.
      return { p, content: c2.content, bg: c2.backgroundColor, radius: c2.borderRadius,
               w: c2.width, h: c2.height, top: c2.top, left: c2.left, right: c2.right,
               bottom: c2.bottom, margin: c2.margin, box: c2.boxSizing,
               pos: c2.position, transform: c2.transform.slice(0, 46),
               bgImg: c2.backgroundImage, bgSize: c2.backgroundSize,
               mask: (c2.maskImage || "") + "|" + (c2.webkitMaskImage || ""),
               clip: c2.clipPath, filter: c2.filter,
               border: c2.borderWidth + " " + c2.borderColor, op: c2.opacity };
    }).filter((p) => p.content !== "none");
    return { cls: cls(el).slice(0, 70), w: Math.round(r.width), h: Math.round(r.height),
             x: Math.round(r.left), y: Math.round(r.top),
             bg: cs.backgroundColor, radius: cs.borderRadius, op: cs.opacity,
             border: cs.borderWidth + " " + cs.borderStyle + " " + cs.borderColor,
             shadow: cs.boxShadow.slice(0, 80), bgImg: cs.backgroundImage.slice(0, 60),
             transform: cs.transform.slice(0, 46), position: cs.position,
             display: cs.display, margin: cs.margin, padding: cs.padding,
             bgImg: cs.backgroundImage, mask: (cs.maskImage || "") + "|" + (cs.webkitMaskImage || ""),
             clip: cs.clipPath, html: el.innerHTML.slice(0, 200),
             أبناء: [...el.children].map((k) => k.tagName + "." + cls(k).slice(0, 40)), ps };
  };
  const snapAutonav = () => {
    const an = document.querySelector(".ytp-autonav-toggle");
    if (!an) return null;
    return { checked: an.getAttribute("aria-checked"),
             ariaBtn: (an.getAttribute("aria-label") || "").slice(0, 60),
             html: an.innerHTML.slice(0, 300),
             زرّ: full(an),
             حاوية: full(an.querySelector(".ytp-autonav-toggle-button-container")),
             مقبض: full(an.querySelector(".ytp-autonav-toggle-button")),
             checkedInner: an.querySelector(".ytp-autonav-toggle-button")?.getAttribute("aria-checked") };
  };
  out.autonav = snapAutonav();
  return out;
})()`;
let h = null; const report = {};
try {
  h = await launch(PORT, { withExtension: false, extra: ["--window-size=1600,1000"] });
  const page = await openPage(PORT, WATCH);
  for (let i = 0; i < 60; i++) {
    const ok = await evalIn(page, `(() => { const v = document.querySelector("video");
      return !!(v && v.readyState >= 2 && v.getBoundingClientRect().width > 0); })()`);
    if (ok) break; await sleep(500);
  }
  let c = await centerOf(page, "#movie_player");
  if (c) { await mouseMove(page, c.x, c.y); await mouseMove(page, c.x + 3, c.y + 2); }
  await sleep(900);
  const fsb = await centerOf(page, ".ytp-fullscreen-button");
  if (fsb) { await click(page, fsb.x, fsb.y); await sleep(2500); }
  c = await centerOf(page, "#movie_player");                  // ⬅ بعد ملء الشاشة لا قبله
  for (let i = 0; i < 6; i++) { if (c) await mouseMove(page, c.x + (i % 2 ? 5 : -5), c.y + 3); await sleep(200); }
  await sleep(600);
  report.pull = await evalIn(page, PULL);
  // ⛔⭐ **والحالُ الثانية تُنتَج ولا تُخمَّن** (قرار 125): موضعُ المقبض يختلف
  // بين «مشغَّل» و«مطفأ» — **ورسمُه في غير موضعه يقول للمالك حالاً ليست حاله**،
  // وهي «معاينةٌ تكذب» بدرجةٍ أصغر لا بنوعٍ آخر (نصّ المالك).
  const anBox = await centerOf(page, ".ytp-autonav-toggle");
  if (anBox) {
    await click(page, anBox.x, anBox.y);
    await sleep(900);
    const c2 = await centerOf(page, "#movie_player");
    if (c2) { await mouseMove(page, c2.x + 4, c2.y + 3); await mouseMove(page, c2.x - 4, c2.y - 3); }
    await sleep(500);
    report.autonavFlipped = await evalIn(page, `(() => {
      const an = document.querySelector(".ytp-autonav-toggle");
      if (!an) return null;
      const k = an.querySelector(".ytp-autonav-toggle-button");
      const cs = k && getComputedStyle(k); const r = k && k.getBoundingClientRect();
      const cnt = an.querySelector(".ytp-autonav-toggle-button-container");
      const cb = cnt && getComputedStyle(cnt, "::before");
      const af = k && getComputedStyle(k, "::after");
      return { checked: an.getAttribute("aria-checked"),
               knobChecked: k && k.getAttribute("aria-checked"),
               transform: cs ? cs.transform : null, bg: cs ? cs.backgroundColor : null,
               radius: cs ? cs.borderRadius : null,
               w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0,
               // ⭐ المقبضُ هو ::after على المسار — ولونُه وموضعُه يتبدّلان بالحال
               after: af ? { content: af.content, bg: af.backgroundColor, w: af.width,
                             h: af.height, radius: af.borderRadius, top: af.top,
                             left: af.left, bottom: af.bottom, right: af.right,
                             margin: af.margin, box: af.boxSizing, pos: af.position,
                             transform: af.transform } : null,
               trackBefore: cb ? { content: cb.content, bg: cb.backgroundColor,
                                   w: cb.width, h: cb.height, radius: cb.borderRadius } : null }; })()`);
  }
  try { page.ws.close(); } catch {}
} catch (e) { report.fatal = String(e?.message || e); }
finally { try { killChrome(h); } catch {} }
console.log(JSON.stringify(report));
