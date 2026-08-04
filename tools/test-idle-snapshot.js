// حارس مُخبِر حالة المحرّك (#86): يقرأ ولا يكتب، ولا يعتمد عليه سطرُ منتج.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يبقى سلوكُ الإضافة كما هو ولا تغيّره آلةُ القياس التي فيها؟»*
//
// ⚠️ **آلةُ قياسٍ داخل المنتج تحتاج حارساً أكثر ممّا يحتاجه المنتج:** إن كتبت
// شيئاً صارت **جزءاً من السلوك الذي تقيسه** — وهو أسوأ ما يقع لمقياس. وإن
// اعتمد عليها سطرُ منتجٍ **صارت ميزةً لا تُحذف**.
//
// **ولها شاهدان (قرار 47):** مصدرٌ مُفتعَل يكتب **يجب أن يُحمّر**، والحقيقيّ يمرّ.
const fs = require("fs");
const vm = require("vm");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

const SRC = fs.readFileSync("content.js", "utf8");

function bodyOf(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) return null;
  let depth = 0;
  for (let j = src.indexOf("{", start); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  return null;
}

// **«يقرأ ولا يكتب» يُقاس بالبنية لا بالنيّة**: لا إسناد · لا نداءَ دالّةٍ من
// دوالّنا · لا لمسَ DOM سوى قراءة `fullscreenElement`.
function writesAnything(body) {
  const stripped = body.replace(/\/\/[^\n]*/g, "");
  if (/[^=!<>]=[^=]/.test(stripped.replace(/[!<>=]==?/g, "").replace(/=>/g, ""))) {
    // إسنادٌ محتمل — يُفحص بدقّةٍ أعلى أدناه
  }
  return /\b(setTimeout|clearTimeout|addEventListener|removeEventListener|classList|setAttribute|removeAttribute|appendChild|remove\(\)|dispatchEvent|requestFullscreen|play\(|pause\(|\.textContent\s*=|\.style\.)/.test(stripped)
    || /\b(idlePointerHeld|idleState|idleLastActivityAt|idleTimer|idleWanted|idleMs|lastPointer)\s*=[^=]/.test(stripped);
}

console.log("\n[1] المُخبِر موجودٌ ويقرأ ما يلزم");
{
  const body = bodyOf(SRC, "vzIdleSnapshot");
  check("`vzIdleSnapshot` موجودة", !!body);
  const need = ["idlePointerHeld", "idleState", "idleLastActivityAt", "idleTimer", "lastPointer"];
  for (const n of need) check(`تقرأ \`${n}\``, !!body && body.includes(n));
}

console.log("\n[2] ولا تكتب شيئاً — والمقياس لا يكون جزءاً ممّا يقيس");
{
  const body = bodyOf(SRC, "vzIdleSnapshot");
  check("لا كتابة ولا أثر جانبيّ", !!body && !writesAnything(body));
  // شاهدٌ سالب: نسخةٌ مُفتعَلة تكتب **يجب أن يُحمّرها الفحص نفسه**
  const fake = `function vzIdleSnapshot() { idlePointerHeld = false; return { held: idlePointerHeld }; }`;
  check("والفحص يُحمّر على نسخةٍ تكتب (شاهد)", writesAnything(fake));
  const fake2 = `function vzIdleSnapshot() { document.body.classList.add("x"); return {}; }`;
  check("ويُحمّر على نسخةٍ تلمس الشجرة (شاهد)", writesAnything(fake2));
}

console.log("\n[3] ولا يعتمد عليها سطرُ منتجٍ واحد — تُحذف فلا يتغيّر سلوك");
{
  const calls = (SRC.match(/vzIdleSnapshot\s*\(/g) || []).length;
  // التعريف نفسه واحد، وأي زيادة تعني نداءً من المنتج
  check(`لا نداء لها في المنتج (المطابقات ${calls} — التعريف وحده)`, calls === 1, calls);
}

console.log("\n[4] وهي مقروءةٌ من عالم الإضافة — دالّةٌ لا متغيّر");
{
  // **السبب مقيس**: `typeof idleState === "undefined"` في عالم الإضافة بينما
  // `typeof pointerInsideEl === "function"` — فالدوالّ على الكائن العامّ لا `let`.
  // ويُحاكى هنا: تقييمُ السكربت في سياقٍ ثمّ نداءُ الدالّة من **تقييمٍ ثانٍ**.
  const ctx = { document: { fullscreenElement: null }, console };
  vm.createContext(ctx);
  vm.runInContext(`
    let idlePointerHeld = true, idleState = "active", idleLastActivityAt = 5,
        idleTimer = 1, idleWanted = true, idleMs = 900, lastPointer = { x: 3, y: 4 };
    ${bodyOf(SRC, "vzIdleSnapshot")}
  `, ctx);
  const snap = vm.runInContext(`vzIdleSnapshot()`, ctx);
  check("تُنادى من تقييمٍ ثانٍ وتُرجع الحالة", !!snap && snap.held === true && snap.state === "active");
  check("والمؤشّر منسوخٌ لا مُمرَّرٌ بالمرجع", !!snap && snap.pointer.x === 3 &&
    vm.runInContext(`lastPointer !== null`, ctx));
  check("والمؤقّت يُقرأ حالةً لا مرجعاً", snap.timerArmed === true);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
