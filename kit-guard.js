/* Career Kit sign-in guard. Load in <head>, before everything else, with no defer.
   Hides the page until a signed-in session is confirmed; otherwise sends the visitor to the login page
   and brings them back afterwards. (The AI function also checks sign-in on the server.) */
(function () {
  "use strict";
  var URL_ = "https://djxornmwvkauhkcuhgxc.supabase.co";
  var KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
  var CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var root = document.documentElement;
  var style = document.createElement("style");
  style.id = "noh-guard-style";
  style.textContent = "html.noh-lock body{visibility:hidden}";
  document.head.appendChild(style);
  root.classList.add("noh-lock");

  function loginURL() {
    var back = location.pathname + location.search + location.hash;
    return "/auth.html?mode=login&redirect=" + encodeURIComponent(back);
  }
  function deny() { location.replace(loginURL()); }
  function allow() { root.classList.remove("noh-lock"); }

  function check() {
    try {
      var client = window.NOH_SUPABASE_CLIENT ||
        (window.NOH_SUPABASE_CLIENT = window.supabase.createClient(URL_, KEY));
      client.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session;
        if (s && s.user) allow(); else deny();
      }, deny);
    } catch (e) { deny(); }
  }

  // Safety net: if the check hangs (offline), send them to sign in rather than showing the page.
  setTimeout(function () { if (root.classList.contains("noh-lock")) deny(); }, 10000);

  if (window.supabase && window.supabase.createClient) return check();
  var s = document.createElement("script");
  s.src = CDN; s.onload = check; s.onerror = deny;
  document.head.appendChild(s);
})();
