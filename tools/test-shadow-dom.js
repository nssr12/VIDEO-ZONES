// Audit #16 + #22: find a <video> behind a shadow boundary, and recognise typing
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تعمل الإضافة على مشغّلٍ داخل Shadow DOM، ولا تسرق حرفاً وأنا أكتب؟»*
// inside a Web Component — both bounded so no page shape can turn either into a
// runaway tree walk.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}
const FIND = slice("content.js", "const SHADOW_MAX_DEPTH", "function getVideoUnderPointer");
const TYPING = slice("content.js", "function shouldIgnoreKeyBecauseTyping", "\nchrome.storage.onChanged");

let probes = 0; // كم جذر ظل زرناه — لإثبات أن العمق محدود فعلاً

function ctxFor(activeElement) {
  const ctx = {
    zoneRectForVideo: (v) => v.__rect,
    document: { activeElement },
    console
  };
  vm.createContext(ctx);
  vm.runInContext(FIND + "\n" + TYPING, ctx);
  return ctx;
}

const RECT = { left: 0, top: 0, right: 640, bottom: 360 };
const video = () => {
  const v = { tagName: "VIDEO", getBoundingClientRect: () => ({ width: 640, height: 360, ...RECT }) };
  v.__rect = RECT;
  return v;
};
const plain = () => ({ tagName: "DIV", closest: () => null, querySelectorAll: () => [], shadowRoot: null });
// مضيف مكوّن ويب: محتواه لا يُرى إلا عبر جذر الظل
const host = (inner) => {
  const h = plain();
  h.shadowRoot = { elementsFromPoint: () => { probes++; return inner; } };
  return h;
};

let pass = 0, fail = 0;
const check = (n, c, x) => c ? (pass++, console.log("  ✅ " + n))
                             : (fail++, console.log("  ❌ " + n, x ?? ""));

const find = (ctx, stack) =>
  ctx.videoFromStack(stack, 10, 10) || ctx.videoFromShadowStack(stack, 10, 10);

(async () => {
  const ctx = ctxFor(null);

  console.log("\n[1] فيديو خلف حدّ ظل واحد");
  {
    const v = video();
    check("لم يكن يُرى قبل الإصلاح", ctx.videoFromStack([host([v])], 10, 10) === null);
    check("يُرى الآن", find(ctx, [host([v])]) === v);
  }

  console.log("\n[2] تعشيش متعدد المستويات");
  {
    const v = video();
    let node = host([v]);
    for (let i = 0; i < 3; i++) node = host([node]);   // 4 مستويات
    check("يُعثر عليه عبر 4 مستويات", find(ctx, [node]) === v);
  }

  console.log("\n[3] العمق محدود — لا مسح شجرة بلا نهاية");
  {
    const v = video();
    let node = host([v]);
    for (let i = 0; i < 12; i++) node = host([node]); // 13 مستوى > الحد
    probes = 0;
    const got = find(ctx, [node]);
    check("يتوقف بلا عثور", got === null, got);
    // const لا يصير خاصية على الـ context، فنقرأه بتقييم داخل نفس السياق
    const cap = vm.runInContext("SHADOW_MAX_DEPTH", ctx);
    check(`لم يتجاوز الحد ${cap} (زار ${probes} جذراً)`, probes <= cap, { probes, cap });
  }

  console.log("\n[4] صفحة بلا مكوّنات ويب ⇒ خروج فوري");
  {
    const stack = Array.from({ length: 14 }, plain);
    check("null بلا أي زيارة", ctx.videoFromShadowStack(stack, 10, 10) === null);
  }

  console.log("\n[5] الفيديو في الـ DOM العادي يفوز ولا يُستدعى الظل");
  {
    const v = video();
    probes = 0;
    check("عُثر عليه", find(ctx, [v, host([video()])]) === v);
    check("لم يُزَر أي جذر ظل", probes === 0, probes);
  }

  console.log("\n[6] الكتابة داخل Web Component (البند #22)");
  {
    const cases = [
      ["INPUT مباشر", { tagName: "INPUT" }, true],
      ["TEXTAREA مباشر", { tagName: "TEXTAREA" }, true],
      ["SELECT", { tagName: "SELECT" }, true],
      ["contentEditable", { tagName: "DIV", isContentEditable: true }, true],
      ['role="textbox"', { tagName: "DIV", getAttribute: (a) => (a === "role" ? "textbox" : null) }, true],
      ["DIV عادي", { tagName: "DIV" }, false],
      ["INPUT داخل جذر ظل", { tagName: "DIV", shadowRoot: { activeElement: { tagName: "INPUT" } } }, true],
      ["INPUT على عمقين", { tagName: "DIV", shadowRoot: { activeElement: { tagName: "DIV", shadowRoot: { activeElement: { tagName: "INPUT" } } } } }, true],
      ["مكوّن بلا حقل", { tagName: "DIV", shadowRoot: { activeElement: { tagName: "SPAN" } } }, false],
      ["لا عنصر نشط", null, false]
    ];
    for (const [name, active, want] of cases) {
      const got = ctxFor(active).shouldIgnoreKeyBecauseTyping();
      check(`${name} ⇒ ${want ? "تجاهل" : "تنفيذ"}`, got === want, got);
    }
  }

  console.log("\n[7] تعشيش عميق في العنصر النشط لا يعلّق");
  {
    let node = { tagName: "DIV" };
    for (let i = 0; i < 40; i++) node = { tagName: "DIV", shadowRoot: { activeElement: node } };
    const t0 = Date.now();
    const got = ctxFor(node).shouldIgnoreKeyBecauseTyping();
    check("عاد بسرعة وبلا تعليق", got === false && Date.now() - t0 < 50, got);
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
