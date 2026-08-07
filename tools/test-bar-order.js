// يحرس أن ترتيب أزرار الشريط لا يُحوّل الشجرة حين يستقيم — بالعدّ لا بالنظر.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«عدّلتُ مواقع الأزرار فصارت الأزرارُ
// في الفيديو لا تُضغَط — والعجلةُ تعمل على زرّ السرعة ولا يعمل النقر. لماذا؟»*
//
// ── ⛔ لماذا وُجد (2026-08-07، من عطبٍ حيّ عند المالك — #121) ────────────────
// `applyBarOrder` كانت تمشي بالعكس وتُدرج كلَّ عنصرٍ عند رأس الحاوية، **وحارسُها
// يفحص الموضعَ الأوّل وحدَه** ⇒ **فتُنقل كلُّ عقدةٍ في كلّ نداء ولو استقام
// الترتيب**. **والمقيس يومَها: عقدتان في كلّ نداءٍ من ثلاثة.**
// ⇒ ⭐⭐ **والأثرُ في الحدث لا في الرسم:** تُنادى من مسار السكون **عند كلّ نشاط**
// ⇒ **العقدةُ تُنزع وتُعاد بين `mousedown` و`mouseup`** ⇒ **لا `click`.**
// **والعجلةُ تنجو لأنها حدثٌ واحد بلا زوج.**
// ⇒ ⛔ **ولم يكن فقدَ مستمعات**: `insertBefore` ينقل ولا ينسخ، **والمستمعان على
// العقدة نفسِها** — **ففرضيّةُ النسخ سقطت بسندين مستقلَّين قبل أن تُجرَّب.**
//
// ⚠️ **وحدُّه مُعلَن:** يقيس **التحويل في الشجرة** لا وقوعَ النقرة —
// **ووقوعُها مقيسٌ حيّاً في `bench-content-errors` (القسم [٩])**، **وهذا يحرس
// السببَ وذاك يحرس الأثر.**
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => check(m, c);
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

function paired(name) {
  const a = SRC.indexOf(`// ---- BEGIN ${name} ----`);
  const b = SRC.indexOf(`// ---- END ${name} ----`, a);
  if (a === -1 || b === -1) throw new Error(`الكتلة المتناظرة ${name} غير موجودة`);
  return SRC.slice(a, b);
}
function fnSource(sig) {
  const a = SRC.indexOf(sig);
  if (a === -1) throw new Error(`المرساة سقطت: ${sig} — أصلِح المرساة لا التأكيد`);
  return SRC.slice(a, SRC.indexOf("\n}", a) + 2);
}

// **سندٌ أمينٌ للشجرة**: `parentElement` مشتقٌّ من العضويّة لا مُعلَنٌ بيد —
// ⚠️ **وأوّلُ صياغةٍ له أعلنته بيدٍ فأنتجت حالاً مستحيلة** (عنصرٌ يدّعي أباً لا
// يحويه) **فقرأتُ منها ثرثرةً لا وجودَ لها** — وهو «الحالُ لم تُنتَج» في السند نفسِه.
function makeSlot(ids) {
  let moves = 0;
  const slot = {
    children: [],
    insertBefore(el, ref) {
      moves++;
      const i = slot.children.indexOf(el);
      if (i >= 0) slot.children.splice(i, 1);
      const j = ref ? slot.children.indexOf(ref) : -1;
      if (j >= 0) slot.children.splice(j, 0, el); else slot.children.push(el);
    },
    get firstChild() { return slot.children[0] || null; }
  };
  const els = {};
  for (const id of ids) {
    const el = {
      id,
      classList: { contains: (c) => c === "vzInBar" },
      get parentElement() { return slot.children.includes(el) ? slot : null; },
      get nextSibling() { const i = slot.children.indexOf(el); return i === -1 ? null : (slot.children[i + 1] || null); }
    };
    els[id] = el;
  }
  return { slot, els, moves: () => moves, reset: () => { moves = 0; } };
}

function run(order, domOrder) {
  const { slot, els, moves, reset } = makeSlot(["speed", "filter"]);
  slot.children = domOrder.map((id) => els[id]);
  const ctx = {
    console,
    overlaySettings: { barButtons: order.map((id) => ({ id, on: true })) },
    BAR_BUTTONS: { speed: { el: () => els.speed }, filter: { el: () => els.filter } }
  };
  vm.createContext(ctx);
  vm.runInContext(paired("barButtons"), ctx);
  vm.runInContext(fnSource("function applyBarOrder()"), ctx);
  vm.runInContext("applyBarOrder()", ctx);
  const first = moves();
  reset();
  vm.runInContext("applyBarOrder()", ctx);
  vm.runInContext("applyBarOrder()", ctx);
  return { after: slot.children.map((e) => e.id), first, repeat: moves() };
}

console.log("\n=== #121 — ترتيبُ أزرار الشريط: صفرُ تحويلٍ حين يستقيم ===\n");

console.log("[1] الترتيبُ يقع حين يختلف");
{
  const r = run(["filter", "speed"], ["speed", "filter"]);
  check("[1] الشجرةُ صارت كالمطلوب", r.after.join(",") === "filter,speed", r.after);
  check("[1] ووقع نقلٌ واحدٌ على الأقل", r.first >= 1, r.first);
}

console.log("\n[2] ⭐⭐ ولا تحويلَ حين يستقيم — وهو العطبُ بعينه");
{
  const r = run(["filter", "speed"], ["speed", "filter"]);
  // ⛔ **فشلُ هذا التأكيد يعني عودةَ #121**: العقدةُ تُنزع وتُعاد بين ضغطتَي
  // الفأرة **فلا يُولَّد `click`** — **راجِع `applyBarOrder` ولا تُصلح الاختبار.**
  check("[2] ⭐⭐ نداءان بعد الاستقامة ⇒ صفرُ نقل", r.repeat === 0, r.repeat);
}

console.log("\n[3] وحينَ يستقيم ابتداءً لا يُلمس شيء");
{
  const r = run(["speed", "filter"], ["speed", "filter"]);
  check("[3] صفرُ نقلٍ في النداء الأوّل", r.first === 0, r.first);
  check("[3] وصفرٌ في النداءين بعده", r.repeat === 0, r.repeat);
  check("[3] والترتيبُ باقٍ", r.after.join(",") === "speed,filter", r.after);
}

console.log("\n[4] وزرٌّ واحد في الشريط لا يُرتَّب ولا يُنقل");
{
  const { slot, els, moves } = makeSlot(["speed", "filter"]);
  slot.children = [els.speed];
  const ctx = { console, overlaySettings: { barButtons: [{ id: "speed", on: true }] },
    BAR_BUTTONS: { speed: { el: () => els.speed }, filter: { el: () => els.filter } } };
  vm.createContext(ctx);
  vm.runInContext(paired("barButtons"), ctx);
  vm.runInContext(fnSource("function applyBarOrder()"), ctx);
  vm.runInContext("applyBarOrder()", ctx);
  vm.runInContext("applyBarOrder()", ctx);
  check("[4] صفرُ نقل", moves() === 0, moves());
}


console.log("\n[5] ⭐ #125 — الإيقاظُ لمستهلكٍ واحد، ولا يرسم المستهلكُ نفسَه");
{
  const src = SRC;
  // ⛔ **الحدُّ المعماريّ لا يُنقض**: الإظهارُ يمرّ بالمحرّك، **لا نداءَ مباشر
  // لـ`setSpeedBtnShown` من مسار القراءة** — وإلا رسم المستهلكُ نفسَه من ورائه.
  const fn = fnSource("function applyIdleConsumerNow(name)");
  ok(/c\.onActive\("active"\)/.test(fn) && /c\.onDisabled\(\)/.test(fn),
     "[5] الإيقاظُ يمرّ بسياسة المستهلك (`onActive`/`onDisabled`) لا برسمٍ مباشر");
  ok(!/setSpeedBtnShown|setFilterBtnShown/.test(fn),
     "[5] ⭐ ولا نداءَ مباشراً لرسم زرٍّ داخله");
  // ⛔ **ولا يوقظ الآخرين**: يأخذ اسماً واحداً ولا يمشي على السجلّ
  ok(/IDLE_CONSUMERS\[name\]/.test(fn) && !/Object\.values\(IDLE_CONSUMERS\)/.test(fn),
     "[5] ⭐⭐ وباسمِ مستهلكٍ واحد — لا يمشي على السجلّ كلِّه");
  // **والمُطفأُ لا يُوقَظ**: الشرطُ على `on === true` وحده
  // ⚠️ **أُصلحت المرساةُ لا التأكيد** (قرار 33): الشريحةُ تنتهي عند نهاية المُحمِّل
  const _a = src.indexOf("let idleWakeQueue");
  const loader = src.slice(_a, src.indexOf("\n}", src.indexOf("for (const it of overlaySettings.barButtons)", _a)));
  ok(/it\.on === true && wasOn\[it\.id\] === false/.test(loader),
     "[5] ⭐ ولا يُوقَظ إلا من صار مُشغَّلاً الآن (لا المُطفأ ولا الثابت)");
  // **وبعد التطبيق المعتاد لا قبله** — فلا يُلغيه
  const flush = src.slice(src.indexOf("async function flushReload"), src.indexOf("function runStartupSteps"));
  ok(flush.indexOf("refreshIdleConsumers()") < flush.indexOf("applyIdleConsumerNow"),
     "[5] وبعد `refreshIdleConsumers` لا قبلها — فلا يُلغيه التطبيقُ المعتاد");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
