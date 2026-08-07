// يُولّد قسمَ أيقونات يوتيوب في `tools/icons (1).html` من السجلّ — لا نسخةَ بيد.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«أفتح ملفّ الأيقونات لأرى ما عندي — أأجد أيقونات يوتيوب فيه كما أجد أيقوناتي؟»*
//
// ⛔ **والعلّة: الملفُّ مرجعُ المالك البصريّ** — **وأيقوناتٌ في السجلّ لا يراها فيه
// موجودةٌ ولا تُرى.** ⇒ **فيُولَّد القسمُ منه** — ⛔ **ولا نسخةَ ثالثةً تتباعد.**
//   node tools/gen-yt-icons.js        # يُعيد كتابة القسم
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const { VZ_YT_ICONS, VZ_YT_ICONS_ALL, VZ_YT_ICONS_DATE } = require("./icons.js");

const START = "<!-- VZ-YT-ICONS:START -->";
const END = "<!-- VZ-YT-ICONS:END -->";

function cells(d) {
  return Object.keys(d).sort().map((k) => {
    const v = d[k];
    return `  <button class="cell" type="button" data-key="${k}">\n` +
      `    <svg class="ico" viewBox="${v.viewBox}" fill="currentColor" aria-hidden="true">${v.d}</svg>\n` +
      `    <span class="ar">${v.ar || k}</span>\n` +
      `    <span class="key">${k}</span>\n  </button>`;
  }).join("\n");
}

function section() {
  return [START,
    "  <!-- ⛔ مُولَّدٌ من tools/icons.js — لا يُحرَّر بيد. أعِد: node tools/gen-yt-icons.js -->",
    "  <!-- ⛔ ليست من تصميم صاحب المشروع: منسوخةٌ من شريط يوتيوب بحروفها يوم " + VZ_YT_ICONS_DATE + " -->",
    "  <!-- ⚠️ ويوتيوب يُغيّر رسومَه ⇒ متى تغيّر شكلُ شريطه تُراجَع -->",
    '  <div class="panel">',
    `    <h2 style="margin:0 0 10px">أيقوناتُ يوتيوب — في الإطار (${Object.keys(VZ_YT_ICONS).length})</h2>`,
    '    <div class="grid">', cells(VZ_YT_ICONS), "    </div>", "  </div>",
    '  <div class="panel">',
    `    <h2 style="margin:0 0 4px">أيقوناتُ يوتيوب — مادّةٌ تُجمَع (${Object.keys(VZ_YT_ICONS_ALL).length})</h2>`,
    '    <p style="margin:0 0 10px;opacity:.7">⛔ لا يدخل الإطارَ منها شيءٌ اليوم: قاعدةُ «ما لم يثبت في الأربعة لا يدخل» قائمة.</p>',
    '    <div class="grid">', cells(VZ_YT_ICONS_ALL), "    </div>", "  </div>",
    END].join("\n");
}

const p = path.join(ROOT, "tools", "icons (1).html");
let html = fs.readFileSync(p, "utf8");
const a = html.indexOf(START), b = html.indexOf(END);
if (a !== -1 && b !== -1) html = html.slice(0, a) + section() + html.slice(b + END.length);
else html = html.replace("</body>", section() + "\n</body>");
fs.writeFileSync(p, html);
console.log(`✅ وُلّد القسم: ${Object.keys(VZ_YT_ICONS).length} في الإطار · ${Object.keys(VZ_YT_ICONS_ALL).length} مادّة`);
