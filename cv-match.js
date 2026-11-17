(function () {
  "use strict";

  var SUPABASE_URL = "https://djxornmwvkauhkcuhgxc.supabase.co";
  var KEY = "sb_publishable_EDReCY3JcN4vMuypVfqcMQ_GcTEVuBq";
  var ENDPOINT = SUPABASE_URL + "/functions/v1/noh-cv-match";
  var MIN = 80, MAX = 9000;

  function $(id) { return document.getElementById(id); }
  function val(id) {
    var el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function client() {
    if (window.NOH_SUPABASE_CLIENT) return window.NOH_SUPABASE_CLIENT;

    if (window.supabase && typeof window.supabase.createClient === "function") {
      window.NOH_SUPABASE_CLIENT =
        window.supabase.createClient(SUPABASE_URL, KEY);
      return window.NOH_SUPABASE_CLIENT;
    }

    return null;
  }

  function token() {
    var c = client();

    if (!c) return Promise.resolve(null);

    return c.auth.getSession()
      .then(function (r) {
        return (r.data && r.data.session &&
          r.data.session.access_token) || null;
      })
      .catch(function () {
        return null;
      });
  }

  // Use uploaded or pasted CV text first, otherwise use form content.
  function cvText() {
    var t = val("cv-upload-text");

    if (t.length >= MIN) return t.slice(0, MAX);

    var parts = [
      val("job-title"),
      val("summary"),
      "Education:\n" + val("education"),
      "Experience:\n" + val("experience"),
      "Skills: " + val("skills"),
      "Certificates: " + val("certificates"),
      val("location")
    ];

    return parts
      .filter(function (p) {
        return p && !/^[A-Za-z ]+:\s*$/.test(p);
      })
      .join("\n\n")
      .slice(0, MAX);
  }

  function css() {
    var s = document.createElement("style");

    s.textContent =
      ".cvm-panel{margin-top:16px;padding:16px;border:1px solid #e3dcc6;border-radius:14px;background:#fffdf8}" +
      ".cvm-panel h4{margin:0 0 6px;font-size:1.05rem;color:#0f5132}" +
      ".cvm-sub{margin:0 0 12px;color:#4a5d53;font-size:.9rem;line-height:1.5}" +
      ".cvm-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}" +
      ".cvm-chip{padding:4px 10px;border-radius:999px;background:#eaf3ee;color:#0f5132;font-size:.78rem}" +
      ".cvm-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}" +
      ".cvm-item{padding:12px;border:1px solid #ece6d4;border-radius:12px;background:#fff}" +
      ".cvm-item a{color:#0f5132;font-weight:700;text-decoration:none;font-size:.98rem;line-height:1.35}" +
      ".cvm-meta{margin:4px 0 0;font-size:.8rem;color:#5b6b61}" +
      ".cvm-fit{display:inline-block;margin:6px 6px 0 0;padding:2px 9px;border-radius:999px;font-size:.74rem;font-weight:700}" +
      ".cvm-fit.strong{background:#0f5132;color:#fff}.cvm-fit.good{background:#c49a43;color:#1c2b22}.cvm-fit.possible{background:#ece6d4;color:#4a5d53}" +
      ".cvm-why{margin:6px 0 0;padding-left:18px;font-size:.82rem;color:#40524a}" +
      ".cvm-note{margin-top:12px;font-size:.78rem;color:#6b7a70}";

    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);

    if (cls) n.className = cls;
    if (text != null) n.textContent = text;

    return n;
  }

  function fmtDate(d) {
    var p = String(d).split("-");

    if (p.length !== 3) return d;

    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]))
      .toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      });
  }

  function render(panel, data) {
    panel.replaceChildren();

    panel.appendChild(
      el("h4", null, "Opportunities that fit your CV")
    );

    var p = data.profile || {};

    var summary = [
      p.headline,
      p.level && ("Level: " + p.level)
    ].filter(Boolean).join(" · ");

    if (summary) {
      panel.appendChild(el("p", "cvm-sub", summary));
    }

    if (p.skills && p.skills.length) {
      var chips = el("div", "cvm-chips");

      p.skills.slice(0, 8).forEach(function (s) {
        chips.appendChild(el("span", "cvm-chip", s));
      });

      panel.appendChild(chips);
    }

    var matches = data.matches || [];

    if (!matches.length) {
      panel.appendChild(
        el(
          "p",
          "cvm-sub",
          "Nothing open right now matches this CV closely. Add more detail about your field and skills, or check back after the next daily update."
        )
      );

      return;
    }

    var ul = el("ul", "cvm-list");

    matches.forEach(function (m) {
      var li = el("li", "cvm-item");

      var a = el("a", null, m.title);
      a.href =
        "/opportunity-details.html?id=" +
        encodeURIComponent(m.id);

      li.appendChild(a);

      var meta = [
        m.category,
        m.organization,
        m.deadline ? "Deadline " + fmtDate(m.deadline) : ""
      ].filter(Boolean).join(" · ");

      if (meta) {
        li.appendChild(el("p", "cvm-meta", meta));
      }

      var cls =
        m.fit === "Strong match" ? "strong" :
        m.fit === "Good match" ? "good" :
        "possible";

      li.appendChild(
        el("span", "cvm-fit " + cls, m.fit)
      );

      if (m.reasons && m.reasons.length) {
        var why = el("ul", "cvm-why");

        m.reasons.forEach(function (r) {
          why.appendChild(el("li", null, r));
        });

        li.appendChild(why);
      }

      ul.appendChild(li);
    });

    panel.appendChild(ul);

    panel.appendChild(
      el(
        "p",
        "cvm-note",
        "Matches are a guide based on your CV and each listing's details. Always read the full requirements on the official page before applying."
      )
    );
  }

  function init() {
    var anchor =
      $("ai-extract-cv") ||
      $("ai-review-cv") ||
      $("ai-improve-cv");

    if ($("ai-match-cv")) return true;
    if (!anchor) return false;

    css();

    var btn = el(
      "button",
      "button button-secondary",
      "Match Me to Opportunities"
    );

    btn.type = "button";
    btn.id = "ai-match-cv";

    anchor.insertAdjacentElement("afterend", btn);

    var panel = el("div", "cvm-panel");
    panel.id = "cv-match-result";
    panel.hidden = true;

    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");

    var actions = anchor.parentElement;
    actions.insertAdjacentElement("afterend", panel);

    var busy = false;

    btn.addEventListener("click", function () {
      if (busy) return;

      var text = cvText();

      panel.hidden = false;

      if (text.length < MIN) {
        panel.replaceChildren(
          el(
            "p",
            "cvm-sub",
            "Upload your CV or paste its text first (a few lines at least), then tap again."
          )
        );

        return;
      }

      busy = true;
      btn.disabled = true;

      var label = btn.textContent;
      btn.textContent = "Matching...";

      panel.replaceChildren(
        el(
          "p",
          "cvm-sub",
          "Reading your CV and checking open opportunities. This takes about 10 seconds."
        )
      );

      token()
        .then(function (t) {
          if (!t) {
            var msg = el(
              "p",
              "cvm-sub",
              "Please sign in to match your CV with opportunities. "
            );

            var a = el("a", null, "Sign in");
            a.href = "/auth.html?mode=login";

            msg.appendChild(a);
            panel.replaceChildren(msg);

            return null;
          }

          var ctl = new AbortController();

          var timer = setTimeout(function () {
            ctl.abort();
          }, 45000);

          return fetch(ENDPOINT, {
            method: "POST",
            signal: ctl.signal,
            headers: {
              "Content-Type": "application/json",
              apikey: KEY,
              Authorization: "Bearer " + t
            },
            body: JSON.stringify({
              cvText: text
            })
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return {
                  ok: r.ok,
                  j: j
                };
              });
            })
            .then(function (res) {
              if (!res.ok) {
                panel.replaceChildren(
                  el(
                    "p",
                    "cvm-sub",
                    (res.j && res.j.error) ||
                      "Could not match right now. Please try again."
                  )
                );

                return;
              }

              render(panel, res.j);
            })
            .finally(function () {
              clearTimeout(timer);
            });
        })
        .catch(function () {
          panel.replaceChildren(
            el(
              "p",
              "cvm-sub",
              "Network problem or timeout. Please try again."
            )
          );
        })
        .then(function () {
          busy = false;
          btn.disabled = false;
          btn.textContent = label;
        });
    });

    return true;
  }

  function start() {
    var tries = 0;

    (function attempt() {
      if (init() === false && ++tries < 40) {
        setTimeout(attempt, 250);
      }
    })();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
