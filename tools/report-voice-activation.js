// مِجَسّ 168أ-3 — **أيُقبل النطقُ بلا نقرة؟ وهل تصل نقرةُ نافذة الإضافة إلى الصفحة تفاعلاً؟** يُلصق في كونسول عالم الإضافة على الصفحة (الجزء أ) أو كونسول نافذة الإضافة (الجزء ب).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إذا ضغطتُ «دبلِج» في نافذة الإضافة — أيتكلّم
// الصوتُ في صفحة يوتيوب، أم يُرفض لأنّي لم أنقر الصفحةَ نفسَها؟»*
//
// ── لماذا (خ4 · `AUDIT.md` القسم السابع عشر §٦ صفّ 3) ──────────────────────────────
// كروم يرفض `speak()` بلا تفاعلٍ **بحدث `not-allowed` متزامنٍ داخلها لا برمية**، ويكفيه تفاعلٌ
// لاصقٌ سابق أو تفاعلُ وسائطَ عالٍ (MEI) للموقع (📖 §٩). ⇒ **وزرُّ «دبلِج» في النافذة (خ4) لا يُبنى
// قبل أن يُعرف: أتصل نقرتُه الصفحةَ؟** (📖 2026-10-31، messaging_util.cc وnative_renderer_messaging_service.cc:
// رسالةٌ مُرسِلُها في تفاعلٍ عابرٍ غيرِ مقيَّد تُنبّه إطارَ المستقبِل `kExtensionMessagingSenderPrivileged` — **قراءةٌ لا قياس.**)
// ⭐ **وعلى يوتيوب يُنتج MEI النطقَ وحدَه** ⇒ **يُقاس السبب: `isActive` لحظةَ الاستلام** (قرار 48).
//
// ── ⛔⭐ الكونسولُ نفسُه نقرة — ما لم يُطفأ ───────────────────────────────────────────
// «Treat code evaluation as user action» في أدوات المطوّر **مُفعَّلٌ افتراضاً** (📖 2026-10-31،
// devtools-frontend: `console-user-activation-eval` = true ⇒ `NotifyUserActivation(kDevTools)`)
// ⇒ **اللصقُ يمنح الصفحةَ تفاعلاً عابراً ولاصقاً.** ⇒ يُطفأ — **ولا يُفترض أنه أُطفئ:**
// `navigator.userActivation` يُقرأ لحظةَ اللصق وقبل النطق، و`hasBeenActive=true` **يُبطل «بلا نقرة»
// باسمه وقيمته** (قرار 140). ⚠️ **ويصيب كلَّ مِجَسٍّ يسأل «بلا إيماءة».**
//
// ── الشاهدان (قرار 26 · قرار 150) — ولا حكمَ بلا الاثنين ───────────────────────────────
// **أ — موجب:** نقرةٌ في الصفحة ⇒ `isActive=true` و`start`. **سالب:** example.com في تبويبٍ جديد
// بلا تفاعل ⇒ `not-allowed` — **وبلاه لا يُفسَّر بدءٌ بلا نقرةٍ على يوتيوب ⇒ فسطرُه ⚪ لا ✅** حتى يُقرأ مع سطر example.com.
// **ب — سالب:** `isActive=false` قبل الرسالة (يُقرأ كلَّ 200ms) · **موجب:** `isActive=true` في النافذة
// عند الضغط، **وقارئُ الصفحة رأى `true` مرّة** — وإلا فـ«لم تصل» **⚪ معلَّقٌ لا ❌** يُتمّه سطرُ التبويب.
// ⛔ **ونقرةٌ سابقةٌ في الصفحة (`hasBeenActive=true` قبل الرسالة) تُبطل شقَّ اللاصق والنطق من اختبار النقل** —
// والنطقُ يكفيه اللاصق ⇒ **يبقى العابرُ وحدَه، ويُكتب ذلك في السطر نفسِه** لا في الخطوات وحدَها.
//
// ── ⚠️ حدودٌ مُعلَنة ───────────────────────────────────────────────────────────────────
// · **MEI لا تقرؤه صفحة** ⇐ chrome://media-engagement باليد · **تبويبٌ مكتوم ⇐ `end` بلا `start`** (§٣).
// · **تفاعلُ الرسائل يُوسَم «مقيَّداً»** (📖 user_activation_state.cc) **و`isActive` لا يكشفه** ⇒ «وصل»
//   لا يعني أنّ كلَّ واجهةٍ تقبله — `Translator.create()` يُقاس في مجسّ 1.
// · **تنقّلٌ من الأصل نفسِه يرث تفاعلاً سابقاً** (📖 autoplay_policy.cc: `HadStickyUserActivationBeforeNavigation`)
//   **لا يظهر في `hasBeenActive`** ⇒ تبويبٌ جديد لا إعادةُ تحميل — **ويُقرأ `nav`: قَبولٌ بعد reload/back_forward أو
//   تنقّلٍ من الأصل نفسِه (referrer + history) ⛔ لا يُنسب إلى MEI.** والصوتُ عربيٌّ محلّيّ، وإلا فمحلّيٌّ أيّاً كان (لا شبكيّ).
// · **الأعمار اختياراتٌ لا قياس (قرار 96):** النطقُ 3 ث · النقرةُ 120 ث وتتجدّد عند رسالة النافذة ·
//   الرسائلُ والقراءةُ الدوريّة 10 دقائق · الزرُّ ضغطةٌ أو 120 ث. **وإعادةُ اللصق تُزيل ما قبلها.** لا تخزين ولا شبكة.
//
// ── كيف يُستعمل ────────────────────────────────────────────────────────────────────────
// **مرّةً أوّلاً:** F12 ⇒ الكونسول ⇒ ⚙ ⇒ أزل علامة «Treat code evaluation as user action».
// **الجزء أ — صفحةُ مشاهدةٍ في يوتيوب، ثمّ https://example.com (السالب):**
//   1) افتح الرابط **في تبويبٍ جديد** (اكتبه في شريط العنوان) **ولا تنقر داخل الصفحة.**
//   2) F12 ⇒ الكونسول ⇒ قائمةُ السياق أعلاه (تقول «top») ⇒ **VIDEO ZONES**.
//   3) الصق الملفَّ كلَّه واضغط Enter ⇒ 🟢 نتيجةُ «بلا نقرة»، ثمّ 🟡 يطلب نقرة.
//   4) انقر مرّةً داخل الصفحة **في فراغٍ لا على الفيديو** ⇒ سطرٌ واحدٌ يُنسخ.
// **الجزء ب — يوتيوب:**
//   5) كرّر 1–3 **في تبويبٍ جديد ولا تنقر الصفحة بعدها** — وإلا قام اللاصقُ قبل الضغط فبطل شقُّه (يقوله السطر).
//   6) افتح نافذةَ الإضافة من أيقونتها ⇒ قائمةُ السياق داخلها (نقرٌ ثانويّ) ⇒ **Inspect** فتبقى مفتوحة
//      ⇒ الصق الملفَّ نفسَه في كونسولها ⇒ يطبع التبويبَ الهدف: تحقّق أنّه يوتيوب.
//   7) اضغط الزرَّ الأحمر «VZ-168أ-3: اضغطني» أعلى النافذة ⇒ سطرُ VZ-168أ-3ب يُنسخ.
//   8) ثمّ انقر صفحةَ يوتيوب مرّةً ⇒ سطرُ VZ-168أ-3 في كونسول التبويب يحمل الاثنين.
(async () => {
  // ⛔ **أوّلُ سطر: حالُ التفاعل لحظةَ اللصق** — قبل أيّ انتظار (العابرُ يعيش 5 ث، 📖).
  const UAo = navigator.userActivation;
  const u0 = UAo ? { a: UAo.isActive, s: UAo.hasBeenActive } : null;
  // ⚠️ `copy` من أدوات الكونسول ويُزال بانتهاء التقييم ⇒ يُلتقط مرجعُه الآن ليعمل في النداءات اللاحقة.
  const COPY = typeof copy === "function" ? copy : null;
  const TAG = "VZ-168أ-3", TB = TAG + "ب", MSG = "VZ_PROBE_168_ACTIVATION";
  const T_SPEAK = 3000, T_CLICK = 120000, T_LIFE = 600000, T_BTN = 120000, T_REPLY = 8000;
  const ua = () => ({ a: UAo.isActive, s: UAo.hasBeenActive });
  const kind = (r) => String(r || "").split(" ")[0];
  const emit = (line) => { console.log(line); try { COPY(line); console.log("   (نُسخ إلى الحافظة)"); } catch (e) {} };
  const ctx = location.protocol === "chrome-extension:" ? "صفحة-الإضافة"
    : typeof globalThis.extensionActive === "function" ? "عالم-الإضافة" : "عالم-الصفحة";
  // كلُّ انتظارٍ بمهلة (null عند انقضائها) ومؤقّتُه يُزال
  const lim = (p, n) => { let t = 0; return Promise.race([p, new Promise((r) => { t = setTimeout(r, n, null); })]).finally(() => clearTimeout(t)); };
  const E = await (async () => {
    try {
      const h = await lim(navigator.userAgentData.getHighEntropyValues(      // المهلةُ ⇒ null ⇒ رميةٌ ⇒ سلسلةُ الوكيل
        ["platform", "platformVersion", "architecture", "bitness", "fullVersionList"]), 3000);
      const L = h.fullVersionList || [], pv = String(h.platformVersion || "?"), mj = parseInt(pv, 10);
      const b = L.find((x) => x.brand === "Google Chrome") || L.find((x) => !/Not.?A.?Brand/i.test(x.brand)) || {};
      const arch = h.architecture === "x86" ? (h.bitness === "64" ? "x64" : "x86") : (h.architecture || "?") + (h.bitness || "");
      return "بيئة: " + h.platform + " " + (h.platform === "Windows" ? (mj >= 13 ? "11" : "10") + " (" + pv + ")"
        : pv.replace(/\.0$/, "")) + " " + arch + " · " + String(b.brand || "?").replace(/^Google /, "") + " " + (b.version || "?");
    } catch (e) { return "بيئة: " + navigator.userAgent; }
  })();

  if (ctx === "عالم-الصفحة") return emit(TAG + " ⛔ · السياق = عالم-الصفحة على " + location.host + " — المطلوب: " +
    "عالم-الإضافة (قائمةُ سياق الكونسول ⇒ VIDEO ZONES) للجزء أ، أو صفحة-الإضافة /popup.html للجزء ب · " + E);

  // ════ الجزء ب — كونسول نافذة الإضافة ══════════════════════════════════════════════
  if (ctx === "صفحة-الإضافة") {
    if (location.pathname !== "/popup.html" || !chrome.tabs || !UAo) return emit(TB + " ⛔ · السياق = صفحة-الإضافة " +
      location.pathname + (chrome.tabs ? "" : " · chrome.tabs = غائب") + (UAo ? "" : " · navigator.userActivation = غائب") +
      " — المطلوب: /popup.html (نافذةُ الإضافة ⇐ Inspect) · " + E);
    // ⛔ **يُحلّ الهدفُ قبل الضغط** — فلا `await` بين النقرة والإرسال.
    const web = (t) => /^https?:/.test((t && t.url) || "");
    let src = "lastFocusedWindow";
    let tab = ((await lim(chrome.tabs.query({ active: true, lastFocusedWindow: true }), 3000)) || []).find(web);
    // ⚠️ نافذةُ أدوات المطوّر قد تكون «آخرَ ما رُكّز» ⇒ الاحتياطُ نافذةُ البوب-أب نفسُها.
    if (!tab) { src = "currentWindow"; tab = ((await lim(chrome.tabs.query({ active: true, currentWindow: true }), 3000)) || []).find(web); }
    if (!tab) { emit(TB + " ⛔ · لا تبويبَ نشطاً بعنوان http(s) في lastFocusedWindow ولا currentWindow · " + E); return; }
    const host = new URL(tab.url).host;
    const old = document.getElementById("vz168a3"); if (old) old.remove();
    const btn = document.createElement("button");
    btn.id = "vz168a3"; btn.textContent = "VZ-168أ-3: اضغطني";
    btn.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:16px;" +
      "font:700 18px system-ui;background:#b00020;color:#fff;border:0;cursor:pointer";
    let sender = "؟";                         // شاهدُ المُرسِل: تفاعلُ النافذة نفسِها عند الضغط
    btn.addEventListener("pointerdown", () => { sender = UAo.isActive; }, true);
    const kill = setTimeout(() => {           // لا سطرَ إن أزاله لصقٌ أحدث
      if (btn.isConnected) { btn.remove(); emit(TB + " ⛔ · لم يُضغط الزرّ خلال " + T_BTN / 1000 + " ث — أعد اللصق · " + E); }
    }, T_BTN);
    btn.addEventListener("click", (e) => {
      let sent;
      try { sent = chrome.tabs.sendMessage(tab.id, { type: MSG }, { frameId: 0 }); } // ⛔ أوّلُ عمل — لا await قبله
      catch (er) { sent = Promise.reject(er); }
      const sentAt = Date.now();
      clearTimeout(kill); btn.remove();
      let lt = 0;
      const late = new Promise((res) => { lt = setTimeout(() => res({ err: "لا ردَّ خلال " + T_REPLY / 1000 + " ث" }), T_REPLY); });
      Promise.race([sent.then((r) => ({ r }), (er) => ({ err: String((er && er.message) || er) })), late]).then((o) => {
        clearTimeout(lt);
        const r = o.r || {};
        const tail = " · المُرسِل: isActive عند الضغط=" + sender + " · isTrusted=" + e.isTrusted + " · التسليم≈" +
          (r.recvAt ? r.recvAt - sentAt : "?") + "ms · الهدف=" + host + " (" + src + ") · " + E;
        const out = (g, t) => emit(TB + " " + g + " · " + t + tail);
        if (r.probe !== TAG) return out("⛔", "لم يُجب أحد — الصق المجسّ في كونسول عالم الإضافة على الصفحة أوّلاً " +
          "(الجزء أ) · الخام=" + (o.err || JSON.stringify(o.r)));
        const bad = [];
        if (r.preActive) bad.push("isActive=true قبل الرسالة بـ" + r.preAgoMs + "ms ⇒ تفاعلٌ عابرٌ من غير النافذة " +
          "(نقرةٌ أو لصقٌ قبل أقلَّ من 5 ث) — انتظر 5 ث بلا لمس الصفحة وأعد");
        if (sender === false) bad.push("isActive في النافذة = false عند الضغط ⇒ لا تفاعلَ يُنقل");
        if (!e.isTrusted) bad.push("isTrusted = false ⇒ ضغطةٌ مصطنعة");
        // ⛔ **نقرةٌ سابقةٌ في الصفحة تُبطل شقَّ اللاصق والنطق من الاختبار** (والنطقُ يكفيه اللاصق) — **ويُقال في كلّ فرع**
        const facts = "isActive عند الاستلام=" + r.isActive + " (قبلها بـ" + r.preAgoMs + "ms: " + r.preActive +
          ") · hasBeenActive=" + r.hasBeenActive + " (قبلها: " + r.preSticky + ") · النطقُ في الصفحة: " + r.speak +
          (r.preSticky ? " (غيرُ مميِّز: لاصقٌ قبل الرسالة)"
            : kind(r.before) !== "error:not-allowed" ? " (غيرُ مميِّز: قبلته البوّابةُ قبلها — " + r.before + ")"
            : kind(r.speak) === "start" ? " (مميِّز: رُفض قبلها بلا نقرة)" : " (رُفض قبلها أيضاً)") +
          (r.preSticky ? " · ⚠️ hasBeenActive=true قبل الرسالة ⇒ نقرةٌ سابقةٌ في الصفحة أبطلت شقَّ اللاصق والنطق من " +
            "اختبار النقل، ويبقى العابرُ وحدَه — للشقّين: تبويبٌ جديدٌ لا يُنقر قبل الزرّ" : "");
        if (bad.length) out("⛔", "القياسُ باطل — " + bad.join(" · ") + " · " + facts);
        else if (r.isActive) out("✅", "نقرةُ النافذة وصلت الصفحةَ تفاعلاً عابراً (false ⇒ true)" +
          (!r.preSticky && r.hasBeenActive ? " ولاصقاً (false ⇒ true)" : "") + " · " + facts);
        else if (r.reader) out("❌", "لم تصل نقرةُ النافذة تفاعلاً — وقارئُ الصفحة رأى true قبلها (شاهدُه قائم) · " + facts);
        else out("⚪", "isActive=false عند الاستلام ولا حكمَ بعد: قارئُ الصفحة لم يرَ true قطّ ⇐ انقر صفحةَ يوتيوب " +
          "مرّةً الآن، والحكمُ في سطر " + TAG + " بكونسول التبويب · " + facts);
      });
    }, { once: true });
    document.body.prepend(btn);
    console.log("🟢 " + TB + ": الهدف «" + String(tab.title || "").slice(0, 40) + "» · " + host + " (tabId=" + tab.id +
      " · من " + src + ") — تحقّق أنّه تبويبُ يوتيوب، ثمّ اضغط الزرَّ الأحمر أعلى النافذة (حتى " + T_BTN / 1000 + " ث).");
    return;
  }

  // ════ الجزء أ — عالم الإضافة على صفحة الموقع ═══════════════════════════════════════
  const why = [];
  if (!/^https?:$/.test(location.protocol)) why.push("location.protocol = " + location.protocol + " (المطلوب http أو https)");
  if (window.top !== window) why.push("الإطار = داخليّ " + location.href.slice(0, 60) + " (المطلوب «top» ⇐ VIDEO ZONES)");
  if (!chrome.runtime || !chrome.runtime.id) why.push("chrome.runtime.id = غائب ⇒ سكربتٌ يتيم (#162) — أعد تحميل الصفحة");
  if (typeof speechSynthesis === "undefined") why.push("speechSynthesis = غائب");
  if (!u0) why.push("navigator.userActivation = غائب");
  if (why.length) { emit(TAG + " ⛔ · السياق = عالم-الإضافة على " + location.host + " · " + why.join(" · ") + " · " + E); return; }
  if (typeof globalThis.__VZ_168A3__ === "function") globalThis.__VZ_168A3__();   // إعادةُ اللصق تُزيل ما قبلها

  let dead = false, onMsg = null, onPtr = null, life = 0, clickTimer = 0, doneA = false, B = null;
  let pre = { a: u0.a, s: u0.s, t: performance.now() }, seen = u0.a;   // seen: أرأى القارئُ true قطّ؟
  const poll = setInterval(() => { const x = ua(); pre = { a: x.a, s: x.s, t: performance.now() }; seen = seen || x.a; }, 200);
  const unPtr = () => { window.removeEventListener("pointerdown", onPtr, true); window.removeEventListener("pointerup", onPtr, true); };
  const cleanup = () => {
    dead = true; try { if (onMsg) chrome.runtime.onMessage.removeListener(onMsg); } catch (e) {}
    clearInterval(poll); clearTimeout(life); clearTimeout(clickTimer); if (onPtr) unPtr();
    if (globalThis.__VZ_168A3__ === cleanup) delete globalThis.__VZ_168A3__; };
  globalThis.__VZ_168A3__ = cleanup;

  // ⛔ القائمةُ تصل دفعتين (مِجَسّ 2: أصواتُ كروم الشبكيّة أوّلاً ثمّ أصواتُ النظام) ⇒ تُنتظر أوّلُ قائمةٍ فيها صوتٌ
  // محلّيّ (السقف 3 ث) · والصوتُ بوسم اللغة الأوّل تماماً (درس #161)، وإلا فمحلّيٌّ أيّاً كان — **لا شبكيٌّ يُرسل النصّ**
  let voices = speechSynthesis.getVoices();
  for (let i = 0; i < 12 && !voices.some((v) => v.localService); i++) { await new Promise((r) => setTimeout(r, 250)); voices = speechSynthesis.getVoices(); }
  const isAr = (v) => (v.lang || "").toLowerCase().split(/[-_]/)[0] === "ar";
  const VOICE = voices.find((v) => isAr(v) && v.localService) || voices.find((v) => v.localService) || null;
  const vdesc = VOICE ? VOICE.name + " " + VOICE.lang + (isAr(VOICE) ? "" : " ⚠️ لا صوتَ عربيّاً محلّيّاً")
    : "الافتراضيّ ⚠️ (لا صوتَ محلّيّاً بين " + voices.length + ")";
  const live = [];                             // ⚠️ يُمسك كلُّ نطقٍ حتى ينتهي — وإلا جمعه كروم وأسقط end
  const say = () => new Promise((res) => {
    const u = new SpeechSynthesisUtterance("اختبار");
    u.lang = VOICE ? VOICE.lang : "ar"; if (VOICE) u.voice = VOICE; u.volume = 0.8;
    const busy = speechSynthesis.speaking || speechSynthesis.pending, t0 = performance.now();
    let to = 0, out = "", inSpeak = false;
    const fin = (k) => { if (out) return;
      out = k + " " + Math.round(performance.now() - t0) + "ms" + (busy ? " (طابورُ الصفحة مشغولٌ قبلها)" : ""); clearTimeout(to); res(out); };
    const drop = () => { const i = live.indexOf(u); if (i >= 0) live.splice(i, 1); };
    // ⛔ المعالجاتُ قبل speak(): `not-allowed` يقع متزامناً داخلها
    u.onstart = () => fin("start");
    u.onerror = (e) => { drop(); fin("error:" + (e.error || "?") + (inSpeak ? " متزامن" : "")); };
    u.onend = () => { drop(); fin("end-بلا-start"); };
    live.push(u);
    to = setTimeout(() => fin("لا-شيء-خلال-" + T_SPEAK / 1000 + "ث"), T_SPEAK);
    try { inSpeak = true; speechSynthesis.speak(u); } catch (e) { drop(); fin("رمية:" + e.name); }
    inSpeak = false;
  });
  // البوّابةُ تحكم متزامنةً داخل speak() ⇒ كلُّ ما ليس not-allowed (ولا رمية) قَبول
  const gate = (r) => (kind(r) === "error:not-allowed" ? "رفضته البوّابة" : kind(r).indexOf("رمية") === 0 ? "رمية" : "قبلته البوّابة");

  if (dead) return;
  const u1 = ua();                             // ثانيةً قبل النطق: نقرةٌ بين اللصق والنطق تُبطله
  const noClick = await say();
  if (dead) return;
  console.log("🟢 " + TAG + " قبل أيّ نقرة: " + gate(noClick) + " — " + noClick + " · لحظةَ اللصق isActive=" + u0.a +
    " hasBeenActive=" + u0.s + " · صوت=" + vdesc);

  const finishA = (at, r, pt) => {
    const bad = [], g = gate(noClick), neg = /(^|\.)example\.com$/.test(location.hostname);
    const pos = !!(at && at.a && kind(r) === "start");
    if (!at) bad.push("لم تُنقر الصفحة خلال " + T_CLICK / 1000 + " ث ⇒ لا شاهدَ موجب");
    else {
      if (!at.a) bad.push("isActive=false عند نقرةٍ حقيقيّة (" + pt + ") ⇒ القارئُ لا يرى التفاعل");
      if (kind(r) !== "start") bad.push("بعد النقرة لم يبدأ النطق: " + r + (kind(r) === "end-بلا-start"
        ? " (التبويبُ مكتوم؟)" : kind(r).indexOf("لا-شيء") === 0 ? " (بطءُ المحرّك أو طابورٌ عالق)" : ""));
    }
    // ⛔ تنقّلٌ من الأصل نفسِه يرث تفاعلاً لا يظهر في hasBeenActive (📖 autoplay_policy.cc) ⇒ قَبولٌ بعده لا يُنسب (قرار 48)
    const nav = ((performance.getEntriesByType("navigation") || [])[0] || {}).type || "?";
    let refO = ""; try { refO = new URL(document.referrer).origin; } catch (e) { refO = ""; }
    const inh = nav === "reload" || nav === "back_forward" || (refO === location.origin && history.length > 1);
    if (u1.s) bad.push("«بلا نقرة» لا يُقاس: hasBeenActive=true قبل النطق (لحظةَ اللصق isActive=" + u0.a +
      " hasBeenActive=" + u0.s + ")" + (u0.a
        ? " ⇒ الكونسولُ منح التفاعل: أطفئ «Treat code evaluation as user action» (أو نقرةٌ قبل اللصق بأقلَّ من 5 ث)"
        : " ⇒ نُقرت الصفحةُ قبل القياس — تبويبٌ جديدٌ بلا نقر"));
    else if (g === "رمية") bad.push("«بلا نقرة» رمى: " + noClick);
    else if (g === "قبلته البوّابة" && inh) bad.push("«بلا نقرة» قُبل والتنقّلُ قد يرث تفاعلاً: nav=" + nav + " · referrer=" +
      (refO || "—") + " · history.length=" + history.length + " ⇒ تبويبٌ جديدٌ بعنوانٍ مكتوب");
    else if (neg && g !== "رفضته البوّابة") bad.push("شاهد− سقط: example.com قبل النطقَ بلا تفاعل ⇒ لا يُفسَّر بدءُ يوتيوب بلا نقرة");
    // ⛔ قَبولٌ بلا نقرةٍ خارج example.com شاهدُه السالبُ في تشغيلةٍ أخرى ⇒ ⚪ لا ✅ (قرار 26): بلاه تحتمل بوّابةً لا ترفض أصلاً
    const pend = !bad.length && !neg && g === "قبلته البوّابة";
    const ans = "بلا نقرة: " + g + " (" + noClick + ")" + (u1.s || g === "رمية" ? ""
      : g === "رفضته البوّابة" ? " · شاهد− ✅ هنا"
      : " — " + (kind(noClick) === "start" ? "بدأ" : "قُبل") + " بلا تفاعلٍ مسجَّل ⇒ الأرجح تفاعلُ الوسائط (MEI) للموقع — " +
        "يُقرأ من chrome://media-engagement" + (neg ? "" : " · ⚪ لا حكمَ حتى سطرُ example.com (شاهد−) على الجهاز نفسِه"));
    const bv = !B ? "" : " · نافذةُ الإضافة: " + (B.pa ? "⛔ باطل (isActive=true قبل الرسالة)" : B.a ? "✅ وصلت"
      : at && at.a ? "❌ لم تصل (وشاهدُ القارئ هذه النقرة)" : B.reader ? "❌ لم تصل" : "⚪ بلا شاهد القارئ") +
      " — isActive " + B.pa + "⇒" + B.a + " · hasBeenActive " + B.ps + "⇒" + B.s + " · النطق: " + B.r +
      (B.ps ? " ⚠️ لاصقٌ قبل الرسالة ⇒ شقُّ اللاصق والنطق باطل ويبقى العابر" : "");
    emit(TAG + " " + (bad.length ? "⛔" : pend ? "⚪" : "✅") + " · " + location.host + " · " + (bad.length ? bad.join(" · ") + " · " : "") +
      ans + " · بعد النقرة: " + (at ? "isActive=" + at.a + " · " + r + " · شاهد+ " + (pos ? "✅" : "❌") : "—") + bv + " · nav=" + nav +
      " · MEI ⇐ chrome://media-engagement سطرُ " + location.origin + " · لحظةَ اللصق isActive=" + u0.a +
      " hasBeenActive=" + u0.s + " · صوت=" + vdesc + " · " + E);
  };
  const timeoutA = () => { if (doneA) return; doneA = true; unPtr(); finishA(null, "", ""); };

  // ── (ج) مستمعُ رسالة النافذة: اللقطةُ أوّلاً ومتزامنة، ثمّ النطق، ثمّ الردّ ──────────
  onMsg = (m, _s, reply) => {
    if (!m || m.type !== MSG) return undefined;        // ليس لنا — ولا يُمسك القناة
    const at = ua(), before = pre, reader = seen, recvAt = Date.now();
    const ago = Math.round(performance.now() - before.t);
    say().then((r) => {
      B = { a: at.a, s: at.s, pa: before.a, ps: before.s, reader, r };
      console.log("🟡 " + TB + " (التبويب): isActive عند الاستلام=" + at.a + " (قبلها بـ" + ago + "ms: " + before.a +
        ") · hasBeenActive=" + at.s + " (قبلها: " + before.s + ") · النطق: " + r +
        (doneA ? "" : " ⇐ انقر الصفحةَ الآن مرّةً (لا على الفيديو) لشاهد القارئ — حتى " + T_CLICK / 1000 + " ث"));
      if (!doneA) { clearTimeout(clickTimer); clickTimer = setTimeout(timeoutA, T_CLICK); }
      try { reply({ probe: TAG, isActive: at.a, hasBeenActive: at.s, preActive: before.a, preSticky: before.s,
                    preAgoMs: ago, reader, speak: r, before: noClick, recvAt }); } catch (e) {}
    });
    return true;                                        // ردٌّ لاحق
  };
  chrome.runtime.onMessage.addListener(onMsg);
  life = setTimeout(() => { cleanup(); console.log("🟡 " + TAG + ": انقضت 10 دقائق — أُزيل مستمعُ الرسائل والقراءةُ الدوريّة."); }, T_LIFE);

  // ── (د) النقرة: التفاعلُ يقع عند ضغط الفأرة وعند رفع اللمس (مواصفة HTML) ⇒ يُقرأ حيث يقع ──
  onPtr = (e) => {
    if (!e.isTrusted || doneA || (e.type === "pointerdown") !== (e.pointerType === "mouse")) return;
    doneA = true; clearTimeout(clickTimer); unPtr();
    const at = ua();
    say().then((r) => finishA(at, r, e.pointerType));
  };
  window.addEventListener("pointerdown", onPtr, true);
  window.addEventListener("pointerup", onPtr, true);
  clickTimer = setTimeout(timeoutA, T_CLICK);
  console.log("🟡 " + TAG + ": انقر مرّةً داخل الصفحة (لا على الفيديو إن أمكن) — حتى " + T_CLICK / 1000 + " ث. " +
    "وللجزء ب: لا تنقر، وافتح نافذةَ الإضافة الآن.");
})().catch((e) => console.log("VZ-168أ-3 ⛔ · المِجَسُّ نفسُه رمى: " + ((e && e.stack) || e) + " — عطبُ أداةٍ لا جواب، أبلِغ بهذا السطر"));
