let currentHost = "";
let mappings = []; // [{from,to}] — global
let siteMappings = []; // [{from,to}] — per-site
let captureTarget = null; // id of input being captured

const $ = (id) => document.getElementById(id);

const ACTIONS = [
  { label: "ACTION:TOGGLE_PLAY = تبديل تشغيل/إيقاف", value: "ACTION:TOGGLE_PLAY" },
  { label: "ACTION:TOGGLE_FULLSCREEN = تبديل ملء الشاشة", value: "ACTION:TOGGLE_FULLSCREEN" },
  { label: "ACTION:TOGGLE_MUTE = كتم/إلغاء الكتم", value: "ACTION:TOGGLE_MUTE" },
  { label: "ACTION:VOLUME:+4 = رفع الصوت 4%", value: "ACTION:VOLUME:+4" },
  { label: "ACTION:VOLUME:-4 = خفض الصوت 4%", value: "ACTION:VOLUME:-4" },
  { label: "ACTION:SEEK:+1 = تقديم 1 ثانية", value: "ACTION:SEEK:+1" },
  { label: "ACTION:SEEK:-1 = إرجاع 1 ثانية", value: "ACTION:SEEK:-1" },
  { label: "ACTION:SEEK:+5 = تقديم 5 ثوانٍ", value: "ACTION:SEEK:+5" },
  { label: "ACTION:SEEK:-5 = إرجاع 5 ثوانٍ", value: "ACTION:SEEK:-5" },
  { label: "ACTION:SEEK:+10 = تقديم 10 ثوانٍ", value: "ACTION:SEEK:+10" },
  { label: "ACTION:SEEK:-10 = إرجاع 10 ثوانٍ", value: "ACTION:SEEK:-10" },
  { label: "ACTION:SEEK:+30 = تقديم 30 ثانية", value: "ACTION:SEEK:+30" },
  { label: "ACTION:SEEK:-30 = إرجاع 30 ثانية", value: "ACTION:SEEK:-30" },
  { label: "ACTION:SPEED:+0.25 = زيادة السرعة 0.25", value: "ACTION:SPEED:+0.25" },
  { label: "ACTION:SPEED:-0.25 = خفض السرعة 0.25", value: "ACTION:SPEED:-0.25" },
  { label: "ACTION:SPEED:SET:1 = ضبط السرعة على 1x", value: "ACTION:SPEED:SET:1" },
  { label: "ACTION:SPEED:SET:1.5 = ضبط السرعة على 1.5x", value: "ACTION:SPEED:SET:1.5" },
  { label: "ACTION:SPEED:SET:2 = ضبط السرعة على 2x", value: "ACTION:SPEED:SET:2" },
  { label: "ACTION:TOGGLE_PIP = صورة داخل صورة", value: "ACTION:TOGGLE_PIP" }
];

// normalizeKeyCombo() يأتي من storage.js — لا تُعرِّف نسخة ثالثة (البند #11).

function normalizeMouseFromEvent(e) {
  const map = ["Mouse1", "Mouse2", "Mouse3", "Mouse4", "Mouse5"];
  return map[e.button] || `Mouse${e.button + 1}`;
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";

  const c = $("count");
  if (c) c.textContent = String(mappings.length);

  mappings.forEach((m, idx) => {
    const fromVal = (m.from || "").replaceAll('"', "&quot;");
    const toVal = (m.to || "").replaceAll('"', "&quot;");

    const div = document.createElement("div");
    div.className = "rule";
    div.innerHTML = `
      <input value="${fromVal}" data-i="${idx}" data-k="from" type="text">
      <input value="${toVal}" data-i="${idx}" data-k="to" type="text">
      <button class="btnDanger delBtn" title="حذف" type="button" data-del="${idx}">🗑️</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const i = Number(btn.dataset.del);
      mappings.splice(i, 1);
      renderList();
      await saveGlobalData();
    });
  });

  list.querySelectorAll("input[data-i]").forEach((inp) => {
    inp.addEventListener("change", () => {
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      mappings[i][k] = inp.value.trim();
    });
  });
}

function fillActionPreset() {
  const sel = $("actionPreset");
  if (!sel) return;

  sel.innerHTML = `<option value="">اختر أكشن جاهز</option>`;
  for (const action of ACTIONS) {
    const opt = document.createElement("option");
    opt.value = action.value;
    opt.textContent = action.label;
    sel.appendChild(opt);
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Same labels the options dropdown shows, so the two never describe the one setting
// differently. Anything unknown falls back to the raw code rather than guessing.
const YT_QUALITY_LABELS = {
  hd4320: "8K — 4320p", hd2160: "4K — 2160p", hd1440: "1440p — QHD",
  hd1080: "1080p — Full HD", hd720: "720p — HD", large: "480p",
  medium: "360p", small: "240p", tiny: "144p"
};
const qualityLabel = (q) => YT_QUALITY_LABELS[q] || String(q || "");

// Shown ONLY when the content script reports a real gap. It stays hidden on success,
// on auto quality, during an ad and off YouTube — content.js decides all four, so the
// popup has one rule: render what it is given, hide when given nothing.
function setYtQualityGap(gap) {
  const el = $("ytQualityGap");
  if (!el) return;
  if (!gap) { el.hidden = true; el.textContent = ""; return; }
  el.textContent = `الجودة المطلوبة ${qualityLabel(gap.requested)} غير متاحة في هذا الفيديو — طُبِّقت ${qualityLabel(gap.applied)}`;
  el.hidden = false;
}

function setStatus(kind, text) {
  const el = $("statusValue");
  if (!el) return;
  el.className = "statusValue";
  if (kind === "ok") el.classList.add("statusOk");
  if (kind === "warn") el.classList.add("statusWarn");
  if (kind === "bad") el.classList.add("statusBad");
  el.textContent = text;
}

// normalizeHost() and baseDomain() come from storage.js — loaded before this
// file in popup.html. Do not re-declare them here: a third derivation is exactly
// how the co.uk bug survived (audit item #5).
function hostFromUrl(url) {
  try {
    return baseDomain(new URL(url).host);
  } catch {
    return "";
  }
}

function isRestrictedUrl(url) {
  return !url || /^(chrome|edge|about|brave|opera|vivaldi|moz-extension|chrome-extension):/i.test(url);
}

// Reads from storage what the popup already owns: whether the extension is enabled
// for this host and whether the host is blocked. Both used to be asked of a content
// script — a frame cannot know them better than storage does, and a sleeping frame
// answered from defaults (audit #56). baseDomain and isHostBlocked come from
// storage.js; no third derivation lives here.
async function readHostGates(host) {
  const data = await chrome.storage.sync.get({
    settings: {}, globalSiteRules: { enabled: false, mappings: [] },
    siteProfiles: {}, [spKey(host || "")]: null
  });
  const settings = data.settings || {};
  const profile = data[spKey(host || "")] || data.siteProfiles?.[host] || null;
  return {
    blocked: isHostBlocked(host, settings.blockedHosts),
    globalEnabled: !!data.globalSiteRules?.enabled,
    siteProfileEnabled: !!profile?.enabled
  };
}

async function checkPageStatus() {
  const tab = await getActiveTab();
  const url = tab?.url || "";

  if (isRestrictedUrl(url)) {
    setYtQualityGap(null);
    setStatus("bad", "هذه الصفحة محمية من المتصفح ولا يمكن تشغيل الإضافة عليها");
    return;
  }

  // Decided here, from storage — no frame is consulted and none can contradict it.
  const gates = await readHostGates(hostFromUrl(url));
  if (gates.blocked) {
    setYtQualityGap(null);
    setStatus("warn", "الإضافة محظورة على هذا الموقع");
    return;
  }
  if (!gates.globalEnabled && !gates.siteProfileEnabled) {
    setYtQualityGap(null);
    setStatus("warn", "الإضافة متوقفة (لا قواعد عامة ولا قواعد للموقع)");
    return;
  }

  // Only now is a frame asked, and only about what it alone knows. Same resolver the
  // booster uses, so "which frame are we talking about" has one answer (audit #56).
  let res = null;
  try {
    const frameId = await findVideoFrameId(tab.id);
    res = frameId != null
      ? await chrome.tabs.sendMessage(tab.id, { type: "GVZ_STATUS" }, { frameId })
      : await chrome.tabs.sendMessage(tab.id, { type: "GVZ_STATUS" }, { frameId: 0 });
  } catch {
    setYtQualityGap(null);
    setStatus("bad", "الإضافة غير محقونة في هذه الصفحة. استخدم التفعيل اليدوي");
    return;
  }

  setYtQualityGap(res?.ok ? res.ytQualityGap : null);

  // "no video here" and "the extension is stopped" are different states and must never
  // be reported as one. A not-started answer means the script IS injected — the frame
  // simply has nothing to act on yet.
  if (!res?.ok || !res.hasVideo) {
    setStatus("warn", "الإضافة شغالة لكن لا فيديو في هذه الصفحة");
    return;
  }

  if (gates.siteProfileEnabled && !gates.globalEnabled) {
    setStatus("ok", "تشتغل بقواعد هذا الموقع فقط");
    return;
  }
  if (gates.siteProfileEnabled && gates.globalEnabled) {
    setStatus("ok", "الإضافة شغالة (قواعد الموقع تفوز على العامة)");
    return;
  }
  setStatus("ok", "الإضافة شغالة على هذه الصفحة");
}

async function activateOnCurrentPage() {
  const tab = await getActiveTab();
  const url = tab?.url || "";

  if (!tab?.id || isRestrictedUrl(url)) {
    setStatus("bad", "لا يمكن التفعيل اليدوي على هذه الصفحة");
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["content.js"]
    });
    await checkPageStatus();
  } catch {
    setStatus("bad", "فشل التفعيل اليدوي على هذه الصفحة");
  }
}

async function loadGlobalData() {
  const data = await chrome.storage.sync.get({
    globalSiteRules: { enabled: false, mappings: [] }
  });
  const rules = data.globalSiteRules || { enabled: false, mappings: [] };
  $("enabled").checked = !!rules.enabled;
  mappings = Array.isArray(rules.mappings) ? rules.mappings : [];
  renderList();
}

function renderSiteList() {
  const list = $("siteList");
  if (!list) return;
  list.innerHTML = "";

  const c = $("siteCount");
  if (c) c.textContent = String(siteMappings.length);

  siteMappings.forEach((m, idx) => {
    const fromVal = (m.from || "").replaceAll('"', "&quot;");
    const toVal = (m.to || "").replaceAll('"', "&quot;");

    const div = document.createElement("div");
    div.className = "rule";
    div.innerHTML = `
      <input value="${fromVal}" data-i="${idx}" data-k="from" type="text">
      <input value="${toVal}" data-i="${idx}" data-k="to" type="text">
      <button class="btnDanger delBtn" title="حذف" type="button" data-sdel="${idx}">🗑️</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll("button[data-sdel]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const i = Number(btn.dataset.sdel);
      siteMappings.splice(i, 1);
      renderSiteList();
      await saveSiteProfile();
    });
  });

  list.querySelectorAll("input[data-i]").forEach((inp) => {
    inp.addEventListener("change", () => {
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      siteMappings[i][k] = inp.value.trim();
    });
  });
}

async function loadSiteProfile() {
  if (!currentHost) return;
  const key = spKey(currentHost);
  // Shard first, legacy blob as fallback until migrateSiteProfiles() has run
  const data = await chrome.storage.sync.get([key, "siteProfiles"]);
  const profile = data[key] || data.siteProfiles?.[currentHost] || { enabled: false, mappings: [] };
  $("siteProfileEnabled").checked = !!profile.enabled;
  siteMappings = Array.isArray(profile.mappings) ? profile.mappings : [];
  renderSiteList();
}

async function saveSiteProfile() {
  if (!currentHost) return;
  const cleaned = [];
  const seen = new Set();
  for (const m of siteMappings || []) {
    const from = (m.from || "").trim();
    const to = (m.to || "").trim();
    if (!from || !to) continue;
    if (seen.has(from)) continue;
    seen.add(from);
    cleaned.push({ from, to });
  }

  const key = spKey(currentHost);
  const enabled = !!$("siteProfileEnabled").checked;

  // One domain, one key — a write no longer rewrites every other domain's rules.
  if (!enabled && cleaned.length === 0) {
    await chrome.storage.sync.remove(key);
  } else {
    const res = await safeSyncSet({ [key]: { enabled, mappings: cleaned } });
    if (!res.ok) {
      setStatus("bad", `تعذّر الحفظ: ${res.message}`);
      return false;
    }
  }

  siteMappings = cleaned;
  renderSiteList();

  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "RELOAD_SITE_PROFILE" }).catch(() => {});
  }
  return true;
}

async function saveGlobalData() {
  const cleaned = [];
  const seen = new Set();

  for (const m of mappings || []) {
    const from = (m.from || "").trim();
    const to = (m.to || "").trim();
    if (!from || !to) continue;
    const key = from + "->" + to;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({ from, to });
  }

  const globalSiteRules = {
    enabled: $("enabled").checked,
    mappings: cleaned
  };

  const res = await safeSyncSet({ globalSiteRules });
  if (!res.ok) {
    setStatus("bad", `تعذّر الحفظ: ${res.message}`);
    return false;
  }

  mappings = cleaned;
  renderList();

  const tab = await getActiveTab();
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "SITE_RULES_UPDATED",
      siteRules: globalSiteRules
    }).catch(() => {});
    chrome.tabs.sendMessage(tab.id, { type: "RELOAD_SITE_RULES" }).catch(() => {});
  }
  return true;
}

// -------- Sound Booster --------
// Why a boost can legitimately refuse to run. Surfacing these beats a slider that
// slides with no audible effect.
const BOOST_REASON_TEXT = {
  cross_origin: "مصدر الفيديو من نطاق آخر بلا CORS — التعزيز كان سيكتم الصوت نهائياً، فأُلغي",
  suspended:    "المتصفح منع تشغيل الصوت — انقر داخل الصفحة ثم حرّك المُنزلق مجدداً",
  connected:    "الفيديو موصول مسبقاً بمعالج صوت آخر (الموقع نفسه أو إضافة أخرى)",
  unsupported:  "المتصفح لا يدعم Web Audio في هذه الصفحة",
  degraded:     "تعذّر إكمال التعزيز؛ الصوت يعمل بمستواه الطبيعي — أعد تحميل الصفحة للمحاولة مجدداً",
  media_error:  "الفيديو فشل تحميله — لا يمكن تعزيز صوته",
  not_ready:    "الفيديو لم يُحمّل بعد — شغّله ثوانٍ ثم أعد المحاولة",
  no_src:       "الفيديو بلا مصدر صالح",
  no_video:     "لا يوجد فيديو في هذه الصفحة",
  blocked:      "هذا الموقع محظور في إعدادات الإضافة",
  silent:       "انقطع الصوت — أعد تحميل الصفحة",
  failed:       "تعذّر تفعيل التعزيز على هذه الصفحة",
  no_content:   "الإضافة غير محقونة هنا — استخدم «تفعيل يدوي» أعلاه"
};

function setBoostNote(reason, kind) {
  const el = $("boostNote");
  if (!el) return;
  el.classList.remove("show", "bad");
  if (!reason) {
    el.textContent = "";
    return;
  }
  el.textContent = (kind === "bad" ? "⛔ " : "⚠️ ") +
    (BOOST_REASON_TEXT[reason] || BOOST_REASON_TEXT.failed);
  el.classList.add("show");
  if (kind === "bad") el.classList.add("bad");
}

// The content script can only tell whether the boosted output is actually silent
// after it has sampled the graph, so we re-ask once the measurement has had time
// to land instead of warning pre-emptively on every boost.
const BOOST_SILENCE_POLL_MS = 1400;
let silenceTimer = null;

function scheduleSilenceCheck() {
  if (silenceTimer) clearTimeout(silenceTimer);
  silenceTimer = setTimeout(async () => {
    silenceTimer = null;
    if (boostTabId == null) return;
    try {
      const res = await sendBoostMessage({ type: "GET_VOLUME_BOOST" });
      if (res?.reason === "silent") setBoostNote("silent", "bad");
    } catch {}
  }, BOOST_SILENCE_POLL_MS);
}

// Broadcasting to every frame made each one build its own AudioContext and let a
// random frame answer GET_VOLUME_BOOST. We resolve the tab and the frame holding
// the largest visible video ONCE when the popup opens, then every later message
// is a single sendMessage — no tabs.query and no frame scan per slider step.
let boostTabId = null;
let boostFrameId = null;

async function findVideoFrameId(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        let biggest = 0;
        for (const v of document.querySelectorAll("video")) {
          const r = v.getBoundingClientRect();
          biggest = Math.max(biggest, r.width * r.height);
        }
        return biggest;
      }
    });
    let winner = null;
    let bestArea = 0;
    for (const r of results) {
      if (typeof r?.result === "number" && r.result > bestArea) {
        bestArea = r.result;
        winner = r.frameId;
      }
    }
    return winner;
  } catch {
    return null;
  }
}

function sendToVideoFrame(message) {
  return boostFrameId != null
    ? chrome.tabs.sendMessage(boostTabId, message, { frameId: boostFrameId })
    : chrome.tabs.sendMessage(boostTabId, message);
}

// The cached frameId goes stale if the page navigates while the popup stays open
// (SPA route changes rebuild frames, and a full load renumbers them). On failure
// we re-resolve once and retry rather than reporting a dead extension.
async function sendBoostMessage(message) {
  try {
    return await sendToVideoFrame(message);
  } catch (err) {
    if (boostTabId == null) throw err;
    const fresh = await findVideoFrameId(boostTabId);
    if (fresh === boostFrameId) throw err; // same frame — genuinely unreachable
    boostFrameId = fresh;
    return await sendToVideoFrame(message);
  }
}


async function loadBoostUI() {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  boostTabId = tab.id;
  boostFrameId = await findVideoFrameId(tab.id);
  try {
    const res = await sendToVideoFrame({ type: "GET_VOLUME_BOOST" });
    if (res?.pct != null) {
      // A tab left open from before the 100% floor landed can still report < 100
      const pct = Math.max(100, Math.min(600, Number(res.pct) || 100));
      $("boostSlider").value = pct;
      $("boostValue").textContent = pct + "%";
    }
    if (res?.reason) setBoostNote(res.reason);
  } catch {}
}

// ~120ms throttle: the range input fires on every 5% step, so one drag across
// 100→600 used to emit ~100 messages.
const BOOST_THROTTLE_MS = 120;
let boostTimer = null;
let boostPending = null;

function queueBoostSend(pct) {
  boostPending = pct;
  if (boostTimer) return;
  boostTimer = setTimeout(() => {
    boostTimer = null;
    const next = boostPending;
    boostPending = null;
    if (next != null) sendBoost(next);
  }, BOOST_THROTTLE_MS);
}

function flushBoostSend(pct) {
  if (boostTimer) {
    clearTimeout(boostTimer);
    boostTimer = null;
  }
  boostPending = null;
  return sendBoost(pct, true);
}

async function sendBoost(pct, isFinal = false) {
  if (boostTabId == null) return; // resolved once in loadBoostUI
  try {
    const res = await sendBoostMessage({ type: "SET_VOLUME_BOOST", pct });
    if (res?.ok) {
      setBoostNote(null);
      if (pct > 100) scheduleSilenceCheck();
      return;
    }
    setBoostNote(res?.reason || "failed");
    // The value was never applied — don't leave the slider claiming otherwise.
    if (isFinal) {
      $("boostSlider").value = 100;
      $("boostValue").textContent = "100%";
    }
  } catch {
    setBoostNote("no_content");
    if (isFinal) {
      $("boostSlider").value = 100;
      $("boostValue").textContent = "100%";
    }
  }
}

async function loadBlockedSiteUI() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  const isBlocked = isHostBlocked(currentHost, settings.blockedHosts);
  $("blockSiteBtn").classList.toggle("blocked", isBlocked);
  $("blockSiteBtn").title = isBlocked ? "الموقع محظور — اضغط للسماح" : "اضغط لمنع هذا الموقع";
}

async function saveBlockedSiteState() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  const blockedHosts = new Set(Array.isArray(settings.blockedHosts) ? settings.blockedHosts : []);
  const shouldBlock = !blockedHosts.has(currentHost); // toggle

  if (!currentHost) return;

  if (shouldBlock) blockedHosts.add(currentHost);
  else blockedHosts.delete(currentHost);

  settings.blockedHosts = Array.from(blockedHosts).sort();

  // blockedHosts stays inside `settings` in sync; refuse the addition up front
  // rather than letting an oversized write fail silently.
  const res = await safeSyncSet({ settings });
  if (!res.ok) {
    setStatus("bad", `${shouldBlock ? "تعذّر حظر الموقع" : "تعذّر الحفظ"}: ${res.message}`);
    return;
  }

  const tab = await getActiveTab();
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "GVZ_RELOAD" }).catch(() => {});
}

async function loadSubtitlesToggle() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const s = data.settings || {};
  const sub = s.subtitles || {};
  const el = $("subtitlesEnabled");
  if (el) el.checked = !!sub.enabled;
}

async function saveSubtitlesToggle() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  settings.subtitles = {
    ...(settings.subtitles || {}),
    enabled: !!$("subtitlesEnabled")?.checked
  };
  const res = await safeSyncSet({ settings });
  if (!res.ok) { setStatus("bad", `تعذّر الحفظ: ${res.message}`); return; }

  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id) chrome.tabs.sendMessage(t.id, { type: "RELOAD_SUBTITLES" }).catch(() => {});
  }
}

async function loadFullscreenOnlyToggle() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const s = data.settings || {};
  const zones = s.zones || {};
  const el = $("fullscreenOnly");
  if (el) el.checked = !!zones.fullscreenOnly;
}

async function saveFullscreenOnlyToggle() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  settings.zones = {
    ...(settings.zones || {}),
    fullscreenOnly: !!$("fullscreenOnly")?.checked
  };
  const res = await safeSyncSet({ settings });
  if (!res.ok) { setStatus("bad", `تعذّر الحفظ: ${res.message}`); return; }

  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id) chrome.tabs.sendMessage(t.id, { type: "RELOAD_ZONE_SETTINGS" }).catch(() => {});
  }
}

async function loadOverlayUI() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const s = data.settings || {};
  const overlay = s.overlay || { enabled: true, autoHideMs: 900 };
  const dur = $("overlayDuration");
  const value = $("overlayDurationValue");
  const ms = overlay.enabled === false ? 0 : Number(overlay.autoHideMs ?? 900);

  if (dur) dur.value = String(ms);
  if (value) value.textContent = formatOverlayDuration(ms);
}

async function saveOverlayUI() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  const dur = $("overlayDuration");
  const ms = dur ? Number(dur.value) : 900;

  settings.overlay = {
    ...(settings.overlay || {}),
    autoHideMs: ms,
    enabled: ms > 0 || Number(settings.overlay?.volumeAutoHideMs ?? 0) > 0
  };

  const res = await safeSyncSet({ settings });
  if (!res.ok) { setStatus("bad", `تعذّر الحفظ: ${res.message}`); return; }

  const tab = await getActiveTab();
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "RELOAD_OVERLAY_SETTINGS" }).catch(() => {});
}

function formatOverlayDuration(ms) {
  if (ms <= 0) return "معطل";
  return `${(ms / 1000).toFixed(1)} ثانية`;
}

function beginCapture(targetId) {
  captureTarget = targetId;
  const el = $(targetId);
  el.value = "… اضغط اختصار الآن …";
  el.focus();
}

document.addEventListener("keydown", (e) => {
  if (!captureTarget) return;
  e.preventDefault();
  e.stopPropagation();

  const combo = normalizeKeyCombo(e);
  if (!combo) return;

  $(captureTarget).value = combo;
  captureTarget = null;
}, true);

document.addEventListener("mousedown", (e) => {
  if (!captureTarget) return;
  e.preventDefault();
  e.stopPropagation();

  const combo = normalizeMouseFromEvent(e);
  $(captureTarget).value = combo;
  captureTarget = null;
}, true);

(async () => {
  const tab = await getActiveTab();
  currentHost = hostFromUrl(tab?.url || "");
  $("siteLabel").textContent = currentHost
    ? `الموقع الحالي: ${currentHost}`
    : "يعمل على جميع المواقع التي تحتوي على فيديو";

  fillActionPreset();
  // Idempotent, and a no-op read once the legacy key is gone
  await migrateSiteProfiles().catch(() => {});
  await loadGlobalData();
  await loadSiteProfile();
  await loadOverlayUI();
  await loadBlockedSiteUI();
  await loadSubtitlesToggle();
  await loadFullscreenOnlyToggle();
  await checkPageStatus();
  await loadBoostUI();

  const od = $("overlayDuration");
  const odValue = $("overlayDurationValue");

  if (od) {
    od.addEventListener("input", () => {
      if (odValue) odValue.textContent = formatOverlayDuration(Number(od.value));
    });
    od.addEventListener("change", saveOverlayUI);
  }

  $("enabled").addEventListener("change", saveGlobalData);
  $("subtitlesEnabled")?.addEventListener("change", saveSubtitlesToggle);
  $("fullscreenOnly")?.addEventListener("change", saveFullscreenOnlyToggle);
  $("blockSiteBtn").addEventListener("click", () => saveBlockedSiteState().then(loadBlockedSiteUI));
  $("checkStatus").addEventListener("click", checkPageStatus);

  $("boostSlider").addEventListener("input", () => {
    const pct = Number($("boostSlider").value);
    $("boostValue").textContent = pct + "%";
    queueBoostSend(pct);
  });
  // Final, unthrottled send once the drag ends
  $("boostSlider").addEventListener("change", () => {
    flushBoostSend(Number($("boostSlider").value));
  });
  $("manualActivate").addEventListener("click", activateOnCurrentPage);

  $("openOptions")?.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  });

  $("capFrom").addEventListener("click", () => beginCapture("from"));
  $("capTo").addEventListener("click", () => beginCapture("to"));
  $("capSiteFrom").addEventListener("click", () => beginCapture("siteFrom"));
  $("capSiteTo").addEventListener("click", () => beginCapture("siteTo"));

  $("siteProfileEnabled").addEventListener("change", saveSiteProfile);

  $("siteAdd").addEventListener("click", () => {
    const from = $("siteFrom").value.trim();
    const to = $("siteTo").value.trim();
    if (!from || !to) return;

    const i = siteMappings.findIndex((x) => (x.from || "").trim() === from);
    if (i >= 0) siteMappings[i] = { from, to };
    else siteMappings.push({ from, to });

    $("siteFrom").value = "";
    $("siteTo").value = "";
    renderSiteList();
  });

  $("siteSave").addEventListener("click", async () => {
    // الرسالة تتبع النتيجة الفعلية، وعند الفشل تظهر رسالة setStatus بدلها
    if (await saveSiteProfile() !== true) return;
    $("siteSave").textContent = "تم الحفظ ✅";
    setTimeout(() => { $("siteSave").textContent = "حفظ قواعد الموقع"; }, 800);
  });
  $("actionPreset").addEventListener("change", () => {
    if ($("actionPreset").value) $("to").value = $("actionPreset").value;
  });

  $("add").addEventListener("click", () => {
    const from = $("from").value.trim();
    const to = $("to").value.trim();
    if (!from || !to) return;

    const i = mappings.findIndex((x) => (x.from || "").trim() === from);
    if (i >= 0) {
      mappings[i] = { from, to };
    } else {
      mappings.push({ from, to });
    }

    $("from").value = "";
    $("to").value = "";
    renderList();
  });

  $("save").addEventListener("click", async () => {
    if (await saveGlobalData() !== true) return;
    $("save").textContent = "تم الحفظ ✅";
    setTimeout(() => {
      $("save").textContent = "حفظ الإعدادات";
    }, 800);
  });
})();
