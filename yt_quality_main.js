// Runs in the page's MAIN world so it can access YouTube's #movie_player JS API.
// content.js (isolated world) communicates via CustomEvent "__vz_setq__".
(function () {
  if (window.__vzQB) return;
  window.__vzQB = true;

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function applyQ(q) {
    if (!q) return;
    var p = document.querySelector("#movie_player");
    if (!p || typeof p.getAvailableQualityLevels !== "function") return;

    var av = [];
    for (var i = 0; i < 25; i++) {
      av = (p.getAvailableQualityLevels() || []).filter(function (x) { return x !== "auto"; });
      if (av.length > 0) break;
      await delay(400);
    }
    if (!av.length) return;

    var t = av.indexOf(q) !== -1 ? q : av[0];
    p.setPlaybackQualityRange(t, t);
    if (typeof p.setPlaybackQuality === "function") p.setPlaybackQuality(t);
  }

  window.addEventListener("__vz_setq__", function (e) {
    applyQ(e && e.detail && e.detail.q);
  });
})();
