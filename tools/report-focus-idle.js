// مِجَسّ م7 — **أيمنع التركيزُ داخل الشريط إخفاءَنا؟** يُلصق في كونسول الصفحة.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«الشريطُ اختفى والتركيزُ داخله — أهذا
// إخفاؤنا فالشرطُ مكسور، أم إخفاءُ يوتيوب فوق شرطٍ سليم؟»*
//
// ── ⛔⭐⭐ لماذا لا يُقاس الأثرُ أصلاً (قرار 48) ──────────────────────────────
// **بلاغُ المالك:** «الشريطُ يختفي ولو كان التركيزُ داخله، في الأوضاع الثلاثة —
// **وحتى مع إطفاء الإضافة كاملةً، نفسُ الشيء**».
// ⇒ **ويوتيوب يُخفي شريطَه من تلقائه** ⇒ **فأثرُنا وأثرُه متطابقان في العين**،
// **وقراءةُ الأثر لا تقول من فعل.** ⇒ **فيُقاس سببُنا: صنفُنا نحن.**
//
// ── ⭐ وشاهدان سالبان مجّانيّان، مقروءان من الكود قبل أيّ قياس ───────────────
// `IDLE_CONSUMERS.progressBar.enabled = progressHideActive`، و`applyIdleStateOnce`
// **يقطع عند `!enabled()` فينادي `onDisabled()`** — **قبل أن يُقيَّم شرطُ التركيز.**
// ⇒ **في وضع «لا تُخفِه» (`off`) ومع إطفاء الإضافة: لا نُخفي شيئاً، والشرطُ لا
// يُقيَّم أصلاً** ⇒ **فالاختفاءُ هناك يوتيوبُ قطعاً، وهو ما شاهده المالك.**
// ⇒ **والسؤالُ يضيق إلى وضعين: `idle` و`near`** — **وهذا المِجَسُّ يرفض ما عداهما.**
//
// ── ⭐ والمتوقَّعُ واحدٌ في الوضعين، لا فرعان ────────────────────────────────
// في `near` يُنادى `onActive("suspended")` ⇒ `setYtProgressHidden(mode === "near"
// && why === "active")` = **false** ⇒ **فصنفُنا يجب أن يكون مطفأً في الوضعين معاً.**
//
// ── ⛔⭐⭐ وخمسةُ أسبابٍ كافية للامتناع، وقياسُ واحدٍ يشترط إطفاءَ الأربعة ────
// **قرار 137 مطبَّقاً على تشخيصٍ لا على شاهد:** وعدٌ مضمونٌ مرّاتٍ لا يُنسب إلى
// إحدى ضماناته إلا بإثبات إطفاء البواقي — **وإلا قِسنا امتناعاً ونسبناه إلى
// التركيز.** فيُقرأ ويُطبع مع الحكم: `activityAt` · `held` · **التركيز** ·
// لوحةُ الفلاتر · **والمؤشّرُ على الهدف** (#95).
//
// ── ⚠️ حدٌّ مُعلَنٌ في الأداة (ولا يُخفى) ───────────────────────────────────
// **هامشُ `nearPad` ثابتٌ لا دالّة، فلا يُقرأ من هذا العالم** — ⇒ **فيُقاس بُعدُ
// المؤشّر عن الشريط ويُطبع بالبكسل**، **ويُطلَب ركنُه خارج المشغّل كلَّه** حتى
// يكون البعدُ أكبر من أيّ هامشٍ بيّناً. ⛔ **ولا رقمَ مُثبَّتٌ هنا.**
//
// ── كيف يُستعمل ─────────────────────────────────────────────────────────────
//   1) افتح صفحةَ مشاهدةٍ على يوتيوب، وفعّل **«إخفاء شريط تحكّم يوتيوب»**
//      (`إخفاءٌ بالسكون` أو `مخفيٌّ دائماً` — ⛔ **لا «لا تُخفِه»**).
//   2) افتح الكونسول (F12)، و**بدّل سياقَه إلى اسم الإضافة** من قائمة السياق
//      أعلى الكونسول — ⛔ **وإلا رفض المِجَسُّ العملَ ولم يطبع رقماً.**
//   3) الصق هذا الملفّ كلَّه واضغط Enter — يطبع «مُسلَّح».
//   4) **اضغط `Tab` حتى يقع التركيزُ داخل شريط التحكّم**، ثمّ **اركن الفأرة خارج
//      المشغّل كلَّه** (فوق العنوان مثلاً) **وارفع يدك ولا تحرّكها.**
//   5) ينتظر أطولَ من المهلة بأضعاف ثمّ يطبع سطراً واحداً وينسخه إلى الحافظة.
(() => {
  const T = ".ytp-chrome-bottom";
  const OUR = "vz-idle-hide-progress";
  const YT = "ytp-autohide";

  // ── ⛔ مرساةُ السياق: الأداةُ ترفض أن تقيس من حيث لا ترى ────────────────────
  // ⚠️ **وتُقرأ دوالُّ المنتَج من `globalThis` صراحةً لا كأسماءٍ حرّة** — فهي من
  // عالمٍ آخر لا من هذا الملفّ، **و`lint-names` محقٌّ في رفض الأسماء الحرّة.**
  // ⭐ **وفائدةٌ ثانية أهمّ: لو خالف الافتراضُ الواقعَ (ألّا تصير الدوالُّ خاصّيّاتٍ
  // على العامّ) لَرفض المِجَسُّ ولم يقس** — **فالافتراضُ الخاطئ يُعلن ولا يصمت.**
  // **الدوالُّ تُقرأ من عالم الإضافة والمتغيّراتُ لا** (مقيسٌ في #86) — فوجودُ
  // `vzIdleSnapshot` هو الفارقُ بين «قِستُ» و«لم أرَ»، **وصفرُهما واحد.**
  if (typeof globalThis.vzIdleSnapshot !== "function" || typeof globalThis.progressBarMode !== "function") {
    console.log("⛔ VZ-م7: لستَ في سياق الإضافة — بدّل سياقَ الكونسول إلى اسم الإضافة وأعِد اللصق. " +
      "**ولا يُطبع رقمٌ من عالمٍ خطأ.**");
    return;
  }
  const mode = globalThis.progressBarMode();
  const on = typeof globalThis.progressHideActive === "function" ? globalThis.progressHideActive() : null;
  if (mode === "off" || on === false) {
    console.log(`⚪ VZ-م7: الوضع «${mode}»${on === false ? " والميزةُ غيرُ مُفعَّلة" : ""} ⇒ ` +
      "**شرطُ التركيز لا يُقيَّم أصلاً** (`enabled()` يقطع قبله) ⇒ **نحن لا نُخفي شيئاً هنا، " +
      "فاختفاءُ الشريط يوتيوبُ قطعاً — وهذا شاهدٌ سالبٌ لا عطب.** " +
      "فعّل «إخفاءٌ بالسكون» أو «مخفيٌّ دائماً» ثمّ أعِد اللصق.");
    return;
  }

  // ── ⭐ أيُّ الصنفين سبق؟ — يُرصد من لحظة التسليح لا يُستنتج بعدها ───────────
  const log = [];
  const t0 = performance.now();
  const mark = (who, el, cls) => {
    const has = el.classList.contains(cls);
    if (has && !log.some((x) => x.who === who)) log.push({ who, at: Math.round(performance.now() - t0) });
  };
  const mp = () => document.querySelector("#movie_player");
  const obs = new MutationObserver(() => {
    mark("نحن", document.documentElement, OUR);
    if (mp()) mark("يوتيوب", mp(), YT);
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  if (mp()) obs.observe(mp(), { attributes: true, attributeFilter: ["class"] });

  const vis = (el) => !!el && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const gapPx = () => {                       // بُعدُ المؤشّر عن مستطيل الشريط
    const s = globalThis.vzIdleSnapshot(), el = document.querySelector(T);
    if (!el || !s.pointer || s.pointer.x == null) return null;
    const r = el.getBoundingClientRect();
    const dx = Math.max(r.left - s.pointer.x, 0, s.pointer.x - r.right);
    const dy = Math.max(r.top - s.pointer.y, 0, s.pointer.y - r.bottom);
    return Math.round(Math.hypot(dx, dy));
  };
  const focusIn = () => {
    const a = document.activeElement;
    return !!(a && a.closest && a.closest(T));
  };

  const emit = (line) => {
    console.log(line);
    try { copy(line); console.log("   (نُسخ إلى الحافظة)"); } catch {}
    obs.disconnect();
  };

  let armed = null, tries = 0;
  const tick = setInterval(() => {
    tries++;
    // ── الحالُ تُنتَج ويُتحقَّق منها قبل أن يُقاس شيء (قرار 22 · 125) ─────────
    if (!armed) {
      if (!focusIn()) {
        if (tries > 120) {                    // ~60 ثانية
          clearInterval(tick); obs.disconnect();
          console.log("⛔ VZ-م7: لم يقع التركيزُ داخل الشريط خلال 60 ثانية — " +
            "**القياسُ باطلٌ ولا يُطبع حكم.** " +
            `آخرُ عنصرٍ مركَّز: ${document.activeElement ? (document.activeElement.className || document.activeElement.tagName) : "لا شيء"}. ` +
            "⚠️ **و«ضغطتُ Tab» ليست «استقرّ التركيزُ هناك»** — وإن لم يقبل المشغّل تركيزاً بـ`Tab` فذاك جوابُ م7 نفسِه، أبلِغ به.");
        }
        return;
      }
      const s = globalThis.vzIdleSnapshot();
      armed = { at: performance.now(), ms: s.ms,
                el: document.activeElement.className || document.activeElement.tagName };
      console.log(`🟢 VZ-م7: وقع التركيزُ داخل الشريط (${armed.el}) — ارفع يدك ولا تحرّكها، ` +
        `والنتيجةُ بعد ${Math.round((s.ms * 3 + 1500) / 1000)} ثوانٍ تقريباً.`);
      return;
    }
    if (performance.now() - armed.at < armed.ms * 3 + 1500) return;
    clearInterval(tick);

    // ── القراءةُ: سببُنا أوّلاً، وسببُ المضيف بجانبه، والسبقُ بينهما ─────────
    const s = globalThis.vzIdleSnapshot();
    const ours = document.documentElement.classList.contains(OUR);
    const yt = !!(mp() && mp().classList.contains(YT));
    const barVis = vis(document.querySelector(T));
    const stillFocus = focusIn();
    const gap = gapPx();
    const filters = typeof globalThis.vzFilterPanelOpen === "function" ? globalThis.vzFilterPanelOpen() : "?";
    const order = log.length ? log.map((x) => `${x.who}@${x.at}ms`).join(" ثمّ ") : "لا انتقال";

    // ── ⛔ الإبطالات — تُقرأ قبل الحكم، ولكلٍّ سببُه ────────────────────────
    const bad = [];
    if (!stillFocus) bad.push("خرج التركيزُ من الشريط أثناء الانتظار");
    if (s.held) bad.push("زرُّ الفأرة ممسوك (`held`) — سببٌ كافٍ ثانٍ");
    if (filters === true) bad.push("لوحةُ الفلاتر مفتوحة — سببٌ كافٍ ثانٍ");
    if (mode !== "near" && s.activityAt === 0) bad.push("لا نشاطَ بعد على الصفحة — سببٌ كافٍ ثانٍ");
    if (gap === 0) bad.push("المؤشّرُ على الشريط نفسِه (#95) — سببٌ كافٍ ثانٍ");

    const facts = `الوضع=${mode} · مهلة=${s.ms}ms · صنفُنا=${ours} · صنفُ‑يوتيوب=${yt} · ` +
      `الشريطُ‑مرئيّ=${barVis} · السبق=[${order}] · تركيزٌ‑داخله=${stillFocus} (${armed.el}) · ` +
      `held=${s.held} · حالة=${s.state} · نشاطٌ‑عند=${s.activityAt ? "نعم" : "لا"} · ` +
      `بُعدُ‑المؤشّر=${gap === null ? "?" : gap + "px"} · فلاتر=${filters}`;

    if (bad.length) {
      emit(`⛔ VZ-م7 القياسُ باطل — ${bad.join(" · ")}. **ولا يُبنى عليه حكم.**  ⇒ ${facts}`);
      return;
    }
    // ── الحكم: على سببِنا وحدَه ──────────────────────────────────────────────
    if (ours === false) {
      emit(`✅ VZ-م7: **شرطُنا يعمل — لم نُخفِ شيئاً والتركيزُ داخل الشريط.** ` +
        (barVis ? "والشريطُ ظاهر." : "**والشريطُ مخفيٌّ رغم ذلك ⇒ إخفاءُ يوتيوب فوق شرطٍ سليم، وأثرُ شرطِنا غيرُ مرئيّ هنا.**") +
        `  ⇒ ${facts}`);
    } else {
      emit(`❌ VZ-م7: **صنفُنا مطبَّقٌ والتركيزُ داخل الشريط ⇒ شرطُ الامتناع لم يقع — عطبٌ عندنا.** ` +
        `  ⇒ ${facts}`);
    }
  }, 500);

  console.log("🟢 VZ-م7 مُسلَّح — اضغط `Tab` حتى يقع التركيزُ داخل شريط التحكّم، " +
    "ثمّ اركن الفأرة **خارج المشغّل كلَّه** وارفع يدك (حتى 60 ثانية).");
})();
