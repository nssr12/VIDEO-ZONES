// تحميل **الإضافة الحقيقية** في كروم للقياس — وحدة مشتركة لكل أدوات bench.
//
// ⚠️ يحتاج كروم مثبَّتاً. **لا يُشحن.**
//   node tools/ext-harness.mjs        # يشغّل شاهدَي القبول ويطبعهما
//
// ── لماذا وُجد ───────────────────────────────────────────────────────────────
// **`--load-extension` لم يعد يعمل.** قِيس على **Chrome/150.0.7871.187** أن
// الإضافة لا تُحمَّل به إطلاقاً، في **ثلاث تركيبات**:
//   (أ) `--headless=new` + `--load-extension`                         ⇒ ❌
//   (ب) ومعه `--disable-features=DisableLoadExtensionCommandLineSwitch` ⇒ ❌
//   (ج) و**بلا headless أصلاً** (نافذة حقيقية خارج الشاشة)             ⇒ ❌
// وفي الثلاث: **صفر أهداف لإضافتنا وصفر عوالم معزولة**، والخرج **مطابق تماماً**
// لتشغيلة بلا إضافة — وهذا هو مصدر عمى `bench-zero-change.mjs`، الذي **عطّل
// عملنا ثلاث مرات** (`tools/KNOWN-DEFECTS.md`).
//
// **والبديل المقيس: `Extensions.loadUnpacked` على هدف المتصفّح** — يعمل في
// `--headless=new` بلا أي سمة إضافية، ويُرجع معرّف الإضافة.
//
// ── شاهدا القبول (قرار 26) — يُشغَّلان بـ`node tools/ext-harness.mjs` ────────
//  · **موجب:** لا يكفي أن تُحمَّل الإضافة، بل **أن تُرى عاملةً على صفحة**:
//    عالم معزول باسمها **و**`__GVZ_CONTENT_LOADED__ === true` فيه، **ثم أثر
//    فعليّ في شجرة الصفحة** — عجلة فوق الفيديو تُظهر عناصر الـ overlay.
//    **«حُمِّلت» و«تعمل» ليسا شيئاً واحداً**، وأولى الأداتين العمياء أثبتت ذلك.
//  · **سالب:** نفس الصفحة ونفس الخطوات **بلا تحميل الإضافة** ⇒ لا عالم معزول،
//    ولا علم، ولا عنصر overlay. بلا هذا الشاهد يصير الموجب بلا معنى: أداة تطبع
//    ✅ دائماً لا تُميّز شيئاً.
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// اسم الإضافة كما يظهر للعالم المعزول — يُقرأ من المانيفست لا يُثبَّت هنا.
import fs from "node:fs";
export const EXT_NAME = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")).name;

export async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let n = 0; const pend = new Map(); const events = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method) events.push(m);
    if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  };
  return {
    ws, events,
    send: (method, params = {}) => new Promise((r) => {
      const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params }));
    })
  };
}

// يُشغّل كروم، ويحمّل الإضافة إن طُلب. `withExtension: false` هو **الشاهد السالب**.
export const HARNESS_LANG = "ar-EG";   // بيئة المنتج — تُعلَن ولا تُورَث (انظر أدناه)
export async function launch(port, { withExtension = true, extra = [], extPath = ROOT,
                                     lang = HARNESS_LANG } = {}) {
  // ⛔ **فحصٌ قَبْليّ: أيجيب أحدٌ على المنفذ قبل أن نُشغّل؟** (2026-08-03)
  // **الموعد بيننا وبين كروم هو المنفذ**، فكروم متسرّبٌ من تشغيلةٍ سابقة **يردّ
  // على النداء** فنتّصل به — **ونقيس البناء الذي حُمِّل فيه لا بناءنا**.
  // ⚠️ **وقد وقع فعلاً وكاد يُنشر:** طُبع أن لوحة الأخطاء تحمل
  // `persistTiming` و`__vzDeliberatelyMissing` **بعد** إصلاحٍ نجح، والرسالتان من
  // ملفّ تعريفٍ قديم. ⇒ **رِكازٌ يقيس الماضي ويطبعه حاضراً**، وهو أخطر من عطبٍ
  // لأنه يُكذّب إصلاحاً صحيحاً. **فيُرفض بصوتٍ عالٍ ولا يُتخطّى صامتاً.**
  try {
    const stale = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (stale.ok) {
      throw new Error(`المنفذ ${port} مشغولٌ بكروم من تشغيلةٍ سابقة — ` +
        `**سيُقاس بناءٌ قديم**. أغلقه: pkill -f "remote-debugging-port=${port}"`);
    }
  } catch (e) {
    if (String(e?.message || "").startsWith("المنفذ")) throw e;   // رفضُنا لا فشل الاتصال
  }
  const proc = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
    "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required",
    // ⚠️ **اللغة تُعلَن ولا تُترك للصدفة (2026-08-02).** كانت غائبة، فكان كروم
    // يأخذ لغة النظام ويوتيوب يضيف إليها الموقع الجغرافي — **فوقعت قياساتنا على
    // `ar_EG` مصادفةً**، وهي بيئة المالك فسلمت النتيجة. وعلى جهازٍ آخر (أو في
    // تشغيلٍ آليّ) كانت ستقع على `en_US`، **فيُقاس مشغّلٌ بتخطيط معكوس عن تخطيط
    // المالك** — أي بيئة أخرى تُنشر أرقامها باسم بيئته.
    // ⇒ **العربية مقصودة هنا لأنها بيئة المنتج**: واجهته RTL، ومنصّاته اليدوية
    // تُنفَّذ على واجهة عربية. ومن أراد قياس تخطيط آخر **يُعلنه صراحةً** ولا يرثه.
    `--lang=${lang}`, `--accept-lang=${lang}`,
    ...extra,
    `--user-data-dir=/tmp/vz-ext-${port}-${process.pid}-${Math.floor(port * 7919 % 100000)}`,
    `--remote-debugging-port=${port}`, "about:blank"
  ], { stdio: "ignore" });
  let version = null;
  for (let i = 0; i < 80; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!version) { try { proc.kill(); } catch (e) { console.log("⚠️ تعذّر إنهاء كروم بعد فشل الإقلاع: " + (e?.message || e)); } throw new Error("لم يستجب كروم"); }

  let extensionId = null, browser = null;
  if (withExtension) {
    browser = await connect(version.webSocketDebuggerUrl);
    // ⚠️ **لا يُفترض النجاح — تُقرأ نتيجة الاستدعاء نفسها.**
    const res = await browser.send("Extensions.loadUnpacked", { path: extPath });
    extensionId = res?.result?.id || null;
    if (!extensionId) {
      try { browser.ws.close(); } catch {} try { proc.kill(); } catch (e) { console.log("⚠️ تعذّر إنهاء كروم بعد فشل الإقلاع: " + (e?.message || e)); }
      throw new Error("Extensions.loadUnpacked لم يُرجع معرّفاً: " + JSON.stringify(res).slice(0, 200));
    }
    await sleep(1200); // كي يبدأ الـ service worker وتُسجَّل سكربتات المحتوى
  }
  // ⛔ **`kill()` على الكائن نفسه — والعلّة أن غيابها كان يُبتلع صامتاً:**
  // `bench-options-page` كانت تنادي `chrome.kill()` في `finally { ... } catch {}`،
  // **و`kill` ليست على الكائن** ⇒ `TypeError` يُبتلع ⇒ **كروم لا يموت أبداً**،
  // فتُخلّف كلُّ تشغيلةٍ نسخةً، **وما بعدها يتّصل بها فيقيس بناءً قديماً** (قرار 44).
  // ⇒ **العلاج بموضعٍ واحد يجعل الخطأ مستحيلاً** (قرار 16ج) لا بتصحيح تسعة مُنادين.
  // **يُفوَّض إلى المُنهي الواحد** — فلا رسالتان لعلّةٍ واحدة (قرار 36).
  const kill = () => killChrome({ proc, browser });
  return { proc, browser, extensionId, chrome: version.Browser, kill };
}

// ── ضبط تخزين الإضافة قبل القياس ────────────────────────────────────────────
// ⚠️ **ملفّ متصفّح جديد يعني إضافة مطفأة**: `globalSiteRules.enabled` افتراضه
// `false`، و`remappingEnabled()` بوّابة `zonesActive()` — فلا overlay ولا أمر
// مهما صحّ كل شيء آخر. **قياسٌ على إضافة مطفأة يقيس الإطفاء لا الميزة**، وهذا
// أحد ما كان يمكن أن يُقرأ عمى ثانياً.
// والكتابة تقع في **الـ service worker للإضافة** — الموضع الوحيد الذي يملك
// `chrome.storage` — ويُقرأ ما كُتب للتحقّق، فلا يُفترض نجاحها.
export async function configure(port, extensionId, obj) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const sw = targets.find((t) => t.type === "service_worker" &&
    (t.url || "").startsWith(`chrome-extension://${extensionId}/`));
  if (!sw) return { ok: false, why: "لا service worker للإضافة" };
  const c = await connect(sw.webSocketDebuggerUrl);
  try {
    await c.send("Runtime.enable");
    const r = await c.send("Runtime.evaluate", {
      expression: `(async () => { await chrome.storage.sync.set(${JSON.stringify(obj)});
        return await chrome.storage.sync.get(Object.keys(${JSON.stringify(obj)})); })()`,
      awaitPromise: true, returnByValue: true
    });
    const readBack = r?.result?.result?.value;
    return { ok: !!readBack, readBack, error: r?.result?.exceptionDetails?.text };
  } finally { try { c.ws.close(); } catch {} }
}

// ── المُنهي الواحد — **يقول حين يفشل** (قرار 46 · البند #83) ────────────────
// ⛔ **العلّة المقيسة:** `killChrome(chrome);` — و`kill` **ليست على
// الكائن** ⇒ `TypeError` **يُبتلع** ⇒ كروم لا يموت، **فتُخلّف كلُّ تشغيلةٍ نسخةً
// وما بعدها يتّصل بها فيقيس بناءً قديماً** (قرار 44). **وكاد يُرجع إصلاحاً صحيحاً.**
// ⇒ **وعِلّتها واحدة فالعلاج واحد لا ستّةٌ وثلاثون**: مُنهٍ مشترك يقبل
// «الكائن أو العملية»، **ويُعلن الفشل ولا يبتلعه**.
// ⚠️ **والمعيار ليس نوع العملية بل أثرُ فشلها خارج موضعها:** «التفكيك آمنٌ
// بطبعه» **خطأٌ مقيس** — الذي أفسد القياس كان تفكيكاً.
export function killChrome(target, what = "كروم") {
  try { target?.browser?.ws?.close?.(); } catch {}
  const proc = target?.proc || target;
  try {
    if (typeof proc?.kill !== "function") throw new Error("لا `kill` على الهدف المُمرَّر");
    proc.kill();
  } catch (e) {
    console.log(`⚠️ تعذّر إنهاء ${what}: ${e?.message || e} — ` +
      `**قد تبقى عملية حيّة تسمّم التشغيلة التالية** (#83)`);
  }
}

// ينتظر تحرّر المنفذ بعد القتل — **والانتظار صريحٌ لا `sleep` تخمينيّ**.
// ⚠️ **رِكازٌ يشغّل تشغيلاتٍ متتابعة على منفذٍ واحد يرفضه فحصُه القَبْليّ نفسه**
// إن لم ينتظر موت السابقة: القتل لا يعني الموت فوراً. **فيُنتظر ويُتحقَّق.**
export async function waitPortFree(port, timeoutMs = 8000) {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (!r.ok) return true;
    } catch { return true; }                    // لا أحد يجيب ⇒ حُرِّر
    if (Date.now() - t0 > timeoutMs) return false;
    await sleep(150);
  }
}

export async function openPage(port, url) {
  const tab = await (await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
  const c = await connect(tab.webSocketDebuggerUrl);
  await c.send("Runtime.enable");
  await c.send("Page.enable");
  return c;
}

// العالم المعزول لسكربت المحتوى — يُميَّز باسم الإضافة **وبعلمها معاً**، لا
// بالاسم وحده: عالم موجود بلا علم يعني أن السكربت لم يعمل على هذه الصفحة.
export async function contentWorld(c) {
  const ctxs = c.events
    .filter((e) => e.method === "Runtime.executionContextCreated")
    .map((e) => e.params.context)
    .filter((x) => x.auxData && x.auxData.isDefault === false);
  const named = ctxs.filter((x) => (x.name || "").includes(EXT_NAME));
  for (const x of named.reverse()) {
    const r = await c.send("Runtime.evaluate", {
      expression: `!!window.__GVZ_CONTENT_LOADED__`, contextId: x.id, returnByValue: true
    });
    if (r?.result?.result?.value === true) return { id: x.id, name: x.name };
  }
  return null;
}

// ── `evalIn` — **الطريقُ الذي كان يفشل ولا يقول** (#93، 2026-08-04) ─────────
// ⛔ **العلّة، مقيسةً على هذي الدالّة نفسِها قبل إصلاحها:**
//   · قيمةٌ سليمة        ⇒ القيمة
//   · **وعدٌ مرفوض**      ⇒ **`{}` — صادقٌ في `if`**  ⇐ **إثباتٌ كاذب**
//   · **رميةٌ متزامنة**   ⇒ `undefined`               ⇐ **صفرٌ كاذب**
//   · `undefined` صريحة  ⇒ `undefined`               ⇐ **لا تُميَّز عن الرمية**
// **والسببُ البنيويّ: `returnByValue` يُسلسِل كائن `Error` إلى `{}`** — كائنٌ
// فارغٌ **صادق**. ⇒ ⭐ **فمُساعدٌ واحد كان يُنتج الإثباتَ الكاذب والصفرَ الكاذب
// معاً، وقد ظُنّا بابين.**
//
// **وما كلّفه:** قسم [٣] في `bench-options-page.mjs` — **الذي أُضيف لِـ#82 ليقيس
// التفاعل لا التحميل، والذي وُسِّع له قرار 32 وجُعل غير قابلٍ للتخطّي** — كان
// **أخضرَ عن عمى في ضوابطه الـ46 كلِّها منذ يومه**: تعبيرُه يرمي، فيُرجَع `{}`
// الصادقة، فتُبنى الحقول غائبةً، **وغيابُها يُقرأ «لا عيب»**.
//
// ⇒ **العلاج: الرمية تُقال ولا تُبتلع** — وبها يصير `undefined` **معناه واحداً
// لا اثنين**: «التعبير قيمتُه `undefined`»، لا «رمى». **والتفريقُ نصفُ العلّة.**
// ⚠️ **ولا تُلتقط هذي الرمية بـ`catch` فارغ في موضع النداء** — فذاك إعادةُ
// العلّة بيدٍ أخرى: من احتاج تحمّلَ رميةٍ **يُعلن ذلك بنصّه ويقول ماذا يعني**.
//
// ⚠️ **وحدُّ ما أُصلح مُعلَنٌ ولا يُوسَّع:** `contentWorld` أعلاه **يبتلع كذلك،
// ولا يُضلَّل** — يشترط `=== true` فلا تخدعه `{}`؛ **مقيسٌ لا مُقدَّر**، ولم
// يُمسّ. **فالابتلاعُ شرطٌ لازم لا كافٍ.**
export const evalIn = async (c, expression, contextId) => {
  const r = await c.send("Runtime.evaluate",
    contextId ? { expression, contextId, returnByValue: true, awaitPromise: true }
              : { expression, returnByValue: true, awaitPromise: true, allowUnsafeEvalBlockedByCSP: true });
  const ex = r?.result?.exceptionDetails;
  if (ex) {
    // **الرسالة تحمل التعبير نفسه** — فرميةٌ في رِكازٍ فيه عشرات النداءات بلا
    // موضعها بلاغٌ لا يُستدلّ به، وهو الشكل الذي نطارده لا نصنعه.
    const why = String(ex.exception?.description || ex.text || "استثناء بلا وصف").split("\n")[0];
    const err = new Error(`تعبيرٌ رمى في الصفحة: ${why.slice(0, 150)}` +
      ` — عند: \`${String(expression).replace(/\s+/g, " ").trim().slice(0, 90)}\``);
    err.vzEvalThrew = true;                 // علامةٌ بنيوية لمن يُميّزها عمداً
    throw err;
  }
  return r?.result?.result?.value;
};

// ── صفحة الفحص: فيديو حقيقي من WAV مركَّب، بلا شبكة وبلا ملف في المستودع ─────
function wav(seconds = 6, rate = 8000) {
  const n = seconds * rate;
  const d = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(Math.sin(i / 8) * 8000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + d.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(d.length, 40);
  return Buffer.concat([h, d]);
}
const WAV = wav();
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<video id="v" width="640" height="360" src="/tone.wav" loop muted playsinline
       style="display:block"></video></body>`;

export async function serveTestPage(port, html = PAGE) {
  const srv = http.createServer((q, res) => {
    if (q.url.startsWith("/tone.wav")) {
      res.writeHead(200, { "content-type": "audio/wav", "content-length": WAV.length });
      return res.end(WAV);
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((r) => srv.listen(port, "127.0.0.1", r));
  return { srv, url: `http://127.0.0.1:${port}/` };
}

// ── ⭐⭐ صفحتُنا تحت اسم مضيفٍ حقيقيّ — **بلا شبكةٍ ولا DNS** (2026-08-06) ────
//
// ⛔ **العلّة، وهي شرطُ بقاء البوّابة:** تضييقُ زرّي #72 و#108 إلى يوتيوب
// **يُميت خمسةً وعشرين شرطَ قبولٍ في رِكازين من التسعة** — كلاهما يقيس على
// `localhost`، **والبوّابةُ تفقد كلَّ ما تعرفه عن الزرّين في يومٍ واحد**،
// **و#112 مفتوحٌ فلا بديلَ ينتظر.** ⇒ **فالاعتراضُ يسبق البوّابة** (قرار المالك).
//
// **الآليّة المقيسة:** `Fetch` يوقف الطلبَ **في مرحلة الطلب — قبل الشبكة وقبل
// DNS** — ونُلبّيه بصفحتنا. ⇒ `location.hostname === "www.youtube.com"`،
// **وسكربتُ المحتوى يعمل بعلمه**، **وفيديو حيّ**. ✅ **مقيسٌ أربعتُها.**
//
// ⛔⭐ **وحدُّه يُكتب في نصّه لأنه سيُقرأ بعد سنة:** **يُزيّف ما تقرؤه البوّابةُ
// وحدَه — `location.hostname` — لا شجرةَ يوتيوب.** ⇒ **فالزرُّ يسقط إلى طبقتنا
// كما يفعل محلياً اليوم**، **و#112 يبقى مفتوحاً ولا يُقرأ مغلقاً بهذا.**
// ⭐ **وهذا ما يميّزه عن محاولات #112 الثلاث:** تلك **زيّفت المشغّل** فأنتجت
// **ثلاثَ حالاتٍ مختلفة ولا واحدةَ منها حالُ المالك** ⇒ **وهذا يزيّف الحقلَ
// الوحيد الذي يقرؤه الحكم**، **ولا يدّعي شيئاً عن بقيّة الشجرة.**
//
// ⚠️ **و`Runtime.enable` قبل التنقّل لا بعده:** أوّلُ مِجَسٍّ كتبتُه أخّرها
// **فلم تُجمَع العوالم فطبع «عالمُ الإضافة غائب»** — **و«لا أرى» تطبع ما تطبعه
// «لا يوجد»** (الشاهد الأوّل في قرار 26). **ولم يُنشر الرقم حتى أُصلح الترتيب.**
// ⚠️ **والنمطُ مقصورٌ على المضيف المُزيَّف**: `urlPattern` عليه وحده، **فموارد
// الإضافة تمرّ كما هي** ولا نعترض ما لا يخصّنا.
// ⛔⭐⭐ **و`contentType` أُضيف 2026-08-07 (#112) بقياسٍ لا براحة:** لقطةُ شجرة
// يوتيوب المحفوظة **لا تنجو من محلِّل HTML** — **فيها `<button>` داخل `<button>`
// (شارةُ «الإجراء المقترح»)، والمحلِّلُ يُغلق الخارجيَّ عندها** ⇒ **`#movie_player`
// يُغلق مبكّراً فيخرج شريطُ التحكّم من نطاقه**: **10 أبناءٍ بدل 36، والشريطُ صار
// أخاً لا ابناً** ⇒ **وحقنُنا يسقط إلى الطبقة، فيُقاس سلوكٌ غيرُ سلوك المضيف.**
// ⭐ **والعلاج مقيسٌ ولا يُصلح المصدر بيد** (فذاك لقطةٌ تكذب): **تُسلسَل بـ
// `XMLSerializer` وتُقدَّم `application/xhtml+xml`** — **ومحلِّلُ XML بلا قواعدِ
// محتوىً فينجو التداخلُ كما هو** ⇒ **36 ابناً، والشريطُ داخل المشغّل، وصفرُ
// `parsererror`.**
export async function openPageAsHost(port, { host = "www.youtube.com", path = "/watch?v=vz",
                                             html = PAGE,
                                             contentType = "text/html; charset=utf-8" } = {}) {
  const url = `https://${host}${path}`;
  const tab = await (await fetch(
    `http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const c = await connect(tab.webSocketDebuggerUrl);
  await c.send("Runtime.enable");                 // ⚠️ قبل التنقّل — انظر أعلاه
  await c.send("Page.enable");
  await c.send("Fetch.enable", { patterns: [{ urlPattern: `https://${host}/*`, requestStage: "Request" }] });
  const body = Buffer.from(html, "utf8").toString("base64");
  c.ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method !== "Fetch.requestPaused") return;
    const id = m.params.requestId;
    // **المستندُ ومورِدُ الصوت يُلبّيان، وما عداهما يُرفض** — فلا طلبَ يخرج
    // إلى الشبكة بحال. ⚠️ **و`/tone.wav` ليس تفصيلاً:** صفحةُ المُساعد تُغذّي
    // `<video>` منه، **ومنعُه يُنتج فيديو بلا بيانات** ⇒ **مستطيلٌ يُقرأ ولا
    // يُشغَّل**، **فتُقاس حالٌ لم تُنتَج** (الشاهد الثاني في قرار 26).
    // **وأُمسك بمِجَسّ القبول قبل أن يدخل رِكازاً** (`فيديو حيّ: false`).
    if (m.params.resourceType === "Document") {
      c.send("Fetch.fulfillRequest", { requestId: id, responseCode: 200,
        responseHeaders: [{ name: "content-type", value: contentType }], body });
    } else if (/\/tone\.wav/.test(m.params.request?.url || "")) {
      c.send("Fetch.fulfillRequest", { requestId: id, responseCode: 200,
        responseHeaders: [{ name: "content-type", value: "audio/wav" }],
        body: WAV.toString("base64") });
    } else {
      // ⛔ **يُلبّى فارغاً ولا يُرفض** — `failRequest` **يطبع خطأ كونسول**
      // (`ERR_BLOCKED_BY_CLIENT`) **فيُحمّر رِكازاً شرطُه «صفر خطأ كونسول»**،
      // ⇒ **أداةُ القياس تُنتج العَرَضَ الذي تقيسه** (قرار 111 · 116).
      // **وأُمسك في أوّل تشغيلةٍ للرِكاز لا بعد أسابيع.**
      c.send("Fetch.fulfillRequest", { requestId: id, responseCode: 200,
        responseHeaders: [{ name: "content-type", value: "text/plain" }], body: "" });
    }
  });
  await c.send("Page.navigate", { url });
  return { c, url };
}

// **الأثر الفعليّ**: عجلة فوق الفيديو ⇒ عناصر overlay في شجرة الصفحة **ومستوى
// صوت يتغيّر**. الحدث يُرسَل **من الصفحة** لا بـ`Input.dispatchMouseEvent`:
// سكربت المحتوى يستقبل أحداث الصفحة، والإرسال بـCDP بنوع `mouseWheel` كان أحد
// مرشّحَي عمى `bench-zero-change.mjs` — فيُتفادى المرشّح بدل أن يُبنى عليه.
//
// ⚠️ **والموضع ليس تفصيلاً: العجلة تُدار على المربّع 4 (B1) لا على المركز.**
// المركز هو المربّع **5 وليس له ربط افتراضي** (`FIRST_RUN_ZONES`: 4 و6 و7 فقط)،
// وبعد #38أ+ب لا يُبنى overlay أصلاً حيث لا ربط — **فالصفر هناك سلوكٌ صحيح لا
// عمى**. وقد أعطى المِجَسّ `0 عنصر` بعد ذلك البند وهو يقيس مركزاً بلا ربط:
// **رِكازٌ تخلّف عن تغيير مقصود في المنتج فقرأ صحّةً عطباً** (شاهد 13، قرار 26).
// أي تغيير في `FIRST_RUN_ZONES` يُراجَع هنا.
export const ZONE_B1 = { col: 1 / 6, row: 0.5 };   // المربّع 4: العمود الأيسر × الصفّ الأوسط
export const ZONE_B2 = { col: 0.5, row: 0.5 };    // المربّع 5: المركز — **بلا ربط افتراضي**، شاهد سالب
export function wheelProbe({ col = ZONE_B1.col, row = ZONE_B1.row,
                             deltaY = -120, setVolume = 0.5, mute = true } = {}) {
  return `(async () => {
  const v = document.querySelector("video");
  if (!v) return { ok: false, why: "لا فيديو" };
  // ⚠️ **مدىً قبل الحكم على الحركة (قرار 26، الشاهد الثالث):** العجلة لأعلى
  // والمستوى على 1.0 **لا مكان لها تصعد إليه**، فتطبع سكوناً يُقرأ عطباً.
  // فيُهبَط المستوى أولاً ليصير للحركة مدى. والكتم مقصود: #35 يشترط أن يفكّ
  // الرفعُ الكتمَ **ويرفع في الضغطة نفسها**، فيُقاس الاثنان معاً.
  try {
    ${mute ? "v.muted = true;" : ""}
    ${setVolume === null ? "" : `v.volume = ${setVolume};`}
    await v.play().catch(() => {});
  } catch {}
  const r = v.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return { ok: false, why: "مستطيل صفريّ — لا يُقاس" };
  const x = Math.round(r.left + r.width * ${col}), y = Math.round(r.top + r.height * ${row});
  const before = Math.round(v.volume * 10000) / 10000;
  const mutedBefore = v.muted;
  window.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }));
  v.dispatchEvent(new WheelEvent("wheel", {
    clientX: x, clientY: y, deltaY: ${deltaY}, bubbles: true, cancelable: true, composed: true }));
  await new Promise((r2) => setTimeout(r2, 700));
  const nodes = [...document.querySelectorAll('[class^="vz"], [class*=" vz"]')];
  return { ok: true, count: nodes.length, classes: nodes.slice(0, 6).map((n) => n.className),
           before, after: Math.round(v.volume * 10000) / 10000,
           mutedBefore, mutedAfter: v.muted };
})()`;
}
export const WHEEL_PROBE = wheelProbe();

// ── شاهدا القبول ────────────────────────────────────────────────────────────
async function witness(label, withExtension, port, httpPort) {
  const out = { label, withExtension };
  let h = null, page = null, server = null;
  try {
    const s = await serveTestPage(httpPort);
    server = s.srv;
    h = await launch(port, { withExtension });
    out.chrome = h.chrome;
    out.extensionId = h.extensionId;
    if (h.extensionId) {
      out.configured = await configure(port, h.extensionId,
        { globalSiteRules: { enabled: true, mappings: [] } });
    }
    page = await openPage(port, s.url);
    await sleep(2500);
    out.world = await contentWorld(page);
    out.flagMain = await evalIn(page, `typeof window.__GVZ_CONTENT_LOADED__`);
    out.wheel = await evalIn(page, WHEEL_PROBE);
    return out;
  } catch (e) {
    out.error = String(e?.message || e).slice(0, 120);
    return out;
  } finally {
    try { page?.ws?.close(); } catch {}
    killChrome(h);
    try { server?.close(); } catch {}
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("\n=== رِكاز الإضافة — شاهدا القبول (قرار 26) ===");
  const pos = await witness("مع الإضافة", true, 9651, 8851);
  const neg = await witness("بلا إضافة (شاهد سالب)", false, 9652, 8852);

  for (const w of [pos, neg]) {
    console.log(`\n── ${w.label}`);
    if (w.error) { console.log(`   ⚠️ ${w.error}`); continue; }
    console.log(`   كروم              : ${w.chrome}`);
    console.log(`   معرّف الإضافة      : ${w.extensionId || "—"}`);
    console.log(`   ضبط التخزين       : ${w.configured ? (w.configured.ok
      ? "✅ " + JSON.stringify(w.configured.readBack).slice(0, 62)
      : "❌ " + (w.configured.why || w.configured.error)) : "— (بلا إضافة)"}`);
    console.log(`   العالم المعزول    : ${w.world ? `✅ "${w.world.name}" (id=${w.world.id})` : "لا شيء"}`);
    console.log(`   العلم من الصفحة   : ${w.flagMain}  (يجب أن يبقى undefined: العلم في العالم المعزول لا في الصفحة)`);
    console.log(`   عجلة ⇒ overlay    : ${w.wheel?.ok ? `${w.wheel.count} عنصر ${w.wheel.count ? JSON.stringify(w.wheel.classes) : ""}` : w.wheel?.why}`);
    console.log(`   وأثرها في الصوت   : ${w.wheel?.ok
      ? `${w.wheel.before} ⇒ ${w.wheel.after} · مكتوم ${w.wheel.mutedBefore} ⇒ ${w.wheel.mutedAfter}` : "—"}`);
  }

  // الموجب يشترط الاثنين معاً: عنصر overlay **وتغيّر مستوى** — عنصرٌ بلا أثر
  // يثبت أن السكربت يعمل ولا يثبت أن الأمر نُفِّذ.
  const moved = pos.wheel?.ok && pos.wheel.after !== pos.wheel.before;
  const posOk = !!pos.world && pos.wheel?.count > 0 && moved;
  const negOk = !neg.world && !(neg.wheel?.count > 0) &&
                !(neg.wheel?.ok && neg.wheel.after !== neg.wheel.before);
  console.log(`\n── الحكم`);
  console.log(`   الشاهد الموجب : ${posOk ? "✅ الأداة ترى الإضافة **عاملةً** على صفحة" : "❌ **ساقط** — لا يُصدَّق خرج هذا الرِكاز ولا يُبنى عليه بند"}`);
  console.log(`   الشاهد السالب : ${negOk ? "✅ وتُميّز صفحةً بلا إضافة" : "❌ **ساقط** — الأداة تطبع نتيجة لا تميّز شيئاً"}`);
  console.log(`   ⇒ ${posOk && negOk ? "**الرِكاز صالح**" : "**الرِكاز غير صالح — لا تبنِ عليه**"}\n`);
  process.exit(posOk && negOk ? 0 : 1);
}
