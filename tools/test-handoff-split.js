// حارس قسمة #81: نقلٌ لا حذف · وكلُّ مرجعٍ يُشار إليه · ولا قسمَ خارج قائمته.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل أجد حالةَ العمل في ملفٍّ واحد يُقرأ أوّلاً، ولا يضيع ما نُقل؟ (والمستخدم هنا المالك)»*
//
// ⚠️ **الثالث هو ما يمنع عودة 2750 سطراً (قرار المالك):** `HANDOFF` **بلغ 2750
// سطراً بالتراكم لا بقرار** — والرقم مكتوبٌ هنا **شاهداً**: لم يقرّر أحدٌ أن
// يبلغه، **بل أُضيف إليه قسمٌ بعد قسم بحسن نيّة**. **وسقفُ أسطرٍ رقمٌ اعتباطيّ يُتحايَل عليه بالاختصار**،
// **أما القائمة فتُلزم بالسؤال «أيُقرأ هذا في كل جلسة؟» عند كل إضافة** — وهو
// المعيار نفسه مُطبَّقاً آلياً.
//
// ⚠️ **وبصمةُ النقل** في `tools/handoff-split-manifest.json`: **كل سطرٍ نُقل يوم
// القسمة يجب أن يبقى موجوداً** في أحد الخمسة. **وحذفُ سطرٍ لاحقاً يُحمّر هذا
// الحارس** — فيُحذف **عمداً** من البصمة أو يُعاد (قرار 33: أصلِح المرساة لا
// التأكيد، وقرار المالك: نقلٌ لا حذف).
const fs = require("fs");
const crypto = require("crypto");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

const DOCS = ["docs/DECISIONS.md", "docs/PLATFORMS.md", "docs/HISTORY.md", "docs/REFERENCE.md"];
const HANDOFF = fs.readFileSync("HANDOFF.md", "utf8");

// **أقسام `HANDOFF` المسموح بها — بالاسم، وبسببِ بقاء كلٍّ**
const ALLOWED = {
  "## 0. أين تستأنف — اقرأه أولاً": "الحالة الآنيّة — سببُ وجود الملفّ",
  "## 4. قرارات المالك — **الأحدَ عشرَ التي تُستعمل في كل جلسة**": "قراراتٌ يقع الخطأ بغيابها",
  "## 6. بروتوكول العمل": "يُمشى عليه في كل كومِت"
};

const sig = (l) => {
  const t = l.trim();
  return (t && t !== "---") ? crypto.createHash("sha1").update(t).digest("hex").slice(0, 12) : null;
};

console.log("\n[1] الأقسام من قائمةٍ مسمّاة — فقسمٌ جديد يُحمّر حتى يُضاف عمداً");
{
  const heads = HANDOFF.split("\n").filter((l) => /^## /.test(l));
  const unknown = heads.filter((h) => !(h in ALLOWED));
  check(`أقسام HANDOFF ${heads.length} وكلُّها في القائمة`, unknown.length === 0, unknown);
  const missing = Object.keys(ALLOWED).filter((k) => !heads.includes(k));
  check("ولا قسمَ في القائمة سقط من الملفّ", missing.length === 0, missing);
}

console.log("\n[2] المراجع الأربعة موجودة، ولكلٍّ سطرُ «متى يُقصد» في HANDOFF");
{
  for (const d of DOCS) {
    check(`${d} موجود`, fs.existsSync(d));
    check(`و«متى يُقصد» فيه`, fs.existsSync(d) &&
      /متى يُقصد/.test(fs.readFileSync(d, "utf8")));
    check(`ومُشارٌ إليه من HANDOFF`, HANDOFF.includes(d));
  }
  // ⚠️ **الإشارة وحدها لا تكفي**: جدولُ المراجع يقول **متى** يُقصد كلٌّ
  const table = HANDOFF.split("\n").filter((l) => /^\| \[`docs\//.test(l));
  check(`وجدولُ المراجع يحمل أربعة صفوف بمتى وكان`, table.length === 4, table.length);
}

console.log("\n[3] بصمةُ النقل — نقلٌ لا حذف");
{
  const man = JSON.parse(fs.readFileSync("tools/handoff-split-manifest.json", "utf8"));
  const have = new Set();
  for (const f of ["HANDOFF.md", ...DOCS]) {
    for (const l of fs.readFileSync(f, "utf8").split("\n")) {
      const s = sig(l);
      if (s) have.add(s);
    }
  }
  // ⛔⭐ **حالةٌ ثالثة: «مشطوب» — بجوار «موجود» و«ضاع»** (قرار المالك 2026-08-04،
  // من قرار 89). **العلّة:** قرار 21 **يوجب** أن يبقى المسحوب مشطوباً بسببه لا
  // محذوفاً صامتاً؛ **والشطبُ يغيّر نصّ السطر فيغيّر بصمتَه**، فيقرؤه هذا الحارس
  // **«ضاع»**. ⇒ **فطاعةُ قرار 21 كانت تُحمّر الحارس، وطاعةُ الحارس تعني الحذف
  // الصامت الذي يمنعه قرار 21** — **حارسان يتعارضان وأحدُهما يفوز صامتاً**،
  // والفائزُ هو المُنفَّذ لا الأصحّ.
  // ⇒ ⭐ **والعلاجُ ليس إعفاءً يدويّاً** (فذاك يُفرغ البصمة سطراً سطراً):
  // **الشطبُ تغييرُ حالةٍ لا فقدانُ محتوى**، فيُبصَم **متنُ ما بين `~~`** كذلك،
  // ويُصنَّف السطرُ مشطوباً لا ضائعاً. ⚠️ **وحدُّه مُعلَن: يُمسك الشطبَ الذي
  // يُبقي المتن كما هو**؛ ومن شطب وأعاد الصياغة داخل الشطب **يُقرأ ضياعاً بحقّ**.
  const struck = new Set();
  for (const f of ["HANDOFF.md", ...DOCS])
    for (const l of fs.readFileSync(f, "utf8").split("\n"))
      for (const m of l.matchAll(/~~([\s\S]*?)~~/g)) { const t = sig(m[1]); if (t) struck.add(t); }

  const missing = man.lines.filter((h) => !have.has(h));
  const lost = missing.filter((h) => !struck.has(h));
  const withdrawn = missing.filter((h) => struck.has(h));
  check(`كلُّ ما نُقل باقٍ أو مشطوبٌ بسببه (${man.count} سطراً)`, lost.length === 0,
    `${lost.length} ضاع`);
  if (withdrawn.length) console.log(`  · ومشطوبٌ بقرار 21 (حالةٌ ثالثة لا ضياع): ${withdrawn.length}`);

  // شاهدٌ على الحارس: بصمةٌ مُفتعَلة **يجب أن تُقرأ ضائعة**
  check("والحارس يرى الضياع (شاهد مُفتعَل)", !have.has("0000deadbeef") && !struck.has("0000deadbeef"));
  // ⭐ **وشاهدان للحالة الثالثة: المشطوبُ يُقرأ مشطوباً، والمحذوفُ يبقى ضياعاً**
  {
    const line = "⛔ ~~نصٌّ سُحب~~ — **مسحوبٌ (قرار 21)**";
    const inner = [...line.matchAll(/~~([\s\S]*?)~~/g)].map((m) => sig(m[1]));
    check("موجب: متنُ المشطوب يُبصَم فيُعرَف", inner.includes(sig("نصٌّ سُحب")));
    check("سالب: ونصٌّ حُذف أصلاً يبقى ضياعاً", !inner.includes(sig("نصٌّ آخر لم يُكتب")));
  }
}

console.log("\n[4] وقرارات المالك: لكلّ رقمٍ موضعٌ واحد");
{
  // ⚠️ **القراءة داخل §4 وحده**: أوّل عدّةٍ ساذجة عدّت قوائم `1.` في §0 كأنها
  // قرارات — **ومطابقةٌ أوسع من سؤالها تُنتج إثباتاً كاذباً** (درس #92).
  // ⚠️ **ثقبٌ أُصلح 2026-08-04:** كان النمط يشترط `**` بعد النقطة مباشرةً،
  // **فمرّ ثمانيةُ قرارات كُتبت `رقم. ⭐ **…`** — **وحارسٌ لا يرى ما يحرسه أسوأ
  // من غيابه**. ⇒ **يُقرأ الرقمُ في أوّل السطر، وما بعده لا يُشترط شكلُه.**
  const nums = (txt) => new Set((txt.match(/^\d+[بجد]?\. /gm) || [])
    .map((x) => x.trim().replace(/\.$/, "")));
  const sec4 = (HANDOFF.split(/^## 4\. /m)[1] || "").split(/^## /m)[0];
  const inH = nums(sec4);
  const inD = nums(fs.readFileSync("docs/DECISIONS.md", "utf8"));
  const both = [...inH].filter((n) => inD.has(n));
  // **الأحدَ عشرَ بأسمائها لا بعددها** — فرقمٌ مكتوبٌ بيد يتباعد (قرار 34)،
  // **والقائمةُ تقول أيضاً أيُّها**، فاستبدالُ قرارٍ بآخر يُحمّر لا يمرّ.
  const ELEVEN = ["16", "19", "20", "21", "22", "26", "32", "34", "47", "48", "58"];
  const missing = ELEVEN.filter((n) => !inH.has(n));
  const extra = [...inH].filter((n) => !ELEVEN.includes(n));
  check(`الأحدَ عشرَ بأسمائها في HANDOFF`, missing.length === 0 && extra.length === 0,
    `ناقص=${missing} · زائد=${extra}`);
  check("ولا رقمَ في الموضعين معاً — لكلّ حقيقةٍ موضع (قرار 36)", both.length === 0, both);
  // **وما ليس منها فموضعه المرجع** — يُشتقّ ولا يُكتب رقمُه بيد
  check(`وبقيّتها في المرجع (${inD.size} قراراً)`, inD.size > 0 && !ELEVEN.some((n) => inD.has(n)));
}

console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
