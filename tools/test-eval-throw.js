// يحرس أن `evalIn` تقول حين ترمي، وأن `undefined` صار معناه واحداً لا اثنين.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«حين يقول تقريرُنا عن الإضافة «كلُّ
// شيءٍ سليم» — أهو خبرٌ عن الإضافة، أم عن أداةٍ عميت فسكتت؟»*
//
// ── العلّة التي وُلد منها (#93، مقيسةٌ 2026-08-04) ──────────────────────────
// `evalIn` كانت تُرجع `r?.result?.result?.value` **ولا تقرأ `exceptionDetails`**.
// **والمقيس على الدالّة نفسِها قبل الإصلاح، بمتصفّحٍ حيّ:**
//   · **وعدٌ مرفوض** ⇒ **`{}`** — لأن `returnByValue` يُسلسِل `Error` إلى كائنٍ
//     فارغ **صادقٍ في `if`** ⇒ **إثباتٌ كاذب**.
//   · **رميةٌ متزامنة** ⇒ `undefined` ⇒ **صفرٌ كاذب، ولا يُفرَّق عن قيمةٍ
//     `undefined` مشروعة**.
// ⇒ ⭐ **مُساعدٌ واحد أنتج قطبَي العائلة معاً، وقد ظُنّا بابين.**
// **وكلفتُه:** قسم [٣] في `bench-options-page.mjs` أخضرُ عن عمى في 46 ضابطاً.
//
// ── ولماذا يُعاد تمثيل ردّ CDP هنا بدل متصفّحٍ حيّ ─────────────────────────
// **الردود أدناه ليست مُتخيَّلة: هي أشكالُ ما رجع من كروم فعلاً** حين قِيست
// الأوجه الأربعة (`tools/bench-eval-contract.mjs` يُعيد قياسها حيّةً).
// ⇒ **فهذا يحرس العقد في المجموعة بلا متصفّح، وذاك يُثبت أن العقد يصف الواقع.**
// ⚠️ **وأحدُهما لا يُغني عن الآخر:** تمثيلٌ بلا قياسٍ حيّ يحرس ظنَّنا عن CDP،
// وقياسٌ حيّ بلا حارسٍ في المجموعة لا يُشغَّل قبل كل كومِت.
let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, extra ?? ""));

// ── أشكالُ ردّ CDP الأربعة، كما قِيست ──────────────────────────────────────
const FACES = {
  value: { result: { result: { type: "object", value: { ok: true, n: 5 } } } },
  reject: { result: { result: { type: "object", value: {} },
                      exceptionDetails: { text: "Uncaught (in promise)",
                        exception: { description: "ReferenceError: a is not defined\n    at <anonymous>:1:1" } } } },
  syncThrow: { result: { result: { type: "undefined" },
                         exceptionDetails: { text: "Uncaught",
                           exception: { description: "ReferenceError: a is not defined" } } } },
  undef: { result: { result: { type: "undefined" } } }
};
const fakeConn = (face) => ({ send: async () => FACES[face] });

const main = async () => {
  const { evalIn } = await import("./ext-harness.mjs");
  const call = async (face, expr = "x") => {
    try { return { threw: false, value: await evalIn(fakeConn(face), expr) }; }
    catch (e) { return { threw: true, msg: String(e?.message || e), mark: !!e?.vzEvalThrew }; }
  };

  console.log("\n[1] الأوجه الأربعة — ولكلٍّ سلوكٌ واحدٌ لا يلتبس");
  {
    const ok = await call("value");
    check("قيمةٌ سليمة تُرجَع كما هي", !ok.threw && ok.value?.n === 5, JSON.stringify(ok));

    // ⛔ **هذا هو العطب بعينه**: كان يُرجع `{}` الصادقة فيُقرأ نجاحاً
    const rj = await call("reject");
    check("**وعدٌ مرفوض يرمي** ولا يُرجع `{}` صادقة", rj.threw, JSON.stringify(rj));

    const th = await call("syncThrow");
    check("**ورميةٌ متزامنة ترمي** ولا تُرجع `undefined`", th.threw, JSON.stringify(th));

    const ud = await call("undef");
    check("و`undefined` مشروعة تُرجَع ولا ترمي", !ud.threw && ud.value === undefined, JSON.stringify(ud));
  }

  console.log("\n[2] ⭐ و«رمى» يُفرَّق عن «أرجع undefined» — وهو نصفُ العلّة");
  {
    const th = await call("syncThrow"), ud = await call("undef");
    check("الحالان لم يعودا شيئاً واحداً", th.threw !== ud.threw,
      `رمية=${th.threw} · undefined=${ud.threw}`);
    check("ولا يُنتجان القيمة نفسها", !(th.threw === false && th.value === ud.value));
  }

  console.log("\n[3] والبلاغُ يُستدلّ به — لا «فشلَ شيءٌ ما»");
  {
    const rj = await call("reject", `document.querySelector("#idleDuration").value = "100"`);
    check("يحمل سببَ الرمية", /ReferenceError: a is not defined/.test(rj.msg), rj.msg);
    check("ويحمل التعبيرَ الذي رماه", /idleDuration/.test(rj.msg), rj.msg);
    check("وعلامةٌ بنيوية لمن يُميّزها عمداً (`vzEvalThrew`)", rj.mark === true);
    // **سطرٌ واحد لا أثرُ كومةٍ كامل** — بلاغٌ لا يُقرأ بلاغٌ لا يُصلح
    check("والوصفُ سطرٌ واحد لا كومة", !/\n/.test(rj.msg), JSON.stringify(rj.msg));
  }

  console.log("\n[4] شاهدا قرار 26 — على الحارس نفسه");
  {
    // **موجب:** الدالّة السابقة حرفاً — تُرجع القيمة ولا تقرأ الرمية
    const old = async (c) => (await c.send())?.result?.result?.value;
    const oldReject = await old(fakeConn("reject"));
    const oldThrow = await old(fakeConn("syncThrow"));
    const oldUndef = await old(fakeConn("undef"));
    check("موجب: السابقةُ تُرجع `{}` **صادقة** على وعدٍ مرفوض",
      typeof oldReject === "object" && oldReject !== null && !!oldReject &&
      Object.keys(oldReject).length === 0, JSON.stringify(oldReject));
    check("وموجبٌ ثانٍ: ولا تفرّق رميتَها من `undefined`",
      oldThrow === oldUndef && oldThrow === undefined);
    // **سالب:** والقيمة السليمة تمرّ في الاثنتين — فالحارس لا يُحمّر على كل شيء
    check("سالب: والقيمةُ السليمة تمرّ في السابقة والحاليّة معاً",
      (await old(fakeConn("value")))?.n === 5 && (await call("value")).value?.n === 5);
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
};
main();
