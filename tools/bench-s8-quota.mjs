// S8 — حصّة `storage.sync`: الحدود المعلنة · ما نكتبه وكم مرّة · وهل يقع الاصطدام.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// محليٌّ بلا شبكة ولا مضيف، لكنه يركب حصّةَ الكتابة الحقيقية في كروم: ينتظر 65
//   ثانية وحدها كي تعود حصّة الدقيقة، وتشغيلتان في الساعة نفسها تُعطيان رقمين
//   مختلفين.
//
// ⚠️ يحتاج كروم مثبَّتاً. **لا شبكة ولا مضيف حيّ** — كلّه على صفحاتنا. **لا يُشحن.**
//   node tools/bench-s8-quota.mjs
//   node tools/bench-s8-quota.mjs --witness   # فحص البصر وحده (قرار 26)
//
// ── ثلاثة أسئلة، ولكلٍّ مقياسه ──────────────────────────────────────────────
//  1. **الحدود المعلنة فعلاً** — تُقرأ من `chrome.storage.sync` نفسه لا من ذاكرة
//     كاتب التقرير، **وتُقارن بالثوابت المكتوبة في `storage.js`**: نسخةٌ تتخلّف
//     عن أصلها تقيس الماضي (شاهد ثالث عشر).
//  2. **ما نكتبه وكم مرّة في الحالة الشائعة** — يُعدّ بلفّ `chrome.storage.sync.set`
//     في صفحة الإعدادات ثم **قيادة الواجهة الحقيقية بأحداث موثوقة**: سحب مُنزلق
//     من طرفه إلى طرفه، وتبديل مربّعات. **لا استدعاء مباشر للدوالّ**: المقيس ما
//     يفعله المستخدم لا ما نظنّه يفعله.
//  3. **هل يقع الاصطدام بسلوك واقعيّ** — يُقارن المقيس بالحدّ المعلن. والسيناريو
//     المفتعَل (مئتا كتابة متتالية) يُشغَّل **شاهداً على أن الحدّ مفروض ورسالتنا
//     تُترجمه**، ويُوسم صراحةً بأنه **ليس دليلاً على الواقعية**.
//
// ── شاهدا القبول (قرار 26) ──────────────────────────────────────────────────
//  · **موجب:** تبديل مربّع واحد ⇒ **العدّاد يرى كتابة واحدة على الأقل**. عدّادٌ
//    يقرأ صفراً حيث نعلم أن كتابة تقع لا يُبنى عليه رقم.
//  · **سالب:** فتح الصفحة والانتظار **بلا لمس شيء** ⇒ صفر كتابة بعد الاستقرار.
//    فلا يُنسب إلى الفعل ما تكتبه الصفحة من تلقائها.
//  · **وشاهد ثالث للحدّ نفسه:** كتابات قليلة ⇒ **لا خطأ**، ومئتا كتابة ⇒
//    **`MAX_WRITE_OPERATIONS` فعلاً**. بلا الطرفين لا يُعرف أهو مفروض أصلاً.
import fs from "node:fs";
import path from "node:path";
import { launch, evalIn, connect, ROOT , killChrome } from "./ext-harness.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => process.stdout.write(m + "\n");
const WITNESS_ONLY = process.argv.includes("--witness");
const PORT = 9911;

// ── الثوابت كما كُتبت في المنتج — تُقرأ منه لا تُنسخ هنا ────────────────────
function productLimits() {
  const src = fs.readFileSync(path.join(ROOT, "storage.js"), "utf8");
  const num = (name) => {
    const m = src.match(new RegExp(`const ${name} = (\\d+)`));
    return m ? Number(m[1]) : null;
  };
  return {
    QUOTA_BYTES_PER_ITEM: num("SYNC_ITEM_LIMIT"),
    QUOTA_BYTES: num("SYNC_TOTAL_LIMIT"),
    MAX_ITEMS: num("SYNC_MAX_ITEMS")
  };
}

// ── فتح صفحة الإعدادات داخل الإضافة نفسها ───────────────────────────────────
async function openExtPage(port, url) {
  const tab = await (await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
  const c = await connect(tab.webSocketDebuggerUrl);
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  return c;
}

async function swTarget(port, extensionId) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const sw = targets.find((t) => t.type === "service_worker" &&
    (t.url || "").startsWith(`chrome-extension://${extensionId}/`));
  if (!sw) return null;
  const c = await connect(sw.webSocketDebuggerUrl);
  await c.send("Runtime.enable");
  return c;
}

// ── عدّاد الكتابات: يلفّ `set` و`remove` ويسجّل مفاتيح كل نداء بزمنه ─────────
const COUNTER = `(() => {
  if (window.__s8) return { ok: true, already: true };
  const S = { calls: [], t0: performance.now() };
  window.__s8 = S;
  const wrap = (obj, name) => {
    const orig = obj[name].bind(obj);
    obj[name] = (...args) => {
      S.calls.push({ fn: name,
        keys: name === "set" ? Object.keys(args[0] || {})
            : (Array.isArray(args[0]) ? args[0] : [args[0]]),
        at: Math.round(performance.now() - S.t0) });
      return orig(...args);
    };
  };
  wrap(chrome.storage.sync, "set");
  wrap(chrome.storage.sync, "remove");
  return { ok: true };
})()`;
const READ_CALLS = `(() => { const S = window.__s8 || { calls: [] };
  return { calls: S.calls, n: S.calls.length }; })()`;
const RESET_CALLS = `(window.__s8.calls.length = 0, true)`;

// ── قيادة الواجهة بأحداث موثوقة ─────────────────────────────────────────────
// ⚠️ **أقسام صفحة الإعدادات مخفيّة إلا واحداً.** أول تشغيلة قاست ثلاثة مُنزلقات
// في أقسام `hidden` فطبعت «لا مُنزلق»، ومربّعات Clean Player **بلا `id`** فلم
// تُنقر أصلاً — **فطبعت «صفر كتابة» وهي لم تلمس شيئاً**. «لا أرى» و«لا يوجد»
// يطبعان الرقم نفسه (قرار 26)، فصار التنقّل شرطاً والقياس يُثبت أن القيمة تغيّرت.
async function goSection(page, sectionId) {
  const ok = await evalIn(page, `(() => {
    const b = document.querySelector('.navItem[data-section="' + ${JSON.stringify("")} + ${JSON.stringify(sectionId)} + '"]');
    if (!b) return false; b.click(); return true; })()`);
  await sleep(500);
  return ok;
}

// ⚠️ **عنصرٌ خارج الشاشة لا تصله نقرة.** `gridRadius` مستطيله `y=1292` في نافذة
// ارتفاعها 1000، فكان `elementFromPoint` عنده `null` والسحب يقع في الفراغ —
// فطبعت الأداة «القيمة لم تتغيّر» وهي لم تلمسه. **فيُمرَّر إلى الشاشة أولاً،
// ثم يُقاس مستطيله بعد الاستقرار** (قرار 22).
async function rectOf(page, id) {
  await evalIn(page, `(() => { const el = document.getElementById(${JSON.stringify(id)});
    if (el) el.scrollIntoView({ block: "center" }); return true; })()`);
  await sleep(350);
  return await evalIn(page, `(() => { const el = document.getElementById(${JSON.stringify(id)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    const y = Math.round(r.top + r.height / 2);
    if (y < 0 || y > innerHeight) return null;          // ما زال خارج الشاشة
    // **والشاهد الأخير: هل النقطة تصيبه فعلاً؟** عنصرٌ مرئيّ تحت طبقة أخرى
    // يبتلع نقرتنا بصمت، فيُقرأ سكونه سلوكاً للمنتج.
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), y);
    return { x: Math.round(r.left), y, w: Math.round(r.width), tag: el.tagName,
             type: el.type || "", hits: hit === el,
             cover: hit && hit !== el ? hit.tagName + "." + String(hit.className || "").split(/\\s+/)[0] : "" };
  })()`);
}
async function move(page, x, y) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "left", buttons: 1 });
}
// سحبٌ حقيقيّ: ضغط ثم حركات كثيرة ثم إفلات. **هذا هو مصدر «العاصفة» المحتمل**:
// مُنزلقٌ يكتب على كل حركة يكتب عشرات المرات في ثانية واحدة.
async function dragSlider(page, id, steps = 40, dir = undefined) {
  const r = await rectOf(page, id);
  if (!r) return { ok: false, why: `لا مُنزلق ${id} (مخفيّ أو خارج الشاشة)` };
  if (!r.hits) return { ok: false, why: `النقطة تصيب ${r.cover} لا المُنزلق — لا يُقاس` };
  const st = await evalIn(page, `(() => { const el = document.getElementById(${JSON.stringify(id)});
    const min = Number(el.min || 0), max = Number(el.max || 100), v = Number(el.value);
    return { value: el.value, frac: (v - min) / (max - min || 1) }; })()`);
  const before = st.value;
  // ⚠️ **والواجهة RTL، فطرفا المُنزلق معكوسان جغرافياً:** اليسار هو الأقصى.
  // فحسابُ الاتجاه من القيمة وحدها أعاد مُنزلقين إلى قيمتهما الأصلية بالضبط،
  // فطبعت الأداة «القيمة لم تتغيّر». **والعلاج محاولةٌ معاكسة لا افتراضُ اتجاه**:
  // تُجرَّب جهة، فإن لم تتحرّك القيمة تُجرَّب الأخرى — والعدّاد يُصفَّر بينهما.
  const toRight = dir === undefined ? st.frac < 0.5 : dir;
  const xs = (i) => toRight ? r.x + Math.round((r.w - 4) * i / steps)
                            : r.x + r.w - 2 - Math.round((r.w - 4) * i / steps);
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: xs(0), y: r.y, button: "none" });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: xs(0), y: r.y, button: "left", clickCount: 1, buttons: 1 });
  for (let i = 1; i <= steps; i++) {
    await move(page, xs(i), r.y);
    await sleep(12);
  }
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: xs(steps), y: r.y, button: "left", clickCount: 1 });
  await sleep(900);
  const after = await evalIn(page, `document.getElementById(${JSON.stringify(id)}).value`);
  // **شاهد السحبة نفسها:** قيمة لم تتغيّر تعني أن السحب لم يقع، وصفرُ كتاباته
  // يقيس عجز الأداة لا سلوك المنتج.
  return { ok: before !== after, moved: `${before} ⇒ ${after}`, steps, used: toRight,
           why: before === after ? "القيمة لم تتغيّر — السحب لم يقع، فلا يُقرأ صفره" : "" };
}
async function clickEl(page, id) {
  const r = await rectOf(page, id);
  if (!r) return false;
  const x = r.x + Math.min(8, Math.round(r.w / 2)), y = r.y;
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await sleep(700);
  return true;
}

async function run() {
  const out = { product: productLimits() };
  const h = await launch(PORT, { withExtension: true, extra: ["--window-size=1400,1000"] });
  let page = null, sw = null;
  try {
    // 1) الحدود المعلنة — من الـ service worker حيث `chrome.storage` كامل
    sw = await swTarget(PORT, h.extensionId);
    if (!sw) throw new Error("لا service worker للإضافة");
    out.declared = await evalIn(sw, `(() => { const s = chrome.storage.sync;
      return { QUOTA_BYTES: s.QUOTA_BYTES, QUOTA_BYTES_PER_ITEM: s.QUOTA_BYTES_PER_ITEM,
               MAX_ITEMS: s.MAX_ITEMS,
               MAX_WRITE_OPERATIONS_PER_HOUR: s.MAX_WRITE_OPERATIONS_PER_HOUR,
               MAX_WRITE_OPERATIONS_PER_MINUTE: s.MAX_WRITE_OPERATIONS_PER_MINUTE,
               MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE: s.MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE }; })()`);

    // 2) صفحة الإعدادات: عدّاد ثم قيادة الواجهة
    page = await openExtPage(PORT, `chrome-extension://${h.extensionId}/options.html`);
    await sleep(2500);
    out.counter = await evalIn(page, COUNTER);
    await sleep(2500);
    // **الشاهد السالب:** صفحةٌ مفتوحة بلا لمس ⇒ صفر كتابة بعد الاستقرار
    out.idle = await evalIn(page, READ_CALLS);
    await evalIn(page, RESET_CALLS);

    // **الشاهد الموجب:** تبديل مربّع واحد ⇒ كتابة واحدة على الأقل
    out.toggleFound = await clickEl(page, "fullscreenOnly");
    out.toggle = await evalIn(page, READ_CALLS);
    await evalIn(page, RESET_CALLS);
    // وإعادته إلى ما كان — لا يُترك إعداد مقلوباً
    await clickEl(page, "fullscreenOnly");
    await evalIn(page, RESET_CALLS);

    if (!WITNESS_ONLY) {
      // 3) الحالة الشائعة: سحب مُنزلقات حقيقية من طرف إلى طرف
      out.drags = {};
      for (const [id, section] of [["gridCellBgOpacity", "zonesSection"], ["gridRadius", "zonesSection"],
                                   ["gridDuration", "timingSection"], ["volumeDuration", "timingSection"],
                                   ["subFontSize", "subtitlesSection"]]) {
        await goSection(page, section);
        let d = await dragSlider(page, id);
        let calls = await evalIn(page, READ_CALLS);
        // **الجهة الأخرى تُشتقّ من الأولى**: كانت مثبَّتة `true` فكرّرت نفسها
        // حين تكون الأولى `true` أصلاً — محاولةٌ معاكسة لا تعاكس شيئاً.
        if (!d.ok && !/مخفيّ|خارج الشاشة|تصيب/.test(d.why || "")) {
          await evalIn(page, RESET_CALLS);
          d = await dragSlider(page, id, 40, !d.used);
          calls = await evalIn(page, READ_CALLS);
          d.retried = true;
        }
        out.drags[id] = { ...d, writes: calls.n, keys: calls.calls.map((c) => c.keys.join("+")) };
        await evalIn(page, RESET_CALLS);
      }
      // ومربّعات Clean Player: أكثر ما يُنقر تتابعاً في جلسة واحدة
      await goSection(page, "youtubeSection");
      const boxCount = await evalIn(page, `document.querySelectorAll("#cleanPlayerList input[type=checkbox]").length`);
      const checkedBefore = await evalIn(page, `[...document.querySelectorAll("#cleanPlayerList input[type=checkbox]")].filter((e) => e.checked).length`);
      const N = Math.min(8, boxCount || 0);
      for (let i = 0; i < N; i++) {
        const rr = await evalIn(page, `(() => { const el = document.querySelectorAll("#cleanPlayerList input[type=checkbox]")[${i}];
          if (!el) return null; const b = el.getBoundingClientRect();
          if (!(b.width > 0 && b.height > 0)) return null;
          return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
        if (!rr) continue;
        await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rr.x, y: rr.y, button: "left", clickCount: 1 });
        await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rr.x, y: rr.y, button: "left", clickCount: 1 });
        await sleep(450);
      }
      const checkedAfter = await evalIn(page, `[...document.querySelectorAll("#cleanPlayerList input[type=checkbox]")].filter((e) => e.checked).length`);
      const afterBoxes = await evalIn(page, READ_CALLS);
      // **شاهد النقرات:** عدد المؤشَّرة يجب أن يتغيّر، وإلا فلم تُنقر مربّعات
      out.boxes = { n: afterBoxes.n, total: boxCount, clicked: N,
                    flipped: checkedAfter - checkedBefore,
                    keys: [...new Set(afterBoxes.calls.map((c) => c.keys.join("+")))] };
      await evalIn(page, RESET_CALLS);

      // 3ب) **العاصفة من عدة تبويبات — سؤال البند نفسه.**
      // الآليّة الوحيدة الواقعية لتضاعف الكتابات هي **حلقة تغذية راجعة**: تبويب
      // يكتب ⇒ `storage.onChanged` في البقيّة ⇒ فيكتبون ⇒ فيوقظون بعضهم. تُقاس
      // بفتح ثلاث نسخ من صفحة الإعدادات وقلب مربّع في واحدة **وعدّ كتابات
      // الأخريين**. والشاهد الموجب في التجربة نفسها: التبويب الفاعل **يجب** أن
      // يكتب 1، وإلا فالعدّادان الآخران لا يقولان شيئاً.
      const tabs = [];
      for (let i = 0; i < 2; i++) {
        const t = await openExtPage(PORT, `chrome-extension://${h.extensionId}/options.html`);
        await sleep(2200);
        await evalIn(t, COUNTER);
        tabs.push(t);
      }
      await sleep(1500);
      for (const t of tabs) await evalIn(t, RESET_CALLS);
      await evalIn(page, RESET_CALLS);
      await goSection(page, "zonesSection");
      await clickEl(page, "fullscreenOnly");
      await sleep(2500);
      out.storm = {
        actor: (await evalIn(page, READ_CALLS)).n,
        others: [],
      };
      for (const t of tabs) out.storm.others.push((await evalIn(t, READ_CALLS)).n);
      await clickEl(page, "fullscreenOnly");   // إعادة الإعداد كما كان
      await sleep(1200);
      for (const t of tabs) { try { t.ws.close(); } catch {} }
      await evalIn(page, RESET_CALLS);

      // 4) الحدّ مفروضٌ أم لا — **سيناريو مفتعَل، شاهدٌ لا دليل واقعية**
      out.burstSmall = await evalIn(sw, `(async () => {
        const t0 = Date.now(); let err = null, n = 0;
        for (let i = 0; i < 10; i++) {
          try { await chrome.storage.sync.set({ __s8probe: i }); n++; }
          catch (e) { err = String(e.message).slice(0, 90); break; }
        }
        return { n, err, ms: Date.now() - t0 };
      })()`);
      out.burstBig = await evalIn(sw, `(async () => {
        const t0 = Date.now(); let err = null, n = 0;
        for (let i = 0; i < 200; i++) {
          try { await chrome.storage.sync.set({ __s8probe: i }); n++; }
          catch (e) { err = String(e.message).slice(0, 120); break; }
        }
        return { n, err, ms: Date.now() - t0 };
      })()`);
      // وهل يترجمها `syncErrorText` كما وُعد؟ يُقاس على النصّ الحقيقي الخارج
      out.translated = out.burstBig?.err
        ? await evalIn(page, `(() => { try { return syncErrorText(new Error(${JSON.stringify(out.burstBig.err)})); }
            catch (e) { return "syncErrorText غير متاح: " + e.message; } })()`)
        : null;
      await evalIn(sw, `chrome.storage.sync.remove("__s8probe").catch(() => {})`);

      // 3ج) **سقف الواجهة نفسها — بعد الاندفاعة بدقيقة كاملة.**
      // ⚠️ **الترتيب ليس تفصيلاً:** حين سبق هذا الاختبارُ الاندفاعةَ استهلك حصّة
      // الدقيقة كلّها، فطبعت الاندفاعة «خطأ عند الكتابة رقم 0» — رقمٌ صحيح عن
      // قياسٍ أفسده ترتيبه. فتُفصل الحصّتان بانتظار حقيقيّ.
      log("⏳ انتظار 65 ثانية كي تعود حصّة الدقيقة قبل قياس سقف الواجهة …");
      await sleep(65000);
      // سقف الواجهة نفسها — لا سقف الـAPI. السؤال «هل يقع الاصطدام
      // بسلوك واقعيّ» لا يُجاب بحدسٍ عن سرعة المستخدم: يُقلَب مربّع واحد ذهاباً
      // وإياباً **بأقصى ما تسمح به الواجهة** (نقرات موثوقة متتابعة بلا انتظار)،
      // فيخرج **سقفٌ فوق أي إنسان**. فإن كان هذا السقف بعيداً عن الحدّ، فالمستخدم
      // أبعد منه بمراحل.
      await goSection(page, "youtubeSection");
      await evalIn(page, RESET_CALLS);
      const rr = await evalIn(page, `(() => { const el = document.querySelectorAll("#cleanPlayerList input[type=checkbox]")[0];
        if (!el) return null; el.scrollIntoView({ block: "center" });
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`);
      if (rr) {
        const t0 = Date.now();
        let clicks = 0;
        while (Date.now() - t0 < 12000) {
          await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rr.x, y: rr.y, button: "left", clickCount: 1 });
          await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rr.x, y: rr.y, button: "left", clickCount: 1 });
          clicks++;
          await sleep(40);
        }
        await sleep(1500);
        const fast = await evalIn(page, READ_CALLS);
        // **وماذا يرى المستخدم حين يُرفض الحفظ؟** هذا هو السؤال الحاسم: حدٌّ
        // يُبلَّغ عنه عطبٌ محتمَل، وحدٌّ يُرفض صامتاً **نجاحٌ كاذب** (قرار 35).
        out.uiCeiling = { clicks, ms: Date.now() - t0, writes: fast.n,
          toast: await evalIn(page, `(() => { const t = document.getElementById("toast");
            return t ? { text: (t.textContent || "").slice(0, 120), shown: t.classList.contains("show"),
                         cls: t.className } : null; })()`),
          // وهل ما في التخزين يطابق ما تعرضه الواجهة؟
          drift: await evalIn(page, `(async () => {
            const d = await chrome.storage.sync.get({ settings: {} });
            const stored = ((d.settings || {}).cleanPlayer || {}).items || {};
            const ui = {};
            for (const el of document.querySelectorAll("#cleanPlayerList input[type=checkbox]")) {
              if (el.checked) ui[el.id.replace(/^cp_/, "")] = true;
            }
            const a = Object.keys(stored).sort().join(","), b = Object.keys(ui).sort().join(",");
            return { same: a === b, stored: a.slice(0, 80), ui: b.slice(0, 80) };
          })()`) };
        await evalIn(page, RESET_CALLS);
      }

      // 5) الاستهلاك الحقيقي بعد كل ذلك
      out.usage = await evalIn(sw, `(async () => ({
        bytes: await chrome.storage.sync.getBytesInUse(null),
        items: Object.keys(await chrome.storage.sync.get(null)).length }))()`);
    }
  } catch (e) {
    out.error = String(e?.message || e).slice(0, 120);
  } finally {
    try { page?.ws?.close(); } catch {}
    try { sw?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {}
    killChrome(h);
  }
  return out;
}

const RAW = path.join(ROOT, "tools", ".s8-raw.json");
const r = process.argv.includes("--from-raw")
  ? JSON.parse(fs.readFileSync(RAW, "utf8"))
  : await run();
if (!process.argv.includes("--from-raw")) fs.writeFileSync(RAW, JSON.stringify(r, null, 1));

console.log(`\n=== S8 — حصّة storage.sync وwrite storm ===`);
if (r.error) { console.log(`⚠️ ${r.error}`); process.exit(1); }

console.log(`\n── 1) الحدود المعلنة — مقروءة من كروم لا من الذاكرة`);
for (const [k, v] of Object.entries(r.declared || {})) console.log(`   ${k.padEnd(42)} ${v}`);
console.log(`\n   ومقارنتها بالثوابت المكتوبة في storage.js:`);
for (const [k, v] of Object.entries(r.product)) {
  const d = r.declared?.[k];
  console.log(`   ${k.padEnd(22)} المنتج ${String(v).padEnd(8)} كروم ${String(d).padEnd(8)} ${v === d ? "✅ مطابق" : "❌ **متباعد**"}`);
}

console.log(`\n── فحص البصر (قرار 26)`);
const posOk = (r.toggle?.n || 0) >= 1;
const negOk = (r.idle?.n || 0) === 0;
console.log(`   موجب: تبديل مربّع واحد ⇒ ${r.toggle?.n ?? "?"} كتابة ${posOk ? "✅" : "❌ العدّاد لا يرى"}`);
console.log(`   سالب: صفحة مفتوحة بلا لمس ⇒ ${r.idle?.n ?? "?"} كتابة ${negOk ? "✅" : "❌ يُنسب إلى الفعل ما ليس منه"}`);
if (!WITNESS_ONLY) {
  const burstOk = !r.burstSmall?.err && /MAX_WRITE_OPERATIONS/i.test(r.burstBig?.err || "");
  console.log(`   حدّ الكتابة: 10 كتابات ⇒ ${r.burstSmall?.err ? "❌ " + r.burstSmall.err : "بلا خطأ ✅"} · 200 كتابة ⇒ ${r.burstBig?.err ? "خطأ عند رقم " + r.burstBig.n : "**بلا خطأ**"} ${burstOk ? "✅" : "⚠️"}`);
}
console.log(`   ⇒ ${posOk && negOk ? "**الرِكاز صالح**" : "**غير صالح — لا يُبنى على رقم منه**"}`);
if (!posOk || !negOk) process.exit(1);
if (WITNESS_ONLY) process.exit(0);

console.log(`\n── 2) ما نكتبه وكم مرّة — بقيادة الواجهة الحقيقية`);
console.log(`   سحب مُنزلق من طرفه إلى طرفه (40 حركة مؤشّر لكل سحبة):`);
for (const [id, d] of Object.entries(r.drags)) {
  console.log(`     ${id.padEnd(20)} ${d.ok ? `${d.moved.padEnd(16)} ⇒ **${d.writes} كتابة**${d.writes ? " · " + [...new Set(d.keys)].join(",") : ""}${d.retried ? " (بالجهة المعاكسة)" : ""}` : "⚠️ " + d.why}`);
}
console.log(`   تبديل ${r.boxes?.clicked ?? "?"} مربّعاً متتالياً (من ${r.boxes?.total ?? "?"}) ⇒ **${r.boxes?.n ?? "?"} كتابة**` +
  `  · وشاهدها: عدد المؤشَّرة تغيّر بـ${r.boxes?.flipped ?? "?"}${r.boxes?.flipped ? " ✅" : " ❌ لم يُنقر شيء — لا يُقرأ صفره"}`);

console.log(`\n── 3) هل يقع الاصطدام بسلوك واقعيّ؟`);
console.log(`   **عاصفة التبويبات:** ثلاث نسخ من صفحة الإعدادات · قلبُ مربّع في واحدة ⇒`);
console.log(`     التبويب الفاعل **${r.storm?.actor ?? "?"} كتابة**${(r.storm?.actor || 0) === 1 ? " ✅ (شاهد موجب داخل التجربة)" : " ⚠️"}` +
            ` · والتبويبان الآخران **${(r.storm?.others || []).join(" و")} كتابة**` +
            `${(r.storm?.others || []).every((n) => n === 0) ? " ✅ **لا حلقة تغذية راجعة**" : " ❌ **حلقة!**"}`);
const perMin = r.declared?.MAX_WRITE_OPERATIONS_PER_MINUTE;
const dragWrites = Object.values(r.drags).reduce((a, d) => a + (d.writes || 0), 0);
const u = r.uiCeiling;
if (u) {
  const perMinUi = Math.round(u.writes / (u.ms / 60000));
  console.log(`   **سقف الواجهة نفسها** (نقر متتابع بأقصى سرعة، فوق أي إنسان): ${u.clicks} نقرة في ${(u.ms / 1000).toFixed(1)}s ⇒ **${u.writes} كتابة** = **${perMinUi} كتابة/دقيقة**`);
  console.log(`     ${perMinUi > (r.declared?.MAX_WRITE_OPERATIONS_PER_MINUTE || 120) ? "⚠️ **فوق الحدّ** — والواجهة بلا خانق، لكنه معدّل آلة لا إنسان" : "✅ **تحت الحدّ حتى بسرعة الآلة**"}`);
  console.log(`     وماذا يرى المستخدم عند الرفض: ${u.toast ? `«${u.toast.text}» ${u.toast.shown ? "**ظاهرة** ✅" : "**غير ظاهرة** ⚠️"}` : "لا عنصر رسالة"}`);
  console.log(`     وهل تكذب الواجهة عن حفظ لم يقع: ${u.drift ? (u.drift.same ? "لا — المعروض يطابق المخزَّن ✅" : `**نعم — انحراف**: مخزَّن [${u.drift.stored}] · معروض [${u.drift.ui}]`) : "—"}`);
}
console.log(`   الحدّ المعلن                : ${perMin} كتابة/دقيقة · ${r.declared?.MAX_WRITE_OPERATIONS_PER_HOUR} كتابة/ساعة`);
console.log(`   خمس سحبات كاملة كلّفت      : **${dragWrites} كتابة** (لا واحدة لكل حركة مؤشّر)`);
console.log(`   الاستهلاك بعد كل ذلك       : ${r.usage?.bytes} بايت من ${r.declared?.QUOTA_BYTES} · ${r.usage?.items} عنصراً من ${r.declared?.MAX_ITEMS}`);
console.log(`\n   ⚠️ **والسيناريو المفتعَل شاهدٌ على أن الحدّ مفروض، لا دليلٌ على واقعيته:**`);
console.log(`   200 كتابة متتالية ⇒ ${r.burstBig?.err ? `خطأ عند الكتابة رقم **${r.burstBig.n}** خلال ${r.burstBig.ms}ms:\n     "${r.burstBig.err}"` : "**بلا خطأ** — الحدّ لم يُفرض في هذا الرِكاز"}`);
if (r.translated) console.log(`   وترجمة رسالتنا لها       : «${r.translated}»`);
console.log("");
