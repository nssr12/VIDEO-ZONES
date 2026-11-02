if (!window.__GVZ_CONTENT_LOADED__) {
window.__GVZ_CONTENT_LOADED__ = true;
let siteRules = { enabled: false, mappings: [] };
let map = new Map();
let siteProfile = { enabled: false, mappings: [] };
let siteMap = new Map();
let blockedHosts = [];
// #147 — مواقعُ يغلب فيها أمرُ المستخدم روابطَ الصفحة. **فارغةٌ = سلوكُ ما قبل #145 حرفاً.**
let linkedVideoHosts = [];
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
// ── البند #64 — المفتاح الرئيسي ──────────────────────────────────────────
// **افتراضه مُشغَّل بنمط `!== false` لا `=== true`**: ملفّ لم يُفتح إعداده قط
// يسلك **سلوك اليوم حرفياً**، فالشكل (ب) **صفر تغيّر سلوكي افتراضياً** — الجديد
// الوحيد هو **وجود** المفتاح.
let masterEnabled = true;
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
  if (!extensionActive()) return;
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
  if (!extensionActive()) {
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
// #145 — الضغطةُ الوسطى استهلكها أمرُنا، فيُلغى تنقّلُ الرابط في `auxclick`.
let mouse2ConsumedPress = false;
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

async function loadSiteProfile(pre) {
  const host = baseDomain(location.host);
  const key = spKeyFor(host);
  const data = pre || await chrome.storage.sync.get([key, "siteProfiles"]);
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
// Audit #13: content.js runs at document_start in EVERY frame, and eleven separate
// storage reads per frame meant a page with 30 ad iframes paid 330 of them. Startup
// now does ONE read and hands the result to every loader. Each loader still reads on
// its own when something else calls it — a RELOAD_* message or storage.onChanged —
// so passing nothing keeps the old behaviour exactly.
function settingsRead(pre) {
  return pre || chrome.storage.sync.get({ settings: {} });
}

async function ensureZonesDefaults(pre) {
  const data = await settingsRead(pre);
  const zones = (data.settings || {}).zones;
  if (!zones) return structuredClone(FIRST_RUN_ZONES);
  return zones;
}

// ── #147 — قائمةُ «الفيديو داخل رابطٍ، والفيديو هو المقصود» ──────────────────
// **العطبُ الذي وُلدت منه (بلاغ المالك 2026-09-06): #145 يعمل على إنستقرام
// و«كسر اليوتيوب والمواقع الأخرى».** ⇒ **مصغّراتُ يوتيوب `a#thumbnail` تلفّ
// معاينةَ التحويم وهي `<video>`** ⇒ **فهي «رابطٌ يلفّ فيديو» بحرف شرطنا** —
// **والفرقُ عن إنستقرام دلاليٌّ لا هندسيّ: هناك الفيديو هو المقصود، وهنا
// المقصودُ الرابط.**
// ⛔⭐⭐ **والمُميِّزُ البنيويّ جُرّب فسقط بالقياس لا بالرأي**: قاعدةُ #94 تمتنع
// عن معاينة يوتيوب (نطاقٌ لا يُظهر أدواته) — **وقِيس عند المالك أن زرَّ السرعة
// لا يظهر على فيديو خلاصة إنستقرام أيضاً** ⇒ **الموقعان في جانبٍ واحدٍ منها،
// فلا تفصلهما.**
// ⇒ ⭐ **فالإعلانُ بدل الاستدلال، كما في #143 بحرفه**: قائمةٌ فارغةٌ افتراضاً
// ⇒ **كلُّ موقعٍ غيرِ مُضافٍ يعود إلى سلوك ما قبل #145 بالبناء لا بالرجاء.**
function hostAllowsLinkedVideo() {
  return linkedVideoHosts.includes(baseDomain(location.host));
}

async function loadLinkedVideoHosts(pre) {
  const data = await settingsRead(pre);
  const settings = data.settings || {};
  linkedVideoHosts = Array.isArray(settings.linkedVideoHosts) ? settings.linkedVideoHosts : [];
}

async function loadBlockedHosts(pre) {
  const data = await settingsRead(pre);
  const settings = data.settings || {};
  blockedHosts = Array.isArray(settings.blockedHosts) ? settings.blockedHosts : [];
  // Blocking a site must also drop the track observer, and unblocking must bring it
  // back — the two loaders resolve independently, so each converges the state (#21).
  syncSubtitleTrackObserver();
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "0,0,0";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

async function loadSubtitleSettings(pre) {
  const data = await settingsRead(pre);
  const s = data.settings || {};
  const sub = s.subtitles || {};
  subtitleSettings = {
    enabled: !!sub.enabled,
    hideOnPreviews: sub.hideOnPreviews !== false, // مفعَّل افتراضياً (#51)
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
  // Turning the automation on or off flips the two button exemptions, so the
  // Clean Player CSS has to be rebuilt here — no page reload (audit #18).
  applyCleanPlayerCSS();
  // ...and creates or disconnects the track observer, likewise with no reload (#21)
  syncSubtitleTrackObserver();
}

// Caption size used to be absolute px, so the same number that reads well on a
// 1280px watch player buried a 300px player in text. YouTube's homepage hover
// preview uses the SAME #movie_player / .html5-video-player element as the watch
// page — verified in Chrome, no class or id tells them apart — so SIZE is the only
// reliable discriminator, and that means measuring the player.
//
// Same technique as the zone numbers: container query units with clamp. The user's
// setting stays one number and is reinterpreted as "the size at a reference-width
// player", so nothing in the UI changes and no stored value migrates.
// YouTube's homepage/search hover preview. Verified live in Chrome: the element is
// div#inline-preview-player and it ALSO carries .html5-video-player, so the known
// wrapper list already covers it — named here explicitly so a future YouTube change
// that drops the class cannot silently take the query container away with it.
const YT_PREVIEW_PLAYER_SELECTOR = "#inline-preview-player";
const CAPTION_REFERENCE_PLAYER_W = 1280;
// YouTube's OWN caption padding, measured live on a watch page with no extension
// present, at five player sizes: padding is `0 .25em` on .ytp-caption-segment and
// the ratio to font-size is 0.25 horizontally and 0 vertically at every size — it
// is em in YouTube's stylesheet, so constant by construction. We adopt those exact
// numbers rather than inventing our own: YouTube's box is the reference that looks
// balanced at every size (audit #53).
const CAPTION_PAD_Y = 0;
const CAPTION_PAD_X = 0.25; // typical default YouTube watch player
function relativeCaptionFont(fontSize) {
  const px = Math.max(1, Number(fontSize) || 22);
  const perCqw = (px * 100 / CAPTION_REFERENCE_PLAYER_W).toFixed(3);
  // Floor keeps a tiny preview legible instead of invisible; ceiling stops a
  // 4K fullscreen player from rendering absurd text.
  return `clamp(${Math.max(9, px * 0.45).toFixed(1)}px, ${perCqw}cqw, ${(px * 2).toFixed(1)}px)`;
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
  if (!extensionActive()) return;

  // Hiding captions on hover previews is its OWN setting: someone who turned the
  // custom styling off still gets it, so it is built before the styling block and
  // the early return below only skips the styling (audit #51).
  const previewCss = subtitleSettings.hideOnPreviews ? `
    /* Homepage / search hover previews only. #inline-preview-player is the preview
       player itself (verified live in Chrome) and ytd-video-preview is its wrapper;
       neither exists on the watch page, in theater mode or in fullscreen, so this
       cannot reach any of them. Hides YouTube's own caption container, not just our
       styling — the point is not to see captions there at all. */
    html #inline-preview-player .ytp-caption-window-container,
    html #inline-preview-player .caption-window,
    html ytd-video-preview .ytp-caption-window-container,
    html ytd-video-preview .caption-window {
      display:none !important;
    }
  ` : "";

  if (!subtitleSettings.enabled) {
    if (previewCss) injectSubtitleCss(previewCss);
    return;
  }

  const { fontSize, color, bgColor, bgOpacity, fontFamily, position } = subtitleSettings;
  const bgRgba = `rgba(${hexToRgb(bgColor)},${Math.max(0, Math.min(1, bgOpacity))})`;
  const relFont = relativeCaptionFont(fontSize);
  const posCss =
    position === "top" ? "top:8%;bottom:auto;" :
    position === "middle" ? "top:50%;bottom:auto;transform:translateY(-50%);" :
    "bottom:8%;top:auto;";

  const css = `
    /* The query container the sizes above are measured against. inline-size only —
       the weakest containment that still exposes cqw — and scoped to known player
       wrappers so no page-level element is ever contained. */
    html :is(${KNOWN_PLAYER_WRAPPER_SELECTOR}, ${YT_PREVIEW_PLAYER_SELECTOR}) {
      container-type: inline-size !important;
    }

    /* Native HTML5 cues (works on most generic <video><track> setups) */
    html video::cue {
      /* Native cues are rendered by the browser inside the <video> box, out of
         reach of any container we could establish, so this one stays absolute. */
      font-size:${fontSize}px !important;
      color:${color} !important;
      background-color:${bgRgba} !important;
      background:${bgRgba} !important;
      font-family:${fontFamily} !important;
      line-height:1.35 !important;
      padding:${CAPTION_PAD_Y}em ${CAPTION_PAD_X}em !important;
      text-shadow:none !important;
    }

    /* YouTube — high specificity via html prefix + match every descendant of caption containers */
    html .ytp-caption-segment,
    html .captions-text .ytp-caption-segment,
    html .ytp-caption-window-container .ytp-caption-segment,
    html .ytp-caption-window-container span,
    html .caption-visual-line *,
    html .captions-text *,
    html .caption-window {
      font-size:${fontSize}px !important;
      color:${color} !important;
      font-family:${fontFamily} !important;
      text-shadow:none !important;
      fill:${color} !important;
    }

    /* THE BOX — exactly ONE carrier: the caption window as a whole.
       Measured live: YouTube paints its box on .ytp-caption-segment and NOTHING
       else in the chain carries a background. We were painting on THREE nested
       spans at once (.captions-text, .caption-visual-line, .ytp-caption-segment),
       so a 0.6 alpha stacked to 0.936, the horizontal padding tripled to ~24px a
       side, and every line became its own box of a different width — a ragged,
       unbalanced block instead of one tidy one (audit #53). The owner's call: one
       box around the whole window, in YouTube's own proportions. */
    html .caption-window {
      background-color:${bgRgba} !important;
      background:${bgRgba} !important;
      background-image:none !important;
      padding:${CAPTION_PAD_Y}em ${CAPTION_PAD_X}em !important;
    }
    /* Nothing inside the window may paint a box — including YouTube's own inline
       background on the segment, which is why transparent is stated explicitly. */
    html .ytp-caption-window-container span,
    html .caption-visual-line *,
    html .captions-text *,
    html .ytp-caption-segment {
      background-color:transparent !important;
      background:transparent !important;
      background-image:none !important;
      padding:0 !important;
    }
    html .ytp-caption-window-container {
      /* YouTube has TWO colour settings: "background colour" (the text box) and
         "window colour" (the block behind the whole caption window). We only ever
         styled the first, so a user with a window colour set saw OUR box inside
         THEIR window — a wide slab in a colour this extension never chose, which
         survived disabling the extension and read as our bug (audit #52). While
         custom styling is on we own the look, so the window goes fully transparent
         and the background setting below is the only visible background. Nothing is
         persisted: switching custom styling off drops this sheet and YouTube's own
         window colour comes straight back. */
      background-color:transparent !important;
      background:transparent !important;
      background-image:none !important;
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
      font-family:${fontFamily} !important;
      text-shadow:none !important;
    }
    /* one carrier here too — descendants inherit no box, so alpha cannot stack */
    html .player-timedtext-text-container {
      background-color:${bgRgba} !important;
      background:${bgRgba} !important;
      padding:${CAPTION_PAD_Y}em ${CAPTION_PAD_X}em !important;
    }
    html .player-timedtext {
      ${posCss}
      z-index:60 !important;
    }

    /* STRUCTURAL GUARD (audit #50). Everything above is the absolute fallback the
       user already knows. The relative size lives inside @container, and a
       container query CANNOT match when no ancestor query container exists — so a
       future YouTube rename that stops the container from being established makes
       captions fall back to the old fixed size instead of resolving cqw against the
       viewport, which measured 32.7px on a 1900px window: BIGGER than the fallback
       and silently wrong. Measured with the guard: no container -> ${fontSize}px. */
    @container (min-width: 0px) {
      html .ytp-caption-segment,
      html .captions-text .ytp-caption-segment,
      html .ytp-caption-window-container .ytp-caption-segment,
      html .ytp-caption-window-container span,
      html .caption-visual-line *,
      html .captions-text *,
      html .caption-window,
      html .player-timedtext-text-container,
      html .player-timedtext-text-container span,
      html .player-timedtext .player-timedtext-text-container *,
      html .jw-text-track-cue,
      html .jw-text-track-display,
      html .jw-text-track-display * {
        font-size:${relFont} !important;
      }
    }

    /* JW Player / generic */
    html .jw-text-track-cue,
    html .jw-text-track-display,
    html .jw-text-track-display * {
      font-size:${fontSize}px !important;
      color:${color} !important;
      font-family:${fontFamily} !important;
    }
    html .jw-text-track-cue {
      background-color:${bgRgba} !important;
      background:${bgRgba} !important;
      padding:${CAPTION_PAD_Y}em ${CAPTION_PAD_X}em !important;
    }
  `;

  injectSubtitleCss(previewCss + css);
}

function injectSubtitleCss(css) {
  subtitleStyleEl = document.createElement("style");
  subtitleStyleEl.id = "vz_subtitles_css";
  subtitleStyleEl.textContent = css;
  document.documentElement.appendChild(subtitleStyleEl);
}

function applySubtitleTrack() {
  if (!extensionActive()) return;
  const lang = subtitleSettings.defaultLang;
  if (!subtitleSettings.enabled || !lang) return;

  for (const video of document.querySelectorAll("video")) {
    enableMatchingTextTrack(video, lang);
  }

  // البند #27: كان هنا فرع `else` يستدعي `tryEnableYouTubeCC()`، وكان **ميتاً
  // 100% بالبناء**: أول سطر في تلك الدالة `if (!isYouTubeHost()) return;`
  // ومستدعيها الوحيد داخل فرع «ليس يوتيوب» — فلم تُنفَّذ سطراً بعد حارسها أبداً.
  // إعادتها تعني إعادة كود لا يعمل، لا إضافة ميزة. حارسها: tools/test-dead-code.js
  if (isYouTubeHost()) {
    // Drive YouTube's CC + auto-translate menu via simulated clicks
    youtubeSetCaptionLanguage(lang);
  }
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
  if (!extensionActive()) return false;
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
    }
    // البند #28: كان هنا `else if (track.mode === "showing")` **جسمه تعليق فقط** —
    // نيّة غير منفّذة لا سلوك، فالشرط يُحسب ولا يفعل شيئاً. حذفه لا يمسّ أي مسار.
    // والسلوك المقصود («اترك المسارات الأخرى كما هي») هو **ما يحدث بلا فرع أصلاً**.
  }
  return foundMatch;
}

// True exactly when the observer has any work to do. Kept in one place so the
// create path and the disconnect path can never drift apart.
function subtitleTrackWatchWanted() {
  return !!(subtitleSettings.enabled && subtitleSettings.defaultLang) && extensionActive();
}

// Audit #21: the observer used to be created unconditionally with the guard INSIDE
// the callback, so the browser collected and delivered mutations even to someone who
// had turned subtitles off entirely, and it was never disconnected. Now it exists
// only while it is wanted, and loadSubtitleSettings calls this on every change so
// both directions apply with no reload.
//
// SCOPE: body, not documentElement. It cannot be narrowed to a caption container or
// a player wrapper, because what it hunts for is a newly added <video> — which
// appears BEFORE either of those exists. body is the real available win: measured
// over 20s, <head> churn alone accounted for 32 of 227 callbacks on a YouTube watch
// page and 48 of 104 on aljazeera.net.
function syncSubtitleTrackObserver() {
  const wanted = subtitleTrackWatchWanted();
  if (wanted === !!subtitleTrackObserver) return; // already in the right state

  if (!wanted) {
    subtitleTrackObserver.disconnect();
    subtitleTrackObserver = null;
    return;
  }
  subtitleTrackObserver = new MutationObserver((mutations) => {
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
  // body is null only if this runs before the parser reached it; documentElement is
  // the fallback so the watch is never silently skipped.
  subtitleTrackObserver.observe(document.body || document.documentElement,
    { childList: true, subtree: true });
}

// Registered ONCE from startup. The two document listeners below are cheap and
// guard themselves, so they stay put; only the observer comes and goes.
function startSubtitleTrackObserver() {
  syncSubtitleTrackObserver();

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

// ⚠️ PAIRED COPY — duplicated verbatim in storage.js. Edit both TOGETHER.
// ---- BEGIN progressBarMode ----
// #107 — **وضعُ عرضٍ ثالث لا مفتاحٌ ثانٍ.** ثلاثُ حالاتٍ يقرؤها المستخدم في
// قائمةٍ واحدة: `off` يظهر كالمعتاد · `idle` يختفي بالسكون ويعود بأيّ نشاط ·
// `near` مخفيٌّ دائماً ولا يعود إلا بقرب المؤشّر.
// ⛔ **ومفتاحان مستقلّان كانا يُنتجان تركيبةً بلا معنى** (كلاهما مُشغَّل ⇒ أيّهما
// يفوز؟) — **وهو «موضعان لحقيقةٍ واحدة» في ضابطٍ يراه المستخدم** (قرار المالك).
//
// ⭐ **والقراءةُ تحتمل الشكلين ولا تنتظر الهجرة:** `content.js` تعمل عند
// `document_start` **وقد تسبق أيّ مُهاجر**، **وجهازٌ بنسخةٍ قديمة قد يُعيد كتابة
// المفتاح القديم بعد الهجرة**. ⇒ **الجديدُ يفوز حيث وُجد، والقديمُ يُقرأ ولا يُكتب.**
// ⚠️ **ولا يُقرأ المفتاح القديم بـ`!!`**: `!!"off"` تساوي `true` — **وهو سببُ
// أن يكون المفتاح جديداً لا أن يتغيّر نوعُ القديم** (نسخةٌ قديمة كانت ستُشغّل
// الميزةَ على من أطفأها).
const PROGRESS_BAR_MODES = ["off", "idle", "near"];
function progressBarModeOf(overlay) {
  const o = overlay || {};
  if (PROGRESS_BAR_MODES.includes(o.progressBarMode)) return o.progressBarMode;
  return o.hideProgressBar === true ? "idle" : "off";
}
// ---- END progressBarMode ----

// ---- BEGIN barButtons ----
// #118 — **قائمةٌ مرتَّبة تحمل كلَّ الأزرار، ولكلٍّ `on`.**
// ⭐⭐ **والوجودُ في القائمة ليس التشغيل** (قرار المالك 2026-08-07): لو كان
// الوجودُ هو التشغيل **لَمَحا الإطفاءُ الموضعَ** فيعود الزرُّ إلى الذيل حين
// يُشغَّل ⇒ **فقدُ حالةٍ صامت**. **والحقلان معاً يُسقطانه، ويبقى مفتاحٌ مخزَّنٌ واحد.**
//
// ⚠️ **مفتاحٌ جديد لا مُعادُ تصنيف** — وهو درسُ #107 بنصّه: قلبُ نوعِ مفتاحٍ قائم
// **يُشغّل ميزةً لمن أطفأها على جهازٍ آخر**، لأن نسخةً أقدم تقرأ الشكل القديم.
// ⇒ **الجديدُ يفوز حيث وُجد، والقديمان يُقرآن ولا يُكتبان.**
//
// ⚠️ **والقراءةُ تحتمل الشكلين ولا تنتظر الهجرة:** `content.js` تعمل عند
// `document_start` **وقد تسبق أيّ مُهاجر**.
// ⚠️ **وسجلٌّ ناقص يُكمَّل بالترتيب المُعلَن ولا يُسقط زرّاً:** زرٌّ يُشحن غداً
// **يجده مستخدمُ اليوم غائباً من قائمته** — **فيُلحق بالذيل مُطفأً**، ولا يظهر
// بلا طلب. ⇒ **وميزةٌ تُفقَد أهونُ من ميزةٍ تُشغَّل على من لم يطلبها.**
const BAR_BUTTON_IDS = ["speed", "filter", "copy"];
function barButtonsOf(overlay) {
  const o = overlay || {};
  const raw = Array.isArray(o.barButtons) ? o.barButtons : null;
  const seen = new Set();
  const out = [];
  if (raw) {
    for (const it of raw) {
      const id = it && typeof it === "object" ? it.id : null;
      if (!BAR_BUTTON_IDS.includes(id) || seen.has(id)) continue;   // قيمةٌ لا نعرفها لا تُقرأ
      seen.add(id);
      out.push({ id, on: it.on === true });
    }
  }
  for (const id of BAR_BUTTON_IDS) {
    if (seen.has(id)) continue;
    // **بلا سجلٍّ جديد يُقرأ القديمان** — ولا `!!` على قيمةٍ نصّية: كلاهما منطقيّ
    // بالبناء، والشرطُ `=== true` كي لا تُقرأ قيمةٌ غريبة تشغيلاً.
    const legacy = id === "speed" ? o.speedButton === true : o.filterButton === true;
    out.push({ id, on: raw ? false : legacy });
  }
  return out;
}
function barButtonOn(overlay, id) {
  const it = barButtonsOf(overlay).find((x) => x.id === id);
  return !!it && it.on === true;
}
// ---- END barButtons ----

let gridAppearance = resolveGridAppearance(null);

function applyGridVars(el) {
  if (!el) return;
  el.style.setProperty("--vz-cell-bg", rgbaFrom(gridAppearance.cellBg, gridAppearance.cellBgOpacity));
  el.style.setProperty("--vz-cell-border", rgbaFrom(gridAppearance.cellBorder, gridAppearance.cellBorderOpacity));
  el.style.setProperty("--vz-num-color", rgbaFrom(gridAppearance.numberColor, gridAppearance.numberOpacity));
  el.style.setProperty("--vz-cell-radius", `${gridAppearance.radius}px`);
  syncZoneNumbers(el);
}

// Opacity 0 means the numbers are REMOVED, not painted invisibly: an element that
// can never be seen has no business sitting in the overlay of every video, and it
// doubles as the "no numbers" switch without needing a separate setting.
function syncZoneNumbers(root) {
  const grid = root?.querySelector?.(".vzGrid");
  if (!grid) return;
  const wanted = gridAppearance.numberOpacity > 0;
  grid.querySelectorAll(".vzCell").forEach((cell, i) => {
    const existing = cell.querySelector(".vzNum");
    if (wanted && !existing) {
      const num = document.createElement("div");
      num.className = "vzNum";
      num.textContent = ZONE_LABELS[i] || "";
      cell.appendChild(num);
    } else if (!wanted && existing) {
      existing.remove();
    }
  });
}

async function loadGridAppearance(pre) {
  const data = await settingsRead(pre);
  gridAppearance = resolveGridAppearance((data.settings || {}).gridAppearance);
  applyGridVars(vzOverlay);
}

async function loadSoundDisplaySettings(pre) {
  const data = await settingsRead(pre);
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
  // ⛔⭐ **#75 — والكتابةُ على `.vzWrap` وحدَها تكفي: الشاراتُ ترث منها.**
  // **وحُذف هنا تعدادٌ بيدٍ لشارتين** (`[vzVolumeBadge, vzSpeedBadge]`) كان يكتبهما
  // على العنصرين فوق ذلك — **ووُلدت شارةٌ ثالثة (#134) فلم يتخلّف شيءٌ عنها إلا
  // لأن التوريث غطّاها**: أثرُه **زائدٌ لا ناقص**. ⇒ ⭐ **فالعلاجُ حذفُه لا إضافةُ
  // الثالثة إليه — وإضافتُها هي الفخُّ نفسُه سطراً أطول** (وهو ما أزاله #71 حين
  // جعل القنوات سجلّاً واحداً). **وحدٌّ مكتوبٌ خيرٌ من حلقةٍ تتخلّف صامتة.**
  // ⚠️ **والحدُّ: الشاراتُ ترث `--vz-volume-*` من `.vzWrap` ⇒ فمن أخرج شارةً منها
  // كسر التوريث**، وعليه حينئذٍ أن يكتبهما على عنصره بنفسه. (وأزرارُنا لا تقرؤهما
  // أصلاً، ولذلك لم يضرّ خروجُ `vzSpeedBtn` إلى شريط المضيف.)
  // ✅ **والاحتواءُ قِيس قبل الحذف لا بعده** (شرط المالك 2026-08-08): الثلاثُ
  // مُسنَدةٌ من `vzOverlay.querySelector` **وهي لا تُطابق إلا الأحفاد**، وشاهدُه
  // السالب `vzFilterPanel` — **داخلٌ فعلاً بـ`appendChild` فلم يُثبته السند**.
  // ⚠️ **والمقيسُ الاحتواءُ وحدَه؛ والتوريثُ ضمانةُ مواصفةِ CSS لا قياسَنا.**
}

// ── البند #64 — مُحمِّل المفتاح الرئيسي ─────────────────────────────────────
// `!== false` عمداً: غياب المفتاح = مُشغَّل، فلا هجرة بيانات ولا تغيّر لمن لم
// يفتح الإعدادات قط.
async function loadMasterEnabled(pre) {
  const data = await settingsRead(pre);
  masterEnabled = (data.settings || {}).enabled !== false;
}

async function loadYtAutoQualitySettings(pre) {
  const data = await settingsRead(pre);
  ytAutoQuality = (data.settings || {}).ytAutoQuality || "";
}

// yt_quality_main.js runs in the page's main world (declared in manifest.json).
// We communicate with it via CustomEvent — content scripts cannot call YouTube's player API directly.
// De-duplication key, same idea as ytCaptionAttemptKey: one attempt per video per
// requested quality. Without it every loadedmetadata — and a watch page fires several,
// one per ad and one per content video — re-triggered the whole poll (audit #19).
let ytQualityAttemptKey = null;
let lastYtQualityResult = null;

// Reported to the popup ONLY when there is a real gap between what was asked for
// and what the video could give. Success stays silent on purpose: a line that shows
// every time is a line the user learns to ignore — the lesson from the permanent blue
// notice in S1. Returns null on auto quality, during an ad, and off YouTube, because
// none of those is a failure to tell anyone about.
function ytQualityGap() {
  if (!isYouTubeHost() || !ytAutoQuality) return null;
  const r = lastYtQualityResult;
  if (!r || typeof r.result !== "string" || !r.result.startsWith("fallback:")) return null;
  return { requested: r.requested, applied: r.result.slice("fallback:".length) };
}

function triggerYtQuality() {
  if (!extensionActive()) return;   // #64: كانت بلا أي بوّابة
  if (!isYouTubeHost() || !ytAutoQuality) return;
  const key = `${location.pathname}${location.search}|${ytAutoQuality}`;
  if (key === ytQualityAttemptKey) return; // same video, same quality: already tried
  ytQualityAttemptKey = key;
  window.dispatchEvent(new CustomEvent("__vz_setq__", { detail: { q: ytAutoQuality } }));
}

// ⚠️ **البند #38ج — التسجيل مرّة واحدة مهما نودي.** صار لهذه الدالّة طريقان:
// البدء، **والإيقاظ** عند الضغط على «تفعيل يدوي». وبلا هذا الحارس تُضاعَف
// مستمعاتها الأربعة مع كل ضغطة. **يُختبَر بالعدّ لا بالنيّة**
// (`tools/test-yt-wake.js`).
let ytQualityWired = false;

function startYtAutoQuality() {
  if (!extensionActive()) return;   // #64
  if (!isYouTubeHost()) return;
  if (ytQualityWired) return;
  ytQualityWired = true;
  // Leaving the video cancels a poll still running for it. Without this the old
  // poll survives the navigation and sets the previous video's quality on the new
  // one — the MAIN world listens for yt-navigate-start too, this is the belt.
  document.addEventListener("yt-navigate-start", () => {
    ytQualityAttemptKey = null;
    window.dispatchEvent(new CustomEvent("__vz_cancelq__"));
  }, true);
  document.addEventListener("yt-navigate-finish", () => {
    ytQualityAttemptKey = null;
    setTimeout(() => triggerYtQuality(), 800);
  }, true);
  document.addEventListener("loadedmetadata", (e) => {
    if (e.target?.tagName !== "VIDEO") return;
    triggerYtQuality();
  }, true);
  // The MAIN world reports what actually happened. Today this only records it —
  // a requested quality that the video does not offer still fails silently to the
  // user, and surfacing that is a separate decision, not part of this item.
  window.addEventListener("__vz_setq_done__", (e) => {
    lastYtQualityResult = e.detail || null;
    const r = lastYtQualityResult?.result;
    if (r && r !== "set" && r !== "cancelled" && r !== "ad") {
      console.debug(`[VIDEO-ZONES] جودة يوتيوب «${lastYtQualityResult.requested}»: ${r}`);
    }
  });
}

// ── البند #38ج — **تعريف واحد يستهلكه الطريقان** ────────────────────────────
// **لماذا دالّة بدل تكرار السطرين:** للجودة الآن طريقان — **البدء** و**الإيقاظ**
// عند «تفعيل يدوي» على صفحة `content.js` حاضر فيها سلفاً (فحقنه لا عمل له بحارس
// `__GVZ_CONTENT_LOADED__`، **فلا بدء جديد ولا نداء** — مقيس في `AUDIT.md` §26).
// **ولا يُكتب تسلسل تشغيل ثانٍ في الإيقاظ**: نسختان تتباعدان مع الوقت، وهو درس
// عقد الصوت في #60 حرفياً — **عقد محفوظ في نسخة واحدة ليس عقداً** — وقد كلّفنا
// مرة. فالطريقان يستهلكان **هذه الدالّة وحدها**.
//
// **وهي idempotent بالبناء لا بالحراسة الخارجية:** `startYtAutoQuality` تُسجّل
// مستمعاتها مرّة (`ytQualityWired`)، و`triggerYtQuality` محروسة بمفتاح المحاولة
// (`ytQualityAttemptKey`) — فضغطتان متتاليتان **لا تزيدان مستمعاً ولا طلباً**.
//
// **و`pre` اختياري بنفس عقد بقيّة المُحمِّلات:** البدء يمرّر قراءته الواحدة
// (#13)، والإيقاظ يستدعيها بلا معامل **فيقرأ التخزين من جديد** — وهو المطلوب
// تحديداً، إذ قد يكون المستخدم غيّر الجودة بعد فتح الصفحة.
function applyYtQualityStep(pre) {
  return Promise.resolve(loadYtAutoQualitySettings(pre)).then(() => {
    startYtAutoQuality();
    triggerYtQuality();
  });
}

// -------- Shorts → المشغّل العادي --------
async function loadYtShortsRedirectSetting(pre) {
  const data = await settingsRead(pre);
  const s = data.settings || {};
  // Refresh blockedHosts from the same read so the first redirect check
  // can't run before loadBlockedHosts() resolves
  if (Array.isArray(s.blockedHosts)) blockedHosts = s.blockedHosts;
  ytShortsRedirect = s.ytShortsRedirect !== false; // default on
}

function maybeRedirectShorts() {
  // Bound to the global enable: switching the extension off stops this too, with
  // no exception (owner decision 4, audit #20). remappingEnabled() is the same
  // gate the zones, keyboard and mouse paths use — one switch, everything stops.
  if (!ytShortsRedirect || !extensionActive() || !remappingEnabled() || !isYouTubeHost()) return;
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
  // ── #91 — **وعنصرُ ملء الشاشة ثالثاً، وهو المقيس لا المُخمَّن (2026-08-04)** ──
  // ⚠️ **الجذر (ب) لا (أ):** `.ytp-title` **يُطابَق ويُخفى فعلاً** — وأُثبت بشاهدٍ
  // من صنعنا (عنصرٌ مُفتعَل بالصنف ⇒ `display:none`، وبصنفٍ محايد ⇒ `block`) —
  // **ومع ذلك يبقى العنوان ظاهراً في ملء الشاشة**، لأن يوتيوب يرسمه هناك في
  // **عنصرٍ آخر**: `.ytp-fullscreen-metadata` (**مرئيّ 466×56 في ملء الشاشة، و`0×0`
  // خارجه**). ⇒ **حالٌ لم تُنتَج تُقرأ محدِّداً ميّتاً** (`S7`)، **وعلاجُها محدِّدٌ
  // للحال لا إصلاحُ قاعدة**.
  // ⚠️ **ولم يُنشأ مفتاحٌ ثانٍ رغم أن الخطّة الأولى قالت به**: القياس بيّن أن
  // **الوعد واحد** («العنوان واسم القناة»)، **ومفتاحٌ ثانٍ يترك الأوّل كاذباً** —
  // وهو داء #66 بعينه. **والمقيس أن الحاوية تحمل العنوان والقناة والمشاهدات
  // وحدها** (لا زرّ اشتراك ولا غيره)، فإخفاؤها **هو الوعد لا أوسع منه**.
  top_titles:              [".ytp-title", ".ytp-title-channel", ".ytp-fullscreen-metadata"],
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
  // ── #67 (2026-08-02): العلامة تُستبعَد من التعليقات بنيوياً ──────────────
  // **المقيس على المشغّل الحيّ** (`tools/bench-clean-player.mjs --overlap`، ثلاث
  // عيّنات متطابقة): علامة القناة عنصرٌ **واحد يحمل الصنفين معاً**
  // `annotation annotation-type-custom iv-branding`، فـ`.annotation` و`.iv-branding`
  // كانا يطابقانه معاً — **صفر عنصر يطابق أحدهما دون الآخر**. فكان مربّع
  // «التعليقات» يُخفي العلامة، ومربّع «العلامة» لا يُخفي شيئاً.
  // **ولم يُدمج المفتاحان رغم أنهما اليوم شيء واحد** (قرار المالك): القياس وقع
  // على فيديو **بلا تعليقات فعلية** والحاوية موجودة **فارغة**، و«حالٌ لم تُنتَج
  // لا تُقرأ نفياً» — فالدمج يحذف فئةً لم يثبت موتها، والاستبعاد يُصلح الكذب بلا
  // أن يقرّر في المجهول.
  // **وإخفاء الحاوية لا يُخفي العلامة** — مقيس: العلامة **ليست من نسلها** (صفر)،
  // وسلسلتاهما تفترقان عند `.html5-video-player`.
  annotations:             [".video-annotations", ".annotation:not(.iv-branding)"],
  cards:                   [".ytp-cards-button", ".iv-drawer"],
  endscreen:               [".html5-endscreen", ".ytp-ce-element", ".ytp-endscreen-content", ".ytp-fullscreen-grid-stills-container"],
  embed_more_videos:       [".ytp-pause-overlay-container", ".ytp-pause-overlay"],
  // `.ytp-watermark` **يبقى** (#67): قِيس أنه صفرٌ على صفحة watch، **لكن قاعدة
  // يوتيوب تحصره في `.ytp-muted-autoplay-bottom-buttons`** أي مشغّل المعاينة
  // الصامتة — **حالٌ لم تُنتَج لا محدِّدٌ ميّت**، وحذفه ليس مكافئاً لنقله.
  watermark:               [".ytp-watermark", ".iv-branding"],
  large_play_button:       [".ytp-large-play-button"],
  // ── وميض وسط الشاشة (bezel) — البند #62 ───────────────────────────────────
  // ⚠️ **غير أزرار الشريط السفلي**: `play_button` و`mute_button` و`volume_slider`
  // أدناه تُخفي **أزراراً ثابتة**؛ وهذي تُخفي **وميضاً يومض لحظةً وسط الشاشة**.
  // وُلدت من #60: صرنا نضغط مفتاح يوتيوب بدل الكتابة الصامتة، فصار يومض كل خطوة.
  //
  // **التقسيم من قياس حيّ لا من تخمين** (صفحة watch، بانتظار خبوّ كل وميض قبل
  // قراءة التالي): يوتيوب نفسه يفرّق بينهما **بصنف على الأب**:
  //   · بلا `ytp-bezel-text-hide` ⇒ **وميض له نصّ**: الصوت («0%» · «100%»)
  //     **والسرعة** («1.25x» · «1x») — قِيسا معاً، فلا ينفصلان.
  //   · مع `ytp-bezel-text-hide`  ⇒ **وميض بلا نصّ**: تشغيل/إيقاف **والتقديم
  //     والإرجاع** — قِيسا معاً كذلك.
  //   · وتغيير **الجودة لا يومض أصلاً** (قِيس: `bezel 0×0`).
  bezel_text:              [".ytp-bezel-text-wrapper"],
  bezel_icon_valued:       [":not(.ytp-bezel-text-hide) > .ytp-bezel"],
  bezel_icon_plain:        [".ytp-bezel-text-hide > .ytp-bezel"],
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
  // حُذف `multicam_button` في #66 (2026-08-02): `.ytp-multicam-button` **لا أثر
  // لاسمه في أي ملف يشحنه يوتيوب** — 27 ملفاً · 19MB · بحث نصّيّ
  // (`tools/bench-clean-player.mjs`). وكان **محدِّده الوحيد**، فالمربّع لم يكن
  // يستطيع أن يفعل شيئاً. **ومفتاح مخزَّن عند مستخدم يبقى يتيماً بلا هجرة**
  // بقرار المالك: الحلقة في `applyCleanPlayerCSS` تمرّ على السجلّ لا على المخزَّن،
  // فما ليس في السجلّ لا يُقرأ — **ولا تُكتب في تخزين المستخدم لإزالة ما لا يضرّه**.
  miniplayer_button:       [".ytp-miniplayer-button"],
  pip_button:              [".ytp-pip-button"],
  size_button:             [".ytp-size-button"],
  remote_button:           [".ytp-remote-button"],
  fullscreen_button:       [".ytp-fullscreen-button"]
};

let cleanPlayerSettings = { enabled: false, items: {} };
let cleanPlayerStyleEl = null;

// The two Clean Player items the caption automation clicks. Keys must stay in
// sync with CLEAN_PLAYER_ITEMS above and CLEAN_PLAYER_OPTIONS in options.js.
const CAPTION_AUTOMATION_BUTTONS = new Set(["subtitles_button", "settings_button"]);

// Exactly the condition youtubeSetCaptionLanguage runs under: a language is only
// selected when subtitles are on AND a default language is set.
function captionAutomationActive() {
  return !!(subtitleSettings.enabled && subtitleSettings.defaultLang);
}

// Embedded players also live on youtube-nocookie.com iframes
function isYouTubeFamilyHost() {
  return /(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname);
}

async function loadCleanPlayerSettings(pre) {
  const data = await settingsRead(pre);
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
  // ── #114 — **بوّابةٌ واحدة للجودة و Clean Player، بعد قياسٍ لا قبله** ──────
  // ⛔ **كان هنا `isYouTubeFamilyHost()`** والجودةُ على `isYouTubeHost()` —
  // **بوّابتان متفاوتتان لسلوكٍ واحد**، وكشفه جردُ 2026-08-06.
  // ⇒ **والقاعدة (قرار المالك): لا تُوحَّد قبل القياس** — فقِيس أوّلاً **أثمّة
  // حالٌ يفترقان فيها فعلاً؟** والفرقُ كلُّه في `youtube-nocookie.com`:
  //   · `youtube-nocookie.com/watch?v=…` ⇒ **404** · و`/` ⇒ **404**
  //   · و`/embed/…` ⇒ **200** ⇒ **فالنطاقُ لا يخدم إلا التضمين** (مقيس 2026-08-06).
  //   · **وفي التضمين تُطابق هذي الورقةُ صفراً**: 52 محدِّداً `ytp-*` في السجلّ،
  //     **ولا واحدَ منها يطابق `ytp-unmute*`** — وهي وحدَها ما يحمله ذلك المشغّل
  //     (مقيسٌ في `bench-s10-embed` و#68).
  // ⇒ ⭐ **فلا حالَ يفترقان فيها بأثرٍ مقيس** ⇒ **تُوحَّدان، والاتّجاه إلى الأضيق**:
  //   **حقنُ ورقةٍ لا تطابق شيئاً كلفةٌ بلا مقابل**، **والوسمُ يَعِد بصفحة المشاهدة
  //   وحدها** (`data-vz-embed="cleanPlayer"`) — **فالبوّابةُ تصير كما يَعِد الوسم.**
  // ⛔ **ولا يُوسَّع في الاتّجاه الآخر:** بوّابةٌ تمرّ حيث لا يمكن أن يقع شيء
  // **وعدٌ بما لا يُفعل**، وهو ما صُرف #66 و#67 في إزالته.
  if (!cleanPlayerSettings.enabled || !isYouTubeHost() || !extensionActive()) return;

  // The caption-language automation drives YouTube's menu by CLICKING these two
  // buttons, and findVisibleYTMenuItem requires a non-zero rect — so hiding them
  // killed the feature silently, one part of this extension breaking another
  // (audit #18). Exempted automatically while the automation is on, and hidden
  // again the moment it is switched off (loadSubtitleSettings re-applies).
  const exempt = captionAutomationActive();
  const selectors = [];
  for (const [key, sels] of Object.entries(CLEAN_PLAYER_ITEMS)) {
    if (!cleanPlayerSettings.items[key]) continue;
    if (exempt && CAPTION_AUTOMATION_BUTTONS.has(key)) continue;
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

// ── البند #64 — **البوّابة الواحدة** ────────────────────────────────────────
// **العطب لم يكن ميزةً بلا حارس، بل أحد عشر حارساً متفرّقاً يتباعدون بالبناء:**
// المفتاح العام كان يحرس أربعة، والحظر عشرة، **والجودة لا شيء** — فأطفأ المستخدم
// وحظر ولم يُطفأ شيء (`AUDIT.md` §27).
//
// **الترتيب المقرَّر (قرار المالك):** المفتاح الرئيسي ← حظر الموقع ←
// `(siteRules || siteProfile)` للريماب ← مفتاح الميزة نفسها. **وهذه الدالّة
// تملك الحلقتين الأوليين وحدهما**؛ ما تحتهما يبقى لكل ميزة كما كان.
//
// ⚠️ **وحارسها البنيويّ أن `isBlockedHost()` لها موضع نداء واحد — هنا.**
// يحرسه `tools/test-master-gate.js` بالعدّ: أي ميزة تفحص الحظر بنفسها تُحمّر
// المجموعة، **فيستحيل التفرّق الذي وُلد منه البند** بدل أن يُحرَس بالتذكّر.
function extensionActive() {
  return masterEnabled && !isBlockedHost();
}




// -------------------- Global Video Zones (3x3 + Wheel) --------------------
let zoneSettings = { enabled: true, wheel: { map: {} } };








async function loadZoneSettings(pre) {
  const zones = await ensureZonesDefaults(pre); //  يضمن وجود الإعدادات حتى بدون فتح options
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


// ── ⭐⭐ #148 · #149 — **المشغّلُ المصغّر: نفسُ العنصر، وسياقٌ آخر** ────────────
// **بلاغُ المالك 2026-09-06:** على الصفحة الرئيسية ليوتيوب، **المشغّلُ المصغّر**
// (يُتابع آخرَ مقطعٍ أسفلَ الصفحة) — `Mouse2` يملأ الشاشةَ بالصفحة كلِّها،
// **وأزرارُنا تُرسم عليه وهو بلا شريط تقدّم.**
//
// ⛔⭐⭐ **ولا يُفصل بالمشغّل نفسِه**: `#movie_player` هو **العنصرُ نفسُه** في
// صفحة المشاهدة وفي المصغّر — **يوتيوب ينقله نقلاً** ⇒ **فأيُّ قاعدةٍ تُبنى عليه
// تعمى عن الفرق.** ✅ **ويُفصل بالسلف، مقيساً في لقطة الشجرة الحقيقية**:
// `<ytd-miniplayer>` **موجودٌ في صفحة المشاهدة** (مرّتان) — **فمجرّدُ وجوده ليس
// إشارة** — **و`#movie_player` خارجَ مداه هناك** (موضعُه 4541173 والمصغّرُ
// [4498990, 4500492]) ⇒ **فالاحتواءُ هو السؤال، لا الوجود.**
//
// ⭐ **واسمُ الوسم لا الصنف**: `ytdMiniplayerComponentHost` يبدو مولَّداً بالبناء
// **فلا يُطابَق** (قرار 148)، **و`ytd-miniplayer` اسمُ عنصرٍ مخصَّصٍ يُبقيه يوتيوب**
// كما أبقى `ytd-player` و`ytd-watch-flexy`.
//
// ⚠️ **وخطرٌ يُسمّى لأن العنصرَ ينتقل**: كلُّ حكمٍ مُثبَّتٍ عليه قد يعبر معه —
// **ومزلاجا `speedBtnControlsLatch` و`zoneContainerCache` من هذا الشكل.** ⇒
// **ولذلك يُسأل هذا الشرطُ في كلّ مرّةٍ ولا يُثبَّت**: `closest` رخيصةٌ، والتثبيتُ
// هو الذي كلّفنا #142ج.
const MINI_PLAYER_SELECTOR = "ytd-miniplayer";

function isInMiniPlayer(node) {
  try { return !!node?.closest?.(MINI_PLAYER_SELECTOR); } catch { return false; }
}
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
  if (!extensionActive()) return false;   // #64: الرئيسي ثم الحظر
  if (!remappingEnabled()) return false;
  if (!zoneSettings?.enabled) return false;
  if (zoneSettings?.fullscreenOnly && !document.fullscreenElement) return false;
  return true;
}

// ⚠️ **#38أ — لا يُبنى الـoverlay هنا.** كانت هذه الدالّة تبنيه لكل حدث عجلة أو
// نقرة فوق فيديو **قبل أن يُعرف هل للمربّع ربط أصلاً**، فيُنشأ DOM لا يُعرض.
// صار البناء في **مسارَي العرض** بعد تأكّد الربط — وهو النمط الذي يتبعه مسار
// المفاتيح سلفاً (`zoneKeyBinding` ثم `ensureVideoOverlay`)، فتوحّدت الثلاثة.
function getZoneAtEvent(e, blockScrollable) {
  const video = getVideoUnderPointer(e, blockScrollable);
  if (!video) return null;
  const rect = zoneRectForVideo(video);
  const zone = getZoneNumber(rect, e.clientX, e.clientY);
  return zone ? { video, zone } : null;
}

// Web Components hide their <video> behind a shadow boundary that neither
// elementsFromPoint nor querySelectorAll will cross, so such players were
// invisible to the entire extension (audit #16).
//
// COST: the shadow walk runs ONLY after the plain document pass found nothing,
// so the wheel path — the hot one — pays a single Array#filter over the hit stack
// on ordinary pages and nothing more. Depth is capped so a pathological nesting
// can never turn a wheel event into a tree walk. See tools/bench-shadow.js.
const SHADOW_MAX_DEPTH = 5;

// ── البند #65: الطبقة التي فوق الفيديو تملك عجلتها ──────────────────────────
// كنا نسأل «هل تحت المؤشّر فيديو؟» ولا نسأل **«هل فوق الفيديو شيءٌ يملك هذا
// الحدث؟»** — فكانت كل قائمة مرسومة على الفيديو تصير جزءاً من منطقتنا: العجلة
// تُنفّذ أمر المربّع **وتمنع تمرير القائمة**، فلا صعود ولا نزول بين خيارات
// قائمة الجودة (`AUDIT.md` القسم التاسع).
//
// **الحكم بنيويّ من الأنماط المحسوبة، ولا قائمة محدِّدات ولا استثناء لموقع:**
// `.ytp-panel` و`Layout-sc-…` أسماء تتغيّر، والقياس أثبت أن المميِّز ليس مكان
// القائمة في الشجرة — قائمة تويتش **خارج** حاوية المشغّل وتقع في الفخّ نفسه —
// بل **أنها مرسومة فوق مستطيل الفيديو**.
//
// **و«قابل للتمرير» هو تعريف المتصفّح نفسه** (`overflow-y: auto|scroll` مع
// `scrollHeight > clientHeight`) لا عتبة مخترَعة: هو ما يقرّر به المتصفّح تسليم
// العجلة، فمطابقته أدقّ من أي هامش نضيفه (قرار 31).
const BLOCKED_BY_LAYER = { blockedByLayer: true };

function isScrollableLayer(el) {
  if (!el || el.nodeType !== 1) return false;
  if (isOwnElement(el)) return false;   // شبكتنا ليست طبقة مضيف (قاعدة isOwnElement)
  let style;
  try { style = getComputedStyle(el); } catch { return false; }
  if (!style) return false;
  const oy = style.overflowY;
  if (oy !== "auto" && oy !== "scroll") return false;
  return el.scrollHeight > el.clientHeight;
}

// The original light-DOM scan, factored out so the shadow walk reuses it — and
// **الحكم واحد للمسارين لأن `videoFromShadowStack` تستدعي هذه نفسها** لكل مستوى
// ظلّ، فلا نسخة ثانية تتباعد (درس #60 و#38ج: العلاج النصفيّ يعود من باب جديد).
//
// ⇒ عنصر · أو `null` (لا فيديو) · أو `BLOCKED_BY_LAYER` (فوقه طبقة تملك الحدث).
function videoFromStack(stack, x, y, blockScrollable) {
  for (const el of stack) {
    if (!el) continue;
    if (el.tagName === "VIDEO") return el;

    const closestVideo = el.closest?.("video");
    if (closestVideo) return closestVideo;

    // ⚠️ الترتيب مقصود: `elementsFromPoint` تُرجع الأعلى طلاءً أولاً والأسلاف
    // بعد أبنائها، فما يسبق الفيديو هنا **مرسومٌ فوقه** لا حاوٍ له. ولذلك لا
    // يُحجب مشغّلٌ بحاوية صفحة قابلة للتمرير: الفيديو يسبقها في الكومة.
    // ── #72: **علامةٌ بنيوية تفرّق بين عناصرنا التي تملك وتلك التي لا تملك** ──
    // الشبكة والشارتان **لا تملكان** (`pointer-events:none`، ومرورها هنا لا
    // يغيّر شيئاً)، **والزرّ يملك**. والفارق **سمةٌ على العنصر لا اسم صنف** —
    // فالصنف اسمٌ يتغيّر، والسمة عقدٌ يُقرأ.
    // ⚠️ **ولا يمكن أن يفوز الزرّ بترتيب المستمعين**: مستمعنا في `window`
    // +`capture` **يسبق أي مستمع على الزرّ بنيوياً**. فالحسم هنا، في الكومة.
    // **وغير مشروطٍ بـ`blockScrollable`**: الملكية تسري على العجلة والنقر معاً،
    // بخلاف «قابل للتمرير» التي هي دلالةٌ خاصّة بالعجلة (#65).
    if (el.dataset?.vzOwns) return BLOCKED_BY_LAYER;

    if (blockScrollable && isScrollableLayer(el)) return BLOCKED_BY_LAYER;

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

// Descends host → shadowRoot.elementsFromPoint, breadth-first, depth-capped.
// يمرّر `blockScrollable` كما هي: **الحكم نفسه لا نسخة منه** (#65).
function videoFromShadowStack(stack, x, y, blockScrollable) {
  // Allocate only if a shadow host is actually present — pages without Web
  // Components (the overwhelming majority) then pay one cheap scan and nothing else.
  let hosts = null;
  for (const el of stack) {
    if (el?.shadowRoot) (hosts ||= []).push(el);
  }
  if (!hosts) return null;

  for (let depth = 0; depth < SHADOW_MAX_DEPTH && hosts.length; depth++) {
    const next = [];
    for (const host of hosts) {
      const inner = host.shadowRoot.elementsFromPoint?.(x, y);
      if (!inner?.length) continue;
      const hit = videoFromStack(inner, x, y, blockScrollable);
      if (hit) return hit;   // ومنه BLOCKED_BY_LAYER: طبقةٌ داخل الظلّ تملك الحدث
      for (const el of inner) if (el?.shadowRoot) next.push(el);
    }
    hosts = next;
  }
  return null;
}

// `blockScrollable` يُمرَّر من مسار العجلة وحده (#65): «قابل للتمرير» دلالةٌ
// خاصّة بالعجلة، ولا معنى لها في نقرة ولا في مفتاح — فلا يُغيَّر مسارٌ لم يُقس.
function findVideoAtPoint(x, y, blockScrollable) {
  if (typeof x !== "number" || typeof y !== "number") return null;

  const stack = typeof document.elementsFromPoint === "function"
    ? document.elementsFromPoint(x, y)
    : [document.elementFromPoint(x, y)].filter(Boolean);

  const direct = videoFromStack(stack, x, y, blockScrollable);
  if (direct === BLOCKED_BY_LAYER) return null;   // الحدث ليس لنا — ولا يُبحث في الظلّ
  if (direct) return direct;          // المسار الشائع: يخرج قبل أي عمل إضافي
  const shadow = videoFromShadowStack(stack, x, y, blockScrollable);
  return shadow === BLOCKED_BY_LAYER ? null : shadow;
}

function getVideoUnderPointer(e, blockScrollable) {
  if (typeof e.clientX === "number" && typeof e.clientY === "number") {
    const v = findVideoAtPoint(e.clientX, e.clientY, blockScrollable);
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
    // ⚠️ **المصيدة الأولى — تُقاس الحركة قبل الكتابة لا بعدها.** كروم يُطلق
    // `mousemove` **والمؤشّر ساكن** حين ينزلق ما تحته (تمرير الصفحة)، فلو عُدّ
    // ذلك نشاطاً لما بلغ المؤقّت نهايته أبداً ما دامت الصفحة تتمرّر —
    // **والفرق ليس تفصيلاً: هو الفرق بين ميزةٍ تعمل وميزةٍ تبدو معطّلة.**
    // والمقارنة على `lastPointer` **القائم سلفاً**، فلا حالة جديدة.
    const moved = e.clientX !== lastPointer.x || e.clientY !== lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };
    noteIdleFromPointerEvent(e, moved);
  }
  // ── #86 — **التوفيق بعد تسجيل النشاط لا قبله** ────────────────────────────
  // لو سبقه لَظهر وميض: الحدث نفسه يفكّ الامتناع **فيُخفى المستهلك**، ثمّ يُسجَّل
  // النشاط **فيُظهر ثانيةً**. والترتيب هذا يجعل التصحيح صامتاً.
  reconcileIdlePointerHeld(e);
}

// ── محرّك السكون — يُصدر حالةً ولا يُصدر أمراً (#70 · #72) ───────────────────
// **الحدّ المعماريّ (قرار المالك 2026-08-02): المحرّك يقول «سكون/نشاط»،
// والسياسة لكل مستهلك.** وهو حدٌّ لا أناقة، **لأن الملكية مختلفة**: #70 يُخفي
// **شريط المضيف** فيلزمه احترام نيّة المضيف، و#72 يُخفي **زرّنا** فالقرار
// قرارنا. **ومحرّكٌ يفرض سياسةً واحدة يُجبر أحدهما على سلوك الآخر.**
//
// **وهذا الكومِت المحرّك وحده — بصفر مستهلك مسجَّل**، على نمط كومِت إطار
// المحوّلات (#60): **يُبرهَن صفر تغيّر قبل أن يوجد مستهلكٌ واحد.**
//
// ⚠️ **ثلاث مصائد أُمسكت في التصميم قبل أن تقع، وتُقرأ مع الكود لا بعده:**
//  **(١)** `mousemove` بلا حركة فعلية — أعلاه.
//  **(٢) أحداث الوسائط ليست نشاطاً.** `timeupdate` وحده يقع **أربع مرّات في
//      الثانية** فيُبطل كل مؤقّت. **والقاعدة بنصّها: «النشاط يُقاس عند الإدخال
//      لا عند أثره»** — فلا `play` ولا `pause` ولا `seeking` ولا `timeupdate`
//      في مصادر النشاط، مهما بدت دالّةً على مستخدمٍ حيّ.
//  **(٣) الحالة الابتدائية «سكون» لا «نشاط».** صفحةٌ لم يحوّم عليها أحد **لا
//      يظهر فيها شيء**، ولا يبدأ فيها مؤقّتٌ لم يبدأه المستخدم.
//      ⭐ **وتعود من بابٍ ثالث في 12ب (2026-08-03):** `lastPointer` يبدأ
//      `{x:null,y:null}`، **ومستطيلٌ صفريّ عند `0,0` يحتوي مؤشّراً لم يتحرّك
//      بعد** — فلولا حارس `width>0 && height>0` في `pointerInsideEl`
//      **لامتنع الزرّ عن الاختفاء على صفحةٍ لم يلمسها أحد**. ⇒ **«لم يبدأ» و«عند
//      الأصل» يطبعان الإحداثيّات نفسها** — وهي عائلة «الصفر لا يُصدَّق حتى يُفصل
//      مصدره» (قرار 26) في الهندسة لا في القياس.
// #86 — **الحدّ الأدنى 100ms** (كان 500، قرار المالك 2026-08-03): من أراد إخفاءً
// فورياً لم يكن يبلغه، وأقلُّ ما يصله نصف ثانية.
// ⚠️ **و«صفر» تبقى غيرَ «مطفأ»: القيمة تُقصّ إلى الحدّ ولا تُقرأ إطفاءً** —
// **المفتاح وحده يُطفئ** (الشاهد 24 في `tools/test-idle-engine.js`).
const IDLE_MIN_MS = 100;
const IDLE_DEFAULT_MS = 2000;       // ⚠️ افتراضٌ قابل للضبط، **ولم يُقس بعد**
const IDLE_MOVE_THROTTLE_MS = 100;  // سقف فحوص الاحتواء في الثانية: عشرة

let idleMs = IDLE_DEFAULT_MS;
let idleState = "idle";             // المصيدة (٣): يبدأ ساكناً
let idleLastActivityAt = 0;
let idleTimer = null;
let idleMoveCheckedAt = 0;
// **المسار الحارّ يقرأ منطقيّاً واحداً لا حلقة.** يُحسب عند تغيّر الإعدادات
// وحدها، فبلا مستهلكٍ مُفعَّل: **صفر مؤقّت · صفر قراءة DOM · صفر تخصيص**.
let idleWanted = false;
// ⭐ **#107 — ومنطقيٌّ ثانٍ بالشكل نفسه**: هل لأحد المستهلكين حالٌ **تتبع موضعَ
// المؤشّر** لا حالةَ المحرّك؟ **يُحسب حيث يُحسب `idleWanted`**، فمن لا مستهلكَ
// متتبّعٌ عنده لا يدفع شيئاً — **والمسارُ الحارّ يبقى منطقيّاً واحداً**.
let idlePointerTracked = false;

// **سجلٌّ واحد على نمط `OVERLAY_PARTS`** — مستهلكٌ ثالث يُضاف هنا وحده.
// عقد المستهلك: `enabled()` · `suspended()` اختياريّ · `onActive()` · `onIdle()`.
// ⚠️ **و«ممتنع» تعني «يُعرض كالنشط»**، لا «يُترك على حاله»: الامتناع سببه أن
// شيئاً يريد الظهور الآن، فتركُه على «مخفيّ» يُبقي الإخفاء الذي امتنعنا عنه.
const IDLE_CONSUMERS = {};

async function loadIdleSettings(pre) {
  const data = await settingsRead(pre);
  const ms = Number(data.settings?.idle?.ms);
  const next = Number.isFinite(ms) && ms > 0 ? Math.max(IDLE_MIN_MS, ms) : IDLE_DEFAULT_MS;
  const changed = next !== idleMs;
  idleMs = next;
  refreshIdleConsumers();
  // ── #90 — **مؤقّتٌ جارٍ يُعاد حسابه على القيمة الجديدة فوراً** ─────────────
  // ⛔ **العطب مقيس:** ضُبطت المهلة 0.5s بعد ثانيتين من تسليحٍ على 6s، **فبقي
  // الزرّ ظاهراً حتى الثانية السادسة** — أي أن المؤقّت أكمل على القيمة القديمة.
  // **والنقرة نشاطٌ يُعيد التسليح**، فيُطبَّق الإعداد ⇒ **«لا يُطبَّق حتى أنقر».**
  // ⇒ **وإعدادٌ يُطبَّق «من الدورة القادمة» يبدو معطّلاً لمن غيّره ونظر** — وهو
  // العَرَض بعينه (قرار المالك).
  // **و`idleTick` تحسب الباقي من `idleMs` الحاليّة**، فإلغاءُ المؤقّت ونداؤها
  // يُعيد الحساب على الجديدة: **سالبٌ ⇒ سكونٌ الآن، وموجبٌ ⇒ تسليحٌ للباقي.**
  if (changed && idleTimer != null) {
    clearTimeout(idleTimer);
    idleTimer = null;
    idleTick();
  }
}

// #64: الرئيسي ثمّ الحظر، ثمّ «هل لأحد المستهلكين مفتاحٌ مُشغَّل أصلاً؟»
function idleEngineActive() {
  if (!extensionActive()) return false;
  for (const c of Object.values(IDLE_CONSUMERS)) if (c.enabled()) return true;
  return false;
}

// تُنادى عند كل تغيّر في الإعدادات، **وعلى كل مستهلك يتغيّر شرط امتناعه**
// (مثال #72: عند `play`/`pause`) — وإلا بقيت الحالة معروضة على شرطٍ مضى.
function refreshIdleConsumers() {
  idleWanted = idleEngineActive();
  // **المستهلك يُعلن أنه يتبع المؤشّر، والمحرّك يسأل ولا يعرف لماذا** (#107).
  idlePointerTracked = Object.values(IDLE_CONSUMERS)
    .some((c) => c.enabled() && c.tracksPointer?.());
  if (!idleWanted) {
    clearTimeout(idleTimer);
    idleTimer = null;
    idleState = "idle";
  }
  // ⚠️ **تُنادى في الحالين** — ومع `!idleWanted` تُخرج كل مستهلك إلى «نشط»،
  // فلا يبقى إخفاءٌ عالقاً بعد إطفاء المفتاح أو إغلاق البوّابة.
  applyIdleState();
}

// ⭐ **القاعدة العامّة: لا يُخفى ما يستقرّ المؤشّر عليه** (#95).
// **وهي حالتان لقاعدةٍ واحدة لا شرطان**: كانت `pointerInsideSpeedBtn` خاصّةً
// بزرّنا، **فعُمِّمت** — **والمستهلك يُعلن هدفه، والمحرّك يسأل «أفيه المؤشّر؟»
// ولا يُفسّر** (قرار 57 يدفع ثمنه رابعةً).
// ⚠️ **والهدف هو ما نُخفيه لا المشغّل كلّه:** لو كان المشغّل **لصارت الميزة لا
// تعمل إلا والفأرة خارج الفيديو** — وهو عكس غرضها (شرط قبول المالك).
// ⚠️ **وحارس المستطيل الصفريّ شرطٌ لا تفصيل** (قرار 22): `lastPointer` يبدأ
// `{null,null}`، **ومستطيلٌ صفريّ عند `0,0` يحتوي مؤشّراً لم يتحرّك بعد**.
// ── #106 — **منطقةُ الامتناع أوسعُ من الهدف بهامشٍ عموديّ** ──────────────────
// ⛔ **البلاغ:** الهدف `.ytp-chrome-bottom` ارتفاعُه **59px**، ومنطقةُ الامتناع
// كانت **هي هو بالضبط** ⇒ **لا يُبقي المستخدمُ الشريطَ ظاهراً إلا والمؤشّر داخل
// تسعةٍ وخمسين بكسلاً** — **الميزةُ تعمل ويصعب استعمالها، وهو عطبٌ لا تفضيل.**
//
// ⭐⭐ **والرقمُ أدناه قرارُ تصميم لا قياس — والقاعدة تُكتب هنا لأنها عامّة**
// (قرار 96، وقعت في بوّابةٍ وضعها المالك على نفسه): **أرقامُنا نوعان، وخلطُهما
// هو الخطأ.** **حقيقةٌ عن المضيف** (المحوُ عند 3000ms · ارتفاعُ الشريط 59) **تُقاس
// ولا خيار لنا فيها** · **وقرارُ تصميم** (كم بكسلاً هامشُ الالتقاط) **يُختار ولا
// شيءَ فيه يُقاس**. ⇒ **والواجبُ أن يُقال أيُّهما هو، لا أن يُلبَّس الاختيارُ ثوبَ
// القياس.** ⛔ **وقد طُلب أوّلاً أن يُشتقّ الهامشُ من يوتيوب، فأثبت قياسٌ متعمَّد
// أن يوتيوب لا هامشَ له أصلاً: يُخفي بمؤقّت، ولا يحمي فوق شريطه ولا تحته** ⇒
// **فكان المطلوبُ قياسَ شيءٍ لا وجود له.**
//
// ⚠️ **فحدُّ هذا الرقم مكتوبٌ هنا لا في ذاكرة أحد:**
//   · **`40` اختيارٌ لا قياس.**
//   · **مسنودٌ بقياس المالك لإضافةٍ أخرى**: ظلّ الشريطُ عند **40** واختفى عند **59**.
//   · ⚠️ **وذاك القياسُ نفسُه فيه تناقضُ ترتيب** — `Δ=40` **ظلّ مرّةً واختفى
//     مرّةً** ⇒ **دليلٌ تقريبيّ لا رقمٌ دقيق.**
//   · **وحكمُه ميدانُ المالك**: يجرّبه فيقول «مريحة أم أزيد أم أنقص».
// ⇒ **فمن رآه بعد سنة لا يبحث عن قياسٍ يفسّره ولا يظنّه مقدّساً.**
//
// ⭐ **والهامشُ متماثل — فوق الهدف وتحته، بحجّةٍ بنيوية لا ذوقية (قرار المالك):**
// **الفأرةُ تقترب من الشريط من أعلى ومن أسفل معاً، وهامشٌ من جهةٍ واحدة يُنتج
// حافّةً حادّة في الجهة الأخرى.** ⇒ **رقمٌ واحد لا رقمان، وموضعٌ واحد يُعرَّف فيه.**
//
// ⛔ **والتوسيعُ على منطقة الامتناع وحدها لا على الهدف الذي يُخفى:** الشريطُ
// يُخفى كما هو (`YT_PROGRESS_SELECTOR` لم يُمسّ)، **والمنطقةُ التي تمنع الإخفاء
// أوسع** — **وخلطُهما يُنتج إخفاءَ ما لم نقصد.**
// ⚠️ **والهامش يُعلنه المستهلك كما يُعلن هدفه، ولا يفرضه المحرّك**: **مستهلكٌ لا
// يُعلنه يعمل بلا هامش، حرفاً بحرف كما كان** — **فلا يرث أحدٌ توسيعاً كُتب لجاره**
// (وهو الحدّ المعماريّ نفسه في #70 مقابل #72).
const IDLE_NEAR_PAD_PX = 40;

function pointerInsideEl(el, padY = 0) {
  if (!el || !el.isConnected) return false;
  if (typeof lastPointer.x !== "number" || typeof lastPointer.y !== "number") return false;
  let r;
  try { r = el.getBoundingClientRect(); } catch { return false; }
  // ⚠️ **حارس المستطيل الصفريّ على الهدف نفسِه لا على المنطقة** (قرار 22):
  // هدفٌ مخفيّ `0×0` **لا يُحيي نفسه بهامش** — وإلا صار الهامشُ بابَ إحياء.
  if (!(r.width > 0 && r.height > 0)) return false;
  let top = r.top - padY, bottom = r.bottom + padY;
  // ⛔ **ولا يمتدّ الهامشُ خارج مستطيل المشغّل** (شرط المالك): 40 تحت شريطٍ في
  // أسفل المشغّل تقع في الصفحة تحته، و**الخروج من إطار المشغّل حالٌ مقيسة لها
  // حكمُها** (القسم الرابع عشر: مؤقّت المضيف يمضي ولا يُستعجل).
  //
  // ⚠️⚠️ **«صفرٌ هنا بقياس يوتيوب، ولا يُحذف»** — يُقرأ قبل أن يُظنّ كوداً ميتاً:
  // **المقيس في متصفّح المالك 2026-08-05: أسفلُ `.ytp-chrome-bottom` على أسفل
  // `#movie_player` تماماً (`0px`)، وفوقه `890px`** ⇒ **القصُّ يُصفّر الهامشَ
  // السفليّ على يوتيوب** — **بالقياس لا بالتصميم.**
  // ⇒ **فالرقمُ متماثلٌ في الكود وأثرُه هناك من جهةٍ واحدة**، ⭐ **ويصير له أثرٌ
  // على مضيفٍ يقع شريطُه فوق حافّة مشغّله — وذاك ما يجعله ليس ميتاً.**
  // ⛔ **فمن رأى بعد سنة فرعاً لا يقع على يوتيوب أبداً فلا يُزيله**: إزالتُه
  // تكسر مضيفاً آخر، **وقرارُ المالك أن يبقى الرقمُ واحداً متماثلاً** (قرار 96:
  // **قرارُ تصميم يُختار**، والقياسُ يصف أثرَه ولا يُلغيه).
  if (padY > 0) {
    const p = playerRectForTarget(el);
    if (p) { top = Math.max(top, p.top); bottom = Math.min(bottom, p.bottom); }
  }
  return lastPointer.x >= r.left && lastPointer.x <= r.right &&
         lastPointer.y >= top && lastPointer.y <= bottom;
}

// **مستطيلُ المشغّل الحامل للهدف** — `KNOWN_PLAYER_WRAPPER_SELECTOR` نفسُه الذي
// تستعمله المربّعات وملءُ الشاشة، **لا اسمٌ ثانٍ يتباعد عنه**.
function playerRectForTarget(el) {
  let p;
  try { p = el.closest?.(KNOWN_PLAYER_WRAPPER_SELECTOR); } catch { return null; }
  if (!p) return null;
  let r;
  try { r = p.getBoundingClientRect(); } catch { return null; }
  return r.width > 0 && r.height > 0 ? r : null;
}

// ── مُخبِرُ حالة المحرّك — **آلةُ قياسٍ لا علاج** (#86، 2026-08-04) ───────────
// ⚠️ **وُلد من حدٍّ مقيس في الرِكاز، لا من رغبةٍ في تشخيص:** متغيّرات `let` في
// أعلى سكربت المحتوى **لا تُقرأ** من `Runtime.evaluate` في عالم الإضافة —
// **مقيس**: `typeof idleState === "undefined"` بينما `typeof pointerInsideEl
// === "function"`. ⇒ **فالدوالّ تُقرأ والمتغيّرات لا**، وحالةُ المحرّك كانت
// **تُستدلّ من أثرها** — **وأثرُنا وأثرُ المضيف متطابقان في العين** (قرار 48)،
// فالاستدلال من الأثر **قال «اختفى» ولم يقل «من أخفاه»**.
// ⇒ **دالّةٌ تقرأ ولا تكتب**: لا تُبدّل حالةً ولا تُنشئ عنصراً ولا تُطلق حدثاً،
// **ولا يعتمد عليها سطرُ منتجٍ واحد** — تُحذف فلا يتغيّر سلوك.
// **وتُنادى من عالم الإضافة**: في كونسول المتصفّح يُبدَّل السياق إلى اسم الإضافة.
function vzIdleSnapshot() {
  return {
    held: idlePointerHeld,
    state: idleState,
    activityAt: idleLastActivityAt,
    timerArmed: idleTimer != null,
    wanted: idleWanted,
    ms: idleMs,
    pointer: { x: lastPointer.x, y: lastPointer.y },
    fullscreen: document.fullscreenElement
      ? (document.fullscreenElement.id || document.fullscreenElement.tagName) : null
  };
}

// ── #86 — **الحالة تُوفَّق ولا تُذكَر** (قرار المالك 71) ──────────────────────
// ⛔ **العلّة مقيسةٌ لا مرجَّحة** — لقطةُ المالك بعد ملء الشاشة بأمرنا **وبلا أي
// ضغطة**: `{held:true, state:"idle", timerArmed:false, wanted:true}`.
// ⇒ **المستهلك يريد الإخفاء، والامتناع عالقٌ يمنعه، ولا مؤقّت.** والضغطةُ التالية
// كانت تفكّه **بإفلاتها** — فبدا أن الميزة «تعمل بعد ضغطة»، **وهي لا تعمل**.
// **والسبب:** الضغطةُ الوسطى **تدخل ملء الشاشة من `mousedown` نفسِه**، ثمّ
// **يضيع الإفلات في النقلة** — فيبقى `idlePointerHeld` مرفوعاً إلى الأبد.
//
// ⛔ **ولا مخرجَ خامساً** (قرار 71): للحالة **أربعة مخارج** (`mouseup` ·
// `pointercancel` · `blur` · `visibilitychange`) **ونجحت في إفلاتٍ خارج النافذة**،
// **ونقلةُ ملء الشاشة ليست فيها**. **وقائمةٌ من أربعةٍ تُكمَّل بخامسٍ تُعلن أنها
// قائمة مداخل**: تحرس ما فيها وتُفلت ما يُضاف بعدها (قرار 16ج).
// ⇒ ⭐ **بل تُقرأ الحقيقة من الحدث نفسه**: `e.buttons` **قناعُ الأزرار المضغوطة
// الآن** — فأيُّ حدثِ فأرةٍ موثوق يحمل `0` **يُصحّح الحالة بنفسه**، ويصير العلوق
// **مستحيلاً بالبناء لا محروساً بعددٍ من المخارج**. **وهو موضعه الرابع** بعد
// #64 (بوّابةٌ واحدة) و#96 (شريطٌ من نطاقه) و#94 (شرطٌ موجب).
//
// ⚠️ **ويُصحّح ولا يُقرّر:** لا يرفع الحالة أبداً — **بدءُ الإمساك حكمُ `mousedown`
// وحده** (بشرط الموضع داخل المشغّل). فضغطةٌ بدأت خارج المشغّل ومرّت فوقه **لا
// تُنشئ إمساكاً**، وذاك فرقٌ بين «تصحيح» و«مصدرٍ ثانٍ للحقيقة».
// ⚠️ **وحدثٌ بلا `buttons` لا يُحكم به** — **غيابُ الخبر ليس خبراً بالصفر**،
// وهي عائلةُ الأصفار نفسها التي لُدغنا منها مراراً.
function reconcileIdlePointerHeld(e) {
  if (!idlePointerHeld) return;                 // لا شيء يُصحَّح
  if (!e || e.isTrusted === false) return;      // حدثٌ من صنعنا لا يحكم — كما لا يَمسك
  if (typeof e.buttons !== "number") return;    // حدثٌ لا يحمل الحالة
  if (e.buttons !== 0) return;                  // زرٌّ مضغوطٌ فعلاً ⇒ لا نُخفي تحت اليد
  idlePointerHeld = false;
  refreshIdleConsumers();
}

// ⚠️ **مُطفأ لا يُتخطّى صامتاً** — **فيبقى إخفاؤه عالقاً بعد إطفاء مفتاحه**.
// **حالةٌ تُترك على آخر ما كانت عليه هي حالةٌ لا يملك أحدٌ إخراجها**، فالتعافي
// مبنيّ لا محروس. **وهذا النصف صحيحٌ ويبقى.**
//
// ⛔ **ونصفُه الثاني مسحوب (قرار 21، 2026-08-03) — الجذر الثاني في #72:**
// ~~«مُطفأ ⇒ **يُعرض كالنشط**»~~.
// **صوابٌ لِما نُخفيه من المضيف، وعكسُه لِما نرسمه نحن:** «كالنشط» في #70 تعني
// **أعِد شريط يوتيوب** — وهو المطلوب؛ وفي #72 تعني **أظهِر زرَّنا** —
// **فإطفاء المفتاح كان يُظهر الزرّ بدل أن يُزيله** (مقيسٌ في الرِكاز).
// ⇒ ⭐ **والاستعادة تخصّ ما نُخفيه من المضيف لا ما نرسمه نحن.**
//
// ⇒ **والعلاج مبدئيّ لا شرطٌ ثانٍ في المحرّك: المستهلك يُعلن ما يعنيه إطفاؤه،
// والمحرّك ينقل الحالة ولا يقرّر معناها.** فمستهلكٌ ثالث يُضاف غداً **يُعلن**
// ولا يرث تأويلاً كُتب لجاره — **وهو ما لم يكن ممكناً في الشكل القديم**.
// **وحارسه بنيويّ: مستهلكٌ بلا `onDisabled` يُحمّر المجموعة** — فالإعلان
// **شرطُ التسجيل** لا عادةً حسنة (قرار 16ج).
// ── ⛔⭐ حارسُ إعادة الدخول — عقدٌ صريح: **نداءُ المستهلك لا يُعيد تشغيل المحرّك**
// **الواقعة (#108، عطبٌ حيّ عند المالك 2026-08-05):** مستهلكٌ نادى من `onDisabled`
// دالّةً تنادي `refreshIdleConsumers()` ⇒ **دورةٌ بلا قاع** (`RangeError` عشرات
// المرّات · وصفحةٌ تعلّق · وإضافةٌ تبدو معطّلة). ⇒ **والعطبُ يقع والمفتاحُ مطفأ**،
// لأن `onDisabled` تُنادى لكلّ مستهلكٍ **غيرِ مُفعَّل**.
//
// ⇒ **والحارس في المحرّك لا في مستهلك** (قرار المالك): مستهلكٌ ثالثٌ غداً يرثه
// **بلا أن يعرف أنه موجود** — وهو الفرق بين حارسٍ يمنع عودةَ السطر وحارسٍ يمنع
// عودةَ العطب.
// **والشكل: رايةٌ لا دخول.** نداءٌ أثناء تطبيقٍ جارٍ **يرفع الراية ويعود**،
// ويُعاد التطبيق **مرّةً واحدة** بعد انتهائه.
// ⚠️⚠️ **ومحدودةٌ لا مفتوحة، وتُعلن حين تبلغ حدَّها:** إن بقيت الرايةُ مرفوعةً
// بعد تلك المرّة **فذاك عطبٌ حقيقيّ في مستهلك** — **يُقال بصوتٍ عالٍ ولا يُبتلع
// في حلقةٍ صامتة.** ⭐ **«الصمتُ ليس نجاحاً» يسري على حارسٍ يُخفي دوراناً كما
// يسري على `catch` فارغ** (شرط المالك).
let idleApplying = false, idleReapply = false;

// ⭐⭐ **والمخرجُ المعلَن للمستهلك: يطلب إعادةً ولا يُعيد الدخول** (#108).
// **الحارسُ وحده لم يكن كافياً — ورسالتُه قالت ذلك بنصّها:** «عطبٌ في مستهلك».
// ⇒ **فمن بدّل شرطَ امتناعٍ وهو داخل نداءٍ من المحرّك يُعلن الحاجة، والمحرّكُ
// يستوفيها في إعادته المحدودة** — **ولا رميةَ ولا تحذير، ولا حالٌ بائتة.**
// ⚠️ **والفرق عن `refreshIdleConsumers` مباشرةً هو الفرقُ كلُّه:** تلك **تُشغّل
// المحرّك من داخل تشغيله**، وهذي **ترفع علماً يقرؤه المحرّك حين يفرغ.**
function requestIdleReapply() {
  if (idleApplying) { idleReapply = true; return "طُلبت"; }
  refreshIdleConsumers();
  return "نُفِّذت";
}

function applyIdleState() {
  if (idleApplying) { idleReapply = true; return; }
  idleApplying = true;
  try {
    applyIdleStateOnce();
    if (idleReapply) { idleReapply = false; applyIdleStateOnce(); }
    if (idleReapply) {
      idleReapply = false;
      // **الحدُّ بلغ ولم يستقرّ** ⇒ خبرٌ لا صمت، ومرّةً واحدة لا في كل دورة
      if (!idleReentryWarned) {
        idleReentryWarned = true;
        console.warn("[VZ] محرّك السكون: مستهلكٌ يُعيد الدخول بعد مرّتين — " +
          "عطبٌ في مستهلك، لا في المحرّك. راجِع مَن ينادي refreshIdleConsumers من نداءٍ.");
      }
    }
  } finally { idleApplying = false; }
}
let idleReentryWarned = false;

// ── ⭐ #125 — **تغيّرُ تفعيلِ مستهلكٍ نشاطٌ له وحدَه** (قرار المالك 2026-08-07)
//
// ⛔ **وهو قرارُ تصميمٍ لا إصلاحُ عطب:** المقيس أن التبديل **يصل التبويبَ المفتوح
// ويُطبَّق** — **والزرُّ يظهر بأوّل حركة**. ⇒ **والمطلوبُ أن يظهر فورَ التبديل.**
//
// ⛔⭐ **ولا يرسم المستهلكُ نفسَه من وراء المحرّك** (الحدّ المعماريّ، دفع أربع
// مرّات): **يُعلَن للمحرّك فيُطبّق، ثمّ يعود المستهلكُ إلى قواعده** — فيظهر الآن،
// **ويختفي بمهلة السكون كالمعتاد.**
// ⛔ **ولا يوقظ التبديلُ المستهلكين الآخرين:** لا شيءَ وقع في ذلك التبويب،
// **فإيقاظُ الشريط والشبكة معه أثرٌ لم يطلبه أحد** ⇒ **الإيقاظُ لهذا وحدَه.**
//
// ⭐⭐ **وقُرئ قبل أن يُكتب: أثمّة مستهلكٌ ثالثٌ يتضرّر؟ لا — والسببُ بنيويّ:**
// **المحرّكُ يقول أيُّ حالٍ وقعت والمستهلكُ يفسّرها** (#107). ⇒ **فتمريرُ
// `"active"` إلى `progressBar` في وضع `near` يُنتج `setYtProgressHidden(true)`**
// (سياستُه: `why === "active"` ⇒ **يُخفي**) — **أي وعدَ الوضع بحرفه لا نقضَه.**
// ⚠️ **ومع ذلك لا يُمرَّر إليه شيء**: الإيقاظُ **باسم المستهلك** — **فالسلامةُ
// من بابين، والثاني يكفي وحدَه.**
function applyIdleConsumerNow(name) {
  const c = IDLE_CONSUMERS[name];
  if (!c) return "لا مستهلك";
  if (!idleWanted || !c.enabled()) { c.onDisabled(); return "مطفأ"; }
  if (c.suspended?.()) { c.onActive("suspended"); return "ممتنع"; }
  if (pointerInsideEl(c.target?.(), c.nearPad?.() ?? 0)) { c.onActive("pointer"); return "قرب"; }
  c.onActive("active");                 // **الظهورُ الآن، والاختفاءُ بمهلته**
  return "نشط";
}

function applyIdleStateOnce() {
  const engineOff = !idleWanted;     // المحرّك مطفأ ⇒ لا سكون على أحد
  for (const c of Object.values(IDLE_CONSUMERS)) {
    // **«لا يعمل» يسأل صاحبَه عن معناه** — إطفاءُ مفتاحه أو إغلاقُ البوّابة
    if (engineOff || !c.enabled()) { c.onDisabled(); continue; }
    // **و«ممتنع» غيرُ «مُطفأ»**: الميزة عاملة وشيءٌ يريد الظهور الآن ⇒ كالنشط.
    // ⭐ **ومنه القاعدة العامّة (#95): لا يُخفى ما يستقرّ المؤشّر عليه** —
    // **المستهلك يُعلن `target` والمحرّك يسأل، ولا يعرف المحرّك ما هو الهدف.**
    // ⚠️ **والهامش من إعلان المستهلك لا من حكم المحرّك** (#106): غيابُه صفر.
    // ⭐ **#107 — والمحرّك يقول أيُّ حالٍ وقعت، ولا يقول ماذا يُفعل بها:** ثلاثةُ
    // أسبابٍ تُسمّى (`suspended` · `pointer` · `active`) بدل «نشط» واحدة.
    // **والسياسةُ للمستهلك**: #70 في وضع `near` **يُخفي مع `active`** ويُظهر مع
    // الأوّلين، و#70 في `idle` يُظهر في الثلاثة. ⇒ **إخبارٌ بحالٍ أدقّ لا أمرٌ،
    // فالحدُّ المعماريّ قائم.** ⚠️ **ومن أهمل الوسيط عمل كما كان حرفاً بحرف** (#72).
    if (c.suspended?.()) { c.onActive("suspended"); continue; }
    if (pointerInsideEl(c.target?.(), c.nearPad?.() ?? 0)) { c.onActive("pointer"); continue; }
    if (idleState === "idle") c.onIdle(); else c.onActive("active");
  }
}

// **طابعٌ زمنيّ واحد** — لا `clearTimeout`+`setTimeout` في مسارٍ يقع مئات
// المرّات في الثانية، **ولا `requestAnimationFrame`**: حلقة الرسم القائمة
// تتوقّف حين لا يظهر شيء، وحلقةٌ دائمة لكشف السكون تُلغي هذا المكسب.
function markIdleActivity() {
  if (!idleWanted) return;
  idleLastActivityAt = nowMs();
  if (idleState !== "active") {
    idleState = "active";
    applyIdleState();
  } else if (idlePointerTracked) {
    // ⭐⭐ **#107 — وحالٌ تتبع المؤشّر تُعاد قراءتها ولو لم تتبدّل حالةُ المحرّك.**
    // ⛔ **العطب مقيسٌ في الحارس قبل أن يراه مستخدم:** المحرّك يُعيد التطبيق عند
    // **الانتقال** وحده، **والانتقالُ لا يقع بين حركةٍ وحركة** ⇒ **في «مخفيّ
    // دائماً» كان الشريطُ يظهر بالقرب ثمّ يبقى ظاهراً بعد الابتعاد** حتى تمضي
    // مهلةُ السكون كاملةً — **وعدٌ ينقضه المنتَج بمقدار المهلة.**
    // ⚠️ **والثمن محسوب لا مُهمَل**: المسار مخنوقٌ سلفاً بـ`IDLE_MOVE_THROTTLE_MS`
    // (عشرُ فحوصٍ في الثانية)، **ولا يُدفع إلا حيث أُعلن التتبّع**.
    applyIdleState();
  }
  if (idleTimer == null) idleTimer = setTimeout(idleTick, idleMs);
}

// **المؤقّت يُصحّح نفسه**: يستيقظ مرّة، فإن بقي وقتٌ أعاد تسليح نفسه للباقي.
function idleTick() {
  idleTimer = null;
  if (!idleWanted) return;
  const left = idleMs - (nowMs() - idleLastActivityAt);
  if (left > 0) { idleTimer = setTimeout(idleTick, left); return; }
  if (idleState !== "idle") {
    idleState = "idle";
    applyIdleState();
  }
}

// ── إشارتان بنيويّتان يستهلكهما شرط الامتناع — **بلا صنف مضيفٍ واحد** ───────
// **حلّتا محلّ ثلاثة أصناف تموت** (`seeking-mode` · `ytp-probably-keyboard-focus`
// · `ytp-settings-shown`) — وهو النمط الذي نلاحقه منذ #65.
//
// **(١) زرٌّ مضغوط بدأ داخل المشغّل.** ⚠️ **المقيس أن السحب يقع بلا حركة**:
// الحالة 5 في `AUDIT.md` القسم الرابع عشر — `mousedown` واحد ثمّ صمتٌ تامّ،
// و`seeking-mode` حاضر والشريط ظاهر. ⇒ **مقدّمة «السحب حركةٌ متّصلة فهو نشاطٌ
// بالتعريف» تصحّ أثناء الجرّ وتسقط عند الوقفة** (سُحبت بقرار 21، 2026-08-02).
// فبلا هذه الإشارة **يُخفى الشريط من تحت اليد التي تمسكه**.
//
// ⚠️ **والامتناع العالق أسوأ من إخفاءٍ مبكّر** — الميزة تصير معطّلة صامتة، وهو
// «النجاح الكاذب» في #57 بثوبٍ آخر. و`mouseup` **قد لا يصل**: إفلاتٌ خارج
// النافذة · تبديل تبويب · إلغاء المؤشّر · فقدان تركيز النافذة.
// ⇒ **أربعة مخارج لا مخرج**، ولا يُترك واحدٌ منها للنيّة.
let idlePointerHeld = false;

function releaseIdlePointer() {
  if (!idlePointerHeld) return;
  idlePointerHeld = false;
  refreshIdleConsumers();
}

window.addEventListener("mousedown", (e) => {
  if (e.isTrusted === false) return;
  if (!pointerInsidePlayer(e)) return;
  idlePointerHeld = true;
  refreshIdleConsumers();
}, true);
window.addEventListener("mouseup", releaseIdlePointer, true);
window.addEventListener("pointercancel", releaseIdlePointer, true);
window.addEventListener("blur", releaseIdlePointer);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseIdlePointer();
});

// **(٢) الهدف يحوي عنصر التركيز.** ⚠️ **خرجت من القياس لا من التصميم**: الحالة 5
// أظهرت `focus: "DIV.ytp-progress-bar"` — **داخل الحاوية التي ننوي إخفاءها**.
// وإخفاءُ عنصرٍ يحمل `activeElement` **يكسر تنقّل لوحة المفاتيح لا العرض وحده**.
// وهي تغطّي `ytp-probably-keyboard-focus` **بلا أن تسمّيه**.
function focusInside(selector) {
  try {
    const a = document.activeElement;
    return !!(a && a.closest && a.closest(selector));
  } catch { return false; }
}

// المؤشّر داخل إطار المشغّل — بالمقيس القائم (`zoneRectForVideo` عبر
// `getVideoUnderPointer`)، **بلا محدِّد مضيف ولا صنف جديد**.
// ⚠️ **وملء الشاشة يُسقط سؤال «خارج المشغّل» بنيوياً**: المشغّل يملأ الشاشة،
// والقاعدة مكتوبة على **المستطيل** لا على «الصفحة»، فتصمد بلا استثناء.
// ⚠️ **وطبقتنا جزءٌ من المشغّل لغرض النشاط** — وإلا اختفى الزرّ من تحت الفأرة
// وهي عليه: `getVideoUnderPointer` تُرجع `null` فوق الزرّ **بالتصميم** (علامة
// الملكية تحجب مسار المربّعات)، فلو اكتفينا بها لعُدّ التحويم فوق زرّنا سكوناً.
function pointerInsidePlayer(e) {
  // ⚠️ **`.vzSpeedBtn` مذكورةٌ مع `.vzWrap` منذ #85:** الزرّ قد يعيش **داخل شريط
  // المضيف** لا داخل غلافنا، **وعلامةُ الملكية تجعل `getVideoUnderPointer` تُرجع
  // `null` فوقه بالتصميم** ⇒ **فبلا ذكره صراحةً يُقرأ التحويم عليه سكوناً**
  // ويختفي من تحت الفأرة — وهو انحدار 12ب من بابٍ جديد.
  try { if (e?.target?.closest?.(".vzWrap, .vzSpeedBtn, .vzFilterBtn, .vzFilterPanel")) return true; } catch {}
  return !!getVideoUnderPointer(e);
}

// **نقطة الدخول الواحدة لنشاط المؤشّر.** ويكفي أن تُنادى من
// `updatePointerFromEvent` لأن **كل مسارات الفأرة تمرّ بها**: الحركة والعجلة
// و`handleMouse` (كليك · أوكس · مِداوْن · قائمة السياق) تناديها في أول سطورها.
function noteIdleFromPointerEvent(e, moved) {
  if (!idleWanted) return;
  if (e.isTrusted === false) return;      // حدثٌ من صنعنا ليس نشاط مستخدم
  if (e.type === "mousemove") {
    if (!moved) return;                   // المصيدة (١)
    // خنقٌ للفحص وحده: مداه 100ms ومهلة السكون 500ms فأكثر، فلا أثر دلاليّ
    const t = nowMs();
    if (t - idleMoveCheckedAt < IDLE_MOVE_THROTTLE_MS) return;
    idleMoveCheckedAt = t;
  }
  if (!pointerInsidePlayer(e)) return;    // الخروج إلى الصفحة ليس نشاطاً
  markIdleActivity();
}

// الدخول إلى ملء الشاشة والخروج منه **فعلٌ من المستخدم على المشغّل بتعريفه**،
// والتخطيط يتبدّل كلّه — فيُعدّ نشاطاً بلا شرط موضع.
document.addEventListener("fullscreenchange", markIdleActivity);

// ── #70 — إخفاء شريط تحكّم يوتيوب كلّه بالسكون ──────────────────────────────
// ⛔ **معيارٌ مسحوب (قرار 21، 2026-08-03) — يُترك مشطوباً بسببه لا محذوفاً صامتاً:**
// ~~«أضيق مرشّح من ثمانية… **ولا يمسّ الوقت ولا زرّاً واحداً**»~~
// **سببُ السحب أنه لم يكن معيار صاحب المشروع بل معيار من كتبه.** وبنصّ المالك عند
// جلسة التحقّق: **«المفترض يختفي كل شيء، حتى الوقت والأزرار — هذا هو الغرض من
// إخفائه».** ⇒ **والكود كان يعمل كما وُصف؛ الوصف هو الذي خالف الغرض.**
// ⚠️ **والدرس أعمّ من البند: معيارٌ يُشتقّ من الكود يُرضي الكود.** الغرض يُسأل
// عنه صاحبُه **قبل** أن يُكتب المعيار، وإلا قِسنا إصابتنا لهدفٍ نصبناه بأنفسنا.
//
// **والهدف الجديد مقيسٌ سلفاً في خطّ الأساس نفسه — فلا قياس جديد يلزم:**
// `.ytp-chrome-bottom` يُخفي **الوقت والتشغيل والصوت والترجمة والإعدادات وملء
// الشاشة واليسرى واليمنى معاً**، في النافذة وملء الشاشة، و`dragsVideo:false`.
//
// **وطريقة الإخفاء من القياس كذلك: `opacity:0` كما يفعل المضيف** (مقيسٌ في
// الحالتين 3 و8 مع `ytp-autohide`)، **لا `display:none`** — فلا إعادة تدفّق،
// وسلوكٌ مطابقٌ لما يفعله المضيف نفسه. ومعها `pointer-events:none` **كي لا
// يُسحَب شريطٌ غير مرئيّ**.
//
// ⚠️ **وشرطا الامتناع يبقيان كما هما** (زرٌّ مضغوط · والتركيز داخل الهدف)، **ومداهما
// يتّسع مع الهدف بالبناء**: `focusInside` صار يشمل أزرار الشريط كلَّها، فمن وصل
// بـ`Tab` إلى زرّ الترجمة لا يُخفى من تحته — **وهو تحسينٌ تابع لا تغييرٌ ثانٍ**.
//
// ⚠️ **حدٌّ معروف — ونصفُه صار سؤالاً مفتوحاً بتغيّر الهدف:** قِيس أن `.ytp-popup`
// **خارج `.ytp-progress-bar-container`** فتبقى قائمة الإعدادات ظاهرة. **ولم
// يُقَس أنها خارج `.ytp-chrome-bottom`** — والخطوة 7 في `tools/CHECKLIST.md` هي
// التي تقطع فيه. **فلا يُكتب هنا ما لم يُقس** (قرار 26).
const YT_PROGRESS_SELECTOR = ".ytp-chrome-bottom";
const YT_PROGRESS_HIDE_CLASS = "vz-idle-hide-progress";
let ytProgressStyleEl = null;

// **#107 — الوضعُ الحاليّ، من الموضع الواحد.** مُطبَّعٌ عند التحميل، فلا يُعاد
// تطبيعُه هنا ولا في مسار الإظهار.
function progressBarMode() { return overlaySettings.progressBarMode || "off"; }

function progressHideActive() {
  if (!extensionActive()) return false;   // #64: الرئيسي ثم الحظر
  return progressBarMode() !== "off" && isYouTubeFamilyHost();
}

// **ورقةٌ تُحقَن مرّة وصنفٌ يُقلَب** — لا حقن/نزع عند كل انتقال: الانتقالات هنا
// كثيرة بطبعها، وكل حقنٍ يُعيد حساب الأنماط.
function ensureYtProgressCss() {
  if (ytProgressStyleEl?.isConnected) return;
  ytProgressStyleEl = document.createElement("style");
  ytProgressStyleEl.id = "vz_idle_progress_css";
  ytProgressStyleEl.textContent =
    `html.${YT_PROGRESS_HIDE_CLASS} ${YT_PROGRESS_SELECTOR}{` +
    `opacity:0 !important;pointer-events:none !important;}`;
  document.documentElement.appendChild(ytProgressStyleEl);
}

function setYtProgressHidden(on) {
  if (on) ensureYtProgressCss();
  document.documentElement.classList.toggle(YT_PROGRESS_HIDE_CLASS, !!on);
}

IDLE_CONSUMERS.progressBar = {
  enabled: progressHideActive,
  // **الهدف: ما نُخفيه** — فالمؤشّر عليه يمنع إخفاءه (#95)
  target: () => document.querySelector(YT_PROGRESS_SELECTOR),
  // **#106 — وهذا المستهلك وحدَه يُعلن هامشاً**: هدفُه شريطٌ ارتفاعُه 59px
  // **يُقصد بالمؤشّر قصداً**، فحافّتُه الحادّة عطبٌ في الاستعمال. ⛔ **ولم
  // يُعمَّم على المستهلكين**: هدفُ #72 زرٌّ ~40×40 **يُلاحقه المؤشّر لا يقصده**،
  // وهامشٌ 40 عمودياً **يُثلّث ارتفاعَ منطقته** ⇒ **تغييرُ سلوكٍ قائمٍ لم يُطلب**
  // (قرار 16: يُبلَّغ ولا يُنفَّذ).
  nearPad: () => IDLE_NEAR_PAD_PX,
  // **#107 — وفي «مخفيّ دائماً» حالُه تتبع موضعَ المؤشّر لا حالةَ المحرّك**،
  // فيُعلنها. ⛔ **وفي `idle` لا يُعلنها**: هناك يكفي أن تُقرأ لحظةَ الانتقال —
  // **فلا يدفع من لم يختر الوضعَ الجديد ثمنَه.**
  tracksPointer: () => progressBarMode() === "near",
  suspended: () =>
    // ⚠️ **شرطٌ ثالثٌ خرج من كتابة الاختبار لا من التصميم:** المحرّك يبدأ
    // **ساكناً** (المصيدة ٣) — وهو الصواب لزرّنا في #72 فلا يظهر بلا طلب،
    // **وعكسُه هنا**: صفحةٌ تُفتح والمؤشّر فوق المشغّل ⇒ نُخفي شريط المضيف
    // **فوراً وقبل أن تمضي مهلةٌ واحدة**. ⇒ **لا نلمس المضيف قبل أن نرى نشاطاً
    // ولو مرّة** — وهي دلالة «الإطفاء لا يُرجِع حالةً للوراء» في بوّابة #64.
    // **والمستهلكان يختلفان هنا بالضبط، وهذا ما بُني الحدّ المعماريّ لأجله.**
    //
    // ⭐⭐ **#107 — والسؤالُ طُرح فقُرئ ولم يُلغَ الشرطُ ولم يُبقَ بلا نظر
    // (طلب المالك): «مخفيٌّ دائماً» أتشمل ما قبل أوّل نشاط؟ نعم — وهما وضعان لا
    // وضعٌ واحد.** في `idle` **العلّةُ قائمة**: صفحةٌ لم يحوّم عليها أحدٌ لا تفقد
    // شريطَها بمبادرةٍ منّا. **وفي `near` تنقلب العلّة نفسُها**: المستخدم **طلب
    // الإخفاء دائماً**، ⇒ **فالإخفاءُ من أوّل لحظةٍ استجابةٌ لطلبه لا مبادرةً
    // عليه** — وشرطٌ يُبقي الشريطَ حتى أوّل حركةٍ **يجعل الوضعَ لا يُنفَّذ إلا
    // بعد أن يفعل المستخدم ما اشترى الوضعَ كي لا يفعله.**
    // ⇒ **فيبقى بنصّه في `idle`، ويسقط في `near` وحده.**
    (progressBarMode() !== "near" && idleLastActivityAt === 0) ||
    // والشرطان البنيويّان — ولا صنف مضيفٍ فيهما.
    // ⚠️ **ولا يتغيّران بالوضع** (شرط المالك): **«مخفيٌّ دائماً» لا تُلغي
    // القاعدة** — من أمسك الشريط ليسحب **لا يُخفى تحت يده**، ومن بلغه بـ`Tab`
    // لا يُخفى من تحته. **والحالان يمرّان بـ`onActive("suspended")` فيُظهران في
    // الوضعين معاً.**
    idlePointerHeld || focusInside(YT_PROGRESS_SELECTOR) ||
    // ⭐ **#108 — لوحةٌ مفتوحة ⇒ لا يُخفى الشريطُ تحتها** (شرط المالك):
    // **إعلانٌ من المستهلك، لا منطقٌ خاصّ في المحرّك.**
    vzFilterPanelOpen(),
  // ⭐ **#107 — السياسةُ هنا لا في المحرّك:** في `near` **يُخفى مع «نشاط»**،
  // ويُظهر مع «امتناع» أو «مؤشّرٍ على الهدف» ⇒ **لا تُرجعه حركةٌ ولا عجلةٌ ولا
  // أمرُ مربّع، ويُرجعه القربُ وحده.** وفي `idle` يُظهر في الثلاثة كما كان.
  // ⚠️ **والقربُ هو منطقةُ #106 نفسُها** — `nearPad` أعلاه، **ولا رقمَ ثانياً في
  // مسار الإظهار** (شرط المالك: رقمٌ واحد يخدم الحالتين، يُقرأ من موضعه).
  onActive: (why) => setYtProgressHidden(progressBarMode() === "near" && why === "active"),
  onIdle: () => setYtProgressHidden(true),
  // **إطفاؤه يعني: أعِد شريط المضيف** — نحن أخفيناه فنحن نردّه.
  onDisabled: () => setYtProgressHidden(false)
};
// ── #72 — زرّ السرعة في طبقتنا ──────────────────────────────────────────────
// **عجلةٌ فوقه تغيّر السرعة · نقرةٌ تختار سرعةً مفضّلة · ونقرة اليمين بعد `S9`.**
//
// ⚠️ **ولا يكتب `playbackRate` بيده — يُصدر أمراً من نحو `ACTION:SPEED` نفسه**
// (قرار المالك). **والحارس بنيويّ لا تذكّر**: `tools/test-speed-source.js` يعدّ
// مواضع الكتابة ويشترط **واحداً**، فمسارٌ يكتب بيده يُحمّر المجموعة. ومن ثَمّ
// **يرث شارة #71 بلا سطر**، ويرث القصّ 0.25–4 بلا رقمٍ ثانٍ.
//
// ⚠️ **ونقرة اليمين مؤجَّلة إلى `S9`** — مسارا `contextmenu` و`auxclick` **غير
// مقيسين** أمام معالج المضيف (قِيس الزرّ الأيسر وحده في `S6`)، **ولا يُبنى على
// غير مقيس**. فثلثُ الميزة معلَّق صراحةً لا منسيّاً.
const VZ_SPEED_STEP = 0.25;

function speedButtonActive() {
  if (!extensionActive()) return false;   // #64: الرئيسي ثم الحظر
  return barButtonOn(overlaySettings, "speed");   // #118 — من القائمة لا من مفتاحٍ مفرد
}

function speedBtnVideo() {
  return (vzOverlayVideo && vzOverlayVideo.isConnected)
    ? vzOverlayVideo
    : getVideoFromPointerPosition();
}

function syncSpeedBtnLabel(video) {
  if (!vzSpeedBtn) return;
  const v = video || speedBtnVideo();
    // #88 — **الرقم في عنصره**: الكتابة على الزرّ كانت ستمحو الأيقونة معه.
  const num = vzSpeedBtn.querySelector(".vzSpeedNum");
  if (v && num) num.textContent = `${v.playbackRate || 1}x`;
}

// ── #76 — **كل مستهلكٍ يضمن ما يحتاجه بنفسه** ───────────────────────────────
// **الدرس بنصّه: ميزةٌ تعتمد على مسارٍ لا تملكه.** كان الزرّ يحتاج عنصراً يبنيه
// **مسارُ المربّعات** (`ensureVideoOverlay` لها ستّة مواضع نداء، **ولا واحد منها
// في مسار السكون**)، فعلى صفحةٍ بلا ربطٍ لا يوجد — و`setSpeedBtnShown` كانت
// **تخرج من أوّل سطر** فتموت الميزة صامتة. **والنقرة كانت تُصلحه لأنها المسار
// الوحيد الذي يبني.**
// ⇒ **ولا يرث مستهلكٌ بناءً من جارٍ قد لا يمرّ** (قاعدة المالك 2026-08-02).
// ── #85 — **الزرّ في شريط المضيف، وسقوطٌ صريح إلى طبقتنا** ──────────────────
// ⛔ **نقضٌ لقرار المالك 2 («الطبقة لا الحقن») — على الغرض لا على الحجّة.**
// **الغرض:** زرٌّ **من** الشريط يظهر معه ويقف في صفّ أزراره — **والطبقة لا تعطيه
// ذلك مهما نضجت**. **والحجّة لم تسقط:** محدِّدات المضيف تموت (11 من 59 · #68).
// ⇒ ⭐ **وما بقي من الحجّة صمّم الشكل: يُحقن، وإن غاب الموضع سقط إلى الطبقة** —
// **والطبقة مبنيّةٌ وتعمل فالسقوط مجّانيّ**، ومحدِّدٌ يموت **يُنقص الأناقة ولا
// يُسقط الميزة**.
//
// ⚠️ **ولا حكم بنيويّ هنا (قرار المالك):** #65 نجح بنيوياً لأن «قابل للتمرير»
// **تعريفُ المتصفّح**، **ولا نظير لـ«صفّ أزرار التحكّم»** — فالاسم لا مفرّ منه.
// ⇒ **اسمٌ واحد بحدّه، لا قائمةَ مرشّحين:** قائمةٌ من ثلاثة **تموت واحداً واحداً
// بلا أن يُحمّر شيء**، وذاك أسوأ من اسمٍ واحد معلوم الحدّ.
//
// ⚠️ **والسقوط سلوكُ المستخدم، والأحمر خبرُنا نحن — وهما شيئان:**
// `bench-overlay-layer --youtube` **يُحمّر حين يموت الاسم**، فلا يسقط الزرّ
// صامتاً ونحن لا نعلم.
//
// **والمقيس على مشغّلٍ حيّ 2026-08-03 قبل أن يُكتب سطر:** الحاوية **288×40** ·
// **صفر إزالة** عبر إيقافٍ وقفزٍ وتشغيلٍ وقائمةٍ وملء شاشةٍ وخروج ·
// **والشريط لا يُعاد بناؤه: العقدة نفسها** — **وملء الشاشة يَنقُل ولا يبني**.
// ⇒ **فالثمن الذي حُذِّر منه يوم اخترنا الطبقة لم يقع، ومقيسٌ أنه لم يقع.**
const YT_CONTROLS_SELECTOR = ".ytp-right-controls";

// ── #96 — **الشريط يُطلب من نطاق هذا الفيديو، لا من المستند** ────────────────
// ⛔ **العطب كان حيّاً ويستره حارسٌ وُضع لغيره.** `document.querySelector` تُرجع
// **أوّل** شريطٍ في الصفحة أياً كان مشغّلُه: على شبكة معاينات أصابت شريطاً داخل
// `#movie_player` **ساكنٍ بمستطيل `0×0` لا صلة له بالفيديو المُحوَّم عليه** —
// **ولم يمنع الحقنَ في مشغّلٍ أجنبيّ إلا حارسُ المستطيل الصفريّ**، وصفحةٌ
// بمشغّلَين أحدهما مرئيّ تكشفه: يُحقن زرُّنا في شريط مشغّلٍ لا يُعالَج.
// ⇒ ⭐ **والعلاج يجعله مستحيلاً بالبناء لا محروساً** (قرار 16ج): الشريط من
// **نطاق الفيديو** فيسقط الأجنبيّ بلا حارس.
// ⚠️ **وحارسُ المستطيل الصفريّ يبقى — سببُه الأوّل قائم**: «مرئيّ» شرطٌ مقيس
// (`S7`)، **وسقوطُ سببٍ ثانٍ عليه لا يُلغي الأوّل**.
function speedBtnHostSlot(video) {
  if (!isYouTubeFamilyHost()) return null;
  try {
    const scope = playerScopeForVideo(video);
    if (!scope) return null;
    const box = scope.querySelector(YT_CONTROLS_SELECTOR);
    if (!box || !box.isConnected) return null;
    const r = box.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? box : null;   // مستطيلٌ صفريّ لا يُبنى عليه
  } catch { return null; }
}

// **الموضع يُعاد حسمه عند كل إظهار** — فالشريط قد يُبنى بعد أوّل ظهور.
// **موضعٌ واحد لزرَّين** (#108): الحقنُ إلى شريط المضيف وإلا السقوطُ إلى طبقتنا
// — **ولا نسخةَ ثانية من المنطق**، فزرٌّ ثالثٌ غداً يرثه بلا سطر.
function placeInHostBar(el, video) {
  if (!el) return "none";
  const slot = speedBtnHostSlot(video || speedBtnVideo());
  if (slot) {
    if (el.parentElement !== slot) slot.insertBefore(el, slot.firstChild);
    el.classList.add("vzInBar");
    return "bar";
  }
  if (vzOverlay && el.parentElement !== vzOverlay) vzOverlay.appendChild(el);
  el.classList.remove("vzInBar");
  return "layer";
}

function placeSpeedBtn(video) {
  if (!vzSpeedBtn) return "none";
  const r = placeInHostBar(vzSpeedBtn, video);
  applyBarOrder();
  return r;
}

// ── #118 — **السجلُّ الواحد للأزرار، والترتيبُ يقع على الحقن لا في معاينة** ──
// ⭐ **زرٌّ ثالث مدخلٌ واحد هنا** — لا قائمةٌ في المحرِّر وأخرى في الحقن تتباعدان
// (وهو درسُ `CLEAN_PLAYER_ITEMS`/`CLEAN_PLAYER_OPTIONS` وحارسِهما).
const BAR_BUTTONS = {
  speed:  { el: () => vzSpeedBtn,  label: "زرّ السرعة" },
  filter: { el: () => vzFilterBtn, label: "زرّ الفلاتر" },
  // #134 — **والثالثُ لم يحتج في المحرِّر سطراً**: ثلاثةُ سجلّاتٍ وحدها
  // (`BAR_BUTTON_IDS` · هذا · `VZ_BAR_BUTTONS`)، **و`applyBarOrder` عامّةٌ بلا أسماء.**
  copy:   { el: () => vzCopyBtn,   label: "زرّ نسخ الرابط" }
};

// ⛔⭐ **الترتيبُ يُطبَّق على العناصر المحقونة نفسِها** (شرط المالك): معاينةٌ
// تُظهر ترتيباً والشريطُ يُظهر غيرَه **وعدٌ بما لا يقع**.
// **والآليّة:** يُمشى على القائمة **بالعكس**، وكلٌّ يُدرَج عند رأس الحاوية ⇒
// **فأوّلُ القائمة يستقرّ أوّلاً في الشريط**. ⚠️ **ولا يُلمس عنصرٌ ليس في
// حاويتنا ولا في الشريط** — التحريكُ يقع بين إخوةٍ نملكهم.
// ⚠️⚠️ **وحدُّه مقيسٌ ومكتوب: في طبقتنا لا يقع ترتيب** — `.vzBtn` كلاهما
// `position:absolute; right:10px; bottom:10px` ⇒ **يتراكبان** (مقيسٌ 2026-08-07:
// `سرعة x=682 w=64` و`فلاتر x=702 w=44`، **والحافّة اليمنى واحدة**).
// ⇒ **فالترتيبُ للشريط وحدَه، وهو بندٌ مسجَّل (#119) لا حالةٌ تُرتَّب.**
// ⛔⭐⭐ **العطبُ الذي وُلد منه هذا الشكل (#121، عطبٌ حيّ عند المالك 2026-08-07):**
// كانت الحلقةُ تمشي بالعكس وتُدرج كلَّ عنصرٍ عند رأس الحاوية، **وحارسُها
// `slot.firstChild !== el` يفحص الموضعَ الأوّل وحدَه لا موضعَ العنصر** ⇒
// **فتُنقل كلُّ عقدةٍ في كلّ نداء، ولو كان الترتيبُ صحيحاً سلفاً.**
// **والمقيس: عقدتان في كلّ نداء، في ثلاثة نداءاتٍ متتالية.**
//
// ⇒ ⭐⭐ **وأثرُه عند المستخدم كان في الحدث لا في الرسم:** هذي الدالّة تُنادى من
// مسار السكون **عند كلّ نشاط** (حركةُ مؤشّرٍ مخنوقةٌ إلى عشر مرّاتٍ في الثانية)
// ⇒ **فالعقدةُ تُنزع وتُعاد بين `mousedown` و`mouseup`** ⇒ **والمتصفّح لا يُولّد
// `click` لعنصرٍ لم يبقَ موصولاً بين الضغطتين.** ⇒ **والعجلةُ تنجو لأنها حدثٌ
// واحد بلا زوج** — **وهو الفاصلُ الذي وصفه المالك بحرفه.**
// ⇒ ⛔ **ولم يكن فقدَ مستمعات**: `insertBefore` **ينقل ولا ينسخ**، **والمستمعان
// على العقدة نفسِها** — **ففرضيّةُ النسخ سقطت بسندين مستقلَّين.**
//
// ⇒ **والشرط الآن: صفرُ تحويلٍ في الشجرة حين يستقيم الترتيب** — **ويحرسه
// `tools/test-bar-order.js` بالعدّ لا بالنظر.**
function applyBarOrder() {
  const list = barButtonsOf(overlaySettings);
  const mine = [];
  for (const it of list) {
    const el = BAR_BUTTONS[it.id]?.el?.();
    if (el && el.classList.contains("vzInBar") && el.parentElement) mine.push(el);
  }
  if (mine.length < 2) return;              // **واحدٌ لا يُرتَّب، ولا يُلمس**
  const slot = mine[0].parentElement;
  if (mine.some((el) => el.parentElement !== slot)) return;   // حاويتان ⇒ لا حكم
  // **الترتيبُ الحاليّ لعناصرنا وحدَها** — وأزرارُ المضيف بينها لا تُحصى ولا تُمسّ
  const now = [...slot.children].filter((el) => mine.includes(el));
  if (now.length === mine.length && now.every((el, i) => el === mine[i])) return;   // ⭐ لا تحويل
  // ويقع النقلُ مرّةً واحدة حين يتغيّر الترتيب فعلاً: كلٌّ قبل تاليه
  for (let i = mine.length - 2; i >= 0; i--) {
    if (mine[i].nextSibling !== mine[i + 1]) slot.insertBefore(mine[i], mine[i + 1]);
  }
}

// #108 — والزرُّ الثاني يمرّ بالمسار نفسِه
function setFilterBtnShown(on) {
  let video = null;
  if (on) {
    if (!buttonsAllowedHere()) on = false;   // #116
  }
  if (on) {
    video = speedBtnVideo();
    if (!video) return;
    if (!videoOwnsControls(video)) on = false;   // #94 — فيديوٌ يملك أدواته
    else if (isInMiniPlayer(video)) on = false;   // #149 — مشغّلٌ مصغّر: لا نرسم فيه
    else ensureVideoOverlay(video);
  }
  if (!vzFilterBtn) return;
  if (on) { placeInHostBar(vzFilterBtn, video); applyBarOrder(); }
  vzFilterBtn.classList.toggle("vzHidden", !on);
  if (!on) setFilterPanelOpen(false);            // زرٌّ يختفي ⇒ لوحتُه تُغلق معه
  if (on) startOverlayTracking();
}

// **قراءةُ الموضع لا إعادةُ وضعه** — `placeSpeedBtn` تُحرّك، وهذي تُخبر.
function speedBtnPlacement() {
  if (!vzSpeedBtn) return "none";
  return vzSpeedBtn.classList.contains("vzInBar") ? "bar" : "layer";
}

// ── #116 — **الزرّان ليوتيوب وحدَه** (قرار المالك 2026-08-06) ───────────────
//
// **الشكوى بنصّها:** زرٌّ يُرسم في **تيك توك** — **لا في مدوّنةٍ تعرض يوتيوب**.
// ⇒ **وحجّةُ المالك في اختيار البوّابة الأوسع: «عادي طالما الفيديو من اليوتيوب»**
// ⇒ `isYouTubeFamilyHost()` **لا `isYouTubeHost()`** — **وحجّتُه يومَها أن
// التضمين سطحٌ يعملان فيه.**
// ⛔⭐ ~~**التضمينُ سطحٌ يعملان فيه اليوم**~~ — **مسحوبٌ 2026-08-07 (قرار 21)
// بقياسٍ ميدانيّ: في التضمين لا يظهر أيُّ زرّ عند المالك.**
// ⚠️ **والمقيسُ «لم يظهر» لا «لا يمكن»** — **السببُ غيرُ مقيس**: أيُحقن سكربتُنا
// في ذلك الإطار أصلاً؟ **لم يُسأل ولم يُقس**، **ولا يُكتب خبرٌ عن آليّةٍ لم تُقَس.**
// ⛔ **والبوّابةُ تبقى كما هي بقرار المالك** («لا يهمّ، لو فتحتُ يوتيوب أجد
// الأزرار في مشغّله») ⇒ **فالوصفُ يُصحَّح والكودُ لا يُلمس** —
// ⭐ **وهي أوّلُ مرّةٍ يُصحَّح فيها سندُ بوّابةٍ ويبقى حكمُها بقرارٍ صريح.**
//
// ⛔⭐ **وثلاثةُ مساراتٍ ظُنّت «لغير يوتيوب» فتموت — والقياسُ قال إنها يوتيوبيّة**
// (قرار 117، **ولا يُحذف منها شيء**):
//   · **السقوطُ إلى طبقتنا** — لسطح التضمين الذي هجر عائلة `ytp`.
//   · **حكمُ «فيديوٌ يملك أدواته»** — **لمعاينة يوتيوب** التي تحمل
//     `ytp-hide-controls` بنصّها.
//   · **والتثبيتُ على أوّل نجاح** — لأن يوتيوب يُخفي شريطَه بعد ~3 ثوانٍ.
//
// ⚠️ **وموضعُها هنا لا في `videoOwnsControls`:** تلك تُجيب «أيملك هذا الفيديو
// أدواته؟» **وهو سؤالٌ لا علاقةَ له بالمضيف** — **وخلطُ البوّابة بالحكم يجعل
// حكماً مقيساً يُقرأ سياسةً**، وهو الحدُّ المعماريّ نفسُه (المستهلك يُعلن،
// والمحرّك يسأل ولا يعرف لماذا).
function buttonsAllowedHere() {
  return isYouTubeFamilyHost();
}

function setSpeedBtnShown(on) {
  let video = null;
  if (on) {
    if (!buttonsAllowedHere()) on = false;   // #116 — **إخفاءٌ لا `return`** (علّةُ #94 نفسُها)
  }
  if (on) {
    video = speedBtnVideo();
    if (!video) return;            // لا فيديو ⇒ لا زرّ، وهو الصواب
    // ── #94 — **الشرط الموجب: فيديوٌ يملك أدواته** ─────────────────────────
    // ⚠️ **إخفاءٌ لا `return`:** المؤشّر ينتقل من مشغّلٍ حقيقيّ إلى معاينة **بلا
    // أن يمرّ سكون**، فلو خرجنا صامتين لبقي الزرّ معروضاً فوقها — وهو العَرَض
    // نفسه الذي نعالجه.
    if (!videoOwnsControls(video)) on = false;
    // #149 — **مشغّلٌ مصغّر: لا نرسم فيه.** وأزرارُه الثلاثة (تشغيلٌ وإغلاقٌ
    // وتوسيع) تُمرِّر شرطَ #94 الموجب — **وهي أدواتُ نافذةٍ لا أدواتُ مشغّل.**
    else if (isInMiniPlayer(video)) on = false;
    else ensureVideoOverlay(video);   // ⭐ يضمن عنصره قبل أن يطلبه
  }
  if (!vzSpeedBtn) return;
  if (on) { placeSpeedBtn(video); syncSpeedBtnLabel(video); }
  vzSpeedBtn.classList.toggle("vzHidden", !on);
  if (on) startOverlayTracking();
}

// الزرّ يظهر **مع النشاط** كما يفعل شريط المضيف، ويختفي بالسكون. ولا شرط امتناع:
// **استثناء التوقّف سقط بالقياس** — يوتيوب يُخفي شريطه وهو متوقّف (الحالة 3)،
// **والقاعدة الواحدة بلا استثناء أفضل** (حكم #65).
// ── 12ب — **لا نُخفي شيئاً تحت يد المستخدم**، وهي ثالثة تطبيقاتها ───────────
// **المبدأ نفسه المطبَّق مرّتين في #70**: زرٌّ ممسوك (`idlePointerHeld`) وتركيزٌ
// داخل الحاوية (`focusInside`) — **وهذي ثالثتها، لا استثناءٌ جديد.**
//
// **والحجّة مقيسة لا ذوقية:** يوتيوب نفسه **لا يُخفي تحت مؤشّرٍ ساكن** — الحالة 1
// من قياس الحالات الثماني (صنفُ التحويم على الشريط · `cursor:auto` · ظاهرٌ بعد
// ستّ ثوانٍ) مقابل الحالة 3 حين يبعد المؤشّر. **فنحن نطابق المضيف لا نزيد عليه.**
// **والعَرَض حقيقيّ:** يقصد المستخدم الزرَّ ويقف ليقرأ «1x» **فيختفي قبل أن ينقر**.
//
// ⚠️ **ولا مستمع جديد ولا صنف مضيف:** `lastPointer` قائمة، والمستطيل يُقرأ عند
// السؤال. **وحارسُ المستطيل الصفريّ شرطٌ لا تفصيل** (قرار 22): زرٌّ مخفيّ
// مستطيلُه `0×0`، فلولاه **لأحيا نفسه** — يُخفى فيصير صفريّاً فيُقرأ «المؤشّر
// خارجه»… بل الأخطر عكسُه: مستطيلٌ صفريّ عند `0,0` يحتوي مؤشّراً لم يتحرّك بعد.

// ── #108 — لوحةُ فلاتر بصرية: زرٌّ في شريط المضيف ولوحةٌ من سجلٍّ واحد ────────
// **الفلاتر مجموعتان**: الأساسية (إضاءة · تباين · تشبّع · **جاما**) وتحتها
// الباقية. **والسجلُّ هو الموضع الواحد**: منه تُرسم الصفوف، ومنه تُبنى السلسلة،
// ومنه تُقرأ الافتراضات ⇒ **المسافة بين الراسم والكاتب صفر** (قرار 16د).
//
// ⭐⭐ **والجاما ليست من فلاتر CSS — فلتر SVG (`feComponentTransfer` · `gamma`)،
// وهي جوهرُ الطلب:** **الإضاءةُ ترفع كلَّ شيء فتبهت الصورة، والجاما ترفع الظلالَ
// وحدها ويبقى الأبيضُ مكانه.** ⚠️ **والفرقُ مكتوبٌ في وسمها، فمن رآهما متشابهين
// استعمل الخطأ.**
//
// ⛔⭐ **وثمنُ الجاما مقيسٌ (2026-08-05) فبُني عليه الشكل:** على فيديو بملء نافذة
// 1920×1080@60، **CSS ≈ −2fps من 60 (~3%) ثابتاً في ثلاث عيّنات**، **وفلترُ SVG
// وحدَه 41 · 53.25 · 42.5** — **أثقلُ بندٍ قِيس، يقارب `blur(16px)` أو يفوقه.**
// ⇒ ⭐ **فلا يدخل فلترُ SVG السلسلةَ إلا إذا غادرت الجاما قيمتَها الافتراضية**
// (قرار المالك): **الأساسيّةُ بلا جاما تبقى عند ~3%، والثمنُ يُدفع عند طلبه وحده.**
// ⚠️ **وحدود الرقم تُقتبس معه أو لا يُقتبس:** مصدرٌ مصطنَع بلا فكّ ترميز · جهازٌ
// واحد · حملٌ واحد · **والترتيبُ انقلب عند حملٍ أعلى** (ستّة فيديوهات: CSS 10.25
// ⇄ SVG 14) ⇒ **قياسٌ عند حملٍ واحد لا ترتيبٌ عامّ.**
// ⚠️ **والتقلّبُ أهمُّ من المتوسّط (قرار المالك): المستخدم يرى التقطيع لا المعدّل**
// — **وثباتُ 48 أهونُ على العين من تأرجحٍ بين 41 و53.**
// ⚠️ **وملاحظةٌ غير مفسَّرة تُسجَّل ولا تُملَّس:** `CSS+SVG` معاً **ثابت**
// (49 · 48.5 · 48.5) **و`SVG` وحدَه متقلّب** — **لا تفسيرَ عندنا، وقد تكون خيطاً.**
//
// ⛔ **وثلاثةٌ خارج النطاق بقرار المالك لا بسهو:** **لا سرعةَ في اللوحة** (زرُّها
// قائم، ووضعُها هنا موضعان لقيمةٍ واحدة) · **ولا Experimental Shaders إطلاقاً**
// (تلك ترسم الفيديو من جديد على `canvas` بـWebGL — **آلةٌ ثانية كاملة لا فلترٌ
// سطراً**) · **ولا `opacity`** (فائدتُها قليلة وتتداخل مع طبقتنا).
//
// ⚠️ **والأيقونة: طلب المالك `filter-h` — ولا وجودَ لها في `tools/icons.js` ولا
// في أصله `tools/icons.html`** (التسعةَ عشرَ فيهما: `enhance` · `flip-h` · …).
// ⇒ **فلم تُرسم جديدة ولم يُخترع اسم** (قرار 16): **استُعملت `enhance` — أقربُ
// الموجود معنىً — وتُبدَّل بسطرٍ واحد متى سمّى المالك غيرَها.**
// ⭐ **والعرضُ نِسَبٌ للمضروبة ووحدةٌ صريحة لغيرها** (قرار 110): النسبةُ **تقول
// للمستخدم أين هو من الافتراض** و«1» لا تقول. ⛔ **ودرجةُ اللون درجاتٌ والضبابيةُ
// بكسلات** — **وفرضُ نسبةٍ عليهما يقول ما ليس صحيحاً**، فالوحدةُ من طبيعة المقيس.
// ⚠️ **والوسمُ يقول ما يفعله الضابط، والشرحُ ليس فيه** (#77): وسمٌ يحمل شرحَه
// **يكسر صفَّ السطر الواحد بالبناء** — **وشرحُ الجاما في تلميح الميزة بصفحة
// الإعدادات، حيث يوجد وصفُها أصلاً** (⇊ ولماذا لا قناةَ تلميحٍ هنا).
const pct = (v) => `${Math.round(v * 100)}%`;
const VZ_FILTER_ITEMS = [
  { key: "brightness", group: "basic", label: "الإضاءة", min: 0.2, max: 2, step: 0.05, def: 1,
    css: (v) => `brightness(${v})`, fmt: pct },
  { key: "contrast", group: "basic", label: "التباين", min: 0.2, max: 2, step: 0.05, def: 1,
    css: (v) => `contrast(${v})`, fmt: pct },
  { key: "saturate", group: "basic", label: "التشبّع", min: 0, max: 3, step: 0.05, def: 1,
    css: (v) => `saturate(${v})`, fmt: pct },
  { key: "gamma", group: "basic", label: "الجاما", min: 0.4, max: 2.2, step: 0.05, def: 1,
    svg: true, fmt: pct },
  { key: "hue", group: "more", label: "درجة اللون", min: 0, max: 360, step: 1, def: 0,
    css: (v) => `hue-rotate(${v}deg)`, fmt: (v) => `${v}°` },
  { key: "grayscale", group: "more", label: "أبيض وأسود", min: 0, max: 1, step: 0.05, def: 0,
    css: (v) => `grayscale(${v})`, fmt: pct },
  { key: "sepia", group: "more", label: "سيبيا", min: 0, max: 1, step: 0.05, def: 0,
    css: (v) => `sepia(${v})`, fmt: pct },
  { key: "invert", group: "more", label: "قلب الألوان", min: 0, max: 1, step: 0.05, def: 0,
    css: (v) => `invert(${v})`, fmt: pct },
  { key: "blur", group: "more", label: "ضبابية", min: 0, max: 12, step: 0.5, def: 0,
    css: (v) => `blur(${v}px)`, fmt: (v) => `${v}px` }
];
const VZ_FILTER_GROUPS = [{ id: "basic", label: "الأساسية" }, { id: "more", label: "المزيد" }];
const VZ_GAMMA_ID = "vz_gamma_filter";

let vzFilterValues = null;      // تُبنى من السجلّ، وتزول مع كلّ فيديو
let vzFilterOn = true;          // مفتاحُ اللوحة: يُوقف الفلتر كلَّه **ولا يُضيّع القيم**
// ⛔⭐ **الفيديو الذي تحمله حالتُنا — لا العنصرُ الذي بُنيت عليه الطبقة** (#108).
// **الجذرُ المقيس:** كانت الحالةُ مربوطةً بـ`vzOverlayVideo` **ولا شيءَ يُنبّهها
// حين يتبدّل ما يُشاهده المستخدم** ⇒ **ثلاثةُ أعراض من جذرٍ واحد:** فلترٌ يبقى
// عبر انتقال يوتيوب الداخليّ (**المصدرُ يتبدّل والعنصرُ باقٍ**) · وحالةٌ لا
// تُصفَّر عند استبدال العنصر · **ولوحةٌ حيّةٌ عاطلة** تكتب على عنصرٍ ميّت.
let vzFilteredVideo = null;

function filterButtonActive() {
  if (!extensionActive()) return false;   // #64: الرئيسي ثمّ الحظر
  return barButtonOn(overlaySettings, "filter");  // #118
}

function vzFilterDefaults() {
  const o = {};
  for (const it of VZ_FILTER_ITEMS) o[it.key] = it.def;
  return o;
}

function vzFilterPanelOpen() {
  return !!vzFilterPanel && !vzFilterPanel.classList.contains("vzHidden");
}

// ── #109 — **حفظُ الفلاتر بأسماء** (طلب المالك 2026-08-08) ────────────────────
//
// ⭐ **سببُ البند من قرار المالك نفسِه:** الفلترُ **يزول مع كلّ فيديو** بطلبه، **فكلُّ
// مقطعٍ مظلمٍ يُعاد ضبطُه** ⇒ **فالحفظُ ثمنُ ذلك القرار لا زينةٌ فوقه.**
//
// ⛔⭐⭐ **والعقد: التطبيقُ استبدالٌ لا دمج.** ما ليس في المدخل **يعود إلى افتراضه**
// — **وإلا بقيت بقايا الفلتر السابق تحت الجديد فيرى المستخدم نتيجةً لم يحفظها ولا
// يعرف من أين جاءت.** ⚠️ **وهو أخطرُ ما في الشكل المتفرّق، فثُبّت بشاهدٍ لا بوسم**
// (`tools/test-filter-presets.js`).
//
// ⛔ **والمخزَّن متفرّق** — ما غادر افتراضَه وحدَه، **كنمط `cleanPlayer.items` القائم**:
// **مقيسٌ 2026-08-08: 95 بايتاً للمدخل الشائع مقابل 179 للكامل (أرخصُ بـ47٪)**،
// **ويحتمل مفتاحاً عاشراً غداً بلا هجرة.**
//
// ⛔⭐ **والسكنى داخل `settings` قرارُ مالكٍ بالأرقام لا بالحدس** (2026-08-08):
// **مقيسٌ بقيادة صفحة الإعدادات: `settings` = 1416 بايتاً** (بمحاسبتنا وبمحاسبة
// كروم، متطابقتين)، **والمتاح 8192 − 1416 = 6776 ⇒ 71–101 مدخلاً بالمتفرّق** —
// **عددٌ لا يبلغ أحدٌ نصفَه.** ⇒ **وتدخل النسخةَ الاحتياطية مجّاناً** (المُصدِّر
// يأخذ `settings` كلَّها)، **بدل مفتاحٍ مستقلٍّ يُنسى سطرُه في النسخة.**
// ⚠️⚠️ **وثمنُها يُكتب هنا صريحاً كي لا يُشخَّص بعد سنة: قائمةٌ تبلغ السقف تمنع حفظَ
// أيّ إعدادٍ آخر — لا الفلاتر وحدَها**، لأن `settings` عنصرٌ واحد في حساب كروم.
// ⚠️ **وحدُّ الرقم: قِيس على إعداداتٍ لم يُخصَّص فيها مربّعٌ ولم يُحجب موقع**،
// **و`zones` (894 بايتاً) هو الجزء الذي ينمو بيد المستخدم — ونموُّه غيرُ مقيس.**
const VZ_FILTER_PRESETS_MAX_NAME = 40;

// ── #137 — **مدخلٌ جاهزٌ موجودٌ من أوّل مرّة** (طلب المالك 2026-08-08) ──────────
//
// ⭐ **غرضُه ليس تكرارَ «إرجاع الكلّ»**: القائمةُ فارغةٌ عند أوّل فتح ⇒ **فالقائمةُ
// وزرّا التطبيق والحذف ضوابطُ ميتة، وميزةٌ لا تُرى لا تُستعمل** — **والمدخلُ يجعل
// الميزةَ مقروءةً من أوّل لحظة.**
//
// ⛔⭐⭐ **ويُشتقّ من سجلّ الافتراضات ولا يُخزَّن** (وهو أهمُّ شروطه): **مدخلٌ
// مخزَّنٌ بقيمٍ منسوخة يتباعد عن الافتراضات يومَ يتغيّر افتراضٌ واحد** ⇒ **فيصير
// «الافتراضيّ» ليس الافتراضيّ** — **وهو موضعان لحقيقةٍ واحدة في بندٍ عن الحفظ.**
// ⇒ **وقيمتُه `{}` بحرفها، فالاستبدالُ يُرجع التسعةَ إلى افتراضها بالبناء**،
// **ولا يستهلك بايتاً من الحصّة.**
// ⛔ **ولا يُحذف ولا يُكتب فوقه**، **وزرُّ الحذف لا يُعرض عليه أصلاً — لا مُعطَّلاً**:
// **ضابطٌ يُضغَط ولا يفعل شيئاً هو ما نمنعه** (#24)، **وغيابُه أصدقُ من تعطيله.**
// ⚠️ **والمعرّفُ لاتينيّ والوسمُ عربيّ** — **وقسمةُ المعرّف عن الوسم قائمةٌ في كلّ
// سجلٍّ عندنا** (`VZ_UI_TIMING` · `VZ_BAR_BUTTONS` · `CLEAN_PLAYER_ITEMS`).
// ⚠️ **وقيمةُ الخيار مسبوقةٌ بحرفٍ يفصل المبنيَّ من المخزَّن** (`b:` · `s:`)
// — **فاسمٌ مخزَّنٌ يطابق الوسمَ لا يلتبس به في الكود.** ⚠️ **وحدُّه مُعلَن: مدخلٌ
// مخزَّنٌ بالاسم نفسِه (من نسخةٍ مستوردة) يظهر بجواره ويبقى قابلاً للحذف** —
// ⛔ **ولا يُحذف من تحت المستخدم** (قرار 6: لا حذفَ تلقائيّ).
const VZ_FILTER_BUILTIN = { id: "default", label: "افتراضي" };
const VZ_PRESET_BUILTIN_VALUE = `b:${VZ_FILTER_BUILTIN.id}`;

// ⛔ **الرقمُ نسخةٌ من `SYNC_ITEM_LIMIT` في `storage.js`، لا منطقٌ ثانٍ** — سكربتُ
// المحتوى لا يستطيع تحميل `storage.js`. **ويحرس تطابقَهما `tools/test-filter-presets.js`**
// ⇒ **فتخلّفُه يُحمّر ولا يقع صامتاً.** ⭐ **ونُسخ الرقمُ وحدَه لا الحارسُ كلُّه:
// كتلةٌ مُقترنةٌ خامسة ثمنُها أكبر من فحصِ سقفٍ واحد.**
const VZ_SYNC_ITEM_LIMIT = 8192;

let vzFilterPresets = [];

// **المتفرّق: ما غادر افتراضه وحدَه** — والسجلُّ هو المصدر، فلا قائمةَ ثانية تُكتب.
function vzFilterSparse(values) {
  const v = values || vzFilterValues || vzFilterDefaults();
  const out = {};
  for (const it of VZ_FILTER_ITEMS) {
    const n = Number(v[it.key]);
    if (Number.isFinite(n) && n !== it.def) out[it.key] = n;
  }
  return out;
}

// ⛔⭐⭐ **الاستبدالُ لا الدمج** — الافتراضاتُ أوّلاً ثمّ المحفوظ فوقها.
// **ولا تُقرأ `vzFilterValues` هنا بحال**: قراءتُها هي الدمجُ بعينه.
function vzFilterValuesFromPreset(preset) {
  const out = vzFilterDefaults();
  const saved = preset?.v || {};
  for (const it of VZ_FILTER_ITEMS) {
    if (!Object.prototype.hasOwnProperty.call(saved, it.key)) continue;
    const n = Number(saved[it.key]);
    if (!Number.isFinite(n)) continue;               // قيمةٌ فاسدة ⇒ الافتراض
    out[it.key] = Math.min(it.max, Math.max(it.min, n));   // والمدى يُفرض عند القراءة
  }
  return out;
}

// ⚠️ **والتطبيقُ يُشغّل المفتاحَ إن كان مطفأً** (قرار المالك 2026-08-08): **وإلا
// طبّق المستخدمُ فلتراً فلم يرَ شيئاً — وذاك «لا أثرَ بلا خطأ».**
// ⭐ **والحالُ التي يعالجها واحدة ومقيسة:** `resetVideoFilter` تُعيد `vzFilterOn = true`
// مع كل فيديو ⇒ **فالوحيدةُ الباقية: أطفأه بيده ثمّ طبّق في الفيديو نفسِه.**
// ⚠️ **وثمنُه مكتوبٌ في وسم المفتاح** — **ضابطٌ يتغيّر بلا أن يلمسه أحد هو ما نطارده.**
function applyFilterPreset(preset) {
  if (!preset) return;
  vzFilterValues = vzFilterValuesFromPreset(preset);
  vzFilterOn = true;
  syncFilterPanel();
  applyVideoFilter();
}

// ⛔ **الكتابةُ الوحيدة إلى التخزين من سكربت المحتوى** — **وتفحص السقفَ قبلها لا
// بعدها**: `safeSyncSet` لا يبلغها، **فلا يُترك الفشلُ صامتاً** (وهو ما بُني
// `safeSyncSet` نفسُه لمنعه). ⇒ **وتُرجع سبباً يُعرض للمستخدم، ولا تُرجع نجاحاً
// لم يقع** (جرد #57: نجاحٌ كاذب أسوأ من فشلٍ صامت).
async function persistFilterPresets(list) {
  try {
    const data = await chrome.storage.sync.get({ settings: {} });
    const next = { ...(data.settings || {}), filterPresets: list };
    const bytes = new TextEncoder().encode("settings" + JSON.stringify(next)).length;
    if (bytes > VZ_SYNC_ITEM_LIMIT) return { ok: false, msg: "لا مساحة — احذف محفوظاً" };
    await chrome.storage.sync.set({ settings: next });
    vzFilterPresets = list;
    return { ok: true };
  } catch (e) {
    console.debug("[VZ] #109: تعذّر حفظ الفلاتر:", e);
    return { ok: false, msg: "تعذّر الحفظ" };
  }
}

function loadFilterPresetsFrom(settings) {
  const raw = (settings || {}).filterPresets;
  vzFilterPresets = Array.isArray(raw)
    ? raw.filter((p) => p && typeof p.n === "string" && p.n).map((p) => ({ n: p.n, v: p.v || {} }))
    : [];
}

// **السلسلة تُبنى من السجلّ**: ما لم يغادر افتراضه لا يدخلها أصلاً ⇒ **لا يُدفع
// ثمنُ فلترٍ لم يطلبه أحد**، والجاما خاصّةً (انظر القياس أعلاه).
function vzFilterChain() {
  const v = vzFilterValues || vzFilterDefaults();
  const parts = [];
  let gamma = null;
  for (const it of VZ_FILTER_ITEMS) {
    const val = Number(v[it.key]);
    if (!Number.isFinite(val) || val === it.def) continue;
    if (it.svg) { gamma = val; continue; }
    parts.push(it.css(val));
  }
  return { parts, gamma };
}

// **ورقةُ الجاما تُحقن في شجرة الفيديو نفسِه** — `url(#id)` لا يعبر حدود الظلّ،
// فحقنُها في المستند وحدَه يجعلها لا تُحلّ لفيديو داخل `shadowRoot`.
function ensureGammaFilter(video, exponent) {
  const root = video?.getRootNode?.() || document;
  const host = root === document ? (document.body || document.documentElement) : root;
  if (!host) return null;
  let svg = root.getElementById ? root.getElementById(VZ_GAMMA_ID) : null;
  if (!svg || !svg.isConnected) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", VZ_GAMMA_ID);
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    const f = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    f.setAttribute("id", VZ_GAMMA_ID + "_f");
    f.setAttribute("color-interpolation-filters", "sRGB");
    const t = document.createElementNS("http://www.w3.org/2000/svg", "feComponentTransfer");
    for (const ch of ["feFuncR", "feFuncG", "feFuncB"]) {
      const fn = document.createElementNS("http://www.w3.org/2000/svg", ch);
      fn.setAttribute("type", "gamma");
      t.appendChild(fn);
    }
    f.appendChild(t);
    svg.appendChild(f);
    host.appendChild(svg);
  }
  // **الأسّ مقلوبٌ عن القيمة**: قيمةٌ أكبر من 1 تعني «أوضح»، والأسُّ الأصغر يُوضّح.
  const exp = (1 / Math.max(0.2, Number(exponent) || 1)).toFixed(3);
  svg.querySelectorAll("feFuncR,feFuncG,feFuncB").forEach((fn) => fn.setAttribute("exponent", exp));
  return VZ_GAMMA_ID + "_f";
}

// ⛔⭐ **الفلترُ على `<video>` وحدَه — أبداً على سلف. وهذا قيدٌ بنيويّ لا تفضيل:**
// `filter` على عنصرٍ **يُنشئ سياقَ احتواء** يبتلع `position:fixed` من نسله ⇒
// **وطبقتُنا تُلحَق بعنصر ملء الشاشة**، فلو فُلتِرَت الحاويةُ **لَتلوّنت شبكتُنا
// وشاراتُنا معها ولانزاح موضعُها**. ⚠️ **فمن نقله إلى الحاوية بعد سنةٍ «تبسيطاً»
// يكسر شيئاً لا يربطه به أحد** (طلب المالك أن يُكتب هنا لا في سجلّ بند).
function applyVideoFilter(video) {
  // **الفيديو الجاري لا الذي بُنيت عليه الطبقة** — و`speedBtnVideo` هي النمط
  // القائم (حارسُ `isConnected` ثمّ سقوطٌ إلى المؤشّر)، **ولا نمطَ ثانٍ يُكتب**.
  const v = video || speedBtnVideo();
  if (!v || !v.isConnected) return "";
  // **وتبدّلُ الهُويّة تصفيرٌ**: ما نحمله كان لفيديوٍ آخر (#108)
  if (vzFilteredVideo && vzFilteredVideo !== v) { resetVideoFilter(vzFilteredVideo); return applyVideoFilter(v); }
  vzFilteredVideo = v;
  if (!filterButtonActive() || !vzFilterOn) { v.style.filter = ""; return ""; }
  const { parts, gamma } = vzFilterChain();
  const chain = [];
  if (gamma !== null) {
    const id = ensureGammaFilter(v, gamma);
    if (id) chain.push(`url(#${id})`);   // **الجاما أوّلاً**: ترفع الظلال ثمّ يعمل الباقي عليها
  }
  chain.push(...parts);
  v.style.filter = chain.join(" ");
  return v.style.filter;
}

// **يزول مع كلّ فيديو** (شرط المالك) — فلا قيمةَ تُخزَّن ولا تُورَّث.
function resetVideoFilter(video) {
  const old = video || vzFilteredVideo;
  try { if (old) old.style.filter = ""; } catch {}   // **ولو خرج من الشجرة**
  vzFilteredVideo = null;
  vzFilterValues = vzFilterDefaults();
  vzFilterOn = true;
  syncFilterPanel();
}

// ⭐ **ومُنبِّهُ «تبدّل ما يُشاهده»: حدثُ المنصّة لا اسمُ مضيف.** `loadstart`
// يقع حين يبدأ العنصرُ تحميلَ مصدرٍ جديد — **وهو ما يفعله يوتيوب في انتقاله
// الداخليّ: يُبقي العنصر ويُبدّل المصدر** (وهي العائلة التي لدغتنا في #38ج و`S5`).
// ⛔ **ولا `yt-navigate-finish` هنا:** اسمُ مضيفٍ يموت كما مات غيرُه، **والحدثُ
// المنصّيّ يسري على كل مشغّلٍ** — **وهو حكم #65 نفسُه: البنيةُ لا الاسم.**
// ⚠️ **ومحصورٌ بالعنصر الذي نحمل فلترَه**: `loadstart` يقع كثيراً (إعلانات ·
// معاينات) — **فغيرُ المفلتَر لا يعنينا.**
function filterVideoLoadStart(e) {
  const v = e.target;
  if (!v || v.tagName !== "VIDEO" || v !== vzFilteredVideo) return;
  resetVideoFilter(v);
}
// ⚠️ **والتسجيلُ أسفل مع بقيّة مستمعي دورة الحياة** — **سطرٌ ينفَّذ عند التحميل
// داخل كتلةٍ يقتطعها سندٌ يرمي فيه** (`document is not defined`)، **وقد وقع
// مرّتين اليوم**: مستمعُ `Esc` ثمّ هذا. **والسندُ يقتطع منتَجاً لا يخترعه.**

IDLE_CONSUMERS.speedButton = {
  enabled: speedButtonActive,
  // **المؤشّر داخل مستطيل الزرّ ⇒ امتناع** — ولا حاجة إلى مستمعٍ يُنبّه: خروجُ
  // المؤشّر **حركةٌ بطبعه**، فتقع `markIdleActivity` ثمّ تمضي المهلة فيُخفى.
  // ⛔ **حُذف `pointerInsideSpeedBtn` ولم يُترك** — صار حالةً من العامّة.
  // **والزرّ ابنٌ في الشريط اليوم فتسقط حالتُه فيها بالبناء**، ويبقى الهدف
  // معلَناً لأنه قد **يسقط إلى الطبقة** فيخرج من الشريط.
  target: () => vzSpeedBtn,
  onActive: () => setSpeedBtnShown(true),
  // ⭐ **معنى «سكون» عند هذا المستهلك يتبع موضعَه** (م22، قرار المالك 2026-08-03).
  // ⛔ **والثقب مقيسٌ لا مُتوقَّع:** و#70 مطفأ، كان الزرّ يصير `display:none`
  // و`w:0` عند 1.2s **وجارُه في الشريط `block` و`w:48`** — **زرٌّ يغيب وجيرانه
  // حاضرون**، وذاك ثقبٌ في صفّ الأزرار.
  // ⇒ **محقوناً: الإخفاء بلا أثر — الشريط يملك ظهورَ أبنائه، والمالك طلب أن
  // يظهر معه ويختفي معه.** **وساقطاً إلى الطبقة: يعمل كما كان**، فلا شيء يُخفيه
  // هناك غيرُنا. ⇒ **وهو الحدّ المعماريّ نفسه: المستهلك يُعلن والمحرّك لا يقرّر.**
  onIdle: () => { if (speedBtnPlacement() === "bar") return; setSpeedBtnShown(false); },
  // **إطفاؤه يعني: أزِل زرَّنا** — لا «أظهِره كالنشط»: نحن رسمناه فنحن نمحوه.
  onDisabled: () => setSpeedBtnShown(false)
};

// ── #108 — بناءُ اللوحة من السجلّ: مسافةُ الراسم عن الكاتب صفر ───────────────
// **ولا `innerHTML` بقيمٍ**: العناصر تُبنى وتُسنَد نصوصُها بـ`textContent`.
function buildFilterPanel() {
  const p = document.createElement("div");
  p.className = "vzFilterPanel vzHidden";
  // ⭐ **العلامةُ البنيوية (#72 · #85 · #94): الطبقةُ التي تملك حدثَها تُعلنه.**
  // ⇒ **العجلةُ فوقها تُحرّك منزلقها ولا تُنفّذ أمرَ مربّع** — **ولا حكمَ ثالثاً
  // يُكتب**: قاعدةُ #65 («قابل للتمرير») **تستثني عناصرَنا بنصّها**، فلا تنطبق.
  p.setAttribute("data-vz-owns", "wheel click");

  const head = document.createElement("div");
  head.className = "vzFpHead";
  const sw = document.createElement("label");
  sw.className = "vzFpSwitch";
  sw.title = "يُوقف أثر الفلاتر ويُبقي القيم كما ضبطتَها";
  const swBox = document.createElement("input");
  swBox.type = "checkbox";
  swBox.className = "vzFpOn";
  swBox.checked = vzFilterOn;
  const track = document.createElement("span");
  track.className = "vzFpTrack";
  const swTxt = document.createElement("span");
  // ⭐ **وسمُ كلٍّ يقول فعلَه، فلا يلتبس بالآخر** (شرط المالك): **المفتاحُ يُوقف
  // الأثر ويُبقي القيم · والزرُّ يمحو القيم** — **وإلا كانا مفتاحين لشيءٍ واحد
  // في العين.**
  // ⚠️ **وصار يُقلَب بتطبيق محفوظ (#109) فيقوله** — **ضابطٌ يتغيّر بلا أن يلمسه
  // أحد هو ما نطارده**، فالوسمُ يسبق المفاجأة.
  sw.title = "يُوقف أثر الفلاتر ويُبقي القيم — ويعود مُشغَّلاً إن طبّقتَ محفوظاً";
  swTxt.textContent = "تشغيل الفلاتر";
  sw.append(swBox, track, swTxt);
  const resetAll = document.createElement("button");
  resetAll.type = "button";
  resetAll.className = "vzFpResetAll";
  resetAll.dataset.vzResetAll = "1";
  resetAll.title = "يمحو القيم كلَّها ويُعيدها إلى افتراضها";
  resetAll.textContent = "إرجاع الكلّ";
  head.append(sw, resetAll);
  p.appendChild(head);

  // ── #109 — صفُّ المحفوظات، **في الرأس الثابت لا في الجسم المُمرَّر** ────────
  // ⛔⭐⭐ **والقياسُ هو ما قلب السؤال** (2026-08-08، على فيديو 469px): اللوحةُ
  // **عند سقفها اليوم بالضبط** (مرئيّ 308 = محتوى 308)، **وأيُّ صفٍّ يُدخلها
  // التمرير — في الرأس كان أو في الجسم** (329 · 330). ⇒ **فالسؤال ليس «أين أضعه
  // كي لا تطول» بل «ما الذي يبقى مرئيّاً حين تُمرَّر».**
  // ⭐⭐ **وكشف القياسُ عيباً قائماً لم يُطلَب إصلاحُه: التمريرُ كان على اللوحة
  // نفسِها لا على جسمها** ⇒ **فالمفتاحُ الرئيسيّ و«إرجاعُ الكلّ» يُمرَّران بعيداً
  // اليوم — والرأسُ لم يكن رأساً أصلاً.** ⇒ **فنقلُ التمرير إلى `.vzFpBody`
  // يُصلح القائمَ ويُنشئ المكان معاً، وثمنُه سطرا CSS.** ⛔ **ويُعلَّل هنا كي لا
  // يُقرأ بعد سنةٍ توسّعاً في بندٍ لم يطلبه** (شرط المالك).
  const save = document.createElement("div");
  save.className = "vzFpSave";
  const name = document.createElement("input");
  name.type = "text";
  name.className = "vzFpPresetName";
  name.maxLength = VZ_FILTER_PRESETS_MAX_NAME;
  name.placeholder = "اسم الفلتر";
  name.setAttribute("aria-label", "اسم الفلتر المحفوظ");
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "vzFpChip";
  saveBtn.dataset.vzPresetSave = "1";
  saveBtn.title = "يحفظ قيم المنزلقات الحالية بهذا الاسم";
  saveBtn.textContent = "حفظ";
  const pick = document.createElement("select");
  pick.className = "vzFpPick";
  pick.setAttribute("aria-label", "الفلاتر المحفوظة");
  pick.title = "اختيارُ الاسم يُطبّقه فوراً — يستبدل القيم كلَّها، وما ليس في المحفوظ يعود إلى افتراضه. ويزول مع الفيديو التالي كأيّ فلتر";
  // ⛔⭐⭐ **#139 — لا زرَّ تطبيق: المحدَّدُ هو المطبَّق** (قرار المالك 2026-08-08).
  // **وهو أصدقُ لا أقصر:** زرٌّ يُطبّق ما هو مطبَّقٌ سلفاً **ضابطٌ يُضغَط ولا يُغيّر
  // شيئاً** (#24) — **أو أسوأ: يوهم أن الاختيارَ لم يقع بعد.**
  // ⚠️ **والحدُّ الذي كان في وسمه انتقل إلى وسم القائمة، ولم يسقط**: الحفظُ للقيم
  // لا للتثبيت، **والمُطبَّق يزول مع الفيديو التالي كأيّ فلتر.**
  // ── #138 — **«تحديث»: إظهارُ ما كان موجوداً ولا يُرى** ─────────────────────
  // ⛔⭐⭐ **والحفظُ باسمٍ موجود كان يستبدل من يوم #109 — مقيسٌ في المصدر** —
  // **لكنّه يشترط إعادةَ كتابة الاسم بحرفه، ولا شيءَ يقول إنه سيستبدل** ⇒
  // **فالميزةُ كانت موجودةً ولا تُرى، والعلاجُ إظهارُها لا بناؤها** (حكمُ المالك).
  // ⚠️ **ولا نافذةَ تأكيدٍ للاستبدال**: الفعلُ قابلٌ للتراجع بضبطٍ وتحديثٍ ثانٍ،
  // **والنوافذُ ليست من لغة هذي اللوحة** (قرار المالك).
  const updBtn = document.createElement("button");
  updBtn.type = "button";
  updBtn.className = "vzFpChip";
  updBtn.dataset.vzPresetUpdate = "1";
  updBtn.hidden = true;
  updBtn.title = "يستبدل قيمَ المحفوظ المحدَّد بالقيم الجارية";
  updBtn.textContent = "تحديث";
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "vzFpChip";
  delBtn.dataset.vzPresetDel = "1";
  delBtn.title = "يحذف المحدَّد";
  delBtn.textContent = "حذف";
  const note = document.createElement("div");
  note.className = "vzFpNote";
  save.append(name, saveBtn, pick, updBtn, delBtn, note);
  p.appendChild(save);

  const body = document.createElement("div");
  body.className = "vzFpBody";
  for (const g of VZ_FILTER_GROUPS) {
    const gh = document.createElement("div");
    gh.className = "vzFpGroup";
    gh.textContent = g.label;
    body.appendChild(gh);
    for (const it of VZ_FILTER_ITEMS.filter((x) => x.group === g.id)) {
      const row = document.createElement("div");
      row.className = "vzFpRow";
      row.dataset.vzKey = it.key;
      const name = document.createElement("div");
      name.className = "vzFpName";
      name.textContent = it.label;
      name.title = it.label;
      const val = document.createElement("span");
      val.className = "vzFpVal";
      const range = document.createElement("input");
      range.type = "range";
      range.min = String(it.min); range.max = String(it.max); range.step = String(it.step);
      range.value = String(it.def);
      range.dataset.vzKey = it.key;
      // **سهمُ رجوعٍ لكلّ منزلق** (شرط المالك) — يعيد قيمتَه هو وحده
      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "vzFpReset";
      reset.dataset.vzReset = it.key;
      reset.title = "إرجاع";
      reset.textContent = "↺";
      row.append(name, range, val, reset);
      body.appendChild(row);
    }
  }
  p.appendChild(body);
  return p;
}

// **الملءُ من الحالة لا من الـDOM** — والقيمةُ المعروضة تتبع المخزَّنة في الذاكرة.
function syncFilterPanel() {
  if (!vzFilterPanel) return;
  const v = vzFilterValues || vzFilterDefaults();
  vzFilterPanel.dataset.vzOff = vzFilterOn ? "0" : "1";
  const box = vzFilterPanel.querySelector(".vzFpOn");
  if (box) box.checked = vzFilterOn;
  for (const it of VZ_FILTER_ITEMS) {
    const row = vzFilterPanel.querySelector(`.vzFpRow[data-vz-key="${it.key}"]`);
    if (!row) continue;
    const range = row.querySelector("input[type=range]");
    const out = row.querySelector(".vzFpVal");
    if (range) range.value = String(v[it.key]);
    // **الوحدةُ من طبيعة المقيس لا من شكل الجدول** (قرار 110)
    if (out) out.textContent = it.fmt(v[it.key]);
  }
  // ⛔⭐ **الأزرارُ وحدَها لا القائمة** (#138): `syncFilterPanel` تُنادى مع **كلّ
  // حركةِ منزلق**، **وإعادةُ بناء `<select>` تحت يد المستخدم في كل نبضة** ثمنٌ
  // بلا مقابل — **والقائمةُ لا تتغيّر إلا بحفظٍ أو حذفٍ أو تحميل، وهناك تُعاد.**
  // ⇒ **وظهورُ «تحديث» يتبع القيم فيُحسب هنا بالضرورة.**
  syncFilterPresetButtons();
}

// ⚠️ **القائمةُ وحدَها تُعاد** — **ولا يُمسّ حقلُ الاسم**: `flushReload` تقع بعد
// كتابتنا نفسِها، **فإعادةُ بنائه تمحو ما يكتبه المستخدم تحت يده.**
// ⛔ **والنصّ بـ`textContent` لا `innerHTML`**: الاسمُ من المستخدم ومن ملفّ نسخةٍ
// مستوردة، فقد يحمل `<` أو `&` (جرد #32).
function renderFilterPresetList() {
  const pick = vzFilterPanel?.querySelector(".vzFpPick");
  if (!pick) return;
  const كان = pick.value;
  pick.textContent = "";
  // ⭐ **#137 — المبنيُّ أوّلاً ودائماً**: القائمةُ لا تكون فارغةً بحال ⇒ **فلا
  // ضابطَ ميّتٌ عند أوّل فتح، والميزةُ مقروءةٌ من أوّل لحظة.**
  const b = document.createElement("option");
  b.value = VZ_PRESET_BUILTIN_VALUE;
  b.textContent = VZ_FILTER_BUILTIN.label;
  pick.appendChild(b);
  for (const p of vzFilterPresets) {
    const o = document.createElement("option");
    o.value = `s:${p.n}`;
    o.textContent = p.n;
    pick.appendChild(o);
  }
  pick.disabled = false;
  if ([...pick.options].some((o) => o.value === كان)) pick.value = كان;
  syncFilterPresetButtons();
}

// ── #138 — **المقارنة: مُوسَّعةٌ بمُوسَّعة، ولا مخزَّنٌ بجارٍ** ────────────────
// ⛔⭐⭐ **وهذا موضعُ العطب الذي حذّر منه المالك، ويُحرَس بشاهدين:** المخزَّن
// **متفرّق** (يُسقط ما يساوي الافتراض) والجاري **كامل** ⇒ **فمقارنةٌ ساذجة تقول
// «مختلف» أبداً فيظهر الزرُّ دائماً، أو «متطابق» أبداً فلا يظهر قطّ.**
// ⇒ **فالطرفان يُوسَّعان قبل المقارنة**، والسجلُّ هو مدارُ اللفّ فلا مفتاحَ يفوت.
function vzFilterMatchesPreset(preset) {
  const now = vzFilterValues || vzFilterDefaults();
  const was = vzFilterValuesFromPreset(preset);
  for (const it of VZ_FILTER_ITEMS) if (Number(now[it.key]) !== Number(was[it.key])) return false;
  return true;
}

// **المحدَّدُ الآن: مخزَّنٌ أم المبنيّ أم لا شيء** — موضعٌ واحد يقرأ البادئة
function vzSelectedPreset() {
  const v = vzFilterPanel?.querySelector(".vzFpPick")?.value || "";
  if (v === VZ_PRESET_BUILTIN_VALUE) return { builtin: true };
  if (!v.startsWith("s:")) return null;
  return vzFilterPresets.find((p) => `s:${p.n}` === v) || null;
}

// ⭐⭐ **#139 — المُطبِّقُ الواحد للمحدَّد**: يُنادى من تبديل القائمة، **ومن أيّ
// مسارٍ يُبدّل المحدَّدَ برمجياً فيلزمه الأثر.** ⛔ **ولا موضعان يتباعدان.**
// ⚠️ **والمبنيُّ قيمتُه `{}`** فالاستبدالُ يُرجع التسعةَ إلى افتراضها بالبناء.
function applySelectedPreset() {
  const sel = vzSelectedPreset();
  if (!sel) return;
  if (sel.builtin) {
    applyFilterPreset({ n: VZ_FILTER_BUILTIN.label, v: {} });
    filterPresetNote(`طُبِّق «${VZ_FILTER_BUILTIN.label}»`, false);
    return;
  }
  applyFilterPreset(sel);
  filterPresetNote(`طُبِّق «${sel.n}»`, false);
}

// ⛔⭐ **زرّا الحذف والتحديث يُخفيان ولا يُعطَّلان** (شرط المالك): **ضابطٌ يُضغَط
// ولا يفعل شيئاً هو ما نمنعه** (#24)، **وغيابُه أصدقُ من تعطيله.**
// ⇒ ⭐ **والقاعدةُ واحدةٌ للزرّين بلا استثناءٍ يُكتب** — **ولا يظهران على المبنيّ:
// مُشتقٌّ لا مخزَّن، فلا شيءَ يُحدَّث فيه ولا يُحذف.**
function syncFilterPresetButtons() {
  const pick = vzFilterPanel?.querySelector(".vzFpPick");
  const del = vzFilterPanel?.querySelector("[data-vz-preset-del]");
  const upd = vzFilterPanel?.querySelector("[data-vz-preset-update]");
  if (!pick) return;
  const builtin = pick.value === VZ_PRESET_BUILTIN_VALUE;
  if (del) del.hidden = builtin;
  // **يظهر حين يكون مدخلٌ مخزَّنٌ محدَّداً وقيمُه الجارية تخالف المخزَّن — ويختفي
  // وقتَ التطابق** (شرط المالك بحرفه).
  if (upd) {
    const sel = vzSelectedPreset();
    upd.hidden = !sel || sel.builtin === true || vzFilterMatchesPreset(sel);
  }
}

// **رسالةُ الصفّ** — نجاحاً أو سبباً، ولا نجاحَ يُطبع لما لم يقع (جرد #57)
function filterPresetNote(text, bad) {
  const el = vzFilterPanel?.querySelector(".vzFpNote");
  if (!el) return;
  el.textContent = text || "";
  el.dataset.vzBad = bad ? "1" : "0";
}

function setFilterValue(key, raw) {
  const it = VZ_FILTER_ITEMS.find((x) => x.key === key);
  if (!it) return;
  const n = Math.min(it.max, Math.max(it.min, Number(raw)));
  if (!Number.isFinite(n)) return;
  vzFilterValues = vzFilterValues || vzFilterDefaults();
  vzFilterValues[key] = Math.round(n / it.step) * it.step;
  vzFilterValues[key] = Number(vzFilterValues[key].toFixed(3));
  syncFilterPanel();
  applyVideoFilter();
}

// ⛔⭐ **عيبان مقروءان أصلحهما تحقّقُ المالك 2026-08-06 — والحارسُ دلّ عليهما:**
// **(١) كانت تعمل وإن لم يتغيّر شيء.** `setFilterBtnShown(false)` تناديها **في
// كل مرّةٍ يختفي فيها الزرّ** — أي في كل دورةِ سكون — **فتُعيد تشغيل المحرّك
// على لوحةٍ مغلقةٍ أصلاً**. ⇒ **والدالّةُ المُهيَّئة (idempotent) لا تعمل بلا
// تغيّر**، وهذا وحدَه يقطع أكثر الدورة.
// **(٢) وكانت تُعيد الدخول إلى المحرّك من داخل ندائه** — على **أحرّ مسار عندنا**
// (`updatePointerFromEvent` ⇒ `noteIdleFromPointerEvent` ⇒ `markIdleActivity`).
// ⇒ **فصارت تُعلن الحاجة ولا تدخل** (`requestIdleReapply`).
// ⚠️ **والحارسُ في المحرّك يبقى** — **سببُه الأوّل قائم**: مستهلكٌ ثالثٌ غداً
// **لا يعرف هذا العقد**، والحارسُ يمنع انهيارَه لا يستر عطبَه (وهو يُعلنه).
function setFilterPanelOpen(on) {
  if (!vzFilterPanel) return;
  const want = !!on;
  if (want === vzFilterPanelOpen()) return;   // **لا عملَ بلا تغيّر**
  vzFilterPanel.classList.toggle("vzHidden", !want);
  // **حالُ الامتناع تبدّلت ⇒ يُعاد عرضُها على المستهلكين** — وإلا بقي شريطُ
  // المضيف يُخفى تحت لوحةٍ مفتوحة حتى أوّل نشاط. **طلباً لا دخولاً.**
  requestIdleReapply();
  if (want) startOverlayTracking();
}

function filterPanelWheel(e) {
  const range = e.target?.closest?.("input[type=range]");
  if (!range) return;
  e.preventDefault();
  e.stopPropagation();
  const it = VZ_FILTER_ITEMS.find((x) => x.key === range.dataset.vzKey);
  if (!it) return;
  const cur = Number(range.value);
  setFilterValue(it.key, cur + (e.deltaY < 0 ? it.step : -it.step));
}

function filterPanelInput(e) {
  const range = e.target?.closest?.("input[type=range]");
  if (range) { setFilterValue(range.dataset.vzKey, range.value); return; }
  // ⭐⭐ **#139 — تبديلُ المحدَّد يُطبّقه**: المحدَّدُ هو المطبَّق، فلا زرَّ بينهما.
  if (e.target?.closest?.(".vzFpPick")) applySelectedPreset();
}

// **مُحمِّلٌ كبقيّة الشرائح** — يقرأ من اللقطة نفسِها ولا يقرأ التخزين ثانيةً
async function loadFilterPresets(pre) {
  const data = await settingsRead(pre);
  loadFilterPresetsFrom(data.settings || {});
  renderFilterPresetList();
}

function filterPanelClick(e) {
  // **الإرجاعُ الشامل يمحو القيم** — وهو غيرُ المفتاح الذي يُوقف الأثر ويُبقيها
  if (e.target?.closest?.("[data-vz-reset-all]")) {
    vzFilterValues = vzFilterDefaults();
    syncFilterPanel();
    applyVideoFilter();
    return;
  }
  const reset = e.target?.closest?.("[data-vz-reset]");
  if (reset) {
    const it = VZ_FILTER_ITEMS.find((x) => x.key === reset.dataset.vzReset);
    if (it) setFilterValue(it.key, it.def);
    return;
  }
  // ── #109 — الحفظُ والتطبيقُ والحذف ──────────────────────────────────────
  if (e.target?.closest?.("[data-vz-preset-save]")) { saveFilterPresetFromPanel(); return; }
  // ── #138 — التحديث: استبدالُ قيمِ المحدَّد بالقيم الجارية ───────────────────
  if (e.target?.closest?.("[data-vz-preset-update]")) {
    const sel = vzSelectedPreset();
    if (!sel || sel.builtin) { filterPresetNote("لا محفوظ محدَّد", true); return; }
    const v = vzFilterSparse();
    // **ويمرّ بالتأكيد القائم لا بآليّةٍ ثانية** (#109) — **ومن ضغط ولم يرَ شيئاً
    // لا يعرف أوقع أم لا، وذاك «لا أثرَ بلا خطأ».**
    persistFilterPresets(vzFilterPresets.map((p) => (p.n === sel.n ? { n: p.n, v } : p))).then((r) => {
      renderFilterPresetList();
      const pick = vzFilterPanel?.querySelector(".vzFpPick");
      if (r.ok && pick) pick.value = `s:${sel.n}`;
      syncFilterPresetButtons();
      filterPresetNote(r.ok ? `حُدِّث «${sel.n}»` : r.msg, !r.ok);
    });
    return;
  }
  if (e.target?.closest?.("[data-vz-preset-del]")) {
    const pick = vzFilterPanel?.querySelector(".vzFpPick");
    // ⛔ **والمبنيُّ لا يُحذف** — والزرُّ مخفيٌّ عليه أصلاً، **وهذا حارسُ المسار
    // لا حارسُ العرض**: من بلغه بطريقٍ آخر يُردُّ بجملةٍ لا بصمت.
    if (pick?.value === VZ_PRESET_BUILTIN_VALUE) {
      filterPresetNote(`«${VZ_FILTER_BUILTIN.label}» مدخلٌ جاهزٌ لا يُحذف`, true);
      return;
    }
    const n = pick?.value?.startsWith("s:") ? pick.value.slice(2) : "";
    if (!n) { filterPresetNote("لا محفوظ محدَّد", true); return; }
    persistFilterPresets(vzFilterPresets.filter((x) => x.n !== n)).then((r) => {
      renderFilterPresetList();
      filterPresetNote(r.ok ? `حُذف «${n}»` : r.msg, !r.ok);
    });
    return;
  }
  const box = e.target?.closest?.(".vzFpOn");
  if (box) {
    // **يُوقف الفلتر كلَّه ولا يُضيّع القيم** (شرط المالك): الحالةُ تُقلَب،
    // و`vzFilterValues` **لا تُمسّ**.
    vzFilterOn = !!box.checked;
    syncFilterPanel();
    applyVideoFilter();
  }
}

// **الحفظُ من اللوحة** — والاسمُ المكرَّر يستبدل مكانَه ولا يُنشئ ثانياً بالاسم نفسِه
function saveFilterPresetFromPanel() {
  const input = vzFilterPanel?.querySelector(".vzFpPresetName");
  const n = (input?.value || "").trim().slice(0, VZ_FILTER_PRESETS_MAX_NAME);
  if (!n) { filterPresetNote("اكتب اسماً أوّلاً", true); input?.focus(); return; }
  // ⛔ **#137 — والاسمُ محجوز**: **ويُردُّ بجملةٍ تقول لماذا، لا بصمت.**
  if (n === VZ_FILTER_BUILTIN.label) {
    filterPresetNote(`«${VZ_FILTER_BUILTIN.label}» اسمٌ محجوز — اختر غيرَه`, true);
    input?.focus();
    return;
  }
  const v = vzFilterSparse();
  // ⚠️ **وحفظُ فلترٍ لا شيءَ فيه يُعلَن ولا يُخزَّن** — مدخلٌ فارغٌ يُطبَّق فيبدو
  // «لم يفعل شيئاً»، **وهو «لا أثرَ بلا خطأ» بعينه**.
  if (!Object.keys(v).length) { filterPresetNote("لا قيمةَ تُحفظ — حرّك منزلقاً", true); return; }
  const next = vzFilterPresets.filter((p) => p.n !== n).concat([{ n, v }]);
  persistFilterPresets(next).then((r) => {
    renderFilterPresetList();
    // ⛔⭐ **عطبٌ حيٌّ أدخله #137 وأُصلح هنا:** كان `pick.value = n` **وقيمُ الخيارات
    // صارت مسبوقةً `s:` في #137** ⇒ **قيمةٌ لا يحملها خيارٌ فيفرغ المحدَّد**،
    // **فمن حفظ لم يجد محفوظَه مختاراً.** ⚠️ **ومرّ من خطوات `ج1`–`ج4` لأنها لم
    // تحفظ ثمّ تقرأ المحدَّد** — ⭐ **وأمسكه سؤالُ التحديث لا شاهدٌ قائم.**
    if (r.ok) { if (input) input.value = ""; const pick = vzFilterPanel?.querySelector(".vzFpPick"); if (pick) pick.value = `s:${n}`; }
    syncFilterPresetButtons();
    filterPresetNote(r.ok ? `حُفظ «${n}»` : r.msg, !r.ok);
  });
}

// ⭐ **مسارُ لوحة المفاتيح في الحقل** (#77 · #109): `Enter` يحفظ.
// ⛔ **و`Escape` ليس هنا**: مُغلِقُ اللوحة مستمعٌ على `document` **بالالتقاط**
// فيسبق هذا المستمعَ بنيوياً — **فمنعُه هناك لا هنا**، وإلا كتبنا شرطاً لا يقع.
// ⇒ **وسلطةُ `Escape` واحدة: `filterEscKeydown`.**
function filterPanelKeydown(e) {
  const input = e.target?.closest?.(".vzFpPresetName");
  if (!input) return;
  if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); saveFilterPresetFromPanel(); }
}

function filterBtnClick(e) {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  setFilterPanelOpen(!vzFilterPanelOpen());
}

// **`Esc` يُغلق اللوحة** — ⚠️ **وفي ملء الشاشة يملكه المتصفّح فيخرج به من ملء
// الشاشة قبل أن يصلنا** (مقيسٌ 2026-08-05)، **فالشرط يتحقّق خارجَه وحده**.
// ⚠️ **دالّةٌ مسمّاة ومستمعٌ على `document` لا `window`** — **لا تجنّباً لحارسٍ
// بل لأن مرساةَ حارس البوّابة `window.addEventListener("keydown"` تُمسك أوّلَ
// موضعٍ في الملفّ**: مستمعٌ ثانٍ بالصيغة نفسِها **يسرق مرساةَ الريماب فيُفحص
// جسمي مكانَه** — وذاك يُفرغ حارساً قائماً من معناه، وهو أسوأ من أحمرَ يُصلَح.
// ⇒ **والمدخلُ مسجَّلٌ باسمه في `ENTRIES`**، فيُفحص هو أيضاً ولا يُفلت.
function filterEscKeydown(e) {
  if (!extensionActive()) return;         // #64: الرئيسي ثمّ الحظر
  if (!filterButtonActive()) return;      // ثمّ مفتاح الميزة
  if (e.key !== "Escape" || !vzFilterPanelOpen()) return;
  // ⛔⭐ **#109 — والتركيزُ في حقل الاسم: يُغادر الحقلَ ولا يُغلق اللوحة.**
  // **منعُ فقدِ عملٍ لا تحسينُ راحة**: من ضغطها وهو يكتب اسماً فقده معها.
  // ⚠️ **والحكمُ هنا لا في مستمع اللوحة**: هذا على `document` **بالالتقاط**
  // فيسبقه بنيوياً — **وشرطٌ في المستمع الآخر شرطٌ لا يقع.**
  if (e.target?.closest?.(".vzFpPresetName")) {
    e.stopPropagation();
    e.target.value = "";
    e.target.blur();
    return;
  }
  setFilterPanelOpen(false);
}
// ⚠️ **والتسجيلُ مع بقيّة مستمعي دورة حياة الطبقة، لا هنا** — أسفل، بجوار
// `fullscreenchange`: **سطرٌ ينفَّذ عند التحميل داخل كتلةٍ يقتطعها سندُ #72
// يرمي فيه** (`document is not defined`)، **والسندُ يقتطع منتَجاً لا يخترعه.**

// ── #134 — **زرّ نسخ رابط الفيديو** (طلب المالك 2026-08-08) ──────────────────
//
// ⭐ **وهو أوّلُ اختبارٍ حقيقيّ لمحرِّر الشريط**: بُني بحجّة «ستُضاف أزرارٌ
// لاحقاً»، **فكلّف الزرُّ الثالثُ ثلاثةَ سجلّاتٍ ولا سطرَ منطقٍ في المحرِّر** —
// `BAR_BUTTON_IDS` · `BAR_BUTTONS` · `VZ_BAR_BUTTONS`. **والحجّةُ صمدت مقيسةً.**
//
// ⛔⭐ **وما يُنسخ: ما في شريط العنوان منزوعاً منه `t` وحدَه** (قرار المالك).
// ⚠️ **وحدّاه مكتوبان في تلميح الزرّ لا في سجلٍّ بعيد** — **فمن يقرأ التلميح هو
// من يقع عليه أثرُهما:**
//   · **في قائمة تشغيل يبقى `list`** ⇒ **من نسخ فيها شارك القائمةَ معها.**
//   · **و`/shorts/` يبقى كما هو إن أُطفئ تحويلُ Shorts** — ⭐ **وهو خارج المدى
//     بسببٍ مقيسٍ لا بقرار**: `ytShortsRedirect` **افتراضُه مُشغَّل**، فالعنوانُ
//     صار `/watch` قبل أن يُنقر الزرّ. **ولا منطقَ خاصّ له، ولم يُطلب.**
//
// ⛔ **ولا إذنَ جديدٌ في المانيفست** — مقيسٌ 2026-08-08 على أصل يوتيوب من عالم
// الإضافة: `permissions.query({name:"clipboard-write"})` **granted**، **وبنقرةٍ
// موثوقة نجح**، **وبلا نقرة رُفض** (`NotAllowedError`).
// ⚠️ **وحدُّ ذاك القياس يُقال ولا يُدّعى أكثرُ منه:** الرفضُ كان
// «Document is not focused» **لا «لا تفعيل»** ⇒ **فهو لا يفصل التركيزَ عن
// التفعيل، والمُثبَتُ أن النقرةَ الموثوقة تكفي** — **وذاك يكفينا.**
function copyButtonActive() {
  if (!extensionActive()) return false;   // #64: الرئيسي ثمّ الحظر
  return barButtonOn(overlaySettings, "copy");   // #118 — من القائمة لا من مفتاحٍ مفرد
}

// ⛔⭐⭐ **رابطٌ مجرَّد: يُبنى من `v` وحدَه** (قرار المالك 2026-08-08، بعد أن جرّب).
// ⛔ ~~«يُنزع `t` وحدَه ويبقى ما سواه»~~ — **مسحوبٌ بتجربته** (قرار 21): كان يُبقي
// `list` و`start_radio` **فيشارك القائمةَ مع من نسخ فيها.**
// ⇒ ⭐⭐ **والقاعدةُ الجديدة أنظفُ لا أضيق: «ما يُبقى» لا «ما يُنزع»** — **فقائمةُ
// النزع تحتاج معرفةَ كلّ ما قد يُضاف غداً وتتقادم بالبناء، وقائمةُ الإبقاء لا
// تحتاج شيئاً.** ⛔ **فلا تُكتب قائمةُ نزعٍ هنا أبداً.**
// ⚠️ **وبلا `v` لا يُبنى رابط** — **ولا يُعلَن نجاحٌ لم يقع** (audit #57):
// **وحالُه المعلومة `/shorts/ID`** (لا `v` فيه) **وهي لا تقع بالافتراض**، فتحويلُ
// Shorts مُشغَّلٌ افتراضاً فيصير العنوانُ `/watch` قبل أن يُنقر الزرّ.
// ⛔ **ولا منطقَ خاصٌّ لـShorts هنا — لم يُطلب، وهذا امتناعٌ لا معالجة.**
function copyLinkUrl() {
  try {
    const v = new URL(location.href).searchParams.get("v");
    return v ? `${location.origin}/watch?v=${encodeURIComponent(v)}` : null;
  } catch { return null; }
}

// **يمرّ بمسار الزرّين نفسِه** (#108) — ولا نسخةَ ثالثة من المنطق
function setCopyBtnShown(on) {
  let video = null;
  if (on) {
    if (!buttonsAllowedHere()) on = false;   // #116
  }
  if (on) {
    video = speedBtnVideo();
    if (!video) return;
    if (!videoOwnsControls(video)) on = false;   // #94 — فيديوٌ يملك أدواته
    else if (isInMiniPlayer(video)) on = false;   // #149 — مشغّلٌ مصغّر: لا نرسم فيه
    else ensureVideoOverlay(video);
  }
  if (!vzCopyBtn) return;
  if (on) { placeInHostBar(vzCopyBtn, video); applyBarOrder(); }
  vzCopyBtn.classList.toggle("vzHidden", !on);
  if (on) startOverlayTracking();
}

// ⛔⭐ **التأكيدُ بآلة الشارة القائمة (#71) لا بآليّةٍ ثانية** (قرار المالك):
// **`showBadge` تملك المدّةَ والبناءَ والمؤقّتَ لكلّ قناة** — فلا مؤقّتَ هنا.
// ⚠️ **وقيدُه مكتوبٌ في تلميح الزرّ كما كُتب لأخته:** المدّةُ من
// «كم تبقى الشارة ظاهرة» ⇒ **من أنزلها إلى صفرٍ أطفأ التأكيد معها.**
// ⛔ **ولا مفتاحَ جديد ولا رقمَ ثانٍ: استثناءُ الثالثة يُنشئ قاعدتين لآلةٍ واحدة.**
function copyBtnClick(e) {
  if (e.button !== 0) return;              // اليمين والأوسط: كأختيه بعد `S9`
  if (!copyButtonActive()) return;
  e.preventDefault();
  e.stopPropagation();
  const video = speedBtnVideo();
  const url = copyLinkUrl();
  // ⛔ **ولا يُعلَن نجاحٌ لم يقع** (audit #57): التأكيدُ في `then` لا قبله،
  // **والرفضُ يقول إنه رفض** — **ونجاحٌ كاذب أسوأ من فشلٍ صامت.**
  const say = (ok) => showBadge(video, "copyMsg", ok ? "نُسخ الرابط ✅" : "تعذّر النسخ");
  // **ولا رابطَ ⇒ لا نسخ، ويُقال** — ولا يُنسخ عنوانٌ ناقص
  if (!url) { showBadge(video, "copyMsg", "لا رابطَ لهذا الفيديو"); return; }
  try {
    navigator.clipboard.writeText(url).then(() => say(true), () => say(false));
  } catch { say(false); }
  // ⛔⭐ **ولا `markIdleActivity()` هنا** — وقد كُتبت ثمّ حُذفت 2026-08-08:
  // **حارسُ المحرّك يسأل «أهو إدخالٌ أم أثرُ إدخال؟»، والنقرةُ تمرّ سلفاً بـ
  // `updatePointerFromEvent` ⇒ `noteIdleFromPointerEvent`** — **فندائي أثرُ إدخال.**
  // ⭐ **والسابقةُ تحسمها: `filterBtnClick` (زرُّنا الثاني) لا يُناديها إطلاقاً**
  // ⇒ **فحمرةُ العدّاد لم تكن كلفةَ الزرّ الثالث، بل كانت تُصحّح لي.**
}

// ── #134 — ويتبع السكونَ كأخويه، **بلا منطقٍ ثانٍ** ─────────────────────────
IDLE_CONSUMERS.copyBtn = {
  enabled: copyButtonActive,
  target: () => vzCopyBtn,
  onActive: () => setCopyBtnShown(true),
  // **الزرُّ ابنٌ في الشريط والشريطُ يملك ظهورَ أبنائه** — كما في #72 و#108
  onIdle: () => { if (speedBtnPlacement() === "bar") return; setCopyBtnShown(false); },
  onDisabled: () => setCopyBtnShown(false)
};

// ── #108 — الزرّ يتبع السكون كزرّ السرعة، **ويمتنع ما دامت لوحتُه مفتوحة** ────
IDLE_CONSUMERS.filterBtn = {
  enabled: filterButtonActive,
  target: () => vzFilterBtn,
  // ⭐ **سابعةُ الحدّ المعماريّ: المستهلك يُعلن، والمحرّك يسأل ولا يعرف لماذا.**
  suspended: vzFilterPanelOpen,
  onActive: () => setFilterBtnShown(true),
  onIdle: () => { if (speedBtnPlacement() === "bar") return; setFilterBtnShown(false); },
  onDisabled: () => { setFilterPanelOpen(false); setFilterBtnShown(false); }
};

// ── ⭐⭐ #142 — شريطُ تقدّمٍ لمضيفٍ بلا أدوات (المرحلة الأولى) ────────────────
// **الحاجةُ مقيسةٌ عند المالك 2026-09-05**: تيك توك وإنستقرام **لا شريطَ تقدّمٍ
// فيهما ولا زرّ** — **ولا سبيلَ إلى التنقّل في الفيديو إطلاقاً.**
// ✅ **والإمكانيةُ قِيست قبل السطر الأوّل** (مِجَسّ في متصفّح المالك، تيك توك):
// المدّة **135.39** منتهية · ونافذةُ التنقّل **1** · **والكتابةُ في الموضع تحرّكه**
// · **وطبقتُنا حاضرةٌ فوقه سلفاً** · **وصفرُ أزرارٍ في أربعة مستوياتٍ حول الفيديو.**
//
// ⛔⭐⭐ **والقرارُ المعماريّ الذي سبق البناء (قرار المالك 2026-09-05):**
// قاعدةُ #94 (قرار 63) تقول **«نطاقُ مشغّلٍ موجودٌ ولا يُظهر أدواته ⇒ نمتنع، لأن
// المضيفَ هو من أخفاها»** — **وتيك توك هذا الوصفُ بحرفه.** ⇒ **فاختير المفتاحُ
// الصريح على تعديل القاعدة**: **السببُ الموجبُ صار طلبَ المستخدم لا حدسَنا**،
// **والقاعدةُ تبقى بحرفها لأنها عن اجتهادنا نحن لا عن اختياره.**
//
// ⛔⭐ **وشرطُ المالك «ألّا يتضرّر يوتيوب» مُنفَّذٌ بنيوياً لا نيّةً — بضمانتين:**
//   **(١)** بوّابةُ المضيف تُخرجه صراحةً — شرطٌ لا يُقرأ ولا يُقاس.
//   **(٢)** **وحتى لو زالت الأولى**: الشرطُ الموجب «فيديوٌ لا يملك أدواته»،
//       **ويوتيوب يُظهر أدواته** ⇒ **فالشريطُ لا يُرسم عليه أصلاً.**
// ⛔ ~~**وهو وميزةُ #94 نقيضان تامّان يتقاسمان مُحدِّداً واحداً**~~ — **مسحوبٌ
// 2026-09-05 بعد تحقّق المالك (قرار 21)، والدعوى كانت أنيقةً وخاطئة:**
// **#94 يسأل «أيملك الفيديو أدواته؟» وهذا يسأل «أيملك المضيفُ ما يُنقِّل؟»** —
// **وسؤالان لا سؤالٌ واحد بقطبين.** ⇒ ⭐ **والأناقةُ هي التي أخفت الفرق: أزرارُ
// الإعجاب أدواتٌ في السؤال الأوّل وليست شيئاً في الثاني.**
// ✅ **والباقي من الشبه حقيقيّ ويبقى: النطاقُ واحد (`playerScopeForVideo`)،
// وشكلُ المزلاج واحد (الموجبُ يُثبَّت وحدَه).**
//
// ⚠️ **والمرحلةُ الأولى شريطٌ بلا أزرار — بسببٍ مكتوب لا باختصار:** الأزرارُ
// تحتاج أيقوناتٍ من **سجلّ المنتَج**، **ولا تُنسخ من سجلّ المرآة** — و#145 مقيسٌ:
// ثلاثةُ حرّاسٍ أحمرّت على ذلك. **وصفُّ أزرارٍ في طبقتنا يفتح #119** (زرّانا
// يتراكبان فيها). ⇒ **فالمرحلتان مفصولتان، وهذي تسدّ ما لا يملكه المستخدمُ
// أصلاً: التنقّل.**
// ⛔⭐⭐ **ولا يُقرأ المؤشّرُ في هذي الدالّة — والسببُ مقيسٌ لا احترازيّ:**
// **`enabled()` هي شرطُ تسلّحِ محرّك السكون، ويُحسب مرّةً عند تحميل الإعدادات**
// — **قبل أن يتحرّك المؤشّرُ أصلاً.** ⇒ **فشرطٌ يقرأ الفيديوَ تحت المؤشّر يُخرج
// `false` وقتها، فلا يتسلّح المحرّك، فلا تصل الحركةُ إليه، فلا يُبنى الشريطُ أبداً.**
// **وقِيس: `hostBarActive()` تُرجع `true` بعد الحركة، والطبقةُ غيرُ مبنيّة** —
// **حكمٌ صادقٌ في لحظة القياس عن آلةٍ ماتت قبله.**
// ⇒ ⭐ **فالحكمُ على الفيديو انتقل إلى `setHostBarShown` — «إخفاءٌ لا `return`»،
// وهو شكلُ #94 بحرفه** (`setSpeedBtnShown` تفعل الشيء نفسَه للسبب نفسِه).
// ── ⛔⭐⭐ #142ب — **السؤالُ «أثمّة ما يُنقِّل؟» لا «أثمّة أدوات؟»** ──────────────
// **العطبُ الذي وُلد منه (بلاغ المالك 2026-09-05، بعد تحقّقه):** الشريطُ في تيك
// توك **«يظهر أحياناً ثم يختفي ولا يعود»**، **وفي إنستقرام لا يظهر أصلاً.**
// ✅ **وأُعيد إنتاجُه محلياً بتوقيعه بحرفه** — أزرارُ خلاصةٍ تظهر بعد ثانيتين:
// **يظهر (ضوابطُ النطاق 0) ⇒ ثمّ يختفي (صارت 4) ⇒ ولا يعود.**
// ⇒ ⭐ **والسببُ أن شرطي كان «مضيفٌ لا يُظهر أدواته»، وأزرارُ الإعجاب والتعليق
// والمشاركة أدواتٌ في نظره** — **وهي أزرارُ خلاصةٍ لا أدواتُ مشغّل.**
// ⛔⭐⭐ **#143 — واستُبدل الاستدلالُ كلُّه بإعلانٍ، بقرار المالك 2026-09-06.**
// كان هنا `SEEK_CONTROL_SELECTOR` و`hostSeekLatch` و`hostShowsSeekControl`:
// **استدلالٌ عن نيّة المضيف** («أيملك ضابطاً يُنقِّل؟»)، **وقد أخطأ ثلاثاً**
// — أزرارُ الخلاصة قُرئت أدواتِ مشغّل (#142ب) · وشريطُ تيك توك في الرئيسية
// (#142ج) · **وبلاغُ المالك «الشريط يطبع على بعض المواقع السليمة»** (#143).
//
// ⇒ ⭐⭐ **والإعلانُ يُنهي الصنفَ بالبناء لا بالضبط:** قاعدةُ #94 (قرار 63)
// تشترط **سبباً موجباً لكلّ موضعٍ ترسم فيه ميزةٌ مبتدئة** — **وطلبُ المستخدم
// لهذا الموقع بعينه أقوى سببٍ موجبٍ يمكن أن يوجد**، وهو الذي كان الحدسُ ينوب
// عنه. ⇒ **حُذف ولم يُترك «للحالة التي نفع فيها»: وزنٌ مشحونٌ بلا مستعمِل
// كودٌ ميّت، ومستهلكُه الوحيد كان السطرَ الذي زال.**
//
// ⚠️ **وثمنُه مُعلَنٌ ومقبولٌ بقرار المالك: في موقعٍ مُضافٍ يملك شريطَه، يُرسم
// شريطُنا فوق شريطه.** ⭐ **والحدُّ المكتوب في #142 لم يعد حدّاً بل اختياراً**:
// كان «مضيفٌ بلا وسمٍ معياريّ لا يُميَّز» عيباً في القياس — **والآن لا قياسَ
// أصلاً، فالقائمةُ وحدَها تحكم.**

function hostBarEnabled() {
  if (!extensionActive()) return false;              // #64: الرئيسي ثم الحظر
  if (!overlaySettings.hostBar) return false;        // مفتاحٌ صريح، وافتراضُه مطفأ
  if (isYouTubeFamilyHost()) return false;           // ⛔ شرطُ المالك، بنيويّاً
  // ⭐ **#143 — والموقعُ مُعلَنٌ لا مُستدَلّ.** قائمةٌ فارغةٌ ⇒ لا يُرسم في أيّ
  // مكان، **وهو الصواب لا نقص**: ميزةٌ مبتدئةٌ بلا سببٍ موجبٍ تمتنع.
  // ⛔ **وسؤالُ المضيفِ ثابتٌ ما دام الإطارُ حيّاً** (تنقّلُ SPA لا يغيّر
  // `location.host`) — **فهو صالحٌ في `enabled()` وحدَها**، بخلاف سؤال الفيديو
  // الذي كلّفنا #142 ميزةً لا تُبنى أبداً.
  if (!overlaySettings.hostBarHosts.includes(baseDomain(location.host))) return false;
  return true;
}

// **الزمنُ يُكتب كما يكتبه المشغّلون**: بلا ساعةٍ ما لم تلزم
function hostBarTime(t) {
  if (!isFinite(t) || t < 0) t = 0;
  const sec = Math.floor(t % 60), min = Math.floor(t / 60) % 60, hr = Math.floor(t / 3600);
  const mm = hr ? String(min).padStart(2, "0") : String(min);
  return (hr ? hr + ":" : "") + mm + ":" + String(sec).padStart(2, "0");
}

// **يُنادى من حلقة الرسم القائمة وحدها** — ولا مؤقّتَ ثانٍ: الحلقةُ تقف بنفسها
// حين لا شيءَ معروض (شرطُ anySubElementVisible)، فالكلفةُ صفرٌ عند الإخفاء.
// ── ⛔⭐⭐ #142ز — **الربطُ يُعاد بعد أن تتحرّك الصفحة لا قبلها** ───────────────
// **العطبُ (بلاغ المالك 2026-09-06): بعد التمرير عبر أكثر من فيديو يخرج الشريطُ
// عن مكانه** — **أعرضَ من الفيديو ومزاحاً عنه.**
// ✅ **وأُعيد إنتاجُه بالقياس** (خلاصةٌ بثلاثة منشورات، تمريرٌ بالعجلة والمؤشّرُ
// ثابت): **الغلافُ `[263,-180,900,506]` وتحت المؤشّر منشورٌ مستطيلُه
// `[503,366,420,740]`** ⇒ **الغلافُ على منشورٍ والمؤشّرُ على آخر.**
// ⇒ ⭐⭐ **والسببُ توقيتٌ لا منطق: العجلةُ حدثٌ يسبق التمرير** — **فحين نُعيد الربطَ
// في مسارها تكون الصفحةُ لم تتحرّك بعد، فنقرأ الفيديو القديم** ⇒ **والشريطُ متأخّرٌ
// خطوةً أبداً، ويُصحّح نفسَه عند التمريرة التالية** (وهو ما رآه المالك: يخرج ثمّ يعود).
// ⇒ ✅ **والعلاج في الحلقة القائمة لا بمستمعٍ جديد**: **الحلقةُ تعمل بعد التخطيط
// بتعريفها**، **فتقرأ ما استقرّ لا ما كان.**
// ⚠️ **وثمنُه مخنوقٌ بالحدّ نفسِه الذي قبله المشروع لفحوص الاحتواء** (عشرٌ في
// الثانية)، **ولا يُدفع إلا والشريطُ معروض** — **والحلقةُ تقف بنفسها حين يُخفى.**
let vzHbBindCheckedAt = 0;

function updateHostBar() {
  if (!vzHostBar || vzHostBar.classList.contains("vzHidden")) return;
  const now = nowMs();
  if (now - vzHbBindCheckedAt >= IDLE_MOVE_THROTTLE_MS) {
    vzHbBindCheckedAt = now;
    const hovered = getVideoFromPointerPosition();
    // **إعادةُ الربط لا الإظهار**: `setHostBarShown` هي ممرُّ الربط الواحد،
    // **فلا نسخةَ ثانية من شروطها هنا** (وفيها الحكمُ على المضيف والمزلاج).
    if (hovered && hovered.tagName === "VIDEO" && hovered !== vzOverlayVideo) {
      setHostBarShown(true);
      return;                       // بُنيت الطبقةُ من جديد — والإطارُ التالي يرسم
    }
  }
  const video = vzOverlayVideo;
  if (!video) return;
  const cur = Number(video.currentTime) || 0;
  const dur = Number(video.duration);
  // ⚠️ **«مدّةٌ منتهية» شرطُ القضيب لا شرطُ الوقت** — والبثُّ يعرض وقتَه ولا قضيبَ
  // له: **قضيبٌ بلا نهايةٍ معلومة يرسم موضعاً لا معنى له** — إثباتٌ كاذب مرسوماً.
  const known = isFinite(dur) && dur > 0;
  vzHostBar.setAttribute("data-vz-live", known ? "0" : "1");
  if (vzHbTime) {
    vzHbTime.textContent = known
      ? hostBarTime(cur) + " / " + hostBarTime(dur)
      : hostBarTime(cur);
  }
  // ⭐ **الأيقونتان تتبدّلان بالحال لا بالنقرة** — **فحالُ الفيديو قد تتغيّر من
  // المضيف نفسِه** (تشغيلٌ تلقائيّ · كتمٌ من الصفحة)، **وزرٌّ يعرض غيرَ الحال
  // يَعِد بما لا يفعل.** ⛔ **ولا مستمعَ وسائط** (شرطُ #70 البنيويّ).
  const paused = !!video.paused;
  vzHostBar.querySelector(".vzHbPlayIcon")?.classList.toggle("vzHidden", !paused);
  vzHostBar.querySelector(".vzHbPauseIcon")?.classList.toggle("vzHidden", paused);
  const muted = !!video.muted || Number(video.volume) === 0;
  vzHostBar.querySelector(".vzHbVolIcon")?.classList.toggle("vzHidden", muted);
  vzHostBar.querySelector(".vzHbMutedIcon")?.classList.toggle("vzHidden", !muted);
  if (!known) return;
  const pct = Math.max(0, Math.min(1, cur / dur)) * 100;
  if (vzHbFill) vzHbFill.style.width = pct + "%";
  if (vzHbKnob) vzHbKnob.style.left = pct + "%";
  if (vzHbBuf) {
    let end = 0;
    try {
      const r = video.buffered;
      if (r && r.length) end = r.end(r.length - 1);
    } catch { end = 0; }
    vzHbBuf.style.width = (Math.max(0, Math.min(1, end / dur)) * 100) + "%";
  }
}

let vzHbDragging = false;

// ⛔⭐⭐ **والتنقّل يمرّ بـseek القائمة ولا مسارَ ثانٍ** — وهي تحمل قيوداً مقيسةً
// بثمنٍ طويل: نافذةُ التنقّل · ورفضُ التقديم حين تكون المدّةُ غيرَ منتهية
// (تجمّدُ تويتش المقيس في تشغيلتين). ⇒ **فالهدفُ يُحوَّل إلى فرقٍ وتُنادى هي** —
// **ومسارٌ ثانٍ للتنقّل يعني قيوداً تتباعد.**
function hostBarSeekToX(clientX) {
  const video = vzOverlayVideo;
  if (!video || !vzHbTrack) return;
  const r = vzHbTrack.getBoundingClientRect();
  if (!(r.width > 0)) return;                        // مستطيلٌ صفريّ لا يُقاس (قرار 22)
  const dur = Number(video.duration);
  if (!isFinite(dur) || !(dur > 0)) return;          // بثٌّ ⇒ لا سحب، والقضيبُ مخفيٌّ أصلاً
  const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  seek(video, ratio * dur - video.currentTime);
  updateHostBar();
}

function hostBarPointerMove(e) {
  if (!vzHbDragging) return;
  e.preventDefault();
  e.stopPropagation();
  hostBarSeekToX(e.clientX);
  markIdleActivity();      // **السحبُ نشاط**: فلا يختفي الشريطُ تحت الإصبع
}

function hostBarPointerUp(e) {
  if (!vzHbDragging) return;
  vzHbDragging = false;
  window.removeEventListener("pointermove", hostBarPointerMove, true);
  window.removeEventListener("pointerup", hostBarPointerUp, true);
  window.removeEventListener("pointercancel", hostBarPointerUp, true);
  if (e) { e.preventDefault(); e.stopPropagation(); }
  markIdleActivity();
}

function hostBarPointerDown(e) {
  if (!hostBarEnabled()) return;
  if (e.button !== undefined && e.button !== 0) return;   // اليسرى وحدها
  e.preventDefault();
  e.stopPropagation();
  vzHbDragging = true;
  window.addEventListener("pointermove", hostBarPointerMove, true);
  window.addEventListener("pointerup", hostBarPointerUp, true);
  window.addEventListener("pointercancel", hostBarPointerUp, true);
  hostBarSeekToX(e.clientX);
  markIdleActivity();
}

// ── ⭐ #142د — **زرُّ ملء الشاشة في شريطنا** ─────────────────────────────────
// **طلبُ المالك 2026-09-06**: أوّلُ أزرار المرحلة الثانية، **وأُفرد بكومِته.**
// ⭐ **ولم يحتج أيقونةً تُرسم**: «fit» **في سجلّ المالك سلفاً باسمها العربيّ
// «ملء الشاشة»** ⇒ **نُقلت بحروفها إلى سجلّ المنتَج ودخلت المشحون** — **ولا
// تُنسخ من سجلّ المرآة** (#145: ثلاثةُ حرّاسٍ أحمرّت على ذلك).
// ⚠️ **والأمرُ هو `ACTION:TOGGLE_FULLSCREEN` القائم لا مسارٌ ثانٍ** — **فيرث
// كلَّ ما في #58 و#17 و#140 من قيودٍ مقيسة**، ومنها اختيارُ الحاوية وزرُّ المضيف.
// ⛔ **والفيديو يُمرَّر صراحةً بالعلامة** (`__videoUnderPointer`) **كما يفعل زرّ
// السرعة**: فوق شريطنا يُرجع الباحثُ `null` بالتصميم، **فبلا التمرير يُنفَّذ
// الأمرُ على لا شيء.**
// ── ⭐ #142هـ — **زرّا التشغيل والصوت** (طلب المالك 2026-09-06) ───────────────
// **والأمران قائمان لا مساران جديدان**: `ACTION:TOGGLE_PLAY` و`ACTION:TOGGLE_MUTE`.
// ⛔⭐⭐ **والحالُ تُقرأ في حلقة الرسم لا بمستمعٍ للوسائط** — **وهذا شرطٌ بنيويّ
// لا اختيار**: `tools/test-idle-engine.js` **يشترط ألّا يوجد `volumechange` ولا
// `timeupdate` في الكود إطلاقاً** (أحداثُ الوسائط ليست نشاطاً، #70) ⇒ **فالأيقونةُ
// تتبدّل من `paused`/`muted` في الحلقة القائمة، بلا مستمعٍ ولا مؤقّتٍ ثانٍ.**
function hostBarActionClick(e, action) {
  if (e.button !== 0) return;
  if (!hostBarEnabled()) return;
  const video = vzOverlayVideo;
  if (!video) return;
  e.preventDefault();
  e.stopPropagation();
  runAction(action, Object.assign(e, { __videoUnderPointer: video }));
  updateHostBar();          // **الأيقونةُ تتبدّل الآن لا بعد إطارٍ** — فالنقرةُ تُرى
  markIdleActivity();
}

function hostBarPlayClick(e) { hostBarActionClick(e, "ACTION:TOGGLE_PLAY"); }
function hostBarMuteClick(e) { hostBarActionClick(e, "ACTION:TOGGLE_MUTE"); }

function hostBarFsClick(e) {
  if (e.button !== 0) return;              // اليسرى وحدَها
  if (!hostBarEnabled()) return;
  const video = vzOverlayVideo;
  if (!video) return;
  e.preventDefault();
  e.stopPropagation();
  runAction("ACTION:TOGGLE_FULLSCREEN", Object.assign(e, { __videoUnderPointer: video }));
  markIdleActivity();
}

function setHostBarShown(on) {
  let video = null;
  if (on && !hostBarEnabled()) on = false;
  if (on) {
    // ── ⛔⭐⭐ #142ج — **الفيديو تحت المؤشّر أوّلاً، والمربوطُ احتياطيّاً** ──────
    // **العطبُ (بلاغ المالك 2026-09-06، إنستقرام):** الشريطُ **ظاهرٌ فعلاً**
    // **ومرسومٌ خارج الشاشة** — والمقيس في متصفّحه: `after:true` **ورأسُ الشريط
    // عند `-968`** ⇒ **فوق النافذة بألف بكسل.**
    // ⇒ ⭐ **والسبب أن `speedBtnVideo()` تُفضّل المربوطَ ما دام موصولاً بالشجرة**
    // — **وفي الخلاصة يبقى فيديو المنشور السابق موصولاً بعد أن يصعد بالتمرير** ⇒
    // **فتتبعه طبقتُنا إلى حيث لا يُرى.**
    // ⭐⭐ **وهو يفسّر «يظهر بعد ما أضغط كلك» بحرفه**: مسارُ النقر **يُعيد الربط**
    // (`ensureVideoOverlay(hit.video)`)، **ومسارُ الحركة لا يفعل.**
    // ⚠️ **والاحتياطيُّ شرطٌ لا زينة**: فوق شريطنا نفسِه **يُرجع الباحثُ `null`**
    // (علامةُ الملكية بالتصميم) ⇒ **فبلا السقوط إلى المربوط يختفي الشريطُ من تحت
    // الإصبع لحظةَ لمسه** — وهو انحدار #12ب من بابٍ جديد.
    // ⛔ **ولا تُمسّ `speedBtnVideo` نفسُها**: يستهلكها زرّان وشارة، **وتغييرُها
    // يُغيّر ثلاثَ ميزاتٍ لم يُطلب فيها شيء** (قرار 16).
    const hovered = getVideoFromPointerPosition();
    video = (hovered && hovered.tagName === "VIDEO") ? hovered : speedBtnVideo();
    if (!video) return;                 // لا فيديو ⇒ لا شريط، وهو الصواب
    // ⭐ **#143 — وبقي شرطٌ واحدٌ من اثنين، والمحذوفُ غيرُ الباقي:**
    // **زال** «أيملك المضيفُ ما يُنقِّل؟» — استدلالٌ عن نيّته، وقرارُ المالك
    // أن قائمتَه تحكم وحدَها. **وبقي** `<video controls>`: **شريطُ المتصفّح
    // نفسِه** فيه التنقّلُ والتشغيلُ والصوت، **فشريطُنا فوقه شريطان بلا زيادة
    // قدرة**. ⭐ **وليس استدلالاً عن نيّة المضيف بل قراءةُ سمةٍ يعلنها هو**،
    // فلا يشاركُ المحذوفَ علّتَه.
    // ⚠️ **إخفاءٌ لا `return`** (علّةُ #94 نفسُها): المؤشّرُ ينتقل بين فيديوين
    // **بلا أن يمرّ سكون**، فلو خرجنا صامتين لبقي شريطُنا معروضاً على الخطأ.
    if (video.controls === true) on = false;
    else ensureVideoOverlay(video);
  }
  if (!vzHostBar) return;
  vzHostBar.classList.toggle("vzHidden", !on);
  if (on) { updateHostBar(); startOverlayTracking(); }
}

// **يتبع السكون كأخواته** — ⚠️ **ويمتنع ما دام الإصبعُ يسحب** (شكلُ لوحة #108):
// **المستهلكُ يُعلن، والمحرّكُ يسأل ولا يعرف لماذا.**
IDLE_CONSUMERS.hostBar = {
  enabled: hostBarEnabled,
  target: () => vzHostBar,
  // ⛔⭐⭐ #142ج — **الإعلانُ السابع للحدّ المعماريّ، وبه وحدَه يعمل العلاجُ أعلاه.**
  // **المحرّكُ يُعيد التطبيق عند الانتقال وحدَه** (نشط ⇄ ساكن)، **والانتقالُ لا يقع
  // بين حركةٍ وحركة** ⇒ **فربطُ الشريط بالفيديو تحت المؤشّر لا يُعاد حسابُه أبداً**،
  // **ويبقى على منشورٍ صعِد بالتمرير.** ✅ **ومقيسٌ في الرِكاز قبل الإعلان وبعده:
  // رأسُ الشريط عند -445 خارج الشاشة ⇒ ثمّ على الفيديو الثاني.**
  // ⭐ **وهذا بعينه ما وُضع له tracksPointer في #107** — **والمستهلكُ يُعلن أن
  // حالَه تتبع المؤشّر، والمحرّكُ يسأل ولا يعرف لماذا.**
  // ⚠️ **وثمنُه مُعلَنٌ محسوب**: المسارُ مخنوقٌ سلفاً بعشر فحوصٍ في الثانية،
  // **ولا يُدفع إلا حيث أُعلن التتبّع.**
  tracksPointer: () => true,
  suspended: () => vzHbDragging,
  onActive: () => setHostBarShown(true),
  onIdle: () => setHostBarShown(false),
  onDisabled: () => setHostBarShown(false)
};

// **الأحداث فوق الزرّ**: مستمعونا في `window`+`capture` يخرجون بالعلامة البنيوية
// (`videoFromStack`)، ثمّ يصل الحدث إلى الزرّ فيُنفّذ أمرَه — فلا تسابق ولا
// اعتماد على ترتيب التسجيل.
function speedBtnWheel(e) {
  if (!speedButtonActive()) return;
  const video = speedBtnVideo();
  if (!video) return;
  e.preventDefault();
  e.stopPropagation();
  runAction(`ACTION:SPEED:${e.deltaY < 0 ? "+" : "-"}${VZ_SPEED_STEP}`,
    Object.assign(e, { __videoUnderPointer: video }));
  syncSpeedBtnLabel(video);
  markIdleActivity();
}

function speedBtnClick(e) {
  if (e.button !== 0) return;            // اليمين والأوسط: بعد `S9`
  if (!speedButtonActive()) return;
  const video = speedBtnVideo();
  if (!video) return;
  e.preventDefault();
  e.stopPropagation();
  // «السرعة المفضّلة» هي `ACTION:SPEED:SET` القائمة **لا مفهومٌ ثانٍ** — وقلبٌ
  // بينها وبين 1x، فالزرّ الواحد يذهب ويعود بلا حالةٍ نحفظها.
  const pref = Number(overlaySettings.speedButtonPreset) || 2;
  const target = (video.playbackRate || 1) === pref ? 1 : pref;
  runAction(`ACTION:SPEED:SET:${target}`, Object.assign(e, { __videoUnderPointer: video }));
  syncSpeedBtnLabel(video);
  markIdleActivity();
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
  wakeIfVideoPresent(); // إطار نائم قد يكون حصل على فيديو لا يُطلق أحداث وسائط
  if (!zonesActive()) return;

  // #65: طبقة قابلة للتمرير فوق الفيديو تملك عجلتها — ولا تُفحص إلا حين يسبق
  // الفيديوَ شيءٌ في الكومة، فالمسار الشائع (المؤشّر على الفيديو) صفر فحص.
  const hit = getZoneAtEvent(e, true);
  if (!hit) return;

  const entry = zoneSettings?.wheel?.map?.[String(hit.zone)];
  if (!entry) return;

  const dir = e.deltaY < 0 ? "up" : "down";
  const actions = normalizeMappedActions(entry[dir]);
  if (!actions.length) return;
  ensureVideoOverlay(hit.video);   // #38أ: بعد تأكّد الربط لا قبله
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

// ---- Precedence: one source of truth for who owns a mouse button ----
// The most specific layer wins: zone binding > site rule > global rule. A zone
// is a spot the user aimed at deliberately, so a rule that covers the whole
// screen has no business overriding it. And when the specific layer wins the
// general one must not run AT ALL — not before it and not after.
//
// This has to be consultable from handleMouse too, because the generic path acts
// on MOUSEDOWN while the zone path acts on click/auxclick: the general rule was
// dispatched first by timing alone, so both ran on one press (audit #48).
const ZONE_TRIGGER_BY_BUTTON = { 0: "left", 1: "middle", 2: "right" };

function zoneClickBinding(e) {
  const which = ZONE_TRIGGER_BY_BUTTON[e.button];
  if (!which) return null;
  if (!zonesActive()) return null;
  const hit = getZoneAtEvent(e);
  if (!hit) return null;
  const actions = normalizeMappedActions(zoneSettings?.click?.map?.[String(hit.zone)]?.[which]);
  return actions.length ? { video: hit.video, zone: hit.zone, which, actions } : null;
}

// Same precedence for the keyboard: the square under the pointer owns the key
// before any site or global rule gets a look at it.
function zoneKeyBinding(video, sig) {
  if (!zonesActive()) return null;
  if (typeof lastPointer.x !== "number" || typeof lastPointer.y !== "number") return null;
  const zone = getZoneNumber(zoneRectForVideo(video), lastPointer.x, lastPointer.y);
  if (!zone) return null;
  const actions = normalizeMappedActions(zoneSettings?.key?.map?.[String(zone)]?.[sig]);
  return actions.length ? { zone, actions } : null;
}

// Zone-based click handler (left/middle/right click on a zone of a video)
function handleZoneClick(e) {
  const which = ZONE_TRIGGER_BY_BUTTON[e.button];
  if (!which) return false;
  // Left/middle fire on click/auxclick; right fires on contextmenu
  if (which === "right" && e.type !== "contextmenu") return false;
  if (which !== "right" && e.type !== "click" && e.type !== "auxclick") return false;

  const bind = zoneClickBinding(e);
  if (!bind) return false;
  const { actions } = bind;

  e.__videoUnderPointer = bind.video;
  ensureVideoOverlay(bind.video);   // #38أ: بعد تأكّد الربط لا قبله
  showOverlay(`Zone ${zoneLabel(bind.zone)} • ${which.toUpperCase()} CLICK → ${actions.join(" + ")}`);

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

// Chrome opens its autoscroll cursor on middle-button MOUSEDOWN, but the zone
// path acts on auxclick — so the command ran and the scroll cursor appeared at
// the same time. The generic remap path never had this because it preventDefaults
// on mousedown (audit #12). Kill the default only: no action runs here, so the
// binding still fires exactly once, on auxclick. And stay silent when the zone
// has no middle binding, so the page keeps its own middle-click behaviour.
function suppressMiddleClickDefault(e) {
  if (e.button !== 1) return false;
  if (!zoneClickBinding(e)) return false;
  e.preventDefault();
  return true;
}

window.addEventListener("click", handleZoneClick, true);
window.addEventListener("auxclick", handleZoneClick, true);
window.addEventListener("contextmenu", handleZoneClick, true);
window.addEventListener("mousedown", suppressMiddleClickDefault, true);
// -------------------------------------------------------------------------
let overlaySettings = { enabled: true, autoHideMs: 900, volumeAutoHideMs: 900, hintEnabled: true };

let idleWakeQueue = new Set();          // #125 — من صار مُشغَّلاً في هذي القراءة
async function loadOverlaySettings(pre) {
  const data = await settingsRead(pre);
  const s = data.settings || {};
  const o = s.overlay || {};
  // **الحالُ قبل الكتابة** — فالمقارنةُ تحتاج طرفين، والقديمُ يزول بعد سطور
  const wasOn = {};
  for (const it of barButtonsOf(overlaySettings)) wasOn[it.id] = it.on === true;
  const grid = Number(o.autoHideMs ?? 900);
  const vol = Number(o.volumeAutoHideMs ?? grid);
  overlaySettings = {
    enabled: o.enabled !== false && (grid > 0 || vol > 0),
    autoHideMs: grid,
    volumeAutoHideMs: vol,
    // البند #63 — افتراضه **الحالي (ظاهر)**: `!== false` لا `=== true`، فمن لم
    // يفتح الإعدادات قط لا يتغيّر سلوكه بحرف.
    hintEnabled: o.hintEnabled !== false,
    // ⚠️ **#71 — الشكل مقلوبٌ عن الذي فوقه عمداً، ولا يُوحَّد بهما:** ميزةٌ
    // **جديدة** افتراضها **مطفأ**، فـ`!!x` لا `!== false` (قرار المالك). و`!== false`
    // شكلُ المفتاح الرئيسي وحده — **والقسم [٤] من `tools/test-master-gate.js`
    // يشترطه هناك**، فخلطُ الشكلين يُطفئ إضافةَ من لم يفتح الإعدادات قط.
    speedBadge: !!o.speedBadge,
    // #70 · #107 — **وضعٌ ثلاثيّ لا مفتاح**، والافتراض `off` بالبناء (الكتلة
    // المتناظرة تُرجعه حين لا مفتاحَ ولا قديم). ⛔ **ولا `!!` هنا**: القيمةُ نصٌّ.
    progressBarMode: progressBarModeOf(o),
    speedButtonPreset: Number(o.speedButtonPreset) > 0 ? Number(o.speedButtonPreset) : 2,
    // #142 — **ميزةٌ جديدة ⇒ `!!x` لا `!== false`** (شكلُ #71): من لم يفتح
    // الإعدادات قطُّ لا يتغيّر عنده حرف.
    hostBar: !!o.hostBar,
    // #143 — قائمةُ المواقع. **مصفوفةٌ دائماً**، فقارئُها في `hostBarEnabled`
    // ينادي `.includes` بلا حارس: قيمةٌ تالفةٌ في التخزين تُقرأ فارغةً ⇒
    // **لا يُرسم**، وهو الفشلُ الآمن (بخلاف الرسم في كلّ مكان).
    hostBarHosts: Array.isArray(o.hostBarHosts) ? o.hostBarHosts : [],
    // ── ⛔⭐⭐ #120 — **الإسقاطُ يحمل القائمةَ محسوبةً مرّةً، ولا مفتاحَ زرٍّ مفرد**
    // **العطبُ الذي وُلد منه هذا السطر (2026-08-07، عند المالك):** كان هنا
    // `speedButton: !!o.speedButton` و`filterButton: !!o.filterButton`،
    // **وهذا الإسقاطُ يُنسَخ حقلاً حقلاً فلم يحمل `barButtons` قط** ⇒
    // **فبعد أن حذفت الهجرةُ المفتاحين القديمين قرأ المنتَجُ `undefined`** ⇒
    // **`!!undefined = false` ⇒ لا زرَّ إطلاقاً، والمحرِّرُ يقول «ظاهر»** لأنه
    // يقرأ التخزينَ مباشرةً. ⇒ ⭐ **«موضعان لحقيقةٍ واحدة» في لحظة الهجرة نفسِها.**
    //
    // ⇒ ⛔ **ولم يُعالَج بنسخ المفتاح إلى الإسقاط** (وهو أقربُ سطرٍ إلى اليد):
    // **ذاك يُصلح العَرَض ويترك كلَّ مفتاحٍ جديدٍ بعده معلَّقاً على سطرٍ يسقط
    // صامتاً** — **وقد سقط الآن.** ⇒ **بل يُحسب هنا مرّةً من `settings.overlay`
    // الحقيقيّ، ويقرأ الجميعُ مصدراً واحداً** (قرار 16ج: موضعٌ واحد يجعل الخطأ
    // مستحيلاً بدل أن يُحصى في قائمة).
    // ⚠️ **و`barButtonsOf` مُتَحايدة**: تُرجع القائمة كما هي إن وُجدت، **وتبذرها
    // من القديمين إن غابت** — **فالاستدعاءُ عليها ثانيةً لا يغيّر شيئاً.**
    barButtons: barButtonsOf(o)
  };
  // ── #125 — **من صار مُشغَّلاً الآن يُعامَل نشطاً، وحدَه** ────────────────────
  // ⭐ **والمعرفةُ هنا لا عند المُنادي:** هذا الموضعُ يرى القديمَ والجديد معاً،
  // **فلا يُمرَّر «ما تبدّل» في وسيطٍ يتباعد** (قرار 16د: الخطرُ يتناسب مع المسافة).
  // ⚠️ **والمُطفأُ لا يُعامَل نشاطاً**: إخفاؤه يقع في `applyIdleState` بمساره
  // المعتاد — **فالإيقاظُ للظهور وحدَه، ولا نُقحم أنفسنا في مسار الإخفاء.**
  for (const it of overlaySettings.barButtons) {
    const name = it.id === "speed" ? "speedButton" : "filterBtn";
    if (it.on === true && wasOn[it.id] === false) idleWakeQueue.add(name);
  }

  if (!overlaySettings.enabled) hideOverlayNow();
}

// -------- Overlay: Grid داخل الفيديو --------
// Held in a const because a document stylesheet never crosses a shadow boundary:
// when the overlay is moved into a shadow root the same text has to be adopted
// there too — see ensureOverlayStylesIn.
const OVERLAY_CSS = `
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
    /* ── #71: قناتان لا قناةٌ بمفتاح ──────────────────────────────────────
       المستوى والسرعة **حقيقتان مستقلّتان**، ورفعُ الصوت ثمّ تغييرُ السرعة
       **تتابعٌ عاديّ لا نادر**. فعقدةٌ واحدة تعني «آخر كاتبٍ يفوز»، ومؤقّتٌ
       واحد يعني أن مؤقّت إحداهما يُلغي الأخرى — **فالتزاحم يقع لا يُحتمل**
       (قرار المالك 2026-08-02).
       **والزاويتان متقابلتان** فتظهران معاً بلا تراكب: المستوى حيث كان،
       والسرعة في الزاوية المقابلة. والمظهر مشترك: soundDisplay تُورَّث كما
       هي بلا مفاتيح ثانية. ✅ **ودَينُ الاسم (#75) عُولج 2026-08-08 بالوسوم
       لا بالمفاتيح**: المفتاحُ المخزَّن باقٍ بحرفه (فلا هجرة)، **وما يراه
       المستخدم صار يقول «الشارات» لا «رقم الصوت»** — **فالمفاجئ كان الاسمَ
       لا الدلالة، والصفرُ يمنع القنوات كلَّها في showBadge بالبناء.**
       ⛔ **ولا علامةَ اقتباسٍ خلفية هنا: قالبٌ نصّيّ** — وقد أُغلق به هذا
       القالبُ فعلاً في أوّل صياغةٍ لهذا التعليق، وأمسكه lint-names. */
    .vzVolume,.vzSpeed,.vzCopyMsg{
      position:absolute; top:10px;
      color:var(--vz-volume-color, #fff);
      font:700 var(--vz-volume-size, 48px)/1 Arial, sans-serif;
      text-shadow:0 2px 10px rgba(0,0,0,.75);
      pointer-events:none;
      opacity:.98;
    }
    .vzVolume{ left:10px; }
    .vzSpeed{ right:10px; }
    /* #134 — تأكيدُ النسخ **بالشارة نفسِها**: لونُه ومقاسُه ومدّتُه من
       soundDisplay وvolumeAutoHideMs، ⛔ ولا مفتاحَ جديد ولا رقمَ ثانٍ.
       وموضعُه أسفلَ الوسط فلا يزاحم شارتَي الصوت والسرعة ولا يُخفي الشريط. */
    .vzCopyMsg{ left:50%; top:auto; bottom:14%; transform:translateX(-50%);
      font-size:calc(var(--vz-volume-size, 48px) * .5); white-space:nowrap; }
    /* ── #72: زرّنا في طبقتنا، لا في شريط المضيف ────────────────────────
       والسبب ليس ذوقاً (قرار المالك): قائمة محدِّدات المضيف هي ما قضينا
       الجلسة نزيله — multicam مات، والتضمين هجر ytp- كلها، وS7 أثبت أن
       11 من 59 لم يعد يطابق. فالحقن يشتري «يبدو أصيلاً» بعملةٍ تموت.
       ⚠️ **pointer-events:auto على الابن وحده لا على .vzWrap** — والطبقة
       تبقى شفّافة للأحداث كما كانت، فهذا أوّل عنصرٍ لنا يأخذ حدثاً. */
    /* #88 — **المقاس مشتقٌّ من قياس زرّ مشغّلٍ حيّ لا مكتوبٌ بيد** (2026-08-03):
       زرّ التشغيل **40×40** وزرّ الإعدادات **48×40**، وSVG يملأ الزرّ،
       وviewBox من 0 0 إلى 24 24، **والمسار تعبئةٌ بيضاء لا حدّ**.
       ⇒ **فالارتفاع 40 والأيقونة 24 والتعبئة بيضاء — مطابقةً بالعدّ لا بالوصف.**
       ⛔ **ولا نسخَ لمسار أصلٍ يملكه غيرُنا:** رُسم مسارُنا — قوسُ عدّاد ومؤشّرٌ
       ومحور — والمرجع نُظر إليه ولم يُنقل. */
    .vzBtn{
      position:absolute; right:10px; bottom:10px;
      pointer-events:auto; cursor:pointer;
      font:700 13px/1 Arial, sans-serif;
      color:#fff; background:rgba(0,0,0,.62);
      border:1px solid rgba(255,255,255,.28); border-radius:8px;
      height:40px; box-sizing:border-box;
      display:flex; align-items:center; gap:5px;
      padding:0 9px; min-width:44px;
      user-select:none;
      transition:opacity .12s linear;
    }
        /* #89 — **الوزن يُضبط هنا لا في المسار**: أيقونات السجلّ حدٌّ لا تعبئة،
       فتُلوَّن بـcolor. والمقاس 24 كما قِيس من أزرار المضيف. */
    .vzSpeedIcon{ width:24px; height:24px; flex:none; display:block; color:#fff; }
    /* ⛔⭐ #108 — **مقاسٌ صريح، والسببُ مقيسٌ لا احترازيّ:** بلا هذي القاعدة
       قِيست الأيقونةُ **0×0** والزرُّ **12px** بجوار جارٍ **56** في شريط يوتيوب
       (المحسوب عند المالك 2026-08-06) — **موجودٌ ولا يُرى، بلا رميةٍ
       ولا تحذير**. ⚠️ **ولا قاعدةَ مضيفٍ تفوز: «لا قاعدةَ تضبط مقاسَها» بالقياس**
       ⇒ **سطرٌ يُضاف ولا حدَّ يُكتب.**
       ⭐ **ولماذا لم تظهر محلياً:** الأيقونةُ تأخذ مقاسَها من حاويتها —
       **و .vzBtn تُعطيه (min-width:44px · height:40px)، و .vzInBar تُلغيه**
       (min-width:0 · position:static) ⇒ **فلا يبقى ما يُعطيها مقاساً هناك.**
       ⛔ **ويحرسه tools/test-icon-size.js: كلُّ صنف أيقونةٍ له قاعدةٌ بمقاسه**
       ⚠️ **ولا علامةَ اقتباسٍ خلفية في هذي الكتلة — هي قالبٌ نصّيّ، وقد وقعت
       ثلاثَ مرّات اليوم وأمسكها node --check في الثلاث.** */
    .vzFilterIcon{ width:24px; height:24px; flex:none; display:block; color:#fff; }
    /* #134 — **مقاسٌ صريح كأختيها** (وبلا القاعدة قِيست 0×0 عند المالك، #108).
       ⚠️ **والوزنُ سُبِر ولم يُقدَّر**: هي ممتلئةٌ لا مخطوطة و36-box لا 24،
       **فسُمكُها الوسيط 1.13px مقابل 1.88 لأختها.**
       ⛔ **وحدُّ 1.1 وحدَه لم يكفِ (تحقّقُ المالك: «أصغرُ حجماً»)** — **فالوزنُ
       عُولج والمقاسُ لم يُعالَج.** ✅ **فضُيّق الصندوقُ إلى حدود الرسم
       («4.5 4.5 27 27») وأُعيد سَبْرُ الوزن بعده لا قبله** ⇒ **0.4 مع الضلع 27
       يُعطي سُمك 1.88 = سُمكَ «speed» بحرفه.** ⛔ ولا يُعاد الرسم. */
    .vzCopyIcon{ width:24px; height:24px; flex:none; display:block; color:#fff;
      stroke:currentColor; stroke-width:0.4; stroke-linejoin:round; }
    /* #85 — داخل شريط المضيف: تُنزع زينةُ الطبقة ويُترك المقاس المقيس (40) */
    .vzBtn.vzInBar{
      position:static; right:auto; bottom:auto;
      background:none; border:0; border-radius:0;
      padding:0 6px; min-width:0; opacity:.9;
    }
    .vzBtn.vzInBar:hover{ background:none; opacity:1; }
    .vzSpeedNum{ font:700 13px/1 Arial, sans-serif; letter-spacing:.2px; }
    .vzBtn:hover{ background:rgba(0,0,0,.8); }
    .vzHidden{ display:none !important; }
    /* ── #108 — لوحةُ الفلاتر: شفّافة، قصيرة، تُمرَّر إن طال محتواها ────────
       **وشكلُها من لوحة إعدادات يوتيوب**: خلفيةٌ داكنة شفّافة وحوافُّ ناعمة.
       ⚠️ **و pointer-events:auto عليها وحدها لا على .vzWrap** — كما في .vzBtn.
       ⛔ **ولا علامةَ اقتباسٍ خلفية في هذي الكتلة**: هي قالبٌ نصّيّ، والعلامةُ
       تقطعه — وقد وقع ذلك مرّتين في يومٍ واحد، وأمسكه node --check في الحالين. */
    /* ⛔⭐⭐ #109 — **التمريرُ على الجسم لا على اللوحة**، والرأسُ وصفُّ المحفوظات
       يثبتان. **وهذا إصلاحُ عيبٍ قائم لا توسّعٌ في البند** (يُعلَّل كي لا يُقرأ
       بعد سنةٍ توسّعاً): كان التمريرُ على اللوحة نفسِها ⇒ **المفتاحُ الرئيسيّ
       و«إرجاعُ الكلّ» يُمرَّران بعيداً**، وهو مقيسٌ 2026-08-08. */
    .vzFilterPanel{
      position:absolute; right:8px; bottom:56px;
      width:min(300px, 92%); max-height:min(62%, 340px);
      display:flex; flex-direction:column; overflow:hidden;
      background:rgba(28,28,28,.92); color:#fff; border-radius:12px;
      padding:10px 12px; pointer-events:auto;
      font:12px/1.35 Arial, sans-serif; direction:rtl;
      box-shadow:0 8px 24px rgba(0,0,0,.45);
    }
    /* min-height:0 شرطٌ لا زينة: بدونها لا ينكمش ابنُ flex فلا يُمرَّر شيء.
       ⛔ ولا علامةَ اقتباسٍ خلفية هنا: قالبٌ نصّيّ — وقد أُغلق به هذا القالب
       فعلاً في أوّل صياغة، وهي سابعةُ العائلة. */
    .vzFilterPanel .vzFpBody{ overflow-y:auto; min-height:0; flex:1 1 auto; }
    .vzFilterPanel .vzFpHead, .vzFilterPanel .vzFpSave{ flex:none; }
    /* #109 — صفُّ المحفوظات: سطرٌ واحد، والرسالةُ تحته تمتدّ العرض كلَّه */
    /* #138 · #139 — **سطرٌ واحد بخمسة أعمدة**، وصار ممكناً بحذف زرّ التطبيق.
       ⭐ **والقياسُ حسم الشكل مرّتين، وخالف التوقّع في الأولى:**
       (١) **حذفُ زرٍّ لا يحذف صفّاً** — بسطرين بقي الجسمُ 166px والصفُّ 83px،
           **فالثمنُ لم يعد بحذف الزرّ وحدَه.**
       (٢) **وبضمّه إلى سطرٍ واحد: الجسم 196px والصفّ 53px** ⇒ **30px عادت
           = 1.7 صفَّ منزلقٍ مرئيّاً (10.9 بدل 9.2).**
       ⚠️ **والعرضان مقيسان لا مُقدَّران: حقلُ الاسم 122px والقائمة 122px** —
       **وستّةُ أعمدة (قبل حذف «تطبيق») كانت تسحقهما.** */
    .vzFilterPanel .vzFpSave{
      display:grid; grid-template-columns:1fr auto minmax(0,1fr) auto auto;
      gap:6px; align-items:center; padding-bottom:8px; margin-bottom:6px;
      border-bottom:1px solid rgba(255,255,255,.18);
    }
    .vzFilterPanel .vzFpPresetName, .vzFilterPanel .vzFpPick{
      min-width:0; background:rgba(255,255,255,.10); color:#fff;
      border:1px solid rgba(255,255,255,.22); border-radius:6px;
      padding:3px 6px; font:12px/1.3 Arial, sans-serif;
    }
    .vzFilterPanel .vzFpPick option{ background:#1c1c1c; color:#fff; }
    .vzFilterPanel .vzFpChip{
      background:rgba(255,255,255,.14); color:#fff; border:0; border-radius:6px;
      padding:3px 8px; cursor:pointer; font:12px/1.3 Arial, sans-serif; white-space:nowrap;
    }
    .vzFilterPanel .vzFpChip:hover{ background:rgba(255,255,255,.24); }
    .vzFilterPanel .vzFpChip:disabled{ opacity:.4; cursor:default; }
    .vzFilterPanel .vzFpNote{ grid-column:1 / -1; min-height:14px; font-size:11px; opacity:.75; }
    .vzFilterPanel .vzFpNote[data-vz-bad="1"]{ color:#ff9a8a; opacity:1; }
    .vzFilterPanel .vzFpHead{
      display:flex; align-items:center; justify-content:space-between;
      gap:8px; padding-bottom:8px; margin-bottom:6px;
      border-bottom:1px solid rgba(255,255,255,.18); font-weight:700;
    }
    .vzFilterPanel .vzFpGroup{ margin:8px 0 4px; opacity:.72; font-size:11px; }
    /* ⭐ **صفٌّ واحد لكلّ ضابط** (طلب المالك): الوسم · المنزلق · القيمة · الرجوع.
       **وسطران يُطيلان اللوحة بلا داعٍ** — والوسمُ القصير شرطُ هذا الصفّ (#77). */
    .vzFilterPanel .vzFpRow{
      display:grid; grid-template-columns:5.5em 1fr 3.2em auto;
      gap:8px; align-items:center; margin:5px 0;
    }
    .vzFilterPanel .vzFpName{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .vzFilterPanel .vzFpVal{ opacity:.7; font-variant-numeric:tabular-nums; text-align:end; }
    .vzFilterPanel input[type=range]{ width:100%; margin:0; accent-color:#3ea6ff; }
    .vzFilterPanel .vzFpReset{
      background:none; border:0; color:#fff; opacity:.65; cursor:pointer;
      font-size:14px; line-height:1; padding:2px 4px;
    }
    .vzFilterPanel .vzFpReset:hover{ opacity:1; }
    /* ⭐ **مفتاحٌ منزلق لا مربّعُ اختيار** — الشكلُ المُقرّ في #77، **ولا مفردةَ
       ثانية لضابطٍ واحد في المنتج نفسِه** (طلب المالك).
       ⚠️ **ونسخةُ المظهر هنا لا تُغني عن أصلها ولا تُلغيه:** ورقةُ الإعدادات
       لا تعبر إلى سكربت المحتوى، **وشحنُ مُولِّد #77 في كل إطارٍ لأجل مظهرٍ
       أغلى من نسخه** — **وهو حدٌّ مُعلَن لا سهو.**
       ⛔ **ولا علامةَ اقتباسٍ خلفية هنا: قالبٌ نصّيّ** (رابعةً اليوم). */
    .vzFilterPanel .vzFpSwitch{ cursor:pointer; display:flex; align-items:center; gap:6px; }
    .vzFilterPanel .vzFpSwitch input{ position:absolute; opacity:0; width:0; height:0; }
    .vzFilterPanel .vzFpTrack{
      width:34px; height:18px; border-radius:9px; background:rgba(255,255,255,.28);
      position:relative; transition:background .12s linear; flex:none;
    }
    .vzFilterPanel .vzFpTrack::after{
      content:""; position:absolute; inset-inline-start:2px; top:2px;
      width:14px; height:14px; border-radius:50%; background:#fff;
      transition:inset-inline-start .12s linear;
    }
    .vzFilterPanel .vzFpSwitch input:checked + .vzFpTrack{ background:#3ea6ff; }
    .vzFilterPanel .vzFpSwitch input:checked + .vzFpTrack::after{ inset-inline-start:18px; }
    /* **وزرُّ الإرجاع الشامل يُميَّز عن المفتاح بوسمه لا بموضعه** */
    .vzFilterPanel .vzFpResetAll{
      background:rgba(255,255,255,.12); border:0; color:#fff; cursor:pointer;
      font:600 11px/1 Arial, sans-serif; padding:5px 8px; border-radius:7px;
    }
    .vzFilterPanel .vzFpResetAll:hover{ background:rgba(255,255,255,.22); }
    .vzFilterPanel[data-vz-off="1"] .vzFpBody{ opacity:.45; }
    /* البند #47 — لا تنطبق إلا حين تُضاف السمة، أي في حالة واحدة: عنصر ملء
       الشاشة هو <video> نفسه. أنماط المتصفح الافتراضية لـ [popover] تفرض
       inset:0 و margin:auto وإطاراً وحشواً وخلفية — تُصفَّر كلها هنا فيبقى
       شكل الـ overlay كما هو بالضبط. left/top/width/height سطرية فتغلب. */
    /* ── ⭐⭐ #142 — شريطُ تقدّمٍ لمضيفٍ بلا أدوات ──────────────────────────
       ⚠️ **pointer-events:auto على الشريط وحده لا على .vzWrap** — كما في .vzBtn:
       الطبقةُ تبقى شفّافةً للأحداث، والشريطُ عنصرٌ يملك حدثَه بالوسم البنيويّ.
       ⚠️ **والمقاسُ من ارتفاعِ ما يُسحَب لا من ذوقٍ**: مساحةُ السحب 16px والقضيبُ
       4px — فحافّةٌ حادّةٌ بارتفاع 4 عطبٌ في الاستعمال (وهو درسُ #106 نفسُه).
       ⛔ ولا علامةَ اقتباسٍ خلفية هنا: قالبٌ نصّيّ. */
    .vzHostBar{
      position:absolute; left:0; right:0; bottom:0;
      display:flex; align-items:center; gap:10px;
      padding:10px 12px 12px; box-sizing:border-box;
      background:linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,0));
      pointer-events:auto; direction:ltr; cursor:default;
      font:600 12px/1 Arial, sans-serif; color:#fff;
      user-select:none; -webkit-user-select:none;
      text-shadow:0 1px 3px rgba(0,0,0,.8);
    }
    .vzHostBar .vzHbTime{ flex:none; font-variant-numeric:tabular-nums; min-width:82px; }
    .vzHostBar .vzHbTrack{
      position:relative; flex:1 1 auto; height:16px; cursor:pointer;
      display:flex; align-items:center; touch-action:none;
    }
    .vzHostBar .vzHbRail,
    .vzHostBar .vzHbBuf,
    .vzHostBar .vzHbFill{
      position:absolute; left:0; height:4px; border-radius:2px; pointer-events:none;
    }
    .vzHostBar .vzHbRail{ right:0; background:rgba(255,255,255,.3); }
    .vzHostBar .vzHbBuf{ width:0; background:rgba(255,255,255,.5); }
    .vzHostBar .vzHbFill{ width:0; background:#fff; }
    .vzHostBar .vzHbKnob{
      position:absolute; left:0; width:12px; height:12px; margin-left:-6px;
      border-radius:50%; background:#fff; pointer-events:none;
      box-shadow:0 1px 4px rgba(0,0,0,.6);
    }
    /* #142د — **زرُّ ملء الشاشة**: أيقونةُ المالك «fit» من سجلّ المنتَج.
       ⚠️ **والمقاسُ صريحٌ بسببٍ مقيس** (#108): بلا قاعدةٍ تُعطيه مقاساً تُقاس
       الأيقونةُ 0×0 — **موجودةٌ ولا تُرى، بلا رميةٍ ولا تحذير**. */
    .vzHostBar .vzHbBtn{
      flex:none; width:32px; height:32px; border-radius:7px; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
    }
    .vzHostBar .vzHbBtn:hover{ background:rgba(255,255,255,.18); }
    .vzHbIcon{ width:22px; height:22px; flex:none; display:block; color:#fff; }
    .vzHbPlayIcon{ width:22px; height:22px; flex:none; display:block; color:#fff; }
    .vzHbPauseIcon{ width:22px; height:22px; flex:none; display:block; color:#fff; }
    .vzHbVolIcon{ width:22px; height:22px; flex:none; display:block; color:#fff; }
    .vzHbMutedIcon{ width:22px; height:22px; flex:none; display:block; color:#fff; }
    /* ⛔⭐⭐ **ولا «fill» في هذي القواعد — والسببُ عطبٌ حيٌّ رآه المالك 2026-09-06:**
       **الراسمُ يضع «fill="none"» للمخطوطة و«fill="currentColor"» للممتلئة**،
       **وقاعدةُ CSS تغلب سمةَ العرض** ⇒ **فـ«fill:#fff» ملأت مستطيلَ أيقونة «fit»
       المخطوطة فظهرت مربّعاً أبيض.** ⭐ **واللونُ يأتي من «color» وحدَه، فالممتلئةُ
       تأخذه بـ«currentColor» والمخطوطةُ بالحدّ** — **وقاعدةٌ واحدة تكفي الشكلين.**
       ⚠️ **وأخواتُها الثلاث («vzSpeedIcon» · «vzFilterIcon» · «vzCopyIcon») لم تحمل
       «fill» قطّ** — **فكان شذوذي أنا لا عرفَ الملفّ.**
       ⭐ **صنفٌ لكلّ أيقونةٍ مشحونة** — حارسُ المقاس يقرأ الصنفَ من
       نداء الراسم ويشترط لكلٍّ قاعدةَ مقاسٍ صريحة، **وصنفٌ جامعٌ يُخفي واحدةً
       بلا مقاس** (وهي التي قِيست 0×0 في #108). */
    /* **مدّةٌ مجهولة (بثّ) ⇒ لا يُعرض قضيبٌ يكذب** — الوقتُ وحدَه */
    .vzHostBar[data-vz-live="1"] .vzHbTrack{ visibility:hidden; }
    .vzWrap[popover]{
      inset:auto; margin:0; border:0; padding:0;
      background:transparent; color:inherit; overflow:visible;
    }
    .vzWrap::backdrop{ background:transparent; pointer-events:none; }
  `;

function injectOverlayCSS() {
  if (document.getElementById("vz_overlay_css")) return;
  const style = document.createElement("style");
  style.id = "vz_overlay_css";
  style.textContent = OVERLAY_CSS;
  document.documentElement.appendChild(style);
}

let vzOverlay = null;            // .vzWrap — contains grid + hint + volume
let vzOverlayVideo = null;
let vzGridEl = null;
let vzHintEl = null;
let vzVolumeBadge = null;
let vzSpeedBadge = null;         // #71 — قناة ثانية، عنصرٌ مستقلّ لا حقلٌ مشترك
let vzSpeedBtn = null;           // #72 — زرّنا في طبقتنا
let vzCopyBtn = null;            // #134 — زرّ نسخ الرابط
let vzCopyBadge = null;          // #134 — وتأكيدُه، بقناةٍ في السجلّ الواحد
let vzFilterBtn = null;          // #108 — زرّ الفلاتر ولوحتُه
let vzFilterPanel = null;
// #142 — شريطُ التقدّم لمضيفٍ بلا أدوات، وأجزاؤه
let vzHostBar = null, vzHbTrack = null, vzHbFill = null, vzHbBuf = null,
    vzHbKnob = null, vzHbTime = null, vzHbFsBtn = null,
    vzHbPlayBtn = null, vzHbMuteBtn = null;
let vzOverlayHost = null;        // parent it's currently attached to (body or fullscreen el)
let vzTrackRafId = null;

function buildOverlayElement() {
  const el = document.createElement("div");
  el.className = "vzWrap";
  el.style.setProperty("--vz-volume-color", soundDisplaySettings.color);
  el.style.setProperty("--vz-volume-size", `${soundDisplaySettings.fontSize}px`);
  el.innerHTML = `
    <div class="vzGrid vzHidden">${'<div class="vzCell"></div>'.repeat(9)}</div>
    <div class="vzHint vzHidden">Zones</div>
    <div class="vzVolume vzHidden">100</div>
    <div class="vzSpeed vzHidden">1x</div>
    <div class="vzBtn vzFilterBtn vzHidden" role="button" tabindex="0" aria-label="فلاتر الصورة" data-vz-owns="wheel click">
      <!-- #108 — «filter-h» من سجلّ المالك، **منقولةٌ بحروفها لا مرسومة**.
           ⛔ **وكانت «enhance» مؤقّتاً** لأن المطلوبةَ لم تكن في السجلّ ولا في
           أصله — **ثمّ نُقلت من ملفّ المالك (icons (1).html) مع أختها
           «filter-v»** (2026-08-06). ⛔ ولا علامةَ اقتباسٍ خلفية هنا: قالبٌ نصّيّ. -->
      ${vzSvg(VZ_OWN_ICONS["filter-h"], { cls: "vzFilterIcon" })}</div>
    <div class="vzBtn vzSpeedBtn vzHidden" role="button" tabindex="-1" data-vz-owns="wheel click">
      <!-- #89 — **أيقونة \`speed\` من سجلّ المالك \`tools/icons.js\`، منقولةٌ لا مرسومة.**
           ومسارُنا المرسوم في #88 **حُذف** فلا موضعان لأيقونةٍ واحدة. -->
      ${vzSvg(VZ_OWN_ICONS["speed"], { cls: "vzSpeedIcon" })}<span class="vzSpeedNum">1x</span></div>
    <div class="vzBtn vzCopyBtn vzHidden" role="button" tabindex="-1" aria-label="نسخ رابط الفيديو" data-vz-owns="wheel click">
      ${vzSvg(VZ_OWN_ICONS["copy-link"], { cls: "vzCopyIcon", mode: "fill" })}</div>
    <div class="vzCopyMsg vzHidden"></div>
    <div class="vzHostBar vzHidden" data-vz-owns="wheel click">
      <div class="vzHbBtn vzHbPlay" role="button" tabindex="-1" aria-label="تشغيل / إيقاف">${vzSvg(VZ_OWN_ICONS["play"], { cls: "vzHbPlayIcon", mode: "fill" })}${vzSvg(VZ_OWN_ICONS["pause"], { cls: "vzHbPauseIcon", mode: "fill" })}</div>
      <div class="vzHbBtn vzHbMute" role="button" tabindex="-1" aria-label="كتم الصوت">${vzSvg(VZ_OWN_ICONS["volume"], { cls: "vzHbVolIcon", mode: "fill" })}${vzSvg(VZ_OWN_ICONS["muted"], { cls: "vzHbMutedIcon", mode: "fill" })}</div>
      <div class="vzHbTime">0:00</div>
      <div class="vzHbTrack" role="slider" aria-label="موضع التشغيل"><div class="vzHbRail"></div><div class="vzHbBuf"></div><div class="vzHbFill"></div><div class="vzHbKnob"></div></div>
      <div class="vzHbBtn vzHbFs" role="button" tabindex="-1" aria-label="ملء الشاشة">${vzSvg(VZ_OWN_ICONS["fit"], { cls: "vzHbIcon" })}</div>
    </div>
  `;
  applyGridVars(el); // يزرع الأرقام بـ textContent بعد بناء الخلايا
  return el;
}

// مصدر واحد لـ«ما هو عنصر ملء الشاشة بالنسبة لهذا الفيديو».
// داخل جذر ظل تُقرأ من الجذر لا من المستند: `document.fullscreenElement`
// **يُعاد استهدافه** إلى مضيف الظل، وهو عنصر لا يُرسم له صندوق بلا `<slot>`
// (البند #46). الجذر وحده يسمّي العنصر الحقيقي.
function fullscreenElementFor(video) {
  const root = video?.getRootNode?.();
  return (root?.host ? root.fullscreenElement : document.fullscreenElement) || null;
}

function preferredOverlayHost(video) {
  const root = video?.getRootNode?.();
  // A fullscreen <video> is a replaced element: children are fallback content and
  // never render, so it can never host the overlay. In that one case we leave the
  // overlay in its normal home and setOverlayTopLayer raises it instead (#47).
  const fs = fullscreenElementFor(video);
  const container = fs && fs !== video ? fs : null;

  // A video behind a shadow boundary gets its overlay inside that same root: it
  // is the only tree that still paints when something in there goes fullscreen.
  if (root?.host) return container || root;

  // Inside fullscreen, the fullscreen element is the only thing the browser paints.
  // Outside, body is fine since we use position:fixed (viewport coords).
  return container || document.body || document.documentElement;
}

// ── البند #47: التحصين للطبقة العليا ─────────────────────────────────────────
// حين يكون عنصر ملء الشاشة هو `<video>` نفسه لا يُرسم الـ overlay في أي مكان:
// الطبقة العليا وحدها تُرسم، و`<video>` عنصر مُستبدَل فأبناؤه محتوى بديل لا
// يُعرض. `popover` يرفع العنصر إلى الطبقة العليا نفسها فيُرسم فوق الفيديو.
//
// **manual لا auto عمداً**: الـ auto يُغلق بـ Esc وبالنقر خارجه، ويطرد أي
// popover آخر مفتوح على الصفحة. الـ manual لا يفعل شيئاً من ذلك، ولا يأخذ
// التركيز لأن الـ overlay بلا `autofocus` وبلا عنصر قابل للتركيز أصلاً.
//
// **ولا أثر على المسار الحالي إطلاقاً**: السمة لا تُضاف إلا في هذه الحالة
// وحدها، وبدونها لا تنطبق أنماط المتصفح لـ `[popover]` فلا يتغيّر شيء. القياس
// الميداني على ثمانية مواقع يقول إن الحالة لا تقع اليوم — تحصين لا إصلاح.
const OVERLAY_CAN_POPOVER =
  typeof HTMLElement === "function" && typeof HTMLElement.prototype.showPopover === "function";

// الحالة **الوحيدة** التي لا يُرسم فيها الـ overlay بلا الطبقة العليا.
function overlayNeedsTopLayer(video) {
  return !!video && fullscreenElementFor(video) === video;
}

function isPopoverOpen(el) {
  try { return el.matches(":popover-open"); } catch { return false; }
}

function setOverlayTopLayer(on) {
  if (!vzOverlay) return;

  if (!on) {
    // المسار العادي يخرج من هنا بلا لمس أي شيء: السمة لم تُضَف أصلاً.
    if (!vzOverlay.hasAttribute("popover")) return;
    try { if (isPopoverOpen(vzOverlay)) vzOverlay.hidePopover(); } catch {}
    vzOverlay.removeAttribute("popover");
    return;
  }

  if (!OVERLAY_CAN_POPOVER) return;
  if (!vzOverlay.hasAttribute("popover")) vzOverlay.setAttribute("popover", "manual");
  if (isPopoverOpen(vzOverlay)) return;
  try {
    vzOverlay.showPopover();
  } catch {
    // درس البند #50: الاحتياطي الصامت يجب ألا يكون **أسوأ** مما كان.
    // `[popover]` بلا فتح يعني `display:none` — أي إخفاء الـ overlay في كل
    // الحالات لا في هذه وحدها. فإن تعذّر الرفع تُزال السمة فوراً.
    vzOverlay.removeAttribute("popover");
  }
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

// ⚠️ **#71 — تُعدُّ من السجلّ ولا تُعدَّد بيدها.** كانت ثلاثة أسطر مكتوبة، فقناةٌ
// رابعة تعني سطراً رابعاً **يُنسى**، فتظهر بلا أن تتبعها حلقة الرسم. والسجلّ
// `OVERLAY_PARTS` مُعرَّف أسفل (مع المُظهِر العامّ، فهما وحدة واحدة) — ولا مشكلة
// في الترتيب: هذه الدالّة **لا تُنادى إلا بعد تقييم الملف كاملاً**.
// وهذا درس البوّابات الإحدى عشرة (#64) في موضع أصغر: **لا قائمة تُحصي، بل موضعٌ
// واحد يُقرأ منه** — فالقناة الخامسة لا تحتاج تعديلاً هنا ولا في `hideOverlayNow`.
function anySubElementVisible() {
  for (const part of Object.values(OVERLAY_PARTS)) {
    const el = part();
    if (el && !el.classList.contains("vzHidden")) return true;
  }
  return false;
}

function startOverlayTracking() {
  if (vzTrackRafId != null) return;
  const tick = () => {
    if (!anySubElementVisible()) {
      vzTrackRafId = null;
      // ⚠️ **#38ب — تفريغ المرجع القويّ، بلا آلة دورة حياة جديدة.**
      // `vzOverlayVideo` كان يبقى مُمسِكاً بعنصر فيديو **بعد خروجه من الـDOM**
      // إلى نهاية عمر الصفحة (`teardownOverlay` لا تُنادى إلا عند التحوّل إلى
      // فيديو آخر، و`hideOverlayNow` تُخفي ولا تُفرّغ).
      // **والموضع هنا يجعل التغيير محايداً بالبرهان لا بالرجاء:** لا شيء معروض
      // (شرط الحلقة)، والعنصر **منفصل** — والمسار الوحيد الذي يقرأ المرجع بعدها
      // هو المسار السريع في `ensureVideoOverlay` وهو يشترط `video.isConnected`،
      // فكان سيسقط إلى الهدم وإعادة البناء على أي حال.
      if (vzOverlayVideo && !vzOverlayVideo.isConnected) vzOverlayVideo = null;
      return;
    }
    positionOverlayToVideo();
    updateHostBar();   // #142 — في الحلقة القائمة، ولا مؤقّتَ ثانٍ ولا rAF ثانٍ
    vzTrackRafId = requestAnimationFrame(tick);
  };
  vzTrackRafId = requestAnimationFrame(tick);
}

function attachOverlayToHost(host) {
  if (!vzOverlay || !host) return;
  // NOT host.contains(): after a fullscreen round-trip the overlay can be parked
  // inside any element under <body>, and contains() then answers "already here"
  // so it is never moved back — invisible for the rest of the page's life.
  // Only the direct parent decides (audit #46).
  if (vzOverlay.parentNode !== host) {
    host.appendChild(vzOverlay);
    ensureOverlayStylesIn(host.getRootNode?.());
  }
  vzOverlayHost = host;
  // بعد الإلحاق دائماً، ومن هنا وحده: هذه الدالة هي ممرّ كل مسارات الإلحاق
  // الثلاثة (إنشاء · إعادة استخدام · fullscreenchange)، ونقل العنصر في الـ DOM
  // يُغلق أي popover مفتوح فيلزم إعادة فتحه بعد كل نقلة (#47).
  setOverlayTopLayer(overlayNeedsTopLayer(vzOverlayVideo));
}

// A document stylesheet never crosses a shadow boundary, so the overlay carries
// its own copy into any shadow root it is moved into. The four gridAppearance
// variables travel with it already — applyGridVars writes them inline on .vzWrap
// — but their fallback values and the whole layout live in this sheet.
const overlayStyledRoots = new WeakSet();
function ensureOverlayStylesIn(root) {
  if (!root?.host || overlayStyledRoots.has(root)) return; // light DOM: nothing to do
  overlayStyledRoots.add(root);
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(OVERLAY_CSS);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } catch {
    const style = document.createElement("style");
    style.textContent = OVERLAY_CSS;
    root.appendChild(style);
  }
}

function teardownOverlay() {
  if (vzOverlay) vzOverlay.remove();
  vzOverlay = null;
  vzGridEl = null;
  vzHintEl = null;
  vzVolumeBadge = null;
  vzSpeedBadge = null;
  vzSpeedBtn = null;
  // #108 — والفلترُ يُرفع عن الفيديو الذي يخرج، فلا يبقى أثرٌ بلا لوحة
  try { if (vzOverlayVideo) vzOverlayVideo.style.filter = ""; } catch {}
  vzCopyBtn = null;
  vzCopyBadge = null;
  vzFilterBtn = null;
  vzFilterPanel = null;
  vzHostBar = null; vzHbTrack = null; vzHbFill = null; vzHbBuf = null;
  vzHbKnob = null; vzHbTime = null; vzHbFsBtn = null;
  vzHbPlayBtn = null; vzHbMuteBtn = null;
  vzOverlayVideo = null;
  vzOverlayHost = null;
  if (vzTrackRafId != null) {
    cancelAnimationFrame(vzTrackRafId);
    vzTrackRafId = null;
  }
}

// ---- BEGIN vzSvg ----
// ⛔⭐⭐ **الراسمُ الواحد لكلّ أيقونةٍ في المشروع** (#131) — **وكتلةٌ مُقترنةٌ
// بحروفها في ثلاثة ملفّات**: هنا (السجلّ) · `settings-ui.js` · `content.js`،
// **لأن `tools/` لا يُشحن فلا سبيل إلى استيرادها وقت التشغيل** — وهو النمطُ
// نفسُه الذي يحمله `baseDomain`، **و`tools/test-viewbox-source.js` يُحمّر على
// تباعدها.**
//
// ⛔⭐ **و`viewBox` حقلٌ إجباريٌّ بلا قيمةٍ افتراضية — يرمي ولا يُكمل:**
// **القيمةُ الافتراضية هي بعينها ما يجعل الفرضيّةَ الخاطئة تعيش صامتة** —
// أيقونةٌ بلا مقاسها كانت سترسم في مقاسٍ ليس مقاسَها **ولا يقول أحدٌ شيئاً**،
// **وذاك هو «الصوابُ المُعار» يوم يزول مُعيرُه** (قرار 131).
// ⇒ **فالفشلُ فوريٌّ وبصوتٍ عالٍ، لأن أيقونةً مرسومةً بمقاسٍ خطأ تُقرأ تصميماً.**
function vzSvg(it, opts) {
  const o = opts || {};
  if (!it || !it.d) return "";                      // مفتاحٌ مجهول ⇒ فراغٌ صامت (عقدٌ قائم)
  if (!it.viewBox) {
    throw new Error("[VZ] أيقونةٌ بلا viewBox — لا مقاسَ افتراضيّ: " + (o.cls || o.key || "?"));
  }
  const style = o.mode === "fill"
    ? 'fill="currentColor" aria-hidden="true"'
    : 'fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
  return '<svg' + (o.cls ? ' class="' + o.cls + '"' : "") +
    ' viewBox="' + it.viewBox + '"' +
    (o.size ? ' width="' + o.size + '" height="' + o.size + '"' : "") +
    ' ' + style + '>' + it.d + '</svg>';
}
// ---- END vzSvg ----

// ── #131 — **سجلُّ أيقونتينا المشحونتين: المقاسُ حقلٌ لا وسمٌ مكتوب** ────────
// ⛔⭐ **وكان `viewBox` مكتوباً بيدٍ في وسمَي SVG أدناه** — **وهو الموضعُ الذي
// سمّاه قرار 131 خطراً مؤجَّلاً: من يكتبه بيده يرث الفرضيّةَ ولا يرث مُعيرَها.**
// ⇒ **فصار حقلاً يقرؤه الراسمُ الواحد، ويرمي على غيابه.**
// ⚠️ **والمساران منقولان بحروفهما من `tools/icons.js`** — و`tools/test-icons.js`
// يُحمّر على تباعدهما عن السجلّ.
const VZ_OWN_ICONS = {
  "filter-h": { viewBox: "0 0 24 24", d: '<path d="M3.5 5H9.65"/> <path d="M17.35 5H20.5"/> <path d="M3.5 12H5.55"/> <path d="M13.25 12H20.5"/> <path d="M3.5 19H11.45"/> <path d="M19.15 19H20.5"/> <circle cx="13.5" cy="5" r="2.2" fill="currentColor" stroke="none"/> <circle cx="9.4" cy="12" r="2.2" fill="currentColor" stroke="none"/> <circle cx="15.3" cy="19" r="2.2" fill="currentColor" stroke="none"/>' },
  // #134 — **من السجلّ بحروفها، ولم تُسحب ثانيةً: كانت فيه سلفاً** بـviewBox
  // صريحٍ 36 (الحقلُ إجباريٌّ منذ #131) — **ومقاسُها يُضبط بالأنماط لا بالمسار.**
  "copy-link": { viewBox: "4.5 4.5 27 27", fillWeight: 0.4, d: '<path d="M21.9,8.3H11.3c-0.9,0-1.7,.8-1.7,1.7v12.3h1.7V10h10.6V8.3z M24.6,11.8h-9.7c-1,0-1.8,.8-1.8,1.8v12.3  c0,1,.8,1.8,1.8,1.8h9.7c1,0,1.8-0.8,1.8-1.8V13.5C26.3,12.6,25.5,11.8,24.6,11.8z M24.6,25.9h-9.7V13.5h9.7V25.9z"/>' },
  "speed": { viewBox: "0 0 24 24", d: '<path stroke-linecap="butt" d="M19.63 9.23 A9.0 9.0 0 0 1 21 14 L21.0 17.4 A1.6 1.6 0 0 1 19.4 19.0 L4.6 19.0 A1.6 1.6 0 0 1 3.0 17.4 L3.0 14.0 A9.0 9.0 0 0 1 16.23 6.05"/> <path fill="currentColor" stroke="none" d="M18.79 7.21 L13.68 15.09 A2.0 2.0 0 1 1 10.91 12.32 Z"/>' },
  // #142د — **من السجلّ بحروفها**: زرُّ ملء الشاشة في شريطنا، ومقاسُها
  // بالأنماط لا بالمسار. **و`tools/test-icons.js` يُحمّر على تباعدها عن السجلّ.**
  "fit": { viewBox: "0 0 24 24", d: '<rect x="2.5" y="5" width="19" height="14" rx="2"/> <path d="M6.6 16.4h3.3"/><path d="M6.6 16.4v-3.3"/> <path d="M17.4 7.6h-3.3"/><path d="M17.4 7.6v3.3"/> <path d="m6.6 16.4 10.8-8.8"/>' },
  // #142هـ — **منقولةٌ بحروفها من `tools/icons.js`** — و`tools/test-icons.js`
  // يُحمّر على تباعدها. **والمصدرُ سجلُّ المنتَج لا سجلُّ المرآة** (#145).
  "play": { viewBox: "25 11 22 26", d: '<path d="M 45,24 27,14 27,34"/>' },
  "pause": { viewBox: "0 0 36 36", d: '<path d="M 12.75 4.5 L 9.75 4.5 C 9.15 4.5 8.58 4.73 8.15 5.15 C 7.73 5.58 7.5 6.15 7.5 6.75 L 7.5 29.25 C 7.5 29.84 7.73 30.41 8.15 30.84 C 8.58 31.26 9.15 31.5 9.75 31.5 L 12.75 31.5 C 13.34 31.5 13.91 31.26 14.34 30.84 C 14.76 30.41 15 29.84 15 29.25 L 15 6.75 C 15 6.15 14.76 5.58 14.34 5.15 C 13.91 4.73 13.34 4.5 12.75 4.5 Z M 26.25 4.5 L 23.25 4.5 C 22.65 4.5 22.08 4.73 21.65 5.15 C 21.23 5.58 21 6.15 21 6.75 V 29.25 C 21 29.84 21.23 30.41 21.65 30.84 C 22.08 31.26 22.65 31.5 23.25 31.5 L 26.25 31.5 C 26.84 31.5 27.41 31.26 27.84 30.84 C 28.26 30.41 28.5 29.84 28.5 29.25 V 6.75 L 28.5 6.75 C 28.5 6.15 28.26 5.58 27.84 5.15 C 27.41 4.73 26.84 4.5 26.25 4.5 Z"/>' },
  "volume": { viewBox: "0 0 24 24", d: '<path d="M 11.60 2.08 L 11.48 2.14 L 3.91 6.68 C 3.02 7.21 2.28 7.97 1.77 8.87 C 1.26 9.77 1.00 10.79 1 11.83 V 12.16 L 1.01 12.56 C 1.07 13.52 1.37 14.46 1.87 15.29 C 2.38 16.12 3.08 16.81 3.91 17.31 L 11.48 21.85 C 11.63 21.94 11.80 21.99 11.98 21.99 C 12.16 22.00 12.33 21.95 12.49 21.87 C 12.64 21.78 12.77 21.65 12.86 21.50 C 12.95 21.35 13 21.17 13 21 V 3 C 12.99 2.83 12.95 2.67 12.87 2.52 C 12.80 2.37 12.68 2.25 12.54 2.16 C 12.41 2.07 12.25 2.01 12.08 2.00 C 11.92 1.98 11.75 2.01 11.60 2.08 Z"/><path d=" M 15.53 7.05 C 15.35 7.22 15.25 7.45 15.24 7.70 C 15.23 7.95 15.31 8.19 15.46 8.38 L 15.53 8.46 L 15.70 8.64 C 16.09 9.06 16.39 9.55 16.61 10.08 L 16.70 10.31 C 16.90 10.85 17 11.42 17 12 L 16.99 12.24 C 16.96 12.73 16.87 13.22 16.70 13.68 L 16.61 13.91 C 16.36 14.51 15.99 15.07 15.53 15.53 C 15.35 15.72 15.25 15.97 15.26 16.23 C 15.26 16.49 15.37 16.74 15.55 16.92 C 15.73 17.11 15.98 17.21 16.24 17.22 C 16.50 17.22 16.76 17.12 16.95 16.95 C 17.6 16.29 18.11 15.52 18.46 14.67 L 18.59 14.35 C 18.82 13.71 18.95 13.03 18.99 12.34 L 19 12 C 18.99 11.19 18.86 10.39 18.59 9.64 L 18.46 9.32 C 18.15 8.57 17.72 7.89 17.18 7.3 L 16.95 7.05 L 16.87 6.98 C 16.68 6.82 16.43 6.74 16.19 6.75 C 15.94 6.77 15.71 6.87 15.53 7.05"/><path d="M18.36 4.22C18.18 4.39 18.08 4.62 18.07 4.87C18.05 5.12 18.13 5.36 18.29 5.56L18.36 5.63L18.66 5.95C19.36 6.72 19.91 7.60 20.31 8.55L20.47 8.96C20.82 9.94 21 10.96 21 11.99L20.98 12.44C20.94 13.32 20.77 14.19 20.47 15.03L20.31 15.44C19.86 16.53 19.19 17.52 18.36 18.36C18.17 18.55 18.07 18.80 18.07 19.07C18.07 19.33 18.17 19.59 18.36 19.77C18.55 19.96 18.80 20.07 19.07 20.07C19.33 20.07 19.59 19.96 19.77 19.77C20.79 18.75 21.61 17.54 22.16 16.20L22.35 15.70C22.72 14.68 22.93 13.62 22.98 12.54L23 12C22.99 10.73 22.78 9.48 22.35 8.29L22.16 7.79C21.67 6.62 20.99 5.54 20.15 4.61L19.77 4.22L19.70 4.15C19.51 3.99 19.26 3.91 19.02 3.93C18.77 3.94 18.53 4.04 18.36 4.22 Z"/>' },
  "muted": { viewBox: "0 0 24 24", d: '<path d="M11.60 2.08L11.48 2.14L3.91 6.68C3.02 7.21 2.28 7.97 1.77 8.87C1.26 9.77 1.00 10.79 1 11.83V12.16L1.01 12.56C1.07 13.52 1.37 14.46 1.87 15.29C2.38 16.12 3.08 16.81 3.91 17.31L11.48 21.85C11.63 21.94 11.80 21.99 11.98 21.99C12.16 22.00 12.33 21.95 12.49 21.87C12.64 21.78 12.77 21.65 12.86 21.50C12.95 21.35 13 21.17 13 21V3C12.99 2.83 12.95 2.67 12.87 2.52C12.80 2.37 12.68 2.25 12.54 2.16C12.41 2.07 12.25 2.01 12.08 2.00C11.92 1.98 11.75 2.01 11.60 2.08ZM4.94 8.4V8.40L11 4.76V19.23L4.94 15.6C4.38 15.26 3.92 14.80 3.58 14.25C3.24 13.70 3.05 13.07 3.00 12.43L3 12.17V11.83C2.99 11.14 3.17 10.46 3.51 9.86C3.85 9.25 4.34 8.75 4.94 8.4ZM21.29 8.29L19 10.58L16.70 8.29L16.63 8.22C16.43 8.07 16.19 7.99 15.95 8.00C15.70 8.01 15.47 8.12 15.29 8.29C15.12 8.47 15.01 8.70 15.00 8.95C14.99 9.19 15.07 9.43 15.22 9.63L15.29 9.70L17.58 12L15.29 14.29C15.19 14.38 15.12 14.49 15.06 14.61C15.01 14.73 14.98 14.87 14.98 15.00C14.98 15.13 15.01 15.26 15.06 15.39C15.11 15.51 15.18 15.62 15.28 15.71C15.37 15.81 15.48 15.88 15.60 15.93C15.73 15.98 15.86 16.01 15.99 16.01C16.12 16.01 16.26 15.98 16.38 15.93C16.50 15.87 16.61 15.80 16.70 15.70L19 13.41L21.29 15.70L21.36 15.77C21.56 15.93 21.80 16.01 22.05 15.99C22.29 15.98 22.53 15.88 22.70 15.70C22.88 15.53 22.98 15.29 22.99 15.05C23.00 14.80 22.93 14.56 22.77 14.36L22.70 14.29L20.41 12L22.70 9.70C22.80 9.61 22.87 9.50 22.93 9.38C22.98 9.26 23.01 9.12 23.01 8.99C23.01 8.86 22.98 8.73 22.93 8.60C22.88 8.48 22.81 8.37 22.71 8.28C22.62 8.18 22.51 8.11 22.39 8.06C22.26 8.01 22.13 7.98 22.00 7.98C21.87 7.98 21.73 8.01 21.61 8.06C21.49 8.12 21.38 8.19 21.29 8.29Z"/>' }
};

function ensureVideoOverlay(video) {
  if (!video) return;
  injectOverlayCSS();

  if (vzOverlayVideo === video && vzOverlay && video.isConnected) {
    // Make sure it's still attached to the right host (fullscreen toggles, etc.).
    // Unconditional on purpose: attachOverlayToHost is a no-op when the parent is
    // already right, and comparing vzOverlayHost alone would miss a host tree that
    // re-rendered our overlay away — routine for a Web Component.
    attachOverlayToHost(preferredOverlayHost(video));
    positionOverlayToVideo();
    return;
  }

  teardownOverlay();
  vzOverlay = buildOverlayElement();
  vzGridEl = vzOverlay.querySelector(".vzGrid");
  vzHintEl = vzOverlay.querySelector(".vzHint");
  vzVolumeBadge = vzOverlay.querySelector(".vzVolume");
  vzSpeedBadge = vzOverlay.querySelector(".vzSpeed");
  vzSpeedBtn = vzOverlay.querySelector(".vzSpeedBtn");
  // على الزرّ نفسه لا على النافذة: عنصرٌ واحد يملك حدثه، ويُهدَم معه
  vzSpeedBtn?.addEventListener("wheel", speedBtnWheel, { passive: false });
  vzSpeedBtn?.addEventListener("click", speedBtnClick);
  // #108 — الزرُّ واللوحة: على عنصريهما لا على النافذة، ويُهدَمان معهما
  vzFilterBtn = vzOverlay.querySelector(".vzFilterBtn");
  vzFilterBtn?.addEventListener("click", filterBtnClick);
  // #134 — والثالثُ يمرّ بالمسار نفسِه: عنصرٌ يملك حدثَه ويُهدَم معه
  vzCopyBtn = vzOverlay.querySelector(".vzCopyBtn");
  vzCopyBadge = vzOverlay.querySelector(".vzCopyMsg");
  vzCopyBtn?.addEventListener("click", copyBtnClick);
  // #142 — الشريطُ يملك حدثَه على عنصره، ويُهدَم معه (كأخواته)
  vzHostBar = vzOverlay.querySelector(".vzHostBar");
  vzHbTrack = vzOverlay.querySelector(".vzHbTrack");
  vzHbFill = vzOverlay.querySelector(".vzHbFill");
  vzHbBuf = vzOverlay.querySelector(".vzHbBuf");
  vzHbKnob = vzOverlay.querySelector(".vzHbKnob");
  vzHbTime = vzOverlay.querySelector(".vzHbTime");
  vzHbTrack?.addEventListener("pointerdown", hostBarPointerDown);
  vzHbFsBtn = vzOverlay.querySelector(".vzHbFs");
  vzHbFsBtn?.addEventListener("click", hostBarFsClick);
  vzHbPlayBtn = vzOverlay.querySelector(".vzHbPlay");
  vzHbPlayBtn?.addEventListener("click", hostBarPlayClick);
  vzHbMuteBtn = vzOverlay.querySelector(".vzHbMute");
  vzHbMuteBtn?.addEventListener("click", hostBarMuteClick);
  vzFilterPanel = buildFilterPanel();
  vzOverlay.appendChild(vzFilterPanel);
  vzFilterPanel.addEventListener("wheel", filterPanelWheel, { passive: false });
  vzFilterPanel.addEventListener("input", filterPanelInput);
  vzFilterPanel.addEventListener("click", filterPanelClick);
  vzFilterPanel.addEventListener("keydown", filterPanelKeydown);   // #109 — Enter يحفظ
  renderFilterPresetList();
  // **يزول مع كلّ فيديو**: الغلافُ يُهدَم ويُبنى عند تبدّل الفيديو، فالتصفيرُ هنا
  resetVideoFilter(video);
  vzOverlayVideo = video;
  attachOverlayToHost(preferredOverlayHost(video));
  positionOverlayToVideo();
}

// #108 — Esc يُغلق اللوحة (والدالّة معرَّفةٌ في قسم الفلاتر أعلاه)
document.addEventListener("keydown", filterEscKeydown, true);
// #108 — وتبدُّلُ مصدر الفيديو يُصفّر الفلتر (والدالّة في قسم الفلاتر أعلاه)
document.addEventListener("loadstart", filterVideoLoadStart, true);

document.addEventListener("fullscreenchange", () => {
  if (!vzOverlay || !vzOverlayVideo) return;
  attachOverlayToHost(preferredOverlayHost(vzOverlayVideo));
  positionOverlayToVideo();
});

function showOverlay(text) {
  const ms = Math.max(0, Number(overlaySettings.autoHideMs ?? 0));
  if (ms <= 0) return; // Grid overlay disabled
  if (!vzGridEl || !vzHintEl) return;

  // البند #63: التلميح وحده يُطفأ — **والشبكة تبقى**، فمنصّات §8 و§9 و§10 تعتمد
  // ظهور الشبكة لا نصّ التلميح. إطفاء أحدهما لا يُسقط الآخر.
  vzHintEl.textContent = text || "Zones";
  vzGridEl.classList.remove("vzHidden");
  if (overlaySettings.hintEnabled) vzHintEl.classList.remove("vzHidden");
  else vzHintEl.classList.add("vzHidden");
  positionOverlayToVideo();
  startOverlayTracking();

  clearTimeout(showOverlay._t);
  showOverlay._t = setTimeout(() => {
    vzGridEl?.classList.add("vzHidden");
    vzHintEl?.classList.add("vzHidden");
  }, ms);
}
function hideOverlayNow() {
  for (const part of Object.values(OVERLAY_PARTS)) part()?.classList.add("vzHidden");
}

// ⚠️ **#71 — صارت تحسب النصّ وحده وتسلّمه للمُظهِر العامّ.** كل ما حُذف من هنا
// (المهلة · بناء الـoverlay · الكتابة · المؤقّت) **انتقل إلى `showBadge` كما هو
// لا كنسخةٍ منه**، فالمسار واحد لا اثنان يتباعدان. **وسلوك الصوت لم يتغيّر بحرف**
// — والحارس على ذلك `tools/test-volume-mute.js` القسم [8] بأرقامه نفسها.
function showVolumeIndicator(video) {
  if (!video) return;

  // Level and mute are independent facts (#35), so they get two channels in the
  // badge instead of one field that conflates them: the level always reads the
  // real value, and mute adds a mark beside it. Lowering the latent level of a
  // muted video has to be visible — a change with no feedback is a defect of its
  // own. Side effect worth having: "0" on the badge now means one thing only.
  // A text mark, not an emoji: a colour emoji ignores --vz-volume-color, and the
  // badge has to keep honouring the user's soundDisplay colour and size.
  // ⚠️ **الشارة تعرض ما سيسمعه المستخدم عند الفكّ، لا ما يقرأه العنصر وهو مكتوم**
  // (عقد الصوت ع3، قرار المالك 2026-07-31). فحيث يكتم المضيف بتصفير المستوى
  // ويخفي الكامن — تويتش — تُعرض **العلامة وحدها بلا رقم**.
  // **«مكتوم 0» ممنوعة: رقم نعلم أنه كاذب أسوأ من غياب الرقم.**
  const percent = Math.round((video.volume ?? 1) * 100);
  const text = video.muted
    ? (hostAdapterFor()?.hidesLevelWhenMuted ? "مكتوم" : `مكتوم ${percent}`)
    : String(percent);
  showBadge(video, "volume", text);
}

// ── #71 — سجلّ أجزاء الـoverlay، والمُظهِر العامّ ────────────────────────────
// **الموضع الواحد الذي تُقرأ منه القنوات**: تُعدّه `anySubElementVisible`
// و`hideOverlayNow` ويُخاطبه `showBadge`. **قناةٌ خامسة تُضاف هنا وحدها.**
// الشبكة والتلميح ليستا شارتين (لهما `showOverlay` بمهلتها)، لكنهما جزءان من
// الـoverlay فتدخلان السجلّ — **وإلا عادت الحلقة تُعدّد بيدها**.
// دوالّ لا مراجع مباشرة: العناصر تُعاد بناؤها في `ensureVideoOverlay`، فمرجعٌ
// مُجمَّد في السجلّ يشير إلى عقدةٍ خرجت من الـDOM.
const OVERLAY_PARTS = {
  grid:      () => vzGridEl,
  hint:      () => vzHintEl,
  volume:    () => vzVolumeBadge,
  speed:     () => vzSpeedBadge,
  speedBtn:  () => vzSpeedBtn,     // #72 — والقناة الخامسة لم تحتج تعديلاً هنا
  filterBtn: () => vzFilterBtn,    // #108 — والسادسة والسابعة كذلك: السجلُّ يكفي
  copyBtn:   () => vzCopyBtn,      // #134 — الثامنة
  copyMsg:   () => vzCopyBadge,    // #134 — والتاسعة: تأكيدُ النسخ، بآلة الشارة نفسِها
  filterPanel: () => vzFilterPanel,
  hostBar:   () => vzHostBar      // #142 — والعاشرة
};

// مؤقّتٌ **لكل قناة**: حقلٌ ساكن واحد كان يعني أن مؤقّت السرعة يُلغي مؤقّت الصوت
// فتبقى شارةٌ معلّقة على الشاشة. هذا نصف سبب قرار «عنصران لا عنصر».
const badgeTimers = {};

// المُظهِر العامّ — **نصٌّ وهويّة قناة، ولا فرع لكل سطر**. و`showVolumeIndicator`
// أوّل نادٍ له **لا نسخةٌ منه**: تحسب النصّ وحدها، وكلّ ما عداه هنا مرّة واحدة.
// ⚠️ **والمهلة `volumeAutoHideMs` تُورَّث كما هي بلا مفتاح ثانٍ** (قرار المالك)،
// **ومن ثَمّ `0` تعني «لا شارة» للقناتين معاً**. وهذا لا يُترك ليكذب: مربّع
// السرعة في الإعدادات **يُعطَّل بسببٍ مكتوب** عند 0 بدل أن يُضغط ولا يفعل (#24).
function showBadge(video, channel, text) {
  if (!video) return;
  const ms = Math.max(0, Number(overlaySettings.volumeAutoHideMs ?? 0));
  if (ms <= 0) return; // المؤشّر معطَّل

  ensureVideoOverlay(video);
  const el = OVERLAY_PARTS[channel]?.();
  if (!el || vzOverlayVideo !== video) return;

  el.textContent = text;
  vzOverlay?.style.setProperty("--vz-volume-color", soundDisplaySettings.color);
  vzOverlay?.style.setProperty("--vz-volume-size", `${soundDisplaySettings.fontSize}px`);
  el.classList.remove("vzHidden");
  positionOverlayToVideo();
  startOverlayTracking();

  clearTimeout(badgeTimers[channel]);
  badgeTimers[channel] = setTimeout(() => {
    el.classList.add("vzHidden");
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

async function loadRulesForThisHost(pre) {
  const data = pre || await chrome.storage.sync.get({
    globalSiteRules: { enabled: false, mappings: [] }
  });
  siteRules = data.globalSiteRules || { enabled: false, mappings: [] };
  buildMap();
}


// ── #168 — الدبلجة العربية لمقاطع يوتيوب (نسخةٌ تجريبيّة · فرع 168-dub-mac) ────────
// **صوتٌ عربيّ يقرأ ترجمةَ كلام الفيديو متزامناً معه، على صفحة المشاهدة** (AUDIT §17).
// ⭐ **كسولٌ بالبناء:** لا مؤقّتَ ولا مستمعَ ولا قراءةَ قبل أوّل «دبلِج» من البوب-أب — وما هنا
// دوالُّ تُعرَّف ولا تُنادى. **والتقاطُ النصّ في عالم الصفحة** (`yt_dub_main.js`، يحقنه البوب-أب
// عند الضغط وحدَه) **وكلُّ قرارٍ هنا** — فالدوالُّ الخالصة تُختبر في العقدة (`tools/test-dub-core.js`).
// ⛔ **ما لا يُلمس (قرارات المالك في §4):** لا `video.volume` ولا `playbackRate` (خ5) · **لا مستمعَ
// لأحداث الوسائط — مؤقّتٌ يقرأ الحال** (خ16) · **لا `pause()`/`resume()` للنطق أبداً** (📐 علّق
// طابورَ المتصفّح كلَّه) · **و`cancel()` بين `start` و`end` لجملتنا وحدَها** (يوقف ما يُنطق في أيّ تبويب).
// 🎯 **كلُّ رقمٍ هنا اختيارُ تصميمٍ يُثبَّت بعد 168أ إلا ما عليه 📐.**
const DUB_TICK_MS = 100;            // 🎯 نبضةُ المُجدوِل
const DUB_LEAD_S = 0.1;             // 🎯 نبدأ قبل موعد الجملة بقليل: كمونُ المحرّك
const DUB_GLUE_S = 0.8;             // 🎯 وتتمّةُ قطعةٍ لم تنتهِ بترقيمها تبدأ قبل موعدها بهذا حين يفرغ صوتُ سابقتها — لا فجوةَ وسطَ الكلام الجاري
// ⛔ ~~1.0 ث و60٪~~ (خ13) — **سُحبا 2026-11-01 بأذن المالك («الكلام متقطع وغير مفهوم») وبالسابقة:** تخطّي جملةٍ كاملة
// يقطّع الحكاية، وتأخّرٌ صغيرٌ يتراكم ثمّ يُستنفد في السكتات (📄 tongting · Yandex) ⇒ ثانيتان و30٪ — 🎯 يحكم فيهما أذنُه ثانيةً
// ⛔ ~~وضعُ الجمل: «تأخّرٌ فوق ثانيتين أو بقي من نافذتها أقلُّ من 30٪ ⇐ تُتخطّى» (`DUB_REMAIN_MIN` 0.3)~~ — **سُحبتا في الجولة
// الثالثة 2026-11-01 بحكم أذنه بنصّه: «توقفات غير منطقيه في الكلام في منتصف جمل عكس التشغيل في اضافه DubFlow ف الجمل لا تتقطع
// ويستمر في الحديث متزامنا مع الفديو»** ⇒ **الجملةُ تُنطق ولو بدأت متأخّرةً بعد سابقتها، أسرعَ** (حتى `DUB_AUTO_MAX`)، **ولا
// تُتخطّى إلا من تأخّرت فوق `DUB_BEHIND_MAX_S`** (إعلانٌ أو تبويبٌ نام) — **ومع «أوقف الفيديو حتى يجهز الصوت» لا يتراكم التأخّر**
const DUB_LATE_MAX_S = 2.0;         // 🎯 وضعُ العرض وحدَه: سطرٌ غاب عن الشاشة منذ أكثرَ من ثانيتين يُتخطّى
const DUB_BEHIND_MAX_S = 6;         // 🎯 وضعُ الجمل: لا تُتخطّى جملةٌ إلا متأخّرةً فوق ست ثوانٍ
// ⭐ **«يتوقّف الفيديو لحظةً حتى يجهز الصوت»** — قرارُ المالك 2026-11-01 («يتوقّف الفيديو لحظة (موصى)»، فكرةُ DubFlow (ب)):
// خيارٌ مفعّلٌ افتراضيّاً يُطفأ من البوب-أب، في وضع الجمل وحدَه (وضعُ العرض لا يعرف السطرَ قبل ظهوره)
const DUB_WAIT_MAX_MS = 3000;       // 🎯 أطولُ إيقافٍ واحد — ثمّ يكمل الفيديو ولو لم يجهز الصوت
// ⛔ ~~1.5 ث~~ — 📐 تصميمُ الجولة (محاكاةٌ على ملفٍّ بشكل المقيس): العربيّةُ أطولُ من الإنجليزيّة (تحتاج وسيطاً 1.52× من سرعة «حامد»)،
// فعند 1.5 ث يتوقّف الفيديو 3.4 مرّةً في الدقيقة ⇒ **التسريعُ يلحق أوّلاً** (`dubCapFor`) **والإيقافُ شبكةُ أمانٍ نادرة** (نحو 0.2 في الدقيقة)
const DUB_WAIT_BEHIND_S = 2.5;      // 🎯 الجملةُ التالية مستحقّةٌ منذ هذا وصوتُنا ما زال يتكلّم ⇐ يتوقّف الفيديو حتى يفرغ
const DUB_WAIT_BUDGET_MS = 20000;   // 🎯 وإيقافُ اللحاق هذا مرّةً كلَّ عشرين ثانيةً على الأكثر
// ⭐ اللحاقُ بالتأخّر: سقفُ السرعة الفعليّة يرتفع مع تأخّر الجملة عن موعدها — 1.4 حتى 0.3 ث، ثمّ 1.6 حتى ثانية، ثمّ R_max (1.91: أعلى ما
// فهمه المالكُ جملةً جملة، س21 · س23) — فلا يتراكم التأخّرُ ولا يتوقّف الفيديو، والسرعةُ العاليةُ للحاق وحدَه لا للعادة
const DUB_CATCH_LAG0_S = 0.3;
const DUB_CATCH_LAG1_S = 1.0;
const DUB_CATCH_MAX = 1.6;
// ⭐ ولصوت Azure سقفٌ أدنى للحاق: 1.7 لا R_max — 📐 تصميمُ الجولة: بـR_max نُطق 15٪ من الكلام الكثيف فوق 1.8× بسرعة «حامد»، و1.91 قيس
// على «ليلى» جملةً جملةً لا سماعاً متّصلاً؛ وصوتُ الجهاز يحتاج R_max ليلحق فيبقى له
const DUB_CATCH_CEIL_AZ = 1.7;
const DUB_FREEZE_MS = 400;          // 🎯 فيديو متجمّدٌ هذا القدرَ ⇐ صمت
const DUB_SEEK_S = 1.0;             // 🎯 قفزةٌ أكبرُ من ثانية ⇐ صمتٌ ثمّ استئنافٌ من الموضع
const DUB_AHEAD = 8;                // 🎯 جملٌ تُترجم أمام الموضع
const DUB_TR_INFLIGHT = 3;          // 🎯 §٣: ثلاثُ ترجماتٍ على الأكثر قيد التنفيذ
const DUB_CPS = 8.15;               // 📐 حروفٌ عربيّةٌ في الثانية بسرعة 1 («ليلى»، الماك: 8.0–8.3) — ثمّ يتعلّم
const DUB_R_MAX = 1.91;             // 📐 أعلى سرعةٍ فعليّة فهمها المالك في الجملتين (س21 · س23) = كروم 2
const DUB_RATE_CAP = 2;             // 📐 وسرعةُ كروم التي أعطتها — لا تُتجاوز ولو قال المنحنى 2.004
// ⭐ **سقفُ «التلقائيّة» غيرُ R_max:** R_max أعلى ما فُهم جملةً جملة، والسماعُ المتّصل أضيق — 📄 Yandex: «تسريعٌ فوق 30٪
// يمسّ الإدراك» · tongting يلحق بـ25٪ على الأكثر ⇒ 1.4 (🎯). **والسرعةُ الثابتة يختارها المستخدم حتى كروم 2.**
const DUB_AUTO_MAX = 1.4;
// 📐 سرعةُ كروم ⇐ السرعةُ الفعليّة على الماك («ليلى (محسّن)»، س4 · س21 · س24): **منحنى يُقلب لا قسمة**
const DUB_CURVE_MAC = [[1, 1], [1.5, 1.505], [2, 1.905], [2.5, 2.48], [3, 2.955], [4, 3.915]];
const DUB_SEG_GAP_A = 600;          // 🎯 مِجَسّ 5: فجوةُ بدءٍ تقطع جملةَ التلقائيّة (ms)
const DUB_SEG_CAP_A = 20;           // 🎯 وسقفُها بالكلمات
const DUB_SEG_GAP_M = 1200;         // 🎯 فجوةُ نهايةٍ إلى بدء تقطع جملةَ اليدويّة (ms)
const DUB_SEG_CAP_M = 25;           // 🎯 وسقفُها بالكلمات
const DUB_SEG_END_PAD = 500;        // 🎯 نافذةُ الجملة الأخيرة: نهايتُها + نصف ثانية
const DUB_BRIDGE_MAX = 20000000;    // 🎯 حدُّ طول الردّ من عالم الصفحة (حرفاً)
const DUB_STABLE_MS = 700;          // 🎯 سطرٌ يكبر (roll-up) يُعدّ مكتملاً إن سكن هذا القدر
const DUB_NOLINES_MS = 20000;       // 🎯 القراءةُ كما تظهر بلا سطرٍ عربيٍّ هذا القدر ⇐ يُقال (لعلّ الترجمةَ اختفت) — لا «يُدبلج» صامتاً
const DUB_HELLO = "بدأتِ الدبلجة";
// ── 168ح — أصواتُ Azure العصبيّة بمفتاح المالك (طلبُه 2026-11-01: «ممتاز طيب الان نبدا ب Azure») ──────────
const DUB_AZ_FORMAT = "audio-24khz-48kbitrate-mono-mp3";   // 📄 مخرجٌ صغير: نحو 24KB لأربع ثوانٍ
const DUB_AZ_BPS = 6000;            // 📄 48 kbit/s ثابتة ⇒ مدّةُ المقطع = حجمُه ÷ 6000 — تُعرف قبل تشغيله
const DUB_AZ_PER_MIN = 18;          // 📄 F0: 20 طلبَ نطقٍ في الدقيقة لا تُرفع ⇒ هامشٌ اثنان (🎯)
// ⛔ ~~`DUB_AZ_BURST` 4 — دلوٌ يمتلئ 18 في الدقيقة لكلّ تشغيلة~~ — **سُحب (مراجعة 168ح #2 · #8، مقيس): الدلوُ يُدخل السعةَ فوق
// المعدّل (4 + 18 = 22 في دقيقة)، ويمتلئ من جديد بكلّ «دبلِج» وينسى 429** ⇒ `dubAzGate`: سجلُّ نافذةٍ منزلقةٍ للصفحة
const DUB_AZ_TRIES = 2;             // 🎯 فشلٌ عابرٌ (شبكة · 204 · 429 · 5xx) لصوت جملةٍ يُعاد مرّةً (حَكَمُ الجولة) — والمفتاحُ المرفوضُ لا
const DUB_AZ_AHEAD = 3;             // 🎯 مقاطعُ يُجلب صوتُها أمام الموضع (⛔ ~~2~~: الجلبُ عند الحاجة يصنع السكتات)
const DUB_AZ_TIMEOUT_MS = 8000;     // 🎯 مهلةُ طلب الصوت
// ⛔ ~~بعد 429: دقيقةٌ بصوت الجهاز بلا طلب~~ — 📄 «أكثرُ 429 في النطق من سعة الخادم لصوتٍ في منطقة، لا من الحصّة»، ومايكروسوفت تطلب
// إعادةَ المحاولة (بحثُ الجولة الثالثة) ⇒ عشرُ ثوانٍ تتضاعف مع كلّ 429 متتالٍ حتى دقيقة، وأوّلُ نجاحٍ يُعيدها عشراً
const DUB_AZ_BACKOFF0_MS = 10000;   // 🎯 أوّلُ انتظارٍ بعد 429
const DUB_AZ_BACKOFF_MS = 60000;    // 🎯 وأطولُه
const DUB_AZ_TR_BATCH = 25;         // 🎯 مقاطعُ في طلب ترجمةٍ واحد (📄 الحدُّ 1000 عنصر و50 ألف حرف)
const DUB_TR_TIMEOUT_MS = 8000;     // 🎯 مهلةُ طلب الترجمة (مراجعة 168ح #11: بلا مهلةٍ كان طلبٌ معلَّقٌ يحبس المترجمَين)
const DUB_TR_FAILS = 3;             // 🎯 ثلاثةُ إخفاقاتٍ متتالية ⇐ مترجمُ Azure متوقّفٌ بقيّةَ التشغيلة (ويُقال)
const DUB_CPS_AZ = 12;              // 🎯 حروفُ صوت Azure في الثانية بسرعته الطبيعيّة — بدايةٌ ثمّ يتعلّم من مدّة كلّ مقطع
const DUB_UNIT_MIN_MS = 3500;       // 🎯 مقطعٌ أقصرُ يُضمّ إلى تاليه: أقلُّ من 18 طلباً في الدقيقة، وسياقٌ أطولُ للترجمة
const DUB_UNIT_MAX_MS = 9000;       // 🎯 ولا يطول بالضمّ لقِصَره فوق هذا   // جملةُ الإحماء: 📐 المحرّكُ يُسقط أوّلَ نطقين بعد خمس دقائق صمت
const DUB_UNIT_GAP_MS = 2000;       // 🎯 صمتٌ بثانيتين بين قطعتين لا يُضمّ عبره (📖 قاعدةُ DubFlow) — يسكت الصوتُ حين يسكت المتكلّم
const DUB_SENT_MAX_MS = 15000;
const DUB_TX_KEEP = 8;              // 🎯 نصوصٌ ملتقَطةٌ في ذاكرة سكربت الإضافة — وما يُنسى منها تبقى أحداثُه في ذاكرة الصفحة فيُعاد بلا طلب
const DUB_MAIN_VER = 3;             // ⭐ نسخةُ بروتوكول `yt_dub_main.js` — نسخةٌ قديمةٌ بقيت في صفحةٍ فُتحت قبل التحديث تُرفض بسببها      // 🎯 الجولة الثالثة: جملةٌ لم تنتهِ بترقيمها تُتمّ بما بعدها حتى هذا — لا يقف الصوتُ وسطَها

let dub = null;                     // ⭐ التشغيلةُ الجارية — null حتى أوّل «دبلِج»
let dubToken = 0;
let dubTr = null;                   // مترجمُ كروم، يُنشأ مرّةً في الصفحة
const dubTranscripts = new Map();   // "videoId|المصدر" ⇒ { sents, kind } — طولَ عمر الصفحة: لا يُرمى نصٌّ دُفع ثمنُه (مراجعة #15)
const dubCapP = new Map();          // المفتاحُ نفسُه ⇒ وعدُ التقاطٍ جارٍ: ضغطةٌ ثانية تنتظره ولا تطلب (مراجعة #10)
// ⭐ إجبارُ المشغّل (العرضُ أو الالتقاط) واحدٌ في الصفحة أبداً: تشغيلةٌ تبدأ تنتظر ما تركته التي أوقفتها، فإرجاعُ تلك
// (متزامنٌ عبر الجسر) يقع قبل لقطة هذه — وإلا عرضان متداخلان يتركان CC عربيّاً بلا إرجاع (مراجعة 2 #4 · #7 · #13)
let dubBridge = Promise.resolve();
// ⭐ حدُّ F0 **للصفحة لا للتشغيلة** (مراجعة 168ح #2 · #8): أزمنةُ طلبات النطق في آخر ستين ثانية، ومهلةُ ما بعد 429 —
// إعادةُ «دبلِج» لا تُفرغهما، فلا يُتجاوز العشرون ولا يُعاد إلى نافذةٍ رفضتنا
const dubAzGate = { log: [], until: 0, n429: 0 };

// البوّابةُ الواحدة أوّلاً (#64)، ثمّ النطاق: صفحةُ المشاهدة في الإطار الأعلى (§٢)
function dubActive() {
  return extensionActive() && isYouTubeHost() && window.top === window && location.pathname === "/watch";
}

function dubVideoId() {
  return new URLSearchParams(location.search).get("v") || "";
}

// الوسمُ الأوّل تماماً (درس #161: «ar» يطابق «Bulgarian» بالاحتواء)
function dubPrim(s) {
  return String(s || "").split(".")[0].split(/[-_]/)[0].toLowerCase();
}

// 📐 معرّفُ مسار الصوت «itag;base64(protobuf)» ⇐ «k=v:k=v» (مِجَسّ 8) — والنصُّ الصريحُ يمرّ، والمعطوبُ ⇐ ""
function dubXtDecode(x) {
  const s = typeof x === "string" ? x : "";
  if (!s || /(?:^|[:&,])(acont|lang)=/.test(s)) return s;
  const b = (s.indexOf(";") >= 0 ? s.slice(s.indexOf(";") + 1) : s).replace(/-/g, "+").replace(/_/g, "/");
  const out = [];
  let bin = "", i = 0;
  try { bin = atob(b + "===".slice(0, (4 - b.length % 4) % 4)); } catch { return ""; }
  const vi = () => {
    let r = 0, sh = 0, c = 0;
    do { c = bin.charCodeAt(i++); r += (c & 127) * Math.pow(2, sh); sh += 7; } while (c & 128 && i < bin.length);
    return r;
  };
  while (i < bin.length) {
    if (vi() !== 10) return "";
    const n = vi(), end = i + n;
    let k = "", val = "";
    if (!(n > 0) || !Number.isFinite(end) || end > bin.length) return "";
    while (i < end) {
      const tg = vi(), m = vi();
      if (!Number.isFinite(m) || i + m > end) return "";
      if (tg === 10) k = bin.slice(i, i + m); else if (tg === 18) val = bin.slice(i, i + m);
      i += m;
    }
    if (!/^[\x20-\x7e]+$/.test(k + val)) return "";
    out.push(k + "=" + val);
  }
  return out.join(":");
}

// مسارُ صوتٍ من عالم الصفحة ⇐ { lang, cur, def, auto, acont } — «;» بلا فكٍّ ليس لغة
function dubAudioNorm(t) {
  const o = t || {};
  const xt = [dubXtDecode(o.xtags), dubXtDecode(o.id), o.acont ? "acont=" + o.acont : ""].filter(Boolean).join(":");
  const xl = /(?:^|[:&,])lang=([^:&,]+)/.exec(xt), xa = /(?:^|[:&,])acont=([^:&,]+)/.exec(xt);
  const id = String(o.id || ""), semi = id.indexOf(";") >= 0;
  return { lang: dubPrim(o.li || (xl ? xl[1] : "") || (semi ? "" : id)), cur: !!o.cur, def: !!o.def,
    auto: !!o.auto || /dubbed-auto/.test(xt), acont: xa ? xa[1] : "" };
}

function dubCapNorm(c) {
  const o = c || {};
  return { code: String(o.code || ""), lang: dubPrim(o.code), asr: o.kind === "asr", variant: String(o.variant || ""),
    tlang: String(o.tlang || ""), ql: String(o.ql || ""), qk: String(o.qk || "") };
}

// ⭐ اختيارُ المسار — §٣ بترتيبه **وبقرارات المالك في فجواته (أ)–(هـ)** (اعتمدها كلَّها 2026-11-01):
// (أ) البثُّ أوّلاً · (١) الصوتُ الجاري عربيّ ⇐ لا شيء، ومسارٌ عربيٌّ غيرُ مختار ⇐ يُقترح (خ10) ·
// (ج) لغةُ الكلام عربيّة ⇐ لا شيء، **قبل** (٢) · (٢) يدويّةٌ عربيّة ⇐ تُنطق كما هي · (د) لغةُ الكلام
// **من التلقائيّة وحدَها** — بلاها مجهولة ⇐ (ب) «لا قاعدة» · خ12 الإنجليزيّةُ وحدَها · (٤) يدويّةٌ بلغة
// الكلام ⇐ تُترجَم · (٥) وإلا التلقائيّة · **(هـ) يُترك `tlang` و`variant=timing-optimized` وحدَهما**
// (نصُّ دبلجةٍ آليّة)، و`gemini` تلقائيّةُ الأصل تُؤخذ — والعاديّةُ قبلها إن وُجدتا.
function dubDecide(f) {
  if (f.live) return { k: "live" };
  const audio = f.audio || [];
  const ok = (f.caps || []).filter((c) => !c.tlang && c.variant !== "timing-optimized");
  const asr = ok.find((c) => c.asr && !c.variant) || ok.find((c) => c.asr) || null;
  const spoken = asr ? asr.lang : "";
  // (١) ووسمُ «ar» على المسار **الأصليّ** ليس دليلاً إن خالفته التلقائيّة (الفجوة د · مراجعة #17)؛ والدبلجةُ عربيّةٌ أبداً
  const isAr = (a) => a.lang === "ar" && (a.acont !== "original" || !spoken || spoken === "ar");
  if (audio.some((a) => a.cur && isAr(a))) return { k: "arNow" };
  if (audio.some(isAr)) return { k: "arOffer" };
  if (spoken === "ar") return { k: "arVid", spoken };
  const man = ok.filter((c) => !c.asr);
  const arM = man.find((c) => c.lang === "ar");
  if (arM) return { k: "speak", src: arM, spoken };
  if (!spoken) return { k: ok.length ? "other" : "none", spoken };
  if (spoken !== "en") return { k: "lang", spoken };
  const m = man.find((c) => c.lang === spoken);
  if (m) return { k: "manual", src: m, spoken };
  return { k: "asr", src: asr, spoken };
}

// ⭐ المُقسِّم — منقولٌ من مِجَسّ 5 بنصّه، وحالاتُه المعلومة نفسُها تُختبر هنا (`test-dub-core.js`).
// **يُختار المسارُ بشكل البيانات لا بالنوع:** فيها `tOffsetMs` ⇐ كلماتٌ بزمنٍ مطلق تُقطع عند فجوةِ بدء
// أو ترقيم أو سقف · وبلاها ⇐ **الحدثُ يُشقّ عند ترقيمه بزمنٍ نسبيّ لحروفه** ثمّ يُدمج حتى ترقيمٍ أو فجوة
// أو سقف (📐 ذراعُ يوتيوب `xpo,xwmhp` يدمج الكلمات في أحداثٍ مرقّمة). **و«؟» علامةٌ عربيّة تُضاف** لليدويّة العربيّة.
// المدخل: [tStartMs, dDurationMs, aAppend, [[utf8, tOffsetMs|null], …]] من عالم الصفحة، أو أحداثُ json3 نفسُها.
function dubSegment(raw) {
  const E = (raw || []).map((e) => (Array.isArray(e)
    ? { tStartMs: e[0], dDurationMs: e[1], aAppend: e[2] ? 1 : 0,
      segs: (Array.isArray(e[3]) ? e[3] : []).map((g) => ({ utf8: g[0], tOffsetMs: g[1] == null ? undefined : g[1] })) }
    : e));
  const clean = (s) => String(s || "").replace(/\[[^\]]*\]|♪+/g, " ").replace(/\s+/g, " ").trim();
  const nW = (s) => (String(s).trim() ? String(s).trim().split(/\s+/).length : 0);
  const PUNCT = /[.?!…؟]["'”’)»]*$/;
  // ⭐ الجولة الثالثة: **والعربيّةُ تُشقّ أيضاً** — 📐 في ملفّ ترجمة يوتيوب العربيّة تقع نهايةُ الجملة **وسطَ السطر** في 91 سطراً
  // مقابل 23 في آخره (كروم المالك 2026-11-01)، ولا حرفَ كبيراً بعدها ⇒ ما بعد العلامة حرفٌ أو رقمٌ عربيّ يكفي
  const SPLIT = /(?<=[.?!…؟]["'”’)»]*)(?<!(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs)\.)\s+(?=["'“‘(«]*[A-Z0-9ء-ي٠-٩])/;
  const cut3 = (e, eEnd, txt) => {
    const L = txt.length || 1, d = eEnd - e.tStartMs;
    let off = 0;
    return txt.split(SPLIT).map((p) => {
      const i = txt.indexOf(p, off);
      off = i + p.length;
      return { utf8: p, t: e.tStartMs + Math.round(d * i / L), end: e.tStartMs + Math.round(d * off / L) };
    });
  };
  const asr = E.some((e) => e && Array.isArray(e.segs) && e.segs.some((g) => g && g.tOffsetMs != null));
  const out = [], why = { gap: 0, punct: 0, cap: 0, end: 0 }, W = [];
  let drop = 0, cur = null;
  // وحدثُ سطرٍ جديدٍ فارغ («\n» في التمرير) لا يُحسب حدثاً — 📐 ملفُّ العربيّة نصفُه أحداثُه (294 من 588)، وبينها كان يقصّر
  // زمنَ السطر الذي قبله إلى لحظة السطر الجديد
  let F = E.filter((e) => e && Array.isArray(e.segs) && typeof e.tStartMs === "number" && !(asr && e.aAppend) &&
    e.segs.some((g) => g && String(g.utf8 || "").trim()));
  if (!asr) F = F.slice().sort((a, b) => a.tStartMs - b.tStartMs).reduce((o, e) => {
    const p = o[o.length - 1];
    if (p && p.tStartMs === e.tStartMs) {
      p.segs = p.segs.concat([{ utf8: " " }], e.segs.filter(Boolean));
      p.dDurationMs = Math.max(p.dDurationMs || 0, e.dDurationMs || 0);
    } else o.push({ tStartMs: e.tStartMs, dDurationMs: e.dDurationMs, segs: e.segs.filter(Boolean) });
    return o;
  }, []);
  F.forEach((e, ix) => {
    const eEnd = e.tStartMs + (e.dDurationMs || 0), sg = e.segs.filter(Boolean);
    const nxS = F[ix + 1] ? Math.max(e.tStartMs, F[ix + 1].tStartMs) : eEnd;
    (asr ? sg : cut3(e, e.dDurationMs > 0 ? Math.min(eEnd, nxS) : nxS, sg.map((g) => g.utf8 || "").join(""))).forEach((g) => {
      const w = clean(g.utf8);
      if (w) W.push({ t: asr ? e.tStartMs + (g.tOffsetMs || 0) : g.t, end: asr ? eEnd : g.end, w });
      else if (String(g.utf8 || "").trim()) drop++;
    });
  });
  W.sort((a, b) => a.t - b.t).forEach((w, i) => {
    const nx = W[i + 1];
    if (!cur) cur = { start: w.t, end: w.end, ws: [] };
    cur.ws.push(w.w);
    cur.end = asr ? (nx ? Math.min(nx.t, w.end) : w.end) : Math.max(cur.end, w.end);
    const gap = nx ? nx.t - (asr ? w.t : w.end) : 0;
    const k = !nx ? "end" : PUNCT.test(w.w) ? "punct" : gap >= (asr ? DUB_SEG_GAP_A : DUB_SEG_GAP_M) ? "gap"
      : nW(cur.ws.join(" ")) >= (asr ? DUB_SEG_CAP_A : DUB_SEG_CAP_M) ? "cap" : "";
    if (k) { why[k]++; out.push({ start: cur.start, end: Math.max(cur.end, cur.start), text: cur.ws.join(" ") }); cur = null; }
  });
  out.forEach((s, i) => { s.win = out[i + 1] ? out[i + 1].start - s.start : s.end - s.start + DUB_SEG_END_PAD; s.words = nW(s.text); });
  return { kind: asr ? "asr" : "manual", sents: out, why, drop };
}

// المنحنى المقيس: سرعةُ كروم ⇐ الفعليّة (للتعلّم من مدّة النطق)، ومقلوبُه: الفعليّةُ المطلوبة ⇐ سرعةُ كروم
function dubRealSpeed(rate, curve) {
  const c = curve || DUB_CURVE_MAC;
  if (!(rate > c[0][0])) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (rate <= c[i][0]) { const a = c[i - 1], b = c[i]; return a[1] + (rate - a[0]) * (b[1] - a[1]) / (b[0] - a[0]); }
  }
  return c[c.length - 1][1];
}

function dubChromeRate(real, curve) {
  const c = curve || DUB_CURVE_MAC;
  if (!(real > c[0][1])) return c[0][0];
  for (let i = 1; i < c.length; i++) {
    if (real <= c[i][1]) { const a = c[i - 1], b = c[i]; return a[0] + (real - a[1]) * (b[0] - a[0]) / (b[1] - a[1]); }
  }
  return c[c.length - 1][0];
}

// §٣ بعد إعلانٍ أو قفزةٍ أو توقّف: نستأنف من أوّل جملةٍ تبدأ عند الزمن الحاليّ أو بعده
function dubFirstAt(sents, ct) {
  for (let i = 0; i < sents.length; i++) if (sents[i].start / 1000 >= ct - 0.05) return i;
  return sents.length;
}

// ⭐ الجولة الثالثة — إلّا أن نكون في أوّل جملةٍ بدأت (ثانيةً ونصفاً منها أو أقلَّ من ثلثها): تُنطق هي متأخّرةً قليلاً بلحاقها — ⛔ ~~صمتٌ
// حتى التي بعدها~~ وقد تبعد مقاطعُ الجمل الكاملة 6–15 ث (تصميمُ الجولة G4: بدءٌ أو قفزةٌ إلى ما بعد أوّل الجملة بقليل) — خالص
function dubResyncAt(sents, ct) {
  const i = dubFirstAt(sents, ct), p = i > 0 ? sents[i - 1] : null;
  if (p && ct - p.start / 1000 <= Math.min(1.5, 0.3 * p.win / 1000)) return i - 1;
  return i;
}

// ⭐ الاستئنافُ بعد إيقافٍ أو تجمّد — **لا بعد قفز** (مراجعةُ الجولة #5 · #7) — خالص: ⛔ ~~يُعاد نطقُ جملةٍ قيلت كلُّها~~ ⇒ لا رجوعَ إلى ما قبل
// الموضع (`idx`) · **إلا جملةً قطعناها وسطَها** (`cut` — صوتُ الجهاز لا يتوقّف ويكمل): ⛔ ~~صمتٌ حتى التي بعدها~~ وقد تطول المقاطعُ حتى
// 15 ث ⇒ تُعاد من أوّلها ما دام الموضعُ في نصف نافذتها الأوّل وقبل حدّ التخطّي — فتُلحق بسرعة اللحاق
// ⛔ ~~والموضعُ في نافذتها~~ (تحقّقُ الجولة): التتمّةُ تبدأ قبل نافذتها بـ0.8 ث، والسبقُ عُشرٌ لكلّ جملة — إيقافٌ هناك كان يُسقطها صامتةً ⇒
// **منذ أبكر ما قد تبدأ** — ⛔ ~~بلا حدٍّ أدنى~~ (تحقّقُ الجولة الثاني): جملةٌ أبعدُ من ذلك أمام الموضع كانت تُقفز إليها فيصمت ما بينهما
function dubResumeAt(sents, ct, i, idx, cut) {
  const c = cut != null ? sents[cut] : null;
  const d = c ? ct - c.start / 1000 : 0;
  if (c && d >= -(DUB_GLUE_S + DUB_LEAD_S) && d <= Math.min(0.5 * c.win / 1000, DUB_BEHIND_MAX_S)) return cut;
  return Math.max(i, idx);
}

// مصدرُ «ترجمة يوتيوب»: ما يقرّره §٣ نفسُه — **إلا أنّ يوتيوب يترجم من أيّ لغةٍ إلى العربيّة**، فـ«لغةُ الكلام ليست
// الإنجليزيّة» (خ12: قيدُ مترجم الجهاز) لا تُرفض هنا: تُعرض يدويّةُ لغة الكلام أو تلقائيّتُه مترجمةً. وما يرفضه §٣ لغير ذلك يُرفض.
function dubYtSource(d, caps) {
  if (d.src) return d.src;
  if (d.k !== "lang") return null;
  const ok = (caps || []).filter((c) => !c.tlang && c.variant !== "timing-optimized");
  return ok.find((c) => !c.asr && c.lang === d.spoken) || ok.find((c) => c.asr && !c.variant) || ok.find((c) => c.asr) || null;
}

// الجولة الثالثة — ملفُّ ترجمة يوتيوب العربيّة كما ردّه المشغّلُ (أحداثٌ مضغوطة من عالم الصفحة) ⇐ مقاطعُ جملٍ كاملة **نصُّها
// العربيّةُ المعروضةُ نفسُها** (لا ترجمةَ منّا) — أو null إن لم يكن فيه كلام — خالص
function dubYtUnits(events) {
  const seg = dubSegment(events);
  if (!seg.sents.length) return null;
  return { kind: "ytar", sents: dubMergeUnits(seg.sents.map((x) => ({ start: x.start, win: x.win, end: x.end, text: x.text, ar: x.text }))) };
}

// ── «ترجمة يوتيوب كما تظهر» (طلبُ المالك 2026-11-01): **سطورُ الترجمة المعروضة على الفيديو** تُقرأ بنصّها ──
// السطرُ الواحد `.caption-visual-line` (وإلا مقاطعُه `.ytp-caption-segment`)، و[موسيقى] و♪ تُحذف كما في المُقسِّم.
// ⛔ **ونافذةُ الترجمة بلغتها:** 📖 `captions.js` يبني كلَّ نافذةٍ بـ`lang` مسارِها — ونافذةُ اسم المسار التي تظهر ثانيتين بعد
// اختياره («… >> Arabic · Click ⚙ for settings») ومعاينةُ الإعدادات بـ`lang="en"` مكتوباً ⇒ لو قُرئت النوافذُ كلُّها لنُطق اسمُ المسار جملةً
function dubCaptionLines(p) {
  if (!p) return [];
  // وعلاماتُ الاتّجاه الخفيّة (U+200E · U+200F · U+061C · U+202A–E · U+2066–9) تُنزع قبل المقارنة: سطرٌ واحدٌ لا يُعدّ سطرين
  const clean = (x) => String(x || "").replace(/[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\[[^\]]*\]|♪+/g, " ").replace(/\s+/g, " ").trim();
  const wins = Array.from(p.querySelectorAll(".caption-window"));
  const tagged = wins.some((w) => w.hasAttribute && w.hasAttribute("lang"));
  const scope = !wins.length ? [p] : tagged ? wins.filter((w) => dubPrim(w.getAttribute("lang")) === "ar") : wins;
  const out = [];
  for (const w of scope) {
    let els = w.querySelectorAll(".caption-visual-line");
    if (!els.length) els = w.querySelectorAll(".ytp-caption-segment");
    for (const e of els) { const t = clean(e.textContent); if (t) out.push(t); }
  }
  return out;
}

// ⭐ قرارُ العرض — خالص: سطرٌ جديدٌ على الشاشة يُنطق مرّةً واحدة؛ **وما زال معروضاً يُنطق ولو تأخّر** (لا نقطع
// كلاماً حاضراً)، **وما غاب عن الشاشة قبل دوره يُتخطّى** (خ13 بمعناه حين لا نعرف المواعيد مسبقاً).
// السرعةُ: مدّتُه المقدّرة ÷ ما بقي من نافذةٍ تُقدَّر من إيقاع الترجمة نفسِها (`win` بالمللي)، بين 1 وR_max.
function dubDisplayNext(pending, shown, now, win, cps, rMax, curve, fixed) {
  if (!pending) return { wait: "none" };
  if (!shown.includes(pending.line) && now - pending.at > DUB_LATE_MAX_S * 1000) return { skip: true };
  const remain = Math.max(0.6, (win - (now - pending.at)) / 1000);
  const need = pending.text.length / cps / remain;
  if (typeof fixed === "number" && fixed > 0) return { speak: true, rate: fixed, real: fixed, need };
  const real = Math.min(rMax, Math.max(1, need));
  return { speak: true, rate: Math.min(DUB_RATE_CAP, dubChromeRate(real, curve)), real, need };
}

// ⭐ قرارُ النبضة — خالص: أيّ جملةٍ تُنطق الآن وبأيّ سرعة، أم ننتظر، أم تُتخطّى.
// **قاعدتا التخطّي (خ13):** بدءٌ متأخّرٌ أكثرَ من ثانية · أو بقي من نافذتها أقلُّ من 60٪ (لا ننتظر خلف أنفسنا).
// **والسرعةُ:** مدّتُها المقدّرة بسرعة 1 ÷ ما بقي من نافذتها بزمن الساعة (سرعةُ الفيديو تقصّرها)،
// بين 1 وR_max، ثمّ تُقلب على المنحنى المقيس — جملةٌ لا تتّسع حتى بالسقف تُنطق به وتتخطّى ما بعدها.
// **و`fixed` سرعةُ كروم يختارها المستخدم** («تلقائيّة» ⇐ غائبة): تُنطق بها كلُّ جملة، والتخطّي بقاعدتيه.
// ⭐ سقفُ السرعة الفعليّة بحسب التأخّر (`DUB_CATCH_*`) — خالص
function dubCapFor(lag) {
  return lag <= DUB_CATCH_LAG0_S ? DUB_AUTO_MAX : lag <= DUB_CATCH_LAG1_S ? DUB_CATCH_MAX : DUB_R_MAX;
}

// ⛔ ~~وضعُ الجمل يتخطّى المتأخّرةَ ثانيتين أو ما بقي من نافذتها أقلُّ من 30٪~~ (سُحب في الجولة الثالثة — انظر `DUB_BEHIND_MAX_S`):
// **جملةٌ بدأت متأخّرةً بعد سابقتها تُنطق أسرعَ لا تُحذف**، و`behind` تأخّرُها لقرار الانتظار. **والسقفُ يرتفع مع التأخّر**
// (`dubCapFor`، مضروباً في سرعة الفيديو) **لا يتجاوز `rMax`** — من يمرّر سقفَ التلقائيّة يبقى عنده
function dubNext(sents, idx, ct, rate, cps, rMax, curve, fixed) {
  let skipped = 0;
  for (let i = idx; i < sents.length; i++) {
    const s = sents[i], st = s.start / 1000, win = Math.max(0.2, s.win / 1000), end = st + win, behind = Math.max(0, ct - st);
    // ⭐ التتمّة تُعرف بنصّ المصدر (`text`) كما يضمّ `dubMergeUnits` — ⛔ ~~بالعربيّة وحدَها~~: مترجمٌ يُسقط النقطةَ كان يجعل كلَّ جملةٍ
    // تامّةٍ «تتمّةً» فتبدأ قبل موعدها بـ0.7 ث (📐 رِكازُ كروم الحقيقيّ) — والعربيّةُ لمقطعٍ بلا نصّ مصدر
    const pv = i > 0 ? sents[i - 1] : null, pt = pv ? String(pv.text != null ? pv.text : pv.ar || "").trim() : "";
    // ⭐ وفي كلامٍ جارٍ وحدَه: ⛔ ~~وعبر صمتٍ بين القطعتين~~ — يتكلّم الصوتُ والمتكلّمُ ساكت (مراجعةُ الجولة #9)
    const glue = !!pt && !/[.?!…؟]["'”’)»]*$/.test(pt) && (pv.end == null || s.start - pv.end < DUB_GLUE_S * 1000);
    if (ct < st - (glue ? DUB_GLUE_S : DUB_LEAD_S)) return { i, skipped, wait: "early" };
    if (ct - st > DUB_BEHIND_MAX_S) { skipped++; continue; }
    if (s.ar == null) return { i, skipped, wait: "translate", behind };
    if (!s.ar) { skipped++; continue; }
    const wall = Math.max(0.2, (end - Math.max(ct, st)) / Math.max(0.25, rate));
    const need = s.ar.length / cps / wall;
    if (typeof fixed === "number" && fixed > 0) return { i, skipped, speak: true, real: dubRealSpeed(fixed, curve), need, rate: fixed, behind };
    const real = Math.min(rMax, dubCapFor(behind) * Math.max(1, rate), Math.max(1, need));
    return { i, skipped, speak: true, real, need, rate: Math.min(DUB_RATE_CAP, dubChromeRate(real, curve)), behind };
  }
  return { i: sents.length, skipped, done: true };
}

// الصوتُ العربيّ **بوسم اللغة لا بالاسم**؛ والاسمُ يُرجّح الجودةَ وحدَها (📐 المنحنى قيس على «ليلى (محسّن)»)
// — **وما اختاره المستخدمُ أوّلاً** إن كان صوتاً عربيّاً موجوداً على هذا الجهاز (`voiceURI`)
function dubPickVoice(list, uri) {
  const ar = (list || []).filter((v) => v && dubPrim(v.lang) === "ar");
  const mine = uri ? ar.find((v) => v.voiceURI === uri) : null;
  if (mine) return mine;
  const score = (v) => (v.localService ? 4 : 0) + (/(enhanced|premium|محسّن|محسن)/i.test(v.name || "") ? 2 : 0) +
    (/(laila|ليلى)/i.test(v.name || "") ? 1 : 0);
  return ar.length ? ar.slice().sort((a, b) => score(b) - score(a))[0] : null;
}

// ── 168ح: دوالُّ Azure الخالصة ───────────────────────────────────────────────────────
function dubXmlEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// جملةٌ بـSSML: الصوتُ ولغتُه منه، والسرعةُ نسبةٌ مئويّة من سرعته الطبيعيّة (📄 prosody rate بين 0.5 و2) —
// **وبسرعته الطبيعيّة بلا `<prosody>` أصلاً**: وسمُه يُحسب من الحروف المدفوعة (مراجعة 168ح #12) ولا يغيّر شيئاً. **والنصُّ يُهرَّب
// بأقلّ ما يلزمه** (`& < >`): 📄 كلُّ حرفٍ في الطلب مدفوع، و`&quot;` ستّةُ أحرفٍ مكانَ واحد — والسماتُ وحدَها تحتاج علامتَي الاقتباس
function dubSsml(text, voice, real) {
  const pct = Math.round((Math.max(0.5, Math.min(2, Number(real) || 1)) - 1) * 100);
  const m = /^([a-z]{2}-[A-Z]{2})-/.exec(String(voice || ""));
  const body = String(text == null ? "" : text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="' + (m ? m[1] : "ar-SA") + '">' +
    '<voice name="' + dubXmlEsc(voice) + '">' + (pct ? '<prosody rate="' + (pct > 0 ? "+" : "") + pct + '%">' + body + "</prosody>" : body) +
    "</voice></speak>";
}

// ⛔ ~~`dubBucketTake` — دلوٌ لكلّ تشغيلة~~ (مراجعة 168ح #2 · #8). **حدُّ F0 بنافذةٍ منزلقة — خالص:** السجلُّ بعد إسقاط ما مضت عليه
// ستون ثانية، وهل يُسمح بطلبٍ الآن (لا يأخذ مكاناً — صاحبُ الطلب يُسجّله): أقلُّ من DUB_AZ_PER_MIN في آخر ستين ثانية، ولا مهلةَ 429
function dubAzLimit(log, now, until) {
  const L = (log || []).filter((t) => now - t < 60000);
  return { ok: now >= (until || 0) && L.length < DUB_AZ_PER_MIN, log: L };
}

// حروفُ طلب النطق المدفوعة — 📄 تُحسب كلُّها إلا وسمَي `<speak>` و`<voice>` (مراجعة 168ح #12) — خالص
function dubAzBill(ssml) {
  return String(ssml || "").replace(/<\/?speak\b[^>]*>|<\/?voice\b[^>]*>/g, "").length;
}

// ⭐ الجولة الثالثة — سرعةُ تشغيل المقطع المجلوب: مدّتُه الفعليّة على ما بقي من نافذته بزمن الساعة، بين 1 والسقف
// (مقسوماً على ما طُلب به من سرعة) — فمقطعٌ أطولُ من نافذته يُسرَّع ولا يزحم ما بعده، والأقصرُ يُترك بسرعته — خالص
function dubAzFit(dur, remainWall, realAsked, cap) {
  if (!(dur > 0)) return 1;
  // ونافذتُه أُغلقت سلفاً (مقطعٌ متأخّر) ⇐ بسقفه — ⛔ ~~بسرعة 1~~ فكان المتأخّرُ أبطأَ من الذي في موعده (حَكَمُ الجولة)
  if (!(remainWall > 0)) return Math.max(1, cap / Math.max(1, realAsked || 1));
  return Math.max(1, Math.min(cap / Math.max(1, realAsked || 1), dur / remainWall));
}

// المقطع (⭐ الجولة الثالثة): **جملةٌ كاملةٌ أو أكثر.** ما لم ينتهِ بترقيمه ضُمّ إليه تاليه (حتى DUB_SENT_MAX_MS) — **فلا يقف الصوتُ
// وسطَ جملة** (ملاحظةُ المالك) — وما قصُر عن DUB_UNIT_MIN_MS ضُمّ إليه تاليه (حتى DUB_UNIT_MAX_MS): أقلُّ من 18 طلباً في الدقيقة،
// وسياقٌ أطولُ للترجمة. **ونصٌّ بلا ترقيمٍ أصلاً** (تلقائيّةٌ قديمة) يبقى بالنوافذ وحدَها كما كان. النافذةُ من بدء المقطع إلى بدء
// تاليه، فمقاطعُ متتاليةٌ تغطّي الزمنَ نفسَه بلا فجوة — خالص
function dubMergeUnits(sents) {
  const P = /[.?!…؟]["'”’)»]*$/;
  const ss = sents || [];
  const punct = ss.some((s) => P.test(String(s.text || "").trim()));
  const out = [];
  for (const s of ss) {
    const last = out[out.length - 1];
    const open = !!last && punct && !P.test(last.text.trim());
    const short = !!last && last.win < DUB_UNIT_MIN_MS;
    const gap = last && last.end != null && s.start - last.end >= DUB_UNIT_GAP_MS;
    if (last && !gap && ((open && last.win + s.win <= DUB_SENT_MAX_MS) || (short && last.win + s.win <= DUB_UNIT_MAX_MS))) {
      last.text += " " + s.text;
      last.ar = last.ar != null && s.ar != null ? last.ar + " " + s.ar : null;
      last.win += s.win; last.n++; last.end = s.end;
    } else out.push({ start: s.start, win: s.win, end: s.end, text: s.text, ar: s.ar == null ? null : s.ar, n: 1 });
  }
  return out;
}

// ذاكرةُ النصوص الملتقَطة بحدٍّ، والأحدثُ استعمالاً يبقى (مراجعةُ الجولة الثالثة #8 — ⛔ ~~بلا حدٍّ طولَ جلسة يوتيوب~~). **ولا يُدفع
// ثمنُ ما يُنسى:** أحداثُه في ذاكرة الصفحة (`MEM.req`) فتُعاد بلا طلب — خالص بخريطته
function dubTxKeep(map, key, t, max) {
  map.delete(key);
  map.set(key, t);
  while (map.size > max) map.delete(map.keys().next().value);
  return t;
}

// مفاتيحُ Azure ومناطقُه كما تصل من البوب-أب — تُتحقَّق قبل أن تدخل رابطاً أو ترويسة. **ومنطقةٌ كُتبت ولا تصلح يُقال عنها**
// (`bad`) — ⛔ ~~تُستبدل بـuaenorth صامتاً~~: مفتاحُ منطقةٍ أخرى كان يُرفض بـ401 فيُلام المفتاحُ لا المنطقة (مراجعة 168ح #15)
function dubAzOpts(x) {
  const o = x || {};
  const key = (k) => (typeof k === "string" && /^[A-Za-z0-9]{16,128}$/.test(k) ? k : "");
  const reg = (r) => (typeof r === "string" && /^[a-z0-9]{2,32}$/.test(r) ? r : "");
  const given = (r) => typeof r === "string" && r.trim() !== "";
  const voice = typeof o.voice === "string" && /^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/.test(o.voice) ? o.voice : "ar-SA-HamedNeural";
  return { key: key(o.key), region: reg(o.region) || "uaenorth", voice,
    trKey: key(o.trKey), trRegion: reg(o.trRegion) || reg(o.region) || "uaenorth",
    bad: given(o.region) && !reg(o.region) ? "region" : given(o.trRegion) && !reg(o.trRegion) ? "tr-region" : "" };
}

// ── الجسرُ إلى عالم الصفحة: نصٌّ JSON بحدٍّ، ويُقبل الردُّ بمعرّف طلبه وحدَه ──────────
function dubMainCall(op, args, ms) {
  return new Promise((resolve) => {
    const id = "vzd" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    let timer = 0;
    const onRes = (e) => {
      let m = null;
      try { m = typeof e.detail === "string" && e.detail.length <= DUB_BRIDGE_MAX ? JSON.parse(e.detail) : null; } catch { m = null; }
      if (!m || typeof m !== "object" || m.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener("__vz_dub_res__", onRes);
      resolve(m);
    };
    window.addEventListener("__vz_dub_res__", onRes);
    timer = setTimeout(() => { window.removeEventListener("__vz_dub_res__", onRes); resolve({ ok: false, reason: "main-missing" }); }, ms);
    window.dispatchEvent(new CustomEvent("__vz_dub_req__", { detail: JSON.stringify({ id, op, args: args || null }) }));
  });
}

function dubRefuse(run, reason, detail) {
  if (dub !== run || run.state === "stopped") return;
  run.state = "refused"; run.reason = reason; run.detail = String(detail || "").slice(0, 120); run.step = "";
  clearInterval(run.timer);
  dubWaitRelease(run);                                            // فيديو أوقفناه ننتظر صوتَه يكمل — لا يبقى موقوفاً بلا سبب
  dubUnshow(run);
  dubAzFree(run);
}

// مترجمُ كروم — 📐 متاحٌ لسكربت الإضافة ويُنشأ بعد التنزيل بلا إيماءة؛ **وأوّلُ تنزيلٍ يحتاج نقرةً حديثة**
// ⇒ يُطلب فورَ الضغط، قبل الالتقاط
async function dubTranslatorGet(run) {
  if (dubTr) return { ok: true, tr: dubTr };
  const T = globalThis.Translator;
  if (!T || typeof T.create !== "function") return { ok: false, reason: "no-translator" };
  let a = "";
  try { a = await T.availability({ sourceLanguage: "en", targetLanguage: "ar" }); } catch { a = ""; }
  if (a === "unavailable") return { ok: false, reason: "tr-unavailable" };
  try {
    const tr = await T.create({ sourceLanguage: "en", targetLanguage: "ar", monitor(m) {
      m.addEventListener("downloadprogress", (e) => { run.dl = Math.round(100 * (Number(e.loaded) || 0)); });
    } });
    dubTr = tr;
    return { ok: true, tr };
  } catch (e) { return { ok: false, reason: "tr-create", detail: String(e?.name || e) }; }
}

// ⛔ لا يُحكم بغياب الصوت العربيّ قبل `voiceschanged` (§٣)
function dubVoiceGet(uri) {
  const ss = globalThis.speechSynthesis;
  if (!ss || typeof SpeechSynthesisUtterance !== "function") return Promise.resolve(null);
  const pick = () => dubPickVoice(ss.getVoices() || [], uri);
  if (pick()) return Promise.resolve(pick());
  return new Promise((resolve) => {
    let done = false;
    const on = () => { if (pick()) fin(); };
    const fin = () => { if (done) return; done = true; ss.removeEventListener("voiceschanged", on); resolve(pick()); };
    ss.addEventListener("voiceschanged", on);
    setTimeout(fin, 3000);
  });
}

// جملةٌ تُنطق وننتظرها — تعود "heard" · "dropped" (📐 `end` بلا `start`: تبويبٌ مكتوم أو محرّكٌ نائم) ·
// "pending" (ما زالت في الطابور بعد المهلة: صوتٌ آخر يسبقنا). **وهي في `run.cur` حاجزاً حتى تنتهي** —
// فلا يُكدَّس خلفها شيء، وما يبدأ منها بعد المهلة يُقطع وهو بين `start` و`end` (مراجعة 2026-11-01 #8)
function dubSay(run, text) {
  return new Promise((resolve) => {
    let t = 0;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = run.voice; u.lang = run.voice.lang; u.rate = 1; u.volume = run.opts.volume;
    const c = { u, i: -1, started: false, ended: false, stale: false, at: performance.now(), t0: 0 };
    const done = (r) => { clearTimeout(t); resolve(r); };
    u.onstart = () => {
      c.started = true;
      if (c.stale || dub !== run || run.state === "stopped" || run.state === "refused") dubCancelOurs();
    };
    const fin = () => {
      if (c.ended) return;
      c.ended = true;
      if (run.cur === c) run.cur = null;
      done(c.started ? "heard" : "dropped");
    };
    u.onend = fin; u.onerror = fin;
    run.cur = c;
    t = setTimeout(() => { c.stale = true; done("pending"); }, 6000);
    speechSynthesis.speak(u);
  });
}

// ⛔ الموضعُ الوحيد لـ`cancel()`: يوقف ما يُنطق في أيّ تبويب ⇒ لا يُنادى إلا وجملتُنا بين `start` و`end`
function dubCancelOurs() {
  try { speechSynthesis.cancel(); } catch { /* لا نطقَ أصلاً */ }
}

// صمتٌ الآن: جملتُنا الجارية تُقطع؛ والتي لم تبدأ تبقى محجوزةً حتى تبدأ فتُقطع، أو تُسقطها المهلة
function dubSilence(run) {
  const c = run.cur;
  if (!c) return;
  c.stale = true;
  // صوتُ Azure عنصرٌ لنا وحدَنا: يُوقف فوراً، ولا طابورَ مشتركاً يُقطع ولا حاجزَ يُنتظر
  if (c.az) {
    clearTimeout(c.endT);
    if (c.audio) { try { c.audio.pause(); } catch { /* انتهى سلفاً */ } }
    // ⭐ مقطعٌ لم يُسمع بعدُ (يُجلب أو لم يبدأ) يُعاد إلى جملته — ⛔ ~~يُرمى ردُّه المدفوع ويُطلب ثانيةً عند كلّ تجمّد~~ (تحقّقُ الجولة الثاني:
    // 📐 خمسةُ طلباتٍ لجملةٍ واحدة في أربع دوراتِ تجمّد) ⇒ يُعاد نطقُها بالردّ نفسِه بلا طلب
    if (!c.started && c.clip && c.s && !c.s.clip && run.sents && run.sents[c.i] === c.s) { c.s.clip = c.clip; c.back = true; }
    else if (c.url) dubBlobFree(run, c.url);
    run.cur = null;
    return;
  }
  if (c.started && !c.ended) dubCancelOurs();
  run.cur = c.started ? null : c;
}

// ⭐ ما أسكتناه قبل أن يُتمّ يُذكر فيُعاد بعد الاستئناف إن بقي نصفُ نافذته (مراجعةُ الجولة #5) — ⛔ ~~صوتُ الجهاز الذي بدأ وحدَه~~ (تحقّقُ الجولة):
// ومقطعُ Azure يُجلب أو لم يُسمع بعد، ونطقُ الجهاز في الطابور، وما أسكتته سرعةٌ أو إعلان — كلُّها كانت تضيع صامتةً لا تُعدّ
function dubHold(run, why) {
  run.hold = why;
  const c = run.cur;
  // ⛔ ~~وحاجزٌ أسكته قفزٌ قبلُ~~ (`stale` — تحقّقُ الجولة الثاني): جملةُ ما قبل القفز ليست ما يُقال الآن، فلا تُعاد بعده
  if (c && !c.ended && !c.stale && c.i >= 0 && run.cutIdx == null) run.cutIdx = c.i;
  dubSilence(run);
  run.sync = true;
}

function dubStop(why) {
  const run = dub;
  if (!run || run.state === "stopped" || run.state === "refused") return;
  run.state = "stopped"; run.reason = why; run.hold = ""; run.step = "";
  clearInterval(run.timer);
  // فيديو أوقفناه ننتظر صوتَه **يكمل** — ⛔ ~~ويبقى موقوفاً في المصغّر أو بإطفاء الإضافة~~: المصغّرُ الفيديو نفسُه يكمل، والإطفاءُ لا يُبقي
  // إيقافاً لنا (مراجعةُ الجولة #8) · **إلا فيديو آخر** (`nav`): ما أوقفناه غادره المستخدم
  if (why === "nav") dubWaitEnd(run); else dubWaitRelease(run);
  dubSilence(run);
  dubUnshow(run);
  dubAzFree(run);
}

// ما أظهرناه من ترجمةٍ عربيّة يُعاد عند الإيقاف أو الرفض (عالمُ الصفحة يعرف ما غيّره وحدَه)
function dubUnshow(run) {
  if (!run.shown) return;
  run.shown = false;
  dubMainCall("hide", null, 3000);
}

// شروطُ الإيقاف بترتيب النبضة (§٣) — **تُفحص أثناء التجهيز أيضاً** بعد كلّ انتظار: مفتاحٌ أُطفئ أو فيديو
// غودر قبل أوّل نبضةٍ لا يُكمَل له التقاطٌ ولا تُنطق له جملةُ الإحماء (مراجعة #12)
function dubWhy(run) {
  if (!chrome.runtime?.id) return "orphan";                     // خ7: سكربتٌ يتيم بعد إعادة تحميل الإضافة
  if (!extensionActive()) return "gate";
  const p = document.querySelector("#movie_player");
  if (p && isInMiniPlayer(p)) return "mini";                    // خ15 — قبل التنقّل: المصغّرُ تنقّلٌ إلى غير /watch
  if (location.pathname !== "/watch" || dubVideoId() !== run.vid) return "nav";
  return "";
}

// ⭐ ساعةُ المحتوى: زمنُ العنصر ناقصاً ما يسبق به زمنَ المشغّل (إعلانٌ مُدمَجٌ في الخادم يُطيل العنصر
// ولا يُطيل المحتوى — مراجعة #6). يُقاس عند البدء وبعد كلّ إعلانٍ وقفزة وكلَّ خمس ثوانٍ، ونصفُ ثانيةٍ لا يُعدّ
function dubClock(run, shift) {
  if (run.clockBusy) return Promise.resolve();
  run.clockBusy = true;
  return dubMainCall("time", null, 400).then((t) => {
    run.clockBusy = false; run.offAt = performance.now();
    if (!t || !t.ok) return;
    run.trackLang = typeof t.tr === "string" ? t.tr : "";
    if (t.ad) return;
    // ⭐ وفي قياس نبضةِ ما بعد الإعلان (`shift`) يُنقل آخرُ موضعٍ قُرئ (`lastCt`) إلى الفارق الجديد — ⛔ ~~تراه النبضةُ التالية قفزةً إلى الوراء بطول
    // الإعلان~~ (تحقّقُ الجولة الحادي عشر) فتُسكت وتبدأ من جديد · ⛔ ~~في كلّ قياس~~ (الثاني عشر): نبضةُ القفز تعمل بالفارق القديم، فتغيّرُه بعدها قفزةٌ
    // هي ما يُصحّحها — قفزٌ يعبر إعلاناً مُدمَجاً كان يبقى بطوله بعيداً (صمتٌ أو جملةٌ قديمة) · ⛔ **ولا `readCt`**: ذاك موضعُ ما قبل الإعلان بفارقه
    const off = t.vt - t.pt, nOff = Math.abs(off) > 0.5 ? off : 0;
    if (shift && run.lastCt >= 0) run.lastCt -= nOff - (run.off || 0);
    run.off = nOff;
  });
}

async function dubPrepare(run) {
  const live = () => {
    if (dub !== run || run.state !== "preparing") return false;
    const why = dubWhy(run);
    if (why) { dubStop(why); return false; }
    return true;
  };
  const yt = run.opts.source === "yt", az = run.opts.engine === "azure";
  // منطقةٌ كُتبت ولا تصلح ⇐ يُقال قبل أيّ طلب، لا يُلام المفتاح (مراجعة 168ح #15)
  if ((az && run.opts.az.bad === "region") || (run.opts.source === "azure" && run.opts.az.trKey && run.opts.az.bad)) return dubRefuse(run, "az-region");
  // ⛔ ~~مقاطعُ مضمومةٌ مع Azure وحدَه (`|u`)~~ ⇒ ⭐ **الجولة الثالثة: مقاطعُ جملٍ كاملةٍ لكلّ مصدرٍ ومحرّك** — فتبديلُ المحرّك وسطَ
  // التشغيل لا يجعل كلَّ جملةٍ قصيرةٍ طلباً (مراجعة 168ح #10)، ولا يقف صوتُ الجهاز وسطَ جملةٍ أيضاً
  const key = run.vid + "|" + run.opts.source + "|u3";
  const trP = yt ? null : dubTranslatorGet(run);                 // ومع «مترجم Azure» احتياطٌ لا شرط
  const voiceP = dubVoiceGet(run.opts.voice);
  let tx = yt ? null : dubTranscripts.get(key);
  if (tx) dubTxKeep(dubTranscripts, key, tx, DUB_TX_KEEP);        // استُعمل ⇐ الأحدث
  if (!tx && !yt && dubCapP.has(key)) { tx = await dubCapP.get(key); if (!live()) return; }
  if (!tx) {
    const prevB = dubBridge;
    let rel = null;
    dubBridge = new Promise((r) => { rel = r; });
    try {
      await prevB;
      if (!live()) return;
      const ping = await dubMainCall("ping", null, 1500);
      if (!live()) return;
      if (!ping.ok) return dubRefuse(run, "main-missing");
      if (ping.ver !== DUB_MAIN_VER) return dubRefuse(run, "main-old");
      const f = await dubMainCall("facts", null, 6000);
      if (!live()) return;
      if (!f.ok) return dubRefuse(run, f.reason || "facts", f.status);
      if (f.v !== run.vid) return dubRefuse(run, "nav");
      const caps = (f.caps || []).map(dubCapNorm);
      const d = dubDecide({ live: f.live, audio: (f.audio || []).map(dubAudioNorm), caps });
      run.kind = d.k; run.spokenLang = d.spoken || "";
      if (yt) {
        // ⭐ «ترجمة يوتيوب كما تظهر»: المشغّلُ يعرض العربيّة ويطلبها بنفسه — **صفرُ طلبٍ منّا**، فلا نصَّ يُلتقط
        const src = dubYtSource(d, caps);
        if (!src) return dubRefuse(run, d.k, d.spoken || "");
        // ⛔ ~~القاطعُ يُرفض هنا قبل `show`~~ (تحقّقُ الجولة): عالمُ الصفحة يعرف وحدَه أهي العربيّةُ على الشاشة فتُقرأ بصفر طلب — فيقرّر هو
        run.step = "show";
        const sh = await dubMainCall("show", { v: run.vid, code: src.code, asr: src.asr, ql: src.ql, qk: src.qk, dl: 19000 }, 20000);
        if (sh.ok && sh.how !== "already") run.shown = true;      // قبل live(): إيقافٌ أثناء الانتظار يُعيدها
        if (!live()) { dubUnshow(run); return; }
        if (!sh.ok) return dubRefuse(run, sh.reason || "show", sh.why || "");
        // ⭐ الجولة الثالثة: **ملفُّ العربيّة كاملاً من ردّ طلب المشغّل نفسِه** (📐 XHR · json3 — صفرُ طلبٍ منّا) ⇒ وضعُ الجمل بقراءةٍ
        // مسبقة: يُنطق ما يُعرض نفسُه في موعده جملةً كاملة — وما لم يُلتقط يُقرأ كما يظهر سطراً سطراً (وضعُ العرض) كما كان
        const t2 = Array.isArray(sh.events) && sh.events.length ? dubYtUnits(sh.events) : null;
        // ⛔ ~~وما لم يُقرأ الآن يُؤخذ من ذاكرة الإضافة~~ (مراجعةُ الجولة الثالثة #1): مفتاحُها الفيديو والمصدرُ لا المسار — فتُقرأ ترجمةُ
        // مسارٍ آخر والمعروضُ غيرُها، وهي ملاحظةُ المالك ١ بعينها. **وتكرارُ المسار نفسِه تحفظه ذاكرةُ الصفحة** (`MEM.ar`) بلا طلب ⇒ ما
        // لم يُقرأ يُقرأ كما يظهر، ويُقال لماذا
        tx = t2 || { kind: "display", sents: null };
        run.ytWhy = tx.kind === "display" ? String(sh.why || (sh.events ? "empty" : "")).slice(0, 40) : "";   // لماذا لم يُقرأ مسبقاً — يُقال
      } else {
        if (!d.src) return dubRefuse(run, d.k, d.spoken || "");
        if (f.stop && f.asked !== "cached") return dubRefuse(run, "breaker", f.stop);
        if (f.asked === "spent") return dubRefuse(run, "already");
        run.step = "capture";
        // ⭐ يُخزَّن النصُّ حين يصل أيّاً كانت حالُ التشغيلة — إيقافٌ أثناء الالتقاط لا يرمي ما دُفع ثمنُه (مراجعة #1 · #10)
        const capP = dubMainCall("capture", { v: run.vid, code: d.src.code, asr: d.src.asr, ql: d.src.ql, qk: d.src.qk, qv: d.src.variant }, 40000)
          .then((c) => {
            let t2 = null;
            if (c.ok) {
              const seg = dubSegment(c.events);
              if (seg.sents.length) {
                const ss = seg.sents.map((x) => ({ start: x.start, win: x.win, end: x.end, text: x.text, ar: d.k === "speak" ? x.text : null }));
                t2 = dubTxKeep(dubTranscripts, key, { kind: d.k, sents: dubMergeUnits(ss) }, DUB_TX_KEEP);
              }
            }
            return { c, t2 };
          });
        dubCapP.set(key, capP.then((x) => x.t2, () => null));
        let got;
        try { got = await capP; } finally { dubCapP.delete(key); }
        if (!live()) return;
        if (!got.c.ok) return dubRefuse(run, got.c.reason || "capture", got.c.why || (got.c.cc ? "cc" : ""));
        if (!got.t2) return dubRefuse(run, "empty");
        tx = got.t2;
      }
    } finally { rel(); }
  }
  run.kind = tx.kind; run.sents = tx.sents; run.mode = tx.kind === "display" ? "display" : "sents";
  if (trP && tx.kind !== "speak") {
    run.step = "translator";
    const t = await trP;
    if (!live()) return;
    const azTr = run.opts.source === "azure" && !!run.opts.az.trKey;
    if (t.ok) run.tr = t.tr;
    // «مترجم Azure» بلا مفتاحِ مترجمٍ ولا مترجمِ كروم ⇐ يُسمّى المفتاحُ الناقص — ⛔ ~~«مترجم كروم غير متاح» وحدَه~~ (مراجعةُ الجولة #10)
    else if (!azTr) return dubRefuse(run, run.opts.source === "azure" ? "az-trnokey" : t.reason, t.detail);
    if (run.opts.source === "azure" && !azTr) run.trOff = "nokey";   // بلا مفتاح مترجم ⇐ مترجمُ كروم، ويُقال
  }
  run.step = "voice";
  const v0 = await voiceP;
  if (!live()) return;
  // صوتٌ اختير في البوب-أب أثناء التجهيز يُؤخذ هنا — الوعدُ بُدئ بخيار الضغطة (مراجعة 2 #8 · #11)
  const voice = v0 ? (dubPickVoice(speechSynthesis.getVoices() || [], run.opts.voice) || v0) : null;
  if (az && !run.opts.az.key) return dubRefuse(run, "az-nokey");
  if (!voice && !az) return dubRefuse(run, "no-voice");
  run.voice = voice;                                             // مع Azure: صوتُ الجهاز احتياطٌ وقد يغيب
  run.step = "warmup";
  let heard = false;
  if (az) heard = (await dubSayAz(run, DUB_HELLO)) === "heard";
  for (let k = 0; k < 3 && !heard && run.voice && !dubAzOn(run) && live(); k++) {
    const r = await dubSay(run, DUB_HELLO);
    if (r === "heard") { heard = true; break; }
    if (r === "pending") break;                                  // صوتٌ آخر يسبقنا في الطابور: لا نكدّس خلفه
  }
  if (!live()) return;
  await dubClock(run);
  if (!live()) return;
  run.warm = heard;
  run.state = "running"; run.step = "";
  run.timer = setInterval(() => dubTick(run), DUB_TICK_MS);
}

function dubTranslateAhead(run) {
  if (run.opts.source === "azure" && run.opts.az.trKey && !run.trOff) return dubAzTranslateAhead(run);
  // مترجمُ Azure توقّف ولا مترجمَ كروم يخلفه ⇐ يُقال ولا يُسكت عنه — ⛔ ~~«بمترجم كروم»~~ وهو غيرُ موجود (مراجعة 168ح #11)
  if (!run.tr) { const s = run.sents[run.idx]; if (run.trOff && s && s.ar == null) run.hold = "tr-off"; return; }
  const end = Math.min(run.sents.length, run.idx + DUB_AHEAD);
  for (let i = run.idx; i < end && run.inflight < DUB_TR_INFLIGHT; i++) {
    const s = run.sents[i];
    if (s.ar != null || s.trq) continue;
    s.trq = true; run.inflight++;
    run.tr.translate(s.text).then((ar) => { s.ar = String(ar || "").trim(); }, () => { s.ar = ""; })
      .finally(() => { s.trq = false; run.inflight--; });
  }
}

// تعلّمُ سرعة المحرّك من مدّة ما نُطق فعلاً — جملٌ مقطوعة لا تُعلِّم
function dubLearn(run, chars, sec, rate, linear) {
  if (!(sec > 0.6)) return;
  const cps1 = chars / (sec * (linear ? rate : dubRealSpeed(rate, DUB_CURVE_MAC)));
  run.cps = Math.min(12, Math.max(5, 0.8 * run.cps + 0.2 * cps1));
}

// جملةٌ من النصّ الملتقَط (`plan.i`) — وجملتُها التالية تُخطَّط من الفهرس. ونهايةُ نافذتها تصحب المقطعَ لضبط سرعته عند تشغيله
function dubSpeak(run, plan) {
  const s = run.sents[plan.i];
  run.idx = plan.i + 1;
  dubUtter(run, { text: s.ar, i: plan.i, start: s.start / 1000, end: (s.start + s.win) / 1000 }, plan.rate, plan.real, s);
}

// النطقُ الواحد للوضعين: جملةٌ ملتقَطة (`i`) أو سطرٌ معروض (`line`) — وجملةٌ واحدةٌ منّا في الطابور.
// `rate` سرعةُ كروم لأصوات الجهاز، و`real` السرعةُ الفعليّة لصوت Azure (نسبةُ prosody)، و`s` الجملةُ وما جُلب لها مسبقاً
function dubUtter(run, unit, rate, real, s) {
  if (dubAzOn(run) || (dubAzEngine(run) && s && s.clip)) return dubUtterAz(run, unit, rate, real, s);
  if (!run.voice) { run.lost++; return; }                         // Azure متوقّفٌ ولا صوتَ جهازٍ يخلفه
  const u = new SpeechSynthesisUtterance(unit.text);
  u.voice = run.voice; u.lang = run.voice.lang; u.rate = rate; u.volume = run.opts.volume;
  const c = { u, i: unit.i == null ? -1 : unit.i, started: false, ended: false, stale: false, at: performance.now(), t0: 0 };
  u.onstart = () => {
    run.drops = 0;
    c.started = true; c.t0 = performance.now();
    if (c.stale || dub !== run || run.state !== "running") { dubCancelOurs(); return; }
    run.warm = true;                                             // سُمعت جملة ⇒ لا «أهو تبويبٌ مكتوم؟» بعدها
    run.speeds.push(real || rate); if (run.speeds.length > 20) run.speeds.shift();   // للقياس: السرعةُ الفعليّة لا رقمُ كروم
    const v = document.querySelector("#movie_player video");
    if (v && unit.start != null) { run.lags.push(v.currentTime - (run.off || 0) - unit.start); if (run.lags.length > 60) run.lags.shift(); }
  };
  const fin = (ended) => {
    if (c.ended) return;
    c.ended = true;
    if (run.cur === c) run.cur = null;
    if (c.stale) return;
    if (ended && c.started) { run.spoken++; dubLearn(run, unit.text.length, (performance.now() - c.t0) / 1000, rate); }
    // 📐 المحرّكُ النائم يُسقط أوّلَ نطقين بلا `start` ⇒ تُعاد الجملةُ نفسُها مرّتين، وقاعدتا التخطّي تحكمان (مراجعة #5)
    else if (ended && !c.started && (run.drops = (run.drops | 0) + 1) <= 2) {
      if (c.i >= 0) run.idx = c.i; else if (!run.pending) run.pending = unit;
    } else run.lost++;
    // ⭐ التالية تُخطَّط من حدث النطق لا من المؤقّت — المؤقّتُ يُبطَّأ إلى ثانيةٍ في تبويبٍ مخفيّ (مراجعة #9)
    if (dub === run && run.state === "running") dubTick(run);
  };
  u.onend = () => fin(true);
  u.onerror = () => fin(false);
  run.cur = c;
  speechSynthesis.speak(u);
}

// ── 168ح: محرّكُ Azure ─────────────────────────────────────────────────────────────
// محرّكُ Azure مختارٌ بمفتاحٍ لم يُرفض — فما جُلب له يُنطق به **ولو كان طلبٌ جديدٌ ممنوعاً الآن** (مهلةُ 429): ⛔ ~~مقطعٌ مدفوعٌ جاهزٌ
// يُترك وتُنطق جملتُه بصوت الجهاز~~ (تصميمُ الجولة R4 — يخلط الأصوات ويرمي ما دُفع)
function dubAzEngine(run) {
  return run.opts.engine === "azure" && !!run.opts.az.key && !run.azOff;
}

// ويُطلب منه الآن: **ولا مهلةَ 429 على الصفحة** (`dubAzGate` — لا على التشغيلة)
function dubAzOn(run) {
  return dubAzEngine(run) && performance.now() >= dubAzGate.until;
}

// يُسمح بطلب نطقٍ الآن؟ — يُنظّف سجلَّ الصفحة ولا يأخذ مكاناً (الطالبُ يُسجّل)
function dubAzCan(now) {
  const l = dubAzLimit(dubAzGate.log, now, dubAzGate.until);
  dubAzGate.log = l.log;
  return l.ok;
}

function dubBlobFree(run, url) {
  try { URL.revokeObjectURL(url); } catch { /* أُبطل سلفاً */ }
  run.blobs.delete(url);
}

// كلُّ ما بقي من صوتٍ مجلوب يُحرَّر عند الإيقاف — والمقاطعُ المجلوبةُ مسبقاً تُنسى (الرابطُ يموت بتحريره، والجملُ تبقى في
// الذاكرة لتشغيلةٍ تالية: مقطعٌ منسيٌّ هنا كان سيُشغَّل ميّتاً)
function dubAzFree(run) {
  if (run.warmA) { try { run.warmA.pause(); } catch { /* انتهى */ } run.warmA = null; }
  for (const u of run.blobs) { try { URL.revokeObjectURL(u); } catch { /* أُبطل سلفاً */ } }
  run.blobs.clear();
  if (run.sents) for (const x of run.sents) { x.clip = null; x.tries = 0; }   // والجملُ باقيةٌ لتشغيلةٍ تالية: محاولاتُها من جديد
}

// مقطعٌ جُلب مسبقاً ثمّ سقط (صوتٌ أو مفتاحٌ أو سرعةٌ تغيّرت — مراجعة 168ح #6): صوتُه يُحرَّر حين يصل
function dubClipDrop(run, s) {
  const c = s.clip;
  s.clip = null;
  if (c) c.p.then((r) => { if (r && r.ok) dubBlobFree(run, r.url); });
}

// طلبُ صوت Azure لمقطع — **بحدّ الصفحة**، **والمفتاحُ ترويسةٌ لا يُطبع ولا يُعاد في الحال أبداً**.
// ⭐ **يُحلّ بنتيجةٍ دائماً** — ⛔ ~~قراءةُ الجسم إن فشلت تُفلت~~ فتُعلِّق مقطعاً ثلاثين ثانية أو ترفض التشغيلةَ «عطباً داخليّاً»
// (مراجعة 168ح #3) — **ومدّةُ الصوت من حجمه** (48 kbit/s ثابتة) فتُعرف قبل تشغيله، **والحروفُ المدفوعة تُعدّ بعد النجاح وحدَه**
function dubAzFetch(run, text, real) {
  const az = run.opts.az, t0 = performance.now();
  if (!dubAzCan(t0)) return Promise.resolve({ ok: false, status: "rate-local" });
  dubAzGate.log.push(t0);
  const ssml = dubSsml(text, az.voice, real);
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), DUB_AZ_TIMEOUT_MS);
  return fetch("https://" + az.region + ".tts.speech.microsoft.com/cognitiveservices/v1", {
    method: "POST", signal: ac.signal, credentials: "omit", cache: "no-store",
    headers: { "Ocp-Apim-Subscription-Key": az.key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": DUB_AZ_FORMAT },
    body: ssml })
    .then(async (r) => {
      if (!r.ok) {
        // 📄 403 قد يكون نفادَ حصّة F0 الشهريّة لا مفتاحاً مرفوضاً — نصُّ الردّ يقوله (بحثُ الجولة الثالثة)
        let t = "";
        if (r.status === 403) { try { t = await r.text(); } catch { t = ""; } }
        return { ok: false, status: /quota/i.test(t) ? "quota" : r.status };
      }
      const blob = await r.blob();
      if (!blob.size) return { ok: false, status: 204 };
      dubAzGate.n429 = 0;
      run.azTts += dubAzBill(ssml);                              // مدفوعٌ وإن لم يُشغَّل
      const gone = () => dub !== run || (run.state !== "running" && run.state !== "preparing");
      if (gone()) return { ok: false, status: "gone" };
      const span = await dubAzSpanOf(blob), dur = blob.size / DUB_AZ_BPS;
      if (gone()) return { ok: false, status: "gone" };
      const url = URL.createObjectURL(blob);
      run.blobs.add(url);
      return { ok: true, url, dur, speech: span ? Math.min(dur, span.end) : dur, lead: span ? span.lead : 0, dec: !!span, real: Number(real) || 1 };
    })
    .catch((e) => ({ ok: false, status: 0, err: String(e?.name || e) }))
    // ⭐ الرفضُ يُصنَّف **لحظةَ يصل** — ⛔ ~~حين تُشغَّل جملتُه~~: 429 على طلبٍ مسبق كان يترك بوّابةَ الصفحة مفتوحةً فيصطدم بها طلبٌ آخر
    // وتُنطق جملتان بصوت الماك (حَكَمُ الجولة P1، مقيس)
    .then((res) => { if (!res.ok) dubAzFail(run, res); return res; })
    .finally(() => clearTimeout(timer));
}

// فشلُ Azure: مفتاحٌ مرفوض ⇐ صوتُ الجهاز بقيّةَ التشغيلة · 429 ⇐ دقيقةٌ بصوت الجهاز بلا طلب **على الصفحة كلِّها** ·
// وتعذّرُ الاتصال يُقال — ⛔ ~~ويبقى مقولاً بقيّةَ التشغيلة~~: يُمحى بأوّل مقطعٍ يُسمع، و«الحدّ» يُقرأ حيّاً (مراجعة 168ح #5 · #14)
function dubAzFail(run, res) {
  const st = res && res.status;
  if (st === 401 || st === 403) run.azOff = "key";
  else if (st === "quota") run.azOff = "quota";                  // حصّةُ الشهر نفدت: صوتُ الجهاز حتى الشهر التالي، ويُقال بسببه
  else if (st === 429) {
    dubAzGate.n429++;
    dubAzGate.until = performance.now() + Math.min(DUB_AZ_BACKOFF_MS, DUB_AZ_BACKOFF0_MS * Math.pow(2, dubAzGate.n429 - 1));
  } else if (st !== "rate-local" && st !== "gone") run.azWarn = "net";
}

// ⭐ الجولة الثالثة — أين ينتهي الكلامُ في المقطع؟ 📐 يضيف Azure صمتاً في آخر كلّ مقطع (بحثُ الجولة الثالثة على أصواته: 0.7–0.97 ث،
// والوسيطُ 0.84) ⇒ **مدّتُه كلُّها تُفسد ضبطَ السرعة وتعلّمَها** (أطولُ بنحو الخُمس فيُسرَّع ما لا يلزم) **وتطيل ما بين الجمل**. والعتبةُ
// نحو −48 dBFS — خالص: { lead · end } بالثواني، أو null لمقطعٍ صامت
function dubAzSpan(data, rate) {
  const TH = 0.004;
  let a = -1, b = -1;
  for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > TH) { a = i; break; }
  if (a < 0 || !(rate > 0)) return null;
  for (let i = data.length - 1; i >= a; i--) if (Math.abs(data[i]) > TH) { b = i; break; }
  return { lead: a / rate, end: (b + 1) / rate };
}

// فكُّ ترميز المقطع لمعرفة ذلك — 📐 أجزاءٌ من الألف من الثانية لمقطعٍ بستّ ثوانٍ، وفي الجلب المسبق لا في طريق الصوت.
// وما لا يُفكّ (متصفّحٌ بلا Web Audio · ردٌّ تالف) يُعامل بمدّته كاملةً كما كان
function dubAzSpanOf(blob) {
  const OAC = globalThis.OfflineAudioContext;
  if (typeof OAC !== "function" || !blob || typeof blob.arrayBuffer !== "function") return Promise.resolve(null);
  return blob.arrayBuffer().then((buf) => new OAC(1, 1, 24000).decodeAudioData(buf))
    .then((ab) => dubAzSpan(ab.getChannelData(0), ab.sampleRate))
    .catch(() => null);
}

// ⭐ الجولة الثالثة — سرعةُ التشغيل الآن: **ما بقي من كلام المقطع** على ما بقي من نافذة جملته بزمن الساعة (`dubAzFit`). **والسرعةُ
// الثابتة التي اختارها المستخدمُ طُلب بها المقطعُ فلا يُزاد عليها**، وسطرُ العرض لا نافذةَ له. `mid`: وسطَ المقطع (تبدّلت سرعةُ
// الفيديو) ⇐ الباقي من موضعه، والسقفُ بتأخّر بدئه (`lag0`) — ⛔ ~~ويبدأ بعُشر صمت أوّله محسوباً كلاماً~~ (حَكَمُ الجولة)
function dubAzRateNow(run, unit, c, mid) {
  if (typeof run.opts.rate === "number" || unit.end == null) return 1;
  const v = document.querySelector("#movie_player video");
  if (!v) return 1;
  const vr = v.playbackRate || 1, ct = v.currentTime - (run.off || 0), st = unit.start == null ? ct : unit.start;
  if (!mid) c.lag0 = Math.max(0, ct - st);
  const left = (c.speech || c.dur) - (mid && c.audio ? c.audio.currentTime : Math.max(0, (c.lead || 0) - 0.02));
  const remain = (unit.end - Math.max(ct, st)) / vr;
  return dubAzFit(left, remain, c.real, Math.min(DUB_R_MAX, Math.min(DUB_CATCH_CEIL_AZ, dubCapFor(c.lag0 || 0)) * Math.max(1, vr)));
}

// ⛔ **الموضعُ الوحيد لكتابة سرعة عنصرِ صوتِنا** (لا الفيديو أبداً — خ5): حارسا السرعة يستثنيانه بعينه
function dubAzSetRate(c, r) {
  c.audio.playbackRate = r;
  c.vr = (document.querySelector("#movie_player video") || {}).playbackRate || 1;
}

// تعلّمُ سرعة صوت Azure الطبيعيّة من مدّة مقاطعه والسرعةِ التي طُلبت بها — أوّلُ ثلاثةٍ بنصف الوزن: تلحق سريعاً
function dubLearnAz(run, chars, dur, real) {
  if (!(dur > 0.6) || !(chars > 0)) return;
  const w = run.azN < 3 ? 0.5 : 0.2;
  run.azN++;
  run.cpsAz = Math.min(20, Math.max(6, (1 - w) * run.cpsAz + w * chars / (dur * Math.max(0.5, real || 1))));
}

// المقطعُ بصوت Azure: ممّا جُلب له مسبقاً إن كان بالصوت نفسِه، وإلا يُطلب الآن — ويُشغَّل عنصرَ صوتٍ لنا وحدَنا **بسرعة تشغيلٍ
// تُلائم مدّتَه الفعليّة ما بقي من نافذته** (الجولة الثالثة) فلا يزحم ما بعده، ويتوقّف مع الفيديو ويكمل معه (`held`)
function dubUtterAz(run, unit, rate, real, s) {
  const c = { az: true, i: unit.i == null ? -1 : unit.i, started: false, ended: false, stale: false, held: false,
    at: performance.now(), t0: 0, audio: null, url: "", dur: 0, real: Number(real) || 1 };
  run.cur = c;
  const fin = (ended, quiet) => {
    if (c.ended) return;
    c.ended = true;
    clearTimeout(c.endT);
    // ⛔ ~~ويُحرَّر رابطُه دائماً~~ (تحقّقُ الجولة الثالث): مقطعٌ أُعيد إلى جملته (`back`) رابطُه لها — 📖 `pause()` قبل «playing» يرفض وعدَ
    // `play()` فيصل هنا بعد الإعادة، فكانت الجملةُ تُعاد برابطٍ ميّتٍ فتضيع
    if (c.url && !c.back) dubBlobFree(run, c.url);
    if (run.cur === c) run.cur = null;
    if (c.stale) return;
    if (ended && c.started) {
      run.spoken++; dubLearnAz(run, unit.text.length, (c.speech - c.lead) || c.dur, c.real);
      // أرقامٌ للقياس في البوب-أب (لا نصَّ ولا مفتاح): صمتا الطرفين **ممّا فُكّ وحدَه** — ⛔ ~~«0» لمقطعٍ لم يُفكّ~~: رقمٌ يُقرأ قياساً
      // ولم يُقس؛ فالعدمُ (null) يقول إنّ الفكَّ غيرُ متاح
      if (c.dec) {
        run.tails.push(Math.max(0, c.dur - c.speech)); if (run.tails.length > 10) run.tails.shift();
        run.leads.push(c.lead || 0); if (run.leads.length > 10) run.leads.shift();
      }
    } else if (!quiet) run.lost++;
    // التالية من حدث الصوت لا من المؤقّت (مراجعة #9) — وحدثُ الصوت مهمّةٌ لا وعد، فلا سلسلة
    if (dub === run && run.state === "running") dubTick(run);
  };
  c.fin = fin;                                                     // النبضةُ تُنهيه حين ينتهي كلامُه ويبقى صمتُ آخره
  // ⭐ نهايةُ الكلام بمؤقّتٍ واحدٍ يُسلَّح عند كلّ تشغيل (تصميمُ الجولة G3): النبضةُ وحدَها كانت تنتظر حتى 0.15 ث بعد آخر كلمة عند كلّ
  // حدّ جملة — مهمّةٌ مؤقّتةٌ لا سلسلةُ وعود، والنبضةُ و`onended` احتياطٌ خلفه
  c.arm = () => {
    clearTimeout(c.endT);
    const a = c.audio;
    if (!a || c.ended || c.held || !(c.speech > 0) || !(c.speech < c.dur - 0.1)) return;
    c.endT = setTimeout(() => {
      if (c.ended || c.held || run.cur !== c) return;
      try { a.pause(); } catch { /* انتهى */ }
      fin(true);
    }, Math.max(0, (c.speech - a.currentTime) / (a.playbackRate || 1) * 1000 + 15));
  };
  const play = (res) => {
    // أُعيد مقطعُه إلى جملته (`back`) ⇐ الردُّ لها لا يُحرَّر هنا
    if (c.stale || dub !== run || run.state !== "running") { if (res && res.ok && !c.back) dubBlobFree(run, res.url); fin(false, true); return; }
    if (!res || !res.ok) {
      // (صُنِّف الرفضُ حين وصل — `dubAzFetch`) · ⛔ حدُّ الصفحة ممتلئ: تُعاد الجملةُ **في نبضة المؤقّت التالية** — ⛔ ~~fin ثمّ dubTick هنا~~: وعدُ الرفض محلولٌ سلفاً فكانت
      // النبضةُ تُعاد في سلسلة وعودٍ لا تُعطي الصفحةَ نَفَساً حتى يتّسع الحدّ — **جمّدت يوتيوب حتى ثانيتين ونصفٍ مراراً**
      // (مراجعة 168ح #1 · #7 · #13، مقيس) — **ولا خلطَ أصواتٍ** لحدٍّ ممتلئ
      if (res && res.status === "rate-local") {
        if (c.i >= 0) run.idx = c.i; else if (!run.pending) run.pending = unit;
        c.ended = true;
        if (run.cur === c) run.cur = null;
        return;
      }
      // مفتاحٌ مرفوضٌ أو 429: المقطعُ نفسُه بصوت الجهاز إن وُجد
      if (!dubAzOn(run) && run.voice && run.cur === c) { c.ended = true; run.cur = null; dubUtter(run, unit, rate, real); return; }
      fin(false);
      return;
    }
    // ⭐ وصل صوتُ جملةٍ متأخّراً فوق DUB_BEHIND_MAX_S (جلبٌ أبطأ من المهلة بعد قرار النطق) ⇐ يُتخطّى ويُعدّ — يُزحم كلُّ ما بعده إن نُطق
    const vv = document.querySelector("#movie_player video");
    if (vv && unit.start != null && vv.currentTime - (run.off || 0) - unit.start > DUB_BEHIND_MAX_S) {
      dubBlobFree(run, res.url); run.skipped++; fin(false, true); return;
    }
    const a = new Audio(res.url);
    c.audio = a; c.url = res.url; c.dur = res.dur || 0; c.speech = res.speech || c.dur; c.lead = res.lead || 0; c.real = res.real || c.real; c.dec = !!res.dec;
    a.volume = run.opts.volume;
    try { a.preservesPitch = true; } catch { /* متصفّحٌ قديم: السرعةُ تغيّر الطبقة */ }
    c.unit = unit;
    dubAzSetRate(c, dubAzRateNow(run, unit, c));
    // ⭐ ويبدأ من أوّل الكلام لا من صمت أوّله (تصميمُ الجولة G3: نحو عُشر ثانيةٍ عند كلّ حدّ جملة)
    if (c.lead > 0.03 && c.lead < c.speech - 0.1) { try { a.currentTime = c.lead - 0.02; } catch { /* يبدأ من أوّله */ } }
    a.onplaying = () => {
      if (c.stale) { try { a.pause(); } catch { /* انتهى */ } return; }   // أُسكت قبل أن يبدأ: لا يُعدّ ولا يُسمع
      c.arm();                                                      // ومع كلّ تشغيلٍ بعد توقّف: يُسلَّح ثانيةً
      if (c.started) return;
      c.started = true; c.t0 = performance.now(); run.warm = true; run.azWarn = "";
      run.speeds.push(c.real * (a.playbackRate || 1)); if (run.speeds.length > 20) run.speeds.shift();
      const v = document.querySelector("#movie_player video");
      if (v && unit.start != null) { run.lags.push(v.currentTime - (run.off || 0) - unit.start); if (run.lags.length > 60) run.lags.shift(); }
    };
    a.onended = () => fin(true);
    a.onerror = () => fin(false);
    const pr = a.play();
    if (pr && typeof pr.catch === "function") pr.catch(() => fin(false));
  };
  // ما جُلب مسبقاً بصوتٍ آخر لا يُشغَّل — يُحرَّر ويُطلب بالصوت المختار (مراجعة 168ح #6)
  const clip = s ? s.clip : null;
  if (s) s.clip = null;
  // ⛔ ~~بالصوت وحدَه~~ (تحقّقُ الجولة الثالث): مقطعٌ أُعيد إلى جملته لا يراه إسقاطُ `dubSetOptions` — فكان يُنطق بسرعةٍ ثابتةٍ تبدّلت
  const use = clip && clip.voice === run.opts.az.voice && clip.rate === run.opts.rate ? clip : null;
  if (clip && !use) clip.p.then((r) => { if (r && r.ok) dubBlobFree(run, r.url); });
  // والمقطعُ محفوظٌ على النطق (`clip` · `s`) — فإن أُسكت قبل أن يُسمع يعود إلى جملته بردّه (`dubSilence`)
  const mine = use || { p: null, res: null, voice: run.opts.az.voice, rate: run.opts.rate };
  if (!use) mine.p = dubAzFetch(run, unit.text, dubAzAsk(run, real)).then((r) => { mine.res = r; return r; });
  c.clip = mine; c.s = s || null;
  mine.p.then(play);
}

// جملةُ الإحماء بصوت Azure — وهي أوّلُ اختبارٍ للمفتاح: مرفوضٌ ⇐ صوتُ الجهاز من البداية
function dubSayAz(run, text) {
  return dubAzFetch(run, text, 1).then((res) => new Promise((resolve) => {
    if (!res.ok) { resolve("dropped"); return; }
    if (dub !== run || run.state !== "preparing") { dubBlobFree(run, res.url); resolve("dropped"); return; }
    const a = new Audio(res.url);
    let started = false, t = 0;
    const done = (r) => { clearTimeout(t); dubBlobFree(run, res.url); if (run.warmA === a) run.warmA = null; resolve(r); };
    a.volume = run.opts.volume;
    a.onplaying = () => { started = true; };
    a.onended = () => done(started ? "heard" : "dropped");
    a.onerror = () => done("dropped");
    run.warmA = a;
    t = setTimeout(() => { try { a.pause(); } catch { /* انتهى */ } done(started ? "heard" : "pending"); }, 6000);
    a.play().catch(() => done("dropped"));
  }));
}

// جلبٌ مسبقٌ لصوت المقاطع التالية بترتيبها (DUB_AZ_AHEAD) — بسرعةٍ تُحسب على أنها تبدأ في موعدها، **وواحدٌ في كلّ نبضة**.
// ⛔ **ولا طلبَ والحدُّ ممتلئ**: ⛔ ~~رفضٌ يُخزَّن في المقطع~~ كان يُعاد تشغيلُه رفضاً في سلسلة التجميد (مراجعة 168ح #1)
function dubAzPrefetch(run, rate, cap) {
  const end = Math.min(run.sents.length, run.idx + DUB_AZ_AHEAD);
  let flying = 0;
  for (let i = run.idx; i < end; i++) { const c = run.sents[i].clip; if (c && !c.res) flying++; }
  if (flying >= 2) return;                                       // طلبان في الطريق على الأكثر (تصميمُ الجولة)
  for (let i = run.idx; i < end; i++) {
    const s = run.sents[i];
    // ⭐ فشلٌ عابرٌ يُسقط مقطعَه فيُطلب ثانيةً عبر الحدّ نفسِه (مرّةً) — ⛔ ~~يُشغَّل فاشلاً فتضيع جملتُه~~
    if (dubAzRetryable(run, s)) s.clip = null;
    // ومقطعٌ طُلب بصوتٍ أو سرعةٍ ثابتةٍ غيرِ الجارية (أُعيد إلى جملته بعد تبديلهما) يسقط فيُطلب من الآن — لا حين تحلّ جملتُه
    if (s.clip && (s.clip.voice !== run.opts.az.voice || s.clip.rate !== run.opts.rate)) dubClipDrop(run, s);
    if (!s.ar || s.clip) continue;
    if (!dubAzCan(performance.now())) return;
    // ⭐ مكانان في الدقيقة للجملة المستحقّة: ما بعد التالية لا يُطلب والسجلُّ فوق 16 — فالتي حلّت تجد مكاناً دائماً (تصميمُ الجولة)
    if (i > run.idx && dubAzGate.log.length > DUB_AZ_PER_MIN - 2) return;
    const plan = dubNext([s], 0, s.start / 1000, rate, run.cpsAz, cap, DUB_CURVE_MAC, run.opts.rate);
    if (!plan.speak) continue;
    dubAzClip(run, s, plan.real);
    return;
  }
}

// مترجمُ Azure: دفعةٌ من المقاطع **أمام الموضع** في طلبٍ واحد — ⛔ ~~حتى آخر الفيديو~~: كان يترجم الفيديو كلَّه في ثانية (مراجعة
// 168ح #9) ⇒ **لا يُطلب إلا وفي الثماني القادمة مقطعٌ بلا ترجمة**، والدفعةُ حتى 25 من الموضع. مفتاحٌ مرفوضٌ أو 429 ⇐ مترجمُ كروم
// بقيّةَ التشغيلة · وغيرُهما (شبكةٌ · 5xx · ردٌّ غيرُ JSON) ⇐ ⛔ ~~يُعاد كلَّ نبضةٍ أبداً~~ **انتظارٌ يتضاعف حتى ثلاثين ثانية، وبعد
// ثلاثةٍ متتالية يتوقّف ويُقال** — ومهلةٌ كطلب الصوت (مراجعة 168ح #11). **والحروفُ تُعدّ بعد النجاح وحدَه** (#12)
function dubAzTranslateAhead(run) {
  if (run.trBusy || performance.now() < run.trUntil) return;
  let need = false;
  for (let i = run.idx; i < Math.min(run.sents.length, run.idx + DUB_AHEAD) && !need; i++) need = run.sents[i].ar == null && !run.sents[i].trq;
  if (!need) return;
  const batch = [];
  for (let i = run.idx; i < run.sents.length && batch.length < DUB_AZ_TR_BATCH; i++) { const s = run.sents[i]; if (s.ar == null && !s.trq) batch.push(s); }
  const az = run.opts.az, ac = new AbortController(), timer = setTimeout(() => ac.abort(), DUB_TR_TIMEOUT_MS);
  run.trBusy = true;
  for (const s of batch) s.trq = true;
  fetch("https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=en&to=ar", {
    method: "POST", signal: ac.signal, credentials: "omit", cache: "no-store",
    headers: { "Ocp-Apim-Subscription-Key": az.trKey, "Ocp-Apim-Subscription-Region": az.trRegion, "Content-Type": "application/json" },
    body: JSON.stringify(batch.map((s) => ({ Text: s.text }))) })
    .then(async (r) => {
      if (!r.ok) return r.status;
      let j = null;
      try { j = await r.json(); } catch { j = null; }
      if (!Array.isArray(j)) return "json";
      batch.forEach((s, k) => { const t = j[k] && j[k].translations && j[k].translations[0]; s.ar = t && typeof t.text === "string" ? t.text.trim() : ""; });
      run.azTr += batch.reduce((n, s) => n + s.text.length, 0);
      return 200;
    })
    .catch(() => 0)
    .then((st) => {
      if (st === 200) { run.trFails = 0; return; }
      if (st === 401 || st === 403) { run.trOff = "key"; return; }
      if (st === 429) { run.trOff = "rate"; return; }
      run.trFails++;
      run.trUntil = performance.now() + Math.min(30000, 1000 * Math.pow(2, run.trFails));
      if (run.trFails >= DUB_TR_FAILS) run.trOff = "net";
    })
    .finally(() => { clearTimeout(timer); for (const s of batch) s.trq = false; run.trBusy = false; });
}

// سطرٌ نهائيٌّ لم يُنطق يصير «المنتظر» — والأحدثُ يغلب ما لم يأتِ دوره (يُعدّ متخطّى). ⛔ ~~الجولة الثالثة: يُضمّ إليه~~ — **سُحب
// بالقياس** (تصميمُ الجولة G1): الضمُّ أخّر الصوتَ عن الشاشة 7–9 ث (بدلَ 1.7) فصار ما يُسمع غيرَ ما يُقرأ — وهذا وضعُ الاحتياط حين
// لا يُلتقط الملفّ، **والتزامنُ مع الشاشة أوّلاً** (ملاحظةُ المالك ١). ونافذةُ السرعة من إيقاع السطور نفسِها
// ⭐ وسطرٌ نُطق صدرُه عند سكتةٍ ثمّ كبر: **الباقي وحدَه جديد** — وإن لم يُنطق صدرُه بعد فالسطرُ الكاملُ يحلّ محلّه (مراجعة 2 #3)
function dubOffer(run, lines, now, fromLast) {
  const fresh = lines.filter((l) => l && !run.recent.includes(l));
  if (!fresh.length) return;
  const line = fresh[fresh.length - 1];
  // صدرُ السطر: ما نُطق عند سكتة (`base`) — أو آخرُ سطرٍ عُرض لنا (`said`) إن ظهر بعدُ أطولَ ممّا رأيناه (فاتتنا كلمتُه الأخيرة)
  const b = [run.base, run.said].find((x) => x && fresh.length === 1 && line.startsWith(x + " ")) || "";
  let text = fresh.join(" ");
  const remember = () => { for (const l of fresh) { run.recent.push(l); if (run.recent.length > 12) run.recent.shift(); } if (fromLast) run.base = line; run.said = line; };
  if (b) {
    if (run.pending && run.pending.line === b) { run.pending = { text: line, line, at: run.pending.at }; remember(); return; }
    text = line.slice(b.length).trim();
  }
  if (run.pending) run.skipped++;
  run.pending = { text, line, at: now };
  if (run.offerAt) { const d = now - run.offerAt; if (d > 500 && d < 15000) run.capWin = 0.7 * run.capWin + 0.3 * d; }
  run.offerAt = now; run.seen++;
  remember();
}

// وضعُ العرض: يُقرأ ما على الشاشة في كلّ نبضة. ⭐ **وسطرٌ يكبر لا يُنطق حتى يكتمل** — 📖 في وضع «التمرير» (roll-up)
// تُلحق الكلماتُ بالسطر الأخير، فنطقُه فورَ ظهوره يقول نصفَه ثمّ يعيده كاملاً: هو «الكلامُ المتقطّع». فإن رُئي سطرٌ يكبر
// صار السطرُ نهائيّاً حين يعلوه غيرُه، أو يغيب، أو يسكن `DUB_STABLE_MS`؛ وما لم يُرَ نموٌّ يُنطق السطرُ فورَ ظهوره.
function dubTickDisplay(run, p, v, now) {
  if (run.opts.engine !== "azure" && !run.voice) run.hold = "no-voice";
  const btn = p.querySelector(".ytp-subtitles-button");
  if (btn && btn.getAttribute("aria-pressed") === "false") { run.hold = "cc-off"; return; }
  // 📖 يوتيوب يرسم الترجمةَ بـrequestAnimationFrame — وكرومُ يوقفه في التبويب المخفيّ ⇒ لا جديدَ يُقرأ: يُقال ولا يُسكت عنه
  if (document.hidden) { run.hold = "hidden"; return; }
  // ومسارٌ معروضٌ بغير العربيّة (اختار المستخدمُ لغةً أخرى بيده): يُقال لا يُسكت عنه بـ«يُدبلج» (مراجعة 2 #2)
  if (run.trackLang && dubPrim(run.trackLang) !== "ar") { run.hold = "cc-lang"; return; }
  const lines = dubCaptionLines(p);
  // ⭐ شبكةُ صدق (تحقّقُ الجولة السادس): لا سطرَ على الفيديو منذ عشرين ثانية ⇐ «no-lines» — ⛔ ~~«يُدبلج» ولا ما يُقرأ~~ حين تختفي الترجمةُ برفضٍ لا
  // نراه (طلبٌ كان في الطريق) أو يطول صمتُ الفيديو؛ يُقال ولا يُوقف شيئاً
  // ⛔ ~~ساعةٌ باقيةٌ من قبل إيقافٍ أو إعلانٍ أو تبويبٍ مخفيّ~~ (تحقّقُ الجولة السابع): ما لم تقرأ فيه النبضاتُ الشاشةَ (عادت قبل هنا) **لا يُعدّ** — فلا
  // «منذ عشرين ثانية» لحظةَ الاستئناف · ⛔ ~~ويُعاد العدُّ من الصفر~~ (الثامن): تجمّداتُ تحميلٍ متكرّرة كانت تمنع التنبيهَ أبداً ⇒ **تتوقّف الساعةُ ما لم
  // يتقدّم المحتوى في الفجوة** (إيقاف · تجمّد) **وتُصفَّر إن تقدّم** (سرعةٌ فوق الحدّ · تبويبٌ مخفيّ · قفز): ⛔ ~~تتوقّف دائماً~~ (التاسع) فكانت سطورٌ عُرضت
  // فيها ولم نقرأها تُحسب فراغاً ⇒ «منذ عشرين ثانية» بعد ثوانٍ من آخر سطر
  // ⛔ ~~ويُحكم بتقدّم المحتوى وفارقُ الساعتين يُعاد قياسُه~~ (تحقّقُ الجولة العاشر): بعد إعلانٍ مُدمَجٍ في الخادم يكبر الفارقُ بطوله ولم يُقس بعد
  // (`clockBusy`) فيبدو المحتوى تقدّم بطول الإعلان ⇒ «يُدبلج» على شاشةٍ فارغة عشرين ثانيةً بعد كلّ إعلان ⇒ **يُحكم في النبضة التالية بالفارق الجديد**
  // (`dubMainCall` يعود خلال 400ms على الأكثر)
  const ctD = v.currentTime - (run.off || 0), gap = !!run.readAt && now - run.readAt > 1000, defer = gap && run.clockBusy && !lines.length;
  if (lines.length || !run.seenAt) run.seenAt = now;
  else if (defer) { /* نبضةٌ واحدة */ }
  else if (gap) run.seenAt = Math.abs(ctD - (run.readCt || 0)) > DUB_SEEK_S ? now : run.seenAt + (now - run.readAt);
  else if (now - run.seenAt > DUB_NOLINES_MS && !run.hold) run.hold = "no-lines";   // ولا يحجب سبباً أدقّ (لا صوتَ في الجهاز)
  if (!defer) { run.readAt = now; run.readCt = ctD; }
  const last = lines.length ? lines[lines.length - 1] : "";
  const prev = run.lastLine, moved = last !== prev;
  if (moved && prev && last.length > prev.length && last.startsWith(prev)) run.grow = true;
  if (!run.grow) dubOffer(run, lines, now, false);
  else {
    if (moved && prev && !lines.includes(prev) && !last.startsWith(prev)) dubOffer(run, [prev], now, false);   // غاب وهو يكبر: نهائيٌّ كما رُئي آخرَ مرّة
    dubOffer(run, lines.slice(0, -1), now, false);                                                            // ما فوق الأخير نهائيّ
  }
  if (moved) {
    if (run.base && !(last === run.base || last.startsWith(run.base + " "))) run.base = "";
    run.lastLine = last; run.lineAt = now;
  }
  if (run.grow && last && now - run.lineAt >= DUB_STABLE_MS) dubOffer(run, [last], now, true);
  if (run.cur || v.seeking) return;
  const plan = dubDisplayNext(run.pending, lines, now, run.capWin, run.cps, DUB_AUTO_MAX, DUB_CURVE_MAC, run.opts.rate);
  if (plan.skip) { run.skipped++; run.pending = null; return; }
  if (!plan.speak) return;
  const unit = run.pending;
  run.pending = null;
  dubUtter(run, unit, plan.rate, plan.real);
}

// السرعةُ الفعليّة التي يُطلب بها صوتُ جملةٍ من Azure — على أنها تبدأ في موعدها (فبسقف التلقائيّة مضروباً في سرعة الفيديو)
function dubAzReal(run, s, vr) {
  return dubNext([s], 0, s.start / 1000, vr || 1, run.cpsAz, DUB_R_MAX, DUB_CURVE_MAC, run.opts.rate).real || 1;
}

// السرعةُ التي يُطلب بها الصوت: الثابتةُ التي اختارها المستخدمُ بنفسها — ⛔ ~~على منحنى «ليلى» (2× ⇐ 1.91)~~ — وإلا المحسوبة
function dubAzAsk(run, real) {
  return typeof run.opts.rate === "number" ? run.opts.rate : real;
}

// ⭐ فشلٌ عابرٌ (شبكة · 204 · 429 · 5xx) لصوت جملةٍ وبقيت محاولة، والمفتاحُ لم يُرفض — تعريفٌ واحدٌ للجلب المسبق والانتظار والموعد
function dubAzRetryable(run, s) {
  const r = s && s.clip && s.clip.res, st = r && !r.ok ? r.status : null;
  return st != null && !run.azOff && (s.tries | 0) < DUB_AZ_TRIES && (st === 0 || st === 204 || st === 429 || st >= 500);
}

// أيُّ مترجمٍ ما زال يترجم؟ — مترجمُ Azure بمفتاحه ما لم يتوقّف، أو مترجمُ كروم (مراجعةُ الجولة #3)
function dubCanTranslate(run) {
  return (run.opts.source === "azure" && !!run.opts.az.trKey && !run.trOff) || !!run.tr;
}

// صوتُ جملةٍ يُطلب الآن ويُحفظ عليها (`clip`): النتيجةُ في `res` حين تصل — الجلبُ المسبق والانتظارُ يطلبان به وحدَه
function dubAzClip(run, s, real) {
  const clip = { p: null, res: null, voice: run.opts.az.voice, rate: run.opts.rate };
  s.tries = (s.tries | 0) + 1;
  clip.p = dubAzFetch(run, s.ar, dubAzAsk(run, real)).then((r) => { clip.res = r; return r; });
  s.clip = clip;
}

// ⭐ الانتظار — قرارُ المالك 2026-11-01 («يتوقّف الفيديو لحظة (موصى)»، ولحاقُ الصوت «نعم، مرّة كلّ 20 ث على الأكثر (موصى)»):
// **يتوقّف الفيديو** حتى يجهز صوتُ الجملة (`voice`) أو ترجمتُها (`translate`) أو يفرغ صوتُنا من سابقتها (`behind`) — DUB_WAIT_MAX_MS
// على الأكثر ثمّ يكمل وحده. ⛔ **لا في تبويبٍ مخفيّ، ولا وهو متوقّفٌ أصلاً، ومن شغّله أثناءه فالقرارُ له** (لا نوقفه ثانيةً لجملته).
// ⛔ ~~ومن ضغط مفتاحاً أو زرّاً أثناءه صار الإيقافُ له~~ — **سُحب** (حَكَمُ الجولة، مقيس): نقرةٌ في أيّ مكانٍ في الصفحة أثناء ثلاث ثوانٍ
// كانت تترك الفيديو موقوفاً بلا نهاية — ومستمعا المستند ذهبا معه. **وموضعُ الإيقاف يُحفظ:** قفزةٌ أثناءه تُرى بعده (`pauseCt`)
function dubWaitStart(run, v, why) {
  // وجملةٌ انتُظرت حتى المهلة لا تُنتظر ثانيةً: ⛔ ~~يكمل الفيديو لحظةً ثمّ يتوقّف من جديد~~ — تقطيعٌ للفيديو نفسِه (مراجعةُ الجولة)
  if (run.wait || document.hidden || v.paused || run.waitGaveUp === run.idx) return;
  try { v.pause(); } catch { return; }
  run.pauseCt = v.currentTime - (run.off || 0);
  run.wait = { at: performance.now(), why }; run.waits++;
  run.hold = "wait-" + why;
}

function dubWaitEnd(run) {
  if (run.wait) run.stallS += (performance.now() - run.wait.at) / 1000;
  run.wait = null;
}

// يُكمل الفيديو الذي أوقفناه نحن — عند الإيقاف بيد المستخدم أو بإعادة البدء، لا عند التنقّل (الفيديو غيرُه)
function dubWaitRelease(run) {
  if (!run.wait) return;
  dubWaitEnd(run);
  const v = document.querySelector("#movie_player video");
  if (v && v.paused) { try { const pr = v.play(); if (pr && typeof pr.catch === "function") pr.catch(() => {}); } catch { /* يبقى متوقّفاً */ } }
}

// نبضةٌ والفيديو موقوفٌ بنا: true ⇐ تقف النبضةُ هنا. شغّله غيرُنا أو لمس المستخدمُ المشغّل ⇐ ينتهي انتظارُنا وتمضي النبضةُ بحالها
function dubWaitTick(run, v, now) {
  const w = run.wait;
  // شغّله المستخدمُ ⇐ القرارُ له **ولهذه الجملة كلِّها**: ⛔ ~~نوقفه ثانيةً بعد لحظة~~ — نعاند المستخدم (تصميمُ الجولة R2) — ⭐ **وساعتُه التي
  // لم تتحرّك بعدُ ليست تجمّداً** (📖 ساعةُ وسائط كروم تبدأ بعد play() بقليل): ⛔ ~~«متجمّد» ⇐ مزامنة ⇐ نوقفه ثانيةً~~ (مراجعةُ الجولة #1)
  if (!v.paused) { run.waitGaveUp = run.idx; dubWaitEnd(run); run.movedAt = now; return false; }
  // ⭐ قفزٌ أثناء انتظارنا ⇐ ينتهي الانتظار، ويسكت ما يتكلّم، ويُستأنف من الموضع الجديد — ⛔ ~~يكمل مقطعٌ قديمٌ في الموضع الجديد حتى
  // المهلة~~ (مراجعةُ الجولة #6)
  const ct = v.currentTime - (run.off || 0);
  if (run.pauseCt != null && Math.abs(ct - run.pauseCt) > DUB_SEEK_S) {
    dubWaitEnd(run); dubSilence(run);
    run.sync = true; run.seeked = true; run.pauseCt = null; run.recent = []; run.pending = null;
    dubClock(run);
    try { const pr = v.play(); if (pr && typeof pr.catch === "function") pr.catch(() => {}); } catch { /* يبقى متوقّفاً: «متوقّف» يقوله */ }
    run.movedAt = now;
    return true;
  }
  const s = run.sents && run.sents[run.idx];
  // فشلٌ عابرٌ لصوتها وبقيت محاولة ⇐ يُطلب ثانيةً **في الانتظار نفسِه** — ⛔ ~~«جاهزٌ» فيكمل الفيديو ثمّ يتوقّف للمحاولة~~ (#4)
  if (s && dubAzRetryable(run, s)) s.clip = null;
  // ترجمتُها وصلت ومحرّكُها Azure ⇐ **الانتظارُ نفسُه يصير انتظارَ صوتها** بمهلته الأولى — ⛔ ~~يكمل الفيديو ثمّ يتوقّف ثانيةً لصوتها~~ (#2)
  if (w.why === "translate" && s && s.ar && run.opts.wait && dubAzOn(run) && !(s.clip && s.clip.res)) w.why = "voice";
  // والترجمةُ التي ننتظرها تُطلب — ⛔ ~~لا يُطلب شيءٌ والنبضةُ واقفةٌ عند الانتظار~~ فلا ينتهي إلا بمهلته (#10)
  if (w.why === "translate" && s && s.ar == null) dubTranslateAhead(run);
  const ready = !run.opts.wait || (w.why === "behind" ? !run.cur : w.why === "translate" ? !s || s.ar != null :
    !s || !s.ar || !dubAzOn(run) || !!(s.clip && s.clip.res));
  if (!ready && w.why === "voice" && s && !s.clip && dubAzCan(now)) dubAzClip(run, s, dubAzReal(run, s, v.playbackRate));
  if (!ready && now - w.at < DUB_WAIT_MAX_MS) { run.hold = "wait-" + w.why; return true; }
  if (!ready) run.waitGaveUp = run.idx;                          // المهلةُ انقضت: يكمل الفيديو ولا يُنتظر لهذه الجملة ثانيةً
  dubWaitEnd(run);
  try { const pr = v.play(); if (pr && typeof pr.catch === "function") pr.catch(() => {}); } catch { /* يبقى متوقّفاً: «متوقّف» يقوله */ }
  run.movedAt = now;                                             // لا يُعدّ «متجمّداً» لحظةَ عاد
  return true;
}

// متوقّفٌ أو متجمّد: ⭐ **صوتُ Azure الجاري يتوقّف مع الفيديو ويكمل معه** (الجولة الثالثة — بقيّةُ الجملة لا تضيع بإيقافٍ قصير)؛
// وصوتُ الجهاز يُقطع كما كان (⛔ لا `pause()` لطابور النطق أبداً — 📐 علّق المتصفّحَ كلَّه)
function dubPauseHold(run, why) {
  const c = run.cur;
  if (c && c.az && c.audio && c.started && !c.ended) {
    if (!c.held) { c.held = true; clearTimeout(c.endT); try { c.audio.pause(); } catch { /* انتهى */ } }
    run.hold = why;
    return;
  }
  return dubHold(run, why);                                       // صوتُ الجهاز يُقطع — وجملتُه تُذكر هناك (`dubHold`)
}

// ⭐ النبضة — بالترتيب المُقرّ (§٣): يتيم؟ · البوّابة؟ · مصغّرٌ أو تنقّل؟ (`dubWhy`) · **انتظارُنا؟** · إعلان؟ · متوقّفٌ أو
// متجمّد؟ · السرعةُ فوق R_max؟ · قفزة؟ ⇐ ثمّ الجملةُ المستحقّة. **تقرأ الحال ولا تستمع لأحداث الوسائط** (خ16).
function dubTick(run) {
  if (dub !== run || run.state !== "running") return;
  // ⭐ انتهى كلامُ مقطع Azure وما بقي فيه صمتُ آخره ⇐ يُنهى الآن: لا تنتظر الجملةُ التالية صمتاً (الجولة الثالثة) — و`fin` تُعيد النبضة
  const cc = run.cur;
  if (cc && cc.az && cc.fin && cc.started && !cc.held && !cc.ended && cc.audio && !cc.audio.paused && cc.speech > 0 &&
      cc.speech < cc.dur - 0.1 && cc.audio.currentTime >= cc.speech + 0.05) {
    try { cc.audio.pause(); } catch { /* انتهى */ }
    return cc.fin(true);
  }
  const why = dubWhy(run);
  if (why) return dubStop(why);
  const p = document.querySelector("#movie_player"), v = p && p.querySelector("video");
  if (!p || !v) return dubHold(run, "no-video");
  const now = performance.now(), rate = v.playbackRate || 1, ct = v.currentTime - (run.off || 0);
  // جملةُ الجهاز لم تبدأ بعد ثلاث ثوانٍ: صوتٌ آخر يسبقنا — تُعلَّم قديمةً (تُقطع إن بدأت) **وتبقى حاجزاً** حتى
  // يصل حدثُها، ثلاثين ثانيةً على الأكثر: جملةٌ واحدةٌ منّا في الطابور أبداً (مراجعة #8). **وصوتُ Azure لا يُقاس بها:**
  // ثوانيه جلبٌ له مهلتُه — ⛔ ~~كانت تُسقطه قديماً فيضيع صامتاً ويُلام «صوتٌ آخر»~~ (مراجعة 168ح #4)
  if (run.cur && !run.cur.started) {
    if (!run.cur.az && now - run.cur.at > 3000) run.cur.stale = true;
    if (now - run.cur.at > 30000) { run.cur.stale = true; run.cur = null; run.lost++; }
  }
  const prevCt = run.lastCt, prevAt = run.lastAt;
  if (ct !== prevCt) run.movedAt = now;
  run.lastCt = ct; run.lastAt = now;
  if (run.wait && dubWaitTick(run, v, now)) return;
  if (p.classList.contains("ad-showing") || p.classList.contains("ad-interrupting")) { run.wasAd = true; return dubHold(run, "ad"); }
  // ⭐ أوّلُ نبضةٍ بعد الإعلان تقيس فارقَ الساعتين ولا تعمل — ⛔ ~~تعمل بالفارق القديم~~ (تحقّقُ الجولة الحادي عشر): بعد إعلانٍ مُدمَجٍ في الخادم بدا
  // الموضعُ أبعدَ بطول الإعلان، فتُنطق جملةٌ من بعده أو يُوقَف الفيديو لها أو يُطلب صوتُها · **وكانت الجملةُ التي قطعها الإعلانُ لا تُعاد** (الحدُّ
  // المعلَن) ⇒ تُعاد كما بعد إيقاف — **ما دام يوتيوب يُعيد زمنَ المحتوى مع رفع وسم الإعلان** (بعده بنبضةٍ ⇒ قفزٌ كما كان؛ لم يُقس)
  if (run.wasAd) { run.wasAd = false; dubClock(run, true); return dubHold(run, "ad"); }
  // ⭐ موضعُ التوقّف يُحفظ: قفزةٌ والفيديو متوقّف (سحبُ الشريط) لا يراها مقارنُ النبضات — كلُّ نبضةٍ تتبع الموضع — ⛔ ~~فكان المقطعُ
  // الموقوفُ يكمل في الموضع الجديد~~ (تصميمُ الجولة R1) ⇒ أوّلُ نبضةٍ تجري تقارن بموضع التوقّف نفسِه
  if (v.paused) { if (run.pauseCt == null) run.pauseCt = ct; return dubPauseHold(run, "paused"); }
  if (now - run.movedAt >= DUB_FREEZE_MS) return dubPauseHold(run, "frozen");
  if (rate > DUB_R_MAX) return dubHold(run, "speed");
  const jumpedPaused = run.pauseCt != null && Math.abs(ct - run.pauseCt) > DUB_SEEK_S;
  run.pauseCt = null;
  // «قراءةٌ سابقة» بوجودها (`prevAt`) لا بإشارتها — ⛔ ~~`prevCt >= 0`~~ (تحقّقُ الجولة الثالث عشر): قفزٌ إلى الوراء يعبر إعلاناً مُدمَجاً أطولَ من الموضع
  // الجديد يجعل قراءةَ نبضته بالفارق القديم سالبةً، فيُطفئ الكاشفَ في النبضة التالية — جملةٌ قديمةٌ وإيقافٌ للفيديو بدلَ التصحيح
  if (jumpedPaused || (prevAt > 0 && Math.abs(ct - (prevCt + (now - prevAt) / 1000 * rate)) > DUB_SEEK_S)) {
    dubSilence(run); run.sync = true; run.seeked = true; dubClock(run);
    run.recent = []; run.pending = null;                          // بعد القفز: ما يظهر يُقرأ ولو قيل قبلُ
  } else if (now - (run.offAt || 0) > 5000) dubClock(run);
  if (run.cur && run.cur.held) {                                 // صوتٌ أوقفناه مع الفيديو يكمل من حيث وقف
    run.cur.held = false;
    try { const pr = run.cur.audio.play(); if (pr && typeof pr.catch === "function") pr.catch(() => {}); } catch { /* حدثُه يحكم */ }
  }
  // ⭐ سرعةُ الفيديو تبدّلت وسطَ مقطع Azure ⇐ تتبعها سرعتُه من موضعه (تصميمُ الجولة R3) — ⛔ ~~يبقى بسرعته فيتجاوز نافذتَه~~
  const ca = run.cur;
  if (ca && ca.az && ca.audio && ca.started && !ca.held && !ca.ended && ca.unit && Math.abs(rate - (ca.vr || 1)) > 0.02 * (ca.vr || 1)) {
    dubAzSetRate(ca, dubAzRateNow(run, ca.unit, ca, true));
    ca.arm();
  }
  if (run.mode === "display") { run.hold = ""; return dubTickDisplay(run, p, v, now); }
  // ⭐ قفزٌ ⇐ من الموضع الجديد، والانتظارُ مسموحٌ من جديد (حَكَمُ الجولة S6) · **وإيقافٌ أو تجمّدٌ أو إعلان ⇐ لا رجوعَ إلى ما قيل ولا
  // يُرفع «انتُظرت مرّةً»** — ⛔ ~~إيقافٌ عابرٌ يُعيد الجملةَ أو يجيز إيقافَ الفيديو ثانيةً لها~~ (مراجعةُ الجولة #1 · #5 · #7)
  if (run.sync) {
    const i = dubResyncAt(run.sents, ct);
    if (run.seeked) { run.idx = i; run.waitGaveUp = -1; } else run.idx = dubResumeAt(run.sents, ct, i, run.idx, run.cutIdx);
    run.sync = false; run.seeked = false; run.cutIdx = null;
  }
  run.hold = run.cur && !run.cur.az && !run.cur.started && now - run.cur.at > 3000 ? "queue" : "";
  // أصواتُ الجهاز مختارةٌ ولا صوتَ عربيّ فيه ⇐ يُقال لماذا تضيع الجمل — ⛔ ~~«يُدبلج» وكلُّ جملةٍ تضيع صامتة~~ (مراجعةُ الجولة #6)
  if (run.opts.engine !== "azure" && !run.voice) run.hold = "no-voice";
  dubTranslateAhead(run);
  // `cap` السقفُ المطلق (R_max) — والتلقائيّةُ ولحاقُها داخل `dubNext` بحسب التأخّر. `az` يُطلب منه الآن · و`azEng` محرّكُه Azure
  const az = dubAzOn(run), azEng = dubAzEngine(run), cap = azEng ? Math.min(DUB_R_MAX, DUB_CATCH_CEIL_AZ * Math.max(1, rate)) : DUB_R_MAX;
  if (az) dubAzPrefetch(run, rate, cap);
  // ولا بدءَ والمشغّلُ يقفز: يتجمّد فيقطعها التجمّدُ ثمّ تُعاد (مراجعة #7)
  if (v.seeking) return;
  // جملةٌ واحدةٌ منّا تتكلّم أبداً — **ومع الانتظار**: التاليةُ مستحقّةٌ منذ DUB_WAIT_BEHIND_S ⇐ يتوقّف الفيديو حتى تفرغ هذه
  if (run.cur) {
    const nx = run.sents[run.idx];
    // وإيقافُ اللحاق مرّةً كلَّ عشرين ثانيةً على الأكثر (تصميمُ الجولة G5): صوتٌ لا يلحق كثافةَ الكلام لا يُقطّع الفيديو كلَّ جملة
    if (run.opts.wait && run.cur.started && nx && ct - nx.start / 1000 > DUB_WAIT_BEHIND_S && now - run.behindAt >= DUB_WAIT_BUDGET_MS) {
      run.behindAt = now;
      dubWaitStart(run, v, "behind");
    }
    return;
  }
  const plan = dubNext(run.sents, run.idx, ct, rate, azEng ? run.cpsAz : run.cps, cap, DUB_CURVE_MAC, run.opts.rate);
  run.skipped += plan.skipped; run.idx = plan.i;
  if (document.hidden && plan.skipped) run.bgSkipped += plan.skipped;
  if (plan.done) { run.hold = "done"; return; }
  // الترجمةُ لم تصل والجملةُ حلّت ⇐ مع الانتظار يتوقّف الفيديو حتى تصل
  // ⛔ ~~ولا مترجمَ يبقى~~: كلُّ جملةٍ كانت توقف الفيديو ثلاثَ ثوانٍ بلا نهاية (مراجعةُ الجولة #3) — «tr-off» يقول لماذا لا كلام
  if (plan.wait === "translate") { if (run.opts.wait && plan.behind > 0 && dubCanTranslate(run)) dubWaitStart(run, v, "translate"); return; }
  if (!plan.speak) return;
  // ⭐ صوتُ Azure لم يجهز والجملةُ حلّت ⇐ مع الانتظار يتوقّف الفيديو حتى يجهز (ويُطلب الآن إن لم يُطلب). وبلا انتظارٍ يمضي
  // الفيديو وينتظر المقطعُ صوتَه، فيبدأ متأخّراً أسرع
  if (az && run.opts.wait) {
    const s = run.sents[plan.i];
    if (dubAzRetryable(run, s)) s.clip = null;
    if (!(s.clip && s.clip.res)) {
      if (!s.clip && dubAzCan(now)) dubAzClip(run, s, plan.real);
      if (ct >= s.start / 1000) dubWaitStart(run, v, "voice");
      return;
    }
  }
  dubSpeak(run, plan);
}

// خياراتُ المستخدم من البوب-أب — تصل مع «دبلِج» ومع كلّ تغيير، وتُطبَّق من الجملة التالية؛ **والمصدرُ بإعادة البدء** (البوب-أب
// يُرسل «دبلِج» من جديد حين يتبدّل — الجولة الثالثة). `wait`: «أوقف الفيديو حتى يجهز الصوت»، مفعّلٌ ما لم يُطفأ صراحةً
function dubOpts(o) {
  const x = o || {};
  const vol = Number(x.volume);
  const rate = x.rate === "auto" || x.rate == null ? "auto" : Number(x.rate);
  return { source: x.source === "device" ? "device" : x.source === "azure" ? "azure" : "yt",
    engine: x.engine === "azure" ? "azure" : "system", az: dubAzOpts(x.az),
    volume: Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 1,
    rate: rate === "auto" || !(rate >= 1 && rate <= DUB_RATE_CAP) ? "auto" : rate,
    voice: typeof x.voice === "string" ? x.voice.slice(0, 200) : "", wait: x.wait !== false };
}

function dubSetOptions(o) {
  const run = dub;
  if (!run) return dubStatus();
  const next = dubOpts(Object.assign({}, run.opts, o || {}));
  const voiceChanged = next.voice !== run.opts.voice, a0 = run.opts.az, a1 = next.az;
  if (a1.voice !== a0.voice) run.azN = 0;                        // صوتُ Azure آخر ⇐ سرعتُه تُتعلَّم سريعاً من جديد
  // مفتاحٌ أو منطقةٌ صُحّحا أثناء التشغيل يُجرَّبان الآن — ⛔ ~~«مرفوض» يبقى على ما صُحّح بقيّةَ التشغيلة~~ (مراجعة 168ح #16)
  if (a1.key !== a0.key || a1.region !== a0.region) { run.azOff = ""; run.azWarn = ""; }
  if (a1.trKey !== a0.trKey || a1.trRegion !== a0.trRegion) {
    run.trOff = !a1.trKey && run.opts.source === "azure" ? "nokey" : ""; run.trFails = 0; run.trUntil = 0;
  }
  // وما جُلب مسبقاً بصوتٍ أو مفتاحٍ أو سرعةٍ أخرى يسقط: «من الجملة التالية» وعدٌ لا يُخلفه مقطعٌ قديم (مراجعة 168ح #6)
  if (a1.voice !== a0.voice || a1.key !== a0.key || a1.region !== a0.region || next.rate !== run.opts.rate) {
    for (const x of run.sents || []) if (x.clip) dubClipDrop(run, x);
  }
  run.opts = Object.assign(next, { source: run.opts.source });   // المصدرُ لا يتبدّل وسطَ التشغيل — البوب-أب يُعيد البدءَ به
  if (voiceChanged && run.voice) dubVoiceGet(next.voice).then((v) => { if (v && dub === run) run.voice = v; });
  return dubStatus();
}

function dubStart(o) {
  if (!dubActive()) return { ok: false, state: "refused", reason: "gate" };
  const vid = dubVideoId();
  if (!vid) return { ok: false, state: "refused", reason: "no-video" };
  const opts = dubOpts(o);
  if (dub && dub.vid === vid && dub.opts.source === opts.source && (dub.state === "preparing" || dub.state === "running")) return dubSetOptions(opts);
  dubStop("restart");
  const run = dub = { token: ++dubToken, vid, opts, state: "preparing", step: "facts", reason: "", detail: "", hold: "",
    kind: "", spokenLang: "", sents: null, idx: 0, spoken: 0, skipped: 0, lost: 0, bgSkipped: 0, drops: 0, inflight: 0,
    cur: null, timer: 0, cps: DUB_CPS, lastCt: -1, lastAt: 0, movedAt: performance.now(), sync: true, lags: [], dl: null,
    warm: true, off: 0, offAt: 0, clockBusy: false, wasAd: false, mode: "", shown: false,
    lastLine: "", lineAt: 0, grow: false, base: "", said: "", offerAt: 0, capWin: 3000, recent: [], pending: null, seen: 0, trackLang: "",
    azOff: "", azWarn: "", azTts: 0, azTr: 0, cpsAz: DUB_CPS_AZ, azN: 0,
    trOff: "", trBusy: false, trFails: 0, trUntil: 0, blobs: new Set(), warmA: null, wait: null, waits: 0, waitGaveUp: -1, pauseCt: null, ytWhy: "",
    behindAt: -Infinity, tails: [], leads: [], speeds: [], stallS: 0, seeked: false, cutIdx: null };
  dubPrepare(run).catch((e) => dubRefuse(run, "threw", e?.message || e));
  return dubStatus();
}

function dubStatus() {
  const r = dub;
  if (!r) return { ok: true, state: "idle" };
  // رفضٌ يخصّ فيديو غادرناه لا يُعرض على غيره — إلا القاطع (يعمّ الصفحة) و«تغيّر أثناء التجهيز» (مراجعة #11)
  if (r.state === "refused" && r.reason !== "breaker" && r.reason !== "nav" &&
      (location.pathname !== "/watch" || dubVideoId() !== r.vid)) return { ok: true, state: "idle" };
  const lags = r.lags.slice().sort((a, b) => a - b);
  // ⭐ أرقامُ القياس (الجولة الثالثة — لا نصَّ ولا مفتاح): ما يجيب عنه تشغيلُ المالك القادم بلا طلبٍ زائد — سرعةُ الصوت المتعلَّمة · صمتا
  // طرفي المقطع (null: الفكُّ غيرُ متاح) · السرعةُ المستعملة · ما تحتاجه الجملُ القادمة · كم انتظر الفيديو
  const q = (a, f) => { const x = a.slice().sort((m, n) => m - n); return x.length ? x[Math.min(x.length - 1, Math.floor(f * x.length))] : null; };
  const v = document.querySelector("#movie_player video"), vr = (v && v.playbackRate) || 1, azE = dubAzEngine(r);
  const cps = azE ? r.cpsAz : r.cps, need = [];
  // والعربيّةُ وحدَها تُعدّ — ⛔ ~~النصُّ الإنجليزيّ لجملةٍ لم تُترجم بعد~~: حروفُه غيرُ حروف ما سيُنطق
  if (r.sents) for (let i = r.idx; i < Math.min(r.sents.length, r.idx + 20); i++) { const u = r.sents[i]; if (u.ar) need.push(u.ar.length / cps / Math.max(0.5, u.win / 1000) * vr); }
  const btn = document.querySelector("#movie_player .ytp-subtitles-button");
  const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
  return { ok: true, state: r.state, step: r.step, reason: r.reason, detail: r.detail, hold: r.hold, kind: r.kind,
    spokenLang: r.spokenLang, total: r.sents ? r.sents.length : 0, idx: r.idx, spoken: r.spoken, skipped: r.skipped,
    lost: r.lost, bgSkipped: r.bgSkipped, warm: r.warm, dl: r.dl, voice: r.voice ? r.voice.name : "",
    source: r.opts.source, seen: r.seen, off: r.off, lagP50: lags.length ? lags[Math.floor(lags.length / 2)] : null,
    // ⛔ المفتاحان لا يُعادان في الحال أبداً — المحرّكُ وتحذيراتُه وعدُّ الحروف وحدَها. ⭐ **وما يتكلّم الآن يُقرأ حيّاً** (`azOn`)
    // لا ما طُلب: ⛔ ~~«بصوت Azure» وصوتُ الجهاز يتكلّم~~ — والحدُّ يُقال ما دامت مهلتُه، ويُمحى بعدها (مراجعة 168ح #5 · #14)
    engine: r.opts.engine, azOn: r.opts.engine === "azure" && dubAzOn(r), azOff: r.azOff,
    azWarn: r.opts.engine === "azure" && !r.opts.az.key ? "nokey" : r.opts.engine === "azure" && dubAzGate.until > performance.now() ? "rate" : r.azWarn,
    trOff: r.trOff, trLocal: !!r.tr, rate: r.opts.rate, azTts: r.azTts, azTr: r.azTr, wait: r.opts.wait, waits: r.waits, ytWhy: r.ytWhy || "",
    cps: Math.round(cps * 10) / 10, tailMs: r.tails.length ? Math.round(q(r.tails, 0.5) * 1000) : null,
    leadMs: r.leads.length ? Math.round(q(r.leads, 0.5) * 1000) : null, spd: [r2(q(r.speeds, 0.5)), r2(r.speeds.length ? Math.max(...r.speeds) : null)],
    need: [r2(q(need, 0.5)), r2(q(need, 0.9))], stallS: Math.round(r.stallS * 10) / 10, lagP90: lags.length ? r2(q(lags, 0.9)) : null,
    // ⭐ يوتيوب يعرض ترجمتَه العربيّة (اللاصقةُ عند المالك عربيّة) وأنا أقرأ ترجمةً أخرى — هو ملاحظةُ المالك ١ في مصدرَي الترجمة
    // ⛔ ~~ولو كان ما نقرؤه اليدويّةَ العربيّة نفسَها~~ («speak»: نقرأ ما يُعرض حرفاً — مراجعةُ الجولة #5)
    shownDiffers: r.opts.source !== "yt" && r.kind !== "speak" && dubPrim(r.trackLang) === "ar" && !!btn && btn.getAttribute("aria-pressed") === "true" };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GVZ_STATUS") {
    // A frame that exited early (#13b) answers "not-started" and NEVER wakes for a
    // message. Waking on messages would undo #13b outright: opening the popup would
    // start all 122 frames measured on a news page. It answered with its untouched
    // startup defaults instead, which is how it came to report a blocked, enabled
    // extension as stopped (audit #56).
    if (!startupBegun) {
      sendResponse({ ok: false, reason: "not-started" });
      return true;
    }
    // ONLY what the frame alone can know. Whether the extension is enabled and
    // whether the site is blocked are facts the popup owns — storage and the tab URL
    // — so asking a frame for them was the original mistake; the sleeping frame just
    // made it visible (#56).
    sendResponse({
      ok: true,
      hasVideo: !!document.querySelector("video"),
      hasVideoUnderPointer: !!getVideoFromPointerPosition(),
      ytQualityGap: ytQualityGap()
    });
    return true;
  }
  // Switching the extension on from the popup applies the Shorts redirect right
  // away, the same way switching it off stops it — no reload either way (#20).
  if (msg?.type === "SITE_RULES_UPDATED") {
    siteRules = msg.siteRules || { enabled: false, mappings: [] };
    buildMap();
    if (!remappingEnabled()) hideOverlayNow();
    maybeRedirectShorts();
  }
  // Every RELOAD_* now goes through the one applier — see requestReload (audit #14)
  if (RELOAD_MESSAGE_TYPES.has(msg?.type)) requestReload();

  // ── البند #38ج — الإيقاظ ──────────────────────────────────────────────────
  // **لماذا رسالة جديدة ولم تكفِ `RELOAD_YT_QUALITY` القائمة؟** لأنها تمرّ بـ
  // `flushReload` التي تخرج مبكراً عند `snapshot === lastAppliedSnapshot` —
  // **وفي الإيقاظ لم يتغيّر شيء بالتعريف**، فتخرج ولا تنادي `triggerYtQuality`.
  // وإسقاط ذلك الخروج المبكر يهدم تجزئة #14 التي تجعل القناتين مجّانيتين
  // (أيّهما وصلت أولاً كفت). **فالقائم لا يكفي، والدلالتان مختلفتان:**
  // `RELOAD_*` تعني «تغيّر إعداد فأعد القراءة»، و`GVZ_ACTIVATED` تعني
  // **«لم يتغيّر شيء، وأعد تنفيذ خطوة البدء»**.
  //
  // ⚠️ **وإطار خرج مبكراً لا يستيقظ برسالة** (#13ب و#56): جوابه أنه لم يبدأ،
  // وإيقاظه هنا يفتح 122 إطاراً على صفحة أخبار. والفرع الآخر لا يحتاجه أصلاً —
  // هناك يُحقن `content.js` من جديد فيبدأ بنفسه.
  if (msg?.type === "GVZ_ACTIVATED") {
    if (startupBegun) applyYtQualityStep();
    return; // لا ردّ: المرسِل لا ينتظر شيئاً
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
  // #168 — الدبلجة: البوب-أب يرسلها إلى الإطار الأعلى وحدَه (frameId 0). **وإطارٌ نائمٌ لا يستيقظ** (#13ب)
  if (msg?.type === "GVZ_DUB_START" || msg?.type === "GVZ_DUB_STOP" || msg?.type === "GVZ_DUB_STATUS" || msg?.type === "GVZ_DUB_SET") {
    if (!startupBegun) {
      sendResponse({ ok: false, reason: "not-started" });
      return true;
    }
    if (msg.type === "GVZ_DUB_START") sendResponse(dubStart(msg.opts));
    else if (msg.type === "GVZ_DUB_SET") sendResponse(dubSetOptions(msg.opts));
    else if (msg.type === "GVZ_DUB_STOP") { dubStop(msg.why === "other-tab" ? "other-tab" : "user"); sendResponse(dubStatus()); }
    else sendResponse(dubStatus());
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

// ONE read for the whole startup (audit #13). Every key any loader needs is
// requested here with that loader's own default, so each of them sees exactly
// what its solo read would have returned. Failure is handled per step as before:
// this promise rejecting makes every step reject, and startup() swallows the
// expected "context invalidated" case for each.
// content.js is injected into EVERY frame at document_start, and on a real page most
// frames are ad / cookie-sync iframes that never hold a video: measured 121 of 122
// contexts on aljazeera.net and 62 of 63 on cnn.com. Each of those used to do the
// whole startup — a storage read, eight loaders, a stylesheet and a MutationObserver
// — for a frame that has nothing to act on (audit #13b).
//
// Two frames must start eagerly no matter what, and both are already host-gated:
//   * the Shorts redirect has to fire at document_start, BEFORE any video exists —
//     waiting for one would defeat its whole purpose;
//   * Clean Player CSS has to be in place before YouTube's player paints, or the
//     chrome it hides flashes first.
// Both are YouTube-family only, so exempting that host covers them exactly.
function frameStartsEagerly() {
  return isYouTubeFamilyHost();
}

let startupBegun = false;
function beginStartup() {
  if (startupBegun) return;
  startupBegun = true;
  runStartupSteps();
}

// Waking is EVENT-DRIVEN, never observed: a MutationObserver per frame would just
// trade one cost for another. A <video> fires these as soon as it begins loading,
// which covers lazy loading, a player injected after interaction, SPA navigation
// inside the frame, and an ad slot replaced by real content. Capture phase because
// media events do not bubble.
const MEDIA_WAKE_EVENTS = ["loadedmetadata", "loadeddata", "canplay", "play", "durationchange"];

function armLazyStartup() {
  const wake = () => {
    for (const ev of MEDIA_WAKE_EVENTS) document.removeEventListener(ev, wake, true);
    beginStartup();
  };
  for (const ev of MEDIA_WAKE_EVENTS) document.addEventListener(ev, wake, true);
  // Safety net for <video preload="none">, which fires nothing at all until it is
  // touched: one querySelector at DOMContentLoaded, and the same cheap check from
  // the deliberate input handlers we already have (see wakeIfVideoPresent).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wakeIfVideoPresent, { once: true });
  }
}

// Called from the wheel / click / keydown paths. One querySelector on a deliberate
// user action is nothing; it is never called once the frame has started.
function wakeIfVideoPresent() {
  if (startupBegun) return;
  if (document.querySelector("video")) beginStartup();
}

const startupRead = () => chrome.storage.sync.get({
  settings: {},
  globalSiteRules: { enabled: false, mappings: [] },
  siteProfiles: {},
  [spKeyFor(baseDomain(location.host))]: null
});

// ---- ONE applier for both delivery channels (audit #14) ----
// Every save fired an explicit RELOAD_* message AND storage.onChanged in every frame,
// and both reloaded the same slices — each loader doing its own storage read, so the
// whole load ran twice per frame per tab. Dropping a channel would put at risk the
// instant apply this project treats as an acceptance condition, so instead BOTH feed
// one applier:
//   * requests in the same tick coalesce into a single pass,
//   * the pass does ONE storage read for everything (as startup does),
//   * and if what it reads is identical to what is already applied it does nothing —
//     which is what makes the second channel free, whichever arrives first and even
//     if the other never arrives at all.
// Reloading every slice rather than the one named by the message is deliberate: the
// read is already paid for, the loaders are pure transforms over it, and a per-slice
// snapshot would be a correctness trap the moment two channels name different slices.
const RELOAD_MESSAGE_TYPES = new Set([
  "RELOAD_SITE_RULES", "RELOAD_SITE_PROFILE", "GVZ_RELOAD", "RELOAD_ZONE_SETTINGS",
  "RELOAD_OVERLAY_SETTINGS", "RELOAD_SUBTITLES", "RELOAD_YT_QUALITY",
  "RELOAD_YT_SHORTS", "RELOAD_CLEAN_PLAYER"
]);
let reloadScheduled = false;
let lastAppliedSnapshot = null;

function requestReload() {
  // A frame that exited early (audit #13b) must NOT wake for a settings change. It
  // reads the current values itself the moment a video appears, so it cannot miss
  // one either — nothing here needs to remember the change on its behalf.
  if (!startupBegun) return;
  if (reloadScheduled) return;
  reloadScheduled = true;
  Promise.resolve().then(flushReload);
}

async function flushReload() {
  reloadScheduled = false;
  const data = await startupRead();
  const snapshot = JSON.stringify(data);
  if (snapshot === lastAppliedSnapshot) return; // the other channel already applied it
  lastAppliedSnapshot = snapshot;

  await Promise.all([
    loadRulesForThisHost(data), loadSiteProfile(data), loadZoneSettings(data),
    loadOverlaySettings(data), loadBlockedHosts(data), loadLinkedVideoHosts(data), loadSoundDisplaySettings(data),
    loadMasterEnabled(data), loadGridAppearance(data), loadSubtitleSettings(data), loadYtAutoQualitySettings(data),
    loadYtShortsRedirectSetting(data), loadCleanPlayerSettings(data), loadIdleSettings(data),
    loadFilterPresets(data)   // #109
  ]);
  // #76: بعد اكتمال المُحمِّلات كلّها لا داخل أحدها — فالاشتقاق يقرأ حالةً تامّة
  refreshIdleConsumers();
  // ⭐ **بعد التطبيق المعتاد لا قبله** — فلا يُلغيه، **ولمستهلكٍ بعينه لا للجميع**
  for (const name of idleWakeQueue) applyIdleConsumerNow(name);
  idleWakeQueue.clear();
  triggerYtQuality();
  maybeRedirectShorts();
  // ‏#64: إطفاء الرئيسي يُخفي الشبكة كما يفعل إطفاء الريماب.
  if (!extensionActive() || !remappingEnabled()) hideOverlayNow();
}

function runStartupSteps() {
  const read = startupRead();
  // The Shorts redirect consults the enable flags, so its first check has to wait
  // for them: at document_start siteRules/siteProfile are still false and it would
  // skip a redirect the user has switched on (audit #20).
  const globalRulesReady = startup("globalRules", () => read.then(loadRulesForThisHost));
  const siteProfileReady = startup("siteProfile", () => read.then(loadSiteProfile));
  // ‏#64: الرئيسي يُقرأ مع الأوائل — بوّابة تُقرأ متأخّرة بوّابة مفتوحة لحظةً.
  startup("master", () => read.then(loadMasterEnabled));
  startup("zones", () => read.then(loadZoneSettings)); // ✅ مهم: تشغيل zones بعد refresh مباشرة
  const overlayReady = startup("overlay", () => read.then(loadOverlaySettings));
  startup("blockedHosts", () => read.then(loadBlockedHosts));
  startup("linkedVideoHosts", () => read.then(loadLinkedVideoHosts));
  startup("soundDisplay", () => read.then(loadSoundDisplaySettings));
  startup("filterPresets", () => read.then(loadFilterPresets));   // #109
  startup("gridAppearance", () => read.then(loadGridAppearance));
  startup("subtitles", () => read.then(loadSubtitleSettings));
  startup("subtitleObserver", startSubtitleTrackObserver);
  // البدء والإيقاظ يستهلكان `applyYtQualityStep` نفسها — لا تسلسل ثانٍ (#38ج)
  startup("ytQuality", () => read.then(applyYtQualityStep));
  startup("ytShorts", () => Promise.all([
    read.then(loadYtShortsRedirectSetting), globalRulesReady, siteProfileReady
  ]).then(() => startYtShortsRedirect()));
  startup("cleanPlayer", () => read.then(loadCleanPlayerSettings));
  // ⚠️ **التبعية صريحة لا ترتيبَ تسجيل** (#76): `refreshIdleConsumers` تشتقّ
  // `idleWanted` من مفاتيح المستهلكين، **وهي في `overlaySettings`** — فلو استُؤنف
  // هذا قبل ذاك لقُرئ المفتاح قبل أن يُكتب، **وبقي المحرّك مطفأً إلى أول تغيير
  // إعدادات**. وكان يصحّ بترتيب المهامّ الدقيقة **مصادفةً لا بناءً**.
  // والنمط هو نمط `ytShorts` أعلاه حرفياً: خطوةٌ تنتظر ما تعتمد عليه.
  startup("idle", () => Promise.all([read.then(loadIdleSettings), overlayReady])
    .then(refreshIdleConsumers));
  startup("boostReapply", startBoostReapply);
}

if (frameStartsEagerly()) beginStartup();
else armLazyStartup();

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

function shouldLetNativeLinkHandlingRun(e, video) {
  const target = e.target;
  if (!target?.closest) return false;

  const linkLike = target.closest("a[href], [role='link']");
  if (!linkLike) return false;

  if (!video) return true;

  if (linkLike === video) return false;
  if (video.contains?.(linkLike)) return false;

  // ⭐⭐ **#145 — ورابطٌ يلفّ الفيديو ليس رابطاً قَصَده المستخدم، بل البطاقةُ
  // حولَه.** كان الشرط «أثمّة رابطٌ فوق الهدف؟» **وهو أوسعُ من سؤاله** (قرار 93):
  // سؤالُه «أَقصَد الرابطَ أم الفيديو؟» — **وغلافُ المنشور في الخلاصة يُطابق
  // الأوّل ولا يجيب الثاني**، فكان الزرُّ الأوسط يفتح تبويباً والأيمنُ يفتح
  // قائمةَ المتصفّح بدل أمر المستخدم.
  //
  // ⛔⭐ **والمُميِّزُ `contains` لا الهندسة، وقِيس على الجانبين قبل أن يُكتب:**
  // في لقطة يوتيوب الحقيقية في `tools/snapshots` **تسعةَ عشرَ رابطاً داخل
  // `#movie_player`** — منها 12 `ytp-modern-videowall-still` و3
  // `ytp-ce-covering-overlay` — **وصفرٌ منها يلفّ الفيديو**: كلُّها مرسومةٌ
  // فوقه. ⇒ **فيوتيوب يبقى ممتنعاً بالبناء لا بالنيّة**، وبطاقاتُ نهايته
  // تُنقَر كما كانت. **وغلافُ إنستقرام يلفّ** ⇒ فنعمل.
  // #147 — **وعلى المواقع المُعلَنة وحدَها** (انظر رأسَ `hostAllowsLinkedVideo`).
  if (hostAllowsLinkedVideo() && linkLike.contains?.(video)) return false;

  return true;
}

function togglePlay(video) {
  if (!video) return;
  if (video.paused) video.play().catch(()=>{});
  else video.pause();
}

// ── البند #34 · قياس `tools/bench-seek-edge.mjs` و`tools/bench-live-seek.mjs` ──
// **المرجع `seekable` لا `duration`.** كان الحارس يرفض كل عنصر `duration`ه غير
// منتهية، وقِيس أن ذلك **يطابق تويتش لا كل بثّ**: يوتيوب المباشر يعلن
// `duration = 50380` منتهية ونافذة 14 ساعة **والتقديم يقع فيه اليوم فعلاً**.
//
// ⚠️ **ولماذا يُرفض التقديم بدل أن يُحرَس؟ لأن الضرر مقيس ولا تعافي ذاتيّ فيه:**
// كتابة `currentTime` إلى ما بعد حافة بثّ نهايته **قيمة حدّية (2^30)** تُجمّد
// المشغّل — قِيس على `twitch.tv/ow_esports` في **تشغيلتين**: الزمن ثابت عند
// 36.5s طوال 15.6s، و`readyState = 1`، و`paused`/`seeking` مرفوعان، والأحداث
// `seeking · waiting · pause`. **ولا يخرج منه إلا كتابة إلى الخلف.** فمراقبٌ
// يرصد التجمّد ويتراجع **آلة غير متزامنة جديدة** تراهن على أن المشغّل لا يتعافى،
// والرفض **يجعل التجمّد مستحيلاً بالبناء بسطر شرط** — وهو خيار #58 و#59 نفسه:
// **المستحيل بالبناء أولى من المحروس.**
//
// **وما نخسره مكتوب عمداً:** التقديم **داخل** نافذة DVR على تويتش بعد إرجاع
// **غير مدعوم قصداً**. ولو أُريد يوماً **فثمنه مراقب تجمّد** — يُقرأ هذا ولا
// يُعاد النقاش من الصفر.
//
// ⚠️ **ونطاق فارغ ليس نطاقاً غائباً:** خادم بلا دعم نطاقات يعطي
// `seekable = [[0, 0]]` — **طوله 1 لا 0**، فشرط `length === 0` وحده **لا يُطلق**.
// ولذلك الشرط شرطان. **وهذا تغيّر سلوك مقصود ومقيس:** اليوم يُحسب الهدف 49.5
// **فيقصّه المتصفّح إلى 0** فيضيع الموضع ويعود التشغيل من الأول، وبعد الإصلاح
// **لا يحدث شيء**. ليس انحداراً.
function seek(video, deltaSec) {
  if (!video) return;

  // (١) نافذة صالحة قبل أي شيء
  const ranges = video.seekable;
  if (!ranges || ranges.length === 0) return;
  const start = ranges.start(0);
  const end = ranges.end(ranges.length - 1);
  if (!(end - start > 0)) return; // نافذة فارغة — يسقط [[0,0]] هنا لا بالشرط الأول

  const target = video.currentTime + deltaSec;

  // (٢) الإرجاع مسموح دائماً متى صحّت النافذة، ويُقصّ إلى بدايتها
  if (deltaSec < 0) {
    video.currentTime = Math.max(start, target);
    return;
  }

  // (٣) التقديم مسموح فقط إذا كان الحدّ الأعلى موثوقاً. **والثقة معرَّفة بالمقيس
  // لا بعتبة مخترعة: `end` موثوق إذا كانت `duration` منتهية** — فيوتيوب المباشر
  // يعمل كما هو اليوم، وتويتش (`Infinity` ونهاية حدّية) يُرفض تقديمه.
  if (isNaN(video.duration) || !isFinite(video.duration)) return;
  video.currentTime = Math.max(start, Math.min(target, Math.min(end, video.duration)));
}

// ── البند #60 · قرار المالك 25 — إطار محوّلات المضيفين ──────────────────────
// **لماذا وُجد:** قِيس أن يوتيوب وتويتش يحتفظان بنموذج مستوى خاص بهما ويعيدان
// رسمه على `video.volume` عند أي دورة كتم من طرفهما، **فتُمحى كتابتنا الصحيحة**
// ⛔ ~~**«ويعود المستوى إلى قيمة ثابتة عندهما (56.2% و50%) مهما كتبنا»**~~ —
// **مصحَّحٌ 2026-08-04 (قرار 21)، والعلّةُ ليست الرقم بل «ثابتة»:** المصدرُ في
// `AUDIT.md` يقول منذ 2026-07-30 إن خطّ الأساس عند يوتيوب **تفاوت بين التشغيلات
// (56.2 · 56.3 · 56.9 · 64.9 · 83.6) بلا تفسير مقيس** — **وهذا الملخَّصُ أسقط
// التحفّظ فصلّبه**. ⇒ **والمقيس 2026-08-04: 100%، وهو التكرارُ الأوّل للشاذّة
// المسجَّلة هناك.**
// ⇒ ⭐ **والصحيح: يعود المستوى إلى نموذج المضيف، وقيمتُه متفاوتةٌ غيرُ مفسَّرة.**
// ⚠️ **والآليّةُ لم يمسَّها القياس** — فلا يُقرأ هذا إبطالاً للمحوّل: الرقمُ
// شُرح به ولم يُبنَ عليه.
// وقِيس أن قيادة
// واجهة المضيف هي **الوحيدة** التي تجعل نموذجه يتبعنا. التفصيل: `AUDIT.md` §8.
//
// **وأربعة قيود بنيوية لا تُخفَّف** (قرار 25):
//  ١. السجلّ مفتاحه المضيف و**افتراضه لا محوّل**. من لا محوّل له يسلك مسار اليوم
//     **حرفياً** — ولذلك يخرج `hostAdapterFor` فوراً حين يكون السجلّ فارغاً، بلا
//     حتى استدعاء `baseDomain`.
//  ٢. **عمليات نسبية فقط**: خطوة أعلى · خطوة أسفل · قلب الكتم. **لا ضبط مطلق في
//     الواجهة أصلاً** كي لا يُضاف لاحقاً سهواً — والقيد يُسقط حاجتنا إلى معرفة
//     منحنى المضيف بين منزلقه و`video.volume`، وهو منحنى غير مقيس ولا نحتاجه.
//  ٣. **تحقّق بعديّ ثم سقوط آمن**: إن لم تتغيّر حالة الصوت خلال مهلة قصيرة سقطنا
//     إلى الكتابة المباشرة — أي **سلوك اليوم**. فإعادة تصميم المضيف تُنزلنا إلى
//     ما نحن عليه الآن **لا إلى عطب** (درس #50)، **والسقوط يُسجَّل مرة لا في كل
//     ضغطة**. والسقوط مسار عمل حقيقي لا اسم: قِيس أن `video.volume` يقصّ المسار
//     المعزَّز بنسبة **0.500 بالضبط**، فالمستخدم يسمع فرقاً حتى مع المعزّز.
//  ٤. **الشارة تقرأ الحالة الحيّة بعد العملية دائماً** — في المسار المباشر وبعد
//     نجاح المحوّل وبعد السقوط على السواء.
//
// ⚠️ **وهذا الكومِت يُدخل الإطار وحده بصفر محوّل مسجَّل**، وشرط قبوله **صفر تغيّر
// سلوكي**: `tools/test-host-adapter.js` يبرهنه، ومنه حارس دائم يعدّ الأحداث
// المُرسَلة ويُفشل الاختبار إن تجاوزت المتوقَّع — أثراً لحادثة انفجار أحداث
// رُئيت مرة ولم تُفسَّر (`AUDIT.md` §9).
const hostAdapters = new Map();       // baseDomain ⇒ محوّل. **فارغ عمداً**
const ADAPTER_OPS = ["stepUp", "stepDown", "toggleMute"]; // نسبية فقط، بلا مطلق
const ADAPTER_VERIFY_MS = 150;
const adapterFellBack = new Set();    // «مضيف|عملية» ⇒ سُجِّل سقوطه مرة واحدة

function hostAdapterFor() {
  if (!hostAdapters.size) return null; // المسار الشائع: خروج قبل أي عمل
  return hostAdapters.get(baseDomain(location.host)) || null;
}

function audioStateOf(video) {
  return { volume: video?.volume ?? 1, muted: !!video?.muted };
}

// يُرجع true إن تولّى المحوّل العملية (ومعه تحقّقه وسقوطه)، و false ⇒ نفّذ المسار
// المباشر فوراً كما هو اليوم.
function runHostAdapter(video, op, applyDirect) {
  const adapter = hostAdapterFor();
  if (!adapter || typeof adapter[op] !== "function") return false;
  const before = audioStateOf(video);
  try {
    const res = adapter[op](video);
    if (res === false) return false;
    // ⚠️ **«skip» = تولّاها المحوّل بأن قرّر ألا يقع شيء** (عقد الصوت ع2 على
    // مضيف يكتم بتصفير المستوى). لا تحقّق ولا سقوط: **السقوط هنا ضرر لا احتياط**
    // — يكتب قيمة يمحوها المضيف فتتحرّك الشارة ولا يتغيّر شيء.
    if (res === "skip") {
      // وحتى حين لا يقع شيء **تُعرض الشارة**: المستخدم فعل، فيستحقّ جواباً
      // صادقاً عن الحالة (عقد الصوت ع3). صمتٌ تامّ يبدو تعطّلاً.
      showVolumeIndicator(video);
      return true;
    }
  } catch (err) {
    console.debug(`[VIDEO-ZONES] محوّل ${op} رمى، والمسار المباشر يتولّاه:`, err);
    return false;
  }
  setTimeout(() => {
    const now = audioStateOf(video);
    if (now.muted !== before.muted || Math.abs(now.volume - before.volume) > 0.001) {
      showVolumeIndicator(video); // نجح المحوّل — والشارة تقرأ ما صار إليه فعلاً
      return;
    }
    const key = `${baseDomain(location.host)}|${op}`;
    if (!adapterFellBack.has(key)) {
      adapterFellBack.add(key);
      console.debug(`[VIDEO-ZONES] محوّل ${op} لم يقع أثره، والسقوط إلى الكتابة المباشرة`);
    }
    applyDirect();
    showVolumeIndicator(video);
  }, ADAPTER_VERIFY_MS);
  return true;
}

// ── محوّل يوتيوب (#60 · قرار 25) — عائلة «اختصار المضيف» ────────────────────
// قِيس أن قيادة واجهة المضيف هي **الوحيدة** التي تجعل نموذجه يتبعنا، وأن
// **حدثاً غير موثوق يكفيها** (`AUDIT.md` §8 §6) — فسكربت المحتوى يستطيعها.
// ومصنع لا نسخة مفردة: يوتيوب عائلة «الاختصار»، وتويتش وكِك عائلة «المنزلق»،
// فيُكتبان لاحقاً بمصنعهما لا بتكرار هذا.
//
// ⚠️ **حارس عدم الارتداد**: مستمع المفاتيح عندنا في `window`+`capture` **يرى ما
// نُرسله** — قِيس **2 من 2** — فبلا هذا العلم يصير أمر الصوت يُطلق نفسه.
let adapterSending = false;

// ⚠️ **قاعدة عامة: أي مسح لعناصر الصفحة يستثني عناصر الإضافة صراحةً.**
// واقعتها: مِجَسّ الشكل على كِك طابق عنصراً واحداً هو **`.vzVolume` — شارتنا
// نحن** — اصطادها `[class*="volume"]`. **محوّل يمسح بلا استثناء يقود شارته**،
// فيقرأ حالته هو ويحسبها حالة المضيف. تُستدعى في كل محوّل يمسح.
function isOwnElement(el) {
  if (!el || el.nodeType !== 1) return false;
  if (typeof el.closest === "function" && el.closest(".vzWrap")) return true;
  const cls = typeof el.className === "string" ? el.className : "";
  return /\bvz[A-Z]/.test(cls) || /^vz_/.test(el.id || "");
}

function makeKeyStepAdapter({ playerSelector, upKey, downKey, unmuteKey, minSendMs = 60, maxQueue = 5 }) {
  // الطابور صار **عمليات** لا عدداً: فكّ الكتم يسبق الخطوة في الطابور نفسه،
  // فيقع بالترتيب المطلوب — فكّ ثم خطوة — بلا مسار ثانٍ ولا توقيت هشّ.
  let queue = [], timer = null, lastSentAt = 0;

  // ⚠️ **قاعدة أمان لا صوت:** الهدف عنصر المشغّل أو `<video>`، و**لا
  // `document.activeElement` أبداً**. قِيس أن سهماً يصل إلى حقل مركَّز يقود قائمة
  // اقتراحات يوتيوب **فيستبدل نصّ المستخدم** («hello» ⇒ «hello hello»)، والضغطة
  // الموثوقة تفعلها كذلك — فالحارس **على الهدف لا على الاصطناع**.
  const targetFor = (video) => {
    const root = video?.getRootNode?.();
    const scope = root && typeof root.querySelector === "function" ? root : document;
    return scope.querySelector(playerSelector) || video || null;
  };

  // الإرسال مُلجَّم بالزمن **وبالسقف معاً**: واحد كل `minSendMs` على الأكثر،
  // والطابور لا يتجاوز `maxQueue` فدفقة طويلة تُهدر زائدها بدل أن تنفجر إرسالاً.
  // ⚠️ اللجام بالزمن يقيس **آخر إرسال فعلي** لا وجود مؤقّت: بلا `lastSentAt`
  // كانت كل نقرة تجد المؤقّت فارغاً فتُرسل فوراً، فلا لجام أصلاً.
  const schedule = (video) => {
    if (timer) return;
    timer = setTimeout(() => drain(video), Math.max(0, minSendMs - (nowMs() - lastSentAt)));
  };

  const KEY_CODES = { ArrowUp: 38, ArrowDown: 40, m: 77 };

  const sendKey = (el, key) => {
    const code = KEY_CODES[key] || 0;
    adapterSending = true;
    try {
      for (const type of ["keydown", "keyup"]) {
        el.dispatchEvent(new KeyboardEvent(type, {
          key, code: key, keyCode: code, which: code,
          bubbles: true, cancelable: true, composed: true
        }));
      }
    } finally {
      adapterSending = false;
    }
  };

  const drain = (video) => {
    timer = null;
    const op = queue.shift();
    if (!op) return;
    lastSentAt = nowMs();
    const el = targetFor(video);
    if (el) {
      // فكّ الكتم **مشروط عند التنفيذ لا عند الجدولة**: مفتاح المضيف قالبٌ، فلو
      // انفكّ الكتم بين اللحظتين لكان إرسالُه يُعيد الكتم — عطباً من صنعنا.
      if (op === "unmute") {
        if (video.muted) sendKey(el, unmuteKey);
      } else {
        sendKey(el, op);
      }
    }
    if (queue.length) schedule(video);
  };

  const step = (video, key) => {
    // **نطابق المضيف لا نزيد عليه**: قِيس أن يوتيوب نفسه يتجاهل اختصاره والتركيز
    // في حقل نصّ. والحارس هو `shouldIgnoreKeyBecauseTyping` القائم لا حارس ثانٍ.
    if (shouldIgnoreKeyBecauseTyping()) return false;
    if (!targetFor(video)) return false;
    // ⚠️ **عقد الصوت ع1** (`tools/volume-contract.js`): خطوة لأعلى وهو مكتوم
    // **تفكّ الكتم وتطبّق خطوة واحدة**. وسهم المضيف **لا يفكّ الكتم بنفسه** —
    // قِيس حيّاً: 90 ⇒ 95 ⇒ 100 و`muted` باقٍ. فبلا هذا السطر يتسلّق المستوى
    // صامتاً («مكتوم 100») وتُهدر الضغطة، وهو عطب #35 عائداً من باب المحوّل.
    // **وفكّ الكتم يمرّ بواجهة المضيف** (مفتاحه) لا بكتابة `video.muted`: كتابتنا
    // المباشرة يمحوها نموذجه، وهي عين ما بُني #60 ضدّه.
    if (key === upKey && video.muted && unmuteKey) {
      if (queue.length < maxQueue) queue.push("unmute");
    }
    if (queue.length < maxQueue) queue.push(key);  // الزائد يُهدر عمداً
    schedule(video);
    return true;
  };

  return { stepUp: (video) => step(video, upKey), stepDown: (video) => step(video, downKey) };
}

// ── عائلة «منزلق المضيف» (#60) — عضوها اليوم تويتش ─────────────────────────
// **قِيس على قناة حيّة قبل كتابته، ولم يُفترض أنه كيوتيوب — فخالفه:**
//   · منزلقان `input[type=range]` مداهما **0..1** (لا 0..100) بخطوة 0.01،
//     كلاهما داخل المشغّل، **أحدهما مرئي والآخر مخفي، ويتحرّكان معاً**.
//   · **الكتم عند تويتش هو المنزلق على صفر**: زرّه يضع 0 ويرفع `muted` معاً.
//   · **وضبط المنزلق وهو مكتوم يفكّ الكتم بنفسه** (0% مكتوم ⇒ 80% مسموع) —
//     **عكس يوتيوب** الذي يرفع ويبقى مكتوماً. ولذلك لا فكّ كتم صريح هنا.
//   · و`m` **من إرسالنا** تفكّ الكتم وتستعيد المستوى الكامن (0.8).
//
// ⚠️ **المحدّد بالبنية لا بالاسم:** معرّفات تويتش `player-volume-slider-<UUID>`
// وأصنافه `ScRangeInput-sc-…` بصمات styled-components **تتغيّر مع كل بناء**.
// فالبحث بـ`input[type=range]` **داخل حاوية المشغّل**، والمرئي منهما هو المستهدَف
// بقاعدة صريحة — لا «أول ما يُطابِق». `tools/test-host-adapter.js` يُفشل البناء
// إن تسلّل UUID أو بصمة صنف إلى الكود.
function makeSliderAdapter({ playerSelector, stepFraction = 0.05, unmuteKey,
                             mutesByZeroing = false, latentReadable = false }) {
  let queue = [], timer = null, lastSentAt = 0;

  // المنزلق المستهدَف: داخل المشغّل · **ليس من عناصرنا** · والمرئي يفوز.
  const sliderFor = (video) => {
    const root = video?.getRootNode?.();
    const scope = root && typeof root.querySelector === "function" ? root : document;
    const player = scope.querySelector(playerSelector);
    const all = [...(player || scope).querySelectorAll("input[type=range]")]
      .filter((el) => !isOwnElement(el));
    if (!all.length) return null;
    // قاعدة صريحة مختبَرة: **المرئي** هو المستهدَف، وإن لم يكن أيٌّ مرئياً فالأول.
    return all.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) || all[0];
  };

  // ⚠️ **لا رقم مدى محفوظ في الكود إطلاقاً — لا 100 ولا 1.** قِيس مدى تويتش
  // **0..1** بينما قراءة المالك من متصفّحه **0..100**، والتناقض لم يُحسم
  // (ملاحظة مفتوحة في `AUDIT.md`). فالمدى **يُقرأ من العنصر وقت التنفيذ**،
  // ومنزلق بلا مدى معلن **يُرفض** ولا يُفترض له مدى.
  const bounds = (el) => {
    if (el.min === "" || el.min == null || el.max === "" || el.max == null) return null;
    const min = Number(el.min), max = Number(el.max);
    if (!isFinite(min) || !isFinite(max) || max === min) return null;
    return { min, max, span: max - min };
  };

  // ⚠️ الكسر لا الرقم المطلق: مدى تويتش **0..1** لا 0..100، ورقمٌ مطلق يفترض
  // مدىً لم يُقس. قِيس فسقط شاهد موجب حين كُتب 60 على مدى 0..1 فقُصّ إلى 1.
  const readFraction = (el) => {
    const b = bounds(el);
    return b ? (Number(el.value) - b.min) / b.span : null;
  };

  const applyFraction = (el, frac) => {
    const b = bounds(el);
    if (!b) return false;
    const { min, max, span } = b;
    const target = Math.max(min, Math.min(max, min + span * frac));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!setter) return false;
    setter.call(el, String(target));
    // حقل يديره React لا يقبل `.value = x` مباشرةً — الـ native setter ثم
    // `input`/`change` هي الطريقة **المقيسة** الوحيدة التي يتبعها نموذجه.
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };

  const schedule = (video) => {
    if (timer) return;
    timer = setTimeout(() => drain(video), Math.max(0, 60 - (nowMs() - lastSentAt)));
  };

  const drain = (video) => {
    timer = null;
    const op = queue.shift();
    if (!op) return;
    lastSentAt = nowMs();
    const el = sliderFor(video);
    if (el) {
      if (op === "unmute") {
        if (video.muted && unmuteKey) {
          const player = (video.getRootNode?.() || document).querySelector?.(playerSelector) || video;
          adapterSending = true;
          try {
            for (const type of ["keydown", "keyup"]) {
              player.dispatchEvent(new KeyboardEvent(type, {
                key: unmuteKey, code: unmuteKey, keyCode: 77, which: 77,
                bubbles: true, cancelable: true, composed: true
              }));
            }
          } finally { adapterSending = false; }
        }
      } else {
        const cur = readFraction(el);
        if (cur !== null) applyFraction(el, cur + (op === "up" ? stepFraction : -stepFraction));
      }
    }
    if (queue.length) schedule(video);
  };

  const step = (video, dir) => {
    if (shouldIgnoreKeyBecauseTyping()) return false;
    if (!sliderFor(video)) return false;
    // ⚠️ **عقد الصوت ع2 على مضيف يكتم بتصفير المستوى** (قرار المالك 2026-07-31):
    // لا مستوى ظاهر يُخفَض، **فالعملية لا تُنفَّذ ولا تسقط إلى الكتابة المباشرة**.
    // السقوط ضرر لا احتياط: يكتب قيمة يمحوها المضيف فتتحرّك الشارة ولا يتغيّر
    // شيء. **والفكّ غير المطلوب مرفوض**: المستخدم قال «أخفض» لا «أسمعني».
    if (dir === "down" && video.muted && mutesByZeroing) return "skip";
    // ورفعٌ على مكتوم: **يفكّه المضيف بنفسه عند الضبط** (مقيس)، ومع ذلك نُقدّم
    // فكّاً صريحاً كي يُستعاد **المستوى الكامن** بدل أن نبني الخطوة على صفر.
    if (dir === "up" && video.muted && unmuteKey) {
      if (queue.length < 5) queue.push("unmute");
    }
    if (queue.length < 5) queue.push(dir);
    schedule(video);
    return true;
  };

  // القدرات مُعلَنة على المحوّل: العقد يقرأها، والشارة تقرأ `hidesLevelWhenMuted`.
  return {
    stepUp: (video) => step(video, "up"),
    stepDown: (video) => step(video, "down"),
    mutesByZeroing,
    hidesLevelWhenMuted: mutesByZeroing && !latentReadable
  };
}

// ⚠️ **الخطوة الفعلية خطوة المضيف لا خطوتنا:** سهم يوتيوب يحرّك منزلقه **±5%**
// بينما ربطنا الافتراضي `ACTION:VOLUME:+4` أي 4%. **هذا مقصود وموثَّق فلا يُسجَّل
// عطباً لاحقاً** — المطلوب أن **يتحرّك منزلق المضيف**، وحركته بمقدار خطوته هو.
// و**لا `toggleMute` هنا عمداً**: الكتم يبقى على مسار اليوم في هذا الكومِت،
// والإطار يسقط لكل عملية على حدة فيتولّاه المسار المباشر بلا تغيير.
// تويتش: عائلة المنزلق. `unmuteKey` مفتاحه هو — قِيس أن إرسالنا له يفكّ الكتم
// **ويستعيد المستوى الكامن**، فالخطوة تُبنى على مستوى حقيقي لا على صفر.
hostAdapters.set("twitch.tv", makeSliderAdapter({
  playerSelector: "[data-a-player-state], .video-player",
  stepFraction: 0.05,
  unmuteKey: "m",
  mutesByZeroing: true,    // قِيس: زرّ الكتم يضع المنزلق على 0 ويرفع muted معاً
  latentReadable: false    // والمستوى الكامن يختفي — لا نقرؤه من أي عنصر
}));

hostAdapters.set("youtube.com", makeKeyStepAdapter({
  playerSelector: "#movie_player",
  upKey: "ArrowUp",
  downKey: "ArrowDown",
  // مفتاح كتم يوتيوب. قِيس أنه يفكّ الكتم **حتى مُرسَلاً منّا** (غير موثوق)،
  // وأن نقر `.ytp-mute-button` يفكّه كذلك — واخترنا المفتاح لأنه من عائلة
  // المحوّل نفسها فلا يضيف محدّداً ثانياً يتعفّن مع إعادة تصميم المشغّل.
  unmuteKey: "m"
}));

// ── الجذر الأوّل في #72 — **موضع اشتقاقٍ واحد لكل أوامر `runAction`** ──────
// **المبدأ (قرار المالك): من يملك الحدث يعرف فيديوه، فلا يُعيد `runAction`
// اشتقاق ما تسلّمه.** كان **2 من 8** فروعٍ تحترم المُمرَّر، والستّة تشتقّ —
// **فيُهدَر ما حلّه المُنادي ويُعاد حسابه من المؤشّر**.
// ⛔ **والعطب المقيس:** المؤشّر فوق زرّ السرعة ⇒ علامةُ الملكية ⇒
// `BLOCKED_BY_LAYER` ⇒ `findVideoAtPoint` تُرجع `null` **عمداً** («الحدث ليس
// لمسار المربّعات») ⇒ الفرع يقرؤها «لا فيديو هنا» ⇒ `return false`.
// ⇒ ⭐ **علامة الملكية تحمي الزرّ من مسار المربّعات وتُعمي أمرَ الزرّ نفسه.**
// **جذرٌ واحد كان يُسقط 14 و15 و16 و18 معاً**، ويُبقي 13 عاملةً (المؤشّر هناك على
// الصورة لا على الزرّ). **وحارسه `tools/test-action-video.js`: فرعٌ يشتقّ بنفسه
// يُحمّر المجموعة.**
function actionVideo(e) {
  return e.__videoUnderPointer || findVideoLoose(e);
}

function runAction(action, e) {
  // Play/Pause: فقط فيديو نفسه
  if (action === "ACTION:TOGGLE_PLAY") {
    const video = actionVideo(e);
    if (!video) return false;
    togglePlay(video);
    return true;
  }

  // Seek: نقدر نستخدم loose لأن الأسهم غالبًا بدون target فيديو
  if (action.startsWith("ACTION:SEEK:")) {
    const n = Number(action.split(":")[2]);
    if (isNaN(n)) return false;
    const video = actionVideo(e);
    if (!video) return false;
    seek(video, n);
    return true;
  }

  // Fullscreen: loose (عشان Twitch overlays/iframes)
if (action === "ACTION:TOGGLE_FULLSCREEN") {
  // ✅ لو Mouse2 جهّز لنا فيديو تحت المؤشر، استخدمه
  const video = actionVideo(e);
  if (!video) return false;

  const t = nowMs();
  if (t - lastFsAt < 450) return true;
  lastFsAt = t;

  return toggleFullscreen(video);
}


  // Mute
  if (action === "ACTION:TOGGLE_MUTE") {
    const video = actionVideo(e);
    if (!video) return false;
    // الكتابة المباشرة كما هي حرفياً — والمحوّل يستدعيها نفسها عند السقوط،
    // فلا تُكتب مرتين ولا تتباعد نسختان.
    const applyDirect = () => {
      video.muted = !video.muted;
    };
    // الشارة للمسار المباشر وحده — انظر التعليق في كتلة ACTION:VOLUME أدناه.
    if (!runHostAdapter(video, "toggleMute", applyDirect)) {
      applyDirect();
      showVolumeIndicator(video);
    }
    return true;
  }

  // PiP
  if (action === "ACTION:TOGGLE_PIP") {
    const video = actionVideo(e);
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
    const video = actionVideo(e);
    if (!video) return false;
    const delta = n / 100;
    // Mute state and level are two independent facts (audit #35): mute is never
    // inferred from a zero level, and the level is never zeroed to mute.
    // Raising unmutes AND applies the increment in the SAME press — unmuting on
    // its own is what made the first press after a mute do nothing audible.
    // Lowering leaves `muted` untouched on purpose: the user asked for less
    // sound, not for sound, so a muted video stays muted and only its latent
    // level moves.
    // الكتابة المباشرة كما هي حرفياً — والمحوّل يستدعيها نفسها عند السقوط.
    const applyDirect = () => {
      if (delta > 0 && video.muted) video.muted = false;
      const next = (video.volume ?? 1) + delta;
      // ⚠️ The floor is 0.0001 and never 0, and what it guards against is the HOST
      // SITE inferring mute from a zero level — its own player watches
      // volumechange and auto-mutes. It does NOT guard against an inference of
      // ours: ours lived in this very block and went away with #35. An external
      // inference does not disappear with our fix, so this floor is not a leftover
      // from the defect — do not read it as one and delete it.
      video.volume = next <= 0 ? 0.0001 : Math.min(1, next);
    };
    // الخطوة نسبية: إشارة الدلتا وحدها تختار العملية. لا ضبط مطلق في أي مسار.
    // ⚠️ والشارة **للمسار المباشر وحده هنا**: حين يتولّى المحوّل تكون الحالة بعد
    // مهلته لا الآن، فنداؤها الآن يعرض القيمة **قبل** التغيير — وهو عَرَض #35
    // نفسه عائداً من باب جديد. مسار المحوّل ينادي الشارة بنفسه بعد تحقّقه.
    if (!runHostAdapter(video, delta > 0 ? "stepUp" : "stepDown", applyDirect)) {
      applyDirect();
      showVolumeIndicator(video);
    }
    return true;
  }

  // Speed: SET absolute value (e.g. ACTION:SPEED:SET:2)
  // ⚠️ **الترتيب حامل**: `"ACTION:SPEED:SET:2".startsWith("ACTION:SPEED:")` صادقة
  // كذلك، فلو سبقت كتلة الدلتا لالتقطت المطلق وقرأت `"SET"` عدداً ⇒ `NaN`.
  if (action.startsWith("ACTION:SPEED:SET:")) {
    const n = Number(action.split(":")[3]);
    if (isNaN(n)) return false;
    const video = actionVideo(e);
    if (!video) return false;
    return setPlaybackRate(video, n);
  }

  // Speed: delta
  if (action.startsWith("ACTION:SPEED:")) {
    const n = Number(action.split(":")[2]);
    if (isNaN(n)) return false;
    const video = actionVideo(e);
    if (!video) return false;
    return stepPlaybackRate(video, n);
  }

  return false;
}

// ── تعريف السرعة الواحد — الموضع الذي يملك الحدّين والقصّ والكتابة ───────────
// **الحدّان كانا مكتوبين مرّتين حرفياً** في كتلتَي `ACTION:SPEED` أعلاه: التعبير
// `Math.max(0.25, Math.min(4, Math.round(x * 100) / 100))` نسختين. وميزتان
// مقرَّرتان تقرآن السرعة — شارة **#71** وزرّ **#72** — **فكانت النسختان تصيران
// أربعاً لرقمين**، وهو شكل «موضعان للحقيقة الواحدة» الذي كذب في عدّ التأكيدات
// ثلاث مرّات (قرارا 34 و36). فسبق التعريفُ الميزتين بقرار المالك 2026-08-02.
//
// ⚠️ **وهذا الكومِت صفر تغيّر سلوكي، مبرهَناً لا موعوداً**: التعبير منقول حرفاً
// بحرف **بترتيبه نفسه** (تقريبٌ ثمّ قصّ — والعكس يعطي غيره عند الحدود)، و`|| 1`
// باقية كما هي فـ`playbackRate === 0` يُقرأ `1` كما كان بالضبط. والبرهان في
// `tools/test-speed-source.js`: **أوراكل يحمل التعبير القديم نصّاً** ويُقارَن به
// على مصفوفة مدخلات، فالمساواة **مقيسة لا مقروءة**.
//
// **ونداء الشارة يدخل هنا في #71 — موضعاً واحداً لا موضعين.** ولذلك **لا يكتب أي
// مسار جديد `playbackRate` بيده**، ومنه زرّ #72: يُصدر أمراً من نحو `ACTION:`
// نفسه (قرار المالك). **والحارس بنيويّ لا قائمة** (قرار 16ج): `test-speed-source`
// يعدّ مواضع الكتابة في `content.js` ويشترط **واحداً**، فمسارٌ يكتب بيده يُحمّر
// المجموعة **وإن لم يخطر لأحد أن يُدرجه في قائمة**.
const VZ_SPEED_MIN = 0.25;
const VZ_SPEED_MAX = 4;

// ── #71 — بوّابة شارة السرعة ────────────────────────────────────────────────
// الترتيب المقرَّر (#64): **المفتاح الرئيسي ← الحظر ← مفتاح الميزة**. ولا ريماب
// بينهما: الشارة **عَرْضٌ لأمرٍ وقع**، والأمر نفسه مرّ ببوّابته قبل أن يصل هنا.
function speedBadgeActive() {
  if (!extensionActive()) return false;   // #64: الرئيسي ثم الحظر
  return overlaySettings.speedBadge === true;
}

// **الموضع الوحيد الذي يكتب `playbackRate` في الإضافة كلّها.**
// ⚠️ **ونداء الشارة هنا وحده** — فيرثه زرّ #72 بلا سطر، ما دام يُصدر أمراً من
// نحو `ACTION:` ولا يكتب بيده. والنصّ **يُقرأ من العنصر بعد الكتابة لا من
// المطلوب**، فيعرض ما صار إليه فعلاً بعد القصّ (قاعدة الشارة في عقد الصوت ع4).
function setPlaybackRate(video, rate) {
  if (!video) return false;
  video.playbackRate = Math.max(VZ_SPEED_MIN, Math.min(VZ_SPEED_MAX, Math.round(rate * 100) / 100));
  if (speedBadgeActive()) showBadge(video, "speed", `${video.playbackRate}x`);
  // ⭐ #76 — والنصّ يُزامَن **من الموضع الواحد** لا من مسار الزرّ وحده. كان
  // معلَّقاً على تحوّل `idle ⇒ active`، **فحركةٌ متّصلة لا تُعيد المزامنة**
  // والنقرة تُعيدها لأنها تقع بعد أن سكن الزرّ. **والتحوّل نفسه صحيحٌ ورخيص —
  // والعطب أن النصّ عُلِّق عليه، لا أن التحسين خاطئ** (قرار المالك).
  if (speedButtonActive()) syncSpeedBtnLabel(video);
  return true;
}

// خطوة نسبية. `|| 1` منقولة عن المصدر حرفياً — لا تُبدَّل بـ`?? 1`: الفرق ليس
// أسلوبياً، فـ`playbackRate === 0` يُقرأ **1** بالأولى و**0** بالثانية.
function stepPlaybackRate(video, delta) {
  if (!video) return false;
  return setPlaybackRate(video, (video.playbackRate || 1) + delta);
}

// ── البند #58: تعريف واحد لـ«الفيديو يملأ هذا العنصر» ────────────────────────
// يشترك فيه حكم اختيار الحاوية أدناه **وبوابة قاعدة الـ CSS** — رقمان يتباعدان
// مع الوقت أسوأ من رقم واحد، فلا تُكرّر 0.95 في أي موضع آخر.
const VZ_FILL_RATIO = 0.95;
const FS_CONTAINER_MAX_DEPTH = 8;   // نفس عمق مرشّحي السكور أدناه بالضبط

function videoFillsElement(video, el) {
  const v = video?.getBoundingClientRect?.();
  const r = el?.getBoundingClientRect?.();
  if (!v || !r || r.width <= 0 || r.height <= 0) return false;
  return v.width / r.width >= VZ_FILL_RATIO && v.height / r.height >= VZ_FILL_RATIO;
}

// «يشبه مشغّلاً»: اتحاد الاستدلالين — محدّد الحاويات المعروفة أو أصناف المشغّل.
// ⚠️ التعبير النمطي مكرّر نصّاً داخل كتلة السكور أدناه **عن قصد**، لأن قرار
// المالك في #58 نصّ على أن السكور لا يُعدَّل بحرف. النسختان محروستان نصّياً في
// tools/test-container-choice.js فلا تتباعدان.
function looksLikePlayer(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.matches?.(KNOWN_PLAYER_WRAPPER_SELECTOR)) return true;
  const cls = (el.className || "").toString();
  const role = el.getAttribute?.("role") || "";
  return /player|video|controls|overlay|container/i.test(cls + " " + role);
}

// حكم قاطع يسبق السكور: **أقرب** سلف يشبه مشغّلاً ويملؤه الفيديو هو الحاوية،
// ويتوقّف المشي عنده. الأقرب يفوز لا الأعلى سكوراً — وهو «الأخصّ يفوز» نفسه
// المطبَّق في أولويات الإدخال (#48).
//
// المبرّر مقيس على d.tube: كانت حاوية تخطيط الصفحة `.md:container` تفوز على
// المشغّل الحقيقي `.dtube-player-wrapper` بفارق **0.1037 نقطة** (7.9537 مقابل
// 7.8500) — أي أن **سكوراً ناعماً بهذا القدر يحسم أي العنصرين يُكبَّر**، وهو
// هشاشة لا حكم. المعادلة الغامضة لا تُعدَّل، بل يُسبَق إليها بحكم قاطع.
//
// ⚠️ كان مكتوباً هنا أن «القرعة انقلبت فعلاً في بنية أخرى» — **سُحب هذا الشاهد**:
// الانقلاب المرصود كان أثر توقيت في منصّة القياس لا سلوكاً (`AUDIT.md` §7).
// المبرّر يصمد على الشاهد المقيس الباقي: فارق 0.1037 نقطة.
//
// `body` و`documentElement` خارج المشي: ليسا مشغّلاً في أي حال، وتكبير `<body>`
// عطب مستقل مسجَّل بالرقم #59.
function nearestPlayerAncestor(video) {
  let el = video?.parentElement;
  for (let i = 0; i < FS_CONTAINER_MAX_DEPTH && el && el !== document.body && el !== document.documentElement; i++) {
    if (looksLikePlayer(el) && videoFillsElement(video, el)) return el;
    el = el.parentElement;
  }
  return null;
}

// ── #94 · #96 — «فيديوٌ يملك أدواته»: نطاقُ المشغّل، ثمّ أدواتُه ─────────────
// 🎯 **حجّة البند بنصّ المالك (قرار 64):** **«المضيف نفسه هو من أخفى أدواته،
// فامتناعُنا موافقةٌ له لا اجتهادٌ منّا.»** ⇒ **السؤال «أأراد المضيف مشغّلاً
// هنا؟» لا «أهذي معاينة؟»** — والثاني يستدعي محدِّد موقعٍ يموت، والأوّل يُقرأ من
// الصفحة نفسها. **والحكم على الفيديو لا على الصفحة**: صفحةٌ واحدة تحمل الاثنين.
//
// ⚠️ **ولا يُستهلك حكم #58 هنا (قرار 65):** `nearestPlayerAncestor` بُني ليجد **ما
// يُكبَّر** — **أقرب** سلفٍ **يملؤه الفيديو** — **وشريطُ التحكّم يقع خارج ما يملؤه
// الفيديو بطبعه**. **ومقيسٌ على فيميو**: أعطى `div.vp-video` بـ**صفر أداة**،
// **وإحدى عشرة أداةً ومنزلقٌ على بُعد مستوىً واحد** في `div#player` بنسبة **×1**.
// ⇒ **«أين الفيديو؟» ليست «أين مشغّلُه؟»**، فلهذا السؤال نطاقُه.
//
// **النطاق: الاسم المعروف أوّلاً، وإلّا أبعدُ سلفٍ يشبه مشغّلاً ما لم تكبر مساحتُه.**
// ⭐ **والحدّ حارسٌ لا مُميِّز — وهذي الجملة تبقى بنصّها (قرار 65):**
// **×1.2 لم يقلب حكم أيٍّ من الخمسة المقيسة، وسلسلةُ المعاينة صفرٌ في مستوياتها
// الثمانية (حتى ×0.98) — فالتوسيع أُجيز بالقياس لا بالحاجة.**
// **ورقمٌ يقلب حكماً يلزمه قياسُه هو، ولا يُمرَّر في ركاب غيره.**
//
// ⚠️⭐ **وسندُه ضاق بـ#116 — والرقمُ كما هو، والسندُ يُكتب** (قرار المالك
// 2026-08-06): **الزرّان صارا يوتيوبيَّين**، **و`closest(KNOWN_PLAYER_WRAPPER…)`
// يفوز أوّلاً** ⇒ **فمسارُ النقاط (أبعدُ سلفٍ + هذا الحدّ) لا يُبلَغ أصلاً حين
// يوجد اسمٌ معروف.** **والمقيس على المضيف الحيّ 2026-08-06 — ثلاثةُ أسطح:**
// `watch` · `youtube-nocookie/embed` · **والصفحة الرئيسية** ⇒ **`#movie_player`
// في ثلاثتها، ولا واحدةَ بلغت مسارَ النقاط.**
// ⇒ ⛔ **فالحدُّ اليوم حارسٌ لحالٍ لم تُقَس واقعةً، لا حارسٌ على خمس بنيات.**
// **ولا يُحذف: حذفُه يفتح مسارَ النقاط بلا سقف، وسطحُ يوتيوب أوسعُ من ثلاثة.**
// ⛔ **وحدُّ القياس نفسِه يُقال: حالُ المعاينة الحيّة لم تُنتَج** (بطاقةٌ بمستطيل
// صفريّ في المتصفّح المقطوع الرأس) ⇒ **«لم أقس» لا «قِستُ فوجدت صفراً».**
const VZ_PLAYER_SCOPE_MAX_AREA = 1.2;

function playerScopeForVideo(video) {
  if (!video) return null;
  // الاسم المعروف يفوز أوّلاً: `#movie_player` و`#inline-preview-player` كلاهما
  // في القائمة، **فالتفريق بأدواتهما لا بأسمائهما**.
  const known = video.closest?.(KNOWN_PLAYER_WRAPPER_SELECTOR);
  if (known) return known;
  const vr = video.getBoundingClientRect();
  const vArea = Math.max(1, vr.width * vr.height);
  let el = video.parentElement, best = null;
  for (let i = 0; i < FS_CONTAINER_MAX_DEPTH && el &&
       el !== document.body && el !== document.documentElement; i++) {
    if (looksLikePlayer(el)) {
      const r = el.getBoundingClientRect();
      // **أبعدُ مطابقٍ لا أقربه** — والحدّ يمنع صعوداً إلى الصفحة.
      if (r.width > 0 && r.height > 0 && r.width * r.height <= vArea * VZ_PLAYER_SCOPE_MAX_AREA) best = el;
    }
    el = el.parentElement;
  }
  return best;
}

// «مرئيّ» **يُشتقّ من شرطه المقيس ولا يسبقه** (العمى الأوّل، `S7`): مستطيلٌ غير
// صفريّ **مع** `display` و`visibility` **وشفافيةٍ فعّالة عبر السلسلة** (قرار 48):
// ابنٌ يقرأ `opacity:1` وسلفُه `0` — فالرؤية على السلسلة لا على العنصر.
function isVisibleEl(el) {
  if (!el || el.nodeType !== 1) return false;
  const r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return false;
  let style;
  try { style = getComputedStyle(el); } catch { return false; }
  if (!style || style.display === "none" || style.visibility === "hidden") return false;
  let n = el;
  while (n && n.nodeType === 1) {
    let s;
    try { s = getComputedStyle(n); } catch { return false; }
    if (!s || Number(s.opacity) === 0) return false;
    n = n.parentElement;
  }
  return true;
}

// **العتبة `≥1` مقيسة لا مُقدَّرة:** فيميو ينزل بالسكون إلى **زرٍّ واحد** (11 ⇒ 1)،
// فعتبةٌ أعلى كانت ستقتل الزرَّ على مضيفٍ يعمل اليوم.
// ⚠️ **والمحدِّد هو المقيس نفسه حرفاً**: ما لم يُقَس لا يُضاف، ولو بدا معقولاً.
const PLAYER_CONTROL_SELECTOR =
  'button,[role="button"],a[href],[role="slider"],input[type="range"],[aria-valuenow],progress';

function scopeShowsOwnControls(scope) {
  if (!scope) return false;
  let list;
  try { list = scope.querySelectorAll(PLAYER_CONTROL_SELECTOR); } catch { return false; }
  for (const el of list) {
    // ⚠️ **زرُّنا لا يُثبت المضيف** (قرار 66 — وهو عين ما أعمى مِجَسَّنا أوّل مرّة).
    if (isOwnElement(el)) continue;
    if (isVisibleEl(el)) return true;
  }
  return false;
}

// ── التثبيت (قرار المالك) — **الحكم يُتّخذ مرّةً عند أوّل ظهورٍ للأدوات** ──────
// **مقيسٌ أن الشريط يتلاشى بالسكون**: تويتش **4 ⇒ 0** · `d.tube` **6 ⇒ 0** ·
// فيميو **11 ⇒ 1**. ⇒ **فبلا تثبيتٍ يختفي زرٌّ يعمل اليوم بعد ستّ ثوانٍ من
// السكون** — وذاك انحدارٌ يصنعه علاجُنا، أخطرُ من العطب الذي نعالجه.
// **وجوابُ «أهذا مشغّلٌ حقيقيّ؟» لا يتغيّر بحركة الفأرة، والسكون يُخفي الأدوات
// ولا يُلغي المشغّل.**
// ⚠️ **والموجب وحده يُثبَّت**: السالب يُعاد سؤالُه في كل نشاط، فشريطٌ لم يظهر بعد
// **يأخذ فرصته التالية** ولا يُحكم عليه مرّةً واحدة.
// ⚠️ **ويُبطَل عند تبديل الفيديو أو إعادة بناء المشغّل** — المفتاح عنصرُ الفيديو
// (فتبديلُه إبطالٌ بالبناء)، **والقيمة عنصرُ النطاق**: نطاقٌ جديد أو منزوعٌ من
// الشجرة يُسقط التثبيت، **وإلّا حملنا حكماً عن عنصرٍ مضى**.
const speedBtnControlsLatch = new WeakMap();   // video ⇒ scope الذي أثبت أدواته

function videoOwnsControls(video) {
  if (!video) return false;
  const scope = playerScopeForVideo(video);
  // **(ب) لا نطاق أصلاً ⇒ فيديو خام**: لا مشغّل هنا فلا أحد أخفى شيئاً — ولا
  // شريط يخصّه. **وهو المسار الذي يُبقي الفيديو الصِرف عاملاً** (منصّة §9 وصفحة
  // الرِكاز: `<video>` ابنٌ مباشر لـ`body` بلا حاوية ولا شريط).
  if (!scope) return true;
  const latched = speedBtnControlsLatch.get(video);
  if (latched && latched === scope && scope.isConnected) return true;
  // سمة `controls` أدواتُ المتصفّح نفسها — ظاهرةٌ للمستخدم وإن لم تكن في الشجرة.
  if (video.controls === true || scopeShowsOwnControls(scope)) {
    speedBtnControlsLatch.set(video, scope);
    return true;
  }
  return false;
}

// ── البند #58 كومِت ب: تمديد الفيديو داخل الحاوية التي كبّرناها نحن ──────────
// السبب الثاني في #58: الحاوية صحيحة لكن الفيديو **غير نسبيّ** داخلها (مقاس ثابت
// أو سطريّ)، فيبقى على مقاسه وسط حاوية بمقاس الشاشة. البنيات المعنية ثلاث فقط:
// ج (حاوية عادية + فيديو ثابت) · د (حاوية معروفة + فيديو ثابت) · ز (فيديو سطريّ).
//
// **بوابة قياس لا قاعدة عامة**: القاعدة لا تُطبَّق إلا إن كان الفيديو **لا يملأ
// فعلاً** العنصر الذي كبّرناه — بنفس `VZ_FILL_RATIO` لا برقم ثانٍ. فمن يعمل اليوم
// لا يُلمس: على d.tube بعد كومِت أ صارت الحاوية هي المشغّل والفيديو يملؤه، فالبوابة
// **ترفض** ولا تُضاف سمة ولا يُحقن حرف CSS. وعلى يوتيوب المسار لا يصل هنا أصلاً.
//
// **والسمة لعنصرين نحن كبّرناهما نحن**: مسار الزر الأصلي يخرج قبل التسجيل فلا سمة
// فيه إطلاقاً، ولا سمة إن كان المكبَّر هو `<video>` نفسه (لا معنى للقاعدة حينها).
const VZ_FS_ATTR = "data-vz-fs";
const VZ_FS_VIDEO_ATTR = "data-vz-fs-video";
// ── ⛔⭐⭐ #140ب — **تغييرُ تخطيط المضيف: بُني ثمّ سُحب كلُّه** (قرار المالك 2026-09-05)
// **ما كان:** الحاويةُ تصير عموداً مرناً والغلافُ الوسيط ينمو، ليملأ الفيديو الشاشة
// بعد أن صعِدنا إلى حاويةٍ تحمل أدواتِ المضيف. **وقِيس أنه يعمل** على بنيتين
// (متراكبٌ 1.00 · وفي التدفّق 0.92 بصفر سواد).
// ⛔ **وسُحب بعد تحقّق المالك على موقعين — والسببُ أثقلُ من نتيجته:**
// **يُغيّر تخطيطَ مضيفٍ لا نملكه، وأثرُه يظهر حيث يقيس المضيفُ حاويتَه بنفسه**
// (تيك توك وإنستقرام: الصورةُ تُكبَّر ~200٪ فتُقصّ). ⭐ **والقصُّ ليس من قاعدتنا —
// مقيسٌ محلياً على ثلاث نسب أن `object-fit:contain` يصمد وصفرُ تجاوز** ⇒ **بل من
// حساب المضيف بعد أن غيّرنا ما يقيسه.**
// ⇒ ⭐⭐ **وكلُّ مضيفٍ يفعل ذلك عطبٌ ننتظره ولا نعرفه، وذاك دَينٌ مفتوح** (بنصّ المالك).
// ⛔ **ولم يُبقَ منه سطرٌ «للحالة التي نفع فيها»: قاعدةٌ تُقاس بموقعين وتُخالف في
// اثنين ليست قاعدة.**
// ⇒ **والوعدُ صار أصدق: ليس «يملأ الشاشة» بل «يبلغ أكبرَ مقاسٍ بلا قصّ»** —
// **والسوادُ حول فيديو عموديٍّ صحيحٌ لا عطب** (فيديو 9:16 في شاشة 16:9 لا يملأ
// المحورين إلا بالقصّ، مقيسٌ: عرضُ الصورة 0.42 وارتفاعُها 1.00).

// العنصران اللذان طلبنا ملء الشاشة لهما. يُصفَّران في كل مخرج بلا استثناء.
let vzFsRequestedEl = null;
let vzFsRequestedVideo = null;

// تُحقن **عند أول وسم فعليّ فقط**: الموقع الذي ترفض بوابته لا يتلقّى بايت CSS.
function injectFsFillCSS() {
  if (document.getElementById("vz_fs_fill_css")) return;
  const style = document.createElement("style");
  style.id = "vz_fs_fill_css";
  style.textContent = `
    [${VZ_FS_ATTR}]:fullscreen video[${VZ_FS_VIDEO_ATTR}]{
      width:100%!important; height:100%!important;
      max-width:none!important; max-height:none!important;
      object-fit:contain!important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

// لا سمة تبقى على الـ DOM بعد الخروج. المرجعان أولاً، ثم **مسح المستند** لأي
// شاردة نجت من إعادة بناء الموقع لعنصره — لا نفترض بقاء المرجع صحيحاً.
function clearFsFillMarks() {
  vzFsRequestedEl?.removeAttribute?.(VZ_FS_ATTR);
  vzFsRequestedVideo?.removeAttribute?.(VZ_FS_VIDEO_ATTR);
  vzFsRequestedEl = null;
  vzFsRequestedVideo = null;
  for (const el of document.querySelectorAll(`[${VZ_FS_ATTR}],[${VZ_FS_VIDEO_ATTR}]`)) {
    el.removeAttribute(VZ_FS_ATTR);
    el.removeAttribute(VZ_FS_VIDEO_ATTR);
  }
}

// ── ⛔⭐⭐ #140د (ف4) — **الملءُ ليس الشرطَ الوحيد: القصُّ شرطٌ ثانٍ** ──────────
// **العطبُ (بلاغ المالك، تيك توك وإنستقرام): الصورةُ تُكبَّر فتُقصّ في ملء الشاشة.**
// ✅ **والمقيسُ في متصفّحه أوّلاً**: **`object-fit: cover`** — **ليست سطريّةً ولا
// منّا** (`inlineFit` فارغ) — **ووسمُنا غائبٌ عن الفيديو** (`marked:false`) ⇒
// **فقاعدةُ #58ب لم تُطابق شيئاً، والقصُّ من ورقة المضيف.**
// ✅ **ثمّ أُعيد إنتاجُه محلياً بحرفه**: مصدرٌ `360×640` وصندوقٌ `800×600`
// و`fit:"cover"` ⇒ **قصّ** — **و`marked:false` لأن الفيديو يملأ الحاوية تماماً.**
// ⇒ ⭐⭐ **والجذرُ في بوّابتنا لا في المضيف: سألت «أيملأ الفيديو الحاوية؟» وحدَها**،
// **والملءُ يقول شيئاً عن المقاس ولا يقول شيئاً عن النسبة** ⇒ **ففيديوٌ يملأ
// حاويةً تخالف نسبتَه يمرّ من البوّابة وهو المقصوص بعينه.**
// ⇒ **والسؤالُ الثاني: أيُقصّ؟** — **وهو سؤالُ الوعد نفسِه** («أكبرُ مقاسٍ بلا قصّ»).
// ⚠️ **ولا يُقاس القصُّ بالظنّ**: **`object-fit` المحسوبة `cover` أو `fill`**،
// **ونسبةُ الصندوق تخالف النسبةَ الطبيعية** — ⇒ **فمع `contain` لا قصّ ولو
// اختلفت النسبتان، ومع تطابقهما لا قصّ ولو كانت `cover`.**
// ⛔ **والحدُّ 0.02 حارسٌ لا مُميِّز**: **فرقُ تقريبٍ في مستطيلٍ عشريّ** — **ولا
// يقلب حكماً: النسبتان إمّا متطابقتان بالبناء أو مختلفتان بكثير** (مقيس: 0.56
// مقابل 1.33 في البنية المُعادة).
function videoWouldCrop(video) {
  if (!video) return false;
  let fit;
  try { fit = getComputedStyle(video).objectFit; } catch { return false; }
  if (fit !== "cover" && fit !== "fill") return false;
  const r = video.getBoundingClientRect();
  const nw = Number(video.videoWidth), nh = Number(video.videoHeight);
  if (!(r.width > 0 && r.height > 0 && nw > 0 && nh > 0)) return false;   // مستطيلٌ صفريّ لا يُقاس
  return Math.abs((r.width / r.height) - (nw / nh)) > 0.02;
}

function applyFsFillIfNeeded() {
  const video = vzFsRequestedVideo;
  const el = vzFsRequestedEl;
  if (!video || !el) return false;
  if (el === video) return false;                       // كبّرنا الفيديو نفسه
  if (fullscreenElementFor(video) !== el) return false; // لسنا داخل ملء شاشتنا
  // ← البوابة ترفض إن ملأ الفيديو الحاوية **ولم يكن يُقصّ** (#140د)
  if (videoFillsElement(video, el) && !videoWouldCrop(video)) return false;
  injectFsFillCSS();
  el.setAttribute(VZ_FS_ATTR, "");
  video.setAttribute(VZ_FS_VIDEO_ATTR, "");
  return true;
}

// كل مخارج ملء الشاشة تمرّ من هنا: Esc، وخروج يبدؤه الموقع، وذهاب عنصر آخر إلى
// ملء الشاشة — الثلاثة تُطلق `fullscreenchange`. و`fullscreenerror` للطلب المرفوض.
function syncFsFillMarks() {
  const video = vzFsRequestedVideo;
  const el = vzFsRequestedEl;
  if (!video || !el || fullscreenElementFor(video) !== el) { clearFsFillMarks(); return; }
  applyFsFillIfNeeded();
}

document.addEventListener("fullscreenchange", syncFsFillMarks);
document.addEventListener("fullscreenerror", clearFsFillMarks);

// ── #140 — **ما نُكبّره يجب ألّا يُخرج أدواتِ المضيف من الرسم** ───────────────
// ⛔ **العطب الذي وُلد منه (بلاغ المالك 2026-09-05، وشاهدُه السالب عنده: أطفأ
// الإضافة فعاد الشريط):** شريطُ تقدّم المضيف يبقى غيرَ مرئيّ **في ملء الشاشة
// وحدَه**، ولا يعود إلا بإطفاء الإضافة أو حجب الموقع أو الخروج منه.
//
// ⭐⭐ **والسبب أن شرطَي الحكم القاطع يتناقضان بالبناء مع بقاء الأدوات:**
// `nearestPlayerAncestor` تشترط **«يملؤه الفيديو»** (`VZ_FILL_RATIO` في المحورين)،
// **وشريطُ التحكّم يقع خارج ما يملؤه الفيديو بطبعه** ⇒ **فما تُرجعه قد لا يحوي
// أدواتِ المضيف، والمتصفّح لا يرسم إلا شجرةَ عنصر ملء الشاشة** ⇒ ⭐ **فالشريطُ
// لا يُخفى بل لا يُرسم** — **والمضيفُ يظلّ يُظهره ولا يُرى** (مقيس: عدّادُ حركته
// يزيد وشفافيتُه `1`)، **وذاك بعينه سببُ «لا يعود مهما فعل».**
// ⚠️ **والحقيقةُ كانت مقيسةً عندنا منذ #94 وقُرئت لغير سؤالها** (قرار 143 · 146):
// *«a control bar sits outside what the video fills … Measured on Vimeo»* —
// **قُرئت نهياً عن استعماله نطاقاً للزرّ، ولم يُسأل عكسُها.**
//
// ⛔⭐ **والحكم على ما يُفقد لا على ما يُوجد، والفرقُ ليس صياغة:**
//   · «أفي المرشّح ضوابط؟» ⇒ **يُطلق البوّابة على كلّ صفحةٍ بلا ضوابط أصلاً**،
//     فيدفع **تسعاً من عشر بنياتٍ قائمة** إلى السكور **بلا أن يُفقد شيء**.
//   · «أثمّة ضابطُ مضيفٍ يُخرجه اختيارُنا؟» ⇒ **لا يقع إلا حيث يقع الفقد.**
// ⇒ ✅ **مقيسٌ على البنيات العشر قبل الكتابة: صفرُ إطلاق، وصفرُ انقلابٍ في حكم أيّ
// بنية** — **ومنها `ي` (d.tube) وهي الوحيدة التي تبلغ الحكم القاطع: ضوابطُها
// الستّةُ والثلاثون داخل المختار فلا تُفقد.**
//
// ⚠️ **ولا يُشترط أن يكون الضابط مرئيّاً** — المضيفُ يُخفي شريطه بالسكون (قرار 48)،
// **وشرطُ الرؤية يجعل الحكمَ تابعاً للحظة القياس** ⇒ **الوجودُ في الشجرة هو المقيس.**
// ⚠️ **وأزرارُنا ليست أدواتِ مضيف** (#141): `isOwnElement` تُقصيها — ⛔ **لا لأن
// التلوّثَ واقعٌ هنا (مقيسٌ أنه غيرُ بالغ)، بل لأن هذا مسحُ صفحةٍ جديد، والقاعدةُ
// تسري على كلّ مسحٍ لا على مسح الصوت وحده.**
// ⚠️ **والمدى مدى الحكم القاطع نفسِه** (`FS_CONTAINER_MAX_DEPTH` من أب الفيديو):
// **مسحٌ أوسعُ من الحكم الذي يحرسه يُحمّر على ما لا يملك الحكمُ تغييره.**
// ── ⭐⭐ #140ج — **صنفٌ ثالث: مشغّلٌ ضوابطُه من المتصفّح** — **موضعُ حقيقةٍ واحد** ──
// `<video controls>`: **ضوابطُه داخل عنصره في ظلّ وكيل المستخدم** ⇒ **لا شيءَ يقع
// خارجه ليُفقد بالصعود، والفيديو نفسُه هو الهدف.**
// ⚠️ **ولا يُبنى له استدلالٌ جديد**: الشرطان هما شرطا #94 بحرفهما، **مقروءين هنا
// لسؤالٍ آخر** — «أضوابطُه من المتصفّح وحدَه؟» لا «أيملك أدواته؟».
// ⛔ **والثاني (`scopeShowsOwnControls`) شرطٌ لا زينة**: مشغّلٌ يضع `controls` على
// الفيديو **وله شريطُه الخاصّ** ليس من هذا الصنف، **وإرجاعُ الفيديو فيه يُفقد شريطَه**
// — وهو العطبُ الذي جئنا نُغلقه (#140).
function videoOwnsBrowserControls(video) {
  return !!video && video.controls === true &&
         !scopeShowsOwnControls(playerScopeForVideo(video));
}

const HOST_CONTROL_SELECTOR = "button, [role='button'], input[type='range']";

function hostControlsLostBy(video, container) {
  if (!video || !container) return false;
  // ── ⭐⭐ #140ج — **الصنفُ الثالث الذي لم يكن في تقسيمنا: مشغّلٌ ضوابطُه من
  // المتصفّح** (بلاغ المالك 2026-09-05، والموقع: شترستوك).
  // **`<video controls>`: ضوابطُه داخل عنصر الفيديو نفسِه — في ظلّ وكيل المستخدم**
  // ⇒ ⛔ **لا شيءَ يُفقد بالصعود لأن شيئاً لا يقع خارجه أصلاً**، **والفيديو نفسُه
  // هو الهدف.**
  // ⛔ **والعطبُ الذي وقع بغياب هذا الفصل:** المسحُ يجد **أزرارَ الصفحة** (Save ·
  // Try) في الأسلاف **فيقرؤها أدواتِ مضيفٍ تُفقد** ⇒ **فيصعد فوق المشغّل إلى
  // الصفحة، ويُكبَّر الفيديو ومعه بقايا الصفحة.**
  // ⇒ ⭐ **وهو «مطابقةٌ أوسعُ من سؤالها» (قرار 93): سألتُ «أثمّة أزرار؟» والمطلوب
  // «أثمّة أدواتُ مشغّلٍ؟».**
  // ✅ **ويُفصل بما هو موجودٌ عندنا سلفاً ولا يُبنى له شيء** — وهما الشرطان اللذان
  // يُجيب بهما #94 عن «أيملك هذا الفيديو أدواته؟»، مقروءين هنا لسؤالٍ آخر.
  if (videoOwnsBrowserControls(video)) return false;
  let el = video.parentElement;
  for (let i = 0; i < FS_CONTAINER_MAX_DEPTH && el &&
       el !== document.body && el !== document.documentElement; i++) {
    let found = null;
    try { found = el.querySelectorAll(HOST_CONTROL_SELECTOR); } catch { found = null; }
    for (const ctrl of found || []) {
      if (isOwnElement(ctrl)) continue;          // #141 — طبقتُنا ليست مضيفاً
      if (!container.contains(ctrl)) return true;
    }
    el = el.parentElement;
  }
  return false;
}

// ── ⭐⭐ #146 — **الموقعُ يُعلن عنصرَ ملء شاشته، فنقرأ ما كتبه ولا نحدس** ──────
// **العطبُ (بلاغ المالك 2026-09-06، xhamster): المشغّلُ في أعلى الشاشة وسوادٌ
// عريضٌ تحته.** ✅ **وقياسان في متصفّحه فصلا الأمرَ حين قوبلا** — والمتغيّرُ
// بينهما مَن دخل ملءَ الشاشة: **بزرّ الموقع** الفيديو `897×949` وسوادٌ `0·0·0·0`
// · **وبأمرِنا** `1497×562` في عنصرٍ `949` وسوادٌ أسفلَ `387`.
// ⇒ **فالجذرُ في اختيار الحاوية**: طلبناها لعنصرٍ **لا يُنسّق الموقعُ تخطيطَه
// الداخليَّ لأجله**، فبقي غلافُه الداخليُّ بمقاس الصفحة.
// ✅ **والآليّةُ مقيسةٌ محلّيّاً بمتغيّرٍ واحد**: `height:100%` **لا يَحُلّ عبر أبٍ
// بلا ارتفاعٍ محدَّد** — بلا ارتفاع `800×501` · بارتفاع 100% `800×600` ·
// بـ`display:contents` `800×600` — **والمُحدِّدُ يُطابق في الثلاث** ⇒ **العلّةُ في
// دلالة النسبة المئويّة لا في المُحدِّد.** ✅ **وسلسلةُ المالك تقولها بحرفها**:
// `…xplayer…[562·562px] ← ⇒fsEl` — **صندوقٌ واحدٌ ارتفاعُه مكتوبٌ 562.**
//
// ⭐⭐ **والمُميِّزُ ليس حدساً بل نصَّ الموقع**: `.xplayer:fullscreen{…}` في ورقته
// **تصريحٌ منه بأن هذا هو عنصرُ ملء شاشته** — ونحن نقرؤه ونسأل أيَّ أسلافِ
// الفيديو يُطابقه. **وقِيس عند المالك أن الجواب `.xplayer`**، وهو بعينه العنصرُ
// الذي يضعه زرُّ الموقع في ملء الشاشة.
//
// ⛔ **وموضعُه شرطٌ لا ترتيب: بعد كلّ حكمٍ قاطعٍ قائم وقبل السكور.** ⇒ **لا يزاحم
// حاويةً معروفةً ولا ضوابطَ متصفّح** — **فصفرُ انقلابٍ على البنيات الخمسَ عشرة
// بالبناء لا بالرجاء**، ✅ **ومقيسٌ كذلك: أطلق في اثنتين (و · ز) وفي كلتيهما
// اختار نفسَ ما تختاره الدالّةُ اليوم.**
//
// ⚠️ **وحدٌّ يُعلَن**: **أوراقُ نطاقٍ آخرَ لا تُقرأ** (`cssRules` ترمي) ⇒ **موقعٌ
// يُعلن في ورقةٍ بعيدةٍ لا نراه** — **و«لم أجد» غيرُ «لم أستطع أن أرى»**، ومِجَسُّ
// `report-fullscreen-bug.js` يطبع عددَ ما تعذّر.
const FS_DECLARED_RE = /:(?:-webkit-full-screen|-moz-full-screen|fullscreen)\b/;
// ⛔ **مُحدِّداتٌ عامّةٌ تُقصى**: `video:fullscreen` و`body:fullscreen` تصريحٌ عن
// شكلٍ لا عن هويّةِ عنصر — **وقبولُها يجعلنا نُكبّر الصفحةَ كلَّها.**
const FS_DECLARED_GENERIC = new Set(["video", "*", "html", "body", ""]);

function siteDeclaredFsSelectors() {
  const sels = [];
  const walk = (rules) => {
    for (const r of rules) {
      // ⛔⭐ **كائنٌ صادقٌ ليس قائمةً غيرَ فارغة**: كروم يُعطي كلَّ `CSSStyleRule`
      // قائمةَ `cssRules` فارغةً منذ دعمِ تداخل CSS، **وهي صادقة** — فشرطُ
      // `if (r.cssRules)` كان يغوص في لا شيء ويتخطّى المُحدِّدَ قبل قراءته،
      // **فيُخرج صفراً يشبه النجاح.** وقاعدةٌ قد تحمل الاثنين، فلا `continue`.
      const st = r.selectorText;
      if (r.cssRules && r.cssRules.length) { try { walk(r.cssRules); } catch {} }
      if (!st || !FS_DECLARED_RE.test(st)) continue;
      for (const part of st.split(",")) {
        for (const tok of part.trim().split(/\s*[>+~]\s*|\s+/)) {
          if (!FS_DECLARED_RE.test(tok)) continue;
          const clean = tok.replace(FS_DECLARED_RE, "").trim();
          if (FS_DECLARED_GENERIC.has(clean.toLowerCase())) continue;
          if (!sels.includes(clean)) sels.push(clean);
        }
      }
    }
  };
  for (const sheet of document.styleSheets) {
    // ⛔ ورقتُنا تُقصى — تحمل `[data-vz-fs]:fullscreen`، فبلا هذا نُطابق إعلانَنا
    if (sheet.ownerNode && sheet.ownerNode.id === "vz_fs_fill_css") continue;
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }   // ورقةٌ من نطاقٍ آخر
    try { walk(rules); } catch {}
  }
  return sels;
}

function siteDeclaredFsElement(video) {
  if (!video) return null;
  let sels;
  try { sels = siteDeclaredFsSelectors(); } catch { return null; }
  if (!sels.length) return null;
  let el = video.parentElement;
  for (let i = 0; i < FS_CONTAINER_MAX_DEPTH && el; i++, el = el.parentElement) {
    if (el === document.body || el === document.documentElement) break;
    for (const sel of sels) {
      try { if (el.matches(sel)) return el; } catch {}
    }
  }
  return null;
}

function pickFullscreenContainer(video) {
  if (!video) return null;

  // Prefer known site player wrappers — using the same element the site itself uses
  // keeps the site's fullscreen state in sync and lets F/dblclick/the native button
  // continue to work after we toggle fullscreen.
  const knownPlayer = video.closest(KNOWN_PLAYER_WRAPPER_SELECTOR);
  if (knownPlayer && knownPlayer.requestFullscreen) return knownPlayer;

  // ⛔⭐⭐ **#140ج — والفصلُ هنا لا داخل بوّابة #140** (بلاغ المالك 2026-09-05،
  // الموقع: شترستوك). **وأوّلُ تنفيذٍ وضعه في `hostControlsLostBy` فكان نصفَ علاج:**
  // تلك **لا تُسأل إلا إن وُجد حكمٌ قاطع** — **وشترستوك لا حكمَ قاطعَ له** (صنفُ
  // غلافِ فيديوه لا يحمل `player|video|…`) ⇒ **فيمضي إلى السكور، والسكورُ يختار ما
  // فيه أزرار فيصعد إلى الصفحة** — **والمقيسُ عند المالك: `Video formats` و`HD/SD/Web`
  // داخل عنصر ملء الشاشة.**
  // ⇒ ⭐ **وبعد الحاوية المعروفة لا قبلها**: مشغّلٌ معروف (Video.js…) يضع `controls`
  // على فيديوه **وحاويتُه هي الهدف الصحيح**، ولا يُسقطها هذا الصنف.
  if (videoOwnsBrowserControls(video)) return video;

  // #58 — الحكم القاطع قبل السكور. لم يتحقّق؟ يسقط إلى السكور القائم بلا تعديل حرف.
  // ⛔ **#140 — وشرطٌ ثالث: ألّا يُخرج اختيارُه أدواتِ المضيف من الرسم.** والسكورُ
  // هو المستأنَف لأنه **يملك حكمَه سلفاً** (`hasButtons` ثلاثُ نقاط) — ⭐ **ومقيسٌ
  // في البنية الكاسرة أنه يختار `div#player` الذي يحوي الشريط.**
  // #146 — **بعد كلّ حكمٍ قاطعٍ قائم وقبل السكور** (انظر رأسَ `siteDeclaredFsElement`).
  //
  // ⛔⭐⭐ **ولا يُنقض بـ`hostControlsLostBy` — وأوّلُ صياغةٍ نقضته فسقطت عند
  // المالك (`ف8`)، والقياسُ سمّى السبب:** الإعلانُ كان حاضراً لحظةَ الاختيار
  // (**«قبلَ الدخول: يُعلن=[.xplayer]»**) **والمرشَّحُ يُحلّه**، ومع ذلك اخترنا
  // الخارجيَّ ⇒ **فالرافضُ هو النقضُ نفسُه.**
  // ⇒ **و`hostControlsLostBy` تمسح ثمانيةَ مستوياتٍ فوق الفيديو وتعدّ كلَّ زرٍّ
  // أداةَ مضيف** — **وأزرارُ الصفحة (تحميلٌ ومشاركةٌ وتعليق) خارج المشغّل** ⇒
  // **فتقول «تُفقد» وترفض.** ⭐ **وهي رابعةُ «مطابقةٌ أوسعُ من سؤالها» في هذا
  // الملفّ** (قرار 93)، **وتعليقُ الدالّة نفسِه يقولها**: «سألتُ أثمّة أزرار؟
  // والمطلوب أثمّة أدواتُ مشغّل؟» — **و#140ج قصّ منها صنفاً واحداً وبقي الباقي.**
  //
  // ⇒ ⭐⭐ **والحجّةُ بنيويّةٌ لا تفضيل: فرعُ الحاوية المعروفة أعلاه لا يُنقض بهذا
  // الشرط إطلاقاً** — **وقائمتُنا تخمينٌ عن مواقعَ أخرى، وإعلانُ الموقع نصُّه عن
  // صفحته هذه.** ⇒ **فنقضُ الأقوى وإمرارُ الأضعف مقلوب.**
  // ✅ **والشاهدُ العمليّ من قياس المالك نفسِه**: **زرُّ الموقع يضع هذا العنصرَ
  // بعينه في ملء الشاشة، والنتيجةُ صفرُ سواد** — **فما نفعله هو ما يفعله هو.**
  //
  // ⚠️ **وحدٌّ يُعلَن ولا يُبنى له عددٌ اليوم**: موقعٌ يُعلن `:fullscreen` على
  // غلافٍ يلفّ الصفحةَ كلَّها يجعلنا نُكبّره. **والمُقصى اليومَ العامُّ وحدَه**
  // (`video`/`body`/`html`/`*`) **و`body`/`documentElement` بنيويّاً** — ⛔ **ولا
  // يُخترع حدُّ مساحةٍ قبل أن يقع عند المالك فيُسمّى موقعُه** (قرار 19).
  const declaredFs = siteDeclaredFsElement(video);
  if (declaredFs && declaredFs.requestFullscreen) return declaredFs;

  const nearest = nearestPlayerAncestor(video);
  if (nearest && nearest.requestFullscreen && !hostControlsLostBy(video, nearest)) return nearest;

  const videoRect = video.getBoundingClientRect();
  const videoArea = Math.max(1, videoRect.width * videoRect.height);

  // جرّب نلقى أقرب حاوية “تشبه مشغل” (عادة تحتوي أزرار/controls overlay)
  //
  // البند #59 — `body` و`documentElement` **مستثنيان من المرشّحين**، بنفس مبرّر
  // استثنائهما من الحكم القاطع في #58 حرفياً: **ليسا مشغّلاً في أي حال، وتكبيرهما
  // ليس صحيحاً في أي حال** (انظر `nearestPlayerAncestor` أعلاه).
  //
  // ولماذا كانا يفوزان: سكور الفيديو **ثابت عند 1.85 بالبناء** (لا أزرار فيه · لا
  // صنف يشبه مشغّلاً · `el === video` يخصم النقطة)، بينما `body` يأخذ نقطة «ليس
  // الفيديو» **وثلاث نقاط `hasButtons` من أي زر في الصفحة كلها** — فيتقدّم دائماً
  // ما لم يُرفض بحارس `areaRatio > 3.5`. والحارس يقيس **المستطيل المرسوم**، فصفحة
  // قصيرة تمرّ منه (قِيس: 1.875 → 2.8861 على خمسة مقاسات) وصفحة طويلة تُرفض
  // (قِيس: نسبة 18.5547). أي أن المميِّز كان **طول الصفحة** لا شيء يخصّ المشغّل.
  //
  // وتعادل `BODY` و`HTML` بالسكور بالضبط — مستطيلهما واحد — كان يُحسم بترتيب
  // المصفوفة لا بجدارة. **يزول التعادل بالبناء الآن، فلا حاجة إلى فاصل تعادل.**
  const candidates = [];
  let cur = video;
  for (let i = 0; i < 8 && cur; i++) {
    if (cur !== document.body && cur !== document.documentElement) candidates.push(cur);
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

  // أفضل خيار: أعلى سكور، وإلا **الفيديو نفسه** لا أبوه.
  //
  // البند #59 كومِت ب — كان `video.parentElement || video`، وأبو الفيديو في البنية
  // أ هو `body` نفسه، فكان طريق `<body>` الأخير يبقى مفتوحاً بعد استثنائه من
  // المرشّحين: الاستثناء وحده **يضيّق العطب ولا يغلقه**.
  //
  // ولا يُدخَل هذا المسار إلا وقد **رُفض كل المرشّحين أو كانت مستطيلاتهم صفرية** —
  // أي تخطيط منهار أو فيديو مخفي، ولا شريط تحكّم في مثل هذه الحالة ليُخسر.
  // و`<video>` هو الأخصّ والأضمن: تكبيره يملأ الشاشة دائماً (قِيس 100%).
  //
  // قِيس قبل التغيير أنه **خامد على كل ما قِسناه**: دخول هذا المسار **صفر** في
  // 10 بنيات محلية و7 مقاطع على مواقع حقيقية (d.tube · يوتيوب مشاهدةً ومضمَّناً ·
  // فيميو · تويتش · x.com تغريدةً وتايم-لايناً). التفصيل في `AUDIT.md` §4ج تحت #59.
  return scored[0]?.el || video;
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

const FS_BUTTON_MAX_DEPTH = 8;

function findFsButtonIn(scope) {
  for (const sel of NATIVE_FS_BUTTON_SELECTORS) {
    const btn = scope.querySelector(sel);
    if (btn) return btn;
  }
  return null;
}

// True once a scope holds a video other than ours — past that point any match
// could belong to the neighbour, so the climb has to stop.
function holdsAnotherVideo(scope, video) {
  for (const other of scope.querySelectorAll("video")) {
    if (other === video) continue;
    const rect = other.getBoundingClientRect?.();
    if (rect && rect.width > 0 && rect.height > 0) return true; // skip hidden/preloading
  }
  return false;
}

function findNativeFullscreenButton(video) {
  if (!video) return null;
  // The button must belong to THIS video's player. The old fallback searched the
  // whole document and took whichever match came first in document order, so on a
  // page with two players the command pressed the other one's button (audit #17).
  const player = video.closest(KNOWN_PLAYER_WRAPPER_SELECTOR);
  if (player) return findFsButtonIn(player);

  // Unknown player: climb from the video and take the nearest ancestor holding a
  // match. Never reaches <body>, so a sibling player's subtree is unreachable.
  let node = video.parentElement;
  for (let i = 0; i < FS_BUTTON_MAX_DEPTH && node && node !== document.body; i++) {
    if (holdsAnotherVideo(node, video)) break;
    const btn = findFsButtonIn(node);
    if (btn) return btn;
    node = node.parentElement;
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
  // #58 كومِت ب — يُسجَّل ما كبّرناه **نحن** قبل الطلب. مسار الزر الأصلي خرج
  // أعلاه ولم يصل هنا، فلا سمة فيه إطلاقاً. والبوابة تُقاس عند `fullscreenchange`.
  vzFsRequestedEl = container;
  vzFsRequestedVideo = v;
  try {
    Promise.resolve(req.call(container)).catch((err) => {
      clearFsFillMarks();
      notifyVideoActionFailed(v, "المتصفح رفض ملء الشاشة", err);
    });
  } catch (err) {
    // threw synchronously ⇒ nothing was dispatched
    clearFsFillMarks();
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




// document.activeElement stops at the shadow host, so typing inside a Web
// Component looked like "not typing" and the shortcuts fired mid-sentence
// (audit #22). Runs on keydown only — nowhere near as hot as the wheel path.
function shouldIgnoreKeyBecauseTyping() {
  let el = document.activeElement;
  for (let depth = 0; el && depth <= SHADOW_MAX_DEPTH; depth++) {
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute?.("role") === "textbox") return true;
    const inner = el.shadowRoot?.activeElement;
    if (!inner) return false;
    el = inner;
  }
  return false;
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  // Our own shard counts too, alongside the legacy blob while it still exists
  const ours = changes.settings || changes.globalSiteRules || changes.siteProfiles ||
               changes[spKeyFor(baseDomain(location.host))];
  if (ours) requestReload();
});
// البند #29: كانت هنا كتلة `chrome.tabs.query` معطّلة بالتعليق — **ميتة مرتين**:
// معطّلة، و`chrome.tabs` غير متاح في سكربت المحتوى أصلاً فلو أُزيل التعليق لرمت
// فوراً. قناة التوصيل الاحتياطية هي `chrome.storage.onChanged` أعلاه، لا هذه.









// ✅ ArrowRight/Left: نمنع الافتراضي ونطبق 5 ثواني
window.addEventListener("keydown", (e) => {
  // ⚠️ حارس عدم الارتداد (#60): هذا المستمع **يرى ما يُرسله محوّلنا** — قِيس 2 من
  // 2 — فبلا هذا السطر يصير أمر الصوت يُطلق نفسه. أول سطر عمداً: قبل أي عمل.
  if (adapterSending) return;
  updatePointerFromEvent(e);
  wakeIfVideoPresent();
  if (!extensionActive()) return;   // #64: الرئيسي ثم الحظر
  if (!remappingEnabled()) return;
  if (shouldIgnoreKeyBecauseTyping()) return;
  const hoveredVideo = getVideoFromPointerPosition();
  if (!hoveredVideo) return;

  const sig = normalizeKeyCombo(e);
  if (!sig) return;

  // 1. Zone binding is the most specific layer and wins outright — same rule the
  //    mouse path follows via zoneClickBinding. This order used to be inverted:
  //    a global rule silently shadowed a key bound to a square (audit #48).
  const bind = zoneKeyBinding(hoveredVideo, sig);
  if (bind) {
    ensureVideoOverlay(hoveredVideo);
    e.__videoUnderPointer = hoveredVideo;
    showOverlay(`Zone ${zoneLabel(bind.zone)} • ${sig} → ${bind.actions.join(" + ")}`);

    let ok = false;
    for (const action of bind.actions) ok = runAction(action, e) || ok;
    delete e.__videoUnderPointer;
    if (ok) {
      // **مفتاحٌ أصاب أمراً لنا = نشاط.** ومستخدم لوحة المفاتيح **لا يحرّك
      // فأرة**، فبلا هذا يختفي عنه ما يستعمله وهو يستعمله. وموضعه بعد `ok`
      // عمداً: **الأمر الذي وقع**، لا كل ضغطة مفتاح.
      markIdleActivity();
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  }

  // 2. Then the site profile, then the global rule — both via lookupRemap.
  const to = lookupRemap(sig);
  if (to) {
    const ok = to.startsWith("ACTION:") ? runAction(to, e) : false;
    if (ok) {
      markIdleActivity();
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);

function handleMouse(e) {
  updatePointerFromEvent(e);
  wakeIfVideoPresent();
  if (!extensionActive()) return;   // #64: الرئيسي ثم الحظر
  if (!remappingEnabled()) return;

  // A zone binding owns this button here ⇒ the generic rule stays out entirely.
  // Checked on mousedown too, which is the whole point: that is where this path
  // used to fire the general action ahead of the zone one (audit #48).
  if (zoneClickBinding(e)) return;

  // ⛔⭐ **#148 — لا اختصاراتِ فأرةٍ عامّةً في المشغّل المصغّر** (قرار المالك
  // 2026-09-06). **وموضعُه بعد المربّعات لا قبلها شرطٌ لا ترتيب**: أمرُه بنصّه
  // «امنع اختصاراتِ الماوس وأزرارَ الشريط، **واترك الشبكةَ تعمل بالعجلة**»
  // ⇒ **فطبقةُ المربّعات تمرّ، والعامُّ وحدَه يُمنع.**
  // ⭐ **ويُسأل على هدف الحدث لا على فيديوٍ مُحلول**: أرخصُ، وأدقُّ — **فالمؤشّرُ
  // فوق المصغّر هدفُه داخلَه بالبناء**، ولا يُنفَق حلُّ فيديو على كلّ حدث.
  if (isInMiniPlayer(e.target)) return;

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

    // ⭐⭐ **#145 — العلّةُ الثانية: كنّا نُلغي في الحدث الخطأ.** أمرُنا يقع على
    // `mousedown` ثمّ نُلغي افتراضيَّه — **وكروم لا يفتح تبويبَ الرابط من
    // `mousedown` بل من `auxclick`** (مقيس: إلغاءُ `mousedown` ⇒ التبويب يُفتح
    // 4⇒5 · وإلغاءُ `auxclick` ⇒ لا يُفتح 6⇒6). **و`auxclick` الموافقُ يعود من
    // مانع التكرار قبل أن يصل إلى أيّ إلغاء** ⇒ **فما كان شيءٌ يُلغيه أبداً.**
    // ⛔ **وموضعُه فوق مانع التكرار شرطٌ لا ترتيب**: تحته لا يُبلَغ.
    // ⛔ **و`preventDefault` وحدَها — بلا وقفِ انتشار**: المقيسُ أنها كافية،
    // **ووقفُ الانتشار يمنع الحدثَ عن كلّ مضيفٍ في كلّ ضغطةٍ وسطى** وذاك
    // أوسعُ من سؤاله، وهو عينُ ما نُصلحه في الأولى.
    if (e.type === "auxclick" && mouse2ConsumedPress) {
      mouse2ConsumedPress = false;
      e.preventDefault();
      return;
    }

    const t = nowMs();
    if (t - lastMouse2At < 350) return; // يمنع double-trigger
    lastMouse2At = t;

    const v = getVideoUnderPointer(e);
    if (!v) return; // خارج الفيديو = لا تسوي شي
    if (shouldLetNativeLinkHandlingRun(e, v)) return;
    e.__videoUnderPointer = v;
  }

  // Mouse3 = الزر الأيمن: نفّذ الاختصار وامنع قائمة الزر الأيمن
  if (sig === "Mouse3") {
    if (!(e.type === "mousedown" || e.type === "contextmenu")) return;

    const v = getVideoUnderPointer(e);
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
  // **الرايةُ تُرفع على الأمر الواقع لا على الضغطة**، كشكلِ `suppressContextMenuUntil`
  // فوقها بحرفه: أمرٌ فشل لا يحجب شيئاً (#33).
  // #147 — **مقيَّدٌ بالقائمة كذلك**: بلا هذا يبقى نصفُ #145 عاملاً في كلّ
  // مكان، **و«يعود كما كان» تصير وعداً لا ضمانة.**
  if (ok && sig === "Mouse2" && e.type === "mousedown" && hostAllowsLinkedVideo()) mouse2ConsumedPress = true;
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
