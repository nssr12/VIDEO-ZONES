// إعادة إنتاج البند #58 — أمر ملء الشاشة من الإضافة يكبّر الحاوية والفيديو يبقى
//
// ⛔ **من بوّابة الكومِت — يُشغَّل قبل كل كومِت.** ويحرس: **#58 · #17 · #59 · #46 · #47** — اختيارُ حاوية ملء الشاشة على البنيات العشر، وعدُّ البوّابة، وصفرُ دخولٍ احتياطيّ.
// بمقاسه الأصلي داخل شاشة سوداء.
//
// ⚠️ أداة تشخيص. **لا تلمس أي ملف يُشحن** — تحمّل content.js الحقيقي كما هو وتقيس.
// ⚠️ تحتاج كروم مثبَّتاً، مثل بقية أدوات bench في هذا المجلد.
//
//   node tools/repro-58-fullscreen.mjs
//
// تبني بنيات DOM مختلفة، وتنفّذ في كل واحدة **مسار الإضافة نفسه**
// (`toggleFullscreen(video)`) تحت إيماءة مستخدم حقيقية، ثم تقيس:
//   • ماذا أرجعت pickFullscreenContainer
//   • هل وُجد زر ملء شاشة أصلي (مسار #17)
//   • أي عنصر صار document.fullscreenElement
//   • مقاس الفيديو المرسوم قبل وبعد، ونسبته إلى الشاشة
//
// ملاحظات على أمانة النماذج، تعلّمناها من تشغيل أول أعطى نتائج مضلّلة:
//  • **الإيماءة** تُصطنع بـ Runtime.evaluate({ userGesture: true }). نقرة مُرسَلة
//    بـ Input.dispatchMouseEvent لم تُحتسب إيماءةً فبقي fullscreenElement=null.
//  • **لا <button> في الصفحة**: أي زر داخل body يمنحه ثلاث نقاط hasButtons في
//    سكور pickFullscreenContainer فيقلب النتيجة.
//  • **حجم الفيديو السطري (style="width:640px") يغلب أي قاعدة موقع بلا
//    `!important`**. فمن يقيس قاعدة موقع على فيديو محجَّم سطرياً يقيس الخطأ.
//    المشغّلات الحقيقية تحجّم الفيديو بـ CSS نسبيّ لا سطرياً — والحالتان مقيستان.
//
// ⚠️ **نافذةُ هذا الشاهد: 2500ms** — وكلُّ «نجت» و«ثبت» فيه يعني
// **حتى 2500ms ولا شيء بعدها**. ⛔ **ولا يُقرأ أخضرُه ضماناً أبعد من ذلك.**
// **والواقعة التي أوجبت هذا السطر (2026-08-04):** `bench-adapter-live` و
// `bench-yt-adapter` قالا «✅ نجت القيمة» بنافذتَي **1500ms و1000ms**،
// **ومحوُ يوتيوب يقع عند 3000ms** ⇒ **فكان أخضرُهما خبراً عن النافذة لا عن
// النجاة** — صادقاً حرفياً وكاذباً بما يوحي به (شكل #90 في شاهدٍ نستشهد به).
// ⛔ **ولا تُطال النافذةُ بلا سببٍ مقيس** — تطويلٌ بلا سبب ثمنٌ بلا مقابل.
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8809, CDP = 9390;
const W = 1440, H = 900;

const STUB = `
window.chrome = {
  runtime: { id: "repro", onMessage: { addListener() {} }, sendMessage: () => Promise.resolve(), lastError: null },
  storage: {
    sync: { get: (d) => Promise.resolve(Object.assign({}, d)), set: () => Promise.resolve() },
    onChanged: { addListener() {} }
  }
};`;

const CASES = String.raw`
// حجم الفيديو: "inline" = style سطري (يغلب قواعد الموقع)، "css" = صنف نسبيّ
// يملأ الحاوية كما تفعل المشغّلات الحقيقية، "cssfixed" = صنف بمقاس ثابت.
function mkVideo(mode) {
  const v = document.createElement("video");
  v.autoplay = true; v.muted = true; v.playsInline = true;
  if (mode === "inline") v.style.cssText = "width:640px;height:360px;background:#333";
  else if (mode === "css") v.className = "vzfill";
  else if (mode === "none") { /* الحجم من ورقة أنماط الحالة نفسها */ }
  else v.className = "vzfixed";
  const c = Object.assign(document.createElement("canvas"), { width: 640, height: 360 });
  const g = c.getContext("2d");
  let i = 0;
  setInterval(() => {
    g.fillStyle = "hsl(" + (i * 7 % 360) + ",60%,30%)"; g.fillRect(0, 0, 640, 360);
    g.fillStyle = "#fff"; g.font = "700 64px sans-serif"; g.fillText(String(i++), 40, 210);
  }, 100);
  v.srcObject = c.captureStream(10);
  return v;
}

function sheet(css) {
  const st = document.createElement("style");
  st.className = "vzcase";
  st.textContent = css;
  document.head.appendChild(st);
}

function wrapper(cls, child) {
  const w = document.createElement("div");
  w.className = cls;
  w.style.cssText = "position:relative;width:640px;height:360px;background:#000";
  w.appendChild(child);
  document.body.appendChild(w);
  return w;
}

const BASE = ".vzfill{position:absolute;inset:0;width:100%;height:100%;background:#333}" +
             ".vzfixed{width:640px;height:360px;background:#333}";

window.__cases = [
  {
    name: "أ — <video> ابن مباشر لـ body، حجم سطري",
    build() { const v = mkVideo("inline"); document.body.appendChild(v); return v; }
  },
  {
    name: "ب — <video> position:fixed على body (سكربت الاختبار الذي أعطيتُه للمالك)",
    build() {
      const v = mkVideo("inline");
      v.style.cssText += ";position:fixed;top:10%;left:10%";
      document.body.appendChild(v);
      return v;
    }
  },
  {
    name: "ج — حاوية عادية + فيديو بحجم ثابت (النمط الشائع للمشغّلات البسيطة)",
    build() { return wrapper("wrap", mkVideo("cssfixed")).querySelector("video"); }
  },
  {
    name: "د — حاوية .video-player معروفة + فيديو بحجم ثابت، بلا زر",
    build() { return wrapper("video-player", mkVideo("cssfixed")).querySelector("video"); }
  },
  {
    name: "هـ — حاوية + فيديو **نسبيّ يملأ الحاوية** (نمط المشغّلات الحقيقية)",
    build() { return wrapper("video-player", mkVideo("css")).querySelector("video"); }
  },
  {
    name: "و — فيديو ثابت + الموقع يشحن :fullscreen video بلا !important",
    build() {
      sheet(".video-player:fullscreen video{width:100%;height:100%}");
      return wrapper("video-player", mkVideo("cssfixed")).querySelector("video");
    }
  },
  {
    name: "ز — فيديو **سطريّ** + الموقع يشحن :fullscreen video بلا !important",
    build() {
      sheet(".video-player:fullscreen video{width:100%;height:100%}");
      return wrapper("video-player", mkVideo("inline")).querySelector("video");
    }
  },
  {
    name: "ح — زر أصلي .vjs-fullscreen-control + مشغّل يحجّم فيديوه نسبياً (#17)",
    build() {
      const v = mkVideo("css");
      const w = wrapper("video-js", v);
      const b = document.createElement("button");
      b.className = "vjs-fullscreen-control";
      b.addEventListener("click", () => w.requestFullscreen());
      w.appendChild(b);
      return v;
    }
  },
  {
    // بصمة مقيسة على https://d.tube/watch/<id> في 2026-07-30 (سلسلة الأسلاف
    // الحقيقية بأصنافها ومستطيلاتها). **منسوخة لا محمَّلة**: لا شبكة ولا IPFS.
    // مشغّل Shaka داخل تخطيط Tailwind: max-width:1400px + padding 0 32px،
    // وفيديو نسبيّ width/height:100%، وحاوية aspect-video 16/9.
    // الأصناف تحمل نفس الكلمات التي يطابقها looksPlayer (player · video ·
    // container) كي يكون السكور مطابقاً للموقع الحقيقي لا مقارباً له.
    name: "ي — بصمة d.tube الحقيقية: Shaka داخل Tailwind container (منسوخة)",
    build() {
      sheet(
        ".dt-page{min-height:1900px}" +
        ".dt-container{max-width:1400px;margin:0 auto;padding:24px 32px 16px}" +
        ".dt-aspect-video{aspect-ratio:16/9;background:#000}" +
        ".dt-rel{position:relative;width:100%;height:100%}" +
        ".dt-player-host{width:100%;height:100%}" +
        ".dt-player-wrapper{position:relative;width:100%;height:100%}" +
        ".dt-player-wrapper>video{width:100%;height:100%;object-fit:contain;background:#333}" +
        ".dt-bar{position:absolute;left:0;right:0;bottom:0;height:40px;background:rgba(0,0,0,.5)}"
      );
      const div = (cls, style) => {
        const d = document.createElement("div");
        if (cls) d.className = cls;
        if (style) d.setAttribute("style", style);
        return d;
      };
      const page = div("dt-page");
      const container = div("dt-container");          // ← ".md:container.md:pt-6.md:pb-4"
      const anon = div("");                           // ← DIV بلا صنف
      const aspect = div("dt-aspect-video");          // ← ".bg-black.md:rounded-xl.aspect-video"
      const rel = div("dt-rel", "aspect-ratio: 1920 / 888;"); // ← ".relative.w-full.h-full" بـ inline
      const host = div("dt-player-host");             // ← ".dtube-player-host.w-full.h-full"
      const wrap = div("dt-player-wrapper");          // ← ".dtube-player-wrapper.shaka-video-container"
      const v = mkVideo("none");                      // الحجم من ورقة الأنماط: 100%
      const bar = div("dt-bar");
      // 36 زراً كما قِيس على الموقع: كل سلف يحصل على hasButtons ⇒ 3 نقاط للجميع
      for (let i = 0; i < 36; i++) bar.appendChild(document.createElement("button"));
      wrap.appendChild(v); wrap.appendChild(bar);
      host.appendChild(wrap); rel.appendChild(host); aspect.appendChild(rel);
      anon.appendChild(aspect); container.appendChild(anon); page.appendChild(container);
      document.body.appendChild(page);
      return v;
    }
  },
  {
    // ⭐⭐ #140 — **الشكل الذي كسر، وكان غائباً عن العشر**: الشريطُ **خارج أضيقِ
    // حاويةٍ تشبه مشغّلاً ويملؤها الفيديو**. وهي بصمةُ فيميو المقيسة في CLAUDE.md
    // منذ #94: «div.vp-video» **بصفر ضابط**، **و11 ضابطاً مستوىً أعلى**.
    // ⚠️ **والفارقُ عن «ي» (d.tube) سطرٌ واحد**: هناك الشريطُ **داخل** الحاوية
    // التي يملؤها الفيديو، وهنا **أخوها** — ⇒ **ولهذا خضِرت العشرُ على العطب.**
    name: "ك — شريطُ المضيف خارج ما يملؤه الفيديو (#140)",
    build() {
      sheet(
        ".v140-player{position:relative;width:960px;height:588px;background:#000}" +
        ".v140-video{position:relative;width:100%;height:540px}" +
        ".v140-video>video{width:100%;height:100%;object-fit:contain;background:#333}" +
        ".v140-bar{position:absolute;left:0;right:0;bottom:0;height:48px;background:rgba(0,0,0,.55)}"
      );
      const div = (cls) => { const d = document.createElement("div"); d.className = cls; return d; };
      const player = div("v140-player");
      const inner = div("v140-video");
      const v = mkVideo("none");
      const bar = div("v140-bar");
      for (let i = 0; i < 12; i++) bar.appendChild(document.createElement("button"));
      inner.appendChild(v);
      player.appendChild(inner);
      player.appendChild(bar);
      document.body.appendChild(player);
      return v;
    }
  },
  {
    name: "ط — منصّة الظل: <video> ابن مباشر لجذر ظل (HANDOFF §9)",
    build() {
      const host = document.createElement("vz-repro-player");
      host.style.cssText = "position:fixed;top:8%;left:8%;background:#000";
      document.body.appendChild(host);
      const sr = host.attachShadow({ mode: "open" });
      const v = mkVideo("inline");
      sr.appendChild(v);
      return v;
    }
  }
];

const desc = (el) => {
  if (!el) return "null";
  if (el === document.body) return "BODY";
  if (el === document.documentElement) return "HTML";
  const cls = (el.className || "").toString().trim();
  return el.tagName + (cls ? "." + cls.split(/\s+/).join(".") : "");
};

window.__setup = (i) => {
  for (const st of document.querySelectorAll("style.vzcase")) st.remove();
  document.body.textContent = "";
  sheet(BASE);
  window.__v = window.__cases[i].build();
  return { name: window.__cases[i].name };
};

// ── #140 — **مِجَسّ قراءةٍ لا حكم**: أينجو شريطُ المضيف داخل ما نُكبّره؟ ─────
// ⚠️ **يُقرأ ولا يُبنى عليه علاجٌ قبل أن يُقارَن بالعشر** (شرط المالك 2026-09-05).
// **ونسخةُ السكور هنا تُثبت نفسها قبل أن تُصدَّق**: في كلّ بنيةٍ لا يحسمها الحكمُ
// القاطع، يجب أن يُطابق ما تُرجعه pickFullscreenContainer نفسُها — **وذاك شاهدُها
// الموجب** (قرار 26). ⛔ ولا علامةَ اقتباسٍ خلفية في هذي الكتلة: هي قالبٌ نصّيّ.
window.__scope = () => {
  const v = window.__v;
  const CTRL = "button, [role='button'], input[type='range']";
  const own = (el) => !!(el.closest && el.closest(".vzWrap"));
  const ctrls = (el) => {
    if (!el || !el.querySelectorAll) return null;
    return [...el.querySelectorAll(CTRL)].filter((b) => !own(b)).length;
  };
  const nearest = window.nearestPlayerAncestor ? window.nearestPlayerAncestor(v) : null;
  const picked = window.pickFullscreenContainer ? window.pickFullscreenContainer(v) : null;
  const vr = v.getBoundingClientRect();
  const va = Math.max(1, vr.width * vr.height);
  const cands = []; let cur = v;
  for (let i = 0; i < 8 && cur; i++) {
    if (cur !== document.body && cur !== document.documentElement) cands.push(cur);
    cur = cur.parentElement;
  }
  const rows = cands.map((el) => {
    const cls = (el.className || "").toString();
    const role = el.getAttribute ? (el.getAttribute("role") || "") : "";
    const hasButtons = !!el.querySelector(CTRL);
    const looksPlayer = /player|video|controls|overlay|container/i.test(cls + " " + role);
    const r = el.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return null;
    const areaRatio = (r.width * r.height) / va;
    const inside =
      r.left <= vr.left + vr.width / 2 && r.right >= vr.left + vr.width / 2 &&
      r.top <= vr.top + vr.height / 2 && r.bottom >= vr.top + vr.height / 2;
    if (!inside) return null;
    if (areaRatio > 3.5) return null;
    const score = (hasButtons ? 3 : 0) + (looksPlayer ? 2 : 0) + (el === v ? 0 : 1) +
                  Math.max(0, 2 - Math.abs(areaRatio - 1.15));
    return { el, name: desc(el), ctrls: ctrls(el), score: Math.round(score * 1000) / 1000 };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  // ⛔⭐ **أدواتُ مضيفٍ تُفقد** — والسؤال عن **الضوابط نفسِها لا عن العناصر الحاوية**:
  // أوّلُ صياغةٍ سألت «أثمّة سلفٌ فيه ضوابط لا يحويه المختار؟» **فطبعت «تُفقد» عن
  // سلفٍ يحوي الضوابطَ نفسَها التي في المختار** (بنية ي: 36 زرّاً داخل المختار،
  // وأبوه يحويها فحُسب فقداً). ⇒ **مطابقةٌ أوسعُ من سؤالها** (قرار 93)، والصواب:
  // **عُدَّ الضوابطَ التي لا يحويها المختار.**
  const lostCtrls = (el) => {
    if (!el) return null;
    const seen = new Set();
    for (const c of cands) {
      for (const b of c.querySelectorAll(CTRL)) {
        if (own(b)) continue;              // #141 — أزرارُنا ليست أدواتِ مضيف
        if (!el.contains(b)) seen.add(b);
      }
    }
    return seen.size;
  };
  return {
    nearest: nearest ? desc(nearest) : null,
    nearestCtrls: ctrls(nearest),
    picked: picked ? desc(picked) : null,
    pickedCtrls: ctrls(picked),
    ctrlsAnywhere: cands.reduce((n, el) => n + (ctrls(el) > 0 ? 1 : 0), 0),
    lostFromPicked: lostCtrls(picked),
    lostFromNearest: lostCtrls(nearest),
    scorerArgmax: rows.length ? rows[0].name : null,
    scorerAgrees: !nearest && picked ? (rows.length ? rows[0].el === picked : picked === v) : null,
    rows: rows.slice(0, 4).map((r) => r.name + "=" + r.score + "(ctrl:" + r.ctrls + ")")
  };
};

// أي فرع في pickFullscreenContainer حسم؟ — للبند #59 كومِت ب: هل يُدخَل الاحتياطي؟
window.__branch = () => {
  const v = window.__v;
  const KPW = "#movie_player,.html5-video-player,.video-player,[data-a-target='video-player'],.jw-wrapper,.video-js,.plyr,.vjs-fluid";
  const known = v.closest(KPW);
  if (known && known.requestFullscreen) return "known-wrapper";
  // ⚠️ #140 — **ونسخةُ الفرع تتبع شرطَه الثالث**: بدونها يطبع «decisive(#58)» عن
  // بنيةٍ سقطت إلى السكور — **نسخةٌ تتخلّف تصف مساراً لم يُسلَك.**
  const near140 = window.nearestPlayerAncestor && window.nearestPlayerAncestor(v);
  const lost140 = near140 && window.hostControlsLostBy && window.hostControlsLostBy(v, near140);
  if (near140 && !lost140) return "decisive(#58)";
  if (near140 && lost140) return "score(#140: القاطعُ يُخرج أدواتِ المضيف)";
  const vr = v.getBoundingClientRect();
  const va = Math.max(1, vr.width * vr.height);
  const cands = []; let cur = v;
  for (let i = 0; i < 8 && cur; i++) {
    if (cur !== document.body && cur !== document.documentElement) cands.push(cur);
    cur = cur.parentElement;
  }
  const alive = cands.filter((el) => {
    const r = el.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return false;
    const cx = vr.left + vr.width / 2, cy = vr.top + vr.height / 2;
    if (!(r.left <= cx && r.right >= cx && r.top <= cy && r.bottom >= cy)) return false;
    return (r.width * r.height) / va <= 3.5;
  });
  return alive.length ? "score" : "FALLBACK";
};

window.__before = () => {
  const v = window.__v;
  const container = window.pickFullscreenContainer ? window.pickFullscreenContainer(v) : "MISSING";
  const btn = window.findNativeFullscreenButton ? window.findNativeFullscreenButton(v) : "MISSING";
  const r = v.getBoundingClientRect();
  return {
    hasFns: typeof window.toggleFullscreen === "function",
    container: typeof container === "string" ? container : desc(container),
    containerIsVideo: container === v,
    nativeBtn: typeof btn === "string" ? btn : desc(btn),
    videoRect: [Math.round(r.width), Math.round(r.height)],
    screen: [window.innerWidth, window.innerHeight]
  };
};

window.__fire = () => { window.__ret = window.toggleFullscreen(window.__v); };

window.__after = () => {
  const v = window.__v;
  const r = v.getBoundingClientRect();
  const fsEl = document.fullscreenElement;
  const sw = window.innerWidth, sh = window.innerHeight;
  return {
    ret: window.__ret,
    fsElement: desc(fsEl),
    fsIsVideo: fsEl === v,
    videoRect: [Math.round(r.width), Math.round(r.height)],
    screen: [sw, sh],
    areaPct: Math.round((r.width * r.height) / (sw * sh) * 100),
    fills: !!(r.width >= sw - 2 || r.height >= sh - 2),
    // #58 كومِت ب: هل وسمت البوابة، وهل حُقنت ورقة الأنماط؟
    stamped: document.querySelectorAll("[data-vz-fs]").length > 0 &&
             document.querySelectorAll("video[data-vz-fs-video]").length > 0,
    marks: document.querySelectorAll("[data-vz-fs],[data-vz-fs-video]").length,
    cssInjected: !!document.getElementById("vz_fs_fill_css")
  };
};

// ── ⭐⭐ #140 — **الحكم الجديد: أنجت أدواتُ المضيف داخل عنصر ملء الشاشة؟** ─────
// ⚠️ **وهو نصفُ البند الذي لا تراه بنيةٌ وحدها** (قرار 146): حكمُ هذا الرِكاز كان
// «fills» — **«أملأ الفيديو الشاشة؟»** — **وفي البنية الكاسرة الفيديو يملأ الشاشة
// فعلاً والشريطُ وحدَه لا يُرسم** ⇒ **فبنيةٌ بلا حكمٍ جديد كانت ستُضاف وتخضرّ.**
// ⛔ **ويُقاس بعد الدخول لا قبله**: المتصفّح لا يرسم إلا شجرةَ عنصر ملء الشاشة،
// **فالمقيس «contains» لا شفافيةٌ ولا مستطيل** — والشريطُ يحمل مستطيلاً محسوباً
// وهو غيرُ مرسوم (العمى الأوّل، «S7»).
// ⚠️ **وأزرارُنا تُقصى** (#141) — وإلا عدَّ الحارسُ طبقتَنا أدواتِ مضيف.
window.__survived = () => {
  const v = window.__v;
  const fsEl = document.fullscreenElement;
  const CTRL = "button, [role='button'], input[type='range']";
  const seen = new Set();
  let el = v.parentElement;
  for (let i = 0; i < 8 && el && el !== document.body && el !== document.documentElement; i++) {
    for (const b of el.querySelectorAll(CTRL)) {
      if (b.closest && b.closest(".vzWrap")) continue;
      seen.add(b);
    }
    el = el.parentElement;
  }
  const all = [...seen];
  const lost = fsEl ? all.filter((b) => !fsEl.contains(b)) : [];
  return { total: all.length, lost: lost.length, fsEl: desc(fsEl) };
};

// بعد الخروج: لا سمة تبقى على الـ DOM
window.__marksAfterExit = () => document.querySelectorAll("[data-vz-fs],[data-vz-fs-video]").length;

window.__exit = () => (document.fullscreenElement ? document.exitFullscreen() : Promise.resolve());
`;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<script>${STUB}</script>
<script src="/content.js"></script>
<script>${CASES}</script></body>`;

// ── ⭐⭐ شاهدُ الحمرة لـ#140 — **يُنزع الشرطُ وحدَه، ويُتحقَّق أن النزع وقع** ────
// ⛔ **ولا يُفتعَل عطبٌ مشابه** (قرار المالك): المنزوعُ هو **نصُّ السطر السابق
// بحروفه** — ما كان قبل كومِت #140 بالضبط. **ويُفضَّل على `git show HEAD:` لأنه
// يبقى صادقاً بعد أن يصير الإصلاحُ هو HEAD.**
// ⚠️ **وكلُّ استبدالٍ آليّ يُتحقَّق من وقوعه** (درسُ `String.replace` الصامتة):
// **لا مطابقةَ ⇒ لا شاهد، ويُرفض بصوتٍ عالٍ ولا يُتخطّى صامتاً.**
const ARGS = process.argv.slice(2);
const UNKNOWN = ARGS.filter((a) => a !== "--witness");
if (UNKNOWN.length) {
  console.log("⛔ وسمٌ مجهول: " + UNKNOWN.join(" ") + " — والمعروف: --witness");
  console.log("   (قرار 136: وسمٌ يُتجاهَل صامتاً يُنتج تشغيلةً لم تقع تُقرأ شاهداً)");
  process.exit(1);
}
const WITNESS = ARGS.includes("--witness");
const GATE_140 = " && !hostControlsLostBy(video, nearest)";
const CONTENT_RAW = fs.readFileSync(path.join(ROOT, "content.js"), "utf8");
let CONTENT_JS = CONTENT_RAW;
if (WITNESS) {
  const hits = CONTENT_RAW.split(GATE_140).length - 1;
  if (hits !== 1) {
    console.log(`⛔ شاهدُ #140 يشترط موضعاً واحداً للشرط، والموجود ${hits} — لا شاهد.`);
    process.exit(1);
  }
  CONTENT_JS = CONTENT_RAW.replace(GATE_140, "");
  console.log("\n⚠️ **وضعُ الشاهد**: شرطُ #140 منزوعٌ من النسخة المخدومة — والمنتظَر حمرةٌ في «ك».\n");
}

const srv = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  const send = (b, t) => { res.writeHead(200, { "content-type": t }); res.end(b); };
  if (u === "/") return send(PAGE, "text/html; charset=utf-8");
  if (u === "/content.js") return send(CONTENT_JS, "text/javascript");
  res.writeHead(404); res.end("x");
});
await new Promise((r) => srv.listen(PORT, "127.0.0.1", r));

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--autoplay-policy=no-user-gesture-required",
   "--user-data-dir=/tmp/vz-repro-58", `--remote-debugging-port=${CDP}`,
   `--window-size=${W},${H}`, "about:blank"],
  { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${CDP}/json/list`); break; } catch { await sleep(250); } }
const tab = await (await fetch(
  `http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(`http://127.0.0.1:${PORT}/`)}`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const cdp = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evalJs = async (expression, userGesture = false) => {
  const r = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture });
  if (r.result?.exceptionDetails) {
    return { __err: r.result.exceptionDetails.text + " " + (r.result.exceptionDetails.exception?.description || "") };
  }
  return r.result?.result?.value;
};

// النافذة الجديدة لا ترث --window-size، فتُضبط صراحةً وإلا قِيست الشاشة 800×600
const winId = (await cdp("Browser.getWindowForTarget", { targetId: tab.id })).result?.windowId;
if (winId) await cdp("Browser.setWindowBounds", { windowId: winId, bounds: { width: W, height: H } });

await cdp("Runtime.enable");
await sleep(2500);

const pad = (s, w) => String(s) + " ".repeat(Math.max(0, w - String(s).length));
const screen0 = await evalJs("[window.innerWidth, window.innerHeight]");
console.log(`\n=== إعادة إنتاج #58 · نافذة القياس ${screen0.join("×")} · headless=new ===\n`);

const rows = [];
const count = await evalJs("window.__cases.length");
if (typeof count !== "number") { console.log("تعذّر التحميل:", JSON.stringify(count)); chrome.kill(); srv.close(); process.exit(1); }

// ── الحتمية: نفس العنصر المختار على مقاسي إطار عرض (شرط قبول المالك في #58) ──
// السكور يحسم بفوارق ناعمة، فأي اعتماد عليه هشّ. أي بنية تنقلب هنا هي بنية
// يحكمها السكور لا الحكم القاطع — أي مجال البند #59.
// ⚠️ ولا تنسَ قرار 22: لا تقرأ مستطيلاً قبل أن يستقرّ التخطيط. انتظار 450ms هنا
// كان يُنتج انقلاباً **مصطنعاً** ارتقى إلى «حقيقة منشورة» حتى سُحب.
const deter = [];
for (const [w, h] of [[1440, 900], [900, 700]]) {
  if (winId) await cdp("Browser.setWindowBounds", { windowId: winId, bounds: { width: w, height: h } });
  await sleep(900);
  const picks = [];
  for (let i = 0; i < count; i++) {
    await evalJs(`window.__setup(${i})`);
    // ⚠️ 450ms لم تكن تكفي: body بعد textContent="" يبقى بارتفاع 0 لحظةً،
    // فيُرفض بحارس المستطيل الصفري ويفوز VIDEO — انقلاب **مصطنع** لا حقيقي.
    await sleep(1100);
    const b = await evalJs("window.__before()");
    picks.push(b.container);
  }
  deter.push({ size: `${w}×${h}`, picks });
}
console.log("=== الحتمية عبر مقاسي إطار عرض ===");
{
  const names = [];
  for (let i = 0; i < count; i++) names.push((await evalJs(`window.__cases[${i}].name`)).split(" — ")[0]);
  let flips = 0;
  for (let i = 0; i < count; i++) {
    const a = deter[0].picks[i], b = deter[1].picks[i];
    const ok = a === b;
    if (!ok) flips++;
    console.log(`  ${ok ? "✅" : "❌"} ${names[i].padEnd(4)} ${deter[0].size}: ${String(a).padEnd(34)} ${deter[1].size}: ${b}`);
  }
  console.log(`  ⇒ ${flips === 0 ? "كل البنيات حتمية" : `${flips} بنية غير حتمية — يحكمها السكور (البند #59)`}`);
}
console.log("");
if (winId) await cdp("Browser.setWindowBounds", { windowId: winId, bounds: { width: W, height: H } });
await sleep(900);

for (let i = 0; i < count; i++) {
  const setup = await evalJs(`window.__setup(${i})`);
  await sleep(700);
  const before = await evalJs("window.__before()");
  const branch = await evalJs("window.__branch()");
  const scope = await evalJs("window.__scope()");
  await evalJs("window.__fire()", true);
  await sleep(1100);
  const after = await evalJs("window.__after()");
  const survived = await evalJs("window.__survived()");
  await evalJs("window.__exit()");
  await sleep(600);
  const leftover = await evalJs("window.__marksAfterExit()");

  console.log(setup.name);
  console.log(`  pickFullscreenContainer → ${before.container}${before.containerIsVideo ? "   ← الفيديو نفسه" : ""}`);
  console.log(`  زر أصلي (مسار #17)      → ${before.nativeBtn}`);
  console.log(`  fullscreenElement       → ${after.fsElement}${after.fsIsVideo ? "   ← الفيديو نفسه" : ""}`);
  console.log(`  مقاس الفيديو قبل ⇒ بعد  → ${before.videoRect.join("×")} ⇒ ${after.videoRect.join("×")}   (${after.areaPct}% من الشاشة)`);
  console.log(`  الفرع الحاسم            → ${branch}${branch === "FALLBACK" ? "   ⚠️ المسار الاحتياطي" : ""}`);
  console.log(`  البوابة (#58ب)          → ${after.stamped ? "وسمت" : "**رفضت**"}   ·   CSS محقونة: ${after.cssInjected ? "نعم" : "لا"}   ·   سمات بعد الخروج: ${leftover}`);
  console.log(`  ${after.fills ? "✅ الفيديو يملأ الشاشة" : "❌ الفيديو بقي بمقاسه — شاشة سوداء حوله"}`);
  console.log("");
  const ctrlOk = !survived || survived.lost === 0;
  console.log(`  ${ctrlOk ? "✅" : "❌"} #140 · أدواتُ المضيف داخل عنصر ملء الشاشة` + ` → موجودة=${survived && survived.total} · **تُفقد=${survived && survived.lost}**`);
  console.log(`  #140 · نجاةُ أدوات المضيف → مختار=${scope.picked} (ضوابط:${scope.pickedCtrls})` +
    ` · قاطع=${scope.nearest} (ضوابط:${scope.nearestCtrls})` +
    ` · أسلافٌ بضوابط=${scope.ctrlsAnywhere} · تُفقد بالمختار=${scope.lostFromPicked} · بالقاطع=${scope.lostFromNearest}` +
    ` · السكور=${scope.scorerArgmax} · يطابق=${scope.scorerAgrees}`);
  rows.push({ name: setup.name, ok: after.fills, fs: after.fsElement, pct: after.areaPct,
              stamped: after.stamped, leftover, branch, scope, survived, ctrlOk });
}

console.log("=== الخلاصة ===");
for (const r of rows) {
  console.log(`  ${r.ok ? "✅" : "❌"} ${pad(r.name.slice(0, 58), 60)} ${pad(r.stamped ? "وُسِمت" : "رُفضت", 8)} fsEl=${pad(r.fs, 20)} ${r.pct}%`);
}
const stamped = rows.filter((r) => r.stamped);
const leftovers = rows.filter((r) => r.leftover > 0);
console.log("");
console.log(`=== عدّ البوابة: وُسِمت ${stamped.length} · رُفضت ${rows.length - stamped.length} ===`);
console.log(`    الموسومة: ${stamped.map((r) => r.name.split(" — ")[0]).join(" · ") || "لا شيء"}`);
console.log(`    سمات باقية بعد الخروج: ${leftovers.length === 0 ? "صفر في كل البنيات ✅" : leftovers.map((r) => r.name.split(" — ")[0] + "=" + r.leftover).join(" · ") + " ❌"}`);
const fb = rows.filter((r) => r.branch === "FALLBACK");
console.log("");
console.log("=== الفرع الحاسم لكل بنية (البند #59) ===");
for (const r of rows) console.log(`    ${pad(r.name.split(" — ")[0], 5)}${r.branch}`);
console.log(`    ⇒ **دخول المسار الاحتياطي: ${fb.length}** ${fb.length === 0 ? "✅" : "❌ " + fb.map((r) => r.name.split(" — ")[0]).join(" · ")}`);
console.log("");
console.log("⚠️ اقرأ tools/KNOWN-DEFECTS.md قبل تفسير أي ❌ أعلاه.");
console.log("");
// ── ⭐ الحكم الذي يستطيع أن يُحمّر — وهو ما ينقص أيَّ رِكازٍ بلا حكمٍ لسؤاله ────
const lostRows = rows.filter((r) => r.survived && r.survived.lost > 0);
console.log("");
console.log("=== #140 · أدواتُ المضيف داخل عنصر ملء الشاشة ===");
for (const r of rows) {
  console.log(`    ${r.ctrlOk ? "✅" : "❌"} ${pad(r.name.split(" — ")[0], 5)}` +
    `موجودة=${pad(r.survived ? r.survived.total : "?", 4)}تُفقد=${r.survived ? r.survived.lost : "?"}`);
}
console.log(`    ⇒ **بنياتٌ تُفقد فيها أدواتُ المضيف: ${lostRows.length}** ` +
  (lostRows.length === 0 ? "✅" : "❌ " + lostRows.map((r) => r.name.split(" — ")[0]).join(" · ")));
console.log("");
chrome.kill(); srv.close();
if (WITNESS) {
  const ok = lostRows.some((r) => r.name.startsWith("ك"));
  console.log(ok
    ? "✅ **الشاهد أحمر كما يجب**: بنزع الشرط تُفقد أدواتُ المضيف في «ك» ⇒ الحكمُ يرى."
    : "⛔ **الشاهد لم يُحمّر بنزع الشرط** — فالحكمُ لا يقيس ما يدّعيه، ولا يُصدَّق أخضرُه.");
  process.exit(ok ? 0 : 1);
}
// ⛔ **والخرْجُ غيرُ صفريّ على فقدٍ واقع** — حكمٌ لا يستطيع أن يُوقف كومِتاً ليس حارساً
process.exit(lostRows.length === 0 ? 0 : 1);
