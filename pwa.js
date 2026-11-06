/*
 * NAIJA OPPORTUNITY HUB — pwa.js
 * Registers the service worker, offers "Install app" and
 * "New version available", and tells people when they are offline.
 * Loaded with <script defer src="/pwa.js"></script>.
 */
(() => {
  "use strict";

  const SW_URL = "/service-worker.js";
  const canUseSW = "serviceWorker" in navigator &&
    (location.protocol === "https:" || location.hostname === "localhost");

  /* ---------- tiny toast (styles are inline so no CSS file is needed) ---------- */

  function injectStyles() {
    if (document.getElementById("noh-pwa-style")) return;
    const style = document.createElement("style");
    style.id = "noh-pwa-style";
    style.textContent = `
      .noh-toast{position:fixed;left:50%;bottom:18px;z-index:9999;display:flex;align-items:center;
        gap:12px;max-width:calc(100vw - 32px);padding:12px 16px;border-radius:14px;
        background:#064d2a;color:#fff;font:600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        box-shadow:0 10px 30px rgba(0,0,0,.25);transform:translate(-50%,20px);opacity:0;
        transition:opacity .25s ease,transform .25s ease}
      .noh-toast.is-visible{opacity:1;transform:translate(-50%,0)}
      .noh-toast button{border:0;border-radius:9px;padding:8px 13px;background:#d4a72c;color:#2b2200;
        font:700 13px system-ui,sans-serif;cursor:pointer;white-space:nowrap}
      .noh-toast button.noh-dismiss{background:transparent;color:#fff;padding:8px 4px;opacity:.8}`;
    document.head.appendChild(style);
  }

  let activeToast = null;

  function showToast(message, actions = [], { autoHide = 0 } = {}) {
    injectStyles();
    hideToast();

    const toast = document.createElement("div");
    toast.className = "noh-toast";
    toast.setAttribute("role", "status");

    const text = document.createElement("span");
    text.textContent = message;
    toast.appendChild(text);

    actions.forEach(({ label, onClick, dismiss }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (dismiss) button.className = "noh-dismiss";
      button.addEventListener("click", () => { hideToast(); onClick?.(); });
      toast.appendChild(button);
    });

    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    activeToast = toast;

    if (autoHide) setTimeout(() => { if (activeToast === toast) hideToast(); }, autoHide);
  }

  function hideToast() {
    if (!activeToast) return;
    const old = activeToast;
    activeToast = null;
    old.classList.remove("is-visible");
    setTimeout(() => old.remove(), 300);
  }

  /* ---------- service worker + updates ---------- */

  function promptUpdate(worker) {
    showToast("A new version is available.", [
      { label: "Refresh", onClick: () => worker.postMessage("SKIP_WAITING") },
      { label: "Later", dismiss: true }
    ]);
  }

  function registerWorker() {
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).then(registration => {
      // A new version was already downloaded and is waiting.
      if (registration.waiting && navigator.serviceWorker.controller) {
        promptUpdate(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            promptUpdate(worker);
          }
        });
      });

      // Look for a new version whenever the app comes back to the screen.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update().catch(() => {});
      });
    }).catch(error => console.warn("Service worker registration failed:", error));

    // Reload once when the new worker takes over.
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }

  if (canUseSW) {
    if (document.readyState === "complete") registerWorker();
    else window.addEventListener("load", registerWorker, { once: true });
  }

  /* ---------- install button ---------- */
  // Works with any element that has id="installAppBtn" (hidden until installable).
  // If the page has none, a small prompt is shown once instead.

  let installEvent = null;
  const INSTALL_DISMISSED_KEY = "noh_install_dismissed_v1";

  function installButtons() {
    return document.querySelectorAll("#installAppBtn, [data-install-app]");
  }

  function setInstallButtons(visible) {
    installButtons().forEach(button => { button.hidden = !visible; });
  }

  async function runInstall() {
    if (!installEvent) return;
    const promptEvent = installEvent;
    installEvent = null;
    setInstallButtons(false);
    promptEvent.prompt();
    try { await promptEvent.userChoice; } catch { /* ignore */ }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installEvent = event;

    if (installButtons().length) {
      setInstallButtons(true);
      return;
    }

    let dismissed = false;
    try { dismissed = localStorage.getItem(INSTALL_DISMISSED_KEY) === "1"; } catch { /* private mode */ }
    if (dismissed) return;

    setTimeout(() => {
      if (!installEvent) return;
      showToast("Install Naija Hub on your phone.", [
        { label: "Install", onClick: runInstall },
        {
          label: "Not now",
          dismiss: true,
          onClick: () => { try { localStorage.setItem(INSTALL_DISMISSED_KEY, "1"); } catch { /* ignore */ } }
        }
      ]);
    }, 8000);
  });

  document.addEventListener("click", event => {
    if (event.target.closest("#installAppBtn, [data-install-app]")) runInstall();
  });

  window.addEventListener("appinstalled", () => {
    installEvent = null;
    setInstallButtons(false);
    showToast("Naija Hub is installed.", [], { autoHide: 3500 });
  });

  /* ---------- offline / online ---------- */

  window.addEventListener("offline", () =>
    showToast("You are offline. Saved pages still work.", [], { autoHide: 4000 }));
  window.addEventListener("online", () =>
    showToast("Back online.", [], { autoHide: 2500 }));
})();
