// البند #36 — زرّ الحظر لا يترك رفضاً معلّقاً.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«إن فشل حفظُ حظر الموقع، أأرى خطأً أم يبقى الزرّ كأنّ شيئاً لم يقع؟»*
//
// العَرَض غير مرئيّ بطبعه: الرفض يعيش في كونسول الـ popup وحده. فيُقاس **بشاهدين
// مستقلّين**، لأن أحدهما وحده يخدع:
//   (١) **عدّاد `unhandledRejection` على مستوى العملية** — وهو العَرَض نفسه.
//       ولذلك يُستدعى المعالج **كما يستدعيه المتصفّح: بلا انتظار قيمته**؛ فمن
//       ينتظرها يكون قد عالج الرفض بنفسه ثم شهد أنه «لا رفض».
//   (٢) **سطر حالة أحمر يراه المستخدم** — فالصمت هنا أسوأ من الرسالة: الزرّ
//       يبقى على حالته القديمة فيُقرأ «لم يقع شيء» وهو «وقع خطأ لم يُقَل».
// والنجاح يبقى صامتاً (قرار 7): تشغيلة سليمة **لا سطر فيها إطلاقاً**.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from} من ${file}`);
  return t.slice(a, b);
}

let pass = 0, fail = 0;
const check = (n, c, x) => c ? (pass++, console.log("  ✅ " + n))
                             : (fail++, console.log("  ❌ " + n, x ?? ""));

const rejections = [];
process.on("unhandledRejection", (e) => rejections.push(e));
const settle = () => new Promise((r) => setImmediate(() => setImmediate(r)));

// دوالّ المسار نفسها + سطر الربط الحقيقيّ من موضعه في الملف.
const FUNCS = slice("popup.js", "async function loadBlockedSiteUI", "async function loadSubtitlesToggle");
const WIRE = slice("popup.js", '$("blockSiteBtn").addEventListener', '$("checkStatus")');

function run({ reject }) {
  const statuses = [];
  let listener = null;
  const btn = { classList: { toggle() {} }, title: "", addEventListener: (_t, fn) => { listener = fn; } };

  const store = {
    get() {
      return reject ? Promise.reject(new Error("QUOTA_BYTES quota exceeded")) : Promise.resolve({ settings: {} });
    },
    set() { return Promise.resolve(); }
  };

  const ctx = {
    chrome: {
      storage: { sync: store },
      tabs: { query: () => Promise.resolve([{ id: 1 }]), sendMessage: () => Promise.resolve() }
    },
    console, TextEncoder,
    $: () => btn,
    currentHost: "example.com",
    isHostBlocked: () => false,
    safeSyncSet: () => Promise.resolve({ ok: true }),
    syncErrorText: (e) => `مترجَم: ${e?.message || e}`,
    getActiveTab: () => Promise.resolve({ id: 1 }),
    setStatus: (kind, text) => statuses.push([kind, text])
  };
  vm.createContext(ctx);
  vm.runInContext(FUNCS + "\n" + WIRE, ctx);
  return { statuses, fire: () => { listener(); } };   // بلا انتظار — كما يفعل المتصفّح
}

(async () => {
  console.log("\n[1] التخزين يرفض ⇒ لا رفض معلّق، ورسالة يراها المستخدم");
  {
    const r = run({ reject: true });
    const before = rejections.length;
    r.fire();
    await settle();

    // ⚠️ فشل هذا التأكيد يعني أن رفضاً عاد بلا معالج في مسار زرّ الحظر.
    check("صفر رفض معلّق", rejections.length === before, rejections.slice(before).map(String));
    check("سطر حالة أحمر ظهر", r.statuses.some(([k]) => k === "bad"), r.statuses);
    const msg = (r.statuses.find(([k]) => k === "bad") || [])[1] || "";
    check("يقول ما الذي تعذّر", /تعذّر تغيير حالة الحظر/.test(msg), msg);
    check("ويحمل السبب مترجَماً لا خاماً", /مترجَم:/.test(msg), msg);
  }

  console.log("\n[2] المسار السليم ⇒ صامت تماماً (قرار 7)");
  {
    const r = run({ reject: false });
    const before = rejections.length;
    r.fire();
    await settle();
    check("صفر رفض معلّق", rejections.length === before, rejections.slice(before).map(String));
    check("لا سطر حالة إطلاقاً", r.statuses.length === 0, r.statuses);
  }

  console.log("\n[3] الشاهد يرى: رفضٌ غير معالج يُلتقط فعلاً");
  {
    // بلا هذا الشاهد يمرّ [1] على أداة عمياء — «لا يوجد» و«لا أرى» يطبعان الصفر نفسه.
    const before = rejections.length;
    Promise.reject(new Error("شاهد موجب مقصود"));
    await settle();
    check("العدّاد ارتفع بواحد", rejections.length === before + 1, rejections.length - before);
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
