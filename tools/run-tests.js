// مشغّل المجموعة — **وهو الموضع الواحد الذي يُقرأ منه عدد التأكيدات**.
//
// كان الرقم مكتوباً بيد في `HANDOFF.md` مرتين (§0 و§7) فتباعدا: بقي §7 يقول
// «1169 في 37» بعد أن صار الواقع غيره، **ورقمٌ متضارب في ملفّ يُقرأ قبل كل جلسة
// أخطر من رقم غائب** — من يقرأ لا يعرف أيّهما الحيّ. فصار الرقم يُطبع من هنا،
// والملفّ يذكر الأمر لا يعيد كتابته.
//
//   node tools/run-tests.js            # سطر واحد لكل ملف + المجموع
//   node tools/run-tests.js --quiet    # المجموع وحده
//   node tools/run-tests.js --list     # ماذا يحرس كل ملف، بلا تشغيل
//
// و`--list` **يشتقّ الوصف من السطر الأول في الملف نفسه**، فلا تبقى في `HANDOFF.md`
// قائمةٌ تُحدَّث بيد — وقد رأينا أين تنتهي القوائم اليدوية (قرار 34).
//
// ويخرج بـ 1 عند أي فشل، **وعند أي ملف لم يُفهَم خرْجه**: مشغّل يعدّ ما يفهمه
// ويسكت عمّا لا يفهمه يطبع مجموعاً أصغر من الحقيقة ويبدو أخضر (قرار 26).
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname);
const files = fs.readdirSync(dir).filter((f) => /^test-.*\.js$/.test(f)).sort();
const quiet = process.argv.includes("--quiet");

// ── --list: ماذا يحرس كل ملف ────────────────────────────────────────────────
// الوصف = السطر الأول من الملف، بعد `//`. مصدره الملف نفسه فلا يتباعد عنه، وملفٌ
// بلا سطر وصف **يُطبع موسوماً** لا يُتخطّى صامتاً.
if (process.argv.includes("--list")) {
  let described = 0;
  for (const f of files) {
    const first = fs.readFileSync(path.join(dir, f), "utf8").split("\n")[0].trim();
    const desc = first.startsWith("//") ? first.replace(/^\/+\s*/, "") : "";
    if (desc) described++;
    console.log(`  ${f.padEnd(30)} ${desc || "⚠️ بلا سطر وصف في أعلى الملف"}`);
  }
  console.log(`\n${described === files.length ? "✅" : "⚠️"} ${files.length} ملفاً · موصوفة: ${described}`);
  process.exit(described === files.length ? 0 : 1);
}

// الصيغتان القائمتان في المجموعة. أي ملف لا يطابق واحدة منهما يُحسب مجهولاً
// لا صفراً — والفرق بينهما هو الفرق بين «لا يوجد» و«لا أرى».
const SHAPES = [
  /نجح\s+(\d+)\s*\/\s*فشل\s+(\d+)/,
  /النتيجة:\s*(\d+)\s*ناجحة\s*·\s*(\d+)\s*فاشلة/
];

let pass = 0, fail = 0, unreadable = 0;

for (const f of files) {
  let out = "";
  let crashed = false;
  try {
    out = execFileSync(process.execPath, [path.join(dir, f)], {
      cwd: path.join(dir, ".."), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (err) {
    crashed = true;
    out = `${err.stdout || ""}${err.stderr || ""}`;
  }

  const m = SHAPES.map((re) => out.match(re)).find(Boolean);
  if (!m) {
    unreadable++;
    console.log(`  ❓ ${f} — خرْج غير مفهوم، لم يُحسب`);
    continue;
  }

  const p = Number(m[1]), q = Number(m[2]);
  pass += p; fail += q;
  if (!quiet) console.log(`  ${q || crashed ? "❌" : "✅"} ${f.padEnd(34)} ${p} ناجحة · ${q} فاشلة`);
  else if (q || crashed) console.log(`  ❌ ${f} — ${q} فاشلة`);
}

const bad = fail > 0 || unreadable > 0;
console.log(`\n${bad ? "❌" : "✅"} ${pass} تأكيداً في ${files.length} ملفاً · فاشلة: ${fail}` +
  (unreadable ? ` · غير مفهومة: ${unreadable}` : ""));
process.exit(bad ? 1 : 0);
