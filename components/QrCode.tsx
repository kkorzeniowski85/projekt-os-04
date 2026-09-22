"use client";

/**
 * Kod QR — sposób na przeniesienie linku parowania z ekranu na ekran.
 *
 * Po co w ogóle: skopiowanie linku na komputerze jest bezużyteczne, jeśli nie
 * ma jak go wkleić na tablecie. Aparat tabletu rozwiązuje to bez pisania,
 * wklejania i wysyłania sobie wiadomości.
 *
 * Rysujemy SVG, a nie canvas: skaluje się bez rozmycia, działa przy druku i
 * nie wymaga czekania na klatkę. Białe tło i margines (cicha strefa) są
 * konieczne — czytniki gubią kod narysowany wprost na ciemnym tle.
 */

import qrcode from "qrcode-generator";
import { useMemo } from "react";

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const sciezka = useMemo(() => {
    // 0 = sam dobierz najmniejszą wersję mieszczącą dane.
    // "M" = korekcja błędów ~15%: wystarcza na odblask i palce na ekranie,
    // a nie rozdmuchuje kodu tak jak wyższe poziomy.
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    const kawalki: string[] = [];
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (qr.isDark(y, x)) kawalki.push(`M${x} ${y}h1v1h-1z`);
      }
    }
    return { d: kawalki.join(""), count };
  }, [value]);

  const margines = 4; // cicha strefa wymagana przez standard
  const bok = sciezka.count + margines * 2;

  return (
    <svg
      viewBox={`0 0 ${bok} ${bok}`}
      width={size}
      height={size}
      role="img"
      aria-label="Kod QR do sparowania urządzenia"
      className="rounded-xl bg-white p-1"
      shapeRendering="crispEdges"
    >
      <rect width={bok} height={bok} fill="#fff" />
      <g transform={`translate(${margines} ${margines})`} fill="#000">
        <path d={sciezka.d} />
      </g>
    </svg>
  );
}
