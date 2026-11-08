/*
 * NAIJA OPPORTUNITY HUB — service-worker.js
 * Place at the site root (same folder as index.html).
 *
 * Strategy
 *  - Pages, CSS and JS ....... network first (always the newest version when
 *                              online), saved copy when offline or very slow.
 *  - Images and fonts ........ cache first (fast, saves data).
 *  - Opportunity list (Supabase REST, GET) .. network first, last copy offline.
 *  - Sign-in, tokens, any POST/PUT/DELETE ... never touched or stored.
 *
 * Change CACHE_VERSION to clear everything old on the next visit.
 */
const CACHE_VERSION = "v2";
const PAGES = `noh-pages-${CACHE_VERSION}`;
const ASSETS = `noh-assets-${CACHE_VERSION}`;
const IMAGES = `noh-images-${CACHE_VERSION}`;
const DATA = `noh-data-${CACHE_VERSION}`;
const ALL_CACHES = [PAGES, ASSETS, IMAGES, DATA];

const MAX_IMAGES = 120;
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE = [
  "/",
  "/style.css",
  "/hero-image.css",
  "/naija-opportunity-hub-logo.png",
  "/manifest.webmanifest"
];

const OFFLINE_HTML = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#086b45"><title>You are offline</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f9f7;color:#16261d;text-align:center}
main{max-width:420px}h1{color:#064d2a;font-size:1.6rem;margin:0 0 10px}
p{color:#5a6b61;line-height:1.6;margin:0 0 22px}
button{border:0;border-radius:12px;background:#086b45;color:#fff;font-size:1rem;font-weight:700;padding:13px 26px}
</style></head><body><main><h1>You are offline</h1>
<p>Naija Opportunity Hub could not reach the internet. Pages you have already
opened will still work. Check your connection and try again.</p>
<button onclick="location.reload()">Try again</button></main></body></html>`;

/* ---------- install / activate ---------- */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(PAGES).then(cache =>
      // One missing file must not break the whole install.
      Promise.all(PRECACHE.map(url => cache.add(url).catch(() => null)))
    )
  );
  // v2 fixes pages being replaced by the homepage; activate straight away.
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("noh-") && !ALL_CACHES.includes(key))
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* ---------- helpers ---------- */

function networkFirst(request, cacheName, { timeout = NETWORK_TIMEOUT_MS, fallback } = {}) {
  return new Promise(resolve => {
    let settled = false;
    const done = response => { if (!settled) { settled = true; resolve(response); } };

    const fromCache = () =>
      caches.match(request, { cacheName }).then(hit => hit || fallback?.() || Response.error());

    const timer = setTimeout(() => caches.match(request, { cacheName }).then(hit => {
      // Only give up on the network if a saved copy of THIS exact page exists.
      if (hit) done(hit);
    }), timeout);

    fetch(request)
      .then(response => {
        clearTimeout(timer);
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(cacheName).then(cache => cache.put(request, copy));
        }
        done(response);
      })
      .catch(() => {
        clearTimeout(timer);
        fromCache().then(done);
      });
  });
}

function cacheFirst(request, cacheName, limit) {
  return caches.match(request, { cacheName }).then(hit => {
    if (hit) return hit;
    return fetch(request).then(response => {
      // Opaque (cross-site) images come back with status 0 and are fine to keep.
      if (response && (response.ok || response.type === "opaque")) {
        const copy = response.clone();
        caches.open(cacheName).then(cache => {
          cache.put(request, copy);
          if (limit) trimCache(cacheName, limit);
        });
      }
      return response;
    });
  });
}

function trimCache(cacheName, limit) {
  caches.open(cacheName).then(cache =>
    cache.keys().then(keys => {
      if (keys.length > limit) {
        cache.delete(keys[0]).then(() => trimCache(cacheName, limit));
      }
    })
  );
}

const offlinePage = () => new Response(OFFLINE_HTML, {
  status: 503,
  headers: { "Content-Type": "text/html; charset=utf-8" }
});

/* ---------- routing ---------- */

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;              // never touch writes

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isSupabase = url.hostname.endsWith(".supabase.co");

  // Supabase: only the public opportunity list and public images are kept.
  if (isSupabase) {
    if (url.pathname.startsWith("/rest/v1/opportunities")) {
      event.respondWith(networkFirst(request, DATA, { timeout: 6000 }));
    } else if (url.pathname.startsWith("/storage/v1/object/public/")) {
      event.respondWith(cacheFirst(request, IMAGES, MAX_IMAGES));
    }
    return;                                           // auth etc.: browser default
  }

  // Supabase library from the CDN
  if (url.hostname === "cdn.jsdelivr.net") {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  if (!sameOrigin) {
    if (request.destination === "image") {
      event.respondWith(cacheFirst(request, IMAGES, MAX_IMAGES));
    }
    return;
  }

  // The service worker file itself must always come from the network.
  if (url.pathname === "/service-worker.js") return;

  // Pages
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES, {
      fallback: () => offlinePage()
    }));
    return;
  }

  // Own images and fonts
  if (["image", "font"].includes(request.destination)) {
    event.respondWith(cacheFirst(request, IMAGES, MAX_IMAGES));
    return;
  }

  // Own CSS, JS and manifest
  if (["style", "script", "manifest"].includes(request.destination) ||
      /\.(css|js|webmanifest)$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, ASSETS));
  }
});
