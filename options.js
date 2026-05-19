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

let modalZone = 1;
let editingActions = [];
let editingActionIndex = null;
let capturingActionId = null;

function makeId() {
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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

function parseRuntimeAction(action, key) {
  if (!action) return null;

  if (action === "ACTION:TOGGLE_PLAY") return { id: makeId(), type: "toggle_play", key };
  if (action === "ACTION:TOGGLE_FULLSCREEN") return { id: makeId(), type: "toggle_fullscreen", key };
  if (action === "ACTION:TOGGLE_MUTE") return { id: makeId(), type: "toggle_mute", key };
  if (action === "ACTION:TOGGLE_PIP") return { id: makeId(), type: "toggle_pip", key };

  if (action.startsWith("ACTION:SEEK:")) {
    return { id: makeId(), type: "seek", unit: "second", value: action.split(":")[2], key };
  }
  if (action.startsWith("ACTION:VOLUME:")) {
    return { id: makeId(), type: "volume", unit: "percent", value: action.split(":")[2], key };
  }
  if (action.startsWith("ACTION:SPEED:SET:")) {
    return { id: makeId(), type: "speed_set", value: action.split(":")[3], key };
  }
  if (action.startsWith("ACTION:SPEED:")) {
    return { id: makeId(), type: "speed", value: action.split(":")[2], key };
  }

  return null;
}

function normalizeActionArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function ensureZoneActions(settings) {
  settings.zones ||= { enabled: true, fullscreenOnly: false, wheel: { map: {}, actions: {} } };
  settings.zones.fullscreenOnly = settings.zones.fullscreenOnly === true;
  settings.zones.wheel ||= { map: {}, actions: {} };
  settings.zones.wheel.map ||= {};
  settings.zones.wheel.actions ||= {};

  for (let zone = 1; zone <= 9; zone++) {
    const key = String(zone);
    if (Array.isArray(settings.zones.wheel.actions[key])) continue;

    const legacy = settings.zones.wheel.map[key] || {};
    const actions = [];

    for (const action of normalizeActionArray(legacy.up)) {
      const parsed = parseRuntimeAction(action, "up");
      if (parsed) actions.push(parsed);
    }
    for (const action of normalizeActionArray(legacy.down)) {
      const parsed = parseRuntimeAction(action, "down");
      if (parsed) actions.push(parsed);
    }

    settings.zones.wheel.actions[key] = actions;
  }

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
  settings.gridAppearance ||= {
    cellBg: "#10131a",
    cellBorder: "#2a2f3a",
    numberColor: "#a3a3a3",
    radius: 12
  };
  settings.overlay ||= {};
  if (typeof settings.overlay.autoHideMs !== "number") settings.overlay.autoHideMs = 900;
  // Default volumeAutoHideMs to existing autoHideMs for migration; keeps existing user choice for both
  if (typeof settings.overlay.volumeAutoHideMs !== "number") settings.overlay.volumeAutoHideMs = settings.overlay.autoHideMs;
  if (typeof settings.overlay.enabled !== "boolean") settings.overlay.enabled = settings.overlay.autoHideMs > 0;
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
  ensureZoneActions(settings);
  return settings;
}

async function saveSettings(settings) {
  rebuildWheelMap(settings);
  await chrome.storage.sync.set({ settings });
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id) chrome.tabs.sendMessage(t.id, { type: "GVZ_RELOAD" }).catch(() => {});
  }
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

function applyGridAppearance(appearance) {
  const root = document.documentElement;
  root.style.setProperty("--grid-cell-bg", appearance?.cellBg || "#10131a");
  root.style.setProperty("--grid-cell-border", appearance?.cellBorder || "#2a2f3a");
  root.style.setProperty("--grid-number-color", appearance?.numberColor || "#a3a3a3");
  root.style.setProperty("--grid-cell-radius", `${Number(appearance?.radius || 12)}px`);
}

function renderSubtitles(sub) {
  if (!sub) return;
  $("subEnabled").checked = !!sub.enabled;
  $("subLang").value = sub.defaultLang || "";
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
  const next = appearance || {
    cellBg: "#10131a",
    cellBorder: "#2a2f3a",
    numberColor: "#a3a3a3",
    radius: 12
  };

  $("gridCellBg").value = next.cellBg;
  $("gridCellBorder").value = next.cellBorder;
  $("gridNumberColor").value = next.numberColor;
  $("gridRadius").value = String(Number(next.radius || 12));
  $("gridRadiusValue").textContent = `${Number(next.radius || 12)}px`;
  applyGridAppearance(next);
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

function normalizeKeyboardEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");

  let k = e.key;
  if (k === " ") k = "Space";
  if (k === "Escape") return null;
  if (["Control", "Shift", "Alt", "Meta"].includes(k)) return null;

  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join("+");
}

window.addEventListener("keydown", (e) => {
  if (!keyboardCaptureMode || capturingActionId === null || $("keyCaptureOverlay").hidden) return;
  e.preventDefault();
  e.stopPropagation();
  const combo = normalizeKeyboardEvent(e);
  if (!combo) return;
  applyCapturedKey(combo);
}, { capture: true });

document.addEventListener("DOMContentLoaded", async () => {
  fillActionTypeSelect();
  showSection("zonesSection");

  const settings = await getSettings();
  const zones = settings.zones;
  const actions = zones.wheel.actions;

  $("enabled").checked = !!zones.enabled;
  $("fullscreenOnly").checked = !!zones.fullscreenOnly;

  if (Object.keys(actions).every((key) => !actions[key]?.length)) {
    zones.wheel.actions = defaultZoneActions();
    await saveSettings(settings);
  }

  renderGrid(zones.wheel.actions);
  renderBlockedSites(settings.blockedHosts);
  renderSoundSettings(settings.soundDisplay);
  renderGridAppearance(settings.gridAppearance);
  renderOverlayTiming(settings.overlay);
  renderSubtitles(settings.subtitles);

  $("enabled").addEventListener("change", async () => {
    const s = await getSettings();
    s.zones.enabled = $("enabled").checked;
    if (Object.keys(s.zones.wheel.actions).every((key) => !s.zones.wheel.actions[key]?.length)) {
      s.zones.wheel.actions = defaultZoneActions();
    }
    await saveSettings(s);
    renderGrid(s.zones.wheel.actions);
  });

  $("fullscreenOnly").addEventListener("change", async () => {
    const s = await getSettings();
    s.zones.fullscreenOnly = $("fullscreenOnly").checked;
    await saveSettings(s);
  });

  $("reset").addEventListener("click", async () => {
    const s = await getSettings();
    s.zones = { enabled: true, fullscreenOnly: false, wheel: { map: {}, actions: defaultZoneActions() } };
    s.gridAppearance = {
      cellBg: "#10131a",
      cellBorder: "#2a2f3a",
      numberColor: "#a3a3a3",
      radius: 12
    };
    await saveSettings(s);
    $("enabled").checked = true;
    $("fullscreenOnly").checked = false;
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
    s.gridAppearance ||= {};
    s.gridAppearance.cellBg = $("gridCellBg").value;
    await saveSettings(s);
    renderGridAppearance(s.gridAppearance);
  });

  $("gridCellBorder").addEventListener("change", async () => {
    const s = await getSettings();
    s.gridAppearance ||= {};
    s.gridAppearance.cellBorder = $("gridCellBorder").value;
    await saveSettings(s);
    renderGridAppearance(s.gridAppearance);
  });

  $("gridNumberColor").addEventListener("change", async () => {
    const s = await getSettings();
    s.gridAppearance ||= {};
    s.gridAppearance.numberColor = $("gridNumberColor").value;
    await saveSettings(s);
    renderGridAppearance(s.gridAppearance);
  });

  $("gridRadius").addEventListener("input", () => {
    $("gridRadiusValue").textContent = `${$("gridRadius").value}px`;
    applyGridAppearance({
      cellBg: $("gridCellBg").value,
      cellBorder: $("gridCellBorder").value,
      numberColor: $("gridNumberColor").value,
      radius: Number($("gridRadius").value)
    });
  });

  $("gridRadius").addEventListener("change", async () => {
    const s = await getSettings();
    s.gridAppearance ||= {};
    s.gridAppearance.radius = Number($("gridRadius").value);
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
    const s = await getSettings();
    s.subtitles = {
      enabled: $("subEnabled").checked,
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

async function exportAllSettings() {
  const data = await chrome.storage.sync.get(null);
  const payload = {
    __vizExport: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadJSON(`video-zones-backup-${stamp}.json`, payload);
  setBackupStatus("ok", "تم تصدير الإعدادات بنجاح");
}

async function importAllSettings(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !parsed.__vizExport || !parsed.data || typeof parsed.data !== "object") {
      setBackupStatus("bad", "الملف غير صالح أو ليس من نسخ الإضافة");
      return;
    }
    if (!confirm("سيتم استبدال الإعدادات الحالية بالكامل. متأكد؟")) {
      setBackupStatus("bad", "تم إلغاء العملية");
      return;
    }
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(parsed.data);

    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id) chrome.tabs.sendMessage(t.id, { type: "GVZ_RELOAD" }).catch(() => {});
    }

    setBackupStatus("ok", "تم استيراد الإعدادات. أعد تحميل الصفحة لتظهر التغييرات في المحرر");
    setTimeout(() => location.reload(), 900);
  } catch (err) {
    setBackupStatus("bad", `فشل قراءة الملف: ${err?.message || err}`);
  }
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
