// البند #60 — كومِت الإطار: سجلّ المحوّلات والتحقّق والسقوط، **بصفر محوّل**.
//
// **شرط قبول هذا الكومِت واحد: صفر تغيّر سلوكي.** فأكثر هذا الملف يبرهن أن
// المسار الحالي **كما هو حرفياً** ما دام السجلّ فارغاً — لا أن المحوّلات تعمل،
// فلا محوّل بعد.
//
// ⚠️ **القسم [6] حارس دائم يعدّ الأحداث المُرسَلة ويُفشل الاختبار إن تجاوزت
// المتوقَّع.** مصدره حادثة **923,627** حدث `keydown` بعد إرسال حدثين، رُئيت مرة
// ولم تُفسَّر (`AUDIT.md` §9). **غير مفسَّرة لا تعني غير محروسة**، والمتوقَّع في
// هذا الكومِت **صفر** لأن الإطار لا يُرسل حدثاً أصلاً.
//
// ⚠️ وفشل القسم [2] يعني أن **الواجهة النسبية اتّسعت** — أي أن ضبطاً مطلقاً
// تسلّل إلى المحوّلات. راجع قرار 25 قبل «إصلاح» الاختبار.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  return a === -1 || b === -1 ? null : t.slice(a, b);
}

const CONTENT = fs.readFileSync("content.js", "utf8");
const ADAPTER = slice("content.js", "// ── البند #60 · قرار المالك 25", "function runAction");
const VOL = slice("content.js", "// Volume delta in percent", "// Speed: SET absolute value");
const MUTE = slice("content.js", "// Mute\n  if (action === \"ACTION:TOGGLE_MUTE\")", "// PiP");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ---------------------------------------------------------------- العالم
// ساعة مُدارة: المهل تُشغَّل يدوياً كي يُقاس **متى** يقع السقوط لا أن يُنتظر.
function makeWorld(host = "example.com") {
  const timers = [];
  const logs = [];
  const indicator = [];
  const dispatched = []; // عدّاد الأحداث المُرسَلة — حارس القسم [6]
  const ctx = {
    console: { debug: (...a) => logs.push(a.join(" ")), log() {}, warn() {} },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    location: { host },
    baseDomain: (h) => h,
    showVolumeIndicator: (v) => indicator.push({ volume: v.volume, muted: v.muted }),
    __dispatched: dispatched
  };
  vm.createContext(ctx);
  vm.runInContext(`${ADAPTER}
    function runVolume(action, v) {
      const e = {}; const findVideoLoose = () => v;
      ${VOL}
      return false;
    }
    function runMute(v) {
      const action = "ACTION:TOGGLE_MUTE";
      const e = {}; const findVideoLoose = () => v;
      ${MUTE}
      return false;
    }`, ctx);
  return {
    ctx, timers, logs, indicator, dispatched,
    tick: () => { const t = timers.splice(0); for (const x of t) x.fn(); },
    vol: (a, v) => vm.runInContext("runVolume", ctx)(a, v),
    mute: (v) => vm.runInContext("runMute", ctx)(v),
    register: (domain, adapter) => {
      ctx.__ad = adapter;
      vm.runInContext(`hostAdapters.set(${JSON.stringify(domain)}, __ad)`, ctx);
    }
  };
}

console.log("\n[1] السجلّ افتراضه **لا محوّل** — وهذا الكومِت لا يسجّل واحداً");
{
  const w = makeWorld();
  check("السجلّ فارغ عند التحميل", vm.runInContext("hostAdapters.size", w.ctx) === 0);
  check("ولا محوّل لأي مضيف", vm.runInContext("hostAdapterFor()", w.ctx) === null);
  for (const h of ["youtube.com", "twitch.tv", "vimeo.com", "d.tube"]) {
    const x = makeWorld(h);
    check(`ولا محوّل على ${h}`, vm.runInContext("hostAdapterFor()", x.ctx) === null);
  }
  check("ولا استدعاء لـ registerHostAdapter في الملف كله",
    !/hostAdapters\.set\(/.test(CONTENT), (CONTENT.match(/hostAdapters\.set\([^)]*\)/g) || []).join(" · "));
}

console.log("\n[2] الواجهة **نسبية فقط** — لا ضبط مطلق، وهذا قيد بنيوي لا تفصيل");
{
  const w = makeWorld();
  const ops = vm.runInContext("ADAPTER_OPS", w.ctx);
  check("العمليات ثلاث بالضبط", ops.length === 3, ops);
  check("وهي stepUp · stepDown · toggleMute",
    ops.join(",") === "stepUp,stepDown,toggleMute", ops);
  check("ولا عملية ضبط مطلق في الإطار",
    !/\bsetVolume\b|\bsetLevel\b|\bsetAbsolute\b|"set"/.test(ADAPTER));
  check("والعملية تُختار بإشارة الدلتا وحدها",
    /delta > 0 \? "stepUp" : "stepDown"/.test(VOL));
}

console.log("\n[3] بلا محوّل: المسار المباشر **متزامن** ومطابق لما قبل الإطار");
{
  const w = makeWorld();
  const v = { muted: true, volume: 0.5 };
  w.vol("ACTION:VOLUME:+4", v);
  check("طُبِّق فوراً بلا انتظار مهلة", w.timers.length === 0);
  check("فُكّ الكتم والمستوى 0.54", v.muted === false && near(v.volume, 0.54), v);
  const d = { muted: true, volume: 0.5 };
  w.vol("ACTION:VOLUME:-4", d);
  check("والخفض على مكتوم: باقٍ مكتوماً و0.46",
    d.muted === true && near(d.volume, 0.46), d);
  const z = { muted: false, volume: 0.02 };
  w.vol("ACTION:VOLUME:-4", z);
  check("والقصّ 0.0001 كما هو", z.volume === 0.0001, z.volume);
  const m = { muted: false, volume: 0.5 };
  w.mute(m);
  check("والكتم قلبٌ فوريّ", m.muted === true && w.timers.length === 0);
  check("والشارة نوديت في كل عملية", w.indicator.length === 4, w.indicator.length);
  check("ولا سطر سجلّ في المسار المباشر", w.logs.length === 0, w.logs);
}

console.log("\n[4] محوّل **صامت** ⇒ تحقّق بعديّ ثم سقوط إلى الكتابة المباشرة");
{
  const w = makeWorld("youtube.com");
  let calls = 0;
  w.register("youtube.com", { stepUp: () => { calls++; } }); // لا يفعل شيئاً
  const v = { muted: false, volume: 0.5 };
  w.vol("ACTION:VOLUME:+4", v);
  check("نودي المحوّل", calls === 1);
  check("ولم تقع الكتابة المباشرة فوراً", near(v.volume, 0.5), v.volume);
  check("وحُجزت مهلة تحقّق قصيرة",
    w.timers.length === 1 && w.timers[0].ms === vm.runInContext("ADAPTER_VERIFY_MS", w.ctx),
    w.timers[0]?.ms);
  w.tick();
  check("وبعد المهلة سقط إلى الكتابة المباشرة: 0.54", near(v.volume, 0.54), v.volume);
  // ⚠️ حارس ضدّ عودة عَرَض #35 من باب المحوّل: لا نداء **متزامن** للشارة حين
  // يتولّى المحوّل، لأنه كان سيعرض القيمة **قبل** التغيير. مرة واحدة، بعد التحقّق.
  check("والشارة نوديت **مرة واحدة فقط**، بعد السقوط، بالقيمة النهائية",
    w.indicator.length === 1 && near(w.indicator[0].volume, 0.54), w.indicator);
  check("وسُجّل السقوط", w.logs.some((l) => /السقوط إلى الكتابة المباشرة/.test(l)), w.logs);
}

console.log("\n[5] محوّل **ناجح** ⇒ لا سقوط ولا كتابة مباشرة");
{
  const w = makeWorld("youtube.com");
  w.register("youtube.com", { stepUp: (v) => { v.volume = 0.7; } }); // المضيف تولّاها
  const v = { muted: false, volume: 0.5 };
  w.vol("ACTION:VOLUME:+4", v);
  w.tick();
  check("بقي ما فعله المحوّل ولم تُضف دلتانا فوقه", near(v.volume, 0.7), v.volume);
  check("ولا سطر سقوط", !w.logs.length, w.logs);
  check("والشارة قرأت الحالة الحيّة 0.7",
    w.indicator.at(-1) && near(w.indicator.at(-1).volume, 0.7), w.indicator);

  // ومحوّل يرفض صراحةً بـ false ⇒ المسار المباشر فوراً بلا مهلة
  const w2 = makeWorld("youtube.com");
  w2.register("youtube.com", { stepUp: () => false });
  const u = { muted: false, volume: 0.5 };
  w2.vol("ACTION:VOLUME:+4", u);
  check("ورفض المحوّل بـ false ⇒ كتابة مباشرة فورية",
    near(u.volume, 0.54) && w2.timers.length === 0, u.volume);

  // ومحوّل يرمي ⇒ المسار المباشر كذلك، بلا استثناء يتسرّب
  const w3 = makeWorld("youtube.com");
  w3.register("youtube.com", { stepUp: () => { throw new Error("boom"); } });
  const t = { muted: false, volume: 0.5 };
  w3.vol("ACTION:VOLUME:+4", t);
  check("والمحوّل الذي يرمي لا يُسقط الأمر", near(t.volume, 0.54), t.volume);
}

console.log("\n[6] حارس دائم: **عدّ الأحداث المُرسَلة** — سقفه في هذا الكومِت صفر");
{
  // مصدره حادثة 923,627 حدثاً بعد إرسال حدثين (AUDIT §9). الإطار لا يُرسل أحداثاً،
  // فالمتوقَّع صفر بالضبط — وأي إرسال يُدخله محوّل لاحق يجب أن يمرّ بسقف صريح.
  check("لا dispatchEvent في إطار المحوّلات", !/dispatchEvent/.test(ADAPTER));
  check("ولا KeyboardEvent", !/KeyboardEvent/.test(ADAPTER));
  check("ولا نقر مُصطنَع", !/\.click\(\)/.test(ADAPTER));
  const w = makeWorld("youtube.com");
  let sent = 0;
  w.register("youtube.com", { stepUp: () => { sent++; } });
  for (let i = 0; i < 5; i++) { w.vol("ACTION:VOLUME:+4", { muted: false, volume: 0.5 }); w.tick(); }
  const CEILING = 5; // نداء واحد لكل ضغطة، لا أكثر
  check(`ونداءات المحوّل ≤ ${CEILING} لخمس ضغطات (لا ارتداد)`, sent <= CEILING, sent);
}

console.log("\n[7] السقوط يُسجَّل **مرة واحدة** لا في كل ضغطة");
{
  const w = makeWorld("youtube.com");
  w.register("youtube.com", { stepUp: () => {} });
  for (let i = 0; i < 4; i++) { w.vol("ACTION:VOLUME:+4", { muted: false, volume: 0.5 }); w.tick(); }
  const lines = w.logs.filter((l) => /السقوط إلى الكتابة المباشرة/.test(l));
  check("أربع ضغطات ⇒ سطر واحد", lines.length === 1, lines.length);
  // وعملية أخرى على المضيف نفسه تُسجَّل مرة كذلك — المفتاح «مضيف|عملية»
  w.register("youtube.com", { stepUp: () => {}, toggleMute: () => {} });
  for (let i = 0; i < 3; i++) { w.mute({ muted: false, volume: 0.5 }); w.tick(); }
  const all = w.logs.filter((l) => /السقوط إلى الكتابة المباشرة/.test(l));
  check("وثلاث ضغطات كتم ⇒ سطر ثانٍ واحد", all.length === 2, all.length);
}

console.log("\n[8] الحدود البنيوية في النصّ");
{
  check("الخروج الفوري حين يكون السجلّ فارغاً — بلا استدعاء baseDomain",
    /if \(!hostAdapters\.size\) return null;/.test(ADAPTER));
  check("والمهلة قصيرة ومعرَّفة مرة واحدة",
    /const ADAPTER_VERIFY_MS = \d+;/.test(ADAPTER) &&
    (CONTENT.match(/ADAPTER_VERIFY_MS/g) || []).length === 2);
  check("والسقوط يستدعي **نفس** applyDirect لا نسخة ثانية",
    /applyDirect\(\);/.test(ADAPTER) && (ADAPTER.match(/video\.volume\s*=/g) || []).length === 0);
  check("والشارة تُنادى في مسارَي النجاح والسقوط",
    (ADAPTER.match(/showVolumeIndicator\(video\)/g) || []).length === 2);
  check("ولا setInterval في الإطار", !/setInterval/.test(ADAPTER));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
