// البند #38ج — الإيقاظ: **الضغطة تنتهي إلى الحالة نفسها في الفرعين**.
//
// **شرط القبول ليس «تعمل في الحالتين» بل «تنتهيان إلى الحالة نفسها».** ولذلك
// **لا ذراع واحدة تنجح هنا**: تُشغَّل الحالتان ويُشترط **تطابق حالتيهما
// النهائيتين** حرفياً — عدد المستمعين · عدد الطلبات · الجودة المطلوبة · مفتاح
// المحاولة. اختلافُ رقمٍ واحد يُسقط الاختبار.
//
// **الفرعان مقيسان ميدانياً** (`AUDIT.md` §26، `tools/bench-38c-live.mjs`):
//   · `content.js` **غائب**  ⇒ الحقن يبدأ من جديد ⇒ النداء يقع.
//   · `content.js` **حاضر**  ⇒ الحقن **لا عمل له** (حارس `__GVZ_CONTENT_LOADED__`)
//     ⇒ **لا بدء ولا نداء** — وعدّاد الإرسال بقي كما هو. **وهذا هو ما فشل ميدانياً.**
//
// ⚠️ **ولا تأكيد هنا على «تغيّرت الجودة»**: قِيس أن ABR يوتيوب يغيّرها من تلقائه،
// فالشاهد **عدد الطلبات المرسَلة** لا القيمة.
//
// ⚠️ وفشل قسم [٣] يعني أن أحد الحارسين أُزيل (`ytQualityWired` أو مفتاح المحاولة)
// فصارت الضغطة الثانية تضاعف مستمعاً أو طلباً. **لا تُصلحه بحارس في المُرسِل:**
// الحراسة في المستقبِل لأن الطريقين يستهلكانه.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");

function slice(from, to) {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  return a === -1 || b === -1 ? null : SRC.slice(a, b);
}

// تُقتطع القطعة الحقيقية من `content.js`: اختبار على الكود لا على نسخة منه.
const PART = slice("async function loadYtAutoQualitySettings", "// -------- Shorts → المشغّل العادي --------");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// بيئة صغيرة بواجهة ما تستعمله القطعة وحده — والعدّ فيها هو الشاهد.
function makeEnv(storedQuality) {
  const log = { listeners: [], dispatched: [] };
  const win = {
    addEventListener: (t) => log.listeners.push("window:" + t),
    dispatchEvent: (e) => { log.dispatched.push(e); return true; }
  };
  const doc = { addEventListener: (t) => log.listeners.push("document:" + t) };
  const sandbox = {
    log, window: win, document: doc, console, setTimeout,
    location: { host: "www.youtube.com", pathname: "/watch", search: "?v=abc" },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    isYouTubeHost: () => true,
    // ‏#64: البوّابة الواحدة — هنا مفتوحة، فالمقيس خطوة الجودة لا البوّابة
    extensionActive: () => true,
    settingsRead: async () => ({ settings: { ytAutoQuality: sandbox.__stored } }),
    __stored: storedQuality
  };
  sandbox.window.CustomEvent = sandbox.CustomEvent;
  vm.createContext(sandbox);
  vm.runInContext(`let ytAutoQuality = ""; ${PART}`, sandbox);
  return sandbox;
}

// الحالة النهائية المقارَنة — كل ما يمكن أن يتباعد بين الطريقين
const finalState = (env) => ({
  listeners: [...env.log.listeners].sort(),
  requests: env.log.dispatched.filter((e) => e.type === "__vz_setq__").map((e) => e.detail.q),
  key: vm.runInContext("ytQualityAttemptKey", env),
  quality: vm.runInContext("ytAutoQuality", env)
});

const settle = () => new Promise((r) => setTimeout(r, 20));

(async () => {
  console.log("\n=== #38ج — الإيقاظ: تطابق الفرعين ===\n");

  // ── [١] الفرع «غائب»: بدء جديد ينفّذ الخطوة مرة، ثم تصل رسالة الإيقاظ ──────
  console.log("[١] الفرع «غائب» — حقن جديد ثم رسالة الإيقاظ");
  const absent = makeEnv("hd1080");
  await vm.runInContext(`applyYtQualityStep()`, absent); await settle();  // البدء
  await vm.runInContext(`applyYtQualityStep()`, absent); await settle();  // الرسالة تصل بعده
  const sAbsent = finalState(absent);
  console.log(`     الطلبات: ${JSON.stringify(sAbsent.requests)} · المستمعون: ${sAbsent.listeners.length}`);
  check("[١] طلب واحد لا أكثر (الرسالة بعد البدء لا تكرّر)", sAbsent.requests.length === 1,
    JSON.stringify(sAbsent.requests));

  // ── [٢] الفرع «حاضر»: بدءٌ وقع والجودة لم تكن مضبوطة، ثم يُغيّرها المستخدم ──
  // **وهذا هو فرع المالك حرفياً**: الصفحة مفتوحة، `content.js` حاضر، ثم تُضبط
  // الجودة، ثم يُضغط الزرّ — والحقن لا عمل له فلا يبقى إلا الإيقاظ.
  console.log("\n[٢] الفرع «حاضر» — بدءٌ بلا جودة، ثم تُضبط، ثم الضغطة");
  const present = makeEnv("");
  await vm.runInContext(`applyYtQualityStep()`, present); await settle();  // البدء: لا جودة ⇒ لا طلب
  const beforePress = finalState(present);
  check("[٢] البدء بلا جودة لا يُرسل طلباً", beforePress.requests.length === 0,
    JSON.stringify(beforePress.requests));
  present.__stored = "hd1080";                                             // المستخدم يضبطها
  vm.runInContext(`(() => {})()`, present);
  const noPress = finalState(present);
  check("[٢] وبلا ضغطة لا شيء يوقظ الطلب", noPress.requests.length === 0);
  await vm.runInContext(`applyYtQualityStep()`, present); await settle();  // الضغطة ⇒ الإيقاظ
  const sPresent = finalState(present);
  console.log(`     الطلبات: ${JSON.stringify(sPresent.requests)} · المستمعون: ${sPresent.listeners.length}`);
  check("[٢] الإيقاظ يُرسل الطلب", sPresent.requests.length === 1, JSON.stringify(sPresent.requests));

  // ── [٣] **شرط القبول**: الحالتان النهائيتان متطابقتان ─────────────────────
  console.log("\n[٣] شرط القبول — تطابق الحالة النهائية، لا مجرّد نجاح كلٍّ منهما");
  check("[٣] الطلبات متطابقة", JSON.stringify(sAbsent.requests) === JSON.stringify(sPresent.requests),
    `${JSON.stringify(sAbsent.requests)} ≠ ${JSON.stringify(sPresent.requests)}`);
  check("[٣] المستمعون متطابقون عدداً ونوعاً",
    JSON.stringify(sAbsent.listeners) === JSON.stringify(sPresent.listeners),
    `${JSON.stringify(sAbsent.listeners)} ≠ ${JSON.stringify(sPresent.listeners)}`);
  check("[٣] مفتاح المحاولة متطابق", sAbsent.key === sPresent.key, `${sAbsent.key} ≠ ${sPresent.key}`);
  check("[٣] الجودة المطلوبة متطابقة", sAbsent.quality === sPresent.quality);

  // ── [٤] idempotent — بالعدّ لا بالنيّة ────────────────────────────────────
  console.log("\n[٤] ضغطتان متتاليتان لا تفعلان أكثر من واحدة");
  const before = finalState(present);
  await vm.runInContext(`applyYtQualityStep()`, present); await settle();
  await vm.runInContext(`applyYtQualityStep()`, present); await settle();
  const after = finalState(present);
  check("[٤] لا طلب إضافي", after.requests.length === before.requests.length,
    `${before.requests.length} ⇒ ${after.requests.length}`);
  check("[٤] لا مستمع مضاعَف", after.listeners.length === before.listeners.length,
    `${before.listeners.length} ⇒ ${after.listeners.length}`);
  check("[٤] والمستمعون أربعة بالضبط (لا تكرار من الطريقين)", after.listeners.length === 4,
    JSON.stringify(after.listeners));

  // ── [٥] التعريف واحد — لا تسلسل بدء ثانٍ ──────────────────────────────────
  console.log("\n[٥] تعريف واحد يستهلكه الطريقان");
  check("[٥] `applyYtQualityStep` معرَّفة في content.js", /function applyYtQualityStep/.test(SRC));
  check("[٥] والبدء يستهلكها", /startup\("ytQuality",\s*\(\)\s*=>\s*read\.then\(applyYtQualityStep\)\)/.test(SRC));
  check("[٥] والإيقاظ يستهلكها", /GVZ_ACTIVATED[\s\S]{0,400}applyYtQualityStep\(\)/.test(SRC));
  // ⚠️ **بالفاصلة المنقوطة عمداً**: بلا الفاصلة يعدّ التعريف نفسه
  // (`function startYtAutoQuality() {`) والتعليقات التي تذكر الاسم — فيطبع 3
  // وموضع النداء واحد. **عدّ يخلط التعريف بالنداء لا يقيس شيئاً.**
  const calls = (SRC.match(/startYtAutoQuality\(\);/g) || []).length;
  check("[٥] ولا نداء ثانٍ لـ`startYtAutoQuality` خارجها", calls === 1, String(calls));
  const popup = fs.readFileSync("popup.js", "utf8");
  check("[٥] والـ popup يرسل GVZ_ACTIVATED بعد الحقن", /GVZ_ACTIVATED/.test(popup));
  check("[٥] وإطار لم يبدأ لا يستيقظ", /GVZ_ACTIVATED[\s\S]{0,400}if \(startupBegun\)/.test(SRC));

  console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
