// S6 — هل يسبق `stopImmediatePropagation` معالجَ المضيف فعلاً؟ قياس **سلوكيّ** لا نظريّ.
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**
//   node tools/bench-s6-click.mjs                 # يوتيوب ثم تويتش
//   node tools/bench-s6-click.mjs --host youtube  # مضيف واحد
//   node tools/bench-s6-click.mjs --witness       # فحص البصر وحده (قرار 26)
//
// ── السؤال، ولماذا لا يُجاب نظرياً ──────────────────────────────────────────
// مستمعانا على `window` في طور **الالتقاط**، مسجَّلان عند `document_start`، فهما
// **قبل أي مستمع للمضيف** بحكم الترتيب. هذا **استنتاج**، والبند يسأل عن **الواقع**:
//   · ماذا لو كان المضيف لا يتصرّف على `click` أصلاً بل على `mousedown` أو
//     `pointerdown`؟ عندها **حاجزنا في `click` يأتي بعد فوات الأوان** ولا ينفع
//     أنه أسبق مستمعي `click` كلِّهم. **هذا ما لا تراه قراءة الكود.**
//   · وماذا لو نفّذ الاثنان معاً فصار **تنفيذ مزدوج** (تشغيل ثم إيقاف)؟
//
// **فالمقيس تسلسلُ الأحداث الحقيقيّ بعد نقرة موثوقة واحدة**: أين تقع
// `play`/`pause` من `mousedown` و`click`، وهل يصل الحدث إلى مستمع مسجَّل **بعدنا**
// على `window/capture`، وهل تغيّر شيء في حالة الوسائط.
//
// ⚠️ **والنقرة موثوقة (`Input.dispatchMouseEvent`) لا مُرسَلة** — شاهد خامس عشر
// (قرار 26): حدثٌ غير موثوق لا يُنفَّذ له سلوك افتراضي، فأداة تقيس به تقيس عجزها.
//
// ── شاهدا القبول (قرار 26) ──────────────────────────────────────────────────
//  · **موجب:** صفحة **بلا إضافة** + نقرة موثوقة على الفيديو ⇒ **المضيف يتفاعل**
//    (`media:pause`). بلا هذا الشاهد يصير «لم يتفاعل المضيف» في كل حالة **عمىً**:
//    أداة لا ترى تفاعلاً حين يقع تطبع «لا تفاعل» عن كل شيء.
//  · **سالب (اثنان):** نفس الصفحة **بلا نقرة إطلاقاً** ⇒ صفر حدث · و**صفحة محلية
//    بفيديو بلا معالج نقر** + نقرة عليه ⇒ لا `media:pause`. الأول يمنع عدَّ ما لم
//    يقع، والثاني يُثبت أن «تفاعل المضيف» أثرُ معالجٍ عنده لا أثرُ النقر نفسه.
import fs from "node:fs";
import path from "node:path";
import { launch, openPage, evalIn, configure, serveTestPage, ROOT } from "./ext-harness.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WITNESS_ONLY = process.argv.includes("--witness");
// إعادة حالة واحدة بعينها تُدمج في الخام محلَّ نظيرتها — فلا يُعاد قياس ما قِيس
const CASE_ARG = (process.argv.find((a, i) => process.argv[i - 1] === "--case") || "").split(",").filter(Boolean);
const HOST_ARG = (process.argv.find((a, i) => process.argv[i - 1] === "--host") || "").toLowerCase();

const HOSTS = {
  youtube: { name: "يوتيوب", urls: ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"] },
  // تويتش: الصفحة الرئيسية تُشغّل بثّاً مميّزاً، والدليل بديلها إن لم تُشغّل
  twitch:  { name: "تويتش",  urls: ["https://www.twitch.tv/", "https://www.twitch.tv/directory/all"] }
};

// ── مِجَسّ التسلسل: يُركَّب في عالم الصفحة **بعد** مستمعي سكربت المحتوى ────────
// ولذلك غيابُ `win-cap:click` من التسلسل **دليلٌ موجب** على أن الحاجز عمل:
// مستمعٌ مسجَّل بعدنا على النقطة نفسها لا يُستدعى بعد `stopImmediatePropagation`.
const PROBE = `(() => {
  const v = document.querySelector("video");
  if (!v) return { ok: false, why: "لا فيديو" };
  const S = { seq: [] , t0: performance.now() };
  window.__s6 = S; S.v = v;
  const push = (tag, extra) => S.seq.push(Object.assign(
    { tag, at: Math.round(performance.now() - S.t0), paused: v.paused }, extra || {}));
  for (const t of ["pointerdown", "mousedown", "mouseup", "click", "auxclick", "contextmenu"]) {
    window.addEventListener(t, (e) => push("win-cap:" + t, { trusted: e.isTrusted }), true);
    document.addEventListener(t, () => push("doc-cap:" + t), true);
    window.addEventListener(t, () => push("win-bub:" + t), false);
  }
  v.addEventListener("play", () => push("media:play"));
  v.addEventListener("pause", () => push("media:pause"));
  v.addEventListener("volumechange", () => push("media:volume",
    { vol: Math.round(v.volume * 100) / 100, muted: v.muted }));
  return { ok: true, paused: v.paused, vol: Math.round(v.volume * 100) / 100, muted: v.muted };
})()`;

// حال الإعلان تُقرأ من صنف المشغّل نفسه — يوتيوب يعلنها، وتويتش يعرض طبقته
const AD_SHOWING = `(() => { const p = document.querySelector("#movie_player, .html5-video-player");
  const cls = String(p && p.className || "");
  return /(^|\\s)(ad-showing|ad-interrupting)(\\s|$)/.test(cls) ||
         !!document.querySelector(".ytp-ad-player-overlay, [data-a-target='video-ad-label']"); })()`;

const READ = `(() => {
  const S = window.__s6 || { seq: [] };
  const v = S.v || document.querySelector("video");
  const swapped = !!(S.v && S.v !== document.querySelector("video"));
  // قائمة يوتيوب الخاصة هي **الأثر المرئي للزرّ الأيمن عند المضيف** — والقائمة
  // الأصلية للمتصفّح لا تُرى من الصفحة، فلا تصلح شاهداً.
  const m = document.querySelector(".ytp-contextmenu, .ytp-popup.ytp-contextmenu");
  const mr = m && m.getBoundingClientRect();
  return { seq: S.seq, paused: v ? v.paused : null,
           vol: v ? Math.round(v.volume * 100) / 100 : null, muted: v ? v.muted : null,
           t: v ? Math.round(v.currentTime) : null, swapped,
           hostMenu: !!(mr && mr.width > 0 && mr.height > 0 && getComputedStyle(m).display !== "none") };
})()`;

// ⚠️ **بوّابة السكون — بلا هذا سقط الرِكاز فعلاً في تشغيلة كاملة (2026-08-02).**
// حدود الإعلان تُطلق `play`/`pause` على العنصر نفسه، فعُدّت تفاعلاً للمضيف مع
// النقرة وبلا نقرة معاً: الشاهد الموجب طبع «لم يتفاعل» والسالب طبع «تفاعل».
// **فلا تُقرأ نقرة إلا بعد سكونٍ مقيس**: لا حدث وسائط ولا إعلان معروض، ثم يُمسح
// السجلّ فتُنسب إلى النقرة أحداثُها وحدها.
async function waitQuiet(page, quietMs = 1600, maxMs = 30000) {
  const t0 = Date.now();
  let lastLen = -1, since = Date.now();
  while (Date.now() - t0 < maxMs) {
    const st = await evalIn(page, `(() => { const v = document.querySelector("video");
      const S = window.__s6 || { seq: [] };
      return { n: S.seq.filter((s) => s.tag.startsWith("media:")).length,
               paused: v ? v.paused : null, ad: ${AD_SHOWING} }; })()`);
    if (!st) return null;
    if (st.n !== lastLen) { lastLen = st.n; since = Date.now(); }
    if (!st.paused && !st.ad && Date.now() - since >= quietMs) {
      await evalIn(page, `(window.__s6.seq.length = 0, true)`);   // السجلّ للنقرة وحدها
      return { ad: st.ad };
    }
    await sleep(400);
  }
  return null;
}

// ⚠️ قرار 22: لا يُقرأ رقم قبل أن يستقرّ التخطيط، **ولا يُقاس «هل أوقفه المضيف»
// على فيديو ليس شغّالاً أصلاً** — فالسكون حينها غياب شرط لا نتيجة (شاهد سابع عشر).
async function waitPlaying(page, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = await evalIn(page, `(() => { const v = document.querySelector("video");
      if (!v) return null; const b = v.getBoundingClientRect();
      if (!(b.width > 0 && b.height > 0)) return null;
      if (v.paused) { v.play().catch(() => {}); return null; }
      return { w: Math.round(b.width), h: Math.round(b.height), rs: v.readyState,
               x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2),
               left: Math.round(b.left) }; })()`);
    if (r && r.rs >= 2) return r;
    await sleep(700);
  }
  return null;
}

// ⚠️ **نافذة النسب — لا عدٌّ مفتوح.** زمن استجابة يوتيوب للنقرة **مقيس 206ms
// و209ms** في تشغيلتين (تأخيرٌ يميّز النقرة المفردة من المزدوجة)، فالنافذة
// `900ms` سخيّة أربع مرات. وما يقع خارجها **يُطبع ضجيجاً موسوماً لا يُحذف**:
// صفحة يوتيوب تُطلق `play`/`pause` من إعلاناتها وتنقّلها، **ونسبتُها إلى نقرتنا
// كذبٌ بأرقام صحيحة**.
const ATTRIB_MS = 900;

async function trustedClick(page, x, y, button = "left") {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await sleep(150);
  await evalIn(page, `(window.__s6.seq.push({ tag: "probe:click-sent",
    at: Math.round(performance.now() - window.__s6.t0) }), true)`);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button, clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button, clickCount: 1 });
}

// ── الحالات ─────────────────────────────────────────────────────────────────
const BASE = { enabled: true, blockedHosts: [] };
const zonesCfg = (clickMap) => ({
  globalSiteRules: { enabled: true, mappings: [] },
  settings: { ...BASE, zones: { enabled: true, fullscreenOnly: false, gridCoverage: "player",
                                click: { map: clickMap } } }
});
// المربّع 5 هو **مركز** الفيديو، وهو موضع النقرة في كل الحالات.
const CASES = [
  { key: "noext_click",  label: "بلا إضافة · نقرة على الفيديو", ext: false, click: "video" },
  { key: "noext_none",   label: "بلا إضافة · بلا نقرة (شاهد سالب)", ext: false, click: null },
  // ⚠️ **الشاهد السالب الثاني صفحة محلية عمداً، لا نقرة خارج مشغّل المضيف.**
  // جُرّب الثاني أوّلاً فأعطى `play+542ms` بعد نقرة على صفٍّ من بيانات الفيديو:
  // صفحة يوتيوب تُطلق أحداث وسائط من تلقائها (إعلان · تنقّل SPA · إعادة تحميل
  // مصدر)، **فكانت الأداة تقيس ضجيج المضيف لا تمييزَها هي**. والصفحة المحلية
  // تعزل السؤال بالضبط: **فيديو بلا أي معالج نقر عند المضيف** ⇒ نقرة موثوقة
  // عليه **يجب** ألّا تُنتج تفاعلاً. فإن أنتجت، فالإشارة من الأداة لا من المضيف.
  { key: "local_neg",    label: "صفحة محلية بلا معالج نقر (شاهد سالب)", ext: false, click: "video", local: true },
  { key: "ext_nobind",   label: "إضافة · المربّعات مفعّلة **بلا ربط**", ext: true, click: "video",
    cfg: zonesCfg({}) },
  { key: "ext_volume",   label: "إضافة · ربط يسار ⇒ VOLUME (أمر ينجح)", ext: true, click: "video",
    cfg: zonesCfg({ "5": { left: ["ACTION:VOLUME:+10"] } }) },
  { key: "ext_play",     label: "إضافة · ربط يسار ⇒ TOGGLE_PLAY (تنفيذ مزدوج؟)", ext: true, click: "video",
    cfg: zonesCfg({ "5": { left: ["ACTION:TOGGLE_PLAY"] } }) },
  { key: "ext_fail",     label: "إضافة · ربط يسار ⇒ أمر **يفشل** (PiP معطَّل)", ext: true, click: "video",
    cfg: zonesCfg({ "5": { left: ["ACTION:TOGGLE_PIP"] } }), disablePip: true },
  { key: "ext_generic",  label: "المسار العام · Mouse1 ⇒ VOLUME (المربّعات مطفأة)", ext: true, click: "video",
    cfg: { globalSiteRules: { enabled: true, mappings: [{ from: "Mouse1", to: "ACTION:VOLUME:+10" }] },
           settings: { ...BASE, zones: { enabled: false } } } },
  // ── S9: الزرّان الآخران — مساراتهما `auxclick`/`contextmenu`/`mousedown` ───
  { key: "s9_right_noext", label: "S9 · بلا إضافة · **يمين** على الفيديو", ext: false, click: "video", button: "right" },
  { key: "s9_right_bound", label: "S9 · إضافة · ربط **يمين** ⇒ VOLUME", ext: true, click: "video", button: "right",
    cfg: zonesCfg({ "5": { right: ["ACTION:VOLUME:+10"] } }) },
  { key: "s9_mid_noext",   label: "S9 · بلا إضافة · **أوسط** على الفيديو", ext: false, click: "video", button: "middle" },
  { key: "s9_mid_bound",   label: "S9 · إضافة · ربط **أوسط** ⇒ VOLUME", ext: true, click: "video", button: "middle",
    cfg: zonesCfg({ "5": { middle: ["ACTION:VOLUME:+10"] } }) }
];

async function runCase(hostKey, c, port) {
  const host = HOSTS[hostKey];
  const out = { key: c.key, label: c.label, host: host.name };
  let h = null, page = null, srv = null;
  try {
    h = await launch(port, { withExtension: c.ext, extra: ["--window-size=1600,1000"] });
    if (c.ext) {
      const w = await configure(port, h.extensionId, c.cfg);
      out.configured = !!w.ok;
      if (!w.ok) { out.skipped = "تعذّر ضبط التخزين: " + (w.why || w.error); return out; }
    }
    let urls = host.urls;
    if (c.local) { const s = await serveTestPage(port + 900); srv = s.srv; urls = [s.url]; }
    let ready = null;
    for (const url of urls) {
      try { page?.ws?.close(); } catch {}
      page = await openPage(port, url);
      out.url = url;
      ready = await waitPlaying(page);
      if (ready) break;
    }
    if (!ready) {
      // ⚠️ **السبب يُسمّى ولا يُترك عَرَضاً غامضاً.** بعد عشرات التشغيلات من
      // العنوان نفسه ردّ جوجل بـ`/sorry/index` («حركة مرور غير معتادة»)، فطبعت
      // الأداة «لم يستقرّ فيديو» — وهو **صحيح وغير مفيد**: من يقرؤه يفتّش في
      // الرِكاز والمنتج، والحاجز عند المضيف. والحدّ اليوميّ حقيقة تشغيلية تُقال.
      const gate = await evalIn(page, `location.href.includes("/sorry/") ||
        /unusual traffic|حركة مرور غير معتادة/.test(document.body ? document.body.innerText : "")`);
      out.skipped = gate ? "**المضيف حجب الآليّ** (صفحة /sorry) — لا قياس من هذا العنوان الآن"
                         : "لم يستقرّ فيديو شغّال — لا يُقرأ سكون (شاهد 17)";
      return out;
    }
    out.rect = [ready.w, ready.h];
    // فيديو يعلن `disablePictureInPicture` يجعل `runAction` يُرجع false — وهو
    // **مسار حقيقي في الطبيعة** (مواقع تُعطّل PiP)، لا افتعال في الأداة.
    if (c.disablePip) await evalIn(page, `document.querySelector("video").disablePictureInPicture = true`);
    const inst = await evalIn(page, PROBE);
    if (!inst?.ok) { out.skipped = "تعذّر تركيب المِجَسّ: " + (inst?.why || "?"); return out; }
    const quiet = await waitQuiet(page);
    if (!quiet) { out.skipped = "لم يسكن المضيف (إعلان أو تقطّع) — لا يُنسب حدث إلى نقرة"; return out; }
    const st = await evalIn(page, READ);
    out.before = { paused: st.paused, vol: st.vol, muted: st.muted };
    if (c.click === "video") await trustedClick(page, ready.x, ready.y, c.button || "left");
    await sleep(1800);
    const r = await evalIn(page, READ);
    out.seq = r.seq;
    out.after = { paused: r.paused, vol: r.vol, muted: r.muted };
  } catch (e) {
    out.skipped = String(e?.message || e).slice(0, 70);
  } finally {
    try { page?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {}
    try { h?.proc?.kill(); } catch {}
    try { srv?.close(); } catch {}
  }
  return out;
}

// ── الحكم على حالة واحدة ────────────────────────────────────────────────────
const has = (o, tag) => (o.seq || []).some((s) => s.tag === tag);
const clickAt = (o) => ((o.seq || []).find((s) => s.tag === "probe:click-sent") || {}).at;
// منسوب إلى النقرة: داخل النافذة المقيسة بعدها. وبلا نقرة: لا شيء منسوب.
const inWindow = (o, s) => {
  const t = clickAt(o);
  return t !== undefined && s.at >= t && s.at - t <= ATTRIB_MS;
};
const count = (o, tag) => (o.seq || []).filter((s) => s.tag === tag && inWindow(o, s)).length;
const mediaAll = (o) => (o.seq || []).filter((s) => s.tag === "media:play" || s.tag === "media:pause");
const mediaEvents = (o) => mediaAll(o).filter((s) => inWindow(o, s));
const mediaNoise = (o) => mediaAll(o).filter((s) => !inWindow(o, s));
const hostActed = (o) => mediaEvents(o).length > 0;
const noiseNote = (o) => mediaNoise(o).length
  ? ` ⚠️ وخارج النافذة ${mediaNoise(o).map((m) => m.tag.split(":")[1] + "@" + m.at).join(",")} — ضجيج مضيف، غير منسوب`
  : "";

function verdict(o) {
  if (o.skipped) return `⚠️ ${o.skipped}`;
  const t = clickAt(o);
  // ⚠️ **مَن فعلَها يُحسم بنيوياً لا بالزمن وحده.** `stopImmediatePropagation` عند
  // `window/capture` يقتل الحدث قبل **كل** مستمع لاحق في المسار كلّه — فمستمع
  // مسجَّل بعدنا لم يصله الحدث يعني أن **معالج المضيف لم يُستدعَ أصلاً**، وأي
  // حدث وسائط بعده **أثرُ أمرنا نحن**. وبلا هذا التمييز نسبت الأداة إيقافاً
  // فعلناه نحن (+17ms) إلى المضيف، وهي **قراءة كاذبة بأرقام صحيحة**.
  // ولا يُقال «قُتل الحدث» حيث **لا حدث أُرسل أصلاً** — الحالة السالبة الأولى
  // لا نقرة فيها، ووسمُها بالحجب يصف عجزاً عن الإرسال بأنه نجاح للحاجز.
  const sent = t !== undefined;
  const blocked = sent && !has(o, "win-cap:click");
  const ev = mediaEvents(o).map((m) => `${m.tag.split(":")[1]}+${m.at - t}ms`).join(",");
  const bits = [];
  bits.push(!sent ? "**لا نقرة أُرسلت**"
    : blocked ? "الحدث **قُتل عند window/capture** — لم يصل مستمعاً بعدنا"
              : "الحدث **وصل** مستمعاً بعدنا (لم نحجبه)");
  if (!mediaEvents(o).length) bits.push("ولا أثر في الوسائط");
  else bits.push(blocked ? `والأثر **لأمرنا** (${ev})` : `و**المضيف تفاعل** (${ev})`);
  if (count(o, "media:volume")) bits.push(`صوتنا تغيّر ×${count(o, "media:volume")}`);
  return bits.join(" · ") + noiseNote(o);
}

// ── التشغيل ─────────────────────────────────────────────────────────────────
// **القياس والتفسير خطوتان (قرار 38):** الخام يُكتب، و`--from-raw` يعيد الطباعة
// بلا متصفّح — فخطأ تسمية يُصحَّح بلا تشغيلة تُغيّر الأرقام تحت التصحيح.
const RAW = path.join(ROOT, "tools", ".s6-raw.json");
const hostKeys = HOST_ARG ? [HOST_ARG] : ["youtube", "twitch"];
let port = 9861;
let results = {};

if (process.argv.includes("--from-raw")) {
  results = JSON.parse(fs.readFileSync(RAW, "utf8"));
} else {
  for (const hk of hostKeys) {
    if (!HOSTS[hk]) { console.log(`مضيف غير معروف: ${hk}`); process.exit(1); }
    results[hk] = [];
    let cases = WITNESS_ONLY ? CASES.slice(0, 3) : CASES;
    if (CASE_ARG.length) cases = CASES.filter((c) => CASE_ARG.includes(c.key));
    for (const c of cases) {
      process.stdout.write(`⏳ ${HOSTS[hk].name} · ${c.label} … `);
      const r = await runCase(hk, c, port++);
      results[hk].push(r);
      console.log(r.skipped ? "لم يُقس" : "تمّ");
    }
  }
  const prev = fs.existsSync(RAW) ? JSON.parse(fs.readFileSync(RAW, "utf8")) : {};
  const merged = { ...prev };
  for (const hk of Object.keys(results)) {
    const old = merged[hk] || [];
    const byKey = new Map(old.map((r) => [r.key, r]));
    for (const r of results[hk]) byKey.set(r.key, r);
    merged[hk] = CASES.map((c) => byKey.get(c.key)).filter(Boolean);
  }
  fs.writeFileSync(RAW, JSON.stringify(merged, null, 1));
  results = merged;
}

console.log(`\n=== S6 — هل يصل الحدث إلى المضيف؟ قياس سلوكيّ ===`);
for (const hk of Object.keys(results).filter((k) => !HOST_ARG || k === HOST_ARG)) {
  const rs = results[hk];
  const by = (k) => rs.find((r) => r.key === k) || {};
  const pos = by("noext_click"), negNone = by("noext_none"), negOut = by("local_neg");

  console.log(`\n──────── ${HOSTS[hk].name}`);
  console.log(`\n── فحص البصر (قرار 26)`);
  const posOk = !pos.skipped && hostActed(pos);
  const negNoneOk = !negNone.skipped && (negNone.seq || []).filter((s) => !s.tag.startsWith("probe:")).length === 0;
  const negOutOk = !negOut.skipped && !hostActed(negOut);
  const lat = (o) => mediaEvents(o).map((m) => `${m.tag.split(":")[1]}+${m.at - clickAt(o)}ms`).join(",");
  console.log(`  موجب : بلا إضافة + نقرة ⇒ ${pos.skipped ? "⚠️ " + pos.skipped : (posOk ? `✅ المضيف تفاعل (${lat(pos)})` : "❌ لم يتفاعل — لا يُقرأ رقم من هذا المضيف")}${noiseNote(pos)}`);
  console.log(`  سالب1: بلا نقرة إطلاقاً ⇒ ${negNone.skipped ? "⚠️ " + negNone.skipped : (negNoneOk ? "✅ صفر حدث" : `❌ ${(negNone.seq || []).length} حدثاً بلا نقرة`)}`);
  console.log(`  سالب2: صفحة محلية · نقرة على الفيديو ⇒ ${negOut.skipped ? "⚠️ " + negOut.skipped : (negOutOk ? "✅ لا تفاعل منسوب" : `❌ تفاعل منسوب: ${lat(negOut)}`)}${noiseNote(negOut)}`);
  const valid = posOk && negNoneOk && negOutOk;
  console.log(`  ⇒ ${valid ? "**الرِكاز صالح على هذا المضيف**" : "**غير صالح — لا يُبنى على رقم منه هنا**"}`);

  console.log(`\n── التسلسل الخام — بلا إضافة (يقول على أي حدث يتصرّف المضيف)`);
  for (const s of (pos.seq || [])) {
    console.log(`   ${String(s.at).padStart(5)}ms  ${s.tag.padEnd(20)} paused=${s.paused}${s.trusted === false ? " ⚠️ غير موثوق" : ""}${s.vol !== undefined ? ` vol=${s.vol}` : ""}`);
  }

  if (!valid || WITNESS_ONLY) continue;

  console.log(`\n── الحالات`);
  for (const r of rs) {
    console.log(`\n  ${r.label}`);
    console.log(`    ${verdict(r)}`);
    if (r.after?.swapped) console.log(`    ⚠️ المضيف استبدل عنصر الفيديو بعد القياس — «بعد» عن العنصر المُراقَب`);
    if (r.seq && !r.skipped) {
      const tags = r.seq.map((s) => `${s.tag}@${s.at}`).join(" › ");
      console.log(`    التسلسل: ${tags || "(فارغ)"}`);
      console.log(`    قبل: paused=${r.before?.paused} vol=${r.before?.vol} · بعد: paused=${r.after?.paused} vol=${r.after?.vol}`);
    }
  }
}
console.log("");
