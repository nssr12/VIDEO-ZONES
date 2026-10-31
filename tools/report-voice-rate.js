// مِجَسّ 168أ-4 — **كم تُسرّع كلُّ سرعةٍ النطقَ فعلاً على هذا الجهاز، وكم يتأخّر بدؤه؟** يُلصق في كونسول أيّ صفحة http(s).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن طلبت الدبلجةُ من الصوت العربيّ أن
// يُسرع ضعفين، أيُسرع على جهازي ضعفين فعلاً — أم أقلَّ، أم لا يتحرّك أصلاً — وكم أنتظر
// قبل أن تبدأ الجملة؟»*
//
// ── لماذا يُقاس ولا يُحسب (AUDIT.md — القسم السابع عشر §٣ و§٩) ───────────────
// **المُجدوِلُ يشتقّ السرعةَ بقلب المنحنى المقيس لكلّ صوتٍ ونظام** — **وهذا المِجَسُّ هو ذلك
// المنحنى.** وما عندنا عنه **قراءةُ كودٍ (📖) لا قياس:** الويندوز يُرسل `trunc(10·log10 r)` درجةً
// إلى SAPI، كلُّ درجةٍ ×1.116 والعاشرةُ ×3 ⇒ **0.79–1.26 بلا أثر، و2 ⇐ نحو 1.39** · والماك خطّيٌّ
// حتى 4 ثمّ سقف. ⛔ **ولم يُقس شيءٌ منه داخل كروم، ولا على Hoda وNaayf.**
// ⇒ **فالسرعاتُ على الحدود:** عند كلّ حدٍّ من حدود SAPI العشرة أو فوقه بقليل (1.26 · 1.59 · 2 ·
// 2.52 · 3.17 · 3.99 · 5.02 · 6.31 · 7.95 · 10)، وجاراتٌ تحتها في الدرجة نفسِها (1.2 · 1.5 · 3 · 4).
// ⇒ **والمنحنى حقيقةٌ عن المضيف تُقاس** (قرار 96)، ⚠️ **وعتباتُ 5٪ و10٪ أدناه اختيارٌ (🎯).**
// ⇒ ويُطبع معدّلُ الكلمات عند 1× ليُقابَل بـ§٩: Majed نحو 80–84 وLaila نحو 97–99 — **مقيسان خارج كروم.**
//
// ── شاهدا قرار 26 — **ولا حكمَ لصوتٍ بلا الاثنين** ──────────────────────────────
//  · **سالب:** الجملةُ نفسُها بالسرعة 1 مرّتين ⇒ **مدّتان لا تفترقان بأكثرَ من 5٪**، وإلا ⛔
//    «القياسُ غيرُ ثابت» — **فلا يُنسب إلى السرعة فرقٌ هو ضجيج.**
//  · **موجب:** السرعةُ 2 **أقصرُ من 1 بـ10٪ على الأقلّ** — وإلا ⛔ «السرعةُ لا أثرَ لها»:
//    **الأداةُ لا ترى أو الصوتُ يتجاهلها، ولا يُفرَّق بينهما.**
// ⭐ **و«المنطقةُ الميّتة: نعم» و«سقف 4: نعم» صفران — «لا فرق» — فلا يُطبعان إلا بعد الموجب**
// (قرار 150). ⭐ **و`speak()` بلا رميةٍ و`start` بلا خطأ ليسا «السرعةُ وقعت»** (قرار 109) —
// **فالأثرُ يُقاس: المدّة.** **وكلُّ رفضٍ يُسمّي شرطَه بقيمته** (قرار 140).
//
// ── ⚠️ حدودٌ مُعلَنة ────────────────────────────────────────────────────────────
//  · **المدّةُ من `start` إلى `end` كما يُبلغهما المحرّك لا من الصوت المسموع** — وصمتُ الحافّتين
//    منها، فيضغط العاملَ عند السرعات العالية ⇒ **العاملُ لجملةٍ بهذا الطول (18 كلمة).**
//  · **البدءُ من `speak()` إلى `start`**، وقد يسبق `start` الصوتَ. **وجملةُ تحميةٍ قصيرةٌ تسبق كلَّ
//    صوتٍ ولا تدخل الحساب:** بدؤها «البارد»، **كي لا يُحمَّل شاهدُ الثبات كلفةَ تحميل الصوت.**
//  · **أيُّ صوتٍ نطق فعلاً لا يُرى:** كروم يختار غيرَه بصمتٍ إن غاب (📖) — **فاسمع.**
//  · **`cancel()` عامّةٌ لكلّ التبويبات (📖)** ⇒ **لا تُنادى إلا وجملتُنا الناطقة؛ ولا `pause()`/`resume()`.**
//  · لا تخزينَ ولا شبكةَ ولا عنصرَ في الصفحة، **وكلُّ مستمعٍ ومؤقّتٍ يُزال** (فواصلُ 300ms تنتهي
//    بنفسها). ⛔ **تشخيصيٌّ لا يُشحن، ويصير حارساً أو يُحذف بعد 168أ (قرار 70).**
//
// ── كيف يُستعمل ────────────────────────────────────────────────────────────────
//   1) افتح أيَّ صفحة http(s)، **وأوقف الفيديو، وارفع كتمَ التبويب** (المكتومُ يُنهي بلا `start`).
//   2) افتح الكونسول (F12). **السياقُ «top» من قائمة السياق في شريط الكونسول، أو اسمُ الإضافة.**
//   3) (اختياريّ) لصوتٍ واحد: اكتب أوّلاً في السياق نفسِه   globalThis.VZ_RATE_VOICE = "ماجد"
//      (الاسمُ أو جزءٌ منه كما يعرضه كروم — **بلغة واجهته، قِيس في مِجَسّ 2: «ماجد» لا Majed** — بين الأصوات
//      العربيّة وحدها، والرفضُ يسرد المتاح) — ويُلغى بـ  delete globalThis.VZ_RATE_VOICE
//   4) الصق هذا الملفّ كلَّه واضغط Enter. **إن طبع «انقر مرّةً داخل الصفحة» فانقر على مساحةٍ
//      فارغةٍ من الصفحة** — لا على الكونسول ولا على الفيديو (النقرُ عليه يُشغّله).
//   5) **لا تُغلق التبويب ولا تُشغّل صوتاً آخر:** تحميةٌ ثمّ 16 جملةً لكلّ صوتٍ عربيّ، نحو دقيقتين
//      إلى ثلاثٍ للصوت. جدولٌ ثمّ سطرُ حكمٍ لكلّ صوت، **والأسطرُ كلُّها تُنسخ إلى الحافظة.**
//   6) **إن خرج «غيرُ ثابت» فأعد اللصقَ مرّةً**؛ وإن تكرّر فذاك جوابٌ يُبلَّغ به.
(async () => {
  const N = "VZ-168أ-4";
  // ⚠️ **`copy` يُلتقط الآن متزامناً — احتياطٌ لا قياس:** أدواتُ الكونسول تُتاح أثناء التقييم،
  // وهذا المِجَسُّ يُكمل بعده بدقائق.
  const COPY = typeof copy === "function" ? copy : null;
  const RATES = [1, 1, 1.2, 1.26, 1.5, 1.59, 2, 2.52, 3, 3.17, 3.99, 4, 5.02, 6.31, 7.95, 10];
  const TEXT = "يُعَدُّ هذا النصُّ اختباراً بسيطاً لقياس سرعة النطق العربيّ في المتصفّح، " +
    "ويُقرأ بالصوت نفسه مرّاتٍ عدّةً بسرعاتٍ مختلفة.";
  const WORDS = TEXT.split(/\s+/).filter(Boolean).length, WAIT = 60000, MAX_ERR = 2;
  const ss = typeof speechSynthesis === "undefined" ? null : speechSynthesis;
  const out = [];
  let hidden = false;
  const emit = (glyph, body) => {            // الحافظةُ تحمل الأسطرَ كلَّها حتى الآن، لا آخرَها وحده
    out.push(N + " " + glyph + " " + body);
    console.log(out[out.length - 1]);
    const all = out.length > 1 ? " — الأسطرُ " + out.length + " كلُّها" : "";
    try { COPY(out.join("\n")); console.log("   (نُسخ إلى الحافظة" + all + ")"); } catch (e) {}
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const race = (p, ms) => new Promise((res) => {
    const t = setTimeout(() => res(null), ms);
    p.then((v) => { clearTimeout(t); res(v); }, () => { clearTimeout(t); res(null); });
  });
  const pct = (x) => (x * 100).toFixed(1) + "%", sec = (x) => (x === null ? "?" : x.toFixed(2));
  const rel = (x, y) => Math.abs(x - y) / y;
  // متوقَّعُ ويندوز (tts_win.cc): الدرجةُ trunc(10·log10 r)، وكلُّ درجةٍ ×3^(1/10).
  // و`rate` في WebIDL من نوع float ⇒ `Math.fround` أوّلاً، فهكذا يصل إلى كروم.
  const winExp = (r) => Math.pow(3, Math.trunc(10 * Math.log10(Math.fround(r))) / 10);

  // ── السياقُ والبيئة — يُطبعان في كلّ سطر حكم ─────────────────────────────────
  const ctx = location.protocol === "chrome-extension:" ? "صفحة-الإضافة"
    : typeof globalThis.extensionActive === "function" ? "عالم-الإضافة" : "عالم-الصفحة";
  const uad = navigator.userAgentData;
  const h = uad && typeof uad.getHighEntropyValues === "function" ? await race(uad.getHighEntropyValues(
    ["platform", "platformVersion", "architecture", "bitness", "fullVersionList"]), 3000) : null;
  let env = "بيئة: " + navigator.userAgent;
  if (h) {
    const pv = String(h.platformVersion || ""), mj = parseInt(pv, 10), a = h.architecture, b = h.bitness;
    const L = h.fullVersionList || [];
    const br = L.find((x) => x.brand === "Google Chrome") || L.find((x) => x.brand === "Chromium") ||
      L.find((x) => !/not.?a.?brand/i.test(x.brand)) || { brand: "?", version: "?" };
    env = "بيئة: " + (h.platform === "Windows" ? "Windows " + (mj >= 13 ? "11" : mj > 0 ? "10" : "≤8.1") + " (" + pv + ")"
      : h.platform + " " + pv.split(".").slice(0, 2).join(".")) + " " +
      (a === "x86" ? (b === "64" ? "x64" : "x86") : a === "arm" ? (b === "64" ? "arm64" : "arm") : a || "?") +
      " · " + (br.brand === "Google Chrome" ? "Chrome" : br.brand) + " " + br.version;
  }
  const tail = " · " + env + " · سياق=" + ctx;

  // ── ⛔ الرفض: كلٌّ باسم شرطه وقيمته، ولا يُجمع شرطان في رسالة ───────────────
  if (ctx === "صفحة-الإضافة") return emit("⛔", "السياق = صفحة-الإضافة (" + location.pathname + ") — المطلوب: " +
    "عالم-الصفحة أو عالم-الإضافة على صفحة http(s)؛ افتح صفحةَ ويبٍ وأعد اللصق." + tail);
  if (!/^https?:$/.test(location.protocol)) {
    return emit("⛔", "البروتوكول = " + location.protocol + " — المطلوب: http: أو https:." + tail);
  }
  if (!ss || typeof SpeechSynthesisUtterance === "undefined") {
    return emit("⛔", "speechSynthesis = غائب في " + ctx + " — لا نطقَ يُقاس هنا." + tail);
  }
  if (globalThis.__vz168a4 === true) return emit("⛔", "__vz168a4 = true — نسخةٌ أخرى من هذا المِجَسّ " +
    "تعمل هنا؛ انتظر سطرَها أو أعد تحميل الصفحة." + tail);
  if (ss.speaking || ss.pending || ss.paused) return emit("⛔", "طابورُ هذي الصفحة غيرُ فارغ: speaking=" +
    ss.speaking + " · pending=" + ss.pending + " · paused=" + ss.paused + " — أعد تحميل الصفحة ثمّ الصق " +
    "(ولا pause()/resume() منّا)." + tail);
  const want = globalThis.VZ_RATE_VOICE;
  if (want !== undefined && typeof want !== "string") return emit("⛔", "VZ_RATE_VOICE = " + String(want) +
    " (" + typeof want + ") — المطلوب نصٌّ باسم الصوت، مثل \"Majed\"." + tail);

  // ── الأصوات بعد وصولها كاملةً — **قائمةٌ فارغةٌ أو ناقصة «لا أرى» لا «لا يوجد»** (قرار 150) ──
  // ⛔ **وتصل دفعتين** (قِيس في مِجَسّ 2: 19 صوتاً شبكيّاً بلا عربيّ @8ms، ثمّ أصواتُ النظام @1.5ث) ⇒ أوّلُ قائمةٍ
  // غيرِ فارغة كانت ستطبع ❌ كاذباً ⇒ **يُنتظر صوتٌ محلّيٌّ وسكونُ القائمة ثانيةً، والسقفُ 10 ث** (🎯 قرار 96)
  const loadVoices = async () => {
    const t0 = performance.now();
    let sig = "", at = t0;
    for (;;) {
      const l = ss.getVoices() || [], s = l.map((v) => v.voiceURI + "|" + v.lang).join(","), t = performance.now();
      if (s !== sig) { sig = s; at = t; }
      if ((l.some((v) => v.localService) && t - at >= 1000) || t - t0 >= 10000) return l;
      await sleep(250);
    }
  };
  // ⛔ **بوسم اللغة الأوّل تماماً لا بجزءٍ من الاسم** — درس #161: «ar» يطابق «Bulgarian».
  const isAr = (v) => (v.lang || "").toLowerCase().split(/[-_]/)[0] === "ar";

  // ── التفاعل: النطقُ يحتاجه، واللصقُ في الكونسول ليس تفاعلاً مع الصفحة ─────────
  const activation = () => new Promise((res) => {
    const ua = navigator.userActivation;
    if (!ua || ua.hasBeenActive) { res(true); return; }
    console.log("🟡 " + N + ": انقر مرّةً داخل الصفحة — على مساحةٍ فارغة، لا الكونسول ولا الفيديو " +
      "(النطقُ يحتاج تفاعلاً سابقاً؛ أنتظر 120 ث).");
    const EV = ["pointerdown", "click"];   // click احتياطاً: لمسٌ أو قلمٌ يُفعَّل عند الرفع لا الضغط
    const on = () => { if (ua.hasBeenActive) fin(true); };
    const fin = (ok) => { clearTimeout(t); EV.forEach((e) => removeEventListener(e, on, true)); res(ok); };
    EV.forEach((e) => addEventListener(e, on, true));
    const t = setTimeout(() => fin(false), 120000);
  });

  // ── جملةٌ واحدة: المستمعون قبل speak() — `not-allowed` يُطلَق متزامناً داخلها ──
  const KEEP = [];   // ⚠️ كروم قد يجمع الكائنَ قبل `end` فيضيع الحدث — يُمسَك حتى ينتهي
  const speakOnce = (voice, rate, text) => new Promise((res) => {
    const u = new SpeechSynthesisUtterance(text);
    const r = { rate: rate, lat: null, dur: null, err: "" };
    let t0 = 0, ts = 0, over = false, timer = 0;
    const fin = (err, dur) => {
      if (over) return;
      over = true; clearTimeout(timer); r.err = err; r.dur = dur === undefined ? null : dur;
      const i = KEEP.indexOf(u); if (i >= 0) KEEP.splice(i, 1);
      res(r);
    };
    u.voice = voice; u.lang = voice.lang; u.rate = rate; u.pitch = 1; u.volume = 0.8;
    u.onstart = () => { ts = performance.now(); r.lat = Math.round(ts - t0); };
    // ⭐ **`end` بلا `start` ليس نطقاً** — هكذا يُنهي كروم الجملةَ في تبويبٍ مكتوم.
    u.onend = () => fin(ts ? "" : "end-بلا-start", ts ? (performance.now() - ts) / 1000 : null);
    u.onerror = (e) => fin((e && e.error) || "error");
    KEEP.push(u);
    // ⛔ بلا start ⇒ جملتُنا خلف غيرها فلا إلغاء · وبين start وend ⇒ هي الناطقة ⇒ الإلغاءُ لنا وحدنا
    timer = setTimeout(() => { fin(ts ? "مهلة-بلا-end" : "مهلة-بلا-start"); if (ts) ss.cancel(); }, WAIT);
    t0 = performance.now();
    ss.speak(u);
  });

  // ── الحكم لصوتٍ واحد: الإبطالاتُ أوّلاً، ثمّ الشاهدان، ثمّ الصفران ─────────────
  const WHY = { "not-allowed": "لا تفاعلَ مقبول", "end-بلا-start": "التبويبُ مكتوم؟", "interrupted": "قاطعه نطقٌ آخر",
    "canceled": "أُلغي من خارجنا", "audio-busy": "جهازُ الصوت مشغول", "voice-unavailable": "الصوتُ غيرُ متاح",
    "مهلة-بلا-end": "لم ينتهِ خلال 60 ث فأُلغي" };
  const verdict = (v, warm, rows, errs, left) => {
    const at = (k) => (rows[k] && !rows[k].err ? rows[k].dur : null);
    const a = at(0), b = at(1), d2 = at(RATES.indexOf(2)), d1 = a !== null && b !== null ? (a + b) / 2 : null;
    const bad = rows.filter((r) => r.err);
    const lats = rows.filter((r) => r.lat !== null).map((r) => r.lat).sort((x, y) => x - y);
    console.table([warm].concat(rows).map((r, i) => ({ "سرعة": i ? r.rate : "1 (تحمية)",
      "متوقَّع-ويندوز": i ? +winExp(r.rate).toFixed(3) : null, "بدء ms": r.lat,
      "مدّة ث": r.dur === null ? null : +r.dur.toFixed(3),
      "عامل مقيس": i && d1 && r.dur !== null ? +(d1 / r.dur).toFixed(3) : null, "خطأ": r.err || "—" })));
    const raw = "مدّة 1×=" + sec(a) + "/" + sec(b) + "ث · 2×=" + sec(d2) + "ث · عوامل[سرعة:مقيس/متوقَّع-ويندوز] " +
      (rows.slice(2).map((r) => r.rate + ":" + (r.err ? "خطأ" : d1 ? (d1 / r.dur).toFixed(2) : "?") + "/" +
        winExp(r.rate).toFixed(2)).join(" · ") || "—") +
      " · بدء: بارد=" + (warm.lat === null ? "?" : warm.lat + "ms") + " وسيط=" +
      (lats.length ? lats[lats.length >> 1] + "ms أقصى=" + lats[lats.length - 1] + "ms" : "? أقصى=?") +
      " · أخطاء=" + (bad.length ? bad.map((r) => r.rate + ":" + r.err).join(" · ") : "0") +
      (warm.err ? " · تحمية=" + warm.err : "") + (hidden ? " · ⚠️ خُفيت الصفحةُ أثناء القياس" : "");
    const head = "صوت=" + v.name + " (" + v.lang + (v.localService ? " · محلّيّ" : " · شبكيّ") + ")" + tail + " — ";
    if (left) {
      emit("⛔", head + "مهلة " + WAIT / 1000 + " ث بلا start: الطابورُ عالقٌ خلف نطقٍ آخر أو pause() عامّ من تبويبٍ " +
        "آخر. لم نُلغِ — cancel() عامّةٌ لكلّ التبويبات؛ أعد تحميل الصفحة لتسقط جملتُنا ⇒ " + raw);
      left.forEach((x) => emit("⚪", "صوت=" + x.name + " (" + x.lang + ")" + tail + " — لم يُقس: توقّف القياسُ عند " +
        v.name + "."));
      return;
    }
    if (errs > MAX_ERR) return emit("⛔", head + "أخطاء " + errs + " > " + MAX_ERR + " ⇒ لا حكم (" +
      [...new Set(bad.map((r) => r.err))].map((c) => c + (WHY[c] ? " = " + WHY[c] : "")).join(" · ") + ") ⇒ " + raw);
    const miss = [a === null && "1× الأولى", b === null && "1× الثانية", d2 === null && "2×"].filter(Boolean);
    if (miss.length) return emit("⛔", head + "شاهدٌ غائب — انتهت بخطأ: " + miss.join(" · ") + " ⇒ لا حكم ⇒ " + raw);
    const wpm = Math.round(WORDS / (d1 / 60)), neg = Math.abs(a - b) / d1, pos = 1 - d2 / d1;
    if (d1 < 2) return emit("⛔", head + "مدّة 1× = " + sec(d1) + "ث لـ" + WORDS + " كلمة (" + wpm +
      " كلمة/دقيقة) — أقصرُ من أن تكون نطقاً؛ أنطق الصوتُ فعلاً؟ ⇒ " + raw);
    if (neg > 0.05) return emit("⛔", head + "القياسُ غيرُ ثابت: مدّتا 1× تفترقان " + pct(neg) +
      " > 5% (الشاهدُ السالب) — أعد اللصق مرّةً ⇒ " + raw);
    if (pos < 0.1) return emit("⛔", head + "السرعةُ لا أثرَ لها — الأداةُ لا ترى أو الصوتُ يتجاهلها: 2× أقصرُ " +
      "من 1× بـ" + pct(pos) + " < 10% (الشاهدُ الموجب) ⇒ " + raw);
    // ✅ **الشاهدان قاما ⇒ الصفران يُطبعان الآن** (قرار 150)
    const dz = at(RATES.indexOf(1.2)), c4 = at(RATES.indexOf(4)), c5 = at(RATES.indexOf(5.02));
    const dev = rows.slice(2).filter((r) => !r.err).map((r) => ({ r: r.rate, x: rel(d1 / r.dur, winExp(r.rate)) }))
      .sort((p, q) => q.x - p.x)[0];
    const same = (x, y, name) => (x === null || y === null ? "؟ (" + name + " بخطأ)"
      : (rel(x, y) <= 0.05 ? "نعم" : "لا") + " (" + pct(rel(x, y)) + ")");
    emit("✅", head + "شاهد−=✅ مدّتا 1× تفترقان " + pct(neg) + " · شاهد+=✅ 2× أقصرُ بـ" + pct(pos) +
      " · منطقة 0.79–1.26 الميّتة: " + same(dz, d1, "1.2") + " · سقف 4: " + same(c5, c4, "4 أو 5.02") +
      " · 1× ≈ " + wpm + " كلمة/دقيقة" + (dev ? " · أقصى انحرافٍ عن متوقَّع-ويندوز " + pct(dev.x) + " عند " + dev.r : "") +
      " ⇒ " + raw);
  };

  // ── التشغيل: صوتاً صوتاً وجملةً جملةً — التاليةُ بعد end أو خطأ لا قبلهما ─────
  const run = async () => {
    const all = await loadVoices();
    const local = all.filter((v) => v.localService).length;
    if (!all.length) return emit("⛔", "getVoices() = 0 بعد 10 ث — القائمةُ لم تُحمَّل، " +
      "و«لا أرى» ليست «لا يوجد» (قرار 150)." + tail);
    const ar = all.filter(isAr), w = (want || "").trim().toLowerCase();
    if (!ar.length && !local) return emit("⛔", "صفرُ صوتٍ عربيّ ولا صوتَ محلّيّاً بين " + all.length + " بعد 10 ث — " +
      "أصواتُ النظام لم تصل (القائمةُ شبكيّةٌ وحدَها) ⇒ «لا يوجد» و«لم يصل» صفرٌ واحد (قرار 150): أعد اللصق." + tail);
    if (!ar.length) return emit("❌", "لا صوتَ عربيّ — " + all.length + " صوتاً في القائمة منها " + local + " محلّيّاً " +
      "(فأصواتُ النظام وصلت والأداةُ ترى) وليس بينها وسمُ لغةٍ أوّلُه ar ⇒ مِجَسّ 168أ-2؛ وعلى الويندوز أعد تشغيلَ " +
      "كروم بعد تثبيت الصوت." + tail);
    const exact = ar.filter((v) => v.name.toLowerCase() === w);
    const pick = !w ? ar : exact.length ? exact : ar.filter((v) => v.name.toLowerCase().includes(w));
    if (!pick.length) return emit("⛔", "VZ_RATE_VOICE = \"" + want + "\" لا يطابق صوتاً عربيّاً — المتاح: " +
      ar.map((v) => v.name).join(" · ") + tail);
    if (!(await activation())) return emit("⛔", "userActivation.hasBeenActive = false بعد 120 ث — لم تقع نقرةٌ " +
      "في الصفحة، ولا نطقَ بلا تفاعل." + tail);
    console.log("🟢 " + N + ": بدأ القياس — " + pick.map((v) => v.name).join(" · ") + " — تحميةٌ ثمّ " +
      RATES.length + " جملةً لكلّ صوت. لا تُغلق التبويب.");
    for (let vi = 0; vi < pick.length; vi++) {
      const v = pick[vi], rows = [];
      hidden = document.visibilityState === "hidden";
      const warm = await speakOnce(v, 1, "تجربة.");
      let errs = 0, stuck = warm.err === "مهلة-بلا-start";
      for (let i = 0; i < RATES.length && !stuck && errs <= MAX_ERR; i++) {
        await sleep(300);
        const r = await speakOnce(v, RATES[i], TEXT);
        rows.push(r);
        errs += r.err ? 1 : 0;
        stuck = r.err === "مهلة-بلا-start";
        console.log((r.err ? "🟡 " : "🟢 ") + N + " [" + v.name + "] " + (i + 1) + "/" + RATES.length + " · سرعة " +
          r.rate + " · " + (r.err ? "خطأ: " + r.err : "بدء " + r.lat + "ms · مدّة " + sec(r.dur) + "ث"));
      }
      verdict(v, warm, rows, errs, stuck ? pick.slice(vi + 1) : null);
      if (stuck) return;
    }
  };

  globalThis.__vz168a4 = true;
  const onVis = () => { if (document.visibilityState === "hidden") hidden = true; };
  document.addEventListener("visibilitychange", onVis);
  try { await run(); } catch (e) {
    emit("⛔", "عطبٌ في المِجَسّ نفسِه لا في جهازك: " + ((e && e.message) || e) + " — أبلِغ بهذا السطر." + tail);
  } finally { delete globalThis.__vz168a4; document.removeEventListener("visibilitychange", onVis); }
})();
