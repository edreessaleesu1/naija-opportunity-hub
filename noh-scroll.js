/* Naija Opportunity Hub: return to exactly where you left.
   Remembers the scroll position and which "Load more / View more" buttons were pressed,
   and restores both when you come back with the Back button. */
(function () {
  "use strict";
  var KEY = "noh-restore:" + location.pathname + location.search;
  var MAX_WAIT = 10000;

  function read() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function write(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function clear() { try { sessionStorage.removeItem(KEY); } catch (e) {} }

  var nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || null;
  var isBack = nav ? nav.type === "back_forward" : !!(performance.navigation && performance.navigation.type === 2);
  try { history.scrollRestoration = "manual"; } catch (e) {}

  var saved = isBack ? read() : null;
  if (!isBack) clear();
  var actions = saved && Array.isArray(saved.a) ? saved.a.slice(0, 60) : [];
  var restoring = !!saved;
  var userMoved = false;

  function save() {
    if (restoring) return;
    write({ y: Math.round(window.pageYOffset || document.documentElement.scrollTop || 0), a: actions, t: Date.now() });
  }

  // Record the buttons that change what is on the page.
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("[data-more]")) { if (!restoring) actions.push({ t: "more" }); }
    else {
      var sec = t.closest("[data-section-toggle]");
      if (sec && !restoring) actions.push({ t: "sec", k: sec.getAttribute("data-section-toggle") });
    }
    if (t.closest("a[href]")) save();
  }, true);

  var timer = null;
  window.addEventListener("scroll", function () { clearTimeout(timer); timer = setTimeout(save, 150); }, { passive: true });
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") save(); });

  if (!saved) return;

  ["touchstart", "wheel", "keydown", "mousedown"].forEach(function (ev) {
    window.addEventListener(ev, function () { userMoved = true; }, { passive: true, once: true });
  });

  function scrollNow() { if (!userMoved) window.scrollTo(0, saved.y || 0); }

  function replay(i, done) {
    if (i >= actions.length) return done();
    var a = actions[i], btn = null;
    if (a.t === "more") btn = document.querySelector("[data-more]");
    else if (a.t === "sec" && window.CSS && CSS.escape) btn = document.querySelector('[data-section-toggle="' + CSS.escape(a.k) + '"]');
    if (btn) btn.click();
    setTimeout(function () { replay(i + 1, done); }, 25);
  }

  function finish() {
    scrollNow();
    setTimeout(scrollNow, 150);
    setTimeout(scrollNow, 500);
    setTimeout(function () { scrollNow(); restoring = false; }, 1200);
  }

  function ready() {
    // Lists load from the database after the page opens, so wait for them.
    var needsList = !!document.getElementById("opportunityGrid");
    if (needsList) return !!document.querySelector(".opportunity-row, .opportunity-card, [data-section-toggle]");
    return document.readyState === "complete";
  }

  var started = Date.now();
  (function wait() {
    if (ready() || Date.now() - started > MAX_WAIT) {
      setTimeout(function () { replay(0, finish); }, 60);
    } else setTimeout(wait, 100);
  })();
})();
