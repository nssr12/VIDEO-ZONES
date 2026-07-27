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
  "com.sa","net.sa","org.sa","edu.sa","gov.sa","med.sa","pub.sa",
  "com.eg","net.eg","org.eg","edu.eg","gov.eg",
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
    if (JSON.stringify(existing) === wanted) { migrated++; continue; } // already done

    const limit = await syncWriteGuard(key, value);
    if (limit) return { ok: false, reason: limit, host };

    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch {
      return { ok: false, reason: "write", host };
    }

    const back = (await chrome.storage.sync.get(key))[key];
    if (JSON.stringify(back) !== wanted) return { ok: false, reason: "verify", host };
    migrated++;
  }

  // Every shard verified — only now is dropping the legacy blob safe.
  await chrome.storage.sync.remove("siteProfiles");
  if (orphans.length) {
    console.warn(
      "[VIDEO-ZONES] قواعد مواقع مخزَّنة تحت لاحقة عامة ولن تُطابَق بعد إصلاح اشتقاق النطاق:",
      orphans, "— أعد إنشاءها من نافذة الإضافة على الموقع نفسه."
    );
  }
  return { ok: true, migrated, orphans };
}
