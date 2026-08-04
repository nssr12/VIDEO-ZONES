// قياس #98 — أثرُ `<html>` عنصرَ ملء الشاشة على أربعةٍ لم تُقس معه قطّ.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// نصفُ مقارنته هو زرّ ملء الشاشة الذي يملكه يوتيوب (`.ytp-fullscreen-button`)،
//   ومعه فرعُ «الرِكاز محجوب» حين لا يُعطي المضيف فيديو — فمقارنةٌ أحدُ طرفيها
//   عند الغير لا تكون بوّابة.
//
//   node tools/bench-98-fs-scope.mjs
//
// ⚠️ **قياسٌ لا بناء (أمر المالك)** — **ولا يُصلَح ما لم يُرصد له عَرَض**.
// **والمرجَّح عند المالك أن يتطابق المساران فيُغلق السؤال بأرقامه** — وذاك جوابٌ
// مقبول، بل هو المطلوب إن صحّ.
//
// ── الأربعة ────────────────────────────────────────────────────────────────
//   (١) **الطبقة العليا** (#47): أين تُعلَّق طبقتُنا · وأتعلو فعلاً (باللمس لا بالظنّ)
//   (٢) **`zoneRectForVideo`**: أيبقى مستطيلُ المربّعات مستطيلَ المشغّل؟
//   (٣) **`fullscreenElementFor`**: ماذا يُرجع، وأيوافق `document.fullscreenElement`؟
//   (٤) **مستهلكا السكون**: صنفُ #70 · وموضعُ زرّ #72 وظهورُه
//
// ── والمقارنة شرطٌ (أمر المالك): أمرُنا في مقابل زرّ المشغّل نفسه ─────────────
// **فإن تطابقا فالسؤال يُغلق بلا علاج.**
//
// ── شاهدا قرار 26، و48 خاصّةً ───────────────────────────────────────────────
//  · **موجب:** طبقتُنا **تُرى وتُلمس** قبل ملء الشاشة (عنصرٌ منّا تحت نقطةٍ نختارها).
//  · **سالب:** وقبل أي فعلٍ منّا **لا وجود لعناصرنا أصلاً** — فالمِجَسّ يُميّز.
// ⚠️ **و«يعلو» يُقاس بـ`elementFromPoint` لا بـ`z-index`** — والقيمةُ العالية لا
// تعني الفوز، **وأثرُنا وأثرُ المضيف يتشابهان في العين** (قرار 48): فيُقاس **صنفُنا
// وسمتُنا**، لا ما يبدو للناظر.
import { launch, openPage, configure, contentWorld, evalIn, killChrome, waitPortFree }
  from "./ext-harness.mjs";

const PORT = 9783;
const AS_JSON = process.argv.includes("--json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const IDLE_MS = 1000;

const SETTINGS = {
  settings: {
    enabled: true, idle: { ms: IDLE_MS },
    overlay: { autoHideMs: 3000, volumeAutoHideMs: 3000, enabled: true, hintEnabled: true,
               speedBadge: false, hideProgressBar: true, speedButton: true, speedButtonPreset: 2 },
    zones: {
      enabled: true, fullscreenOnly: false, gridCoverage: "player",
      wheel: { map: { "4": { up: ["ACTION:VOLUME:+5"], down: ["ACTION:VOLUME:-5"] } } }
    }
  },
  globalSiteRules: { enabled: true, mappings: [{ from: "Mouse2", to: "ACTION:TOGGLE_FULLSCREEN" }] }
};

// ── المِجَسّ: يعيش في **عالم الإضافة** كي ينادي دوالَّنا كما هي ───────────────
const PROBE = `(() => {
  const v = document.querySelector("video");
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
             x: Math.round(r.left), y: Math.round(r.top) }; };
  const desc = (el) => el ? (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "")).slice(0, 46) : null;
  const wrap = document.querySelector(".vzWrap");
  const grid = document.querySelector(".vzGrid");
  const btn  = document.querySelector(".vzSpeedBtn");
  const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 &&
           r.width > 0 && r.height > 0; };

  // ⚠️ **آلةٌ أُصلحت قبل أن تُنشر أرقامُها (2026-08-04):** قِيس «يعلو» بـ
  // \`elementFromPoint\` **فردّ الفيديو دائماً** — **وطبقتُنا \`pointer-events:none\`
  // بالتصميم، فلا يردّها المتصفّح أبداً**. ⇒ **مِجَسٌّ كان سيُثبت عطباً لا وجود
  // له** (العائلة الثانية). **فالقياس بإذنٍ مؤقّت مُعلَن**: تُرفع \`pointer-events\`
  // لحظةً، يُقرأ الترتيب، ثمّ تُعاد كما كانت — **والتبديل يُعلَن في الخرج**.
  let hit = null, hitIsOurs = null, probedBy = "—";
  if (wrap && vis(wrap)) {
    const r = wrap.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height * 0.2);
    const before = wrap.style.pointerEvents;
    wrap.style.pointerEvents = "auto";
    const el = document.elementFromPoint(x, y);
    wrap.style.pointerEvents = before;
    hit = desc(el);
    hitIsOurs = !!(el && (el.closest(".vzWrap") || el.closest(".vzSpeedBtn")));
    probedBy = "بإذنٍ مؤقّت (pointer-events)";
  }

  return {
    fsElement: document.fullscreenElement ? desc(document.fullscreenElement) : null,
    fsIsHtml: document.fullscreenElement === document.documentElement,
    // (١) الطبقة
    layer: wrap ? {
      exists: true, visible: vis(wrap), parent: desc(wrap.parentElement),
      popoverAttr: wrap.getAttribute("popover"),
      popoverOpen: (() => { try { return wrap.matches(":popover-open"); } catch { return null; } })(),
      zIndex: getComputedStyle(wrap).zIndex, position: getComputedStyle(wrap).position,
      box: box(wrap), gridVisible: vis(grid), hit, hitIsOurs, probedBy
    } : { exists: false },
    // (٢) و(٣) — **دوالُّنا نفسُها تُنادى** (الدوالّ مقروءةٌ في عالم الإضافة)
    zoneRect: (typeof zoneRectForVideo === "function" && v)
      ? (() => { const r = zoneRectForVideo(v);
          return r ? { w: Math.round(r.width), h: Math.round(r.height),
                       x: Math.round(r.left), y: Math.round(r.top) } : null; })() : "لا دالّة",
    videoRect: box(v),
    playerRect: box(document.querySelector("#movie_player")),
    fsFor: (typeof fullscreenElementFor === "function" && v)
      ? desc(fullscreenElementFor(v)) : "لا دالّة",
    // (٤) مستهلكا السكون
    idle: (typeof vzIdleSnapshot === "function") ? vzIdleSnapshot() : null,
    ourProgressClass: document.documentElement.classList.contains("vz-idle-hide-progress"),
    speedBtn: btn ? { visible: vis(btn), inBar: !!btn.closest(".ytp-right-controls"),
                      box: box(btn), parent: desc(btn.parentElement) } : { visible: false }
  };
})()`;

async function move(page, x, y) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
}
async function wiggle(page, x, y, n = 3) {
  for (let i = 0; i < n; i++) { await move(page, x + (i % 2), y + ((i + 1) % 2)); await sleep(120); }
}

const out = { paths: {} };
let h = null, page = null;
try {
  h = await launch(PORT, { extra: ["--window-size=1440,900"] });
  out.chrome = h.chrome;
  const cfg = await configure(PORT, h.extensionId, SETTINGS);
  if (!cfg.ok) throw new Error("تعذّر ضبط التخزين");
  page = await openPage(PORT, WATCH);
  await sleep(7000);
  const world = (await contentWorld(page))?.id;
  out.world = !!world;
  if (!world) throw new Error("لا عالم معزول");

  let vr = null;
  for (let k = 0; k < 20 && !vr; k++) {
    vr = await evalIn(page, `(() => { const v = document.querySelector("video");
      if (!v) return null; const r = v.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return null;
      return { x: Math.round(r.left), y: Math.round(r.top),
               w: Math.round(r.width), h: Math.round(r.height) }; })()`);
    if (!vr) await sleep(500);
  }
  if (!vr) {
    out.blocked = await evalIn(page, `({ t: document.title.slice(0,50), v: document.querySelectorAll("video").length })`);
    throw new Error("لا فيديو — الرِكاز محجوب");
  }
  out.videoRect = vr;

  // ── الشاهد السالب: قبل أي فعلٍ منّا لا وجود لعناصرنا ──────────────────────
  out.witnessBefore = await evalIn(page, PROBE, world);

  // ── الشاهد الموجب: عجلةٌ على المربّع 4 ⇒ طبقتُنا تُبنى وتُلمس ─────────────
  const zx = Math.round(vr.x + vr.w / 6), zy = Math.round(vr.y + vr.h / 2);
  await wiggle(page, zx, zy, 2);
  await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: zx, y: zy, deltaX: 0, deltaY: -120 });
  await sleep(250);                       // **قبل أن تذوي الشبكة** — لا بعدها
  out.witnessAfter = await evalIn(page, PROBE, world);

  const measure = async (label) => {
    await sleep(900);
    await wiggle(page, Math.round(vr.x + vr.w / 2), Math.round(vr.y + vr.h * 0.45), 3);
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseWheel", x: Math.round(vr.x + vr.w / 6), y: Math.round(vr.y + vr.h / 2),
      deltaX: 0, deltaY: -120 });
    await sleep(700);
    out.paths[label] = { active: await evalIn(page, PROBE, world) };
    await sleep(IDLE_MS * 3);
    out.paths[label].idle = await evalIn(page, PROBE, world);
  };

  // ── (أ) زرّ المشغّل نفسه ─────────────────────────────────────────────────
  await wiggle(page, Math.round(vr.x + vr.w / 2), Math.round(vr.y + vr.h * 0.9), 2);
  await page.send("Runtime.evaluate", {
    expression: `document.querySelector(".ytp-fullscreen-button").click()`,
    userGesture: true, returnByValue: true });
  for (let k = 0; k < 20; k++) { if (await evalIn(page, `!!document.fullscreenElement`)) break; await sleep(200); }
  await measure("hostButton");
  await page.send("Runtime.evaluate", { expression: `document.exitFullscreen?.()`,
    userGesture: true, returnByValue: true, awaitPromise: true });
  await sleep(1500);

  // ── (ب) أمرُنا: الزرّ الأوسط على الفيديو ────────────────────────────────
  const cx = Math.round(vr.x + vr.w / 2), cy = Math.round(vr.y + vr.h / 2);
  await move(page, cx, cy); await sleep(150);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy,
    button: "middle", buttons: 4, clickCount: 1 });
  await sleep(80);
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy,
    button: "middle", buttons: 0, clickCount: 1 });
  for (let k = 0; k < 20; k++) { if (await evalIn(page, `!!document.fullscreenElement`)) break; await sleep(200); }
  await measure("ourCommand");
} catch (e) {
  out.why = String(e?.message || e).slice(0, 160);
} finally {
  try { page?.ws?.close(); } catch {}
  killChrome(h);
  await waitPortFree(PORT);
}

if (AS_JSON) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

const yn = (b) => (b === null || b === undefined ? "—" : b ? "نعم" : "لا");
console.log("\n=== قياس #98 — عنصرُ ملء الشاشة وأثرُه على الأربعة ===");
console.log(`   كروم: ${out.chrome || "—"} · العالم: ${yn(out.world)} · الفيديو: ${JSON.stringify(out.videoRect)}`);
if (out.why) console.log(`   ⚠️ ${out.why}${out.blocked ? " · " + JSON.stringify(out.blocked) : ""}`);

const wb = out.witnessBefore, wa = out.witnessAfter;
console.log("\n── شاهدا قرار 26");
console.log(`   السالب (قبل أي فعل): طبقتُنا موجودة=${yn(wb?.layer?.exists)}`);
console.log(`   الموجب (بعد عجلة)  : موجودة=${yn(wa?.layer?.exists)} · مرئية=${yn(wa?.layer?.visible)}` +
  ` · **وشبكتُنا مرسومة**=${yn(wa?.layer?.gridVisible)} · واللمس (${wa?.layer?.probedBy})=${yn(wa?.layer?.hitIsOurs)}`);
// **الموجب: شبكتُنا تُرسم فعلاً** — وهو ما يُثبت أن المِجَسّ يرى طبقتَنا.
// ⚠️ **ولا يُشترط فيه «اللمس»**: الطبقة `pointer-events:none` بالتصميم.
const posOk = !!(wa?.layer?.exists && wa?.layer?.visible && wa?.layer?.gridVisible);
const negOk = !wb?.layer?.exists || wb?.layer?.visible === false;

function show(label, p) {
  if (!p) { console.log(`\n── ${label}: لا قياس`); return; }
  for (const [k, st] of [["مع النشاط", p.active], ["وبعد السكون", p.idle]]) {
    if (!st) continue;
    console.log(`\n── ${label} · ${k}`);
    console.log(`   عنصر ملء الشاشة  : ${st.fsElement || "لا"} · **هو <html>**=${yn(st.fsIsHtml)}`);
    console.log(`   (١) الطبقة       : موجودة=${yn(st.layer.exists)} مرئية=${yn(st.layer.visible)}` +
      ` · أبٌ=${st.layer.parent} · popover=${st.layer.popoverAttr ?? "—"} مفتوحة=${yn(st.layer.popoverOpen)}`);
    console.log(`                      z=${st.layer.zIndex} · ${st.layer.position} · ${JSON.stringify(st.layer.box)}` +
      ` · شبكة مرئية=${yn(st.layer.gridVisible)} · **اللمس يردّ عنصرَنا**=${yn(st.layer.hitIsOurs)} (${st.layer.hit || "—"})`);
    console.log(`   (٢) zoneRect      : ${JSON.stringify(st.zoneRect)} · فيديو ${JSON.stringify(st.videoRect)}` +
      ` · مشغّل ${JSON.stringify(st.playerRect)}`);
    console.log(`   (٣) fullscreenElementFor: ${st.fsFor}`);
    console.log(`   (٤) السكون        : صنفُ #70=${yn(st.ourProgressClass)} · حالة=${st.idle?.state}` +
      ` · زرّ #72 مرئيّ=${yn(st.speedBtn.visible)} في الشريط=${yn(st.speedBtn.inBar)} أبٌ=${st.speedBtn.parent || "—"}`);
  }
}
show("زرّ المشغّل", out.paths.hostButton);
show("أمرُنا (Mouse2)", out.paths.ourCommand);

const A = out.paths.hostButton, B = out.paths.ourCommand;
if (A?.active && B?.active) {
  const cmp = [
    ["عنصر ملء الشاشة", (s) => s.fsElement],
    ["هو <html>", (s) => s.fsIsHtml],
    ["أبُ الطبقة", (s) => s.layer.parent],
    ["سمة popover", (s) => String(s.layer.popoverAttr)],
    ["popover مفتوحة", (s) => String(s.layer.popoverOpen)],
    ["اللمس يردّ عنصرَنا", (s) => String(s.layer.hitIsOurs)],
    ["zoneRect", (s) => JSON.stringify(s.zoneRect)],
    ["fullscreenElementFor", (s) => s.fsFor],
    ["زرّ #72 في الشريط", (s) => String(s.speedBtn.inBar)]
  ];
  console.log("\n── المقارنة (مع النشاط)");
  let same = 0;
  for (const [label, f] of cmp) {
    const a = f(A.active), b = f(B.active);
    const eq = String(a) === String(b);
    if (eq) same++;
    console.log(`   ${eq ? "= " : "≠ "} ${label.padEnd(22)} زرّ=${String(a).slice(0, 40)}  |  أمرُنا=${String(b).slice(0, 40)}`);
  }
  const idleCmp = [["صنفُ #70 بالسكون", (s) => String(s.ourProgressClass)],
                   ["زرّ #72 مرئيّ بالسكون", (s) => String(s.speedBtn.visible)]];
  for (const [label, f] of idleCmp) {
    const a = f(A.idle), b = f(B.idle);
    const eq = String(a) === String(b);
    if (eq) same++;
    console.log(`   ${eq ? "= " : "≠ "} ${label.padEnd(22)} زرّ=${a}  |  أمرُنا=${b}`);
  }
  console.log(`\n   ⇒ **${same} من ${cmp.length + idleCmp.length} متطابقة**`);
}
console.log("\n── الشاهدان");
console.log(`   الموجب: ${posOk ? "✅ الطبقة تُرى وتُلمس" : "❌ **ساقط** — لا يُبنى على أي رقم"}`);
console.log(`   السالب: ${negOk ? "✅ ولا وجود لها قبل الفعل" : "❌ **ساقط**"}\n`);
process.exit(posOk && negOk ? 0 : 1);
