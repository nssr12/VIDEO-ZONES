// قياس `S10` — أتعمل ميزاتُنا داخل مشغّل التضمين، أم ماتت أصنافُه من تحتها؟
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// صفحتُه الحاضنة محليّة لكنّ القياس كلَّه داخل إطار تضمين يوتيوب الحيّ، وعيّنتا
//   الجودة عند 14ث و75ث تتبعان ABR المضيف — فالرقم من مشغّلٍ لا نملكه.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين أُشاهد فيديو يوتيوب مضمَّناً في
// موقعٍ آخر، أتعمل ترجمتي المنسّقة وجودتي المختارة ومربّعاتي كما تعمل على
// يوتيوب نفسه؟»*
//
// ── نصُّ الشكّ كما هو مسجَّل (لا كما يُتذكَّر) ────────────────────────────────
// **`S10` ليس «أتُسرَّب الإعدادات إلى `iframe` من أصلٍ آخر؟»** — بل: مشغّل
// التضمين 2026 (`player_embed.vflset`) **هجر عائلة `ytp-`** إلى `ytm*`/`ytw*`
// (#68)، **والسؤال أوسع من Clean Player**: الترجمة · أتمتة لغتها · الجودة ·
// **واكتشاف حاوية المشغّل** — **أتعمل أيٌّ منها في التضمين اليوم؟**
// ⚠️ **والفرق ليس لفظياً:** الأوّل سؤالُ خصوصية، وهذا سؤالُ **ميزةٍ تموت صامتة**.
//
// ── شاهدا قرار 26 ───────────────────────────────────────────────────────────
//  · **موجب:** الإضافة **تعمل داخل الإطار**: عالمٌ معزول بعلمه · **وفيديو**
//    بمستطيلٍ غير صفريّ. **بلا هذا كلُّ صفرٍ بعده «لم أقس» لا «لا يوجد».**
//  · **سالب:** والصفحة الحاضنة (الأصل الآخر) **لا يُقاس عليها شيء** — القياس
//    كلُّه **داخل الإطار**، ويُعلَن أنه كذلك.
import { launch, openPage, configure, evalIn, killChrome, waitPortFree, serveTestPage, connect, contentWorld }
  from "./ext-harness.mjs";

const PORT = 9779, HTTP = 8879;
const AS_JSON = process.argv.includes("--json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIDEO_ID = "aqz-KE-bpKQ";

// ── أصلُ التضمين مُعلَنٌ لا مضمَر (2026-08-04) ───────────────────────────────
// ⚠️ **عيّنةٌ من أصلٍ واحد لا تفصل علّتين.** على `youtube-nocookie.com` تسقط
// الجودةُ عند **بوّابتنا** (`isYouTubeHost()` لا يُطابق النطاق) **وعند ناقلنا**
// (`yt_quality_main.js` مُعلَنٌ لِـ`*.youtube.com` **وبلا `all_frames`**) معاً —
// **فيُقرأ سببٌ واحد، ويُصلَح، ولا شيء يتغيّر** (قرار 42: عَرَضٌ واحد لا يدلّ
// على سببٍ واحد). ⇒ **و`--origin youtube` يُسقط الأولى ويُبقي الثانية وحدها**،
// فتُقاس مستقلّةً بدل أن تُستنتج من قراءة مانيفست.
const ORIGIN = (process.argv.find((a, i) => process.argv[i - 1] === "--origin") || "nocookie");
const EMBED_HOST = ORIGIN === "youtube" ? "www.youtube.com" : "www.youtube-nocookie.com";

// صفحةٌ حاضنة من **أصلٍ محليّ** فيها تضمينُ يوتيوب — كما نصّ الشكّ
const HOST_PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<h1 style="color:#888;font:14px system-ui">صفحةُ أصلٍ آخر — والتضمين تحتها</h1>
<iframe id="emb" width="800" height="450" style="border:0"
  src="https://${EMBED_HOST}/embed/${VIDEO_ID}?autoplay=1&mute=1&cc_load_policy=1"
  allow="autoplay; encrypted-media" allowfullscreen></iframe>
</body>`;

const SETTINGS = {
  settings: {
    enabled: true,
    subtitles: { enabled: true, fontSize: 28, color: "#ff0000", bgColor: "#000000",
                 bgOpacity: 0.9, fontFamily: "sans-serif", position: "bottom",
                 defaultLang: "ar", hideOnPreviews: true },
    ytAutoQuality: "hd720",
    cleanPlayer: { enabled: true, items: { top_titles: true, large_play_button: true } },
    zones: { enabled: true, fullscreenOnly: false, gridCoverage: "player",
             wheel: { map: { "4": { up: ["ACTION:VOLUME:+5"], down: ["ACTION:VOLUME:-5"] } } } }
  },
  globalSiteRules: { enabled: true, mappings: [] }
};

// ⚠️ **يُقاس صنفُنا وأثرُنا، لا ما يبدو** (قرار 48): ورقةُ أنماطنا بمعرّفها،
// وحاويةُ المشغّل بدالّتنا، وعائلةُ الأصناف بالعدّ.
const PROBE = `(() => {
  const vis = (el) => { if (!el) return false; const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.display !== "none" && cs.visibility !== "hidden" &&
           Number(cs.opacity) > 0 && r.width > 0 && r.height > 0; };
  const v = document.querySelector("video");
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const count = (sel) => { try { return document.querySelectorAll(sel).length; } catch { return -1; } };
  const known = (typeof KNOWN_PLAYER_WRAPPER_SELECTOR === "string") ? KNOWN_PLAYER_WRAPPER_SELECTOR : null;
  return {
    url: location.href,
    flag: !!window.__GVZ_CONTENT_LOADED__,
    video: v ? { box: box(v), paused: v.paused, muted: v.muted,
                 duration: Number.isFinite(v.duration) ? Math.round(v.duration) : null,
                 quality: (() => { try { return v.videoHeight; } catch { return null; } })() } : null,
    // (١) **الترجمة**: ورقتُنا مُحقونة؟ وأتُطابق شيئاً؟
    subsTag: !!document.getElementById("vz_subtitles_css"),
    ytpCaptionEls: count(".ytp-caption-segment, .ytp-caption-window-container"),
    anyCaptionText: count("[class*=caption]"),
    // (٢) **أتمتة اللغة**: أزرارُها موجودة؟
    subtitlesButton: count(".ytp-subtitles-button"),
    settingsButton: count(".ytp-settings-button"),
    // (٣) **Clean Player**: ورقتُنا وأصنافُها
    cleanTag: !!document.getElementById("vz_clean_player_css"),
    ytpTitle: count(".ytp-title"),
    largePlay: count(".ytp-large-play-button"),
    // (٤) **حاوية المشغّل**: بدالّتنا هي، لا بمحدِّدٍ نكتبه هنا
    knownSelector: known,
    knownMatches: known ? count(known) : -1,
    scopeByOurFn: (typeof playerScopeForVideo === "function" && v)
      ? (() => { const el = playerScopeForVideo(v);
          return el ? (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
            (typeof el.className === "string" && el.className
              ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "")).slice(0, 46) : null; })()
      : "لا دالّة",
    zoneRect: (typeof zoneRectForVideo === "function" && v)
      ? (() => { const r = zoneRectForVideo(v);
          return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })() : "لا دالّة",
    // (٥) **عائلةُ الأصناف** — عدُّ #68 نفسه، في التضمين
    ytpCount: count("[class*=ytp-]"),
    ytmCount: count("[class*=ytm]") + count("[class*=ytw]"),
    ourOverlay: count(".vzWrap"), ourGrid: count(".vzGrid"),
    // (٦) **الجودة — سببُنا لا أثرُه** (قرار 48): بدالّتَينا نحن، لا بمحدِّدٍ
    // يُكتب هنا. ⚠️ ولا يُقرأ ytAutoQuality نفسه: **let في أعلى سكربت المحتوى
    // غير مقروء من Runtime.evaluate** (حدٌّ مقيس في tools/KNOWN-DEFECTS.md) —
    // **والدوالّ تُقرأ والمتغيّرات لا**.
    isYtHostByOurFn: (typeof isYouTubeHost === "function") ? isYouTubeHost() : "لا دالّة",
    qualityGapByOurFn: (typeof ytQualityGap === "function")
      ? JSON.stringify(ytQualityGap()) : "لا دالّة"
  };
})()`;

// ── عيّنةُ الجودة وحدها — تُعاد بعد مدّة، ولا يُعاد القياس كلُّه ─────────────
// ⚠️ **عيّنةٌ واحدة لا تفرّق «لم تُطبَّق» من «لم تبلغ بعد»** — و`videoHeight`
// يتحرّك بـABR من تلقائه. ⇒ **عيّنتان متباعدتان**، ويُطبع الزمنُ مع الرقم.
const SAMPLE = `(() => { const v = document.querySelector("video");
  return v ? { h: v.videoHeight, w: v.videoWidth, t: Math.round(v.currentTime),
               paused: v.paused, buffered: v.buffered.length } : null; })()`;

// **سببُنا في العالم الرئيسيّ**: أحُقن ناقلُ الجودة في هذا الإطار أصلاً؟
// `__vzQB` علمُ `yt_quality_main.js` — **يُرفع بعد تسجيل مستمعيه لا قبلهم** —
// و`#movie_player` وواجهتُه هما ما يشترطه ذلك الملفّ حرفياً.
const MAIN_CAUSE = `(() => {
  const p = document.querySelector("#movie_player");
  return { qbFlag: !!window.__vzQB,
           moviePlayer: !!p,
           hasQualityApi: !!(p && typeof p.getAvailableQualityLevels === "function"),
           levels: (p && typeof p.getAvailableQualityLevels === "function")
             ? (p.getAvailableQualityLevels() || []).slice(0, 12) : null,
           current: (p && typeof p.getPlaybackQuality === "function") ? p.getPlaybackQuality() : null };
})()`;

// ⚠️ **التباعد مقصود ومُعلَن**: الأولى بعد استقرار التشغيل، والثانية بعد دقيقةٍ
// كاملة — **وABR يرفع الجودة في أولى ثوانيه**، فقربُ العيّنتين يُنتج تطابقاً
// يُقرأ ثباتاً وهو قِصَرُ المدى. **ويُقرأان بزمنهما المطبوع لا بترتيبهما.**
const Q_SAMPLE_AT_S = [14, 75];

const out = {};
let t0 = Date.now();
let h = null, page = null, server = null;
try {
  const srv = await serveTestPage(HTTP, HOST_PAGE); server = srv.srv;
  out.hostUrl = srv.url;
  t0 = Date.now();
  h = await launch(PORT, { extra: ["--window-size=1280,900"] });
  out.chrome = h.chrome;
  const cfg = await configure(PORT, h.extensionId, SETTINGS);
  if (!cfg.ok) throw new Error("تعذّر ضبط التخزين");
  page = await openPage(PORT, srv.url);
  await sleep(9000);

  // ⚠️ **الإطارُ من أصلٍ آخر هدفٌ مستقلّ (OOPIF)** — **فعوالمُه لا تصل إلى جلسة
  // الصفحة الحاضنة**، وأوّلُ قياسٍ أعطى «عالماً واحداً» وكاد يُقرأ «الإضافة لا
  // تعمل في التضمين». ⇒ **يُتّصل بهدفه مباشرةً**، والتمييز بالعنوان.
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  out.targets = targets.map((t) => ({ type: t.type, url: (t.url || "").slice(0, 60) }));
  const emb = targets.find((t) => /youtube(-nocookie)?\.com\/embed/.test(t.url || ""));
  if (emb) {
    const c = await connect(emb.webSocketDebuggerUrl);
    await c.send("Runtime.enable"); await c.send("Page.enable");
    await sleep(1500);
    const w = await contentWorld(c);
    out.embedWorld = w ? w.name.slice(0, 24) : null;
    // **سببُنا يُقرأ من العالم الرئيسيّ للإطار** — لا من عالم الإضافة ولا من
    // الحاضنة: `yt_quality_main.js` يعيش هناك أو لا يعيش، والعلم يقول أيّهما.
    out.mainCause = await evalIn(c, MAIN_CAUSE);
    // ⛔ **ولا مسارَ احتياطيّ يُقيَّم في عالم الصفحة** — أمسكه `test-probe-world.js`
    // في يومه على هذا الملفّ نفسه: **مِجَسٌّ هناك يقرأ `null` عن دوالِّنا فيُقرأ
    // «الميزة ميتة»**. ⇒ **لا عالَم ⇒ لا قياس، ويُعلَن.**
    if (w) out.inEmbed = await evalIn(c, PROBE, w.id);
    else out.noWorld = "لا عالمَ للإضافة في الإطار — لا يُقاس ولا يُنفى شيء";

    // ── العيّنتان — والتباعد مُعلَنٌ بالثانية لا مضمَرٌ في `sleep` ────────────
    // ⚠️ **ولا تُعلَن العيّنتان المتطابقتان عطباً ولا سلامة**: تطابقُهما يقول
    // «لم يتحرّك بين اللحظتين» **ولا يقول لماذا** — والسببُ يُقرأ من `mainCause`.
    out.qSamples = [];
    for (const at of Q_SAMPLE_AT_S) {
      const waitTo = at * 1000 - (Date.now() - t0);
      if (waitTo > 0) await sleep(waitTo);
      const s = await evalIn(c, SAMPLE);
      out.qSamples.push({ atS: Math.round((Date.now() - t0) / 1000), ...(s || { h: null }) });
    }
    out.mainCauseLate = await evalIn(c, MAIN_CAUSE);
    try { c.ws.close(); } catch {}
  }
  const hostWorld = await contentWorld(page);
  if (hostWorld) out.inHost = await evalIn(page, PROBE, hostWorld.id);
} catch (e) {
  out.why = String(e?.message || e).slice(0, 160);
} finally {
  try { page?.ws?.close(); } catch {}
  killChrome(h);
  try { server?.close(); } catch {}
  await waitPortFree(PORT);
}

if (AS_JSON) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

const yn = (b) => (b ? "نعم" : "لا");
console.log("\n=== قياس S10 — ميزاتُنا داخل مشغّل التضمين ===");
console.log(`   كروم: ${out.chrome || "—"} · الحاضنة: ${out.hostUrl || "—"} · **أصلُ التضمين: ${EMBED_HOST}**`);
if (out.why) console.log(`   ⚠️ ${out.why}`);
console.log(`   أهداف: ${(out.targets || []).map((t) => t.type).join(" · ")}` +
  ` · عالم الإضافة في التضمين: ${out.embedWorld || "لا شيء"}`);

const e = out.inEmbed;
const posOk = !!(e && e.flag && e.video && e.video.box.w > 0);
console.log("\n── الشاهدان");
if (out.noWorld) console.log(`   ⚠️ ${out.noWorld}`);
console.log(`   الموجب: ${posOk ? "✅ الإضافة تعمل داخل الإطار، وفيه فيديو بمستطيلٍ غير صفريّ" : "❌ **ساقط** — فكلُّ صفرٍ بعده «لم أقس» لا «لا يوجد»"}`);
console.log(`   السالب: ${out.inHost ? "✅ والحاضنة تُميَّز عنه (تُقاس ولا يُحكم بها)" : "⚠️ لم تُقس الحاضنة"}`);

if (e) {
  console.log(`\n── داخل الإطار: ${String(e.url).slice(0, 60)}`);
  console.log(`   فيديو: ${JSON.stringify(e.video)}`);
  console.log(`   (١) الترجمة   : ورقتُنا=${yn(e.subsTag)} · عناصر ytp-caption=${e.ytpCaptionEls}` +
    ` · أيُّ عنصرِ ترجمة=${e.anyCaptionText}`);
  console.log(`   (٢) الأتمتة   : زرّ الترجمة=${e.subtitlesButton} · زرّ الإعدادات=${e.settingsButton}`);
  console.log(`   (٣) Clean     : ورقتُنا=${yn(e.cleanTag)} · .ytp-title=${e.ytpTitle}` +
    ` · .ytp-large-play-button=${e.largePlay}`);
  console.log(`   (٤) الحاوية   : محدِّدنا يطابق=${e.knownMatches} · نطاقُنا=${e.scopeByOurFn}` +
    ` · zoneRect=${JSON.stringify(e.zoneRect)}`);
  console.log(`   (٥) العائلة   : عناصر ytp-=${e.ytpCount} · مقابل ytm/ytw=${e.ytmCount}`);
  console.log(`   وطبقتُنا      : vzWrap=${e.ourOverlay} · vzGrid=${e.ourGrid}`);

  // ── (٦) الجودة — العيّنتان أولاً، ثمّ سببُنا، ولا حكمَ بينهما ──────────────
  const S = out.qSamples || [];
  console.log(`\n── (٦) الجودة المطلوبة \`${SETTINGS.settings.ytAutoQuality}\` — **عيّنتان متباعدتان**`);
  for (const s of S) {
    console.log(`   عند ${String(s.atS).padStart(3)}ث: videoHeight=${s.h} (${s.w}×${s.h})` +
      ` · currentTime=${s.t}ث · متوقّف=${yn(s.paused)} · مقاطع=${s.buffered}`);
  }
  if (S.length >= 2) {
    const same = S[0].h === S[S.length - 1].h;
    console.log(`   ⇒ ${same
      ? `**لم تتحرّك بين ${S[0].atS}ث و${S[S.length - 1].atS}ث** (${S[0].h} ⇒ ${S[S.length - 1].h})`
      : `**تحرّكت**: ${S[0].h} ⇒ ${S[S.length - 1].h} — **فالقيمة غير مستقرّة، ولا يُحكم بلقطة**`}`);
  }
  const mc = out.mainCause || {}, ml = out.mainCauseLate || {};
  console.log(`   وسببُنا (قرار 48): علم \`__vzQB\` في العالم الرئيسيّ=${yn(mc.qbFlag)}` +
    ` · \`#movie_player\`=${yn(mc.moviePlayer)} · واجهةُ الجودة=${yn(mc.hasQualityApi)}`);
  console.log(`   ومستوياتُ المشغّل نفسِه: ${JSON.stringify(ml.levels ?? mc.levels)}` +
    ` · وما يُعلنه=${JSON.stringify(ml.current ?? mc.current)}`);
  console.log(`   وبدالّتنا: \`isYouTubeHost()\`=${e.isYtHostByOurFn}` +
    ` · \`ytQualityGap()\`=${e.qualityGapByOurFn}`);
  console.log(`   ⚠️ **يُقرأ ما قِيس ولا يُعلَن عطبٌ ولا سلامة من عيّنتين** — القرار للمالك.`);
}
if (out.inHost) {
  console.log(`\n── وفي الحاضنة (للتمييز لا للحكم): فيديو=${out.inHost.video ? "نعم" : "لا"}` +
    ` · ورقة الترجمة=${yn(out.inHost.subsTag)} · ytp-=${out.inHost.ytpCount}`);
}
console.log("");
process.exit(posOk ? 0 : 1);
