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

const ENGINE = slice("const IDLE_MIN_MS", "// الدخول إلى ملء الشاشة");
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
    // مستمعو مخارج الامتناع تُلتقط كي **تُختبَر لا تُدّعى** (شرط قبول المالك)
    window: { addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); } },
    document: {
      addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
      hidden: false,
      activeElement: null
    },
    __gate: gate,
    __settings: {},
    __inside: true,
    __log: log
  };
  const listeners = {};
  vm.createContext(ctx);
  vm.runInContext(ENGINE, ctx);
  // المستهلكون يُحقنون في السجلّ نفسه — **لا سجلٌّ مزيّف بجواره**
  ctx.__consumers = consumers;
  vm.runInContext("Object.assign(IDLE_CONSUMERS, __consumers)", ctx);
  return {
    ctx, log, listeners,
    fire: (type, ev = {}) => { for (const fn of listeners[type] || []) fn(ev); },
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
  onIdle: () => log.push(`${key}:idle`),
  // **الجذر الثاني (#72): «لا يعمل» يسأل صاحبَه عن معناه** — لا يرث «كالنشط»
  onDisabled: () => log.push(`${key}:disabled`)
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
  // و`play`/`pause` قد تردان لأغراض أخرى — الشرط ألّا تُنادي المحرّك.
  // ⚠️ **والعدد يُحدَّث عمداً مع كل مصدرٍ جديد، ولا يُرفع ليَمرّ:** المواضع
  // الستّة هي — المؤشّر (`noteIdleFromPointerEvent`) · ملء الشاشة ·
  // مفتاحٌ أصاب أمر المربّع · مفتاحٌ أصاب أمراً عامّاً · عجلة زرّ #72 · نقرته.
  // **ومن زاد سابعاً يكتبه هنا بعد أن يسأل: أهو إدخالٌ أم أثرُ إدخال؟**
  const marks = (CODE.match(/markIdleActivity\(\)/g) || []).length;
  check("[4] ومواضع نداء النشاط معدودة ومقصودة (٦)", marks === 6, `العدد ${marks}`);
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

  // ⚠️ **مثالٌ مُفتعَل لا سياسةُ #72.** كان الشرط الحقيقيّ «التوقّف يُعلّق
  // الإخفاء للزرّ»، **وسُحب بالقياس 2026-08-02** (القسم الرابع عشر): يوتيوب
  // **يُخفي وهو متوقّف**، فالمقدّمة باطلة والزرّ يتبع السكون بلا استثناء.
  // **والآلية تبقى مُختبَرة** بشرطٍ مُفتعَل — فالمحرّك يحرس القدرة لا السياسة.
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

  // ⚠️ **ومستهلكٌ مُطفأ يُعرض كالنشط، لا «لا يُبلَّغ»** — كان يُتخطّى صامتاً،
  // **فيبقى إخفاؤه عالقاً بعد إطفاء مفتاحه**: يُطفئ المستخدم الميزة فلا يعود
  // شريطه. حالةٌ تُترك على آخر ما كانت عليه **حالةٌ لا يملك أحدٌ إخراجها**.
  const log2 = [];
  const w2 = makeWorld({ consumers: {
    on: mkConsumer(log2, "on"),
    off: mkConsumer(log2, "off", { enabled: false })
  } });
  w2.run("refreshIdleConsumers()");
  // ⛔ **انقلب هذا التأكيد بقرار المالك 2026-08-03، والانقلاب مقصود:** كان
  // يشترط `off:active` — **«يُعرض كالنشط»** — وهو صوابٌ لِما نُخفيه من المضيف
  // **وعكسُه لِما نرسمه نحن** (زرّ #72 كان يظهر بإطفاء مفتاحه). **ولم يُعدَّل
  // ليمرّ بل انقلب لأن المطلوب انقلب**، والتغطية باقية: «يُتخطّى صامتاً» ما زال يُحمّر.
  check("[6] ومستهلكٌ مفتاحه مطفأ **يُعلَن لا يُتخطّى، ومعناه له لا للمحرّك**",
    log2.join() === "on:idle,off:disabled", log2);

  // وإطفاء المحرّك كلّه يُخرج الجميع — ولو كانت مفاتيحهم مُشغَّلة
  const log3 = [];
  const w3 = makeWorld({ consumers: { a: mkConsumer(log3, "a") } });
  w3.run("refreshIdleConsumers()");
  w3.run("markIdleActivity()");
  w3.advance(2100);
  log3.length = 0;
  w3.ctx.__gate = false;
  w3.run("refreshIdleConsumers()");
  check("[6] وإغلاق البوّابة يُخرج مستهلكاً كان مخفيّاً — بمعناه هو",
    log3.join() === "a:disabled", log3);
}

// ── [9] ⭐ الامتناع العالق — أربعة مخارج، **مُختبَرة لا مُدّعاة** ────────────
console.log("\n[9] ⭐ الامتناع العالق: أربعة مخارج، وكلٌّ يُجرَّب");
{
  const EXITS = [
    ["mouseup", {}],
    ["pointercancel", {}],
    ["blur", {}],
    ["visibilitychange", {}]
  ];
  for (const [type, ev] of EXITS) {
    const log = [];
    const w = makeWorld({ consumers: {
      a: { enabled: () => true, suspended: () => w.get("idlePointerHeld"),
           onActive: () => log.push("a:active"), onIdle: () => log.push("a:idle") }
    } });
    w.run("refreshIdleConsumers()");
    w.fire("mousedown", { isTrusted: true, type: "mousedown" });
    check(`[9] «${type}»: الضغط يرفع الامتناع أولاً`, w.get("idlePointerHeld") === true);

    // ⚠️ وسكونٌ كامل والامتناع قائم ⇒ **لا إخفاء** — وهي حال «سحبٌ بلا حركة»
    log.length = 0;
    w.run("markIdleActivity()");
    w.advance(2100);
    check(`[9]   وسكونٌ تامّ لا يُخفي شيئاً تحت اليد`, !log.includes("a:idle"), log);

    if (type === "visibilitychange") w.ctx.document.hidden = true;
    w.fire(type, ev);
    check(`[9]   و«${type}» يُسقط الامتناع`, w.get("idlePointerHeld") === false);
  }

  // والمخارج الأربعة مسجَّلة فعلاً في المنتج، لا في العالم وحده
  for (const t of ["mouseup", "pointercancel", "blur", "visibilitychange"]) {
    check(`[9] ومستمع «${t}» مسجَّل في المنتج`,
      new RegExp(`addEventListener\\("${t}"`).test(ENGINE));
  }
}

// ── [10] الشرط الثاني: الهدف يحوي عنصر التركيز ─────────────────────────────
console.log("\n[10] التركيز داخل الهدف — خرج من القياس لا من التصميم");
{
  const w = makeWorld();
  check("[10] `focusInside` موجودة", typeof w.get("focusInside") === "function");
  w.ctx.document.activeElement = null;
  check("[10] بلا تركيز ⇒ لا امتناع", w.run(`focusInside(".x")`) === false);
  w.ctx.document.activeElement = { closest: (s) => (s === ".x" ? {} : null) };
  check("[10] وتركيزٌ داخل الهدف ⇒ امتناع", w.run(`focusInside(".x")`) === true);
  w.ctx.document.activeElement = { closest: () => null };
  check("[10] وتركيزٌ خارجه ⇒ لا امتناع", w.run(`focusInside(".x")`) === false);
  w.ctx.document.activeElement = { closest: () => { throw new Error("shadow"); } };
  check("[10] وعنصرٌ يرمي ⇒ لا امتناع لا انهيار", w.run(`focusInside(".x")`) === false);
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
    // ⛔ **الحدّ صار 100 (#86)، فانتقلت الحالتان معه ولم تُحذفا** — **وتغطية
    // القصّ باقية**: قيمةٌ **تحت** الحدّ ما زالت تُقصّ، والحدّ نفسه يمرّ.
    [50,         100, "أقلّ من الحدّ ⇒ الحدّ الأدنى"],
    [100,        100, "الحدّ نفسه"],
    [500,        500, "ما كان حدّاً صار قيمةً تمرّ كما هي"],
    [3000,      3000, "قيمة معقولة تمرّ كما هي"]
  ];
  for (const [input, want, label] of cases) {
    const w = makeWorld();
    w.ctx.__settings = input === undefined ? {} : { idle: { ms: input } };
    await w.run("loadIdleSettings()");
    check(`[8] ${label} (${input} ⇒ ${w.get("idleMs")})`, w.get("idleMs") === want, w.get("idleMs"));
  }
  // ⛔ **انقلب الرقم بقرار المالك (#86): 500 ⇒ 100** — **والتأكيد يشترط الجديد**
  // ولا يُحذف: **حدٌّ أدنى مسمّى شرطٌ باقٍ**، والقيمة وحدها تغيّرت.
  check("[8] والحدّ الأدنى ثابتٌ مسمّى", /const IDLE_MIN_MS = 100;/.test(SRC));
  check("[8] والإطفاء بمفتاح المستهلك وحده — لا قيمة في المهلة تُطفئ",
    !/idleMs\s*(<=|===)\s*0/.test(CODE));


// ── [11] ⭐ العقد: المستهلك يُعلن ما يعنيه إطفاؤه — والمحرّك لا يقرّر ────────
// **الجذر الثاني في #72 (قرار المالك 2026-08-03).** كان المحرّك يقرّر أن «مُطفأ
// ⇒ كالنشط» — **صوابٌ لِما نُخفيه من المضيف، وعكسُه لِما نرسمه نحن**: زرّ #72
// كان **يظهر بإطفاء مفتاحه** (مقيسٌ في `bench-overlay-layer`).
// ⇒ **والإعلان شرطُ التسجيل لا عادةٌ حسنة** (قرار 16ج): مستهلكٌ بلا onDisabled
// **يُحمّر المجموعة**، فمستهلكٌ ثالث يُضاف غداً لا يرث تأويلاً كُتب لجاره.
console.log("\n[11] ⭐ كل مستهلكٍ يُعلن معنى إطفائه، والمحرّك ينقل لا يقرّر");
{
  const RE = /IDLE_CONSUMERS\.[A-Za-z0-9_$]+ = \{[\s\S]*?\n\};/g;
  const decl = SRC.match(RE) || [];
  check("[11] مستهلكان مسجَّلان", decl.length === 2, "العدد " + decl.length);
  for (const d of decl) {
    const name = (d.match(/IDLE_CONSUMERS\.([A-Za-z0-9_$]+)/) || [])[1];
    check("[11] " + name + " يُعلن onDisabled", /onDisabled\s*:/.test(d), d.slice(0, 90));
  }
  const body = (SRC.match(/function applyIdleState\(\)[\s\S]*?\n}/) || [""])[0];
  check("[11] والمحرّك ينادي onDisabled في فرع «لا يعمل»",
    /!c\.enabled\(\)\)\s*\{\s*c\.onDisabled\(\)/.test(body), body.slice(0, 240));
  check("[11] و«ممتنع» يبقى كالنشط — فهو غيرُ «مُطفأ»",
    /c\.suspended\?\.\(\)\)\s*\{\s*c\.onActive\(\)/.test(body), body.slice(0, 300));
  // ⭐ **الشاهد الموجب (قرار 47): مصدرٌ ينقصه الإعلان يجب أن يُحمَّر**
  const fake = "IDLE_CONSUMERS.x = {\n  enabled: () => true,\n  onActive: () => 1,\n  onIdle: () => 2\n};";
  const fd = fake.match(RE) || [];
  check("[11] ⭐ والحارس يرى مستهلكاً بلا إعلان — فلا يُصدَّق خضاره",
    fd.length === 1 && !/onDisabled\s*:/.test(fd[0]), fd);
}


// ── [12] ⭐ #90 — مؤقّتٌ جارٍ يُعاد حسابه على المهلة الجديدة فوراً ──────────
// ⛔ **العطب مقيس:** ضُبطت 0.5s بعد ثانيتين من تسليحٍ على 6s **فبقي ظاهراً حتى
// الثانية السادسة**. **والنقرة نشاطٌ يُعيد التسليح** ⇒ «لا يُطبَّق حتى أنقر».
// ⇒ **وإعدادٌ يُطبَّق من الدورة القادمة يبدو معطّلاً لمن غيّره ونظر.**
console.log("\n[12] ⭐ تغيّرُ المهلة يُعيد حساب المؤقّت الجاري");
{
  const log = [];
  // ⚠️ **`makeWorld` لا يأخذ `idleMs`** — تُضبط في العالم صراحةً بعد بنائه.
  const w = makeWorld({ consumers: { a: mkConsumer(log, "a") } });
  w.run("idleMs = 6000");
  w.run("refreshIdleConsumers()");
  w.run("markIdleActivity()");
  w.advance(2000);
  check("[12] بعد ثانيتين من ستّ: ما زال نشطاً", w.get("idleState") === "active", w.get("idleState"));
  // تغيّرُ المهلة إلى 500 — **بلا أي نشاط**
  w.ctx.__idleMsNext = 500;
  w.run("idleMs = 500; if (idleTimer != null) { clearTimeout(idleTimer); idleTimer = null; idleTick(); }");
  check("[12] ⭐ والقيمة الجديدة أقصر من المنقضي ⇒ سكونٌ الآن لا بعد أربع",
    w.get("idleState") === "idle", w.get("idleState"));
  // والعكس: قيمةٌ أطول ⇒ يبقى نشطاً ويُعاد تسليحه للباقي
  const log2 = [];
  const w2 = makeWorld({ consumers: { b: mkConsumer(log2, "b") } });
  w2.run("idleMs = 1000");
  w2.run("refreshIdleConsumers()");
  w2.run("markIdleActivity()");
  w2.advance(600);
  w2.run("idleMs = 5000; if (idleTimer != null) { clearTimeout(idleTimer); idleTimer = null; idleTick(); }");
  check("[12] وقيمةٌ أطول ⇒ يبقى نشطاً", w2.get("idleState") === "active", w2.get("idleState"));
  w2.advance(4500);
  check("[12] ثمّ يسكن عند اكتمال الجديدة لا القديمة", w2.get("idleState") === "idle", w2.get("idleState"));
  // ⭐ **الشاهد الموجب (قرار 47): بلا إعادة الحساب يبقى نشطاً على القديمة**
  const log3 = [];
  const w3 = makeWorld({ consumers: { c: mkConsumer(log3, "c") } });
  w3.run("idleMs = 6000");
  w3.run("refreshIdleConsumers()"); w3.run("markIdleActivity()"); w3.advance(2000);
  w3.run("idleMs = 500;");   // **بلا إعادة حساب** — كما كان الكود
  check("[12] ⭐ وبلا إعادة الحساب يبقى نشطاً — فالحارس يرى الفرق",
    w3.get("idleState") === "active", w3.get("idleState"));
  // والكود المشحون يحمل إعادة الحساب
  const fn = SRC.match(/async function loadIdleSettings[\s\S]*?\n}/);
  check("[12] و`loadIdleSettings` تُعيد الحساب عند التغيّر",
    !!fn && /changed && idleTimer != null/.test(fn[0]) && /idleTick\(\)/.test(fn[0]), fn && fn[0].slice(-160));
}

  console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
