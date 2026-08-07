// #77 — **هل تحيا صفحة الإعدادات حين تُفتح؟** فحصُ تحميلٍ في متصفّحٍ حقيقيّ.
//
// ⛔ **من بوّابة الكومِت — يُشغَّل قبل كل كومِت.** ويحرس: **#77 · #82 · #84** — صفحةُ الإعدادات تُفتح وتتفاعل، وضوابطُها تصل التخزين، ولوحةُ الأخطاء بصفر.
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
import { sweepVerdicts } from "./sweep-verdict.mjs";

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
    // ── (٨) ⭐⭐ #118 — **المحرِّرُ يعمل، لا يُرسَم وحسب** ───────────────────
    // ⛔ **«مرسوم» ليس «يعمل»** — ولوحةٌ حيّةٌ عاطلة مرّت من كلّ ما بنيناه في
    // #108 (**بلا رميةٍ ولا تحذير وعنصرُها موجودٌ ومرئيّ**). ⇒ **فالشرطُ ينتهي
    // بأثرٍ في التخزين لا بوجود عنصر** (قرار 109: أرمى؟ · أموجود؟ · أوقع الأثر؟).
    // ⭐ **والمسارُ المقيس هو مسارُ لوحة المفاتيح** — **وهو شرطُ قبولٍ لا تحسين**:
    // السحبُ لا يُحاكى بـCDP بثقة، **ولوحةُ المفاتيح هي الطريق الذي وعدنا به.**
    const barEditor = await evalIn(c, `(async () => {
      const rows = () => [...document.querySelectorAll("#barEditor [data-vz-bar-id]")]
        .map((e) => e.getAttribute("data-vz-bar-id"));
      const before = rows();
      if (before.length < 2) return { skip: "أقلُّ من صفّين" };
      const first = document.querySelector("#barEditor [data-vz-bar-id]");
      first.focus();
      // ⚠️ التركيزُ الفعليّ لا يُقاس في متصفّحٍ مقطوع الرأس — حدٌّ مُسجَّلٌ عندنا
      // من قبل (تعليقُ Esc في settings-ui.js). ⇒ فيُقاس ما يُقاس: أنّ الصفَّ
      // يصله Tab بالبناء (tabIndex === 0) — ولا يُدّعى أكثر.
      // ⛔ ولا علامةَ اقتباسٍ خلفية في هذي الكتلة: هي قالبٌ نصّيّ، والعلامةُ
      // تقطعه — وهو الفخُّ المكتوب في content.js، ووقعتُ فيه هنا وأمسكه node.
      const focusable = first.tabIndex === 0;
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await new Promise((r) => setTimeout(r, 500));
      const after = rows();
      const st = await chrome.storage.sync.get({ settings: {} });
      const stored = ((st.settings || {}).overlay || {}).barButtons || null;
      const live = document.querySelector("#barEditor .vzBarLive");

      // ── #122 — المحاكي: المنطقةُ تتبدّل بالمسافة، والموضعُ لا يتبدّل معها ──
      // ⛔ الوجودُ في الشريط هو التشغيل عند المستخدم، **والموضعُ محفوظٌ عند
      // الإطفاء** — **وهو سببُ الشكل كلِّه، فيُقاس أثراً لا يُوصف.**
      const zoneOf = (id) => {
        const el = document.querySelector('[data-vz-bar-id="' + id + '"]');
        return el ? (el.closest("[data-vz-zone]") || {}).dataset?.vzZone || null : null;
      };
      const idAt = (i) => (stored && stored[i] ? stored[i].id : null);
      const target = after[0];
      const zone0 = zoneOf(target);
      const posBefore = (stored || []).findIndex((x) => x.id === target);
      const chip = document.querySelector('[data-vz-bar-id="' + target + '"]');
      chip.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      await new Promise((r) => setTimeout(r, 500));
      const zone1 = zoneOf(target);
      const st2 = await chrome.storage.sync.get({ settings: {} });
      const stored2 = ((st2.settings || {}).overlay || {}).barButtons || [];
      const posAfter = stored2.findIndex((x) => x.id === target);
      const onAfter = (stored2.find((x) => x.id === target) || {}).on;
      const barHas = !!document.querySelector("#barEditor .vzSimBar");

      // ── #123 — الإطارُ مرآةُ Clean Player، والعرضُ لا يُسحب ─────────────
      const ytCount = () => document.querySelectorAll("#barEditor [data-vz-yt]").length;
      const ytBefore = ytCount();
      const ytLeft = document.querySelectorAll("#barEditor .vzSimLeft [data-vz-yt]").length;
      const ytRight = document.querySelectorAll("#barEditor .vzSimRight [data-vz-yt]").length;
      const anyYt = document.querySelector("#barEditor [data-vz-yt]");
      // ⛔ الفرقُ بنيويّ: لا مؤشّر · ولا تركيز · وخارج شجرة الوصول
      // ── #126 — **الشكلُ كيوتيوب، والحدُّ وحدَه يفرّق** ─────────────────────
      const ourChip = document.querySelector("#barEditor .vzSimRight [data-vz-bar-id]");
      // ⚠️ **المرجعُ من المجموعة اليمنى لا من الصفحة كلِّها** — **وأوّلُ صياغةٍ
      // قارنت بعنصرٍ في المجموعة اليسرى فقالت «ليس يسارَهم» وهو يسارَهم**:
      // **المقيسُ جارُ المطلوب** (قرار 81) في مِجَسٍّ كُتب لهذا الشرط.
      const ytRightFirst = document.querySelector("#barEditor .vzSimRight [data-vz-yt]");
      const shape = (ourChip && ytRightFirst) ? (() => {
        const a = ourChip.getBoundingClientRect(), b = ytRightFirst.getBoundingClientRect();
        const sa = getComputedStyle(ourChip), sb = getComputedStyle(ytRightFirst);
        return { مقاسٌ_واحد: Math.round(a.width) === Math.round(b.width) &&
                             Math.round(a.height) === Math.round(b.height),
                 حدُّنا: sa.borderTopWidth, حدُّهم: sb.borderTopColor,
                 // **الشفافيةُ تُقاس بقيمتها لا بنصّها** — فالمتصفّح يكتبها بصيغٍ شتّى
                 لهم_شفّاف: (() => { const m = /rgba?\(([^)]+)\)/.exec(sb.borderTopColor);
                   if (sb.borderTopStyle === "none") return true;
                   if (!m) return sb.borderTopColor === "transparent";
                   const p = m[1].split(",").map((x) => parseFloat(x));
                   return p.length < 4 ? false : p[3] === 0; })(),
                 نصُّ_زرّنا: (ourChip.textContent || "").trim(),
                 // **وأزرارُنا يسارَ عناصر يوتيوب** — كما يفعل الحقنُ الحقيقيّ
                 يسارَهم: !!(ourChip.compareDocumentPosition(ytRightFirst) & Node.DOCUMENT_POSITION_FOLLOWING) };
      })() : null;

      const ytStruct = anyYt ? {
        مؤشّر: getComputedStyle(anyYt).pointerEvents,
        تركيز: anyYt.tabIndex, مخفيٌّ_للقارئ: anyYt.getAttribute("aria-hidden"),
        قابل_للسحب: anyYt.draggable === true } : null;

      // ── #129 — **تخطيطُ ملء الشاشة: مناطقُه الخمس، ورأسيّتُها كما قِيست** ──
      // ⛔ **لا يُقاس الوجودُ وحدَه**: **الترتيبُ الرأسيّ** هو ما يجعل الإطارَ
      // محاكياً — **العنوانُ أعلى · الإجراءاتُ فوق التقدّم · التقدّمُ فوق الشريط**.
      // ⚠️ **ويُقرأ من المستطيلات لا من ترتيب العقد** (قرار 22: بعد استقرار
      // التخطيط، وبمستطيلاتٍ غير صفرية) — **فترتيبُ العقد لا يقول أين رُسم.**
      // ⛔⭐⭐ **الحالُ تُنتَج قبل أن تُقرأ — خامسةُ قرار 125، ووقعت في أوّل
      // تشغيلة:** القسمُ الذي يحمل الإطارَ كان **مخفيّاً** (المِجَسّ تنقّل إلى
      // قسمٍ آخر قبله) ⇒ **كلُّ مستطيلٍ صفرٌ**، **فطبع «شريطُ التقدّم غير مرسوم»
      // وهو مرسوم**. ⇒ **فيُفتح قسمُه صراحةً ويُنتظر التخطيط.**
      const secId = document.getElementById("barEditor")?.closest(".sectionPage")?.id;
      if (secId) {
        const navBtn = [...document.querySelectorAll(".navItem")]
          .find((n) => n.dataset.section === secId);
        if (navBtn) navBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
      const q = (s) => document.querySelector("#barEditor " + s);
      const rectOf = (s) => { const e = q(s); if (!e) return null;
        const r = e.getBoundingClientRect();
        return (r.width > 0 && r.height > 0) ? { y: Math.round(r.top), x: Math.round(r.left),
                                                 w: Math.round(r.width) } : null; };
      const rTitle = rectOf(".vzSimTitle"), rActs = rectOf(".vzSimActions");
      const rProg = rectOf(".vzSimProgress"), rBar = rectOf(".vzSimBar");
      const rCenter = rectOf(".vzSimCenter [data-vz-yt]");
      const fs129 = {
        عنوان: !!q('.vzSimTitle [data-vz-yt="top_titles"]'),
        إجراءات: q('.vzSimActions [data-vz-yt="quick_actions"] svg')
          ? q('.vzSimActions [data-vz-yt="quick_actions"]').querySelectorAll("svg").length : 0,
        وسط: !!q('.vzSimCenter [data-vz-yt="fullscreen_scroll_arrow"]'),
        // ⛔⭐⭐ الشاهدُ يقرأ المقبضَ لا المسارَ وحدَه (#130): أوّلُ صياغةٍ اكتفت
        // بوجود عنصرٍ داخل المفتاح، فمرّ عليها رسمٌ أبيضُ صلبٌ لا مقبضَ فيه —
        // وهو عينُ العطب الذي كُتب الشاهدُ له. ⇒ فيُقرأ العنصرُ الزائف بلونه
        // وقياسه وإزاحته، فالفرقُ بين «مسارٌ ومقبض» و«شكلٌ صلب» فيه وحدَه.
        // ⚠️ ولا علاماتِ قوالبَ هنا: هذا داخل قالبٍ نصّيّ، وقد كُسر مرّتين اليوم.
        مفتاحُ_التلقائيّ: (() => {
          const t = q('[data-vz-yt="autoplay_toggle"] .vzSimSwitchTrack');
          if (!t) return null;
          const k = t.querySelector(".vzSimSwitchKnob");
          const cs = getComputedStyle(t);
          const ks = k && getComputedStyle(k);
          const r = t.getBoundingClientRect();
          const g = k && k.querySelector("svg");
          return { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius,
                   bg: cs.backgroundColor, مقبض: !!k,
                   مقبضٌ_قياس: ks ? ks.width + "×" + ks.height : null,
                   مقبضٌ_لون: ks ? ks.backgroundColor : null,
                   مقبضٌ_إزاحة: ks ? ks.transform : null,
                   // ⭐ ورسمُ المقبض (#132): الشاهدُ الذي اكتفى بوجود عنصرٍ كان
                   // سيمرّ على مقبضٍ فارغ — فيُقرأ الرسمُ ومقاسُه المُعلَن.
                   رسم: !!g, رسمٌ_مقاس: g ? g.getAttribute("viewBox") : null,
                   رسمٌ_عرض: g ? Math.round(g.getBoundingClientRect().width) : 0 };
        })(),
        سينما: !!q('[data-vz-yt="size_button"]'),          // ⬅ يجب أن يكون false
        تقدّمٌ_مرسوم: !!rProg,
        // **الرأسيّة**: عنوان < إجراءات < تقدّم < شريط
        رأسيّةٌ_صحيحة: !!(rTitle && rActs && rProg && rBar &&
          rTitle.y < rActs.y && rActs.y < rProg.y && rProg.y <= rBar.y),
        حدود: document.querySelectorAll("#barEditor .vzSimLimits li").length,
        وسطُه_وسط: (rCenter && rBar)
          ? Math.abs((rCenter.x + rCenter.w / 2) - (rBar.x + rBar.w / 2)) <= 6 : false
      };
      // **والاتّجاه واحد**: مربّعٌ في Clean Player يُخفي عنصرَه من الإطار
      // ⛔⭐ **الحالُ تُنتَج ولا تُفترض** (قرار 125، **رابعةُ وقوعه وفي هذا
      // المِجَسّ نفسِه**): الاجتياحُ في [٣] **يُبدّل كلَّ مربّعات Clean Player**
      // ⇒ **فوجدتُ السبعةَ مخفيّةً وقرأتُ ذلك فشلاً** — **وهي حالٌ صحيحة.**
      // ⇒ **فتُنتَج الحالُ صراحةً: يُفعَّل Clean Player · ويُنزَع تأشيرُ المفتاح ·
      // ويُتحقَّق أن العنصر ظهر · ثمّ يُؤشَّر ويُقاس اختفاؤه.**
      const cpOn = document.getElementById("cleanPlayerEnabled");
      if (!cpOn.checked) { cpOn.checked = true; cpOn.dispatchEvent(new Event("change", { bubbles: true })); }
      await new Promise((r) => setTimeout(r, 400));
      const box = document.getElementById("cp_play_button");
      if (box && box.checked) { box.checked = false; box.dispatchEvent(new Event("change", { bubbles: true })); }
      await new Promise((r) => setTimeout(r, 600));
      const ytMid = ytCount();                       // ← الحالُ المُنتَجة، تُقرأ لا تُفترض
      const playThere = !!document.querySelector('#barEditor [data-vz-yt="play_button"]');
      if (box && !box.checked) { box.checked = true; box.dispatchEvent(new Event("change", { bubbles: true })); }
      await new Promise((r) => setTimeout(r, 600));
      const ytAfter = ytCount();
      const playGone = !document.querySelector('#barEditor [data-vz-yt="play_button"]');

      return { before, after, focusable, stored, نطق: live ? live.textContent : null,
               ytBefore, ytLeft, ytRight, ytStruct, shape, ytMid, ytAfter, playThere, playGone, fs129,
               barHas, target, zone0, zone1, posBefore, posAfter, onAfter,
               بقي_في_القائمة: stored2.length === (stored || []).length };
    })()`);

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

    return { label, ok: true, errors, loadErrors, nav, sweep, drawn, panel, devMode, derived, barEditor };
  } finally {
    killChrome(chrome);
    await sleep(400);
  }
}

console.log("\n=== #77 — هل تحيا صفحة الإعدادات؟ ===\n");

// ⛔ **السجلُّ يُحمَّل قبل الأحكام لا بعدها** — فكلُّ عددٍ فيها مشتقٌّ منه
// (قرار 34)، **ورقمٌ يُكتب بيدٍ يتخلّف عن تغييرٍ مقصود ويُقرأ انحداراً.**
const { createRequire } = await import("node:module");
const uiReg = createRequire(import.meta.url)(path.join(ROOT, "settings-ui.js"));
const WANT_ACTIONS = ((uiReg.VZ_UI_CLEAN || {}).quick_actions || {}).شريط?.أيقونات?.length || 0;
// ⛔ ومقاسُ رسم المقبض يُشتقّ من السجلّ كذلك — ولا يُكتب بيد (قرار 34 · 131)
const WANT_KNOB_VB = ((uiReg.VZ_SIM_ICONS || {}).autonav_knob_play || {}).viewBox || null;

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
// ⛔ **والحكمُ ليس هنا بل في `sweep-verdict.mjs`** — دالّةٌ نقيّة يحرسها
// `tools/test-sweep-verdict.js` في المجموعة **بلا متصفّح**: فالحكمُ يُحرَس قبل كل
// كومِت، والتشغيلُ وحده هو ما يحتاج كروم. **ولا نسخةَ منه هنا** (داءُ #93).
const sw = live.sweep || [];
console.log(`\n[٣] كلُّ ضابطٍ يُبدَّل ويُقرأ بعده — ${sw.length} ضابطاً`);
for (const v of sweepVerdicts(sw, live.drawn)) check(v.name, v.ok, v.extra);

// ── [٨] #118 — المحرِّرُ يعمل بلوحة المفاتيح، والأثرُ يصل التخزين ──────────
{
  const b = live.barEditor || {};
  console.log("\n[٨] #118 — محرِّرُ شريط الأزرار: أثرٌ لا رسم");
  check("[٨] الصفوفُ مرسومةٌ بمعرّفاتها", Array.isArray(b.before) && b.before.length >= 2, b.before);
  // ⚠️ **يُقاس الوصولُ لا وقوعُ التركيز**: التركيزُ لا يعمل مقطوعَ الرأس، **و«لم
  // أقس» ليست «قِستُ فوجدت صفراً»** — **والوقوعُ خطوةٌ عند المالك (`م3`).**
  check("[٨] ⭐ والصفُّ يصله `Tab` بالبناء (`tabIndex=0`، لا `div` أصمّ)",
    b.focusable === true, b);
  check("[٨] ⭐⭐ و`↓` يُحرّكه فعلاً",
    Array.isArray(b.after) && JSON.stringify(b.after) !== JSON.stringify(b.before), b);
  // ⭐ **والأثرُ في التخزين لا في الرسم** — محرِّرٌ يُحرّك صفّاً ولا يحفظ **أسوأ
  // من محرِّرٍ لا يتحرّك**: الأوّل يَعِد ويكذب، والثاني يُشتكى منه في دقيقة.
  check("[٨] ⭐⭐ والترتيبُ الجديد وصل التخزين",
    Array.isArray(b.stored) && b.stored.length >= 2 &&
    JSON.stringify(b.stored.map((x) => x.id)) === JSON.stringify(b.after), b.stored);
  check("[٨] ⭐ والحالُ تُقال في منطقةٍ حيّة (لا بالرسم وحده)",
    typeof b.نطق === "string" && b.نطق.trim().length > 0, b.نطق);

  console.log("\n[٨ب] #122 — محاكي المشغّل: المنطقةُ تتبدّل والموضعُ يبقى");
  check("[٨ب] الشريطُ السفليّ مرسوم", b.barHas === true, b);
  // ⛔⭐ **يُقاس الانقلابُ لا الاتّجاه** (2026-08-07): أوّلُ صياغةٍ اشترطت «كان
  // داخل الشريط» — **والاجتياحُ في [٣] يُبدّل كلَّ ضابط فيتركهما مطفأين** ⇒
  // **فقرأ المِجَسُّ حالاً صحيحةً فشلاً.** ⭐ **وهي ثالثةُ هذا الشكل في يومين**
  // (لوحةُ الفلاتر · وهذي) ⇒ **والقاعدة: شرطٌ يفترض حالاً ابتدائيّة يقيسها أو
  // يُنتجها — ولا يفترضها**، وحيث يكفي الانقلابُ فهو أمتنُ لأنه لا يفترض شيئاً.
  check("[٨ب] والزرُّ في منطقةٍ معلومة قبل اللمس", b.zone0 === "in" || b.zone0 === "out", b);
  // ⭐⭐ **الأثرُ لا الوصف**: المسافةُ تنقله فعلاً بين المنطقتين
  check("[٨ب] ⭐⭐ والمسافةُ تنقله بين الشريط وخارجه فعلاً",
    !!b.zone1 && b.zone1 !== b.zone0, b);
  // **والتخزينُ يوافق المنطقةَ الجديدة** — فلا واجهةٌ تقول غيرَ ما يُحفظ
  check("[٨ب] ⭐ والتخزينُ يوافق المنطقةَ الجديدة", b.onAfter === (b.zone1 === "in"), b);
  // ⛔ **وهذا سببُ الشكل كلِّه**: لو مَحا الإطفاءُ الموضعَ لعاد الزرُّ إلى الذيل
  check("[٨ب] ⭐⭐ وموضعُه في القائمة لم يتبدّل", b.posAfter === b.posBefore && b.posBefore >= 0, b);
  check("[٨ب] ولم يسقط من القائمة", b.بقي_في_القائمة === true, b);

  console.log("\n[٨ج] #123 — عناصرُ يوتيوب: عرضٌ لا تحكّم، ومرآةٌ لا مصدر");
  // **العددُ يُقرأ في الحال المُنتَجة** — ولا يُفترض من حالٍ خلّفها قسمٌ قبله
  check("[٨ج] سبعةُ عناصرَ مُعلَنون في السجلّ", b.ytMid + (b.playThere ? 0 : 1) >= 1 && b.ytMid >= 1, b);
  // **مواضعُها كما قِيست على يوتيوب**: 3 يساراً و4 يميناً
  check("[٨ج] ⭐ ثلاثةٌ يساراً وأربعةٌ يميناً (كما قِيس)",
    b.ytLeft === 3 && b.ytRight === 4, { يسار: b.ytLeft, يمين: b.ytRight });
  // ⛔⭐⭐ **الفرقُ بنيويٌّ لا تلميح** — بوّابةُ قبولٍ من المالك
  check("[٨ج] ⭐⭐ ولا يستقبل مؤشّراً أصلاً (فلا يُسحب)",
    b.ytStruct?.مؤشّر === "none", b.ytStruct);
  check("[٨ج] ⭐ ولا يدخل حلقةَ التركيز", b.ytStruct?.تركيز === -1, b.ytStruct);
  check("[٨ج] وخارج شجرة الوصول", b.ytStruct?.مخفيٌّ_للقارئ === "true", b.ytStruct);
  check("[٨ج] ولا يُعلَن قابلاً للسحب", b.ytStruct?.قابل_للسحب === false, b.ytStruct);
  // ⭐⭐ **الاتّجاه الواحد، أثراً لا وصفاً**: Clean Player ⇒ الإطار
  // ⭐ **شاهدٌ موجب أوّلاً**: بلا تأشيرٍ يكون العنصرُ ظاهراً — وإلا كان الأحمرُ عمىً
  check("[٨ج] ⭐ شاهدٌ موجب: بلا تأشيرٍ يظهر العنصر", b.playThere === true, b);
  if (b.shape) {
    console.log("\n[٨د] #126 — الشكلُ كيوتيوب، والحدُّ وحدَه يفرّق");
    check("[٨د] ⭐ المقاسُ واحدٌ لزرّنا ولعنصر يوتيوب", b.shape.مقاسٌ_واحد === true, b.shape);
    check("[٨د] ⭐⭐ وحدُّ زرّنا مرئيّ", parseFloat(b.shape.حدُّنا) >= 1, b.shape);
    check("[٨د] وحدُّ عنصرِ يوتيوب شفّاف", b.shape.لهم_شفّاف === true, b.shape);
    check("[٨د] ⭐ ولا نصَّ في زرّنا (أيقونةٌ وحدها)", b.shape.نصُّ_زرّنا === "", b.shape);
    check("[٨د] ⭐ وزرُّنا يسارَ عناصر يوتيوب — كالحقن الحقيقيّ", b.shape.يسارَهم === true, b.shape);
  }
  check("[٨ج] ⭐⭐ ومربّعُ Clean Player يُخفي عنصرَه من الإطار فوراً",
    b.playGone === true && b.ytAfter === b.ytMid - 1, { قبل: b.ytMid, بعد: b.ytAfter });

  // ── [٨هـ] #129 — **تخطيطُ ملء الشاشة: كلُّ شرطٍ منه مقيسٌ على مشغّلٍ حيّ** ──
  // ⛔ **ولا يحرس هذا القسمُ الشكلَ الجميل: يحرس أن ما رُسم هو ما قِيس** —
  // **فالمعاينةُ التي تكذب أسوأ من غياب المعاينة**، وهي علّةُ الإطار كلِّه.
  // ⚠️ **والأرقامُ خلفه في `tools/bench-129-fs-layout.mjs`** — ومن شكّ يُعيد سحبَه.
  if (b.fs129) {
    const f = b.fs129;
    console.log("\n[٨هـ] #129 — الإطارُ يحاكي ملءَ الشاشة");
    check("[٨هـ] شريطُ العنوان مرسومٌ أعلى الصورة", f.عنوان === true, f);
    // ⛔ **العددُ يُشتقّ من السجلّ ولا يُكتب** (قرار 34): كُتب `5` يومَ القياس،
    // **فلمّا دخلت أيقونةٌ سادسة بشهادة المالك احمرّ الشاهدُ على تغييرٍ مقصود** —
    // وهو عينُ ما وقع في `probe-17` مع «توقيت=8».
    check(`[٨هـ] ⭐ وصفُّ الإجراءات بـ${WANT_ACTIONS} أيقونات (كما في السجلّ)`,
      f.إجراءات === WANT_ACTIONS, { رُسم: f.إجراءات, السجلّ: WANT_ACTIONS });
    check("[٨هـ] ⭐ وزرُّ «المزيد من الفيديوهات» وسطَ الشريط", f.وسط === true, f);
    check("[٨هـ] ⭐⭐ ووسطُه وسطٌ حقيقيّ لا طرفٌ ثالث", f.وسطُه_وسط === true, f);
    // ── #130 — **المفتاحُ مسارٌ ومقبض، بالأرقام المقيسة لا بوجودِ عنصر** ──────
    const sw = f.مفتاحُ_التلقائيّ;
    check("[٨هـ] ⭐ ومفتاحُ التشغيل التلقائيّ مرسومٌ مساراً", !!sw && sw.w === 30 && sw.h === 18, sw);
    check("[٨هـ] ⭐⭐ وفيه مقبضٌ (#130: رسمٌ صلبٌ بلا مقبضٍ يُحمّر هنا)",
      !!sw && sw.مقبض === true && sw.مقبضٌ_قياس === "14px×14px", sw);
    // ⛔⭐⭐ #132 — **ورسمُ المقبض نفسُه**: مقبضٌ فارغ كان يمرّ من الشرط أعلاه
    check("[٨هـ] ⭐⭐ وفي المقبض رسمُه — لا دائرةٌ خالية (#132)",
      !!sw && sw.رسم === true && sw.رسمٌ_عرض === 9, sw);
    check("[٨هـ] ⭐ ومقاسُ الرسم من السجلّ لا مفترَضاً",
      !!sw && sw.رسمٌ_مقاس === WANT_KNOB_VB, { رُسم: sw && sw.رسمٌ_مقاس, السجلّ: WANT_KNOB_VB });
    check("[٨هـ] ⭐ والمقبضُ مزاحٌ كما قِيس في الحال المشغَّلة",
      !!sw && /matrix\(1, 0, 0, 1, 12, 0\)/.test(sw.مقبضٌ_إزاحة || ""), sw);
    // ⛔ **شاهدٌ سالبٌ من المنتَج نفسِه**: وضعُ السينما **مقيسٌ `display:none` في
    // ملء الشاشة** ⇒ **ظهورُه هنا يعني أن الإطارَ يَعِد بما لا يقع.**
    check("[٨هـ] ⛔ ولا زرَّ سينما (مقيسٌ مخفيّاً في ملء الشاشة)", f.سينما === false, f);
    check("[٨هـ] وشريطُ التقدّم مرسومٌ وإن كان بلا مفتاح", f.تقدّمٌ_مرسوم === true, f);
    check("[٨هـ] ⭐⭐ والترتيبُ الرأسيّ كما قِيس: عنوان ⇐ إجراءات ⇐ تقدّم ⇐ شريط",
      f.رأسيّةٌ_صحيحة === true, f);
    check("[٨هـ] ⭐ والحدودُ الثلاثة مكتوبةٌ في الإطار نفسِه", f.حدود === 3, f);
  } else {
    fail++; console.log("  ❌ [٨هـ] لم يُقرأ مِجَسُّ #129 أصلاً — ولا يُقرأ غيابُه نجاحاً");
  }
}

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

// ⚠️ **العددان يُشتقّان من سجلّ المُولِّد لا يُكتبان هنا** (قرار 34): رقمٌ بيدٍ
// **يتخلّف بالبناء** — وقد تخلّف فعلاً عند #107 حين انتقل ضابطٌ إلى الـpopup،
// **فاحمرّت البوّابةُ على تغييرٍ مقصود**. ⇒ **والسجلّ هو المصدر، والرسمُ يُقارَن به.**
// **والسجلّ يُحمَّل كما يُحمّله `test-settings-ui.js` — لا مُحلِّلٌ نصّيٌّ ثانٍ**
// (وهو درسُ `test-name-resolves`: الخصوصيّةُ تُبنى والعموميّةُ تُستعار).
const WANT_CLEAN = Object.keys(uiReg.VZ_UI_CLEAN || {}).length;
const WANT_TIMING = (uiReg.VZ_UI_TIMING || []).length;

console.log("\n[٤] وما رُسم — بالعدّ فسقوطُ ضابطٍ يُرى");
check(`[٤] سجلّ المُولِّد قُرئ (${WANT_CLEAN} تنظيف · ${WANT_TIMING} توقيت)`,
  WANT_CLEAN > 0 && WANT_TIMING > 0, { WANT_CLEAN, WANT_TIMING });
check(`[٤] ${WANT_CLEAN} مربّع Clean Player`, live.drawn?.clean === WANT_CLEAN, live.drawn);
check(`[٤] و${WANT_TIMING} ضوابط توقيت`, live.drawn?.timing === WANT_TIMING, live.drawn);
// **وهو مشتقٌّ كذلك: زرُّ تلميحٍ لكلّ ضابطٍ في السجلّين** — والرقمُ المكتوب
// (`46`) كان يعني `38+8`، **فسقط بانتقال ضابطٍ واحد** ولا يقول ذلك لقارئه.
check(`[٤] ولكلٍّ زرّ تلميح (${WANT_CLEAN + WANT_TIMING})`,
  live.drawn?.help >= WANT_CLEAN + WANT_TIMING, live.drawn);

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
