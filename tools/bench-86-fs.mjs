// قياس #86 — **مسارا ملء الشاشة جنباً إلى جنب**: زرّ المشغّل يعمل، وأمرُنا لا يعمل.
//
//   node tools/bench-86-fs.mjs
//
// ⚠️ **لا تشخيص للعاطل وحده (أمر المالك): يُقارَن بالعامل، والفرقُ هو الجذر.**
// **والفرضيات تُقاس ولا تُصدَّق، ولا يُجمع علاجان «احتياطاً»** — فعلاجُ سببٍ لم
// يقع **يُخفي بقاء الآخر**.
//
// ── ما يفرّقه الخرج بنفسه — أربع فرضيات، لكلٍّ بصمةٌ مختلفة ─────────────────
//   (١) **نشاطٌ لم يُسجَّل**      ⇒ `idleLastActivityAt === 0` بعد الدخول
//   (٢) **مؤقّتٌ لم يُسلَّح**      ⇒ `activityAt > 0` و`timerArmed === false`
//   (٣) **امتناعٌ عالق: زرٌّ ممسوك** ⇒ `idlePointerHeld === true` بلا إفلات
//   (٤) **امتناعٌ بالمؤشّر على الهدف** ⇒ `pointerInsideTarget === true` (#95)
//   ⇒ **وفرضيةُ التركيز** تُقرأ من `activeElement` في المسارين معاً.
//
// ── شاهدا القبول (قرار 26) ──────────────────────────────────────────────────
//  · **موجب:** مسار **زرّ المشغّل** ⇒ الصنف `vz-idle-hide-progress` يقع فعلاً
//    بعد المهلة — **فالأداة ترى الإخفاء حين يقع**.
//  · **سالب:** ومسار **أمرِنا** ⇒ لا يقع. **وسقوط الموجب يمنع أي حكم**: أداةٌ لا
//    ترى الإخفاء في المسار العامل لا تُثبت غيابَه في الآخر.
import { launch, openPage, configure, contentWorld, evalIn, killChrome, waitPortFree, serveTestPage }
  from "./ext-harness.mjs";

const PORT = 9797, HTTP = 8897;
const AS_JSON = process.argv.includes("--json");
const LOCAL = process.argv.includes("--local");

// ── منصّةٌ محايدة — **وحدُّها مُعلَن كحدّ `manual-35-volume.html`** ────────────
// ⚠️ **قِيس 2026-08-04 أن يوتيوب يردّ على الرِكاز بصفحة «حركة مرور غير معتادة»**
// (صفر `<video>`)، **و«لم أقس» ليست «قِستُ فوجدت صفراً»**. فهذي المنصّة تقيس
// **المحرّك** لا المضيف: مشغّلٌ بحاويةٍ معروفة (`.video-player`) وشريطُ تحكّمٍ
// **فيه زرّ ملء شاشةٍ خاصٌّ به** — فيصير في الصفحة **مسارانِ كمساري المالك**.
// ⛔ **ولا تقول شيئاً عن سلوك يوتيوب**، ومستهلكُها **زرُّ السرعة (#72)** لا #70
// (فذاك مقصورٌ على يوتيوب بتعريفه).
const LOCAL_PAGE = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#111">
  <div id="player" class="video-player" style="position:relative;width:640px;height:392px;background:#000">
    <video id="v" width="640" height="360" src="/tone.wav" loop muted playsinline
           style="display:block"></video>
    <div id="bar" style="height:32px;background:#222;display:flex;align-items:center">
      <button id="fsbtn" style="height:24px">ملء الشاشة</button>
      <button style="height:24px">زرٌّ آخر</button>
    </div>
  </div>
  <script>
    document.getElementById("fsbtn").addEventListener("click", () => {
      document.getElementById("player").requestFullscreen();
    });
  <\/script>
</body>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const IDLE_MS = 1000;

const SETTINGS = {
  settings: {
    enabled: true,
    idle: { ms: IDLE_MS },
    overlay: {
      autoHideMs: 900, volumeAutoHideMs: 900, enabled: true, hintEnabled: true,
      // **#70 وحده** — الزرّ مطفأ كي يُقاس مستهلكٌ واحد لا اثنان
      speedBadge: false, hideProgressBar: !LOCAL, speedButton: LOCAL
    },
    zones: { enabled: true, fullscreenOnly: false }
  },
  // **ربط المالك نفسه**: الزرّ الأوسط ⇒ ملء الشاشة
  globalSiteRules: { enabled: true, mappings: [{ from: "Mouse2", to: "ACTION:TOGGLE_FULLSCREEN" }] }
};

// ── حالة المحرّك تُقرأ من عالمه هو — **لا من أثرٍ في الصفحة** ────────────────
// المتغيّرات `let` في أعلى سكربت المحتوى تعيش في **النطاق المعجميّ لعالمه**،
// فتُقرأ بتقييمٍ **داخل ذلك السياق** لا في عالم الصفحة (درس `vm.runInContext`).
const ENGINE = `(() => {
  const tgt = ${LOCAL ? 'document.querySelector(".vzSpeedBtn")' : 'document.querySelector(".ytp-chrome-bottom")'};
  const cs = tgt ? getComputedStyle(tgt) : null;
  const r = tgt ? tgt.getBoundingClientRect() : null;
  let held = null, state = null, at = null, armed = null, ptr = null, wanted = null, inside = null;
  try { held = idlePointerHeld; } catch {}
  try { state = idleState; } catch {}
  try { at = idleLastActivityAt; } catch {}
  try { armed = idleTimer != null; } catch {}
  try { ptr = { x: lastPointer.x, y: lastPointer.y }; } catch {}
  try { wanted = idleWanted; } catch {}
  try { inside = pointerInsideEl(tgt); } catch {}
  return {
    fsElement: document.fullscreenElement
      ? (document.fullscreenElement.id || document.fullscreenElement.tagName) : null,
    active: document.activeElement
      ? (document.activeElement.tagName + "." + String(document.activeElement.className || "").split(/\\s+/).slice(0,2).join(".")).slice(0, 50)
      : null,
    ourClass: ${LOCAL
      ? '!!tgt && tgt.classList.contains("vzHidden")'
      : '!!tgt?.classList.contains("vz-idle-hide-progress")'},
    targetExists: !!tgt,
    barOpacity: cs ? cs.opacity : null,
    barRect: r ? { w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top) } : null,
    idlePointerHeld: held, idleState: state, activityAt: at, timerArmed: armed,
    lastPointer: ptr, idleWanted: wanted, pointerInsideTarget: inside
  };
})()`;

async function sampleSeries(page, world, label) {
  const out = [];
  for (const wait of [300, 1200, 1500]) {
    await sleep(wait);
    out.push({ t: label + "+" + wait, ...(await evalIn(page, ENGINE, world)) });
  }
  return out;
}

async function run() {
  const out = { paths: {}, local: LOCAL };
  let h = null, page = null, server = null;
  try {
    if (LOCAL) { const srv = await serveTestPage(HTTP, LOCAL_PAGE); server = srv.srv; out.localUrl = srv.url; }
    h = await launch(PORT, { extra: ["--window-size=1440,900"] });
    out.chrome = h.chrome;
    const cfg = await configure(PORT, h.extensionId, SETTINGS);
    if (!cfg.ok) { out.why = "تعذّر ضبط التخزين"; return out; }
    page = await openPage(PORT, LOCAL ? out.localUrl : WATCH);
    await sleep(7000);
    const world = (await contentWorld(page))?.id;
    out.world = world != null;
    if (!world) { out.why = "لا عالم معزول — الإضافة لا تعمل"; return out; }

    // **استطلاعٌ بدل مهلة** (قرار 50) + **مستطيلٌ غير صفريّ شرطٌ** (قرار 22)
    let vr = null;
    for (let i = 0; i < 25 && !vr; i++) {
      vr = await evalIn(page, `(() => { const v = document.querySelector("video");
        if (!v) return null; const r = v.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return null;
        return { x: Math.round(r.left), y: Math.round(r.top),
                 w: Math.round(r.width), h: Math.round(r.height) }; })()`);
      if (!vr) await sleep(500);
    }
    out.videoRect = vr;
    if (!vr) {
      // **«لم أجد» بلا سببٍ منشور تُقرأ نفياً** — فيُطبع ما رآه المِجَسّ
      out.diag = await evalIn(page, `({ title: document.title.slice(0,60),
        ready: document.readyState, videos: document.querySelectorAll("video").length,
        players: document.querySelectorAll("#movie_player").length,
        rects: [...document.querySelectorAll("video")].map((v) => { const r = v.getBoundingClientRect();
          return [Math.round(r.width), Math.round(r.height)]; }),
        head: (document.body?.innerText || "").trim().replace(/\\s+/g," ").slice(0,120) })`);
      out.why = "لا فيديو بمستطيلٍ غير صفريّ بعد الانتظار — لا يُقاس";
      return out;
    }

    // ── (أ) المسار العامل: زرّ المشغّل نفسه ──────────────────────────────────
    // تحريكٌ موثوق أوّلاً كي يظهر الشريط ويصير للزرّ مستطيل
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: vr.x + vr.w / 2, y: vr.y + vr.h * 0.9 });
    await sleep(700);
    const BTN_SEL = LOCAL ? "#fsbtn" : ".ytp-fullscreen-button";
    const btn = await evalIn(page, `(() => { const b = document.querySelector(${JSON.stringify(LOCAL ? "#fsbtn" : ".ytp-fullscreen-button")});
      if (!b) return null; const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    out.fsButton = btn;
    await page.send("Runtime.evaluate", {
      expression: `document.querySelector(${JSON.stringify(LOCAL ? "#fsbtn" : ".ytp-fullscreen-button")}).click()`,
      userGesture: true, returnByValue: true
    });
    out.paths.hostButton = await sampleSeries(page, world, "زرّ المضيف");

    // خروجٌ وإعادة تهيئة
    await page.send("Runtime.evaluate", { expression: `document.exitFullscreen?.()`,
      userGesture: true, returnByValue: true, awaitPromise: true });
    await sleep(1500);

    // ── (ب) المسار العاطل: أمرُنا — الزرّ الأوسط على إطار الفيديو ────────────
    // **حدثٌ موثوق** بالزرّ الأوسط: `buttons: 4` هو الأوسط في CDP.
    const cx = Math.round(vr.x + vr.w / 2), cy = Math.round(vr.y + vr.h / 2);
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy });
    await sleep(150);
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy,
      button: "middle", buttons: 4, clickCount: 1 });
    await sleep(60);
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy,
      button: "middle", buttons: 0, clickCount: 1 });
    await sleep(500);
    out.afterMiddle = await evalIn(page, ENGINE, world);

    // ⚠️ **الإيماءة**: نقرةٌ من `Input` قد لا تُحتسب إيماءةً (مقيسٌ في
    // `repro-58-fullscreen.mjs`) — **فيُقاس أوّلاً بالمسار الحقيقيّ**، وإن لم
    // يدخل ملء الشاشة **يُعلَن** ويُعاد بأمرٍ تحت إيماءة، **ولا يُخلط الحالان**.
    if (!out.afterMiddle?.fsElement) {
      out.gestureFallback = true;
      await page.send("Runtime.evaluate", {
        expression: `runAction("ACTION:TOGGLE_FULLSCREEN", { __videoUnderPointer: document.querySelector("video") })`,
        userGesture: true, returnByValue: true, contextId: world
      });
    }
    out.paths.ourCommand = await sampleSeries(page, world, "أمرُنا");

    // ── (ج) **الترتيب الذي لا ينتجه المسار الأوّل**: مِداوْن ⇒ ملء شاشة ⇒ إفلات ──
    // ⚠️ **وهو الشكل الحقيقيّ عند المالك**: نقلةُ ملء الشاشة تقع **داخل معالج
    // المِداوْن**، فالإفلات يقع **بعد** تبدّل التخطيط. **والفرضية (٣) تُقاس هنا
    // وحدها**: أيصل الإفلات فيفكّ `idlePointerHeld`، أم يضيع فيبقى الامتناع عالقاً؟
    await page.send("Runtime.evaluate", { expression: `document.exitFullscreen?.()`,
      userGesture: true, returnByValue: true, awaitPromise: true });
    await sleep(1500);
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx, y: cy });
    await sleep(150);
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy,
      button: "middle", buttons: 4, clickCount: 1 });
    await sleep(80);
    // **بلا إفلاتٍ بعد** — ندخل ملء الشاشة والزرّ ممسوك
    await page.send("Runtime.evaluate", {
      expression: `runAction("ACTION:TOGGLE_FULLSCREEN", { __videoUnderPointer: document.querySelector("video") })`,
      userGesture: true, returnByValue: true, contextId: world
    });
    await sleep(400);
    out.heldAtFs = await evalIn(page, ENGINE, world);
    // **ثمّ الإفلات، بعد التبدّل**
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy,
      button: "middle", buttons: 0, clickCount: 1 });
    out.paths.heldThenRelease = await sampleSeries(page, world, "ممسوكٌ ثمّ أُفلت");
    return out;
  } catch (e) {
    out.why = String(e?.message || e).slice(0, 160);
    return out;
  } finally {
    try { page?.ws?.close(); } catch {}
    killChrome(h);
    try { server?.close(); } catch {}
    await waitPortFree(PORT);
  }
}

const out = await run();
if (AS_JSON) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

const yn = (b) => (b === null || b === undefined ? "—" : b ? "نعم" : "لا");
console.log("\n=== قياس #86 — مسارا ملء الشاشة جنباً إلى جنب ===");
console.log(`   كروم: ${out.chrome || "—"} · العالم المعزول: ${out.world ? "✅" : "❌"}` +
  ` · مستطيل الفيديو: ${JSON.stringify(out.videoRect)}`);
if (out.why) console.log(`   ⚠️ ${out.why}`);
if (out.diag) console.log(`   تشخيص: ${JSON.stringify(out.diag)}`);
if (out.afterMiddle) {
  console.log(`\n   بعد الزرّ الأوسط مباشرةً: ملء الشاشة=${out.afterMiddle.fsElement || "لا"}` +
    ` · ممسوك=${yn(out.afterMiddle.idlePointerHeld)}`);
}
if (out.gestureFallback) {
  console.log("   ⚠️ **الزرّ الأوسط لم يُدخل ملء الشاشة** (الإيماءة لا تُحتسب من `Input`)" +
    " ⇒ أُعيد الأمرُ نفسُه تحت إيماءة، **والحالُ مُعلَنة لا مخلوطة**.");
}

for (const [key, label] of [["hostButton", "المسار العامل — زرّ المشغّل"],
                            ["ourCommand", "أمرُنا (Mouse2) — الإفلات قبل الدخول"],
                            ["heldThenRelease", "⭐ ممسوكٌ عند الدخول ثمّ أُفلت — ترتيب المالك"]]) {
  console.log(`\n── ${label}`);
  for (const s of out.paths[key] || []) {
    console.log(`   ${s.t.padEnd(16)} ملء الشاشة=${String(s.fsElement || "لا").padEnd(12)}` +
      ` صنفُنا=${yn(s.ourClass).padEnd(3)} شفافية=${String(s.barOpacity).padEnd(4)}` +
      ` حالة=${String(s.idleState).padEnd(6)} نشاطٌ عند=${s.activityAt ? "موجب" : String(s.activityAt)}` +
      ` مؤقّت=${yn(s.timerArmed).padEnd(3)} ممسوك=${yn(s.idlePointerHeld).padEnd(3)}` +
      ` مؤشّرٌ على الهدف=${yn(s.pointerInsideTarget).padEnd(3)}`);
    console.log(`   ${"".padEnd(16)} تركيز=${s.active || "—"} · مؤشّر=${JSON.stringify(s.lastPointer)}` +
      ` · شريط=${JSON.stringify(s.barRect)}`);
  }
}

const last = (k) => (out.paths[k] || []).slice(-1)[0];
const A = last("hostButton"), B = last("ourCommand");
const posOk = !!A?.ourClass;                 // الأداة ترى الإخفاء حيث يقع
const bugSeen = !!(B && !B.ourClass);        // ولا تراه حيث يشتكي المالك
console.log("\n── الشاهدان والحكم");
console.log(`   الموجب : ${posOk ? "✅ الأداة ترى الإخفاء في المسار العامل" : "❌ **ساقط** — لا حكم يُبنى"}`);
console.log(`   العَرَض : ${bugSeen ? "✅ مُستنسَخ — لا إخفاء في مسار أمرِنا" : "⚠️ لم يُستنسَخ في الرِكاز"}`);
if (posOk && bugSeen && B) {
  const why = B.activityAt === 0 ? "(١) **نشاطٌ لم يُسجَّل** — `idleLastActivityAt = 0`"
    : B.idlePointerHeld ? "(٣) **امتناعٌ عالق: زرٌّ ممسوك لم يُفلت**"
    : B.pointerInsideTarget ? "(٤) **امتناعٌ: المؤشّر على الهدف** (#95)"
    : !B.timerArmed ? "(٢) **مؤقّتٌ لم يُسلَّح** رغم تسجيل النشاط"
    : "**لا واحدة من الأربع** — الحالة تقول إن الإخفاء كان يجب أن يقع";
  console.log(`   ⇒ الجذر بالبصمة: ${why}`);
}
console.log("");
process.exit(posOk ? 0 : 1);
