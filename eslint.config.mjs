// فحصُ الأسماء غير المعرَّفة — `no-undef` وحده، وبيئاتٌ مُشتقّة لا مكتوبة.
//
// ⛔ **لماذا أداةٌ خارجية بعد أن كان الثابتُ «لا تبعيّات»** (نُقض صراحةً
// 2026-08-04 في `CLAUDE.md`، وحجّتُه هناك بتاريخها): **بنينا ثلاثة حرّاسٍ نصّية
// أخرجت صفراً من صنفٍ يُخرج فيه `no-undef` ثلاثةَ عشرَ عطباً حيّاً في 0.8 ثانية**،
// **وستّةُ عيوبٍ في أحدها يومَ مولده كلُّها من المطابقة النصّية**.
// ⇒ ⭐ **الخصوصيّةُ في مشروعنا هي ما نبنيه، والعموميّةُ تُستعار.**
//
// ── وشرطُ قبول التبنّي كلِّه (قرار المالك) ─────────────────────────────────
// ⛔ **علاجٌ يُسكت الحارسَ عن الصنف الذي بُني له أسوأ من غيابه.** ⇒ **فبلا رؤية
// #77 (`syncSpeedBadgeRow` محذوفة ونداؤها باقٍ) لا معنى للتبنّي أصلاً** — و«13 ×
// `chrome`» مكسبُه الثاني لا الأوّل. **ويُثبَت الشاهدُ على العطب نفسِه.**
//
// ── وما هو مُشتقٌّ وما هو مكتوبٌ بسببه ────────────────────────────────────
// **مُشتَقّ:** عوالمُ المتصفّح والعقدة والإضافات ⇐ حزمة `globals` (1128 + 74 + 3)
// — **مُستعارةٌ لا مكتوبة**، فلا تتباعد عن الواقع كما تباعدت قائمتُنا (سقطت منها
// أربعةٌ في أوّل تشغيل). **والأسماءُ المشترَكة بين سكربتاتنا** ⇐ تُشتقّ من
// `<script src>` لحظةَ الفحص (`tools/eslint-globals.mjs`) **فلا ملفَّ مُولَّداً
// يتباعد**، وبطبقةٍ مُعلَنة (مُقدِّمون ⇒ مستهلكون) **قِيس أنها وصفُ ما نفعله:
// صفرُ نداءٍ صاعد وصفرُ مرجعٍ صاعد**.
// **ومكتوبٌ بسببه:** عوالمُ كونسول المطوّر وحدها — **لا مجموعةَ قياسية لها**،
// وتخصّ مِجَسّات اللصق التي تُلصق في أدوات المتصفّح.
import globals from "globals";
import { sharedGlobalsFor, allPageFiles, PROVIDERS, CONSUMERS } from "./tools/eslint-globals.mjs";

// ⚠️ **مكتوبٌ بسببه، ولا مجموعةَ قياسية له:** كونسول المطوّر يحقن هذي في الصفحة
// عند اللصق — ولا تُوجد في `globals.browser` لأنها ليست من المنصّة.
const DEVTOOLS = { copy: "readonly", getEventListeners: "readonly", inspect: "readonly",
                   monitorEvents: "readonly", $0: "readonly", $$: "readonly" };

const BROWSER = { ...globals.browser, ...globals.webextensions };
const NODE = { ...globals.node };

// ملفّاتُ الصفحة: لكلٍّ نصيبُه من المشترَك — **مُشتقٌّ لا مكتوب**
const pageConfigs = allPageFiles().map((rel) => ({
  files: [rel],
  languageOptions: { sourceType: "script", ecmaVersion: 2023,
                     globals: { ...BROWSER, ...sharedGlobalsFor(rel) } },
}));

export default [
  { rules: { "no-undef": "error" } },
  // ⚙️ **عاملُ الخدمة بيئةٌ ثالثة — تُستعار ولا تُكتب:** `importScripts` ليس
  // في `globals.browser` لأنه من عوالم `serviceworker`. **وهذا نقصُ تهيئةٍ لا
  // عطب** — وقد أُعلن قبل أن يُسدّ (شرط المالك: يُقرأ الأحمرُ ويُصنَّف قبل أن
  // يُسكت أيٌّ منه).
  { files: ["background.js"],
    languageOptions: { globals: { ...globals.serviceworker } } },
  // منتَجٌ يُشحن ولا صفحةَ له: سكربت المحتوى والعالم الرئيسيّ
  { files: ["content.js", "yt_quality_main.js"],
    languageOptions: { sourceType: "script", ecmaVersion: 2023, globals: BROWSER } },
  ...pageConfigs,
  // مِجَسّاتُ اللصق تعيش في صفحة المضيف — وتُعلن ذلك في رأسها.
  // ⛔ **وكانت `probe-70-*` بعينها** ⇒ **قائمةٌ تحرس ما فيها وتُفلت ما يُضاف**،
  // **فأفلتت `probe-108-button.js` يومَ وُلد** (2026-08-06). ⇒ **وُسِّعت بالشكل
  // لا بالاسم** (`probe-*`): **مِجَسُّ لصقٍ جديد يدخل التصنيف بنفسه** — وهو درس
  // «اجعل الخطأ مستحيلاً بموضع واحد بدل أن تُحصيه في قائمة» (قرار 16ج).
  { files: ["tools/report-*.js", "tools/probe-*.js", "tools/force-sync-failure.js"],
    languageOptions: { sourceType: "script", ecmaVersion: 2023, globals: { ...BROWSER, ...DEVTOOLS } } },
  // رِكازُ العقدة
  { files: ["tools/**/*.mjs"],
    languageOptions: { sourceType: "module", ecmaVersion: 2023, globals: NODE } },
  { files: ["tools/**/*.js"],
    languageOptions: { sourceType: "commonjs", ecmaVersion: 2023, globals: NODE } },
  // ⚠️ **الاستثناءُ الوحيد المكتوب:** `settings-ui.js` **يُشحن ويُستهلك في العقدة
  // معاً** — فيه `if (typeof module !== "undefined") module.exports = …` **حارساً
  // مقصوداً** ليقرأه `tools/test-settings-ui.js`. **فيُعلَن `module` عالَماً فيه
  // وحده، ولا يُعمَّم.**
  { files: ["settings-ui.js"], languageOptions: { globals: { module: "writable" } } },
];

export { PROVIDERS, CONSUMERS };
