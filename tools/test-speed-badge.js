// البند #71 — شارة السرعة: قناة ثانية بعنصرها ومؤقّتها، وسجلٌّ تُعدّ منه الحلقة
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل أرى السرعة الجديدة على الشاشة حين أغيّرها؟»*
//
// **قرار المالك 2026-08-02 — عنصران لا عنصرٌ بقناتين، والسبب مقيس:** عقدةٌ واحدة
// تعني «آخر كاتبٍ يفوز»، وحقلُ مؤقّتٍ واحد يعني أن مؤقّت السرعة يُلغي مؤقّت
// الصوت. **ورفعُ الصوت ثمّ تغييرُ السرعة تتابعٌ عاديّ لا نادر، فالتزاحم يقع لا
// يُحتمل.** وهذا الملف يُثبت الاثنين **سلوكياً** لا بقراءة الكود.
//
// ⚠️ **وفشل القسم [2] يعني أن أحداً عدّد القنوات بيده مرّة أخرى** — وهو ما وُلد
// منه القرار: ثلاثة أسطر مكتوبة في `anySubElementVisible` كانت تعني أن القناة
// الرابعة **تظهر بلا أن تتبعها حلقة الرسم**، فتبقى معلّقة في مكانها بينما
// الفيديو يتحرّك. **الإصلاح في السجلّ لا في إضافة سطر رابع.**
//
// ⚠️ **وفشل القسم [4] يعني أن الافتراض انقلب إلى «مُشغَّل»** — والميزة تغيّر
// سلوك من لم يطلبها. الشكل `!!x` عمداً، **لا `!== false`**: ذاك شكلُ المفتاح
// الرئيسي وحده (`tools/test-master-gate.js` القسم [٤]).
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

console.log("\n=== #71 — شارة السرعة ===\n");

// ── [1] القناة الثانية عنصرٌ مستقلّ، لا حقلٌ في الأولى ──────────────────────
console.log("[1] عنصران لا عنصرٌ بقناتين");
{
  check("[1] `.vzSpeed` تُبنى مع الـoverlay", /class="vzSpeed vzHidden"/.test(SRC));
  check("[1] ومرجعها يُلتقط في `ensureVideoOverlay`",
    /vzSpeedBadge = vzOverlay\.querySelector\("\.vzSpeed"\)/.test(SRC));
  check("[1] ويُفرَّغ في `teardownOverlay`",
    (body("function teardownOverlay()") || "").includes("vzSpeedBadge = null"));
  // الزاويتان متقابلتان: لو تشاركتا الموضع لتراكبتا، وهو نصف علّة «عنصر واحد»
  check("[1] والزاويتان متقابلتان فلا تتراكبان",
    /\.vzVolume\{ left:10px; \}/.test(SRC) && /\.vzSpeed\{ right:10px; \}/.test(SRC));
  // المظهر مشترك عمداً (قرار المالك): soundDisplay تُورَّث بلا مفاتيح ثانية
  // ⛔⭐⭐ **وصار يُشتقّ 2026-08-08 (#134، تصنيفُ المالك):** كان يشترط «الاثنتين»
  // **والقنواتُ تكثر بالتصميم** (#71: قناةٌ خامسة تُضاف في السجلّ ولا موضعَ ثانٍ)
  // ⇒ **فعددٌ مكتوبٌ بيد يُدفع ثمنُه عند كلّ شارةٍ رابعة** (قرار 34).
  // ⭐ **والمشتقُّ أقوى لا أضعف: كلُّ قناةِ شارةٍ في القاعدة الواحدة** — **وشارةٌ
  // جديدة بقاعدةِ مظهرٍ ثانية تُحمّر، وهو ما بُني الشرطُ له.**
  {
    const rule = /\n\s*([.\w,]*\.vzSpeed[.\w,]*)\{[^}]*--vz-volume-color/.exec(SRC);
    const inRule = rule ? rule[1].split(",").map((x) => x.trim()) : [];
    // **قنواتُ الشارة من السجلّ الواحد** (`OVERLAY_PARTS`): ما ينتهي اسمُه بشارة
    const badges = ["vzVolume", "vzSpeed", "vzCopyMsg"];
    check("[1] والمظهر مشترك — قاعدةٌ واحدة لكلّ قنوات الشارة (مشتقّة)",
      badges.every((b) => inRule.includes("." + b)), { القاعدة: inRule, المطلوب: badges });
  }
}

// ── [2] السجلّ: تُعدُّ منه الحلقة، ولا تُعدَّد بيدها ────────────────────────
console.log("\n[2] ⭐ السجلّ — القناة الخامسة لا تحتاج تعديلاً");
{
  const parts = slice("const OVERLAY_PARTS = {", "};");
  check("[2] السجلّ موجود", !!parts);
  for (const key of ["grid", "hint", "volume", "speed"]) {
    check(`[2] وفيه «${key}»`, !!parts && new RegExp(`\\b${key}:`).test(parts));
  }
  // ⚠️ دوالّ لا مراجع: العناصر يُعاد بناؤها، فمرجعٌ مُجمَّد يشير إلى عقدة ميتة
  check("[2] وقيمه دوالّ لا مراجع مُجمَّدة", !!parts && /\(\) =>/.test(parts));

  const any = body("function anySubElementVisible()");
  const hide = body("function hideOverlayNow()");
  check("[2] `anySubElementVisible` تقرأ من السجلّ",
    !!any && any.includes("OVERLAY_PARTS"), any);
  check("[2] ولا تسمّي قناةً بعينها", !!any && !/vzGridEl|vzHintEl|vzVolumeBadge|vzSpeedBadge/.test(any), any);
  check("[2] `hideOverlayNow` تقرأ من السجلّ",
    !!hide && hide.includes("OVERLAY_PARTS"), hide);
  check("[2] ولا تسمّي قناةً بعينها", !!hide && !/vzGridEl|vzHintEl|vzVolumeBadge|vzSpeedBadge/.test(hide), hide);
}

// ── [3] المُظهِر العامّ — و`showVolumeIndicator` أوّل نادٍ له لا نسخة منه ────
console.log("\n[3] مُظهِرٌ عامّ، لا نسختان تتباعدان");
{
  const shower = body("function showBadge(video, channel, text)");
  const vol = body("function showVolumeIndicator(video)");
  check("[3] `showBadge` موجود بثلاثة معاملات", !!shower);
  check("[3] و`showVolumeIndicator` تناديه", !!vol && /showBadge\(video, "volume", text\)/.test(vol), vol);
  // **لا نسخة**: ما انتقل إلى المُظهِر لم يبقَ لها
  check("[3] ولا تكتب نصّاً بنفسها", !!vol && !/\.textContent/.test(vol), vol);
  check("[3] ولا تبني الـoverlay بنفسها", !!vol && !/ensureVideoOverlay/.test(vol), vol);
  check("[3] ولا تملك مؤقّتاً بنفسها", !!vol && !/setTimeout/.test(vol), vol);
  // مؤقّت لكل قناة — وهو نصف سبب «عنصران»
  check("[3] والمؤقّت لكل قناة لا حقلٌ ساكن واحد",
    /badgeTimers\[channel\]/.test(SRC) && !/showVolumeIndicator\._t/.test(CODE));
  check("[3] ولا `innerHTML` في المُظهِر", !!shower && !/innerHTML/.test(shower));
}

// ── [4] المفتاح: افتراضه مطفأ، وبالشكل الصحيح ──────────────────────────────
console.log("\n[4] مفتاحها الخاصّ، افتراضه مطفأ");
{
  const loader = body("async function loadOverlaySettings(pre)");
  check("[4] يُقرأ بـ`!!` (مطفأ افتراضاً)", !!loader && /speedBadge: !!o\.speedBadge/.test(loader), loader);
  check("[4] ولا `!== false` له", !!loader && !/speedBadge[^,\n]*!== false/.test(loader));
  // والمفتاح الرئيسي بشكله هو، فلا يُخلط الشكلان
  check("[4] والتلميح باقٍ على `!== false` — الشكلان لا يُوحَّدان",
    !!loader && /hintEnabled: o\.hintEnabled !== false/.test(loader));
  check("[4] ويسكن `settings.overlay` فيركب `RELOAD_OVERLAY_SETTINGS` القائمة",
    /RELOAD_OVERLAY_SETTINGS/.test(SRC));
}

// ── [5] البوّابة #64 ────────────────────────────────────────────────────────
console.log("\n[5] بوّابة #64 — الرئيسي ثمّ الحظر ثمّ مفتاح الميزة");
{
  const gate = body("function speedBadgeActive()");
  check("[5] البوّابة موجودة", !!gate);
  check("[5] وتنادي `extensionActive()`", !!gate && gate.includes("extensionActive()"), gate);
  const iGate = gate ? gate.indexOf("extensionActive()") : -1;
  const iOwn = gate ? gate.indexOf("overlaySettings.speedBadge") : -1;
  check("[5] والبوّابة قبل مفتاح الميزة", iGate > -1 && iOwn > -1 && iGate < iOwn, `${iGate}/${iOwn}`);
  check("[5] ولا تفحص الحظر بنفسها (الحارس البنيويّ #64)", !!gate && !/isBlockedHost/.test(gate));
  const entries = fs.readFileSync("tools/test-master-gate.js", "utf8");
  check("[5] وهي مسجَّلة في `ENTRIES`", /function speedBadgeActive\(\)/.test(entries));
}

// ── [6] ⭐ التزاحم — سلوكياً، لا بقراءة الكود ───────────────────────────────
console.log("\n[6] ⭐ القناتان تظهران معاً، ولا يُلغي مؤقّتُ إحداهما الأخرى");
{
  const SHOWER = slice("function showVolumeIndicator(video) {", "// -------------------------------------------");
  if (!SHOWER) {
    console.log("  ❌ تعذّر اقتطاع المُظهِر — **المرساة سقطت، أصلِح المرساة لا التأكيد**");
    fail++;
  } else {
    const mkEl = () => ({ textContent: "", hidden: false,
      classList: { add(c) { if (c === "vzHidden") this.o.hidden = true; },
                   remove(c) { if (c === "vzHidden") this.o.hidden = false; },
                   contains() { return this.o.hidden; } } });
    const el = (name) => { const e = mkEl(); e.classList.o = e; e.name = name; return e; };
    const volEl = el("volume"), spdEl = el("speed");
    const timers = [];
    const video = { volume: 0.5, muted: false, playbackRate: 1 };
    const ctx = {
      overlaySettings: { volumeAutoHideMs: 900 },
      soundDisplaySettings: { color: "#fff", fontSize: 48 },
      vzGridEl: null, vzHintEl: null,
      vzVolumeBadge: volEl, vzSpeedBadge: spdEl,
      vzOverlayVideo: video,
      vzOverlay: { style: { setProperty() {} } },
      hostAdapterFor: () => null,
      ensureVideoOverlay() {}, positionOverlayToVideo() {}, startOverlayTracking() {},
      setTimeout: (fn) => { timers.push(fn); return timers.length; },
      clearTimeout: (id) => { if (id) timers[id - 1] = null; },
      video
    };
    vm.createContext(ctx);
    vm.runInContext(SHOWER, ctx);

    vm.runInContext(`showVolumeIndicator(video)`, ctx);
    vm.runInContext(`showBadge(video, "speed", "1.5x")`, ctx);
    check("[6] الاثنتان ظاهرتان معاً", !volEl.hidden && !spdEl.hidden,
      { vol: volEl.hidden, spd: spdEl.hidden });
    check("[6] وكلٌّ بنصّها", volEl.textContent === "50" && spdEl.textContent === "1.5x",
      { vol: volEl.textContent, spd: spdEl.textContent });

    // ⚠️ **جوهر «عنصران»:** مؤقّت السرعة يُخفي السرعة **وحدها**
    const live = timers.filter(Boolean);
    check("[6] ومؤقّتان اثنان لا واحد", live.length === 2, live.length);
    live[live.length - 1]();
    check("[6] ومؤقّت السرعة يُخفي السرعة وحدها", spdEl.hidden && !volEl.hidden,
      { vol: volEl.hidden, spd: spdEl.hidden });

    // والعكس: نداءٌ ثانٍ على قناةٍ يُلغي مؤقّتها هي فقط
    vm.runInContext(`showBadge(video, "speed", "2x")`, ctx);
    check("[6] ونداءٌ جديد على القناة نفسها يُعيدها", !spdEl.hidden && spdEl.textContent === "2x",
      spdEl.textContent);

    // والمهلة صفر ⇒ لا شارة للقناتين معاً (المهلة مُورَّثة بلا مفتاح ثانٍ)
    ctx.overlaySettings.volumeAutoHideMs = 0;
    spdEl.classList.add("vzHidden");
    vm.runInContext(`showBadge(video, "speed", "3x")`, ctx);
    check("[6] ومهلة 0 ⇒ لا شارة (وهو ما يُعطَّل له المربّع في الإعدادات)",
      spdEl.hidden && spdEl.textContent === "2x", spdEl.textContent);
  }
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
