// مِجَسّ 168أ-10 — **أيُسقط كتمُ التبويب النطق؟ أيقطعه cancel() من تبويبٍ آخر؟ أيُسكت pause() في السكون الجملةَ التالية؟ أيمسّه صوتُ الفيديو؟** يُلصق في كونسول صفحةِ مشاهدةٍ على يوتيوب (أو أيّ صفحة http(s)).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن كتمتُ التبويب، أو أسكت تبويبٌ آخرُ
// النطق، أو كتمتُ الفيديو نفسَه — أتنقطع الدبلجةُ أم تبقى؟ وهل تعرف الإضافةُ أنها
// انقطعت، أم تحسب جملةً لم تُسمع جملةً منطوقة؟»*
//
// ── لماذا يُقاس الحدثُ لا الصمت (قرار 48 · قرار 109) ────────────────────────
// الصمتُ أثرٌ واحدٌ لأسبابٍ كثيرة (كتمٌ · قطعٌ من غيرنا · علَمُ إيقافٍ عامّ) ⇒ **يُقاس ما سيقرؤه المُجدوِل
// (168هـ): `start` · `end` · `error` بأزمانها.** ⚠️ **وحدثٌ يقول «نُطق» لا يقول «سُمع»** ⇒ السمعُ (👁) في videoMuted وحدَها.
//
// ── ما يقوله كودُ كروم (📖 الالتزامُ 84abc2c نفسُه في §٩) — **والمِجَسُّ يُثبته أو ينقضه** ──
//  · **الكتم:** `Speak` يعود بلا شيءٍ والتبويبُ مكتوم (speech_synthesis_impl.cc:167) وBlink يُحاكي نهايةً
//    سليمةً حين ينقطع الخيط (speech_synthesis_utterance.cc:177-181) ⇒ **`end` بلا `start`** — والفحصُ عند
//    `speak()` وحدَه ⇒ **الكتمُ أثناء جملةٍ جارية لا يُقاس هنا.**
//  · **cancel():** `Stop()` بعنوانٍ فارغ (speech_synthesis_impl.cc:211) يقطع الجاريةَ من أيّ أصلٍ بـ`interrupted`
//    ويُفرغ الطابورَ بـ`canceled` (tts_controller_impl.cc:249-293 · 722-746) ⇒ ⚠️ **توقف أيَّ نطقٍ في المتصفّح كلِّه.**
//  · **pause():** علَمٌ واحدٌ للمتصفّح (`paused_`)؛ في السكون لا يصل الصفحةَ حدثٌ فيبقى `speechSynthesis.paused`
//    كما كان، وكلُّ جملةٍ بعده تُحتجز (tts_controller_impl.cc:207-247 · 295-333). **و`resume()` يعود بلا نداءٍ إن
//    خلا طابورُ الصفحة** (speech_synthesis.cc:168-175) ⇒ **فيُنادى قبل `cancel()`** الذي يُصفّر العَلَم (tts_controller_impl.cc:265).
//  · **الإخفاء:** مفتاحٌ يُسكت تبويباً مخفيّاً (`stop_speaking_when_hidden_`) **لم نقرأ أين يُضبط على سطح
//    المكتب** ⇒ **فضابطةُ longA تُخفي التبويبَ أيضاً**، وإلا نُسب إلى cancel() فعلُ الإخفاء.
//
// ── الشاهدان (قرار 26 · 150) — كما في صفّ المجسّ 10 بالسجلّ ──────────────────
//  · **الموجب: `solo()` في تبويبٍ غيرِ مكتوم يُطلق `start`** — في ذاكرة الصفحة لا التخزين، **وبدونه ترفض
//    pauseIdle وmutedTab وvideoMuted**: «لم يبدأ» من صفحةٍ لا تنطق صفرٌ بلا شاهد، **و«لا يوجد» و«لا أرى» سواء.**
//  · **والسالبُ ثلاثة:** مكتومٌ ⇐ `end` بلا `start` · cancel من تبويبٍ آخر يقطع **ومعه ضابطة** (longA يُخفى
//    تبويبُه بلا cancel ⇒ طبيعيّة؛ ومع cancelB ⇒ مقطوعةٌ **بوقتٍ يطابق وقتَ cancelB** بساعة الجهاز نفسِها) —
//    ⛔ **وقطعٌ في تبويبٍ أُخفي بلا ضابطةٍ قبله ⚪ لا ❌، وبعد الإخفاء بأقلَّ من 500ms ⛔** · pause() في السكون
//    يُسكت التالية — ⛔ **و✅ لا يُطبع إلا وجملةُ التحقّق تبدأ بعد الإرجاع** (وإلا فصمتٌ بلا شاهد)، ثمّ حدثٌ لها (محتجزةٌ لا ضائعة).
//  · ✅ نعم مقيسةٌ بشاهدَيها · ❌ لا مقيسة · ⚪ لا حكمَ من الآلة (cancelB · السمع) · ⛔ رفضٌ أو قياسٌ باطل —
//    **وكلُّ رفضٍ يُسمّي شرطاً واحداً بقيمته (قرار 140).**
//
// ── حدودٌ مُعلَنة ────────────────────────────────────────────────────────────
//  · **السياق:** عالمُ الصفحة أو عالمُ الإضافة على صفحة http(s) — ويرفض صفحةَ الإضافة.
//  · **الصفحةُ لا ترى كتمَ التبويب** ⇒ سطرُ mutedTab مشروطٌ بأنك كتمته؛ ⚠️ **و«كتمُ صوت الموقع» يبقى في كروم
//    لكلّ تبويبات الموقع — ألغِه بيدك.** **ونطقُ تبويبٍ آخر لا يُرى من هنا** (`speaking` لطابور الصفحة وحدَها).
//  · **cancelB لا تشترط تفاعلاً**: `cancel()` ليست نطقاً (speech_synthesis.cc:148-157) ورفضُها يُضيّع longA
//    الجارية ⇒ تطبع `hasBeenActive` ولا ترفض. **وما ينطق يشترطه** وإن سمح كروم بدونه لموقعٍ كثيرِ المشاهدة.
//  · **4ث · 30ث · 45ث لـlongA (~20ث) · 2ث · 500ms · 3ث للأصوات: اختياراتٌ لا قياسات (قرار 96).** والأصواتُ تُنتظر حتى
//    يظهر صوتٌ محلّيّ (الدفعةُ الأولى شبكيّةٌ وحدَها، مِجَسّ 2)؛ والصوتُ عربيٌّ محلّيّ، وإلا فمحلّيٌّ أيّاً كان — لا شبكيّ.
//  · `vz168q` يبقى حتى إعادة التحميل **ولا يعمل حتى يُنادى**؛ كلُّ مستمعٍ ومؤقّتٍ يُزال بعد كلّ حالة، ولا تخزينَ
//    ولا شبكة. **و`pause()`/`resume()` هنا وحدَها و`cancel()` بعدهما دائماً** — فلا تُغلق التبويبَ أثناء pauseIdle.
//
// ── كيف يُستعمل ─────────────────────────────────────────────────────────────
//   1) التبويب «أ»: صفحةُ مشاهدةٍ على يوتيوب **غيرُ مكتومة، ولا شيءَ ينطق في أيّ تبويب**؛ **وانقر مرّةً على
//      مساحةٍ فارغةٍ تحت المشغّل** — النقرُ في الكونسول لا يُحتسب.
//   2) الكونسول (F12): الصق الملفَّ كلَّه ثمّ Enter، **ونادِ الحالاتِ في السياق نفسِه** (الصفحة، أو اسمُ الإضافة).
//   3) `vz168q.solo()` — تسمع جملةً قصيرة ويطبع ✅. **هو شاهدُ كلِّ ما بعده.**
//   4) **التبويب «ب»** (أيّ صفحة http(s)): الصق الملفَّ في كونسوله واكتب `vz168q.cancelB()` **ولا تضغط Enter.**
//   5) **الضابطة:** في «أ» `vz168q.longA()`، ثمّ «ب» خمسَ ثوانٍ **بلا Enter**، ثمّ عُد وانتظر سطرَه.
//   6) **القطع:** في «أ» `vz168q.longA()`، ثمّ «ب» واضغط Enter خلال 5ث، ثمّ عُد. **انسخ السطرين.**
//   7) في «أ» `vz168q.pauseIdle()` — **يُفترض ألّا تسمع جملتَه**، ثمّ تسمع بعد ~4ث «انتهى الاختبار» (**شاهدُ
//      الإرجاع**)؛ وإن طبع «الإرجاع ⛔» فنفّذ ما يقوله.
//   8) **اكتم الموقع** من قائمة التبويب «أ» (نقرةٌ ثانويّةٌ على عنوانه في شريط التبويبات، أو Control+نقرة على الماك)
//      ⇐ Mute site، ثمّ `vz168q.mutedTab()` — ⛔ **ثمّ ألغِ الكتم من القائمة نفسِها.**
//   9) اكتم الفيديو بزرّ الكتم في شريط المشغّل، ثمّ `vz168q.videoMuted()` — **وقل لنا: أسمعتَ الجملة؟**
//  10) انسخ كلَّ سطرٍ «VZ-168أ-10/…» كما طُبع، وكرّر ذلك على الويندوز.
//  11) (الويندوز) `vz168q.amp()` — ثلاثُ جملٍ قصيرة، في الثانية منها «Q&A»: **أصغِ أتُكمل بعدها؟** وأرسل السطرَ وما سمعت.
(async () => {
  const ID = "VZ-168أ-10";
  // **`copy` يُلتقط لحظةَ اللصق**: من أدوات الكونسول لا من الصفحة، والسطرُ يُطبع بعد انتهاء الأمر.
  const cp = typeof copy === "function" ? copy : null;
  const ctx = location.protocol === "chrome-extension:" ? "صفحة-الإضافة"
    : typeof globalThis.extensionActive === "function" ? "عالم-الإضافة" : "عالم-الصفحة";
  const within = (pr, t) => { let h = 0;   // كلُّ انتظارٍ بمهلة، ومؤقّتُه يُزال
    return Promise.race([pr, new Promise((res) => { h = setTimeout(res, t, "timeout"); })]).finally(() => clearTimeout(h)); };
  const envP = (async () => {   // ⛔ بمهلة: كلُّ سطرٍ ينتظره، فوعدٌ لا يُحسم كان سيُسكت المِجَسَّ كلَّه
    try {
      const h = await within(navigator.userAgentData.getHighEntropyValues(["platform", "platformVersion", "architecture",
        "bitness", "fullVersionList"]), 3000);
      if (h === "timeout") throw new Error("مهلة 3 ث");                            // ⇒ سلسلةُ الوكيل كما هي
      const pick = (re) => (h.fullVersionList || []).find((x) => re.test(x.brand));
      const b = pick(/Google Chrome/) || pick(/Edge/) || pick(/Chromium/) || { brand: "?", version: "?" };
      const pv = String(h.platformVersion), mj = parseInt(pv, 10);
      return "بيئة: " + h.platform + " " + (h.platform === "Windows" ? (mj >= 13 ? "11" : "10") + " (" + pv + ")"
        : pv.replace(/\.0$/, "")) + " " + (h.architecture === "x86" ? (h.bitness === "64" ? "x64" : "x86")
        : h.architecture + h.bitness) + " · " + b.brand.replace("Google ", "") + " " + b.version;
    } catch (e) { return "بيئة: " + navigator.userAgent; }
  })();
  const emit = async (line) => {
    const l = line + " · سياق=" + ctx + " · " + (await envP);
    console.log(l);
    try { cp(l); console.log("   (نُسخ إلى الحافظة)"); } catch (e) { /* لا حافظة: السطرُ مطبوعٌ أعلاه */ }
  };

  // ── ⛔ مرساةُ السياق: يُسمّي ما وجد وما يُطلب (قرار 140) ──────────────────────
  const bad = ctx === "صفحة-الإضافة" ? "السياق = صفحة-الإضافة (" + location.pathname + ")"
    : !/^https?:$/.test(location.protocol) ? "البروتوكول = " + location.protocol
    : typeof speechSynthesis === "undefined" ? "typeof speechSynthesis = undefined" : null;
  if (bad) {
    await emit(ID + " ⛔ رفض: " + bad + " — المطلوب: عالم-الإضافة أو عالم-الصفحة على صفحة http(s) فيها speechSynthesis. ولم يُثبَّت vz168q.");
    return;
  }

  const SHORT = "هذه جملةٌ عربيّةٌ قصيرةٌ لاختبار النطق.";
  const LONG = [SHORT, SHORT, SHORT, SHORT, SHORT].join(" ");     // الجملةُ نفسُها خمساً: ~20ث
  const KEEP = [];                      // ⛔ يحفظ الجملَ من جامع القمامة حتى تنتهي، وإلا قد يضيع الحدث
  const W = { solo: null, longA: [] };  // شواهدُ هذه الصفحة: في الذاكرة لا في التخزين
  let busy = null;
  const isAr = (v) => (v.lang || "").toLowerCase().split(/[-_]/)[0] === "ar";  // بالوسم لا بالاسم (درس #161)
  const p2 = (n, w) => String(n).padStart(w || 2, "0"), clock = (t) => { const d = new Date(t);
    return p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()) + "." + p2(d.getMilliseconds(), 3); };
  // ⛔ القائمةُ تصل دفعتين (مِجَسّ 2: أصواتُ كروم الشبكيّة أوّلاً ثمّ أصواتُ النظام) ⇒ «غيرُ فارغة» لا تكفي: تُنتظر
  // أوّلُ قائمةٍ فيها صوتٌ محلّيّ (السقف 3 ث) · والصوتُ عربيٌّ محلّيّ، وإلا فمحلّيٌّ أيّاً كان — **لا شبكيٌّ يُرسل النصّ**
  const voices = async () => { let vs = speechSynthesis.getVoices();
    for (let i = 0; i < 12 && !vs.some((x) => x.localService); i++) { await new Promise((r) => setTimeout(r, 250)); vs = speechSynthesis.getVoices(); }
    return vs; };
  async function prep(text) {
    const vs = await voices(), ar = vs.filter(isAr), v = ar.find((x) => x.localService) || vs.find((x) => x.localService) || null;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = v ? v.lang : "ar"; u.volume = 0.8; if (v) u.voice = v;
    const r = { u, start: null, end: null, err: null, errAt: null, sync: false, words: 0, total: 0, t0: 0, wall0: 0, wallEnd: 0,
      how: null, voice: v ? v.name + " " + v.lang + " محلّيّ" + (isAr(v) ? "" : " ⚠️ غيرُ عربيّ") + " (عربيّة " + ar.length + " من " +
        vs.length + ")" : "الافتراضيّ ⚠️ لا صوتَ محلّيّاً بين " + vs.length };
    let inSpeak = false, go = null, done = null;
    r.go = new Promise((res) => { go = res; });        // أوّلُ start أو end أو error
    r.done = new Promise((res) => { done = res; });    // end أو error
    const at = () => Math.round(performance.now() - r.t0);
    // ⛔ المعالجاتُ قبل speak(): «not-allowed» يُطلَق متزامناً داخلها
    u.onstart = () => { if (r.start === null) r.start = at(); go("start"); };
    u.onboundary = (e) => { if (e.name === "word") r.words++; };
    u.onend = () => { if (r.end === null) { r.end = at(); r.wallEnd = Date.now(); } go("end"); done("end"); };
    u.onerror = (e) => { if (r.err === null) { r.err = e.error; r.errAt = at(); r.sync = inSpeak; r.wallEnd = Date.now(); }
      go("error"); done("error"); };
    r.speak = () => { KEEP.push(u); r.t0 = performance.now(); r.wall0 = Date.now();
      inSpeak = true; speechSynthesis.speak(u); inSpeak = false; };
    return r;
  }
  const drop = (r) => { r.u.onstart = r.u.onend = r.u.onerror = r.u.onboundary = null; const i = KEEP.indexOf(r.u); if (i >= 0) KEEP.splice(i, 1); };
  async function finish(r, t) {         // مهلةٌ بلا نهاية ⇒ cancel() يُنظّف طابورَ الصفحة العالق
    r.how = await within(r.done, t);
    if (r.how === "timeout") { speechSynthesis.cancel(); await within(r.done, 1500); }
    drop(r); return r.how;
  }
  const TMO = (s) => "لا end ولا error خلال " + s + "ث — أُلغي بـcancel() ولا يُحكم";
  const T = (x) => (x === null ? "—" : x + "ms");
  const facts = (r) => "start=" + T(r.start) + " · end=" + T(r.end) + " · error=" +
    (r.err === null ? "—" : r.err + "@" + r.errAt + "ms" + (r.sync ? " (متزامن)" : "")) +
    " · كلمات=" + r.words + (r.total ? "/" + r.total : "") + " · صوت=" + r.voice;
  const wit = () => "شاهدٌ موجب: solo بدأ هنا بعد " + W.solo.start + "ms";
  function pre(name, needSolo) {        // شرطٌ واحدٌ بقيمته لكلّ رفض (قرار 140)
    const ua = navigator.userActivation;
    if (busy) return "حالةٌ جارية = " + busy + " — انتظر سطرها";
    if (!ua) return "navigator.userActivation = غيرُ موجود";
    if (ua.hasBeenActive !== true) return "navigator.userActivation.hasBeenActive = " + ua.hasBeenActive +
      " — انقر مرّةً داخل الصفحة نفسِها (لا في الكونسول) ثمّ أعِد vz168q." + name + "()";
    if (speechSynthesis.speaking || speechSynthesis.pending) return "speechSynthesis.speaking = " + speechSynthesis.speaking +
      " · pending = " + speechSynthesis.pending + " — نطقٌ جارٍ من هذه الصفحة؛ انتظره (وإن علق فنادِ speechSynthesis.cancel())";
    if (needSolo && !(W.solo && W.solo.start !== null)) return "الشاهدُ الموجب غائب: solo " +
      (W.solo ? "لم يبدأ نطقاً (" + facts(W.solo) + ")" : "لم يُشغَّل في هذه الصفحة") + " — شغّله والتبويبُ غيرُ مكتوم";
    return null;
  }
  const run = (name, fn, needSolo, hint) => () => {
    const why = pre(name, needSolo);
    if (why) { emit(ID + "/" + name + " ⛔ رفض: " + why); return; }
    busy = name; console.log("🟢 " + ID + "/" + name + ": " + hint);
    fn().catch((e) => emit(ID + "/" + name + " ⛔ عطبٌ في المِجَسّ نفسِه لا في كروم — أبلِغ بهذا السطر: " + (e && e.message)))
      .finally(() => { busy = null; });
  };

  async function solo() {
    const r = await prep(SHORT); r.speak();
    const how = await finish(r, 30000);
    W.solo = r;
    await emit(ID + "/solo " + (how === "timeout" ? "⛔ " + TMO(30)
      : r.start !== null ? "✅ بدأ النطقُ هنا — وهو الشاهدُ الموجب لكلّ حالةٍ بعده"
      : r.err !== null ? "❌ لم يبدأ: error=" + r.err
      : "❌ لم يبدأ: end بلا start ⇒ التبويبُ مكتومٌ على الأرجح — ألغِ كتمَ الموقع وأعِد") + " · " + facts(r));
  }
  async function longA() {
    // ⛔ المستمعُ قبل التحضير لا بعده: إخفاءٌ أثناء انتظار الأصوات كان يفوته فيُقرأ «لم يُخفَ» ⇒ قطعٌ يُنسب إلى cancelB كذباً
    const ev = document.hidden ? [[true, performance.now()]] : [], onVis = () => ev.push([document.hidden, performance.now()]);
    document.addEventListener("visibilitychange", onVis);
    let r = null, how = null;
    try { r = await prep(LONG); r.total = LONG.split(/\s+/).length; r.speak(); how = await finish(r, 45000); }
    finally { document.removeEventListener("visibilitychange", onVis); }
    const hides = ev.filter((e) => e[0]).map((e) => Math.round(e[1] - r.t0));          // بزمن الجملة: سالبٌ = قبل الطلب
    r.vis = ev.length ? ev.map((e) => (e[0] ? "أُخفي@" : "ظهر@") + Math.round(e[1] - r.t0) + "ms").join(" ") : "لم يُخفَ";
    const prev = W.longA[W.longA.length - 1];
    // ⛔ الضابطةُ: تشغيلةٌ سابقةٌ هنا أُخفي تبويبُها بلا cancel فانتهت طبيعيّة — **وبلاها لا يُنسب القطعُ إلى cancelB**
    // ما دام التبويبُ أُخفي، فالإخفاءُ سببٌ كافٍ ثانٍ (قرار 26) · وبلاها قطعٌ بعد الإخفاء بأقلَّ من 500ms (🎯 قرار 96) ⛔.
    const ctl = W.longA.some((x) => x.how !== "timeout" && x.start !== null && x.err === null && x.hid);
    const near = hides.filter((t) => r.errAt !== null && t <= r.errAt && r.errAt - t < 500);
    r.hid = hides.length > 0; W.longA.push(r);
    const sum = (x) => (x.how === "timeout" ? "مهلة" : x.start === null ? "لم يبدأ" : x.err === null
      ? "طبيعيّ " + x.end + "ms" : "قُطع " + x.err + "@" + x.errAt + "ms") + " · إخفاء=" + x.vis;
    const cut = "قُطع (" + r.err + ") بعد " + r.errAt + "ms عند " + clock(r.wallEnd);
    const a = how === "timeout" ? "⛔ " + TMO(45)
      : r.start === null ? "⛔ لم يبدأ أصلاً (" + (r.err || "end بلا start") + ") — فلا شيءَ يُقطع"
      : r.err === null ? "✅ انتهى طبيعيّاً بعد " + r.end + "ms عند " + clock(r.wallEnd) + (!hides.length
        ? " ⚠️ ولم يُخفَ التبويبُ، فليست ضابطةً لتشغيلة cancelB" : prev && prev.start !== null && prev.err !== null
        ? " ⇒ ضابطةٌ تُتمّ القطعَ السابقَ هنا: الإخفاءُ وحدَه لم يقطع" : "")
      : ctl || !hides.length ? "❌ " + cut + " — قارِنه بوقت سطر cancelB · الضابطة: " + (ctl
        ? "✅ سابقةٌ هنا انتهت طبيعيّةً مع الإخفاء" : "لا تلزم: لم يُخفَ التبويب")
      : near.length ? "⛔ " + cut + " — بعد إخفاء التبويب بـ" + (r.errAt - near[near.length - 1]) + "ms ولا ضابطةَ هنا ⇒ الإخفاءُ لا يُستبعد"
      : "⚪ " + cut + " — **ولا ضابطةَ قبلها هنا** ⇒ لا يُنسب إلى cancelB حتى تُشغَّل longA مع إخفاءٍ بلا cancel";
    await emit(ID + "/longA " + a + " · بدأ الطلبُ " + clock(r.wall0) + " · الإخفاء: " + r.vis + " · " + facts(r) +
      " · السابقةُ هنا: " + (prev ? sum(prev) : "لا"));
  }
  function cancelB() {                  // ⚠️ cancel() عامّة: توقف أيَّ نطقٍ في المتصفّح كلِّه
    if (busy) { emit(ID + "/cancelB ⛔ رفض: حالةٌ جارية في هذه الصفحة نفسِها = " + busy +
      " — cancelB يُنادى من تبويبٍ آخر، وإلا قِيس غيرُ السؤال. ولم يُنادَ cancel()."); return; }
    const s0 = speechSynthesis.speaking, ua = navigator.userActivation, t = Date.now();
    speechSynthesis.cancel();
    emit(ID + "/cancelB ⚪ نُفّذ speechSynthesis.cancel() عند " + clock(t) + " — والحكمُ في سطر longA بالتبويب الآخر: " +
      "«قُطع» بوقتٍ قريبٍ من هذا ⇒ يقطع · speaking هنا قبلُ=" + s0 + " (نطقُ تبويبٍ آخر لا يُرى من هنا) · hasBeenActive=" +
      (ua ? ua.hasBeenActive : "لا واجهة") + " · مضيف=" + location.hostname);
  }
  async function pauseIdle() {
    const r = await prep(SHORT);
    const p0 = speechSynthesis.paused;
    let p1 = null, w = { start: null, end: null, err: "رميةٌ قبل القراءة" };
    try {
      speechSynthesis.pause();            // ⚠️ عامٌّ للمتصفّح كلِّه ⇒ يُرجَع في finally — ولو رمى ما بينهما
      p1 = speechSynthesis.paused;
      r.speak(); await within(r.go, 4000);
      w = { start: r.start, end: r.end, err: r.err };
    } finally {
      speechSynthesis.resume();           // قبل cancel(): جملتُنا ما زالت في طابور الصفحة فيصل النداء
      speechSynthesis.cancel();           // يُصفّر العَلَمَ العامّ ويوقف ما بدأ
    }
    const after = await within(r.done, 2000);
    const held = after === "timeout" ? "لا حدثَ خلال 2ث ⚠️ (فلا يثبت أنها احتُجزت لا ضاعت)"
      : (r.err || "end") + (r.start !== null ? " بعد start" : "") + " ⇒ محتجزةٌ لا ضائعة";
    drop(r);
    const v = await prep("انتهى الاختبار."); v.speak();   // تحقُّقُ الإرجاع: جملةٌ يجب أن تبدأ
    await within(v.go, 4000);
    const ok = v.start !== null, vwhy = v.err || (v.end !== null ? "end بلا start" : "بلا حدث");   // قبل التنظيف
    if (!ok) { speechSynthesis.resume(); speechSynthesis.cancel(); }
    await finish(v, 10000);
    // ⛔ «لم يبدأ» لا يُنسب إلى pause() إلا وجملةُ التحقّق تبدأ بعد الإرجاع — وإلا فصمتٌ بلا شاهدٍ موجب (قرار 26 · 150)
    const a = w.start !== null ? "❌ بعد pause() في السكون بدأ النطقُ (start بعد " + w.start + "ms) — لا يُسكت التالية"
      : w.end !== null || w.err !== null ? "⛔ انتهت الجملةُ في النافذة بلا start (" + (w.err || "end") + ") — لا يُحكم: أمكتومٌ التبويب؟"
      : !ok ? "⛔ لا يُحكم: لم يبدأ النطقُ خلال 4ث **ولا بدأت جملةُ التحقّق بعد الإرجاع** (" + vwhy + ") ⇒ الصمتُ لا يُنسب إلى pause()"
      : "✅ بعد pause() في السكون لم يبدأ النطقُ خلال 4ث، وبدأت جملةُ التحقّق بعد الإرجاع · وبعد resume()+cancel(): " + held;
    await emit(ID + "/pauseIdle " + a + " · speechSynthesis.paused: قبلُ=" + p0 + " · بعد pause()=" + p1 + " · الإرجاع: " +
      (ok ? "✅ جملةُ التحقّق بدأت بعد " + v.start + "ms" : "⛔ جملةُ التحقّق لم تبدأ خلال 4ث (" + vwhy +
        ") — أُعيد resume()+cancel(): شغّل solo()، وإن لم يبدأ فأعد تشغيل كروم (⌘Q على الماك · chrome://restart على الويندوز)") + " · " + facts(r) + " · " + wit());
  }
  async function mutedTab() {
    const r = await prep(SHORT); r.speak();
    const how = await finish(r, 30000);
    const a = how === "timeout" ? "⛔ لا start ولا end ولا error خلال 30ث — يخالف المقروء (end بلا start)؛ أُلغي بـcancel()"
      : r.start !== null ? "❌ بدأ النطق (start بعد " + r.start + "ms) — فالكتمُ لا يُسقطه، أو أنّ التبويب لم يُكتم"
      : r.err !== null ? "⛔ error=" + r.err + " بلا start — ليس ما يُنتجه الكتمُ في الكود (end بلا start) فلا يُحكم"
      : "✅ أُسقط: end بلا start بعد " + r.end + "ms ⇒ لا تُعدّ الجملةُ منطوقة";
    await emit(ID + "/mutedTab " + a + " · بشرط أنك كتمت التبويب قبلها (الصفحةُ لا ترى الكتم) · " + facts(r) + " · " +
      wit() + " · ⚠️ ألغِ كتمَ الموقع الآن");
  }
  async function videoMuted() {
    const vid = document.querySelector("#movie_player video") || document.querySelector("video");
    if (!vid) { await emit(ID + "/videoMuted ⛔ رفض: document.querySelector('video') = null — لا فيديو في هذه الصفحة"); return; }
    const st = "muted=" + vid.muted + " · volume=" + Number(vid.volume).toFixed(2) + " · paused=" + vid.paused;
    if (!(vid.muted || vid.volume === 0)) { await emit(ID + "/videoMuted ⛔ رفض: الفيديو غيرُ مكتوم (" + st +
      ") — اكتمه بزرّ الكتم في شريط المشغّل ثمّ أعِد"); return; }
    const r = await prep(SHORT); r.speak();
    const how = await finish(r, 30000);
    const a = how === "timeout" ? "⛔ " + TMO(30)
      : r.start !== null ? "⚪ 👁 الحكمُ لسمعك: بدأ النطقُ والفيديو مكتوم — إن سمعتَ الجملةَ فصوتُ الفيديو لا يمسّ النطق، وإلا فيمسّه"
      : r.err !== null ? "⛔ لم يبدأ: error=" + r.err + " — لا يُحكم"
      : "⛔ end بلا start ⇒ التبويبُ مكتومٌ على الأرجح (من mutedTab؟): ألغِ كتمَ الموقع وأعِد";
    await emit(ID + "/videoMuted " + a + " · الفيديو: " + st + " · " + facts(r) + " · " + wit());
  }

  // ⭐ **`&` على الويندوز (مراجعة 2026-11-05):** 📖 `tts_win.cc` يلفّ كلَّ نصٍّ بـ`<pitch …>` فيقرؤه SAPI XML، و`&` لا يُهرَّب (tts_win_utils: `<` و`>` وحدَهما)،
  // وترجمةٌ فيها «Q&A» تصل كما هي — **وماذا يفعل SAPI بها لم يقله مصدر** ⇒ يُقاس هنا قبل أيّ سطرٍ في المنتَج.
  // شاهدا قرار 26: **الضابطةُ بلا `&` يجب أن تبدأ وتنتهي، وإلا فلا حكم** · والجملةُ المهرَّبة هي ما سنُرسله إن فشلت الثانية. 👁 **وما بعد `&` لا يُرى إلا بالسمع**
  async function amp() {
    const CASES = [["ضابطة", "مرحبا بكم في البرنامج"], ["&", "مرحبا Q&A بكم في البرنامج"], ["&amp;", "مرحبا Q&amp;A بكم في البرنامج"]], got = [];
    for (const [name, text] of CASES) {
      const r = await prep(text); r.speak();
      const how = await finish(r, 15000);
      got.push({ name, how, r, ok: how === "end" && r.start !== null });
      await new Promise((res) => setTimeout(res, 400));
    }
    const [c0, c1, c2] = got, tail = got.map((x) => x.name + ": " + (x.how === "timeout" ? TMO(15) : facts(x.r))).join(" | ");
    const a = !c0.ok ? "⛔ لا يُحكم: الضابطةُ بلا `&` لم تبدأ وتنتهِ — أمكتومٌ التبويب؟"
      : !c1.ok ? "❌ جملةُ `&` فشلت والضابطةُ سليمة ⇒ يُهرَّب في المنتَج" + (c2.ok ? " (المهرَّبةُ سليمة)" : " ⚠️ والمهرَّبةُ فشلت أيضاً")
      : "⚪ 👁 الثلاثُ بدأت وانتهت — الحكمُ لسمعك: أقال الثاني «بكم في البرنامج» بعد Q&A، أم انقطع عندها؟ وماذا قال الثالث عند &amp;؟";
    await emit(ID + "/amp " + a + " · " + tail);
  }

  globalThis.vz168q = {
    solo: run("solo", solo, false, "جملةٌ قصيرة — يُفترض أن تسمعها"), cancelB,
    longA: run("longA", longA, false, "جملةٌ طويلة (~20ث) — انتقل الآن إلى التبويب «ب» كما في الخطوات"),
    pauseIdle: run("pauseIdle", pauseIdle, true, "pause() ثمّ جملة — يُفترض ألّا تسمعها، وبعد ~4ث تسمع «انتهى الاختبار»"),
    mutedTab: run("mutedTab", mutedTab, true, "جملةٌ والتبويبُ مكتوم — يُفترض ألّا تسمع شيئاً"),
    videoMuted: run("videoMuted", videoMuted, true, "جملةٌ والفيديو مكتوم — أصغِ: أتسمعها؟"),
    amp: run("amp", amp, true, "ثلاثُ جملٍ قصيرة، في الثانية Q&A — أصغِ: أتُكمل الثانيةُ بعدها؟")
  };
  console.log("🟢 " + ID + " مُثبَّت (سياق=" + ctx + ") — كلُّ حالةٍ تطبع سطراً واحداً «" + ID + "/…» وتنسخه؛ والخطواتُ في رأس الملفّ:\n" +
    "   vz168q.solo() — الشاهدُ الموجب، ابدأ به · vz168q.longA() — ~20ث: ضابطةً، ثمّ مع cancelB() من تبويبٍ آخر\n" +
    "   vz168q.cancelB() — ⚠️ cancel() عامّة: تُنادى في التبويب الآخر · vz168q.pauseIdle() — pause() في السكون ثمّ إرجاعٌ مقيس\n" +
    "   vz168q.mutedTab() — بعد أن تكتم التبويب بيدك · vz168q.videoMuted() — والفيديو مكتوم، والحكمُ لسمعك 👁\n" +
    "   vz168q.amp() — جملةٌ فيها & بعد ضابطةٍ بلاها (الويندوز)، والحكمُ لسمعك 👁");
  const ua0 = navigator.userActivation;
  if (!(ua0 && ua0.hasBeenActive)) console.log("🟡 " + ID + ": انقر مرّةً داخل الصفحة نفسِها (لا في الكونسول) قبل أيّ حالةٍ تنطق — وإلا رفضت بـ⛔ (cancelB لا تحتاجها).");
})();
