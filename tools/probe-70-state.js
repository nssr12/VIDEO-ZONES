// مِجَسّ #70 (ب) — حال شريط المضيف في الحالات التي يُبقيه فيها ظاهراً عمداً،
// ومتتاليةُ الخروج من إطار المشغّل (الحالة الثامنة — بوّابةُ قرار #70).
//
// **يُلصق في كونسول صفحة watch — لا يُشحن، ولا يحتاج الإضافة مُحمَّلة.**
//
// ── لماذا هذا المِجَسّ أصلاً ─────────────────────────────────────────────────
// مؤقّتنا **لا يقدر إلا أن يقصّر نافذة المضيف**، فالحالات التي يُبقي فيها المضيف
// شريطه ظاهراً **عمداً** هي بالضبط الحالات التي يصير مؤقّتنا فيها **عطباً**:
// يُخفي ما يريد المضيف إبقاءه. **ولا واحدة منها مقيسة عندنا.**
//
// ⚠️ **ولا يسأل المِجَسّ عن صنفٍ بعينه** (`ytp-autohide` أو غيره): اسمٌ نخمّنه
// ثمّ نبني عليه هو `.ytp-multicam-button` من جديد (#66 — اسمٌ لا أثر له في 27
// ملفاً، ومربّعٌ لا يستطيع أن يفعل شيئاً). **يطبع أصناف المشغّل كاملةً ويحسب
// فرقها عن خطّ الأساس**، فالصنف الحامل يخرج من القياس لا من الذاكرة.
//
// ── الاستعمال ────────────────────────────────────────────────────────────────
//   الصق الملف مرّة، ثمّ:
//     VZ70.after(6, "أساس-سكون")   ← يلتقط **بعد 6 ثوانٍ**، فأبعِد يدك عن الفأرة
//     VZ70("اسم")                   ← يلتقط الآن
//     VZ70.report()                 ← التقرير **غير مقصوص** (انظر أدناه)
//
// ⚠️ **استعمل `after` لا الالتقاط المباشر في حالات السكون**: النقر في الكونسول
// يسحب التركيز ويحرّك الفأرة، **فيقيس المِجَسّ أثرَ نفسه**. درس قرار 22: قياسٌ
// يقرأ قبل أن يستقرّ الشيء المقيس يرقّي أثرَ التوقيت إلى «حقيقة منشورة».
//
// ⚠️ **والالتقاط غير مقصوص — التقرير السابق ضاع نصفه في حدّ سطر الكونسول:**
//   · `VZ70.report()` **ينسخ إلى الحافظة تلقائياً** بـ`copy()` إن كانت متاحة
//     (وهي دالّة أدوات المطوّر، لا تعمل من كود صفحة عاديّ — فلها بديلان).
//   · **ويطبع أجزاءً مرقّمة** `[1/3]` `[2/3]` … كلٌّ دون حدّ السطر، **فالنسخ
//     اليدويّ يبقى ممكناً ولو فشل الأول** — الصقها بترتيبها ولا تُسقط جزءاً.
//   · **و`VZ70.save()`** يُنزّل ملفاً `vz70-state.json` — أضمنها إن طالت.
//   · **وكل جزء يحمل ختماً `part` و`parts` و`bytes`** فيُكشف السقوط بالعدّ لا
//     بالنظر: **جزءٌ ناقص يُرى في الأرقام**، وهذا هو المقصود.
//
// ── الحالات السبع، بخطواتها مرقّمة ──────────────────────────────────────────
//  ١) **خطّ الأساس:** شغّل فيديو watch · مرّر الفأرة فوق المشغّل مرّة · ثمّ
//     `VZ70.after(6, "1-اساس-سكون")` **وارفع يدك تماماً** حتى تسمع الصفير.
//  ٢) **حركة:** حرّك الفأرة فوق المشغّل ثمّ `VZ70("2-بعد-حركة")` فوراً.
//  ٣) **متوقّف:** أوقف الفيديو (زرّ التشغيل) · ثمّ `VZ70.after(6, "3-متوقف")` وارفع يدك.
//  ٤) **قائمة مفتوحة:** شغّل · افتح ⚙️ الإعدادات · ثمّ `VZ70.after(6, "4-قائمة")` وارفع يدك.
//  ٥) **سحب الشريط:** نفّذ `VZ70.after(5, "5-سحب")` **ثمّ** أبقِ زرّ الفأرة
//     **مضغوطاً** على شريط التقدّم بلا حركة حتى تسمع الصفير.
//  ٦) **إعلان:** افتح فيديو يبدأ بإعلان · وأثناء الإعلان `VZ70.after(6, "6-اعلان")`.
//  ٧) **تركيز لوحة مفاتيح:** انقر على المشغّل ثمّ اضغط Tab حتى يقع التركيز على
//     زرّ داخله · ثمّ `VZ70.after(6, "7-تركيز")` وارفع يدك.
//
// ── ⭐ الحالة الثامنة — بوّابةُ قرارٍ لا تفصيل (طلب المالك 2026-08-02) ───────
// **الخروج من إطار المشغّل إلى الصفحة تحته: هل يُخفي يوتيوب شريطه فوراً أم بعد
// مهلة؟** وعليها يُبنى قرار #70: أنُخفي فور الخروج أم نترك المؤقّت يمضي.
//   ٨) نفّذ `VZ70.leave(8)` — يلتقط **متتاليةً زمنية** (فوراً · +150 · +400 ·
//      +800 · +1500 · +3000 ملّي) **بعد 8 ثوانٍ**، فحرّك الفأرة فوق المشغّل ثمّ
//      **أنزلها إلى الصفحة تحته واتركها ساكنة** حتى تسمع الصفير.
//      ⚠️ **ولا تحرّك الفأرة بعد الصفير** — المتتالية تقيس ما يفعله المضيف
//      وحده، وحركةٌ منك أثناءها **تُعيد إظهار الشريط فتُفسد القياس**.
//      **والنتيجة تُقرأ من أول لقطة يصير فيها `chrome.vis === false`.**
//
//  ثمّ: `VZ70.report()` — وانسخ الأجزاء كلها بترتيبها، أو `VZ70.save()`.
(() => {
  const MARK = "VZ70-STATE";
  const snaps = [];

  const clsOf = (el) => String(el?.className?.baseVal ?? el?.className ?? "");
  const q = (s) => { try { return [...document.querySelectorAll(s)]; } catch { return []; } };

  // نفس تعريف «مرئي» في `probe-70-tree.js` حرفاً: display · visibility ·
  // opacity **متراكمة على الأسلاف** · ثمّ المستطيل. لا تعريف ثانٍ يتباعد.
  const seen = (el) => {
    if (!el) return { vis: false, why: "غائب" };
    const b = el.getBoundingClientRect();
    let node = el, op = 1;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      if (cs.display === "none") return { vis: false, why: "display:none", w: Math.round(b.width), h: Math.round(b.height) };
      if (cs.visibility === "hidden") return { vis: false, why: "visibility:hidden", w: Math.round(b.width), h: Math.round(b.height) };
      op *= parseFloat(cs.opacity);
      node = node.parentElement;
    }
    if (!(op > 0)) return { vis: false, why: "opacity:0", w: Math.round(b.width), h: Math.round(b.height), op };
    if (b.width <= 0 || b.height <= 0) return { vis: false, why: "مستطيل صفريّ", w: 0, h: 0, op };
    return { vis: true, why: "", w: Math.round(b.width), h: Math.round(b.height), op: Number(op.toFixed(3)) };
  };

  const snap = (name) => {
    const P = document.querySelector("#movie_player");
    const V = document.querySelector("video");
    if (!P || !V) { console.log(`${MARK} ⛔ لا مشغّل ولا فيديو — لا لقطة`); return null; }

    const a = document.activeElement;
    const s = {
      name,
      cls: clsOf(P),                                   // ← الصنف الحامل يخرج من هنا
      bar: seen(q(".ytp-progress-bar-container")[0]),
      chrome: seen(q(".ytp-chrome-bottom")[0]),
      top: seen(q(".ytp-chrome-top")[0]),
      paused: V.paused,
      t: Math.round(V.currentTime),
      rate: V.playbackRate,
      // «إعلان» يُقرأ من أصناف المشغّل نفسها لا من محدِّد إعلان نخمّنه
      adCls: (clsOf(P).match(/ad-\S+/g) || []).join(" ") || "-",
      menuOpen: q(".ytp-popup").some((el) => seen(el).vis),
      focus: a ? `${a.tagName}.${clsOf(a).slice(0, 40)}` : "-",
      focusInPlayer: !!(a && P.contains(a)),
      fs: !!document.fullscreenElement,
      cursor: getComputedStyle(P).cursor
    };
    snaps.push(s);
    console.log(`${MARK} ✅ «${name}» — الشريط ${s.bar.vis ? "ظاهر" : "مخفيّ (" + s.bar.why + ")"} · أصناف: ${s.cls.slice(0, 110)}`);
    return s;
  };

  const VZ70 = (name) => snap(name || `لقطة-${snaps.length}`);

  // صفيرٌ خفيف يعلن اللحظة بلا أن تنظر إلى الشاشة — فيدك على الفأرة لا عليها
  const beep = () => {
    try {
      const c = new AudioContext(), o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 880; g.gain.value = 0.05;
      o.connect(g); g.connect(c.destination); o.start();
      setTimeout(() => { o.stop(); c.close(); }, 120);
    } catch {}
  };

  // التقاط مؤجَّل: ارفع يدك عن الفأرة، والصفير يعلن الالتقاط
  VZ70.after = (sec, name) => {
    console.log(`${MARK} ⏳ ${sec}ث… ارفع يدك عن الفأرة الآن.`);
    setTimeout(() => {
      snap(name || `لقطة-${snaps.length}`);
      beep();
    }, sec * 1000);
    return `سيلتقط «${name}» بعد ${sec} ثوانٍ`;
  };

  // ── ⭐ الحالة الثامنة: متتالية الخروج من إطار المشغّل ─────────────────────
  // **بوّابةُ قرارٍ لا تفصيل:** فوراً أم بعد مهلة؟ وعليها يُبنى قرار #70.
  // متتالية لا لقطة، **لأن السؤال زمنيّ بطبعه** — ولقطةٌ واحدة تجيب «مخفيّ»
  // أو «ظاهر» ولا تقول متى، فيصير الجواب رهنَ اللحظة التي صادفناها.
  const LEAVE_OFFSETS = [0, 150, 400, 800, 1500, 3000];
  VZ70.leave = (sec = 8) => {
    console.log(`${MARK} ⏳ ${sec}ث… حرّك الفأرة فوق المشغّل ثمّ **أنزلها إلى الصفحة تحته واتركها ساكنة**.`);
    setTimeout(() => {
      beep();
      const t0 = LEAVE_OFFSETS[0];
      for (const off of LEAVE_OFFSETS) {
        setTimeout(() => {
          const s = snap(`8-خروج+${off}ms`);
          if (s) s.leaveOffsetMs = off;
          if (off === LEAVE_OFFSETS[LEAVE_OFFSETS.length - 1]) {
            console.log(`${MARK} ✅ انتهت متتالية الخروج — والجواب: **أول لقطة يصير فيها chrome.vis=false**.`);
          }
        }, off - t0);
      }
    }, sec * 1000);
    return `متتالية الخروج بعد ${sec} ثوانٍ · ${LEAVE_OFFSETS.length} لقطات`;
  };

  const buildReport = () => {
    // الفرق عن خطّ الأساس (أول لقطة) — **الصنف الحامل يظهر هنا**
    const base = new Set(snaps[0].cls.split(/\s+/).filter(Boolean));
    const rows = snaps.map((s) => {
      const cur = new Set(s.cls.split(/\s+/).filter(Boolean));
      return { ...s,
        clsAdded: [...cur].filter((c) => !base.has(c)),
        clsRemoved: [...base].filter((c) => !cur.has(c)) };
    });
    return JSON.stringify({ v: 2, url: location.href.slice(0, 120), n: rows.length, rows });
  };

  // ⚠️ **الالتقاط غير مقصوص — والتقرير السابق ضاع نصفه في حدّ سطر الكونسول.**
  // ثلاثة مخارج لا واحد، **فسقوطُ أحدها لا يُسقط القياس**: الحافظة · أجزاء
  // مرقّمة بأختامها · وملفّ يُنزَّل. **وكل جزء يحمل عدّه وحجمه** فيُكشف النقص
  // بالعدّ لا بالنظر.
  const CHUNK = 3500;
  VZ70.report = () => {
    if (!snaps.length) { console.log(`${MARK} لا لقطات بعد`); return; }
    const json = buildReport();
    const parts = Math.ceil(json.length / CHUNK);

    let copied = false;
    try {
      // `copy` دالّة أدوات المطوّر — موجودة حين يُلصق الملف في الكونسول
      if (typeof copy === "function") { copy(`${MARK} ${json}`); copied = true; }
    } catch {}

    console.log(`${MARK} تقرير · ${json.length} حرفاً · ${parts} جزءاً` +
      (copied ? " · **نُسخ إلى الحافظة ✅ — الصقه مباشرةً**" : " · (الحافظة غير متاحة — انسخ الأجزاء)"));
    for (let i = 0; i < parts; i++) {
      console.log(`${MARK}[${i + 1}/${parts}] ` + json.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    console.log(`${MARK} ↑ الأجزاء ${parts} كلها بترتيبها، ولا تُسقط واحداً. ` +
      "و`clsAdded`/`clsRemoved` مقارنةً بأول لقطة — **ومنها يُقرأ الصنف الحامل لإخفاء الشريط، لا من اسم نفترضه**. " +
      "وإن طالت: `VZ70.save()` يُنزّلها ملفاً.");
    return `${json.length} حرفاً في ${parts} جزءاً`;
  };

  // أضمن المخارج الثلاثة حين يطول التقرير: ملفٌّ يُنزَّل بلا نسخٍ ولا حافظة
  VZ70.save = () => {
    if (!snaps.length) { console.log(`${MARK} لا لقطات بعد`); return; }
    const json = buildReport();
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([`${MARK} ${json}`], { type: "application/json" }));
      a.download = "vz70-state.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      console.log(`${MARK} ✅ نُزِّل vz70-state.json · ${json.length} حرفاً`);
    } catch (e) {
      console.log(`${MARK} ⛔ تعذّر التنزيل (${e && e.message}) — استعمل الأجزاء من VZ70.report()`);
    }
  };

  VZ70.reset = () => { snaps.length = 0; console.log(`${MARK} صُفِّرت اللقطات`); };
  window.VZ70 = VZ70;
  console.log(`${MARK} جاهز — سبع حالات + متتالية الخروج (الثامنة).
  ابدأ:      VZ70.after(6, "1-اساس-سكون")   ثمّ ارفع يدك عن الفأرة
  والثامنة:  VZ70.leave(8)                  ⭐ بوّابة قرار #70
  والتقرير:  VZ70.report()   أو   VZ70.save()`);
})();
