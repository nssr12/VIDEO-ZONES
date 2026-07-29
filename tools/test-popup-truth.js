// Audit #56 — a REGRESSION introduced by #13b, not an old defect.
//
// #13b made a frame with no video skip startup. The onMessage listener sits at top
// level, outside that gate, so a sleeping frame kept answering GVZ_STATUS from its
// untouched defaults: blockedHosts [], siteRules.enabled false. Measured with the real
// content.js on a blocked site with the extension globally enabled:
//   {ok:true, blocked:false, globalEnabled:false}  with ZERO storage reads
// and the popup printed «الإضافة متوقفة». Everyday on any page whose top frame holds
// no video — most of the web.
//
// The root, though, is older than #13b: the popup was asking a content script for
// facts IT owns. "Is the extension enabled" is a stored setting; "is this site
// blocked" is a function of (tab URL, blockedHosts). A frame cannot know either better
// than storage does — the sleeping frame merely exposed the mistake.
//
// So this test guards the rule, not the symptom: those two facts are computed in the
// popup, they are gone from GVZ_STATUS, and "no video here" is never reported as
// "the extension is stopped".
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const POPUP = fs.readFileSync("popup.js", "utf8");
const STORAGE = fs.readFileSync("storage.js", "utf8");
if (!POPUP.includes("function readHostGates")) {
  console.log("  ❌ readHostGates غائبة — البند #56 غير منفَّذ");
  process.exit(1);
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log("\n[1] ⭐ الإطار النائم يردّ not-started ولا يستيقظ");
{
  // نستخرج معالج GVZ_STATUS ونشغّله في الحالتين
  const handler = SRC.slice(SRC.indexOf('if (msg?.type === "GVZ_STATUS")'),
    SRC.indexOf('if (msg?.type === "SITE_RULES_UPDATED")'));
  const run = (begun, hasVideo) => {
    let answer = null, woke = false;
    const ctx = {
      msg: { type: "GVZ_STATUS" },
      startupBegun: begun,
      sendResponse: (r) => { answer = r; },
      document: { querySelector: () => (hasVideo ? {} : null) },
      getVideoFromPointerPosition: () => null,
      ytQualityGap: () => null,
      beginStartup: () => { woke = true; },
      wakeIfVideoPresent: () => { woke = true; },
      console
    };
    vm.createContext(ctx);
    vm.runInContext(`(function(){ ${handler} })()`, ctx);
    return { answer, woke };
  };

  const asleep = run(false, true);
  check("النائم يردّ ok:false", asleep.answer?.ok === false, asleep.answer);
  check("وبسبب not-started", asleep.answer?.reason === "not-started", asleep.answer);
  check("ولا يستيقظ للرسالة", asleep.woke === false);
  check("ولا يفشي حالة تفعيل ولا حظر",
    !("blocked" in (asleep.answer || {})) && !("globalEnabled" in (asleep.answer || {})), asleep.answer);

  const awake = run(true, true);
  check("العامل يردّ ok:true", awake.answer?.ok === true, awake.answer);
  check("ويقول إن فيه فيديو", awake.answer?.hasVideo === true, awake.answer);
}

console.log("\n[2] ⭐ الحقلان خرجا من GVZ_STATUS نهائياً");
{
  const handler = SRC.slice(SRC.indexOf('if (msg?.type === "GVZ_STATUS")'),
    SRC.indexOf('if (msg?.type === "SITE_RULES_UPDATED")'));
  for (const field of ["blocked:", "globalEnabled", "siteProfileEnabled"]) {
    check(`«${field}» لم يعد في الردّ`, !handler.includes(field), handler.slice(0, 200));
  }
  check("ولا يُشتقّ الحظر داخل المعالج", !handler.includes("isBlockedHost"));
  check("ويبقى ما يملكه الإطار وحده", handler.includes("hasVideo") && handler.includes("ytQualityGap"));
}

console.log("\n[3] الـ popup يحسبهما بنفسه من التخزين ورابط التبويب");
{
  check("readHostGates تقرأ التخزين", /chrome\.storage\.sync\.get\(\{[\s\S]{0,160}globalSiteRules/.test(POPUP));
  check("وتستعمل isHostBlocked المشتركة", POPUP.includes("isHostBlocked(host, settings.blockedHosts)"));
  check("ولا نسخة ثالثة في popup.js",
    !/blockedHosts\.includes\(/.test(POPUP), POPUP.match(/blockedHosts\.includes\([^)]*\)/g));
  check("وواجهة زر الحظر تستعمل نفس الدالة", POPUP.includes("isHostBlocked(currentHost, settings.blockedHosts)"));
  check("والمشتقّ الوحيد في storage.js", STORAGE.includes("function isHostBlocked(host, blockedHosts)"));

  // سلوك isHostBlocked نفسه
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(STORAGE.slice(STORAGE.indexOf("const MULTI_LABEL_SUFFIXES"),
    STORAGE.indexOf("function normalizeKeyCombo")), ctx);
  check("bbc.co.uk محظور لا يحظر co.uk كلها",
    vm.runInContext(`isHostBlocked("www.bbc.co.uk", ["bbc.co.uk"])`, ctx) === true &&
    vm.runInContext(`isHostBlocked("www.theguardian.co.uk", ["bbc.co.uk"])`, ctx) === false);
  check("وقائمة فارغة أو غائبة ⇒ غير محظور",
    vm.runInContext(`isHostBlocked("a.com", [])`, ctx) === false &&
    vm.runInContext(`isHostBlocked("a.com", undefined)`, ctx) === false);
}

console.log("\n[4] ⭐ «لا فيديو» ≠ «الإضافة متوقفة»");
{
  const fn = POPUP.slice(POPUP.indexOf("async function checkPageStatus"),
    POPUP.indexOf("// normalizeHost() and baseDomain() come from storage.js"));
  const body = POPUP.slice(POPUP.indexOf("async function checkPageStatus"));
  check("رسالة «لا فيديو» موجودة", body.includes("لا فيديو في هذه الصفحة"));
  check("ولا تُخلط بـ «متوقفة»",
    /!res\?\.ok \|\| !res\.hasVideo\)[\s\S]{0,120}لا فيديو/.test(body), body.slice(0, 40));
  check("و«متوقفة» تُقرَّر من التخزين لا من ردّ الإطار",
    /gates\.globalEnabled && !gates\.siteProfileEnabled[\s\S]{0,140}متوقفة/.test(body));
  check("و«محظورة» كذلك", /gates\.blocked\)[\s\S]{0,120}محظورة/.test(body));
  check("ولا يُقرأ res.blocked ولا res.globalEnabled إطلاقاً",
    !/res\.blocked|res\.globalEnabled|res\.siteProfileEnabled/.test(POPUP),
    POPUP.match(/res\.(blocked|globalEnabled|siteProfileEnabled)/g));
}

console.log("\n[5] اختيار الإطار موحَّد بين مسار الحالة ومسار التعزيز");
{
  const status = POPUP.slice(POPUP.indexOf("async function checkPageStatus"),
    POPUP.indexOf("async function readSiteRules") > 0 ? POPUP.indexOf("async function readSiteRules") : POPUP.length);
  check("مسار الحالة يستعمل findVideoFrameId", status.includes("findVideoFrameId"));
  check("ولا يبثّ بلا frameId",
    !/sendMessage\(tab\.id, \{ type: "GVZ_STATUS" \}\)(?!,)/.test(POPUP),
    POPUP.match(/sendMessage\(tab\.id, \{ type: "GVZ_STATUS" \}[^)]*\)/g));
  check("ودالة واحدة فقط تحلّ الإطار",
    (POPUP.match(/async function findVideoFrameId/g) || []).length === 1);
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
