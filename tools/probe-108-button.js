// مِجَسّ #108 — **لماذا لا يظهر زرُّ الفلاتر؟** يمشي سلسلةَ القرار خطوةً خطوة.
//
// **يُلصق في كونسول صفحة يوتيوب — وفي سياق الإضافة، لا سياق الصفحة.**
// ⚠️ **وكيف يُبدَّل السياق:** في أعلى الكونسول قائمةٌ مكتوبٌ فيها `top` — تُفتح
// ويُختار منها اسمُ الإضافة (`Video Interaction Zones`). **وبدونه لا يرى المِجَسّ
// دوالَّنا** — وهو أوّلُ شروط الإبطال أدناه.
//
// ── ⛔ شرطُ الإبطال — يُقرأ قبل أي سطرٍ يخرج منه ────────────────────────────
// **لا يُقرأ من خرْجه شيء، ولا يُبنى عليه علاج، إن وقعت أيٌّ من هذي:**
//  ١) **السياق خطأ:** `filterButtonActive` غيرُ معرَّفة ⇒ **نحن في سياق الصفحة**
//     لا الإضافة. **يطبع «لا قياس» ويقف** — ولا يُقرأ غيابُ الزرّ منه.
//  ٢) **لا فيديو تحت المؤشّر:** الزرُّ يُبنى للفيديو الذي يُحوَّم عليه. **حرّك
//     الفأرة فوق المشغّل ثمّ الصق** — وإلا فالصفرُ عن «لم يُسأل» لا عن «لا يوجد».
//  ٣) **المفتاح مطفأ:** إن كان `filterButtonActive()` كاذبةً فالغيابُ صحيحٌ
//     ومقصود — **والسؤالُ ينتقل إلى الإعدادات لا إلى الحقن.**
//
// ⭐ **وهو يقرأ ولا يكتب**: لا يُبدّل إعداداً ولا يُنشئ عنصراً ولا يُطلق حدثاً —
// **يستدعي دوالَّنا نفسَها ويطبع أجوبتها**، فما يخرج منه هو حكمُ الكود لا حكمُنا.
(() => {
  const MARK = "VZ108";
  const need = ["filterButtonActive", "speedBtnVideo", "videoOwnsControls",
                "playerScopeForVideo", "speedBtnHostSlot", "speedBtnPlacement"];
  const missing = need.filter((n) => typeof globalThis[n] !== "function");
  // ⚠️ **وتُؤخذ بأسمائها من العالم لا تُنادى مباشرةً** — فهي دوالُّ سكربت المحتوى
  // **ولا وجودَ لها في ملفّ المِجَسّ**: نداءٌ مباشر **يُحمّر `lint-names.mjs` بحقّ**
  // (اسمٌ يُستعمل حيث لا يُحلّ)، **والحارسُ لا يُضعَّف ليمرّ عليه كودُنا.**
  const P = Object.fromEntries(need.map((n) => [n, globalThis[n]]));
  if (missing.length) {
    console.log(`${MARK} ⛔ **لا قياس** — السياق ليس سياق الإضافة (غائب: ${missing.join(", ")}).\n` +
      "   بدّل السياق من قائمة أعلى الكونسول إلى اسم الإضافة، ثمّ أعِد اللصق.");
    return;
  }

  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }; };
  const name = (el) => !el ? null : (el.id ? "#" + el.id : "." + String(el.className || "").split(/\s+/).slice(0, 2).join("."));
  const vis = (el) => { if (!el) return null; const cs = getComputedStyle(el);
    return { display: cs.display, opacity: cs.opacity, visibility: cs.visibility, width: cs.width }; };

  const out = { url: location.href.slice(0, 90) };

  // ① البوّابة والمفتاح
  out["١_المفتاح"] = P.filterButtonActive();

  // ② الفيديو الذي يُبنى له
  const v = P.speedBtnVideo();
  out["٢_فيديو"] = v ? { rect: rect(v), paused: v.paused } : null;

  // ③ شرط #94 الموجب
  out["٣_يملك_أدواته"] = v ? P.videoOwnsControls(v) : "لا فيديو";

  // ④ نطاق المشغّل والشريط
  const scope = v ? P.playerScopeForVideo(v) : null;
  out["٤_النطاق"] = name(scope);
  const barInScope = scope?.querySelector?.(".ytp-right-controls");
  out["٤ب_الشريط_في_النطاق"] = barInScope ? rect(barInScope) : null;

  // ⑤ ما تُرجعه دالّةُ الموضع نفسُها — **وهي القاطعة**
  const slot = v ? P.speedBtnHostSlot(v) : null;
  out["٥_الموضع_المُرجَع"] = slot ? name(slot) : "null ⇒ **سقوطٌ إلى الطبقة**";

  // ⑥ الزرّان: أين هما وكيف يُرَيان
  const fb = document.querySelector(".vzFilterBtn");
  const sb = document.querySelector(".vzSpeedBtn");
  out["٦_زرّ_الفلاتر"] = fb ? { أب: name(fb.parentElement), inBar: fb.classList.contains("vzInBar"),
    مخفيّ: fb.classList.contains("vzHidden"), rect: rect(fb), css: vis(fb),
    أيقونة: rect(fb.querySelector("svg")) } : "**غير موجود في الشجرة**";
  out["٦ب_زرّ_السرعة"] = sb ? { أب: name(sb.parentElement), inBar: sb.classList.contains("vzInBar"),
    مخفيّ: sb.classList.contains("vzHidden"), rect: rect(sb) } : "غير موجود";
  out["٦ج_موضع_السرعة"] = P.speedBtnPlacement();

  // ⑦ حالُ المحرّك — فالزرّ يتبع السكون
  out["٧_المحرّك"] = typeof globalThis.vzIdleSnapshot === "function" ? globalThis.vzIdleSnapshot() : "لا لقطة";

  // ⑧ ورقة الأنماط: أهي محقونة أصلاً؟
  out["٨_الأنماط"] = !!document.querySelector("style#vz_overlay_css, style[data-vz]") ||
    [...document.querySelectorAll("style")].some((s) => (s.textContent || "").includes(".vzBtn"));

  // ⑨ ⭐⭐ **أيُّ قاعدةٍ تفوز على أيقونتنا — ومن أين** (سؤال المالك 2026-08-06)
  // **الفرقُ عمليّ لا فضوليّ:** قاعدةُ مضيفٍ تفوز تعني **أن كلَّ ما نحقنه هناك
  // يخضع لأنماطهم** — **حدٌّ يُكتب**؛ وغيابُ قاعدتنا وحدَه **سطرٌ يُضاف**.
  const icon = fb && fb.querySelector("svg");
  const matched = [], sheets = { مقروءة: 0, "محجوبة (cross-origin)": 0 };
  const visit = (rules) => {
    for (const r of rules || []) {
      if (r.cssRules) { visit(r.cssRules); continue; }          // @media وغيرُها
      if (!r.selectorText || !icon) continue;
      let hit = false;
      try { hit = icon.matches(r.selectorText); } catch {}
      if (!hit) continue;
      const st = r.style || {};
      const bits = ["width", "height", "min-width", "max-width", "flex", "display", "transform"]
        .map((k) => st.getPropertyValue && st.getPropertyValue(k) ? `${k}:${st.getPropertyValue(k)}` : null)
        .filter(Boolean);
      if (bits.length) matched.push({ محدِّد: r.selectorText.slice(0, 70), ما_يضبطه: bits.join(" · ") });
    }
  };
  for (const sh of document.styleSheets) {
    let rules = null;
    try { rules = sh.cssRules; sheets["مقروءة"]++; } catch { sheets["محجوبة (cross-origin)"]++; continue; }
    visit(rules);
  }
  out["٩_قواعدُ_تطابق_أيقونتنا"] = matched.length ? matched : "لا قاعدةَ تضبط مقاسَها";
  out["٩ب_الأوراق"] = sheets;
  out["٩ج_المحسوب"] = icon ? (cs => ({ width: cs.width, height: cs.height, flex: cs.flex,
    minWidth: cs.minWidth, display: cs.display }))(getComputedStyle(icon)) : null;
  out["٩د_سمات_العنصر"] = icon ? { width: icon.getAttribute("width"), height: icon.getAttribute("height"),
    viewBox: icon.getAttribute("viewBox") } : null;

  console.log(`${MARK} ${JSON.stringify(out)}`);

  // ⇒ ⭐⭐ **والحكمُ ثلاثةٌ لا واحد، ولكلٍّ عتبةٌ مكتوبة** (قرار 107):
  // **موجود** (في الشجرة) · **مرئيّ** (غيرُ مخفيٍّ **ومستطيلٌ يقارب جارَه**) ·
  // **قابلٌ للنقر** (الهدفُ عند مركزه هو الزرّ أو ابنُه).
  // ⛔ **و«غير صفريّ» عتبةٌ تقبل `12×40`** — وهي التي أنتجت «موجودٌ ومرئيّ»
  // عن زرٍّ لا يُرى. **فالعتبةُ نسبةٌ إلى الجار لا صفرٌ مطلق.**
  const NEIGHBOUR_MIN = 0.6;         // ستّون بالمئة من عرض جاره في الشريط
  const rf = rect(fb), rs = rect(sb);
  const hitAtCentre = (() => {
    if (!rf || rf.w <= 0) return false;
    const el = document.elementFromPoint(rf.x + rf.w / 2, rf.y + rf.h / 2);
    return !!(el && fb && (el === fb || fb.contains(el)));
  })();
  const موجود = !!fb;
  const مرئيّ = موجود && !fb.classList.contains("vzHidden") && !!rf && rf.w > 0 && rf.h > 0 &&
    (!rs || rs.w <= 0 || rf.w >= rs.w * NEIGHBOUR_MIN);
  console.log(`${MARK} ⇒ **الحكم:** موجود=${موجود ? "نعم" : "لا"} · ` +
    `مرئيّ=${مرئيّ ? "نعم" : "لا"} (عرضُه ${rf ? rf.w : "—"} · وجارُه ${rs ? rs.w : "—"} · العتبة ${NEIGHBOUR_MIN}×) · ` +
    `قابلٌ للنقر=${hitAtCentre ? "نعم" : "لا"}`);

  const cut = !out["١_المفتاح"] ? "المفتاح مطفأ ⇒ السؤال في الإعدادات"
    : !v ? "لا فيديو تحت المؤشّر ⇒ حرّك الفأرة فوق المشغّل وأعِد اللصق"
    : out["٣_يملك_أدواته"] !== true ? "#94 يمتنع: الفيديو لا يُظهر أدواته"
    : !fb ? "الزرّ غيرُ مبنيّ أصلاً"
    : fb.classList.contains("vzHidden") ? "مبنيٌّ ومخفيٌّ بالصنف (حالُ سكون)"
    : !slot ? "الموضع `null` ⇒ سقوطٌ إلى طبقتنا (والشريطُ لم يُقبل)"
    : (rf?.w || 0) === 0 ? "محقونٌ بلا عرضٍ إطلاقاً"
    : !مرئيّ ? "**محقونٌ وضامرٌ**: له عرضٌ لا يُرى — والقواعدُ في [٩] تقول لماذا"
    : !hitAtCentre ? "مرئيٌّ ولا تصله نقرةٌ — تراكبٌ فوقه"
    : "موجودٌ ومرئيٌّ وقابلٌ للنقر بحسب القياس";
  console.log(`${MARK} ⇒ **أين انقطعت السلسلة:** ${cut}`);
})();
