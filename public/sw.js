// ============================================================================
//  Hamza Gym service worker
//
//  Responsibilities:
//   1. App-shell precaching — so the installed PWA opens to *something* offline.
//   2. A fetch handler with cache strategies (network-first for navigations,
//      stale-while-revalidate for static assets).
//   3. Offline fallback page when navigation can't reach the server.
//   4. Web push notifications (original behavior — preserved).
//   5. Background Sync registration (Android Chrome) so queued writes flush
//      even if the app is closed. iOS Safari lacks this; the app-layer sync
//      engine covers iOS by syncing on foreground.
//
//  Data (Supabase REST + /api) is intentionally NOT cached here — that's
//  handled by the app's IndexedDB layer (lib/offline/*), which understands the
//  data's shape and can serve stale-but-meaningful snapshots.
// ============================================================================

const VERSION = "v1";
const APP_SHELL_CACHE = `hamza-shell-${VERSION}`;
const RUNTIME_CACHE = `hamza-runtime-${VERSION}`;

// Resources precached at install. The start URL + offline fallback are the
// critical ones — they guarantee the PWA opens offline.
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icon.svg",
];

// ---- Install: precache the app shell --------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      // addAll is all-or-nothing; cache each independently so one missing
      // route (e.g. /offline during dev) doesn't abort the whole install.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      );
      // Force this SW to activate immediately.
      await self.skipWaiting();
    })()
  );
});

// ---- Activate: clean old caches + claim clients ---------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== APP_SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      // Take control of all open tabs so the new SW applies right away.
      await self.clients.claim();
    })()
  );
});

// ---- Message channel (skipWaiting from the page) --------------------------
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// ---- Fetch handler --------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET — never intercept mutations.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Don't touch cross-origin analytics / maps / etc. — let them pass through.
  // Same-origin + Supabase REST are the only ones we reason about.
  const isSameOrigin = url.origin === self.location.origin;
  const isSupabase = url.hostname.endsWith(".supabase.co");

  // 1. Navigations (page loads) → network-first, fall back to cached shell,
  //    then the offline page. This is what makes the app open offline.
  if (req.mode === "navigate") {
    event.respondWith(handleNavigation(req));
    return;
  }

  // 2. Static assets from our own origin (_next/static, fonts, images) →
  //    stale-while-revalidate. These are fingerprinted and immutable.
  if (isSameOrigin) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // 3. Supabase REST calls → pass straight through (the app layer caches
  //    data in IndexedDB and serves stale snapshots from there, with full
  //    type-awareness). Caching raw REST responses blindly would serve
  //    stale auth tokens / per-user data across users — unsafe.
  if (isSupabase) {
    // Default browser behavior (network). No respondWith.
    return;
  }
});

// Network-first for navigations. Falls back to the cached start URL, then the
// branded offline page, so the user never sees a browser dinosaur.
async function handleNavigation(req) {
  const cache = await caches.open(APP_SHELL_CACHE);
  try {
    const fresh = await fetch(req);
    // Cache the rendered page for next offline open.
    cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    // Network failed — try the exact cached request first…
    const cached = await cache.match(req);
    if (cached) return cached;
    // …then the start URL shell…
    const shell = await cache.match("/");
    if (shell) return shell;
    // …finally the offline fallback.
    const offline = await cache.match("/offline");
    if (offline) return offline;
    return new Response(
      "You're offline and this page isn't cached yet.",
      { status: 503, headers: { "Content-Type": "text/plain" } }
    );
  }
}

// Stale-while-revalidate: serve cached immediately, refresh in the background.
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((res) => {
      // Only cache successful, same-type responses.
      if (res && res.status === 200 && res.type === "basic") {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);
  return cached || networkPromise || Response.error();
}

// ============================================================================
//  Web push notifications (preserved from the original sw.js)
// ============================================================================
self.addEventListener("push", (event) => {
  let data = { title: "Hamza Gym", body: "" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});

// Background Sync — when connectivity returns, the browser wakes this SW and
// fires "sync". We ping every open client to run the app-layer sync engine
// (which owns the IndexedDB queue + server reconciliation). Registered from
// the page via registration.sync.register('hamza-sync') where supported.
self.addEventListener("sync", (event) => {
  if (event.tag === "hamza-sync") {
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of clients) {
    client.postMessage("SYNC_NOW");
  }
}
