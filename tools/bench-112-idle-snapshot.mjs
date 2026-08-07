// #112 — **إخفاءُ شريط المضيف بالسكون، على لقطةٍ محفوظة وصفحةٍ نظيفة**.
// **المرفوعُ عن المالك: م1 · م2 · م3 · م4** — ⛔ **و`م5` و`م22` مقيستان ولا تُرفعان.**
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يحمّل لقطةً وزنُها نحوُ
// خمسة ميغابايت **وينتظر مهلَ سكونٍ حقيقيّة**، فثمنُه في كلّ كومِت بلا مقابل.
// **ومُطلِقُه: كلُّ مسٍّ لمحرّك السكون أو مستهلكيه، ورفعُ النسخة.**
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أرفع يدي عن الفأرة — أيختفي شريطُ
// يوتيوب كلُّه كما وعدتُ، ويعود بأوّل نقرةٍ أو عجلة، ويبقى تحت يدي وأنا ماسكُه؟»*
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
// ── ⛔⭐⭐ ومراسٍ قبل كلّ شيء — **وغيابُها كان يُنتج خضرةً كاذبة** (2026-08-07) ──
// **هذا الرِكازُ لم يكن له قسمُ مراسٍ أصلاً**، ويومَ وُلدت لقطةٌ ثانية انقلب
// اختيارُه إليها **بلا أن يُمسّ سطرٌ فيه** ⇒ **فقاس شجرةً بلا أنماط، والفيديو عند
// `y=3697` خارجَ منظورٍ ارتفاعُه 1000** — ⛔ **وطبع `م4` و`م2` خضراوين**: لا شيء
// يقع فلا شيء يُخفى، **فقُرئ غيابُ الأثر وفاءً بالوعد.** ⇒ **وهي «غيابُ الإشارة
// يُقرأ إثباتاً» في رِكازٍ يحرس خمسَ خطواتٍ رُفعت عن المالك.**
//
// ⚠️ **وحدُّ كلّ شرطٍ هنا: حالٌ واحدة (صفحةُ مشاهدة · نافذة) · بلا تشغيلٍ حيّ ·
// وبلا انتقال SPA** — **فلا يُقرأ أخضرُه خارج مداه.**
//
//   node tools/bench-112-idle-snapshot.mjs
//   node tools/bench-112-idle-snapshot.mjs --red <commit>       # `content.js` من السجلّ
//   node tools/bench-112-idle-snapshot.mjs --red-file <ملفّ>    # بمتغيّرٍ واحد
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { launch, openPageAsHost, applyReplay, contentWorld, evalIn, killChrome, configure,
         refuseUnknownFlags, ROOT } from "./ext-harness.mjs";
import { loadSnapshot, frozenVideoBox, REPLAY_ANCHORS, STATE_WINDOW } from "./snapshot-source.mjs";

const PORT = 9809;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const argOf = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const RED = argOf("--red");
const RED_FILE = argOf("--red-file");
refuseUnknownFlags(["--red", "--red-file"]);

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra === undefined ? "" : JSON.stringify(extra).slice(0, 200)));

// **اللقطةُ تُطلَب بحالها لا بترتيب الأسماء** — انظر `snapshot-source.mjs`
const snap = loadSnapshot(STATE_WINDOW);
const HTML = snap.html;
const FROZEN = frozenVideoBox(HTML);
if (!FROZEN) { console.log("❌ لا صندوقَ مُجمَّداً في `style` الفيديو — ولا مرجعَ يُحكم به على إعادة التشغيل"); process.exit(1); }

function extWith(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vz-idle-red-"));
  for (const f of fs.readdirSync(ROOT)) {
    if ([".git", "node_modules", "tools", "docs"].includes(f)) continue;
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  fs.writeFileSync(path.join(dir, "content.js"), source);
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

async function run() {
  const extPath = RED ? extWith(execFileSync("git", ["show", `${RED}:content.js`], { cwd: ROOT, maxBuffer: 64e6 }))
    : RED_FILE ? extWith(fs.readFileSync(RED_FILE))
    : ROOT;
  // ⛔ **مقاسُ النافذة يُشتقّ من ترويسة اللقطة ولا يُكتب** (قرار 34 في رِكاز)
  const h = await launch(PORT, { extPath,
    extra: [`--window-size=${snap.replay.viewport.w},${snap.replay.viewport.h}`] });
  const R = {};
  try {
    await sleep(1200);
    await configure(PORT, h.extensionId, SETTINGS);
    const { c } = await openPageAsHost(PORT, { html: HTML,
      contentType: "application/xhtml+xml; charset=utf-8" });
    await sleep(2500);
    // ⛔⭐⭐ **تُنتَج شروطُ اللقطة ثمّ يُقاس** — **ولا نلمس الصفحة بعدها**: `م4`
    // تشترط صفحةً لم تُلمس، **وضبطُ المنظور ليس لمساً** (لا حدثَ مؤشّرٍ فيه).
    R.أُنتج = await applyReplay(c, snap.replay);
    await sleep(600);
    const w = (await contentWorld(c))?.id;
    if (!w) throw new Error("عالمُ الإضافة غائب — ولا يُقاس بلا عالم");
    R.anchors = await evalIn(c, `(() => { const q = (s) => document.querySelectorAll(s).length;
      const st = document.querySelector("style[data-vz-snapshot-css]");
      return { ytp: q('[class*="ytp-"]'), bottom: q(".ytp-chrome-bottom"),
               cssBytes: st ? st.textContent.length : 0, host: location.hostname }; })()`, w);
    R.مرساة = await evalIn(c, REPLAY_ANCHORS, w);
    // ⚠️ **الإحداثيّاتُ المطلقة للقيادة، والنسبيّةُ للمقارنة** — ولا يُخلط البابان
    const f = R.مرساة.فيديو, abs = R.مرساة.مطلقٌ;
    R.v = { x: abs.left + Math.round(f.w / 2), y: abs.top + Math.round(f.h / 2), w: f.w, h: f.h };

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

    // ── م5: مسكُ شريط التقدّم بلا حركة ⇒ يبقى تحت اليد ─────────────────────
    // ⛔⭐ **الحالُ تُنتَج ولا تُورَث**: يُظهَر الشريطُ أوّلاً **ثمّ** يُضغَط —
    // **وقياسٌ على شريطٍ مخفيٍّ سلفاً يقيس الإخفاء لا الامتناع.**
    // ⚠️ **والموضعُ شريطُ التقدّم بعينه لا مركزُ الصورة**: الخطوةُ تقول «اضغط
    // شريط التقدّم»، **ومركزُ الصورة يُنتج امتناعاً بمسارٍ آخر** (`idlePointerHeld`
    // يرتفع بأيّ ضغطٍ داخل المشغّل) ⇒ **فيصدق الشرطُ على غير ما وُعد به.**
    await move(3);
    R.م5موضع = await evalIn(c, `(() => { const el = document.querySelector(".ytp-progress-bar-container")
        || document.querySelector(".ytp-progress-bar");
      if (!el) return null; const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return null;
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
               داخلَ_المنظور: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; })()`, w);
    if (R.م5موضع?.داخلَ_المنظور) {
      await c.send("Input.dispatchMouseEvent",
        { type: "mousePressed", x: R.م5موضع.x, y: R.م5موضع.y, button: "left", clickCount: 1 });
      // ⚠️ **يُنتظر أطولُ من المهلة بأضعاف** — «لم يُخفَ بعدُ» ليست «لا يُخفى»
      await sleep(IDLE_MS * 6);
      R.م5 = await evalIn(c, STATE, w);
      // ⭐ **ويُقاس سببُنا لا أثرُه وحدَه** (قرار 48): للامتناع هنا **سببان
      // مُعلَنان في الكود** — `idlePointerHeld` **و**`focusInside(".ytp-chrome-bottom")`،
      // **والأثرُ واحدٌ فيهما** ⇒ **فقراءةُ الأثر لا تقول أيُّهما فعل** (قرار 42).
      // ⚠️ **الغيابُ يُسمّى ولا يُبتلع ولا يُوقف التشغيلة**: `vzIdleSnapshot` وُلدت
      // مع #86، **فبناءٌ أقدمُ منها لا يملكها** — **و«غائبة» خبرٌ لا رمية.**
      R.م5حال = await evalIn(c, `(typeof vzIdleSnapshot === "function" ? vzIdleSnapshot() : { غائبة: true })`, w);
      R.م5تركيز = await evalIn(c, `(() => { const a = document.activeElement;
        return { داخلَ_الشريط: !!(a && a.closest && a.closest(".ytp-chrome-bottom")),
                 عنصر: a ? (a.className || a.tagName).toString().slice(0, 40) : null }; })()`, w);
      await c.send("Input.dispatchMouseEvent",
        { type: "mouseReleased", x: R.م5موضع.x, y: R.م5موضع.y, button: "left", clickCount: 1 });
      await sleep(IDLE_MS * 3);
      R.م5بعد = await evalIn(c, `(typeof vzIdleSnapshot === "function" ? vzIdleSnapshot() : { غائبة: true })`, w);
    }
    try { c.ws.close(); } catch {}
  } finally {
    killChrome(h);
    if (extPath !== ROOT) { try { fs.rmSync(extPath, { recursive: true, force: true }); } catch {} }
  }
  return R;
}

console.log(`\n=== #112 — السكونُ على لقطةٍ محفوظة (صفحةٌ نظيفة) ===`);
console.log(`  اللقطة: ${snap.file} · مهلةُ السكون: ${IDLE_MS}ms`);
console.log(`  الشروطُ المسجَّلة: منظور ${snap.replay.viewport.w}×${snap.replay.viewport.h}` +
  ` · ملءُ الشاشة على ${snap.replay.fullscreenSelector || "لا شيء"}`);
console.log(`  وصندوقُ المضيف المُجمَّد: ${FROZEN.w}x${FROZEN.h}@${FROZEN.left},${FROZEN.top}`);
if (RED) console.log(`  ⚠️ **شاهدُ حمرة**: content.js من \`${RED}\` — **يُنتظر منه أن يُحمّر**`);
if (RED_FILE) console.log(`  ⚠️ **شاهدُ حمرة بمتغيّرٍ واحد**: ${RED_FILE}`);

const r = await run();

console.log("\n[0] المراسي — تُؤكَّد قبل أن يُقاس شيء");
console.log(`  · أُنتج: ${JSON.stringify(r.أُنتج)} · الفيديو: ${JSON.stringify(r.v)}`);
check("[0] الصفحةُ تحت اسم المضيف", r.anchors?.host === "www.youtube.com", r.anchors);
check("[0] وأوراقُ الأنماط مُضمَّنةٌ وغيرُ فارغة", (r.anchors?.cssBytes || 0) > 100000, r.anchors);
check("[0] وعناصرُ المشغّل حاضرة", (r.anchors?.ytp || 0) > 400 && r.anchors?.bottom === 1, r.anchors);
check("[0] ⭐ والمنظورُ كما سُجّل في الترويسة",
  r.مرساة?.منظور?.w === snap.replay.viewport.w && r.مرساة?.منظور?.h === snap.replay.viewport.h,
  { الآن: r.مرساة?.منظور, المسجَّل: snap.replay.viewport });
// ⭐⭐ **المرساةُ التي تجعل الرقمَ المسجَّل غيرَ قابلٍ للتخلّف صامتاً**
check("[0] ⭐⭐ والفيديو يوافق ما جمّده المضيف بحرفه — لا تخطيطاً آخر باسمه",
  r.مرساة?.فيديو?.w === FROZEN.w && r.مرساة?.فيديو?.h === FROZEN.h &&
  r.مرساة?.فيديو?.left === FROZEN.left && r.مرساة?.فيديو?.top === FROZEN.top,
  { الحيّ: r.مرساة?.فيديو, المُجمَّد: FROZEN });
check("[0] ⭐⭐ وهو **داخل المنظور** — لا موجودٌ وحسب", r.مرساة?.داخلَ_المنظور === true, r.مرساة);
if (fail) {
  console.log("\n⛔ **المراسي لم تُؤكَّد — ولا يُقرأ ما بعدها**: أصفارُها «لم أُنتج الحال» لا «سليم».");
  console.log(`\n❌ نجح ${pass} / فشل ${fail}\n`); process.exit(1);
}

console.log("\n[1] م4 — بلا أيّ نشاطٍ: لا يُخفى شيءٌ أبداً");
check("[1] (م4) الصنفُ غيرُ مطبَّق والشريطُ ظاهر",
  r.م4 && r.م4.صنفُنا === false && r.م4.شريط === true, r.م4);

console.log("\n[2] م1 — حركةٌ ثمّ رفعُ اليد ⇒ الشريطُ يختفي بكامله");
check("[2] ⭐⭐ (م1) صنفُنا مطبَّقٌ بعد المهلة", r.م1 && r.م1.صنفُنا === true, r.م1);
check("[2] ⭐⭐ (م1) والشريطُ يختفي **بكامله** — تقدّمٌ ووقتٌ وأزرارٌ معاً",
  r.م1 && r.م1.شريط === false && r.م1.وقت === false &&
  r.م1.أزرار === false && r.م1.تقدّم === false, r.م1);

// ── ⚪⛔⭐⭐ م22 — **أُعيدت إلى قائمة المالك 2026-08-08، والسببُ قياسٌ لا عجز** ──
//
// ⛔ **كانت مرفوعةً بشاهدٍ من السجلّ (`8ee1852~1`) — والشاهدُ يُحمّرها بسببٍ ليس
// سببَها**: هناك **لا زرَّ أصلاً** (`زرُّ_السرعة: null`)، **و«غائب» ليس «ظاهرٌ
// تحت شريطٍ مخفيّ»** — وهو صنفُ العمى الأوّل في قرار 26 واقعاً في **شاهدِ حمرة**
// لا في مِجَسّ: **«لا يوجد» و«العطبُ واقع» يُحمّران الشرطَ نفسَه.**
//
// ⭐⭐ **وثلاثُ محاولاتٍ لإيجاد حمرةٍ بسببها هي، وثلاثتُها سقطت بالقياس:**
//   **(١)** متغيّرٌ واحد: يُخرَج الزرُّ من شريط المضيف إلى طبقتنا ⇒ **أخضر 13/0.**
//   **(٢)** من السجلّ `be4a1ba~1` (**قبل #85، والزرُّ في طبقتنا**) ⇒ **أخضر.**
//   **(٣)** ومن السجلّ `8ee1852~1` ⇒ **أحمر — بغياب الزرّ لا بظهوره.**
// ⇒ **والسببُ مكتوبٌ في `tools/CHECKLIST.md` بنصّه منذ #85: «الزرّ صار من الشريط،
// فيختفي بإخفاء المضيف وبإخفائنا معاً»** — ⭐ **فالضمانتان مقصودتان بالتصميم،
// وكلٌّ منهما تكفي** ⇒ **لا متغيّرَ واحدٌ يُسقط الوعد.**
// ⇒ ⭐⭐ **وهي أختُ `م5` بحرفها: أخضرُ منسوبٌ إلى أكثر من سبب لا يقول «لأنّا
// فعلنا»** ⇒ **شرطٌ لا يستطيع أن يُحمّر ليس حارساً** (قرار 26 · 47).
// ⚠️ **وإبقاؤها آليّةً بشاهدٍ من غير بابها أسوأ من إعادتها**: يُقرأ اسمُها في
// «انتقلت إلى الآليّ» **وليس تحته مسمّى** — وهو الدَّينُ الذي كُشف اليوم بعينه.
// 🔔 **ومُطلِقُ رفعِها: صياغةٌ يسقط فيها الوعدُ بمتغيّرٍ واحد.**
console.log("\n[3] ⚪ م22 — مقيسةٌ ولا تُرفع (ضمانتان مقصودتان، وكلٌّ تكفي)");
console.log(`  ⚪ زرُّ السرعة في الحال المُخفاة: ${r.م22?.زرُّ_السرعة}` +
  `  ⇒ ${r.م22?.زرُّ_السرعة === false ? "موافقٌ للمتوقَّع"
      : r.م22?.زرُّ_السرعة === null ? "**لا زرَّ أصلاً — وهي حالٌ أخرى لا عطب**"
      : "**مخالف — يُبلَّغ**"}`);

console.log("\n[4] م2 · م3 — ويعود بأوّل نشاط");
check("[4] (م2) نقرةٌ داخل الصورة تُعيده", r.م2 && r.م2.صنفُنا === false && r.م2.شريط === true, r.م2);
check("[4] (م3) ويختفي ثانيةً — حالٌ تُنتَج قبل القياس", r.م3قبل && r.م3قبل.صنفُنا === true, r.م3قبل);
check("[4] ⭐ (م3) وعجلةٌ فوق المشغّل تُعيده", r.م3 && r.م3.صنفُنا === false && r.م3.شريط === true, r.م3);

// ── ⚪⛔⭐⭐ م5 — **مقيسةٌ ولا تُرفع، والسببُ قياسٌ لا عجز** ──────────────────
//
// **وعدُ م5: «اضغط شريط التقدّم وأمسكه بلا حركة ⇒ الشريط باقٍ تحت يدك».**
// **وهو أخضرُ هنا — ⛔ وأخضرُه غيرُ منسوب، فلا يصلح حارساً.**
//
// ⭐⭐ **والمقيس: ثلاثةُ أسبابٍ مُعلَنةٍ في الكود تُبقي الشريطَ في هذي الحال
// بعينها، وكلٌّ منها يكفي وحدَه** ⇒ **فلا متغيّرَ واحدٌ يستطيع أن يُحمّرها:**
//   **(١)** `idlePointerHeld` — الزرُّ ممسوك.
//   **(٢)** `focusInside(".ytp-chrome-bottom")` — **و`.ytp-progress-bar` يحمل
//        `tabindex="0"`** ⇒ **الضغطةُ تُركّزه**، مقيسٌ: `activeElement = ytp-progress-bar`.
//   **(٣)** `pointerInsideEl(target)` (#95) — **المؤشّرُ مستقرٌّ على الشريط نفسِه**،
//        **وهو موضعُ الضغط بالضرورة**.
// ⇒ **ومُثبَتٌ بالتشغيل لا بالقراءة**: أُزيل (١) وحدَه ⇒ **لم يُحمّر**، ثمّ
// أُزيل (١) و(٢) معاً ⇒ **لم يُحمّر**، **والمحرّكُ يقول `state:"idle"` و`wanted:true`**
// — **أي أنه يريد الإخفاء ويمنعه (٣).**
// ⇒ ⭐⭐ **فالخضرةُ هنا تقول «لم يُخفَ» ولا تقول «لأنّا امتنعنا»** (قرار 42 · 48)،
// **وشرطٌ لا يستطيع أن يُحمّر ليس حارساً** (قرار 26 · 47). ⛔ **فتبقى م5 للمالك.**
// ⚠️ **وهي المصيدةُ نفسُها التي وقعت فيها منصّة #70** (حوّمت على 80% من الارتفاع
// فوقع المؤشّر داخل الشريط، **و#95 يمتنع بحقّ**) — **واقعةً في موضعٍ ثانٍ.**
// 🔔 **ومُطلِقُ رفعِها: صياغةٌ يستطيع فيها الوعدُ أن يسقط** — ولم تُوجد بعد،
// **فالثلاثةُ تقع معاً بحكم الفعل الذي تصفه الخطوة نفسُها.**
console.log("\n[5] ⚪ م5 — مقيسةٌ ولا تُرفع (ثلاثةُ أسبابٍ تكفي كلُّ واحدةٍ منها)");
console.log(`  ⚪ الشريطُ تحت اليد: شريط=${r.م5?.شريط} · صنفُنا=${r.م5?.صنفُنا}` +
  `  ⇒ ${r.م5?.شريط === true && r.م5?.صنفُنا === false ? "موافقٌ للمتوقَّع" : "**مخالف — يُبلَّغ**"}`);
console.log(`  ⚪ وحالُ المحرّك: ${JSON.stringify(r.م5حال)}`);
console.log(`  ⚪ والتركيز بعد الضغط: ${JSON.stringify(r.م5تركيز)}` +
  ` · و«held» بعد الإفلات: ${r.م5بعد?.held}`);

if (RED || RED_FILE) {
  console.log(`\n⇒ **شاهدُ الحمرة**: ${fail > 0
    ? `✅ احمرَّ بـ${fail} — فالرِكازُ يمسك ما بُني له`
    : "❌ **لم يُحمّر — ولا يُصدَّق أخضرُه بعد اليوم**"}`);
  console.log(`\n${fail ? "✅" : "❌"} (مقلوبٌ في وضع الحمرة) نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 0 : 1);
}
console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
