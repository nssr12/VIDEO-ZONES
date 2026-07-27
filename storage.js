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

  for (const host of hosts) {
    const profile = siteProfiles[host];
    if (!profile || typeof profile !== "object") continue; // junk entry: drop it

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
  return { ok: true, migrated };
}
