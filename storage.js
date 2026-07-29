// Shared chrome.storage.sync helpers for popup.js and options.js.
// Loaded as a plain script before them, so these are plain globals.
//
// siteProfiles used to be ONE object holding every domain, which meant a handful
// of per-site rules could push the whole thing past the 8KB per-item quota and
// take every other domain down with it. It is now sharded: one "sp:<baseDomain>"
// key per domain. content.js therefore reads only the single profile it needs
// instead of the full set (audit item #13), and a write touches one domain.
//
// content.js keeps its own two-line copy of spKey() — it is a content script and
// cannot share this file without adding it to the manifest for every frame.

// ⚠️ PAIRED COPY — the block between the BEGIN/END markers below is duplicated
// verbatim in content.js. A content script cannot load storage.js without
// injecting it into every frame, so the two copies must be edited TOGETHER,
// never one alone. tools/test-migration.js fails the build if they drift apart.
//
// Every site identity in the extension comes from here: the "sp:<domain>" shard
// keys, blockedHosts entries, and isBlockedHost(). One derivation, one source.
// ---- BEGIN baseDomain ----
// Multi-label public suffixes. Not the full Public Suffix List (~9000 entries,
// unbundlable without a build step) but the registrar suffixes users actually
// hit. Without this, "bbc.co.uk" collapses to "co.uk", so blocking one British
// site blocks every British site and their per-site rules all share one key.
const MULTI_LABEL_SUFFIXES = new Set([
  "co.uk","org.uk","me.uk","ltd.uk","plc.uk","net.uk","sch.uk","ac.uk","gov.uk","nhs.uk","police.uk","mod.uk",
  "com.au","net.au","org.au","edu.au","gov.au","asn.au","id.au",
  "co.nz","net.nz","org.nz","govt.nz","ac.nz","school.nz",
  "co.jp","ne.jp","or.jp","ac.jp","go.jp","ad.jp","ed.jp","gr.jp","lg.jp",
  "co.kr","ne.kr","or.kr","re.kr","pe.kr","go.kr","ac.kr",
  "com.cn","net.cn","org.cn","gov.cn","edu.cn","ac.cn",
  "com.hk","net.hk","org.hk","edu.hk","gov.hk","idv.hk",
  "com.tw","net.tw","org.tw","edu.tw","gov.tw","idv.tw",
  "com.sg","net.sg","org.sg","edu.sg","gov.sg",
  "co.in","net.in","org.in","firm.in","gen.in","ind.in","ac.in","edu.in","gov.in","res.in",
  "com.br","net.br","org.br","gov.br","edu.br","art.br","blog.br",
  "com.mx","org.mx","net.mx","edu.mx","gob.mx",
  "com.ar","net.ar","org.ar","gov.ar","edu.ar",
  "com.co","net.co","org.co","edu.co","gov.co",
  "co.at","or.at","ac.at","gv.at",
  "com.es","org.es","gob.es","edu.es","nom.es",
  "com.pl","net.pl","org.pl","edu.pl","gov.pl",
  "com.pt","org.pt","edu.pt","gov.pt",
  "com.tr","net.tr","org.tr","gov.tr","edu.tr","bel.tr","k12.tr",
  "com.ua","net.ua","org.ua","gov.ua","edu.ua",
  "com.ru","net.ru","org.ru","edu.ru","gov.ru",
  "co.il","org.il","net.il","ac.il","gov.il","k12.il",
  "co.za","net.za","org.za","gov.za","ac.za","web.za",
  "com.sa","net.sa","org.sa","edu.sa","gov.sa","med.sa","pub.sa","sch.sa",
  "co.ae","net.ae","org.ae","gov.ae","ac.ae","sch.ae","mil.ae",
  "com.kw","net.kw","org.kw","edu.kw","gov.kw","ind.kw","emb.kw",
  "com.qa","net.qa","org.qa","edu.qa","gov.qa","sch.qa","mil.qa","name.qa",
  "com.bh","net.bh","org.bh","edu.bh","gov.bh",
  "com.om","co.om","net.om","org.om","edu.om","gov.om","ac.om","sch.om","med.om","pro.om",
  "com.ye","net.ye","org.ye","edu.ye","gov.ye","mil.ye","co.ye","ltd.ye","me.ye","plc.ye",
  "com.jo","net.jo","org.jo","edu.jo","gov.jo","sch.jo","mil.jo","name.jo",
  "com.lb","net.lb","org.lb","edu.lb","gov.lb",
  "com.sy","net.sy","org.sy","edu.sy","gov.sy","mil.sy","news.sy",
  "com.iq","net.iq","org.iq","edu.iq","gov.iq","mil.iq",
  "com.ps","net.ps","org.ps","edu.ps","gov.ps","plo.ps","sec.ps",
  "com.eg","net.eg","org.eg","edu.eg","gov.eg","sci.eg","mil.eg",
  "com.ly","net.ly","org.ly","edu.ly","gov.ly","sch.ly","med.ly","id.ly","plc.ly",
  "com.tn","net.tn","org.tn","edu.tn","gov.tn","ens.tn","fin.tn","ind.tn","info.tn","intl.tn","nat.tn","perso.tn","tourism.tn",
  "com.dz","net.dz","org.dz","edu.dz","gov.dz","asso.dz","pol.dz","art.dz","soc.dz","tm.dz",
  "co.ma","net.ma","org.ma","gov.ma","ac.ma","press.ma",
  "com.sd","net.sd","org.sd","edu.sd","gov.sd","med.sd","tv.sd","info.sd",
  "com.ng","net.ng","org.ng","edu.ng","gov.ng",
  "com.pk","net.pk","org.pk","edu.pk","gov.pk",
  "com.my","net.my","org.my","edu.my","gov.my",
  "co.id","net.id","or.id","ac.id","go.id","web.id",
  "com.ph","net.ph","org.ph","edu.ph","gov.ph",
  "com.vn","net.vn","org.vn","edu.vn","gov.vn",
  "co.th","in.th","ac.th","go.th","or.th",
  "com.bd","net.bd","org.bd","edu.bd","gov.bd"
]);

function normalizeHost(host) {
  return String(host || "").replace(/^www\./i, "").replace(/^m\./i, "");
}

// Input is always location.host (or a URL's .host), so it may carry a port.
// The port is preserved so example.com:3000 stays a distinct site, but it is
// stripped before suffix matching or "co.uk:8080" would never match the list.
function baseDomain(host) {
  const raw = normalizeHost(host).toLowerCase();
  if (raw.startsWith("[")) return raw;              // IPv6 literal
  const colon = raw.indexOf(":");
  const port = colon === -1 ? "" : raw.slice(colon);
  const name = colon === -1 ? raw : raw.slice(0, colon);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return name + port; // IPv4 literal
  const parts = name.split(".");
  if (parts.length <= 2) return name + port;
  const lastTwo = parts.slice(-2).join(".");
  const base = MULTI_LABEL_SUFFIXES.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
  return base + port;
}
// ---- END baseDomain ----

// One derivation of "is this host blocked", shared by every caller that has the host
// and the list in hand. content.js keeps its own copy because a content script cannot
// load this file — that pair is already guarded by tools/test-migration.js. What must
// never exist is a THIRD derivation inside popup.js (audit #56, and the lesson of #5).
function isHostBlocked(host, blockedHosts) {
  if (!host || !Array.isArray(blockedHosts)) return false;
  return blockedHosts.includes(baseDomain(host));
}


// ⚠️ PAIRED COPY — duplicated verbatim in content.js. Edit both together;
// tools/test-migration.js fails if they drift apart.
// ---- BEGIN normalizeKeyCombo ----
// ONE key-signature format for the whole extension. content.js matches against
// exactly what popup.js and options.js record, so any divergence here silently
// kills rules. The old content.js returned bare "ArrowRight"/"ArrowLeft" and
// dropped every modifier: a shortcut captured as "Shift+ArrowRight" could never
// fire, and "Ctrl+ArrowRight" hijacked the site's own shortcut (audit #11).
function normalizeKeyCombo(e) {
  let k = e.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(k)) return null; // modifier alone
  if (k === " ") k = "Space";
  if (k === "Escape") k = "Esc";

  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join("+");
}
// ---- END normalizeKeyCombo ----

// ⚠️ PAIRED COPY — duplicated verbatim in content.js. Edit both together;
// tools/test-migration.js fails if they drift apart.
// ---- BEGIN gridAppearance ----
// The exact look the in-video overlay had BEFORE Grid Appearance was wired up.
// options.js must share these: it used to auto-fill a different set (opaque
// #10131a) merely by being opened, which — once the setting actually reached the
// overlay — turned the grid into a solid wall nobody had chosen.
//
// Colours are stored separately from their opacity because <input type="color">
// cannot express alpha. Without that split, touching any colour field once made
// the grid opaque with no way back from the UI.
const GRID_APPEARANCE_DEFAULTS = Object.freeze({
  cellBg: "#000000",
  cellBgOpacity: 0,          // شفاف تماماً: لا خلفية إطلاقاً، كما كان
  cellBorder: "#ffffff",
  cellBorderOpacity: 0.32,   // نفس rgba(255,255,255,.32) القديمة
  numberColor: "#ffffff",
  numberOpacity: 1,          // الأرقام ظاهرة كما هي؛ 0 يخفيها من الـ DOM أصلاً
  radius: 0
});

// ── استدلالية الهجرة ─────────────────────────────────────────────────────────
// هذه القيم الأربع هي ما كانت options.js تكتبها في التخزين بمجرد **فتح** الصفحة،
// قبل أن يلمس المستخدم أي حقل. فوجود أيٍّ منها مخزَّناً ليس دليل اختيار، ولذلك
// نعامله كأنه غير مضبوط ونعيده لمظهر الـ overlay الأصلي.
//
// ⚠️ هذا استدلال لا يقين: مستخدم اختار #10131a عمداً — وهو لون داكن معقول —
// سيُعامَل خطأً كأنه تعبئة تلقائية، فيرى شبكته شفافة بدل لونه. الأثر مقبول
// لسببين: النتيجة هي المظهر الأصلي المألوف لا مظهراً غريباً، وإعادة ضبطه من
// اللوحة تستغرق ثانيتين. البديل — احترام القيمة حرفياً — كان سيُبقي الجدار
// المعتم على كل من فتح صفحة الإعدادات ولو مرة واحدة دون أن يختار شيئاً، وهو
// العطب نفسه الذي يعالجه هذا الكود.
//
// الاستدلال يُطبَّق على الألوان الثلاثة فقط. أما radius فلا يُعاد إلا حين يكون
// الكائن كله تعبئة تلقائية (isLegacyGridAutofill)، لأن 12px اختيار معقول
// وأثره تجميلي بحت لا يحجب الفيديو.
const GRID_APPEARANCE_LEGACY = Object.freeze({
  cellBg: "#10131a", cellBorder: "#2a2f3a", numberColor: "#a3a3a3", radius: 12
});

// alpha 0 → "transparent", never "rgba(r,g,b,0)": the keyword is what the overlay
// used originally, and it keeps the computed style honest for anyone inspecting it.
function rgbaFrom(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  const a = Math.max(0, Math.min(1, Number(alpha)));
  if (!m || !(a > 0)) return "transparent";
  const n = parseInt(m[1], 16);
  return a >= 1
    ? `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`
    : `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// True when every field present matches what options.js auto-filled — i.e. the
// user opened the page once and changed nothing.
function isLegacyGridAutofill(g) {
  if (!g || typeof g !== "object") return false;
  const keys = Object.keys(GRID_APPEARANCE_LEGACY);
  if (!keys.some((k) => g[k] !== undefined)) return false;
  return keys.every((k) =>
    g[k] === undefined || String(g[k]).toLowerCase() === String(GRID_APPEARANCE_LEGACY[k]).toLowerCase());
}

// Resolves stored settings into a complete appearance, migrating anything saved
// before the opacity sliders existed: a colour that differs from the auto-fill was
// chosen on purpose and keeps full opacity, everything else returns to the
// original overlay look.
function resolveGridAppearance(stored) {
  const g = isLegacyGridAutofill(stored) ? null
          : (stored && typeof stored === "object" ? stored : null);

  const colour = (key) => {
    const v = g?.[key];
    if (typeof v !== "string" || !v) return GRID_APPEARANCE_DEFAULTS[key];
    const legacy = String(GRID_APPEARANCE_LEGACY[key] || "").toLowerCase();
    return v.toLowerCase() === legacy ? GRID_APPEARANCE_DEFAULTS[key] : v;
  };
  const opacity = (colourKey, opacityKey) => {
    const saved = Number(g?.[opacityKey]);
    if (Number.isFinite(saved)) return Math.max(0, Math.min(1, saved));
    const c = g?.[colourKey];
    const deliberate = typeof c === "string" && c &&
      c.toLowerCase() !== String(GRID_APPEARANCE_LEGACY[colourKey]).toLowerCase();
    return deliberate ? 1 : GRID_APPEARANCE_DEFAULTS[opacityKey];
  };

  const radius = Number(g?.radius);
  return {
    cellBg: colour("cellBg"),
    cellBgOpacity: opacity("cellBg", "cellBgOpacity"),
    cellBorder: colour("cellBorder"),
    cellBorderOpacity: opacity("cellBorder", "cellBorderOpacity"),
    numberColor: colour("numberColor"),
    numberOpacity: opacity("numberColor", "numberOpacity"),
    radius: Number.isFinite(radius) ? radius : GRID_APPEARANCE_DEFAULTS.radius
  };
}
// ---- END gridAppearance ----

const SP_PREFIX = "sp:";
const SYNC_ITEM_LIMIT = 8192;    // chrome.storage.sync.QUOTA_BYTES_PER_ITEM
const SYNC_TOTAL_LIMIT = 102400; // chrome.storage.sync.QUOTA_BYTES
const SYNC_MAX_ITEMS = 512;      // chrome.storage.sync.MAX_ITEMS

function spKey(host) { return SP_PREFIX + host; }
function isSpKey(key) { return typeof key === "string" && key.startsWith(SP_PREFIX); }
function spHost(key) { return key.slice(SP_PREFIX.length); }

// Chrome bills an item as its key length plus the JSON stringification of its value.
function itemBytes(key, value) {
  return new TextEncoder().encode(key + JSON.stringify(value)).length;
}

const SYNC_LIMIT_TEXT = {
  item:  "حجم هذا العنصر تجاوز الحد الأقصى للعنصر الواحد (8KB)",
  total: "مساحة التخزين المتزامن امتلأت (100KB) — احذف بعض القواعد أو المواقع",
  items: "عدد عناصر التخزين المتزامن بلغ الحد الأقصى (512 عنصراً)"
};

// Checks a pending write against all three sync quotas at once.
// → null when it fits, otherwise "item" | "total" | "items".
async function syncWriteGuard(key, value) {
  if (itemBytes(key, value) > SYNC_ITEM_LIMIT) return "item";
  const all = await chrome.storage.sync.get(null);
  const had = Object.prototype.hasOwnProperty.call(all, key);
  if (!had && Object.keys(all).length + 1 > SYNC_MAX_ITEMS) return "items";
  let total = itemBytes(key, value);
  for (const [k, v] of Object.entries(all)) if (k !== key) total += itemBytes(k, v);
  return total > SYNC_TOTAL_LIMIT ? "total" : null;
}

// Turns a rejected chrome.storage.sync write into an Arabic sentence naming the
// actual cause, instead of leaking a raw English quota string to the user.
function syncErrorText(err) {
  const raw = String(err?.message || err || "");
  if (/QUOTA_BYTES_PER_ITEM/i.test(raw)) return SYNC_LIMIT_TEXT.item;
  if (/MAX_ITEMS/i.test(raw)) return SYNC_LIMIT_TEXT.items;
  if (/MAX_WRITE_OPERATIONS/i.test(raw)) {
    return "تجاوزت عدد عمليات الحفظ المسموحة — انتظر دقيقة ثم أعد المحاولة";
  }
  if (/QUOTA_BYTES|quota/i.test(raw)) return SYNC_LIMIT_TEXT.total;
  return raw || "خطأ غير معروف أثناء الحفظ";
}

// The ONLY way anything should write to chrome.storage.sync: pre-checks the
// quotas with syncWriteGuard, then catches a genuine rejection. Callers must
// wait for { ok: true } before telling the user anything was saved (audit #10) —
// previously every write was unguarded and a full quota failed silently behind
// a "تم الحفظ ✅" message.
async function safeSyncSet(items) {
  for (const [key, value] of Object.entries(items)) {
    const limit = await syncWriteGuard(key, value);
    if (limit) return { ok: false, message: SYNC_LIMIT_TEXT[limit] };
  }
  try {
    await chrome.storage.sync.set(items);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: syncErrorText(err) };
  }
}

// Legacy { siteProfiles: { host: profile } } → one "sp:<host>" key each.
//
// Idempotent by construction: a shard identical to what we would write is left
// alone, and once the legacy key is gone the whole function is a single no-op read.
// The legacy key is removed ONLY after every shard has been written AND read back
// identical — any failure returns early and leaves the old blob as the source of
// truth, so a half-finished run never loses data.
async function migrateSiteProfiles() {
  const { siteProfiles } = await chrome.storage.sync.get({ siteProfiles: null });
  if (!siteProfiles || typeof siteProfiles !== "object") return { ok: true, migrated: 0 };

  const hosts = Object.keys(siteProfiles);
  let migrated = 0;
  // Legacy keys were produced by the OLD baseDomain, which collapsed bbc.co.uk to
  // "co.uk". Such a key can never be matched again now that the derivation is
  // fixed, so we migrate it (never silently drop user data) but report it.
  const orphans = [];
  // A shard that already exists with DIFFERENT content was written by the current
  // popup, i.e. it is newer than this legacy blob. Overwriting it would destroy
  // live user data, so we skip it and keep the legacy entry for reconciliation.
  const conflicts = [];
  const unresolved = {};

  for (const rawHost of hosts) {
    const profile = siteProfiles[rawHost];
    if (!profile || typeof profile !== "object") continue; // junk entry: drop it

    // Re-derive through the canonical function so every shard key is guaranteed
    // to come from one place. A no-op for keys that were already correct.
    const host = baseDomain(rawHost);
    if (MULTI_LABEL_SUFFIXES.has(host)) orphans.push(host);

    const key = spKey(host);
    const value = {
      enabled: !!profile.enabled,
      mappings: Array.isArray(profile.mappings) ? profile.mappings : []
    };
    const wanted = JSON.stringify(value);

    const existing = (await chrome.storage.sync.get(key))[key];
    if (existing !== undefined) {
      if (JSON.stringify(existing) === wanted) { migrated++; continue; } // already done
      // Never clobber a live shard — skip it and keep the legacy entry.
      conflicts.push(host);
      unresolved[rawHost] = profile;
      continue;
    }

    const written = await safeSyncSet({ [key]: value });
    if (!written.ok) return { ok: false, reason: "write", host, message: written.message };

    const back = (await chrome.storage.sync.get(key))[key];
    if (JSON.stringify(back) !== wanted) return { ok: false, reason: "verify", host };
    migrated++;
  }

  if (conflicts.length) {
    // Keep ONLY the entries we refused to migrate, so nothing is discarded
    // silently. loadSiteProfile prefers the shard, so the live rules still win.
    const kept = await safeSyncSet({ siteProfiles: unresolved });
    if (!kept.ok) return { ok: false, reason: "write", message: kept.message, orphans, conflicts };
  } else {
    // Every shard verified — only now is dropping the legacy blob safe.
    await chrome.storage.sync.remove("siteProfiles");
  }

  if (orphans.length) {
    console.warn(
      "[VIDEO-ZONES] قواعد مواقع مخزَّنة تحت لاحقة عامة ولن تُطابَق بعد إصلاح اشتقاق النطاق:",
      orphans, "— أعد إنشاءها من نافذة الإضافة على الموقع نفسه."
    );
  }
  if (conflicts.length) {
    console.warn(
      "[VIDEO-ZONES] تعارض: هذه النطاقات لها قواعد حالية تختلف عن النسخة القديمة،",
      conflicts, "— أُبقيت القواعد الحالية ولم تُطمس، والنسخة القديمة محفوظة في siteProfiles."
    );
  }
  return { ok: true, migrated, orphans, conflicts };
}
