// #77 — **هل تحيا صفحة الإعدادات حين تُفتح؟** فحصُ تحميلٍ في متصفّحٍ حقيقيّ.
//
// ⛔ **من الثمانية — يُشغَّل قبل كل كومِت.** ويحرس: **#77 · #82 · #84** — صفحةُ الإعدادات تُفتح وتتفاعل، وضوابطُها تصل التخزين، ولوحةُ الأخطاء بصفر.
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
//   ٣) ~~**وضابطٌ واحد على الأقلّ يستجيب**~~ ⛔ **مسحوب 2026-08-03 (قرار 21).**
//
// ⛔ **ولماذا سُحب — وهي علّةٌ ثانية أهمّ من الأولى:** مرّ هذا الحارس **أخضر
// 6/6** على بناءٍ تحمل صفحتُه `ReferenceError: persistTiming is not defined`،
// **ولم يكشفه إلا زرّ «أخطاء» عند المالك**. وسببان بنيويّان لا نقصُ عيّنة:
//   **(أ)** كان يقيس **لحظة التحميل وحدها**، والرمية **لا تقع إلا عند التفاعل**.
//   **(ب)** و«ضابطٌ واحد» كان `cp_play_button` — **ومسارُه سليم**، بينما ضوابط
//       التوقيت الثمانية كلُّها ترمي. ⇒ **عيّنةٌ من واحدٍ تُثبت مسارَها لا الصفحة**،
//       وهو شكل «الشاهد الواحد» الذي أُمسك في عدّ المجموعات وفي الخطوة 32 —
//       **والآن في حارسٍ يُشحن.**
// ⇒ **فالشرط الثالث صار: كلُّ ضابطٍ (46) يُبدَّل، ويُقرأ الخطأ والتخزين بعد كلٍّ.**
// ⇒ **ورابعٌ معه: لوحة `chrome://extensions` مصدراً ثانياً** — ⚠️ **ولا تُقرأ
//   إلا بوضع المطوّر**، وإلا فصفرُها **«لا أرى» لا «لا يوجد»** (قرار 26).
//
// ⚠️ **وأحمرُه اليوم متوقَّع ومسجَّل في `tools/KNOWN-DEFECTS.md`** — يُقارَن به،
// وما زاد عليه **انحدارٌ أدخلتَه أنت**.
//
// ⚠️ **وبشاهدَي قرار 26** (`--witness`): يُثبت أنه **يرى صفحةً حيّة** وأنه
// **يُحمّر ميتةً** — بكسرها عمداً مرّةً واحدة ثمّ إرجاعها. **ولا يُنشر رقم من
// رِكاز بلا شاهدين.**
//
//   node tools/bench-options-page.mjs
//   node tools/bench-options-page.mjs --witness   # الشاهدان: حيّة ⇒ خضراء · ميتة ⇒ حمراء
import fs from "node:fs";
import path from "node:path";
import { launch, openPage, connect, ROOT , killChrome, evalIn } from "./ext-harness.mjs";

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

    // ── ⭐ وضع المطوّر **قبل** أي خطأ — وإلا فصفر اللوحة «لا أرى» لا «لا يوجد» ──
    // `chrome.developerPrivate` **لا تجمع `runtimeErrors` إلا في وضع المطوّر**.
    // فلوحةٌ تُقرأ بلا تفعيله تطبع `0` على إضافةٍ ترمي — **وهو الصفر الذي حذّر
    // منه قرار 26 بنصّه: «لا يوجد» و«لا أرى» يطبعان الرقم نفسه.**
    let devMode = "لم يُحاوَل";
    {
      const x = await openPage(PORT, "chrome://extensions/");
      await sleep(1500);
      const r = await x.send("Runtime.evaluate", {
        expression: `(async () => { try {
          await new Promise(r => chrome.developerPrivate.updateProfileConfiguration({inDeveloperMode:true}, r));
          return "ok"; } catch (e) { return "fail:" + e.message; } })()`,
        awaitPromise: true, returnByValue: true });
      devMode = r?.result?.result?.value || "لا جواب";
      try { x.ws.close(); } catch {}
    }

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

    // ⭐ **شاهدٌ موجب قبل أي رقم (قرار 26): أهذي صفحتُنا أصلاً؟**
    // ⚠️ **ورميتُه تُطوى في مخرجه المُعلَن هو، لا تُترك تصعد**: وظيفةُ هذا السطر
    // أن **يقول «ليست صفحتنا»**، فرميةٌ تتخطّى ذلك المخرج تُسكته في الحال الوحيدة
    // التي كُتب لها. ⛔ **وهذا وحده مُستثنى** — وباقي المِجَسّات تصعد رميتُها
    // بنصّها: **بلاغٌ يُسمّي التعبيرَ الذي رمى أصدقُ من ثمانية شروطٍ تُحمَّر
    // بدليلٍ `{}`** (وهو ما كانت تفعله النسخةُ المحلّية: عطبُ الأداة يُقرأ عطبَ منتَج).
    let here;
    try { here = await evalIn(c, "[location.href, document.readyState].join(\"|\")"); }
    catch (e) { if (!e?.vzEvalThrew) throw e; here = "رمى الشاهدُ الموجب: " + e.message; }
    if (!String(here).startsWith(`chrome-extension://${id}/options.html`)) {
      try { c.ws.close(); } catch {}
      return { label, ok: false, why: "لم تُحمَّل صفحتنا: " + here };
    }

    // (٢) التنقّل بين الأقسام
    const nav = await evalIn(c, `(() => {
      const btns = [...document.querySelectorAll(".navItem")];
      if (btns.length < 2) return { ok: false, why: "لا أزرار أقسام" };
      const target = btns.find((b) => b.dataset.section === "timingSection") || btns[1];
      target.click();
      const sec = document.getElementById(target.dataset.section);
      return { ok: !!sec && !sec.hidden, section: target.dataset.section, n: btns.length };
    })()`);

    // ⭐ **خطُّ الفصل: ما وقع عند التحميل وما وقع عند التفاعل** — والثاني هو ما
    // أفلت. `ReferenceError: persistTiming` **لا يقع عند التحميل إطلاقاً**،
    // فحارسٌ يقيس اللحظة الأولى وحدها يمرّ على صفحةٍ لا يُحفظ فيها شيء.
    const loadErrors = errors.slice();

    // ── (٣) **الضوابط كلُّها لا واحدة** ─────────────────────────────────────
    // ⚠️ **«شاهدٌ واحد» أثبت مسارَه لا الصفحة:** كانت هذه الخطوة تُبدّل
    // `cp_play_button` وحده — ومسارُه `persistCleanPlayerItem` **سليم**، بينما
    // ضوابط التوقيت كلُّها ترمي. **فالعيّنة من واحدٍ تُعمّم نجاحَ ما عُويِن.**
    // وهو الشكل نفسه الذي أُمسك في عدّ المجموعات وفي الخطوة 32 — **والآن في
    // حارسٍ يُشحن.** ⇒ **يُبدَّل كلُّ ضابط، ويُقرأ الخطأ والتخزين بعد كلٍّ.**
    const ids = await evalIn(c, `(() => ({
      clean: [...document.querySelectorAll("#cleanPlayerList input")].map((e) => e.id),
      timing: [...document.querySelectorAll("#timingList input")].map((e) => e.id)
    }))()`);
    const sweep = [];
    for (const cid of [...(ids?.clean || []), ...(ids?.timing || [])]) {
      const errBefore = errors.length;
      // ⚠️ **تحمُّلٌ مُعلَنٌ بنصّه، لا `catch` فارغ** — و`ext-harness` تشترط ذلك
      // صراحةً: **من احتاج تحمُّلَ رميةٍ يقول ماذا تعني عنده.** ومعناها هنا:
      // **رميةُ ضابطٍ واحد هي عينُ ما يقيسه شرطُ «صفر استثناء عند التفاعل»** —
      // فتُنسب إلى معرّفه وتُعدّ حمراءَ باسمه، **ولا تُسقط الاجتياحَ على أوّل من
      // يرمي فتُخفي الخمسة والأربعين بعده**. ⛔ **وما ليس رميةَ تعبيرٍ يُرفع كما
      // هو** (`vzEvalThrew`): عطبُ الرِكاز نفسِه لا يُقيَّد في عمود المنتَج.
      //
      // ⛔ **والرميةُ التي أخفاها الابتلاعُ كانت في `return` أدناه**: قرأت `a` —
      // **اسمٌ لا وجود له في صفحة الإعدادات** — فرمى التعبير، **فأعاد CDP `{}`
      // صادقةً**، فغابت الحقول كلُّها، **وغيابُها قُرئ «لا عيب»**.
      // ⇒ ⭐ **والعلاجُ ليس تصحيحَ الاسم إلى قراءةٍ رابعة للتخزين، بل استعمالَ ما
      // قاسته الحلقةُ أصلاً بعد كل دفعة**: قراءةٌ رابعة **تستطيع أن تخالف الثلاثَ
      // قبلها**، والحلقةُ تُمسك تغيّراً وقع ثمّ عاد — وهي تقيس ما يُسأل عنه:
      // **أوصلَ تبديلٌ ما إلى التخزين؟** لا: **أهي مختلفةٌ في اللحظة الأخيرة؟**
      //
      // ⛔ **والعيبُ الثاني المستقلّ (الخطوة ٣): `wanted` كانت تُحسب ولا تُرجَع**،
      // **فشرطُ #89 «المعروض يطابق المطلوب» لم يُقيَّم مرّةً واحدة** — يشترط
      // `s.wanted != null` فيُقصّر قبل أن يقارن. ⇒ **صارت تُرجَع.**
      // ⚠️ **و`shown` تُستبدَل لا تُضاف بجانبها**: كانت `shown: el.value` —
      // **قيمةَ العنصر الأخيرة لا التي قُرئت عند التباعد**، ومربّعُ الاختيار
      // قيمتُه `"on"` دائماً فلا تُقارَن بالمطلوب أصلاً. ⛔ **ومفتاحان بالاسم
      // نفسِه في كائنٍ واحد يمرّان بفحص النحو**، فتُلغي الثانيةُ الأولى صامتةً —
      // **وهو الصمتُ الذي يُقرأ سلامة.**
      let r = null, thrown = null;
      try {
        r = await evalIn(c, `(async () => {
        const el = document.getElementById(${JSON.stringify(cid)});
        if (!el) return { why: "غير مرسوم" };
        if (el.disabled) return { skipped: true };
        const b = await chrome.storage.sync.get({ settings: {} });
        const before = JSON.stringify(b.settings || {});
        // ⭐ **المدى يُدفع إلى طرفيه معاً لا إلى طرفٍ واحد** (#89):
        // خطوةٌ واحدة **لا تدخل المدى الذي فُتح للتوّ**، **وطرفٌ واحد قد يكون
        // الطرفَ الذي لا يعضّ فيه القصّ** — وقد وقع: القصّ عند الأدنى والدفع ذهب
        // إلى الأقصى. ⇒ **حارسٌ يُجرّب قيمةً واحدة يُثبت أن الضابط يستجيب، لا
        // أن مداه صحيح.**
        const tries = el.type === "checkbox"
          ? [String(!el.checked)]
          : [String(Number(el.min)), String(Number(el.max))];
        let wanted = null, shown = null, changed = false;
        for (const t of tries) {
          if (el.type === "checkbox") el.checked = (t === "true"); else el.value = t;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          await new Promise((r) => setTimeout(r, 700));
          const cur = await chrome.storage.sync.get({ settings: {} });
          if (JSON.stringify(cur.settings || {}) !== before) changed = true;
          const e2 = document.getElementById(${JSON.stringify(cid)});
          const got = e2 ? (e2.type === "checkbox" ? String(e2.checked) : e2.value) : null;
          if (got !== t) { wanted = t; shown = got; break; }
        }
        // ⚠️ **المهلة تكفي لدورةٍ كاملة لا لكتابةٍ وحدها** (#89): القفزة تقع بعد
        // إعادة الرسم التي يُطلقها تغيّر التخزين.
        // ⭐ **والقيمة المعروضة تُقارن بالمخزَّنة** — فالعرض قد يكذب على التخزين
        // (#89: التخزين 100 والمُنزلق 500). **«وصل التخزين» لا يكفي.**
        return { ok: true, changed, wanted, shown };
      })()`);
      } catch (e) {
        if (!e?.vzEvalThrew) throw e;
        thrown = String(e.message);
      }
      await sleep(90);
      sweep.push({ id: cid, ...(r || { why: thrown ? "رمى تعبيرُه" : "لا جواب" }),
                   threw: (errors.length - errBefore) + (thrown ? 1 : 0),
                   msg: thrown || errors.slice(errBefore)[0] });
    }

    // ── (٧) **#84: الظهور يُشتقّ ولا يُخزَّن** — المدخلان والمخرجان وEsc ─────
    // ⚠️ **مفتاحُ حالةٍ واحد يقلبه أربعة مداخل يُنتج مدخلاً يُلغي أثر آخر** —
    // وهو ما وقع: `Tab` يفتح و`Enter` بعده يُغلق. **والاشتقاق يجعله مستحيلاً.**
    const derived = await evalIn(c, `(() => {
      const b = document.querySelector("#timingList .vzHelp");
      const body = document.getElementById(b.getAttribute("aria-controls"));
      const st = () => !body.hidden;
      const fire = (t) => b.dispatchEvent(t === "focus" || t === "blur"
        ? new FocusEvent(t) : new MouseEvent(t));
      const esc = () => b.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      const out = {};
      // المدخلان يرفعان
      fire("blur"); fire("mouseleave");                 out.base = st();
      fire("mouseenter");                               out.hoverIn = st();
      fire("mouseleave");                               out.hoverOut = st();
      fire("focus");                                    out.focusIn = st();
      fire("blur");                                     out.focusOut = st();
      // ⭐ **الحالة الكاشفة**: تركيزٌ ثمّ تحويمٌ ثمّ ابتعاد ⇒ يبقى ظاهراً
      fire("focus"); fire("mouseenter"); fire("mouseleave"); out.stillFocused = st();
      // وEsc يُزيل التركيز فيختفي بالاشتقاق
      esc(); fire("blur");                              out.afterEsc = st();
      // ولا نقرَ يقلب: من ظاهرٍ بالتركيز، نقرةٌ لا تُخفيه
      fire("focus"); fire("click");                     out.clickNoToggle = st();
      fire("blur"); fire("mouseleave");
      return out;
    })()`);

    // وعددُ ما رُسم — فسقوطُ ضابطٍ يُرى بالعدّ
    const drawn = await evalIn(c, `(() => ({
      clean: document.querySelectorAll("#cleanPlayerList input[type=checkbox]").length,
      timing: document.querySelectorAll("#timingList input").length,
      help: document.querySelectorAll(".vzHelp").length
    }))()`);
    try { c.ws.close(); } catch {}

    // ── (٦) **مصدرٌ ثانٍ: لوحة «أخطاء» في `chrome://extensions`** ───────────
    // رآها المالك قبلنا. وتُقرأ من سياقٍ **جديد** بعد وقوع الخطأ — السياق الذي
    // فُعِّل فيه الوضع يسقط بتغييره.
    let panel = null;
    {
      const x = await openPage(PORT, "chrome://extensions/");
      await sleep(1800);
      panel = await (async () => {
        const r = await x.send("Runtime.evaluate", {
          expression: `(async () => {
            const i = await new Promise(r => chrome.developerPrivate.getExtensionsInfo(
              { includeDisabled: true, includeTerminated: true }, r));
            const me = (i || []).find(e => e.id === ${JSON.stringify(id)});
            return { found: !!me, runtime: (me?.runtimeErrors || []).length,
              msgs: (me?.runtimeErrors || []).slice(0, 4)
                     .map(z => String(z.message || "").split("\\n")[0].slice(0, 90)) };
          })()`, awaitPromise: true, returnByValue: true });
        return r?.result?.result?.value || null;
      })();
      try { x.ws.close(); } catch {}
    }

    return { label, ok: true, errors, loadErrors, nav, sweep, drawn, panel, devMode, derived };
  } finally {
    killChrome(chrome);
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
check("[١] صفر استثناء عند التحميل", live.loadErrors.length === 0, live.loadErrors);

console.log("\n[٢] التنقّل بين الأقسام يعمل");
check("[٢] القسم يُفتح بالنقر", live.nav?.ok === true, live.nav);

// ── [٣] الضوابط كلُّها — والفشل يُسمّى بمعرّفه لا بعدده ──────────────────────
const sw = live.sweep || [];
const threw = sw.filter((s) => s.threw > 0);
const notSaved = sw.filter((s) => s.ok && !s.changed);
const skipped = sw.filter((s) => s.skipped || s.why);
console.log(`\n[٣] كلُّ ضابطٍ يُبدَّل ويُقرأ بعده — ${sw.length} ضابطاً`);
check(`[٣] صفر استثناء عند التفاعل`, threw.length === 0,
  threw.slice(0, 4).map((s) => `${s.id}: ${String(s.msg).split("\n")[0].slice(0, 60)}`));
check(`[٣] وكلُّ تبديلٍ يصل التخزين`, notSaved.length === 0,
  notSaved.map((s) => s.id).slice(0, 12));
// ⭐ **#89: المعروض يطابق المطلوب** — وإلا فالواجهة تكذب على التخزين
const snapped = sw.filter((s) => s.ok && s.wanted != null && s.shown != null && s.wanted !== s.shown);
check(`[٣] ⭐ والمعروض يطابق المطلوب (لا يقفز الضابط بعد ضبطه)`, snapped.length === 0,
  snapped.map((s) => s.id + ": طُلب " + s.wanted + " فعُرض " + s.shown).slice(0, 6));
// ⚠️ **والوسمُ يذكر السببَ الثالث بعد أن صار ممكناً**: وسمٌ أوسعُ من شرطه هو
// عينُ ما نطارده — و«رمى تعبيرُه» لم تكن تقع أصلاً حين كانت الرميةُ تُبتلع.
if (skipped.length) console.log(`  · مُتخطّى (معطَّل أو غير مرسوم أو رمى تعبيرُه): ${skipped.map((s) => s.id).join(", ")}`);

// ── [٧] #84 — الظهور مُشتقّ: مدخلان مستقلّان، ولا مفتاح حالة ────────────────
const d = live.derived || {};
console.log("\n[٧] #84 — الظهور يُشتقّ: (مؤشّر فوقه) أو (تركيز عليه)");
check("[٧] البداية مخفيّ", d.base === false, d);
check("[٧] التحويم يُظهر", d.hoverIn === true, d);
check("[٧] ⭐ والابتعاد يُخفي (كان لا يُخفي)", d.hoverOut === false, d);
check("[٧] التركيز يُظهر", d.focusIn === true, d);
check("[٧] ⭐ وزواله يُخفي (كان لا يُخفي)", d.focusOut === false, d);
check("[٧] ⭐⭐ تركيزٌ ثمّ تحويمٌ ثمّ ابتعاد ⇒ **يبقى ظاهراً** (الحالة الكاشفة)",
  d.stillFocused === true, d);
check("[٧] ⭐ وEsc يُزيل التركيز فيختفي — فيسقط الحدّ المعروف", d.afterEsc === false, d);
check("[٧] ⭐ ولا نقرَ يقلب: النقر يمنح التركيز فيظهر", d.clickNoToggle === true, d);

console.log("\n[٦] ولوحة «أخطاء» في chrome://extensions — مصدرٌ ثانٍ");
console.log(`  · وضع المطوّر: ${live.devMode} — ${live.devMode === "ok"
  ? "فصفرُ اللوحة يعني «لا يوجد»"
  : "⚠️ **وبلا الوضع صفرُها «لا أرى» لا «لا يوجد» — لا يُقرأ سلامةً**"}`);
check("[٦] اللوحة تُقرأ (وُجدت الإضافة فيها)", live.panel?.found === true, live.panel);
check("[٦] وصفر خطأ فيها", live.panel?.runtime === 0, live.panel?.msgs);

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
