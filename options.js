const $ = (id) => document.getElementById(id);

const ACTION_CHOICES = [
  { type: "toggle_play", label: "Toggle play / pause" },
  { type: "toggle_fullscreen", label: "Toggle fullscreen" },
  { type: "toggle_mute", label: "Toggle mute" },
  { type: "toggle_pip", label: "Toggle PiP" },
  { type: "seek", label: "Seek by" },
  { type: "volume", label: "Volume by %" },
  { type: "speed", label: "Speed by" },
  { type: "speed_set", label: "Set speed to" }
];

// Keys must match CLEAN_PLAYER_ITEMS in content.js
const CLEAN_PLAYER_OPTIONS = [
  { key: "ambient_mode",            label: "Ambient mode" },
  { key: "top_section",             label: "Top: Whole section" },
  { key: "top_titles",              label: "Top: Video & channel titles" },
  { key: "top_playlist_menu",       label: "Top: Playlist menu button" },
  { key: "top_watch_later",         label: "Top: Watch later button" },
  { key: "top_share",               label: "Top: Share button" },
  { key: "top_info",                label: "Top: Info button" },
  { key: "top_card_teaser",         label: "Top: Card teaser" },
  { key: "quick_actions",           label: "Bottom-right: Quick actions" },
  { key: "paid_content",            label: "Paid content overlay" },
  { key: "suggested_action",        label: "Suggested action badge" },
  { key: "annotations",             label: "Custom video annotations" },
  { key: "cards",                   label: "Cards" },
  { key: "endscreen",               label: "End screen" },
  { key: "embed_more_videos",       label: "\"More videos\" overlay in embedded player" },
  { key: "watermark",               label: "Channel watermark" },
  { key: "large_play_button",       label: "Large play button" },
  { key: "spinner",                 label: "Loading spinner" },
  { key: "heatmap",                 label: "Progress bar heatmap" },
  { key: "prev_button",             label: "Previous button" },
  { key: "play_button",             label: "Play button" },
  { key: "next_button",             label: "Next button" },
  { key: "mute_button",             label: "Mute button" },
  { key: "volume_slider",           label: "Volume slider" },
  { key: "time_display",            label: "Time display" },
  { key: "chapter_button",          label: "Chapter button" },
  { key: "fullscreen_scroll_arrow", label: "\"Scroll for details\" / \"More videos\" arrow" },
  { key: "autoplay_toggle",         label: "Auto-play toggle" },
  { key: "subtitles_button",        label: "Subtitles button" },
  { key: "settings_button",         label: "Settings button" },
  { key: "multicam_button",         label: "Multicam button" },
  { key: "miniplayer_button",       label: "Miniplayer button" },
  { key: "pip_button",              label: "PiP button" },
  { key: "size_button",             label: "Default view / cinema mode" },
  { key: "remote_button",           label: "Remote button" },
  { key: "fullscreen_button",       label: "Full screen button" }
];

let modalZone = 1;
let editingActions = [];
let editingActionIndex = null;
let capturingActionId = null;

// makeId() و normalizeActionArray() و parseRuntimeAction() تأتي من storage.js —
// انتقلت إليها مع تحويل wheel.map ⇒ wheel.actions حين صار الـ service worker
// يشغّل التحويل نفسه (البند #26). لا تُعِد تعريفها هنا.

// Zone numbering 1..9 maps to a row/col grid label
const ZONE_LABELS = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"];
function zoneLabel(zone) {
  return ZONE_LABELS[Number(zone) - 1] || `#${zone}`;
}

function parseNumberInput(value) {
  const raw = String(value || "").trim().replace(",", ".");
  if (!raw) return null;
  if (!/^[-+]?\d*\.?\d+$/.test(raw)) return null;
  return Number(raw);
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10000) / 10000);
}

function actionTypeLabel(type) {
  return ACTION_CHOICES.find((x) => x.type === type)?.label || type;
}

function actionToRuntime(entry) {
  if (!entry?.type) return "";

  if (entry.type === "toggle_play") return "ACTION:TOGGLE_PLAY";
  if (entry.type === "toggle_fullscreen") return "ACTION:TOGGLE_FULLSCREEN";
  if (entry.type === "toggle_mute") return "ACTION:TOGGLE_MUTE";
  if (entry.type === "toggle_pip") return "ACTION:TOGGLE_PIP";

  if (entry.type === "seek") {
    const value = parseNumberInput(entry.value);
    if (value === null) return "";
    const seconds = entry.unit === "frame" ? value / 30 : value;
    const signed = seconds > 0 ? `+${formatNumber(seconds)}` : formatNumber(seconds);
    return `ACTION:SEEK:${signed}`;
  }

  if (entry.type === "volume") {
    const value = parseNumberInput(entry.value);
    if (value === null) return "";
    const signed = value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
    return `ACTION:VOLUME:${signed}`;
  }

  if (entry.type === "speed") {
    const value = parseNumberInput(entry.value);
    if (value === null) return "";
    const signed = value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
    return `ACTION:SPEED:${signed}`;
  }

  if (entry.type === "speed_set") {
    const value = parseNumberInput(entry.value);
    if (value === null || value <= 0) return "";
    return `ACTION:SPEED:SET:${formatNumber(value)}`;
  }

  return "";
}

function actionSummary(entry) {
  if (!entry?.type) return "Action";
  if (entry.type === "toggle_play") return "Toggle play / pause";
  if (entry.type === "toggle_fullscreen") return "Toggle fullscreen";
  if (entry.type === "toggle_mute") return "Toggle mute";
  if (entry.type === "toggle_pip") return "Toggle PiP";
  if (entry.type === "seek") {
    const value = parseNumberInput(entry.value) ?? 0;
    const amount = formatNumber(Math.abs(value));
    const unit = entry.unit === "frame" ? "frame" : "second";
    return `${value >= 0 ? "Fast forward" : "Rewind"} ${amount} ${unit}`;
  }
  if (entry.type === "volume") {
    const value = parseNumberInput(entry.value) ?? 0;
    return `${value >= 0 ? "Increase volume" : "Decrease volume"} by ${formatNumber(Math.abs(value))}%`;
  }
  if (entry.type === "speed") {
    const value = parseNumberInput(entry.value) ?? 0;
    return `${value >= 0 ? "Increase speed" : "Decrease speed"} by ${formatNumber(Math.abs(value))}`;
  }
  if (entry.type === "speed_set") {
    const value = parseNumberInput(entry.value) ?? 1;
    return `Set speed to ${formatNumber(value)}x`;
  }
  return actionTypeLabel(entry.type);
}

function actionMeta(entry) {
  if (!entry.key) return "No key assigned";
  if (entry.key === "up") return "Wheel Up";
  if (entry.key === "down") return "Wheel Down";
  if (entry.key === "click_left") return "Left Click";
  if (entry.key === "click_right") return "Right Click";
  if (entry.key === "click_middle") return "Middle Click";
  return `Key: ${entry.key}`;
}

function keyBadgeLabel(key) {
  if (!key) return "SET KEY";
  if (key === "up") return "Wheel Up";
  if (key === "down") return "Wheel Down";
  if (key === "click_left") return "Left Click";
  if (key === "click_right") return "Right Click";
  if (key === "click_middle") return "Middle Click";
  return `Key: ${key}`;
}

// True only when getSettings() found no `zones` key at all, i.e. a fresh install.
// Seeding must key off THIS and never off "actions are empty" — a user who
// deleted every binding on purpose had them restored on each visit (audit #23).
let zonesWereMissing = false;

// تشكيل في الذاكرة لمحرّر الإعدادات، ثم **التحويل المشترك** من storage.js.
// التحويل نفسه لا يعيش هنا: يشغّله background.js عند التثبيت والتحديث كذلك،
// ونسخة واحدة منه هي ما يضمن أن المسارين يعطيان النتيجة نفسها (البند #26).
function ensureZoneActions(settings) {
  zonesWereMissing = !settings.zones;
  settings.zones ||= { enabled: true, fullscreenOnly: false, wheel: { map: {}, actions: {} } };
  settings.zones.fullscreenOnly = settings.zones.fullscreenOnly === true;
  // "player" (default) = grid covers the whole player frame incl. black bars
  settings.zones.gridCoverage = settings.zones.gridCoverage === "video" ? "video" : "player";
  settings.zones.wheel ||= { map: {}, actions: {} };
  settings.zones.wheel.map ||= {};
  settings.zones.wheel.actions ||= {};

  migrateZoneActionsInto(settings);
  return settings;
}

function rebuildWheelMap(settings) {
  const actionsByZone = settings.zones.wheel.actions || {};
  const wheelMap = {};
  const clickMap = {};
  const keyMap = {};

  for (let zone = 1; zone <= 9; zone++) {
    const key = String(zone);
    const items = Array.isArray(actionsByZone[key]) ? actionsByZone[key] : [];
    const up = [];
    const down = [];
    const clickLeft = [];
    const clickRight = [];
    const clickMiddle = [];
    const keyBindings = {};

    for (const item of items) {
      const runtime = actionToRuntime(item);
      if (!runtime || !item.key) continue;
      if (item.key === "up") up.push(runtime);
      else if (item.key === "down") down.push(runtime);
      else if (item.key === "click_left") clickLeft.push(runtime);
      else if (item.key === "click_right") clickRight.push(runtime);
      else if (item.key === "click_middle") clickMiddle.push(runtime);
      else {
        keyBindings[item.key] ||= [];
        keyBindings[item.key].push(runtime);
      }
    }

    if (up.length || down.length) {
      wheelMap[key] = {};
      if (up.length) wheelMap[key].up = up;
      if (down.length) wheelMap[key].down = down;
    }
    if (clickLeft.length || clickRight.length || clickMiddle.length) {
      clickMap[key] = {};
      if (clickLeft.length) clickMap[key].left = clickLeft;
      if (clickRight.length) clickMap[key].right = clickRight;
      if (clickMiddle.length) clickMap[key].middle = clickMiddle;
    }
    if (Object.keys(keyBindings).length) {
      keyMap[key] = keyBindings;
    }
  }

  settings.zones.wheel.map = wheelMap;
  settings.zones.click ||= {};
  settings.zones.click.map = clickMap;
  settings.zones.key ||= {};
  settings.zones.key.map = keyMap;
}

async function getSettings() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  settings.blockedHosts ||= [];
  settings.soundDisplay ||= { color: "#ffffff", fontSize: 48 };
  // لا تُعبَّأ تلقائياً: غيابها يعني "لم تُضبط قط"، و resolveGridAppearance
  // يحوّل ذلك إلى مظهر الـ overlay الأصلي. تعبئتها هنا هي ما أعطى الجميع
  // شبكة معتمة لم يخترها أحد.
  settings.overlay ||= {};
  if (typeof settings.overlay.autoHideMs !== "number") settings.overlay.autoHideMs = 900;
  // Default volumeAutoHideMs to existing autoHideMs for migration; keeps existing user choice for both
  if (typeof settings.overlay.volumeAutoHideMs !== "number") settings.overlay.volumeAutoHideMs = settings.overlay.autoHideMs;
  if (typeof settings.overlay.enabled !== "boolean") settings.overlay.enabled = settings.overlay.autoHideMs > 0;
  if (typeof settings.ytAutoQuality !== "string") settings.ytAutoQuality = "";
  if (typeof settings.ytShortsRedirect !== "boolean") settings.ytShortsRedirect = true;
  settings.cleanPlayer ||= {};
  if (typeof settings.cleanPlayer.enabled !== "boolean") settings.cleanPlayer.enabled = false;
  if (!settings.cleanPlayer.items || typeof settings.cleanPlayer.items !== "object") settings.cleanPlayer.items = {};
  settings.subtitles ||= {};
  const s = settings.subtitles;
  if (typeof s.enabled !== "boolean") s.enabled = false;
  if (typeof s.defaultLang !== "string") s.defaultLang = "";
  if (typeof s.fontSize !== "number") s.fontSize = 22;
  if (typeof s.color !== "string") s.color = "#ffffff";
  if (typeof s.bgColor !== "string") s.bgColor = "#000000";
  if (typeof s.bgOpacity !== "number") s.bgOpacity = 0.6;
  if (typeof s.fontFamily !== "string") s.fontFamily = "system-ui, -apple-system, sans-serif";
  if (typeof s.position !== "string") s.position = "bottom";
  // مفعَّل افتراضياً: الغياب يعني "أخفِ" لا "أظهر" (#51)
  if (typeof s.hideOnPreviews !== "boolean") s.hideOnPreviews = true;
  ensureZoneActions(settings);
  return settings;
}

// Failure is surfaced here rather than at each of the ~15 call sites, so no save
// path can ever swallow a quota error. Returns true only when the write landed.
async function saveSettings(settings) {
  rebuildWheelMap(settings);
  const res = await safeSyncSet({ settings });
  if (!res.ok) {
    showToast("bad", `تعذّر الحفظ: ${res.message}`);
    return false;
  }
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id) chrome.tabs.sendMessage(t.id, { type: "GVZ_RELOAD" }).catch(() => {});
  }
  return true;
}

// migrateSiteProfiles refuses to overwrite a live shard, and keeps the entries it
// skipped in the legacy `siteProfiles` key. Without this notice that leftover is
// invisible: the user never learns an older copy is still stored. Nothing is ever
// deleted automatically — removal is behind an explicit confirm.
async function renderConflictNotice() {
  const box = $("conflictNotice");
  const list = $("conflictList");
  if (!box || !list) return;

  const { siteProfiles } = await chrome.storage.sync.get({ siteProfiles: null });
  const hosts = siteProfiles && typeof siteProfiles === "object" ? Object.keys(siteProfiles) : [];
  if (!hosts.length) { box.hidden = true; return; }

  list.textContent = "";
  for (const host of hosts) {
    const li = document.createElement("li");
    // textContent, never innerHTML: these strings come from storage
    li.textContent = `${host} — ${(siteProfiles[host]?.mappings || []).length} قاعدة في النسخة القديمة`;
    list.appendChild(li);
  }
  box.hidden = false;
}

async function discardLegacySiteProfiles() {
  const { siteProfiles } = await chrome.storage.sync.get({ siteProfiles: null });
  const hosts = siteProfiles && typeof siteProfiles === "object" ? Object.keys(siteProfiles) : [];
  if (!hosts.length) { await renderConflictNotice(); return; }

  if (!confirm(
    `سيتم حذف النسخة القديمة نهائياً لـ ${hosts.length} نطاق:\n\n${hosts.join("\n")}\n\n` +
    "قواعدك الحالية الفعّالة لن تتأثر. هل أنت متأكد؟"
  )) return;

  try {
    await chrome.storage.sync.remove("siteProfiles");
    showToast("ok", "حُذفت النسخة القديمة. قواعدك الحالية كما هي.");
  } catch (err) {
    showToast("bad", `تعذّر الحذف: ${syncErrorText(err)}`);
  }
  await renderConflictNotice();
}

let toastTimer = null;
function showToast(kind, text) {
  const el = $("toast");
  if (!el) return;
  el.textContent = text;
  el.className = `toast show ${kind === "bad" ? "bad" : "ok"}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), kind === "bad" ? 6000 : 2200);
}

function defaultZoneActions() {
  return {
    "4": [
      { id: makeId(), type: "volume", unit: "percent", value: "+4", key: "up" },
      { id: makeId(), type: "volume", unit: "percent", value: "-4", key: "down" }
    ],
    "6": [
      { id: makeId(), type: "seek", unit: "second", value: "+5", key: "up" },
      { id: makeId(), type: "seek", unit: "second", value: "-5", key: "down" }
    ],
    "7": [
      { id: makeId(), type: "seek", unit: "second", value: "+1", key: "up" },
      { id: makeId(), type: "seek", unit: "second", value: "-1", key: "down" }
    ]
  };
}

function renderGrid(actionsByZone) {
  const g = $("grid");
  g.innerHTML = "";

  for (let i = 1; i <= 9; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.zone = String(i);

    const num = document.createElement("div");
    num.className = "zoneNum";
    num.textContent = zoneLabel(i);

    const items = Array.isArray(actionsByZone[String(i)]) ? actionsByZone[String(i)] : [];
    cell.appendChild(num);

    const groups = new Map();
    for (const item of items) {
      const label = keyBadgeLabel(item.key);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(actionSummary(item));
    }

    if (groups.size === 0) {
      const empty = document.createElement("div");
      empty.className = "actionLine";
      empty.innerHTML = `<span class="badge">—</span>اضغط للإضافة`;
      cell.appendChild(empty);
    } else {
      for (const [label, summaries] of groups) {
        const line = document.createElement("div");
        line.className = "actionLine";
        const safe = summaries.join(" + ").replace(/</g, "&lt;");
        line.innerHTML = `<span class="badge">${label.replace(/</g, "&lt;")}</span>${safe}`;
        cell.appendChild(line);
      }
    }

    cell.addEventListener("click", () => openZoneModal(i, items));
    g.appendChild(cell);
  }
}

function renderBlockedSites(blockedHosts) {
  const list = $("blockedList");
  const empty = $("blockedEmpty");
  list.innerHTML = "";

  const hosts = Array.isArray(blockedHosts) ? [...blockedHosts].sort() : [];
  empty.hidden = hosts.length > 0;

  for (const host of hosts) {
    const item = document.createElement("div");
    item.className = "blockedItem";

    const label = document.createElement("div");
    label.className = "blockedHost";
    label.textContent = host;

    const btn = document.createElement("button");
    btn.className = "btnGhost";
    btn.textContent = "إزالة";
    btn.addEventListener("click", async () => {
      const s = await getSettings();
      s.blockedHosts = (s.blockedHosts || []).filter((x) => x !== host);
      await saveSettings(s);
      renderBlockedSites(s.blockedHosts);
    });

    item.appendChild(label);
    item.appendChild(btn);
    list.appendChild(item);
  }
}

function renderSoundSettings(soundDisplay) {
  const color = soundDisplay?.color || "#ffffff";
  const size = Number(soundDisplay?.fontSize || 48);
  $("soundColor").value = color;
  $("soundSize").value = String(size);
  $("soundSizeValue").textContent = `${size}px`;
}

// المعاينة في هذه الصفحة تعرض ما سيراه المستخدم داخل الفيديو حرفياً
function applyGridAppearance(appearance) {
  const g = resolveGridAppearance(appearance);
  const root = document.documentElement;
  root.style.setProperty("--grid-cell-bg", rgbaFrom(g.cellBg, g.cellBgOpacity));
  root.style.setProperty("--grid-cell-border", rgbaFrom(g.cellBorder, g.cellBorderOpacity));
  root.style.setProperty("--grid-number-color", rgbaFrom(g.numberColor, g.numberOpacity));
  root.style.setProperty("--grid-cell-radius", `${g.radius}px`);
}

function renderYtAutoQuality(quality) {
  $("ytQuality").value = quality || "";
}

function renderYtShortsRedirect(enabled) {
  $("ytShortsRedirect").checked = enabled !== false;
}

let cleanPlayerSaving = 0; // guards the storage.onChanged re-render against reverting mid-save toggles

async function persistCleanPlayer() {
  cleanPlayerSaving++;
  try {
    const s = await getSettings();
    // Store only checked keys — keeps the settings item small (sync storage
    // has an 8KB per-item quota) and missing keys read as false anyway.
    const items = {};
    for (const { key } of CLEAN_PLAYER_OPTIONS) {
      if ($(`cp_${key}`)?.checked) items[key] = true;
    }
    s.cleanPlayer = { enabled: $("cleanPlayerEnabled").checked, items };
    await saveSettings(s);
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { type: "RELOAD_CLEAN_PLAYER" }).catch(() => {});
    }
  } finally {
    cleanPlayerSaving--;
  }
}

function buildCleanPlayerList() {
  const root = $("cleanPlayerList");
  root.innerHTML = "";
  for (const { key, label } of CLEAN_PLAYER_OPTIONS) {
    const lab = document.createElement("label");
    lab.className = "cleanPlayerItem";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = `cp_${key}`;
    input.addEventListener("change", persistCleanPlayer);

    const span = document.createElement("span");
    span.textContent = label;

    lab.appendChild(input);
    lab.appendChild(span);
    root.appendChild(lab);
  }
}

function renderCleanPlayer(cp) {
  $("cleanPlayerEnabled").checked = !!cp?.enabled;
  syncCleanPlayerCaptionNote();
  for (const { key } of CLEAN_PLAYER_OPTIONS) {
    const el = $(`cp_${key}`);
    if (el) el.checked = !!cp?.items?.[key];
  }
}

// Mirrors captionAutomationActive() in content.js: the automation runs only when
// subtitles are on AND a default language is set, and that is exactly when the
// two buttons it clicks stay visible (audit #18).
function syncCleanPlayerCaptionNote() {
  const active = $("subEnabled").checked && $("subLang").value.trim() !== "";
  $("cleanPlayerCaptionNote").hidden = !active;
}

function renderSubtitles(sub) {
  if (!sub) return;
  $("subEnabled").checked = !!sub.enabled;
  $("subHidePreviews").checked = sub.hideOnPreviews !== false;
  $("subLang").value = sub.defaultLang || "";
  syncCleanPlayerCaptionNote();
  $("subFontSize").value = String(sub.fontSize);
  $("subFontSizeValue").textContent = `${sub.fontSize}px`;
  $("subColor").value = sub.color;
  $("subBgColor").value = sub.bgColor;
  const op = Math.round((sub.bgOpacity ?? 0.6) * 100);
  $("subBgOpacity").value = String(op);
  $("subBgOpacityValue").textContent = `${op}%`;
  $("subFontFamily").value = sub.fontFamily;
  $("subPosition").value = sub.position;
}

function formatDurationMs(ms) {
  if (ms <= 0) return "معطّل";
  return `${(ms / 1000).toFixed(1)} ثانية`;
}

function renderOverlayTiming(overlay) {
  const grid = Number(overlay?.autoHideMs ?? 900);
  const vol = Number(overlay?.volumeAutoHideMs ?? grid);
  $("gridDuration").value = String(grid);
  $("gridDurationValue").textContent = formatDurationMs(grid);
  $("volumeDuration").value = String(vol);
  $("volumeDurationValue").textContent = formatDurationMs(vol);
}

function renderGridAppearance(appearance) {
  const g = resolveGridAppearance(appearance);
  $("gridCellBg").value = g.cellBg;
  $("gridCellBorder").value = g.cellBorder;
  $("gridNumberColor").value = g.numberColor;
  $("gridRadius").value = String(g.radius);
  $("gridRadiusValue").textContent = `${g.radius}px`;

  for (const [slider, valueEl, val] of [
    ["gridCellBgOpacity", "gridCellBgOpacityValue", g.cellBgOpacity],
    ["gridCellBorderOpacity", "gridCellBorderOpacityValue", g.cellBorderOpacity],
    ["gridNumberOpacity", "gridNumberOpacityValue", g.numberOpacity]
  ]) {
    const pct = Math.round(val * 100);
    $(slider).value = String(pct);
    $(valueEl).textContent = `${pct}%`;
  }
  applyGridAppearance(appearance);
}

function fillActionTypeSelect() {
  const sel = $("actionType");
  sel.innerHTML = "";
  for (const action of ACTION_CHOICES) {
    const opt = document.createElement("option");
    opt.value = action.type;
    opt.textContent = action.label;
    sel.appendChild(opt);
  }
}

function updateActionForm() {
  const type = $("actionType").value;
  const showSeekFields = type === "seek";
  const showVolumeFields = type === "volume";
  const showSpeedValue = type === "speed";
  const showSpeedSet = type === "speed_set";

  const showValue = showSeekFields || showVolumeFields || showSpeedValue || showSpeedSet;
  $("actionUnitWrap").hidden = !(showSeekFields || showVolumeFields);
  $("actionValueWrap").hidden = !showValue;
  $("actionUnitWrap").style.display = showSeekFields || showVolumeFields ? "grid" : "none";
  $("actionValueWrap").style.display = showValue ? "grid" : "none";

  const unit = $("actionUnit");
  unit.disabled = false;

  if (showSeekFields) {
    unit.innerHTML = `
      <option value="second">Second</option>
      <option value="frame">Frame</option>
    `;
    if (!["second", "frame"].includes(unit.value)) unit.value = "second";
    $("actionValue").placeholder = "0.5";
  } else if (showVolumeFields) {
    unit.innerHTML = `<option value="percent">%</option>`;
    unit.value = "percent";
    unit.disabled = true;
    $("actionValue").placeholder = "5";
  } else if (showSpeedValue) {
    $("actionValue").placeholder = "0.25";
  } else if (showSpeedSet) {
    $("actionValue").placeholder = "2";
  } else {
    $("actionValue").placeholder = "";
    $("actionValue").value = "";
  }
}

function showSection(sectionId) {
  document.querySelectorAll(".sectionPage").forEach((section) => {
    const active = section.id === sectionId;
    section.classList.toggle("active", active);
    section.hidden = !active;
  });

  document.querySelectorAll(".navItem").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === sectionId);
  });
}

function openZoneModal(zone, items) {
  modalZone = zone;
  editingActions = (items || []).map((item) => ({ ...item }));
  $("modalTitle").textContent = `Edit Zone ${zoneLabel(zone)}`;
  renderZoneActionsList();
  $("modalOverlay").hidden = false;
}

function closeZoneModal() {
  $("modalOverlay").hidden = true;
}

function openActionModal(index = null) {
  editingActionIndex = index;
  const item = index === null ? null : editingActions[index];

  $("actionModalTitle").textContent = item ? "Edit Action" : "Add Action";
  $("actionModalDelete").hidden = !item;

  $("actionType").value = item?.type || "seek";
  updateActionForm();
  $("actionUnit").value = item?.unit || ($("actionType").value === "volume" ? "percent" : "second");
  $("actionValue").value = item?.value ?? "";
  $("actionModalOverlay").hidden = false;
}

function closeActionModal() {
  $("actionModalOverlay").hidden = true;
  editingActionIndex = null;
}

function buildActionFromForm() {
  const type = $("actionType").value;
  const base = {
    id: editingActionIndex === null ? makeId() : editingActions[editingActionIndex].id,
    type,
    key: editingActionIndex === null ? "" : (editingActions[editingActionIndex].key || "")
  };

  if (["toggle_play", "toggle_fullscreen", "toggle_mute", "toggle_pip"].includes(type)) {
    return base;
  }

  const value = $("actionValue").value.trim();
  if (parseNumberInput(value) === null) return null;

  if (type === "seek") {
    return { ...base, unit: $("actionUnit").value, value };
  }

  if (type === "volume") {
    return { ...base, unit: "percent", value };
  }

  return { ...base, value };
}

function renderZoneActionsList() {
  const root = $("zoneActionsList");
  root.innerHTML = "";

  if (!editingActions.length) {
    const empty = document.createElement("div");
    empty.className = "emptyZoneActions";
    empty.textContent = "Add action...";
    root.appendChild(empty);
    return;
  }

  for (const item of editingActions) {
    const row = document.createElement("div");
    row.className = "zoneActionCard editable";
    row.addEventListener("click", () => openActionModal(editingActions.findIndex((x) => x.id === item.id)));

    const main = document.createElement("div");
    main.className = "zoneActionMain";

    const title = document.createElement("div");
    title.className = "zoneActionTitle";
    title.textContent = actionSummary(item);

    const meta = document.createElement("div");
    meta.className = "zoneActionMeta";
    meta.textContent = actionMeta(item);

    const keyBtn = document.createElement("button");
    keyBtn.className = `keyBadge${item.key ? "" : " empty"}`;
    keyBtn.textContent = keyBadgeLabel(item.key);
    keyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openKeyCapture(item.id);
    });

    const del = document.createElement("button");
    del.className = "btnGhost zoneActionDelete";
    del.textContent = "Remove";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      editingActions = editingActions.filter((x) => x.id !== item.id);
      renderZoneActionsList();
    });

    main.appendChild(title);
    main.appendChild(meta);
    row.appendChild(main);
    row.appendChild(keyBtn);
    row.appendChild(del);
    root.appendChild(row);
  }
}

let keyboardCaptureMode = false;

function openKeyCapture(actionId) {
  capturingActionId = actionId;
  keyboardCaptureMode = false;
  $("captureValue").textContent = "...";
  document.querySelectorAll(".triggerBtn").forEach((b) => b.classList.remove("capturing"));
  $("keyCaptureOverlay").hidden = false;
}

function closeKeyCapture() {
  $("keyCaptureOverlay").hidden = true;
  capturingActionId = null;
  keyboardCaptureMode = false;
}

function applyCapturedKey(key) {
  const item = editingActions.find((x) => x.id === capturingActionId);
  if (!item) return;
  item.key = key;
  $("captureValue").textContent = keyBadgeLabel(key);
  renderZoneActionsList();
  setTimeout(closeKeyCapture, 180);
}

// normalizeKeyCombo() يأتي من storage.js — لا تُعرِّف نسخة ثالثة (البند #11).

window.addEventListener("keydown", (e) => {
  if (!keyboardCaptureMode || capturingActionId === null || $("keyCaptureOverlay").hidden) return;
  e.preventDefault();
  e.stopPropagation();
  // Escape يلغي الالتقاط بدل أن يُربط كمفتاح — سلوك النافذة المتوقّع
  if (e.key === "Escape") { closeKeyCapture(); return; }
  const combo = normalizeKeyCombo(e);
  if (!combo) return;
  applyCapturedKey(combo);
}, { capture: true });

document.addEventListener("DOMContentLoaded", async () => {
  fillActionTypeSelect();
  showSection("zonesSection");

  // Idempotent, and a no-op read once there is nothing legacy left. Runs from
  // here AND from background.js on install/update (audit #26) — whichever gets
  // there second finds the work done and writes nothing.
  await migrateAll().catch(() => {});
  renderConflictNotice().catch(() => {});
  $("conflictDiscard")?.addEventListener("click", discardLegacySiteProfiles);

  const settings = await getSettings();
  const zones = settings.zones;
  const actions = zones.wheel.actions;

  $("enabled").checked = !!zones.enabled;
  $("fullscreenOnly").checked = !!zones.fullscreenOnly;
  $("gridFullFrame").checked = zones.gridCoverage !== "video";

  if (zonesWereMissing) {
    zones.wheel.actions = defaultZoneActions();
    await saveSettings(settings);
  }

  renderGrid(zones.wheel.actions);
  renderBlockedSites(settings.blockedHosts);
  renderSoundSettings(settings.soundDisplay);
  renderGridAppearance(settings.gridAppearance);
  renderOverlayTiming(settings.overlay);
  renderYtAutoQuality(settings.ytAutoQuality);
  renderYtShortsRedirect(settings.ytShortsRedirect);
  buildCleanPlayerList();
  renderCleanPlayer(settings.cleanPlayer);
  renderSubtitles(settings.subtitles);

  $("cleanPlayerEnabled").addEventListener("change", persistCleanPlayer);

  $("enabled").addEventListener("change", async () => {
    const s = await getSettings();
    s.zones.enabled = $("enabled").checked;
    if (zonesWereMissing) s.zones.wheel.actions = defaultZoneActions();
    await saveSettings(s);
    renderGrid(s.zones.wheel.actions);
  });

  $("fullscreenOnly").addEventListener("change", async () => {
    const s = await getSettings();
    s.zones.fullscreenOnly = $("fullscreenOnly").checked;
    await saveSettings(s);
  });

  $("gridFullFrame").addEventListener("change", async () => {
    const s = await getSettings();
    s.zones.gridCoverage = $("gridFullFrame").checked ? "player" : "video";
    await saveSettings(s);
  });

  $("reset").addEventListener("click", async () => {
    const s = await getSettings();
    s.zones = { enabled: true, fullscreenOnly: false, gridCoverage: "player", wheel: { map: {}, actions: defaultZoneActions() } };
    s.gridAppearance = { ...GRID_APPEARANCE_DEFAULTS };
    await saveSettings(s);
    $("enabled").checked = true;
    $("fullscreenOnly").checked = false;
    $("gridFullFrame").checked = true;
    renderGrid(s.zones.wheel.actions);
    renderBlockedSites(s.blockedHosts);
    renderSoundSettings(s.soundDisplay);
    renderGridAppearance(s.gridAppearance);
  });

  $("soundColor").addEventListener("change", async () => {
    const s = await getSettings();
    s.soundDisplay ||= { color: "#ffffff", fontSize: 48 };
    s.soundDisplay.color = $("soundColor").value;
    await saveSettings(s);
    renderSoundSettings(s.soundDisplay);
  });

  $("soundSize").addEventListener("input", () => {
    $("soundSizeValue").textContent = `${$("soundSize").value}px`;
  });

  $("soundSize").addEventListener("change", async () => {
    const s = await getSettings();
    s.soundDisplay ||= { color: "#ffffff", fontSize: 48 };
    s.soundDisplay.fontSize = Number($("soundSize").value);
    await saveSettings(s);
    renderSoundSettings(s.soundDisplay);
  });

  $("gridCellBg").addEventListener("change", async () => {
    const s = await getSettings();
    s.gridAppearance = { ...resolveGridAppearance(s.gridAppearance), cellBg: $("gridCellBg").value };
    await saveSettings(s);
    renderGridAppearance(s.gridAppearance);
  });

  $("gridCellBorder").addEventListener("change", async () => {
    const s = await getSettings();
    s.gridAppearance = { ...resolveGridAppearance(s.gridAppearance), cellBorder: $("gridCellBorder").value };
    await saveSettings(s);
    renderGridAppearance(s.gridAppearance);
  });

  $("gridNumberColor").addEventListener("change", async () => {
    const s = await getSettings();
    s.gridAppearance = { ...resolveGridAppearance(s.gridAppearance), numberColor: $("gridNumberColor").value };
    await saveSettings(s);
    renderGridAppearance(s.gridAppearance);
  });

  for (const [slider, valueEl, field] of [
    ["gridCellBgOpacity", "gridCellBgOpacityValue", "cellBgOpacity"],
    ["gridCellBorderOpacity", "gridCellBorderOpacityValue", "cellBorderOpacity"],
    ["gridNumberOpacity", "gridNumberOpacityValue", "numberOpacity"]
  ]) {
    $(slider).addEventListener("input", () => {
      $(valueEl).textContent = `${$(slider).value}%`;
      applyGridAppearance({
        ...resolveGridAppearance({
          cellBg: $("gridCellBg").value,
          cellBorder: $("gridCellBorder").value,
          numberColor: $("gridNumberColor").value,
          radius: Number($("gridRadius").value),
          cellBgOpacity: Number($("gridCellBgOpacity").value) / 100,
          cellBorderOpacity: Number($("gridCellBorderOpacity").value) / 100,
          numberOpacity: Number($("gridNumberOpacity").value) / 100
        })
      });
    });
    $(slider).addEventListener("change", async () => {
      const s = await getSettings();
      s.gridAppearance = { ...resolveGridAppearance(s.gridAppearance), [field]: Number($(slider).value) / 100 };
      await saveSettings(s);
      renderGridAppearance(s.gridAppearance);
    });
  }

  // إعادة مظهر الشبكة وحدها: حذف المفتاح يعيد المظهر الأصلي بلا لمس أي إعداد آخر
  $("gridAppearanceReset").addEventListener("click", async () => {
    const s = await getSettings();
    delete s.gridAppearance;
    if (await saveSettings(s)) {
      renderGridAppearance(undefined);
      showToast("ok", "أُعيد مظهر الشبكة للافتراضي");
    }
  });

  $("gridRadius").addEventListener("input", () => {
    $("gridRadiusValue").textContent = `${$("gridRadius").value}px`;
    applyGridAppearance({
      cellBg: $("gridCellBg").value,
      cellBorder: $("gridCellBorder").value,
      numberColor: $("gridNumberColor").value,
      radius: Number($("gridRadius").value),
      cellBgOpacity: Number($("gridCellBgOpacity").value) / 100,
      cellBorderOpacity: Number($("gridCellBorderOpacity").value) / 100,
      numberOpacity: Number($("gridNumberOpacity").value) / 100
    });
  });

  $("gridRadius").addEventListener("change", async () => {
    const s = await getSettings();
    s.gridAppearance = { ...resolveGridAppearance(s.gridAppearance), radius: Number($("gridRadius").value) };
    await saveSettings(s);
    renderGridAppearance(s.gridAppearance);
  });

  async function persistOverlayTiming() {
    const s = await getSettings();
    const grid = Number($("gridDuration").value);
    const vol = Number($("volumeDuration").value);
    s.overlay ||= {};
    s.overlay.autoHideMs = grid;
    s.overlay.volumeAutoHideMs = vol;
    s.overlay.enabled = grid > 0 || vol > 0;
    await saveSettings(s);
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { type: "RELOAD_OVERLAY_SETTINGS" }).catch(() => {});
    }
  }

  $("gridDuration").addEventListener("input", () => {
    $("gridDurationValue").textContent = formatDurationMs(Number($("gridDuration").value));
  });
  $("gridDuration").addEventListener("change", persistOverlayTiming);
  $("volumeDuration").addEventListener("input", () => {
    $("volumeDurationValue").textContent = formatDurationMs(Number($("volumeDuration").value));
  });
  $("volumeDuration").addEventListener("change", persistOverlayTiming);

  async function persistSubtitles() {
    syncCleanPlayerCaptionNote(); // immediate, before the storage round-trip
    const s = await getSettings();
    s.subtitles = {
      enabled: $("subEnabled").checked,
      hideOnPreviews: $("subHidePreviews").checked,
      defaultLang: $("subLang").value.trim().toLowerCase(),
      fontSize: Number($("subFontSize").value),
      color: $("subColor").value,
      bgColor: $("subBgColor").value,
      bgOpacity: Number($("subBgOpacity").value) / 100,
      fontFamily: $("subFontFamily").value,
      position: $("subPosition").value
    };
    await saveSettings(s);
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { type: "RELOAD_SUBTITLES" }).catch(() => {});
    }
  }

  $("subFontSize").addEventListener("input", () => {
    $("subFontSizeValue").textContent = `${$("subFontSize").value}px`;
  });
  $("subBgOpacity").addEventListener("input", () => {
    $("subBgOpacityValue").textContent = `${$("subBgOpacity").value}%`;
  });
  // Any subtitle setting change auto-enables the feature so the user sees results
  for (const id of ["subLang","subFontSize","subColor","subBgColor","subBgOpacity","subFontFamily","subPosition"]) {
    $(id).addEventListener("change", () => {
      $("subEnabled").checked = true;
      persistSubtitles();
    });
  }
  $("subEnabled").addEventListener("change", persistSubtitles);
  // ليس ضمن قائمة التفعيل التلقائي أعلاه: هذا إخفاء للترجمة لا إعداد تنسيق،
  // فلا معنى لأن يُشغّل تنسيق الترجمة المخصص من تلقائه
  $("subHidePreviews").addEventListener("change", persistSubtitles);

  $("ytQuality").addEventListener("change", async () => {
    const s = await getSettings();
    s.ytAutoQuality = $("ytQuality").value;
    await saveSettings(s);
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { type: "RELOAD_YT_QUALITY" }).catch(() => {});
    }
  });

  $("ytShortsRedirect").addEventListener("change", async () => {
    const s = await getSettings();
    s.ytShortsRedirect = $("ytShortsRedirect").checked;
    await saveSettings(s);
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { type: "RELOAD_YT_SHORTS" }).catch(() => {});
    }
  });

  $("modalClose").addEventListener("click", closeZoneModal);
  $("modalCancel").addEventListener("click", closeZoneModal);
  $("modalOverlay").addEventListener("click", (e) => {
    if (e.target === $("modalOverlay")) closeZoneModal();
  });

  $("addActionBtn").addEventListener("click", () => openActionModal(null));
  $("actionType").addEventListener("change", updateActionForm);
  $("actionModalClose").addEventListener("click", closeActionModal);
  $("actionModalCancel").addEventListener("click", closeActionModal);
  $("actionModalOverlay").addEventListener("click", (e) => {
    if (e.target === $("actionModalOverlay")) closeActionModal();
  });

  $("actionModalDelete").addEventListener("click", () => {
    if (editingActionIndex === null) return;
    editingActions.splice(editingActionIndex, 1);
    renderZoneActionsList();
    closeActionModal();
  });

  $("actionModalSave").addEventListener("click", () => {
    const item = buildActionFromForm();
    if (!item) {
      $("actionValue").focus();
      return;
    }

    if (editingActionIndex === null) {
      editingActions.push(item);
    } else {
      editingActions[editingActionIndex] = item;
    }

    renderZoneActionsList();
    closeActionModal();
  });

  $("keyCaptureClose").addEventListener("click", closeKeyCapture);
  $("keyCaptureCancel").addEventListener("click", closeKeyCapture);
  $("keyCaptureOverlay").addEventListener("click", (e) => {
    if (e.target === $("keyCaptureOverlay")) closeKeyCapture();
  });

  document.querySelectorAll(".triggerBtn[data-trigger]").forEach((btn) => {
    btn.addEventListener("click", () => {
      keyboardCaptureMode = false;
      applyCapturedKey(btn.dataset.trigger);
    });
  });

  const kbdBtn = $("keyCaptureKeyboard");
  if (kbdBtn) {
    kbdBtn.addEventListener("click", () => {
      keyboardCaptureMode = true;
      document.querySelectorAll(".triggerBtn").forEach((b) => b.classList.remove("capturing"));
      kbdBtn.classList.add("capturing");
      $("captureValue").textContent = "اضغط على المفتاح الآن…";
    });
  }

  $("modalSave").addEventListener("click", async () => {
    const s = await getSettings();
    ensureZoneActions(s);
    s.zones.wheel.actions[String(modalZone)] = editingActions.map((item) => ({ ...item }));
    await saveSettings(s);
    renderGrid(s.zones.wheel.actions);
    closeZoneModal();
  });

  document.querySelectorAll(".navItem").forEach((item) => {
    item.addEventListener("click", () => showSection(item.dataset.section));
  });

  setupBackupUI();
});

// Re-render UI whenever settings change from any source (popup, another tab, etc.)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.settings) return;
  (async () => {
    const s = await getSettings();
    $("enabled").checked         = !!s.zones?.enabled;
    $("fullscreenOnly").checked  = !!s.zones?.fullscreenOnly;
    $("gridFullFrame").checked   = s.zones?.gridCoverage !== "video";
    renderBlockedSites(s.blockedHosts);
    renderSoundSettings(s.soundDisplay);
    renderGridAppearance(s.gridAppearance);
    renderOverlayTiming(s.overlay);
    renderSubtitles(s.subtitles);
    renderYtAutoQuality(s.ytAutoQuality);
    renderYtShortsRedirect(s.ytShortsRedirect);
    // Don't clobber checkboxes the user is toggling while a save is in flight
    if (!cleanPlayerSaving) renderCleanPlayer(s.cleanPlayer);
    // Don't interrupt active zone editing
    if ($("modalOverlay")?.hidden !== false) {
      renderGrid(s.zones?.wheel?.actions || {});
    }
  })();
});

function setBackupStatus(kind, text) {
  const el = $("backupStatus");
  if (!el) return;
  el.className = "backupStatus";
  if (kind === "ok") el.classList.add("ok");
  if (kind === "bad") el.classList.add("bad");
  el.textContent = text || "";
}

function downloadJSON(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// v1 = one `siteProfiles` blob · v2 = one `sp:<domain>` key per site.
// A v1 file still imports: migrateSiteProfiles() shards it right after the write.
const BACKUP_VERSION = 2;

async function exportAllSettings() {
  // get(null) is the whole account, so every sp:* shard is included automatically.
  const data = await chrome.storage.sync.get(null);
  const payload = {
    __vizExport: true,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadJSON(`video-zones-backup-${stamp}.json`, payload);
  setBackupStatus("ok", `تم تصدير الإعدادات بنجاح (${Object.keys(data).length} عنصراً)`);
}

// → null when the file is safe to restore, otherwise an Arabic reason.
function validateBackup(parsed) {
  const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

  if (!isObj(parsed)) return "الملف غير صالح";
  if (!parsed.__vizExport) return "الملف ليس من نسخ هذه الإضافة";

  const v = Number(parsed.version);
  if (!Number.isFinite(v) || v < 1) return "رقم نسخة الملف غير صالح";
  if (v > BACKUP_VERSION) return `الملف من نسخة أحدث (${v}) — حدّث الإضافة أولاً`;

  const d = parsed.data;
  if (!isObj(d)) return "بنية الملف غير صالحة";

  // Type-check every key content.js reads, so a malformed file can never reach
  // storage and break the loaders on every page (see audit item #3).
  if ("settings" in d && !isObj(d.settings)) return "حقل settings تالف في الملف";
  if ("globalSiteRules" in d && !isObj(d.globalSiteRules)) return "حقل globalSiteRules تالف في الملف";
  if ("siteProfiles" in d && !isObj(d.siteProfiles)) return "حقل siteProfiles تالف في الملف";
  if (isObj(d.settings)) {
    const s = d.settings;
    if ("blockedHosts" in s && !Array.isArray(s.blockedHosts)) return "قائمة المواقع المحظورة تالفة";
    if ("zones" in s && !isObj(s.zones)) return "إعدادات المربعات تالفة في الملف";
  }
  for (const k of Object.keys(d)) {
    if (isSpKey(k) && !isObj(d[k])) return `قواعد الموقع تالفة في الملف: ${spHost(k)}`;
  }
  return null;
}

async function importAllSettings(file) {
  if (!file) return;

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    setBackupStatus("bad", `فشل قراءة الملف: ${err?.message || err}`);
    return;
  }

  const invalid = validateBackup(parsed);
  if (invalid) { setBackupStatus("bad", invalid); return; }

  if (!confirm("سيتم استبدال الإعدادات الحالية بالكامل. متأكد؟")) {
    setBackupStatus("bad", "تم إلغاء العملية");
    return;
  }

  // clear() before set() means a failed set leaves the user with NOTHING, so we
  // snapshot first and put it back if anything goes wrong (audit item #1).
  // Deliberately NOT safeSyncSet: its guard measures storage as it is now, but we
  // are about to clear it, so every check would be against a total that no longer
  // exists. The snapshot restore below is this path's safety net instead.
  const snapshot = await chrome.storage.sync.get(null);
  try {
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(parsed.data);
  } catch (err) {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(snapshot);
      setBackupStatus("bad", `فشل الاستيراد وأُعيدت إعداداتك السابقة: ${syncErrorText(err)}`);
    } catch {
      setBackupStatus("bad", "فشل الاستيراد وتعذّرت الاستعادة — استورد ملف نسخة احتياطية فوراً");
    }
    return;
  }

  // A v1 file lands as a legacy blob; shard it before anything reads it.
  const migrated = await migrateSiteProfiles().catch(() => ({ ok: false }));
  if (!migrated.ok) {
    setBackupStatus("bad", "استُوردت الإعدادات لكن تعذّرت تجزئة قواعد المواقع — افتح الصفحة مجدداً");
    return;
  }

  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id) chrome.tabs.sendMessage(t.id, { type: "GVZ_RELOAD" }).catch(() => {});
  }

  setBackupStatus("ok", "تم استيراد الإعدادات. أعد تحميل الصفحة لتظهر التغييرات في المحرر");
  setTimeout(() => location.reload(), 900);
}

function setupBackupUI() {
  const exportBtn = $("exportBtn");
  const importBtn = $("importBtn");
  const fileInput = $("importFile");

  if (exportBtn) exportBtn.addEventListener("click", exportAllSettings);
  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      importAllSettings(file);
    });
  }
}
