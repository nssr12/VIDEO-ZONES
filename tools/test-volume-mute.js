// البند #35 — الكتم والمستوى حقيقتان مستقلتان.
//
// **العَرَض:** فيديو مكتوم بمستوى **غير صفري** ⇒ أول ضغطة «رفع صوت» تفكّ الكتم
// **ولا ترفع شيئاً**، فيسمع المستخدم مستواه القديم لا مستوى أعلى.
//
// السبب كان شرط قراءة واحداً يستنتج الكتم من الصفر ثم يتفرّع عنه، فيخرج مسار
// الرفع بلا زيادة. والعَرَض الثالث (المؤشّر يعرض قيمة قديمة) **تابع لهذا**: النداء
// كان بعد التغيير دائماً، لكن لا تغيير وقع أصلاً — فيسقط بسقوطه بلا لمس المؤشّر.
//
// ⚠️ فشل القسم [4] يعني أن قصّ `0.0001` أُزيل. القصّ **ليس بقيّة من هذا العطب**:
// يحمي من استنتاج **المضيف** للكتم من مستوى صفر، لا من استنتاجنا نحن. استنتاجنا
// زال مع #35، واستنتاج المضيف باقٍ لأنه ليس ملكنا. لا «تُنظّفه».
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  return a === -1 || b === -1 ? null : t.slice(a, b);
}

const CONTENT = fs.readFileSync("content.js", "utf8");
const VOL = slice("content.js", "// Volume delta in percent", "// Speed: SET absolute value");
// إطار المحوّلات (#60) يُحقن **كما هو** لا كبديل مزيّف: هذه الاختبارات تصف مسار
// «لا محوّل مسجَّل»، وهو المسار الذي يجب أن يبقى مطابقاً لما قبل الإطار حرفياً.
const ADAPTER = slice("content.js", "// ── البند #60 · قرار المالك 25", "// ── محوّل يوتيوب (#60 · قرار 25)");
const BADGE = slice("content.js", "function showVolumeIndicator(video) {", "// -------------------------------------------");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// المستوى عشريّ، فالمقارنة بهامش لا بتساوٍ حرفي
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ------------------------------------------------------- مسار ACTION:VOLUME
// كتلة الصوت تُقتطع من content.js نفسه وتُشغَّل كما هي: اختبار على الكود لا على
// نسخة منه. `findVideoLoose` مُعرَّفة في نطاق الدالة فترى المعامل، بينما
// `const video` داخل الـ if لها نطاق كتلتها — فلا تظليل ولا TDZ.
const runner = VOL && ADAPTER && vm.runInNewContext(
  `(function (recordIndicator) {
     let showVolumeIndicator = recordIndicator;
     const location = { host: "example.com" };
     const baseDomain = (h) => h;
     ${ADAPTER}
     return function runVolume(action, v) {
       const e = {};
       const findVideoLoose = () => v; const actionVideo = (e) => e.__videoUnderPointer || findVideoLoose(e);
       ${VOL}
       return false;
     };
   })`,
  { console, setTimeout }
);

// تُرجع الحالة النهائية **ولقطة لحظة نداء المؤشّر** — بها وحدها يُبرهن أن النداء
// بعد التغيير لا قبله.
function apply(action, video) {
  let snap = null;
  const fn = runner((v) => { snap = { muted: v.muted, volume: v.volume }; });
  const ok = fn(action, video);
  return { ok, video, snap };
}

console.log("\n[1] المكتوم بمستوى غير صفري + رفع ⇒ يُفكّ الكتم **وتُطبَّق الزيادة**");
{
  const r = apply("ACTION:VOLUME:+4", { muted: true, volume: 0.5 });
  check("رجعت true", r.ok === true);
  check("فُكّ الكتم", r.video.muted === false);
  check("والمستوى زاد بالدلتا في الضغطة نفسها: 0.54", near(r.video.volume, 0.54), r.video.volume);
  // ⚠️ هذا التأكيد بالذات هو ما كان يفشل قبل #35 — كان يبقى 0.5
  check("أي أن الضغطة الأولى لم تعد بلا أثر", !near(r.video.volume, 0.5));

  // وضغطة ثانية تكمل من حيث انتهت الأولى، لا من مستوى قديم
  const r2 = apply("ACTION:VOLUME:+4", r.video);
  check("والضغطة الثانية تُكمل: 0.58", near(r2.video.volume, 0.58), r2.video.volume);
}

console.log("\n[2] المكتوم + خفض ⇒ **يبقى مكتوماً** والمستوى الكامن ينخفض (سليم سلفاً — تثبيت)");
{
  const r = apply("ACTION:VOLUME:-4", { muted: true, volume: 0.5 });
  check("بقي مكتوماً — المستخدم لم يطلب صوتاً", r.video.muted === true);
  check("والمستوى الكامن انخفض: 0.46", near(r.video.volume, 0.46), r.video.volume);
  check("رجعت true", r.ok === true);

  // وغير المكتوم لا يُكتم بالخفض — الاتجاه الآخر من «لا يُصفَّر المستوى ليُكتم»
  const u = apply("ACTION:VOLUME:-4", { muted: false, volume: 0.5 });
  check("وغير المكتوم يبقى غير مكتوم بعد الخفض", u.video.muted === false);
}

console.log("\n[3] مستوى صفر + رفع ⇒ volume = delta (سلوك سليم، يُثبَّت كما هو)");
{
  const r = apply("ACTION:VOLUME:+4", { muted: false, volume: 0 });
  check("المستوى صار الدلتا نفسها: 0.04", near(r.video.volume, 0.04), r.video.volume);
  check("وما زال غير مكتوم", r.video.muted === false);

  const m = apply("ACTION:VOLUME:+4", { muted: true, volume: 0 });
  check("والمكتوم عند صفر: يُفكّ الكتم والمستوى 0.04",
    m.video.muted === false && near(m.video.volume, 0.04), m.video.volume);
}

console.log("\n[4] قصّ 0.0001 — باقٍ، ويحمي من استنتاج **المضيف** لا استنتاجنا");
{
  const r = apply("ACTION:VOLUME:-4", { muted: false, volume: 0.02 });
  check("الخفض تحت الصفر يُقصّ إلى 0.0001 بالضبط", r.video.volume === 0.0001, r.video.volume);
  check("**وليس صفراً** — الصفر يجعل مواقع تكتم تلقائياً", r.video.volume !== 0);
  check("ولا يُكتم العنصر عند القصّ", r.video.muted === false);
  check("والقيمة نصّاً 0.0001 لا رقم آخر", /next <= 0 \? 0\.0001 :/.test(VOL));
  // الحارس ضد الحذف سهواً: التعليق يجب أن يذكر أن الحامي خارجي لا داخلي
  check("وفوقه تعليق يقول إن الحامي منه المضيف لا نحن",
    /HOST\s*\n?\s*\/\/\s*SITE|HOST SITE/i.test(VOL) && /inference of\s*\n?\s*\/\/\s*ours|inference of ours/i.test(VOL));
}

console.log("\n[5] لا استنتاج للكتم من مستوى صفر — البند 1 من النطاق");
{
  check("لا شرط `=== 0` على المستوى في كتلة الصوت", !/volume[^\n]*===\s*0/.test(VOL), VOL.match(/.*===\s*0.*/)?.[0]);
  check("و`video.muted = false` مشروط بالدلتا الموجبة وحدها",
    /if \(delta > 0 && video\.muted\) video\.muted = false;/.test(VOL));
  check("ولا إسناد ثانٍ لـ muted في الكتلة",
    (VOL.match(/video\.muted\s*=/g) || []).length === 1);
  check("ولا تصفير للمستوى في أي مسار (لا يُصفَّر ليُكتم)",
    !/video\.volume\s*=\s*0\s*;/.test(VOL));
}

console.log("\n[6] السقف والحالة العادية");
{
  const hi = apply("ACTION:VOLUME:+4", { muted: false, volume: 0.98 });
  check("الرفع فوق 1 يُقصّ إلى 1", near(hi.video.volume, 1), hi.video.volume);
  const n = apply("ACTION:VOLUME:+4", { muted: false, volume: 0.5 });
  check("وغير المكتوم يرتفع كما كان: 0.54", near(n.video.volume, 0.54), n.video.volume);
  const bad = apply("ACTION:VOLUME:abc", { muted: false, volume: 0.5 });
  check("وقيمة غير رقمية تُرجع false بلا لمس العنصر",
    bad.ok === false && near(bad.video.volume, 0.5));
}

console.log("\n[7] المؤشّر يُنادى **بعد** التغيير — لقطة لحظة النداء");
{
  const r = apply("ACTION:VOLUME:+4", { muted: true, volume: 0.5 });
  check("نودي المؤشّر", r.snap !== null);
  check("ولقطته تساوي الحالة النهائية: 0.54", r.snap && near(r.snap.volume, 0.54), r.snap?.volume);
  check("وفيها الكتم مفكوك فعلاً", r.snap && r.snap.muted === false);
  const d = apply("ACTION:VOLUME:-4", { muted: true, volume: 0.5 });
  check("وفي الخفض: اللقطة 0.46 والكتم باقٍ",
    d.snap && near(d.snap.volume, 0.46) && d.snap.muted === true, d.snap);
}

// --------------------------------------------------------------- الشارة
// قناتان في العرض لا خانة واحدة: المستوى دائماً، والكتم علامة إلى جانبه.
function badge({ muted, volume }) {
  const badgeEl = { textContent: "", classList: { remove() {}, add() {}, contains: () => false } };
  const setProps = [];
  const video = { muted, volume };
  const ctx = {
    console, video, badgeEl, setProps,
    overlaySettings: { volumeAutoHideMs: 900 },
    soundDisplaySettings: { color: "#ff0000", fontSize: 48 },
    vzVolumeBadge: badgeEl,
    vzOverlayVideo: video,
    vzOverlay: { style: { setProperty: (k, v) => setProps.push([k, v]) } },
    // هذي الاختبارات تصف مسار **لا محوّل**، فالسجلّ يُجيب بلا محوّل — لا بديل مزيّف
    hostAdapterFor: () => null,
    ensureVideoOverlay() {},
    positionOverlayToVideo() {},
    startOverlayTracking() {},
    setTimeout: () => 0,
    clearTimeout() {}
  };
  vm.runInNewContext(BADGE + "\nshowVolumeIndicator(video);", ctx);
  return { text: badgeEl.textContent, setProps };
}

console.log("\n[8] الشارة تعرض المستوى في الحالتين، والكتم علامة مستقلة");
{
  check("غير مكتوم عند 45% ⇒ «45»", badge({ muted: false, volume: 0.45 }).text === "45",
    badge({ muted: false, volume: 0.45 }).text);
  check("مكتوم عند 45% ⇒ المستوى **يُعرض** ومعه العلامة",
    badge({ muted: true, volume: 0.45 }).text === "مكتوم 45",
    badge({ muted: true, volume: 0.45 }).text);
  // ⚠️ كان يعرض «0» لأي مكتوم مهما كان مستواه — فخفض مستوى مكتوم لا يُرى
  check("ولم يعد يعرض 0 لكل مكتوم", badge({ muted: true, volume: 0.45 }).text !== "0");
  check("وخفض مستوى مكتوم يُرى: 46 ثم 42",
    badge({ muted: true, volume: 0.46 }).text === "مكتوم 46" &&
    badge({ muted: true, volume: 0.42 }).text === "مكتوم 42");
  check("والمكتوم عند صفر ⇒ «مكتوم 0»", badge({ muted: true, volume: 0 }).text === "مكتوم 0");
  check("و«0» وحدها صارت تعني شيئاً واحداً: مستوى صفر بلا كتم",
    badge({ muted: false, volume: 0 }).text === "0");
  check("و100% تُعرض 100", badge({ muted: false, volume: 1 }).text === "100");
}

console.log("\n[9] الشارة: نصّ لا DOM، وتحترم soundDisplay القائمة");
{
  const b = badge({ muted: true, volume: 0.45 });
  const keys = b.setProps.map(([k]) => k);
  // ⚠️ **مرساةٌ صُحّحت لا تأكيدٌ أُضعف (قرار 33، #71):** كان النمط يسمّي
  // `vzVolumeBadge` بعينه، وقد **انتقلت الكتابة إلى `showBadge` العامّ** فصارت
  // على عنصر القناة. **والنيّة نفسها — نصٌّ لا HTML** — ويحرسها معه السطر
  // التالي، **ومَن يكتب في العنصر الصحيح يُبرهَن سلوكياً في القسم [8]**:
  // كل تأكيداته يقرأ نصَّه من `badgeEl` نفسه، فلو كتبت الشارة في غيره لاحمرّت.
  check("تُكتب بـ textContent", /\.textContent = /.test(BADGE));
  check("ولا innerHTML في الشارة إطلاقاً", !/innerHTML/.test(BADGE));
  check("ولا إنشاء عنصر جديد", !/createElement/.test(BADGE));
  check("واللون من soundDisplay", keys.includes("--vz-volume-color"));
  check("والحجم من soundDisplay", keys.includes("--vz-volume-size"));
  check("ولا إعداد جديد في الشارة", !/settings\./.test(BADGE));
  // على **الكود** لا على التعليقات: علامة ⚠️ في تعليق تحذيري ليست رمزاً في الشارة.
  check("والعلامة نصّية لا رمز تعبيري (الرمز الملوّن يتجاهل اللون)",
    !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(BADGE.replace(/\/\/.*$/gm, "")));
}

console.log("\n[10] ما لا يجوز أن يتغيّر مع البند");
{
  // بعد إطار المحوّلات (#60) صار القلب داخل `applyDirect`، وهو **نفسه** ما
  // يستدعيه المحوّل عند السقوط — فالحارس على «قلب بحت في مسار واحد» لا على موضعه.
  check("TOGGLE_MUTE ما زال قلباً بحتاً لـ muted داخل applyDirect",
    /if \(action === "ACTION:TOGGLE_MUTE"\)[\s\S]{0,400}?const applyDirect = \(\) => \{\s*video\.muted = !video\.muted;\s*\};/.test(CONTENT));
  const mute = slice("content.js", '// Mute\n  if (action === "ACTION:TOGGLE_MUTE")', "// PiP");
  check("ولا يكتب في المستوى", mute && !/video\.volume\s*=/.test(mute));
  check("وما زال ينادي المؤشّر", mute && /showVolumeIndicator\(video\);/.test(mute));
  // المالكان منفصلان: هذا المسار يملك volume/muted، والمعزّز يملك gain وحده
  check("ولا كتابة لعقدة الكسب في مسار الصوت — المعزّز مالكها الوحيد",
    !/\bgain\b|boostMap/.test(VOL));
  check("ولا كتابة volume/muted خارج runAction",
    (CONTENT.match(/video\.volume\s*=/g) || []).length === 1 &&
    (CONTENT.match(/video\.muted\s*=(?!=)/g) || []).length === 2);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
