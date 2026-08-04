// قياس #97 — **عدُّ اللاحتميّة** في قسم #70: كم عيّنة، وكم انقلبت، ولماذا.
//
// ⛔ **خارج البوّابة — وسببُ تأجيله هو (لا سببُ مجموعته):**
// موضوعُه اللاحتميّة نفسها: يعيد التسلسل خمس مرّات ليعدّ كم شرطاً انقلب —
//   فوضعُه في بوّابةٍ تشترط الحتميّة نقضٌ لغرضه.
//
//   node tools/bench-97-flake.mjs            # خمس عيّنات
//   node tools/bench-97-flake.mjs --n 8
//
// ⚠️ **بالعدّ لا بالانطباع (أمر المالك): بلا رقمٍ يُقاس عليه الإصلاح لا يُعرف
// أنه أصلح.** فهذا الملفّ يُعيد تسلسل قسم #70 **مرّاتٍ في تشغيلةٍ واحدة**،
// ويطبع لكلّ شرطٍ: **كم مرّةً صدق وكم كذب** — ثمّ يُسمّي المُميِّز إن وُجد.
//
// ── ما يُقاس في كل عيّنة ────────────────────────────────────────────────────
//   · **صنفُنا** `vz-idle-hide-progress` — **وهو سؤالنا** (قرار 72)
//   · وشفافية المضيف — **خبرٌ تابع لا حكم** (قرار 48: أثرُنا وأثرُه متطابقان)
//   · **وموضع المؤشّر من الشريط**: داخلَه أم خارجَه — فـ#95 يمنع الإخفاء تحت
//     المؤشّر **بحقّ**، فإن وقع التحويم عليه صار «لا إخفاء» **سلوكاً صحيحاً
//     يُقرأ فشلاً**.
import { launch, openPage, configure, contentWorld, evalIn, killChrome, waitPortFree }
  from "./ext-harness.mjs";

const PORT = 9787;
const N = Number((process.argv.find((a, i) => process.argv[i - 1] === "--n")) || 5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WATCH = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const IDLE_MS = 1000;

const SETTINGS = (on) => ({
  settings: {
    enabled: true, idle: { ms: IDLE_MS },
    overlay: { autoHideMs: 900, volumeAutoHideMs: 900, enabled: true, hintEnabled: true,
               speedBadge: false, hideProgressBar: on, speedButton: false },
    zones: { enabled: true, fullscreenOnly: false }
  },
  globalSiteRules: { enabled: true, mappings: [] }
});

const BAR = `(() => {
  const el = document.querySelector(".ytp-chrome-bottom");
  if (!el) return { exists: false };
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  return { exists: true, opacity: Number(cs.opacity),
           rect: { x: Math.round(r.left), y: Math.round(r.top),
                   w: Math.round(r.width), h: Math.round(r.height) },
           ourClass: document.documentElement.classList.contains("vz-idle-hide-progress"),
           hostHidden: Number(cs.opacity) === 0 };
})()`;

async function move(page, x, y) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
}
async function wiggle(page, x, y, n = 3) {
  for (let i = 0; i < n; i++) { await move(page, x + (i % 2), y + ((i + 1) % 2)); await sleep(120); }
}

const out = { samples: [] };
let h = null, page = null;
try {
  h = await launch(PORT, { extra: ["--window-size=1440,900"] });
  out.chrome = h.chrome;
  const cfg = await configure(PORT, h.extensionId, SETTINGS(true));
  if (!cfg.ok) throw new Error("تعذّر ضبط التخزين");

  for (let i = 0; i < N; i++) {
    page = await openPage(PORT, WATCH);
    await sleep(6500);
    const world = (await contentWorld(page))?.id;
    let vr = null;
    for (let k = 0; k < 20 && !vr; k++) {
      vr = await evalIn(page, `(() => { const v = document.querySelector("video");
        if (!v) return null; const r = v.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return null;
        return { x: Math.round(r.left), y: Math.round(r.top),
                 w: Math.round(r.width), h: Math.round(r.height) }; })()`);
      if (!vr) await sleep(500);
    }
    if (!vr) {
      const diag = await evalIn(page, `({ t: document.title.slice(0,40),
        v: document.querySelectorAll("video").length })`);
      out.samples.push({ i, blocked: true, diag });
      try { page.ws.close(); } catch {}
      continue;
    }
    // **الموضع نفسه الذي تستعمله المنصّة**: 80% من ارتفاع الفيديو
    const px = Math.round(vr.x + vr.w / 2), py = Math.round(vr.y + vr.h * 0.8);
    await wiggle(page, px, py, 3);
    await sleep(400);
    const active = await evalIn(page, BAR);
    await sleep(IDLE_MS * 3);                       // سكونٌ بلا أي إدخال
    const idle = await evalIn(page, BAR);
    const insideBar = !!(idle.exists && px >= idle.rect.x && px <= idle.rect.x + idle.rect.w &&
                         py >= idle.rect.y && py <= idle.rect.y + idle.rect.h);
    out.samples.push({ i, vr, pointer: { x: px, y: py }, active, idle, insideBar, world: !!world });
    try { page.ws.close(); } catch {}
  }
} catch (e) {
  out.why = String(e?.message || e).slice(0, 150);
} finally {
  try { page?.ws?.close(); } catch {}
  killChrome(h);
  await waitPortFree(PORT);
}

const yn = (b) => (b ? "نعم" : "لا");
console.log(`\n=== عدّ لاحتميّة #97 — ${N} عيّنات ===`);
console.log(`   كروم: ${out.chrome || "—"}`);
if (out.why) console.log(`   ⚠️ ${out.why}`);
const blocked = out.samples.filter((s) => s.blocked);
if (blocked.length) {
  console.log(`   ⛔ **${blocked.length} عيّنة محجوبة** (لا فيديو): ${JSON.stringify(blocked[0].diag)}`);
}
const ok = out.samples.filter((s) => !s.blocked);
for (const s of ok) {
  console.log(`   [${s.i}] مع النشاط: صنفُنا=${yn(s.active.ourClass)} شفافية=${s.active.opacity}` +
    ` · بالسكون: صنفُنا=${yn(s.idle.ourClass)} شفافية=${s.idle.opacity}` +
    ` · شريط ${JSON.stringify(s.idle.rect)} · المؤشّر ${s.pointer.x},${s.pointer.y}` +
    ` **داخل الشريط=${yn(s.insideBar)}**`);
}

if (ok.length) {
  const cnt = (f) => ok.filter(f).length;
  console.log(`\n── العدّ (${ok.length} عيّنة صالحة)`);
  const rows = [
    ["الشرط القائم «الشريط ظاهرٌ مع النشاط» (شفافية المضيف ≠ 0)", (s) => !s.active.hostHidden],
    ["⭐ والسؤال الصحيح «صنفُنا غائبٌ مع النشاط»", (s) => s.active.ourClass === false],
    ["الشرط القائم «يختفي بالسكون» (صنفُنا **و** شفافية 0)", (s) => s.idle.ourClass && s.idle.hostHidden],
    ["⭐ والسؤال الصحيح «صنفُنا حاضرٌ بالسكون»", (s) => s.idle.ourClass === true],
    ["والمؤشّر داخل الشريط (فـ#95 يمنع الإخفاء بحقّ)", (s) => s.insideBar]
  ];
  for (const [label, f] of rows) {
    const t = cnt(f);
    console.log(`   ${t}/${ok.length}  ${t === ok.length || t === 0 ? "حتميّ  " : "**انقلب**"}  ${label}`);
  }
  const flipped = rows.filter(([, f]) => { const t = cnt(f); return t !== 0 && t !== ok.length; });
  console.log(`\n   ⇒ **${flipped.length} شرطاً من ${rows.length} انقلب بين العيّنات**` +
    (flipped.length ? " — **فاللاحتميّة مقيسةٌ بالعدّ لا بالانطباع**" : " — **حتميّ في هذي التشغيلة**"));
  const insideCnt = cnt((s) => s.insideBar);
  if (insideCnt && insideCnt !== ok.length) {
    console.log(`   ⚠️ **والمُميِّز مسنود: المؤشّر داخل الشريط في ${insideCnt} من ${ok.length}** —` +
      " **و#95 يمنع الإخفاء تحت المؤشّر بحقّ، فيُقرأ سلوكٌ صحيح فشلاً**.");
  }
}
console.log("");
process.exit(ok.length ? 0 : 1);
