// حرّاس نصّية دائمة للكود الميت المحذوف في الموجة 5 — البنود #27 و#28 و#29.
//
// 🔒 **حارسُ ثابتٍ داخليّ (#99):** يحرس **ألّا يعود كودٌ ميت حُذف** — وهو ما يُبقي بقيّة الحرّاس تقيس كوداً حيّاً. **وليس أدنى من حارس الوعد: هو ما يُبقيه ممكناً.**
//
// **الموت يُبرهَن لا يُقال** (قرار المالك): لكل بند حارس يُثبت **صفر موضع استدعاء**
// أو صفر بقية، ويبقى الحارس **دائماً** فلا يعود الرمز سهواً في جلسة قادمة.
//
// ولا يكفي «الرمز غير موجود»: الحارس يشرح **لماذا** كان ميتاً، كي يعرف من يفكّر
// في إعادته أن الإعادة تعني إعادة العطب نفسه لا إضافة ميزة.
const fs = require("fs");

const CONTENT = fs.readFileSync("content.js", "utf8");
const POPUP = fs.readFileSync("popup.js", "utf8");
const OPTIONS = fs.readFileSync("options.js", "utf8");
const BG = fs.readFileSync("background.js", "utf8");
const STORAGE = fs.readFileSync("storage.js", "utf8");
const ALL = { "content.js": CONTENT, "popup.js": POPUP, "options.js": OPTIONS,
              "background.js": BG, "storage.js": STORAGE };

// يجرّد التعليقات: ذكر رمز محذوف **في تعليق تأريخي** ليس عودةً له.
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

console.log("\n[#27] tryEnableYouTubeCC — كانت ميتة 100% بالبناء");
{
  // لماذا كانت ميتة: أول سطر فيها `if (!isYouTubeHost()) return;`، ومستدعيها
  // الوحيد كان داخل فرع **`else` لـ `if (isYouTubeHost())`** — أي أنها لم تُنفَّذ
  // سطراً واحداً بعد الحارس، في أي موقع، أبداً.
  for (const [file, src] of Object.entries(ALL)) {
    check(`لا ذكر لها في ${file}`, !/tryEnableYouTubeCC/.test(code(src)));
  }
  // والحارس البنيوي: الفرع الذي كان يستدعيها لم يعد فيه استدعاء ميت.
  const m = /if \(isYouTubeHost\(\)\) \{[\s\S]{0,400}?\} else \{([\s\S]{0,300}?)\}/.exec(code(CONTENT));
  check("فرع «ليس يوتيوب» في applySubtitleTrack زال أو خلا من استدعاء",
    !m || !/\w+\s*\(/.test(m[1]), m && m[1]);
  check("و applySubtitleTrack ما زالت تنادي youtubeSetCaptionLanguage على يوتيوب",
    /isYouTubeHost\(\)[\s\S]{0,200}youtubeSetCaptionLanguage\(lang\)/.test(code(CONTENT)));
}

console.log("\n[#28] فرع else if (track.mode === \"showing\") الفارغ");
{
  // لماذا كان ميتاً: جسمه **تعليق فقط**، فالشرط يُحسب ولا يفعل شيئاً — نيّة
  // غير منفّذة لا سلوك. حذفه لا يغيّر أي مسار لأن الفرع كان لا يفعل شيئاً أصلاً.
  check("لا فرع على track.mode === \"showing\"",
    !/else\s+if\s*\(\s*track\.mode\s*===\s*["']showing["']\s*\)/.test(code(CONTENT)));
  check("والإسناد track.mode = \"showing\" باقٍ — هو السلوك الحقيقي",
    /track\.mode\s*=\s*["']showing["']/.test(code(CONTENT)));
  check("و enableMatchingTextTrack ما زالت تُرجع foundMatch",
    /function enableMatchingTextTrack[\s\S]{0,600}?return foundMatch;/.test(code(CONTENT)));
}

console.log("\n[#29] كتلة chrome.tabs.query المعطّلة بالتعليق");
{
  // لماذا كانت ميتة مرتين: معطّلة بالتعليق **و** `chrome.tabs` غير متاح في سكربت
  // المحتوى أصلاً، فلو أُزيل التعليق لرمت فوراً.
  // على **الاستدعاء** لا على ذكر الاسم: الحارس يجب أن يمنع عودة الكتلة معطّلةً
  // بالتعليق، ولا يمنع التعليق التأريخي من تسميتها. أُسقطني هذا فعلاً عند كتابته.
  check("لا استدعاء chrome.tabs.query في content.js حتى داخل تعليق",
    !/chrome\.tabs\.query\s*\(/.test(CONTENT));
  check("ولا chrome.tabs إطلاقاً — غير متاح في سكربت المحتوى",
    !/chrome\.tabs\b/.test(code(CONTENT)));
  check("و chrome.storage.onChanged باقٍ — قناة التوصيل الاحتياطية",
    /chrome\.storage\.onChanged\.addListener/.test(code(CONTENT)));
  check("و requestReload ما زال يُنادى منها", /if \(ours\) requestReload\(\);/.test(code(CONTENT)));
}

console.log("\n[عام] لا كتلة كود معطّلة بالتعليق في نهاية content.js");
{
  const tail = CONTENT.slice(-1200);
  check("لا /* ... */ يحوي chrome.* في آخر الملف",
    !/\/\*[\s\S]*chrome\.[\s\S]*\*\//.test(tail));
  check("الملف ينتهي بإغلاق كتلة الحارس", /\}\s*$/.test(CONTENT.trimEnd() + "\n"));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
