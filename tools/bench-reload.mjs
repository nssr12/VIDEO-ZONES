// قياس ازدواج تطبيق الإعدادات لكل حفظ — البند #14.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// محليٌّ بالكامل وبلا شبكة، لكنه عدّادُ تكلفة يطبع أرقاماً ويخرج بصفرٍ دائماً
//   (`process.exit(0)`) — فلا حكمَ فيه يُحمِّر كومِتاً، ويُشغِّل كروم خمس مرّات
//   لكل تشغيلة.
//
// ⚠️ يحتاج كروم مثبَّتاً، مثل بقية أدوات bench هنا.
//
//   node tools/bench-reload.mjs                  # الكود الحالي
//   node tools/bench-reload.mjs <path/to/content.js>   # نسخة أخرى للمقارنة
//
// كل حفظ يصل الإطارَ من قناتين: رسالة RELOAD_* صريحة، و storage.onChanged.
// هنا تُطلَق القناتان على إطار فيه فيديو، ويُعدّ ما تكلّفه كل حالة من قراءات
// التخزين — وهو المقياس المباشر لتكرار العمل، إذ كان كل مُحمِّل يقرأ لنفسه.
//
// الترتيبات الثلاثة تُقاس كلها: القناتان معاً، والرسالة وحدها، و onChanged وحده.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "content.js");
const PORT = 8807, CDP = 9388;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<video id="v" muted playsinline style="width:320px;height:180px;background:#333"></video>
<script>
window.__reads = 0; window.__changed = []; window.__msgs = [];
window.chrome = {
  runtime: {
    id: "bench",
    onMessage: { addListener: (fn) => window.__msgs.push(fn) },
    sendMessage: () => Promise.resolve(), lastError: null
  },
  storage: {
    sync: {
      get(d) {
        window.__reads++;
        const keys = Array.isArray(d) ? d : Object.keys(d || {});
        return Promise.resolve(Object.fromEntries(keys.map((k) => [k, Array.isArray(d) ? undefined : d[k]])));
      },
      set: () => Promise.resolve()
    },
    onChanged: { addListener: (fn) => window.__changed.push(fn) }
  }
};
</script>
<script src="/content.js"></script>
<script>
// أيقظ الإطار كما يوقظه فيديو حقيقي، فالقياس على إطار عامل لا نائم
const c = Object.assign(document.createElement("canvas"), { width: 320, height: 180 });
const g = c.getContext("2d");
setInterval(() => { g.fillStyle = "#345"; g.fillRect(0, 0, 320, 180); }, 100);
document.getElementById("v").srcObject = c.captureStream(10);

window.__fire = async (mode) => {
  await new Promise((r) => setTimeout(r, 400));   // دع البدء يستقر
  const base = window.__reads;
  const change = { settings: { newValue: { subtitles: { enabled: true } } } };
  const fireChanged = () => { for (const fn of window.__changed) fn(change, "sync"); };
  const fireMsg = () => { for (const fn of window.__msgs) fn({ type: "RELOAD_ZONE_SETTINGS" }, {}, () => {}); };
  if (mode === "both") { fireChanged(); fireMsg(); }                       // نفس الدورة
  else if (mode === "changed") fireChanged();
  else if (mode === "message") fireMsg();
  else if (mode === "changed-then-msg") { fireChanged(); await new Promise((r) => setTimeout(r, 8)); fireMsg(); }
  else if (mode === "msg-then-changed") { fireMsg(); await new Promise((r) => setTimeout(r, 8)); fireChanged(); }
  await new Promise((r) => setTimeout(r, 700));
  return window.__reads - base;
};
window.__ready = () => !!document.getElementById("v").srcObject;
</script></body>`;

const srv = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  if (u === "/content.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CONTENT)); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE);
});
await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--autoplay-policy=no-user-gesture-required",
   "--user-data-dir=/tmp/vz-bench-reload", `--remote-debugging-port=${CDP}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }

let n = 0; const pend = new Map();
async function open() {
  const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`, { method: "PUT" })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  await send("Runtime.enable");
  await sleep(1500);
  return { send, id: tab.id };
}

console.log(`\n=== قراءات التخزين لكل حفظ، في إطار واحد — ${path.basename(path.dirname(CONTENT))}/${path.basename(CONTENT)} ===`);
const rows = [];
for (const mode of ["both", "changed-then-msg", "msg-then-changed", "message", "changed"]) {
  const t = await open();
  const r = await t.send("Runtime.evaluate", { expression: `window.__fire(${JSON.stringify(mode)})`, awaitPromise: true, returnByValue: true });
  const reads = r.result?.result?.value;
  rows.push([mode, reads]);
  await fetch(`http://127.0.0.1:${CDP}/json/close/${t.id}`);
}
const label = { both: "القناتان في نفس الدورة", "changed-then-msg": "onChanged ثم الرسالة",
  "msg-then-changed": "الرسالة ثم onChanged", message: "الرسالة وحدها", changed: "onChanged وحده" };
for (const [mode, reads] of rows) console.log(`  ${label[mode].padEnd(24)} : ${reads} قراءة`);
const worst = Math.max(...rows.map((r) => r[1]));
console.log(`\nالأسوأ عبر الترتيبات الخمسة: ${worst} قراءة لكل حفظ لكل إطار عامل.`);
console.log(`وبعد #13ب لا يعمل إلا الإطار الذي فيه فيديو — واحد من 122 على الجزيرة —`);
console.log(`فالتكلفة على تلك الصفحة: ${worst} قراءة لكل حفظ لكل تبويب بدل ${worst} × 122.`);
console.log("");
chrome.kill(); srv.close(); process.exit(0);
