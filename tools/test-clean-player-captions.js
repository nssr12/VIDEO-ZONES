// Audit #18: Clean Player hid .ytp-subtitles-button and .ytp-settings-button with
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن فعّلتُ أتمتة الترجمة، أيبقى زرّا الترجمة والإعدادات ظاهرَين كي تعمل؟»*
// display:none, while the caption-language automation drives YouTube's menu by
// CLICKING them and findVisibleYTMenuItem demands a non-zero rect — so ticking
// those two boxes silently killed the language feature.
//
// Owner decision 5: exempt them automatically whenever the automation is on, with
// no prompt. Two constraints tested here: the exemption is tied to the automation
// ALONE (whoever leaves it off keeps Clean Player untouched), and switching the
// automation off re-hides them immediately — the CSS is recomputed, not cached.
//
// NOTE: `cleanPlayerSettings` is a `let` inside the sliced source, so it must be
// written THROUGH the vm (runInContext) — assigning ctx.cleanPlayerSettings only
// creates a context property that the script's own binding shadows, and the
// assertions then pass against defaults instead of the case under test.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}
const CLEAN = slice("content.js", "const CLEAN_PLAYER_ITEMS", "function isBlockedHost");

const SUB_BTN = ".ytp-subtitles-button";
const SET_BTN = ".ytp-settings-button";

function makeWorld({ items = {}, enabled = true, subtitles = { enabled: false, defaultLang: "" },
                     host = "www.youtube.com", blocked = false } = {}) {
  const injected = [];
  const ctx = {
    location: { hostname: host },
    isBlockedHost: () => blocked, extensionActive: () => !blocked,
    subtitleSettings: { ...subtitles },
    blockedHosts: [],
    chrome: { storage: { sync: { get: async (d) => d } } },
    document: {
      createElement: () => {
        const el = {
          id: "", textContent: "",
          remove() { const i = injected.indexOf(el); if (i >= 0) injected.splice(i, 1); }
        };
        return el;
      },
      documentElement: { appendChild: (el) => injected.push(el) }
    },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(CLEAN, ctx);
  const read = (expr) => vm.runInContext(expr, ctx);
  read(`cleanPlayerSettings = ${JSON.stringify({ enabled, items })};`);
  return {
    ctx, injected, read,
    css() { read("applyCleanPlayerCSS()"); return injected[injected.length - 1]?.textContent || ""; },
    setAutomation(on) { ctx.subtitleSettings.defaultLang = on ? "ar" : ""; }
  };
}

const ALL_ON = { subtitles_button: true, settings_button: true, ambient_mode: true };
const AUTO_ON = { enabled: true, defaultLang: "ar" };

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

console.log("\n[1] الأتمتة معطّلة — Clean Player كما هو بلا أي تغيير");
{
  const css = makeWorld({ items: ALL_ON, subtitles: { enabled: false, defaultLang: "" } }).css();
  check("زر الترجمة مُخفى", css.includes(SUB_BTN), css.slice(0, 100));
  check("زر الإعدادات مُخفى", css.includes(SET_BTN), css.slice(0, 100));
  check("والقاعدة تُخفي فعلاً", css.includes("display: none"));
}

console.log("\n[2] الأتمتة مفعّلة — الزرّان مستثنيان تلقائياً بلا سؤال");
{
  const css = makeWorld({ items: ALL_ON, subtitles: AUTO_ON }).css();
  check("زر الترجمة لم يُخفَ", !css.includes(SUB_BTN), css.slice(0, 100));
  check("زر الإعدادات لم يُخفَ", !css.includes(SET_BTN), css.slice(0, 100));
  check("وبقية العناصر ما زالت مُخفاة", css.includes("display: none") && css.length > 0);

  // أدقّ تأكيد: الناتج مطابق حرفياً لحالة لم يُحدَّد فيها الزرّان أصلاً
  const onlyOther = makeWorld({ items: { ambient_mode: true }, subtitles: AUTO_ON }).css();
  check("الاستثناء أزال الزرّين فقط ولم يمسّ غيرهما", css === onlyOther);
}

console.log("\n[3] الاستثناء مشروط بالأتمتة وحدها");
{
  const noLang = makeWorld({ items: ALL_ON, subtitles: { enabled: true, defaultLang: "" } }).css();
  check("ترجمة مفعّلة بلا لغة افتراضية ⇒ الزرّان يُخفيان",
    noLang.includes(SUB_BTN) && noLang.includes(SET_BTN), noLang.slice(0, 100));

  const offWithLang = makeWorld({ items: ALL_ON, subtitles: { enabled: false, defaultLang: "ar" } }).css();
  check("لغة محفوظة والترجمة معطّلة ⇒ الزرّان يُخفيان",
    offWithLang.includes(SUB_BTN) && offWithLang.includes(SET_BTN), offWithLang.slice(0, 100));
}

console.log("\n[4] إطفاء الأتمتة يعيد الإخفاء فوراً — بلا إعادة تحميل");
{
  const w = makeWorld({ items: ALL_ON, subtitles: AUTO_ON });
  const on = w.css();
  check("أثناء التفعيل: مستثنيان", !on.includes(SUB_BTN) && !on.includes(SET_BTN));

  w.setAutomation(false);
  const off = w.css();
  check("بعد الإطفاء مباشرةً: عاد الإخفاء",
    off.includes(SUB_BTN) && off.includes(SET_BTN), off.slice(0, 100));
  check("ولم تتراكم وسوم style", w.injected.length === 1, w.injected.length);

  w.setAutomation(true);
  const again = w.css();
  check("وإعادة التفعيل تستثني مجدداً", !again.includes(SUB_BTN) && !again.includes(SET_BTN));
  check("والناتج مطابق للحالة الأولى — لا تراكم حالة", again === on);
}

console.log("\n[5] لا يُفعّل ولا يُعطّل شيئاً لم يطلبه المستخدم");
{
  const unchecked = makeWorld({ items: { ambient_mode: true }, subtitles: AUTO_ON }).css();
  check("عنصر غير محدَّد يبقى غير مُخفى", !unchecked.includes(SUB_BTN) && !unchecked.includes(SET_BTN));

  check("Clean Player معطّل ⇒ لا CSS إطلاقاً",
    makeWorld({ items: ALL_ON, enabled: false, subtitles: AUTO_ON }).css() === "");
  check("موقع محظور ⇒ لا CSS", makeWorld({ items: ALL_ON, blocked: true }).css() === "");
  check("خارج يوتيوب ⇒ لا CSS", makeWorld({ items: ALL_ON, host: "example.com" }).css() === "");
  check("youtube-nocookie مشمول",
    makeWorld({ items: ALL_ON, host: "www.youtube-nocookie.com" }).css().includes(SUB_BTN));
}

console.log("\n[6] تطابق المفاتيح بين content.js و options.js");
{
  const w = makeWorld();
  // غائبة في الكود السابق للإصلاح — تفشل التأكيدات بوضوح بدل انهيار الاختبار
  const keys = w.read("typeof CAPTION_AUTOMATION_BUTTONS === 'undefined' ? [] : [...CAPTION_AUTOMATION_BUTTONS]");
  const itemKeys = w.read("Object.keys(CLEAN_PLAYER_ITEMS)");
  const optionsSrc = fs.readFileSync("options.js", "utf8");
  check("المجموعة ليست فارغة", keys.length === 2, keys);
  for (const key of keys) {
    check(`«${key}» في CLEAN_PLAYER_ITEMS`, itemKeys.includes(key));
    check(`«${key}» في CLEAN_PLAYER_OPTIONS`, optionsSrc.includes(`key: "${key}"`));
  }
  check("والمفتاحان يستهدفان الزرّين اللذين تضغطهما الأتمتة",
    w.read(`CLEAN_PLAYER_ITEMS.subtitles_button.includes("${SUB_BTN}") &&
            CLEAN_PLAYER_ITEMS.settings_button.includes("${SET_BTN}")`));
}

console.log("\n[7] البند #62 — وميض وسط الشاشة، بمحدّداته المقيسة");
{
  const w = makeWorld();
  const items = w.read("CLEAN_PLAYER_ITEMS");
  const optionsSrc = fs.readFileSync("options.js", "utf8");
  const BEZEL = {
    bezel_text: ".ytp-bezel-text-wrapper",
    bezel_icon_valued: ":not(.ytp-bezel-text-hide) > .ytp-bezel",
    bezel_icon_plain: ".ytp-bezel-text-hide > .ytp-bezel"
  };
  // ⚠️ المحدّدات **مقيسة على صفحة watch حيّة**، بانتظار خبوّ كل وميض قبل قراءة
  // التالي: يوتيوب يفرّق بين الوميضين **بصنف على الأب** لا بصنف على العنصر.
  // تغييرها بلا قياس جديد يُسقط البند صامتاً.
  for (const [key, sel] of Object.entries(BEZEL)) {
    check(`«${key}» في CLEAN_PLAYER_ITEMS بمحدّده المقيس`,
      Array.isArray(items[key]) && items[key].includes(sel), items[key]);
    check(`  و«${key}» في CLEAN_PLAYER_OPTIONS`, optionsSrc.includes(`key: "${key}"`));
  }
  // **الفرق عن أزرار الشريط السفلي ظاهر في الوسم نفسه لا في تعليق** (قرار المالك)
  for (const key of Object.keys(BEZEL)) {
    const m = new RegExp(`key: "${key}",\\s*label: "([^"]+)"`).exec(optionsSrc);
    check(`  ووسم «${key}» يقول إنه وميض الوسط`, !!m && /Center flash/i.test(m[1]), m && m[1]);
  }
  // ولا يلتبس بأزرار الشريط: لا تقاطع محدّدات مع الثلاثة القائمة
  const bar = [].concat(items.play_button, items.mute_button, items.volume_slider);
  const bez = Object.keys(BEZEL).flatMap((k) => items[k]);
  check("ولا محدّد مشترك بين وميض الوسط وأزرار الشريط",
    !bez.some((x) => bar.includes(x)), bez.filter((x) => bar.includes(x)));

  // الوميض ذو النصّ والوميض بلا نصّ **ينفصلان بصنف الأب** — وهذا كل ما يسمح به
  // القياس: الصوت والسرعة معاً في الأول، والتشغيل/الإيقاف والتقديم معاً في الثاني.
  check("والفصل بصنف الأب ytp-bezel-text-hide لا بصنف على العنصر",
    BEZEL.bezel_icon_valued.includes(":not(.ytp-bezel-text-hide)") &&
    BEZEL.bezel_icon_plain.startsWith(".ytp-bezel-text-hide"));

  const css = makeWorld({ items: { bezel_text: true, bezel_icon_plain: true } }).css();
  check("وتأشيرهما يُدخل محدّديهما في الورقة",
    css.includes(".ytp-bezel-text-wrapper") && css.includes(".ytp-bezel-text-hide > .ytp-bezel"));
  check("ولا يُدخل الثالث غير المؤشَّر",
    !css.includes(":not(.ytp-bezel-text-hide) > .ytp-bezel"));
  check("والافتراض: غير مؤشَّرة ⇒ لا تُخفى",
    !makeWorld({ items: {} }).css().includes("ytp-bezel"));
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
