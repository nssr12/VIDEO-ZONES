// شرط قبول أي تغيير يمسّ مسار الصوت (#60 وما بعده): **صفر تغيّر سلوكي**.
//
// يقارن بناءين للإضافة على نفس الصفحة:
//   «قبل» = `content.js` من `git show HEAD:content.js`
//   «بعد»  = شجرة العمل الحالية
// ويُرسل عجلة فوق المربّع **B1** (ربط الصوت الافتراضي) ويقرأ `video.volume`
// قبل وبعد. **الحكم: الدلتا نفسها في البناءين.**
//
// ⚠️ يحتاج كروم مثبَّتاً. **لا يُشحن.**
//   node tools/bench-zero-change.mjs            # الشاهدان + المواقع الأربعة (شبكة)
//   node tools/bench-zero-change.mjs --local    # الشاهدان + الصفحة المحلية فقط، بلا شبكة
//   node tools/bench-zero-change.mjs <url>      # موقع واحد
//
// ── تاريخه: كان أعمى، وعطّل ثلاثة بنود ──────────────────────────────────────
// حُجر من 2026-07-30 إلى 2026-08-01 لأن **`--load-extension` لم يكن يُحمّل شيئاً**
// على Chrome/150 — فكان يقارن بناءين **بلا إضافة كلاهما** ويطبع «✅ مطابق» عن
// عمى. لم يُنشر منه رقم واحد ولم يُغلق به بند (`AUDIT.md` القسم 25)، لكنه **عطّل
// عملنا ثلاث مرات**: #60 · تشخيص #38ج · و#38ج ثانيةً حين شُحن إصلاح بلا تحقّق.
//
// **حُوِّل إلى `tools/ext-harness.mjs`** (2026-08-01) التي تُحمّل الإضافة بـ
// `Extensions.loadUnpacked`. وشرط قبوله شاهداه، **ويُشغَّلان في كل تشغيلة قبل أي
// رقم**: يرى الإضافة **عاملةً** (overlay + مستوى يتحرّك)، ويميّز صفحةً **بلا
// إضافة** (لا overlay ولا حركة). سقوط أيٍّ منهما ⇒ **«لم يُقس» ولا تُطبع أرقام.**
//
// ⚠️ **ودرسان مبنيّان فيه لا يُنقضان:**
//  · **الموضع:** المركز هو المربّع 5 و**لا ربط افتراضي له**، فالعجلة عليه لا
//    تفعل شيئاً **بحقّ** بعد #38أ+ب. القياس على B1 (المربّع 4) لا على المركز.
//  · **المدى:** عجلة لأعلى والمستوى على 1.0 لا مكان لها تصعد إليه، فتطبع سكوناً
//    يُقرأ عطباً. الرِكاز يهبط بالمستوى إلى 0.5 أولاً (قرار 26، الشاهد الثالث).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ROOT, launch, configure, openPage, contentWorld, evalIn,
  serveTestPage, wheelProbe, ZONE_B1, ZONE_B2
} from "./ext-harness.mjs";

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

const BEFORE = buildExt("before",
  execFileSync("git", ["show", "HEAD:content.js"], { cwd: ROOT, maxBuffer: 1 << 24 }).toString());
const AFTER = buildExt("after", fs.readFileSync(path.join(ROOT, "content.js"), "utf8"));

// ---- قياسة واحدة: بناء × صفحة ----------------------------------------------
// `extPath: null` يعني **بلا إضافة** — وهو الشاهد السالب، لا حالة خطأ.
async function measure({ extPath, url, port, label }) {
  let h = null, page = null;
  try {
    h = await launch(port, { withExtension: !!extPath, extPath: extPath || undefined });
    if (h.extensionId) {
      // ملفّ متصفّح جديد ⇒ إضافة مطفأة. قياسٌ عليها يقيس الإطفاء لا الميزة.
      const cfg = await configure(port, h.extensionId, { globalSiteRules: { enabled: true, mappings: [] } });
      if (!cfg.ok) return { note: "تعذّر ضبط التخزين: " + (cfg.why || cfg.error || "") };
    }
    page = await openPage(port, url);
    await sleep(2500);
    const world = extPath ? await contentWorld(page) : null;

    const upB1 = await evalIn(page, wheelProbe({ ...ZONE_B1, deltaY: -120 }));
    if (!upB1?.ok) return { note: upB1?.why || "لم يُقرأ المِجَسّ" };
    const downB1 = await evalIn(page, wheelProbe({ ...ZONE_B1, deltaY: 120, setVolume: null, mute: false }));
    const upB2 = await evalIn(page, wheelProbe({ ...ZONE_B2, deltaY: -120, setVolume: 0.5, mute: false }));

    return { label, world: !!world, upB1, downB1, upB2 };
  } catch (e) {
    return { note: "فشل: " + String(e?.message || e).slice(0, 80) };
  } finally {
    try { page?.ws?.close(); } catch {}
    try { h?.browser?.ws?.close(); } catch {}
    try { h?.proc?.kill(); } catch {}
  }
}

const delta = (p) => (p && p.ok) ? Math.round((p.after - p.before) * 10000) / 10000 : null;

// ---- الشاهدان: يُشغَّلان أولاً، ولا رقم يُطبع قبل نجاحهما --------------------
let port = 9601, httpPort = 8901;
const local = await serveTestPage(httpPort++);

console.log("\n=== شاهدا القبول (قرار 26) — على صفحة محلية معلومة السلوك ===\n");
const pos = await measure({ extPath: BEFORE, url: local.url, port: port++, label: "موجب" });
const neg = await measure({ extPath: null, url: local.url, port: port++, label: "سالب" });

const posMoved = delta(pos.upB1);
const posOk = !pos.note && pos.world && pos.upB1?.count > 0 && posMoved !== 0 && posMoved !== null;
const negOk = !neg.note && !neg.world && !(neg.upB1?.count > 0) && delta(neg.upB1) === 0;

console.log(`  موجب — الإضافة عاملة : overlay ${pos.upB1?.count ?? "—"} عنصر · ` +
  `المستوى ${pos.upB1?.before} ⇒ ${pos.upB1?.after} · مكتوم ${pos.upB1?.mutedBefore} ⇒ ${pos.upB1?.mutedAfter}` +
  `   ${posOk ? "✅ يرى" : "❌ **لا يرى**"}${pos.note ? " · " + pos.note : ""}`);
console.log(`  سالب — صفحة بلا إضافة : overlay ${neg.upB1?.count ?? "—"} عنصر · ` +
  `المستوى ${neg.upB1?.before} ⇒ ${neg.upB1?.after}` +
  `   ${negOk ? "✅ يُميّز" : "❌ **لا يُميّز**"}${neg.note ? " · " + neg.note : ""}`);

if (!posOk || !negOk) {
  console.log("\n⚠️ **الشاهدان لم يستوفيا ⇒ النتيجة «لم تُقس» لا «مطابقة». لا يُبنى على هذه التشغيلة بند.**\n");
  local.srv.close();
  fs.rmSync(BEFORE, { recursive: true, force: true });
  fs.rmSync(AFTER, { recursive: true, force: true });
  process.exit(1);
}

// ---- المقارنة ---------------------------------------------------------------
const ARG = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
const LOCAL_ONLY = process.argv.includes("--local");
const SITES = ARG ? [{ name: new URL(ARG).host, url: ARG }]
  : LOCAL_ONLY ? [{ name: "الصفحة المحلية", url: local.url }]
  : [
      { name: "youtube.com", url: "https://www.youtube.com/watch?v=V9PVRfjEBTI" },
      { name: "twitch.tv", url: "https://www.twitch.tv/" },
      { name: "vimeo.com", url: "https://player.vimeo.com/video/76979871?autoplay=1&muted=1" },
      { name: "d.tube", url: "https://d.tube/watch/5MxdC3ajEpBwgcDCsrHRd5" }
    ];

const rows = [];
for (const s of SITES) {
  process.stdout.write(`\n⏳ ${s.name} قبل … `);
  const before = await measure({ extPath: BEFORE, url: s.url, port: port++ });
  process.stdout.write(before.note ? before.note : "تمّ");
  process.stdout.write(" · بعد … ");
  const after = await measure({ extPath: AFTER, url: s.url, port: port++ });
  console.log(after.note ? after.note : "تمّ");
  rows.push({ site: s.name, before, after });
}

console.log("\n=== صفر تغيّر سلوكي — الإضافة محمَّلة بشاهدَين مستوفيين ===\n");
let mismatches = 0, compared = 0;
for (const r of rows) {
  console.log(`── ${r.site}`);
  if (r.before.note || r.after.note) {
    console.log(`   ⚠️ ${r.before.note || ""} ${r.after.note || ""}  ⇒ لم يُقس\n`);
    continue;
  }
  compared++;
  const pairs = [
    ["عجلة ↑ فوق B1", delta(r.before.upB1), delta(r.after.upB1)],
    ["عجلة ↓ فوق B1", delta(r.before.downB1), delta(r.after.downB1)],
    ["B2 (بلا ربط)  ", delta(r.before.upB2), delta(r.after.upB2)]
  ];
  for (const [name, b, a] of pairs) {
    const same = b === a;
    if (!same && name !== "B2 (بلا ربط)  ") mismatches++;
    console.log(`   ${name} : قبل ${b} · بعد ${a}   ${same ? "✅ مطابق" : "❌ اختلف"}`);
  }
  console.log(`   فكّ الكتم على الرفع : قبل ${r.before.upB1?.mutedAfter} · بعد ${r.after.upB1?.mutedAfter}` +
    `   ${r.before.upB1?.mutedAfter === r.after.upB1?.mutedAfter ? "✅ مطابق" : "❌ اختلف"}`);
  console.log("");
}

console.log(compared === 0
  ? "⚠️ لم يُقس أي موقع\n"
  : (mismatches === 0
      ? `✅ صفر تغيّر سلوكي على ${compared} موقعاً/صفحة\n`
      : `❌ ${mismatches} اختلافاً سلوكياً — راجع أعلاه\n`));

local.srv.close();
fs.rmSync(BEFORE, { recursive: true, force: true });
fs.rmSync(AFTER, { recursive: true, force: true });
process.exit(mismatches === 0 ? 0 : 1);
