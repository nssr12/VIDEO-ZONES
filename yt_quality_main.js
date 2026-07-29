// Runs in the page's MAIN world so it can access YouTube's #movie_player JS API.
// content.js (isolated world) communicates via CustomEvent "__vz_setq__".
//
// Audit #19: applyQ polled up to 25 x 400ms = 10s and was fired on EVERY
// loadedmetadata of EVERY <video>, including pre-roll ads, with no de-duplication —
// so several polls ran concurrently, each racing to set a quality, and a poll could
// still be alive after the user had navigated to another video, then set the
// previous video's quality on the new one.
//
// The three rules this file now keeps:
//   1. never touch an ad — the marker is YouTube's own `ad-showing` class on the
//      player, not the video's duration and not a guess;
//   2. exactly ONE poll alive at any moment — a new request cancels the previous one
//      instead of stacking on top of it;
//   3. every poll ends at an explicit deadline, whether or not it succeeded.
(function () {
  if (window.__vzQB) return;
  window.__vzQB = true;

  var POLL_INTERVAL_MS = 400;
  var POLL_DEADLINE_MS = 10000;   // نفس السقف الفعلي القديم (25 × 400) لكنه صريح الآن
  var pollToken = 0;              // كل استطلاع يحمل رقمه؛ اختلافه يعني أنه أُلغي

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // YouTube sets `ad-showing` (and `ad-interrupting`) on #movie_player for the whole
  // duration of an ad. It is the player's own state, not something inferred.
  function isAdShowing(p) {
    return !!(p && p.classList &&
      (p.classList.contains("ad-showing") || p.classList.contains("ad-interrupting")));
  }

  function cancelPoll() { pollToken++; }

  async function applyQ(q) {
    if (!q) return "no-quality-requested";
    // Cancels any poll still running: one alive at a time, never nested loops.
    cancelPoll();
    var myToken = pollToken;

    var p = document.querySelector("#movie_player");
    if (!p || typeof p.getAvailableQualityLevels !== "function") return "no-player";
    if (isAdShowing(p)) return "ad";

    var deadline = Date.now() + POLL_DEADLINE_MS;
    var av = [];
    while (true) {
      if (myToken !== pollToken) return "cancelled";   // a newer request took over
      p = document.querySelector("#movie_player");
      if (!p || typeof p.getAvailableQualityLevels !== "function") return "no-player";
      if (isAdShowing(p)) return "ad";                 // an ad started mid-poll

      av = (p.getAvailableQualityLevels() || []).filter(function (x) { return x !== "auto"; });
      if (av.length > 0) break;
      if (Date.now() >= deadline) return "timeout";    // explicit cap, never endless
      await delay(POLL_INTERVAL_MS);
    }
    if (myToken !== pollToken) return "cancelled";

    var exact = av.indexOf(q) !== -1;
    var t = exact ? q : av[0];
    p.setPlaybackQualityRange(t, t);
    if (typeof p.setPlaybackQuality === "function") p.setPlaybackQuality(t);
    // Reported back to the isolated world so content.js knows the requested quality
    // was not available — today it only logs; surfacing it is a separate decision.
    return exact ? "set" : "fallback:" + t;
  }

  window.addEventListener("__vz_setq__", function (e) {
    var q = e && e.detail && e.detail.q;
    applyQ(q).then(function (result) {
      window.dispatchEvent(new CustomEvent("__vz_setq_done__", {
        detail: { requested: q, result: result }
      }));
    });
  });

  // Navigating to another video cancels a poll still running for the previous one —
  // which is exactly how an old poll used to set the old quality on the new video.
  window.addEventListener("__vz_cancelq__", cancelPoll);
  document.addEventListener("yt-navigate-start", cancelPoll, true);
})();
