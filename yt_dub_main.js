// #168 — الدبلجة العربية: **عالمُ الصفحة**. يقرأ مساراتِ الفيديو، ويلتقط نصَّه بتوقيته
// من طلب المشغّل نفسِه **بطلبٍ واحدٍ منّا** (M2+R)، ثمّ يُعيد ما غيّره الإجبار.
// content.js (العالم المعزول) يكلّمه بـ CustomEvent "__vz_dub_req__" ويسمع "__vz_dub_res__".
//
// ⭐ **يُحقن عند الطلب وحدَه:** البوب-أب يحقنه حين يُضغط «دبلِج» — **فلا سطرَ منه يعمل في
// صفحةٍ لم يُطلب فيها**، ولا مكانَ له في المانيفست (فلا يمسّ #38ج: التفعيلُ اليدويّ يحقن
// ما يحقنه المانيفست).
//
// **منقولٌ بمعناه من مِجَسّ 7** (`tools/report-voice-capture.js`) الذي نجح على يوتيوب الحقيقيّ
// (AUDIT §17): `loadModule` ثمّ `setOption(track)` عبر الواجهة لا بنقرة (#156) · المراقبُ حيٌّ قبل
// الإجبار وبلا buffered · **أوّلُ رفضٍ لأيّ طلب timedtext يرفع القاطع** فلا طلبَ بعده في الصفحة ·
// **وطلبٌ واحدٌ منّا لكلّ فيديو** · ولا شيءَ أثناء إعلان.
// ⭐ **M2+R (خ20 — «نعم للاثنين»):** `setOption(track)` يكتب لغتَه «لاصقةً» في تخزين يوتيوب ⇒
// **مفاتيحُ مُعيِّن المسار ومفتاحُ تشغيل CC وحدَها تُعاد بقيمتها قبل الإجبار حرفاً** — ثلاثَ مرّات:
// فورَ الالتقاط، وبعد طلبنا، وبعد ثانيتين. **وما سواها لا يُكتب.**
// ⚠️ **حدٌّ مُعلَن:** من يغيّر لغةَ ترجمته في أيّ تبويب يوتيوب خلال نافذة الالتقاط (ثوانٍ) تُعاد لغتُه
// السابقة، **وذاكرةُ المشغّل في الصفحة نفسِها لم تُقس**.
(function () {
  if (window.__vzDubMain) return;

  var TT = "/api/timedtext";
  // ⭐ نسخةُ البروتوكول — يسألها سكربتُ الإضافة في `ping` (مراجعةُ الجولة الثالثة #9): الحارسُ أعلاه يُبقي نسخةً قديمةً في صفحةٍ
  // فُتحت قبل تحديث الإضافة، فتُجيب هي بلا نسخة ⇒ يُقال «أعد تحميل الصفحة» — ⛔ ~~تعمل القديمةُ صامتةً بلا ما بُني بعدها~~
  var VER = 3;
  // ذاكرةُ الصفحة لا التخزين: إعادةُ التحميل تنساها · `ar`: ملفُّ الترجمة العربيّة كما ردّه المشغّلُ على طلبه (الجولة الثالثة)
  var MEM = { stop: null, req: {}, busy: false, show: null, ar: {} };
  var SETTER = { ls: /sticky-language/i, ss: /language-preferences/i };
  var ONOFF = /caption-persistence|sticky-caption/i;

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function vNow() { return new URLSearchParams(location.search).get("v") || ""; }
  function str(x) { return typeof x === "string" ? x : x == null ? "" : String(x); }
  function qs(u) { try { return new URL(String(u || ""), location.origin).searchParams; } catch (e) { return new URLSearchParams(""); } }
  function first(a, f) { for (var i = 0; i < a.length; i++) if (f(a[i])) return a[i]; return null; }
  function isAd(p) { return !!(p && p.classList && (p.classList.contains("ad-showing") || p.classList.contains("ad-interrupting"))); }
  function player() { return document.querySelector("#movie_player"); }
  // حقلاً أو دالّةً أو getX() — شكلُ كائنات المسار غيرُ موثَّق (مِجَسّ 8)
  function rd(o, k) {
    if (!o || typeof o !== "object") return undefined;
    try {
      var x = o[k]; if (typeof x === "function") x = x.call(o);
      var g = o["get" + k.charAt(0).toUpperCase() + k.slice(1)];
      return x === undefined && typeof g === "function" ? g.call(o) : x;
    } catch (e) { return undefined; }
  }
  function call(p, n) { try { return typeof p[n] === "function" ? p[n]() : undefined; } catch (e) { return undefined; } }

  // ── الحقائق: ما يحتاجه قرارُ المسار في content.js — نصوصٌ لا كائنات ──────────────
  function audioOf(t, cur) {
    var info = rd(t, "languageInfo") || null;
    return { id: str(rd(t, "id")), xtags: str(rd(t, "xtags")), acont: str(rd(t, "acont")),
      li: str(rd(info, "id")) || str(rd(info, "languageCode")), def: rd(info, "isDefault") === true,
      auto: rd(t, "isAutoDubbed") === true || rd(info, "isAutoDubbed") === true, cur: !!cur };
  }
  async function facts() {
    var p = player();
    if (!p || typeof p.getPlayerResponse !== "function") return { ok: false, reason: "no-player" };
    if (isAd(p)) return { ok: false, reason: "ad" };
    var v = vNow(), pr = null, vd = null;
    // بعد تنقّلٍ داخل الصفحة قد يحمل المشغّلُ الفيديو السابق لحظات
    for (var i = 0; i < 30; i++) {
      try { pr = p.getPlayerResponse(); } catch (e) { pr = null; }
      vd = pr && pr.videoDetails;
      if (vd && vd.videoId === v) break;
      await delay(100);
    }
    if (!vd || vd.videoId !== v) return { ok: false, reason: "stale-player" };
    var ps = pr.playabilityStatus ? str(pr.playabilityStatus.status) : "";
    if (ps && ps !== "OK") return { ok: false, reason: "unplayable", status: ps };
    var gc = call(p, "getAudioTrack"), ga = call(p, "getAvailableAudioTracks"), curId = gc ? str(rd(gc, "id")) : "";
    var audio = (Array.isArray(ga) ? ga : []).map(function (t) { return audioOf(t, gc != null && (curId ? str(rd(t, "id")) === curId : t === gc)); });
    if (gc && typeof gc === "object") audio.push(audioOf(gc, true));
    var seenA = {};
    ((pr.streamingData && pr.streamingData.adaptiveFormats) || []).forEach(function (f) {
      var a = f && f.audioTrack;
      if (!a || !/^audio\//.test(str(f.mimeType)) || seenA[a.id]) return;
      seenA[a.id] = 1;
      var xt = "";
      try { var u = f.url || new URLSearchParams(str(f.signatureCipher || f.cipher)).get("url") || ""; xt = u ? new URL(u).searchParams.get("xtags") || "" : ""; } catch (e) { xt = ""; }
      audio.push({ id: str(a.id), xtags: xt, acont: "", li: "", def: a.audioIsDefault === true, auto: a.isAutoDubbed === true, cur: false });
    });
    var ren = (pr.captions && pr.captions.playerCaptionsTracklistRenderer) || null;
    var caps = (ren && Array.isArray(ren.captionTracks) ? ren.captionTracks : []).map(function (t) {
      var q = qs(t.baseUrl);
      return { code: str(t.languageCode), kind: str(t.kind), ql: q.get("lang") || "", qk: q.get("kind") || "",
        variant: q.get("variant") || "", tlang: q.get("tlang") || "" };
    });
    return { ok: true, v: v, live: vd.isLive === true, len: Number(vd.lengthSeconds) || 0, audio: audio, caps: caps,
      stop: MEM.stop ? MEM.stop.why : "", asked: MEM.req[v] ? (MEM.req[v].events ? "cached" : "spent") : "" };
  }

  // ── الحالُ الظاهرة وتخزينُ الترجمة — بالقيمة لا بالطول (مِجَسّ 7) ─────────────────
  function stRead(get) {
    var m = {};
    try { var st = get(); for (var i = 0; i < st.length; i++) { var k = st.key(i); if (k && /caption/i.test(k)) m[k] = st.getItem(k); } }
    catch (e) { m["!"] = String(e && e.name); }
    return m;
  }
  function state(p) {
    var btn = p.querySelector(".ytp-subtitles-button"), opt = "", mods = "-";
    try { var x = p.getOption("captions", "track"); opt = x === undefined ? "undefined" : JSON.stringify(x); } catch (e) { opt = "threw"; }
    try { if (typeof p.getOptions === "function") mods = JSON.stringify(p.getOptions()); } catch (e) { mods = "threw"; }
    return { aria: btn ? str(btn.getAttribute("aria-pressed")) : "none", opt: opt, mods: mods,
      ls: stRead(function () { return localStorage; }), ss: stRead(function () { return sessionStorage; }) };
  }
  function dataOf(x) { try { var o = JSON.parse(x); return o && typeof o === "object" && "data" in o ? JSON.stringify(o.data) : null; } catch (e) { return null; } }
  // مفتاحٌ تغيّرت بياناتُه — وإعادةُ كتابةٍ بالبيانات نفسِها (الطابعُ الزمنيّ وحده) ليست تغيّراً
  function changed(A, B) {
    var ks = Object.keys(A).concat(Object.keys(B)), out = [];
    ks.forEach(function (k) {
      if (out.indexOf(k) >= 0 || A[k] === B[k]) return;
      var soft = A[k] != null && B[k] != null && dataOf(A[k]) !== null && dataOf(A[k]) === dataOf(B[k]);
      if (!soft) out.push(k);
    });
    return out;
  }
  // ⭐ M2+R: يُعاد ما تغيّر عن لقطة ما قبل الإجبار (B1) من مفاتيح المُعيِّن ومفتاح التشغيل وحدَها
  function fixAll(B1, cur, ccOn) {
    var done = [];
    ["ls", "ss"].forEach(function (f) {
      var W = B1[f] || {}, C = cur[f] || {};
      if ("!" in W || "!" in C) return;
      changed(W, C).forEach(function (k) {
        if (ONOFF.test(k) && ccOn && MEM.stop) return;                // تحت القاطع يبقى CC مطفأً عمداً
        if (!SETTER[f].test(k) && !ONOFF.test(k)) return;             // ليس من مفاتيح المُعيِّن: لا يُكتب
        try {
          var st = f === "ss" ? sessionStorage : localStorage;
          if (W[k] == null) st.removeItem(k); else st.setItem(k, W[k]);
          done.push(f + ":" + k);
        } catch (e) { /* يُترك: لا كتابةَ بالقوّة */ }
      });
    });
    return done;
  }
  // ⛔ 📖 كائنُ `getOption("captions","track")` لا يُعاد كما هو: اسمُه فيه « >> Arabic» والمطابقةُ بالاسم عند التعادل ⇒ يقع
  // على أوّل مسارٍ بلغته. يُعاد كائنُ القائمة نفسُه بمعرّفه (`vss_id`) ومعه الترجمةُ التي كانت
  function trackBack(p, prev) {
    var tl = null;
    try { tl = p.getOption("captions", "tracklist", { includeAsr: true }); } catch (e) { tl = null; }
    var o = Array.isArray(tl) ? first(tl, function (x) { return x && prev.vss_id && x.vss_id === prev.vss_id; }) ||
      first(tl, function (x) { return x && x.languageCode === prev.languageCode && (x.kind || "") === (prev.kind || ""); }) : null;
    if (!o) return prev;
    var back = Object.assign({}, o);
    if (prev.translationLanguage) back.translationLanguage = prev.translationLanguage;
    return back;
  }
  // إلى الحال السابقة بالواجهة لا بنقرة (#156)
  function restoreAct(p, B0, ccOn, prevTrack) {
    var s = state(p);
    try {
      if (ccOn && MEM.stop) {
        if (s.aria === B0.aria && s.opt === B0.opt) return "none";
        p.setOption("captions", "track", {}); return "cc-off-breaker";
      }
      if (ccOn) {
        if (!prevTrack || typeof prevTrack !== "object" || !Object.keys(prevTrack).length) return "bad-prev";
        p.setOption("captions", "track", trackBack(p, prevTrack)); return "prev";
      }
      if (/"captions"/.test(B0.mods) || (B0.mods === "-" && B0.opt === "{}")) { p.setOption("captions", "track", {}); return "empty"; }
      p.unloadModule("captions"); return "unload";
    } catch (e) { return "threw"; }
  }

  // ── ملفُّ الترجمة ⇐ أحداثٌ مضغوطة [tStartMs, dDurationMs, aAppend, [[utf8, tOffsetMs|null], …]] ──────────
  // json3 (📐 2026-11-01: صيغةُ المشغّل نفسِه للمصدر وللعربيّة) — وsrv3 احتياطاً بتعبيرٍ لا بـDOMParser: الصفحةُ تفرض Trusted Types
  function toEvents(body, max) {
    var s = str(body).trim(), out = [];
    // سقفُ الحجم للقراءة المسبقة وحدَها (ثلاثةُ ملفّاتٍ في ذاكرة الصفحة) — ⛔ ~~وعلى التقاطنا أيضاً~~: طلبُنا الوحيد لفيديو طويلٍ جدّاً
    // كان يُرفض «not-json3» ولا يُعاد في الصفحة (مراجعةُ الجولة الثالثة #7)
    if (max && s.length > max) return null;
    if (s[0] === "{") {
      var j = null;
      try { j = JSON.parse(s); } catch (e) { return null; }
      var evs = j && Array.isArray(j.events) ? j.events : null;
      if (!evs) return null;
      evs.forEach(function (ev) {
        if (!ev || typeof ev.tStartMs !== "number" || !Array.isArray(ev.segs)) return;
        out.push([ev.tStartMs, Number(ev.dDurationMs) || 0, ev.aAppend ? 1 : 0, ev.segs.map(function (g) {
          return [str(g && g.utf8), g && typeof g.tOffsetMs === "number" ? g.tOffsetMs : null];
        })]);
      });
      return out;
    }
    if (s[0] !== "<") return null;
    var num = function (a, k) { var m = new RegExp("\\b" + k + "=\"(\\d+)\"").exec(a); return m ? Number(m[1]) : null; };
    // الكيانُ بالرقم العشريّ أو الستّ عشريّ — وبنقطة الرمز كاملةً (لا نصفَها) · و`&amp;` آخراً: لا يُفكّ مرّتين
    var cp = function (n) { try { return n >= 0 && n <= 0x10FFFF ? String.fromCodePoint(n) : ""; } catch (e) { return ""; } };
    var dec = function (x) {
      return x.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
        .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return cp(parseInt(h, 16)); }).replace(/&#(\d+);/g, function (_, n) { return cp(Number(n)); })
        .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
    };
    // `<p … />` المغلقُ بنفسه حدثٌ بلا نصّ — ⛔ ~~كان يبتلع التاليَ حتى أوّل `</p>`~~ (بحثُ الجولة الثالثة)
    var re = /<p\b([^>]*?)(?:\/>|>([\s\S]*?)<\/p>)/g, m;
    while ((m = re.exec(s))) {
      var t = num(m[1], "t");
      if (t == null) continue;
      var inner = m[2] || "", segs = [], sm, sre = /<s\b([^>]*)>([\s\S]*?)<\/s>/g;
      while ((sm = sre.exec(inner))) segs.push([dec(sm[2]), num(sm[1], "t")]);
      if (!segs.length) segs.push([dec(inner), null]);
      out.push([t, num(m[1], "d") || 0, /\ba="1"/.test(m[1]) ? 1 : 0, segs]);
    }
    return out;
  }

  // ── الجولة الثالثة: **ملفُّ الترجمة العربيّة كاملاً من ردّ طلب المشغّل نفسِه** — صفرُ طلبٍ منّا ──────────
  // 📐 مقيسٌ في كروم المالك 2026-11-01: المشغّلُ يطلب `/api/timedtext` بـ**XHR** (responseType نصّ) وبـ**json3**،
  // **ومراقبةٌ رُكّبت بعد تحميل الصفحة رأته** · **وإعادةُ ضبط المسار نفسِه تُعيد طلبَه** (فالعربيّةُ المعروضةُ سلفاً تُلتقط) —
  // 📖 ويؤكّده كودُ المشغّل (11a45ffb): يُنشئ XHR وقتَ الطلب ولا يحفظ `open`/`send` (بحثُ الجولة الثالثة).
  // ⛔ **نقرأ ولا نغيّر:** لا طلبَ يُعدَّل ولا ردَّ يُستهلك (مستمعٌ على XHR وحدَه — ⛔ ~~وغلافٌ لـfetch~~: لا استعمالَ مقيساً له، فحُذف
  // أثرُه) · **ولا يُقرأ إلا ردُّ المسار المطلوب نفسِه** (`match`: الفيديو ولغةُ المصدر ونوعُه والعربيّة) **المُرسَلُ بعد تركيب
  // المراقبة** — مسارٌ آخر يطلبه المشغّلُ (لغتُه اللاصقة عربيّةٌ لمصدرٍ آخر) لا يُنطق بدلَ ما يُعرض. **والمراقبةُ مؤقّتة:** تُركَّب قبل
  // `setOption` مباشرةً وتُزال بعده، وتُعاد الدالّتان الأصليّتان ما دامتا دالّتَينا (إضافةٌ غلّفت بعدنا لا يُنزع غلافُها). **ونموذجٌ
  // مقفول** (إضافةٌ جمّدته) يُقال (`locked`) — ⛔ ~~يفشل صامتاً~~ — فيُقرأ ما يظهر بدلَه بسببٍ مكتوب
  function arTap(match) {
    var XP = XMLHttpRequest.prototype, XO = XP.open, XS = XP.send, urls = new WeakMap(), on = true;
    var got = { events: null, via: "", flight: 0, seen: 0, rt: "" };
    var open = function (m, u) { try { urls.set(this, String(u)); } catch (e) { /* عنوانٌ غريب: لا يُقرأ */ } return XO.apply(this, arguments); };
    var send = function () {
      var x = this, u = urls.get(x), mine = !!(on && u && match(u)), ended = false;
      if (mine) {
        got.flight++; got.seen++;
        x.addEventListener("loadend", function () {
          if (ended) return;
          ended = true; got.flight--;
          if (!on || got.events) return;
          try {
            if (x.status !== 200) { got.st = x.status; return; }
            if (x.responseType !== "" && x.responseType !== "text") { got.rt = String(x.responseType); return; }
            var ev = toEvents(x.responseText, 8000000);
            if (ev && ev.length) { got.events = ev; got.via = "xhr"; } else if (ev) got.empty = true;
          } catch (e) { /* لا يُقرأ */ }
        });
      }
      // ⛔ ~~إرسالٌ يرمي يبقى «قيد التنفيذ» أبداً~~ فيطول الانتظارُ خمسَ عشرةَ ثانيةً ويُقال «parse» (مراجعةُ الجولة الثالثة #6)
      try { return XS.apply(this, arguments); }
      catch (e) { if (mine && !ended) { ended = true; got.flight--; got.seen--; } throw e; }
    };
    var locked = false;
    try { XP.open = open; XP.send = send; } catch (e) { locked = true; }
    if (XP.open !== open || XP.send !== send) locked = true;
    return {
      got: got, locked: locked,
      off: function () {
        on = false;
        try { if (XP.open === open) XP.open = XO; if (XP.send === send) XP.send = XS; } catch (e) { /* مقفول: يبقى ممرّاً لا يقرأ */ }
      }
    };
  }
  // المسارُ المطلوب بعينه: الفيديو · لغةُ المصدر ونوعُه **كما في رابط المشغّل** (`ql` · `qk` من `baseUrl` — كما يطابق الالتقاط)
  // · والعربيّةُ ترجمةً (`tlang=ar`) — أو المصدرُ عربيٌّ يدويّ بلا `tlang`
  function arMatch(v, ql, qk) {
    var ar = /^ar\b/.test(str(ql));
    return function (u) {
      var q = qs(u), tl = q.get("tlang") || "";
      if (str(u).indexOf(TT) < 0 || q.get("v") !== v || (q.get("lang") || "") !== ql || (q.get("kind") || "") !== qk) return false;
      return ar ? !tl : /^ar\b/.test(tl);
    };
  }
  function arKeep(k, ev) {
    MEM.ar[k] = { at: Date.now(), events: ev };
    var ks = Object.keys(MEM.ar);
    if (ks.length > 3) delete MEM.ar[ks.sort(function (a, b) { return MEM.ar[a].at - MEM.ar[b].at; })[0]];   // ثلاثةُ مساراتٍ في الذاكرة
  }

  // ── الالتقاط: المراقبُ أوّلاً ثمّ الإجبار، وطلبٌ واحدٌ منّا ──────────────────────────
  // ⭐ **ونصُّ الفيديو يبقى في ذاكرة الصفحة بعد طلبه:** إيقافٌ أثناء الالتقاط أو ضغطةٌ ثانية أو فيديو
  // عُدنا إليه يأخذه من هنا بلا شبكة — فلا يُقال «طُلب من قبل» عن نصٍّ دُفع ثمنُه (مراجعة 2026-11-01 #1 · #10 · #15).
  async function capture(a) {
    var hit = a && a.v ? MEM.req[a.v] : null;
    if (hit && hit.events) return { ok: true, v: a.v, events: hit.events, how: "cached", act: "none", restored: [] };
    if (MEM.busy) return { ok: false, reason: "busy" };
    MEM.busy = true;
    try { return await captureRun(a || {}); } finally { MEM.busy = false; }
  }
  async function captureRun(a) {
    var p = player();
    if (!p || typeof p.loadModule !== "function" || typeof p.setOption !== "function" || typeof p.getOption !== "function") return { ok: false, reason: "no-player" };
    if (MEM.stop) return { ok: false, reason: "breaker", why: MEM.stop.why };
    var v = vNow();
    if (!v || v !== a.v) return { ok: false, reason: "nav" };
    if (MEM.req[v]) return { ok: false, reason: "already" };
    if (isAd(p)) return { ok: false, reason: "ad" };
    if (typeof PerformanceObserver !== "function" || (PerformanceObserver.supportedEntryTypes || []).indexOf("resource") < 0) return { ok: false, reason: "no-observer" };
    var seen = [];
    var po = new PerformanceObserver(function (l) {
      l.getEntries().forEach(function (e) {
        var n = String(e.name);
        if (n.indexOf(TT) >= 0) seen.push({ name: n, st: e.startTime, status: e.responseStatus, size: e.encodedBodySize, xfer: e.transferSize, ours: false });
      });
    });
    po.observe({ type: "resource" });                                 // ⛔ حيٌّ: بلا buffered عمداً
    var forced = false, restored = false, keepPo = false, B0 = null, B1 = null, ccOn = false, prevTrack;
    // ⛔ الرفضُ بشكله: ≥400، أو 200 برؤوسٍ بلا جسم — ولا status=0 (الإلغاءُ يُعطيه)
    var refused = function (x) { return !x.ours && (x.status >= 400 || (x.status === 200 && x.size === 0 && x.xfer > 0)); };
    // رفضٌ وصل بعد القرار (إرجاعُ المسار يطلب) يرفع القاطعَ لما بعده — ولا يُبطل نصّاً جُلب (مراجعة #2)
    var lateCheck = function () {
      if (MEM.stop) return;
      var late = first(seen, refused);
      if (late) MEM.stop = { at: Date.now(), why: (qs(late.name).get("lang") || "?") + " status=" + late.status + " late" };
    };
    try {
      // ⭐ يُقبل ما طلبه المشغّلُ فعلاً بلغة المصدر ونوعه، وvariant ما لم يكن نصَّ دبلجةٍ آليّة (الفجوة هـ):
      // اختيارُ كائن tracklist لا يرى variant، فاشتراطُ تطابقه كان يرفض طلباً صحيحاً (مراجعة #3 · #16)
      var isSrc = function (x) {
        var q = qs(x.name);
        return q.get("v") === v && (q.get("lang") || "") === a.ql && (q.get("kind") || "") === a.qk && (q.get("variant") || "") !== "timing-optimized";
      };
      var answered = function (t) { return seen.some(function (x) { return !x.ours && x.st >= t - 1 && x.status > 0 && !refused(x); }); };
      B0 = state(p); ccOn = B0.aria === "true";
      try { prevTrack = JSON.parse(B0.opt); } catch (e) { prevTrack = undefined; }
      B1 = { ls: B0.ls, ss: B0.ss };
      var how = "", t0 = performance.now(), f0 = null, i;
      forced = true;                                                  // من هنا يُعاد ما غيّره الإجبار ولو رمى ما بعده (مراجعة #4)
      p.loadModule("captions");
      // ⛔ أوّلُ طلبٍ للوحدة يُنتظر قبل أيّ setOption: رفضُه يُرى قبل طلبٍ ثانٍ
      for (i = 0; i < 30 && !f0; i++) { await delay(100); f0 = first(seen, function (x) { return !x.ours && x.st >= t0 - 1; }); }
      var own = !!f0 && isSrc(f0) && f0.status > 0 && !refused(f0);
      var s0 = !!f0 && isSrc(f0) && !(f0.status > 0);
      if (s0) for (i = 0; i < 15 && !answered(t0) && !seen.some(refused); i++) await delay(100);
      var reissued = s0 && seen.some(function (x) { return !x.ours && x.st >= t0 - 1 && isSrc(x) && x.status > 0 && !refused(x); });
      if (seen.some(refused)) how = "refused-before-set";
      else if (own || reissued) how = "module";
      else if (s0 && !answered(t0)) how = "module-unanswered";       // لا setOption: المهلةُ تحكم بالقاطع
      else {
        var tl = null;
        for (i = 0; i < 15; i++) { try { tl = p.getOption("captions", "tracklist", { includeAsr: true }); } catch (e) { tl = null; } if (Array.isArray(tl) && tl.length) break; await delay(100); }
        var o = Array.isArray(tl) ? first(tl, function (x) { return x && x.languageCode === a.code && (x.kind === "asr") === !!a.asr; }) : null;
        how = o ? "set-tracklist" : "set-code";
        p.setOption("captions", "track", o || { languageCode: a.code });
      }
      // المكتملُ أوّلاً، وstatus=0 للمصدر عند المهلة وحدَها · وأيُّ رفضٍ يُنهي الانتظار
      var cap = null, until = performance.now() + 5000;
      for (;;) {
        var m = seen.filter(function (x) { return !x.ours && x.st >= t0 - 1 && isSrc(x); });
        cap = first(m, function (x) { return x.status > 0; }) || (performance.now() >= until ? m[0] || null : null);
        if (cap || performance.now() >= until || seen.some(refused)) break;
        await delay(100);
      }
      var ref = first(seen, refused) || (cap && !(cap.status > 0) ? cap : null);
      if (ref) MEM.stop = { at: Date.now(), why: (qs(ref.name).get("lang") || "?") + " status=" + ref.status };
      var act = restoreAct(p, B0, ccOn, prevTrack);                   // ⭐ فورَ الالتقاط: أقصرُ ظهورٍ مؤقّت
      restored = true;
      var fixed = fixAll(B1, state(p), ccOn);
      if (ref) return { ok: false, reason: "breaker", why: MEM.stop.why, act: act };
      if (!cap) return { ok: false, reason: "no-capture", how: how, act: act, cc: ccOn };
      if (isAd(p) || vNow() !== v) return { ok: false, reason: isAd(p) ? "ad" : "nav" };
      // ── طلبُنا الوحيد: معاملاتُ المشغّل بنصّها، وfmt=json3 آخرَها، بلا tlang — وvariant يبقى (الفجوة هـ)
      var qi = cap.name.indexOf("?");
      if (qi < 0) return { ok: false, reason: "bad-url" };
      var kv = cap.name.slice(qi + 1).split("&").filter(function (x) { return x && !/^(tlang|fmt)(=|$)/.test(x); });
      var url = cap.name.slice(0, qi) + "?" + kv.concat("fmt=json3").join("&");
      MEM.req[v] = { at: Date.now(), events: null };                  // ⛔ قبل الطلب: لا ثانٍ لهذا الفيديو في الصفحة
      var res = { status: 0, body: "" }, ac = new AbortController(), to = setTimeout(function () { ac.abort(); }, 15000);
      try { var r = await fetch(url, { credentials: "include", signal: ac.signal }); res = { status: r.status, body: await r.text() }; }
      catch (e) { res = { status: 0, body: "", err: String(e && e.name) }; }
      finally { clearTimeout(to); }
      var own2 = first(seen, function (x) { return x.name === url; }); if (own2) own2.ours = true;
      // ⛔ رفضُنا أوّلاً: يرفع القاطعَ قبل أيّ إرجاعٍ ثانٍ قد يطلب (مراجعة #2)
      var bad = !!res.err || res.status !== 200 || !res.body.trim();
      if (bad) MEM.stop = { at: Date.now(), why: res.err ? "ours " + res.err : "ours status=" + res.status + (res.body.trim() ? "" : " empty") };
      var s2 = state(p);
      if (s2.aria !== B0.aria || s2.opt !== B0.opt) act += "+" + restoreAct(p, B0, ccOn, prevTrack);
      fixed = fixed.concat(fixAll(B1, state(p), ccOn));
      keepPo = true;                                                   // المراقبُ يبقى ثانيتين: رفضٌ يكتمل بعد الردّ يُرى
      setTimeout(function () { fixAll(B1, state(p), ccOn); lateCheck(); try { po.disconnect(); } catch (e) { /* مُنفصلٌ سلفاً */ } }, 2000);
      if (bad) return { ok: false, reason: "breaker", why: MEM.stop.why, act: act };
      var out = res.body.trim()[0] === "{" ? toEvents(res.body) : null;
      if (!out) return { ok: false, reason: "not-json3" };
      if (!out.length) return { ok: false, reason: "empty" };
      lateCheck();
      MEM.req[v].events = out;
      return { ok: true, v: v, events: out, how: how, act: act, restored: fixed };
    } finally {
      // ⛔ رميةٌ بعد الإجبار لا تترك لغةَ الترجمة مكتوبةً ولا الوحدةَ محمَّلة (مراجعة #4)
      if (forced && !restored) {
        restoreAct(p, B0, ccOn, prevTrack);
        fixAll(B1, state(p), ccOn);
        setTimeout(function () { fixAll(B1, state(p), ccOn); }, 2000);
      }
      if (!keepPo) { try { po.disconnect(); } catch (e) { /* مُنفصلٌ سلفاً */ } }
    }
  }

  // ── «ترجمة يوتيوب كما تظهر» (طلبُ المالك 2026-11-01) — **صفرُ طلبٍ منّا:** المشغّلُ نفسُه يطلب الترجمةَ العربيّة
  // التلقائيّة كما يطلبها حين يختارها المستخدم من ⚙، والمحرّكُ يقرأ ما يُعرض. ⛔ **ولا نجلب ملفَّ الترجمة بأنفسنا:**
  // `tlang` يُرفض حين يطلبه غيرُ المشغّل (📄 yt-dlp #13831). **وما غيّرناه يُعاد عند الإيقاف** (CC والمفاتيحُ اللاصقة — خ20).
  // ⭐ عرضٌ واحدٌ في الصفحة (مراجعةُ الجولة الثالثة #5) — ⛔ ~~عرضان متداخلان~~ يُزيلان مراقبتَيهما بغير ترتيب تركيبهما فتبقى دالّتُنا
  // الأولى على نموذج XHR إلى أن تُغلق الصفحة · **و`a.dl` مهلةُ الطالب:** عرضٌ تجاوزها (مؤقّتاتُ تبويبٍ مخفيٍّ تُبطَّأ) تخلّى عنه الطالبُ
  // ⇐ يتراجع عمّا فعل ويقول «late» — ⛔ ~~ترجمةٌ معروضةٌ لا يُخفيها أحد~~
  async function show(a) {
    if (MEM.showing) return { ok: false, reason: "busy" };
    MEM.showing = true;
    try { return await showRun(a || {}); } finally { MEM.showing = false; }
  }
  async function showRun(a) {
    var p = player(), tIn = performance.now();
    if (!p || typeof p.setOption !== "function" || typeof p.getOption !== "function" || typeof p.loadModule !== "function") return { ok: false, reason: "no-player" };
    if (vNow() !== a.v) return { ok: false, reason: "nav" };
    if (isAd(p)) return { ok: false, reason: "ad" };
    var cur = null;
    try { cur = p.getOption("captions", "track"); } catch (e) { cur = null; }
    var tl0 = cur && cur.translationLanguage ? String(cur.translationLanguage.languageCode || "") : "";
    var B0 = state(p);
    // 📖 `tracklist` بلا `{includeAsr:true}` يعيد اليدويّةَ وحدَها، و`setOption(track)` يطابق `languageCode` ويُهمل `kind`
    // (اليدويّةُ قبل التلقائيّة) ⇒ كائنُ القائمة نفسُه يُمرَّر ما وُجد، وإلا اللغةُ وحدَها
    // العربيّةُ معروضةٌ سلفاً (اختارها المستخدم) ⇐ لا شيءَ يُعاد عند الإيقاف — **وملفُّها يُلتقط بإعادة ضبط المسار نفسِه** (📐
    // يُعيد المشغّلُ طلبَه) ثمّ تُعاد المفاتيحُ إلى ما كانت؛ **وإن كان في الذاكرة فلا نلمس شيئاً**
    var already = B0.aria === "true" && (tl0.split("-")[0] === "ar" || (!tl0 && String((cur && cur.languageCode) || "").split("-")[0] === "ar"));
    // المسارُ الذي يُلتقط ملفُّه: المعروضُ سلفاً إن كانت العربيّةُ معروضة (ما يراه المستخدم هو ما يُنطق)، وإلا مصدرُنا
    var ql = already ? str(cur && cur.languageCode) : str(a.ql || a.code), qk = already ? (cur && cur.kind === "asr" ? "asr" : "") : (a.qk != null ? str(a.qk) : a.asr ? "asr" : "");
    var mkey = a.v + "|" + ql + "|" + qk, match = arMatch(a.v, ql, qk), hit = MEM.ar[mkey] || null;
    if (already && hit) { MEM.show = { v: a.v, set: false }; return { ok: true, how: "already", events: hit.events, via: "cached" }; }
    // ⛔ القاطعُ لا يُجبر بعده أحداً — ⭐ **إلا أنّ العربيّة المعروضة سلفاً تُقرأ كما تظهر بلا طلب** (⛔ ~~«رفض يوتيوب» وهي على الشاشة~~)
    if (MEM.stop) {
      if (!already) return { ok: false, reason: "breaker", why: MEM.stop.why };
      MEM.show = { v: a.v, set: false };
      return { ok: true, how: "already", events: null, via: "", why: "breaker" };
    }
    var ccOn = B0.aria === "true", prevTrack;
    try { prevTrack = JSON.parse(B0.opt); } catch (e) { prevTrack = undefined; }
    var seen = [], po = null;
    if (typeof PerformanceObserver === "function") {
      po = new PerformanceObserver(function (l) {
        l.getEntries().forEach(function (e) {
          var n = String(e.name);
          if (n.indexOf(TT) >= 0) seen.push({ name: n, status: e.responseStatus, size: e.encodedBodySize, xfer: e.transferSize, it: str(e.initiatorType), at: performance.now() });
        });
      });
      try { po.observe({ type: "resource" }); } catch (e) { po = null; }
    }
    var B1 = { ls: B0.ls, ss: B0.ss };
    MEM.show = already ? { v: a.v, set: false } : { v: a.v, set: true, B0: B0, B1: B1, ccOn: ccOn, prevTrack: prevTrack };
    var tap = null, how = "already", target = null, A1 = null, refused = 0;
    try {
      if (already) target = trackBack(p, cur);
      else {
        p.loadModule("captions");
        var tl = null, i;
        for (i = 0; i < 15; i++) { try { tl = p.getOption("captions", "tracklist", { includeAsr: true }); } catch (e) { tl = null; } if (Array.isArray(tl) && tl.length) break; await delay(100); }
        var o = Array.isArray(tl) ? first(tl, function (x) { return x && x.languageCode === a.code && (x.kind === "asr") === !!a.asr; }) : null;
        target = Object.assign({}, o || { languageCode: a.code, kind: a.asr ? "asr" : "" });
        // كائنُ العربيّة من قائمة لغات الترجمة نفسِها إن وُجد (📖 يُخزَّن كما مُرِّر ولا يُطابَق بها)
        var tls = null;
        try { tls = p.getOption("captions", "translationLanguages"); } catch (e) { tls = null; }
        var arT = Array.isArray(tls) ? first(tls, function (x) { return x && String(x.languageCode || "").split("-")[0] === "ar"; }) : null;
        if (String(a.code).split("-")[0] !== "ar") target.translationLanguage = arT ? { languageCode: arT.languageCode, languageName: arT.languageName } : { languageCode: "ar", languageName: "العربية" };
        how = o ? "set-tracklist" : "set-code";
      }
      // ⭐ المراقبةُ قبل `setOption` مباشرةً (بعد تحميل الوحدة): لا يُقرأ طلبٌ أرسله المشغّلُ قبلنا لمسارٍ آخر (بحثُ الجولة الثالثة #1)
      if (!hit) tap = arTap(match);
      p.setOption("captions", "track", target);
      if (already) A1 = state(p);                                    // ما كتبه ضبطُنا للمسار نفسِه — تُعاد إليه المفاتيحُ وحدَها (#3)
      // ⭐ ما كتبه المشغّلُ بإجبارنا (📖 يكتب المفاتيحَ في النداء نفسِه) — فالإيقافُ يُعيد ما بقي على كتابتنا وحدَه (مراجعة 2 #2)
      if (!already) { MEM.show.A = state(p); MEM.show.ar = !!target.translationLanguage || String(a.code).split("-")[0] === "ar"; }
      // ⛔ ورفضُ طلب المشغّل نفسِه يرفع القاطع: الاتصالُ مرفوضٌ فلا نُجبر بعده (§٣) · والانتظارُ حتى يكتمل طلبُه ويُقرأ ردُّه: خمسُ
      // ثوانٍ، **وما دام طلبٌ مطابقٌ قيد التنفيذ فحتى خمسَ عشرة** (شبكةٌ بطيئة لا تُسقط الملفّ — بحثُ الجولة الثالثة #3)
      var t0 = performance.now();
      for (;;) {
        await delay(100);
        var bad = first(seen, function (x) { return x.status >= 400 || (x.status === 200 && x.size === 0 && x.xfer > 0); });
        if (bad) {
          MEM.stop = { at: Date.now(), why: "show status=" + bad.status };
          // ⭐ العربيّةُ معروضةٌ سلفاً ⇐ القاطعُ يرتفع (لا طلبَ بعده) والدبلجةُ تقرأ ما يظهر، والمفاتيحُ تُعاد — ⛔ ~~رفضٌ وما أعدنا ضبطَه
          // يبقى بطوابعنا~~ (مراجعةُ الجولة الثالثة #2)
          if (already) { refused = bad.status || -1; break; }
          hide(); return { ok: false, reason: "breaker", why: MEM.stop.why };
        }
        var done = first(seen, function (x) { return x.status > 0 && match(x.name); });
        var live = tap && !tap.locked;
        if (live ? tap.got.events : done) break;                       // التُقط — أو لا التقاطَ ممكنٌ واكتمل طلبُ العرض
        if (done && (!live || tap.got.flight === 0) && performance.now() - done.at > 500) break;
        if (performance.now() - t0 > (live && tap.got.flight > 0 ? 15000 : 5000)) break;
      }
    } catch (e) {
      // العربيّةُ المعروضةُ سلفاً لا تُرفض لرميةٍ في إعادة ضبطها: يُقرأ ما يُعرض كما كان (لا ملفَّ مسبق)
      if (!already) { hide(); return { ok: false, reason: "threw", err: String((e && e.message) || e).slice(0, 120) }; }
    } finally {
      if (tap) tap.off();
      if (po) { try { po.disconnect(); } catch (e) { /* مُنفصلٌ سلفاً */ } }
    }
    // العربيّةُ اختيارُ المستخدم وإعادةُ ضبطنا المسارَ نفسَه كتبت مفاتيحَه بطوابعَ جديدة ⇒ تُعاد **حرفاً** لا بالبيانات: لا يبقى منّا
    // أثرٌ ولا طابع (بحثُ الجولة الثالثة #6) — الآن وبعد ثانيتين (المشغّلُ يكتب ثانيةً أحياناً، 📐)
    if (already) { exactBack(B1, A1); setTimeout(function () { exactBack(B1, A1); }, 2000); }
    if (a.dl && performance.now() - tIn > a.dl) { if (!already) hide(); return { ok: false, reason: "late" }; }
    var ev = tap ? tap.got.events : hit ? hit.events : null;
    if (tap && ev) arKeep(mkey, ev);
    // ولماذا لم يُلتقط — يُقال في البوب-أب بدلَ أن يُقرأ ما يظهر بلا سبب: إضافةٌ قفلت XHR · ردٌّ بغير نصّ · ردٌّ لا يُفهم ·
    // طلبٌ لم يمرّ بنا (بنوعه من المراقب) · أو لا طلبَ أصلاً
    var sawIt = first(seen, function (x) { return match(x.name); });
    var g = tap ? tap.got : null;
    var why = ev ? "" : refused ? "refused:" + refused : !tap ? "" : tap.locked ? "locked" : g.rt ? "unreadable:" + g.rt : g.st != null ? "status:" + g.st :
      g.empty ? "empty" : g.flight > 0 ? "slow" : g.seen ? "parse" : sawIt ? "unhooked:" + (sawIt.it || "?") : "no-request";
    return { ok: true, how: how, events: ev || null, via: tap ? tap.got.via : hit ? "cached" : "", why: why };
  }

  // مفاتيحُ المُعيِّن ومفتاحُ التشغيل إلى قيمها في اللقطة **حرفاً** — لِما لم يتغيّر فيه شيءٌ إلا بنا (العربيّةُ معروضةٌ سلفاً).
  // ⭐ `A` لقطةُ ما بعد ضبطنا: **يُعاد المفتاحُ ما دام بياناتُه ما كتبه ضبطُنا** (أو مثلُها بطابعٍ أحدث — 📐 يكتب المشغّلُ ثانيةً بعد
  // ثانيتين) — ⛔ ~~يُعاد كلُّ ما اختلف~~: من أطفأ الترجمةَ أو بدّل لغتَها أثناء الانتظار كان يُطمس اختيارُه (مراجعةُ الجولة الثالثة #3)
  function dataOf(raw) {
    if (raw == null) return "\u0000";
    try { var o = JSON.parse(raw); return o && typeof o === "object" && "data" in o ? JSON.stringify(o.data) : String(raw); } catch (e) { return String(raw); }
  }
  function exactBack(B, A) {
    ["ls", "ss"].forEach(function (f) {
      var W = B[f] || {}, P = (A && A[f]) || {}, C = stRead(function () { return f === "ss" ? sessionStorage : localStorage; });
      if ("!" in W || "!" in C || "!" in P) return;
      Object.keys(W).concat(Object.keys(C)).forEach(function (k) {
        if (W[k] === C[k] || (!SETTER[f].test(k) && !ONOFF.test(k))) return;
        if (A && dataOf(C[k]) !== dataOf(P[k])) return;
        try { var st = f === "ss" ? sessionStorage : localStorage; if (W[k] == null) st.removeItem(k); else st.setItem(k, W[k]); } catch (e) { /* يُترك */ }
      });
    });
  }
  // ⭐ يُعاد ما غيّره «العرض» **وما زال على حاله منذ غيّره** (مراجعة 2 #2): CC إلى حاله بالواجهة لا بنقرة (#156) إن كان
  // المشغّلُ ما زال يعرض عربيّتنا — ومن اختار بيده لغةً أو أطفأ الترجمةَ أثناء الدبلجة لا يُطمس اختيارُه — والمفاتيحُ التي ما زالت
  // بما كتبه الإجبارُ وحدَها تُعاد إلى ما كانت حرفاً؛ ما غيّره المستخدمُ بعدنا (في هذا التبويب أو غيره) يبقى
  function stillOurs(p, s) {
    var t = null;
    try { t = p.getOption("captions", "track"); } catch (e) { t = null; }
    var btn = p.querySelector(".ytp-subtitles-button");
    var lang = t ? String((t.translationLanguage && t.translationLanguage.languageCode) || (s.ar && !t.translationLanguage ? t.languageCode : "") || "") : "";
    return !!btn && btn.getAttribute("aria-pressed") === "true" && lang.split("-")[0] === "ar";
  }
  function fixOurs(s, p) {
    if (!s.A) return fixAll(s.B1, state(p), s.ccOn);
    var cur = state(p), keep = { ls: {}, ss: {} };
    ["ls", "ss"].forEach(function (f) { changed(s.A[f] || {}, cur[f] || {}).forEach(function (k) { keep[f][k] = 1; }); });
    // ما تغيّر عن لقطة ما بعد الإجبار (A) غيّره غيرُنا ⇒ يُستثنى: اللقطةُ «الحاليّة» نفسُها تُعطى له فلا يرى fixAll فرقاً
    var B1 = { ls: Object.assign({}, s.B1.ls), ss: Object.assign({}, s.B1.ss) };
    ["ls", "ss"].forEach(function (f) { Object.keys(keep[f]).forEach(function (k) { if ((cur[f] || {})[k] == null) delete B1[f][k]; else B1[f][k] = cur[f][k]; }); });
    return fixAll(B1, cur, s.ccOn);
  }
  function hide() {
    var s = MEM.show, p = player();
    MEM.show = null;
    if (!s || !s.set || !p) return { ok: true, how: "none" };
    var act = stillOurs(p, s) ? restoreAct(p, s.B0, s.ccOn, s.prevTrack) : "user-took-over";
    var fixed = fixOurs(s, p);
    setTimeout(function () { fixOurs(s, p); }, 2000);
    return { ok: true, how: act, restored: fixed };
  }
  // ⛔ تبويبٌ يُغلق أو يُعاد تحميلُه والدبلجةُ تعرض لا يترك «CC مضاء بالعربيّة» ثلاثين يوماً (مراجعة 2 #1): المفاتيحُ تُعاد
  // متزامنةً (التخزينُ متزامن)، والمشغّلُ يذهب مع الصفحة — ولا يُفرَّغ MEM.show: صفحةٌ تعود من ذاكرة التنقّل تُعيد المشغّلَ عند الإيقاف
  window.addEventListener("pagehide", function () {
    var s = MEM.show, p = player();
    if (s && s.set && p) { try { fixOurs(s, p); } catch (e) { /* الصفحةُ تُغادر */ } }
  });

  // ⭐ ساعةُ المشغّل وساعةُ العنصر معاً، في مهمّةٍ واحدة — إعلانٌ مُدمَجٌ في الخادم يجعل زمنَ العنصر يسبق
  // زمنَ المحتوى بطوله، فالفرقُ يُطرح (مراجعة #6). **متزامنٌ عمداً:** يُجاب قبل أن تعود dispatchEvent.
  function clock() {
    var p = player(), vv = p && p.querySelector("video");
    if (!p || !vv || typeof p.getCurrentTime !== "function") return { ok: false, reason: "no-player" };
    var pt = NaN;
    try { pt = Number(p.getCurrentTime()); } catch (e) { pt = NaN; }
    var t = null;
    try { t = p.getOption("captions", "track"); } catch (e) { t = null; }
    var tr = t ? String((t.translationLanguage && t.translationLanguage.languageCode) || t.languageCode || "") : "";
    return { ok: Number.isFinite(pt), pt: pt, vt: vv.currentTime, ad: isAd(p), tr: tr };
  }

  window.addEventListener("__vz_dub_req__", function (e) {
    var m = null;
    try { m = typeof e.detail === "string" ? JSON.parse(e.detail) : null; } catch (x) { m = null; }
    if (!m || typeof m.id !== "string") return;
    if (m.op === "time") {
      var t = clock(); t.id = m.id;
      window.dispatchEvent(new CustomEvent("__vz_dub_res__", { detail: JSON.stringify(t) }));
      return;
    }
    var job = m.op === "ping" ? Promise.resolve({ ok: true, ver: VER })
      : m.op === "facts" ? facts()
      : m.op === "capture" ? capture(m.args)
      : m.op === "show" ? show(m.args || {})
      : m.op === "hide" ? Promise.resolve(hide())
      : Promise.resolve({ ok: false, reason: "bad-op" });
    job.then(null, function (err) { return { ok: false, reason: "threw", err: String((err && err.message) || err).slice(0, 120) }; })
      .then(function (r) {
        r.id = m.id;
        window.dispatchEvent(new CustomEvent("__vz_dub_res__", { detail: JSON.stringify(r) }));
      });
  });

  // آخر سطر عمداً (#38ج): العلم يصف مستمعاً مسجَّلاً بالفعل لا نيّةً أُطلقت.
  window.__vzDubMain = true;
})();
