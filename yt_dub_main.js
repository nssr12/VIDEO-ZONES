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
  var MEM = { stop: null, req: {}, busy: false };   // ذاكرةُ الصفحة لا التخزين: إعادةُ التحميل تنساها
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
      stop: MEM.stop ? MEM.stop.why : "", asked: !!MEM.req[v] };
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
        p.setOption("captions", "track", prevTrack); return "prev";
      }
      if (/"captions"/.test(B0.mods) || (B0.mods === "-" && B0.opt === "{}")) { p.setOption("captions", "track", {}); return "empty"; }
      p.unloadModule("captions"); return "unload";
    } catch (e) { return "threw"; }
  }

  // ── الالتقاط: المراقبُ أوّلاً ثمّ الإجبار، وطلبٌ واحدٌ منّا ──────────────────────────
  async function capture(a) {
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
    try {
      var isSrc = function (x) {
        var q = qs(x.name);
        return q.get("v") === v && (q.get("lang") || "") === a.ql && (q.get("kind") || "") === a.qk && (q.get("variant") || "") === a.qv;
      };
      // ⛔ الرفضُ بشكله: ≥400، أو 200 برؤوسٍ بلا جسم — ولا status=0 (الإلغاءُ يُعطيه)
      var refused = function (x) { return !x.ours && (x.status >= 400 || (x.status === 200 && x.size === 0 && x.xfer > 0)); };
      var answered = function (t) { return seen.some(function (x) { return !x.ours && x.st >= t - 1 && x.status > 0 && !refused(x); }); };
      var B0 = state(p), ccOn = B0.aria === "true", prevTrack;
      try { prevTrack = JSON.parse(B0.opt); } catch (e) { prevTrack = undefined; }
      var B1 = { ls: B0.ls, ss: B0.ss }, how = "", t0 = performance.now(), f0 = null, i;
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
        for (i = 0; i < 15; i++) { try { tl = p.getOption("captions", "tracklist"); } catch (e) { tl = null; } if (Array.isArray(tl) && tl.length) break; await delay(100); }
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
      var fixed = fixAll(B1, state(p), ccOn);
      if (ref) return { ok: false, reason: "breaker", why: MEM.stop.why, act: act };
      if (!cap) return { ok: false, reason: "no-capture", how: how, act: act, cc: ccOn };
      if (isAd(p) || vNow() !== v) return { ok: false, reason: isAd(p) ? "ad" : "nav" };
      // ── طلبُنا الوحيد: معاملاتُ المشغّل بنصّها، وfmt=json3 آخرَها، بلا tlang — وvariant يبقى (الفجوة هـ)
      var qi = cap.name.indexOf("?");
      if (qi < 0) return { ok: false, reason: "bad-url" };
      var kv = cap.name.slice(qi + 1).split("&").filter(function (x) { return x && !/^(tlang|fmt)(=|$)/.test(x); });
      var url = cap.name.slice(0, qi) + "?" + kv.concat("fmt=json3").join("&");
      MEM.req[v] = Date.now();
      var res = { status: 0, body: "" }, ac = new AbortController(), to = setTimeout(function () { ac.abort(); }, 15000);
      try { var r = await fetch(url, { credentials: "include", signal: ac.signal }); res = { status: r.status, body: await r.text() }; }
      catch (e) { res = { status: 0, body: "", err: String(e && e.name) }; }
      finally { clearTimeout(to); }
      var own2 = first(seen, function (x) { return x.name === url; }); if (own2) own2.ours = true;
      var s2 = state(p);
      if (s2.aria !== B0.aria || s2.opt !== B0.opt) act += "+" + restoreAct(p, B0, ccOn, prevTrack);
      fixed = fixed.concat(fixAll(B1, state(p), ccOn));
      setTimeout(function () { fixAll(B1, state(p), ccOn); }, 2000);   // ثالثةً: المشغّلُ قد يكتب متأخّراً
      if (res.err || res.status !== 200 || !res.body.trim()) {
        MEM.stop = { at: Date.now(), why: res.err ? "ours " + res.err : "ours status=" + res.status + (res.body.trim() ? "" : " empty") };
        return { ok: false, reason: "breaker", why: MEM.stop.why, act: act };
      }
      var j = null; try { j = JSON.parse(res.body); } catch (e) { j = null; }
      var evs = j && Array.isArray(j.events) ? j.events : null;
      if (!evs) return { ok: false, reason: "not-json3" };
      var out = [];
      evs.forEach(function (ev) {
        if (!ev || typeof ev.tStartMs !== "number" || !Array.isArray(ev.segs)) return;
        out.push([ev.tStartMs, Number(ev.dDurationMs) || 0, ev.aAppend ? 1 : 0, ev.segs.map(function (g) {
          return [str(g && g.utf8), g && typeof g.tOffsetMs === "number" ? g.tOffsetMs : null];
        })]);
      });
      if (!out.length) return { ok: false, reason: "empty" };
      return { ok: true, v: v, events: out, how: how, act: act, restored: fixed };
    } finally { try { po.disconnect(); } catch (e) { /* مُنفصلٌ سلفاً */ } }
  }

  window.addEventListener("__vz_dub_req__", function (e) {
    var m = null;
    try { m = typeof e.detail === "string" ? JSON.parse(e.detail) : null; } catch (x) { m = null; }
    if (!m || typeof m.id !== "string") return;
    var job = m.op === "ping" ? Promise.resolve({ ok: true })
      : m.op === "facts" ? facts()
      : m.op === "capture" ? capture(m.args)
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
