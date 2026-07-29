// البند #26 — service worker للهجرة، بأضيق نطاق.
//
// يشغّل background.js الحقيقي في vm مع importScripts حقيقي يحمّل storage.js
// الحقيقي، ثم يُطلق حدث onInstalled على متجر sync مزيّف يسجّل كل عملية.
// ما يحرسه: (أ) لا نسخة ثانية من الهجرة ولا مستمع ثانٍ، (ب) لا كتابة حين لا
// بيانات قديمة، (ج) المسار عبر الـ SW ومسار صفحة الإعدادات لا يتصادمان
// وأيّهما جاء ثانياً صمت.
const fs = require("fs");
const vm = require("vm");

// غير محروس بـ readFileSync مباشرة كي يفشل الفحص البنيوي **بعدّ** على الكود
// السابق (لا background.js فيه) بدل أن ينهار الاختبار قبل أن يقول شيئاً.
const SW_SRC = fs.existsSync("background.js") ? fs.readFileSync("background.js", "utf8") : "";
// فحوص «لا شيء سوى الهجرة» تجري على **الكود** لا على التعليقات: التعليق أعلى
// الملف يشرح لماذا لا يلمس التخزين بنفسه، فلا يصحّ أن يُسقط الفحص نفسه.
const SW_CODE = SW_SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const STORAGE_SRC = fs.readFileSync("storage.js", "utf8");
const OPTIONS_SRC = fs.readFileSync("options.js", "utf8");
const MANIFEST = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

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
    sets: () => log.filter(([op]) => op === "set").length,
    removes: () => log.filter(([op]) => op === "remove").length,
    api: {
      get(arg) {
        log.push(["get", arg]);
        if (arg === null) return Promise.resolve(JSON.parse(JSON.stringify(data)));
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
        Object.assign(data, JSON.parse(JSON.stringify(obj)));
        return Promise.resolve();
      },
      remove(k) { log.push(["remove", k]); delete data[k]; return Promise.resolve(); }
    }
  };
}

const quiet = { log() {}, warn() {}, error() {} };

// يحمّل background.js كما يحمّله كروم: importScripts أولاً في السياق نفسه.
function loadServiceWorker(store) {
  const installed = [];
  const anyListener = [];
  const ctx = {
    TextEncoder, console: quiet,
    chrome: {
      storage: { sync: store.api },
      runtime: {
        onInstalled: { addListener: (fn) => { installed.push(fn); anyListener.push("runtime.onInstalled"); } },
        onMessage: { addListener: () => anyListener.push("runtime.onMessage") },
        onStartup: { addListener: () => anyListener.push("runtime.onStartup") }
      },
      tabs: { onUpdated: { addListener: () => anyListener.push("tabs.onUpdated") } },
      action: { onClicked: { addListener: () => anyListener.push("action.onClicked") } }
    },
    importScripts: (...files) => {
      for (const f of files) vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
    }
  };
  vm.createContext(ctx);
  vm.runInContext(SW_SRC, ctx, { filename: "background.js" });
  return { ctx, installed, anyListener, fire: (reason) => installed[0]({ reason }) };
}

// مسار صفحة الإعدادات: storage.js ثم تشكيل ensureZoneActions في الذاكرة.
const OPTIONS_SLICE = slice("options.js", "let zonesWereMissing", "function rebuildWheelMap");
function loadOptionsPage(store) {
  const ctx = { TextEncoder, console: quiet, chrome: { storage: { sync: store.api } } };
  vm.createContext(ctx);
  vm.runInContext(STORAGE_SRC + "\n" + OPTIONS_SLICE, ctx);
  return ctx;
}

// المقارنة تتجاهل id: makeId يولّد معرّفاً عشوائياً لكل تشغيل، فمن يكتب أولاً
// يفوز به. ما يجب أن يتطابق هو المحتوى، وما يجب أن يُمنع هو الكتابة الثانية.
const stripIds = (v) => JSON.parse(JSON.stringify(v), (k, val) => (k === "id" ? undefined : val));
const same = (a, b) => JSON.stringify(stripIds(a)) === JSON.stringify(stripIds(b));

const LEGACY = {
  siteProfiles: {
    "twitch.tv": { enabled: true, mappings: [{ from: "Mouse2", to: "ACTION:TOGGLE_PLAY" }] }
  },
  settings: {
    blockedHosts: [],
    zones: {
      enabled: true, fullscreenOnly: false,
      wheel: {
        map: {
          "2": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] },
          "8": { up: ["ACTION:SEEK:+5"], down: ["ACTION:SEEK:-5"] }
        }
      }
    }
  }
};

// مستخدم على المخطط الحالي: شظايا sp: وتسعة مربعات كلها مصفوفات.
const CURRENT = {
  "sp:twitch.tv": { enabled: true, mappings: [{ from: "Mouse2", to: "ACTION:TOGGLE_PLAY" }] },
  settings: {
    blockedHosts: [],
    zones: {
      enabled: true, fullscreenOnly: false, gridCoverage: "player",
      wheel: {
        map: { "2": { up: ["ACTION:VOLUME:+4"] } },
        actions: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i + 1), []]))
      }
    }
  }
};

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`, extra ?? ""); }
};

(async () => {
  console.log("\n[0] background.js — مستمع واحد ولا شيء سوى الهجرة");
  {
    check("الملف موجود", fs.existsSync("background.js"));
    check("يحمّل storage.js بـ importScripts", /importScripts\(\s*["']storage\.js["']\s*\)/.test(SW_CODE));

    const listeners = SW_CODE.match(/addListener\(/g) || [];
    check("مستمع واحد فقط في الملف كله", listeners.length === 1, listeners.length);
    check("والمستمع هو chrome.runtime.onInstalled",
      /chrome\.runtime\.onInstalled\.addListener/.test(SW_CODE));

    // القرار 10: لا نقل أي منطق قائم، ولا نسخة ثانية من الهجرة.
    for (const fn of ["migrateSiteProfiles", "migrateZoneActionsInto", "parseRuntimeAction",
                      "safeSyncSet", "baseDomain"]) {
      check(`لا نسخة ثانية من ${fn}`, !new RegExp(`function\\s+${fn}\\s*\\(`).test(SW_CODE));
    }
    check("لا يقرأ ولا يكتب التخزين بنفسه", !/chrome\.storage/.test(SW_CODE));
    for (const api of ["chrome.tabs", "chrome.scripting", "chrome.action", "chrome.alarms"]) {
      check(`لا يلمس ${api}`, !SW_CODE.includes(api));
    }
    check("بلا setTimeout/setInterval", !/set(Timeout|Interval)\(/.test(SW_CODE));
    check("المستمع يُرجع الوعد ولا يبتلعه",
      /addListener\(\(details\) => migrateSchema\(/.test(SW_CODE));
  }

  console.log("\n[0b] manifest — service worker كلاسيكي (شرط importScripts)");
  {
    check("background.service_worker = background.js",
      MANIFEST.background?.service_worker === "background.js", MANIFEST.background);
    check("بلا \"type\": \"module\"", MANIFEST.background?.type === undefined, MANIFEST.background?.type);
    check("لا مفاتيح أخرى تحت background",
      Object.keys(MANIFEST.background || {}).join() === "service_worker", MANIFEST.background);
  }

  console.log("\n[0c] نسخة واحدة من التحويل — لا نسختان تتباعدان");
  {
    for (const fn of ["makeId", "normalizeActionArray", "parseRuntimeAction", "migrateZoneActionsInto"]) {
      const re = new RegExp(`function\\s+${fn}\\s*\\(`);
      check(`${fn} معرَّفة في storage.js`, re.test(STORAGE_SRC));
      check(`${fn} لم تعد معرَّفة في options.js`, !re.test(OPTIONS_SRC));
    }
    check("options.js تستدعي التحويل المشترك", /migrateZoneActionsInto\(settings\)/.test(OPTIONS_SRC));
    check("options.js تستدعي migrateAll لا migrateSiteProfiles وحدها",
      /await migrateAll\(\)/.test(OPTIONS_SRC));
  }

  if (!SW_SRC) {
    console.log("\n⛔ لا background.js — تُتخطّى الفحوص السلوكية");
    console.log(`\n❌ نجح ${pass} / فشل ${fail}\n`);
    process.exit(1);
  }

  console.log("\n[1] تثبيت جديد — تخزين فارغ ⇒ صفر كتابة");
  {
    const s = makeStore({});
    await loadServiceWorker(s).fire("install");
    check("صفر set", s.sets() === 0, s.log);
    check("صفر remove", s.removes() === 0, s.log);
    check("التخزين ما زال فارغاً", Object.keys(s.dump()).length === 0, s.dump());
  }

  console.log("\n[2] تحديث نسخة لمستخدم مهاجَر — لا يكرّر عملاً ولا يكتب");
  {
    const s = makeStore(CURRENT);
    const before = JSON.stringify(s.dump());
    await loadServiceWorker(s).fire("update");
    check("صفر set", s.sets() === 0, s.log);
    check("صفر remove", s.removes() === 0, s.log);
    check("قراءتان فقط (siteProfiles + settings)", s.log.length === 2, s.log);
    check("التخزين لم يتغيّر بايت-بايت", JSON.stringify(s.dump()) === before);
  }

  console.log("\n[3] بيانات قديمة — الهجرتان تقعان بلا فتح صفحة الإعدادات");
  {
    const s = makeStore(LEGACY);
    await loadServiceWorker(s).fire("update");
    const d = s.dump();
    check("أُنشئت شظية sp:twitch.tv", !!d["sp:twitch.tv"], Object.keys(d));
    check("حُذف المفتاح القديم siteProfiles", !("siteProfiles" in d), Object.keys(d));
    const actions = d.settings?.zones?.wheel?.actions;
    check("wheel.actions صار موجوداً", !!actions, d.settings?.zones?.wheel);
    check("تسعة مربعات", Object.keys(actions || {}).length === 9, actions);
    check("المربع 2 صار أمرَي صوت",
      actions?.["2"]?.length === 2 && actions["2"][0].type === "volume" && actions["2"][0].key === "up",
      actions?.["2"]);
    check("المربع 8 صار أمرَي تقديم",
      actions?.["8"]?.length === 2 && actions["8"][1].type === "seek" && actions["8"][1].key === "down",
      actions?.["8"]);
    check("المربع 5 بلا قديم ⇒ مصفوفة فارغة", Array.isArray(actions?.["5"]) && actions["5"].length === 0);
    check("wheel.map القديمة لم تُمسّ", !!d.settings.zones.wheel.map["2"]);
  }

  console.log("\n[4] الـ SW أولاً ثم صفحة الإعدادات ⇒ الثانية صامتة");
  {
    const s = makeStore(LEGACY);
    await loadServiceWorker(s).fire("update");
    const afterSW = JSON.stringify(s.dump());
    const writesSW = s.sets();

    await loadOptionsPage(s).migrateAll();
    check("صفحة الإعدادات لم تكتب شيئاً", s.sets() === writesSW, s.log.filter(([o]) => o === "set"));
    check("ولم تحذف شيئاً", s.removes() === 1, s.removes());   // حذف siteProfiles وقع مرة واحدة في الـ SW
    check("التخزين لم يتغيّر", JSON.stringify(s.dump()) === afterSW);
  }

  console.log("\n[5] صفحة الإعدادات أولاً ثم الـ SW ⇒ الثاني صامت والنتيجة نفسها");
  {
    const a = makeStore(LEGACY);
    await loadOptionsPage(a).migrateAll();
    const afterOptions = JSON.stringify(a.dump());
    const writesOptions = a.sets();
    await loadServiceWorker(a).fire("update");
    check("الـ SW لم يكتب شيئاً", a.sets() === writesOptions, a.log.filter(([o]) => o === "set"));
    check("التخزين لم يتغيّر", JSON.stringify(a.dump()) === afterOptions);

    const b = makeStore(LEGACY);
    await loadServiceWorker(b).fire("update");
    check("الترتيبان يعطيان النتيجة نفسها", same(a.dump(), b.dump()),
      JSON.stringify(stripIds(a.dump())) + "\n≠\n" + JSON.stringify(stripIds(b.dump())));
  }

  console.log("\n[6] تشغيل متزامن — يتقاربان ولا يفسدان البيانات");
  {
    const s = makeStore(LEGACY);
    const reference = makeStore(LEGACY);
    await loadServiceWorker(reference).fire("update");

    await Promise.all([
      loadServiceWorker(s).fire("update"),
      loadOptionsPage(s).migrateAll()
    ]);
    check("النتيجة مطابقة للتشغيل المنفرد", same(s.dump(), reference.dump()),
      JSON.stringify(stripIds(s.dump())));
    check("لا شظية ضائعة", !!s.dump()["sp:twitch.tv"]);
    check("لا بقايا للمفتاح القديم", !("siteProfiles" in s.dump()));
  }

  console.log("\n[7] ثلاثة تحديثات متتالية — الأول وحده يكتب");
  {
    const s = makeStore(LEGACY);
    await loadServiceWorker(s).fire("update");
    const first = s.sets();
    await loadServiceWorker(s).fire("update");
    await loadServiceWorker(s).fire("chrome_update");
    check("لا كتابة بعد الأولى", s.sets() === first, s.log.filter(([o]) => o === "set"));
    check("لا حذف بعد الأول", s.removes() === 1, s.removes());
  }

  console.log("\n[8] مسار المحرّر في الذاكرة يعطي ما يكتبه الـ SW حرفياً");
  {
    const s = makeStore(LEGACY);
    await loadServiceWorker(s).fire("update");
    const written = s.dump().settings.zones.wheel.actions;

    const ctx = loadOptionsPage(makeStore(LEGACY));
    const shaped = ctx.ensureZoneActions(JSON.parse(JSON.stringify(LEGACY.settings)));
    check("المحرّر والـ SW على المربعات نفسها",
      same(shaped.zones.wheel.actions, written), JSON.stringify(stripIds(shaped.zones.wheel.actions)));
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
