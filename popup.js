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

// صفّ قاعدة واحد، عناصرَ لا نصّ HTML (البند #32). قيمتا `from` و`to` تأتيان من
// التخزين ومن ملفّ نسخة احتياطية، فقد تحملان `<` أو `&` — وقالبٌ نصّي كان يهرب
// من `"` وحدها فيمرّ الباقي ويُفسد العرض. التعيين على `value` لا يُفسَّر أبداً.
// (وليست ثغرة: CSP في MV3 يمنع المعالجات السطرية — العطب في العرض لا في الأمان.)
function ruleRow(m, idx, delKey) {
  const div = document.createElement("div");
  div.className = "rule";

  for (const k of ["from", "to"]) {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = m[k] || "";
    inp.dataset.i = String(idx);
    inp.dataset.k = k;
    div.appendChild(inp);
  }

  const del = document.createElement("button");
  del.className = "btnDanger delBtn";
  del.type = "button";
  del.title = "حذف";
  del.dataset[delKey] = String(idx);
  del.textContent = "🗑️";
  div.appendChild(del);

  return div;
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";

  const c = $("count");
  if (c) c.textContent = String(mappings.length);

  mappings.forEach((m, idx) => list.appendChild(ruleRow(m, idx, "del")));

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

// ⚠️ **نظير `"matches": ["*://*.youtube.com/*"]` في `manifest.json` حرفياً**
// (البند #38ج). الغرض أن يحقن التفعيل اليدوي **ما يحقنه المانيفست، حيث يحقنه، لا
// أوسع**: توسيعه هنا يجعل اليدوي يفعل ما لا يفعله التلقائي، فينكسر «صفر تغيّر»
// من الجهة الأخرى. وإن تغيّر النمط في المانيفست **يُغيَّر هنا معه**، ويحرسه
// `tools/test-manual-inject.js`.
function isYouTubeUrl(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
  return host === "youtube.com" || host.endsWith(".youtube.com");
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

  // ── البند #64 — الرئيسي أعلى الترتيب هنا كما هو في `content.js` ────────────
  // بلا هذا الفحص تقول الحالة «الإضافة شغالة» والمفتاح الرئيسي مطفأ — وهو **كذب
  // في الاتجاه المعاكس**: كنّا نُطفئ ولا يُطفأ شيء، فلا نُبدله بأن نُطفئ ونقول شغّالة.
  if (!(await getMasterEnabled())) {
    setYtQualityGap(null);
    setStatus("bad", "المفتاح الرئيسي مطفأ — الإضافة متوقفة كلياً");
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

  // ── البند #64 — لا صمت بلا معنى ───────────────────────────────────────────
  // **التفعيل اليدوي يخرق الحظر عمداً، ولا يخرق المفتاح الرئيسي.** فلو تُرك
  // الزرّ يعمل والرئيسي مطفأ لضُغط **فلا يحدث شيء** — وهو **درس `skip` الذي كان
  // يبتلع الشارة: صمتٌ تامّ يبدو تعطّلاً**. فيُعطَّل ظاهراً **بسبب مقروء**.
  // (وهذا حارس ثانٍ: `syncMasterUi` يعطّل الزرّ بصرياً، وهذا يمنع المسار نفسه.)
  const master = await getMasterEnabled();
  if (!master) {
    setStatus("bad", "المفتاح الرئيسي مطفأ — شغّل «تشغيل الإضافة» أولاً");
    return;
  }

  try {
    // ── البند #38ج ────────────────────────────────────────────────────────────
    // **المانيفست يحقن سكربتين، وهذا المسار كان يحقن واحداً.**
    // `yt_quality_main.js` يعيش في عالم الصفحة (`world: "MAIN"`) لأن واجهة جودة
    // يوتيوب لا تُرى من العالم المعزول، وهو **المستمع الوحيد** لـ`__vz_setq__`
    // الذي يرسله `content.js`. فبلا حقنه هنا **تذهب الرسالة إلى لا أحد بصمت**.
    // **قِيس:** المستمع يردّ خلال **202ms** حيث يوجد، و**لا ردّ إطلاقاً** حيث لا
    // يوجد — والتمييز بينهما هو ما بُني عليه هذا الإصلاح، لا قيمة الجودة نفسها
    // (فـABR يوتيوب يغيّرها من تلقائه، ورُصد ذلك).
    //
    // **وقبل `content.js` عمداً:** بدء `content.js` ينادي `triggerYtQuality()`
    // مباشرةً، فبوجود المستمع سلفاً **تُطبَّق الجودة فوراً عند التفعيل** بلا
    // انتظار `yt-navigate-start` — والحقن المتأخّر يفوته ما سبقه.
    //
    // **ومقيَّد بمضيفي يوتيوب وحدهم:** لا يُحقن حيث لا فائدة.
    if (isYouTubeUrl(url)) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["yt_quality_main.js"],
        world: "MAIN"
      });
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["content.js"]
    });
    // ── البند #38ج — الإيقاظ ──────────────────────────────────────────────────
    // **الحقن وحده لا يكفي، وقِيس:** إن كان `content.js` حاضراً سلفاً فحقنه
    // **لا عمل له** (حارس `__GVZ_CONTENT_LOADED__`) ⇒ **لا بدء جديد فلا نداء**،
    // وعدّاد الإرسال بقي كما هو — بينما في الحالة الأخرى (غائب) يبدأ وينادي.
    // **فتُرسَل الرسالة في الحالتين** كي تنتهيا إلى **الحالة نفسها**، لا كي
    // «تعملا كلتاهما»: في الحالة الغائبة تصل بعد بدءٍ نفّذ الخطوة، فتجدها
    // مُنفَّذة ولا تكرّرها (idempotent).
    // ولا `await` ولا ردّ يُنتظر: إطار خرج مبكراً لا يستيقظ، وغياب مستقبِل ليس خطأً.
    chrome.tabs.sendMessage(tab.id, { type: "GVZ_ACTIVATED" }).catch(() => {});
    await checkPageStatus();
  } catch {
    setStatus("bad", "فشل التفعيل اليدوي على هذه الصفحة");
  }
}


// ── البند #64 — المفتاح الرئيسي ─────────────────────────────────────────────
// **افتراضه مُشغَّل بنمط `!== false`** — نظير `loadMasterEnabled` في
// `content.js` حرفياً: ملفّ لم يُفتح إعداده قط يسلك سلوك اليوم، **فصفر تغيّر
// سلوكي افتراضياً**. أي انحراف بين النسختين يجعل الواجهة تكذب على المستخدم.
async function getMasterEnabled() {
  const data = await chrome.storage.sync.get({ settings: {} });
  return (data.settings || {}).enabled !== false;
}

// الحفظ يمرّ بـ`safeSyncSet` كبقيّة الكتابات، ولا يطمس بقيّة `settings`.
// #69: الرسم من التخزين — تستهلك المُحمِّلات القائمة نفسها، فلا منطق ثانٍ
async function renderPopupFromStorage() {
  await Promise.allSettled([
    loadGlobalData(), loadSiteProfile(), loadBlockedSiteUI(),
    loadSubtitlesToggle(), loadFullscreenOnlyToggle(), loadOverlayUI(), fillDubPrefsUI(),
    (async () => { syncMasterUi(await getMasterEnabled()); })()
  ]);
}

async function saveMasterEnabled(on) {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings && typeof data.settings === "object" ? data.settings : {};
  settings.enabled = !!on;
  const res = await safeSyncSet({ settings });
  if (!res?.ok) {
    setStatus("bad", res?.error || "تعذّر حفظ المفتاح الرئيسي");
    return false;
  }
  // كل تبويب يعيد القراءة فوراً — بلا إعادة تحميل، كبقيّة قنوات التحديث
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id) chrome.tabs.sendMessage(t.id, { type: "GVZ_RELOAD" }).catch(() => {});
  }
  return true;
}

// **الزرّ يُعطَّل ظاهراً بسبب مقروء** — لا زرٌّ يُضغط فلا يحدث شيء (#64).
function syncMasterUi(on) {
  const btn = $("manualActivate");
  if (!btn) return;
  btn.disabled = !on;
  btn.style.opacity = on ? "" : "0.5";
  btn.style.cursor = on ? "" : "not-allowed";
  btn.title = on ? "" : "المفتاح الرئيسي مطفأ — شغّل «تشغيل الإضافة» أولاً";
}

async function loadMasterUi() {
  const on = await getMasterEnabled();
  $("masterEnabled").checked = on;
  syncMasterUi(on);
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

  siteMappings.forEach((m, idx) => list.appendChild(ruleRow(m, idx, "sdel")));

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

// NEVER broadcasts. A frameId-less send is the exact construct audit #24 names: it
// lets every frame build its own AudioContext and lets an arbitrary one answer
// GET_VOLUME_BOOST. With no resolved frame there is simply no video to boost, so the
// right move is to refuse the send, not to shout at every frame.
function sendToVideoFrame(message) {
  if (boostFrameId == null) return Promise.reject(new Error("no-video-frame"));
  return chrome.tabs.sendMessage(boostTabId, message, { frameId: boostFrameId });
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
    // null would downgrade the retry into a broadcast, which is the bug itself
    if (fresh == null || fresh === boostFrameId) throw err;
    boostFrameId = fresh;
    return await sendToVideoFrame(message);
  }
}

// A slider that slides with nothing behind it is worse than one that says why.
function setBoostAvailable(available) {
  const slider = $("boostSlider");
  if (!slider) return;
  slider.disabled = !available;
  slider.title = available ? "" : "لا فيديو في هذه الصفحة";
}

async function loadBoostUI() {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  boostTabId = tab.id;
  boostFrameId = await findVideoFrameId(tab.id);
  setBoostAvailable(boostFrameId != null);
  if (boostFrameId == null) {
    $("boostSlider").value = 100;
    $("boostValue").textContent = "100%";
    setBoostNote("no_video");
    return;
  }
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

// ── #168 — الدبلجة العربية (تجريبيّة · فرع 168-dub-mac) ─────────────────────────
// **المحرّكُ في الصفحة لا هنا**: إغلاقُ البوب-أب لا يوقفه، والبوب-أب يقول ما يجري أو لماذا لا (168ب).
// كلُّ رسالةٍ إلى الإطار الأعلى وحدَه (`frameId: 0`) — لا إرسالَ بلا إطار (#24).
// ⭐ **وخياراتُ المالك الأربع (2026-11-01: «حجم صوت الترجمه · اختيار سرعه الترجمه او تركه تلقائي ·
// تغيير المترجم او صوت المترجم» ومصدرُ النصّ العربيّ)** تُحفظ في `settings.dub` بـ`safeSyncSet` (قرار 1:
// `sync` وحدَه)، **والصوتُ لكلّ نظامٍ وحدَه** (§٣: أصواتُ الماك غيرُ أصوات الويندوز) — وتصل المحرّكَ مع
// «دبلِج» ومع كلّ تغيير (`GVZ_DUB_SET`)، فلا يقرأ المحرّكُ التخزينَ ولا يُنسى منها شيء.
const DUB_REASON_TEXT = {
  gate: "الإضافة مطفأة أو هذا الموقع محظور",
  "no-video": "لا فيديو في هذه الصفحة",
  "main-missing": "تعذّر الوصول إلى مشغّل يوتيوب — أعد تحميل الصفحة ثمّ جرّب",
  "no-player": "مشغّل يوتيوب لم يجهز بعد — انتظر بدء الفيديو ثمّ جرّب",
  "stale-player": "المشغّل ما زال يحمل الفيديو السابق — انتظر بدء الفيديو أو أعد تحميل الصفحة",
  unplayable: "يوتيوب لا يشغّل هذا الفيديو هنا",
  ad: "إعلانٌ يُعرض — اضغط «دبلِج» بعد انتهائه",
  nav: "تغيّر الفيديو أثناء التجهيز — اضغط «دبلِج» ثانيةً",
  live: "بثٌّ مباشر — لا دبلجة للبثّ الآن",
  arNow: "يوتيوب يُسمعك هذا الفيديو بالعربية سلفاً",
  arOffer: "لهذا الفيديو صوتٌ عربيٌّ من يوتيوب: اختره من ⚙ في المشغّل ⇐ «المسار الصوتي»",
  arVid: "الفيديو عربيّ الكلام أصلاً",
  none: "لا ترجمةَ نصّيّة لهذا الفيديو — والدبلجة تقرأ منها",
  other: "لا ترجمةَ تلقائيّة تكشف لغةَ الكلام، فلا أعرف من أيّ لغةٍ أدبلج",
  lang: "لغةُ الكلام ليست الإنجليزية — الدبلجة من الإنجليزية وحدها الآن",
  breaker: "رفض يوتيوب طلبَ الترجمة النصّيّة — توقّفتُ ولن أطلب ثانيةً في هذه الصفحة. لا تُعِد المحاولة اليوم من هذا الاتصال",
  already: "طلبتُ نصَّ هذا الفيديو في هذه الصفحة ولم يصل — لن أطلبه ثانيةً هنا",
  "no-capture": "لم يطلب المشغّل الترجمة — أطفئ الترجمة (CC) وأعد تحميل الصفحة ثمّ اضغط «دبلِج»",
  "no-observer": "المتصفّح لا يتيح مراقبة الطلبات هنا",
  busy: "التقاطٌ آخر يجري — انتظر ثمّ جرّب",
  "bad-url": "رابط الترجمة الملتقط غير مفهوم",
  "not-json3": "ردّ الترجمة النصّيّة بشكلٍ غير متوقّع",
  empty: "الترجمة النصّيّة فارغة",
  facts: "تعذّرت قراءة مسارات الفيديو",
  "no-translator": "مترجم كروم المدمج غير متاح في هذا المتصفّح",
  "tr-unavailable": "مترجم كروم لا يدعم الإنجليزية ⇐ العربية على هذا الجهاز",
  "tr-create": "تعذّر تجهيز مترجم كروم",
  "no-voice": "لا صوتَ عربيّ في النظام — أضف صوتاً عربياً من إعدادات النظام ثمّ أعد تشغيل كروم",
  inject: "تعذّر حقن جزء الدبلجة في الصفحة — أعد تحميلها",
  "az-nokey": "اخترتَ صوت Azure بلا مفتاح — ضع مفتاح الكلام في «إعدادات Azure» ثمّ اضغط «احفظ واختبر»",
  "az-region": "منطقة Azure المكتوبة لا تصلح — اكتبها كما تظهر في بوّابة Azure، مثل uaenorth",
  "az-trnokey": "اخترتَ «مترجم Azure» بلا مفتاح مترجم، ومترجمُ كروم غيرُ متاح هنا — ضع مفتاح المترجم في «إعدادات Azure» ثمّ «احفظ واختبر»",
  "main-old": "في هذه الصفحة نسخةٌ أقدم من الإضافة (حُدّثت بعد فتحها) — أعد تحميل صفحة يوتيوب ثمّ اضغط «دبلِج»",
  late: "تأخّر المشغّل في عرض الترجمة (أهو تبويبٌ مخفيّ؟) — اضغط «دبلِج» ثانيةً والتبويبُ ظاهر",
  gone: "رفض يوتيوب إعادةَ تحميل ترجمته العربيّة فاختفت من الفيديو — لن أطلب ثانيةً في هذه الصفحة. أعد تحميلها لاحقاً، ولا تُعِد اليوم إن تكرّر",
  threw: "عطبٌ داخليّ في الدبلجة"
};
const DUB_STEP_TEXT = {
  facts: "يقرأ مسارات الفيديو…", capture: "يلتقط نصّ الفيديو من المشغّل…", show: "يشغّل ترجمة يوتيوب العربية على الفيديو…",
  translator: "يجهّز مترجم كروم…", voice: "يجهّز الصوت العربي…", warmup: "يوقظ محرّك النطق…"
};
const DUB_HOLD_TEXT = {
  paused: "الفيديو متوقّف — تستأنف حين تشغّله", frozen: "الفيديو يتحمّل…", ad: "إعلان — تستأنف بعده",
  speed: "سرعة الفيديو أعلى مما يلحقه الصوت (حتى 1.91×) — صامتة", "no-video": "لا أجد الفيديو",
  queue: "صوتٌ آخر في المتصفّح يسبقنا — أنتظره", done: "انتهت جمل الفيديو",
  hidden: "التبويب مخفيّ — ترجمة يوتيوب لا تتحدّث فيه؛ أعده ظاهراً",
  "cc-lang": "الترجمة المعروضة ليست عربية — اخترتَ لغةً أخرى؟ أعد العربية أو اضغط «أوقف» ثمّ «دبلِج»",
  "cc-off": "الترجمة على الفيديو مطفأة — شغّلها (CC) لأقرأها",
  // الجولة الثالثة — «يتوقّف الفيديو لحظةً حتى يجهز الصوت» (قرارُ المالك 2026-11-01): يُقال لماذا توقّف الفيديو، لا يُترك لغزاً
  "wait-voice": "أوقفتُ الفيديو لحظةً حتى يجهز صوتُ الجملة", "wait-translate": "أوقفتُ الفيديو لحظةً حتى تصل ترجمةُ الجملة",
  "wait-behind": "أوقفتُ الفيديو لحظةً حتى يُتمّ الصوتُ جملتَه فيبقى معه",
  "no-voice": "لا صوتَ عربيّ في هذا الجهاز — اختر «Azure (أصوات مايكروسوفت)» في «محرّك الصوت»",
  "no-lines": "لا سطرَ عربيّاً على الفيديو منذ عشرين ثانية — حين يظهر أقرؤه (وإن اختفت الترجمةُ فأعد اختيار العربيّة من ⚙)",
  "tr-off": "مترجم Azure متوقّف ولا مترجمَ بديل على هذا الجهاز — تحقّق من مفتاح المترجم ثمّ أعد «دبلِج»"
};
const DUB_STOP_TEXT = {
  user: "أوقفتَها", nav: "انتقلتَ إلى فيديو آخر — توقّفت", mini: "المشغّل المصغّر — توقّفت",
  gate: "أُطفئت الإضافة أو حُظر الموقع — توقّفت", "other-tab": "بدأت الدبلجة في تبويبٍ آخر — توقّفت هنا",
  restart: "أُعيد التشغيل", orphan: "أُعيد تحميل الإضافة — أعد تحميل الصفحة"
};
const DUB_KIND_TEXT = {
  speak: "تنطق الترجمة العربية اليدويّة كما هي", manual: "تترجم الترجمة الإنجليزية اليدويّة",
  asr: "تترجم الترجمة التلقائيّة",
  // الجولة الثالثة: ملفُّ ترجمة يوتيوب العربيّة يُقرأ مسبقاً من طلب المشغّل نفسِه — وما لم يُلتقط يُقرأ كما يظهر
  ytar: "تقرأ ترجمة يوتيوب العربية مسبقاً جملةً جملة", display: "تقرأ ترجمة يوتيوب العربية كما تظهر سطراً سطراً"
};
// `wait`: «أوقف الفيديو لحظةً حتى يجهز الصوت» — مفعّلٌ افتراضيّاً (قرارُ المالك 2026-11-01)
const DUB_PREF_DEFAULT = { source: "yt", engine: "system", volume: 100, rate: "auto", voice: {}, wait: true,
  azure: { key: "", region: "uaenorth", voice: "ar-SA-HamedNeural", trKey: "", trRegion: "uaenorth" } };
// 168ح — احتياطٌ إن لم تُجلب قائمةُ أصوات Azure (بلا مفتاحٍ بعد، أو تعذّر الجلب): صوتا السعوديّة اللذان أعجبا المالك
const DUB_AZ_FALLBACK = [{ ShortName: "ar-SA-HamedNeural", LocalName: "حامد", Gender: "Male", LocaleName: "العربية (السعودية)" },
  { ShortName: "ar-SA-ZariyahNeural", LocalName: "زارية", Gender: "Female", LocaleName: "العربية (السعودية)" }];
// ⛔ ~~«أبطأتُ الطلبات…» (`rate-local`)~~ — حدُّ الصفحة يؤخّر طلباً ولا يُعدّ عطباً يُقال (مراجعة 168ح #5)
const DUB_AZ_WARN = {
  key: "مفتاح Azure مرفوض — بصوت الجهاز", rate: "Azure مشغولٌ لحظات (429) — ما جُلب يُنطق به، والباقي بصوت الجهاز",
  net: "تعذّر الوصول إلى Azure لمقطع", nokey: "لا مفتاحَ كلامٍ صالح — بصوت الجهاز",
  quota: "نفدت حصّة Azure المجانيّة لهذا الشهر — بصوت الجهاز حتى الشهر التالي"
};
// لماذا لم يُقرأ ملفُّ ترجمة يوتيوب مسبقاً (فيُقرأ كما يظهر) — يُقال لا يُترك لغزاً
const DUB_YT_WHY = {
  locked: "إضافةٌ أخرى قفلت مراقبةَ الطلبات", "no-request": "لم يطلب المشغّلُ ملفَّ الترجمة", parse: "ردُّ الترجمة بشكلٍ غير متوقّع",
  empty: "ملفُّ الترجمة بلا كلام",
  // ⛔ ~~«unhooked:fetch» بحروفها في السطر العربيّ~~ (مراجعةُ الجولة #8): لكلّ سببٍ كلماتُه، والرقمُ بين قوسين
  unreadable: "ردُّ الترجمة بغير نصٍّ يُقرأ", unhooked: "طلبُ الترجمة لم يمرّ بمراقبتنا", status: "طلبُ المشغّل للترجمة لم ينجح",
  slow: "ردُّ الترجمة أبطأ من المهلة", refused: "رفض يوتيوب طلبَ المشغّل للترجمة — فلا طلبَ بعده في هذه الصفحة",
  breaker: "رُفض طلبٌ سابقٌ في هذه الصفحة — فلا طلبَ بعده"
};
function dubYtWhyText(w) {
  const x = String(w || ""), [k, n] = x.split(":");
  return DUB_YT_WHY[x] || (DUB_YT_WHY[k] ? DUB_YT_WHY[k] + (/^-?\d+$/.test(n || "") ? ` (${n})` : "") : x);
}
let dubAzVoices = null, dubAzVoicesFor = "";
// المصدرُ الذي اختير ليُعاد البدءُ به ولم يبدأ بعد — **وحدَه يجيز «يُعاد البدءُ…»** (مراجعةُ الجولة #1)
let dubRestartTo = "";
let dubTabId = null, dubHost = "", dubPoll = 0, dubLast = null, dubPin = null, dubBlocked = false;

function isYouTubeWatchUrl(url) {
  if (!isYouTubeUrl(url)) return false;
  try { const u = new URL(url); return u.pathname === "/watch" && !!u.searchParams.get("v"); } catch { return false; }
}

// الصوتُ يُحفظ لكلّ نظام: «ليلى» على الماك ليست على الويندوز
function dubPlatform() {
  const p = navigator.userAgentData?.platform || "";
  if (p) return p;
  return /Windows/.test(navigator.userAgent) ? "Windows" : /Mac/.test(navigator.userAgent) ? "macOS" : "other";
}

async function dubPrefs() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const d = (data.settings || {}).dub || {};
  return { ...DUB_PREF_DEFAULT, ...d, voice: { ...(d.voice || {}) }, azure: { ...DUB_PREF_DEFAULT.azure, ...(d.azure || {}) } };
}

// ما يصل المحرّك: الحجمُ 0..1 · السرعةُ «auto» أو رقم · الصوتُ لهذا النظام
function dubOptsFrom(pr) {
  return { source: pr.source, engine: pr.engine, volume: (Number(pr.volume) || 0) / 100, rate: pr.rate,
    voice: pr.voice[dubPlatform()] || "", az: { ...pr.azure }, wait: pr.wait !== false };
}

function dubSend(message) {
  return chrome.tabs.sendMessage(dubTabId, message, { frameId: 0 }).catch(() => null);
}

function renderDub(st) {
  const btn = $("dubBtn"), note = $("dubNote");
  if (!btn || !note) return;
  // رفضُ الضغطة الأخيرة يبقى حتى الضغطة التالية — لا يمحوه سؤالُ الحال وقد قيل «لا شيء يجري» (مراجعة #14)
  if (dubPin && (!st || st.state === "idle")) st = dubPin;
  const s = st && st.ok !== false ? st.state : "refused";
  btn.textContent = s === "preparing" || s === "running" ? "أوقف الدبلجة" : "دبلِج هذا الفيديو";
  btn.disabled = s === "master-off" || s === "blocked";
  note.classList.remove("bad");
  let text;
  if (!st) text = "الإضافة غير محقونة في هذه الصفحة — أعد تحميلها ثمّ جرّب";
  else if (s === "master-off") text = "الإضافة مطفأة من المفتاح الرئيسي";
  else if (s === "blocked") text = "الإضافة محظورة على هذا الموقع — أزل الحظر من زرّ 🚫 أعلاه";
  else if (st.ok === false && st.reason === "not-started") text = "الإضافة لم تبدأ في هذه الصفحة — أعد تحميلها";
  else if (s === "idle") text = "تقرأ الترجمة العربية بصوتٍ متزامن مع الفيديو — اختر مصدرها وصوتها وسرعتها أدناه.";
  else if (s === "preparing") text = (DUB_STEP_TEXT[st.step] || "يجهّز…") + (st.step === "translator" && st.dl != null ? ` (تنزيل ${st.dl}٪)` : "");
  else if (s === "running") {
    // ⭐ «بصوت Azure» حين يتكلّم Azure فعلاً (`azOn`) — ⛔ ~~حين طُلب~~ وصوتُ الجهاز هو الذي يتكلّم (مراجعة 168ح #14)
    const az = st.engine !== "azure" ? "" : st.azOn ? " · بصوت Azure" + (st.azWarn === "net" ? ` · ⚠️ ${DUB_AZ_WARN.net}` : "")
      : ` · ⚠️ ${DUB_AZ_WARN[st.azOff || st.azWarn] || "Azure متوقّف — بصوت الجهاز"}` + (st.voice ? "" : " — ولا صوتَ عربيّ في الجهاز يخلفه");
    text = (st.hold ? DUB_HOLD_TEXT[st.hold] || st.hold : "يُدبلج") + (st.kind === "display" ? "" : ` · الجملة ${Math.min(st.idx, st.total)} من ${st.total}`) +
      ` · نُطقت ${st.spoken} · تُخطّيت ${st.skipped}` + (st.lost ? ` · ضاعت ${st.lost}` : "") +
      (DUB_KIND_TEXT[st.kind] ? ` · ${DUB_KIND_TEXT[st.kind]}` : "") +
      (st.kind === "display" && st.ytWhy ? ` (تعذّرت القراءةُ المسبقة: ${dubYtWhyText(st.ytWhy)})` : "") +
      // ⛔ ~~«الانتظار» و«أسرع حين يتأخّر» يعدان في القراءة كما تظهر~~ ولا يعملان فيها (مراجعةُ الجولة #9) — يُقال
      // ⛔ ~~«ولا تسريعٍ فوق 1.4×» والسرعةُ ثابتةٌ اختارها المستخدم~~ (تحقّقُ الجولة) — يُقال ما يصحّ لكلٍّ
      (st.kind !== "display" ? "" : typeof st.rate === "number" ? ` · بلا إيقافٍ للفيديو في هذه القراءة، وبالسرعة التي اخترتها (${st.rate}×)`
        : " · بلا إيقافٍ للفيديو ولا تسريعٍ فوق 1.4× في هذه القراءة") +
      (st.bgSkipped ? ` · ⚠️ تُخطّيت ${st.bgSkipped} والتبويبُ مخفيّ — أبقِه ظاهراً أو صوتَ يوتيوب مسموعاً` : "") +
      (st.warm ? "" : " · ⚠️ لم أسمع جملةَ البدء — أهو تبويبٌ مكتوم؟") + az +
      // ⛔ ~~«بمترجم كروم» ولا مترجمَ كروم~~ (مراجعةُ الجولة #4): ما تُرجم سلفاً يُقرأ ثمّ تقف عند أوّل جملةٍ لم تُترجم — يُقال قبلها
      (st.hold === "tr-off" || !st.trOff ? "" : st.trLocal === false ? " · ⚠️ مترجم Azure غير متاح ولا مترجمَ بديل في هذا المتصفّح — ستقف عند أوّل جملةٍ لم تُترجم"
        : st.trOff === "nokey" ? " · بمترجم كروم (لا مفتاحَ مترجم)" : " · ⚠️ مترجم Azure غير متاح — بمترجم كروم") +
      (st.waits ? ` · انتظر الفيديو صوتَه ${st.waits} مرّة` : "") +
      // ملاحظةُ المالك ١ (الجولة الثالثة): «ما اقراه جمله وما اسمعه جمله اخرى» — يوتيوب يعرض ترجمتَه وأنا أقرأ غيرَها، فيُقال ويُدَلّ على العلاج
      (st.shownDiffers ? " · ⚠️ يوتيوب يعرض ترجمتَه العربيّة وأنا أقرأ ترجمةً أخرى — اختر «ترجمة يوتيوب العربية» ليتطابق ما تسمعه مع ما تقرؤه" : "") +
      // حرفان لا حرفٌ واحد: حصّةُ الكلام غيرُ حصّة المترجم، والمدفوعُ وحدَه يُعدّ (مراجعة 168ح #12)
      (st.azTts || st.azTr ? ` · حروفُ Azure في هذه الجلسة: الكلام ${st.azTts || 0} · المترجم ${st.azTr || 0}` : "");
  } else if (s === "stopped") text = DUB_STOP_TEXT[st.reason] || "توقّفت الدبلجة";
  else {
    text = "⛔ " + (DUB_REASON_TEXT[st.reason] || `تعذّرت الدبلجة: ${st.reason}`) +
      (st.reason === "lang" && st.detail ? ` (${st.detail})` : "");
    note.classList.add("bad");
  }
  // ⛔ ~~«المصدرُ الجديد من الضغطة التالية على «دبلِج»»~~ — الجولة الثالثة: تبديلُ المصدر يُعيد البدءَ فوراً (ملاحظةُ المالك ١:
  // «يستمر يترجم النص الانجليزي») ⇒ فرقٌ بين المختار والجاري لحظةُ إعادةٍ تُقال
  // ⛔ ~~وكلُّ فرقٍ بين المختار والجاري «إعادةٌ»~~ (مراجعةُ الجولة #1): فرقٌ لم يُرسَل له «دبلِج» — اختيارٌ في تبويبٍ آخر أو جهازٍ آخر، أو
  // حفظٌ رُفض — **يُقال كما هو** ولا يُوعد بإعادةٍ لن تأتي
  if (st && st.source && st.source === dubRestartTo) dubRestartTo = "";
  if ((s === "running" || s === "preparing") && st.source && $("dubSource") && $("dubSource").value !== st.source) {
    text += dubRestartTo && dubRestartTo === $("dubSource").value ? " · يُعاد البدءُ بالمصدر المختار…"
      : " · ⚠️ تعمل بمصدرٍ غير المختار — اضغط «أوقف الدبلجة» ثمّ «دبلِج» لتبدأ به";
  }
  note.textContent = text;
  const diag = $("dubDiag");
  if (diag) { const d = s === "running" ? dubDiagText(st) : ""; diag.textContent = d; diag.hidden = !d; }
}

// ⭐ أرقامُ القياس (الجولة الثالثة) — سطرٌ يقرؤه المالك ويرسله كما هو، فيُجيب تشغيلُه عمّا لا يقيسه غيرُه: سرعةُ الصوت المتعلَّمة ·
// صمتا طرفي مقطع Azure · السرعةُ المستعملة · ما تحتاجه الجملُ القادمة · تأخّرُ البدء · كم انتظر الفيديو. لا نصَّ فيه ولا مفتاح
function dubDiagText(st) {
  const p = [];
  if (st.cps) p.push(`الصوت ${st.cps} حرف/ث`);
  if (st.leadMs != null || st.tailMs != null) p.push(`صمتُ المقطع: أوّله ${st.leadMs ?? "؟"} م.ث وآخرُه ${st.tailMs ?? "؟"} م.ث`);
  if (st.spd && st.spd[0] != null) p.push(`السرعة ${st.spd[0]}× وأقصاها ${st.spd[1]}×`);
  if (st.need && st.need[0] != null) p.push(`تحتاج الجملُ القادمة ${st.need[0]}× (وعُشرُها الأصعب ${st.need[1]}×)`);
  if (st.lagP90 != null) p.push(`تأخّرُ البدء ${st.lagP90} ث لتسعة أعشار الجمل`);
  if (st.stallS) p.push(`وقف الفيديو ${st.stallS} ث`);
  return p.length ? "📏 " + p.join(" · ") : "";
}

// المفتاحُ الرئيسيّ والحظرُ يُقرآن في كلّ سؤال — مفتاحٌ قُلب في البوب-أب نفسِه يظهر أثرُه فوراً (مراجعة #13)
async function refreshDub() {
  if (!(await getMasterEnabled())) { dubLast = { ok: true, state: "master-off" }; renderDub(dubLast); return; }
  // والحظرُ كذلك — زرُّ 🚫 في البوب-أب نفسِه يرفعه، والبطاقةُ تتبعه (مراجعة 2 #5 · #9 · #14)
  dubBlocked = !!(await readHostGates(dubHost)).blocked;
  if (dubBlocked) { dubLast = { ok: true, state: "blocked" }; renderDub(dubLast); return; }
  dubLast = await dubSend({ type: "GVZ_DUB_STATUS" });
  renderDub(dubLast);
}

// الأصواتُ العربيّة بوسم اللغة، كما يراها المحرّك — والأوّلُ «تلقائيّ» (يختار «ليلى (محسّن)» إن وُجدت)
function fillDubVoices(selected) {
  const sel = $("dubVoice");
  if (!sel) return;
  const voices = (globalThis.speechSynthesis?.getVoices() || [])
    .filter((v) => String(v.lang || "").toLowerCase().split(/[-_]/)[0] === "ar");
  sel.textContent = "";
  sel.dataset.engine = "system";                                 // القائمةُ تقول لأيّ محرّكٍ هي — والحفظُ يكتب في خانته وحدَها
  const auto = document.createElement("option");
  auto.value = ""; auto.textContent = "تلقائي";
  sel.appendChild(auto);
  for (const v of voices) {
    const o = document.createElement("option");
    o.value = v.voiceURI; o.textContent = v.name + (v.localService ? "" : " (عبر الشبكة)");
    sel.appendChild(o);
  }
  sel.value = voices.some((v) => v.voiceURI === selected) ? selected : "";
  sel.dataset.loaded = voices.length ? "1" : "";                 // 📖 أوّلُ getVoices() في وثيقةٍ جديدة فارغ — فلا يُقرأ منها «تلقائي»
}

// الضوابطُ من التخزين — وتُعاد منه بعد حفظٍ فشل (#69): الضابطُ لا يقول قيمةً لم تُحفظ (مراجعة 2 #15)
// 168ح — أصواتُ Azure العربيّة من Azure نفسِه (طلبٌ واحدٌ لكلّ مفتاحٍ ومنطقة في فتحة البوب-أب)، وإلا الاحتياط
async function dubAzVoiceList(az) {
  const tag = az.region + "|" + (az.key ? az.key.slice(-4) : "");
  if (dubAzVoices && dubAzVoicesFor === tag) return dubAzVoices;
  let list = null;
  if (az.key && /^[a-z0-9]{2,32}$/.test(az.region)) {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 6000);
    try {
      const r = await fetch(`https://${az.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
        { headers: { "Ocp-Apim-Subscription-Key": az.key }, credentials: "omit", cache: "no-store", signal: ac.signal });
      if (r.ok) list = (await r.json()).filter((v) => /^ar-/.test(String(v.Locale || "")));
    } catch { list = null; } finally { clearTimeout(to); }
  }
  dubAzVoices = list && list.length ? list : null; dubAzVoicesFor = tag;
  return dubAzVoices || DUB_AZ_FALLBACK;
}

// ⛔ **بعد الانتظار يُسأل المحرّكُ ثانيةً** (مراجعة 168ح #17): قائمةُ Azure تصل متأخّرةً وقد عاد المستخدمُ إلى أصوات الجهاز —
// فكانت تحلّ محلّ قائمته ويُحفظ اسمُ صوت Azure صوتاً للماك. **والصوتُ المحفوظُ يبقى ولو غاب عن القائمة** (لا يُستبدل بأوّلها)
// ⭐ **ولا تنتظر النافذةُ الشبكة** (مراجعةُ الجولة #2): ⛔ ~~كلُّ مستمعٍ في النافذة بعد طلب قائمة الأصوات~~ — شبكةٌ بطيئة جعلت المفتاحَ الرئيسيّ
// يُضغط ولا يُحفظ ⇒ القائمةُ المحفوظة أو الاحتياطُ فوراً بالصوت المحفوظ، ثمّ قائمةُ Azure حين تصل **بما اختاره المستخدمُ بينهما**
function fillDubAzOptions(list, voice) {
  const sel = $("dubVoice");
  if (!sel) return;
  sel.textContent = "";
  sel.dataset.engine = "azure";
  const all = list.some((v) => v.ShortName === voice) ? list : [{ ShortName: voice, LocalName: voice, Gender: "", LocaleName: "" }].concat(list);
  for (const v of all) {
    const o = document.createElement("option");
    o.value = v.ShortName;
    o.textContent = `${v.LocalName || v.ShortName}` + (v.Gender ? ` · ${v.Gender === "Female" ? "أنثى" : "ذكر"}` : "") + (v.LocaleName || v.Locale ? ` · ${v.LocaleName || v.Locale}` : "");
    sel.appendChild(o);
  }
  sel.value = voice;
}
// `keepShown`: «احفظ واختبر» وحدَه — ⛔ ~~إبقاءُ المعروض في كلّ ملء~~ (تحقّقُ الجولة الثاني): مسارُ الفتح وإرجاعُ #69 بعد حفظٍ فشل
// يُعيدان المحفوظ، فلا يقول الضابطُ صوتاً لم يُحفظ
async function fillDubAzVoiceSelect(az, keepShown) {
  const sel = $("dubVoice");
  if (!sel) return;
  const tag = az.region + "|" + (az.key ? az.key.slice(-4) : "");
  // ⛔ ~~بالصوت المحفوظ دائماً~~ (تحقّقُ الجولة): «احفظ واختبر» يستدعيها بما حفظه قبل طلبَيه — فكان يُعيد صوتاً غيّره المستخدمُ أثناءهما، ثمّ يُحفظ
  // القديمُ مع أوّل تغيير ⇒ قائمةُ Azure المعروضةُ يبقى مختارُها
  fillDubAzOptions(dubAzVoices && dubAzVoicesFor === tag ? dubAzVoices : DUB_AZ_FALLBACK, keepShown && sel.dataset.engine === "azure" && sel.value ? sel.value : az.voice);
  const list = await dubAzVoiceList(az);
  if ($("dubEngine")?.value !== "azure" || sel.dataset.engine !== "azure") return;
  fillDubAzOptions(list, sel.value || az.voice);
}

async function fillDubPrefsUI() {
  if (!$("dubCard")) return;
  const pr = await dubPrefs();
  if ($("dubSource")) $("dubSource").value = pr.source;
  if ($("dubEngine")) $("dubEngine").value = pr.engine;
  if ($("dubRate")) $("dubRate").value = String(pr.rate);
  if ($("dubVolume")) $("dubVolume").value = String(pr.volume);
  if ($("dubVolumeValue")) $("dubVolumeValue").textContent = `${pr.volume}%`;
  if ($("dubWait")) $("dubWait").checked = pr.wait !== false;
  if ($("dubAzKey")) $("dubAzKey").value = pr.azure.key;
  if ($("dubAzRegion")) $("dubAzRegion").value = pr.azure.region;
  if ($("dubAzTrKey")) $("dubAzTrKey").value = pr.azure.trKey;
  if ($("dubAzTrRegion")) $("dubAzTrRegion").value = pr.azure.trRegion;
  if (pr.engine === "azure") fillDubAzVoiceSelect(pr.azure).catch(() => {});
  else fillDubVoices(pr.voice[dubPlatform()] || "");
}

// ⛔ ~~الصوتُ المحفوظ من القائمة المعروضة~~ (مراجعةُ الجولة #3): أوّلُ قائمةٍ فارغة فيُقرأ منها «تلقائي» ثمّ يُحفظ فوق «ماجد» عند أوّل تغيير
// ⇒ **من التخزين** ما لم تُحمَّل القائمة، وما اختاره المستخدمُ من قائمةٍ محمّلة يبقى
async function loadDubPrefsUI() {
  await fillDubPrefsUI();
  globalThis.speechSynthesis?.addEventListener("voiceschanged", async () => {
    if ($("dubEngine")?.value === "azure") return;
    const sel = $("dubVoice");
    const keep = sel && sel.dataset.loaded === "1" ? sel.value : (await dubPrefs()).voice[dubPlatform()] || "";
    if ($("dubEngine")?.value !== "azure") fillDubVoices(keep);
  });
}

// ⭐ منطقةُ Azure ومفتاحاه يُتحقَّق منها **قبل الحفظ وقبل أيّ طلب** (مراجعة 168ح #15): ⛔ ~~«attacker.example/x#» كانت تُرسل
// مفتاحَ الكلام إلى مضيفٍ يكتبه الحقل~~ — والمنطقةُ كما تُكتب في البوّابة («West Europe») تُطبَّع («westeurope»)
const DUB_AZ_REGION = /^[a-z0-9]{2,32}$/, DUB_AZ_KEY = /^[A-Za-z0-9]{16,128}$/;
let dubSaveErr = "";                                            // سببُ آخر رفضٍ للحفظ — يقوله «احفظ واختبر» تحت زرّه
function dubAzRegionOf(x) { return String(x || "").replace(/\s+/g, "").toLowerCase(); }

// `keepVoice`: تبديلُ المحرّك لا يقرأ قائمةَ الأصوات المعروضة — هي قائمةُ المحرّك السابق. **والصوتُ المعروضُ يُكتب في خانة
// المحرّك الذي عُرض له وحدَها** (`dataset.engine` — مراجعة 168ح #17)
// `azFields`: حقولُ Azure تُقرأ وتُتحقَّق حين يحفظها حقلٌ منها أو «احفظ واختبر» وحدَهما — ⛔ ~~في كلّ حفظ~~: حقلٌ كُتب خطأً كان يمنع كلَّ
// ضابطٍ آخر من الحفظ والإرسال صامتاً (الانتظارُ يبقى يوقف الفيديو وعلامتُه مُزالة — مراجعةُ الجولة #7)
async function saveDubPrefs(keepVoice, azFields) {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  const pr = { ...DUB_PREF_DEFAULT, ...(settings.dub || {}) };
  const prevAz = { ...DUB_PREF_DEFAULT.azure, ...(pr.azure || {}) };
  const engine = $("dubEngine")?.value === "azure" ? "azure" : "system";
  const shown = $("dubVoice")?.value || "", shownFor = $("dubVoice")?.dataset?.engine || "";
  const voice = { ...(pr.voice || {}) };
  if (!keepVoice && engine === "system" && shownFor === "system" && $("dubVoice")?.dataset?.loaded === "1") voice[dubPlatform()] = shown;
  const clean = (x) => String(x || "").trim();
  const region = azFields ? dubAzRegionOf($("dubAzRegion")?.value) || "uaenorth" : prevAz.region;
  const trRegion = azFields ? dubAzRegionOf($("dubAzTrRegion")?.value) || "uaenorth" : prevAz.trRegion;
  const key = azFields ? clean($("dubAzKey")?.value) : prevAz.key, trKey = azFields ? clean($("dubAzTrKey")?.value) : prevAz.trKey;
  dubSaveErr = !azFields ? "" : !DUB_AZ_REGION.test(region) || !DUB_AZ_REGION.test(trRegion) ? "منطقة Azure لا تصلح — اكتبها كما تظهر في بوّابة Azure، مثل uaenorth"
    : (key && !DUB_AZ_KEY.test(key)) || (trKey && !DUB_AZ_KEY.test(trKey)) ? "مفتاح Azure بشكلٍ غير متوقّع — انسخه من «Keys and Endpoint» كما هو" : "";
  if (dubSaveErr) { setStatus("bad", dubSaveErr); return null; }
  const azure = { key, region, trKey, trRegion,
    voice: !keepVoice && engine === "azure" && shownFor === "azure" && /^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/.test(shown) ? shown : prevAz.voice };
  const src = $("dubSource")?.value;
  settings.dub = { source: src === "device" || src === "azure" ? src : "yt", engine,
    volume: Math.max(0, Math.min(100, Number($("dubVolume")?.value) || 0)), rate: $("dubRate")?.value || "auto", voice, azure,
    wait: $("dubWait") ? !!$("dubWait").checked : pr.wait !== false };
  const res = await safeSyncSet({ settings });
  if (!res.ok) { setStatus("bad", `تعذّر الحفظ: ${res.message}`); return null; }
  return { ...settings.dub, voice: { ...voice }, azure: { ...azure } };
}

// تغييرٌ والدبلجةُ تعمل يصلها من الجملة التالية — ⭐ **والمصدرُ يُعيد البدءَ فوراً** (الجولة الثالثة، ملاحظةُ المالك ١ بنصّها:
// «عند اختيار اقرا من ترجمه اليوتيب العربي لا يقرا يستمر يترجم النص الانجليزي») — ⛔ ~~«من الضغطة التالية»~~. وما يُرسل يُقرأ
// من التخزين بعد كلّ انتظار، لا ممّا حُفظ قبله (مراجعة 168ح #17)
// ⭐ **تغييرٌ واحدٌ في كلّ مرّة** (مراجعةُ الجولة #1): ⛔ ~~تغييران سريعان يقارن ثانيهما بحالٍ قديمة~~ فيُرسل «SET» بعد «دبلِج» المصدرِ
// الأوّل وتبقى الدبلجةُ عليه والمختارُ غيرُه — والثاني ينتظر الأوّلَ حتى يصله ردُّه
let dubPrefChain = Promise.resolve();
function onDubPrefChange(e) {
  // نيّةُ الإعادة تُعرف لحظةَ التغيير — ⛔ ~~حين يحين دورُه في السلسلة~~ فكان ينتظر فيُقال «تعمل بمصدرٍ غير المختار» (تحقّقُ الجولة)
  if (e && e.target && e.target.id === "dubSource") dubRestartTo = $("dubSource")?.value || "";
  const run = dubPrefChain.then(() => onDubPrefChangeRun(e));
  dubPrefChain = run.catch(() => {});
  return run;
}
async function onDubPrefChangeRun(e) {
  const id = e && e.target ? e.target.id : "";
  const engineChanged = id === "dubEngine";
  const saved = await saveDubPrefs(engineChanged, /^dubAz/.test(id));
  if (!saved) { dubRestartTo = ""; return; }
  // ⛔ ~~وينتظر قائمةَ أصوات Azure~~ (تحقّقُ الجولة): كلُّ تغييرٍ بعده في السلسلة كان ينتظرها حتى ست ثوانٍ ويضيع إن أُغلقت النافذة
  if (engineChanged) {
    if (saved.engine === "azure") fillDubAzVoiceSelect(saved.azure).catch(() => {}); else fillDubVoices(saved.voice[dubPlatform()] || "");
  }
  if (dubTabId == null) { dubRestartTo = ""; return; }
  if (dubLast && (dubLast.state === "preparing" || dubLast.state === "running")) {
    const opts = dubOptsFrom(await dubPrefs());
    const restart = !!dubLast.source && opts.source !== dubLast.source;
    if (!restart) dubRestartTo = "";
    const st = await dubSend(restart ? { type: "GVZ_DUB_START", opts } : { type: "GVZ_DUB_SET", opts });
    if (st) { dubLast = st; if (st.ok === false) dubPin = st; renderDub(st); }
  } else dubRestartTo = "";
}

// «احفظ واختبر»: طلبٌ لقائمة الأصوات بمفتاح الكلام، وجملةٌ واحدةٌ بمفتاح المترجم — والنتيجةُ بسببها، والمفتاحُ لا يُعرض
async function testDubAzure() {
  const note = $("dubAzNote");
  const saved = await saveDubPrefs(false, true);
  if (!note) return;
  if (!saved) { note.textContent = "⛔ " + (dubSaveErr || "تعذّر الحفظ"); note.classList.add("bad"); return; }
  const az = saved.azure, why = (st) => (st === 401 || st === 403 ? "المفتاح أو المنطقة غير صحيحين" : st === 429 ? "بلغتَ الحدّ — جرّب بعد دقيقة" : `ردّ ${st || "بلا اتصال"}`);
  note.classList.remove("bad");
  note.textContent = "أختبر…";
  let speech = "", tr = "", bad = false;
  if (!az.key) { speech = "⚪ الكلام: لا مفتاح"; }
  else {
    dubAzVoices = null;
    try {
      const r = await fetch(`https://${az.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
        { headers: { "Ocp-Apim-Subscription-Key": az.key }, credentials: "omit", cache: "no-store" });
      if (r.ok) { const n = (await r.json()).filter((v) => /^ar-/.test(String(v.Locale || ""))).length; speech = `✅ الكلام: ${n} صوتاً عربياً`; }
      else { speech = `⛔ الكلام: ${why(r.status)}`; bad = true; }
    } catch { speech = "⛔ الكلام: تعذّر الاتصال"; bad = true; }
  }
  if (!az.trKey) { tr = "⚪ المترجم: لا مفتاح"; }
  else {
    try {
      const r = await fetch("https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=ar", {
        method: "POST", credentials: "omit", cache: "no-store",
        headers: { "Ocp-Apim-Subscription-Key": az.trKey, "Ocp-Apim-Subscription-Region": az.trRegion, "Content-Type": "application/json" },
        body: JSON.stringify([{ Text: "Hello" }]) });
      if (r.ok) { const j = await r.json(); tr = `✅ المترجم: «Hello» ⇐ «${j?.[0]?.translations?.[0]?.text || "؟"}»`; }
      else { tr = `⛔ المترجم: ${why(r.status)}`; bad = true; }
    } catch { tr = "⛔ المترجم: تعذّر الاتصال"; bad = true; }
  }
  note.textContent = `${speech} · ${tr}`;
  if (bad) note.classList.add("bad");
  if ($("dubEngine")?.value === "azure") await fillDubAzVoiceSelect(az, true);
}

async function loadDubUI() {
  const card = $("dubCard");
  const tab = await getActiveTab();
  if (!card || !tab || !isYouTubeWatchUrl(tab.url)) { if (card) card.hidden = true; return; }
  card.hidden = false;
  dubTabId = tab.id;
  dubHost = hostFromUrl(tab.url);
  await loadDubPrefsUI();
  await refreshDub();
  clearInterval(dubPoll);
  dubPoll = setInterval(refreshDub, 700);
}

async function toggleDub() {
  if (dubTabId == null) return;
  dubPin = null;
  if (dubLast && (dubLast.state === "preparing" || dubLast.state === "running")) {
    dubLast = await dubSend({ type: "GVZ_DUB_STOP" });
    renderDub(dubLast);
    return;
  }
  if (!(await getMasterEnabled())) { renderDub({ ok: true, state: "master-off" }); return; }
  if (dubBlocked) { renderDub({ ok: true, state: "blocked" }); return; }
  $("dubBtn").disabled = true;
  try {
    // عالمُ الصفحة يُحقن الآن وحدَه — لا شيءَ منه في صفحةٍ لم يُضغط فيها «دبلِج»
    await chrome.scripting.executeScript({ target: { tabId: dubTabId, frameIds: [0] }, files: ["yt_dub_main.js"], world: "MAIN" });
  } catch {
    dubPin = { ok: false, state: "refused", reason: "inject" };
    renderDub(dubPin);
    return;
  }
  // خ14: آخرُ ما ضُغط يفوز — قناةٌ **تُوقف ولا تُشغّل**: طابورُ النطق واحدٌ للمتصفّح كلِّه
  const others = await chrome.tabs.query({ url: "*://*.youtube.com/*" }).catch(() => []);
  for (const t of others) {
    if (t.id !== dubTabId) chrome.tabs.sendMessage(t.id, { type: "GVZ_DUB_STOP", why: "other-tab" }, { frameId: 0 }).catch(() => {});
  }
  dubLast = await dubSend({ type: "GVZ_DUB_START", opts: dubOptsFrom(await dubPrefs()) });
  if (dubLast && dubLast.ok === false) dubPin = dubLast;
  renderDub(dubLast);
}

async function loadBlockedSiteUI() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  const isBlocked = isHostBlocked(currentHost, settings.blockedHosts);
  $("blockSiteBtn").classList.toggle("blocked", isBlocked);
  $("blockSiteBtn").title = isBlocked ? "الموقع محظور — اضغط للسماح" : "اضغط لمنع هذا الموقع";

  // ── #143 — حالُ الموقع الحاليّ من قائمة شريط التقدّم ────────────────────
  // ⚠️ **والحالُ ثلاثيّةٌ لا ثنائيّة، وتُقال كلُّها** (#24): مُضافٌ · غيرُ
  // مُضاف · **والمفتاحُ الرئيسيّ مطفأ فالإضافةُ بلا أثر**. **وزرٌّ يُضيف بلا
  // أثرٍ ولا يقول لماذا هو الوعدُ الكاذب بعينه.**
  // ── #147 — حالُ الموقع من قائمة «أمري يغلب الروابط» ────────────────────
  const linkBtn = $("linkedVideoBtn");
  if (linkBtn) {
    const lv = Array.isArray(settings.linkedVideoHosts) ? settings.linkedVideoHosts : [];
    const onList = !!currentHost && lv.includes(currentHost);
    linkBtn.classList.toggle("onList", onList);
    linkBtn.disabled = !currentHost;
    linkBtn.title = !currentHost ? "لا موقعَ لهذه الصفحة"
      : onList ? `أمرُك يغلب روابطَ ${currentHost} — اضغط للإلغاء`
               : `اضغط ليغلب أمرُ الفأرة روابطَ ${currentHost}`;
  }

  const barBtn = $("hostBarSiteBtn");
  if (barBtn) {
    const hosts = Array.isArray(settings.overlay?.hostBarHosts) ? settings.overlay.hostBarHosts : [];
    const onList = !!currentHost && hosts.includes(currentHost);
    const featureOn = settings.overlay?.hostBar === true;
    barBtn.classList.toggle("onList", onList);
    barBtn.disabled = !currentHost;
    barBtn.title = !currentHost
      ? "لا موقعَ لهذه الصفحة"
      : !featureOn
        ? (onList ? `${currentHost} في القائمة — لكن مفتاحَ الشريط مطفأ في الإعدادات`
                  : "مفتاحُ شريط التقدّم مطفأ في الإعدادات — شغّله أوّلاً")
        : (onList ? `الشريطُ يُرسم على ${currentHost} — اضغط للإزالة`
                  : `اضغط لرسم الشريط على ${currentHost}`);
  }
}

// #143 — نفسُ شكل `saveBlockedSiteState` حرفاً: قراءةٌ، قلبٌ، `safeSyncSet`،
// ثمّ رسالةٌ للتبويب. **والرسالةُ `RELOAD_OVERLAY_SETTINGS` لا `GVZ_RELOAD`**:
// المفتاحُ يعيش في `settings.overlay`، وكلٌّ يوقظ قارئَه.
// #147 — نفسُ شكل `saveBlockedSiteState` حرفاً. **والرسالةُ `GVZ_RELOAD`**:
// القائمةُ في `settings` جذراً، ومُحمِّلُها يُستأنف في مسار إعادة القراءة نفسِه.
async function toggleLinkedVideoSite() {
  if (!currentHost) return;
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  const set = new Set(Array.isArray(settings.linkedVideoHosts) ? settings.linkedVideoHosts : []);
  const add = !set.has(currentHost);
  if (add) set.add(currentHost); else set.delete(currentHost);
  settings.linkedVideoHosts = Array.from(set).sort();
  const res = await safeSyncSet({ settings });
  if (!res.ok) { setStatus("bad", `تعذّر الحفظ: ${res.message}`); return; }
  setStatus("ok", add ? `أمرُك يغلب روابطَ ${currentHost}` : `أُزيل ${currentHost}`);
  const tab = await getActiveTab();
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "GVZ_RELOAD" }).catch(() => {});
}

async function toggleHostBarSite() {
  if (!currentHost) return;
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  settings.overlay = settings.overlay || {};
  const hosts = new Set(Array.isArray(settings.overlay.hostBarHosts) ? settings.overlay.hostBarHosts : []);
  const add = !hosts.has(currentHost);
  if (add) hosts.add(currentHost); else hosts.delete(currentHost);
  settings.overlay.hostBarHosts = Array.from(hosts).sort();

  const res = await safeSyncSet({ settings });
  if (!res.ok) { setStatus("bad", `تعذّر الحفظ: ${res.message}`); return; }
  // **ولا يُعلَن نجاحٌ صامت**: إن كان المفتاحُ مطفأً فالإضافةُ لم تُنتج شيئاً بعد
  if (add && settings.overlay.hostBar !== true) {
    setStatus("bad", `أُضيف ${currentHost} — لكن مفتاحَ شريط التقدّم مطفأ في الإعدادات، فلا يُرسم بعد.`);
  } else {
    setStatus("ok", add ? `الشريطُ يُرسم على ${currentHost}` : `أُزيل ${currentHost}`);
  }
  const tab = await getActiveTab();
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "RELOAD_OVERLAY_SETTINGS" }).catch(() => {});
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

// ⛔ #107 — **نُقل وضعُ شريط يوتيوب إلى قسم YouTube في صفحة الإعدادات**
// (2026-08-06، قرار المالك، وهو **عكسُ قراره السابق** الذي جعل الـpopup موضعَه
// الوحيد). ⛔ **والقديم يُشطب حيث كُتب ولا يُحذف** (قرار 21).
// ⚠️ **ونُقل ولم يُنسَخ** — فلا مرآةَ تتباعد، وهي علّةُ القرار الأوّل نفسِها.
// **والقراءةُ والكتابةُ صارتا في `options.js` بحجّتهما بنصّها**، ومفتاحُ التخزين
// `overlay.progressBarMode` **لم يُمَسّ**: نقلُ موضعٍ لا هجرةُ بيانات.

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
  await loadMasterUi();
  await loadGlobalData();
  await loadSiteProfile();
  await loadOverlayUI();
  await loadBlockedSiteUI();
  await loadSubtitlesToggle();
  await loadFullscreenOnlyToggle();
  await checkPageStatus();
  await loadBoostUI();
  await loadDubUI();

  const od = $("overlayDuration");
  const odValue = $("overlayDurationValue");

  if (od) {
    od.addEventListener("input", () => {
      if (odValue) odValue.textContent = formatOverlayDuration(Number(od.value));
    });
    od.addEventListener("change", saveOverlayUI);
  }

  $("enabled").addEventListener("change", saveGlobalData);
  $("masterEnabled").addEventListener("change", async (e) => {
    const on = e.target.checked;
    syncMasterUi(on);
    const ok = await saveMasterEnabled(on);
    if (!ok) { e.target.checked = !on; syncMasterUi(!on); return; }
    await checkPageStatus();
    if (dubTabId != null) await refreshDub();
  });
  $("subtitlesEnabled")?.addEventListener("change", saveSubtitlesToggle);
  $("fullscreenOnly")?.addEventListener("change", saveFullscreenOnlyToggle);
  // كان `save().then(load)` بلا `.catch` (البند #36): رفضٌ من التخزين يبقى في
  // كونسول الـ popup وحده، **والزرّ يبقى على حالته القديمة** فيقرأها المستخدم
  // «لم يقع شيء» وهي «وقع خطأ لم يُقَل». والنجاح يبقى صامتاً (قرار 7): لا يظهر
  // سطر إلا عند خلل فعليّ. وفشل الحفظ المعروف يُعالَج داخل saveBlockedSiteState
  // برسالته المفصَّلة، وهذا يلتقط ما لا تلتقطه: رفض القراءة نفسها.
  $("linkedVideoBtn")?.addEventListener("click", async () => {
    try {
      await toggleLinkedVideoSite();
      await loadBlockedSiteUI();
    } catch (err) {
      setStatus("bad", `تعذّر التغيير: ${syncErrorText(err)}`);
    }
  });

  $("hostBarSiteBtn")?.addEventListener("click", async () => {
    try {
      await toggleHostBarSite();
      await loadBlockedSiteUI();     // **هي التي ترسم حالَ الزرّين معاً**
    } catch (err) {
      setStatus("bad", `تعذّر تغيير حالة الشريط: ${syncErrorText(err)}`);
    }
  });

  $("blockSiteBtn").addEventListener("click", async () => {
    try {
      await saveBlockedSiteState();
      await loadBlockedSiteUI();
    } catch (err) {
      setStatus("bad", `تعذّر تغيير حالة الحظر: ${syncErrorText(err)}`);
    }
  });
  $("checkStatus").addEventListener("click", checkPageStatus);
  $("dubBtn")?.addEventListener("click", toggleDub);
  for (const id of ["dubSource", "dubEngine", "dubVoice", "dubRate", "dubVolume", "dubWait", "dubAzKey", "dubAzRegion", "dubAzTrKey", "dubAzTrRegion"]) $(id)?.addEventListener("change", onDubPrefChange);
  $("dubAzTest")?.addEventListener("click", testDubAzure);
  $("dubVolume")?.addEventListener("input", () => { if ($("dubVolumeValue")) $("dubVolumeValue").textContent = `${$("dubVolume").value}%`; });

  // ── #69: مسار فشل واحد للـ popup كذلك ────────────────────────────────────
  // كانت سبعةُ مواضع تُعلن الفشل و**واحدٌ يُرجِع الضابط** (المفتاح الرئيسي).
  // فبدل نسخة سابعة من المنطق: **تسجيلٌ واحد** على قناة `safeSyncSet` يُعيد رسم
  // الضوابط من التخزين — **والتخزين يعرف الحقيقة بلا خريطة ضابط⇄مفتاح**.
  // ⚠️ **وبلا تأجيل هنا**: لا حارس في الـ popup يمنع الرسم (لا مودال ولا عدّاد
  // حفظ)، والنافذة قصيرة العمر. **وهذا فرق مقيس عن `options.js` لا سهو.**
  onSyncWriteFailed(() => { renderPopupFromStorage().catch(() => {}); });

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
