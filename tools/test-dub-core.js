// البند #168 — الدبلجة العربية: المُقسِّم والقرار والمنحنى والمُجدوِل، والتقاطُ M2+R في عالم الصفحة.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أضغط «دبلِج» — أيقرأ الصوتُ العربيّ الجملةَ الصحيحة في وقتها
// وبسرعةٍ أفهمها، ويسكت حيث يجب، ويأخذ نصَّ الفيديو بطلبٍ واحد ثمّ يُعيد لغةَ ترجمتي كما كانت؟»*
//
// **ما يحرسه بالسلوك لا بالنصّ:** (١) المُقسِّمُ يُعطي على حالات مِجَسّ 5 المعلومة ما أعطاه المِجَسّ حرفاً —
// **فالنقلُ لم يغيّر المعنى** · (٢) قرارُ المسار بترتيب §٣ وفجواته (أ)–(هـ) كما اعتمدها المالك ·
// (٣) المنحنى المقيس يُقلب ولا يُقسم، والسقفُ كروم 2 · (٤) قاعدتا التخطّي (خ13) · (٥) الجسرُ يقبل ردَّ طلبه
// وحدَه · (٦) **`yt_dub_main.js` على مشغّلٍ مزيّف:** طلبٌ واحدٌ منّا، والقاطعُ عند أوّل رفض، **واللغةُ اللاصقة
// تُعاد بحروفها** (خ20) · (٧) حرّاسٌ بنيويّة: كسولٌ بالبناء · `cancel()` في موضعٍ واحد · لا `pause()` ·
// لا كتابةَ في صوت الفيديو أو سرعته · وترتيبُ النبضة.
// ⚠️ **حدٌّ مُعلَن:** لا يرى محرّكَ النطق ولا مترجمَ كروم ولا يوتيوبَ الحقيقيّ — ذاك تجربةُ المالك على جهازه.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const MAIN = fs.readFileSync("yt_dub_main.js", "utf8");
const POPUP = fs.readFileSync("popup.js", "utf8");
const HTML = fs.readFileSync("popup.html", "utf8");
const MANIFEST = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ── استخراجٌ بمطابقة الأقواس — لا نسخ ولا إعادة كتابة ───────────────────────
function fn(name) {
  const start = SRC.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`لم تُوجد الدالّة ${name} في content.js`);
  let depth = 0;
  const i = SRC.indexOf("{", start);
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === "{") depth++;
    else if (SRC[j] === "}") { depth--; if (depth === 0) return SRC.slice(start, j + 1); }
  }
  throw new Error(`تعذّر إغلاق ${name}`);
}
function constOf(name) {
  const m = SRC.match(new RegExp(`const\\s+${name}\\s*=([\\s\\S]*?);(?=[ \\t]*(//[^\\n]*)?\\n)`));
  if (!m) throw new Error(`لم يُوجد الثابت ${name}`);
  return m[1].trim();
}

// ⛔ ~~`DUB_REMAIN_MIN` · `DUB_AZ_BURST` · `dubBucketTake`~~ — سُحبت في الجولة الثالثة (قاعدةُ الـ30٪ · ودلوُ كلّ تشغيلة — مراجعة 168ح #2)
const CONSTS = ["DUB_LEAD_S", "DUB_LATE_MAX_S", "DUB_BEHIND_MAX_S", "DUB_SEG_GAP_A", "DUB_SEG_CAP_A", "DUB_SEG_GAP_M",
  "DUB_SEG_CAP_M", "DUB_SEG_END_PAD", "DUB_CURVE_MAC", "DUB_R_MAX", "DUB_RATE_CAP", "DUB_AUTO_MAX", "DUB_CPS", "DUB_BRIDGE_MAX",
  "DUB_AZ_PER_MIN", "DUB_UNIT_MIN_MS", "DUB_UNIT_MAX_MS", "DUB_SENT_MAX_MS", "DUB_CATCH_LAG0_S", "DUB_CATCH_LAG1_S", "DUB_CATCH_MAX",
  "DUB_GLUE_S", "DUB_UNIT_GAP_MS", "DUB_TX_KEEP"];
const FNS = ["dubPrim", "dubXtDecode", "dubAudioNorm", "dubCapNorm", "dubDecide", "dubSegment", "dubRealSpeed",
  "dubChromeRate", "dubFirstAt", "dubResyncAt", "dubCapFor", "dubNext", "dubPickVoice", "dubMainCall", "dubYtSource", "dubYtUnits", "dubDisplayNext", "dubCaptionLines",
  "dubXmlEsc", "dubSsml", "dubAzLimit", "dubAzBill", "dubAzFit", "dubMergeUnits", "dubAzOpts", "dubTxKeep", "dubResumeAt"];

function makeWindow() {
  const L = {};
  return {
    addEventListener(t, f) { (L[t] = L[t] || []).push(f); },
    removeEventListener(t, f) { L[t] = (L[t] || []).filter((x) => x !== f); },
    dispatchEvent(e) { (L[e.type] || []).slice().forEach((f) => f(e)); return true; },
    count(t) { return (L[t] || []).length; }
  };
}
class FakeCustomEvent { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } }

const ctx = { atob, Math, JSON, Date, Number, String, Array, Object, setTimeout, clearTimeout, window: makeWindow(), CustomEvent: FakeCustomEvent };
vm.createContext(ctx);
vm.runInContext(CONSTS.map((n) => `var ${n} = ${constOf(n)};`).join("\n") + "\n" + FNS.map(fn).join("\n"), ctx);

(async () => {
  // ---------------------------------------------------------------- [١] المُقسِّم
  console.log("\n[١] المُقسِّم يُعطي على حالات مِجَسّ 5 ما أعطاه حرفاً");
  {
    const seg = ctx.dubSegment;
    const sig = (r) => r.kind + ":" + r.sents.map((s) => s.win + "|" + s.text).join("/") + ":" + r.drop;
    const ev = (t, d, a, app) => ({ tStartMs: t, dDurationMs: d, aAppend: app, segs: a.map((x) => (Array.isArray(x) ? { utf8: x[0], tOffsetMs: x[1] } : { utf8: x })) });
    const tA = sig(seg([{ tStartMs: 0, dDurationMs: 9000, id: 1, wpWinPosId: 1 }, ev(1000, 3000, ["hello", [" world", 300], [" again", 600]]), ev(2500, 100, ["\n"], 1), ev(3000, 2000, ["next", [" one.", 200], [" [Music]", 400], [" last", 500]])]));
    const tM = sig(seg([{ tStartMs: 0, dDurationMs: 6000, id: 1 }, ev(0, 1000, ["Hello there,"]), ev(1100, 900, ["my friend."]), ev(2100, 800, ["[Music]"]), ev(5000, 1000, ["Next\none"])]));
    const W24 = "six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty a b c d e f g h i";
    const rP = seg([ev(0, 2000, ["One two. Three four five?"]), ev(2100, 1000, [W24]), ev(3150, 200, ["word"]), ev(3400, 500, ["Last one."])]);
    const tO = sig(seg([ev(0, 6000, ["We went to the store. Then we bought"]), ev(3000, 6000, ["some apples and pears."]), ev(6000, 6000, ["It was late."])]));
    check("[١] التلقائيّة بتوقيت الكلمات (tA)", tA === "asr:2000|hello world again/500|next one./2000|last:1", tA);
    check("[١] اليدويّة تُدمج حتى الترقيم أو الفجوة (tM)", tM === "manual:5000|Hello there, my friend./1500|Next one:1", tM);
    check("[١] الحدثُ يُشقّ عند ترقيمه، والسقفُ عند 25 بالضبط (tP)",
      sig(rP) + ":" + JSON.stringify(rP.why) === "manual:720|One two./1380|Three four five?/1300|" + W24 + " word/1000|Last one.:0:" + JSON.stringify({ gap: 0, punct: 2, cap: 1, end: 1 }), sig(rP));
    check("[١] أحداثٌ متداخلة: لا تسبق قطعةٌ ما قبلها (tO)", tO === "manual:1833|We went to the store./4167|Then we bought some apples and pears./6500|It was late.:0", tO);
    // الشكلُ المضغوط من عالم الصفحة يُعطي ما يُعطيه json3 نفسُه
    const compact = [[1000, 3000, 0, [["hello", null], [" world", 300], [" again", 600]]], [2500, 100, 1, [["\n", null]]], [3000, 2000, 0, [["next", null], [" one.", 200], [" [Music]", 400], [" last", 500]]]];
    check("[١] والشكلُ المضغوط من عالم الصفحة مثلُه", sig(seg(compact)) === tA, sig(seg(compact)));
    const ar = seg([ev(0, 1500, ["كيف حالكم؟"]), ev(1600, 1500, ["أنا بخير"]), ev(3200, 1500, ["والحمد لله."])]);
    check("[١] و«؟» العربيّة تقطع الجملة", sig(ar) === "manual:1600|كيف حالكم؟/3600|أنا بخير والحمد لله.:0", sig(ar));
    // ⭐ الجولة الثالثة — ملفُّ ترجمة يوتيوب العربيّة بشكله المقيس (📐 2026-11-01): سطورٌ متداخلة، وبعد كلٍّ حدثُ «\n» (aAppend)، و**نهايةُ
    // الجملة وسطَ السطر** بلا حرفٍ كبيرٍ بعدها ⇒ يُشقّ السطرُ عند علامته، و«\n» لا يقصّر زمنَ سطره
    const arT = seg([ev(0, 4000, ["مرحباً بكم جميعاً. اليوم"]), ev(1990, 4000, ["\n"], 1), ev(2000, 4000, ["نتحدّث عن الذاكرة."]), ev(3990, 4000, ["\n"], 1),
      ev(4000, 4000, ["هل أنتم مستعدّون؟ هيا"]), ev(5990, 4000, ["\n"], 1), ev(6000, 3000, ["نبدأ."])]);
    // الموضعُ بنسبة الحروف داخل زمن السطر حتى السطر التالي (0–2000): «اليوم» بعد 19 من 24 حرفاً ⇐ 1583 · «هيا» بعد 18 من 21 ⇐ 5714
    const arS = arT.sents.map((x) => x.start + "|" + x.text).join(" / ");
    check("[١] ⭐ العربيّةُ تُشقّ وسطَ السطر عند «.» و«؟» — والجملةُ تبدأ من موضعها في سطرها، و«\\n» لا يقصّر سطره",
      arS === "0|مرحباً بكم جميعاً. / 1583|اليوم نتحدّث عن الذاكرة. / 4000|هل أنتم مستعدّون؟ / 5714|هيا نبدأ.", arS);
  }

  // ---------------------------------------------------------------- [٢] القرار
  console.log("\n[٢] اختيارُ المسار بترتيب §٣ وفجواته (أ)–(هـ)");
  {
    const D = (live, audio, caps) => ctx.dubDecide({ live, audio: audio.map(ctx.dubAudioNorm), caps: caps.map(ctx.dubCapNorm) });
    const ASR = (code, extra) => Object.assign({ code, kind: "asr", ql: code, qk: "asr" }, extra || {});
    const MAN = (code, extra) => Object.assign({ code, kind: "", ql: code, qk: "" }, extra || {});
    const XT_AR = "251;Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICYXI", XT_DE = "251;ChEKBWFjb250EghvcmlnaW5hbAoICgNkcmMSATEKDQoEbGFuZxIFZGUtREU";
    const W = [[XT_AR, "acont=dubbed:lang=ar"], [XT_DE, "acont=original:drc=1:lang=de-DE"], ["acont=original:lang=en", "acont=original:lang=en"], ["251;!!xx", ""], ["und", ""]];
    check("[٢] مفكّكُ xtags يُعطي المعلوم (معرّفا أسطر المالك)", W.every((w) => ctx.dubXtDecode(w[0]) === w[1]), W.map((w) => ctx.dubXtDecode(w[0])));
    check("[٢] (أ) البثُّ أوّلاً — ولو بتلقائيّةٍ إنجليزيّة", D(true, [], [ASR("en")]).k === "live");
    check("[٢] (١) الصوتُ الجاري دبلجةٌ عربيّة (من المعرّف) ⇐ لا شيء", D(false, [{ id: XT_AR, cur: true }], [ASR("en")]).k === "arNow");
    check("[٢] (١) ومسارٌ عربيٌّ غيرُ مختار ⇐ يُقترح (خ10)", D(false, [{ id: XT_AR }, { id: "x;", li: "en", cur: true }], [ASR("en")]).k === "arOffer");
    check("[٢] (ج) لغةُ الكلام عربيّة ⇐ لا شيء **قبل** اليدويّة العربيّة", D(false, [], [MAN("ar"), ASR("ar")]).k === "arVid");
    const sp = D(false, [], [MAN("ar"), ASR("en")]);
    check("[٢] (٢) يدويّةٌ عربيّة ⇐ تُنطق كما هي", sp.k === "speak" && sp.src.code === "ar", sp);
    const mn = D(false, [], [MAN("en"), ASR("en")]);
    check("[٢] (٤) يدويّةٌ بلغة الكلام ⇐ تُترجَم", mn.k === "manual" && !mn.src.asr, mn);
    check("[٢] (٥) وإلا التلقائيّة", D(false, [], [ASR("en")]).k === "asr");
    check("[٢] (د) لا تلقائيّة ⇐ لغةُ الكلام مجهولة ⇐ «لا قاعدة» — ولا يُؤخذ المسارُ الأصليّ دليلاً",
      D(false, [{ id: XT_DE, def: true }], [MAN("en")]).k === "other");
    check("[٢] (د) ومسارٌ أصليٌّ de-DE مع تلقائيّةٍ إنجليزيّة ⇐ إنجليزيّ (س19)", D(false, [{ id: XT_DE, def: true, cur: true }], [ASR("en")]).k === "asr");
    check("[٢] خ12 لغةُ كلامٍ غيرُ الإنجليزيّة ⇐ لا", D(false, [], [ASR("de")]).k === "lang");
    check("[٢] لا ترجمةَ نصّيّة ⇐ none", D(false, [], []).k === "none");
    const gm = D(false, [], [ASR("en", { variant: "gemini" })]);
    check("[٢] (هـ) gemini تلقائيّةُ الأصل ⇐ تُؤخذ", gm.k === "asr" && gm.src.variant === "gemini", gm);
    const both = D(false, [], [ASR("en", { variant: "gemini" }), ASR("en")]);
    check("[٢] (هـ) والعاديّةُ قبلها إن وُجدتا", both.src.variant === "", both.src);
    check("[٢] (هـ) timing-optimized نصُّ دبلجةٍ آليّة ⇐ يُترك", D(false, [], [ASR("en", { variant: "timing-optimized" })]).k === "none");
    check("[٢] tlang يُترك: «ar» مترجَمةً ليست يدويّةً عربيّة", D(false, [], [ASR("en"), MAN("ar", { tlang: "ar" })]).k === "asr");
    check("[٢] فخّ «Bulgarian» (درس #161): bg ليست ar", D(false, [{ li: "bg", cur: true }], [MAN("bg"), ASR("en")]).k === "asr");
    // مراجعة #17 — وسمُ «ar» على المسار الأصليّ تغلبه التلقائيّةُ الإنجليزيّة (الفجوة د)، والدبلجةُ عربيّةٌ أبداً
    check("[٢] أصليٌّ موسومٌ «ar» وتلقائيّتُه إنجليزيّة ⇐ تُدبلج (مراجعة #17)", D(false, [{ acont: "original", li: "ar", cur: true }], [ASR("en")]).k === "asr");
    check("[٢] أصليٌّ «ar» وتلقائيّتُه عربيّة ⇐ لا شيء", D(false, [{ acont: "original", li: "ar", cur: true }], [ASR("ar")]).k === "arNow");
    check("[٢] أصليٌّ «ar» بلا تلقائيّة ⇐ لا شيء (لا دليلَ يخالفه)", D(false, [{ acont: "original", li: "ar", cur: true }], [MAN("en")]).k === "arNow");
    check("[٢] ودبلجةٌ عربيّةٌ جارية ⇐ لا شيء ولو تلقائيّتُها إنجليزيّة", D(false, [{ id: XT_AR, cur: true }], [ASR("en")]).k === "arNow");
    // «ترجمة يوتيوب»: ما يقرّره §٣ — إلا أنّ لغةَ كلامٍ غيرَ الإنجليزيّة تُترجَم بيوتيوب نفسِه
    const Y = (audio, caps) => { const cn = caps.map(ctx.dubCapNorm); const d = ctx.dubDecide({ live: false, audio: audio.map(ctx.dubAudioNorm), caps: cn }); return ctx.dubYtSource(d, cn); };
    check("[٢] يوتيوب: كلامٌ ألمانيّ ⇐ تلقائيّتُه الألمانيّة مترجمةً", (Y([], [ASR("de")]) || {}).code === "de");
    check("[٢] يوتيوب: ويدويّةُ لغة الكلام قبل تلقائيّتها", (Y([], [ASR("de"), MAN("de")]) || {}).asr === false);
    check("[٢] يوتيوب: يدويّةٌ عربيّة ⇐ تُعرض هي", (Y([], [MAN("ar"), ASR("en")]) || {}).code === "ar");
    check("[٢] يوتيوب: وما يرفضه §٣ يُرفض (دبلجةٌ عربيّةٌ جارية · لا ترجمة · لا قاعدة)",
      Y([{ id: XT_AR, cur: true }], [ASR("en")]) === null && Y([], []) === null && Y([], [MAN("en")]) === null);
  }

  // ---------------------------------------------------------------- [٣] المنحنى
  console.log("\n[٣] السرعةُ بقلب المنحنى المقيس لا بالقسمة");
  {
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    check("[٣] 1 ⇐ 1", near(ctx.dubChromeRate(1), 1));
    check("[٣] 1.905 فعليّةً ⇐ كروم 2 (📐)", near(ctx.dubChromeRate(1.905), 2), ctx.dubChromeRate(1.905));
    const rt = [1, 1.2, 1.5, 1.7, 1.9, 2.3, 3, 3.9].every((r) => Math.abs(ctx.dubRealSpeed(ctx.dubChromeRate(r)) - r) < 1e-9);
    check("[٣] ذهاباً وإياباً على المنحنى بلا فرق", rt);
    check("[٣] تحت 1 ⇐ 1 (لا إبطاء)", ctx.dubChromeRate(0.7) === 1);
  }

  // ---------------------------------------------------------------- [٤] المُجدوِل
  console.log("\n[٤] قرارُ النبضة: الموعد · التخطّي (الجولة الثالثة: لا يُحذف إلا ما تأخّر فوق ست ثوانٍ) · الترجمةُ المنتظرة · سقفُ التلقائيّة");
  {
    const S = (start, win, ar) => ({ start, win, ar });
    const N = (sents, ct, rate) => ctx.dubNext(sents, 0, ct, rate || 1, ctx.DUB_CPS, ctx.DUB_AUTO_MAX, ctx.DUB_CURVE_MAC);
    // ⛔ ~~«ثانيتان · 30٪» في وضع الجمل~~ — سُحبتا بملاحظة المالك («توقفات غير منطقيه … في منتصف جمل»): الثانيتان لوضع العرض وحدَه
    check("[٤] الثوابت: العرضُ ثانيتان · والجملُ ست ثوانٍ · سقفُ التلقائيّة 1.4 دون R_max", ctx.DUB_LATE_MAX_S === 2 && ctx.DUB_BEHIND_MAX_S === 6 && ctx.DUB_AUTO_MAX === 1.4 && ctx.DUB_AUTO_MAX < ctx.DUB_R_MAX);
    check("[٤] قبل الموعد ⇐ انتظار", N([S(10000, 3000, "مرحبا")], 9.5).wait === "early");
    const go = N([S(10000, 3000, "مرحبا")], 9.95);
    check("[٤] في الموعد (بسبقٍ 0.1 ث) ⇐ تُنطق بسرعة 1", go.speak && go.rate === 1, go);
    const late = N([S(10000, 5000, "مرحبا")], 12.2);
    check("[٤] ⭐ بدءٌ متأخّرٌ ثانيتين وأكثر (بعد سابقتها) ⇐ تُنطق ولا تُحذف — ⛔ ~~تُتخطّى~~", late.speak === true && late.skipped === 0 && Math.abs(late.behind - 2.2) < 1e-9, late);
    check("[٤] ⭐ وبقي أقلُّ من 30٪ من نافذتها ⇐ تُنطق أسرع — ⛔ ~~تُتخطّى~~", N([S(10000, 1000, "مرحبا")], 10.75).speak === true);
    check("[٤] ومتأخّرةٌ فوق ست ثوانٍ (إعلانٌ أو تبويبٌ نام) ⇐ تُتخطّى", N([S(10000, 5000, "مرحبا")], 16.2).skipped === 1);
    const two = N([S(10000, 1000, "أ"), S(17000, 3000, "ب")], 16.95);   // الأولى متأخّرةٌ 6.95 ث · والثانية في موعدها بسبق 0.1
    check("[٤] وتُتخطّى إلى التي بعدها لا تُنسى", two.skipped === 1 && two.i === 1 && two.speak === true, two);
    check("[٤] ترجمةٌ لم تصل ⇐ انتظار لا تخطٍّ", N([S(10000, 3000, null)], 10).wait === "translate");
    check("[٤] ترجمةٌ فشلت (فارغة) ⇐ تُتخطّى", N([S(10000, 3000, "")], 10).skipped === 1);
    const long = N([S(10000, 1000, "ب".repeat(60))], 10);
    check("[٤] جملةٌ لا تتّسع ⇐ بسقف التلقائيّة 1.4 لا بـR_max", long.real === ctx.DUB_AUTO_MAX && Math.abs(long.rate - ctx.dubChromeRate(1.4)) < 1e-9, long);
    // الجولة الثالثة: السقفُ يرتفع مع التأخّر (`dubCapFor`) — فالسقفُ المطلقُ يُرى في جملةٍ متأخّرةٍ فوق ثانية لا في موعدها
    const capR = ctx.dubNext([S(10000, 3000, "ب".repeat(60))], 0, 11.5, 1, ctx.DUB_CPS, ctx.DUB_R_MAX, ctx.DUB_CURVE_MAC);
    check("[٤] وبـR_max سقفاً ⇐ كروم 2 لا أكثر (السقفُ المطلق)", capR.real === ctx.DUB_R_MAX && capR.rate === ctx.DUB_RATE_CAP, capR);
    // ⭐ اللحاقُ بالتأخّر (تصميمُ الجولة: 3.4 إيقافاتٍ للفيديو في الدقيقة عند سقفٍ ثابت 1.4 ⇐ نحو 0.2)
    check("[٤] ⭐ سقفُ اللحاق: 1.4 حتى 0.3 ث · 1.6 حتى ثانية · R_max بعدها", ctx.dubCapFor(0) === 1.4 && ctx.dubCapFor(0.3) === 1.4 &&
      ctx.dubCapFor(0.5) === ctx.DUB_CATCH_MAX && ctx.dubCapFor(1) === ctx.DUB_CATCH_MAX && ctx.dubCapFor(1.2) === ctx.DUB_R_MAX);
    const lagA = ctx.dubNext([S(10000, 3000, "ب".repeat(60))], 0, 10, 1, ctx.DUB_CPS, ctx.DUB_R_MAX, ctx.DUB_CURVE_MAC),
      lagB = ctx.dubNext([S(10000, 3000, "ب".repeat(60))], 0, 10.6, 1, ctx.DUB_CPS, ctx.DUB_R_MAX, ctx.DUB_CURVE_MAC);
    check("[٤] ⭐ والجملةُ نفسُها: في موعدها 1.4 · ومتأخّرةً 0.6 ث 1.6 — لا R_max إلا للحاقٍ أبعد", lagA.real === 1.4 && lagB.real === ctx.DUB_CATCH_MAX, [lagA.real, lagB.real]);
    const slow = N([S(10000, 2000, "ب".repeat(16))], 10, 1), fast = N([S(10000, 2000, "ب".repeat(16))], 10, 1.5);
    check("[٤] سرعةُ الفيديو تقصّر النافذة ⇐ سرعةٌ أعلى", fast.need > slow.need * 1.49 && fast.need < slow.need * 1.51, [slow.need, fast.need]);
    check("[٤] انتهت الجمل ⇐ done", N([S(1000, 1000, "أ")], 30).done === true);
    const fx = ctx.dubNext([S(10000, 1000, "ب".repeat(60))], 0, 10, 1, ctx.DUB_CPS, ctx.DUB_R_MAX, ctx.DUB_CURVE_MAC, 1.25);
    check("[٤] سرعةٌ يختارها المستخدم ⇐ تُنطق بها، والتخطّي بقاعدته", fx.speak && fx.rate === 1.25, fx);
    const DN = (pnd, shown, now, win, fixed) => ctx.dubDisplayNext(pnd, shown, now, win, ctx.DUB_CPS, ctx.DUB_AUTO_MAX, ctx.DUB_CURVE_MAC, fixed);
    const P = { text: "سطرٌ عربيٌّ قصير", line: "سطرٌ عربيٌّ قصير", at: 1000 };
    check("[٤] العرض: لا سطرَ ينتظر ⇐ انتظار", DN(null, [], 1000, 3000).wait === "none");
    check("[٤] العرض: سطرٌ معروض ⇐ يُنطق ولو تأخّر", DN(P, [P.line], 1000 + 2500, 3000).speak === true);
    check("[٤] العرض: سطرٌ غاب عن الشاشة بعد أكثرَ من ثانيتين ⇐ يُتخطّى", DN(P, [], 1000 + 2500, 3000).skip === true);
    check("[٤] العرض: وغاب منذ أقلَّ من ثانيتين ⇐ يُنطق", DN(P, [], 1000 + 1500, 3000).speak === true);
    const lg = DN(Object.assign({}, P, { text: "ب".repeat(80) }), [P.line], 1000, 3000);
    check("[٤] العرض: سطرٌ طويلٌ في نافذةٍ قصيرة ⇐ بسقف التلقائيّة لا أكثر", Math.abs(lg.rate - ctx.dubChromeRate(1.4)) < 1e-9, lg);
    check("[٤] العرض: وسرعةُ المستخدم تغلب", DN(P, [P.line], 1000, 3000, 1.5).rate === 1.5);
    const fakeP = (lines) => ({ querySelectorAll: (q) => (q === ".caption-visual-line" ? lines.map((t) => ({ textContent: t })) : []) });
    const W = (lang, lines) => ({ hasAttribute: (a) => a === "lang", getAttribute: () => lang,
      querySelectorAll: (q) => (q === ".caption-visual-line" ? lines.map((t) => ({ textContent: t })) : []) });
    const winP = { querySelectorAll: (q) => (q === ".caption-window" ? [W("en", ["English (auto-generated) >> Arabic Click ⚙ for settings"]), W("ar", ["مرحباً بكم"])] : []) };
    check("[٤] ⛔ نافذةُ اسم المسار (lang=en) لا تُقرأ — نافذةُ العربيّة وحدَها", JSON.stringify(ctx.dubCaptionLines(winP)) === JSON.stringify(["مرحباً بكم"]), ctx.dubCaptionLines(winP));
    check("[٤] السطورُ المعروضة تُقرأ بنصّها و[موسيقى] و♪ تُحذف", JSON.stringify(ctx.dubCaptionLines(fakeP(["  مرحباً  بكم ", "[موسيقى]", "♪♪ هنا"]))) === JSON.stringify(["مرحباً بكم", "هنا"]),
      ctx.dubCaptionLines(fakeP(["  مرحباً  بكم ", "[موسيقى]", "♪♪ هنا"])));
    check("[٤] الاستئنافُ من أوّل جملةٍ تبدأ عند الموضع أو بعده (§٣)", ctx.dubFirstAt([S(1000), S(5000), S(9000)], 5) === 1 && ctx.dubFirstAt([S(1000)], 9) === 1);
    // ⭐ الجولة الثالثة (تصميمُ الجولة G4): قفزةٌ أو بدءٌ في أوّل جملةٍ بدأت ⇐ تُنطق هي — ⛔ ~~صمتٌ حتى التي بعدها (6–15 ث)~~
    const U = [{ start: 10000, win: 6000 }, { start: 16000, win: 6000 }];
    check("[٤] ⭐ في أوّل الجملة (0.8 ث من 6) ⇐ هي · وبعد ثانيتين ⇐ التالية · وقبلها ⇐ هي في موعدها", ctx.dubResyncAt(U, 10.8) === 0 &&
      ctx.dubResyncAt(U, 12) === 1 && ctx.dubResyncAt(U, 9) === 0 && ctx.dubResyncAt([{ start: 10000, win: 2000 }, { start: 12000, win: 4000 }], 10.7) === 1,
      [ctx.dubResyncAt(U, 10.8), ctx.dubResyncAt(U, 12), ctx.dubResyncAt(U, 9)]);
    // ⭐ حَكَمُ الجولة S11: تتمّةُ قطعةٍ لم تنتهِ بترقيمها تبدأ قبل موعدها بـDUB_GLUE_S حين يفرغ صوتُ سابقتها — ⛔ ~~فجوةٌ وسطَ الكلام
    // الجاري كلّما أنهى صوتُنا نافذتَه مبكّراً~~ — وبعد جملةٍ تامّةٍ يبقى السبقُ عُشرَ ثانية (شاهد)
    const G = (prev) => ctx.dubNext([S(0, 13000, prev), S(13000, 4000, "تتمّةُ الكلام.")], 1, 12.4, 1, ctx.DUB_CPS, ctx.DUB_AUTO_MAX, ctx.DUB_CURVE_MAC);
    check("[٤] ⭐ تتمّةُ ما لم ينتهِ بترقيمه ⇐ تُنطق قبل موعدها بـ0.8 ث — ⛔ ~~«مبكّرة» فصمتٌ وسطَ الكلام~~", ctx.DUB_GLUE_S === 0.8 && G("كلامٌ لم ينتهِ بعد").speak === true, G("كلامٌ لم ينتهِ بعد"));
    check("[٤] وبعد جملةٍ تامّة ⇐ «مبكّرة» كما كانت (شاهد)", G("جملةٌ تامّة.").wait === "early" && G("سؤالٌ تامّ؟").wait === "early");
    // ⭐ والتمامُ بنصّ المصدر: جملةٌ إنجليزيّةٌ تامّةٌ أسقط مترجمُها النقطة ⇐ ليست تتمّةً — ⛔ ~~تبدأ التاليةُ قبل موعدها بـ0.7 ث~~ (📐 رِكازُ كروم)
    const GT = ctx.dubNext([{ start: 0, win: 13000, text: "We went to the market.", ar: "ذهبنا إلى السوق" }, S(13000, 4000, "واشترينا التفّاح.")], 1, 12.4, 1, ctx.DUB_CPS, ctx.DUB_AUTO_MAX, ctx.DUB_CURVE_MAC);
    const GU = ctx.dubNext([{ start: 0, win: 13000, text: "We went to the", ar: "ذهبنا إلى" }, S(13000, 4000, "السوق.")], 1, 12.4, 1, ctx.DUB_CPS, ctx.DUB_AUTO_MAX, ctx.DUB_CURVE_MAC);
    check("[٤] ⭐ والتمامُ بنصّ المصدر لا بالعربيّة: تامّةٌ أسقط المترجمُ نقطتَها ⇐ «مبكّرة» · وناقصةٌ ⇐ تتمّة", GT.wait === "early" && GU.speak === true, [GT, GU]);
    // ⭐ مراجعةُ الجولة #9: وفي كلامٍ جارٍ وحدَه — بعد صمتٍ بين القطعتين لا تتمّة (يسكت الصوتُ حين يسكت المتكلّم) · وبلا صمتٍ تتمّة (شاهد)
    const GS = (gapMs) => ctx.dubNext([{ start: 0, win: 2000, end: 2000, text: "we were talking about", ar: "كنّا نتحدّث عن" }, { start: 2000 + gapMs, win: 3000, end: 5000 + gapMs, text: "memory.", ar: "الذاكرة." }],
      1, (2000 + gapMs) / 1000 - 0.6, 1, ctx.DUB_CPS, ctx.DUB_AUTO_MAX, ctx.DUB_CURVE_MAC);
    check("[٤] ⭐ تتمّةٌ بعد صمتٍ ثانيتين ونصف ⇐ «مبكّرة» (لا تسبق المتكلّم) · وبعد 0.3 ث ⇐ تتمّة", GS(2500).wait === "early" && GS(300).speak === true, [GS(2500), GS(300)]);
    // ⭐ مراجعةُ الجولة #5 · #7 — الاستئنافُ بعد إيقافٍ أو تجمّد (لا قفز): لا رجوعَ إلى ما قيل · إلا جملةً قطعناها ونصفُ نافذتها باقٍ
    const RU = [{ start: 10000, win: 5000 }, { start: 15000, win: 12000 }, { start: 27000, win: 4000 }];
    check("[٤] ⭐ قيلت كلُّها ثمّ إيقافٌ في نافذتها ⇐ لا تُعاد — ⛔ ~~«dubResyncAt» يعيدها~~", ctx.dubResyncAt(RU, 11.3) === 0 && ctx.dubResumeAt(RU, 11.3, ctx.dubResyncAt(RU, 11.3), 1, null) === 1);
    check("[٤] ⭐ قُطعت وسطَها والموضعُ في نصفها الأوّل ⇐ تُعاد من أوّلها (12 ث، قُطعت عند 4) — ⛔ ~~صمتٌ ثماني ثوانٍ~~", ctx.dubResumeAt(RU, 19, ctx.dubResyncAt(RU, 19), 2, 1) === 1);
    check("[٤] وبعد نصفها ⇐ التالية (لا تُعاد جملةٌ لا تلحق)", ctx.dubResumeAt(RU, 22, ctx.dubResyncAt(RU, 22), 2, 1) === 2);
  }

  // ---------------------------------------------------------------- [٥] الصوت والجسر
  console.log("\n[٥] الصوتُ بوسم اللغة · والجسرُ يقبل ردَّ طلبه وحدَه");
  {
    const vs = [{ lang: "en-US", name: "Samantha", localService: true }, { lang: "ar-001", name: "Majed", localService: true },
      { lang: "ar-001", name: "Laila (Enhanced)", localService: true }, { lang: "ar-SA", name: "Google العربية", localService: false }];
    check("[٥] العربيّ المحلّيّ المحسّن أوّلاً", ctx.dubPickVoice(vs).name === "Laila (Enhanced)", ctx.dubPickVoice(vs));
    check("[٥] بلا صوتٍ عربيّ ⇐ null (لا اسمٌ يُخمَّن)", ctx.dubPickVoice([vs[0]]) === null);
    const vu = vs.map((v) => Object.assign({ voiceURI: v.name }, v));
    check("[٥] ما اختاره المستخدمُ أوّلاً إن كان عربيّاً موجوداً", ctx.dubPickVoice(vu, "Majed").name === "Majed");
    check("[٥] واختيارٌ غيرُ عربيّ أو غائبٌ ⇐ الافتراضيّ", ctx.dubPickVoice(vu, "Samantha").name === "Laila (Enhanced)" && ctx.dubPickVoice(vu, "nope").name === "Laila (Enhanced)");
    const w = ctx.window;
    w.addEventListener("__vz_dub_req__", (e) => {
      const m = JSON.parse(e.detail);
      const say = (d) => w.dispatchEvent(new FakeCustomEvent("__vz_dub_res__", { detail: d }));
      say(JSON.stringify({ id: "other", ok: true, fake: 1 }));          // طلبٌ آخر
      say("{not json");                                                 // معطوب
      say({ id: m.id, ok: true, fake: 2 });                             // كائنٌ لا نصّ
      say(JSON.stringify({ id: m.id, ok: true, op: m.op }));            // هو
    });
    const r = await ctx.dubMainCall("ping", null, 500);
    check("[٥] يُقبل ردُّ الطلب نفسِه وحدَه", r.ok === true && r.op === "ping" && !r.fake, r);
    check("[٥] ولا يبقى مستمعٌ بعد الردّ", w.count("__vz_dub_res__") === 0, w.count("__vz_dub_res__"));
    ctx.window = makeWindow();
    const t = await ctx.dubMainCall("ping", null, 60);
    check("[٥] بلا عالم صفحة ⇐ main-missing بعد المهلة", t.ok === false && t.reason === "main-missing", t);
  }

  // ---------------------------------------------------------------- [٦] M2+R على مشغّلٍ مزيّف
  console.log("\n[٦] `yt_dub_main.js` على مشغّلٍ مزيّف: طلبٌ واحد · القاطع · اللغةُ اللاصقة بحروفها");
  {
    const K = 25;                                   // الزمنُ مُسرَّعٌ بانتظام: المهلُ ÷ K والساعةُ × K
    const t0 = Date.now();
    function makeStore(init) {
      const m = new Map(Object.entries(init || {}));
      return { get length() { return m.size; }, key(i) { return Array.from(m.keys())[i] ?? null; },
        getItem(k) { return m.has(k) ? m.get(k) : null; }, setItem(k, v) { m.set(k, String(v)); }, removeItem(k) { m.delete(k); },
        dump() { return Object.fromEntries(m); } };
    }
    function env(o) {
      const opts = o || {};
      const obs = [], fetched = [], calls = [];
      const now = () => (Date.now() - t0) * K;
      const emit = (name, status, size) => obs.forEach((cb) => cb({ getEntries: () => [{ name, startTime: now(), responseStatus: status, encodedBodySize: size, transferSize: size + 300 }] }));
      const STICKY = "yt-player-caption-sticky-language", PREFS = "yt-player-caption-language-preferences";
      const local = makeStore(opts.sticky ? { [STICKY]: opts.sticky } : {}), session = makeStore({});
      let track = {}, loaded = false;
      const base = "https://www.youtube.com/api/timedtext?v=VID&lang=en&kind=asr&caps=asr&signature=S&pot=POT&c=WEB";
      const p = {
        classList: { contains: (c) => !!opts.ad && c === "ad-showing" },
        querySelector: (s) => (s === ".ytp-subtitles-button" ? { getAttribute: () => (track.languageCode ? "true" : "false") } : null),
        getPlayerResponse: () => ({ videoDetails: { videoId: "VID", isLive: false, lengthSeconds: "60" }, playabilityStatus: { status: "OK" },
          captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: "/api/timedtext?v=VID&lang=en&kind=asr", languageCode: "en", kind: "asr" }] } } }),
        loadModule: (n) => { calls.push("load:" + n); loaded = true; },
        unloadModule: (n) => { calls.push("unload:" + n); loaded = false; track = {}; },
        getOptions: () => (loaded ? ["captions"] : []),
        getOption: (m, k) => (k === "tracklist" ? [{ languageCode: "en", kind: "asr" }] : track),
        setOption: (m, k, v) => {
          calls.push("set:" + JSON.stringify(v));
          track = v || {};
          if (!track.languageCode) return;
          // 📐 ما رآه المالك: setOption(track) يكتب اللاصقةَ ويُلحق قائمةَ الجلسة
          local.setItem(STICKY, JSON.stringify({ data: track.languageCode, expiration: 9, creation: Date.now() }));
          session.setItem(PREFS, JSON.stringify({ data: JSON.stringify([track.languageCode]), creation: 1 }));
          setTimeout(() => emit(base, opts.refuse ? 429 : 200, opts.refuse ? 0 : 900), 4);
        }
      };
      const win = makeWindow();
      class PO { constructor(cb) { this.cb = cb; } observe() { obs.push(this.cb); } disconnect() { const i = obs.indexOf(this.cb); if (i >= 0) obs.splice(i, 1); } }
      PO.supportedEntryTypes = ["resource"];
      const json3 = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 2000, segs: [{ utf8: "Hello there." }] }, { tStartMs: 2500, dDurationMs: 1500, segs: [{ utf8: "Bye." }] }] });
      const sandbox = {
        window: win, document: { querySelector: (s) => (s === "#movie_player" ? p : null) },
        location: { search: "?v=VID", origin: "https://www.youtube.com" }, URL, URLSearchParams, JSON, Date, Math, Number, String, Array, Object, Promise,
        localStorage: local, sessionStorage: session, PerformanceObserver: PO, AbortController, CustomEvent: FakeCustomEvent,
        performance: { now },
        setTimeout: (f, ms) => setTimeout(f, Math.max(0, (ms || 0) / K)), clearTimeout,
        fetch: async (url) => { fetched.push(url); emit(url, 200, 500); return { status: 200, text: async () => json3 }; }
      };
      sandbox.window.CustomEvent = FakeCustomEvent;
      vm.createContext(sandbox);
      vm.runInContext(MAIN, sandbox);
      const ask = (op, args) => new Promise((resolve) => {
        const id = "t" + Math.random();
        const on = (e) => { const m = JSON.parse(e.detail); if (m.id !== id) return; win.removeEventListener("__vz_dub_res__", on); resolve(m); };
        win.addEventListener("__vz_dub_res__", on);
        win.dispatchEvent(new FakeCustomEvent("__vz_dub_req__", { detail: JSON.stringify({ id, op, args }) }));
      });
      return { ask, fetched, calls, local, session, STICKY, PREFS };
    }
    const SRC_EN = { v: "VID", code: "en", asr: true, ql: "en", qk: "asr", qv: "" };
    const before = JSON.stringify({ data: "ar", expiration: 1, creation: 1 });

    const e1 = env({ sticky: before });
    const f = await e1.ask("facts");
    check("[٦] الحقائق: المصدرُ تلقائيّةٌ إنجليزيّة، بلا بثّ", f.ok && f.live === false && f.caps.length === 1 && f.caps[0].qk === "asr", f);
    const c1 = await e1.ask("capture", SRC_EN);
    check("[٦] التُقط وجُلب: json3 بأحداثه", c1.ok === true && c1.events.length === 2, c1);
    check("[٦] **طلبٌ واحدٌ منّا** بـ fmt=json3 وبمعاملات المشغّل نفسِها (pot)", e1.fetched.length === 1 && /fmt=json3$/.test(e1.fetched[0]) && /pot=POT/.test(e1.fetched[0]), e1.fetched);
    check("[٦] ⭐ اللغةُ اللاصقة أُعيدت **بحروفها** (خ20)", e1.local.getItem(e1.STICKY) === before, e1.local.getItem(e1.STICKY));
    check("[٦] ⭐ وقائمةُ الجلسة أُزيلت إذ لم تكن", e1.session.getItem(e1.PREFS) === null, e1.session.dump());
    check("[٦] وCC أُرجع بالواجهة لا بنقرة (unloadModule — كان مطفأً بلا وحدة)", e1.calls[e1.calls.length - 1] === "unload:captions", e1.calls);
    const c2 = await e1.ask("capture", SRC_EN);
    check("[٦] ثانيةً للفيديو نفسِه ⇐ من ذاكرة الصفحة، **ولا طلب** (مراجعة #1 · #15)", c2.ok === true && c2.how === "cached" && c2.events.length === 2 && e1.fetched.length === 1, c2);

    const e2 = env({ refuse: true });
    const r1 = await e2.ask("capture", SRC_EN);
    check("[٦] ⛔ رفضُ طلب المشغّل (429) ⇐ القاطع، **وصفرُ طلبٍ منّا**", r1.ok === false && r1.reason === "breaker" && e2.fetched.length === 0, r1);
    const r2 = await e2.ask("capture", Object.assign({}, SRC_EN, { v: "VID" }));
    check("[٦] ⛔ وبعده لا إجبارَ ولا طلب", r2.reason === "breaker" && e2.calls.filter((x) => x.startsWith("set:{\"languageCode")).length === 1, [r2, e2.calls]);
    const f2 = await e2.ask("facts");
    check("[٦] والحقائقُ تحمل القاطع فلا يُطلب الالتقاط أصلاً", !!f2.stop, f2);

    const e3 = env({ ad: true });
    const a1 = await e3.ask("capture", SRC_EN);
    check("[٦] ⛔ إعلانٌ يُعرض ⇐ لا شيء", a1.reason === "ad" && e3.calls.length === 0 && e3.fetched.length === 0, a1);
  }

  // ---------------------------------------------------------------- [٧] حرّاسٌ بنيويّة
  console.log("\n[٧] حرّاسٌ بنيويّة");
  {
    const code = SRC.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
    const b0 = SRC.indexOf("// ── #168 — الدبلجة العربية"), b1 = SRC.indexOf("\nchrome.runtime.onMessage.addListener");
    const block = b0 > 0 && b1 > b0 ? SRC.slice(b0, b1) : "";
    check("[٧] الكتلةُ موجودة", block.length > 1000);
    const bad = block.split("\n").filter((l) => /^\S/.test(l) && !/^(const |let |function |async function |\/\/|\}|\]|\);)/.test(l));
    check("[٧] ⭐ كسولٌ بالبناء: لا جملةَ تُنفَّذ عند التحميل — تعريفاتٌ وحدَها", bad.length === 0, bad.slice(0, 3));
    check("[٧] `cancel()` في موضعٍ واحد — داخل `dubCancelOurs`", (code.match(/speechSynthesis\.cancel\(\)/g) || []).length === 1 && fn("dubCancelOurs").includes("speechSynthesis.cancel()"));
    check("[٧] ⛔ لا `pause()` ولا `resume()` للنطق أبداً (📐 علّق طابورَ المتصفّح)", !/speechSynthesis\.(pause|resume)\b/.test(code));
    check("[٧] ⛔ لا كتابةَ في صوت الفيديو أو سرعته أو كتمه (خ5)", !/\b(?:v|video)\.(?:volume|playbackRate|muted)\s*=[^=]/.test(block));
    const evs = Array.from(block.matchAll(/addEventListener\("([^"]+)"/g)).map((m) => m[1]);
    // ⛔ ~~ولمسةُ المستخدم (مفتاحٌ أو زرّ) أثناء إيقافنا الفيديو~~ — سُحبت (حَكَمُ الجولة S1، مقيس): نقرةٌ في أيّ مكانٍ أثناء الانتظار
    // كانت تترك الفيديو موقوفاً بلا نهاية — فلا مستمعَ على المستند أصلاً، ومهلةُ الانتظار تحكم
    check("[٧] لا مستمعَ إلا للصوت والتنزيل والجسر — ولا حدثَ وسائط ولا لمسةَ مستخدم (خ16 · حَكَمُ الجولة S1)",
      evs.length > 0 && evs.every((x) => ["voiceschanged", "downloadprogress", "__vz_dub_res__"].includes(x)) && !/addEventListener/.test(fn("dubWaitStart")) &&
      !/document\.addEventListener/.test(block), evs);
    // ⭐ الجولة الثالثة — الفيديو يُوقَف في موضعٍ واحد (الانتظار) ويُكمَل في نبضة الانتظار (نهايتُه · وقفزٌ أثناءه — مراجعةُ الجولة #6) وإطلاقِه عند الإيقاف
    const vp = block.match(/\bv\.pause\(\)/g) || [], vpl = block.match(/\bv\.play\(\)/g) || [];
    check("[٧] ⭐ الفيديو يُوقَف في الانتظار وحدَه، ويُكمَل في نبضته وإطلاقه وحدَهما", vp.length === 1 && fn("dubWaitStart").includes("v.pause()") &&
      vpl.length === 3 && (fn("dubWaitTick").match(/\bv\.play\(\)/g) || []).length === 2 && fn("dubWaitRelease").includes("v.play()"), { pause: vp.length, play: vpl.length });
    const tick = fn("dubTick"), why = fn("dubWhy");
    const o1 = ["chrome.runtime?.id", "extensionActive()", "isInMiniPlayer(", "dubVideoId() !== run.vid"].map((s) => why.indexOf(s));
    const o2 = ["dubWhy(run)", "ad-showing", "v.paused", "DUB_FREEZE_MS", "DUB_R_MAX", "DUB_SEEK_S", "dubNext("].map((s) => tick.indexOf(s));
    check("[٧] ترتيبُ النبضة (§٣): يتيم · بوّابة · مصغّر · تنقّل (`dubWhy`) ثمّ إعلان · توقّف · تجمّد · سرعة · قفزة · ثمّ الجملة",
      [o1, o2].every((o) => o.every((x, i) => x > 0 && (i === 0 || x > o[i - 1]))), { o1, o2 });
    check("[٧] وشروطُ الإيقاف نفسُها أثناء التجهيز (مراجعة #12)", /const why = dubWhy\(run\);/.test(fn("dubPrepare")));
    // ⛔ ~~`if (run.cur || v.seeking) return;` سطراً واحداً~~ — الجولة الثالثة فرّقتهما: الانتظارُ يُقرّر و`run.cur` يتكلّم
    const iSeek = tick.indexOf("if (v.seeking) return;"), iCur = tick.indexOf("if (run.cur) {"), iNext = tick.indexOf("dubNext(");
    check("[٧] جملةٌ واحدةٌ منّا تتكلّم · ولا بدءَ والمشغّلُ يقفز (مراجعة #7) — قبل التخطيط", iSeek > 0 && iCur > iSeek && iNext > iCur &&
      /if \(run\.cur\) \{[\s\S]*?return;\n  \}/.test(tick), { iSeek, iCur, iNext });
    check("[٧] التاليةُ من حدث النطق لا من المؤقّت (مراجعة #9)", /if \(dub === run && run\.state === "running"\) dubTick\(run\);/.test(fn("dubUtter")));
  }

  // ---------------------------------------------------------------- [٨] الحقن والإرسال
  console.log("\n[٨] عالمُ الصفحة يُحقن عند الضغط وحدَه · والرسائلُ إلى الإطار الأعلى");
  {
    const inManifest = (MANIFEST.content_scripts || []).some((c) => (c.js || []).includes("yt_dub_main.js"));
    check("[٨] ليس في المانيفست: لا سطرَ منه في صفحةٍ لم يُضغط فيها «دبلِج»", !inManifest);
    const tg = POPUP.slice(POPUP.indexOf("async function toggleDub"), POPUP.indexOf("async function loadBlockedSiteUI"));
    check("[٨] البوب-أب يحقنه في عالم الصفحة وللإطار الأعلى وحدَه",
      /files: \["yt_dub_main\.js"\], world: "MAIN"/.test(tg) && /frameIds: \[0\]/.test(tg));
    check("[٨] ولا موضعَ آخرَ يحقنه", (POPUP.match(/yt_dub_main\.js/g) || []).length === 1);
    const dubPart = POPUP.slice(POPUP.indexOf("// ── #168"), POPUP.indexOf("async function loadBlockedSiteUI"));
    const sends = dubPart.match(/chrome\.tabs\.sendMessage\([^)]*\)/g) || [];
    check("[٨] كلُّ إرسالٍ يحمل frameId: 0 (#24)", sends.length >= 2 && sends.every((s) => /\{ frameId: 0 \}/.test(s)), sends);
    const tail = MAIN.trim().split("\n").slice(-3).join("\n");
    check("[٨] العلمُ آخرُ سطرٍ في عالم الصفحة (#38ج)", /window\.__vzDubMain = true;\s*\n\}\)\(\);$/.test(tail), tail);
    const G = "MEM.req[v] = { at: Date.now(), events: null }";
    check("[٨] ⛔ طلبٌ واحد: `fetch(` موضعٌ واحد، والحارسُ قبله", (MAIN.match(/\bfetch\(/g) || []).length === 1 &&
      MAIN.indexOf(G) > 0 && MAIN.indexOf(G) < MAIN.indexOf("fetch("));
    check("[٨] ⛔ والقاطعُ يُفحص قبل الإجبار", MAIN.indexOf("if (MEM.stop) return") > 0 && MAIN.indexOf("if (MEM.stop) return") < MAIN.indexOf("p.loadModule(\"captions\")"));
    check("[٨] M2+R لا يكتب إلا مفاتيحَ المُعيِّن ومفتاحَ التشغيل", /if \(!SETTER\[f\]\.test\(k\) && !ONOFF\.test\(k\)\) return;/.test(MAIN));
    const fnPop = (name) => { const i = POPUP.indexOf(`function ${name}(`); let d = 0;
      for (let j = POPUP.indexOf("{", i); j < POPUP.length; j++) { if (POPUP[j] === "{") d++; else if (POPUP[j] === "}") { d--; if (!d) return POPUP.slice(i, j + 1); } } return ""; };
    check("[٨] الحظرُ يُقرأ في كلّ سؤال — زرُّ 🚫 في البوب-أب نفسِه تتبعه البطاقة (مراجعة 2 #5 · #9 · #14)", /readHostGates\(dubHost\)/.test(fnPop("refreshDub")));
    check("[٨] وحفظٌ فشل يُعيد ضوابطَ الدبلجة من التخزين (#69 · مراجعة 2 #15)", /fillDubPrefsUI\(\)/.test(fnPop("renderPopupFromStorage")));
    check("[٨] وعالمُ الصفحة يُعيد المفاتيحَ إن أُغلق التبويبُ والعرضُ قائم (مراجعة 2 #1)", /addEventListener\("pagehide"/.test(MAIN));
    // 168ح — المفتاحُ ترويسةٌ إلى مضيفَي Azure وحدَهما، بلا كوكيز، ولا يُطبع
    const block = SRC.slice(SRC.indexOf("// ── #168 — الدبلجة العربية"), SRC.indexOf("\nchrome.runtime.onMessage.addListener"));
    const calls = block.match(/\bfetch\([^,]*/g) || [];
    const OKF = ['fetch("https://" + az.region + ".tts.speech.microsoft.com/cognitiveservices/v1"',
      'fetch("https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=ar"'];
    check("[٨] ⛔ طلباتُ الدبلجة إلى مضيفَي Azure وحدَهما (الكلامُ بمنطقته المتحقَّقة · المترجم)", calls.length === 2 && calls.every((c) => OKF.includes(c)), calls);
    check("[٨] ⛔ وطلباتُ Azure بلا كوكيز (credentials: \"omit\")", (block.match(/credentials: "omit"/g) || []).length === 2);
    check("[٨] ⛔ ولا طباعةَ في الكونسول من كتلة الدبلجة (المفتاحُ لا يتسرّب في سجلّ)", !/console\.(log|info|debug|warn|error)\(/.test(block));
    check("[٨] ⛔ وعالمُ الصفحة لا يرى المفتاح: لا Azure في الجسر", !/microsoft\.com|Ocp-Apim/.test(MAIN));
  }

  // ---------------------------------------------------------------- [١٠] Azure — الخالص
  console.log("\n[١٠] 168ح والجولة الثالثة — SSML بنصٍّ مُهرَّب · حدُّ F0 بنافذةٍ منزلقة · حروفٌ مدفوعة · سرعةُ تشغيل · مقاطعُ جملٍ كاملة · مفاتيحُ تُتحقَّق");
  {
    check("[١٠] النصُّ يُهرَّب في SSML (لا علامةَ تكسر الطلب)", ctx.dubXmlEsc(`<a href="x">&'</a>`) === "&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
    const x = ctx.dubSsml("مرحبا <بكم> & أهلاً", "ar-EG-SalmaNeural", 1.3);
    check("[١٠] SSML: الصوتُ ولغتُه منه، والسرعةُ نسبة، والنصُّ مُهرَّب", /xml:lang="ar-EG"/.test(x) && /name="ar-EG-SalmaNeural"/.test(x) &&
      /prosody rate="\+30%"/.test(x) && /مرحبا &lt;بكم&gt; &amp; أهلاً/.test(x) && !/<بكم>/.test(x), x);
    // ⛔ ~~`rate="+0%"` بسرعته الطبيعيّة~~ — وسمٌ يُدفع حرفُه ولا يغيّر شيئاً (مراجعة 168ح #12) ⇒ بلا `<prosody>` أصلاً
    const x1 = ctx.dubSsml("أ", "ar-SA-HamedNeural", 1);
    check("[١٠] والسرعةُ في حدّي Azure (0.5–2) — وبسرعته الطبيعيّة بلا `<prosody>`", /rate="\+100%"/.test(ctx.dubSsml("أ", "ar-SA-HamedNeural", 3)) && /rate="-50%"/.test(ctx.dubSsml("أ", "ar-SA-HamedNeural", 0.2)) &&
      !/prosody/.test(x1) && /<voice name="ar-SA-HamedNeural">أ<\/voice>/.test(x1), x1);
    // ⭐ حدُّ F0 بنافذةٍ منزلقة (مراجعة 168ح #2 · #8: الدلوُ القديم أدخل 4 + 18 = 22 في دقيقة)
    const L = (log, now, until) => ctx.dubAzLimit(log, now, until);
    let log = [], n = 0;
    for (let i = 0; i < 30; i++) { const r = L(log, 0, 0); log = r.log; if (r.ok) { log.push(0); n++; } }
    check("[١٠] الحدّ: ثمانيةَ عشرَ دفعةً واحدةً ثمّ لا", n === ctx.DUB_AZ_PER_MIN, n);
    check("[١٠] ويُسمح بالتالي حين تمضي على أوّلها ستون ثانية — لا قبلها", !L(log, 59999, 0).ok && L(log, 60000, 0).ok);
    log = []; const ts = [];
    for (let t0 = 0; t0 <= 600000; t0 += 250) { const r = L(log, t0, 0); log = r.log; if (r.ok) { log.push(t0); ts.push(t0); } }
    let worst = 0;
    for (const a of ts) worst = Math.max(worst, ts.filter((t) => t >= a && t < a + 60000).length);
    check("[١٠] ⭐ عشرُ دقائق طلبٍ متّصل ⇐ لا تتجاوز أيُّ ستين ثانيةً 18 (حدُّ F0 عشرون)", worst === ctx.DUB_AZ_PER_MIN && ts.length >= ctx.DUB_AZ_PER_MIN * 10, { worst, n: ts.length });
    check("[١٠] ومهلةُ 429 تمنع ولو فرغ السجلّ", L([], 1000, 60000).ok === false && L([], 60000, 60000).ok === true);
    // حروفٌ مدفوعة (مراجعة 168ح #12): كلُّ ما في الطلب إلا وسمَي speak وvoice
    check("[١٠] الحروفُ المدفوعة: النصُّ ووسمُ السرعة — لا وسما speak وvoice", ctx.dubAzBill(x1) === 1 &&
      ctx.dubAzBill(ctx.dubSsml("أهلاً", "ar-SA-HamedNeural", 1.2)) === '<prosody rate="+20%">أهلاً</prosody>'.length);
    // ⭐ سرعةُ تشغيل المقطع: مدّتُه على ما بقي من نافذته — بين 1 والسقف مقسوماً على ما طُلب به
    check("[١٠] سرعةُ التشغيل: أقصرُ من نافذته ⇐ 1 · أطولُ ⇐ يُسرَّع بقدرها · وفوق السقف ⇐ السقف", ctx.dubAzFit(3, 4, 1, 1.4) === 1 &&
      Math.abs(ctx.dubAzFit(5, 4, 1, 1.4) - 1.25) < 1e-9 && Math.abs(ctx.dubAzFit(9, 4, 1.2, 1.4) - 1.4 / 1.2) < 1e-9 && ctx.dubAzFit(0, 4, 1, 1.4) === 1);
    // ⭐ حَكَمُ الجولة S6: مقطعٌ وصل ونافذتُه أُغلقت ⇐ بسقفه — ⛔ ~~بسرعة 1~~ فكان المتأخّرُ أبطأَ من الذي في موعده
    check("[١٠] ⭐ ونافذتُه أُغلقت (متأخّر) ⇐ بالسقف لا بـ1 — وما طُلب بالسقف لا يُزاد", ctx.dubAzFit(5, -1, 1, 1.4) === 1.4 && ctx.dubAzFit(5, 0, 1, 1.6) === 1.6 &&
      ctx.dubAzFit(5, -1, 1.4, 1.4) === 1, [ctx.dubAzFit(5, -1, 1, 1.4), ctx.dubAzFit(5, -1, 1.4, 1.4)]);
    const S2 = (start, win, text, ar) => ({ start, win, text, ar });
    const u = ctx.dubMergeUnits([S2(0, 2000, "a", "أ"), S2(2000, 2000, "b", "ب"), S2(4000, 2000, "c", null), S2(6000, 5000, "d", "د")]);
    check("[١٠] بلا ترقيم: قصيرٌ يُضمّ حتى 3.5 ث ولا يتجاوز 9 ث — والعربيّةُ تُضمّ حين تكتمل", u.length === 2 && u[0].win === 4000 && u[0].text === "a b" && u[0].ar === "أ ب" &&
      u[1].win === 7000 && u[1].text === "c d" && u[1].ar === null && u[1].start === 4000, u);
    // ⭐ الجولة الثالثة: **جملةٌ لم تنتهِ بترقيمها تُتمّ بما بعدها** ولو بلغت 3.5 ث — لا يقف الصوتُ وسطَها (ملاحظةُ المالك)
    const sp = ctx.dubMergeUnits([S2(0, 4000, "We went to", null), S2(4000, 3000, "the store.", null), S2(7000, 4000, "It was late.", null), S2(11000, 2000, "Then", null), S2(13000, 15000, "a very long tail.", null)]);
    check("[١٠] ⭐ مقطعٌ ينتهي حيث تنتهي جملتُه — ⛔ ~~يُقطع عند 3.5 ث~~", sp.length === 4 && sp[0].text === "We went to the store." && sp[0].win === 7000 &&
      sp[1].text === "It was late." && sp[2].text === "Then" && sp[3].start === 13000, sp.map((x) => x.win + "|" + x.text));
    // ⭐ حَكَمُ الجولة S10 (📖 قاعدةُ DubFlow): صمتٌ بثانيتين فأكثر بين قطعتين لا يُضمّ عبره ولو لم تنتهِ الأولى بترقيمها — يسكت الصوتُ
    // حين يسكت المتكلّم — ⛔ ~~يُضمّ ما بعد الصمت إليه فيُقرأ في نافذةٍ لا كلامَ فيها~~ · وصمتٌ بنصف ثانيةٍ يُضمّ كما كان (شاهد)
    const S3 = (start, win, end, text) => ({ start, win, end, text, ar: null });
    const gp = ctx.dubMergeUnits([S3(0, 6000, 3000, "We were talking about"), S3(6000, 4000, 9500, "memory and sleep."), S3(10000, 3000, 12500, "Fine.")]);
    const gq = ctx.dubMergeUnits([S3(0, 3500, 3000, "We were talking about"), S3(3500, 4000, 7000, "memory and sleep."), S3(7500, 3000, 10000, "Fine.")]);
    check("[١٠] ⭐ صمتُ ثلاث ثوانٍ بعد جملةٍ لم تنتهِ ⇐ مقطعان — ⛔ ~~مقطعٌ واحدٌ عبر الصمت~~", ctx.DUB_UNIT_GAP_MS === 2000 && gp.length === 3 && gp[0].text === "We were talking about" &&
      gp[1].text === "memory and sleep.", gp.map((x) => x.win + "|" + x.text));
    check("[١٠] وصمتُ نصف ثانية ⇐ تُتمّ الجملة كما كانت (شاهد)", gq.length === 2 && gq[0].text === "We were talking about memory and sleep." && gq[0].end === 7000, gq.map((x) => x.win + "|" + x.text));
    // ⭐ مراجعةُ الجولة #8: ذاكرةُ النصوص بحدّ (⛔ ~~بلا حدٍّ طولَ الجلسة~~)، والمستعملُ أخيراً يبقى — وما يُنسى تبقى أحداثُه في ذاكرة الصفحة
    const TX = new Map();
    for (let i = 0; i < 10; i++) ctx.dubTxKeep(TX, "v" + i, { i }, ctx.DUB_TX_KEEP);
    ctx.dubTxKeep(TX, "v3", TX.get("v3"), ctx.DUB_TX_KEEP);
    ctx.dubTxKeep(TX, "v10", { i: 10 }, ctx.DUB_TX_KEEP);
    check("[١٠] ⭐ ذاكرةُ النصوص: ثمانيةٌ على الأكثر، يُنسى الأقدمُ استعمالاً لا المستعملُ أخيراً", ctx.DUB_TX_KEEP === 8 && TX.size === 8 && TX.has("v3") && TX.has("v10") &&
      TX.has("v4") && !TX.has("v0") && !TX.has("v1") && !TX.has("v2"), Array.from(TX.keys()));
    const many = []; for (let i = 0; i < 120; i++) many.push(S2(i * 2500, 2500, "s" + i, null));
    const units = ctx.dubMergeUnits(many);
    let worstU = 0;
    for (const a of units) { const inMin = units.filter((v) => v.start >= a.start && v.start < a.start + 60000).length; worstU = Math.max(worstU, inMin); }
    check("[١٠] ⭐ جملٌ كلَّ 2.5 ث ⇐ مقاطعُ أقلُّ من 18 في أيّ دقيقة", worstU <= 18, worstU);
    const many2 = []; for (let i = 0; i < 120; i++) many2.push(S2(i * 2500, 2500, "s" + i + ".", null));
    const units2 = ctx.dubMergeUnits(many2);
    let worst2 = 0;
    for (const a of units2) worst2 = Math.max(worst2, units2.filter((v) => v.start >= a.start && v.start < a.start + 60000).length);
    check("[١٠] وجملٌ قصيرةٌ مرقّمةٌ كلَّ 2.5 ث ⇐ تُضمّ أيضاً تحت 18 في الدقيقة", worst2 <= 18, worst2);
    // ملفُّ يوتيوب العربيّ ⇐ مقاطعُ نصُّها العربيّةُ المعروضةُ نفسُها
    const yu = ctx.dubYtUnits([[0, 4000, 0, [["مرحباً بكم جميعاً. اليوم", null]]], [1990, 4000, 1, [["\n", null]]], [2000, 4000, 0, [["نتحدّث عن الذاكرة.", null]]]]);
    check("[١٠] ⭐ ملفُّ ترجمة يوتيوب ⇐ «ytar» ونصُّ المقطع العربيُّ نفسُه (لا ترجمةَ منّا)", yu && yu.kind === "ytar" && yu.sents.length >= 1 &&
      yu.sents.every((x) => x.ar === x.text) && yu.sents.map((x) => x.text).join(" ") === "مرحباً بكم جميعاً. اليوم نتحدّث عن الذاكرة.", yu);
    check("[١٠] وملفٌّ بلا كلام ⇐ null (يُقرأ ما يظهر بدلَه)", ctx.dubYtUnits([[0, 1000, 1, [["\n", null]]]]) === null);
    const o1 = ctx.dubAzOpts({ key: "abcDEF0123456789abcdef0123456789", region: "uaenorth", voice: "ar-SA-ZariyahNeural", trKey: "", trRegion: "" });
    check("[١٠] مفتاحٌ ومنطقةٌ وصوتٌ سليمة تمرّ، ومنطقةُ المترجم من منطقة الكلام", o1.key.length === 32 && o1.region === "uaenorth" && o1.voice === "ar-SA-ZariyahNeural" && o1.trRegion === "uaenorth" && o1.bad === "", o1);
    const o2 = ctx.dubAzOpts({ key: "abc def\"<x>", region: "evil.com/x?", voice: "<script>" });
    check("[١٠] ⛔ وما لا يصلح لرابطٍ أو ترويسة لا يدخلهما (مفتاحٌ بفراغ · منطقةٌ برابط · صوتٌ غريب)", o2.key === "" && o2.region === "uaenorth" && o2.voice === "ar-SA-HamedNeural", o2);
    // ⛔ ~~منطقةٌ لا تصلح ⇐ uaenorth صامتاً~~ — مفتاحُ منطقةٍ أخرى كان يُرفض فيُلام المفتاح (مراجعة 168ح #15)
    check("[١٠] ⭐ ومنطقةٌ كُتبت ولا تصلح يُقال عنها (`bad`) — للكلام وللمترجم", o2.bad === "region" &&
      ctx.dubAzOpts({ region: "uaenorth", trRegion: "West Europe" }).bad === "tr-region" && ctx.dubAzOpts({}).bad === "", o2.bad);
  }

  // ---------------------------------------------------------------- [٩] ما يقوله البوب-أب
  console.log("\n[٩] سطرُ البوب-أب لكلّ حال — بالسلوك (رُسم سلسلةُ شروطه مرّةً مكسورةً فقال «⛔» عن دبلجةٍ تعمل)");
  {
    const SRCP = POPUP;
    const grab = (name) => { const i = SRCP.indexOf(`const ${name} = {`); if (i < 0) throw new Error("لا " + name); let d = 0;
      for (let j = SRCP.indexOf("{", i); j < SRCP.length; j++) { if (SRCP[j] === "{") d++; else if (SRCP[j] === "}") { d--; if (!d) return SRCP.slice(i, j + 1) + ";"; } } };
    const fnP = (name) => { const i = SRCP.indexOf(`function ${name}(`); let d = 0;
      for (let j = SRCP.indexOf("{", i); j < SRCP.length; j++) { if (SRCP[j] === "{") d++; else if (SRCP[j] === "}") { d--; if (!d) return SRCP.slice(i, j + 1); } } };
    const els = {};
    const el = (id) => (els[id] = els[id] || { id, textContent: "", value: "", disabled: false, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(...c) { c.forEach((x) => this._s.delete(x)); }, has(c) { return this._s.has(c); } } });
    const pctx = { $: el, dubPin: null };
    vm.createContext(pctx);
    vm.runInContext(["DUB_REASON_TEXT", "DUB_STEP_TEXT", "DUB_HOLD_TEXT", "DUB_STOP_TEXT", "DUB_KIND_TEXT", "DUB_AZ_WARN", "DUB_YT_WHY"].map(grab).join("\n").replace(/^const /gm, "var ") + "\nvar dubRestartTo = \"\";\n" + fnP("renderDub") + "\n" +
      fnP("dubDiagText") + "\n" + fnP("dubYtWhyText"), pctx);
    const R = (st, source) => { el("dubSource").value = source || "yt"; pctx.renderDub(st); return { note: el("dubNote").textContent, bad: el("dubNote").classList.has("bad"), btn: el("dubBtn").textContent, off: el("dubBtn").disabled }; };
    const run = (x) => Object.assign({ ok: true, state: "running", hold: "", kind: "display", idx: 3, total: 0, spoken: 2, skipped: 1, lost: 0, warm: true, source: "yt" }, x || {});
    let r = R(run());
    check("[٩] يعمل بوضع العرض ⇐ «يُدبلج» والزرُّ «أوقف» — لا «⛔»", /^يُدبلج/.test(r.note) && !r.bad && r.btn === "أوقف الدبلجة" && !/⛔/.test(r.note), r);
    check("[٩] ووضعُ العرض بلا «الجملة X من Y»", !/الجملة/.test(r.note), r.note);
    r = R(run({ kind: "asr", total: 40 }), "device");
    check("[٩] ووضعُ الجمل بها", /الجملة 3 من 40/.test(r.note), r.note);
    vm.runInContext("dubRestartTo = \"device\";", pctx);
    r = R(run(), "device");
    // ⛔ ~~«المصدرُ الجديد من الضغطة التالية»~~ — الجولة الثالثة: التبديلُ يُعيد البدءَ فوراً، والفرقُ لحظةُ إعادةٍ تُقال
    check("[٩] مصدرٌ تغيّر وأُرسل به «دبلِج» ⇐ «يُعاد البدءُ» يُقال في كلّ رسمٍ حتى يبدأ (مراجعة 2 #12)", /يُعاد البدءُ بالمصدر المختار/.test(r.note) && !r.bad, r.note);
    vm.runInContext("dubRestartTo = \"\";", pctx);
    r = R(run(), "device");
    // ⭐ مراجعةُ الجولة #1: فرقٌ لم يُرسل له «دبلِج» (تبويبٌ أو جهازٌ آخر غيّر المصدر، أو حفظٌ رُفض) ⇐ يُقال كما هو — ⛔ ~~وعدٌ بإعادةٍ لن تأتي~~
    check("[٩] ⭐ وفرقٌ لم يُرسل له «دبلِج» ⇐ «تعمل بمصدرٍ غير المختار» لا «يُعاد البدءُ»", /تعمل بمصدرٍ غير المختار/.test(r.note) && !/يُعاد البدءُ/.test(r.note), r.note);
    r = R(run({ kind: "ytar", total: 30, hold: "wait-voice" }));
    check("[٩] الجولة الثالثة: قراءةٌ مسبقة ⇐ «الجملة X من Y» و«مسبقاً» — وانتظارُنا يُقال لا يُترك لغزاً", /الجملة 3 من 30/.test(r.note) && /مسبقاً/.test(r.note) &&
      /أوقفتُ الفيديو لحظةً حتى يجهز صوتُ الجملة/.test(r.note), r.note);
    r = R(run({ engine: "azure", azOn: false, azWarn: "", azOff: "", voice: "Laila" }));
    check("[٩] ⭐ Azure مطلوبٌ لا يتكلّم ⇐ لا «بصوت Azure» (مراجعة 168ح #14)", !/بصوت Azure/.test(r.note) && /⚠️/.test(r.note), r.note);
    r = R(run({ engine: "azure", azOn: true, azWarn: "", azTts: 120, azTr: 40 }));
    check("[٩] ويتكلّم ⇐ «بصوت Azure»، والحرفان لكلّ خدمةٍ وحدَها (مراجعة 168ح #12)", /بصوت Azure/.test(r.note) && /الكلام 120 · المترجم 40/.test(r.note), r.note);
    r = R(run({ engine: "azure", azOn: false, azOff: "key", voice: "" }));
    check("[٩] مفتاحٌ مرفوضٌ ولا صوتَ في الجهاز ⇐ يُقال لا «بصوت الجهاز» وحدَه", /ولا صوتَ عربيّ في الجهاز يخلفه/.test(r.note), r.note);
    r = R(run({ kind: "azure", hold: "tr-off", trOff: "key" }), "azure");
    check("[٩] لا مترجمَ يخلف ⇐ «tr-off» — ولا «بمترجم كروم» معه", /ولا مترجمَ بديل/.test(r.note) && !/بمترجم كروم/.test(r.note), r.note);
    r = R(run({ hold: "cc-lang" }));
    check("[٩] مسارٌ غيرُ عربيّ معروض ⇐ يُقال بسببه", /ليست عربية/.test(r.note), r.note);
    r = R({ ok: true, state: "preparing", step: "show", source: "yt" });
    check("[٩] يجهّز ⇐ خطوتُه بنصّها", /يشغّل ترجمة يوتيوب العربية/.test(r.note) && r.btn === "أوقف الدبلجة", r);
    r = R({ ok: true, state: "stopped", reason: "user" });
    check("[٩] أوقفتَها ⇐ «دبلِج» من جديد", r.note === "أوقفتَها" && r.btn === "دبلِج هذا الفيديو" && !r.bad, r);
    r = R({ ok: true, state: "refused", reason: "breaker" });
    check("[٩] رفضٌ ⇐ «⛔» بسببه وبلون الخطأ", /^⛔ رفض يوتيوب/.test(r.note) && r.bad, r);
    r = R({ ok: true, state: "master-off" });
    check("[٩] المفتاحُ مطفأ ⇐ الزرُّ معطَّلٌ بسببه", /مطفأة من المفتاح الرئيسي/.test(r.note) && r.off, r);
    r = R({ ok: true, state: "blocked" });
    check("[٩] محظور ⇐ الزرُّ معطَّلٌ بسببه", /محظورة/.test(r.note) && r.off, r);
    r = R(null);
    check("[٩] لا سكربتَ في الصفحة ⇐ «أعد تحميلها»", /غير محقونة/.test(r.note), r);
    r = R({ ok: true, state: "idle" });
    check("[٩] لا شيءَ يجري ⇐ الدعوة", /اختر مصدرها/.test(r.note) && !r.bad, r);
    // ⭐ حَكَمُ الجولة S12 — سطرُ القياس: أرقامٌ يقرؤها المالك ويرسلها (سرعةُ الصوت · صمتا المقطع · السرعة · ما تحتاجه الجمل · التأخّر ·
    // وقفُ الفيديو) — ويُخفى حين لا تعمل الدبلجة
    r = R(run({ kind: "ytar", total: 30, engine: "azure", azOn: true, cps: 11.2, leadMs: 98, tailMs: 840, spd: [1.25, 1.62], need: [1.1, 1.48], lagP90: 0.42, stallS: 3.1 }));
    const dg = el("dubDiag");
    check("[٩] ⭐ يعمل ⇐ سطرُ القياس بأرقامه كلِّها", !dg.hidden && /الصوت 11\.2 حرف\/ث/.test(dg.textContent) && /أوّله 98 م\.ث وآخرُه 840 م\.ث/.test(dg.textContent) &&
      /السرعة 1\.25× وأقصاها 1\.62×/.test(dg.textContent) && /1\.1×/.test(dg.textContent) && /1\.48×/.test(dg.textContent) && /0\.42 ث/.test(dg.textContent) &&
      /وقف الفيديو 3\.1 ث/.test(dg.textContent), dg.textContent);
    R({ ok: true, state: "stopped", reason: "user" });
    check("[٩] وأُوقفت ⇐ سطرُ القياس مخفيٌّ فارغ", el("dubDiag").hidden === true && el("dubDiag").textContent === "", el("dubDiag"));
    // ⭐ ملاحظةُ المالك ١ في مصدرَي الترجمة: يوتيوب يعرض ترجمتَه وأنا أقرأ غيرَها ⇐ يُقال ويُدَلّ على «ترجمة يوتيوب العربية»
    r = R(run({ kind: "asr", total: 30, source: "device", shownDiffers: true }), "device");
    check("[٩] ⭐ يوتيوب يعرض ترجمتَه وأنا أقرأ غيرَها ⇐ يُقال، ويُدَلّ على «ترجمة يوتيوب العربية»", /يعرض ترجمتَه العربيّة وأنا أقرأ ترجمةً أخرى/.test(r.note) && /«ترجمة يوتيوب العربية»/.test(r.note), r.note);
    r = R(run({ kind: "asr", total: 30, source: "device", shownDiffers: false }), "device");
    check("[٩] ولا يُقال حين لا يختلفان", !/أقرأ ترجمةً أخرى/.test(r.note), r.note);
    const autoOpt = (HTML.match(/<option value="auto">([^<]*)<\/option>/) || [])[1] || "";
    // ⛔ ~~«1.4× عادةً»~~ (مراجعةُ الجولة #9): السرعةُ ما تحتاجه الجملة حتى 1.4 لا 1.4 دائماً
    check("[٩] ⭐ «تلقائية» تقول «حتى 1.4×» وإنها تُسرَّع حين يتأخّر الصوت — ⛔ ~~«تلحق حتى 1.4×» وحدَها والسرعةُ تبلغ 1.7~~", /حتى 1\.4×/.test(autoOpt) && /يتأخّر الصوت/.test(autoOpt), autoOpt);
    // ⭐ مراجعةُ الجولة #9: والقراءةُ كما تظهر لا انتظارَ فيها ولا لحاق — يُقال
    r = R(run({ kind: "display", ytWhy: "unhooked:fetch" }));
    check("[٩] ⭐ القراءةُ كما تظهر ⇐ يُقال «بلا إيقافٍ للفيديو ولا تسريعٍ فوق 1.4×»", /بلا إيقافٍ للفيديو ولا تسريعٍ فوق 1\.4×/.test(r.note), r.note);
    // ⭐ مراجعةُ الجولة #8: لكلّ سببٍ كلماتُه — ⛔ ~~«unhooked:fetch» بحروفها~~ · والرقمُ بين قوسين
    check("[٩] ⭐ سببُ تعذّر القراءة المسبقة بالعربيّة لا برمزه", /لم يمرّ بمراقبتنا/.test(r.note) && !/unhooked/.test(r.note), r.note);
    r = R(run({ kind: "display", ytWhy: "status:403" }));
    check("[٩] وسببٌ برقمه ⇐ الرقمُ بين قوسين", /لم ينجح \(403\)/.test(r.note) && !/status/.test(r.note), r.note);
    // ⭐ مراجعةُ الجولة #4: لا «بمترجم كروم» ولا مترجمَ كروم
    r = R(run({ kind: "azure", total: 30, trOff: "key", trLocal: false }), "azure");
    check("[٩] ⭐ مترجمُ Azure توقّف ولا مترجمَ كروم ⇐ «ولا مترجمَ بديل» لا «بمترجم كروم»", /ولا مترجمَ بديل/.test(r.note) && !/بمترجم كروم/.test(r.note), r.note);
    r = R(run({ kind: "azure", total: 30, trOff: "key", trLocal: true }), "azure");
    check("[٩] ومعه مترجمُ كروم ⇐ «بمترجم كروم» (شاهد)", /بمترجم كروم/.test(r.note), r.note);
    // ⭐ مراجعةُ الجولة #6 · #10 · #9 (الصفحة) · #5 (الصفحة): أسبابٌ جديدةٌ بكلماتها — ⛔ ~~الرمزُ نفسُه أو «تعذّرت الدبلجة: …»~~
    r = R(run({ kind: "asr", total: 30, hold: "no-voice" }), "device");
    check("[٩] ⭐ أصواتُ الجهاز ولا صوتَ عربيّ ⇐ يُقال ويُدَلّ على Azure", /لا صوتَ عربيّ في هذا الجهاز/.test(r.note) && /Azure/.test(r.note) && !/no-voice/.test(r.note), r.note);
    const RF = (reason) => R({ ok: true, state: "refused", reason }).note;
    check("[٩] ⭐ ورفضٌ بلا مفتاح مترجم · ونسخةٌ قديمةٌ في الصفحة · وتأخّرُ المشغّل ⇐ لكلٍّ كلماتُه",
      /بلا مفتاح مترجم/.test(RF("az-trnokey")) && /نسخةٌ أقدم/.test(RF("main-old")) && /تأخّر المشغّل/.test(RF("late")) &&
      !/تعذّرت الدبلجة: /.test(RF("az-trnokey") + RF("main-old") + RF("late")), [RF("az-trnokey"), RF("main-old"), RF("late")]);

    // ⭐ الجولة الثالثة — دوالُّ البوب-أب الحقيقيّة على تخزينٍ مزيّف: تبديلُ المصدر يُعيد البدء (ملاحظةُ المالك ١) · المنطقةُ تُتحقَّق
    // قبل الحفظ (168ح #15) · والصوتُ يُكتب في خانة محرّكه وحدَها (168ح #17)
    const fnA = (name) => { const i = SRCP.indexOf(`function ${name}(`); const a = SRCP.slice(Math.max(0, i - 6), i) === "async " ? "async " : ""; return a + fnP(name); };
    const store = { settings: {} }, sent = [];
    // عناصرُ تكفي القوائم: أبناءٌ يُمحَون بـtextContent، و`value` يُقبل إن كان بين الأبناء (كما في <select>)
    const qel = {};
    const mkEl = (id) => {
      const o = { id, checked: false, dataset: {}, kids: [], _v: "", classList: { add() {}, remove() {} },
        appendChild(c) { this.kids.push(c); }, get textContent() { return ""; }, set textContent(x) { this.kids = []; },
        get value() { return this.kids.length ? (this.kids.some((k) => k.value === this._v) ? this._v : (this.kids[0] || {}).value || "") : this._v; },
        set value(x) { this._v = String(x); } };
      return o;
    };
    const q$ = (id) => (qel[id] = qel[id] || mkEl(id));
    // الصوتُ المحفوظ والقائمةُ فارغةٌ أوّلَ مرّة (📖 كروم) — و`fetch` لا يُجيب أبداً (شبكةٌ مسدودة) ⇐ لا تنتظره النافذة
    const synth = { list: [], getVoices() { return this.list; }, addEventListener(t, f) { this.on = f; } };
    let engineSrc = "yt", sendHook = null;
    const qctx = { $: q$, dubTabId: 7, dubLast: null, dubPin: null, navigator: { userAgentData: { platform: "macOS" }, userAgent: "Mac" },
      chrome: { storage: { sync: { get: async () => ({ settings: JSON.parse(JSON.stringify(store.settings)) }) } } },
      safeSyncSet: async (o) => { store.settings = JSON.parse(JSON.stringify(o.settings)); return { ok: true }; },
      setStatus: (k, m) => { qctx.lastStatus = m; },
      dubSend: async (m) => {
        sent.push(m);
        if (sendHook) sendHook(m);
        await new Promise((r) => setTimeout(r, qctx.sendDelay || 0));
        if (m.type === "GVZ_DUB_START") engineSrc = m.opts.source;
        return { ok: true, state: "running", source: engineSrc };
      },
      renderDub: () => {}, document: { createElement: () => ({ value: "", textContent: "" }) }, speechSynthesis: synth, globalThis: null,
      fetch: () => new Promise(() => {}), AbortController,
      setTimeout: (f, ms) => { const t = setTimeout(f, ms); if (t && t.unref) t.unref(); return t; }, clearTimeout };
    qctx.globalThis = qctx;
    vm.createContext(qctx);
    vm.runInContext([grab("DUB_PREF_DEFAULT").replace(/^const /, "var "), SRCP.match(/const DUB_AZ_FALLBACK = \[[\s\S]*?\];/)[0].replace(/^const /, "var "),
      SRCP.match(/const DUB_AZ_REGION = [^\n]*/)[0].replace(/^const /, "var "), "var dubSaveErr = \"\", dubRestartTo = \"\", dubAzVoices = null, dubAzVoicesFor = \"\";",
      "var dubPrefChain = Promise.resolve();",
      fnP("dubPlatform"), fnP("dubAzRegionOf"), fnP("dubOptsFrom"), fnA("dubPrefs"), fnA("saveDubPrefs"), fnP("onDubPrefChange"), fnA("onDubPrefChangeRun"),
      fnP("fillDubVoices"), fnA("dubAzVoiceList"), fnP("fillDubAzOptions"), fnA("fillDubAzVoiceSelect"), fnA("fillDubPrefsUI"), fnA("loadDubPrefsUI")].join("\n"), qctx);
    const set = (o) => Object.entries(o).forEach(([k, v]) => { const x = q$(k); if (typeof v === "boolean") x.checked = v; else x.value = v; });
    set({ dubSource: "yt", dubEngine: "azure", dubVoice: "Laila", dubRate: "auto", dubVolume: "80", dubWait: true, dubAzKey: "abcDEF0123456789abcdef0123456789",
      dubAzRegion: "uaenorth", dubAzTrKey: "", dubAzTrRegion: "uaenorth" });
    q$("dubVoice").dataset.engine = "system";                                    // قائمةُ الجهاز معروضةٌ والمحرّكُ Azure (سباقُ #17)
    qctx.dubLast = { ok: true, state: "running", source: "yt" };
    q$("dubSource").value = "azure";
    await qctx.onDubPrefChange({ target: { id: "dubSource" } });
    const m1 = sent[sent.length - 1] || {};
    check("[٩] ⭐ تبديلُ المصدر والدبلجةُ تعمل ⇐ «دبلِج» من جديد بالمصدر المختار — ⛔ ~~«GVZ_DUB_SET» يُبقي القديم~~", m1.type === "GVZ_DUB_START" && m1.opts.source === "azure" && m1.opts.wait === true, m1);
    check("[٩] ⭐ وصوتُ الجهاز المعروض لا يُكتب صوتاً لـAzure (168ح #17)", store.settings.dub.azure.voice === "ar-SA-HamedNeural" && !store.settings.dub.voice.macOS, store.settings.dub);
    qctx.dubLast = { ok: true, state: "running", source: "azure" };
    q$("dubVolume").value = "50";
    await qctx.onDubPrefChange({ target: { id: "dubVolume" } });
    check("[٩] وتغييرُ الحجم ⇐ «GVZ_DUB_SET» لا إعادة بدء", sent[sent.length - 1].type === "GVZ_DUB_SET" && sent[sent.length - 1].opts.volume === 0.5, sent[sent.length - 1]);
    const n0 = sent.length, before = JSON.stringify(store.settings);
    q$("dubAzRegion").value = "attacker.example/x#";
    const bad = await qctx.saveDubPrefs(false, true);                       // حفظُ حقول Azure (حقلٌ منها أو «احفظ واختبر»)
    check("[٩] ⛔ منطقةٌ برابطٍ ⇐ لا حفظَ ولا إرسالَ، ويُقال لماذا (168ح #15)", bad === null && JSON.stringify(store.settings) === before && sent.length === n0 && /منطقة Azure لا تصلح/.test(qctx.lastStatus), qctx.lastStatus);
    q$("dubAzRegion").value = "West Europe";
    const ok = await qctx.saveDubPrefs(false, true);
    check("[٩] ومنطقةٌ كما تُكتب في البوّابة («West Europe») ⇐ تُطبَّع «westeurope»", ok && store.settings.dub.azure.region === "westeurope", ok && ok.azure);

    // ⭐ مراجعةُ الجولة #7: حقلُ Azure مكتوبٌ خطأً لا يمنع ضابطاً آخر — «الانتظار» يُحفظ ويُرسل
    q$("dubAzRegion").value = "uae-north";
    q$("dubWait").checked = false;
    const n1 = sent.length;
    await qctx.onDubPrefChange({ target: { id: "dubWait" } });
    check("[٩] ⭐ منطقةُ Azure مكتوبةٌ خطأً ثمّ أُزيل «الانتظار» ⇐ حُفظ وأُرسل — ⛔ ~~لا حفظَ ولا إرسالَ صامتاً~~",
      store.settings.dub.wait === false && sent.length === n1 + 1 && sent[sent.length - 1].opts.wait === false && store.settings.dub.azure.region === "westeurope",
      { wait: store.settings.dub.wait, sent: sent.length - n1, region: store.settings.dub.azure.region });
    q$("dubAzRegion").value = "westeurope";

    // ⭐ مراجعةُ الجولة #1: تغييران سريعان للمصدر — الثاني بعد أن أُرسل الأوّلُ ولم يصل ردُّه ⇒ تنتهي الدبلجةُ على ما اختير أخيراً
    engineSrc = "yt"; qctx.dubLast = { ok: true, state: "running", source: "yt" }; qctx.sendDelay = 40;
    let firstSent;
    const sentP = new Promise((r) => { firstSent = r; });
    sendHook = () => { sendHook = null; firstSent(); };
    q$("dubSource").value = "device";
    const c1 = qctx.onDubPrefChange({ target: { id: "dubSource" } });
    await sentP;
    q$("dubSource").value = "yt";
    const c2 = qctx.onDubPrefChange({ target: { id: "dubSource" } });
    await c1; await c2;
    qctx.sendDelay = 0;
    check("[٩] ⭐ «جهاز» ثمّ «يوتيوب» سريعاً ⇐ الدبلجةُ على «يوتيوب» كالمختار — ⛔ ~~على «جهاز» والمختارُ «يوتيوب»~~",
      engineSrc === "yt" && store.settings.dub.source === "yt", { engine: engineSrc, stored: store.settings.dub.source, sent: sent.slice(-2).map((m) => m.type + ":" + m.opts.source) });

    // ⭐ مراجعةُ الجولة #3: قائمةُ أصوات الجهاز فارغةٌ أوّلَ فتح ⇐ ⛔ ~~«تلقائي» يُحفظ فوق الصوت المحفوظ عند أوّل تغيير~~
    store.settings.dub = Object.assign({}, store.settings.dub, { engine: "system", voice: { macOS: "com.apple.voice.Majed" } });
    synth.list = [];
    await qctx.loadDubPrefsUI();
    q$("dubVolume").value = "70";
    await qctx.onDubPrefChange({ target: { id: "dubVolume" } });
    check("[٩] ⭐ القائمةُ لم تُحمَّل وتغيّر الحجم ⇐ الصوتُ المحفوظ باقٍ — ⛔ ~~صار «تلقائي»~~", store.settings.dub.voice.macOS === "com.apple.voice.Majed" &&
      store.settings.dub.volume === 70, store.settings.dub.voice);
    synth.list = [{ lang: "ar-001", name: "Majed", voiceURI: "com.apple.voice.Majed", localService: true }, { lang: "ar-001", name: "Laila", voiceURI: "Laila", localService: true }];
    await synth.on();
    check("[٩] وحين تُحمَّل القائمةُ يُعرض المحفوظ", q$("dubVoice").value === "com.apple.voice.Majed" && q$("dubVoice").dataset.loaded === "1", q$("dubVoice").value);

    // ⭐ مراجعةُ الجولة #2: محرّكُ Azure بمفتاح وشبكةٌ لا تُجيب ⇐ النافذةُ لا تنتظرها، والصوتُ المحفوظ معروضٌ فوراً
    store.settings.dub = Object.assign({}, store.settings.dub, { engine: "azure", azure: { key: "abcDEF0123456789abcdef0123456789", region: "uaenorth", voice: "ar-SA-ZariyahNeural", trKey: "", trRegion: "uaenorth" } });
    const raced = await Promise.race([qctx.fillDubPrefsUI().then(() => "done"), new Promise((r) => setTimeout(() => r("waiting"), 800))]);
    check("[٩] ⭐ شبكةُ Azure مسدودة ⇐ تجهزُ النافذةُ فوراً بالصوت المحفوظ — ⛔ ~~تنتظر فلا يُستمع لأيّ ضابط~~", raced === "done" &&
      q$("dubVoice").value === "ar-SA-ZariyahNeural" && q$("dubVoice").dataset.engine === "azure", { raced, voice: q$("dubVoice").value });
  }

  console.log(`\n${fail ? "❌" : "✅"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("  ❌ الحارسُ رمى: " + (e && e.stack || e)); console.log(`\n❌ نجح ${pass} / فشل ${fail + 1}\n`); process.exit(1); });
