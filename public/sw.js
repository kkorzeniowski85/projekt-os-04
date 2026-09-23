/**
 * Service worker Akademii: instalowalna PWA + działanie bez internetu.
 *
 * UWAGA — wspólna domena: Akademia, Liga Dźwięków i inne projekty stoją pod
 * kkorzeniowski85.github.io, a pamięć podręczna (CacheStorage) jest wspólna
 * dla całej domeny, nie dla podkatalogu. Dlatego:
 *  - przy aktywacji kasujemy WYŁĄCZNIE własne stare wersje (przedrostek
 *    PREFIX) — skasowanie „wszystkiego poza moim" zabierałoby innym
 *    aplikacjom ich tryb offline;
 *  - sami jesteśmy na to narażeni (starsze aplikacje na tej domenie kasują
 *    wszystko), więc po każdej udanej nawigacji online powłoka się
 *    uzupełnia (ensureShell), zamiast czekać na następną instalację.
 *
 * NAGRANIA: element <audio> pyta serwer o fragmenty pliku (nagłówek Range),
 * a GitHub Pages odpowiada wtedy 206 Partial Content — takiej odpowiedzi
 * Cache API nie przyjmuje. Dlatego nagranie pobieramy w całości (200),
 * zapisujemy pod samym adresem i to my wycinamy fragment dla odtwarzacza.
 * HEAD (sprawdzenie, czy nagranie istnieje) też obsługujemy z pamięci.
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
/** Tyle czekamy na sieć przy starcie, gdy w pamięci jest już kopia strony. */
const NETWORK_WAIT_MS = 2500;

/** Brakujące wpisy powłoki — każdy osobno, żeby jeden błąd nie blokował reszty. */
async function ensureShell() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    APP_SHELL.map(async (url) => {
      if (await cache.match(url)) return;
      await cache.add(new Request(url, { cache: "reload" })).catch(() => undefined);
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(ensureShell().then(() => self.skipWaiting()));
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

/** Nagranie z pamięci (pobrane raz w całości), z obsługą HEAD i Range. */
async function audioResponse(request, url) {
  const cache = await caches.open(CACHE);
  const key = url.origin + url.pathname;
  let full = await cache.match(key);
  if (!full) {
    let fresh;
    try {
      fresh = await fetch(key);
    } catch {
      return Response.error();
    }
    if (fresh.status !== 200) return fresh;
    await cache.put(key, fresh.clone()).catch(() => undefined);
    full = fresh;
  }
  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers: full.headers });
  }
  const range = request.headers.get("range");
  if (!range) return full;

  const buffer = await full.arrayBuffer();
  const size = buffer.byteLength;
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  let start = match && match[1] ? Number(match[1]) : 0;
  let end = match && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (match && !match[1] && match[2]) {
    // „bytes=-500" = ostatnie 500 bajtów.
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": full.headers.get("Content-Type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Tylko własny podkatalog — zapytania innych aplikacji z tej domeny nie są nasze.
  if (!url.pathname.startsWith(`${BASE}/`)) return;

  if (url.pathname.startsWith(`${BASE}/audio/`) && (request.method === "GET" || request.method === "HEAD")) {
    event.respondWith(audioResponse(request, url));
    return;
  }

  if (request.method !== "GET") return;

  // Pliki z hashem w nazwie: najpierw pamięć.
  if (url.pathname.startsWith(`${BASE}/_next/static`)) {
    event.respondWith(
      caches.match(request, { cacheName: CACHE }).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Nawigacja i reszta: najpierw sieć (świeża wersja), ale gdy w pamięci jest
  // kopia, czekamy na sieć najwyżej NETWORK_WAIT_MS — przy słabym zasięgu start
  // nie wisi. cache: "no-store", bo GitHub Pages wysyła max-age=600 i zwykły
  // fetch potrafi oddać dziesięciominutową kopię zamiast nowej wersji.
  const network = fetch(request, { cache: "no-store" });
  event.waitUntil(
    network
      .then(async (response) => {
        if (response.status !== 200) return;
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
        if (request.mode === "navigate") await ensureShell();
      })
      .catch(() => undefined),
  );
  event.respondWith(
    (async () => {
      const cached =
        (await caches.match(request, { cacheName: CACHE })) ??
        (request.mode === "navigate" ? await caches.match(`${BASE}/`, { cacheName: CACHE }) : undefined);
      if (!cached) return network.catch(() => Response.error());
      const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_WAIT_MS));
      return Promise.race([network.then((response) => response.clone()).catch(() => cached), timeout]);
    })(),
  );
});
