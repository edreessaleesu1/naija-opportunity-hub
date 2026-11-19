(function () {
  "use strict";
  var ENDPOINT = "https://djxornmwvkauhkcuhgxc.supabase.co/functions/v1/noh-newsletter";
  var KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
  var form = document.getElementById("digestForm");
  if (!form) return;
  var msg = document.getElementById("digestMsg");
  var btn = form.querySelector("button");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = form.elements.email.value.trim();
    var cats = Array.prototype.map.call(form.querySelectorAll("input[name=cat]:checked"), function (c) { return c.value; });
    msg.textContent = "";
    btn.disabled = true;
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY },
      body: JSON.stringify({ action: "subscribe", email: email, categories: cats, website: form.elements.website.value })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        msg.textContent = res.ok ? "Almost done. Check your inbox (and spam) to confirm." : (res.j.error || "Could not subscribe. Try again.");
        if (res.ok) form.reset();
      })
      .catch(function () { msg.textContent = "Network problem. Please try again."; })
      .then(function () { btn.disabled = false; });
  });
})();
