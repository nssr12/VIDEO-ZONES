// #60 — انحدار «الضغطة الضائعة عادت من باب المحوّل»: بعد الكتم بـ`m` صارت العجلة
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// محلُّ حكمِه سلوكُ يوتيوب نفسِه مع مفاتيحَ موثوقةٍ على فيديو حيّ، وهو يُعلن في
//   ترويسته أنّ نافذته 1000ms ولا يُقرأ أخضرُه أبعدَ منها.
// لأعلى **ترفع المستوى ولا تفكّ الكتم**، فتسلّق المستوى صامتاً حتى 100.
//
// **يُقاس قبل أي علاج**، لأن الاحتمالين علاجهما مختلف تماماً:
//   (أ) **يوتيوب نفسه لا يفكّ الكتم بسهمه** ⇒ سلوك مضيف، والمحوّل يحتاج فكّ كتم
//       صريحاً **عبر واجهة المضيف** قبل الخطوة.
//   (ب) **يفكّه، وإرسالنا لا** ⇒ العلّة عندنا: الهدف؟ حارس الارتداد؟ الطابور؟
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**
//   node tools/bench-yt-mute-step.mjs ["https://www.youtube.com/watch?v=..."]
//
// ويُقاس معه ما يحتاجه العلاج نفسه: **هل نستطيع فكّ الكتم بواجهة المضيف بحدث
// غير موثوق؟** — مفتاحه المُرسَل منّا، وزرّ الكتم بـ`.click()`.
//
// ⚠️ شاهدا قرار 26: **موجب** — `m` موثوقة *يجب* أن تقلب `muted`؛ **سالب** —
// قراءة بلا أي ضغطة *يجب ألا* تغيّر شيئاً. بلا الشاهدين لا تُطبع أحكام.
//
// ⚠️ **نافذةُ هذا الشاهد: 1000ms** — وكلُّ «نجت» و«ثبت» فيه يعني
// **حتى 1000ms ولا شيء بعدها**. ⛔ **ولا يُقرأ أخضرُه ضماناً أبعد من ذلك.**
// **والواقعة التي أوجبت هذا السطر (2026-08-04):** `bench-adapter-live` و
// `bench-yt-adapter` قالا «✅ نجت القيمة» بنافذتَي **1500ms و1000ms**،
// **ومحوُ يوتيوب يقع عند 3000ms** ⇒ **فكان أخضرُهما خبراً عن النافذة لا عن
// النجاة** — صادقاً حرفياً وكاذباً بما يوحي به (شكل #90 في شاهدٍ نستشهد به).
// ⛔ **ولا تُطال النافذةُ بلا سببٍ مقيس** — تطويلٌ بلا سبب ثمنٌ بلا مقابل.
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const CDP = 9556;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
  "--autoplay-policy=no-user-gesture-required", `--user-data-dir=/tmp/vz-ytms-${process.pid}`,
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
  if (await p.ev(`(() => { const v = document.querySelector("video");
      return !!v && v.readyState >= 1 && v.getBoundingClientRect().width > 0; })()`)) { ready = true; break; }
  await sleep(1000);
}
if (!ready) { console.log("⚠️ المشغّل لم يبدأ — لم يُقس"); chrome.kill(); process.exit(1); }

const state = () => p.ev(`(() => { const v = document.querySelector("video");
  const s = document.querySelector(".ytp-volume-panel, .ytp-volume-slider");
  const b = document.querySelector(".ytp-mute-button");
  return { slider: s ? s.getAttribute("aria-valuenow") : null,
           muted: v.muted, volume: Math.round(v.volume * 1000) / 10,
           btnLabel: b ? (b.getAttribute("title") || b.getAttribute("aria-label") || "") .slice(0, 24) : null }; })()`);

// ضغطة **موثوقة** — «بيد المستخدم»
async function realKey(key, code, vk) {
  await p.ev(`(document.querySelector("#movie_player")||{}).focus?.()`);
  for (const type of ["keyDown", "keyUp"]) {
    await p.send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  await sleep(700);
}

// إرسال **غير موثوق** بنفس آلية المحوّل: نفس الهدف ونفس شكل الحدث
const fakeKey = (key) => p.ev(`(() => {
  const t = document.querySelector("#movie_player") || document.querySelector("video");
  if (!t) return "لا هدف";
  const up = ${JSON.stringify("ArrowUp")} === ${JSON.stringify("x")};
  for (const type of ["keydown", "keyup"]) {
    t.dispatchEvent(new KeyboardEvent(type, { key: ${JSON.stringify(key)}, code: ${JSON.stringify(key)},
      keyCode: ${key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 : 77},
      which: ${key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 : 77},
      bubbles: true, cancelable: true, composed: true }));
  }
  return "أُرسل";
})()`);

const clickMuteBtn = () => p.ev(`(() => { const b = document.querySelector(".ytp-mute-button");
  if (!b) return "لا زر"; b.click(); return "نُقر"; })()`);

const fmt = (s) => `منزلق ${String(s.slider).padStart(3)} · muted ${s.muted ? "نعم" : "لا "} · volume ${String(s.volume).padStart(5)}%`;
const rows = [];
const step = async (label, fn) => { if (fn) await fn(); await sleep(600); const s = await state(); rows.push({ label, s }); return s; };

console.log(`\n=== سهم يوتيوب وهو مكتوم — ${URL_} ===\n`);

// شاهد سالب: قراءتان بلا أي ضغطة
const s0 = await step("خطّ الأساس", null);
const s0b = await step("قراءة ثانية بلا ضغطة (شاهد سالب)", null);
const negativeOk = s0.muted === s0b.muted && s0.slider === s0b.slider && s0.volume === s0b.volume;

// ⚠️ **النزول عن السقف أولاً — وهذا شاهد موجب للسهم نفسه لا للكتم.** أول تشغيلة
// قاست والمنزلق على **100**، فلم يكن لـ`ArrowUp` مكان يصعد إليه وخرجت النتيجة
// «لا يرفع ولا يفكّ» — وهي **أثر سقف لا سلوك مضيف**. لا يُقرأ سكون السهم حتى
// يُثبَت أنه **يستطيع** أن يحرّك المنزلق في هذه الحالة (قرار 26).
const preDown = await step("قبل النزول عن السقف", null);
await realKey("ArrowDown", "ArrowDown", 40);
await realKey("ArrowDown", "ArrowDown", 40);
const lowered = await step("بعد ArrowDown موثوقة ×2 (نزول عن السقف)", null);
const arrowMovesOk = Number(lowered.slider) < Number(preDown.slider);

// ── أ) بيد المستخدم: كتم ثم سهمان لأعلى، كلها **موثوقة** ──────────────────
const mutedReal = await step("بعد `m` موثوقة (كتم)", () => realKey("m", "KeyM", 77));
const positiveOk = mutedReal.muted !== s0.muted;
const up1 = await step("بعد ArrowUp موثوقة #1 وهو مكتوم", () => realKey("ArrowUp", "ArrowUp", 38));
const up2 = await step("بعد ArrowUp موثوقة #2", () => realKey("ArrowUp", "ArrowUp", 38));

// إعادة الحالة: إن بقي مكتوماً نفكّه بـ m موثوقة
if (up2.muted) await step("إعادة الضبط بـ `m` موثوقة", () => realKey("m", "KeyM", 77));

// ── أ٢) الاتجاه الآخر وهو مكتوم: هل ينزل المستوى ويبقى الكتم؟ ─────────────
// لازم لعقد الثوابت: الثابت الثاني ينصّ على أن الخفض على مكتوم **ينزل فعلاً على
// نموذج المضيف**. لا يُفترض — يُقاس.
await step("كتم بـ `m` موثوقة قبل قياس النزول", () => realKey("m", "KeyM", 77));
const mutedBeforeDown = rows[rows.length - 1].s;
const dn1 = await step("بعد ArrowDown موثوقة وهو مكتوم", () => realKey("ArrowDown", "ArrowDown", 40));
const dn2 = await step("بعد ArrowDown **من إرسالنا** وهو مكتوم", () => fakeKey("ArrowDown"));
if (dn2.muted) await step("إعادة الضبط بـ `m` موثوقة", () => realKey("m", "KeyM", 77));

// ── ب) بإرسالنا نحن (غير موثوق): كتم بيد المستخدم ثم سهمنا ────────────────
await step("كتم بـ `m` موثوقة قبل إرسالنا", () => realKey("m", "KeyM", 77));
const fake1 = await step("بعد ArrowUp **من إرسالنا** وهو مكتوم", () => fakeKey("ArrowUp"));

// ── ج) هل نفكّ الكتم بواجهة المضيف بحدث غير موثوق؟ ────────────────────────
const fakeM = await step("بعد `m` **من إرسالنا** (وهو مكتوم)", () => fakeKey("m"));
if (!fakeM.muted) await step("إعادة الكتم بـ `m` موثوقة", () => realKey("m", "KeyM", 77));
const btn = await step("بعد نقر .ytp-mute-button بـ .click() غير موثوق", () => clickMuteBtn());

for (const r of rows) console.log(`  ${fmt(r.s)}   ${r.label}`);

console.log(`\n--- شاهدا قرار 26 ---`);
console.log(`  موجب — \`m\` موثوقة قلبت muted : ${positiveOk ? "✅" : "❌ الرِكاز لا يرى — لا حكم"}`);
console.log(`  سالب — قراءتان بلا ضغطة متطابقتان : ${negativeOk ? "✅" : "❌ الحالة تتحرّك وحدها"}`);
console.log(`  موجب للسهم — ArrowDown موثوقة حرّكت المنزلق : ${arrowMovesOk ? "✅ (" + preDown.slider + " ⇒ " + lowered.slider + ")" : "❌ السهم لا يحرّك شيئاً — سكونه لاحقاً بلا دلالة"}`);

if (positiveOk && negativeOk && arrowMovesOk) {
  console.log(`\n--- الحكم ---`);
  const hostUnmutes = mutedReal.muted && !up1.muted;
  const hostRaisesWhileMuted = mutedReal.muted && up1.muted && Number(up1.slider) > Number(mutedReal.slider);
  console.log(`  (أ) سهم يوتيوب **الموثوق** وهو مكتوم:`);
  console.log(`      ${hostUnmutes ? "✅ **يفكّ الكتم** بنفسه" : hostRaisesWhileMuted ? "❌ **يرفع المستوى ويبقى مكتوماً** — سلوك مضيف" : "⚠️ لا هذا ولا ذاك: " + fmt(up1)}`);
  console.log(`  (ب) سهمنا **غير الموثوق** وهو مكتوم: ${!fake1.muted ? "فكّ الكتم" : "بقي مكتوماً"} · ${fmt(fake1)}`);
  console.log(`  (أ٢) الخفض وهو مكتوم — للثابت الثاني في العقد:`);
  console.log(`      موثوقة  : ${mutedBeforeDown.slider} ⇒ ${dn1.slider} · muted ${dn1.muted ? "باقٍ ✅" : "انفكّ ❌"}`);
  console.log(`      إرسالنا : ${dn1.slider} ⇒ ${dn2.slider} · muted ${dn2.muted ? "باقٍ ✅" : "انفكّ ❌"}`);
  console.log(`  (ج) طرق فكّ الكتم المتاحة لنا بحدث غير موثوق:`);
  console.log(`      \`m\` مُرسَلة منّا : ${!fakeM.muted ? "✅ تفكّ" : "❌ لا تفكّ"}`);
  console.log(`      نقر زر الكتم    : ${btn.muted === false ? "✅ يفكّ" : "❌ لا يفكّ"}  (الزر: ${btn.btnLabel ?? "—"})`);
}
console.log("");
chrome.kill(); process.exit(0);
