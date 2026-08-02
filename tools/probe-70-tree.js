// مِجَسّ #70 (أ) — شجرة شريط التقدّم: أيّ محدِّد يُخفي التقدّم وحده، وماذا يجرّ معه.
//
// **يُلصق في كونسول صفحة watch — لا يُشحن، ولا يحتاج الإضافة مُحمَّلة.**
// تشخيصيّ كـ`tools/report-fullscreen-bug.js`، ومستثنىً من حزمة النشر مع `tools/`.
//
// ── كيف يُشغَّل ───────────────────────────────────────────────────────────────
//   ١) افتح فيديو يوتيوb عادياً (صفحة watch، لا تضمين — #68: التضمين هجر `ytp-`).
//   ٢) **حرّك الفأرة فوق المشغّل** حتى يظهر شريط التحكّم، وأبقِها فوقه.
//   ٣) الصق هذا الملف كاملاً في الكونسول واضغط Enter.
//   ٤) انسخ السطر الذي يبدأ بـ`VZ70-TREE ` وأرسله.
//
// ⚠️ **ثلاثة أحكام مبنيّة في المِجَسّ، لا تُقرأ نتيجته بدونها:**
//
// **(١) شاهدان قبل أي رقم (قرار 26).** موجب: `#movie_player` و`.ytp-play-button`
// **يجب** أن يُوجدا · سالب: `.ytp-vz-fake-not-real` **يجب** أن يكون صفراً. سقط
// أحدهما ⇒ **لا يُطبع رقم**، لأن مِجَسّاً لم يُثبت أنه يرى لا يُنفى به وجود شيء.
//
// **(٢) الشريط مخفيّ الآن ⇒ يمتنع عن الطباعة.** صفرٌ من شريطٍ مخفيّ **غياب حالٍ
// لا غياب عنصر** — وهو الخلط الذي أبطل نصف قراءات `S7` أول مرّة.
//
// **(٣) «مرئي» يُقرأ بـ`display`/`visibility`/`opacity` لا بمستطيل غير صفريّ.**
// العمى الرابع في `S7`: طُبع `.ytp-heat-map-container` «مرئياً 1081×40» وشفافيته
// **صفر** — رقمٌ صادق يقود إلى استنتاج كاذب. **والخريطة الحرارية جارةُ الشريط
// بالضبط**، فالفخّ ينتظر هذا المِجَسّ تحديداً.
//
// وهو يقيس **بالإخفاء الفعليّ لا بقراءة الشجرة وحدها**: يطبّق `display:none` على
// كل مرشّح، يقرأ أيّ الجيران انكمش، **ثمّ يتراجع في `finally`**. لأن `contains`
// تجيب «هل هو من نسله» و**لا تجيب «وهل يختفي معه»** — والثانية هي سؤال #67.
(() => {
  const MARK = "VZ70-TREE";

  // المرشّحون: «شريط التقدّم» بمعانيه المحتملة، من الأضيق إلى الأوسع
  const CANDIDATES = [
    ".ytp-play-progress",
    ".ytp-load-progress",
    ".ytp-progress-list",
    ".ytp-scrubber-container",
    ".ytp-progress-bar",
    ".ytp-progress-bar-padding",
    ".ytp-progress-bar-container",
    ".ytp-chrome-bottom"
  ];

  // الجيران الذين يسأل عنهم البند صراحةً + من يكشف الإفراط في المطابقة
  const NEIGHBOURS = [
    ".ytp-time-display",
    ".ytp-chapter-container",
    ".ytp-heat-map-container",
    ".ytp-heat-map-chapter",
    ".ytp-timed-markers-container",
    ".ytp-play-button",
    ".ytp-volume-panel",
    ".ytp-subtitles-button",
    ".ytp-settings-button",
    ".ytp-fullscreen-button",
    ".ytp-left-controls",
    ".ytp-right-controls",
    ".ytp-chrome-controls",
    "video"
  ];

  const P = document.querySelector("#movie_player");
  const V = document.querySelector("video");
  const q = (s) => { try { return [...document.querySelectorAll(s)]; } catch { return []; } };
  const r = (el) => { const b = el?.getBoundingClientRect?.(); return b ? [Math.round(b.width), Math.round(b.height)] : null; };

  // الحكم الثالث: مرئيّ = لا `display:none` ولا `visibility:hidden` ولا شفافية
  // صفر **ولا شفافية صفر على أي سلف** ولا مستطيل صفريّ.
  const seen = (el) => {
    if (!el) return { vis: false, why: "غائب" };
    const b = el.getBoundingClientRect();
    let node = el, op = 1;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      if (cs.display === "none") return { vis: false, why: "display:none" + (node === el ? "" : " (سلف)"), w: Math.round(b.width), h: Math.round(b.height) };
      if (cs.visibility === "hidden") return { vis: false, why: "visibility:hidden" + (node === el ? "" : " (سلف)"), w: Math.round(b.width), h: Math.round(b.height) };
      op *= parseFloat(cs.opacity);
      node = node.parentElement;
    }
    if (!(op > 0)) return { vis: false, why: "opacity:0", w: Math.round(b.width), h: Math.round(b.height), op };
    if (b.width <= 0 || b.height <= 0) return { vis: false, why: "مستطيل صفريّ", w: 0, h: 0, op };
    return { vis: true, why: "", w: Math.round(b.width), h: Math.round(b.height), op: Number(op.toFixed(3)) };
  };

  // ── (١) الشاهدان ───────────────────────────────────────────────────────────
  const wit = {
    pos_player: q("#movie_player").length,
    pos_play: q(".ytp-play-button").length,
    neg_fake: q(".ytp-vz-fake-not-real").length
  };
  if (!wit.pos_player || !wit.pos_play || wit.neg_fake !== 0) {
    console.log(`${MARK} ⛔ الشاهدان لم يستقيما — **لا رقم يُقرأ من هذا التشغيل**`, wit,
      "\nصفحة watch؟ ومشغّل مُحمَّل؟ (وعلى مشغّل التضمين 2026 لا وجود لعائلة ytp- أصلاً — #68)");
    return;
  }

  // ── (٢) حال الشريط الآن ────────────────────────────────────────────────────
  const barNow = seen(q(".ytp-progress-bar-container")[0] || q(".ytp-chrome-bottom")[0]);
  if (!barNow.vis) {
    console.log(`${MARK} ⛔ شريط التحكّم **مخفيّ الآن** (${barNow.why}) — حرّك الفأرة فوق المشغّل وأعد اللصق.`,
      "\nصفرٌ من شريط مخفيّ **غياب حالٍ لا غياب عنصر**، ولا يُقرأ نفياً.");
    return;
  }

  // ── (٣) القياس ─────────────────────────────────────────────────────────────
  const nEls = NEIGHBOURS.map((s) => ({ sel: s, el: q(s)[0] || null }));
  const out = { url: location.href.slice(0, 120), witnesses: wit,
    build: (P?.dataset?.version || "").slice(0, 48),
    fs: !!document.fullscreenElement, paused: V ? V.paused : null,
    ytp: [...document.querySelectorAll("*")].filter((e) => /(^|\s)ytp-/.test(String(e.className?.baseVal ?? e.className ?? ""))).length,
    candidates: [] };

  for (const sel of CANDIDATES) {
    const els = q(sel);
    const el = els[0] || null;
    const row = { sel, n: els.length, ...seen(el), inside: {}, hides: {}, dragsVideo: null };

    // بنيويّاً: أيٌّ من الجيران **من نسله** — لا بالنظر
    for (const nb of nEls) {
      if (!nb.el || !el) continue;
      row.inside[nb.sel] = el.contains(nb.el) ? "نسل" : (nb.el.contains(el) ? "سلف" : "-");
    }

    // فعلياً: أخفِه واقرأ مَن انكمش — ثمّ تراجَع في كل الأحوال
    if (el) {
      const before = new Map(nEls.map((nb) => [nb.sel, r(nb.el)]));
      const st = document.createElement("style");
      st.textContent = `html ${sel}{display:none !important}`;
      try {
        document.documentElement.appendChild(st);
        for (const nb of nEls) {
          const a = before.get(nb.sel), b = r(nb.el);
          if (!a || !b) continue;
          if (a[0] !== b[0] || a[1] !== b[1]) row.hides[nb.sel] = `${a[0]}×${a[1]} ⇒ ${b[0]}×${b[1]}`;
        }
        // حارس الإفراط في المطابقة (`S7` صنف ج): الفيديو نفسه يجب ألّا يتغيّر
        const vb = before.get("video"), va = r(V);
        row.dragsVideo = !!(vb && va && (vb[0] !== va[0] || vb[1] !== va[1]));
      } finally {
        st.remove();
      }
    }
    out.candidates.push(row);
  }

  console.log(`${MARK} ` + JSON.stringify(out));
  console.log("↑ انسخ السطر أعلاه كاملاً. `inside` = بنية (contains) · `hides` = مَن انكمش فعلاً عند الإخفاء · `dragsVideo` = إفراط في المطابقة.");
})();
