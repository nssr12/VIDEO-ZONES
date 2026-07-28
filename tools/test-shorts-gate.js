// Audit #20: the Shorts → /watch redirect consulted only its own setting and the
// blocked list, so switching the whole extension off from the popup did not stop
// it. Owner decision 4: it is bound to the global enable, no exception.
//
// The redirect is one-way — once the URL is rewritten there is no undoing it — so
// every gate is tested in BOTH directions, and the back button is guarded by
// asserting location.replace is the only navigation used (a push would leave the
// shorts URL in history and Back would bounce straight back into it).
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}
const SRC = "content.js";
// The real remappingEnabled is sliced in, not stubbed: the point of the item is
// that the redirect asks the SAME gate the zones/keyboard/mouse paths ask.
const REMAP = slice(SRC, "function remappingEnabled", "// Per-site profiles are sharded");
const REDIRECT = slice(SRC, "function maybeRedirectShorts", "function startYtShortsRedirect");

function makeWorld({ setting = true, globalOn = true, profileOn = false, blocked = false,
                     host = "www.youtube.com", path = "/shorts/abc123XYZ_-", search = "",
                     topFrame = true } = {}) {
  const nav = [];
  const win = {};
  const ctx = {
    ytShortsRedirect: setting,
    siteRules: { enabled: globalOn, mappings: [] },
    siteProfile: { enabled: profileOn, mappings: [] },
    isYouTubeHost: () => /(^|\.)youtube\.com$/.test(host),
    isBlockedHost: () => blocked,
    location: {
      hostname: host, pathname: path, search, origin: "https://www.youtube.com",
      replace: (url) => nav.push({ how: "replace", url }),
      assign: (url) => nav.push({ how: "assign", url }),
      set href(url) { nav.push({ how: "href", url }); }
    },
    history: { pushState: (...a) => nav.push({ how: "pushState", url: a[2] }) },
    URLSearchParams,
    console
  };
  win.top = topFrame ? win : {};
  ctx.window = win;
  vm.createContext(ctx);
  vm.runInContext(REMAP + "\n" + REDIRECT, ctx);
  return { ctx, nav, go: () => { ctx.maybeRedirectShorts(); return nav; } };
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log("\n[1] الدورة المطلوبة: تفعيل ⇒ يحوّل · إيقاف ⇒ لا يحوّل · حظر ⇒ لا يحوّل");
{
  const on = makeWorld({ globalOn: true }).go();
  check("مفعّل ⇒ يحوّل", on.length === 1, on);
  check("والوجهة صحيحة", on[0]?.url === "https://www.youtube.com/watch?v=abc123XYZ_-", on);

  const off = makeWorld({ globalOn: false, profileOn: false }).go();
  check("الإضافة موقَفة ⇒ لا تحويل إطلاقاً", off.length === 0, off);

  const blocked = makeWorld({ globalOn: true, blocked: true }).go();
  check("موقع محظور ⇒ لا تحويل", blocked.length === 0, blocked);
}

console.log("\n[2] البوابة هي التفعيل العام نفسه — لا نسخة منه");
{
  const viaProfile = makeWorld({ globalOn: false, profileOn: true }).go();
  check("قاعدة موقع مفعّلة وحدها تكفي — مثل بقية المسارات", viaProfile.length === 1, viaProfile);

  const neither = makeWorld({ globalOn: false, profileOn: false }).go();
  check("الاثنان مطفآن ⇒ لا تحويل", neither.length === 0, neither);

  const w = makeWorld({ globalOn: false, profileOn: false });
  check("remappingEnabled الحقيقية مستخدمة", w.ctx.remappingEnabled() === false);
  w.ctx.siteRules.enabled = true;   // كما يفعل SITE_RULES_UPDATED من الـ popup
  check("تفعيلها فوراً يُحوّل بلا إعادة تحميل", w.go().length === 1, w.nav);
}

console.log("\n[3] إعداد التحويل نفسه ما زال يعمل");
{
  check("الإعداد مطفأ ⇒ لا تحويل ولو كانت الإضافة مفعّلة",
    makeWorld({ setting: false, globalOn: true }).go().length === 0);
}

console.log("\n[4] زر الرجوع: replace وحدها، لا push ولا assign");
{
  const nav = makeWorld().go();
  check("استُخدمت replace", nav[0]?.how === "replace", nav);
  check("ولا pushState ولا assign ولا href", !nav.some(n => n.how !== "replace"), nav);
}

console.log("\n[5] الحالات التي لا يجب أن يمسّها");
{
  check("ليست صفحة Shorts ⇒ لا تحويل",
    makeWorld({ path: "/watch" }).go().length === 0);
  check("خارج يوتيوب ⇒ لا تحويل",
    makeWorld({ host: "youtube.com.evil.com" }).go().length === 0);
  check("داخل iframe ⇒ لا تحويل",
    makeWorld({ topFrame: false }).go().length === 0);
  check("لا حلقة: بعد التحويل المسار لم يعد /shorts/",
    makeWorld({ path: "/watch", search: "?v=abc123XYZ_-" }).go().length === 0);
}

console.log("\n[6] سياق الرابط محفوظ");
{
  const nav = makeWorld({ search: "?list=PL123&t=42" }).go();
  const url = new URL(nav[0].url);
  check("v أُضيف", url.searchParams.get("v") === "abc123XYZ_-", nav);
  check("list محفوظ", url.searchParams.get("list") === "PL123", nav);
  check("t محفوظ", url.searchParams.get("t") === "42", nav);
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
