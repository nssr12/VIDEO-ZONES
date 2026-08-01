// Audit #49: caption font-size was absolute px, so the number that reads well on a
// 1280px watch player buried YouTube's 300px homepage hover preview in text.
//
// The preview uses the SAME #movie_player / .html5-video-player element as the watch
// page (verified in Chrome), so nothing but SIZE tells them apart — hence container
// query units. The property that must never break: at the reference width the user's
// number renders EXACTLY as it did before, so the watch page the user is used to is
// untouched. Everything else is a consequence of that.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");
const from = SRC.indexOf("const CAPTION_REFERENCE_PLAYER_W");
const to = SRC.indexOf("function applySubtitleStyles");
if (from === -1 || to === -1) {
  console.log("  ❌ relativeCaptionFont غائبة — حجم الترجمة ما زال ثابتاً بالبكسل (#49 غير منفَّذ)");
  process.exit(1);
}
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(SRC.slice(from, to), ctx);
// const داخل سكربت vm ليس خاصية على السياق — يُقرأ بتقييم داخله
const REF = vm.runInContext("CAPTION_REFERENCE_PLAYER_W", ctx);

// يحسب ما سيحسبه المتصفح: clamp(min, Ncqw, max) عند عرض حاوية معلوم
function resolve(clampStr, containerW) {
  const m = /clamp\(([\d.]+)px,\s*([\d.]+)cqw,\s*([\d.]+)px\)/.exec(clampStr);
  if (!m) throw new Error(`صيغة غير متوقّعة: ${clampStr}`);
  const [, lo, per, hi] = m.map(Number);
  return Math.min(hi, Math.max(lo, per * containerW / 100));
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

console.log("\n[1] الشرط الحاكم: مشغّل المشاهدة عند العرض المرجعي بلا تغيير");
{
  for (const size of [14, 18, 22, 28, 40]) {
    const px = resolve(ctx.relativeCaptionFont(size), REF);
    check(`إعداد ${size} ⇒ ${size}px عند ${REF}px بالضبط`, Math.abs(px - size) < 0.05, px);
  }
}

console.log("\n[2] المعاينة الصغيرة لم تعد تُغرَق بالنص");
{
  const clamp = ctx.relativeCaptionFont(22);
  const preview = resolve(clamp, 300);
  const watch = resolve(clamp, REF);
  check("300px: الحجم أصغر بكثير من الثابت القديم", preview < 22 * 0.6, preview);
  check("ونسبة النص للعرض انخفضت", (preview / 300) < (22 / 300) * 0.55,
    { before: (22 / 300 * 100).toFixed(2) + "%", after: (preview / 300 * 100).toFixed(2) + "%" });
  check("ومع ذلك يبقى مقروءاً لا مجهرياً", preview >= 9, preview);
  check("وأصغر من حجم المشاهدة", preview < watch);
}

console.log("\n[3] الحدّان: أرضية وسقف");
{
  const clamp = ctx.relativeCaptionFont(22);
  check("مشغّل مجهري لا ينزل تحت الأرضية", resolve(clamp, 50) === resolve(clamp, 120), resolve(clamp, 50));
  check("ملء الشاشة 1920 يكبر مع المشغّل", Math.abs(resolve(clamp, 1920) - 33) < 0.5, resolve(clamp, 1920));
  check("و4K لا ينفجر — مقصوص عند الضعف", resolve(clamp, 3840) === 44, resolve(clamp, 3840));
  check("السقف ضعف الإعداد", resolve(ctx.relativeCaptionFont(18), 99999) === 36);
}

console.log("\n[4] الاطّراد: أكبر إعداداً ⇒ أكبر عرضاً، عند كل مقاس");
{
  for (const w of [300, 640, 1280, 1920]) {
    const sizes = [14, 18, 22, 28, 40].map((s) => resolve(ctx.relativeCaptionFont(s), w));
    check(`عند ${w}px الترتيب محفوظ`, sizes.every((v, i) => i === 0 || v >= sizes[i - 1]), sizes);
  }
  const one = ctx.relativeCaptionFont(22);
  const widths = [200, 400, 800, 1600, 3200].map((w) => resolve(one, w));
  check("وأعرض مشغّلاً ⇒ أكبر خطاً", widths.every((v, i) => i === 0 || v >= widths[i - 1]), widths);
}

console.log("\n[5] مدخلات فاسدة لا تُخرج CSS فاسداً");
{
  for (const bad of [undefined, null, NaN, "", "abc", 0, -5]) {
    const out = ctx.relativeCaptionFont(bad);
    check(`«${String(bad)}» ⇒ صيغة clamp سليمة`, /^clamp\([\d.]+px, [\d.]+cqw, [\d.]+px\)$/.test(out), out);
  }
}

console.log("\n[6] شكل الـ CSS المحقون");
{
  check("الحاوية inline-size لا size — أضعف احتواء يكفي",
    SRC.includes("container-type: inline-size !important;") && !SRC.includes("container-type: size !important;"));
  check("ومحصورة في حاويات المشغّلات المعروفة ومشغّل المعاينة وحدها",
    SRC.includes("html :is(${KNOWN_PLAYER_WRAPPER_SELECTOR}, ${YT_PREVIEW_PLAYER_SELECTOR}) {"));
  check("الحجم النسبي يُعلَن مرة واحدة فقط — داخل حارس @container (#50)",
    (SRC.match(/font-size:\$\{relFont\} !important;/g) || []).length === 1,
    (SRC.match(/font-size:\$\{relFont\} !important;/g) || []).length);
  check("و ::cue وحدها تبقى بالبكسل — لا حاوية تقيس داخلها",
    /html video::cue \{[\s\S]{0,220}font-size:\$\{fontSize\}px !important;/.test(SRC));
}

console.log("\n[7] الحارس البنيوي (#50): cqw لا تُستعمل إلا داخل @container");
{
  // نولّد الـ CSS الحقيقي بتشغيل applySubtitleStyles نفسها، لا بفحص المصدر نصّياً
  const head = SRC.indexOf("const YT_PREVIEW_PLAYER_SELECTOR");
  const tail = SRC.indexOf("function applySubtitleTrack");
  let css = null;
  const c = {
    console, subtitleStyleEl: null, isBlockedHost: () => false, extensionActive: () => true,
    subtitleSettings: { enabled: true, defaultLang: "ar", fontSize: 22, color: "#fff",
      bgColor: "#000", bgOpacity: 0.6, fontFamily: "sans-serif", position: "bottom" },
    hexToRgb: () => "0,0,0",
    KNOWN_PLAYER_WRAPPER_SELECTOR: "#movie_player,.html5-video-player",
    document: { createElement: () => ({ id: "", textContent: "", remove() {} }),
                documentElement: { appendChild: (el) => { css = el.textContent; } } }
  };
  vm.createContext(c);
  vm.runInContext(SRC.slice(head, tail), c);
  vm.runInContext("applySubtitleStyles()", c);

  check("الـ CSS تولَّد", typeof css === "string" && css.length > 0);

  const open = css.indexOf("@container (min-width: 0px) {");
  check("يوجد بلوك @container", open !== -1);
  // نهاية البلوك: نعدّ الأقواس من بدايته
  let depth = 0, end = -1;
  for (let i = css.indexOf("{", open); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) { end = i; break; }
  }
  // نُجرّد تعليقات CSS أولاً: نصّ التعليق يذكر cqw ولو لم تُستعمل الوحدة فعلاً
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "");
  const inside = strip(css.slice(open, end + 1));
  const outside = strip(css.slice(0, open) + css.slice(end + 1));

  check("كل استعمالات cqw داخل البلوك وحده",
    !outside.includes("cqw") && inside.includes("cqw"), outside.match(/[^\s;]*cqw[^\s;]*/g));
  check("ولا clamp خارج البلوك", !outside.includes("clamp("), outside.match(/clamp\([^)]*\)/g));
  check("والاحتياطي خارج البلوك مطلق بالبكسل", /font-size:22px !important;/.test(outside));

  // الاحتياطي يغطي كل مجموعة تُحسَّن داخل البلوك
  for (const sel of [".ytp-caption-segment", ".player-timedtext-text-container", ".jw-text-track-cue"]) {
    check(`«${sel}» له احتياطي مطلق وتحسين نسبي`,
      outside.includes(sel) && inside.includes(sel));
  }
  check("ومشغّل معاينة يوتيوب ضمن حاويات الاستعلام صراحةً",
    css.includes("#inline-preview-player"));
  check("و ::cue خارج البلوك — لا حاوية تقيس داخلها",
    outside.includes("video::cue") && !inside.includes("video::cue"));
}

console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
process.exit(fail ? 1 : 0);
