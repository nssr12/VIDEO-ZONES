// مِجَسّ 168أ-11 — **ماذا يحدث لزمن الفيديو وعنصره أثناء الإعلان والتنقّل ومعاينة التحويم والبثّ المباشر؟** يُلصق في كونسول أيّ صفحةٍ من www.youtube.com، والسياقُ top (عالمُ الصفحة).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن قطع إعلانٌ الفيديو، أو انتقلتُ إلى فيديو آخر، أو حوّمتُ على
// مصغّرة، أو شاهدتُ بثّاً مباشراً — أتعرف الدبلجةُ أين هي من الكلام، أم تتكلّم فوق الإعلان أو تُكمل جملَ
// الفيديو السابق؟»*
//
// ── لماذا يُسجَّل قبل أيّ بناء (AUDIT القسم السابع عشر §٢ · §٣ «المُجدوِل» · §٨ · صفُّ 11 في §٦) ───────
// المُجدوِلُ (168هـ) يسأل في كلّ نبضة «إعلان؟ · قفزةٌ أكبرُ من ثانية؟» ويستأنف بعد الإعلان «من أوّل جملةٍ تبدأ عند
// الزمن الحاليّ»، ويتحقّق أن videoId في ردّ المشغّل هو v في الرابط · وبوّابةُ الميزة لكلّ فيديو لا لكلّ صفحة (قرار 64)
// فتسكت في المعاينة والمصغّر. ⇒ **وكلُّها تفترض ما لم يُقس:** أيلعب الإعلانُ في العنصر نفسِه؟ أيُصفَّر زمنُه؟ **أيبقى
// زمنُ العنصر زمنَ المحتوى بعده؟** — فيُقرأ getCurrentTime() للمشغّل بجانبه، وعالمُ الإضافة لا يرى دوالَّه · كم يتأخّر المشغّلُ
// عن الرابط بعد التنقّل؟ أعنصرُ المعاينة غيرُ عنصر المشغّل؟ ⇒ **مُسجِّلٌ يقرأ ولا يفعل.** **والقفزةُ أثرٌ له أسبابٌ
// (إعلان · تنقّل · بحثُك)** ⇒ تُسجَّل علاماتُ يوتيوب بجانبها فتُنسب ولا تُخمَّن (روحُ قرار 48: الأثرُ لا يقول من فعل).
//
// ── ⛔ الشاهدان — ولا حكمَ بدونهما (قرار 26 · قرار 150) ──────────────────────────────────────────
//  · **سالب:** أوّلُ 10 ثوانٍ بلا تنقّل ⇒ **صفرُ تنقّلٍ مسجَّل** (حدثاً أو تغيّرَ رابط)، وإلا ⛔ ويقف وحده.
//  · **موجب:** تنقّلُك بعدها بالنقر ⇒ **تنقّلٌ واحدٌ على الأقلّ**، وإلا ⚪ «لم يقع تنقّل».
//  · **ورابطٌ تغيّر بلا yt-navigate-finish خلال ±3 ث ⇒ ❌** — فالحدثُ الذي يبني عليه المنتَجُ لا يُطلَق دائماً.
//  · **ومُعرِّفُ العنصر يُسأل عن عنصرين مصنوعين قبل أن يُصدَّق «العنصرُ نفسُه»** (كمرشِّح مِجَسّ 2) · **وزمنُ
//    العنصر في السكون يُطبع تقدّمُه بالساعة** — فـ«لم يتغيّر» من قارئٍ ميّتٍ لا يُقرأ «لم يُصفَّر».
//  · ⛔ **الإعلانُ والمعاينةُ والمصغّرُ والبثّ ⚪ ما لم تُرَ — لا ✅ بغيابها** (Premium مثلاً لا إعلانَ فيه).
//
// ── ⚠️ حدودٌ مُعلَنة ──────────────────────────────────────────────────────────────────────────────
//  · **قرار 96:** النبضةُ 250ms (و50ms خمسَ ثوانٍ بعد كلّ حدث تنقّل) · 10 ث سكون · سقفُ 15 دقيقة · ±3 ث لمطابقة الحدث ·
//    «قفزة» 1.5 ث · «يُصفَّر» ثانية · «يعود» 3 ث · 400 صفّ — **اختياراتٌ لا قياس.**
//  · **الإعلانُ = صنفا ad-showing وad-interrupting على #movie_player** — العلامةُ نفسُها في yt_quality_main.js ⇒ إعلانٌ
//    لا يضعهما لا يراه المِجَسُّ ولا المنتَج. **و«منتصف» أم «قبل» يُصنَّف بالرابط وآخرِ حدث تنقّل، لا بيوتيوب.**
//  · **دوالُّ المشغّل تُركَّب على العنصر في عالم الصفحة، وعالمُ الإضافة يراه بلا دوالّه** (📐 AUDIT لـgetPlayerResponse وأخواتها؛
//    وgetCurrentTime من بابها ولم يُقس منفرداً) ⇒ top وحدَه، **وأيُّ صفحةٍ من www.youtube.com** (المعاينةُ والمصغّرُ خارج /watch).
//    **وعلى /watch يُرفض مشغّلٌ يحمل غيرَ v — إلا وإعلانٌ يُعرض لحظةَ اللصق: ردُّ المشغّل أثناءه لم يُقس فلا يُرفض به.**
//  · **المعاينةُ «تعمل» حين يتقدّم زمنُ عنصرها** (كمِجَسّ #94) لا بوجوده · **والمصغّرُ احتواءٌ لا وجود** (#148).
//  · **في السطر:** V3@312.4/م310.1 = العنصرُ V3 عند زمنه 312.4 وزمنُ المشغّل 310.1 · P1 = عنصرُ #movie_player ·
//    **ونصُّ بحثك لا يُطبع:** search_query=‹4ح·x1y2› طولُه وبصمةٌ تُفرّق بحثين — والسطرُ يُرسَل.
//  · **التبويبُ المخفيّ يُبطئ المؤقّتات** فيُسجَّل · **وإعادةُ التحميل تمحو التسجيل** (يُطبع السطرُ عند المغادرة، ويُرى مع «Preserve log» وحدَه).
//  · لا شبكةَ ولا تخزينَ ولا كتابةَ في الصفحة ولا نقرة (#156) · المستمعون والمؤقّتُ يُزالون عند كلّ إيقاف، وvz168ctx
//    يبقى حتى إعادة التحميل ولا يعمل بعده · **ويصير حارساً أو يُحذف بعد 168أ** (قرار 70).
//
// ── كيف يُستعمل ────────────────────────────────────────────────────────────────────────────────
//   1) افتح **الرئيسيّة** (https://www.youtube.com/) — أو فيديو على /watch بقي منه أكثرُ من دقيقة فيُقاس معه زمنُ العنصر في السكون (ومن الرئيسيّة ⚪).
//   2) الكونسول (⌥⌘J على الماك · F12 على الويندوز) ⇒ **قائمةُ السياق في شريطه على «top»** — لا VIDEO ZONES ولا إطارٌ
//      داخليّ (المِجَسُّ يرفضهما ويُسمّي ما اخترت).
//   3) الصق الملفَّ كلَّه ثمّ Enter ⇒ 🟢 «يسجّل» ⇒ ⛔ **لا تلمس الصفحة 10 ثوانٍ** حتى يطبع 🟢 «تنقّل الآن».
//   4) **تنقّل بالنقر داخل يوتيوب** إلى فيديوهين (مصغّرة ثمّ فيديو من المقترحات) — ⛔ لا تكتب رابطاً ولا تُعِد التحميل.
//   5) وما تيسّر: عُد إلى الرئيسيّة بشعار يوتيوب وحوّم على مصغّرةٍ حتى تتحرّك معاينتُها (ومشغّلُ الفيديو باقٍ في الصفحة
//      فتُقارَن به) · افتح فيديو واضغط i للمشغّل المصغّر · دع إعلاناً يمرّ · افتح بثّاً عليه شارةُ «مباشر».
//   6) اكتب vz168ctx.stop() ثمّ Enter ⇒ جدولٌ ثمّ سطرٌ واحد يبدأ بـ VZ-168أ-11 يُنسخ وحده — **أرسله** (ويقف وحده بعد
//      15 دقيقة، وstop() ثانيةً تُعيد نسخَه). والويندوزُ غيرُ مطلوبٍ له (§٥: 1–6 و10).
(async () => {
  const TAG = "VZ-168أ-11";
  const COPY = typeof copy === "function" ? copy : null;   // ⛔ يُمسَك قبل أوّل await — بعده يختفي (📐 الدفعة الأولى)
  const T0 = performance.now(), now = function () { return Math.round(performance.now() - T0); };
  const IDLE = 10000, CAP = 900000, TICK = 250, FAST = 50, BURST = 5000, MATCH = 3000, JUMP = 1.5, ROWS = 400;   // 🎯 قرار 96
  const emit = function (line) { console.log(line); try { COPY(line); console.log("   (نُسخ إلى الحافظة)"); } catch (e) {} };
  const f1 = function (x) { return typeof x !== "number" || isNaN(x) ? "—" : isFinite(x) ? String(Math.round(x * 10) / 10) : "∞"; };
  const uniq = function (a) { return Array.from(new Set(a)).join("·") || "—"; };
  const lim = function (p, n) { let h = 0; return Promise.race([p, new Promise(function (r) { h = setTimeout(r, n, null); })]).finally(function () { clearTimeout(h); }); };

  // ── البيئة: من تلميحات المتصفّح عالية الدقّة، وإلا فسلسلةُ الوكيل كما هي (كالدفعة الأولى) ──────────
  let env = "بيئة: UA=" + navigator.userAgent;
  try {
    const uad = navigator.userAgentData; if (!uad || typeof uad.getHighEntropyValues !== "function") throw new Error("navigator.userAgentData غائب");
    const h = await lim(uad.getHighEntropyValues(["platform", "platformVersion", "architecture", "bitness", "fullVersionList"]), 3000);
    if (!h) throw new Error("مهلة 3000ms");
    const L = h.fullVersionList || [], pv = String(h.platformVersion || "؟"), mj = parseInt(pv, 10);
    const b = L.find(function (x) { return x.brand === "Google Chrome"; }) || L.find(function (x) { return !/not.?a.?brand/i.test(x.brand); }) || { brand: "؟", version: "؟" };
    env = "بيئة: " + h.platform + " " + (h.platform === "Windows" ? (mj >= 13 ? "11" : mj > 0 ? "10" : "؟") + " (" + pv + ")" : pv.replace(/(\.0)+$/, "")) + " " +
      (h.architecture === "x86" ? (h.bitness === "64" ? "x64" : "x86") : (h.architecture || "؟") + (h.bitness === "64" ? "64" : "")) +
      " · " + String(b.brand).replace(/^Google /, "") + " " + b.version;
  } catch (e) { env += " (UA-CH: " + ((e && e.message) || e) + ")"; }

  // ── ⓪ السياق: عالمُ الصفحة في الإطار الأعلى وحدَه — وكلُّ رفضٍ يُسمّي شرطَه بقيمته (قرار 140)، وبلا مستندٍ رفضٌ لا «رمى» ──
  if (typeof document === "undefined") { emit(TAG + " ⛔ رفضٌ قبل التسجيل: typeof document = undefined (عاملُ خدمة؟) — المطلوب: top (عالمُ الصفحة) في الإطار الأعلى على www.youtube.com · " + env); return; }
  const MP = function () { return document.querySelector("#movie_player"); };
  const urlV = function () { return location.pathname === "/watch" ? new URLSearchParams(location.search).get("v") || "" : ""; };
  const hide = function (s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return "‹" + s.length + "ح·" + h.toString(36).slice(-4) + "›"; };
  const navKey = function () { const q = new URLSearchParams(location.search), k = ["v", "search_query", "list"].find(function (n) { return q.get(n); });
    return location.pathname + (k ? "?" + k + "=" + (k === "search_query" ? hide(q.get(k)) : q.get(k)) : ""); };   // نصُّ البحث: طولُه وبصمتُه لا حروفُه
  const det = function (p) { try { const r = p && typeof p.getPlayerResponse === "function" ? p.getPlayerResponse() : null; return (r && r.videoDetails) || null; } catch (e) { return null; } };
  const adOf = function (p) { return p ? ["ad-showing", "ad-interrupting"].filter(function (c) { return p.classList.contains(c); }).join("+") : ""; };
  const ext = location.protocol === "chrome-extension:", ours = typeof globalThis.extensionActive === "function";
  const rid = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) || "";
  const ctx = ext ? "صفحة-الإضافة" : ours ? "عالم-الإضافة" : rid ? "عالم-إضافةٍ-أخرى" : "عالم-الصفحة";
  const mp0 = ext ? null : MP(), gpr = mp0 ? typeof mp0.getPlayerResponse : "لا #movie_player", d0 = det(mp0);
  const bad = [];
  if (ext) bad.push("السياق = صفحة-الإضافة " + location.pathname);
  else {
    if (ours) bad.push("السياق = عالم-الإضافة VIDEO ZONES — يرى العنصرَ ولا دوالَّه (typeof getPlayerResponse = " + gpr + ")");
    else if (rid) bad.push("السياق = عالمُ إضافةٍ أخرى (chrome.runtime.id = " + rid + ")");
    if (window.top !== window) bad.push("الإطار = داخليّ (" + location.hostname + location.pathname + ")");
    if (!/^(www\.)?youtube\.com$/.test(location.hostname)) bad.push("المضيف = " + location.hostname);
    if (!ours && !rid && globalThis.ytcfg == null) bad.push("شاهدُ البصر typeof ytcfg = " + typeof globalThis.ytcfg + " ⇒ لا يثبت أنّا في عالم صفحة يوتيوب");
    if (!ours && mp0 && gpr !== "function") bad.push("typeof #movie_player.getPlayerResponse = " + gpr);
    if (location.pathname === "/watch" && !mp0) bad.push("#movie_player = غائبٌ على /watch — انتظر المشغّلَ ثمّ أعد اللصق");
    else if (!bad.length && location.pathname === "/watch" && !adOf(mp0) && (d0 ? String(d0.videoId || "") : "") !== urlV())
      bad.push("videoId في المشغّل = " + ((d0 && d0.videoId) || "فارغ") + " والرابطُ v = " + (urlV() || "فارغ") + " ⇒ المشغّلُ يحمل فيديو سابقاً: أعد تحميل الصفحة");
  }
  if (bad.length) { emit(TAG + " ⛔ رفضٌ قبل التسجيل (السياقُ المكتشف " + ctx + "): " + bad.join(" · ") + " — المطلوب: top (عالمُ الصفحة) في الإطار الأعلى على www.youtube.com · " + env); return; }
  if (globalThis.vz168ctx && globalThis.vz168ctx.running === true) { emit(TAG + " ⛔ رفضٌ قبل التسجيل: vz168ctx.running = true — تسجيلٌ جارٍ في هذه الصفحة: نادِ vz168ctx.stop() أوّلاً · " + env); return; }

  // ── شاهدُ الأداة: المُعرِّفُ يفرّق عنصرين مصنوعين ويثبت للعنصر نفسِه — وإلا فلا «العنصرُ نفسُه» ──────
  const ids = function () { const m = new WeakMap(); let n = 0; return function (el) { if (!el) return 0; if (!m.has(el)) m.set(el, ++n); return m.get(el); }; };
  const tst = ids(), ea = document.createElement("video"), eb = document.createElement("video");
  if (!(tst(ea) === 1 && tst(eb) === 2 && tst(ea) === 1 && tst(null) === 0)) { emit(TAG + " ⛔ مُعرِّفُ العنصر لا يفرّق عنصرين مصنوعين — عيبٌ في المِجَسّ لا في يوتيوب · " + env); return; }
  const vid = ids(), pid = ids();   // ⭐ مُعرِّفٌ واحدٌ لعنصر المشغّل وعنصر المعاينة — فيُقارَنان

  // ── الحال: لقطةٌ كلَّ نبضة، وصفٌّ في الجدول عند كلّ انتقال ─────────────────────────────────────
  const rows = [], navs = [], evs = [], ads = [], pvs = [], minis = [], jumps = [], mains = new Set(), players = new Set();
  const liveOf = function (d, v) { return !d ? "" : d.isLive === true ? "مباشر (مدّةُ العنصر " + f1(v ? v.duration : NaN) + ")" : d.isLiveContent === true ? "بثٌّ منتهٍ" : ""; };
  const S = { nk: navKey(), p: d0 ? String(d0.videoId || "") : "", pAt: 0, lastNav: 0, lastEv: -1e9, mp: -1, v: -1, src: "", srcN: 0, ad: "", ep: null,
    last: null, o: null, d: d0, mini: false, pv: null, pvId: 0, pvT: -1, pvMiss: 0, pvSeen: false, pwSeen: false, c0: null, liveT: "", idleDone: false,
    hides: 0, drop: 0, live0: liveOf(d0, mp0 ? mp0.querySelector("video") : null), lv0: !!(d0 && d0.isLive === true) };
  let timer = 0, burst = 0, fin = "";
  const row = function (t, kind, note, o) {
    if (rows.length >= ROWS) { S.drop++; return; }
    rows.push({ "ث": f1(t / 1000), "حدث": kind, "عنصر": o && o.v ? "V" + o.v : "—", "زمن": o ? f1(o.ct) : "—", "زمنُ‑المشغّل": o ? f1(o.pt) : "—",
      "مدّة": o ? f1(o.du) : "—", "حال": o ? o.st : "—", "رابط": S.nk, "v‑المشغّل": S.p || "—", "ملاحظة": note || "" });
  };

  const step = function () {
    const t = now(), p = MP(), v = p ? p.querySelector("video") : null, d = det(p), pv = d ? String(d.videoId || "") : "";
    const src = v ? String(v.currentSrc || v.src || "") : "";
    const o = { t: t, v: vid(v), ct: v ? v.currentTime : NaN, du: v ? v.duration : NaN, pt: NaN, paused: !v || v.paused, rate: v ? v.playbackRate : 1,
      st: v ? (v.paused ? "⏸" : "▶") + " r" + v.readyState + " " + (src.split(":")[0] || "بلا‑src") : "لا فيديو" };
    try { if (p && typeof p.getCurrentTime === "function") o.pt = Number(p.getCurrentTime()); } catch (e) { o.pt = NaN; }
    S.d = d;
    // (١) المشغّل · العنصر · المصدر — والقفزةُ على العنصر نفسِه: للخلف، أو للأمام فوق المتوقَّع (التوقّفُ ليس قفزة)
    const P = pid(p);
    if (P !== S.mp) { row(t, "#movie_player", P ? "P" + P : "غائب", o); S.mp = P; if (P) players.add(P); }
    if (o.v !== S.v) { row(t, "العنصر", (S.v > 0 ? "V" + S.v : S.v < 0 ? "بدء" : "لا شيء") + " ⇒ " + (o.v ? "V" + o.v : "لا شيء"), o); S.v = o.v; if (o.v) mains.add(o.v); }
    else if (o.v && S.o && S.o.v === o.v) {
      const got = o.ct - S.o.ct, want = S.o.paused ? 0 : (t - S.o.t) / 1000 * S.o.rate;
      if (got < -JUMP || got > want + JUMP) { jumps.push({ t: t }); row(t, "قفزة", f1(S.o.ct) + " ⇒ " + f1(o.ct), o); }
    }
    if (src !== S.src) { if (S.src) S.srcN++; row(t, "src", (src.split(":")[0] || "فارغ") + " …" + src.slice(-6), o); S.src = src; }
    // (٢) الرابط والمشغّل: مَن سبق مَن — «سبقه» = تغيّرَ المشغّلُ بعد آخر تنقّلٍ وقبل الرابط
    if (pv !== S.p) {
      const was = S.p; S.p = pv; S.pAt = t; row(t, "videoId", (was || "فارغ") + " ⇒ " + (pv || "فارغ"), o);
      const n = navs[navs.length - 1];
      if (n && n.v && n.pl === null && n.v === pv) {
        n.pl = t; n.lt = liveOf(d, v); n.lv = !!(d && d.isLive === true); row(t, "لحق", "+" + (t - n.at) + "ms", o);
        console.log("🟢 " + TAG + ": المشغّلُ لحق الرابطَ بعد " + (t - n.at) + "ms" + (n.lt ? " · " + n.lt : ""));
      }
    }
    const nk = navKey();
    if (nk !== S.nk) {
      const n = { at: t, v: urlV(), pl: null, lead: 0, lt: "", lv: false, from: S.nk };
      if (n.v && pv === n.v) { n.pl = t; n.lead = S.pAt > S.lastNav ? t - S.pAt : 0; n.lt = liveOf(d, v); n.lv = !!(d && d.isLive === true); }
      navs.push(n); S.lastNav = t; S.nk = nk;
      row(t, "الرابط", n.from + " ⇒ " + nk + (n.pl === null ? "" : " · المشغّلُ معه" + (n.lead ? "، سبقه " + n.lead + "ms" : "")), o);
      console.log((t < IDLE ? "🟡 " : "🟢 ") + TAG + ": تنقّل #" + navs.length + " ⇐ " + nk + (t < IDLE ? " — ⛔ في نافذة السكون" : ""));
    }
    // (٣) الإعلان: صنفا المشغّل — «منتصف» إن سبقه محتوى الرابط نفسِه ولا حدثَ تنقّلٍ قبل 5 ث
    const ad = adOf(p);
    if (ad && !S.ad) {
      const pre = S.last && t - S.last.t < 2000 ? S.last : null;
      S.ep = { at: t, cls: ad, pre: pre, in: o, min: o.ct, out: null, end: 0, kind: pre && pre.nk === S.nk && pre.ct > 1 && t - S.lastEv > 5000 ? "منتصف" : "قبل" };
      ads.push(S.ep); row(t, "إعلان ⇐", ad + " · " + S.ep.kind + (pre ? " · قبله V" + pre.v + "@" + f1(pre.ct) : ""), o);
      console.log("🟢 " + TAG + ": إعلان #" + ads.length + " (" + ad + ") — دعه يمرّ.");
    } else if (ad && S.ep) {
      if (!isNaN(o.ct)) S.ep.min = isNaN(S.ep.min) ? o.ct : Math.min(S.ep.min, o.ct);
      if (ad !== S.ad) { S.ep.cls += "→" + ad; row(t, "إعلان ~", ad, o); }
    } else if (!ad && S.ep) { S.ep.out = o; S.ep.end = t; row(t, "إعلان ⇒", Math.round((t - S.ep.at) / 1000) + " ث", o); S.ep = null; }
    S.ad = ad;
    if (!ad && v) S.last = { t: t, v: o.v, ct: o.ct, pt: o.pt, nk: S.nk };
    // (٤) المعاينة: تعمل حين يتقدّم زمنُ عنصرها (#94) — والمُعرِّفُ نفسُه يقارنه بعنصر المشغّل
    const pe = document.querySelector("#inline-preview-player"), pvv = pe ? pe.querySelector("video") : null, pvId = vid(pvv);
    if (pe && !S.pvSeen) { S.pvSeen = true; row(t, "#inline-preview-player", "ظهر في الصفحة", o); }
    if (!S.pwSeen && document.querySelector("ytd-video-preview")) { S.pwSeen = true; row(t, "ytd-video-preview", "ظهر في الصفحة", o); }
    const moving = !!pvv && pvId === S.pvId && !pvv.paused && Math.abs(pvv.currentTime - S.pvT) > 0.01;
    S.pvId = pvId; S.pvT = pvv ? pvv.currentTime : -1;
    if (moving && !S.pv) {
      S.pv = { at: t, id: pvId, main: o.v, same: pvv === v, wrap: !!pe.closest("ytd-video-preview") }; pvs.push(S.pv); S.pvMiss = 0;
      row(t, "معاينة ⇐", "V" + pvId + (S.pv.same ? " = العنصرُ الرئيسيّ" : " ≠ الرئيسيّ " + (o.v ? "V" + o.v : "(لا مشغّل)")), o);
      console.log("🟢 " + TAG + ": معاينة #" + pvs.length + " تعمل.");
    } else if (S.pv) { if (moving) S.pvMiss = 0; else if (++S.pvMiss >= 3) { S.pv.end = t; row(t, "معاينة ⇒", "", o); S.pv = null; } }
    // (٥) المصغّر: الاحتواءُ لا الوجود (#148 — #movie_player نفسُه يُنقل إليه)
    const mini = !!(p && p.closest("ytd-miniplayer"));
    if (mini !== S.mini) {
      S.mini = mini; row(t, mini ? "مصغّر ⇐" : "مصغّر ⇒", "", o);
      if (mini) { minis.push({ at: t, nk: S.nk, play: !o.paused }); console.log("🟢 " + TAG + ": المشغّلُ المصغّر."); }
    }
    if (!S.c0 && v) S.c0 = { t: t, v: o.v, ct: o.ct, paused: o.paused };
    else if (S.c0 && t < IDLE && (o.paused || o.v !== S.c0.v)) S.c0.paused = true;
    S.o = o;
  };

  const idleEnd = function () {
    S.idleDone = true;
    if (navs.some(function (n) { return n.at < IDLE; }) || evs.some(function (e) { return e.t < IDLE; })) { finish("وقع تنقّلٌ في نافذة السكون"); return; }
    const c = S.c0, o = S.o; S.liveT = c && !c.paused && o && o.v === c.v ? "+" + f1(o.ct - c.ct) + " ث في " + f1((o.t - c.t) / 1000) + " ث بالساعة" : "⚪ لم يُتحقَّق (متوقّفٌ أو لا فيديو)";
    console.log("🟢 " + TAG + ": نافذةُ السكون تمّت — صفرُ تنقّل ✅ · زمنُ العنصر " + S.liveT + " ⇒ **تنقّل الآن** بالنقر داخل يوتيوب، ثمّ vz168ctx.stop().");
  };

  const finish = function (why) {
    if (fin) { emit(fin); return; }
    off();
    const t = now(), yes = function (b) { return b ? "نعم" : "لا"; }, cnt = function (a, f) { return a.filter(f).length + "/" + a.length; };
    const iN = navs.filter(function (n) { return n.at < IDLE; }).length, iE = evs.filter(function (e) { return e.t < IDLE; }).length;
    const aN = navs.length - iN, aE = evs.length - iE, fins = evs.filter(function (e) { return e.type === "yt-navigate-finish"; });
    const bare = navs.filter(function (n) { return n.at >= IDLE && n.at <= t - MATCH && !fins.some(function (f) { return Math.abs(f.t - n.at) <= MATCH; }); }).length;
    const negOk = t >= IDLE && !iN && !iE, posOk = aN + aE > 0;
    const g = !negOk ? "⛔" : !posOk ? "⚪" : bare ? "❌" : "✅";
    const neg = t < IDLE ? "⛔ أُوقف بعد " + f1(t / 1000) + " ث من 10 — نافذةُ السكون لم تكتمل"
      : iN || iE ? "⛔ في نافذة السكون: تغيّرُ الرابط=" + iN + " · أحداثُ التنقّل=" + iE + (iN ? " (تنقّلتَ، أو انتهى الفيديو فانتقل وحده) — أعد اللصق ولا تلمس الصفحة 10 ث"
        : " والرابطُ ثابت ⇒ أطلقه يوتيوب بلا تنقّل أو الأداةُ تعدّ ما لم يقع — أعد اللصق بعد ثوانٍ من التحميل") : "✅ صفرُ تنقّلٍ في 10 ث";
    // التنقّل وتأخّرُ المشغّل عن الرابط
    const w = navs.filter(function (n) { return n.v; }), hit = w.filter(function (n) { return n.pl !== null; });
    const lg = hit.map(function (n) { return n.pl - n.at; }).sort(function (a, b) { return a - b; }), ld = w.map(function (n) { return n.lead; }).filter(Boolean);
    const adIn = hit.filter(function (n) { return ads.some(function (a) { return a.at >= n.at - 1000 && a.at <= n.pl; }); }).length;
    const lagS = !w.length ? "⚪ لا تنقّلَ إلى /watch" : "خلفَ الرابط أقصى " + (lg.length ? lg[lg.length - 1] + "ms · وسيط " + lg[(lg.length - 1) >> 1] + "ms" : "—") +
      " (لحق " + hit.length + " من " + w.length + (adIn ? " · بإعلانٍ بينهما " + adIn : "") + ")" + (ld.length ? " · سبقه حتى " + Math.max.apply(null, ld) + "ms (" + ld.length + ")" : "");
    // الإعلان: العنصرُ والزمنان قبله وداخله وبعده
    const mid = ads.filter(function (a) { return a.kind === "منتصف" && a.pre && a.out; }), io = ads.filter(function (a) { return a.out; });
    const adS = !ads.length ? "⚪ لم يُرَ (لا ✅ بغيابه: Premium؟ أو لم يقع)" : "×" + ads.length + " [" + ads.slice(0, 4).map(function (a) {
      return a.kind + " " + a.cls + " " + (a.pre ? "V" + a.pre.v + "@" + f1(a.pre.ct) + "/م" + f1(a.pre.pt) : "—") + " ⇒ V" + a.in.v + "@" + f1(a.in.ct) + "…أدنى " + f1(a.min) +
        " ⇒ " + (a.out ? "V" + a.out.v + "@" + f1(a.out.ct) + "/م" + f1(a.out.pt) : "جارٍ") + " (" + Math.round(((a.end || t) - a.at) / 1000) + "ث)";
    }).join(" ، ") + (ads.length > 4 ? " ، +" + (ads.length - 4) : "") + "] · العنصرُ نفسُه داخله وبعده=" + cnt(io, function (a) { return a.in.v === a.out.v; }) +
      " · في المنتصف: العنصرُ نفسُه قبله=" + cnt(mid, function (a) { return a.pre.v === a.in.v; }) + " · زمنُ العنصر يُصفَّر=" + cnt(mid, function (a) { return a.min < a.pre.ct - 1; }) +
      " · يعود إلى موضعه: العنصر=" + cnt(mid, function (a) { return Math.abs(a.out.ct - a.pre.ct) <= 3; }) + " · المشغّل=" + cnt(mid, function (a) { return Math.abs(a.out.pt - a.pre.pt) <= 3; });
    const cmp = pvs.filter(function (x) { return x.main; });   // ⛔ بلا عنصرٍ رئيسيٍّ وقتَها فـ«غيرُه» صدقٌ بالغياب لا قياس
    const pvS = !pvs.length ? "⚪ لم تُرَ معاينةٌ تعمل" + (S.pvSeen ? " (العنصرُ ظهر ولم يتقدّم زمنُه)" : "") : "×" + pvs.length + " · عنصرٌ غيرُ الرئيسيّ=" +
      (cmp.length ? yes(!cmp.some(function (x) { return x.same; })) + " (" + cmp.length + " بمشغّلٍ رئيسيّ)" : "⚪ لا مشغّلَ رئيسيَّ وقتَها") + " · عناصرُها " + uniq(pvs.map(function (x) { return "V" + x.id; })) +
      " · الرئيسيُّ وقتَها " + uniq(pvs.map(function (x) { return x.main ? "V" + x.main : "لا مشغّل"; })) + " · داخل ytd-video-preview=" + cnt(pvs, function (x) { return x.wrap; });
    const miS = !minis.length ? "⚪ لم يُرَ" : "×" + minis.length + " · الرابطُ وقتَه " + uniq(minis.map(function (m) { return m.nk; })) + " · يعمل فيه=" + cnt(minis, function (m) { return m.play; });
    const lv = (S.lv0 ? ["عند اللصق: " + S.live0] : []).concat(navs.filter(function (n) { return n.lv; }).map(function (n) { return n.v + ": " + n.lt; }));
    const ended = navs.filter(function (n) { return !n.lv && n.lt; }).length + (!S.lv0 && S.live0 ? 1 : 0);
    const liS = (lv.length ? "×" + lv.length + " [" + lv.slice(0, 3).join(" ، ") + "]" : "⚪ لم يُرَ بثٌّ مباشر") + (ended ? " · بثٌّ منتهٍ×" + ended : "");
    // القفزات تُنسب إلى أقرب علامة: حدثُ تنقّلٍ أو تغيّرُ رابطٍ (±3 ث) · ثمّ دخولُ إعلانٍ أو خروجُه (±1 ث)
    const near = function (x, ts, r) { return ts.some(function (y) { return Math.abs(y - x) <= r; }); }, adT = [];
    const navT = navs.map(function (n) { return n.at; }).concat(evs.map(function (e) { return e.t; }));
    ads.forEach(function (a) { adT.push(a.at); if (a.end) adT.push(a.end); });
    const jN = jumps.filter(function (j) { return near(j.t, navT, MATCH); }).length, jA = jumps.filter(function (j) { return !near(j.t, navT, MATCH) && near(j.t, adT, 1000); }).length;
    fin = TAG + " " + g + " · " + (g === "⛔" ? "الشاهدُ السالب لم يقع ⇒ لا حكم" : g === "⚪" ? "لم يقع تنقّل — الشاهدُ الموجب لم يُنتَج"
      : g === "❌" ? "**الرابطُ تغيّر " + bare + " مرّةً بلا yt-navigate-finish خلال ±3 ث** ⇒ الحدثُ الذي يبني عليه المنتَجُ لا يُطلَق دائماً" : "سُجّل بشاهدَيه") +
      " · تنقّل: " + navs.length + " تغيّرَ رابط · start×" + (evs.length - fins.length) + " · finish×" + fins.length + " · رابطٌ بلا finish=" + bare + " · المشغّل " + lagS +
      " · إعلان: " + adS + " · معاينة: " + pvS + " · مصغّر: " + miS + " · بثّ: " + liS +
      " · العنصرُ الرئيسيّ " + uniq(Array.from(mains).map(function (x) { return "V" + x; })) + " · مشغّلات=" + players.size + " · src تغيّر=" + S.srcN +
      " · قفزاتُ الزمن=" + jumps.length + " (عند تنقّل " + jN + " · عند إعلان " + jA + " · غيرُهما " + (jumps.length - jN - jA) + ")" +
      " · شاهد−=" + neg + " · شاهد+=" + (posOk ? "✅ " + aN + " تغيّرَ رابط و" + aE + " حدثاً بعد السكون" : "⚪ صفر") + " · مُعرِّفُ العنصر=✅ يفرّق مصنوعَين" +
      " · زمنُ العنصر في السكون=" + (S.liveT || "—") + " · أُخفي التبويب=" + S.hides + (S.drop ? " · ⚠️ الجدولُ مقصوص +" + S.drop + " صفّ" : "") +
      " · شبكة=0 طلب · سجّل " + f1(t / 60000) + " د (" + why + ") · سياق=" + ctx + " (" + location.pathname + ") · " + env;
    console.table(rows);
    emit(fin);
  };
  const fail = function (e) { if (fin) return; off(); fin = TAG + " ⛔ · المِجَسُّ نفسُه رمى: " + ((e && e.stack) || e) + " — عطبُ أداةٍ لا جواب، أبلِغ بهذا السطر · " + env; emit(fin); };
  const loop = function () {
    try {
      step();
      const t = now();
      if (!S.idleDone && t >= IDLE) idleEnd();
      if (fin) return;
      if (t >= CAP) { finish("انقضت 15 دقيقة"); return; }
      timer = setTimeout(loop, t < burst ? FAST : TICK);
    } catch (e) { fail(e); }
  };
  // ── المستمعون: أحداثُ التنقّل تُقرأ لحظةَ وقوعها وتُسرّع النبضةَ خمسَ ثوانٍ؛ والتفصيلُ بيانٌ لا أمر ─────
  const onNav = function (e) {
    try {
      const t = now(), dt = e && e.detail;
      step(); evs.push({ t: t, type: e.type }); S.lastEv = t;
      const u = dt && typeof dt.url === "string" ? dt.url.replace(/search_query=[^&]*/, "search_query=‹…›").slice(0, 80) : "", pt = dt && typeof dt.pageType === "string" ? dt.pageType : "";
      row(t, e.type.replace("yt-", ""), (u ? "⇐ " + u + " · " : "") + (pt ? "pageType=" + pt + " · " : "") + "v الرابط=" + (urlV() || "—") +
        " · isLive=" + (S.d ? String(S.d.isLive === true) : "—"), S.o);
      if (t < IDLE) console.log("🟡 " + TAG + ": " + e.type + " في نافذة السكون — الشاهدُ السالب يسقط.");
      burst = t + BURST; clearTimeout(timer); timer = setTimeout(loop, FAST);
    } catch (er) { fail(er); }
  };
  const onVis = function () { try { if (document.hidden) S.hides++; row(now(), document.hidden ? "أُخفي التبويب" : "ظهر التبويب", "", S.o); } catch (e) { fail(e); } };
  const onHide = function () { try { finish("غادرت الصفحة قبل stop()"); } catch (e) { fail(e); } };
  const ctl = { running: true, stop: function () { try { finish("vz168ctx.stop()"); } catch (e) { fail(e); } } };
  const off = function () {
    clearTimeout(timer); timer = 0; ctl.running = false;
    document.removeEventListener("yt-navigate-start", onNav, true); document.removeEventListener("yt-navigate-finish", onNav, true);
    document.removeEventListener("visibilitychange", onVis); removeEventListener("pagehide", onHide);
  };
  globalThis.vz168ctx = ctl;
  document.addEventListener("yt-navigate-start", onNav, true); document.addEventListener("yt-navigate-finish", onNav, true);
  document.addEventListener("visibilitychange", onVis); addEventListener("pagehide", onHide);
  console.log("🟢 " + TAG + ": يسجّل على " + location.pathname + " (" + ctx + ") — ⛔ **لا تلمس الصفحة 10 ثوانٍ** حتى يطبع «تنقّل الآن»، ثمّ vz168ctx.stop() — أو يقف وحده بعد 15 دقيقة. صفرُ طلبِ شبكةٍ منّا.");
  loop();
})().catch((e) => console.log("VZ-168أ-11 ⛔ · المِجَسُّ نفسُه رمى: " + ((e && e.stack) || e) + " — عطبُ أداةٍ لا جواب، أبلِغ بهذا السطر"));
