// إعادة إنتاج البند #59 — تكبير `<body>` بدل الفيديو، وعدم حتمية الاختيار.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// محليٌّ بلا شبكةٍ وفيديوه لوحةُ رسمٍ مُبَثّة — فالسببُ الجامع لا ينطبق عليه
//   أصلاً — لكنه جدولُ تشخيصٍ يفكّك السكور على خمسةَ عشرَ مقاسَ نافذةٍ ويخرج
//   بصفرٍ دائماً، وقراءتُه للمستطيل بعد 500ms تقع في المدى الذي سُحبت فيه
//   «حقيقةٌ منشورة» (450ms ⇒ 1100ms).
//
// ⚠️ أداة تشخيص. **لا تلمس أي ملف يُشحن** — تحمّل content.js الحقيقي كما هو وتقيس.
// ⚠️ تحتاج كروم مثبَّتاً. **بلا شبكة**: الصفحة محلية والفيديو لوحة رسم مُبَثّة.
//
//   node tools/repro-59-body.mjs
//
// تبني البنية أ (فيديو ابن مباشر لـ`body` بحجم سطريّ) على **عدة مقاسات إطار عرض**،
// وتفكّك سكور `pickFullscreenContainer` سطراً سطراً لكل مرشّح، وتُظهر أين تنقلب
// القرعة ولماذا. ثم تقيس أثر متغيّرين: وجود زر في الصفحة، وطول الصفحة.
//
// ⚠️ اقرأ tools/KNOWN-DEFECTS.md قبل تفسير أي ❌.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8812, CDP = 9401;

const STUB = `
window.chrome = {
  runtime: { id: "repro59", onMessage: { addListener() {} }, sendMessage: () => Promise.resolve(), lastError: null },
  storage: {
    sync: { get: (d) => Promise.resolve(Object.assign({}, d)), set: () => Promise.resolve() },
    onChanged: { addListener() {} }
  }
};`;

const HARNESS = String.raw`
function mkVideo() {
  const v = document.createElement("video");
  v.autoplay = true; v.muted = true; v.playsInline = true;
  v.style.cssText = "width:640px;height:360px;background:#333";
  const c = Object.assign(document.createElement("canvas"), { width: 640, height: 360 });
  const g = c.getContext("2d");
  let i = 0;
  setInterval(() => {
    g.fillStyle = "hsl(" + (i * 7 % 360) + ",60%,30%)"; g.fillRect(0, 0, 640, 360);
    g.fillStyle = "#fff"; g.font = "700 64px sans-serif"; g.fillText(String(i++), 40, 210);
  }, 100);
  v.srcObject = c.captureStream(10);
  return v;
}

// المتغيّران: زر في الصفحة، وطول الصفحة (يُغيّر مستطيل body المرسوم)
window.__setup = (opts) => {
  document.body.textContent = "";
  document.body.removeAttribute("style");
  document.body.style.margin = "0";
  if (opts.tall) document.body.style.minHeight = "3000px";
  window.__v = mkVideo();
  document.body.appendChild(window.__v);
  if (opts.button) document.body.appendChild(document.createElement("button"));
  return true;
};

const desc = (el) => {
  if (!el) return "null";
  if (el === document.body) return "BODY";
  if (el === document.documentElement) return "HTML";
  const c = (el.className || "").toString().trim().split(/\s+/).filter(Boolean);
  return el.tagName + (el.id ? "#" + el.id : "") + (c.length ? "." + c.slice(0, 4).join(".") : "");
};

// تفكيك السكور بنفس معادلة content.js حرفياً — للعرض لا للتنفيذ
window.__breakdown = () => {
  const video = window.__v;
  const videoRect = video.getBoundingClientRect();
  const videoArea = Math.max(1, videoRect.width * videoRect.height);
  const candidates = []; let cur = video;
  for (let i = 0; i < 8 && cur; i++) { candidates.push(cur); cur = cur.parentElement; }
  const rows = candidates.map((el, depth) => {
    const cls = (el.className || "").toString();
    const role = (el.getAttribute && el.getAttribute("role")) || "";
    const hasButtons = !!(el.querySelector && el.querySelector("button, [role='button'], input[type='range']"));
    const looksPlayer = /player|video|controls|overlay|container/i.test(cls + " " + role);
    const rect = el.getBoundingClientRect();
    const rejected = [];
    if (rect.width <= 0 || rect.height <= 0) rejected.push("مستطيل صفري");
    const areaRatio = (rect.width * rect.height) / videoArea;
    const cx = videoRect.left + videoRect.width / 2, cy = videoRect.top + videoRect.height / 2;
    if (!(rect.left <= cx && rect.right >= cx && rect.top <= cy && rect.bottom >= cy)) rejected.push("لا يحوي مركز الفيديو");
    if (areaRatio > 3.5) rejected.push("النسبة > 3.5");
    const score = (hasButtons ? 3 : 0) + (looksPlayer ? 2 : 0) + (el === video ? 0 : 1) +
      Math.max(0, 2 - Math.abs(areaRatio - 1.15));
    return { depth, el: desc(el), rect: [Math.round(rect.width), Math.round(rect.height)],
      ratio: +areaRatio.toFixed(4), hasButtons, looksPlayer,
      score: +score.toFixed(4), rejected: rejected.join(" · ") || null };
  });
  const alive = rows.filter((r) => !r.rejected).sort((a, b) => b.score - a.score);
  return {
    screen: [window.innerWidth, window.innerHeight],
    videoRect: [Math.round(videoRect.width), Math.round(videoRect.height)],
    rows,
    winner: alive[0] || null,
    margin: alive.length > 1 ? +(alive[0].score - alive[1].score).toFixed(4) : null,
    runnerUp: alive.length > 1 ? alive[1].el : null,
    // ما تُرجعه الإضافة فعلاً — بعد كومِت أ يمرّ بالحكم القاطع أولاً
    actual: desc(window.pickFullscreenContainer(window.__v)),
    decisive: desc(window.nearestPlayerAncestor(window.__v))
  };
};
`;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<script>${STUB}</script>
<script src="/content.js"></script>
<script>${HARNESS}</script></body>`;

const srv = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  if (u === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(PAGE); }
  if (u === "/content.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(path.join(ROOT, "content.js"))); }
  res.writeHead(404); res.end("x");
});
await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--autoplay-policy=no-user-gesture-required",
   "--user-data-dir=/tmp/vz-repro-59", `--remote-debugging-port=${CDP}`, "--window-size=1440,900", "about:blank"],
  { stdio: "ignore" });
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }
const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await cdp("Runtime.enable");
const ev = async (x) => {
  const r = await cdp("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { __err: (r.result.exceptionDetails.exception?.description || "").slice(0, 300) };
  return r.result?.result?.value;
};
const winId = (await cdp("Browser.getWindowForTarget", { targetId: tab.id })).result?.windowId;
const resize = async (w, h) => {
  if (winId) await cdp("Browser.setWindowBounds", { windowId: winId, bounds: { width: w, height: h } });
  await sleep(800);
};
await sleep(2500);

const pad = (s, w) => String(s) + " ".repeat(Math.max(0, w - String(s).length));

console.log("\n=== إعادة إنتاج #59 — البنية أ: <video> ابن مباشر لـ body ===");
console.log("⚠️ اقرأ tools/KNOWN-DEFECTS.md قبل تفسير أي ❌.");
console.log("ℹ️ «فائز السكور» أدناه هو السكور **الخام قبل استثناء body/documentElement**،");
console.log("   و«ما تُرجعه الإضافة» هو الناتج الفعلي — والتباين بينهما هو إصلاح #59 نفسه.\n");

const VARIANTS = [
  { label: "بلا زر · صفحة قصيرة", opts: { button: false, tall: false } },
  { label: "بزر واحد · صفحة قصيرة", opts: { button: true, tall: false } },
  { label: "بلا زر · صفحة طويلة", opts: { button: false, tall: true } }
];
const SIZES = [[1440, 900], [1200, 800], [1024, 768], [900, 700], [800, 640]];

for (const variant of VARIANTS) {
  console.log(`\n────── ${variant.label} ──────`);
  const picks = [];
  for (const [w, h] of SIZES) {
    await resize(w, h);
    await ev(`window.__setup(${JSON.stringify(variant.opts)})`);
    await sleep(500);
    const b = await ev("window.__breakdown()");
    if (b?.__err) { console.log("  خطأ:", b.__err); continue; }
    picks.push({ size: `${w}×${h}`, actual: b.actual, winner: b.winner?.el, margin: b.margin });
    console.log(`\n  نافذة ${w}×${h} · إطار العرض ${b.screen.join("×")} · الفيديو ${b.videoRect.join("×")}`);
    console.log(`  ${pad("عمق", 5)}${pad("العنصر", 10)}${pad("المستطيل", 14)}${pad("النسبة", 9)}${pad("أزرار", 7)}${pad("يشبه", 6)}${pad("السكور", 9)}مرفوض؟`);
    for (const r of b.rows) {
      console.log(`  ${pad(r.depth, 5)}${pad(r.el, 10)}${pad(r.rect.join("×"), 14)}${pad(r.ratio, 9)}${pad(r.hasButtons ? "نعم" : "لا", 7)}${pad(r.looksPlayer ? "نعم" : "لا", 6)}${pad(r.score, 9)}${r.rejected || "—"}`);
    }
    console.log(`  ⇒ فائز السكور: ${b.winner?.el}` +
      (b.margin != null ? ` بفارق ${b.margin} عن ${b.runnerUp}` : " (وحيد)") +
      ` · الحكم القاطع (#58): ${b.decisive} · **ما تُرجعه الإضافة: ${b.actual}**`);
  }
  const uniq = [...new Set(picks.map((p) => p.actual))];
  console.log(`\n  الحتمية: ${uniq.length === 1 ? "✅ ثابت على " + uniq[0] : "❌ غير حتميّ — " + picks.map((p) => p.size + ":" + p.actual).join(" · ")}`);
}

// نقطة الانقلاب النظرية: body تفوز على الفيديو ما دامت 0 < r < 2.30
console.log("\n=== حساب نقطة الانقلاب ===");
console.log("  سكور الفيديو الثابت = 0 + 0 + 0 + max(0, 2 − |1 − 1.15|) = 1.85");
console.log("  سكور body بلا أزرار = 0 + 0 + 1 + max(0, 2 − |r − 1.15|)");
console.log("  ⇒ body تفوز حين  1 + (2 − |r − 1.15|) > 1.85  أي  |r − 1.15| < 1.15  أي  0 < r < 2.30");
console.log("  ⇒ وبزرّ واحد تُضاف 3 نقاط لـ body فتفوز في كل نسبة تحت 3.5 تقريباً");

chrome.kill(); srv.close(); process.exit(0);
