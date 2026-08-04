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

// أي فرع في pickFullscreenContainer حسم؟ — للبند #59 كومِت ب: هل يُدخَل الاحتياطي؟
window.__branch = () => {
  const v = window.__v;
  const KPW = "#movie_player,.html5-video-player,.video-player,[data-a-target='video-player'],.jw-wrapper,.video-js,.plyr,.vjs-fluid";
  const known = v.closest(KPW);
  if (known && known.requestFullscreen) return "known-wrapper";
  if (window.nearestPlayerAncestor && window.nearestPlayerAncestor(v)) return "decisive(#58)";
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

// بعد الخروج: لا سمة تبقى على الـ DOM
window.__marksAfterExit = () => document.querySelectorAll("[data-vz-fs],[data-vz-fs-video]").length;

window.__exit = () => (document.fullscreenElement ? document.exitFullscreen() : Promise.resolve());
`;

const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<script>${STUB}</script>
<script src="/content.js"></script>
<script>${CASES}</script></body>`;

const srv = http.createServer((req, res) => {
  const u = req.url.split("?")[0];
  const send = (b, t) => { res.writeHead(200, { "content-type": t }); res.end(b); };
  if (u === "/") return send(PAGE, "text/html; charset=utf-8");
  if (u === "/content.js") return send(fs.readFileSync(path.join(ROOT, "content.js")), "text/javascript");
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
  await evalJs("window.__fire()", true);
  await sleep(1100);
  const after = await evalJs("window.__after()");
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
  rows.push({ name: setup.name, ok: after.fills, fs: after.fsElement, pct: after.areaPct,
              stamped: after.stamped, leftover, branch });
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
chrome.kill(); srv.close(); process.exit(0);
