// محرّك السكون (#70 · #72) — يُصدر حالةً لا أمراً، والسياسة لكل مستهلك
//
// **الحدّ المعماريّ الذي يحرسه هذا الملف (قرار المالك 2026-08-02):** المحرّك
// يقول «سكون/نشاط» **ولا يقول «أخفِ»**. وهو حدٌّ لا أناقة، **لأن الملكية
// مختلفة**: #70 يُخفي شريط المضيف فيلزمه احترام نيّته، و#72 يُخفي زرّنا فالقرار
// قرارنا. ⚠️ **فمن رأى الأحمر هنا ووجد سياسةً تسرّبت إلى المحرّك، يُخرجها إلى
// المستهلك ولا يُعدّل التأكيد.**
//
// ⚠️ **وهذا الكومِت المحرّك وحده — بصفر مستهلك**، على نمط كومِت إطار المحوّلات
// (#60): **يُبرهَن صفر تغيّر قبل أن يوجد مستهلكٌ واحد**، والقسم [1] هو البرهان.
//
// ⚠️ **وثلاث مصائد أُمسكت في التصميم قبل أن تقع، ولكلٍّ قسمها:**
//   [3] `mousemove` بلا حركة فعلية — **الفرق بين ميزةٍ تعمل وميزةٍ تبدو معطّلة**
//   [4] أحداث الوسائط ليست نشاطاً — «النشاط يُقاس عند الإدخال لا عند أثره»
//   [2] الحالة الابتدائية «سكون» لا «نشاط»
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
function body(name) {
  const i = SRC.indexOf(name);
  if (i === -1) return null;
  const j = SRC.indexOf("\n}", i);
  return j === -1 ? null : SRC.slice(i, j);
}
const CODE = SRC.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");

const ENGINE = slice("const IDLE_MIN_MS = 500;", "// الدخول إلى ملء الشاشة");
if (!ENGINE) {
  console.log("  ❌ تعذّر اقتطاع المحرّك — **المرساة سقطت، أصلِح المرساة لا التأكيد**");
  console.log("\n❌ نجح 0 / فشل 1\n");
  process.exit(1);
}

// ── عالمٌ بساعة مُدارة (#73): المهل تُشغَّل بأمرنا لا بساعة الحائط ──────────
function makeWorld({ consumers = {}, gate = true } = {}) {
  const log = [];
  const clock = { t: 1000, q: [], seq: 0 };
  const ctx = {
    console,
    nowMs: () => clock.t,
    setTimeout: (fn, ms) => {
      const id = ++clock.seq;
      clock.q.push({ id, at: clock.t + (Number(ms) || 0), fn });
      return id;
    },
    clearTimeout: (id) => {
      const i = clock.q.findIndex((x) => x.id === id);
      if (i > -1) clock.q.splice(i, 1);
    },
    extensionActive: () => ctx.__gate,
    settingsRead: async () => ({ settings: ctx.__settings }),
    getVideoUnderPointer: (e) => (ctx.__inside ? { tagName: "VIDEO" } : null),
    __gate: gate,
    __settings: {},
    __inside: true,
    __log: log
  };
  vm.createContext(ctx);
  vm.runInContext(ENGINE, ctx);
  // المستهلكون يُحقنون في السجلّ نفسه — **لا سجلٌّ مزيّف بجواره**
  ctx.__consumers = consumers;
  vm.runInContext("Object.assign(IDLE_CONSUMERS, __consumers)", ctx);
  return {
    ctx, log,
    run: (expr) => vm.runInContext(expr, ctx),
    get: (name) => vm.runInContext(name, ctx),
    timers: () => clock.q.length,
    advance: (ms) => {
      const end = clock.t + ms;
      for (;;) {
        let next = null;
        for (const it of clock.q) if (it.at <= end && (!next || it.at < next.at)) next = it;
        if (!next) break;
        clock.q.splice(clock.q.indexOf(next), 1);
        clock.t = next.at;
        next.fn();
      }
      clock.t = end;
    }
  };
}

const mkConsumer = (log, key, opts = {}) => ({
  enabled: () => opts.enabled !== false,
  ...(opts.suspended ? { suspended: opts.suspended } : {}),
  onActive: () => log.push(`${key}:active`),
  onIdle: () => log.push(`${key}:idle`)
});

console.log("\n=== محرّك السكون (#70 · #72) ===\n");

// ── [1] ⭐ صفر مستهلك ⇒ صفر عمل ─────────────────────────────────────────────
console.log("[1] ⭐ بلا مستهلكٍ مُفعَّل: صفر مؤقّت وصفر أثر");
{
  const w = makeWorld();
  check("[1] السجلّ فارغ في هذا الكومِت", Object.keys(w.get("IDLE_CONSUMERS")).length === 0);
  check("[1] والمحرّك غير مطلوب", w.get("idleEngineActive()") === false);
  w.run("markIdleActivity()");
  w.run(`noteIdleFromPointerEvent({ type: "mousemove", isTrusted: true }, true)`);
  check("[1] وصفر مؤقّت بعد نشاطٍ مُفتعَل", w.timers() === 0, w.timers());
  check("[1] والحالة باقية «سكون»", w.get("idleState") === "idle", w.get("idleState"));

  // ⚠️ والمسار الحارّ يقرأ **منطقيّاً واحداً** لا حلقة على السجلّ
  const mark = body("function markIdleActivity()");
  check("[1] والمسار الحارّ يخرج على `idleWanted` قبل أي عمل",
    !!mark && /^function markIdleActivity\(\) \{\n  if \(!idleWanted\) return;/.test(mark), mark);
  check("[1] ولا حلقة على السجلّ في المسار الحارّ",
    !!mark && !/IDLE_CONSUMERS/.test(mark), mark);
}

// ── [2] الحالة الابتدائية «سكون» — المصيدة الثالثة ─────────────────────────
console.log("\n[2] المصيدة (٣): يبدأ ساكناً، فلا يظهر شيء على صفحة لم يحوّم عليها أحد");
{
  check("[2] الحالة الابتدائية معلَنة «idle»", /let idleState = "idle";/.test(SRC));
  const log = [];
  const w = makeWorld({ consumers: { a: mkConsumer(log, "a") } });
  w.run("refreshIdleConsumers()");
  check("[2] وبعد تفعيل مستهلك بلا نشاط: يُعلَن «سكون» لا «نشاط»",
    log.join() === "a:idle", log);
  check("[2] ولا مؤقّت قبل أول نشاط", w.timers() === 0, w.timers());
}

// ── [3] المصيدة (١): حركةٌ فعلية لا مجرّد حدث ──────────────────────────────
console.log("\n[3] ⭐ المصيدة (١): `mousemove` بلا حركة ليست نشاطاً");
{
  const log = [];
  const w = makeWorld({ consumers: { a: mkConsumer(log, "a") } });
  w.run("refreshIdleConsumers()");

  w.run(`noteIdleFromPointerEvent({ type: "mousemove", isTrusted: true }, false)`);
  check("[3] حدثٌ بلا حركة ⇒ صفر نشاط", w.timers() === 0 && w.get("idleState") === "idle",
    { timers: w.timers(), state: w.get("idleState") });

  w.run(`noteIdleFromPointerEvent({ type: "mousemove", isTrusted: true }, true)`);
  check("[3] وحركةٌ فعلية ⇒ نشاط ومؤقّت", w.timers() === 1 && w.get("idleState") === "active",
    { timers: w.timers(), state: w.get("idleState") });

  // والحسبة نفسها في المنتج: تُقاس **قبل** الكتابة على lastPointer
  const upd = body("function updatePointerFromEvent(e)");
  check("[3] والمقارنة قبل الكتابة في `updatePointerFromEvent`",
    !!upd && upd.indexOf("const moved") < upd.indexOf("lastPointer = {"), upd);
}

// ── [4] المصيدة (٢): أحداث الوسائط ليست نشاطاً ─────────────────────────────
console.log("\n[4] ⭐ المصيدة (٢): «النشاط يُقاس عند الإدخال لا عند أثره»");
{
  // بنيويّاً: لا مستمع وسائط في مصادر النشاط. `timeupdate` وحده أربع مرّات/ثانية
  for (const ev of ["timeupdate", "seeking", "seeked", "ratechange", "volumechange"]) {
    check(`[4] لا «${ev}» في الكود إطلاقاً`, !new RegExp(`["']${ev}["']`).test(CODE));
  }
  // و`play`/`pause` قد تردان لأغراض أخرى — الشرط ألّا تُنادي المحرّك
  const marks = (CODE.match(/markIdleActivity\(\)/g) || []).length;
  check("[4] ومواضع نداء النشاط معدودة ومقصودة (٤)", marks === 4, `العدد ${marks}`);
  check("[4] ولا نداء من مستمع وسائط",
    !/addEventListener\("(play|pause|timeupdate|seeking|ratechange)"[\s\S]{0,120}markIdleActivity/.test(SRC));
}

// ── [5] المؤقّت يُصحّح نفسه، ولا يُعاد تسليحه لكل حركة ──────────────────────
console.log("\n[5] طابعٌ زمنيّ واحد ومؤقّتٌ يُصحّح نفسه");
{
  const log = [];
  const w = makeWorld({ consumers: { a: mkConsumer(log, "a") } });
  w.run("refreshIdleConsumers()");
  log.length = 0;

  w.run("markIdleActivity()");
  check("[5] مؤقّت واحد بعد أول نشاط", w.timers() === 1, w.timers());
  w.advance(300);
  w.run("markIdleActivity()");
  w.run("markIdleActivity()");
  check("[5] وثلاث حركات ⇒ مؤقّت واحد لا ثلاثة", w.timers() === 1, w.timers());
  check("[5] وحالةٌ واحدة مُعلَنة لا ثلاث", log.join() === "a:active", log);

  // بعد 300ms من آخر نشاط: المؤقّت يستيقظ ويجد وقتاً باقياً فيُعيد تسليح نفسه
  w.advance(1800);
  check("[5] لم يسكن بعد — أُعيد التسليح للباقي", w.get("idleState") === "active",
    w.get("idleState"));
  w.advance(400);
  check("[5] ثمّ سكن عند اكتمال المهلة من **آخر** نشاط", w.get("idleState") === "idle",
    w.get("idleState"));
  check("[5] وأُعلن مرّةً واحدة", log.join() === "a:active,a:idle", log);
  check("[5] ولا مؤقّت معلّق بعد السكون", w.timers() === 0, w.timers());

  // ولا rAF في المحرّك إطلاقاً — حلقة الرسم القائمة تتوقّف حين لا يظهر شيء،
  // وحلقةٌ دائمة لكشف السكون تُلغي هذا المكسب.
  // ⚠️ **على الكود لا على التعليق**: التعليق أعلاه يذكر الاسم شرحاً لسبب غيابه
  // (نمط `test-master-gate` القسم [٢]) — ولولا التقشير لحرّمنا شرح القرار.
  const engineCode = ENGINE.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  check("[5] ولا `requestAnimationFrame` في كود المحرّك",
    !/requestAnimationFrame/.test(engineCode));
  check("[5] ولا `setInterval` فيه", !/setInterval/.test(engineCode));
}

// ── [6] ⭐ شرط الامتناع — لكل مستهلك، و«ممتنع» تعني «كالنشط» ────────────────
console.log("\n[6] ⭐ الامتناع: سياسةٌ لكل مستهلك، لا سلوكٌ يفرضه المحرّك");
{
  const log = [];
  let paused = false;
  const w = makeWorld({ consumers: {
    host: mkConsumer(log, "host"),                                   // #70: بلا امتناع
    ours: mkConsumer(log, "ours", { suspended: () => paused })       // #72: يمتنع عند التوقّف
  } });
  w.run("refreshIdleConsumers()");
  log.length = 0;

  w.run("markIdleActivity()");
  w.advance(2100);
  check("[6] بلا امتناع: الاثنان يسكنان", log.join() === "host:active,ours:active,host:idle,ours:idle", log);

  // التوقّف يُعلّق الإخفاء لزرّنا وحده — وشريط المضيف يبقى على سياسته
  log.length = 0;
  paused = true;
  w.run("refreshIdleConsumers()");
  check("[6] وعند الامتناع: الممتنع يُعرض كالنشط والآخر يبقى ساكناً",
    log.join() === "host:idle,ours:active", log);

  // ⚠️ ولا بدّ من `refreshIdleConsumers` حين يتغيّر شرط الامتناع وحده
  log.length = 0;
  paused = false;
  w.run("refreshIdleConsumers()");
  check("[6] ورفع الامتناع يعيده إلى حالة المحرّك", log.join() === "host:idle,ours:idle", log);

  // ومستهلكٌ مُطفأ لا يُبلَّغ أصلاً
  const log2 = [];
  const w2 = makeWorld({ consumers: {
    on: mkConsumer(log2, "on"),
    off: mkConsumer(log2, "off", { enabled: false })
  } });
  w2.run("refreshIdleConsumers()");
  check("[6] ومستهلكٌ مفتاحه مطفأ لا يُبلَّغ", log2.join() === "on:idle", log2);
}

// ── [7] بوّابة #64 والمهلة ─────────────────────────────────────────────────
console.log("\n[7] البوّابة والمهلة");
{
  const gate = body("function idleEngineActive()");
  check("[7] البوّابة تنادي `extensionActive()`", !!gate && gate.includes("extensionActive()"), gate);
  const iGate = gate ? gate.indexOf("extensionActive()") : -1;
  const iOwn = gate ? gate.indexOf("IDLE_CONSUMERS") : -1;
  check("[7] وقبل مفاتيح المستهلكين", iGate > -1 && iOwn > -1 && iGate < iOwn, `${iGate}/${iOwn}`);
  check("[7] ولا تفحص الحظر بنفسها (الحارس البنيويّ #64)", !!gate && !/isBlockedHost/.test(gate));

  const log = [];
  const w = makeWorld({ consumers: { a: mkConsumer(log, "a") } });
  w.run("refreshIdleConsumers()");
  w.run("markIdleActivity()");
  w.ctx.__gate = false;
  w.run("refreshIdleConsumers()");
  check("[7] وإغلاق البوّابة يُطفئ المحرّك ويُلغي مؤقّته",
    w.timers() === 0 && w.get("idleWanted") === false, { timers: w.timers() });
  check("[7] ويعيدها إلى «سكون» فلا تبقى معلّقة على «نشاط» بعد الإطفاء",
    w.get("idleState") === "idle", w.get("idleState"));
}

// ── [8] «صفر» والحدّ الأدنى — تطبيق الشاهد الرابع والعشرين ─────────────────
console.log("\n[8] «صفر» لا تعني «مطفأ»، والحدّ الأدنى صريح");
(async () => {
  const cases = [
    [undefined, 2000, "غياب المفتاح ⇒ الافتراض"],
    [0,         2000, "صفر ⇒ الافتراض لا الإطفاء"],
    [-5,        2000, "سالب ⇒ الافتراض"],
    [100,        500, "أقلّ من الحدّ ⇒ الحدّ الأدنى"],
    [500,        500, "الحدّ نفسه"],
    [3000,      3000, "قيمة معقولة تمرّ كما هي"]
  ];
  for (const [input, want, label] of cases) {
    const w = makeWorld();
    w.ctx.__settings = input === undefined ? {} : { idle: { ms: input } };
    await w.run("loadIdleSettings()");
    check(`[8] ${label} (${input} ⇒ ${w.get("idleMs")})`, w.get("idleMs") === want, w.get("idleMs"));
  }
  check("[8] والحدّ الأدنى ثابتٌ مسمّى", /const IDLE_MIN_MS = 500;/.test(SRC));
  check("[8] والإطفاء بمفتاح المستهلك وحده — لا قيمة في المهلة تُطفئ",
    !/idleMs\s*(<=|===)\s*0/.test(CODE));

  console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
