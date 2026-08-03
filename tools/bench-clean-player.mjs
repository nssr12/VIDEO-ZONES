// S7 — قياس محدِّدات Clean Player على يوتيوب حيّ: كم يطابق كل محدِّد، وأين، وبأي حال.
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**
//   node tools/bench-clean-player.mjs            # التقرير كاملاً
//   node tools/bench-clean-player.mjs --witness  # فحص البصر وحده (شاهدا قرار 26)
//
// ── ماذا يقيس بالضبط ────────────────────────────────────────────────────────
// المحدِّدات **لا تُنسخ هنا**: تُقرأ من `CLEAN_PLAYER_ITEMS` في `content.js` نفسه
// بتقييم نصّه، فلا يوجد موضع ثانٍ يتباعد (قرار 34).
//
// والسؤال ليس «كم صفراً» بل **لماذا الصفر**، والتمييز الثلاثي هو كلّ قيمة التقرير:
//   (أ) **بنية تغيّرت** — الاسم لم يعد في مصادر يوتيوب نفسها (CSS و JS المشغّل).
//   (ب) **حال لم تقع** — الاسم **موجود في مصادر يوتيوب** لكن العنصر لا يُبنى إلا
//       في حال بعينها (وميض · قائمة · تضمين · نهاية · ملء شاشة). **وليس عطباً.**
//   (ج) **يطابق أكثر ممّا يجب** — يُقاس بالإخفاء الفعليّ: هل انكمش مستطيل الفيديو
//       أو المشغّل؟ وكم عنصراً مطابقاً هو **سلفٌ للفيديو** أو **خارج المشغّل**؟
//
// «الاسم في مصادر يوتيوب» هو المميِّز بين (أ) و(ب)، ولذلك يُنزَّل `base.js` وورقة
// أنماط المشغّل ويُبحث فيهما عن كل رمز نصّاً، **ويُطبع نصّ قاعدة CSS المحيطة به**
// لأنها تقول في أي سياق يُبنى العنصر. **صفرٌ في الشجرة مع وجودٍ في المصدر شيء،
// وصفرٌ في الاثنين شيء آخر تماماً** — وخلطهما يجعل التقرير بلا قيمة.
//
// ── شاهدا القبول (قرار 26) — ثلاثة أزواج، لأن الأداة ثلاث آلات لا واحدة ──────
//  1. **مِجَسّ الشجرة:** موجب `#movie_player` و`.ytp-play-button` (يجب أن يُطابَقا)
//     · سالب `.ytp-vz-fake-not-real` (يجب أن يكون صفراً).
//  2. **مِجَسّ المصدر:** موجب الرمز `ytp-play-button` (يجب أن يوجد نصّاً في مصادر
//     يوتيوب) · سالب `ytp-vz-fake-not-real` (يجب ألا يوجد).
//  3. **مِجَسّ الإخفاء:** موجب إخفاء `.html5-video-container` (يجب أن **ينكمش**
//     مستطيل الفيديو) · سالب إخفاء `.ytp-vz-fake-not-real` (يجب أن يكون **صفر
//     تغيّر**). بلا هذا الزوج يصير «لا ضرر» في كل مفتاح عمىً لا نتيجة.
// ولا يُطبع رقمٌ واحد إن سقط شاهد (قرار 26).
//
// ⚠️ **ولا ترشيح في المِجَسّ** (شاهد خامس، قرار 26): العنصر الصفريّ يُطبع موسوماً
// «مخفي» مع سبب إخفائه، ولا يُسقَط. الترشيح قرار القارئ لا قرار الأداة.
//
// ⚠️ **وحدّ القياس مصرَّح به:** كروم بلا رأس · **بلا تسجيل دخول** · لغة `ar_EG` ·
// وأصل التضمين `127.0.0.1`. يوتيوب يجري تجارب على المشغّل، فقد يرى حسابٌ آخر بناءً
// آخر. ما يخرج من هنا **مقيسٌ على هذه التركيبة**، لا حكمٌ على كل مستخدم.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { launch, openPage, evalIn, serveTestPage, connect, ROOT , killChrome } from "./ext-harness.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WITNESS_ONLY = process.argv.includes("--witness");
// `--overlap` يجيب سؤالَي #67 قبل أي سطر إصلاح: **هل `.annotation` يشمل
// `.iv-branding`؟** و**هل يخفي مفتاح `annotations` شيئاً آخر يراه المستخدم غير
// العلامة؟** — والثاني يغيّر **شكل** العلاج لا تفاصيله: إن لم يطابق المحدِّد إلا
// العلامة فالمفتاحان في الحقيقة واحد.
const OVERLAP_ONLY = process.argv.includes("--overlap");

// ── المحدِّدات تُقرأ من المنتج، لا تُنسخ ─────────────────────────────────────
function readItems() {
  const src = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
  const m = src.match(/const CLEAN_PLAYER_ITEMS = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error("تعذّر إيجاد CLEAN_PLAYER_ITEMS في content.js");
  return vm.runInNewContext("(" + m[1] + ")");
}
const ITEMS = readItems();
const ALL_SELECTORS = [...new Set(Object.values(ITEMS).flat())];

const FAKE = ".ytp-vz-fake-not-real";              // الشاهد السالب في الثلاثة
const TREE_POS = ["#movie_player", ".ytp-play-button"];
const HIDE_POS = ".html5-video-container";          // إخفاؤه **يجب** أن يُنكمش الفيديو

const PORT = 9741, HTTP = 8841;
const VIDEO = "dQw4w9WgXcQ";                        // فيديو ذو علامة قناة (watermark)
const EMBED_VIDEO = "aqz-KE-bpKQ";                  // يقبل التضمين من أصل محليّ
const LIVE = "jfKfPfyJRdk";                         // بثّ مباشر دائم
const PLIST = "PLMC9KNkIncKtGvr2kFRuXBVmBev6cAJ2u";

// ── مِجَسّ الشجرة ───────────────────────────────────────────────────────────
const treeProbe = (sels) => `(() => {
  const V = document.querySelector("video");
  const P = document.querySelector("#movie_player");
  const clsOf = (el) => {
    const c = el.className;
    return (c && typeof c === "object" && "baseVal" in c ? c.baseVal : String(c || "")).slice(0, 90);
  };
  const out = {};
  for (const sel of ${JSON.stringify(sels)}) {
    let els;
    try { els = [...document.querySelectorAll(sel)]; }
    catch (e) { out[sel] = { err: String(e.message).slice(0, 70) }; continue; }
    out[sel] = {
      n: els.length,
      // سلف الفيديو أو خارج المشغّل — عدّاً كاملاً لا عيّنة
      anc: els.filter((el) => V && el !== V && el.contains(V)).length,
      outside: els.filter((el) => !(P && P.contains(el))).length,
      // ولا ترشيح: العيّنة تُطبع كما هي، والمخفيّ موسوم بسببه
      els: els.slice(0, 4).map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // الشفافية تُفحص كذلك: عنصرٌ بمستطيل كامل وشفافية صفر **غير مرئي**،
        // وقولُ «مرئي 173×173» عنه رقمٌ صادق يقود إلى استنتاج كاذب.
        const op = parseFloat(cs.opacity);
        return { tag: el.tagName, id: el.id || "", cls: clsOf(el),
                 w: Math.round(r.width), h: Math.round(r.height), op,
                 why: cs.display === "none" ? "display:none"
                    : cs.visibility === "hidden" ? "visibility:hidden"
                    : op === 0 ? "opacity:0"
                    : (r.width > 0 && r.height > 0) ? "" : "مستطيل صفريّ",
                 inPlayer: !!(P && P.contains(el)) };
      })
    };
  }
  const r = V ? V.getBoundingClientRect() : null;
  const all = [...document.querySelectorAll("*")];
  const cls = (e) => String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className || "");
  return { out, url: location.href, fs: !!document.fullscreenElement,
           paused: V ? V.paused : null, t: V ? Math.round(V.currentTime) : null,
           dur: V && isFinite(V.duration) ? Math.round(V.duration) : null,
           rs: V ? V.readyState : null,
           vw: r ? Math.round(r.width) : 0, vh: r ? Math.round(r.height) : 0,
           // إحصاء العائلة: أي مجموعة أصناف يستعملها هذا المشغّل أصلاً
           ytp: all.filter((e) => /(^|\\s)ytp-/.test(cls(e))).length,
           ytmw: all.filter((e) => /(^|\\s)(ytm|ytw)[A-Z]/.test(cls(e))).length,
           build: (document.querySelector("#movie_player")?.dataset?.version || "").slice(0, 64) };
})()`;

// ── مِجَسّ الإخفاء: يُخفي فعلاً ويقيس الانكماش ثم يتراجع ─────────────────────
const hideProbe = (sels) => `(() => {
  const V = document.querySelector("video");
  const P = document.querySelector("#movie_player");
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return [Math.round(r.width), Math.round(r.height)]; };
  const before = { v: rect(V), p: rect(P) };
  const st = document.createElement("style");
  st.textContent = ${JSON.stringify(sels)}.map((s) => "html " + s).join(",\\n") + "{display:none !important}";
  document.documentElement.appendChild(st);
  const after = { v: rect(V), p: rect(P) };   // قراءة المستطيل تفرض التخطيط متزامناً
  st.remove();
  const d = (a, b) => (!a || !b) ? null : [b[0] - a[0], b[1] - a[1]];
  return { before, after, dv: d(before.v, after.v), dp: d(before.p, after.p) };
})()`;

// ── مِجَسّ المصدر: هل الرمز موجود نصّاً في ما يشحنه يوتيوب اليوم ────────────
function tokensOf(sel) {
  const t = new Set();
  for (const m of sel.matchAll(/[.#]([A-Za-z0-9_-]+)/g)) t.add(m[1]);
  for (const m of sel.matchAll(/['"]([^'"]+)['"]/g)) t.add(m[1]);
  return [...t];
}
async function collectSources(page) {
  const urls = await evalIn(page, `(() => {
    const u = new Set();
    for (const s of document.querySelectorAll("script[src]")) u.add(s.src);
    for (const l of document.querySelectorAll('link[rel="stylesheet"], link[as="style"]')) u.add(l.href);
    return [...u];
  })()`) || [];
  const inline = await evalIn(page, `(() => {
    let s = "";
    for (const el of document.querySelectorAll("style")) s += el.textContent || "";
    for (const el of document.querySelectorAll("script:not([src])")) s += el.textContent || "";
    return s.slice(0, 4000000);
  })()`) || "";
  const texts = [{ url: "(inline)", body: inline }];
  for (const u of urls) {
    if (!/^https?:/.test(u)) continue;
    try {
      const r = await fetch(u);
      texts.push({ url: u, body: r.ok ? await r.text() : "", err: r.ok ? null : r.status });
    } catch (e) { texts.push({ url: u, body: "", err: String(e.message).slice(0, 40) }); }
  }
  return texts;
}
const shortName = (u) => u.split("/").slice(-1)[0].slice(0, 32);
function findToken(sources, tok) {
  const hits = sources.filter((s) => s.body.includes(tok));
  // نصّ قاعدة CSS المحيطة: يقول في أي سياق يُبنى العنصر
  const rules = [];
  for (const s of hits) {
    if (!/\.css/.test(s.url)) continue;
    for (const block of s.body.split("}")) {
      const i = block.indexOf("{");
      if (i < 0) continue;
      const selPart = block.slice(0, i);
      if (selPart.includes(tok) && rules.length < 4) rules.push(selPart.trim().slice(0, 110));
    }
  }
  return { found: hits.length > 0, where: hits.map((h) => shortName(h.url)), rules };
}

// ── قيادة الصفحة ────────────────────────────────────────────────────────────
const mouseMove = (c, x, y) => c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
async function click(c, x, y) {
  await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
async function pressKey(c, key, code, vk) {
  const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await c.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}
async function centerOf(page, sel) {
  return await evalIn(page, `(() => { const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null; const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
}
async function hoverPlayer(page) {
  const p = await centerOf(page, "#movie_player");
  if (p) { await mouseMove(page, p.x, p.y); await mouseMove(page, p.x + 3, p.y + 2); }
  return p;
}
// ⚠️ قرار 22: لا يُقرأ رقم قبل أن يستقرّ التخطيط ويكون المستطيل غير صفريّ.
// `needMedia:false` لصفحة يقيس منها شجرة المشغّل وإن لم تُشغَّل الوسائط (بثّ مقيَّد).
async function waitPlayer(page, ms = 25000, needMedia = true) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = await evalIn(page, `(() => { const v = document.querySelector("video");
      if (!v) return null; const b = v.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height), rs: v.readyState,
               chrome: !!document.querySelector(".ytp-left-controls, #movie_player") }; })()`);
    if (r && r.w > 0 && r.h > 0 && (needMedia ? r.rs >= 2 : r.chrome)) return r;
    await sleep(500);
  }
  return null;
}

const PROBE_SELS = () => [...ALL_SELECTORS, ...TREE_POS, FAKE];

async function statesOnWatch(page, states) {
  const probeAll = () => evalIn(page, treeProbe(PROBE_SELS()));

  await hoverPlayer(page);
  await sleep(600);
  states.watch = await probeAll();                                   // مشغّل + شريط ظاهر

  // ── الوميض: نوعان لا نوع (البند #62) — يُقاسان فوراً قبل أن يخبوَا ───────
  await pressKey(page, "ArrowDown", "ArrowDown", 40);
  await sleep(110);
  states.bezelValued = await probeAll();                             // وميض له نصّ (صوت)
  await pressKey(page, "ArrowUp", "ArrowUp", 38);
  await sleep(500);
  await pressKey(page, "k", "KeyK", 75);                             // تشغيل/إيقاف
  await sleep(110);
  states.bezelPlain = await probeAll();                              // وميض بلا نصّ
  await pressKey(page, "k", "KeyK", 75);
  await sleep(500);

  // ── قائمة الإعدادات مفتوحة ──────────────────────────────────────────────
  const gear = await centerOf(page, ".ytp-settings-button");
  if (gear) { await click(page, gear.x, gear.y); await sleep(900); states.settings = await probeAll();
              await click(page, gear.x, gear.y); await sleep(500); }

  // ── مؤشّر فوق شريط التقدّم (خريطة الحرارة) ──────────────────────────────
  const bar = await centerOf(page, ".ytp-progress-bar-container");
  if (bar) { await mouseMove(page, bar.x, bar.y); await sleep(700); states.progress = await probeAll(); }

  // ── متوقّف ──────────────────────────────────────────────────────────────
  await evalIn(page, `document.querySelector("video")?.pause()`);
  await sleep(1500);
  states.paused = await probeAll();

  // ── ملء الشاشة (بتمرير مؤشّر بعده كي لا يختفي الشريط) ───────────────────
  await evalIn(page, `document.querySelector("video")?.play()`);
  await sleep(400);
  await hoverPlayer(page);
  const fsb = await centerOf(page, ".ytp-fullscreen-button");
  if (fsb) {
    await click(page, fsb.x, fsb.y);
    await sleep(2000);
    await hoverPlayer(page);
    await sleep(800);
    states.fullscreen = await probeAll();
    await pressKey(page, "Escape", "Escape", 27);
    await sleep(1200);
  }

  // ── قرب النهاية (شاشة النهاية والبطاقات الختامية) ───────────────────────
  await evalIn(page, `(() => { const v = document.querySelector("video");
    if (v && isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 3); })()`);
  await sleep(4500);
  states.nearEnd = await probeAll();
  return states;
}

// ── مشغّل التضمين: iframe في صفحة محليّة ⇒ مُحيل حقيقي (بلا ذلك: الخطأ 153) ──
async function measureEmbed(url, label, states) {
  let host = null, srv = null, c = null;
  try {
    const s = await serveTestPage(HTTP, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<iframe id="f" width="1200" height="675" style="border:0;display:block" src="${url}"
 allow="autoplay" allowfullscreen></iframe></body>`);
    srv = s.srv;
    host = await openPage(PORT, s.url);
    await sleep(12000);
    // المؤشّر يُرسل إلى الصفحة المضيفة بإحداثيات الـ iframe فيصل إلى الإطار
    const box = await evalIn(host, `(() => { const r = document.getElementById("f").getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
               by: Math.round(r.top + r.height - 30) }; })()`);
    for (const [x, y] of [[box.x, box.y], [box.x + 6, box.y + 4], [box.x, box.by]]) {
      await mouseMove(host, x, y); await sleep(450);
    }
    await sleep(1500);
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const t = list.find((x) => (x.url || "").includes("/embed/"));
    if (!t) { states[label] = { skipped: "لا هدف للإطار" }; return; }
    c = await connect(t.webSocketDebuggerUrl);
    await c.send("Runtime.enable");
    states[label] = await evalIn(c, treeProbe(PROBE_SELS()));
    // ثم الإيقاف: طبقة «مزيد من الفيديوهات» تُبنى عند الإيقاف في التضمين الكلاسيكي
    await evalIn(c, `document.querySelector("video")?.pause()`);
    await sleep(2500);
    await mouseMove(host, box.x + 2, box.y + 2);
    await sleep(1500);
    states[label + "Paused"] = await evalIn(c, treeProbe(PROBE_SELS()));
  } catch (e) {
    states[label] = { skipped: String(e.message).slice(0, 60) };
  } finally {
    try { c?.ws?.close(); } catch {}
    try { host?.ws?.close(); } catch {}
    try { srv?.close(); } catch {}
  }
}

// ── قياس التداخل (#67) — على المشغّل الحيّ، وبشاهديه ──────────────────────
const OVERLAP_PROBE = `(() => {
  const clsOf = (el) => String(el.className && el.className.baseVal !== undefined
    ? el.className.baseVal : el.className || "");
  const list = (sel) => { try { return [...document.querySelectorAll(sel)]; } catch { return null; } };
  const shape = (el) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const op = parseFloat(cs.opacity);
    return { tag: el.tagName, cls: clsOf(el).slice(0, 90), w: Math.round(r.width), h: Math.round(r.height),
             why: cs.display === "none" ? "display:none" : cs.visibility === "hidden" ? "visibility:hidden"
                : op === 0 ? "opacity:0" : (r.width > 0 && r.height > 0) ? "" : "مستطيل صفريّ",
             // ⚠️ **النصّ يُرجَع خاماً، وطيُّ الفراغات يقع في node لا في الصفحة.**
             // ثلاث محاولات سقطت هنا لسببٍ واحد: **قالبٌ نصّيّ يبتلع ما يُكتب فيه**
             // — شرطةُ s صارت محدِّداً يمحو كل حرف s (فطُبعت class هكذا "cla ")،
             // وشرطةُ n صارت سطراً حقيقياً داخل محدِّد نمطيّ فأسقطت السكربت كلّه.
             // **وما يُكتب في الصفحة يبقى بلا هروب، وما يحتاج هروباً يُعالَج هنا.**
             html: el.outerHTML.slice(0, 160) };
  };
  const ann = list(".annotation") || [], brand = list(".iv-branding") || [];
  const both = list(".annotation.iv-branding") || [];
  const annOnly = ann.filter((e) => !brand.includes(e));      // تعليق ليس علامة
  const brandOnly = brand.filter((e) => !ann.includes(e));    // علامة بلا صنف التعليق
  const cont = list(".video-annotations") || [];
  // **سؤال النسل (#67):** إن كانت العلامة داخل .video-annotations فإخفاء الحاوية
  // يُخفيها معها، ويبقى مفتاح annotations «يفعل ما لا يُسمّى به» بطريق ثانٍ —
  // والاستبعاد على .annotation وحده لا ينفع حينها.
  const inCont = brand.filter((b) => cont.some((c) => c.contains(b) && c !== b));
  const chain = (el) => { const out = []; let p = el.parentElement, i = 0;
    while (p && i++ < 6) { out.push(p.tagName + "." + (clsOf(p).split(" ")[0] || "")); p = p.parentElement; }
    return out; };
  return {
    brandInsideContainer: inCont.length,
    brandChain: brand.map(chain),
    contChain: cont.map(chain),
    n: { annotation: ann.length, ivBranding: brand.length, both: both.length,
         annotationOnly: annOnly.length, brandingOnly: brandOnly.length,
         videoAnnotations: cont.length },
    // **السؤال الأول:** هل كل ما يطابق .iv-branding يطابق .annotation كذلك؟
    brandIsSubsetOfAnn: brand.every((e) => ann.includes(e)),
    // **السؤال الثاني:** ما الذي يخفيه مفتاح annotations غير العلامة؟
    annOnlyShapes: annOnly.map(shape),
    contShapes: cont.map(shape),
    brandShapes: brand.map(shape),
    // شاهد سالب داخل المِجَسّ: صنف مخترَع يجب أن يكون صفراً
    fake: (list(".vz-fake-annotation-xyz") || []).length,
    // وشاهد موجب: عنصرٌ نعلم وجوده
    player: (list("#movie_player") || []).length
  };
})()`;

async function runOverlap() {
  const h = await launch(PORT, { withExtension: false, extra: ["--window-size=1600,1000"] });
  const out = { chrome: h.chrome, samples: [] };
  try {
    const page = await openPage(PORT, `https://www.youtube.com/watch?v=${VIDEO}`);
    const ready = await waitPlayer(page);
    if (!ready) throw new Error("لم يستقرّ مستطيل الفيديو — لا يُقرأ رقم (قرار 22)");
    await hoverPlayer(page);
    // ⚠️ عناصر التعليقات **تأتي متأخّرة** (قِيس في S7: صفر عند t=6 ثم واحد لاحقاً)،
    // فتُؤخذ ثلاث عيّنات متباعدة **ولا يُقرأ صفرٌ من عيّنة واحدة**.
    for (const wait of [2000, 9000, 12000]) {
      await sleep(wait);
      const o = await evalIn(page, OVERLAP_PROBE);
      o.t = await evalIn(page, `Math.round(document.querySelector("video")?.currentTime || 0)`);
      out.samples.push(o);
    }
    try { page.ws.close(); } catch {}
  } catch (e) { out.error = String(e?.message || e).slice(0, 120); }
  finally { try { h.browser?.ws?.close(); } catch {} killChrome(h); }
  return out;
}

async function run() {
  const h = await launch(PORT, { withExtension: false, extra: ["--window-size=1600,1000"] });
  const report = { chrome: h.chrome, states: {}, sources: null };
  try {
    const page = await openPage(PORT, `https://www.youtube.com/watch?v=${VIDEO}`);
    const ready = await waitPlayer(page);
    if (!ready) throw new Error("لم يستقرّ مستطيل الفيديو — لا يُقرأ رقم (قرار 22)");
    report.ready = ready;

    // مِجَسّ المصدر أولاً (لا يعتمد على حال الصفحة)
    const sources = await collectSources(page);
    report.sources = { files: sources.length, bytes: sources.reduce((a, x) => a + x.body.length, 0),
                       failed: sources.filter((s) => s.err).length,
                       css: sources.filter((s) => /\.css/.test(s.url)).map((s) => shortName(s.url)) };
    report.srcPos = findToken(sources, "ytp-play-button");
    report.srcNeg = findToken(sources, "ytp-vz-fake-not-real");
    report.tokens = {};
    for (const sel of ALL_SELECTORS) {
      for (const tok of tokensOf(sel)) {
        if (!(tok in report.tokens)) report.tokens[tok] = findToken(sources, tok);
      }
    }

    // شاهد الإخفاء — الزوج الثالث
    report.hidePos = await evalIn(page, hideProbe([HIDE_POS]));
    report.hideNeg = await evalIn(page, hideProbe([FAKE]));
    // وشاهد الشجرة يُقاس في الحالتين — فحص البصر لا يُشغَّل على شجرة لم تُقرأ
    await hoverPlayer(page);
    await sleep(700);
    report.states.watch = await evalIn(page, treeProbe(PROBE_SELS()));

    if (!WITNESS_ONLY) {
      await statesOnWatch(page, report.states);
      // إخفاء كل مفتاح على حدة — على حال أساسية نظيفة
      await evalIn(page, `location.href = "https://www.youtube.com/watch?v=${VIDEO}"`);
      await sleep(2500);
      await waitPlayer(page);
      await hoverPlayer(page);
      await sleep(1500);
      report.hide = {};
      for (const [key, sels] of Object.entries(ITEMS)) {
        report.hide[key] = await evalIn(page, hideProbe(sels));
      }
      report.states.watch2 = await evalIn(page, treeProbe(PROBE_SELS()));

      // ⚠️ **والإخفاء يُعاد في ملء الشاشة**: مفاتيح لا تُبنى عناصرها إلا هناك
      // (الإجراءات السريعة · شبكة «مزيد من الفيديوهات» · الشريط العلوي)، وإخفاؤها
      // على صفحة watch **لا يقيس شيئاً** — صفرٌ من غياب لا من سلامة.
      const fsb2 = await centerOf(page, ".ytp-fullscreen-button");
      if (fsb2) {
        await click(page, fsb2.x, fsb2.y);
        await sleep(2000);
        await hoverPlayer(page);
        await sleep(800);
        report.hideFs = { _fs: await evalIn(page, `!!document.fullscreenElement`) };
        for (const [key, sels] of Object.entries(ITEMS)) {
          report.hideFs[key] = await evalIn(page, hideProbe(sels));
        }
        await pressKey(page, "Escape", "Escape", 27);
        await sleep(1000);
      }
    }
    try { page.ws.close(); } catch {}

    if (!WITNESS_ONLY) {
      // ── قائمة تشغيل · بثّ مباشر ─────────────────────────────────────────
      for (const [name, url, needMedia] of [
        ["playlist", `https://www.youtube.com/watch?v=${VIDEO}&list=${PLIST}`, true],
        ["live", `https://www.youtube.com/watch?v=${LIVE}`, false]
      ]) {
        let p = null;
        try {
          p = await openPage(PORT, url);
          const rdy = await waitPlayer(p, 25000, needMedia);
          if (!rdy) { report.states[name] = { skipped: "لم يستقرّ المستطيل" }; continue; }
          await hoverPlayer(p);
          await sleep(1500);
          report.states[name] = await evalIn(p, treeProbe(PROBE_SELS()));
        } catch (e) { report.states[name] = { skipped: String(e.message).slice(0, 60) }; }
        finally { try { p?.ws?.close(); } catch {} }
      }
      // ── التضمين: youtube.com و youtube-nocookie.com ─────────────────────
      await measureEmbed(`https://www.youtube.com/embed/${EMBED_VIDEO}?autoplay=1&mute=1`, "embed", report.states);
      await measureEmbed(`https://www.youtube-nocookie.com/embed/${EMBED_VIDEO}?autoplay=1&mute=1`, "nocookie", report.states);
    }
  } finally {
    try { h.browser?.ws?.close(); } catch {}
    killChrome(h);
  }
  return report;
}

// ── الطباعة ─────────────────────────────────────────────────────────────────
// `--from-raw` يُعيد طباعة **القياس المحفوظ** بلا متصفّح: يُصلَح عيبُ طباعةٍ بلا
// إعادة قياسٍ يغيّر الأرقام تحت التصحيح.
const RAW = path.join(ROOT, "tools", ".s7-raw.json");
const flat = (t) => String(t || "").replace(/[\s]+/g, " ").trim();
if (OVERLAP_ONLY) {
  const o = await runOverlap();
  console.log(`\n=== #67 — تداخل .annotation و.iv-branding على المشغّل الحيّ · كروم ${o.chrome} ===`);
  if (o.error) { console.log(`⚠️ ${o.error}`); process.exit(1); }
  const seen = o.samples.filter((s2) => s2.n.annotation > 0 || s2.n.ivBranding > 0);
  console.log(`\n── فحص البصر (قرار 26)`);
  console.log(`   موجب: #movie_player ⇒ ${o.samples.map((s2) => s2.player).join("/")} ${o.samples.every((s2) => s2.player === 1) ? "✅" : "❌"}`);
  console.log(`   سالب: صنف مخترَع ⇒ ${o.samples.map((s2) => s2.fake).join("/")} ${o.samples.every((s2) => s2.fake === 0) ? "✅" : "❌"}`);
  console.log(`   وعيّنة فيها عناصر تعليق: ${seen.length} من ${o.samples.length} ${seen.length ? "✅" : "❌ **لم تظهر العناصر — لا يُقرأ صفرها** (S7: تأتي متأخّرة)"}`);
  if (!seen.length) process.exit(1);
  for (const s2 of o.samples) {
    console.log(`\n── عيّنة عند t=${s2.t}s`);
    console.log(`   .annotation ${s2.n.annotation} · .iv-branding ${s2.n.ivBranding} · الاثنان معاً ${s2.n.both}`);
    console.log(`   .annotation وليس .iv-branding ⇒ **${s2.n.annotationOnly}** · .iv-branding وليس .annotation ⇒ **${s2.n.brandingOnly}**`);
    console.log(`   .video-annotations ⇒ ${s2.n.videoAnnotations}`);
    console.log(`   هل كل .iv-branding داخل .annotation؟ **${s2.brandIsSubsetOfAnn ? "نعم — الشمول ثابت" : "لا"}**`);
    console.log(`   **وهل العلامة من نسل .video-annotations؟ ${s2.brandInsideContainer > 0 ? `**نعم — ${s2.brandInsideContainer} منها داخلها**` : "**لا — صفر**"}**`);
    for (const c of s2.brandChain) console.log(`     سلسلة آباء العلامة: ${c.join(" ⇐ ")}`);
    for (const c of s2.contChain) console.log(`     سلسلة آباء الحاوية: ${c.join(" ⇐ ")}`);
    for (const x of s2.brandShapes) console.log(`     [العلامة] ${x.tag}.${flat(x.cls)} ${x.w}×${x.h}${x.why ? " (" + x.why + ")" : " **مرئية**"}\n        ${flat(x.html)}`);
    for (const x of s2.annOnlyShapes) console.log(`     [تعليق آخر] ${x.tag}.${flat(x.cls)} ${x.w}×${x.h}${x.why ? " (" + x.why + ")" : " **مرئي**"}\n        ${flat(x.html)}`);
    for (const x of s2.contShapes) console.log(`     [الحاوية] ${x.tag}.${flat(x.cls)} ${x.w}×${x.h}${x.why ? " (" + x.why + ")" : ""}\n        ${flat(x.html)}`);
  }
  fs.writeFileSync(path.join(ROOT, "tools", ".s7-overlap-raw.json"), JSON.stringify(o, null, 1));
  console.log(`\n(الخام في tools/.s7-overlap-raw.json)`);
  process.exit(0);
}
const report = process.argv.includes("--from-raw")
  ? JSON.parse(fs.readFileSync(RAW, "utf8"))
  : await run();
const NAMES = { watch: "watch", watch2: "watch₂", bezelValued: "وميض-نصّ", bezelPlain: "وميض-صامت",
  settings: "قائمة", progress: "شريط", paused: "متوقّف", fullscreen: "ملء", nearEnd: "نهاية",
  playlist: "قائمة-تشغيل", live: "بثّ", embed: "تضمين", embedPaused: "تضمين-متوقّف",
  nocookie: "nocookie", nocookiePaused: "nocookie-متوقّف" };

console.log(`\n=== S7 — محدِّدات Clean Player على يوتيوب حيّ · كروم ${report.chrome} ===`);
console.log(`المفاتيح: ${Object.keys(ITEMS).length} · المحدِّدات: ${ALL_SELECTORS.length} (مقروءة من content.js)`);
console.log(`المصادر: ${report.sources.files} ملفاً · ${(report.sources.bytes / 1048576).toFixed(1)}MB · تعذّر ${report.sources.failed} · CSS: ${report.sources.css.join(", ")}`);

const w = report.states.watch || {};
const treeNeg = w.out?.[FAKE]?.n;
const posOk = TREE_POS.every((s) => (w.out?.[s]?.n || 0) > 0);
const negOk = treeNeg === 0;
const srcOk = report.srcPos.found && !report.srcNeg.found;
const hidePosOk = !!report.hidePos?.dv && (report.hidePos.dv[0] < 0 || report.hidePos.dv[1] < 0);
const hideNegOk = !!report.hideNeg?.dv && report.hideNeg.dv[0] === 0 && report.hideNeg.dv[1] === 0;

console.log(`\n── فحص البصر (قرار 26) — ثلاثة أزواج`);
console.log(`  1. الشجرة  : موجب ${TREE_POS.map((s) => `${s}⇒${w.out?.[s]?.n ?? "?"}`).join(" · ")} ${posOk ? "✅" : "❌"} · سالب ${FAKE}⇒${treeNeg} ${negOk ? "✅" : "❌"}`);
console.log(`  2. المصدر  : موجب "ytp-play-button" ${report.srcPos.found ? "موجود ✅" : "مفقود ❌"} في [${report.srcPos.where.join(", ")}]`);
console.log(`              سالب "ytp-vz-fake-not-real" ${report.srcNeg.found ? "موجود ❌" : "غير موجود ✅"}`);
console.log(`  3. الإخفاء : موجب ${HIDE_POS} ⇒ الفيديو ${JSON.stringify(report.hidePos?.before?.v)} ⇒ ${JSON.stringify(report.hidePos?.after?.v)} ${hidePosOk ? "✅ انكمش" : "❌"}`);
console.log(`              سالب ${FAKE} ⇒ فرق ${JSON.stringify(report.hideNeg?.dv)} ${hideNegOk ? "✅ صفر" : "❌"}`);
const valid = posOk && negOk && srcOk && hidePosOk && hideNegOk;
console.log(`  ⇒ ${valid ? "**الرِكاز صالح**" : "**الرِكاز غير صالح — لا يُبنى على رقم منه**"}`);
if (!valid) process.exit(1);
if (WITNESS_ONLY) process.exit(0);

const stateKeys = Object.keys(report.states).filter((k) => report.states[k] && !report.states[k].skipped);
console.log(`\n── الحالات المقيسة (${stateKeys.length})`);
for (const k of stateKeys) {
  const v = report.states[k];
  console.log(`   ${(NAMES[k] || k).padEnd(16)} فيديو ${v.vw}×${v.vh} · t=${v.t}/${v.dur ?? "—"} · rs=${v.rs} · ملء=${v.fs} · عناصر ytp=${v.ytp} · ytm/ytw=${v.ytmw}${v.build ? ` · ${v.build.split("/").slice(3, 5).join("/")}` : ""}`);
}
for (const [k, v] of Object.entries(report.states)) {
  if (v?.skipped) console.log(`   ⚠️ ${NAMES[k] || k}: تُخُطّيت — ${v.skipped}`);
}

// أكبر ظهور مرئي عبر الحالات: يفصل «في الشجرة دائماً» عن «يظهر فعلاً في حال»
// ⚠️ **«مستطيل غير صفريّ» ليست «مرئي».** `.ytp-ce-element` مستطيله 173×173 وهو
// `visibility:hidden`، و`.ytp-heat-map-container` مستطيله 1081×40 وشفافيته صفر —
// وتسميتهما «مرئيَين» رقمٌ صادق يقود إلى استنتاج كاذب. فالمرئي: مستطيل غير صفريّ
// **ولا سبب إخفاء**، وما عداه يُطبع بسببه.
function bestVisible(sel) {
  let best = null;
  for (const k of stateKeys) {
    const e = report.states[k].out?.[sel]?.els?.[0];
    if (!e || !e.w || !e.h || e.why) continue;
    if (!best || e.w * e.h > best.w * best.h) best = { ...e, state: NAMES[k] || k };
  }
  return best;
}
// وأقصى مستطيل مهما كان سببه — كي يُفرَّق «لا يُبنى» عن «يُبنى مخفيّاً»
function widestHidden(sel) {
  let best = null;
  for (const k of stateKeys) {
    const e = report.states[k].out?.[sel]?.els?.[0];
    if (!e) continue;
    if (!best || (e.w * e.h) > (best.w * best.h)) best = { ...e, state: NAMES[k] || k };
  }
  return best;
}
const maxOf = (sel) => Math.max(...stateKeys.map((k) => report.states[k].out?.[sel]?.n || 0));
const statesHit = (sel) => stateKeys.filter((k) => (report.states[k].out?.[sel]?.n || 0) > 0).map((k) => NAMES[k] || k);

console.log(`\n── كل مفتاح · كل محدِّد`);
const dead = [], over = [];
for (const [key, sels] of Object.entries(ITEMS)) {
  const hid = report.hide?.[key], hidF = report.hideFs?.[key];
  const bad = (h, where) => (h?.dv && (h.dv[0] || h.dv[1])) ? ` ⚠️ الإخفاء غيّر الفيديو ${JSON.stringify(h.dv)} (${where})` : "";
  const dmg = bad(hid, "watch") + bad(hidF, "ملء");
  if (dmg) over.push({ key, why: dmg.trim() });
  const keyDead = sels.every((s) => maxOf(s) === 0);
  console.log(`\n  ${key}${keyDead ? "  ⛔ لا يطابق شيئاً في أي حال" : ""}${dmg}`);
  for (const sel of sels) {
    const mx = maxOf(sel);
    if (mx === 0) { dead.push({ key, sel, toks: tokensOf(sel), keyDead }); console.log(`    ${sel}  ⇒ 0 في كل الحالات`); continue; }
    const hits = statesHit(sel);
    const any = stateKeys.map((k) => report.states[k].out?.[sel]).find((x) => x && x.n > 0);
    const vis = bestVisible(sel);
    if (any?.anc > 0) over.push({ key, why: `${sel} يطابق ${any.anc} سلفاً للفيديو` });
    console.log(`    ${sel}  ⇒ ${mx} · في [${hits.join(",")}]${any?.anc ? ` · سلف للفيديو ${any.anc}` : ""}${any?.outside ? ` · خارج المشغّل ${any.outside}` : ""}`);
    const hid2 = widestHidden(sel);
    console.log(`        ${vis ? `مرئي ${vis.w}×${vis.h} في «${vis.state}» — ${vis.tag}${vis.id ? "#" + vis.id : ""}.${vis.cls.split(/\s+/)[0]}`
                             : `في الشجرة · **لم يُرَ مرئياً في أي حال** — أوسع ظهور ${hid2?.w}×${hid2?.h} في «${hid2?.state}» بـ${hid2?.why || "—"}`}`);
  }
}

console.log(`\n── الصفريّون وتصنيفهم بالمصدر (أ: البنية تغيّرت · ب: حال لم تقع)`);
for (const d of dead) {
  const anyFound = d.toks.some((t) => report.tokens[t]?.found);
  console.log(`\n  ${anyFound ? "ب" : "أ"} · ${d.key} · ${d.sel}`);
  for (const t of d.toks) {
    const f = report.tokens[t];
    console.log(`      ${t}: ${f?.found ? "في المصدر [" + f.where.slice(0, 3).join(", ") + "]" : "**لا أثر في أي مصدر شحنه يوتيوب**"}`);
    for (const r of (f?.rules || []).slice(0, 2)) console.log(`         قاعدة: ${r}`);
  }
}
console.log(`\n── يطابق أكثر ممّا يجب (ج) — اختبار الإخفاء في حالين: watch وملء الشاشة (${report.hideFs?._fs ? "ملء الشاشة وقع فعلاً ✅" : "⚠️ ملء الشاشة لم يقع — نتيجته لا تُقرأ"})`);
console.log(over.length ? over.map((o) => `  ${o.key}: ${o.why}`).join("\n") : "  لا شيء — لا مفتاح غيّر مستطيل الفيديو ولا طابق سلفاً له، في الحالين");

fs.writeFileSync(path.join(ROOT, "tools", ".s7-raw.json"), JSON.stringify(report, null, 1));
console.log(`\n(الخام في tools/.s7-raw.json)`);
