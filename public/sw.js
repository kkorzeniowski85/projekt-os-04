/**
 * Service worker Akademii: instalowalna PWA + działanie bez internetu.
 *
 * UWAGA — wspólna domena: Akademia, Liga Dźwięków i inne projekty stoją pod
 * kkorzeniowski85.github.io, a pamięć podręczna (CacheStorage) jest wspólna
 * dla całej domeny, nie dla podkatalogu. Dlatego przy aktywacji kasujemy
 * WYŁĄCZNIE własne stare wersje (przedrostek PREFIX). Skasowanie „wszystkiego
 * poza moim" zabierałoby innym aplikacjom ich tryb offline.
 */

const BASE = self.location.pathname.replace(/\/sw\.js$/, "");
const PREFIX = "akademia-ligi-";
const CACHE = `${PREFIX}v1`;
const APP_SHELL = [
  `${BASE}/`,
  `${BASE}/tabliczka/`,
  `${BASE}/tabliczka/trening/`,
  `${BASE}/tabliczka/test/`,
  `${BASE}/matematyka/`,
  `${BASE}/czytanie/`,
  `${BASE}/polecenia/`,
  `${BASE}/rodzic/`,
  `${BASE}/icon.svg`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Tylko własny podkatalog — zapytania innych aplikacji z tej domeny nie są nasze.
  if (!url.pathname.startsWith(`${BASE}/`)) return;

  // Nagrania i pliki z hashem w nazwie: najpierw cache.
  const cacheFirst =
    url.pathname.startsWith(`${BASE}/_next/static`) || url.pathname.startsWith(`${BASE}/audio`);

  if (cacheFirst) {
    event.respondWith(
      caches.match(request, { cacheName: CACHE }).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Nawigacja i reszta: najpierw sieć (świeża wersja), offline — z cache.
  // cache: "no-store", bo GitHub Pages wysyła max-age=600 i zwykły fetch
  // potrafi oddać dziesięciominutową kopię zamiast nowej wersji.
  event.respondWith(
    fetch(request, { cache: "no-store" })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request, { cacheName: CACHE })
          .then((cached) => cached ?? caches.match(`${BASE}/`, { cacheName: CACHE })),
      ),
  );
});
