/**
 * Nazwa pliku nagrania z dowolnego tekstu: małe litery, bez znaków
 * przestankowych, spacje jako myślniki. „How many are left?" →
 * „how-many-are-left".
 *
 * Tę samą funkcję wołają aplikacja i generator nagrań
 * (scripts/generate-audio.mjs) — inaczej aplikacja szukałaby innych nazw, niż
 * generator zapisał. Dlatego plik nie importuje niczego: Node wczytuje go
 * poza przeglądarką.
 *
 * Długie zdania (czytanki, zadania z treścią) dostają skróconą nazwę z haszem
 * całego tekstu. Pełna nazwa z dwudziestu słów byłaby nieczytelna i zbliżała
 * się do limitu długości ścieżki w Windows; hasz pilnuje, żeby dwa zdania o
 * tym samym początku nie trafiły do jednego pliku.
 */
export function audioSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= 72) return slug;
  return `${slug.slice(0, 56).replace(/-+$/, "")}-${fnv1a(text)}`;
}

/** FNV-1a (32 bity) — ten sam wynik w Node i w przeglądarce. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
