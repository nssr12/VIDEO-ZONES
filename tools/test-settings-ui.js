// البند #77 — صفحة الإعدادات: مُولِّدٌ واحد · تغطيةٌ بالعدّ · ووصولٌ مُختبَر
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تُفتح صفحة الإعدادات وتعمل ضوابطُها كلُّها؟»*
//
// ⚠️ **والفحوص هنا لا في المعاينة (شرط المالك):** كانت أربعة عشر فحصاً على صفحة
// `tools/preview-77.html`، **فكنّا نحرس ما لا يُشحن ونترك ما يُشحن**. صارت على
// **الشجرة التي يبنيها `settings-ui.js`** — وهي التي تُشحن، **والمعاينة غلافٌ
// رقيق فوقها**.
//
// ⚠️ **وأخطر ما في إعادة كتابة صفحةٍ كاملة أن يسقط ضابط بلا أن ينتبه أحد حتى
// يشتكي مستخدم** (قرار المالك). ولذلك القسم [1] **بالعدّ لا بالنظر**: لكل مفتاح
// في السجلّات ضابطٌ مرسوم وموصول، **ومفتاحٌ بلا ضابط أو ضابطٌ بلا مفتاح يُحمّر
// المجموعة**.
//
// ⚠️ **ولا مُولِّد ثانٍ:** القسم [5] يشترط أن المعاينة **تستهلك الملفّ المشحون**
// ولا تحمل نسخةً — فالشيء الذي حكم عليه المالك **هو** الشيء الذي يستعمله.
const fs = require("fs");
const path = require("path");

const UI = fs.readFileSync("settings-ui.js", "utf8");
const OPTIONS = fs.readFileSync("options.js", "utf8");
const HTML = fs.readFileSync("options.html", "utf8");
const CSS = fs.readFileSync("options.css", "utf8");
const PREVIEW = fs.readFileSync("tools/preview-77.html", "utf8");
const CONTENT = fs.readFileSync("content.js", "utf8");
const gen = require(path.join(process.cwd(), "settings-ui.js"));

// ⚠️ **الحكم على الكود لا على ما يذكر الاسم في تعليق** (نمط `test-master-gate`
// القسم [٢]): تعليقٌ يشرح **لماذا لا نلمس `chrome.*`** ليس لمساً لها.
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|<!--)/.test(l)).join("\n");
const UI_CODE = code(UI);
const PREVIEW_CODE = PREVIEW.replace(/<!--[\s\S]*?-->/g, "");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ── DOM مصغَّر: نُشغّل المُولِّد **نفسه** ونفحص شجرته ──────────────────────
function makeDoc() {
  const all = [];
  const node = (tag) => {
    const el = {
      tagName: String(tag).toUpperCase(), className: "", id: "", type: "",
      value: "", min: "", max: "", step: "", checked: false, disabled: false,
      hidden: false, open: false, dataset: {}, attrs: {}, kids: [], own: "",
      listeners: {},
      set textContent(v) { this.own = String(v); this.kids.length = 0; },
      get textContent() {
        return this.own + this.kids.map((k) => k.textContent).join("");
      },
      set innerHTML(v) { throw new Error("innerHTML في مسار مُولَّد: " + v); },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return this.attrs[k] ?? null; },
      appendChild(c) { this.kids.push(c); return c; },
      addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
      querySelectorAll(sel) {
        const cls = String(sel).replace(/^\./, "");
        return all.filter((e) => String(e.className).split(/\s+/).includes(cls));
      }
    };
    all.push(el);
    return el;
  };
  return {
    all,
    createElement: node,
    getElementById: (id) => all.find((e) => e.id === id) || null
  };
}
const walk = (el, out = []) => { out.push(el); el.kids.forEach((k) => walk(k, out)); return out; };

console.log("\n=== #77 — صفحة الإعدادات المُولَّدة ===\n");

// ── [1] ⭐ التغطية بالعدّ — لا ضابطَ يسقط صامتاً ────────────────────────────
console.log("[1] ⭐ لكل مفتاحٍ ضابطٌ مرسوم وموصول — بالعدّ لا بالنظر");
{
  const m = OPTIONS.match(/const CLEAN_PLAYER_OPTIONS = \[([\s\S]*?)\n\];/);
  const keys = m ? [...m[1].matchAll(/\{ key: "([a-z_]+)"/g)].map((r) => r[1]) : [];
  const ui = Object.keys(gen.VZ_UI_CLEAN);
  check("[1] مفاتيح المنتج تُقرأ", keys.length > 0, keys.length);
  check(`[1] وعددها يطابق السجلّ (${keys.length} ⇄ ${ui.length})`, keys.length === ui.length);
  const missing = keys.filter((k) => !ui.includes(k));
  const extra = ui.filter((k) => !keys.includes(k));
  check("[1] ⭐ ولا مفتاحَ بلا ضابط", missing.length === 0, missing);
  check("[1] ⭐ ولا ضابطَ بلا مفتاح", extra.length === 0, extra);
  // والمحتوى نفسه: content.js هو مصدر الحقيقة للمحدِّدات
  const c = CONTENT.match(/const CLEAN_PLAYER_ITEMS = \{([\s\S]*?)\n\};/);
  const ckeys = c ? [...c[1].matchAll(/^\s{2}([a-z_]+):/gm)].map((r) => r[1]) : [];
  check("[1] ويطابق سجلّ `content.js` كذلك",
    ckeys.length === ui.length && ckeys.every((k) => ui.includes(k)),
    { content: ckeys.length, ui: ui.length });
  // وكل مجموعةٍ معرَّفة
  const bad = ui.filter((k) => !gen.VZ_UI_GROUPS.some((g) => g.id === gen.VZ_UI_CLEAN[k].group));
  check("[1] ولا مفتاحَ بمجموعةٍ غير معرَّفة", bad.length === 0, bad);

  // ⭐ وموصول: المُولِّد يربط **كلَّ** ضابطٍ بمفتاحه
  const doc = makeDoc();
  const root = doc.createElement("div");
  const seen = [];
  const map = gen.vzUiBuildClean(doc, root, (k) => seen.push(k));
  check("[1] ⭐ والمُولِّد يرسم الجميع", Object.keys(map).length === ui.length, Object.keys(map).length);
  for (const k of ui) map[k].listeners.change.forEach((fn) => fn());
  check("[1] ⭐ وكلٌّ موصولٌ بمفتاحه هو",
    seen.length === ui.length && seen.every((k, i) => k === ui[i]), seen.slice(0, 3));
}

// ── [2] المُولِّد الواحد — والصفحة تستهلكه ──────────────────────────────────
console.log("\n[2] مُولِّدٌ واحد، والصفحة والمعاينة تستهلكانه");
{
  check("[2] `options.html` تُحمّل المُولِّد", /<script src="settings-ui\.js">/.test(HTML));
  check("[2] و`options.js` تبني منه Clean Player", /vzUiBuildClean\(document, \$\("cleanPlayerList"\)/.test(OPTIONS));
  check("[2] وتبني منه التوقيت", /vzUiBuildTiming\(document, \$\("timingList"\)/.test(OPTIONS));
  // ⚠️ ولا ضابطَ توقيتٍ مكتوبٌ بيدٍ في HTML — وإلا عاد «موضعان للحقيقة»
  check("[2] ولا ضابط توقيتٍ مكتوبٌ بيدٍ في `options.html`",
    !/id="(gridDuration|volumeDuration|idleDuration|zoneHintEnabled|speedBadgeEnabled|hideProgressBar|speedButtonEnabled|speedButtonPreset)"/.test(HTML));
  check("[2] ونقطتا التركيب موجودتان",
    /id="timingList"/.test(HTML) && /id="cleanPlayerList"/.test(HTML));
}

// ── [3] ⭐ الوصول — على الشجرة المُولَّدة لا على وصفٍ ───────────────────────
console.log("\n[3] ⭐ الوصول: لوحة المفاتيح · اللمس · قارئ الشاشة");
{
  const doc = makeDoc();
  const root = doc.createElement("div");
  gen.vzUiBuildTiming(doc, root, () => {});
  const nodes = walk(root);
  const helps = nodes.filter((e) => e.className === "vzHelp");
  const inputs = nodes.filter((e) => e.tagName === "INPUT");
  const bodies = nodes.filter((e) => e.className === "vzHelpBody");

  check("[3] التلميح `<button>` لا `<span>`", helps.length > 0 && helps.every((b) => b.tagName === "BUTTON"),
    helps.map((b) => b.tagName).slice(0, 3));
  check("[3] ونوعه `button` فلا يُرسل نموذجاً", helps.every((b) => b.type === "button"));
  check("[3] ⭐ ويصله `Tab` بالبناء (لا `tabindex` مصطنع)", helps.every((b) => !b.attrs.tabindex));
  check("[3] و`aria-expanded` مبدئياً مغلق", helps.every((b) => b.getAttribute("aria-expanded") === "false"));
  check("[3] ⭐ و`aria-controls` يشير إلى نصٍّ موجود",
    helps.every((b) => bodies.some((p) => p.id === b.getAttribute("aria-controls"))));
  check("[3] و`aria-label` يسمّي ما يشرحه", helps.every((b) => /^شرح: /.test(b.getAttribute("aria-label") || "")));
  check("[3] والنصّ مخفيٌّ حتى يُطلب", bodies.every((p) => p.hidden === true));
  // ⭐ والضابط نفسه `input` — لا `div` يقوم مقامه
  check("[3] ⭐ والضوابط `input` لا `div`", inputs.length === gen.VZ_UI_TIMING.length, inputs.length);
  check("[3] ولا `role=switch` مصطنع", !/role="switch"/.test(UI) && !/role="checkbox"/.test(UI));
  check("[3] ولا `div` بمستمعٍ يقوم مقام ضابط",
    !/createElement\("div"\)[\s\S]{0,200}addEventListener\("click"/.test(UI));
}

// ── [4] المفتاح المنزلق — مظهرٌ على `input`، وثلاث حالات تُقرأ بلا لون ──────
console.log("\n[4] المفتاح المنزلق: مظهرٌ لا عنصرٌ بديل، وثلاث حالات");
{
  check("[4] التبديل مظهرٌ على `input` نفسه",
    /\.vzRow input\[type=checkbox\]\{[\s\S]{0,200}appearance:none/.test(CSS));
  // ⭐ الحالة تُقرأ بلا لون: **موضعٌ وشكل** لا لونٌ وحده
  check("[4] ⭐ المطفأ: حدٌّ متقطّع والمِقبض في الأوّل",
    /\.vzRow input\[type=checkbox\]\{[\s\S]{0,220}border:2px dashed/.test(CSS) &&
    /::after\{[\s\S]{0,160}inset-inline-start:3px/.test(CSS));
  check("[4] ⭐ والمُشغَّل: حدٌّ متّصل والمِقبض في الآخر",
    /:checked\{[\s\S]{0,120}border-style:solid/.test(CSS) &&
    /:checked::after\{ inset-inline-start:21px/.test(CSS));
  check("[4] ⭐ والمعطَّل: حدٌّ منقّط والمِقبض في الوسط — لا يبدو «مطفأً»",
    /:disabled\{[\s\S]{0,140}border-style:dotted/.test(CSS) &&
    /:disabled::after\{ inset-inline-start:12px/.test(CSS));
  check("[4] وللتركيز إطارٌ ظاهر", /:focus-visible\{ outline:2px solid/.test(CSS));
}

// ── [5] المعاينة غلافٌ لا نسخة ──────────────────────────────────────────────
console.log("\n[5] المعاينة تستهلك المشحون، ولا تحمل نسخة");
{
  check("[5] تُحمّل `settings-ui.js` المشحون", /<script src="\.\.\/settings-ui\.js">/.test(PREVIEW));
  check("[5] و`options.css` المشحون", /href="\.\.\/options\.css"/.test(PREVIEW));
  check("[5] ⭐ ولا تحمل سجلّاً خاصّاً بها", !/VZ_UI_CLEAN\s*=/.test(PREVIEW) && !/VZ_UI_TIMING\s*=/.test(PREVIEW));
  check("[5] وتخزينها صوريّ — لا `chrome.*` ولا `localStorage`",
    !/chrome\.\w/.test(PREVIEW_CODE) && !/localStorage/.test(PREVIEW_CODE));
  check("[5] ولا مُولِّدَ ثانٍ في `tools/`",
    !fs.existsSync("tools/make-preview-77.js") && !fs.existsSync("tools/preview-77-labels.js"));
}

// ── [6] الوسوم: فعلٌ لا اسمُ عنصر، والقياس في التلميح ──────────────────────
console.log("\n[6] الوسم فعلٌ، والقياس في تلميحه");
{
  const items = Object.entries(gen.VZ_UI_CLEAN);
  const bad = items.filter(([, v]) => !/^(إخفاء|إظهار|تفعيل)/.test(v.label));
  check("[6] كل وسمٍ يبدأ بما يقع عند التأشير", bad.length === 0, bad.map(([k]) => k));
  check("[6] ولا تشديد في وسم — القياس في التلميح",
    items.every(([, v]) => !/\*\*/.test(v.label)));
  check("[6] ولكلٍّ تلميحٌ غير فارغ", items.every(([, v]) => (v.help || "").length > 20));
  const stars = items.filter(([, v]) => v.measured).length;
  check(`[6] و★ ${stars} موسومةٌ بأن القياس يعقّدها`, stars === 14, stars);
  // وضوابط التوقيت كذلك — والثلاثة التي أبهمت المالك بأسمائها الجديدة
  // على الكود لا على التعليق: الأسماء الثلاثة مذكورةٌ في رأس المُولِّد **بوصفها
  // ما أُبدل** — وذكرُها هناك توثيقٌ لا استعمال.
  check("[6] ولا اسمٌ من الثلاثة المُبهمة باقٍ في وسمٍ أو صفحة",
    !/السرعة المفضّلة لزرّ السرعة|مهلة السكون قبل الإخفاء|مدة ظهور رقم الصوت/.test(UI_CODE + HTML));
  check("[6] وبدائلها مكتوبة",
    // ⚠️ **وُسِّع الوسم الثالث 2026-08-08 (#75)**: «كم يبقى رقم الصوت ظاهراً» ⇒
    // «كم تبقى الشارة ظاهرة» — **والمدّةُ تحكم ثلاث شاراتٍ لا رقمَ الصوت وحدَه**،
    // ⛔ **والوسمُ مقتبَسٌ بحروفه في خمسة مواضع فيُنقل معها كلِّها** (قرار 100).
    /سرعة نقرة الزرّ/.test(UI) && /كم ينتظر قبل الإخفاء/.test(UI) && /كم تبقى الشارة ظاهرة/.test(UI));
}

// ── [7] صفر هجرة وصفر تغيّر وظيفيّ ─────────────────────────────────────────
console.log("\n[7] صفر هجرة — المفاتيح المخزَّنة لا تُمسّ بحرف");
{
  check("[7] لا هجرة في `options.js` لمفاتيح Clean Player",
    !/delete s\.cleanPlayer\.items\[[^\]]+\];\s*\/\/ *هجرة/.test(OPTIONS));
  check("[7] والمُولِّد لا يلمس `chrome.*`", !/chrome\.\w/.test(UI_CODE));
  check("[7] ولا يقرأ تخزيناً بنفسه", !/storage\.\w/.test(UI_CODE));
  // والمفاتيح المخزَّنة هي هي: الوسوم تغيّرت لا القيم
  check("[7] ومفاتيح `cleanPlayer.items` كما هي",
    /items\[key\] = true/.test(OPTIONS) && /delete items\[key\]/.test(OPTIONS));
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
