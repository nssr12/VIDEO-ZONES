// #112 (المرحلة أ) — **يقيس على شجرة يوتيوب المحفوظة وأنماطِها، بلا شبكةٍ ولا حجب.**
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«الأزرارُ التي أراها في مشغّل يوتيوب —
// أتظهر بمقاسها وتستجيب لنقري، قبل أن أفتحه بيدي وأجرّب؟»*
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يحمّل لقطةً وزنُها
// نحوُ خمسة ميغابايت في متصفّح، **فثمنُه في كلّ كومِتٍ ثمنٌ بلا مقابل** ما دام
// أثرُه محصوراً في مسار الحقن. **ومُطلِقُه: كلُّ مسٍّ لمسار الحقن أو الترتيب،
// ورفعُ النسخة.** ⚠️ **وليس لأنه يحتاج شبكة — لا يحتاجها**، وهذا كلُّ الغرض.
//
// ── ⛔⭐⭐ واللقطةُ لا تحلّ محلَّ الصفحة المفتعَلة — وكلٌّ يمسك ما لا يمسكه الآخر ──
// **المفتعَلةُ حالاتٌ تُنتَج** (مستطيلٌ صفريّ · فيديو بلا نطاق مشغّل · Shadow DOM ·
// صفحةٌ بلا شريطِ مضيف أصلاً — وهي سطحُ #119)، **حتميّةٌ ورخيصة.**
// **واللقطةُ حالٌ واحدةٌ ثقيلة** فيها ما لا يصنعه مُساعدُنا: **أنماطُ يوتيوب.**
// ⇒ **فمن استبدل إحداهما بالأخرى فقدَ ما تمسكه.**
//
//   node tools/bench-112-host-snapshot.mjs
//   node tools/bench-112-host-snapshot.mjs --red <commit>   # يُشغّله على content.js من السجلّ
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { launch, openPageAsHost, contentWorld, evalIn, killChrome, configure, waitPortFree, ROOT }
  from "./ext-harness.mjs";

const PORT = 9799;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RED = (() => { const i = process.argv.indexOf("--red"); return i > 0 ? process.argv[i + 1] : null; })();

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra === undefined ? "" : JSON.stringify(extra).slice(0, 220)));

// ── اللقطة: أحدثُ ملفٍّ في `tools/snapshots` ────────────────────────────────
const SNAP_DIR = path.join(ROOT, "tools", "snapshots");
const snapFile = fs.existsSync(SNAP_DIR)
  ? fs.readdirSync(SNAP_DIR).filter((f) => f.endsWith(".xhtml")).sort().pop() : null;
if (!snapFile) { console.log("❌ لا لقطةَ في tools/snapshots — `node tools/capture-yt-snapshot.mjs`"); process.exit(1); }
const HTML = fs.readFileSync(path.join(SNAP_DIR, snapFile), "utf8");
// **الوصفُ في ملفٍّ مجاور لا داخل الوثيقة** — فلا هروبَ في XML ولا كسرَ تحليل
const META = (() => {
  const p = path.join(SNAP_DIR, snapFile.replace(/\.xhtml$/, ".meta.json"));
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
})();

// ── ⛔ نسخةُ إضافةٍ بـ`content.js` من السجلّ — لإثبات الحمرة على العطب نفسِه ──
// **لا على شبيهٍ يُفتعَل** (قرار 47): **يُشغَّل على الملفّ السابق بنصّه.**
function extAt(commit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vz-red-"));
  for (const f of fs.readdirSync(ROOT)) {
    if ([".git", "node_modules", "tools", "docs"].includes(f)) continue;
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  const old = execFileSync("git", ["show", `${commit}:content.js`], { cwd: ROOT, maxBuffer: 64e6 });
  fs.writeFileSync(path.join(dir, "content.js"), old);
  return dir;
}

const SETTINGS = {
  settings: {
    enabled: true, idle: { ms: 100000 },
    overlay: { autoHideMs: 3000, volumeAutoHideMs: 3000, enabled: true, hintEnabled: true,
               speedButton: true, speedButtonPreset: 2, filterButton: true,
               barButtons: [{ id: "speed", on: true }, { id: "filter", on: true }] },
    zones: { enabled: true, fullscreenOnly: false, gridCoverage: "player",
             wheel: { map: { "4": { up: ["ACTION:VOLUME:+5"], down: ["ACTION:VOLUME:-5"] } } } }
  },
  globalSiteRules: { enabled: true, mappings: [] }
};

// ── المِجَسّات ──────────────────────────────────────────────────────────────
// ⚠️ **المراسي تُؤكَّد بعد التحميل قبل أن يُقاس شيء** (شرط المالك): **لقطةٌ
// تحمّلت ناقصةً تُخرج أصفاراً تُقرأ سلامة** — وهو الأعمى الأوّل في قرار 26،
// **على مستوى السند لا الشرط.**
const ANCHORS = `(() => {
  const q = (s) => document.querySelectorAll(s).length;
  const css = document.querySelector("style[data-vz-snapshot-css]");
  return { ytp: q('[class*="ytp-"]'), rightControls: q(".ytp-right-controls"),
           bottom: q(".ytp-chrome-bottom"), settings: q(".ytp-settings-button"),
           video: q("video"), host: location.hostname,
           cssSheets: css ? Number(css.getAttribute("data-vz-snapshot-css")) : 0,
           cssBytes: css ? css.textContent.length : 0 }; })()`;

// (١) #108 — الزرُّ المحقونُ الضامر: أيقونةٌ تنهار داخل شريط المضيف
const SHRUNK = `(() => {
  const bar = document.querySelector(".ytp-right-controls");
  if (!bar) return { why: "لا شريط" };
  const mine = [...bar.querySelectorAll(".vzBtn")];
  if (!mine.length) return { why: "لا زرَّ محقون", n: 0 };
  // ⚠️ **الجارُ زرٌّ لا حاوية** (قرار 108: النسبةُ إلى جارٍ من صنفه): أبناءُ
  // الشريط حاوياتٌ (ytp-right-controls-left/right) عرضُها 144–192، **ومقارنةُ
  // زرٍّ بحاويةٍ تُحمّر سليماً** — وقد وقعت في أوّل صياغة.
  const w = (e) => Math.round(e.getBoundingClientRect().width);
  const near = [...bar.querySelectorAll(".ytp-button")]
    .filter((e) => !e.classList.contains("vzBtn") && w(e) > 0);
  const neighbour = Math.max(0, ...near.map(w));
  return mine.map((el) => {
    const ico = el.querySelector("svg");
    const r = ico ? ico.getBoundingClientRect() : null;
    return { cls: el.className.slice(0, 40), btnW: w(el), neighbour,
             icoW: r ? Math.round(r.width) : 0, icoH: r ? Math.round(r.height) : 0 };
  }); })()`;

// (٢) #121 — النقرةُ تموت حين تُنزع العقدةُ وتُعاد بين mousedown وmouseup
// ⛔⭐ **الحالُ تُنتَج بنداء المنتَج نفسِه لا بتزييفها** (قرار 125): يُنادى
// `applyBarOrder` — **وهو المسارُ الذي كان يُحوّل الشجرة** — **بين الضغط والرفع.**
// ⚠️ **والزرُّ المضغوط هو الأخيرُ في الشريط**: الكودُ السابق كان ينقل **ما ليس
// أوّلَ ابن**، فالضغطُ على الأوّل لا يُنتج الحال ⇒ **أخضرُ من حالٍ لم تُنتَج.**
const CLICK_SETUP = `(() => {
  const mine = [...document.querySelectorAll(".ytp-right-controls .vzBtn")];
  if (!mine.length) return null;
  const el = mine[mine.length - 1];
  el.scrollIntoView({ block: "center" });      // ⬅ يُنتَج الموضعُ ولا يُفترض
  window.__vzClicks = 0;
  el.addEventListener("click", () => { window.__vzClicks++; }, true);
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
           cls: el.className.slice(0, 40) }; })()`;
const REORDER = `(() => { try { applyBarOrder(); return "نُودي"; }
  catch (e) { return "رمى: " + e.message.slice(0, 60); } })()`;
const CLICK_READ = `(() => ({ clicks: window.__vzClicks,
  stillInBar: !!document.querySelector(".ytp-right-controls .vzBtn") }))()`;

// (٣) #118 — الترتيبُ يقع على الشريط لا في معاينة
const ORDER = `(() => {
  const bar = document.querySelector(".ytp-right-controls");
  if (!bar) return { why: "لا شريط" };
  const mine = [...bar.querySelectorAll(".vzBtn")].map((e) =>
    e.classList.contains("vzSpeedBtn") ? "speed" : "filter");
  return { order: mine, n: mine.length }; })()`;

async function run(order) {
  // ⚠️ **يُنتظر تحرُّرُ المنفذ بين التشغيلتين** — وحارسُ المُساعد أمسكها في أوّل
  // تشغيلة: **كرومُ التشغيلة السابقة يردّ فيُقاس بناؤه هو** (وهو ما بُني الحارسُ له).
  await waitPortFree(PORT);
  const extPath = RED ? extAt(RED) : ROOT;
  // ⚠️ **مقاسُ النافذة كمقاس الالتقاط** — **ولقطةٌ التُقطت في 1600×1000 تُقرأ في
  // 800×600 بمواضعَ خارج المنظور** ⇒ **`elementFromPoint` تُرجع `null` فتموت
  // النقرةُ في المِجَسّ لا في المنتَج** (أمسكه الشاهدُ الموجب قبل أن يُنشر).
  const h = await launch(PORT, { extPath, extra: ["--window-size=1600,1000"] });
  const report = {};
  try {
    await sleep(1200);
    // **الترتيبُ المُعلَن يدخل الإعدادات** — والوعدُ أن يتبعه الشريط
    const st = JSON.parse(JSON.stringify(SETTINGS));
    st.settings.overlay.barButtons = order.map((id) => ({ id, on: true }));
    await configure(PORT, h.extensionId, st);
    // ⛔ **تُقدَّم XHTML** — وإلا كسر محلِّلُ HTML شجرتَها (انظر `ext-harness`)
    const { c } = await openPageAsHost(PORT, { html: HTML,
      contentType: "application/xhtml+xml; charset=utf-8" });
    await sleep(2500);
    // ⚠️ **المعرّف لا الكائن** — وأوّلُ صياغةٍ مرّرت الكائنَ فأرجع المِجَسُّ
    // `undefined`، **و«لا أرى» تطبع ما تطبعه «لا يوجد»** (الشاهد الأوّل، قرار 26)
    const w = (await contentWorld(c))?.id;
    if (!w) throw new Error("عالمُ الإضافة غائب — ولا يُقاس بلا عالم");
    report.anchors = await evalIn(c, ANCHORS);
    // إيقاظُ الزرّ: مؤشّرٌ فوق الفيديو (طبقتُنا تشتقّ الظهور منه)
    const v = await evalIn(c, `(() => { const el = document.querySelector("video");
      if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    if (v) {
      for (let i = 0; i < 6; i++) {
        await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: v.x + (i % 2 ? 6 : -6), y: v.y + 3 });
        await sleep(250);
      }
    }
    await sleep(800);
    report.shrunk = await evalIn(c, SHRUNK, w);
    report.order = await evalIn(c, ORDER, w);
    // ── النقرة: ضغطٌ موثوق ⇒ نداءُ المنتَج ⇒ رفعٌ في الموضع نفسِه ──────────
    const b = await evalIn(c, CLICK_SETUP, w);
    if (b) {
      // ⭐ **شاهدٌ موجب قبل الحكم** (قرار 26): نقرةٌ **بلا** إعادة ترتيب — **فإن
      // لم تقع فالعطبُ في المِجَسّ لا في المنتَج**، **و«لم أصب الزرّ» تطبع ما
      // تطبعه «النقرةُ ماتت».**
      report.hit = await evalIn(c, `(() => { const e = document.elementFromPoint(${b.x}, ${b.y});
        return e ? (e.tagName + "." + String(e.className.baseVal !== undefined ? e.className.baseVal : e.className).slice(0, 40)) : null; })()`, w);
      await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: b.x, y: b.y, button: "left", clickCount: 1 });
      await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", clickCount: 1 });
      await sleep(250);
      report.control = await evalIn(c, CLICK_READ, w);
      await evalIn(c, `window.__vzClicks = 0`, w);
      await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: b.x, y: b.y, button: "left", clickCount: 1 });
      report.reorder = await evalIn(c, REORDER, w);
      await sleep(120);
      await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", clickCount: 1 });
      await sleep(300);
      report.click = { ...(await evalIn(c, CLICK_READ, w)), المضغوط: b.cls };
    } else report.click = { why: "لا زرَّ محقون" };
    try { c.ws.close(); } catch {}
  } finally {
    killChrome(h);
    if (RED) { try { fs.rmSync(extPath, { recursive: true, force: true }); } catch {} }
  }
  return report;
}

console.log(`\n=== #112 — قياسٌ على لقطةٍ محفوظة ===`);
console.log(`  اللقطة: ${snapFile}`);
if (META) console.log(`  التُقطت ${META.capturedAt} · بناءُ المشغّل ${String(META.build).slice(0, 46)}`);
if (RED) console.log(`  ⚠️ **شاهدُ حمرة**: content.js من \`${RED}\` — **يُنتظر منه أن يُحمّر**`);

const r = await run(["filter", "speed"]);

console.log("\n[0] المراسي — تُؤكَّد قبل أن يُقاس شيء");
{
  const a = r.anchors || {};
  const want = (META && META.anchors) || {};
  check("[0] الصفحةُ تحت اسم المضيف", a.host === "www.youtube.com", a.host);
  check("[0] أوراقُ الأنماط مُضمَّنةٌ وغيرُ فارغة",
    a.cssSheets > 0 && a.cssBytes > 100000, { أوراق: a.cssSheets, بايت: a.cssBytes });
  check(`[0] ⭐ شريطُ المضيف الأيمن حاضر (${a.rightControls})`, a.rightControls === 1, a);
  check("[0] ⭐⭐ وعددُ عناصر المشغّل يقارب المحفوظ",
    want.ytp ? Math.abs(a.ytp - want.ytp) <= Math.max(20, want.ytp * 0.1) : a.ytp > 100,
    { الآن: a.ytp, المحفوظ: want.ytp });
  if (fail) {
    console.log("\n⛔ **المراسي لم تُؤكَّد — ولا يُقرأ ما بعدها**: أصفارُها «لم أُحمّل» لا «سليم».");
    console.log(`\n${"❌"} نجح ${pass} / فشل ${fail}\n`);
    process.exit(1);
  }
}

console.log("\n[1] #108 — الزرُّ المحقونُ لا يضمر داخل شريط المضيف");
{
  const s = r.shrunk;
  // ⛔⭐⭐ **م19 انتقلت إلى هنا 2026-08-07** (#112، القائمةُ الأولى): كانت
  // **خطوةً يدويّة** — «حرّك الفأرة ⇒ زرُّ السرعة في صفّ أزرار المضيف، لا صندوقاً
  // عائماً فوق الصورة». ⇒ **وهي مقيسةٌ هنا على شريطٍ حقيقيّ بأنماطه.**
  // ⚠️ **وحدُّها يُكتب في نصّها فلا يُقرأ أخضرُها خارج مداه:** **حالٌ واحدة
  // (صفحةُ مشاهدة · شريطٌ صاحٍ · نافذة)** · **بلا تشغيلٍ حيّ** · **وبلا انتقال
  // SPA** — **فإعادةُ حقنِ الزرّ حين يُعيد يوتيوب بناءَ شريطه تبقى خارجَ مداها.**
  check("[1] ⭐⭐ (م19) الزرُّ في صفّ أزرار المضيف لا في طبقتنا — حالٌ واحدة بلا تشغيل",
    Array.isArray(s) && s.length > 0 && s.every((b) => /vzInBar/.test(b.cls)), s);
  if (Array.isArray(s)) for (const b of s) {
    // **العتبةُ نسبةٌ إلى جارٍ لا رقمٌ مطلق** (قرار 108)
    check(`[1] ⭐⭐ ${b.cls.includes("Filter") ? "زرّ الفلاتر" : "زرّ السرعة"}: عرضُه ≥ 0.6× جارِه`,
      b.neighbour > 0 && b.btnW >= b.neighbour * 0.6, b);
    check(`[1] ⭐⭐ وأيقونتُه ليست 0×0`, b.icoW > 0 && b.icoH > 0, b);
  }
}

console.log("\n[2] #121 — النقرةُ تحيا وإن أُعيد الترتيبُ بين الضغط والرفع");
{
  const c = r.click || {};
  check("[2] الزرُّ موجودٌ ليُنقر", !c.why, c);
  check("[2] ⭐ شاهدٌ موجب: نقرةٌ بلا إعادة ترتيب تقع", (r.control || {}).clicks >= 1,
    { شاهد: r.control, تحتَ_النقطة: r.hit });
  check("[2] ⭐⭐ والنقرةُ وقعت", c.clicks >= 1, c);
  check("[2] والزرُّ بقي في الشريط بعدها", c.stillInBar === true, c);
}

console.log("\n[3] #118 — الترتيبُ يقع على الشريط لا في معاينة");
{
  const o = r.order || {};
  check("[3] الزرّان كلاهما في الشريط", o.n === 2, o);
  // ⛔⭐⭐ **ترتيبان لا واحد** — **ووعدُ الميزة أن يتبع الشريطُ ما أُعلن**:
  // **عيّنةٌ واحدة قد يوافقها الترتيبُ الطبيعيّ للحقن صدفةً** ⇒ **فيُقاس
  // الانقلابُ لا الاتّجاه** (قرار 125)، **ولا يمكن لكودٍ لا يرتّب أن يتبع الاثنين.**
  check("[3] ⭐ والترتيبُ المرسوم يتبع المُعلَن (فلتر ثمّ سرعة)",
    Array.isArray(o.order) && o.order.join() === "filter,speed", o);
  const r2 = await run(["speed", "filter"]);
  const o2 = r2.order || {};
  check("[3] ⭐⭐ وينقلب بانقلابه (سرعة ثمّ فلتر)",
    Array.isArray(o2.order) && o2.order.join() === "speed,filter", o2);
}

if (RED) {
  console.log(`\n⇒ **شاهدُ الحمرة**: ${fail > 0
    ? `✅ احمرَّ بـ${fail} — فالرِكازُ يمسك ما بُني له`
    : "❌ **لم يُحمّر — ولا يُصدَّق أخضرُه بعد اليوم**"}`);
  console.log(`\n${fail ? "✅" : "❌"} (مقلوبٌ في وضع الحمرة) نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 0 : 1);
}
console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
