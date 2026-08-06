// Audit #19 follow-up: a requested YouTube quality the video cannot offer used to
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن طلبتُ 4K على فيديو أقصاه أقلّ، أأُخبَر بالرقمين؟»*
// fail silently — 4K asked for, 480p delivered, nothing said. The popup now shows a
// line for it, under two rules the owner set:
//
//   1. it appears ONLY when there is a real gap. Success is silent, because a line
//      that shows every time is a line the user learns to ignore — the lesson from
//      the permanent blue notice in S1;
//   2. it names BOTH numbers: what was asked for and what was actually applied.
//
// And it must never appear on auto quality, during an ad, or off YouTube. All four
// of those are decided in content.js, so the popup has one job: render what it is
// given and hide when given nothing. Both halves are tested here.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const POPUP = fs.readFileSync("popup.js", "utf8");
const POPUP_HTML = fs.readFileSync("popup.html", "utf8");
if (!SRC.includes("function ytQualityGap")) {
  console.log("  ❌ ytQualityGap غائبة — سطر الحالة غير منفَّذ");
  process.exit(1);
}

function extract(src, name) {
  const head = src.indexOf(`function ${name}(`);
  if (head === -1) throw new Error(`لم يُعثر على ${name}`);
  const start = src.indexOf("{", src.indexOf(")", head));
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(head, i + 1);
  }
  throw new Error(`قوس غير مغلق في ${name}`);
}

function gapFor({ youtube = true, quality = "hd2160", result = "fallback:hd720", requested = "hd2160" } = {}) {
  const ctx = {
    isYouTubeHost: () => youtube,
    ytAutoQuality: quality,
    lastYtQualityResult: result === null ? null : { requested, result },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(extract(SRC, "ytQualityGap"), ctx);
  return vm.runInContext("ytQualityGap()", ctx);
}

// جانب الـ popup: عنصر وهمي نقرأ منه ما يُعرض فعلاً
function renderGap(gap) {
  const el = { hidden: false, textContent: "" };
  const ctx = { $: (id) => (id === "ytQualityGap" ? el : null), console };
  vm.createContext(ctx);
  vm.runInContext(
    POPUP.slice(POPUP.indexOf("const YT_QUALITY_LABELS"), POPUP.indexOf("function setStatus")), ctx);
  vm.runInContext("setYtQualityGap(__g)", Object.assign(ctx, { __g: gap }));
  return el;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log("\n[1] ⭐ لا يظهر إلا عند فرق فعلي — النجاح صامت");
{
  check("نجاح تام ⇒ لا سطر", gapFor({ result: "set" }) === null);
  check("إعلان ⇒ لا سطر", gapFor({ result: "ad" }) === null);
  check("أُلغي ⇒ لا سطر", gapFor({ result: "cancelled" }) === null);
  check("انتهى الوقت ⇒ لا سطر", gapFor({ result: "timeout" }) === null);
  check("لا مشغّل ⇒ لا سطر", gapFor({ result: "no-player" }) === null);
  check("لا نتيجة بعد ⇒ لا سطر", gapFor({ result: null }) === null);
  check("فرق فعلي ⇒ سطر", gapFor({ result: "fallback:hd720" }) !== null);
}

console.log("\n[2] لا يظهر على التلقائي ولا خارج يوتيوب");
{
  check("الجودة تلقائية ⇒ لا سطر مهما كانت النتيجة", gapFor({ quality: "" }) === null);
  check("خارج يوتيوب ⇒ لا سطر", gapFor({ youtube: false }) === null);
}

console.log("\n[3] الرقمان معاً: المطلوب والمُطبَّق");
{
  const g = gapFor({ requested: "hd2160", result: "fallback:hd720" });
  check("المطلوب صحيح", g?.requested === "hd2160", g);
  check("والمُطبَّق صحيح", g?.applied === "hd720", g);

  const el = renderGap(g);
  check("السطر ظاهر", el.hidden === false);
  check("ويذكر المطلوب بالاسم المقروء", el.textContent.includes("4K — 2160p"), el.textContent);
  check("ويذكر المُطبَّق بالاسم المقروء", el.textContent.includes("720p — HD"), el.textContent);
  check("ويقول صراحةً إنها غير متاحة", /غير متاحة/.test(el.textContent), el.textContent);
}

console.log("\n[4] الـ popup يُخفيه متى غاب الفرق");
{
  const el = renderGap(null);
  check("بلا فرق ⇒ مخفي", el.hidden === true);
  check("ونصّه فارغ فلا يومض عند إعادة الفتح", el.textContent === "");

  const shown = renderGap({ requested: "hd1080", applied: "large" });
  check("ثم يظهر عند وجود فرق", shown.hidden === false && shown.textContent.includes("480p"), shown.textContent);
}

console.log("\n[5] الأسماء المقروءة تطابق قائمة الإعدادات");
{
  // ⚠️ **الصفحةُ تُبنى من ملفّين منذ 2026-08-06** (#79 · #113): `options.html`
  // **والسجلّ `settings-ui.js`** — **فمن قرأ أحدهما وحدَه يقرأ نصفَ الصفحة**،
  // وهو الشكلُ الذي أحمرّ به سبعةُ حرّاسٍ يوم النقل. ⇒ **يُقرأ المصدران معاً.**
  const optionValues = [...fs.readFileSync("settings-ui.js", "utf8")
    .matchAll(/\{ value: "(hd\d+|large|medium|small|tiny)", label: "([^"]+)" \}/g)];
  check("القائمة غير فارغة", optionValues.length >= 9, optionValues.length);
  for (const [, code, label] of optionValues) {
    const rendered = renderGap({ requested: code, applied: code }).textContent;
    check(`  «${code}» يُعرض بنفس نصّ الإعدادات`, rendered.includes(label.trim()), { code, label, rendered });
  }
  const unknown = renderGap({ requested: "zzz", applied: "zzz" }).textContent;
  check("ورمز مجهول يُعرض كما هو بلا تخمين", unknown.includes("zzz"), unknown);
}

console.log("\n[6] التوصيل");
{
  check("العنصر موجود في popup.html ومخفي ابتداءً",
    /id="ytQualityGap"[^>]*hidden/.test(POPUP_HTML));
  check("و GVZ_STATUS يحمل الفرق", SRC.includes("ytQualityGap: ytQualityGap()"));
  check("والـ popup يستدعيه على كل فحص حالة",
    /setYtQualityGap\(res\?\.ok \? res\.ytQualityGap : null\)/.test(POPUP));
  check("ويُخفيه عند تعذّر الوصول للصفحة",
    /catch \{\s*setYtQualityGap\(null\);/.test(POPUP));
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
