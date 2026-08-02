// البند #64 — **البوّابة الواحدة**: كل مدخل ميزة يمرّ بالمفتاح الرئيسي وبالحظر.
//
// **العطب لم يكن ميزةً بلا حارس، بل أحد عشر حارساً متفرّقاً** (`AUDIT.md` §27):
// المفتاح العام كان يحرس أربعة، والحظر عشرة، **والجودة لا شيء**. فأطفأ المالك
// المفتاح وحظر الموقع **ولم يُطفأ شيء من الجودة**.
//
// **وهذا الملف يحرس البوّابتين معاً على المداخل الأحد عشر: مدخلٌ يفوته أحدهما
// ⇒ المجموعة حمراء.**
//
// ⚠️ **والحارس البنيويّ أقوى من القائمة:** `isBlockedHost()` يجب أن يكون لها
// **موضع نداء واحد** — داخل `extensionActive()`. فأيّ ميزة تفحص الحظر بنفسها
// **تُحمّر المجموعة**، حتى لو لم تكن في القائمة أدناه. **فالتفرّق الذي وُلد منه
// البند يستحيل بالبناء، لا يُحرَس بالتذكّر.**
//
// ⚠️ وفشل قسم [٤] يعني أن الافتراض تحوّل من `!== false` إلى `=== true`، فصار
// **كل من لم يفتح الإعدادات قط تُطفأ إضافته**. **لا تُصلحه بهجرة بيانات:**
// الشكل (ب) اختير لأنه **صفر تغيّر سلوكي افتراضياً**.
const fs = require("fs");

const SRC = fs.readFileSync("content.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// جسم دالّة بالاسم — يُقتطع حتى أول `\n}` في أول عمود
function body(name) {
  const i = SRC.indexOf(name);
  if (i === -1) return null;
  const j = SRC.indexOf("\n}", i);
  return j === -1 ? null : SRC.slice(i, j);
}

// **المداخل الأحد عشر** — كما أُحصيت في `AUDIT.md` §27
const ENTRIES = [
  ["المربّعات (عجلة · نقر · مفاتيح)", "function zonesActive()", true],
  ["ريماب المفاتيح", "window.addEventListener(\"keydown\"", true],
  ["ريماب الفأرة", "function handleMouse(e)", true],
  ["تحويل Shorts", "function maybeRedirectShorts()", true],
  ["تنسيق الترجمة", "function applySubtitleStyles", false],
  ["مسار الترجمة", "function applySubtitleTrack()", false],
  ["لغة ترجمة يوتيوب", "async function youtubeSetCaptionLanguage", false],
  ["مراقب مسارات الترجمة", "function subtitleTrackWatchWanted()", false],
  ["المعزّز — تطبيق", "async function applyBoostToAllVideos", false],
  ["المعزّز — نقل", "async function reapplyBoostTo", false],
  ["Clean Player", "function applyCleanPlayerCSS()", false],
  ["شارة السرعة (#71)", "function speedBadgeActive()", false],
  ["جودة يوتيوب — الإرسال", "function triggerYtQuality()", false],
  ["جودة يوتيوب — التسجيل", "function startYtAutoQuality()", false]
];

console.log("\n=== #64 — البوّابة الواحدة ===\n");

console.log("[١] كل مدخل يمرّ بـ`extensionActive()` (الرئيسي + الحظر)");
for (const [label, marker] of ENTRIES) {
  const b = body(marker);
  check(`[١] ${label}`, !!b && b.includes("extensionActive()"),
    b ? "لا بوّابة في جسمها" : `تعذّر إيجاد ${marker}`);
}

console.log("\n[٢] الحارس البنيويّ — `isBlockedHost()` لها موضع نداء واحد");
{
  // تُستثنى التعليقات: الحكم على الكود لا على ما يذكر الاسم
  const code = SRC.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  const calls = (code.match(/isBlockedHost\(\)/g) || []).length;
  // موضعان: التعريف نفسه (`function isBlockedHost()`) والنداء داخل البوّابة
  check("[٢] نداء واحد فقط خارج تعريفها", calls === 2, `العدد ${calls}`);
  const gate = body("function extensionActive()");
  check("[٢] وهو داخل `extensionActive` نفسها", !!gate && gate.includes("!isBlockedHost()"), gate);
  check("[٢] والبوّابة تجمع الرئيسي والحظر",
    !!gate && /masterEnabled\s*&&\s*!isBlockedHost\(\)/.test(gate), gate);
}

console.log("\n[٣] الترتيب: الرئيسي ← الحظر ← الريماب ← مفتاح الميزة");
{
  const z = body("function zonesActive()");
  const iGate = z ? z.indexOf("extensionActive()") : -1;
  const iRemap = z ? z.indexOf("remappingEnabled()") : -1;
  const iOwn = z ? z.indexOf("zoneSettings?.enabled") : -1;
  check("[٣] البوّابة قبل الريماب في `zonesActive`", iGate > -1 && iRemap > -1 && iGate < iRemap,
    `${iGate} / ${iRemap}`);
  check("[٣] والريماب قبل مفتاح الميزة", iRemap > -1 && iOwn > -1 && iRemap < iOwn,
    `${iRemap} / ${iOwn}`);
  // **`||` باقٍ كما هو تحت الرئيسي** — سير عمل «هذا الموقع وحده» لم يُمسّ
  const rem = body("function remappingEnabled()");
  check("[٣] و`siteRules || siteProfile` باقٍ بلا تغيير",
    !!rem && /siteRules\?\.enabled\s*\|\|\s*siteProfile\?\.enabled/.test(rem), rem);
}

console.log("\n[٤] الافتراض مُشغَّل — صفر تغيّر سلوكي لمن لم يفتح الإعدادات");
{
  const l = body("async function loadMasterEnabled");
  check("[٤] المُحمِّل موجود", !!l);
  check("[٤] وبنمط `!== false` لا `=== true`", !!l && /\.enabled !== false/.test(l), l);
  check("[٤] والحالة الابتدائية `true`", /let masterEnabled = true;/.test(SRC));
  check("[٤] ويُقرأ ضمن خطوات البدء", /startup\("master",\s*\(\)\s*=>\s*read\.then\(loadMasterEnabled\)\)/.test(SRC));
  check("[٤] ويُعاد تحميله مع كل تطبيق", /loadMasterEnabled\(data\)/.test(SRC));
}

console.log("\n[٥] سير عمل «هذا الموقع وحده» لم يمت");
{
  const popup = fs.readFileSync("popup.js", "utf8");
  // ⚠️ نصّ حيّ لا كود ميت: الشكل (ب) اختير **لأنه لا يهدمه**
  check("[٥] نصّ «تشتغل بقواعد هذا الموقع فقط» باقٍ", /تشتغل بقواعد هذا الموقع فقط/.test(popup));
  check("[٥] وشرطه باقٍ: ملفّ الموقع مفعَّل والعام مطفأ",
    /siteProfileEnabled\s*&&\s*!\s*gates\.globalEnabled/.test(popup));
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
