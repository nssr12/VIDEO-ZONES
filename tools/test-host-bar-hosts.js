// البند #143 — قائمةُ مواقع شريط التقدّم: إعلانٌ بدل استدلال.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يُرسم الشريطُ على المواقع
// التي أضفتُها وحدَها — ولا يظهر على موقعٍ سليمٍ لم أطلبه؟ وهل يكفي أن ألصق
// `https://www.tiktok.com/*` أم عليّ أن أكتب اسم الموقع بيدي؟»*
const fs = require("fs");
const vm = require("vm");

const CONTENT = fs.readFileSync("content.js", "utf8");
const OPTIONS = fs.readFileSync("options.js", "utf8");
const STORAGE = fs.readFileSync("storage.js", "utf8");
let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));
const slice = (t, from, to) => {
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
};

console.log("\n[1] البوّابةُ تسأل عن الموقع — والقائمةُ الفارغة تمنع كلَّ شيء");
{
  const ctx = {
    console, location: { host: "www.tiktok.com" },
    overlaySettings: { hostBar: true, hostBarHosts: [] },
    extensionActive: () => true, isYouTubeFamilyHost: () => false,
  };
  vm.createContext(ctx);
  // ⛔⭐ **`baseDomain` المشحونةُ نفسُها، لا نسخةٌ ساذجةٌ في الحارس.** أوّلُ
  // صياغةٍ زيّفتها بـ`replace(/^www\./)` **فطبعت أحمرَ على `vm.tiktok.com`
  // وهو سليم**: دالّةٌ مزيَّفةٌ تخالف المشحونةَ تقيس عالماً لا وجود له.
  vm.runInContext(slice(CONTENT, "const MULTI_LABEL_SUFFIXES", "// ---- END baseDomain ----"), ctx);
  vm.runInContext(slice(CONTENT, "function hostBarEnabled()", "// **الزمنُ يُكتب"), ctx);
  const on = ctx.hostBarEnabled;

  check("قائمةٌ فارغة ⇒ لا يُرسم ولو كان المفتاحُ مشغّلاً", on() === false);
  ctx.overlaySettings.hostBarHosts = ["tiktok.com"];
  check("والموقعُ في القائمة ⇒ يُرسم", on() === true);
  ctx.location.host = "vm.tiktok.com";
  check("ونطاقٌ فرعيٌّ من الموقع نفسِه ⇒ يُرسم", on() === true);
  ctx.location.host = "example.com";
  check("⭐ وموقعٌ سليمٌ خارج القائمة ⇒ لا يُرسم (بلاغُ المالك)", on() === false);
  ctx.location.host = "www.tiktok.com";
  ctx.overlaySettings.hostBar = false;
  check("والمفتاحُ مطفأٌ يغلب القائمة", on() === false);
  ctx.overlaySettings.hostBar = true;
  ctx.isYouTubeFamilyHost = () => true;
  check("⛔ ويوتيوب ممتنعٌ ولو أُضيف — شرطُ المالك", on() === false);
  ctx.isYouTubeFamilyHost = () => false;
  ctx.extensionActive = () => false;
  check("والبوّابةُ الرئيسيّة تغلب الكلَّ (#64)", on() === false);
  // ⚠️ **قيمةٌ تالفةٌ تُقرأ فارغةً لا تُرمى**: الفشلُ الآمن ألّا يُرسم
  ctx.extensionActive = () => true;
  ctx.overlaySettings.hostBarHosts = [];
  check("وقيمةٌ تالفةٌ ⇒ لا يُرسم، ولا استثناء", on() === false);
}

console.log("\n[2] والإسقاطُ يحمل مصفوفةً دائماً — فالقارئُ ينادي `.includes` بلا حارس");
{
  check("الإسقاطُ في content.js",
    /hostBarHosts: Array\.isArray\(o\.hostBarHosts\) \? o\.hostBarHosts : \[\],/.test(CONTENT));
  check("والقارئُ يستعملها بلا حارسٍ ثانٍ",
    /overlaySettings\.hostBarHosts\.includes\(baseDomain\(location\.host\)\)/.test(CONTENT));
}

console.log("\n[3] ⛔ والاستدلالُ القديم محذوفٌ لا مُعطَّل — وزنٌ بلا مستعمِلٍ كودٌ ميّت");
{
  const code = CONTENT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const name of ["SEEK_CONTROL_SELECTOR", "hostSeekLatch", "hostShowsSeekControl"])
    check(`${name} لا أثرَ له في الكود`, !code.includes(name), name);
  // **وشرطُ ضوابط المتصفّح يبقى** — وهو قراءةُ سمةٍ يعلنها المضيف لا استدلالٌ عنه
  check("⭐ وشرطُ `<video controls>` باقٍ", /if \(video\.controls === true\) on = false;/.test(CONTENT));
}

console.log("\n[4] المُطبِّع — يقبل ما يكتبه المستخدم، ويخرج بما تفهمه الإضافة");
{
  const ctx = { console, URL };
  vm.createContext(ctx);
  vm.runInContext(slice(STORAGE, "const MULTI_LABEL_SUFFIXES", "// ---- END baseDomain ----"), ctx);
  vm.runInContext(slice(OPTIONS, "function hostBarHostFromInput", "function renderHostBarHosts"), ctx);
  const f = ctx.hostBarHostFromInput;

  // ⭐ **المقبولةُ من نصّ المالك بحرفه، ومن أشكالٍ يكتبها الناس فعلاً**
  for (const [inp, want] of [
    ["https://www.tiktok.com/*", "tiktok.com"],
    ["*://*.tiktok.com/*", "tiktok.com"],
    ["*.tiktok.com", "tiktok.com"],
    ["www.tiktok.com", "tiktok.com"],
    ["  TikTok.Com  ", "tiktok.com"],
    ["http://m.tiktok.com/@x", "tiktok.com"],
    ["https://www.instagram.com/reels/", "instagram.com"],
    ["https://news.bbc.co.uk/x", "bbc.co.uk"],
  ]) check(`«${inp}» ⇒ ${want}`, f(inp) === want, f(inp));

  // ⛔ **والمرفوضةُ تُرفض بخرجٍ فارغ** — والمنادي يقول لماذا، ولا يُخزَّن شيء
  for (const inp of ["", "   ", "tiktok", "*", "javascript:alert(1)", "<script>"])
    check(`«${inp}» ⇒ مرفوض`, f(inp) === "", JSON.stringify(f(inp)));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
