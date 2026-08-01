// البند #30 — **تعريف واحد للفيديو تحت المؤشّر، يستهلكه الطريقان**.
//
// **التوحيد هو البند لا التنظيف.** كان في الملف تعريفان **متكافئان سلوكياً حرفاً
// بحرف**، يختلفان في الصياغة وحدها:
//
//     getVideoUnderPointer(e)         — إن كان الإحداثيان رقمين، ابحث؛ وإلا null
//     getVideoUnderPointerStrict(e)   — إن لم يكونا رقمين فـnull؛ وإلا ابحث
//
// **نفس المدخلات ⇒ نفس المخرجات**، وهو ما يجعلهما ازدواجاً لا خيارين. وهذا **عين
// العقد الذي كرّرناه في #60 و#38ج**: نسختان تتباعدان مع الوقت، والثانية لا يعرفها
// من يُصلح الأولى.
//
// ⚠️ **وحارس نصّي يمنع عودة الاسم الثاني** — لا اعتماداً على أن يتذكّر أحد.
//
// **شرط القبول: صفر تغيّر سلوكي.** والقسم [٢] يُبرهنه بتشغيل **الصياغتين** على
// **مصفوفة مدخلات واحدة** واشتراط تطابق كل خرج — فالتكافؤ مقيس لا مُدَّعى.
const fs = require("fs");

const SRC = fs.readFileSync("content.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

console.log("\n=== #30 — تعريف واحد تحت المؤشّر ===\n");

// ── [١] الاسم الثاني لا يعود ──────────────────────────────────────────────
console.log("[١] الحارس النصّي");
{
  check("[١] `getVideoUnderPointerStrict` غير موجود إطلاقاً",
    !SRC.includes("getVideoUnderPointerStrict"),
    "عاد الاسم الثاني — وحّد المسارين ولا تُعِد نسخةً ثانية");
  const defs = (SRC.match(/function getVideoUnderPointer\(/g) || []).length;
  check("[١] وتعريف واحد فقط لـ`getVideoUnderPointer`", defs === 1, `العدد ${defs}`);
  // يستهلكه الطريقان: مسار المربّعات ومسار الفأرة
  // المرساة بلا قوس إغلاق: التوقيع صار `(e, blockScrollable)` في #65، ومرساةٌ
  // تشترط `(e)` تكسر اختباراً تغطيتُه سليمة (قرار 33).
  const calls = (SRC.match(/getVideoUnderPointer\(e[,)]/g) || []).length;
  check("[١] ويستهلكه أكثر من مسار", calls >= 3, `مواضع النداء ${calls}`);
}

// ── [٢] التكافؤ مقيس لا مُدَّعى ───────────────────────────────────────────
console.log("\n[٢] صفر تغيّر سلوكي — الصياغتان على مصفوفة مدخلات واحدة");
{
  // الصياغة الباقية، مقتطعة من `content.js` نفسه
  const kept = SRC.slice(SRC.indexOf("function getVideoUnderPointer(e"));
  const keptBody = kept.slice(0, kept.indexOf("\n}") + 2);
  // ⚠️ **الصياغة المحذوفة مجمَّدة هنا نصّاً** — مرجعُ «ما كان» يُقاس عليه، ولا
  // تُحدَّث مع الكود: قيمتها كلّها في أنها لا تتغيّر.
  const removed = `function removedStrict(e) {
    if (typeof e.clientX !== "number" || typeof e.clientY !== "number") return null;
    const v = findVideoAtPoint(e.clientX, e.clientY);
    return v || null;
  }`;

  const CASES = [
    ["إحداثيان صحيحان وفيديو موجود", { clientX: 10, clientY: 20 }, "V"],
    ["إحداثيان صحيحان ولا فيديو", { clientX: 10, clientY: 20 }, null],
    ["صفر وصفر (قيمة زائفة لكنها رقم)", { clientX: 0, clientY: 0 }, "V"],
    ["إحداثيان سالبان", { clientX: -5, clientY: -5 }, "V"],
    ["clientX غير رقم", { clientX: undefined, clientY: 20 }, "V"],
    ["clientY غير رقم", { clientX: 10, clientY: null }, "V"],
    ["كلاهما غائب", {}, "V"],
    ["نصّ بدل رقم", { clientX: "10", clientY: "20" }, "V"],
    ["NaN — رقمٌ بالنوع", { clientX: NaN, clientY: NaN }, "V"]
  ];

  let mismatches = 0;
  for (const [label, ev, found] of CASES) {
    const run = (src, name) => {
      const fn = new Function("findVideoAtPoint", `${src}; return ${name};`)(() => found);
      return fn(ev);
    };
    const a = run(keptBody, "getVideoUnderPointer");
    const b = run(removed, "removedStrict");
    const same = a === b;
    if (!same) mismatches++;
    check(`[٢] ${label} ⇒ ${JSON.stringify(a)}`, same, `الباقية ${a} · المحذوفة ${b}`);
  }
  check("[٢] **صفر اختلاف عبر الحالات التسع**", mismatches === 0, `${mismatches} اختلافاً`);
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
