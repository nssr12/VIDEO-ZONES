// قياس كِك قبل كتابة سطر واحد له (#60 · قرار 25). أربعة أسئلة بترتيبها:
//   ١. **والعنصر مخفيّ (0×0) كما هو في السكون:** هل تُحرّك `keydown` ArrowUp/Down
//      المُرسَلة **إليه** قيمةَ `aria-valuenow` والصوتَ المسموع؟ `role=slider`
//      كثيراً ما يستجيب للأسهم — وهذا أنظف ما يمكن: **بلا محاكاة تمرير ولا سحب**.
//   ٢. **فشل الأول:** هل يكفي `pointerover`/`mouseenter` على **أب المجموعة** ليصير
//      مقاسه غير صفريّ ثم يستجيب؟
//   ٣. **وفي الحالتين:** هل تنجو القيمة بعد كتم المضيف وفكّه؟ **وما دلالة الكتم
//      عند كِك** — ضبط المستوى وهو مكتوم يفكّه كتويتش أم يبقى مكتوماً كيوتيوب؟
//      **لا يُفترض على أيٍّ منهما، فقد اختلفا.**
//   ٤. **ولا يُربط `aria-valuenow` بـ`video.volume` ولا تُشتقّ معادلة بينهما** —
//      القيمتان لا تتناسبان، والعمليات نسبية فلا نحتاجها. تُطبعان **جنباً إلى جنب**.
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**
//   node tools/bench-kick-slider.mjs ["https://kick.com/<channel>"]
//
// ⚠️ **المنزلق يُطلب بالدور والوسم داخل حاوية المشغّل** — لا صنف Tailwind ولا
// اسم مولَّد. و`aria-label=Volume` **نصّ إنجليزيّ قد يُترجَم**، فهو **مرجّح لا
// حاكم**: الأساس الدور داخل الحاوية.
//
// ⚠️ ولا ترشيح بالمرئيّة: منزلق كِك **0×0 دائماً** في السكون (أبوه
// `…group-hover/volume:flex hidden`)، والترشيح بالمرئيّة هو ما أعمى المِجَسّ عنه.
import { spawn } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const CDP = 9601;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
  "--autoplay-policy=no-user-gesture-required", `--user-data-dir=/tmp/vz-kick-${process.pid}`,
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

// قناة حيّة تُستخرج حيّاً — القنوات تتغيّر
let URL_ = process.argv[2];
if (!URL_) {
  const s = await open("https://kick.com/browse");
  for (let i = 0; i < 30; i++) {
    const h = await s.ev(`(() => {
      const bad = /^\\/(browse|categories|following|search|about|help|terms|privacy|signup|login|clips|category|subscriptions|messages)/i;
      for (const a of document.querySelectorAll('a[href^="/"]')) {
        const x = a.getAttribute("href");
        if (x && /^\\/[A-Za-z0-9_-]{3,25}$/.test(x) && !bad.test(x)) return "https://kick.com" + x;
      }
      return null; })()`);
    if (h) { URL_ = h; break; }
    await sleep(1500);
  }
  s.ws.close();
}
if (!URL_) { console.log("⚠️ تعذّر إيجاد قناة كِك — لم يُقس"); chrome.kill(); process.exit(1); }

const p = await open(URL_);
await p.send("Runtime.enable"); await p.send("Page.enable"); await p.send("Page.bringToFront");
let ready = false;
for (let i = 0; i < 60; i++) {
  if (await p.ev(`(() => { const v = document.querySelector("video");
      return !!v && v.readyState >= 1 && v.getBoundingClientRect().width > 0; })()`)) { ready = true; break; }
  await sleep(1000);
}
if (!ready) { console.log(`⚠️ مشغّل كِك لم يبدأ على ${URL_} — لم يُقس`); chrome.kill(); process.exit(1); }

// ── إيجاد المنزلق: **الدور داخل حاوية المشغّل**، والوسم مرجّح لا حاكم ────────
await p.ev(`
  window.__ours = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (typeof el.closest === "function" && el.closest(".vzWrap")) return true;
    const c = typeof el.className === "string" ? el.className : "";
    return /\\bvz[A-Z]/.test(c) || /^vz_/.test(el.id || "");
  };
  window.__slider = () => {
    const v = document.querySelector("video");
    if (!v) return null;
    // حاوية المشغّل: أقرب سلف يحوي الفيديو **وعنصر منزلق** معاً
    const cands = [...document.querySelectorAll('[role="slider"]')].filter((el) => !window.__ours(el));
    let best = null, bestDepth = 99;
    for (const el of cands) {
      let n = v, depth = 0;
      while (n && depth < 10) {
        if (n.contains && n.contains(el)) {
          const label = (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "");
          // الوسم **يرجّح** فقط: نصّ إنجليزي قد يُترجَم، فلا يكون شرطاً وحيداً
          const score = depth - (/volume|صوت/i.test(label) ? 3 : 0);
          if (score < bestDepth) { bestDepth = score; best = el; }
          break;
        }
        n = n.parentElement; depth++;
      }
    }
    return best;
  };
  window.__read = () => {
    const el = window.__slider(); const v = document.querySelector("video");
    const r = el ? el.getBoundingClientRect() : null;
    return {
      found: !!el,
      now: el ? el.getAttribute("aria-valuenow") : null,
      min: el ? el.getAttribute("aria-valuemin") : null,
      max: el ? el.getAttribute("aria-valuemax") : null,
      label: el ? (el.getAttribute("aria-label") || "") : null,
      w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null,
      muted: v.muted, volume: Math.round(v.volume * 1000) / 10
    };
  };
  "ok"`);

// ⚠️ **تمرير المؤشّر فوق المشغّل قبل البحث**: كِك لا يُركّب شريط تحكّمه إلا
// بتفاعل. وبلا هذا يكون «لم يُوجد» أثرَ سكونٍ لا حقيقةَ غياب (قرار 26).
{
  const r = await p.ev(`(() => { const v = document.querySelector("video"); const b = v.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height * 0.9) }; })()`);
  for (let i = 0; i < 6; i++) {
    await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: r.x + i * 3, y: r.y });
    await sleep(250);
  }
  await sleep(1200);
}

// تشخيص: يفصل «لا منزلق في الصفحة» عن «منزلق خارج حاويتي»
const diag = await p.ev(`(() => {
  const all = [...document.querySelectorAll("*")];
  const roles = all.filter((el) => el.getAttribute && el.getAttribute("role") === "slider");
  const arias = all.filter((el) => el.getAttribute && el.getAttribute("aria-valuenow") !== null);
  const mute = all.find((el) => /mute|كتم/i.test((el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title"))) || ""));
  return { عناصر: all.length, "role=slider": roles.length, "aria-valuenow": arias.length,
    "زرّ كتم": !!mute,
    عيّنة: roles.slice(0, 3).map((el) => (el.getAttribute("aria-label") || "بلا وسم") + "/" +
      (el.getAttribute("aria-valuenow") ?? "—")) };
})()`);

const read = () => p.ev("window.__read()");
const shape0 = await read();
console.log(`\n  تشخيص الشجرة: ${JSON.stringify(diag)}`);

const fakeKeyTo = (target, key) => p.ev(`(() => {
  const el = ${target};
  if (!el) return "لا هدف";
  for (const type of ["keydown", "keyup"]) {
    el.dispatchEvent(new KeyboardEvent(type, { key: ${JSON.stringify(key)}, code: ${JSON.stringify(key)},
      keyCode: ${key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 : 77},
      which: ${key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 : 77},
      bubbles: true, cancelable: true, composed: true }));
  }
  return "أُرسل";
})()`);

const hoverGroup = () => p.ev(`(() => {
  const el = window.__slider();
  if (!el) return "لا منزلق";
  let n = el, fired = 0;
  for (let i = 0; i < 5 && n; i++) {
    for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter", "mousemove"]) {
      n.dispatchEvent(new MouseEvent(type, { bubbles: type !== "pointerenter" && type !== "mouseenter", cancelable: true }));
    }
    fired++;
    n = n.parentElement;
  }
  return "أُرسل إلى " + fired + " من الآباء";
})()`);

async function realKey(key, code, vk) {
  for (const type of ["keyDown", "keyUp"]) {
    await p.send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  }
  await sleep(700);
}

const rows = [];
const step = async (label, fn) => { if (fn) await fn(); await sleep(700); const s = await read(); rows.push({ label, s }); return s; };
// ⚠️ يُطبعان **جنباً إلى جنب بلا ربط**: لا معادلة بين aria-valuenow و video.volume
const fmt = (s) => `aria=${String(s.now).padStart(4)} [${s.min}..${s.max}] · مقاس ${s.w}×${s.h}` +
  ` · muted ${s.muted ? "نعم" : "لا "} · video.volume ${String(s.volume).padStart(5)}%`;

console.log(`\n=== منزلق كِك — ${URL_} ===\n`);
if (!shape0.found) {
  console.log("  ⚠️ لم يُعثر على [role=slider] داخل حاوية المشغّل — لم يُقس");
  chrome.kill(); process.exit(1);
}
console.log(`  وُجد: وسم="${shape0.label}" · aria=${shape0.now} [${shape0.min}..${shape0.max}] · مقاس ${shape0.w}×${shape0.h}\n`);

const a0 = await step("خطّ الأساس", null);
const a0b = await step("قراءة ثانية بلا فعل (شاهد سالب)", null);
const negativeOk = a0.now === a0b.now && a0.muted === a0b.muted;

// ① الأسهم إلى المنزلق نفسه وهو مخفيّ
const q1a = await step("① ArrowDown ×2 **إلى المنزلق** وهو مخفيّ (إرسالنا)",
  async () => { await fakeKeyTo("window.__slider()", "ArrowDown"); await fakeKeyTo("window.__slider()", "ArrowDown"); });
const q1ok = q1a.now !== a0b.now;

// ② محاكاة التمرير على المجموعة ثم الأسهم
const q2hover = await step("② بعد pointerover/mouseenter على الآباء", () => hoverGroup());
const q2keys = await step("② ثم ArrowDown ×2 إلى المنزلق", async () => {
  await fakeKeyTo("window.__slider()", "ArrowDown"); await fakeKeyTo("window.__slider()", "ArrowDown");
});
const q2ok = q2keys.now !== q2hover.now;

// ③ دلالة الكتم — لا تُفترض على يوتيوب ولا على تويتش
const mutedNow = await step("③ كتم بـ `m` **موثوقة**", () => realKey("m", "KeyM", 77));
const afterKeysWhileMuted = await step("③ ArrowUp ×2 إلى المنزلق **وهو مكتوم**", async () => {
  await fakeKeyTo("window.__slider()", "ArrowUp"); await fakeKeyTo("window.__slider()", "ArrowUp");
});
const unmutedAgain = await step("③ فكّ الكتم بـ `m` موثوقة", () => realKey("m", "KeyM", 77));
const fakeM = await step("③ `m` **من إرسالنا** على الفيديو", () => fakeKeyTo("document.querySelector('video')", "m"));

for (const r of rows) console.log(`  ${fmt(r.s)}   ${r.label}`);

console.log(`\n--- شاهدا قرار 26 ---`);
console.log(`  سالب — قراءتان بلا فعل متطابقتان : ${negativeOk ? "✅" : "❌"}`);
console.log(`  موجب — أيّ طريق حرّك aria         : ${q1ok || q2ok ? "✅" : "❌ **لم يتحرّك بأيّ طريق** — لا حكم على الباقي"}`);

console.log(`\n--- الأجوبة ---`);
console.log(`  ① الأسهم إلى المنزلق وهو مخفيّ : ${q1ok ? "✅ **يستجيب**" : "❌ لا يستجيب"}  (${a0b.now} ⇒ ${q1a.now})`);
console.log(`  ② محاكاة التمرير ثم الأسهم      : المقاس ${q2hover.w}×${q2hover.h}` +
  ` · ${q2ok ? "✅ **يستجيب**" : "❌ لا يستجيب"}  (${q2hover.now} ⇒ ${q2keys.now})`);
console.log(`  ③ دلالة الكتم عند كِك           : الكتم ⇒ aria=${mutedNow.now} muted=${mutedNow.muted}` +
  ` · أسهم وهو مكتوم ⇒ aria=${afterKeysWhileMuted.now} muted=${afterKeysWhileMuted.muted}` +
  ` ⇒ ${afterKeysWhileMuted.muted ? "**يبقى مكتوماً (كيوتيوب)**" : "**يفكّ الكتم (كتويتش)**"}`);
console.log(`     ونجاة القيمة بعد الفكّ        : ${afterKeysWhileMuted.now} ⇒ ${unmutedAgain.now}` +
  ` ${afterKeysWhileMuted.now === unmutedAgain.now ? "✅ نجت" : "❌ تغيّرت"}`);
console.log(`     ومفتاح m من إرسالنا           : muted ${unmutedAgain.muted} ⇒ ${fakeM.muted} ${unmutedAgain.muted !== fakeM.muted ? "✅ يؤثّر" : "❌ لا يؤثّر"}`);
console.log("");
chrome.kill(); process.exit(0);
