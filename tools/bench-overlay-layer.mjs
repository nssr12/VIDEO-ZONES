// طبقتنا داخل المشغّل — **هل تعمل لمستخدمٍ حقيقيّ؟** فحصٌ في متصفّحٍ حقيقيّ.
//
// ⛔ **من الثمانية — يُشغَّل قبل كل كومِت.** ويحرس: **#72 · #85 · #94 · #95 · #70** — طبقتُنا داخل المشغّل: الزرّ يُرسم ويستجيب ويختفي بالسكون ويتبع مستطيل المشغّل.
//
// ⛔ **العلّة التي وُلد منها (قرار المالك 2026-08-03، من جلسة §17):**
// **1808 تأكيداً خضراء · وزرٌّ لا يستقبل نقرة · وحقلٌ لا يُحفظ.** وهي **المرّة
// الثالثة** — بعد صفحة الإعدادات الميتة (#77) — التي يكون فيها الأخضر كاملاً
// والمنتَج لا يعمل.
// ⇒ **والدرس ليس «اكتب تأكيداً أكثر» بل أن مستوى الاختبار في الموضع الخطأ:**
// نختبر الوحدات ولا نختبر **ما يستعمله المستخدم**. وقد نجح `bench-options-page`
// لصفحة الإعدادات، **وهذا نظيرُه للطبقة**.
//
// ⚠️ **وهذا شرطُ قبولٍ لأيّ ميزةٍ في الطبقة من الآن** (قرار المالك)، كما صار فحص
// التحميل شرطاً لصفحة الإعدادات.
//
// ── ⭐ المصيدة التي كانت ستُبطل الرِكاز كلَّه — تُقرأ قبل الكود ────────────────
// **محرّك السكون يرفض الحدث المصطنع صراحةً**: `content.js:1856`
// `if (e.isTrusted === false) return;` — و`markIdleActivity` لا تُنادى إلا منه.
// ⇒ **فرِكازٌ يُرسل `new MouseEvent(...)` من الصفحة كان سيطبع «الزرّ لا يظهر»
// في كلّ حال**، على بناءٍ سليمٍ وعلى بناءٍ معطوب سواءً — **عمى أداةٍ يُقرأ عطبَ
// منتَج**، وهو النوع الرابع من العمى بعينه.
// ⇒ **فكلّ إدخالٍ هنا موثوقٌ عبر `Input.dispatchMouseEvent`.**
//
// **وثانيةٌ معها، وهي جوهر الفرضيّة (١):** الحدث يُرسَل **بإحداثيّات** لا على
// العنصر. فـ`el.dispatchEvent(new MouseEvent("click"))` **يتخطّى اختبار الإصابة
// كلَّه** — أي يتخطّى بالضبط ما نشكّ فيه. **فالنقرة تُصيب موضعاً، ومن يلتقطها هو
// الجواب.**
//
// ── شاهدا القبول (قرار 26) ──────────────────────────────────────────────────
//  · **موجب:** الإضافة محمَّلة والمفتاح مُشغَّل ⇒ **الزرّ موجودٌ ومرئيّ** بعد
//    حركةٍ موثوقة. لا يراه ⇒ الرِكاز أعمى ولا يُبنى على خرْجه.
//  · **سالب:** **بلا إضافةٍ أصلاً** ⇒ لا `.vzSpeedBtn` بتاتاً.
//    ⚠️ **والسالب «بلا إضافة» لا «بالمفتاح مطفأ» عمداً:** المالك يُبلّغ أن
//    المفتاح لا يُزيل الزرّ، **فجعلُ ذلك شاهداً يخلط عطبَ المنتَج بعمى الأداة**.
//    فالمفتاح المطفأ **قياسٌ** (م7) لا شاهد.
//
//   node tools/bench-overlay-layer.mjs
//   node tools/bench-overlay-layer.mjs --youtube    # ويضيف تشغيلةً على المضيف الحقيقيّ
//   node tools/bench-overlay-layer.mjs --json       # الخام (قرار 38)
import fs from "node:fs";
import path from "node:path";
import { launch, openPage, configure, serveTestPage, contentWorld, evalIn, waitPortFree, ROOT } from "./ext-harness.mjs";

const PORT = 9761, HTTP = 8861;
const WANT_YT = process.argv.includes("--youtube");
const AS_JSON = process.argv.includes("--json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const IDLE_MS = 1000;          // مهلة سكونٍ قصيرة كي لا يطول الفحص — ولا تقلّ عن IDLE_MIN_MS
const PRESET = 2;              // «سرعة نقرة الزرّ»

// ── إعدادات القياس: مفتاح الزرّ مُشغَّل، والمربّع 4 على السرعة (لقياس م8) ─────
const SETTINGS = {
  settings: {
    enabled: true,
    idle: { ms: IDLE_MS },
    overlay: {
      autoHideMs: 900, volumeAutoHideMs: 900, enabled: true, hintEnabled: true,
      speedBadge: false, hideProgressBar: false,
      speedButton: true, speedButtonPreset: PRESET
    },
    zones: {
      enabled: true, fullscreenOnly: false,
      wheel: { map: { "4": { up: ["ACTION:SPEED:+0.25"], down: ["ACTION:SPEED:-0.25"] } } }
    }
  },
  globalSiteRules: { enabled: true, mappings: [] }
};

// ── الرؤية تُشتقّ من الشرط المقيس ولا تسبقه (العمى الأوّل، `S7`) ─────────────
// «مرئيّ» ليس «مستطيلاً غير صفريّ»: عنصرٌ بشفافية صفر طُبع «مرئياً 1081×40».
const VISIBLE_FN = `(el) => {
  if (!el) return { exists: false };
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  return {
    exists: true,
    hiddenClass: el.classList.contains("vzHidden"),
    display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
    pointerEvents: cs.pointerEvents,
    w: Math.round(r.width), h: Math.round(r.height),
    x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
    text: (el.textContent || "").trim().slice(0, 12),
    visible: cs.display !== "none" && cs.visibility !== "hidden" &&
             Number(cs.opacity) > 0 && r.width > 0 && r.height > 0
  };
}`;

const BTN_STATE = `(() => {
  const vis = ${VISIBLE_FN};
  // ⚠️ **الشفافية الفعّالة عبر السلاسل** — قِيس أن ابناً في شريط المضيف يقرأ
  // \u0060opacity:1\u0060 بينما سلفُه \u00600\u0060: **فالرؤية على السلسلة لا على العنصر** (قرار 48).
  const eff = (el) => { let o = 1, n = el;
    while (n && n.nodeType === 1) { o *= Number(getComputedStyle(n).opacity); n = n.parentElement; }
    return Math.round(o * 1000) / 1000; };
  const btn = document.querySelector(".vzSpeedBtn");
  const wrap = document.querySelector(".vzWrap");
  const v = document.querySelector("video");
  const b = vis(btn);
  let hit = null;
  if (b.exists && b.visible) {
    const el = document.elementFromPoint(b.x, b.y);
    hit = el ? (el.className && typeof el.className === "string"
                 ? el.tagName + "." + el.className.trim().split(/\\s+/).join(".")
                 : el.tagName) : null;
  }
  const inBar = !!(btn && btn.closest(".ytp-right-controls"));
  return {
    btn: b,
    inBar,
    hostSlot: !!document.querySelector(".ytp-right-controls"),
    effOpacity: btn ? eff(btn) : null,
    wrapPointerEvents: wrap ? getComputedStyle(wrap).pointerEvents : null,
    wrapExists: !!wrap,
    hitAtBtnCenter: hit,
    rate: v ? v.playbackRate : null,
    videoRect: v ? (() => { const r = v.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })() : null
  };
})()`;

// ── إدخالٌ موثوق — وهو الفرق بين قياسٍ ووهم ─────────────────────────────────
async function move(c, x, y) {
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
}
async function click(c, x, y) {
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await sleep(30);
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
}
async function wheel(c, x, y, deltaY) {
  await c.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY });
}
// حركةٌ صغيرة متّصلة: الحركة الواحدة قد تُخنق (IDLE_MOVE_THROTTLE_MS)، والسكون
// يُقاس من **آخر** نشاط — فتُدار عدّة حركات كما يفعل إنسان.
async function wiggle(c, x, y, n = 4) {
  for (let i = 0; i < n; i++) { await move(c, x + (i % 2), y + ((i + 1) % 2)); await sleep(120); }
}

async function runOn(label, url, { withExtension = true } = {}) {
  const out = { label, url, steps: {} };
  let h = null, page = null;
  try {
    h = await launch(PORT, { withExtension });
    out.chrome = h.chrome;
    out.extensionId = h.extensionId;
    if (h.extensionId) {
      const cfg = await configure(PORT, h.extensionId, SETTINGS);
      out.configured = cfg.ok;
      if (!cfg.ok) { out.why = "تعذّر ضبط التخزين: " + (cfg.why || cfg.error); return out; }
    }
    page = await openPage(PORT, url);
    await sleep(withExtension ? 3000 : 1500);

    out.world = withExtension ? await contentWorld(page) : null;

    // موضع الفيديو أوّلاً — ومستطيلٌ صفريّ لا يُقاس (قرار 22)
    const v0 = await evalIn(page, BTN_STATE);
    out.steps.before = v0;
    if (!v0?.videoRect || v0.videoRect.w <= 0) { out.why = "لا فيديو بمستطيلٍ غير صفريّ"; return out; }
    const vr = v0.videoRect;
    const zone4 = { x: Math.round(vr.x + vr.w / 6), y: Math.round(vr.y + vr.h / 2) };

    // ── م1: حركةٌ موثوقة فوق المشغّل — **بلا نقرة إطلاقاً** (الخطوة 10) ──────
    await wiggle(page, Math.round(vr.x + vr.w / 2), Math.round(vr.y + vr.h * 0.8));
    await sleep(400);
    out.steps.afterMove = await evalIn(page, BTN_STATE);

    if (!withExtension) return out;   // الشاهد السالب يقف هنا

    const b = out.steps.afterMove?.btn;
    if (b?.exists && b.visible) {
      // ── م4: نقرةٌ موثوقة **بالإحداثيّات** على مركز الزرّ (الخطوة 15) ───────
      const before = out.steps.afterMove.rate;
      await click(page, b.x, b.y);
      await sleep(500);
      const afterClick = await evalIn(page, BTN_STATE);
      out.steps.click = { before, after: afterClick.rate, label: afterClick.btn.text,
                          changed: afterClick.rate !== before };

      // ── م5: عجلةٌ موثوقة فوق الزرّ (الخطوة 14) ────────────────────────────
      await wiggle(page, b.x, b.y, 2);
      const beforeW = (await evalIn(page, BTN_STATE)).rate;
      await wheel(page, b.x, b.y, -120);
      await sleep(500);
      const afterWheel = await evalIn(page, BTN_STATE);
      out.steps.wheelOnBtn = { before: beforeW, after: afterWheel.rate, label: afterWheel.btn.text,
                               changed: afterWheel.rate !== beforeW };
    } else {
      out.steps.click = { skipped: "الزرّ غير مرئيّ — لا موضع تُصيبه نقرة" };
      out.steps.wheelOnBtn = { skipped: "الزرّ غير مرئيّ" };
    }

    // ── م9 (12ب): **سكونٌ تامّ والمؤشّر فوق الزرّ ⇒ لا يختفي من تحت اليد** ──
    // **المبدأ نفسه المطبَّق مرّتين في #70**، وثالثتُه هنا. **ويُقاس آلياً**:
    // نُوقف الإدخال والمؤشّر على مركز الزرّ، وننتظر أطول من المهلة.
    if (b?.exists && b.visible) {
      await wiggle(page, b.x, b.y, 2);          // نُدخله ونثبته
      await sleep(IDLE_MS * 3);                 // **بلا أي إدخال بعدها**
      out.steps.stillOverBtn = await evalIn(page, BTN_STATE);
    }

    // ── م10 (م17): **الطبقة تتبع مستطيل المشغّل حين يتغيّر** ────────────────
    // ⚠️ **وشاهدٌ موجب شرطٌ لا تفصيل:** قياسٌ أوّل غيّر **إطار العرض** ولم يتغيّر
    // **المستطيل المتبوع**، فقرأ «الزرّ لم يتبع» — **سكونٌ لا سكون فيه**.
    // ⇒ **يُزاح الفيديو نفسه، ويُتحقَّق أنه أُزيح، قبل الحكم على التتبّع.**
    if (b?.exists && b.visible) {
      const beforeMove = await evalIn(page, BTN_STATE);
      await evalIn(page, `document.querySelector("video").style.marginInlineStart = "120px"`);
      await sleep(700);
      await wiggle(page, b.x + 120, b.y, 3);
      await sleep(400);
      const afterMove = await evalIn(page, BTN_STATE);
      out.steps.follows = { beforeVid: beforeMove?.videoRect, afterVid: afterMove?.videoRect,
        beforeBtn: [beforeMove?.btn?.x, beforeMove?.btn?.y], afterBtn: [afterMove?.btn?.x, afterMove?.btn?.y] };
      await evalIn(page, `document.querySelector("video").style.marginInlineStart = ""`);
      await sleep(500);
    }

    // ── م8: عجلةٌ على المربّع 4 (لا على الزرّ) ⇒ السرعة والوسم يتبعان (13) ──
    await wiggle(page, zone4.x, zone4.y, 2);
    const beforeZ = (await evalIn(page, BTN_STATE)).rate;
    await wheel(page, zone4.x, zone4.y, -120);
    await sleep(600);
    const afterZ = await evalIn(page, BTN_STATE);
    out.steps.zoneWheel = { before: beforeZ, after: afterZ.rate, changed: afterZ.rate !== beforeZ,
                            label: afterZ.btn.text,
                            labelFollows: afterZ.btn.exists && afterZ.btn.text === `${afterZ.rate}x` };

    // ── م6: السكون — **بلا أي إدخال** أطول من المهلة (الخطوة 11) ────────────
    await sleep(IDLE_MS * 3);
    out.steps.idle = await evalIn(page, BTN_STATE);

    // ── م7: إطفاء المفتاح ⇒ هل يزول؟ (الخطوة 8 في أختها، وشكوى المالك) ──────
    await configure(PORT, h.extensionId, {
      settings: { ...SETTINGS.settings,
        overlay: { ...SETTINGS.settings.overlay, speedButton: false } }
    });
    await sleep(1200);
    await wiggle(page, Math.round(vr.x + vr.w / 2), Math.round(vr.y + vr.h * 0.8), 2);
    await sleep(600);
    out.steps.switchedOff = await evalIn(page, BTN_STATE);

    // ── #70 على المضيف الحقيقيّ — **النصف الثاني من شرط القبول** ────────────
    // **«يُستعاد شريط المضيف ويزول زرّنا» شرطٌ واحد بنصفين** (قرار المالك):
    // فالمستهلكان يختلفان في معنى الإطفاء، **وقياسُ أحدهما لا يقول شيئاً عن
    // الآخر** — بل النجاح في أحدهما مع الفشل في الآخر هو **العطب بعينه**.
    if (/youtube\.com/.test(url)) {
      const BAR = `(() => {
        const el = document.querySelector(".ytp-chrome-bottom");
        if (!el) return { exists: false };
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        // ⚠️ **«مخفيّ» لا يفرّق بين إخفائنا وإخفاء المضيف** — ويوتيوب يُخفي
        // شريطه بنفسه بعد ~3 ثوانٍ سكون. **فالمقيس صنفُنا نحن**، والشفافية
        // خبرٌ تابع. (عائلة العمى الأولى: الوصف يُشتقّ من الشرط المقيس.)
        return { exists: true, opacity: Number(cs.opacity),
                 w: Math.round(r.width), h: Math.round(r.height),
                 x: Math.round(r.left), y: Math.round(r.top),
                 // #97 — **موضعُ المؤشّر من الشريط يُنشر مع الرقم**: #95 يمنع
                 // الإخفاء تحت المؤشّر **بحقّ**، فبلا هذا يُقرأ سلوكٌ صحيح فشلاً.
                 ourClass: document.documentElement.classList.contains("vz-idle-hide-progress"),
                 hidden: Number(cs.opacity) === 0 };
      })()`;
      await configure(PORT, h.extensionId, {
        settings: { ...SETTINGS.settings,
          overlay: { ...SETTINGS.settings.overlay, hideProgressBar: true, speedButton: false } }
      });
      await sleep(1200);
      // ── #97 — **المنصّة تُنتج حالها وتتحقّق منها** (قرار 22) ────────────────
      // ⛔ **العلّة مقيسة:** كان التحويم على **80% من ارتفاع الفيديو**، فوقع
      // **داخل `.ytp-chrome-bottom`** (مؤشّر `371,297` وشريط `12,297 717×59`)
      // — **و#95 يمنع الإخفاء تحت المؤشّر بحقّ**، فكان القسم **يقرأ سلوكاً
      // صحيحاً فشلاً**، ويتبدّل بتبدّل التخطيط. ⇒ **يُحوَّم فوق الصورة، ويُتحقَّق
      // أن الموضع خارج الشريط قبل أن يُقاس عليه شيء.**
      let px = Math.round(vr.x + vr.w / 2), py = Math.round(vr.y + vr.h * 0.45);
      for (let k = 0; k < 4; k++) {
        await wiggle(page, px, py, 2);
        await sleep(250);
        const b = await evalIn(page, BAR);
        const inside = !!(b?.exists && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
        if (!inside) break;
        py = Math.round(b.y - 30 - k * 20);      // ارفعه فوق الشريط ثمّ تحقّق ثانيةً
      }
      await wiggle(page, px, py, 3);
      await sleep(400);
      const SNAP = `typeof vzIdleSnapshot === "function" ? vzIdleSnapshot() : null`;
      const barActive = await evalIn(page, BAR);
      // ⚠️ **المُخبِر في عالم الإضافة لا في عالم الصفحة** — فيُقرأ بسياقه (#86)
      barActive.snap = await evalIn(page, SNAP, out.world?.id);
      await sleep(IDLE_MS * 3);                       // سكون — بلا أي إدخال
      const barIdle = await evalIn(page, BAR);
      barIdle.snap = await evalIn(page, SNAP, out.world?.id);
      await configure(PORT, h.extensionId, {          // إطفاء المفتاح والشريط مخفيّ
        settings: { ...SETTINGS.settings,
          overlay: { ...SETTINGS.settings.overlay, hideProgressBar: false, speedButton: false } }
      });
      await sleep(1500);
      const barOff = await evalIn(page, BAR);
      // وبعد حركةٍ: المضيف يُظهر شريطه، فتُقاس العودة الفعلية بلا خلط
      await wiggle(page, px, py, 3);
      // ⚠️ **استطلاعٌ بدل مهلة** (قرار 50): يوتيوب يُظهر شريطه بتلاشٍ، ومهلةٌ
      // ثابتة تلتقط منتصفه. **وشفافيةُ المضيف خبرٌ تابع لا حكم** (قرار 72).
      let barOffMoved = null;
      for (let k = 0; k < 8; k++) {
        barOffMoved = await evalIn(page, BAR);
        if (barOffMoved?.opacity === 1) break;
        await sleep(250);
      }
      out.steps.barOffMoved = barOffMoved;
      out.steps.bar = { active: barActive, idle: barIdle, off: barOff, offMoved: out.steps.barOffMoved };

      // ── م22 — **ثقبُ صفّ الأزرار**: و#70 مطفأ، أيغيب زرُّنا وجيرانه حاضرون؟
      await configure(PORT, h.extensionId, {
        settings: { ...SETTINGS.settings,
          overlay: { ...SETTINGS.settings.overlay, hideProgressBar: false, speedButton: true } }
      });
      await sleep(1200);
      await wiggle(page, Math.round(vr.x + vr.w / 2), Math.round(vr.y + vr.h * 0.75), 3);
      await sleep(300);
      await sleep(IDLE_MS * 2);              // بعد مهلتنا وقبل إخفاء المضيف
      out.steps.hole = await evalIn(page, `(() => {
        const b = document.querySelector(".vzSpeedBtn");
        const nb = document.querySelector(".ytp-settings-button");
        const wOf = (el) => el ? Math.round(el.getBoundingClientRect().width) : null;
        return { inBar: !!(b && b.closest(".ytp-right-controls")),
                 btnW: wOf(b), nbW: wOf(nb),
                 btnHidden: !!(b && b.classList.contains("vzHidden")) };
      })()`);
    }

    return out;
  } catch (e) {
    out.error = String(e?.message || e).slice(0, 160);
    return out;
  } finally {
    try { page?.ws?.close(); } catch {}
    h?.kill?.();
    // **ثلاث تشغيلاتٍ على منفذٍ واحد** — والقتل لا يعني الموت فوراً، فالتشغيلة
    // التالية يرفضها الفحص القَبْليّ. **يُنتظر التحرّر ويُتحقَّق منه.**
    const free = await waitPortFree(PORT);
    if (!free) console.log("   ⚠️ لم يتحرّر المنفذ " + PORT + " — التشغيلة التالية سترفض");
  }
}

// ── بصمة البناء: يجيب سؤال «أهذا بناؤنا أصلاً؟» بلا تخمين ───────────────────
function fingerprint() {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const content = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
  const setShown = content.match(/function setSpeedBtnShown[\s\S]*?\n}/);
  return {
    version: man.version,
    has76: !!setShown && /ensureVideoOverlay\(video\)/.test(setShown[0]),
    has72Consumer: /IDLE_CONSUMERS\.speedButton\s*=/.test(content),
    hasOwnsMark: /data-vz-owns="wheel click"/.test(content),
    settingsUiShipped: fs.existsSync(path.join(ROOT, "settings-ui.js"))
  };
}

// ── التشغيل ─────────────────────────────────────────────────────────────────
const server = await serveTestPage(HTTP);
const fp = fingerprint();
const pos = await runOn("محليّ · مع الإضافة", server.url);
const neg = await runOn("محليّ · بلا إضافة (شاهد سالب)", server.url, { withExtension: false });
const yt = WANT_YT ? await runOn("يوتيوب · مع الإضافة", "https://www.youtube.com/watch?v=aqz-KE-bpKQ") : null;
try { server.srv.close(); } catch {}

if (AS_JSON) {
  console.log(JSON.stringify({ fingerprint: fp, pos, neg, yt }, null, 2));
  process.exit(0);
}

const yn = (b) => (b ? "✅" : "❌");
const btnLine = (s) => {
  const b = s?.btn;
  if (!b?.exists) return "غير موجود في الشجرة";
  return `${b.visible ? "مرئيّ" : "غير مرئيّ"} ${b.w}×${b.h} · vzHidden=${b.hiddenClass} · ` +
         `opacity=${b.opacity} · pointer-events=${b.pointerEvents} · نصّه «${b.text}»`;
};

console.log("\n=== رِكاز الطبقة — ما يراه مستخدمٌ حقيقيّ ===");
console.log(`\n── البناء المقيس (أهذا بناؤنا؟)`);
console.log(`   النسخة              : ${fp.version}`);
console.log(`   #76 في setSpeedBtnShown : ${yn(fp.has76)}  (ensureVideoOverlay قبل طلب العنصر)`);
console.log(`   مستهلك #72 مسجَّل    : ${yn(fp.has72Consumer)}`);
console.log(`   علامة الملكية       : ${yn(fp.hasOwnsMark)}`);
console.log(`   settings-ui.js مشحون : ${yn(fp.settingsUiShipped)}`);

for (const r of [pos, yt].filter(Boolean)) {
  console.log(`\n── ${r.label}`);
  if (r.error || r.why) { console.log(`   ⚠️ ${r.error || r.why}`); continue; }
  console.log(`   كروم / الإضافة      : ${r.chrome} · ${r.extensionId || "—"}`);
  console.log(`   العالم المعزول      : ${r.world ? "✅ " + r.world.name : "❌ لا شيء"}`);
  console.log(`   .vzWrap             : ${r.steps.afterMove?.wrapExists ? "موجودة · pointer-events=" + r.steps.afterMove.wrapPointerEvents : "غير موجودة"}`);
  console.log(`   م1 بعد حركةٍ موثوقة : ${btnLine(r.steps.afterMove)}`);
  console.log(`   م3 من يلتقط النقرة  : ${r.steps.afterMove?.hitAtBtnCenter || "—"}`);
  console.log(`   م4 نقرة ⇒ السرعة    : ${r.steps.click?.skipped ||
    `${r.steps.click?.before} ⇒ ${r.steps.click?.after} ${yn(r.steps.click?.changed)} · الوسم «${r.steps.click?.label}»`}`);
  console.log(`   م5 عجلة فوق الزرّ   : ${r.steps.wheelOnBtn?.skipped ||
    `${r.steps.wheelOnBtn?.before} ⇒ ${r.steps.wheelOnBtn?.after} ${yn(r.steps.wheelOnBtn?.changed)}`}`);
  console.log(`   م8 عجلة المربّع 4   : ${r.steps.zoneWheel?.before} ⇒ ${r.steps.zoneWheel?.after} ` +
    `${yn(r.steps.zoneWheel?.changed)} · الوسم يتبع ${yn(r.steps.zoneWheel?.labelFollows)} («${r.steps.zoneWheel?.label}»)`);
  console.log(`   م6 بعد سكون ${IDLE_MS * 3}ms : ${btnLine(r.steps.idle)}`);
  console.log(`   م7 والمفتاح مطفأ    : ${btnLine(r.steps.switchedOff)}`);
}

console.log(`\n── ${neg.label}`);
console.log(`   .vzSpeedBtn         : ${neg.steps?.afterMove?.btn?.exists ? "⚠️ موجود!" : "غير موجود"}`);

// ── الحكم: الشاهدان أوّلاً — ولا يُقرأ رقمٌ من رِكازٍ لم يُثبت أنه يرى ────────
const posWitness = !!pos.world && pos.steps?.afterMove?.btn?.exists === true &&
                   pos.steps?.afterMove?.btn?.visible === true;
const negWitness = !neg.steps?.afterMove?.btn?.exists;
console.log(`\n── شاهدا الرِكاز (قرار 26)`);
console.log(`   موجب — يرى الزرّ ظاهراً بحركةٍ موثوقة : ${posWitness ? "✅" : "❌ **ساقط**"}`);
console.log(`   سالب — ولا يراه بلا إضافة            : ${negWitness ? "✅" : "❌ **ساقط**"}`);
if (!posWitness || !negWitness) {
  console.log(`   ⇒ **الرِكاز غير صالح — لا تبنِ عليه تشخيصاً**\n`);
  process.exit(1);
}

// ── والقياسات بعد الشاهدين، لا قبلهما ───────────────────────────────────────
let bad = 0;
const gate = (name, cond, note) => {
  if (!cond) bad++;
  console.log(`   ${cond ? "✅" : "❌"} ${name}${note ? " — " + note : ""}`);
};
console.log(`\n── شروط القبول للطبقة`);
gate("الزرّ يظهر بالحركة وحدها بلا نقرة (10)", pos.steps.afterMove?.btn?.visible === true);
gate("نقرةٌ عليه تغيّر السرعة (15)", pos.steps.click?.changed === true,
     pos.steps.click?.skipped || `${pos.steps.click?.before} ⇒ ${pos.steps.click?.after}`);
gate("عجلةٌ فوقه تغيّر السرعة (14)", pos.steps.wheelOnBtn?.changed === true,
     pos.steps.wheelOnBtn?.skipped || `${pos.steps.wheelOnBtn?.before} ⇒ ${pos.steps.wheelOnBtn?.after}`);
gate("عجلة المربّع تغيّر السرعة (13)", pos.steps.zoneWheel?.changed === true);
gate("ووسم الزرّ يتبعها (13)", pos.steps.zoneWheel?.labelFollows === true, `«${pos.steps.zoneWheel?.label}»`);
gate("⭐ لا يختفي تحت مؤشّرٍ ساكن فوقه (12ب)", pos.steps.stillOverBtn?.btn?.visible === true,
     pos.steps.stillOverBtn ? `مرئيّ=${pos.steps.stillOverBtn.btn.visible}` : "لم يُقَس");
gate("ويختفي بالسكون حين يبعد المؤشّر (11)", pos.steps.idle?.btn?.visible === false);
gate("ويزول بإطفاء مفتاحه", pos.steps.switchedOff?.btn?.visible === false);
{
  const f = pos.steps.follows;
  const vidMoved = f && JSON.stringify(f.beforeVid) !== JSON.stringify(f.afterVid);
  gate("⭐ ويتبع مستطيل المشغّل حين يتغيّر (م17)",
       !!vidMoved && JSON.stringify(f.beforeBtn) !== JSON.stringify(f.afterBtn),
       f ? `الفيديو تحرّك=${vidMoved} · الزرّ ${JSON.stringify(f.beforeBtn)} ⇒ ${JSON.stringify(f.afterBtn)}` : "لم يُقَس");
}

// ── #70 — النصف الثاني، ولا يُقاس إلا على المضيف ───────────────────────────
{
  // ── #85 — الموضع والسقوط، **والاسم يُحمّر حين يموت** ─────────────────────
  const L = pos.steps.afterMove, Y = yt?.steps?.afterMove;
  console.log("");
  gate("محلياً (لا مضيف) ⇒ **سقوطٌ إلى الطبقة**", L?.inBar === false && L?.hostSlot === false,
       `في الشريط=${L?.inBar} · الحاوية موجودة=${L?.hostSlot}`);
  if (Y) {
    gate("⭐ وعلى يوتيوب: الحاوية موجودة (**يُحمّر حين يموت الاسم**)", Y.hostSlot === true,
         `.ytp-right-controls موجودة=${Y.hostSlot}`);
    gate("⭐ والزرّ **داخل شريط المضيف** لا في طبقتنا", Y.inBar === true, `في الشريط=${Y.inBar}`);
  } else {
    console.log("   ⚪ #85 على المضيف لم يُقَس — يحتاج `--youtube`");
  }
}

const bar = yt?.steps?.bar;
if (!bar) {
  console.log("   ⚪ #70 لم يُقَس — يحتاج `--youtube` (والنصفان شرطٌ واحد)");
} else {
  console.log(`\n── #70 على يوتيوب — شريط \`.ytp-chrome-bottom\``);
  // ⭐ **السؤال سؤالُنا (قرار 72): «أأخفاه صنفُنا؟» لا «أاختفى؟»** — وشفافيةُ
  // المضيف تُطبع خبراً تابعاً: **هو يُخفي شريطه بنفسه، وذاك ليس إخفاءنا**.
  gate("مع النشاط: صنفُنا غائبٌ — فلا إخفاء منّا",
       bar.active?.exists === true && bar.active?.ourClass === false,
       `صنفنا=${bar.active?.ourClass} · opacity=${bar.active?.opacity} · ${bar.active?.w}×${bar.active?.h}`);
  {
    const b = bar.idle, p = b?.snap?.pointer;
    const inside = !!(b?.exists && p && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    gate("ويختفي بالسكون (1) — بصنفنا نحن", bar.idle?.ourClass === true,
         `صنفنا=${bar.idle?.ourClass} · opacity=${bar.idle?.opacity}` +
         ` · شريط ${b?.x},${b?.y} ${b?.w}×${b?.h} · مؤشّر ${p ? p.x + "," + p.y : "—"}` +
         ` · **داخل الشريط=${inside}** · حالة=${b?.snap?.state} ممسوك=${b?.snap?.held}`);
  }
  gate("⭐ ويُرفع صنفُنا بإطفاء مفتاحه (8)", bar.off?.ourClass === false,
       `صنفنا=${bar.off?.ourClass} · opacity=${bar.off?.opacity} (وإخفاءُ المضيف ليس إخفاءنا)`);
  const hole = yt?.steps?.hole;
  if (hole) {
    gate("⭐ ولا ثقبَ في صفّ الأزرار: لا يغيب وجيرانه حاضرون (م22)",
         hole.inBar === true && hole.btnHidden === false && hole.btnW > 0 && hole.nbW > 0,
         `زرّنا ${hole.btnW}px مخفيّ=${hole.btnHidden} · الجار ${hole.nbW}px`);
  }
  // ⭐ **وهذا الشرط كان يقرأ شفافية المضيف وحدها فينقلب** (#97): يوتيوب يُخفي
  // شريطه بعد ~3 ثوانٍ، **فالتقاطُه في تلاشيه يُقرأ فشلاً منّا**. ⇒ **الحكم
  // صنفُنا مرفوعٌ فعلاً، والعودة المرئية استُطلعت لا قُدِّرت** وتُطبع خبراً.
  gate("⭐ وبعد الإطفاء وحركةٍ: صنفُنا مرفوع", bar.offMoved?.ourClass === false,
       `صنفنا=${bar.offMoved?.ourClass} · وشفافية المضيف=${bar.offMoved?.opacity}` +
       ` (خبرٌ تابع: إخفاؤه ليس إخفاءنا)`);
}

console.log(`\n⇒ ${bad === 0 ? "**الطبقة تعمل كما يستعملها المستخدم**"
  : `**${bad} شرطاً ساقطاً — الطبقة لا تعمل**`}\n`);
process.exit(bad ? 1 : 0);
