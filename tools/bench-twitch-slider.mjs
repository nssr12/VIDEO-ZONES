// قياس سلوك تويتش قبل كتابة محوّله (#60 · قرار 25 · عقد الصوت ع1):
//   ١. بنية المنزلق: كم `<input type=range>`، أيّها مرئي، ما مداه، وأين يقع؟
//   ٢. **هل يرفع تويتش المستوى وهو مكتوم؟ وهل يفكّ الكتم بنفسه؟** — لا يُفترض
//      أنه كيوتيوب. قِيس يوتيوب فوُجد **يرفع ويبقى مكتوماً**؛ تويتش قد يخالف.
//   ٣. ما الطرق المتاحة لنا **بحدث غير موثوق** لفكّ الكتم؟ (المفتاح · زرّ الكتم)
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**
//   node tools/bench-twitch-slider.mjs ["https://www.twitch.tv/<channel>"]
//
// ⚠️ **المحدّد بالبنية لا بالاسم:** معرّفات تويتش `player-volume-slider-<UUID>`
// وأصنافه `ScRangeInput-sc-…` بصمات styled-components تتغيّر مع كل بناء. فالمِجَسّ
// هنا يبحث بـ`input[type=range]` والمدى والموضع، **ولا يستعمل اسماً واحداً منها**.
//
// ⚠️ وشاهدا قرار 26: **موجب** — ضبط المنزلق *يجب* أن يغيّر `video.volume`؛
// **سالب** — قراءتان بلا فعل *يجب* أن تتطابقا. وقرار 26/شاهد المدى: نُنزل المستوى
// عن سقفه قبل الحكم على «هل يرفع».
import { spawn } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const CDP = 9577;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
  "--autoplay-policy=no-user-gesture-required", `--user-data-dir=/tmp/vz-tw-${process.pid}`,
  `--user-agent=${UA}`, `--remote-debugging-port=${CDP}`, "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }

const URL_ = process.argv[2] || "https://www.twitch.tv/";
const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(URL_)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method: m, params: p })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
};
await send("Runtime.enable"); await send("Page.enable"); await send("Page.bringToFront");

let ready = false;
for (let i = 0; i < 60; i++) {
  if (await ev(`(() => { const v = document.querySelector("video");
      return !!v && v.readyState >= 1 && v.getBoundingClientRect().width > 0; })()`)) { ready = true; break; }
  await sleep(1000);
}
if (!ready) { console.log("⚠️ المشغّل لم يبدأ — لم يُقس"); chrome.kill(); process.exit(1); }
// تمرير المؤشّر فوق المشغّل: بعض المشغّلات لا تُركّب شريطها إلا بتفاعل
{
  const r = await ev(`(() => { const v = document.querySelector("video"); const b = v.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
  for (let i = 0; i < 3; i++) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x + i, y: r.y }); await sleep(200); }
  await sleep(800);
}

// ── بنية المنزلق، بالبنية لا بالاسم ────────────────────────────────────────
const shape = await ev(`(() => {
  const isOurs = (el) => !!(el.closest && el.closest(".vzWrap"));
  const all = [...document.querySelectorAll("input[type=range]")].filter((el) => !isOurs(el));
  return all.map((el) => {
    const r = el.getBoundingClientRect();
    return { min: el.min, max: el.max, step: el.step, value: el.value,
             visible: r.width > 0 && r.height > 0,
             inPlayer: !!el.closest("[data-a-player-state], .video-player, [class*='player']"),
             idHasUuid: /[0-9a-f]{8}-[0-9a-f]{4}/i.test(el.id || ""),
             cls: (typeof el.className === "string" ? el.className : "").slice(0, 40) };
  });
})()`);

const state = () => ev(`(() => {
  const v = document.querySelector("video");
  const isOurs = (el) => !!(el.closest && el.closest(".vzWrap"));
  const all = [...document.querySelectorAll("input[type=range]")].filter((el) => !isOurs(el));
  const vis = all.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  return { slider: vis ? vis.value : (all[0] ? all[0].value : null),
           sliders: all.map((el) => el.value).join("/"),
           muted: v.muted, volume: Math.round(v.volume * 1000) / 10 }; })()`);

// ⚠️ **الضبط بكسر من المدى المقيس لا برقم مطلق.** أول تشغيلة كتبت `60` على منزلق
// مداه **0..1** فقُصّ إلى 1 (=100%)، فسقط الشاهد الموجب — والرقم المطلق يفترض
// مدى لم يُقس. المدى يُقرأ من العنصر ثم يُحسب عليه.
const setSlider = (frac) => ev(`(() => {
  const isOurs = (el) => !!(el.closest && el.closest(".vzWrap"));
  const all = [...document.querySelectorAll("input[type=range]")].filter((el) => !isOurs(el));
  const el = all.find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || all[0];
  if (!el) return "لا منزلق";
  const min = Number(el.min === "" ? 0 : el.min);
  const max = Number(el.max === "" ? 1 : el.max);
  const target = min + (max - min) * ${frac};
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, String(target));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return el.value;
})()`);

const fakeKey = (key) => ev(`(() => {
  const t = document.querySelector("[data-a-player-state], .video-player") || document.querySelector("video");
  if (!t) return "لا هدف";
  for (const type of ["keydown", "keyup"]) {
    t.dispatchEvent(new KeyboardEvent(type, { key: ${JSON.stringify(key)}, code: ${JSON.stringify(key)},
      keyCode: ${key === "m" ? 77 : 0}, which: ${key === "m" ? 77 : 0},
      bubbles: true, cancelable: true, composed: true }));
  }
  return "أُرسل";
})()`);

const clickMute = () => ev(`(() => {
  const b = document.querySelector('button[data-a-target="player-mute-unmute-button"]') ||
            [...document.querySelectorAll("button")].find((x) => /mute/i.test(x.getAttribute("aria-label") || ""));
  if (!b) return "لا زر"; b.click(); return "نُقر";
})()`);

async function realKey(key, code, vk) {
  await ev(`(document.querySelector("[data-a-player-state], .video-player, video")||{}).focus?.()`);
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  await sleep(700);
}

const rows = [];
const step = async (label, fn) => { if (fn) await fn(); await sleep(700); const s = await state(); rows.push({ label, s }); return s; };
const fmt = (s) => `منزلق ${String(s.slider).padStart(5)} (كلها ${s.sliders}) · muted ${s.muted ? "نعم" : "لا "} · volume ${String(s.volume).padStart(5)}%`;

console.log(`\n=== بنية منزلق تويتش وسلوكه وهو مكتوم — ${URL_} ===\n`);
console.log(`  عدد input[type=range] غير عناصرنا: ${shape.length}`);
for (const s of shape) {
  console.log(`   · مدى ${s.min}..${s.max} step=${s.step} value=${s.value} مرئي=${s.visible ? "نعم" : "لا"}` +
    ` داخل المشغّل=${s.inPlayer ? "نعم" : "لا"} · المعرّف فيه UUID=${s.idHasUuid ? "نعم" : "لا"} · صنف «${s.cls}»`);
}

const s0 = await step("خطّ الأساس", null);
const s0b = await step("قراءة ثانية بلا فعل (شاهد سالب)", null);
const negativeOk = s0.muted === s0b.muted && s0.slider === s0b.slider;

// شاهد موجب + النزول عن السقف قبل الحكم على الرفع
const lowered = await step("ضبط المنزلق إلى 60% من مداه (شاهد موجب)", () => setSlider(0.6));
const positiveOk = Math.abs(lowered.volume - 60) < 8;

const muted = await step("كتم بزرّ المضيف (.click غير موثوق)", () => clickMute());
const raisedWhileMuted = await step("ضبط المنزلق إلى 80% من مداه **وهو مكتوم**", () => setSlider(0.8));
const unmuteByClick = await step("نقر زرّ الكتم مرة أخرى (فكّ)", () => clickMute());
const fakeM = await step("`m` **من إرسالنا** (غير موثوق)", () => fakeKey("m"));
const realM = await step("`m` **موثوقة** (مرجع)", () => realKey("m", "KeyM", 77));

for (const r of rows) console.log(`  ${fmt(r.s)}   ${r.label}`);

console.log(`\n--- شاهدا قرار 26 ---`);
console.log(`  موجب — ضبط المنزلق غيّر المستوى : ${positiveOk ? "✅" : "❌ الرِكاز لا يرى — لا حكم"}`);
console.log(`  سالب — قراءتان بلا فعل متطابقتان : ${negativeOk ? "✅" : "❌"}`);

if (positiveOk && negativeOk) {
  console.log(`\n--- الحكم ---`);
  console.log(`  رفع المنزلق وهو مكتوم : ${raisedWhileMuted.muted ? "❌ **بقي مكتوماً**" : "✅ **فكّ الكتم بنفسه**"}` +
    ` · المستوى ${muted.volume}% ⇒ ${raisedWhileMuted.volume}%`);
  console.log(`  فكّ الكتم بنقر الزر (غير موثوق) : ${unmuteByClick.muted === false ? "✅ يفكّ" : "❌ لا يفكّ"}`);
  console.log(`  مفتاح m من إرسالنا : ${fakeM.muted !== unmuteByClick.muted ? "✅ يؤثّر" : "❌ **لا يؤثّر** — تويتش يتجاهل مفاتيحنا"}`);
  console.log(`  مفتاح m موثوقاً (مرجع) : ${realM.muted !== fakeM.muted ? "✅ يؤثّر" : "— لا تغيّر"}`);
}
console.log("");
chrome.kill(); process.exit(0);
