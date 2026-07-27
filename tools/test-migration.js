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

// The baseDomain block is duplicated verbatim in storage.js and content.js
// (a content script cannot load storage.js). Fail loudly if they drift.
function pairedBlock(file) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf("// ---- BEGIN baseDomain ----");
  const b = t.indexOf("// ---- END baseDomain ----");
  return a === -1 || b === -1 ? null : t.slice(a, b);
}

(async () => {
  console.log("\n[0] النسختان المقترنتان متطابقتان حرفياً");
  {
    const a = pairedBlock("storage.js"), b = pairedBlock("content.js");
    check("العلامات موجودة في الملفين", !!a && !!b);
    check("النصّ متطابق حرفياً", a === b, a && b ? "انحراف بين storage.js و content.js" : "");
  }

  console.log("\n[0b] baseDomain — اللواحق المركّبة");
  {
    const { baseDomain } = load(makeStore({}));
    const cases = [
      ["www.bbc.co.uk", "bbc.co.uk"],
      ["theguardian.co.uk", "theguardian.co.uk"],
      ["news.bbc.co.uk", "bbc.co.uk"],
      ["a.b.news.bbc.co.uk", "bbc.co.uk"],
      ["example.com.au", "example.com.au"],
      ["shop.example.com.au", "example.com.au"],
      ["asahi.co.jp", "asahi.co.jp"],
      ["globo.com.br", "globo.com.br"],
      ["m.youtube.com", "youtube.com"],
      ["www.youtube.com", "youtube.com"],
      ["music.youtube.com", "youtube.com"],
      ["youtube.com", "youtube.com"],
      ["localhost", "localhost"],
      ["localhost:3000", "localhost:3000"],
      ["example.com:8080", "example.com:8080"],
      ["news.bbc.co.uk:8080", "bbc.co.uk:8080"],
      ["192.168.1.5", "192.168.1.5"],
      ["192.168.1.5:8080", "192.168.1.5:8080"],
      ["WWW.BBC.CO.UK", "bbc.co.uk"]
    ];
    for (const [input, want] of cases) {
      const got = baseDomain(input);
      check(`${input} → ${want}`, got === want, `حصلنا على ${got}`);
    }
    check("bbc.co.uk ≠ theguardian.co.uk", baseDomain("bbc.co.uk") !== baseDomain("theguardian.co.uk"));
  }

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

  console.log("\n[8] شظايا منفصلة للواحق المركّبة");
  {
    const s = makeStore({
      siteProfiles: {
        "bbc.co.uk":         { enabled: true,  mappings: [{ from: "A", to: "1" }] },
        "theguardian.co.uk": { enabled: true,  mappings: [{ from: "B", to: "2" }] },
        "example.com.au":    { enabled: false, mappings: [{ from: "C", to: "3" }] },
        "example.com:8080":  { enabled: true,  mappings: [{ from: "D", to: "4" }] },
        "news.bbc.co.uk":    { enabled: true,  mappings: [{ from: "E", to: "5" }] }
      }
    });
    const r = await load(s).migrateSiteProfiles();
    const d = s.dump();
    check("bbc.co.uk شظية مستقلة", d["sp:bbc.co.uk"]?.mappings[0].from === "E" || d["sp:bbc.co.uk"]?.mappings[0].from === "A", Object.keys(d));
    check("theguardian.co.uk شظية مستقلة", !!d["sp:theguardian.co.uk"]);
    check("لم تُدمجا في sp:co.uk", !("sp:co.uk" in d), Object.keys(d));
    check("example.com.au شظية مستقلة", !!d["sp:example.com.au"]);
    check("المنفذ محفوظ في المفتاح", !!d["sp:example.com:8080"], Object.keys(d));
    check("النطاق الثالث انطوى تحت bbc.co.uk", !("sp:news.bbc.co.uk" in d), Object.keys(d));
    check("اكتملت بلا يتامى", r.ok && r.orphans.length === 0, r);
  }

  console.log("\n[9] مفتاح قديم مكسور (لاحقة عامة) يُبلَّغ عنه ولا يُحذف");
  {
    const s = makeStore({ siteProfiles: { "co.uk": { enabled: true, mappings: [{ from: "A", to: "1" }] } } });
    const r = await load(s).migrateSiteProfiles();
    check("نُقل ولم يُفقد", !!s.dump()["sp:co.uk"]);
    check("أُبلغ عنه كيتيم", r.ok && r.orphans.includes("co.uk"), r);
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
