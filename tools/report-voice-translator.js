// مِجَسّ 168أ-1 — **هل مترجمُ كروم المدمج متاحٌ هنا، وكم يستغرق، وماذا يطلب؟** يُلصق في كونسول صفحة الإعدادات ثمّ صفحة المشاهدة بعالمَيها.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«أتستطيع الإضافةُ أن تترجم كلامَ الفيديو إلى
// العربية على جهازي بلا خادم — من داخل صفحة يوتيوب لا من صفحتها وحدها؟ وكم تنتظر الجملة،
// وماذا يُطلب منّي في أوّل مرّة؟»*
//
// ── لماذا قبل أيّ سطرٍ في المنتَج (AUDIT القسم السابع عشر §٦ · K1 في §٧) ───────────
// الحلقةُ الرابعة في السلسلة المجانية مترجمُ كروم على الجهاز، **وغيابُه عن سكربت المحتوى
// على أحد النظامين هو شرطُ الإيقاف K1** ⇒ فيُسأل في ثلاثة سياقاتٍ **وبهذا الترتيب**:
//   ① **صفحةُ الإعدادات** — الشاهدُ الموجب: أيكشفه كروم هذا أصلاً؟ ومنها يُنزَّل النموذج.
//   ② **عالمُ الإضافة** على صفحة مشاهدة — **السؤالُ نفسُه**: أيراه سكربتُ المحتوى؟
//   ③ **عالمُ الصفحة** على التبويب نفسِه — للمقارنة: ما يراه يوتيوب ولا نراه نحن.
// ⇒ **«غيرُ معرَّف» في ② لا يُصدَّق إلا و① «معرَّف»** (قرار 150)، **ولكلّ سياقٍ شاهدُ بصرٍ
// يُطبع:** `extensionActive` في ② و`ytcfg` في ③ — فالغيابُ غيابٌ لا عمى. ⛔ **وما عدا الثلاثة
// يُرفض بشرطه وقيمته (قرار 140):** عاملُ خدمة · صفحةُ إضافةٍ أخرى أو عالمُها · إطارٌ داخليّ · مضيفٌ غيرُ
// www.youtube.com · مسارٌ غيرُ `/watch` · عالمُ صفحةٍ بلا `ytcfg`.
//
// ── الشواهد (قرار 26) ───────────────────────────────────────────────────────────
//  · **سالبُ الأداة:** `availability` لزوجٍ غيرِ مدعوم (en→xx) **يجب أن يكون `unavailable` أو
//    رفضاً** — وإلا ⛔ ولا حكم: أداةٌ تقول «متاح» عن كلّ شيءٍ لا تفرّق. **وضابطُه الموجب en→es** يُطبع
//    معه: «unavailable» للعربيّة والضابطُ متاحٌ ⇒ العربيّةُ وحدَها، وإلا فالمترجمُ كلُّه (قرار 150).
//  · **موجبُ الأثر (قرار 109: «أوقع الأثر؟» لا «أموجود؟»):** ✅ **حين تُخرج 18 من 20 جملةً
//    حروفاً عربيّة** — والكاشفُ نفسُه يُسأل عن «مرحباً» و«Hello» قبل أن يُصدَّق.
//  · **سالبُ التفعيل:** والحالُ «قابلٌ للتنزيل» ⇒ `create()` بلا إيماءةٍ **يجب أن يُرفض
//    `NotAllowedError`.** ⚠️ **ولصقُ الكونسول نفسُه تفعيلٌ عابر** («Treat code evaluation as
//    user action» في DevTools مفعّلٌ افتراضاً؛ قِيس 2026-10-31 بـ`userGesture` في CDP على كروم
//    156: `isActive=true` لحظةَ اللصق وزال بعد نحو 5 ث) ⇒ **يُنتظر انقضاؤه قبل الشاهد** وإلا
//    قاس لصقَنا — **و`isActive` لحظةَ النداء يُطبع معه، وإن بقي `true` فالشاهدُ ⛔ باطلٌ لا ❌**؛
//    **وإن كان الحالُ `available` سلفاً طُبع ⚪ «لا يُقاس» ولا يُسقَط.** و`تفعيل@لصق` في السطر أثرُ اللصق.
//
// ── حدودٌ مُعلَنة ───────────────────────────────────────────────────────────────
//  · **قرار 96:** المهلُ (`LIM`، ومنها تُشتقّ أرقامُ الرسائل) وعتبةُ 18/20 وحدُّ 1.5 ث اختيارات.
//  · **قرار 48: «downloadable» قد يكون تمويهاً من كروم** إن غابت اللغتان عن لغاته ⇒ يُطبع وجودُ
//    `ar` مجرّدةً، وتنزيلٌ أقصرُ من 1.5 ث يُوسَم ولا يُقرأ زمنَ تنزيل — **والحكمُ على ما نُسبّبه.**
//  · الجملُ العشرون مكتوبةٌ هنا لا من فيديو ⇒ الزمنُ زمنُ جملةٍ قصيرةٍ متتابعة لا نصِّ دقيقة.
//  · العتادُ كما يُبلغه كروم (UA-CH)؛ وما يُبلغه كروم x64 مُحاكىً على ويندوز ARM لم يُقس.
//  · يُنزّل نحو 80MB مرّةً واحدة **بنقرتك**؛ ولا يكتب في التخزين ولا يطلب من الشبكة بنفسه،
//    ويُزيل مستمعيه ومؤقّتاته ويُتلف المترجمَ في آخره.
//
// ── كيف يُستعمل ─────────────────────────────────────────────────────────────────
//   1) افتح **صفحةَ إعدادات الإضافة**، ثمّ الكونسول (F12)، والصق هذا الملفّ كلَّه واضغط Enter.
//   2) إن طبع 🟡 «انقر داخل الصفحة…» فانقر في موضعٍ فارغٍ منها **لا في الكونسول**، وانتظر سطرَ
//      الحكم (يُنسخ وحده) — **أرسله.**
//   3) افتح فيديو على https://www.youtube.com/watch، و**بدّل سياقَ الكونسول إلى «VIDEO ZONES»**
//      من قائمة السياق أعلى الكونسول، والصق ثانيةً — **أرسل السطر.**
//   4) أعِد السياقَ إلى `top` والصق ثالثةً — **أرسل السطر.** وإن طُلبت نقرةٌ على يوتيوب فانقر
//      **خارج المشغّل** (فوق العنوان مثلاً)، لا على الفيديو.
(async () => {
  const TAG = "VZ-168أ-1";
  const LIM = { ask: 15000, ready: 60000, lapse: 12000, gesture: 180000, dl: 600000, line: 30000 };
  // ── أدوات — ⛔ ولا علامةَ اقتباسٍ خلفيّة في أيّ نصٍّ هنا: كلُّ نصٍّ يُبنى بـ«+» ──
  const COPY = typeof copy === "function" ? copy : null;   // يُمسَك قبل أوّل await
  const ua = navigator.userActivation || null;
  const actAtPaste = ua ? "{hasBeenActive:" + ua.hasBeenActive + ",isActive:" + ua.isActive + "}" : "غيرُ معرَّف";
  const now = function () { return performance.now(); };
  const ms = function (x) { return x == null ? "—" : x >= 10000 ? (x / 1000).toFixed(1) + "ث" : Math.round(x) + "ms"; };
  const sec = function (x) { return Math.round(x / 1000) + " ث"; };
  const sleep = function (n) { return new Promise(function (r) { setTimeout(r, n); }); };
  const errName = function (e) { return e ? String(e.name || "Error") + (e.message ? ": " + String(e.message).slice(0, 90) : "") : "؟"; };
  // رميةٌ متزامنة ⇒ وعدٌ مرفوض، ولا رفضَ يتيم · وكلُّ انتظارٍ بمهلة ⇒ {ok,v} · {ok:false,e} · {timeout}
  const safe = function (fn) { let p; try { p = Promise.resolve(fn()); } catch (e) { p = Promise.reject(e); } p.catch(function () {}); return p; };
  const within = function (fn, limit) {
    let timer = 0; const out = new Promise(function (res) { timer = setTimeout(function () { res({ ok: false, timeout: true }); }, limit); });
    return Promise.race([safe(fn).then(function (v) { return { ok: true, v: v }; }, function (e) { return { ok: false, e: e }; }), out])
      .finally(function () { clearTimeout(timer); });
  };
  const emit = function (line) { console.log(line); try { COPY(line); console.log("   (نُسخ إلى الحافظة)"); } catch (e) {} };

  // ── ⓪ السياق — الثلاثةُ مقبولة، وما عداها يُرفض بشرطه وقيمته (قرار 140) ────────
  if (typeof document === "undefined") { emit(TAG + " ⛔ لا مستندَ هنا: typeof document = undefined (عاملُ خدمة؟) — المطلوب صفحةُ الإعدادات أو صفحةُ مشاهدة."); return; }
  const ext = location.protocol === "chrome-extension:";
  const ours = typeof globalThis.extensionActive === "function";
  const rid = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) || "";
  const ctx = ext ? "صفحة-الإضافة" : ours ? "عالم-الإضافة" : "عالم-الصفحة";
  const bad = [];
  let sight = "";
  if (ext) {                                                 // ⛔ صفحةُ إضافةٍ أخرى ليست الضابطَ الموجب (قرار 140)
    let mf = null;
    try { mf = chrome.runtime.getManifest(); sight = "manifest=" + mf.name + " " + mf.version; }
    catch (e) { sight = "manifest=؟ (" + errName(e) + ")"; }
    if (!mf || mf.name !== "VIDEO ZONES") bad.push("الإضافة = " + (mf ? "«" + mf.name + "»" : sight) + " — المطلوب صفحةُ إعدادات «VIDEO ZONES»");
  } else {
    if (!ours && rid) bad.push("السياق = عالمُ إضافةٍ أخرى (chrome.runtime.id=" + rid + ") — المطلوب «VIDEO ZONES» أو top");
    if (window.top !== window) bad.push("الإطار = داخليّ (" + location.hostname + ") — المطلوب الإطارُ الأعلى");
    if (!/^(www\.)?youtube\.com$/.test(location.hostname)) bad.push("المضيف = " + location.hostname + " — المطلوب www.youtube.com");
    if (location.pathname !== "/watch") bad.push("المسار = " + location.pathname + " — المطلوب /watch");
    sight = ours ? "extensionActive=function" : "ytcfg=" + typeof globalThis.ytcfg;
    if (!ours && !rid && globalThis.ytcfg == null) bad.push("شاهدُ البصر: ytcfg = " + typeof globalThis.ytcfg + " ⇒ لا يثبت أنّا في عالم صفحة يوتيوب");
  }
  if (bad.length) { emit(TAG + " ⛔ رفضٌ قبل القياس (السياقُ المكتشف " + ctx + "): " + bad.join(" · ") + "."); return; }
  console.log("🟢 " + TAG + " يعمل — " + ctx + "؛ يقرأ البيئةَ والتوفّر…");

  // ── (أ) البيئة والعتاد · اللغات · التفعيل ──────────────────────────────────────
  const dm = navigator.deviceMemory, uad = navigator.userAgentData;
  let env = "بيئة: UA=" + navigator.userAgent;
  const he = uad && typeof uad.getHighEntropyValues === "function" ? await within(function () {
    return uad.getHighEntropyValues(["platform", "platformVersion", "architecture", "bitness", "fullVersionList"]);
  }, 3000) : { ok: false };
  if (he.ok && he.v) {
    const h = he.v, list = h.fullVersionList || [];
    const b = ["Google Chrome", "Microsoft Edge", "Chromium"]
      .map(function (n) { return list.find(function (x) { return x.brand === n; }); }).find(Boolean) || list[0];
    const arch = h.architecture === "x86" ? (h.bitness === "64" ? "x64" : "x86") : (h.architecture || "؟") + (h.bitness === "64" ? "64" : "");
    let ver = String(h.platformVersion || "؟");
    if (h.platform === "Windows") { const maj = parseInt(ver, 10); ver = (maj >= 13 ? "11" : maj > 0 ? "10" : "؟") + " (" + ver + ")"; }
    else ver = ver.replace(/(\.0)+$/, "");
    env = "بيئة: " + (h.platform || "؟") + " " + ver + " " + arch + " · " + (b ? b.brand.replace(/^Google /, "") + " " + b.version : "؟");
  }
  env += " · أنوية " + (navigator.hardwareConcurrency || "؟") + " · ذاكرة " + (dm ? dm + "GB" + (dm >= 8 ? "+" : "") : "؟");
  const langs = Array.from(navigator.languages || []);
  const bareAr = langs.some(function (l) { return String(l).toLowerCase() === "ar"; });
  const head = "السياق=" + ctx + " (" + (ext ? location.pathname : location.origin + location.pathname) + ") · شاهدُ البصر: " + sight +
    " · " + env + " · لغات=" + (langs.join(",") || "—") + " (ar مجرّدة=" + (bareAr ? "نعم" : "لا") + ") · تفعيل@لصق=" + actAtPaste;

  // ── (ب) أمعرَّفٌ هنا؟ ── يُقرأ من globalThis لا كاسمٍ حرّ، فغيابُه يُعلن ولا يرمي ──
  const T = globalThis.Translator;
  if (typeof (T && T.availability) !== "function") {
    const sib = ["LanguageDetector", "Summarizer", "LanguageModel"].map(function (n) { return n + "=" + (typeof globalThis[n] === "undefined" ? "لا" : "نعم"); }).join(" ");
    emit(TAG + " ❌ Translator غيرُ قابلٍ للنداء هنا (typeof Translator=" + typeof T + " · typeof availability=" +
      typeof (T && T.availability) + ") · أشقّاؤه: " + sib + " ⇒ " + (ext
      ? "**وهذه صفحةُ الإضافة نفسُها ⇒ كروم هذا لا يكشفه أصلاً**" : "**ولا يُصدَّق إلا وشاهدُه الموجب تشغيلةُ صفحة الإعدادات على الجهاز نفسِه**") + " · " + head);
    return;
  }
  const AR = /[\u0600-\u06FF]/;                              // بالترميز لا بالحرف: U+0600 حرفٌ خفيّ
  if (!AR.test("مرحباً") || AR.test("Hello")) { emit(TAG + " ⛔ كاشفُ العربية لا يفرّق — عيبٌ في المِجَسّ نفسِه لا في كروم."); return; }

  // ── (ج) التوفّر، وشاهدُه السالب: زوجٌ غيرُ مدعوم ──────────────────────────────
  const PAIR = { sourceLanguage: "en", targetLanguage: "ar" };
  const show = function (r) { return r.ok ? String(r.v) : r.timeout ? "بلا جوابٍ خلال " + sec(LIM.ask) : "رفض " + errName(r.e); };
  const a1 = await within(function () { return T.availability(PAIR); }, LIM.ask);
  const ax = await within(function () { return T.availability({ sourceLanguage: "en", targetLanguage: "xx" }); }, LIM.ask);
  // ⭐ وضابطٌ موجبٌ في التشغيلة نفسِها: زوجٌ مدعوم (en→es) — فـ«unavailable» للعربيّة لا يُقرأ «لا أرى» (قرار 150)
  const ae = await within(function () { return T.availability({ sourceLanguage: "en", targetLanguage: "es" }); }, LIM.ask);
  const both = !ax.ok && !ax.timeout && !a1.ok && !a1.timeout;   // رفضٌ للزوجين معاً لا يفرّق بينهما
  const wit = "شاهد−(en→xx)=" + show(ax) + (ax.ok ? " ✅" : both ? " ⚠️ رُفض مثلَ en→ar فلا يفرّق" : " ✅ (رفض)") +
    " · ضابط+(en→es)=" + show(ae);
  if (ax.ok ? ax.v !== "unavailable" : ax.timeout) {
    emit(TAG + " ⛔ الشاهدُ السالب لم يقع — الأداةُ لا تفرّق: en→xx=" + show(ax) + " (المتوقَّع unavailable أو رفض) · en→ar=" + show(a1) + " · " + head);
    return;
  }
  if (!a1.ok || a1.v === "unavailable") {
    emit(TAG + (a1.ok || !a1.timeout ? " ❌ " : " ⛔ ") + "en→ar=" + show(a1) + " · " + wit + " ⇒ " +
      (ae.ok && ae.v !== "unavailable" ? "العربيّةُ وحدَها (الضابطُ متاح)" : "**ولا الضابطُ متاح ⇒ المترجمُ كلُّه هنا لا العربيّةُ وحدَها**") + " · " +
      (ext ? "**كروم هذا لا يترجم إلى العربية حتى في صفحة الإضافة**" : "**ويُقرأ مع تشغيلة صفحة الإعدادات على الجهاز نفسِه**") + " · " + head);
    return;
  }
  if (["downloadable", "downloading", "available"].indexOf(a1.v) < 0) { emit(TAG + " ⛔ قيمةٌ لا يعرفها المِجَسّ: en→ar=" + a1.v + " — ولا يُخمَّن معناها · " + wit + " · " + head); return; }

  // ── (د · هـ) الإنشاء: بلا إيماءةٍ أوّلاً (سالبُ التفعيل، أو «available»)، ثمّ بإيماءة ──
  const ac = new AbortController(), mons = [];
  const prog = { n: 0, at: null, f: 0, next: 0.1, t0: 0 };
  const onProg = function (e) {
    const f = e.total > 0 ? e.loaded / e.total : Number(e.loaded) || 0;
    prog.n++; prog.f = f; if (prog.at === null) prog.at = now() - prog.t0;
    if (f >= prog.next) { console.log("🟢 " + TAG + ": تنزيل " + Math.round(f * 100) + "% بعد " + ms(now() - prog.t0)); while (prog.next <= f) prog.next += 0.1; }
  };
  const CREATE = { sourceLanguage: "en", targetLanguage: "ar", signal: ac.signal,
    monitor: function (m) { mons.push(m); m.addEventListener("downloadprogress", onProg); } };
  const finish = function (tr) {                             // تنظيفٌ واحدٌ لكلّ مخرجٍ بعد هذا السطر
    try { if (tr && typeof tr.destroy === "function") tr.destroy(); } catch (e) {}
    mons.forEach(function (m) { m.removeEventListener("downloadprogress", onProg); });
    ac.abort();                                              // ما بقي معلَّقاً بعد مهلةٍ يُلغى ولا يُترك
  };
  const waitGesture = function (limit) {                     // مستمعان لمرّةٍ واحدة، يُزالان بالحدث أو بالمهلة
    return new Promise(function (resolve) {
      let timer = 0;
      const off = function () { removeEventListener("pointerdown", h, true); removeEventListener("keydown", h, true); clearTimeout(timer); };
      const h = function (e) {
        const p = safe(function () { return T.create(CREATE); });   // ⛔ أوّلُ سطر: التفعيلُ العابر يُستهلك هنا ولا يُنتظر شيءٌ قبله
        const after = ua ? ua.isActive : "؟";
        prog.t0 = now(); prog.n = 0; prog.at = null; prog.next = 0.1; off();   // أحداثُ التقدّم تُعدّ للنداء الناجح وحدَه
        resolve({ p: p, t: prog.t0, after: after, how: e.type + (e.pointerType ? "/" + e.pointerType : "") + (e.isTrusted ? "" : "/غيرُ-موثوق") });
      };
      addEventListener("pointerdown", h, true);
      addEventListener("keydown", h, true);
      timer = setTimeout(function () { off(); resolve(null); }, Math.max(0, limit));
    });
  };
  const viaGesture = async function () {
    const end = now() + LIM.gesture;
    let tries = 0;
    while (tries < 3 && now() < end) {
      console.log("🟡 " + TAG + ": انقر داخل الصفحة أو اضغط مفتاحاً لبدء تنزيل نموذج الترجمة (نحو 80MB مرّةً واحدة)" +
        " — في موضعٍ فارغٍ لا فوق الفيديو · المهلة " + sec(end - now()) + ".");
      const g = await waitGesture(end - now());
      if (!g) break;
      tries++;
      const r = await within(function () { return g.p; }, LIM.dl);
      if (r.ok || r.timeout || !r.e || r.e.name !== "NotAllowedError") return { r: r, t: now() - g.t, how: "بإيماءة " + g.how + " (تفعيلٌ بعد النداء=" + g.after + ")" };
      console.log("🟡 " + TAG + ": الإيماءةُ لم تُحسب تفعيلاً (" + g.how + ") — انقر بالفأرة داخل الصفحة.");
    }
    return { r: null, tries: tries };
  };

  const isDl = a1.v !== "available";
  if (ua && ua.isActive) console.log("🟡 " + TAG + ": ينتظر انقضاءَ تفعيل اللصق (نحو 5 ث) — لا تنقر الآن.");
  const s0 = now();
  while (ua && ua.isActive && now() - s0 < LIM.lapse) await sleep(200);
  const actAtCall = ua ? String(ua.isActive) : "؟";
  prog.t0 = now();
  const p0 = safe(function () { return T.create(CREATE); });   // بلا إيماءة: سالبُ التفعيل، أو إنشاءُ «available»
  let limitUsed = isDl ? LIM.ask : LIM.ready;
  let r = await within(function () { return p0; }, limitUsed);
  let t = now() - prog.t0, how = "بلا إيماءة (isActive@نداء=" + actAtCall + ")";
  const raw0 = r.ok ? "نجح" : r.timeout ? "لم يُرفض خلال " + sec(LIM.ask) : "رُفض " + errName(r.e);
  // ⛔ نداءٌ والتفعيلُ قائمٌ لا يقيس «بلا إيماءة» ⇒ باطلٌ باسمه وقيمته لا ❌ (قرار 140) · وغيابُه يُكتب ولا يُسقَط
  let negAct = !isDl ? "⚪ لا يُقاس: en→ar=available سلفاً فلا تنزيلَ يطلب إيماءة"
    : actAtCall !== "false" ? "⛔ باطل: isActive=" + actAtCall + " لحظةَ النداء (" + raw0 + ")"
    : (r.ok ? "نجح بلا إيماءة ❌" : r.timeout ? raw0 + " ⇒ يُنزّل بلا إيماءة ❌"
      : r.e && r.e.name === "NotAllowedError" ? "NotAllowedError ✅" : raw0 + " ⚠️") + " (isActive@نداء=false)";
  if (isDl && r.timeout) {
    limitUsed = LIM.dl; r = await within(function () { return p0; }, limitUsed); t = now() - prog.t0;
  } else if (!r.ok && !r.timeout && (isDl || (r.e && r.e.name === "NotAllowedError"))) {
    if (!isDl) negAct = "available لكنّه طلب إيماءة: " + errName(r.e);
    const g = await viaGesture();
    if (!g.r) {
      finish(null);
      emit(TAG + " ⛔ " + (g.tries ? "إيماءاتٌ لم تُحسب تفعيلاً (" + g.tries + ")" : "لم تقع إيماءة خلال " + sec(LIM.gesture)) +
        " — لا تنزيلَ ولا حكم · en→ar=" + a1.v + " · " + wit + " · تفعيل−=" + negAct + " · " + head);
      return;
    }
    r = g.r; t = g.t; how = g.how; limitUsed = LIM.dl;
  }
  if (!r.ok) {
    finish(null);
    emit(TAG + (r.timeout ? " ⛔ create() لم ينتهِ خلال " + sec(limitUsed) + " — آخرُ تقدّم " + Math.round(prog.f * 100) + "%"
      : " ❌ create() رُفض: " + errName(r.e)) + " · en→ar=" + a1.v + " · " + wit + (negAct ? " · تفعيل−=" + negAct : "") + " · " + head);
    return;
  }
  const tr = r.v;
  console.log("🟢 " + TAG + ": المترجمُ جاهز بعد " + ms(t) + " — يترجم 20 جملة متتابعة…");

  // ── (و) عشرون جملةً بنبرة يوتيوب، متتابعةً، ولكلٍّ زمنُها ──────────────────────
  const S = [
    "Hey everyone, welcome back to the channel.", "Today we're going to build a small web app from scratch.", "First, open the terminal and create a new folder for the project.",
    "This laptop has sixteen gigabytes of memory and a really fast chip.", "The battery lasted about nine and a half hours in my test.", "So, is it actually worth upgrading from last year's model?",
    "Let me show you how this feature works in real life.", "We landed in Tokyo at six in the morning and it was raining.", "My friend Sarah recommended this little coffee shop downtown.",
    "Make sure you save the file before you run the script.", "The price dropped from 999 dollars to 799 dollars last week.", "Honestly, I didn't expect the camera to be this good at night.",
    "If you found this helpful, please hit the like button.", "Now click on settings and scroll all the way down.", "This bug took me three days to figure out.",
    "Why does the video keep buffering when the connection is fine?", "In the next episode, we'll talk about passwords and security.", "The update adds dark mode and fixes a lot of small bugs.",
    "Okay, let's see what happens if I press this button.", "Thanks for watching, and I'll see you in the next one."
  ];
  const lat = [], outs = [];
  let arN = 0, echo = 0, errs = 0, run = 0, firstErr = "", firstLat = null;
  for (let i = 0; i < S.length && run < 3; i++) {            // ثلاثةُ أخطاءٍ متتالية تُوقف ولا تُعلّق
    const s1 = now();
    const x = await within(function () { return tr.translate(S[i]); }, LIM.line);
    if (x.ok && typeof x.v === "string") {
      const d = now() - s1; lat.push(d); outs.push(x.v); run = 0;
      if (i === 0) firstLat = d;
      if (AR.test(x.v)) arN++;
      if (x.v.trim() === S[i].trim()) echo++;
    } else { errs++; run++; outs.push(""); if (!firstErr) firstErr = x.timeout ? "مهلة " + sec(LIM.line) : errName(x.e); }
  }
  const q = function (p) { const s = lat.slice().sort(function (a, b) { return a - b; }); return s.length ? s[Math.max(0, Math.ceil(p * s.length) - 1)] : null; };

  // ── (ز) التوفّرُ بعد الاستعمال، ثمّ الإتلافُ والتنظيف، ثمّ الحكم ─────────────────
  const a2 = await within(function () { return T.availability(PAIR); }, LIM.ask);
  finish(tr);
  const cut = function (s) { s = String(s || "—"); return s.length > 60 ? s.slice(0, 60) + "…" : s; };
  emit(TAG + (arN >= 18 ? " ✅ المترجمُ يعمل هنا" : " ❌ الترجمةُ لم تُخرج عربيّةً كافية") +
    " · عربيّ " + arN + "/" + S.length + " · صدى " + echo + " · أخطاء " + errs + (firstErr ? " (" + firstErr + ")" : "") +
    " · أوّل " + ms(firstLat) + " · p50 " + ms(q(0.5)) + " · p90 " + ms(q(0.9)) + " · أقصى " + ms(q(1)) +
    " · en→ar=" + a1.v + " ثمّ بعد الاستعمال " + show(a2) + " · " + wit + (negAct ? " · تفعيل−=" + negAct : "") +
    " · " + (isDl ? "تنزيل+إنشاء " : "إنشاء ") + how + " = " + ms(t) +
    (isDl && t < 1500 ? " ⚠️ أقصرُ من تنزيلٍ حقيقيّ — تمويهٌ محتمل (قرار 48)" : "") +
    (prog.n ? " · أحداثُ التقدّم=" + prog.n + " (أوّلُها بعد " + ms(prog.at) + ")" : "") +
    " · «" + cut(outs[0]) + "» · «" + cut(outs[1]) + "» · " + head);
})();
