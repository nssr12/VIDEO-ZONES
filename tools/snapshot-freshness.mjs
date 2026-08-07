// #112 — **أتقادمت اللقطة؟** — ويفرّق ثلاثاً: مطابِقة · مختلفة · **لم أستطع الفحص**.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«الرِكازُ الذي يقول إن الأزرار سليمة —
// أيقيسها على شجرة يوتيوب اليوم، أم على شجرةٍ ماتت منذ أشهر؟»*
//
// ⛔⭐⭐ **وثقبٌ في الخطّة أشار إليه المالك وسُدَّ هنا:** أن يكون الكاشفُ رِكازاً
// **يقود يوتيوب حيّاً** — **وذاك بعينه ما عجزنا عنه أربع مرّاتٍ مقيسة، وهو سببُ
// اللقطة أصلاً** ⇒ **فالكاشفُ معلَّقٌ على ما بُنيت اللقطةُ لتفاديه.**
// ⇒ ⭐ **فالخرْجُ ثلاثةٌ لا اثنان**، **والثالثةُ لا تُقرأ طزاجة**: «لم أُقس» ليست
// «سليمة» (قرار 26). ⚠️ **وإن تعذّر الفحصُ آلياً فالمالكُ يفتح صفحةً ويُعطي
// البصمة** — **وذاك أرخص من رِكازٍ يُحجَب.**
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** يحتاج شبكةً حين
// يُفحص آلياً. **ومُطلِقُه: رفعُ النسخة · وأيُّ أحمرَ في رِكازٍ يعتمد على اللقطة.**
//
//   node tools/snapshot-freshness.mjs                    # يحاول الفحص الآليّ
//   node tools/snapshot-freshness.mjs --print-probe      # يطبع سطرَ لصقٍ للمالك
//   node tools/snapshot-freshness.mjs --fingerprint '<json>'   # يقارن بلا شبكة
import fs from "node:fs";
import path from "node:path";
import { launch, openPage, evalIn, killChrome, ROOT } from "./ext-harness.mjs";
import { loadSnapshot, listSnapshots, STATE_WINDOW } from "./snapshot-source.mjs";

const PORT = 9807;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const argOf = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };

// **البصمةُ نفسُها في الطرفين** — ولا مقياسان لسؤالٍ واحد
const PROBE = `(() => { const q = (s) => document.querySelectorAll(s).length;
  return { build: (document.querySelector("#movie_player")?.dataset?.version || ""),
           ytp: q('[class*="ytp-"]'), rightControls: q(".ytp-right-controls"),
           bottom: q(".ytp-chrome-bottom"), settings: q(".ytp-settings-button"),
           leftControls: q(".ytp-left-controls"), video: q("video"),
           moviePlayer: q("#movie_player") }; })()`;

if (process.argv.includes("--print-probe")) {
  console.log("\n⇒ الصقْ هذا في كونسول صفحة مشاهدةٍ على يوتيوب، وأعطني سطرَه:\n");
  console.log(`copy(JSON.stringify(${PROBE.replace(/\n\s*/g, " ")}))`);
  console.log("\nثمّ: node tools/snapshot-freshness.mjs --fingerprint '<الملصوق>'\n");
  process.exit(0);
}

// ⛔⭐ **اللقطةُ تُطلَب بحالها لا بترتيب الأسماء** (2026-08-07): كان الاختيارُ
// `sort().pop()`، **فيومَ وُلدت لقطةُ ملء الشاشة صار هذا الكاشفُ يقارن مراسيَ
// حالِ ملء الشاشة بصفحةِ نافذةٍ حيّة** ⇒ **فرقٌ سببُه الحالُ لا التقادم**،
// **و«تقادمت» كاذبةٌ تدفع إلى تجديدٍ يُضيف خمسة ميغابايت بلا سبب.**
// ⚠️ **والمِجَسُّ الحيُّ يُنتج حالَ النافذة، فبها يُقارَن** — **وحالُ ملء الشاشة
// تُقارَن ببناء المشغّل وحدَه**، وهو ما يُشترك فيه الاثنان، **ويُقال ولا يُدّعى أكثر.**
const SNAP_DIR = path.join(ROOT, "tools", "snapshots");
const snap = loadSnapshot(STATE_WINDOW);
const snapFile = snap.file;
const META = snap.meta;
const others = listSnapshots().filter((s) => s.meta.state !== STATE_WINDOW);

console.log(`\n=== طزاجةُ اللقطة — ${snapFile} ===`);
console.log(`  التُقطت: ${META.capturedAt} · بناءُ المشغّل المحفوظ: ${META.build}`);
for (const o of others) {
  console.log(`  وحالٌ أخرى: ${o.meta.state} — **يُقارَن بناؤها وحدَه** ` +
    `(${o.meta.build === META.build ? "البناءُ نفسُه" : "**بناءٌ آخر — تُجدَّد معها**"})`);
}

let live = null, why = null;
const pasted = argOf("--fingerprint");
if (pasted) {
  try { live = JSON.parse(pasted); } catch (e) { why = "البصمةُ الملصوقة لا تُقرأ: " + e.message; }
} else {
  let h = null;
  try {
    h = await launch(PORT, { withExtension: false, extra: ["--window-size=1600,1000"] });
    const p = await openPage(PORT, WATCH);
    let ok = false;
    for (let i = 0; i < 40; i++) {
      ok = await evalIn(p, `!!document.querySelector("#movie_player") && !!document.querySelector(".ytp-right-controls")`);
      if (ok) break;
      await sleep(500);
    }
    if (!ok) throw new Error("لم يُبنَ المشغّل خلال 20 ثانية (حجبٌ · شبكة · صفحةٌ أخرى)");
    // ⛔⭐⭐ **تُنتَج الحالُ نفسُها التي التُقطت** (قرار 125): اللقطةُ حُفظت
    // **وشريطُها صاحٍ**، **وبصمةٌ تُقرأ على شريطٍ خابٍ تُخرج فرقاً سببُه الحالُ
    // لا التقادم** ⇒ **«تقادمت» كاذبة، وهي أسوأ من صمت: تدفع إلى تجديدٍ يُضيف
    // خمسة ميغابايت بلا سبب.** ⚠️ **ووقع فعلاً في أوّل تشغيلة: 584 ⇒ 295.**
    const ctr = await evalIn(p, `(() => { const el = document.querySelector("#movie_player");
      if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    let awake = false;
    for (let i = 0; i < 8 && ctr; i++) {
      await p.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: ctr.x + (i % 2 ? 5 : -5), y: ctr.y + 3 });
      await sleep(220);
      awake = await evalIn(p, `(() => { const el = document.querySelector(".ytp-chrome-bottom");
        if (!el) return false; const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        return !(cs.display === "none" || cs.visibility === "hidden" ||
                 parseFloat(cs.opacity) === 0 || r.width === 0 || r.height === 0); })()`);
      if (awake) break;
    }
    if (!awake) throw new Error("الشريطُ لم يستيقظ — والبصمةُ على حالٍ غير حالِ اللقطة");
    live = await evalIn(p, PROBE);
    try { p.ws.close(); } catch {}
  } catch (e) { why = String(e?.message || e); }
  finally { try { killChrome(h); } catch {} }
}

// ── ⛔ ثلاثةٌ لا اثنتان ─────────────────────────────────────────────────────
if (!live) {
  console.log(`\n⚪ **لم أستطع الفحص** — ${why}`);
  console.log("⛔ **ولا يُقرأ هذا طزاجة**: «لم أُقس» ليست «سليمة» (قرار 26).");
  console.log("⇒ الطريقُ الأرخص: `node tools/snapshot-freshness.mjs --print-probe`");
  console.log("   ثمّ يفتح المالكُ صفحةً ويُعطي البصمة، فتُقارَن بلا شبكة.\n");
  process.exit(2);
}

const want = { build: META.build, ...META.anchors };
const diffs = [];
for (const k of Object.keys(want)) {
  const a = want[k], b = live[k];
  if (k === "ytp") { if (Math.abs(a - b) > Math.max(20, a * 0.1)) diffs.push(`${k}: ${a} ⇒ ${b}`); }
  else if (String(a) !== String(b)) diffs.push(`${k}: ${JSON.stringify(a)} ⇒ ${JSON.stringify(b)}`);
}

if (diffs.length === 0) {
  console.log("\n✅ **مطابِقة** — البناءُ والمراسي كما حُفظت.\n");
  process.exit(0);
}
console.log("\n⛔ **مختلفة — اللقطةُ تقادمت:**");
for (const d of diffs) console.log("   · " + d);
console.log("\n⇒ **مُطلِقُ التحديث وقع**: `node tools/capture-yt-snapshot.mjs`");
console.log("⚠️ **وقبل التحديث يُقرأ حدُّ الحجم**: git يحفظ كلَّ نسخةٍ إلى الأبد،");
console.log("   فالتجديدُ **يُضيف** نحوَ خمسة ميغابايت ولا يستبدلها.\n");
process.exit(1);
