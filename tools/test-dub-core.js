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

const CONSTS = ["DUB_LEAD_S", "DUB_LATE_MAX_S", "DUB_REMAIN_MIN", "DUB_SEG_GAP_A", "DUB_SEG_CAP_A", "DUB_SEG_GAP_M",
  "DUB_SEG_CAP_M", "DUB_SEG_END_PAD", "DUB_CURVE_MAC", "DUB_R_MAX", "DUB_RATE_CAP", "DUB_AUTO_MAX", "DUB_CPS", "DUB_BRIDGE_MAX"];
const FNS = ["dubPrim", "dubXtDecode", "dubAudioNorm", "dubCapNorm", "dubDecide", "dubSegment", "dubRealSpeed",
  "dubChromeRate", "dubFirstAt", "dubNext", "dubPickVoice", "dubMainCall", "dubYtSource", "dubDisplayNext", "dubCaptionLines"];

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
  console.log("\n[٤] قرارُ النبضة: الموعد · التخطّي (خ13 بقيمتيه الجديدتين) · الترجمةُ المنتظرة · سقفُ التلقائيّة");
  {
    const S = (start, win, ar) => ({ start, win, ar });
    const N = (sents, ct, rate) => ctx.dubNext(sents, 0, ct, rate || 1, ctx.DUB_CPS, ctx.DUB_AUTO_MAX, ctx.DUB_CURVE_MAC);
    check("[٤] الثوابتُ كما سُحبت إليه: ثانيتان · 30٪ · سقفُ التلقائيّة 1.4 دون R_max", ctx.DUB_LATE_MAX_S === 2 && ctx.DUB_REMAIN_MIN === 0.3 && ctx.DUB_AUTO_MAX === 1.4 && ctx.DUB_AUTO_MAX < ctx.DUB_R_MAX);
    check("[٤] قبل الموعد ⇐ انتظار", N([S(10000, 3000, "مرحبا")], 9.5).wait === "early");
    const go = N([S(10000, 3000, "مرحبا")], 9.95);
    check("[٤] في الموعد (بسبقٍ 0.1 ث) ⇐ تُنطق بسرعة 1", go.speak && go.rate === 1, go);
    check("[٤] بدءٌ متأخّرٌ أكثرَ من ثانيتين ⇐ تُتخطّى", N([S(10000, 5000, "مرحبا")], 12.2).skipped === 1);
    check("[٤] ومتأخّرٌ ثانيةً ونصفاً ⇐ تُنطق (تأخّرٌ يتراكم ولا تُقطع الحكاية)", N([S(10000, 5000, "مرحبا")], 11.5).speak === true);
    check("[٤] بقي أقلُّ من 30٪ من نافذتها ⇐ تُتخطّى", N([S(10000, 1000, "مرحبا")], 10.75).skipped === 1);
    const two = N([S(10000, 1000, "أ"), S(11000, 3000, "ب")], 10.85);   // الأولى بقي منها 15٪ · والثانية بعد 0.15 ث (السبقُ 0.1)
    check("[٤] وتُتخطّى إلى التي بعدها لا تُنسى", two.skipped === 1 && two.i === 1 && two.wait === "early", two);
    check("[٤] ترجمةٌ لم تصل ⇐ انتظار لا تخطٍّ", N([S(10000, 3000, null)], 10).wait === "translate");
    check("[٤] ترجمةٌ فشلت (فارغة) ⇐ تُتخطّى", N([S(10000, 3000, "")], 10).skipped === 1);
    const long = N([S(10000, 1000, "ب".repeat(60))], 10);
    check("[٤] جملةٌ لا تتّسع ⇐ بسقف التلقائيّة 1.4 لا بـR_max", long.real === ctx.DUB_AUTO_MAX && Math.abs(long.rate - ctx.dubChromeRate(1.4)) < 1e-9, long);
    const capR = ctx.dubNext([S(10000, 1000, "ب".repeat(60))], 0, 10, 1, ctx.DUB_CPS, ctx.DUB_R_MAX, ctx.DUB_CURVE_MAC);
    check("[٤] وبـR_max سقفاً ⇐ كروم 2 لا أكثر (السقفُ المطلق)", capR.real === ctx.DUB_R_MAX && capR.rate === ctx.DUB_RATE_CAP, capR);
    const slow = N([S(10000, 2000, "ب".repeat(16))], 10, 1), fast = N([S(10000, 2000, "ب".repeat(16))], 10, 1.5);
    check("[٤] سرعةُ الفيديو تقصّر النافذة ⇐ سرعةٌ أعلى", fast.need > slow.need * 1.49 && fast.need < slow.need * 1.51, [slow.need, fast.need]);
    check("[٤] انتهت الجمل ⇐ done", N([S(1000, 1000, "أ")], 30).done === true);
    const fx = ctx.dubNext([S(10000, 1000, "ب".repeat(60))], 0, 10, 1, ctx.DUB_CPS, ctx.DUB_R_MAX, ctx.DUB_CURVE_MAC, 1.25);
    check("[٤] سرعةٌ يختارها المستخدم ⇐ تُنطق بها، والتخطّي بقاعدتيه", fx.speak && fx.rate === 1.25, fx);
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
    check("[٧] لا مستمعَ إلا للصوت والتنزيل والجسر — ولا حدثَ وسائط (خ16)",
      evs.length > 0 && evs.every((x) => ["voiceschanged", "downloadprogress", "__vz_dub_res__"].includes(x)), evs);
    const tick = fn("dubTick"), why = fn("dubWhy");
    const o1 = ["chrome.runtime?.id", "extensionActive()", "isInMiniPlayer(", "dubVideoId() !== run.vid"].map((s) => why.indexOf(s));
    const o2 = ["dubWhy(run)", "ad-showing", "v.paused", "DUB_FREEZE_MS", "DUB_R_MAX", "DUB_SEEK_S", "dubNext("].map((s) => tick.indexOf(s));
    check("[٧] ترتيبُ النبضة (§٣): يتيم · بوّابة · مصغّر · تنقّل (`dubWhy`) ثمّ إعلان · توقّف · تجمّد · سرعة · قفزة · ثمّ الجملة",
      [o1, o2].every((o) => o.every((x, i) => x > 0 && (i === 0 || x > o[i - 1]))), { o1, o2 });
    check("[٧] وشروطُ الإيقاف نفسُها أثناء التجهيز (مراجعة #12)", /const why = dubWhy\(run\);/.test(fn("dubPrepare")));
    check("[٧] جملةٌ واحدةٌ منّا في الطابور · ولا بدءَ والمشغّلُ يقفز (مراجعة #7)", /if \(run\.cur \|\| v\.seeking\) return;/.test(tick));
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
    vm.runInContext(["DUB_REASON_TEXT", "DUB_STEP_TEXT", "DUB_HOLD_TEXT", "DUB_STOP_TEXT", "DUB_KIND_TEXT"].map(grab).join("\n").replace(/^const /gm, "var ") + "\n" + fnP("renderDub"), pctx);
    const R = (st, source) => { el("dubSource").value = source || "yt"; pctx.renderDub(st); return { note: el("dubNote").textContent, bad: el("dubNote").classList.has("bad"), btn: el("dubBtn").textContent, off: el("dubBtn").disabled }; };
    const run = (x) => Object.assign({ ok: true, state: "running", hold: "", kind: "display", idx: 3, total: 0, spoken: 2, skipped: 1, lost: 0, warm: true, source: "yt" }, x || {});
    let r = R(run());
    check("[٩] يعمل بوضع العرض ⇐ «يُدبلج» والزرُّ «أوقف» — لا «⛔»", /^يُدبلج/.test(r.note) && !r.bad && r.btn === "أوقف الدبلجة" && !/⛔/.test(r.note), r);
    check("[٩] ووضعُ العرض بلا «الجملة X من Y»", !/الجملة/.test(r.note), r.note);
    r = R(run({ kind: "asr", total: 40 }), "device");
    check("[٩] ووضعُ الجمل بها", /الجملة 3 من 40/.test(r.note), r.note);
    r = R(run(), "device");
    check("[٩] مصدرٌ تغيّر والدبلجةُ تعمل ⇐ يُقال في كلّ رسم (مراجعة 2 #12)", /المصدرُ الجديد من الضغطة التالية/.test(r.note) && !r.bad, r.note);
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
  }

  console.log(`\n${fail ? "❌" : "✅"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("  ❌ الحارسُ رمى: " + (e && e.stack || e)); console.log(`\n❌ نجح ${pass} / فشل ${fail + 1}\n`); process.exit(1); });
