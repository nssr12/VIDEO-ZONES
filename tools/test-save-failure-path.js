// يحرس مسار فشل الحفظ الواحد وإرجاعه المؤجَّل (البند #69).
//
// ── العلّة (إحصاء مقيس 2026-08-02) ──────────────────────────────────────────
// 31 موضع كتابة، **28 يراها المستخدم**، **22 منها بضابط ذي حالة** — و**صفرٌ من
// مواضع `options.js` كان يقرأ ناتج الحفظ**. فكانت الرسالة تظهر والضابط يبقى على
// حالةٍ **ليست في التخزين**: رسالةٌ صادقة تحت ضابطٍ يكذب.
//
// ── ثلاثة حرّاس في ملف واحد ────────────────────────────────────────────────
// **[أ] بنيويّ** — `safeSyncSet` تُنادى في `options.js` **من موضع واحد** هو
//     `saveSettings`. موضعٌ ثانٍ يعني مسار فشلٍ ثانياً لا يُرجِع شيئاً — وهو
//     التفرّق الذي وُلد منه البند. نفس شكل حارس #64 وحارس مفاتيح #66.
// **[ب] بنيويّ** — كل فعلٍ يبني واجهته على نجاح الحفظ **يقرأ الناتج**: إعادة
//     الضبط · حفظ المربّع · حذف موقع محظور. وواجهةٌ تُطبَّق بعد حفظٍ فاشل تَعِد
//     بما لم يقع.
// **[ج] سلوكيّ** — منطق التسلسل والتأجيل يُشغَّل فعلاً على حالات معلومة النتيجة:
//     فشلٌ والحارس مرفوع ⇒ **تأجيل لا إسقاط** · سقوط الحارس ⇒ **تنفيذ** ·
//     وحفظٌ أحدث ⇒ **إبطال الأقدم** فلا تُلغى نقرة صحيحة لاحقة.
//
// ── شاهدا القبول (قرار 26) ─────────────────────────────────────────────────
// لكل حارس مصدرٌ مُفتعَل **يجب أن يرفضه**، ومرساةٌ محروسة: تعذُّر استخراج المقطع
// **يُفشل الاختبار** بدل أن يُقرأ سلامةً (قرار 33).
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (n, c, x) => c ? (pass++) : (fail++, console.log(`  ❌ ${n}`, x ?? ""));

const optionsSrc = fs.readFileSync(path.join(ROOT, "options.js"), "utf8");
const popupSrc = fs.readFileSync(path.join(ROOT, "popup.js"), "utf8");
const storageSrc = fs.readFileSync(path.join(ROOT, "storage.js"), "utf8");

// ── [أ] مسار الكتابة الواحد ────────────────────────────────────────────────
console.log("\n[أ] مسار الكتابة الواحد في options.js");
const calls = (src, needle) => src.split(needle).length - 1;
function sliceBetween(src, from, to) {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  if (a === -1 || b === -1) return null;
  return src.slice(a, b);
}

const sseCalls = calls(optionsSrc, "safeSyncSet(");
ok("safeSyncSet تُنادى من موضع واحد", sseCalls === 1,
   `المقيس ${sseCalls} — موضعٌ ثانٍ يعني مسار فشل لا يُرجِع`);
// وهي داخل saveSettings لا في دالّة أخرى
const saveFn = optionsSrc.slice(optionsSrc.indexOf("async function saveSettings("));
ok("والنداء داخل saveSettings", saveFn.slice(0, saveFn.indexOf("\n}")).includes("safeSyncSet("));
ok("ومسار الفشل يجدول الإرجاع", /pendingRevertSeq = seq;\s*\n?\s*flushPendingRevert\(\)/.test(optionsSrc));
// الاستثناء المُعلن: الاستيراد يكتب مباشرة بلقطته
ok("والاستيراد يبقى استثناءً معلناً", optionsSrc.includes("chrome.storage.sync.set(parsed.data)"));

// ── [ب] لا واجهة تُطبَّق بعد حفظٍ فاشل ─────────────────────────────────────
console.log("\n[ب] الأفعال التي تبني واجهتها على النجاح");
for (const [name, anchor] of [
  ["إعادة الضبط", '$("reset").addEventListener'],
  ["حفظ المربّع", '$("modalSave").addEventListener'],
  ["حذف موقع محظور", 'btn.addEventListener("click", async () => {']
]) {
  const at = optionsSrc.indexOf(anchor);
  ok(`المرساة موجودة — ${name}`, at !== -1, "**أصلِح المرساة لا التأكيد** (قرار 33)");
  if (at === -1) continue;
  const body = optionsSrc.slice(at, at + 900);
  ok(`${name} يقرأ ناتج الحفظ`, /if \(!\(await saveSettings\(/.test(body));
}
// «إعادة مظهر الشبكة» كانت الوحيدة الصحيحة سلفاً — تبقى كذلك
ok("إعادة مظهر الشبكة تبقى مشروطة بالنجاح", /if \(await saveSettings\(s\)\) \{/.test(optionsSrc));

// ── قناة الفشل الواحدة في popup ────────────────────────────────────────────
console.log("\n[أ٢] قناة الفشل في storage.js و popup.js");
ok("safeSyncSet تُبلّغ عن كل فشل", /const failed = \(message\) => \{[\s\S]*syncFailureHandler\?\.\(/.test(storageSrc));
// ⚠️ **يُقاس داخل جسم `safeSyncSet` وحده.** أوّل صياغة بحثت في الملف كلّه
// فالتقطت نتائج **الهجرة** (`{ ok:false, reason:"write" }`) وحمّرت شيئاً سليماً:
// **مرساةٌ أوسع من سؤالها تقيس ما لم تُسأل عنه.**
const sseBody = sliceBetween(storageSrc, "async function safeSyncSet(items)", "\n}\n");
ok("استُخرج جسم safeSyncSet", !!sseBody, "**أصلِح المرساة لا التأكيد** (قرار 33)");
ok("وكل مخرج فشل فيه يمرّ بالقناة",
   !!sseBody && calls(sseBody, "return failed(") === 2 && calls(sseBody, "ok: false") === 1);
ok("والـ popup يسجّل معالجاً واحداً", calls(popupSrc, "onSyncWriteFailed(") === 1);
ok("ويرسم من التخزين لا من خريطة ضابط", /async function renderPopupFromStorage\(\)/.test(popupSrc));

// ── [ج] السلوك: التسلسل والتأجيل ───────────────────────────────────────────
console.log("\n[ج] التسلسل والتأجيل — سلوكاً لا نصّاً");
// يُستخرج المنطق نفسه من المنتج ويُشغَّل، فلا نسخة ثانية منه هنا
const logic = sliceBetween(optionsSrc, "let saveSeq = 0;", "// Failure is surfaced here");
ok("استُخرج منطق التسلسل من المنتج", !!logic, "**أصلِح المرساة لا التأكيد** (قرار 33)");
if (logic) {
  const mk = (state) => {
    const ctx = {
      cleanPlayerSaving: state.busy ? 1 : 0,
      $: (id) => id === "modalOverlay" ? { hidden: !state.modalOpen } : null,
      renderAllFromStorage: () => { ctx.rendered = (ctx.rendered || 0) + 1; },
      rendered: 0
    };
    vm.createContext(ctx);
    vm.runInContext(logic, ctx);
    return ctx;
  };
  // (1) فشلٌ والحارس ساقط ⇒ يقع الإرجاع فوراً
  let c = mk({});
  vm.runInContext("saveSeq = 1; pendingRevertSeq = 1; flushPendingRevert();", c);
  ok("حارس ساقط ⇒ إرجاع فوريّ", c.rendered === 1, `rendered=${c.rendered}`);

  // (2) فشلٌ وحارس Clean Player مرفوع ⇒ **تأجيل لا إسقاط**
  c = mk({ busy: true });
  vm.runInContext("saveSeq = 1; pendingRevertSeq = 1; flushPendingRevert();", c);
  ok("حارس مرفوع ⇒ لا رسم", c.rendered === 0);
  ok("والإرجاع باقٍ معلّقاً لا مُلغى", vm.runInContext("pendingRevertSeq", c) === 1);
  vm.runInContext("cleanPlayerSaving = 0; flushPendingRevert();", c);
  ok("وبسقوط الحارس يقع الإرجاع", c.rendered === 1);

  // (3) والمودال مثله — الحارس الثاني
  c = mk({ modalOpen: true });
  vm.runInContext("saveSeq = 1; pendingRevertSeq = 1; flushPendingRevert();", c);
  ok("مودال مفتوح ⇒ لا رسم", c.rendered === 0);
  ok("والإرجاع معلّق", vm.runInContext("pendingRevertSeq", c) === 1);
  c.$ = () => ({ hidden: true });
  vm.runInContext("flushPendingRevert();", c);
  ok("وبإغلاق المودال يقع الإرجاع", c.rendered === 1);

  // (4) **نقرتان سريعتان تفشل أولاهما ⇒ الثانية لا تُلغى**
  c = mk({ busy: true });
  vm.runInContext("saveSeq = 1; pendingRevertSeq = 1;", c);        // الأولى فشلت
  vm.runInContext("saveSeq = 2;", c);                              // الثانية بدأت
  vm.runInContext("cleanPlayerSaving = 0; flushPendingRevert();", c);
  ok("حفظٌ أحدث يُبطل إرجاع الأقدم", c.rendered === 0, `rendered=${c.rendered}`);
  ok("ولا يبقى معلّقاً بعد إبطاله", vm.runInContext("pendingRevertSeq", c) === 0);

  // (5) وآخر فشلٍ هو الذي يُرجَع
  c = mk({});
  vm.runInContext("saveSeq = 3; pendingRevertSeq = 3; flushPendingRevert();", c);
  ok("آخر حفظٍ فاشل يُرجَع", c.rendered === 1);
}

// ── الشاهد الموجب: مصادر مُفتعَلة يجب أن تُرفض ─────────────────────────────
console.log("\n[شاهد] مصادر مُفتعَلة");
const fakeTwoCalls = "await safeSyncSet({a:1});\nawait safeSyncSet({b:2});";
ok("موضعان لـsafeSyncSet يُرفضان", calls(fakeTwoCalls, "safeSyncSet(") !== 1);
const fakeUngated = '$("reset").addEventListener("click", async () => { await saveSettings(s); $("enabled").checked = true; });';
ok("فعلٌ بلا قراءة الناتج يُرفض", !/if \(!\(await saveSettings\(/.test(fakeUngated));
ok("ومصدر بلا مرساة يُرفض", sliceBetween("x", "let saveSeq = 0;", "y") === null);

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
