// قياس البند **#34**: لماذا لا يقع التقديم ولا الإرجاع في البثّ المباشر،
// و**هل يختلف الحال داخل نافذة DVR وخارجها؟** — الفرق بينهما هو البند نفسه.
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة، مثل بقية أدوات bench هنا. **لا يُشحن.**
//
//   node tools/bench-live-seek.mjs                 # عادي (شاهد) + يوتيوب مباشر + تويتش
//   node tools/bench-live-seek.mjs "https://…"     # رابط واحد
//
// ── الشواهد (قرار 26) — قبل أي رقم ──────────────────────────────────────────
//  · **موجب، وهو شرط المالك نصّاً:** الأداة تُشغّل نسخة `seek()` على **فيديو
//    عادي** أولاً ويجب أن ترى **تقديماً ناجحاً**. لم تره ⇒ الأداة عمياء ⇒
//    **«لم يُقس»**، ولا يُحكم على فشلٍ في البثّ بأداة لم تُثبت أنها ترى نجاحاً.
//  · **سالب، وهو الخاصّ بهذا البند:** `currentTime` في البثّ **يزحف وحده** مع
//    التشغيل. فتُقاس أولاً **مرحلة بلا أي تقديم** بنفس المدّة، ويُطرح زحفها.
//    بدونه يُخلط **تقدّم التشغيل** بـ**تقديمنا**، ويطبعان الرقم نفسه.
//  · **والمدى يُثبت قبل الحكم على السكون:** تُقرأ نافذة `seekable` فعلاً. نافذة
//    صفرية تعني **لا مكان للتقديم**، وهي غير «رفضنا التقديم» — ويُفرّق بينهما.
//
// ⚠️ **الدالة أدناه نسخة طبق الأصل من `seek()` في `content.js:2380-2385`**،
// مزيدة **بإبلاغ الفرع الذي سلكته** وحده. لا تُعدَّل هنا وحدها: القياس على منطق
// مغاير لا يقيس شيئاً.
import { spawn } from "node:child_process";
// ⛔ **#100 — كان يُنادى بلا استيراد** (2026-08-04): `killChrome` أُدخلت في
// `f6e8a33` (المُنهي الواحد، #83) **ولم تُحدَّث الملفّات التي تناديها** —
// **21 نداءً في ستّة، كلُّها في `finally`** ⇒ **رميةٌ حتميّة وكرومُ لا يُقتل**،
// **فالتسرّبُ الذي بُني #83 لإنهائه بقي حيّاً فيها.**
import { killChrome } from "./ext-harness.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DRIFT_MS = 4000;   // مرحلة الزحف: بلا أي تقديم
const IN_DVR   = -30;    // داخل النافذة إن كانت أوسع من 30s
const OUT_DVR  = -7200;  // ساعتان: خارج أي نافذة DVR واقعية
const FORWARD  = +30;

async function launch(port) {
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    `--user-data-dir=/tmp/vz-bench-seek-${port}-${process.pid}`,
    `--user-agent=${UA}`, `--remote-debugging-port=${port}`, "about:blank"
  ], { stdio: "ignore" });
  for (let i = 0; i < 80; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/list`); return proc; }
    catch { await sleep(250); }
  }
  throw new Error("لم يستجب كروم");
}

async function attach(port, url) {
  const tab = await (await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
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

async function evalIn(send, expression) {
  const r = await send("Runtime.evaluate", {
    expression, awaitPromise: true, returnByValue: true, allowUnsafeEvalBlockedByCSP: true
  });
  if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.text || "استثناء" };
  return r.result?.result?.value;
}

// أكبر عنصر مساحةً — ويُطبع المسح كاملاً فلا يُخفى ما استُبعد.
const FIND = `const pick = () => {
  let best = null, area = -1;
  for (const v of document.querySelectorAll("video")) {
    const r = v.getBoundingClientRect();
    const a = r.width * r.height;
    if (a > area) { area = a; best = v; }
  }
  return best;
};`;

// شكل العنصر: **المدى يُقرأ لا يُفترض**.
//
// ⚠️ **عيبا رِكاز أُسقطا قبل أن يُنشر رقمهما (2026-07-31)، والاثنان كانا سيصيران
// حقيقة منشورة:**
//  (١) **`.ytp-live-badge` موجود في شجرة يوتيوب دائماً** ولو كان الفيديو غير حيّ،
//      فطبع «شارة مباشر ✅» على **إعلان مدّته 30s**، و«لا» على تويتش **وهو حيّ**
//      فعلاً — مِجَسّ مقلوب. الحيّ يُقرأ الآن من **`getVideoData().isLive`** عند
//      يوتيوب، ومن `duration === Infinity` مع تقدّم `currentTime` عند غيره،
//      **ويُطبع الدليل لا الحكم**.
//  (٢) **`seekable.end = 1073741824` (2^30) ليست نافذة DVR** بل تمثيل كروم
//      لبثّ MSE غير محدود. فطبعت الأداة «نافذة 1073741824s متاحة فعلاً» —
//      **حكم لا يسنده قياسها** (قرار 26). صارت تُوسم `sentinel` و**لا تُحسب
//      نافذةً**، والنافذة الحقيقية تُثبَت **بالتجربة** لا بالقراءة: تجاوُز الحارس.
const SENTINEL = 1 << 29;
const SHAPE = `(() => { ${FIND} const v = pick(); if (!v) return null;
  const rng = (tr) => { const o = []; for (let i = 0; i < tr.length; i++)
    o.push([+tr.start(i).toFixed(2), +tr.end(i).toFixed(2)]); return o; };
  const s = rng(v.seekable), b = rng(v.buffered);
  const end = s.length ? s[s.length - 1][1] : 0;
  const sentinel = end >= ${SENTINEL};
  const mp = document.querySelector("#movie_player");
  let ytLive = null, ytAd = null;
  try { ytLive = mp && mp.getVideoData ? !!mp.getVideoData().isLive : null; } catch (e) { ytLive = null; }
  try { ytAd = mp ? mp.classList.contains("ad-showing") : null; } catch (e) { ytAd = null; }
  return {
    duration: String(v.duration), durationFinite: isFinite(v.duration),
    currentTime: +v.currentTime.toFixed(2), paused: v.paused, readyState: v.readyState,
    seekable: s, buffered: b, sentinel,
    dvr: sentinel ? null : (s.length ? +(end - s[0][0]).toFixed(2) : 0),
    w: Math.round(v.getBoundingClientRect().width),
    videos: document.querySelectorAll("video").length,
    ytLive, ytAd
  };
})()`;

// **تجاوُز الحارس** — وهو السؤال الحاسم: لو لم يخرج `seek()` عند `duration`،
// هل كان التقديم **يقع**؟ يُكتب `currentTime` مباشرةً بلا أي حارس، ويُقاس الأثر.
// **هذا ما يقرّر «أصغر إصلاح ممكن»، ولا يُستنتج بلا قياس.**
const BYPASS = (delta) => `(() => { ${FIND} const v = pick(); if (!v) return null;
  const before = v.currentTime;
  try { v.currentTime = before + (${delta}); }
  catch (e) { return { threw: String(e && e.name || e).slice(0, 40), before: +before.toFixed(2) }; }
  return { before: +before.toFixed(2), wrote: +(before + (${delta})).toFixed(2) };
})()`;

// ⚠️ **نسخة طبق الأصل من `seek()` (content.js:2380-2385)** + إبلاغ الفرع وحده.
const SEEK = (delta) => `(() => { ${FIND}
  const video = pick();
  const deltaSec = ${delta};
  if (!video) return { branch: "لا فيديو" };
  // بعض الستريمات live ما تدعم seek
  if (isNaN(video.duration) || !isFinite(video.duration)) {
    return { branch: "خرج عند حارس duration", duration: String(video.duration),
             currentTime: +video.currentTime.toFixed(2) };
  }
  const before = video.currentTime;
  video.currentTime = Math.max(0, Math.min(before + deltaSec, video.duration));
  return { branch: "طبّق", before: +before.toFixed(2),
           wrote: +Math.max(0, Math.min(before + deltaSec, video.duration)).toFixed(2) };
})()`;

const NOW = `(() => { ${FIND} const v = pick();
  return v ? { t: +v.currentTime.toFixed(2), paused: v.paused } : null; })()`;

// ⚠️ **يُنتظر انقضاء الإعلان قبل أي قراءة.** أول تشغيلة قاست **إعلاناً مدّته
// 30s** وحسبته «فيديو عادي»، و**إعلاناً مدّته 15s** وحسبته «بثّاً مباشراً» —
// فخرج حكم «التقديم يقع في البثّ» **عن عنصر ليس بثّاً أصلاً**. العنصر المقيس
// يُثبَت قبل أن يُقاس.
async function waitPlayer(send) {
  let s = null;
  for (let i = 0; i < 75; i++) {
    s = await evalIn(send, SHAPE);
    if (s && s.readyState >= 1 && s.w > 0 && s.ytAd !== true) return { ok: true, shape: s };
    await sleep(1000);
  }
  return { ok: false, shape: s, adStuck: s?.ytAd === true };
}

async function measure(name, url, port) {
  const row = { name, url, ok: false };
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port, url);
    ws = c.ws;
    const { send } = c;
    await send("Runtime.enable"); await send("Page.enable");
    await send("Page.bringToFront"); // بلا هذا لا يبدأ يوتيوب تشغيلاً في headless

    const ready = await waitPlayer(send);
    row.shape = ready.shape;
    if (!ready.ok) {
      row.note = ready.adStuck
        ? "بقي إعلان يعمل طوال الانتظار — **لم يُقس** (والعنصر المقيس يجب أن يكون المحتوى لا الإعلان)"
        : ready.shape
          ? `المشغّل لم يبدأ (readyState=${ready.shape.readyState} · عرض ${ready.shape.w}) — لم يُقس`
          : "لا <video> في الصفحة — لم يُقس";
      return row;
    }

    // ── الشاهد السالب: زحف `currentTime` **بلا أي تقديم** ────────────────────
    const t0 = await evalIn(send, NOW);
    await sleep(DRIFT_MS);
    const t1 = await evalIn(send, NOW);
    row.drift = (t0 && t1) ? +(t1.t - t0.t).toFixed(2) : null;
    row.paused = t1?.paused;

    // ── التقديم داخل النافذة وخارجها، وإلى الأمام ────────────────────────────
    row.trials = [];
    for (const [label, delta] of [["داخل النافذة", IN_DVR], ["خارج أي نافذة", OUT_DVR], ["إلى الأمام", FORWARD]]) {
      const before = await evalIn(send, NOW);
      const res = await evalIn(send, SEEK(delta));
      await sleep(900);
      const after = await evalIn(send, NOW);
      const moved = (before && after) ? +(after.t - before.t).toFixed(2) : null;
      // **الأثر الصافي**: ما تحرّك مطروحاً منه الزحف الطبيعي في المدّة نفسها.
      const natural = row.drift == null ? 0 : row.drift * (900 / DRIFT_MS);
      row.trials.push({ label, delta, res, moved,
                        net: moved == null ? null : +(moved - natural).toFixed(2) });
    }

    // ── تجاوُز الحارس: هل كان التقديم سيقع لولا الخروج عند `duration`؟ ───────
    row.bypass = [];
    for (const [label, delta] of [["تجاوُز الحارس −30s", IN_DVR], ["تجاوُز الحارس +30s", FORWARD]]) {
      const before = await evalIn(send, NOW);
      const res = await evalIn(send, BYPASS(delta));
      await sleep(900);
      const after = await evalIn(send, NOW);
      const moved = (before && after) ? +(after.t - before.t).toFixed(2) : null;
      const natural = row.drift == null ? 0 : row.drift * (900 / DRIFT_MS);
      row.bypass.push({ label, delta, res, moved,
                        net: moved == null ? null : +(moved - natural).toFixed(2) });
    }
    row.shapeAfter = await evalIn(send, SHAPE);
    row.ok = true;
    return row;
  } catch (e) {
    row.note = "فشل القياس: " + String(e?.message || e).slice(0, 80);
    return row;
  } finally {
    try { ws?.close(); } catch {}
    killChrome(proc);
  }
}

// روابط تُستخرج حيّاً: رابط مثبَّت في الملف يموت فيصير القياس كاذباً.
// ⚠️ **تُرجَع عدّة مرشّحات لا واحداً:** أول تشغيلة سقط فيها البثّ المباشر لأن
// **إعلاناً عمل طوال الانتظار** على المرشّح الوحيد. مرشّح واحد يجعل «لم يُقس»
// حكماً على المصادفة لا على الموقع.
async function pickFrom(port, listUrl, sel, count = 4) {
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port, listUrl);
    ws = c.ws;
    await c.send("Runtime.enable"); await c.send("Page.bringToFront");
    for (let i = 0; i < 25; i++) {
      const hrefs = await evalIn(c.send,
        `[...document.querySelectorAll(${JSON.stringify(sel)})].map((a) => a.href).filter(Boolean).slice(0, ${count})`);
      if (hrefs?.length) return hrefs.map((h) => h.split("&")[0]);
      await sleep(1000);
    }
    return [];
  } catch { return []; }
  finally { try { ws?.close(); } catch {} killChrome(proc); }
}

// ---- التشغيل ---------------------------------------------------------------
let port = 9491;
const argUrl = process.argv[2];

const targets = [];
if (argUrl) {
  targets.push({ name: new URL(argUrl).host, urls: [argUrl] });
} else {
  // (1) **الشاهد الموجب**: فيديو عادي — يجب أن يُرى فيه تقديم ناجح.
  targets.push({ name: "فيديو عادي (شاهد موجب)",
    urls: await pickFrom(port++, "https://www.youtube.com/results?search_query=music",
                         'a#video-title, a[href^="/watch?v="]') });
  // (2) بثّ يوتيوب مباشر — مرشّح الحيّ `sp=EgJAAQ%3D%3D`، وعدّة مرشّحات لأجل الإعلانات
  targets.push({ name: "يوتيوب مباشر 24/7",
    urls: await pickFrom(port++,
      "https://www.youtube.com/results?search_query=24%2F7+live&sp=EgJAAQ%253D%253D",
      'a#video-title, a[href^="/watch?v="]') });
  // (3) قناة تويتش مباشرة
  targets.push({ name: "تويتش مباشر",
    urls: await pickFrom(port++, "https://www.twitch.tv/directory/all",
      'a[data-a-target="preview-card-image-link"], a[href^="/"][class*="ScCoreLink"]') });
}

console.log("\n=== #34 — التقديم في البثّ المباشر · تشخيص ===");
console.log("النسخة المقيسة: طبق الأصل من seek() في content.js:2380-2385");
console.log(`الشاهد السالب: زحف currentTime بلا تقديم على مدى ${DRIFT_MS / 1000}s · والأثر الصافي = المتحرّك − الزحف\n`);

const rows = [];
for (const t of targets) {
  if (!t.urls?.length) { rows.push({ name: t.name, url: "—", note: "تعذّر استخراج رابط حيّ — لم يُقس" }); continue; }
  let r = null;
  const tried = [];
  for (const url of t.urls) {
    process.stdout.write(`⏳ ${t.name} — ${url.slice(0, 54)} … `);
    r = await measure(t.name, url, port++);
    console.log(r.ok ? "تمّ" : (r.note || "لم يُقس"));
    if (r.ok) break;
    tried.push(`${url.slice(-11)}: ${r.note}`);
  }
  if (r && !r.ok) r.tried = tried;   // **كل مرشّح سقط يُطبع بسببه، ولا يُطوى**
  rows.push(r);
}

for (const r of rows) {
  console.log(`\n── ${r.name}`);
  console.log(`   الرابط (قرار 19): ${r.url}`);
  if (!r.ok) {
    console.log(`   ⚠️ ${r.note || "لم يُقس"}`);
    for (const t of r.tried || []) console.log(`      · ${t}`);
    continue;
  }
  const s = r.shape;
  const live = s.ytLive === true || (!s.durationFinite && r.drift > 1);
  const liveWhy = s.ytLive === true ? "getVideoData().isLive = true"
    : s.ytLive === false ? "getVideoData().isLive = false"
    : !s.durationFinite ? `duration=Infinity و currentTime يتقدّم ${r.drift}s` : "duration منتهٍ";
  console.log(`   حيّ؟            : ${live ? "✅ نعم" : "❌ لا"}  — **الدليل**: ${liveWhy} · إعلان=${s.ytAd}`);
  console.log(`   duration        : ${s.duration}  ${s.durationFinite ? "(منتهٍ)" : "(**غير منتهٍ**)"}`);
  console.log(`   seekable        : ${JSON.stringify(s.seekable)}` +
    (s.sentinel ? `   ⚠️ **قيمة حدّية (2^30) لا نافذة — لا تُحسب DVR**` : `   ⇒ **نافذة ${s.dvr}s**`));
  console.log(`   buffered        : ${JSON.stringify(s.buffered)}`);
  console.log(`   الزحف بلا تقديم : ${r.drift}s على ${DRIFT_MS / 1000}s  ← **الشاهد السالب**`);
  for (const t of [...r.trials, ...(r.bypass || [])]) {
    console.log(`   ${t.label.padEnd(18)} (${t.delta > 0 ? "+" : ""}${t.delta}s): ` +
      (t.res?.branch ? `الفرع «${t.res.branch}»` : (t.res?.threw ? `رمى ${t.res.threw}` : "كتابة مباشرة")) +
      (t.res?.duration ? ` · duration=${t.res.duration}` : "") +
      `  ⇒ تحرّك ${t.moved}s · **الصافي ${t.net}s**`);
  }
  // **كل حكم يمرّ ببوّابة: هل يسنده ما قاسته الأداة فعلاً؟** (قرار 26)
  const guard = r.trials.every((t) => t.res?.branch === "خرج عند حارس duration");
  const applied = r.trials.some((t) => t.res?.branch === "طبّق");
  const netMoved = (arr) => (arr || []).some((t) => t.net != null && Math.abs(t.net) > 2);
  if (!live) {
    console.log(`   ⇒ **ليس بثّاً حيّاً — لا يُحكم منه على البثّ إطلاقاً.** ` +
      (applied && netMoved(r.trials) ? "وقيمته الوحيدة أنه **شاهد موجب**: الأداة ترى تقديماً ناجحاً." : ""));
  } else if (guard && (r.bypass || []).every((b) => b.net != null && Math.abs(b.net) > 2)) {
    console.log(`   ⇒ **الحارس وحده هو المانع**: بتجاوُزه تحرّك ${r.bypass.map((b) => b.net + "s").join(" · ")} صافياً في الاتجاهين`);
  } else if (guard && netMoved(r.bypass)) {
    // ⚠️ **حكم مضبوط بحدّه:** تجاوُز الحارس حرّك **اتجاهاً دون اتجاه**، فلا يُقال
    // «الحارس وحده هو المانع» — الاتجاه الذي لم يتحرّك **له مانع آخر غير مقيس**.
    const ok = r.bypass.filter((b) => Math.abs(b.net) > 2).map((b) => b.label).join(" · ");
    const no = r.bypass.filter((b) => Math.abs(b.net) <= 2).map((b) => `${b.label} (${b.net}s)`).join(" · ");
    console.log(`   ⇒ **الحارس مانعٌ في اتجاه لا في الاتجاهين**: تجاوُزه حرّك «${ok}» ولم يحرّك «${no}»`);
    console.log(`      ⇒ **ما لم يتحرّك بالتجاوُز لا يُنسب منعه إلى الحارس** — مانعه غير مقيس`);
  } else if (guard && !netMoved(r.bypass)) {
    console.log(`   ⇒ **الحارس خرج، والتجاوُز لم يحرّك شيئاً** ⇒ المنع **ليس حارسنا وحده** — ولا يُنسب إليه`);
  } else if (applied) {
    console.log(`   ⇒ طبّق — والصافي مطبوع أعلاه، **يُقرأ ولا يُفسَّر هنا**`);
  }
}
console.log("");
process.exit(0);
