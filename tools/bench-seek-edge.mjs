// قياسا **#34** اللذان يسبقان أي كود (قرار المالك 2026-07-31)، وكلاهما في
// **«ما قد يكسره»** لا في «هل يعمل»:
//
//   (أ) **حافة البثّ:** ماذا يفعل المشغّل بعد تقديم **يتجاوز الحافة فعلاً** حين
//       تكون نهاية `seekable` **قيمة حدّية (2^30) لا نافذة**؟ يتجمّد؟ يتوقّف ثم
//       يلحق؟ يعود من نفسه إلى الحافة؟ **لا تُقرَّر قاعدة الحدّ الأعلى قبل رؤية
//       ما يفعله المشغّل.**
//   (ب) **`seekable` أضيق من `duration`:** فيديو **أثناء التحميل** لا بعده،
//       ومن خادم **لا يدعم النطاقات**. **فيديو واحد مكتمل التحميل لا يكفي حجّةً
//       على «لا تغيّر للفيديو العادي»**، و`seek()` **دالّة واحدة لكل تقديم في
//       المشروع** فالخطأ فيها يمسّ كل مستخدم.
//
// ⚠️ يحتاج كروم مثبَّتاً (والقسم «أ» يحتاج شبكة). **لا يُشحن.**
//   node tools/bench-seek-edge.mjs          # القسمان
//   node tools/bench-seek-edge.mjs --local  # القسم (ب) وحده، بلا شبكة
//
// **وثلاثة تُستوفى هنا بأمر المالك:**
//  · **قناة تويتش مسمّاة لا الواجهة** (قرار 19) — الواجهة تبدّل قناتها فلا يُعاد
//    القياس عليها.
//  · **تناقض الإرجاع** (−8.4s مقابل +0.05s): **يُرصد مرّتين أخريين**، وإن بقي
//    متناقضاً **سُجّل «غير مفسَّر»** ولا يُبنى عليه.
//  · **«خارج نافذة DVR» على يوتيوب:** الدلتا **تُشتقّ من النافذة المقيسة نفسها**
//    (`−(النافذة + 3600)`) لا من رقم مثبَّت — فـ`−7200s` بقيت **داخل** نافذة
//    `50380s`، وادّعاء الفرق بلا تجاوزها **لا يقع**.
import { spawn } from "node:child_process";
import http from "node:http";
// ⛔ **#100 — كان يُنادى بلا استيراد** (2026-08-04): `killChrome` أُدخلت في
// `f6e8a33` (المُنهي الواحد، #83) **ولم تُحدَّث الملفّات التي تناديها** —
// **21 نداءً في ستّة، كلُّها في `finally`** ⇒ **رميةٌ حتميّة وكرومُ لا يُقتل**،
// **فالتسرّبُ الذي بُني #83 لإنهائه بقي حيّاً فيها.**
import { killChrome } from "./ext-harness.mjs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SENTINEL = 1 << 29;
const PORT = 8823;

async function launch(port) {
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    `--user-data-dir=/tmp/vz-bench-edge-${port}-${process.pid}`,
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

const FIND = `const pick = () => {
  let best = null, area = -1;
  for (const v of document.querySelectorAll("video")) {
    const r = v.getBoundingClientRect();
    const a = r.width * r.height;
    if (a > area) { area = a; best = v; }
  }
  return best;
};`;

// حالة كاملة: **لا يُرشَّح شيء، والقارئ هو من يرشّح.** ومعها أحداث التوقّف
// (`waiting`/`stalled`/`seeking`/`seeked`) لأن «تجمّد» و«توقّف ثم لحق» لا
// يفترقان بـ`currentTime` وحده.
const STATE = `(() => { ${FIND} const v = pick(); if (!v) return null;
  const rng = (tr) => { const o = []; for (let i = 0; i < tr.length; i++)
    o.push([+tr.start(i).toFixed(2), +tr.end(i).toFixed(2)]); return o; };
  const s = rng(v.seekable);
  const end = s.length ? s[s.length - 1][1] : 0;
  return { t: +v.currentTime.toFixed(2), paused: v.paused, seeking: v.seeking,
           readyState: v.readyState, networkState: v.networkState,
           duration: String(v.duration), durationFinite: isFinite(v.duration),
           seekable: s, buffered: rng(v.buffered), sentinel: end >= ${SENTINEL},
           window: (end >= ${SENTINEL} || !s.length) ? null : +(end - s[0][0]).toFixed(2),
           ytAd: (() => { const m = document.querySelector("#movie_player");
                          return m ? m.classList.contains("ad-showing") : null; })(),
           ev: (window.__vzEv || []).slice(-12), w: Math.round(v.getBoundingClientRect().width) };
})()`;

const WATCH = `(() => { ${FIND} const v = pick(); if (!v || v.__vzWatched) return false;
  v.__vzWatched = true; window.__vzEv = [];
  const t0 = performance.now();
  for (const type of ["waiting", "stalled", "seeking", "seeked", "playing", "pause", "ended", "error"]) {
    v.addEventListener(type, () => window.__vzEv.push(type + "@" + Math.round(performance.now() - t0)));
  }
  return true; })()`;

// كتابة مباشرة بلا حارس — **السؤال هنا ما يفعله المشغّل، لا ما يفعله كودنا.**
// ⚠️ **يُفصل «المطلوب» عن «ما قُرئ بعده»، ولا يُخلطان في حقل واحد.** كان الحقل
// `wrote` هو **القراءة بعد الإسناد** فقُرئ «المطلوب»، فطبعت الأداة «وصل إلى
// هدفه» على خادم بلا نطاقات بينما المتصفّح **ردّ 49.47 إلى 0**. الرقم المحسوب
// ليس الرقم الواقع، والحكم يقارن **بالمطلوب** (قرار 26).
const WRITE = (expr) => `(() => { ${FIND} const v = pick(); if (!v) return null;
  const before = v.currentTime;
  const want = ${expr};
  try { v.currentTime = want; } catch (e) { return { threw: String(e && e.name || e).slice(0, 40) }; }
  return { before: +before.toFixed(2), requested: +want.toFixed(2),
           readBack: +v.currentTime.toFixed(2),
           clamped: Math.abs(v.currentTime - want) > 0.5 }; })()`;

async function waitPlayer(send, needLive) {
  let s = null;
  for (let i = 0; i < 70; i++) {
    s = await evalIn(send, STATE);
    if (s && s.readyState >= 1 && s.w > 0 && s.ytAd !== true &&
        (!needLive || !s.durationFinite || s.window > 30)) {
      await evalIn(send, WATCH);
      return { ok: true, state: s };
    }
    await sleep(1000);
  }
  return { ok: false, state: s };
}

// سلسلة مراقبة داخل الصفحة — لا يلوّثها زمن ذهاب وإياب CDP
async function series(send, ms, step = 500) {
  const out = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await evalIn(send, STATE);
    out.push([Math.round((Date.now() - t0) / 100) / 10, s?.t ?? null, s?.readyState ?? null,
              s?.paused ? 1 : 0, s?.seeking ? 1 : 0]);
    await sleep(step);
  }
  return out;
}

// ───────────────────────── القسم (أ): حافة البثّ ─────────────────────────────
async function twitchChannel(port) {
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port, "https://www.twitch.tv/directory/all");
    ws = c.ws;
    await c.send("Runtime.enable"); await c.send("Page.bringToFront");
    for (let i = 0; i < 30; i++) {
      const name = await evalIn(c.send, `(() => {
        const bad = /^\\/(directory|videos|settings|subscriptions|following|search|p|downloads|turbo|prime)/i;
        for (const a of document.querySelectorAll('a[href^="/"]')) {
          const h = a.getAttribute("href");
          if (h && /^\\/[A-Za-z0-9_]{3,25}$/.test(h) && !bad.test(h)) return h;
        }
        return null; })()`);
      if (name) return "https://www.twitch.tv" + name;
      await sleep(1000);
    }
    return null;
  } catch { return null; }
  finally { try { ws?.close(); } catch {} killChrome(proc); }
}

async function edgeRun(url, port, overshoot = "v.currentTime + 30") {
  const row = { url };
  let proc, ws;
  try {
    proc = await launch(port);
    const c = await attach(port, url);
    ws = c.ws;
    await c.send("Runtime.enable"); await c.send("Page.enable"); await c.send("Page.bringToFront");
    const ready = await waitPlayer(c.send, true);
    row.state = ready.state;
    if (!ready.ok) { row.note = "المشغّل لم يبدأ — لم يُقس"; return row; }

    // **الشاهد السالب**: تقدّم طبيعي بلا أي تقديم — وبه وحده يُعرف «يتقدّم».
    row.control = await series(c.send, 6000);

    // **التجاوُز**: إلى ما بعد الحافة فعلاً
    row.wrote = await evalIn(c.send, WRITE(overshoot));
    row.after = await series(c.send, 16000);
    row.stateAfter = await evalIn(c.send, STATE);

    // **الإرجاع مرّتين** — لأن الرصد السابق تناقض بين تشغيلتين
    row.back = [];
    for (let i = 0; i < 2; i++) {
      const b0 = await evalIn(c.send, STATE);
      const w = await evalIn(c.send, WRITE(`v.currentTime - 30`));
      await sleep(1500);
      const b1 = await evalIn(c.send, STATE);
      row.back.push({ before: b0?.t, requested: w?.requested, readBack: w?.readBack, after: b1?.t,
                      net: (b0 && b1) ? +(b1.t - b0.t - 1.5).toFixed(2) : null });
      await sleep(1500);
    }
    row.ok = true;
    return row;
  } catch (e) { row.note = "فشل: " + String(e?.message || e).slice(0, 70); return row; }
  finally { try { ws?.close(); } catch {} killChrome(proc); }
}

// ─────────────── القسم (ب): `seekable` أضيق من `duration` ────────────────────
// خادم محلّي بنقطتين: واحدة **تدعم النطاقات** وأخرى **لا تدعمها ولا تعلنها**،
// وكلتاهما **مخنوقة** كي يُقاس أثناء التحميل لا بعده. المصدر WAV مركَّب هنا:
// لا ملف في المستودع ولا شبكة، فالقياس **حتميّ**.
function wav(seconds, rate = 44100) {
  const n = seconds * rate;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 12000), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
const MEDIA = wav(90);
const THROTTLE = 400 * 1024; // بايت/ثانية

async function serveThrottled(res, buf, from, to) {
  const chunk = 32 * 1024;
  for (let p = from; p <= to; p += chunk) {
    if (res.destroyed) return;
    res.write(buf.subarray(p, Math.min(to + 1, p + chunk)));
    await sleep(Math.round(chunk / THROTTLE * 1000));
  }
  res.end();
}

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<video id="v" width="640" height="360" playsinline></video>
<script>
const v = document.getElementById("v");
window.__load = (path) => { v.src = path; v.play().catch(() => {}); return v.src; };
</script></body>`;

function makeServer() {
  return http.createServer(async (q, res) => {
    if (q.url.startsWith("/ranges.wav")) {
      const range = q.headers.range;
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        const from = m ? +m[1] : 0;
        const to = m && m[2] ? +m[2] : MEDIA.length - 1;
        res.writeHead(206, { "content-type": "audio/wav", "accept-ranges": "bytes",
          "content-range": `bytes ${from}-${to}/${MEDIA.length}`, "content-length": to - from + 1 });
        return serveThrottled(res, MEDIA, from, to);
      }
      res.writeHead(200, { "content-type": "audio/wav", "accept-ranges": "bytes",
        "content-length": MEDIA.length });
      return serveThrottled(res, MEDIA, 0, MEDIA.length - 1);
    }
    if (q.url.startsWith("/noranges.wav")) {
      // **لا `accept-ranges` ولا استجابة 206 إطلاقاً** — يُتجاهل أي `Range`.
      res.writeHead(200, { "content-type": "audio/wav", "content-length": MEDIA.length });
      return serveThrottled(res, MEDIA, 0, MEDIA.length - 1);
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
  });
}

// المقارنة الحاكمة: **هل يختلف هدف الاقتصاص بين اليوم والمقترح؟**
//   اليوم   : clamp(t + d, 0, duration)
//   المقترح : clamp(t + d, seekable.start(0), seekable.end(الأخير))
const COMPARE = (delta) => `(() => { ${FIND} const v = pick(); if (!v) return null;
  const t = v.currentTime, d = ${delta};
  const today = isNaN(v.duration) || !isFinite(v.duration)
    ? null : Math.max(0, Math.min(t + d, v.duration));
  const s = v.seekable;
  const proposed = s.length === 0 ? null
    : Math.max(s.start(0), Math.min(t + d, s.end(s.length - 1)));
  return { t: +t.toFixed(2), today: today == null ? null : +today.toFixed(2),
           proposed: proposed == null ? null : +proposed.toFixed(2),
           differ: today != null && proposed != null && Math.abs(today - proposed) > 0.05 };
})()`;

async function localRun(port) {
  const rows = [];
  let proc, ws;
  const srv = makeServer();
  await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));
  try {
    proc = await launch(port);
    const c = await attach(port, `http://127.0.0.1:${PORT}/`);
    ws = c.ws;
    await c.send("Runtime.enable"); await c.send("Page.enable"); await c.send("Page.bringToFront");
    await sleep(600);
    for (const [label, path] of [["خادم يدعم النطاقات", "/ranges.wav"],
                                 ["خادم **لا** يدعم النطاقات", "/noranges.wav"]]) {
      const row = { label, path, samples: [] };
      await evalIn(c.send, `window.__load(${JSON.stringify(path + "?" + Math.round(port) + label.length)})`);
      // **أثناء التحميل لا بعده**: عيّنات مبكّرة ومتوسّطة ومتأخّرة
      for (const at of [1500, 4000, 8000, 14000, 22000]) {
        const t0 = Date.now();
        while (Date.now() - t0 < at / 5) await sleep(200);
        await sleep(Math.max(0, at / 5));
        const s = await evalIn(c.send, STATE);
        const cmp = await evalIn(c.send, COMPARE(30));
        row.samples.push({ at, s, cmp });
      }
      // تقديم فعليّ بالحدّين، وقراءة ما وقع
      row.seekToday = await evalIn(c.send, WRITE(`Math.max(0, Math.min(v.currentTime + 30, v.duration))`));
      await sleep(1200);
      row.afterToday = await evalIn(c.send, STATE);
      rows.push(row);
    }
    return rows;
  } catch (e) { return [{ label: "فشل", note: String(e?.message || e).slice(0, 70) }]; }
  finally {
    try { ws?.close(); } catch {} killChrome(proc); try { srv.close(); } catch {}
  }
}

// ───────────────────────────── التشغيل ──────────────────────────────────────
let port = 9511;
const LOCAL_ONLY = process.argv[2] === "--local";

console.log("\n=== #34 — قياسا «ما قد يكسره»، قبل أي كود ===");

if (!LOCAL_ONLY) {
  const ch = await twitchChannel(port++);
  console.log(`\n══ (أ) حافة البثّ — تويتش`);
  if (!ch) {
    console.log("   ⚠️ تعذّر استخراج قناة مسمّاة — **لم يُقس** (ولا يُقاس على الواجهة: تبدّل قناتها)");
  } else {
    process.stdout.write(`⏳ ${ch} … `);
    const r = await edgeRun(ch, port++);
    console.log(r.ok ? "تمّ" : (r.note || "لم يُقس"));
    console.log(`   الموقع (قرار 19): ${ch}`);
    if (!r.ok) { console.log(`   ⚠️ ${r.note}`); }
    else {
      const s = r.state;
      console.log(`   duration=${s.duration} · seekable=${JSON.stringify(s.seekable)}` +
        (s.sentinel ? " ⚠️ **قيمة حدّية لا نافذة**" : ` ⇒ نافذة ${s.window}s`));
      const fmt = (a) => a.map(([t, c, rs, p, sk]) => `${t}s:${c}${p ? "⏸" : ""}${sk ? "⏳" : ""}/rs${rs}`).join(" ");
      console.log(`   الشاهد السالب (بلا تقديم): ${fmt(r.control)}`);
      console.log(`   كتبنا: ${r.wrote?.before} ⇒ ${r.wrote?.wrote}${r.wrote?.threw ? ` (رمى ${r.wrote.threw})` : ""}`);
      console.log(`   بعد التجاوُز            : ${fmt(r.after)}`);
      console.log(`   الأحداث                : ${(r.stateAfter?.ev || []).join(" · ") || "لا شيء"}`);
      // **التصنيف يفحص شرطه قبل أن ينطق** (قرار 26)
      const ctrlRate = (r.control.at(-1)[1] - r.control[0][1]) / ((r.control.at(-1)[0] - r.control[0][0]) || 1);
      const a0 = r.after[0], aN = r.after.at(-1);
      const rate = (aN[1] - a0[1]) / ((aN[0] - a0[0]) || 1);
      const backNearStart = Math.abs(aN[1] - (r.wrote?.before ?? 0)) < 12;
      console.log(`   معدّل التقدّم           : الشاهد ${ctrlRate.toFixed(2)}× · بعد التجاوُز ${rate.toFixed(2)}×`);
      if (ctrlRate < 0.5) {
        console.log(`   ⇒ **لا يُستنبَط**: الشاهد السالب نفسه لا يتقدّم (${ctrlRate.toFixed(2)}×) — لا مدى يُحكم فيه`);
      } else if (backNearStart) {
        console.log(`   ⇒ **عاد إلى الحافة من نفسه** (استقرّ عند ${aN[1]} قرب ما قبل التجاوُز ${r.wrote?.before})`);
      } else if (rate > 0.5) {
        console.log(`   ⇒ **توقّف ثم لحق**: التقدّم عاد إلى ${rate.toFixed(2)}× بعد التجاوُز`);
      } else {
        console.log(`   ⇒ **متجمّد**: التقدّم ${rate.toFixed(2)}× بينما الشاهد ${ctrlRate.toFixed(2)}×`);
      }
      console.log(`   الإرجاع ×2             : ` + r.back.map((b, i) =>
        `[${i + 1}] ${b.before} ⇒ طلبنا ${b.requested} ⇒ قُرئ ${b.readBack} ⇒ صار ${b.after} (صافي ${b.net}s)`).join("  ·  "));
      // ⚠️ **الاتجاه يُفحص لا مقداره وحده.** طبعت الأداة «الإرجاع وقع في المرّتين»
      // بينما الثانية كانت **+18.95s إلى الأمام** — قفزةً إلى الحافة لا إرجاعاً.
      // **|net| > 5 يعدّ القفزة الأمامية إرجاعاً**، وهو حكم لا يسنده قياسه (قرار 26).
      const nets = r.back.map((b) => b.net).filter((x) => x != null);
      const backOk = nets.filter((n) => n < -5).length;
      const fwd = nets.filter((n) => n > 5).length;
      console.log(`   ⇒ الإرجاع ${backOk === nets.length ? "**وقع إلى الخلف في المرّتين**"
        : backOk === 0 ? `**لم يقع إلى الخلف ولا مرّة**${fwd ? ` — وقفز إلى الأمام ${fwd} مرّة` : ""}`
        : `**متناقض: ${backOk} إلى الخلف و${fwd} إلى الأمام — غير مفسَّر، ولا يُبنى عليه**`}`);
    }
  }
}

// ── (ج) «خارج نافذة DVR» على يوتيوب — الدلتا **مشتقّة من النافذة المقيسة** ───
// `−7200s` بقيت **داخل** نافذة `50380s`، فالفرق داخل/خارج **لم يقع**. ونافذة
// يوتيوب تبدأ من **0**، فلا «خارج» إلى الخلف أصلاً — **الخارج الوحيد هو أمام
// الحافة**، وهو نظير القسم (أ) على مضيف يعلن نافذة حقيقية.
if (!LOCAL_ONLY) {
  console.log(`\n══ (ج) خارج نافذة DVR — يوتيوب مباشر`);
  let live = null;
  {
    let proc, ws;
    try {
      const p = port++;
      proc = await launch(p);
      const c = await attach(p, "https://www.youtube.com/results?search_query=24%2F7+live&sp=EgJAAQ%253D%253D");
      ws = c.ws;
      await c.send("Runtime.enable"); await c.send("Page.bringToFront");
      for (let i = 0; i < 25; i++) {
        const hs = await evalIn(c.send,
          `[...document.querySelectorAll('a#video-title, a[href^="/watch?v="]')].map((a) => a.href).slice(0, 3)`);
        if (hs?.length) { live = hs.map((h) => h.split("&")[0]); break; }
        await sleep(1000);
      }
    } catch {} finally { try { ws?.close(); } catch {} killChrome(proc); }
  }
  if (!live?.length) {
    console.log("   ⚠️ تعذّر استخراج بثّ مباشر — **لم يُقس، والفرق داخل/خارج لا يُدّعى**");
  } else {
    let r = null;
    for (const u of live) {
      process.stdout.write(`⏳ ${u} … `);
      // **إلى ما بعد الحافة بعشر دقائق، مشتقّاً من `seekable` المقيسة لا من رقم مثبَّت**
      r = await edgeRun(u, port++, "v.seekable.end(v.seekable.length - 1) + 600");
      console.log(r.ok ? "تمّ" : (r.note || "لم يُقس"));
      if (r.ok) break;
    }
    console.log(`   الموقع (قرار 19): ${r?.url}`);
    if (!r?.ok) console.log(`   ⚠️ ${r?.note || "لم يُقس"} — **والفرق داخل/خارج غير مقيس على يوتيوب ولا يُدّعى**`);
    else {
      const s = r.state;
      const fmt = (a) => a.map(([t, c, rs, p, sk]) => `${t}s:${c}${p ? "⏸" : ""}${sk ? "⏳" : ""}/rs${rs}`).join(" ");
      console.log(`   duration=${s.duration} · seekable=${JSON.stringify(s.seekable)} ⇒ **نافذة ${s.window}s**`);
      console.log(`   الشاهد السالب (بلا تقديم): ${fmt(r.control)}`);
      console.log(`   طلبنا ${r.wrote?.requested} (خارج الحافة بـ600s) ⇒ قُرئ ${r.wrote?.readBack}` +
        `${r.wrote?.clamped ? " ⚠️ **قصّه المتصفّح**" : " (قُبل كما هو)"}`);
      console.log(`   بعده                   : ${fmt(r.after)}`);
      console.log(`   الأحداث                : ${(r.stateAfter?.ev || []).join(" · ") || "لا شيء"}`);
      const c0 = r.control, a0 = r.after[0], aN = r.after.at(-1);
      const ctrl = (c0.at(-1)[1] - c0[0][1]) / ((c0.at(-1)[0] - c0[0][0]) || 1);
      const rate = (aN[1] - a0[1]) / ((aN[0] - a0[0]) || 1);
      console.log(`   معدّل التقدّم           : الشاهد ${ctrl.toFixed(2)}× · بعد التجاوُز ${rate.toFixed(2)}×`);
      if (ctrl < 0.5) console.log(`   ⇒ **لا يُستنبَط**: الشاهد نفسه لا يتقدّم`);
      else if (r.wrote?.clamped) console.log(`   ⇒ **المتصفّح قصّ الطلب إلى داخل النافذة** — فلا تجاوُز وقع أصلاً`);
      else if (rate > 0.5) console.log(`   ⇒ **توقّف ثم لحق** (${rate.toFixed(2)}×)`);
      else console.log(`   ⇒ **متجمّد** (${rate.toFixed(2)}× بينما الشاهد ${ctrl.toFixed(2)}×)`);
    }
  }
}

console.log(`\n══ (ب) \`seekable\` أضيق من \`duration\` — خادم محلّي حتميّ`);
const local = await localRun(port++);
for (const row of local) {
  console.log(`\n── ${row.label}  (${row.path || ""})`);
  if (row.note) { console.log(`   ⚠️ ${row.note}`); continue; }
  for (const sm of row.samples) {
    const s = sm.s, c = sm.cmp;
    console.log(`   عند ${String(sm.at).padStart(5)}ms: duration=${s?.duration?.slice(0, 8)} · seekable=${JSON.stringify(s?.seekable)} · buffered=${JSON.stringify(s?.buffered)}`);
    console.log(`              الهدف لـ+30s ⇒ اليوم ${c?.today} · المقترح ${c?.proposed}  ${c?.differ ? "❌ **يختلفان**" : "✅ متطابقان"}`);
  }
  // **وهل ينجح تقديم اليوم أصلاً هناك؟** رقمٌ محسوب ليس رقماً واقعاً.
  console.log(`   تقديم اليوم فعلياً: ${row.seekToday?.before} ⇒ **طلبنا** ${row.seekToday?.requested}` +
    ` ⇒ **قرأنا فوراً** ${row.seekToday?.readBack}${row.seekToday?.clamped ? " ⚠️ **قصّه المتصفّح**" : ""}` +
    ` ⇒ بعد 1.2s ${row.afterToday?.t} · rs=${row.afterToday?.readyState}`);
  const landed = row.seekToday && row.afterToday &&
    Math.abs(row.afterToday.t - row.seekToday.requested) < 3;
  console.log(`              ⇒ ${landed ? "✅ وصل إلى **المطلوب**" : "❌ **لم يصل إلى المطلوب** — والمتصفّح هو من قصّه لا حسابنا"}`);
  const diff = row.samples.some((x) => x.cmp?.differ);
  console.log(`   ⇒ ${diff ? "**يختلف الهدف في عيّنة واحدة على الأقل** — الانتقال إلى `seekable` **يغيّر سلوك الفيديو العادي**"
                          : "**لا اختلاف في أي عيّنة** — الحدّان متطابقان طوال التحميل"}`);
  // **نطاق فارغ ليس نطاقاً غائباً**: `[[0,0]]` طوله 1، فقاعدة «الرفض عند
  // `seekable.length === 0` وحدها» **لا تُطلَق أصلاً** والهدف يصير 0 — أي
  // **قفزة إلى أول الفيديو في كل تقديم**. يُطبع صريحاً لأنه بيت القصيد.
  const empty = row.samples.some((x) => {
    const s = x.s?.seekable;
    return s && s.length === 1 && Math.abs(s[0][1] - s[0][0]) < 0.01;
  });
  if (empty) {
    console.log(`   ⚠️ **`+"`seekable = [[0,0]]`"+` — نطاق فارغ وطوله 1 لا 0.** فقاعدة «الرفض عند`+
      " `seekable.length === 0` وحده» **لا تُطلَق**، والهدف يصير **0** ⇒ **كل تقديم يقفز إلى أول الفيديو**");
  }
}
console.log("");
process.exit(0);
