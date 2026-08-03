// #77 — مُولِّد صفحة المعاينة الساكنة: **يُولَّد من السجلّات، ولا يُكتب بيده**
//
// **شرط المالك: «تُولَّد من السجلّات نفسها لا أن تُكتب بيدها — وإلا كانت معاينةً
// لشيءٍ آخر».** فمفاتيح المعاينة تُقرأ من `CLEAN_PLAYER_OPTIONS` في `options.js`
// **نفسه**، والوسوم المقترحة من `tools/preview-77-labels.js`، **ويُفشَل التوليد
// عند أيّ تباعد** — مفتاحٌ بلا وسمٍ مقترح، أو وسمٌ لمفتاحٍ لا وجود له.
//
// ⚠️ **والصفحة بلا تخزين ولا حفظ ولا أثر**: لا `chrome.*` ولا `localStorage`.
// **يحكم المالك على ما يراه لا على وصفٍ يقرؤه**، ويُعدَّل قبل أن يُكتب سطر منطق.
//
//   node tools/make-preview-77.js          # يكتب tools/preview-77.html
//   node tools/make-preview-77.js --table  # جدول المراجعة نصّاً (Markdown)
"use strict";
const fs = require("fs");
const path = require("path");
const { GROUPS, LABELS, RENAMED } = require("./preview-77-labels.js");

const ROOT = path.join(__dirname, "..");
const OPTIONS = fs.readFileSync(path.join(ROOT, "options.js"), "utf8");

// ── المفاتيح من المنتج نفسه، لا نسخةٌ منها ─────────────────────────────────
const m = OPTIONS.match(/const CLEAN_PLAYER_OPTIONS = \[([\s\S]*?)\n\];/);
if (!m) { console.error("❌ تعذّر إيجاد CLEAN_PLAYER_OPTIONS — المرساة سقطت"); process.exit(1); }
const CURRENT = [...m[1].matchAll(/\{ key: "([a-z_]+)",\s*label: ("(?:[^"\\]|\\.)*") \}/g)]
  .map((r) => ({ key: r[1], label: JSON.parse(r[2]) }));

// ── الحارس: لا مفتاحَ بلا وسم، ولا وسمَ بلا مفتاح ──────────────────────────
const missing = CURRENT.filter((c) => !LABELS[c.key]).map((c) => c.key);
const extra = Object.keys(LABELS).filter((k) => !CURRENT.some((c) => c.key === k));
const badGroup = Object.entries(LABELS)
  .filter(([, v]) => !GROUPS.some((g) => g.id === v.group)).map(([k]) => k);
if (missing.length || extra.length || badGroup.length) {
  console.error("❌ تباعدَ الاقتراح عن المنتج — لا تُولَّد معاينةٌ لشيءٍ آخر:");
  if (missing.length) console.error("   مفاتيح بلا وسمٍ مقترح:", missing.join(", "));
  if (extra.length) console.error("   وسومٌ لمفاتيح لا وجود لها:", extra.join(", "));
  if (badGroup.length) console.error("   وسومٌ بمجموعةٍ غير معرَّفة:", badGroup.join(", "));
  process.exit(1);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// **بولد** خفيف داخل الشروح — لأن القياس فيها يحتاج تشديداً، ولا HTML من السجلّ
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");

// ── جدول المراجعة ─────────────────────────────────────────────────────────
if (process.argv.includes("--table")) {
  console.log(`\n| # | المفتاح | الوسم اليوم | ⇒ الوسم المقترح | ★ |`);
  console.log(`|---|---|---|---|---|`);
  CURRENT.forEach((c, i) => {
    const L = LABELS[c.key];
    console.log(`| ${i + 1} | \`${c.key}\` | ${c.label} | **${L.label}** | ${L.measured ? "★" : ""} |`);
  });
  const stars = CURRENT.filter((c) => LABELS[c.key].measured).length;
  console.log(`\n**${CURRENT.length} وسماً · ★ ${stars} يقف عندها المالك · ${CURRENT.length - stars} تمرّ.**`);
  process.exit(0);
}

// ── الصفحة ────────────────────────────────────────────────────────────────
const groupHtml = GROUPS.map((g) => {
  const items = CURRENT.filter((c) => LABELS[c.key].group === g.id);
  const rows = items.map((c) => {
    const L = LABELS[c.key];
    return `      <label class="row${L.measured ? " star" : ""}">
        <input type="checkbox" />
        <span class="lbl">${esc(L.label).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</span>
        <button class="help" type="button" aria-expanded="false"
                aria-controls="h_${c.key}" aria-label="شرح: ${esc(L.label)}">!</button>
      </label>
      <p class="helpBody" id="h_${c.key}" hidden>${rich(L.help)}</p>`;
  }).join("\n");
  return `    <details class="group" open>
      <summary><span>${esc(g.name)}</span><em>${items.length}</em></summary>
      <p class="rule">${esc(g.rule)}</p>
${rows}
    </details>`;
}).join("\n");

const renamedHtml = RENAMED.map((r) => `      <div class="row rename">
        <span class="lbl"><s>${esc(r.before)}</s> ⇐ اليوم<br/><b>${esc(r.after)}</b> ⇐ المقترح</span>
        <button class="help" type="button" aria-expanded="false" aria-controls="h_${r.id}"
                aria-label="شرح: ${esc(r.after)}">!</button>
      </div>
      <p class="helpBody" id="h_${r.id}" hidden>${rich(r.help)}</p>`).join("\n");

// ── الحالات الثلاث معروضةً — **تُرى لا تُوصف** ─────────────────────────────
// ⚠️ **والثالثة هي المقصودة**: «معطّل بسببٍ مكتوب» **ليس «مطفأً»**. والحالة
// الحقيقية من #71: مدّة رقم الصوت صفر ⇒ شارة السرعة **تُعطَّل ويُكتب سببها**.
const statesHtml = `      <label class="row"><input type="checkbox" />
        <span class="lbl">مطفأ — المِقبض في أوّل المسار، والحدّ <b>متقطّع</b> والمسار أجوف</span></label>
      <label class="row"><input type="checkbox" checked />
        <span class="lbl">مُشغَّل — المِقبض في آخر المسار، والحدّ <b>متّصل</b> والمسار مملوء</span></label>
      <label class="row"><input type="checkbox" disabled />
        <span class="lbl">معطَّل بسببٍ مكتوب — المِقبض <b>في الوسط</b>، والحدّ <b>منقّط</b>
        <br/><span class="why">معطّلة الآن: مدّة «رقم الصوت» صفر، والشارتان تتشاركان المدّة نفسها.</span></span></label>`;

const stars = CURRENT.filter((c) => LABELS[c.key].measured).length;

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><title>#77 — معاينة ساكنة</title>
<style>
:root{--bg:#0f1216;--card:#171b21;--line:#262c35;--txt:#e8edf4;--mut:#96a1b0;--acc:#4ea3ff;--star:#ffcf5c}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:22px;margin:0 0 6px}
.sub{color:var(--mut);margin:0 0 20px;font-size:13px}
.warn{background:#2a1f10;border:1px solid #5a4320;border-radius:10px;padding:12px 14px;margin:0 0 22px;font-size:13px}
.group{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:0 0 14px;padding:6px 14px 10px}
summary{cursor:pointer;font-weight:700;padding:10px 2px;display:flex;align-items:center;gap:10px}
summary em{font-style:normal;color:var(--mut);font-size:12px;background:#0e1218;border:1px solid var(--line);border-radius:20px;padding:1px 9px}
.rule{color:var(--mut);font-size:12px;margin:0 0 10px;padding-inline-start:2px}
.row{display:flex;align-items:flex-start;gap:10px;padding:7px 2px;border-top:1px solid #1e242c}
.row:first-of-type{border-top:0}
/* ── المفتاح المنزلق (Toggle) — **مظهرٌ على input[type=checkbox] نفسه** ────
   ١) العنصر كما هو: يصله Tab والمسافة وقارئ الشاشة **بالبناء**، ولا نعيد بناء
      ما يعطيه المتصفّح مجّاناً. (وهو سبب اشتراط <button> للتلميح: العنصر
      الصحيح أوّلاً، والمظهر بعده.)
   ٢) **الحالة تُقرأ بلا لون**: الموضع يختلف (المِقبض يمين/يسار) **والشكل يختلف**
      (حدٌّ متقطّع ⇒ متّصل · ومسارٌ أجوف ⇒ مملوء). فمن لا يميّز اللون يفرّق.
   ٣) **وحالةٌ ثالثة للمعطَّل**: المِقبض **في الوسط** — موضعٌ لا هو مطفأ ولا
      مُشغَّل — مع حدٍّ منقّط ومؤشّر منع. **فـ«معطّل» لا يبدو «مطفأً»**، وهما
      مختلفان في المعنى (حالة مدّة الصفر في #71).
   ٤) وصفر تغيّر في القيم والمفاتيح والوسوم: مظهرٌ لا تخزين. */
.row input[type=checkbox]{
  -webkit-appearance:none;appearance:none;margin:3px 0 0;flex:none;cursor:pointer;
  position:relative;width:40px;height:22px;border-radius:22px;
  border:2px dashed #6b7684;background:transparent;
  transition:background .12s linear,border-color .12s linear;
}
.row input[type=checkbox]::after{
  content:"";position:absolute;top:3px;inset-inline-start:3px;
  width:12px;height:12px;border-radius:50%;background:#8d99a8;
  transition:inset-inline-start .12s ease,background .12s linear,transform .12s ease;
}
.row input[type=checkbox]:checked{
  border-style:solid;border-color:var(--acc);background:var(--acc);
}
.row input[type=checkbox]:checked::after{ inset-inline-start:21px;background:#0b1017;transform:scale(1.15) }
.row input[type=checkbox]:focus-visible{ outline:2px solid var(--acc);outline-offset:3px }
.row input[type=checkbox]:disabled{
  border-style:dotted;border-color:#4a525d;background:transparent;cursor:not-allowed;opacity:.75;
}
.row input[type=checkbox]:disabled::after{ inset-inline-start:12px;background:#4a525d;transform:scale(.8) }
.row.off .lbl{color:var(--mut)}
.lbl{flex:1}
.star .lbl::after{content:"★";color:var(--star);margin-inline-start:7px;font-size:12px}
.help{flex:none;width:22px;height:22px;border-radius:50%;border:1px solid var(--line);
  background:#0e1218;color:var(--mut);font-weight:700;cursor:pointer;line-height:1}
.help:hover,.help:focus-visible{color:var(--acc);border-color:var(--acc);outline:none}
.help[aria-expanded=true]{color:var(--acc);border-color:var(--acc)}
.helpBody{margin:0 0 8px;padding:9px 12px;background:#0e1218;border:1px solid var(--line);
  border-inline-start:3px solid var(--acc);border-radius:8px;color:#cdd7e3;font-size:13px}
.helpBody code{background:#161c24;padding:1px 5px;border-radius:5px;font-size:12px;direction:ltr;display:inline-block}
.rename{align-items:center}
.rename s{color:#7d8794}
.why{color:var(--mut);font-size:12px}
/* المُنزلقات والأرقام تبقى LTR عمداً — حدٌّ معروف مكتوب لا يُصلَح */
.ltr{direction:ltr}
</style></head>
<body><div class="wrap">
<h1>#77 — معاينة ساكنة</h1>
<p class="sub">مُولَّدة من <code>options.js</code> و<code>tools/preview-77-labels.js</code> — <b>${CURRENT.length}</b> وسماً · <b>★ ${stars}</b> يقف عندها المالك.</p>
<div class="warn">⚠️ <b>معاينةٌ لا منتَج</b>: المربّعات لا تحفظ شيئاً ولا تقرأ تخزيناً ولا تؤثّر في الإضافة.
الغرض <b>الحكم على الشكل والوسوم والشرح</b> قبل أن يُكتب سطر منطق.
<br/>و<b>(!)</b> يُفتح <b>بالنقر وباللمس وبلوحة المفاتيح</b> (Tab ثمّ Enter/Space) ويُغلق بـEsc — لا بالتحويم وحده.</div>

<details class="group" open><summary><span>حالات المفتاح المنزلق الثلاث</span><em>3</em></summary>
      <p class="rule">تُرى لا تُوصف — والفرق بين الحالات في الموضع والشكل لا في اللون وحده</p>
${statesHtml}
</details>

<details class="group" open><summary><span>ضوابط أُعيدت تسميتها</span><em>${RENAMED.length}</em></summary>
      <p class="rule">أسماءٌ أبهمت صاحب المشروع بنصّه — وما لم يفهمه لن يفهمه أحد</p>
${renamedHtml}
</details>

${groupHtml}
</div>
<script>
// (!) — نقرٌ ولمسٌ ولوحةُ مفاتيح، لا تحويمٌ وحده. والتحويم **يضيف** ولا يستبدل.
for (const b of document.querySelectorAll(".help")) {
  const body = document.getElementById(b.getAttribute("aria-controls"));
  const set = (on) => { body.hidden = !on; b.setAttribute("aria-expanded", String(on)); };
  b.addEventListener("click", () => set(body.hidden));
  b.addEventListener("mouseenter", () => set(true));
  b.addEventListener("focus", () => set(true));
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  for (const p of document.querySelectorAll(".helpBody")) p.hidden = true;
  for (const b of document.querySelectorAll(".help")) b.setAttribute("aria-expanded", "false");
});
</script>
</body></html>`;

const out = path.join(ROOT, "tools", "preview-77.html");
fs.writeFileSync(out, html);
console.log(`✅ ${out}\n   ${CURRENT.length} وسماً · ${GROUPS.length} مجموعات · ★ ${stars} · ${RENAMED.length} إعادة تسمية`);
