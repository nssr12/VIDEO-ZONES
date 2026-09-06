// البند #145 — بوّابةُ الروابط في مسار الفأرة (`shouldLetNativeLinkHandlingRun`).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن ربطتُ زرَّ الفأرة بأمر، أيقع
// أمري على فيديو الخلاصة الملفوف برابطِ المنشور — أم يفتح المتصفّحُ تبويباً
// وقائمةً بدلاً منه؟ وهل تبقى بطاقاتُ نهاية يوتيوب المرسومةُ فوق الفيديو
// تُنقَر كما كانت؟»*
//
// ⛔⭐⭐ **والحارسُ سلوكيٌّ لا نصّيّ**: يُشغّل الدالّةَ المشحونة نفسَها على
// ثلاثِ بنياتٍ حقيقيّة، **فحذفُ السطر يُحمّره** ولا ينجو بإعادة صياغة.
// والبنيةُ الثالثة مقيسةٌ في لقطة `tools/snapshots` لا مُتخيَّلة: **تسعةَ عشرَ
// رابطاً داخل `#movie_player` وصفرٌ منها يلفّ الفيديو.**
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

function slice(from, to) {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return SRC.slice(a, b);
}

// ── شجرةٌ صغيرةٌ مزيَّفة، وكلُّ عقدةٍ تعرف `contains` و`closest` ──────────────
function node(tag, parent) {
  const n = {
    tagName: tag, parentElement: parent || null, children: [], __link: false,
    contains(x) { for (let c = x; c; c = c.parentElement) if (c === n) return true; return false; },
    closest(sel) {
      const wantsLink = /a\[href\]|role='link'/.test(sel);
      for (let c = n; c; c = c.parentElement) if (wantsLink && c.__link) return c;
      return null;
    },
  };
  if (parent) parent.children.push(n);
  return n;
}

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(slice("function shouldLetNativeLinkHandlingRun", "function togglePlay"), ctx);
const gate = ctx.shouldLetNativeLinkHandlingRun;

console.log("\n[1] البنياتُ الثلاث — والمتغيّرُ موضعُ الرابط من الفيديو");
{
  // (أ) لا رابطَ إطلاقاً ⇒ لا نتنحّى
  {
    const root = node("DIV"), v = node("VIDEO", root);
    check("لا رابطَ ⇒ أمرُنا يقع", gate({ target: v }, v) === false);
  }
  // (ب) رابطٌ **يلفّ** الفيديو — غلافُ منشورٍ في خلاصة إنستقرام ⇒ أمرُنا يقع
  {
    const root = node("DIV"), a = node("A", root); a.__link = true;
    const v = node("VIDEO", a);
    check("رابطٌ يلفّ الفيديو (إنستقرام) ⇒ أمرُنا يقع", gate({ target: v }, v) === false);
  }
  // (ج) رابطٌ **مرسومٌ فوقه** ولا يلفّه — بطاقةُ نهاية يوتيوب ⇒ نتنحّى
  {
    const root = node("DIV"), v = node("VIDEO", root);
    const a = node("A", root); a.__link = true;
    check("رابطٌ فوق الفيديو ولا يلفّه (يوتيوب) ⇒ نتنحّى", gate({ target: a }, v) === true);
  }
  // (د) رابطٌ **داخل** الفيديو — الحالُ التي كانت محروسةً قبلُ، تبقى
  {
    const root = node("DIV"), v = node("VIDEO", root);
    const a = node("A", v); a.__link = true;
    check("رابطٌ داخل الفيديو ⇒ أمرُنا يقع (كما كان)", gate({ target: a }, v) === false);
  }
  // (هـ) رابطٌ وبلا فيديو مُحلول ⇒ نتنحّى، وهي حالُ الملفّ الأصليّة
  {
    const root = node("DIV"), a = node("A", root); a.__link = true;
    check("رابطٌ بلا فيديو ⇒ نتنحّى", gate({ target: a }, null) === true);
  }
}

console.log("\n[2] العلّةُ الثانية — الإلغاءُ في `auxclick` لا في `mousedown`");
{
  // ⛔ **وهذا نصّيٌّ باعتراف**: أثرُه في المتصفّح لا في `vm`، ويُقاس في
  // `tools/repro-145-link-video.mjs`. **وما يُحرَس هنا ثلاثةٌ بنيويّة**:
  // أن يوجد الإلغاء · وأن يسبق مانعَ التكرار · وألّا يوقف الانتشار.
  const body = slice('if (sig === "Mouse2") {', 'if (sig === "Mouse3")').replace(/\s+/g, "");
  check("إلغاءٌ في auxclick موجود", /e\.type==="auxclick"&&mouse2ConsumedPress/.test(body));
  const iAux = body.indexOf('e.type==="auxclick"&&mouse2ConsumedPress');
  const iDeb = body.indexOf("lastMouse2At<350");
  check("وقبل مانع التكرار — تحته لا يُبلَغ", iAux > -1 && iDeb > -1 && iAux < iDeb, `${iAux} / ${iDeb}`);
  const blk = body.slice(iAux, iDeb);
  check("و`preventDefault` فيه", /preventDefault\(\)/.test(blk));
  check("⛔ ولا وقفَ انتشارٍ — أوسعُ من سؤاله", !/stopPropagation|stopImmediatePropagation/.test(blk));
  // **والرايةُ تُرفع على الأمر الواقع لا على الضغطة** (شكلُ #33)
  const tail = SRC.replace(/\s+/g, "");
  check("والرايةُ مشروطةٌ بوقوع الأمر",
    /if\(ok&&sig==="Mouse2"&&e\.type==="mousedown"\)mouse2ConsumedPress=true;/.test(tail));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
