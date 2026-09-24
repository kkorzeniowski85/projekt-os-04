/**
 * Akademia Ligi jest teraz działem Ligi (projekt-os-02).
 *
 * Ten plik zastępuje dawny service worker Akademii na urządzeniach, które go
 * mają: przy aktywacji kasuje WYŁĄCZNIE własną pamięć podręczną (przedrostek
 * akademia-ligi- — domenę dzielimy z innymi aplikacjami), wyrejestrowuje się
 * i przenosi otwarte karty na ten sam adres w Lidze. Bez obsługi fetch:
 * zapytania idą prosto do sieci, gdzie czeka strona przekierowania.
 * Dane dziecka (localStorage school.*) zostają nietknięte — czyta je Liga.
 */

const FROM = "/projekt-os-04/";
const TO = "/projekt-os-02/";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("akademia-ligi-")).map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        const url = new URL(client.url);
        if (!url.pathname.startsWith(FROM)) continue;
        url.pathname = TO + url.pathname.slice(FROM.length);
        client.navigate(url.href).catch(() => undefined);
      }
    })(),
  );
});
