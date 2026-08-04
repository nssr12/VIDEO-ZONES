// مِجَسّ #70 (ج) — **N: كم يعلو المضيفُ بمنطقة إبقائه فوق أعلى شريطه؟**
//
// ⛔⛔ **مقدّمتُه ساقطة — مشطوبةٌ بسببها لا محذوفةً صامتاً (قرار 21)، 2026-08-05:**
// ~~«يوتيوب نفسُه يُبقي شريطَه في منطقةٍ أوسع، فقِسها»~~ — **أُبطلت بالقياس:
// يوتيوب يُخفي بمؤقّت، ولا يحمي فوق شريطه ولا تحته، فلا هامشَ له أصلاً.**
// ⇒ **فكان السؤالُ طلبَ قياسِ شيءٍ لا وجود له** (قرار 96: خلطُ **حقيقةِ مضيفٍ
// تُقاس** بـ**قرارِ تصميمٍ يُختار**، **وقعت في بوّابةٍ وضعها المالك على نفسه**).
// ⇒ ⛔ **فلا يُعاد تشغيلُه لأجل N** — **و`N = 40` قرارُ تصميم، مكتوبٌ بحدّه في
// `content.js` عند `IDLE_NEAR_PAD_PX`.**
//
// ⭐ **وتشغيلتاه لم تضيعا، وهما سببُ بقائه:** **امتنع عن طباعة رقم في الحالين
// بشاهديه** — **فالأداةُ عملت كما صُمّمت، والفرضيّةُ هي التي سقطت.** ⇒ **ويبقى
// لسؤالٍ واحدٍ إن عاد: «أيحمي هذا المضيفُ منطقةً حول شريطه؟» — لا لاشتقاق رقمنا.**
//
// **يُلصق في كونسول صفحة watch — لا يُشحن، ويُقاس ومفتاحُ #70 عندنا مُطفأ.**
//
// ── السؤال، بحرفه (⛔ وقد سقطت مقدّمتُه أعلاه) ───────────────────────────────
// منطقةُ امتناعنا اليوم **هي مستطيل الهدف بالضبط** (`pointerInsideEl` في
// `content.js`)، و`.ytp-chrome-bottom` ارتفاعُه ~59px ⇒ **الميزة تعمل ويصعب
// استعمالها**. والعلاجُ معامِلٌ على الشرط القائم: **مستطيلُ الهدف موسَّعاً لأعلى
// بمقدار N**.
// ⛔ **وN لا يُخمَّن ولا يُؤخذ من ذوقنا** (قرار المالك): **يوتيوب نفسُه يمتنع عن
// إخفاء شريطه في منطقةٍ أوسع من الشريط** — فالمقيس هو **أين يجب أن يقع المؤشّر
// ليمتنع المضيف**، وذاك هو N مشتقّاً من سلوك المضيف لا من يدنا.
// **وهو درسُ نوافذ `1500` مقابل `3000`: رقمٌ مكتوبٌ بيدٍ يتباعد عن الواقع.**
//
// ── ⛔ شرطُ الإبطال — **يُقرأ قبل أي رقم يخرج من هنا** ───────────────────────
// **لا يُنشر N، ولا تُقرأ عيّنةٌ واحدة، إن وقعت أيٌّ من هذي:**
//  ١) **ورقتُنا في الصفحة** (`#vz_idle_progress_css` أو الصنف
//     `vz-idle-hide-progress` في أي عيّنة) ⇒ **نقيس أنفسنا لا المضيف** (قرار 48:
//     حين يفعل المضيفُ ما نفعله، يُقاس سببُنا لا الأثر). **والمِجَسّ يفحص ولا
//     يثق بأن المفتاح مُطفأ.**
//  ٢) **الشاهد الموجب لم يقع:** عيّنةٌ والمؤشّر **داخل الشريط** (Δ ≤ 0) ظلّ فيها
//     الشريطُ ظاهراً. بغيرها **لا يُعرف أن المِجَسّ يرى «امتناعاً» أصلاً**.
//  ٣) **الشاهد السالب لم يقع:** عيّنةٌ بعيدة (Δ ≥ 250px) **اختفى** فيها الشريط.
//     بغيرها **لا يُعرف أن المِجَسّ يستطيع أن يُحمّر** — و«لا يوجد» و«لا أرى»
//     يطبعان الرقم نفسه (قرار 26، الشاهد الأول).
//  ٤) **تناقضٌ في الترتيب:** Δ اختفى عندها **أصغرُ** من Δ ظلّ ظاهراً عندها ⇒
//     **متغيّرٌ آخر غير مضبوط** — يُعاد القياس ولا يُنشر رقم.
// ⇒ **وفي الأربع يمتنع المِجَسّ عن طباعة N أصلاً، لا أن يطبعه ويحذّر منه** —
// **امتناعٌ مُعلَنٌ لا يُلزم الكودَ الذي يليه هو عطب #104 بعينه.**
//
// ── وما يُسقط العيّنةَ وحدها (لا القياسَ كلَّه) ──────────────────────────────
// **حالاتٌ يُبقي فيها المضيفُ شريطَه لسببٍ غير المؤشّر** — مقيسةٌ عندنا في
// القسم الرابع عشر، **فلا تُقرأ إبقاءً بالقرب**: قائمةُ الإعدادات مفتوحة
// (`ytp-settings-shown`) · سحبُ الشريط (`seeking-mode`) · تركيزُ لوحة المفاتيح
// (`ytp-probably-keyboard-focus`) · ومستطيلٌ صفريّ (قرار 22).
// ⚠️ **والتوقّف ليس منها:** مقيسٌ أن يوتيوب **يُخفي وهو متوقّف** (الحالة 3،
// 2026-08-02) — فلا يُسقَط، **ويُطبع `paused` في كل عيّنة** كي يُرى الخلط لو وقع.
//
// ── الاستعمال ────────────────────────────────────────────────────────────────
//   ٠) **أطفئ مفتاح «إخفاء شريط تحكّم يوتيوب»** في صفحة الإعدادات، ثمّ
//      **أعِد تحميل صفحة watch** (الورقة تبقى بعد الإطفاء).
//   ١) شغّل فيديو watch، والصق هذا الملفّ مرّة.
//   ٢) `VZ70R.ladder()` — يطبع سُلّم ارتفاعاتٍ **بإحداثيات شاشتك الآن**.
//   ٣) ضع المؤشّر عند ارتفاعٍ من السُّلّم **واتركه ساكناً** حتى تسمع الصفير:
//      **صفيرٌ واحد = ظلّ ظاهراً (امتناع)** · **صفيران = اختفى**.
//      وكرّر صاعداً: داخل الشريط · 0 · 10 · 20 · 40 · 60 · 90 · 130 · 300.
//   ٤) `VZ70R.report()` — سطرٌ واحد قابل للنسخ + جدولُ العيّنات + الحكم.
//
// ⚠️ **والمؤشّرُ الحقيقيّ وحده يُحرّك هذا المِجَسّ** — لا حدثَ نصنعه: حدثٌ
// مصنوع يُنتج الحالَ ثمّ يقيسها (قرار 22)، **وامتناعُ المضيف قد لا يستجيب له
// أصلاً فيُطبع صفرٌ كاذب**. ولذلك خطواتُك أنت هي القياس.
(() => {
  const MARK = "VZ70-REGION";
  const BAR = ".ytp-chrome-bottom";      // الهدف نفسُه في `content.js` — لا اسم ثانٍ
  const MOVE_EPS = 2;                    // حركةٌ دون بكسلين ليست حركة (مصيدة المحرّك ١)
  const SETTLE_MS = 400;                 // سكونٌ يبدأ عنده شبّاك المراقبة
  const WATCH_MS = 5000;                 // ⭐ مشتقٌّ لا مخترَع: أطولُ مهلةِ إخفاءٍ
                                         // مقيسةٍ للمضيف 3000ms (القسم 14، متتالية
                                         // الخروج) ⇒ 1.6×. **وزمنُ الاختفاء يُطبع
                                         // في كل عيّنة**، فمن رآه يقارب 5000 يعرف
                                         // أن النافذة ضاقت — ولا يُقرأ الحدّ ظنّاً.
  const FAR = 250;                       // شاهدُ السالب: بعيدٌ عن الشريط بالتأكيد
  const TICK = 100;                      // معدّل قراءة الحال داخل الشبّاك

  const samples = [];
  let last = { x: null, y: null }, settleT = null, watch = null;

  const clsOf = (el) => String(el?.className?.baseVal ?? el?.className ?? "");
  const el = (s) => { try { return document.querySelector(s); } catch { return null; } };

  // «مرئي» بتعريف `probe-70-state.js` حرفاً — لا تعريف ثانٍ يتباعد
  const seen = (node) => {
    if (!node) return { vis: false, why: "غائب", h: 0 };
    const b = node.getBoundingClientRect();
    let n = node, op = 1;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display === "none") return { vis: false, why: "display:none", h: Math.round(b.height) };
      if (cs.visibility === "hidden") return { vis: false, why: "visibility:hidden", h: Math.round(b.height) };
      op *= parseFloat(cs.opacity);
      n = n.parentElement;
    }
    if (!(op > 0)) return { vis: false, why: "opacity:0", h: Math.round(b.height), op };
    if (b.width <= 0 || b.height <= 0) return { vis: false, why: "مستطيل صفريّ", h: 0, op };
    return { vis: true, why: "", h: Math.round(b.height), op: Number(op.toFixed(3)) };
  };

  // ⛔ ورقتُنا في الصفحة ⇒ القياس عن أنفسنا. **يُفحص، ولا يوثق بأن المفتاح مُطفأ.**
  const oursActive = () =>
    !!document.getElementById("vz_idle_progress_css") ||
    document.documentElement.classList.contains("vz-idle-hide-progress");

  const beep = (n = 1) => {
    try {
      const c = new AudioContext();
      for (let i = 0; i < n; i++) {
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.value = i ? 520 : 880; g.gain.value = 0.05;
        o.connect(g); g.connect(c.destination);
        o.start(c.currentTime + i * 0.18); o.stop(c.currentTime + i * 0.18 + 0.11);
      }
      setTimeout(() => c.close(), 600);
    } catch {}
  };

  const readState = () => {
    const P = el("#movie_player"), V = el("video"), B = el(BAR);
    if (!P || !V || !B) return null;
    const r = B.getBoundingClientRect();
    const pc = clsOf(P);
    return {
      barTop: r.top, barBottom: r.bottom, barH: Math.round(r.height),
      zeroRect: !(r.width > 0 && r.height > 0),
      vis: seen(B).vis,
      paused: V.paused,
      fs: !!document.fullscreenElement,
      menuOpen: [...document.querySelectorAll(".ytp-popup")].some((p) => seen(p).vis) ||
                / ytp-settings-shown(\s|$)/.test(" " + pc),
      seeking: /(^|\s)seeking-mode(\s|$)/.test(pc),
      kbFocus: /(^|\s)ytp-probably-keyboard-focus(\s|$)/.test(pc),
      // ⚠️ **إشارةُ مضيفٍ ثانية تُطبع ولا يُبنى عليها الحكم**: صنفُ تحويم شريط
      // التقدّم شيءٌ، وامتناعُ الإخفاء شيءٌ آخر — **ومطابقةٌ أوسع من سؤالها هي
      // ما لُدغنا منه في #92** (قرار 93). فهو عمودٌ للقارئ لا مُدخَلٌ في N.
      hoverCls: /(^|\s)ytp-progress-bar-hover(\s|$)/.test(pc),
      inPlayer: (() => {
        const pr = P.getBoundingClientRect();
        return last.x >= pr.left && last.x <= pr.right && last.y >= pr.top && last.y <= pr.bottom;
      })()
    };
  };

  const startWatch = () => {
    const s0 = readState();
    if (!s0) { console.log(`${MARK} ⛔ لا مشغّل/فيديو/شريط — لا عيّنة`); return; }
    if (s0.zeroRect) { console.log(`${MARK} ⛔ مستطيلٌ صفريّ — لا عيّنة (قرار 22)`); return; }

    const dy = Math.round(s0.barTop - last.y);   // موجب = فوق أعلى الشريط · سالب = داخله
    const x = last.x, y = last.y, t0 = performance.now();
    let hidAt = null, dropped = null, ours = oursActive();

    console.log(`${MARK} ⏳ عيّنة عند Δ=${dy}px (y=${Math.round(y)}) — لا تحرّك الفأرة ${WATCH_MS / 1000}ث…`);

    const iv = setInterval(() => {
      const s = readState();
      if (!s) return;
      if (oursActive()) ours = true;
      if (s.menuOpen) dropped = dropped || "قائمة مفتوحة";
      if (s.seeking) dropped = dropped || "سحب الشريط";
      if (s.kbFocus) dropped = dropped || "تركيز لوحة مفاتيح";
      if (!s.vis && hidAt === null) hidAt = Math.round(performance.now() - t0);
    }, TICK);

    watch = {
      cancel: () => { clearInterval(iv); clearTimeout(watch.t); watch = null;
        console.log(`${MARK} ↩︎ أُلغيت العيّنة — تحرّكت الفأرة قبل انتهاء الشبّاك`); },
      t: setTimeout(() => {
        clearInterval(iv);
        watch = null;
        const s = readState() || s0;
        const rec = {
          dy, x: Math.round(x), y: Math.round(y),
          barTop: Math.round(s0.barTop), barH: s0.barH,
          hid: hidAt !== null, hidAtMs: hidAt,
          fs: s.fs, paused: s.paused, inPlayer: s.inPlayer, hoverCls: s.hoverCls,
          ours, dropped
        };
        samples.push(rec);
        beep(rec.hid ? 2 : 1);
        console.log(`${MARK} ${rec.hid ? "❌ اختفى" : "✅ ظلّ ظاهراً"} · Δ=${dy}px` +
          (rec.hid ? ` · بعد ${hidAt}ms` : "") +
          ` · ${s.fs ? "ملء شاشة" : "نافذة"}${rec.dropped ? ` · ⛔ ساقطة: ${rec.dropped}` : ""}` +
          `${rec.ours ? " · ⛔ ورقتُنا حاضرة" : ""}`);
      }, WATCH_MS)
    };
  };

  window.addEventListener("mousemove", (e) => {
    if (!e.isTrusted) return;                       // مؤشّرٌ حقيقيّ وحده
    const dx = Math.abs((last.x ?? e.clientX) - e.clientX);
    const dy = Math.abs((last.y ?? e.clientY) - e.clientY);
    last = { x: e.clientX, y: e.clientY };
    if (dx < MOVE_EPS && dy < MOVE_EPS) return;     // «حركةٌ بلا حركة» ليست حركة
    if (watch) watch.cancel();
    clearTimeout(settleT);
    settleT = setTimeout(startWatch, SETTLE_MS);
  }, true);

  const VZ70R = {};

  VZ70R.ladder = () => {
    const s = readState();
    if (!s) { console.log(`${MARK} ⛔ لا مشغّل — شغّل فيديو watch أوّلاً`); return; }
    const rows = [-Math.round(s.barH / 2), 0, 10, 20, 40, 60, 90, 130, 300]
      .map((d) => ({ "Δ فوق أعلى الشريط": d, "y على الشاشة": Math.round(s.barTop - d) }));
    console.log(`${MARK} سُلّم الارتفاعات — أعلى الشريط الآن y=${Math.round(s.barTop)} · ارتفاعه ${s.barH}px`);
    console.table(rows);
    console.log(`${MARK} ⚠️ والسالبُ الأول **داخل الشريط** وهو الشاهد الموجب، والأخير (300) الشاهد السالب — لا يُتركان.`);
  };

  const verdict = () => {
    const bad = samples.filter((s) => s.ours).length;
    const valid = samples.filter((s) => !s.ours && !s.dropped);
    const out = { v: 1, url: location.href.slice(0, 120), n: samples.length, valid: valid.length, samples };

    if (bad) return { ...out, ok: false, why: `ورقتُنا حاضرة في ${bad} عيّنة — القياسُ عن أنفسنا لا عن المضيف` };
    if (!valid.length) return { ...out, ok: false, why: "لا عيّنة صالحة" };

    // **الحكمُ لكلّ حالِ عرضٍ وحدها** — النافذة وملء الشاشة بنيتان مختلفتان،
    // ودمجُهما يُنتج رقماً لا يصف أيّاً منهما (قرار 42: عَرَضٌ واحد لا يدلّ على سببٍ واحد).
    const groups = {};
    for (const s of valid) (groups[s.fs ? "ملء شاشة" : "نافذة"] ||= []).push(s);

    const per = {};
    for (const [g, list] of Object.entries(groups)) {
      const kept = list.filter((s) => !s.hid).map((s) => s.dy);
      const hid = list.filter((s) => s.hid).map((s) => s.dy);
      const posW = list.some((s) => s.dy <= 0 && !s.hid);        // شاهد 26 الموجب
      const negW = list.some((s) => s.dy >= FAR && s.hid);       // شاهد 26 السالب
      const keptMax = kept.length ? Math.max(...kept) : null;
      const hidMin = hid.length ? Math.min(...hid) : null;
      if (!posW || !negW) {
        per[g] = { ok: false, why: `شاهدا قرار 26 لم يكتملا (موجب:${posW ? "✅" : "❌"} · سالب:${negW ? "✅" : "❌"})`,
                   keptMax, hidMin, n: list.length };
        continue;
      }
      if (keptMax !== null && hidMin !== null && hidMin <= keptMax) {
        per[g] = { ok: false, why: `تناقضُ ترتيب: اختفى عند Δ=${hidMin} وظلّ عند Δ=${keptMax} ⇒ متغيّرٌ غير مضبوط`,
                   keptMax, hidMin, n: list.length };
        continue;
      }
      // **N = أكبرُ ارتفاعٍ امتنع عنده المضيفُ فعلاً** — لا منتصفَ المجال ولا
      // تقريباً لأعلى: **ما قِيس وحده**، والفجوةُ تُطبع فتُقرأ دقّةُ الرقم معه.
      per[g] = { ok: true, N: keptMax, upper: hidMin, resolution: hidMin - keptMax, n: list.length };
    }
    const anyOk = Object.values(per).some((p) => p.ok);
    return { ...out, ok: anyOk, per };
  };

  VZ70R.report = () => {
    if (!samples.length) { console.log(`${MARK} لا عيّنات بعد`); return; }
    const v = verdict();
    console.table(samples.map((s) => ({
      "Δ": s.dy, "ظلّ ظاهراً": s.hid ? "❌ اختفى" : "✅ نعم", "بعد ms": s.hidAtMs ?? "-",
      "عرض": s.fs ? "ملء" : "نافذة", "متوقّف": s.paused ? "نعم" : "-",
      "داخل المشغّل": s.inPlayer ? "نعم" : "لا", "hover": s.hoverCls ? "نعم" : "-",
      "ساقطة": s.dropped || (s.ours ? "ورقتُنا" : "-")
    })));

    // ⛔ **الامتناعُ يُلزم ما بعده — لا سطرَ حكمٍ بعد إعلان البطلان** (#104)
    if (!v.ok) {
      console.log(`${MARK} ⇒ **القياس غير صالح — لا يُبنى عليه N ولا بند**` +
        (v.why ? ` · ${v.why}` : "") +
        (v.per ? " · " + Object.entries(v.per).map(([g, p]) => `${g}: ${p.why}`).join(" · ") : ""));
      console.log(`${MARK} ${JSON.stringify(v)}`);
      return "غير صالح";
    }

    for (const [g, p] of Object.entries(v.per)) {
      if (!p.ok) { console.log(`${MARK} [${g}] ⛔ لا رقم — ${p.why}`); continue; }
      console.log(`${MARK} [${g}] ⭐ **N = ${p.N}px** فوق أعلى الشريط · ` +
        `امتنع المضيفُ إلى ${p.N} واختفى عند ${p.upper} ⇒ **الدقّة ±${p.resolution}px** · ${p.n} عيّنة صالحة`);
    }
    console.log(`${MARK} ${JSON.stringify(v)}`);
    console.log(`${MARK} ↑ **انسخ هذا السطر كاملاً** — وهو ما يُنسب إليه أي رقم يُكتب في السجلّ.`);
    return "تمّ";
  };

  VZ70R.reset = () => { samples.length = 0; console.log(`${MARK} صُفِّرت العيّنات`); };
  window.VZ70R = VZ70R;

  console.log(`${MARK} جاهز — والمؤشّرُ الحقيقيّ وحده يقيس.` +
    (oursActive() ? "\n⛔ **ورقتُنا حاضرة في الصفحة الآن** — أطفئ مفتاح #70 وأعِد التحميل، وإلا فالقياسُ عنّا لا عن المضيف."
                  : "\n✅ ورقتُنا غائبة — القياسُ عن المضيف.") +
    `\n  السُّلّم:  VZ70R.ladder()\n  والتقرير: VZ70R.report()\n  ⚠️ صفيرٌ واحد = ظلّ ظاهراً · صفيران = اختفى`);
})();
