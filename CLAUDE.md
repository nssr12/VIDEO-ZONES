# CLAUDE.md

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
| `popup.html` / `popup.js` | Toolbar popup: global enable, per-site rules, blocked-site toggle, page status, manual injection, overlay duration slider |
| `options.html` / `options.js` / `options.css` | Full settings page: zone editor, grid appearance, volume indicator, overlay timing, subtitles, blocked sites, backup/restore, settings guide |
| `README.md` | User-facing Arabic readme |

## Storage schema (`chrome.storage.sync`)

Three top-level keys:

```js
// 1) Global remap (key/mouse → action)
globalSiteRules = {
  enabled: boolean,
  mappings: [{ from: "ArrowRight"|"Mouse2"|"Ctrl+K", to: "ACTION:..." }]
}

// 2) Per-site profile overrides
siteProfiles = {
  "youtube.com": { enabled: boolean, mappings: [{from, to}] },
  "twitch.tv":   { ... }
}
// Resolution order at runtime: siteMap[sig] || globalMap[sig]

// 3) Everything else
settings = {
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
  overlay: { autoHideMs, volumeAutoHideMs, enabled },
  blockedHosts: ["youtube.com", ...],
  soundDisplay: { color, fontSize },
  gridAppearance: { cellBg, cellBorder, numberColor, radius },
  subtitles: {
    enabled, defaultLang, fontSize, color, bgColor, bgOpacity, fontFamily, position
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
| `GVZ_STATUS` | popup | Returns `{ok, blocked, globalEnabled, siteProfileEnabled, hasVideoUnderPointer, host}` |
| `SITE_RULES_UPDATED` | popup | Hot-applies new `globalSiteRules` without storage read |
| `RELOAD_SITE_RULES` | popup | Re-reads `globalSiteRules` from storage |
| `RELOAD_SITE_PROFILE` | popup | Re-reads `siteProfiles[currentHost]` |
| `GVZ_RELOAD` / `RELOAD_ZONE_SETTINGS` | options | Re-reads `settings.zones`, `blockedHosts`, `soundDisplay` |
| `RELOAD_OVERLAY_SETTINGS` | popup/options | Re-reads `settings.overlay` |
| `RELOAD_SUBTITLES` | options | Re-reads `settings.subtitles` and re-applies styles + language |
| `RELOAD_YT_QUALITY` | options | Re-reads `settings.ytAutoQuality` and re-triggers the quality setter |
| `RELOAD_YT_SHORTS` | options | Re-reads `settings.ytShortsRedirect` and redirects if currently on a /shorts/ URL |
| `RELOAD_CLEAN_PLAYER` | options | Re-reads `settings.cleanPlayer` and re-injects the hide-elements CSS |

`chrome.storage.onChanged` is a backup trigger that re-loads the relevant slice when `settings` / `globalSiteRules` / `siteProfiles` changes from any source.

## Architecture notes

### Overlay positioning (the YouTube fix)

The overlay (3×3 grid + hint text + volume badge) is **not** attached to `video.parentElement`. YouTube nests the video inside `.html5-video-container` with sibling chrome layers (`.ytp-chrome-bottom`, etc.) inside `#movie_player`. Because those siblings live in separate stacking contexts, even `z-index: 999999` on the overlay loses.

Current strategy (`content.js`):
- Overlay is appended to `document.fullscreenElement || document.body`.
- `position: fixed` with `top/left/width/height` continuously matched to `video.getBoundingClientRect()` via a `requestAnimationFrame` loop while any sub-element is visible.
- `z-index: 2147483647`.
- `fullscreenchange` listener moves the overlay between `document.body` and the fullscreen element so it survives fullscreen toggles.

When editing overlay rendering, do **not** revert to attaching inside the player wrapper unless you re-test on YouTube.

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

CSS-only, same pattern as subtitles: one injected `<style id="vz_clean_player_css">` with `html`-prefixed selectors + `display:none !important`. The item registry is `CLEAN_PLAYER_ITEMS` in `content.js` (key → selector list); the options-page list is generated from `CLEAN_PLAYER_OPTIONS` in `options.js` — **keys must stay in sync between the two**. Applies on `youtube.com` and `youtube-nocookie.com` (embedded players in iframes on other sites), respects `blockedHosts`. Gated by `cleanPlayer.enabled` + per-item flags in `cleanPlayer.items` (only checked keys stored). Selectors were verified against the live 2026 player and open-source hide lists (ImprovedTube, yt-neuter, Control Panel for YouTube) — includes both classic and 2025 "Delhi" player variants.

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

### Per-site profiles

Two maps are built in `content.js`:
- `map` from `globalSiteRules.mappings`
- `siteMap` from `siteProfiles[baseDomain(location.host)].mappings`

`lookupRemap(sig)` checks `siteMap` first then `map`. The gating `remappingEnabled()` is true if **either** the global toggle or the site-profile toggle is on for the current host.

## Known quirks and gotchas

- **`baseDomain()` is naive**: it returns the last two labels (e.g. `youtube.com`, `co.uk` would mismatch). Fine for the common case but watch for `co.uk` / `com.au` style TLDs if you extend per-site logic.
- **Video parent style mutation**: `attachOverlayTo` used to set `parent.style.position = "relative"`. The new fixed-overlay strategy no longer touches host styles, but if you reintroduce DOM-attached overlays, remember this side-effect.
- **Mouse2 (right-click) is double-handled**: in `handleMouse`, Mouse2 has its own block for event-type gating + debounce + setting `e.__videoUnderPointer`. The previously duplicated second `if (sig === "Mouse2")` block has been consolidated — don't re-introduce it.
- **Volume = 0 auto-mutes on some hosts**: `runAction` for `ACTION:VOLUME:` clamps the lower bound to `0.0001` and force-unmutes on positive delta. Don't "fix" the magic-number floor without re-checking YouTube behavior.
- **Settings page section overlap**: `.sectionPage` rules must keep specificity high enough that a sibling class (like `.header`) can't override `display:none`. `.sectionPage[hidden]{display:none !important}` is the safety net — don't remove it.
- **RTL grid order**: `.grid` in `options.css` and the in-video `.vzWrap`/`.vzGrid` both force `direction: ltr` so cells stay A1 → C3 regardless of whether the host page is RTL.

## Conventions

- Single-letter `$` is the local `getElementById` helper in `popup.js` and `options.js`. Don't collide with jQuery if you ever add it.
- Storage reads use `chrome.storage.sync.get({ key: <default> })` form to get an inline default. Stick to that pattern.
- All cross-tab fan-out (e.g. on settings save) iterates `chrome.tabs.query({})` and sends a `RELOAD_*` message wrapped in `.catch(() => {})`.
- Action defaults for new zones live in `defaultZoneActions()` in `options.js` and `ensureZonesDefaults()` in `content.js` — keep them in sync.

## When you change things

| Change | Update |
|--------|--------|
| Add a new action | `runAction`, `actionToRuntime`, `parseRuntimeAction`, `actionSummary`, `ACTION_CHOICES`, `ACTIONS`, `options.html` guide |
| Add a new settings field | `getSettings()` default-fill, render function, persist function, content.js loader, message reload type |
| Add a new message type | content.js `onMessage` switch, sender (popup/options) |
| Add a new YouTube language for CC | `YT_LANG_NAMES` in `content.js` |
| Add a new subtitle-host selector | `applySubtitleStyles` CSS template in `content.js` |
| Add a new Clean Player item | `CLEAN_PLAYER_ITEMS` in `content.js` **and** `CLEAN_PLAYER_OPTIONS` in `options.js` (same key) |
| Add a new known player wrapper | `KNOWN_PLAYER_WRAPPER_SELECTOR` in `content.js` (used by zones full-frame + fullscreen logic) |
| Bump version | `manifest.json` `version` field (semver-ish: feature bump = minor, fix = patch) |

## Useful one-liners

```bash
# Find all action references
/usr/bin/grep -rn "ACTION:" content.js popup.js options.js options.html

# Re-build settings.json shape (in browser devtools console on options page)
chrome.storage.sync.get(null, console.log)

# Reset everything
chrome.storage.sync.clear()
```
