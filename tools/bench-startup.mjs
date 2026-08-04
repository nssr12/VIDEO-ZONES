// قياس تكلفة بدء تشغيل content.js — البند #13.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// محليٌّ وحتميٌّ في عدده (قراءات التخزين عند البدء)، لكنه مقياسُ تكلفةٍ يطبع
//   رقماً بلا حكمٍ ويخرج بصفرٍ دائماً — ويطبع معه زمناً جدارياً يتباين بالجهاز
//   فلا يصلح عتبةً كما هو.
//
// ⚠️ هذه الأداة تحتاج كروم مثبَّتاً، بخلاف بقية ما في tools/ الذي يعمل بـ node
// وحده. تُشغَّل يدوياً عند قياس أثر تغيير على مسار البدء، ولا تُشحن مع الإضافة.
//
//   node tools/bench-startup.mjs            # إطار واحد
//   node tools/bench-startup.mjs 30         # ومعه 30 إطاراً بلا فيديو
//
// ما تقيسه بالضبط: عدد استدعاءات chrome.storage.sync.get التي يُطلقها الإطار
// الواحد عند البدء، والمفاتيح المطلوبة في كل استدعاء، والزمن من تحميل السكربت
// حتى استقرار آخر قراءة. كل استدعاء يُحاكى بتأخير ثابت يمثّل تكلفة الـ IPC إلى
// عملية المتصفح، لأن chrome.storage غير متاح خارج سياق إضافة.
//
// العدد هو الرقم الحاسم لا الزمن: القراءات تنطلق متوازية فالزمن الجداري ≈ أبطأ
// قراءة، بينما العدد يُضرب في عدد الإطارات — صفحة فيها 30 إطاراً إعلانياً تدفع
// الثمن ثلاثين مرة.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRAMES = Number(process.argv[2] || 0);
const LATENCY_MS = 3;           // تكلفة IPC تقريبية لكل قراءة تخزين
const SETTLE_MS = 2500;
const PORT = 8790, CDP = 9350;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const HARNESS = `<!doctype html><meta charset="utf-8"><title>bench</title><body style="margin:0">
<video id=v muted playsinline style="width:320px;height:180px;background:#333"></video>
<script>
window.__t0 = performance.now();
window.__calls = [];
const LAT = ${LATENCY_MS};
const STORE = { settings: {}, globalSiteRules: { enabled: true, mappings: [] }, siteProfiles: {} };
window.chrome = {
  runtime: { id: "bench", onMessage: { addListener() {} }, sendMessage: () => Promise.resolve(), lastError: null },
  storage: {
    sync: {
      get(defaults) {
        const keys = Array.isArray(defaults) ? defaults
          : (typeof defaults === "string" ? [defaults] : Object.keys(defaults || {}));
        const call = { at: performance.now() - window.__t0, keys, done: 0 };
        window.__calls.push(call);
        return new Promise((res) => setTimeout(() => {
          call.done = performance.now() - window.__t0;
          const out = {};
          for (const k of keys) out[k] = STORE[k] ?? (Array.isArray(defaults) ? undefined : defaults[k]);
          res(out);
        }, LAT));
      },
      set: () => Promise.resolve()
    },
    onChanged: { addListener() {} }
  }
};
</script>
<script src="/content.js"></script>
${Array.from({ length: FRAMES }, (_, i) => `<iframe src="/frame.html?i=${i}" style="width:0;height:0;border:0"></iframe>`).join("")}
</body>`;

const FRAME = `<!doctype html><meta charset="utf-8"><body>
<script>
window.__calls = [];
window.chrome = { runtime: { id: "bench", onMessage: { addListener() {} }, sendMessage: () => Promise.resolve() },
  storage: { sync: { get(d) { window.__calls.push(1); return new Promise((r) => setTimeout(() => r({}), ${LATENCY_MS})); },
  set: () => Promise.resolve() }, onChanged: { addListener() {} } } };
window.parent.postMessage({ __bench: "frame-ready" }, "*");
</script>
<script src="/content.js"></script>
<script>setTimeout(() => window.parent.postMessage({ __bench: "frame", n: window.__calls.length }, "*"), ${SETTLE_MS - 400});</script>
</body>`;

const srv = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const send = (body, type) => { res.writeHead(200, { "content-type": type }); res.end(body); };
  if (url === "/") return send(HARNESS, "text/html; charset=utf-8");
  if (url === "/frame.html") return send(FRAME, "text/html; charset=utf-8");
  if (url === "/content.js") return send(fs.readFileSync(path.join(ROOT, "content.js")), "text/javascript");
  res.writeHead(404); res.end("x");
});
await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run",
  `--user-data-dir=/tmp/vz-bench-startup`, `--remote-debugging-port=${CDP}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }

const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true })).result?.result?.value;
await send("Runtime.enable");
await sleep(SETTLE_MS);

const calls = await ev("window.__calls.map(c => ({ at: +c.at.toFixed(1), done: +c.done.toFixed(1), keys: c.keys }))");
const settled = Math.max(...calls.map((c) => c.done));
const keyCount = calls.reduce((a, c) => a + c.keys.length, 0);

console.log(`\n=== قياس بدء التشغيل — إطار واحد (تأخير محاكى ${LATENCY_MS}ms لكل قراءة) ===`);
console.log(`عدد استدعاءات storage.sync.get : ${calls.length}`);
console.log(`مجموع المفاتيح المطلوبة        : ${keyCount}`);
console.log(`آخر قراءة استقرّت عند          : ${settled.toFixed(1)} ms من تحميل السكربت`);
console.log("\nالتفصيل:");
for (const c of calls) console.log(`  ${String(c.at.toFixed(1)).padStart(7)} ms → [${c.keys.join(", ")}]`);

if (FRAMES > 0) {
  const total = await ev(`window.__frameCalls || 0`);
  console.log(`\n=== مع ${FRAMES} إطاراً بلا فيديو ===`);
  console.log(`إجمالي القراءات في الصفحة     : ${calls.length + (total || FRAMES * calls.length)} (تقديري: ${calls.length} × ${FRAMES + 1})`);
}
console.log("");

chrome.kill(); srv.close(); process.exit(0);
