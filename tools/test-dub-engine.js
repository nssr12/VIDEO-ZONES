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
  const obs = [], fetched = [], calls = [], playerReqs = [], spoken = [];
  const STICKY = "yt-player-caption-sticky-language", PREFS = "yt-player-caption-language-preferences";
  const stickyBefore = JSON.stringify({ data: "ar", expiration: 1, creation: 1 });
  const local = makeStore({ [STICKY]: stickyBefore }), session = makeStore({});
  let track = o.ccOn ? o.ccOn : {}, loaded = !!o.ccOn;
  const emit = (name, status, size, st) => obs.slice().forEach((cb) => cb({ getEntries: () => [{ name, startTime: st, responseStatus: status, encodedBodySize: size, transferSize: size + 300 }] }));
  const request = (r) => { const st = now(); playerReqs.push(r.url); setTimeout(() => emit(r.url, r.status, r.size, st), (r.delay || 50) / K); };
  const BASE = "https://www.youtube.com/api/timedtext?v=VID";
  // الفيديو: زمنُه يجري بالساعة ما لم يتوقّف — والقفزُ يُثبّته حتى ينتهي `seeking`
  const video = { paused: false, playbackRate: 1, seeking: false, _base: 0, _at: now(),
    get currentTime() { return this.paused || this.seeking ? this._base : this._base + (now() - this._at) / 1000 * this.playbackRate; },
    set currentTime(t) { this._base = t; this._at = now(); },
    pause() { this._base = this.currentTime; this.paused = true; }, play() { this._at = now(); this.paused = false; } };
  // الترجمةُ المعروضة: سطورُ الإشارة الجارية متى كانت العربيّةُ معروضة (اختيرت أو عرضناها) — و`rollup` سطرٌ سابقٌ فوقها
  const arOn = () => !!o.alreadyArabic || !!(track && track.translationLanguage && track.translationLanguage.languageCode === "ar");
  const cues = o.cues || [];
  // `windows`: نوافذُ كما يبنيها يوتيوب بـ`lang` — ونافذةُ اسم المسار (lang=en) ثانيتين بعد كلّ اختيار · و`grow` سطرٌ تُلحق به الكلمات
  let labelUntil = -1;
  const lineAt = () => {
    if (!arOn()) return [];
    const t = video.currentTime, k = cues.findIndex((c) => t >= c.t && t < c.t + c.d);
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
    classList: { contains: () => false },
    querySelector: (s) => (s === ".ytp-subtitles-button" ? { getAttribute: () => (o.ccOffByHand ? "false" : track && track.languageCode || o.alreadyArabic ? "true" : "false") } : s === "video" ? video : null),
    getPlayerResponse: () => ({ videoDetails: { videoId: new URLSearchParams(location.search).get("v"), isLive: !!o.live, lengthSeconds: "60" }, playabilityStatus: { status: "OK" },
      captions: { playerCaptionsTracklistRenderer: { captionTracks: o.captionTracks || [{ baseUrl: "/api/timedtext?v=VID&lang=en&kind=asr", languageCode: "en", kind: "asr" }] } } }),
    getCurrentTime: () => video.currentTime,
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
        (track.translationLanguage ? "&tlang=" + track.translationLanguage.languageCode : "") + "&pot=POT&c=WEB&fmt=srv3", status: 200, size: 900 };
      (Array.isArray(rq) ? rq : rq ? [rq] : []).forEach(request);
    }
  };
  const win = makeWindow();
  win.CustomEvent = FakeCustomEvent;
  win.top = win;
  class PO { constructor(cb) { this.cb = cb; } observe() { obs.push(this.cb); } disconnect() { const i = obs.indexOf(this.cb); if (i >= 0) obs.splice(i, 1); } }
  PO.supportedEntryTypes = ["resource"];
  const EV = [];
  for (let i = 0; i < 20; i++) EV.push({ tStartMs: 2000 + i * 3000, dDurationMs: 2800, segs: [{ utf8: "Sentence number " + (i + 1) + "." }] });
  const json3 = JSON.stringify({ events: EV });
  const location = { search: "?v=VID", origin: "https://www.youtube.com", pathname: "/watch", hostname: "www.youtube.com" };
  const document = { hidden: false, querySelector: (s) => (s === "#movie_player" ? p : s === "#movie_player video" ? video : null) };
  const timers = { setTimeout: (f, ms) => setTimeout(f, Math.max(0, (ms || 0) / K)), clearTimeout,
    setInterval: (f, ms) => setInterval(f, Math.max(1, (ms || 0) / K)), clearInterval };
  const mainCtx = Object.assign({
    window: win, document, location, URL, URLSearchParams, JSON, Date, Math, Number, String, Array, Object, Promise,
    localStorage: local, sessionStorage: session, PerformanceObserver: PO, AbortController, CustomEvent: FakeCustomEvent, performance: { now },
    fetch: async (url) => {
      fetched.push(url);
      const st = now();
      await sleep(o.ourDelay || 300);
      const status = o.ourStatus || 200;
      emit(url, status, status === 200 ? 500 : 0, st);
      return { status, text: async () => (status === 200 ? json3 : "") };
    }
  }, timers);
  vm.createContext(mainCtx);
  vm.runInContext(MAIN, mainCtx);

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
  const contentCtx = Object.assign({
    window: win, document, location, URL, URLSearchParams, JSON, Date, Math, Number, String, Array, Object, Promise, Map, atob,
    CustomEvent: FakeCustomEvent, performance: { now }, speechSynthesis, SpeechSynthesisUtterance,
    Translator: { availability: async () => "available", create: async () => ({ translate: async (t) => "ترجمة " + t.replace(/[^0-9]/g, "") }) },
    chrome: { runtime: { id: "x" } },
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
    document, gate, opts: o, maxOurs: () => maxOurs, release: () => { engine.hold = false; pump(); } };
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
    await until(() => heard(e).some((x) => /(11|12)$/.test(x.text)), 12000);
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
    check("العربيّةُ معروضةٌ سلفاً ⇐ لا إجبار", st.state === "running" && !e.calls.some((x) => x.startsWith("set:")), e.calls);
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

  console.log(`\n${fail ? "❌" : "✅"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("  ❌ الحارسُ رمى: " + ((e && e.stack) || e)); console.log(`\n❌ نجح ${pass} / فشل ${fail + 1}\n`); process.exit(1); });

