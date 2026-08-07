// #112 — **ملءُ الشاشة على لقطةٍ محفوظة** (م12 · م14 — ⛔ **و`م13` تُقاس ولا تُرفع**).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«وفي ملء الشاشة — أيختفي الشريطُ كما
// يختفي في النافذة، ويعمل زرُّ السرعة بالعجلة بلا أن يقع أمرُ المربّع؟»*
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يحمّل شجرةً ولقطةَ
// أنماطٍ في متصفّح وينتظر مهلَ سكونٍ حقيقيّة، **فثمنُه في كلّ كومِتٍ بلا مقابل.**
// **ومُطلِقُه: كلُّ مسٍّ لمحرّك السكون أو لمسار الحقن، ورفعُ النسخة.**
//
// ── ⭐⭐ شجرةٌ من لقطةٍ وأنماطٌ من أخرى — **والثمنُ قِيس قبل البناء** ────────
// **لقطةُ النافذة 4.9MB منها 4.4 أنماط**، **وشجرةُ ملء الشاشة 653KB وحدَها.**
// ✅ **وشرطُ الدمج قِيس ولم يُفترض: بصمةُ الأنماط في الحالين واحدة** —
// `18f59329260261f8` · **4,400,548 بايت في الحالين**، من الصفحة والبناء نفسِهما.
//
// ── ⛔⭐⭐ وشرطا إعادة التشغيل — **يُقرآن من الترويسة ولا يُثبَّت رقمٌ هنا** ──
// **اللقطةُ تُجمّد ما كتبه سكربتُ المضيف في العنصر لحظتَها** (`style` الفيديو:
// `800×450 @ 0,75`)، **وذاك الخرْجُ صحيحٌ في شرطَي التقاطه لا في غيرهما:**
//   **(أ) المنظور** — و`tools/snapshot-source.mjs` يقرؤه من `.meta.json`.
//   **(ب) ملءُ الشاشة الحقيقيّ على العنصر المُسجَّل** (`#movie_player`).
// ⛔⭐ **والثاني لا يُصنع بمقاسٍ ولا بصنف، والسببُ مقيس:** عرضُ سلسلة يوتيوب في
// ملء الشاشة يأتي من قواعد `:fullscreen` **في ورقة المتصفّح نفسِه** — **وأوراقُ
// يوتيوب تحوي `:fullscreen` صفرَ مرّة** ⇒ **فما يُعطي العرضَ ليس فيها ولا يُلتقط.**
// **والمقيس بالمقاس وحده:** عرضُ `#movie_player` **صفر** والفيديو عند `x=800`
// **خارجَ المنظور** ⇒ **لا طبقةَ ولا زرّ — فيُقرأ «امتناع» وهو «لم أُنتج الحال».**
// ⇒ ⭐ **ولهذا لم تكفِ تسويةُ المقاس وحدَها، وقد كانت هي التشخيص المكتوب.**
//
// ── ⚠️ وما هو خارجُ مدى هذي اللقطة بنيويّاً — يُقال ولا يُترك فراغاً ─────────
// **`م11` (قائمةُ إعدادات المشغّل تبقى ظاهرةً بعد رفع اليد) خارجَ المدى**:
// **القائمةُ كانت مغلقةً لحظةَ الالتقاط** (`meta.produced.قائمةُ_الإعدادات = false`)
// **واللقطةُ تُجمّد ما كان، فلا شيءَ يفتحها بعد نزع السكربتات** ⇒ **تبقى للمالك.**
// **وكذلك: التشغيلُ الحيّ · وانتقالُ SPA · وإعادةُ بناء المضيف لشريطه.**
//
//   node tools/bench-112-fullscreen-snapshot.mjs
//   node tools/bench-112-fullscreen-snapshot.mjs --red <commit>       # content.js من السجلّ
//   node tools/bench-112-fullscreen-snapshot.mjs --red-file <ملفّ>    # بمتغيّرٍ واحد
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { launch, openPageAsHost, applyReplay, contentWorld, evalIn, killChrome, configure,
         refuseUnknownFlags, ROOT } from "./ext-harness.mjs";
import { loadSnapshot, mergeCss, frozenVideoBox, REPLAY_ANCHORS, STATE_WINDOW, STATE_FULLSCREEN }
  from "./snapshot-source.mjs";

const PORT = 9813;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const argOf = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const RED = argOf("--red");
const RED_FILE = argOf("--red-file");
refuseUnknownFlags(["--red", "--red-file"]);

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra === undefined ? "" : JSON.stringify(extra).slice(0, 200)));

// ── الشجرةُ من حال ملء الشاشة، والأنماطُ من حال النافذة — **بالحال لا بالترتيب** ──
const tree = loadSnapshot(STATE_FULLSCREEN);
const donor = loadSnapshot(STATE_WINDOW);
const HTML = mergeCss(tree.html, donor.html, donor.file);
const FROZEN = frozenVideoBox(tree.html);
if (!FROZEN) { console.log("❌ لا صندوقَ مُجمَّداً في `style` الفيديو — ولا مرجعَ يُحكم به على إعادة التشغيل"); process.exit(1); }

// ⛔ **نسخةُ إضافةٍ بـ`content.js` من السجلّ أو من ملفٍّ بمتغيّرٍ واحد** (قرار 47)
function extWith(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vz-fs-red-"));
  for (const f of fs.readdirSync(ROOT)) {
    if ([".git", "node_modules", "tools", "docs"].includes(f)) continue;
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  fs.writeFileSync(path.join(dir, "content.js"), source);
  return dir;
}

const IDLE_MS = 400;
const SETTINGS = {
  settings: {
    enabled: true, idle: { ms: IDLE_MS },
    overlay: { autoHideMs: 3000, volumeAutoHideMs: 3000, enabled: true,
               speedButton: true, speedButtonPreset: 2, filterButton: true,
               progressBarMode: "idle",
               barButtons: [{ id: "speed", on: true }, { id: "filter", on: true }] },
    zones: { enabled: true, fullscreenOnly: false, gridCoverage: "player",
             // ⭐⭐ **المربّعاتُ التسعة مربوطةٌ عمداً — والسببُ مقيس لا احتياطيّ:**
             // م14 تشترط أن **لا يقع أمرُ المربّع** حين تدور العجلةُ على الزرّ،
             // **وشرطُ نفيٍ يُختبَر في مربّعٍ بلا ربطٍ يصدق بلا معنى.** والزرُّ
             // في شريط المضيف **في الصفّ الأسفل** (`y≈570` من `600`) ⇒ **المربّع
             // 7–9 لا 4–6**، وأوّلُ صياغةٍ ربطت 4–6 وحدَها **فكان الشرطُ أخضرَ
             // لأن الظاهرة لا تقع هناك أصلاً** — وهي أختُ «حالٍ لم تُنتَج».
             // ⇒ **والتسعةُ تُغني عن أن يُعاد حسابُ المربّع كلّما تحرّك الزرّ.**
             wheel: { map: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((z) =>
               [String(z), { up: ["ACTION:VOLUME:+5"], down: ["ACTION:VOLUME:-5"] }])) } }
  },
  globalSiteRules: { enabled: true, mappings: [] }
};

const STATE = `(() => {
  const vis = (s) => { const e = document.querySelector(s);
    return e ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : null; };
  const v = document.querySelector("video");
  return { صنفُنا: document.documentElement.classList.contains("vz-idle-hide-progress"),
           شريط: vis(".ytp-chrome-bottom"), وقت: vis(".ytp-time-display"),
           أزرار: vis(".ytp-right-controls"), عنوان: vis(".ytp-fullscreen-metadata"),
           صفُّ_إجراءات: vis(".ytp-fullscreen-quick-actions"),
           زرُّ_المزيد: vis(".ytp-fullscreen-grid-expand-button"),
           سينما: vis(".ytp-size-button"), زرُّ_السرعة: vis(".vzSpeedBtn"),
           سرعة: v ? v.playbackRate : null, صوت: v ? Math.round(v.volume * 100) : null }; })()`;

async function run() {
  const extPath = RED ? extWith(execFileSync("git", ["show", `${RED}:content.js`], { cwd: ROOT, maxBuffer: 64e6 }))
    : RED_FILE ? extWith(fs.readFileSync(RED_FILE))
    : ROOT;
  // ⛔ **مقاسُ النافذة يُشتقّ من الترويسة ولا يُكتب** (قرار 34 مطبَّقاً على رِكاز)
  const h = await launch(PORT, { extPath,
    extra: [`--window-size=${tree.replay.viewport.w},${tree.replay.viewport.h}`] });
  const R = {};
  try {
    await sleep(1200);
    await configure(PORT, h.extensionId, SETTINGS);
    const { c } = await openPageAsHost(PORT, { html: HTML,
      contentType: "application/xhtml+xml; charset=utf-8" });
    await sleep(2500);
    // ⛔⭐⭐ **تُنتَج شروطُ اللقطة ثمّ يُقاس** — ولا يُقاس على حالٍ لم تُنتَج
    R.أُنتج = await applyReplay(c, tree.replay);
    await sleep(1200);
    const w = (await contentWorld(c))?.id;
    if (!w) throw new Error("عالمُ الإضافة غائب — ولا يُقاس بلا عالم");
    R.anchors = await evalIn(c, `(() => { const q = (s) => document.querySelectorAll(s).length;
      const st = document.querySelector("style[data-vz-snapshot-css]");
      return { ytp: q('[class*="ytp-"]'), bottom: q(".ytp-chrome-bottom"),
               cssBytes: st ? st.textContent.length : 0,
               cssFrom: st ? st.getAttribute("data-vz-from") : null,
               host: location.hostname }; })()`, w);
    R.مرساة = await evalIn(c, REPLAY_ANCHORS, w);
    // ⚠️ **الإحداثيّاتُ المطلقة للقيادة، والنسبيّةُ للمقارنة** — ولا يُخلط البابان
    const v = { x: R.مرساة.مطلقٌ.left + Math.round(R.مرساة.فيديو.w / 2),
                y: R.مرساة.مطلقٌ.top + Math.round(R.مرساة.فيديو.h / 2),
                w: R.مرساة.فيديو.w, h: R.مرساة.فيديو.h };
    R.v = v;
    // ⚠️ **يُقرأ حالُ طبقتنا قبل الحكم** — **«لا زرّ» قد تعني «لم تُبنَ الطبقة»
    // وقد تعني «بُنيت ولم يُحقن»، وهما سببان لا واحد** (قرار 42).
    R.طبقة = await evalIn(c, `(() => ({
      طبقتُنا: document.querySelectorAll(".vzWrap").length,
      أزرارُنا: document.querySelectorAll(".vzBtn").length,
      في_الشريط: document.querySelectorAll(".ytp-right-controls .vzBtn").length }))()`, w);
    const until = async (pred, ms = 12000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        const st = await evalIn(c, STATE, w);
        if (st && pred(st)) return { ...st, بعد_ms: Date.now() - t0 };
        await sleep(150);
      }
      return { ...(await evalIn(c, STATE, w)), بعد_ms: null, انقضت_المهلة_ms: ms };
    };
    const مخفيّ = (st) => st.صنفُنا === true && st.شريط === false;
    const move = async (n = 6) => { for (let i = 0; i < n; i++) {
      await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: v.x + (i % 2 ? 8 : -8), y: v.y + 4 });
      await sleep(120); } };

    R.قبل = await evalIn(c, STATE, w);

    // ── م12: يختفي بكامله في ملء الشاشة (كما م1 في النافذة) ────────────────
    await move();
    R.م12 = await until(مخفيّ);

    // ── ⚪ م13: تُقاس ولا تُرفع — لا شاهدَ حمرةٍ لها بعد ────────────────────
    // ⛔ **الحالُ تُنتَج: يُظهَر أوّلاً ثمّ يُضغَط ويُترك مضغوطاً** — **وقياسٌ
    // على شريطٍ مخفيٍّ سلفاً يقيس الإخفاء لا الامتناع.**
    await move(2);
    await sleep(300);
    const holdY = v.y + Math.round(v.h / 2) - 20;
    await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: v.x, y: holdY, button: "left", clickCount: 1 });
    await sleep(IDLE_MS * 6);
    R.م13 = await evalIn(c, STATE, w);
    await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: v.x, y: holdY, button: "left", clickCount: 1 });

    // ── م14: العجلةُ على زرّ السرعة تُغيّر السرعة ولا تُنفّذ أمرَ المربّع ──
    await move(3);
    const btn = await evalIn(c, `(() => { const b = document.querySelector(".vzSpeedBtn");
      if (!b || !b.checkVisibility({ opacityProperty: true })) return null;
      const r = b.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return null;
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
               w: Math.round(r.width), في_الشريط: !!b.closest(".ytp-right-controls") }; })()`, w);
    R.زرّ = btn;
    if (btn) {
      // ⚠️ **مدىً قبل الحكم على السكون** (الشاهد الثالث في قرار 26): المستوى على
      // `1.0` **لا مكان له يصعد إليه**، و`ACTION:VOLUME:+5` تُقصَّ عنده ⇒ **فشرطُ
      // «الصوتُ لم يتغيّر» يصدق بلا معنى**، و«لا مكان للصعود» تطبع ما تطبعه
      // «لم يقع أمرُ المربّع». ⇒ **فيُهبَط المستوى ليصير للحركة مدى.**
      await evalIn(c, `(() => { const v = document.querySelector("video");
        if (v) v.volume = 0.5; return v ? v.volume : null; })()`, w);
      R.م14قبل = await evalIn(c, STATE, w);
      await c.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: btn.x, y: btn.y, deltaX: 0, deltaY: -40 });
      await sleep(600);
      R.م14 = await evalIn(c, STATE, w);
    }
    try { c.ws.close(); } catch {}
  } finally {
    killChrome(h);
    if (extPath !== ROOT) { try { fs.rmSync(extPath, { recursive: true, force: true }); } catch {} }
  }
  return R;
}

console.log(`\n=== #112 — ملءُ الشاشة على لقطةٍ محفوظة ===`);
console.log(`  الشجرة : ${tree.file}`);
console.log(`  الأنماط: ${donor.file}`);
console.log(`  الشروطُ المسجَّلة: منظور ${tree.replay.viewport.w}×${tree.replay.viewport.h}` +
  ` · ملءُ الشاشة على ${tree.replay.fullscreenSelector || "لا شيء"}`);
console.log(`  وصندوقُ المضيف المُجمَّد: ${FROZEN.w}x${FROZEN.h}@${FROZEN.left},${FROZEN.top}`);
if (RED) console.log(`  ⚠️ **شاهدُ حمرة**: content.js من \`${RED}\``);
if (RED_FILE) console.log(`  ⚠️ **شاهدُ حمرة بمتغيّرٍ واحد**: ${RED_FILE}`);

const r = await run();

console.log("\n[0] المراسي — تُؤكَّد قبل أن يُقاس شيء");
console.log(`  · أُنتج: ${JSON.stringify(r.أُنتج)} · طبقتُنا: ${JSON.stringify(r.طبقة)}`);
check("[0] الصفحةُ تحت اسم المضيف", r.anchors?.host === "www.youtube.com", r.anchors);
check("[0] ⭐⭐ وأنماطُ لقطة النافذة مُحقَنةٌ في شجرة ملء الشاشة",
  (r.anchors?.cssBytes || 0) > 4000000 && !!r.anchors?.cssFrom, r.anchors);
check("[0] وعناصرُ المشغّل حاضرة", (r.anchors?.ytp || 0) > 400 && r.anchors?.bottom === 1, r.anchors);
check("[0] ⭐ والمنظورُ كما سُجّل في الترويسة",
  r.مرساة?.منظور?.w === tree.replay.viewport.w && r.مرساة?.منظور?.h === tree.replay.viewport.h,
  { الآن: r.مرساة?.منظور, المسجَّل: tree.replay.viewport });
check("[0] ⭐ وملءُ الشاشة على العنصر المُسجَّل",
  r.مرساة?.ملءُ_الشاشة === tree.replay.fullscreenSelector,
  { الآن: r.مرساة?.ملءُ_الشاشة, المسجَّل: tree.replay.fullscreenSelector });
// ⭐⭐ **المرساةُ التي تجعل الرقمَ المكتوب غيرَ قابلٍ للتخلّف:** لو تبدّل المنظورُ
// المسجَّل أو خطئ، **لخالف المستطيلُ الحيُّ ما جمّده المضيف بيده** فاحمرّ هنا.
check("[0] ⭐⭐ والفيديو يوافق ما جمّده المضيف بحرفه — لا تخطيطاً آخر باسمه",
  r.مرساة?.فيديو?.w === FROZEN.w && r.مرساة?.فيديو?.h === FROZEN.h &&
  r.مرساة?.فيديو?.left === FROZEN.left && r.مرساة?.فيديو?.top === FROZEN.top,
  { الحيّ: r.مرساة?.فيديو, المُجمَّد: FROZEN });
check("[0] ⭐⭐ وهو **داخل المنظور** — لا موجودٌ وحسب",
  r.مرساة?.داخلَ_المنظور === true, r.مرساة);
check("[0] ⭐ وتخطيطُ ملء الشاشة مُلتقَطٌ لا مُصطنَع: العنوانُ وصفُّ الإجراءات وزرُّ المزيد",
  r.قبل?.عنوان === true && r.قبل?.صفُّ_إجراءات === true && r.قبل?.زرُّ_المزيد === true, r.قبل);
check("[0] ⭐ ووضعُ السينما مخفيٌّ كما هو حيّاً", r.قبل?.سينما === false, r.قبل);
if (fail) {
  console.log("\n⛔ **المراسي لم تُؤكَّد — ولا يُقرأ ما بعدها**: أصفارُها «لم أُنتج الحال» لا «امتناع».");
  console.log(`\n❌ نجح ${pass} / فشل ${fail}\n`); process.exit(1);
}

console.log("\n[1] م12 — الشريطُ يختفي بكامله في ملء الشاشة");
check("[1] ⭐⭐ (م12) صنفُنا مطبَّقٌ والشريطُ اختفى — تقدّمٌ ووقتٌ وأزرارٌ معاً",
  r.م12?.صنفُنا === true && r.م12?.شريط === false &&
  r.م12?.وقت === false && r.م12?.أزرار === false, r.م12);

// ── ⚪ م13 — **مقيسةٌ ولا تُرفع، وسببُ ذلك يُكتب هنا لا في سجلٍّ بعيد** ──────
// ⛔ **خضراءُ بلا شاهد حمرة ليست حارساً**: لم يُثبَت أن هذا الشرط **يستطيع أن
// يُحمّر** على العطب الذي يعنيه ⇒ **فيبقى `م13` في قائمة المالك**، ويُطبع رقمُه
// هنا خبراً لا حكماً. **ومُطلِقُ رفعِها: شاهدُ حمرةٍ لها هي.**
console.log("\n[2] ⚪ م13 — مقيسةٌ ولا تُرفع (لا شاهدَ حمرةٍ لها بعد)");
console.log(`  ⚪ المقيس: شريط=${r.م13?.شريط} · صنفُنا=${r.م13?.صنفُنا}` +
  `  ⇒ ${r.م13?.شريط === true && r.م13?.صنفُنا === false ? "موافقٌ للمتوقَّع" : "**مخالف — يُبلَّغ**"}`);

console.log("\n[3] م14 — العجلةُ على زرّ السرعة");
check("[3] زرُّ السرعة ظاهرٌ ليُقاس", !!r.زرّ, { زرّ: r.زرّ, طبقة: r.طبقة });
check("[3] ⭐⭐ (م14) العجلةُ تُغيّر السرعة",
  r.م14 && r.م14قبل && r.م14.سرعة !== r.م14قبل.سرعة, { قبل: r.م14قبل?.سرعة, بعد: r.م14?.سرعة });
// ⛔ **والنصفُ الثاني من الوعد**: أمرُ المربّع **لا يقع** — والصوتُ شاهدُه
check("[3] ⭐⭐ (م14) ولا يقع أمرُ المربّع (الصوتُ لم يتغيّر)",
  r.م14 && r.م14قبل && r.م14.صوت === r.م14قبل.صوت, { قبل: r.م14قبل?.صوت, بعد: r.م14?.صوت });

if (RED || RED_FILE) {
  console.log(`\n⇒ **شاهدُ الحمرة**: ${fail > 0
    ? `✅ احمرَّ بـ${fail} — فالرِكازُ يمسك ما بُني له`
    : "❌ **لم يُحمّر — ولا يُصدَّق أخضرُه بعد اليوم**"}`);
  console.log(`\n${fail ? "✅" : "❌"} (مقلوبٌ في وضع الحمرة) نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 0 : 1);
}
console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
