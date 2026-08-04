// حارس #86: حالةُ «زرٌّ ممسوك» تُوفَّق من `e.buttons` — فالعلوق مستحيلٌ بالبناء.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«بعد ملء الشاشة بأمري، أيختفي الشريط بمهلتي بلا أن أضغط شيئاً؟»*
//
// ⚠️ **يسأل السؤال الصحيح (قرار 72): «أأخفاه صنفُنا؟» لا «أاختفى؟»** — والحارس
// الذي يسأل الثاني **كان سيمرّ لأن يوتيوب أخفى شريطه بنفسه** (قرار 48). فهنا
// يُقاس **سببُنا**: هل يُفكّ الامتناع، فيصير الإخفاء ممكناً بنا؟
//
// ── الحال المقيسة عند المالك (2026-08-04) — وهي مرساة هذا الملف ─────────────
//   `{"held":true,"state":"idle","timerArmed":false,"wanted":true,"ms":100,
//     "fullscreen":"HTML"}` **بعد ملء الشاشة بأمرنا وبلا أي ضغطة.**
//   ⇒ **المستهلك يريد الإخفاء، والامتناع عالقٌ يمنعه، ولا مؤقّت.**
//   **والضغطةُ تفكّه بإفلاتها** — ولذلك كان يبدو «يعمل بعد ضغطة».
//
// ⛔ **فشل هذا الملف يعني أن التوفيق سقط**، فالعلوق ممكنٌ ثانيةً — **ولا يُصلَح
// التأكيد ليمرّ** (قرار 33).
const fs = require("fs");
const vm = require("vm");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

const SRC = fs.readFileSync("content.js", "utf8");

function bodyOf(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) return null;
  let depth = 0;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}

// ── سياقٌ يحمل الحالة والدوالّ الحقيقية من `content.js` ─────────────────────
function makeCtx(src) {
  const ctx = { refreshCalls: 0, console };
  vm.createContext(ctx);
  const reconcile = bodyOf(src, "reconcileIdlePointerHeld");
  const release = bodyOf(src, "releaseIdlePointer");
  vm.runInContext(`
    let idlePointerHeld = false;
    function refreshIdleConsumers() { refreshCalls++; }
    ${release || "function releaseIdlePointer() { idlePointerHeld = false; }"}
    ${reconcile || "function reconcileIdlePointerHeld() { /* لا وجود لها — البناء السابق */ }"}
    function press() { idlePointerHeld = true; }        // ما يفعله مستمع mousedown
    function read() { return idlePointerHeld; }
  `, ctx);
  return { ctx, hasReconcile: !!reconcile };
}

// حدثٌ كما يصل: `buttons` قناعٌ للأزرار المضغوطة الآن (0 = لا شيء)
const ev = (buttons, trusted = true) => ({ buttons, isTrusted: trusted, type: "mousemove" });

console.log("\n[1] التوفيق موجودٌ ومُنادى من نقطة المرور الواحدة");
{
  const { hasReconcile } = makeCtx(SRC);
  check("`reconcileIdlePointerHeld` موجودة", hasReconcile);
  const upd = bodyOf(SRC, "updatePointerFromEvent");
  check("و`updatePointerFromEvent` تناديها — **نقطةُ المرور الواحدة**",
    !!upd && /reconcileIdlePointerHeld\(/.test(upd));
}

console.log("\n[2] حالُ المالك المقيسة: ممسوكٌ عالق ⇒ **يُفكّ بأوّل حدثٍ بلا أزرار**");
{
  const { ctx } = makeCtx(SRC);
  vm.runInContext(`press()`, ctx);                       // ضغطةٌ على المشغّل
  check("بعد الضغطة: ممسوك", vm.runInContext(`read()`, ctx) === true);
  // **نقلةُ ملء الشاشة تبتلع الإفلات** — فلا `mouseup` يصل، والحالة عالقة
  check("ولا شيء يفكّه بلا حدث", vm.runInContext(`read()`, ctx) === true);
  // ⇒ ثمّ **حركةٌ عادية** كما فعل المالك: `buttons === 0`
  ctx.e0 = ev(0);
  vm.runInContext(`reconcileIdlePointerHeld(e0)`, ctx);
  check("⭐ حركةٌ بلا أزرار **تفكّه** — فالعلوق مستحيلٌ بالبناء",
    vm.runInContext(`read()`, ctx) === false);
  check("وتُعلن التغيّر للمستهلكين مرّةً", ctx.refreshCalls === 1, ctx.refreshCalls);
}

console.log("\n[3] ولا يُفكّ ما هو ممسوكٌ حقّاً — ولا يُقلَب إلى ممسوك بحدث");
{
  const { ctx } = makeCtx(SRC);
  vm.runInContext(`press()`, ctx);
  ctx.e1 = ev(1);                                        // الزرّ الأساسي مضغوطٌ الآن
  vm.runInContext(`reconcileIdlePointerHeld(e1)`, ctx);
  check("زرٌّ مضغوطٌ فعلاً ⇒ يبقى ممسوكاً (لا نُخفي تحت يد المستخدم)",
    vm.runInContext(`read()`, ctx) === true);
  check("ولا إعلانَ بلا تغيّر", ctx.refreshCalls === 0, ctx.refreshCalls);

  // **والتوفيق لا يَمسك**: بدءُ الإمساك حكمُ `mousedown` وحده (بشرط الموضع)
  const { ctx: c2 } = makeCtx(SRC);
  c2.e2 = ev(4);                                         // الأوسط مضغوطٌ وضغطتُه بدأت خارج المشغّل
  vm.runInContext(`reconcileIdlePointerHeld(e2)`, c2);
  check("⭐ ولا يُنشئ إمساكاً لم يبدأ عندنا — التوفيق يُصحّح ولا يُقرّر",
    vm.runInContext(`read()`, c2) === false);
}

console.log("\n[4] وحدثٌ لا يحمل الحالة لا يُحكم به");
{
  const { ctx } = makeCtx(SRC);
  vm.runInContext(`press()`, ctx);
  ctx.e3 = { isTrusted: true, type: "mousemove" };        // بلا `buttons`
  vm.runInContext(`reconcileIdlePointerHeld(e3)`, ctx);
  check("حدثٌ بلا `buttons` ⇒ لا تغيير (لا يُقرأ الغياب صفراً)",
    vm.runInContext(`read()`, ctx) === true);
  const { ctx: c2 } = makeCtx(SRC);
  vm.runInContext(`press()`, c2);
  c2.e4 = ev(0, false);                                   // حدثٌ من صنعنا
  vm.runInContext(`reconcileIdlePointerHeld(e4)`, c2);
  check("وحدثٌ غير موثوق لا يفكّ — **كما لا يَمسك**",
    vm.runInContext(`read()`, c2) === true);
}

console.log("\n[5] شاهدُ الأحمر — البناء السابق (بلا توفيق) **يبقى عالقاً**");
{
  // مصدرٌ مُفتعَل: تُنزع الدالّة كما كان الحال قبل العلاج
  const before = SRC.replace(bodyOf(SRC, "reconcileIdlePointerHeld") || "###", "");
  const { ctx, hasReconcile } = makeCtx(before);
  check("المصدر المُفتعَل بلا التوفيق فعلاً (وإلّا فالشاهد وهم)", !hasReconcile);
  vm.runInContext(`press()`, ctx);
  ctx.e0 = ev(0);
  vm.runInContext(`reconcileIdlePointerHeld(e0)`, ctx);
  check("⭐ وعليه **تبقى الحالة عالقة** — وهو العَرَض الذي قاسه المالك",
    vm.runInContext(`read()`, ctx) === true);
}

console.log("\n[6] والمخارج الأربعة باقية — لا يُحذف ما لم يُقس أنه بلا عمل");
{
  // بوّابة #85 نفسها: **لا حذفَ بلا قياسٍ يُثبت أن الشيء صار بلا عمل**.
  for (const [name, re] of [
    ["mouseup", /addEventListener\("mouseup", releaseIdlePointer/],
    ["pointercancel", /addEventListener\("pointercancel", releaseIdlePointer/],
    ["blur", /addEventListener\("blur", releaseIdlePointer/],
    ["visibilitychange", /addEventListener\("visibilitychange"/]
  ]) check(`المخرج \`${name}\` باقٍ`, re.test(SRC));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
