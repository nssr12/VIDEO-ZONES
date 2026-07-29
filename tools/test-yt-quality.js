// Audit #19: applyQ polled 25 x 400ms and fired on EVERY loadedmetadata of EVERY
// <video>, ads included, with no de-duplication — so polls stacked and raced, and one
// could outlive a navigation and then set the previous video's quality on the new one.
//
// Measured on a replay of YouTube's real event sequence with a pre-roll ad:
//   before: 9 poll pulses, quality set on the AD twice, 4 sets on content
//   after : 7 pulses, 0 on the ad, 2 on content (one per video, as intended)
//
// COUNTED, not eyeballed — like #21. A second poll racing the first still produces a
// correct-looking result, so only the counters expose it.
const fs = require("fs");
const vm = require("vm");

const MAIN = fs.readFileSync("yt_quality_main.js", "utf8");
const SRC = fs.readFileSync("content.js", "utf8");
if (!MAIN.includes("isAdShowing")) {
  console.log("  ❌ isAdShowing غائبة — البند #19 غير منفَّذ");
  process.exit(1);
}

function makeWorld({ adShowing = false, ready = true, hasPlayer = true } = {}) {
  const st = { pulses: 0, setOnAd: 0, setOnContent: 0, done: [], listeners: {}, timers: [] };
  const player = {
    classList: {
      _c: new Set(adShowing ? ["ad-showing"] : []),
      contains: (c) => player.classList._c.has(c),
      add: (c) => player.classList._c.add(c),
      remove: (c) => player.classList._c.delete(c)
    },
    getAvailableQualityLevels: () => {
      st.pulses++;
      return st.ready ? ["hd1080", "hd720", "medium", "auto"] : [];
    },
    setPlaybackQualityRange: () => {
      if (player.classList.contains("ad-showing")) st.setOnAd++; else st.setOnContent++;
    },
    setPlaybackQuality: () => {}
  };
  st.ready = ready;
  st.player = player;
  const ctx = {
    window: {
      addEventListener: (t, fn) => { (st.listeners[t] ||= []).push(fn); },
      dispatchEvent: (e) => { for (const fn of st.listeners[e.type] || []) fn(e); return true; }
    },
    document: {
      querySelector: (s) => (s === "#movie_player" && hasPlayer ? player : null),
      addEventListener: (t, fn) => { (st.listeners[t] ||= []).push(fn); }
    },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    setTimeout: (fn, ms) => { const id = setTimeout(fn, ms); st.timers.push(id); return id; },
    Date, console
  };
  ctx.window.__vzQB = undefined;
  vm.createContext(ctx);
  vm.runInContext(MAIN, ctx);
  st.ctx = ctx;
  st.fire = (q) => ctx.window.dispatchEvent(new ctx.CustomEvent("__vz_setq__", { detail: { q } }));
  st.nav = () => { for (const fn of st.listeners["yt-navigate-start"] || []) fn(); };
  // النتائج تُبلَّغ عبر __vz_setq_done__
  (st.listeners["__vz_setq_done__"] ||= []).push((e) => st.done.push(e.detail.result));
  return st;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

(async () => {
  console.log("\n[1] الإعلان: لا تُضبط جودة عليه إطلاقاً");
  {
    const w = makeWorld({ adShowing: true, ready: true });
    w.fire("hd1080");
    await wait(120);
    check("لم تُضبط جودة على الإعلان", w.setOnAd === 0, w.setOnAd);
    check("والنتيجة المُبلَّغة «ad»", w.done.includes("ad"), w.done);
    check("ولا استطلاع أصلاً — خروج فوري", w.pulses === 0, w.pulses);
  }
  {
    // إعلان يبدأ في منتصف الاستطلاع
    const w = makeWorld({ adShowing: false, ready: false });
    w.fire("hd1080");
    await wait(500);
    w.player.classList.add("ad-showing");
    await wait(700);
    check("إعلان يبدأ أثناء الاستطلاع ⇒ يتوقف بلا ضبط", w.setOnAd === 0 && w.done.includes("ad"), w.done);
  }

  console.log("\n[2] ⭐ استطلاع واحد حيّ — بالعدّ");
  {
    const w = makeWorld({ ready: false });
    for (let i = 0; i < 5; i++) w.fire("hd1080");   // خمسة طلبات متتالية
    await wait(500);
    w.ready = true;
    await wait(700);
    check("خمسة طلبات ⇒ ضبط واحد لا خمسة", w.setOnContent === 1, w.setOnContent);
    const cancelled = w.done.filter((r) => r === "cancelled").length;
    check("وأربعة منها أُبلغ عنها «cancelled»", cancelled === 4, w.done);
    check("ونتيجة واحدة «set»", w.done.filter((r) => r === "set").length === 1, w.done);
  }

  console.log("\n[3] السقف الزمني: الاستطلاع ينتهي حتى بلا نجاح");
  {
    const capMs = Number(/POLL_DEADLINE_MS = (\d+)/.exec(MAIN)?.[1]);
    check("السقف معرَّف صراحةً", Number.isFinite(capMs) && capMs > 0, capMs);
    check("وليس حلقة بلا نهاية", !/for \(var i = 0; i < 25; i\+\+\)/.test(MAIN));
    check("ويُبلَّغ عنه بـ timeout", MAIN.includes('return "timeout"'));
  }

  console.log("\n[4] ⭐ التنقّل يُلغي الاستطلاع الجاري");
  {
    const w = makeWorld({ ready: false });
    w.fire("hd1080");
    await wait(500);
    w.nav();                       // yt-navigate-start أثناء الاستطلاع
    w.ready = true;                // الفيديو الجديد جاهز
    await wait(700);
    check("الاستطلاع القديم لا يضبط جودة على الفيديو الجديد", w.setOnContent === 0, w.setOnContent);
    check("وأُبلغ عنه «cancelled»", w.done.includes("cancelled"), w.done);
  }
  {
    // وبعد الإلغاء، طلب جديد يعمل طبيعياً
    const w = makeWorld({ ready: false });
    w.fire("hd1080"); await wait(300); w.nav();
    w.fire("hd1080"); w.ready = true; await wait(700);
    check("وطلب جديد بعد التنقّل يعمل", w.setOnContent === 1, w.setOnContent);
  }

  console.log("\n[5] السقوط لأعلى جودة متاحة يُبلَّغ عنه بدل أن يصمت");
  {
    const w = makeWorld({ ready: true });
    w.fire("highres");             // جودة غير متاحة في هذا الفيديو
    await wait(200);
    check("ضُبطت أعلى متاحة", w.setOnContent === 1, w.setOnContent);
    check("والنتيجة تقول fallback مع البديل",
      w.done.some((r) => String(r).startsWith("fallback:")), w.done);
  }

  console.log("\n[6] إزالة التكرار في العالم المعزول");
  {
    check("مفتاح محاولة لكل فيديو وجودة", SRC.includes("ytQualityAttemptKey"));
    check("والمفتاح يُصفَّر عند التنقّل",
      /yt-navigate-start[\s\S]{0,200}ytQualityAttemptKey = null/.test(SRC));
    check("ويُرسَل إلغاء صريح للعالم الرئيسي", SRC.includes("__vz_cancelq__"));
    check("والنتيجة تُلتقط من العالم الرئيسي", SRC.includes("__vz_setq_done__"));
  }

  console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
  process.exit(fail ? 1 : 0);
})();
