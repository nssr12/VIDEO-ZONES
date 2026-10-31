// مِجَسّ 168أ-8 — **ما مساراتُ النصّ والصوت لهذا الفيديو، وأيَّ طريقٍ ستسلكه الدبلجةُ معه؟** يُلصق في كونسول صفحة المشاهدة على يوتيوب، والسياقُ top (عالمُ الصفحة).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أضغط «دبلِج» على هذا الفيديو — أيقترح عليّ يوتيوب صوتاً
// عربيّاً جاهزاً، أم تُنطق ترجمتُه العربيّة كما هي، أم يُترجَم نصُّه، أم يُرفض؟ ولماذا هذا لا ذاك؟»*
//
// ── لماذا يُقاس قبل أيّ بناء (AUDIT القسم السابع عشر §٣ «اختيارُ المسار» · §٦ صفّ 8) ───────────────
// **168ج يختار طريقه من ردّ المشغّل نفسِه**، ودالّتا الصوت (getAvailableAudioTracks · getAudioTrack) **في كود
// المشغّل وغيرُ موثّقتين** (📖) ⇒ **شكلُهما يُقاس ويُطبع هنا قبل أن يُبنى عليه.** **وترتيبُ §٣ دالّةٌ نقيّةٌ هنا
// حرفاً** ⇒ **يرى المالكُ ما كانت الدبلجةُ ستفعل بكلّ فيديو قبل أن تُكتب** (قرار 109: «أوقع الأثر؟» لا «أموجود؟»).
// **ويُقرأ السبب — ردُّ المشغّل — لا الأثر:** قائمةُ ⚙ المرئيّة شاهدُ عينٍ لا مصدر (قرار 48).
// ⛔ **وعالمُ الصفحة وحدَه:** المعزولُ يرى عنصرَ #movie_player ولا يرى دوالَّه (📐 AUDIT) ⇒ «VIDEO ZONES» يُرفض
// باسمه، **وكذا الإطارُ الداخليّ والمضيفُ والمسار — كلٌّ بقيمته** (قرار 140).
// ⚠️ **وما يتجاوز §٣ يُسمّى:** (أ) **البثُّ قبله** — §٢ يُخرجه، وإلا طبعت تلقائيّةُ البثّ «تُقسَّم…» عن بثٍّ لا نُدبلجه ·
// (ب) **«لا قاعدة»** — يدويّةٌ بغير لغة الكلام أو بلغةٍ مجهولة ولا تلقائيّة: **مخرجٌ ليس فيه، فلا يُطبع باسم غيره** ·
// (ج) **يدويّةٌ ar والكلامُ عربيّ ⇒ §٣ يقول «تُنطق كما هي»** عربيّاً فوق عربيّ لأنّ (٢) قبل (٣) — **يُوسَم ⚠️ ولا
// يُصحَّح: الترتيبُ للمالك.**
//
// ── ⛔ الشاهدان — ولا قرارَ بدونهما (قرار 26 · قرار 150) ──────────────────────────────────────────
//  · **سالب:** خمسةُ مدخلاتٍ اصطناعيّة تمرّ بالدوالّ نفسِها قبل الحقيقيّ — صوتٌ عربيٌّ جارٍ ⇐ «لا دبلجة» · تلقائيّةٌ
//    إنجليزيّةٌ وحدَها ⇐ «تُقسَّم…» · يدويّةٌ ar بـexp=xpe ⇐ «تُنطق كما هي» **وملخَّصُها «مقفل»** · **وحارسان:** بثٌّ
//    بتلقائيّة ⇐ «بثّ» · فخاخُ «Bulgarian» (درس #161) وtlang=ar وvariant ⇐ «تُقسَّم…» ⇒ **وإلا ⛔ ولا يُقرأ الفيديو.**
//  · **موجب (البصر):** getPlayerResponse دالّة · videoId = v الرابط (بعد تنقّلٍ قد يحمل المشغّلُ سابقَه) · playability=OK
//    · **وصوتٌ مرئيّ: صيغةُ صوتٍ في streamingData أو مسارٌ بلغةٍ معروفة** — ⛔ **وإلا فـ«مسارٌ واحد» و«لا أرى» صفرٌ
//    واحد.** وزرُّ CC يُطبع بجانب عدد مسارات النصّ: **صفرٌ والزرُّ مرئيٌّ تناقضٌ يُقرأ.**
//  · **والزوجُ بالعين (👁) شاهدُ قارئ الصوت:** فيديو تُظهر قائمتُه العربيّةَ ⇐ «عربيٌّ في الصوت=نعم» · فيديو بمسار
//    صوتٍ واحد ⇐ 0 أو 1. **سطرٌ واحدٌ لا يُثبت أن القارئ يرى؛ الزوجُ يُثبته.**
//  · ✅ قياسٌ صالحٌ بشاهدَيه **أيّاً كان القرار** · ⛔ رفضٌ (والإعلانُ منه، كمِجَسَّي 7 و5) أو قياسٌ باطل — **ولا ❌: السؤالُ وصفٌ لا نعم/لا.**
//    **و«لغةٌ معروفة» = وسمٌ أوّلُ من حرفين أو ثلاثة** ⛔ **ما عدا «und»** (2026-11-01: `س17` عدّه لغة — فقد يرفض الشاهدُ الآن صفحةً لا يرى فيها إلا «und»)
//    **ولكلّ مسارٍ مرّة** (الجاري لا يُعدّ ثانيةً) — قيمةٌ من شكلٍ غيرِ متوقَّع («[object…» · «4») لا تُثبت البصر.
//
// ── ⚠️ حدودٌ مُعلَنة ──────────────────────────────────────────────────────────────────────────
//  · **شكلُ مسار الصوت غيرُ موثّق** ⇒ كلُّ خاصّيّةٍ تُقرأ حقلاً أو دالّةً (id · id() · getId())، **ويُطبع شكلُه**
//    (مفاتيحُه ودوالُّ نموذجه الأوّل) لـ168ج — والمصغَّرُ منها أسماءٌ بلا معنى.
//  · **«افتراضيّ» كما يَسِمه يوتيوب** (audioIsDefault · isDefault)، وقد يتبع «لغاتِك المفضّلة» لا الأصل (📄 §٩) ⇒ **لغةُ
//    الكلام من التلقائيّة ثمّ الافتراضيّ** (نصُّ الخطة)، **ويُطبع مصدرُها، والأصليُّ (acont) إن خالفها.**
//  · **«مقفل» = exp=xpe أو xpv في baseUrl لا غير** (📄)، وما عداهما من exp يُعدّ ولا يُحكم · **ولا يُطبع رابط.**
//  · ⭐ 📐 **xtags مرمَّزةٌ في معرّف المسار لا نصّاً (2026-10-31، أوّلُ أسطر المالك):** «251;Cg8KBWFjb250…» = itag؛ ثمّ base64 لـprotobuf
//    أزواجِه {1:{1:مفتاح,2:قيمة}} ⇐ «acont=dubbed:lang=ar» · «acont=original:drc=1:lang=de-DE» — ⛔ ~~acont يُقرأ نصّاً من xtags~~ فصمت
//    «والأصليُّ» حيث كان يجب أن يتكلّم ⇒ **يُفكّ هنا ويُختبر قبل الحقيقيّ بمعرّفٍ معلوم الجواب**، و«دبلجةٌ آليّة» من isAutoDubbed()
//    أيضاً · **و«الجاري» يُطبع بلغته وacont لا بمعرّفه** · ⛔ ~~**و«مرئيّ» بالشفافية والإخفاء**~~ — سُحب 2026-11-01 (قرار 21): شريطُنا «القريب» يُخفي
//    بالشفافية فصار «مرئيّ=false» عند المالك في كلّ لصقة وسقط شاهدُ «صفرٌ والزرُّ مرئيّ» ⇒ **«مرئيّ» = مُصيَّرٌ (checkVisibility())، والشفافيةُ حقلٌ
//    ثانٍ «·مُعتَم»** · **ومعرّفٌ فيه «;» لا يُفكّ يُطبع خامّاً بحروفه** (لا يُخفض ولا يُسقط) و«·xtags؟».
//  · **البثّ = isLive وحدَه** (المنتهي isLiveContent يُطبع) · **وخ12 لم يُقرَّر ⇒ لغةُ الكلام تُطبع ولا تُحكم.**
//  · **ردُّ المشغّل كما يحمله الآن لا جلبٌ جديد** · صفرُ شبكةٍ ونقرةٍ وsetOption وتخزين · لا مستمعَ ولا مراقب، ومؤقّتٌ
//    واحد (مهلةُ البيئة) يُزال · **و3 ث و40 حرفاً و12 مساراً و8 أصواتٍ اختياراتٌ لا قياس (قرار 96).**
//
// ── كيف يُستعمل ─────────────────────────────────────────────────────────────────────────────
//   1) افتح فيديو على https://www.youtube.com/watch وانتظر **الفيديوَ نفسَه** — إن بدأ إعلانٌ فبعد انتهائه.
//   2) الكونسول (⌥⌘J على الماك · F12 على الويندوز) ⇒ قائمةُ السياق في شريطه ⇒ **top** — ⛔ **لا VIDEO ZONES.**
//   3) الصق الملفَّ كلَّه ثمّ Enter ⇒ جدولان للعين، ثمّ سطرٌ واحدٌ يبدأ بـ VZ-168أ-8 **يُنسخ وحدَه** — بلا نقرةٍ ولا
//      انتظار. وإن قال «أعد تحميل الصفحة» فأعِده (⌘R · F5) والصق ثانيةً.
//   4) **الزوج:** (أ) فيديو تُظهر فيه قائمةُ الإعدادات ⚙ في شريط المشغّل بندَ لغة الصوت وبين لغاته العربيّة 👁 —
//      **واكتب معه ما رأيتَ في القائمة** · (ب) فيديو ليس فيه ذلك البند (مسارُ صوتٍ واحد). **أرسل السطرين.**
//   5) والويندوزُ غيرُ مطلوبٍ له (§٥: 1–6 و10) — ومعه اقرأ «لغاتِك المفضّلة» في إعدادات يوتيوب 👁 وأرسلها (§٦ صفّ 8).
(async () => {
  const TAG = "VZ-168أ-8";
  const COPY = typeof copy === "function" ? copy : null;   // ⛔ يُمسَك قبل أوّل await — بعده تختفي (📐 الدفعة الأولى)
  const emit = function (line) { console.log(line); try { COPY(line); console.log("   (نُسخ إلى الحافظة)"); } catch (e) {} };
  const errName = function (e) { return e ? String(e.name || "Error") + (e.message ? ": " + String(e.message).slice(0, 90) : "") : "؟"; };
  // العلاماتُ الخفيّة تُكتب ولا تُخفى (مِجَسّ 2: «ليلى» يبدأ بـU+200F) — والقصُّ قبلها كي لا يُشطر رمزٌ · ⛔ والنطاقُ بالترميز لا بالحرف (U+202E يقلب عرضَ السطر)
  const vis = function (s) { return String(s).replace(/[\u061C\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g,
    function (c) { return "⟨U+" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") + "⟩"; }); };
  const cut = function (s, n) { s = String(s == null ? "" : s); return vis(s.length > n ? s.slice(0, n) + "…" : s); };
  const str = function (x) {
    if (x == null || typeof x !== "object") return x == null ? "" : String(x);
    try { return JSON.stringify(x).slice(0, 40); } catch (e) { return "[كائن]"; }
  };
  // ⭐ اللغةُ = الوسمُ الأوّل تماماً (درس #161: «ar» يطابق «Bulgarian») — «en-US.4» ⇐ en · «ar.10» ⇐ ar
  const prim = function (tag) { return String(tag || "").split(".")[0].split(/[-_]/)[0].toLowerCase(); };
  const list = function (a, f, n) { return a.slice(0, n).map(f).join(" · ") + (a.length > n ? " · +" + (a.length - n) : ""); };
  const within = function (pr, n) { let t = 0;
    return Promise.race([pr, new Promise(function (r) { t = setTimeout(r, n, null); })]).finally(function () { clearTimeout(t); }); };

  // ── البيئة — كالدفعة الأولى: «بيئة: macOS 26.2 arm64 · Chrome 156.0.8078.48» ─────────────────
  let env = "بيئة: UA=" + navigator.userAgent;
  try {
    const uad = navigator.userAgentData;
    const h = uad && typeof uad.getHighEntropyValues === "function" ? await within(uad.getHighEntropyValues(
      ["platform", "platformVersion", "architecture", "bitness", "fullVersionList"]), 3000) : null;
    if (h) {
      const L = h.fullVersionList || [];
      const b = ["Google Chrome", "Microsoft Edge", "Chromium"].map(function (n) { return L.find(function (x) { return x.brand === n; }); })
        .find(Boolean) || L[0] || { brand: "؟", version: "؟" };
      let ver = String(h.platformVersion || "؟");
      if (h.platform === "Windows") { const mj = parseInt(ver, 10); ver = (mj >= 13 ? "11" : mj > 0 ? "10" : "؟") + " (" + ver + ")"; }
      else ver = ver.replace(/(\.0)+$/, "");
      const arch = h.architecture === "x86" ? (h.bitness === "64" ? "x64" : "x86") : (h.architecture || "؟") + (h.bitness === "64" ? "64" : "");
      env = "بيئة: " + (h.platform || "؟") + " " + ver + " " + arch + " · " + String(b.brand).replace(/^Google /, "") + " " + b.version;
    } else env += " (UA-CH غائبٌ أو بلا جوابٍ خلال 3 ث)";
  } catch (e) { env += " (UA-CH: " + errName(e) + ")"; }

  // ── ⓪ السياق: عالمُ الصفحة وحدَه، وما عداه يُرفض بشرطه وقيمته (قرار 140) — وبلا مستندٍ رفضٌ مُسمّى لا «رمى» ──
  if (typeof document === "undefined") { emit(TAG + " ⛔ · لا مستندَ هنا: typeof document = undefined (عاملُ خدمة؟) — المطلوب عالم-الصفحة («top») على www.youtube.com/watch · " + env); return; }
  const ext = location.protocol === "chrome-extension:";
  const ours = typeof globalThis.extensionActive === "function";
  const rid = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) || "";
  const ctx = ext ? "صفحة-الإضافة" : ours ? "عالم-الإضافة" : rid ? "عالم-إضافةٍ-أخرى" : "عالم-الصفحة";
  const p = ext ? null : document.querySelector("#movie_player");
  const v = new URLSearchParams(location.search).get("v") || "";
  const gpr = p ? typeof p.getPlayerResponse : "لا عنصرَ #movie_player";
  const bad = [];
  if (ctx !== "عالم-الصفحة") bad.push("السياق = " + ctx + (ctx === "عالم-إضافةٍ-أخرى" ? " (chrome.runtime.id=" + rid + ")" : "") +
    " — المطلوب عالم-الصفحة («top» في قائمة سياق الكونسول)");
  if (window.top !== window) bad.push("الإطار = داخليّ (" + location.hostname + cut(location.pathname, 40) + ") — المطلوب الإطارُ الأعلى");
  if (!/^(www\.)?youtube\.com$/.test(location.hostname)) bad.push("المضيف = " + (location.hostname || location.protocol) + " — المطلوب www.youtube.com");
  if (location.pathname !== "/watch") bad.push("المسار = " + cut(location.pathname, 40) + " — المطلوب /watch");
  else if (!v) bad.push("v = غائبٌ من الرابط — المطلوب /watch?v=…");
  if (gpr !== "function") bad.push("typeof #movie_player.getPlayerResponse = " + gpr +
    (ours && p ? " (العالمُ المعزول يرى العنصرَ لا دوالَّه)" : "") + " — المطلوب function");
  if (bad.length) { emit(TAG + " ⛔ · رفضٌ قبل القياس (السياقُ المكتشف " + ctx + "): " + bad.join(" · ") + " · " + env); return; }
  console.log("🟢 " + TAG + " يعمل — عالمُ الصفحة؛ يقرأ ردَّ المشغّل بلا شبكةٍ ولا نقرة…");

  // ── (ب) مسارُ النصّ ⇐ لغة · نوع · مقفل · مُتخطّى — من baseUrl بلا طباعته ─────────────────────
  const trackOf = function (t) {
    let q;
    try { q = new URL(String(t.baseUrl || ""), location.origin).searchParams; } catch (e) { q = new URLSearchParams(""); }
    const exp = q.getAll("exp").join(",").split(",").filter(Boolean);
    const nm = t.name ? t.name.simpleText || (t.name.runs || []).map(function (r) { return r.text; }).join("") : "";
    return { code: String(t.languageCode || "؟"), lang: prim(t.languageCode), asr: t.kind === "asr", kind: String(t.kind || ""),
      vss: String(t.vssId || ""), name: String(nm || ""), tr: t.isTranslatable === true,
      gated: exp.indexOf("xpe") >= 0 || exp.indexOf("xpv") >= 0, expOther: exp.some(function (x) { return x !== "xpe" && x !== "xpv"; }),
      skip: q.has("tlang") ? "tlang=" + cut(q.get("tlang"), 8) : q.has("variant") ? "variant=" + cut(q.get("variant"), 12) : "" };
  };
  const capLab = function (c) {
    return c.code + "·" + (c.asr ? "asr" : c.kind || "يدويّ") + (c.gated ? "·مقفل" : "") + (c.skip ? "·" + c.skip + "(مُتخطّى)" : "");
  };

  // ── (د) ⭐ القرار: دالّةٌ نقيّة — البثُّ أوّلاً (§٢)، ثمّ §٣ بترتيبه حرفاً ─────────────────────────
  const T = { live: "بثٌّ مباشر — خارج النطاق", arNow: "لا دبلجة: المسارُ الجاري عربيّ", arOffer: "يُقترح مسارُ يوتيوب العربيّ",
    speak: "تُنطق كما هي بلا ترجمة", arVid: "الفيديو عربيٌّ أصلاً — رفض", manual: "تُترجَم اليدويّة",
    asr: "تُقسَّم التلقائيّة ثمّ تُترجَم", none: "لا ترجمةَ نصّيّة — خارج النطاق",
    other: "لا قاعدة: يدويّةٌ بغير لغة الكلام (أو لغتُه مجهولة) ولا تلقائيّة" };
  const decide = function (x) {
    const caps = x.caps.filter(function (c) { return !c.skip; });       // ⛔ tlang وvariant يُتركان (§٣)
    const asr = caps.find(function (c) { return c.asr; }) || null;
    const man = caps.filter(function (c) { return !c.asr; });
    const spoken = asr ? asr.lang : prim(x.def);                        // لغةُ الكلام: التلقائيّة ثمّ الافتراضيّ
    const out = function (k, pick) { return { k: k, t: T[k], pick: pick || null, spoken: spoken,
      from: asr ? "التلقائيّة" : spoken ? "المسار الافتراضيّ" : "مجهولة" }; };
    if (x.live) return out("live");
    if (x.audio.some(function (a) { return a.cur && prim(a.lang) === "ar"; })) return out("arNow");      // (١)
    if (x.audio.some(function (a) { return prim(a.lang) === "ar"; })) return out("arOffer");             // (١) خ10
    const mAr = man.find(function (c) { return c.lang === "ar"; });
    if (mAr) return out("speak", mAr);                                                                 // (٢)
    if (asr && asr.lang === "ar") return out("arVid", asr);                                           // (٣)
    const mSp = spoken ? man.find(function (c) { return c.lang === spoken; }) : null;
    if (mSp) return out("manual", mSp);                                                               // (٤)
    if (asr) return out("asr", asr);                                                                  // (٥)
    return out(caps.length ? "other" : "none");
  };

  // ── (هـ) ⛔ الشاهدُ السالب: مدخلاتٌ جوابُها معلومٌ قبل أن تُقرأ، بالدوالّ نفسِها ────────────────────
  const U = "/api/timedtext?v=SYNTH&lang=", ASR_EN = { languageCode: "en", kind: "asr", baseUrl: U + "en&kind=asr" };
  const SYN = [
    { why: "صوتٌ عربيٌّ جارٍ", want: "arNow", x: { def: "en-US.4", audio: [{ lang: "en-US.4" }, { lang: "ar-EG.3", cur: true }], caps: [ASR_EN] } },
    { why: "تلقائيّةٌ إنجليزيّةٌ وحدَها", want: "asr", x: { audio: [], caps: [ASR_EN] } },
    { why: "يدويّةٌ ar مقفلة", want: "speak", sum: "ar·يدويّ·مقفل · en·asr",
      x: { def: "en", audio: [{ lang: "en", cur: true }], caps: [{ languageCode: "ar", baseUrl: U + "ar&exp=xpe" }, ASR_EN] } },
    { why: "بثٌّ بتلقائيّة", want: "live", x: { live: true, audio: [], caps: [ASR_EN] } },
    { why: "فخاخ Bulgarian·tlang=ar·variant", want: "asr", x: { audio: [{ lang: "bg", cur: true }],
      caps: [{ languageCode: "bg", name: { simpleText: "Bulgarian" }, baseUrl: U + "bg" }, { languageCode: "ar", baseUrl: U + "en&tlang=ar" },
        { languageCode: "ar", baseUrl: U + "ar&variant=x" }, ASR_EN] } }
  ];
  const wBad = SYN.map(function (s) {
    const caps = s.x.caps.map(trackOf), sum = caps.map(capLab).join(" · ");
    const d = decide({ live: !!s.x.live, def: s.x.def || "", audio: s.x.audio, caps: caps });
    return d.k === s.want && (!s.sum || sum === s.sum) ? "" : s.why + " ⇐ " + d.k + (s.sum ? " «" + sum + "»" : "") +
      " (المطلوب " + s.want + (s.sum ? " «" + s.sum + "»" : "") + ")";
  }).filter(Boolean);
  if (wBad.length) { emit(TAG + " ⛔ · الشاهدُ السالب سقط — دالّةُ القرار لا تُعطي المعلومَ على مدخلٍ اصطناعيّ: " + wBad.join(" · ") +
    " ⇒ **عطبٌ في المِجَسّ لا في الفيديو، ولا يُطبع قرار** (قرار 26) · " + env); return; }

  // ── (أ) الإعلانُ أوّلاً (⛔ لا ⚪: شرطُ سياقٍ كمِجَسَّي 7 و5، قرار 140) ثمّ ردُّ المشغّل — وأن يكون ردَّ هذا الفيديو ──
  const adCls = ["ad-showing", "ad-interrupting"].filter(function (c) { return p.classList.contains(c); });
  if (adCls.length) { emit(TAG + " ⛔ · رفضٌ: إعلانٌ يُعرض (#movie_player." + adCls.join(".") + ") — انتظر انتهاءه ثمّ الصق · v=" + v + " · " + env); return; }
  let pr = null;
  try { pr = p.getPlayerResponse(); } catch (e) { emit(TAG + " ⛔ · getPlayerResponse() رمى " + errName(e) + " — أعد اللصق بعد ثوانٍ · " + env); return; }
  const vd = (pr && pr.videoDetails) || null;
  if (!vd) { emit(TAG + " ⛔ · getPlayerResponse() = " + (pr ? "ردٌّ بلا videoDetails" : String(pr)) +
    " — المشغّلُ لم يُحمَّل بعد: انتظر بدءَ الفيديو وأعد اللصق · " + env); return; }
  if (vd.videoId !== v) { emit(TAG + " ⛔ · المشغّلُ يحمل فيديو غيرَ الرابط: videoDetails.videoId=" + vd.videoId + " · v=" + v +
    " — **أعد تحميل الصفحة** (⌘R · F5) ثمّ الصق · " + env); return; }
  const ps = (pr.playabilityStatus && pr.playabilityStatus.status) || "؟";
  if (ps !== "OK") { emit(TAG + " ⛔ · playabilityStatus.status = " + ps + " — المطلوب OK (فيديو يُشغَّل هنا) · v=" + v + " · " + env); return; }

  // ── (ب) مساراتُ النصّ ولغاتُ الترجمة · وزرُّ CC يُقرأ ولا يُنقر (#156) ───────────────────────────
  const ren = (pr.captions && pr.captions.playerCaptionsTracklistRenderer) || null;
  const caps = (ren && Array.isArray(ren.captionTracks) ? ren.captionTracks : []).map(trackOf);
  const tl = ren && Array.isArray(ren.translationLanguages) ? ren.translationLanguages : [];
  const tlAr = tl.some(function (l) { return prim(l && l.languageCode) === "ar"; });
  const capsTxt = caps.length ? list(caps, capLab, 12) : ren ? "قائمةٌ فارغة" : "captions غائبٌ من الردّ";
  const expOther = caps.filter(function (c) { return c.expOther; }).length;
  const cc = p.querySelector(".ytp-subtitles-button");
  const cvOk = cc && typeof cc.checkVisibility === "function", cvR = cvOk ? cc.checkVisibility() : null, cvE = cvOk ? cc.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : null;
  const ccTxt = cc ? "مرئيّ=" + (cvOk ? cvR + (cvR && !cvE ? "·مُعتَم" : "") : "؟") +
    "·aria-pressed=" + cc.getAttribute("aria-pressed") : "لا زرّ";

  // ── (ج) الصوت: واجهةُ المشغّل (حقلاً أو دالّةً) ثمّ صيغُ streamingData بلا تكرار ──────────────────
  const rd = function (o, k) {                                // o.k · o.k() · o.getK() — الشكلُ غيرُ موثّق
    if (!o || typeof o !== "object") return undefined;
    try { let x = o[k]; if (typeof x === "function") x = x.call(o);
      const g = o["get" + k.charAt(0).toUpperCase() + k.slice(1)];
      return x === undefined && typeof g === "function" ? g.call(o) : x;
    } catch (e) { return undefined; }
  };
  const acontOf = function (s) { const m = /(?:^|[:&,])acont=([^:&,]+)/.exec(String(s || "")); return m ? m[1] : ""; };
  const xtDecode = function (x) {   // ⭐ 📐 «itag;base64(protobuf)» ⇐ «k=v:k=v» — والنصُّ الصريحُ يمرّ كما هو، والمعطوبُ ⇐ ""
    const s = typeof x === "string" ? x : ""; if (!s || /(?:^|[:&,])(acont|lang)=/.test(s)) return s;
    const b = (s.indexOf(";") >= 0 ? s.slice(s.indexOf(";") + 1) : s).replace(/-/g, "+").replace(/_/g, "/"); let bin = "", i = 0; const out = [];
    try { bin = atob(b + "===".slice(0, (4 - b.length % 4) % 4)); } catch (e) { return ""; }
    const vi = function () { let r = 0, sh = 0, c = 0; do { c = bin.charCodeAt(i++); r += (c & 127) * Math.pow(2, sh); sh += 7; } while (c & 128 && i < bin.length); return r; };
    while (i < bin.length) { if (vi() !== 10) return ""; const n = vi(), end = i + n; let k = "", val = "";
      if (!(n > 0) || !Number.isFinite(end) || end > bin.length) return "";
      while (i < end) { const tg = vi(), m = vi(); if (!Number.isFinite(m) || i + m > end) return ""; if (tg === 10) k = bin.slice(i, i + m); else if (tg === 18) val = bin.slice(i, i + m); i += m; }
      if (!/^[\x20-\x7e]+$/.test(k + val)) return ""; out.push(k + "=" + val); }
    return out.join(":");
  };
  const XTW = [["251;Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICYXI", "acont=dubbed:lang=ar"], ["251;ChEKBWFjb250EghvcmlnaW5hbAoICgNkcmMSATEKDQoEbGFuZxIFZGUtREU",
    "acont=original:drc=1:lang=de-DE"], ["acont=original:lang=en", "acont=original:lang=en"], ["251;!!xx", ""], ["und", ""]];   // ⭐ المعرّفان من أسطر المالك 2026-10-31 — ⛔ بعد تعريف المفكّك لا قبله (📐 الرِكاز: رمى TDZ)
  const xtBad = XTW.filter(function (w) { return xtDecode(w[0]) !== w[1]; }).map(function (w) { return "«" + w[0].slice(0, 24) + "» ⇐ «" + xtDecode(w[0]) + "» (المطلوب «" + w[1] + "»)"; });
  if (xtBad.length) { emit(TAG + " ⛔ · مفكّكُ xtags لا يُعطي المعلوم: " + xtBad.join(" · ") + " ⇒ **عطبٌ في المِجَسّ، ولا يُطبع قرار** (قرار 26) · " + env); return; }
  const normA = function (t, cur) {
    const info = rd(t, "languageInfo") || null, id = str(rd(t, "id")), ac = rd(t, "acont");
    const xt = [xtDecode(rd(t, "xtags")), xtDecode(id), typeof ac === "string" && ac ? "acont=" + ac : ""].filter(Boolean).join(":"), xl = /(?:^|[:&,])lang=([^:&,]+)/.exec(xt);
    const semi = /;/.test(id), raw = semi && !xt ? id : "";   // ⛔ «;» بلا فكٍّ ⇒ يُطبع خامّاً، ولا يُخفض ليصير «لغة»
    return { id: id, raw: raw, lang: prim(str(rd(info, "id")) || str(rd(info, "languageCode")) || (xl ? xl[1] : "") || (semi ? "" : id)), name: str(rd(info, "name")),
      def: rd(info, "isDefault") === true, auto: rd(t, "isAutoDubbed") === true || rd(info, "isAutoDubbed") === true || /dubbed-auto/.test(xt),
      acont: acontOf(xt), drc: /(?:^|[:&,])drc=1(?:$|[:&,])/.test(xt), cur: !!cur };
  };
  const call = function (n) {
    if (typeof p[n] !== "function") return { no: "typeof " + n + "=" + typeof p[n] };
    try { return { v: p[n]() }; } catch (e) { return { no: n + "() رمى " + errName(e) }; }
  };
  const ga = call("getAvailableAudioTracks"), gc = call("getAudioTrack");
  const arr = Array.isArray(ga.v) ? ga.v : [];
  const curId = gc.v ? str(rd(gc.v, "id")) : "";
  const apiT = arr.map(function (t) { return normA(t, gc.v != null && (curId ? str(rd(t, "id")) === curId : t === gc.v)); });
  const curN = gc.v && typeof gc.v === "object" ? normA(gc.v, true) : null;
  const keys = function (o, proto) {                          // دوالُّ النموذج الأوّل وحدَه — والجذرُ (Object.prototype) لا يُعدّ
    try { const pp = proto ? Object.getPrototypeOf(o) : null;
      if (proto && (!pp || Object.getPrototypeOf(pp) === null)) return "[]";
      const k = proto ? Object.getOwnPropertyNames(pp).filter(function (n) { return /^(get|is|has)/.test(n); }) : Object.keys(o);
      return "[" + k.slice(0, 8).join(",") + (k.length > 8 ? ",+" + (k.length - 8) : "") + "]";
    } catch (e) { return "؟"; }
  };
  const t0 = arr[0] || gc.v || null;
  const shape = t0 && typeof t0 === "object" ? keys(t0) + " دوالّ=" + keys(t0, true) + " لغة=" + keys(rd(t0, "languageInfo") || {}) : "—";
  const sd = pr.streamingData || null;
  const audF = (sd && Array.isArray(sd.adaptiveFormats) ? sd.adaptiveFormats : [])
    .filter(function (f) { return /^audio\//.test(String((f && f.mimeType) || "")); });
  const fmtT = [], seen = {};
  audF.forEach(function (f) {
    const a = f.audioTrack;
    if (!a || seen[a.id]) return;
    seen[a.id] = 1;
    let xt = "";
    try {                                                   // acont من xtags في رابط الصيغة — والرابطُ لا يُطبع
      const u = f.url || new URLSearchParams(String(f.signatureCipher || f.cipher || "")).get("url") || "";
      xt = u ? new URL(u).searchParams.get("xtags") || "" : "";
    } catch (e) { xt = ""; }
    fmtT.push({ id: str(a.id), lang: prim(a.id), name: str(a.displayName), def: a.audioIsDefault === true,
      auto: a.isAutoDubbed === true || /dubbed-auto/.test(xt), acont: acontOf(xt), cur: false });
  });

  // ── ⛔ الشاهدُ الموجب للصوت: «مسارٌ واحد» و«لا أرى» صفرٌ واحد (قرار 150) — واللغةُ «معروفةٌ» بشكلها لا بأنها غيرُ فارغة ──
  const isLang = function (s) { return /^[a-z]{2,3}$/.test(String(s || "")) && s !== "und"; }, langN = new Set(apiT.concat(curN ? [curN] : [])
    .filter(function (t) { return isLang(t.lang); }).map(function (t) { return t.id || t.lang; })).size;   // ⛔ «und» ليس لغة · والجاري لا يُعدّ مرّتين
  if (!(audF.length || langN)) {
    emit(TAG + " ⛔ · لا أرى الصوت — صيغُ الصوت في streamingData=" + audF.length + (sd ? "" : " (streamingData غائب)") +
      " · getAvailableAudioTracks=" + (ga.no || arr.length + " بلا لغةٍ معروفة") + " · getAudioTrack=" + (gc.no || (gc.v && typeof gc.v === "object" ? str(gc.v) : String(gc.v))) +
      " ⇒ **لا قرار:** قاعدتا الصوت (١) لا تُقيَّمان عمياوَين · النصّ(" + caps.length + ")=" + capsTxt + " · v=" + v + " · " + env);
    return;
  }

  // ── (د) القرارُ على الحقيقيّ — والعرضُ للعين أوّلاً (لا يُنسخ) ───────────────────────────────────
  const defT = fmtT.find(function (t) { return t.def; }) || apiT.find(function (t) { return t.def; }) || null;
  const orig = fmtT.concat(apiT).find(function (t) { return t.acont === "original"; }) || null;
  const audioDec = apiT.concat(fmtT, curN ? [curN] : []);
  const d = decide({ live: vd.isLive === true, def: defT ? defT.lang : "", audio: audioDec, caps: caps });
  const arAudio = audioDec.some(function (a) { return prim(a.lang) === "ar"; });
  const audLab = function (t) {
    return (/;/.test(t.id) || !t.id ? t.lang || "؟" : t.id) + (t.raw ? "·xtags؟=" + t.raw.slice(0, 64) : "") + (t.name ? "«" + cut(t.name, 22) + "»" : "") + (t.def ? "·افتراضيّ" : "") +
      (t.auto ? "·دبلجة-آليّة" : "") + (t.acont ? "·" + t.acont : "") + (t.drc ? "·drc" : "") + (t.cur ? "◀جارٍ" : "");
  };
  if (caps.length) console.table(caps.map(function (c) { return { "اللغة": c.code, "النوع": c.asr ? "asr" : c.kind || "يدويّ",
    vssId: c.vss, "الاسم": cut(c.name, 40), "يُترجَم": c.tr, "مقفل": c.gated, "مُتخطّى": c.skip || "—" }; }));
  if (apiT.length || fmtT.length) console.table(apiT.map(function (t) { return Object.assign({ "المصدر": "API" }, t); })
    .concat(fmtT.map(function (t) { return Object.assign({ "المصدر": "الصيغ" }, t); })));

  // ── (و) سطرُ الحكم — ⚠️ وأساسُ الحلقة ١ واجهةُ المشغّل (§٣): بدونها «لا عربيَّ في الصوت» من الصيغ وحدَها فيُوسَم (قرار 150) ──
  const warn = d.k === "speak" && d.spoken === "ar" ? " ⚠️ والكلامُ عربيٌّ نفسُه (من " + d.from + ") ⇒ §٣ يُنطق عربيّاً فوق عربيّ لأنّ (٢) قبل (٣) — للمالك"
    : d.k === "other" ? " ⚠️ مخرجٌ ليس في §٣" : "";
  const apiNo = [ga.no || (Array.isArray(ga.v) ? "" : "getAvailableAudioTracks() = " + (ga.v && typeof ga.v === "object" ? str(ga.v) : String(ga.v))), gc.no].filter(Boolean);
  const apiW = apiNo.length ? " ⚠️ (١) قُيّمت بلا واجهة الصوت كاملةً (" + apiNo.join(" · ") + ")" : "";
  const origTxt = orig && d.spoken && orig.lang !== d.spoken ? " ⚠️ والأصليُّ (acont=original) " + orig.lang : "";
  const pick = d.pick ? " · المختار=" + (d.pick.vss || d.pick.code) + "|" + cut(d.pick.name, 24) + "|" +
    (d.pick.gated ? "مقفل" : "غيرُ مقفل") + "|يُترجَم=" + (d.pick.tr ? "نعم" : "لا") : "";
  emit(TAG + " ✅ · القرار: «" + d.t + "»" + warn + apiW + " · لغةُ الكلام=" + (d.spoken || "؟") + " (من " + d.from + ")" + origTxt + pick +
    " · v=" + v + " «" + cut(vd.title, 40) + "» · بثّ: isLive=" + (vd.isLive === true) + " isLiveContent=" + (vd.isLiveContent === true) +
    " · المدّة=" + (vd.lengthSeconds || "؟") + "ث · النصّ(" + caps.length + ")=" + capsTxt +
    " · مُتخطّى(tlang/variant)=" + caps.filter(function (c) { return c.skip; }).length + (expOther ? " · exp بقيمةٍ غير xpe/xpv=" + expOther : "") +
    " · ar في لغات الترجمة=" + (tlAr ? "نعم" : "لا") + " (من " + tl.length + ")" +
    " · الصوت(API " + (ga.no || arr.length) + ")=" + (apiT.length ? list(apiT, audLab, 8) : "—") +
    " · الجاري=" + (gc.no || (curN ? (curN.lang || "؟") + (curN.acont ? "·" + curN.acont : "") + (curN.auto ? "·دبلجة-آليّة" : "") + (curN.drc ? "·drc" : "") + (curN.raw ? "·xtags؟=" + curN.raw.slice(0, 64) : "") : String(gc.v))) +
    " · الصوت(الصيغ: " + fmtT.length + " مساراً من " + audF.length + " صيغة)=" + (fmtT.length ? list(fmtT, audLab, 8) : "—") +
    " · عربيٌّ في الصوت=" + (arAudio ? "نعم" : "لا") + " · شكلُ المسار=" + shape + " · زرّ CC: " + ccTxt +
    " · شاهد−=✅ " + SYN.length + "/" + SYN.length + "·مفكّكُ xtags ✅ " + XTW.length + "/" + XTW.length + " · شاهد+=✅ getPlayerResponse·videoId=v·playability=OK·صيغُ صوت " + audF.length + "·مساراتٌ بلغةٍ معروفة " + langN +
    " · شبكة=0 من ميزانيةِ 0 · ytcfg=" + typeof globalThis.ytcfg + " · " + env);
})().catch((e) => console.log("VZ-168أ-8 ⛔ · المِجَسُّ نفسُه رمى: " + ((e && e.stack) || e) + " — عطبُ أداةٍ لا جواب، أبلِغ بهذا السطر"));
