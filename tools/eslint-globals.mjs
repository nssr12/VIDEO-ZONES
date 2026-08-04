// يشتقّ الأسماءَ المتشاركة بين سكربتاتنا الكلاسيكية — **من `<script src>` لا بيد**.
//
// ⛔ **لماذا اشتقاقٌ لا قائمة (شرط المالك 2026-08-04):** `options.js` و`popup.js`
// سكربتاتٌ كلاسيكية، **فما تُعلنه `storage.js` و`settings-ui.js` مرئيٌّ لها بحكم
// `<script src>` في صفحتها**. و`no-undef` **لا يقرأ HTML**، فيطبع **22 اسماً
// سليماً** (`safeSyncSet` · `baseDomain` · `makeId` · …) في **~45 موضعاً**.
// ⇒ **والعلاجُ الساذج قائمةٌ بأيدينا — وهي بعينُها «قائمةٌ تُضاف لتُسكت الحارس»**،
// وقد صُرف اليوم كلُّه في رفضها. ⇒ **فتُشتقّ في كل تشغيلة، فلا يبقى ما يتباعد.**
//
// ⭐ **ولا حارسَ للتباعد لأنه مستحيلٌ بالبناء**: لا ملفَّ مُولَّداً يُقارَن به —
// **الاشتقاق يقع لحظةَ الفحص**. وهو أقوى ممّا طُلب (قائمةٌ + حارسٌ يُحمّر).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ما يُصرَّح به في **أعلى** الملفّ وحده — فالمشترَك بين السكربتات هو العُلويّ،
// وما داخل دالّةٍ لا يراه جارُها. ⚠️ **وحدٌّ مُعلَن:** الكشفُ نصّيّ، **وثمنُه
// مقبولٌ هنا وحده** لأن الخطأ فيه يُنتج **اسماً زائداً في العوالم لا ناقصاً** —
// أي **إيجابيةً كاذبةً مفقودة، لا عطباً يمرّ**… ⛔ **لا:** اسمٌ زائد **يُسكت**
// `no-undef` عنه. **فيُقصر على السطر الأوّل من العمود الأوّل** (لا مسافة بادئة)،
// وهو ما يجعل الالتقاط أضيقَ من أن يبتلع محليّاً.
function topLevelDeclarations(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = new Set();
  for (const line of src.split("\n")) {
    if (/^\s/.test(line)) continue;                       // بادئةٌ ⇒ داخل كتلة
    let m = line.match(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/);
    if (m) { out.add(m[1]); continue; }
    m = line.match(/^class\s+([A-Za-z_$][\w$]*)/);
    if (m) { out.add(m[1]); continue; }
    m = line.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (m) { out.add(m[1]); continue; }
    // تفكيكٌ علويّ: `const { a, b } = …`
    m = line.match(/^(?:const|let|var)\s*\{([^}]*)\}/);
    if (m) for (const x of m[1].split(",")) {
      const k = x.split(":").pop().trim().match(/^[A-Za-z_$][\w$]*/);
      if (k) out.add(k[0]);
    }
  }
  return out;
}

// سكربتاتُ كل صفحة — **تُقرأ من HTML** فلا تُفترض ولا تُكتب
export function pageScripts(html) {
  const src = fs.readFileSync(path.join(ROOT, html), "utf8");
  return [...src.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((s) => /\.js$/.test(s));
}

// ── ⭐ **الطبقةُ مُعلَنةٌ لا قائمةَ اتّجاهات** (قرار المالك 2026-08-04) ────────
// **المسألةُ «من يُقدّم لمن» لا «من يرى من».** المتصفّح يُتيح رؤيةً **متبادلة**
// بحكم `<script src>`، **وكودُنا لا يستعملها**: قِيس **صفرُ نداءٍ صاعد وصفرُ
// مرجعٍ صاعد** — `storage.js` و`settings-ui.js` **يُنادَيان ولا يُنادِيان**.
// ⛔ **ولماذا لا تُؤخذ الرؤيةُ المتبادلة رغم صدقها عن المتصفّح:** كانت تجعل
// **كلَّ اسمٍ في `options.js` عالَماً في `storage.js`** ⇒ **فيُسكَت الفحصُ عن
// اسمٍ حُذف وناداه أخوه — وهو #77 بعينه، بل و`syncSpeedBadgeRow` نفسُها.**
// ⇒ ⭐ **وعلاجٌ يُسكت الحارسَ عن الصنف الذي بُني له أسوأ من غيابه** (شرطُ قبول
// التبنّي كلِّه). **والصدقُ عن آليّةٍ لا يُغني عن العمى عن عطب.**
export const PROVIDERS = ["storage.js", "settings-ui.js"];
export const CONSUMERS = ["options.js", "popup.js", "background.js"];

// ⭐ **الأسماءُ المشترَكة: ما يُعلنه المُقدِّمون في صفحة المستهلك** — اتّجاهٌ واحد
export function sharedGlobalsFor(rel) {
  const pages = ["options.html", "popup.html"];
  const g = {};
  if (!CONSUMERS.includes(rel)) return g;      // **المُقدِّمُ لا يرث من مستهلكه**
  for (const html of pages) {
    let files;
    try { files = pageScripts(html); } catch { continue; }
    if (!files.includes(rel)) continue;
    for (const sib of files) {
      if (sib === rel || !PROVIDERS.includes(sib)) continue;
      try { for (const n of topLevelDeclarations(path.join(ROOT, sib))) g[n] = "readonly"; } catch {}
    }
  }
  // و`background.js` يجلب بـ`importScripts` — يُقرأ من نصّه لا يُفترض
  if (rel === "background.js") {
    const src = fs.readFileSync(path.join(ROOT, "background.js"), "utf8");
    for (const m of src.matchAll(/importScripts\(\s*["']([^"']+)["']/g)) {
      try { for (const n of topLevelDeclarations(path.join(ROOT, m[1]))) g[n] = "readonly"; } catch {}
    }
  }
  return g;
}

// كلُّ ملفّاتنا الكلاسيكية التي لها صفحة — يُشتقّ الاتّحاد للتقرير والحرّاس
export function allPageFiles() {
  const s = new Set(["background.js"]);
  for (const html of ["options.html", "popup.html"]) {
    try { for (const f of pageScripts(html)) s.add(f); } catch {}
  }
  return [...s];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const f of allPageFiles()) {
    const g = Object.keys(sharedGlobalsFor(f)).sort();
    console.log(`${f}: ${g.length} اسماً مشترَكاً` + (g.length ? `\n   ${g.join(" · ")}` : ""));
  }
}
