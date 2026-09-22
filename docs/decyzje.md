# Akademia Ligi — decyzje projektowe

Druga aplikacja dla dziecka, obok Ligi Dźwięków. Liga uczy **składania liter w
słowa** (phonics) i słownictwa; Akademia przygotowuje do tego, czego angielska
szkoła wymaga od pierwszego dnia **poza** phonics.

## Punkt wyjścia (wrzesień 2026)

- Dziecko zaczyna szkołę w Anglii we wrześniu 2027 → **Year 4**.
- W czerwcu Year 4 (u nas: **czerwiec 2028**) jest państwowy
  **Multiplication Tables Check (MTC)**.
- Trzy obszary z briefu rodzica: czytanie ze zrozumieniem, język klasy,
  matematyka po angielsku — plus tabliczka pod MTC.

## Najważniejsze spostrzeżenie: to nie jest tylko problem językowy

Angielskie dzieci zaczynają szkołę rok wcześniej (Reception w wieku 4 lat) i
tabliczkę mnożenia ćwiczą od Year 2 (×2, ×5, ×10), przez Year 3 (×3, ×4, ×8),
do Year 4 (×6, ×7, ×9, ×11, ×12). Polska szkoła wprowadza mnożenie później i
tylko do 10 × 10. Dziecko przychodzące do Year 4 z polskiej klasy 1–2 może być
**w tyle z samym mnożeniem**, niezależnie od angielskiego — a tabliczek ×11 i
×12 nie zna na pewno.

Stąd moduł tabliczki zaczyna od **pojęcia** (grupy, „lots of", liczenie
skokami), a nie od wkuwania, i ma prowadzić przez wszystkie tabliczki w
kolejności angielskiej szkoły.

## MTC — fakty z oficjalnych dokumentów STA

Źródło: *Multiplication tables check assessment framework* (STA, obowiązuje od
2021/22; w 2026/27 bez zmian) oraz informacja dla rodziców na gov.uk.

- 25 pytań w formacie `n1 × n2 =`, każde warte 1 punkt, **6 sekund** na
  odpowiedź, po odpowiedzi **3 sekundy** przerwy; wcześniej **3 pytania
  próbne**. Całość ok. 5 minut.
- Pytania z **121 działań tabliczek 2–12**; tabliczki ×1 nie ma.
- Limity pytań z tabliczki (wg pierwszego czynnika): ×2 0–2, ×3 1–3, ×4 1–3,
  ×5 1–3, ×6 2–4, ×7 2–4, ×8 2–4, ×9 2–4, ×10 0–2, ×11 1–3, ×12 2–4 — nacisk na
  6, 7, 8, 9 i 12 jako najtrudniejsze. Drugi czynnik pilnowany w granicach ±1.
- KS1 (tabliczki 2, 5, 10): 3–7 pytań; KS2: 18–22.
- Żadne pytanie nie powtarza się w zestawie, a odwrócona para (3 × 8 i 8 × 3)
  nie pojawia się razem.
- Odpowiedź z klawiatury albo z ekranowej klawiatury numerycznej; Enter albo
  koniec czasu zatwierdza.
- **Nie ma progu zaliczenia.** Szkoła dostaje wynik na 25; rodzic też.
- Wyniki krajowe 2024/25: średnio **21,0/25**, 37% dzieci ma komplet. Dzieci z
  innym językiem ojczystym niż angielski wypadają średnio **lepiej** (22,0 vs
  20,7) — test jest czysto liczbowy, język nie przeszkadza.

Próbny test w aplikacji odtwarza te zasady wiernie (generator zestawów
przestrzega limitów z ramy). Nauka (trening) celowo NIE jest tak surowa: nie
ucina czasu po 6 s, tylko mierzy, czy odpowiedź przyszła szybko.

## Model nauki tabliczki

- **Fakt = nieuporządkowana para** (7 × 8 i 8 × 7 to jeden fakt): 66 faktów
  zamiast 121. Przemienność jest częścią nauki, a w treningu fakt pokazuje się
  w obu kolejnościach.
- **Pudełka Leitnera 0–5** z odstępami 0 / 1 / 3 / 7 / 21 dni. Poprawnie i
  szybko (≤ 3,5 s) → pudełko wyżej; poprawnie, ale wolno → bez awansu; błąd →
  pudełko 1. „Płynnie" = pudełko 4+.
- Fakt „wchodzi" do nauki razem z pierwszą tabliczką, która go zawiera, w
  kolejności angielskiej szkoły: 2, 10, 5, 3, 4, 8, 11, 6, 9, 7, 12. Dzięki
  przemienności każda kolejna tabliczka wnosi mniej nowego: ×2 — 11 faktów,
  ×12 na końcu — już tylko 12 × 12.
- Próbny test tylko **obniża** pudełka (ujawnia słabe miejsca), nie podnosi —
  awans jest za regularny trening, nie za jedno trafienie.

## Pozostałe decyzje

- **Osobna aplikacja** w tym samym formacie co Liga (KONWENCJE.md): kod
  skopiowany, nie współdzielony; repozytorium `projekt-os-04`.
- **Wspólna domena z Ligą** (`kkorzeniowski85.github.io`) oznacza wspólny
  localStorage i wspólną pamięć podręczną przeglądarki. Dlatego:
  - wszystkie klucze Akademii mają przedrostek `school.`;
  - service worker kasuje tylko **własne** stare cache (przedrostek
    `akademia-ligi-`), nigdy cudze;
  - synchronizacja **przejmuje kod rodziny z Ligi**, jeśli Liga jest na tym
    urządzeniu sparowana — zero dodatkowego parowania. To jedyne świadome
    powiązanie obu aplikacji (jedna funkcja w `lib/progress/sync.ts`).
- **Język klasy** ma w Akademii pełny dział (THUNDER), mimo że podstawowe
  polecenia są też w Lidze Dźwięków (tor 2, „Co mówi nauczyciel"). Powód:
  rodzic wprost wskazał go jako jedną z trzech rzeczy potrzebnych od pierwszego
  dnia. Część się powtarza celowo (utrwalenie), a dochodzi poziom Year 4:
  rutyny lekcji (trays, whiteboards, talk partners, data i temat podkreślone
  linijką) i **polecenia na kartce** (Tick, Circle, Underline, Cross out, Show
  your working, Estimate…). Polecenia „w ruchu" ocenia rodzic — aplikacja nie
  słucha dziecka. Zwroty, które dziecko samo MÓWI („Can I go to the toilet,
  please?"), zostają w Lidze („Ratunek!").
- **Matematyka po angielsku** uczy języka, nie matematyki od zera: liczby ze
  słuchu (-teen/-ty, „and" w setkach), słowa działań, zadania z treścią,
  zegar (pułapka „half past three" = „wpół do czwartej") i zapis inny niż w
  Polsce (2.5, 2,500, ÷, £ i p).
- **Wspólny silnik ćwiczeń** (lib/session/exercise.ts + components/session):
  dział tylko buduje listę ćwiczeń. Zasady z Ligi obowiązują wszędzie tak
  samo — liczy się pierwsza odpowiedź, po błędzie bramka naprawy, wyjaśnienie
  czeka na „Dalej", cofanie to powtórka bez ponownego punktowania, runda
  bonusowa, przerwanie z zapisem albo bez.
- **Czytanie ze zrozumieniem** zaczyna się od słuchania (Simple View of
  Reading: rozumienie = dekodowanie × rozumienie języka). Dziecko, które
  dopiero uczy się dekodować, ćwiczy rozumienie uchem; teksty stopniowo
  przechodzą w czytanie samodzielne. Pytania w formatach z angielskiej szkoły:
  *Tick one*, *Find and copy*, *True or false*, *Number the events*.
- Wszystkie nagrania: brytyjski głos neuronowy (en-GB-Sonia), jak w Lidze.
