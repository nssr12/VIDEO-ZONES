// Audit #10: a write that fails must never be reported as saved.
// Drives safeSyncSet()/syncErrorText() from storage.js against a fake sync store.
const fs = require("fs");
const vm = require("vm");
const SRC = fs.readFileSync("storage.js", "utf8");

function makeStore(initial, reject) {
  let data = JSON.parse(JSON.stringify(initial));
  return {
    dump: () => data,
    api: {
      get(arg) {
        if (arg === null) return Promise.resolve({ ...data });
        if (typeof arg === "string") return Promise.resolve(arg in data ? { [arg]: data[arg] } : {});
        if (Array.isArray(arg)) {
          const o = {};
          for (const k of arg) if (k in data) o[k] = data[k];
          return Promise.resolve(o);
        }
        const o = {};
        for (const [k, d] of Object.entries(arg)) o[k] = k in data ? data[k] : d;
        return Promise.resolve(o);
      },
      set(obj) {
        if (reject) return Promise.reject(new Error(reject));
        Object.assign(data, JSON.parse(JSON.stringify(obj)));
        return Promise.resolve();
      },
      remove() { return Promise.resolve(); }
    }
  };
}

function load(store) {
  const ctx = { chrome: { storage: { sync: store.api } }, TextEncoder, console, structuredClone };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}

let pass = 0, fail = 0;
const check = (n, c, x) => c ? (pass++, console.log("  ✅ " + n))
                             : (fail++, console.log("  ❌ " + n, x ?? ""));

(async () => {
  console.log("\n[1] كتابة سليمة");
  {
    const s = makeStore({});
    const r = await load(s).safeSyncSet({ settings: { a: 1 } });
    check("ok=true", r.ok === true, r);
    check("وصلت للتخزين فعلاً", JSON.stringify(s.dump().settings) === JSON.stringify({ a: 1 }));
  }

  console.log("\n[2] تجاوز حد العنصر الواحد (8KB) — يُرفض قبل الكتابة");
  {
    const s = makeStore({});
    const r = await load(s).safeSyncSet({ settings: { big: "x".repeat(9000) } });
    check("ok=false", r.ok === false, r);
    check("رسالة عربية عن حد العنصر", /8KB/.test(r.message), r.message);
    check("لم يُكتب شيء", !("settings" in s.dump()), s.dump());
  }

  console.log("\n[3] تجاوز الحد الكلي (100KB)");
  {
    // نملأ التخزين بمفاتيح صغيرة كثيرة تتجاوز مجموعها الحد
    const fillers = {};
    for (let i = 0; i < 20; i++) fillers["k" + i] = "y".repeat(6000);
    const s = makeStore(fillers);
    const r = await load(s).safeSyncSet({ settings: { a: "z".repeat(2000) } });
    check("ok=false", r.ok === false, r);
    check("رسالة عن المساحة الكلية", /100KB/.test(r.message), r.message);
  }

  console.log("\n[4] تجاوز عدد العناصر (512)");
  {
    const many = {};
    for (let i = 0; i < 512; i++) many["k" + i] = 1;
    const s = makeStore(many);
    const r = await load(s).safeSyncSet({ brandNewKey: 1 });
    check("ok=false", r.ok === false, r);
    check("رسالة عن عدد العناصر", /512/.test(r.message), r.message);
  }

  console.log("\n[5] رفض حقيقي من المتصفح يُترجم لعربية");
  {
    const cases = [
      ["QUOTA_BYTES_PER_ITEM quota exceeded", /8KB/],
      ["MAX_ITEMS quota exceeded", /512/],
      ["MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded", /عمليات الحفظ/],
      ["QUOTA_BYTES quota exceeded", /100KB/],
      ["Something odd happened", /Something odd/]
    ];
    for (const [raw, want] of cases) {
      const s = makeStore({}, raw);
      const r = await load(s).safeSyncSet({ settings: { a: 1 } });
      check(`"${raw.slice(0, 32)}…" → مترجَمة`, r.ok === false && want.test(r.message), r.message);
    }
  }

  console.log("\n[6] تحديث مفتاح موجود لا يُحتسب مرتين في المجموع");
  {
    const s = makeStore({ settings: "z".repeat(90000) });
    const r = await load(s).safeSyncSet({ settings: { small: 1 } });
    check("استبدال كبير بصغير ينجح", r.ok === true, r);
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
