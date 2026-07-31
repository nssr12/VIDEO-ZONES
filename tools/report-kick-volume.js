// قياس منزلق كِك **في متصفّح المالك** — يُلصق في الكونسول، ولا يُشحن.
//
// **لماذا بيدك لا بالرِكاز:** كِك في `--headless` يرسم شجرة ضحلة (**748 عنصراً**،
// **صفر `role=slider`**، ولا زرّ كتم) — شريط التحكّم **لا يُركَّب أصلاً**، بينما
// تويتش يرسم 1345→2153. فالقياس هناك **«لم يُقس» لا «غير موجود»** (قرار 26).
//
// يجيب عن الأسئلة الأربعة بالأرقام:
//   ① الأسهم المُرسَلة **إلى المنزلق** وهو مخفيّ (0×0): هل تحرّك `aria-valuenow`؟
//   ② فإن لم تحرّك: هل تكفي محاكاة `pointerover`/`mouseenter` على الآباء؟
//   ③ دلالة الكتم عند كِك، ونجاة القيمة بعد كتم المضيف وفكّه.
//   ④ و`aria-valuenow` و`video.volume` يُطبعان **جنباً إلى جنب بلا ربط** —
//      لا معادلة بينهما ولا اشتقاق.
//
// **الاستعمال:** افتح قناة حيّة، شغّل الصوت، ثم الصق. سيطلب منك ضغطتين بيدك.
// ⚠️ يغيّر مستوى الصوت أثناء القياس (هذا هو القياس)، ولا يكتب شيئاً في التخزين.
(() => {
  const ours = (el) => {
    if (!el || el.nodeType !== 1) return false;
    if (typeof el.closest === "function" && el.closest(".vzWrap")) return true;
    const c = typeof el.className === "string" ? el.className : "";
    return /\bvz[A-Z]/.test(c) || /^vz_/.test(el.id || "");
  };

  // **الدور داخل حاوية المشغّل هو الأساس، والوسم مرجّح لا حاكم** — `Volume`
  // نصّ إنجليزيّ قد يُترجَم على واجهة أخرى، فلا يكون شرطاً وحيداً للمطابقة.
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

  const read = () => {
    const el = findSlider();
    const v = document.querySelector("video");
    const r = el ? el.getBoundingClientRect() : null;
    return {
      now: el ? el.getAttribute("aria-valuenow") : null,
      min: el ? el.getAttribute("aria-valuemin") : null,
      max: el ? el.getAttribute("aria-valuemax") : null,
      w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null,
      muted: v ? v.muted : null,
      vol: v ? Math.round(v.volume * 1000) / 10 : null
    };
  };
  // ⚠️ جنباً إلى جنب بلا ربط: aria شيء و video.volume شيء آخر
  const fmt = (s) => `aria=${s.now} [${s.min}..${s.max}] مقاس=${s.w}×${s.h}` +
    ` · muted=${s.muted} · video.volume=${s.vol}%`;

  const key = (el, k) => {
    if (!el) return;
    const code = k === "ArrowUp" ? 38 : k === "ArrowDown" ? 40 : 77;
    for (const type of ["keydown", "keyup"]) {
      el.dispatchEvent(new KeyboardEvent(type, { key: k, code: k, keyCode: code, which: code,
        bubbles: true, cancelable: true, composed: true }));
    }
  };

  const hoverChain = () => {
    let n = findSlider(), fired = 0;
    for (let i = 0; i < 5 && n; i++) {
      for (const t of ["pointerover", "pointerenter", "mouseover", "mouseenter", "mousemove"]) {
        n.dispatchEvent(new MouseEvent(t, { bubbles: t !== "pointerenter" && t !== "mouseenter", cancelable: true }));
      }
      fired++; n = n.parentElement;
    }
    return fired;
  };

  const sl = findSlider();
  if (!sl) {
    console.log("VZKICK ⚠️ لم يُعثر على [role=slider] داخل حاوية المشغّل — " +
      "مرّر المؤشّر على أيقونة الصوت ثم أعد اللصق. " +
      `(role=slider في الصفحة: ${document.querySelectorAll('[role="slider"]').length})`);
    return;
  }
  const label = sl.getAttribute("aria-label") || "بلا وسم";
  console.log(`VZKICK وُجد: وسم="${label}" · ${fmt(read())}`);

  // ① الأسهم إلى المنزلق وهو كما هو
  const a0 = read();
  key(sl, "ArrowDown"); key(sl, "ArrowDown");
  setTimeout(() => {
    const a1 = read();
    const q1 = a1.now !== a0.now;
    console.log(`VZKICK ① أسهم إلى المنزلق (مقاس ${a0.w}×${a0.h}) : ${a0.now} ⇒ ${a1.now}  ${q1 ? "✅ يستجيب" : "❌ لا يستجيب"} | ${fmt(a1)}`);

    // ② محاكاة التمرير ثم الأسهم
    const fired = hoverChain();
    setTimeout(() => {
      const b0 = read();
      key(findSlider(), "ArrowDown"); key(findSlider(), "ArrowDown");
      setTimeout(() => {
        const b1 = read();
        const q2 = b1.now !== b0.now;
        console.log(`VZKICK ② بعد تمرير مُصطنَع على ${fired} آباء (مقاس ${b0.w}×${b0.h}) : ${b0.now} ⇒ ${b1.now}  ${q2 ? "✅ يستجيب" : "❌ لا يستجيب"}`);
        console.log("VZKICK ③ ⏳ **اكتم الآن بمفتاح m بيدك**، ثم انتظر — القياس بعد 8 ثوانٍ …");

        setTimeout(() => {
          const m0 = read();
          key(findSlider(), "ArrowUp"); key(findSlider(), "ArrowUp");
          setTimeout(() => {
            const m1 = read();
            console.log(`VZKICK ③أ أثناء الكتم: ${fmt(m0)}`);
            console.log(`VZKICK ③ب بعد أسهم وهو مكتوم: ${fmt(m1)}  ⇒ ` +
              (m1.muted === false ? "**فكّ الكتم (كتويتش)**" : "**بقي مكتوماً (كيوتيوب)**"));
            console.log("VZKICK ③ج ⏳ **افكّ الكتم الآن بـ m بيدك** — القياس الأخير بعد 8 ثوانٍ …");
            setTimeout(() => {
              const m2 = read();
              console.log(`VZKICK ③د بعد الفكّ: ${fmt(m2)}  ⇒ نجاة القيمة: ${m1.now} ⇒ ${m2.now} ` +
                (m1.now === m2.now ? "✅ نجت" : "❌ تغيّرت"));
              console.log("VZKICK ✔ انتهى — انسخ كل أسطر VZKICK.");
            }, 8000);
          }, 900);
        }, 8000);
      }, 900);
    }, 1200);
  }, 900);
})();
