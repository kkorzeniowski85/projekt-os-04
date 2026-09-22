/**
 * Postać rysowana w SVG — skaluje się na każdy ekran i nie wymaga ładowania
 * grafik (ważne dla trybu offline i szybkiego startu na telefonie).
 *
 * To celowo prosty placeholder o oryginalnym designie: maska, peleryna, znak na
 * piersi. Docelowo do zastąpienia ilustracjami wymyślonymi razem z dzieckiem.
 */

import type { Hero } from "@/lib/heroes";

type Props = {
  hero: Hero;
  /** Znak na piersi — zwykle grafem aktualnego dźwięku. */
  emblem?: string;
  size?: number;
  dimmed?: boolean;
  cheering?: boolean;
};

export function HeroAvatar({ hero, emblem, size = 160, dimmed = false, cheering = false }: Props) {
  const label = emblem ?? hero.emblem ?? hero.codename.slice(0, 2);

  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      role="img"
      aria-label={`Postać ${hero.codename}`}
      className={cheering ? "animate-cheer" : undefined}
      style={{ opacity: dimmed ? 0.35 : 1 }}
    >
      {/* peleryna */}
      <path
        d="M60 42 L104 74 L96 128 L60 108 L24 128 L16 74 Z"
        fill={hero.colors.cape}
        opacity={0.9}
      />
      {/* tors */}
      <path
        d="M60 44 L92 62 L86 120 Q60 132 34 120 L28 62 Z"
        fill={hero.colors.suit}
      />
      {/* znak na piersi */}
      <circle cx="60" cy="86" r="20" fill={hero.colors.accent} />
      <text
        x="60"
        y="86"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={label.length > 2 ? 15 : 19}
        fontWeight="bold"
        fill="#10163a"
        className="font-reading"
      >
        {label}
      </text>
      {/* głowa */}
      <circle cx="60" cy="28" r="22" fill="#ffd9b8" />
      {/* maska */}
      <path
        d="M38 24 Q60 12 82 24 L82 34 Q60 40 38 34 Z"
        fill={hero.colors.suit}
      />
      <circle cx="50" cy="29" r="4.5" fill="#ffffff" />
      <circle cx="70" cy="29" r="4.5" fill="#ffffff" />
      <circle cx="50" cy="29" r="2" fill="#10163a" />
      <circle cx="70" cy="29" r="2" fill="#10163a" />
      {/* uśmiech */}
      <path
        d="M50 40 Q60 48 70 40"
        stroke="#10163a"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
