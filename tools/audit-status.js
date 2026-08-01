// فهرس حالة بنود `AUDIT.md` — **وهو الموضع الواحد الذي تُقرأ منه الحالة**.
//
// العلّة التي وُلد منها: العمود الأخير في جداول القسم الأول اسمه «الإصلاح
// المقترح» **وليس حقل حالة**، فبنودٌ منجزة (#6 · #7 · #9 · #27–#30 …) كانت
// تُقرأ مفتوحة، وحالتها الحقيقية تعيش في جداول الموجات — **موضعان للحقيقة
// الواحدة**، وهو الشكل نفسه الذي كذب في عدد التأكيدات (قرار 34 و36).
//
//   node tools/audit-status.js            # الفهرس + المجموع
//   node tools/audit-status.js --open     # غير المغلق وحده
//
// **الحالة تُقرأ من علامة أول حرف في الخلية الأخيرة**: ✅ مغلق · ❌ مرفوض ·
// ⬜ مفتوح. ويخرج بـ`1` على **أي صفّ بلا علامة** — صفٌّ بلا علامة يُقرأ ما
// يشتهيه القارئ، وأداةٌ تتخطّاه تطبع فهرساً أصغر من الحقيقة وتبدو خضراء.
const fs = require("fs");
const path = require("path");

const FILE = process.argv.find((a) => a.endsWith(".md")) ||
  path.join(__dirname, "..", "AUDIT.md");
const openOnly = process.argv.includes("--open");

const lines = fs.readFileSync(FILE, "utf8").split("\n");
const MARKS = { "✅": "مغلق", "❌": "مرفوض", "⬜": "مفتوح" };

// أقسام البنود وحدها: الأول (أخطاء مؤكدة) والثاني (شكوك). ما عداهما سرد لا جداول حالة.
const SECTIONS = [
  { title: "القسم الأول: أخطاء مؤكدة", from: "# القسم الأول", to: "# القسم الثاني" },
  { title: "القسم الثاني: شكوك تحتاج تجربة", from: "# القسم الثاني", to: "# القسم الثالث" }
];

let unmarked = 0;
const counts = { مغلق: 0, مرفوض: 0, مفتوح: 0 };
const open = [];

for (const sec of SECTIONS) {
  const a = lines.findIndex((l) => l.startsWith(sec.from));
  const b = lines.findIndex((l) => l.startsWith(sec.to));
  if (a === -1 || b === -1) {
    console.log(`❌ تعذّر تحديد ${sec.title} — المرساة سقطت، أصلِح المرساة لا التأكيد`);
    process.exit(1);
  }
  console.log(`\n── ${sec.title}`);
  for (let i = a; i < b; i++) {
    const l = lines[i];
    if (!l.startsWith("| ")) continue;
    const cells = l.replace(/^\||\|$/g, "").split(" | ").map((c) => c.trim());
    if (cells.length < 4) continue;
    const id = cells[0];
    if (id === "#" || /^[-:]+$/.test(id)) continue;          // رأس الجدول وفاصله

    const last = cells[cells.length - 1];
    const mark = Object.keys(MARKS).find((m) => last.startsWith(m));
    if (!mark) {
      unmarked++;
      console.log(`  ❓ ${id.padEnd(10)} — **بلا علامة حالة** (سطر ${i + 1})`);
      continue;
    }
    counts[MARKS[mark]]++;
    if (MARKS[mark] === "مفتوح") open.push({ id, why: last.slice(0, 90) });
    if (!openOnly) console.log(`  ${mark} ${id.padEnd(10)} ${last.slice(1, 76).trim()}`);
  }
}

if (open.length) {
  console.log("\n── المفتوح");
  for (const o of open) console.log(`  ⬜ ${o.id.padEnd(10)} ${o.why}`);
}

const total = counts.مغلق + counts.مرفوض + counts.مفتوح;
console.log(`\n${unmarked ? "❌" : "✅"} ${total} بنداً · مغلق ${counts.مغلق} · ` +
  `مرفوض ${counts.مرفوض} · مفتوح ${counts.مفتوح}` +
  (unmarked ? ` · **بلا علامة ${unmarked}**` : ""));
process.exit(unmarked ? 1 : 0);
