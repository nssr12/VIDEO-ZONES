// مِجَسّ شكل عنصر المستوى عند المضيف — **يُلصق في كونسول الصفحة، ولا يُشحن.**
//
// **النسخة الثانية.** الأولى كانت **عمياء**: قالت «صفر عنصر مستوى» على كِك،
// والمنزلق **موجود ويراه المستخدم**. وأسوأ من ذلك أنها طابقت عنصراً واحداً هو
// **`.vzVolume` — شارتنا نحن**. ⇒ **مِجَسّ لم يُثبت أنه يرى لا يُنفى به وجود شيء**
// (قرار 26). فهذي النسخة:
//   · **تمشي في جذور الظل** — المشغّلات الحديثة تخبّئ شريطها فيها.
//   · **تستثني عناصر الإضافة** — بنفس منطق `isOwnElement` في `content.js`.
//   · **تبحث عن سلوك لا اسم**: عنصر **له قيمة مستوى** (`input[type=range]` أو
//     `aria-valuenow` مع مدى) أو **يقبل السحب** (مستمعو `pointerdown`/`mousedown`
//     حين يتيحهم الكونسول) — **مهما كان صنفه**.
//   · **وتُثبت أنها ترى قبل أن تنفي**: تطبع سطر «فحص البصر» على أي صفحة، وهو
//     ما شُغّل على تويتش أولاً فوجد منزلقه المعروف.
//
// **الاستعمال:**
//   ١. افتح قناة **حيّة** وانتظر بدء التشغيل.
//   ٢. **مرّر مؤشّر الفأرة فوق المشغّل** — كِك لا يُركّب شريطه إلا بتفاعل.
//   ٣. الصق السطر. يطبع سطراً فوراً وآخر بعد ست ثوانٍ — **مرّر المؤشّر خلالها**.
//   ٤. انسخ السطرين.
//
// ⚠️ تشخيصيّ محض: **لا يكتب شيئاً ولا يغيّر مستوى ولا كتماً.** قراءة فقط.
(() => {
  // نفس منطق isOwnElement في content.js — عناصرنا لا تُحسب اكتشافاً
  const isOurs = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (typeof el.closest === "function" && el.closest(".vzWrap")) return true;
    const cls = typeof el.className === "string" ? el.className : "";
    return /\bvz[A-Z]/.test(cls) || /^vz_/.test(el.id || "");
  };

  // المشي في المستند **وفي كل جذر ظل** — المشغّلات تخبّئ شريطها فيها
  const walk = () => {
    const out = [];
    const seenRoots = new Set();
    const visit = (root, depth) => {
      if (!root || seenRoots.has(root) || depth > 6) return;
      seenRoots.add(root);
      let els = [];
      try { els = [...root.querySelectorAll("*")]; } catch { return; }
      for (const el of els) {
        if (!isOurs(el)) out.push(el);
        if (el.shadowRoot) visit(el.shadowRoot, depth + 1);
      }
    };
    visit(document, 0);
    return out;
  };

  const num = (x) => (x === null || x === undefined || x === "" ? null : Number(x));
  const hasDragListener = (el) => {
    try {
      if (typeof getEventListeners !== "function") return null; // خارج الكونسول
      const l = getEventListeners(el) || {};
      return !!(l.pointerdown || l.mousedown || l.touchstart);
    } catch { return null; }
  };

  // **السلوك لا الاسم**: قيمة مستوى معلنة، أو سحب مقبول
  const classify = (el) => {
    const tag = el.tagName ? el.tagName.toLowerCase() : "?";
    if (tag === "input" && (el.type || "").toLowerCase() === "range") {
      return { kind: "input-range", value: el.value, min: el.min, max: el.max };
    }
    const now = el.getAttribute && el.getAttribute("aria-valuenow");
    if (now !== null && now !== undefined) {
      return { kind: "aria-slider", value: now,
               min: el.getAttribute("aria-valuemin"), max: el.getAttribute("aria-valuemax"),
               role: el.getAttribute("role") };
    }
    if (el.getAttribute && el.getAttribute("role") === "slider") {
      return { kind: "role-slider-بلا-قيمة", value: null, min: null, max: null };
    }
    const drag = hasDragListener(el);
    const label = ((el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title"))) || "");
    if (drag && /volume|صوت|mute/i.test(label)) {
      return { kind: "قابل-للسحب", value: null, min: null, max: null, label: label.slice(0, 20) };
    }
    return null;
  };

  // ⚠️ **قاعدة: في المِجَسّ لا يُرشَّح شيء — الترشيح قرار القارئ لا قرار الأداة.**
  // منزلق كِك مقاسه **0×0 دائماً** لأن أباه `…group-hover/volume:flex hidden` لا
  // يُعرض إلا عند تمرير المؤشّر **على مجموعة الصوت نفسها** لا على المشغّل عموماً.
  // النسخة السابقة رشّحت بالمرئيّة **فأسقطته وقالت «صفر عنصر مستوى»** — والعنصر
  // موجود ويراه المستخدم. ⇒ الصفريّ يُطبع **موسوماً «مخفي»** ومعه سبب الإخفاء.
  const hideReason = (el) => {
    let n = el, depth = 0;
    while (n && n.nodeType === 1 && depth < 8) {
      const cls = typeof n.className === "string" ? n.className : "";
      if (/\bhidden\b|group-hover|\binvisible\b/.test(cls)) {
        return `أب«${cls.trim().split(/\s+/).slice(0, 2).join(" ")}»`;
      }
      try {
        const st = getComputedStyle(n);
        if (st && (st.display === "none" || st.visibility === "hidden")) return `أب display:${st.display}/vis:${st.visibility}`;
      } catch {}
      n = n.parentElement; depth++;
    }
    return "سبب غير معلوم";
  };

  const describe = (el, c) => {
    const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    const inShadow = !!(el.getRootNode && el.getRootNode() !== document);
    const shown = r.width > 0 && r.height > 0;
    return `${c.kind}<${el.tagName.toLowerCase()}>` +
      ` val=${c.value ?? "—"} مدى=${num(c.min) ?? "—"}..${num(c.max) ?? "—"}` +
      ` ${shown ? "مرئي" : "**مخفي** " + hideReason(el)}` +
      ` ظل=${inShadow ? "نعم" : "لا"}` +
      (c.label ? ` وسم="${c.label}"` : "");
  };

  const scan = (tag) => {
    const all = walk();
    const found = [];
    for (const el of all) {
      if (found.length >= 8) break;
      const c = classify(el);
      if (c) found.push(describe(el, c));
    }
    // زرّ الكتم بالسلوك: وسمٌ يذكر الكتم — يثبت أننا نصل إلى شريط التحكّم أصلاً
    const muteBtn = all.find((el) => {
      const lab = ((el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title"))) || "");
      return /mute|كتم/i.test(lab);
    });
    const v = document.querySelector("video");
    console.log(`VZSHAPE2 ${location.host} [${tag}] عناصر=${all.length} · مستوى=${found.length}` +
      ` · زرّ كتم=${muteBtn ? "وُجد" : "لا"}` +
      ` · فحص البصر=${all.length > 50 ? "نرى الشجرة" : "⚠️ شجرة ضحلة — قد نكون عُمياً"}` +
      ` | فيديو=${v ? "rs=" + v.readyState + " vol=" + Math.round((v.volume ?? 0) * 100) + "%" + (v.muted ? " مكتوم" : "") : "لا"}` +
      ` | ${found.length ? found.join("  ||  ") : "لا عنصر مستوى"}`);
  };

  scan("قبل");
  console.log("… مرّر المؤشّر فوق المشغّل الآن — السطر الثاني بعد 6 ثوانٍ …");
  setTimeout(() => scan("بعد التمرير"), 6000);
})();
