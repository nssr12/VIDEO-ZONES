// البند #110 — صفرُ رميةٍ في سكربت المحتوى على صفحةٍ حيّة
// ⛔ **من بوّابة الكومِت — يُشغَّل قبل كل كومِت.** ويحرس: **#110** — أن سكربت
// المحتوى لا يرمي على صفحةٍ فيها فيديو (والعطبُ الذي وُلد منه: #108).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تعمل الإضافةُ على صفحةٍ فيها
// فيديو، أم ترمي في صمتٍ فتُعطَّل ويثقل المتصفّح؟»*
//
// ── ⛔ لماذا وُجد هذا الملفّ (2026-08-05، من عطبٍ حيّ عند المالك) ─────────────
// **`bench-options-page.mjs` يفحص «صفر خطأ» — لصفحة الإعدادات وحدها.** ولم يكن
// لسكربت المحتوى نظيرٌ له، **وهو حيث يعيش المنتَج كلُّه**.
// ⇒ **فمرّت إضافةٌ ترمي `RangeError` عشرات المرّات على كل صفحة**، والبوّابةُ
// الثمانية خضراء و2342 تأكيداً خضراء، **والمالكُ هو من كشفها من لوحة
// `chrome://extensions`.** ⭐ **وهي عائلةُ صفحة الإعدادات الميتة مقلوبةً.**
//
// ── ما يقيسه، وحدُّه ────────────────────────────────────────────────────────
// **يقيس الرميات غير الملتقَطة وأخطاءَ الكونسول في عوالم الصفحة كلِّها** —
// **بما فيها العالم المعزول لسكربت المحتوى** — أثناء مسارٍ يُنتج الحالَ لا
// ينتظرها: عجلةٌ على الفيديو (تبني الطبقة) ثمّ كتابةُ إعدادات (تُطلق `flushReload`).
// ⚠️ **وحدُّه مُعلَن: صفحةٌ محليّة واحدة ومسارٌ واحد** — **فصفرُه «لم يرمِ في هذا
// المسار» لا «لا يرمي أبداً»**، ومسارٌ جديد يُضاف حين يُعرَف.
//
// ── ⭐ الشاهدان (قرار 26 · 47) — والموجبُ **عطبٌ حيّ من السجلّ لا مُفتعَل** ──
//   `--witness` **يُركّب `content.js` من الكومِت المكسور بنصّه** (`85ac3cf`)
//   ثمّ يُعيد ملفَّك مكانه. **وشرطُ القبول: أحمرُ هناك بـ`RangeError`، وأخضرُ هنا.**
//   ⛔ **ولا يُصدَّق أخضرُ هذا الرِكاز حتى يُرى أحمرُه على ذاك البناء.**
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import http from "node:http";
import { launch, openPage, connect, evalIn, contentWorld, configure, killChrome, waitPortFree, ROOT, EXT_NAME }
  from "./ext-harness.mjs";

const PORT = 9793, HTTP = 8893;
const BROKEN_COMMIT = "85ac3cf";
const WITNESS = process.argv.includes("--witness");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// صفحةٌ محليّة بفيديو حيّ (canvas ⇒ captureStream) — بلا شبكة ولا مضيف
const PAGE = `<!doctype html><meta charset=utf8><style>
  html,body{margin:0;background:#111} video{width:100vw;height:100vh;object-fit:cover;display:block}
</style><video id=v autoplay muted playsinline></video><script>
  const c=document.createElement("canvas");c.width=960;c.height=540;const x=c.getContext("2d");
  let t=0;(function d(){t++;x.fillStyle="hsl("+(t%360)+",50%,35%)";x.fillRect(0,0,960,540);
  requestAnimationFrame(d);})();document.getElementById("v").srcObject=c.captureStream(30);
</script>`;

const server = http.createServer((_q, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(PAGE);
}).listen(HTTP);

const CONTENT = path.join(ROOT, "content.js");
let saved = null;
function swapInBrokenBuild() {
  saved = fs.readFileSync(CONTENT, "utf8");
  const broken = execSync(`git show ${BROKEN_COMMIT}:content.js`, { cwd: ROOT, encoding: "utf8", maxBuffer: 64e6 });
  fs.writeFileSync(CONTENT, broken);
  return broken.length;
}
function restore() { if (saved !== null) { fs.writeFileSync(CONTENT, saved); saved = null; } }

let proc, code = 1;   // **الافتراض فشل**: خرْجٌ صفريّ يلزمه مسارٌ اكتمل
try {
  console.log(`\n=== #110 — صفر رميةٍ في سكربت المحتوى ${WITNESS ? "(شاهدٌ: البناء المكسور)" : ""}===\n`);
  if (WITNESS) {
    const n = swapInBrokenBuild();
    console.log(`  ⚠️ رُكّب \`content.js\` من \`${BROKEN_COMMIT}\` (${n} حرفاً) — ويُعاد ملفُّك في النهاية.`);
  }

  await waitPortFree(PORT);
  const h = await launch(PORT);
  proc = h;

  // ⛔ **الإعداداتُ تُكتب قبل فتح الصفحة** — وبلا ذلك **لا تُنتَج الحال أصلاً**:
  // المربّعاتُ خلف `remappingEnabled()` وهي **مطفأةٌ افتراضاً**، فالعجلةُ لا تُنفّذ
  // أمراً، **فلا طبقةَ تُبنى، فلا دورةَ تظهر** — **وأمسكه الشاهدُ الموجب [2] في
  // أوّل تشغيلة** (`الطبقة بُنيت = false` مع صفرِ رميات).
  // ⭐ **وهو #111 بعينه واقعاً في هذا الرِكاز وهو يُولد: ميزةٌ لا تُشغَّل لا تُقاس.**
  const SETTINGS = {
    settings: {
      enabled: true,
      idle: { ms: 300 },
      overlay: { autoHideMs: 900, volumeAutoHideMs: 900, enabled: true, hintEnabled: true },
      zones: { enabled: true, fullscreenOnly: false,
        wheel: { map: { "5": { up: ["ACTION:SPEED:+0.25"], down: ["ACTION:SPEED:-0.25"] } } } }
    },
    globalSiteRules: { enabled: true, mappings: [] }
  };
  const seeded = await configure(PORT, h.extensionId, SETTINGS);
  check("[0] الإعدادات كُتبت قبل الفتح", seeded.ok !== false, seeded);

  const c = await openPage(PORT, `http://localhost:${HTTP}/`);

  // **كلُّ رميةٍ وكلُّ خطأ كونسول، من العوالم كلِّها** — لا من عالمٍ نختاره
  // **الأحداث تُقرأ من `c.events` — واجهةُ السند القائمة**، ولا واجهةَ ثانية تُخترع.
  await c.send("Runtime.enable");
  await c.send("Log.enable");
  const readEvents = () => {
    const thrown = [], logged = [];
    for (const m of c.events) {
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params?.exceptionDetails || {};
        thrown.push(String(d.exception?.description || d.text || "").split("\n")[0]);
      } else if (m.method === "Log.entryAdded" && m.params?.entry?.level === "error") {
        logged.push(String(m.params.entry.text || "").slice(0, 200));
      }
    }
    return { thrown, logged };
  };
  await sleep(1500);

  // ── الحالُ تُنتَج ولا تُنتظر ────────────────────────────────────────────────
  const world = await contentWorld(c);
  check("[1] سكربت المحتوى يعمل على الصفحة", !!world, "لا عالمَ للإضافة ⇒ لا قياس");

  // عجلةٌ على الفيديو: تبني الطبقة (وهي شرطُ ظهور الدورة)
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 300, y: 300 });
  await sleep(200);
  await c.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 300, y: 300, deltaX: 0, deltaY: -120 });
  await sleep(500);
  const built = await evalIn(c, `!!document.querySelector(".vzWrap")`);
  check("[2] ⭐ والطبقة بُنيت فعلاً — فالصفرُ عن حالٍ وقعت لا عن لا شيء",
    built === true, built);

  // كتابةُ إعدادات ⇒ `storage.onChanged` ⇒ `flushReload` ⇒ `refreshIdleConsumers`
  // **مُطلِقٌ حقيقيّ لا مُفتعَل**: كتابةٌ في التخزين ⇒ `storage.onChanged` ⇒
  // `flushReload` ⇒ `refreshIdleConsumers` — وهو المسار الذي تظهر فيه الدورة.
  const cfg = await configure(PORT, h.extensionId,
    { settings: { ...SETTINGS.settings, idle: { ms: 400 } } });
  check("[3أ] وكتابةُ الإعدادات وصلت (فالمُطلِق وقع)", cfg.ok !== false, cfg);
  await sleep(1200);
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 320, y: 320 });
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 320, y: 320, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 320, y: 320, button: "left", clickCount: 1 });
  await sleep(1500);

  const { thrown, logged } = readEvents();
  const all = [...thrown, ...logged];
  const stack = all.filter((t) => /Maximum call stack|RangeError/.test(t));
  console.log(`\n  رميات: ${thrown.length} · أخطاء كونسول: ${logged.length}`);
  for (const t of all.slice(0, 5)) console.log(`     · ${t.slice(0, 150)}`);

  check("[3] ⭐ صفرُ رميةٍ غير ملتقَطة", thrown.length === 0, thrown.slice(0, 3));
  check("[3] وصفرُ خطأ كونسول", logged.length === 0, logged.slice(0, 3));
  check("[4] ⭐ ولا دورةَ بلا قاع (`Maximum call stack`)", stack.length === 0, stack.slice(0, 2));

  if (WITNESS) {
    // **في وضع الشاهد ينقلب الحكم**: الأحمرُ هو النجاح، وخضرتُه تعني أن المِجَسّ أعمى
    const sees = stack.length > 0;
    console.log(`\n  ⇒ **حكم الشاهد:** ${sees
      ? "✅ الرِكاز رأى العطب الحيّ بنصّه — فأخضرُه يُصدَّق"
      : "❌ **لم يرَ العطب المعلوم — فلا يُصدَّق أخضرُه ولا يُبنى عليه**"}`);
    code = sees ? 0 : 1;
  } else {
    console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
    code = fail ? 1 : 0;
  }
} finally {
  // ⛔ **ولا `process.exit` داخل `try`** — يتخطّى هذا التنظيف **فيُخلّف كروم حيّاً
  // يسمّم التشغيلة التالية** (#83 · قرار 44)، **وقد وقع في أوّل تشغيلة لهذا الملفّ**
  // فرفض المنفذُ الثانيةَ. **والخرْجُ يُؤجَّل إلى ما بعد التنظيف.**
  restore();
  server.close();
  killChrome(proc);
}
process.exit(code);
