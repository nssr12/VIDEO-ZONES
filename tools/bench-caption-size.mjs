// قياس حجم خط الترجمة الفعلي عبر مقاسات المشغّل — البند #49.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// محليٌّ حتميّ وهو الوحيد كذلك في هذي الثمانية، لكنه يطبع جدولَ أحجامٍ بلا حكمٍ
//   يُحمِّر — وحارسُ انحدار الصيغة نفسِها هو `tools/test-caption-size.js` داخل
//   المجموعة، فبوّابةٌ تُطلقه تدفع تشغيلَ كرومَ مقابل جدولٍ لا يفشل.
//
// ⚠️ يحتاج كروم مثبَّتاً، مثل tools/bench-startup.mjs.
//
//   node tools/bench-caption-size.mjs        # الحجم الافتراضي 22
//   node tools/bench-caption-size.mjs 30     # حجم آخر
//
// يبني نسخة من بنية مشغّل يوتيوب بعرض معلوم، ويحقن نفس الـ CSS الذي يولّده
// applySubtitleStyles، ثم يقرأ font-size المحسوب فعلاً. الغرض إثبات رقمين:
// أن معاينة الصفحة الرئيسية لم تعد تُغرَق بالنص، وأن مشغّل المشاهدة عند العرض
// المرجعي ما زال يعطي الرقم الذي اعتاده المستخدم.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = Number(process.argv[2] || 22);
const WIDTHS = [300, 480, 640, 854, 1280, 1920, 2560];
const PORT = 8792, CDP = 9352;

// نستخرج مولّد الحجم من content.js نفسه حتى لا يقيس الاختبار نسخة من المنطق
const SRC = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
const from = SRC.indexOf("const CAPTION_REFERENCE_PLAYER_W");
const to = SRC.indexOf("function applySubtitleStyles");
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(SRC.slice(from, to), ctx);
const relFont = ctx.relativeCaptionFont(SIZE);

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222">
<style>
  html .html5-video-player { container-type: inline-size !important; }
  html .ytp-caption-segment { font-size:${relFont} !important; font-family:sans-serif !important; }
  .html5-video-player { position:relative; background:#000; margin:6px 0; }
  .ytp-caption-window-container { position:absolute; inset:0; }
</style>
${WIDTHS.map((w) => `<div class="html5-video-player" style="width:${w}px;height:${Math.round(w * 9 / 16)}px">
  <div class="ytp-caption-window-container"><span class="ytp-caption-segment" data-w="${w}">نص ترجمة تجريبي</span></div>
</div>`).join("\n")}
<script>
window.__measure = () => [...document.querySelectorAll(".ytp-caption-segment")].map((el) => ({
  playerW: Number(el.dataset.w),
  fontPx: Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10
}));
</script></body>`;

const srv = http.createServer((_, res) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE); });
await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--user-data-dir=/tmp/vz-bench-caption",
   `--remote-debugging-port=${CDP}`, "--window-size=1400,900", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }
const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Runtime.enable"); await sleep(1200);
const rows = (await send("Runtime.evaluate", { expression: "window.__measure()", returnByValue: true })).result?.result?.value || [];

console.log(`\n=== حجم خط الترجمة · إعداد المستخدم = ${SIZE} ===`);
console.log(`الصيغة: ${relFont}\n`);
console.log("  عرض المشغّل   قبل (ثابت)   بعد (نسبي)   نسبة النص للعرض");
for (const r of rows) {
  const pct = (r.fontPx / r.playerW * 100).toFixed(2);
  const tag = r.playerW === 1280 ? "  ← العرض المرجعي" : (r.playerW <= 480 ? "  ← معاينة" : "");
  console.log(`  ${String(r.playerW).padStart(6)}px   ${String(SIZE).padStart(7)}px   ${String(r.fontPx).padStart(8)}px   ${pct.padStart(9)}%${tag}`);
}
console.log("");
chrome.kill(); srv.close(); process.exit(0);
