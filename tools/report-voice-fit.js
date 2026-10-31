// مِجَسّ 168أ-5 — **أيتّسع النطقُ العربيّ لنوافذ جمل هذا الفيديو، وبأيّ سرعةٍ تفهمه، وأيُّ الترجمتين أوضح؟** يُلصق في كونسول صفحة المشاهدة على يوتيوب، والسياقُ top (عالمُ الصفحة).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«أيتّسع النطقُ العربيّ لنوافذ جمل الفيديو؟ وبأيّ سرعةٍ ما زلتَ
// تفهمه؟ وأيُّ الترجمتين أوضح؟»*
//
// ── لماذا يُقاس قبل أيّ بناء (AUDIT القسم السابع عشر §١(أ) · §٦ صفوف 5 · 6 · 9 · K3) ────────────────
// **خطرُ السرعة محسوبٌ لا مقيس** (§١(أ): نحو 138 كلمةً عربيّةً في الدقيقة 🧮 والأصواتُ 80–99 📐 خارج كروم ⇒ «تسريعٌ دائم
// 1.4–1.7×») ⇒ **فيُقاس على فيديو حقيقيّ:** نصُّه الملتقَط (مِجَسّ 7) ⇐ جُمَل ⇐ مترجمُ كروم ⇐ مدّةُ النطق ⇐ **s = مدّةُ العربيّ
// ÷ (نافذتها + 0.5 ث)** لكلّ جملة. **وقاعدةُ الملاءمة مكتوبةٌ قبله (§٦):** ≥80٪ من الجمل بسرعةٍ ≤ R_max، و**R_max حكمٌ بشريّ
// (👁) يعطيه listen()** (صفّ 6). ⚠️ **وp80 الفيديو ورمزُ سطره مؤشّرُ ذلك الفيديو لا حكمُ K3:** K3 يُقرأ لكلّ نظامٍ بعد العشرة
// (صفّ 5) على حصّة جملها مجتمعةً بـR_max الفعليّة ⇐ **فـs مرتّبةً أرقاماً في السطر** لتُجمع بأيّ R_max. **وcompare() مقارنةُ
// خ11 العمياء** (صفّ 9).
// ⚠️ **وs سرعةٌ فعليّة لا سرعةُ كروم:** ما يُنتجها يختلف بالنظام (§٩: الويندوز 2 ⇐ نحو 1.39) — مِجَسّ 4 يقيس المنحنى، وlisten()
// يقيسه هنا. **قرار 48 — يُقاس سببُنا:** مدّةُ جملتنا بين `start` و`end`، وطلبُنا مسجَّلٌ بوقته ورابطه **فـ429 بعده يُنسب إلى
// ما سجّلناه لا يُخمَّن (K4).** **وكلُّ رفضٍ يُسمّي شرطَه بقيمته (قرار 140).**
//
// ── ⛔ الشواهد — ولا حكمَ بدونها (قرار 26 · قرار 150) ────────────────────────────────────────────
//  · **المُقسِّمُ دالّةٌ خالصة تُسأل أوّلاً عن ⛔ ~~حالين~~ ثلاث حالاتٍ جوابُها معلوم** (json3 اصطناعيٌّ تلقائيٌّ ويدويّ، **وأحداثٌ تُشقّ عند ترقيمها
//    وتُقصّ بسقفٍ مثبَّتٍ عند 25 بالضبط وتتداخل أزمنتُها** — 2026-11-01) — وإلا ⛔.
//  · **سالبُ الأداة:** جملةٌ ثابتةٌ تُنطق مرّتين ⇒ **مدّتان لا تفترقان بأكثرَ من 5٪** — وإلا ⛔ «غيرُ ثابت».
//  · **شاهدا المسار (§٦ صفّ 5) بدالّة s نفسِها:** كلمةٌ في نافذة 5 ث ⇒ **s < 1** · 40 كلمةً في نافذة 0.5 ث ⇒ **s > 3** — وإلا ⛔.
//  · **compare:** المتقابلان بالزمن **أشبهُ كلماتٍ بضعفٍ على الأقلّ من المُزاحَين** بنصف القائمة — وإلا ⛔ ولا أزواج.
//  ⇒ ⭐ **و`speak()` بلا رميةٍ ليس «نُطق»** (قرار 109): المدّةُ من `start` إلى `end`، **و`end` بلا `start` خطأٌ لا مدّة.**
//
// ── ⚠️ حدودٌ مُعلَنة — **وكلُّ رقمٍ هنا اختيارُ تصميمٍ 🎯 لا قياس** (قرار 96)، ويُطبع في السطر ──────────
//  · **التلقائيّة** (فيها `tOffsetMs`): كلماتٌ بزمنٍ مطلق tStartMs+tOffsetMs **وأحداثُ الإلحاق تُترك**، وتُقسم عند **فجوةِ بدءٍ
//    ≥600ms** أو . ? ! أو 20 كلمة · **اليدويّة:** أحداثٌ تُدمج حتى ترقيمٍ أو **فجوةٍ ≥1200ms** أو 25 كلمة · […] و♪ تُحذف ·
//    **النافذةُ = بدءُ التالية − بدؤها** (الأخيرة: نهايتُها − بدؤها + 0.5 ث) · **≤40 جملةً منتظمةً بترتيب الجمل لا بالزمن.**
//  · ⭐ 📐 **والشكلُ الثالث (2026-10-31، أوّلُ فيديو للمالك):** `kind=asr` بلا `tOffsetMs` ومرقّمٌ داخل أحداثه (151 حدثاً لـ2064 كلمة ·
//    `exp=xpo,xwmhp,xpe` = ذراعُ تجربةٍ ليوتيوب منذ يونيو 2026 تدمج الكلمات 📄) — ⛔ ~~الحدثُ وحدةٌ لا تُشقّ~~ فخرجت 67 من 74 «جملة»
//    قطعاً من 25–31 كلمة تنتهي وسط الكلام ⇒ **الحدثُ بلا `tOffsetMs` يُشقّ عند . ? ! … داخله، وزمنُ كلّ قطعةٍ بنسبة حروفها من مدّته**
//    (🎯 تقريبٌ: لا توقيتَ كلماتٍ يُقاس به) ثمّ قواعدُ اليدويّة نفسُها · **وتسميةُ السطر بالشكل لا بالنوع** («بلا توقيت كلمات»).
//  · **النطقُ مرّةً بسرعة 1 وحجم 0.15** (خافتٌ لا مكتوم: المكتومُ يُنهي بلا `start`) بصوتٍ واحد — المحسّنُ إن وُجد ·
//    **المدّةُ مدّةُ المحرّك لا الصوتِ المسموع** (حافّتا الصمت منها) · والترجمةُ مترجمُ كروم على الجهاز وحدَه.
//  · **listen(): جملٌ مختلفة، لكلّ سرعةٍ جملة** (الجملةُ المعادةُ تُفهم بالذاكرة لا بالسمع · ويبقى أنّ كلّاً منها نُطق خافتاً مرّةً
//    في العيّنة — أثرٌ باقٍ مُعلَن) — حول النافذة الوسيطة، ومن جمل ≥3 ث بسرعة 1 إن كفت · حجم 0.8 · و3 ث بعد كلٍّ لتدوين
//    «فهمتُ / لم أفهم» · **وسرعاتُ كروم بالنظام:** 1 · 1.5 · 2 · 2.5 · 3 · 4،
//    **والويندوز 1 · 2 · 2.52 · 3.17 · 3.99 · 5.02 · 6.31 · 7.95 · 10 = درجاتُ SAPI 0 و3–10 ≈ 1.00 · 1.39 · 1.55 · 1.73 · 1.93 ·
//    2.16 · 2.41 · 2.69 · 3.00 فعليّاً (📖 §٩)** — وقائمةُ غيرِه عليه لا تتجاوز 1.93 ويقع فيها 2 و2.5 على درجةٍ واحدة. **والفعليّةُ
//    تُقاس هنا ولا تُؤخذ من الجدول:** مدّةُ الجملة بسرعة 1 (من العيّنة) ÷ مدّتها بسرعتها، وأولاها بسرعة 1 فحصٌ (≈1.00).
//  · **صفرُ طلبٍ في التشغيلة؛ وcompare(true) طلبٌ واحدٌ للصفحة بـtlang=ar والسقفُ في الكود** — **وهو الطلبُ الثاني منّا لهذا
//    الفيديو (§٣: واحد)**، وقد يُرفض لأنه ليس طلبَ المشغّل (📄 §٩، yt-dlp #13831) **و429 قد يحظر عنوانَك ساعات** (📄 بلاغٌ واحد)
//    ⇒ **آخرَ خطوةٍ تطلب الشبكة في اليوم · وقاطعٌ عند أوّل ردٍّ غيرِ 200 أو جسمٍ فارغ أو فشل، وهو قاطعُ مِجَسّ 7 نفسُه**
//    (`__vz168capMem.stop` يُقرأ ويُكتب) **ونصُّ توقّفه BREAK بحرفه** (الاتصالُ كلُّه لا الجهاز: الحظرُ على العنوان) · لا تخزينَ
//    ولا نقرَ على المشغّل · **ويبقى `__vz168fit` و`vz168fit` حتى إعادة التحميل ولا يعملان حتى يُناديا.**
//
// ── كيف يُستعمل ──────────────────────────────────────────────────────────────────────────────
//   1) على صفحة المشاهدة نفسِها: **شغّل مِجَسّ 168أ-7 أوّلاً** (report-voice-capture.js — يحفظ النصَّ في `__vz168cap`) **ولا تُعِد التحميل بينهما.**
//   2) **أوقف الفيديو** بزرّ التشغيل في شريط المشغّل (أو المفتاح k) · ارفع كتمَ التبويب · ولا نطقَ في تبويبٍ آخر.
//   3) الكونسول (⌥⌘J على الماك · F12 على الويندوز) ⇒ قائمةُ السياق في شريطه على **top** — **لا VIDEO ZONES.**
//   4) الصق الملفَّ كلَّه ⇒ Enter. **وإن طلب نقرةً فانقر مساحةً فارغةً تحت المشغّل (عند العنوان) — لا الفيديو.**
//   5) **لا تُخفِ التبويب:** شواهدُ نحو دقيقة ثمّ ≤40 جملةً بصوتٍ خافت (5–8 دقائق) ⇒ سطرُ VZ-168أ-5 يُنسخ — **أرسله.**
//   6) **vz168fit.listen()** ⇒ **جملٌ مختلفة، لكلّ سرعةٍ جملة** (ستٌّ على الماك · تسعٌ على الويندوز)، ورقمُها وسرعتُها قبلها ⇒
//      **بعد كلّ جملةٍ دوّن «فهمتُ / لم أفهم» قبل التالية** ⇒ أرسل سطرَه **وأعلى سرعةٍ فهمتَها (R_max).**
//   7) (اختياريّ · **الطلبُ الثاني منّا لهذا الفيديو ⇒ آخرَ خطوةٍ تطلب الشبكة في اليوم**، في هذا التبويب بلا إعادة تحميل)
//      **vz168fit.compare()** يُحذّر ⇒ **vz168fit.compare(true)** ⇒ عشرةُ أزواجٍ أ/ب ⇒ **vz168fit.reveal("أبأأب…")** بحرفٍ لكلّ زوجٍ
//      بترتيبه (= للتعادل) ⇒ أرسل السطرين. ⛔ **وإن قال «توقّف: لا طلبَ آخر اليوم…» فلا طلبَ اليوم من هذا الاتصال كلِّه.**
//   8) **العشرةُ من قنواتك (§٦ صفّ 5) ثمّ الويندوز — وK3 لكلّ نظامٍ على جملها مجتمعةً، لا من سطرِ فيديوٍ واحد.**
(async () => {
  const TAG = "VZ-168أ-5";
  const COPY = typeof copy === "function" ? copy : null;   // ⛔ يُمسَك قبل أوّل await — بعده يزول (📐 الدفعة الأولى)
  const VOL = 0.15, TOL = 0.5, GAP_A = 600, CAP_A = 20, GAP_M = 1200, CAP_M = 25, END_PAD = 500, MAX_N = 40, TH = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];   // 🎯 قرار 96
  const R_OTHER = [1, 1.5, 2, 2.5, 3, 4], R_WIN = [1, 2, 2.52, 3.17, 3.99, 5.02, 6.31, 7.95, 10], L_VOL = 0.8, L_GAP = 3000, L_MIN = 3;   // 🎯 listen — والويندوزُ درجاتُ SAPI 0 و3–10 (📖 §٩)
  const BREAK = "توقّف: لا طلبَ آخر اليوم من هذا الاتصال بالإنترنت ولا من أيّ جهازٍ عليه (جهازُ الويندوز معه) — قد يعمّ الحظرُ ترجماتِك العاديّة ساعات · أرسل هذا السطرَ وحدَه: سطرُ كروم الأحمر فوقه فيه رمزُ الطلب";   // ⛔ بحرفه في مِجَسّ 7 — خطواتُ المالك تُفتح ببادئته
  // ── أدوات — ⛔ ولا علامةَ اقتباسٍ خلفيّة في أيّ نصٍّ هنا (كلُّ نصٍّ يُبنى بـ«+») · والنطاقاتُ بالترميز لا بالحرف ──
  const now = () => performance.now(), sleep = (n) => new Promise((r) => setTimeout(r, n)), emit = (line) => { console.log(line); try { COPY(line); console.log("   (نُسخ إلى الحافظة)"); } catch (e) {} };
  const errName = (e) => (e ? String(e.name || "Error") + (e.message ? ": " + String(e.message).slice(0, 90) : "") : "؟"), show = (r) => (r.ok ? String(r.v) : r.timeout ? "بلا جوابٍ في المهلة" : "رفض " + errName(r.e));
  const safe = (fn) => { let p; try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); } p.catch(() => {}); return p; };
  const within = (fn, lim) => { let t = 0; const late = new Promise((res) => { t = setTimeout(() => res({ ok: false, timeout: true }), lim); });   // كلُّ انتظارٍ بمهلة
    return Promise.race([safe(fn).then((v) => ({ ok: true, v: v }), (e) => ({ ok: false, e: e })), late]).finally(() => clearTimeout(t)); };
  const f2 = (x) => (x == null || !isFinite(x) ? "؟" : x.toFixed(2)), pc = (k, n) => (n ? Math.round(100 * k / n) : 0) + "٪";
  const qt = (A, p) => { const s = A.slice().sort((a, b) => a - b); return s.length ? s[Math.max(0, Math.ceil(p * s.length) - 1)] : null; };
  const vis = (s) => String(s).replace(/[\u061C\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, (c) => "⟨U+" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0") + "⟩");   // الخفيُّ يُكتب ولا يُخفى
  const clock = () => { const d = new Date(); return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0"); };

  // ── البيئة — كسطر الدفعة الأولى بحرفه ──────────────────────────────────────────────────────
  const uad = navigator.userAgentData, he = uad && typeof uad.getHighEntropyValues === "function" ? await within(() =>
    uad.getHighEntropyValues(["platform", "platformVersion", "architecture", "bitness", "fullVersionList"]), 3000) : { ok: false };
  const h = he.ok && he.v ? he.v : null, L = (h && h.fullVersionList) || [], pv = String((h && h.platformVersion) || "؟"), mj = parseInt(pv, 10);
  const br = ["Google Chrome", "Microsoft Edge", "Chromium"].map((n) => L.find((x) => x.brand === n)).find(Boolean) || L[0];
  const env = !h ? "بيئة: UA=" + navigator.userAgent : "بيئة: " + (h.platform || "؟") + " " + (h.platform === "Windows" ? (mj >= 13 ? "11" : mj > 0 ? "10" : "؟") + " (" + pv + ")"
    : pv.replace(/(\.0)+$/, "")) + " " + (h.architecture === "x86" ? (h.bitness === "64" ? "x64" : "x86") : (h.architecture || "؟") + (h.bitness === "64" ? "64" : "")) + " · " +
    (br ? br.brand.replace(/^Google /, "") + " " + br.version : "؟");
  const WIN = uad && uad.platform ? uad.platform === "Windows" : /Windows/.test(navigator.userAgent), RATES = WIN ? R_WIN : R_OTHER;   // ⭐ سرعاتُ listen بالنظام: UA-CH وإلا UA

  // ── ⓪ السياق — عالمُ الصفحة في الإطار الأعلى على /watch وحدَه، وما عداه يُرفض بشرطه وقيمته (قرار 140) ──
  if (typeof document === "undefined") { emit(TAG + " ⛔ لا مستندَ هنا: typeof document = undefined (عاملُ خدمة؟) — المطلوب عالم-الصفحة («top») على www.youtube.com/watch · " + env); return; }
  const ext = location.protocol === "chrome-extension:", ours = typeof globalThis.extensionActive === "function", rid = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) || "";
  const ctx = ext ? "صفحة-الإضافة" : ours ? "عالم-الإضافة" : rid ? "عالم-إضافةٍ-أخرى" : "عالم-الصفحة", tail = " · سياق=" + ctx + " · " + env, stop = (why) => { emit(TAG + " ⛔ " + why + tail); };
  const P = document.querySelector("#movie_player"), vNow = () => new URLSearchParams(location.search).get("v") || "", ss = typeof speechSynthesis === "undefined" ? null : speechSynthesis;
  const bad = (ext ? ["السياق = صفحة-الإضافة " + location.pathname + " — المطلوب «top» على صفحة مشاهدة"] : [
    (ours || rid) && "السياق = " + (ours ? "عالم-الإضافة (VIDEO ZONES)" : "عالمُ إضافةٍ أخرى (chrome.runtime.id=" + rid + ")") + " — المطلوب «top» من قائمة السياق في شريط الكونسول",
    window.top !== window && "الإطار = داخليّ (" + location.hostname + location.pathname + ") — المطلوب الإطارُ الأعلى",
    !/^(www\.)?youtube\.com$/.test(location.hostname) && "المضيف = " + (location.hostname || location.protocol) + " — المطلوب www.youtube.com",
    location.pathname !== "/watch" && "المسار = " + location.pathname + " — المطلوب /watch",
    (!P || typeof P.getPlayerResponse !== "function") && "typeof #movie_player.getPlayerResponse = " + (P ? typeof P.getPlayerResponse : "لا مشغّل") + " — المطلوب function (يراها عالمُ الصفحة وحدَه)"])
    .concat(!ss || typeof SpeechSynthesisUtterance === "undefined" ? ["speechSynthesis = غائب"] : []).filter(Boolean);
  if (bad.length) return stop("رفضٌ قبل القياس (السياقُ المكتشف " + ctx + "): " + bad.join(" · "));
  if (globalThis.__vz168a5 === true) return stop("__vz168a5 = true — تشغيلةٌ أخرى من هذا المِجَسّ تعمل هنا؛ انتظر سطرَها أو أعد تحميل الصفحة");
  globalThis.__vz168a5 = true;                               // ⛔ يُرفع هنا ويُنزل في finally — فكلُّ مخرجٍ بعده يُنزله
  let tr = null, hidden = document.visibilityState === "hidden";
  const onVis = () => { if (document.visibilityState === "hidden") hidden = true; }; document.addEventListener("visibilitychange", onVis);
  try {
    // ── المشغّلُ والفيديو والنصُّ الملتقَط — ولا طلبَ منّا لجلبه ثانيةً ───────────────────────────
    let pr = null; try { pr = P.getPlayerResponse() || {}; } catch (e) { return stop("getPlayerResponse() رمى: " + errName(e)); }
    const vid = vNow(), prV = (pr.videoDetails && pr.videoDetails.videoId) || "", V = P.querySelector("video"), cap = globalThis.__vz168cap,
      need7 = " — شغّل مجسّ 7 على هذا الفيديو أوّلاً (لا طلبَ ثانٍ منّا) — وإن وقع طلبُ 7 على هذا الفيديو اليوم ثمّ أُعيد التحميل فعلى فيديو آخر";   // §٣: طلبٌ واحدٌ منّا لكلّ فيديو
    if (!vid || prV !== vid) return stop("videoId في ردّ المشغّل = «" + prV + "» و v في الرابط = «" + vid + "» — المشغّلُ يحمل فيديو سابقاً بعد تنقّل: أعد تحميل الصفحة، ثمّ مِجَسّ 7، ثمّ هذا");
    if (P.classList.contains("ad-showing") || P.classList.contains("ad-interrupting")) return stop("إعلانٌ يُعرض (ad-showing على #movie_player) — انتظر انتهاءه وأوقف الفيديو ثمّ أعد اللصق");
    if (!V || !V.paused) return stop(!V ? "لا <video> داخل #movie_player" : "الفيديو يعمل (video.paused = false) — أوقفه بزرّ التشغيل في شريط المشغّل (أو k) ثمّ أعد اللصق");
    if (!cap || typeof cap !== "object") return stop("globalThis.__vz168cap = " + (cap === null ? "null" : typeof cap) + need7);
    if (cap.videoId !== vid) return stop("__vz168cap.videoId = «" + cap.videoId + "» والفيديو «" + vid + "»" + need7);
    let j = cap.json3 || cap.body || null; if (typeof j === "string") { try { j = JSON.parse(j); } catch (e) { j = null; } }
    const evs = Array.isArray(cap.events) ? cap.events : j && Array.isArray(j.events) ? j.events : null;
    if (!evs || !evs.length) return stop("__vz168cap بلا أحداث json3 (مفاتيحُه: " + Object.keys(cap).join(",") + ") — المطلوب json3.events[]" + need7);
    const cuK = cap.fetchedUrl ? "fetchedUrl" : "capturedUrl";   // ⭐ عقدٌ مع مِجَسّ 7: ما جلبناه نحن (بلا tlang ولا variant) لا طلبُ المشغّل — والتقاطٌ أقدمُ بلاه يُقرأ كما كان
    let cu = null; try { cu = typeof cap[cuK] === "string" ? new URL(cap[cuK], location.origin) : null; } catch (e) { cu = null; }
    const qp = (k) => (cu && cu.searchParams.get(k)) || "", lang = qp("lang") || String(cap.lang || ""), kindU = qp("kind") || String(cap.kind || "");
    if (qp("tlang")) return stop("__vz168cap." + cuK + " فيه tlang=" + qp("tlang") + " — نصٌّ ترجمه يوتيوب لا كلامُ الفيديو" + need7);
    if (lang.toLowerCase().split(/[-_]/)[0] !== "en") return stop("لغةُ المسار الملتقَط = «" + lang + "» — النطاقُ الإنجليزيّةُ وحدَها (خ12)، بالوسم الأوّل تماماً (درس #161)");

    // ── (أ) المُقسِّم — دالّةٌ خالصة، ⛔ ولا يُقسَّم بها نصٌّ حقيقيّ قبل أن تُصيب حالاتٍ معلومة (قرار 150) ──
    const clean = (s) => String(s || "").replace(/\[[^\]]*\]|♪+/g, " ").replace(/\s+/g, " ").trim(), nW = (s) => (String(s).trim() ? String(s).trim().split(/\s+/).length : 0);
    const PUNCT = /[.?!…]["'”’)]*$/, SPLIT = /(?<=[.?!…]["'”’)]*)(?<!(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs)\.)\s+(?=["'“‘(]*[A-Z0-9])/;   // 🎯 لا قطعَ بعد لقب ولا قبل حرفٍ صغير
    const cut3 = (e, eEnd, txt) => {   // ⭐ بلا tOffsetMs: قطعٌ عند ترقيمٍ داخل الحدث، وزمنُها بنسبة الحروف
      const L = txt.length || 1, d = eEnd - e.tStartMs; let off = 0;
      return txt.split(SPLIT).map((p) => { const i = txt.indexOf(p, off); off = i + p.length; return { utf8: p, t: e.tStartMs + Math.round(d * i / L), end: e.tStartMs + Math.round(d * off / L) }; });
    }, segment = (E) => {   // التلقائيّة: وحدتُها كلمة (فجوةُ بدءٍ إلى بدء) · ⛔ ~~اليدويّة: وحدتُها حدث~~ بلا tOffsetMs: وحدتُها قطعةُ الحدث عند ترقيمه (فجوةُ نهايةٍ إلى بدء)
      const asr = E.some((e) => e && Array.isArray(e.segs) && e.segs.some((g) => g && g.tOffsetMs != null)), out = [], why = { gap: 0, punct: 0, cap: 0, end: 0 }, W = [];
      let drop = 0, cur = null;
      let F = E.filter((e) => e && Array.isArray(e.segs) && typeof e.tStartMs === "number" && !(asr && e.aAppend));   // الإلحاقُ يُترك
      if (!asr) F = F.slice().sort((a, b) => a.tStartMs - b.tStartMs).reduce((o, e) => { const p = o[o.length - 1];   // ⭐ حدثان ببدءٍ واحد (نوافذُ متكلّمَين) يُدمجان قبل الشقّ
        if (p && p.tStartMs === e.tStartMs) { p.segs = p.segs.concat([{ utf8: " " }], e.segs.filter(Boolean)); p.dDurationMs = Math.max(p.dDurationMs || 0, e.dDurationMs || 0); }
        else o.push({ tStartMs: e.tStartMs, dDurationMs: e.dDurationMs, segs: e.segs.filter(Boolean) }); return o; }, []);
      F.forEach((e, ix) => { const eEnd = e.tStartMs + (e.dDurationMs || 0), sg = e.segs.filter(Boolean), nxS = F[ix + 1] ? Math.max(e.tStartMs, F[ix + 1].tStartMs) : eEnd;
        (asr ? sg : cut3(e, e.dDurationMs > 0 ? Math.min(eEnd, nxS) : nxS, sg.map((g) => g.utf8 || "").join(""))).forEach((g) => { const w = clean(g.utf8);   // ⭐ لا تتجاوز قطعةٌ بدءَ الحدث التالي
          if (w) W.push({ t: asr ? e.tStartMs + (g.tOffsetMs || 0) : g.t, end: asr ? eEnd : g.end, w: w }); else if (String(g.utf8 || "").trim()) drop++; }); });
      W.sort((a, b) => a.t - b.t).forEach((w, i) => { const nx = W[i + 1]; if (!cur) cur = { start: w.t, end: w.end, ws: [] };
        cur.ws.push(w.w); cur.end = asr ? (nx ? Math.min(nx.t, w.end) : w.end) : Math.max(cur.end, w.end);
        const gap = nx ? nx.t - (asr ? w.t : w.end) : 0, k = !nx ? "end" : PUNCT.test(w.w) ? "punct" : gap >= (asr ? GAP_A : GAP_M) ? "gap" : nW(cur.ws.join(" ")) >= (asr ? CAP_A : CAP_M) ? "cap" : "";
        if (k) { why[k]++; out.push({ start: cur.start, end: Math.max(cur.end, cur.start), text: cur.ws.join(" ") }); cur = null; } });
      out.forEach((s, i) => { s.win = out[i + 1] ? out[i + 1].start - s.start : s.end - s.start + END_PAD; s.words = nW(s.text); });
      return { kind: asr ? "asr" : "manual", sents: out, why: why, drop: drop };
    };
    const sig = (r) => r.kind + ":" + r.sents.map((s) => s.win + "|" + s.text).join("/") + ":" + r.drop;
    const ev = (t, d, a, app) => ({ tStartMs: t, dDurationMs: d, aAppend: app, segs: a.map((x) => (Array.isArray(x) ? { utf8: x[0], tOffsetMs: x[1] } : { utf8: x })) });
    const tA = sig(segment([{ tStartMs: 0, dDurationMs: 9000, id: 1, wpWinPosId: 1 }, ev(1000, 3000, ["hello", [" world", 300], [" again", 600]]), ev(2500, 100, ["\n"], 1), ev(3000, 2000, ["next", [" one.", 200], [" [Music]", 400], [" last", 500]])]));
    const tM = sig(segment([{ tStartMs: 0, dDurationMs: 6000, id: 1 }, ev(0, 1000, ["Hello there,"]), ev(1100, 900, ["my friend."]), ev(2100, 800, ["[Music]"]), ev(5000, 1000, ["Next\none"])]));
    const W24 = "six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty a b c d e f g h i";   // 24 كلمةً بالضبط
    const rP = segment([ev(0, 2000, ["One two. Three four five?"]), ev(2100, 1000, [W24]), ev(3150, 200, ["word"]), ev(3400, 500, ["Last one."])]), tP = sig(rP) + ":" + JSON.stringify(rP.why);
    const tO = sig(segment([ev(0, 6000, ["We went to the store. Then we bought"]), ev(3000, 6000, ["some apples and pears."]), ev(6000, 6000, ["It was late."])]));
    const okA = "asr:2000|hello world again/500|next one./2000|last:1", okM = "manual:5000|Hello there, my friend./1500|Next one:1",
      okP = "manual:720|One two./1380|Three four five?/1300|" + W24 + " word/1000|Last one.:0:" + JSON.stringify({ gap: 0, punct: 2, cap: 1, end: 1 }),   // ⭐ الترقيمُ داخل الحدث + السقفُ عند 25 بالضبط
      okO = "manual:1833|We went to the store./4167|Then we bought some apples and pears./6500|It was late.:0";   // ⭐ أحداثٌ متداخلة (roll-up): لا تسبق قطعةٌ ما قبلها
    if (tA !== okA || tM !== okM || tP !== okP || tO !== okO) return stop("المُقسِّم معطوب على json3 اصطناعيّ: «" + tA + "» · «" + tM + "» · «" + tP + "» · «" + tO + "» والمتوقَّع «" + okA + "» · «" + okM + "» · «" + okP + "» · «" + okO + "» ⇒ لا يُقسَّم نصٌّ حقيقيّ بمقسِّمٍ لم يُثبت أنه يصيب");
    const seg = segment(evs), N = seg.sents.length, why = seg.why, M = Math.min(MAX_N, N), sample = [];
    if (N < 2) return stop("الجملُ المُقسَّمة = " + N + " من " + evs.length + " حدثاً — أقلُّ من جملتين");
    for (let k = 0; k < M; k++) sample.push(seg.sents[Math.floor((k + 0.5) * N / M)]);   // ⭐ منتظمةٌ بترتيب الجمل لا بالزمن: الحصّةُ حصّةُ جمل

    // ── (ب · ج) المترجم: «available» شرط — والتنزيلُ مِجَسُّ 1 لا هذا ─────────────────────────────
    const AR = /[\u0600-\u06FF]/, T = globalThis.Translator, PAIR = { sourceLanguage: "en", targetLanguage: "ar" }, m1 = "شغّل مِجَسّ 1 (report-voice-translator.js) ";
    if (!AR.test("مرحباً") || AR.test("Hello")) return stop("كاشفُ العربيّة لا يفرّق — عطبٌ في المِجَسّ لا في كروم");
    if (typeof (T && T.availability) !== "function") return stop("typeof Translator = " + typeof T + " في عالم الصفحة — المطلوب Translator.availability: " + m1 + "على هذا الجهاز");
    const av = await within(() => T.availability(PAIR), 15000); if (!av.ok || av.v !== "available") return stop("en→ar = " + show(av) + " — المطلوب available: " + m1 + "في صفحة إعدادات الإضافة أوّلاً لينزّل النموذج");
    const cr = await within(() => T.create(PAIR), 60000), lat = []; if (!cr.ok) return stop("Translator.create() = " + show(cr) + " والحالُ available — أعد مِجَسّ 1");
    tr = cr.v; console.log("🟢 " + TAG + ": " + N + " جملةً (" + (seg.kind === "asr" ? "كلماتٌ بتوقيتها" : "بلا توقيت كلمات — قُسمت عند الترقيم داخل الأحداث") + ") من " + evs.length + " حدثاً — أترجم عيّنةً من " + M + " واحدةً واحدة…");
    for (const x of sample) { const t0 = now(), r = await within(() => tr.translate(x.text), 30000);
      if (r.ok && typeof r.v === "string") { lat.push(now() - t0); x.ar = r.v.trim(); } else { x.ar = ""; x.err = r.timeout ? "ترجمة:مهلة" : "ترجمة:" + errName(r.e); } }
    const arN = sample.filter((x) => AR.test(x.ar)).length, trE = (sample.find((x) => x.err) || {}).err || "";
    if (arN < 10) return stop("جملٌ بترجمةٍ عربيّة = " + arN + " من " + M + " (من " + N + ") — أقلُّ من 10 ⇒ لا حكم" + (trE ? " · أوّلُ خطأ: " + trE : " (فيديو قصير؟)"));

    // ── (د) الصوت والتفاعل — الأصواتُ تصل دفعتين (مِجَسّ 2) ⇒ يُنتظر صوتٌ محلّيٌّ وسكونُ القائمة ثانيةً، والسقفُ 10 ث ──
    const v0 = now(); let all = [], vsig = "", vat = v0;
    for (;;) { all = ss.getVoices() || []; const s = all.map((v) => v.voiceURI + "|" + v.lang).join(","), t = now(); if (s !== vsig) { vsig = s; vat = t; }
      if ((all.some((v) => v.localService) && t - vat >= 1000) || t - v0 >= 10000) break; await sleep(250); }
    const isAr = (v) => (v.lang || "").toLowerCase().split(/[-_]/)[0] === "ar", arL = all.filter((v) => isAr(v) && v.localService);   // ⛔ بالوسم الأوّل تماماً لا بالاسم (درس #161)
    const VO = arL.find((v) => /enhanced/i.test(v.name) || String(v.name).replace(/[\u064B-\u0652\u0670\u200E\u200F]/g, "").indexOf("محسن") >= 0) || arL[0], ua = navigator.userActivation;
    if (!VO) return stop("لا صوتَ عربيّاً محلّيّاً بين " + all.length + " صوتاً (محلّيّ " + all.filter((v) => v.localService).length + " · عربيّ " + all.filter(isAr).length + ") — مِجَسّ 2 (report-voice-voices.js)" +
      (all.some((v) => v.localService) ? "" : " ⇒ ولا محلّيَّ واحداً: «لا يوجد» و«لم يصل» صفرٌ واحد (قرار 150) — أعد اللصق بعد ثوانٍ"));
    const vName = vis(VO.name) + "|" + VO.lang + "|محلّيّ" + (arL.length > 1 ? " (من " + arL.length + ")" : "");
    if (ua && !ua.hasBeenActive) {
      console.log("🟡 " + TAG + ": انقر مرّةً مساحةً فارغةً تحت المشغّل (عند العنوان) — لا الفيديو ولا الكونسول؛ النطقُ يحتاج تفاعلاً (120 ث).");
      const got = await new Promise((res) => { const EV = ["pointerdown", "click"]; let t = 0;
        const on = () => { if (ua.hasBeenActive) fin(true); }, fin = (y) => { clearTimeout(t); EV.forEach((e) => removeEventListener(e, on, true)); res(y); };
        EV.forEach((e) => addEventListener(e, on, true)); t = setTimeout(() => fin(false), 120000); });
      if (!got) return stop("userActivation.hasBeenActive = false بعد 120 ث — لا نطقَ بلا تفاعل؛ انقر الصفحةَ نفسَها لا الكونسول");
    }
    if (!V.paused || ss.speaking || ss.pending || ss.paused) return stop(!V.paused ? "الفيديو يعمل الآن (video.paused = false) — أوقفه وأعد اللصق" : "طابورُ الصفحة غيرُ فارغ: speaking=" + ss.speaking +
      " · pending=" + ss.pending + " · paused=" + ss.paused + " — أعد تحميل الصفحة (ولا pause()/resume() منّا)");
    const KEEP = [], say = (text, rate, vol, lim) => new Promise((res) => {   // ⚠️ KEEP يُمسك كلَّ نطقٍ حتى ينتهي — وإلا قد يجمعه كروم فيضيع end
      const u = new SpeechSynthesisUtterance(text), r = { dur: null, err: "" };
      let ts = 0, over = false, timer = 0;
      const fin = (err) => { if (over) return; over = true; clearTimeout(timer); r.err = err; r.started = ts > 0; if (!err) r.dur = (now() - ts) / 1000; const i = KEEP.indexOf(u); if (i >= 0) KEEP.splice(i, 1); res(r); };
      u.voice = VO; u.lang = VO.lang; u.rate = rate; u.volume = vol;
      u.onstart = () => { ts = now(); };                     // ⛔ المعالجاتُ قبل speak(): not-allowed يقع متزامناً داخلها
      u.onend = () => fin(ts ? "" : "end-بلا-start");        // ⭐ هكذا يُنهي كروم الجملةَ في تبويبٍ مكتوم
      u.onerror = (e) => fin((e && e.error) || "error");
      KEEP.push(u);   // ⛔ cancel() عامّةٌ لكلّ التبويبات ⇒ لا تُنادى إلا وجملتُنا الناطقة (بعد start)
      timer = setTimeout(() => { fin(ts ? "مهلة-بلا-end" : "مهلة-بلا-start"); if (ts) ss.cancel(); }, lim);
      ss.speak(u);
    });
    const sOf = (dur, winMs) => dur / (winMs / 1000 + TOL), STUCK = "مهلةٌ بلا start — الطابورُ عالقٌ خلف نطقٍ آخر؛ لم نُلغِ (cancel() عامّة): اخرج من كروم كلِّه (⌘Q على الماك · ⋮ ⇒ خروج على الويندوز — لا إغلاقُ النافذة) وأعد فتحه — فالتعليقُ عامٌّ للمتصفّح ولا تُزيله إعادةُ التحميل (📐 س13)";   // ⭐ s واحدةٌ للشاهدين وللجمل

    // ── الشواهد قبل العيّنة: تحميةٌ · المدّةُ مرّتين (السالب) · المسارُ بطرفيه ────────────────────
    console.log("🟢 " + TAG + ": ترجمةٌ " + arN + "/" + M + " عربيّة — الشواهدُ بصوت «" + vis(VO.name) + "» (نحو دقيقة، بصوتٍ خافت)…");
    const W10 = "هذا النصُّ اختبارٌ بسيطٌ لقياس مدّة النطق العربيّ في المتصفّح.", W40 = [W10, W10, W10, W10].join(" ");
    if ((await say("تجربة.", 1, VOL, 15000)).err === "مهلة-بلا-start") return stop(STUCK);
    const a = await say(W10, 1, VOL, 30000), b = await say(W10, 1, VOL, 30000), d1 = a.err || b.err ? null : (a.dur + b.dur) / 2, dv = d1 ? Math.abs(a.dur - b.dur) / d1 : null;
    const wNeg = "مدّتا الجملة نفسِها " + f2(a.dur) + "/" + f2(b.dur) + "ث (فرق " + (dv == null ? "؟" : (dv * 100).toFixed(1) + "٪") + ")";
    if (d1 == null) return stop("شاهدُ المدّة انتهى بخطأ: " + (a.err || "—") + " / " + (b.err || "—") + (/بلا-start/.test(a.err + b.err) ? " — التبويبُ مكتوم أو الطابورُ عالق" : ""));
    if (d1 < 2 || dv > 0.05) return stop(d1 < 2 ? "مدّةُ 10 كلماتٍ = " + f2(d1) + "ث — أقصرُ من أن تكون نطقاً؛ أنطق الصوتُ فعلاً؟" : "القياسُ غيرُ ثابت: " + wNeg + " > 5٪ (الشاهدُ السالب) — أعد اللصق مرّةً");
    const one = await say("مرحباً.", 1, VOL, 30000), forty = await say(W40, 1, VOL, 60000);
    const s1 = one.err ? null : sOf(one.dur, 5000), s40 = forty.err ? null : sOf(forty.dur, 500), wpm = forty.err ? null : Math.round(40 / (forty.dur / 60));
    const wPath = "s(كلمة/نافذة 5ث)=" + f2(s1) + " والمطلوب <1 · s(40 كلمة/نافذة 0.5ث)=" + f2(s40) + " والمطلوب >3";
    if (!(s1 < 1) || !(s40 > 3) || nW(W40) !== 40) return stop("شاهدا المسار لم يقعا: " + wPath + " (" + (one.err || "—") + " / " + (forty.err || "—") + ") ⇒ لا تُقرأ s بدالّةٍ لم تُفرّق (قرار 26)");

    // ── (د) العيّنة: كلُّ جملةٍ مرّةً بسرعة 1 — التاليةُ بعد end أو خطأ لا قبلهما ────────────────────
    console.log("🟢 " + TAG + ": الشواهدُ قائمة — أنطق " + M + " جملةً بالترتيب. لا تُخفِ التبويب.");
    const rows = []; let errs = 0, notAr = 0, playing = 0, firstErr = "";
    for (let i = 0; i < M; i++) {
      const x = sample[i]; if (vNow() !== vid) return stop("تنقّلتَ أثناء القياس: v = «" + vNow() + "» لا «" + vid + "» — أعد تحميل الصفحة");
      if (!AR.test(x.ar)) { notAr++; continue; } if (!V.paused) playing++;
      const r = await say(x.ar, 1, VOL, 30000); if (r.err === "مهلة-بلا-start") return stop(STUCK + " (عند الجملة " + (i + 1) + "/" + M + ")");
      if (r.err) { errs++; x.err = r.err; firstErr = firstErr || r.err; } else { x.dur = r.dur; x.sp = sOf(r.dur, x.win); rows.push(x); }
      console.log((r.err ? "🟡 " : "🟢 ") + TAG + " [" + (i + 1) + "/" + M + "] نافذة " + f2(x.win / 1000) + "ث · " + (r.err ? "خطأ: " + r.err : "عربيّ " + f2(r.dur) + "ث ⇒ s=" + f2(x.sp))); await sleep(250);
    }
    if (rows.length < 10) return stop("نُطقت " + rows.length + " من " + M + " (أخطاء " + errs + (firstErr ? " أوّلُها " + firstErr : "") + " · بلا ترجمةٍ عربيّة " + notAr + ") — أقلُّ من 10 جمل ⇒ لا حكم");

    // ── (هـ · و) الحساب والحكم ────────────────────────────────────────────────────────────────
    const re7 = (() => { const R = Array.isArray(cap.restored) ? cap.restored : []; if (!R.length) return "";   // ⭐ ما أعاده مِجَسّ 7 يُقرأ ثانيةً هنا بعد دقائق بلا شبكة — أثبت أم زال؟
      const dOf = (x) => { try { const o = JSON.parse(x); return o && typeof o === "object" && "data" in o ? JSON.stringify(o.data) : x; } catch (e) { return x; } };   // ⭐ البياناتُ لا الطابع
      const bad = R.filter((r) => { try { const c = (r.f === "ss" ? sessionStorage : localStorage).getItem(r.k); return r.v == null ? c != null : c == null || dOf(c) !== dOf(r.v); } catch (e) { return true; } });
      return " · الإعادةُ بعد " + (cap.at7 ? Math.round((Date.now() - cap.at7) / 60000) : "؟") + " د: " + (bad.length ? "⚠️ زالت في " + bad.map((r) => r.k).join(",") : "ثابتة (" + R.length + " مفتاحاً)"); })();
    const S = rows.map((x) => x.sp).sort((p, r) => p - r), q = (p) => qt(S, p), at = (t) => S.filter((v) => v <= t).length, sum = (f) => rows.reduce((p, x) => p + f(x), 0);
    const arSec = sum((x) => x.dur), enW = sum((x) => x.words), arCh = sum((x) => x.ar.replace(/\s+/g, "").length), winSec = sum((x) => x.win) / 1000, fits1 = at(1) >= 0.8 * S.length;
    globalThis.__vz168fit = { videoId: vid, kind: seg.kind, kindUrl: kindU, lang: lang, segmented: N, sampled: M, spoken: rows.length, errs: errs, notArabic: notAr,
      translateP50ms: qt(lat, 0.5), s: { p50: q(0.5), p75: q(0.75), p80: q(0.8), p90: q(0.9), max: S[S.length - 1] }, share: TH.reduce((o, t) => { o[t] = at(t) / S.length; return o; }, {}),
      arSecPerEnWord: arSec / enW, arCharsPerSec: arCh / arSec, enWpm: enW / winSec * 60, voice: VO.name, voiceWpm40: wpm, witnesses: { dur: [a.dur, b.dur], s1: s1, s40: s40 }, env: env,
      rows: rows.map((x) => ({ start: x.start, end: x.end, win: x.win, en: x.text, ar: x.ar, dur: x.dur, s: x.sp })) };
    // ⛔ الرمزُ وp80 مؤشّرُ هذا الفيديو لا حكمُ K3: K3 لكلّ نظامٍ على حصّة جمل العشرة مجتمعةً بـR_max الفعليّة (§٦ صفّ 5) ⇐ s مرتّبةً في السطر لذلك
    emit(TAG + (fits1 ? " ✅ **يتّسع بسرعته الطبيعيّة**: ≥80٪ من الجمل s ≤ 1 ⇒ مؤشّرُ الملاءمة قائمٌ بأيّ R_max ≥ 1 لهذا الفيديو — وK3 على العشرة مجتمعةً"
      : " ⚪ **قِيس بشواهده والحكمُ ينتظر R_max (👁)**: مؤشّرُ الملاءمة p80 = " + f2(q(0.8)) + " ≤ R_max الفعليّة ⇐ vz168fit.listen() لهذا الفيديو — وK3 على العشرة مجتمعةً") +
      " (لكلّ نظامٍ بحصّة جملها بـR_max الفعليّة) · فيديو=" + vid + " · حكمُ مِجَسّ 7=" + (cap.verdict || "؟") + (cap.trace ? " (أثر: " + cap.trace + ")" : "") + re7 +
      " · الشكل=" + (seg.kind === "asr" ? "كلماتٌ بتوقيتها (tOffsetMs)" : "بلا توقيت كلمات (قطعٌ عند الترقيم داخل الأحداث بزمنٍ نسبيّ)") + " kind=" + (kindU || "—") + " lang=" + lang +
      ((kindU === "asr") !== (seg.kind === "asr") && kindU ? " ⚠️ kind في الرابط يخالف الشكل" + (/xwmhp/.test(cu ? cu.searchParams.getAll("exp").join(",") : "") ? " (exp=" + cu.searchParams.getAll("exp").join(",") + ": ذراعُ تجربةٍ تدمج الكلمات 📄)" : "") : "") +
      " · جمل: عيّنة " + M + " من " + N + " (قسمة: فجوة " + why.gap + " · ترقيم " + why.punct + " · سقف " + why.cap + " · غيرُ كلام " + seg.drop + ") · نُطقت " + rows.length +
      " · أخطاء " + errs + (firstErr ? " (" + firstErr + ")" : "") + " · بلا ترجمةٍ عربيّة " + notAr + " · ترجمة: عربيّ " + arN + "/" + M + " · p50 " + Math.round(qt(lat, 0.5)) + "ms" +
      " · **s الفعليّة = مدّةُ العربيّ ÷ (النافذة + 0.5ث): p50 " + f2(q(0.5)) + " · p75 " + f2(q(0.75)) + " · p80 " + f2(q(0.8)) + " · p90 " + f2(q(0.9)) + " · أقصى " + f2(S[S.length - 1]) +
      "** · حصّةُ الجمل " + TH.map((t) => "≤" + t + "⇐" + pc(at(t), S.length) + "(" + at(t) + "/" + S.length + ")").join(" ") + " · s مرتّبة=" + S.map(f2).join(",") +
      " · صفوف(نافذة/عربيّ ث بترتيب العيّنة)=" + rows.map((x) => f2(x.win / 1000) + "/" + f2(x.dur)).join(",") + " · العربيّ " + f2(arSec / enW) + "ث لكلّ كلمةٍ إنجليزيّة · " + f2(arCh / arSec) +
      " حرفاً/ث (بلا مسافات) · الإنجليزيّة " + Math.round(enW / winSec * 60) + " كلمة/دقيقة على نوافذها · شاهد−: " + wNeg + " ≤5٪ ✅ · شاهدا المسار: " + wPath + " ✅ · المُقسِّم ✅" +
      " · ⚠️ s سرعةٌ فعليّة لا سرعةُ كروم: ما يُنتجها يختلف بالنظام (مِجَسّ 4 يقيس المنحنى، وlisten() هنا)" + (playing ? " · ⚠️ الفيديو عمل أثناء " + playing + " جملة" : "") +
      (hidden ? " · ⚠️ خُفي التبويبُ أثناء القياس" : "") + " · 🎯 فجوة " + GAP_A + "ms/" + CAP_A + " كلمة (تلقائيّ) · " + GAP_M + "ms/" + CAP_M + " (يدويّ) · حجم " + VOL +
      " · سرعة 1 · صوت=" + vName + " ≈" + wpm + " كلمة/دقيقة (40 كلمة) · طلباتُنا=0 · بصر: getPlayerResponse=function · ytcfg=" + typeof globalThis.ytcfg + tail);

    // ── (ز) ما بعد السطر: listen · compare · reveal — **لا يعمل شيءٌ منها حتى يُنادى** ──────────────
    const M7 = globalThis.__vz168capMem || null, NET = globalThis.__vz168net = globalThis.__vz168net || { n: 0, max: 1, stop: "", log: [] };   // ⛔ السقفُ للصفحة لا للّصقة
    const brk = () => (M7 && M7.stop ? "قاطعُ مِجَسّ 7 مرفوعٌ منذ " + M7.stop.at + " (" + M7.stop.why + ")" : NET.stop ? "القاطعُ مرفوع (" + NET.stop + ")" : "");
    const trip = (w) => { NET.stop = w; if (M7 && !M7.stop) M7.stop = { at: clock(), why: "طلبُ مِجَسّ 5 (compare) " + w }; };   // ⭐ قاطعٌ واحدٌ للصفحة مع مِجَسّ 7
    const red = (s) => s.replace(/([?&]pot=)([^&]*)/g, (m, k, v) => k + "⟨" + v.length + " حرفاً⟩");
    const netTail = () => " · طلباتُنا=" + NET.n + "/" + NET.max + (M7 && M7.req && M7.req[vid] ? " (وطلبُ مِجَسّ 7 لهذا الفيديو عند " + M7.req[vid] + ")" : "") +
      (NET.log.length ? " [" + NET.log.join(" · ") + "]" : "") + (brk() ? " · " + brk() : "") + tail;
    const busy = (name) => (globalThis.__vz168a5 === true ? "__vz168a5 = true (تشغيلةٌ جارية) — انتظر سطرَها" : ss.speaking || ss.pending ? "طابورُ الصفحة غيرُ فارغ (speaking=" + ss.speaking + ")"
      : vNow() !== vid ? "تنقّلتَ: v = «" + vNow() + "» لا «" + vid + "»" : name === "listen" && !V.paused ? "الفيديو يعمل (video.paused = false) — أوقفه" : "");
    const wrap = (name, fn) => (arg) => Promise.resolve().then(() => fn(arg)).catch((e) => console.log(TAG + "/" + name + " ⛔ · المِجَسُّ نفسُه رمى: " + ((e && e.stack) || e) + " — عطبُ أداةٍ لا جواب، أبلِغ بهذا السطر"));
    // ⛔ listen() مرّةً للصفحة ولهذا الفيديو (لا للّصقة): اختيارُه حتميّ، فالثانيةُ الجملُ نفسُها بالترتيب نفسِه تُفهم بالذاكرة — ولا تُستهلك إلا بجملةٍ نُطقت فعلاً
    const heardAt = () => { const h = globalThis.__vz168heard; return h && h.vid === vid ? h.at : ""; };
    const listen = async () => {   // ⭐ لكلّ سرعةٍ جملةٌ مختلفة: الجملةُ المعادةُ بتصاعدٍ تُفهم بالذاكرة لا بالسمع، فيعلو R_max زوراً
      if (heardAt()) return emit(TAG + "/listen ⛔ · جرى في هذه الصفحة عند " + heardAt() + " — الجملُ نفسُها بالترتيب نفسِه تُفهم بالذاكرة لا بالسمع ⇒ R_max يُقرأ من سطره الأوّل" + tail);
      const g = busy("listen"), byWin = rows.slice().sort((p, r) => p.win - r.win), lg = byWin.filter((x) => x.dur >= L_MIN), pool = lg.length >= RATES.length ? lg : byWin;
      const mid = pool.length >> 1, xs = pool.slice(Math.max(0, mid - 4)).slice(0, RATES.length), got = [];   // حول النافذة الوسيطة — والجملُ ≥10 مضمونةٌ والويندوزُ يحتاج 9
      if (g) return emit(TAG + "/listen ⛔ " + g + tail); globalThis.__vz168a5 = true;
      console.log("🟢 " + TAG + "/listen: " + xs.length + " جملٍ مختلفة، لكلّ سرعةٍ جملةٌ تُسمع مرّةً وأسرعُ من سابقتها — **بعد كلّ جملةٍ دوّن «فهمتُ» أو «لم أفهم» قبل التالية** (" + L_GAP / 1000 + " ث بينهما)");
      try { for (let i = 0; i < xs.length; i++) {   // 🎯 الحجمُ 0.8: مسموعٌ للحكم
        console.log("🟢 " + TAG + "/listen: **الجملة " + (i + 1) + "/" + xs.length + " — سرعةُ كروم " + RATES[i] + "** — أصغِ…");
        const z = await say(xs[i].ar, RATES[i], L_VOL, 30000); got.push(z); if (z.started && !heardAt()) globalThis.__vz168heard = { vid: vid, at: clock() }; if (z.err === "مهلة-بلا-start") break;
        console.log("   ⇐ دوّن للجملة " + (i + 1) + ": «فهمتُ» أو «لم أفهم»"); if (i < xs.length - 1) await sleep(L_GAP); } } finally { delete globalThis.__vz168a5; }
      // ⭐ الفعليّةُ = مدّةُ الجملة بسرعة 1 (من العيّنة) ÷ مدّتها هنا — وأولاها بسرعة 1 فحصٌ يجب أن يقارب 1.00
      const re = got.map((z, i) => (z.err || !(z.dur > 0) ? null : xs[i].dur / z.dur)), c1 = re[0], c1ok = c1 != null && Math.abs(c1 - 1) <= 0.05;
      const hung = got.length > 0 && got[got.length - 1].err === "مهلة-بلا-start";
      emit(TAG + "/listen " + (hung ? "⛔ " + STUCK + " (عند الجملة " + got.length + "/" + xs.length + ") · وما قِيس قبلها "
        : "⚪ 👁 **اذكر لكلّ جملةٍ «فهمتُ / لم أفهم»، وأعلى سرعةٍ فهمتَها (R_max): " + RATES.join(" · ") + "** — إن فهمتَ أعلاها فـR_max ≥ ذلك (مقصوصٌ بالسقف المعروض) · والمقيسُ هنا ") +
        "[الجملة: سرعةُ كروم ⇐ الفعليّة (مدّتُها بسرعة 1 ÷ مدّتُها هنا) ⇒ حصّةُ جمل الفيديو التي تتّسع بها · نافذتُها]: " +
        got.map((z, i) => "ج" + (i + 1) + ": " + RATES[i] + (z.err ? " ⇐ خطأ " + z.err : re[i] != null ? " ⇐ " + f2(re[i]) + " ⇒ " + pc(at(re[i]), S.length) + "(" + at(re[i]) + "/" + S.length + ")" : " ⇐ ؟") + " · نافذة " + f2(xs[i].win / 1000) + "ث").join(" · ") +
        " · فحصُ سرعة 1 (ج1 ⇐ " + f2(c1) + "): " + (c1ok ? "✅ ≈1.00" : "⚠️ والمتوقَّع ≈1.00 (±5٪) ⇒ الفعليّاتُ هنا تُقرأ بحذر") +
        " · الجمل: " + (pool === lg ? xs.length + " من " + lg.length + " جملةً ≥" + L_MIN + "ث بسرعة 1" : "من الجمل كلِّها (≥" + L_MIN + "ث بسرعة 1 = " + lg.length + " < " + RATES.length + ")") +
        " حول النافذة الوسيطة · منصّة=" + (WIN ? "الويندوز ⇒ درجاتُ SAPI 0 و3–10 (📖 §٩)" : "غيرُ الويندوز") + " · 🎯 حجم " + L_VOL + " · مهلة " + L_GAP / 1000 + "ث بين الجمل · " +
        got.map((z, i) => "ج" + (i + 1) + " «" + xs[i].ar + "» ⇐ «" + xs[i].text + "»").join(" · ") + " · صوت=" + vName + tail);
    };
    let pairs = [], revealed = false;
    const compare = async (go) => {
      if (go !== true) return console.log("🟡 " + TAG + "/compare: ⚠️ **يُرسل طلباً واحداً إلى /api/timedtext بـtlang=ar** — قد يُردّ بـ429، وبلاغٌ واحد (2026-10-22) رأى بعده " +
        "حظراً لكلّ الترجمات النصّية عن عنوانه ساعات. **وهو الطلبُ الثاني منّا لهذا الفيديو (§٣: واحد) — و429 عليه يُعدّ K4 بنصّه، ويُنهي طلباتِ اليوم على " +
        "الاتصال كلِّه؛ فشغّله آخرَ خطوةٍ تطلب الشبكة في اليوم.** للمتابعة: vz168fit.compare(true)");
      if (seg.kind !== "asr") return emit(TAG + "/compare ⛔ · مؤجَّلٌ بلا طلب: الجملُ هنا قطعٌ داخل أحداث الترجمة، وترجمةُ يوتيوب بالحدث كلِّه ⇒ الزوجُ يكشف نفسَه بطوله فلا يكون أعمى" +
        " (📐 مراجعة 2026-11-01) — يُعاد بناؤه بالحدث قبل س26 · طلباتُنا=0" + tail);
      const src = String(cap.capturedUrl || ""), qi = src.indexOf("?"); let u = null; try { u = new URL(src); } catch (e) { u = null; }
      const g = busy("compare") || (brk() ? brk() + " — لا طلبَ بعده في هذه الصفحة" : NET.n >= NET.max ? "سقفُ طلباتنا " + NET.max + " استُنفد في هذه الصفحة"
        : !u || qi < 0 || u.origin !== location.origin || u.pathname !== "/api/timedtext" ? "__vz168cap.capturedUrl = «" + red(src).slice(0, 80) + "» — المطلوب رابطُ /api/timedtext على " + location.origin : "");
      if (g) return emit(TAG + "/compare ⛔ " + g + netTail());
      // ⭐ معاملاتُ المشغّل بنصّها كما يبنيها مِجَسّ 7 (لا إعادةَ ترميز): بلا tlang/variant/fmt، ثمّ fmt=json3 وtlang=ar
      const href = src.slice(0, qi) + "?" + src.slice(qi + 1).split("&").filter((x) => x && !/^(tlang|variant|fmt)(=|$)/.test(x)).concat("fmt=json3", "tlang=ar").join("&");
      const ac = new AbortController(), t0 = now(), when = clock(), tm = setTimeout(() => ac.abort(), 15000); let st = 0, body = "", fail = "";
      NET.n++; globalThis.__vz168a5 = true; console.log("🟡 " + TAG + "/compare: طلبُنا " + NET.n + "/" + NET.max + " @" + when + " GET " + red(href));
      try { const resp = await fetch(href, { signal: ac.signal, credentials: "include" }); st = resp.status; body = await resp.text(); }
      catch (e) { fail = errName(e); } finally { clearTimeout(tm); delete globalThis.__vz168a5; }
      NET.log.push(when + " " + (fail || "HTTP " + st) + " " + body.length + "B " + Math.round(now() - t0) + "ms " + red(href));
      if (fail || st !== 200 || !body.trim()) trip(fail ? "رمى" : st === 429 ? "429" : !body.trim() ? st + " بجسمٍ فارغ" : "HTTP " + st);   // ⭐ كلُّ ردٍّ غيرِ 200 رفضٌ ولو بجسم (403 · 5xx) — ولا 200 وحدَها
      if (fail || st !== 200 || !body.trim()) return emit(TAG + "/compare ⛔ " + (fail ? "الطلبُ رمى: " + fail + " (وتحويلُ حظرٍ يظهر فشلاً)"
        : st === 429 ? "**429 على طلبنا tlang** — K4 بنصّه؛ و§٩: رفضُ tlang لم يمسّ الأصليّةَ في yt-dlp خارج المتصفّح ⇒ نسبتُه إلى K4 للمالك"
        : !body.trim() ? "**" + st + " بجسمٍ فارغ** — رمزُ PO لا يصلح لـtlang من غير المشغّل أو انتهى (📄 §٩)" : "**HTTP " + st + "** على طلبنا tlang") +
        (NET.stop ? " · " + BREAK : "") + netTail());   // ⛔ نصُّ التوقّف يبدأ بـBREAK بحرفه — والقاطعُ وطلبُنا في netTail
      let ye = null; try { const jj = JSON.parse(body); ye = Array.isArray(jj.events) ? jj.events : null; } catch (e) { ye = null; }
      if (!ye) return emit(TAG + "/compare ⛔ الردّ ليس json3 (" + body.length + " بايتاً، أوّلُه «" + body.slice(0, 40) + "»)" + netTail());
      let used = 0; seg.sents.forEach((x) => { x.yt = []; });   // ── المحاذاة: كلُّ حدثٍ عربيٍّ لجملةٍ واحدة — أكبرِها تداخلاً معه بالزمن ──
      ye.forEach((e) => { const t = clean((e.segs || []).map((g2) => g2.utf8 || "").join("")); if (!t || e.aAppend || typeof e.tStartMs !== "number") return;
        const p0 = e.tStartMs, p1 = p0 + (e.dDurationMs || 0); let best = null, bo = 0;
        for (const x of seg.sents) { if (x.start >= p1) break; const o = Math.min(p1, x.end) - Math.max(p0, x.start); if (o > bo) { bo = o; best = x; } }
        if (best) { best.yt.push(t); used++; } });
      const PP = sample.filter((x) => AR.test(x.ar) && AR.test(x.yt.join(" "))).map((x) => ({ en: x.text, c: x.ar, y: x.yt.join(" ") }));
      const tok = (s) => new Set(String(s).replace(/[\u064B-\u0652\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").split(/[^\u0621-\u064A0-9]+/).filter((w) => w.length > 1));
      const jac = (p, r) => { const A = tok(p), B = tok(r); let k = 0; A.forEach((w) => { if (B.has(w)) k++; }); return A.size + B.size - k ? k / (A.size + B.size - k) : 0; };
      const mean = (f) => (PP.length ? PP.reduce((p, x, i) => p + f(x, i), 0) / PP.length : 0), jA = mean((x) => jac(x.c, x.y)), jR = mean((x, i) => jac(x.c, PP[(i + (PP.length >> 1)) % PP.length].y));
      const wAl = "محاذاة: " + used + " من " + ye.length + " حدثاً ⇐ " + PP.length + " من " + M + " جملةً بالترجمتين · تشابهُ الكلمات: المتقابلان " + f2(jA) + " والمُزاحان " + f2(jR);
      if (PP.length < 5 || !(jA > 2 * jR)) return emit(TAG + "/compare ⛔ المحاذاةُ لا تُفرّق أو لا تكفي (" + wAl + "؛ والمطلوب ≥5 أزواجٍ والمتقابلان > ضعفَي المُزاحَين) ⇒ لا أزواجَ تُعرض" + netTail());
      for (let i = PP.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)), t = PP[i]; PP[i] = PP[k]; PP[k] = t; }
      pairs = []; revealed = false;                           // ⛔ الخريطةُ في هذا الإغلاق وحدَه — لا على globalThis
      const txt = PP.slice(0, 10).map((x, i) => { const cf = Math.random() < 0.5; pairs.push(cf ? "كروم" : "يوتيوب"); return (i + 1) + ") EN: " + x.en + "\n   أ: " + (cf ? x.c : x.y) + "\n   ب: " + (cf ? x.y : x.c); });
      console.log("🟡 " + TAG + "/compare — " + txt.length + " أزواج، وترتيبُ كلٍّ عشوائيٌّ مخفيّ. لكلّ زوجٍ اختر الأوضح: أ أو ب (= للتعادل):\n\n" + txt.join("\n\n") +
        "\n\nثمّ اكتب: vz168fit.reveal(\"أبأأب…\") — حرفٌ لكلّ زوجٍ بترتيبه (" + txt.length + " أحرف)");
      emit(TAG + "/compare ⚪ 👁 عُرض " + txt.length + " أزواجٍ بلا أسماء — والحكمُ لك في reveal() · " + wAl + " ✅" + netTail());
    };
    const reveal = (ans) => {
      const s = String(ans == null ? "" : ans).replace(/\s+/g, "").replace(/[اإآaA]/g, "أ").replace(/[bB]/g, "ب"), n = { "كروم": 0, "يوتيوب": 0, "تعادل": 0 };
      const g = !pairs.length ? "لا أزواجَ معروضة — نادِ vz168fit.compare(true) أوّلاً" : revealed ? "كُشفت الخريطةُ مرّةً — الجوابُ الأوّلُ هو الحكم"
        : s.length !== pairs.length || /[^أب=]/.test(s) ? "الجواب = «" + String(ans) + "» (" + s.length + " حرفاً) — المطلوب " + pairs.length + " أحرفٍ من أ · ب · = بترتيب الأزواج" : "";
      if (g) return emit(TAG + "/reveal ⛔ " + g + tail); revealed = true;
      s.split("").forEach((c, i) => { n[c === "=" ? "تعادل" : c === "أ" ? pairs[i] : pairs[i] === "كروم" ? "يوتيوب" : "كروم"]++; });
      emit(TAG + "/reveal ✅ 👁 **الأوضحُ عندك: مترجمُ كروم " + n["كروم"] + " · ترجمةُ يوتيوب (tlang) " + n["يوتيوب"] + " · تعادل " + n["تعادل"] + "** من " + pairs.length +
        " (بلا أسماء) · الخريطة: " + pairs.map((p, i) => (i + 1) + "أ=" + p).join(" ") + " · جوابُك=" + s + netTail());
    };
    globalThis.vz168fit = { listen: wrap("listen", listen), compare: wrap("compare", compare), reveal: wrap("reveal", reveal) }; console.log("🟢 " + TAG + ": التالي — vz168fit.listen() لـR_max · vz168fit.compare() للمقارنة العمياء (طلبُ شبكةٍ واحد — الثاني منّا لهذا الفيديو، فآخرَ اليوم — يُحذّر أوّلاً)");
  } finally {
    delete globalThis.__vz168a5; document.removeEventListener("visibilitychange", onVis);
    try { if (tr && typeof tr.destroy === "function") tr.destroy(); } catch (e) {}
  }
})().catch((e) => console.log("VZ-168أ-5 ⛔ · المِجَسُّ نفسُه رمى: " + ((e && e.stack) || e) + " — عطبُ أداةٍ لا جواب، أبلِغ بهذا السطر"));
