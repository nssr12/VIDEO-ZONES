// Audit #13: startup did eleven separate chrome.storage.sync.get calls, nine of
// them fetching the same `settings` key, in EVERY frame at document_start.
// Startup now does one read and hands the result to every loader.
//
// The risk in that change is not the count, it is DRIFT: a loader that reads a key
// the shared read does not request, or that behaves differently when handed the
// object instead of fetching it. So every loader is run twice — once on its own
// and once with the shared object — and the resulting state must be IDENTICAL.
// Solo mode still has to work: RELOAD_* messages and storage.onChanged call these
// loaders with no argument long after startup.
const fs = require("fs");
const vm = require("vm");

const SRC = fs.readFileSync("content.js", "utf8");

if (!SRC.includes("function settingsRead(")) {
  console.log("  ❌ settingsRead غائبة — كتلة البدء ما زالت تقرأ لكل مُحمِّل على حدة (#13 غير منفَّذ)");
  process.exit(1);
}

// Extracts a whole function body by brace matching — the loaders are scattered
// across the file, so marker slicing would need a marker per loader.
function extract(name) {
  const head = SRC.indexOf(`function ${name}(`);
  if (head === -1) throw new Error(`لم يُعثر على ${name}`);
  const start = SRC.indexOf("{", SRC.indexOf(")", head));
  let depth = 0;
  for (let i = start; i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) {
      const from = SRC.lastIndexOf("async function", head) === head - 6 ? head - 6 : head;
      return SRC.slice(from, i + 1);
    }
  }
  throw new Error(`قوس غير مغلق في ${name}`);
}

const LOADERS = [
  { fn: "loadBlockedHosts",           state: ["blockedHosts"] },
  { fn: "loadOverlaySettings",        state: ["overlaySettings"] },
  { fn: "loadSoundDisplaySettings",   state: ["soundDisplaySettings"] },
  { fn: "loadGridAppearance",         state: ["gridAppearance"] },
  { fn: "loadSubtitleSettings",       state: ["subtitleSettings"] },
  { fn: "loadYtAutoQualitySettings",  state: ["ytAutoQuality"] },
  { fn: "loadYtShortsRedirectSetting", state: ["ytShortsRedirect", "blockedHosts"] },
  { fn: "loadCleanPlayerSettings",    state: ["cleanPlayerSettings", "blockedHosts"] },
  { fn: "loadRulesForThisHost",       state: ["siteRules"] },
  { fn: "loadSiteProfile",            state: ["siteProfile"] }
];

const SOURCE = [extract("settingsRead"), ...LOADERS.map((l) => extract(l.fn)), extract("ensureZonesDefaults")].join("\n\n");

// A populated store: defaults would hide a loader that reads the wrong key.
const HOST = "example.com";
const STORE = {
  settings: {
    blockedHosts: ["blocked.com"],
    overlay: { enabled: true, autoHideMs: 1234, volumeAutoHideMs: 777 },
    soundDisplay: { color: "#abcdef", fontSize: 33 },
    gridAppearance: { cellBorder: "#ff0000", numberOpacity: 0.5 },
    subtitles: { enabled: true, defaultLang: "AR", fontSize: 19, color: "#123456" },
    ytAutoQuality: "hd1080",
    ytShortsRedirect: false,
    cleanPlayer: { enabled: true, items: { ambient_mode: true } },
    zones: { enabled: true, wheel: { map: { "5": { up: ["ACTION:SEEK:+5"] } } } }
  },
  globalSiteRules: { enabled: true, mappings: [{ from: "Mouse2", to: "ACTION:TOGGLE_PLAY" }] },
  siteProfiles: { [HOST]: { enabled: true, mappings: [{ from: "Mouse3", to: "ACTION:TOGGLE_MUTE" }] } },
  [`sp:${HOST}`]: { enabled: true, mappings: [{ from: "Mouse1", to: "ACTION:TOGGLE_PIP" }] }
};

function makeCtx() {
  const reads = [];
  const ctx = {
    reads,
    chrome: {
      storage: {
        sync: {
          get(defaults) {
            const keys = Array.isArray(defaults) ? defaults
              : (typeof defaults === "string" ? [defaults] : Object.keys(defaults || {}));
            reads.push(keys);
            const out = {};
            for (const k of keys) {
              out[k] = k in STORE ? STORE[k] : (Array.isArray(defaults) ? undefined : defaults[k]);
            }
            return Promise.resolve(structuredClone(out));
          }
        }
      }
    },
    location: { host: HOST, hostname: HOST },
    baseDomain: () => HOST,
    spKeyFor: (h) => `sp:${h}`,
    // side effects the loaders trigger — not under test here
    buildMap: () => {}, buildSiteMap: () => {}, hideOverlayNow: () => {},
    applySubtitleStyles: () => {}, applySubtitleTrack: () => {}, applyCleanPlayerCSS: () => {},
    syncSubtitleTrackObserver: () => {}, // #21 — خارج نطاق هذا الاختبار
    applyGridVars: () => {}, resolveGridAppearance: (g) => ({ ...g }),
    // #71: قناة ثانية في الـoverlay ⇒ العالم يعلنها كذلك. **مرساةٌ لا تأكيد**
    // (قرار 33): غيابها يرفع ReferenceError في `loadSoundDisplaySettings`.
    structuredClone, vzOverlay: null, vzVolumeBadge: null, vzSpeedBadge: null,
    FIRST_RUN_ZONES: { enabled: true, wheel: { map: {} } },
    // module state the loaders write
    blockedHosts: [], overlaySettings: null, soundDisplaySettings: { color: "#ffffff", fontSize: 48 },
    gridAppearance: null, subtitleSettings: null, ytAutoQuality: "", ytShortsRedirect: true,
    cleanPlayerSettings: null, siteRules: null, siteProfile: null,
    console
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);
  return ctx;
}

// The exact keys startup asks for in one go — mirrors the startupRead literal.
const SHARED_KEYS = ["settings", "globalSiteRules", "siteProfiles", `sp:${HOST}`];
async function sharedRead() {
  const ctx = makeCtx();
  const obj = {};
  for (const k of SHARED_KEYS) obj[k] = k in STORE ? structuredClone(STORE[k]) : null;
  return obj;
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => cond
  ? (pass++, console.log("  ✅ " + name))
  : (fail++, console.log("  ❌ " + name, JSON.stringify(extra ?? "")));

(async () => {
  console.log("\n[1] كل مُحمِّل: القراءة المنفردة والقراءة المشتركة تُنتجان الحالة نفسها");
  for (const { fn, state } of LOADERS) {
    const solo = makeCtx();
    await vm.runInContext(`${fn}()`, solo);
    const soloState = state.map((k) => JSON.stringify(solo[k]));

    const shared = makeCtx();
    shared.__pre = await sharedRead();
    await vm.runInContext(`${fn}(__pre)`, shared);
    const sharedState = state.map((k) => JSON.stringify(shared[k]));

    check(`${fn}: الحالة متطابقة`, soloState.join("|") === sharedState.join("|"),
      { solo: soloState, shared: sharedState });
    check(`${fn}: المنفردة تقرأ مرة واحدة`, solo.reads.length === 1, solo.reads);
    check(`${fn}: المشتركة لا تقرأ إطلاقاً`, shared.reads.length === 0, shared.reads);
  }

  console.log("\n[2] ensureZonesDefaults يمرّر القراءة المشتركة ولا يقرأ من جديد");
  {
    const solo = makeCtx();
    const a = await vm.runInContext("ensureZonesDefaults()", solo);
    const shared = makeCtx();
    shared.__pre = await sharedRead();
    const b = await vm.runInContext("ensureZonesDefaults(__pre)", shared);
    check("المربعات نفسها", JSON.stringify(a) === JSON.stringify(b), { a, b });
    check("ولا قراءة إضافية", shared.reads.length === 0 && solo.reads.length === 1);
  }

  console.log("\n[3] القراءة المشتركة تغطّي كل مفتاح يطلبه أي مُحمِّل");
  {
    const wanted = new Set();
    for (const { fn } of LOADERS) {
      const ctx = makeCtx();
      await vm.runInContext(`${fn}()`, ctx);
      for (const keys of ctx.reads) for (const k of keys) wanted.add(k);
    }
    const missing = [...wanted].filter((k) => !SHARED_KEYS.includes(k));
    check(`لا مفتاح خارج القراءة المشتركة (المطلوب: ${[...wanted].join(", ")})`,
      missing.length === 0, missing);
    check("والقراءة المشتركة بلا مفاتيح زائدة",
      SHARED_KEYS.every((k) => wanted.has(k)), SHARED_KEYS.filter((k) => !wanted.has(k)));
  }

  console.log("\n[4] كائن واحد يمرّ على كل المُحمِّلات — لا تلوّث بينها");
  {
    // القراءة المنفردة كانت تُعطي كل مُحمِّل كائناً طازجاً؛ الآن يتشاركون كائناً
    // واحداً، فأي مُحمِّل يعدّله يفسد من بعده. هنا يمرّ الكائن على الجميع بالترتيب.
    const shared = makeCtx();
    shared.__pre = await sharedRead();
    for (const { fn } of LOADERS) await vm.runInContext(`${fn}(__pre)`, shared);
    await vm.runInContext("ensureZonesDefaults(__pre)", shared);

    let clean = true;
    const drift = [];
    for (const { fn, state } of LOADERS) {
      const solo = makeCtx();
      await vm.runInContext(`${fn}()`, solo);
      for (const k of state) {
        if (JSON.stringify(solo[k]) !== JSON.stringify(shared[k])) { clean = false; drift.push(`${fn}.${k}`); }
      }
    }
    check("حالة كل مُحمِّل كما لو قرأ وحده", clean, drift);
    check("ولا قراءة واحدة في المسار كله", shared.reads.length === 0, shared.reads);
  }

  console.log("\n[5] كتلة البدء تستهلك قراءة واحدة فقط");
  {
    // منذ #13ب انتقلت الكتلة داخل runStartupSteps، والقراءة تُنشأ عند البدء الفعلي
    const block = SRC.slice(SRC.indexOf("function runStartupSteps"), SRC.indexOf('startup("boostReapply"'));
    const calls = (block.match(/startupRead\(\)/g) || []).length;
    check("استدعاء قراءة واحد في كتلة البدء", calls === 1, calls);
    const gets = (SRC.match(/chrome\.storage\.sync\.get\(\{\s*\n\s*settings/g) || []).length;
    check("وتعريف واحد للقراءة المشتركة", gets === 1, gets);
    const steps = (block.match(/read\.then/g) || []).length;
    check(`وكل الخطوات القارئة تمرّ به (${steps} خطوة)`, steps >= 10, steps);
  }

  console.log(`\nالنتيجة: ${pass} ناجحة · ${fail} فاشلة`);
  process.exit(fail ? 1 : 0);
})();
