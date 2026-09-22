# Akademia Ligi

Druga aplikacja dla dziecka, obok Ligi Dźwięków (`../angielski`). Liga uczy
składania liter w słowa (phonics); Akademia przygotowuje do reszty tego, czego
angielska szkoła wymaga od pierwszego dnia:

| Dział | Bohater | Co ćwiczy |
| --- | --- | --- |
| Tabliczka | SPEED | 66 faktów 2–12 pod **Multiplication Tables Check** (Year 4, czerwiec 2028): codzienny trening z pudełkami Leitnera, lekcje „Liczymy co N”, wierny próbny test (25 pytań, 6 s) |
| Matematyka po angielsku | SPARK | liczby ze słuchu (-teen/-ty, „and” w setkach), słowa działań, zadania z treścią, zegar, zapis inny niż w Polsce |
| Czytanie | GLEAM | 8 tekstów na 3 poziomach, najpierw słuchanie; pytania w formatach Tick one / Find and copy / True or false / Number the events |
| Język klasy | THUNDER | polecenia nauczyciela, rutyny lekcji, polecenia na kartce (Tick, Circle, Show your working…) |

Publikacja: https://kkorzeniowski85.github.io/projekt-os-04/

## Uruchomienie

```bash
npm install
```

```bash
npm run dev -- --port 3001
```

Nagrania (brytyjski głos en-GB-Sonia; tylko brakujące pliki):

```bash
npm run audio
```

Audyt treści przed publikacją (zestawy MTC, nagrania dla każdego zdania,
odpowiedzi „Find and copy” obecne w tekście):

```bash
npm run audit
```

## Gdzie co jest

- `lib/curriculum/` — treść: tabliczka i zasady MTC, matematyka, czytanki, język klasy.
- `lib/tables/` — silnik nauki tabliczki (pudełka, dobór faktów) i budowa sesji.
- `lib/session/exercise.ts` + `components/session/` — wspólny silnik ćwiczeń.
- `lib/progress/` — postęp, reguły, scalanie, synchronizacja, raport dla Claude.
- `docs/decyzje.md` — dlaczego tak, a nie inaczej (w tym fakty o MTC ze źródłami).

Format i zasady wspólne z Ligą: [../KONWENCJE.md](../KONWENCJE.md).
