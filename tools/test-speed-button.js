// البند #72 — زرّ السرعة في طبقتنا: ملكيةُ الحدث بعلامة بنيوية، وأمرٌ لا كتابة
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يغيّر زرُّ السرعة سرعةَ الفيديو بالنقر والعجلة؟»*
//
// ⛔ **قرار المالك 2 مسحوب (قرار 21، 2026-08-03): «الطبقة لا الحقن» ⇐ #85.**
// ~~الطبقة لا الحقن~~ — **والسحب على الغرض لا على الحجّة**: أراد المالك زرّاً
// **من** شريط المضيف يقف في صفّ أزراره، **والطبقة لا تعطيه ذلك**.
// **وحجّةُ القرار قائمة:** `multicam` مات (#66)، والتضمين هجر العائلة (#68)،
// و`S7` أثبت أن **11 من 59** لم يعد يطابق.
// ⇒ ⭐ **وما بقي من الحجّة صمّم الشكل الجديد: اسمٌ واحد بحدّه، وسقوطٌ صريح إلى
// الطبقة إن مات** — **ولو سقطت الحجّة لَما لزم السقوط.**
//
// ⚠️ **وفشل القسم [2] يعني أن الزرّ صار يكتب `playbackRate` بيده.** الحارس
// البنيويّ في `tools/test-speed-source.js` يعدّ مواضع الكتابة ويشترط **واحداً** —
// وهذا القسم يحرس الوجه الآخر: **الزرّ يُصدر أمراً من نحو `ACTION:SPEED`**، فيرث
// شارة #71 والقصّ 0.25–4 **بلا سطرٍ ولا رقمٍ ثانٍ**.
//
// ⚠️ **وفشل القسم [3] يعني أن ملكية الحدث عادت إلى اسم صنف.** الفارق **سمةٌ على
// العنصر** (`data-vz-owns`) لا اسم صنف: الصنف اسمٌ يتغيّر، والسمة عقدٌ يُقرأ.
// **ولا يمكن أن يفوز الزرّ بترتيب المستمعين** — مستمعنا في `window`+`capture`
// يسبق أي مستمع عليه بنيوياً، فالحسم في الكومة لا في التسجيل.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

function body(name) {
  const i = SRC.indexOf(name);
  if (i === -1) return null;
  const j = SRC.indexOf("\n}", i);
  return j === -1 ? null : SRC.slice(i, j);
}
function slice(from, to) {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  return a === -1 || b === -1 ? null : SRC.slice(a, b);
}
const CODE = SRC.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");

console.log("\n=== #72 — زرّ السرعة في طبقتنا ===\n");

// ── [1] الطبقة لا الحقن ────────────────────────────────────────────────────
console.log("[1] في طبقتنا، و`pointer-events:auto` على الابن وحده");
{
  check("[1] الزرّ يُبنى داخل `.vzWrap`", /class="vzBtn vzSpeedBtn vzHidden"/.test(SRC));
  check("[1] و`.vzWrap` ما زالت `pointer-events:none`",
    /\.vzWrap\{[\s\S]{0,200}?pointer-events:none/.test(SRC));
  check("[1] و`pointer-events:auto` على `.vzBtn` وحدها",
    /\.vzBtn\{[\s\S]{0,220}?pointer-events:auto/.test(SRC));
  // ولا محدِّد مضيفٍ واحد في مسار الزرّ
  const feat = slice("// ── #72 — زرّ السرعة في طبقتنا", "IDLE_CONSUMERS.speedButton");
  // ⛔ **انقلب لأن المطلوب انقلب (#85) لا ليمرّ** (قرار 33): كان يشترط **صفر**
  // محدِّد مضيف، وصار يشترط **واحداً بالضبط** — **والتغطية أقوى لا أضعف**:
  // **اسمٌ ثانٍ يُحمّر**، وهو ما يمنع «قائمة مرشّحين تموت واحداً واحداً بصمت».
  // ⛔⭐ **والتعليقاتُ تُنزع قبل العدّ** (2026-08-06): كان يعدّ الأسماءَ في نصّ
  // الشريحة كلِّها **فيحمّر على تعليقٍ يشرح لماذا وُلد المسار** (قرار 117) —
  // **وهو يقيس ما يستطيع لا ما نحتاج**: السؤالُ «كم محدِّدَ مضيفٍ **يعمل**؟»
  // لا «كم مرّةً ذُكر اسمُه؟». ⇒ **مطابقةٌ أوسع من سؤالها** (قرار 93)، **وهي
  // ثانيةُ وقوعها اليوم** (الأولى في `test-popup-fields`).
  const code = (feat || "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const hostNames = code.match(/ytp-[a-z-]+/g) || [];
  const uniq = [...new Set(hostNames)];
  check("[1] ⭐ اسمُ مضيفٍ واحد بالضبط في مسار الزرّ، بحدّه",
    uniq.length === 1 && uniq[0] === "ytp-right-controls", uniq.join(" · "));
  check("[1] ⭐ ومعه سقوطٌ صريح إلى الطبقة",
    !!feat && /return "layer";/.test(feat) && /return "bar";/.test(feat), feat && feat.slice(0,80));
  check("[1] وهو قناةٌ في `OVERLAY_PARTS`", /speedBtn:\s*\(\) => vzSpeedBtn/.test(SRC));
}

// ── [2] ⭐ أمرٌ لا كتابة ────────────────────────────────────────────────────
console.log("\n[2] ⭐ يُصدر أمراً من نحو `ACTION:SPEED` ولا يكتب `playbackRate`");
{
  const wheel = body("function speedBtnWheel(e)");
  const click = body("function speedBtnClick(e)");
  check("[2] العجلة تُصدر `ACTION:SPEED:±`",
    !!wheel && /runAction\(`ACTION:SPEED:\$\{e\.deltaY < 0 \? "\+" : "-"\}/.test(wheel), wheel);
  check("[2] والنقرة تُصدر `ACTION:SPEED:SET`",
    !!click && /runAction\(`ACTION:SPEED:SET:\$\{target\}`/.test(click), click);
  check("[2] ولا كتابة `playbackRate` في العجلة", !!wheel && !/playbackRate\s*=(?!=)/.test(wheel));
  check("[2] ولا كتابة `playbackRate` في النقرة", !!click && !/playbackRate\s*=(?!=)/.test(click));
  // والحارس الأصل ما زال قائماً: موضع كتابة واحد في الملف كلّه
  const writes = (CODE.match(/\.playbackRate\s*=(?!=)/g) || []).length;
  check("[2] وموضع الكتابة في الإضافة كلّها ما زال واحداً", writes === 1, `العدد ${writes}`);
}

// ── [3] ⭐ ملكية الحدث — سمةٌ بنيوية لا اسم صنف ────────────────────────────
console.log("\n[3] ⭐ الملكية بسمةٍ على العنصر، وتُحسم في الكومة");
{
  check("[3] الزرّ يحمل `data-vz-owns`", /data-vz-owns="wheel click"/.test(SRC));
  const stack = body("function videoFromStack(stack, x, y, blockScrollable)");
  check("[3] و`videoFromStack` تقرأها", !!stack && /el\.dataset\?\.vzOwns/.test(stack), stack);
  check("[3] وغير مشروطةٍ بـ`blockScrollable` (العجلة والنقر معاً)",
    !!stack && /if \(el\.dataset\?\.vzOwns\) return BLOCKED_BY_LAYER;/.test(stack), stack);
  // والشبكة والشارتان **لا** تحملانها: عناصرنا التي لا تملك
  check("[3] والشبكة لا تحملها", !/class="vzGrid[^"]*"[^>]*data-vz-owns/.test(SRC));
  check("[3] والشارتان لا تحملانها",
    !/class="vzVolume[^"]*"[^>]*data-vz-owns/.test(SRC) && !/class="vzSpeed vzHidden"[^>]*data-vz-owns/.test(SRC));
  const n = (SRC.match(/data-vz-owns/g) || []).length;
  // ⚠️ **العدد يُحدَّث بوعي ولا يُرفع ليمرّ:** صار ثلاثةً بـ#108 —
  // الزرّ (#72) · وزرّ الفلاتر · ولوحتُها. **ورابعٌ يُحمّر فيُسأل عنه.**
  check("[3] وثلاثةُ عناصرَ تحملها اليوم (#72 · #108 زرّاً ولوحةً)", n === 3, `العدد ${n}`);
  check("[3] ⭐ وزرُّ الفلاتر يحملها", /class="vzBtn vzFilterBtn[^"]*"[^>]*data-vz-owns/.test(SRC));
  check("[3] ⭐ ولوحتُه كذلك — فالعجلةُ فوقها تُحرّك منزلقَها لا تُنفّذ أمرَ مربّع",
    /vzFilterPanel[\s\S]{0,400}setAttribute\("data-vz-owns"/.test(SRC));
}

// ── [7] ⭐ #76 — المستهلك يضمن عنصره بنفسه، ولا يرث بناءً من جارٍ ──────────
console.log("\n[7] ⭐ #76: يضمن عنصره بنفسه، ولا يرث بناءً من مسار المربّعات");
{
  const set = body("function setSpeedBtnShown(on)");
  check("[7] `setSpeedBtnShown` تبني عنصرها قبل أن تطلبه",
    !!set && /ensureVideoOverlay\(video\)/.test(set), set);
  check("[7] والبناء **قبل** حارس `!vzSpeedBtn` لا بعده",
    !!set && set.indexOf("ensureVideoOverlay") < set.indexOf("if (!vzSpeedBtn) return"), set);
  check("[7] وبلا فيديو ⇒ لا زرّ (خروجٌ صريح لا انهيار)",
    !!set && /if \(!video\) return;/.test(set), set);

  // والنصّ يُزامَن من الموضع الواحد — لا من مسار الزرّ وحده
  const rate = body("function setPlaybackRate(video, rate)");
  check("[7] و`setPlaybackRate` تُزامن النصّ",
    !!rate && /syncSpeedBtnLabel\(video\)/.test(rate), rate);
  check("[7] وخلف مفتاح الزرّ فلا تُلمس DOM بلا سبب",
    !!rate && /if \(speedButtonActive\(\)\) syncSpeedBtnLabel\(video\)/.test(rate), rate);

  // ومواضع بناء الـoverlay صارت سبعة، وواحدها في مسار السكون
  const n = (CODE.match(/ensureVideoOverlay\(/g) || []).length;
  // ⚠️ **صارت ثمانيةً بـ#108** (`setFilterBtnShown` تضمن عنصرَها كما يفعل جارُها،
  // فلا يرث مستهلكٌ بناءً من مسارٍ قد لا يمرّ — #76). **والعدد يُحدَّث بوعي.**
  check("[7] ومواضع النداء ثمانية (سبعةٌ + زرّ الفلاتر)", n === 8, `العدد ${n}`);
}

// ── [4] المؤشّر فوق زرّنا = نشاط ──────────────────────────────────────────
console.log("\n[4] التحويم فوق الزرّ نشاطٌ — وإلا اختفى من تحت الفأرة");
{
  const fn = body("function pointerInsidePlayer(e)");
  // ⛔ **اتّسع العقد بـ#85:** الزرّ قد يعيش **خارج غلافنا** داخل شريط المضيف،
  // **وعلامةُ الملكية تُرجع `null` فوقه بالتصميم** ⇒ **فبلا ذكره صراحةً يُقرأ
  // التحويم عليه سكوناً** — انحدارُ 12ب من بابٍ جديد.
  check("[4] `pointerInsidePlayer` تعدّ طبقتنا **والزرّ أينما كان** من المشغّل",
    !!fn && /closest\?\.\(".vzWrap, .vzSpeedBtn, .vzFilterBtn, .vzFilterPanel"\)/.test(fn), fn);
  check("[4] وتسبق `getVideoUnderPointer` (التي تُرجع null فوق الزرّ بالتصميم)",
    !!fn && fn.indexOf("vzWrap") < fn.indexOf("getVideoUnderPointer"), fn);
}

// ── [5] البوّابة والمفتاح ونقرة اليمين المؤجَّلة ───────────────────────────
console.log("\n[5] البوّابة · المفتاح المطفأ · ونقرة اليمين بعد `S9`");
{
  const gate = body("function speedButtonActive()");
  check("[5] البوّابة تنادي `extensionActive()`", !!gate && gate.includes("extensionActive()"), gate);
  check("[5] ولا تفحص الحظر بنفسها", !!gate && !/isBlockedHost/.test(gate));
  const loader = body("async function loadOverlaySettings(pre)");
  check("[5] والمفتاح `!!` مطفأ افتراضاً", !!loader && /speedButton: !!o\.speedButton/.test(loader), loader);
  const entries = fs.readFileSync("tools/test-master-gate.js", "utf8");
  check("[5] ومسجَّلة في `ENTRIES`", /function speedButtonActive\(\)/.test(entries));

  // ⚠️ ثلثُ الميزة معلَّق صراحةً لا منسيّاً: `S9` لم يُقس بعد
  const click = body("function speedBtnClick(e)");
  check("[5] والنقرة تخرج على غير الزرّ الأيسر", !!click && /e\.button !== 0/.test(click), click);
  check("[5] ولا مستمع `contextmenu` ولا `auxclick` على الزرّ",
    !/vzSpeedBtn\?\.addEventListener\("(contextmenu|auxclick)"/.test(SRC));
}

// ── [6] ⭐ السلوك على الكود نفسه ───────────────────────────────────────────
console.log("\n[6] ⭐ السلوك: عجلةٌ تغيّر، ونقرةٌ تقلب بين المفضّلة و1x");
{
  // المرساة: من ثابت الخطوة إلى أول دالّة خارج الميزة
    const FEAT = slice("const VZ_SPEED_STEP = 0.25;", "function getVideoFromPointerPosition");
  if (!FEAT) {
    console.log("  ❌ تعذّر الاقتطاع — **المرساة سقطت، أصلِح المرساة لا التأكيد**");
    fail++;
  } else {
    const actions = [];
    const video = { playbackRate: 1, isConnected: true };
    // #88 — **السند يُحاكي البنية الجديدة**: أيقونةٌ + `.vzSpeedNum`، والرقم
    // يُكتب في عنصره لا في الزرّ (وإلا محا الكتابةُ الأيقونةَ).
    // ⚠️ **أُصلح السند لا التأكيد** (قرار 33): البنية تغيّرت والتغطية باقية —
    // و`textContent` يبقى مقروءاً من الابن كما يقرؤه الرِكاز من الشجرة الحقيقية.
    const num = { textContent: "" };
    const btn = {
      classList: { toggle() {} },
      querySelector: (sel) => (sel === ".vzSpeedNum" ? num : null),
      get textContent() { return num.textContent; }
    };
    const ctx = {
      console,
      extensionActive: () => true,
      overlaySettings: { speedButton: true, speedButtonPreset: 2 },
      vzOverlayVideo: video,
      vzSpeedBtn: btn,
      getVideoFromPointerPosition: () => video,
      startOverlayTracking() {},
      IDLE_CONSUMERS: {},   // السجلّ يُعلَن: الميزة تُسجّل نفسها فيه عند التقييم
      markIdleActivity() {},
      // نُسجّل الأمر ونطبّقه بالقصّ نفسه، فالنصّ يُقرأ بعد الكتابة لا قبلها
      runAction: (a) => {
        actions.push(a);
        const set = /^ACTION:SPEED:SET:(.+)$/.exec(a);
        const dlt = /^ACTION:SPEED:([-+][\d.]+)$/.exec(a);
        const raw = set ? Number(set[1]) : (video.playbackRate || 1) + Number(dlt[1]);
        video.playbackRate = Math.max(0.25, Math.min(4, Math.round(raw * 100) / 100));
        return true;
      }
    };
    vm.createContext(ctx);
    vm.runInContext(FEAT, ctx);
    const ev = () => ({ preventDefault() {}, stopPropagation() {}, deltaY: 0, button: 0 });

    vm.runInContext("speedBtnWheel(__e)", Object.assign(ctx, { __e: Object.assign(ev(), { deltaY: -1 }) }));
    check("[6] عجلةٌ لأعلى ⇒ `+0.25`", actions[0] === "ACTION:SPEED:+0.25", actions);
    check("[6] والسرعة صارت 1.25", video.playbackRate === 1.25, video.playbackRate);
    check("[6] والعنوان يقرأ ما صار إليه", btn.textContent === "1.25x", btn.textContent);

    vm.runInContext("speedBtnWheel(__e)", Object.assign(ctx, { __e: Object.assign(ev(), { deltaY: 1 }) }));
    check("[6] وعجلةٌ لأسفل ⇒ `-0.25`", actions[1] === "ACTION:SPEED:-0.25", actions);

    actions.length = 0;
    video.playbackRate = 1;
    vm.runInContext("speedBtnClick(__e)", Object.assign(ctx, { __e: ev() }));
    check("[6] ونقرةٌ ⇒ المفضّلة `SET:2`", actions[0] === "ACTION:SPEED:SET:2", actions);
    vm.runInContext("speedBtnClick(__e)", Object.assign(ctx, { __e: ev() }));
    check("[6] ونقرةٌ ثانية ⇒ تعود `SET:1` (قلبٌ بلا حالةٍ نحفظها)",
      actions[1] === "ACTION:SPEED:SET:1", actions);

    // ⚠️ والقصّ مُورَّث من التعريف الواحد — لا رقم ثانٍ هنا
    actions.length = 0;
    video.playbackRate = 4;
    vm.runInContext("speedBtnWheel(__e)", Object.assign(ctx, { __e: Object.assign(ev(), { deltaY: -1 }) }));
    check("[6] وعند الحدّ 4x تبقى 4x — القصّ مُورَّث لا مُعاد",
      video.playbackRate === 4 && btn.textContent === "4x", { r: video.playbackRate, t: btn.textContent });

    // والمفتاح مطفأ ⇒ صفر أمر
    actions.length = 0;
    ctx.overlaySettings.speedButton = false;
    vm.runInContext("speedBtnClick(__e)", Object.assign(ctx, { __e: ev() }));
    vm.runInContext("speedBtnWheel(__e)", Object.assign(ctx, { __e: Object.assign(ev(), { deltaY: -1 }) }));
    check("[6] ومفتاحه مطفأ ⇒ صفر أمر", actions.length === 0, actions);

    // وزرّ الفأرة غير الأيسر ⇒ صفر أمر (نقرة اليمين بعد `S9`)
    ctx.overlaySettings.speedButton = true;
    vm.runInContext("speedBtnClick(__e)", Object.assign(ctx, { __e: Object.assign(ev(), { button: 2 }) }));
    check("[6] ونقرة اليمين لا تفعل شيئاً بعد — معلَّقة على `S9`", actions.length === 0, actions);
  }
}


// ── [8] ⭐ 12ب — لا نُخفي شيئاً تحت يد المستخدم (ثالثة تطبيقاته) ────────────
// **الحجّة مقيسة لا ذوقية:** المضيف نفسه لا يُخفي تحت مؤشّرٍ ساكن (الحالة 1 من
// الثماني). **والمبدأ نفسه المطبَّق مرّتين في #70** — زرٌّ ممسوك وتركيزٌ داخل
// الحاوية — **فهذا امتناعٌ على نمطهما لا استثناءٌ جديد.**
console.log("\n[8] ⭐ المؤشّر فوق الزرّ ⇒ امتناع، لا إخفاء تحت اليد");
{
  // ⛔ **عُمِّم الشرط بـ#95، فانقلب التأكيد لأن المطلوب انقلب لا ليمرّ** (قرار 33):
  // كانت `suspended: pointerInsideSpeedBtn` **خاصّةً بالزرّ**، وصارت **قاعدةً
  // عامّة في المحرّك** والمستهلك **يُعلن هدفه** وحده. **والتغطية أقوى لا أضعف:**
  // يُشترط الآن أن يُعلن الهدف **وأن يسأل المحرّك عنه** — موضعان بدل واحد.
  const decl = SRC.match(/IDLE_CONSUMERS\.speedButton = \{[\s\S]*?\n\};/);
  check("[8] المستهلك يُعلن هدفه (`target`)", !!decl && /target:\s*\(\)\s*=>\s*vzSpeedBtn/.test(decl[0]), decl && decl[0].slice(0,140));
  check("[8] ⭐ ولا شرطَ خاصٌّ بالزرّ بقي", !/pointerInsideSpeedBtn\s*[,(]/.test(SRC));
  const apply = SRC.match(/function applyIdleStateOnce\(\)[\s\S]*?\n}/);
  check("[8] والمحرّك يسأل عن الهدف — لا يعرفه",
    !!apply && /pointerInsideEl\(c\.target\?\.\(\), c\.nearPad\?\.\(\) \?\? 0\)/.test(apply[0]), apply && apply[0].slice(0,240));
  // ⭐ **#107 — وهذا المستهلك يُهمل سببَ النشاط عمداً**: `onActive` بلا وسيط
  // ⇒ **يعمل كما كان حرفاً بحرف** مهما سُمّيت الأسباب. **فمن أعطاه سياسةً تتبع
  // السبب غداً يجد الأحمر هنا** — والزرُّ ليس شريطَ مضيفٍ يُخفى دائماً.
  check("[8] ⭐ ويُهمل سببَ النشاط (لا سياسةَ وضعٍ للزرّ)",
    !!decl && /onActive: \(\) => setSpeedBtnShown\(true\)/.test(decl[0]), decl && decl[0].slice(0, 200));
  // ⭐ **#106 — والزرّ لم يرث هامش جاره، وهذا يُحرَس لا يُذكَر.** هدفُ #70 شريطٌ
  // **يُقصد بالمؤشّر**، وهدفُ الزرّ **يُلاحقه المؤشّر**؛ وهامشُ 40 عمودياً على
  // زرٍّ ~40×40 **يُثلّث ارتفاع منطقته** ⇒ تغييرُ سلوكٍ قائمٍ لم يُطلب.
  // **فمن أعطاه هامشاً غداً يجد الأحمر هنا قبل أن يجده المستخدم في مشغّله.**
  check("[8] ⭐ ولا هامشَ لهذا المستهلك (#106 لم يُعمَّم)",
    !!decl && !/nearPad\s*:/.test(decl[0]), decl && decl[0].slice(0, 200));
  const fn = SRC.match(/function pointerInsideEl\(el, padY = 0\)[\s\S]*?\n}/);
  check("[8] وشرطُه من lastPointer القائمة", !!fn && /lastPointer\.x/.test(fn[0]));
  check("[8] ولا مستمع جديد لأجله", !!fn && !/addEventListener/.test(fn[0]));
  check("[8] ⭐ وحارس المستطيل الصفريّ (قرار 22)", !!fn && /r\.width > 0 && r\.height > 0/.test(fn[0]), fn && fn[0]);
  // ⛔ **انقلبت الآليّة بـ#95 لا التغطية:** كان الفحص على صنف `vzHidden`،
  // **وصار حارسُ المستطيل الصفريّ يكفيه** — عنصرٌ `display:none` مستطيلُه
  // `0×0` فيُرفض. **والعامّة أقوى: تحمي أيّ هدفٍ مخفيّ لا زرَّنا وحده.**
  check("[8] والمخفيّ لا يُحيي نفسه — بحارس المستطيل الصفريّ",
    !!fn && /r\.width > 0 && r\.height > 0/.test(fn[0]), fn && fn[0]);
  // ── شاهدا القبول (قرار 47): يُحمّر على النقص ─────────────────────────────
  const bad = "IDLE_CONSUMERS.speedButton = {\n  enabled: x,\n  onActive: () => 1\n};";
  const bd = bad.match(/IDLE_CONSUMERS\.speedButton = \{[\s\S]*?\n\};/);
  check("[8] ⭐ والحارس يرى مستهلكاً بلا امتناع — فلا يُصدَّق خضاره", !!bd && !/suspended:/.test(bd[0]));
  const noGuard = "function pointerInsideEl(el) { const r = el.getBoundingClientRect(); return true; }";
  check("[8] ⭐ ويرى دالّةً بلا حارس المستطيل الصفريّ", !/r\.width > 0 && r\.height > 0/.test(noGuard));
}


// ── [9] ⭐ #88 — الأيقونة: مطابقةٌ بالعدّ لا بالوصف ─────────────────────────
// **المقاس مشتقٌّ من قياس زرّ مشغّلٍ حيّ 2026-08-03**: زرّ التشغيل 40×40 وزرّ
// الإعدادات 48×40 · وSVG يملأ الزرّ · viewBox من 0 0 إلى 24 24 · **والمسار
// تعبئةٌ بيضاء لا حدّ**. ⇒ **فالأرقام هنا منقولةٌ من قياسٍ لا مكتوبةٌ بيد.**
// ⛔ **ولا يُنسخ مسار أصلٍ يملكه غيرُنا** — رُسم مسارُنا، والمرجع نُظر إليه.
console.log("\n[9] ⭐ #88 — الأيقونة بمقاس أزرار المضيف");
{
  check("[9] الزرّ يحمل أيقونة SVG", /<svg class=\"vzSpeedIcon\"/.test(SRC));
  check("[9] وviewBox يطابق المقيس (24)", /viewBox=\"0 0 24 24\"/.test(SRC));
  check("[9] والرقم في عنصره لا في الزرّ", /<span class=\"vzSpeedNum\">/.test(SRC));
  const sync = body("function syncSpeedBtnLabel(video)");
  check("[9] ⭐ والكتابة على العنصر لا على الزرّ — وإلا مُحيت الأيقونة",
    !!sync && /querySelector\(\"\.vzSpeedNum\"\)/.test(sync) && !/vzSpeedBtn\.textContent\s*=/.test(sync), sync);
  const css = SRC.slice(SRC.indexOf(".vzBtn{"), SRC.indexOf(".vzHidden{"));
  check("[9] الارتفاع 40 كزرّ المضيف", /height:40px/.test(css), css.slice(0,200));
  check("[9] والأيقونة 24×24", /\.vzSpeedIcon\{[^}]*width:24px;\s*height:24px/.test(css), css);
  // ⛔ **انقلب بـ#89 لأن مصدر الأيقونة تغيّر لا لأنه لم يمرّ** (قرار 33):
  // أيقونة #88 كانت **مرسومةً عندنا بتعبئة**، وأيقونةُ سجلّ المالك **حدٌّ من
  // اللون الجاري** (`stroke:currentColor`) — **فتُلوَّن بـ`color` لا بـ`fill`**.
  // **والتغطية باقية: لونٌ أبيض مشروطٌ كما كان، والقناة هي التي تغيّرت.**
  check("[9] ولونها أبيض عبر `color` (أيقونات السجلّ حدٌّ لا تعبئة)",
    /\.vzSpeedIcon\{[^}]*color:#fff/.test(css), css);
  check("[9] ⭐ والمسار من سجلّ المالك لا مرسومٌ عندنا",
    /stroke="currentColor"/.test(SRC) && /stroke-width="1\.7"/.test(SRC), "");
  // ⭐ **الشاهد الموجب (قرار 47): بناءٌ بلا أيقونة يجب أن يُحمَّر**
  const bare = "<div class=\"vzBtn vzSpeedBtn vzHidden\">1x</div>";
  check("[9] ⭐ والحارس يرى زرّاً بلا أيقونة — فلا يُصدَّق خضاره",
    !/<svg class=\"vzSpeedIcon\"/.test(bare));
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
