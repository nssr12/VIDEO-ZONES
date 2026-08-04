// قياس ما يبلغه الرِكاز من `S2`–`S5` — **فما بلغتُه لا يُطلب من المالك** (قسمة §17).
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// ثلاثةٌ من أسئلته الأربعة تُفتح على يوتيوب حيّ وقد يردّ بصفحة /sorry فيسقط
//   القياس كلُّه — و«‎--only s4» وحده هو المحليّ فيه.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«الجودةُ التي اخترتها، والمربّعاتُ
// في وضع «ملء الشاشة فقط»، وتحويلُ Shorts — أتعمل كما وُعدت، أم أنّ ما بيننا
// وبين المتصفّح يبتلعها صامتةً؟»*
//
//   node tools/bench-s2345.mjs            # الأربعة
//   node tools/bench-s2345.mjs --only s4  # واحدٌ بعينه (وS4 محليٌّ بلا مضيف)
//
// ── ما يبلغه الرِكاز وما لا يبلغه — **مُعلَنٌ لكلٍّ، ولا يُخلط** ─────────────
// · **`S2`** عبورُ `detail` من العالم المعزول إلى الرئيسيّ. **يُقاس بأثرٍ لا
//   بقراءة:** أتتغيّر جودةُ المشغّل فعلاً؟ **وأتبقى بعد نصف دقيقة؟** (عيّنتان).
// · **`S3`** ترتيبُ `getAvailableQualityLevels()` من الأعلى للأدنى — **يُقرأ من
//   مشغّلٍ حيّ**. وتُنتَج حالُ «المطلوبة غير متاحة» بطلب جودةٍ **فوق** أقصى
//   المتاح، **فتُقرأ الجودةُ التي وقعت والفجوةُ برقمَيها من دالّتنا**.
//   ⚠️ **ولا يُقاس عرضُ السطر في نافذة الإضافة — ذاك للمالك.**
// · **`S4`** محليٌّ بالكامل ولا مضيفَ فيه: **الشكّ عن دلالة المتصفّح لا عن
//   يوتيوب**. تُملأ الشاشةُ بعنصر `iframe` من الأب، **ثمّ يُقرأ الابن**.
// · **`S5`** التحميلُ المباشر ورجوعُه **يُقاسان**. ⚠️ **وتنقّلُ SPA من الخلاصة
//   لا يبلغه الرِكاز بلا تسجيل دخول** — يُعلَن ولا يُبتلع.
//
// ── شاهدا قرار 26 ───────────────────────────────────────────────────────────
// · **موجب:** لكلّ سؤالٍ حالٌ **تُنتَج** ونتيجتُها معلومةٌ سلفاً — ملءُ شاشةٍ
//   يقع فعلاً (يُتحقَّق من الأب) · وجودةٌ **تتغيّر** حين تُطلب متاحةً.
// · **سالب:** ونظيرتُها بلا الشرط — بلا ملء شاشة · وبلا طلب جودة.
// **ولا يُقرأ رقمٌ من سؤالٍ سقط شاهدُه**، ويُطبع «لم يُقس» لا صفر.
import { launch, openPage, evalIn, configure, serveTestPage, killChrome, waitPortFree, connect, contentWorld }
  from "./ext-harness.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ONLY = (process.argv.find((a, i) => process.argv[i - 1] === "--only") || "").toLowerCase();
const want = (k) => !ONLY || ONLY === k;

const WATCH = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const SHORTS_ID = "aqz-KE-bpKQ";
const out = { s2: {}, s3: {}, s4: {}, s5: {} };

// ── صفحةُ `S4`: أبٌ فيه `iframe` من الأصل نفسِه، وفيه فيديو ────────────────
// **الزرّ ضرورةٌ لا زينة:** `requestFullscreen` يشترط إيماءةً موثوقة، وبلاها
// يُرفض الطلب **فيُقرأ رفضُ المتصفّح «الابن لا يرى ملء الشاشة»** — وهو الشاهد
// الرابع بعينه (نفيٌ ببصرٍ غير مُثبَت).
const S4_PARENT = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<button id="go" style="font:16px system-ui;padding:10px">املأ الشاشة بالإطار</button>
<iframe id="fr" width="640" height="360" style="border:0" src="/child"></iframe>
<script>
document.getElementById("go").addEventListener("click", () => {
  document.getElementById("fr").requestFullscreen().then(
    () => { window.__fsOk = true; }, (e) => { window.__fsErr = String(e && e.message || e); });
});
</script></body>`;
const S4_CHILD = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">
<video id="v" width="640" height="360" src="/tone.wav" loop muted playsinline style="display:block"></video>
</body>`;

// المُخبِر عن حال المشغّل — **من العالم الرئيسيّ**، فواجهةُ يوتيوب هناك
const PLAYER = `(() => { const p = document.querySelector("#movie_player");
  const v = document.querySelector("video");
  return { qbFlag: !!window.__vzQB, hasApi: !!(p && typeof p.getAvailableQualityLevels === "function"),
           levels: (p && typeof p.getAvailableQualityLevels === "function")
             ? (p.getAvailableQualityLevels() || []) : null,
           current: (p && typeof p.getPlaybackQuality === "function") ? p.getPlaybackQuality() : null,
           h: v ? v.videoHeight : null, t: v ? Math.round(v.currentTime) : null }; })()`;

// ⚠️ **الفجوة تُقرأ من دالّتنا لا من تخميننا** (قرار 48): `ytQualityGap()` هي
// نفسُها التي تُغذّي نافذة الإضافة — فما تُرجعه هو ما سيراه المالك.
const OUR_GAP = `(typeof ytQualityGap === "function" ? JSON.stringify(ytQualityGap()) : "لا دالّة")`;

const CFG = (q) => ({
  globalSiteRules: { enabled: true, mappings: [] },
  settings: { enabled: true, blockedHosts: [], ytAutoQuality: q, ytShortsRedirect: true,
              zones: { enabled: true, fullscreenOnly: false, gridCoverage: "player",
                       wheel: { map: { "4": { up: ["ACTION:VOLUME:+5"], down: ["ACTION:VOLUME:-5"] } } } } }
});

async function blockedByHost(page) {
  return await evalIn(page, `location.href.includes("/sorry/") ||
    /unusual traffic|حركة مرور غير معتادة/.test(document.body ? document.body.innerText : "")`);
}

// ── S2 + S3 — سؤالان على صفحةٍ واحدة، فلا تشغيلتان على المضيف ───────────────
async function runS2S3(port) {
  let h = null, page = null;
  try {
    // ⭐ **الطلبُ فوق أقصى المتاح عمداً** — فيُنتج حالَ «غير متاحة» بلا فيديو
    // خاصّ: 8K لا يملكها إلا النادر، والاحتياطيّ يقع فيُقرأ رقماه.
    h = await launch(port, { extra: ["--window-size=1280,900"] });
    const cfg = await configure(port, h.extensionId, CFG("hd4320"));
    if (!cfg.ok) { out.s2.why = "تعذّر ضبط التخزين"; return; }
    page = await openPage(port, WATCH);
    await sleep(9000);
    if (await blockedByHost(page)) {
      out.s2.why = out.s3.why = "**المضيف حجب الآليّ** (صفحة /sorry) — لا قياس من هذا العنوان";
      return;
    }
    const w = await contentWorld(page);
    out.s2.world = !!w;
    const p1 = await evalIn(page, PLAYER);
    out.s3.levels = p1?.levels || null;
    out.s3.hasApi = !!p1?.hasApi;
    out.s2.qbFlag = !!p1?.qbFlag;
    // ⛔ **لا عالمَ ⇒ لا قياس، ويُعلَن** (درس #94 · `test-probe-world.js`)
    out.s3.ourGap = w ? await evalIn(page, OUR_GAP, w.id) : "لا عالم";
    out.s3.applied = p1?.current ?? null;

    // ── S2: الشاهدُ الموجب — جودةٌ **متاحة** تُطلب فتقع ──────────────────────
    // ولا يُقاس العبور بجودةٍ غير متاحة: سقوطُها يحتمل «لم يعبر» و«غير متاحة».
    const avail = (p1?.levels || []).filter((x) => x !== "auto");
    const target = avail.includes("hd720") ? "hd720" : avail[avail.length - 1];
    out.s2.target = target;
    if (target) {
      await configure(port, h.extensionId, CFG(target));
      // إعادةُ الطلب تمرّ بمسار المنتَج نفسه — تغيّرُ التخزين يُطلق قراءةً
      await sleep(2500);
      if (w) await evalIn(page, `(typeof triggerYtQuality === "function"
        ? (ytQualityAttemptKey = null, triggerYtQuality(), "طُلب") : "لا دالّة")`, w.id);
      await sleep(6000);
      out.s2.a = await evalIn(page, PLAYER);
      // ⚠️ **«وبقيت بعد نصف دقيقة»** — العيّنة الثانية هي نصفُ السؤال لا زينة
      await sleep(32000);
      out.s2.b = await evalIn(page, PLAYER);
    }
  } catch (e) { out.s2.why = out.s2.why || String(e?.message || e).slice(0, 90); }
  finally { try { page?.ws?.close(); } catch {} killChrome(h); await waitPortFree(port); }
}

// ── S4 — محليٌّ بالكامل: أيرى الابنُ ملءَ الشاشة الذي أوقعه الأب؟ ───────────
async function runS4(port) {
  let h = null, page = null, srv = null;
  try {
    const s = await serveTestPage(port + 700, S4_PARENT);
    srv = s.srv;
    // الخادم يردّ الأبَ لكل مسار عدا `/child` و`/tone.wav` — فيُبنى ابنٌ مستقلّ
    srv.removeAllListeners("request");
    srv.on("request", (q, res) => {
      if (q.url.startsWith("/tone.wav")) { res.writeHead(302, { location: "/tone-real.wav" }); return res.end(); }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(q.url.startsWith("/child") ? S4_CHILD : S4_PARENT);
    });
    h = await launch(port, { extra: ["--window-size=1200,800"] });
    const cfg = await configure(port, h.extensionId, {
      globalSiteRules: { enabled: true, mappings: [] },
      settings: { enabled: true, blockedHosts: [],
                  zones: { enabled: true, fullscreenOnly: true, gridCoverage: "player",
                           wheel: { map: { "4": { up: ["ACTION:VOLUME:+5"], down: ["ACTION:VOLUME:-5"] } } } } }
    });
    out.s4.configured = !!cfg.ok;
    page = await openPage(port, s.url);
    await sleep(2500);

    // **الشاهد السالب أوّلاً: بلا ملء شاشة** — فيُعلم أن ما بعده أثرُ الملء
    out.s4.before = await evalIn(page, `(() => { const f = document.getElementById("fr");
      return { parentFs: !!document.fullscreenElement,
               childFs: !!(f.contentDocument && f.contentDocument.fullscreenElement) }; })()`);

    const b = await evalIn(page, `(() => { const r = document.getElementById("go").getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: b.x, y: b.y });
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: b.x, y: b.y, button: "left", clickCount: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", clickCount: 1 });
    await sleep(1800);

    out.s4.after = await evalIn(page, `(() => { const f = document.getElementById("fr");
      const cd = f.contentDocument;
      return { fsOk: !!window.__fsOk, fsErr: window.__fsErr || null,
               parentFs: !!document.fullscreenElement,
               parentFsTag: document.fullscreenElement ? document.fullscreenElement.tagName : null,
               childFs: !!(cd && cd.fullscreenElement),
               childHasVideo: !!(cd && cd.querySelector("video")) }; })()`);
  } catch (e) { out.s4.why = String(e?.message || e).slice(0, 90); }
  finally { try { page?.ws?.close(); } catch {} killChrome(h); try { srv?.close(); } catch {} await waitPortFree(port); }
}

// ── S5 — التحميلُ المباشر ورجوعُه ──────────────────────────────────────────
async function runS5(port) {
  let h = null, page = null;
  try {
    h = await launch(port, { extra: ["--window-size=1200,800"] });
    const cfg = await configure(port, h.extensionId, CFG(""));
    if (!cfg.ok) { out.s5.why = "تعذّر ضبط التخزين"; return; }
    page = await openPage(port, "https://www.youtube.com/");
    await sleep(6000);
    if (await blockedByHost(page)) { out.s5.why = "**المضيف حجب الآليّ** (صفحة /sorry)"; return; }
    out.s5.startedAt = await evalIn(page, `location.pathname`);
    // تحميلٌ مباشر لِـ`/shorts/` — والمقصود: أيُعاد الكتابة، وأين يذهب الرجوع
    await page.send("Page.navigate", { url: `https://www.youtube.com/shorts/${SHORTS_ID}` });
    await sleep(7000);
    out.s5.afterDirect = await evalIn(page, `location.pathname + location.search`);
    out.s5.histLen = await evalIn(page, `history.length`);
    await evalIn(page, `(history.back(), true)`);
    await sleep(5000);
    out.s5.afterBack = await evalIn(page, `location.pathname + location.search`);
  } catch (e) { out.s5.why = String(e?.message || e).slice(0, 90); }
  finally { try { page?.ws?.close(); } catch {} killChrome(h); await waitPortFree(port); }
}

// ⚠️ **`S2` و`S3` يُقاسان في تشغيلةٍ واحدة، فيُطبعان معاً.** طباعةُ أحدهما
// وحده تُخفي رقماً **قِيس فعلاً**، وتدفع إلى تشغيلةٍ ثانية على المضيف بلا حاجة.
let ranPair = false;
if (want("s4")) { process.stdout.write("⏳ S4 (محليّ) … "); await runS4(9941); console.log("تمّ"); }
if (want("s2") || want("s3")) {
  process.stdout.write("⏳ S2+S3 (يوتيوب) … "); await runS2S3(9943); ranPair = true; console.log("تمّ");
}
if (want("s5")) { process.stdout.write("⏳ S5 (يوتيوب) … "); await runS5(9945); console.log("تمّ"); }

const yn = (b) => (b ? "نعم" : "لا");
console.log("\n=== ما بلغه الرِكاز من S2–S5 ===");

if (want("s4")) {
  const a = out.s4.after || {}, b0 = out.s4.before || {};
  console.log(`\n── S4 · «ملء الشاشة فقط» داخل إطار — **محليّ، ولا يوتيوب فيه**`);
  if (out.s4.why) console.log(`   ⚠️ ${out.s4.why}`);
  console.log(`   الشاهد السالب (قبل): الأب=${yn(b0.parentFs)} · الابن=${yn(b0.childFs)}`);
  console.log(`   الشاهد الموجب     : وقع ملء الشاشة=${yn(a.fsOk)}${a.fsErr ? ` (رفضٌ: ${a.fsErr})` : ""}` +
    ` · عنصرُ الأب=${a.parentFsTag}`);
  if (!a.fsOk) console.log(`   ⛔ **لم يُقس** — بلا ملء شاشةٍ واقع لا يُقرأ من الابن شيء`);
  else console.log(`   ⇒ **في الابن: \`document.fullscreenElement\` = ${a.childFs ? "عنصر" : "**null**"}**` +
    ` · وفيه فيديو=${yn(a.childHasVideo)}`);
}

if (ranPair) {
  console.log(`\n── S3 · أمرتَّبةٌ \`getAvailableQualityLevels()\` من الأعلى للأدنى؟`);
  if (out.s3.why) console.log(`   ⚠️ ${out.s3.why}`);
  else {
    const L = (out.s3.levels || []).filter((x) => x !== "auto");
    const RANK = ["hd4320", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"];
    const idx = L.map((x) => RANK.indexOf(x));
    const desc = idx.every((v, i) => i === 0 || (v > idx[i - 1] && v !== -1));
    console.log(`   المقروء: ${JSON.stringify(out.s3.levels)}`);
    console.log(`   ⇒ ${L.length ? (desc ? "**مرتّبةٌ تنازلياً** — فالافتراض صحيحٌ في هذي العيّنة"
      : "❌ **غير مرتّبة تنازلياً** — والافتراض يسقط") : "⛔ **لم يُقس** — قائمةٌ فارغة"}`);
    console.log(`   وطُلبت \`hd4320\` (فوق المتاح): ما وقع=${JSON.stringify(out.s3.applied)}` +
      ` · وفجوتُنا بدالّتنا=${out.s3.ourGap}`);
    console.log(`   ⚠️ **وعرضُ السطر في نافذة الإضافة لم يُقس — للمالك.**`);
  }
}

if (ranPair) {
  console.log(`\n── S2 · أيعبر \`detail\` من العالم المعزول إلى الرئيسيّ؟ (بالأثر لا بالقراءة)`);
  if (out.s2.why) console.log(`   ⚠️ ${out.s2.why}`);
  else {
    const a = out.s2.a || {}, b = out.s2.b || {};
    console.log(`   جسرُنا في العالم الرئيسيّ \`__vzQB\`=${yn(out.s2.qbFlag)} · وطُلبت \`${out.s2.target}\``);
    console.log(`   بعد ~6ث   : يُعلن=${JSON.stringify(a.current)} · videoHeight=${a.h} · t=${a.t}ث`);
    console.log(`   وبعد ~38ث : يُعلن=${JSON.stringify(b.current)} · videoHeight=${b.h} · t=${b.t}ث`);
    const held = a.current && b.current && a.current === b.current;
    console.log(`   ⇒ ${a.current === out.s2.target
      ? `**وقعت المطلوبة** ⇒ \`detail\` عبر كائناً — و${held ? "**بقيت** بعد نصف دقيقة" : "**لم تبقَ**"}`
      : `**لم تقع المطلوبة** (${JSON.stringify(a.current)}) — ولا يُقرأ منها نفيُ العبور وحدَه`}`);
  }
}

if (want("s5")) {
  console.log(`\n── S5 · Shorts — التحميلُ المباشر ورجوعُه`);
  if (out.s5.why) console.log(`   ⚠️ ${out.s5.why}`);
  else {
    console.log(`   بدأ من: ${out.s5.startedAt} · ثمّ /shorts/${SHORTS_ID}`);
    console.log(`   بعد التحميل المباشر: ${out.s5.afterDirect} (history.length=${out.s5.histLen})`);
    console.log(`   وبعد «رجوع»       : ${out.s5.afterBack}`);
    console.log(`   ⇒ ${String(out.s5.afterDirect).startsWith("/watch")
      ? "**أُعيدت الكتابة إلى المشغّل العادي**" : "❌ لم تُعَد الكتابة"}`);
  }
  console.log(`   ⛔ **وتنقّلُ SPA من الخلاصة لم يُقس** — يحتاج خلاصةً بتسجيل دخول، **وهو للمالك**.`);
}
console.log("");
