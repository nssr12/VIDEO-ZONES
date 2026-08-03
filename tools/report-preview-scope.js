// مِجَسّ #94 — **أالأدواتُ داخل نطاق الفيديو أم حولَه؟** يُلصق في كونسول الصفحة.
//
// ── كيف يُستعمل ──────────────────────────────────────────────────────────────
//   1) افتح الصفحة الرئيسية ليوتيوب، وافتح الكونسول (F12).
//   2) الصق هذا الملفّ كلَّه واضغط Enter — يطبع «مُسلَّح».
//   3) **ثمّ حوّم على مصغَّرة حتى تعمل المعاينة** ودعها تعمل ثانيتين.
//   4) يطبع سطراً واحداً وينسخه إلى الحافظة تلقائياً.
//
// ── لماذا يُسلَّح ولا يقيس فوراً ─────────────────────────────────────────────
// **اللصق يسرق التحويم**: الكونسول يأخذ التركيز فتنتهي المعاينة قبل أن تُقاس.
// فيُسلَّح أوّلاً ويقيس **حين تعمل معاينةٌ فعلاً** — و«تعمل» تُقاس بتقدّم
// `currentTime` بين عيّنتين لا بعلَم `paused`.
//
// ── شاهدا قرار 26 — **يُطبعان مع الرقم، فلا يُصدَّق صفرٌ بلا شاهد** ──────────
//  · **موجب:** يُدسّ زرٌّ مرئيّ **داخل** النطاق ⇒ **يجب أن يزيد عدُّ الداخل 1**.
//  · **سالب:** ويُدسّ **خارجه** فوق مستطيل الفيديو ⇒ **يجب ألّا يزيد عدُّ الداخل**
//    وأن يزيد عدُّ الخارج. **بلا هذا، «صفر أداة داخل النطاق» لا يُميّز شيئاً.**
//  والزرّان يُزالان فوراً، والقياس متزامن (المستطيل يُقرأ بعد الإضافة مباشرة).
//
// ⚠️ **الداخل والخارج يُحسمان بـ`contains` لا بالنظر** — كما في #67 و#70.
// ⚠️ **و«مرئيّ» شرطُه المقيس** (`S7`): عرضٌ ورؤيةٌ **وشفافيةٌ فعّالة عبر السلسلة**
// ومستطيلٌ غير صفريّ. عنصرٌ بشفافية صفر طُبع يوماً «مرئياً 1081×40».
//
// ⛔ **تشخيصيّ لا يُشحن.** ونسخته من محدّد الحاويات ومن حكم #58 محروسة نصّياً
// بـ`tools/test-preview-probe-sync.js` فلا تتباعد عن `content.js`.
(() => {
  // ---- نسخة محروسة من content.js: KNOWN_PLAYER_WRAPPER_SELECTOR ----
  const KNOWN =
    "#movie_player," +              // YouTube
    ".html5-video-player," +        // YouTube alt class
    ".video-player," +              // Twitch / generic
    "[data-a-target='video-player']," + // Twitch
    ".jw-wrapper," +                // JW Player
    ".video-js," +                  // Video.js
    ".plyr," +                      // Plyr
    ".vjs-fluid";                   // Video.js variant
  const FILL = 0.95;                // VZ_FILL_RATIO
  const MAXD = 8;                   // FS_CONTAINER_MAX_DEPTH

  // ⚠️ **زرُّ الشاهد ليس منها عمداً**: أوّل تشغيلٍ للمِجَسّ استثناه بوصفه «عنصراً
  // منّا»، **فسقط الشاهدان معاً** — والمِجَسّ يُخفي ما دسَّه ليراه. ⇒ **يُستثنى
  // ما يُشوّش القياس (زرُّنا المشحون) لا ما يُثبته.**
  const OURS = ".vzWrap, .vzSpeedBtn";
  const CTRL_SEL = 'button,[role="button"],a[href]';
  const SLIDER_SEL = '[role="slider"],input[type="range"],[aria-valuenow],progress';

  const effOpacity = (el) => {
    let o = 1, n = el;
    while (n && n.nodeType === 1) { o *= Number(getComputedStyle(n).opacity) || 0; n = n.parentElement; }
    return o;
  };
  const visible = (el) => {
    if (!el || el.nodeType !== 1) return false;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" &&
           effOpacity(el) > 0 && r.width > 0 && r.height > 0;
  };
  const desc = (el) => el ? (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : "")).slice(0, 60) : "—";
  const dim = (el) => { if (!el) return "—"; const r = el.getBoundingClientRect();
    return Math.round(r.width) + "x" + Math.round(r.height); };
  const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right ||
                               a.bottom <= b.top || a.top >= b.bottom);

  // حكم #58 نفسه: أقرب سلفٍ يشبه مشغّلاً ويملؤه الفيديو
  const looksLikePlayer = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches && el.matches(KNOWN)) return true;
    const cls = (el.className || "").toString();
    const role = (el.getAttribute && el.getAttribute("role")) || "";
    return /player|video|controls|overlay|container/i.test(cls + " " + role);
  };
  const fills = (v, el) => {
    const a = v.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    return a.width / r.width >= FILL && a.height / r.height >= FILL;
  };
  const nearestPlayer = (v) => {
    let el = v.parentElement;
    for (let i = 0; i < MAXD && el && el !== document.body && el !== document.documentElement; i++) {
      if (looksLikePlayer(el) && fills(v, el)) return el;
      el = el.parentElement;
    }
    return null;
  };
  const scopeOf = (v) => (v.closest(KNOWN) || nearestPlayer(v) || null);

  // ── النطاق الواسع — المرشّح الثاني، **وُلد من فيميو ويُقاس معه** ───────────
  // حكم #58 يجد **أقرب** عنصرٍ يملؤه الفيديو، **وشريطُ التحكّم يقع خارجه بطبعه**:
  // على فيميو أعطى `div.vp-video` وفيه **صفر أداة**، والأدوات في `div#player`
  // بنسبة مساحة **×1**. ⇒ **الاسم يفوز أوّلاً، وإلّا يُصعد إلى أبعد سلفٍ يشبه
  // مشغّلاً ما لم تكبر مساحتُه** — **والحدّ حارسٌ لا مُميِّز** (لم يقلب حكم أيٍّ
  // من الخمسة المقيسة).
  const WIDE_MAX = 1.2;
  const wideScopeOf = (v) => {
    const known = v.closest(KNOWN);
    if (known) return known;
    const r0 = v.getBoundingClientRect();
    const vArea = Math.max(1, r0.width * r0.height);
    let el = v.parentElement, best = null;
    for (let i = 0; i < MAXD && el && el !== document.body && el !== document.documentElement; i++) {
      if (looksLikePlayer(el)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.width * r.height <= vArea * WIDE_MAX) best = el;
      }
      el = el.parentElement;
    }
    return best;
  };

  // مدى البحث عن «ما حولَه»: سلفٌ محدود لا المستند كلّه — بطاقةُ المصغَّرة تقع فيه.
  const aroundRoot = (v, scope) => {
    const vr = v.getBoundingClientRect();
    const vArea = Math.max(1, vr.width * vr.height);
    let el = (scope || v).parentElement, best = el;
    for (let i = 0; i < 6 && el; i++) {
      const r = el.getBoundingClientRect();
      if (r.width * r.height > vArea * 20) break;
      best = el; el = el.parentElement;
    }
    return best || document.body;
  };

  // ── الإحصاء: داخل النطاق وخارجَه، والحسم بـ`contains` ─────────────────────
  function census(v, scope) {
    const vr = v.getBoundingClientRect();
    const root = aroundRoot(v, scope);
    const out = { inBtn: 0, inSlider: 0, inTime: 0, outBtn: 0, outSlider: 0, outNames: [] };
    const seen = new Set();
    const walk = (sel, kind) => {
      for (const el of root.querySelectorAll(sel)) {
        if (el.closest(OURS)) continue;                 // عناصرنا ليست المضيف
        if (!visible(el)) continue;
        const inside = !!(scope && scope.contains(el));
        if (!inside && !overlaps(el.getBoundingClientRect(), vr)) continue; // بعيدٌ عن الصورة
        if (kind === "btn") { inside ? out.inBtn++ : out.outBtn++; }
        else { inside ? out.inSlider++ : out.outSlider++; }
        if (!inside && out.outNames.length < 4 && !seen.has(el)) { seen.add(el); out.outNames.push(desc(el)); }
      }
    };
    walk(CTRL_SEL, "btn");
    walk(SLIDER_SEL, "slider");
    if (scope) {
      for (const el of scope.querySelectorAll("*")) {
        if (out.inTime) break;
        const t = (el.childElementCount === 0 && el.textContent || "").trim();
        if (/^\d+:\d\d(:\d\d)?$/.test(t) && visible(el)) out.inTime = 1;
      }
    }
    return out;
  }

  // ── الشاهدان: يُدسّ زرٌّ داخل النطاق ثمّ خارجه، ويُقاس أثرُ كلٍّ ────────────
  function witnesses(v, scope) {
    const vr = v.getBoundingClientRect();
    const mk = (host, fixed) => {
      const b = document.createElement("button");
      b.className = "vzProbeWitness";
      b.textContent = "·";
      b.style.cssText = "all:initial;position:" + (fixed ? "fixed" : "absolute") +
        ";width:14px;height:14px;opacity:1;visibility:visible;display:block;pointer-events:none;z-index:1;" +
        (fixed ? "left:" + Math.round(vr.left + vr.width / 2) + "px;top:" +
                 Math.round(vr.top + vr.height / 2) + "px;" : "left:0;top:0;");
      host.appendChild(b);
      // ⚠️ **`position:fixed` لا يعني الشاشة دائماً**: سلفٌ بـ`transform` يجعله
      // نسبةً إليه — **فوقع زرُّ الشاهد بعيداً عن الصورة وسقط الشاهد وهو مرئيّ**.
      // ⇒ **يُقاس موضعُه بعد الإضافة ويُصحَّح بالفرق**، ولا يُفترض أنه حيث طُلب.
      if (fixed) {
        const got = b.getBoundingClientRect();
        const tx = vr.left + vr.width / 2, ty = vr.top + vr.height / 2;
        b.style.left = (parseFloat(b.style.left || "0") + (tx - got.left)) + "px";
        b.style.top = (parseFloat(b.style.top || "0") + (ty - got.top)) + "px";
      }
      return b;
    };
    const base = census(v, scope);
    let pos = null, neg = null, why = "";
    if (scope) {
      const b = mk(scope, false);
      const c = census(v, scope);
      pos = c.inBtn === base.inBtn + 1;
      if (!pos) why += `+(داخل ${base.inBtn}⇒${c.inBtn} · مرئيّ=${visible(b)} · ${dim(b)})`;
      b.remove();
    }
    // **المضيف يجب أن يكون مرسوماً**: زرٌّ في سلفٍ `display:none` مستطيلُه صفر
    // فلا يُعدّ — فيُختار أوّل سلفٍ **مرئيّ** خارج النطاق، ويُعلَن حين لا يوجد.
    let outHost = scope ? scope.parentElement : v.parentElement;
    for (let i = 0; i < 6 && outHost && !visible(outHost); i++) outHost = outHost.parentElement;
    if (outHost && visible(outHost) && (!scope || !scope.contains(outHost))) {
      const b = mk(outHost, true);
      const c = census(v, scope);
      neg = c.inBtn === base.inBtn && c.outBtn === base.outBtn + 1;
      if (!neg) why += `−(داخل ${base.inBtn}⇒${c.inBtn} · خارج ${base.outBtn}⇒${c.outBtn}` +
        ` · مضيف=${desc(outHost)} · مرئيّ=${visible(b)} · ${dim(b)})`;
      b.remove();
    } else if (!why) { why += "−(لا سلف مرئيّ خارج النطاق)"; }
    return { pos, neg, why, ok: (scope ? pos === true : true) && neg === true };
  }

  // ── التسليح: يُقاس حين تعمل معاينةٌ فعلاً ──────────────────────────────────
  let ptr = { x: -1, y: -1 };
  const onMove = (e) => { ptr = { x: e.clientX, y: e.clientY }; };
  addEventListener("mousemove", onMove, true);

  let prev = new Map(), tries = 0, timer = null;
  const stop = () => { removeEventListener("mousemove", onMove, true); clearInterval(timer); };

  function pickLive() {
    const live = [];
    for (const v of document.querySelectorAll("video")) {
      const r = v.getBoundingClientRect();
      const was = prev.get(v);
      const advanced = was != null && v.currentTime > was + 0.05;
      prev.set(v, v.currentTime);
      if (advanced && !v.paused && r.width > 0 && r.height > 0 && visible(v)) live.push({ v, r });
    }
    if (!live.length) return null;
    const under = live.find(({ r }) => ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom);
    return (under || live[0]).v;
  }

  function emit(v) {
    const scope = scopeOf(v);
    const w = witnesses(v, scope);
    const c = census(v, scope);
    const wide = wideScopeOf(v);
    const w2 = census(v, wide);
    const vr = v.getBoundingClientRect();
    const docBar = document.querySelector(".ytp-right-controls");
    const line = [
      "VZ94",
      "url=" + location.href,
      "نطاق=" + desc(scope) + (scope ? " " + dim(scope) : " (فيديو خام بلا مشغّل)"),
      "فيديو=" + Math.round(vr.width) + "x" + Math.round(vr.height) +
        " مدّة=" + (Number.isFinite(v.duration) ? Math.round(v.duration) : "—") +
        " مكتوم=" + (v.muted ? "نعم" : "لا"),
      "داخل: أزرار=" + c.inBtn + " منزلقات=" + c.inSlider + " وقت=" + (c.inTime ? "نعم" : "لا"),
      "واسع=" + desc(wide) + " [أزرار=" + w2.inBtn + " منزلقات=" + w2.inSlider +
        " وقت=" + (w2.inTime ? "نعم" : "لا") + "]",
      "خارج(فوق الصورة): أزرار=" + c.outBtn + " منزلقات=" + c.outSlider,
      "أسماء الخارج=" + (c.outNames.length ? c.outNames.join(" ، ") : "—"),
      "ytp-right-controls: في النطاق=" +
        (scope && scope.querySelector(".ytp-right-controls") ? "نعم" : "لا") +
        " · في المستند=" + (docBar ? "نعم " + dim(docBar) : "لا") +
        " · داخل=" + desc(docBar && docBar.closest(KNOWN)),
      "زرّنا=" + (document.querySelector(".vzSpeedBtn")
        ? (visible(document.querySelector(".vzSpeedBtn")) ? "مرئيّ " : "مخفيّ ") +
          (document.querySelector(".vzSpeedBtn").closest(".ytp-right-controls") ? "في الشريط" : "في طبقتنا")
        : "غير موجود"),
      "شاهد+=" + (w.pos === null ? "—(لا نطاق)" : w.pos ? "✅" : "❌"),
      "شاهد−=" + (w.neg === null ? "—" : w.neg ? "✅" : "❌") + (w.why ? " " + w.why : ""),
      "شاشة=" + innerWidth + "x" + innerHeight
    ].join(" | ");

    if (!w.ok) {
      console.log("❌ **المِجَسّ لا يُصدَّق — سقط شاهدٌ من شاهدَي قرار 26**، والأرقام تحته لا يُبنى عليها:");
    }
    console.log(line);
    try { copy(line); console.log("↑ نُسخ إلى الحافظة"); } catch {}
    return line;
  }

  timer = setInterval(() => {
    tries++;
    const v = pickLive();
    if (v) { stop(); emit(v); return; }
    if (tries > 150) {                       // ~60 ثانية
      stop();
      console.log("⚠️ VZ94: لم تعمل أي معاينة خلال 60 ثانية — **لا يُطبع رقمٌ عن حالٍ لم تُنتَج**. " +
        "حوّم على مصغَّرة ودعها تعمل، ثمّ أعِد اللصق.");
    }
  }, 400);

  console.log("🟢 VZ94 مُسلَّح — حوّم الآن على مصغَّرة حتى تعمل المعاينة (حتى 60 ثانية).");
})();
