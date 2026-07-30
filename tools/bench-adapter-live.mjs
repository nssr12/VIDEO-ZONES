// قياس محوّل يوتيوب على يوتيوب حيّ — ثلاثة أرقام (#60 · قرار 25):
//   ١. هل تحرّك **منزلق المضيف** بصرياً؟ (تعريف «تمّ» بنصّ المالك)
//   ٢. هل نجت القيمة بعد **كتم المضيف وفكّه**؟
//   ٣. كم **إرسالاً** خرج مقابل **عشر نقرات**؟ (سقف الدفقة)
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**
//   node tools/bench-adapter-live.mjs ["https://www.youtube.com/watch?v=..."]
//
// ⚠️ **حدّ مُصرَّح به:** هذا يقيس **كتلة المحوّل مقتطعةً من `content.js` ومحقونةً
// في الصفحة**، لا الإضافة المحزومة من طرف إلى طرف. قياس الإضافة المحمَّلة هو
// `bench-zero-change.mjs` وهو **رِكاز أعمى مسجَّل في `KNOWN-DEFECTS.md`**.
// فما هنا يثبت أن **منطق المحوّل** يحرّك نموذج المضيف، لا أن الحزمة كاملة تفعل.
//
// ⚠️ وشاهدا قرار 26: **موجب** — عشر نقرات *يجب* أن تحرّك المنزلق؛ **سالب** —
// المحوّل أثناء «الكتابة» *يجب ألا* يُرسل شيئاً. بلا الشاهدين لا تُطبع أرقام.
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const CDP = 9533;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slice(from, to) {
  const t = fs.readFileSync("content.js", "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error("تعذّر اقتطاع كتلة المحوّل");
  return t.slice(a, b);
}
// الكتلة **كما هي في الملف** — لا نسخة مكتوبة هنا، وإلا قِسنا شيئاً آخر
const YTAD = slice("// ── محوّل يوتيوب (#60 · قرار 25)", "function runAction");

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
  "--autoplay-policy=no-user-gesture-required", `--user-data-dir=/tmp/vz-adlive-${process.pid}`,
  `--user-agent=${UA}`, `--remote-debugging-port=${CDP}`, "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }

async function open(url) {
  const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let n = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (m, p = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method: m, params: p })); });
  const ev = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    return r.result?.result?.value;
  };
  return { ws, send, ev };
}

let URL_ = process.argv[2];
if (!URL_) {
  const s = await open("https://www.youtube.com/results?search_query=music");
  for (let i = 0; i < 25; i++) {
    const h = await s.ev(`(document.querySelector('a#video-title, a[href^="/watch?v="]')||{}).href||null`);
    if (h) { URL_ = h.split("&")[0]; break; }
    await sleep(1000);
  }
  s.ws.close();
}
if (!URL_) { console.log("⚠️ تعذّر إيجاد رابط يوتيوب — لم يُقس"); chrome.kill(); process.exit(1); }

const p = await open(URL_);
await p.send("Runtime.enable"); await p.send("Page.enable"); await p.send("Page.bringToFront");
let ready = false;
for (let i = 0; i < 60; i++) {
  const st = await p.ev(`(() => { const v = document.querySelector("video");
    return v && v.readyState >= 1 && v.getBoundingClientRect().width > 0; })()`);
  if (st) { ready = true; break; }
  await sleep(1000);
}
if (!ready) { console.log("⚠️ المشغّل لم يبدأ — لم يُقس"); chrome.kill(); process.exit(1); }

// حقن الكتلة مع بدائل الاعتمادات فقط — والمنطق كما هو
await p.ev(`
  window.__sends = 0;
  window.addEventListener("keydown", (e) => { if (!e.isTrusted) window.__sends++; }, true);
  window.__typing = false;
  var shouldIgnoreKeyBecauseTyping = () => window.__typing;
  var nowMs = () => performance.now();
  var hostAdapters = new Map();
  ${YTAD}
  window.__ad = hostAdapters.get("youtube.com");
  "ok"`);

const state = () => p.ev(`(() => { const v = document.querySelector("video");
  const s = document.querySelector(".ytp-volume-panel, .ytp-volume-slider");
  return { volume: Math.round(v.volume * 1000) / 10,
           slider: s ? s.getAttribute("aria-valuenow") : null, muted: v.muted,
           sends: window.__sends }; })()`);

const click = (n, dir = "stepDown") => p.ev(
  `(() => { const v = document.querySelector("video");
     for (let i = 0; i < ${n}; i++) window.__ad.${dir}(v); return true; })()`);

async function hostMuteKey() {
  await p.ev(`(document.querySelector("#movie_player")||{}).focus?.()`);
  for (const type of ["keyDown", "keyUp"]) {
    await p.send("Input.dispatchKeyEvent", { type, key: "m", code: "KeyM", windowsVirtualKeyCode: 77, nativeVirtualKeyCode: 77 });
  }
  await sleep(700);
}

console.log(`\n=== محوّل يوتيوب على يوتيوب حيّ — ${URL_} ===\n`);
const before = await state();
console.log(`  قبل            : منزلق ${before.slider} · مستوى ${before.volume}% · إرسالات ${before.sends}`);

// ① و③ — عشر نقرات سريعة
await click(10);
await sleep(1500);
const after = await state();
console.log(`  بعد عشر نقرات  : منزلق ${after.slider} · مستوى ${after.volume}% · إرسالات ${after.sends}`);

// ② — دورة كتم المضيف وفكّه
await hostMuteKey();
const muted = await state();
await hostMuteKey();
await sleep(400);
const back = await state();
console.log(`  بعد كتم المضيف : منزلق ${muted.slider} · مستوى ${muted.volume}%${muted.muted ? " (م)" : ""}`);
console.log(`  بعد فكّ كتمه   : منزلق ${back.slider} · مستوى ${back.volume}%`);

// شاهد سالب — الامتناع أثناء الكتابة
await p.ev(`window.__typing = true`);
const preTyping = await state();
await click(5);
await sleep(600);
const postTyping = await state();
await p.ev(`window.__typing = false`);

const moved = before.slider !== after.slider;
const sends = after.sends - before.sends;
const survived = back.slider === after.slider;
const silentWhileTyping = postTyping.sends === preTyping.sends;

console.log(`\n--- الأرقام الثلاثة ---`);
console.log(`  ① تحرّك المنزلق بصرياً      : ${moved ? "✅ نعم" : "❌ لا"}  (${before.slider} ⇒ ${after.slider})`);
console.log(`  ② نجت القيمة بعد دورة الكتم : ${survived ? "✅ نعم" : "❌ لا"}  (${after.slider} ⇒ ${back.slider})`);
console.log(`  ③ إرسالات مقابل عشر نقرات   : **${sends}**`);
console.log(`\n--- شاهدا قرار 26 ---`);
console.log(`  موجب — عشر نقرات تحرّك المنزلق : ${moved ? "✅" : "❌ الرِكاز لا يرى — لا يُبنى على الأرقام"}`);
console.log(`  سالب — لا إرسال أثناء الكتابة  : ${silentWhileTyping ? "✅ صفر إرسال" : "❌ أرسل " + (postTyping.sends - preTyping.sends)}`);
console.log("");
chrome.kill(); process.exit(0);
