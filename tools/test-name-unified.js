// البند #38د — **اسم ظاهر واحد: «VIDEO ZONES»**.
//
// **العَرَض:** أربعة أسماء لا ثلاثة، والمستخدم يرى ثلاثة منها في آنٍ واحد —
// `VIDEO-ZONES` في `chrome://extensions`، و`Video Interaction Zones` في تلميح
// زرّ شريط الأدوات وعنوان تبويب الإعدادات، و`VIDEO ZONES` في ترويسة الإعدادات.
//
// ⚠️ **والرابع لم يكن أحد ليعثر عليه بلا عدّ: `<title>Remapper</title>` في
// `popup.html`.** لم يُذكر في أي بند ولا في أي نقاش، ولولا الإحصاء **لبقي**
// فعاد البند بعد شهر باسمٍ خامس. **الإحصاء قبل التعديل ليس بيروقراطية.**
//
// ── ما لا يُلمس، بنصّ قرار المالك (2026-08-01) ──────────────────────────────
//  · **`<h3>ريماب اختصارات الفيديو</h3>` في `popup.html` يبقى كما هو.**
//    «هذا وصف عربيّ لا اسم منتج، ولا يزاحم «VIDEO ZONES» كما يزاحمها «Remapper»
//    و«Video Interaction Zones». والبند نطاقه أسماء متضاربة، لا استبدال الأوصاف
//    بعلامات — واستبدال وصف يقرؤه المستخدم بعلامة يخسره معلومة ولا يربحه شيئاً.»
//    **فلا يُفتح النقاش فيه ثانية.**
//  · **بادئة الكونسول `[VIDEO-ZONES]` تبقى كما هي** — وسم سجلّ للمطوّر لا واجهة،
//    ويقع في خانة «المستودع والمسارات». وتغييرها يمسّ **تسعة مواضع بلا مكسب**،
//    وقد يكسر أدوات تبحث عنها نصّاً.
//    ⚠️ **وفرقٌ مقصود ومكتوب لا سهو:** اسم الإضافة في **قائمة سياق الكونسول**
//    صار **«VIDEO ZONES»** (من المانيفست)، **بينما تبقى البادئة `[VIDEO-ZONES]`**.
//  · `README.md` والمستودع والمسارات: `VIDEO-ZONES`.
const fs = require("fs");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

const SHOWN = "VIDEO ZONES";
const MANIFEST = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const POPUP = fs.readFileSync("popup.html", "utf8");
const OPTIONS = fs.readFileSync("options.html", "utf8");

console.log("\n=== #38د — اسم ظاهر واحد ===\n");

console.log("[١] المواضع الأربعة التي يراها المستخدم");
check("[١] `manifest.name`", MANIFEST.name === SHOWN, MANIFEST.name);
check("[١] `action.default_title`", MANIFEST.action?.default_title === SHOWN,
  MANIFEST.action?.default_title);
check("[١] `<title>` في الـ popup", /<title>\s*VIDEO ZONES\s*<\/title>/.test(POPUP),
  (POPUP.match(/<title>[^<]*<\/title>/) || [])[0]);
check("[١] `<title>` في الإعدادات", /<title>\s*VIDEO ZONES\s*—\s*Settings\s*<\/title>/.test(OPTIONS),
  (OPTIONS.match(/<title>[^<]*<\/title>/) || [])[0]);
check("[١] ترويسة الإعدادات (كانت صحيحة سلفاً)",
  /class="brand">\s*VIDEO ZONES\s*</.test(OPTIONS));

// ── [٢] **الحارس الحقيقي**: لا اسم ظاهر مخالف باقٍ في أي ملف واجهة ─────────
// لا يكفي أن تصحّ الأربعة المعلومة — **الاسم الخامس هو الخطر**. فيُمنع كل بديل
// معروف من الظهور في `manifest.json` وملفّي الواجهة، **أياً كان موضعه**.
console.log("\n[٢] لا اسم ظاهر مخالف في أي ملف واجهة");
{
  const BANNED = ["Video Interaction Zones", "Remapper", "VIDEO-ZONES"];
  const FILES = [["manifest.json", fs.readFileSync("manifest.json", "utf8")],
                 ["popup.html", POPUP], ["options.html", OPTIONS]];
  for (const [f, src] of FILES) {
    for (const bad of BANNED) {
      check(`[٢] ${f} خالٍ من «${bad}»`, !src.includes(bad),
        `ما زال موجوداً في ${f}`);
    }
  }
}

// ── [٣] الفرق المقصود: البادئة تبقى، واسم السياق تغيّر ────────────────────
console.log("\n[٣] الفرق المقصود بين البادئة واسم قائمة السياق");
{
  const shipped = ["content.js", "storage.js", "background.js"];
  let prefixes = 0;
  for (const f of shipped) prefixes += (fs.readFileSync(f, "utf8").match(/\[VIDEO-ZONES\]/g) || []).length;
  // **تُثبَّت البادئة بالعدّ**: تغييرها سهواً يُحمّر المجموعة، وتغييرها عمداً
  // يستلزم تحديث هذا الرقم — فيصير قراراً لا انزلاقاً.
  check("[٣] بادئة `[VIDEO-ZONES]` باقية في تسعة مواضع", prefixes === 9, `العدد ${prefixes}`);
  check("[٣] واسم قائمة السياق صار «VIDEO ZONES»", MANIFEST.name === SHOWN);
}

// ── [٤] الوصف العربيّ في الـ popup لم يُمسّ ────────────────────────────────
console.log("\n[٤] الوصف العربيّ باقٍ — قرار المالك، لا يُفتح ثانيةً");
check("[٤] `<h3>ريماب اختصارات الفيديو</h3>` كما هو",
  /<h3>\s*ريماب اختصارات الفيديو\s*<\/h3>/.test(POPUP));

// ── [٥] الرِكاز يقرأ الاسم من المانيفست ولا يحفظه نصّاً ────────────────────
// **بالعدّ لا بالثقة** (أمر المالك): لو حُفظ الاسم نصّاً في الأداة لانكسرت
// **بصمت** عند أي تغيير للاسم — وهي الأداة التي يقوم عليها كل قياس على الإضافة.
console.log("\n[٥] `ext-harness.mjs` يقرأ الاسم من المانيفست");
{
  const H = fs.readFileSync("tools/ext-harness.mjs", "utf8");
  const code = H.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  // ⚠️ **يُطابَق سطر الإسناد نفسه لا نمطٌ مركَّب:** أول صياغة اشترطت غياب أي
  // قوس داخلي فسقطت على `path.join(ROOT, "manifest.json")` — **تأكيدٌ صارم على
  // شكل الكتابة لا على الحقيقة المقصودة يُفشل كوداً سليماً.**
  const line = (code.match(/^.*EXT_NAME\s*=.*$/m) || [""])[0];
  check("[٥] يقرأ `manifest.json` ويأخذ `name` منه",
    line.includes("manifest.json") && /\.name\b/.test(line) && line.includes("readFileSync"),
    line.trim() || "لم يوجد إسناد EXT_NAME");
  check("[٥] ولا يحفظ أي اسم ظاهر نصّاً", !/["'`]VIDEO[ -]ZONES["'`]/.test(code),
    "وُجد اسم محفوظ نصّاً");
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
