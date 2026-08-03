// #69 — يقيس حالة الحارسين **لحظة فشل الحفظ**: أيمنعان الإرجاع أم لا؟
//
// ⚠️ يحتاج كروم مثبَّتاً. بلا شبكة — صفحة الإضافة وحدها. **لا يُشحن.**
//   node tools/bench-s69-guards.mjs
//
// ── السؤال ─────────────────────────────────────────────────────────────────
// الدالّة الواحدة للرسم تحمل حارسَين: `!cleanPlayerSaving` و«المودال مغلق».
// ومسار الفشل يستدعيها **من داخل `saveSettings`** أي **قبل** أن يفرغ المعالج.
// فهل يكون الحارس مرفوعاً حينها **فيمنع الإرجاع الذي وُضع من أجله**؟
// **يُقاس ولا يُفترض** — وهذا نفس باب «النجاح الكاذب»: حارسٌ يُسقط الإرجاع صامتاً
// يترك الضابط يكذب على المستخدم.
//
// ── كيف يُقاس ──────────────────────────────────────────────────────────────
// افتعال الفشل يأتي من **`tools/force-sync-failure.js` نفسه** — لا نسخة ثانية —
// ويُقرأ العدّاد وحالة المودال **داخل نداء الكتابة المرفوض**، أي في اللحظة التي
// سيقع فيها الإرجاع بالضبط.
//
// ── شاهدا القبول (قرار 26) ─────────────────────────────────────────────────
//  · **موجب:** الفعل يُطلق كتابة فعلاً (المفاتيح تُطبع)، والرفض يقع.
//  · **سالب:** بلا تركيب المِجَسّ ⇒ الكتابة تنجح ولا رفض — فالأداة تميّز.
import fs from "node:fs";
import path from "node:path";
import { launch, evalIn, connect, ROOT , killChrome } from "./ext-harness.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9951;
const FORCE = fs.readFileSync(path.join(ROOT, "tools", "force-sync-failure.js"), "utf8");

async function openExtPage(port, url) {
  const tab = await (await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
  const c = await connect(tab.webSocketDebuggerUrl);
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  return c;
}

// يلتقط حالة الحارسين **داخل** نداء الكتابة المرفوض
const SNAPSHOT = `(() => {
  window.__vzSnap = [];
  const f = window.__vzForceFail;
  const set = chrome.storage.sync.set;
  chrome.storage.sync.set = (...a) => {
    let counter = null;
    try { counter = cleanPlayerSaving; } catch (e) { counter = "غير مقروء: " + e.message; }
    const modal = document.getElementById("modalOverlay");
    window.__vzSnap.push({ keys: Object.keys(a[0] || {}),
      cleanPlayerSaving: counter,
      modalHidden: modal ? modal.hidden : null });
    return set(...a);
  };
  return true;
})()`;

async function clickFirstCleanPlayerBox(page) {
  const r = await evalIn(page, `(() => {
    const b = document.querySelector('.navItem[data-section="youtubeSection"]'); if (b) b.click();
    const el = document.querySelectorAll("#cleanPlayerList input[type=checkbox]")[0];
    if (!el) return null; el.scrollIntoView({ block: "center" });
    const q = el.getBoundingClientRect();
    return { x: Math.round(q.left + q.width / 2), y: Math.round(q.top + q.height / 2), id: el.id }; })()`);
  if (!r) return null;
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x, y: r.y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x, y: r.y, button: "left", clickCount: 1 });
  await sleep(1200);
  return r;
}

async function run() {
  const h = await launch(PORT, { withExtension: true, extra: ["--window-size=1400,1000"] });
  const out = {};
  let page = null;
  try {
    page = await openExtPage(PORT, `chrome-extension://${h.extensionId}/options.html`);
    await sleep(2600);

    // ── الشاهد السالب: بلا افتعال ⇒ لا رفض ──────────────────────────────
    await evalIn(page, SNAPSHOT);
    const box = await clickFirstCleanPlayerBox(page);
    out.control = { clicked: !!box, snaps: await evalIn(page, `window.__vzSnap.length`),
                    forced: await evalIn(page, `!!window.__vzForceFail`) };

    // ── ثم الافتعال، ثم الفعل نفسه ──────────────────────────────────────
    out.install = await evalIn(page, `(() => { ${FORCE} ; return !!window.__vzForceFail; })()`);
    await evalIn(page, `window.__vzSnap.length = 0`);
    // ⚠️ المِجَسّ لفّ `set` **بعد** لقطتنا، فتُعاد اللقطة فوقه كي تبقى الأقرب
    await evalIn(page, SNAPSHOT);
    await evalIn(page, `window.__vzSnap.length = 0`);
    await clickFirstCleanPlayerBox(page);
    out.cleanPlayer = { snaps: await evalIn(page, `window.__vzSnap`),
                        toast: await evalIn(page, `(() => { const t = document.getElementById("toast");
                          return t ? { text: (t.textContent || "").slice(0, 90), shown: t.classList.contains("show") } : null; })()`) };

    // ── (٣) بعد الإصلاح: هل يقع الإرجاع فعلاً؟ ──────────────────────────
    // الحالة المقيسة: مربّع يُقلب والحفظ يفشل ⇒ **المربّع يعود إلى حالة التخزين**
    out.revert = await evalIn(page, `(async () => {
      const box = document.querySelectorAll("#cleanPlayerList input[type=checkbox]")[1];
      const key = box.id.replace(/^cp_/, "");
      const before = box.checked;
      const stored0 = !!(((await chrome.storage.sync.get({settings:{}})).settings.cleanPlayer || {}).items || {})[key];
      return { key, before, stored0 };
    })()`);
    const box2 = await evalIn(page, `(() => {
      const el = document.querySelectorAll("#cleanPlayerList input[type=checkbox]")[1];
      el.scrollIntoView({ block: "center" }); const q = el.getBoundingClientRect();
      return { x: Math.round(q.left + q.width/2), y: Math.round(q.top + q.height/2) }; })()`);
    await evalIn(page, `(() => { if (window.__vzForceFail) window.__vzForceFail.restore(); ${FORCE} ; return true; })()`);
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box2.x, y: box2.y, button: "left", clickCount: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box2.x, y: box2.y, button: "left", clickCount: 1 });
    await sleep(2000);
    out.revert.after = await evalIn(page, `(() => document.querySelectorAll("#cleanPlayerList input[type=checkbox]")[1].checked)()`);
    out.revert.storedAfter = await evalIn(page, `(async () => { const d = await chrome.storage.sync.get({settings:{}});
      const items = ((d.settings.cleanPlayer || {}).items || {});
      const key = document.querySelectorAll("#cleanPlayerList input[type=checkbox]")[1].id.replace(/^cp_/, "");
      return !!items[key]; })()`);

    // ── المودال: يُفتح ثم يُحفظ والفشل مفتعَل ─────────────────────────────
    await evalIn(page, `(() => { const b = document.querySelector('.navItem[data-section="zonesSection"]'); if (b) b.click(); return true; })()`);
    await sleep(400);
    out.modalOpened = await evalIn(page, `(() => {
      const cell = document.querySelector("#grid .cell, #grid > *"); if (!cell) return false;
      cell.click(); return document.getElementById("modalOverlay").hidden === false; })()`);
    await sleep(500);
    // افتعال ثانٍ (الأول استُهلك)
    await evalIn(page, `(() => { if (window.__vzForceFail) window.__vzForceFail.restore(); ${FORCE} ; return true; })()`);
    await evalIn(page, SNAPSHOT);
    await evalIn(page, `window.__vzSnap.length = 0`);
    await evalIn(page, `document.getElementById("modalSave").click()`);
    await sleep(1200);
    out.modal = { snaps: await evalIn(page, `window.__vzSnap`),
                  hiddenAfter: await evalIn(page, `document.getElementById("modalOverlay").hidden`) };
  } catch (e) {
    out.error = String(e?.message || e).slice(0, 140);
  } finally {
    try { page?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {}
    killChrome(h);
  }
  return out;
}

const r = await run();
console.log(`\n=== #69 — حالة الحارسين لحظة فشل الحفظ ===`);
if (r.error) { console.log(`⚠️ ${r.error}`); process.exit(1); }

console.log(`\n── فحص البصر (قرار 26)`);
console.log(`   سالب: بلا افتعال ⇒ كتابات ${r.control?.snaps} · مِجَسّ مُركَّب؟ ${r.control?.forced ? "❌ نعم" : "✅ لا"}`);
console.log(`   موجب: بعد الافتعال ⇒ ${r.install ? "✅ المِجَسّ فعّال" : "❌ لم يُركَّب"}`);

console.log(`\n── (١) مربّع Clean Player — الحفظ يفشل`);
for (const s of (r.cleanPlayer?.snaps || [])) {
  console.log(`   كتابة [${s.keys.join(",")}] ⇒ **cleanPlayerSaving = ${s.cleanPlayerSaving}** · المودال مخفيّ = ${s.modalHidden}`);
}
console.log(`   والرسالة: ${r.cleanPlayer?.toast?.shown ? `«${r.cleanPlayer.toast.text}»` : "لم تظهر"}`);

const rv = r.revert || {};
console.log(`\n── (٣) الإرجاع بعد الإصلاح — مربّع يُقلب والحفظ يفشل`);
console.log(`   المفتاح ${rv.key} · قبل النقر: الواجهة ${rv.before} والتخزين ${rv.stored0}`);
console.log(`   بعد الفشل: الواجهة **${rv.after}** والتخزين **${rv.storedAfter}** ⇒ ${rv.after === rv.storedAfter ? "✅ **متطابقان — الإرجاع وقع**" : "❌ **منحرفان — الضابط يكذب**"}`);

console.log(`\n── (٢) حفظ المربّع من المودال — الحفظ يفشل`);
console.log(`   فُتح المودال؟ ${r.modalOpened ? "نعم" : "لا"}`);
for (const s of (r.modal?.snaps || [])) {
  console.log(`   كتابة [${s.keys.join(",")}] ⇒ cleanPlayerSaving = ${s.cleanPlayerSaving} · **المودال مخفيّ = ${s.modalHidden}**`);
}
console.log(`   وحال المودال بعدها: مخفيّ = ${r.modal?.hiddenAfter}`);

const cp = (r.cleanPlayer?.snaps || [])[0];
const md = (r.modal?.snaps || [])[0];
console.log(`\n── الحكم`);
console.log(`   حارس Clean Player ${cp ? (cp.cleanPlayerSaving > 0 ? "**مرفوع لحظة الفشل ⇒ يمنع الإرجاع**" : "ساقط ⇒ لا يمنع") : "لم يُقس"}`);
console.log(`   حارس المودال     ${md ? (md.modalHidden === false ? "**المودال مفتوح لحظة الفشل ⇒ يمنع الرسم**" : "مغلق ⇒ لا يمنع") : "لم يُقس"}`);
console.log("");
fs.writeFileSync(path.join(ROOT, "tools", ".s69-raw.json"), JSON.stringify(r, null, 1));
