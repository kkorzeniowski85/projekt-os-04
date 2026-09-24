"use client";

/**
 * Rejestracja service workera = instalowalna PWA + działanie bez internetu.
 *
 * Bez powiadomień push — nie ma po co prosić dziecko o zgody, których nie
 * potrzebujemy.
 */

import { useEffect } from "react";
import { isBusy } from "@/lib/sessionBusy";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Nowa wersja instaluje się w tle (skipWaiting w sw.js), ale karta albo
    // PWA wznowiona z tła dalej pokazuje stary kod. Po zmianie kontrolera
    // przeładowujemy raz — ale:
    //  - nie przy PIERWSZEJ instalacji (kontroler null → SW): strona ma już
    //    aktualny kod, a przeładowanie zgubiłoby rozpoczętą sesję;
    //  - tylko gdy aplikacja zejdzie z ekranu — i to nie w trakcie ćwiczenia
    //    ani próbnego testu (lib/sessionBusy.ts). Przeładowanie w tle nie
    //    zgubiłoby odpowiedzi (sesja zapisuje się przy pagehide), ale dziecko
    //    wróciłoby na ekran startowy zamiast do swojego zadania, a wstrzymany
    //    test zniknąłby w całości. Czeka więc na pierwsze zejście z ekranu
    //    po skończonym ćwiczeniu.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let pending = false;
    let reloaded = false;
    const reloadWhenHidden = () => {
      if (!pending || reloaded || document.visibilityState !== "hidden") return;
      if (isBusy()) return;
      reloaded = true;
      window.location.reload();
    };
    const onControllerChange = () => {
      if (!hadController) return;
      pending = true;
      reloadWhenHidden();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", reloadWhenHidden);

    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    let timer: ReturnType<typeof setInterval> | undefined;
    navigator.serviceWorker
      .register(`${base}/sw.js`, { scope: `${base}/` })
      .then((registration) => {
        // Nowa wersja aplikacji ma się pojawić bez ręcznego czyszczenia cache —
        // sprawdzamy przy każdym uruchomieniu i raz na godzinę przy dłuższym.
        void registration.update();
        timer = setInterval(() => void registration.update(), 60 * 60 * 1000);
      })
      .catch(() => {
        // Brak SW to nie powód do psucia aplikacji — działa dalej online.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", reloadWhenHidden);
      if (timer) clearInterval(timer);
    };
  }, []);

  return null;
}
