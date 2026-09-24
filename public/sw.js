const CACHE_PREFIX = "vegas-blackjack-trainer";
const CACHE_NAME = `${CACHE_PREFIX}-v1`;
const shellUrl = new URL("./", self.registration.scope).href;

function isCacheable(response) {
  return response && response.ok && response.type === "basic";
}

async function cacheResponse(cache, request, response) {
  if (isCacheable(response)) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([
        shellUrl,
        new URL("index.html", self.registration.scope).href,
        new URL("manifest.webmanifest", self.registration.scope).href,
        new URL("icon.svg", self.registration.scope).href,
      ]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(`${CACHE_PREFIX}-`) && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;

  const urls = event.data.urls.filter((value) => {
    try {
      const url = new URL(value);
      return url.origin === self.location.origin;
    } catch {
      return false;
    }
  });

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(urls.map(async (url) => {
        try {
          const response = await fetch(url);
          await cacheResponse(cache, url, response);
        } catch {
          // A resource can disappear during an update; the remaining shell is enough.
        }
      }));
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => cacheResponse(await caches.open(CACHE_NAME), request, response))
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request)) ?? (await cache.match(shellUrl));
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached;
      try {
        return await cacheResponse(await caches.open(CACHE_NAME), request, await fetch(request));
      } catch {
        return new Response("Offline resource unavailable", { status: 503, statusText: "Offline" });
      }
    }),
  );
});
