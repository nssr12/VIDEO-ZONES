// #112 — **ملءُ الشاشة على لقطةٍ محفوظة** (م12 · م13 · م14).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«وفي ملء الشاشة — أيختفي الشريطُ كما
// يختفي في النافذة، ويبقى تحت يدي وأنا ماسكُه، ويعمل زرُّ السرعة بالعجلة؟»*
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يحمّل شجرةً ولقطةَ
// أنماطٍ في متصفّح وينتظر مهلَ سكونٍ حقيقيّة، **فثمنُه في كلّ كومِتٍ بلا مقابل.**
// **ومُطلِقُه: كلُّ مسٍّ لمحرّك السكون أو لمسار الحقن، ورفعُ النسخة.**
//
// ── ⭐⭐ شجرةٌ من لقطةٍ وأنماطٌ من أخرى — **والثمنُ قِيس قبل البناء** ────────
// **لقطةُ النافذة 4.9MB منها 4.4 أنماط**، **وشجرةُ ملء الشاشة 653KB وحدَها.**
// ✅ **وشرطُ الدمج قِيس ولم يُفترض: بصمةُ الأنماط في الحالين واحدة** —
// `18f59329260261f8` · **4,400,548 بايت في الحالين**، من الصفحة والبناء نفسِهما.
// ⛔ **ولو اختلفت لَوقف البناء** ⇒ **فالثمنُ صار نصفَ ميغابايت لا خمسة.**
//
// ── ⛔⭐⭐ وحدُّ اللقطات كلِّها، وقد قِيس هنا بعينه ─────────────────────────
// **اللقطةُ تُجمّد ما كتبه سكربتُ المضيف في العنصر لحظةَ الالتقاط.** ⇒ **ولهذا
// لم يكفِ إضافةُ صنف `ytp-fullscreen` ولا ملءُ الشاشة الحقيقيُّ على لقطة النافذة:**
// **صفُّ الإجراءات يحمل `style="display:none"` مكتوبةً فيه** — كتبها سكربتُه ثمّ
// نُزع، **فلا شيءَ يرفعها أبداً.** ⇒ ⭐ **فالحالُ تُلتقط ولا تُصنَع بالأصناف.**
// ⚠️ **والمُنتَجُ قبل الالتقاط مسجَّلٌ بعينه في `meta.json`** (لا اسمَ الحال وحدَه):
// ملءُ شاشة ✅ · شريطٌ سفليّ ✅ · عنوان ✅ · صفُّ إجراءات ✅ · زرُّ المزيد ✅ ·
// **ووضعُ السينما مخفيٌّ كما هو حيّاً** · **وقائمةُ الإعدادات مغلقة** (فـ`م11` خارج مداه).
//
//   node tools/bench-112-fullscreen-snapshot.mjs
//   node tools/bench-112-fullscreen-snapshot.mjs --red <commit>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { launch, openPageAsHost, contentWorld, evalIn, killChrome, configure, ROOT }
  from "./ext-harness.mjs";

const PORT = 9813;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RED = (() => { const i = process.argv.indexOf("--red"); return i > 0 ? process.argv[i + 1] : null; })();

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra === undefined ? "" : JSON.stringify(extra).slice(0, 200)));

// ── الشجرةُ من لقطة ملء الشاشة، والأنماطُ من لقطة النافذة ──────────────────
const SNAP_DIR = path.join(ROOT, "tools", "snapshots");
const files = fs.existsSync(SNAP_DIR) ? fs.readdirSync(SNAP_DIR).filter((f) => f.endsWith(".xhtml")) : [];
const treeFile = files.filter((f) => f.includes("fullscreen")).sort().pop();
const cssFile = files.filter((f) => !f.includes("fullscreen")).sort().pop();
if (!treeFile || !cssFile) { console.log("❌ تنقص لقطة — `node tools/capture-yt-snapshot.mjs [--fullscreen]`"); process.exit(1); }
const TREE = fs.readFileSync(path.join(SNAP_DIR, treeFile), "utf8");
const CSS = (() => {
  const s = fs.readFileSync(path.join(SNAP_DIR, cssFile), "utf8");
  const a = s.indexOf("<style data-vz-snapshot-css");
  const open = s.indexOf(">", a) + 1, close = s.indexOf("</style>", open);
  if (a < 0 || close < 0) throw new Error("لا كتلةَ أنماطٍ في لقطة النافذة");
  return { text: s.slice(open, close), attr: /data-vz-snapshot-css="(\d+)"/.exec(s)?.[1] || "0" };
})();
// **الحقنُ عند التحميل** — والأنماطُ تُحقَن في `<head>` كما كانت في مصدرها
// ⚠️ **يُملأ العنصرُ الفارغ في الشجرة ولا يُضاف ثانٍ** — **و`querySelector`
// تُرجع الأوّل**، فعنصرٌ فارغٌ سابقٌ يجعل المِجَسَّ يقرأ صفراً ويقول «لا أنماط»
// **وهي محقونة** (وقعت في أوّل تشغيلة، وأمسكتها المرساة).
const CSS_TEXT = CSS.text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const EMPTY = /<style data-vz-snapshot-css="0"><\/style>/;
const HTML = EMPTY.test(TREE)
  ? TREE.replace(EMPTY, `<style data-vz-snapshot-css="${CSS.attr}" data-vz-from="${cssFile}">${CSS_TEXT}</style>`)
  : TREE.replace("</head>",
      `<style data-vz-snapshot-css="${CSS.attr}" data-vz-from="${cssFile}">${CSS_TEXT}</style></head>`);

function extAt(commit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vz-fs-red-"));
  for (const f of fs.readdirSync(ROOT)) {
    if ([".git", "node_modules", "tools", "docs"].includes(f)) continue;
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  fs.writeFileSync(path.join(dir, "content.js"),
    execFileSync("git", ["show", `${commit}:content.js`], { cwd: ROOT, maxBuffer: 64e6 }));
  return dir;
}

const IDLE_MS = 400;
const SETTINGS = {
  settings: {
    enabled: true, idle: { ms: IDLE_MS },
    overlay: { autoHideMs: 3000, volumeAutoHideMs: 3000, enabled: true,
               speedButton: true, speedButtonPreset: 2, filterButton: true,
               progressBarMode: "idle",
               barButtons: [{ id: "speed", on: true }, { id: "filter", on: true }] },
    zones: { enabled: true, fullscreenOnly: false, gridCoverage: "player",
             // ⭐ **مربّعٌ مربوطٌ عمداً**: م14 تشترط أن **لا يقع أمرُ المربّع**
             // حين تدور العجلةُ على الزرّ — **وبلا ربطٍ يصدق الشرطُ بلا معنى**
             // (وهو «شرطٌ يُختبَر حيث لا تقع الظاهرة»، أخو «حالٍ لم تُنتَج»).
             wheel: { map: { "4": { up: ["ACTION:VOLUME:+5"], down: ["ACTION:VOLUME:-5"] },
                             "5": { up: ["ACTION:VOLUME:+5"], down: ["ACTION:VOLUME:-5"] } } } }
  },
  globalSiteRules: { enabled: true, mappings: [] }
};

const STATE = `(() => {
  const vis = (s) => { const e = document.querySelector(s);
    return e ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : null; };
  const v = document.querySelector("video");
  return { صنفُنا: document.documentElement.classList.contains("vz-idle-hide-progress"),
           شريط: vis(".ytp-chrome-bottom"), وقت: vis(".ytp-time-display"),
           أزرار: vis(".ytp-right-controls"), عنوان: vis(".ytp-fullscreen-metadata"),
           صفُّ_إجراءات: vis(".ytp-fullscreen-quick-actions"),
           زرُّ_المزيد: vis(".ytp-fullscreen-grid-expand-button"),
           سينما: vis(".ytp-size-button"), زرُّ_السرعة: vis(".vzSpeedBtn"),
           سرعة: v ? v.playbackRate : null, صوت: v ? Math.round(v.volume * 100) : null }; })()`;

async function run() {
  const extPath = RED ? extAt(RED) : ROOT;
  const h = await launch(PORT, { extPath, extra: ["--window-size=1600,1000"] });
  const R = {};
  try {
    await sleep(1200);
    await configure(PORT, h.extensionId, SETTINGS);
    const { c } = await openPageAsHost(PORT, { html: HTML,
      contentType: "application/xhtml+xml; charset=utf-8" });
    await sleep(2500);
    const w = (await contentWorld(c))?.id;
    if (!w) throw new Error("عالمُ الإضافة غائب — ولا يُقاس بلا عالم");
    R.anchors = await evalIn(c, `(() => { const q = (s) => document.querySelectorAll(s).length;
      const st = document.querySelector("style[data-vz-snapshot-css]");
      return { ytp: q('[class*="ytp-"]'), bottom: q(".ytp-chrome-bottom"),
               cssBytes: st ? st.textContent.length : 0,
               cssFrom: st ? st.getAttribute("data-vz-from") : null,
               host: location.hostname }; })()`, w);
    const v = await evalIn(c, `(() => { const el = document.querySelector("video");
      if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
               w: Math.round(r.width), h: Math.round(r.height) }; })()`, w);
    R.v = v;
    // ⚠️ **يُقرأ حالُ طبقتنا قبل الحكم** — **«لا زرّ» قد تعني «لم تُبنَ الطبقة»
    // وقد تعني «بُنيت ولم يُحقن»، وهما سببان لا واحد** (قرار 42).
    R.طبقة = await evalIn(c, `(() => ({
      طبقتُنا: document.querySelectorAll(".vzWrap").length,
      أزرارُنا: document.querySelectorAll(".vzBtn").length,
      في_الشريط: document.querySelectorAll(".ytp-right-controls .vzBtn").length,
      منظور: innerWidth + "x" + innerHeight,
      مستطيلُ_الفيديو: (() => { const e = document.querySelector("video");
        if (!e) return null; const r = e.getBoundingClientRect();
        return Math.round(r.width)+"x"+Math.round(r.height)+"@"+Math.round(r.left)+","+Math.round(r.top); })()
    }))()`, w);
    const until = async (pred, ms = 12000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const st = await evalIn(c, STATE, w);
        if (st && pred(st)) return { ...st, بعد_ms: Date.now() - t0 };
        await sleep(150);
      }
      return { ...(await evalIn(c, STATE, w)), بعد_ms: null, انقضت_المهلة_ms: ms };
    };
    const مخفيّ = (st) => st.صنفُنا === true && st.شريط === false;
    const move = async (n = 6) => { for (let i = 0; i < n; i++) {
      await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: v.x + (i % 2 ? 8 : -8), y: v.y + 4 });
      await sleep(120); } };

    R.قبل = await evalIn(c, STATE, w);

    // ── م12: يختفي بكامله في ملء الشاشة (كما م1 في النافذة) ────────────────
    await move();
    R.م12 = await until(مخفيّ);

    // ── م13: مسكُ الزرّ بلا حركة ⇒ يبقى تحت اليد ───────────────────────────
    // ⛔ **الحالُ تُنتَج: يُظهَر أوّلاً ثمّ يُضغَط ويُترك مضغوطاً** — **وقياسٌ
    // على شريطٍ مخفيٍّ سلفاً يقيس الإخفاء لا الامتناع.**
    await move(2);
    await sleep(300);
    await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: v.x, y: v.y + Math.round(v.h / 2) - 20, button: "left", clickCount: 1 });
    await sleep(IDLE_MS * 6);
    R.م13 = await evalIn(c, STATE, w);
    await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: v.x, y: v.y + Math.round(v.h / 2) - 20, button: "left", clickCount: 1 });

    // ── م14: العجلةُ على زرّ السرعة تُغيّر السرعة ولا تُنفّذ أمرَ المربّع ──
    await move(3);
    const btn = await evalIn(c, `(() => { const b = document.querySelector(".vzSpeedBtn");
      if (!b || !b.checkVisibility({ opacityProperty: true })) return null;
      const r = b.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`, w);
    R.زرّ = btn;
    if (btn) {
      R.م14قبل = await evalIn(c, STATE, w);
      await c.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: btn.x, y: btn.y, deltaX: 0, deltaY: -40 });
      await sleep(600);
      R.م14 = await evalIn(c, STATE, w);
    }
    try { c.ws.close(); } catch {}
  } finally {
    killChrome(h);
    if (RED) { try { fs.rmSync(extPath, { recursive: true, force: true }); } catch {} }
  }
  return R;
}

console.log(`\n=== #112 — ملءُ الشاشة على لقطةٍ محفوظة ===`);
console.log(`  الشجرة: ${treeFile}`);
console.log(`  الأنماط: ${cssFile} (${Math.round(CSS.text.length / 1024)} KB)`);
if (RED) console.log(`  ⚠️ **شاهدُ حمرة**: content.js من \`${RED}\``);

const r = await run();

console.log("\n[0] المراسي — تُؤكَّد قبل أن يُقاس شيء");
check("[0] الصفحةُ تحت اسم المضيف", r.anchors?.host === "www.youtube.com", r.anchors);
check("[0] ⭐⭐ وأنماطُ اللقطة الأولى مُحقَنةٌ في شجرة الثانية",
  (r.anchors?.cssBytes || 0) > 4000000 && !!r.anchors?.cssFrom, r.anchors);
console.log(`  · طبقتُنا: ${JSON.stringify(r.طبقة)}`);
check("[0] وعناصرُ المشغّل حاضرة", (r.anchors?.ytp || 0) > 400 && r.anchors?.bottom === 1, r.anchors);
check("[0] ⭐ وتخطيطُ ملء الشاشة مُلتقَطٌ لا مُصطنَع: العنوانُ وصفُّ الإجراءات وزرُّ المزيد",
  r.قبل?.عنوان === true && r.قبل?.صفُّ_إجراءات === true && r.قبل?.زرُّ_المزيد === true, r.قبل);
check("[0] ⭐ ووضعُ السينما مخفيٌّ كما هو حيّاً", r.قبل?.سينما === false, r.قبل);
if (fail) {
  console.log("\n⛔ **المراسي لم تُؤكَّد — ولا يُقرأ ما بعدها.**");
  console.log(`\n❌ نجح ${pass} / فشل ${fail}\n`); process.exit(1);
}

console.log("\n[1] م12 — الشريطُ يختفي بكامله في ملء الشاشة");
check("[1] ⭐⭐ (م12) صنفُنا مطبَّقٌ والشريطُ اختفى — تقدّمٌ ووقتٌ وأزرارٌ معاً",
  r.م12?.صنفُنا === true && r.م12?.شريط === false &&
  r.م12?.وقت === false && r.م12?.أزرار === false, r.م12);

console.log("\n[2] م13 — مسكُ الزرّ بلا حركة: الشريطُ باقٍ تحت اليد");
check("[2] ⭐⭐ (م13) لا يُخفى تحت يدٍ ماسكة", r.م13?.شريط === true && r.م13?.صنفُنا === false, r.م13);

console.log("\n[3] م14 — العجلةُ على زرّ السرعة");
check("[3] زرُّ السرعة ظاهرٌ ليُقاس", !!r.زرّ, r.زرّ);
check("[3] ⭐⭐ (م14) العجلةُ تُغيّر السرعة",
  r.م14 && r.م14قبل && r.م14.سرعة !== r.م14قبل.سرعة, { قبل: r.م14قبل?.سرعة, بعد: r.م14?.سرعة });
// ⛔ **والنصفُ الثاني من الوعد**: أمرُ المربّع **لا يقع** — والصوتُ شاهدُه
check("[3] ⭐⭐ (م14) ولا يقع أمرُ المربّع (الصوتُ لم يتغيّر)",
  r.م14 && r.م14قبل && r.م14.صوت === r.م14قبل.صوت, { قبل: r.م14قبل?.صوت, بعد: r.م14?.صوت });

if (RED) {
  console.log(`\n⇒ **شاهدُ الحمرة**: ${fail > 0
    ? `✅ احمرَّ بـ${fail} — فالرِكازُ يمسك ما بُني له`
    : "❌ **لم يُحمّر — ولا يُصدَّق أخضرُه بعد اليوم**"}`);
  console.log(`\n${fail ? "✅" : "❌"} (مقلوبٌ في وضع الحمرة) نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 0 : 1);
}
console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
