// البند #168 — محرّكُ الدبلجة كلُّه على مشغّلٍ مزيّف: كتلةُ `content.js` الحقيقيّة و`yt_dub_main.js` الحقيقيّ معاً.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن أوقفتُ وأعدتُ، أو نام المحرّك، أو قفزتُ، أو أطفأتُ الإضافة، أو كان صوتٌ
// آخر يتكلّم — أتبقى الدبلجةُ صحيحةً بلا طلبٍ ثانٍ ولا جملةٍ ضائعة ولا صوتٍ لا يسكت؟»*
//
// **ولماذا وُجد (2026-11-01):** مراجعةٌ مستقلّة بأربع عدساتٍ ومحقّقٍ عدائيّ لكلٍّ أثبتت **سبعةَ عشرَ عيباً لا يراها
// `test-dub-core.js`** — كلُّها في **تتابُع الأحداث** لا في دالّةٍ خالصة (إيقافٌ أثناء الالتقاط يرمي نصّاً دُفع ثمنُه ·
// محرّكٌ نائمٌ وسطَ التشغيل · بدءٌ والمشغّلُ يقفز · جملةُ إحماءٍ تتكدّس · مفتاحٌ أُطفئ أثناء التجهيز…). **فكلُّ سيناريو هنا
// عيبٌ من تلك بعينه، رُئي أحمرَ على الكود قبل إصلاحه** (قرار 47)، ورقمُه في اسمه.
// **الزمنُ مُسرَّعٌ بانتظام** (المؤقّتاتُ ÷ K والساعةُ × K) — ⚠️ **حدٌّ مُعلَن:** محرّكُ النطق والمترجمُ والمشغّلُ مزيّفة؛
// يُرى بها الترتيبُ والعدّ، لا الصوتُ المسموع ولا يوتيوب الحقيقيّ.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const MAIN = fs.readFileSync("yt_dub_main.js", "utf8");
const b0 = SRC.indexOf("// ── #168 — الدبلجة العربية"), b1 = SRC.indexOf("\nchrome.runtime.onMessage.addListener");
const BLOCK = b0 > 0 && b1 > b0 ? SRC.slice(b0, b1) : "";

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra === undefined ? "" : JSON.stringify(extra).slice(0, 500)));

const K = 10;                                      // 🎯 تسريعٌ يكفي ولا يُرهق المجدوِل
const T0 = Date.now();
const now = () => (Date.now() - T0) * K;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms / K));
const until = async (cond, ms) => { const end = now() + (ms || 20000); while (!cond() && now() < end) await sleep(50); return cond(); };

function makeStore(init) {
  const m = new Map(Object.entries(init || {}));
  return { get length() { return m.size; }, key(i) { return Array.from(m.keys())[i] ?? null; },
    getItem(k) { return m.has(k) ? m.get(k) : null; }, setItem(k, v) { m.set(k, String(v)); }, removeItem(k) { m.delete(k); } };
}
function makeWindow() {
  const L = {};
  return {
    addEventListener(t, f) { (L[t] = L[t] || []).push(f); },
    removeEventListener(t, f) { L[t] = (L[t] || []).filter((x) => x !== f); },
    dispatchEvent(e) { (L[e.type] || []).slice().forEach((f) => f(e)); return true; }
  };
}
class FakeCustomEvent { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } }

// opts: tracklist · captionTracks · ccOn (الخيارُ الجاري) · playerReq(track) · setThrows · ourStatus · voices · drops
function makeEnv(opts) {
  const o = opts || {};
  const obs = [], fetched = [], calls = [], playerReqs = [], spoken = [], resources = [];
  const STICKY = "yt-player-caption-sticky-language", PREFS = "yt-player-caption-language-preferences";
  const stickyBefore = JSON.stringify({ data: "ar", expiration: 1, creation: 1 });
  const local = makeStore({ [STICKY]: stickyBefore }), session = makeStore({});
  let track = o.ccOn ? o.ccOn : {}, loaded = !!o.ccOn;
  const emit = (name, status, size, st) => {
    const en = { name, startTime: st, responseStatus: status, encodedBodySize: size, transferSize: size + 300 };
    resources.push(en);
    obs.slice().forEach((cb) => cb({ getEntries: () => [en] }));
  };
  // 📐 المشغّلُ يطلب الترجمةَ بـXHR وjson3 (كروم المالك 2026-11-01) — فطلبُه هنا يمرّ بـ`XMLHttpRequest` عالمِ الصفحة وقتَ النداء:
  // ما ركّبه `yt_dub_main.js` عليه يرى ردَّه كما يراه على يوتيوب. `arTrack`: سطورُ العربيّة [{t, d, line}] بالثواني (وإلا ملفٌّ فارغ)
  const plan = new Map();
  const arJson = () => {
    const ev = [];
    (o.arTrack || []).forEach((c) => {
      ev.push({ tStartMs: Math.round(c.t * 1000), dDurationMs: Math.round(c.d * 1000), wWinId: 1, segs: [{ utf8: c.line, acAsrConf: 0 }] });
      ev.push({ tStartMs: Math.round(c.t * 1000) + 10, dDurationMs: Math.round(c.d * 1000), wWinId: 1, aAppend: 1, segs: [{ utf8: "\n" }] });
    });
    return JSON.stringify({ events: ev });
  };
  const request = (r) => {
    const st = now();
    playerReqs.push(r.url);
    plan.set(r.url, r);
    // إرسالٌ يرمي (`xhrThrows`) ⇐ طلبٌ لم يخرج: يبتلعه المشغّلُ ولا يراه مراقبُ الموارد
    let sent = true;
    if (!o.noXhr && mainCtx && mainCtx.XMLHttpRequest) { const x = new mainCtx.XMLHttpRequest(); x.open("GET", r.url); try { x.send(); } catch (e) { sent = false; } }
    if (sent) setTimeout(() => { emit(r.url, r.status, r.size, st); if (r.status === 200 && (r.size || 0) > 0) cuesOk = true; }, (r.delay || 50) / K);
  };
  const BASE = "https://www.youtube.com/api/timedtext?v=VID";
  // الفيديو: زمنُه يجري بالساعة ما لم يتوقّف — والقفزُ يُثبّته حتى ينتهي `seeking`
  // وسرعتُه تتبدّل فيُعاد أساسُ الساعة — ⛔ ~~يُضرب ما مضى كلُّه بالسرعة الجديدة فيقفز الزمن~~ (حَكَمُ الجولة الثالثة)
  const video = { paused: false, _rate: 1, seeking: false, _base: 0, _at: now(),
    get playbackRate() { return this._rate; },
    set playbackRate(r) { this._base = this.currentTime; this._at = now(); this._rate = Number(r) || 1; },
    get currentTime() { return this.paused || this.seeking ? this._base : this._base + Math.max(0, now() - this._at) / 1000 * this._rate; },
    set currentTime(t) { this._base = t; this._at = now(); },
    pause() { this._base = this.currentTime; this.paused = true; this.pauses = (this.pauses | 0) + 1; },
    // `playLag`: ساعةُ الوسائط تبدأ بعد play() بقليل كما في كروم (مراجعةُ الجولة #1) — الافتراضُ صفر
    play() { if (this.paused) { this._at = now() + (o.playLag || 0); this.paused = false; } this.plays = (this.plays | 0) + 1; } };
  // الترجمةُ المعروضة: سطورُ الإشارة الجارية متى كانت العربيّةُ معروضة (اختيرت أو عرضناها) — و`rollup` سطرٌ سابقٌ فوقها
  const arOn = () => !!o.alreadyArabic || !!(track && track.translationLanguage && track.translationLanguage.languageCode === "ar");
  // 📖 مشغّلُ 11a45ffb (تحقّقُ الجولة): ضبطُ مسارٍ مترجَم يُفرغ الترجمةَ (`H5` ⇐ unload) ثمّ يطلبها، **ولا يُعيدها إلا ردٌّ ناجح** — وCC يبقى مضغوطاً
  let cuesOk = true;
  const cues = o.cues || [];
  // `windows`: نوافذُ كما يبنيها يوتيوب بـ`lang` — ونافذةُ اسم المسار (lang=en) ثانيتين بعد كلّ اختيار · و`grow` سطرٌ تُلحق به الكلمات
  let labelUntil = -1;
  // إعلانٌ يقوده الاختبار: `adOn` (الوسمُ ad-showing ولا ترجمة) · و**المُدمَجُ في الخادم** يُطيل العنصرَ لا المحتوى: `ssapOff` ما سبق به العنصرُ
  // المحتوى، و`ssapFreeze` زمنُ المشغّل أثناءه
  const lineAt = () => {
    if (!arOn() || !cuesOk || o.adOn) return [];
    const t = video.currentTime - (o.ssapOff || 0), k = cues.findIndex((c) => t >= c.t && t < c.t + c.d);
    if (k < 0) return [];
    let cur = cues[k].line;
    if (o.grow) {
      const w = cur.split(" "), dt = t - cues[k].t, g = o.growS || 0.3, P = o.growPause;   // P = { after, extra }: سكتةٌ بعد كلماتٍ
      let n = 1 + Math.floor(dt / g);
      if (P && n > P.after) n = Math.max(P.after, 1 + Math.floor((dt - P.extra) / g));
      cur = w.slice(0, Math.min(w.length, n)).join(" ");
    }
    return o.rollup && k > 0 ? [cues[k - 1].line, cur] : [cur];
  };
  const mkLines = (arr) => arr.map((x) => ({ textContent: x }));
  const p = {
    querySelectorAll: (sel) => {
      if (o.windows && sel === ".caption-window") {
        const out = [];
        if (now() < labelUntil) out.push({ hasAttribute: () => true, getAttribute: () => "en", querySelectorAll: (q) => (q === ".caption-visual-line" ? mkLines(["English (auto-generated) >> Arabic Click ⚙ for settings"]) : []) });
        out.push({ hasAttribute: () => true, getAttribute: () => "ar", querySelectorAll: (q) => (q === ".caption-visual-line" ? mkLines(lineAt()) : []) });
        return out;
      }
      if (sel !== ".caption-visual-line" || o.windows) return [];
      return mkLines(lineAt());
    },
    classList: { contains: (c) => c === "ad-showing" && !!o.adOn },
    querySelector: (s) => (s === ".ytp-subtitles-button" ? { getAttribute: () => (o.ccOffByHand ? "false" : track && track.languageCode || o.alreadyArabic ? "true" : "false") } : s === "video" ? video : null),
    getPlayerResponse: () => ({ videoDetails: { videoId: new URLSearchParams(location.search).get("v"), isLive: !!o.live, lengthSeconds: "60" }, playabilityStatus: { status: "OK" },
      captions: { playerCaptionsTracklistRenderer: { captionTracks: o.captionTracks || [{ baseUrl: "/api/timedtext?v=VID&lang=en&kind=asr", languageCode: "en", kind: "asr" }] } } }),
    getCurrentTime: () => (o.adOn && o.ssapFreeze != null ? o.ssapFreeze : video.currentTime - (o.ssapOff || 0)),
    loadModule: (n) => { calls.push("load:" + n); loaded = true; },
    unloadModule: (n) => { calls.push("unload:" + n); loaded = false; track = {}; },
    getOptions: () => (loaded ? ["captions"] : []),
    getOption: (m, k) => (k === "tracklist" ? (o.tracklist || [{ languageCode: "en", kind: "asr" }]) : track),
    setOption: (m, k, v) => {
      calls.push("set:" + JSON.stringify(v));
      track = v || {};
      labelUntil = now() + 2000;
      if (!track.languageCode) return;
      // 📖 كما يكتب يوتيوب: اللاصقةُ لغةُ الترجمة إن كانت، و«CC مضاء» ثلاثين يوماً
      local.setItem(STICKY, JSON.stringify({ data: (track.translationLanguage && track.translationLanguage.languageCode) || track.languageCode, expiration: 9, creation: Date.now() }));
      local.setItem("yt-player-sticky-caption", JSON.stringify({ data: true, expiration: 9, creation: Date.now() }));
      session.setItem(PREFS, JSON.stringify({ data: JSON.stringify([track.languageCode]), creation: 1 }));
      if (o.setThrows) throw new Error("player threw");
      const rq = o.playerReq ? o.playerReq(track) : { url: BASE + "&lang=en&kind=asr" + (track.variant ? "&variant=" + track.variant : "") +
        (track.translationLanguage ? "&tlang=" + track.translationLanguage.languageCode : "") + "&pot=POT&c=WEB&xorb=2&fmt=json3", status: 200, size: 900 };
      const rqs = Array.isArray(rq) ? rq : rq ? [rq] : [];
      if (track.translationLanguage && rqs.length) cuesOk = false;
      rqs.forEach(request);
    }
  };
  const win = makeWindow();
  win.CustomEvent = FakeCustomEvent;
  win.top = win;
  // 📐 `buffered` (كروم): ما في السجلّ لحظةَ `observe` يُسلَّم في نداءٍ لاحق — لقطةٌ تبقى ولو أُفرغ السجلُّ بعدها
  class PO { constructor(cb) { this.cb = cb; }
    observe(op) { const cb = this.cb, snap = op && op.buffered ? resources.slice() : []; obs.push(cb); if (snap.length) setTimeout(() => { if (obs.includes(cb)) cb({ getEntries: () => snap }); }, 0); }
    disconnect() { const i = obs.indexOf(this.cb); if (i >= 0) obs.splice(i, 1); } }
  PO.supportedEntryTypes = ["resource"];
  const EV = o.events || [];
  if (!o.events) for (let i = 0; i < 20; i++) EV.push({ tStartMs: 2000 + i * 3000, dDurationMs: 2800, segs: [{ utf8: "Sentence number " + (i + 1) + "." }] });
  const json3 = JSON.stringify({ events: EV });
  const location = { search: "?v=VID", origin: "https://www.youtube.com", pathname: "/watch", hostname: "www.youtube.com" };
  const docL = {};
  const document = { hidden: false, querySelector: (s) => (s === "#movie_player" ? p : s === "#movie_player video" ? video :
    s === "#movie_player .ytp-subtitles-button" ? p.querySelector(".ytp-subtitles-button") : null),
    addEventListener(t, f) { (docL[t] = docL[t] || []).push(f); }, removeEventListener(t, f) { docL[t] = (docL[t] || []).filter((x) => x !== f); },
    press(t) { (docL[t] || []).slice().forEach((f) => f({ type: t, isTrusted: true })); }, listeners: (t) => (docL[t] || []).length };
  const timers = { setTimeout: (f, ms) => setTimeout(f, Math.max(0, (ms || 0) / K)), clearTimeout,
    setInterval: (f, ms) => setInterval(f, Math.max(1, (ms || 0) / K)), clearInterval };
  // XHR عالمِ الصفحة: الردُّ بحسب العنوان — العربيّةُ (`tlang=ar`) من `arTrack`، وغيرُها ملفٌّ فارغ (لا يُستهلك في هذا البيت)
  class FakeXHR {
    constructor() { this.status = 0; this.responseType = ""; this.responseText = ""; this._l = {}; }
    open(m, u) { this._u = String(u); }
    addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }
    send() {
      if (o.xhrThrows && /[?&]tlang=ar/.test(this._u)) throw new Error("send failed");
      const x = this, r = plan.get(x._u) || { status: 200 };
      setTimeout(() => {
        x.status = r.status;
        x.responseText = r.status === 200 ? (/[?&]tlang=ar/.test(x._u) ? arJson() : JSON.stringify({ events: [] })) : "";
        ["load", "loadend"].forEach((t) => (x._l[t] || []).forEach((f) => f.call(x, {})));
      }, Math.max(1, (r.delay || 50) - 5) / K);
    }
  }
  const mainCtx = Object.assign({
    window: win, document, location, URL, URLSearchParams, JSON, Date, Math, Number, String, Array, Object, Promise, WeakMap, XMLHttpRequest: FakeXHR,
    localStorage: local, sessionStorage: session, PerformanceObserver: PO, AbortController, CustomEvent: FakeCustomEvent,
    performance: { now, getEntriesByType: (t) => (t === "resource" ? resources.slice() : []) },
    fetch: async (url) => {
      fetched.push(url);
      const st = now();
      await sleep(o.ourDelay || 300);
      const status = o.ourStatus || 200;
      emit(url, status, status === 200 ? 500 : 0, st);
      return { status, text: async () => (status === 200 ? json3 : "") };
    }
  }, timers);
  const xhrOrig = { open: FakeXHR.prototype.open, send: FakeXHR.prototype.send };
  vm.createContext(mainCtx);
  // `oldMain`: نسخةٌ من عالم الصفحة قبل بروتوكول النسخة — كالتي تبقى في صفحةٍ فُتحت قبل تحديث الإضافة
  vm.runInContext(o.oldMain ? MAIN.replace("{ ok: true, ver: VER }", "{ ok: true }") : MAIN, mainCtx);

  // محرّكُ النطق: طابورٌ واحد · `start` بعد 5ms · مدّةٌ بالحروف والسرعة · `drops` نطقٌ يُسقط بلا `start` ·
  // `hold` صوتٌ آخر يحجز الطابور حتى يُفرَج عنه
  const q = [];
  let speaking = null, maxOurs = 0;
  const engine = { drops: o.drops || 0, hold: false };
  const real = (r) => (r <= 1 ? 1 : 1 + (r - 1) * 0.905);
  const pump = () => {
    if (speaking || engine.hold || !q.length) return;
    const u = q.shift(); speaking = u;
    setTimeout(() => {
      if (u.__x) return;
      if (engine.drops > 0) { engine.drops--; speaking = null; spoken.push({ ev: "drop", text: u.text, t: now() }); if (u.onend) u.onend({}); pump(); return; }
      spoken.push({ ev: "start", text: u.text, rate: u.rate, volume: u.volume, voice: u.voice && u.voice.name, vt: video.currentTime, t: now() });
      if (u.onstart) u.onstart({});
      u.__t = setTimeout(() => { speaking = null; spoken.push({ ev: "end", text: u.text, t: now() }); if (u.onend) u.onend({}); pump(); },
        u.text.length / 8.15 / real(u.rate) * 1000 / K);
    }, 5 / K);
  };
  const speechSynthesis = {
    speak(u) { spoken.push({ ev: "speak", text: u.text, t: now() }); q.push(u); maxOurs = Math.max(maxOurs, q.length + (speaking ? 1 : 0)); pump(); },
    cancel() { spoken.push({ ev: "cancel", t: now() }); const all = (speaking ? [speaking] : []).concat(q.splice(0)); speaking = null;
      all.forEach((u) => { u.__x = true; clearTimeout(u.__t); if (u.onerror) u.onerror({ error: "interrupted" }); }); },
    getVoices: () => o.voices || [{ lang: "ar-001", name: "Laila (Enhanced)", localService: true, voiceURI: "Laila" }],
    addEventListener() {}, removeEventListener() {}
  };
  function SpeechSynthesisUtterance(text) { this.text = text; this.rate = 1; this.volume = 1; }
  const gate = { on: true };
  // 168ح — Azure مزيّف: الكلامُ يردّ «صوتاً» نصُّه من SSML، والمترجمُ «مترجَم N» — و`azMode`/`trMode` رفضٌ بحاله
  const azReqs = [], trReqs = [], blobText = new Map(), revoked = new Set();
  let blobN = 0;
  class TURL extends URL {}
  TURL.createObjectURL = (b) => { const u = "blob:fake/" + (++blobN); blobText.set(u, { text: b.text, dur: b.size / 6000, voice: b.voice, real: b.real || 1 }); return u; };
  TURL.revokeObjectURL = (u) => { revoked.add(u); };
  // صوتٌ بـ12 حرفاً في الثانية بسرعته الطبيعيّة، تقصّره نسبةُ prosody — وحجمُه بـ48 kbit/s (6000 بايت في الثانية) كما يردّ Azure
  // · `azDelay` زمنُ الردّ (رقمٌ أو دالّةٌ برقم الطلب) · `blobFails` قراءةُ الجسم تفشل (مراجعة 168ح #3)
  // · `azDelay`/`azMode`/`blobFails` تأخذ رقمَ الطلب ونصَّه — فيُختار طلبُ جملةٍ بعينها لا برقمٍ يتبدّل بترتيب الجلب
  const azFetch = async (url, init) => {
    const h = (init && init.headers) || {};
    if (/\.tts\.speech\.microsoft\.com\/cognitiveservices\/v1$/.test(url)) {
      const body = String(init.body || ""), inner = (body.match(/<voice[^>]*>([\s\S]*)<\/voice>/) || [])[1] || "";
      const pr = /^<prosody rate="([+-]\d+)%">([\s\S]*)<\/prosody>$/.exec(inner);
      const text = (pr ? pr[2] : inner).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
      const real = pr ? 1 + Number(pr[1]) / 100 : 1, voice = (body.match(/<voice name="([^"]+)"/) || [])[1] || "";
      azReqs.push({ url, key: h["Ocp-Apim-Subscription-Key"], body, text, t: now(), cred: init.credentials });
      const n = azReqs.length;
      await sleep(typeof o.azDelay === "function" ? o.azDelay(n, text) : (o.azDelay || 40));
      const mode = typeof o.azMode === "function" ? o.azMode(n, text) : (o.azMode || "ok");
      if (mode !== "ok") return { ok: false, status: Number(mode), text: async () => (o.az403Quota ? "You have reached the quota with your free-tier (F0) Speech resource" : "") };
      if (o.blobFails && o.blobFails(n, text)) return { ok: true, status: 200, blob: async () => { throw new TypeError("network error"); } };
      // `azTail`: صمتٌ في آخر المقطع كما يضيفه Azure (📐 بحثُ الجولة الثالثة: نحو 0.85 ث) — يُفكّ بـOfflineAudioContext المزيّف أدناه
      const speech = Math.max(0.6, text.length / (o.azCps || 12) / real), tail = o.azTail || 0, dur = speech + tail;
      return { ok: true, status: 200, blob: async () => ({ size: Math.round(dur * 6000), text, voice, real, arrayBuffer: async () => ({ __fake: { speech, tail } }) }) };
    }
    if (/api\.cognitive\.microsofttranslator\.com\/translate/.test(url)) {
      const arr = JSON.parse(init.body);
      trReqs.push({ url, key: h["Ocp-Apim-Subscription-Key"], region: h["Ocp-Apim-Subscription-Region"], n: arr.length, chars: arr.reduce((n, x) => n + String(x.Text).length, 0), t: now() });
      await sleep(o.trDelay || 40);
      const tm = typeof o.trMode === "function" ? o.trMode(trReqs.length) : o.trMode;
      if (tm && tm !== "ok") { if (tm === "net") throw new TypeError("Failed to fetch"); return { ok: false, status: Number(tm) }; }
      return { ok: true, status: 200, json: async () => arr.map((x) => ({ translations: [{ text: "مترجَم " + String(x.Text).replace(/[^0-9 ]/g, "").replace(/\s+/g, " ").trim(), to: "ar" }] })) };
    }
    throw new Error("unexpected fetch " + url);
  };
  // عنصرُ صوتٍ مزيّف: مدّتُه من الملفّ، ويُشغَّل بسرعة تشغيله (`playbackRate`)، **ويتوقّف ثمّ يكمل من حيث وقف** — و`currentTime` زمنُ
  // الوسيط **بالأجزاء** (ما قبل آخر تبديلٍ للسرعة أو توقّف، ثمّ ما بعده بسرعته) كما في العنصر الحقيقيّ — **وسرعةٌ تتبدّل وهو يعمل
  // يُعاد بها توقيتُ ما بقي** (حَكَمُ الجولة: ⛔ ~~يُقاس ما مضى كلُّه بالسرعة الجديدة~~) ويُسجَّل «az-rate»
  class FakeAudio {
    constructor(url) {
      const b = blobText.get(url) || {};
      this.src = url; this.volume = 1; this._rate = 1; this.preservesPitch = false; this.paused = true;
      this.text = b.text || ""; this.voice = b.voice || ""; this.duration = b.dur || NaN; this.real = b.real || 1; this._pos = 0; this._t0 = null; this._began = false;
    }
    get currentTime() { return this._pos + (this.paused || this._t0 == null ? 0 : (now() - this._t0) / 1000 * this._rate); }
    set currentTime(t) { if (!this._began) this._pos = Math.max(0, Number(t) || 0); }   // موضعُ البدء (يُتخطّى صمتُ أوّله)
    get playbackRate() { return this._rate; }
    set playbackRate(r) {
      r = Number(r) || 1;
      if (this.paused || this._t0 == null) { this._rate = r; return; }
      this._pos = this.currentTime; this._t0 = now(); this._rate = r;
      clearTimeout(this._t); this._arm();
      spoken.push({ ev: "az-rate", text: this.text, rate: r, t: now() });
    }
    _arm() {
      this._t = setTimeout(() => {
        this._pos = this.duration || 0.6; this._t0 = null; this.paused = true;
        spoken.push({ ev: "az-end", text: this.text, vt: video.currentTime, t: now() });
        if (this.onended) this.onended();
      }, Math.max(0, (this.duration || 0.6) - this._pos) / this._rate * 1000 / K);
    }
    // 📖 كما في كروم (تحقّقُ الجولة الثالث): رابطٌ أُبطل ⇐ خطأ · و`audioLag`: وعدُ play() معلّقٌ حتى «playing» ويُرفض AbortError إن سبقه pause()
    play() {
      if (revoked.has(this.src)) {
        const err = new Error("revoked blob");
        setTimeout(() => { spoken.push({ ev: "az-error", text: this.text, src: this.src, t: now() }); if (this.onerror) this.onerror(err); }, 5 / K);
        return Promise.reject(err);
      }
      if (!this.paused) return Promise.resolve();
      this.paused = false;
      const go = (done) => setTimeout(() => {
        if (this.paused) return;
        this._rej = null;
        spoken.push(this._began ? { ev: "az-resume", text: this.text, t: now() }
          : { ev: "az-start", text: this.text, voice: this.voice, volume: this.volume, rate: this._rate, pitch: this.preservesPitch, seek: this._pos, speed: this.real * this._rate, vt: video.currentTime, t: now() });
        this._began = true;
        if (this.onplaying) this.onplaying();
        this._t0 = now();
        this._arm();
        if (done) done();
      }, (o.audioLag || 5) / K);
      if (!o.audioLag) { go(null); return Promise.resolve(); }
      return new Promise((resolve, reject) => { this._rej = reject; go(resolve); });
    }
    pause() {
      if (this._rej) { const r = this._rej; this._rej = null; setTimeout(() => r(Object.assign(new Error("The play() request was interrupted by a call to pause()."), { name: "AbortError" })), 0); }
      if (this.paused) return;
      const at = this.currentTime;
      spoken.push({ ev: "az-pause", text: this.text, at, vt: video.currentTime, t: now() });
      this.paused = true; clearTimeout(this._t);
      if (this._t0 != null) { this._pos = at; this._t0 = null; }
    }
  }
  // فكُّ الترميز المزيّف: كلامٌ بعد عُشر ثانيةٍ حتى نهايته، ثمّ صمتُ الذيل — بمئة عيّنةٍ في الثانية (يكفي للعتبة)
  class FakeOAC {
    decodeAudioData(buf) {
      const s = (buf && buf.__fake) || { speech: 1, tail: 0 }, R = 100, d = new Float32Array(Math.round((s.speech + s.tail) * R));
      for (let i = Math.round(0.1 * R); i < Math.round(s.speech * R); i++) d[i] = 0.3;
      return Promise.resolve({ sampleRate: R, getChannelData: () => d });
    }
  }
  // `perfN`: كم مرّةً سأل المحرّكُ الساعة — حلقةٌ لا تُعطي الصفحةَ نَفَساً تسألها ملايينَ المرّات (مراجعة 168ح #1)
  const perf = { n: 0 };
  const contentCtx = Object.assign({
    window: win, document, location, URL: TURL, URLSearchParams, JSON, Date, Math, Number, String, Array, Object, Promise, Map, Set, atob,
    CustomEvent: FakeCustomEvent, performance: { now: () => (perf.n++, now()) }, speechSynthesis, SpeechSynthesisUtterance, fetch: azFetch, Audio: FakeAudio, AbortController,
    Translator: o.noTranslator ? undefined : { availability: async () => "available", create: async () => ({ translate: async (t) => { if (o.trDelay) await sleep(o.trDelay); return "ترجمة " + t.replace(/[^0-9]/g, ""); } }) },
    chrome: { runtime: { id: "x" } }, OfflineAudioContext: o.azTail ? FakeOAC : undefined,
    extensionActive: () => gate.on, isYouTubeHost: () => true, isInMiniPlayer: () => false
  }, timers);
  contentCtx.globalThis = contentCtx;
  vm.createContext(contentCtx);
  vm.runInContext(BLOCK + "\n;globalThis.__api = { dubStart, dubStop, dubStatus, dubSetOptions: typeof dubSetOptions === \"function\" ? dubSetOptions : () => ({}), get dub() { return dub; }, dubTranscripts };", contentCtx);
  const ask = (op, args) => new Promise((resolve) => {
    const id = "t" + Math.random();
    const on = (e) => { const m = JSON.parse(e.detail); if (m.id !== id) return; win.removeEventListener("__vz_dub_res__", on); resolve(m); };
    win.addEventListener("__vz_dub_res__", on);
    win.dispatchEvent(new FakeCustomEvent("__vz_dub_req__", { detail: JSON.stringify({ id, op, args }) }));
  });
  return { api: contentCtx.__api, ask, fetched, calls, playerReqs, local, session, STICKY, PREFS, stickyBefore, spoken, engine, video, location, win, p,
    document, gate, opts: o, maxOurs: () => maxOurs, clearResources: () => { resources.length = 0; }, xhrNative: () => FakeXHR.prototype.open === xhrOrig.open && FakeXHR.prototype.send === xhrOrig.send, release: () => { engine.hold = false; pump(); }, azReqs, trReqs, blobs: () => blobN, revoked, perf };
}

const DEV = { source: "device" };
const startRun = async (e, o) => { e.api.dubStart(o || DEV); await until(() => ["running", "refused", "stopped"].includes(e.api.dubStatus().state), 30000); return e.api.dubStatus(); };
const heard = (e) => e.spoken.filter((x) => x.ev === "start" && /^ترجمة/.test(x.text));
const heard2 = (e) => e.spoken.filter((x) => x.ev === "start" && /رقم/.test(x.text));
const num = (t) => Number(String(t).replace(/[^0-9]/g, ""));
const dataOf = (x) => { try { return JSON.stringify(JSON.parse(x).data); } catch (e) { return null; } };
// ما نُطق موصولاً كلمةً كلمةً بادئةٌ من سطور الإشارات بترتيبها (من السطر الأوّل الذي بدأ منه)
const isPrefixOf = (said, cues) => {
  const w = said.join(" ").split(/\s+/).filter(Boolean), all = cues.map((c) => c.line).join(" ").split(/\s+/).filter(Boolean);
  for (let s0 = 0; s0 < all.length; s0++) { if (w.every((x, i) => all[s0 + i] === x)) return true; }
  return false;
};

(async () => {
  console.log("\n=== #168 — محرّكُ الدبلجة على مشغّلٍ مزيّف ===");
  check("كتلةُ الدبلجة موجودة", BLOCK.length > 1000);

  console.log("\n[١] #1 · #10 — إيقافٌ أثناء الالتقاط لا يرمي نصّاً دُفع ثمنُه");
  {
    const e = makeEnv();
    e.api.dubStart(DEV);
    await until(() => e.api.dubStatus().step === "capture", 5000);
    e.api.dubStop("user");
    await until(() => e.fetched.length === 1, 20000);
    await sleep(800);
    const st = await startRun(e);
    check("أُعيد البدءُ فعمل", st.state === "running", st);
    check("⭐ وبلا طلبٍ ثانٍ منّا", e.fetched.length === 1, e.fetched.length);
    e.api.dubStop("user");
  }

  console.log("\n[٢] #15 — نصٌّ غاب عن ذاكرة سكربت الإضافة يُعاد من عالم الصفحة بلا شبكة");
  {
    const e = makeEnv();
    await startRun(e);
    e.api.dubStop("user");
    e.api.dubTranscripts.clear();
    const st = await startRun(e);
    check("يعمل ثانيةً", st.state === "running", st);
    check("⭐ وطلبُنا واحدٌ لا اثنان", e.fetched.length === 1, e.fetched.length);
    const f = await e.ask("facts");
    check("والحقائقُ تقول «مُخزَّن» لا «أُنفق»", f.asked === "cached", f.asked);
    e.api.dubStop("user");
  }

  console.log("\n[٣] #4 — رميةُ المشغّل أثناء الإجبار لا تترك لغةَ الترجمة مكتوبة");
  {
    const e = makeEnv({ setThrows: true });
    const st = await startRun(e);
    check("رُفض بسببه", st.state === "refused" && st.reason === "threw", st);
    check("⭐ اللاصقةُ أُعيدت بحروفها", e.local.getItem(e.STICKY) === e.stickyBefore, e.local.getItem(e.STICKY));
    check("وقائمةُ الجلسة أُزيلت", e.session.getItem(e.PREFS) === null);
    check("والوحدةُ أُفرغت", e.calls[e.calls.length - 1] === "unload:captions", e.calls);
  }

  console.log("\n[٤] #3 · #16 — تلقائيّتان (gemini أوّلاً في tracklist): يُقبل ما طلبه المشغّلُ فعلاً");
  {
    const e = makeEnv({ tracklist: [{ languageCode: "en", kind: "asr", variant: "gemini" }, { languageCode: "en", kind: "asr" }],
      captionTracks: [{ baseUrl: "/api/timedtext?v=VID&lang=en&kind=asr", languageCode: "en", kind: "asr" },
        { baseUrl: "/api/timedtext?v=VID&lang=en&kind=asr&variant=gemini", languageCode: "en", kind: "asr" }] });
    const st = await startRun(e);
    check("التُقط وعمل", st.state === "running", st);
    check("وطلبُنا يحمل variant ما طُلب (gemini)", e.fetched.length === 1 && /variant=gemini/.test(e.fetched[0]), e.fetched);
    e.api.dubStop("user");
  }

  console.log("\n[٥] #2 — رفضٌ يصل بعد القرار يرفع القاطعَ لما بعده");
  {
    const prev = { languageCode: "en", kind: "asr", translationLanguage: { languageCode: "ar" } };
    const e = makeEnv({ ccOn: prev, ourDelay: 600, playerReq: (t) => (t.translationLanguage
      ? { url: "https://www.youtube.com/api/timedtext?v=VID&lang=en&kind=asr&tlang=ar&pot=POT", status: 429, size: 0, delay: 200 }
      : { url: "https://www.youtube.com/api/timedtext?v=VID&lang=en&kind=asr&pot=POT&c=WEB", status: 200, size: 900 }) });
    const st = await startRun(e);
    check("هذا الفيديو يُدبلج (نصُّه جُلب)", st.state === "running", st);
    await sleep(2500);
    const f = await e.ask("facts");
    check("⭐ والقاطعُ مرفوعٌ لما بعده", !!f.stop, f.stop);
    e.api.dubStop("user");
  }

  console.log("\n[٦] #12 — مفتاحٌ أُطفئ أثناء التجهيز: لا إجبارَ ولا طلبَ ولا جملةَ إحماء");
  {
    const e = makeEnv();
    e.api.dubStart(DEV);
    e.gate.on = false;
    await until(() => e.api.dubStatus().state !== "preparing", 10000);
    await sleep(500);
    const st = e.api.dubStatus();
    check("توقّف «gate»", st.state === "stopped" && st.reason === "gate", st);
    check("⭐ ولا إجبار ولا طلب ولا نطق", !e.calls.some((x) => x.startsWith("set:")) && e.fetched.length === 0 && !e.spoken.length, { calls: e.calls, n: e.spoken.length });
  }

  console.log("\n[٧] #11 — رفضُ فيديو غادرناه لا يُعرض على غيره");
  {
    const e = makeEnv({ live: true });
    const st = await startRun(e);
    check("بثٌّ ⇐ رفض «live»", st.state === "refused" && st.reason === "live", st);
    e.location.search = "?v=OTHER";
    check("⭐ وعلى فيديو آخر: لا شيء يجري", e.api.dubStatus().state === "idle", e.api.dubStatus());
  }

  console.log("\n[٨] #5 — محرّكٌ نام وسطَ التشغيل: الجملةُ تُعاد ولا تضيع");
  {
    const e = makeEnv();
    await startRun(e);
    await until(() => heard(e).length >= 1, 15000);
    e.engine.drops = 2;
    const n0 = heard(e).length;
    await until(() => heard(e).length >= n0 + 1, 15000);
    const drops = e.spoken.filter((x) => x.ev === "drop").map((x) => x.text);
    const after = heard(e)[n0];
    check("أُسقط نطقان بلا start", drops.length === 2, drops);
    check("⭐ والجملةُ المُسقَطة نفسُها سُمعت بعدهما", !!after && drops.every((d) => d === after.text), { drops, after });
    check("ولا «ضاعت»", e.api.dubStatus().lost === 0, e.api.dubStatus());
    e.api.dubStop("user");
  }

  console.log("\n[٩] #7 — لا بدءَ والمشغّلُ يقفز");
  {
    const e = makeEnv();
    await startRun(e);
    await until(() => heard(e).length >= 1, 15000);
    e.video.seeking = true;
    e.video.currentTime = 31.95;                     // قبيل الجملة 11 (32 ث) والمشغّلُ يقفز ثانيةً كاملة
    const k0 = e.spoken.length;
    await sleep(1000);
    const during = e.spoken.slice(k0).filter((x) => x.ev === "speak").length;
    e.video.seeking = false; e.video.currentTime = 31.95;
    await until(() => heard(e).some((x) => /(11|12)$/.test(x.text)), 30000);   // مهلةٌ تتّسع لحِمل الجهاز (الزمنُ مسرَّع ×10)
    const elevens = e.spoken.filter((x) => x.ev === "speak" && /11$/.test(x.text)).length;
    check("⭐ لا نطقَ أثناء القفز", during === 0, during);
    // ⛔ العيبُ يقولها مرّتين (تبدأ على نبضة القفز فيقطعها التجمّد ثمّ تُعاد) — ومجدوِلٌ أبطأه الحِملُ قد يتخطّاها بحقّ
    check("ولا تُقال الجملةُ مرّتين بعده — ويُنطق ما استحقّ", elevens <= 1 && heard(e).some((x) => /(11|12)$/.test(x.text)), { elevens });
    e.api.dubStop("user");
  }

  console.log("\n[١٠] #8 — صوتٌ آخر يحجز الطابور عند الإحماء: جملةٌ واحدةٌ منّا فيه أبداً");
  {
    const e = makeEnv();
    e.engine.hold = true;
    e.api.dubStart(DEV);
    await until(() => e.api.dubStatus().state === "running", 40000);   // العيبُ يطلب ثلاثاً بمهلة 6 ث لكلٍّ قبل أن يبدأ
    const hellos = e.spoken.filter((x) => x.ev === "speak" && /بدأتِ/.test(x.text)).length;
    check("⭐ «بدأتِ الدبلجة» طُلبت مرّةً واحدة لا ثلاثاً", hellos === 1, hellos);
    check("وجملتُنا في الطابور واحدةٌ على الأكثر", e.maxOurs() <= 1, e.maxOurs());
    e.release();
    await until(() => heard(e).length >= 1, 15000);
    check("وبعد الإفراج تُنطق الجمل", heard(e).length >= 1);
    check("والتحذيرُ «لم أسمع جملةَ البدء» يزول بسماع جملة", e.api.dubStatus().warm === true, e.api.dubStatus());
    e.api.dubStop("user");
  }

  console.log("\n[١١] الخيارات — حجمٌ وسرعةٌ ثابتة وصوتٌ مختار تصل الجملة · وتتبدّل وسطَ التشغيل");
  {
    const voices = [{ lang: "ar-001", name: "Majed", localService: true, voiceURI: "Majed" }, { lang: "ar-001", name: "Laila (Enhanced)", localService: true, voiceURI: "Laila" }];
    const e = makeEnv({ voices });
    await startRun(e, { source: "device", volume: 0.4, rate: 1.5, voice: "Majed" });
    await until(() => heard(e).length >= 1, 15000);
    const a = heard(e)[0];
    check("⭐ الحجمُ 0.4 والسرعةُ 1.5 والصوتُ «Majed»", a.volume === 0.4 && a.rate === 1.5 && a.voice === "Majed", a);
    e.api.dubSetOptions({ volume: 0.9, rate: "auto", voice: "Laila" });
    const n = heard(e).length;
    await until(() => heard(e).length >= n + 1, 15000);
    const b = heard(e)[n];
    check("وتغييرُها يصل الجملةَ التالية", b.volume === 0.9 && b.rate === 1 && b.voice === "Laila (Enhanced)", b);
    e.api.dubStop("user");
  }

  console.log("\n[١٢] «ترجمة يوتيوب كما تظهر» — يُقرأ ما يُعرض بنصّه، كلُّ سطرٍ مرّةً، بصفر طلبٍ منّا، ويُعاد ما غيّرناه");
  {
    const cues = [];
    for (let k = 0; k < 20; k++) cues.push({ t: 2 + k * 3, d: 2.8, line: "سطرٌ عربيٌّ رقم " + (k + 1) });
    const e = makeEnv({ cues });
    const st = await startRun(e, { source: "yt" });
    check("يعمل بوضع العرض", st.state === "running" && st.kind === "display", st);
    check("⭐ صفرُ طلبٍ منّا — والمشغّلُ طلب العربيّةَ بنفسه", e.fetched.length === 0 && e.playerReqs.some((u) => /tlang=ar/.test(u)), { f: e.fetched, p: e.playerReqs });
    e.video.currentTime = 4.9;
    await until(() => heard2(e).length >= 3, 20000);
    const got = heard2(e).map((x) => x.text);
    check("⭐ السطورُ بنصّها وبترتيبها", got.length >= 3 && got.every((t, i) => i === 0 || num(t) === num(got[i - 1]) + 1), got);
    check("ولا سطرَ قيل مرّتين", new Set(got).size === got.length, got);
    e.api.dubStop("user");
    await sleep(600);
    check("⭐ وعند الإيقاف: الترجمةُ تُطفأ كما كانت والوحدةُ تُفرغ", e.calls[e.calls.length - 1] === "unload:captions", e.calls);
    check("⭐ واللاصقةُ ببياناتها (وإعادةُ كتابتها بالبيانات نفسِها ليست أثراً — M2+R)", dataOf(e.local.getItem(e.STICKY)) === dataOf(e.stickyBefore), e.local.getItem(e.STICKY));
    check("و«CC مضاء» الذي كتبه الإجبارُ زال", e.local.getItem("yt-player-sticky-caption") === null, e.local.getItem("yt-player-sticky-caption"));
  }
  {
    const cues = [];
    for (let k = 0; k < 20; k++) cues.push({ t: 2 + k * 3, d: 2.8, line: "سطرٌ رقم " + (k + 1) });
    const e = makeEnv({ cues, rollup: true });
    await startRun(e, { source: "yt" });
    e.video.currentTime = 4.9;
    await until(() => heard2(e).length >= 3, 20000);
    const got = heard2(e).map((x) => x.text);
    // أوّلُ إشارةٍ بعد البدء قد تكون سطراً طويلاً التفّ على سطرين فتُقرأ كلُّها؛ وما بعدها: الجديدُ وحدَه
    check("سطران معروضان (السابقُ فوق الجديد) ⇐ الجديدُ وحدَه يُنطق بعد الأولى", got.length >= 3 &&
      got.slice(1).every((t) => (t.match(/رقم/g) || []).length === 1) && new Set(got).size === got.length, got);
    e.api.dubStop("user");
  }
  {
    const cues = [];
    for (let k = 0; k < 20; k++) cues.push({ t: 2 + k * 3, d: 2.8, line: "سطرٌ عربيٌّ رقم " + (k + 1) });
    const e = makeEnv({ cues, windows: true });
    await startRun(e, { source: "yt" });
    e.video.currentTime = 1.5;                                  // نافذةُ اسم المسار ما زالت معروضة
    await until(() => heard2(e).length >= 2, 20000);
    check("⛔ نافذةُ اسم المسار («… >> Arabic · ⚙») لم تُنطق", !e.spoken.some((x) => x.ev === "speak" && /English|Arabic|⚙/.test(x.text)),
      e.spoken.filter((x) => x.ev === "speak").map((x) => x.text));
    e.api.dubStop("user");
  }
  {
    const cues = [];
    // كلمةٌ كلَّ نصف ثانية ونطقُها أقصر من ذلك — كما في الترجمة التلقائيّة: نطقُ السطر قبل اكتماله يقطّعه ويعيده
    for (let k = 0; k < 20; k++) cues.push({ t: 2 + k * 4, d: 3.8, line: "أ ب ت ث ج رقم " + (k + 1) });
    const e = makeEnv({ cues, grow: true, growS: 0.5, rollup: true });
    await startRun(e, { source: "yt" });
    e.video.currentTime = 5.9;
    await until(() => heard2(e).length >= 3, 30000);
    // كلُّ ما نُطق بعد جملة الإحماء — لا ما فيه «رقم» وحدَه: النصفُ المقطوع لا رقمَ فيه
    const got = e.spoken.filter((x) => x.ev === "start" && !/بدأتِ/.test(x.text)).map((x) => x.text);
    // ⭐ الخاصّيّةُ لا الشكل: ما نُطق كلُّه موصولاً **بادئةٌ من السطور بترتيبها** — لا كلمةَ تُعاد ولا تُترك (والأولى قد تحمل
    // صدرَ التالي إن ظهرا معاً، فيُنطق باقيه وحدَه)
    check("⭐ سطرٌ يكبر (roll-up): لا كلمةَ تُعاد ولا تُترك", got.length >= 3 && isPrefixOf(got, cues), got);
    e.api.dubStop("user");
  }
  {
    const cues = [{ t: 0, d: 60, line: "سطرٌ" }];
    const e = makeEnv({ cues, ccOn: { languageCode: "en", kind: "asr", translationLanguage: { languageCode: "ar" } } });
    const st = await startRun(e, { source: "yt" });
    // ⛔ ~~«لا إجبار» (لا setOption أصلاً)~~ — الجولة الثالثة: **المسارُ نفسُه يُعاد ضبطُه** فيطلبه المشغّلُ ثانيةً ونقرأ ملفَّه (📐 كروم
    // المالك 2026-11-01) — **ولا تتبدّل لغتُه**: كلُّ ضبطٍ هو العربيّةُ نفسُها
    const sets = e.calls.filter((x) => x.startsWith("set:"));
    check("العربيّةُ معروضةٌ سلفاً ⇐ لا تتبدّل لغتُها (يُعاد ضبطُ المسار نفسِه وحدَه)", st.state === "running" && sets.length <= 1 &&
      sets.every((x) => /"translationLanguage":\{"languageCode":"ar"/.test(x)), e.calls);
    e.opts.ccOffByHand = true;
    await sleep(400);
    check("وأطفأ المستخدمُ الترجمة ⇐ يقول ذلك ولا يصمت بلا سبب", e.api.dubStatus().hold === "cc-off", e.api.dubStatus());
    e.api.dubStop("user");
    await sleep(300);
    check("ولا يُطفئ ما لم يُشغّله", !e.calls.some((x) => x.startsWith("unload")), e.calls);
  }

  console.log("\n[١٣] مراجعة 2 — العرض: الإغلاقُ يُعيد المفاتيح · ما اختاره المستخدم يبقى · سكتةٌ في سطرٍ يكبر · إيقافٌ وبدءٌ أثناء العرض · صوتٌ أثناء التجهيز");
  const CUES = (n, f) => { const c = []; for (let k = 0; k < n; k++) c.push({ t: 2 + k * 3, d: 2.8, line: f(k + 1) }); return c; };
  {
    const e = makeEnv({ cues: CUES(20, (k) => "سطرٌ عربيٌّ رقم " + k) });
    await startRun(e, { source: "yt" });
    check("الإجبارُ كتب «CC مضاء» واللاصقة", e.local.getItem("yt-player-sticky-caption") !== null && /"ar"/.test(e.local.getItem(e.STICKY)));
    e.win.dispatchEvent(new FakeCustomEvent("pagehide"));
    check("⭐ تبويبٌ يُغلق والدبلجةُ تعرض ⇐ المفاتيحُ تعود (#1)", e.local.getItem("yt-player-sticky-caption") === null && dataOf(e.local.getItem(e.STICKY)) === dataOf(e.stickyBefore) && e.session.getItem(e.PREFS) === null,
      { on: e.local.getItem("yt-player-sticky-caption"), st: e.local.getItem(e.STICKY), pr: e.session.getItem(e.PREFS) });
    e.api.dubStop("user");
  }
  {
    const e = makeEnv({ cues: CUES(20, (k) => "سطرٌ عربيٌّ رقم " + k) });
    await startRun(e, { source: "yt" });
    e.p.setOption("captions", "track", { languageCode: "en", kind: "asr" });     // المستخدمُ يختار الإنجليزيّة بيده
    await until(() => e.api.dubStatus().hold === "cc-lang", 12000);
    check("مسارٌ غيرُ عربيّ اختاره المستخدم ⇐ يُقال «ليست عربية» (#2)", e.api.dubStatus().hold === "cc-lang", e.api.dubStatus());
    e.api.dubStop("user");
    await sleep(600);
    check("⭐ وعند الإيقاف لا يُطمس اختيارُه: الإنجليزيّةُ باقيةٌ ولاصقتُه «en»", !e.calls.slice(-2).some((x) => x === "unload:captions") && /"en"/.test(e.local.getItem(e.STICKY)),
      { calls: e.calls.slice(-3), st: e.local.getItem(e.STICKY) });
  }
  {
    const e = makeEnv({ cues: CUES(20, (k) => "أ ب ت ث ج ح رقم " + k), grow: true, growS: 0.3, growPause: { after: 3, extra: 0.9 }, rollup: true });
    await startRun(e, { source: "yt" });
    e.video.currentTime = 4.95;
    await until(() => heard2(e).length >= 3, 30000);
    const got = e.spoken.filter((x) => x.ev === "start" && !/بدأتِ/.test(x.text)).map((x) => x.text);
    check("⭐ سطرٌ يكبر وفيه سكتة ⇐ لا يُعاد صدرُه — ولا كلمةَ تُترك (#3)", got.length >= 3 && isPrefixOf(got, CUES(20, (k) => "أ ب ت ث ج ح رقم " + k)), got);
    e.api.dubStop("user");
  }
  {
    const e = makeEnv({ cues: CUES(20, (k) => "سطرٌ عربيٌّ رقم " + k) });
    e.api.dubStart({ source: "yt" });
    await until(() => e.api.dubStatus().step === "show", 8000);
    e.api.dubStop("user");
    e.api.dubStart({ source: "yt" });
    await until(() => e.api.dubStatus().state === "running", 20000);
    e.api.dubStop("user");
    await sleep(800);
    check("⭐ إيقافٌ وبدءٌ أثناء العرض ثمّ إيقاف ⇐ CC يعود مطفأً واللاصقةُ بحروفها (#4 · #7 · #13)",
      e.calls[e.calls.length - 1] === "unload:captions" && dataOf(e.local.getItem(e.STICKY)) === dataOf(e.stickyBefore) && e.local.getItem("yt-player-sticky-caption") === null,
      { calls: e.calls.slice(-3), st: e.local.getItem(e.STICKY) });
  }
  {
    const voices = [{ lang: "ar-001", name: "Majed", localService: true, voiceURI: "Majed" }, { lang: "ar-001", name: "Laila (Enhanced)", localService: true, voiceURI: "Laila" }];
    const e = makeEnv({ voices, cues: CUES(20, (k) => "سطرٌ عربيٌّ رقم " + k) });
    e.api.dubStart({ source: "yt", voice: "" });
    e.api.dubSetOptions({ voice: "Majed" });                                      // والدبلجةُ ما زالت تتجهّز
    await until(() => e.spoken.some((x) => x.ev === "start"), 15000);
    const first = e.spoken.find((x) => x.ev === "start");
    check("⭐ صوتٌ اختير أثناء التجهيز يُؤخذ (#8 · #11)", first && first.voice === "Majed", first);
    e.api.dubStop("user");
  }

  console.log("\n[١٤] 168ح — صوتُ Azure ومترجمُه: يُسمع · حدُّ الطلبات · مفتاحٌ مرفوض · 429 · الإيقاف · ولا مفتاحَ في الحال");
  const KEY = "TESTKEY0123456789abcdefABCDEF0123", TRK = "TRKEY0123456789abcdefABCDEF012345";
  const azHeard = (e) => e.spoken.filter((x) => x.ev === "az-start" && !/بدأتِ/.test(x.text));
  {
    const e = makeEnv();
    const st = await startRun(e, { source: "device", engine: "azure", volume: 0.7, az: { key: KEY, region: "uaenorth", voice: "ar-SA-ZariyahNeural" } });
    check("يعمل بصوت Azure", st.state === "running" && st.engine === "azure", st);
    await until(() => azHeard(e).length >= 2, 30000);
    const r0 = e.azReqs[0] || {};
    check("⭐ جملةُ الإحماء ثمّ المقاطعُ بصوت Azure، بحجم المستخدم", e.spoken.some((x) => x.ev === "az-start" && /بدأتِ/.test(x.text)) && azHeard(e).length >= 2 && azHeard(e).every((x) => x.volume === 0.7), azHeard(e).slice(0, 2));
    check("⭐ الطلبُ إلى منطقة المستخدم، بمفتاحه في الترويسة، وبالصوت المختار، وبلا كوكيز", /^https:\/\/uaenorth\.tts\.speech\.microsoft\.com\//.test(r0.url) && r0.key === KEY && /ar-SA-ZariyahNeural/.test(r0.body) && r0.cred === "omit", { url: r0.url, cred: r0.cred });
    check("ولا صوتَ جهازٍ يُخلط به", !e.spoken.some((x) => x.ev === "start"));
    check("⛔ والمفتاحُ لا يظهر في الحال أبداً — والحروفُ المدفوعة تُعدّ", !JSON.stringify(e.api.dubStatus()).includes(KEY) && e.api.dubStatus().azTts > 0, e.api.dubStatus().azTts);
    await sleep(70000);                                                // دقيقةٌ وأكثر من تشغيلٍ متّصل (مسرَّعة)
    const ts = e.azReqs.map((x) => x.t);
    let worst = 0;
    for (const t0 of ts) worst = Math.max(worst, ts.filter((t) => t >= t0 && t < t0 + 60000).length);
    check("⭐ المقاطعُ مضمومة ⇐ لا تتجاوز طلباتُ النطق 18 في أيّ دقيقة (حدُّ F0 عشرون)", ts.length >= 6 && worst <= 18, { n: ts.length, worst });
    const playing = e.spoken.filter((x) => x.ev === "az-start").length;
    e.api.dubStop("user");
    await sleep(300);
    check("⭐ الإيقافُ يُسكت صوتَ Azure فوراً ويُحرّر ما جُلب", e.spoken.slice(-3).some((x) => x.ev === "az-pause") || e.spoken[e.spoken.length - 1].ev === "az-end", e.spoken.slice(-3));
    check("ولا رابطَ صوتٍ يبقى معلَّقاً", e.revoked.size === e.blobs(), { made: e.blobs(), freed: e.revoked.size, playing });
  }
  {
    const e = makeEnv({ azMode: "401" });
    const st = await startRun(e, { source: "device", engine: "azure", az: { key: KEY, region: "uaenorth" } });
    await until(() => e.spoken.some((x) => x.ev === "start" && /^ترجمة/.test(x.text)), 30000);
    const n0 = e.azReqs.length;
    await sleep(8000);
    check("⭐ مفتاحٌ مرفوض ⇐ صوتُ الجهاز بقيّةَ التشغيلة، ويُقال", st.state === "running" && e.api.dubStatus().azOff === "key" && e.spoken.some((x) => x.ev === "start" && /^ترجمة/.test(x.text)), e.api.dubStatus());
    check("ولا طلبَ Azure بعد الرفض", e.azReqs.length === n0 && n0 <= 2, { n0, after: e.azReqs.length });
    e.api.dubStop("user");
  }
  {
    const e = makeEnv({ azMode: (n) => (n === 2 ? "429" : "ok") });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEY, region: "uaenorth" } });
    await until(() => e.api.dubStatus().azWarn === "rate", 30000);
    const n0 = e.azReqs.length;
    await until(() => e.spoken.some((x) => x.ev === "start" && /^ترجمة/.test(x.text)), 15000);
    await sleep(3000);
    check("⭐ 429 ⇐ دقيقةٌ بصوت الجهاز بلا طلب Azure", e.api.dubStatus().azWarn === "rate" && e.azReqs.length === n0 && e.spoken.some((x) => x.ev === "start" && /^ترجمة/.test(x.text)), { n0, now: e.azReqs.length });
    e.api.dubStop("user");
  }
  {
    const e = makeEnv();
    await startRun(e, { source: "azure", engine: "system", az: { trKey: TRK, trRegion: "uaenorth" } });
    await until(() => e.spoken.some((x) => x.ev === "start" && /^مترجَم/.test(x.text)), 30000);
    const t0 = e.trReqs[0] || {};
    check("⭐ «مترجم Azure»: دفعةُ مقاطعَ في طلبٍ واحد، بمفتاحه ومنطقته", t0.n >= 2 && t0.key === TRK && t0.region === "uaenorth", t0);
    check("وما يُنطق نصُّ مترجم Azure", e.spoken.filter((x) => x.ev === "start" && !/بدأتِ/.test(x.text)).every((x) => /^مترجَم/.test(x.text)));
    e.api.dubStop("user");
  }
  {
    const e = makeEnv({ trMode: "401" });
    await startRun(e, { source: "azure", engine: "system", az: { trKey: TRK, trRegion: "uaenorth" } });
    await until(() => e.spoken.some((x) => x.ev === "start" && /^ترجمة/.test(x.text)), 30000);
    check("⭐ مفتاحُ المترجم مرفوض ⇐ مترجمُ كروم، ويُقال", e.api.dubStatus().trOff === "key" && e.spoken.some((x) => x.ev === "start" && /^ترجمة/.test(x.text)), e.api.dubStatus());
    e.api.dubStop("user");
  }
  {
    const e = makeEnv({ cues: CUES(20, (k) => "سطرٌ عربيٌّ رقم " + k) });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEY, region: "uaenorth", voice: "ar-SA-HamedNeural" } });
    e.video.currentTime = 4.9;
    await until(() => e.spoken.filter((x) => x.ev === "az-start" && /رقم/.test(x.text)).length >= 2, 25000);
    check("⭐ «ترجمة يوتيوب» بصوت Azure: السطورُ المعروضة تُقرأ بحامد", e.spoken.filter((x) => x.ev === "az-start" && /رقم/.test(x.text)).length >= 2 && /ar-SA-HamedNeural/.test((e.azReqs[1] || {}).body || ""));
    e.api.dubStop("user");
  }
  {
    const e = makeEnv();
    const st = await startRun(e, { source: "device", engine: "azure", az: {} });
    check("صوتُ Azure بلا مفتاح ⇐ يُرفض بسببه قبل أيّ طلب", st.state === "refused" && st.reason === "az-nokey" && e.azReqs.length === 0, st);
  }

  // ── الجولة الثالثة (ملاحظتا المالك 2026-11-01 ومراجعة 168ح) — كلُّ سيناريو هنا رُئي أحمرَ على الكود قبلها (قرار 47) ──────────
  // سطورُ ملفّ العربيّة بشكله المقيس: جملٌ تامّةٌ تُقسَّم سطوراً بنحو 30 حرفاً — فنهايةُ الجملة تقع وسطَ السطر غالباً
  const AR_SENT = (k) => "هذه الجملة رقم " + k + " وهي كاملة.";
  const arTrack = (n, first, step, long) => {
    const words = [];
    for (let k = 1; k <= n; k++) words.push(...(long ? AR_SENT(k).replace(" وهي", " وهي جملةٌ طويلةٌ جدّاً تمتدّ كثيراً وهي") : AR_SENT(k)).split(" "));
    const lines = [];
    let cur = "";
    for (const w of words) { if (cur && (cur + " " + w).length > 30) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
    if (cur) lines.push(cur);
    return lines.map((line, j) => ({ t: first + j * step, d: step * 2, line }));
  };
  const KEYZ = "TESTKEY0123456789abcdefABCDEF0123";
  const saidAll = (e, ev) => e.spoken.filter((x) => x.ev === ev && !/بدأتِ/.test(x.text));

  console.log("\n[١٥] الجولة الثالثة — «ترجمة يوتيوب» بقراءةٍ مسبقة: ملفُّ العربيّة من ردّ طلب المشغّل نفسِه، يُنطق جملاً كاملةً في مواعيدها");
  {
    const e = makeEnv({ arTrack: arTrack(24, 2, 2) });
    const st = await startRun(e, { source: "yt" });
    check("⭐ يعمل بوضع الجمل «ytar» لا بوضع العرض — ⛔ ~~«display»~~", st.state === "running" && st.kind === "ytar" && st.total > 3, st);
    check("⭐ وبصفر طلبٍ منّا — المشغّلُ وحدَه طلب العربيّة", e.fetched.length === 0 && e.playerReqs.some((u) => /tlang=ar/.test(u)), { f: e.fetched });
    await until(() => saidAll(e, "start").length >= 4, 40000);
    const got = saidAll(e, "start");
    const SENT = /^(هذه الجملة رقم \d+ وهي كاملة\.)( هذه الجملة رقم \d+ وهي كاملة\.)*$/;
    check("⭐ كلُّ ما نُطق جملٌ كاملة — لا يقف الصوتُ وسطَ جملة", got.length >= 4 && got.every((x) => SENT.test(x.text)), got.map((x) => x.text));
    const nums = got.map((x) => x.text.match(/\d+/g).map(Number)).flat();
    check("⭐ وبترتيبها بلا تكرارٍ ولا ثغرة", nums.every((n, i) => i === 0 || n === nums[i - 1] + 1), nums);
    // صوتُ الجهاز المزيّف بطيءٌ عمداً (8.15 حرفاً/ث، «ليلى») وجملُ العربيّة أطولُ من نوافذها: فالأولى في موعدها، وما بعدها **لا يتراكم
    // تأخّرُه** — يُسرَّع ليلحق (`dubCapFor`) ويتوقّف الفيديو حين يبلغ DUB_WAIT_BEHIND_S (2.5 ث) حتى يفرغ الصوت ⇒ يبقى ما يُسمع مع ما يُعرض
    const sents = e.api.dub.sents, lag = got.map((x) => { const u = sents.find((s) => s.ar === x.text); return u ? x.vt - u.start / 1000 : 99; });
    check("⭐ الأولى في موعدها، وتأخّرُ ما بعدها محدودٌ لا يتراكم (يلحق ثمّ ينتظره الفيديو)", Math.abs(lag[0]) < 0.3 && lag.every((l) => l > -0.2 && l < 3.0),
      lag.map((l) => l.toFixed(2)));
    e.api.dubStop("user");
  }
  {
    const e = makeEnv({ arTrack: arTrack(12, 2, 2), ccOn: { languageCode: "en", kind: "asr", translationLanguage: { languageCode: "ar" } } });
    const st = await startRun(e, { source: "yt" });
    check("⭐ العربيّةُ معروضةٌ سلفاً ⇐ يُعاد ضبطُ المسار نفسِه فيُلتقط ملفُّه — ⛔ ~~يُقرأ ما يظهر وحدَه~~", st.kind === "ytar" && st.total > 2, st);
    check("واللاصقةُ ببياناتها، ولا شيءَ يُطفأ عند الإيقاف", dataOf(e.local.getItem(e.STICKY)) === dataOf(e.stickyBefore), e.local.getItem(e.STICKY));
    e.api.dubStop("user");
    await sleep(500);
    check("ولا يُطفئ ما لم يُشغّله", !e.calls.some((x) => x.startsWith("unload")), e.calls);
  }
  {
    const e = makeEnv({ arTrack: arTrack(12, 2, 2), noXhr: true, cues: CUES(20, (k) => "سطرٌ عربيٌّ رقم " + k) });
    const st = await startRun(e, { source: "yt" });
    check("لم يُلتقط الملفّ ⇐ يُقرأ ما يظهر سطراً سطراً كما كان (لا رفض)", st.state === "running" && st.kind === "display", st);
    e.api.dubStop("user");
  }

  console.log("\n[١٦] مراجعة 168ح — لا تجميد · حدٌّ للصفحة · قراءةٌ تفشل · ردٌّ بطيء · تحذيرٌ حيّ · صوتٌ يتبدّل · مترجمٌ أمام الموضع · مفتاحٌ يُصحَّح");
  {
    // #1 · #7 · #13 — العرضُ بصوت Azure وسطورٌ أسرعُ من 18 في الدقيقة: كان الحدُّ الممتلئ يُعيد النبضةَ في سلسلة وعودٍ تُجمّد الصفحة
    const cues = []; for (let k = 0; k < 80; k++) cues.push({ t: 2 + k * 2, d: 1.9, line: "سطرٌ رقم " + (k + 1) });
    const e = makeEnv({ cues });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    e.video.currentTime = 1.9;
    const n0 = e.perf.n;
    await sleep(120000);
    const asks = e.perf.n - n0;
    check("⭐ دقيقتان من سطرٍ كلَّ ثانيتين بصوت Azure ⇐ لا حلقةَ تُجمّد الصفحة (سؤالُ الساعة بالآلاف لا بالملايين)", asks < 60000, asks);
    check("ويُسمع الكلام", e.spoken.filter((x) => x.ev === "az-start" && /رقم/.test(x.text)).length >= 10, e.spoken.filter((x) => x.ev === "az-start").length);
    e.api.dubStop("user");
  }
  {
    // #2 · #8 — ستُّ ضغطاتٍ في دقيقة: الحدُّ للصفحة لا للتشغيلة ⇒ لا تتجاوز طلباتُ النطق 18 في أيّ ستين ثانية
    const e = makeEnv();
    for (let k = 0; k < 6; k++) {
      await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
      await sleep(7000);
      e.api.dubStop("user");
      await sleep(2000);
    }
    const ts = e.azReqs.map((x) => x.t);
    let worst = 0;
    for (const t0 of ts) worst = Math.max(worst, ts.filter((t) => t >= t0 && t < t0 + 60000).length);
    check("⭐ ستُّ ضغطاتٍ في نحو دقيقة ⇐ لا تتجاوز طلباتُ النطق 18 في أيّ ستين ثانية — ⛔ ~~24~~", worst <= 18 && ts.length >= 6, { worst, n: ts.length });
  }
  {
    // ⭐ حَكَمُ الجولة S4: قراءةٌ تفشل مرّةً (فشلٌ عابر) ⇐ يُعاد طلبُ جملتها مرّةً عبر الحدّ نفسِه فتُسمع — ⛔ ~~تضيع~~
    let once = "";
    const e = makeEnv({ blobFails: (n, text) => (n === 3 ? ((once = text), true) : false) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => !!once && saidAll(e, "az-start").some((x) => x.text === once), 30000);
    check("⭐ قراءةٌ فشلت مرّةً ⇐ أُعيد طلبُها مرّةً وسُمعت، ولا ضائع", !!once && saidAll(e, "az-start").some((x) => x.text === once) && e.api.dubStatus().lost === 0 &&
      e.azReqs.filter((r) => r.text === once).length === 2, { once, lost: e.api.dubStatus().lost, tries: e.azReqs.filter((r) => r.text === once).length });
    e.api.dubStop("user");
  }
  {
    // #3 — وتفشل مرّتين للجملة نفسِها: المقطعُ يُعدّ ضائعاً وتمضي الدبلجة — ⛔ ~~ثلاثون ثانيةً صامتة و«صوتٌ آخر يسبقنا»~~
    let bad = "";
    const e = makeEnv({ blobFails: (n, text) => { if (n === 3) bad = text; return !!bad && text === bad; } });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.api.dubStatus().lost >= 1, 30000);
    const holds = new Set();
    const t0 = now();
    while (now() - t0 < 12000) { holds.add(e.api.dubStatus().hold); await sleep(200); }
    check("⭐ قراءةٌ فشلت مرّتين للجملة نفسِها ⇐ ضاع مقطعٌ وقيل، ومضت الدبلجةُ بلا «صوتٌ آخر يسبقنا»", e.api.dubStatus().lost >= 1 && !holds.has("queue") && e.spoken.filter((x) => x.ev === "az-start").length >= 2,
      { lost: e.api.dubStatus().lost, holds: Array.from(holds) });
    e.api.dubStop("user");
  }
  {
    // #4 — ردٌّ بطيء (3.5 ث) في وضع العرض (يُجلب كلُّ سطرٍ عند ظهوره): ⛔ ~~قاعدةُ الثلاث ثوانٍ لطابور النطق تُسقطه صامتاً~~ ⇒ يُسمع
    const e = makeEnv({ azDelay: (n) => (n === 1 ? 40 : 3500), cues: CUES(20, (k) => "سطرٌ عربيٌّ رقم " + k) });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    e.video.currentTime = 4.9;
    await until(() => e.spoken.filter((x) => x.ev === "az-start" && /رقم/.test(x.text)).length >= 2, 40000);
    check("⭐ ردُّ Azure البطيء يُسمع ولا يُسقط — ولا «صوتٌ آخر يسبقنا»", e.spoken.filter((x) => x.ev === "az-start" && /رقم/.test(x.text)).length >= 2 &&
      e.api.dubStatus().hold !== "queue", e.api.dubStatus());
    e.api.dubStop("user");
  }
  {
    // #5 · #14 — بعد 429 ودقيقة الانتظار: Azure يعود والتحذيرُ يزول — ⛔ ~~«بلغتَ الحدّ» بقيّةَ التشغيلة~~ (فيديو دقيقتين: يبقى ما يُقال)
    const EVL = [];
    for (let i = 0; i < 44; i++) EVL.push({ tStartMs: 2000 + i * 3000, dDurationMs: 2800, segs: [{ utf8: "Sentence number " + (i + 1) + "." }] });
    const e = makeEnv({ events: EVL, azMode: (n) => (n === 2 ? "429" : "ok") });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.api.dubStatus().azWarn === "rate", 30000);
    check("429 ⇐ «الحدّ» يُقال، وصوتُ الجهاز يخلف (azOn مطفأ)", e.api.dubStatus().azOn === false, e.api.dubStatus());
    await sleep(62000);
    await until(() => e.api.dubStatus().azOn === true, 5000);
    const n0 = saidAll(e, "az-start").length;
    await until(() => saidAll(e, "az-start").length > n0, 20000);
    check("⭐ وبعد الدقيقة: Azure يتكلّم ثانيةً والتحذيرُ زال", e.api.dubStatus().azWarn === "" && e.api.dubStatus().azOn === true && saidAll(e, "az-start").length > n0, e.api.dubStatus());
    e.api.dubStop("user");
  }
  {
    // #6 — صوتٌ يتبدّل وسطَ التشغيل: ما جُلب بالقديم يسقط ⇒ الجملةُ التالية بالجديد
    const e = makeEnv();
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth", voice: "ar-SA-HamedNeural" } });
    await until(() => saidAll(e, "az-start").length >= 1, 20000);
    e.api.dubSetOptions({ az: { key: KEYZ, region: "uaenorth", voice: "ar-SA-ZariyahNeural" } });
    const n0 = saidAll(e, "az-start").length;
    await until(() => saidAll(e, "az-start").length > n0, 20000);
    const nx = saidAll(e, "az-start")[n0] || {};
    check("⭐ الجملةُ التالية بعد التبديل بالصوت الجديد — ⛔ ~~بما جُلب مسبقاً بالقديم~~", nx.voice === "ar-SA-ZariyahNeural", nx);
    e.api.dubStop("user");
  }
  {
    // #9 — مترجمُ Azure أمام الموضع: ⛔ ~~الفيديو كلُّه في ثانية~~ ⇒ دفعةٌ واحدةٌ لما أمامه (فيديو أطولُ من دفعة: 90 جملة)
    const EVT = [];
    for (let i = 0; i < 90; i++) EVT.push({ tStartMs: 2000 + i * 3000, dDurationMs: 2800, segs: [{ utf8: "Sentence number " + (i + 1) + "." }] });
    const e = makeEnv({ events: EVT });
    await startRun(e, { source: "azure", engine: "system", az: { trKey: TRK, trRegion: "uaenorth" } });
    await sleep(4000);
    const units = e.api.dubStatus().total, asked = e.trReqs.reduce((n, x) => n + x.n, 0);
    check("⭐ لا يُترجم إلا ما أمام الموضع (دفعةٌ واحدة) — لا الفيديو كلَّه", units > 25 && e.trReqs.length === 1 && asked <= 25 && asked < units, { reqs: e.trReqs.length, asked, units });
    e.api.dubStop("user");
  }
  {
    // #11 — المترجمُ لا يصل (شبكة): ⛔ ~~يُعاد كلَّ نبضة أبداً~~ ⇒ انتظارٌ يتضاعف، وبعد ثلاثةٍ يتوقّف ويُقال
    const e = makeEnv({ trMode: "net" });
    await startRun(e, { source: "azure", engine: "system", az: { trKey: TRK, trRegion: "uaenorth" } });
    await sleep(20000);
    check("⭐ عشرون ثانيةً بلا شبكة ⇐ ثلاثةُ طلباتٍ لا مئة، ثمّ «تعذّر» ويخلفه مترجمُ كروم", e.trReqs.length <= 4 && e.api.dubStatus().trOff === "net", { n: e.trReqs.length, st: e.api.dubStatus().trOff });
    e.api.dubStop("user");
  }
  {
    // #11 (ب) — مترجمُ Azure يُرفض ولا مترجمَ كروم: يُقال «لا مترجم» — ⛔ ~~«بمترجم كروم» وهو غيرُ موجود~~
    const e = makeEnv({ trMode: "401", noTranslator: true });
    await startRun(e, { source: "azure", engine: "system", az: { trKey: TRK, trRegion: "uaenorth" } });
    await until(() => e.api.dubStatus().hold === "tr-off", 15000);
    check("⭐ لا مترجمَ يخلف ⇐ «tr-off» لا صمتٌ بلا سبب", e.api.dubStatus().hold === "tr-off", e.api.dubStatus());
    e.api.dubStop("user");
  }
  {
    // #16 — مفتاحٌ رُفض ثمّ صُحّح وسطَ التشغيل ⇒ يُجرَّب الآن — ⛔ ~~«مرفوض» بقيّةَ التشغيلة~~
    const e = makeEnv({ azMode: (n) => (n <= 1 ? "401" : "ok") });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.api.dubStatus().azOff === "key", 15000);
    e.api.dubSetOptions({ az: { key: "FIXEDKEY0123456789abcdefABCDEF01", region: "uaenorth" } });
    await until(() => saidAll(e, "az-start").length >= 1, 20000);
    check("⭐ المفتاحُ المصحَّح يُجرَّب فوراً ويُسمع Azure", e.api.dubStatus().azOff === "" && saidAll(e, "az-start").length >= 1 && e.azReqs.some((r) => r.key === "FIXEDKEY0123456789abcdefABCDEF01"), e.api.dubStatus());
    e.api.dubStop("user");
  }

  console.log("\n[١٧] الجولة الثالثة — جملٌ كاملة · «يتوقّف الفيديو لحظةً حتى يجهز الصوت» (قرارُ المالك) · صوتُ Azure يتوقّف مع الفيديو ويكمل");
  {
    // ملاحظةُ المالك ٢: «توقفات غير منطقيه في الكلام في منتصف جمل» — تلقائيّةٌ بتوقيت الكلمات، وفي كلّ جملةٍ سكتةُ تردّدٍ
    // (900ms بين كلمتين) تقطع المُقسِّمَ هناك ⇒ ⛔ ~~مقطعٌ «We went to» يُنطق وحدَه ثمّ صمتٌ حتى باقيه~~ ⇒ المقطعُ يُتمّ جملتَه
    const W = [["We", 0], [" went", 300], [" to", 600], [" the", 1500], [" old", 1800], [" market", 2100], [" and", 2400], [" bought", 2700], [" apples", 3000]];
    const EV2 = [];
    for (let k = 0; k < 12; k++) EV2.push({ tStartMs: 2000 + k * 6000, dDurationMs: 5500, segs: W.map((w) => ({ utf8: w[0], tOffsetMs: w[1] })).concat([{ utf8: " " + (k + 1) + ".", tOffsetMs: 3300 }]) });
    const e = makeEnv({ events: EV2 });
    await startRun(e, { source: "device" });
    const units = (e.api.dub && e.api.dub.sents) || [];
    check("⭐ كلُّ مقطعٍ جملةٌ كاملة (ينتهي بترقيمه) — ⛔ ~~«We went to» وحدَه وسطَ الجملة~~", units.length >= 6 &&
      units.every((u) => /^We went to the old market and bought apples \d+\.$/.test(u.text)), units.slice(0, 3).map((u) => u.win + "|" + u.text));
    e.api.dubStop("user");
  }
  {
    // ⭐ الانتظار مفعّل: صوتُ أوّل جملةٍ يتأخّر أربعَ ثوانٍ (يُطلب نحو ثلاثٍ قبل موعدها فيصل بعده بنحو ثانية — داخل مهلة الانتظار)
    // ⇒ يتوقّف الفيديو في موعدها ويكمل حين يجهز ⇒ تبدأ في موعدها من الفيديو
    const e = makeEnv({ azDelay: (n) => (n === 2 ? 4000 : 40) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => saidAll(e, "az-start").length >= 1, 40000);
    const a = saidAll(e, "az-start")[0], u = e.api.dub.sents.find((s) => s.ar === a.text);
    check("⭐ «يتوقّف الفيديو لحظة»: أُوقف الفيديو ثمّ أُكمل، والجملةُ بدأت في موعدها منه — ⛔ ~~متأخّرةً أو محذوفة~~",
      e.video.pauses >= 1 && !e.video.paused && u && Math.abs(a.vt - u.start / 1000) < 0.5 && e.api.dubStatus().waits >= 1, { vt: a.vt, start: u && u.start, waits: e.api.dubStatus().waits });
    e.api.dubStop("user");
  }
  {
    // ⭐ ومهلةُ الانتظار ثلاثُ ثوانٍ مرّةً واحدةً للجملة: صوتٌ تأخّر اثنتي عشرة ثانية ⇐ يتوقّف الفيديو مرّةً ثمّ يكمل ولا يعود يتوقّف لها
    // — ⛔ ~~يكمل لحظةً ثمّ يتوقّف ثانيةً فثالثة~~ (تقطيعٌ للفيديو نفسِه)
    const e = makeEnv({ azDelay: (n) => (n === 2 ? 12000 : 40) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => saidAll(e, "az-start").length >= 1, 40000);
    check("⭐ انتظارٌ واحدٌ بمهلته ثمّ يكمل الفيديو — لا إيقافَ ثانٍ للجملة نفسِها", e.video.pauses === 1 && !e.video.paused, { pauses: e.video.pauses, waits: e.api.dubStatus().waits });
    e.api.dubStop("user");
  }
  {
    // والانتظارُ مطفأ: لا يُلمس الفيديو — الجملةُ تبدأ متأخّرةً ولا تُحذف
    const e = makeEnv({ azDelay: (n) => (n === 2 ? 4000 : 40) });
    await startRun(e, { source: "device", engine: "azure", wait: false, az: { key: KEYZ, region: "uaenorth" } });
    await until(() => saidAll(e, "az-start").length >= 1, 40000);
    check("والانتظارُ مطفأ ⇐ لا يُوقَف الفيديو أبداً، والجملةُ تُسمع", !(e.video.pauses > 0) && saidAll(e, "az-start").length >= 1, { pauses: e.video.pauses });
    e.api.dubStop("user");
  }
  {
    // ⛔ ~~من ضغط مفتاحاً أثناء إيقافنا صار الإيقافُ له: لا نُكمل الفيديو عنه~~ — سُحب (حَكَمُ الجولة S1، 📐 كان موقوفاً بعد 8.5 ث): نقرةٌ في
    // أيّ مكانٍ في الصفحة أثناء ثلاث ثوانٍ تركت الفيديو موقوفاً بلا نهاية ⇒ مهلةُ الانتظار تحكم، ولا مستمعَ لنا على المستند
    const e = makeEnv({ azDelay: (n) => (n === 2 ? 7000 : 40) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.paused, 30000);
    const t0 = now();
    e.document.press("mousedown"); e.document.press("keydown");
    await until(() => !e.video.paused, 8000);
    check("⭐ نقرةٌ ومفتاحٌ أثناء انتظارنا ⇐ يكمل الفيديو بمهلة الانتظار (≤3.2 ث) — ⛔ ~~يبقى موقوفاً بلا نهاية~~ — ولا مستمعَ على المستند",
      !e.video.paused && now() - t0 <= 3200 && e.document.listeners("keydown") === 0 && e.document.listeners("mousedown") === 0, { paused: e.video.paused, ms: now() - t0 });
    e.api.dubStop("user");
  }
  {
    // وإيقافُ الدبلجة أثناء انتظارنا ⇐ الفيديو يكمل: لا يبقى موقوفاً بلا سبب
    const e = makeEnv({ azDelay: (n) => (n === 2 ? 7000 : 40) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.paused, 30000);
    e.api.dubStop("user");
    check("⭐ «أوقف الدبلجة» أثناء انتظارنا ⇐ يكمل الفيديو", !e.video.paused, { paused: e.video.paused });
  }
  {
    // ⭐ صوتُ Azure يتوقّف مع الفيديو ويكمل من حيث وقف — لا تُقطع جملته ولا تُعاد
    const e = makeEnv({ arTrack: arTrack(16, 2, 2, true) });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => saidAll(e, "az-start").length >= 1, 30000);
    await sleep(800);
    const first = saidAll(e, "az-start")[0].text;
    e.video.pause();
    await sleep(2500);
    e.video.play();
    await until(() => e.spoken.some((x) => x.ev === "az-end" && x.text === first), 30000);
    const starts = e.spoken.filter((x) => x.ev === "az-start" && x.text === first).length;
    check("⭐ أوقفتُ الفيديو وسطَ جملةٍ وأكملتُه ⇐ صوتُها توقّف وأكمل، وقيلت مرّةً واحدة — ⛔ ~~قُطعت وضاع باقيها~~",
      e.spoken.some((x) => x.ev === "az-pause") && e.spoken.some((x) => x.ev === "az-resume" && x.text === first) && starts === 1, { starts });
    e.api.dubStop("user");
  }
  {
    // ⭐ صمتُ آخر مقطع Azure (📐 نحو 0.85 ث): السرعةُ تُتعلَّم من الكلام وحدَه، والجملةُ التاليةُ المستحقّة لا تنتظره
    const e = makeEnv({ arTrack: arTrack(30, 2, 2, true), azTail: 0.85 });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => saidAll(e, "az-start").length >= 6, 60000);
    const cps = e.api.dub.cpsAz;
    check("⭐ سرعةُ Azure تُتعلَّم من الكلام لا من صمت ذيله (12 حرفاً/ث في الحارس) — لا أبطأَ بنحو الخُمس", Math.abs(cps - 12) < 1.2, cps);
    let early = 0, prompt = 0;
    e.spoken.forEach((x, i) => {
      if (x.ev !== "az-pause" || !x.text || /بدأتِ/.test(x.text)) return;
      early++;
      const nx = e.spoken.slice(i + 1).find((y) => y.ev === "az-start");
      if (nx && nx.t - x.t < 300) prompt++;
    });
    check("⭐ المقطعُ يُنهى عند نهاية كلامه، والتاليةُ المستحقّةُ تبدأ فوراً — لا بعد صمت ذيله", early >= 2 && prompt >= 1, { early, prompt });
    const sk = saidAll(e, "az-start").map((x) => x.seek);
    check("⭐ ويبدأ كلُّ مقطعٍ من أوّل كلامه لا من صمت أوّله (عُشرُ ثانيةٍ في الحارس)", sk.length >= 3 && sk.every((x) => x > 0.05 && x < 0.1), sk);
    e.api.dubStop("user");
  }

  console.log("\n[١٨] تصميمُ الجولة — قفزٌ والفيديو متوقّف · لا نعاند المستخدم · مقطعٌ جاهزٌ يُنطق في مهلة 429 · حصّةٌ نفدت · كلامٌ كثيف");
  {
    // R1 — أوقفتُ الفيديو وسطَ جملةٍ بصوت Azure ثمّ سحبتُ الشريط ثلاثين ثانيةً وأكملتُ: ⛔ ~~يكمل المقطعُ القديم في الموضع الجديد~~
    const e = makeEnv({ arTrack: arTrack(40, 2, 2, true) });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => saidAll(e, "az-start").length >= 1, 30000);
    await sleep(500);
    const old = saidAll(e, "az-start")[saidAll(e, "az-start").length - 1].text;
    e.video.pause();
    await sleep(800);
    e.video.currentTime = e.video.currentTime + 30;
    await sleep(800);
    e.video.play();
    await sleep(4000);
    check("⭐ قفزٌ والفيديو متوقّف ⇐ لا يكمل المقطعُ القديم، ويُنطق من الموضع الجديد", !e.spoken.some((x) => x.ev === "az-resume" && x.text === old) &&
      saidAll(e, "az-start").some((x) => x.vt > 30), { resumedOld: e.spoken.some((x) => x.ev === "az-resume" && x.text === old) });
    e.api.dubStop("user");
  }
  {
    // R2 — المستخدمُ ضغط «تشغيل» أثناء انتظارنا ⇐ القرارُ له: لا نوقفه ثانيةً لهذه الجملة
    const e = makeEnv({ azDelay: (n) => (n === 2 ? 9000 : 40) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.paused, 30000);
    const p0 = e.video.pauses;
    e.video.play();
    await sleep(2500);
    check("⭐ «تشغيل» أثناء انتظارنا ⇐ لا إيقافَ ثانٍ لها — ⛔ ~~نوقفه بعد لحظة~~", e.video.pauses === p0 && !e.video.paused, { before: p0, after: e.video.pauses });
    e.api.dubStop("user");
  }
  {
    // R4 — 429 على طلبٍ مسبق والمقاطعُ التاليةُ جاهزة ⇒ تُنطق بصوت Azure — ⛔ ~~صوتُ الجهاز وما دُفع يُرمى~~
    const e = makeEnv({ azMode: (n) => (n === 4 ? "429" : "ok") });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.api.dubStatus().azWarn === "rate", 30000);
    const ready = e.api.dub.sents.filter((x) => x.clip && x.clip.res && x.clip.res.ok).map((x) => x.ar);
    await sleep(9000);
    const az = saidAll(e, "az-start").map((x) => x.text), dev = e.spoken.filter((x) => x.ev === "start" && /^ترجمة/.test(x.text)).map((x) => x.text);
    check("⭐ ما جُلب قبل الـ429 يُنطق بصوت Azure لا بصوت الجهاز", ready.length >= 1 && ready.every((t) => !dev.includes(t)) && ready.some((t) => az.includes(t)), { ready, az, dev });
    e.api.dubStop("user");
  }
  {
    // 📄 403 بنصٍّ يذكر الحصّة ⇒ «نفدت الحصّة» لا «المفتاح مرفوض»، وصوتُ الجهاز يخلف
    const e = makeEnv({ azMode: (n) => (n >= 2 ? "403" : "ok"), az403Quota: true });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.api.dubStatus().azOff !== "", 30000);
    check("⭐ حصّةُ الشهر نفدت ⇐ يُقال بسببه («quota»)", e.api.dubStatus().azOff === "quota", e.api.dubStatus().azOff);
    e.api.dubStop("user");
  }
  {
    // ⭐ كلامٌ كثيف بصوت Azure والانتظارُ مفعّل: «حامد» بسرعته (📄 107 كلمة/د ⇐ نحو 11.1 حرفاً/ث) وسطرٌ كلَّ 1.8 ث (كثافةُ العربيّة
    // المقيسة: تحتاج فوق 1.4) ⇒ يلحق بالتسريع ولا يتوقّف الفيديو إلا نادراً — ⛔ ~~سقفٌ ثابت 1.4 وإيقافٌ عند 1.5 ث: مرّاتٌ في الدقيقة~~
    // 📐 بشروط تصميم الجولة: صمتُ ذيلٍ 0.85 ث وردٌّ في 600ms — القديمُ (لقطةُ 11:49) أوقف الفيديو 3.04 مرّةً في الدقيقة وتأخّرُه p90 1.69 ث
    const e = makeEnv({ arTrack: arTrack(70, 2, 1.8, true), azCps: 11.1, azTail: 0.85, azDelay: 600 });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    const v0 = e.video.currentTime, p0 = e.video.pauses | 0;
    await sleep(60000);
    const mins = Math.max(0.5, (e.video.currentTime - v0) / 60), perMin = ((e.video.pauses | 0) - p0) / mins;
    const sents = e.api.dub.sents, lags = saidAll(e, "az-start").map((x) => { const u = sents.find((t) => t.ar === x.text); return u ? x.vt - u.start / 1000 : 9; }).sort((a, b) => a - b);
    const p90 = lags.length ? lags[Math.min(lags.length - 1, Math.floor(0.9 * lags.length))] : 9;
    // بالعدّ لا بالمعدّل: دقيقةٌ من الكلام الكثيف ⇐ إيقافٌ واحدٌ على الأكثر (قد يكون انتظارَ أوّل مقطعٍ عند البدء) — القديمُ 2–3
    const pauses = (e.video.pauses | 0) - p0;
    check("⭐ كلامٌ كثيف ⇐ إيقافُ الفيديو نادر (مرّةٌ في الدقيقة على الأكثر) وتأخّرُ الجمل p90 أقلُّ من ثانية، ولا تُتخطّى",
      pauses <= 1 && p90 < 1 && lags.length >= 8 && e.api.dubStatus().skipped === 0,
      { perMin: perMin.toFixed(2), p90: p90.toFixed(2), n: lags.length, skipped: e.api.dubStatus().skipped, waits: e.api.dubStatus().waits });
    e.api.dubStop("user");
  }

  {
    // ⭐ صوتُ الجهاز («ليلى» 8.15 حرفاً/ث) على كلامٍ كثيف لا يلحق: إيقافُ اللحاق مرّةً كلَّ عشرين ثانيةً على الأكثر (تصميمُ الجولة G5)
    // — ⛔ ~~يتوقّف الفيديو كلَّ جملة~~ (21 مرّةً في ثلاث دقائق في التصميم)
    const e = makeEnv({ arTrack: arTrack(70, 2, 1.8, true) });
    await startRun(e, { source: "yt" });
    const p0 = e.video.pauses | 0;
    await sleep(60000);
    const pauses = (e.video.pauses | 0) - p0;
    check("⭐ صوتٌ لا يلحق ⇐ ثلاثةُ إيقافاتٍ في الدقيقة على الأكثر (مرّةٌ كلَّ عشرين ثانية)", pauses <= 3, { pauses, waits: e.api.dubStatus().waits });
    e.api.dubStop("user");
  }

  console.log("\n[١٩] حَكَمُ الجولة الثالثة — قفزٌ وانتظارُنا يُمسك الفيديو · 429 يُغلق الحدَّ لحظةَ يصل · فشلٌ عابرٌ يُعاد · مقطعٌ متأخّرٌ جدّاً يُتخطّى · انتظارٌ بعد القفز · سرعةُ الفيديو وسطَ المقطع · سرعةٌ ثابتة · أرقامُ القياس");
  const EV40 = []; for (let i = 0; i < 40; i++) EV40.push({ tStartMs: 2000 + i * 3000, dDurationMs: 2800, segs: [{ utf8: "Sentence number " + (i + 1) + "." }] });
  {
    // S2 (P4) — سحبُ الشريط ثلاثين ثانيةً إلى الوراء وانتظارُنا يُمسك الفيديو: ⛔ ~~النبضةُ تعود من الانتظار قبل فحص القفز فيُبتلع، ويبقى
    // الموضعُ عند الجملة القديمة فلا مقطعَ حتى يبلغها الفيديو~~ ⇒ موضعُ إيقافنا محفوظ ⇒ يُنطق من الموضع الجديد فورَ الإطلاق
    let slow = "";
    const e = makeEnv({ events: EV40, azDelay: (n, text) => (text && text === slow ? 6000 : 40) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 40, 90000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    slow = u.ar;
    e.video.currentTime = u.start / 1000 + 0.4;                       // قفزةٌ إلى جملةٍ لم يُجلب صوتُها: تستحقّ الآن وطلبُها ست ثوانٍ ⇐ انتظار
    const waited = await until(() => e.video.paused && /^wait-/.test(e.api.dubStatus().hold), 8000);
    const at = e.video.currentTime, n0 = saidAll(e, "az-start").length;
    e.video.currentTime = at - 30;                                     // يسحب الشريط والفيديو موقوفٌ بنا
    await until(() => !e.video.paused, 8000);
    await until(() => saidAll(e, "az-start").length > n0, 15000);
    const first = saidAll(e, "az-start")[n0];
    check("⭐ قفزٌ والانتظارُ يُمسك الفيديو ⇐ يُنطق من الموضع الجديد خلال ثانيةٍ ونصف — ⛔ ~~صمتٌ حتى يبلغ الفيديو الجملةَ القديمة~~",
      waited && !!first && first.text !== slow && Math.abs(first.vt - (at - 30)) < 1.5, { waited, first: first && { vt: first.vt, text: first.text }, seekTo: at - 30 });
    e.api.dubStop("user");
  }
  {
    // S3 · S4 (P1) — 429 على طلبٍ مسبق، وAzure يخنق ثماني ثوانٍ بعده (كلُّ طلبٍ فيها 429): ⛔ ~~يُصنَّف الرفضُ حين تُنطق جملتُه ⇐ تذهب
    // طلباتٌ أخرى في نافذة الخنق، وتُنطق جملٌ بصوت الماك~~ ⇒ يُغلق الحدُّ لحظةَ يصل الرفض، وجملتُه تُعاد بعد المهلة بصوت Azure
    let thr = -1, n429 = 0, refused = "";
    const e = makeEnv({ azMode: (n, text) => {
      const t = now();
      if (n === 4) { thr = t + 8000; n429++; refused = text; return "429"; }
      if (t < thr) { n429++; return "429"; }
      return "ok";
    } });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => !!refused && saidAll(e, "az-start").some((x) => x.text === refused), 40000);
    const mac = e.spoken.filter((x) => x.ev === "start" && /^ترجمة/.test(x.text)).length;
    check("⭐ 429 على طلبٍ مسبق ⇐ رفضٌ واحدٌ لا أكثر، ولا جملةَ بصوت الماك، وجملتُه سُمعت بصوت Azure بعد المهلة", n429 === 1 && mac === 0 &&
      saidAll(e, "az-start").some((x) => x.text === refused), { n429, mac, refused, heard: saidAll(e, "az-start").some((x) => x.text === refused) });
    e.api.dubStop("user");
  }
  {
    // S4 — 500 على طلبٍ مسبق ⇐ يُعاد مرّةً عبر الحدّ نفسِه وتُسمع جملتُه — ⛔ ~~يُشغَّل فاشلاً فتضيع~~ · والمفتاحُ المرفوضُ لا يُعاد (انظر [١٤])
    let failed = "";
    const e = makeEnv({ azMode: (n, text) => (n === 4 ? ((failed = text), "500") : "ok") });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => !!failed && saidAll(e, "az-start").some((x) => x.text === failed), 30000);
    const tries = e.azReqs.filter((r) => r.text === failed).length;
    check("⭐ 500 ⇐ طلبٌ واحدٌ زائد وسُمعت الجملة، ولا ضائع", tries === 2 && e.api.dubStatus().lost === 0 && saidAll(e, "az-start").some((x) => x.text === failed),
      { tries, lost: e.api.dubStatus().lost });
    e.api.dubStop("user");
  }
  {
    // S5 — الانتظارُ مطفأ وصوتُ جملةٍ وصل بعد موعدها بأكثرَ من ست ثوانٍ ⇐ يُتخطّى ويُعدّ — ⛔ ~~يُنطق متأخّراً فيُزحم كلُّ ما بعده~~
    let slow = "";
    const e = makeEnv({ events: EV40, azDelay: (n, text) => (text && text === slow ? 7500 : 40) });
    await startRun(e, { source: "device", engine: "azure", wait: false, az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 20, 60000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    slow = u.ar;
    const sk0 = e.api.dubStatus().skipped;
    e.video.currentTime = u.start / 1000 + 0.2;
    await sleep(11000);
    check("⭐ صوتٌ وصل متأخّراً 7.7 ث ⇐ تُخطّي وعُدّ ولم يُنطق — والدبلجةُ مضت", e.api.dubStatus().skipped > sk0 && !saidAll(e, "az-start").some((x) => x.text === slow) &&
      saidAll(e, "az-start").some((x) => x.vt > u.start / 1000 + 6), { skipped: e.api.dubStatus().skipped - sk0, heardSlow: saidAll(e, "az-start").some((x) => x.text === slow) });
    e.api.dubStop("user");
  }
  {
    // S6 — انتظارٌ انقضت مهلتُه ثمّ قفزٌ إلى ما قبل جملته وصوتُها لم يجهز ثانيةً ⇐ تُنتظر من جديد — ⛔ ~~«انتُظرت مرّةً» تبقى بعد القفز
    // فلا يُنتظر لها أبداً~~
    let slow = "";
    const e = makeEnv({ events: EV40, azDelay: (n, text) => (text && text === slow ? 4500 : 40) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 20, 60000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    slow = u.ar;
    e.video.currentTime = u.start / 1000 + 0.3;
    await until(() => saidAll(e, "az-start").some((x) => x.text === slow), 20000);     // انتظارٌ انقضت مهلتُه ثمّ وصل الصوتُ فنُطق متأخّراً
    const p0 = e.video.pauses | 0;
    await sleep(500);
    e.video.currentTime = u.start / 1000 - 1;                          // قفزٌ إلى ما قبلها بثانية: صوتُها يُطلب ثانيةً (4.5 ث)
    await until(() => (e.video.pauses | 0) > p0, 6000);
    check("⭐ بعد القفز تُنتظر الجملةُ ثانيةً — ⛔ ~~لا انتظارَ لها أبداً~~", (e.video.pauses | 0) > p0, { before: p0, after: e.video.pauses | 0 });
    e.api.dubStop("user");
  }
  {
    // S7 (R3) — سرعةُ الفيديو من 1× إلى 1.5× عند ثلث مقطعٍ يملأ نافذتَه: ⛔ ~~يبقى بسرعته فيتجاوز نافذتَه~~ ⇒ تتبعها سرعتُه في نبضة
    const e = makeEnv({ arTrack: arTrack(16, 2, 2, true) });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => saidAll(e, "az-start").length >= 2, 30000);
    const n0 = saidAll(e, "az-start").length;
    await until(() => saidAll(e, "az-start").length > n0, 20000);
    const a = saidAll(e, "az-start")[n0], u = e.api.dub.sents.find((x) => x.ar === a.text);
    await sleep(u.win * 0.3);
    const tc = now();
    e.video.playbackRate = 1.5;
    await until(() => e.spoken.some((x) => (x.ev === "az-end" || x.ev === "az-pause") && x.text === a.text), 20000);
    const rt = e.spoken.find((x) => x.ev === "az-rate" && x.text === a.text && x.t >= tc), end = e.spoken.find((x) => (x.ev === "az-end" || x.ev === "az-pause") && x.text === a.text);
    const over = end ? end.vt - (u.start + u.win) / 1000 : 9;
    check("⭐ الفيديو أسرعُ وسطَ المقطع ⇐ تتبعه سرعتُه خلال 200ms، وينتهي في نافذته (±0.3 ث) — ⛔ ~~يتجاوزها~~", !!rt && rt.t - tc <= 200 && rt.rate > 1.3 && over < 0.3,
      { rateAfter: rt && rt.rate, ms: rt && rt.t - tc, over });
    e.api.dubStop("user");
  }
  {
    // S8 — سرعةٌ ثابتة 2× بصوت Azure ⇐ يُطلب بها نفسِها (+100%) — ⛔ ~~بمنحنى «ليلى» (+91%)~~
    const e = makeEnv();
    await startRun(e, { source: "device", engine: "azure", rate: "2", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => saidAll(e, "az-start").length >= 2, 30000);
    const pr = e.azReqs.filter((r) => !/بدأتِ/.test(r.text)).map((r) => (r.body.match(/prosody rate="([^"]+)"/) || [])[1] || "none");
    check("⭐ «2×» ⇐ كلُّ طلبٍ بـ+100%", pr.length >= 2 && pr.every((x) => x === "+100%"), pr);
    e.api.dubStop("user");
  }
  {
    // S12 — أرقامُ القياس في الحال بعد ثلاثة مقاطع (يجيب عنها تشغيلُ المالك القادم بلا طلبٍ زائد) — ولا مفتاحَ فيها
    const e = makeEnv({ arTrack: arTrack(30, 2, 2, true), azTail: 0.85 });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => saidAll(e, "az-end").length + e.spoken.filter((x) => x.ev === "az-pause" && !/بدأتِ/.test(x.text)).length >= 3 && e.api.dubStatus().spoken >= 3, 60000);
    const st = e.api.dubStatus();
    check("⭐ الحالُ بأرقام القياس: سرعةُ الصوت · صمتا المقطع (عُشرٌ في أوّله و0.85 في آخره في الحارس) · السرعة · ما تحتاجه الجمل · التأخّر",
      st.cps > 9 && st.cps < 15 && Math.abs(st.leadMs - 100) <= 20 && Math.abs(st.tailMs - 850) <= 30 && Array.isArray(st.spd) && st.spd[0] >= 1 && st.spd[1] >= st.spd[0] &&
      Array.isArray(st.need) && st.need[0] > 0 && st.need[1] >= st.need[0] && typeof st.lagP90 === "number" && typeof st.stallS === "number",
      { cps: st.cps, leadMs: st.leadMs, tailMs: st.tailMs, spd: st.spd, need: st.need, lagP90: st.lagP90, stallS: st.stallS });
    check("⛔ ولا مفتاحَ في الحال", !JSON.stringify(st).includes(KEYZ));
    e.api.dubStop("user");
    // ⭐ ومتصفّحٌ لا يفكّ المقطع (بلا OfflineAudioContext) ⇐ صمتا المقطع «غيرُ معروفَين» (null) — ⛔ ~~«أوّله 0 م.ث»~~ رقمٌ يُقرأ قياساً ولم يُقس
    const f = makeEnv({ arTrack: arTrack(30, 2, 2, true) });
    await startRun(f, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => f.api.dubStatus().spoken >= 3, 60000);
    const sf = f.api.dubStatus();
    check("⭐ بلا فكٍّ للمقطع ⇐ صمتا المقطع null لا صفر", sf.spoken >= 3 && sf.leadMs === null && sf.tailMs === null, { leadMs: sf.leadMs, tailMs: sf.tailMs });
    f.api.dubStop("user");
  }
  {
    // S12 — ملاحظةُ المالك ١ في مصدرَي الترجمة: يوتيوب يعرض ترجمتَه العربيّة (اللاصقةُ عنده عربيّة) وأنا أقرأ ترجمةً أخرى ⇐ يُقال
    const AR_ON = { languageCode: "en", kind: "asr", translationLanguage: { languageCode: "ar" } };
    const e = makeEnv({ ccOn: AR_ON });
    await startRun(e, { source: "device" });
    await sleep(6000);
    const d1 = e.api.dubStatus().shownDiffers;
    e.api.dubStop("user");
    const f = makeEnv();
    await startRun(f, { source: "device" });
    await sleep(6000);
    check("⭐ «مترجم كروم» ويوتيوب يعرض ترجمتَه العربيّة ⇐ `shownDiffers` — وبلا ترجمةٍ معروضة ⇐ لا", d1 === true && f.api.dubStatus().shownDiffers === false,
      { arabicShown: d1, none: f.api.dubStatus().shownDiffers });
    f.api.dubStop("user");
  }

  console.log("\n[٢٠] مراجعةُ الجولة الثالثة المستقلّة — ما يُقرأ هو ما يُعرض · العربيّةُ المعروضة لا تُرفض · اختيارُ المستخدم أثناء انتظارنا · عرضٌ واحد · أسبابٌ صادقة");
  const URL_AR = "https://www.youtube.com/api/timedtext?v=VID&lang=en&kind=asr&tlang=ar&pot=POT&c=WEB&xorb=2&fmt=json3";
  const AR_ON = { languageCode: "en", kind: "asr", translationLanguage: { languageCode: "ar" } };
  const SHOW = { v: "VID", code: "en", asr: true, ql: "en", qk: "asr" };
  {
    // #1 — ⛔ ~~ملفٌّ لم يُقرأ ⇐ ترجمةُ المسار السابق من ذاكرة الإضافة~~ (مفتاحُها الفيديو والمصدر لا المسار) ⇒ يُقرأ ما يظهر ويُقال لماذا
    const e = makeEnv({ arTrack: arTrack(20, 2, 2) });
    const s1 = await startRun(e, { source: "yt" });
    e.api.dubStop("user");
    await sleep(3000);
    e.opts.noXhr = true;                                               // ملفُّ المسار الآخر لا يُقرأ هذه المرّة
    e.p.setOption("captions", "track", { languageCode: "en", kind: "", translationLanguage: { languageCode: "ar" } });
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ مسارٌ آخر معروضٌ وملفُّه لم يُقرأ ⇐ يُقرأ كما يظهر ويُقال لماذا — ⛔ ~~ترجمةُ المسار السابق والمعروضُ غيرُها~~",
      s1.kind === "ytar" && s2.state === "running" && s2.kind === "display" && !!s2.ytWhy, { first: s1.kind, second: s2.kind, why: s2.ytWhy });
    e.api.dubStop("user");
  }
  {
    // #2 — العربيّةُ معروضةٌ سلفاً وإعادةُ طلبها رُفضت (429): ⛔ ~~المفاتيحُ بطوابعنا~~ ⇒ بحروفها، والقاطعُ قائمٌ لما بعده — ⛔ ~~«وتقرأ ما يظهر»~~
    // (تحقّقُ الجولة V4، 📖 المشغّل: الشاشةُ فرغت قبل الطلب ولا يُعيدها إلا ردٌّ ناجح) ⇒ **رفضٌ يقول إنّ ترجمتَه اختفت** — لا «يُدبلج» بلا ما يُقرأ
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: () => ({ url: URL_AR, status: 429, size: 0 }) });
    const keys = () => JSON.stringify([e.local.getItem(e.STICKY), e.local.getItem("yt-player-sticky-caption"), e.session.getItem(e.PREFS)]);
    const before = keys();
    const st = await startRun(e, { source: "yt" });
    await sleep(2600);
    check("⭐ العربيّةُ معروضةٌ وإعادةُ طلبها رُفضت ⇐ رفضٌ «gone» بسببه (اختفت ترجمتُه) — ⛔ ~~«يُدبلج» ولا سطرَ على الشاشة~~",
      st.state === "refused" && st.reason === "gone" && /^refused:429/.test(st.detail), { state: st.state, reason: st.reason, detail: st.detail, kind: st.kind });
    check("⭐ والمفاتيحُ اللاصقةُ بحروفها — ⛔ ~~بطوابع إعادة الضبط~~", keys() === before, { before, after: keys() });
    const st1 = await startRun(e, { source: "yt" });
    check("وضغطةٌ ثانية ⇐ «gone» ثانيةً بلا إجبار — لا «يُدبلج» على شاشةٍ فارغة", st1.state === "refused" && st1.reason === "gone", { st: st1.state, reason: st1.reason });
    const st2 = await startRun(e, { source: "device" });
    check("والقاطعُ قائمٌ لما بعده: لا التقاطَ منّا في الصفحة", st2.state === "refused" && st2.reason === "breaker" && e.fetched.length === 0, { st: st2.state, reason: st2.reason, fetched: e.fetched.length });
  }
  {
    // تحقّقُ الجولة V3 — قاطعٌ من التقاط «مترجم كروم» ثمّ عُرضت العربيّة ⇐ «ترجمة يوتيوب» تقرأ ما يظهر بصفر طلبٍ وصفر نداءٍ للمشغّل — ⛔ ~~«رفض
    // يوتيوب» من سكربت الإضافة قبل أن يُسأل عالمُ الصفحة~~
    const e = makeEnv({ ourStatus: 429, arTrack: arTrack(20, 2, 2) });
    const s1 = await startRun(e, { source: "device" });
    e.p.setOption("captions", "track", AR_ON);
    await sleep(500);
    const calls0 = e.calls.length, reqs0 = e.playerReqs.length;
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ قاطعٌ من التقاطٍ سابق والعربيّةُ معروضة ⇐ تقرأ ما يظهر (`breaker` سببُها) بلا نداءٍ للمشغّل ولا طلب",
      s1.reason === "breaker" && s2.state === "running" && s2.kind === "display" && s2.ytWhy === "breaker" && e.calls.length === calls0 && e.playerReqs.length === reqs0,
      { first: s1.reason, state: s2.state, kind: s2.kind, why: s2.ytWhy, calls: e.calls.length - calls0, reqs: e.playerReqs.length - reqs0 });
    e.api.dubStop("user");
  }
  {
    // #3 — غيّر المستخدمُ لغةَ ترجمته أثناء انتظارنا ردَّ إعادة الضبط ⇐ ⛔ ~~يُعاد مفتاحُه إلى «العربيّة» الآن وبعد ثانيتين~~
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: () => ({ url: URL_AR, status: 200, size: 900, delay: 3000 }) });
    e.api.dubStart({ source: "yt" });
    await sleep(1500);
    const mine = JSON.stringify({ data: "en", expiration: 9, creation: 7 });
    e.local.setItem(e.STICKY, mine);
    await until(() => e.api.dubStatus().state === "running", 20000);
    await sleep(2600);
    check("⭐ اختيارُ المستخدم أثناء انتظارنا يبقى — ⛔ ~~يُطمس بلقطة ما قبلنا~~", e.local.getItem(e.STICKY) === mine, e.local.getItem(e.STICKY));
    e.api.dubStop("user");
  }
  {
    // #5 — عرضان متداخلان ⇐ ⛔ ~~تُزال المراقبتان بغير ترتيب تركيبهما فتبقى دالّتُنا على نموذج XHR~~ ⇒ الثاني «busy»
    let n = 0;
    const e = makeEnv({ arTrack: arTrack(20, 2, 2), playerReq: () => { n++; return { url: URL_AR, status: 200, size: 900, delay: n === 1 ? 300 : 4000 }; } });
    const p1 = e.ask("show", SHOW);
    await sleep(150);
    const r2 = await e.ask("show", SHOW);
    const r1 = await p1;
    await sleep(5000);
    check("⭐ عرضان متداخلان ⇐ الثاني «busy»، ونموذجُ XHR أصليٌّ بعدهما — ⛔ ~~دالّتُنا عليه إلى أن تُغلق الصفحة~~", r2.reason === "busy" && r1.ok === true && e.xhrNative(),
      { r1: r1.ok, r2: r2.reason, native: e.xhrNative() });
    await e.ask("hide");
  }
  {
    // #5 — عرضٌ تجاوز مهلةَ طالبه ⇐ «late» ويتراجع عمّا فعل — ⛔ ~~ترجمةٌ معروضةٌ لا يُخفيها أحد~~
    const e = makeEnv({ arTrack: arTrack(20, 2, 2), playerReq: () => ({ url: URL_AR, status: 200, size: 900, delay: 2500 }) });
    const r = await e.ask("show", Object.assign({ dl: 1000 }, SHOW));
    const cc = e.p.querySelector(".ytp-subtitles-button").getAttribute("aria-pressed");
    check("⭐ عرضٌ تجاوز مهلةَ طالبه ⇐ «late» وCC مطفأٌ كما كان", r.reason === "late" && cc === "false", { reason: r.reason, cc });
  }
  {
    // #6 — إرسالُ XHR يرمي ⇐ ⛔ ~~يبقى «قيد التنفيذ» فيُنتظر خمسَ عشرةَ ثانيةً ويُقال «parse»~~ ⇒ «no-request» بعد المهلة القصيرة
    const e = makeEnv({ arTrack: arTrack(20, 2, 2), xhrThrows: true });
    const t0 = now();
    const r = await e.ask("show", SHOW);
    check("⭐ إرسالٌ رمى ⇐ «no-request» في نحو خمس ثوانٍ", r.ok === true && r.why === "no-request" && now() - t0 < 8000, { why: r.why, ms: now() - t0 });
    await e.ask("hide");
  }
  {
    // #7 — نصٌّ أكبرُ من ثمانية ملايين حرف (فيديو طويلٌ جدّاً) ⇐ ⛔ ~~«not-json3» ولا يُعاد في الصفحة~~ — السقفُ للقراءة المسبقة وحدَها
    const BIG = [], w = "word ".repeat(600);
    for (let i = 0; i < 3000; i++) BIG.push({ tStartMs: 2000 + i * 3000, dDurationMs: 2800, segs: [{ utf8: w + i + "." }] });
    const e = makeEnv({ events: BIG });
    const st = await startRun(e, { source: "device" });
    check("⭐ نصٌّ بأكثرَ من ثمانية ملايين حرف ⇐ يُلتقط ويعمل", st.state === "running" && st.total > 0, { state: st.state, reason: st.reason, total: st.total });
    e.api.dubStop("user");
  }
  {
    // #9 — نسخةٌ أقدم من عالم الصفحة بقيت في صفحةٍ فُتحت قبل التحديث ⇐ ⛔ ~~تعمل صامتةً بلا ما بُني بعدها~~ ⇒ «main-old»
    const e = makeEnv({ oldMain: true });
    const st = await startRun(e, { source: "device" });
    check("⭐ نسخةٌ قديمةٌ في الصفحة ⇐ رفضٌ «main-old» (أعد تحميل الصفحة)", st.state === "refused" && st.reason === "main-old", st);
  }
  {
    // نافذة #4 — «مترجم Azure» ولا مترجمَ كروم ⇐ الحالُ تقوله (`trLocal`) فلا يُدَّعى «بمترجم كروم» حين يتوقّف Azure
    const e = makeEnv({ noTranslator: true });
    const st = await startRun(e, { source: "azure", engine: "system", az: { trKey: TRK, trRegion: "uaenorth" } });
    check("⭐ لا مترجمَ كروم ⇐ `trLocal` false", st.state === "running" && st.trLocal === false, { state: st.state, trLocal: st.trLocal });
    e.api.dubStop("user");
  }
  {
    // نافذة #10 — «مترجم Azure» بلا مفتاح مترجم ولا مترجمَ كروم ⇐ يُسمّى المفتاحُ الناقص — ⛔ ~~«مترجم كروم غير متاح» وحدَه~~
    const e = makeEnv({ noTranslator: true });
    const st = await startRun(e, { source: "azure", engine: "system", az: {} });
    check("⭐ بلا مفتاح مترجم ⇐ «az-trnokey»", st.state === "refused" && st.reason === "az-trnokey", st);
  }
  {
    // نافذة #5 — نقرأ اليدويّةَ العربيّة نفسَها («speak») ويوتيوب يعرضها ⇐ ⛔ ~~«يوتيوب يعرض ترجمتَه وأنا أقرأ ترجمةً أخرى»~~
    const AR_MAN = { languageCode: "ar", kind: "" };
    // طلبُ المشغّل بلغة المسار نفسِه (لا «en/asr» الافتراضيّ) — فيُلتقط اليدويُّ العربيّ
    const byTrack = (t) => ({ url: "https://www.youtube.com/api/timedtext?v=VID&lang=" + t.languageCode + (t.kind ? "&kind=" + t.kind : "") +
      (t.translationLanguage ? "&tlang=" + t.translationLanguage.languageCode : "") + "&pot=POT&c=WEB&xorb=2&fmt=json3", status: 200, size: 900 });
    const e = makeEnv({ captionTracks: [{ baseUrl: "/api/timedtext?v=VID&lang=ar", languageCode: "ar", kind: "" }], tracklist: [AR_MAN], playerReq: byTrack });
    const st = await startRun(e, { source: "device" });
    e.p.setOption("captions", "track", AR_MAN);
    await sleep(6000);
    const s2 = e.api.dubStatus();
    check("⭐ «speak» ويوتيوب يعرض اليدويّةَ العربيّة نفسَها ⇐ لا `shownDiffers`", st.kind === "speak" && s2.state === "running" && e.api.dub.trackLang === "ar" &&
      s2.shownDiffers === false, { kind: st.kind, state: s2.state, reason: s2.reason, trackLang: e.api.dub && e.api.dub.trackLang, shownDiffers: s2.shownDiffers });
    e.api.dubStop("user");
  }
  {
    // نافذة #6 — أصواتُ الجهاز اختيرت وسطَ التشغيل ولا صوتَ عربيّ ⇐ ⛔ ~~«يُدبلج» وكلُّ جملةٍ تضيع صامتة~~ ⇒ «no-voice»
    const e = makeEnv({ voices: [] });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    e.api.dubSetOptions({ engine: "system", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.api.dubStatus().hold === "no-voice", 6000);
    check("⭐ لا صوتَ عربيّ في الجهاز والمحرّكُ «الجهاز» ⇐ «no-voice» يُقال", e.api.dubStatus().hold === "no-voice", e.api.dubStatus().hold);
    e.api.dubStop("user");
  }

  {
    // تحقّقُ الجولة الثاني W1 — «gone» لفيديو الرفض وحدَه وحتى يُحمَّل مسارُه بنجاح: أعاد المستخدمُ اختيارَ العربيّة ⇐ تُقرأ كما تظهر بلا طلب —
    // ⛔ ~~«اختفت» لكلّ ضغطةٍ بعدها في الصفحة~~ · وفيديو آخر ⇐ كذلك
    let nReq = 0;
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: () => (nReq++ === 0 ? { url: URL_AR, status: 429, size: 0 } : { url: URL_AR, status: 200, size: 900 }) });
    const s1 = await startRun(e, { source: "yt" });
    e.p.setOption("captions", "track", AR_ON);                          // المستخدمُ يعيد اختيارَ العربيّة من ⚙ — يُحمَّل المسارُ بنجاح
    await sleep(500);
    const reqs0 = e.playerReqs.length;
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ «gone» ثمّ أعاد المستخدمُ اختيارَ العربيّة ⇐ تقرأ ما يظهر بلا طلب — ⛔ ~~«اختفت» ثانيةً~~", s1.reason === "gone" && s2.state === "running" &&
      s2.kind === "display" && e.playerReqs.length === reqs0, { first: s1.reason, state: s2.state, reason: s2.reason, kind: s2.kind, reqs: e.playerReqs.length - reqs0 });
    e.api.dubStop("user");
  }
  {
    // W1 — رفضٌ لطلب ترجمةٍ غيرِ مسارنا أثناء إعادة الضبط ⇐ ⛔ ~~«اختفت ترجمتُك»~~ ⇒ مسارُنا يُقرأ مسبقاً، والقاطعُ يرتفع (لا إجبارَ بعده)
    const URL_DE = URL_AR.replace("lang=en", "lang=de");
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: () => [{ url: URL_DE, status: 429, size: 0, delay: 30 }, { url: URL_AR, status: 200, size: 900, delay: 150 }] });
    const st = await startRun(e, { source: "yt" });
    check("⭐ رفضٌ لطلبٍ آخر ومسارُنا وصل ⇐ «ytar» لا «gone»", st.state === "running" && st.kind === "ytar", { state: st.state, reason: st.reason, kind: st.kind });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة الثاني W3 — نطقٌ في الطابور (صوتٌ آخر يسبقنا) ثمّ قفزٌ إلى الوراء عشرين ثانيةً ثمّ إيقافٌ قصير ⇐ ⛔ ~~يُعدّ «مقطوعاً» فيقفز
    // المحرّكُ إلى جملة ما قبل القفز ويصمت ما بينهما~~ ⇒ يُستأنف من الموضع الجديد
    const e = makeEnv({ events: EV40 });
    await startRun(e, DEV);
    await until(() => e.video.currentTime > 40, 60000);
    e.engine.hold = true;
    await until(() => e.api.dub.cur && !e.api.dub.cur.started, 10000);
    const k = e.api.dub.cur.i, to = e.video.currentTime - 20, tSeek = now();
    e.video.currentTime = to;
    await sleep(300);
    e.video.pause();
    await sleep(700);
    e.video.play();
    e.release();
    await sleep(8000);
    const kStart = e.api.dub.sents[k].start / 1000, kText = e.api.dub.sents[k].ar;
    // ⚠️ نطقُ ما قبل القفز المعلَّقُ في الطابور «يبدأ» لحظةَ يُفرَج عنه ثمّ يُقطع فوراً (قديم) — فلا يُعدّ
    const between = heard(e).filter((x) => x.t > tSeek && x.vt >= to - 0.5 && x.vt < kStart - 1 && x.text !== kText);   // ما سُمع بعد القفز وحدَه
    check("⭐ بعد القفز إلى الوراء وإيقافٍ قصير ⇐ يُنطق من الموضع الجديد لا من جملة ما قبل القفز", between.length >= 1, { k, kStart, to, heardAfter: heard(e).slice(-4).map((x) => x.vt) });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة الثاني W4 — مقطعُ Azure يُجلب فأُوقف الفيديو لحظةً ⇐ يُسمع بعد الاستئناف **بالردّ نفسِه** — ⛔ ~~يُرمى المدفوعُ ويُطلب ثانيةً~~
    let slow = "";
    const e = makeEnv({ events: EV40, azDelay: (n, text) => (text && text === slow ? 900 : 40) });
    await startRun(e, { source: "device", engine: "azure", wait: false, az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 20, 60000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    slow = u.ar;
    e.video.currentTime = u.start / 1000 + 0.3;
    await sleep(250);
    e.video.pause();
    await sleep(1200);
    e.video.play();
    await until(() => saidAll(e, "az-start").some((x) => x.text === slow), 8000);
    const asked = e.azReqs.filter((r) => r.text === slow).length;
    check("⭐ أُسكت قبل أن يُسمع ⇐ سُمع بعد الاستئناف بطلبٍ واحد (الردُّ أُعيد إلى جملته)", saidAll(e, "az-start").some((x) => x.text === slow) && asked === 1, { asked });
    e.api.dubStop("user");
  }

  {
    // تحقّقُ الجولة الثالث X1 — «gone» ثمّ أعاد المستخدمُ اختيارَ العربيّة **ثمّ أفرغ يوتيوب سجلَّ الموارد** (📖 clearResourceTimings) ⇐ تُقرأ كما تظهر —
    // ⛔ ~~«اختفت» والعربيّةُ على الشاشة~~
    let nReq = 0;
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: () => (nReq++ === 0 ? { url: URL_AR, status: 429, size: 0 } : { url: URL_AR, status: 200, size: 900 }) });
    const s1 = await startRun(e, { source: "yt" });
    e.p.setOption("captions", "track", AR_ON);
    await sleep(500);
    e.clearResources();
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ «gone» ثمّ إعادةُ الاختيار ثمّ أُفرغ السجلّ ⇐ تقرأ ما يظهر", s1.reason === "gone" && s2.state === "running" && s2.kind === "display", { first: s1.reason, state: s2.state, reason: s2.reason });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة الثالث X2 — أُوقف الفيديو بين play() و«playing» (📖 عشراتُ المللي في كروم) ⇐ ⛔ ~~يُبطَل رابطُ المقطع المُعاد إلى جملته فتضيع~~ ⇒
    // تُسمع بعد الاستئناف بالردّ نفسِه
    let fast = "";
    const e = makeEnv({ events: EV40, audioLag: 600 });
    await startRun(e, { source: "device", engine: "azure", wait: false, az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 20, 60000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    fast = u.ar;
    e.video.currentTime = u.start / 1000 + 0.3;
    await until(() => e.api.dub.cur && e.api.dub.cur.audio && e.api.dub.cur.audio.text === fast && !e.api.dub.cur.started, 5000);
    e.video.pause();
    await sleep(1200);
    e.video.play();
    await until(() => saidAll(e, "az-start").some((x) => x.text === fast), 8000);
    check("⭐ أُوقف بين play() و«playing» ⇐ سُمع بعد الاستئناف بلا رابطٍ ميّت، ولا ضائع", saidAll(e, "az-start").some((x) => x.text === fast) &&
      !e.spoken.some((x) => x.ev === "az-error" && x.text === fast) && e.api.dubStatus().lost === 0, { lost: e.api.dubStatus().lost, errors: e.spoken.filter((x) => x.ev === "az-error").length });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة الثالث X4 — سرعةٌ ثابتة 1× ثمّ 2× ومقطعُ جملةٍ يُجلب، ثمّ إيقافٌ وإرجاعٌ قليل ⇐ ⛔ ~~تُنطق بـ1× المقطعِ المُعاد بعد جملةٍ بـ2×~~
    let slow = "";
    const e = makeEnv({ events: EV40, azDelay: (n, text) => (text && text === slow ? 900 : 40) });
    await startRun(e, { source: "device", engine: "azure", wait: false, rate: "1", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 20, 60000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    slow = u.ar;
    e.video.currentTime = u.start / 1000 + 0.3;
    await sleep(200);
    e.api.dubSetOptions({ engine: "azure", wait: false, rate: "2", az: { key: KEYZ, region: "uaenorth" } });
    await sleep(100);
    e.video.pause();
    await sleep(500);
    e.video.currentTime = u.start / 1000 - 5;                            // إرجاعٌ قليلٌ والفيديو موقوف
    await sleep(300);
    e.video.play();
    await until(() => saidAll(e, "az-start").some((x) => x.text === slow), 15000);
    const k = saidAll(e, "az-start").find((x) => x.text === slow);
    check("⭐ بعد تبديل السرعة إلى 2× ⇐ جملةُ المقطع المُعاد تُنطق بـ2× لا بـ1×", !!k && k.speed > 1.9, { speed: k && k.speed });
    e.api.dubStop("user");
  }

  {
    // تحقّقُ الجولة الرابع X5 — «gone» على «الإنجليزية التلقائيّة >> العربيّة» ثمّ أعادها المستخدمُ من **مصدرٍ آخر** (اليدويّة الإنجليزيّة مترجمةً) وأُفرغ
    // السجلّ ⇐ تُقرأ كما تظهر — ⛔ ~~«اختفت» لأنّ المراقبَ ينتظر المسارَ المرفوضَ بعينه~~
    let nReq = 0;
    const byTrack = (t) => ({ url: "https://www.youtube.com/api/timedtext?v=VID&lang=" + t.languageCode + (t.kind ? "&kind=" + t.kind : "") +
      (t.translationLanguage ? "&tlang=" + t.translationLanguage.languageCode : "") + "&pot=POT&c=WEB&xorb=2&fmt=json3", status: 200, size: 900 });
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: (t) => (nReq++ === 0 ? { url: URL_AR, status: 429, size: 0 } : byTrack(t)) });
    const s1 = await startRun(e, { source: "yt" });
    e.p.setOption("captions", "track", { languageCode: "en", kind: "", translationLanguage: { languageCode: "ar" } });
    await sleep(500);
    e.clearResources();
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ «gone» ثمّ عربيّةٌ من مصدرٍ آخر وأُفرغ السجلّ ⇐ تقرأ ما يظهر", s1.reason === "gone" && s2.state === "running" && s2.kind === "display", { first: s1.reason, state: s2.state, reason: s2.reason });
    e.api.dubStop("user");
  }

  {
    // تحقّقُ الجولة الخامس — «gone» ثمّ عربيّةٌ يدويّةٌ نجحت ثمّ أعاد المستخدمُ الترجمةَ الآليّة فرُفضت (فرغت الشاشة) ⇐ «gone» — ⛔ ~~أوّلُ نجاحٍ يُثبَّت
    // فيُقال «يُدبلج» على شاشةٍ فارغة~~ ⇒ آخرُ نتيجةٍ للمسار المعروض تحكم
    const plan = [429, 200, 429];
    let nReq = 0;
    const urlOf = (t) => "https://www.youtube.com/api/timedtext?v=VID&lang=" + t.languageCode + (t.kind ? "&kind=" + t.kind : "") +
      (t.translationLanguage ? "&tlang=" + t.translationLanguage.languageCode : "") + "&pot=POT&c=WEB&xorb=2&fmt=json3";
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: (t) => { const st = plan[Math.min(nReq++, plan.length - 1)]; return { url: urlOf(t), status: st, size: st === 200 ? 900 : 0 }; } });
    const s1 = await startRun(e, { source: "yt" });
    e.p.setOption("captions", "track", { languageCode: "ar", kind: "" });   // العربيّةُ اليدويّة — نجحت
    await sleep(400);
    e.p.setOption("captions", "track", AR_ON);                              // ثمّ الترجمةُ الآليّة ثانيةً — رُفضت
    await sleep(400);
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ نجحت عربيّةٌ أخرى ثمّ رُفض المسارُ المعروض ⇐ «gone» لا «يُدبلج» على شاشةٍ فارغة", s1.reason === "gone" && s2.state === "refused" && s2.reason === "gone",
      { first: s1.reason, state: s2.state, reason: s2.reason, kind: s2.kind });
    e.api.dubStop("user");
  }

  {
    // تحقّقُ الجولة السادس Y1 (ب) — «gone» على فيديو، ثمّ فيديو آخر رفض يوتيوب طلبَ المشغّل لعربيّته (فرغت الشاشة) ⇐ «gone» — ⛔ ~~«يُدبلج» على شاشةٍ
    // فارغة لأنّ القاعدةَ لفيديو رفضِنا وحدَه~~
    let curV = "VID", nReq = 0;
    const urlV = () => "https://www.youtube.com/api/timedtext?v=" + curV + "&lang=en&kind=asr&tlang=ar&pot=POT&c=WEB&xorb=2&fmt=json3";
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: () => { nReq++; return { url: urlV(), status: 429, size: 0 }; } });
    const s1 = await startRun(e, { source: "yt" });
    curV = "VID2"; e.location.search = "?v=VID2";                        // تنقّلٌ إلى فيديو آخر
    e.p.setOption("captions", "track", AR_ON);                              // المشغّلُ يحمّل عربيّتَه من اللاصقة — يرفضها يوتيوب
    await sleep(400);
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ فيديو آخر رُفضت عربيّتُه والقاطعُ مرفوع ⇐ «gone» لا «يُدبلج» على شاشةٍ فارغة", s1.reason === "gone" && s2.state === "refused" && s2.reason === "gone",
      { first: s1.reason, state: s2.state, reason: s2.reason, kind: s2.kind });
    e.api.dubStop("user");
  }
  {
    // Y1 (أ) — القاطعُ من مسار «غير معروضة» (CC مطفأ ورُفض إجبارُنا) ثمّ اختار المستخدمُ العربيّةَ فرُفضت ⇐ «gone» — ⛔ ~~«يُدبلج» على شاشةٍ فارغة~~
    const e = makeEnv({ arTrack: arTrack(20, 2, 2), playerReq: () => ({ url: URL_AR, status: 429, size: 0 }) });
    const s1 = await startRun(e, { source: "yt" });
    e.p.setOption("captions", "track", AR_ON);
    await sleep(400);
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ قاطعٌ من مسارٍ آخر ثمّ رُفض اختيارُ المستخدم ⇐ «gone»", s1.reason === "breaker" && s2.state === "refused" && s2.reason === "gone",
      { first: s1.reason, state: s2.state, reason: s2.reason, kind: s2.kind });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة السادس Y2 — «gone» ثمّ أعاد المستخدمُ اختيارَ العربيّة والردُّ بطيء، فضغط «دبلِج» قبل وصوله ⇐ يُنتظر الردّ ⇐ تُقرأ كما تظهر —
    // ⛔ ~~«اختفت» قبل أن تظهر بلحظة~~
    let nReq = 0;
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: () => (nReq++ === 0 ? { url: URL_AR, status: 429, size: 0 } : { url: URL_AR, status: 200, size: 900, delay: 1500 }) });
    const s1 = await startRun(e, { source: "yt" });
    e.p.setOption("captions", "track", AR_ON);                              // الردُّ بعد 1.5 ث
    await sleep(200);
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ إعادةُ اختيارٍ في الطريق ⇐ يُنتظر ردُّها فتُقرأ كما تظهر — لا «gone»", s1.reason === "gone" && s2.state === "running" && s2.kind === "display",
      { first: s1.reason, state: s2.state, reason: s2.reason });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة السادس — شبكةُ الصدق: القراءةُ كما تظهر بلا سطرٍ عربيٍّ عشرين ثانية ⇐ «no-lines» يُقال — ⛔ ~~«يُدبلج» صامتاً~~
    const e = makeEnv({ cues: CUES(3, (k) => "سطرٌ عربيٌّ رقم " + k) });
    await startRun(e, { source: "yt" });
    await sleep(35000);
    check("⭐ لا سطرَ على الفيديو عشرين ثانية ⇐ «no-lines»", e.api.dubStatus().hold === "no-lines", e.api.dubStatus().hold);
    e.api.dubStop("user");
  }

  {
    // تحقّقُ الجولة السابع Z1 — «gone» ثمّ إعادةُ اختيارٍ رُفضت ثمّ ثانيةٌ بطيئة وضُغط «دبلِج» قبل ردّها ⇐ يُنتظر ⇐ تُقرأ كما تظهر — ⛔ ~~«اختفت» فوراً
    // لأنّ رفضاً أقدمَ مسجَّل~~
    const plan = [429, 429, 200];
    let nReq = 0;
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), playerReq: () => { const st = plan[Math.min(nReq++, plan.length - 1)];
      return { url: URL_AR, status: st, size: st === 200 ? 900 : 0, delay: st === 200 ? 1500 : 50 }; } });
    const s1 = await startRun(e, { source: "yt" });
    e.p.setOption("captions", "track", AR_ON);                              // إعادةُ اختيار — رُفضت
    await sleep(400);
    e.p.setOption("captions", "track", AR_ON);                              // ثانيةٌ — ردُّها بعد 1.5 ث
    await sleep(200);
    const s2 = await startRun(e, { source: "yt" });
    check("⭐ رفضٌ أقدمُ مسجَّلٌ وإعادةُ اختيارٍ في الطريق ⇐ يُنتظر ردُّها فتُقرأ كما تظهر", s1.reason === "gone" && s2.state === "running" && s2.kind === "display",
      { first: s1.reason, state: s2.state, reason: s2.reason });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة السابع Z2 — القراءةُ كما تظهر، وأوقف المستخدمُ الفيديو ثلاثين ثانيةً في فجوةٍ بين سطرين ثمّ شغّله ⇐ ⛔ ~~«لا سطرَ منذ عشرين ثانية»
    // لحظةَ الاستئناف~~
    // سطرٌ (2–4 ث) ثمّ فجوةٌ طويلةٌ حتى 20 ث — يُوقَف الفيديو فيها
    const e = makeEnv({ cues: [{ t: 2, d: 2, line: "سطرٌ عربيٌّ أوّل" }, { t: 20, d: 3, line: "سطرٌ عربيٌّ ثانٍ" }] });
    await startRun(e, { source: "yt" });
    await until(() => e.video.currentTime > 5, 10000);
    e.video.pause();
    await sleep(30000);
    e.video.play();
    await sleep(400);
    check("⭐ استئنافٌ بعد إيقافٍ طويلٍ في فجوة ⇐ لا «no-lines» لحظتَها", e.api.dubStatus().hold !== "no-lines", e.api.dubStatus().hold);
    e.api.dubStop("user");
  }

  {
    // تحقّقُ الجولة الثامن AA1 — شاشةٌ فارغةٌ فعلاً وتوقّفاتٌ قصيرةٌ متكرّرة (ثانيةٌ ونصفٌ كلَّ عشر) ⇐ «no-lines» يظهر — ⛔ ~~يُصفَّر العدُّ عند كلّ توقّفٍ
    // فلا يظهر أبداً~~ ⇒ تتوقّف الساعةُ أثناءه ولا تُصفَّر
    const e = makeEnv({ cues: [{ t: 300, d: 3, line: "سطرٌ بعيد" }] });
    await startRun(e, { source: "yt" });
    let seen = false;
    for (let k = 0; k < 7 && !seen; k++) {
      await sleep(8500);
      seen = seen || e.api.dubStatus().hold === "no-lines";
      e.video.pause(); await sleep(1500); e.video.play();
    }
    await sleep(500);
    seen = seen || e.api.dubStatus().hold === "no-lines";
    check("⭐ شاشةٌ فارغةٌ وتوقّفاتٌ قصيرةٌ متكرّرة ⇐ «no-lines» يظهر بعد عشرين ثانيةً من القراءة", seen, e.api.dubStatus().hold);
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة الثامن AA2 — رفضٌ للمسار المعروض في سجلّ الموارد وحدَه (قبل المراقب)، وأفرغ يوتيوب السجلَّ أثناء انتظارنا ⇐ «gone» — ⛔ ~~ينقلب
    // «يُدبلج» على شاشةٍ فارغة~~
    // الالتقاطُ يُجبر مسارَ المصدر (ينجح) ثمّ يُعيد العربيّةَ فيطلبها المشغّلُ ويُرفض — في السجلّ قبل أيّ قاطع — ثمّ يُرفض طلبُنا فيرتفع القاطع
    const URL_EN = "https://www.youtube.com/api/timedtext?v=VID&lang=en&kind=asr&pot=POT&c=WEB&xorb=2&fmt=json3";
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), ourStatus: 429,
      playerReq: (t) => (t.translationLanguage ? { url: URL_AR, status: 429, size: 0 } : { url: URL_EN, status: 200, size: 900 }) });
    const s0 = await startRun(e, { source: "device" });
    e.api.dubStart({ source: "yt" });
    await sleep(600);
    e.clearResources();                                                       // يوتيوب يُفرغ السجلَّ أثناء الانتظار
    await until(() => ["running", "refused", "stopped"].includes(e.api.dubStatus().state), 30000);
    const s1 = e.api.dubStatus();
    check("⭐ رفضٌ في السجلّ وحدَه وأُفرغ أثناء الانتظار ⇐ «gone» لا «يُدبلج» على شاشةٍ فارغة", s0.state === "refused" && s1.state === "refused" && s1.reason === "gone",
      { first: s0.reason, state: s1.state, reason: s1.reason, kind: s1.kind });
    e.api.dubStop("user");
  }

  {
    // تحقّقُ الجولة التاسع BB1 — القراءةُ كما تظهر: خمسَ عشرةَ ثانيةً بلا سطر ثمّ سرعةُ 2× (لا نقرأ فيها) عُرض أثناءها سطران ثمّ 1× ⇐ ⛔ ~~«لا سطرَ
    // منذ عشرين ثانية» بعد ثوانٍ من آخر سطر: الساعةُ الموقوفة حملت العدَّ فوق ما عُرض ولم نقرأه~~ — تقدّم المحتوى في الفجوة فالعدُّ من جديد
    const e = makeEnv({ cues: [{ t: 2, d: 2, line: "سطرٌ عربيٌّ أوّل" }, { t: 31, d: 2, line: "سطرٌ في السرعة" }, { t: 35, d: 2, line: "سطرٌ آخرُ في السرعة" },
      { t: 300, d: 3, line: "سطرٌ بعيد" }] });
    await startRun(e, { source: "yt" });
    await until(() => e.video.currentTime > 19, 30000);
    e.video.playbackRate = 2;
    await until(() => e.video.currentTime > 41, 30000);
    e.video.playbackRate = 1;
    await sleep(8000);
    const h1 = e.api.dubStatus().hold;
    await sleep(14000);
    const h2 = e.api.dubStatus().hold;
    check("⭐ سطورٌ عُرضت في سرعةٍ لا نقرأ فيها ثمّ عودة ⇐ لا «no-lines» بعد ثوانٍ منها — وبعد عشرين ثانيةً بلا سطرٍ يُقال",
      h1 !== "no-lines" && h2 === "no-lines", { after8: h1, after22: h2 });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة التاسع BB2 — رفضٌ للمسار المعروض في السجلّ قبل رفع القاطع، وأفرغ يوتيوب السجلَّ **قبل** الضغطة التالية ⇐ «gone» — ⛔ ~~«يُدبلج»
    // على شاشةٍ فارغة: الرفضُ الذي سبق المراقبَ لم يُحفظ~~ ⇒ المراقبُ يأخذ ما في السجلّ لحظةَ رفع القاطع (`buffered`)
    const URL_EN = "https://www.youtube.com/api/timedtext?v=VID&lang=en&kind=asr&pot=POT&c=WEB&xorb=2&fmt=json3";
    const e = makeEnv({ ccOn: AR_ON, arTrack: arTrack(20, 2, 2), ourStatus: 429,
      playerReq: (t) => (t.translationLanguage ? { url: URL_AR, status: 429, size: 0 } : { url: URL_EN, status: 200, size: 900 }) });
    const s0 = await startRun(e, { source: "device" });
    await sleep(300);
    e.clearResources();                                                       // يوتيوب يُفرغ السجلَّ قبل الضغطة
    const s1 = await startRun(e, { source: "yt" });
    check("⭐ رفضٌ سبق القاطعَ وأُفرغ السجلُّ قبل الضغطة ⇐ «gone» لا «يُدبلج» على شاشةٍ فارغة", s0.state === "refused" && s1.state === "refused" && s1.reason === "gone",
      { first: s0.reason, state: s1.state, reason: s1.reason, kind: s1.kind });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة العاشر CC2 — القراءةُ كما تظهر و«لا سطر» ظاهرٌ ثمّ إعلانٌ مُدمَجٌ في الخادم خمسَ عشرةَ ثانية ⇐ يعود «لا سطر» فورَ انتهائه —
    // ⛔ ~~«يُدبلج» على شاشةٍ فارغة عشرين ثانية: الفارقُ القديم بين الساعتين جعل المحتوى يبدو تقدّم بطول الإعلان~~
    const e = makeEnv({ cues: [{ t: 2, d: 2, line: "سطرٌ عربيٌّ أوّل" }, { t: 300, d: 3, line: "سطرٌ بعيد" }] });
    await startRun(e, { source: "yt" });
    await until(() => e.video.currentTime > 29, 40000);
    const h0 = e.api.dubStatus().hold;
    e.opts.ssapFreeze = e.video.currentTime - (e.opts.ssapOff || 0); e.opts.adOn = true;
    const ta = now();
    await sleep(15000);
    e.opts.ssapOff = (e.opts.ssapOff || 0) + (now() - ta) / 1000; e.opts.adOn = false; e.opts.ssapFreeze = null;
    const tb = now();
    let back = -1;
    while (now() - tb < 3000) { if (e.api.dubStatus().hold === "no-lines") { back = Math.round(now() - tb) / 1000; break; } await sleep(50); }
    check("⭐ إعلانٌ مُدمَجٌ في الخادم ⇐ يعود «لا سطر» خلال ثانية — لا «يُدبلج» على شاشةٍ فارغة", h0 === "no-lines" && back >= 0 && back <= 1, { before: h0, back });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة الحادي عشر DD1 — «ترجمة يوتيوب» مسبقاً بصوت Azure و«الانتظار» (الافتراض)، وإعلانٌ مُدمَجٌ في الخادم ينتهي والموضعُ بالفارق القديم
    // يقع في جملةٍ بعيدةٍ لا مقطعَ لها ⇐ لا إيقافَ للفيديو ولا طلبَ لصوتها — ⛔ ~~أوّلُ نبضةٍ بعد الإعلان تعمل بالفارق القديم: يُوقَف الفيديو لجملةٍ أبعدَ
    // بطول الإعلان ويُطلب صوتُها~~
    const cct = (e) => e.video.currentTime - (e.opts.ssapOff || 0);
    const res = [];
    for (const ahead of [20, 30]) {
      const e = makeEnv({ arTrack: arTrack(80, 2, 2) });
      const st = await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
      await until(() => e.video.currentTime > 12.5, 40000);
      const ct0 = cct(e), u = e.api.dub.sents.find((x) => x.start / 1000 > ct0 + ahead);
      const ms = Math.round((u.start / 1000 + 0.5 - ct0) * 1000);
      const p0 = e.video.pauses | 0, az0 = e.azReqs.length;
      e.opts.ssapFreeze = ct0; e.opts.adOn = true;
      const ta = now();
      await sleep(ms);
      e.opts.ssapOff = (e.opts.ssapOff || 0) + (now() - ta) / 1000; e.opts.adOn = false; e.opts.ssapFreeze = null;
      const tb = now();
      await sleep(700);
      res.push({ ahead, state: st.state, kind: st.kind, pauses: (e.video.pauses | 0) - p0, far: e.azReqs.slice(az0).some((r) => r.t >= tb - 20 && r.text === u.ar) });
      e.api.dubStop("user");
    }
    check("⭐ بعد إعلانٍ مُدمَج: لا إيقافَ للفيديو ولا طلبَ لصوت جملةٍ أبعدَ بطوله", res.every((r) => r.state === "running" && r.pauses === 0 && !r.far), res);
  }
  {
    // تحقّقُ الجولة الحادي عشر DD2 — جملةٌ طويلةٌ (نافذتُها نحو ثماني ثوانٍ) يُقطع نطقُها بعد ثانيتين وخُمسَين من أوّلها: بإيقاف · بإعلانٍ مُدمَجٍ في الخادم ·
    // بإعلانٍ من المشغّل يُعيد زمنَ المحتوى مع رفع وسمه ⇐ تُعاد بعده في الثلاثة — ⛔ ~~لا تُعاد بعد الإعلان (الحدُّ المعلَن): بدأت جملةٌ من بعدها، أو رأى
    // الكاشفُ عودةَ المحتوى قفزةً فبدأ من الموضع~~ · ⛔ ~~جملةٌ نافذتُها 4.2 ث وقطعٌ بعد 1.8~~ (الثاني عشر): هامشُ عُشرِ ثانيةٍ دون نصف النافذة كان يحمرّ تحت
    // الحِمل على كودٍ سليم ⇒ القطعُ بعد ما تلتقطه قاعدةُ البدء (1.5 ث: فيشهد على القديم) وقبل نصف النافذة بأكثر من ثانية
    const cct = (e) => e.video.currentTime - (e.opts.ssapOff || 0);
    const longTrack = (n) => {
      const words = [];
      for (let k = 1; k <= n; k++) words.push(...("هذه الجملة رقم " + k + " وهي جملةٌ طويلةٌ جدّاً تمتدّ على أسطرٍ عدّةٍ حتى تطول نافذتُها وهي كاملة.").split(" "));
      const lines = [];
      let cur = "";
      for (const w of words) { if (cur && (cur + " " + w).length > 30) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
      if (cur) lines.push(cur);
      return lines.map((line, j) => ({ t: 2 + j * 2, d: 4, line }));
    };
    const res = [];
    for (const how of ["pause", "ssap", "client"]) {
      const e = makeEnv({ arTrack: longTrack(16) });
      await startRun(e, { source: "yt" });
      const u = e.api.dub.sents.find((x) => x.start / 1000 > 12);
      await until(() => cct(e) >= u.start / 1000 + 2.2, 60000);
      const s0 = e.spoken.length, was = e.spoken.some((x) => x.ev === "start" && x.text === u.ar);
      let tb;
      if (how === "pause") { e.video.pause(); await sleep(8000); e.video.play(); tb = now(); }
      else if (how === "ssap") {
        e.opts.ssapFreeze = cct(e); e.opts.adOn = true;
        const ta = now();
        await sleep(8000);
        e.opts.ssapOff = (e.opts.ssapOff || 0) + (now() - ta) / 1000; e.opts.adOn = false; e.opts.ssapFreeze = null; tb = now();
      } else {
        const X = e.video.currentTime;
        e.opts.adOn = true; e.video.currentTime = 0;
        await sleep(8000);
        e.video.currentTime = X; e.opts.adOn = false; tb = now();
      }
      await sleep(2500);
      res.push({ how, win: u.win / 1000, was, reSaid: e.spoken.slice(s0).some((x) => x.ev === "start" && x.text === u.ar && x.t >= tb - 20) });
      e.api.dubStop("user");
    }
    check("⭐ جملةٌ قطعها إعلانٌ تُعاد بعده كما بعد إيقاف — مُدمَجاً في الخادم ومن المشغّل", res.every((r) => r.was && r.reSaid), res);
  }
  {
    // تحقّقُ الجولة الثاني عشر EE1 — «ترجمة يوتيوب» مسبقاً بصوت الجهاز، وقفزٌ يعبر إعلاناً مُدمَجاً سبق تشغيلُه فيتغيّر معه فارقُ الساعتين: إلى الأمام
    // (المحتوى 12 ⇐ 40، الفارق 0 ⇐ 20) وإلى الوراء (50 ⇐ 34، الفارق 20 ⇐ 0) ⇐ تُنطق جملةُ الموضع الجديد في موعدها — ⛔ ~~يُنقل آخرُ موضعٍ في كلّ
    // قياس فتختفي قفزةُ التصحيح: صمتٌ بطول الإعلان، أو جملةٌ من قبل عشرين ثانية~~
    const cct = (e) => e.video.currentTime - (e.opts.ssapOff || 0);
    const res = [];
    for (const leg of [{ from: 12, off0: 0, to: 40, off1: 20 }, { from: 50, off0: 20, to: 34, off1: 0 }]) {
      const e = makeEnv({ arTrack: arTrack(80, 2, 2) });
      if (leg.off0) { e.opts.ssapOff = leg.off0; e.video.currentTime = leg.off0; }
      await startRun(e, { source: "yt" });
      await until(() => cct(e) > leg.from, 80000);
      const s0 = e.spoken.length;
      e.opts.ssapOff = leg.off1; e.video.currentTime = leg.to + leg.off1;
      await sleep(4000);
      const first = e.api.dub.sents.find((x) => x.start / 1000 >= leg.to - 0.05);
      const st = e.spoken.slice(s0).find((x) => x.ev === "start" && x.text === first.ar);
      res.push({ to: leg.to, unit: first.start / 1000, at: st ? Math.round((st.vt - leg.off1) * 10) / 10 : null });
      e.api.dubStop("user");
    }
    check("⭐ قفزٌ يعبر إعلاناً مُدمَجاً ⇐ جملةُ الموضع الجديد تُنطق في موعدها (لا صمتٌ بطوله ولا جملةٌ قديمة)",
      res.every((r) => r.at != null && Math.abs(r.at - r.unit) <= 1), res);
  }
  {
    // تحقّقُ الجولة الثالث عشر FF1 — قفزٌ إلى الوراء يعبر إعلاناً مُدمَجاً (الفارق 20) إلى موضعٍ أقدمَ من طوله (المحتوى 50 ⇐ 10، و17)، والفيديو يجري أو
    // موقوفٌ يُسحب شريطُه ⇐ جملةُ الموضع الجديد تُنطق في موعدها ولا يُوقَف الفيديو — ⛔ ~~قراءةُ نبضة القفز بالفارق القديم سالبةٌ (10 − 20) فأطفأت
    // الكاشفَ في التالية: جملةٌ قديمةٌ ثمّ إيقافٌ للحاق وتأخّرٌ ثانيتين ونصفاً~~ · ⛔ ~~و15~~ (الرابع عشر): داخلَ نافذة البدء لجملة 14 فتُقال هي مسرعةً
    // وتُقاس التي بعدها بهامش 22–33 ms حقيقيّة ⇒ 17: خارجَ النافذة، فالهامشُ نحو 110 ms
    const cct = (e) => e.video.currentTime - (e.opts.ssapOff || 0);
    const res = [];
    for (const leg of [{ to: 10, paused: false }, { to: 17, paused: false }, { to: 10, paused: true }]) {
      const e = makeEnv({ arTrack: arTrack(80, 2, 2) });
      e.opts.ssapOff = 20; e.video.currentTime = 20;
      await startRun(e, { source: "yt" });
      await until(() => cct(e) > 50, 80000);
      const s0 = e.spoken.length;
      if (leg.paused) { e.video.pause(); await sleep(1500); }
      const p0 = e.video.pauses | 0;
      e.opts.ssapOff = 0; e.video.currentTime = leg.to;
      if (leg.paused) { await sleep(600); e.video.play(); }
      await sleep(4000);
      const first = e.api.dub.sents.find((x) => x.start / 1000 >= leg.to - 0.05);
      const st = e.spoken.slice(s0).find((x) => x.ev === "start" && x.text === first.ar);
      res.push({ to: leg.to, paused: leg.paused, unit: first.start / 1000, at: st ? Math.round(st.vt * 10) / 10 : null, pauses: (e.video.pauses | 0) - p0 });
      e.api.dubStop("user");
    }
    check("⭐ قفزٌ إلى الوراء يعبر إعلاناً مُدمَجاً أطولَ من الموضع ⇐ جملتُه في موعدها ولا إيقافَ للحاق — والفيديو يجري أو يُسحب موقوفاً",
      res.every((r) => r.at != null && Math.abs(r.at - r.unit) <= 1 && r.pauses === 0), res);
  }
  {
    // أذنُ المالك 2026-11-02 GG1 — بنصّه: «عند تغيير النص العربي تتغير لغه الترجمه وتصبح انجليزيه المفترض ماتتغير تضل دائما عربي او علي
    // نفس اختياري». الترجمةُ قبل الدبلجة إنجليزيّةٌ أو مطفأة ⇐ «ترجمة يوتيوب» تُظهر العربيّة ⇐ تبديلُ «النص العربي» إلى «جهازك» ⇐ **تبقى
    // العربيّةُ معروضة** — ⛔ ~~إيقافُ السلف يُعيد ما كان قبل الدبلجة~~ — ثمّ العودةُ إلى «ترجمة يوتيوب» ثمّ «أوقف الدبلجة» ⇐ **تعود الترجمةُ
    // كما كانت قبل الدبلجة** ولاصقتُها بحروفها
    const arShown = (e) => { const t = e.p.getOption("captions", "track") || {}; return !!(t.translationLanguage && t.translationLanguage.languageCode === "ar"); };
    const res = [];
    for (const before of ["en", "off"]) {
      const e = makeEnv(before === "en" ? { arTrack: arTrack(40, 2, 2), ccOn: { languageCode: "en", kind: "asr" } } : { arTrack: arTrack(40, 2, 2) });
      // الإنجليزيّةُ معروضةٌ ولاصقتُها «en» — كما يكتبها يوتيوب لمن اختارها (البيتُ يبدأ بـ«ar» لغيره)
      if (before === "en") e.local.setItem(e.STICKY, JSON.stringify({ data: "en", expiration: 1, creation: 1 }));
      const st0 = dataOf(e.local.getItem(e.STICKY));
      const s1 = await startRun(e, { source: "yt" });
      const a1 = arShown(e);
      const s2 = await startRun(e, { source: "device" });
      await sleep(1500);
      const a2 = arShown(e);
      const s3 = await startRun(e, { source: "yt" });
      const a3 = arShown(e);
      e.api.dubStop("user");
      await sleep(800);
      const t = e.p.getOption("captions", "track") || {};
      const back = before === "en" ? t.languageCode === "en" && !t.translationLanguage : e.calls[e.calls.length - 1] === "unload:captions" || !t.languageCode;
      res.push({ before, states: [s1.state, s2.state, s3.state], a1, a2, a3, back, sticky: dataOf(e.local.getItem(e.STICKY)) === st0 });
    }
    check("⭐ تبديلُ «النص العربي» لا يغيّر لغةَ الترجمة المعروضة — و«أوقف الدبلجة» يُعيد ما كان قبل الدبلجة",
      res.every((r) => r.states.every((x) => x === "running") && r.a1 && r.a2 && r.a3 && r.back && r.sticky), res);
  }
  {
    // مراجعةُ تبديل المصدر (2026-11-02) GG2 — بعد التبديل إلى «جهازك» يُوقف المستخدمُ الدبلجةَ **أثناء التقاط المصدر الجديد**: قبل أن يُعيد
    // الالتقاطُ لقطتَه (والمعروضُ إجبارُه) أو أثناء طلبنا بعدها ⇐ تعود الترجمةُ كما كانت قبل الدبلجة ولاصقتُها بحروفها — ⛔ ~~يُعيدها الإيقاف ثمّ
    // يُعيد الالتقاطُ لقطتَه (العربيّةَ الموروثة) ومفاتيحَها: العربيّةُ باقيةٌ بعد الإيقاف ولاصقتُها «ar»~~
    const res = [];
    for (const before of ["en", "off"]) for (const when of ["forcing", "fetch"]) {
      const e = makeEnv(Object.assign({ arTrack: arTrack(40, 2, 2), ourDelay: 3000 }, before === "en" ? { ccOn: { languageCode: "en", kind: "asr" } } : {}));
      if (before === "en") e.local.setItem(e.STICKY, JSON.stringify({ data: "en", expiration: 1, creation: 1 }));
      const st0 = dataOf(e.local.getItem(e.STICKY));
      await startRun(e, { source: "yt" });
      e.api.dubStart({ source: "device" });
      if (when === "forcing") await until(() => e.api.dubStatus().step === "capture", 10000);
      else await until(() => e.fetched.length > 0, 20000);
      e.api.dubStop("user");
      await sleep(when === "forcing" ? 9000 : 6000);                       // حتى يفرغ الالتقاطُ ويمضي مؤقّتُه (ثانيتان)
      const t = e.p.getOption("captions", "track") || {};
      res.push({ before, when, back: before === "en" ? t.languageCode === "en" && !t.translationLanguage : !t.languageCode,
        sticky: dataOf(e.local.getItem(e.STICKY)) === st0, track: t.languageCode ? t.languageCode + (t.translationLanguage ? ">" + t.translationLanguage.languageCode : "") : "off" });
    }
    check("⭐ «أوقف الدبلجة» أثناء التقاط المصدر الجديد ⇐ تعود الترجمةُ كما كانت قبل الدبلجة ولاصقتُها بحروفها", res.every((r) => r.back && r.sticky), res);
  }
  {
    // المراجعةُ الثانية لتبديل المصدر (2026-11-02) GG3 — الإنجليزيّةُ قبل الدبلجة · «ترجمة يوتيوب» تُظهر العربيّة · **المستخدمُ يختار الفرنسيّة أو
    // يُطفئ الترجمةَ بيده** · ثمّ «جهازك» ثمّ «أوقف الدبلجة» أثناء الالتقاط ⇐ **يبقى اختيارُه** — ⛔ ~~يعود إلى الإنجليزيّة التي كانت قبل الدبلجة~~
    const res = [];
    for (const pick of ["fr", "off"]) {
      const e = makeEnv({ arTrack: arTrack(40, 2, 2), ourDelay: 3000, ccOn: { languageCode: "en", kind: "asr" } });
      await startRun(e, { source: "yt" });
      e.p.setOption("captions", "track", pick === "fr" ? { languageCode: "fr", kind: "" } : {});      // اختيارُه بيده أثناء الدبلجة
      await sleep(500);
      e.api.dubStart({ source: "device" });
      await until(() => e.api.dubStatus().step === "capture", 10000);
      e.api.dubStop("user");
      await sleep(9000);
      const t = e.p.getOption("captions", "track") || {};
      res.push({ pick, track: t.languageCode ? t.languageCode + (t.translationLanguage ? ">" + t.translationLanguage.languageCode : "") : "off" });
    }
    check("⭐ اختيارُ المستخدم أثناء الدبلجة يبقى له بعد «أوقف الدبلجة» أثناء الالتقاط — لا يعود ما قبل الدبلجة", res.every((r) => r.track === r.pick), res);
  }
  {
    // المراجعةُ الثالثة لتبديل المصدر (2026-11-02) GG4 — «أوقف الدبلجة» و«ترجمة يوتيوب» تُظهر العربيّةَ أوّلَ مرّة (ردُّ المشغّل بطيء)، ثمّ «جهازك»
    // قبل أن يعود الإظهار ⇐ **لا يرث الجديدُ عربيّةَ تشغيلٍ أوقفه المستخدم**: تعود الإنجليزيّةُ ولاصقتُها — ⛔ ~~تبقى العربيّةُ ولاصقتُها «ar» طوالَ
    // دبلجة الجهاز~~
    const SRC = "https://www.youtube.com/api/timedtext?v=VID&lang=en&kind=asr&pot=POT&c=WEB&xorb=2&fmt=json3";
    const e = makeEnv({ arTrack: arTrack(40, 2, 2), ccOn: { languageCode: "en", kind: "asr" },
      playerReq: (t) => (t.translationLanguage ? { url: SRC.replace("&pot=", "&tlang=ar&pot="), status: 200, size: 900, delay: 3000 } : { url: SRC, status: 200, size: 900 }) });
    e.local.setItem(e.STICKY, JSON.stringify({ data: "en", expiration: 1, creation: 1 }));
    const st0 = dataOf(e.local.getItem(e.STICKY));
    e.api.dubStart({ source: "yt" });
    await until(() => e.api.dubStatus().step === "show", 10000);
    await sleep(300);
    e.api.dubStop("user");
    e.api.dubStart({ source: "device" });
    await until(() => e.api.dubStatus().state === "running", 40000);
    await sleep(3000);
    const t = e.p.getOption("captions", "track") || {};
    const got = { state: e.api.dubStatus().state, track: t.languageCode ? t.languageCode + (t.translationLanguage ? ">" + t.translationLanguage.languageCode : "") : "off",
      sticky: dataOf(e.local.getItem(e.STICKY)) === st0 };
    check("⭐ تشغيلٌ أوقفه المستخدمُ وإظهارُه في الطريق لا يُورِث عربيّتَه لما بعده ⇐ تعود الإنجليزيّةُ ولاصقتُها", got.state === "running" && got.track === "en" && got.sticky, got);
    e.api.dubStop("user");
  }
  {
    // المراجعةُ الرابعة لتبديل المصدر (2026-11-02) GG5 — «ترجمة يوتيوب» تُظهر العربيّةَ أوّلَ مرّة (ردُّ المشغّل بطيء) ثمّ «جهازك» قبل أن يعود
    // الإظهار: **(أ) بلا إيقاف** ⇐ يرثها «جهازك» فتبقى العربيّة، ثمّ «أوقف الدبلجة» يُعيد الإنجليزيّة · **(ب) ثمّ «أوقف الدبلجة» ثمّ «جهازك» ثانيةً**
    // ⇐ لا يرثها أحد: تعود الإنجليزيّةُ ولاصقتُها — ⛔ ~~إيقافٌ بين التبديلين لا يقطع الإرث فتبقى العربيّةُ طوالَ دبلجة الجهاز~~
    const SRC = "https://www.youtube.com/api/timedtext?v=VID&lang=en&kind=asr&pot=POT&c=WEB&xorb=2&fmt=json3";
    const trk = (e) => { const t = e.p.getOption("captions", "track") || {}; return t.languageCode ? t.languageCode + (t.translationLanguage ? ">" + t.translationLanguage.languageCode : "") : "off"; };
    const res = [];
    for (const leg of ["switch", "user-stop"]) {
      const e = makeEnv({ arTrack: arTrack(40, 2, 2), ccOn: { languageCode: "en", kind: "asr" },
        playerReq: (t) => (t.translationLanguage ? { url: SRC.replace("&pot=", "&tlang=ar&pot="), status: 200, size: 900, delay: 3000 } : { url: SRC, status: 200, size: 900 }) });
      e.local.setItem(e.STICKY, JSON.stringify({ data: "en", expiration: 1, creation: 1 }));
      const st0 = dataOf(e.local.getItem(e.STICKY));
      e.api.dubStart({ source: "yt" });
      await until(() => e.api.dubStatus().step === "show", 10000);
      await sleep(300);
      e.api.dubStart({ source: "device" });
      if (leg === "user-stop") { await sleep(200); e.api.dubStop("user"); e.api.dubStart({ source: "device" }); }
      await until(() => e.api.dubStatus().state === "running", 40000);
      await sleep(3000);
      const during = trk(e);
      e.api.dubStop("user");
      await sleep(3000);
      res.push({ leg, during, after: trk(e), sticky: dataOf(e.local.getItem(e.STICKY)) === st0 });
    }
    check("⭐ الإرثُ بسلسلة تبديلٍ لم يقطعها إيقاف — بلا إيقافٍ تبقى العربيّة، وبعد إيقافٍ بين التبديلين لا يرثها أحد",
      res[0].during === "en>ar" && res[0].after === "en" && res[0].sticky && res[1].during === "en" && res[1].after === "en" && res[1].sticky, res);
  }
  {
    // المراجعةُ الخامسة لتبديل المصدر (2026-11-02) GG6 — الإنجليزيّةُ ولاصقتُها «en» قبل الدبلجة · «ترجمة يوتيوب» · **المستخدمُ يُطفئ الترجمةَ بيده** ·
    // «جهازك» · «ترجمة يوتيوب» ثانيةً (العربيّةُ غيرُ معروضة فتُظهرها) · «أوقف الدبلجة» ⇐ **تبقى مطفأةً كما اختار، ولغتُه اللاصقةُ «en» كما كانت**
    // — ⛔ ~~«ar»: بدأ السجلُّ الثاني من المفاتيح الحاليّة وفيها ما كتبناه~~
    const e = makeEnv({ arTrack: arTrack(40, 2, 2), ccOn: { languageCode: "en", kind: "asr" } });
    e.local.setItem(e.STICKY, JSON.stringify({ data: "en", expiration: 1, creation: 1 }));
    const st0 = dataOf(e.local.getItem(e.STICKY));
    const s1 = await startRun(e, { source: "yt" });
    e.p.setOption("captions", "track", {});                                   // يُطفئها بيده
    await sleep(500);
    const s2 = await startRun(e, { source: "device" });
    const s3 = await startRun(e, { source: "yt" });
    e.api.dubStop("user");
    await sleep(3000);
    const t = e.p.getOption("captions", "track") || {};
    const got = { states: [s1.state, s2.state, s3.state], after: t.languageCode ? t.languageCode : "off", sticky: dataOf(e.local.getItem(e.STICKY)), st0 };
    check("⭐ تبديلٌ ذهاباً وإياباً بعد إطفاء الترجمة باليد ⇐ تبقى مطفأةً واللغةُ اللاصقةُ كما كانت قبل الدبلجة", got.states.every((x) => x === "running") && got.after === "off" && got.sticky === st0, got);
  }

  console.log("\n[٢١] مراجعةُ الجولة الثالثة — توقيتُ المحرّك: تشغيلُ المستخدم يُحترم · إيقافٌ واحدٌ للجملة · لا انتظارَ بلا مترجم · قفزٌ أثناء الانتظار · استئنافٌ صادق");
  // جملةٌ بعيدةٌ لم يُجلب صوتُها، يُقفز إليها فتحلّ الآن — `slowOf(text)` يبطّئ طلبَ صوتها وحدَه
  const jumpFar = (e, ahead, into) => { const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + ahead && x.ar); e.video.currentTime = u.start / 1000 + (into || 0.3); return u; };
  {
    // #1 — المستخدمُ شغّل الفيديو أثناء انتظارنا وساعةُ كروم تبدأ بعد play() بـ150ms ⇐ ⛔ ~~«متجمّد» ⇐ مزامنة ⇐ نوقفه ثانيةً~~
    let slow = "";
    const e = makeEnv({ events: EV40, playLag: 150, azDelay: (n, text) => (text && text === slow ? 6000 : 40) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 20, 60000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    slow = u.ar;
    e.video.currentTime = u.start / 1000 + 0.3;
    await until(() => e.video.paused && /^wait-/.test(e.api.dubStatus().hold), 8000);
    await sleep(600);
    const p0 = e.video.pauses | 0;
    e.video.play();                                                     // المستخدم
    await sleep(2000);
    check("⭐ تشغيلُ المستخدم أثناء انتظارنا يُحترم ولو تأخّرت ساعةُ كروم — لا إيقافَ بعده لجملته", (e.video.pauses | 0) === p0 && !e.video.paused,
      { before: p0, after: e.video.pauses | 0, paused: e.video.paused });
    e.api.dubStop("user");
  }
  {
    // #2 — قفزٌ إلى جملةٍ لم تُترجم وصوتُها Azure ⇐ ⛔ ~~إيقافٌ للترجمة ثمّ يكمل ثمّ إيقافٌ ثانٍ لصوتها~~ ⇒ إيقافٌ واحد
    const e = makeEnv({ events: EV40, trDelay: 800 });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 10, 60000);
    await sleep(300);
    const p0 = e.video.pauses | 0, n0 = saidAll(e, "az-start").length;
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 40 && x.ar == null);   // لم تُترجم بعد
    e.video.currentTime = u.start / 1000 + 0.3;
    await until(() => saidAll(e, "az-start").length > n0, 15000);
    check("⭐ ترجمةٌ ثمّ صوتٌ للجملة نفسِها ⇐ إيقافٌ واحدٌ للفيديو", (e.video.pauses | 0) - p0 === 1 && u.ar != null, { pauses: (e.video.pauses | 0) - p0, at: u.start });
    e.api.dubStop("user");
  }
  {
    // #3 — لا مترجمَ يبقى (مفتاحُ مترجم Azure مرفوض ولا مترجمَ كروم) ⇐ ⛔ ~~كلُّ جملةٍ توقف الفيديو ثلاثَ ثوانٍ بلا نهاية~~
    const e = makeEnv({ events: EV40, noTranslator: true, trMode: "401" });
    await startRun(e, { source: "azure", engine: "system", az: { trKey: TRK, trRegion: "uaenorth" } });
    const p0 = e.video.pauses | 0;
    await sleep(25000);
    check("⭐ لا مترجمَ يبقى ⇐ لا يُقطَّع الفيديو (إيقافٌ واحدٌ على الأكثر قبل أن يُعرف)، و«tr-off» يُقال", (e.video.pauses | 0) - p0 <= 1 && e.api.dubStatus().hold === "tr-off",
      { pauses: (e.video.pauses | 0) - p0, hold: e.api.dubStatus().hold });
    e.api.dubStop("user");
  }
  {
    // #4 — صوتُ الجملة المنتظَرة ردّ 503 خلال الانتظار ⇐ ⛔ ~~«جاهز» فيكمل الفيديو ثمّ يتوقّف للمحاولة~~ ⇒ إيقافٌ واحدٌ وتُسمع
    let slow = "", tries = 0;
    const e = makeEnv({ events: EV40, azDelay: (n, text) => (text && text === slow && tries === 0 ? 1000 : 40),
      azMode: (n, text) => (text && text === slow && tries++ === 0 ? "503" : "ok") });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 20, 60000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    slow = u.ar;
    const p0 = e.video.pauses | 0;
    e.video.currentTime = u.start / 1000 + 0.3;
    await until(() => saidAll(e, "az-start").some((x) => x.text === slow), 15000);
    check("⭐ 503 أثناء انتظار الصوت ⇐ أُعيد في الانتظار نفسِه: إيقافٌ واحدٌ وسُمعت", (e.video.pauses | 0) - p0 === 1 && saidAll(e, "az-start").some((x) => x.text === slow),
      { pauses: (e.video.pauses | 0) - p0, tries });
    e.api.dubStop("user");
  }
  {
    // #5 — صوتُ الجهاز قُطع وسطَ جملةٍ بإيقاف الفيديو ⇐ ⛔ ~~صمتٌ حتى الجملة التالية~~ ⇒ تُعاد من أوّلها
    const e = makeEnv({ arTrack: arTrack(30, 2, 2, true) });
    await startRun(e, { source: "yt" });
    await until(() => heard2(e).length >= 2 || e.spoken.filter((x) => x.ev === "start" && /الجملة/.test(x.text)).length >= 2, 30000);
    const said = () => e.spoken.filter((x) => x.ev === "start" && /الجملة/.test(x.text));
    const last = said()[said().length - 1];
    const u = e.api.dub.sents.find((x) => x.ar === last.text);
    await until(() => e.video.currentTime >= u.start / 1000 + 2.0, 10000);
    e.video.pause();
    await sleep(1000);
    e.video.play();
    await sleep(1500);
    const again = said().filter((x) => x.text === last.text).length;
    check("⭐ قُطعت جملتُه وسطَها بإيقافٍ قصير ⇐ تُعاد بعد الاستئناف — لا صمتَ حتى التالية", again >= 2, { again, win: u.win });
    e.api.dubStop("user");
  }
  {
    // #7 — جملةٌ قيلت كلُّها ثمّ إيقافٌ قصيرٌ في نافذتها ⇐ ⛔ ~~تُعاد بعد الاستئناف (قاعدةُ الاستئناف)~~ ⇒ لا تُعاد
    const e = makeEnv({ events: EV40 });
    await startRun(e, DEV);
    await until(() => heard(e).length >= 2, 30000);
    const said = heard(e)[heard(e).length - 1];
    await until(() => e.spoken.some((x) => x.ev === "end" && x.text === said.text), 10000);
    const u = e.api.dub.sents.find((x) => x.ar === said.text);
    await until(() => e.video.currentTime >= u.start / 1000 + 1.2, 10000);
    e.video.pause();
    await sleep(800);
    e.video.play();
    await sleep(1500);
    const again = heard(e).filter((x) => x.text === said.text).length;
    check("⭐ قيلت كلُّها ثمّ إيقافٌ قصيرٌ في نافذتها ⇐ لا تُعاد", again === 1 && e.video.currentTime - u.start / 1000 < 1.5 + 0.8 + 1.5 + 0.5, { again, at: e.video.currentTime - u.start / 1000 });
    e.api.dubStop("user");
  }
  {
    // #6 — انتظارُ اللحاق ومقطعُنا يتكلّم، فسحب المستخدمُ الشريط ⇐ ⛔ ~~يكمل المقطعُ القديم في الموضع الجديد حتى المهلة~~ ⇒ يسكت فوراً
    const e = makeEnv({ arTrack: arTrack(60, 2, 2, true), azCps: 4 });
    await startRun(e, { source: "yt", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    const got = await until(() => e.api.dubStatus().hold === "wait-behind", 60000);
    const cur = saidAll(e, "az-start")[saidAll(e, "az-start").length - 1];
    const tS = now();
    e.video.currentTime = e.video.currentTime + 30;
    await sleep(500);
    const stop = e.spoken.find((x) => (x.ev === "az-pause" || x.ev === "az-end") && x.text === cur.text && x.t >= tS);
    check("⭐ قفزٌ أثناء انتظار اللحاق ⇐ يسكت المقطعُ القديم خلال 300ms ويُستأنف من الموضع الجديد", got && !!stop && stop.ev === "az-pause" && stop.t - tS < 300 && !e.video.paused,
      { got, stop: stop && { ev: stop.ev, ms: stop.t - tS }, paused: e.video.paused });
    e.api.dubStop("user");
  }
  {
    // تحقّقُ الجولة V2 — مقطعُ Azure يُجلب (لم يُسمع بعد) فأوقف المستخدمُ الفيديو لحظةً ⇐ ⛔ ~~يضيع صامتاً لا يُعدّ~~ ⇒ يُسمع بعد الاستئناف
    let slow = "";
    const e = makeEnv({ events: EV40, azDelay: (n, text) => (text && text === slow ? 900 : 40) });
    await startRun(e, { source: "device", engine: "azure", wait: false, az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 20, 60000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    slow = u.ar;
    e.video.currentTime = u.start / 1000 + 0.3;
    await sleep(250);
    e.video.pause();
    await sleep(1200);
    e.video.play();
    await until(() => saidAll(e, "az-start").some((x) => x.text === slow), 8000);
    check("⭐ أُسكت مقطعٌ قبل أن يُسمع بإيقافٍ قصير ⇐ يُسمع بعد الاستئناف", saidAll(e, "az-start").some((x) => x.text === slow), { slow, idx: e.api.dub && e.api.dub.idx });
    e.api.dubStop("user");
  }
  {
    // #8 — أُطفئت الإضافة أثناء انتظارنا ⇐ ⛔ ~~يبقى الفيديو موقوفاً بنا~~ ⇒ يكمل
    let slow = "";
    const e = makeEnv({ events: EV40, azDelay: (n, text) => (text && text === slow ? 6000 : 40) });
    await startRun(e, { source: "device", engine: "azure", az: { key: KEYZ, region: "uaenorth" } });
    await until(() => e.video.currentTime > 20, 60000);
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 30 && x.ar);
    slow = u.ar;
    e.video.currentTime = u.start / 1000 + 0.3;
    await until(() => e.video.paused && /^wait-/.test(e.api.dubStatus().hold), 8000);
    e.gate.on = false;
    await until(() => e.api.dubStatus().state === "stopped", 3000);
    check("⭐ إطفاءُ الإضافة أثناء انتظارنا ⇐ توقّفت ويكمل الفيديو", e.api.dubStatus().state === "stopped" && !e.video.paused, { state: e.api.dubStatus().state, paused: e.video.paused });
    e.gate.on = true;
  }
  {
    // #10 — قفزٌ إلى جملةٍ لم تُترجم ودفعةُ مترجم Azure لغيرها في الطريق ⇐ ⛔ ~~لا تُطلب أثناء الانتظار فيبلغ مهلتَه~~ ⇒ تُطلب حين تفرغ الدفعة
    // أوّلُ جملةٍ عند 10 ث (لا انتظارَ عند البدء) · ودفعةُ المترجم 25 مقطعاً ⇐ القفزُ أبعدُ منها
    const EVX = []; for (let i = 0; i < 120; i++) EVX.push({ tStartMs: 10000 + i * 3000, dDurationMs: 2800, segs: [{ utf8: "Sentence number " + (i + 1) + "." }] });
    const e = makeEnv({ events: EVX, trDelay: 1000 });
    await startRun(e, { source: "azure", engine: "system", az: { trKey: TRK, trRegion: "uaenorth" } });
    await until(() => e.api.dub && e.api.dub.trBusy, 5000);            // أوّلُ دفعةٍ في الطريق
    const s0 = e.api.dubStatus().stallS;
    const u = e.api.dub.sents.find((x) => x.start / 1000 > e.video.currentTime + 200);   // لم تُترجم بعد
    e.video.currentTime = u.start / 1000 + 0.3;
    await until(() => !e.api.dub.wait && e.api.dubStatus().stallS > s0, 8000);
    const held = e.api.dubStatus().stallS - s0;
    check("⭐ الترجمةُ المنتظرة تُطلب أثناء الانتظار ⇐ يكمل الفيديو قبل المهلة", held > 0 && held < 2.8 && u.ar != null, { held, translated: u.ar != null });
    e.api.dubStop("user");
  }

  console.log(`\n${fail ? "❌" : "✅"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("  ❌ الحارسُ رمى: " + ((e && e.stack) || e)); console.log(`\n❌ نجح ${pass} / فشل ${fail + 1}\n`); process.exit(1); });

