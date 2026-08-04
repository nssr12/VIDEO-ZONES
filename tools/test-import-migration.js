// البند #57 — الهجرة في مسار الاستيراد، بلا أي إعادة تحميل.
//
// ⭐ **السؤال الذي يجيبه (بلغة المستخدم):** *«هل تعمل إعداداتي المستوردة فوراً بلا أن أُعيد التحميل؟»*
//
// يقود `importAllSettings` الحقيقية من `options.js` (بمنطق `storage.js` نفسه)
// على مخزن مزيّف، ويشترط أن تكون الهجرة **قد وقعت كاملة قبل أن يعود النداء** —
// لا بأثر `location.reload()` كما كانت. ولذلك **لا يُشغَّل أي مؤجَّل هنا**:
// `setTimeout` يلتقط الدالة ولا يستدعيها، فإعادة التحميل **مستحيلة بالبناء** في
// هذا الملف، وما يظهر بعدها إنما وقع بلا إعادة تحميل.
//
// ويحرس معه رسالة الفشل بحالاتها الثلاث، **والأهمّ**: أن **أجزاء الهجرة تُقرأ
// من بنية `migrateAll` نفسها** لا من قائمة مكتوبة بجوارها — فجزء ثالث يُضاف
// بلا نصّه يُحمّر هذا الملف. وللحارس شاهدان (قرار 26): مصدر مُفتعَل بثلاثة
// أجزاء **يجب أن يُحمّره**، والمصدر الحقيقي **يجب أن يمرّ**.
const fs = require("fs");
const vm = require("vm");

function slice(file, from, to) {
  const t = fs.readFileSync(file, "utf8");
  const a = t.indexOf(from), b = t.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error(`تعذّر استخراج ${from} من ${file}`);
  return t.slice(a, b);
}

const STORAGE = fs.readFileSync("storage.js", "utf8");
const IMPORT = slice("options.js", "const BACKUP_VERSION", "function setupBackupUI");

// ── مخزن مزيّف ───────────────────────────────────────────────────────────────
// `failKeys` لا تُطبَّق إلا **بعد** كتابة الاستيراد الأولى، فيُفتعَل الفشل داخل
// الهجرة وحدها بدل أن يسقط الاستيراد نفسه قبل أن يبلغها.
function makeStore(initial = {}, failKeys = []) {
  let data = JSON.parse(JSON.stringify(initial));
  let writes = 0, removes = 0, clears = 0;
  let failing = failKeys.slice();
  const writeLog = [];
  return {
    dump: () => data,
    writeLog,
    migrationWrites: () => writeLog.slice(1),     // الأولى هي كتابة الاستيراد
    removes: () => removes,
    clears: () => clears,
    stopFailing: () => { failing = []; },
    api: {
      // ⚠️ نسخة عميقة عمداً: `chrome.storage.sync.get` يُرجع قيماً **منفصلة** عن
      // المخزن. ولو أرجع الرِكاز المرجع نفسه لصار تعديل الهجرة في الذاكرة
      // «مكتوباً» بلا كتابة، **فيُخفي نصف كتابة حقيقية** ويطبع أن الحالة آمنة
      // وهي ليست كذلك (قرار 26: رِكاز لا يرى لا يُصدَّق).
      get(arg) {
        const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
        if (arg === null || arg === undefined) return Promise.resolve(copy(data));
        if (typeof arg === "string") return Promise.resolve(arg in data ? { [arg]: copy(data[arg]) } : {});
        if (Array.isArray(arg)) {
          const o = {};
          for (const k of arg) if (k in data) o[k] = copy(data[k]);
          return Promise.resolve(o);
        }
        const o = {};
        for (const [k, d] of Object.entries(arg)) o[k] = k in data ? copy(data[k]) : d;
        return Promise.resolve(o);
      },
      set(obj) {
        const keys = Object.keys(obj);
        writes++;
        if (writes > 1 && failing.some((k) => keys.includes(k))) {
          return Promise.reject(new Error("QUOTA_BYTES quota exceeded"));
        }
        writeLog.push(keys.join("+"));
        Object.assign(data, JSON.parse(JSON.stringify(obj)));
        return Promise.resolve();
      },
      clear() { clears++; data = {}; return Promise.resolve(); },
      remove(keys) { removes++; for (const k of [].concat(keys)) delete data[k]; return Promise.resolve(); }
    }
  };
}

function load(store) {
  const statuses = [];
  const deferred = [];
  let reloads = 0;
  const ctx = {
    chrome: {
      storage: { sync: store.api },
      tabs: { query: () => Promise.resolve([]), sendMessage: () => Promise.resolve() }
    },
    TextEncoder, console, structuredClone,
    // لا يُشغَّل شيء مؤجَّل: إعادة التحميل تبقى في الكود ولا تقع في هذا الملف.
    setTimeout: (fn, ms) => { deferred.push([fn, ms]); return 0; },
    confirm: () => true,
    location: { reload() { reloads++; } },
    downloadJSON() {},
    setBackupStatus: (kind, text) => statuses.push([kind, text])
  };
  vm.createContext(ctx);
  vm.runInContext(STORAGE + "\n" + IMPORT, ctx);
  ctx.__statuses = statuses;
  ctx.__deferred = deferred;
  ctx.__reloads = () => reloads;
  // `const` في أعلى سكربت لا يصير خاصيّة على الكائن العام، فلا يُقرأ من `ctx`.
  // يُقرأ بتقييم داخل السياق نفسه — وإلا رأى الحارس سجلّ نصوص فارغاً **فمرّ
  // على كل شيء** وهو لا يرى شيئاً.
  ctx.__read = (expr) => vm.runInContext(`typeof ${expr} === "undefined" ? undefined : ${expr}`, ctx);
  return ctx;
}

const file = (obj) => ({ text: () => Promise.resolve(JSON.stringify(obj)) });

// ملفّ v1 واقعيّ: ثلاثة نطاقات + wheel.map — وهو الملفّ الذي قِيست عليه أرقام
// HANDOFF (٤ كتابات هجرة، ومفاتيحها).
const V1 = {
  __vizExport: true, version: 1,
  data: {
    siteProfiles: {
      "youtube.com": { enabled: true,  mappings: [{ from: "Mouse2", to: "ACTION:TOGGLE_PLAY" }] },
      "twitch.tv":   { enabled: false, mappings: [] },
      "vimeo.com":   { enabled: true,  mappings: [] }
    },
    settings: {
      blockedHosts: [],
      zones: {
        enabled: true, fullscreenOnly: false, gridCoverage: "player",
        wheel: { map: {
          "2": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] },
          "8": { up: ["ACTION:SEEK:+5"],   down: ["ACTION:SEEK:-5"] }
        } }
      }
    }
  }
};

const badText = (ctx) => (ctx.__statuses.find(([k]) => k === "bad") || [])[1] || "";
const fmtZone = (actions, z) =>
  (actions?.[z] || []).map((a) => `${a.type}${a.value ?? ""}@${a.key}`).join(" · ");

// ── قارئ أجزاء الهجرة من بنية migrateAll نفسها ───────────────────────────────
// لا قائمة أسماء هنا: تُقرأ مفاتيح الكائن الذي تُرجعه `migrateAll` عدا `ok`.
// قائمةٌ تُحدَّث بيد إنسان هي الموضع الذي يتباعد، فالعدّ من البنية لا من جوارها.
function balanced(text, marker) {
  const at = text.indexOf(marker);
  if (at === -1) throw new Error(`تعذّر العثور على ${marker}`);
  const open = text.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error(`قوس غير مغلق بعد ${marker}`);
}

function migrationParts(storageSrc) {
  const body = balanced(storageSrc, "async function migrateAll(");
  const at = body.lastIndexOf("return");
  if (at === -1) throw new Error("لا return في migrateAll");
  const literal = balanced(body.slice(at), "return");

  const segments = [];
  let depth = 0, buf = "";
  for (const ch of literal) {
    if ("{([".includes(ch)) depth++;
    else if ("})]".includes(ch)) depth--;
    if (ch === "," && depth === 0) { segments.push(buf); buf = ""; continue; }
    buf += ch;
  }
  segments.push(buf);

  return segments
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.includes(":") ? s.slice(0, s.indexOf(":")) : s).trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name) && name !== "ok");
}

// شاهد موجب للقارئ: مصدر مُفتعَل بثلاثة أجزاء — إن لم يره القارئ فهو أعمى،
// وحارسٌ أعمى يمرّ دائماً فلا يحرس شيئاً.
const FAKE_THREE_PARTS = `
async function migrateAll() {
  const profiles = await migrateSiteProfiles();
  const zones = await migrateZoneActions();
  const rules = await migrateSomethingNew();
  return { ok: profiles.ok !== false && zones.ok !== false && rules.ok !== false, profiles, zones, rules };
}`;

let pass = 0, fail = 0;
const check = (n, c, x) => c ? (pass++, console.log("  ✅ " + n))
                             : (fail++, console.log("  ❌ " + n, x ?? ""));

(async () => {
  console.log("\n[1] ملفّ v1 ⇒ الهجرة كاملة **قبل أي إعادة تحميل**");
  {
    const s = makeStore();
    const ctx = load(s);
    await ctx.importAllSettings(file(V1));

    const actions = s.dump().settings?.zones?.wheel?.actions;
    check("لا إعادة تحميل وقعت", ctx.__reloads() === 0, ctx.__reloads());
    check("wheel.actions موجودة في التخزين", !!actions, s.dump().settings?.zones?.wheel);
    check("المربعات التسعة كلها", actions && Object.keys(actions).length === 9,
      actions && Object.keys(actions).length);
    check("المربع 2 هاجر", fmtZone(actions, "2") === "volume+4@up · volume-4@down", fmtZone(actions, "2"));
    check("المربع 8 هاجر", fmtZone(actions, "8") === "seek+5@up · seek-5@down", fmtZone(actions, "8"));
    check("مربع بلا قديم صار مصفوفة فارغة", Array.isArray(actions?.["5"]) && actions["5"].length === 0, actions?.["5"]);
    check("wheel.map لم تُحذف", !!s.dump().settings?.zones?.wheel?.map, s.dump().settings?.zones?.wheel);

    check("الشظايا الثلاث كُتبت",
      !!s.dump()["sp:youtube.com"] && !!s.dump()["sp:twitch.tv"] && !!s.dump()["sp:vimeo.com"], Object.keys(s.dump()));
    check("siteProfiles حُذف بعد التحقّق", !("siteProfiles" in s.dump()), Object.keys(s.dump()));
    check("قواعد يوتيوب سليمة في شظيتها",
      s.dump()["sp:youtube.com"]?.mappings?.[0]?.to === "ACTION:TOGGLE_PLAY", s.dump()["sp:youtube.com"]);

    check("رسالة نجاح واحدة", ctx.__statuses.filter(([k]) => k === "ok").length === 1, ctx.__statuses);
    check("لا رسالة فشل", !ctx.__statuses.some(([k]) => k === "bad"), ctx.__statuses);

    // إعادة التحميل باقية تجميلاً للمحرّر لا شرطاً للصحّة (نطاق #57، البند 3).
    // ⚠️ فشل هذين التأكيدين يعني أن إعادة التحميل أُسقطت — وذاك **تغيير مستقلّ
    // مقصود**، فحدّث التأكيد. والصحّة أعلاه لا تعتمد عليها بحرف.
    check("إعادة التحميل ما زالت مجدولة", ctx.__deferred.length === 1, ctx.__deferred.length);
    check("والمجدول هو reload فعلاً",
      (() => { ctx.__deferred[0]?.[0]?.(); return ctx.__reloads() === 1; })(), ctx.__reloads());
  }

  console.log("\n[2] الأرقام المقيسة: ٤ كتابات هجرة بمفاتيحها · وتشغيلة ثانية صفر");
  {
    const s = makeStore();
    const ctx = load(s);
    await ctx.importAllSettings(file(V1));

    const w = s.migrationWrites();
    check("عدد كتابات الهجرة = 4", w.length === 4, w);
    check("مفاتيحها: الشظايا الثلاث + settings",
      JSON.stringify(w) === JSON.stringify(["sp:youtube.com", "sp:twitch.tv", "sp:vimeo.com", "settings"]), w);
    check("حذف واحد فقط (siteProfiles)", s.removes() === 1, s.removes());

    const before = s.migrationWrites().length;
    const again = await ctx.migrateAll();
    check("التشغيلة الثانية ok", again.ok === true, again);
    check("profiles.migrated = 0", again.profiles.migrated === 0, again.profiles);
    check("zones.migrated = 0", again.zones.migrated === 0, again.zones);
    check("صفر كتابة في التشغيلة الثانية", s.migrationWrites().length === before, s.migrationWrites());
  }

  console.log("\n[3] تخزين فارغ (تثبيت جديد) ⇒ صفر كتابة وصفر حذف");
  {
    const s = makeStore();
    const ctx = load(s);
    await ctx.importAllSettings(file({ __vizExport: true, version: 2, data: {} }));
    check("صفر كتابة هجرة", s.migrationWrites().length === 0, s.migrationWrites());
    check("صفر حذف", s.removes() === 0, s.removes());
    check("رسالة نجاح", ctx.__statuses.some(([k]) => k === "ok"), ctx.__statuses);
  }

  // ── رسالة الفشل: ثلاث حالات، كلٌّ تُسمّي ما فشل فعلاً ولا تقول «أحدهما» ──
  const ALONE_WORD = /(^|\s)أو(\s|$)/;   // «أوامر» ليست «أو» — الكلمة المستقلّة وحدها

  console.log("\n[4] فشل القواعد وحدها ⇒ تُسمّى وحدها");
  {
    const s = makeStore({}, ["sp:youtube.com"]);
    const ctx = load(s);
    await ctx.importAllSettings(file(V1));
    const msg = badText(ctx);
    check("رسالة فشل واحدة", ctx.__statuses.filter(([k]) => k === "bad").length === 1, ctx.__statuses);
    check("لا رسالة نجاح", !ctx.__statuses.some(([k]) => k === "ok"), ctx.__statuses);
    check("النصّ كما هو بلا تعميم",
      msg === "استُوردت الإعدادات لكن تعذّرت تجزئة قواعد المواقع — افتح الصفحة مجدداً", msg);
    check("لا تذكر المربّعات", !/المربّعات/.test(msg), msg);
    check("لا «أو»", !ALONE_WORD.test(msg), msg);
  }

  console.log("\n[5] فشل المربّعات وحدها ⇒ تُسمّى وحدها");
  {
    const s = makeStore({}, ["settings"]);
    const ctx = load(s);
    await ctx.importAllSettings(file(V1));
    const msg = badText(ctx);
    check("رسالة فشل واحدة", ctx.__statuses.filter(([k]) => k === "bad").length === 1, ctx.__statuses);
    check("النصّ يسمّي ترقية المربّعات",
      msg === "استُوردت الإعدادات لكن تعذّرت ترقية أوامر المربّعات — افتح الصفحة مجدداً", msg);
    check("لا تذكر تجزئة القواعد", !/تجزئة قواعد المواقع/.test(msg), msg);
    check("لا «أو»", !ALONE_WORD.test(msg), msg);
  }

  console.log("\n[6] الاثنان معاً ⇒ يُسمَّيان في رسالة واحدة");
  {
    const s = makeStore({}, ["sp:youtube.com", "settings"]);
    const ctx = load(s);
    await ctx.importAllSettings(file(V1));
    const msg = badText(ctx);
    check("رسالة واحدة لا رسالتان", ctx.__statuses.filter(([k]) => k === "bad").length === 1, ctx.__statuses);
    check("النصّ يجمع الاسمين",
      msg === "استُوردت الإعدادات لكن تعذّرت تجزئة قواعد المواقع وترقية أوامر المربّعات — افتح الصفحة مجدداً", msg);
    check("يذكر القواعد", /تجزئة قواعد المواقع/.test(msg), msg);
    check("يذكر المربّعات", /ترقية أوامر المربّعات/.test(msg), msg);
    check("لا «أو»", !ALONE_WORD.test(msg), msg);
  }

  console.log("\n[7] فشل في المنتصف ⇒ حالة آمنة قابلة لإعادة التشغيل");
  {
    const s = makeStore({}, ["settings"]);
    const ctx = load(s);
    await ctx.importAllSettings(file(V1));

    check("لا رسالة نجاح كاذبة", !ctx.__statuses.some(([k]) => k === "ok"), ctx.__statuses);
    check("actions لم تُكتب نصفَ كتابة", !s.dump().settings?.zones?.wheel?.actions, s.dump().settings?.zones?.wheel);
    check("wheel.map القديمة باقية (لا حذف لبيانات المستخدم)",
      !!s.dump().settings?.zones?.wheel?.map?.["2"], s.dump().settings?.zones?.wheel?.map);
    check("ما نجح من الشظايا بقي", !!s.dump()["sp:youtube.com"], Object.keys(s.dump()));

    s.stopFailing();
    const rerun = await ctx.migrateAll();
    check("إعادة التشغيل تنجح", rerun.ok === true, rerun);
    check("وتُبلّغ أن المربّعات هاجرت الآن", rerun.zones.migrated === 1, rerun.zones);
    check("actions ظهرت بعد الإعادة",
      Object.keys(s.dump().settings?.zones?.wheel?.actions || {}).length === 9,
      s.dump().settings?.zones?.wheel?.actions);
  }

  console.log("\n[8] الحارس البنيويّ: الأجزاء تُعدّ من بنية migrateAll نفسها");
  {
    const s = makeStore();
    const ctx = load(s);
    const parts = migrationParts(STORAGE);
    const texts = ctx.__read("MIGRATION_PART_TEXT") || {};
    const failureText = (r) => (typeof ctx.migrationFailureText === "function" ? ctx.migrationFailureText(r) : "");

    check("القارئ وجد أجزاء migrateAll", parts.length >= 2, parts);
    check("وهي profiles و zones", JSON.stringify(parts) === JSON.stringify(["profiles", "zones"]), parts);

    // ⚠️ فشل هذا التأكيد يعني أن جزء هجرة أُضيف إلى migrateAll بلا نصّ رسالته
    // في options.js — أضِف النصّ، لا تُعدّل التأكيد.
    check("لكل جزء نصّه في MIGRATION_PART_TEXT",
      parts.every((p) => typeof texts[p] === "string" && texts[p].length > 0), { parts, texts });
    check("ولا نصّ زائد لجزء لم يعد موجوداً",
      Object.keys(texts).length === parts.length, { parts, texts: Object.keys(texts) });

    for (const p of parts) {
      const only = failureText({ ok: false, [p]: { ok: false } });
      check(`رسالة «${p}» تسمّيه`, only.includes(texts[p] || " "), only);
      check(`ورسالة «${p}» لا تسمّي غيره`,
        parts.filter((q) => q !== p).every((q) => !only.includes(texts[q])), only);
    }

    // الرفض التامّ: لا نتيجة تعرف الجواب ⇒ لا يُخترع اسم لما لا نعلمه.
    const blind = failureText({ ok: false });
    check("رفضٌ تامّ ⇒ نصّ عامّ صادق لا اسم مخترَع",
      blind === "استُوردت الإعدادات لكن تعذّرت ترقية الإعدادات القديمة — افتح الصفحة مجدداً", blind);
    check("والعامّ لا يسمّي جزءاً بعينه",
      parts.every((p) => !blind.includes(texts[p] || " ")), blind);

    // الشاهدان (قرار 26): مُفتعَلٌ بثلاثة أجزاء **يجب أن يُحمّر**، والحقيقيّ يمرّ.
    const three = migrationParts(FAKE_THREE_PARTS);
    check("شاهد موجب: القارئ يرى الجزء الثالث",
      JSON.stringify(three) === JSON.stringify(["profiles", "zones", "rules"]), three);
    check("شاهد موجب: الحارس يُحمّر على جزء بلا نصّ",
      !three.every((p) => typeof texts[p] === "string"), three);
    check("شاهد سالب: الحارس يمرّ على البنية الحقيقية",
      parts.every((p) => typeof texts[p] === "string"), parts);
  }

  console.log(`\n${fail === 0 ? "✅" : "❌"} نجح ${pass} / فشل ${fail}\n`);
  process.exit(fail ? 1 : 0);
})();
