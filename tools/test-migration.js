// Verification harness for migrateSiteProfiles() with a fake chrome.storage.sync.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تنتقل إعداداتي القديمة سليمةً بعد تحديث الإضافة؟»*
//
// ⚠️ **المسار افتراضيّ عمداً — ولا يُعاد اشتراطه.** كان هذا الملف **وحده** في
// المجموعة يشترط معاملاً (`node tools/test-migration.js storage.js`)، فأي مشغّل
// يمرّ على `tools/test-*.js` بأمر واحد **يسقط عنده** بـ`ERR_INVALID_ARG_TYPE` —
// ومن يشغّل المجموعة بعد شهر **يقرأها فشلاً** لا اصطلاحاً. المعرفة التي تعيش في
// رأس من كتبها ليست معرفة (قرار المالك 2026-07-31).
// والمعامل يبقى مقبولاً لمن أراد فحص نسخة أخرى من الملف.
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync(process.argv[2] || "storage.js", "utf8");

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
function pairedBlock(file, name) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(`// ---- BEGIN ${name} ----`);
  const b = t.indexOf(`// ---- END ${name} ----`);
  return a === -1 || b === -1 ? null : t.slice(a, b);
}

(async () => {
  console.log("\n[0] النسختان المقترنتان متطابقتان حرفياً");
  {
    for (const name of ["baseDomain", "normalizeKeyCombo", "gridAppearance", "progressBarMode"]) {
      const a = pairedBlock("storage.js", name), b = pairedBlock("content.js", name);
      check(`${name}: العلامات موجودة في الملفين`, !!a && !!b);
      check(`${name}: النصّ متطابق حرفياً`, a === b, "انحراف بين storage.js و content.js");
    }
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
      ["WWW.BBC.CO.UK", "bbc.co.uk"],
      // المنطقة العربية والخليج
      ["stc.com.sa", "stc.com.sa"],
      ["sabb.com.sa", "sabb.com.sa"],
      ["sub.stc.com.sa", "stc.com.sa"],
      ["www.stc.com.sa", "stc.com.sa"],
      ["amazon.sa", "amazon.sa"],          // .sa لاحقة مفردة: يبقى كما هو
      ["ksu.edu.sa", "ksu.edu.sa"],
      ["moh.gov.sa", "moh.gov.sa"],
      ["etisalat.ae", "etisalat.ae"],      // .ae مفردة
      ["du.co.ae", "du.co.ae"],
      ["uaeu.ac.ae", "uaeu.ac.ae"],
      ["zain.com.kw", "zain.com.kw"],
      ["ooredoo.com.qa", "ooredoo.com.qa"],
      ["batelco.com.bh", "batelco.com.bh"],
      ["omantel.com.om", "omantel.com.om"],
      ["zain.com.jo", "zain.com.jo"],
      ["masrawy.com.eg", "masrawy.com.eg"],
      // بقية الخليج والمشرق وشمال أفريقيا
      ["ku.edu.kw", "ku.edu.kw"],
      ["moe.gov.kw", "moe.gov.kw"],
      ["qu.edu.qa", "qu.edu.qa"],
      ["moh.gov.qa", "moh.gov.qa"],
      ["uob.edu.bh", "uob.edu.bh"],
      ["squ.edu.om", "squ.edu.om"],
      ["taqnia.net.om", "taqnia.net.om"],
      ["sanaa.edu.ye", "sanaa.edu.ye"],
      ["ju.edu.jo", "ju.edu.jo"],
      ["aub.edu.lb", "aub.edu.lb"],
      ["damascus.edu.sy", "damascus.edu.sy"],
      ["uobaghdad.edu.iq", "uobaghdad.edu.iq"],
      ["birzeit.edu.ps", "birzeit.edu.ps"],
      ["cu.edu.eg", "cu.edu.eg"],
      ["uot.edu.ly", "uot.edu.ly"],
      ["utm.rnu.tn", "rnu.tn"],            // rnu.tn ليست في القائمة: لاحقة مفردة منطقياً
      ["ooredoo.com.tn", "ooredoo.com.tn"],
      ["usthb.edu.dz", "usthb.edu.dz"],
      ["um5.ac.ma", "um5.ac.ma"],
      ["maroctelecom.co.ma", "maroctelecom.co.ma"],
      ["uofk.edu.sd", "uofk.edu.sd"],
      ["mil.ae", "mil.ae"],                // اللاحقة وحدها: مقطعان
      ["etisalat.mil.ae", "etisalat.mil.ae"]
    ];
    for (const [input, want] of cases) {
      const got = baseDomain(input);
      check(`${input} → ${want}`, got === want, `حصلنا على ${got}`);
    }
    check("bbc.co.uk ≠ theguardian.co.uk", baseDomain("bbc.co.uk") !== baseDomain("theguardian.co.uk"));
    check("stc.com.sa ≠ sabb.com.sa", baseDomain("stc.com.sa") !== baseDomain("sabb.com.sa"));
    check("لا موقع سعودي يشتقّ com.sa", baseDomain("stc.com.sa") !== "com.sa" && baseDomain("sabb.com.sa") !== "com.sa");
  }

  console.log("\n[0c] شظايا سعودية منفصلة على بيانات حقيقية");
  {
    const s = makeStore({
      siteProfiles: {
        "stc.com.sa":  { enabled: true, mappings: [{ from: "ArrowRight", to: "ACTION:SEEK:+30" }] },
        "sabb.com.sa": { enabled: true, mappings: [{ from: "ArrowRight", to: "ACTION:SEEK:+5" }] },
        "amazon.sa":   { enabled: true, mappings: [{ from: "Ctrl+K", to: "ACTION:TOGGLE_MUTE" }] },
        "com.sa":      { enabled: true, mappings: [{ from: "ArrowLeft", to: "ACTION:SEEK:-10" }] }
      }
    });
    const r = await load(s).migrateSiteProfiles();
    const d = s.dump();
    check("sp:stc.com.sa مستقلة", d["sp:stc.com.sa"]?.mappings[0].to === "ACTION:SEEK:+30", d["sp:stc.com.sa"]);
    check("sp:sabb.com.sa مستقلة", d["sp:sabb.com.sa"]?.mappings[0].to === "ACTION:SEEK:+5", d["sp:sabb.com.sa"]);
    check("لم تُدمجا في قواعد واحدة", d["sp:stc.com.sa"].mappings[0].to !== d["sp:sabb.com.sa"].mappings[0].to);
    check("sp:amazon.sa كما هو", !!d["sp:amazon.sa"]);
    check("com.sa أُبلغ عنه كيتيم", r.ok && r.orphans.includes("com.sa"), r.orphans);
  }

  console.log("\n[0d] البند #11 — صيغة واحدة للمفاتيح مع احترام المُعدِّلات");
  {
    const { normalizeKeyCombo } = load(makeStore({}));
    const k = (key, mods = {}) => normalizeKeyCombo({
      key, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, shiftKey: !!mods.shift, metaKey: !!mods.meta
    });
    const cases = [
      [["ArrowRight"], "ArrowRight"],
      [["ArrowRight", { shift: true }], "Shift+ArrowRight"],   // كانت قاعدة ميتة
      [["ArrowRight", { ctrl: true }], "Ctrl+ArrowRight"],     // كانت تُختطف كـ ArrowRight
      [["ArrowLeft", { alt: true }], "Alt+ArrowLeft"],
      [["ArrowUp", { ctrl: true }], "Ctrl+ArrowUp"],
      [["k"], "K"],
      [["k", { ctrl: true }], "Ctrl+K"],
      [[" "], "Space"],
      [[" ", { shift: true }], "Shift+Space"],
      [["Escape"], "Esc"],
      [["F5"], "F5"],
      [["a", { ctrl: true, shift: true, alt: true, meta: true }], "Ctrl+Alt+Shift+Meta+A"]
    ];
    for (const [args, want] of cases) {
      const got = k(...args);
      check(`${args[0]}${args[1] ? " +مُعدِّلات" : ""} → ${want}`, got === want, `حصلنا على ${got}`);
    }
    check("المُعدِّل وحده ⇒ null", k("Shift") === null && k("Control") === null);
    check("الأسهم لم تعد تتجاهل المُعدِّلات", k("ArrowRight", { shift: true }) !== k("ArrowRight"));
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

  console.log("\n[8b] شظية موجودة بمحتوى مختلف لا تُطمس أبداً");
  {
    const live = { enabled: true, mappings: [{ from: "Ctrl+L", to: "ACTION:TOGGLE_PIP" }] };
    const s = makeStore({
      siteProfiles: {
        "amazon.sa": { enabled: true, mappings: [{ from: "ArrowUp", to: "ACTION:VOLUME:+4" }] },
        "other.com": { enabled: true, mappings: [{ from: "ArrowDown", to: "ACTION:VOLUME:-4" }] }
      },
      "sp:amazon.sa": live       // قاعدة حيّة كتبها الـ popup بعد الهجرة الجزئية
    });
    const r = await load(s).migrateSiteProfiles();
    const d = s.dump();
    check("الشظية الحيّة لم تتغيّر بايت-بايت", JSON.stringify(d["sp:amazon.sa"]) === JSON.stringify(live), d["sp:amazon.sa"]);
    check("أُدرجت في تقرير التعارضات", r.conflicts.includes("amazon.sa"), r.conflicts);
    check("النطاق غير المتعارض هاجر", !!d["sp:other.com"]);
    check("القديم بقي للمتعارض وحده", JSON.stringify(Object.keys(d.siteProfiles)) === JSON.stringify(["amazon.sa"]), d.siteProfiles);
    check("النسخة القديمة للمتعارض محفوظة", d.siteProfiles["amazon.sa"].mappings[0].from === "ArrowUp");
  }

  console.log("\n[8c] شظية مطابقة ⇒ تخطٍّ بلا تعارض");
  {
    const same = { enabled: true, mappings: [{ from: "A", to: "ACTION:TOGGLE_PLAY" }] };
    const s = makeStore({ siteProfiles: { "a.com": same }, "sp:a.com": same });
    const r = await load(s).migrateSiteProfiles();
    check("لا تعارض", r.ok && r.conflicts.length === 0, r);
    check("حُذف القديم", !("siteProfiles" in s.dump()));
    check("لا كتابة إطلاقاً", !s.log.some(([op]) => op === "set"), s.log);
  }

  console.log("\n[8d] شظية أكبر من حد العنصر تُرفض برسالة لا بصمت");
  {
    const s = makeStore({ siteProfiles: { "big.com": { enabled: true, mappings: [{ from: "A", to: "x".repeat(9000) }] } } });
    const r = await load(s).migrateSiteProfiles();
    check("ok=false", r.ok === false, r);
    check("رسالة عربية عن السبب", /8KB/.test(r.message || ""), r);
    check("القديم باقٍ مصدر الحقيقة", !!s.dump().siteProfiles);
    check("لم تُكتب شظية ناقصة", !("sp:big.com" in s.dump()), Object.keys(s.dump()));
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
