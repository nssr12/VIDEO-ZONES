// Audit #9 + #33: toggleFullscreen must report the TRUTH synchronously.
//   false → the request was impossible, so runAction must not preventDefault
//   true  → a request went out; a later rejection is reported, never swallowed
// Extracts the real toggleFullscreen from content.js and stubs only its deps.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}
// يشمل notifyVideoActionFailed لأن toggleFullscreen يعتمد عليه
const SRC = slice("content.js", "function notifyVideoActionFailed", "\nfunction findVideoLoose");

const ctxCleared = { n: 0 };
function load({ doc, nativeBtn = null, container = {} }) {
  const failures = [];
  ctxCleared.n = 0;
  const ctx = {
    document: doc,
    console: { debug() {} },
    findNativeFullscreenButton: () => nativeBtn,
    pickFullscreenContainer: () => container,
    ensureVideoOverlay() {},
    // #58 كومِت ب: toggleFullscreen تسجّل ما كبّرناه وتُصفّره عند الرفض
    clearFsFillMarks() { ctxCleared.n++; },
    showOverlay: (t) => failures.push(t),
    Promise, setTimeout
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, failures };
}

let pass = 0, fail = 0;
const check = (n, c, x) => c ? (pass++, console.log("  ✅ " + n))
                             : (fail++, console.log("  ❌ " + n, x ?? ""));
const tick = () => new Promise((r) => setTimeout(r, 0));
const VIDEO = { tagName: "VIDEO" };

(async () => {
  console.log("\n[1] زر الموقع الأصلي موجود ⇒ true وضغطة واحدة");
  {
    let clicked = 0;
    const { ctx } = load({ doc: {}, nativeBtn: { click: () => clicked++ } });
    check("true", ctx.toggleFullscreen(VIDEO) === true);
    check("ضُغط الزر", clicked === 1, clicked);
  }

  console.log("\n[2] لا API إطلاقاً ⇒ false فلا يُبتلع الحدث");
  {
    const { ctx } = load({ doc: {}, container: {} });
    check("false", ctx.toggleFullscreen(VIDEO) === false);
  }

  console.log("\n[3] الطلب أُرسل ثم رُفض ⇒ true + إبلاغ المستخدم");
  {
    const { ctx, failures } = load({
      doc: {},
      container: { requestFullscreen: () => Promise.reject(new Error("Permissions check failed")) }
    });
    check("true (أُرسل فعلاً)", ctx.toggleFullscreen(VIDEO) === true);
    await tick();
    check("أُبلغ المستخدم", failures.some((t) => /رفض ملء الشاشة/.test(t)), failures);
  }

  console.log("\n[4] الطلب رمى متزامناً ⇒ false + إبلاغ");
  {
    const { ctx, failures } = load({
      doc: {},
      container: { requestFullscreen: () => { throw new TypeError("boom"); } }
    });
    check("false (لم يُرسل شيء)", ctx.toggleFullscreen(VIDEO) === false);
    check("أُبلغ المستخدم", failures.length === 1, failures);
  }

  console.log("\n[5] نجاح عادي ⇒ true بلا إبلاغ");
  {
    const { ctx, failures } = load({
      doc: {},
      container: { requestFullscreen: () => Promise.resolve() }
    });
    check("true", ctx.toggleFullscreen(VIDEO) === true);
    await tick();
    check("لا رسالة فشل", failures.length === 0, failures);
  }

  console.log("\n[6] الخروج من ملء الشاشة");
  {
    const okDoc = { fullscreenElement: {}, exitFullscreen: () => Promise.resolve() };
    const { ctx: c1, failures: f1 } = load({ doc: okDoc });
    check("خروج ناجح ⇒ true", c1.toggleFullscreen(VIDEO) === true);
    await tick();
    check("بلا رسالة", f1.length === 0, f1);

    const badDoc = { fullscreenElement: {}, exitFullscreen: () => Promise.reject(new Error("nope")) };
    const { ctx: c2, failures: f2 } = load({ doc: badDoc });
    check("رفض الخروج ⇒ true", c2.toggleFullscreen(VIDEO) === true);
    await tick();
    check("أُبلغ المستخدم", f2.some((t) => /الخروج من ملء الشاشة/.test(t)), f2);

    const noApi = { fullscreenElement: {} };
    const { ctx: c3 } = load({ doc: noApi });
    check("لا exitFullscreen ⇒ false", c3.toggleFullscreen(VIDEO) === false);
  }

  console.log("\n[7] بلا فيديو ⇒ false");
  {
    const { ctx } = load({ doc: {} });
    check("false", ctx.toggleFullscreen(null) === false);
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
