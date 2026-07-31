// قياس كِك **في متصفّح المالك** — يُلصق في الكونسول، ولا يُشحن. **النسخة الثانية.**
//
// ⚠️ **عيبان في النسخة الأولى، سحبهما المالك ومعه الحقّ — «أداة تطبع حكماً لا
// يسنده قياسها»:**
//   ١. طبعت **«بقي مكتوماً (كيوتيوب)»** بينما المنزلق **لم يستجب أصلاً** في ①
//      و②. **عنصر لا يتحرّك لا يُستنطَق**: جمودُه في الكتم أثرُ جمود لا دلالةُ
//      مضيف. ⇒ حكم دلالة الكتم **لا يُطبع إلا إن تحرّك المنزلق بطريق ما**.
//   ٢. وقاست «النجاة» بمقارنة القراءة **أثناء الكتم** بالقراءة **بعد الفكّ**،
//      وتلك **استعادة لا ضياع**. ⇒ النجاة تُقاس **قبل الكتم مقابل بعد الفكّ**.
//
// **ما ثبت على كِك (2026-07-31، أرقام المالك):**
//   · ① أسهم إلى المنزلق (0×0): `35 ⇒ 35` **لا يستجيب**
//   · ② بعد تمرير مُصطنَع على 5 آباء: `35 ⇒ 35` **لا يستجيب**
//   · ③ دورة الكتم: `aria 0` أثناءه ثم **استعادة 35** من نموذج كِك
//   · ⚠️ **وتناقض غير مفسَّر يُسجَّل ولا يُفسَّر**: `aria=35` مع `volume=3%` في ①،
//     و`aria=35` مع `volume=35%` في ③د.
//
// ⚠️ **حدّ بنيويّ لا محاولة فاشلة:** كِك يعرض المنزلق بـ**`:hover` حقيقيّ**،
// وحالة `:hover` **تتبع موضع المؤشّر الفعليّ ولا يصنعها أي حدث مُرسَل**. فالتمرير
// المُصطنَع **لن ينجح أبداً مهما حُسّن**. لا يُعاد المحاولة فيه.
//
// **ثلاثة أسئلة أخيرة، ثم يُقرَّر مصير كِك:**
//   أ) **تركيز ثم مفاتيح** — النسخة الأولى أرسلت المفاتيح **بلا `focus()`**.
//      ومعها `Home`/`End`/`PageUp`: بعض widgets الدور تستجيب لها دون الأسهم.
//   ب) **عجلة** فوق مجموعة الصوت أو المشغّل — **لم تُجرَّب أصلاً**.
//   ج) **والأهم، ولم يُقس قط: هل تنجو كتابتنا المباشرة على كِك؟**
//      «خلل كِك» ما زال مجهول الشكل: هل الصوت لا يتغيّر، أم يتغيّر ولا يتبعه
//      المنزلق بصرياً؟ **الفرق يقرّر إن كان لكِك بند أصلاً.**
(() => {
  const ours = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (typeof el.closest === "function" && el.closest(".vzWrap")) return true;
    const c = typeof el.className === "string" ? el.className : "";
    return /\bvz[A-Z]/.test(c) || /^vz_/.test(el.id || "");
  };

  // الدور داخل حاوية المشغّل هو الأساس، والوسم **مرجّح لا حاكم** (قد يُترجَم)
  const findSlider = () => {
    const v = document.querySelector("video");
    if (!v) return null;
    const cands = [...document.querySelectorAll('[role="slider"]')].filter((el) => !ours(el));
    let best = null, bestScore = 1e9;
    for (const el of cands) {
      let n = v, depth = 0;
      while (n && depth < 10) {
        if (n.contains && n.contains(el)) {
          const label = (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "");
          const score = depth - (/volume|صوت/i.test(label) ? 3 : 0);
          if (score < bestScore) { bestScore = score; best = el; }
          break;
        }
        n = n.parentElement; depth++;
      }
    }
    return best;
  };

  const V = () => document.querySelector("video");
  const read = () => {
    const el = findSlider(), v = V();
    const r = el ? el.getBoundingClientRect() : null;
    return {
      aria: el ? el.getAttribute("aria-valuenow") : null,
      w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null,
      muted: v ? v.muted : null,
      vol: v ? Math.round(v.volume * 1000) / 10 : null,
      active: document.activeElement ? document.activeElement.tagName : "—"
    };
  };
  // ⚠️ **جنباً إلى جنب بلا ربط**: لا معادلة بين aria و video.volume ولا اشتقاق
  const fmt = (s) => `aria=${s.aria} · video.volume=${s.vol}% · muted=${s.muted} · مقاس=${s.w}×${s.h}`;
  const say = (m) => console.log("VZKICK " + m);

  const key = (el, k) => {
    if (!el) return;
    const codes = { ArrowUp: 38, ArrowDown: 40, Home: 36, End: 35, PageUp: 33, PageDown: 34 };
    for (const type of ["keydown", "keyup"]) {
      el.dispatchEvent(new KeyboardEvent(type, { key: k, code: k, keyCode: codes[k] || 0,
        which: codes[k] || 0, bubbles: true, cancelable: true, composed: true }));
    }
  };

  const sl = findSlider();
  if (!sl) {
    say(`⚠️ لم يُعثر على [role=slider] داخل حاوية المشغّل — مرّر المؤشّر على أيقونة الصوت ثم أعد اللصق. ` +
      `(role=slider في الصفحة: ${document.querySelectorAll('[role="slider"]').length})`);
    return;
  }
  say(`وُجد: وسم="${sl.getAttribute("aria-label") || "بلا وسم"}" · ${fmt(read())}`);

  let moved = false;   // **بوّابة الحكم**: لا يُنطق بدلالة الكتم ما لم يتحرّك شيء

  // ── أ) تركيز ثم مفاتيح ──────────────────────────────────────────────────
  const targets = [["المنزلق", sl], ["أبوه", sl.parentElement], ["جدّه", sl.parentElement && sl.parentElement.parentElement]];
  for (const [name, t] of targets) {
    if (!t) continue;
    let focused = "—";
    try {
      if (t.tabIndex < 0 && !t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
      t.focus({ preventScroll: true });
      focused = document.activeElement === t ? "نعم" : "لا";
    } catch { focused = "رمى"; }
    for (const k of ["ArrowUp", "ArrowDown", "Home", "End", "PageUp"]) {
      const b = read();
      key(t, k);
      const a = read();
      const ok = a.aria !== b.aria || a.vol !== b.vol;
      if (ok) moved = true;
      say(`أ) ${name} · تركيز=${focused} · ${k}: aria ${b.aria}⇒${a.aria} · vol ${b.vol}%⇒${a.vol}%  ${ok ? "✅ تحرّك" : "❌"}`);
    }
  }

  // ── ب) عجلة فوق مجموعة الصوت والمشغّل ───────────────────────────────────
  const wheelTargets = [["المنزلق", sl], ["أبوه", sl.parentElement],
                        ["جدّه", sl.parentElement && sl.parentElement.parentElement],
                        ["الفيديو", V()]];
  for (const [name, t] of wheelTargets) {
    if (!t) continue;
    for (const dy of [-120, 120]) {
      const b = read();
      try {
        t.dispatchEvent(new WheelEvent("wheel", { deltaY: dy, deltaMode: 0,
          bubbles: true, cancelable: true, composed: true }));
      } catch { continue; }
      const a = read();
      const ok = a.aria !== b.aria || a.vol !== b.vol;
      if (ok) moved = true;
      say(`ب) عجلة ${dy < 0 ? "↑" : "↓"} على ${name}: aria ${b.aria}⇒${a.aria} · vol ${b.vol}%⇒${a.vol}%  ${ok ? "✅ تحرّك" : "❌"}`);
    }
  }

  // ── ج) هل تنجو كتابتنا المباشرة على كِك أصلاً؟ ──────────────────────────
  const v = V();
  const preWrite = read();
  const target = preWrite.vol > 50 ? 0.3 : 0.7;
  v.volume = target;
  const t0 = read();
  say(`ج) كتبنا video.volume=${target * 100}% مباشرةً ⇒ فوراً: ${fmt(t0)}`);

  setTimeout(() => {
    const t2 = read();
    const survivedSilence = Math.abs(t2.vol - target * 100) < 1;
    say(`ج) بعد ثانيتين **بلا أي حدث من المضيف**: ${fmt(t2)}  ${survivedSilence ? "✅ نجت" : "❌ مُحيت"}`);
    // **قبل الكتم** — وهذي هي القراءة التي تُقارَن بها النجاة، لا القراءة أثناءه
    const beforeMute = read();
    say("ج) ⏳ **اكتم بـ m ثم افكّ بـ m — بيدك — الآن.** القراءة الأخيرة بعد 12 ثانية …");

    setTimeout(() => {
      const afterCycle = read();
      // ⚠️ **النجاة = قبل الكتم مقابل بعد الفكّ.** مقارنةُ «أثناء الكتم» بـ«بعده»
      // استعادةٌ لا ضياع — وهو الخطأ الذي وقعت فيه النسخة الأولى.
      const survivedCycle = Math.abs(afterCycle.vol - beforeMute.vol) < 1;
      say(`ج) قبل الكتم: ${fmt(beforeMute)}`);
      say(`ج) بعد الفكّ: ${fmt(afterCycle)}`);
      say(`ج) النجاة عبر دورة الكتم (قبل الكتم ⇔ بعد الفكّ): ${beforeMute.vol}% ⇒ ${afterCycle.vol}%  ` +
        (survivedCycle ? "✅ نجت" : "❌ **مُحيت** — المضيف فرض نموذجه"));
      // **بوّابة الحكم**: دلالة الكتم لا تُنطق ما لم يتحرّك المنزلق بطريق ما
      say(moved
        ? "الحكم: المنزلق **استجاب** لطريق واحد على الأقل — انظر أسطر أ/ب أعلاه."
        : "الحكم: **لم يستجب المنزلق لأي طريق جُرّب** ⇒ **لا تُستنبَط دلالة كتم من جموده** " +
          "(عنصر لا يتحرّك لا يُستنطَق).");
      say("✔ انتهى — انسخ كل أسطر VZKICK.");
    }, 12000);
  }, 2000);
})();
