// البند #63 — مفتاح إظهار سطر تلميح المربّع («Zone B1 • DOWN → ACTION:VOLUME:-4»).
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل يظهر سطرُ تلميح المربّع عند تنفيذ أمره، ويختفي إن أطفأتُه؟»*
//
// ⚠️ **الحارس الأهمّ هنا ليس المفتاح بل ما لا يمسّه:** منصّات §8 و§9 و§10 تعتمد
// **ظهور الشبكة** في خطوات كثيرة («مرّر العجلة ← الشبكة تظهر»). فلو أطفأ هذا
// الخيار الشبكةَ مع التلميح **لأسقط خطوات اختبار قائمة بصمت** — وخيارٌ جديد
// يُسقط خطوة منصّة بصمت **عطبٌ في المنصّة لا في الخيار** (قرار المالك).
// ولذلك: **التلميح وحده يُطفأ، والشبكة تبقى** — ويُثبَّت هنا بالفحص لا بالنيّة.
const fs = require("fs");
const vm = require("vm");

function slice(from, to) {
  const t = fs.readFileSync("content.js", "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  return a === -1 || b === -1 ? null : t.slice(a, b);
}

const CONTENT = fs.readFileSync("content.js", "utf8");
const OPTIONS = fs.readFileSync("options.js", "utf8");
const HTML = fs.readFileSync("options.html", "utf8");
const SHOW = slice("function showOverlay(text) {", "function hideOverlayNow()");
const LOADER = slice("async function loadOverlaySettings(pre)", "function showOverlay(text)");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// عالم مصغّر: عنصرا الشبكة والتلميح يسجّلان ما يقع عليهما
function makeWorld(hintEnabled) {
  const cls = (name) => {
    const set = new Set(["vzHidden"]);
    return { __name: name, set,
      add: (c) => set.add(c), remove: (c) => set.delete(c),
      contains: (c) => set.has(c) };
  };
  const grid = { classList: cls("grid") };
  const hint = { classList: cls("hint"), textContent: "" };
  const ctx = {
    console, setTimeout: () => 0, clearTimeout: () => {},
    overlaySettings: { enabled: true, autoHideMs: 900, volumeAutoHideMs: 900, hintEnabled },
    vzGridEl: grid, vzHintEl: hint,
    positionOverlayToVideo() {}, startOverlayTracking() {}
  };
  vm.createContext(ctx);
  vm.runInContext(SHOW, ctx);
  return { ctx, grid, hint, show: (t) => vm.runInContext("showOverlay", ctx)(t) };
}

console.log("\n[1] المفتاح يُطفئ التلميح **ولا يمسّ الشبكة**");
{
  const on = makeWorld(true);
  on.show("Zone B1 • DOWN → ACTION:VOLUME:-4");
  check("مُفعَّلاً: التلميح ظاهر", !on.hint.classList.contains("vzHidden"));
  check("والشبكة ظاهرة", !on.grid.classList.contains("vzHidden"));
  check("والنصّ مكتوب", on.hint.textContent.includes("Zone B1"));

  const off = makeWorld(false);
  off.show("Zone B1 • DOWN → ACTION:VOLUME:-4");
  check("مُطفأً: التلميح مخفيّ", off.hint.classList.contains("vzHidden"));
  // ⚠️ **هذا هو الحارس**: إطفاء التلميح لا يُسقط خطوات §8 و§9 و§10
  check("**والشبكة تبقى ظاهرة** — منصّات الاختبار تعتمدها",
    !off.grid.classList.contains("vzHidden"), "خيار يُسقط خطوة منصّة بصمت");
}

console.log("\n[2] الافتراض **الحالي (ظاهر)** — لا يتغيّر سلوك أحد بلا طلبه");
{
  // `!== false` لا `=== true`: من لم يفتح الإعدادات قط يبقى التلميح عنده ظاهراً
  check("المُحمِّل يقرأ hintEnabled بـ `!== false`",
    /hintEnabled: o\.hintEnabled !== false/.test(LOADER), LOADER && LOADER.slice(-200));
  check("والقيمة الابتدائية في content.js ظاهرة",
    /let overlaySettings = \{[^}]*hintEnabled: true/.test(CONTENT));
  check("وافتراض options.js ظاهر",
    /settings\.overlay\.hintEnabled !== "boolean"\) settings\.overlay\.hintEnabled = true/.test(OPTIONS));
}

console.log("\n[3] المسار كامل: واجهة ⇄ تخزين ⇄ سكربت المحتوى");
{
  // ⚠️ **ثلاث مراسٍ صُحّحت لا تأكيدات أُضعفت (قرار 33، #77):** الضابط ووسمه
  // **صارا يُولَّدان** من `settings-ui.js` — فلم يعودا في `options.html` بيد.
  // **والنيّة نفسها محروسةٌ أقوى**: السجلّ **يضمن وجودهما لكل مفتاح**، ولا
  // يعتمد على أن أحداً كتب السطر.
  const UI = fs.readFileSync("settings-ui.js", "utf8");
  check("الضابط في سجلّ المُولِّد", /\{ id: "zoneHintEnabled", kind: "toggle"/.test(UI));
  check("ووسمه يقول ما يقع عند التأشير", /label: "إظهار سطر تلميح المربّع"/.test(UI));
  check("وتلميحه يذكر المثال الذي يراه المستخدم", /Zone B1/.test(UI));
  check("ونقطة التركيب في options.html", /id="timingList"/.test(HTML));
  check("ويُقرأ عند العرض من السجلّ",
    /if \(id === "zoneHintEnabled"\) return o\.hintEnabled !== false;/.test(OPTIONS));
  // ⚠️ **مرساةٌ صُحّحت لا تأكيدٌ أُضعف (قرار 33، #78):** صار الحفظ **ضابطاً
  // واحداً ⇒ حقلاً واحداً** عبر سجلّ `TIMING_CONTROLS`، فالنيّة نفسها والموضع
  // تغيّر — والحقل ما زال `overlay.hintEnabled` ومصدره الضابط نفسه.
  check("ويُحفظ في overlay.hintEnabled",
    /zoneHintEnabled:\s*\(s, el\) => \{ s\.overlay\.hintEnabled = el\.checked; \}/.test(OPTIONS));
  check("ومربوطٌ بالبناء لا بسطرٍ مكتوب",
    /if \(onChange\) input\.addEventListener\("change", \(\) => onChange\(c\.id\)\)/.test(UI));
  // بلا رسالة جديدة: يمرّ على RELOAD_OVERLAY_SETTINGS القائمة
  check("ولا رسالة جديدة — يمرّ على RELOAD_OVERLAY_SETTINGS",
    /RELOAD_OVERLAY_SETTINGS/.test(OPTIONS) && !/RELOAD_ZONE_HINT/.test(OPTIONS + CONTENT));
  check("ولا مفتاح تخزين جديد — داخل settings.overlay",
    !/settings\.zoneHint|s\.zoneHint/.test(OPTIONS));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
