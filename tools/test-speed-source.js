// تعريف السرعة الواحد — موضع كتابة `playbackRate` واحد، وصفر تغيّر سلوكي مقابل الكود السابق
//
// **البند:** التعريف الواحد الذي يسبق **#71** (شارة السرعة) و**#72** (زرّ
// السرعة)، بقرار المالك 2026-08-02. الحدّان `0.25` و`4` كانا مكتوبين **مرّتين
// حرفياً** في كتلتَي `ACTION:SPEED`، ولو دخلت الميزتان قبل التوحيد لصارتا **أربع
// نسخ لرقمين** — «موضعان للحقيقة الواحدة» الذي كذب في عدّ التأكيدات ثلاث مرّات.
//
// ⚠️ **شرط قبول هذا الكومِت واحد: صفر تغيّر سلوكي.** فأكثر هذا الملف لا يبرهن أن
// السرعة «تعمل» بل أن **الجديد يساوي القديم بالضبط** — والأوراكل في القسم [2]
// يحمل **التعبير القديم نصّاً** كما كان في `content.js` قبل هذا الكومِت.
//
// ⚠️ **وفشل القسم [1] يعني أن مساراً جديداً صار يكتب `playbackRate` بيده** —
// وهو ما مُنع صراحةً (قرار المالك: الزرّ يُصدر أمراً من نحو `ACTION:` ولا يكتب
// بيده). **الإصلاح في المسار الجديد لا في هذا العدّ.**
//
// ⚠️ **وفشل القسم [4] مرساةٌ لا كود** (قرار 33): `tools/test-host-adapter.js`
// يقتطع كتلة الصوت **حتى تعليق `// Speed: SET absolute value`** — فحذف التعليق
// يكسر ملفّاً آخر. افحص المرساة قبل أن تفترض أن الكود هو المكسور.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

function slice(from, to) {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  return a === -1 || b === -1 ? null : SRC.slice(a, b);
}

// الحكم على الكود لا على ما يذكر الاسم في تعليق (نمط `test-master-gate.js`)
const CODE = SRC.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");

console.log("\n=== تعريف السرعة الواحد (يسبق #71 و#72) ===\n");

// ── [1] المصدر: موضع كتابة واحد ─────────────────────────────────────────────
console.log("[1] `playbackRate` تُكتب من موضع واحد في الإضافة كلّها");
{
  const writes = (CODE.match(/\.playbackRate\s*=(?!=)/g) || []).length;
  check("[1] موضع كتابة واحد بالضبط", writes === 1, `العدد ${writes}`);

  const def = slice("function setPlaybackRate", "\n}");
  check("[1] وهو داخل `setPlaybackRate` نفسها",
    !!def && /\.playbackRate\s*=(?!=)/.test(def), def);

  // النسخة المكرَّرة ماتت: الحدّان صارا ثابتين مسمَّيين لا رقمين في تعبير مكرَّر
  const literal = (CODE.match(/Math\.min\(4\s*,/g) || []).length;
  check("[1] ولا نسخة ثانية من التعبير بالرقمين", literal === 0, `العدد ${literal}`);
  check("[1] والحدّان ثابتان مسمَّيان",
    /const VZ_SPEED_MIN = 0\.25;/.test(SRC) && /const VZ_SPEED_MAX = 4;/.test(SRC));

  // القراءة `|| 1` ليست أسلوباً: `?? 1` تعطي 0 حيث تعطي هذه 1
  const step = slice("function stepPlaybackRate", "\n}");
  check("[1] و`|| 1` باقية في الخطوة النسبية (لا `?? 1`)",
    !!step && /playbackRate \|\| 1/.test(step) && !/playbackRate \?\? 1/.test(step), step);
}

// ── العالم: الدالّتان وكتلتا `runAction` تُقرأان من المنتج لا تُنسخان ────────
const SPEED_DEF = slice("const VZ_SPEED_MIN", "// ── البند #58");
const SPEED_RUN = slice("  // Speed: SET absolute value", "\n  return false;\n}");
if (!SPEED_DEF || !SPEED_RUN) {
  // ⚠️ المجموع هنا **المتراكم**، لا `0/1`: مخرَجٌ يُصفّر ما وقع قبله يطبع عدداً
  // أصغر من الحقيقة — وهي العلّة نفسها التي بُني عليها `run-tests.js` (قرار 26).
  console.log("  ❌ تعذّر اقتطاع مصدر السرعة — **المرساة سقطت، أصلِح المرساة لا التأكيد**");
  console.log(`\n❌ نجح ${pass} / فشل ${fail + 1}\n`);
  process.exit(1);
}
// ⚠️ **العالم يعلن بوّابة #71 وشارتها — مرساةٌ لا تأكيد (قرار 33).**
// `setPlaybackRate` صارت تنادي `speedBadgeActive()` ثمّ `showBadge()`، وهما
// **خارج القطعة المقتطعة** عمداً: البوّابة والمُظهِر ليسا من تعريف السرعة.
// والعدّاد هنا **يُستعمل في القسم [6]** ليُبرهن أن الشارة تُنادى من الموضع
// الواحد — فلا يصير الإعلان بديلاً صامتاً يُخفي أنها لا تُنادى أصلاً.
const badgeCalls = [];
const btnSyncs = [];
let gateOpen = true;
const ctx = {
  extensionActive: () => gateOpen,
  overlaySettings: { speedBadge: true },
  showBadge: (video, channel, text) => badgeCalls.push({ channel, text, rate: video.playbackRate }),
  // #76: `setPlaybackRate` صارت تُزامن نصّ زرّ #72 من الموضع الواحد
  speedButtonActive: () => ctx.__btn === true,
  syncSpeedBtnLabel: (v) => btnSyncs.push(v.playbackRate)
};
vm.createContext(ctx);
vm.runInContext(`${SPEED_DEF}
  function runSpeed(action, v) {
    const e = {}; const findVideoLoose = () => v; const actionVideo = (e) => e.__videoUnderPointer || findVideoLoose(e);
    ${SPEED_RUN}
    return false;
  }`, ctx);
const runSpeed = vm.runInContext("runSpeed", ctx);

// ── [2] الأوراكل: التعبير القديم نصّاً، كما كان قبل هذا الكومِت ─────────────
// ⚠️ **لا يُحدَّث هذا الأوراكل ليَمرّ.** هو نسخة الماضي، وتعديله ليطابق الحاضر
// يُلغي الاختبار كلَّه: لن يبقى شيء يقول إن السلوك لم يتغيّر.
const oracle = (action, v) => {
  if (action.startsWith("ACTION:SPEED:SET:")) {
    const n = Number(action.split(":")[3]);
    if (isNaN(n)) return false;
    if (!v) return false;
    v.playbackRate = Math.max(0.25, Math.min(4, Math.round(n * 100) / 100));
    return true;
  }
  if (action.startsWith("ACTION:SPEED:")) {
    const n = Number(action.split(":")[2]);
    if (isNaN(n)) return false;
    if (!v) return false;
    const r = (v.playbackRate || 1) + n;
    v.playbackRate = Math.max(0.25, Math.min(4, Math.round(r * 100) / 100));
    return true;
  }
  return false;
};

// مصفوفة المدخلات — الحدود وما حولها، و`0` صراحةً لأنها الحالة التي تفرّق `||`
const SETS = [-5, -1, -0.001, 0, 0.005, 0.1, 0.24, 0.25, 0.251, 0.999, 1,
              1.005, 1.2345, 2, 3.999, 4, 4.001, 10, 1e9];
const RATES = [0, 0.25, 0.5, 1, 1.75, 2, 3.99, 4];
const DELTAS = [-9, -3, -0.25, -0.1, -0.05, 0, 0.05, 0.1, 0.25, 3];

function compare() {
  const rows = [];
  for (const n of SETS) rows.push({ action: `ACTION:SPEED:SET:${n}`, rate: 1 });
  for (const rate of RATES) for (const d of DELTAS) {
    rows.push({ action: `ACTION:SPEED:${d >= 0 ? "+" : ""}${d}`, rate });
  }
  const diffs = [];
  for (const row of rows) {
    const a = { playbackRate: row.rate }, b = { playbackRate: row.rate };
    const ra = runSpeed(row.action, a), rb = oracle(row.action, b);
    // `Object.is` لا `===`: تفرّق `-0` عن `0` و`NaN` عن نفسه — والصمت عنهما
    // هو بالضبط نوع الفرق الذي يمرّ من مقارنة متساهلة
    if (!Object.is(a.playbackRate, b.playbackRate) || ra !== rb) {
      diffs.push(`${row.action} @${row.rate}: جديد ${a.playbackRate}/${ra} · قديم ${b.playbackRate}/${rb}`);
    }
  }
  return { n: rows.length, diffs };
}

console.log("\n[2] صفر تغيّر سلوكي — الجديد مقابل التعبير القديم نصّاً");
{
  const { n, diffs } = compare();
  check(`[2] ${n} مدخلاً · صفر اختلاف`, diffs.length === 0, diffs.slice(0, 3).join(" | "));

  // ⚠️ **شاهد سالب (قرار 26): مقارنٌ لا يرى فرقاً حين يقع يطبع «متطابق» عن كل
  // شيء.** أوراكل مكسور عمداً **يجب** أن يُكشف — وإلا فالقسم كلّه عمىً لا نتيجة.
  const good = oracle("ACTION:SPEED:SET:10", { playbackRate: 1 });
  const broken = { playbackRate: 1 };
  broken.playbackRate = Math.max(0.5, Math.min(4, 10));   // حدٌّ أدنى مختلف عمداً
  const v = { playbackRate: 1 };
  runSpeed("ACTION:SPEED:SET:0.1", v);
  const b2 = { playbackRate: 1 };
  b2.playbackRate = Math.max(0.5, Math.min(4, Math.round(0.1 * 100) / 100));
  check("[2] شاهد سالب: أوراكل بحدٍّ مختلف يُكشف فرقاً",
    !Object.is(v.playbackRate, b2.playbackRate), `${v.playbackRate} مقابل ${b2.playbackRate}`);
  check("[2] وشاهد موجب: الأوراكل نفسه يساوي نفسه", good === true && broken.playbackRate === 4);
}

// ── [3] النحو والترتيب ──────────────────────────────────────────────────────
console.log("\n[3] النحو محفوظ — والترتيب حاملٌ لا تجميل");
{
  const iSet = SRC.indexOf('action.startsWith("ACTION:SPEED:SET:")');
  const iDelta = SRC.indexOf('action.startsWith("ACTION:SPEED:")');
  check("[3] كتلة المطلق تسبق كتلة الدلتا", iSet > -1 && iDelta > -1 && iSet < iDelta,
    `${iSet} / ${iDelta}`);

  // ولو انقلب الترتيب لالتقطت الدلتا المطلق وقرأت "SET" عدداً ⇒ NaN. مقيسٌ هنا:
  const v = { playbackRate: 1 };
  check("[3] والمطلق يُنفَّذ مطلقاً لا دلتا",
    runSpeed("ACTION:SPEED:SET:2", v) === true && v.playbackRate === 2, v.playbackRate);
  const w = { playbackRate: 2 };
  check("[3] والدلتا نسبية من القيمة الحالية",
    runSpeed("ACTION:SPEED:+0.5", w) === true && w.playbackRate === 2.5, w.playbackRate);
  const bad = { playbackRate: 1 };
  check("[3] ونصٌّ غير عدديّ يُرفض بلا كتابة",
    runSpeed("ACTION:SPEED:xyz", bad) === false && bad.playbackRate === 1, bad.playbackRate);
  const none = { playbackRate: 1 };
  check("[3] وفعلٌ آخر لا تلتقطه الكتلتان",
    runSpeed("ACTION:TOGGLE_PLAY", none) === false && none.playbackRate === 1);

  // «السرعة المفضّلة» في #72 هي هذا النحو نفسه لا مفهوماً ثانياً (قرار المالك)
  const pref = { playbackRate: 1 };
  check("[3] و«السرعة المفضّلة» تُعبَّر بـ`ACTION:SPEED:SET` القائمة",
    runSpeed("ACTION:SPEED:SET:1.75", pref) === true && pref.playbackRate === 1.75, pref.playbackRate);
}

// ── [4] المراسي التي تعتمد عليها ملفات أخرى ─────────────────────────────────
console.log("\n[4] المراسي — حذفُها يكسر اختباراً آخر لا الكود (قرار 33)");
{
  check("[4] `// Speed: SET absolute value` باقٍ (يقتطع عنده `test-host-adapter`)",
    SRC.includes("// Speed: SET absolute value"));
  check("[4] و`// Volume delta in percent` باقٍ (بدايةُ القطع نفسه)",
    SRC.includes("// Volume delta in percent"));
  check("[4] و`// ── البند #58` باقٍ (نهاية قطع هذا الملف)",
    SRC.includes("// ── البند #58"));
  const vol = slice("// Volume delta in percent", "// Speed: SET absolute value");
  check("[4] والقطع بينهما ما زال يحوي كتلة الصوت كاملة",
    !!vol && vol.includes("runHostAdapter") && vol.includes("showVolumeIndicator"));
}

// ── [6] #71 — الشارة تُنادى من الموضع الواحد وحده ───────────────────────────
// **وهذا ما يجعل زرّ #72 يرثها بلا سطر**: ما دام يُصدر أمراً من نحو `ACTION:`
// ولا يكتب `playbackRate` بيده، فالشارة تقع له كما تقع للعجلة.
console.log("\n[6] #71 — الشارة من الموضع الواحد، بعد القصّ، وخلف بوّابتين");
{
  const fire = (action, rate = 1) => {
    badgeCalls.length = 0;
    const v = { playbackRate: rate };
    runSpeed(action, v);
    return v;
  };

  fire("ACTION:SPEED:+0.25");
  check("[6] نداءٌ واحد لكل تغيير", badgeCalls.length === 1, badgeCalls);
  check("[6] وعلى قناة «speed» لا «volume»", badgeCalls[0]?.channel === "speed", badgeCalls[0]);
  check("[6] ونصّها «1.25x»", badgeCalls[0]?.text === "1.25x", badgeCalls[0]);

  // ⚠️ **تُقرأ من العنصر بعد الكتابة لا من المطلوب**: القصّ يقع قبل العرض،
  // فلا تَعِد الشارةُ بسرعةٍ لم تُطبَّق — وهي قاعدة الشارة نفسها في عقد الصوت.
  fire("ACTION:SPEED:+9");
  check("[6] وبعد القصّ «4x» لا «10x»", badgeCalls[0]?.text === "4x", badgeCalls[0]);
  fire("ACTION:SPEED:SET:0.1");
  check("[6] والمطلق كذلك: «0.25x» لا «0.1x»", badgeCalls[0]?.text === "0.25x", badgeCalls[0]);

  fire("ACTION:SPEED:SET:1.75");
  check("[6] والمطلق ينادي الشارة كالدلتا", badgeCalls.length === 1 && badgeCalls[0].text === "1.75x",
    badgeCalls);

  // البوّابتان: مفتاح الميزة، ثمّ بوّابة #64
  ctx.overlaySettings.speedBadge = false;
  const off = fire("ACTION:SPEED:+0.25");
  check("[6] ومفتاحها مطفأ ⇒ صفر نداء", badgeCalls.length === 0, badgeCalls);
  check("[6] **والسرعة تتغيّر رغم ذلك** — الشارة عرضٌ لا شرط", off.playbackRate === 1.25,
    off.playbackRate);
  ctx.overlaySettings.speedBadge = true;

  gateOpen = false;
  const blocked = fire("ACTION:SPEED:+0.25");
  check("[6] وبوّابة #64 مغلقة ⇒ صفر نداء", badgeCalls.length === 0, badgeCalls);
  check("[6] والسرعة تتغيّر كذلك", blocked.playbackRate === 1.25, blocked.playbackRate);
  gateOpen = true;

  const back = fire("ACTION:SPEED:+0.25");
  check("[6] وتعود بفتح البوّابتين", badgeCalls.length === 1 && back.playbackRate === 1.25, badgeCalls);

  // ── #76: ونصّ زرّ #72 يُزامَن من الموضع الواحد لا من مسار الزرّ وحده ──────
  ctx.__btn = true;
  btnSyncs.length = 0;
  fire("ACTION:SPEED:+0.25");
  check("[6] وزرّ #72 يُزامَن من `setPlaybackRate` نفسها", btnSyncs.length === 1, btnSyncs);
  check("[6] وبالقيمة بعد القصّ لا بالمطلوبة", btnSyncs[0] === 1.25, btnSyncs);
  btnSyncs.length = 0;
  fire("ACTION:SPEED:+9");
  check("[6] وعند الحدّ يُزامَن بـ4 لا بـ10", btnSyncs[0] === 4, btnSyncs);
  ctx.__btn = false;
  btnSyncs.length = 0;
  fire("ACTION:SPEED:+0.25");
  check("[6] ومفتاح الزرّ مطفأ ⇒ صفر مزامنة (لا لمس DOM بلا سبب)",
    btnSyncs.length === 0, btnSyncs);
}

// ── [5] الأرقام مطبوعة من التشغيل لا مكتوبة بيد (قرار 34) ───────────────────
console.log("\n[5] عيّنة مطبوعة من التشغيل — للقراءة لا للتأكيد");
for (const a of ["ACTION:SPEED:SET:10", "ACTION:SPEED:SET:0.1", "ACTION:SPEED:SET:1.005",
                 "ACTION:SPEED:-9", "ACTION:SPEED:+0.05"]) {
  const v = { playbackRate: 1 };
  runSpeed(a, v);
  console.log(`     ${a.padEnd(24)} من 1 ⇒ ${v.playbackRate}`);
}
{
  const v = { playbackRate: 0 };
  runSpeed("ACTION:SPEED:+0.25", v);
  console.log(`     ${"ACTION:SPEED:+0.25".padEnd(24)} من 0 ⇒ ${v.playbackRate}  (\`|| 1\`: يُقرأ 1)`);
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
