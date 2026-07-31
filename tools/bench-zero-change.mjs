// ⛔ **خرج هذه الأداة باطل بالكامل — مُبطَل بقرار 21، 2026-07-31.**
//
// **السبب مقيس:** `--load-extension` **لا يُحمّل شيئاً** في
// **Chrome/150.0.7871.187** — لا في `--headless=new`، ولا معه
// `--disable-features=DisableLoadExtensionCommandLineSwitch`، **ولا بلا headless
// أصلاً**. صفر أهداف للإضافة وصفر عوالم معزولة في الثلاث، والخرج **مطابق تماماً**
// لتشغيلة بلا إضافة. ⇒ **كل «✅ مطابق» طبعته هذه الأداة لا يشهد على تطابق بل على
// عمى**، لأن البناءين المقارَنين كانا **بلا إضافة كلاهما**.
//
// **ولا يُشطب سطر من نصّها ولا تُحذف:** تبقى كما هي **موسومةً بأنها باطلة** حتى
// تُحوَّل إلى `tools/ext-harness.mjs` (التي تحمّل الإضافة بـ`Extensions.loadUnpacked`
// **وتثبت بشاهدين أنها تراها عاملةً**) ثم يُعاد تشغيل شاهدها الموجب.
// **حتى ذلك الحين: لا تُشغَّل، ولا يُقرأ خرجها، ولا يُبنى عليها بند.**
//
// ✅ **وأُحصي أثرها في السجلّ (2026-07-31): لم يُنشر منها رقم واحد، ولم يُغلق بها
// بند واحد** — حُجرت من أول يوم في `tools/KNOWN-DEFECTS.md`. التفصيل:
// `AUDIT.md` القسم 25.
//
// ── النصّ الأصلي، محفوظاً كما كُتب ───────────────────────────────────────────
// شرط قبول كومِت إطار المحوّلات (#60): **صفر تغيّر سلوكي** على المواقع الأربعة.
//
// ⚠️ يحتاج كروم مثبَّتاً وشبكة. **لا يُشحن.**  `node tools/bench-zero-change.mjs`
//
// ~~يقارن بناءين **بالإضافة محمَّلة فعلاً** (`--load-extension`)~~ — **باطل**:
//   «قبل» = `content.js` من `git show HEAD:content.js`
//   «بعد»  = شجرة العمل الحالية
// وعلى كل موقع يُرسل دولاب فأرة **موثوق** فوق المربع B1 (ربط الصوت الافتراضي)
// ويُقرأ `video.volume` قبل وبعد. **الحكم: الدلتا نفسها في البناءين.**
//
// ⚠️ **وشاهدا قرار 26 مبنيّان في الأداة، ولا رقم يُنشر بدونهما:**
//   موجب — دولاب فوق **B1** *يجب* أن يغيّر المستوى في بناء «قبل».
//   سالب — دولاب فوق **B2** (بلا ربط افتراضي) *يجب ألا* يغيّره.
// إن سقط أيٌّ منهما فالرِكاز **لا يرى**، فيُطبع «لم يُقس» ولا تُطبع أرقام.
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const ROOT = process.cwd();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- بناءا الإضافة ---------------------------------------------------------
const SHIP = ["manifest.json", "content.js", "popup.html", "popup.js", "options.html",
              "options.js", "options.css", "storage.js", "yt_quality_main.js", "background.js"];

function buildExt(tag, contentJs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `vz-ext-${tag}-`));
  for (const f of SHIP) {
    if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  fs.mkdirSync(path.join(dir, "icons"), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "icons"))) {
    fs.copyFileSync(path.join(ROOT, "icons", f), path.join(dir, "icons", f));
  }
  fs.writeFileSync(path.join(dir, "content.js"), contentJs);
  return dir;
}

const BEFORE = buildExt("before", execFileSync("git", ["show", "HEAD:content.js"], { cwd: ROOT, maxBuffer: 1 << 24 }).toString());
const AFTER = buildExt("after", fs.readFileSync(path.join(ROOT, "content.js"), "utf8"));

// ---- عميل CDP --------------------------------------------------------------
async function launch(dir, port) {
  const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required", `--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(), "vz-prof-"))}`,
    `--disable-extensions-except=${dir}`, `--load-extension=${dir}`,
    `--user-agent=${UA}`, `--remote-debugging-port=${port}`, "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 80; i++) {
    try { await fetch(`http://127.0.0.1:${port}/json/list`); return proc; } catch { await sleep(250); }
  }
  throw new Error("لم يستجب كروم");
}

async function attach(port, url) {
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let n = 0; const pend = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const id = ++n; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  return { ws, send };
}

const RECT = `(() => {
  const vids = [...document.querySelectorAll("video")];
  let best = null, area = -1;
  for (const v of vids) { const r = v.getBoundingClientRect(); const a = r.width * r.height;
    if (a > area) { area = a; best = v; } }
  if (!best) return null;
  const r = best.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height,
           volume: Math.round(best.volume * 10000) / 10000, muted: best.muted,
           readyState: best.readyState };
})()`;

const READ = `(() => {
  const vids = [...document.querySelectorAll("video")];
  let best = null, area = -1;
  for (const v of vids) { const r = v.getBoundingClientRect(); const a = r.width * r.height;
    if (a > area) { area = a; best = v; } }
  return best ? { volume: Math.round(best.volume * 10000) / 10000, muted: best.muted } : null;
})()`;

async function measure(dir, url, port) {
  let proc, ws;
  try {
    proc = await launch(dir, port);
    const c = await attach(port, url);
    ws = c.ws;
    const { send } = c;
    await send("Runtime.enable"); await send("Page.enable"); await send("Page.bringToFront");
    const ev = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      return r.result?.result?.value;
    };
    let rect = null;
    for (let i = 0; i < 60; i++) {
      rect = await ev(RECT);
      if (rect && rect.w > 0 && rect.readyState >= 1) break;
      await sleep(1000);
    }
    if (!rect || !(rect.w > 0)) return { note: "لا مشغّل — لم يُقس" };

    // نقطة B1 = العمود الأيسر × الصفّ الأوسط، و B2 = المركز (بلا ربط افتراضي)
    const pt = (col) => ({ x: Math.round(rect.x + rect.w * col), y: Math.round(rect.y + rect.h * 0.5) });
    const wheel = async (p, dy) => {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y });
      await sleep(120);
      await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: p.x, y: p.y, deltaX: 0, deltaY: dy });
      await sleep(450);
      return ev(READ);
    };

    const b1 = pt(1 / 6), b2 = pt(0.5);
    const start = await ev(READ);
    const upB1 = await wheel(b1, -120);       // دولاب لأعلى فوق B1 ⇒ رفع صوت
    const downB1 = await wheel(b1, 120);      // ولأسفل ⇒ خفض
    const mid = await ev(READ);
    const upB2 = await wheel(b2, -120);       // شاهد سالب: B2 بلا ربط افتراضي
    return { rect: { w: Math.round(rect.w), h: Math.round(rect.h) },
             start, upB1, downB1, beforeB2: mid, upB2 };
  } catch (e) {
    return { note: "فشل: " + String(e?.message || e).slice(0, 70) };
  } finally {
    try { ws?.close(); } catch {} try { proc?.kill(); } catch {}
  }
}

// ---- التشغيل ---------------------------------------------------------------
async function youtubeUrl(port) {
  let proc, ws;
  try {
    proc = await launch(BEFORE, port);
    const c = await attach(port, "https://www.youtube.com/results?search_query=music");
    ws = c.ws;
    await c.send("Runtime.enable"); await c.send("Page.bringToFront");
    for (let i = 0; i < 25; i++) {
      const r = await c.send("Runtime.evaluate", {
        expression: `(document.querySelector('a#video-title, a[href^="/watch?v="]')||{}).href||null`, returnByValue: true });
      const href = r.result?.result?.value;
      if (href) return href.split("&")[0];
      await sleep(1000);
    }
    return null;
  } catch { return null; }
  finally { try { ws?.close(); } catch {} try { proc?.kill(); } catch {} }
}

let port = 9501;
// رابط واحد بالمعامل: لتشخيص الرِكاز نفسه على صفحة محلية معلومة السلوك
const ARG = process.argv[2];
const yt = ARG ? null : await youtubeUrl(port++);
const SITES = ARG ? [{ name: new URL(ARG).host, url: ARG }] : [
  yt ? { name: "youtube.com", url: yt } : null,
  { name: "twitch.tv", url: "https://www.twitch.tv/" },
  { name: "vimeo.com", url: "https://player.vimeo.com/video/76979871?autoplay=1&muted=1" },
  { name: "d.tube", url: "https://d.tube/watch/5MxdC3ajEpBwgcDCsrHRd5" }
].filter(Boolean);

const d = (a, b) => (a && b) ? Math.round((b.volume - a.volume) * 10000) / 10000 : null;
const rows = [];
for (const s of SITES) {
  process.stdout.write(`\n⏳ ${s.name} قبل … `);
  const before = await measure(BEFORE, s.url, port++);
  process.stdout.write(before.note ? before.note : "تمّ");
  process.stdout.write(` · بعد … `);
  const after = await measure(AFTER, s.url, port++);
  console.log(after.note ? after.note : "تمّ");
  rows.push({ site: s.name, url: s.url, before, after });
}

console.log("\n=== صفر تغيّر سلوكي — الإضافة محمَّلة، دولاب موثوق فوق B1 ===\n");
let controlsOk = 0, controlsRun = 0, mismatches = 0;
for (const r of rows) {
  console.log(`── ${r.site}`);
  if (r.before.note || r.after.note) {
    console.log(`   ⚠️ ${r.before.note || ""} ${r.after.note || ""}\n`);
    continue;
  }
  const bUp = d(r.before.start, r.before.upB1), aUp = d(r.after.start, r.after.upB1);
  const bDn = d(r.before.upB1, r.before.downB1), aDn = d(r.after.upB1, r.after.downB1);
  const bNeg = d(r.before.beforeB2, r.before.upB2), aNeg = d(r.after.beforeB2, r.after.upB2);
  console.log(`   المستوى الابتدائي : قبل ${r.before.start?.volume} · بعد ${r.after.start?.volume}`);
  console.log(`   دولاب ↑ فوق B1    : قبل ${bUp} · بعد ${aUp}   ${bUp === aUp ? "✅ مطابق" : "❌ اختلف"}`);
  console.log(`   دولاب ↓ فوق B1    : قبل ${bDn} · بعد ${aDn}   ${bDn === aDn ? "✅ مطابق" : "❌ اختلف"}`);
  console.log(`   شاهد موجب (B1 يرى): ${bUp !== 0 && bUp !== null ? "✅ رأى" : "❌ **لم يرَ** — لا يُنشر رقم"}`);
  console.log(`   شاهد سالب (B2 صامت): قبل ${bNeg} · بعد ${aNeg}   ${bNeg === 0 && aNeg === 0 ? "✅ صامت" : "⚠️ تحرّك"}`);
  console.log("");
  controlsRun++;
  if (bUp !== 0 && bUp !== null && bNeg === 0) controlsOk++;
  if (bUp !== aUp || bDn !== aDn) mismatches++;
}
console.log(`الحكم: ${controlsOk}/${controlsRun} موقعاً استوفى شاهدَي قرار 26 · اختلافات سلوكية: ${mismatches}`);
console.log(controlsOk === 0
  ? "⚠️ **لا شاهد موجب في أي موقع ⇒ الرِكاز لم يُثبت أنه يرى، فالنتيجة «لم تُقس» لا «مطابقة»**\n"
  : (mismatches === 0 ? "✅ صفر تغيّر سلوكي على ما استوفى الشاهدين\n" : "❌ اختلاف سلوكي — راجع أعلاه\n"));
fs.rmSync(BEFORE, { recursive: true, force: true });
fs.rmSync(AFTER, { recursive: true, force: true });
process.exit(0);
