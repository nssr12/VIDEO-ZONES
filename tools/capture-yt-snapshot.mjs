// #112 (المرحلة أ) — **يلتقط لقطةً محفوظةً من شجرة يوتيوب الحقيقيّة وأنماطِها.**
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«العطبُ الذي لا يظهر إلا في مشغّل
// يوتيوب — أيمكن أن يُمسَك قبل أن أفتحه بيدي؟»*
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):** **يفتح يوتيوب حيّاً
// مرّةً واحدةً ليصنع اللقطة** — **وهو الشيءُ الذي بُنيت اللقطةُ لتفاديه**، فلا
// يُشغَّل إلا حين تُصنع أو تُجدَّد. **ومُطلِقُه: تقادمُ اللقطة** (أدناه).
//
// ⚠️ **ولماذا لقطةٌ أصلاً:** قيادةُ يوتيوب حيّاً **حجبت رأسَنا المقطوع أربعَ
// مرّاتٍ مقيسة** (بثّان · تضمين · وصفحةٌ لم تُبنَ) — **واللقطةُ تُقدَّم بلا شبكةٍ
// ولا حجب.**
//
//   node tools/capture-yt-snapshot.mjs                # يلتقط ويكتب الملفّ
//   node tools/capture-yt-snapshot.mjs --dry          # يقيس ولا يكتب
import fs from "node:fs";
import path from "node:path";
import { launch, openPage, evalIn, killChrome, ROOT } from "./ext-harness.mjs";

const PORT = 9798;
const DRY = process.argv.includes("--dry");
// ⭐⭐ **حالُ ملء الشاشة تُلتقط شجرةً بلا أنماط** — **والثمنُ قِيس قبل البناء:**
// **الأنماط 4.4MB من أصل 4.9، والشجرةُ ~0.5MB** ⇒ **وتكرارُها تكرارُ ما لا
// يتكرّر.** ✅ **وشرطُه قِيس ولم يُفترض: بصمةُ الأنماط في الحالين واحدة**
// (`18f59329260261f8` · 4400548 بايت في الحالين) — **من الصفحة والبناء نفسِهما.**
// ⛔ **ولو اختلفت لَوقف البناءُ ولم يُقدَّر الفرق.**
const FULL = process.argv.includes("--fullscreen");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

// **اسمُ الحال في اسم الملفّ** — ⛔ **ولا يُقال «يوتيوب» مطلقاً**: اللقطةُ حالٌ
// واحدة من حالاته (صفحةُ مشاهدة · شريطٌ صاحٍ · بلا حساب · عربيّة · نافذة).
const STATE = (process.argv.includes("--fullscreen")
  ? "watch-fullscreen-controls-visible-signed-out-ar"
  : "watch-controls-visible-signed-out-ar");
const OUT_DIR = path.join(ROOT, "tools", "snapshots");

const mouseMove = (c, x, y) => c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });

// ⛔⭐ **تُنتَج الحالُ ويُتحقَّق منها قبل الالتقاط** (قرار 22 · 125): شريطُ يوتيوب
// **يخبو من تلقائه**، **ولقطةٌ تُلتقط وهو خابٍ تحفظ حالاً غير التي تدّعيها.**
const CAPTURE = (withCss) => `(() => {
  const WITH_CSS = ${withCss};
  const meta = { at: null, sheets: { readable: 0, blocked: 0, blockedHrefs: [] } };
  const parts = [];
  // ⭐ **حالُ ملء الشاشة تُحفظ شجرةً بلا أنماط** — والأنماطُ تُقدَّم من اللقطة
  // الأولى: **بصمتُهما واحدةٌ مقيسةً قبل البناء** ⇒ **فتكرارُها تكرارُ ما لا يتكرّر.**
  if (WITH_CSS) for (const s of document.styleSheets) {
    try {
      const rules = [...s.cssRules].map((r) => r.cssText).join("\\n");
      meta.sheets.readable++;
      parts.push(rules);
    } catch (e) {
      // ⚠️ **ما لا يُقرأ يُسجَّل باسمه** — **حدٌّ مكتوب لا فجوةٌ صامتة**
      meta.sheets.blocked++;
      meta.sheets.blockedHrefs.push(String(s.href || "").slice(0, 120));
    }
  }
  const doc = document.documentElement.cloneNode(true);
  // ⛔ **يُنزع ما يُعيد بناءَ الشجرة أو يطلب الشبكة** — والسكربتاتُ أوّلُها
  for (const sel of ["script", "link[rel='stylesheet']", "iframe", "noscript"]) {
    for (const el of doc.querySelectorAll(sel)) el.remove();
  }
  for (const v of doc.querySelectorAll("video")) { v.removeAttribute("src"); }
  const style = document.createElement("style");
  style.setAttribute("data-vz-snapshot-css", String(meta.sheets.readable));
  style.textContent = parts.join("\\n");
  (doc.querySelector("head") || doc).appendChild(style);
  const q = (s) => document.querySelectorAll(s).length;
  meta.anchors = { ytp: q('[class*="ytp-"]'), rightControls: q(".ytp-right-controls"),
                   bottom: q(".ytp-chrome-bottom"), settings: q(".ytp-settings-button"),
                   leftControls: q(".ytp-left-controls"), video: q("video"),
                   moviePlayer: q("#movie_player") };
  meta.build = (document.querySelector("#movie_player")?.dataset?.version || "");
  meta.htmlAttrs = { lang: document.documentElement.lang, dir: document.documentElement.dir };
  meta.url = location.href;
  // ⛔⭐⭐ XMLSerializer لا outerHTML — والسببُ مقيس: الشجرةُ الحيّة تحمل
  // button داخل button (شارةُ الإجراء المقترح)، ومحلِّلُ HTML يُغلق الخارجيَّ
  // عندها ⇒ movie_player يُغلق مبكّراً: 10 أبناءٍ بدل 36، والشريطُ يخرج من
  // نطاقه ⇒ فيسقط حقنُنا إلى الطبقة ويُقاس سلوكٌ غيرُ سلوك المضيف.
  // ⭐ ومحلِّلُ XML بلا قواعدِ محتوىً فينجو التداخلُ بحروفه — ولا يُصلَح المصدرُ
  // بيد، فذاك لقطةٌ تكذب.
  const mp = document.querySelector("#movie_player");
  meta.liveShape = { moviePlayerChildren: mp ? mp.children.length : 0,
                     barInsidePlayer: !!(mp && mp.contains(document.querySelector(".ytp-right-controls"))) };
  // ⛔⭐⭐ **ما أُنتج قبل الالتقاط يُسجَّل بعينه لا باسم الحال** (شرط المالك):
  // **من قرأ «ملء الشاشة» لا يعرف أيَّ الأقسام كانت ظاهرةً حين التُقطت** —
  // **واللقطةُ تُجمّد ما كتبه سكربتُ المضيف في العنصر لحظتَها إلى الأبد.**
  const seen = (s) => { const e = document.querySelector(s);
    return e ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : null; };
  // ⛔⭐⭐ **شروطُ إعادة التشغيل تُسجَّل هنا لا تُخمَّن هناك** (2026-08-07):
  // **اللقطةُ تُجمّد خرْجَ سكربتِ المضيف، وذاك الخرْجُ صحيحٌ في شرطَي التقاطه
  // وحدَهما** — **فالمنظورُ جزءٌ من الحال المُلتقَطة لا ظرفٌ حولها، وكذلك أن تكون
  // في ملء الشاشة وعلى أيّ عنصر.** ⇒ **والرِكازُ يقرؤها من هنا ولا يُثبّت رقماً.**
  // ⚠️ **والعنصرُ يُسجَّل محدِّداً لا علماً**: «movie_player» وحدَه أعاد التخطيط،
  // **و«ytd-app» و«html» جُرّبا فلم يتغيّر شيء** ⇒ **فاسمُ العنصر خبرٌ لازم.**
  // ⛔ **ولا علامةَ اقتباسٍ خلفية في هذي الكتلة: نحن داخل قالبٍ نصّيّ** — وقد
  // أُغلق القالبُ بها فعلاً، **وأمسكه «lint-names» لا «node --check»** —
  // ⭐ **ثمّ أُغلق ثانيةً في التحذير المكتوب ضدّه** (قرار 93: شرحُ خطأٍ يُعيد الخطأ).
  meta.replay = { viewport: { w: innerWidth, h: innerHeight },
    fullscreenSelector: document.fullscreenElement
      ? (document.fullscreenElement.id ? "#" + document.fullscreenElement.id
                                       : document.fullscreenElement.tagName.toLowerCase())
      : null,
    سند: "مسجَّلٌ عند الالتقاط" };
  meta.produced = { ملءُ_شاشة: !!document.fullscreenElement,
    شريطٌ_سفليّ: seen(".ytp-chrome-bottom"), عنوان: seen(".ytp-fullscreen-metadata"),
    صفُّ_إجراءات: seen(".ytp-fullscreen-quick-actions"),
    زرُّ_المزيد: seen(".ytp-fullscreen-grid-expand-button"),
    وضعُ_السينما: seen(".ytp-size-button"), قائمةُ_الإعدادات: seen(".ytp-settings-menu") };
  return { xml: new XMLSerializer().serializeToString(doc), meta };
})()`;

let h = null;
try {
  h = await launch(PORT, { withExtension: false, extra: ["--window-size=1600,1000"] });
  const p = await openPage(PORT, WATCH);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    ready = await evalIn(p, `(() => { const v = document.querySelector("video");
      return !!(v && v.readyState >= 2 && v.getBoundingClientRect().width > 0); })()`);
    if (ready) break;
    await sleep(500);
  }
  if (!ready) throw new Error("لم يستقرّ المشغّل — لا تُلتقط حالٌ لم تُنتَج");

  // إيقاظُ الشريط والتحقّقُ منه — لا التقاطَ على شريطٍ خابٍ
  let awake = false;
  const c = await evalIn(p, `(() => { const el = document.querySelector("#movie_player");
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
  for (let i = 0; i < 8 && c; i++) {
    await mouseMove(p, c.x + (i % 2 ? 5 : -5), c.y + 3);
    await sleep(220);
    awake = await evalIn(p, `(() => { const el = document.querySelector(".ytp-chrome-bottom");
      if (!el) return false; const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      return !(cs.display === "none" || cs.visibility === "hidden" ||
               parseFloat(cs.opacity) === 0 || r.width === 0 || r.height === 0); })()`);
    if (awake) break;
  }
  if (!awake) throw new Error("الشريطُ لم يستيقظ — واللقطةُ تدّعي حالاً غيرَ التي فيها");

  // ── ⛔⭐ حالُ ملء الشاشة تُنتَج بزرّ المضيف نفسِه ويُتحقَّق منها ──────────
  if (FULL) {
    // ⚠️ **يُعاد الإيقاظُ لحظةَ النقرة لا قبلها بثوانٍ**: الشريطُ يخبو من تلقائه،
    // **ومستطيلٌ غيرُ صفريّ بشفافيةٍ صفر يقبل الحساب ولا يقبل النقر** ⇒ **فأوّلُ
    // تشغيلةٍ لم تدخل ملءَ الشاشة** (وهو الأعمى الأوّل في قرار 26، في القيادة لا القراءة).
    let fsb = null;
    for (let i = 0; i < 8 && !fsb; i++) {
      if (c) await mouseMove(p, c.x + (i % 2 ? 5 : -5), c.y + 3);
      await sleep(200);
      fsb = await evalIn(p, `(() => { const el = document.querySelector(".ytp-fullscreen-button");
        if (!el || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null;
        const r = el.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return null;
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    }
    if (!fsb) throw new Error("زرُّ ملء الشاشة غيرُ مرئيّ — لا تُلتقط حالٌ لم تُنتَج");
    await p.send("Input.dispatchMouseEvent", { type: "mousePressed", x: fsb.x, y: fsb.y, button: "left", clickCount: 1 });
    await p.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: fsb.x, y: fsb.y, button: "left", clickCount: 1 });
    await sleep(2500);
    let inFs = await evalIn(p, `!!document.fullscreenElement`);
    if (!inFs) {
      // ⚠️ **بلاغٌ يقول ما رآه لا «فشل»** — والنقرةُ قد تقع ولا يستجيب المضيف
      const why = await evalIn(p, `(() => { const b = document.querySelector(".ytp-fullscreen-button");
        const r = b ? b.getBoundingClientRect() : null;
        return { زرّ: !!b, مرئيّ: b ? b.checkVisibility({opacityProperty:true}) : null,
                 مستطيل: r ? Math.round(r.width)+"x"+Math.round(r.height)+"@"+Math.round(r.left)+","+Math.round(r.top) : null,
                 تحتَ_النقطة: (() => { const e = document.elementFromPoint(${fsb.x}, ${fsb.y});
                   return e ? (e.tagName+"."+String(e.className).slice(0,40)) : null; })(),
                 منظور: innerWidth+"x"+innerHeight }; })()`);
      console.log("  ⚠️ لم يدخل ملءَ الشاشة — والمقيس: " + JSON.stringify(why));
      // ⭐ **ومسارٌ ثانٍ مُعلَن: مفتاح `f`** — وهو ما يفعله المستخدم كذلك
      await p.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "f", code: "KeyF", windowsVirtualKeyCode: 70, nativeVirtualKeyCode: 70 });
      await p.send("Input.dispatchKeyEvent", { type: "keyUp", key: "f", code: "KeyF", windowsVirtualKeyCode: 70, nativeVirtualKeyCode: 70 });
      await sleep(2000);
      inFs = await evalIn(p, `!!document.fullscreenElement`);
      console.log("  ⇒ بمفتاح f: " + (inFs ? "دخل" : "لم يدخل"));
    }
    if (!inFs) throw new Error("لم يدخل ملءَ الشاشة — ولا تُسمّى لقطةٌ بحالٍ لم تقع");
    // ويُعاد إيقاظُ الشريط في الحال الجديدة — المركزُ تبدّل
    const c2 = await evalIn(p, `(() => { const el = document.querySelector("#movie_player");
      if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    let awake2 = false;
    for (let i = 0; i < 8 && c2; i++) {
      await mouseMove(p, c2.x + (i % 2 ? 5 : -5), c2.y + 3);
      await sleep(220);
      awake2 = await evalIn(p, `(() => { const el = document.querySelector(".ytp-chrome-bottom");
        if (!el) return false;
        return el.checkVisibility({ opacityProperty: true, visibilityProperty: true }); })()`);
      if (awake2) break;
    }
    if (!awake2) throw new Error("الشريطُ لم يستيقظ في ملء الشاشة — واللقطةُ تدّعي حالاً غيرَها");
  }

  const cap = await evalIn(p, CAPTURE(!FULL));
  try { p.ws.close(); } catch {}

  const stamp = new Date(fs.statSync(path.join(ROOT, "manifest.json")).mtime).toISOString().slice(0, 10);
  const today = process.env.VZ_SNAP_DATE || stamp;
  const meta = { ...cap.meta, chrome: h.chrome, state: STATE, capturedAt: today };
  const header = [
    "<!--",
    "  ⛔ لقطةٌ محفوظة — **ليست يوتيوب**: حالٌ واحدة من حالاته.",
    `  الحال: ${STATE}`,
    `  التقطت: ${today} · كروم ${h.chrome}`,
    `  بناءُ المشغّل: ${meta.build}`,
    `  أوراقُ الأنماط: ${meta.sheets.readable} مقروءة · ${meta.sheets.blocked} محجوبة` +
      (meta.sheets.blockedHrefs.length ? ` (${meta.sheets.blockedHrefs.join(" · ")})` : ""),
    `  المراسي: ${JSON.stringify(meta.anchors)}`,
    `  شروطُ إعادة التشغيل: منظور ${meta.replay.viewport.w}×${meta.replay.viewport.h}` +
      ` · ملءُ الشاشة على ${meta.replay.fullscreenSelector || "لا شيء"}`,
    "  ⛔ **وهما شرطان لا ظرف**: الشجرةُ تحمل خرْجَ سكربتِ المضيف مُجمَّداً،",
    "     **وهو صحيحٌ فيهما وحدَهما** — يقرؤهما الرِكازُ من `.meta.json`.",
    "",
    "  ── ⚠️ حدودٌ أربعةٌ تُقرأ قبل أي رقمٍ يُبنى عليها ──────────────────────",
    "  (١) **نسخةٌ تتقادم**: يوتيوب يُغيّر شجرتَه. الكشفُ: `node tools/snapshot-freshness.mjs`",
    "      يقارن بناءَ المشغّل والمراسي — **ويفرّق ثلاثاً: مطابِقة · مختلفة · لم أستطع",
    "      الفحص** ⇒ **والثالثةُ لا تُقرأ طزاجة**. ومُطلِقُ التحديث: اختلافٌ مؤكَّد،",
    "      أو أحمرُ رِكازٍ يعتمد عليها. ⛔ ولا آليّةَ تحديثٍ آليّة اليوم.",
    "  (٢) **لا فيديو يعمل فيها**: كلُّ ما يحتاج تشغيلاً (محوّلاتُ الصوت #60 ·",
    "      الجودة #19 · ما يتبع timeupdate) **يبقى غيرَ مقيسٍ عليها** — و#112 يضيق",
    "      نطاقُه ولا يُغلق بها.",
    "  (٣) **حالٌ واحدة**: صفحةُ مشاهدة · شريطٌ صاحٍ · بلا حساب · عربيّة · نافذة —",
    "      **ولا يُقال «يوتيوب» مطلقاً**، والاسمُ يحمل الحال.",
    "  (٤) ⛔ **السكربتاتُ منزوعة** ⇒ **لا انتقالَ SPA ولا إعادةَ بناءٍ من المضيف.**",
    "      **وعائلةٌ كاملة من عيوبنا لا تُقاس هنا، وتُسمّى بأمثلتها لا بوصفها:**",
    "        · تبدُّلُ مصدر الفيديو بلا تبدُّل العنصر (العنصرُ نفسُه ومحتوىً آخر)",
    "        · الفلترُ الذي لا يزول بعد الانتقال إلى فيديوٍ ثانٍ",
    "        · تحويلُ Shorts إلى watch، وكلُّ ما يعلَّق على yt-navigate-finish",
    "        · وإعادةُ حقنِ زرّنا حين يُعيد يوتيوب بناءَ شريطه",
    "",
    "  ⚠️ وحجمُها في التاريخ: **git يحفظ كلَّ نسخةٍ إلى الأبد** — فتحديثُها لا",
    "  يستبدل حجمَها بل **يُضيفه**. ⇒ **أربعُ تجديداتٍ في سنةٍ تُضيف نحوَ عشرين",
    "  ميغابايت إلى تاريخ المستودع** — **وهو قرارٌ يُتّخذ بعلمه لا يُكتشف بعده.**",
    "  ⚠️ **وتُقدَّم `application/xhtml+xml`**: محلِّلُ HTML يكسر شجرتَها (button",
    "  داخل button) فيُخرج شريطَ التحكّم من نطاق المشغّل — مقيسٌ: 10 أبناءٍ بدل 36.",
    "-->"
  ].join("\n");

  // ⚠️⭐ **تعليقُ XML لا يقبل شرطتين متتاليتين في متنه** — فتُبدَّل بالشرطة
  // الطويلة. ⛔ **والمتنُ وحدَه**: أوّلُ صياغةٍ نظّفت السلسلةَ كلَّها **فأتلفت
  // فاتحةَ التعليق نفسَها** (`<!--` صارت `<!—`) ⇒ **وثيقةٌ لا تُحلَّل، وصفرُ
  // عناصر** — **وهو صفرُ «لم تُحمَّل» يُقرأ «لا شيء فيها»** (قرار 26).
  const xmlHeader = "<!--\n" +
    header.replace(/^<!--\n/, "").replace(/\n-->$/, "").replace(/--/g, "—") + "\n-->";
  const html = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlHeader + "\n" + cap.xml;
  const file = path.join(OUT_DIR, `snapshot-${STATE}-${today}.xhtml`);
  const kb = Math.round(html.length / 1024);
  console.log(`\n=== لقطةُ #112 — ${STATE} ===`);
  console.log(`  أوراقُ الأنماط: ${meta.sheets.readable} مقروءة · ${meta.sheets.blocked} محجوبة`);
  console.log(`  المراسي: ${JSON.stringify(meta.anchors)}`);
  console.log(`  بناءُ المشغّل: ${meta.build}`);
  console.log(`  شكلُ الحيّ: ${meta.liveShape.moviePlayerChildren} ابناً · الشريطُ داخل المشغّل: ${meta.liveShape.barInsidePlayer}`);
  console.log(`  الحجم: ${kb} KB`);
  if (DRY) { console.log("  ⚪ `--dry` — لم يُكتب شيء"); }
  else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(file, html);
    // **الوصفُ في ملفٍّ مجاور لا داخل XML** — فلا هروبَ ولا كسرَ تحليل
    fs.writeFileSync(file.replace(/\.xhtml$/, ".meta.json"), JSON.stringify(meta, null, 1));
    console.log(`  ✅ كُتبت: ${path.relative(ROOT, file)} (+ .meta.json)`);
  }
} catch (e) {
  console.log("❌ " + String(e?.message || e));
  process.exitCode = 1;
} finally {
  try { killChrome(h); } catch {}
}
