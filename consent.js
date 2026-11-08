/* Naija Opportunity Hub - cookie consent, Google Analytics 4 and Google AdSense.

   1. Paste your IDs below (leave "" to switch that service off).
   2. Nothing from Google loads until the visitor says yes.
   3. Ads load only on the pages listed in AD_PAGES (never on sign-in,
      contact, legal pages or the Career Kit tools).                       */
(() => {
  "use strict";

  if (window.NOH_CONSENT) return;
  window.NOH_CONSENT = true;

  /* ===================== YOUR SETTINGS ===================== */
  const CONFIG = {
    GA_MEASUREMENT_ID: "G-H3L5FL9GMN",   // e.g. "G-ABCD123456"  (Google Analytics > Admin > Data streams)
    ADSENSE_CLIENT: "ca-pub-6140977755982286"       // e.g. "ca-pub-1234567890123456"  (AdSense > Account > Settings)
  };

  const AD_PAGES = ["/", "/index.html", "/opportunity-details", "/opportunity-details.html"];
  /* ========================================================== */

  const KEY = "noh_consent_v2";
  const GA_OK = /^G-[A-Z0-9]{6,14}$/.test(CONFIG.GA_MEASUREMENT_ID);
  const ADS_OK = /^ca-pub-\d{10,20}$/.test(CONFIG.ADSENSE_CLIENT);
  const ADS_PAGE = AD_PAGES.includes(location.pathname);

  let state = readState();
  let gaLoaded = false;
  let adsLoaded = false;
  let pageViewSent = false;
  let panel = null;

  /* ---------- Google consent mode: everything denied by default ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500
  });

  /* ---------- storage helpers ---------- */
  function readState() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      return raw && raw.v === 2 ? raw : null;
    } catch { return null; }
  }

  function saveState(next) {
    state = { v: 2, analytics: Boolean(next.analytics), ads: Boolean(next.ads), ts: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    apply();
  }

  /* ---------- Google Analytics ---------- */
  function sendPageView() {
    if (pageViewSent || !gaLoaded) return;
    if (window.NOH_DEFER_PAGEVIEW && !window.NOH_PAGE_READY) return;

    pageViewSent = true;

    gtag("event", "page_view", {
      page_title: document.title,
      page_location: location.href
    });
  }

  function loadAnalytics() {
    if (gaLoaded || !GA_OK) return;
    gaLoaded = true;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.GA_MEASUREMENT_ID);
    document.head.appendChild(script);

    gtag("js", new Date());
    gtag("consent", "update", { analytics_storage: "granted" });
    gtag("config", CONFIG.GA_MEASUREMENT_ID, { send_page_view: false });

    sendPageView();
  }

  function stopAnalytics() {
    gtag("consent", "update", { analytics_storage: "denied" });

    // Remove Google Analytics cookies that may already exist.
    const host = location.hostname.split(".");
    const domains = ["", location.hostname, "." + host.slice(-2).join(".")];

    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();

      if (/^_ga($|_)|^_gid$/.test(name)) {
        domains.forEach((domain) => {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (domain ? "; domain=" + domain : "");
        });
      }
    });
  }

  /* ---------- Google AdSense (manual slots + optional Auto ads) ---------- */
  function loadAds() {
    if (adsLoaded || !ADS_OK || !ADS_PAGE) return;
    adsLoaded = true;

    gtag("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(CONFIG.ADSENSE_CLIENT);
    document.head.appendChild(script);

    refreshAds();
  }

  function refreshAds() {
    if (!adsLoaded || !(state && state.ads)) return;

    document.querySelectorAll(".noh-ad[data-ad-slot]").forEach((box) => {
      const slot = (box.getAttribute("data-ad-slot") || "").trim();

      if (!/^\d{6,15}$/.test(slot) || box.dataset.filled) return;

      box.dataset.filled = "1";
      box.hidden = false;

      const label = document.createElement("span");
      label.className = "noh-ad-label";
      label.textContent = "Advertisement";

      const ins = document.createElement("ins");
      ins.className = "adsbygoogle";
      ins.style.display = "block";
      ins.setAttribute("data-ad-client", CONFIG.ADSENSE_CLIENT);
      ins.setAttribute("data-ad-slot", slot);
      ins.setAttribute("data-ad-format", "auto");
      ins.setAttribute("data-full-width-responsive", "true");

      box.replaceChildren(label, ins);

      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ignore */ }
    });
  }

  function apply() {
    if (state && state.analytics) loadAnalytics(); else if (gaLoaded) stopAnalytics();
    if (state && state.ads) loadAds();
  }

  /* ---------- public helpers for the pages ---------- */
  window.NOH_PAGEVIEW = () => { window.NOH_PAGE_READY = true; sendPageView(); };
  window.NOH_ADS_REFRESH = refreshAds;
  window.NOH_TRACK = (name, params) => {
    if (gaLoaded && state && state.analytics) gtag("event", name, params || {});
  };
  window.NOH_OPEN_CONSENT = () => openPanel(true);

  /* ---------- styles ---------- */
  const style = document.createElement("style");
  style.textContent = `
    .noh-ad{margin:18px auto;max-width:1160px;padding:0 16px;min-height:120px;text-align:center}
    .noh-ad .noh-ad-label{display:block;margin:0 0 4px;font:600 .68rem/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#7a6a3a}
    #nohConsent{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:680px;margin:0 auto;padding:18px 18px max(18px,env(safe-area-inset-bottom));background:#fffdf6;color:#1c3026;border:1px solid #e8d7aa;border-radius:16px;box-shadow:0 12px 34px rgba(28,48,38,.24);font:500 .92rem/1.55 'DM Sans','Segoe UI',system-ui,sans-serif;max-height:85vh;overflow:auto}
    #nohConsent h2{margin:0 0 6px;font-size:1.05rem;color:#033c29}
    #nohConsent p{margin:0 0 12px}
    #nohConsent a{color:#075b3b;font-weight:700}
    #nohConsent .row{display:flex;flex-wrap:wrap;gap:10px}
    #nohConsent button{flex:1 1 130px;min-height:46px;padding:10px 16px;border-radius:12px;border:1.5px solid #c6a24a;font:800 .93rem inherit;font-family:inherit;cursor:pointer}
    #nohConsent .primary{background:#c6a24a;color:#1d2a20}
    #nohConsent .secondary{background:#fff;color:#075b3b}
    #nohConsent .link{flex:1 1 100%;border:0;background:none;color:#075b3b;text-decoration:underline;min-height:36px}
    #nohConsent .opt{display:flex;gap:12px;align-items:flex-start;margin:0 0 10px;padding:11px 12px;border:1px solid #e8d7aa;border-radius:12px;background:#fffaf0;cursor:pointer}
    #nohConsent .opt input{flex:none;width:22px;height:22px;margin:2px 0 0;accent-color:#075b3b}
    #nohConsent .opt strong{display:block}
    #nohConsent .opt small{display:block;color:#5f6f65;font-size:.82rem;line-height:1.45}
    #nohConsent .fixed{opacity:.8;cursor:default}
  `;
  document.head.appendChild(style);

  /* ---------- the panel ---------- */
  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (text) node.textContent = text;
    return node;
  }

  function option(id, title, detail, checked, disabled) {
    const label = el("label", { class: "opt" + (disabled ? " fixed" : ""), for: id });
    const box = el("input", { type: "checkbox", id });
    box.checked = checked;
    box.disabled = Boolean(disabled);
    const text = el("span");
    text.append(el("strong", {}, title), el("small", {}, detail));
    label.append(box, text);
    return label;
  }

  function closePanel() {
    if (panel) { panel.remove(); panel = null; }
  }

  function openPanel(fromSettings) {
    closePanel();

    panel = el("section", { id: "nohConsent", role: "dialog", "aria-label": "Cookie choices", "aria-modal": "false" });

    const intro = el("p");
    intro.append(
      "We use essential browser storage to keep the site working. With your permission we also use " +
      [GA_OK ? "analytics" : "", ADS_OK ? "advertising" : ""].filter(Boolean).join(" and ") +
      " cookies. You can change your mind at any time. "
    );
    const more = el("a", { href: "/privacy.html#storage" }, "Privacy Policy");
    intro.append(more, ".");

    panel.append(el("h2", {}, "Your cookie choices"), intro);

    const main = el("div", { class: "row" });
    const accept = el("button", { type: "button", class: "primary" }, "Accept all");
    const reject = el("button", { type: "button", class: "secondary" }, "Reject all");
    const custom = el("button", { type: "button", class: "secondary" }, "Customise");

    accept.addEventListener("click", () => { saveState({ analytics: GA_OK, ads: ADS_OK }); closePanel(); });
    reject.addEventListener("click", () => { saveState({ analytics: false, ads: false }); closePanel(); });

    custom.addEventListener("click", () => {
      main.remove();

      panel.append(
        option("nohEssential", "Essential", "Keeps you signed in and remembers saved opportunities. Always on.", true, true),
        GA_OK ? option("nohAnalytics", "Analytics", "Helps us see which pages are useful, using Google Analytics.", Boolean(state && state.analytics)) : document.createComment(""),
        ADS_OK ? option("nohAds", "Advertising", "Allows Google to show ads on some pages and to use cookies for them.", Boolean(state && state.ads)) : document.createComment("")
      );

      const save = el("button", { type: "button", class: "primary" }, "Save my choices");
      save.addEventListener("click", () => {
        saveState({
          analytics: Boolean(document.getElementById("nohAnalytics")?.checked),
          ads: Boolean(document.getElementById("nohAds")?.checked)
        });
        closePanel();
      });

      const actions = el("div", { class: "row" });
      actions.appendChild(save);
      panel.appendChild(actions);
    });

    main.append(accept, reject, custom);
    panel.appendChild(main);

    if (fromSettings && state) {
      const cancel = el("button", { type: "button", class: "link" }, "Close");
      cancel.addEventListener("click", closePanel);
      panel.appendChild(cancel);
    }

    document.body.appendChild(panel);

    if (fromSettings) accept.focus();
  }

  /* ---------- start ---------- */
  function start() {
    // Footer links labelled "Cookie settings".
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest && event.target.closest("[data-noh-cookie-settings]");

      if (trigger) {
        event.preventDefault();

        if (GA_OK || ADS_OK) openPanel(true);
        else window.alert("This site only uses essential browser storage, so there is nothing to change.");
      }
    });

    if (!GA_OK && !ADS_OK) return;      // nothing optional is switched on

    if (state) apply(); else openPanel(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
