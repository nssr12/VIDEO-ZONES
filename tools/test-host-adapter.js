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
const ADAPTER = slice("content.js", "// ── البند #60 · قرار المالك 25", "// ── محوّل يوتيوب (#60 · قرار 25)");
const VOL = slice("content.js", "// Volume delta in percent", "// Speed: SET absolute value");
const YTAD = slice("content.js", "// ── محوّل يوتيوب (#60 · قرار 25)", "function runAction");
const MUTE = slice("content.js", "// Mute\n  if (action === \"ACTION:TOGGLE_MUTE\")", "// PiP");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ---------------------------------------------------------------- العالم
// ساعة مُدارة: المهل تُشغَّل يدوياً كي يُقاس **متى** يقع السقوط لا أن يُنتظر.
function makeWorld(host = "example.com", noPlayer = false) {
  const timers = [];
  const logs = [];
  const indicator = [];
  const dispatched = []; // عدّاد الأحداث المُرسَلة — حارس القسم [6]
  // DOM مصغّر: مشغّل وحقل مركَّز — والحقل موجود عمداً كي يُكشف أي استهداف له
  const mkEl = (tagName, id) => ({
    tagName, id,
    // `adapterSending` رابط معجميّ داخل سكربت الـ vm لا خاصية على العالم،
    // فيُقرأ **من داخله** لا من كائن السياق — وإلا خرج `undefined` ومرّ الحارس بلا معنى.
    dispatchEvent(ev) {
      dispatched.push({ target: this, tag: tagName, type: ev.type, key: ev.key,
                        sending: vm.runInContext("adapterSending", ctx) });
      return true;
    }
  });
  const player = mkEl("DIV", "movie_player");
  const focused = mkEl("INPUT", "search");
  let clock = 1000;
  const ctx = {
    console: { debug: (...a) => logs.push(a.join(" ")), log() {}, warn() {} },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    location: { host },
    baseDomain: (h) => h,
    showVolumeIndicator: (v) => indicator.push({ volume: v.volume, muted: v.muted }),
    nowMs: () => clock,
    __advance: (ms) => { clock += ms; },
    __typing: false,
    shouldIgnoreKeyBecauseTyping: () => ctx.__typing,
    KeyboardEvent: class { constructor(type, init) { Object.assign(this, { type }, init); } },
    document: {
      activeElement: focused,
      querySelector: (sel) => (sel === "#movie_player" && !noPlayer ? player : null)
    },
    __player: player, __focused: focused, __dispatched: dispatched
  };
  vm.createContext(ctx);
  vm.runInContext(`${ADAPTER}
    ${YTAD}
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
    ctx, timers, logs, indicator, dispatched, player, focused,
    advance: (ms) => ctx.__advance(ms),
    typing: (on) => { ctx.__typing = on; },
    tick: () => { const t = timers.splice(0); for (const x of t) x.fn(); },
    vol: (a, v) => vm.runInContext("runVolume", ctx)(a, v),
    mute: (v) => vm.runInContext("runMute", ctx)(v),
    register: (domain, adapter) => {
      ctx.__ad = adapter;
      vm.runInContext(`hostAdapters.set(${JSON.stringify(domain)}, __ad)`, ctx);
    }
  };
}

console.log("\n[1] السجلّ: **محوّل واحد بالضبط** — يوتيوب، وما عداه مسار اليوم");
{
  const w = makeWorld();
  check("محوّلان بالضبط", vm.runInContext("hostAdapters.size", w.ctx) === 2,
    vm.runInContext("[...hostAdapters.keys()].join()", w.ctx));
  check("وهما twitch.tv و youtube.com",
    vm.runInContext("[...hostAdapters.keys()].sort().join()", w.ctx) === "twitch.tv,youtube.com");
  check("ولا محوّل على مضيف غير مسجَّل", vm.runInContext("hostAdapterFor()", w.ctx) === null);
  // **شرط القبول الأول**: من لا محوّل له يسلك مسار اليوم حرفياً
  for (const h of ["vimeo.com", "d.tube", "kick.com"]) {
    const x = makeWorld(h);
    check(`ولا محوّل على ${h}`, vm.runInContext("hostAdapterFor()", x.ctx) === null);
    const v = { muted: false, volume: 0.5 };
    x.vol("ACTION:VOLUME:+4", v);
    check(`  و${h}: كتابة مباشرة فورية 0.54 بلا مهلة`,
      near(v.volume, 0.54) && x.timers.length === 0, v.volume);
  }
  check("ولا تسجيل زائد في الملف",
    (CONTENT.match(/hostAdapters\.set\(/g) || []).length === 2);
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


console.log("\n[9] محوّل يوتيوب — الهدف والامتناع وعدم الارتداد");
{
  const w = makeWorld("youtube.com");
  const ad = vm.runInContext("hostAdapterFor()", w.ctx);
  check("محوّل يوتيوب موجود", !!ad);
  check("وفيه stepUp و stepDown", typeof ad.stepUp === "function" && typeof ad.stepDown === "function");
  // مقصود وموثَّق: الكتم يبقى على مسار اليوم في هذا الكومِت
  check("**ولا toggleMute** — الكتم على مسار اليوم عمداً", typeof ad.toggleMute !== "function");

  // نقرة واحدة = خطوة مضيف واحدة
  const v = { muted: false, volume: 0.5 };
  w.vol("ACTION:VOLUME:+4", v);
  check("لم تُكتب دلتانا مباشرةً (المحوّل تولّاها)", near(v.volume, 0.5), v.volume);
  w.tick();
  const sends = w.dispatched.filter((d) => d.type === "keydown");
  check("نقرة واحدة ⇒ إرسال واحد", sends.length === 1, sends.length);
  check("والمفتاح ArrowUp", sends[0]?.key === "ArrowUp", sends[0]?.key);
  check("وزوج keydown+keyup", w.dispatched.length === 2, w.dispatched.length);
  const down = { muted: false, volume: 0.5 };
  const w2 = makeWorld("youtube.com");
  w2.vol("ACTION:VOLUME:-4", down); w2.tick();
  check("والخفض يرسل ArrowDown",
    w2.dispatched.find((d) => d.type === "keydown")?.key === "ArrowDown");
}

console.log("\n[10] **قاعدة أمان**: الهدف المشغّل أو <video>، ولا activeElement أبداً");
{
  const w = makeWorld("youtube.com");
  w.vol("ACTION:VOLUME:+4", { muted: false, volume: 0.5 });
  w.tick();
  check("الهدف عنصر المشغّل", w.dispatched.every((d) => d.target === w.player), w.dispatched.map((d) => d.tag));
  // ⚠️ الحارس القاطع: أي إرسال إلى حقل نصّ يفشل الاختبار صراحةً — لأنه يستبدل
  // نصّ المستخدم عبر قائمة اقتراحات يوتيوب («hello» ⇒ «hello hello»، AUDIT §9)
  check("**ولا إرسال إلى activeElement ولا إلى أي حقل نصّ**",
    !w.dispatched.some((d) => d.target === w.focused || /^(INPUT|TEXTAREA)$/.test(d.tag)),
    w.dispatched.map((d) => d.tag).join(","));
  check("ولا ذكر لـ activeElement في المحوّل نصّاً", !/activeElement/.test(YTAD.replace(/\/\/.*$/gm, "")));

  // بلا مشغّل: يسقط إلى <video> نفسه لا إلى المستند
  const w3 = makeWorld("youtube.com", true);
  const vid = { muted: false, volume: 0.5, tagName: "VIDEO",
                dispatchEvent(ev) { w3.dispatched.push({ target: this, tag: "VIDEO", type: ev.type, key: ev.key }); return true; } };
  w3.vol("ACTION:VOLUME:+4", vid); w3.tick();
  check("وبلا #movie_player يسقط إلى <video>",
    w3.dispatched.length > 0 && w3.dispatched.every((d) => d.tag === "VIDEO"),
    w3.dispatched.map((d) => d.tag));
}

console.log("\n[11] الامتناع أثناء الكتابة — بالحارس القائم لا بحارس ثانٍ");
{
  const w = makeWorld("youtube.com");
  w.typing(true);
  const v = { muted: false, volume: 0.5 };
  w.vol("ACTION:VOLUME:+4", v);
  check("لا إرسال أثناء الكتابة", w.dispatched.length === 0, w.dispatched.length);
  check("**والمسار المباشر يتولّاها فوراً**: 0.54 بلا مهلة",
    near(v.volume, 0.54) && w.timers.length === 0, v.volume);
  check("والحارس هو shouldIgnoreKeyBecauseTyping نفسه",
    /shouldIgnoreKeyBecauseTyping\(\)/.test(YTAD));
  check("ولا حارس كتابة ثانٍ في المحوّل",
    !/isContentEditable|INPUT\|TEXTAREA/.test(YTAD));
}

console.log("\n[12] حارس عدم الارتداد + **سقف عدّ الأحداث**");
{
  const w = makeWorld("youtube.com");
  w.vol("ACTION:VOLUME:+4", { muted: false, volume: 0.5 });
  w.tick();
  check("العلم مرفوع أثناء الإرسال", w.dispatched.every((d) => d.sending === true),
    w.dispatched.map((d) => d.sending));
  check("ويُخفض بعده", vm.runInContext("adapterSending", w.ctx) === false);
  check("ومستمع المفاتيح يخرج أول سطر حين يكون مرفوعاً",
    /addEventListener\("keydown"[\s\S]{0,400}?if \(adapterSending\) return;/.test(CONTENT));

  // ⚠️ سقف الدفقة: عشر نقرات سريعة ⇒ إرسالات محدودة. الحادثة التي دعت إليه:
  // 923,627 حدثاً بعد إرسال حدثين (AUDIT §9). **غير مفسَّرة لا تعني غير محروسة.**
  const b = makeWorld("youtube.com");
  for (let i = 0; i < 10; i++) b.vol("ACTION:VOLUME:+4", { muted: false, volume: 0.5 });
  for (let i = 0; i < 40; i++) { b.advance(60); b.tick(); }
  const bursts = b.dispatched.filter((d) => d.type === "keydown").length;
  const CEILING = 5; // = maxQueue
  check(`عشر نقرات سريعة ⇒ ${bursts} إرسالاً، والسقف ${CEILING}`, bursts <= CEILING, bursts);
  check("والسقف ليس صفراً — الدفقة تُلجَّم لا تُلغى", bursts > 0, bursts);

  // ودفقة ضخمة لا تنفجر: مئة نقرة تبقى تحت السقف نفسه
  const h = makeWorld("youtube.com");
  for (let i = 0; i < 100; i++) h.vol("ACTION:VOLUME:+4", { muted: false, volume: 0.5 });
  for (let i = 0; i < 200; i++) { h.advance(60); h.tick(); }
  const huge = h.dispatched.filter((d) => d.type === "keydown").length;
  check(`ومئة نقرة ⇒ ${huge} إرسالاً — تحت السقف نفسه`, huge <= CEILING, huge);
}

console.log("\n[13] لا نسخة ثانية من التحقّق أو السقوط داخل المحوّل");
{
  check("لا applyDirect في المحوّل", !/applyDirect/.test(YTAD));
  check("ولا نداء للشارة منه", !/showVolumeIndicator/.test(YTAD));
  check("ولا كتابة في video.volume أو muted", !/video\.volume\s*=|video\.muted\s*=/.test(YTAD));
  check("ولا ضبط مطلق", !/setVolume|volume\s*=\s*[0-9]/.test(YTAD));
  check("والخطوة موثَّقة أنها خطوة المضيف لا خطوتنا",
    /خطوة المضيف لا خطوتنا/.test(YTAD) && /±5%/.test(YTAD));
}

console.log("\n[14] محوّل تويتش — المحدّد بالبنية لا بالاسم، واستثناء عناصرنا");
{
  const ADP = slice("content.js", "// ── عائلة «منزلق المضيف» (#60)", "function runAction");
  // ⚠️ معرّفات تويتش `player-volume-slider-<UUID>` وأصنافه `ScRangeInput-sc-…`
  // بصمات تتغيّر مع كل بناء. تسلّلُ أيٍّ منها إلى الكود **يُفشل البناء هنا**.
  check("لا UUID في كود المحوّلات",
    !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(ADP.replace(/\/\/.*$/gm, "")), "معرّف عابر");
  check("ولا بصمة styled-components",
    !/-sc-[a-z0-9]{6,}/i.test(ADP.replace(/\/\/.*$/gm, "")));
  check("ولا اسم صنف تويتش عابر",
    !/ScRangeInput|hsrOE|tw-range/.test(ADP.replace(/\/\/.*$/gm, "")));
  check("ولا player-volume-slider بالاسم",
    !/player-volume-slider/.test(ADP.replace(/\/\/.*$/gm, "")));
  check("والبحث بالبنية: input[type=range]", /input\[type=range\]/.test(ADP));
  check("والمرئي يفوز بقاعدة صريحة", /r\.width > 0 && r\.height > 0/.test(ADP));
  check("وعناصرنا مُستثناة من المسح", /!isOwnElement\(el\)/.test(ADP));
  check("و isOwnElement تستثني .vzWrap وأصنافنا",
    /closest\("\.vzWrap"\)/.test(CONTENT) && /vz\[A-Z\]/.test(CONTENT));
  check("والضبط بالـ native setter ثم input/change",
    /HTMLInputElement\.prototype, "value"\)\?\.set/.test(ADP) &&
    /new Event\("input"/.test(ADP) && /new Event\("change"/.test(ADP));
  check("والمدى يُقرأ من العنصر لا يُفترض", /Number\(el\.min/.test(ADP) && /Number\(el\.max/.test(ADP));
  check("ولا رقم مطلق مكتوب كمستوى", !/value = ["']?(50|60|80|100)["']?/.test(ADP));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
