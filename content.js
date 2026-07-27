if (!window.__GVZ_CONTENT_LOADED__) {
window.__GVZ_CONTENT_LOADED__ = true;
let siteRules = { enabled: false, mappings: [] };
let map = new Map();
let siteProfile = { enabled: false, mappings: [] };
let siteMap = new Map();
let blockedHosts = [];
let lastPointer = { x: null, y: null };
let soundDisplaySettings = { color: "#ffffff", fontSize: 48 };
let subtitleSettings = {
  enabled: false,
  defaultLang: "",
  fontSize: 22,
  color: "#ffffff",
  bgColor: "#000000",
  bgOpacity: 0.6,
  fontFamily: "system-ui, -apple-system, sans-serif",
  position: "bottom"
};
let subtitleStyleEl = null;
let subtitleTrackObserver = null;
let ytAutoQuality = ""; // "" = auto (don't override)
let ytShortsRedirect = true; // تحويل روابط Shorts إلى المشغّل العادي (watch)

// -------- Sound Booster — session-only, resets to 100% on page refresh --------
//
// ⚠️ createMediaElementSource() is IRREVERSIBLE. Once an element is routed into a
// Web Audio graph its audio never returns to the native output path, and the
// element can never be attached to a second context. So we never touch the
// element until BOTH gates pass:
//
//   Gate 1 — source: a CORS-tainted MediaElementAudioSourceNode outputs pure
//            silence by spec. Routing a cross-origin video would mute it forever.
//   Gate 2 — context: a suspended AudioContext outputs nothing, and there is no
//            way back. We require state === "running" before wiring anything.
//
// Every failure path closes its AudioContext so orphans can't accumulate.
let boostPct = 100;
let lastBoostFailure = null;    // reason of the most recent failed attempt
const boostMap = new WeakMap(); // video → { ctx, gain, src, bypassed }

// resume() can stay PENDING forever when Chrome's autoplay policy blocks it,
// so we never await it unbounded — we race it and then read the real state.
const BOOST_RESUME_TIMEOUT_MS = 400;

// Most informative reason wins when several videos fail for different causes.
const BOOST_REASON_PRIORITY = [
  "cross_origin", "degraded", "connected", "suspended", "unsupported", "failed",
  "media_error", "not_ready", "no_src", "no_video"
];

function closeBoostCtx(ctx) {
  if (!ctx) return Promise.resolve();
  try { return Promise.resolve(ctx.close()).catch(() => {}); }
  catch { return Promise.resolve(); }
}

// Gate 1 — is this media source safe to route through Web Audio?
// blob:/data:/mediasource are same-origin by construction (MSE players land here).
// A real cross-origin URL only passes when the element opted into CORS, because
// a crossOrigin element that failed CORS would not have loaded at all.
//
// ⚠️ KNOWN BLIND SPOT — HTTP redirects.
// currentSrc holds the URL the element *selected*, not the URL finally served.
// A same-origin path that 302s to another origin therefore passes this gate while
// the resource actually loaded is cross-origin, so the node is CORS-tainted and
// outputs silence. We cannot see the post-redirect URL from a content script
// (no response object, and the media fetch is opaque to us).
// This is why the popup keeps a standing note telling the user that reloading the
// page restores the audio — reload is the only recovery, since routing an element
// through createMediaElementSource() can never be undone.
//
// readyState >= HAVE_CURRENT_DATA is required because before it currentSrc can
// still be empty or provisional, which would let a real cross-origin resource
// slip through gate 1 as "no_src" and get boosted on a later call.
function boostSourceCheck(video) {
  if (video.error) return "media_error";
  if (video.readyState < 2) return "not_ready"; // HAVE_CURRENT_DATA
  const url = video.currentSrc || video.src || "";
  if (!url) return "no_src";
  if (/^(blob:|data:|mediasource:)/i.test(url)) return "ok";
  let origin;
  try { origin = new URL(url, location.href).origin; } catch { return "cross_origin"; }
  if (origin === location.origin) return "ok";
  return video.crossOrigin ? "ok" : "cross_origin";
}

// The graph build, split out so applyBoostToVideo can park the in-flight promise
// in boostMap BEFORE this function's first await.
async function buildBoostGraph(video, pct) {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let src = null;
  // Once createMediaElementSource() returns, the element is bound to ctx for the
  // lifetime of the document. Closing ctx from that point on kills its audio
  // permanently, so the cleanup path has to branch on this flag.
  let srcCreated = false;

  try {
    ctx = new Ctor();

    // ---- Gate 2: context actually running ----
    await Promise.race([
      Promise.resolve(ctx.resume()).catch(() => {}),
      new Promise((r) => setTimeout(r, BOOST_RESUME_TIMEOUT_MS))
    ]);
    if (ctx.state !== "running") {
      await closeBoostCtx(ctx);
      return { ok: false, reason: "suspended" }; // element untouched
    }

    // ---- Both gates passed: the irreversible step ----
    src = ctx.createMediaElementSource(video);
    srcCreated = true; // ⚠️ past this line ctx must NEVER be closed

    const gain = ctx.createGain();
    // Analyser sits between gain and output purely as a tap — it passes audio
    // through untouched and lets detectBoostSilence() measure what we produce.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(gain);
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    gain.gain.value = pct / 100;
    boostMap.set(video, { ctx, gain, src, analyser, bypassed: false }); // replaces the pending marker
    return { ok: true };
  } catch (err) {
    if (!srcCreated) {
      // Nothing is attached yet — closing is safe and prevents orphan contexts.
      await closeBoostCtx(ctx);
      return { ok: false, reason: err?.name === "InvalidStateError" ? "connected" : "failed" };
    }

    // The element is already routed through ctx and can never be detached.
    // Closing here would silence the video for good, so we keep the context alive
    // and wire the source straight to the output: audio survives at its natural
    // level, just without boost. The entry is stored (degraded) so no later call
    // retries on an element a second createMediaElementSource() would reject.
    try {
      src.disconnect();
      src.connect(ctx.destination);
    } catch {}
    boostMap.set(video, { ctx, src, gain: null, bypassed: true, degraded: true });
    return { ok: false, reason: "degraded" };
  }
}

// → { ok: true } | { ok: false, reason }
async function applyBoostToVideo(video, pct) {
  if (!video) return { ok: false, reason: "no_video" };

  // 100% is the neutral floor: never build an irreversible graph just to reach a
  // level the element can already produce. Anything at or below 100% belongs to
  // ACTION:VOLUME, which stays the sole owner of video.volume / video.muted —
  // the booster only ever writes gain.gain.value on its own node, so the two
  // never fight over the same property.
  if (pct <= 100) {
    if (boostMap.has(video)) resetBoost(video);
    return { ok: true };
  }

  const existing = boostMap.get(video);
  if (existing) {
    // An attempt is already in flight for this element — join it instead of
    // starting a second one. Gate 2 can take up to BOOST_RESUME_TIMEOUT_MS, which
    // is longer than the popup's throttle window, so without this marker a single
    // slider drag raced several createMediaElementSource() calls onto one element
    // and all but the first threw InvalidStateError.
    if (existing.pending) {
      const res = await existing.pending;
      if (res.ok) {
        const entry = boostMap.get(video);
        if (entry?.gain) entry.gain.gain.value = pct / 100; // newest value wins
      }
      return res;
    }
    // Bound to our context but with no usable gain node — boosting it again is
    // impossible until the page reloads.
    if (existing.degraded) return { ok: false, reason: "degraded" };

    // Already wired: just move the gain (and put the node back in the path if a
    // previous resetBoost() bypassed it).
    try {
      if (existing.bypassed) {
        existing.src.disconnect();
        existing.src.connect(existing.gain);
        existing.bypassed = false;
      }
      existing.gain.gain.value = pct / 100;
      return { ok: true };
    } catch { return { ok: false, reason: "failed" }; }
  }

  // ---- Gate 1: source ---- (synchronous, so it settles before we claim the slot)
  const srcCheck = boostSourceCheck(video);
  if (srcCheck !== "ok") return { ok: false, reason: srcCheck };
  if (!(window.AudioContext || window.webkitAudioContext)) {
    return { ok: false, reason: "unsupported" };
  }

  // Without sticky activation Chrome starts every AudioContext suspended and
  // resume() never settles, so gate 2 is guaranteed to fail. Answering here skips
  // building — and immediately tearing down — a context we know cannot run, and
  // makes a drag on an untouched page cost nothing at all.
  if (navigator.userActivation && navigator.userActivation.hasBeenActive === false) {
    return { ok: false, reason: "suspended" };
  }

  // Claim the element. buildBoostGraph runs synchronously up to its first await,
  // and no await separates it from the set() below, so no concurrent message can
  // slip between them and start a rival attempt.
  const attempt = buildBoostGraph(video, pct);
  boostMap.set(video, { pending: attempt });

  const res = await attempt;
  if (!res.ok) {
    // Release the claim so a later attempt (e.g. once the user clicks the page)
    // can retry. On success buildBoostGraph already swapped in the real entry.
    const cur = boostMap.get(video);
    if (cur?.pending === attempt) boostMap.delete(video);
  }
  return res;
}

// The closest thing to an undo that the spec allows: the element stays routed
// through our context forever, but bypassing the gain node restores the original
// loudness. applyBoostToVideo() re-inserts the node when the user boosts again.
function resetBoost(video) {
  const entry = boostMap.get(video);
  // A degraded entry is already bypassed and has no gain node to neutralise.
  if (!entry || entry.pending || entry.degraded) return { ok: false, reason: "no_entry" };
  try {
    entry.gain.gain.value = 1;
    entry.src.disconnect();
    entry.src.connect(entry.ctx.destination);
    entry.bypassed = true;
    return { ok: true };
  } catch { return { ok: false, reason: "failed" }; }
}

// A CORS-tainted MediaElementAudioSourceNode outputs digital silence by spec, and
// boostSourceCheck() cannot see post-redirect URLs, so gate 1 has a real blind
// spot. Rather than warn every user forever, we measure the graph we built: if the
// element is definitely decoding audio and should be audible, yet our own output
// is exactly zero every time we look, the source was tainted and our routing is
// what silenced it.
//
// The reads are SPACED, not consecutive animation frames. Three rAF ticks span
// ~50ms, and legitimate content clears that easily — a pause between sentences, a
// gap between scenes, or a fade-out is silent for far longer, which would fire a
// false alarm on perfectly healthy audio. Spreading three reads over ~2s means a
// false positive now requires two full seconds of absolute digital silence while
// the decoder is still producing audio bytes.
const BOOST_SILENCE_DELAY_MS = 1000; // let playback settle before the first read
const BOOST_SILENCE_GAP_MS = 400;    // spacing between reads
const BOOST_SILENCE_READS = 3;       // last read lands ~1.8s after the boost
let boostSilent = false;             // sticky: taint cannot be undone without a reload

function detectBoostSilence(video) {
  const entry = boostMap.get(video);
  if (!entry?.analyser || entry.silenceChecked) return;
  entry.silenceChecked = true;

  setTimeout(async () => {
    const e = boostMap.get(video);
    if (!e?.analyser) return;

    // Only meaningful while the element should genuinely be producing sound AND
    // our analyser is still in the signal path. resetBoost() bypasses the gain and
    // analyser, so a user dropping to 100% mid-check would starve the tap and read
    // as pure silence. webkitAudioDecodedByteCount proves an audio track is really
    // being decoded, which rules out silent-by-nature videos.
    const measurable = () =>
      !e.bypassed && !video.paused && !video.muted && video.volume > 0 &&
      video.webkitAudioDecodedByteCount > 0;

    const buf = new Float32Array(e.analyser.fftSize);
    for (let i = 0; i < BOOST_SILENCE_READS; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, BOOST_SILENCE_GAP_MS));
      if (!measurable()) return;            // conditions changed — verdict unsafe
      e.analyser.getFloatTimeDomainData(buf);
      if (buf.some((s) => s !== 0)) return; // real audio — nothing wrong
    }

    // All reads were pure zeros across ~2s of decoded audio.
    boostSilent = true;
    lastBoostFailure = "silent";
  }, BOOST_SILENCE_DELAY_MS);
}

function pickBoostReason(reasons) {
  for (const r of BOOST_REASON_PRIORITY) if (reasons.has(r)) return r;
  return "failed";
}

// A player that swaps its <video> (YouTube between Shorts/home/watch) leaves the
// new element unboosted while boostPct still says e.g. 300% — the popup would lie.
// So we re-apply to the new element, and when that fails we drop back to 100%
// so the reported value always matches what is actually audible.
async function reapplyBoostTo(video) {
  if (isBlockedHost()) return;
  if (boostPct <= 100) return;       // nothing to carry over
  if (!video || boostMap.has(video)) return; // same element, gain already live
  const res = await applyBoostToVideo(video, boostPct);
  if (!res.ok) {
    boostPct = 100;
    lastBoostFailure = res.reason;
  }
}

// Same trigger pair as startYtAutoQuality()
function startBoostReapply() {
  document.addEventListener("loadedmetadata", (e) => {
    if (e.target?.tagName !== "VIDEO") return;
    reapplyBoostTo(e.target);
  }, true);
  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(() => {
      for (const v of document.querySelectorAll("video")) reapplyBoostTo(v);
    }, 800);
  }, true);
}

async function applyBoostToAllVideos(pct) {
  // A blocked site must stay untouched — routing its audio through Web Audio is
  // exactly the kind of interference the block button promises to stop.
  if (isBlockedHost()) {
    lastBoostFailure = "blocked";
    return { ok: false, reason: "blocked" };
  }

  boostPct = pct;
  const videos = document.querySelectorAll("video");
  if (!videos.length) {
    lastBoostFailure = "no_video";
    return { ok: false, reason: "no_video" };
  }

  let okCount = 0;
  const reasons = new Set();
  for (const v of videos) {
    const res = await applyBoostToVideo(v, pct);
    if (res.ok) {
      okCount++;
      detectBoostSilence(v);
    } else reasons.add(res.reason);
  }

  // "degraded" means an element is bound to our context for good with no usable
  // gain node. Unlike not_ready/no_src — routine on preload and ad elements — it
  // must reach the user even when another video on the page succeeded, otherwise
  // the failure is invisible and the only remedy (a reload) is never offered.
  if (reasons.has("degraded")) {
    lastBoostFailure = "degraded";
    return { ok: false, reason: "degraded", count: okCount };
  }

  if (okCount > 0) {
    lastBoostFailure = null;
    return { ok: true, count: okCount };
  }
  lastBoostFailure = pickBoostReason(reasons);
  return { ok: false, reason: lastBoostFailure };
}

let lastFsAt = 0;
let lastMouse2At = 0;
let suppressContextMenuUntil = 0;

function nowMs() { return Date.now(); }

const ZONE_LABELS = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"];
function zoneLabel(zone) {
  return ZONE_LABELS[Number(zone) - 1] || String(zone);
}

function buildMap() {
  map = new Map();
  for (const m of (siteRules.mappings || [])) {
    if (m?.from && m?.to) map.set(m.from, m.to);
  }
}

function buildSiteMap() {
  siteMap = new Map();
  if (!siteProfile?.enabled) return;
  for (const m of (siteProfile.mappings || [])) {
    if (m?.from && m?.to) siteMap.set(m.from, m.to);
  }
}

function lookupRemap(sig) {
  // Per-site profile wins; otherwise fall back to global rules
  if (siteMap.has(sig)) return siteMap.get(sig);
  return map.get(sig);
}

function remappingEnabled() {
  return !!(siteRules?.enabled || siteProfile?.enabled);
}

// Per-site profiles are sharded one key per domain (see storage.js). We read only
// our own shard instead of every profile on the account. The legacy blob is read
// in the SAME call as a fallback, so a user who has not opened the popup or the
// options page yet — and therefore has not run the migration — keeps working.
// Once migration removes the legacy key this read carries the shard alone.
function spKeyFor(host) { return `sp:${host}`; }

async function loadSiteProfile() {
  const host = baseDomain(location.host);
  const key = spKeyFor(host);
  const data = await chrome.storage.sync.get([key, "siteProfiles"]);
  const profile = data[key] || data.siteProfiles?.[host];
  siteProfile = {
    enabled: !!profile?.enabled,
    mappings: Array.isArray(profile?.mappings) ? profile.mappings : []
  };
  buildSiteMap();
}

// ✅ تضمن وجود إعدادات Zones حتى لو المستخدم ما فتح options.html
// First-run zone bindings, in memory only. Mirrors defaultZoneActions() in
// options.js — keep the two in sync.
const FIRST_RUN_ZONES = {
  enabled: true,
  fullscreenOnly: false,
  wheel: { map: {
    "4": { up: ["ACTION:VOLUME:+4"], down: ["ACTION:VOLUME:-4"] },
    "6": { up: ["ACTION:SEEK:+5"],   down: ["ACTION:SEEK:-5"] },
    "7": { up: ["ACTION:SEEK:+1"],   down: ["ACTION:SEEK:-1"] }
  } }
};

// READ-ONLY. This function used to write its defaults straight into
// zones.wheel.map, bypassing zones.wheel.actions which is the source of truth
// (audit #4). Deleting a zone's actions in the editor therefore did nothing: the
// next page load put the old raw strings back, so the editor showed an empty zone
// while the wheel kept firing — ghost bindings the user could never remove.
// options.js is now the only writer of zone defaults.
//
// A missing `zones` key means a genuinely fresh install, so we hand back
// FIRST_RUN_ZONES without persisting it. An existing-but-empty `zones` means the
// user emptied it on purpose and is returned untouched.
async function ensureZonesDefaults() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const zones = (data.settings || {}).zones;
  if (!zones) return structuredClone(FIRST_RUN_ZONES);
  return zones;
}

async function loadBlockedHosts() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  blockedHosts = Array.isArray(settings.blockedHosts) ? settings.blockedHosts : [];
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "0,0,0";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

async function loadSubtitleSettings() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const s = data.settings || {};
  const sub = s.subtitles || {};
  subtitleSettings = {
    enabled: !!sub.enabled,
    defaultLang: String(sub.defaultLang || "").toLowerCase(),
    fontSize: Number(sub.fontSize || 22),
    color: sub.color || "#ffffff",
    bgColor: sub.bgColor || "#000000",
    bgOpacity: Number(sub.bgOpacity ?? 0.6),
    fontFamily: sub.fontFamily || "system-ui, -apple-system, sans-serif",
    position: sub.position || "bottom"
  };
  applySubtitleStyles();
  applySubtitleTrack();
}

function applySubtitleStyles() {
  // A blocked site must get no styling layer at all — the block button promises
  // the extension keeps its hands off (audit #6). The existing tag is still
  // removed below, so blocking a site strips styles already injected.
  // Remove existing style tag, then optionally inject new one
  if (subtitleStyleEl) {
    subtitleStyleEl.remove();
    subtitleStyleEl = null;
  }
  if (isBlockedHost() || !subtitleSettings.enabled) return;

  const { fontSize, color, bgColor, bgOpacity, fontFamily, position } = subtitleSettings;
  const bgRgba = `rgba(${hexToRgb(bgColor)},${Math.max(0, Math.min(1, bgOpacity))})`;
  const posCss =
    position === "top" ? "top:8%;bottom:auto;" :
    position === "middle" ? "top:50%;bottom:auto;transform:translateY(-50%);" :
    "bottom:8%;top:auto;";

  const css = `
    /* Native HTML5 cues (works on most generic <video><track> setups) */
    html video::cue {
      font-size:${fontSize}px !important;
      color:${color} !important;
      background-color:${bgRgba} !important;
      background:${bgRgba} !important;
      font-family:${fontFamily} !important;
      line-height:1.35 !important;
      padding:2px 6px !important;
      text-shadow:none !important;
    }

    /* YouTube — high specificity via html prefix + match every descendant of caption containers */
    html .ytp-caption-segment,
    html .captions-text .ytp-caption-segment,
    html .ytp-caption-window-container .ytp-caption-segment,
    html .ytp-caption-window-container span,
    html .caption-visual-line *,
    html .captions-text * {
      font-size:${fontSize}px !important;
      color:${color} !important;
      background-color:${bgRgba} !important;
      background:${bgRgba} !important;
      background-image:none !important;
      font-family:${fontFamily} !important;
      padding:2px 8px !important;
      text-shadow:none !important;
      fill:${color} !important;
    }
    html .ytp-caption-window-container,
    html .caption-window {
      ${posCss}
      left:50% !important; right:auto !important;
      transform:translateX(-50%)${position === "middle" ? " translateY(-50%)" : ""} !important;
      max-width:90% !important;
      z-index:60 !important;
    }
    html .ytp-caption-segment {
      z-index:61 !important;
      position:relative !important;
    }

    /* Netflix */
    html .player-timedtext-text-container,
    html .player-timedtext-text-container span,
    html .player-timedtext .player-timedtext-text-container * {
      font-size:${fontSize}px !important;
      color:${color} !important;
      background-color:${bgRgba} !important;
      background:${bgRgba} !important;
      font-family:${fontFamily} !important;
      text-shadow:none !important;
    }
    html .player-timedtext {
      ${posCss}
      z-index:60 !important;
    }

    /* JW Player / generic */
    html .jw-text-track-cue,
    html .jw-text-track-display,
    html .jw-text-track-display * {
      font-size:${fontSize}px !important;
      color:${color} !important;
      background-color:${bgRgba} !important;
      background:${bgRgba} !important;
      font-family:${fontFamily} !important;
    }
  `;

  subtitleStyleEl = document.createElement("style");
  subtitleStyleEl.id = "vz_subtitles_css";
  subtitleStyleEl.textContent = css;
  document.documentElement.appendChild(subtitleStyleEl);
}

function applySubtitleTrack() {
  if (isBlockedHost()) return;
  const lang = subtitleSettings.defaultLang;
  if (!subtitleSettings.enabled || !lang) return;

  for (const video of document.querySelectorAll("video")) {
    enableMatchingTextTrack(video, lang);
  }

  if (isYouTubeHost()) {
    // Drive YouTube's CC + auto-translate menu via simulated clicks
    youtubeSetCaptionLanguage(lang);
  } else {
    tryEnableYouTubeCC(); // no-op outside YouTube
  }
}

function tryEnableYouTubeCC() {
  if (!isYouTubeHost()) return;
  const btn = document.querySelector(".ytp-subtitles-button");
  if (!btn) return;
  if (btn.getAttribute("aria-pressed") === "true") return;
  try { btn.click(); } catch {}
}

function isYouTubeHost() {
  return /(^|\.)youtube\.com$/.test(location.hostname);
}

// Common language names by ISO code, lowercased — used to match menuitem text
const YT_LANG_NAMES = {
  ar: ["arabic", "العربية", "عربي"],
  en: ["english", "الإنجليزية"],
  es: ["spanish", "español", "الإسبانية"],
  fr: ["french", "français", "الفرنسية"],
  de: ["german", "deutsch", "الألمانية"],
  it: ["italian", "italiano", "الإيطالية"],
  ja: ["japanese", "日本語", "اليابانية"],
  ko: ["korean", "한국어", "الكورية"],
  zh: ["chinese", "中文", "الصينية"],
  ru: ["russian", "русский", "الروسية"],
  tr: ["turkish", "türkçe", "التركية"],
  pt: ["portuguese", "português", "البرتغالية"],
  hi: ["hindi", "हिन्दी", "الهندية"],
  ur: ["urdu", "اردو"],
  fa: ["persian", "farsi", "فارسی", "الفارسية"],
  nl: ["dutch", "nederlands"],
  pl: ["polish", "polski"],
  sv: ["swedish", "svenska"],
  id: ["indonesian", "bahasa indonesia"]
};

// Labels for the "Subtitles/CC" menuitem (localized variants)
const YT_SUBTITLE_LABELS = [
  "subtitles/cc", "subtitles", "captions", "cc",
  "ترجمة", "الترجمة", "الترجمات",
  "sous-titres", "untertitel", "subtítulos", "legendas",
  "字幕", "altyazılar", "subtitulos", "phụ đề"
];

let ytCaptionAttemptKey = null;

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function waitForCondition(check, timeout = 1500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      let v;
      try { v = typeof check === "function" ? check() : document.querySelector(check); } catch { v = null; }
      if (v) return resolve(v);
      if (Date.now() - start > timeout) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function findVisibleYTMenuItem(predicate) {
  const items = document.querySelectorAll(".ytp-popup.ytp-settings-menu .ytp-menuitem");
  for (const item of items) {
    const r = item.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const label = (item.querySelector(".ytp-menuitem-label")?.textContent || "").trim().toLowerCase();
    if (predicate(label, item)) return item;
  }
  return null;
}

function closeYTSettingsIfOpen() {
  const popup = document.querySelector(".ytp-popup.ytp-settings-menu");
  if (popup?.offsetHeight > 0) {
    document.querySelector(".ytp-settings-button")?.click();
  }
}

async function youtubeSetCaptionLanguage(langCode) {
  // Guarded independently of applySubtitleTrack: this one drives the player with
  // synthetic clicks, the most intrusive thing the extension does.
  if (isBlockedHost()) return false;
  if (!langCode || !isYouTubeHost()) return false;

  const targetNames = (YT_LANG_NAMES[langCode] || [langCode]).map((s) => s.toLowerCase());
  const key = `${location.pathname}${location.search}|${langCode}`;
  if (ytCaptionAttemptKey === key) return false; // don't loop on same video
  ytCaptionAttemptKey = key;

  try {
    // 1. Enable CC button if not already on
    const ccBtn = await waitForCondition(".ytp-subtitles-button", 4000);
    if (!ccBtn) return false;
    if (ccBtn.getAttribute("aria-pressed") !== "true") {
      ccBtn.click();
      await delay(250);
    }

    // 2. Open the settings (gear) menu — close it first if it's already open
    const gear = document.querySelector(".ytp-settings-button");
    if (!gear) return false;
    const existing = document.querySelector(".ytp-popup.ytp-settings-menu");
    if (existing?.offsetHeight > 0) {
      gear.click();
      await delay(180);
    }
    gear.click();
    const opened = await waitForCondition(".ytp-popup.ytp-settings-menu .ytp-menuitem", 1500);
    if (!opened) return false;

    // 3. Click the "Subtitles/CC" menuitem
    const subItem = findVisibleYTMenuItem((label) =>
      YT_SUBTITLE_LABELS.some((l) => label.includes(l))
    );
    if (!subItem) { closeYTSettingsIfOpen(); return false; }
    subItem.click();
    await delay(300);

    // 4. In the captions panel: try direct language match first
    const direct = findVisibleYTMenuItem((label) =>
      targetNames.some((n) => label.includes(n))
    );
    if (direct) {
      // Avoid re-clicking the same item if it's already checked
      if (direct.getAttribute("aria-checked") !== "true") {
        direct.click();
      } else {
        closeYTSettingsIfOpen();
      }
      return true;
    }

    // 5. Open "Auto-translate" submenu — it's the menuitem with aria-haspopup
    const autoItem = findVisibleYTMenuItem((_label, item) =>
      item.getAttribute("aria-haspopup") === "true"
    );
    if (!autoItem) { closeYTSettingsIfOpen(); return false; }
    autoItem.click();
    await delay(300);

    // 6. Find the target language in the language list
    const targetItem = findVisibleYTMenuItem((label) =>
      targetNames.some((n) => label.includes(n))
    );
    if (!targetItem) { closeYTSettingsIfOpen(); return false; }
    targetItem.click();
    return true;
  } catch {
    closeYTSettingsIfOpen();
    return false;
  }
}

function enableMatchingTextTrack(video, lang) {
  if (!video?.textTracks) return;
  const target = lang.toLowerCase();
  let foundMatch = false;
  for (const track of video.textTracks) {
    const tLang = (track.language || "").toLowerCase();
    const tLabel = (track.label || "").toLowerCase();
    if (tLang.startsWith(target) || tLabel.includes(target)) {
      track.mode = "showing";
      foundMatch = true;
    } else if (track.mode === "showing") {
      // Leave other showing tracks alone unless user matched a different one
    }
  }
  return foundMatch;
}

function startSubtitleTrackObserver() {
  if (subtitleTrackObserver) return;
  subtitleTrackObserver = new MutationObserver((mutations) => {
    if (!subtitleSettings.enabled || !subtitleSettings.defaultLang) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node?.nodeType !== 1) continue;
        if (node.tagName === "VIDEO") {
          enableMatchingTextTrack(node, subtitleSettings.defaultLang);
        } else if (node.querySelectorAll) {
          for (const v of node.querySelectorAll("video")) {
            enableMatchingTextTrack(v, subtitleSettings.defaultLang);
          }
        }
      }
    }
  });
  subtitleTrackObserver.observe(document.documentElement, { childList: true, subtree: true });

  // SPA navigation on YouTube: each new video is a new attempt
  document.addEventListener("yt-navigate-finish", () => {
    ytCaptionAttemptKey = null;
    if (subtitleSettings.enabled && subtitleSettings.defaultLang) {
      setTimeout(() => applySubtitleTrack(), 1500);
    }
  }, true);

  // Native loadedmetadata fires when a new video loads — re-apply after a short delay
  document.addEventListener("loadedmetadata", (e) => {
    if (e.target?.tagName !== "VIDEO") return;
    if (!subtitleSettings.enabled || !subtitleSettings.defaultLang) return;
    setTimeout(() => applySubtitleTrack(), 500);
  }, true);
}

// ⚠️ PAIRED COPY — duplicated verbatim in storage.js. Edit both together;
// tools/test-migration.js fails if they drift apart.
// ---- BEGIN gridAppearance ----
// The exact look the in-video overlay had BEFORE Grid Appearance was wired up.
// options.js must share these: it used to auto-fill a different set (opaque
// #10131a) merely by being opened, which — once the setting actually reached the
// overlay — turned the grid into a solid wall nobody had chosen.
const GRID_APPEARANCE_DEFAULTS = Object.freeze({
  cellBg: "#000000",
  cellBgOpacity: 0,          // شفاف تماماً: لا خلفية إطلاقاً، كما كان
  cellBorder: "#ffffff",
  cellBorderOpacity: 0.32,   // نفس rgba(255,255,255,.32) القديمة
  numberColor: "#ffffff",
  radius: 0
});

// What options.js wrote just by being opened. A stored value identical to one of
// these was never picked by a human, so it must not migrate as a deliberate colour.
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
    return typeof v === "string" && v ? v : GRID_APPEARANCE_DEFAULTS[key];
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
    radius: Number.isFinite(radius) ? radius : GRID_APPEARANCE_DEFAULTS.radius
  };
}
// ---- END gridAppearance ----

let gridAppearance = resolveGridAppearance(null);

function applyGridVars(el) {
  if (!el) return;
  el.style.setProperty("--vz-cell-bg", rgbaFrom(gridAppearance.cellBg, gridAppearance.cellBgOpacity));
  el.style.setProperty("--vz-cell-border", rgbaFrom(gridAppearance.cellBorder, gridAppearance.cellBorderOpacity));
  el.style.setProperty("--vz-num-color", gridAppearance.numberColor);
  el.style.setProperty("--vz-cell-radius", `${gridAppearance.radius}px`);
}

async function loadGridAppearance() {
  const data = await chrome.storage.sync.get({ settings: {} });
  gridAppearance = resolveGridAppearance((data.settings || {}).gridAppearance);
  applyGridVars(vzOverlay);
}

async function loadSoundDisplaySettings() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const settings = data.settings || {};
  const sound = settings.soundDisplay || soundDisplaySettings;
  soundDisplaySettings = {
    color: sound.color || "#ffffff",
    fontSize: Number(sound.fontSize || 48)
  };

  if (vzOverlay) {
    vzOverlay.style.setProperty("--vz-volume-color", soundDisplaySettings.color);
    vzOverlay.style.setProperty("--vz-volume-size", `${soundDisplaySettings.fontSize}px`);
  }
  if (vzVolumeBadge) {
    vzVolumeBadge.style.setProperty("--vz-volume-color", soundDisplaySettings.color);
    vzVolumeBadge.style.setProperty("--vz-volume-size", `${soundDisplaySettings.fontSize}px`);
  }
}

async function loadYtAutoQualitySettings() {
  const data = await chrome.storage.sync.get({ settings: {} });
  ytAutoQuality = (data.settings || {}).ytAutoQuality || "";
}

// yt_quality_main.js runs in the page's main world (declared in manifest.json).
// We communicate with it via CustomEvent — content scripts cannot call YouTube's player API directly.
function triggerYtQuality() {
  if (!isYouTubeHost() || !ytAutoQuality) return;
  window.dispatchEvent(new CustomEvent("__vz_setq__", { detail: { q: ytAutoQuality } }));
}

function startYtAutoQuality() {
  if (!isYouTubeHost()) return;
  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(() => triggerYtQuality(), 800);
  }, true);
  document.addEventListener("loadedmetadata", (e) => {
    if (e.target?.tagName !== "VIDEO") return;
    triggerYtQuality();
  }, true);
}

// -------- Shorts → المشغّل العادي --------
async function loadYtShortsRedirectSetting() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const s = data.settings || {};
  // Refresh blockedHosts from the same read so the first redirect check
  // can't run before loadBlockedHosts() resolves
  if (Array.isArray(s.blockedHosts)) blockedHosts = s.blockedHosts;
  ytShortsRedirect = s.ytShortsRedirect !== false; // default on
}

function maybeRedirectShorts() {
  if (!ytShortsRedirect || !isYouTubeHost() || isBlockedHost()) return;
  if (window.top !== window) return; // top frame only
  const m = /^\/shorts\/([A-Za-z0-9_-]+)/.exec(location.pathname);
  if (!m) return;
  // Keep the query string (e.g. ?list= playlist context, ?t= timestamp)
  const params = new URLSearchParams(location.search);
  params.set("v", m[1]);
  // location.replace keeps the shorts URL out of history so Back doesn't bounce
  location.replace(`${location.origin}/watch?${params.toString()}`);
}

function startYtShortsRedirect() {
  if (!isYouTubeHost()) return;
  maybeRedirectShorts(); // direct page load (document_start)
  // SPA navigation: both events fire after the URL has changed
  document.addEventListener("yt-navigate-start", maybeRedirectShorts, true);
  document.addEventListener("yt-navigate-finish", maybeRedirectShorts, true);
}

// -------- Clean Player: إخفاء عناصر مشغّل يوتيوب --------
// Keys must match CLEAN_PLAYER_OPTIONS in options.js.
// Selectors verified against the live 2026 player CSS + open-source hide lists
// (ImprovedTube, yt-neuter, Control Panel for YouTube, YTPlayerButtonsRemover).
const CLEAN_PLAYER_ITEMS = {
  ambient_mode:            ["#cinematics-container", "#cinematics"],
  top_section:             [".ytp-chrome-top", ".ytp-gradient-top", ".ytp-chrome-top-buttons"],
  top_titles:              [".ytp-title", ".ytp-title-channel"],
  top_playlist_menu:       [".ytp-playlist-menu-button"],
  top_watch_later:         [".ytp-watch-later-button"],
  top_share:               [".ytp-share-button"],
  // Old .ytp-info-button is gone; today's equivalent is the ⋮ overflow button + its panel
  top_info:                [".ytp-overflow-button", ".ytp-overflow-panel", ".ytp-info-button"],
  top_card_teaser:         [".ytp-cards-teaser"],
  // 2025 "Delhi" player: like/share cluster overlaid bottom-right in fullscreen
  quick_actions:           [".ytp-fullscreen-quick-actions"],
  paid_content:            [".ytp-paid-content-overlay"],
  suggested_action:        [".ytp-suggested-action", ".ytp-suggested-action-badge"],
  annotations:             [".video-annotations", ".annotation", ".iv-branding"],
  cards:                   [".ytp-cards-button", ".iv-drawer"],
  endscreen:               [".html5-endscreen", ".ytp-ce-element", ".ytp-endscreen-content", ".ytp-fullscreen-grid-stills-container"],
  embed_more_videos:       [".ytp-pause-overlay-container", ".ytp-pause-overlay"],
  watermark:               [".ytp-watermark"],
  large_play_button:       [".ytp-large-play-button"],
  spinner:                 [".ytp-spinner"],
  heatmap:                 [".ytp-heat-map-container", ".ytp-heat-map-chapter"],
  prev_button:             [".ytp-prev-button"],
  play_button:             [".ytp-play-button"],
  next_button:             [".ytp-next-button"],
  mute_button:             [".ytp-mute-button"],
  volume_slider:           [".ytp-volume-panel", ".ytp-volume-slider"],
  time_display:            [".ytp-time-display"],
  chapter_button:          [".ytp-chapter-container"],
  // classic pill + the "Delhi" fullscreen "More videos" scroll grid that replaced it
  fullscreen_scroll_arrow: ["button.ytp-fullerscreen-edu-button", ".ytp-fullerscreen-edu-button", ".ytp-fullscreen-grid"],
  // hide the PARENT button (classic + Delhi variants); inner pill kept as fallback
  autoplay_toggle:         ["button.ytp-button[data-tooltip-target-id='ytp-autonav-toggle-button']", "button.ytp-autonav-toggle", ".ytp-autonav-toggle-button"],
  subtitles_button:        [".ytp-subtitles-button"],
  settings_button:         [".ytp-settings-button"],
  multicam_button:         [".ytp-multicam-button"],
  miniplayer_button:       [".ytp-miniplayer-button"],
  pip_button:              [".ytp-pip-button"],
  size_button:             [".ytp-size-button"],
  remote_button:           [".ytp-remote-button"],
  fullscreen_button:       [".ytp-fullscreen-button"]
};

let cleanPlayerSettings = { enabled: false, items: {} };
let cleanPlayerStyleEl = null;

// Embedded players also live on youtube-nocookie.com iframes
function isYouTubeFamilyHost() {
  return /(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname);
}

async function loadCleanPlayerSettings() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const s = data.settings || {};
  // Same-read refresh of blockedHosts (see loadYtShortsRedirectSetting)
  if (Array.isArray(s.blockedHosts)) blockedHosts = s.blockedHosts;
  const cp = s.cleanPlayer || {};
  cleanPlayerSettings = {
    enabled: !!cp.enabled,
    items: (cp.items && typeof cp.items === "object") ? cp.items : {}
  };
  applyCleanPlayerCSS();
}

function applyCleanPlayerCSS() {
  if (cleanPlayerStyleEl) {
    cleanPlayerStyleEl.remove();
    cleanPlayerStyleEl = null;
  }
  if (!cleanPlayerSettings.enabled || !isYouTubeFamilyHost() || isBlockedHost()) return;

  const selectors = [];
  for (const [key, sels] of Object.entries(CLEAN_PLAYER_ITEMS)) {
    if (!cleanPlayerSettings.items[key]) continue;
    // html prefix raises specificity above YouTube's own rules (same trick as subtitles CSS)
    for (const sel of sels) selectors.push(`html ${sel}`);
  }
  if (!selectors.length) return;

  cleanPlayerStyleEl = document.createElement("style");
  cleanPlayerStyleEl.id = "vz_clean_player_css";
  cleanPlayerStyleEl.textContent = `${selectors.join(",\n")} { display: none !important; }`;
  document.documentElement.appendChild(cleanPlayerStyleEl);
}

function isBlockedHost() {
  return blockedHosts.includes(baseDomain(location.host));
}




// -------------------- Global Video Zones (3x3 + Wheel) --------------------
let zoneSettings = { enabled: true, wheel: { map: {} } };








async function loadZoneSettings() {
  const zones = await ensureZonesDefaults(); //  يضمن وجود الإعدادات حتى بدون فتح options
  zoneSettings = zones || zoneSettings;

  zoneSettings.enabled = zoneSettings.enabled !== false; // default true
  zoneSettings.fullscreenOnly = zoneSettings.fullscreenOnly === true;
  // "player" = الشبكة على كامل إطار المشغّل (يشمل الأشرطة السوداء)، "video" = على الفيديو فقط
  zoneSettings.gridCoverage = zoneSettings.gridCoverage === "video" ? "video" : "player";
  zoneSettings.wheel ||= { map: {} };
  zoneSettings.wheel.map ||= {};
  zoneSettings.click ||= { map: {} };
  zoneSettings.click.map ||= {};
  zoneSettings.key ||= { map: {} };
  zoneSettings.key.map ||= {};
}

// Known site player wrappers — shared by fullscreen + zone-rect logic
const KNOWN_PLAYER_WRAPPER_SELECTOR =
  "#movie_player," +              // YouTube
  ".html5-video-player," +        // YouTube alt class
  ".video-player," +              // Twitch / generic
  "[data-a-target='video-player']," + // Twitch
  ".jw-wrapper," +                // JW Player
  ".video-js," +                  // Video.js
  ".plyr," +                      // Plyr
  ".vjs-fluid";                   // Video.js variant

const zoneContainerCache = new WeakMap(); // video → { container|null, parent } (null = negative lookup, cached too)

// A player frame legitimately exceeds the video area only by the letterbox
// ratio (worst realistic case ≈ 6.3×: a 9:16 video fullscreen on a 32:9
// monitor). Anything bigger is a page-level wrapper, not a player frame.
const ZONE_WRAPPER_MAX_AREA_RATIO = 7;

// The rect the 3×3 grid is resolved/drawn against.
// In "player" mode we use the player frame (e.g. YouTube sizes <video> to the
// content aspect ratio, so black bars live OUTSIDE the video element).
function zoneRectForVideo(video) {
  if (!video) return null;
  const videoRect = video.getBoundingClientRect();
  // Anything other than the explicit "video" opt-out means full-frame (default)
  if (zoneSettings?.gridCoverage === "video") return videoRect;

  let entry = zoneContainerCache.get(video);
  // Re-resolve when the video was re-parented or the cached wrapper left the DOM
  if (!entry || entry.parent !== video.parentElement ||
      (entry.container && !entry.container.isConnected)) {
    entry = {
      container: video.closest?.(KNOWN_PLAYER_WRAPPER_SELECTOR) || null,
      parent: video.parentElement
    };
    zoneContainerCache.set(video, entry);
  }
  if (!entry.container) return videoRect; // generic sites: bars are inside the <video> box already

  const rect = entry.container.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return videoRect;

  const videoArea = videoRect.width * videoRect.height;
  if (videoArea <= 0) return videoRect; // hidden/preloading video: never adopt the wrapper
  if ((rect.width * rect.height) / videoArea > ZONE_WRAPPER_MAX_AREA_RATIO) return videoRect;

  return rect;
}

function zonesActive() {
  if (!remappingEnabled()) return false;
  if (isBlockedHost()) return false;
  if (!zoneSettings?.enabled) return false;
  if (zoneSettings?.fullscreenOnly && !document.fullscreenElement) return false;
  return true;
}

function getZoneAtEvent(e) {
  const video = getVideoUnderPointer(e);
  if (!video) return null;
  ensureVideoOverlay(video);
  const rect = zoneRectForVideo(video);
  const zone = getZoneNumber(rect, e.clientX, e.clientY);
  return zone ? { video, zone } : null;
}

function findVideoAtPoint(x, y) {
  if (typeof x !== "number" || typeof y !== "number") return null;

  const stack = typeof document.elementsFromPoint === "function"
    ? document.elementsFromPoint(x, y)
    : [document.elementFromPoint(x, y)].filter(Boolean);

  for (const el of stack) {
    if (!el) continue;
    if (el.tagName === "VIDEO") return el;

    const closestVideo = el.closest?.("video");
    if (closestVideo) return closestVideo;

    const descendantVideos = el.querySelectorAll?.("video");
    if (!descendantVideos?.length) continue;

    for (const video of descendantVideos) {
      // Skip hidden/preloading videos (0×0 rect) so they can't win via a
      // shared player wrapper over the actually visible video.
      const own = video.getBoundingClientRect?.();
      if (!own || own.width <= 0 || own.height <= 0) continue;
      // In "player" coverage mode the black bars around the video count too
      const rect = zoneRectForVideo(video);
      if (!rect) continue;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return video;
      }
    }
  }

  return null;
}

function getVideoUnderPointer(e) {
  if (typeof e.clientX === "number" && typeof e.clientY === "number") {
    const v = findVideoAtPoint(e.clientX, e.clientY);
    if (v) return v;
  }
  return null;
}

// Zones numbered 1..9 from top-left to bottom-right
function getZoneNumber(rect, x, y) {
  const relX = x - rect.left;
  const relY = y - rect.top;
  if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null;
  const col = Math.min(2, Math.floor((relX / rect.width) * 3));  // 0..2
  const row = Math.min(2, Math.floor((relY / rect.height) * 3)); // 0..2
  return row * 3 + col + 1;
}

function updatePointerFromEvent(e) {
  if (typeof e.clientX === "number" && typeof e.clientY === "number") {
    lastPointer = { x: e.clientX, y: e.clientY };
  }
}

function getVideoFromPointerPosition() {
  if (typeof lastPointer.x !== "number" || typeof lastPointer.y !== "number") return null;
  return findVideoAtPoint(lastPointer.x, lastPointer.y);
}

function normalizeMappedActions(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

window.addEventListener("mousemove", updatePointerFromEvent, true);

window.addEventListener("wheel", (e) => {
  updatePointerFromEvent(e);
  if (!zonesActive()) return;

  const hit = getZoneAtEvent(e);
  if (!hit) return;

  const entry = zoneSettings?.wheel?.map?.[String(hit.zone)];
  if (!entry) return;

  const dir = e.deltaY < 0 ? "up" : "down";
  const actions = normalizeMappedActions(entry[dir]);
  if (!actions.length) return;
  showOverlay(`Zone ${zoneLabel(hit.zone)} • ${dir.toUpperCase()} → ${actions.join(" + ")}`);

  let ok = false;
  for (const action of actions) {
    ok = runAction(action, e) || ok;
  }
  if (!ok) return;

  e.preventDefault();
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();
}, { capture: true, passive: false });

// Zone-based click handler (left/middle/right click on a zone of a video)
function handleZoneClick(e) {
  if (!zonesActive()) return false;
  const triggerByBtn = { 0: "left", 1: "middle", 2: "right" };
  const which = triggerByBtn[e.button];
  if (!which) return false;
  // Left/middle fire on click/auxclick; right fires on contextmenu
  if (which === "right" && e.type !== "contextmenu") return false;
  if (which !== "right" && e.type !== "click" && e.type !== "auxclick") return false;

  const hit = getZoneAtEvent(e);
  if (!hit) return false;

  const entry = zoneSettings?.click?.map?.[String(hit.zone)];
  const actions = normalizeMappedActions(entry?.[which]);
  if (!actions.length) return false;

  e.__videoUnderPointer = hit.video;
  showOverlay(`Zone ${zoneLabel(hit.zone)} • ${which.toUpperCase()} CLICK → ${actions.join(" + ")}`);

  let ok = false;
  for (const action of actions) ok = runAction(action, e) || ok;
  delete e.__videoUnderPointer;

  if (ok) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  return ok;
}

window.addEventListener("click", handleZoneClick, true);
window.addEventListener("auxclick", handleZoneClick, true);
window.addEventListener("contextmenu", handleZoneClick, true);
// -------------------------------------------------------------------------
let overlaySettings = { enabled: true, autoHideMs: 900, volumeAutoHideMs: 900 };

async function loadOverlaySettings() {
  const data = await chrome.storage.sync.get({ settings: {} });
  const s = data.settings || {};
  const o = s.overlay || {};
  const grid = Number(o.autoHideMs ?? 900);
  const vol = Number(o.volumeAutoHideMs ?? grid);
  overlaySettings = {
    enabled: o.enabled !== false && (grid > 0 || vol > 0),
    autoHideMs: grid,
    volumeAutoHideMs: vol
  };

  if (!overlaySettings.enabled) hideOverlayNow();
}

// -------- Overlay: Grid داخل الفيديو --------
function injectOverlayCSS() {
  if (document.getElementById("vz_overlay_css")) return;
  const style = document.createElement("style");
  style.id = "vz_overlay_css";
  style.textContent = `
    .vzWrap{
      position:fixed;
      pointer-events:none;
      z-index:2147483647;
      direction:ltr;
      contain:layout style;
    }
    .vzGrid{
      position:absolute; inset:0;
      display:grid; grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr);
      direction:ltr;
      container-type:size;            /* لتحجيم الأرقام نسبةً لحجم الشبكة */
    }
    .vzCell{
      border:1px solid var(--vz-cell-border, rgba(255,255,255,.32));
      background:var(--vz-cell-bg, transparent);
      border-radius:var(--vz-cell-radius, 0px);
      display:flex; align-items:center; justify-content:center;
    }
    /* أرقام المربعات: داخل .vzGrid فتظهر وتختفي معها تلقائياً */
    .vzNum{
      pointer-events:none; user-select:none;
      color:var(--vz-num-color, #fff);
      font:700 14px/1 Arial, sans-serif;
      font-size:clamp(9px, 6cqmin, 26px);
      letter-spacing:1px; opacity:.9;
      text-shadow:0 1px 4px rgba(0,0,0,.65);
    }
    .vzHint{
      position:absolute; left:10px; bottom:10px;
      background:rgba(0,0,0,.7); color:#fff;
      padding:6px 10px; border-radius:10px;
      font:12px/1.2 Arial, sans-serif; max-width:70%;
      opacity:.95;
    }
    .vzVolume{
      position:absolute; left:10px; top:10px;
      color:var(--vz-volume-color, #fff);
      font:700 var(--vz-volume-size, 48px)/1 Arial, sans-serif;
      text-shadow:0 2px 10px rgba(0,0,0,.75);
      pointer-events:none;
      opacity:.98;
    }
    .vzHidden{ display:none !important; }
  `;
  document.documentElement.appendChild(style);
}

let vzOverlay = null;            // .vzWrap — contains grid + hint + volume
let vzOverlayVideo = null;
let vzGridEl = null;
let vzHintEl = null;
let vzVolumeBadge = null;
let vzOverlayHost = null;        // parent it's currently attached to (body or fullscreen el)
let vzTrackRafId = null;

function buildOverlayElement() {
  const el = document.createElement("div");
  el.className = "vzWrap";
  el.style.setProperty("--vz-volume-color", soundDisplaySettings.color);
  el.style.setProperty("--vz-volume-size", `${soundDisplaySettings.fontSize}px`);
  applyGridVars(el);
  // ZONE_LABELS ثوابت في الملف لا بيانات مستخدم، فلا خطر من القالب هنا
  const cells = ZONE_LABELS.map((l) => `<div class="vzCell"><div class="vzNum">${l}</div></div>`).join("");
  el.innerHTML = `
    <div class="vzGrid vzHidden">${cells}</div>
    <div class="vzHint vzHidden">Zones</div>
    <div class="vzVolume vzHidden">100</div>
  `;
  return el;
}

function preferredOverlayHost() {
  // Inside fullscreen, the fullscreen element is the only thing the browser paints.
  // Outside, body is fine since we use position:fixed (viewport coords).
  if (document.fullscreenElement) return document.fullscreenElement;
  return document.body || document.documentElement;
}

function positionOverlayToVideo() {
  if (!vzOverlay || !vzOverlayVideo || !vzOverlayVideo.isConnected) return;
  const rect = zoneRectForVideo(vzOverlayVideo);
  if (!rect || rect.width <= 0 || rect.height <= 0) return;
  vzOverlay.style.left = `${rect.left}px`;
  vzOverlay.style.top = `${rect.top}px`;
  vzOverlay.style.width = `${rect.width}px`;
  vzOverlay.style.height = `${rect.height}px`;
}

function anySubElementVisible() {
  return (
    (vzGridEl && !vzGridEl.classList.contains("vzHidden")) ||
    (vzHintEl && !vzHintEl.classList.contains("vzHidden")) ||
    (vzVolumeBadge && !vzVolumeBadge.classList.contains("vzHidden"))
  );
}

function startOverlayTracking() {
  if (vzTrackRafId != null) return;
  const tick = () => {
    if (!anySubElementVisible()) {
      vzTrackRafId = null;
      return;
    }
    positionOverlayToVideo();
    vzTrackRafId = requestAnimationFrame(tick);
  };
  vzTrackRafId = requestAnimationFrame(tick);
}

function attachOverlayToHost(host) {
  if (!vzOverlay || !host) return;
  if (host.contains(vzOverlay)) {
    vzOverlayHost = host;
    return;
  }
  host.appendChild(vzOverlay);
  vzOverlayHost = host;
}

function teardownOverlay() {
  if (vzOverlay) vzOverlay.remove();
  vzOverlay = null;
  vzGridEl = null;
  vzHintEl = null;
  vzVolumeBadge = null;
  vzOverlayVideo = null;
  vzOverlayHost = null;
  if (vzTrackRafId != null) {
    cancelAnimationFrame(vzTrackRafId);
    vzTrackRafId = null;
  }
}

function ensureVideoOverlay(video) {
  if (!video) return;
  injectOverlayCSS();

  if (vzOverlayVideo === video && vzOverlay && video.isConnected) {
    // Make sure it's still attached to the right host (fullscreen toggles, etc.)
    const host = preferredOverlayHost();
    if (host !== vzOverlayHost) attachOverlayToHost(host);
    positionOverlayToVideo();
    return;
  }

  teardownOverlay();
  vzOverlay = buildOverlayElement();
  vzGridEl = vzOverlay.querySelector(".vzGrid");
  vzHintEl = vzOverlay.querySelector(".vzHint");
  vzVolumeBadge = vzOverlay.querySelector(".vzVolume");
  vzOverlayVideo = video;
  attachOverlayToHost(preferredOverlayHost());
  positionOverlayToVideo();
}

document.addEventListener("fullscreenchange", () => {
  if (!vzOverlay || !vzOverlayVideo) return;
  attachOverlayToHost(preferredOverlayHost());
  positionOverlayToVideo();
});

function showOverlay(text) {
  const ms = Math.max(0, Number(overlaySettings.autoHideMs ?? 0));
  if (ms <= 0) return; // Grid overlay disabled
  if (!vzGridEl || !vzHintEl) return;

  vzHintEl.textContent = text || "Zones";
  vzGridEl.classList.remove("vzHidden");
  vzHintEl.classList.remove("vzHidden");
  positionOverlayToVideo();
  startOverlayTracking();

  clearTimeout(showOverlay._t);
  showOverlay._t = setTimeout(() => {
    vzGridEl?.classList.add("vzHidden");
    vzHintEl?.classList.add("vzHidden");
  }, ms);
}
function hideOverlayNow() {
  vzGridEl?.classList.add("vzHidden");
  vzHintEl?.classList.add("vzHidden");
  vzVolumeBadge?.classList.add("vzHidden");
}

function showVolumeIndicator(video) {
  if (!video) return;
  const ms = Math.max(0, Number(overlaySettings.volumeAutoHideMs ?? 0));
  if (ms <= 0) return; // Volume indicator disabled

  ensureVideoOverlay(video);
  if (!vzVolumeBadge || vzOverlayVideo !== video) return;

  const percent = video.muted ? 0 : Math.round((video.volume ?? 1) * 100);
  vzVolumeBadge.textContent = String(percent);
  vzOverlay?.style.setProperty("--vz-volume-color", soundDisplaySettings.color);
  vzOverlay?.style.setProperty("--vz-volume-size", `${soundDisplaySettings.fontSize}px`);
  vzVolumeBadge.classList.remove("vzHidden");
  positionOverlayToVideo();
  startOverlayTracking();

  clearTimeout(showVolumeIndicator._t);
  showVolumeIndicator._t = setTimeout(() => {
    vzVolumeBadge?.classList.add("vzHidden");
  }, ms);
}
// -------------------------------------------


// ⚠️ PAIRED COPY — the block between the BEGIN/END markers below is duplicated
// verbatim in storage.js. A content script cannot load storage.js without
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

async function loadRulesForThisHost() {
  const data = await chrome.storage.sync.get({
    globalSiteRules: { enabled: false, mappings: [] }
  });
  siteRules = data.globalSiteRules || { enabled: false, mappings: [] };
  buildMap();
}


chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GVZ_STATUS") {
    sendResponse({
      ok: true,
      blocked: isBlockedHost(),
      globalEnabled: !!siteRules.enabled,
      siteProfileEnabled: !!siteProfile.enabled,
      hasVideoUnderPointer: !!getVideoFromPointerPosition(),
      host: baseDomain(location.host)
    });
    return true;
  }
  if (msg?.type === "SITE_RULES_UPDATED") {
    siteRules = msg.siteRules || { enabled: false, mappings: [] };
    buildMap();
    if (!remappingEnabled()) hideOverlayNow();
  }
  if (msg?.type === "RELOAD_SITE_RULES") {
    loadRulesForThisHost();
  }
  if (msg?.type === "RELOAD_SITE_PROFILE") {
    loadSiteProfile().then(() => {
      if (!remappingEnabled()) hideOverlayNow();
    });
  }
  // from Options page
  if (msg?.type === "GVZ_RELOAD" || msg?.type === "RELOAD_ZONE_SETTINGS") {
    loadZoneSettings();
    loadBlockedHosts();
    loadSoundDisplaySettings();
    loadGridAppearance();
  }
  if (msg?.type === "RELOAD_OVERLAY_SETTINGS") loadOverlaySettings();
  if (msg?.type === "RELOAD_SUBTITLES") loadSubtitleSettings();
  if (msg?.type === "RELOAD_YT_QUALITY") {
    loadYtAutoQualitySettings().then(() => triggerYtQuality());
  }
  if (msg?.type === "RELOAD_YT_SHORTS") {
    loadYtShortsRedirectSetting().then(() => maybeRedirectShorts());
  }
  if (msg?.type === "RELOAD_CLEAN_PLAYER") {
    loadCleanPlayerSettings();
  }
  if (msg?.type === "SET_VOLUME_BOOST") {
    // Floor is 100: the booster only amplifies. Attenuation is ACTION:VOLUME's job.
    const pct = Math.max(100, Math.min(600, Number(msg.pct) || 100));
    // async: the popup needs the reason so it can explain a silent no-op
    applyBoostToAllVideos(pct).then(
      (res) => sendResponse(res),
      () => sendResponse({ ok: false, reason: "failed" })
    );
    return true;
  }
  if (msg?.type === "GET_VOLUME_BOOST") {
    // Silence is sticky and outranks any earlier reason — it means audio is gone.
    sendResponse({ pct: boostPct, reason: boostSilent ? "silent" : lastBoostFailure });
    return true;
  }
});

// Every startup step goes through here so failure handling lives in ONE place.
// Unhandled rejections used to spam the console of every open page after the
// extension was reloaded, because each loader's chrome.storage call rejects with
// "Extension context invalidated" (audit #37). That case is expected and stays
// silent; anything else is still reported so real bugs are not buried.
//
// Audit #13 will collapse these ten separate storage reads into a single get().
// Keeping each step as a `startup(label, fn)` call means that change rewrites the
// bodies only — it never has to touch error handling again.
function startup(label, run) {
  return Promise.resolve().then(run).catch((err) => {
    const msg = String(err?.message || err);
    if (/context invalidated|Extension context|message port closed/i.test(msg)) return;
    console.debug(`[VIDEO-ZONES] تعذّر تنفيذ ${label}:`, err);
  });
}

startup("globalRules", loadRulesForThisHost);
startup("siteProfile", loadSiteProfile);
startup("zones", loadZoneSettings); // ✅ مهم: تشغيل zones بعد refresh مباشرة
startup("overlay", loadOverlaySettings);
startup("blockedHosts", loadBlockedHosts);
startup("soundDisplay", loadSoundDisplaySettings);
startup("gridAppearance", loadGridAppearance);
startup("subtitles", loadSubtitleSettings);
startup("subtitleObserver", startSubtitleTrackObserver);
startup("ytQuality", () => loadYtAutoQualitySettings().then(() => {
  startYtAutoQuality();
  triggerYtQuality();
}));
startup("ytShorts", () => loadYtShortsRedirectSetting().then(() => startYtShortsRedirect()));
startup("cleanPlayer", loadCleanPlayerSettings);
startup("boostReapply", startBoostReapply);

// ⚠️ PAIRED COPY — duplicated verbatim in storage.js. Edit both together;
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

function normalizeMouseEvent(e) {
  const mapBtns = ["Mouse1", "Mouse2", "Mouse3", "Mouse4", "Mouse5"];
  return mapBtns[e.button] || `Mouse${e.button + 1}`;
}
function getVideoUnderPointerStrict(e) {
  if (typeof e.clientX !== "number" || typeof e.clientY !== "number") return null;
  const v = findVideoAtPoint(e.clientX, e.clientY);
  return v || null;
}

function shouldLetNativeLinkHandlingRun(e, video) {
  const target = e.target;
  if (!target?.closest) return false;

  const linkLike = target.closest("a[href], [role='link']");
  if (!linkLike) return false;

  if (!video) return true;

  if (linkLike === video) return false;
  if (video.contains?.(linkLike)) return false;

  return true;
}

function togglePlay(video) {
  if (!video) return;
  if (video.paused) video.play().catch(()=>{});
  else video.pause();
}

function seek(video, deltaSec) {
  if (!video) return;
  // بعض الستريمات live ما تدعم seek
  if (isNaN(video.duration) || !isFinite(video.duration)) return;
  video.currentTime = Math.max(0, Math.min(video.currentTime + deltaSec, video.duration));
}

function runAction(action, e) {
  // Play/Pause: فقط فيديو نفسه
  if (action === "ACTION:TOGGLE_PLAY") {
    const video = e.__videoUnderPointer || findVideoLoose(e);
    if (!video) return false;
    togglePlay(video);
    return true;
  }

  // Seek: نقدر نستخدم loose لأن الأسهم غالبًا بدون target فيديو
  if (action.startsWith("ACTION:SEEK:")) {
    const n = Number(action.split(":")[2]);
    if (isNaN(n)) return false;
    const video = findVideoLoose(e);
    if (!video) return false;
    seek(video, n);
    return true;
  }

  // Fullscreen: loose (عشان Twitch overlays/iframes)
if (action === "ACTION:TOGGLE_FULLSCREEN") {
  // ✅ لو Mouse2 جهّز لنا فيديو تحت المؤشر، استخدمه
  const video = e.__videoUnderPointer || findVideoLoose(e);
  if (!video) return false;

  const t = nowMs();
  if (t - lastFsAt < 450) return true;
  lastFsAt = t;

  return toggleFullscreen(video);
}


  // Mute
  if (action === "ACTION:TOGGLE_MUTE") {
    const video = findVideoLoose(e);
    if (!video) return false;
    video.muted = !video.muted;
    showVolumeIndicator(video);
    return true;
  }

  // PiP
  if (action === "ACTION:TOGGLE_PIP") {
    const video = findVideoLoose(e);
    if (!video) return false;
    const doc = document;
    if (doc.pictureInPictureElement) {
      const exit = doc.exitPictureInPicture?.();
      if (!exit) return false;
      Promise.resolve(exit).catch((err) =>
        notifyVideoActionFailed(video, "تعذّر الخروج من صورة داخل صورة", err));
      return true;
    }
    // Sites opt out with disablePictureInPicture; requesting anyway always rejects.
    if (typeof video.requestPictureInPicture !== "function" || video.disablePictureInPicture) {
      notifyVideoActionFailed(video, "هذا الفيديو لا يدعم صورة داخل صورة");
      return false;
    }
    Promise.resolve(video.requestPictureInPicture()).catch((err) =>
      notifyVideoActionFailed(video, "المتصفح رفض صورة داخل صورة", err));
    return true;
  }

  // Volume delta in percent
  if (action.startsWith("ACTION:VOLUME:")) {
    const n = Number(action.split(":")[2]);
    if (isNaN(n)) return false;
    const video = findVideoLoose(e);
    if (!video) return false;
    const delta = n / 100;
    // When raising volume, force unmute first — some sites auto-mute at 0.
    if (delta > 0 && (video.muted || (video.volume ?? 1) === 0)) {
      video.muted = false;
      if ((video.volume ?? 0) === 0) video.volume = Math.min(1, delta);
    } else {
      // When lowering, clamp to a tiny non-zero floor to prevent host-site auto-mute.
      const next = (video.volume ?? 1) + delta;
      video.volume = next <= 0 ? 0.0001 : Math.min(1, next);
    }
    showVolumeIndicator(video);
    return true;
  }

  // Speed: SET absolute value (e.g. ACTION:SPEED:SET:2)
  if (action.startsWith("ACTION:SPEED:SET:")) {
    const n = Number(action.split(":")[3]);
    if (isNaN(n)) return false;
    const video = findVideoLoose(e);
    if (!video) return false;
    video.playbackRate = Math.max(0.25, Math.min(4, Math.round(n * 100) / 100));
    return true;
  }

  // Speed: delta
  if (action.startsWith("ACTION:SPEED:")) {
    const n = Number(action.split(":")[2]);
    if (isNaN(n)) return false;
    const video = findVideoLoose(e);
    if (!video) return false;
    const r = (video.playbackRate || 1) + n;
    video.playbackRate = Math.max(0.25, Math.min(4, Math.round(r * 100) / 100));
    return true;
  }

  return false;
}

function pickFullscreenContainer(video) {
  if (!video) return null;

  // Prefer known site player wrappers — using the same element the site itself uses
  // keeps the site's fullscreen state in sync and lets F/dblclick/the native button
  // continue to work after we toggle fullscreen.
  const knownPlayer = video.closest(KNOWN_PLAYER_WRAPPER_SELECTOR);
  if (knownPlayer && knownPlayer.requestFullscreen) return knownPlayer;

  const videoRect = video.getBoundingClientRect();
  const videoArea = Math.max(1, videoRect.width * videoRect.height);

  // جرّب نلقى أقرب حاوية “تشبه مشغل” (عادة تحتوي أزرار/controls overlay)
  const candidates = [];
  let cur = video;
  for (let i = 0; i < 8 && cur; i++) {
    candidates.push(cur);
    cur = cur.parentElement;
  }

  // فلترة: نفضّل عنصر:
  // - يحتوي الفيديو
  // - وفيه buttons/controls أو class/role تشير للمشغل
  const scored = candidates
    .map(el => {
      const cls = (el.className || "").toString();
      const role = (el.getAttribute?.("role") || "");
      const hasButtons = !!el.querySelector?.("button, [role='button'], input[type='range']");
      const looksPlayer = /player|video|controls|overlay|container/i.test(cls + " " + role);
      const rect = el.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;

      const areaRatio = (rect.width * rect.height) / videoArea;
      const containsVideoCenter =
        rect.left <= videoRect.left + (videoRect.width / 2) &&
        rect.right >= videoRect.left + (videoRect.width / 2) &&
        rect.top <= videoRect.top + (videoRect.height / 2) &&
        rect.bottom >= videoRect.top + (videoRect.height / 2);

      if (!containsVideoCenter) return null;
      if (areaRatio > 3.5) return null; // يمنع body / page wrappers

      const score =
        (hasButtons ? 3 : 0) +
        (looksPlayer ? 2 : 0) +
        (el === video ? 0 : 1) +
        Math.max(0, 2 - Math.abs(areaRatio - 1.15));
      return { el, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  // أفضل خيار: أعلى سكور، وإلا استخدم parent للفيديو
  return scored[0]?.el || video.parentElement || video;
}

// Selectors for sites that expose their own fullscreen button.
// Clicking the native button keeps the site's internal fullscreen state in sync,
// so the site's own keyboard shortcuts (F, dblclick, the on-screen button) keep working.
const NATIVE_FS_BUTTON_SELECTORS = [
  ".ytp-fullscreen-button",                    // YouTube
  "button[data-a-target='player-fullscreen-button']", // Twitch
  ".vjs-fullscreen-control",                   // Video.js
  ".jw-icon-fullscreen",                       // JW Player
  ".plyr__control[data-plyr='fullscreen']"     // Plyr
];

function findNativeFullscreenButton(video) {
  if (!video) return null;
  // Search inside the player wrapper first, then fall back to a document-wide search.
  const player = video.closest(KNOWN_PLAYER_WRAPPER_SELECTOR);
  const scope = player || document;
  for (const sel of NATIVE_FS_BUTTON_SELECTORS) {
    const btn = scope.querySelector(sel);
    if (btn) return btn;
  }
  return null;
}

// requestFullscreen / requestPictureInPicture return promises. A synchronous
// try/catch cannot see their rejection, so a refusal surfaced only as
// "Uncaught (in promise)" while runAction still returned true and preventDefault
// swallowed the click — the user saw nothing happen and got no explanation
// (audit #9, #33).
//
// preventDefault has to be decided synchronously, so the contract is:
//   return false → we know the request is impossible, do NOT swallow the event
//   return true  → a request was dispatched; if it later rejects we say so
function notifyVideoActionFailed(video, text, err) {
  if (err) console.debug(`[VIDEO-ZONES] ${text}:`, err);
  if (video) ensureVideoOverlay(video);
  showOverlay(`⚠️ ${text}`); // respects the user's overlay duration setting
}

function toggleFullscreen(video) {
  const doc = document;
  const v = video;
  if (!v) return false;

  // Prefer clicking the site's own fullscreen button when available — this keeps
  // the site's player state in sync, so its F key / dblclick / native button still work.
  const nativeBtn = findNativeFullscreenButton(v);
  if (nativeBtn) {
    try { nativeBtn.click(); return true; } catch {}
  }

  // خروج
  if (doc.fullscreenElement) {
    const exit = doc.exitFullscreen?.();
    if (!exit) return false;
    Promise.resolve(exit).catch((err) =>
      notifyVideoActionFailed(v, "تعذّر الخروج من ملء الشاشة", err));
    return true;
  }

  const container = pickFullscreenContainer(v);
  const req = container?.requestFullscreen || container?.webkitRequestFullscreen;
  if (!req) return false; // no API at all: leave the event to the page
  try {
    Promise.resolve(req.call(container)).catch((err) =>
      notifyVideoActionFailed(v, "المتصفح رفض ملء الشاشة", err));
  } catch (err) {
    // threw synchronously ⇒ nothing was dispatched
    notifyVideoActionFailed(v, "المتصفح رفض ملء الشاشة", err);
    return false;
  }
  return true;
}




function findVideoLoose(e) {
  if (e.target?.tagName === "VIDEO") return e.target;

  // لو الهدف overlay فوق الفيديو
  const v1 = e.target?.closest?.("video");
  if (v1) return v1;

  // الأهم: خذ العنصر تحت المؤشر (غالباً الفيديو يكون تحته)
  if (typeof e.clientX === "number" && typeof e.clientY === "number") {
    const v2 = findVideoAtPoint(e.clientX, e.clientY);
    if (v2) return v2;
  }

  return getVideoFromPointerPosition();
}




function shouldIgnoreKeyBecauseTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.settings) {
    loadZoneSettings();
    loadOverlaySettings();
    loadBlockedHosts();
    loadSoundDisplaySettings();
    loadGridAppearance();
    loadSubtitleSettings();
    loadYtAutoQualitySettings().then(() => triggerYtQuality());
    loadYtShortsRedirectSetting().then(() => maybeRedirectShorts());
    loadCleanPlayerSettings();
  }
  if (changes.globalSiteRules) loadRulesForThisHost();
  // Our own shard, or the legacy blob while it still exists
  if (changes.siteProfiles || changes[spKeyFor(baseDomain(location.host))]) loadSiteProfile();
});
/*chrome.tabs.query({active:true,currentWindow:true}, ([t])=>{
  chrome.tabs.sendMessage(t.id, {type:"RELOAD_OVERLAY_SETTINGS"});
});
*/









// ✅ ArrowRight/Left: نمنع الافتراضي ونطبق 5 ثواني
window.addEventListener("keydown", (e) => {
  updatePointerFromEvent(e);
  if (isBlockedHost()) return;
  if (!remappingEnabled()) return;
  if (shouldIgnoreKeyBecauseTyping()) return;
  const hoveredVideo = getVideoFromPointerPosition();
  if (!hoveredVideo) return;

  const sig = normalizeKeyCombo(e);
  if (!sig) return;

  // 1. Per-site profile beats global; both are checked via lookupRemap.
  const to = lookupRemap(sig);
  if (to) {
    const ok = to.startsWith("ACTION:") ? runAction(to, e) : false;
    if (ok) {
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  }

  // 2. Fall through to zone-based keyboard binding
  if (!zonesActive()) return;
  if (typeof lastPointer.x !== "number" || typeof lastPointer.y !== "number") return;
  const rect = zoneRectForVideo(hoveredVideo);
  const zone = getZoneNumber(rect, lastPointer.x, lastPointer.y);
  if (!zone) return;

  const zoneKeyMap = zoneSettings?.key?.map?.[String(zone)];
  const actions = normalizeMappedActions(zoneKeyMap?.[sig]);
  if (!actions.length) return;

  ensureVideoOverlay(hoveredVideo);
  e.__videoUnderPointer = hoveredVideo;
  showOverlay(`Zone ${zoneLabel(zone)} • ${sig} → ${actions.join(" + ")}`);

  let ok = false;
  for (const action of actions) ok = runAction(action, e) || ok;
  delete e.__videoUnderPointer;
  if (ok) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

function handleMouse(e) {
  updatePointerFromEvent(e);
  if (isBlockedHost()) return;
  if (!remappingEnabled()) return;

  const sig = normalizeMouseEvent(e); // Mouse1..Mouse5
  const to = lookupRemap(sig);
  if (!to) return;

  // Mouse1 (Play/Pause): فقط click + فقط على VIDEO نفسه (من runAction)
  if (sig === "Mouse1") {
    if (e.type !== "click") return;
  }

  // Mouse2 (Fullscreen): auxclick أو mousedown (حسب الجهاز) + Debounce + فيديو تحت المؤشر
  if (sig === "Mouse2") {
    if (!(e.type === "auxclick" || e.type === "mousedown")) return;

    const t = nowMs();
    if (t - lastMouse2At < 350) return; // يمنع double-trigger
    lastMouse2At = t;

    const v = getVideoUnderPointerStrict(e);
    if (!v) return; // خارج الفيديو = لا تسوي شي
    if (shouldLetNativeLinkHandlingRun(e, v)) return;
    e.__videoUnderPointer = v;
  }

  // Mouse3 = الزر الأيمن: نفّذ الاختصار وامنع قائمة الزر الأيمن
  if (sig === "Mouse3") {
    if (!(e.type === "mousedown" || e.type === "contextmenu")) return;

    const v = getVideoUnderPointerStrict(e);
    if (!v) return;
    if (shouldLetNativeLinkHandlingRun(e, v)) return;
    e.__videoUnderPointer = v;

    if (e.type === "contextmenu") {
      if (nowMs() < suppressContextMenuUntil) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
      delete e.__videoUnderPointer;
      return;
    }
  }

  // باقي الأزرار: خله mousedown فقط
  if (sig !== "Mouse1" && sig !== "Mouse2" && sig !== "Mouse3") {
    if (e.type !== "mousedown") return;
  }



  const ok = to.startsWith("ACTION:") ? runAction(to, e) : false;
  if (ok && sig === "Mouse3") {
    suppressContextMenuUntil = nowMs() + 800;
  }
  delete e.__videoUnderPointer;
  if (!ok) return;

  e.preventDefault();
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();
}

window.addEventListener("click", handleMouse, true);
window.addEventListener("auxclick", handleMouse, true);
window.addEventListener("mousedown", handleMouse, true);
window.addEventListener("contextmenu", handleMouse, true);
}
