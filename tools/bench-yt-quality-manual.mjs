// قياس البند **#38ج**: لماذا لا يعمل ضبط الجودة بعد **التفعيل اليدوي** على يوتيوب؟
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**
//   node tools/bench-yt-quality-manual.mjs            # رابط يُستخرج حيّاً
//   node tools/bench-yt-quality-manual.mjs "https://…"
//
// ── السؤال المركزي (بنصّ المالك) ────────────────────────────────────────────
// **ما الذي يُحقن في التفعيل التلقائي ولا يُحقن في اليدوي، ومن يملك قرار الحقن
// في كل مسار؟** والقراءة أعطت مرشّحاً واحداً يُقاس هنا لا يُفترض:
//   · **التلقائي — المالك هو `manifest.json`:** سكربتان لا واحد. `content.js`
//     في العالم **المعزول** لكل الروابط، و`yt_quality_main.js` في العالم
//     **`MAIN`** ليوتيوب وحده، وكلاهما `document_start`.
//   · **اليدوي — المالك هو `popup.js`** (`activateOnCurrentPage`):
//     `chrome.scripting.executeScript({ files: ["content.js"] })` — **ملف واحد**،
//     و`world` الافتراضي **`ISOLATED`**.
//   ⇒ الفرضية المقاسة: في اليدوي **لا مستمع لـ`__vz_setq__` أصلاً**، فرسالة
//     `content.js` تذهب إلى لا أحد **بصمت**.
//
// ── الشواهد (قرار 26) — قبل أي رقم ──────────────────────────────────────────
//  · **موجب، وهو شرط المالك نصّاً:** تُثبت الأداة أنها ترى **ضبط جودة ناجحاً في
//    المسار التلقائي** — `result: "set"` **و`getPlaybackQuality()` يتغيّر فعلاً**
//    — قبل أن تحكم على فشل اليدوي. لم تره ⇒ **«لم يُقس»**، ولا حكم.
//  · **المدى قبل الحكم على السكون:** الجودة المطلوبة تُختار **مخالفةً للحالية**
//    من `getAvailableQualityLevels()`. فلو طُلبت الجودة الجارية لطبع
//    «لم يتغيّر» و«لا مكان للتغيّر» **النتيجة نفسها**.
//  · **والإعلان ليس المحتوى:** `applyQ` تُرجع `"ad"` على الإعلان، فيُنتظر
//    انقضاؤه بعلامة يوتيوب نفسها `ad-showing` لا بتخمين.
//
// ⚠️ **أمانة التمثيل:** الإرسال والاستماع يقعان في **عالم معزول حقيقي**
// (`Page.createIsolatedWorld`) لا في عالم الصفحة — لأن `content.js` سكربت محتوى،
// وقياسه من عالم الصفحة **يبالغ في تمثيله**. والسطر المُرسَل **نسخة حرفية** من
// `triggerYtQuality()` في `content.js:1165`.
//
// ⚠️ **نافذةُ هذا الشاهد: 1500ms** — وكلُّ «نجت» و«ثبت» فيه يعني
// **حتى 1500ms ولا شيء بعدها**. ⛔ **ولا يُقرأ أخضرُه ضماناً أبعد من ذلك.**
// **والواقعة التي أوجبت هذا السطر (2026-08-04):** `bench-adapter-live` و
// `bench-yt-adapter` قالا «✅ نجت القيمة» بنافذتَي **1500ms و1000ms**،
// **ومحوُ يوتيوب يقع عند 3000ms** ⇒ **فكان أخضرُهما خبراً عن النافذة لا عن
// النجاة** — صادقاً حرفياً وكاذباً بما يوحي به (شكل #90 في شاهدٍ نستشهد به).
// ⛔ **ولا تُطال النافذةُ بلا سببٍ مقيس** — تطويلٌ بلا سبب ثمنٌ بلا مقابل.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// ⛔ **#100 — كان يُنادى بلا استيراد** (2026-08-04): `killChrome` أُدخلت في
// `f6e8a33` (المُنهي الواحد، #83) **ولم تُحدَّث الملفّات التي تناديها** —
// **21 نداءً في ستّة، كلُّها في `finally`** ⇒ **رميةٌ حتميّة وكرومُ لا يُقتل**،
// **فالتسرّبُ الذي بُني #83 لإنهائه بقي حيّاً فيها.**
import { killChrome } from "./ext-harness.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_SRC = fs.readFileSync(path.join(ROOT, "yt_quality_main.js"), "utf8");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAIT_DONE_MS = 14000;   // أطول من سقف الاستطلاع في yt_quality_main (10s)

async function launch(port) {
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio", "--window-size=1280,800",
    "--autoplay-policy=no-user-gesture-required",
    `--user-data-dir=/tmp/vz-bench-q-${port}-${process.pid}`,
    `--user-agent=${UA}`, `--remote-debugging-port=${port}`, "about:blank"
  ], { stdio: "ignore" });
  for (let i = 0; i < 80; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/list`); return proc; }
    catch { await sleep(250); }
  }
  throw new Error("لم يستجب كروم");
}

async function attach(port) {
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let n = 0; const pend = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((r) => {
    const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params }));
  });
  return { ws, send };
}

async function evalMain(send, expression) {
  const r = await send("Runtime.evaluate", {
    expression, awaitPromise: true, returnByValue: true, allowUnsafeEvalBlockedByCSP: true
  });
  if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.text || "استثناء" };
  return r.result?.result?.value;
}

async function evalIso(send, ctxId, expression) {
  const r = await send("Runtime.evaluate", {
    expression, contextId: ctxId, awaitPromise: true, returnByValue: true
  });
  if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.text || "استثناء" };
  return r.result?.result?.value;
}

// حالة المشغّل — تُقرأ من عالم الصفحة لأن واجهة يوتيوب تعيش فيه وحده.
const PLAYER = `(() => {
  const p = document.querySelector("#movie_player");
  if (!p) return { player: false };
  const has = typeof p.getAvailableQualityLevels === "function";
  return {
    player: true, api: has,
    ad: !!(p.classList.contains("ad-showing") || p.classList.contains("ad-interrupting")),
    levels: has ? (p.getAvailableQualityLevels() || []) : [],
    current: typeof p.getPlaybackQuality === "function" ? p.getPlaybackQuality() : null,
    mainWorldScript: !!window.__vzQB
  };
})()`;

// مستمع النتيجة — نظير مستمع `content.js:1188`.
//
// ⚠️ **عيب رِكاز أُسقط قبل أن يُنشر رقمه (2026-07-31):** كان المستمع والإرسال في
// **عالم معزول** يُنشأ بـ`Page.createIsolatedWorld` — وهو الأمين تمثيلاً — لكن
// **سياقه يموت مع تنقّل يوتيوب الداخلي**، فترجع القراءة `undefined` **فتُقرأ
// «لا ردّ» وهي «لا أرى»**. وهما يطبعان الشيء نفسه. فانتقل السجلّ إلى عالم
// الصفحة **الذي لا يموت**، و**بقيت أمانة التمثيل مقيسة لا مفترضة**: فحص مستقلّ
// يُرسل من عالم معزول حقيقي ويشترط أن يلتقط السجلّ ردَّه — وهو المسار الذي
// يسلكه `content.js` فعلاً.
const RECORDER = `(() => {
  if (window.__vzDone) return true;
  window.__vzDone = [];
  window.addEventListener("__vz_setq_done__", (e) => window.__vzDone.push(e.detail || null));
  return true;
})()`;

// ⚠️ **نسخة حرفية من `triggerYtQuality()` (content.js:1165)** — لا تُعدَّل هنا وحدها.
const FIRE = (q) => `window.dispatchEvent(new CustomEvent("__vz_setq__", { detail: { q: ${JSON.stringify(q)} } })), "أُرسل"`;

// ── فحص قاطع لوجود المستمع، مستقلّ عن كل ما عداه ────────────────────────────
// **السؤال الحقيقي في #38ج هو «هل ثمّة مستمع؟» لا «هل نجح الضبط؟».** وقياسه
// بضبط جودة حقيقي يخلطه بأربعة أشياء ليست منه: جاهزية المشغّل · الإعلان ·
// الاستطلاع حتى 10s · و**ABR يوتيوب** الذي يغيّر الجودة من تلقائه فيكذب الشاهد
// في الاتجاهين.
// و`applyQ` تُرجع `"no-quality-requested"` **فوراً** على طلب فارغ — بلا مشغّل
// وبلا استطلاع. فوصول هذا الردّ **إثبات وجود المستمع**، وغيابه **نفيه**،
// في أجزاء من الثانية وبلا أي متغيّر ثالث.
const PROBE_LISTENER = `window.dispatchEvent(new CustomEvent("__vz_setq__", { detail: { q: "" } })), "أُرسل الفحص"`;

// ⚠️ **يُقال أي شرط سقط بالضبط، لا «لم يجهز» مبهمة.** أول تشغيلة طبعت
// «المشغّل لم يجهز (أو بقي إعلان)» على ذراعين، **والسببان لا يُفصلان بها** —
// فصار كل شرط يُطبع وحده. والتشغيل يُدفع دفعاً لأن `getAvailableQualityLevels`
// تبقى فارغة ما لم يبدأ المشغّل فعلاً.
async function waitPlayer(send) {
  let p = null;
  for (let i = 0; i < 90; i++) {
    p = await evalMain(send, PLAYER);
    if (p?.player && p.api && !p.ad && p.levels?.length) return { ok: true, p };
    if (i === 5 || i === 20) {
      await evalMain(send, `(() => { const v = document.querySelector("video");
        if (v) { v.muted = true; v.play().catch(() => {}); } return !!v; })()`);
    }
    await sleep(1000);
  }
  const why = !p?.player ? "لا #movie_player في الصفحة"
    : !p.api ? "المشغّل بلا واجهة getAvailableQualityLevels"
    : p.ad ? "بقي **إعلان** يعمل طوال الانتظار"
    : "المشغّل بلا مستويات جودة معلنة (لم يبدأ التشغيل)";
  return { ok: false, p, why };
}

// ── ذراع واحدة ──────────────────────────────────────────────────────────────
// mode: "auto"  = حقن `yt_quality_main.js` في MAIN عند **إنشاء المستند** (كالمانيفست)
//       "manual"= لا حقن إطلاقاً (كـ`popup.js` اليوم)
//       "late"  = لا حقن عند البدء، ثم **حقن متأخّر** بعد اكتمال الصفحة
async function arm(url, port, mode) {
  const row = { mode, url };
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port);
    ws = c.ws;
    const { send } = c;
    await send("Runtime.enable"); await send("Page.enable");
    if (mode === "auto") {
      // نظير إعلان المانيفست: عالم الصفحة، `document_start`
      await send("Page.addScriptToEvaluateOnNewDocument", { source: MAIN_SRC });
    }
    await send("Page.navigate", { url });
    await send("Page.bringToFront");

    const ready = await waitPlayer(send);
    row.before = ready.p;
    if (!ready.ok) { row.note = ready.why + " — لم يُقس"; return row; }

    if (mode === "late") {
      // نظير أصغر إصلاح ممكن: حقن السكربت في عالم الصفحة **بعد** تحميلها
      row.lateInject = await evalMain(send, `(() => { ${MAIN_SRC}\n; return !!window.__vzQB; })()`);
    }

    // السجلّ في عالم الصفحة — لا يموت مع تنقّل يوتيوب الداخلي
    await evalMain(send, RECORDER);

    // **فحص أمانة التمثيل، مقيس لا مفترض:** يُرسل من **عالم معزول حقيقي** (نظير
    // عالم سكربت المحتوى) ويُشترط أن يصل السجلَّ ردٌّ. سقوطه لا يُبطل القياس بل
    // يُطبع حدّاً صريحاً: «قِيس من عالم الصفحة».
    // ⚠️ `send` يُرجع رسالة CDP كاملة، فالشجرة تحت `result` — سقطت أول تشغيلة هنا.
    const ft = (await send("Page.getFrameTree")).result?.frameTree;
    let ctxId = null;
    if (ft?.frame?.id) {
      const iso = await send("Page.createIsolatedWorld",
        { frameId: ft.frame.id, worldName: "vz-content", grantUniveralAccess: false });
      ctxId = iso.result?.executionContextId || null;
    }
    row.isolated = !!ctxId;

    // **الفحص القاطع أولاً**: هل ثمّة مستمع أصلاً؟ من العالمين كليهما، فيُفصل
    // «لا مستمع» عن «المستمع موجود ورسالتنا لم تصله».
    for (const [key, how] of [["iso", "معزول"], ["main", "الصفحة"]]) {
      if (key === "iso" && !ctxId) continue;
      await evalMain(send, `window.__vzDone = []`);
      if (key === "iso") await evalIso(send, ctxId, PROBE_LISTENER);
      else await evalMain(send, PROBE_LISTENER);
      let got = null;
      const tp = Date.now();
      while (Date.now() - tp < 3000) {
        await sleep(200);
        const d = await evalMain(send, `window.__vzDone || null`);
        if (d?.length) { got = d[0]; break; }
      }
      row[`listener_${key}`] = { how, reply: got, ms: Date.now() - tp };
    }
    await evalMain(send, `window.__vzDone = []`);

    // **المدى**: تُطلب جودة **مخالفة للحالية**، وإلا لم يكن للتغيّر مكان
    const levels = (row.before.levels || []).filter((x) => x !== "auto");
    const want = levels.find((x) => x !== row.before.current) || levels[0] || null;
    row.requested = want;
    if (!want) { row.note = "لا مستويات جودة معلنة — لم يُقس"; return row; }
    row.rangeOk = want !== row.before.current;

    // الإرسال من **العالم المعزول** إن أمكن — وهو مسار `content.js` نفسه —
    // وإلا فمن عالم الصفحة، **ويُطبع أيّهما وقع**.
    row.firedFrom = ctxId ? "عالم معزول (كسكربت المحتوى)" : "عالم الصفحة (حدّ مُصرَّح به)";
    row.fired = ctxId ? await evalIso(send, ctxId, FIRE(want)) : await evalMain(send, FIRE(want));
    if (ctxId && row.fired !== "أُرسل") {
      // السياق مات قبل الإرسال ⇒ **لا يُقال «أُرسل»**، ويُعاد من عالم الصفحة
      row.firedFrom = "عالم الصفحة (سقط سياق العالم المعزول)";
      row.fired = await evalMain(send, FIRE(want));
    }

    // **استطلاع لا مهلة**: يُسجَّل **وقت وصول** الردّ، ويُحكَم عنده
    const t0 = Date.now();
    while (Date.now() - t0 < WAIT_DONE_MS) {
      await sleep(400);
      const done = await evalMain(send, `window.__vzDone || null`);
      if (done?.length) { row.doneAt = Date.now() - t0; row.done = done; break; }
    }
    if (!row.done) row.done = await evalMain(send, `window.__vzDone || null`);

    // ── تشخيص يفصل سببين لا يفرّق بينهما الصمت ────────────────────────────────
    // صمتٌ والسكربت **حاضر** (`__vzQB === true`) يحتمل معنيين: **لا مستمع أصلاً**
    // (سقط السكربت بعد رفع علمه) أو **المستمع موجود ورسالتنا لم تصله**. فيُعاد
    // الإرسال **من عالم الصفحة نفسه**: وصل ردٌّ ⇒ المستمع موجود والعلّة في مسار
    // الرسالة (**حدّ رِكاز**) · لم يصل ⇒ لا مستمع (**نتيجة**).
    if (!row.done?.length && row.before?.mainWorldScript) {
      row.probeFrom = "عالم الصفحة";
      row.probeFired = await evalMain(send, FIRE(want));
      const t1 = Date.now();
      while (Date.now() - t1 < WAIT_DONE_MS) {
        await sleep(400);
        const d = await evalMain(send, `window.__vzDone || null`);
        if (d?.length) { row.probeAt = Date.now() - t1; row.probe = d; break; }
      }
    }
    await sleep(1500);
    row.after = await evalMain(send, PLAYER);
    row.ok = true;
    return row;
  } catch (e) { row.note = "فشل: " + String(e?.message || e).slice(0, 70); return row; }
  finally { try { ws?.close(); } catch {} killChrome(proc); }
}

async function youtubeUrl(port) {
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port);
    ws = c.ws;
    await c.send("Runtime.enable"); await c.send("Page.enable");
    await c.send("Page.navigate", { url: "https://www.youtube.com/results?search_query=music" });
    await c.send("Page.bringToFront");
    for (let i = 0; i < 25; i++) {
      const href = await evalMain(c.send,
        `(document.querySelector('a#video-title, a[href^="/watch?v="]')||{}).href || null`);
      if (href) return href.split("&")[0];
      await sleep(1000);
    }
    return null;
  } catch { return null; }
  finally { try { ws?.close(); } catch {} killChrome(proc); }
}

// ---- التشغيل ---------------------------------------------------------------
let port = 9541;
const url = process.argv[2] || await youtubeUrl(port++);

console.log("\n=== #38ج — ضبط الجودة بعد التفعيل اليدوي · تشخيص ===");
console.log("المُرسَل: نسخة حرفية من triggerYtQuality() (content.js:1165)، من **عالم معزول**");

if (!url) {
  console.log("\n⚠️ تعذّر استخراج رابط يوتيوب حيّاً — **لم يُقس**\n");
  process.exit(0);
}
console.log(`الموقع (قرار 19): ${url}\n`);

const ARMS = [
  ["auto",   "التلقائي — MAIN عند document_start (كالمانيفست)"],
  ["manual", "اليدوي كما هو اليوم — content.js وحده (كـpopup.js)"],
  ["late",   "اليدوي + حقن MAIN **متأخّراً** — جدوى أصغر إصلاح"]
];

const rows = [];
for (const [mode, label] of ARMS) {
  process.stdout.write(`⏳ ${label} … `);
  const r = await arm(url, port++, mode);
  console.log(r.ok ? "تمّ" : (r.note || "لم يُقس"));
  r.label = label;
  rows.push(r);
}

let positiveWitness = false;
for (const r of rows) {
  console.log(`\n── ${r.label}`);
  if (!r.ok) { console.log(`   ⚠️ ${r.note || "لم يُقس"}`); continue; }
  console.log(`   سكربت العالم MAIN حاضر؟ : قبل=${r.before.mainWorldScript}` +
    (r.mode === "late" ? ` · بعد الحقن المتأخّر=${r.lateInject}` : ""));
  for (const k of ["iso", "main"]) {
    const L = r[`listener_${k}`];
    if (!L) continue;
    console.log(`   فحص المستمع (من عالم ${L.how.padEnd(6)}) : ` +
      (L.reply ? `✅ **موجود** — ردّ «${L.reply.result}» خلال ${L.ms}ms` : `❌ **لا مستمع** (لا ردّ خلال 3s)`));
  }
  console.log(`   الجودة قبل             : ${r.before.current} · المتاح ${JSON.stringify(r.before.levels)}`);
  console.log(`   طُلبت                  : ${r.requested}  ${r.rangeOk ? "✅ مخالفة للحالية (للمدى معنى)" : "⚠️ **مطابقة للحالية — لا مدى**"}`);
  console.log(`   الإرسال                : ${r.fired} — من ${r.firedFrom}`);
  console.log(`   ردّ __vz_setq_done__    : ${r.done?.length ? `${JSON.stringify(r.done)} بعد ${r.doneAt}ms` : `**لا ردّ خلال ${WAIT_DONE_MS / 1000}s**`}`);
  if (r.probeFrom) {
    console.log(`   إعادة إرسال تشخيصية    : من ${r.probeFrom} ⇒ ` +
      (r.probe?.length ? `${JSON.stringify(r.probe)} بعد ${r.probeAt}ms — **المستمع موجود، والعلّة في مسار الرسالة (حدّ رِكاز لا نتيجة)**`
                       : `**لا ردّ كذلك** — لا مستمع أصلاً رغم أن العلم مرفوع`));
  }
  console.log(`   الجودة بعد             : ${r.after?.current}`);

  const changed = r.after?.current && r.before?.current && r.after.current !== r.before.current;
  const said = r.done?.[0]?.result;
  // **كل حكم يمرّ ببوّابة: هل يسنده ما قاسته الأداة فعلاً؟** (قرار 26)
  if (!r.rangeOk) {
    console.log(`   ⇒ **لا يُستنبَط**: المطلوبة هي الجارية، فلا مكان للتغيّر`);
  } else if (r.mode === "auto") {
    // ⚠️ **الشاهد الموجب على السلسلة لا على ما يقرّره يوتيوب بعدها:** «set» تعني
    // أن المستمع وُجد ووجد المستوى **ونادى `setPlaybackQualityRange`** — وهو كل ما
    // نملكه. أما بقاء الجودة عندها فيقرّره **ABR يوتيوب** ونافذةُ العرض، ولا
    // يُشترط هنا لئلا يسقط الشاهد لسبب ليس من السلسلة. ويُطبع الرقمان معاً.
    positiveWitness = said === "set" || r.probe?.[0]?.result === "set";
    console.log(`   ⇒ ${positiveWitness ? "✅ **الشاهد الموجب مُستوفى**: ردٌّ «set» — المستمع موجود والسلسلة كاملة"
      : `❌ **الشاهد الموجب ساقط** (ردّ=${said}) ⇒ **لا يُحكم على اليدوي بهذه الأداة**`}`);
    console.log(`      وتغيّر الجودة فعلياً=${changed} — **يُقرأ ولا يُشترط**: ABR يوتيوب قد يعيدها، وهو خارج سلسلتنا`);
  } else if (!positiveWitness) {
    console.log(`   ⇒ **لا حكم**: الشاهد الموجب لم يُستوفَ في ذراع التلقائي`);
  } else if (!r.done?.length && !changed) {
    console.log(`   ⇒ **لا مستمع أصلاً**: الرسالة أُرسلت ولم يردّ أحد ولم تتغيّر الجودة — **فشل صامت**`);
  } else if (said === "set" && changed) {
    console.log(`   ⇒ **يعمل**: ردٌّ «set» وتغيّرت الجودة`);
  } else {
    console.log(`   ⇒ ردّ «${said}» وتغيّرت=${changed} — **يُقرأ ولا يُفسَّر هنا**`);
  }
}
console.log("");
process.exit(0);
