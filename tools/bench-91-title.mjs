// قياس #91 — عنوان الفيديو في ملء الشاشة: **أهو العنصر نفسه أم عنصرٌ لا يُنتَج إلا هناك؟**
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// يحكم على مرئيّة `.ytp-fullscreen-metadata` — حاويةٍ يملكها يوتيوب ويعيد
//   تسميتها متى شاء — ويُقلع كرومَ مرّتين كاملتين (المفتاح مُشغَّلاً ثمّ
//   مطفأً).
//
//   node tools/bench-91-title.mjs
//   node tools/bench-91-title.mjs --json
//
// ── لماذا قياسٌ قبل مفتاح (أمر المالك) ──────────────────────────────────────
// عند المستخدم مفتاحٌ اسمه «إخفاء عنوان الفيديو واسم القناة» (`top_titles`)
// **ولا يعمل حيث يراه**. وللعَرَض جذران مختلفان تماماً:
//   (أ) **العنصر نفسه** ⇒ محدِّدُنا يطابقه ولا يُخفيه ⇒ العلّة في القاعدة أو البوّابة
//   (ب) **عنصرٌ آخر لا يُنتَج إلا في ملء الشاشة** ⇒ **حالٌ لم تُنتَج تُقرأ محدِّداً
//       ميّتاً** — وهي حالة `S7` بعينها، وعلاجُها محدِّدٌ جديد لا إصلاح قاعدة.
// ⛔ **ولا تُجرَّب محدّدات على العمياء** — يُسمّى العنصر من **نصّه الذي يراه
// المستخدم** (عنوان المستند)، لا من صنفٍ نظنّه.
//
// ── شاهدا القبول (قرار 26) ──────────────────────────────────────────────────
//  · **موجب:** المفتاح **مُشغَّل** ⇒ عنصرٌ يطابقه محدِّدُنا يصير `display:none`
//    **في الحالة العادية** — فالأنبوب كلُّه (تخزين ⇒ حقن ⇒ قاعدة) يعمل ويُرى.
//  · **سالب:** والمفتاح **مطفأ** ⇒ العنصر نفسه **مرئيّ**. بلا هذا لا يُعرف أن
//    الإخفاء أثرُنا نحن لا أثر المضيف (وهو العمى الثالث بعينه).
import { launch, openPage, configure, contentWorld, evalIn, killChrome, waitPortFree }
  from "./ext-harness.mjs";

const PORT = 9791;
const AS_JSON = process.argv.includes("--json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

const settings = (titlesOn) => ({
  settings: {
    enabled: true,
    cleanPlayer: { enabled: true, items: titlesOn ? { top_titles: true } : {} },
    zones: { enabled: true, fullscreenOnly: false }
  },
  globalSiteRules: { enabled: true, mappings: [] }
});

// ── المِجَسّ: يُسمّي العنصر من نصّه لا من صنفه ───────────────────────────────
const PROBE = `(() => {
  const effOpacity = (el) => { let o = 1, n = el;
    while (n && n.nodeType === 1) { o *= Number(getComputedStyle(n).opacity) || 0; n = n.parentElement; }
    return o; };
  const visible = (el) => { if (!el || el.nodeType !== 1) return false;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" &&
           effOpacity(el) > 0 && r.width > 0 && r.height > 0; };
  const desc = (el) => el ? (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\\s+/).slice(0, 4).join(".") : "")).slice(0, 80) : "—";
  const box = (el) => { const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }; };
  const chain = (el) => { const out = []; let n = el.parentElement;
    for (let i = 0; i < 4 && n; i++) { out.push(desc(n)); n = n.parentElement; } return out; };

  // **الاسم من النصّ**: عنوان المستند بلا لاحقة يوتيوب
  const title = (document.title || "").replace(/\\s*-\\s*YouTube\\s*$/, "").trim();
  const hits = [];
  if (title) {
    for (const el of document.querySelectorAll("*")) {
      if (el.childElementCount !== 0) continue;                 // ورقةٌ لا حاوية
      if ((el.textContent || "").trim() !== title) continue;
      hits.push({
        desc: desc(el), box: box(el), visible: visible(el),
        display: getComputedStyle(el).display,
        // أيطابقه محدِّدُنا؟ (نصّاً كما هو في السجلّ، لا محدِّدٌ جديد)
        matchedByOurs: !!el.closest(".ytp-title, .ytp-title-channel"),
        inChromeTop: !!el.closest(".ytp-chrome-top"),
        chain: chain(el)
      });
    }
  }
  // ── شاهدٌ على **أثرنا نحن** لا على أثر المضيف (العمى الثالث) ──────────────
  // يوتيوب يُخفي «ytp-title» بنفسه في الحالة العادية، **فقراءةُ عنصره لا تفرّق**.
  // ⇒ يُدسّ عنصرٌ **من صنعنا** يحمل الصنف، فيُقرأ أثرُ قاعدتنا وحدها. ويُزال فوراً.
  const witness = (cls) => {
    const host = document.querySelector("#movie_player") || document.body;
    const w = document.createElement("div");
    w.className = cls; w.textContent = "·";
    w.style.cssText = "width:20px;height:20px";
    host.appendChild(w);
    const d = getComputedStyle(w).display;
    w.remove();
    return d;
  };

  // ── وما داخل حاوية ملء الشاشة: أهي العنوان والقناة وحدهما؟ ───────────────
  const metaBox = document.querySelector(".ytp-fullscreen-metadata");
  const metaLeaves = [];
  if (metaBox) {
    for (const el of metaBox.querySelectorAll("*")) {
      if (el.childElementCount !== 0) continue;
      const t = (el.textContent || "").trim();
      if (!t) continue;
      metaLeaves.push({ text: t.slice(0, 40), visible: visible(el), desc: desc(el) });
    }
  }

  const sel = (s) => { const el = document.querySelector(s);
    return el ? { desc: desc(el), box: box(el), visible: visible(el),
                  display: getComputedStyle(el).display } : null; };
  return {
    title,
    fsElement: document.fullscreenElement ? desc(document.fullscreenElement) : null,
    playerClasses: (document.querySelector("#movie_player")?.className || "").slice(0, 160),
    hits,
    ours: { ytpTitle: sel(".ytp-title"), ytpTitleChannel: sel(".ytp-title-channel"),
            chromeTop: sel(".ytp-chrome-top") },
    witnessYtpTitle: witness("ytp-title"),
    witnessNeutral: witness("vz-not-a-yt-class"),
    meta: metaBox ? { desc: desc(metaBox), box: box(metaBox), visible: visible(metaBox),
                      display: getComputedStyle(metaBox).display, leaves: metaLeaves } : null,
    cssTag: !!document.getElementById("vz_clean_player_css"),
    cssHasTitles: (document.getElementById("vz_clean_player_css")?.textContent || "").includes(".ytp-title")
  };
})()`;

async function move(page, x, y) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
}

// **الإيماءة تُصطنع بـ`userGesture`** — نقرةٌ بـ`Input` لا تُحتسب إيماءةً
// (مقيسٌ في `repro-58-fullscreen.mjs`، ولا يُعاد اكتشافه).
async function enterFullscreen(page) {
  const byButton = await evalIn(page, `(() => {
    const b = document.querySelector(".ytp-fullscreen-button");
    if (!b) return "لا زرّ";
    b.click(); return "زرّ المضيف";
  })()`);
  return byButton;
}

async function run(titlesOn) {
  const out = { titlesOn, steps: {} };
  let h = null, page = null;
  try {
    h = await launch(PORT, { extra: ["--window-size=1440,900"] });
    const cfg = await configure(PORT, h.extensionId, settings(titlesOn));
    if (!cfg.ok) { out.why = "تعذّر ضبط التخزين"; return out; }
    page = await openPage(PORT, WATCH);
    await sleep(7000);
    out.world = await contentWorld(page);
    // تحريكٌ موثوق كي يظهر شريط المضيف وعنوانه العلويّ
    await move(page, 700, 300); await sleep(200); await move(page, 702, 302);
    await sleep(600);
    out.steps.normal = await evalIn(page, PROBE);

    // ⚠️ **الاستطلاع بدل المهلة** (قرار 50): يُنتظر تبدّل التخطيط ويُتحقَّق منه.
    out.fsPath = await evalIn(page, `(() => {
      const b = document.querySelector(".ytp-fullscreen-button"); if (!b) return "لا زرّ";
      b.click(); return "زرّ المضيف"; })()`, undefined);
    // الإيماءة الحقيقية — `Runtime.evaluate` بـ`userGesture`
    const r = await page.send("Runtime.evaluate", {
      expression: `(() => { const b = document.querySelector(".ytp-fullscreen-button");
        if (b) { b.click(); return "زرّ المضيف"; }
        const p = document.querySelector("#movie_player");
        if (p && p.requestFullscreen) { p.requestFullscreen(); return "requestFullscreen"; }
        return "تعذّر"; })()`,
      userGesture: true, returnByValue: true, awaitPromise: true
    });
    out.fsPath = r?.result?.result?.value || "تعذّر";
    for (let i = 0; i < 20; i++) {
      const fs = await evalIn(page, `!!document.fullscreenElement`);
      if (fs) break;
      await sleep(300);
    }
    await move(page, 700, 400); await sleep(200); await move(page, 703, 404);
    await sleep(900);
    out.steps.fullscreen = await evalIn(page, PROBE);
    return out;
  } catch (e) {
    out.why = String(e?.message || e).slice(0, 150);
    return out;
  } finally {
    try { page?.ws?.close(); } catch {}
    killChrome(h);
    await waitPortFree(PORT);
  }
}

const on = await run(true);
const off = await run(false);

if (AS_JSON) { console.log(JSON.stringify({ on, off }, null, 2)); process.exit(0); }

const yn = (b) => (b ? "نعم" : "لا");
function show(label, st) {
  console.log(`\n   ── ${label}`);
  if (!st) { console.log("      — لا قياس"); return; }
  console.log(`      عنصر ملء الشاشة : ${st.fsElement || "— (لسنا فيه)"}`);
  console.log(`      أصناف المشغّل   : ${st.playerClasses.slice(0, 120)}`);
  console.log(`      ورقةُ نصٍّ تساوي العنوان: ${st.hits.length}`);
  for (const hΩ of st.hits) {
    console.log(`         · ${hΩ.desc}  ${JSON.stringify(hΩ.box)} · مرئيّ ${yn(hΩ.visible)}` +
      ` · display=${hΩ.display} · **يطابقه محدِّدُنا** ${yn(hΩ.matchedByOurs)}` +
      ` · داخل chrome-top ${yn(hΩ.inChromeTop)}`);
    console.log(`           سلسلته: ${hΩ.chain.join(" ⇐ ")}`);
  }
  const o = st.ours;
  console.log(`      .ytp-title        : ${o.ytpTitle ? `${o.ytpTitle.desc} · مرئيّ ${yn(o.ytpTitle.visible)} · display=${o.ytpTitle.display} · ${JSON.stringify(o.ytpTitle.box)}` : "لا وجود"}`);
  console.log(`      .ytp-title-channel: ${o.ytpTitleChannel ? `مرئيّ ${yn(o.ytpTitleChannel.visible)} · display=${o.ytpTitleChannel.display}` : "لا وجود"}`);
  console.log(`      .ytp-chrome-top   : ${o.chromeTop ? `مرئيّ ${yn(o.chromeTop.visible)} · display=${o.chromeTop.display} · ${JSON.stringify(o.chromeTop.box)}` : "لا وجود"}`);
  console.log(`      ورقة أنماطنا     : ${yn(st.cssTag)} · وفيها .ytp-title: ${yn(st.cssHasTitles)}`);
  console.log(`      شاهدُ أثرِنا      : عنصرٌ مُفتعَل بصنف .ytp-title ⇒ display=${st.witnessYtpTitle}` +
    ` · وبصنفٍ محايد ⇒ display=${st.witnessNeutral}`);
  if (st.meta) {
    console.log(`      ‏.ytp-fullscreen-metadata: مرئيّ ${yn(st.meta.visible)} · display=${st.meta.display}` +
      ` · ${JSON.stringify(st.meta.box)}`);
    for (const lf of st.meta.leaves) console.log(`         · «${lf.text}» مرئيّ ${yn(lf.visible)} · ${lf.desc}`);
  } else { console.log("      ‏.ytp-fullscreen-metadata: لا وجود"); }
}

console.log("\n=== قياس #91 — عنوان الفيديو في ملء الشاشة ===");
for (const run0 of [on, off]) {
  console.log(`\n── المفتاح ${run0.titlesOn ? "**مُشغَّل**" : "**مطفأ** (الشاهد السالب)"}` +
    ` · العالم ${run0.world ? "✅" : "❌"} · طريق ملء الشاشة: ${run0.fsPath || "—"}`);
  if (run0.why) console.log(`   ⚠️ ${run0.why}`);
  show("الحالة العادية", run0.steps.normal);
  show("ملء الشاشة", run0.steps.fullscreen);
}

const onN = on.steps.normal, offN = off.steps.normal;
const posOk = !!(onN && onN.witnessYtpTitle === "none" && onN.witnessNeutral !== "none" && onN.cssTag);
const negOk = !!(offN && offN.witnessYtpTitle !== "none");
console.log("\n── الشاهدان — **على عنصرٍ من صنعنا، فيُقرأ أثرُ قاعدتنا وحدها**");
console.log(`   الموجب : ${posOk ? "✅ المفتاح مُشغَّلاً ⇒ صنفُ .ytp-title يُخفى وصنفٌ محايد لا يُخفى" : "❌ **ساقط** — قاعدتنا لا تصل، فلا يُقاس شيء عليها"}`);
console.log(`   السالب : ${negOk ? "✅ ومطفأً ⇒ الصنف نفسه لا يُخفى — فالإخفاء أثرُنا لا أثر المضيف" : "❌ **ساقط** — لا يُميَّز أثرُنا من أثر المضيف"}`);
console.log(`   ⇒ ${posOk && negOk ? "**القياس صالح**" : "**القياس غير صالح — لا يُبنى عليه بند**"}`);

// ── ⛔⭐ **الامتناعُ يُلزم الكودَ الذي يليه** (#104، أُصلح 2026-08-04) ─────────
// **العطب بنصّه:** كان يطبع السطرَ أعلاه — **«القياس غير صالح — لا يُبنى عليه
// بند»** — **ثمّ يمضي فيطبع «❌ #91 قائم» في السطر التالي**، فيتّهم **بنداً
// مغلقاً مؤكَّداً من المالك** بقياسٍ **أعلن هو بطلانه**.
// ⇒ ⭐ **وهو أسوأ من الابتلاع: الابتلاعُ يصمت، وهذا يقول «لا تصدّقني» ثمّ يتّهم.**
// ⇒ **وأخوه #103 من بابٍ آخر: هناك حالةٌ تُسجَّل ولا مُنادي، وهنا امتناعٌ يُعلَن
// ولا مُلزَم — وكلاهما «قِيل ولم يُنفَّذ»، والقولُ وحده لا يُغيّر مساراً.**
// ⚠️ **والامتناعُ لا يُقلب حكماً على المنتَج** (قرار المالك في #65): يخرج برمزٍ
// غيرِ صفر **لأنه لم يُنتج ما طُلب منه**، ⛔ **ولا يُطبع معه اتّهامٌ لبند**.
if (!(posOk && negOk)) {
  console.log("\n⚪ **امتنع — ولا حكم على #91**: القياس أُعلن باطلاً أعلاه.");
  console.log("   ⛔ **ولا يُطبع حكمٌ على البند** — ومغلقٌ مؤكَّدٌ من المالك لا يُتّهم");
  console.log("      بقياسٍ أعلن الرِكازُ نفسُه بطلانه (#104).");
  console.log("   ⇒ **والسببُ الغالبُ مقيس: المضيف لم يُعطِ فيديو** — فيُعاد على شجرةٍ يعمل فيها.\n");
  process.exit(1);
}

// ── حكم #91 نفسه — **والرِكاز حارسٌ لا مِجَسّ بعد الإصلاح** ─────────────────
const onF = on.steps.fullscreen, offF = off.steps.fullscreen;
const hiddenOn = !!(onF && onF.meta && !onF.meta.visible);
const shownOff = !!(offF && offF.meta && offF.meta.visible);
console.log("\n── #91 — عنوان ملء الشاشة");
console.log(`   المفتاح مُشغَّلاً : ${onF?.meta ? `مرئيّ ${onF.meta.visible ? "نعم ❌" : "لا ✅"} · ${JSON.stringify(onF.meta.box)}` : "لا حاوية"}`);
console.log(`   ومطفأً          : ${offF?.meta ? `مرئيّ ${offF.meta.visible ? "نعم ✅" : "لا ⚠️"} · ${JSON.stringify(offF.meta.box)}` : "لا حاوية"}`);
console.log(`   ⇒ ${hiddenOn && shownOff
  ? "✅ **المفتاح صار يفي بوعده حيث يراه المستخدم**"
  : "❌ **#91 قائم** — والمفتاح يَعِد ولا يفي"}`);
console.log("");
process.exit(posOk && negOk && hiddenOn && shownOff ? 0 : 1);
