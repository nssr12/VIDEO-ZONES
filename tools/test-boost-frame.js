// Audit #24: `chrome.tabs.sendMessage` without a frameId broadcasts to every frame —
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يرفع مُنزلقُ المعزّز صوتَ الفيديو الذي أشاهده وحده؟»*
// each one builds its own AudioContext, and GET_VOLUME_BOOST is answered by whichever
// frame replies first.
//
// Most of this was fixed in the S1 round (df76858 + a98d7bc + 56ca3df), an hour BEFORE
// the audit was written — the report's line numbers point at a snapshot the fix had
// already overtaken. What survived was one branch: when findVideoFrameId resolves to
// null, sendToVideoFrame fell back to a frameId-less send, restoring both harms
// verbatim. It is reachable without anything exotic: any page where no frame currently
// holds a laid-out <video> — popup opened before the player loads, click-to-play, a
// display:none player, or executeScript throwing.
const fs = require("fs");

const POPUP = fs.readFileSync("popup.js", "utf8");
if (!POPUP.includes("function sendToVideoFrame")) {
  console.log("  ❌ sendToVideoFrame غائبة");
  process.exit(1);
}
const SEND = POPUP.slice(POPUP.indexOf("// NEVER broadcasts"), POPUP.indexOf("async function loadBoostUI"));

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log("\n[1] ⭐ لا بثّ إطلاقاً — ولا في أي فرع");
{
  check("لا إرسال بلا frameId في مسار التعزيز",
    !/chrome\.tabs\.sendMessage\(boostTabId, message\)\s*;/.test(POPUP),
    POPUP.match(/chrome\.tabs\.sendMessage\(boostTabId, message\)[^,]/g));
  check("وكل إرسال يحمل frameId صراحةً",
    (SEND.match(/chrome\.tabs\.sendMessage\(boostTabId, message, \{ frameId: boostFrameId \}\)/g) || []).length >= 1);
  check("وبلا إطار محلول يرفض الإرسال بدل أن يبثّ",
    /if \(boostFrameId == null\) return Promise\.reject/.test(SEND), SEND.slice(0, 200));
}

console.log("\n[2] المحاولة الثانية لا تتدهور إلى بثّ");
{
  check("null لا يُسنَد إلى boostFrameId", /fresh == null \|\| fresh === boostFrameId\) throw err/.test(SEND), SEND);
  check("والإسناد يقع بعد الحراسة وحدها", SEND.indexOf("throw err") < SEND.indexOf("boostFrameId = fresh"));
}

console.log("\n[3] الواجهة تقول السبب بدل مُنزلق يتحرك بلا أثر");
{
  check("دالة تعطيل المُنزلق موجودة", POPUP.includes("function setBoostAvailable"));
  check("وتُستدعى بنتيجة حلّ الإطار", /setBoostAvailable\(boostFrameId != null\)/.test(POPUP));
  check("وتعطّل العنصر فعلاً", /slider\.disabled = !available/.test(POPUP));
  check("وتشرح بعنوان مرئي", /slider\.title = available \? "" : "لا فيديو/.test(POPUP));
  check("ورسالة السبب «لا يوجد فيديو»", /setBoostNote\("no_video"\)/.test(POPUP));
  check("والمُنزلق يعود إلى 100% فلا يوهم بتعزيز قائم",
    /boostFrameId == null\) \{[\s\S]{0,200}\$\("boostSlider"\)\.value = 100/.test(POPUP));
}

console.log("\n[4] اختيار الإطار: مصدر واحد");
{
  check("دالة حلّ واحدة", (POPUP.match(/async function findVideoFrameId/g) || []).length === 1);
  check("تُستعمل في مسار التعزيز", /boostFrameId = await findVideoFrameId\(tab\.id\)/.test(POPUP));
  check("وفي مسار الحالة كذلك (#56)",
    /const frameId = await findVideoFrameId\(tab\.id\)/.test(POPUP));
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
