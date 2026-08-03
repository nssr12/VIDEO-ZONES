// قياس #92 — أثمّة عنصرٌ في الـDOM يقابل «للخروج من وضع ملء الشاشة اضغط esc»؟
//
//   node tools/bench-92-esc.mjs
//
// ⚠️ **قياسٌ لا بناء (أمر المالك)، ولا محدّدات على العمياء.** السؤال واحد: **هل
// يُنتج المستندُ عنصراً يحمل هذا النصّ؟** — فإن لم يُنتجه فلا مفتاح، **ويُسجَّل
// «غير ممكن» بسببه المقيس** لا بحدسٍ عنه.
//
// ── كيف يُسأل بلا تخمين محدِّد ───────────────────────────────────────────────
// **يُمسح المستند كلُّه بالنصّ** (وبثلاث لغات محتملة للواجهة) لا بصنفٍ نظنّه،
// **وداخل جذور الظلّ أيضاً** — فبعض المضيفين يرسم لافتاته فيها.
// ⚠️ **والعيّنة ثلاث لحظات**: اللافتة تظهر ثم تذوي، **فعيّنةٌ واحدة متأخّرة تطبع
// صفراً عن شيءٍ كان موجوداً** (قرار 22: لا يُقرأ قبل أن يستقرّ المقيس، ولا بعد
// أن يزول).
//
// ── شاهدا القبول (قرار 26) — **وبلا الموجب لا معنى للصفر** ──────────────────
//  · **موجب:** يُدسّ في الصفحة عنصرٌ يحمل النصّ نفسه ⇒ **يجب أن يجده المسح**.
//  · **سالب:** ويُزال ⇒ **يجب أن يعود الصفر**. فالصفر حينها **خبرٌ لا عمى**.
import { launch, openPage, evalIn, killChrome, waitPortFree } from "./ext-harness.mjs";

const PORT = 9795;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

// ⚠️ **المفتاح النصّيّ يُضيَّق بحدّ الكلمة — وعيبٌ وقع وأُصلح:** كان «esc» مفتاحاً
// حرّاً **فطابق عنوان فيديو فيه «Rescued»** وطُبع «ثمّة عنصر». ⇒ **مطابقةٌ أوسع
// من سؤالها تُنتج إثباتاً كاذباً، وهي أخطر من الصفر الكاذب** لأنها تُغري ببناء.
// فصار: **عباراتٌ كاملة** كما يكتبها كروم، **و«esc» بحدّ كلمة لا بحرفٍ داخل كلمة**.
const PHRASES = ["اضغط esc", "للخروج من وضع ملء الشاشة", "اضغط على esc",
                 "press esc", "exit full screen", "exit fullscreen", "press escape"];

const SCAN = `((needles) => {
  const vis = (el) => { if (!el || el.nodeType !== 1) return false;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" &&
           Number(cs.opacity) > 0 && r.width > 0 && r.height > 0; };
  const desc = (el) => (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string"
      ? "." + String(el.className).trim().split(/\\s+/).slice(0, 3).join(".") : "")).slice(0, 70);
  const hits = [];
  const roots = [document];
  const seenRoots = new Set();
  // مسحُ جذور الظلّ أيضاً — لافتةٌ فيها لا يراها مسحٌ سطحيّ
  const collect = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.shadowRoot && !seenRoots.has(el.shadowRoot)) { seenRoots.add(el.shadowRoot); roots.push(el.shadowRoot); }
    }
  };
  collect(document);
  for (let i = 0; i < roots.length && i < 400; i++) {
    const root = roots[i];
    if (root !== document) collect(root);
    for (const el of root.querySelectorAll("*")) {
      if (el.childElementCount !== 0) continue;                    // ورقةٌ لا حاوية
      const t = (el.textContent || "").trim();
      if (!t || t.length > 120) continue;
      const low = t.toLowerCase();
      let hit = needles.find((n) => low.includes(n.toLowerCase()));
      let tier = hit ? "عبارة" : null;
      if (!hit && /\besc\b|\bescape\b/i.test(low)) { hit = "esc (بحدّ كلمة)"; tier = "كلمة"; }
      if (!hit) continue;
      hits.push({ needle: hit, tier, text: t.slice(0, 80), desc: desc(el), visible: vis(el),
                  inShadow: root !== document });
    }
  }
  return {
    fs: !!document.fullscreenElement,
    fsDesc: document.fullscreenElement ? desc(document.fullscreenElement) : null,
    shadowRoots: seenRoots.size,
    elements: document.querySelectorAll("*").length,
    hits
  };
})(${JSON.stringify(PHRASES)})`;

const out = { samples: [], witness: {} };
let h = null, page = null;
try {
  h = await launch(PORT, { extra: ["--window-size=1440,900"] });
  out.chrome = h.chrome;
  page = await openPage(PORT, WATCH);
  await sleep(7000);

  // ── الشاهدان أوّلاً، **قبل أي صفرٍ يُطبع** ───────────────────────────────
  out.witness.before = await evalIn(page, SCAN);
  await evalIn(page, `(() => {
    const d = document.createElement("div");
    d.id = "vz-esc-witness";
    d.textContent = "للخروج من وضع ملء الشاشة اضغط esc";
    d.style.cssText = "position:fixed;top:20px;left:20px;width:300px;height:30px;z-index:9";
    document.body.appendChild(d); })()`);
  out.witness.planted = await evalIn(page, SCAN);
  await evalIn(page, `document.getElementById("vz-esc-witness")?.remove()`);
  out.witness.removed = await evalIn(page, SCAN);

  // ── ثمّ ملء الشاشة، بإيماءةٍ حقيقية ─────────────────────────────────────
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
    if (await evalIn(page, `!!document.fullscreenElement`)) break;
    await sleep(200);
  }
  // ثلاث لحظات: اللافتة تظهر ثمّ تذوي
  for (const ms of [300, 1000, 2500]) {
    await sleep(ms === 300 ? 300 : 700);
    out.samples.push({ at: ms, scan: await evalIn(page, SCAN) });
  }
} catch (e) {
  out.why = String(e?.message || e).slice(0, 150);
} finally {
  try { page?.ws?.close(); } catch {}
  killChrome(h);
  await waitPortFree(PORT);
}

const yn = (b) => (b ? "نعم" : "لا");
console.log("\n=== قياس #92 — لافتة «اضغط esc» ===");
console.log(`   كروم: ${out.chrome || "—"} · طريق ملء الشاشة: ${out.fsPath || "—"}`);
if (out.why) console.log(`   ⚠️ ${out.why}`);

console.log("\n── الشاهدان (قبل ملء الشاشة، على نصٍّ ندسّه نحن)");
for (const [k, label] of [["before", "قبل الدسّ"], ["planted", "وبعده"], ["removed", "وبعد إزالته"]]) {
  const s = out.witness[k];
  console.log(`   ${label.padEnd(12)}: ${s ? `${s.hits.length} مطابقة · عناصر ${s.elements} · جذور ظلّ ${s.shadowRoots}` : "—"}`);
}
const posOk = (out.witness.planted?.hits || []).some((x) => x.desc.includes("vz-esc-witness"));
const negOk = !(out.witness.removed?.hits || []).some((x) => x.desc.includes("vz-esc-witness"));

console.log("\n── العيّنات داخل ملء الشاشة");
for (const s of out.samples) {
  console.log(`   عند ${String(s.at).padStart(4)}ms: داخل ملء الشاشة ${yn(s.scan?.fs)}` +
    ` (${s.scan?.fsDesc || "—"}) · مطابقات ${s.scan?.hits.length ?? "—"}`);
  for (const hΩ of s.scan?.hits || []) {
    console.log(`      · «${hΩ.text}» ${hΩ.desc} · مرئيّ ${yn(hΩ.visible)} · في ظلّ ${yn(hΩ.inShadow)} · [${hΩ.tier}] «${hΩ.needle}»`);
  }
}

// **المرئيّ وحده يُحسب**: نصٌّ مخفيّ ليس لافتةً يراها المستخدم (شرط الرؤية المقيس).
const visHits = out.samples.flatMap((s) => (s.scan?.hits || []).filter((x) => x.visible));
const anyHit = visHits.length > 0;
const enteredFs = out.samples.some((s) => s.scan?.fs);
console.log("\n── الحكم");
console.log(`   الشاهد الموجب : ${posOk ? "✅ المسح يرى نصّاً مدسوساً" : "❌ **ساقط** — فلا يُقرأ صفرُه نفياً"}`);
console.log(`   الشاهد السالب : ${negOk ? "✅ ويعود صفراً بزواله" : "❌ **ساقط**"}`);
console.log(`   دخل ملء الشاشة: ${enteredFs ? "✅" : "❌ **لم يدخل — فلم تُنتَج الحال أصلاً ولا يُنفى شيء**"}`);
console.log(`   ⇒ ${!posOk || !negOk || !enteredFs ? "**لا يُبنى على هذا القياس**"
  : anyHit ? "**ثمّة عنصرٌ مرئيّ** — يُقرأ أعلاه" : "**لا عنصر مرئيّ في المستند يحمل نصّ اللافتة**"}\n`);
process.exit(posOk && negOk && enteredFs ? 0 : 1);
