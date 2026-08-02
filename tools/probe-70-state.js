// مِجَسّ #70 (ب) — حال شريط المضيف في الحالات الخمس التي يُبقيه فيها ظاهراً عمداً.
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
//     VZ70.report()                 ← سطرٌ واحد قابل للنسخ بكل اللقطات
//
// ⚠️ **استعمل `after` لا الالتقاط المباشر في حالات السكون**: النقر في الكونسول
// يسحب التركيز ويحرّك الفأرة، **فيقيس المِجَسّ أثرَ نفسه**. درس قرار 22: قياسٌ
// يقرأ قبل أن يستقرّ الشيء المقيس يرقّي أثرَ التوقيت إلى «حقيقة منشورة».
//
// ── الحالات الستّ، بخطواتها ─────────────────────────────────────────────────
//  ٠) **خطّ الأساس:** شغّل الفيديو · مرّر الفأرة فوق المشغّل مرّة · ثمّ:
//     `VZ70.after(6, "0-اساس-سكون")` وارفع يدك تماماً حتى تسمع الصفير.
//  ١) **حركة:** حرّك الفأرة فوق المشغّل ثمّ `VZ70("1-بعد-حركة")` فوراً.
//  ٢) **متوقّف:** أوقف الفيديو (زرّ التشغيل) · ثمّ `VZ70.after(6, "2-متوقف")` وارفع يدك.
//  ٣) **قائمة مفتوحة:** شغّل · افتح ⚙️ الإعدادات · ثمّ `VZ70.after(6, "3-قائمة")` وارفع يدك.
//  ٤) **سحب الشريط:** أبقِ زرّ الفأرة **مضغوطاً** على شريط التقدّم بلا حركة ·
//     ثمّ (بيدك الأخرى) نفّذ `VZ70("4-سحب")` — أو `VZ70.after(4,"4-سحب")` قبل الضغط.
//  ٥) **إعلان:** افتح فيديو يبدأ بإعلان · وأثناء الإعلان `VZ70.after(6, "5-اعلان")`.
//  ٦) **تركيز لوحة مفاتيح:** انقر على المشغّل ثمّ اضغط Tab حتى يقع التركيز على
//     زرّ داخله · ثمّ `VZ70.after(6, "6-تركيز")` وارفع يدك.
//  ثمّ: `VZ70.report()` وانسخ السطر.
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

  // التقاط مؤجَّل: ارفع يدك عن الفأرة، وصفيرٌ خفيف يعلن الالتقاط بلا أن تنظر
  VZ70.after = (sec, name) => {
    console.log(`${MARK} ⏳ ${sec}ث… ارفع يدك عن الفأرة الآن.`);
    setTimeout(() => {
      snap(name || `لقطة-${snaps.length}`);
      try {
        const c = new AudioContext(), o = c.createOscillator(), g = c.createGain();
        o.frequency.value = 880; g.gain.value = 0.05;
        o.connect(g); g.connect(c.destination); o.start();
        setTimeout(() => { o.stop(); c.close(); }, 120);
      } catch {}
    }, sec * 1000);
    return `سيلتقط «${name}» بعد ${sec} ثوانٍ`;
  };

  VZ70.report = () => {
    if (!snaps.length) { console.log(`${MARK} لا لقطات بعد`); return; }
    // الفرق عن خطّ الأساس (أول لقطة) — **الصنف الحامل يظهر هنا**
    const base = new Set(snaps[0].cls.split(/\s+/).filter(Boolean));
    const rows = snaps.map((s) => {
      const cur = new Set(s.cls.split(/\s+/).filter(Boolean));
      return { ...s,
        clsAdded: [...cur].filter((c) => !base.has(c)),
        clsRemoved: [...base].filter((c) => !cur.has(c)) };
    });
    console.log(`${MARK} ` + JSON.stringify({ url: location.href.slice(0, 120), n: rows.length, rows }));
    console.log("↑ انسخ السطر أعلاه كاملاً. `clsAdded`/`clsRemoved` مقارنةً بأول لقطة — **ومنها يُقرأ الصنف الحامل لإخفاء الشريط، لا من اسم نفترضه**.");
  };

  VZ70.reset = () => { snaps.length = 0; console.log(`${MARK} صُفِّرت اللقطات`); };
  window.VZ70 = VZ70;
  console.log(`${MARK} جاهز. ابدأ بـ  VZ70.after(6, "0-اساس-سكون")  ثمّ ارفع يدك عن الفأرة.`);
})();
