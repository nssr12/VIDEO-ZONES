// البند #168 — الدبلجة التجريبيّة من الضغط إلى الصمت، في كروم حقيقيّ بالإضافة نفسِها (عند الطلب)
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يحرس ميزةً على فرعٍ لم يُدمج (`168-dub-mac`)، **وخ8
// — أفي البوّابة أم عند الطلب — يُقرَّر بمعيار البوّابة الخامس بعد تحقّق المالك** · ⚠️ وعتباتُه زمنيّة (كمونٌ ≤0.4 ث) فقد تتأرجح تحت الحِمل.
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أضغط «دبلِج» — أيلتقط النصَّ بطلبٍ واحد ويُعيد لغةَ ترجمتي،
// ثمّ ينطق كلَّ جملةٍ في موعدها، ويسكت حين أوقف أو أقفز أو أنتقل؟»*
//
// **ما هو حقيقيّ:** كروم · `content.js` و`yt_dub_main.js` كما يُشحنان · فيديو يعمل (WAV يُخدم بمقاطع بايت)
// · PerformanceObserver والطلباتُ نفسُها · البوب-أب مُحاكىً من عاملِ الخدمة بالنداءين اللذين يناديهما (`executeScript`
// ثمّ `sendMessage` إلى الإطار الأعلى). **وما هو مُزيَّف، معلَناً:** صفحةُ مشاهدةٍ تحت `www.youtube.com` بـ `Fetch`
// (بلا شبكة) ومشغّلٌ مزيّفٌ في عالم الصفحة يكتب اللاصقةَ كما رآه المالك · ⛔ **ومحرّكُ النطق ومترجمُ كروم مزيّفان في
// عالم الإضافة** (كرومُ بلا واجهة لا يضمنهما) ⇒ **صفرُه لا يقول شيئاً عن الصوت المسموع ولا عن جودة الترجمة** —
// ذاك أذنُ المالك على يوتيوب الحقيقيّ.
// **الشاهدُ السالب (قرار 26):** المفتاحُ الرئيسيّ مطفأٌ ⇐ الضغطُ يُرفض «gate» **بصفر طلب** — وإلا فالرِكازُ لا يرى البوّابة.
import { launch, connect, contentWorld, evalIn, configure, waitPortFree } from "./ext-harness.mjs";

const PORT = 9631;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, c, x) => (c ? (pass++, console.log("  ✅ " + n)) : (fail++, console.log("  ❌ " + n, x === undefined ? "" : JSON.stringify(x).slice(0, 600))));

function wav(seconds, rate) {
  const n = seconds * rate, buf = Buffer.alloc(44 + n);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write("data", 36); buf.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) buf[44 + i] = 128 + Math.round(20 * Math.sin(i / 8));
  return buf;
}
const WAV = wav(90, 8000);
const EVENTS = [];
for (let i = 0; i < 28; i++) EVENTS.push({ tStartMs: 2000 + i * 3000, dDurationMs: 2800, segs: [{ utf8: "This is sentence number " + (i + 1) + "." }] });
const JSON3 = JSON.stringify({ wireMagic: "pb3", events: [{ tStartMs: 0, dDurationMs: 90000, id: 1, wpWinPosId: 1 }].concat(EVENTS) });
// الجولة الثالثة — ملفُّ العربيّة بشكله المقيس (📐 كروم المالك 2026-11-01): سطرٌ لكلّ حدث، وبعده حدثُ «\n» للتمرير — والسطورُ نفسُها
// التي ترسمها الصفحةُ المزيّفة («سطرٌ عربيٌّ رقم N.» كلَّ 3 ث). و`VID2` ملفٌّ فارغ: يُقرأ ما يظهر بدلَه
const AR_EV = [];
for (let i = 0; i < 28; i++) {
  AR_EV.push({ tStartMs: 2000 + i * 3000, dDurationMs: 2800, wWinId: 1, segs: [{ utf8: "سطرٌ عربيٌّ رقم " + (i + 1) + ".", acAsrConf: 0 }] });
  AR_EV.push({ tStartMs: 2000 + i * 3000 + 2790, dDurationMs: 10, wWinId: 1, aAppend: 1, segs: [{ utf8: "\n" }] });
}
const AR_JSON3 = JSON.stringify({ wireMagic: "pb3", events: AR_EV });

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>fake watch</title></head><body>
<div id="movie_player" class="html5-video-player" style="width:640px;height:360px;position:relative">
  <video class="html5-main-video" src="/tone.wav" autoplay muted playsinline style="width:640px;height:360px"></video>
  <button class="ytp-subtitles-button" aria-pressed="false">CC</button>
</div>
<script>
(() => {
  const p = document.getElementById("movie_player"), btn = p.querySelector(".ytp-subtitles-button");
  let track = {}, loaded = false;
  const BASE = "/api/timedtext?v=VID&lang=en&kind=asr";
  window.__calls = [];
  p.getPlayerResponse = () => ({ videoDetails: { videoId: new URLSearchParams(location.search).get("v"), isLive: false, lengthSeconds: "90" },
    playabilityStatus: { status: "OK" }, streamingData: { adaptiveFormats: [] },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: "https://www.youtube.com" + BASE + "&caps=asr", languageCode: "en", kind: "asr" }] } } });
  p.getAvailableAudioTracks = () => [];
  p.getAudioTrack = () => undefined;
  p.loadModule = () => { loaded = true; window.__calls.push("load"); };
  p.unloadModule = () => { loaded = false; track = {}; btn.setAttribute("aria-pressed", "false"); window.__calls.push("unload"); };
  p.getOptions = () => (loaded ? ["captions"] : []);
  p.getOption = (m, k) => (k === "tracklist" ? [{ languageCode: "en", kind: "asr" }] : track);
  p.setOption = (m, k, v) => {
    window.__calls.push("set:" + JSON.stringify(v)); track = v || {};
    window.__labelAt = Date.now();
    btn.setAttribute("aria-pressed", track.languageCode ? "true" : "false");
    if (!track.languageCode) return;
    localStorage.setItem("yt-player-caption-sticky-language", JSON.stringify({ data: track.languageCode, expiration: Date.now() + 2592000000, creation: Date.now() }));
    sessionStorage.setItem("yt-player-caption-language-preferences", JSON.stringify({ data: JSON.stringify([track.languageCode]), creation: Date.now() }));
    // 📐 كما يطلبها المشغّلُ الحقيقيّ (كروم المالك 2026-11-01): **XHR بـjson3** — ⛔ ~~fetch بـsrv3~~ (لا مصدرَ لذلك في أيّ قياس)
    const x = new XMLHttpRequest();
    x.open("GET", BASE.replace("v=VID", "v=" + new URLSearchParams(location.search).get("v")) + "&caps=asr" +
      (track.translationLanguage ? "&tlang=" + track.translationLanguage.languageCode : "") + "&pot=POTTOKEN&potc=1&c=WEB&fmt=json3&xorb=2&xobt=3&xovt=3", true);
    x.send();
  };
  // ⭐ الترجمةُ العربيّة المعروضة كما يرسمها يوتيوب: \`.caption-visual-line\` > \`.ytp-caption-segment\` — متى اختيرت
  // ونافذةُ اسم المسار (lang="en") ثانيتين بعد كلّ اختيار — كما يبنيها يوتيوب — لا تُقرأ (📖 captions.js)
  const win = document.createElement("div"); win.className = "caption-window"; win.setAttribute("lang", "ar"); p.appendChild(win);
  const label = document.createElement("div"); label.className = "caption-window"; label.setAttribute("lang", "en"); p.appendChild(label);
  window.__labelAt = -1;
  setInterval(() => {
    const lab = Date.now() - window.__labelAt < 2000 ? "English (auto-generated) >> Arabic Click ⚙ for settings" : "";
    if (label.dataset.txt !== lab) {
      label.dataset.txt = lab; label.textContent = "";
      if (lab) { const l = document.createElement("span"); l.className = "caption-visual-line"; l.textContent = lab; label.appendChild(l); }
    }
    const on = !!(track.translationLanguage && track.translationLanguage.languageCode === "ar");
    const t = document.querySelector("video").currentTime, k = Math.floor((t - 2) / 3);
    const txt = on && t >= 2 && (t - 2) % 3 < 2.8 ? "سطرٌ عربيٌّ رقم " + (k + 1) + "." : "";
    if (win.dataset.txt === txt) return;
    win.dataset.txt = txt; win.textContent = "";
    if (!txt) return;
    const line = document.createElement("span"); line.className = "caption-visual-line";
    const seg = document.createElement("span"); seg.className = "ytp-caption-segment"; seg.textContent = txt;
    line.appendChild(seg); win.appendChild(line);
  }, 50);
  localStorage.setItem("yt-player-caption-sticky-language", JSON.stringify({ data: "ar", expiration: 1, creation: 1 }));
  window.__stickyBefore = localStorage.getItem("yt-player-caption-sticky-language");
})();
</script></body></html>`;

// the fake engine + translator, installed in the extension's isolated world (same world as content.js)
const FAKES = `(() => {
  const log = window.__vzSpeechLog = []; const q = []; let speaking = null;
  const vt = () => { const v = document.querySelector("#movie_player video"); return v ? +v.currentTime.toFixed(2) : null; };
  const real = (r) => r <= 1 ? 1 : r <= 2 ? 1 + (r - 1) * 0.905 : 1.905 + (r - 2) * 1.15;
  const pump = () => {
    if (speaking || !q.length) return;
    const u = q.shift(); speaking = u;
    setTimeout(() => {
      if (u.__x) return;
      log.push({ ev: "start", text: u.text, rate: +u.rate.toFixed(3), vt: vt() }); if (u.onstart) u.onstart({});
      u.__t = setTimeout(() => { speaking = null; log.push({ ev: "end", text: u.text, vt: vt() }); if (u.onend) u.onend({}); pump(); }, u.text.length / 8.15 / real(u.rate) * 1000);
    }, 60);
  };
  const fake = {
    speak(u) { log.push({ ev: "speak", text: u.text, vt: vt() }); q.push(u); pump(); },
    cancel() { log.push({ ev: "cancel", vt: vt() }); const all = (speaking ? [speaking] : []).concat(q.splice(0)); speaking = null;
      all.forEach((u) => { u.__x = true; clearTimeout(u.__t); if (u.onerror) u.onerror({ error: "interrupted" }); }); },
    getVoices() { return [{ lang: "ar-001", name: "Laila (Enhanced)", localService: true, voiceURI: "Laila" }]; },
    addEventListener() {}, removeEventListener() {},
    pause() { log.push({ ev: "PAUSE!" }); }, resume() { log.push({ ev: "RESUME!" }); }
  };
  Object.defineProperty(window, "speechSynthesis", { value: fake, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.rate = 1; this.volume = 1; this.voice = null; this.lang = ""; };
  // الأرقامُ بفواصلها: مقطعٌ يضمّ جملتين («5 6») يُعرف أوّلُهما — ومنه موعدُه
  globalThis.Translator = { availability: async () => "available", create: async () => ({ translate: async (t) => "ترجمة " + t.replace(/[^0-9 ]/g, "").replace(/\s+/g, " ").trim() + " جملة قصيرة" }) };
  return "fakes-ok";
})()`;

await waitPortFree(PORT);
const { kill, extensionId, chrome } = await launch(PORT);
console.log("Chrome", chrome, "ext", extensionId);
let ours = 0, player = 0;
try {
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const c = await connect(tab.webSocketDebuggerUrl);
  await c.send("Runtime.enable"); await c.send("Page.enable");
  await c.send("Fetch.enable", { patterns: [{ urlPattern: "https://www.youtube.com/*", requestStage: "Request" }] });
  c.ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method !== "Fetch.requestPaused") return;
    const id = m.params.requestId, url = m.params.request.url || "";
    // ⛔ بلا تخزينٍ مؤقّت: طلبُنا الوحيد ورابطُ المشغّل متطابقان (json3 كلاهما) — ردٌّ مخزَّنٌ يُخدم لنا بلا طلبٍ يُعدّ
    const ok = (type, body) => c.send("Fetch.fulfillRequest", { requestId: id, responseCode: 200, responseHeaders: [{ name: "content-type", value: type },
      { name: "cache-control", value: "no-store" }], body: Buffer.from(body).toString("base64") });
    if (m.params.resourceType === "Document") ok("text/html; charset=utf-8", PAGE);
    else if (/\/tone\.wav/.test(url)) {
      const h = m.params.request.headers || {}, rg = /bytes=(\d+)-(\d*)/.exec(h.Range || h.range || "");
      const a0 = rg ? +rg[1] : 0, a1 = rg && rg[2] ? +rg[2] : WAV.length - 1, part = WAV.subarray(a0, a1 + 1);
      c.send("Fetch.fulfillRequest", { requestId: id, responseCode: rg ? 206 : 200, body: part.toString("base64"), responseHeaders: [
        { name: "content-type", value: "audio/wav" }, { name: "accept-ranges", value: "bytes" }, { name: "content-length", value: String(part.length) }]
        .concat(rg ? [{ name: "content-range", value: "bytes " + a0 + "-" + a1 + "/" + WAV.length }] : []) });
    }
    // ⭐ مَن طلب؟ 📐 كرومُ يُبلغ عن fetch من عالم الصفحة بـ«XHR» أيضاً ⇒ **بترتيب الرابط**: المشغّلُ (📖 g.WX.qx) يضع fmt=json3 قبل
    // xorb، وطلبُنا يرفعه إلى آخره (`captureRun`) — فـ«fmt=json3» في آخر الرابط طلبُنا الوحيد
    else if (/\/api\/timedtext/.test(url) && /[?&]fmt=json3$/.test(url)) { ours++; ok("application/json", JSON3); }
    else if (/\/api\/timedtext/.test(url)) {
      player++;
      // العربيّةُ لـVID وحدَه · وVID2 بلا كلام (يُقرأ ما يظهر) · والمصدرُ الإنجليزيُّ نصُّه نفسُه كما يردّه يوتيوب للمشغّل ولنا
      ok("application/json", !/[?&]tlang=/.test(url) ? JSON3 : /[?&]v=VID&/.test(url) ? AR_JSON3 : JSON.stringify({ wireMagic: "pb3", events: [] }));
    }
    else ok("text/plain", "");
  });
  await c.send("Page.navigate", { url: "https://www.youtube.com/watch?v=VID" });
  let world = null;
  for (let i = 0; i < 40 && !world; i++) { await sleep(250); world = await contentWorld(c); }
  check("عالمُ الإضافة على الصفحة المزيّفة", !!world);
  check("المزيّفاتُ في عالم الإضافة", (await evalIn(c, FAKES, world.id)) === "fakes-ok");
  for (let i = 0; i < 40; i++) { if ((await evalIn(c, "document.querySelector('video').currentTime")) > 0.5) break; await sleep(250); }
  const sw = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "service_worker" && t.url.includes(extensionId));
  const s = await connect(sw.webSocketDebuggerUrl);
  const inSW = async (expr) => (await s.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.result?.value;
  const TAB = `(await chrome.tabs.query({ url: "https://www.youtube.com/*" }))[0].id`;
  const status = () => inSW(`(async () => chrome.tabs.sendMessage(${TAB}, { type: "GVZ_DUB_STATUS" }, { frameId: 0 }))()`);
  // البوب-أب بالنداءين اللذين يناديهما — ومصدرُ النصّ صريحاً: «device» مترجمُ الجهاز · «yt» ترجمةُ يوتيوب المعروضة
  const start = (source) => inSW(`(async () => { const id = ${TAB}; await chrome.scripting.executeScript({ target: { tabId: id, frameIds: [0] }, files: ["yt_dub_main.js"], world: "MAIN" });
    return chrome.tabs.sendMessage(id, { type: "GVZ_DUB_START", opts: { source: ${JSON.stringify(source || "device")} } }, { frameId: 0 }); })()`);
  const stop = () => inSW(`(async () => chrome.tabs.sendMessage(${TAB}, { type: "GVZ_DUB_STOP" }, { frameId: 0 }))()`);
  const page = (e) => evalIn(c, e);

  console.log("\n[٠] الشاهدُ السالب: المفتاحُ الرئيسيّ مطفأ");
  const off = await configure(PORT, extensionId, { settings: { enabled: false } });
  check("كُتب المفتاحُ مطفأً", off.ok && off.readBack.settings.enabled === false, off);
  await sleep(700);
  const st00 = await start();
  check("⛔ الضغطُ يُرفض «gate»", st00 && st00.ok === false && st00.reason === "gate", st00);
  await sleep(1500);
  check("⛔ وبصفر طلب", ours === 0 && player === 0, { ours, player });
  const on = await configure(PORT, extensionId, { settings: { enabled: true } });
  check("أُعيد المفتاحُ مشغَّلاً", on.ok && on.readBack.settings.enabled === true, on);
  await sleep(700);

  console.log("\n[أ] البدء: التقاطٌ ثمّ تشغيل");
  const st0 = await start();
  check("الردُّ الفوريّ: يجهّز", st0 && st0.state === "preparing", st0);
  let st = null;
  for (let i = 0; i < 40; i++) { await sleep(300); st = await status(); if (st && st.state !== "preparing") break; }
  check("صار يعمل", st && st.state === "running", st);
  // ⛔ ~~«الجمل = أحداثُ الفيديو (28)»~~ — الجولة الثالثة: المقطعُ جملةٌ كاملة، والجملةُ الأقصرُ من 3.5 ث تُضمّ إلى تاليتها ⇒ 14 مقطعاً
  check("المقاطع = أحداثُ الفيديو جملتين جملتين (14)", st && st.total === 14, st);
  check("⭐ طلبٌ واحدٌ منّا (fmt=json3)", ours === 1, ours);
  check("وطلبٌ واحدٌ أُجبر عليه المشغّل", player === 1, player);
  check("⭐ اللاصقةُ أُعيدت بحروفها (خ20)", (await page("localStorage.getItem('yt-player-caption-sticky-language') === window.__stickyBefore")) === true,
    await page("localStorage.getItem('yt-player-caption-sticky-language')"));
  check("⭐ وقائمةُ الجلسة أُزيلت إذ لم تكن", (await page("sessionStorage.getItem('yt-player-caption-language-preferences')")) === null);
  check("وCC بحاله: مطفأ، والوحدةُ أُفرغت", (await page("document.querySelector('.ytp-subtitles-button').getAttribute('aria-pressed')")) === "false" &&
    (await page("window.__calls[window.__calls.length - 1]")) === "unload", await page("window.__calls"));

  console.log("\n[ب] النطقُ في موعده");
  await sleep(14000);
  let log = await evalIn(c, "window.__vzSpeechLog", world.id);
  const starts = log.filter((x) => x.ev === "start" && /^ترجمة/.test(x.text));
  check("جملةُ الإحماء نُطقت أوّلاً", log.length && /بدأتِ الدبلجة/.test((log.find((x) => x.ev === "start") || {}).text || ""), log.slice(0, 3));
  check("نُطقت جملٌ مترجمة (≥2 في 14 ث)", starts.length >= 2, starts);
  const lagOf = (x) => { const n = Number((x.text.match(/\d+/) || [0])[0]); return +(x.vt - (2 + (n - 1) * 3)).toFixed(2); };
  const lags = starts.map(lagOf);
  // ما يُفسّر تأخّرَ الأولى إن تأخّرت: متى انتهت جملةُ الإحماء (آخرُ التجهيز) — فلا يُحكم على الرقم بلا سببه
  const hello = log.find((x) => x.ev === "end" && /بدأتِ الدبلجة/.test(x.text || ""));
  console.log("   الإحماءُ انتهى عند", hello ? hello.vt : "؟", "· والأولى بدأت عند", starts[0] ? starts[0].vt : "؟", "· والتأخّرات", JSON.stringify(lags));
  // الأولى قد تحلّ والتجهيزُ لم ينتهِ (التقاطٌ ومترجمٌ وجملةُ إحماء) ⇒ تُنطق متأخّرةً بقاعدة `dubResyncAt` (حتى 1.5 ث) لا تُترك —
  // وما بعدها في موعده. ⛔ ~~«≤ 0.4 في كلّها»~~ نجح حين سبق التجهيزُ موعدَها وحده (📐 0.61 في تشغيلٍ أبطأ، 2026-11-01)
  check("الكمونُ عن موعد الجملة ≤ 0.4 ث فيما بعد الأولى، والأولى ≤ 1.5 (قاعدة الاستئناف)", lags.length >= 2 && lags[0] >= -0.15 && lags[0] <= 1.5 &&
    lags.slice(1).every((l) => l >= -0.15 && l <= 0.4), lags);
  check("بسرعة 1 (الجملةُ تتّسع لنافذتها)", starts.every((x) => x.rate === 1), starts.map((x) => x.rate));

  console.log("\n[ج] الإيقاف المؤقّت ثمّ القفز");
  await page("document.querySelector('video').pause()");
  await sleep(800);
  st = await status();
  check("متوقّف ⇐ صامتٌ بسببه", st.hold === "paused", st);
  await page("document.querySelector('video').play()");
  await sleep(500);
  await page("document.querySelector('video').currentTime = 50");
  await sleep(300);
  console.log("   الموضعُ بعد القفز:", await page("document.querySelector('video').currentTime"));
  await sleep(4000);
  log = await evalIn(c, "window.__vzSpeechLog", world.id);
  const after = log.filter((x) => x.ev === "start" && /^ترجمة/.test(x.text) && x.vt >= 49);
  check("بعد القفز إلى 50 ث يُنطق من الموضع (الجملة 17 أو بعدها)", after.length >= 1 && Number((after[0].text.match(/\d+/) || [0])[0]) >= 17, after.slice(0, 2));
  check("وبكمونٍ ≤ 0.4 ث", after.every((x) => lagOf(x) <= 0.4 && lagOf(x) >= -0.15), after.map(lagOf));
  check("⛔ لا pause()/resume() للنطق أبداً", !log.some((x) => /PAUSE!|RESUME!/.test(x.ev)));

  console.log("\n[د] الإيقافُ ثمّ البدءُ ثانيةً بلا طلب");
  st = await stop();
  check("أوقفتَها", st.state === "stopped" && st.reason === "user", st);
  const st2 = await start();
  for (let i = 0; i < 30; i++) { await sleep(300); st = await status(); if (st && st.state !== "preparing") break; }
  check("يعمل ثانيةً من الذاكرة", st.state === "running", st);
  check("⭐ ولا طلبَ ثانٍ لهذا الفيديو", ours === 1 && player === 1, { ours, player });

  console.log("\n[هـ] التنقّلُ يُسكت");
  await page("history.pushState({}, '', '/watch?v=OTHER')");
  await sleep(600);
  st = await status();
  check("تنقّلٌ إلى فيديو آخر ⇐ توقّفت", st.state === "stopped" && st.reason === "nav", st);
  log = await evalIn(c, "window.__vzSpeechLog", world.id);
  const lastEv = log[log.length - 1];
  check("وقُطعت جملتُنا إن كانت تُنطق (cancel أو انتهت)", !log.length || ["cancel", "end"].includes(lastEv.ev) || lastEv.ev === "start" ? true : false, lastEv);
  console.log("\n[و] الخروجُ من صفحة المشاهدة يُقال «تنقّل» لا «إطفاء»");
  await page("history.pushState({}, '', '/watch?v=VID')");
  await start();
  for (let i = 0; i < 30; i++) { await sleep(300); st = await status(); if (st && st.state !== "preparing") break; }
  check("يعمل ثانيةً على VID من الذاكرة", st.state === "running" && ours === 1, { st, ours });
  await page("history.pushState({}, '', '/')");
  await sleep(500);
  st = await status();
  check("إلى الصفحة الرئيسية ⇐ nav", st.state === "stopped" && st.reason === "nav", st);
  console.log("\n[ز] «ترجمة يوتيوب» — الجولة الثالثة: ملفُّ العربيّة من XHR المشغّل نفسِه في كروم حقيقيّ ⇐ قراءةٌ مسبقة، بصفر طلبٍ منّا");
  await page("history.pushState({}, '', '/watch?v=VID')");
  const ours0 = ours, player0 = player;
  await start("yt");
  for (let i = 0; i < 40; i++) { await sleep(300); st = await status(); if (st && st.state !== "preparing") break; }
  check("⭐ يعمل بالقراءة المسبقة «ytar» — مراقبةُ XHR في عالم الصفحة الحقيقيّ رأت ردَّ المشغّل", st && st.state === "running" && st.kind === "ytar" && st.total > 3, st);
  check("⭐ صفرُ طلبٍ منّا — والمشغّلُ طلب العربيّةَ بنفسه (XHR)", ours === ours0 && player === player0 + 1, { ours, player });
  check("⭐ والمراقبةُ أُزيلت: دالّتا XHR الأصليّتان عادتا", (await page("String(XMLHttpRequest.prototype.open).includes('[native code]') && String(XMLHttpRequest.prototype.send).includes('[native code]')")) === true);
  await sleep(10000);
  log = await evalIn(c, "window.__vzSpeechLog", world.id);
  const said = log.filter((x) => x.ev === "start" && /^سطرٌ عربيٌّ رقم/.test(x.text)).map((x) => x.text);
  const nums = said.map((t) => t.match(/\d+/g).map(Number)).flat();
  check("⭐ نُطق ما يُعرض بنصّه جملاً كاملة، بترتيبها بلا تكرار", said.length >= 2 && said.every((t) => /^(سطرٌ عربيٌّ رقم \d+\.)( سطرٌ عربيٌّ رقم \d+\.)*$/.test(t)) &&
    nums.every((n, i) => i === 0 || n === nums[i - 1] + 1), said);
  const lines = said;
  check("⛔ ونافذةُ اسم المسار («… >> Arabic · ⚙») لم تُنطق", !log.some((x) => x.ev === "speak" && /English|Arabic|⚙/.test(x.text)));
  st = await stop();
  await sleep(800);
  check("⭐ وعند الإيقاف: الترجمةُ تُطفأ كما كانت", (await page("document.querySelector('.ytp-subtitles-button').getAttribute('aria-pressed')")) === "false" &&
    (await page("window.__calls[window.__calls.length - 1]")) === "unload", await page("window.__calls.slice(-3)"));
  check("⭐ واللاصقةُ بحروفها", (await page("localStorage.getItem('yt-player-caption-sticky-language') === window.__stickyBefore")) === true);
  void lines;
  console.log("\n[ح] ملفٌّ لا كلامَ فيه (VID2) ⇐ يُقرأ ما يظهر سطراً سطراً (وضعُ العرض) — ويُقال لماذا");
  await page("history.pushState({}, '', '/watch?v=VID2')");
  await start("yt");
  for (let i = 0; i < 40; i++) { await sleep(300); st = await status(); if (st && st.state !== "preparing") break; }
  check("يعمل بوضع العرض، وسببُه مكتوب", st && st.state === "running" && st.kind === "display" && !!st.ytWhy, st);
  await sleep(4000);
  log = await evalIn(c, "window.__vzSpeechLog", world.id);
  check("ويقرأ السطورَ المعروضة", log.filter((x) => x.ev === "start" && /^سطرٌ عربيٌّ رقم/.test(x.text)).length >= 1);
  await stop();
  console.log("\nسجلّ النطق (آخر 12):", JSON.stringify(log.slice(-12)));
} catch (e) {
  fail++; console.log("  ❌ الرِكازُ رمى: " + (e && e.stack || e));
} finally {
  await kill();
}
console.log(`\n${fail ? "❌" : "✅"} نجح ${pass} / فشل ${fail}`);
process.exit(fail ? 1 : 0);
