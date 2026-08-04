// يحرس فصل علامة القناة عن التعليقات في Clean Player (البند #67).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يُخفي مفتاحُ العلامة المائية العلامةَ وحدها دون التعليقات؟»*
//
// ── العلّة (مقيسة على المشغّل الحيّ 2026-08-02) ──────────────────────────────
// علامة القناة عنصرٌ **واحد يحمل الصنفين معاً**:
//   <div class="annotation annotation-type-custom iv-branding"> … branding-img …
// فكان مفتاح `annotations` (بـ`.annotation`) **يُخفيها**، ومفتاح `watermark`
// (بـ`.ytp-watermark`) **لا يُخفي شيئاً**: مربّعٌ يَعِد ولا يفعل، وآخر يفعل ما لا
// يُسمّى به. والعلاج **استبعاد بنيويّ لا دمج**: `.annotation:not(.iv-branding)`.
//
// ── لماذا هذا الاختبار سلوكيّ لا نصّيّ ──────────────────────────────────────
// لا يكفي أن نعدّ الحروف في المحدِّد: المطلوب **أن يقع الفصل على قائمة الأصناف
// المقيسة فعلاً**. فيُبنى مطابِقٌ صغير يفهم **ثلاث صيغ فقط** (`.a` · `.a.b` ·
// `.a:not(.b)`) **ويرفض ما عداها بصوت عالٍ** بدل أن يحكم على شكل لا يفهمه —
// النمط نفسه في `tools/run-tests.js`: من يعدّ ما يفهمه ويسكت عمّا لا يفهمه
// يطبع نتيجة أصغر من الحقيقة **ويبدو أخضر**.
//
// ── شاهدا القبول (قرار 26) ──────────────────────────────────────────────────
//  · **موجب:** السجلّ **قبل** الإصلاح (`.annotation` مجرّدة) **يجب أن يُحمَّر** —
//    فإن مرّ فالحارس لا يرى العطب الذي وُلد منه.
//  · **سالب:** صيغة لا يفهمها المطابِق تُرجع `null` **ولا تُقرأ تطابقاً ولا نفياً**.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  ❌ ${msg}`); } };

// ── قائمة الأصناف كما قِيست على المشغّل الحيّ — لا كما نتخيّلها ──────────────
const WATERMARK_CLASSES = ["annotation", "annotation-type-custom", "iv-branding"];
// وتعليقٌ حقيقيّ لو ظهر: يحمل صنف التعليق بلا صنف العلامة
const PLAIN_ANNOTATION_CLASSES = ["annotation", "annotation-type-custom"];

// ── مطابِقٌ ضيّق: يفهم ثلاث صيغ ويرفض ما عداها ─────────────────────────────
// يُرجع true/false للصيغ المفهومة، و**null لما لا يفهمه** — والقارئ يفشل عندها.
function matchesClassList(sel, classes) {
  const m = /^((?:\.[A-Za-z0-9_-]+)+)(?::not\(\.([A-Za-z0-9_-]+)\))?$/.exec(String(sel).trim());
  if (!m) return null;
  const need = m[1].split(".").filter(Boolean);
  const not = m[2];
  if (!need.every((c) => classes.includes(c))) return false;
  if (not && classes.includes(not)) return false;
  return true;
}
// هل يطابق أيُّ محدِّد في المفتاح قائمةَ الأصناف؟ null إن عجز المطابِق عن أحدها
function keyMatches(sels, classes) {
  let any = false;
  for (const s of sels) {
    const r = matchesClassList(s, classes);
    if (r === null) continue;            // صيغة أخرى (مثل .ytp-watermark) — مفهومة أصلاً
    if (r) any = true;
  }
  return any;
}

console.log("\n[0] المطابِق نفسه — قبل أن يُحكَم به");
ok(matchesClassList(".annotation", WATERMARK_CLASSES) === true, "المطابِق لم يرَ .annotation في قائمة تحتويه");
ok(matchesClassList(".annotation:not(.iv-branding)", WATERMARK_CLASSES) === false,
   "المطابِق لم يستبعد بـ:not — وهو جوهر الإصلاح");
ok(matchesClassList(".annotation:not(.iv-branding)", PLAIN_ANNOTATION_CLASSES) === true,
   "المطابِق استبعد تعليقاً لا يحمل صنف العلامة");
ok(matchesClassList(".iv-branding", WATERMARK_CLASSES) === true, "المطابِق لم يرَ .iv-branding");
ok(matchesClassList(".ytp-watermark", WATERMARK_CLASSES) === false, "المطابِق طابق صنفاً غير موجود");
// **الشاهد السالب:** صيغة لا يفهمها ⇒ null، فلا تُقرأ تطابقاً ولا نفياً
ok(matchesClassList(".a > .b", WATERMARK_CLASSES) === null, "صيغة غير مفهومة قُرئت حكماً بدل أن تُرفض");
ok(matchesClassList("button.ytp-button[data-x='y']", WATERMARK_CLASSES) === null,
   "صيغة مركّبة قُرئت حكماً بدل أن تُرفض");

console.log("\n[1] السجلّ الحقيقي — الفصل واقع");
const src = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
const m = src.match(/const CLEAN_PLAYER_ITEMS = (\{[\s\S]*?\n\});/);
ok(!!m, "تعذّر إيجاد CLEAN_PLAYER_ITEMS — **المرساة سقطت، أصلِح المرساة لا التأكيد** (قرار 33)");
if (!m) { console.log(`\n❌ نجح ${pass} / فشل ${fail}\n`); process.exit(1); }
const ITEMS = vm.runInNewContext("(" + m[1] + ")");

ok(Array.isArray(ITEMS.watermark), "لا مفتاح watermark");
ok(Array.isArray(ITEMS.annotations), "لا مفتاح annotations");

// (أ) العلامة تُخفى بمفتاحها وحده
ok(keyMatches(ITEMS.watermark, WATERMARK_CLASSES) === true,
   "مفتاح watermark **لا يطابق علامة القناة** — المربّع يَعِد ولا يفعل، وهو #67 نفسه");
ok(keyMatches(ITEMS.annotations, WATERMARK_CLASSES) === false,
   "مفتاح annotations **ما زال يُخفي العلامة** — يفعل ما لا يُسمّى به");

// (ب) وتعليقٌ حقيقيّ يبقى تحت مفتاح التعليقات وحده
ok(keyMatches(ITEMS.annotations, PLAIN_ANNOTATION_CLASSES) === true,
   "مفتاح annotations لم يعد يُخفي تعليقاً حقيقياً — **الاستبعاد أوسع ممّا يجب**");
ok(keyMatches(ITEMS.watermark, PLAIN_ANNOTATION_CLASSES) === false,
   "مفتاح watermark يُخفي تعليقاً ليس علامة");

// (ج) وما اتُّفق على بقائه يبقى
ok(ITEMS.watermark.includes(".ytp-watermark"),
   "`.ytp-watermark` حُذف — وهو **حالٌ لم تُنتَج لا محدِّدٌ ميّت** (قاعدة يوتيوب تحصره في مشغّل المعاينة الصامتة)");
ok(ITEMS.annotations.includes(".video-annotations"),
   "حاوية التعليقات حُذفت من مفتاحها");
ok(!ITEMS.annotations.includes(".annotation"),
   "`.annotation` المجرّدة عادت إلى annotations — فيعود إخفاء العلامة معها");

console.log("\n[2] الشاهد الموجب — السجلّ قبل الإصلاح يجب أن يُحمَّر");
const BEFORE = { annotations: [".video-annotations", ".annotation", ".iv-branding"],
                 watermark: [".ytp-watermark"] };
ok(keyMatches(BEFORE.annotations, WATERMARK_CLASSES) === true,
   "الحارس لم يرَ أن السجلّ القديم يُخفي العلامة بمفتاح التعليقات — **لا يُصدَّق خضاره**");
ok(keyMatches(BEFORE.watermark, WATERMARK_CLASSES) === false,
   "الحارس لم يرَ أن مفتاح العلامة القديم لا يطابق شيئاً — **لا يُصدَّق خضاره**");

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
