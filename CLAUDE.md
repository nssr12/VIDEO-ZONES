# CLAUDE.md

> ⚠️ **اقرأ `HANDOFF.md` أولاً قبل أي عمل** — فيه حالة العمل الجارية، وقرارات
> مالك المشروع النهائية، والثوابت المعمارية، والبند التالي المطلوب تنفيذه.

Guidance for AI assistants (Claude Code in particular) working on this repository.

## Project

**Video Interaction Zones** — A Manifest V3 Chrome extension that controls HTML5 `<video>` elements on any site via keyboard/mouse/wheel remapping, a 3×3 zone grid over the video, and a custom subtitle styling layer.

- Repo: https://github.com/nssr12/VIDEO-ZONES
- Default UI language: Arabic (RTL). Code/comments are mixed Arabic/English — keep both languages working when you edit.
- No build step. No npm/node dependencies at runtime. Load the folder as an unpacked extension in `chrome://extensions`.

## Install / run

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
4. Reload after every change to source files (Chrome does not hot-reload content scripts)

Syntax check before committing:
```bash
node --check content.js && node --check popup.js && node --check options.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))"
```
There is no test suite. Verify UI changes manually in the browser.

## File layout

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest, permissions, content-script declaration |
| `content.js` | Single content script injected at `document_start` in all frames. Contains: zone detection, action runner, overlay, subtitle styling, YouTube caption automation, site-profile resolver |
| `popup.html` / `popup.js` | Toolbar popup: master switch, global enable, per-site rules, blocked-site toggle, page status, manual injection, overlay duration slider, Sound Booster slider, subtitles toggle, **YouTube control-bar mode (#107 — the ONLY place it lives; no mirror on the options page)** |
| `options.html` / `options.js` / `options.css` | Full settings page: zone editor, grid appearance, volume indicator, overlay timing, subtitles, blocked sites, backup/restore, settings guide |
| `settings-ui.js` | **#77** — سجلّات صفحة الإعدادات ومُولِّدها: المجموعات الخمس · 38 وسم Clean Player · 8 ضوابط توقيت. **يُشحن**، و`options.html` تستهلكه و`tools/preview-77.html` غلافٌ فوقه. لا يلمس `chrome.*` ولا التخزين |
| `storage.js` | Shared by popup/options/background: sync quota guards (`safeSyncSet`), schema migration (`migrateAll`), and the verbatim-paired blocks with `content.js`. Classic script, **not** an ES module |
| `background.js` | Service worker. **Migration only** — one `chrome.runtime.onInstalled` listener, nothing else (owner decision) |
| `yt_quality_main.js` | Runs in the page MAIN world to drive the YouTube player quality API, which the isolated world cannot reach |
| `icons/` | Extension icons (16/32/48/128) referenced by `manifest.icons` + `action.default_icon` |
| `tools/` | Dev-only scripts run with `node`, **never shipped** — see Packaging below |
| `README.md` | User-facing Arabic readme |
| `HANDOFF.md` | **Read first.** Current work state, the eleven every-session decisions, and the work protocol — **every line of it is read every session** (#81) |
| `docs/DECISIONS.md` | Owner decisions consulted per item + decision 26's twenty witnesses |
| `docs/PLATFORMS.md` | The ten manual regression platforms (was §8–§16) |
| `docs/HISTORY.md` | Waves, closed items and their commits — **not** where you look to know where you stand |
| `docs/REFERENCE.md` | Architecture invariants, structure/tests, measured numbers, git config |
| `tools/icons.js` | **Icon registry — the one place.** Owner-designed SVGs (19), uniform style (24-box, stroke currentColor, weight 1.7). `tools/preview-icons.html` is generated from it; `tools/icons.html` is the owner original, kept as the source of record. **Only `VZ_ICONS_SHIPPED` reaches `content.js`** — shipped weight with no user is dead code, and `tools/test-icons.js` reddens on it |
| `tools/CHECKLIST.md` | The **current field-verification session's steps**, walkable — setup + numbered anchors, nothing else. Steps live here and nowhere else; `docs/HISTORY.md` (§17 سابقاً) keeps only the reasoning and open questions, and `tools/test-checklist-place.js` reddens if a numbered step reappears there (decision 41) |
| `AUDIT.md` | Audit report — every numbered item and its status |

## Packaging

There is no build step, so the publish zip is assembled by hand. Exclude these —
they are development artefacts and must not reach the Chrome Web Store package:

```
tools/        # e.g. tools/make-icons.js — regenerates icons/*.png, needs only node's zlib
AUDIT.md      # audit report
tools/preview-77.html   # غلاف معاينة فوق settings-ui.js المشحون — ليس منتجاً
AUDIT.html    # rendered audit view (already gitignored)
HANDOFF.md    # work-state handoff
docs/         # DECISIONS · PLATFORMS · HISTORY · REFERENCE — مراجع عمل لا منتج
.git/ .gitignore CLAUDE.md
```

Regenerate the icons after editing the generator: `node tools/make-icons.js icons`
(output is deterministic — identical bytes for identical input).

## Tests

⛔ ~~**Pure `node`, no dependencies, never shipped.**~~ — **the "no dependencies"
half is REVOKED, deliberately, 2026-08-04 (owner decision).** Struck, not
rewritten: rewording it ("the suite has no dependencies, the linters sit outside
it") would keep the letter and drop the intent. **Its author's intent is plain:
*our checking needs nothing installed.* If a checker enters the gate, then our
checking does need an install — whatever file we happen to put it in.** That is
the same move we spent this whole session refusing in labels: **editing the
wording to survive breaking it.** We do not do it to an invariant just because
the invariant is ours.

**What it bought, and what it cost:**

| | |
|---|---|
| **The cost of keeping it** | We were rebuilding a scope analyser out of text matching. `tools/test-name-resolves.js` shipped with **six defects on the day it was born** — file-local instead of call-site scope (19 sound names reported as broken) · `strip` swallowing template lines · no regex-literal handling (`/(^\|\.)youtube(-nocookie)?\.com$/` read as a call to `youtube`) · an unscoped globals list that let `chrome` pass **in a Node file** · a 20-line header window that misclassified in both directions · and `test-*.js` classified by prose instead of by how it is run. **Every one of them is text matching.** |
| **What the standard check gives** | `no-undef` on the same tree: **78 findings, 78, 78 — identical across three runs — in under a second.** It catches **all three** of our slices except one, including **13 live `chrome` defects our guards scored zero on.** |
| **What stays ours** | `tools/test-vm-scope.js` — `const` inside a `vm` script not becoming a context property is a **runtime semantic**, not scope analysis. Measured: `no-undef` reports **zero** on it. |

⇒ ⭐ **The general lesson, which outlives this decision: before building a tool,
ask whether the problem is a general one with a proven solution. What is specific
to this project is what we build; what is general we borrow.** We spent sessions
on three guards that returned zero on a class a decade-old tool returns thirteen
on in 0.8 seconds.

**Two properties preserved by condition, and they are not optional:**
1. **`node tools/run-tests.js` stays dependency-free.** A bare clone runs the
   whole suite with no install. **The lost property is confined to the gate, not
   the suite.**
2. **A missing dependency announces itself.** Anyone running the gate without
   installing sees one line telling them to install — **not an obscure failure**.
   A new session on a bare clone hits this first, and **an obscure failure inside
   the commit gate reads as a defect in the product.**

**Run the whole suite before every
commit, not after** — a commit that precedes verification makes the revert point
a lie.

```bash
node tools/run-tests.js            # one line per file + the total
node tools/run-tests.js --quiet    # the total only
node tools/run-tests.js --list     # what each file guards (derived from its first line)
```

`run-tests.js` is the **single source** for the assertion count and the file
list — never hand-write either number anywhere. It exits non-zero on a failure
**and on any file whose output it cannot parse**: a runner that counts what it
understands and silently skips the rest prints a total smaller than the truth and
still looks green.

⚠️ **`node tools/bench-options-page.mjs` is a release gate, not an optimisation** (#77): the
unit suite and 43 structural checks were all green while the settings page was **dead** —
`node --check` passes an undefined *reference*. It asserts **zero console errors on load**,
that **section navigation works**, and that **one control actually responds**. Run it after any
change to `options.*` or `settings-ui.js`. `--witness` proves it sees: it breaks the page
deliberately once, confirms red, and restores the file.

`tools/bench-*.mjs` and `repro-*.mjs` need a real Chrome and load the extension
through `tools/ext-harness.mjs` (`Extensions.loadUnpacked` over CDP —
`--load-extension` was measured to silently load nothing on Chrome 150). Every
expected failure in those is listed in `tools/KNOWN-DEFECTS.md`; anything not
listed there is a regression you introduced.

## Manual regression platforms

There is no browser automation for the UI paths, so a handful of pages and
step-lists in `docs/PLATFORMS.md` are **mandatory, not optional** — each item runs
the platform it touches, in full (the §-numbers below are that file's sections):

| Platform | Runs when you touch |
|---|---|
| §8 — popup truth (9 steps) | `GVZ_STATUS`, `blockedHosts`, `findVideoFrameId` |
| §9 — Shadow DOM (`vz-test-player`, local canvas stream) | video discovery, overlay, top layer |
| §10 + `tools/manual-59-body.html` | fullscreen, container choice, the fill gate |
| §10ب | `seek()` or the `seekable` window |
| §10ج | `activateOnCurrentPage` or page-world injection |
| §10د | `extensionActive()`, `remappingEnabled()`, any feature entry point |
| `tools/manual-35-volume.html` | volume or mute |

`manual-35-volume.html` is **neutral by design** — no host player, no host volume
model — so it proves our own logic and says **nothing** about host behaviour.
`manual-59-body.html` is a video that is a direct child of `<body>` on a short
page with a single button: the exact shape that used to make `<body>` win the
fullscreen container score (#59). Both are permanent fixtures, not scratch files.

Before reporting any fullscreen bug, paste `tools/report-fullscreen-bug.js` into
the page console — it prints one copyable line with the URL, the chosen
container, both rects, the ratio and the gate verdict.

`tools/report-preview-scope.js` is the second paste-in probe (#94): it arms
itself, waits for a **live** hover preview (measured by `currentTime` advancing,
not by `paused`), then prints one line answering **are the host's controls inside
this video's player scope or around it** — decided by `contains`, never by eye.
It carries decision 26's two witnesses **in the printed line**: it plants a
visible button inside the scope (the inside count must rise) and another outside
it over the video (the inside count must not) — a zero from it is only credible
when both are ✅. Its copies of `KNOWN_PLAYER_WRAPPER_SELECTOR` and #58's
constants are guarded by `tools/test-preview-probe-sync.js`.

## Storage schema (`chrome.storage.sync`)

```js
// 1) Global remap (key/mouse → action)
globalSiteRules = {
  enabled: boolean,
  mappings: [{ from: "ArrowRight"|"Mouse2"|"Ctrl+K", to: "ACTION:..." }]
}

// 2) Per-site profile overrides — ONE KEY PER DOMAIN (sharded)
"sp:youtube.com" = { enabled: boolean, mappings: [{from, to}] }
"sp:twitch.tv"   = { ... }
// The legacy single `siteProfiles` blob is migrated to shards by migrateSiteProfiles()
// and then removed. A shard that already exists with different content is NEVER
// overwritten — it is reported as a conflict and the legacy entry is kept.
// Resolution order at runtime: siteMap[sig] || globalMap[sig]

// 3) Everything else
settings = {
  enabled: boolean,                    // MASTER SWITCH — absent/true = on. Gates EVERYTHING
  zones: {
    enabled, fullscreenOnly,
    gridCoverage: "player" | "video",  // "player" (default) = zones/grid span the whole player frame incl. black bars
    wheel: {
      actions: { "1": [{id, type, key, unit?, value?}], ..., "9": [...] },  // editable source of truth
      map:     { "1": { up:[...], down:[...] }, ... }                       // wheel-runtime projection
    },
    click: { map: { "1": { left:[...], right:[...], middle:[...] }, ... } }, // click-runtime projection
    key:   { map: { "1": { "Space":[...], "ArrowUp":[...] }, ... } }        // keyboard-runtime projection
  },
  // #70 · #72 — shared idle delay. Clamped to IDLE_MIN_MS; 0 = default, NOT off
  // (only a feature's own switch turns it off — witness 24).
  idle: { ms },
  overlay: {
    autoHideMs, volumeAutoHideMs, enabled,
    hintEnabled,                       // default true  (#63) — `!== false`
    speedBadge,                        // default FALSE (#71) — `!!x`, opt-in feature
    // #107 — YouTube control bar: ONE tri-state, not two switches. "off" (default,
    // absent = off) | "idle" (hide on idle, any activity brings it back) | "near"
    // (always hidden, ONLY pointer proximity brings it back — the near region is
    // the target rect padded by IDLE_NEAR_PAD_PX, clamped to the player rect).
    // Read through progressBarModeOf() — a PAIRED block in storage.js + content.js.
    // It tolerates the legacy boolean `hideProgressBar` at READ time; migrateAll()
    // seeds the new key (true ⇒ "idle") and deletes the old one. NEVER read the
    // legacy key with `!!`: `!!"off"` is true, which is why this is a NEW key
    // rather than a retyped one — an older version on another synced device would
    // otherwise turn the feature ON for someone who had it off.
    progressBarMode
  },
  blockedHosts: ["youtube.com", ...],
  soundDisplay: { color, fontSize },
  gridAppearance: { cellBg, cellBorder, numberColor, radius },
  subtitles: {
    enabled, defaultLang, fontSize, color, bgColor, bgOpacity, fontFamily, position,
    hideOnPreviews                     // default true (#51): absence means HIDE, not show
  },
  ytAutoQuality: "" | "hd1080" | ...,   // YouTube default quality ("" = auto)
  ytShortsRedirect: boolean,            // default true: rewrite /shorts/<id> → /watch?v=<id>
  cleanPlayer: {
    enabled: boolean,
    items: { <key>: true, ... }         // only CHECKED keys are stored (sync-quota friendly); keys from
  }                                     // CLEAN_PLAYER_OPTIONS (options.js) = CLEAN_PLAYER_ITEMS (content.js)
}
```

Zone numbering: 1=A1 top-left → 9=C3 bottom-right (row-major). Labels are surfaced via `ZONE_LABELS` (`["A1","A2","A3","B1","B2","B3","C1","C2","C3"]`).

**Single source of truth for zones** is `settings.zones.wheel.actions[zone]` (an array of `{key, type, value, unit}`). `wheel.map`, `click.map`, `key.map` are derived runtime indexes built by `rebuildWheelMap()` in `options.js` whenever settings are saved. `content.js` reads only the runtime maps. **Direct edits to runtime maps that bypass `rebuildWheelMap` will silently not take effect** on the next save.

## Action grammar

Runtime action strings, all consumed by `runAction()` in `content.js`:

- `ACTION:TOGGLE_PLAY` / `TOGGLE_FULLSCREEN` / `TOGGLE_MUTE` / `TOGGLE_PIP`
- `ACTION:SEEK:<±seconds>` (e.g. `+5`, `-0.5`)
- `ACTION:VOLUME:<±percent>` (mapped internally to `/100` delta; auto-unmutes on positive delta; clamps lower bound to `0.0001` to prevent host-site auto-mute)
- `ACTION:SPEED:<±delta>` (clamped 0.25–4)
- `ACTION:SPEED:SET:<n>` (absolute playback rate)

**Editor `type` ↔ runtime mapping** (in `options.js` `actionToRuntime` / `parseRuntimeAction`):
- `toggle_play/fullscreen/mute/pip` → `ACTION:TOGGLE_*`
- `seek` (with unit=second/frame) → `ACTION:SEEK:<n>` (frame divided by 30)
- `volume` → `ACTION:VOLUME:<n>`
- `speed` → `ACTION:SPEED:<n>`
- `speed_set` → `ACTION:SPEED:SET:<n>`

When adding a new action you MUST touch:
1. `runAction()` in `content.js`
2. `actionToRuntime` + `parseRuntimeAction` + `actionSummary` in `options.js`
3. `ACTION_CHOICES` in `options.js` (so it appears in the zone editor dropdown)
4. `ACTIONS` in `popup.js` (so it appears in the popup preset list)
5. The Settings Guide section in `options.html`

## Message channel

`chrome.runtime.onMessage` in `content.js` handles:

| Type | Sender | Effect |
|------|--------|--------|
| `GVZ_STATUS` | popup | Returns **only what the frame alone can know**: `{ok, hasVideo, hasVideoUnderPointer, ytQualityGap}`. A frame that exited early (#13b) answers `{ok:false, reason:"not-started"}` and **never wakes for a message**. Whether the extension is enabled and whether the host is blocked are facts the *popup* owns — storage and the tab URL (#56) |
| `SITE_RULES_UPDATED` | popup | Hot-applies new `globalSiteRules` without storage read |
| `RELOAD_SITE_RULES` | popup | Re-reads `globalSiteRules` from storage |
| `RELOAD_SITE_PROFILE` | popup | Re-reads the `sp:<currentHost>` shard |
| `GVZ_RELOAD` / `RELOAD_ZONE_SETTINGS` | options | Re-reads `settings.zones`, `blockedHosts`, `soundDisplay` |
| `RELOAD_OVERLAY_SETTINGS` | popup/options | Re-reads `settings.overlay` |
| `RELOAD_SUBTITLES` | options | Re-reads `settings.subtitles` and re-applies styles + language |
| `RELOAD_YT_QUALITY` | options | Re-reads `settings.ytAutoQuality` and re-triggers the quality setter |
| `RELOAD_YT_SHORTS` | options | Re-reads `settings.ytShortsRedirect` and redirects if currently on a /shorts/ URL |
| `RELOAD_CLEAN_PLAYER` | options | Re-reads `settings.cleanPlayer` and re-injects the hide-elements CSS |
| `GVZ_ACTIVATED` | popup | Sent after manual activation. Re-runs `applyYtQualityStep()` — the *same* definition the startup step consumes. Needed because a page that already has `content.js` ignores re-injection (`__GVZ_CONTENT_LOADED__`), so nothing would re-trigger the quality request. **Not** a `RELOAD_*`: those go through `flushReload`, which returns early when the settings snapshot is unchanged — and in a wake nothing has changed by definition (audit #38ج) |
| `SET_VOLUME_BOOST` | popup | Applies the Sound Booster gain (clamped 100–600) to every video in the frame and **answers with the result**, so the popup can explain a silent no-op instead of moving a slider that does nothing |
| `GET_VOLUME_BOOST` | popup | Returns `{pct, reason}` — `reason: "silent"` outranks any earlier failure because it means audio is gone |

`chrome.storage.onChanged` is a backup trigger that re-loads the relevant slice when `settings` / `globalSiteRules` / `sp:*` changes from any source.

**Every message the popup sends resolves a frame first.** There is no
`sendMessage` without a `frameId` on any path (audit #24): a broadcast makes every
frame build its own `AudioContext` and lets a random frame answer
`GET_VOLUME_BOOST`. `findVideoFrameId` is the single resolver for both the status
path and the booster path; with no frame resolved the send is refused and the
slider is **disabled with a reason** rather than moving with no effect.

## Architecture notes

### Overlay positioning (the YouTube fix)

The overlay (3×3 grid + hint text + volume badge) is **not** attached to `video.parentElement`. YouTube nests the video inside `.html5-video-container` with sibling chrome layers (`.ytp-chrome-bottom`, etc.) inside `#movie_player`. Because those siblings live in separate stacking contexts, even `z-index: 999999` on the overlay loses.

Current strategy (`content.js`):
- Overlay is appended to `document.fullscreenElement || document.body`.
- `position: fixed` with `top/left/width/height` continuously matched to `video.getBoundingClientRect()` via a `requestAnimationFrame` loop while any sub-element is visible.
- `z-index: 2147483647`.
- `fullscreenchange` listener moves the overlay between `document.body` and the fullscreen element so it survives fullscreen toggles.

When editing overlay rendering, do **not** revert to attaching inside the player wrapper unless you re-test on YouTube.

### Overlay channels — one registry, counted not enumerated (#71)

The overlay has four sub-elements: `.vzGrid`, `.vzHint`, `.vzVolume`, `.vzSpeed`.
`OVERLAY_PARTS` in `content.js` is the **single place they are listed** — it maps
a channel key to a *getter* (not a reference: elements are rebuilt in
`ensureVideoOverlay`, so a frozen reference points at a dead node).
`anySubElementVisible()` and `hideOverlayNow()` both iterate it, and `showBadge()`
addresses it. **A fifth channel is added there and nowhere else** — the previous
hand-written three-line enumeration meant a new channel could show up without the
rAF tracking loop following it.

`showBadge(video, channel, text)` is the one shower: it owns the duration, the
overlay build, the write, and **a timer per channel**. `showVolumeIndicator` is
its first caller, not a copy — it computes text and nothing else. **The speed
badge is called from `setPlaybackRate` alone**, so any new path that emits an
`ACTION:SPEED*` string inherits it for free (that is how the planned #72 button
gets it with no extra line).

Both badges share `soundDisplay` (colour/size) and `volumeAutoHideMs` (duration)
deliberately — no second keys. Consequence: `volumeAutoHideMs = 0` disables
**both**, so the options checkbox is **disabled with a written reason** at 0
rather than being pressable with no effect (#24's rule). The naming debt this
creates (`soundDisplay` is now narrower than its scope) is registered as **#75**;
renaming is a data migration, not a text edit.

### The speed button draws only on a video that owns its controls (#94 · #96)

The zones **react** — they appear only where the user acts, so covering every
video costs nobody anything. The speed button **draws unbidden**, so its reach
imposes itself: an initiating feature needs a *positive* reason for every place
it appears (owner decision 63). That reason is **the host's own controls**:

```js
playerScopeForVideo(video)   // known wrapper first, else the OUTERMOST ancestor
                             // that looksLikePlayer within 1.2× the video area
scopeShowsOwnControls(scope) // ≥1 visible control inside THAT scope
videoOwnsControls(video)     // scope with controls, or video.controls, or NO scope at all
```

Three cases, measured on live players: **a player that shows its controls** ⇒
draw · **a raw `<video>` with no player scope** ⇒ draw (nobody hid anything) ·
**a scope that exists and shows nothing** ⇒ **abstain** — that is YouTube's hover
preview (`#inline-preview-player`, which literally carries `ytp-hide-controls`).
The argument, verbatim: **the host itself hid its controls, so abstaining agrees
with it rather than second-guessing it.**

Four things that are load-bearing, each measured before it was written:

- **Do NOT reuse `nearestPlayerAncestor` (#58) as the scope.** It was built to
  find *what to fullscreen* — the nearest ancestor the video **fills** — and a
  control bar sits outside what the video fills. Measured on Vimeo: it returns
  `div.vp-video` with **zero** controls while **11 buttons + a slider** sit one
  level up in `div#player` at the *same* area. "Where is the video?" is not
  "where is its player?" (owner decision 65).
- **1.2× is a guard, not a discriminator**: it flipped none of the five measured
  structures, and the preview's ancestor chain is zero controls at all eight
  levels. A number that *would* flip a verdict needs its own measurement.
- **The verdict latches on first success**, because host bars fade on idle —
  measured: Twitch 4 ⇒ 0, d.tube 6 ⇒ 0, Vimeo 11 ⇒ 1 after six idle seconds.
  Only the *positive* latches (a bar that has not appeared yet gets another
  chance), and it is invalidated when the video changes or the player is rebuilt.
- **Abstaining hides, it does not `return`** — the pointer moves from a real
  player to a preview without any idle in between.

**#96 lives in the same treatment**: `speedBtnHostSlot(video)` asks for
`.ytp-right-controls` **inside the video's own scope**, never
`document.querySelector`. The document-wide query matched a `0×0` bar inside an
unrelated `#movie_player` on a previews grid — only the zero-rect guard stopped
us injecting into a foreign player. That guard stays (it has its own reason), but
the bug is now impossible by construction, not guarded.
`tools/test-speed-scope.js` is behavioural, not textual, and also guards the
**call site** — deleting the gate reddens it.

### Idle engine — emits state, never a command (#70 · #72)

`IDLE_CONSUMERS` in `content.js` is the registry; the engine only ever says
**idle / active**. The policy is each consumer's, and that is an architectural
boundary, not tidiness: **#70 hides the host's progress bar** so it must respect
the host's intent, while **#72 hides our own button** so the call is ours. One
engine that imposes a single policy forces one of them into the other's
behaviour. Consumer contract: `enabled()` · optional `suspended()` ·
`onActive()` · `onIdle()`. **A suspended consumer is presented as active** —
suspension means something wants to be visible now, so leaving it "hidden" would
keep the very hiding we suspended.

Shape: one timestamp (`idleLastActivityAt`) and **one self-correcting timer** —
no `clearTimeout`+`setTimeout` per mousemove, and deliberately **no rAF** (the
overlay's tracking loop stops when nothing is visible; a permanent loop would
throw that away). With no consumer enabled the hot path reads a single boolean:
zero timers, zero DOM reads, zero allocation.

**Three traps, all measured into the design before they could happen:**
1. **A `mousemove` with no actual movement is not activity.** Chrome fires
   `mousemove` with a stationary cursor when the page scrolls underneath, so
   counting it means the timer *never* completes while a page scrolls — the
   difference between a feature that works and one that looks broken. Movement is
   compared against `lastPointer` **before** it is overwritten.
2. **Media events are never activity** — `timeupdate` alone fires ~4×/s and
   would cancel every timer. The rule, verbatim: **"activity is measured at the
   input, not at its effect."**
3. **The initial state is idle, not active** — a page nobody hovered shows
   nothing and starts no timer the user did not start.

Activity sources: real pointer movement inside the player rect (throttled to
10 containment checks/s), any trusted mouse button/wheel event over the player
(they all already flow through `updatePointerFromEvent`), a key that actually hit
one of our actions, and `fullscreenchange`. `settings.idle.ms` is shared by both
consumers, clamped to `IDLE_MIN_MS` — **`0` never means "off"; only a feature's
own switch turns it off** (witness 24: inheriting a key inherits every edge
meaning of that key, including ones nobody intended).

### Video targeting

- `lastPointer` is updated on every `mousemove` (capture phase, window-level).
- `findVideoAtPoint(x, y)` uses `elementsFromPoint`, then for each element checks `tagName === "VIDEO"`, `.closest("video")`, and descendant `<video>` whose rect contains the point. This handles transparent overlay layers (e.g. Twitch player UI on top of the video).
- `findVideoLoose(e)` is the fallback for non-positional events (keyboard arrows): re-uses `lastPointer`.
- `pickFullscreenContainer(video)` scores ancestors by class/role/buttons/area-ratio to pick the right wrapper for `requestFullscreen` (avoids fullscreen-ing only the bare `<video>` and losing site controls).

### Zone resolution

`getZoneNumber(rect, x, y)` divides a rect into a 3×3 grid and returns 1..9. Only **wheel** is zone-aware by default at the source level — click and key handlers also call `getZoneAtEvent(e)` to look up the same `{video, zone}` pair before checking the click/key runtime maps.

**The rect is `zoneRectForVideo(video)`, not the raw video rect.** With `zones.gridCoverage === "player"` (default) it returns the rect of the nearest known player wrapper (`KNOWN_PLAYER_WRAPPER_SELECTOR`: `#movie_player`, Twitch, JW, Video.js, Plyr…), falling back to the video rect when no wrapper matches. This matters on YouTube, which sizes `<video>` to the content aspect ratio — the letterbox black bars live *outside* the video element, so zones/overlay based on the video rect ignore them. `findVideoAtPoint` also uses `zoneRectForVideo` for its descendant-containment check so pointing at a black bar still resolves the video (hidden/0×0 videos are skipped so they can't win via a shared wrapper). With `gridCoverage === "video"` everything behaves as before (video element rect only).

Guards in `zoneRectForVideo`: wrapper lookups (including negative results) are cached in `zoneContainerCache` (WeakMap, revalidated when the video is re-parented or the wrapper leaves the DOM) because the overlay rAF loop calls it every frame; and a wrapper whose area exceeds `ZONE_WRAPPER_MAX_AREA_RATIO` (7×) of the video area is rejected as a page-level container — generic classes like `.video-player` exist on non-player wrappers in the wild. 7× still allows the worst realistic letterbox (9:16 video fullscreen on a 32:9 monitor ≈ 6.3×).

### YouTube Shorts redirect

`ytShortsRedirect` (default true): `maybeRedirectShorts()` rewrites `/shorts/<id>` → `/watch?v=<id>` via `location.replace` (keeps Shorts URLs out of history), preserving the original query string (`?list=`, `?t=`…). Runs at `document_start` for direct loads and on `yt-navigate-start`/`yt-navigate-finish` for SPA navigation. Top frame only, YouTube hosts only, respects `blockedHosts`. `loadYtShortsRedirectSetting` refreshes `blockedHosts` from its own storage read so the blocked check can't race the separate `loadBlockedHosts()` at document_start.

### Clean Player (YouTube element filter)

CSS-only, same pattern as subtitles: one injected `<style id="vz_clean_player_css">` with `html`-prefixed selectors + `display:none !important`. The item registry is `CLEAN_PLAYER_ITEMS` in `content.js` (key → selector list); the options-page list is generated from `CLEAN_PLAYER_OPTIONS` in `options.js` — **keys must stay in sync between the two, and `tools/test-clean-player-keys.js` enforces it** (a key in `content.js` alone is a feature the user cannot switch on; a key in `options.js` alone is a checkbox that promises what nothing implements — that was #66). The CSS is injected on `youtube.com` and `youtube-nocookie.com`, respects `blockedHosts`. Gated by `cleanPlayer.enabled` + per-item flags in `cleanPlayer.items` (only checked keys stored). Selectors were verified against the live 2026 player and open-source hide lists (ImprovedTube, yt-neuter, Control Panel for YouTube) — includes both classic and 2025 "Delhi" player variants.

**Every selector here targets the `ytp-*` player, i.e. the watch page. On the 2026 embedded player it hides nothing** — audit #68, measured 2026-08-02 with `tools/bench-clean-player.mjs`:
See **Four features that are dead in the embed** below — Clean Player is one of four, not a special case. the `player_embed.vflset` build carries **10 `ytp-*` elements, all `ytp-unmute*`, against 63 `ytm*`/`ytw*` ones**, identically on `youtube.com` and `youtube-nocookie.com`, playing and paused, across three parameter combinations. The CSS is still injected inside the iframe; it simply matches nothing. **Covering the embed is a new feature, not a fix** (#68ب): it needs its own measured sweep of the `ytm/ytw` family with an over-match check, because that family is also used outside the player.

### Four features that are dead in the YouTube embed — and the labels say so (2026-08-04)

Measured with `tools/bench-s10-embed.mjs` on **both** `youtube-nocookie.com/embed`
and `youtube.com/embed`, inside the frame, with the extension proven live there
(isolated world + non-zero video rect):

| Feature | What was measured in the embed |
|---|---|
| **Subtitle styling** | our `<style>` **is** injected, and matches **zero** caption elements |
| **Caption-language automation** | `.ytp-subtitles-button` and `.ytp-settings-button` — **both zero**; the flow clicks buttons that are not there |
| **Clean Player** | sheet injected, `.ytp-title` and `.ytp-large-play-button` **zero** (#68) |
| **Default quality** | `videoHeight` **480 ⇒ 480 across 60s** while the player's own list offers `hd720` and reports `large` |

**Two independent causes, and both had to be measured separately** (owner decision,
2026-08-04): on `youtube-nocookie.com` the gate `isYouTubeHost()` returns false
**and** `yt_quality_main.js` is absent from the frame (`__vzQB` false — the manifest
matches `*://*.youtube.com/*` with no `all_frames`). On `youtube.com/embed` the gate
**passes** and quality still does not move — which is what proves the second cause
stands alone. **A case where two causes coincide is not measured alone; find a case
that isolates one of them**, or you fix the gate and nothing changes.

⛔ **Covering the embed is NOT on the table** — #68ب stays deferred (owner decision).
**What changed is the promise, not the code**: each of the four now carries a label
saying it is the watch page only. Those labels are **structural, not prose**:
`data-vz-embed="<key>"` in `options.html` (`quality` · `cleanPlayer` · `subtitles` ·
`subLang`) and `popup.html` (`popupSubtitles`), and **`tools/test-embed-promise.js`
fails if a key goes missing, loses its wording, or if this table stops listing all
four**. A label that promises what nothing delivers is exactly what #66 and #67 were
spent removing.

### Subtitles

CSS-only styling — no JS-rendered overlay of our own. We inject a single `<style id="vz_subtitles_css">` that targets:
- Native HTML5: `video::cue`
- YouTube: `.ytp-caption-segment`, `.ytp-caption-window-container .*`, `.captions-text *`
- Netflix: `.player-timedtext-text-container *`, `.player-timedtext`
- JW Player: `.jw-text-track-cue`, `.jw-text-track-display *`

All selectors are prefixed with `html` to raise specificity above YouTube's inline-style baseline; combined with `!important`, they override the host's inline `style="..."`.

**YouTube auto-translate language selection** is done by simulating clicks (no public API on the watch page):
1. Click `.ytp-subtitles-button` to enable CC if off
2. Click `.ytp-settings-button` (gear)
3. Click the "Subtitles/CC" menuitem — matched by localized label list `YT_SUBTITLE_LABELS`
4. Try direct language match in the captions panel
5. Else click the menuitem with `aria-haspopup="true"` (the "Auto-translate" submenu)
6. Click the target language in the language list, matched by `YT_LANG_NAMES[langCode]`

Idempotency is enforced via `ytCaptionAttemptKey = pathname+search+lang` so we don't loop on the same video. SPA navigation re-runs via the `yt-navigate-finish` event and `loadedmetadata` on any `<video>`.

This flow is brittle by definition — if YouTube renames classes or restructures the menu, the matching fallback in `YT_SUBTITLE_LABELS` / `YT_LANG_NAMES` must be extended.

### The master gate — one call site, guarded by a count

`settings.enabled` is the master switch (absent or `true` = on, so an existing
user sees **zero behaviour change**). Everything the extension does — zones,
remap, subtitles, YouTube quality, Clean Player, Sound Booster — passes through:

```js
function extensionActive() { return masterEnabled && !isBlockedHost(); }
```

`isBlockedHost()` has **exactly one call site: inside `extensionActive()`**, and
`tools/test-master-gate.js` counts it and fails if a second one appears. This is
deliberate and is the whole point of the item (#64): a list that enumerates entry
points guards what is in it and lets through whatever is added later, while a
guard that forbids calling from outside the gate **guards what has not been
written yet**.

Two semantics that are easy to get wrong:
- **Off means "not applied from now on", not "undo what was applied."** A quality
  already set before switching off stays. Never roll a user's state backwards.
- **Manual activation deliberately overrides a blocked host** (the user pressed
  the button on that page), but is **disabled outright** when the master switch
  is off — a button that can be pressed and does nothing is a regression.

`remappingEnabled()` stays separate and narrower: it is true when the global
toggle **or** the current site profile is on. The "this site only" workflow
(global off + site profile on) is a live feature with its own popup status
string; do not collapse it into the master switch.

### Host volume adapters

Some hosts re-assert their own volume model over whatever we write to
`video.volume` — ⛔ ~~measured: YouTube snaps back to **56.2%**~~ **corrected
2026-08-04: YouTube restores its OWN model, and that model's value varies and is
unexplained** — `AUDIT.md` has recorded the spread since 2026-07-30
(56.2 · 56.3 · 56.9 · 64.9 · 83.6) **with the source of 56.2% explicitly marked
unproven**, and a run returning to **100%** logged as an anomaly. **That anomaly
recurred on 2026-08-04** (`bench-host-volume`: we wrote 54%, it held to 1602ms,
then 3000ms → 100%). ⇒ ⭐ **The defect in this line was never the number — it was
"snaps back to X", a summary that dropped its source's hedge.**
Twitch restores to **50%**, while Vimeo does not interfere and `d.tube` keeps our
value. ⚠️ **And this does not invalidate the adapter: the measurement was of the
host's model with no extension loaded.** "The host wipes" is not "our adapter
fails" — the latter is **still unmeasured past 3s** (`bench-adapter-live` and
`bench-yt-adapter` wait 1500ms and 1000ms; **the wipe lands at 3000ms**).
A blanket fix would break the two that work in order to fix the two that don't,
so the treatment is
**per-host adapters** in `content.js`:

```js
const hostAdapters = new Map();   // baseDomain ⇒ adapter. Empty = today's behaviour, verbatim
```

Four structural constraints, none of them negotiable:
1. **Default is no adapter.** A host without one takes the direct-write path
   exactly as before. "Zero measured change on Vimeo and d.tube" is an
   acceptance condition, not an intention.
2. **Relative operations only** — step up, step down, toggle mute. **Never an
   absolute set.** Our wheel is relative by nature; absolute costs without buying
   anything.
3. **Verify then fall back.** Each adapter declares how it sets *and* how it
   confirms the set landed. If it did not, it falls back to the direct write —
   i.e. today's behaviour, so a host redesign degrades to the status quo, never
   to a defect. The fallback is logged **once**, not per keystroke.
4. **The badge always reads live state after the operation** — it shows what the
   user will actually hear, not what we asked for.

**`tools/volume-contract.js` is the only definition of volume semantics.** A new
semantic goes into the contract first and into the paths second, never the
reverse; `tools/test-volume-contract.js` counts every `hostAdapters.set(...)` in
`content.js` and fails unless each has a measured host model. It also holds
`DECLARED_LIMITS` — hosts deliberately left without an adapter, with the
measurement and the reason (first: `kick.com`, whose volume slider is `0×0` until
a **real** pointer hovers the volume group, which a synthetic event cannot do).
Registering an adapter for a host with a declared limit turns the suite red.

Any page scan an adapter performs must exclude our own elements via
`isOwnElement()` — otherwise the adapter drives our own badge and reads it back
as the host's.

### Sound Booster

A `Web Audio` chain (`createMediaElementSource` → `GainNode`) per video, driven
by the popup slider from 100% to 600%. The floor is 100 because the booster only
amplifies — attenuation is `ACTION:VOLUME`'s job.

Measured facts that decide the design, not assumptions:
- `video.muted` **does silence the boosted chain** — total zero at gain 1 and
  gain 6. That question is closed.
- `video.volume` **scales the boosted path proportionally** (RMS `0.1769 /
  0.3537` = exactly 0.500), so an adapter falling back to the direct write is
  still audible to the user.

### Per-site profiles

Two maps are built in `content.js`:
- `map` from `globalSiteRules.mappings`
- `siteMap` from `siteProfiles[baseDomain(location.host)].mappings`

`lookupRemap(sig)` checks `siteMap` first then `map`. The gating `remappingEnabled()` is true if **either** the global toggle or the site-profile toggle is on for the current host.

## Known quirks and gotchas

- **`baseDomain()` is naive**: it returns the last two labels (e.g. `youtube.com`, `co.uk` would mismatch). Fine for the common case but watch for `co.uk` / `com.au` style TLDs if you extend per-site logic.
- **Video parent style mutation**: `attachOverlayTo` used to set `parent.style.position = "relative"`. The new fixed-overlay strategy no longer touches host styles, but if you reintroduce DOM-attached overlays, remember this side-effect.
- **`Mouse2` is the MIDDLE button, not the right one.** The signature is `event.button + 1`, so `Mouse1` = left, `Mouse2` = middle, `Mouse3` = right. This doc said "right-click" for a long time and it was simply wrong (audit doc-conflict #6) — check `ZONE_TRIGGER_BY_BUTTON` in `content.js` before writing anything about mouse buttons. Mouse2 also carries its own event-type gating + debounce and sets `e.__videoUnderPointer`; the duplicated second `if (sig === "Mouse2")` block was consolidated — don't re-introduce it. Chrome opens its autoscroll cursor on middle **mousedown**, which is why that path is special-cased at all.
- **Volume = 0 auto-mutes on some hosts**: `runAction` for `ACTION:VOLUME:` clamps the lower bound to `0.0001` and force-unmutes on positive delta. Don't "fix" the magic-number floor without re-checking YouTube behavior.
- **Settings page section overlap**: `.sectionPage` rules must keep specificity high enough that a sibling class (like `.header`) can't override `display:none`. `.sectionPage[hidden]{display:none !important}` is the safety net — don't remove it.
- **RTL grid order**: `.grid` in `options.css` and the in-video `.vzWrap`/`.vzGrid` both force `direction: ltr` so cells stay A1 → C3 regardless of whether the host page is RTL.
- **Never write a template string into `innerHTML` on a render path.** Values reaching the popup rule rows and the zone-editor cells come from storage and from an imported backup file, so they can carry `<` or `&`. Build elements and assign `value` / `textContent` (`ruleRow()` in `popup.js`, `actionLine()` in `options.js`). `tools/test-escape-render.js` enforces that **every** `innerHTML` assignment in `popup.js` and `options.js` is a static literal — no `${…}`, no concatenation (audit #32).
- **The suite must be green before the commit, not after.** A commit that precedes verification makes the revert point a lie, and the fix that lands later mixes two items into one history entry.
- **A hand-written number in the docs drifts by construction.** The assertion count lived in four places and all four were wrong. Derive it (`node tools/run-tests.js`) or delete it.
- **Never print a success message for work you have not confirmed happened.** The import path used to print "تم استيراد الإعدادات ✅" while the zone migration had silently not run. A false success is worse than a silent failure: silence leaves the user suspicious, a false success reassures them of a mistake (audit #57).

## Conventions

- Single-letter `$` is the local `getElementById` helper in `popup.js` and `options.js`. Don't collide with jQuery if you ever add it.
- Storage reads use `chrome.storage.sync.get({ key: <default> })` form to get an inline default. Stick to that pattern.
- All cross-tab fan-out (e.g. on settings save) iterates `chrome.tabs.query({})` and sends a `RELOAD_*` message wrapped in `.catch(() => {})`.
- Action defaults for new zones live in `defaultZoneActions()` in `options.js` and `ensureZonesDefaults()` in `content.js` — keep them in sync.
- **`storage.js` and `content.js` share three verbatim-paired blocks** — `baseDomain`, `normalizeKeyCombo`, `gridAppearance` — delimited by `// ---- BEGIN <name> ----` / `END`, because a content script cannot load `storage.js` without injecting it into every frame. Edit both copies together; `tools/test-migration.js` diffs them textually. Never add a new function *inside* a paired block.
- **`safeSyncSet` is the only write path to `storage.sync`** (it pre-checks the 8KB/100KB/512-item quotas and translates a real rejection into Arabic). The single deliberate exception is `importAllSettings`, whose guard would measure a store it is about to clear — its safety net is the snapshot-restore instead.
- **One migration entry point: `migrateAll()` in `storage.js`.** `background.js` calls it on install/update, the options page calls it on load, and the import path calls it after writing the file. Whichever arrives second finds the work done and writes nothing. Never write a smaller local copy of any part of it.
- **Any script that copies a block of product code carries a guard that fails when it drifts** — `tools/test-fs-report-sync.js` for the fullscreen report, `tools/test-migration.js` for the paired blocks. A copy that silently falls behind its original measures the past and prints plausible numbers about code that no longer runs.

## When you change things

| Change | Update |
|--------|--------|
| Add a new action | `runAction`, `actionToRuntime`, `parseRuntimeAction`, `actionSummary`, `ACTION_CHOICES`, `ACTIONS`, `options.html` guide |
| Add a new settings field | `getSettings()` default-fill, render function, persist function, content.js loader, message reload type |
| Add a new message type | content.js `onMessage` switch, sender (popup/options) |
| Add a new YouTube language for CC | `YT_LANG_NAMES` in `content.js` |
| Add a new subtitle-host selector | `applySubtitleStyles` CSS template in `content.js` |
| Add a new Clean Player item | `CLEAN_PLAYER_ITEMS` in `content.js` **and** `CLEAN_PLAYER_OPTIONS` in `options.js` (same key) — `tools/test-clean-player-keys.js` fails on any key present in one registry only |
| Add a new known player wrapper | `KNOWN_PLAYER_WRAPPER_SELECTOR` in `content.js` (used by zones full-frame + fullscreen logic) |
| Add a new host volume adapter | `hostAdapters.set(...)` in `content.js` **and** a measured host model in `tools/volume-contract.js` — the suite counts them |
| Add a new migration part | the object `migrateAll()` returns in `storage.js` **and** `MIGRATION_PART_TEXT` in `options.js` — the guard reads the parts from `migrateAll`'s own structure, so a part with no message turns the suite red |
| Add a new test file | nothing — `tools/run-tests.js` discovers it. Give it a first-line `//` description; `--list` prints it and fails without it |
| Bump version | ⛔ **First run every on-demand rig and attribute every red** (owner decision 2026-08-04) — the list and its count are printed by `node tools/rig-list.mjs`, never hand-written — see below — then `manifest.json` `version` field (semver-ish: feature bump = minor, fix = patch) |

## Releasing a version — **the gate is measurement, not intent**

**Eight checks run before every commit** (owner decision 2026-08-04, was four):
`run-tests` · `audit-status` · `bench-options-page` · `bench-overlay-layer` ·
`bench-eval-contract` · `bench-s69-guards` · `repro-58-fullscreen` · `lint-names`.
The last three were promoted because they are **local, deterministic, and guard
contracts our work touched** — that is the criterion, not "most important".

⛔ **Everything else is "run on demand"** — the list and count come from `node tools/rig-list.mjs`, never from a number written here. ~~The written reason was:
they need a live host.** Running them per-commit would put the network and host
blocking inside the commit gate, and their red would become noise that teaches
people to skip it (#97's warning).

⚠️ **But that is a reason to defer them from the commit, NOT a licence to never
run them.** #103 — a user-visible defect — **slept for weeks** inside
`bench-s69-guards`, which was written in #69's own commit as its acceptance
witness and went red at #78. Nobody ran it.

⇒ **THE RULE: no version is bumped until every on-demand rig has been run and
every red attributed** (pre-existing / ours / host variance / declared limit).
**Why the version bump is the trigger:** "at the end of each wave" no longer
happens — we are not in waves. **A version bump is the moment when what was not
measured becomes a public claim.**

⇒ ⭐ **And a witness that is not run is a witness that does not exist.** The rig
was standing there saying it, the defect was in front of the user, and nobody
was listening.

### ⭐⭐ "Is it worth the hour?" — answered by measurement, in its second application

**This question will be asked of the condition every single time. The answer is
recorded here, not in a sweep log, because a log is read once and a condition is
read forever.**

**2026-08-05, the `2.17.0` sweep. The eight-check gate was green.** The sweep
alone found `probe-17-coverage` **dead on a throw** — it drives a control that
#107 had moved — and **its death hid the 22 steps after it.** In the same sweep:
a hand-written number (`timing === 8`) turned out to live in **two** places; one
had been fixed and nobody asked whether it had a twin.

⇒ **The condition is not release ceremony. It is the only moment when what
nothing else runs, runs.**

⚠️ **And the second face, written so nobody proposes merging the two later "to
save time": the gate does not replace the sweep, and the sweep does not replace
the gate.** They fail different things and see different things:

| | The eight-check gate | The on-demand sweep |
|---|---|---|
| **What it blocks** | the commit | the version |
| **When** | every commit | every version bump |
| **What it sees** | local, deterministic contracts | live hosts, real players, whole rigs |
| **What it cannot see** | anything needing a live host | anything broken between two bumps |

**Measured proof they are not redundant:** the gate was green while a witness lay
dead (2026-08-05), and the sweep is far too slow and host-dependent to gate a
commit — its red would become noise and teach people to skip it (#97's warning).
⇒ **Two conditions, two triggers, two blind spots. Neither is the other's
economy.**

## Useful one-liners

```bash
# Find all action references
/usr/bin/grep -rn "ACTION:" content.js popup.js options.js options.html

# Re-build settings.json shape (in browser devtools console on options page)
chrome.storage.sync.get(null, console.log)

# Reset everything
chrome.storage.sync.clear()
```
