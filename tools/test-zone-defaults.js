// Audit #4 + #23: deleting a zone's actions must STICK.
// Extracts ensureZonesDefaults (content.js) and ensureZoneActions (options.js)
// and drives them against a fake chrome.storage.sync that records every write.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from);
  const b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from} من ${file}`);
  return t.slice(a, b);
}

function makeStore(initial) {
  let data = JSON.parse(JSON.stringify(initial));
  const log = [];
  return {
    log,
    dump: () => data,
    api: {
      get(arg) {
        log.push(["get"]);
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
      set(obj) { log.push(["set", Object.keys(obj)]); Object.assign(data, JSON.parse(JSON.stringify(obj))); return Promise.resolve(); },
      remove(k) { log.push(["remove", k]); delete data[k]; return Promise.resolve(); }
    }
  };
}

const CONTENT = slice("content.js", "const FIRST_RUN_ZONES", "async function loadBlockedHosts");
// التحويل نفسه انتقل إلى storage.js ليشاركه background.js (البند #26):
// makeId + normalizeActionArray + parseRuntimeAction + migrateZoneActionsInto.
const STORAGE = slice("storage.js", "function makeId", "// نسخة التخزين من التحويل");
// وبقي في options.js التشكيل في الذاكرة وحده.
const OPTIONS = slice("options.js", "let zonesWereMissing", "function rebuildWheelMap");

function load(store) {
  const ctx = {
    chrome: { storage: { sync: store.api } },
    structuredClone, console
  };
  vm.createContext(ctx);
  vm.runInContext(CONTENT + "\n" + STORAGE + "\n" + OPTIONS, ctx);
  return ctx;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`, extra ?? ""); }
};

(async () => {
  console.log("\n[1] البند #4 — ensureZonesDefaults لا يكتب إطلاقاً");
  {
    const s = makeStore({ settings: { zones: { enabled: true, wheel: { map: {}, actions: {} } } } });
    await load(s).ensureZonesDefaults();
    check("لا استدعاء set", !s.log.some(([op]) => op === "set"), s.log);
    check("لا استدعاء remove", !s.log.some(([op]) => op === "remove"));
  }

  console.log("\n[2] البند #4 — مربع محذوف لا يعود");
  {
    // المستخدم حذف أوامر المربع 6 من المحرر، فأزالها rebuildWheelMap من الخريطة
    const stored = { enabled: true, wheel: { map: { "4": { up: ["ACTION:VOLUME:+4"] } }, actions: { "6": [] } } };
    const s = makeStore({ settings: { zones: stored } });
    const out = await load(s).ensureZonesDefaults();
    check("المربع 6 ما زال محذوفاً", !("6" in out.wheel.map), out.wheel.map);
    check("المربع 7 لم يُبعث", !("7" in out.wheel.map), out.wheel.map);
    check("المربع 4 كما هو", !!out.wheel.map["4"]);
    check("لم يُكتب شيء للتخزين", !s.log.some(([op]) => op === "set"));
    check("التخزين لم يتغيّر", JSON.stringify(s.dump().settings.zones) === JSON.stringify(stored));
  }

  console.log("\n[3] تثبيت جديد — افتراضيات في الذاكرة بلا كتابة");
  {
    const s = makeStore({});
    const out = await load(s).ensureZonesDefaults();
    check("أُعيدت افتراضيات المربعات 4 و6 و7", !!(out.wheel.map["4"] && out.wheel.map["6"] && out.wheel.map["7"]), out);
    check("بصيغة مصفوفات مثل rebuildWheelMap", Array.isArray(out.wheel.map["6"].up), out.wheel.map["6"]);
    check("لم تُكتب للتخزين", !s.log.some(([op]) => op === "set"));
    check("التخزين ما زال فارغاً", !("settings" in s.dump()));
  }

  console.log("\n[4] كل مربعات فارغة عمداً تبقى فارغة");
  {
    const s = makeStore({ settings: { zones: { enabled: true, wheel: { map: {}, actions: {} } } } });
    const out = await load(s).ensureZonesDefaults();
    check("الخريطة ما زالت فارغة", Object.keys(out.wheel.map).length === 0, out.wheel.map);
  }

  console.log("\n[5] البند #23 — zonesWereMissing يميّز الغياب عن الفراغ");
  {
    const ctx = load(makeStore({}));
    // `let` لا يصير خاصية على الـ context، فنقرأه بتقييم داخل نفس السياق
    const flag = () => vm.runInContext("zonesWereMissing", ctx);

    ctx.ensureZoneActions({ zones: { enabled: true, wheel: { map: {}, actions: {} } } });
    check("zones موجودة وفارغة ⇒ لا بذر", flag() === false, flag());

    ctx.ensureZoneActions({});
    check("zones غائبة ⇒ بذر", flag() === true, flag());

    // كل الأكشنات فارغة لكن zones موجودة — الحالة التي كانت تُعيد البذر خطأً
    ctx.ensureZoneActions({ zones: { enabled: true, wheel: { map: {}, actions: { "1": [], "2": [] } } } });
    check("كل الأكشنات فارغة ⇒ لا بذر", flag() === false, flag());
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
