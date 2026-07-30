// قياس مسار المعزّز: هل يبقى `video.muted` بوّابةً بعد `createMediaElementSource`؟
// وكم تبلغ قفزة فكّ الكتم عند كسب 600%؟ وماذا يسمع المستخدم على عنصر جديد
// أعاد `reapplyBoostTo` الكسب عليه؟
//
// ⚠️ يحتاج كروم مثبَّتاً. **لا يُشحن.**  `node tools/bench-boost-mute.mjs`
//
// **ما يُقاس هنا سلوك المتصفح لا كودنا:** الرسم المبني في الصفحة **نسخة من
// `buildBoostGraph`** بترتيبها نفسه (`src → gain → analyser → destination`)،
// والمصدر نغمة محلية ثابتة السعة — فأي تغيّر في القراءة سببه الحالة المقيسة
// وحدها لا المحتوى. القياس **RMS من `analyser`**، أي ما يخرج من رسمنا فعلاً.
//
// ⚠️ ولا يُقاس هنا ما يسمعه المستخدم من مكبّر الصوت، بل ما تنتجه العقدة. لو كان
// المتصفح يكتم الخرج النهائي في مكان آخر فلن يظهر هنا — وهذا حدّ مُصرَّح به.
import { spawn } from "node:child_process";
import http from "node:http";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8817, CDP = 9455;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ⚠️ **المصدر ملف WAV محلي، لا `srcObject`.** أول رِكاز بُني على مذبذب يُبَث
// كـ MediaStream فخرج **صفر تام** بينما المذبذب نفسه يقرأ 0.353: في كروم لا
// يوصّل `createMediaElementSource` صوت عنصر مصدره MediaStream — يُقرأ بـ
// `createMediaStreamSource`. فكان الصفر **عيب رِكاز لا نتيجة**، ولو نُشر لقيل
// «الكتم يُسكت المعزَّز» بلا أي سند. والملف المحلي **نفس أصل الصفحة** فلا تلوّث
// CORS ولا تشوبه البوّابة الأولى في `boostSourceCheck`.
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<video id="v" src="/tone.wav" loop playsinline></video>
<script>
const v = document.getElementById("v");

window.__diag = async () => {
  const t0 = v.currentTime;
  await new Promise((r) => setTimeout(r, 300));
  return { paused: v.paused, readyState: v.readyState, muted: v.muted, volume: v.volume,
           currentSrc: (v.currentSrc || "").slice(-12),
           الوقت_يتقدّم: +(v.currentTime - t0).toFixed(3) };
};

let G = null; // الرسم: نسخة من buildBoostGraph
window.__setup = async () => {
  await v.play();
  const ctx = new AudioContext();
  await ctx.resume();
  if (ctx.state !== "running") return { ok: false, why: "AudioContext لم يعمل: " + ctx.state };
  const src = ctx.createMediaElementSource(v);
  const gain = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(gain); gain.connect(analyser); analyser.connect(ctx.destination);
  gain.gain.value = 1;
  G = { ctx, src, gain, analyser, buf: new Float32Array(analyser.fftSize) };
  return { ok: true, state: ctx.state, paused: v.paused, readyState: v.readyState };
};

// RMS: جذر متوسط المربعات عبر عدة قراءات متباعدة — لا لقطة واحدة
window.__rms = async (reads = 12) => {
  if (!G) return null;
  let peak = 0, acc = 0;
  for (let i = 0; i < reads; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    G.analyser.getFloatTimeDomainData(G.buf);
    let s = 0;
    for (const x of G.buf) { s += x * x; if (Math.abs(x) > peak) peak = Math.abs(x); }
    acc += Math.sqrt(s / G.buf.length);
  }
  return { rms: +(acc / reads).toFixed(6), peak: +peak.toFixed(6) };
};

window.__set = (o) => {
  if (o.gain !== undefined) G.gain.gain.value = o.gain;
  if (o.volume !== undefined) v.volume = o.volume;
  if (o.muted !== undefined) v.muted = o.muted;
  return { gain: G.gain.gain.value, volume: v.volume, muted: v.muted };
};

// عنصر ثانٍ بنفس البثّ: حالة reapplyBoostTo — مستواه الافتراضي 1.0 والكسب يُعاد
window.__second = async (pct) => {
  const v2 = document.createElement("video");
  v2.playsInline = true; v2.loop = true; v2.src = "/tone.wav";
  document.body.appendChild(v2);
  await new Promise((r) => { v2.addEventListener("canplay", r, { once: true }); });
  await v2.play();
  const ctx2 = new AudioContext();
  await ctx2.resume();
  const s2 = ctx2.createMediaElementSource(v2);
  const g2 = ctx2.createGain();
  const a2 = ctx2.createAnalyser();
  a2.fftSize = 2048;
  s2.connect(g2); g2.connect(a2); a2.connect(ctx2.destination);
  g2.gain.value = pct / 100;
  const buf = new Float32Array(a2.fftSize);
  let acc = 0;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    a2.getFloatTimeDomainData(buf);
    let s = 0; for (const x of buf) s += x * x;
    acc += Math.sqrt(s / buf.length);
  }
  return { rms: +(acc / 12).toFixed(6), volume: v2.volume, muted: v2.muted };
};
</script></body>`;

// نغمة 440Hz بسعة ثابتة، مركَّبة هنا: لا ملف في المستودع ولا شبكة.
function tone(seconds = 8, freq = 440, rate = 44100, amp = 0.5) {
  const n = seconds * rate;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const s = Math.sin(2 * Math.PI * freq * i / rate) * amp;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s * 32767))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const WAV = tone();
const srv = http.createServer((q, res) => {
  if (q.url.startsWith("/tone.wav")) {
    res.writeHead(200, { "content-type": "audio/wav", "content-length": WAV.length });
    return res.end(WAV);
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE);
});
await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
  "--autoplay-policy=no-user-gesture-required", `--user-data-dir=/tmp/vz-boost-${Date.now()}`,
  `--remote-debugging-port=${CDP}`, "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }
const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
};
await send("Runtime.enable"); await send("Page.enable"); await send("Page.bringToFront");
await sleep(900);
// نقرة موثوقة تمنح تفعيل المستخدم الذي يشترطه AudioContext
await send("Input.dispatchMouseEvent", { type: "mousePressed", x: 30, y: 30, button: "left", clickCount: 1 });
await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 30, y: 30, button: "left", clickCount: 1 });

const setup = await ev("window.__setup()");
if (!setup?.ok) { console.log("\n⚠️ لم يُقس:", setup?.why || "تعذّر البناء"); chrome.kill(); srv.close(); process.exit(1); }
await sleep(600);

const rms = () => ev("window.__rms()");
const set = (o) => ev(`window.__set(${JSON.stringify(o)})`);

const rows = [];
const step = async (label, state) => {
  if (state) await set(state);
  await sleep(350);
  const r = await rms();
  rows.push({ label, ...state, ...r });
  return r;
};

const base = await step("خطّ الأساس — كسب 1 · مستوى 1 · غير مكتوم", { gain: 1, volume: 1, muted: false });
if (!base || base.rms === 0) {
  const d = await ev("window.__diag()");
  console.log("\n⚠️ خطّ الأساس صامت — لا يُقاس شيء عليه (قرار 22). والتشخيص يفصل السبب:");
  console.log("   " + JSON.stringify(d, null, 1).replace(/\n/g, "\n   "));
  console.log(d?.["الوقت_يتقدّم"] > 0
    ? "\n   ⇒ العنصر **يشغّل فعلاً** والصمت في الرسم نفسه — يُفحص الرِكاز قبل أي استنتاج."
    : "\n   ⇒ العنصر لا يتقدّم أصلاً ⇒ حدّ منصّة لا نتيجة.");
  chrome.kill(); srv.close(); process.exit(1);
}
await step("مستوى 0.5 — هل يقصّ العنصرُ الرسمَ؟", { volume: 0.5 });
await step("مستوى 1 مرة أخرى", { volume: 1 });
await step("**مكتوم** بكسب 1 — بوّابة الكتم", { muted: true });
await step("فكّ الكتم بكسب 1", { muted: false });
await step("كسب 6 (600%) غير مكتوم", { gain: 6 });
await step("**مكتوم** بكسب 6 — البوّابة تحت الكسب", { muted: true });
const after = await step("فكّ الكتم بكسب 6 — القفزة", { muted: false });
await step("مستوى 0.5 بكسب 6", { volume: 0.5 });
const second = await ev("window.__second(600)");

const f = (x) => (x ?? 0).toFixed(6);
console.log("\n=== مسار المعزّز — RMS من analyser (نسخة من رسم buildBoostGraph) ===\n");
for (const r of rows) {
  console.log(`  ${String(r.rms).padStart(9)}  (قمة ${String(r.peak).padStart(8)})   ${r.label}`);
}
const mutedG1 = rows.find((r) => r.label.includes("مكتوم** بكسب 1"));
const mutedG6 = rows.find((r) => r.label.includes("مكتوم** بكسب 6"));
const half = rows.find((r) => r.label.includes("مستوى 0.5 — هل"));
console.log("\n--- الأحكام ---");
console.log(`  الكتم يُسكت المسار المعزَّز؟      : ${mutedG1?.rms === 0 && mutedG6?.rms === 0 ? "✅ نعم — صفر تام في الحالتين" : "❌ لا — يخرج صوت وهو مكتوم: " + f(mutedG1?.rms) + " / " + f(mutedG6?.rms)}`);
console.log(`  video.volume يقصّ المسار؟        : ${half && base ? (Math.abs(half.rms / base.rms - 0.5) < 0.08 ? "✅ نعم — النسبة ≈ 0.5" : "⚠️ النسبة " + (half.rms / base.rms).toFixed(3)) : "—"}`);
console.log(`  قفزة فكّ الكتم عند 600%           : ${f(mutedG6?.rms)} ⇒ ${f(after?.rms)}  (×${base ? (after?.rms / base.rms).toFixed(2) : "—"} من خطّ الأساس)`);
console.log(`  عنصر جديد بكسب 600% ومستوى ${second?.volume ?? "—"} : RMS ${f(second?.rms)}  (×${base ? (second?.rms / base.rms).toFixed(2) : "—"} من خطّ الأساس)`);
console.log("");
chrome.kill(); srv.close(); process.exit(0);
