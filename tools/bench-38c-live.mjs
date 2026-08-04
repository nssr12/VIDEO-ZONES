// #38ج — إعادة التشخيص على **الإضافة الحقيقية** (لا محاكاتها).
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// يستخرج رابط الفيديو حيّاً من نتائج بحث يوتيوب فيقيس كل تشغيلةٍ فيديو آخر —
//   ورابطٌ متبدّل لا يصلح بوّابةَ التزام.
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**
//   node tools/bench-38c-live.mjs            # رابط يُستخرج حيّاً
//   node tools/bench-38c-live.mjs "https://…"
//
// يبني على `tools/ext-harness.mjs` — الوحدة التي تحمّل الإضافة بـ
// `Extensions.loadUnpacked` **وتثبت بشاهدين أنها تراها عاملةً**، بعد أن تبيّن أن
// `--load-extension` لا يُحمّل شيئاً في Chrome 150 (`AUDIT.md` القسم 24).
//
// ── ما يُقاس ────────────────────────────────────────────────────────────────
// **الفرضية الثانية أولاً (ترتيب المالك):** هل `content.js` حاضر في الصفحة
// **قبل** ضغط الزرّ، أم غير محقون البتّة؟ ومنه مباشرةً: **هل يقع نداء
// `triggerYtQuality` بعد الضغط أصلاً**، أم لا بدء جديد فلا نداء؟
//
// **والسيناريو يُعاد إنتاجه كما وقع للمالك:** الصفحة تُفتح **قبل** أن تُحمَّل
// الإضافة — وهو الحال الوحيد الذي يوجد فيه زرّ «تفعيل يدوي» أصلاً، إذ المانيفست
// يحقن `content.js` على كل رابط عند التحميل. **ولا تُعاد تحميل الصفحة**، لأن
// إعادة التحميل هي بالضبط ما قال المالك إنه يُنجح الجودة.
//
// ── الشواهد (قرار 26) ───────────────────────────────────────────────────────
//  · **موجب:** تشغيلة يُحمَّل فيها كل شيء **بالترتيب الطبيعي** (الإضافة ثم
//    الصفحة) ⇒ **يجب** أن يُرصد `__vz_setq__` وأن يردّ `__vz_setq_done__`.
//    لم يُرصد ⇒ الأداة عمياء ⇒ **«لم يُقس»**، ولا حكم على المسار اليدوي.
//  · **سالب:** صفحة **غير يوتيوب** والإضافة محمَّلة ⇒ لا `__vzQB` ولا أي حدث.
//  · **والمِجَسّ يُركَّب قبل الضغط**: مستمعان في عالم الصفحة يلتقطان
//    `__vz_setq__` (ما يرسله `content.js`) و`__vz_setq_done__` (ما يردّ به
//    سكربت العالم الرئيسي) — فيُفصل «لم يُرسَل» عن «أُرسل ولم يُردّ عليه».
import { launch, connect, openPage, configure, contentWorld, evalIn, EXT_NAME, killChrome }
  from "./ext-harness.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WANT = "hd1080";

// مِجَسّ عالم الصفحة — يُركَّب **قبل** أي ضغط، ويسجّل الحدثين بأوقاتهما.
const PROBE = `(() => {
  if (window.__vzProbe) return "قائم";
  window.__vzProbe = { t0: Date.now(), sent: [], done: [] };
  window.addEventListener("__vz_setq__", (e) =>
    window.__vzProbe.sent.push({ at: Date.now() - window.__vzProbe.t0, q: e && e.detail && e.detail.q }));
  window.addEventListener("__vz_setq_done__", (e) =>
    window.__vzProbe.done.push({ at: Date.now() - window.__vzProbe.t0, d: e && e.detail }));
  return "رُكِّب";
})()`;

const READ_PROBE = `window.__vzProbe ? { sent: window.__vzProbe.sent, done: window.__vzProbe.done } : null`;

// ⚠️ **عيب رِكاز أُسقط قبل أن يُنشر رقمه (2026-07-31):** كان المِجَسّ يُركَّب فور
// فتح التبويب، فيقع على مستند **ما قبل التنقّل** ثم يُمحى معه — فقرأت الأذرع
// الثلاث كلها `—`. **و«لا حدث» و«لا مِجَسّ» يطبعان الشيء نفسه.**
// فصار يُنتظر استقرار المستند على الرابط المقصود، **ثم يُركَّب، ثم يُقرأ فوراً
// للتحقّق من بقائه** — وإن لم يبقَ **يُعلَن** ولا يُقرأ صمته نتيجةً.
async function installProbe(page, wantHost) {
  for (let i = 0; i < 40; i++) {
    const here = await evalIn(page, `[location.href, document.readyState]`);
    if (Array.isArray(here) && here[0] && !here[0].startsWith("about:") &&
        (!wantHost || here[0].includes(wantHost)) && here[1] !== "loading") {
      await evalIn(page, PROBE);
      const back = await evalIn(page, `!!window.__vzProbe`);
      if (back === true) return { ok: true, at: here[0].slice(0, 60) };
    }
    await sleep(500);
  }
  return { ok: false, why: "لم يستقرّ المستند أو لم يبقَ المِجَسّ" };
}

const PLAYER = `(() => {
  const p = document.querySelector("#movie_player");
  return {
    vzQB: !!window.__vzQB,
    player: !!p,
    api: !!(p && typeof p.getAvailableQualityLevels === "function"),
    ad: !!(p && (p.classList.contains("ad-showing") || p.classList.contains("ad-interrupting"))),
    levels: p && typeof p.getAvailableQualityLevels === "function" ? p.getAvailableQualityLevels() : [],
    current: p && typeof p.getPlaybackQuality === "function" ? p.getPlaybackQuality() : null
  };
})()`;

// **الضغط نفسه، من داخل الإضافة**: نفس نداءات `activateOnCurrentPage` بترتيبها،
// **وتُقرأ نتيجة كل نداء** لا تُفترض (الفرضية الأولى).
const PRESS = `(async () => {
  const out = {};
  const tabs = await chrome.tabs.query({ url: "*://*.youtube.com/*" });
  const tab = tabs[0];
  if (!tab) return { error: "لا تبويب يوتيوب" };
  out.tabId = tab.id; out.url = (tab.url || "").slice(0, 60);
  try {
    out.mainResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["yt_quality_main.js"], world: "MAIN"
    });
  } catch (e) { out.mainError = String(e && e.message || e).slice(0, 160); }
  try {
    out.contentResult = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["content.js"]
    });
  } catch (e) { out.contentError = String(e && e.message || e).slice(0, 160); }
  // الإيقاظ جزء من الضغطة، فلا يُحذف من النسخة: أول تشغيلة بعد إضافته إلى
  // popup.js لم تُرسله هنا، فقاست الأداة الضغطة القديمة وطبعت «لم يقع» عن كود
  // لم يُنفَّذ أصلاً. نسخةٌ تتخلّف عن أصلها تقيس الماضي.
  // (ولا علامات اقتباس خلفية في هذا التعليق: هو داخل قالب نصّي فتُنهيه.)
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "GVZ_ACTIVATED" });
    out.wake = "أُرسلت";
  } catch (e) { out.wakeError = String(e && e.message || e).slice(0, 120); }
  return out;
})()`;

async function swClient(port, extensionId) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const sw = targets.find((t) => t.type === "service_worker" &&
    (t.url || "").startsWith(`chrome-extension://${extensionId}/`));
  if (!sw) return null;
  const c = await connect(sw.webSocketDebuggerUrl);
  await c.send("Runtime.enable");
  return c;
}

async function waitPlayer(page) {
  for (let i = 0; i < 80; i++) {
    const p = await evalIn(page, PLAYER);
    if (p?.player && p.api && !p.ad && p.levels?.length) return { ok: true, p };
    if (i === 6 || i === 25) {
      await evalIn(page, `(() => { const v = document.querySelector("video");
        if (v) { v.muted = true; v.play().catch(() => {}); } return !!v; })()`);
    }
    await sleep(1000);
  }
  const p = await evalIn(page, PLAYER);
  return { ok: false, p, why: !p?.player ? "لا #movie_player" : p.ad ? "بقي إعلان"
    : !p.api ? "بلا واجهة الجودة" : "بلا مستويات معلنة" };
}

// ── الترتيب الطبيعي: الإضافة ثم الصفحة (الشاهد الموجب) ──────────────────────
async function armAuto(url, port) {
  const row = { arm: "الترتيب الطبيعي — الإضافة ثم الصفحة (شاهد موجب)" };
  let h = null, page = null;
  try {
    h = await launch(port, { withExtension: true });
    row.extensionId = h.extensionId;
    row.configured = await configure(port, h.extensionId, { settings: { ytAutoQuality: WANT } });
    page = await openPage(port, url);
    // المِجَسّ يُركَّب فور فتح الصفحة كي لا يفوته إرسال البدء
    row.probeInstalled = await installProbe(page, "youtube.com");
    const ready = await waitPlayer(page);
    row.player = ready.p;
    if (!ready.ok) { row.note = ready.why + " — لم يُقس"; return row; }
    await sleep(4000);
    row.probe = await evalIn(page, READ_PROBE);
    row.world = await contentWorld(page);
    row.after = await evalIn(page, PLAYER);
    row.ok = true;
    return row;
  } catch (e) { row.note = "فشل: " + String(e?.message || e).slice(0, 90); return row; }
  finally {
    try { page?.ws?.close(); } catch {} try { h?.browser?.ws?.close(); } catch {}
    killChrome(h);
  }
}

// ── السيناريو الحقيقي: الصفحة أولاً، ثم تُحمَّل الإضافة، ثم يُضغط الزرّ ──────
async function armManual(url, port) {
  const row = { arm: "السيناريو الحقيقي — الصفحة ثم الإضافة ثم الضغط" };
  let h = null, page = null, sw = null;
  try {
    // (١) متصفّح **بلا إضافة**، والصفحة تُفتح أولاً
    h = await launch(port, { withExtension: false });
    page = await openPage(port, url);
    row.probeInstalled = await installProbe(page, "youtube.com");
    const ready = await waitPlayer(page);
    row.player = ready.p;
    if (!ready.ok) { row.note = ready.why + " — لم يُقس"; return row; }

    // (٢) تُحمَّل الإضافة **والصفحة مفتوحة**، بلا إعادة تحميل
    const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const browser = await connect(ver.webSocketDebuggerUrl);
    const res = await browser.send("Extensions.loadUnpacked", { path: (await import("./ext-harness.mjs")).ROOT });
    row.extensionId = res?.result?.id || null;
    if (!row.extensionId) { row.note = "تعذّر تحميل الإضافة — لم يُقس"; return row; }
    await sleep(1500);
    row.configured = await configure(port, row.extensionId, { settings: { ytAutoQuality: WANT } });
    await sleep(800);

    // (٣) **قبل الضغط**: هل `content.js` حاضر؟ — جوهر الفرضية الثانية
    row.worldBefore = await contentWorld(page);
    row.stateBefore = await evalIn(page, PLAYER);
    row.probeBefore = await evalIn(page, READ_PROBE);

    // (٤) الضغط — بنداءات `activateOnCurrentPage` نفسها، وتُقرأ نتائجها
    sw = await swClient(port, row.extensionId);
    if (!sw) { row.note = "لا service worker — لم يُقس"; return row; }
    const pr = await sw.send("Runtime.evaluate", {
      expression: PRESS, awaitPromise: true, returnByValue: true
    });
    row.press = pr?.result?.result?.value;
    row.pressError = pr?.result?.exceptionDetails?.text;

    // (٥) بعد الضغط — استطلاع لا مهلة
    const t0 = Date.now();
    while (Date.now() - t0 < 16000) {
      await sleep(500);
      const p = await evalIn(page, READ_PROBE);
      if (p?.done?.length) { row.doneAt = Date.now() - t0; row.probeAfter = p; break; }
      row.probeAfter = p;
    }
    row.worldAfter = await contentWorld(page);
    row.stateAfter = await evalIn(page, PLAYER);
    row.ok = true;
    return row;
  } catch (e) { row.note = "فشل: " + String(e?.message || e).slice(0, 90); return row; }
  finally {
    try { sw?.ws?.close(); } catch {} try { page?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {} killChrome(h);
  }
}

// ── فرع المالك: الترتيب الطبيعي **والمضيف محظور**، ثم الضغط ─────────────────
// **هذا هو الفرع الذي وصفه المالك حرفياً:** `content.js` **محقون وقت التحميل**
// (المانيفست يحقنه على كل رابط) **ومعطَّل ذاتياً بالحظر** — ثم يُضغط «تفعيل
// يدوي» **لا إلغاء حظر**. وهو غير الفرع الذي قاسته `armManual` (حيث كان
// `content.js` **غائباً البتّة**)، **والفرعان يقتضيان علاجين مختلفين تماماً.**
async function armBlocked(url, port) {
  const row = { arm: "فرع المالك — الترتيب الطبيعي والمضيف محظور، ثم الضغط" };
  let h = null, page = null, sw = null;
  try {
    h = await launch(port, { withExtension: true });
    row.extensionId = h.extensionId;
    row.configured = await configure(port, h.extensionId,
      { settings: { ytAutoQuality: WANT, blockedHosts: ["youtube.com"] } });
    page = await openPage(port, url);
    row.probeInstalled = await installProbe(page, "youtube.com");
    const ready = await waitPlayer(page);
    row.player = ready.p;
    if (!ready.ok) { row.note = ready.why + " — لم يُقس"; return row; }
    await sleep(2500);

    row.worldBefore = await contentWorld(page);
    row.stateBefore = await evalIn(page, PLAYER);
    row.probeBefore = await evalIn(page, READ_PROBE);

    sw = await swClient(port, row.extensionId);
    if (!sw) { row.note = "لا service worker — لم يُقس"; return row; }
    const pr = await sw.send("Runtime.evaluate", {
      expression: PRESS, awaitPromise: true, returnByValue: true });
    row.press = pr?.result?.result?.value;
    row.pressError = pr?.result?.exceptionDetails?.text;

    const t0 = Date.now();
    while (Date.now() - t0 < 16000) {
      await sleep(500);
      const p = await evalIn(page, READ_PROBE);
      row.probeAfter = p;
      if ((p?.done?.length || 0) > (row.probeBefore?.done?.length || 0)) { row.doneAt = Date.now() - t0; break; }
    }
    row.worldAfter = await contentWorld(page);
    row.stateAfter = await evalIn(page, PLAYER);
    row.ok = true;
    return row;
  } catch (e) { row.note = "فشل: " + String(e?.message || e).slice(0, 90); return row; }
  finally {
    try { sw?.ws?.close(); } catch {} try { page?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {} killChrome(h);
  }
}

// ── الشاهد السالب: صفحة غير يوتيوب، الإضافة محمَّلة ─────────────────────────
async function armNegative(port) {
  const row = { arm: "شاهد سالب — صفحة غير يوتيوب والإضافة محمَّلة" };
  let h = null, page = null;
  try {
    h = await launch(port, { withExtension: true });
    row.configured = await configure(port, h.extensionId, { settings: { ytAutoQuality: WANT } });
    page = await openPage(port, "https://example.com/");
    row.probeInstalled = await installProbe(page, "example.com");
    await sleep(3500);
    row.state = await evalIn(page, PLAYER);
    row.probe = await evalIn(page, READ_PROBE);
    row.world = await contentWorld(page);
    row.ok = true;
    return row;
  } catch (e) { row.note = "فشل: " + String(e?.message || e).slice(0, 90); return row; }
  finally {
    try { page?.ws?.close(); } catch {} try { h?.browser?.ws?.close(); } catch {}
    killChrome(h);
  }
}

async function youtubeUrl(port) {
  let h = null, page = null;
  try {
    h = await launch(port, { withExtension: false });
    page = await openPage(port, "https://www.youtube.com/results?search_query=music");
    for (let i = 0; i < 25; i++) {
      const href = await evalIn(page,
        `(document.querySelector('a#video-title, a[href^="/watch?v="]')||{}).href || null`);
      if (href) return href.split("&")[0];
      await sleep(1000);
    }
    return null;
  } catch { return null; }
  finally { try { page?.ws?.close(); } catch {} killChrome(h); }
}

// ---- التشغيل ---------------------------------------------------------------
let port = 9671;
const url = process.argv[2] || await youtubeUrl(port++);

console.log(`\n=== #38ج — على الإضافة الحقيقية (${EXT_NAME}) ===`);
if (!url) { console.log("⚠️ تعذّر استخراج رابط يوتيوب — **لم يُقس**\n"); process.exit(0); }
console.log(`الموقع (قرار 19): ${url}`);
console.log(`الجودة المطلوبة : ${WANT}\n`);

process.stdout.write("⏳ الشاهد الموجب … ");
const auto = await armAuto(url, port++);
console.log(auto.ok ? "تمّ" : (auto.note || "لم يُقس"));

process.stdout.write("⏳ الشاهد السالب … ");
const neg = await armNegative(port++);
console.log(neg.ok ? "تمّ" : (neg.note || "لم يُقس"));

process.stdout.write("⏳ فرع المالك (محظور) … ");
const blk = await armBlocked(url, port++);
console.log(blk.ok ? "تمّ" : (blk.note || "لم يُقس"));

process.stdout.write("⏳ السيناريو الحقيقي … ");
const man = await armManual(url, port++);
console.log(man.ok ? "تمّ" : (man.note || "لم يُقس"));

const fmt = (p) => p ? `أُرسل ${p.sent?.length || 0}${p.sent?.length ? " (" + p.sent.map((s) => `${s.q}@${s.at}ms`).join(",") + ")" : ""} · ردّ ${p.done?.length || 0}${p.done?.length ? " (" + p.done.map((d) => `${d.d?.result}@${d.at}ms`).join(",") + ")" : ""}` : "—";

console.log(`\n── ${auto.arm}`);
if (!auto.ok) console.log(`   ⚠️ ${auto.note}`);
else {
  console.log(`   ضبط التخزين : ${auto.configured?.ok ? "✅" : "❌"} ${JSON.stringify(auto.configured?.readBack || {}).slice(0, 60)}`);
  console.log(`   عالم content.js : ${auto.world ? "✅ حاضر" : "❌ غائب"} · __vzQB=${auto.after?.vzQB}`);
  console.log(`   المِجَسّ : ${fmt(auto.probe)}`);
  console.log(`   الجودة : ${auto.player?.current} ⇒ ${auto.after?.current}`);
}

console.log(`\n── ${neg.arm}`);
if (!neg.ok) console.log(`   ⚠️ ${neg.note}`);
else {
  console.log(`   عالم content.js : ${neg.world ? "حاضر" : "غائب"} · __vzQB=${neg.state?.vzQB}`);
  console.log(`   المِجَسّ : ${neg.probeInstalled?.ok ? "" : "⚠️ لم يُركَّب · "}${fmt(neg.probe)}`);
}

console.log(`\n── ${man.arm}`);
if (!man.ok) console.log(`   ⚠️ ${man.note}`);
else {
  console.log(`   ── قبل الضغط`);
  console.log(`      content.js حاضر؟ : ${man.worldBefore ? "✅ **نعم**" : "❌ **لا — غير محقون البتّة**"}`);
  console.log(`      __vzQB           : ${man.stateBefore?.vzQB}`);
  console.log(`      المِجَسّ           : ${man.probeInstalled?.ok ? "✅ مُركَّب" : "⚠️ **لم يُركَّب** — " + man.probeInstalled?.why} · ${fmt(man.probeBefore)}`);
  console.log(`   ── الضغط (نداءات activateOnCurrentPage، ونتائجها مقروءة)`);
  console.log(`      التبويب          : ${man.press?.tabId} · ${man.press?.url}`);
  console.log(`      حقن MAIN         : ${man.press?.mainError ? "❌ " + man.press.mainError
    : `✅ ${JSON.stringify(man.press?.mainResult)}`}`);
  console.log(`      حقن content.js   : ${man.press?.contentError ? "❌ " + man.press.contentError
    : `✅ ${JSON.stringify(man.press?.contentResult)}`}`);
  if (man.pressError) console.log(`      استثناء          : ${man.pressError}`);
  console.log(`   ── بعد الضغط`);
  console.log(`      content.js حاضر؟ : ${man.worldAfter ? "✅ نعم" : "❌ لا"}`);
  console.log(`      __vzQB           : ${man.stateAfter?.vzQB}`);
  console.log(`      المِجَسّ           : ${fmt(man.probeAfter)}`);
  console.log(`      الجودة           : ${man.stateBefore?.current} ⇒ ${man.stateAfter?.current}`);
}

console.log(`\n── ${blk.arm}`);
if (!blk.ok) console.log(`   ⚠️ ${blk.note}`);
else {
  console.log(`   ── قبل الضغط`);
  console.log(`      content.js حاضر؟ : ${blk.worldBefore ? "✅ **نعم — محقون وقت التحميل**" : "❌ لا"}`);
  console.log(`      __vzQB           : ${blk.stateBefore?.vzQB}`);
  console.log(`      المِجَسّ           : ${blk.probeInstalled?.ok ? "✅ مُركَّب" : "⚠️ لم يُركَّب"} · ${fmt(blk.probeBefore)}`);
  console.log(`   ── الضغط`);
  console.log(`      حقن MAIN         : ${blk.press?.mainError ? "❌ " + blk.press.mainError : "✅ " + (blk.press?.mainResult?.length || 0) + " إطار"}`);
  console.log(`      حقن content.js   : ${blk.press?.contentError ? "❌ " + blk.press.contentError : "✅ " + (blk.press?.contentResult?.length || 0) + " إطار"}`);
  console.log(`      رسالة الإيقاظ    : ${blk.press?.wakeError ? "❌ " + blk.press.wakeError : blk.press?.wake || "—"}`);
  console.log(`   ── بعد الضغط`);
  console.log(`      المِجَسّ           : ${fmt(blk.probeAfter)}`);
  console.log(`      الجودة           : ${blk.stateBefore?.current} ⇒ ${blk.stateAfter?.current}`);
  const s2 = (blk.probeAfter?.sent?.length || 0) - (blk.probeBefore?.sent?.length || 0);
  console.log(`      ⇒ نداء بعد الضغط : ${s2 > 0 ? "**وقع (" + s2 + ")**" : "**لم يقع**"}`);
}

// ── الحكم: يمرّ ببوّابة الشاهد الموجب أولاً ─────────────────────────────────
console.log(`\n── الحكم`);
const posOk = auto.ok && (auto.probe?.sent?.length > 0) && (auto.probe?.done?.length > 0);
const negOk = neg.ok && !(neg.state?.vzQB) && !(neg.probe?.sent?.length);
console.log(`   الشاهد الموجب : ${posOk ? "✅ الأداة ترى المسار كاملاً في الترتيب الطبيعي" : "❌ **ساقط** — لا حكم على المسار اليدوي"}`);
console.log(`   الشاهد السالب : ${negOk ? "✅ وتُميّز صفحةً لا يعمل عليها المسار" : "❌ **ساقط**"}`);
if (posOk && negOk && man.ok) {
  const sentAfter = (man.probeAfter?.sent?.length || 0) - (man.probeBefore?.sent?.length || 0);
  const doneAfter = (man.probeAfter?.done?.length || 0) - (man.probeBefore?.done?.length || 0);
  console.log(`   الفرضية ٢ : content.js قبل الضغط ⇒ ${man.worldBefore ? "**حاضر**" : "**غائب**"}` +
    ` · ونداء triggerYtQuality بعد الضغط ⇒ ${sentAfter > 0 ? `**وقع (${sentAfter})**` : "**لم يقع**"}`);
  console.log(`   الفرضية ١ : حقن MAIN ⇒ ${man.press?.mainError ? "**فشل**" : "**وقع**"}`);
  console.log(`   الفرضية ٣ : ردّ المستمع بعد الضغط ⇒ ${doneAfter > 0 ? `**نعم بعد ${man.doneAt}ms**` : "**لا ردّ**"}`);
}
console.log("");
process.exit(0);
