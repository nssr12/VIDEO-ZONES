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
  const an = document.querySelector(".ytp-autonav-toggle");
  if (an) {
    const kids = [...an.querySelectorAll("*")].slice(0, 10).map((e) => {
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      return { tag: e.tagName, cls: cls(e).slice(0, 50), w: Math.round(r.width), h: Math.round(r.height),
               bg: cs.backgroundColor, radius: cs.borderRadius, border: cs.borderWidth + " " + cs.borderColor,
               bgImg: cs.backgroundImage.slice(0, 60), transform: cs.transform.slice(0, 40) };
    });
    const pseudo = ["::before", "::after"].map((p) => {
      const cs = getComputedStyle(an, p);
      return { p, content: cs.content, bg: cs.backgroundColor, bgImg: cs.backgroundImage.slice(0, 40),
               w: cs.width, h: cs.height };
    });
    out.autonav = { cls: cls(an).slice(0, 80), aria: (an.getAttribute("aria-label") || "").slice(0, 50),
                    html: an.innerHTML.slice(0, 400), kids, pseudo,
                    checked: an.getAttribute("aria-checked"), title: an.getAttribute("title") };
  }
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
  try { page.ws.close(); } catch {}
} catch (e) { report.fatal = String(e?.message || e); }
finally { try { killChrome(h); } catch {} }
console.log(JSON.stringify(report));
