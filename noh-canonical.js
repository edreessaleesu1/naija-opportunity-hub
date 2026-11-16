/* Sets the canonical address of the current page to its final URL (no .html, no tracking junk). */
(function () {
  "use strict";
  var SITE = "https://naijaopportunityhub.com.ng";
  var CATS = ["Scholarship", "Job", "Internship", "Fellowship", "Grant", "Training", "Volunteering"];
  var path = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "").replace(/(.)\/+$/, "$1");
  var params = new URLSearchParams(location.search);
  var query = "";
  if (path === "/opportunity-details") {
    var id = params.get("id") || "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return;
    query = "?id=" + id.toLowerCase();
  } else if (path === "/category") {
    var c = params.get("c") || "";
    if (CATS.indexOf(c) > -1) query = "?c=" + c;
  }
  var href = SITE + path + query;
  var link = document.querySelector('link[rel="canonical"]');
  if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
  link.href = href;
})();
