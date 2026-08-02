// مِجَسّ #70 (أ) — شجرة شريط التقدّم: أيّ محدِّد يُخفي التقدّم وحده، وماذا يجرّ معه.
//
// **النسخة 3** — والمخرَج يحمل `"v":3` فلا يُخلط بخطَّي الأساس (`AUDIT.md` القسم
// الثالث عشر: النسخة 1 مقصوصة، والنسخة 2 كاملة بتشغيلتيها).
//
// ── ما أُصلح في النسخة 3 — الشاهد الثالث والعشرون ─────────────────────────────────────────
// **خانة `hides` كانت تحوي نموّاً لا انكماشاً**: إخفاء `.ytp-subtitles-button`
// طبع `".ytp-left-controls":"507×56 ⇒ 555×56"` — **إعادة تدفّق، والاسم يَعِد
// بإخفاء**. **قياسٌ صحيح تحت وصفٍ كاذب، للمرّة الثالثة** بعد «مرئي» (عمى `S7`
// الرابع) و«انقلاب الحالة أ» (قرار 21). ⇒ **الأثر مصنَّف الآن ولا خانة اسمها
// `hides` أصلاً**: `gone` (صار 0×0، **وهو وحده «أخفاه»**) · `shrunk` (أصغر وما
// زال) · `grew` (**نموّ = إعادة تدفّق**) · `mixed` (بُعدٌ يزيد وآخر ينقص) ·
// `same` **عدداً لا غياباً** — فالسكوت لا يُقرأ «لا شيء».
// **وزيادةً `vzPresent`**: حالُ إضافتنا تُختم مع القياس، لأن مربّعات Clean Player
// **تُغيّر الشجرة فعلاً** (مقيس: `.ytp-chapter-container` ⇒ `display:none`).
//
// **وثلاث فجوات في النسخة 1 أُغلقت في النسخة 2 بقرار المالك 2026-08-02:**
//   **(١) جداءٌ كامل** — كان `.ytp-scrubber-container` **مرشّحاً لا جاراً**، فلم
//       يُعرف أهو من نسل الحاوية. **وإن لم يكن، فإخفاء الحاوية يترك نقطةً سابحة
//       بلا شريط تحتها.** صار **كلٌّ يُقاس في مواجهة كلٍّ** (25 × 25).
//   **(٢) الفصول** — `.ytp-chapter-container` كان **0×0** لأن الفيديو بلا فصول،
//       **وصفرٌ من حالٍ لم تُنتَج لا يُقرأ نفياً** (قاعدة `S7`). فصار المِجَسّ
//       **يعلن `chaptersProduced` ويصرخ إن كانت الحال غائبة** — فلا تُقرأ نتيجته
//       على أنها نفيٌ لما لم يُنتَج.
//   **(٣) ملء الشاشة** — كان القياس كلّه `fs:false`، و`S7` أثبت أن **عناصر لا
//       تُبنى إلا هناك**، **ومؤقّت #70 سيعمل هناك أيضاً**. فصار المِجَسّ يُشغَّل
//       مرّاتٍ ويجمعها، ولكل تشغيلة ختمُ `fs`.
//
// **يُلصق في كونسول صفحة watch — لا يُشحن، ولا يحتاج الإضافة مُحمَّلة.**
// تشخيصيّ كـ`tools/report-fullscreen-bug.js`، ومستثنىً من حزمة النشر مع `tools/`.
//
// ── كيف يُشغَّل ───────────────────────────────────────────────────────────────
//   ١) افتح **فيديو فيه فصول** على صفحة watch (لا تضمين — #68).
//   ٢) **حرّك الفأرة فوق المشغّل** حتى يظهر الشريط، وأبقِها فوقه.
//   ٣) الصق هذا الملف كاملاً، ثمّ:
//        VZ70T.run("نافذة")               ← تشغيلة فورية
//        VZ70T.after(8, "ملء-شاشة")       ← ثمّ اضغط `f` وحرّك الفأرة قليلاً
//        VZ70T.report()                   ← سطرٌ واحد يجمع التشغيلتين — انسخه
//
// ⚠️ **لِمَ `after` لملء الشاشة:** الكونسول لا يُكتب فيه وأنت في ملء الشاشة،
// فتُجدول التشغيلة **قبل** الدخول. وصفيرٌ خفيف يعلن الالتقاط بلا أن تنظر.
//
// ⚠️ **وثلاثة أحكام مبنيّة في المِجَسّ، لا تُقرأ نتيجته بدونها:**
//
// **(١) شاهدان قبل أي رقم (قرار 26).** موجب: `#movie_player` و`.ytp-play-button`
// **يجب** أن يُوجدا · سالب: `.ytp-vz-fake-not-real` **يجب** أن يكون صفراً. سقط
// أحدهما ⇒ **لا يُطبع رقم**، لأن مِجَسّاً لم يُثبت أنه يرى لا يُنفى به وجود شيء.
//
// **(٢) الشريط مخفيّ ⇒ يمتنع.** صفرٌ من شريطٍ مخفيّ **غياب حالٍ لا غياب عنصر**.
// **ويُعاد فحصه بعد القياس**: تغيّرَ بين الطرفين ⇒ `unstable:true` والتشغيلة
// **لا يُبنى عليها** (قرار 22 — لا يُقرأ رقمٌ قبل أن يستقرّ الشيء المقيس).
//
// **(٣) «مرئي» يُقرأ بـ`display`/`visibility`/`opacity` متراكمةً على الأسلاف، لا
// بمستطيل غير صفريّ.** العمى الرابع في `S7`: طُبع `.ytp-heat-map-container`
// «مرئياً 1081×40» وشفافيته **صفر** — **وهي جارة الشريط بالضبط**.
//
// ⚠️ **وفرقُ الصيغة بين النسخ يُعلَن كي لا تُقارَن نتيجتان بصيغتين:** النسخة 1
// سجّلت كل مُدخَل ولو «-»، والنسختان 2 و3 **تختصران** (ذات المعنى فقط) لأن
// جداء 25×25 بصيغة الأولى يخرج سطراً لا يُنسخ. **والنسخة 3 تُلغي `hides` رأساً**
// وتضع مكانها خمس خانات مصنَّفة — فسطرٌ بلا `v` **لا يُقرأ إطلاقاً**.
(() => {
  const MARK = "VZ70-TREE";
  const runs = [];

  // ── الجداء الكامل: قائمة واحدة، وكلٌّ يُقاس في مواجهة كلٍّ (الفجوة ١) ──────
  const SELECTORS = [
    // عائلة الشريط
    ".ytp-play-progress", ".ytp-load-progress", ".ytp-progress-list",
    ".ytp-scrubber-container", ".ytp-scrubber-button", ".ytp-progress-bar",
    ".ytp-progress-bar-padding", ".ytp-progress-bar-container",
    ".ytp-hover-progress", ".ytp-timed-markers-container",
    ".ytp-heat-map-container", ".ytp-heat-map-chapter",
    ".ytp-chapter-hover-container", ".ytp-chapter-container",
    // ما يجب ألّا يُخفى
    ".ytp-time-display", ".ytp-play-button", ".ytp-volume-panel",
    ".ytp-subtitles-button", ".ytp-settings-button", ".ytp-fullscreen-button",
    // الحاويات وحارس الإفراط
    ".ytp-left-controls", ".ytp-right-controls", ".ytp-chrome-controls",
    ".ytp-chrome-bottom", "video"
  ];

  const q = (s) => { try { return [...document.querySelectorAll(s)]; } catch { return []; } };
  const rect = (el) => { const b = el?.getBoundingClientRect?.(); return b ? [Math.round(b.width), Math.round(b.height)] : null; };

  const seen = (el) => {
    if (!el) return { vis: false, why: "غائب" };
    const b = el.getBoundingClientRect();
    let node = el, op = 1;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const w = Math.round(b.width), h = Math.round(b.height);
      if (cs.display === "none") return { vis: false, why: "display:none" + (node === el ? "" : " (سلف)"), w, h };
      if (cs.visibility === "hidden") return { vis: false, why: "visibility:hidden" + (node === el ? "" : " (سلف)"), w, h };
      op *= parseFloat(cs.opacity);
      node = node.parentElement;
    }
    const w = Math.round(b.width), h = Math.round(b.height);
    if (!(op > 0)) return { vis: false, why: "opacity:0", w, h, op };
    if (w <= 0 || h <= 0) return { vis: false, why: "مستطيل صفريّ", w, h, op };
    return { vis: true, why: "", w, h, op: Number(op.toFixed(3)) };
  };

  const barState = () => seen(q(".ytp-progress-bar-container")[0] || q(".ytp-chrome-bottom")[0]);

  const measure = (label) => {
    const P = document.querySelector("#movie_player");
    const V = document.querySelector("video");

    // (١) الشاهدان
    const wit = { pos_player: q("#movie_player").length, pos_play: q(".ytp-play-button").length,
                  neg_fake: q(".ytp-vz-fake-not-real").length };
    if (!wit.pos_player || !wit.pos_play || wit.neg_fake !== 0) {
      console.log(`${MARK} ⛔ «${label}» الشاهدان لم يستقيما — **لا رقم يُقرأ من هذا التشغيل**`, wit);
      return null;
    }

    // (٢) بوّابة ظهور الشريط — تُفحص قبل وبعد
    const before = barState();
    if (!before.vis) {
      console.log(`${MARK} ⛔ «${label}» الشريط **مخفيّ الآن** (${before.why}) — حرّك الفأرة فوق المشغّل وأعد.`,
        "\nصفرٌ من شريط مخفيّ **غياب حالٍ لا غياب عنصر**، ولا يُقرأ نفياً.");
      return null;
    }

    // (٢ب) الفصول: حالٌ تُعلَن، ولا تُقرأ نتيجتها نفياً إن لم تُنتَج
    const chap = q(".ytp-chapter-container")[0] || null;
    const chapSeen = seen(chap);
    const chaptersProduced = !!chapSeen.vis;

    // عناصر القياس مرّة واحدة
    const nodes = SELECTORS.map((sel) => ({ sel, el: q(sel)[0] || null, n: q(sel).length }));
    const baseRects = new Map(nodes.map((x) => [x.sel, rect(x.el)]));

    const rows = [];
    for (const a of nodes) {
      // ── الشاهد 23 — **الأثر مصنَّف، لا خانةٌ اسمها `hides` تحوي نموّاً** ────
      // `gone` = صار 0×0، **وهو وحده «أخفاه»** · `shrunk` = أصغر وما زال ·
      // `grew` = **أكبر، أي إعادة تدفّق لا إخفاء** · `mixed` = بُعدٌ يزيد وآخر
      // ينقص · `same` = **عددٌ لا غياب**، فالسكوت لا يُقرأ «لا شيء».
      const row = { sel: a.sel, n: a.n, ...seen(a.el),
        inside: {}, gone: {}, shrunk: {}, grew: {}, mixed: {}, same: 0,
        dragsVideo: false };

      // بنيةً: كلٌّ في مواجهة كلٍّ — والمُدخَلات ذات المعنى وحدها تُسجَّل
      if (a.el) {
        for (const b of nodes) {
          if (!b.el || b.sel === a.sel) continue;
          if (a.el.contains(b.el)) row.inside[b.sel] = "نسل";
          else if (b.el.contains(a.el)) row.inside[b.sel] = "سلف";
        }
      }

      // فعلياً: أخفِه واقرأ الأثر **مصنَّفاً** — ثمّ تراجَع في كل الأحوال
      if (a.el) {
        const st = document.createElement("style");
        st.textContent = `html ${a.sel}{display:none !important}`;
        try {
          document.documentElement.appendChild(st);
          for (const b of nodes) {
            if (b.sel === a.sel) continue;
            const p = baseRects.get(b.sel), c = rect(b.el);
            if (!p || !c) continue;
            if (p[0] === c[0] && p[1] === c[1]) { row.same++; continue; }
            const txt = `${p[0]}×${p[1]} ⇒ ${c[0]}×${c[1]}`;
            const dw = c[0] - p[0], dh = c[1] - p[1];
            if (c[0] <= 0 || c[1] <= 0) row.gone[b.sel] = txt;          // اختفى فعلاً
            else if (dw <= 0 && dh <= 0) row.shrunk[b.sel] = txt;       // أصغر وما زال
            else if (dw >= 0 && dh >= 0) row.grew[b.sel] = txt;         // إعادة تدفّق
            else row.mixed[b.sel] = txt;                                // بُعدٌ ضدّ بُعد
          }
          const vb = baseRects.get("video"), va = rect(V);
          row.dragsVideo = !!(vb && va && (vb[0] !== va[0] || vb[1] !== va[1]));
        } finally {
          st.remove();
        }
      }
      rows.push(row);
    }

    // (٢ج) استقرار: الشريط كما كان قبل القياس؟ (قرار 22)
    const after = barState();
    const unstable = after.vis !== before.vis;

    const run = {
      label, fs: !!document.fullscreenElement, paused: V ? V.paused : null,
      chaptersProduced, chapter: { w: chapSeen.w ?? 0, h: chapSeen.h ?? 0, why: chapSeen.why },
      unstable, vw: rect(V)?.[0] ?? 0, vh: rect(V)?.[1] ?? 0,
      ytp: [...document.querySelectorAll("*")].filter((e) => /(^|\s)ytp-/.test(String(e.className?.baseVal ?? e.className ?? ""))).length,
      rows
    };
    runs.push(run);

    console.log(`${MARK} ✅ «${label}» — fs:${run.fs} · فصول:${chaptersProduced ? "نعم" : "**لا**"} · ` +
      `عناصر ytp:${run.ytp}${unstable ? " · ⚠️ **unstable**" : ""}`);
    if (!chaptersProduced) {
      console.log(`${MARK} ⚠️ **الفصول لم تُنتَج في هذه التشغيلة** (${chapSeen.why || "0×0"}) — ` +
        "صفرُها **غياب حالٍ لا نتيجة**، ولا يُقرأ نفياً. افتح فيديو بفصول وأعد.");
    }
    if (unstable) {
      console.log(`${MARK} ⚠️ **الشريط تغيّر بين طرفي القياس** — لا يُبنى على هذه التشغيلة، أعدها والفأرة فوق المشغّل.`);
    }
    return run;
  };

  const VZ70T = (label) => measure(label || `تشغيلة-${runs.length}`);
  VZ70T.run = VZ70T;

  VZ70T.after = (sec, label) => {
    console.log(`${MARK} ⏳ ${sec}ث… ادخل ملء الشاشة الآن (مفتاح f) وحرّك الفأرة قليلاً كي يظهر الشريط.`);
    setTimeout(() => {
      measure(label || `تشغيلة-${runs.length}`);
      try {
        const c = new AudioContext(), o = c.createOscillator(), g = c.createGain();
        o.frequency.value = 880; g.gain.value = 0.05;
        o.connect(g); g.connect(c.destination); o.start();
        setTimeout(() => { o.stop(); c.close(); }, 120);
      } catch {}
    }, sec * 1000);
    return `سيقيس «${label}» بعد ${sec} ثوانٍ`;
  };

  VZ70T.report = () => {
    if (!runs.length) { console.log(`${MARK} لا تشغيلات بعد`); return; }
    const P = document.querySelector("#movie_player");
    console.log(`${MARK} ` + JSON.stringify({
      v: 3, url: location.href.slice(0, 120),
      build: (P?.dataset?.version || "").slice(0, 64),
      // ⚠️ **حال الإضافة تُختم مع القياس** — قِيس أن مربّعات Clean Player تُغيّر
      // الشجرة (`.ytp-chapter-container` ⇒ `display:none`). فمن رأى فرقاً بين
      // خطَّي أساس **يسأل عن مربّعاتنا قبل أن يتّهم يوتيوب**.
      vzPresent: !!document.getElementById("vz_clean_player_css") ||
                 !!document.getElementById("vz_subtitles_css") ||
                 !!document.querySelector(".vzWrap"),
      n: runs.length, runs
    }));
    console.log("↑ انسخ السطر أعلاه كاملاً. `v:3` — الأثر **مصنَّف**: `gone` (صار 0×0، وهو وحده «أخفاه») · " +
      "`shrunk` · `grew` (**إعادة تدفّق لا إخفاء**) · `mixed` · `same` عدداً. " +
      "و`chaptersProduced:false` ⇒ صفر الفصول **لا يُقرأ نفياً** · `unstable:true` ⇒ التشغيلة تُعاد.");
  };

  VZ70T.reset = () => { runs.length = 0; console.log(`${MARK} صُفِّرت التشغيلات`); };
  window.VZ70T = VZ70T;
  console.log(`${MARK} v3 جاهز. افتح **فيديو بفصول**، ثمّ:  VZ70T.run("نافذة")  ·  VZ70T.after(8,"ملء-شاشة")  ·  VZ70T.report()`);
})();
