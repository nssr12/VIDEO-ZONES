// البند #72 — زرّ السرعة في طبقتنا: ملكيةُ الحدث بعلامة بنيوية، وأمرٌ لا كتابة
//
// **الطبقة لا الحقن (قرار المالك):** قائمة محدِّدات المضيف هي ما قضينا الجلسة
// نزيله — `multicam` مات (#66)، والتضمين هجر `ytp-` كلّها (#68)، و`S7` أثبت أن
// **11 من 59** لم يعد يطابق. **فالحقن يشتري «يبدو أصيلاً» بعملةٍ نعرف أنها تموت.**
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
  check("[1] ولا محدِّد `ytp-` في مسار الزرّ", !!feat && !/ytp-/.test(feat), feat);
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
  check("[3] وعنصرٌ واحد يحملها اليوم", n === 1, `العدد ${n}`);
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
  check("[7] ومواضع النداء سبعة (ستّةٌ قديمة + مسار السكون)", n === 7, `العدد ${n}`);
}

// ── [4] المؤشّر فوق زرّنا = نشاط ──────────────────────────────────────────
console.log("\n[4] التحويم فوق الزرّ نشاطٌ — وإلا اختفى من تحت الفأرة");
{
  const fn = body("function pointerInsidePlayer(e)");
  check("[4] `pointerInsidePlayer` تعدّ طبقتنا من المشغّل",
    !!fn && /closest\?\.\(".vzWrap"\)/.test(fn), fn);
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
    const btn = { textContent: "", classList: { toggle() {} } };
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

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
