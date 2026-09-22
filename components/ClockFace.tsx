/**
 * Tarcza zegara wskazówkowego. W angielskiej szkole godziny czyta się
 * głównie z tarczy („half past three", „quarter to four"), a Year 3–4 uczy
 * zegara wskazówkowego i cyfr rzymskich na tarczy.
 *
 * SVG: ostre na każdym ekranie, bez plików graficznych, działa offline.
 */

export function ClockFace({
  hour,
  minute,
  size = 180,
  highlight = false,
}: {
  hour: number;
  minute: number;
  size?: number;
  highlight?: boolean;
}) {
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const minuteAngle = minute * 6;
  const label = `Zegar pokazuje ${hour}:${String(minute).padStart(2, "0")}`;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label}>
      <circle
        cx="100"
        cy="100"
        r="94"
        fill="#f5f7ff"
        stroke={highlight ? "#7bed6b" : "#2f6bff"}
        strokeWidth={highlight ? 10 : 8}
      />
      {Array.from({ length: 60 }, (_, i) => {
        const angle = (i * 6 * Math.PI) / 180;
        const major = i % 5 === 0;
        const inner = major ? 76 : 82;
        return (
          <line
            key={i}
            x1={100 + inner * Math.sin(angle)}
            y1={100 - inner * Math.cos(angle)}
            x2={100 + 88 * Math.sin(angle)}
            y2={100 - 88 * Math.cos(angle)}
            stroke="#10163a"
            strokeWidth={major ? 3 : 1}
            opacity={major ? 0.9 : 0.35}
          />
        );
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const angle = (n * 30 * Math.PI) / 180;
        return (
          <text
            key={n}
            x={100 + 62 * Math.sin(angle)}
            y={100 - 62 * Math.cos(angle)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="17"
            fontWeight="bold"
            fill="#10163a"
          >
            {n}
          </text>
        );
      })}
      {/* wskazówka godzinowa: krótka i gruba */}
      <line
        x1="100"
        y1="100"
        x2={100 + 42 * Math.sin((hourAngle * Math.PI) / 180)}
        y2={100 - 42 * Math.cos((hourAngle * Math.PI) / 180)}
        stroke="#10163a"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* wskazówka minutowa: długa i cienka */}
      <line
        x1="100"
        y1="100"
        x2={100 + 72 * Math.sin((minuteAngle * Math.PI) / 180)}
        y2={100 - 72 * Math.cos((minuteAngle * Math.PI) / 180)}
        stroke="#e33d5a"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <circle cx="100" cy="100" r="6" fill="#10163a" />
    </svg>
  );
}
