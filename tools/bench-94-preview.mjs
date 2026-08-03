// قياس #94 الثاني — المُميِّز على **معاينةٍ تعمل فعلاً**، لا على حالٍ ساكنة.
//
//   node tools/bench-94-preview.mjs           # المعاينة + صفحة watch
//   node tools/bench-94-preview.mjs --json
//
// ── لماذا وُجد ───────────────────────────────────────────────────────────────
// القياس الأوّل (2026-08-03) نفى المرشّحات البنيوية كلَّها — **وقِيس على حالٍ
// ساكنة لا معاينة تعمل فيها**. وبنصّ المالك: **«لم أجد مُميِّزاً» في حالٍ لم
// تُنتَج ليس نفياً.** فهذا الرِكاز **يُنتج الحال أوّلاً ويُثبت أنه أنتجها**، ثمّ
// يقيس عليها.
//
// ── شاهدا القبول (قرار 26) ──────────────────────────────────────────────────
//  · **موجب:** بعد تحويمٍ موثوق ⇒ **معاينةٌ حيّة**: مستطيلٌ غير صفريّ · تعمل ·
//    **و`currentTime` يتقدّم بين عيّنتين**. «موجودة» و«تعمل» ليسا شيئاً واحداً.
//  · **سالب:** الصفحة نفسها **بلا تحويم** ⇒ لا معاينة حيّة. بلا هذا الشاهد لا
//    يُعرف أن التحويم هو ما أنتجها، فيصير الموجب بلا معنى.
// ⇒ **وسقوط الموجب يمنع أي نفي** — يطبع الرِكاز أنه لم يقس، ولا يُبنى عليه بند.
//
// ⚠️ **«مرئيّ» يُشتقّ من شرطه المقيس** (العمى الأوّل، `S7`): مستطيلٌ غير صفريّ
// **مع** `display` و`visibility` **وشفافيةٍ فعّالة عبر السلسلة** (قرار 48).
import { launch, openPage, configure, contentWorld, evalIn, killChrome, waitPortFree, ROOT }
  from "./ext-harness.mjs";
import fs from "node:fs";
import path from "node:path";

const PORT = 9781;
const AS_JSON = process.argv.includes("--json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ⚠️ **الموضع بديلٌ مُعلَن لا خفيّ (2026-08-03):** خلاصةُ **الصفحة الرئيسية لا
// تُبنى أصلاً** لزائرٍ غير مسجَّل في هذا الرِكاز — قِيس: **صفر رابط مشاهدة** ·
// صفر بطاقة · `scrollHeight === innerHeight` بعد 10 ثوانٍ وبعد تمرير.
// **وصفحة النتائج تُبنى**: 160 رابطاً · 24 بطاقة · **ومعاينتها هي المعاينة نفسها**
// (`#inline-preview-player`، وهو ما يستهلكه #51). ⇒ **فالمقيس شبكةُ معاينات
// حقيقية، وليس «الصفحة الرئيسية» حرفياً** — ويُقرأ بحدّه هذا.
const HOME = "https://www.youtube.com/results?search_query=lofi";
const WATCH = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const IDLE_MS = 1000;

// إعدادات القياس: **مفتاح الزرّ مُشغَّل** — فالبند عن ظهوره، وقياسه مطفأً يقيس
// الإطفاء لا الميزة.
const SETTINGS = {
  settings: {
    enabled: true,
    idle: { ms: IDLE_MS },
    overlay: {
      autoHideMs: 900, volumeAutoHideMs: 900, enabled: true, hintEnabled: true,
      speedBadge: false, hideProgressBar: false,
      speedButton: true, speedButtonPreset: 2
    },
    zones: { enabled: true, fullscreenOnly: false }
  },
  globalSiteRules: { enabled: true, mappings: [] }
};

// ── محدّد الحاويات المعروفة يُقرأ من `content.js` ولا يُنسخ ──────────────────
// نسخةٌ تتباعد عن أصلها **تقيس الماضي وتطبع أرقاماً معقولة عن كودٍ لم يعد يعمل**.
function knownWrapperSelector() {
  const src = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
  const m = src.match(/const KNOWN_PLAYER_WRAPPER_SELECTOR\s*=([\s\S]*?);\n/);
  if (!m) throw new Error("تعذّر قراءة KNOWN_PLAYER_WRAPPER_SELECTOR من content.js — لا يُخمَّن");
  const parts = [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
  if (!parts.length) throw new Error("محدّد الحاويات المعروفة فارغ — لا يُبنى عليه");
  return parts.join("");
}
const WRAPPERS = knownWrapperSelector();

// ── المِجَسّ: حقائق كل فيديو في المستند ─────────────────────────────────────
// **كلّها خصائص بنيوية أو حالة عنصر — ولا محدِّد صفحةٍ رئيسية يُخترع هنا.**
const PROBE = (wrappers) => `(() => {
  const WRAP = ${JSON.stringify(wrappers)};
  const effOpacity = (el) => { let o = 1, n = el;
    while (n && n.nodeType === 1) { o *= Number(getComputedStyle(n).opacity) || 0; n = n.parentElement; }
    return Math.round(o * 1000) / 1000; };
  const visible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" &&
           effOpacity(el) > 0 && r.width > 0 && r.height > 0;
  };
  const desc = (el) => el ? (el.tagName.toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\\s+/).slice(0, 3).join(".") : "")).slice(0, 70) : null;
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
             x: Math.round(r.left), y: Math.round(r.top) }; };

  // نسخة \`looksLikePlayer\` + \`nearestPlayerAncestor\` من #58 — **الاستدلال القائم
  // في المنتج**، يُستهلك ولا يُبتكر بديل عنه.
  const FILL = 0.95, MAXD = 8;
  const looksLikePlayer = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches && el.matches(WRAP)) return true;
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

  const vids = [...document.querySelectorAll("video")];
  const vw = innerWidth, vh = innerHeight;
  const areas = vids.map((v) => { const r = v.getBoundingClientRect(); return r.width * r.height; });
  const maxArea = Math.max(0, ...areas);

  const rows = vids.map((v, i) => {
    const r = v.getBoundingClientRect();
    const known = v.closest(WRAP);
    const near = nearestPlayer(v);
    const scope = known || near || v.parentElement;
    // **شريطُ تحكّمٍ يخصّ هذا الفيديو**: عناصر تفاعلية مرئية داخل مشغّله هو،
    // لا في المستند كلّه. (المستند كلّه هو ما يفعله \`speedBtnHostSlot\` اليوم.)
    let btns = 0, sliders = 0, timeText = 0;
    if (scope) {
      for (const el of scope.querySelectorAll('button,[role="button"],a[href]')) {
        if (el.closest(".vzWrap,.vzSpeedBtn")) continue;      // عناصرنا ليست المضيف
        if (visible(el)) btns++;
      }
      for (const el of scope.querySelectorAll('[role="slider"],input[type="range"],[aria-valuenow]')) {
        if (visible(el)) sliders++;
      }
      for (const el of scope.querySelectorAll("*")) {
        if (timeText) break;
        const t = (el.childElementCount === 0 && el.textContent || "").trim();
        if (/^\\d+:\\d\\d(:\\d\\d)?$/.test(t) && visible(el)) timeText = 1;
      }
    }
    const bar = scope ? scope.querySelector(".ytp-right-controls") : null;
    return {
      i,
      rect: box(v),
      areaRatioViewport: Math.round((r.width * r.height) / Math.max(1, vw * vh) * 1000) / 1000,
      largestInDoc: areas[i] === maxArea && maxArea > 0,
      visible: visible(v),
      duration: Number.isFinite(v.duration) ? Math.round(v.duration) : null,
      currentTime: Math.round(v.currentTime * 100) / 100,
      paused: v.paused, muted: v.muted, defaultMuted: v.defaultMuted,
      volume: v.volume, readyState: v.readyState,
      controlsAttr: v.hasAttribute("controls"), loopAttr: v.hasAttribute("loop"),
      autoplayAttr: v.hasAttribute("autoplay"),
      srcKind: !v.currentSrc ? "(فارغ)" : v.currentSrc.slice(0, 5),
      audioBytes: v.webkitAudioDecodedByteCount ?? null,
      knownWrapper: desc(known), knownWrapperBox: box(known),
      nearestPlayer: desc(near), nearestPlayerBox: box(near),
      scope: desc(scope),
      ownBar: { buttons: btns, sliders, timeText: !!timeText,
                ytRightControls: !!bar, ytRightControlsVisible: visible(bar), ytRightControlsBox: box(bar) }
    };
  });

  // ما يفعله المنتج اليوم: **بحثٌ في المستند كلّه** لا في مشغّل الفيديو.
  const docBar = document.querySelector(".ytp-right-controls");
  const btn = document.querySelector(".vzSpeedBtn");
  return {
    url: location.href,
    videoCount: vids.length,
    videos: rows,
    docYtRightControls: { exists: !!docBar, visible: visible(docBar), box: box(docBar),
                          insideDesc: desc(docBar && docBar.closest(WRAP)) },
    speedBtn: btn ? { exists: true, visible: visible(btn), box: box(btn),
                      inBar: !!btn.closest(".ytp-right-controls"),
                      hidden: btn.classList.contains("vzHidden"),
                      text: (btn.textContent || "").trim().slice(0, 8) }
                  : { exists: false }
  };
})()`;

// عيّنتان بينهما مهلة: **«تعمل» تُقاس بتقدّم الزمن لا بعلم `paused`**.
const LIVE = `(() => {
  const vids = [...document.querySelectorAll("video")];
  return vids.map((v) => { const r = v.getBoundingClientRect();
    return { t: v.currentTime, paused: v.paused, w: Math.round(r.width), h: Math.round(r.height) }; });
})()`;

async function liveVideos(page) {
  const a = await evalIn(page, LIVE);
  await sleep(900);
  const b = await evalIn(page, LIVE);
  if (!Array.isArray(a) || !Array.isArray(b)) return [];
  return b.map((x, i) => ({
    ...x, advanced: !!(a[i] && x.t > a[i].t + 0.05),
    live: !!(a[i] && x.t > a[i].t + 0.05) && !x.paused && x.w > 0 && x.h > 0
  })).filter((x) => x.live);
}

async function move(page, x, y) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
}
async function wiggle(page, x, y, n = 4) {
  for (let i = 0; i < n; i++) { await move(page, x + (i % 2), y + ((i + 1) % 2)); await sleep(120); }
}

// هدف التحويم: **بنيويّ لا باسم مكوّن** — رابط مشاهدةٍ فيه صورة، بمستطيلٍ معقول
// داخل إطار العرض. (اسم مكوّنٍ في يوتيوب يموت كما مات `ytp-` في 11 من 59.)
const PICK_THUMB = `(() => {
  const cands = [...document.querySelectorAll('a[href*="/watch?v="]')]
    .map((a) => ({ a, r: a.getBoundingClientRect(), img: !!a.querySelector("img,ytd-thumbnail,yt-image") }))
    .filter((c) => c.img && c.r.width > 120 && c.r.height > 70 &&
                   c.r.top > 60 && c.r.bottom < innerHeight - 20);
  if (!cands.length) return null;
  const c = cands[0];
  return { x: Math.round(c.r.left + c.r.width / 2), y: Math.round(c.r.top + c.r.height / 2),
           w: Math.round(c.r.width), h: Math.round(c.r.height),
           href: c.a.getAttribute("href").slice(0, 40) };
})()`;

// ⚠️ **تشخيصٌ يُطبع حين يسقط الاختيار** — «لم أجد» بلا سببٍ منشور تُقرأ نفياً.
const DIAG = `(() => {
  const links = [...document.querySelectorAll('a[href*="/watch?v="]')];
  return {
    title: document.title.slice(0, 60),
    viewport: [innerWidth, innerHeight],
    links: links.length,
    withImg: links.filter((a) => a.querySelector("img,ytd-thumbnail,yt-image")).length,
    firstRects: links.slice(0, 6).map((a) => { const r = a.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }),
    dialogs: [...document.querySelectorAll('[role="dialog"],tp-yt-paper-dialog,ytd-consent-bump-v2-lightbox')]
      .map((d) => (d.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60)),
    bodyHead: (document.body.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 120)
  };
})()`;

async function runHome() {
  const out = { label: "شبكة معاينات (نتائج البحث) — معاينةٌ بتحويم", steps: {} };
  let h = null, page = null;
  try {
    h = await launch(PORT, { extra: ["--window-size=1440,900"] });
    out.chrome = h.chrome;
    const cfg = await configure(PORT, h.extensionId, SETTINGS);
    if (!cfg.ok) { out.why = "تعذّر ضبط التخزين: " + (cfg.why || cfg.error); return out; }
    page = await openPage(PORT, HOME);
    await sleep(6000);
    out.world = await contentWorld(page);
    out.diag = await evalIn(page, DIAG);

    // ── الشاهد السالب: **بلا تحويم** ⇒ لا معاينة حيّة ────────────────────────
    out.steps.beforeHover = { live: await liveVideos(page), probe: await evalIn(page, PROBE(WRAPPERS)) };

    const thumb = await evalIn(page, PICK_THUMB);
    out.thumb = thumb;
    if (!thumb) { out.why = "لا مصغَّرة صالحة في إطار العرض — لا يُقاس"; return out; }

    // ── إنتاج الحال: تحويمٌ موثوق ومتّصل حتى تعمل معاينة (حتى 20 ثانية) ──────
    let live = [];
    for (let i = 0; i < 10 && !live.length; i++) {
      await wiggle(page, thumb.x, thumb.y, 3);
      await sleep(900);
      live = await liveVideos(page);
    }
    out.steps.afterHover = { live };
    if (!live.length) { out.why = "لم تُنتَج معاينةٌ تعمل — **فلا نفي ولا إثبات**"; return out; }

    // المؤشّر يبقى على المصغَّرة أثناء القياس — رفعُه يُنهي المعاينة.
    await wiggle(page, thumb.x, thumb.y, 2);
    out.probe = await evalIn(page, PROBE(WRAPPERS));
    return out;
  } catch (e) {
    out.why = String(e?.message || e).slice(0, 160);
    return out;
  } finally {
    try { page?.ws?.close(); } catch {}
    killChrome(h);
    await waitPortFree(PORT);
  }
}

async function runWatch() {
  const out = { label: "صفحة watch — مشغّلٌ حقيقيّ", steps: {} };
  let h = null, page = null;
  try {
    h = await launch(PORT);
    out.chrome = h.chrome;
    const cfg = await configure(PORT, h.extensionId, SETTINGS);
    if (!cfg.ok) { out.why = "تعذّر ضبط التخزين: " + (cfg.why || cfg.error); return out; }
    page = await openPage(PORT, WATCH);
    await sleep(7000);
    out.world = await contentWorld(page);
    const v0 = await evalIn(page, `(() => { const v = document.querySelector("video");
      if (!v) return null; const r = v.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
    out.videoRect = v0;
    if (!v0 || v0.w <= 0) { out.why = "لا فيديو بمستطيلٍ غير صفريّ (قرار 22)"; return out; }
    await wiggle(page, Math.round(v0.x + v0.w / 2), Math.round(v0.y + v0.h * 0.8), 4);
    await sleep(600);
    out.live = await liveVideos(page);
    await wiggle(page, Math.round(v0.x + v0.w / 2), Math.round(v0.y + v0.h * 0.8), 2);
    out.probe = await evalIn(page, PROBE(WRAPPERS));
    return out;
  } catch (e) {
    out.why = String(e?.message || e).slice(0, 160);
    return out;
  } finally {
    try { page?.ws?.close(); } catch {}
    killChrome(h);
    await waitPortFree(PORT);
  }
}

// ── التشغيل ─────────────────────────────────────────────────────────────────
const home = await runHome();
const watch = await runWatch();

if (AS_JSON) {
  console.log(JSON.stringify({ home, watch }, null, 2));
  process.exit(0);
}

const yesNo = (b) => (b ? "نعم" : "لا");
function printProbe(p) {
  if (!p) { console.log("   — لا مِجَسّ"); return; }
  console.log(`   العنوان            : ${p.url.slice(0, 60)}`);
  console.log(`   عدد الفيديوهات     : ${p.videoCount}`);
  console.log(`   ‏.ytp-right-controls في المستند كلّه (ما يقرأه المنتج اليوم):`);
  console.log(`      موجود ${yesNo(p.docYtRightControls.exists)} · مرئيّ ${yesNo(p.docYtRightControls.visible)}` +
    ` · ${JSON.stringify(p.docYtRightControls.box)} · داخل ${p.docYtRightControls.insideDesc || "—"}`);
  console.log(`   زرّ السرعة         : ${p.speedBtn.exists
    ? `موجود · مرئيّ ${yesNo(p.speedBtn.visible)} · ${p.speedBtn.inBar ? "**في شريط المضيف**" : "**في طبقتنا**"}` +
      ` · ${JSON.stringify(p.speedBtn.box)} · "${p.speedBtn.text}"`
    : "غير موجود"}`);
  for (const v of p.videos) {
    console.log(`   ── فيديو [${v.i}] ${v.visible ? "مرئيّ" : "غير مرئيّ"} ${JSON.stringify(v.rect)}`);
    console.log(`      نسبة إطار العرض ${v.areaRatioViewport} · الأكبر في المستند ${yesNo(v.largestInDoc)}` +
      ` · مدّة ${v.duration} · زمن ${v.currentTime} · متوقّف ${yesNo(v.paused)}`);
    console.log(`      مكتوم ${yesNo(v.muted)} (افتراضاً ${yesNo(v.defaultMuted)}) · مستوى ${v.volume}` +
      ` · جاهزية ${v.readyState} · مصدر ${v.srcKind} · صوت مفكوك ${v.audioBytes}`);
    console.log(`      سمة controls ${yesNo(v.controlsAttr)} · loop ${yesNo(v.loopAttr)} · autoplay ${yesNo(v.autoplayAttr)}`);
    console.log(`      حاوية معروفة ${v.knownWrapper || "—"} ${JSON.stringify(v.knownWrapperBox)}`);
    console.log(`      أقرب مشغّل (#58) ${v.nearestPlayer || "—"} ${JSON.stringify(v.nearestPlayerBox)}`);
    console.log(`      **شريطه هو** : أزرار ${v.ownBar.buttons} · منزلقات ${v.ownBar.sliders}` +
      ` · نصّ وقت ${yesNo(v.ownBar.timeText)} · ytp-right-controls ${yesNo(v.ownBar.ytRightControls)}` +
      ` (مرئيّ ${yesNo(v.ownBar.ytRightControlsVisible)})`);
  }
}

console.log("\n=== قياس #94 الثاني — على معاينةٍ تعمل فعلاً ===");
for (const run of [home, watch]) {
  console.log(`\n── ${run.label}`);
  console.log(`   كروم               : ${run.chrome || "—"}`);
  console.log(`   العالم المعزول     : ${run.world ? "✅ " + run.world.name : "❌ لا شيء — الإضافة لا تعمل هنا"}`);
  if (run.why) { console.log(`   ⚠️ ${run.why}`); }
  if (run === home) {
    console.log(`   تشخيص الصفحة       : ${JSON.stringify(run.diag)}`);
    console.log(`   المصغَّرة المحوَّم عليها: ${run.thumb ? JSON.stringify(run.thumb) : "—"}`);
    console.log(`   شاهد سالب (بلا تحويم): ${run.steps.beforeHover?.live?.length || 0} معاينة حيّة`);
    console.log(`   شاهد موجب (بالتحويم) : ${run.steps.afterHover?.live?.length || 0} معاينة حيّة` +
      (run.steps.afterHover?.live?.length ? ` ${JSON.stringify(run.steps.afterHover.live)}` : ""));
  } else {
    console.log(`   فيديو حيّ           : ${run.live?.length || 0}`);
  }
  printProbe(run.probe);
}

const negOk = (home.steps?.beforeHover?.live?.length || 0) === 0;
const posOk = (home.steps?.afterHover?.live?.length || 0) > 0;
console.log("\n── الشاهدان");
console.log(`   السالب : ${negOk ? "✅ بلا تحويم لا معاينة حيّة" : "❌ **ساقط** — ثمّة فيديو حيّ قبل التحويم، فالتحويم ليس سببه"}`);
console.log(`   الموجب : ${posOk ? "✅ التحويم أنتج معاينةً تعمل" : "❌ **ساقط** — لم تُنتَج معاينة، فلا يُنفى شيء ولا يُثبت"}`);
console.log(`   ⇒ ${posOk && negOk ? "**القياس صالح**" : "**القياس غير صالح — لا يُبنى عليه بند**"}\n`);
process.exit(posOk && negOk ? 0 : 1);
