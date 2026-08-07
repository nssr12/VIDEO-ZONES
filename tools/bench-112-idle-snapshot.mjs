// #112 — **إخفاءُ شريط المضيف بالسكون، على لقطةٍ محفوظة وصفحةٍ نظيفة** (م1 · م2 · م3 · م4 · م22).
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يحمّل لقطةً وزنُها نحوُ
// خمسة ميغابايت **وينتظر مهلَ سكونٍ حقيقيّة**، فثمنُه في كلّ كومِت بلا مقابل.
// **ومُطلِقُه: كلُّ مسٍّ لمحرّك السكون أو مستهلكيه، ورفعُ النسخة.**
//
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أرفع يدي عن الفأرة — أيختفي شريطُ
// يوتيوب كلُّه كما وعدتُ، ويعود بأوّل نقرةٍ أو عجلة؟»*
//
// ⛔⭐⭐ **ولماذا رِكازٌ مستقلٌّ لا قسمٌ في `bench-112-host-snapshot`** (قرار 125
// بحرفه، وقرارُ المالك 2026-08-07): **كلُّ قسمٍ يُنتج حالَه أو يقيسها، والوراثةُ
// اعتمادٌ على ترتيبٍ غير مضمون.** ⇒ **وموضوعُ هذا الرِكاز بعينه هو السكون** —
// **فتشغيلُه بعد أقسامٍ تنقر وتسحب وتُمرّر هو أن يُطلَب منه إثباتُ الهدوء في غرفةٍ
// خرج منها أحدُهم للتوّ.**
// ⚠️ **والفصلُ لا يُغلق السؤال** (قرار 42): **إن أنتج المستقلُّ الحالَ فذاك تأكيدٌ
// للسبب، وإن لم يُنتجها فالتسلسلُ لم يكن السبب ويُطلَب من جديد** — ⛔ **ولا يُقرأ
// «الآن يعمل» إغلاقاً بلا معرفة لماذا لم يكن يعمل.**
//
// ⛔⭐⭐ **واللقطةُ هنا أنقى من الحيّ لا أضعف — وهو انعكاسُ قرار 48 لا استثناءٌ منه:**
// **سكربتاتُ يوتيوب منزوعةٌ منها** ⇒ **فهو لا يُخفي شريطَه من تلقائه** ⇒ **كلُّ
// إخفاءٍ فيها إخفاؤنا بالبناء.** ⚠️ **وعلى الحيّ خلطَ هذا مِجَسَّ #70 نفسَه**
// (قِيس `opacity === 0` فحُسب إخفاؤنا وهو إخفاءُ يوتيوب بعد ~3 ثوانٍ).
//
// ⚠️ **وحدُّ كلّ شرطٍ هنا: حالٌ واحدة (صفحةُ مشاهدة · نافذة) · بلا تشغيلٍ حيّ ·
// وبلا انتقال SPA** — **فلا يُقرأ أخضرُه خارج مداه.**
//
//   node tools/bench-112-idle-snapshot.mjs
//   node tools/bench-112-idle-snapshot.mjs --red <commit>    # على `content.js` من السجلّ
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { launch, openPageAsHost, contentWorld, evalIn, killChrome, configure, ROOT }
  from "./ext-harness.mjs";

const PORT = 9809;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RED = (() => { const i = process.argv.indexOf("--red"); return i > 0 ? process.argv[i + 1] : null; })();

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra === undefined ? "" : JSON.stringify(extra).slice(0, 200)));

const SNAP_DIR = path.join(ROOT, "tools", "snapshots");
const snapFile = fs.existsSync(SNAP_DIR)
  ? fs.readdirSync(SNAP_DIR).filter((f) => f.endsWith(".xhtml")).sort().pop() : null;
if (!snapFile) { console.log("❌ لا لقطةَ في tools/snapshots — `node tools/capture-yt-snapshot.mjs`"); process.exit(1); }
const HTML = fs.readFileSync(path.join(SNAP_DIR, snapFile), "utf8");

function extAt(commit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vz-idle-red-"));
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
    zones: { enabled: true, fullscreenOnly: false, gridCoverage: "player", wheel: { map: {} } }
  },
  globalSiteRules: { enabled: true, mappings: [] }
};

// ⭐ **الرؤيةُ بـ`checkVisibility` لا بالمستطيل**: إخفاؤنا **شفافيةٌ على الحاوية**،
// وابنُها شفافيتُه `1` — **و«مستطيلٌ غيرُ صفريّ» يطبع «مرئيّ» عن مخفيّ** (الأعمى
// الأوّل، قرار 26). ⇒ **ويُقرأ صنفُنا معه: الأثرُ لا يقول من فعل** (قرار 48).
const STATE = `(() => {
  const vis = (s) => { const e = document.querySelector(s);
    return e ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : null; };
  return { صنفُنا: document.documentElement.classList.contains("vz-idle-hide-progress"),
           شريط: vis(".ytp-chrome-bottom"), وقت: vis(".ytp-time-display"),
           أزرار: vis(".ytp-right-controls"), تقدّم: vis(".ytp-progress-bar-container"),
           زرُّ_السرعة: vis(".vzSpeedBtn") }; })()`;

const CENTER = `(() => { const el = document.querySelector("video");
  if (!el) return null; const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
           w: Math.round(r.width), h: Math.round(r.height) }; })()`;

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
    R.v = await evalIn(c, CENTER, w);

    // ⭐ **ويُنشر الزمنُ مع الحال**: حكمٌ بلا زمنٍ يُخفي «وقع متأخّراً» في «لم يقع».
    // ⛔⭐⭐ **يُنتظر الأثرُ لا السببُ وحدَه** (قرار 109: أموجود؟ · **أوقع الأثر؟**):
    // **أوّلُ صياغةٍ انتظرت الصنفَ وحدَه فعادت عند 305ms والشريطُ ما زال مرئيّاً**
    // ⇒ **فقرأت «صنفٌ مطبَّقٌ بلا أثر» — وهو أثرٌ لم يُنتظَر لا أثرٌ غائب**،
    // **وقياسٌ مستقلٌّ بعد 1200ms أعطى شفافيةً صفراً ورؤيةً كاذبة.**
    // ⇒ ⭐ **فالشرطُ يجمع الاثنين: سببُنا (الصنف) والأثرُ على الهدف.**
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
    const ظاهر = (st) => st.صنفُنا === false && st.شريط === true;
    const move = async (n = 6) => {
      for (let i = 0; i < n; i++) {
        await c.send("Input.dispatchMouseEvent",
          { type: "mouseMoved", x: R.v.x + (i % 2 ? 8 : -8), y: R.v.y + 4 });
        await sleep(120);
      }
    };

    // ── م4 أوّلاً: **الصفحةُ لم تُلمس بعد** ────────────────────────────────
    // ⛔ **ولا نلمس المضيفَ بمبادرةٍ منّا قبل أن نرى نشاطاً ولو مرّة.**
    await sleep(IDLE_MS * 4);
    R.م4 = await evalIn(c, STATE, w);

    // ── م1: حركةٌ ثمّ رفعُ اليد ⇒ يختفي **بكامله** ────────────────────────
    await move();
    R.م1 = await until(مخفيّ);
    // ── م22: وزرُّنا يختفي معه — في الحال المُنتَجة نفسِها، لا بتشغيلةٍ ثانية
    R.م22 = R.م1;

    // ── م2: نقرةٌ داخل الصورة ⇒ يعود فوراً ────────────────────────────────
    await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: R.v.x, y: R.v.y, button: "left", clickCount: 1 });
    await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: R.v.x, y: R.v.y, button: "left", clickCount: 1 });
    R.م2 = await until(ظاهر, 4000);

    // ── م3: يُترك ليختفي (حالٌ تُنتَج) ثمّ عجلةٌ ⇒ يعود ────────────────────
    R.م3قبل = await until(مخفيّ);
    await c.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: R.v.x, y: R.v.y, deltaX: 0, deltaY: -40 });
    R.م3 = await until(ظاهر, 4000);
    try { c.ws.close(); } catch {}
  } finally {
    killChrome(h);
    if (RED) { try { fs.rmSync(extPath, { recursive: true, force: true }); } catch {} }
  }
  return R;
}

console.log(`\n=== #112 — السكونُ على لقطةٍ محفوظة (صفحةٌ نظيفة) ===`);
console.log(`  اللقطة: ${snapFile} · مهلةُ السكون: ${IDLE_MS}ms`);
if (RED) console.log(`  ⚠️ **شاهدُ حمرة**: content.js من \`${RED}\` — **يُنتظر منه أن يُحمّر**`);

const r = await run();
console.log(`  الفيديو: ${JSON.stringify(r.v)}`);

console.log("\n[1] م4 — بلا أيّ نشاطٍ: لا يُخفى شيءٌ أبداً");
check("[1] (م4) الصنفُ غيرُ مطبَّق والشريطُ ظاهر",
  r.م4 && r.م4.صنفُنا === false && r.م4.شريط === true, r.م4);

console.log("\n[2] م1 — حركةٌ ثمّ رفعُ اليد ⇒ الشريطُ يختفي بكامله");
check("[2] ⭐⭐ (م1) صنفُنا مطبَّقٌ بعد المهلة", r.م1 && r.م1.صنفُنا === true, r.م1);
check("[2] ⭐⭐ (م1) والشريطُ يختفي **بكامله** — تقدّمٌ ووقتٌ وأزرارٌ معاً",
  r.م1 && r.م1.شريط === false && r.م1.وقت === false &&
  r.م1.أزرار === false && r.م1.تقدّم === false, r.م1);

console.log("\n[3] م22 — وزرُّ السرعة يختفي مع الشريط");
// ⭐ **لا بمنطقٍ ثانٍ**: الزرُّ ابنٌ في الشريط، **والشريطُ يملك ظهورَ أبنائه** —
// وهو ما يُعلنه مستهلكُ #72 بنصّه (`onIdle` يمتنع حين يكون في الشريط).
check("[3] ⭐ (م22) زرُّ السرعة غيرُ مرئيٍّ في الحال المُخفاة", r.م22 && r.م22.زرُّ_السرعة === false, r.م22);

console.log("\n[4] م2 · م3 — ويعود بأوّل نشاط");
check("[4] (م2) نقرةٌ داخل الصورة تُعيده", r.م2 && r.م2.صنفُنا === false && r.م2.شريط === true, r.م2);
check("[4] (م3) ويختفي ثانيةً — حالٌ تُنتَج قبل القياس", r.م3قبل && r.م3قبل.صنفُنا === true, r.م3قبل);
check("[4] ⭐ (م3) وعجلةٌ فوق المشغّل تُعيده", r.م3 && r.م3.صنفُنا === false && r.م3.شريط === true, r.م3);

if (RED) {
  console.log(`\n⇒ **شاهدُ الحمرة**: ${fail > 0
    ? `✅ احمرَّ بـ${fail} — فالرِكازُ يمسك ما بُني له`
    : "❌ **لم يُحمّر — ولا يُصدَّق أخضرُه بعد اليوم**"}`);
  console.log(`\n${fail ? "✅" : "❌"} (مقلوبٌ في وضع الحمرة) نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 0 : 1);
}
console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
