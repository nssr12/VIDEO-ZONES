// قياس تكرار applyQ ومدة الاستطلاع — البند #19.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// محليٌّ بلا شبكة — مشغّلُه مصنوعٌ في صفحته — لكنه يطبع أرقاماً لا حكماً: عدّةُ
//   نبضاته تقع على حدّ 400ms مقابل 900ms، ويخرج بصفرٍ دائماً فلا حُمرةَ تُبنى
//   عليها بوّابة.
//
// ⚠️ يحتاج كروم مثبَّتاً، مثل بقية أدوات bench هنا.
//
//   node tools/bench-yt-quality.mjs                       # الملف الحالي
//   node tools/bench-yt-quality.mjs <path/to/yt_quality_main.js>
//
// يُعيد تمثيل تسلسل يوتيوب الحقيقي على فيديو يسبقه إعلان، بعلاماته الفعلية:
// ‏`#movie_player` يحمل `ad-showing` أثناء الإعلان، و`getAvailableQualityLevels`
// تُرجع قائمة فارغة حتى يجهز المشغّل، و`loadedmetadata` يقع مرة للإعلان ومرة
// للمحتوى، ثم `yt-navigate-start/finish` عند الانتقال لفيديو آخر.
//
// المقيس: كم مرة دخلت applyQ، وكم استطلاعاً عاش في آن واحد، وكم استغرق الاستطلاع،
// وهل ضُبطت جودة على الإعلان.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "yt_quality_main.js");
const PORT = 8809, CDP = 9392;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<div id="movie_player" class="html5-video-player ad-showing"></div>
<script>
window.__log = { applyQ: 0, setOnAd: 0, setOnContent: 0, alive: 0, maxAlive: 0, polls: [], results: [] };
const player = document.getElementById("movie_player");
let ready = false;                    // المشغّل يُرجع قائمة فارغة حتى يجهز
player.getAvailableQualityLevels = function () {
  window.__log.applyQ++;              // كل نبضة استطلاع تمرّ من هنا
  return ready ? ["hd1080", "hd720", "large", "medium", "auto"] : [];
};
player.setPlaybackQualityRange = function (q) {
  if (player.classList.contains("ad-showing")) window.__log.setOnAd++;
  else window.__log.setOnContent++;
};
player.setPlaybackQuality = function () {};
window.addEventListener("__vz_setq_done__", (e) => window.__log.results.push(e.detail.result));
</script>
<script src="/yt_quality_main.js"></script>
<script>
const fire = (q) => window.dispatchEvent(new CustomEvent("__vz_setq__", { detail: { q } }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

window.__run = async () => {
  const t0 = performance.now();
  // 1) الإعلان يبدأ. مهم: أثناء إعلان حقيقي يكون المشغّل **جاهزاً** ويُرجع مستويات
  //    جودة الإعلان — وهنا بالضبط كان الكود القديم يضبط الجودة على الإعلان.
  ready = true;
  fire("hd1080");
  await sleep(600);
  // 2) الإعلان ما زال يعمل، ونبضة أخرى تصل (المشغّل يُطلق أحداثاً متعدّدة)
  fire("hd1080");
  await sleep(600);
  // 3) انتهى الإعلان وبدأ المحتوى، والمشغّل يعود غير جاهز لحظة التبديل
  player.classList.remove("ad-showing");
  ready = false;
  fire("hd1080");
  await sleep(900);
  // 4) المحتوى جهز أخيراً
  ready = true;
  await sleep(1200);
  const settled = performance.now() - t0;

  // 5) المستخدم انتقل لفيديو آخر بينما قد يكون استطلاع حيّاً
  ready = false;
  document.dispatchEvent(new CustomEvent("yt-navigate-start", { bubbles: true }));
  fire("hd1080");
  await sleep(600);
  ready = true;
  await sleep(1200);

  return { ...window.__log, settledMs: Math.round(settled) };
};
</script></body>`;

const srv = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  if (u === "/yt_quality_main.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(MAIN)); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE);
});
await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=/tmp/vz-bench-ytq-${Date.now()}`,
   `--remote-debugging-port=${CDP}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }
const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Runtime.enable"); await sleep(1200);
const r = await send("Runtime.evaluate", { expression: "window.__run()", awaitPromise: true, returnByValue: true });
const v = r.result?.result?.value || {};

console.log(`\n=== جودة يوتيوب على فيديو يسبقه إعلان — ${path.basename(MAIN)} ===`);
console.log(`نبضات استطلاع (getAvailableQualityLevels) : ${v.applyQ}`);
console.log(`ضبط جودة على الإعلان                      : ${v.setOnAd}   ${v.setOnAd ? "❌" : "✅"}`);
console.log(`ضبط جودة على المحتوى                      : ${v.setOnContent}`);
console.log(`زمن دورة السيناريو                         : ${v.settledMs} ms`);
console.log(`نتائج مُبلَّغة من العالم الرئيسي           : ${JSON.stringify(v.results)}`);
console.log("");
chrome.kill(); srv.close(); process.exit(0);
