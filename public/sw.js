/**
 * Service worker Akademii: instalowalna PWA + działanie bez internetu.
 *
 * UWAGA — wspólna domena: Akademia, Liga Dźwięków i inne projekty stoją pod
 * kkorzeniowski85.github.io, a pamięć podręczna (CacheStorage) jest wspólna
 * dla całej domeny, nie dla podkatalogu. Dlatego:
 *  - kasujemy WYŁĄCZNIE własne cache (przedrostek PREFIX) — skasowanie
 *    „wszystkiego poza moim" zabierałoby innym aplikacjom ich tryb offline;
 *  - sami jesteśmy na to narażeni (starsze aplikacje na tej domenie kasują
 *    wszystko), więc po każdej udanej nawigacji online powłoka się
 *    uzupełnia (ensureShell), zamiast czekać na następną instalację.
 *
 * WDROŻENIA: build zapisuje public/deploy.json (scripts/deploy-manifest.mjs):
 * znacznik wersji i krótki hash każdego nagrania. Przy aktywacji i przy
 * nawigacji online (najwyżej co DEPLOY_CHECK_MS, od razu, gdy świeża strona
 * jest z innego buildu) porównujemy go z kopią zapamiętaną w cache. Nowa
 * wersja = aktualizacja stron i ich plików _next/static (syncBuild: najpierw
 * komplet plików, dopiero potem podmiana stron) oraz usunięcie nagrań
 * podmienionych albo skasowanych. Bez tego urządzenie trzymałoby w pamięci na
 * zawsze wersję z pierwszej instalacji.
 *
 * NAGRANIA: element <audio> pyta serwer o fragmenty pliku (nagłówek Range),
 * a GitHub Pages odpowiada wtedy 206 Partial Content — takiej odpowiedzi
 * Cache API nie przyjmuje. Dlatego nagranie pobieramy w całości (200),
 * zapisujemy pod samym adresem i to my wycinamy fragment dla odtwarzacza.
 * HEAD (sprawdzenie, czy nagranie istnieje) odpowiadamy z manifestu, bez
 * sieci i bez pobierania pliku — audyt w panelu rodzica pyta o ponad tysiąc.
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
/** Manifest wdrożenia; jego ostatnia wersja leży w cache pod tym samym adresem. */
const DEPLOY_URL = `${BASE}/deploy.json`;
/**
 * Pliki _next/static poprzedniej wersji, zachowane przy ostatniej
 * aktualizacji. Adres z pathname DEPLOY_URL, więc zapytania strony nigdy go
 * nie dostaną.
 */
const STATIC_LIST_URL = `${DEPLOY_URL}?static`;
/** Nie sprawdzamy wdrożenia częściej — nawigacji bywa kilka na minutę. */
const DEPLOY_CHECK_MS = 5 * 60 * 1000;
/**
 * Kiedy ostatnio udało się sprawdzić wdrożenie — nagłówek zapamiętanego
 * deploy.json, bo zmienne SW znikają, gdy przeglądarka go uśpi (po ok. 30 s).
 */
const CHECKED_HEADER = "X-Checked-At";
/** buildId Next zapamiętanej wersji; świeża strona z innym = nowe wdrożenie. */
const NEXT_BUILD_HEADER = "X-Next-Build";
/** Dłużej nie czekamy na deploy.json (razem z treścią). */
const DEPLOY_FETCH_MS = 5000;
/** Limit na jeden plik przy aktualizacji (strona, chunk), razem z treścią. */
const ASSET_FETCH_MS = 20_000;
/** Tyle plików naraz pobiera aktualizacja. */
const ASSET_PARALLEL = 6;
/** Hash treści zapisanego nagrania — ten sam skrót co w deploy.json. */
const HASH_HEADER = "X-Audio-Hash";
/**
 * Tyle odtwarzacz czeka na nagranie spoza pamięci BEZ żadnych nowych danych
 * (liczone od ostatnich odebranych bajtów, nie od startu). Wolne, ale
 * działające łącze gra nagranie przy pierwszym stuknięciu. Łącze, które wisi,
 * daje po tym czasie błąd (gra synteza), a plik dalej pobiera się w tle na
 * następny raz.
 */
const CLIP_WAIT_MS = 6000;
/** Górna granica pobierania jednego nagrania w tle. */
const CLIP_FETCH_MS = 60_000;

// --- Sieć --------------------------------------------------------------------

/**
 * fetch razem z treścią, w jednym limicie czasu: sam fetch kończy się na
 * nagłówkach, a treść potrafi utknąć. Wynik: { status, headers, buffer }.
 */
async function fetchFull(url, init, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { status: response.status, headers: response.headers, buffer: await response.arrayBuffer() };
  } finally {
    clearTimeout(timer);
  }
}

/** Nagłówki do zapisu: treść jest już rozpakowana, więc bez kodowania i długości z sieci. */
function storedHeaders(headers) {
  const copy = new Headers(headers);
  copy.delete("Content-Encoding");
  copy.delete("Content-Length");
  return copy;
}

function toResponse(full) {
  return new Response(full.buffer, { status: full.status, headers: storedHeaders(full.headers) });
}

function textOf(full) {
  return new TextDecoder().decode(full.buffer);
}

// --- Powłoka -----------------------------------------------------------------

/** Brakujące wpisy powłoki — każdy osobno, żeby jeden błąd nie blokował reszty. */
async function ensureShell() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    APP_SHELL.map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const fresh = await fetchFull(url, { cache: "reload" }, ASSET_FETCH_MS);
        if (fresh.status === 200) await cache.put(url, toResponse(fresh));
      } catch {
        // brak sieci — spróbujemy przy następnej nawigacji
      }
    }),
  );
}

// --- Manifest wdrożenia ------------------------------------------------------

function parseDeploy(data) {
  return data && typeof data.build === "string" && data.audio && typeof data.audio === "object" ? data : null;
}

/** Ostatni znany manifest (undefined = jeszcze nie wczytany z cache). */
let knownDeploy;

async function loadDeploy() {
  if (knownDeploy === undefined) {
    const cached = await caches.match(DEPLOY_URL, { cacheName: CACHE });
    const parsed = cached ? parseDeploy(await cached.json().catch(() => null)) : null;
    // W trakcie odczytu sprawdzenie wdrożenia mogło już ustawić nowszy.
    if (knownDeploy === undefined) knownDeploy = parsed;
  }
  return knownDeploy;
}

async function contentHash(buffer) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 12);
}

/** „audio/facts/7x8.mp3" — nazwa nagrania tak jak w deploy.json. */
function clipName(url) {
  const name = url.pathname.slice(BASE.length + 1);
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** Nagranie do pamięci razem z hashem treści (porównywanym z manifestem). */
async function storeClip(cache, key, buffer, headers) {
  const stored = storedHeaders(headers);
  stored.set(HASH_HEADER, await contentHash(buffer));
  await cache.put(key, new Response(buffer, { status: 200, headers: stored }));
}

/** Usuwa nagrania, których nie ma w manifeście albo których treść się zmieniła. */
async function pruneAudio(cache, audio) {
  const keys = await cache.keys();
  await Promise.all(
    keys.map(async (request) => {
      const url = new URL(request.url);
      if (!url.pathname.startsWith(`${BASE}/audio/`)) return;
      const expected = audio[clipName(url)];
      if (!expected) {
        await cache.delete(request);
        return;
      }
      const response = await cache.match(request);
      if (!response) return;
      let hash = response.headers.get(HASH_HEADER);
      if (!hash) {
        // Zapisane przed wprowadzeniem manifestu — liczymy hash z treści.
        const buffer = await response.arrayBuffer();
        hash = await contentHash(buffer);
        if (hash === expected) await storeClip(cache, request.url, buffer, response.headers);
      }
      if (hash !== expected) await cache.delete(request);
    }),
  );
}

/** Adresy plików _next/static wskazanych w tekście (HTML, dane RSC, JS, CSS). */
function staticRefs(text) {
  const refs = new Set();
  for (const match of text.matchAll(/static\/[A-Za-z0-9_-]+\/[A-Za-z0-9._~/-]+/g)) {
    refs.add(`${BASE}/_next/${match[0]}`);
  }
  // Czcionki w CSS: url(../media/…).
  for (const match of text.matchAll(/\.\.\/media\/[A-Za-z0-9._~-]+/g)) {
    refs.add(`${BASE}/_next/static/media/${match[0].slice("../media/".length)}`);
  }
  return refs;
}

/** Identyfikator buildu Next („b" w danych strony). */
function buildIdOf(html) {
  const match = /\\?"b\\?":\\?"([A-Za-z0-9_-]{6,})/.exec(html);
  return match ? match[1] : null;
}

/** Strona albo dane RSC (.txt) — to, co wskazuje na pliki konkretnego buildu. */
function isPage(path, response) {
  return (response.headers.get("Content-Type") || "").includes("html") || path.endsWith(".txt");
}

/** `task` dla każdego elementu, po ASSET_PARALLEL naraz; false = coś się nie udało. */
async function allInBatches(items, task) {
  for (let i = 0; i < items.length; i += ASSET_PARALLEL) {
    const results = await Promise.all(items.slice(i, i + ASSET_PARALLEL).map((item) => task(item).catch(() => false)));
    // Pierwsza porażka kończy: przy zerwanym łączu nie ma sensu czekać na resztę.
    if (!results.every(Boolean)) return false;
  }
  return true;
}

/**
 * Udana aktualizacja zrobiona przez install ({ buildId }). Korzysta z niej
 * tylko sprawdzenie przy activate, tuż po install — późniejsze mogą już
 * dotyczyć następnego wdrożenia.
 */
let installSync = null;

/**
 * Aktualizacja do wersji z serwera, w dwóch krokach. Najpierw pobieramy nowe
 * strony powłoki (i odwiedzone strony spoza niej: lekcje, sesje, dane RSC)
 * tylko do pamięci SW, a do cache dopisujemy pliki _next/static, na które
 * wskazują — mają nowe nazwy, więc starej wersji nie przeszkadzają. Dopiero
 * gdy komplet jest na miejscu, podmieniamy strony. Zerwane łącze w połowie =
 * zostaje spójna stara wersja (a następna nawigacja online ponawia), a nie
 * nowy HTML bez swojego JS.
 *
 * Pliki, na które wskazywały podmienione (stare) kopie stron, zostają do
 * następnej aktualizacji: strona podana z pamięci po NETWORK_WAIT_MS może
 * jeszcze doczytywać swoje chunki. Wszystko starsze usuwamy — nazwy zmieniają
 * się przy każdym wdrożeniu, więc bez sprzątania pamięć rosłaby bez końca, a
 * przydział miejsca jest wspólny dla całej domeny.
 * Wynik: { buildId } albo null = nie udało się (niczego nie podmieniono).
 */
async function syncBuild(cache) {
  /** Klucz → nowa wersja albo null (= usunąć, tej strony już nie ma). */
  const staged = new Map();
  const needed = new Set();
  const queue = [];
  const need = (text) => {
    for (const ref of staticRefs(text)) {
      if (needed.has(ref)) continue;
      needed.add(ref);
      queue.push(ref);
    }
  };
  /** Pliki starych kopii stron — zostają jeszcze na jedną wersję. */
  const previous = new Set();
  const previousQueue = [];
  const keepOld = (text) => {
    for (const ref of staticRefs(text)) {
      if (previous.has(ref)) continue;
      previous.add(ref);
      previousQueue.push(ref);
    }
  };
  /** Nowa wersja strony do `staged`; false = nie wiadomo (błąd serwera). */
  const stagePage = async (key, url) => {
    const fresh = await fetchFull(url, { cache: "reload" }, ASSET_FETCH_MS);
    if (fresh.status === 200) {
      staged.set(key, fresh);
      need(textOf(fresh));
      return true;
    }
    // Tej strony nie ma w nowym wdrożeniu — stara kopia tylko by myliła.
    if (fresh.status === 404) {
      staged.set(key, null);
      return true;
    }
    return false;
  };

  if (!(await allInBatches(APP_SHELL, (url) => stagePage(url, url)))) return null;
  const home = staged.get(`${BASE}/`);
  const buildId = home ? buildIdOf(textOf(home)) : null;
  for (const url of APP_SHELL) {
    const old = await cache.match(url);
    if (old) keepOld(await old.text());
  }

  const shell = new Set(APP_SHELL.map((url) => new URL(url, self.location.href).href));
  const keys = await cache.keys();
  // Bez rozpoznanego buildu (zmiana formatu Next) nie ruszamy reszty stron.
  if (buildId) {
    const stale = [];
    for (const request of keys) {
      const url = new URL(request.url);
      const path = url.pathname;
      if (shell.has(url.href) || path === DEPLOY_URL) continue;
      if (path.startsWith(`${BASE}/_next/static/`) || path.startsWith(`${BASE}/audio/`)) continue;
      const response = await cache.match(request);
      if (!response || !isPage(path, response)) continue;
      const text = await response.text();
      // Już z nowego buildu (np. otwarta online po wdrożeniu) — tylko jej pliki.
      if (text.includes(buildId)) {
        need(text);
      } else {
        keepOld(text);
        stale.push(request);
      }
    }
    if (!(await allInBatches(stale, (request) => stagePage(request, request.url)))) return null;
  }

  // Pliki JS/CSS wskazują kolejne (ładowane leniwie, czcionki), więc kolejka
  // rośnie w trakcie; każda runda bierze to, co doszło.
  for (let done = 0; done < queue.length && done < 500; ) {
    const batch = queue.slice(done, Math.min(done + ASSET_PARALLEL, 500));
    done += batch.length;
    const ok = await allInBatches(batch, async (ref) => {
      let response = await cache.match(ref);
      if (!response) {
        const fresh = await fetchFull(ref, {}, ASSET_FETCH_MS);
        // 404 = napis wyglądał na odwołanie, ale takiego pliku nie ma — pomijamy,
        // inaczej jedno fałszywe trafienie blokowałoby aktualizację na zawsze.
        if (fresh.status === 404) return true;
        if (fresh.status !== 200) return false;
        response = toResponse(fresh);
        await cache.put(ref, response.clone());
      }
      if (/\.(js|css)$/.test(ref)) need(await response.text());
      return true;
    });
    if (!ok) return null;
  }

  // Komplet — dopiero teraz podmieniamy strony.
  await Promise.all(
    [...staged].map(([key, fresh]) => (fresh ? cache.put(key, toResponse(fresh)) : cache.delete(key))),
  );

  if (buildId) {
    // Poprzednia wersja przechodnio (leniwe chunki, czcionki) — tylko z pamięci.
    for (let i = 0; i < previousQueue.length && i < 500; i++) {
      const ref = previousQueue[i];
      if (!/\.(js|css)$/.test(ref)) continue;
      const cached = await cache.match(ref);
      if (cached) keepOld(await cached.text());
    }
    // Ta sama wersja drugi raz (np. SW uśpiony między install a activate):
    // stare kopie są już nowe, więc poprzednią bierzemy z listy.
    const listed = await cache.match(STATIC_LIST_URL);
    const list = listed ? await listed.json().catch(() => null) : null;
    if (list && list.build === buildId && Array.isArray(list.previous)) {
      for (const ref of list.previous) previous.add(ref);
    }
    await Promise.all(
      keys
        .filter((request) => {
          const path = new URL(request.url).pathname;
          return path.startsWith(`${BASE}/_next/static/`) && !needed.has(path) && !previous.has(path);
        })
        .map((request) => cache.delete(request)),
    );
    await cache.put(
      STATIC_LIST_URL,
      new Response(JSON.stringify({ build: buildId, previous: [...previous] }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  return { buildId };
}

/** buildId świeżej strony, gdy jest inny niż zapamiętanej wersji; inaczej null. */
async function newBuildOf(cache, html) {
  const fresh = buildIdOf(html);
  if (!fresh) return null;
  const stored = await cache.match(DEPLOY_URL);
  const known = stored?.headers.get(NEXT_BUILD_HEADER);
  return known && known !== fresh ? fresh : null;
}

/**
 * Nieudane albo niepełne sprawdzenie nie zapamiętuje nowej wersji, więc
 * następna nawigacja online próbuje znowu; odstęp DEPLOY_CHECK_MS liczymy
 * tylko od udanego (zapisanego razem z manifestem).
 */
async function runDeployCheck({ force, nextBuild, afterInstall }) {
  const cache = await caches.open(CACHE);
  const stored = await cache.match(DEPLOY_URL);
  // Bez zapamiętanego manifestu (np. sąsiad skasował cache) sprawdzamy od razu.
  const age = Date.now() - (Number(stored?.headers.get(CHECKED_HEADER)) || 0);
  if (!force && stored && age >= 0 && age < DEPLOY_CHECK_MS) return;

  let fresh;
  try {
    fresh = await fetchFull(DEPLOY_URL, { cache: "no-store" }, DEPLOY_FETCH_MS);
  } catch {
    // Brak sieci albo limit czasu — nic nie zmieniamy.
    return;
  }
  if (fresh.status === 404) {
    // Serwer działa, a pliku nie ma (npm run dev, build bez prebuild). Stary
    // manifest mówiłby nieprawdę o nagraniach, więc HEAD wraca do serwera.
    await cache.delete(DEPLOY_URL);
    knownDeploy = null;
    return;
  }
  if (fresh.status !== 200) return;
  const text = textOf(fresh);
  let deploy = null;
  try {
    deploy = parseDeploy(JSON.parse(text));
  } catch {
    return;
  }
  if (!deploy) return;

  const previous = stored ? parseDeploy(await stored.clone().json().catch(() => null)) : null;
  knownDeploy = deploy;
  const remember = (nextBuild) => {
    const headers = { "Content-Type": "application/json", [CHECKED_HEADER]: String(Date.now()) };
    if (nextBuild) headers[NEXT_BUILD_HEADER] = nextBuild;
    return cache.put(DEPLOY_URL, new Response(text, { headers }));
  };
  const knownPages = stored?.headers.get(NEXT_BUILD_HEADER);
  // Ten sam manifest, a strony z innego buildu (np. deploy.json jeszcze stary
  // w CDN) — strony i tak aktualizujemy.
  const pagesChanged = Boolean(nextBuild && knownPages && nextBuild !== knownPages);
  const fromInstall = afterInstall ? installSync : null;
  if (previous && previous.build === deploy.build && !pagesChanged) {
    let pages = fromInstall ? fromInstall.buildId : knownPages;
    if (!pages) {
      const home = await cache.match(`${BASE}/`);
      pages = home ? buildIdOf(await home.text()) : null;
    }
    await remember(pages);
    return;
  }

  // install zaktualizował wszystko przed chwilą — nie powtarzamy.
  const synced = fromInstall ?? (await syncBuild(cache));
  // Nagrania nie zależą od stron: podmienione i skasowane usuwamy także wtedy,
  // gdy strony trzeba będzie dociągnąć przy następnej próbie.
  await pruneAudio(cache, deploy.audio);
  if (synced) await remember(synced.buildId);
}

/** Trwające sprawdzenie: { force, nextBuild, done }. */
let deployCheck = null;

/**
 * Sprawdza, czy na serwerze jest nowe wdrożenie; nigdy nie odrzuca.
 * force = bez odstępu DEPLOY_CHECK_MS; nextBuild = buildId świeżej strony,
 * inny niż zapamiętany; afterInstall = sprawdzenie przy activate.
 */
function checkDeploy({ force = false, nextBuild = null, afterInstall = false } = {}) {
  if (deployCheck && (!force || (deployCheck.force && deployCheck.nextBuild === nextBuild))) return deployCheck.done;
  // Wymuszone w trakcie innego (które mogło odpuścić przez odstęp) — po nim.
  const before = deployCheck ? deployCheck.done : Promise.resolve();
  const entry = { force, nextBuild, done: null };
  entry.done = before
    .then(() => runDeployCheck({ force, nextBuild, afterInstall }))
    .catch(() => undefined)
    .finally(() => {
      if (deployCheck === entry) deployCheck = null;
    });
  deployCheck = entry;
  return entry.done;
}

// --- Cykl życia --------------------------------------------------------------

self.addEventListener("install", (event) => {
  // Nowy SW = nowe wdrożenie: aktualizujemy całą powłokę (bez psucia starej,
  // gdyby się nie udało), a przy pierwszej instalacji uzupełniamy braki.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => syncBuild(cache))
      .then((result) => {
        installSync = result;
      })
      .catch(() => undefined)
      .then(() => ensureShell())
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
      .then(() => self.clients.claim())
      .then(() => {
        // Bez waitUntil: dopóki trwa aktywacja, przeglądarka wstrzymuje
        // zapytania strony (także nagrania). Przerwane sprawdzenie niczego nie
        // psuje (strony podmieniamy dopiero po komplecie plików), a manifest
        // nie zostanie zapamiętany, więc ponowi je następna nawigacja.
        void checkDeploy({ force: true, afterInstall: true }).finally(() => {
          installSync = null;
        });
      }),
  );
});

// --- Nagrania ----------------------------------------------------------------

function audioType(name) {
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".webm")) return "audio/webm";
  if (name.endsWith(".m4a")) return "audio/mp4";
  if (name.endsWith(".ogg")) return "audio/ogg";
  return "audio/mpeg";
}

/**
 * HEAD nagrania. Z manifestem: 200/404 bez sieci. Bez manifestu: prawdziwy
 * HEAD (bez treści, bez zapisu), a offline nagłówki kopii z pamięci.
 */
async function audioHead(cache, key, name) {
  const deploy = await loadDeploy();
  if (deploy) {
    return deploy.audio[name]
      ? new Response(null, { status: 200, headers: { "Content-Type": audioType(name) } })
      : new Response(null, { status: 404 });
  }
  try {
    return await fetch(key, { method: "HEAD", cache: "no-cache" });
  } catch {
    const cached = await cache.match(key);
    return cached ? new Response(null, { status: 200, headers: cached.headers }) : Response.error();
  }
}

/** Trwające pobrania nagrań: jedno na plik, choć odtwarzacz pyta kilka razy. */
const clipDownloads = new Map();

/**
 * Jak fetchFull, ale treść czyta kawałkami i przy nagłówkach oraz każdym
 * kawałku zapisuje `download.lastData` — odtwarzacz czeka, dopóki dane płyną.
 */
async function fetchClip(url, download) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIP_FETCH_MS);
  try {
    const response = await fetch(url, { cache: "no-cache", signal: controller.signal });
    download.lastData = Date.now();
    if (!response.body) return { status: response.status, headers: response.headers, buffer: await response.arrayBuffer() };
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      download.lastData = Date.now();
      chunks.push(value);
      length += value.byteLength;
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { status: response.status, headers: response.headers, buffer: bytes.buffer };
  } finally {
    clearTimeout(timer);
  }
}

/** Pobranie nagrania w tle (z zapisem w pamięci); wspólne dla wszystkich pytań o ten plik. */
function downloadClip(event, cache, key) {
  let download = clipDownloads.get(key);
  if (!download) {
    download = { lastData: Date.now() };
    const fetched = fetchClip(key, download);
    const stored = fetched
      .then((fresh) => (fresh.status === 200 ? storeClip(cache, key, fresh.buffer, fresh.headers) : undefined))
      .catch(() => undefined)
      .finally(() => clipDownloads.delete(key));
    Object.assign(download, { fetched, stored });
    clipDownloads.set(key, download);
  }
  // Zapis w tle — odtwarzacz nie czeka na cache.put.
  event.waitUntil(download.stored);
  return download;
}

/** Nagranie z pamięci (pobrane raz w całości), z obsługą Range. */
async function audioResponse(event, url) {
  const request = event.request;
  const cache = await caches.open(CACHE);
  const key = url.origin + url.pathname;
  if (request.method === "HEAD") return audioHead(cache, key, clipName(url));

  // Najpierw pamięć — o świeżość dba manifest wdrożenia (pruneAudio).
  let full = await cache.match(key);
  if (!full) {
    const download = downloadClip(event, cache, key);
    // Limit liczymy od ostatnich danych, nie od tego stuknięcia: kolejne
    // stuknięcie przy łączu, które już wisi, nie czeka od nowa.
    let timer;
    const stalled = new Promise((resolve) => {
      const check = () => {
        const idle = Date.now() - download.lastData;
        if (idle >= CLIP_WAIT_MS) resolve(null);
        else timer = setTimeout(check, CLIP_WAIT_MS - idle);
      };
      check();
    });
    let fresh;
    try {
      fresh = await Promise.race([download.fetched, stalled]);
    } catch {
      return Response.error();
    } finally {
      clearTimeout(timer);
    }
    if (!fresh) return Response.error();
    if (fresh.status !== 200) return new Response(null, { status: fresh.status });
    full = toResponse(fresh);
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

// --- Zapytania ---------------------------------------------------------------

/** Kopia TEGO SAMEGO adresu; „/tabliczka" i „/tabliczka/" to ta sama strona. */
async function cachedCopy(request) {
  const navigate = request.mode === "navigate";
  const options = { cacheName: CACHE, ignoreSearch: navigate };
  const exact = await caches.match(request, options);
  if (exact || !navigate) return exact;
  const url = new URL(request.url);
  url.pathname = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : `${url.pathname}/`;
  return caches.match(url.href, options);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Tylko własny podkatalog — zapytania innych aplikacji z tej domeny nie są nasze.
  if (!url.pathname.startsWith(`${BASE}/`)) return;
  // deploy.json otwarty w karcie idzie prosto do sieci: zapisany pod
  // DEPLOY_URL udawałby, że nowe wdrożenie jest już przetworzone.
  if (url.pathname === DEPLOY_URL) return;

  if (url.pathname.startsWith(`${BASE}/audio/`) && (request.method === "GET" || request.method === "HEAD")) {
    event.respondWith(audioResponse(event, url));
    return;
  }

  if (request.method !== "GET") return;

  // Pliki z hashem w nazwie: najpierw pamięć (stare usuwa syncBuild).
  if (url.pathname.startsWith(`${BASE}/_next/static`)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { cacheName: CACHE });
        if (cached) return cached;
        const response = await fetch(request);
        if (response.status === 200) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined));
        }
        return response;
      })(),
    );
    return;
  }

  // Nawigacja i reszta: najpierw sieć (świeża wersja), ale gdy w pamięci jest
  // kopia TEGO adresu, czekamy na sieć najwyżej NETWORK_WAIT_MS — przy słabym
  // zasięgu start nie wisi. Strona główna zamiast docelowej tylko przy błędzie
  // sieci: przy wolnym, ale działającym łączu czekamy na właściwą stronę.
  // cache: "no-store", bo GitHub Pages wysyła max-age=600 i zwykły fetch
  // potrafi oddać dziesięciominutową kopię zamiast nowej wersji.
  const network = fetch(request, { cache: "no-store" });
  event.waitUntil(
    network
      .then(async (response) => {
        if (response.status !== 200) return;
        // Klony od razu, przed pierwszym await: gdy nie ma kopii w pamięci,
        // respondWith dostaje oryginał, a przeglądarka blokuje jego treść w
        // chwili odpowiedzi — późniejsze clone() rzuca „body is already used".
        const copy = response.clone();
        const peek = request.mode === "navigate" ? response.clone() : null;
        const cache = await caches.open(CACHE);
        if (!peek) {
          await cache.put(request, copy);
          return;
        }
        // Strona z innego buildu = właśnie było wdrożenie; sprawdzamy od razu,
        // bez czekania DEPLOY_CHECK_MS (inaczej HEAD mówiłby wg starego manifestu).
        const nextBuild = await newBuildOf(cache, await peek.text());
        // Starą kopię takiej strony podmieni syncBuild razem z jej plikami —
        // zapisana teraz, przy zerwanym łączu zostałaby offline bez swojego JS.
        if (!nextBuild || !(await cache.match(request))) await cache.put(request, copy);
        // Osobno: wiszące sprawdzenie nie może blokować samonaprawy powłoki.
        await Promise.all([checkDeploy({ force: Boolean(nextBuild), nextBuild }), ensureShell().catch(() => undefined)]);
      })
      .catch(() => undefined),
  );
  event.respondWith(
    (async () => {
      const cached = await cachedCopy(request);
      if (cached) {
        const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_WAIT_MS));
        return Promise.race([network.then((response) => response.clone()).catch(() => cached), timeout]);
      }
      try {
        return await network;
      } catch {
        const home = request.mode === "navigate" ? await caches.match(`${BASE}/`, { cacheName: CACHE }) : undefined;
        return home ?? Response.error();
      }
    })(),
  );
});
