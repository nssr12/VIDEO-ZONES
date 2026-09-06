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

// #147 — **الشرطُ صار مقيَّداً بقائمة مواقع**، فيُزوَّد السياقُ بها ويُقلَب.
const ctx = { console, __onList: false };
ctx.hostAllowsLinkedVideo = () => ctx.__onList;
vm.createContext(ctx);
vm.runInContext(slice("function shouldLetNativeLinkHandlingRun", "function togglePlay"), ctx);
const gate = ctx.shouldLetNativeLinkHandlingRun;
const onList = (v) => { ctx.__onList = v; };

console.log("\n[1] البنياتُ الثلاث — والمتغيّرُ موضعُ الرابط من الفيديو");
{
  onList(false);   // الافتراضُ: خارج القائمة — وهو حالُ كلّ موقعٍ لم يُضفه المستخدم
  // (أ) لا رابطَ إطلاقاً ⇒ لا نتنحّى
  {
    const root = node("DIV"), v = node("VIDEO", root);
    check("لا رابطَ ⇒ أمرُنا يقع", gate({ target: v }, v) === false);
  }
  // (ب) رابطٌ **يلفّ** الفيديو — والحكمُ صار للقائمة (#147)
  // ⛔⭐⭐ **العطبُ الذي وُلد منه هذا التقييد**: مصغّراتُ يوتيوب `a#thumbnail`
  // **تلفّ معاينةَ التحويم وهي `<video>`** ⇒ **الشكلُ نفسُه بحرفه، والمقصودُ
  // ضدُّه** — **فمقياسٌ واحدٌ لحالين متضادّين، والفرقُ دلاليٌّ لا هندسيّ.**
  // ⛔ **والمُميِّزُ البنيويّ (#94) جُرّب فسقط بالقياس**: زرُّ السرعة لا يظهر على
  // خلاصة إنستقرام أيضاً ⇒ **الموقعان في جانبٍ واحدٍ منه.**
  {
    const root = node("DIV"), a = node("A", root); a.__link = true;
    const v = node("VIDEO", a);
    onList(true);
    check("رابطٌ يلفّ الفيديو **وموقعٌ في القائمة** ⇒ أمرُنا يقع", gate({ target: v }, v) === false);
    onList(false);
    check("⭐ والموقعُ خارجَها ⇒ نتنحّى كما قبل #145 (يوتيوب)", gate({ target: v }, v) === true);
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
  check("والرايةُ مشروطةٌ بوقوع الأمر **وبالقائمة معاً** (#147)",
    /if\(ok&&sig==="Mouse2"&&e\.type==="mousedown"&&hostAllowsLinkedVideo\(\)\)mouse2ConsumedPress=true;/.test(tail));
}


console.log("\n[3] #147 — القائمةُ تحكم الشرطين معاً، فالرجوعُ تامٌّ لا نصفيّ");
{
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  check("القائمةُ تُقرأ من التخزين",
    /linkedVideoHosts = Array\.isArray\(settings\.linkedVideoHosts\)/.test(CODE));
  check("والمضيفُ يُقاس بـ`baseDomain` كأخواتها",
    /linkedVideoHosts\.includes\(baseDomain\(location\.host\)\)/.test(CODE));
  check("والمُحمِّلُ مسجَّلٌ في البدء",
    /startup\("linkedVideoHosts"/.test(CODE));
  check("وفي مسار إعادة القراءة",
    /loadBlockedHosts\(data\), loadLinkedVideoHosts\(data\)/.test(CODE));
  // ⛔ **موضعان اثنان لا واحد**: بلا الثاني يبقى نصفُ #145 عاملاً في كلّ مكان
  // ⛔ **والتعريفُ ليس نداءً**: أوّلُ صياغةٍ عدّته فقالت «ثلاثة» عن موضعين —
  // **مطابقةٌ أوسعُ من سؤالها، في حارسٍ عن مطابقاتٍ أوسعَ من سؤالها.**
  const uses = (CODE.match(/(?<!function )hostAllowsLinkedVideo\(\)/g) || []).length;
  check(`ونداءاها موضعان (الشرطُ والراية) — الموجود ${uses}`, uses === 2, uses);
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
