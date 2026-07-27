// Audit #10 on the most dangerous path: a failed import must SAY it failed and
// must leave storage exactly as it was. Drives the real importAllSettings from
// options.js against a fake sync store whose set() can be made to reject.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from}`);
  return t.slice(a, b);
}

const STORAGE = fs.readFileSync("storage.js", "utf8");
const IMPORT = slice("options.js", "const BACKUP_VERSION", "function setupBackupUI");

// rejectOn: "data" يرفض أول كتابة (الاستيراد) ويسمح بالثانية (الاستعادة)،
// و "all" يرفض كل كتابة فيفشل الاستيراد والاستعادة معاً.
function makeStore(initial, rejectOn) {
  let data = JSON.parse(JSON.stringify(initial));
  let cleared = 0;
  let writes = 0;
  return {
    dump: () => data,
    clears: () => cleared,
    api: {
      get(arg) {
        if (arg === null || arg === undefined) return Promise.resolve({ ...data });
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
        writes++;
        if (rejectOn === "all") return Promise.reject(new Error("QUOTA_BYTES quota exceeded"));
        if (rejectOn === "data" && writes === 1) return Promise.reject(new Error("QUOTA_BYTES quota exceeded"));
        Object.assign(data, JSON.parse(JSON.stringify(obj)));
        return Promise.resolve();
      },
      clear() { cleared++; data = {}; return Promise.resolve(); },
      remove(keys) { for (const k of [].concat(keys)) delete data[k]; return Promise.resolve(); }
    }
  };
}

function load(store, statuses) {
  const ctx = {
    chrome: { storage: { sync: store.api }, tabs: { query: () => Promise.resolve([]), sendMessage: () => Promise.resolve() } },
    TextEncoder, console, structuredClone, setTimeout,
    confirm: () => true,
    location: { reload() {} },
    downloadJSON() {},
    setBackupStatus: (kind, text) => statuses.push([kind, text])
  };
  vm.createContext(ctx);
  vm.runInContext(STORAGE + "\n" + IMPORT, ctx);
  return ctx;
}

const file = (obj) => ({ text: () => Promise.resolve(JSON.stringify(obj)) });
const GOOD = { __vizExport: true, version: 2, data: { settings: { blockedHosts: ["a.com"] } } };

let pass = 0, fail = 0;
const check = (n, c, x) => c ? (pass++, console.log("  ✅ " + n))
                             : (fail++, console.log("  ❌ " + n, x ?? ""));

(async () => {
  const ORIGINAL = { settings: { blockedHosts: ["mine.com"] }, "sp:amazon.sa": { enabled: true, mappings: [] } };

  console.log("\n[1] استيراد ناجح ⇒ رسالة نجاح واحدة");
  {
    const s = makeStore(ORIGINAL);
    const st = [];
    await load(s, st).importAllSettings(file(GOOD));
    check("رسالة ok", st.some(([k]) => k === "ok"), st);
    check("لا رسالة فشل", !st.some(([k]) => k === "bad"), st);
    check("البيانات الجديدة كُتبت", JSON.stringify(s.dump().settings.blockedHosts) === JSON.stringify(["a.com"]), s.dump());
  }

  console.log("\n[2] فشل الكتابة ⇒ رسالة فشل صريحة + استرجاع كامل");
  {
    const s = makeStore(ORIGINAL, "data");
    const st = [];
    await load(s, st).importAllSettings(file(GOOD));

    check("لا رسالة نجاح إطلاقاً", !st.some(([k]) => k === "ok"), st);
    check("رسالة فشل موجودة", st.some(([k]) => k === "bad"), st);
    const msg = (st.find(([k]) => k === "bad") || [])[1] || "";
    check("تذكر الفشل صراحةً", /فشل الاستيراد/.test(msg), msg);
    check("تذكر أن السابقة اُسترجعت", /أُعيدت إعداداتك السابقة/.test(msg), msg);
    check("تذكر السبب مترجَماً", /100KB/.test(msg), msg);
    check("التخزين عاد كما كان بالضبط",
      JSON.stringify(s.dump()) === JSON.stringify(ORIGINAL), s.dump());
    check("شظيتي الحقيقية سليمة", !!s.dump()["sp:amazon.sa"], s.dump());
  }

  console.log("\n[3] فشل الاستيراد وفشل الاستعادة ⇒ تحذير أشدّ");
  {
    const s = makeStore(ORIGINAL, "all");
    const st = [];
    await load(s, st).importAllSettings(file(GOOD));
    check("لا رسالة نجاح", !st.some(([k]) => k === "ok"), st);
    const msg = (st.find(([k]) => k === "bad") || [])[1] || "";
    check("تنبّه لتعذّر الاستعادة", /تعذّرت الاستعادة/.test(msg), msg);
  }

  console.log("\n[4] ملف تالف ⇒ رفض قبل لمس التخزين");
  {
    const s = makeStore(ORIGINAL);
    const st = [];
    await load(s, st).importAllSettings(file({ __vizExport: true, version: 2, data: { settings: "x" } }));
    check("رسالة فشل", st.some(([k]) => k === "bad"), st);
    check("لم يُمسح التخزين إطلاقاً", s.clears() === 0, s.clears());
    check("البيانات كما هي", JSON.stringify(s.dump()) === JSON.stringify(ORIGINAL));
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
