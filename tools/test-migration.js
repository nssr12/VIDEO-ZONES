// Verification harness for migrateSiteProfiles() with a fake chrome.storage.sync.
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(process.argv[2], "utf8");

function makeStore(initial, opts = {}) {
  let data = JSON.parse(JSON.stringify(initial));
  const log = [];
  return {
    log,
    dump: () => data,
    api: {
      get(arg) {
        log.push(["get", arg]);
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
        log.push(["set", Object.keys(obj)]);
        const k = Object.keys(obj)[0];
        if (opts.failOn && opts.failOn === k) return Promise.reject(new Error("quota"));
        if (opts.corruptOn && opts.corruptOn === k) { data[k] = { enabled: false, mappings: [] }; return Promise.resolve(); }
        Object.assign(data, JSON.parse(JSON.stringify(obj)));
        return Promise.resolve();
      },
      remove(k) { log.push(["remove", k]); delete data[k]; return Promise.resolve(); }
    }
  };
}

function load(store) {
  const ctx = { chrome: { storage: { sync: store.api } }, TextEncoder, console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`, extra ?? ""); }
};

(async () => {
  console.log("\n[1] هجرة عادية");
  {
    const s = makeStore({
      siteProfiles: { "youtube.com": { enabled: true, mappings: [{ from: "A", to: "B" }] }, "twitch.tv": { enabled: false, mappings: [] } },
      settings: { blockedHosts: [] }
    });
    const r = await load(s).migrateSiteProfiles();
    const d = s.dump();
    check("ok=true و migrated=2", r.ok && r.migrated === 2, r);
    check("أُنشئت sp:youtube.com", JSON.stringify(d["sp:youtube.com"]) === JSON.stringify({ enabled: true, mappings: [{ from: "A", to: "B" }] }));
    check("أُنشئت sp:twitch.tv", !!d["sp:twitch.tv"]);
    check("حُذف المفتاح القديم", !("siteProfiles" in d));
    check("settings لم يُمسّ", JSON.stringify(d.settings) === JSON.stringify({ blockedHosts: [] }));
  }

  console.log("\n[2] idempotent — تشغيل مرتين");
  {
    const s = makeStore({ siteProfiles: { "a.com": { enabled: true, mappings: [] } } });
    const m = load(s).migrateSiteProfiles;
    await m();
    const after1 = JSON.stringify(s.dump());
    const r2 = await m();
    check("الثاني no-op", r2.ok && r2.migrated === 0, r2);
    check("البيانات لم تتغيّر", JSON.stringify(s.dump()) === after1);
  }

  console.log("\n[3] إعادة تشغيل بعد نجاح جزئي");
  {
    const s = makeStore({
      siteProfiles: { "a.com": { enabled: true, mappings: [] }, "b.com": { enabled: true, mappings: [] } },
      "sp:a.com": { enabled: true, mappings: [] }   // شظية من تشغيل سابق
    });
    const r = await load(s).migrateSiteProfiles();
    const writes = s.log.filter(([op]) => op === "set").map(([, k]) => k[0]);
    check("لم يُعد كتابة sp:a.com", !writes.includes("sp:a.com"), writes);
    check("كتب sp:b.com", writes.includes("sp:b.com"), writes);
    check("اكتملت", r.ok && r.migrated === 2, r);
  }

  console.log("\n[4] فشل كتابة ⇒ لا حذف للقديم");
  {
    const s = makeStore({ siteProfiles: { "a.com": { enabled: true, mappings: [] }, "b.com": { enabled: true, mappings: [] } } }, { failOn: "sp:b.com" });
    const r = await load(s).migrateSiteProfiles();
    const d = s.dump();
    check("ok=false", !r.ok && r.reason === "write", r);
    check("القديم باقٍ مصدر الحقيقة", !!d.siteProfiles);
    check("لا استدعاء remove", !s.log.some(([op]) => op === "remove"));
  }

  console.log("\n[5] كتابة تمرّ لكن القراءة المرجعية تكشف تلفاً");
  {
    const s = makeStore({ siteProfiles: { "a.com": { enabled: true, mappings: [{ from: "X", to: "Y" }] } } }, { corruptOn: "sp:a.com" });
    const r = await load(s).migrateSiteProfiles();
    check("ok=false بسبب verify", !r.ok && r.reason === "verify", r);
    check("القديم باقٍ", !!s.dump().siteProfiles);
  }

  console.log("\n[6] لا مفتاح قديم أصلاً ⇒ قراءة واحدة فقط");
  {
    const s = makeStore({ "sp:a.com": { enabled: true, mappings: [] } });
    const r = await load(s).migrateSiteProfiles();
    check("no-op", r.ok && r.migrated === 0, r);
    check("قراءة واحدة بلا كتابة", s.log.length === 1 && s.log[0][0] === "get", s.log);
  }

  console.log("\n[7] مدخلات تالفة داخل القديم");
  {
    const s = makeStore({ siteProfiles: { "a.com": null, "b.com": "junk", "c.com": { enabled: true } } });
    const r = await load(s).migrateSiteProfiles();
    const d = s.dump();
    check("تجاهل التالف ونقل السليم", r.ok && r.migrated === 1, r);
    check("mappings صار مصفوفة", Array.isArray(d["sp:c.com"].mappings));
    check("لا شظايا للتالف", !("sp:a.com" in d) && !("sp:b.com" in d));
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
