// قياس أثر الخروج المبكر في الإطارات بلا فيديو — البند #13ب.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// صفحتُه محليّةٌ بالكامل وحتى الفيديو لوحةُ رسمٍ محليّة، لكن عددَه المطبوع
//   محكومٌ بنافذة 6000ms واحدة يبلّغ فيها واحدٌ وستّون إطاراً — فالرقم يتبع
//   سرعةَ الجهاز، وحارسُ الانحدار البنيويّ لهذا البند هو
//   `tools/test-frame-wake.js` في المجموعة أصلاً.
//
// ⚠️ يحتاج كروم مثبَّتاً، مثل بقية أدوات bench في هذا المجلد.
//
//   node tools/bench-frames.mjs           # 60 إطاراً بلا فيديو (قريب من صفحة إخبارية حقيقية)
//   node tools/bench-frames.mjs 121       # عدد آخر
//
// العدد الافتراضي ليس اعتباطياً: قِيس على صفحات حقيقية بـ CDP، وكانت
// aljazeera.net ‏121 سياقاً بلا فيديو من 122، و cnn.com ‏62 من 63.
//
// يبني صفحة فيها N إطاراً بلا فيديو وإطاراً واحداً فيه فيديو، ويحمّل content.js
// الحقيقي في كلٍّ منها مع بديل لـ chrome.storage يعدّ القراءات، ثم يقيس:
// كم إطاراً خرج مبكراً، وكم قراءة تخزين وُفِّرت فعلاً، وكم بقيت.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRAMES = Number(process.argv[2] || 60);
const LATENCY_MS = 3;
const PORT = 8805, CDP = 9386;

const STUB = `
window.__reads = 0;
window.chrome = {
  runtime: { id: "bench", onMessage: { addListener() {} }, sendMessage: () => Promise.resolve(), lastError: null },
  storage: {
    sync: {
      get(d) {
        window.__reads++;
        const keys = Array.isArray(d) ? d : Object.keys(d || {});
        return new Promise((res) => setTimeout(() => {
          const o = {}; for (const k of keys) o[k] = Array.isArray(d) ? undefined : d[k];
          res(o);
        }, ${LATENCY_MS}));
      },
      set: () => Promise.resolve()
    },
    onChanged: { addListener() {} }
  }
};`;

// إطار إعلاني نموذجي: لا فيديو فيه إطلاقاً
const AD_FRAME = `<!doctype html><meta charset="utf-8"><body><script>${STUB}</script>
<script src="/content.js"></script>
<script>parent.postMessage({ f: "ad", reads: window.__reads }, "*");</script></body>`;

// إطار يبدأ بلا فيديو ثم يُحقن فيه واحد بعد ثانية — تحميل كسول
const LAZY_FRAME = `<!doctype html><meta charset="utf-8"><body><script>${STUB}</script>
<script src="/content.js"></script>
<script>
parent.postMessage({ f: "lazy-before", reads: window.__reads }, "*");
setTimeout(() => {
  const v = document.createElement("video");
  v.muted = true; v.setAttribute("playsinline", "");
  v.style.cssText = "width:320px;height:180px";
  // مصدر محلي بلا شبكة: لوحة رسم تُبَث كـ MediaStream، فتُطلق loadedmetadata فعلاً
  const c = Object.assign(document.createElement("canvas"), { width: 320, height: 180 });
  const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#345"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10);
  document.body.appendChild(v);
  setTimeout(() => parent.postMessage({ f: "lazy-after", reads: window.__reads }, "*"), 1200);
}, 800);
</script></body>`;

const TOP = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<iframe src="/lazy.html" style="width:340px;height:200px;border:0"></iframe>
${Array.from({ length: FRAMES }, (_, i) => `<iframe src="/ad.html?i=${i}" style="width:0;height:0;border:0"></iframe>`).join("")}
<script>
window.__msgs = [];
addEventListener("message", (e) => { if (e.data && e.data.f) window.__msgs.push(e.data); });
</script></body>`;

const srv = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  const send = (b, t) => { res.writeHead(200, { "content-type": t }); res.end(b); };
  if (u === "/") return send(TOP, "text/html; charset=utf-8");
  if (u === "/ad.html") return send(AD_FRAME, "text/html; charset=utf-8");
  if (u === "/lazy.html") return send(LAZY_FRAME, "text/html; charset=utf-8");
  if (u === "/content.js") return send(fs.readFileSync(path.join(ROOT, "content.js")), "text/javascript");
  res.writeHead(404); res.end("x");
});
await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--autoplay-policy=no-user-gesture-required",
   "--user-data-dir=/tmp/vz-bench-frames", `--remote-debugging-port=${CDP}`, "--window-size=1400,900", "about:blank"],
  { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }
const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Runtime.enable");
await sleep(6000);

const msgs = (await send("Runtime.evaluate", { expression: "window.__msgs", returnByValue: true })).result?.result?.value || [];
const ads = msgs.filter((m) => m.f === "ad");
const before = msgs.find((m) => m.f === "lazy-before");
const after = msgs.find((m) => m.f === "lazy-after");
const adReads = ads.reduce((a, m) => a + m.reads, 0);

console.log(`\n=== الخروج المبكر — ${FRAMES} إطاراً بلا فيديو + إطار يحصل على فيديو لاحقاً ===`);
console.log(`إطارات إعلانية أبلغت      : ${ads.length}`);
console.log(`قراءات التخزين فيها مجتمعةً: ${adReads}   (قبل #13ب: ${ads.length} — قراءة لكل إطار)`);
console.log(`الموفَّر                   : ${ads.length - adReads} قراءة من ${ads.length}`);
console.log(`\nالإطار الكسول:`);
console.log(`  قبل ظهور الفيديو : ${before ? before.reads : "?"} قراءة  ← نائم`);
console.log(`  بعد ظهور الفيديو : ${after ? after.reads : "?"} قراءة  ← استيقظ`);
console.log("");
chrome.kill(); srv.close(); process.exit(0);
