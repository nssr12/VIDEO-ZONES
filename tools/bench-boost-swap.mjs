// قياس البند **61ب**: كم تبلغ قفزة تبديل عنصر الفيديو **على موقع حقيقي**؟
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة، مثل بقية أدوات bench هنا. **لا يُشحن.**
//
//   node tools/bench-boost-swap.mjs                 # يوتيوب + d.tube
//   node tools/bench-boost-swap.mjs "https://…"     # رابط واحد
//
// **سبب وجوده:** قفزة 61ب مقيسة على **رِكاز محلي** وحده (`1.0606 ⇒ 1.8631`، ×1.76)،
// وقياس #60 يقول إن يوتيوب **يعيد فرض نموذج مستواه**. فقد يكون العنصر الجديد عند
// مستوى المضيف لا عند 1.0 الافتراضية ⇒ **القفزة أصغر بكثير أو معدومة**. الرقم
// الميداني هو ما ينقص، ولا خيار يُحسم قبله (قرار المالك 2026-07-31).
//
// ── ما يُقاس بالضبط ─────────────────────────────────────────────────────────
// `reapplyBoostTo` ينقل **الكسب** إلى العنصر الجديد ولا ينقل `video.volume`
// (content.js:300-309). والكسب يُعاد بالقيمة نفسها بالبناء، فنسبة ما يسمعه
// المستخدم قبل التبديل وبعده تساوي **نسبة المستوى وحدها**:
//
//     القفزة = مستوى العنصر الجديد ÷ مستوى العنصر القديم
//
// **والوصل بين النسبتين مقيس لا مفترض:** `video.volume` يقصّ المسار المعزَّز
// **نسبيّاً بنسبة 0.500 بالضبط** (`AUDIT.md` §8: `0.1769 / 0.3537`).
//
// ⚠️ **حدّ مُصرَّح به:** المقيس هنا **نسبة المستوى** لا `RMS` من رسم حيّ على
// الموقع. الرسم الحيّ على مشغّل MSE بإعلاناته أهشّ من أن يُبنى عليه رقم، وحلقة
// الوصل مقيسة أصلاً أعلاه. **ولا تُقرأ هذه الأداة على أنها قياس علوّ مسموع.**
//
// ⚠️ **والإضافة غير محمَّلة هنا عمداً**: المقيس **سلوك المضيف تجاه عنصر جديد**،
// وهو ما يقرّر القفزة. فمشغّلا القراءة أدناه **نسخة حرفية** من `startBoostReapply`
// (`loadedmetadata` بالتقاط · و`yt-navigate-finish` + 800ms) كي تُقرأ القيم في
// **اللحظة التي يقرؤها كودنا فعلاً** لا في لحظة نختارها.
// ولا عنصر من الإضافة في الصفحة لهذا السبب — فلا حاجة إلى استثناء `isOwnElement`،
// **ويُذكر الغياب صراحةً بدل أن يُسكت عنه**.
//
// ── الشواهد (قرار 26) ───────────────────────────────────────────────────────
//  · **موجب:** نضبط المستوى ونقرأه. لم يُقرأ ⇒ المِجَسّ أعمى ⇒ **«لم يُقس»** لا رقم.
//  · **موجب ثانٍ (المدى):** المستوى القديم **مضبوط بعيداً عن الافتراضية** عمداً —
//    فلو تُرك عند 100% لطبع «لا قفزة» و«لا مكان للقفزة» **الرقم نفسه**.
//  · **موجب ثالث — فحص البصر، وهو شرط أي نفي (شاهد رابع):** «العنصر لم يُبدَّل»
//    **نفيٌ**، والنفي يشترط أن تكون الأداة قادرة على رؤية الشيء أصلاً. فيُحقن
//    عنصر `<video>` حقيقي من `blob:` قبل القياس ويُتحقَّق أن المِجَسّ **يراه
//    هوية جديدة بـ`readyState ≥ 1`**، ثم يُزال. **سقط الفحص ⇒ لا يُنفى تبديل.**
//  · **موجب رابع (وقوع التبديل):** هوية العنصر تُبصم. لم تتبدّل ⇒ لا يُنطق بحكم
//    على مقدار، بل «العنصر لم يُبدَّل» — و`reapplyBoostTo` يخرج عندها مبكراً أصلاً.
//  · **سالب:** **تشغيلة سكون نظيفة منفصلة** بلا أي تنقّل، بنفس المدّة. إن تحرّك
//    المستوى فيها فالفارق في تشغيلة التبديل **لا يُنسب إلى التبديل** — وهو أثر
//    #60 الزمنيّ. (درس الشاهد السابع: قياس بعد تدخّل ليس قياس سكون.)
//  · **ولا ترشيح في المسح:** كل `<video>` يُطبع، والصفريّ يُوسم «مخفي» ولا يُسقط.
import { spawn } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// المستوى المميِّز: لا 1.0 الافتراضية، كي يكون للقفزة مدى تُرى فيه.
const BASE_LEVEL = 0.5;
// ⚠️ **ولا يُضبط دائماً بكتابتنا:** على مضيف يفرض نموذجه (يوتيوب، #60) تُمحى
// كتابتنا خلال ثانيتين **بلا أي تنقّل**، فخطّ أساس مبنيّ عليها **يسقط قبل
// القياس**. فيُضبط هناك **بواجهة المضيف نفسها** (سهم لأسفل موثوق على المشغّل،
// وهو المقيس في `AUDIT.md` §9: `100 ⇒ 90` بضغطتين) — فيصير خطّ الأساس **ملك
// المضيف** ويثبت. والشاهد السالب هو الذي يقرّر أي الطريقين صالح على أي مضيف.
const YT_STEPS = 10;   // خطوة يوتيوب 5 لكل ضغطة ⇒ 100 ⇒ 50
// مدّة السكون في الشاهد السالب = سقف انتظار التبديل، فالتشغيلتان متساويتا الزمن.
const SWAP_WAIT_MS = 16000;
const POLL_MS = 250;

// ---- عميل CDP، بلا أي حزمة npm (نفس نمط bench-host-volume.mjs) --------------
async function launch(port) {
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    `--user-data-dir=/tmp/vz-bench-swap-${port}-${process.pid}`,
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

// ---- المِجَسّ داخل الصفحة ---------------------------------------------------
// يُركَّب قبل أي سكربت للصفحة، ويبقى عبر تنقّل SPA لأن المستند لا يُعاد إنشاؤه.
const PROBE = `(() => {
  if (window.__vzSwap) return;
  const S = { events: [], t0: performance.now(), n: 0 };
  window.__vzSwap = S;
  const idOf = (v) => {
    if (!v.dataset.vzswap) v.dataset.vzswap = "ع" + (++S.n);
    return v.dataset.vzswap;
  };
  const snap = (v, why) => {
    const r = v.getBoundingClientRect();
    return { at: Math.round(performance.now() - S.t0), why, id: idOf(v),
             volume: Math.round(v.volume * 10000) / 10000, muted: v.muted,
             readyState: v.readyState, w: Math.round(r.width), h: Math.round(r.height),
             hidden: r.width === 0 || r.height === 0,
             src: (v.currentSrc || "").slice(0, 30) };
  };
  window.__vzSnap = snap;
  // ⚠️ **نسخة حرفية من مشغّلَي startBoostReapply** (content.js:312-322).
  // لا تُعدَّل هنا وحدها: القياس على مشغّل مغاير لا يقيس مسارنا.
  document.addEventListener("loadedmetadata", (e) => {
    if (e.target && e.target.tagName === "VIDEO") S.events.push(snap(e.target, "loadedmetadata"));
  }, true);
  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(() => {
      for (const v of document.querySelectorAll("video")) S.events.push(snap(v, "yt-navigate-finish+800"));
    }, 800);
  }, true);
  // **بلا ترشيح**: كل عنصر يُرجَع، والمخفيّ موسوم لا محذوف (شاهد خامس).
  window.__vzScan = () => [...document.querySelectorAll("video")].map((v) => snap(v, "مسح"));
  window.__vzPick = () => {
    let best = null, area = -1;
    for (const v of document.querySelectorAll("video")) {
      const r = v.getBoundingClientRect();
      const a = r.width * r.height;
      if (a > area) { area = a; best = v; }
    }
    return best;
  };
  window.__vzSet = (val) => {
    const v = window.__vzPick();
    if (!v) return null;
    v.volume = val;
    return { id: idOf(v), readBack: Math.round(v.volume * 10000) / 10000, muted: v.muted };
  };
  // عناصر الإضافة: غائبة بالبناء هنا، وتُعدّ كي يُذكر الغياب لا يُفترض.
  window.__vzOwn = () => document.querySelectorAll('[class^="vz"], [class*=" vz"]').length;
  // ── فحص البصر (شاهد رابع): **شرط أي نفي**. يُحقن <video> حقيقي من blob: بأصل
  // الصفحة (فلا شبكة ولا CSP media-src)، ويُتحقَّق أن المِجَسّ يراه **هوية جديدة
  // بـreadyState ≥ 1** — وهو المعيار نفسه الذي يكشف به التبديل. ثم يُزال.
  window.__vzVision = async () => {
    const before = new Set([...document.querySelectorAll("video")].map(idOf));
    const rate = 8000, n = 800;
    const buf = new Uint8Array(44 + n * 2);
    const dv = new DataView(buf.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
    w(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    w(36, "data"); dv.setUint32(40, n * 2, true);
    const url = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
    const el = document.createElement("video");
    el.src = url; el.muted = true; el.style.cssText = "position:fixed;left:-9999px;width:4px;height:4px";
    document.body.appendChild(el);
    const loaded = await new Promise((r) => {
      el.addEventListener("loadedmetadata", () => r(true), { once: true });
      el.addEventListener("error", () => r(false), { once: true });
      setTimeout(() => r(el.readyState >= 1), 3000);
    });
    const seen = [...document.querySelectorAll("video")]
      .filter((v) => !before.has(v.dataset.vzswap))
      .map((v) => snap(v, "بصر"));
    const found = seen.some((s) => s.readyState >= 1);
    el.remove(); URL.revokeObjectURL(url);
    return { loaded, found, count: seen.length };
  };
})()`;

// روابط التنقّل داخل الموقع — يُرجَع موضعها بعد إحضارها إلى الشاشة، والنقر بـCDP
// **موثوق**: المستخدم هو من ينقر في الواقع، والمقيس سلوك المضيف لا قدرة الإضافة.
const SELECTORS = {
  watch:  ['a#thumbnail[href^="/watch"]', 'a.ytp-videowall-still', 'a[href^="/watch?v="]'],
  shorts: ['a[href^="/shorts/"]', 'a[href*="/shorts/"]'],
  logo:   ['a#logo', 'ytd-topbar-logo-renderer a', 'a[href="/"]', 'a[href="https://d.tube/"]'],
  dtube:  ['a[href*="/watch/"]', 'a[href*="/v/"]', 'a[href*="#!/v/"]'],
  thumb:  ['ytd-rich-item-renderer a#thumbnail', 'ytd-thumbnail a', 'a#thumbnail', 'a[href*="/watch"]']
};
const findLink = (kind) => `(() => {
  const here = location.href;
  const sels = ${JSON.stringify(SELECTORS)}["${kind}"] || [];
  for (const sel of sels) {
    for (const a of document.querySelectorAll(sel)) {
      const href = a.href || "";
      if (!href || href === here) continue;
      a.scrollIntoView({ block: "center" });
      const r = a.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.top < 0 || r.bottom > innerHeight) continue;
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
               href: href.slice(0, 70), sel };
    }
  }
  return null;
})()`;

async function trustedClick(send, at) {
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, x: at.x, y: at.y, button: "left", clickCount: 1 });
  }
}

// معاينة الصفحة الرئيسية في يوتيوب **لا تُنشأ إلا بمرور المؤشّر**، والمرور
// المُصطنَع لا يكفي لما يعتمد على `:hover` حقيقيّ — فيُستعمل مؤشّر CDP **موثوق**.
async function trustedHover(send, at) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y });
  await sleep(400);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x + 2, y: at.y + 2 });
}

// خطوات كل نوع تنقّل. **مقاس التبديل هو المقصود لا مجرد تغيّر الرابط**، ولذلك
// تُجرَّب مسارات يذكرها تعليق `reapplyBoostTo` نفسه: بين المشاهدة والرئيسية
// و Shorts (content.js:296-297).
const NAV_KINDS = {
  "مشاهدة ⇒ مشاهدة":   [["click", "watch"]],
  "مشاهدة ⇒ الرئيسية": [["click", "logo"], ["hover", "thumb"]],
  "مشاهدة ⇒ Shorts":   [["click", "logo"], ["click", "shorts"]],
  "d.tube مشاهدة ⇒ مشاهدة": [["click", "dtube"]],
  "d.tube مشاهدة ⇒ الرئيسية": [["click", "logo"], ["click", "dtube"]]
};

async function runNav(send, steps) {
  const done = [];
  for (const [op, kind] of steps) {
    let at = null;
    for (let i = 0; i < 12 && !at; i++) {
      at = await evalIn(send, findLink(kind));
      if (!at) await sleep(700);
    }
    if (!at) return { ok: false, done, note: `لا رابط «${kind}» صالح في الصفحة — لم يُقس` };
    if (op === "click") await trustedClick(send, at); else await trustedHover(send, at);
    done.push(`${op}:${kind} ⇒ ${at.href}`);
    await sleep(op === "click" ? 2500 : 1200);
  }
  return { ok: true, done };
}

// ── خطّ الأساس ───────────────────────────────────────────────────────────────
// سهم لأسفل **موثوق** على مشغّل يوتيوب: خطوته 5 وقياسه في `AUDIT.md` §9.
// ⚠️ الهدف **المشغّل** لا `document.activeElement` (شرط قبول محوّل يوتيوب 1):
// الإرسال إلى حقل مركَّز يفسد نصّ المستخدم، وهي قاعدة أمان لا صوت.
async function ytStepDown(send, times) {
  await evalIn(send, `(document.querySelector("#movie_player") || {}).focus?.() ?? null`);
  for (let i = 0; i < times; i++) {
    for (const type of ["keyDown", "keyUp"]) {
      await send("Input.dispatchKeyEvent", {
        type, key: "ArrowDown", code: "ArrowDown",
        windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40
      });
    }
    await sleep(90);
  }
}

// يُرجع { via, level } — و`via` يُطبع دائماً كي لا يُفترض **كيف** ضُبط.
async function setBaseline(send, host) {
  if (host.includes("youtube")) {
    // ⚠️ **يُتحقَّق من بلوغ الهدف لا يُفترض:** أول تشغيلة أعطت خطوط أساس مختلفة
    // (50% · 55% · 85% · 85%) لأن بعض الضغطات لم تصل — المشغّل لم يكن مركَّزاً بعد
    // أو كان إعلان يعمل. فالضغط **يُعاد بدفعات حتى يقع فعلاً**، وإلا خرج خطّ أساس
    // مختلف بين التشغيلات فلا تُقارَن بعضها ببعض.
    let v = null, pressed = 0;
    for (let batch = 0; batch < 5; batch++) {
      await ytStepDown(send, YT_STEPS);
      pressed += YT_STEPS;
      await sleep(900);
      v = await evalIn(send, `(() => { const v = window.__vzPick(); return v ? window.__vzSnap(v, "أساس") : null; })()`);
      if (v?.volume != null && v.volume <= 0.6) break;
    }
    return { via: `سهم لأسفل ×${pressed} موثوق على #movie_player`, level: v?.volume ?? null, id: v?.id };
  }
  const set = await evalIn(send, `window.__vzSet(${BASE_LEVEL})`);
  return { via: "كتابة video.volume المباشرة", level: set?.readBack ?? null, id: set?.id };
}

async function waitPlayer(send, label) {
  for (let i = 0; i < 60; i++) {
    const all = await evalIn(send, `window.__vzScan ? window.__vzScan() : null`);
    const live = (all || []).find((v) => v.readyState >= 1 && !v.hidden);
    if (live) return { ok: true, all, live };
    await sleep(1000);
  }
  const all = await evalIn(send, `window.__vzScan ? window.__vzScan() : null`);
  return { ok: false, all, note: `المشغّل لم يبدأ في ${label} — لم يُقس` };
}

async function open(port, url) {
  const proc = await launch(port);
  const c = await attach(port, "about:blank");
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: PROBE });
  await c.send("Page.navigate", { url });
  await c.send("Page.bringToFront"); // بلا هذا لا يبدأ يوتيوب تشغيلاً في headless
  return { proc, ...c };
}

// ── الشاهد السالب: تشغيلة سكون **نظيفة ومنفصلة**، بلا أي تنقّل ────────────────
// درس الشاهد السابع: مرحلة السكون تُعزل في تشغيلة نظيفة أو لا تُصدَّق.
async function runIdle(url, port) {
  let s = null;
  const host = new URL(url).host;
  try {
    s = await open(port, url);
    const ready = await waitPlayer(s.send, "تشغيلة السكون");
    if (!ready.ok) return { note: ready.note, scan: ready.all };
    const base = await setBaseline(s.send, host);
    if (base.level == null) return { note: "تعذّرت قراءة المستوى ⇒ لم يُقس", base };
    if (base.level > 0.95) {
      return { note: `خطّ الأساس بقي عند ${pct(base.level)} — **لا مدى تُرى فيه قفزة** ⇒ لم يُقس`, base };
    }
    const series = [];
    const t0 = Date.now();
    while (Date.now() - t0 < SWAP_WAIT_MS) {
      await sleep(2000);
      const v = await evalIn(s.send, `(() => { const v = window.__vzPick(); return v ? window.__vzSnap(v, "سكون") : null; })()`);
      series.push([Math.round((Date.now() - t0) / 100) / 10, v?.volume ?? null, v?.id ?? null]);
    }
    const last = series.at(-1);
    return {
      base, series,
      steady: last && last[1] != null && Math.abs(last[1] - base.level) < 0.02,
      sameElement: series.every((r) => r[2] === base.id)
    };
  } catch (e) { return { note: "فشل: " + String(e?.message || e).slice(0, 70) }; }
  finally { try { s?.ws?.close(); } catch {} killChrome(s); }
}

// ── تشغيلة التبديل ───────────────────────────────────────────────────────────
async function runSwap(url, port, kind) {
  let s = null;
  const host = new URL(url).host;
  const steps = NAV_KINDS[kind] || [];
  try {
    s = await open(port, url);
    const ready = await waitPlayer(s.send, "تشغيلة التبديل");
    if (!ready.ok) return { kind, note: ready.note, scan: ready.all };

    const own = await evalIn(s.send, `window.__vzOwn()`);
    // **فحص البصر أولاً** — قبل خطّ الأساس، فلا يلوّث أي قراءة لاحقة. وبلا نجاحه
    // **لا يُنفى تبديل** لاحقاً (شاهد رابع).
    const vision = await evalIn(s.send, `window.__vzVision()`);

    const base = await setBaseline(s.send, host);
    if (base.level == null) return { kind, own, vision, note: "تعذّرت قراءة المستوى ⇒ لم يُقس" };
    if (base.level > 0.95) {
      return { kind, own, vision, base,
               note: `خطّ الأساس بقي عند ${pct(base.level)} — **لا مدى تُرى فيه قفزة** ⇒ لم يُقس` };
    }
    await sleep(1200);
    const before = await evalIn(s.send, `(() => { const v = window.__vzPick(); return v ? window.__vzSnap(v, "قبل") : null; })()`);
    const urlBefore = await evalIn(s.send, `location.href`);
    await evalIn(s.send, `window.__vzSwap.events.length = 0`); // ما قبل التنقّل ليس تبديلاً

    const nav = await runNav(s.send, steps);
    if (!nav.ok) return { kind, own, vision, base, before, note: nav.note, navSteps: nav.done };

    // **استطلاع لا مهلة** (شاهد ثامن): يُسجَّل **وقت وقوع** التبديل، ويُحكَم عنده.
    let swapAt = null, newEl = null, urlAfter = urlBefore;
    const t0 = Date.now();
    while (Date.now() - t0 < SWAP_WAIT_MS) {
      await sleep(POLL_MS);
      urlAfter = await evalIn(s.send, `location.href`);
      const all = await evalIn(s.send, `window.__vzScan()`);
      const fresh = (all || []).find((v) => v.id !== before?.id && v.readyState >= 1);
      if (fresh) { swapAt = Date.now() - t0; newEl = fresh; break; }
    }
    await sleep(1500); // كي يلحق مشغّل yt-navigate-finish+800 إن كان قد أُطلق
    const events = await evalIn(s.send, `window.__vzSwap.events`);
    const scan = await evalIn(s.send, `window.__vzScan()`);
    const after = await evalIn(s.send, `(() => { const v = window.__vzPick(); return v ? window.__vzSnap(v, "بعد") : null; })()`);
    return { kind, own, vision, base, before, navSteps: nav.done, urlBefore, urlAfter,
             swapAt, newEl, events, scan, after, navigated: urlAfter !== urlBefore };
  } catch (e) { return { kind, note: "فشل: " + String(e?.message || e).slice(0, 70) }; }
  finally { try { s?.ws?.close(); } catch {} killChrome(s); }
}

// رابط يوتيوب يُستخرج حيّاً: رابط مثبَّت في الملف يموت فيصير القياس كاذباً.
async function youtubeUrl(port) {
  let s = null;
  try {
    s = await open(port, "https://www.youtube.com/results?search_query=music");
    for (let i = 0; i < 25; i++) {
      const href = await evalIn(s.send,
        `(document.querySelector('a#video-title, a[href^="/watch?v="]')||{}).href || null`);
      if (href) return href.split("&")[0];
      await sleep(1000);
    }
    return null;
  } catch { return null; }
  finally { try { s?.ws?.close(); } catch {} killChrome(s); }
}

// ---- الطباعة ---------------------------------------------------------------
const pct = (x) => x == null ? "—" : `${Math.round(x * 1000) / 10}%`;

function report(name, url, idle, swaps) {
  console.log(`\n══ ${name}`);
  console.log(`   الرابط (قرار 19): ${url}`);

  console.log(`\n   ── الشاهد السالب — تشغيلة سكون نظيفة بلا تنقّل`);
  if (idle?.note) {
    console.log(`      ⚠️ ${idle.note}`);
    if (idle.base) console.log(`      خطّ الأساس: ${pct(idle.base.level)} عبر ${idle.base.via}`);
  } else {
    console.log(`      خطّ الأساس: ${pct(idle.base?.level)} عبر ${idle.base?.via}   (الشاهد الموجب ✅ · والمدى قائم)`);
    console.log(`      السلسلة: ${idle.series.map(([t, v]) => `${t}s:${pct(v)}`).join(" → ")}`);
    console.log(`      ${idle.steady ? "✅ المستوى ثابت في السكون" : "❌ المستوى يتحرّك بلا تنقّل"} · ` +
                `${idle.sameElement ? "العنصر واحد" : "⚠️ العنصر تبدّل بلا تنقّل"}`);
    if (!idle.steady) {
      console.log(`      ⚠️ **لا يُنسب أي فارق في تشغيلة التبديل إلى التبديل** — المستوى يتحرّك بلا تنقّل أصلاً (أثر #60 الزمنيّ)`);
    }
  }

  for (const sw of swaps) {
    console.log(`\n   ── تشغيلة التبديل — ${sw.kind}`);
    if (sw.vision) {
      console.log(`      فحص البصر : ${sw.vision.found ? "✅ يرى عنصراً جديداً بـreadyState ≥ 1" : "❌ **أعمى** — لا يُنفى به تبديل"}` +
                  ` (تحميل ${sw.vision.loaded ? "تمّ" : "لم يتمّ"})`);
    }
    if (sw.note) { console.log(`      ⚠️ ${sw.note}`); continue; }
    console.log(`      عناصر الإضافة في الصفحة: ${sw.own} (غائبة بالبناء — الإضافة غير محمَّلة)`);
    console.log(`      خطّ الأساس: ${pct(sw.base?.level)} عبر ${sw.base?.via}`);
    console.log(`      قبل التنقّل: ${sw.before?.id} · ${pct(sw.before?.volume)}${sw.before?.muted ? " (مكتوم)" : ""} · ${sw.before?.w}×${sw.before?.h}`);
    console.log(`      خطوات التنقّل: ${(sw.navSteps || []).join("  ·  ") || "—"}`);
    console.log(`      التنقّل    : ${sw.navigated ? "✅ وقع" : "❌ لم يقع"}  ${sw.urlAfter?.slice(0, 60)}`);

    if (!sw.navigated) {
      console.log(`      ⇒ **الشرط لم يتحقّق، أعد القياس** — لا حكم على قفزة بلا تنقّل واقع`);
      continue;
    }
    if (!sw.newEl) {
      if (!sw.vision?.found) {
        console.log(`      ⇒ **لا يُنفى التبديل**: فحص البصر سقط، فـ«لم يُبدَّل» و«لم أرَ» يطبعان النتيجة نفسها (شاهد رابع)`);
        continue;
      }
      console.log(`      العنصر    : **لم يُبدَّل** خلال ${SWAP_WAIT_MS / 1000}s (الهوية ${sw.after?.id} كما كانت) — **والمِجَسّ مُثبَت البصر**`);
      console.log(`      ⇒ **لا قفزة من هذا المسار على هذا الانتقال**: \`reapplyBoostTo\` يخرج مبكراً بـ \`boostMap.has(video)\` (content.js:303)`);
      console.log(`      ⇒ ولا يُنطق بحكم على مقدار قفزة **لم يقع مسارها** (شاهد سادس)`);
      continue;
    }

    console.log(`      العنصر    : ✅ **تبدّل** ${sw.before?.id} ⇒ ${sw.newEl.id} عند ${sw.swapAt}ms`);
    const trig = (sw.events || []).filter((e) => e.id === sw.newEl.id);
    if (!trig.length) {
      console.log(`      ⚠️ لم يُطلق أيٌّ من مشغّلَي \`startBoostReapply\` على العنصر الجديد — **يُقرأ ولا يُفسَّر**`);
    }
    for (const e of trig) {
      console.log(`      عند ${e.why.padEnd(24)}: ${pct(e.volume)}${e.muted ? " (مكتوم)" : ""} · readyState=${e.readyState}`);
    }
    const read = trig.find((e) => e.why === "loadedmetadata") || trig[0] || sw.newEl;
    const oldV = sw.before?.volume, newV = read?.volume;
    console.log(`      استقرّ عند: ${pct(sw.after?.volume)}  (${sw.after?.id})`);

    if (!oldV || oldV <= 0 || newV == null) {
      console.log(`      ⇒ لا تُحسب نسبة: المستوى القديم ${pct(oldV)} — **لا يُستنبَط، والسبب مطبوع**`);
    } else {
      const ratio = newV / oldV;
      console.log(`      **القفزة المقيسة: ${pct(oldV)} ⇒ ${pct(newV)} = ×${ratio.toFixed(3)}**` +
                  `   (وعلى الرِكاز المحلي ×1.76)`);
      // ⚠️ **حكم يشترط حالةً يفحصها قبل أن ينطق** (شاهد سادس): عنصر مكتوم لا
      // يُسمع منه شيء، فالنسبة عليه تصف **الكامن** لا المسموع — و«قفزة» عنه كذب.
      if (read?.muted) {
        console.log(`      ⚠️ **العنصر الجديد مكتوم** ⇒ **لا قفزة مسموعة**، والنسبة أعلاه تصف **المستوى الكامن** وحده`);
      } else {
        console.log(`      وبمنطوق العلوّ (0.500 مقيسة في §8): ما يسمعه المستخدم يتغيّر بالنسبة نفسها ×${ratio.toFixed(3)}`);
      }
    }
    const hidden = (sw.scan || []).filter((v) => v.hidden).length;
    console.log(`      مسح كامل  : ${(sw.scan || []).length} عنصر (${hidden} مخفي، مطبوع لا مُسقَط): ` +
      (sw.scan || []).map((v) => `${v.id}=${pct(v.volume)}${v.hidden ? "(مخفي)" : ""}`).join(" · "));
  }
}

// ---- التشغيل ---------------------------------------------------------------
let port = 9471;
const argUrl = process.argv[2];

const YT_KINDS = ["مشاهدة ⇒ مشاهدة", "مشاهدة ⇒ الرئيسية", "مشاهدة ⇒ Shorts"];
const DT_KINDS = ["d.tube مشاهدة ⇒ مشاهدة", "d.tube مشاهدة ⇒ الرئيسية"];

const targets = [];
if (argUrl) {
  const host = new URL(argUrl).host;
  targets.push({ name: host, url: argUrl, kinds: host.includes("youtube") ? YT_KINDS : DT_KINDS });
} else {
  const yt = await youtubeUrl(port++);
  if (yt) targets.push({ name: "youtube.com", url: yt, kinds: YT_KINDS });
  else console.log("⚠️ تعذّر استخراج رابط يوتيوب حيّاً — لم يُقس");
  targets.push({ name: "d.tube", url: "https://d.tube/watch/5MxdC3ajEpBwgcDCsrHRd5", kinds: DT_KINDS });
}

console.log("\n=== #61ب — قفزة تبديل العنصر على موقع حقيقي ===");
console.log("المقيس: نسبة المستوى (القفزة = مستوى الجديد ÷ مستوى القديم)");
console.log("⚠️ ليس RMS ولا علوّاً مسموعاً — الوصل بينهما مقيس في AUDIT §8 (0.500 بالضبط)");

for (const t of targets) {
  process.stdout.write(`\n⏳ ${t.name} — تشغيلة السكون (الشاهد السالب) … `);
  const idle = await runIdle(t.url, port++);
  console.log(idle.note ? "لم يُقس" : "تمّت");
  const swaps = [];
  for (const kind of t.kinds) {
    process.stdout.write(`⏳ ${t.name} — تشغيلة التبديل (${kind}) … `);
    const r = await runSwap(t.url, port++, kind);
    console.log(r.note ? "لم يُقس" : "تمّت");
    swaps.push(r);
  }
  report(t.name, t.url, idle, swaps);
}
console.log("");
process.exit(0);
