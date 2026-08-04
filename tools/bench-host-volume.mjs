// قياس: هل تنجو كتابة الإضافة في `video.volume` فوق نموذج المشغّل المضيف؟
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة، مثل بقية أدوات bench هنا. **لا يُشحن.**
//
//   node tools/bench-host-volume.mjs                    # المواقع الأربعة
//   node tools/bench-host-volume.mjs "https://..."      # رابط واحد
//
// **سبب وجوده:** خطوات #35 اليدوية على يوتيوب أعطت 100 حيث توقّعنا 54 و38 و4.
// القراءة المقترحة أن للمضيف نموذج مستوى خاصاً يعيد فرضه. هذه الأداة تقيسها بدل
// أن تسردها، وتفصل بين احتمالين لا يفرّق بينهما السرد:
//
//   (أ) كتابتنا **لا تصل أصلاً**            ⇒ القراءة الفورية بعدها ≠ ما كتبناه
//   (ب) كتابتنا تصل ثم **تُمحى بحدث لاحق**  ⇒ الفورية = ما كتبناه، ثم تتغيّر
//
// ولذلك يُقرأ المستوى أربع مرات: فوراً، وبعد سكون بلا أي حدث من المضيف، ثم بعد
// كتم من طرفه، ثم بعد فكّ كتم من طرفه. **العمود الذي يحسم هو «بعد سكون»**: إن نجت
// الكتابة فيه فالمضيف لا يستطلع، بل يفرض عند حدثه وحده.
//
// وتُعدّ مستمعات `volumechange` على العنصر بـ DOMDebugger — دليل مباشر على من
// يراقب، لا استنتاج — وتُقرأ مفاتيح التخزين المحلي التي تشبه مستوى محفوظاً.
//
// ⚠️ الكتابة هنا **نسخة طبق الأصل** من كتلة `ACTION:VOLUME` في content.js بعد
// ‏#35. لا تُعدَّل هنا وحدها: القياس على منطق مغاير لا يقيس شيئاً.
//
// كروم يُشغَّل بـ --mute-audio: القياس على `video.volume` كخاصية، ولا صوت يخرج.
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
const DELTA = 0.04; // نفس دلتا الربط الافتراضي: ACTION:VOLUME:+4

// ---- عميل CDP صغير، بلا أي حزمة npm (نفس نمط bench-yt-quality.mjs) ----------
async function launch(port) {
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    `--user-data-dir=/tmp/vz-bench-vol-${port}-${process.pid}`,
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
  return { ws, send, tab };
}

async function evalIn(send, expression, byValue = true) {
  const r = await send("Runtime.evaluate", {
    expression, awaitPromise: true, returnByValue: byValue, allowUnsafeEvalBlockedByCSP: true
  });
  if (r.result?.exceptionDetails) return { __error: r.result.exceptionDetails.text || "استثناء" };
  return byValue ? r.result?.result?.value : r.result?.result;
}

// ---- ما يُنفَّذ داخل الصفحة -------------------------------------------------
// ⚠️ العنصر يُعاد إيجاده في **كل** خطوة، ولا يُخزَّن في `window`.
// أول تشغيل خزّنه في `window.__vz` فخرج يوتيوب بأصفار وفراغات: صفحة المشاهدة
// تُبدّل عنصر الفيديو وتُصفّر سياق التنفيذ، فضاع المرجع وصارت كل قراءة `null`.
// رقم عن مرجع ميت ليس رقماً (قرار 22)، فالإيجاد صار طازجاً في كل مرة، ومعه
// **بصمة هوية** تكشف تبديل العنصر بدل أن تخفيه.
const FIND = `const pick = () => {
  const vids = [...document.querySelectorAll("video")];
  let best = null, area = -1;
  for (const v of vids) {
    const r = v.getBoundingClientRect();
    const a = r.width * r.height;
    if (a > area) { area = a; best = v; }
  }
  if (best && !best.dataset.vzbench) best.dataset.vzbench = String(Math.round(performance.now()));
  return best;
};`;

const PICK = `(() => { ${FIND}
  const vids = [...document.querySelectorAll("video")];
  const best = pick();
  if (!best) return { found: false, count: vids.length };
  const r = best.getBoundingClientRect();
  return { found: true, count: vids.length, w: Math.round(r.width), h: Math.round(r.height),
           readyState: best.readyState, volume: best.volume, muted: best.muted,
           paused: best.paused, id: best.dataset.vzbench, src: (best.currentSrc || "").slice(0, 40) };
})()`;

const READ = `(() => { ${FIND} const v = pick();
  return v ? { volume: Math.round(v.volume * 10000) / 10000, muted: v.muted, id: v.dataset.vzbench } : null; })()`;

// ⚠️ خطّ أساس **مميِّز**: كل المضيفين يبدأون عند 100%، فكتابة +4% فوقها تُقصّ إلى
// 100% ويصير «نجت» و«مُحيت» رقماً واحداً — قياس لا يفرّق بين حالتين لا يقيس شيئاً
// (درس قرار 22). فنُنزل المستوى إلى 50% أولاً، وبه وحده يصير الرجوع إلى 100%
// مرئياً. وهذه الكتابة نفسها هي أول اختبار للنجاة.
const BASE = `(() => { ${FIND} const v = pick(); if (!v) return null; v.volume = 0.5;
  return { readBack: Math.round(v.volume * 10000) / 10000, id: v.dataset.vzbench }; })()`;

// نسخة طبق الأصل من كتلة ACTION:VOLUME بعد #35 — رفع بدلتا +4%
const WRITE = `(() => { ${FIND}
  const video = pick();
  if (!video) return null;
  const delta = ${DELTA};
  const before = { volume: video.volume, muted: video.muted };
  if (delta > 0 && video.muted) video.muted = false;
  const next = (video.volume ?? 1) + delta;
  video.volume = next <= 0 ? 0.0001 : Math.min(1, next);
  return { before, wrote: Math.round(Math.min(1, (before.volume ?? 1) + delta) * 10000) / 10000,
           readBack: Math.round(video.volume * 10000) / 10000, mutedAfter: video.muted,
           id: video.dataset.vzbench };
})()`;

// سلسلة زمنية بعد الكتابة — تفصل «مستمع يردّ على volumechange» عن «استطلاع دوري»
// عن «استعادة عند حدث لاحق». تُؤخذ **داخل الصفحة** فلا يلوّثها زمن ذهاب وإياب CDP.
const series = (writeBody) => `(async () => { ${FIND}
  const v = pick(); if (!v) return null;
  const out = [];
  const t0 = performance.now();
  const read = () => out.push([Math.round(performance.now() - t0),
                               Math.round(pick().volume * 1000) / 10,
                               pick().muted ? 1 : 0]);
  ${writeBody}
  read();
  for (const at of [16, 50, 100, 200, 400, 800, 1600, 3000]) {
    const wait = at - (performance.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    read();
  }
  return out;
})()`;

// (أ) كتابة مطلقة بسيطة  (ب) خطّ أساس ثم رفع #35 فوقه بعد استقرار قصير
const SERIES_SET = series(`v.volume = 0.5;`);
const SERIES_RAISE = series(`v.volume = 0.5;
  await new Promise((r) => setTimeout(r, 120));
  const video = pick(); const delta = ${DELTA};
  if (delta > 0 && video.muted) video.muted = false;
  const next = (video.volume ?? 1) + delta;
  video.volume = next <= 0 ? 0.0001 : Math.min(1, next);`);

// مفاتيح التخزين التي تشبه مستوى محفوظاً — تُقرأ لا تُخمَّن
const STORE = `(() => {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/vol|mute|sound|audio/i.test(k)) out[k] = String(localStorage.getItem(k)).slice(0, 90);
    }
  } catch (e) { return { __error: String(e).slice(0, 60) }; }
  return out;
})()`;

// كتم من طرف المضيف: مفتاحه أولاً، فإن لم يستجب فزرّ الكتم في واجهته.
const HOST_MUTE_BUTTONS = [
  ".ytp-mute-button",
  '[data-a-target="player-mute-unmute-button"]',
  '[data-mute]', ".vp-mute", ".jw-icon-volume",
  'button[aria-label*="mute" i]', 'button[title*="mute" i]'
];
const clickMute = `(() => {
  for (const s of ${JSON.stringify(HOST_MUTE_BUTTONS)}) {
    const el = document.querySelector(s);
    if (el) { el.click(); return s; }
  }
  return null;
})()`;

async function pressM(send) {
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {
      type, key: "m", code: "KeyM", windowsVirtualKeyCode: 77, nativeVirtualKeyCode: 77,
      text: type === "keyDown" ? "m" : undefined
    });
  }
}

// طلب كتم/فكّ من طرف المضيف، ويُبلَّغ **بأي وسيلة وقع** — لا يُفترض أنه وقع
async function hostToggleMute(send, want) {
  const before = await evalIn(send, READ);
  // تركيز مشغّل المضيف قبل المفتاح: يوتيوب لا يستجيب لـ`m` والتركيز على المستند.
  // التركيز فعل من طرف المضيف ولا يكتب في المستوى، فلا يلوّث القياس.
  await evalIn(send, `(document.querySelector("#movie_player, .video-player, video") || {}).focus?.() ?? null`);
  await pressM(send);
  await sleep(700);
  let after = await evalIn(send, READ);
  if (after && before && after.muted !== before.muted) return { via: "مفتاح m", after };
  const sel = await evalIn(send, clickMute);
  if (sel) {
    await sleep(700);
    after = await evalIn(send, READ);
    if (after && before && after.muted !== before.muted) return { via: `زر ${sel}`, after };
  }
  return { via: "لم يستجب", after };
}

// ---- خريطة الاستعادة -------------------------------------------------------
// بعد أن ثبت أن الفرض يقع **عند فكّ كتم المضيف**، يبقى سؤال يقرّر الاتجاه: القيمة
// التي يعود إليها — هل هي دالّة في آخر ما كتبناه أم قيمته المحفوظة وحدها؟
// تُقاس بكتابة قيم مختلفة ثم دورة كتم/فكّ لكل واحدة. **قياس لا اشتقاق.**
async function measureRestoreMap(url, port) {
  const out = [];
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port, url);
    ws = c.ws;
    const { send } = c;
    await send("Runtime.enable"); await send("DOM.enable");
    await send("Page.enable"); await send("Page.bringToFront");
    for (let i = 0; i < 60; i++) {
      const p = await evalIn(send, PICK);
      if (p?.found && p.readyState >= 1 && p.w > 0) break;
      await sleep(1000);
    }
    for (const val of [0.2, 0.4, 0.54, 0.8]) {
      await evalIn(send, `(() => { ${FIND} const v = pick(); if (v) v.volume = ${val}; })()`);
      await sleep(400);
      const wrote = await evalIn(send, READ);
      const m1 = await hostToggleMute(send, true);
      const m2 = await hostToggleMute(send, false);
      out.push({ wrote: wrote?.volume, muted: m1.after?.volume, back: m2.after?.volume, via: m2.via });
    }
    return out;
  } catch (e) { return [{ error: String(e?.message || e).slice(0, 70) }]; }
  finally { try { ws?.close(); } catch {} killChrome(proc); }
}

// ---- قياس العلاجات ---------------------------------------------------------
// أيّ تدخّل يجعل **نموذج المضيف نفسه** يتبعنا؟ يُقاس على المضيفَين اللذين يفرضان
// وحدهما. لكل علاج متصفّح جديد: كتابة التخزين في (ج) تلوّث ما بعدها.
//
// ⚠️ **التمييز الحاسم — الموثوق وغير الموثوق.** أحداث CDP **موثوقة**
// (`isTrusted: true`) وسكربت المحتوى **لا يستطيع توليدها**. فكل علاج هنا يُنفَّذ
// بما تستطيعه الإضافة فعلاً (`dispatchEvent` من الصفحة)، ويبقى مفتاح CDP مرجعاً
// أعلى للمقارنة لا علاجاً مقترحاً. قياس علاج بحدث موثوق **يبالغ في قدرتنا**.
const TARGET = 0.3;

const SLIDER = `(() => {
  const yt = document.querySelector(".ytp-volume-panel, .ytp-volume-slider");
  if (yt) return { kind: "yt", value: yt.getAttribute("aria-valuenow") };
  const tw = document.querySelector('input[data-a-target="player-volume-slider"]');
  if (tw) return { kind: "twitch", value: tw.value };
  return null;
})()`;

const STATE = `(() => { ${FIND} const v = pick(); if (!v) return null;
  const s = ${SLIDER};
  return { volume: Math.round(v.volume * 10000) / 10000, muted: v.muted, slider: s?.value ?? null };
})()`;

const ALLSTORE = `(() => { const o = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i);
    o[k] = String(localStorage.getItem(k)).slice(0, 60); } } catch {}
  return o; })()`;

// شكل عنصر المستوى عند المضيف — يقرّر هل المحوّلان واحد بمعاملين أم اثنان.
// يُقرأ من الشجرة الحيّة لا يُفترض.
const SHAPE = `(() => {
  const sels = ['input[data-a-target="player-volume-slider"]', 'input[type=range]',
    '.ytp-volume-panel', '.ytp-volume-slider', '[role=slider]',
    '[aria-label*="olume" i]', '[data-testid*="volume" i]', '[class*="volume" i]'];
  const out = [];
  const seen = new Set();
  for (const sel of sels) {
    let el = null;
    try { el = document.querySelector(sel); } catch { continue; }
    if (!el || seen.has(el)) continue;
    seen.add(el);
    out.push(sel + " ⇒ <" + el.tagName.toLowerCase() +
      (el.type ? " type=" + el.type : "") + "> role=" + (el.getAttribute("role") || "—") +
      " valuenow=" + (el.getAttribute("aria-valuenow") ?? el.value ?? "—"));
  }
  return out;
})()`;

// (ج) كتابة مفتاح المضيف — بصيغته هو، لا بصيغة نخترعها
const storageRemedy = (host) => host.includes("youtube") ? `(() => {
  const k = "yt-player-volume";
  const now = Date.now();
  const payload = { data: JSON.stringify({ volume: ${TARGET * 100}, muted: false }),
                    expiration: now + 2592000000, creation: now };
  localStorage.setItem(k, JSON.stringify(payload));
  sessionStorage.setItem(k, JSON.stringify(payload));
  return "yt-player-volume";
})()` : `(() => {
  localStorage.setItem("volume", String(${TARGET}));
  localStorage.setItem("video-muted", JSON.stringify({ default: false }));
  return "volume";
})()`;

// (د1) اختصار المضيف بأحداث **غير موثوقة** — ما تستطيعه الإضافة فعلاً
const keyRemedy = () => `(() => {
  ${FIND}
  const v = pick();
  const player = document.querySelector("#movie_player, .video-player, [data-a-target='player-overlay-click-handler']") || v;
  for (let i = 0; i < 4; i++) {
    for (const type of ["keydown", "keyup"]) {
      player.dispatchEvent(new KeyboardEvent(type, { key: "ArrowDown", code: "ArrowDown",
        keyCode: 40, which: 40, bubbles: true, cancelable: true, composed: true }));
    }
  }
  return "ArrowDown ×4 (غير موثوق)";
})()`;

// (د2) منزلق المضيف وحده. حقل `<input type=range>` يديره React لا يقبل `.value = x`
// مباشرةً، فالطريق الوحيد هو الـ native setter ثم `input`/`change`.
// ⚠️ يوتيوب منزلقه `div` لا `input`، فلا مقابل له — يُسجَّل «لا منزلق» لا «فشل».
const sliderRemedy = () => `(() => {
  const tw = document.querySelector('input[data-a-target="player-volume-slider"], input[type=range][class*=volume i]');
  if (!tw) return "لا منزلق <input> في هذا المضيف";
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(tw, String(${TARGET}));
  tw.dispatchEvent(new Event("input", { bubbles: true }));
  tw.dispatchEvent(new Event("change", { bubbles: true }));
  return "native setter + input/change (غير موثوق)";
})()`;

const REMEDIES = [
  { id: "أ", label: "كتابة video.volume وحدها",
    code: () => `(() => { ${FIND} const v = pick(); v.volume = ${TARGET}; return "volume=" + v.volume; })()` },
  { id: "ب", label: "كتابتها + حدث volumechange مُصطنَع (غير موثوق)",
    code: () => `(() => { ${FIND} const v = pick(); v.volume = ${TARGET};
      v.dispatchEvent(new Event("volumechange")); return "volume+event"; })()` },
  { id: "ج", label: "كتابة مفتاح المضيف في التخزين المحلي", code: storageRemedy },
  { id: "د1", label: "اختصار المضيف (ArrowDown) بحدث غير موثوق", code: keyRemedy },
  { id: "د2", label: "منزلق المضيف عبر native setter (غير موثوق)", code: sliderRemedy }
];

async function measureRemedies(url, port) {
  const host = new URL(url).host;
  const rows = [];
  for (const rem of REMEDIES) {
    let proc, ws;
    const row = { id: rem.id, label: rem.label };
    try {
      const p = port++;
      proc = await launch(p);
      const c = await attach(p, url);
      ws = c.ws;
      const { send } = c;
      await send("Runtime.enable"); await send("DOM.enable");
      await send("Page.enable"); await send("Page.bringToFront");
      let ready = false;
      for (let i = 0; i < 60; i++) {
        const p = await evalIn(send, PICK);
        if (p?.found && p.readyState >= 1 && p.w > 0) { ready = true; break; }
        await sleep(1000);
      }
      if (!ready) { row.note = "المشغّل لم يبدأ — لم يُقس"; rows.push(row); continue; }

      row.before = await evalIn(send, STATE);
      if (!rows.shape) rows.shape = await evalIn(send, SHAPE);
      row.storeBefore = await evalIn(send, ALLSTORE);
      row.applied = await evalIn(send, rem.code(host));
      await sleep(1200);
      row.after = await evalIn(send, STATE);
      const m1 = await hostToggleMute(send, true);
      const m2 = await hostToggleMute(send, false);
      row.cycle = m2.after; row.via = m2.via;
      row.afterCycle = await evalIn(send, STATE);
      const sb = row.storeBefore || {}, sa = await evalIn(send, ALLSTORE) || {};
      row.storeDiff = Object.keys(sa).filter((k) => sa[k] !== sb[k]).map((k) => `${k}=${sa[k]}`);
      rows.push(row);
    } catch (e) {
      row.note = "فشل: " + String(e?.message || e).slice(0, 60);
      rows.push(row);
    } finally {
      try { ws?.close(); } catch {} killChrome(proc);
    }
  }
  return rows;
}

// ---- قياس موقع واحد --------------------------------------------------------
async function measure(name, url, port) {
  const row = { name, url, ok: false };
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port, url);
    ws = c.ws;
    const { send } = c;
    await send("Runtime.enable");
    await send("DOM.enable");
    await send("Page.enable");
    await send("Page.bringToFront"); // بلا هذا لا يبدأ يوتيوب تشغيلاً في headless

    // انتظار مشغّل **حقيقي**: مستطيل غير صفري ومصدر مُحمَّل فعلاً (قرار المالك 22).
    // readyState === 0 يعني أن المشغّل لم يبدأ بعد، وكل رقم يُقرأ عنده رقم عن لا شيء.
    let pick = null;
    for (let i = 0; i < 60; i++) {
      pick = await evalIn(send, PICK);
      if (pick?.found && pick.w > 0 && pick.readyState >= 1) break;
      await sleep(1000);
    }
    row.pick = pick;
    if (!pick?.found) { row.note = "لا <video> في الصفحة — لم يُقس"; return row; }
    if (!(pick.readyState >= 1 && pick.w > 0)) {
      row.note = `المشغّل لم يبدأ (readyState=${pick.readyState} · ${pick.w}×${pick.h}) — لم يُقس`;
      return row;
    }

    row.storeBefore = await evalIn(send, STORE);

    // مستمعات volumechange على العنصر — دليل لا استنتاج
    try {
      const obj = await evalIn(send, `(() => { ${FIND} return pick(); })()`, false);
      if (obj?.objectId) {
        const ls = await send("DOMDebugger.getEventListeners", { objectId: obj.objectId, depth: 1 });
        const all = ls.result?.listeners || [];
        row.listeners = all.filter((l) => /volume/i.test(l.type))
          .map((l) => `${l.type}@${(l.scriptId ? "script" : "?")}:${l.lineNumber ?? "?"}`);
        row.listenerTypes = [...new Set(all.map((l) => l.type))].sort().join(",");
      }
    } catch { row.listeners = null; }

    // (0) كتابة مطلقة 50% + سلسلة زمنية: هل تنجو أصلاً، ومتى تُمحى إن مُحيت؟
    row.seriesSet = await evalIn(send, SERIES_SET);
    await sleep(500);
    // (1) خطّ أساس ثم **رفع #35 نفسه** فوقه، بسلسلته
    row.seriesRaise = await evalIn(send, SERIES_RAISE);
    row.base = { readBack: row.seriesSet?.[0]?.[1] / 100 };
    row.baseAfter = { volume: (row.seriesSet?.at(-1)?.[1] ?? 0) / 100, muted: !!row.seriesSet?.at(-1)?.[2] };
    // (2) القراءة المستقرّة بعد الرفع
    await sleep(300);  row.at300 = await evalIn(send, READ);
    await sleep(1200); row.at1500 = await evalIn(send, READ);
    row.write = { before: { volume: 0.5, muted: false }, wrote: 0.54,
                  readBack: (row.seriesRaise?.[0]?.[1] ?? 0) / 100,
                  mutedAfter: !!row.seriesRaise?.[0]?.[2], id: row.pick?.id };
    // (3) كتم من طرف المضيف ثم فكّه من طرفه
    const m1 = await hostToggleMute(send, true);
    row.hostMute = m1.after; row.muteVia = m1.via;
    const m2 = await hostToggleMute(send, false);
    row.hostUnmute = m2.after; row.unmuteVia = m2.via;
    row.storeAfter = await evalIn(send, STORE);
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

// ---- التشغيل ---------------------------------------------------------------
// رابط يوتيوب يُستخرج حيّاً من المتصفح نفسه: رابط مثبَّت في الملف يموت فيصير
// القياس كاذباً، وجلب الصفحة بـ fetch يردّ صفحة موافقة بلا روابط مشاهدة.
async function youtubeUrl(port) {
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port, "https://www.youtube.com/results?search_query=music");
    ws = c.ws;
    await c.send("Runtime.enable");
    await c.send("Page.bringToFront");
    for (let i = 0; i < 25; i++) {
      const href = await evalIn(c.send,
        `(document.querySelector('a#video-title, a[href^="/watch?v="]')||{}).href || null`);
      if (href) return href.split("&")[0];
      await sleep(1000);
    }
    return null;
  } catch { return null; }
  finally { try { ws?.close(); } catch {} killChrome(proc); }
}

// قناة كِك حيّة تُستخرج حيّاً: القنوات تتغيّر، ورابط مثبَّت يجعل القياس كاذباً.
async function kickUrl(port) {
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port, "https://kick.com/browse");
    ws = c.ws;
    await c.send("Runtime.enable"); await c.send("Page.bringToFront");
    for (let i = 0; i < 30; i++) {
      const href = await evalIn(c.send, `(() => {
        const bad = /^\\/(browse|categories|following|search|about|help|terms|privacy|signup|login|clips|category)/i;
        for (const a of document.querySelectorAll('a[href^="/"]')) {
          const h = a.getAttribute("href");
          if (h && /^\\/[A-Za-z0-9_-]{3,25}$/.test(h) && !bad.test(h)) return "https://kick.com" + h;
        }
        return null;
      })()`);
      if (href) return href;
      await sleep(1000);
    }
    return null;
  } catch { return null; }
  finally { try { ws?.close(); } catch {} killChrome(proc); }
}

// عدة مرشّحات لكل موقع: أول رابط يعطي مشغّلاً حقيقياً هو المقيس، وما عداه يُسجَّل
// «لم يُقس» بسببه. **لا تعميم من موقع واحد** — السؤال كم موقعاً له نموذج خاص.
let port = 9411;
const MODE = ["--map", "--remedy"].includes(process.argv[2]) ? process.argv[2] : null;
const argUrl = MODE ? process.argv[3] : process.argv[2];

// وضع العلاجات: node tools/bench-host-volume.mjs --remedy "https://..."
if (MODE === "--remedy") {
  const rows = await measureRemedies(argUrl, port);
  const host = new URL(argUrl).host;
  console.log(`\n=== قياس العلاجات — ${host} · الهدف ${TARGET * 100}% ===\n`);
  if (rows.shape) { console.log("   شكل عنصر المستوى عند المضيف:");
    for (const l of rows.shape) console.log("     · " + l); console.log(""); }
  for (const r of rows) {
    console.log(`── (${r.id}) ${r.label}`);
    if (r.note) { console.log(`   ⚠️ ${r.note}\n`); continue; }
    const st = (x) => x ? `مستوى ${Math.round((x.volume ?? 0) * 1000) / 10}%${x.muted ? " (م)" : ""} · منزلق ${x.slider ?? "—"}` : "—";
    console.log(`   قبل            : ${st(r.before)}`);
    console.log(`   ما نُفِّذ       : ${r.applied ?? "—"}`);
    console.log(`   بعده           : ${st(r.after)}`);
    console.log(`   بعد دورة الكتم : ${st(r.afterCycle)}   (${r.via})`);
    // ⚠️ النجاة تُقاس على **ما تحقّق فعلاً** لا على الهدف: العلاج (د) يقود واجهة
    // المضيف بخطوات ثابتة ولا يصوّب إلى 30% أصلاً، فقياسه بالهدف يطبع ❌ كاذبة.
    const moved = r.before && r.after && Math.abs((r.after.volume ?? 0) - (r.before.volume ?? 0)) > 0.01;
    const survived = r.after && r.afterCycle &&
      Math.abs((r.afterCycle.volume ?? 0) - (r.after.volume ?? 0)) < 0.02;
    const sliderMoved = r.before && r.after && String(r.before.slider) !== String(r.after.slider);
    console.log(`   الحكم          : غيّر المستوى ${moved ? "✅" : "❌"} · نجا بعد الدورة ${survived ? "✅" : "❌"} · تبعه نموذج المضيف (المنزلق) ${sliderMoved ? "✅" : "❌"}`);
    console.log(`   تغيّر التخزين  : ${r.storeDiff?.length ? r.storeDiff.join(" · ") : "لا شيء"}\n`);
  }
  process.exit(0);
}

// وضع الخريطة: node tools/bench-host-volume.mjs --map "https://..."
if (process.argv[2] === "--map") {
  const map = await measureRestoreMap(argUrl, port++);
  console.log(`\n=== خريطة الاستعادة عند فكّ كتم المضيف — ${new URL(argUrl).host} ===\n`);
  for (const m of map) {
    if (m.error) { console.log(`   ⚠️ ${m.error}`); continue; }
    console.log(`   كتبنا ${String(Math.round((m.wrote ?? 0) * 1000) / 10).padStart(5)}%  ⇒  بعد الكتم ${String(Math.round((m.muted ?? 0) * 1000) / 10).padStart(5)}%  ⇒  بعد فكّه ${String(Math.round((m.back ?? 0) * 1000) / 10).padStart(5)}%   (${m.via})`);
  }
  console.log("");
  process.exit(0);
}

const targets = [];
if (argUrl) {
  targets.push({ name: new URL(argUrl).host, urls: [argUrl] });
} else {
  const yt = await youtubeUrl(port++);
  targets.push({ name: "youtube.com", urls: yt ? [yt] : [] });
  if (!yt) console.log("⚠️ تعذّر استخراج رابط يوتيوب حيّاً");
  targets.push({ name: "twitch.tv", urls: ["https://www.twitch.tv/", "https://www.twitch.tv/directory/all"] });
  targets.push({ name: "vimeo.com", urls: [
    "https://player.vimeo.com/video/76979871?autoplay=1&muted=1",
    "https://player.vimeo.com/video/76979871", "https://vimeo.com/76979871"] });
  targets.push({ name: "d.tube", urls: ["https://d.tube/watch/5MxdC3ajEpBwgcDCsrHRd5"] });
}

const rows = [];
for (const t of targets) {
  if (!t.urls.length) { rows.push({ name: t.name, url: "—", ok: false, note: "لا رابط صالح — لم يُقس" }); continue; }
  let r = null;
  for (const url of t.urls) {
    process.stdout.write(`\n⏳ ${t.name} ${url.slice(0, 52)} … `);
    r = await measure(t.name, url, port++);
    console.log(r.ok ? "تمّ" : (r.note || "لم يُقس"));
    if (r.ok) break;
  }
  rows.push(r);
}

const f = (x) => x == null ? "—" : (x.volume == null ? "—" : `${Math.round(x.volume * 1000) / 10}%${x.muted ? " (م)" : ""}`);

console.log("\n=== نموذج المستوى عند المضيف — هل تنجو كتابة الإضافة؟ ===\n");
for (const r of rows) {
  console.log(`── ${r.name}`);
  console.log(`   الرابط           : ${r.url}`);
  if (!r.ok) { console.log(`   ⚠️ ${r.note || "لم يُقس"}\n`); continue; }
  const wrote = r.write?.wrote;
  console.log(`   العنصر           : ${r.pick.w}×${r.pick.h} · readyState=${r.pick.readyState} · فيديوهات=${r.pick.count}`);
  const ser = (s) => s ? s.map(([t, v, m]) => `${t}ms:${v}%${m ? "م" : ""}`).join(" → ") : "—";
  console.log(`   كتابة 50% مطلقة  : ${ser(r.seriesSet)}`);
  console.log(`                    : ${r.seriesSet?.at(-1)?.[1] === 50 ? "✅ نجت بلا أي حدث منّا" : "❌ مُحيت بلا أي حدث منّا — للمضيف نموذج يفرضه"}`);
  console.log(`   رفع #35 (50→54)  : ${ser(r.seriesRaise)}`);
  console.log(`                    : ${r.seriesRaise?.at(-1)?.[1] === 54 ? "✅ نجت" : "❌ مُحيت"}`);
  console.log(`   قبل الكتابة      : ${Math.round((r.write?.before?.volume ?? 0) * 1000) / 10}%${r.write?.before?.muted ? " (مكتوم)" : ""}`);
  console.log(`   كتبنا            : ${Math.round((wrote ?? 0) * 1000) / 10}%`);
  console.log(`   قراءة فورية      : ${f(r.write && { volume: r.write.readBack, muted: r.write.mutedAfter })}  ${r.write && r.write.readBack === wrote ? "✅ وصلت" : "❌ لم تصل"}`);
  console.log(`   بعد 300ms سكون   : ${f(r.at300)}   ${r.at300?.volume === wrote ? "✅ نجت" : "❌ مُحيت"}`);
  console.log(`   بعد 1500ms سكون  : ${f(r.at1500)}   ${r.at1500?.volume === wrote ? "✅ نجت" : "❌ مُحيت"}`);
  console.log(`   بعد كتم المضيف   : ${f(r.hostMute)}   (${r.muteVia})`);
  console.log(`   بعد فكّ كتمه     : ${f(r.hostUnmute)}   (${r.unmuteVia})  ${r.hostUnmute?.volume === wrote ? "✅ نجت" : "❌ عادت لقيمته"}`);
  console.log(`   مستمعو volume*   : ${r.listeners == null ? "تعذّر العدّ" : (r.listeners.length ? r.listeners.join(" · ") : "صفر على العنصر نفسه")}`);
  {
    // بصمة الهوية: عنصر تبدّل بين الخطوات يجعل «مُحيت» و«عنصر آخر» رقماً واحداً
    const ids = [r.pick?.id, r.base?.id, r.write?.id, r.at1500?.id, r.hostUnmute?.id].filter(Boolean);
    const same = new Set(ids).size <= 1;
    console.log(`   هوية العنصر      : ${same ? "ثابتة عبر الخطوات ✅" : "❌ تبدّل: " + ids.join(" → ")}`);
  }
  console.log(`   تخزين محلي قبل   : ${JSON.stringify(r.storeBefore ?? {})}`);
  console.log(`   تخزين محلي بعد   : ${JSON.stringify(r.storeAfter ?? {})}`);
  console.log("");
}
process.exit(0);
