// يُجري **عقد الصوت** (`tools/volume-contract.js`) على كل مسار — لا على مسار واحد.
//
// ⚠️ **شرط بنيوي:** كل `hostAdapters.set("<نطاق>", …)` في `content.js` يجب أن يكون
// له **نموذج مضيف مُعايَر بالقياس** هنا، ويجب أن يجتاز العقد. محوّل جديد بلا
// نموذج ⇒ **هذا الاختبار أحمر**. هذا ما يمنع تكرار عطب الكتم في تويتش وكِك بدل
// أن يُكتشف فيهما واحداً واحداً.
//
// **نموذج يوتيوب مُعايَر بقياس حيّ** — `node tools/bench-yt-mute-step.mjs`
// (`youtube.com/watch?v=_Dbjs_r1Dk4`)، وهذي أرقامه التي بُني عليها:
//   · `ArrowUp` وهو **مكتوم**  ⇒ المنزلق **90 ⇒ 95 ⇒ 100** و`muted` **يبقى نعم**
//     — موثوقةً كانت الضغطة أو من إرسالنا، لا فرق. **سلوك مضيف لا عطب عندنا.**
//   · `ArrowDown` وهو مكتوم   ⇒ **100 ⇒ 95 ⇒ 90** و`muted` **يبقى نعم**
//   · `m` **من إرسالنا**       ⇒ **تفكّ الكتم** (غير موثوقة وتعمل)
//   · نقر `.ytp-mute-button`   ⇒ يفكّ كذلك
//   · الخطوة **5** لا 4 — خطوة المضيف لا خطوتنا
//   · و`video.volume` يتبع المنزلق تماماً (95 ⇒ 0.95)
const fs = require("fs");
const vm = require("vm");
const { runContract } = require("./volume-contract.js");

function slice(from, to) {
  const t = fs.readFileSync("content.js", "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  return a === -1 || b === -1 ? null : t.slice(a, b);
}

const CONTENT = fs.readFileSync("content.js", "utf8");
const FRAMEWORK = slice("// ── البند #60 · قرار المالك 25", "// ── محوّل يوتيوب (#60 · قرار 25)");
const ADAPTERS = slice("// ── محوّل يوتيوب (#60 · قرار 25)", "function runAction");
const VOL = slice("// Volume delta in percent", "// Speed: SET absolute value");
const MUTE = slice("// Mute\n  if (action === \"ACTION:TOGGLE_MUTE\")", "// PiP");
const BADGE = slice("function showVolumeIndicator(video) {", "// -------------------------------------------");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ─────────────────────────────────────────────── عالم مشترك لكل المسارات
// يبني السلسلة الكاملة: runAction ⇒ الإطار ⇒ (المحوّل) ⇒ المضيف ⇒ الشارة.
// العقد يُجرى على **المسار كاملاً** لا على المحوّل معزولاً — لأن العطب الذي
// نحرسه وُلد في التقاء المسارات لا داخل أحدها.
function buildWorld(host, hostModel, prepare) {
  const timers = [];
  let seq = 0;
  const badges = [];
  const video = { muted: false, volume: 0.5 };
  const ctx = {
    console: { debug() {}, log() {}, warn() {} },
    // ⚠️ **ساعة افتراضية تُطلق المهل بترتيب استحقاقها لا بترتيب تسجيلها.**
    // أول رِكاز أطلقها بترتيب التسجيل، فوقع تحقّق الإطار (150ms) **قبل** إرسال
    // الخطوة (60ms)، فقرأت الشارة حالةً في منتصف السلسلة وخرج «ع3 مكسور» —
    // وهو **أثر مجدوِل لا عطب**. لا يُقرأ رقم قبل أن يستقرّ المقيس (قرار 22).
    setTimeout: (fn, ms) => { timers.push({ fn, dueAt: ctx.__clock + (ms || 0), seq: ++seq }); return seq; },
    clearTimeout: () => {},
    location: { host },
    baseDomain: (h) => h,
    nowMs: () => ctx.__clock,
    __clock: 1000,
    __typing: false,
    shouldIgnoreKeyBecauseTyping: () => ctx.__typing,
    KeyboardEvent: class { constructor(type, init) { Object.assign(this, { type }, init); } },
    Event: class { constructor(type, init) { Object.assign(this, { type }, init); } },
    // الشارة الحقيقية من content.js — فالثابت الثالث يُقاس على نصّها هي
    overlaySettings: { volumeAutoHideMs: 900 },
    soundDisplaySettings: { color: "#fff", fontSize: 48 },
    vzVolumeBadge: { textContent: "", classList: { add() {}, remove() {}, contains: () => false } },
    vzOverlay: { style: { setProperty() {} } },
    ensureVideoOverlay() {},
    positionOverlayToVideo() {},
    startOverlayTracking() {},
    video
  };
  ctx.vzOverlayVideo = video;
  // المضيف: يستقبل المفاتيح المُرسَلة ويطبّق نموذجه المُعايَر على العنصر
  const player = {
    tagName: "DIV", id: "movie_player",
    dispatchEvent(ev) { if (ev.type === "keydown" && hostModel) hostModel(ev.key, video); return true; }
  };
  ctx.document = { activeElement: { tagName: "INPUT" }, querySelector: (s) => (s === "#movie_player" ? player : null) };
  if (prepare) prepare(ctx);
  vm.createContext(ctx);
  vm.runInContext(`${FRAMEWORK}
    ${ADAPTERS}
    ${BADGE.replace("function showVolumeIndicator(video) {",
        "function showVolumeIndicator(video) { __badge(video);")}
    function runVolume(action, v) { const e = {}; const findVideoLoose = () => v; ${VOL} return false; }
    function runMute(v) { const action = "ACTION:TOGGLE_MUTE"; const e = {}; const findVideoLoose = () => v; ${MUTE} return false; }
  `, Object.assign(ctx, { __badge: (v) => badges.push(null) }));
  // نلتقط نصّ الشارة من العنصر بعد أن تكتبه الدالة الحقيقية
  const readBadge = () => ctx.vzVolumeBadge.textContent || null;
  const drain = () => {
    for (let i = 0; i < 200 && timers.length; i++) {
      timers.sort((a, b) => a.dueAt - b.dueAt || a.seq - b.seq);
      const t = timers.shift();
      ctx.__clock = Math.max(ctx.__clock, t.dueAt);
      t.fn();
    }
  };
  return { ctx, video, timers, drain, readBadge,
    vol: (a) => vm.runInContext("runVolume", ctx)(a, video),
    mute: () => vm.runInContext("runMute", ctx)(video) };
}

// ───────────────────────────────────── نماذج المضيفين — مُعايَرة بالقياس الحيّ
// يوتيوب: السهم يحرّك المنزلق ±5 **ولا يفكّ الكتم**، و`m` تقلبه. قِيس حيّاً.
const YT_STEP = 5;
function youtubeModel(key, v) {
  const level = Math.round(v.volume * 100);
  if (key === "ArrowUp") v.volume = Math.min(100, level + YT_STEP) / 100;
  else if (key === "ArrowDown") v.volume = Math.max(0, level - YT_STEP) / 100;
  else if (key === "m") v.muted = !v.muted;
}

// تويتش: **الكتم هو المنزلق على صفر**، و**ضبط المنزلق يفكّ الكتم بنفسه**،
// و`m` تقلب الكتم وتستعيد المستوى الكامن. مداه **0..1** لا 0..100. كلها مقيسة
// على `twitch.tv/caseoh_` — انظر ترويسة الملف.
const TW_STEP = 5;
function buildTwitchWorld() {
  const w = buildWorld("twitch.tv", null, (ctx) => {
    let latent = 0.5;
    class FakeInput {
      constructor() { this._v = "0.5"; this.min = "0"; this.max = "1"; this.step = "0.01"; this.type = "range"; this.className = "ScRangeInput-sc-q01wc3-1 hsrOE"; this.id = "player-volume-slider-1f2e3d4c-aaaa"; }
      get value() { return this._v; }
      set value(x) { this._v = String(x); }
      getBoundingClientRect() { return { width: 80, height: 10 }; }
      closest() { return null; }
      dispatchEvent(ev) {
        if (ev.type === "input") {           // نموذج تويتش: الضبط يفكّ الكتم
          ctx.video.muted = false;
          ctx.video.volume = Number(this._v);
          latent = Number(this._v);
        }
        return true;
      }
    }
    const slider = new FakeInput();
    const hidden = new FakeInput();
    hidden.getBoundingClientRect = () => ({ width: 0, height: 0 });
    const player = {
      tagName: "DIV",
      querySelectorAll: () => [hidden, slider],   // المخفي أولاً عمداً: القاعدة «المرئي يفوز» لا «الأول»
      dispatchEvent(ev) {
        if (ev.type !== "keydown" || ev.key !== "m") return true;
        if (ctx.video.muted) { ctx.video.muted = false; ctx.video.volume = latent; slider.value = String(latent); }
        else { latent = ctx.video.volume; ctx.video.muted = true; ctx.video.volume = 0; slider.value = "0"; }
        return true;
      }
    };
    ctx.window = { HTMLInputElement: FakeInput };
    ctx.document = { activeElement: { tagName: "INPUT" },
      querySelector: (sel) => (/player/.test(sel) ? player : null) };
    ctx.__mute = () => { latent = ctx.video.volume; ctx.video.muted = true; ctx.video.volume = 0; slider.value = "0"; };
    ctx.__latent = () => latent;
  });
  return w;
}

// ───────────────────────────────────────────────────────── المسارات المُعرَّفة
const PATHS = [
  {
    name: "المسار المباشر (بلا محوّل)",
    step: 4, eps: 0.51, mid: 50,
    badgeLevel: (lvl) => lvl,
    make(init) {
      const w = buildWorld("example.com", null);
      w.video.muted = init.muted; w.video.volume = init.level / 100;
      return {
        get: () => ({ muted: w.video.muted, level: Math.round(w.video.volume * 100) }),
        up: () => { w.vol("ACTION:VOLUME:+4"); w.drain(); },
        down: () => { w.vol("ACTION:VOLUME:-4"); w.drain(); },
        badge: () => w.readBadge()
      };
    }
  },
  {
    name: "محوّل youtube.com",
    step: YT_STEP, eps: 0.51, mid: 50,
    badgeLevel: (lvl) => lvl,
    make(init) {
      const w = buildWorld("youtube.com", youtubeModel);
      w.video.muted = init.muted; w.video.volume = init.level / 100;
      return {
        get: () => ({ muted: w.video.muted, level: Math.round(w.video.volume * 100) }),
        up: () => { w.vol("ACTION:VOLUME:+4"); w.drain(); },
        down: () => { w.vol("ACTION:VOLUME:-4"); w.drain(); },
        badge: () => w.readBadge()
      };
    }
  }
  ,{
    name: "محوّل twitch.tv",
    step: TW_STEP, eps: 0.51, mid: 50,
    badgeLevel: (lvl) => lvl,
    make(init) {
      const w = buildTwitchWorld();
      w.video.volume = init.level / 100;
      if (init.muted) vm.runInContext("__mute", w.ctx)();
      // **المستوى الذي يعنيه العقد هو ما سيسمعه المستخدم**: عند تويتش يخفي الكتمُ
      // المستوى (المنزلق صفر) ويحتفظ به كامناً، فالقراءة الصادقة هي الكامن.
      const level = () => Math.round((w.video.muted ? vm.runInContext("__latent", w.ctx)() : w.video.volume) * 100);
      return {
        get: () => ({ muted: w.video.muted, level: level() }),
        up: () => { w.vol("ACTION:VOLUME:+4"); w.drain(); },
        down: () => { w.vol("ACTION:VOLUME:-4"); w.drain(); },
        badge: () => w.readBadge()
      };
    }
  }
];

// ───────────────────────────── الشرط البنيوي: لا محوّل مسجَّل بلا مسار في العقد
console.log("\n[بنيوي] كل محوّل مسجَّل له مسار في العقد");
{
  const registered = [...CONTENT.matchAll(/hostAdapters\.set\(\s*"([^"]+)"/g)].map((m) => m[1]);
  console.log("   المسجَّلون: " + (registered.join(" · ") || "لا أحد"));
  for (const dom of registered) {
    check(`للمحوّل ${dom} مسار في العقد`,
      PATHS.some((p) => p.name.includes(dom)),
      "محوّل مسجَّل بلا نموذج مضيف مُعايَر — يُمنع قبل أن يُكتشف عطبه ميدانياً");
  }
  check("والمسار المباشر مشمول دائماً", PATHS.some((p) => p.name.includes("المباشر")));
}

// ✅ **لا تثبيتات مفتوحة.** كان هنا تثبيت لـ«ع1 مكسور في محوّل يوتيوب»، وأُزيل
// **في كومِت إصلاحه نفسه لا بعده** (سابقة #59)، وحلّ محلّه **فحص موجب** يحرس
// الإصلاح: ع1 يجب أن **ينجح** على المحوّل من الآن.
// ⚠️ **تثبيت مفتوح — سؤال دلالي لا عطب تنفيذ** (قرار 20 · وقرار 27: الدلالة
// الجديدة تدخل العقد **بقرار المالك** لا بتعديلي).
// **عند تويتش الكتمُ هو المنزلقُ على صفر**، والمستوى الحقيقي يبقى **كامناً
// مخفيّاً**. فينشأ سؤالان لا جواب لهما في العقد اليوم:
//   ع2 — «الخفض على مكتوم يُنزل المستوى فعلاً»: المنزلق في **قاعه** والكامن
//        لا يُنزَل إلا بفكّ الكتم — أي بإسماع صوت لم يُطلب. فالعملية تُعتذَر
//        اليوم ويتولّاها المسار المباشر، والكامن لا ينزل.
//   ع3 — الشارة تعرض `video.volume` أي **0**، بينما ما سيسمعه المستخدم عند
//        الفكّ هو **الكامن 50**. أيّهما «الحالة بعد العملية»؟
// **فشل هذا التثبيت يعني أن الدلالة حُسمت، فحدّثه ولا تُصلح الاختبار.**
const KNOWN_OPEN = { "محوّل twitch.tv": ["ع2", "ع3"] };

// ─────────────────────────────────────────────────── إجراء العقد على كل مسار
for (const path of PATHS) {
  console.log(`\n[عقد] ${path.name}`);
  const openHere = KNOWN_OPEN[path.name] || [];
  for (const r of runContract(path)) {
    if (openHere.includes(r.id)) {
      check(`${r.id} — **مثبَّت مكسوراً اليوم** (${r.detail})`, !r.ok,
        "⚠️ نجح وهو مثبَّت مكسوراً ⇒ العطب أُصلح: احذف التثبيت من KNOWN_OPEN ومن KNOWN-DEFECTS.md");
      continue;
    }
    check(`${r.id} — ${r.title}`, r.ok, r.detail);
  }
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
