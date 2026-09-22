"use client";

/**
 * Rola urządzenia wg briefu:
 *  - telefon  → krótkie sesje "na już", jeden element na ekranie,
 *  - tablet   → główne środowisko nauki, duże cele dotykowe,
 *  - komputer → tryb rodzica: raporty, podgląd programu, wskazówki obok sesji.
 *
 * To NIE jest tylko przeskalowanie: układ ekranów faktycznie się zmienia, więc
 * potrzebujemy roli w JS, nie samych breakpointów w CSS.
 *
 * Rozróżnienie tablet/komputer opiera się na rodzaju wskaźnika (palec vs mysz),
 * bo sama szerokość myli — tablet w poziomie bywa szerszy niż okno na laptopie.
 */

import { useEffect, useState } from "react";
import type { DeviceRole } from "@/lib/progress/types";

const PHONE_MAX = 700;
const TABLET_MAX = 1180;

function detect(): DeviceRole {
  const width = window.innerWidth;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  if (width <= PHONE_MAX) return "phone";
  if (width <= TABLET_MAX || coarsePointer) return "tablet";
  return "desktop";
}

export function useDeviceRole(): { role: DeviceRole; mounted: boolean } {
  // Zanim komponent się zamontuje, zakładamy tablet — to główne środowisko
  // nauki, więc ewentualny błysk niewłaściwego układu jest najmniej szkodliwy.
  const [role, setRole] = useState<DeviceRole>("tablet");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRole(detect());
    setMounted(true);

    function refresh() {
      setRole(detect());
    }

    // Część przeglądarek (i webview na iOS) podaje przy starcie wymiary sprzed
    // ustawienia paska adresu. Druga próba po pierwszym malowaniu to tania
    // polisa na złe rozpoznanie urządzenia.
    const secondLook = setTimeout(refresh, 250);

    // Obrót tabletu zgłasza się przez matchMedia pewniej niż przez "resize",
    // ale resize też łapiemy — okno na laptopie zmienia się płynnie.
    const queries = [
      window.matchMedia(`(max-width: ${PHONE_MAX}px)`),
      window.matchMedia(`(max-width: ${TABLET_MAX}px)`),
      window.matchMedia("(pointer: coarse)"),
    ];
    queries.forEach((query) => query.addEventListener("change", refresh));
    window.addEventListener("resize", refresh);

    return () => {
      clearTimeout(secondLook);
      queries.forEach((query) => query.removeEventListener("change", refresh));
      window.removeEventListener("resize", refresh);
    };
  }, []);

  return { role, mounted };
}
