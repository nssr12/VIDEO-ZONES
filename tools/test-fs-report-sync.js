// حارس انحراف بين tools/report-fullscreen-bug.js و content.js.
//
// المقطع التشخيصي يعيش في **عالم الصفحة** فلا يستطيع استدعاء دوال سكربت المحتوى،
// فنسخ منطق `pickFullscreenContainer` فيه ضرورة لا خيار. وما دامت نسخةً، فلا بدّ
// من حارس نصّي مثل الكتل المقترنة بين storage.js و content.js: أي تغيير في السكور
// أو في المحدّدات داخل content.js **يجب** أن يُسقط هذا الاختبار حتى يُنقل معه.
const fs = require("fs");

const CONTENT = fs.readFileSync("content.js", "utf8");
const REPORT = fs.readFileSync("tools/report-fullscreen-bug.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// يُجرّد المسافات وأسطر التعليق كي تُقارَن القيم لا التنسيق
const squash = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\s+/g, "");

const CS = squash(CONTENT), RS = squash(REPORT);

console.log("\n[1] الثوابت الرقمية للسكور متطابقة");
{
  // Math.max(0, 2 - Math.abs(areaRatio - 1.15))
  const ideal = (s) => (s.match(/Math\.abs\(areaRatio-([\d.]+)\)/) || [])[1];
  const iC = ideal(CS), iR = ideal(RS);
  check("النسبة المثالية موجودة في content.js", !!iC, iC);
  check("وموجودة في المقطع", !!iR, iR);
  check(`متطابقتان (${iC} = ${iR})`, !!iC && iC === iR, `${iC} ≠ ${iR}`);

  // if (areaRatio > 3.5) return null
  const maxR = (s) => (s.match(/areaRatio>([\d.]+)\)returnnull/) || [])[1];
  const mC = maxR(CS), mR = maxR(RS);
  check("سقف نسبة المساحة موجود في الملفين", !!mC && !!mR, `${mC} / ${mR}`);
  check(`متطابق (${mC} = ${mR})`, !!mC && mC === mR, `${mC} ≠ ${mR}`);

  // for (let i = 0; i < 8 && cur; i++)
  const depth = (s) => (s.match(/i<(\d+)&&cur;i\+\+/) || [])[1];
  const dC = depth(CS), dR = depth(RS);
  check("عمق المرشّحين موجود في الملفين", !!dC && !!dR, `${dC} / ${dR}`);
  check(`متطابق (${dC} = ${dR})`, !!dC && dC === dR, `${dC} ≠ ${dR}`);
}

console.log("\n[2] معادلة السكور نفسها حرفياً");
{
  const expr = /\(hasButtons\?3:0\)\+\(looksPlayer\?2:0\)\+\(el===video\?0:1\)\+Math\.max\(0,2-Math\.abs\(areaRatio-1\.15\)\)/;
  check("المعادلة في content.js", expr.test(CS));
  check("المعادلة نفسها في المقطع", expr.test(RS));
}

console.log("\n[3] محدِّد الحاويات المعروفة متطابق");
{
  const grab = (s) => {
    const m = s.match(/KNOWN_PLAYER_WRAPPER_SELECTOR=([^;]+);/);
    return m ? m[1].replace(/["'+]/g, "") : null;
  };
  const a = grab(CS), b = grab(RS);
  check("موجود في content.js", !!a, a);
  check("موجود في المقطع", !!b, b);
  check("متطابق حرفياً", !!a && a === b, `\n    content: ${a}\n    report : ${b}`);
  for (const sel of ["#movie_player", ".html5-video-player", ".video-player",
                     "data-a-target='video-player'", ".jw-wrapper", ".video-js", ".plyr", ".vjs-fluid"]) {
    check(`يشمل ${sel}`, !!a && a.includes(sel.replace(/["']/g, "")));
  }
}

console.log("\n[4] محدِّدات زر ملء الشاشة الأصلي متطابقة");
{
  // ⚠️ لا [^\]]+ هنا: المحدّدات نفسها تحتوي على ']' (مثل
  // button[data-a-target='…']) فيتوقّف الالتقاط عند أولها ويقارن جزءاً لا كلاً.
  // أُسقط الاختبار على هذا فعلاً عند كتابته.
  const grab = (s) => {
    const m = s.match(/NATIVE_FS_BUTTON_SELECTORS=\[([\s\S]*?)\];/);
    return m ? m[1].replace(/["']/g, "") : null;
  };
  const a = grab(CS), b = grab(RS);
  check("موجودة في الملفين", !!a && !!b, `${a} / ${b}`);
  check("متطابقة حرفياً", !!a && a === b, `\n    content: ${a}\n    report : ${b}`);
  check("خمسة محدّدات لا أكثر ولا أقل", !!a && a.split(",").length === 5, a && a.split(",").length);
}

console.log("\n[5] المقطع تشخيصي لا يُشحن، ولا يلمس التخزين ولا chrome.*");
{
  check("غير مذكور في manifest.json",
    !fs.readFileSync("manifest.json", "utf8").includes("report-fullscreen-bug"));
  check("لا chrome.* فيه", !/chrome\./.test(RS));
  check("لا كتابة تخزين", !/localStorage|sessionStorage|storage\.sync/.test(RS));
  check("يطبع سطراً واحداً موسوماً VZ58", /VZ58/.test(REPORT));
  check("يحمل الرابط في السطر", /location\.href/.test(RS));
  check("يذكر حكم البوابة", /البوابة=/.test(REPORT));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
