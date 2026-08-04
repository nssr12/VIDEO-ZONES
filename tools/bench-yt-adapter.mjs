// ثلاثة أسئلة تخصّ محوّل يوتيوب (البند #60، قرار 25) — **قياس قبل التصميم**:
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// يلتقط أوّلَ نتيجةِ بحثٍ حيّةٍ في يوتيوب فيقيس فيديو مختلفاً كلَّ تشغيلة،
//   ونافذتُه 1000ms أقصرُ من محوِ يوتيوب عند 3000ms فأخضرُه خبرٌ عن النافذة لا
//   عن النجاة.
//
//   1. هل يحتاج اختصار المضيف تركيزاً على المشغّل؟ وعلى أي هدف يُرسَل؟
//   2. **الأخطر:** لو كان التركيز في صندوق بحث أو حقل تعليق — هل تكتب ضغطتنا
//      حرفاً في نصّ المستخدم؟ خطأ هنا يفسد ما يكتبه، وهو أسوأ من عطب صوت.
//   3. هل يصطدم إرسالنا للاختصار بمعالجات مفاتيحنا نحن؟
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**
//   node tools/bench-yt-adapter.mjs ["https://www.youtube.com/watch?v=..."]
//
// ⚠️ التمييز قائم هنا أيضاً: أحداث CDP **موثوقة** وسكربت المحتوى لا يولّدها.
// فما نرسله نحن يُرسَل بـ `dispatchEvent` (غير موثوق)، ويُقارن بضغطة CDP موثوقة
// **كخطّ أساس للمقارنة لا كعلاج**.
import { spawn } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const CDP = 9477;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
  "--autoplay-policy=no-user-gesture-required", `--user-data-dir=/tmp/vz-ytad-${process.pid}`,
  `--user-agent=${UA}`, `--remote-debugging-port=${CDP}`, "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }

async function pickUrl() {
  if (process.argv[2]) return process.argv[2];
  const t = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent("https://www.youtube.com/results?search_query=music")}`, { method: "PUT" })).json();
  const w = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => { w.onopen = r; });
  let k = 0; const pd = new Map();
  w.onmessage = (e) => { const m = JSON.parse(e.data); if (pd.has(m.id)) { pd.get(m.id)(m); pd.delete(m.id); } };
  const s = (method, params = {}) => new Promise((r) => { const id = ++k; pd.set(id, r); w.send(JSON.stringify({ id, method, params })); });
  await s("Runtime.enable");
  for (let i = 0; i < 25; i++) {
    const r = await s("Runtime.evaluate", { expression: `(document.querySelector('a#video-title, a[href^="/watch?v="]')||{}).href||null`, returnByValue: true });
    const href = r.result?.result?.value;
    if (href) { w.close(); return href.split("&")[0]; }
    await sleep(1000);
  }
  w.close(); return null;
}

const URL_ = await pickUrl();
if (!URL_) { console.log("⚠️ تعذّر إيجاد رابط يوتيوب — لم يُقس"); chrome.kill(); process.exit(1); }

const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(URL_)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
};
await send("Runtime.enable"); await send("DOM.enable"); await send("Page.enable");
await send("Page.bringToFront");

// انتظار مشغّل حقيقي
let ready = false;
for (let i = 0; i < 60; i++) {
  const st = await ev(`(() => { const v = document.querySelector("video");
    return v ? { rs: v.readyState, w: v.getBoundingClientRect().width } : null; })()`);
  if (st?.rs >= 1 && st.w > 0) { ready = true; break; }
  await sleep(1000);
}
if (!ready) { console.log("⚠️ المشغّل لم يبدأ — لم يُقس"); chrome.kill(); process.exit(1); }

// مِجَسّ يمثّل مستمع المفاتيح في content.js: window + capture، وهو **نفس** الموضع
// الذي يسجّل فيه سكربتنا مستمعه. يعدّ ما يراه ويميّز الموثوق من غيره.
// ⚠️ عدّاد لا مصفوفة: أول تشغيلة خزّنت كائناً لكل حدث فبلغت **923,627** كائناً،
// فأبطأت الصفحة وأفسدت زمن القياس. العدّ وحده يكفي، مع عيّنة صغيرة للهوية.
await ev(`window.__n = 0; window.__sample = [];
  window.addEventListener("keydown", (e) => {
    window.__n++;
    if (window.__sample.length < 5) window.__sample.push({
      key: e.key, trusted: e.isTrusted, target: (e.target && e.target.tagName) || "?" });
  }, true); "ok"`);

const state = () => ev(`(() => { const v = document.querySelector("video");
  const p = document.querySelector(".ytp-volume-panel, .ytp-volume-slider");
  const box = document.querySelector('input#search, input[name=search_query], textarea#input, div#contenteditable-root');
  return { volume: Math.round(v.volume * 1000) / 10, muted: v.muted,
           slider: p ? p.getAttribute("aria-valuenow") : null,
           active: (document.activeElement && document.activeElement.tagName) || "?",
           boxValue: box ? (box.value ?? box.textContent ?? "") : null }; })()`);

const fire = (targetExpr, key = "ArrowDown", times = 2) => ev(`(() => {
  const t = ${targetExpr};
  if (!t) return "لا هدف";
  for (let i = 0; i < ${times}; i++) {
    for (const type of ["keydown", "keyup"]) {
      t.dispatchEvent(new KeyboardEvent(type, { key: ${JSON.stringify(key)},
        code: ${JSON.stringify(key.length === 1 ? "Key" + key.toUpperCase() : key)},
        keyCode: ${key === "ArrowDown" ? 40 : key.toUpperCase().charCodeAt(0)},
        which: ${key === "ArrowDown" ? 40 : key.toUpperCase().charCodeAt(0)},
        bubbles: true, cancelable: true, composed: true }));
    }
  }
  return "أُرسل ×${times}";
})()`);

const seen = () => ev(`(() => { const r = { n: window.__n, sample: window.__sample.slice() };
  window.__n = 0; window.__sample = []; return r; })()`);
const clearSeen = () => ev(`window.__n = 0; window.__sample = []; "ok"`);

async function cdpKey(key, code, vk) {
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
}

const out = [];
const rec = (t, before, after, note) => out.push({ t, before, after, note });

console.log(`\n=== أسئلة محوّل يوتيوب — ${URL_} ===\n`);

// ---- 1) الهدف والتركيز -----------------------------------------------------
await clearSeen();
let b = await state();
await fire(`document.querySelector("#movie_player")`);
await sleep(900);
let a = await state();
const s1 = await seen();
rec("إرسال إلى #movie_player والتركيز على المستند", b, a, `المِجَسّ عدّ ${s1.n} (أرسلنا 2)`);

await clearSeen();
b = await state();
await fire(`document.body`);
await sleep(900);
a = await state();
const s2 = await seen();
rec("إرسال إلى document.body", b, a, `المِجَسّ عدّ ${s2.n} (أرسلنا 2)`);

await clearSeen();
b = await state();
await fire(`document.querySelector("video")`);
await sleep(900);
a = await state();
const s3 = await seen();
rec("إرسال إلى <video>", b, a, `المِجَسّ عدّ ${s3.n} (أرسلنا 2)`);

// ---- 2) والتركيز داخل حقل نصّ — الأخطر ------------------------------------
// يُملأ الحقل بضغطات **موثوقة** من CDP كي يكون نصّاً حقيقياً كتبه المستخدم
await ev(`(() => { const box = document.querySelector('input#search, input[name=search_query]');
  if (box) { box.focus(); box.value = ""; } return !!box; })()`);
await sleep(300);
// ⚠️ `Input.dispatchKeyEvent` بـ keyDown/keyUp وحدهما **لا يكتب حرفاً**؛ أول
// تشغيلة اختبرت «هل يفسد نصّ المستخدم» على حقل **فارغ** فلم تختبر شيئاً.
await send("Input.insertText", { text: "hello" });
await sleep(400);
const typed = await state();

await clearSeen();
b = await state();
await fire(`document.querySelector("#movie_player")`);
await sleep(900);
a = await state();
const s4 = await seen();
rec("والتركيز في صندوق البحث — إرسال إلى #movie_player", b, a, `المِجَسّ عدّ ${s4.n} (أرسلنا 2)`);

// أسوأ حالة: الإرسال إلى العنصر المركَّز نفسه
await clearSeen();
b = await state();
await fire(`document.activeElement`);
await sleep(900);
a = await state();
const s5 = await seen();
rec("إرسال ArrowDown إلى العنصر المركَّز نفسه", b, a, `المِجَسّ عدّ ${s5.n} (أرسلنا 2)`);

// ومفتاح **مطبوع** إلى الحقل المركَّز: هل يكتب حرفاً؟
await clearSeen();
b = await state();
await fire(`document.activeElement`, "z", 3);
await sleep(700);
a = await state();
rec('إرسال حرف "z" ×3 إلى الحقل المركَّز', b, a, "اختبار الكتابة في نصّ المستخدم");

// وضغطة موثوقة من CDP والتركيز في الحقل — هل يوتيوب نفسه يتجاهلها؟
b = await state();
await cdpKey("ArrowDown", "ArrowDown", 40);
await sleep(900);
a = await state();
rec("ضغطة CDP **موثوقة** والتركيز في الحقل (مرجع لا علاج)", b, a, "سلوك يوتيوب نفسه");

// ---- التقرير ---------------------------------------------------------------
for (const r of out) {
  const d = (x) => `مستوى ${x.volume}% · منزلق ${x.slider ?? "—"} · التركيز ${x.active}` +
    (x.boxValue !== null ? ` · الحقل "${x.boxValue}"` : "");
  const moved = r.before.volume !== r.after.volume || r.before.slider !== r.after.slider;
  const boxChanged = r.before.boxValue !== r.after.boxValue;
  console.log(`── ${r.t}`);
  console.log(`   قبل : ${d(r.before)}`);
  console.log(`   بعد : ${d(r.after)}`);
  console.log(`   ⇒ حرّك الصوت: ${moved ? "✅" : "❌"} · غيّر نصّ الحقل: ${boxChanged ? "🔴 نعم" : "✅ لا"} · ${r.note}\n`);
}
console.log(`النصّ الذي كُتب بضغطات موثوقة قبل الاختبار: "${typed.boxValue}"`);
console.log("");
chrome.kill(); process.exit(0);
