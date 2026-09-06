// ⚠️ أداة تشخيص. **لا سطر منها يُشحن في الإضافة** — تُلصق في كونسول الصفحة.
//
// هذا ما يُلصق **قبل** الإبلاغ عن أي عطب ملء شاشة (قرار المالك 19).
// يطبع سطراً واحداً قابلاً للنسخ فيه كل ما يحتاجه التشخيص، فلا يبقى بند بلا موقع.
//
// الاستعمال:
//   ١) افتح الصفحة التي فيها العطب.
//   ٢) نفّذ أمر ملء الشاشة من الإضافة (كي يُقاس الواقع لا التوقّع).
//   ٣) اخرج من ملء الشاشة إن لزم، افتح الكونسول، وألصق هذا الملف كاملاً.
//      ولو ألصقتَه **وأنت داخل ملء الشاشة** كان القياس أدقّ — يقرأ الحالة الفعلية.
//
// ⚠️ يعيش هنا نسخة من منطق `pickFullscreenContainer` عن قصد: المقطع يعمل في
// **عالم الصفحة** حيث لا وجود لدوال سكربت المحتوى (عالم معزول). والانحراف محروس:
// `tools/test-fs-report-sync.js` يقارن الثوابت الخمسة بـ `content.js` ويفشل عند
// أي اختلاف. إن غيّرت السكور في `content.js` فغيّره هنا معه.
window.__vz58 = () => {
  // ---- ثوابت مرآة لـ content.js — يحرسها tools/test-fs-report-sync.js ----
  const KNOWN_PLAYER_WRAPPER_SELECTOR =
    "#movie_player," +
    ".html5-video-player," +
    ".video-player," +
    "[data-a-target='video-player']," +
    ".jw-wrapper," +
    ".video-js," +
    ".plyr," +
    ".vjs-fluid";
  const NATIVE_FS_BUTTON_SELECTORS = [
    ".ytp-fullscreen-button",
    "button[data-a-target='player-fullscreen-button']",
    ".vjs-fullscreen-control",
    ".jw-icon-fullscreen",
    ".plyr__control[data-plyr='fullscreen']"
  ];
  const FS_BUTTON_MAX_DEPTH = 8;
  // الأرقام الثلاثة الباقية (عمق المرشّحين 8 · سقف النسبة 3.5 · النسبة المثالية
  // 1.15) تُكتب **حرفياً** داخل pickContainer أدناه لا كثوابت مسمّاة، كي يقارنها
  // الحارس نصّاً بـ content.js. لا تستبدلها بأسماء.

  const desc = (el) => {
    if (!el) return "null";
    if (el === document.body) return "BODY";
    if (el === document.documentElement) return "HTML";
    const cls = (el.className || "").toString().trim().split(/\s+/).filter(Boolean);
    return el.tagName + (el.id ? "#" + el.id : "") + (cls.length ? "." + cls.slice(0, 5).join(".") : "");
  };

  // أكبر فيديو مرئي: هو الذي يعنيه المستخدم في 99% من الحالات
  const pickVideo = () => {
    const fsEl = document.fullscreenElement;
    if (fsEl && fsEl.tagName === "VIDEO") return fsEl;
    let best = null, bestArea = 0;
    const scan = (root) => {
      for (const v of root.querySelectorAll("video")) {
        const r = v.getBoundingClientRect();
        const a = r.width * r.height;
        if (a > bestArea) { best = v; bestArea = a; }
      }
      for (const e of root.querySelectorAll("*")) if (e.shadowRoot) scan(e.shadowRoot);
    };
    scan(document);
    return best;
  };

  // ---- مرآة البند #58: تعريف «يملأ» + الحكم القاطع ----
  const VZ_FILL_RATIO = 0.95;
  const FS_CONTAINER_MAX_DEPTH = 8;

  const videoFillsElement = (video, el) => {
    const v = video && video.getBoundingClientRect && video.getBoundingClientRect();
    const r = el && el.getBoundingClientRect && el.getBoundingClientRect();
    if (!v || !r || r.width <= 0 || r.height <= 0) return false;
    return v.width / r.width >= VZ_FILL_RATIO && v.height / r.height >= VZ_FILL_RATIO;
  };

  const looksLikePlayer = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches && el.matches(KNOWN_PLAYER_WRAPPER_SELECTOR)) return true;
    const cls = (el.className || "").toString();
    const role = (el.getAttribute && el.getAttribute("role")) || "";
    return /player|video|controls|overlay|container/i.test(cls + " " + role);
  };

  // نطاقُ المشغّل وأدواتُه — نسخةٌ مبسّطة: المقطعُ في عالم الصفحة فلا يبلغ دوالَّنا
  const PLAYER_CONTROL_SELECTOR_LITE =
    'button,[role="button"],a[href],[role="slider"],input[type="range"],[aria-valuenow],progress';
  const playerScopeLite = (video) => {
    const known = video.closest(KNOWN_PLAYER_WRAPPER_SELECTOR);
    if (known) return known;
    let out = null, el = video.parentElement;
    for (let i = 0; i < FS_CONTAINER_MAX_DEPTH && el && el !== document.body; i++) {
      if (looksLikePlayer(el)) out = el;
      el = el.parentElement;
    }
    return out;
  };
  const scopeShowsOwnControlsLite = (scope) => {
    if (!scope) return false;
    for (const el of scope.querySelectorAll(PLAYER_CONTROL_SELECTOR_LITE)) {
      if (el.closest && el.closest(".vzWrap")) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return true;
    }
    return false;
  };

  const nearestPlayerAncestor = (video) => {
    let el = video && video.parentElement;
    for (let i = 0; i < FS_CONTAINER_MAX_DEPTH && el && el !== document.body && el !== document.documentElement; i++) {
      if (looksLikePlayer(el) && videoFillsElement(video, el)) return el;
      el = el.parentElement;
    }
    return null;
  };

  // #140 — نسخةُ الشرط الثالث. **نسخةٌ تتخلّف تطبع حاويةً لم يعد المنتَجُ يختارها**،
  // ويحرسها tools/test-fs-report-sync.js كما يحرس السكور.
  const isOwnElement = (el) => !!(el && el.closest && el.closest(".vzWrap"));
  const hostControlsLostBy = (video, container) => {
    if (!video || !container) return false;
    let el = video.parentElement;
    for (let i = 0; i < FS_CONTAINER_MAX_DEPTH && el &&
         el !== document.body && el !== document.documentElement; i++) {
      const found = el.querySelectorAll("button, [role='button'], input[type='range']");
      for (const ctrl of found) {
        if (isOwnElement(ctrl)) continue;
        if (!container.contains(ctrl)) return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  // #140ج — نسخةُ فصلِ صنفِ ضوابط المتصفّح، ويحرسها test-fs-report-sync
  const videoOwnsBrowserControls = (v) => !!v && v.controls === true &&
    !scopeShowsOwnControlsLite(playerScopeLite(v));

  const pickContainer = (video) => {
    const known = video.closest(KNOWN_PLAYER_WRAPPER_SELECTOR);
    if (known && known.requestFullscreen) return { el: known, via: "known-wrapper" };

    if (videoOwnsBrowserControls(video)) return { el: video, via: "browser-controls (#140ج)" };

    const nearest = nearestPlayerAncestor(video);
    if (nearest && nearest.requestFullscreen && !hostControlsLostBy(video, nearest)) {
      return { el: nearest, via: "nearest-player (#58)" };
    }

    const videoRect = video.getBoundingClientRect();
    const videoArea = Math.max(1, videoRect.width * videoRect.height);
    const candidates = [];
    let cur = video;
    for (let i = 0; i < 8 && cur; i++) { candidates.push(cur); cur = cur.parentElement; }

    const scored = candidates.map((el) => {
      const cls = (el.className || "").toString();
      const role = (el.getAttribute && el.getAttribute("role")) || "";
      const hasButtons = !!(el.querySelector && el.querySelector("button, [role='button'], input[type='range']"));
      const looksPlayer = /player|video|controls|overlay|container/i.test(cls + " " + role);
      const rect = el.getBoundingClientRect && el.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      const areaRatio = (rect.width * rect.height) / videoArea;
      const cx = videoRect.left + videoRect.width / 2;
      const cy = videoRect.top + videoRect.height / 2;
      if (!(rect.left <= cx && rect.right >= cx && rect.top <= cy && rect.bottom >= cy)) return null;
      if (areaRatio > 3.5) return null;
      const score = (hasButtons ? 3 : 0) + (looksPlayer ? 2 : 0) + (el === video ? 0 : 1) +
        Math.max(0, 2 - Math.abs(areaRatio - 1.15));
      return { el, score, areaRatio };
    }).filter(Boolean).sort((a, b) => b.score - a.score);

    const win = scored[0];
    return {
      el: win ? win.el : (video.parentElement || video),
      via: win ? "score" : "fallback-parent",
      margin: scored.length > 1 ? +(scored[0].score - scored[1].score).toFixed(3) : null,
      runnerUp: scored.length > 1 ? desc(scored[1].el) : null
    };
  };

  const findBtn = (video) => {
    const inScope = (scope) => {
      for (const sel of NATIVE_FS_BUTTON_SELECTORS) {
        const b = scope.querySelector(sel);
        if (b) return b;
      }
      return null;
    };
    const player = video.closest(KNOWN_PLAYER_WRAPPER_SELECTOR);
    if (player) return inScope(player);
    let node = video.parentElement;
    for (let i = 0; i < FS_BUTTON_MAX_DEPTH && node && node !== document.body; i++) {
      let other = false;
      for (const o of node.querySelectorAll("video")) {
        if (o === video) continue;
        const r = o.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) { other = true; break; }
      }
      if (other) break;
      const b = inScope(node);
      if (b) return b;
      node = node.parentElement;
    }
    return null;
  };

  const v = pickVideo();
  if (!v) { console.log("VZ58 | لا فيديو مرئي في هذه الصفحة — افتح الفيديو ثم ألصق مجدداً"); return; }

  // ⛔⭐⭐ **الحالُ تُنتَج قبل أن يُقرأ منها سطر** (قرار 22) — **وهذه ليست
  // تحسيناً بل شرطَ صحّة**: فتحُ الكونسول يُخرج الصفحةَ من ملء الشاشة على كثيرٍ
  // من الترتيبات، **فيُلصَق المِجَسُّ فيقرأ نافذةً عاديّة ويطبع أرقاماً صادقةً
  // عن لحظةٍ غيرِ التي نسأل عنها** — وهو الشكلُ الذي أوقعني مرّتين في هذا
  // الخيط (`shown:false` عن مِجَسٍّ ينتظر أطولَ من المهلة · و`null` عن سطرٍ
  // ظهر واختفى). ⇒ **فإن لم نكن داخل ملء الشاشة، ينتظر المِجَسُّ دخولَه.**
  if (!document.fullscreenElement) {
    console.log("VZ58 | لستَ داخل ملء الشاشة.\n" +
      "  ⛔ أغلِق أدواتِ المطوّر أوّلاً (⌥⌘J) — وهي ملتصقةً تأكل عرضَ الصفحة فتُقاس نافذةٌ لا شاشة.\n" +
      "  ثمّ ادخل ملءَ الشاشة بأمر الإضافة. سأطبع وحدي، وافتحِ الأدواتِ بعدها لتقرأ (مهلة 60 ثانية).");
    let done = false;
    const fire = () => {
      if (done || !document.fullscreenElement) return;
      done = true;
      document.removeEventListener("fullscreenchange", fire);
      // **بعد استقرار التخطيط لا في لحظة الحدث**: مستطيلٌ يُقرأ قبل أن يستقرّ
      // التخطيطُ رقمٌ عن حالٍ عابرة.
      setTimeout(() => { try { window.__vz58(); } catch (e) { console.log("VZ58 | تعذّر: " + e.message); } }, 700);
    };
    document.addEventListener("fullscreenchange", fire);
    setTimeout(() => {
      if (done) return;
      done = true;
      document.removeEventListener("fullscreenchange", fire);
      console.log("VZ58 | انتهت المهلة ولم تدخل ملء الشاشة — لا قياس، ولا يُطبع بديلٌ عنه.");
    }, 60000);
    return "VZ58 | في الانتظار…";
  }

  const pick = pickContainer(v);
  const c = pick.el;
  const vr = v.getBoundingClientRect();
  const cr = c.getBoundingClientRect ? c.getBoundingClientRect() : null;
  const fsEl = document.fullscreenElement;
  const inFs = !!fsEl;
  const cs = getComputedStyle(v);

  // بوابة الإصلاح المقترح: تُوضع السمة **فقط** إن كان الفيديو لا يملأ العنصر
  // المكبَّر أصلاً. المرجع هو عنصر ملء الشاشة الفعلي إن كنا داخله، وإلا الحاوية.
  const ref = inFs ? fsEl.getBoundingClientRect() : cr;
  const fillsW = ref ? vr.width >= ref.width - 2 : false;
  const fillsH = ref ? vr.height >= ref.height - 2 : false;
  const fills = fillsW || fillsH;
  const pct = ref && ref.width ? Math.round((vr.width * vr.height) / (ref.width * ref.height) * 100) : null;
  const gate = !inFs ? "غير مؤكَّد (لست داخل ملء الشاشة)" : (fills ? "ترفض — الفيديو يملأ أصلاً" : "تضيف السمة");

  const player =
    v.closest(".video-js") ? "video.js" :
    v.closest(".plyr") ? "plyr" :
    v.closest(".jw-wrapper") ? "jwplayer" :
    document.querySelector(".shaka-video-container") ? "shaka" :
    v.closest("#movie_player") ? "youtube" : "مخصّص/غير معروف";

  // ── #140د · نسخةٌ حرفيّةٌ من `videoWouldCrop` في content.js ────────────────
  // ⛔ **نسخةٌ تتخلّف هنا تطبع «لا قصّ» عن كودٍ يقصّ** — ويحرسها
  // `tools/test-fs-report-sync.js` قسم [7].
  const wouldCrop = (video) => {
    if (!video) return false;
    let fit;
    try { fit = getComputedStyle(video).objectFit; } catch { return false; }
    if (fit !== "cover" && fit !== "fill") return false;
    const r = video.getBoundingClientRect();
    const nw = Number(video.videoWidth), nh = Number(video.videoHeight);
    if (!(r.width > 0 && r.height > 0 && nw > 0 && nh > 0)) return false;
    return Math.abs((r.width / r.height) - (nw / nh)) > 0.02;
  };

  // ── أين السواد؟ — أربعُ فجواتٍ بين الفيديو وعنصرِ ملء الشاشة ───────────────
  // ⭐ **هذا هو ما يفصل الأصنافَ الثلاثة التي تُرى متشابهةً في اللقطة:**
  // سوادٌ **متماثل** حول الفيديو ⇒ نسبةٌ مختلفة، وهو صواب (قرار 149).
  // سوادٌ **أسفلَ وحدَه** ⇒ الحاوية أطولُ من المشغّل: **اختيارُ حاويةٍ خاطئ**.
  // سوادٌ **ولا وسمَ لنا** ⇒ **قاعدةُ الملء لم تُطبَّق أصلاً**، وهو غيرُ الأوّلين.
  const gaps = (() => {
    if (!fsEl || !fsEl.getBoundingClientRect) return null;
    const f = fsEl.getBoundingClientRect();
    return {
      أعلى: Math.round(vr.top - f.top), أسفل: Math.round(f.bottom - vr.bottom),
      يسار: Math.round(vr.left - f.left), يمين: Math.round(f.right - vr.right),
      fs: Math.round(f.width) + "x" + Math.round(f.height)
    };
  })();

  // ⛔⭐⭐ **«موجودٌ» ليس «هو»** — وهذا عيبٌ كان في هذا المِجَسّ نفسِه: طبعتُ
  // «حاوية✓» عن `querySelector("[data-vz-fs]")`، **وهو يقول إن عنصراً ما يحمل
  // الوسمَ لا إن عنصرَ ملء الشاشة يحمله** — ومُحدِّدُ قاعدتنا يشترط الثاني.
  // ⇒ **فيُسأل المُحدِّدُ نفسُه**: أيُطابق الفيديو قاعدتَنا الآن أم لا؟
  const RULE = "[data-vz-fs]:fullscreen video[data-vz-fs-video]";
  let matchesRule = null;
  try { matchesRule = v.matches(RULE); } catch {}
  const markedEl = document.querySelector("[data-vz-fs]");

  // ⭐ **وسلسلةُ الآباء بين الفيديو وعنصرِ ملء الشاشة، بارتفاعاتها** — لأن
  // `height:100%` **لا يَحُلّ عبر أبٍ بلا ارتفاعٍ محدَّد** (مقيسٌ: 800×501 بدل
  // 800×600)، **فأوّلُ أبٍ ارتفاعُه `auto` هو موضعُ الانقطاع.**
  const chain = (() => {
    if (!fsEl) return "—";
    const out = [];
    let n = v.parentElement, i = 0;
    while (n && n !== fsEl && i++ < 8) {
      let hs = "?";
      try { hs = getComputedStyle(n).height; } catch {}
      out.push(desc(n) + "[" + Math.round(n.getBoundingClientRect().height) + "·" + hs + "]");
      n = n.parentElement;
    }
    if (n === fsEl) out.push("⇒fsEl");
    else out.push("⛔ لم أبلغ fsEl — الفيديو ليس داخلَه");
    return out.length ? out.join(" ← ") : "(الفيديو ابنٌ مباشر)";
  })();

  const marked = {
    ورقة: !!document.getElementById("vz_fs_fill_css"),
    حاوية: !!document.querySelector("[data-vz-fs]"),
    فيديو: v.hasAttribute("data-vz-fs-video")
  };

  const line = [
    "VZ58",
    "url=" + location.href,
    "داخل ملء الشاشة=" + (inFs ? "نعم" : "لا"),
    "fsEl=" + desc(fsEl),
    "حاوية=" + desc(c),
    "طريق=" + pick.via + (pick.margin != null ? "(فارق " + pick.margin + " عن " + pick.runnerUp + ")" : ""),
    "مستطيل الحاوية=" + (cr ? Math.round(cr.width) + "x" + Math.round(cr.height) : "—"),
    "مستطيل الفيديو=" + Math.round(vr.width) + "x" + Math.round(vr.height),
    "النسبة=" + (pct == null ? "—" : pct + "%"),
    "البوابة=" + gate,
    "زر أصلي=" + desc(findBtn(v)),
    "حجم الفيديو من=" + (v.style && v.style.width ? "سطريّ" : "ورقة أنماط/تلقائي"),
    "computed=" + cs.width + "/" + cs.height + " object-fit=" + cs.objectFit,
    "مشغّل=" + player,
    "في ظلّ=" + (v.getRootNode() && v.getRootNode().host ? "نعم" : "لا"),
    // ⛔⭐⭐ **الحقلُ كان اسمُه «شاشة» وهو يقيس النافذة** — **اسمٌ أوسعُ من
    // قياسه**، وقد أضلّ فعلاً: طُبع `912x949` فقُرئ شاشةً والشاشةُ 1512x982،
    // **وأدواتُ المطوّر الملتصقةُ هي الفرق.** ⇒ **فيُسمّى ما يُقاس، ويُطبع
    // إلى جانبه ما يكشف التلوّث** — لأن مِجَسّاً لا يعرف أنه يُقاس خطأً يطبع
    // أرقاماً معقولةً عن حالٍ لم تقع.
    "نافذة=" + innerWidth + "x" + innerHeight,
    "شاشة=" + (screen.width * (devicePixelRatio >= 1 ? 1 : 1)) + "x" + screen.height +
      " (dpr " + devicePixelRatio + ")",
    "⚠️تلوّث=" + (innerWidth < screen.width - 40 || innerHeight < screen.height - 120
      ? "نعم — النافذةُ أضيقُ من الشاشة، والأرجحُ أدواتُ المطوّر ملتصقة ⇒ **لا يُبنى على أرقام العرض**"
      : "لا"),
    // ── #140د / #58ب — حالُ قاعدةِ الملء عندنا ──────────────────────────────
    "طبيعي=" + (v.videoWidth || 0) + "x" + (v.videoHeight || 0),
    "يُقصّ=" + (wouldCrop(v) ? "نعم" : "لا"),
    "وسمُنا=" + (marked.ورقة ? "ورقة✓" : "ورقة✗") + (marked.حاوية ? " حاوية✓" : " حاوية✗") +
                (marked.فيديو ? " فيديو✓" : " فيديو✗"),
    "حاملُ الوسم=" + desc(markedEl) + (markedEl && fsEl && markedEl === fsEl ? " **هو fsEl**" : " ⛔ **ليس fsEl**"),
    "يطابق قاعدتَنا=" + (matchesRule === null ? "?" : matchesRule ? "نعم" : "⛔ لا"),
    "سلسلة=" + chain,
    "سواد=" + (gaps ? `أعلى ${gaps.أعلى} أسفل ${gaps.أسفل} يسار ${gaps.يسار} يمين ${gaps.يمين} (fs ${gaps.fs})`
                    : "—"),
    "fsEl يملأ الشاشة=" + (gaps ? (gaps.fs === innerWidth + "x" + innerHeight ? "نعم" : "لا — " + gaps.fs) : "—")
  ].join(" | ");

  console.log(line);
  try { copy(line); console.log("↑ نُسخ إلى الحافظة"); } catch {}
  return line;
};
window.__vz58();
