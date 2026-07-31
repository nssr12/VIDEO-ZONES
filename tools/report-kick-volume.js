// قياس كِك **في متصفّح المالك** — يُلصق في الكونسول، ولا يُشحن. **النسخة الرابعة.**
//
// ⚠️ **استنتاج مسحوب (قرار 21) — وهو أخطر ما سُحب:**
// ~~«كِك يمحو كتابتنا في السكون، وعطبه أشدّ من عائلة #60، وخاصيّة الصوت لا تعمل
// عليه أصلاً»~~. **باطل بقياس نظيف: 30% صمدت أربع ثوانٍ كاملة**
// (`0→100→300→600→1000→2000→4000ms` كلها 30%).
// **والسبب المرجَّح أن القراءة الأولى لم تكن في سكون أصلاً:** سبقتها في التشغيلة
// نفسها **تسع عشرة ضغطة مفتاح وثماني عجلات** مُرسَلة إلى واجهة كِك قبل الكتابة
// بلحظات ⇒ **ما رُئي أثر استفزازنا لا سلوك المضيف**.
//
// ⇒ **قاعدة (قرار 26): قياس يقع بعد تدخّلات مُرسَلة في التشغيلة نفسها ليس قياس
// سكون. مرحلة السكون تُعزل في تشغيلة نظيفة أو لا تُصدَّق.**
// **ولذلك تبدأ هذي النسخة بالسكون قبل أي تدخّل**، ولا تُرسل مفتاحاً ولا عجلة أبداً.
//
// ⚠️ **وعيب تصميم ثانٍ، في ترتيب المراحل لا في الأداة:** مرحلة دورة الكتم كانت
// **نافذة زمنية تطالب بضغطتين متتاليتين** — تصميم هشّ فشل **ثلاث مرات**. صارت
// **استطلاعاً**: يُراقَب `muted` كل 200ms مدة 30 ثانية، ويُطبع «رصدتُ الكتم»
// و«رصدتُ الفكّ» **لحظة وقوعهما**، ويُحكَم على النجاة **عند رصد الفكّ نفسه** لا
// عند انتهاء مهلة. وإن مضت الثلاثون بلا دورة كاملة **قيل ما نقص بالضبط**.
//
// **والخيط الجديد:** مفاتيح `amazon_ivs_*` تقول إن كِك يشغّل **مشغّل Amazon IVS
// للويب**، وله **واجهة برمجية** (`setVolume` وما حولها) **لا DOM يُدغدَغ**.
// المرحلة ٣ **تبحث عن نسخة المشغّل ولا تكتب فيها شيئاً**: موجودة أم لا، وبأي
// طريق، وهل يُقرأ منها المستوى. **الكونسول في عالم الصفحة أصلاً فلا حقن يلزم.**
(() => {
  const say = (m) => console.log("VZKICK " + m);
  const v = document.querySelector("video");
  if (!v) { say("⚠️ لا فيديو في الصفحة — لم يُقس"); return; }
  const vol = () => Math.round(v.volume * 1000) / 10;

  // ── ١) السكون **أولاً**، قبل أي تدخّل: لا مفتاح ولا عجلة في هذي الأداة ────
  const before = vol();
  const marks = [100, 300, 600, 1000, 2000, 4000];
  const series = [[0, null]];
  v.volume = 0.30;
  series[0][1] = vol();
  say(`١) سكون نظيف — قبل=${before}% · كتبنا 30% · فوراً=${vol()}%  (لا مفتاح ولا عجلة أُرسلا)`);

  let i = 0;
  const tick = () => {
    if (i >= marks.length) return afterSilence();
    const at = marks[i], prev = i === 0 ? 0 : marks[i - 1];
    i++;
    setTimeout(() => { series.push([at, vol()]); tick(); }, at - prev);
  };

  // ── ٢) نسخة مشغّل IVS — **بحث وقراءة فقط، بلا كتابة** ────────────────────
  const findPlayer = () => {
    const found = [];
    const looksLikePlayer = (o) => {
      if (!o || (typeof o !== "object" && typeof o !== "function")) return false;
      try {
        return ["setVolume", "getVolume", "setMuted", "getMuted", "isMuted"]
          .filter((k) => typeof o[k] === "function").length >= 2;
      } catch { return false; }
    };
    // (أ) على عنصر الفيديو نفسه — خصائص غير قياسية يزرعها المشغّل
    try {
      for (const k of Object.getOwnPropertyNames(v)) {
        try { if (looksLikePlayer(v[k])) found.push(["video." + k, v[k]]); } catch {}
      }
    } catch {}
    // (ب) على window مباشرةً
    try {
      for (const k of Object.getOwnPropertyNames(window)) {
        if (/^(webkit|moz|on)/.test(k)) continue;
        let o; try { o = window[k]; } catch { continue; }
        if (looksLikePlayer(o)) found.push(["window." + k, o]);
        // (ج) مصنع IVS: يعرض create()/isPlayerSupported بدل نسخة جاهزة
        try {
          if (o && typeof o === "object" && /ivs/i.test(k) &&
              (typeof o.create === "function" || "isPlayerSupported" in o)) {
            found.push(["window." + k + " (مصنع IVS)", o]);
          }
        } catch {}
      }
    } catch {}
    return found;
  };

  const afterSilence = () => {
    say("١) السلسلة: " + series.map(([t, x]) => `${t}ms:${x}%`).join(" → "));
    const gone = series.find(([, x]) => Math.abs(x - 30) > 1);
    say("١) " + (gone
      ? `عادت القيمة عند **${gone[0]}ms** ⇒ ` +
        (gone[0] <= 300 ? "**فوريّ — يشبه مستمع volumechange**" : "**متأخّر — يشبه استطلاعاً دورياً**")
      : "**صمدت أربع ثوانٍ — لا محو في السكون**"));

    // ٢) مستمعو الفيديو — يعمل في كونسول DevTools وحده
    try {
      if (typeof getEventListeners === "function") {
        const l = getEventListeners(v) || {};
        say(`٢) مستمعو الفيديو: ${Object.keys(l).map((k) => k + "×" + l[k].length).join(" · ") || "لا شيء"}` +
          ` · volumechange=${(l.volumechange || []).length}`);
      } else {
        say("٢) getEventListeners غير متاح **داخل دالة** — الصق بدلها في الكونسول مباشرةً:" +
          "  getEventListeners(document.querySelector('video'))");
      }
    } catch (e) { say("٢) تعذّر: " + String(e).slice(0, 40)); }

    // ٣) نسخة المشغّل
    const hits = findPlayer();
    if (!hits.length) {
      say("٣) **لم تُوجد نسخة مشغّل** على `window` ولا على عنصر الفيديو (بحث بالسلوك: " +
        "كائن فيه ≥2 من setVolume/getVolume/setMuted/getMuted/isMuted).");
    } else {
      for (const [path, o] of hits) {
        let readable = "—";
        try { if (typeof o.getVolume === "function") readable = String(o.getVolume()); } catch (e) { readable = "رمى"; }
        let muted = "—";
        try {
          if (typeof o.isMuted === "function") muted = String(o.isMuted());
          else if (typeof o.getMuted === "function") muted = String(o.getMuted());
        } catch {}
        const api = ["setVolume", "getVolume", "setMuted", "getMuted", "isMuted", "attachHTMLVideoElement"]
          .filter((k) => { try { return typeof o[k] === "function"; } catch { return false; } });
        say(`٣) **وُجدت** عبر \`${path}\` · دوالّ: ${api.join(",")} · getVolume()=${readable} · مكتوم=${muted}`);
      }
    }
    say(`٣) مفاتيح IVS في التخزين: ` + (() => {
      try {
        const k = [];
        for (let n = 0; n < localStorage.length; n++) {
          const key = localStorage.key(n);
          if (/ivs|kick|volume|sound|audio|mute/i.test(key)) k.push(key);
        }
        return k.join(" · ") || "لا شيء";
      } catch { return "تعذّر"; }
    })());

    // ── ٤) دورة الكتم **بالاستطلاع لا بالمهلة** ───────────────────────────
    const beforeMute = vol();
    say(`٤) قبل الكتم: vol=${beforeMute}% muted=${v.muted} — **اكتم بـ m ثم افكّ بـ m، بلا عجلة زمنية.**`);
    let sawMute = false, t = 0;
    const iv = setInterval(() => {
      t += 200;
      if (!sawMute && v.muted === true) {
        sawMute = true;
        say(`٤) رصدتُ **الكتم** عند ${t}ms · vol=${vol()}%`);
      } else if (sawMute && v.muted === false) {
        // ⚠️ **الحكم عند رصد الفكّ نفسه** — لا عند انتهاء مهلة، ولا والحالة مكتومة
        clearInterval(iv);
        const after = vol();
        say(`٤) رصدتُ **الفكّ** عند ${t}ms · vol=${after}%`);
        say(`٤) النجاة (قبل الكتم ⇔ عند رصد الفكّ): ${beforeMute}% ⇒ ${after}% ` +
          (Math.abs(after - beforeMute) < 1 ? "✅ نجت" : "❌ **مُحيت**"));
        say("✔ انتهى — انسخ كل أسطر VZKICK.");
        return;
      }
      if (t >= 30000) {
        clearInterval(iv);
        say("٤) ⚠️ مضت 30 ثانية — " + (sawMute
          ? "**رُصد الكتم ولم يُرصد الفكّ**: اضغط m مرة أخرى وأعد اللصق."
          : "**لم يُرصد كتم أصلاً**: لم تصل ضغطة m إلى المشغّل — تأكّد أن التركيز على الصفحة."));
        say("✔ انتهى — انسخ كل أسطر VZKICK.");
      }
    }, 200);
  };

  tick();
})();
