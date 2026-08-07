// Audit #14: every save reached each frame TWICE — once as an explicit RELOAD_*
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تصل إعداداتي إلى الصفحة وتُطبَّق
// مرّةً واحدة، أياً كانت القناة التي سبقت؟»*
// ⚠️ **وصُنّف أوّلاً «يقيس جاراً» فكان التصنيف خطأً (2026-08-04):** قُرئ سطرُه
// الأوّل — **وهو يصف العطب الذي وُلد منه** (تسليمٌ مضاعف) — **لا الوعد الذي
// يحرسه**. **وتأكيداتُه تقول غير ذلك**: «طُبِّق مرّة واحدة» · «القيم الجديدة
// تُطبَّق» · «النتيجة متطابقة في الترتيبات كلّها» · «وبعد الاستيقاظ يقرأ القيم
// الحالية» · «وكل الأنواع التسعة مسجَّلة». ⇒ **فالوعدُ محروسٌ هنا، والعدُّ ثالثُ
// ما يحرسه لا أوّلُه.**
// message and once as storage.onChanged — and both reloaded the same slices, each
// loader doing its own storage read. Measured in Chrome on a working frame: 13 reads
// per save, in every arrival order.
//
// Dropping a delivery channel would put the instant apply at risk, so both now feed
// ONE applier: same-tick requests coalesce, the pass does one shared read, and a
// snapshot check makes the second channel free. Measured after: 2 reads worst case.
//
// What this test protects, in order of importance:
//   1. the RESULT is identical whichever channel arrives first, or if only one does;
//   2. a frame that exited early (#13b) does NOT wake for a settings change, and does
//      NOT miss it either — it reads current values itself when a video appears;
//   3. the work is not duplicated.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
if (!SRC.includes("function requestReload")) {
  console.log("  ❌ requestReload غائبة — البند #14 غير منفَّذ");
  process.exit(1);
}

function extract(name) {
  const head = SRC.indexOf(`function ${name}(`);
  if (head === -1) throw new Error(`لم يُعثر على ${name}`);
  const start = SRC.indexOf("{", SRC.indexOf(")", head));
  let depth = 0;
  for (let i = start; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) {
      const from = SRC.lastIndexOf("async function", head) === head - 6 ? head - 6 : head;
      return SRC.slice(from, i + 1);
    }
  }
  throw new Error(`قوس غير مغلق في ${name}`);
}

const CODE = [
  "let startupBegun = true;",
  "let reloadScheduled = false;",
  // #125 — طابورُ الإيقاظ يعيش مع المُحمِّل، **والسندُ يُعلنه كما يُعلن أخواته**
  // (وغيابُه يرفع `ReferenceError` حقيقياً — وقد رفعه في أوّل تشغيلة).
  "let idleWakeQueue = new Set();",
  "function applyIdleConsumerNow() {}",
  "let lastAppliedSnapshot = null;",
  SRC.slice(SRC.indexOf("const RELOAD_MESSAGE_TYPES"), SRC.indexOf("let reloadScheduled")),
  SRC.slice(SRC.indexOf("const startupRead ="), SRC.indexOf("// ---- ONE applier")),
  extract("requestReload"),
  extract("flushReload")
].join("\n");

const LOADERS = ["loadRulesForThisHost", "loadSiteProfile", "loadZoneSettings", "loadOverlaySettings",
  "loadBlockedHosts", "loadSoundDisplaySettings", "loadMasterEnabled", "loadGridAppearance", "loadSubtitleSettings",
  "loadYtAutoQualitySettings", "loadYtShortsRedirectSetting", "loadCleanPlayerSettings",
  // مُحمِّل محرّك السكون (#70 · #72). **مرساةٌ لا تأكيد** (قرار 33): هذه القائمة
  // تُطابق ما في `flushReload` نصّاً، وغيابُ اسمٍ منها يرفع ReferenceError.
  "loadIdleSettings"];

function makeFrame({ awake = true, value = "A" } = {}) {
  const st = { reads: 0, applied: 0, loaders: 0, value };
  const ctx = {
    location: { host: "example.com" },
    spKeyFor: (h) => `sp:${h}`,
    baseDomain: () => "example.com",
    chrome: { storage: { sync: { get: () => { st.reads++; return Promise.resolve({ settings: { v: st.value } }); } } } },
    triggerYtQuality: () => {}, maybeRedirectShorts: () => {},
    // ‏#64: البوّابة الواحدة يستدعيها flushReload عند إخفاء الشبكة
    extensionActive: () => true,
    remappingEnabled: () => true, hideOverlayNow: () => {},
    // #76: `flushReload` تُنادي الاشتقاق بعد اكتمال المُحمِّلات — **مرساةٌ لا تأكيد**
    refreshIdleConsumers: () => {},
    console
  };
  for (const fn of LOADERS) ctx[fn] = () => { st.loaders++; return Promise.resolve(); };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  if (!awake) vm.runInContext("startupBegun = false;", ctx);
  st.ctx = ctx;
  st.wake = () => vm.runInContext("startupBegun = true;", ctx);
  return st;
}
const tick = () => new Promise((r) => setTimeout(r, 20));

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

(async () => {
  console.log("\n[1] ⭐ الترتيبات الثلاثة تُنتج نتيجة واحدة");
  const results = {};
  for (const order of ["changed-then-message", "message-then-changed", "changed-only", "message-only"]) {
    const f = makeFrame();
    if (order === "changed-then-message") { f.ctx.requestReload(); await tick(); f.ctx.requestReload(); }
    else if (order === "message-then-changed") { f.ctx.requestReload(); await tick(); f.ctx.requestReload(); }
    else f.ctx.requestReload();
    await tick(); await tick();
    results[order] = f.loaders;
    check(`«${order}»: طُبِّق مرة واحدة (${f.loaders} مُحمِّلاً = ${LOADERS.length})`,
      f.loaders === LOADERS.length, { loaders: f.loaders, reads: f.reads });
  }
  const vals = Object.values(results);
  check("والنتيجة متطابقة في الترتيبات كلها", new Set(vals).size === 1, results);
}).call(null);

setTimeout(async () => {
  console.log("\n[2] لا تكرار للعمل مهما تعدّدت القنوات");
  {
    const f = makeFrame();
    f.ctx.requestReload(); f.ctx.requestReload(); f.ctx.requestReload();
    await tick(); await tick();
    check("ثلاث قنوات في نفس الدورة ⇒ قراءة واحدة", f.reads === 1, f.reads);
    check("وتطبيق واحد", f.loaders === LOADERS.length, f.loaders);

    // قناة ثانية في دورة لاحقة: تقرأ لتتأكد ثم لا تُطبّق شيئاً
    f.ctx.requestReload();
    await tick(); await tick();
    check("قناة لاحقة بنفس القيم ⇒ قراءة تحقّق بلا تطبيق", f.reads === 2 && f.loaders === LOADERS.length,
      { reads: f.reads, loaders: f.loaders });
  }

  console.log("\n[3] تغيّر حقيقي بعده يُطبَّق — الفحص ليس قفلاً");
  {
    const f = makeFrame();
    f.ctx.requestReload(); await tick(); await tick();
    const first = f.loaders;
    f.value = "B";                       // المستخدم غيّر إعداداً فعلاً
    f.ctx.requestReload(); await tick(); await tick();
    check("القيم الجديدة تُطبَّق", f.loaders === first + LOADERS.length, { first, now: f.loaders });
  }

  console.log("\n[4] ⭐ الإطار النائم (#13ب): لا يستيقظ ولا يفوته شيء");
  {
    const f = makeFrame({ awake: false });
    f.ctx.requestReload(); f.ctx.requestReload();
    await tick(); await tick();
    check("لم يقرأ التخزين", f.reads === 0, f.reads);
    check("ولم يُطبّق شيئاً", f.loaders === 0, f.loaders);
    check("ولم يستيقظ", vm.runInContext("startupBegun", f.ctx) === false);

    // ثم ظهر فيديو فاستيقظ: يقرأ القيم الحالية بنفسه فلا يفوته التغيير
    f.value = "CHANGED_WHILE_ASLEEP";
    f.wake();
    f.ctx.requestReload(); await tick(); await tick();
    check("وبعد الاستيقاظ يقرأ القيم الحالية", f.reads === 1 && f.loaders === LOADERS.length,
      { reads: f.reads, loaders: f.loaders });
  }

  console.log("\n[5] القناتان موصولتان بالمُطبِّق نفسه");
  {
    check("كل RELOAD_* يمرّ بـ requestReload",
      /RELOAD_MESSAGE_TYPES\.has\(msg\?\.type\)\) requestReload\(\)/.test(SRC));
    check("و onChanged كذلك",
      /chrome\.storage\.onChanged\.addListener[\s\S]{0,320}requestReload\(\)/.test(SRC));
    check("ولا مُحمِّل يُستدعى مباشرةً من معالج الرسائل",
      !/msg\?\.type === "RELOAD_[A-Z_]+"\) load/.test(SRC));
    const types = [...SRC.matchAll(/"(RELOAD_[A-Z_]+|GVZ_RELOAD)"/g)].map((m) => m[1]);
    check(`وكل الأنواع التسعة مسجَّلة (${new Set(types).size})`, new Set(types).size >= 9, [...new Set(types)]);
  }

  console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
  process.exit(fail ? 1 : 0);
}, 300);
