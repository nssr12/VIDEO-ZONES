// مِجَسّ 168أ-7 — **أنأخذ نصَّ الفيديو كاملاً بتوقيته من طلب المشغّل نفسِه — بطلبٍ واحدٍ منّا وبلا أثرٍ ظاهر؟** يُلصق في كونسول صفحة المشاهدة على يوتيوب، والسياقُ top (عالمُ الصفحة).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أضغط «دبلِج» — أتأخذ الإضافةُ كلامَ الفيديو كلَّه بتوقيته كما
// يجلبه يوتيوب لنفسه، بطلبٍ واحدٍ منها، دون أن تتغيّر ترجمتي المعروضة أو زرُّ CC، ودون أن يُحظر اتصالي بالإنترنت من الترجمات؟»*
//
// ── لماذا يُقاس قبل أيّ بناء (AUDIT القسم السابع عشر §٣ «الالتقاط» · خ9 · K2 · K4) ──────────────────
// رمزُ PO يصنعه المشغّل، وبدونه 200 بجسمٍ فارغ (📐 §٩) ⇒ **يُلتقط رابطُ المشغّل حيّاً ثمّ يُجلب json3 كاملاً بطلبٍ
// واحدٍ منّا** (T1 في خ9). **K2 يُسقط السلسلةَ المجانيّة إن سقط هذا بلا أثرٍ ظاهر في فيديوهين من العشرة، وK4 يُوقفه
// عند أوّل 429 يُنسب إلينا** — وحظرٌ واحدٌ عمّ كلَّ ترجمات عنوانٍ ساعات (📄 §٩) ⇒ **الميزانيةُ في الكود لا في النيّة.**
//  · **الأثرُ لا الوجود (قرار 109):** رابطٌ مُلتقَطٌ ليس نصّاً، و«200» ليس نصّاً ⇒ يُجلب ويُحلَّل ويُعدّ.
//  · **السببُ لا الأثر (قرار 48):** موضعُ المؤشّر المحفوظ عندنا (#156) لا يُقرأ من عالم الصفحة ⇒ **يُعدّ سببُ تصفيره:
//    حدثُ فأرةٍ غيرُ موثوق** · ولا يُعدَّل طلبُ المشغّل — يُقرأ بعد وقوعه، ويُبنى طلبُنا من نسخته.
//  · **الرفضُ يُسمّي شرطَه بقيمته (قرار 140)** — وعالمُ الإضافة يرى #movie_player ولا يرى دوالَّه (📐 AUDIT) ⇒ top وحدَه.
//  · **والمصدرُ بترتيب مجسّ 8 (decide):** البثُّ ثمّ §٣ حرفاً، ولغةُ الكلام من التلقائيّة ثمّ المسار الافتراضيّ — **منقولٌ
//    بمعناه لا بنصّه؛ إن تغيّر هناك غُيّر هنا.** ⚪ لما لا مصدرَ له، قبل أيّ طلب. **ومن البحث (📄):** المشغّلُ يضيف إلى طلبه
//    pot وpotc=1 وc=WEB · المقفلُ exp=xpe أو xpv · وjson3 = events[].segs[].utf8، ⛔ ~~وللتلقائيّة tOffsetMs لكلّ كلمة~~ — 📐 2026-10-31: لا عند
//    المالك (`exp=xpo,xwmhp` ذراعُ تجربةٍ ليوتيوب تدمج الكلمات في أحداثٍ مرقّمة 📄) ⇒ «توقيتُ الكلمات=لا» نتيجةٌ لا عطب.
//
// ── ⛔ الشواهد — ولا حكمَ بدونها (قرار 26 · قرار 150) ──────────────────────────────────────────
//  · **سالب:** 2.5 ث بلا فعل ⇒ **صفرُ طلبٍ إلى /api/timedtext — والـCC مطفأً أو مضاءً سلفاً**، وإلا ⛔ **ولا إجبارَ ولا طلب**
//    (التقاطٌ بعده لا يُنسب إلى إجبارنا) — **وطلبٌ فيه مرفوضٌ يرفع القاطع**. ⛔ **ولا يُعفى منه CC المضاء:** طلبُ المشغّل
//    لنفسه في السكون هو ما يُبطل النسبة، لا عذرٌ لها.
//  · **بصرُ المراقب (قرار 150):** التقاطُه طلبَ المشغّل · ورؤيتُه طلبَنا بعنوانه · وعددُ كلّ الموارد. ⚠️ **والمخزَّنُ يُطبع
//    ولا يُعتمد** — يوتيوب يُفرغه حين يمتلئ (📖)، فالمراقبُ حيٌّ بلا buffered.
//  · **موجبُ الأثر (قرار 109):** json3 من طلبنا **بحدثٍ فيه نصّ** — لا «200» ولا «فيه pot».
//  · **الأثرُ الظاهر:** aria-pressed لزرّ CC · getOption("captions","track") · مفاتيحُ localStorage **وsessionStorage (2026-11-01)** التي فيها «caption» —
//    **قبلُ وبعد الإرجاع، بالقيمة لا بالطول، حتى يثبت التساوي ثانيةً** — ومفتاحٌ أُعيدت كتابتُه **بالبيانات نفسِها** (الطابعُ
//    الزمنيّ وحده) ⚠️ يُطبع ولا يُعدّ أثراً ظاهراً (K2) · وحدثُ فأرةٍ اصطناعيٌّ بعد الإجبار = 0 — **ومع اصطناعيّةٍ قبله ⛔ لا يُنسب إلينا.**
//  · ⭐ **M2+R — إعادةُ ما غيّره الإجبار (2026-10-31، بعد أوّل سطرٍ للمالك):** 📐 `setOption(track)` يحفظ لغةَ المسار «لاصقةً»
//    (`yt-player-caption-sticky-language`: عنده «ar» ⇐ «en» لحظةَ الإجبار، فضغطةُ CC التالية بالإنجليزيّة) ⇒ **مفتاحٌ تغيّرت
//    بياناتُه بعد الإجبار يُعاد بقيمته قبل الإجبار حرفاً (أو يُزال إن لم يكن) فورَ الإرجاع، ومرّةً ثانيةً إن تغيّر بعدها** —
//    **والتغيّرُ والإعادةُ يُطبعان: «أثرٌ أُزيل» غيرُ «أثرٌ ظاهر: لا»**، وما بقي بعد الإعادة «بقي أثر» ❌ كما كان (وK2 يقرأ «أُزيل» بجواب المالك على خ20).
//    · **مفاتيحُ مُعيِّن المسار وحدَها تُكتب** (اللاصقةُ وقائمةُ الجلسة، 📄 captions.js) **ومفتاحُ تشغيل CC** — **وما سواها يتغيّر في النافذة يُطبع ولا
//      يُكتب** (كاتبٌ آخر؟ تبويبُ يوتيوب آخر يشارك التخزين) · **والنافذةُ من لقطة ما قبل الإجبار إلى آخر إعادة نحو 8–12 ث** (M1 خمسُ ثوانٍ ثمّ
//      M2) ⇒ ⛔ **لا تغيّر إعداداتِ الترجمة في أيّ تبويب يوتيوب حتى يُطبع السطر — وأغلق تبويباتِ يوتيوب الأخرى** · **وتحت القاطع مع CC
//      مضاءٍ يُترك مفتاحُ التشغيل مطفأً عمداً** (لا يُعاد «مضاء» فتطلب الصفحةُ التالية من اتصالٍ مرفوض).
//    · **والمراقبةُ ثانيتان بعد آخر كتابةٍ منّا** (🎯) — وإلا رأينا كتابتَنا لا ثباتَها · **ومشغّلٌ يعيد كتابةَ ما أعدناه ⇒ ❌** (ذاكرتُه تحمل لغةَ
//      المصدر) ولو أُعيد ثانيةً.
//    · **والجلسةُ معه:** مُعيِّنُ المسار يُلحق لغتَه أيضاً بـ`sessionStorage[yt-player-caption-language-preferences]` (📄 captions.js 11a45ffb:
//      تُرسل إلى الخادم مع طلبات /player) ⇒ **مفاتيحُ «caption» في التخزينين تُقرأ وتُعاد** · **والأثرُ ما تغيّر بعد الإجبار:** لقطةٌ ثانيةٌ
//      عنده (B1) — وتغيّرٌ في السكون قبله يُطبع «لا يُنسب إلينا» ولا يُعدّ.
//    · ⛔ **أساسٌ مُقنَّع ⇒ رفضٌ قبل أيّ طلب:** لاصقةٌ هي لغةُ المصدر لا يغيّرها الإجبار (يكتبها بالبيانات نفسِها) فقال القديمُ «أثرٌ ظاهر:
//      لا» ✅ زوراً والإعادةُ لم تُختبر (📐 بعد أوّل تشغيلةٍ صارت «en» عند المالك) ⇒ **⛔ بطلباتُنا=0 ويُسمّى سطرُ الإرجاع** — لا ⚪ بعد طلبٍ
//      مُنفَق (⛔ ~~⚪ بعد الطلب بختم الإنشاء~~ سُحب 2026-11-01: أخطأ حين تكتب إعادتُنا اللاصقةَ نفسَها، وأنفق طلباً على ما يُعرف قبله).
//
// ── ⚠️ حدودٌ مُعلَنة ────────────────────────────────────────────────────────────────────────
//  · **المشغّلُ قد يخدم مساراً عرضه قبلُ من ذاكرته بلا طلب** ⇒ أعد تحميل الصفحة قبل اللصق · **والظهورُ المؤقّت** (CC
//    مضاءٌ بين الإجبار والإرجاع) يُطبع ولا يُحكم به · **وتشغيلةٌ واحدة = حالٌ واحدة** (التنويعاتُ تشغيلات، §٦ صفّ 7).
//  · **الشبكةُ في التشغيلة الواحدة:** طلبٌ واحدٌ يُجبَر عليه المشغّل وطلبٌ واحدٌ منّا — **وحتى طلبين آخرين للمشغّل في
//    تنويعات CC المضاء** (الانتقالُ إلى المصدر ثمّ إرجاعُ مسارك)، **وثانٍ في الأساسيّة إن طلبت الوحدةُ حين تُحمَّل مساراً
//    غيرَ المصدر** (📖 لم يُقس). ⛔ **وأوّلُ رفضٍ لأيّ طلب timedtext** — ≥400، أو 200 برؤوسٍ بلا جسم، للمشغّل أو لنا، في
//    السكون أو بعد الإجبار — **يرفع القاطعَ ويُوقف ما بعده:** لا M2 ولا setOption ولا طلبَ منّا، **والإرجاعُ بلا شبكة**
//    (CC المضاءُ يُطفأ إن كان إرجاعُ مسارك طلباً) · **وstatus=0 ليس رفضاً** (الإلغاءُ يُعطيه 📐) **إلا مصدراً لم يكتمل غيرُه
//    حتى المهلة** · **وإعلانٌ أو تنقّلٌ أثناء القياس ⛔ لا يُعدّ في K2.**
//  · **شكلُ مسار الصوت غيرُ موثَّق** ⇒ يُقرأ كمجسّ 8، **وإن لم يُرَ قيل «(١) لم تُقيَّم» ومضى الالتقاط** (سؤالُه النصّ لا
//    الصوت) · **وخ12 لم يُقرَّر** ⇒ لغةُ الكلام تُطبع ولا تُحكم · **والماكُ وحدَه شرطُ هذا المجسّ** (§٥).
//  · **القاطعُ وحارسُ «طلبٍ لكلّ فيديو» في ذاكرة الصفحة لا التخزين** ⇒ إعادةُ التحميل تنساهما، و«لا طلبَ آخر اليوم» عهدةُ
//    الإنسان — **على الاتصال كلِّه لا على الجهاز** (الحظرُ على العنوان، 📄 §٩)، **ولا إعادةَ على فيديو وقع طلبُه** · ⛔ ~~**ولا
//    كتابةَ في أيّ تخزين:** ما يكتبه يوتيوب جانبيّاً يُطبع ولا نمحوه~~ — **سُحب بالقياس 2026-10-31 (قرار 21):** ما يكتبه يوتيوب
//    جانبيّاً **بسبب إجبارنا** كان يبقى عند المالك لغةً لاصقة ⇒ **يُعاد هو وحدَه بقيمته قبل الإجبار (M2+R أعلاه)، ولا يُكتب غيرُه** ·
//    **وذاكرةُ المشغّل في الصفحة نفسِها لا تُقرأ:** إن حفظ اللغةَ في ذاكرته فقد تأتي ضغطةُ CC التالية **في الصفحة نفسِها** بلغة
//    المصدر حتى يُعاد التحميل — **التخزينُ يُعاد ويُراقَب ثانيتين، والذاكرةُ لا: حدٌّ مُعلَنٌ لم يُقس** (⛔ ~~ضغطةُ CC للتحقّق تكتب
//    اللغةَ ثانيةً~~ — 📄 captions.js: زرُّ CC يقرأ اللاصقةَ ولا يكتبها، **واختيارُ لغةٍ من قائمة الترجمة يكتبها** — ⛔ **فلا تختر لغةً في
//    ذلك التبويب**) · **ومِجَسُّ 5 بعده في التبويب نفسِه يُعيد قراءةَ ما أُعيد بلا شبكة ويطبع أثبت أم زال** — يُقاس في 168ج بتشغيلةٍ لها إرجاعُها.
//  · **pot لا يُطبع — طولُه وحده** (⚠️ وسطرُ كروم الأحمر لطلبٍ مرفوضٍ فيه الرابطُ كاملاً برمزه ⇒ يُرسل سطرُنا وحدَه)؛
//    والرابطان في الذاكرة وحدَها (globalThis.__vz168cap لمجسّ الملاءمة 5): **capturedUrl** رابطُ المشغّل كما هو، و**fetchedUrl**
//    ما جلبناه نحن (بلا tlang ولا variant، وfmt=json3) · **والمقتطفان للعين ولا يُودَعان السجلّ** (§٨: لا نصوصَ حقيقيّة).
//  · **2.5 ث · 5 ث · 3 ث لأوّل طلبٍ من الوحدة · 1.5 ث (ومثلُها لجوابٍ مكتملٍ بعد إلغاء طلبها للمصدر) · 3 ث وثباتُ ثانية · 15 ث للطلب · خمسُ تشغيلاتٍ في اليوم للاتصال
//    كلِّه (الجهازان معاً) · ثانيتان مراقبةً بعد آخر كتابةٍ منّا (والسقفُ يمتدّ لها) · 16 حرفاً حدُّ عرض البيانات: اختياراتٌ لا قياس (قرار 96).**
//
// ── كيف يُستعمل ────────────────────────────────────────────────────────────────────────────
//   0) ⛔ **أغلق تبويباتِ يوتيوب الأخرى** (تشارك هذا التبويبَ تخزينَه)، **ولا تغيّر إعداداتِ الترجمة في أيّ مكانٍ حتى يُطبع السطر.**
//   1) افتح فيديو يوتيوب إنجليزيّاً له ترجمة، **ثمّ أعد تحميل الصفحة** (⌘R · F5)، واترك زرَّ CC في شريط تحكّم المشغّل
//      **مطفأً** للتشغيلة الأساسيّة. **وإن بدأ إعلانٌ فانتظر انتهاءه.**
//   2) الكونسول (⌥⌘J على الماك · F12 على الويندوز) ⇒ قائمةُ السياق في شريطه ⇒ **top** — ⛔ لا VIDEO ZONES ولا إطاراً آخر.
//   3) الصق هذا الملفَّ كلَّه واضغط Enter، **ولا تلمس الصفحةَ ولا الفأرةَ حتى يُطبع السطر** (10–20 ثانية) ⇒ سطرٌ واحدٌ
//      يبدأ بـ VZ-168أ-7 **يُنسخ وحدَه. أرسله كما هو.**
//   4) ⛔ **إن قال «توقّف: لا طلبَ آخر اليوم…» فلا مِجَسَّ يطلب الترجمة اليومَ من هذا الاتصال بالإنترنت ولا من أيّ جهازٍ
//      عليه (جهازُ الويندوز معه)** — وأرسل السطرَ وحدَه: سطرُ كروم الأحمر فوقه فيه رمزُ الطلب.
//   5) **التنويعات**، كلٌّ بعد إعادة تحميل **ولا أكثرَ من خمس تشغيلاتٍ في اليوم على الاتصال كلِّه (الجهازان معاً):** CC مضاءٌ
//      قبل اللصق · تبويبٌ مفتوحٌ ≥30 دقيقة · Clean Player يُخفي زرَّ CC · أتمتةُ الترجمة العربيّة مفعّلة · **وبعد نقرةٍ على
//      فيديو آخر بلا إعادة تحميل** — ⛔ **وكلٌّ على فيديو لم يقع طلبُنا له** (طلبٌ واحدٌ منّا لكلّ فيديو، §٣).
(async () => {
  const TAG = "VZ-168أ-7";
  const BREAK = "توقّف: لا طلبَ آخر اليوم من هذا الاتصال بالإنترنت ولا من أيّ جهازٍ عليه (جهازُ الويندوز معه) — قد يعمّ الحظرُ ترجماتِك العاديّة ساعات · أرسل هذا السطرَ وحدَه: سطرُ كروم الأحمر فوقه فيه رمزُ الطلب";   // ⛔ نصٌّ واحدٌ حرفاً في 7 و5 — خطواتُ المالك تقف على أوّله، والحظرُ على العنوان لا الجهاز (📄 §٩)
  const COPY = typeof copy === "function" ? copy : null;   // ⛔ يُمسَك قبل أوّل await — بعده تختفي (📐 الدفعة الأولى)
  const t0 = performance.now(), now = () => performance.now(), rel = (t) => Math.round(t - t0), sleep = (n) => new Promise((r) => { setTimeout(r, n); });
  const errName = (e) => (e ? String(e.name || "Error") + (e.message ? ": " + String(e.message).slice(0, 90) : "") : "؟");
  const cut = (s, n) => { s = String(s == null ? "—" : s).replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
  const p2 = (x, w) => String(x).padStart(w || 2, "0"), mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ":" + p2(s % 60); };
  const clock = (t) => { const d = new Date(t); return p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds()) + "." + p2(d.getMilliseconds(), 3); };
  const within = (pr, ms) => { let h = 0; return Promise.race([Promise.resolve(pr).catch(() => null), new Promise((r) => { h = setTimeout(r, ms, null); })]).finally(() => clearTimeout(h)); };
  const emit = (line) => { console.log(line); try { COPY(line); console.log("   (نُسخ إلى الحافظة)"); } catch (e) {} };
  const qs = (u) => { try { return new URL(String(u || ""), location.origin).searchParams; } catch (e) { return new URLSearchParams(""); } };
  const prim = (s) => String(s || "").split(".")[0].split(/[-_]/)[0].toLowerCase();   // ⭐ كمجسّ 8: الوسمُ الأوّل تماماً (درس #161)
  if (typeof document === "undefined") { emit(TAG + " ⛔ · لا مستندَ هنا: typeof document = undefined (عاملُ خدمة؟) — المطلوب عالم-الصفحة على www.youtube.com/watch"); return; }

  // ── البيئة — كالدفعة الأولى: «بيئة: macOS 26.2 arm64 · Chrome 156.0.8078.48» ──────────────────────
  let env = "بيئة: UA=" + navigator.userAgent; const uad = navigator.userAgentData;
  const h = uad && typeof uad.getHighEntropyValues === "function"
    ? await within(uad.getHighEntropyValues(["platform", "platformVersion", "architecture", "bitness", "fullVersionList"]), 3000) : null;
  if (h) {
    const L = h.fullVersionList || [], b = ["Google Chrome", "Microsoft Edge", "Chromium"].map((n) => L.find((x) => x.brand === n)).find(Boolean) || L[0] || { brand: "؟", version: "؟" };
    let ver = String(h.platformVersion || "؟");
    if (h.platform === "Windows") { const mj = parseInt(ver, 10); ver = (mj >= 13 ? "11" : mj > 0 ? "10" : "؟") + " (" + ver + ")"; } else ver = ver.replace(/(\.0)+$/, "");
    const arch = h.architecture === "x86" ? (h.bitness === "64" ? "x64" : "x86") : (h.architecture || "؟") + (h.bitness === "64" ? "64" : "");
    env = "بيئة: " + (h.platform || "؟") + " " + ver + " " + arch + " · " + String(b.brand).replace(/^Google /, "") + " " + b.version;
  } else env += " (UA-CH غائبٌ أو بلا جوابٍ خلال 3 ث)";

  // ── ⓪ السياق: عالمُ الصفحة وحدَه، وما عداه يُرفض بشرطه وقيمته (قرار 140) ───────────────────────
  const ext = location.protocol === "chrome-extension:", ours = typeof globalThis.extensionActive === "function";
  const rid = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) || "";
  const ctx = ext ? "صفحة-الإضافة" : ours ? "عالم-الإضافة" : rid ? "عالم-إضافةٍ-أخرى" : "عالم-الصفحة";
  const p = ext ? null : document.querySelector("#movie_player"), v = new URLSearchParams(location.search).get("v") || "";
  const gpr = p ? typeof p.getPlayerResponse : "لا عنصرَ #movie_player", bad = [];
  const MEM = globalThis.__vz168capMem || { stop: null, req: {}, busy: false };   // ذاكرةُ الصفحة لا التخزين
  const adOn = () => !!p && (p.classList.contains("ad-showing") || p.classList.contains("ad-interrupting"));
  if (ctx !== "عالم-الصفحة") bad.push("السياق = " + ctx + (rid ? " (chrome.runtime.id=" + rid + ")" : "") + " — المطلوب عالم-الصفحة («top» في قائمة سياق الكونسول)");
  if (window.top !== window) bad.push("الإطار = داخليّ (" + location.hostname + cut(location.pathname, 40) + ") — المطلوب الإطارُ الأعلى");
  if (!/^(www\.)?youtube\.com$/.test(location.hostname)) bad.push("المضيف = " + (location.hostname || location.protocol) + " — المطلوب www.youtube.com");
  if (location.pathname !== "/watch") bad.push("المسار = " + cut(location.pathname, 40) + " — المطلوب /watch");
  else if (!v) bad.push("v = غائبٌ من الرابط — المطلوب /watch?v=…");
  if (gpr !== "function") bad.push("typeof #movie_player.getPlayerResponse = " + gpr + (ours && p ? " (العالمُ المعزول يرى العنصرَ لا دوالَّه)" : "") + " — المطلوب function");
  if (ctx === "عالم-الصفحة" && globalThis.ytcfg == null) bad.push("شاهدُ البصر: ytcfg = " + typeof globalThis.ytcfg + " ⇒ لا يثبت أنّا في عالم صفحة يوتيوب");
  if (typeof PerformanceObserver !== "function" || (PerformanceObserver.supportedEntryTypes || []).indexOf("resource") < 0) bad.push("PerformanceObserver(resource) = غيرُ مدعوم");
  if (adOn()) bad.push("إعلانٌ يُعرض (#movie_player.ad-showing) — انتظر انتهاء الإعلان ثمّ الصق");
  if (MEM.stop) bad.push("قاطعُ الدائرة مرفوعٌ في هذه الصفحة منذ " + MEM.stop.at + " (" + MEM.stop.why + ") — " + BREAK);
  if (v && MEM.req[v]) bad.push("طلبُنا لهذا الفيديو وقع في هذه الصفحة عند " + MEM.req[v] + " — طلبٌ واحدٌ منّا لكلّ فيديو (§٣)؛ فقياسٌ جديدٌ على فيديو آخر — ⛔ لا هذا ولو أعدتَ التحميل، وكلُّ تشغيلةٍ تُعدّ في الخمس اليوميّة");
  if (MEM.busy) bad.push("__vz168capMem.busy = true — نسخةٌ أخرى من هذا المِجَسّ تعمل؛ انتظر سطرها");
  let pr = null, vd = null; if (!bad.length) {
    try { pr = p.getPlayerResponse(); } catch (e) { bad.push("getPlayerResponse() رمى " + errName(e)); } vd = (pr && pr.videoDetails) || null;
    const ps = pr && pr.playabilityStatus ? pr.playabilityStatus.status : "؟";
    if (!bad.length && !vd) bad.push("getPlayerResponse() = " + (pr ? "ردٌّ بلا videoDetails" : String(pr)) + " — انتظر بدءَ الفيديو ثمّ الصق");
    else if (vd && vd.videoId !== v) bad.push("videoDetails.videoId = " + vd.videoId + " والرابط v = " + v + " ⇒ المشغّلُ يحمل فيديو سابقاً — أعد تحميل الصفحة");
    else if (vd && ps !== "OK") bad.push("playabilityStatus.status = " + ps + " — المطلوب OK");
  }
  if (bad.length) { emit(TAG + " ⛔ · رفضٌ قبل القياس (السياقُ المكتشف " + ctx + "): " + bad.join(" · ") + " · طلباتُنا=0 · " + env); return; }

  // ── (أ) المصدر — decide() مجسّ 8 بمعناه: البثُّ ثمّ §٣ حرفاً، وtlang/variant تُتركان — ولا طلبَ قبله ───────
  const rd = (o, k) => { if (!o || typeof o !== "object") return undefined;     // حقلاً أو دالّةً أو getX() — كمجسّ 8
    try { let x = o[k]; if (typeof x === "function") x = x.call(o); const gt = o["get" + k.charAt(0).toUpperCase() + k.slice(1)];
      return x === undefined && typeof gt === "function" ? gt.call(o) : x; } catch (e) { return undefined; } };
  const aOf = (t, cur) => { const i = rd(t, "languageInfo"); return { lang: prim(rd(i, "id") || rd(i, "languageCode") || rd(t, "id")), def: rd(i, "isDefault") === true, cur: cur }; };
  const call = (n) => { try { return typeof p[n] === "function" ? p[n]() : undefined; } catch (e) { return undefined; } };
  const gc = call("getAudioTrack"), ga = call("getAvailableAudioTracks"), curId = gc ? String(rd(gc, "id") || "") : "";
  const sdF = ((pr.streamingData && pr.streamingData.adaptiveFormats) || []).filter((f) => /^audio\//.test(String((f && f.mimeType) || "")));
  const audio = sdF.filter((f) => f.audioTrack).map((f) => ({ lang: prim(f.audioTrack.id), def: f.audioTrack.audioIsDefault === true, cur: false }))
    .concat((Array.isArray(ga) ? ga : []).map((t) => aOf(t, !!gc && (curId ? String(rd(t, "id") || "") === curId : t === gc))), gc && typeof gc === "object" ? [aOf(gc, true)] : []);
  const audSeen = sdF.length > 0 || audio.some((a) => /^[a-z]{2,3}$/.test(a.lang)), defA = audio.find((a) => a.def) || null;
  const ren = (pr.captions && pr.captions.playerCaptionsTracklistRenderer) || null;
  const caps = (ren && Array.isArray(ren.captionTracks) ? ren.captionTracks : []).map((t) => { const q = qs(t.baseUrl), exp = q.getAll("exp").join(",").split(",");
    return { t: t, code: String(t.languageCode || "؟"), lang: prim(t.languageCode), asr: t.kind === "asr", skip: q.has("tlang") || q.has("variant"), gated: exp.indexOf("xpe") >= 0 || exp.indexOf("xpv") >= 0 }; });
  const lab = (c) => c.code + "·" + (c.asr ? "asr" : "يدويّ") + (c.gated ? "·مقفل" : "") + (c.skip ? "·مُتخطّى" : "");
  const ok = caps.filter((c) => !c.skip), asrC = ok.find((c) => c.asr) || null, man = ok.filter((c) => !c.asr), spoken = asrC ? asrC.lang : defA ? defA.lang : "";
  const T = { live: "بثٌّ مباشر — خارج النطاق", arNow: "لا دبلجة: المسارُ الجاري عربيّ", arOffer: "لا دبلجة: يُقترح مسارُ يوتيوب العربيّ (خ10)",
    speak: "تُنطق كما هي بلا ترجمة", arVid: "الفيديو عربيٌّ أصلاً — رفض", manual: "تُترجَم اليدويّة", asr: "تُقسَّم التلقائيّة ثمّ تُترجَم",
    none: "لا ترجمةَ نصّيّة — خارج النطاق", other: "لا قاعدة: يدويّةٌ بغير لغة الكلام (أو لغتُه مجهولة) ولا تلقائيّة" };
  let k = "", src = null; if (vd.isLive === true) k = "live";
  else if (audio.some((a) => a.cur && a.lang === "ar")) k = "arNow";                       // (١)
  else if (audio.some((a) => a.lang === "ar")) k = "arOffer";                              // (١) خ10
  else if ((src = man.find((c) => c.lang === "ar") || null)) k = "speak";                  // (٢)
  else if (asrC && asrC.lang === "ar") k = "arVid";                                        // (٣)
  else if ((src = (spoken && man.find((c) => c.lang === spoken)) || null)) k = "manual";   // (٤)
  else if ((src = asrC)) k = "asr";                                                        // (٥)
  else k = ok.length ? "other" : "none";
  const dec = "«" + T[k] + "»" + (k === "speak" && spoken === "ar" ? " ⚠️ والكلامُ عربيٌّ نفسُه ⇒ §٣ يُنطق عربيّاً فوق عربيّ لأنّ (٢) قبل (٣) — للمالك" : "") +
    " · لغةُ الكلام=" + (spoken || "؟") + " (من " + (asrC ? "التلقائيّة" : spoken ? "المسار الافتراضيّ" : "مجهولة") + ")";
  const facts0 = "v=" + v + " · النصّ(" + caps.length + ")=" + (caps.slice(0, 10).map(lab).join(" · ") || "—") + " · الصوت=" +
    (Array.from(new Set(audio.map((a) => (a.lang || "؟") + (a.cur ? "◀" : "")))).join(",") || "—") + (audSeen ? "" : " ⚠️ لا أرى الصوت ⇒ (١) لم تُقيَّم");
  if (!src) { emit(TAG + " ⚪ · القرار: " + dec + " ⇒ لا إجبارَ ولا طلب · " + facts0 + " · طلباتُنا=0 · " + env); return; }

  // ── (ب) الحالُ قبلُ — بالقيمة، ويُطبع طولُها ─────────────────────────────────────────────────
  const btn = () => p.querySelector(".ytp-subtitles-button");
  const optS = () => { try { if (typeof p.getOption !== "function") return "لا getOption"; const x = p.getOption("captions", "track"); return x === undefined ? "undefined" : JSON.stringify(x); } catch (e) { return "رمى " + errName(e); } };
  const modS = () => { try { return typeof p.getOptions === "function" ? JSON.stringify(p.getOptions()) : "—"; } catch (e) { return "رمى"; } };
  const stRead = (get) => { const m = {}; try { const st = get(); for (let i = 0; i < st.length; i++) { const key = st.key(i); if (key && /caption/i.test(key)) m[key] = st.getItem(key); } } catch (e) { m["⛔"] = errName(e); } return m; };
  const lsRead = () => stRead(() => localStorage), ssRead = () => stRead(() => sessionStorage), NM = { ls: "localStorage", ss: "sessionStorage" };   // ⭐ والجلسةُ أيضاً: مُعيِّنُ المسار يُلحق لغتَه بـyt-player-caption-language-preferences فيها (📄 captions.js 11a45ffb)
  const state = () => ({ aria: btn() ? String(btn().getAttribute("aria-pressed")) : "لا زرّ", opt: optS(), mods: modS(), ls: lsRead(), ss: ssRead() });
  const lsLen = (m) => Object.keys(m).map((x) => x + "=" + String(m[x]).length).join(",") || "لا مفاتيح";
  const dataOf = (x) => { try { const o = JSON.parse(x); return o && typeof o === "object" && "data" in o ? JSON.stringify(o.data) : null; } catch (e) { return null; } };
  const lsK = (a, b, soft, f) => { f = f || "ls"; const A = a[f] || {}, B = b[f] || {};   // ⭐ البياناتُ نفسُها ⇒ soft
    return Array.from(new Set(Object.keys(A).concat(Object.keys(B)))).filter((x) => A[x] !== B[x] && soft === (A[x] != null && B[x] != null && dataOf(A[x]) !== null && dataOf(A[x]) === dataOf(B[x]))); };
  const stK = (a, b, soft) => lsK(a, b, soft, "ls").map((x) => ["ls", x]).concat(lsK(a, b, soft, "ss").map((x) => ["ss", x]));
  const diff = (a, b) => [].concat(a.aria !== b.aria ? ["زرُّ CC aria-pressed " + a.aria + "⇒" + b.aria] : [], a.opt !== b.opt ? ["الخيار " + cut(a.opt, 40) + "⇒" + cut(b.opt, 40)] : [],
    stK(a, b, false).map((x) => NM[x[0]] + "[" + x[1] + "] " + ((a[x[0]] || {})[x[1]] == null ? "جديد" : (b[x[0]] || {})[x[1]] == null ? "زال" : "تغيّر")));
  const dShow = (x) => { if (x == null) return "غائب"; const d = dataOf(x); return d !== null && d.length <= 16 ? "«" + d.replace(/^"|"$/g, "") + "»" : String(x).length + " حرفاً"; };   // 🎯 16 حرفاً حدُّ عرض البيانات
  // ⭐ M2+R: مفاتيحُ مُعيِّن المسار وحدَها (📄 captions.js: اللاصقة · قائمةُ الجلسة) ومفتاحُ التشغيل — تُعاد بقيمتها قبل الإجبار (B1) حرفاً أو تُزال إن لم تكن ·
  //    وما سواها يتغيّر في النافذة يُطبع ولا يُكتب (كاتبٌ آخر؟) · وتحت القاطع مع CC مضاءٍ يُترك مفتاحُ التشغيل مطفأً عمداً
  const SETTER = { ls: /sticky-language/i, ss: /language-preferences/i }, ONOFF = /caption-persistence|sticky-caption/i;
  const fixOne = (f, k, was, cur) => { const r = { f: f, k: k, was: was, cur: cur, ok: false, err: "" };
    try { const st = f === "ss" ? sessionStorage : localStorage; if (was == null) st.removeItem(k); else st.setItem(k, was); r.ok = true; } catch (e) { r.err = errName(e); } return r; };
  const fixAll = (cur) => { const out = []; ["ls", "ss"].forEach((f) => { const W = B1[f] || {}, C = cur[f] || {}; if ("⛔" in W || "⛔" in C) return;
    lsK({ [f]: W }, { [f]: C }, false, f).forEach((k) => {
      if (ONOFF.test(k) && ccOn && MEM.stop) out.push({ f: f, k: k, was: W[k], cur: C[k], skip: "تُرك مطفأً عمداً (القاطعُ مرفوع) — شغّله بيدك غداً" });
      else if (!SETTER[f].test(k) && !ONOFF.test(k)) out.push({ f: f, k: k, was: W[k], cur: C[k], skip: "ليس من مفاتيح مُعيِّن المسار فلم يُكتب (كاتبٌ آخر؟)" });
      else out.push(fixOne(f, k, W[k], C[k])); }); }); return out; };
  const fmtR = (r) => { const a = dShow(r.was), b = dShow(r.cur);
    return NM[r.f] + "[" + r.k + "] " + (a === b ? "تغيّر بالطول نفسِه (" + a + ")" : a + "⇒" + b) + (r.skip ? " — " + r.skip : r.ok ? (r.was == null ? " فأُزيل" : " فأُعيد كما كان حرفاً") : " ولم يُعَد: رمى " + r.err) + (r.note ? " (" + r.note + ")" : ""); };
  const stkLang = (m) => { const x = dataOf((m || {})["yt-player-caption-sticky-language"]); if (x === null) return ""; try { return prim(String(JSON.parse(x))); } catch (e) { return ""; } };
  let B1 = null; const B0 = state(), ccOn = B0.aria === "true"; let prevTrack; try { prevTrack = JSON.parse(B0.opt); } catch (e) { prevTrack = undefined; }
  // ⛔ قبل أيّ طلب: لاصقةٌ هي لغةُ المصدر لا يغيّرها الإجبار ⇒ لا تُختبر الإعادة، والطلبُ يُنفَق على ⚪ (📐 بعد أوّل تشغيلةٍ صارت «en» عند المالك)
  if (stkLang(B0.ls) === src.lang) { emit(TAG + " ⛔ · رفضٌ قبل أيّ طلب: لغةُ الترجمة اللاصقة «" + stkLang(B0.ls) + "» (localStorage[yt-player-caption-sticky-language]) هي لغةُ المصدر " + lab(src) +
    " ⇒ الإجبارُ لا يغيّرها فلا تُختبر الإعادة (M2+R) ولا يُقرأ K2 — أرجِع لغتَك أوّلاً (سطرُ الإرجاع المرسَل لك، أو قائمةُ الترجمة ⚙ ⇐ العربيّة ثمّ أطفئ CC) ثمّ الصق ثانيةً · طلباتُنا=0 · " + facts0 + " · " + env); return; }

  // ── (ج) المراقبُ الحيّ قبل أيّ فعل (§٣: «المراقبُ يُشغَّل أوّلاً») · عدّادُ النقر الاصطناعيّ · الظهورُ المؤقّت ──
  const TT = "/api/timedtext", seen = [], SYN = ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "mousemove"];
  let resN = 0, synN = 0, synNeg = 0, synWhat = "", ccMs = 0, txtMs = 0, last = now(), tick = 0, adSeen = false, navTo = "";
  const bufN = () => performance.getEntriesByType("resource").filter((e) => String(e.name).indexOf(TT) >= 0).length, buf0 = bufN();
  const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => { resN++; if (String(e.name).indexOf(TT) >= 0) seen.push({ name: String(e.name),
    st: e.startTime, end: e.responseEnd, status: e.responseStatus, size: e.encodedBodySize, xfer: e.transferSize, ours: false }); }));
  const onSyn = (e) => { if (e.isTrusted) return; synN++; if (!synWhat) synWhat = e.type + "@" + cut((e.target && e.target.getAttribute && e.target.getAttribute("class")) || (e.target && e.target.nodeName), 30); };
  const cleanup = () => { try { po.disconnect(); } catch (e) {} SYN.forEach((x) => window.removeEventListener(x, onSyn, true)); clearInterval(tick); MEM.busy = false; };
  try { globalThis.__vz168capMem = MEM; MEM.busy = true;
    po.observe({ type: "resource" });                          // ⛔ حيٌّ: بلا buffered عمداً
    SYN.forEach((x) => window.addEventListener(x, onSyn, true));
    tick = setInterval(() => { const t = now(), dt = t - last; last = t;
      if (adOn()) adSeen = true; if (!navTo) { const vv = new URLSearchParams(location.search).get("v") || ""; if (vv !== v) navTo = vv || "—"; }   // ⭐ قبل ccOn: في الحالين
      if (ccOn) return;                                         // CC مضاءٌ أو نصٌّ على الشاشة وكان مطفأً
      if (btn() && btn().getAttribute("aria-pressed") === "true") ccMs += dt; if (p.querySelector(".ytp-caption-segment")) txtMs += dt; }, 100);
    const sq = qs(src.t.baseUrl), isSrc = (e) => { const q = qs(e.name); return q.get("v") === v && q.get("lang") === sq.get("lang") && (q.get("kind") || "") === (sq.get("kind") || ""); };
    // ⛔ الرفضُ بشكله لأيّ طلبٍ للمشغّل، مصدراً أو غيرَه، في أيّ وقت: ≥400، أو 200 برؤوسٍ بلا جسم — ولا status=0 هنا (الإلغاءُ يُعطيه 📐)
    const refused = (x) => !x.ours && (x.status >= 400 || (x.status === 200 && x.size === 0 && x.xfer > 0));
    const trk = (x) => { const q = qs(x.name); return (q.get("lang") || "؟") + "/" + (q.get("kind") || "يدويّ") + (q.get("tlang") ? "→" + q.get("tlang") : ""); };
    const stw = (x) => "status=" + (x.status == null ? "؟" : x.status) + (x.status === 200 ? " بجسمٍ فارغ" : x.status > 0 ? "" : " (تحويلُ حظرٍ أو انقطاعٌ أو إلغاء — لا يُفرَّق)");
    // المكتملُ أوّلاً، وstatus=0 للمصدر عند المهلة وحدَها (فلا M2 بعده) · وأيُّ رفضٍ يُنهي الانتظار
    const waitSrc = async (tc, ms) => { for (;;) { const m = seen.filter((x) => !x.ours && x.st >= tc - 1 && isSrc(x)), e = m.find((x) => x.status > 0) || (now() >= tc + ms ? m[0] : null);
      if (e || now() >= tc + ms || seen.some(refused)) return e || null; await sleep(100); } };
    const BUDGET = 1;
    let g = "", why = "", how = "", cap = null, tCap = 0, m1 = "", m2 = "", tM1 = 0, m2Called = false, restored = false, act = "لا يلزم", fx = [], lsAgain = false, lastFixAt = 0;
    const firstOK = new Set(), firstBad = new Set(), rew = [];
    const pass1 = () => { fx = fixAll(state()); fx.forEach((r) => { if (r.ok) firstOK.add(r.f + "|" + r.k); else if (!r.skip) firstBad.add(r.f + "|" + r.k); }); if (fx.some((r) => r.ok)) lastFixAt = now(); };
    let res = null, ourUrl = "", ours = 0, stats = "", ownE = null, stored = null;
    const restoreAct = (first) => {                            // إلى الحال السابقة بالواجهة لا بنقرة (#156)
      const s = state(); if (!(first && m2Called) && s.aria === B0.aria && s.opt === B0.opt) return "لا يلزم";
      try {
        if (ccOn && MEM.stop) {                                 // ⛔ القاطعُ مرفوع: إرجاعُ مسارك طلبٌ آخرُ للشبكة ⇒ يُطفأ CC بلا طلب
          if (s.aria === B0.aria && s.opt === B0.opt) return "لا يلزم";
          p.setOption("captions", "track", {}); return "setOption(track ⇐ {}) — أُطفئ CC عمداً بلا طلب: القاطعُ مرفوع وإرجاعُ مسارك يطلبه من الشبكة، فلا تُشغّله اليوم";
        }
        if (ccOn) {                                             // ⛔ {} يُطفئ CC — فخيارٌ فارغٌ أو غيرُ مقروء لا يُعاد به
          if (!prevTrack || typeof prevTrack !== "object" || !Object.keys(prevTrack).length) return "تعذّر: الخيارُ السابق غيرُ صالح (" + cut(B0.opt, 30) + ")";
          p.setOption("captions", "track", prevTrack); return "setOption(track ⇐ السابق)";
        }
        if (/"captions"/.test(B0.mods) || (B0.mods === "—" && B0.opt === "{}")) { p.setOption("captions", "track", {}); return "setOption(track ⇐ {})"; }
        p.unloadModule("captions"); return "unloadModule(captions)";
      } catch (e) { return "رمى " + errName(e); }
    };
    try { console.log("🟢 " + TAG + ": المصدر " + lab(src) + " — " + dec + " · أراقب 2.5 ث بلا فعل (الشاهدُ السالب)…");
      await sleep(2500); synNeg = synN; const r0 = seen.find(refused);
      if (r0) { MEM.stop = { at: clock(Date.now()), why: "طلبٌ في السكون " + trk(r0) + " status=" + r0.status }; g = "⛔";   // ⛔ رفضٌ بلا إجبارٍ منّا: الاتصالُ مرفوضٌ قبلنا
        why = "طلبٌ في السكون رُدّ " + stw(r0) + " (" + trk(r0) + " · " + seen.length + " طلباً في 2.5 ث بلا إجبار) ⇒ لا إجبارَ ولا طلب · " + BREAK; }
      else if (seen.length) { g = "⛔"; why = "الشاهدُ السالب سقط: " + seen.length + " طلبَ timedtext في 2.5 ث بلا إجبار والـCC " + (ccOn ? "مضاءٌ سلفاً" : "مطفأ") + " ⇒ التقاطٌ بعده لا يُنسب إلى إجبارنا — فلا إجبارَ ولا طلب (أتمتةُ ترجمةٍ تعمل؟ أم أُلصق والمشغّلُ يُحمِّل؟)"; }
      else if (adOn()) { g = "⛔"; why = "بدأ إعلانٌ أثناء القياس — انتظر انتهاء الإعلان ثمّ أعد تحميل الصفحة"; }
      else if (stkLang((B1 = { ls: lsRead(), ss: ssRead() }).ls) === src.lang) { g = "⛔"; B1 = null;   // ⛔ تغيّرت في السكون إلى لغة المصدر (لا يُنسب إلينا) ⇒ لا إجبارَ ولا طلب
        why = "صارت لغةُ الترجمة اللاصقة في السكون لغةَ المصدر (" + src.lang + ") ⇒ لا تُختبر الإعادة — لا إجبارَ ولا طلب؛ أرجِع لغتَك ثمّ أعد تحميل الصفحة والصق"; }
      else {
        // ── (هـ) الإجبارُ عبر الواجهة لا بنقرة — M1 ثمّ M2، ويقف عند أوّل ما يُنتج طلبَ المصدر خلال 5 ث ──────
        tM1 = now();   // B1 أُخذ في الشرط أعلاه: آخرُ لقطةٍ قبل الإجبار try { if (typeof p.setOption !== "function") m1 = "setOption غائب"; else p.setOption("captions", "reload", true); } catch (e) { m1 = "رمى " + errName(e); }
        if (!m1) { cap = await waitSrc(tM1, 5000); m1 = cap ? "التقط" : seen.some(refused) ? "أوقفه رفضٌ" : "لا طلبَ للمصدر خلال 5 ث"; if (cap) { how = "M1 setOption(captions,reload)"; tCap = tM1; } }
        if (!cap && seen.some(refused)) m2 = "لم يُجرَّب: رُدّ طلبٌ في M1";   // ⛔ لا M2 بعد رفضٍ رآه M1
        else if (!cap) {
          const tM2 = now(); let via = "", tSet = tM2; m2Called = true;
          console.log("🟡 " + TAG + ": M1 " + m1 + " — أجرّب M2: loadModule، وأنتظر طلبَه حتى 3 ث، ثمّ setOption(track)…");
          try {
            if (typeof p.loadModule !== "function") throw new Error("loadModule غائب");
            p.loadModule("captions"); let tl = null, f0 = null;      // ⛔ أوّلُ طلبٍ للوحدة نفسِها يُنتظر قبل أيّ setOption: رفضُه يُرى قبل طلبٍ ثانٍ
            for (let i = 0; i < 30 && !f0; i++) { await sleep(100); f0 = seen.find((x) => !x.ours && x.st >= tM2 - 1) || null; }
            const own = !!f0 && isSrc(f0) && f0.status > 0 && !refused(f0);   // طلبُ الوحدة هو المصدر **وقد اكتمل** ⇒ يُلتقط ولا setOption (ولا يُبدَّل مسارٌ تشاهده)
            if (!own) for (let i = 0; i < 15 && !(Array.isArray(tl) && tl.length); i++) { try { tl = p.getOption("captions", "tracklist"); } catch (e) { tl = null; } if (!(Array.isArray(tl) && tl.length)) await sleep(100); }
            // ⛔ طلبُ الوحدة للمصدر لم يكتمل (status=0: إلغاءٌ أو حظر — لا يُفرَّق) ⇒ لا setOption حتى يُرى جوابٌ مكتملٌ غيرُه (حتى 1.5 ث 🎯):
            //    الإلغاءُ إن تبعه جوابٌ فالاتصالُ يجيب فيُجبَر المصدرُ كما كان · وإلا فلا طلبَ ثانٍ، والمهلةُ تحكم بالقاطع
            const s0 = !!f0 && isSrc(f0) && !(f0.status > 0), answered = () => seen.some((x) => !x.ours && x.st >= tM2 - 1 && x.status > 0 && !refused(x));
            if (s0) for (let i = 0; i < 15 && !answered() && !seen.some(refused); i++) await sleep(100);
            const reissued = s0 && seen.some((x) => !x.ours && x.st >= tM2 - 1 && isSrc(x) && x.status > 0 && !refused(x));   // أعادت الوحدةُ طلبَ المصدر فاكتمل ⇒ هو الالتقاطُ، ولا طلبَ زائد
            if (seen.some(refused)) via = " وحدَه — رُدّ طلبٌ قبل setOption فلم يُنادَ";
            else if (own || reissued) via = " وحدَه — طلبُه هو المصدر فلا setOption" + (reissued ? " (أُعيد بعد إلغاءٍ فاكتمل)" : "");
            else if (s0 && !answered()) via = " وحدَه — طلبُه للمصدر لم يكتمل (status=0) ولا جوابَ مكتملاً غيرُه خلال 1.5 ث ⇒ لا setOption، والمهلةُ تحكم";
            else { const o = Array.isArray(tl) ? tl.find((x) => x && x.languageCode === src.code && (x.kind === "asr") === src.asr) : null;
              via = "+setOption(track ⇐ " + (o ? "كائنُ tracklist" : "{languageCode}") + ")"; tSet = now(); p.setOption("captions", "track", o || { languageCode: src.code }); }
          } catch (e) { m2 = "رمى " + errName(e); }
          if (!m2) { cap = await waitSrc(tM2, Math.round(now() - tM2) + 5000); m2 = cap ? "التقط" : seen.some(refused) ? "أوقفه رفضٌ" : "لا طلبَ للمصدر خلال 5 ث";
            if (cap) { how = "M2 loadModule" + via; tCap = cap.st >= tSet - 1 ? tSet : tM2; } }
        }
        // ⛔ القرارُ قبل الإرجاع: رفضُ أيّ طلبٍ رآه المراقب، أو مصدرٌ لم يكتمل حتى المهلة (status=0) ⇒ القاطع، فالإرجاعُ بلا شبكة
        const ref = seen.find(refused) || (cap && !(cap.status > 0) ? cap : null);
        if (ref) MEM.stop = { at: clock(Date.now()), why: "طلبُ المشغّل " + trk(ref) + " status=" + ref.status };
        act = restoreAct(true); restored = true; pass1();   // ⭐ الإرجاعُ فورَ الالتقاط لا بعد طلبنا: أقصرُ ظهورٍ مؤقّت — ومعه مفاتيحُ الترجمة (M2+R)
        if (ref) { g = "⛔"; why = "طلبُ المشغّل " + (isSrc(ref) ? "للمصدر" : "لغير المصدر") + " (" + trk(ref) + ") رُدّ " + stw(ref) + " ⇒ لا طلبَ منّا · " + BREAK; }
        else if (!cap && (adSeen || navTo)) { g = "⛔"; why = (adSeen ? "إعلانٌ" : "تنقّلٌ إلى v=" + navTo) +
          " أثناء الإجبار ⇒ «لا التقاط» لا يُنسب إلى الإجبار ولا يُعدّ في K2 — أعد تحميل الصفحة، وانظر CC بعينك (الإرجاعُ جرى أثناءه)"; }
        else if (!cap) { g = resN ? "❌" : "⛔";
          why = resN ? "لم يُلتقط طلبٌ للمصدر — M1: " + m1 + " · M2: " + (m2 || "—") + (ccOn && prevTrack && prevTrack.languageCode === src.code
            ? " (CC مضاءٌ بالمصدر نفسِه — قد يخدمه المشغّل من ذاكرته)" : "") + " ⇒ الإجبارُ عبر الواجهة لم يُنتج طلباً (أأُعيد تحميلُ الصفحة قبل اللصق؟)"
            : "المراقبُ لم يرَ مورداً واحداً طوال التشغيل ⇒ أعمى، و«لا طلب» منه صمتٌ لا قياس (قرار 150)";
        } else if (adOn() || adSeen || navTo || (new URLSearchParams(location.search).get("v") || "") !== v) {   // ⛔ «ولا رمزَ أثناء إعلان» (§٣) — ولا طلبَ لفيديو غادرتَه، ولا لقياسٍ سيُبطَل
          g = "⛔"; why = (adOn() || adSeen ? "إعلانٌ" : "تنقّلٌ إلى v=" + (navTo || new URLSearchParams(location.search).get("v") || "—")) + " أثناء الإجبار أو بعد الالتقاط ⇒ لا طلبَ منّا ولا يُعدّ في K2 — أعد تحميل الصفحة";
        } else {
          // ── (و) طلبُنا الوحيد: معاملاتُ المشغّل بنصّها، وfmt=json3 آخرَها، بلا tlang ولا variant ───────────
          const qi = cap.name.indexOf("?"), kv = cap.name.slice(qi + 1).split("&").filter((x) => x && !/^(tlang|variant|fmt)(=|$)/.test(x));
          ourUrl = cap.name.slice(0, qi) + "?" + kv.concat("fmt=json3").join("&");
          if (qi < 0 || ours >= BUDGET || MEM.stop) throw new Error("الميزانية أو الرابط: ?=" + qi + " · طلباتُنا=" + ours + "/" + BUDGET + (MEM.stop ? " · القاطعُ مرفوع" : ""));
          ours++; MEM.req[v] = clock(Date.now());
          const tO = now(), ac = new AbortController(), to = setTimeout(() => ac.abort(), 15000), potLen = (qs(cap.name).get("pot") || "").length;
          console.log("🟢 " + TAG + ": طلبُنا " + ours + "/" + BUDGET + " عند " + MEM.req[v] + " (+" + rel(tO) + "ms) ⇐ " + ourUrl.replace(/([?&]pot=)([^&]*)/, (m, a) => a + "⟨" + potLen + " حرفاً⟩"));
          try { const r = await fetch(ourUrl, { credentials: "include", signal: ac.signal }); res = { status: r.status, body: await r.text() }; }
          catch (e) { res = { status: 0, body: "", err: errName(e) }; }
          finally { clearTimeout(to); res.ms = Math.round(now() - tO); }
          for (let i = 0; i < 15 && !ownE; i++) { await sleep(100); ownE = seen.find((x) => x.name === ourUrl && x.st >= tO - 1) || null; } if (ownE) ownE.ours = true;
          if (res.err) { MEM.stop = { at: clock(Date.now()), why: "طلبُنا لم يكتمل" }; g = "⛔"; why = "طلبُنا لم يكتمل: " + res.err + " بعد " + res.ms + "ms (وتحويلُ حظرٍ يظهر فشلاً) · " + BREAK; }
          else if (res.status !== 200 || !res.body.trim()) {      // ⛔ القاطع: كلُّ ما ليس 200 بجسمٍ رفضٌ (429 · 403 · 5xx · فارغ) — لا طلبَ بعده في هذه الصفحة
            const w = "status=" + res.status + (res.body.trim() ? "" : " بجسمٍ فارغ");
            MEM.stop = { at: clock(Date.now()), why: "طلبُنا " + w }; g = "⛔"; why = "طلبُنا رُدّ " + w + (res.body.trim() ? " «" + cut(res.body, 60) + "»" : "") + " · " + BREAK;
          } else {
            // ── (ز) القراءة: أحداث · كلمات · مدىً · توقيتُ الكلمات · ترقيم ───────────────────────────────
            let j = null; try { j = JSON.parse(res.body); } catch (e) { j = null; }
            const evs = j && Array.isArray(j.events) ? j.events : null;
            const txt = (ev) => (ev && Array.isArray(ev.segs) ? ev.segs : []).map((s) => (s && s.utf8) || "").join("");
            const tev = evs ? evs.filter((ev) => txt(ev).trim()) : [];
            let segN = 0, timed = 0, words = 0, z = 0, punct = 0, marks = 0;   // أحداثُ aAppend سطرٌ فارغٌ في التلقائيّة ⇒ لا تُعدّ
            tev.forEach((ev) => { ev.segs.forEach((sg) => { segN++; if (sg && typeof sg.tOffsetMs === "number") timed++; });
              const s = txt(ev).trim(); words += s.split(/\s+/).length; if (/[.?!؟]["'»”’)\]]*$/.test(s)) punct++; marks += (s.match(/[.?!؟]["'»”’)\]]*(?=\s|$)/g) || []).length;
              z = Math.max(z, (Number(ev.tStartMs) || 0) + (Number(ev.dDurationMs) || 0)); });
            const a = tev.length ? Number(tev[0].tStartMs) || 0 : 0, len = (Number(vd.lengthSeconds) || 0) * 1000;
            if (evs) stats = "json3: أحداث=" + evs.length + " (بنصّ " + tev.length + ") · كلمات=" + words + " · يغطّي " + mmss(a) + "–" + mmss(z) + " من " +
              (len ? mmss(len) + " (" + Math.round(100 * z / len) + "%)" : "؟") + " · توقيتُ الكلمات=" + (timed ? "نعم (" + timed + "/" + segN + " مقطعاً بـtOffsetMs)" : "لا") +
              " · ترقيم=" + (tev.length ? Math.round(100 * punct / tev.length) : 0) + "% من الأحداث تنتهي بـ. ? ! ؟ · علاماتُ جملةٍ أينما وقعت=" + (words ? (100 * marks / words).toFixed(1) : "0") + " لكلّ 100 كلمة · «" + cut(tev[0] && txt(tev[0]), 60) + "» · «" + cut(tev[1] && txt(tev[1]), 60) + "»";
            if (!evs) { g = "❌"; why = "الجسمُ ليس json3: «" + cut(res.body, 60) + "»"; }
            else if (!tev.length) { g = "❌"; why = "json3 بلا حدثٍ فيه نصّ (أحداث=" + evs.length + ")"; }
            else {
              const q = qs(ourUrl); stored = globalThis.__vz168cap = { videoId: v, lang: q.get("lang") || "", kind: q.get("kind") || "", json3: j, capturedUrl: cap.name, fetchedUrl: ourUrl, at: Date.now() };
              g = "✅"; why = "نأخذ النصَّ كاملاً بتوقيته من طلب المشغّل نفسِه"; stats += " · مُخزَّنٌ في الذاكرة لمجسّ الملاءمة (globalThis.__vz168cap)";
            }
          }
        }
      }
    } catch (e) { g = "⛔"; why = "المِجَسُّ رمى أثناء القياس: " + errName(e) + " — عطبُ أداةٍ لا جواب، أبلِغ بهذا السطر" + (MEM.stop ? " · " + BREAK : ""); }
    if (!restored && tM1) { act = restoreAct(true); restored = true; if (B1) pass1(); }
    const base = B1 ? Object.assign({}, B0, { ls: B1.ls, ss: B1.ss }) : B0;   // ⭐ الأثرُ ما تغيّر بعد الإجبار — وتغيّرٌ في السكون قبله يُطبع ولا يُنسب إلينا
    const idle = B1 ? stK(B0, B1, false).map((x) => NM[x[0]] + "[" + x[1] + "]") : [];
    // ── (ح) الإرجاعُ مُثبَتاً بإعادة القراءة: حتى يثبت التساوي ثانيةً (السقف 3 ث)، وإعادةٌ واحدةٌ عند 1.5 ث ──
    const tV = now(); let d = [], eqAt = -1, again = false, capMs = 3000; for (;;) {
      const s = state(); d = diff(base, s);
      if (d.length) eqAt = -1; else if (eqAt < 0) eqAt = now();
      const quiet = !lastFixAt || now() - lastFixAt >= 2000;   // 🎯 ثانيتان بعد آخر كتابةٍ منّا — وإلا رأينا كتابتَنا لا ثباتَها
      if ((eqAt >= 0 && now() - eqAt >= 1000 && quiet) || now() - tV >= capMs) break;
      if (tM1 && !again && !MEM.stop && !seen.some(refused) && now() - tV >= 1500 && (s.aria !== B0.aria || s.opt !== B0.opt)) { again = true; act += " ثمّ أُعيد: " + restoreAct(false); }   // ⛔ لا إعادةَ بعد رفض
      if (tM1 && B1 && !lsAgain) { const r2 = fixAll(state()).filter((r) => !r.skip);   // ⭐ M2+R ثانيةً حين يتغيّر مفتاحٌ للمُعيِّن — قراءةٌ طازجة، بلا شبكة فولو بعد رفض
        if (r2.length) { lsAgain = true; r2.forEach((r) => { const id = r.f + "|" + r.k; r.note = firstOK.has(id) ? "أعاد المشغّلُ كتابتَه بعد إعادتنا" : firstBad.has(id) ? "محاولةٌ ثانية: الأولى رمت" : "تغيّر بعد الإعادة الأولى";
          if (firstOK.has(id)) rew.push(r); }); fx = fx.concat(r2); if (r2.some((r) => r.ok)) { lastFixAt = now(); capMs = Math.max(capMs, Math.round(now() - tV) + 2200); } } }
      await sleep(150);
    }
    const held = eqAt >= 0 ? Math.round(now() - eqAt) : -1, A = state(), effect = d.slice(), negN = seen.filter((x) => !x.ours && x.st < (tM1 || now())).length;
    const synA = synN - synNeg, synT = synA + " حدثَ فأرةٍ غيرَ موثوق بعد الإجبار (" + synWhat + ")", soft = stK(base, A, true).map((x) => NM[x[0]] + "[" + x[1] + "]");
    const okF = fx.filter((r) => r.ok), noF = fx.filter((r) => !r.ok), watched = lastFixAt ? Math.round(now() - lastFixAt) : 0;
    if (synA && !synNeg) effect.push(synT + " ⇒ موضعُ المؤشّر المحفوظ يُصفَّر (#156)");   // ⛔ ومع اصطناعيّةٍ قبل الإجبار لا يُنسب إلينا
    const late = MEM.stop ? null : seen.find(refused);          // ⛔ رفضٌ وصل بعد القرار (إرجاعٌ أو طلبٌ في الطريق): لا يُصلح ما قبله، ويرفع القاطع
    if (late) { MEM.stop = { at: clock(Date.now()), why: "طلبُ timedtext " + trk(late) + " status=" + late.status }; g = "⛔";   // المِجَسُّ لا يفرّق المُرسِلين ⇒ «timedtext» لا «المشغّل»
      why = "رفضٌ وصل متأخّراً: طلبُ timedtext " + trk(late) + " رُدّ " + stw(late) + (tM1 ? " بعد الإجبار" : " بلا إجبارٍ منّا (لا يُنسب إلينا)") +
        (ours ? " — وطلبُنا وقع قبله" : "") + (stored ? " (والنصُّ جُلب)" : "") + " · " + BREAK; }
    const ANEW = " — وأعِد على فيديو آخر لا هذا (طلبُه وقع)";   // ⛔ بعد طلبنا: حارسُ «طلبٍ لكلّ فيديو» تنساه إعادةُ التحميل، والعهدةُ على الإنسان
    if (g === "✅" && negN) { g = "⛔"; why = "الشاهدُ السالب سقط متأخّراً: " + negN + " طلباً بدأ قبل الإجبار ووصل بعده ⇒ لا يُنسب الالتقاطُ إلى إجبارنا" + ANEW; }
    const blind = ["ls", "ss"].filter((f) => "⛔" in (base[f] || {}) || "⛔" in (A[f] || {})).map((f) => NM[f] + " ⛔ " + ((A[f] || {})["⛔"] || (base[f] || {})["⛔"]));
    if (!tM1) { const st = effect.filter((x) => /Storage\[/.test(x)); if (st.length) { idle.push.apply(idle, st.map((x) => x.replace(/ (جديد|زال|تغيّر)$/, ""))); effect.splice(0, effect.length, ...effect.filter((x) => !/Storage\[/.test(x))); } }
    if (g === "✅" && blind.length) { g = "⛔"; why = "قراءةُ التخزين فشلت (" + blind.join(" · ") + ") ⇒ شاهدُ الأثر أعمى فلا يُحكم «بلا أثر» (قرار 150)"; }
    if (g === "✅" && effect.length) { g = "❌"; why = "التُقط النصُّ وجُلب — لكن بقي أثر"; }
    if (g === "✅" && held < 1000) { g = "⛔"; why = "الإرجاعُ لم يثبت ثانيةً كاملة خلال 3 ث (" + held + "ms) ⇒ لا إثباتَ بإعادة القراءة — القياسُ باطلٌ لا ❌" + ANEW; }
    if (g === "✅" && synA && synNeg) { g = "⛔"; why = synT + " وقبله " + synNeg + " بلا إجبار ⇒ أثرُه على المؤشّر لا يُنسب إلينا (إضافةٌ أخرى؟ أوقفها)" + ANEW; }
    if ((g === "✅" || g === "❌") && (adSeen || navTo)) { g = "⛔"; why = (adSeen ? "إعلانٌ" : "تنقّلٌ إلى v=" + navTo) + " أثناء القياس ⇒ لا يُعدّ في K2 (" + why +   // ⛔ ✅ و❌ وحدَهما: ⛔ القاطع يبقى بنصّه
      ") — انظر CC بعينك (الإرجاعُ جرى أثناءه)" + (ours ? ANEW : " — وأعد تحميل الصفحة"); }
    if (g === "✅" && rew.length) { g = "❌"; why = "التُقط النصُّ وجُلب — لكن المشغّلَ أعاد كتابةَ ما أعدناه (" + rew.map((r) => NM[r.f] + "[" + r.k + "]").join(",") + ") ⇒ ذاكرتُه تحمل لغةَ المصدر، ولا يُعدّ «أُزيل»"; }
    if (g === "✅" && okF.length) why += " — وما تغيّر بعد الإجبار من مفاتيح مُعيِّن المسار أُعيد (M2+R: «أثرٌ أُزيل» أدناه) · وK2 يقرأ «أُزيل» بجواب المالك على خ20";
    if (stored) { stored.verdict = g; stored.trace = effect.length ? "بقي" : okF.length ? "أُزيل" : "لا"; stored.at7 = Date.now();   // ⭐ مِجَسّ 5 يطبع الحكمَ الأخير ويُعيد قراءةَ ما أُعيد بعد دقائق
      stored.restored = okF.map((r) => ({ f: r.f, k: r.k, v: r.was == null ? null : r.was })); }
    // ── (ط) سطرُ الحكم ─────────────────────────────────────────────────────────────────────────
    const cq = cap ? qs(cap.name) : null, pot = cq ? cq.get("pot") : null;
    const capT = cap ? "طريقة=" + how + (/^M2/.test(how) ? " (M1: " + m1 + ")" : "") + " · كمون=" + Math.round(cap.st - tCap) + "ms (اكتمل@" + Math.round(cap.end - tCap) + "ms) · طلبُ المشغّل: status=" +
      (cap.status == null ? "؟" : cap.status) + " · جسمٌ مضغوط=" + cap.size + " بايت · pot=" + (pot ? "نعم (" + pot.length + " حرفاً)" : "لا") + " · potc=" + (cq.get("potc") || "—") +
      " · c=" + (cq.get("c") || "—") + " · exp=" + (cq.getAll("exp").join(",") || "—") + " · مفاتيح=" + Array.from(new Set(cq.keys())).join(",")
      : "طريقة=لا (M1: " + (m1 || "—") + " · M2: " + (m2 || "—") + ")";
    const ourT = res ? "طلبُنا @" + (MEM.req[v] || "؟") + ": " + (res.err ? "لم يكتمل" : res.status + " · " + new TextEncoder().encode(res.body).length + " بايت بعد فكّ الضغط" + (ownE && ownE.size ? " (مضغوطاً " + ownE.size + ")" : "")) + " · " + res.ms + "ms" +
      (ownE ? (ownE.xfer === 0 && ownE.size > 0 ? " (من ذاكرة المتصفّح)" : " (من الشبكة)") : "") : "طلبُنا: لم يقع";
    const negT = (negN ? "❌ " + negN + " طلباً بلا إجبار" : "✅ 0 في 2.5 ث") + " والـCC " + (ccOn ? "مضاءٌ سلفاً" : "مطفأ");
    const sight = (cap ? "✅ التقط طلبَ المشغّل" : seen.length ? "✅ رأى " + seen.length + " طلبَ timedtext (لا للمصدر بعد الإجبار)" : resN ? "⚠️ رأى " + resN + " مورداً ولا timedtext" : "⛔ لم يرَ شيئاً") +
      (ownE ? " · ✅ رأى طلبَنا بعنوانه" : ours ? " · ⚠️ لم يرَ طلبَنا خلال 1.5 ث" : "") + " · موارد=" + resN;
    const live = seen.slice(0, 4).map((x) => trk(x) + (x.ours ? "(لنا)" : "") + "@" + rel(x.st) + "ms:" + (x.status == null ? "؟" : x.status)).join(",");   // ⭐ بحالته: K4 يُقرأ منه
    const tmp = ccOn ? "" : ccMs > 0 || txtMs > 0 ? " · ⚠️ ظهورٌ مؤقّت: CC مضاءٌ ~" + Math.round(ccMs) + "ms · نصٌّ على الشاشة ~" + Math.round(txtMs) + "ms" : " · ولا ظهورَ مؤقّت";
    emit(TAG + " " + g + " · " + why + " · " + capT + " · " + ourT + (stats ? " · " + stats : "") + " · " + (effect.length ? "بقي أثر: " + effect.join(" ، ") +
        (okF.length ? " — وأُعيد: " + okF.map(fmtR).join(" ، ") : "") + (noF.length ? " — ولم يُعَد: " + noF.map(fmtR).join(" ، ") : "")
        : okF.length ? "أثرٌ أُزيل: " + okF.map(fmtR).join(" ، ") + " (ورُوقب " + watched + "ms بعد آخر كتابةٍ منّا)" + (noF.length ? " — ولم يُعَد: " + noF.map(fmtR).join(" ، ") : "") : "أثرٌ ظاهر: لا") + (idle.length ? " ⚠️ وتغيّر في السكون قبل الإجبار (لا يُنسب إلينا): " + idle.join(",") : "") +
      (soft.length ? " ⚠️ وأُعيدت كتابةُ " + soft.join(",") + " بالبيانات نفسِها (الطابعُ الزمنيّ وحده — لا يُعدّ أثراً ظاهراً)" : "") +
      tmp + " (الإرجاع: " + act + " · " + (held >= 1000 ? "ثبت التساوي " + held + "ms" : held >= 0 ? "تساوى " + held + "ms فقط — دون الثانية" : "لم يثبت خلال 3 ث") + ") · طلباتُنا=" + ours + "/" + BUDGET +
      " · شاهد−=" + negT + " · بصر=" + sight + " · حيّ=" + seen.length + " [" + live + "] · مخزَّن: عند اللصق=" + buf0 + " وفي الآخر=" + bufN() +
      " (غيرُ موثوق: يوتيوب يُفرغه حين يمتلئ) · طلباتُ المشغّل منذ الإجبار=" + seen.filter((x) => !x.ours && tM1 && x.st >= tM1).length +
      (synNeg ? " · اصطناعيّةٌ قبل الإجبار=" + synNeg + " (ليست منّا)" : "") + " · المصدر=" + lab(src) + " ⇐ " + dec + " · " + facts0 + " · قبلُ: CC=" + B0.aria +
      " · خيار=" + cut(B0.opt, 60) + " · وحدات=" + cut(B0.mods, 40) + " · localStorage[caption]=" + lsLen(B0.ls) + " · sessionStorage[caption]=" + lsLen(B0.ss) + " · بعدُ: CC=" + A.aria + " · وحدات=" + cut(A.mods, 40) + " · " + env);
  } finally { cleanup(); }
})().catch((e) => console.log("VZ-168أ-7 ⛔ · المِجَسُّ نفسُه رمى: " + ((e && e.stack) || e) + " — عطبُ أداةٍ لا جواب، أبلِغ بهذا السطر"));
