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
//   `--witness`           ⇒ `content.js` من `85ac3cf` **بحالِ الشاهد المُعلَنة** ⇒ **يجب أن يُحمّر**
//   `--witness --control` ⇒ **البناءُ الحاليّ بالحالِ نفسِها** ⇒ **يجب أن يخضرّ**
//   ⛔ **ولا يُصدَّق أخضرُ هذا الرِكاز حتى يُرى أحمرُه على ذاك البناء.**
//   ⭐⭐ **والاثنان معاً مقارنةٌ مضبوطة: المتغيّرُ الوحيد هو البناء** — **وبلا
//   الضبط يكون الأحمرُ محتمَلاً من الحالِ لا من البناء** (قرار 42 · 106).
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import http from "node:http";
import { launch, openPageAsHost, connect, evalIn, contentWorld, configure, killChrome, waitPortFree, ROOT, EXT_NAME }
  from "./ext-harness.mjs";

const PORT = 9793, HTTP = 8893;
const BROKEN_COMMIT = "85ac3cf";
const WITNESS = process.argv.includes("--witness");
const CONTROL = process.argv.includes("--control");   // الحالُ نفسُها على البناء الحاليّ
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ⭐⭐ سابعةُ الحدّ المعماريّ — **في الرِكاز هذه المرّة** (قرار المالك 2026-08-06)
// **الواقعة:** أوّلُ صياغةٍ لهذا الشاهد **لم ترَ العطبَ الحيّ** وهي تُركّب الملفَّ
// المكسور بنصّه — **لأن الرِكاز يكتب `filterButton: true` بحكم #111**، ⇒
// **فالمستهلكُ مُفعَّلٌ فلا تُنادى `onDisabled` فلا دورة.** ⭐ **القاعدةُ التي
// أُدخلت ليرى الرِكازُ الميزاتِ هي التي أعمت شاهدَه.**
//
// ⇒ ⭐⭐ **وليسا متعارضين إذا صيغا بدقّة، وهذا هو الفصل:**
//   · **#111 عن التغطية** — **ميزةٌ مطفأةٌ لا يمسّها أحد** ⇒ **الرِكازُ يُشغّل
//     الميزاتِ افتراضاً**، وكلُّ ميزةٍ جديدة تُضاف إلى `SETTINGS` يومَ تُشحن.
//   · **والشاهدُ عن حالٍ بعينها** ⇒ **يُعلن حالتَه هو بسببٍ مكتوب**، **كما يُعلن
//     مستهلكُ السكون `target` و`nearPad` و`onDisabled` والمحرّكُ يسأل ولا يعرف
//     لماذا.** ⛔ **ولا يرث الشاهدُ حالَ الرِكاز صامتاً، ولا يُعدَّل الرِكازُ
//     ليُشبه الشاهد** — فذاك يُفرغ #111 من معناه.
const WITNESS_STATE = {
  // ⚠️ **وبالشكل المشحون كذلك** (قرار 121): `filterButton: false` **صار لا يعمل**
  // — `barButtonsOf` **تُرجّح القائمةَ حيث وُجدت**، فمفتاحٌ قديمٌ بجوارها لا يُقرأ.
  // ⇒ **وحالُ الشاهد تُعلَن بالشكل الذي يعيش فيه المستخدم، وإلا أعلنّا حالاً لا تقع.**
  overlay: { barButtons: [{ id: "speed", on: true }, { id: "filter", on: false }] },
  لماذا:
    "عطبُ #108 دورةٌ تعيش **داخل `onDisabled`**، و`applyIdleState` لا تناديها " +
    "إلا لمستهلكٍ `!enabled()` ⇒ **المفتاحُ مُشغَّلاً يمنع الدورةَ من الوقوع أصلاً**. " +
    "⭐ وهو درسُ #108 بنصّه: «المفتاحُ المطفأ يُسكت الميزة ولا يمنع كودَها من أن يعمل».",
  وكيف_تُنتَج_الحال:
    "اللوحةُ تُبنى في `ensureVideoOverlay` **بلا شرطِ مفتاح** ⇒ **العجلةُ وحدها " +
    "تكفي**: طبقةٌ تُبنى ⇒ `vzFilterPanel` غيرُ فارغ ⇒ ونداءُ `onDisabled` يجد " +
    "`setFilterPanelOpen` تنادي المحرّكَ من جديد.",
  // ⛔ **شروطٌ تشترط الزرَّ مرئيّاً — والمفتاحُ مطفأ بإعلانٍ لا بسهو.**
  // **فتُعلَن ممتنعةً ولا تُطبع حمراء**: حمرةٌ متوقَّعة تُعلّم قارئَها أن يتخطّى.
  ممتنعة: ["[3ب]", "[6]", "[7]"]
};

let pass = 0, fail = 0;
const abstains = (name) => WITNESS && WITNESS_STATE.ممتنعة.some((p) => name.startsWith(p));
const check = (name, cond, extra) => abstains(name)
  ? console.log("  ⚪ " + name + "  ← يمتنع بإعلان الشاهد (المفتاح مطفأ)")
  : cond
    ? (pass++, console.log("  ✅ " + name))
    : (fail++, console.log("  ❌ " + name, extra ?? ""));

// صفحةٌ محليّة بفيديو حيّ (canvas ⇒ captureStream) — بلا شبكة ولا مضيف
// ⚠️⚠️ **شريطٌ مُفتعَلٌ ضيّق، وحدُّه يُكتب قبل أن يُقرأ نتيجةً** (2026-08-07):
// `.ytp-right-controls` **هو الحقلُ الوحيد الذي يطلبه `speedBtnHostSlot`** —
// **فنُعطيه إيّاه ولا ندّعي شجرةَ يوتيوب.** ⇒ **وهو ما يجعل مسارَ الحقن في شريطٍ
// قابلاً للقياس أصلاً**، **و#112 يبقى مفتوحاً: لا مشغّلَ حقيقيّ ولا أنماطَ مضيف.**
// ⛔ **ولولاه لبقي العطبُ #121 غيرَ مقيسٍ عندنا** — **فقد وقع في الشريط وحدَه،
// والطبقةُ لا تُرتَّب أصلاً.**
const PAGE = `<!doctype html><meta charset=utf8><style>
  html,body{margin:0;background:#111} video{width:100vw;height:100vh;object-fit:cover;display:block}
  #movie_player{position:fixed;inset:0} .ytp-right-controls{position:absolute;right:0;bottom:0;height:40px;display:flex;align-items:center}
  .ytp-right-controls .fake{width:40px;height:40px}
</style><div id=movie_player class="html5-video-player"><video id=v autoplay muted playsinline></video>
<div class="ytp-chrome-bottom"><div class="ytp-right-controls"><button class="fake ytp-button">A</button><button class="fake ytp-button">B</button></div></div></div><script>
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
  if (WITNESS && !CONTROL) {
    const n = swapInBrokenBuild();
    console.log(`  ⚠️ رُكّب \`content.js\` من \`${BROKEN_COMMIT}\` (${n} حرفاً) — ويُعاد ملفُّك في النهاية.`);
  } else if (CONTROL) {
    console.log(`  ⚠️ **الضبط**: البناءُ الحاليّ بحالِ الشاهد نفسِها — **فالمتغيّرُ الوحيد هو البناء**.`);
  }
  if (WITNESS) {
    console.log(`  ⚠️ حالُ الشاهد مُعلَنة: \`${JSON.stringify(WITNESS_STATE.overlay)}\``);
    console.log(`     لماذا: ${WITNESS_STATE.لماذا}`);
    console.log(`     وكيف تُنتَج: ${WITNESS_STATE.وكيف_تُنتَج_الحال}`);
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
      // ⚠️ **مهلةٌ واسعة عمداً**: هذا الرِكاز يقيس **الحضور** لا **توقيت السكون**
      // — **وأوّلُ قياسٍ خرج أحمرَ لأن السكون مضى قبل أن أقرأ**، وذاك عطبُ سندٍ
      // لا عطبُ منتج (**الحالُ لم تُنتَج**، الشاهد الثاني في قرار 26).
      idle: { ms: 5000 },
      // ⭐ **والميزاتُ تُشغَّل هنا لا تُترك على افتراضها** (#111): **ميزةٌ لا
      // تُشغَّل لا تُقاس** — **وهو ما جعل #108 يمرّ**. **وكلُّ ميزةٍ جديدة تُضاف
      // إلى هذا السطر يومَ تُشحن، وإلا فحصنا الإطفاء لا الميزة** (قرار 102).
      // ⭐ **وحالُ الشاهد تُطبَّق فوقها ولا تُبدّلها** — `WITNESS_STATE` أعلاه:
      // **الرِكازُ يُشغّل، والشاهدُ يُعلن ما يحتاج إطفاءه وحدَه بسببٍ مكتوب.**
      // ⛔⭐⭐ **الشكلُ المشحون وحدَه — بلا القديمين** (قرار 121، 2026-08-07):
      // كان هنا `speedButton: true` و`filterButton: true` ⇒ **فقاس الرِكازُ
      // مسارَ السقوط إلى القديم، لا الحالَ التي يعيش فيها المستخدم بعد الهجرة**
      // ⇒ **ومرّ عطبٌ كسر الميزة كسراً كاملاً والبوّابةُ التسعة خضراء.**
      // ⚠️ **و«بلا القديمين» شرطٌ لا زينة:** كتابتُهما معاً **تُبقي مسارَ السقوط
      // حيّاً فيستر العطب** — **وهو ما ستره أسبوعاً في رِكازين خضراوين.**
      overlay: { autoHideMs: 900, volumeAutoHideMs: 900, enabled: true, hintEnabled: true,
        speedBadge: true, speedButtonPreset: 2, progressBarMode: "idle",
        barButtons: [{ id: "speed", on: true }, { id: "filter", on: true }],
        ...(WITNESS ? WITNESS_STATE.overlay : {}) },
      zones: { enabled: true, fullscreenOnly: false,
        wheel: { map: { "5": { up: ["ACTION:SPEED:+0.25"], down: ["ACTION:SPEED:-0.25"] } } } }
    },
    globalSiteRules: { enabled: true, mappings: [] }
  };
  const seeded = await configure(PORT, h.extensionId, SETTINGS);
  check("[0] الإعدادات كُتبت قبل الفتح", seeded.ok !== false, seeded);

  // ⛔⭐ **تحت اسم يوتيوب، لا على `localhost`** (2026-08-06، قبل بوّابة الزرّين):
  // زرّا #72 و#108 صارا يوتيوبيَّين، **وشرطُ حضورٍ يقيس على مضيفٍ لا يظهران عليه
  // شرطٌ ميّت** — **وخمسةٌ منها هنا.** ⇒ **الاعتراضُ يسبق البوّابة** (قرار المالك).
  // ⚠️ **والمُزيَّفُ الاسمُ وحدَه**: الصفحةُ صفحتُنا، **ولا شجرةَ يوتيوب** ⇒
  // **الزرُّ يسقط إلى طبقتنا كما اليوم، و#112 يبقى مفتوحاً ولا يُقرأ مغلقاً بهذا.**
  const { c } = await openPageAsHost(PORT, { html: PAGE });

  // **كلُّ رميةٍ وكلُّ خطأ كونسول، من العوالم كلِّها** — لا من عالمٍ نختاره
  // **الأحداث تُقرأ من `c.events` — واجهةُ السند القائمة**، ولا واجهةَ ثانية تُخترع.
  await c.send("Runtime.enable");
  await c.send("Log.enable");
  // ⭐⭐ **ويُسمَع تحذيرُنا كما تُسمَع رميتُنا** (شرط المالك 2026-08-06):
  // **حارسٌ يتكلّم ولا أحدَ يسمعه شاهدٌ لا يُشغَّل** — وقد صرفنا في هذا جرداً كاملاً
  // (#103). **والحارسُ في محرّك السكون يقول «عطبٌ في مستهلك» ⇒ فالصفرُ المطلوب
  // صفرُ تحذيرٍ لا صفرُ رميةٍ وحدها.**
  // ⚠️ **وتحذيرُنا يُميَّز من ضجيج المضيف بالبادئة `[VZ]`** — **وعدُّ تحذيرات
  // يوتيوب كلِّها يُنتج ضجيجاً يُقرأ إذناً بالتخطّي** (تحذير #97).
  const OURS = "[VZ]";
  const argText = (p) => (p?.args || []).map((a) => String(a?.value ?? a?.description ?? "")).join(" ");
  const readEvents = () => {
    const thrown = [], logged = [], warned = [];
    for (const m of c.events) {
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params?.exceptionDetails || {};
        thrown.push(String(d.exception?.description || d.text || "").split("\n")[0]);
      } else if (m.method === "Log.entryAdded" && m.params?.entry?.level === "error") {
        logged.push(String(m.params.entry.text || "").slice(0, 200));
      } else if (m.method === "Runtime.consoleAPICalled" &&
                 (m.params?.type === "warning" || m.params?.type === "error")) {
        const t = argText(m.params);
        if (t.includes(OURS)) warned.push(t.slice(0, 200));
      }
    }
    return { thrown, logged, warned };
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
    { settings: { ...SETTINGS.settings, idle: { ms: 5000 } } });
  check("[3أ] وكتابةُ الإعدادات وصلت (فالمُطلِق وقع)", cfg.ok !== false, cfg);
  await sleep(1200);
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 320, y: 320 });
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 320, y: 320, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 320, y: 320, button: "left", clickCount: 1 });
  // **ولمسُ الميزة نفسِها**: زرُّ الفلاتر يُفتح ويُغلق — فالمسارُ يُنتج الحال
  const touched = await evalIn(c, `(() => {
    const b = document.querySelector(".vzFilterBtn");
    if (!b) return "لا زرّ";
    b.click();
    const open = !!document.querySelector(".vzFilterPanel:not(.vzHidden)");
    const r = document.querySelector(".vzFilterPanel input[type=range]");
    if (r) { r.value = String(Number(r.value) + Number(r.step || 0.05));
             r.dispatchEvent(new Event("input", { bubbles: true })); }
    const filtered = !!(document.querySelector("video") || {}).style?.filter;
    b.click();
    return { open, filtered, filter: (document.querySelector("video")||{}).style?.filter || "" };
  })()`);
  check("[3ب] ⭐ ولوحةُ الفلاتر تُفتح ويُلمس منزلقُها", touched && touched.open === true, touched);
  await sleep(1500);

  const { thrown, logged, warned } = readEvents();
  const all = [...thrown, ...logged, ...warned];
  const stack = all.filter((t) => /Maximum call stack|RangeError/.test(t));
  console.log(`\n  رميات: ${thrown.length} · أخطاء كونسول: ${logged.length} · تحذيراتُنا: ${warned.length}`);
  for (const t of all.slice(0, 5)) console.log(`     · ${t.slice(0, 150)}`);

  check("[3] ⭐ صفرُ رميةٍ غير ملتقَطة", thrown.length === 0, thrown.slice(0, 3));
  check("[3] وصفرُ خطأ كونسول", logged.length === 0, logged.slice(0, 3));
  check("[4] ⭐ ولا دورةَ بلا قاع (`Maximum call stack`)", stack.length === 0, stack.slice(0, 2));
  // ⭐ **وصفرُ تحذيرٍ من عندنا** — **فالحارسُ الذي يتكلّم يجب أن يُسمَع**:
  // تحذيرُ محرّك السكون يعني **عطباً في مستهلك** وإن لم تقع رمية.
  check("[5] ⭐⭐ وصفرُ تحذيرٍ من عندنا (`[VZ]`) — لا صفرُ رميةٍ وحدها",
    warned.length === 0, warned.slice(0, 3));

  // ── [6] ⭐⭐ تأكيدُ حضور — **فحصُ الأخطاء ليس فحصَ الحضور، وهما سؤالان** ────
  // **الواقعة (2026-08-06):** زرُّ الفلاتر **لم يظهر عند المالك إطلاقاً**، **ولا
  // رميةَ ولا تحذير** ⇒ **مرّ من [3] و[4] و[5] كلِّها**. ⭐ **وغيابٌ صامت أخبثُ
  // ما نلقاه: كلُّ ما بنيناه يفحص ما يُقال لا ما يُرى.**
  // ⇒ **والقاعدة مُعمَّمة لا خاصّة بالفلاتر (شرط المالك): كلُّ ميزةٍ تُظهر شيئاً
  // يلزمها تأكيدُ حضور، وإلا كانت خضرتُنا عن «لم يرمِ» لا عن «يعمل».**
  // ⚠️ **وحدُّه مُعلَن ويُقرأ قبل خضرته:** يقيس **الحضور على صفحةٍ محليّة** —
  // **والسقوطُ إلى طبقتنا حضورٌ كذلك**. ⛔ **فهو لا يُميّز «في شريط المضيف» من
  // «في طبقتنا»، ولا يبلغ حالَ المضيف الحقيقيّ أصلاً** — **وذاك ما لم يمسكه في
  // واقعة #108، ويُقال ولا يُدّعى عنه غيرُه.**
  const PRESENT = [
    { key: "زرّ الفلاتر (#108)", sel: ".vzFilterBtn" },
    { key: "زرّ السرعة (#72)", sel: ".vzSpeedBtn" }
  ];
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 340, y: 300 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 360, y: 320 });
  await sleep(400);   // دون المهلة بكثير — فالنافذة مفتوحةٌ حين نقرأ
  // ⭐⭐ **والعتبةُ نسبةٌ إلى الجار لا صفرٌ مطلق** (قرار 107): زرٌّ عرضُه `12`
  // بجوار جارٍ عرضُه `56` **مستطيلُه غيرُ صفريّ وهو لا يُرى** — **وتلك بعينها
  // الحالُ التي مرّت من «موجودٌ وله مستطيل».**
  const NEIGHBOUR_MIN = 0.6;
  const verdict = (r, n) => ({
    موجود: !!r,
    مرئيّ: !!r && r.مخفيّ === false && r.w > 0 && r.h > 0 &&
      (!n || !(n.w > 0) || r.w >= n.w * NEIGHBOUR_MIN)
  });
  // ⭐ **شاهدٌ على الحكم نفسِه قبل أن يُحكم به** (قرار 26 · 47): أرقامُ المالك
  // بنصّها **يجب أن تُقرأ «غيرَ مرئيّ»**، وأرقامٌ سويّة «مرئيّاً».
  check("[6] ⭐ والحكمُ يرى الضمور: 12 بجوار 56 ⇒ غيرُ مرئيّ",
    verdict({ مخفيّ: false, w: 12, h: 40 }, { w: 56, h: 40 }).مرئيّ === false);
  check("[6] ويمرّ على السويّ: 44 بجوار 56 ⇒ مرئيّ",
    verdict({ مخفيّ: false, w: 44, h: 40 }, { w: 56, h: 40 }).مرئيّ === true);

  // ── ⛔⭐⭐ #112 (المرحلة ب) — **حدُّ هذا القسم مقيسٌ لا موصوف** ─────────────
  // **الشريطُ هنا مفتعَلٌ بثلاثة أسطر من أنماطنا، وأنماطُ يوتيوب 4.4 ميغابايت في
  // 18 ورقة** ⇒ **حكمٌ يخرج هنا حكمٌ عن شريطنا نحن.**
  // ⛔⭐ **ومقدّمةُ النقل سقطت بالقياس ولم تُنفَّذ على ظنّها** (قرار 16): ظُنّ أن
  // هذا القسم **أعمى** عن ضمور #108 — **والمقيس بمتغيّرٍ واحد** (إزالةُ قاعدة
  // مقاس الأيقونة وحدَها من منتَج اليوم): **احمرَّ هنا أيضاً** ⇒ **فالعمى كان
  // تاريخيّاً (قبل أن يوجد هذا الحكم) لا بنيويّاً لهذا العطب بعينه.**
  // ⇒ ⭐ **فلا يُنقل شيءٌ ولا يُفرَّغ الحارس** — **والمنقولُ هو الدعوى: «يُرى في
  // شريط المضيف الحقيقيّ» جوابُها في `bench-112-host-snapshot` لا هنا.**
  // ⚠️ **وما يبقى بنيويّاً خارج مدى اللقطة: التشغيلُ الحيّ · وانتقالُ SPA ·
  // وإعادةُ بناء المضيف لشريطه** — **فهذا القسمُ يبقى ولا يُستبدل.**
  {
    const home = path.join(ROOT, "tools", "bench-112-host-snapshot.mjs");
    const src = fs.existsSync(home) ? fs.readFileSync(home, "utf8") : "";
    // ⛔ **حارسٌ على أن للسؤال بيتاً** — **فسؤالٌ يُرفع من هنا ولا يُبلَّغ حاملُه
    // هو «شرطٌ رُفع ولم يُبلَّغ حاملُه» في صورةٍ جديدة** (قرار 112).
    check("[6] ⭐⭐ ولسؤال «شريطُ المضيف الحقيقيّ» بيتٌ قائم (#112)",
      !!src && /ytp-right-controls/.test(src) && /0\.6/.test(src),
      "غابَ `bench-112-host-snapshot` أو سقط منه حكمُ الضمور — والسؤالُ بلا حامل");
  }

  const rects = {};
  for (const f of PRESENT) {
    rects[f.sel] = await evalIn(c, `(() => { const el = document.querySelector(${JSON.stringify(f.sel)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { مخفيّ: el.classList.contains("vzHidden"),
               w: Math.round(r.width), h: Math.round(r.height),
               أب: (el.parentElement?.className || "").slice(0, 24) }; })()`);
  }
  // ── [7] ⭐⭐ تأكيدُ **أثر** — السؤالُ الثالث (قرار 109) ────────────────────
  // **أرمى؟ · أموجود؟ · أوقع الأثر؟** — **ومَلَكنا الأوّلَين وحدَهما حتى اليوم.**
  // ⛔ **الواقعة:** لوحةٌ حيّةٌ **تُحرَّك ولا يقع شيء** — تكتب على عنصرٍ ميّت،
  // **بلا رميةٍ ولا تحذير، وعنصرُها موجودٌ ومرئيّ** ⇒ **مرّت من [3] و[5] و[6].**
  // ⇒ **فكلُّ شرطٍ ينتهي بأثرٍ يراه المستخدم لا بوجودِ عنصر** (شكل #93).
  {
    const eff = await evalIn(c, `(() => {
      const b = document.querySelector(".vzFilterBtn"); if (!b) return { err: "لا زرّ" };
      if (document.querySelector(".vzFilterPanel.vzHidden")) b.click();
      const r = document.querySelector('.vzFilterPanel input[type=range][data-vz-key="brightness"]');
      if (!r) return { err: "لا منزلق" };
      const v = document.querySelector("video");
      const قبل = v.style.filter || "";
      r.value = "1.4"; r.dispatchEvent(new Event("input", { bubbles: true }));
      const بعد = v.style.filter || "";
      const عرض = document.querySelector('.vzFpRow[data-vz-key="brightness"] .vzFpVal');
      return { قبل, بعد, معروض: عرض ? عرض.textContent : null };
    })()`);
    check("[7] ⭐⭐ تحريكُ منزلقٍ يُغيّر `filter` على الفيديو الحيّ",
      !eff?.err && eff.بعد !== eff.قبل && /brightness\(1\.4\)/.test(eff.بعد || ""), eff);
    // **والقيمةُ تُعرض بوحدتها** (قرار 110): نسبةٌ للمضروب لا رقمٌ خام
    check("[7] وتُعرض بوحدتها (نسبةً لا رقماً خامّاً)", eff?.معروض === "140%", eff?.معروض);
  }

  for (const f of PRESENT) {
    const mine = rects[f.sel];
    const other = Object.entries(rects).find(([k]) => k !== f.sel)?.[1] || null;
    const v = verdict(mine, other);
    check(`[6] ⭐ «${f.key}» مُشغَّلٌ ⇒ موجودٌ ومرئيٌّ **على صفحةٍ محليّة** (مقارَناً بجاره)`,
      v.موجود && v.مرئيّ, { mine, other });
  }

  // ── [٩] ⭐⭐ #121 — **نقرةٌ تُنتج أثرَها بعد إعادة ترتيب** ───────────────
  // ⛔ **تأكيدُ الحضور لا يكفي** (شرط المالك 2026-08-07، **خامسُ غيابٍ صامت**):
  // **الزرُّ حاضرٌ ومرئيٌّ ولا يفعل شيئاً عند النقر، بلا رميةٍ ولا تحذير** —
  // **فمرّ من [3] و[5] و[6] كلِّها.** ⇒ **يلزمه تأكيدُ تفاعل**، **وهو قرار 109
  // مطبَّقاً على الحدث لا على العنصر.**
  //
  // ⛔⭐⭐ **والأثرُ المقيس هو اللوحة لا السرعة — والسببُ مقيسٌ لا اختيار:**
  // **فيديو هذي الصفحة مصدرُه `MediaStream`** (`canvas.captureStream`)،
  // **وكروم يتجاهل `playbackRate` عليه** — **مقيسٌ مباشرةً: `v.playbackRate = 2`
  // تبقى `1`.** ⇒ **فأوّلُ صياغةٍ لهذا الشرط كانت تقيس السرعة فتُحمّر دائماً**،
  // **وكانت ستتّهم المنتَجَ بخاصيّةٍ في سندها** — **وهي عائلةُ «أداةٌ تُثبت عطباً
  // لا وجود له»، وأمسكها الشاهدُ الموجب قبل أن تُنشر.**
  //
  // ⚠️ **والحالُ تُنتَج بحروفها:** يُعاد الترتيب · **ثمّ يُحرَّك المؤشّر** (فيدور
  // مسارُ السكون، وهو المُطلِق) · ثمّ يُنقَر. **وبلا الحركة بينهما لا يقع العطب.**
  if (!WITNESS) {
    const shot = async (sel) => await evalIn(c, `(() => { const b = document.querySelector(${JSON.stringify(sel)});
      if (!b) return null; const r = b.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
               w: Math.round(r.width), في_الشريط: b.classList.contains("vzInBar"),
               أب: (b.parentElement.className || "").slice(0, 24) }; })()`);
    const panelOpen = async () => await evalIn(c, `!!document.querySelector(".vzFilterPanel:not(.vzHidden)")`);
    const clickAt = async (p) => {
      await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
      await sleep(120);
      await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
      await sleep(500);
    };
    const f0 = await shot(".vzFilterBtn");
    check("[٩] الزرُّ محقونٌ في شريط المضيف (وإلا لم يُقس مسارُ الترتيب)",
      f0?.في_الشريط === true, f0);

    // ⭐ **الشاهدُ الموجب قبل أيّ ترتيب** — بلا هذا يكون الأحمرُ عن أداةٍ عمياء
    // ⚠️ **ويُقاس الانقلابُ لا الفتح**: القسم [7] يترك اللوحةَ مفتوحة، **فشرطٌ
    // يقول «تُفتح» يقرأ إغلاقاً صحيحاً فشلاً** — **وهو قياسُ حالٍ لم تُنتَج،
    // وأمسكه الشاهدُ الموجب في أوّل تشغيلة.**
    let before0 = null;
    if (f0 && f0.w > 0) {
      before0 = await panelOpen();
      await clickAt(f0);
      const after0 = await panelOpen();
      check("[٩] ⭐ شاهدٌ موجب: نقرةٌ قبل أيّ ترتيب تقلب اللوحة",
        after0 !== before0, { before0, after0 });
      if (after0) await clickAt(f0);   // تُترك مغلقةً قبل الترتيب
    }

    // إعادةُ ترتيب حقيقيّة: تُقلب القائمةُ في التخزين فيدور مسارُ القراءة
    await configure(PORT, h.extensionId, { settings: { ...SETTINGS.settings,
      overlay: { ...SETTINGS.settings.overlay,
        barButtons: [{ id: "filter", on: true }, { id: "speed", on: true }] } } });
    await sleep(1200);
    const f1 = await shot(".vzFilterBtn");
    if (f1 && f1.w > 0) {
      // **حركةٌ حقيقيّة بين الترتيب والنقر** — فمسارُ السكون يدور عندها
      for (let i = 0; i < 6; i++) {
        await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: f1.x + (i % 3), y: f1.y + (i % 2) });
        await sleep(90);
      }
      await clickAt(f1);
      // ⛔ **فشلُ هذا التأكيد يعني عودةَ #121**: العقدةُ تُنزع وتُعاد بين ضغطتَي
      // الفأرة فلا يُولَّد `click` — **راجِع `applyBarOrder` ولا تُصلح الاختبار.**
      const before1 = false;   // تُركت مغلقةً أعلاه، ويُتحقَّق منه لا يُفترض
      const state = await panelOpen();
      check("[٩] ⭐⭐ ونقرةٌ عليه بعد إعادة الترتيب تقلب اللوحة فعلاً",
        state !== before1, { before1, بعد: state });
    } else {
      check("[٩] مستطيلُ الزرّ غيرُ صفريّ (وإلا لا يُقاس نقر)", false, f1);
    }
  }

  if (WITNESS) {
    // **في وضع الشاهد ينقلب الحكم**: الأحمرُ هو النجاح، وخضرتُه تعني أن المِجَسّ أعمى
    // ⭐ **وفي الضبط ينقلب مرّةً ثانية**: **الخضرةُ هي النجاح** — **وهي التي تُثبت
    // أن الأحمرَ من البناء لا من الحالِ المُعلَنة.** ⛔ **وبلا هذا الشوط يبقى
    // الأحمرُ محتمَلاً من الحال** (قرار 42: عَرَضٌ واحد لا يدلّ على سببٍ واحد).
    const sees = stack.length > 0 || warned.length > 0;
    console.log(`\n  رأى العطب: ${sees ? "نعم" : "لا"} · دورة=${stack.length} · تحذيرُنا=${warned.length}`);
    if (CONTROL) {
      console.log(`  ⇒ **حكم الضبط (البناءُ الحاليّ، الحالُ نفسُها):** ${!sees
        ? "✅ **صفرٌ هنا** ⇒ **فأحمرُ الشاهد من البناء لا من الحال**"
        : "❌ **رأى العطبَ على البناء الحاليّ** ⇒ **العطبُ قائمٌ أو الحالُ هي التي تُنتجه — ولا يُنسب شيء**"}`);
      code = sees ? 1 : 0;
    } else {
      console.log(`  ⇒ **حكم الشاهد:** ${sees
        ? "✅ الرِكاز رأى العطب الحيّ بنصّه — فأخضرُه يُصدَّق"
        : "❌ **لم يرَ العطب المعلوم — فلا يُصدَّق أخضرُه ولا يُبنى عليه**"}`);
      code = sees ? 0 : 1;
    }
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
