// البند #34 — التقديم مرجعه `seekable` لا `duration`.
//
// **العَرَض المُصحَّح بالقياس:** الحارس القديم كان يرفض كل عنصر `duration`ه غير
// منتهية، وقِيس أن ذلك **يطابق تويتش لا كل بثّ**: يوتيوب المباشر يعلن مدّة
// منتهية ونافذة 14 ساعة **والتقديم يقع فيه اليوم فعلاً**.
//
// **الحالات الأربع أدناه كلّها بأرقامها المقيسة ميدانياً**، لا بأرقام مخترعة:
//   · خادم بنطاقات      — `tools/bench-seek-edge.mjs --local`
//   · خادم بلا نطاقات    — الأداة نفسها
//   · نافذة منتهية       — `tools/bench-live-seek.mjs` على يوتيوب مباشر
//   · نهاية حدّية        — الأداة نفسها على `twitch.tv/ow_esports`
//
// ⚠️ **واثنتان منها تُثبتان صفر تغيّر**: تُشغَّل عليهما **النسخة القديمة المجمَّدة**
// أدناه ويُشترط أن يطابقها الجديد **بالضبط**. فشل ذلك يعني أن الإصلاح مسّ
// الفيديو العادي — وهو **بالضبط** ما بُني هذا الملف ليمنعه، فـ`seek()` **دالّة
// واحدة لكل تقديم في المشروع**.
//
// ⚠️ وفشل قسم «النطاق الفارغ» يعني أن الشرط الثاني (`end - start > 0`) أُزيل
// اكتفاءً بـ`length === 0`. **لا تُصلحه بإعادة الشرط الأول وحده:** خادم بلا دعم
// نطاقات يعطي `[[0, 0]]` **وطوله 1 لا 0**، فالشرط الأول لا يُطلق عليه أصلاً.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  return a === -1 || b === -1 ? null : t.slice(a, b);
}

const SEEK = slice("content.js", "function seek(video, deltaSec) {", "// ── البند #60 · قرار المالك 25");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// الدالّة تُقتطع من `content.js` نفسه وتُشغَّل كما هي: اختبار على الكود لا على نسخة منه.
const seek = SEEK && vm.runInNewContext(`(function () { ${SEEK}; return seek; })()`, { console });

// ⚠️ **النسخة القديمة مجمَّدة عمداً** — نصّها قبل الإصلاح حرفياً. لا تُحدَّث مع
// الكود: قيمتها كلّها في أنها **مرجع «ما كان»** يُقاس عليه «صفر تغيّر».
function seekOld(video, deltaSec) {
  if (!video) return;
  if (isNaN(video.duration) || !isFinite(video.duration)) return;
  video.currentTime = Math.max(0, Math.min(video.currentTime + deltaSec, video.duration));
}

// `TimeRanges` مزيَّف بواجهته الحقيقية: `length` و`start(i)` و`end(i)`.
const ranges = (arr) => ({
  length: arr.length,
  start: (i) => arr[i][0],
  end: (i) => arr[i][1]
});

const makeVideo = (cfg) => ({
  currentTime: cfg.at,
  duration: cfg.duration,
  seekable: ranges(cfg.seekable)
});

// الحالات الأربع، وكلٌّ بأرقامها المقيسة ومصدرها
const CASES = [
  {
    id: "١",
    name: "خادم **يدعم** النطاقات — فيديو عادي",
    src: "bench-seek-edge --local · /ranges.wav",
    seekable: [[0, 90]], duration: 90, at: 19.36,
    zeroChange: true   // ⇐ يُشترط تطابق الجديد مع القديم بالضبط
  },
  {
    id: "٢",
    name: "خادم **لا يدعم** النطاقات — نطاق فارغ",
    src: "bench-seek-edge --local · /noranges.wav · seekable=[[0,0]]",
    seekable: [[0, 0]], duration: 90, at: 19.52,
    zeroChange: false, expectReject: true
  },
  {
    id: "٣",
    name: "نافذة منتهية — يوتيوب مباشر 24/7",
    src: "bench-live-seek · youtube.com/watch?v=mKCieTImjvU",
    seekable: [[0, 50380]], duration: 50380.005, at: 46800,
    zeroChange: true
  },
  {
    id: "٤",
    name: "نهاية حدّية (2^30) — تويتش مباشر",
    src: "bench-seek-edge · twitch.tv/ow_esports · duration=Infinity",
    seekable: [[0, 1073741824]], duration: Infinity, at: 6.56,
    zeroChange: false, forwardRejected: true, backwardAllowed: true
  }
];

const run = (fn, cfg, delta) => {
  const v = makeVideo(cfg);
  fn(v, delta);
  return v.currentTime;
};

console.log("\n=== #34 — نافذة `seekable` هي المرجع ===\n");

for (const c of CASES) {
  console.log(`[${c.id}] ${c.name}`);
  console.log(`     المصدر: ${c.src}`);
  const fwdNew = run(seek, c, +30), fwdOld = run(seekOld, c, +30);
  const bakNew = run(seek, c, -30), bakOld = run(seekOld, c, -30);
  console.log(`     تقديم: قديم ${fwdOld} · جديد ${fwdNew}   |   إرجاع: قديم ${bakOld} · جديد ${bakNew}`);

  if (c.zeroChange) {
    // **شرط القبول الأول: صفر تغيّر مقيس على ما يعمل اليوم**
    check(`[${c.id}] التقديم مطابق للنسخة القديمة بالضبط`, fwdNew === fwdOld, `${fwdOld} ≠ ${fwdNew}`);
    check(`[${c.id}] الإرجاع مطابق للنسخة القديمة بالضبط`, bakNew === bakOld, `${bakOld} ≠ ${bakNew}`);
  }
  if (c.expectReject) {
    check(`[${c.id}] التقديم مرفوض — لا يتحرّك الموضع`, fwdNew === c.at, fwdNew);
    check(`[${c.id}] الإرجاع مرفوض — لا يتحرّك الموضع`, bakNew === c.at, bakNew);
    // **والتغيّر مقصود ومقيس، لا انحدار**: القديم كان يحسب هدفاً يقصّه المتصفّح إلى 0
    check(`[${c.id}] القديم كان يحسب هدفاً غير الموضع (والمتصفّح يقصّه إلى 0)`,
      fwdOld !== c.at, fwdOld);
    // النطاق الفارغ يسقط بالشرط الثاني لا الأول — طوله 1
    check(`[${c.id}] النطاق الفارغ طوله 1 لا 0 ⇒ الشرط الأول وحده لا يكفي`,
      makeVideo(c).seekable.length === 1);
  }
  if (c.forwardRejected) {
    check(`[${c.id}] التقديم مرفوض (نهاية حدّية و duration غير منتهية)`, fwdNew === c.at, fwdNew);
    check(`[${c.id}] وهو ما يجعل التجمّد المقيس مستحيلاً بالبناء`, fwdNew === c.at);
  }
  if (c.backwardAllowed) {
    check(`[${c.id}] الإرجاع مسموح ويقع فعلاً`, bakNew < c.at, bakNew);
    check(`[${c.id}] ويُقصّ إلى بداية النافذة لا إلى ما دونها`, bakNew >= c.seekable[0][0], bakNew);
    // القديم كان يرفض هذا كلياً — وهذه هي الفجوة التي فُتح البند لأجلها
    check(`[${c.id}] والقديم كان يرفضه كلياً (لا يتحرّك)`, bakOld === c.at, bakOld);
  }
  console.log("");
}

// ---------------------------------------------------- حالات النافذة الحدّية
console.log("[٥] حرّاس النافذة");
{
  const noRanges = { seekable: [], duration: 90, at: 10 };
  check("[٥] `seekable.length === 0` ⇒ رفض", run(seek, noRanges, +30) === 10);

  // نافذة سالبة/معكوسة لا تُقبل
  const inverted = { seekable: [[50, 50]], duration: 90, at: 60 };
  check("[٥] نافذة طولها صفر ⇒ رفض", run(seek, inverted, -30) === 60);

  // الإرجاع يُقصّ إلى `start(0)` لا إلى الصفر — نافذة لا تبدأ من الصفر
  const dvr = { seekable: [[100, 400]], duration: Infinity, at: 150 };
  check("[٥] الإرجاع يُقصّ إلى `start(0)` لا إلى 0", run(seek, dvr, -300) === 100,
    run(seek, dvr, -300));

  // عدّة نطاقات: النهاية من الأخير والبداية من الأول
  const multi = { seekable: [[0, 10], [20, 40]], duration: 40, at: 5 };
  check("[٥] النهاية تُقرأ من النطاق الأخير", run(seek, multi, +100) === 40, run(seek, multi, +100));

  check("[٥] بلا فيديو ⇒ لا استثناء", (() => { try { seek(null, 5); return true; } catch { return false; } })());
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
