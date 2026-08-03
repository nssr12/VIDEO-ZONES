// #77 — **هل تحيا صفحة الإعدادات حين تُفتح؟** فحصُ تحميلٍ في متصفّحٍ حقيقيّ.
//
// ⛔ **العلّة التي وُلد منها، وهي أهمّ من العطب:** #77 كسر الصفحة كسراً كاملاً —
// نداءٌ لدالّةٍ حُذفت (`syncSpeedBadgeRow`) داخل `init`، **فماتت الصفحة كلّها بما
// فيها أقسامٌ لم تُمسّ**. و**1808 تأكيداً و43 فحصاً على الشجرة كانت خضراء**.
//
// ⭐ **وثالث عمىً من عائلة «الأداة ترى والمقيس صحيح والمقيس ليس المنتَج»:**
// `node --check` **مرّت عليها** لأنها صحيحةٌ نحواً، والخطأ **مرجعٌ غير معرَّف وقت
// التشغيل**. ⇒ **فحصُ النحو أعطانا ثقةً لا يملكها، وسكوتُه قُرئ سلامة.**
// **ولا اختبار في المشروع كان يُحمِّل `options.html` في متصفّح.**
//
// ⚠️ **وهذا شرطُ قبولٍ لا تحسين (قرار المالك 2026-08-02):**
//   ١) **صفر خطأ في الكونسول** عند التحميل.
//   ٢) **والتنقّل بين الأقسام يعمل.**
//   ٣) **وضابطٌ واحد على الأقلّ يستجيب** — يُبدَّل فيُكتب في التخزين.
//
// ⚠️ **وبشاهدَي قرار 26** (`--witness`): يُثبت أنه **يرى صفحةً حيّة** وأنه
// **يُحمّر ميتةً** — بكسرها عمداً مرّةً واحدة ثمّ إرجاعها. **ولا يُنشر رقم من
// رِكاز بلا شاهدين.**
//
//   node tools/bench-options-page.mjs
//   node tools/bench-options-page.mjs --witness   # الشاهدان: حيّة ⇒ خضراء · ميتة ⇒ حمراء
import fs from "node:fs";
import path from "node:path";
import { launch, openPage, connect, ROOT } from "./ext-harness.mjs";

const PORT = 9754;
const WITNESS = process.argv.includes("--witness");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra === undefined ? "" : JSON.stringify(extra).slice(0, 200)));

// ── تشغيلةٌ واحدة: تفتح الصفحة وتقيس الشروط الثلاثة ────────────────────────
async function run(label) {
  const chrome = await launch(PORT);
  try {
    await sleep(1500);
    // ⚠️ **المعرّف من `loadUnpacked` نفسه لا بالتخمين من قائمة الأهداف**: أول
    // تشغيلةٍ التقطت **إضافة متجر كروم المدمجة** فقرأت `chrome-error://` وطبعت
    // «صفر استثناء» — **صفرٌ من صفحةٍ لم تُحمَّل**. وهو العمى نفسه من باب ثالث.
    const id = chrome.extensionId;
    if (!id) return { label, ok: false, why: "تعذّر إيجاد معرّف الإضافة" };

    const c = await openPage(PORT, `chrome-extension://${id}/options.html`);
    // ⚠️ الأخطاء تُلتقط **قبل** الانتظار لا بعده — وإلا فاتنا ما وقع أثناء التحميل
    const errors = [];
    c.ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.method === "Runtime.exceptionThrown") {
        errors.push(m.params?.exceptionDetails?.exception?.description ||
                    m.params?.exceptionDetails?.text || "استثناء بلا نصّ");
      }
      if (m.method === "Runtime.consoleAPICalled" && m.params?.type === "error") {
        errors.push((m.params.args || []).map((a) => a.value || a.description).join(" "));
      }
    });
    await sleep(2500);

    const evalIn0 = async (expr) => {
      const r = await c.send("Runtime.evaluate", { expression: expr, returnByValue: true });
      return r?.result?.result?.value;
    };
    // ⭐ **شاهدٌ موجب قبل أي رقم (قرار 26): أهذي صفحتُنا أصلاً؟**
    const here = await evalIn0("[location.href, document.readyState].join(\"|\")");
    if (!String(here).startsWith(`chrome-extension://${id}/options.html`)) {
      try { c.ws.close(); } catch {}
      return { label, ok: false, why: "لم تُحمَّل صفحتنا: " + here };
    }

    const evalIn = async (expr) => {
      const r = await c.send("Runtime.evaluate",
        { expression: expr, awaitPromise: true, returnByValue: true });
      return r?.result?.result?.value;
    };

    // (٢) التنقّل بين الأقسام
    const nav = await evalIn(`(() => {
      const btns = [...document.querySelectorAll(".navItem")];
      if (btns.length < 2) return { ok: false, why: "لا أزرار أقسام" };
      const target = btns.find((b) => b.dataset.section === "timingSection") || btns[1];
      target.click();
      const sec = document.getElementById(target.dataset.section);
      return { ok: !!sec && !sec.hidden, section: target.dataset.section, n: btns.length };
    })()`);

    // (٣) ضابطٌ يستجيب: نبدّل مربّع Clean Player ونقرأ التخزين
    const respond = await evalIn(`(async () => {
      const el = document.getElementById("cp_play_button");
      if (!el) return { ok: false, why: "الضابط غير مرسوم" };
      const before = !!el.checked;
      el.checked = !before;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 700));
      const d = await chrome.storage.sync.get({ settings: {} });
      const stored = !!d.settings?.cleanPlayer?.items?.play_button;
      return { ok: stored === !before, before, stored };
    })()`);

    // وعددُ ما رُسم — فسقوطُ ضابطٍ يُرى بالعدّ
    const drawn = await evalIn(`(() => ({
      clean: document.querySelectorAll("#cleanPlayerList input[type=checkbox]").length,
      timing: document.querySelectorAll("#timingList input").length,
      help: document.querySelectorAll(".vzHelp").length
    }))()`);

    try { c.ws.close(); } catch {}
    return { label, ok: true, errors, nav, respond, drawn };
  } finally {
    try { chrome.kill(); } catch {}
    await sleep(400);
  }
}

console.log("\n=== #77 — هل تحيا صفحة الإعدادات؟ ===\n");

const live = await run("حيّة");
if (!live.ok) {
  console.log("  ❌ تعذّر التشغيل:", live.why);
  console.log("\n❌ نجح 0 / فشل 1\n");
  process.exit(1);
}

console.log("[١] صفر خطأ في الكونسول عند التحميل");
check("[١] صفر استثناء", live.errors.length === 0, live.errors);

console.log("\n[٢] التنقّل بين الأقسام يعمل");
check("[٢] القسم يُفتح بالنقر", live.nav?.ok === true, live.nav);

console.log("\n[٣] وضابطٌ يستجيب — يُبدَّل فيُكتب في التخزين");
check("[٣] التبديل يصل التخزين", live.respond?.ok === true, live.respond);

console.log("\n[٤] وما رُسم — بالعدّ فسقوطُ ضابطٍ يُرى");
check("[٤] 38 مربّع Clean Player", live.drawn?.clean === 38, live.drawn);
check("[٤] و8 ضوابط توقيت", live.drawn?.timing === 8, live.drawn);
check("[٤] ولكلٍّ زرّ تلميح", live.drawn?.help >= 46, live.drawn);

// ── الشاهد السالب: نكسرها عمداً مرّةً واحدة ثمّ نُرجعها ────────────────────
if (WITNESS) {
  console.log("\n[٥] ⭐ الشاهدان (قرار 26): يرى الحيّة، ويُحمّر الميتة");
  const p = path.join(ROOT, "options.js");
  const orig = fs.readFileSync(p, "utf8");
  try {
    // الكسر **من جنس العطب الذي وقع**: نداءٌ لدالّةٍ غير معرَّفة داخل مسار البدء
    fs.writeFileSync(p, orig.replace(
      "function renderOverlayTiming(settings) {",
      "function renderOverlayTiming(settings) {\n  __vzDeliberatelyMissing();"));
    const dead = await run("ميتة");
    check("[٥] الميتة تُحمَّل ويُلتقط استثناؤها", dead.ok && dead.errors.length > 0, dead.errors);
    check("[٥] ⭐ وشرطُ «صفر خطأ» يسقط عليها", dead.ok && dead.errors.length !== 0);
  } finally {
    fs.writeFileSync(p, orig);
    const back = fs.readFileSync(p, "utf8") === orig;
    check("[٥] وأُرجع الملفّ كما كان", back);
  }
}

console.log(`\n${fail ? "❌" : "✅"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
