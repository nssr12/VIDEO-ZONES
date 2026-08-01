// البندان #38أ و#38ب — نظافة الـoverlay. **لا عَرَض يراه المستخدم فيهما، فاختبارهما
// آليّ ولا تحقّق ميدانيّ** (قرار المالك 2026-08-01).
//
// **(أ) البناء قبل تأكّد الربط:** كان `getZoneAtEvent` يبني الـoverlay لكل حدث
// عجلة أو نقرة فوق فيديو، **قبل أن يُعرف هل للمربّع ربط أصلاً** — فيُنشأ DOM لا
// يُعرض. صار البناء في **مسارَي العرض** بعد تأكّد الربط.
//
// ⚠️ **والشقّ الثاني من (أ) أُسقط لأنه محروس سلفاً، لا احتياطاً:** «يبنيه حتى عند
// **تعطيله**» — المسارات الثلاثة كلها خلف `zonesActive()`، وهي تبدأ بـ
// `extensionActive()` (المفتاح الرئيسي + الحظر) منذ #64. **حارسان لشيء واحد هو
// الازدواج الذي نطارده، لا احتياط.** والقسم [٣] يُثبت الحراسة القائمة بالعدّ.
//
// **(ب) المرجع القويّ:** `vzOverlayVideo` كان يُمسك عنصر فيديو **بعد خروجه من
// الـDOM** إلى نهاية عمر الصفحة. `teardownOverlay` لا تُنادى إلا عند التحوّل إلى
// فيديو آخر، و`hideOverlayNow` **تُخفي ولا تُفرّغ**.
//
// **شرط القبول: صفر تغيّر سلوكي.** والقسم [٢] يُبرهنه بنيوياً لا بالرجاء:
// التفريغ لا يقع إلا و**لا شيء معروض** و**العنصر منفصل** — وهي الحالة التي كان
// المسار السريع في `ensureVideoOverlay` يسقط فيها إلى الهدم وإعادة البناء أصلاً.
const fs = require("fs");

const SRC = fs.readFileSync("content.js", "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

function body(marker) {
  const i = SRC.indexOf(marker);
  if (i === -1) return null;
  const j = SRC.indexOf("\n}", i);
  return j === -1 ? null : SRC.slice(i, j);
}

console.log("\n=== #38أ+ب — نظافة الـoverlay ===\n");

// ── [١] (أ) البناء بعد تأكّد الربط ─────────────────────────────────────────
console.log("[١] (أ) الـoverlay يُبنى بعد تأكّد الربط لا قبله");
{
  // بلا قوس إغلاق: التوقيع صار `(e, blockScrollable)` في #65 (قرار 33).
  const g = body("function getZoneAtEvent(e");
  check("[١] `getZoneAtEvent` لا تبني الـoverlay", !!g && !g.includes("ensureVideoOverlay("), g);
  check("[١] وما زالت تُرجع {video, zone}", !!g && /return zone \? \{ video, zone \} : null;/.test(g));

  // مسار العجلة: البناء **بعد** فحص الربط والأوامر
  const wheel = SRC.slice(SRC.indexOf('window.addEventListener("wheel"'),
                          SRC.indexOf('window.addEventListener("wheel"') + 1400);
  const iEntry = wheel.indexOf("if (!entry) return;");
  const iActions = wheel.indexOf("if (!actions.length) return;");
  const iEnsure = wheel.indexOf("ensureVideoOverlay(");
  check("[١] مسار العجلة يبني بعد فحص الربط", iEntry > -1 && iEnsure > iEntry, `${iEntry}/${iEnsure}`);
  check("[١] وبعد فحص وجود أوامر", iActions > -1 && iEnsure > iActions, `${iActions}/${iEnsure}`);

  // مسار النقر: البناء بعد `zoneClickBinding` الذي يفحص الربط
  const click = body("function handleZoneClick(e)");
  const iBind = click ? click.indexOf("if (!bind) return false;") : -1;
  const iCEnsure = click ? click.indexOf("ensureVideoOverlay(") : -1;
  check("[١] مسار النقر يبني بعد تأكّد الربط", iBind > -1 && iCEnsure > iBind, `${iBind}/${iCEnsure}`);

  // مسار المفاتيح كان يتبع هذا النمط سلفاً — **فالثلاثة صارت واحداً**
  const key = SRC.slice(SRC.indexOf("const bind = zoneKeyBinding(hoveredVideo, sig);"),
                        SRC.indexOf("const bind = zoneKeyBinding(hoveredVideo, sig);") + 400);
  check("[١] ومسار المفاتيح على النمط نفسه (كان سلفاً)",
    key.indexOf("if (bind) {") > -1 && key.indexOf("ensureVideoOverlay(") > key.indexOf("if (bind) {"));
}

// ── [٢] (ب) تفريغ المرجع — وحياديته بالبرهان ──────────────────────────────
console.log("\n[٢] (ب) المرجع القويّ يُفرَّغ، وبشرطين يجعلان التغيير محايداً");
{
  const t = body("function startOverlayTracking()");
  check("[٢] التفريغ داخل حلقة التتبّع", !!t && t.includes("vzOverlayVideo = null"), t);
  check("[٢] ومشروط بانفصال العنصر عن الـDOM",
    !!t && /if \(vzOverlayVideo && !vzOverlayVideo\.isConnected\) vzOverlayVideo = null;/.test(t), t);
  // الشرط الثاني: لا شيء معروض — فالتفريغ لا يُرى بحال
  const i1 = t ? t.indexOf("if (!anySubElementVisible())") : -1;
  const i2 = t ? t.indexOf("vzOverlayVideo = null") : -1;
  check("[٢] وداخل فرع «لا شيء معروض»", i1 > -1 && i2 > i1, `${i1}/${i2}`);

  // **البرهان على صفر تغيّر**: المسار السريع يشترط `isConnected` أصلاً، فحالة
  // التفريغ هي بعينها الحالة التي كان يسقط فيها إلى الهدم وإعادة البناء.
  const e = body("function ensureVideoOverlay(video)");
  check("[٢] والمسار السريع يشترط `video.isConnected` (برهان الحياد)",
    !!e && /vzOverlayVideo === video && vzOverlay && video\.isConnected/.test(e), e);
  check("[٢] و`hideOverlayNow` ما زالت تُخفي ولا تُفرّغ (لم تُمسّ)",
    !(body("function hideOverlayNow()") || "").includes("vzOverlayVideo"));
}

// ── [٣] الشقّ المُسقَط: «يبنيه وهو معطَّل» محروس سلفاً ─────────────────────
console.log("\n[٣] الشقّ المُسقَط — محروس سلفاً، فلا حارس ثانٍ");
{
  // المسارات الثلاثة خلف `zonesActive()`، وهي تبدأ بالبوّابة الواحدة
  const wheelHead = SRC.slice(SRC.indexOf('window.addEventListener("wheel"'),
                              SRC.indexOf('window.addEventListener("wheel"') + 400);
  check("[٣] مسار العجلة خلف `zonesActive()`", wheelHead.includes("if (!zonesActive()) return;"));
  check("[٣] مسار النقر خلف `zonesActive()`",
    (body("function zoneClickBinding(e)") || "").includes("if (!zonesActive()) return null;"));
  check("[٣] مسار المفاتيح خلف `zonesActive()`",
    (body("function zoneKeyBinding(video, sig)") || "").includes("if (!zonesActive()) return null;"));
  const z = body("function zonesActive()");
  check("[٣] و`zonesActive` تبدأ بالبوّابة الواحدة (#64)",
    !!z && z.indexOf("extensionActive()") < z.indexOf("remappingEnabled()"), z);
}

console.log(`\n✅ نجح ${pass} / فشل ${fail}\n`);
process.exit(fail ? 1 : 0);
