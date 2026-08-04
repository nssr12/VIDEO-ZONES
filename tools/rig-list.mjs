// الموضع الواحد لأسماء بوّابة الكومِت ولقائمة «عند الطلب» — **والعددان يُشتقّان.**
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين يقال «شُغّلت كلُّها قبل
// النسخة» — أهي كلُّها فعلاً، أم عددٌ كُتب بيدٍ يوماً وتخلّف عن الواقع؟»*
//
// ── العلّة التي وُلد منها (2026-08-04، قرار المالك) ─────────────────────────
// ⛔ **«الثلاثةُ والعشرون» رقمٌ كُتب بيدٍ ولا مصدرَ له — والمقيس 32.**
// **وموضعُه أسوأ ما يكون: في القاعدة التي تحكم رفعَ النسخة** — فلو سُحبت 23
// لقيل «سُحبت كلُّها» **وتِسعٌ لم تُسحب**. ⇒ **وهو قرار 34 واقعاً في قاعدةٍ
// نحكم بها، لا في سطرِ توثيق.**
// ⭐ **والعلاجُ ليس تصحيحَ الرقم:** رقمٌ أُصلحت قيمتُه **يتخلّف ثانيةً بالبناء**.
// ⇒ **فيُشتقّ ولا يُكتب، ويُحمّر الحارسُ إن كُتب بيد.**
// ⚠️ **وقد كان الرقمُ في عشرة مواضع لا ثلاثة** — ستّةٌ في `HANDOFF` وثلاثةٌ في
// `CLAUDE.md` **وواحدٌ في الحارس نفسِه يفرضه**، فكان الخطأ محروساً لا مكتوباً.
//
//   node tools/rig-list.mjs            # القائمتان والعددان
//   node tools/rig-list.mjs --names    # أسماءُ «عند الطلب» وحدها، سطراً سطراً
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// **الموضع الواحد لأسماء الثمانية** — ومنه يُشتقّ كلُّ عدٍّ في المستودع.
export const GATE = [
  "run-tests.js", "audit-status.js", "bench-options-page.mjs", "bench-overlay-layer.mjs",
  "bench-eval-contract.mjs", "bench-s69-guards.mjs", "repro-58-fullscreen.mjs",
  "lint-names.mjs"
];

// ⚠️ **«رِكاز» يُعرَّف بالشكل لا بالنيّة**: ملفٌّ في `tools/` يبدأ اسمُه بـ
// `bench-` أو `repro-` أو `probe-` وينتهي بـ`.mjs`. **وتعريفٌ بالنيّة يُنتج
// خلافاً في العدّ** — وهو ما وقع.
export const isRig = (f) => /^(bench|repro|probe)-.*\.mjs$/.test(f);

export function allRigs(root = ROOT) {
  return fs.readdirSync(path.join(root, "tools")).filter(isRig).sort();
}

// **«عند الطلب» = كلُّ رِكازٍ ليس في البوّابة** — لا قائمةٌ ثانية تُحدَّث بيد.
export function onDemand(root = ROOT) {
  const gate = new Set(GATE);
  return allRigs(root).filter((f) => !gate.has(f));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const od = onDemand();
  if (process.argv.includes("--names")) {
    console.log(od.join("\n"));
  } else {
    console.log(`\nالبوّابة: ${GATE.length}`);
    for (const g of GATE) console.log(`  · ${g}`);
    console.log(`\nعند الطلب: ${od.length}   (من ${allRigs().length} رِكازاً في المستودع)`);
    for (const r of od) console.log(`  · ${r}`);
    console.log("");
  }
}
