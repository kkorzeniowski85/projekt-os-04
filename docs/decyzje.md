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
- **Pudełka Leitnera 0–5** z odstępami 0 / 0 / 1 / 3 / 7 / 21 dni. Awans
  **tylko za powtórkę w terminie** (z tolerancją pół dnia, ale najwcześniej od
  północy UTC dnia terminu — trening rano i wieczorem tego samego dnia to nie
  „po dniu"; północ UTC, bo scalanie z kilku urządzeń odtwarza stan z prób i
  wynik nie może zależeć od strefy czasowej): poprawnie i szybko
  (≤ 3,5 s) → pudełko wyżej; poprawnie, ale wolno → bez awansu; trafienie przed
  terminem (druga tura tej samej sesji, fakty „dla pewności siebie") nie rusza
  ani pudełka, ani terminu. Błąd → pudełko 1 zawsze. Fakt płynny odpowiedziany
  wolno spada do pudełka 3. „Płynnie" = pudełko 4+, czyli co najmniej trzy
  szybkie trafienia w powtórkach rozłożonych na dni (pierwszy trening, po
  dniu, po trzech dniach). Wcześniejsza wersja awansowała przy każdym
  szybkim trafieniu i fakt był „płynny" po jednym pięciominutowym treningu
  (wyszło w przeglądzie, 23.09.2026).
- W jednym treningu każdy fakt najwyżej dwa razy i nigdy dwa razy pod rząd.
  Nowe fakty czekają, gdy zaległych powtórek jest tyle, ile mieści sesja.
  Bramka (słabe, zaległe) liczy się zawsze z całego stanu, także w treningu
  jednej tabliczki wybranym przez rodzica — ten ma tylko podłogę 6 różnych
  faktów (≥ 12 pytań). Wcześniej bramka liczona w obrębie tabliczki zawsze
  widziała „start nauki" i dokładała 8 nowych faktów naraz.
- Fakt „wchodzi" do nauki razem z pierwszą tabliczką, która go zawiera, w
  kolejności angielskiej szkoły: 2, 10, 5, 3, 4, 8, 11, 6, 9, 7, 12. Dzięki
  przemienności każda kolejna tabliczka wnosi mniej nowego: ×2 — 11 faktów,
  ×12 na końcu — już tylko 12 × 12. „Plan dnia" wprowadza nowe fakty tylko z
  jednej tabliczki (focusTable) i nie przeskakuje na następną w połowie
  treningu. Bez lekcji „Liczymy co N" nowe fakty tej tabliczki wchodzą
  najwyżej w pierwszym treningu dnia: trening, który dziś skończył poprzednią
  tabliczkę, nie zaczyna następnej tego samego dnia — kolejne treningi
  („Jeszcze raz" na ekranie nagrody, wieczorny) robią same powtórki, a ekran
  treningu (przed i po) proponuje lekcję z linkiem. Następnego dnia misja
  stawia tę lekcję jako krok 1, a pierwszy trening dnia wprowadza fakty także
  bez niej, więc nauka nie staje, gdy lekcja jest pomijana. Misja zmienia
  dzisiejszą zrobioną lekcję na inną tylko przed dzisiejszym treningiem (gdy
  ten wprowadziłby fakty tabliczki bez lekcji); po treningu zostaje ✅ ostatnia
  zrobiona dziś lekcja, więc misja wykonana z lekcją nie wraca do
  niewykonanej. Zaległe lekcje wcześniejszych tabliczek (ich fakty już
  weszły) czekają do jutra — jedna lekcja dziennie domyka misję. Symulacja
  dzień po dniu (30 przebiegów × 240 dni, dwa treningi dziennie w 20% dni,
  „Jeszcze raz" po 25% treningów, próbne testy, też z treningiem jednej
  tabliczki): 0 faktów przed lekcją i przed jej propozycją, 1 lekcja dziennie
  z misji. Wcześniej „Jeszcze raz" po treningu, który skończył tabliczkę, od
  razu wprowadzał fakty następnej (ta sama symulacja bez tej zasady: 57
  faktów przed lekcją), a misja przy dwóch treningach dziennie żądała
  kolejnej lekcji po każdym (w końcówce ×9, ×7, ×12 — 3 lekcje jednego dnia).
- Próbny test tylko **obniża** pudełka (ujawnia słabe miejsca), nie podnosi i
  nie odsuwa terminów (fakt płynny, który wyszedł wolno, spada do pudełka 3 i
  dostaje bliższy z dwóch terminów: dotychczasowy albo za 3 dni) — awans
  jest za regularny trening, nie za jedno trafienie. Test **nie wprowadza** faktów z pudełka 0: błąd zostaje w
  licznikach (raport go pokazuje), a fakt dojdzie ze swoją tabliczką i lekcją.
  Wcześniej test na starcie wrzucał kilkanaście faktów ×6–×12 do pudełka 1 i
  zatrzymywał plan. Karta w tle wstrzymuje test (inaczej toczyłby się w ukryciu i
  zapisał fałszywy wynik), a w trakcie testu aktualizacja aplikacji nie
  przeładowuje strony.
- **Ekrany dziecka bez przypomnień o przeprowadzce** (prośba rodzica): żadnych
  dat, odliczania, „jak w szkole", „w angielskiej szkole", Year N ani czerwca
  w tekstach, które widzi dziecko (treść ekranów, wyjaśnienia po odpowiedzi,
  huby, wynik testu). W zwrotach o szkole i lekcji w Anglii zamiast „w
  Anglii" — „po angielsku". Plan z datami i kontekst szkolny tylko w panelu
  rodzica i ramkach dla rodzica (ParentTip, parentPl, parentIntroPl).
  Wyjątki: czytanki, których TEMATEM jest szkoła, oraz treść merytoryczna o
  realiach i zapisie w UK („Zapis jak w Anglii", „W Anglii ułamek dziesiętny
  zapisuje się z kropką…", „Brytyjczycy mówią…", „Anglik liczy…") — zostają,
  bo uczą różnic w zapisie, a nie przypominają o terminie; bez dat, odliczania
  i presji. Ostateczne brzmienie tych tekstów do decyzji rodzica.

## Pozostałe decyzje

- **Osobna aplikacja** w tym samym formacie co Liga (KONWENCJE.md): kod
  skopiowany, nie współdzielony; repozytorium `projekt-os-04`.
- **Wspólna domena z Ligą** (`kkorzeniowski85.github.io`) oznacza wspólny
  localStorage i wspólną pamięć podręczną przeglądarki. Dlatego:
  - wszystkie klucze Akademii mają przedrostek `school.`;
  - service worker kasuje tylko **własne** stare cache (przedrostek
    `akademia-ligi-`), nigdy cudze;
  - synchronizacja **przejmuje kod rodziny z Ligi**, jeśli Liga jest na tym
    urządzeniu sparowana — zero dodatkowego parowania — i idzie za Ligą, gdy
    tam zmieni się obieg (sprawdza przed każdym obiegiem synchronizacji i po
    zdarzeniu `storage` klucza Ligi, więc także w otwartej karcie). Urządzenia
    podłączone kodem z Akademii (QR, krótki kod — np. komputer bez Ligi) nie
    widzą tej zmiany i zostają na starym kodzie; dlatego po zmianie kodu (za
    Ligą albo przyciskiem „Użyj kodu z Ligi") panel rodzica trzyma notkę z
    przyciskiem „Pokaż krótki kod", dopóki rodzic jej nie ukryje. Protokół
    skrzynki się nie zmienił (bez przekierowań w starej skrzynce). Jawne
    „Wyłącz" w Akademii jest zapamiętywane (`optOut`), nie jest nadpisywane i
    panel mówi wprost, że Akademia sama się nie włączy. Kodu Ligi Akademia
    tylko CZYTA;
  - krótki kod to jednorazowa przekazka ważna godzinę: po użyciu Akademia
    czyści swoją szufladę (szuflad Ligi nie rusza). Godzinę pilnuje
    urządzenie, które kod pokazało: panel pokazuje go tylko dla bieżącego
    kodu rodziny i najwyżej godzinę, a potem (i przy „Nowy kod", „Wyłącz",
    zmianie kodu) czyści szufladę. Urządzenie, które kod wpisuje, odrzuca
    dopiero przekazki starsze o ponad dobę — porównuje czas przekazki z
    własnym zegarem, a komputer z dwoma systemami potrafi mieć zegar
    przesunięty o całą strefę (przy ścisłej godzinie nigdy by się nie
    podłączył, a każdy wpisany kod by przepadał);
  - service worker sam uzupełnia swoją powłokę offline po każdej nawigacji
    online — starsze aplikacje na tej domenie potrafią skasować cały
    CacheStorage;
  - nagrania trafiają do pamięci offline w całości (odtwarzacz dostaje
    wycinek 206 z pamięci) — Cache API nie przyjmuje odpowiedzi 206, więc
    wcześniej offline nie grało żadne nagranie (dotyczyło też Ligi);
  - build zapisuje `public/deploy.json` (`scripts/deploy-manifest.mjs`,
    `prebuild`): znacznik wersji i hash każdego nagrania. Service worker
    sprawdza go przy aktywacji i przy nawigacji online (najwyżej co 5 min od
    ostatniego udanego sprawdzenia, ale od razu, gdy świeża strona jest z
    innego buildu niż zapamiętany; przerwane, np. przez zerwane wifi,
    ponawia się przy następnej nawigacji online).
    Po nowym wdrożeniu najpierw pobiera nowe strony (powłokę i odwiedzone
    lekcje, np. `/matematyka/<temat>/`) i dociąga ich pliki `_next/static`, a
    strony w pamięci podmienia dopiero, gdy ma komplet — zerwane łącze w
    połowie zostawia starą, działającą offline wersję, a nie nowy HTML bez
    skryptów. Pliki poprzedniej wersji zostają do następnego wdrożenia (strona
    podana z pamięci przy słabym zasięgu może jeszcze po nie sięgać),
    starsze znikają. Nagrania podmienione albo skasowane usuwa z pamięci. Po
    podmianie lub skasowaniu nagrania (`npm run audio -- --force`, ręczne
    usunięcie pliku) wystarczy wdrożyć — urządzenia same odświeżą je przy
    następnym otwarciu z internetem, bez „Pobierz najnowszą wersję". Na HEAD
    nagrań (audyt w panelu rodzica) service worker odpowiada z manifestu, bez
    sieci i bez pobierania plików; gdy wdrożenie nie ma `deploy.json`, wraca
    do pytania serwera;
  - nagrania, którego nie ma jeszcze w pamięci, odtwarzacz czeka najwyżej
    6 s (łącze bez transmisji); potem gra synteza, a plik dociąga się w tle
    na następny raz. „Nagrania nie ma" (404) aplikacja pamięta 10 min, nie
    do przeładowania — tuż po wdrożeniu odpowiedź mogła być jeszcze według
    poprzedniego manifestu;
  - „Sprawdź nagrania" pyta partiami po 24; brak odpowiedzi (offline) to
    osobny wynik „nie da się sprawdzić", a nie „brakuje".
- **Dane** (lib/progress/merge.ts, ten sam projekt co w Lidze):
  - „Wyczyść postęp" zostawia znacznik czasu (`resetTs`), który rozchodzi się
    przez synchronizację — inaczej skasowany postęp wracał z chmury.
    Przywrócenie kopii sprzed resetu zostawia drugi znacznik (`restoreTs`).
    Oba scala się jako maksimum z obu stron, a **granica odcięcia**
    (`progressCutoff`) to `resetTs`, gdy jest późniejszy od `restoreTs`,
    inaczej 0 (nic nie odpada). Sesje, próby, próbne testy i fakty starsze
    niż granica odpadają przy każdym scaleniu — chyba że przyszły od strony,
    która granicę już znała (`knowsCutoff`): tam rekord sprzed granicy mógł
    powstać tylko po resecie (zegar tego urządzenia spóźnia się względem
    urządzenia, które reset zrobiło, albo sesja trwała w chwili resetu), więc
    to postęp po resecie i zostaje. W Lidze to samo robi przesunięcie takiej
    sesji za granicę przy zapisie.
  - Reset dostaje znacznik późniejszy od ostatniego resetu, od `restoreTs`
    (przywrócenie z urządzenia ze spieszącym się zegarem nie może go
    unieważnić) i od najnowszego rekordu na urządzeniu (najwyżej dobę naprzód)
    — inaczej sesja z urządzenia ze spieszącym się zegarem przeżywała
    „Wyczyść postęp". Granica może więc leżeć chwilę w przyszłości; sesje
    zrobione potem na urządzeniach, które reset znają, zostają (wyżej).
    Stracić można tylko sesję z urządzenia offline, które resetu jeszcze nie
    zna, zrobioną w oknie równym przesunięciu zegarów. Tak samo w Lidze.
  - Znaczniki należą do rodziny (`school.sync.markers.v1`, jak w Lidze):
    reset albo przywrócenie zrobione bez synchronizacji albo w innym obiegu
    dotyczy tylko tego urządzenia — przed pierwszym obiegiem w nowej rodzinie
    znaczniki są zdejmowane. Bez tego „Wyczyść postęp" na nowym tablecie po
    podłączeniu (krótkim kodem, QR albo samoczynnie za Ligą) kasował historię
    całej rodziny. I odwrotnie: urządzenie, które dołącza do rodziny
    (`school.sync.joining.v1`), nie traci swojej historii przez reset zrobiony
    w rodzinie przed jego dołączeniem — przy pierwszym scaleniu zachowujemy
    ją przywróceniem, a panel mówi rodzicowi, ile sesji zachowano.
  - Strona, która nie widziała najnowszego resetu (drugie urządzenie bez
    synchronizacji między resetem a treningiem, urządzenie offline, stara
    kopia z pliku), ma w stanie faktów historię sprzed resetu — jej fakty
    odtwarzamy od zera z jej prób od granicy. Inaczej fakty ćwiczone jako
    pierwsze po resecie wracały z pudełkami sprzed niego.
  - Fakty tabliczki scalamy **po id prób**, nie „nowszy wygrywa". Gdy stan
    faktu po każdej stronie da się odtworzyć co do pola z jej dziennika prób
    (dziennik to cała historia faktu), stan odtwarzamy od zera z unii prób —
    wynik jak przy nauce na jednym urządzeniu, także gdy dwa urządzenia
    ćwiczyły niezależnie. Inaczej (dziennik przycięty: `RULES.attemptLogLimit`
    na urządzeniu, a w skrzynce przy dużym stanie tylko tyle najnowszych
    prób, ile zmieści się w limicie usługi) strona, której niczego nie
    brakuje, wygrywa w całości. Brakuje jej próby drugiej strony, której nie
    może mieć w liczbach, albo historii drugiej strony spoza jej dziennika,
    gdy tej na pewno u siebie nie ma (własny dziennik pełny albo tamta
    historia jest starsza niż początek własnych liczników — np. telefon po
    „Wyczyść postęp" przy przywracaniu kopii o przyciętym dzienniku). W
    pozostałych przypadkach bazą jest stan z WCZEŚNIEJSZĄ ostatnią
    odpowiedzią i dokładamy mu brakujące próby — późniejsze tymi samymi
    regułami co na żywo, wcześniejsze tylko do liczników — a pudełko i
    termin liczymy od nowa od ostatniego błędu treningu, który leży w obu
    dziennikach (po błędzie zależą już tylko od późniejszych prób). Dzięki
    temu błędna odpowiedź z urządzenia offline obniża pudełko jak na żywo
    także w stanie ustalonym, gdy dziennik jest przycięty. Liczniki nigdy nie
    maleją, nic nie liczy się podwójnie, a scalanie jest przemienne i
    idempotentne (fuzz w przeglądach 23.09.2026 na 2–3 urządzeniach, z
    przyciętym dziennikiem i skrzynką, z resetami: zero błędów algebry,
    zbieżność bez pętli wysyłek). Ograniczenia przy przyciętym dzienniku:
    liczniki bywają niższe od ideału (historii, która wypadła z dzienników
    wszystkich stron, nie da się odtworzyć), a gdy w części wspólnej
    dzienników nie ma błędu, pudełko zostaje z bazy i bywa wyższe od ideału.
  - Sesja zapisana dwa razy (pagehide, potem dokończenie — upsert po `id`)
    scala się do wersji późniejszej, a skrzynka dostaje ją jako nowość.
  - „Wczytaj kopię" najpierw sprawdza skutek (`previewImport`): kopia z
    sesjami sprzed tutejszego resetu → pytanie „Przywrócić je?" (tak =
    `restoreTs`, rozchodzi się na pozostałe urządzenia; nie = tylko nowsze);
    kopia z nowszym resetem → ostrzeżenie, ile sesji zniknie z tego
    urządzenia, a przy włączonej synchronizacji — że sesje sprzed tej daty
    znikną też na pozostałych urządzeniach (nowszy reset z pliku rozchodzi się
    jak „Wyczyść postęp"; wtedy pytamy nawet, gdy tu nic nie zniknie).
    Komunikat po wczytaniu podaje, ile sesji doszło, ile ubyło i ile
    pominięto.
  - Imię rozstrzyga czas jego zmiany (`childNameTs`, zawsze rosnący), a nie
    ostatnia sesja.
    Plik kopii Ligi (ta sama wersja schematu!) jest odrzucany.
- **Sesja**: wynik zapisuje się przed rundą bonusową; wyjście inną drogą niż
  okno przerwania (systemowe „wstecz", odświeżenie) zapisuje zrobioną pracę;
  pusta sesja nie zostawia śladu; okno przerwania wstrzymuje ekran pod
  spodem (klawiatura, czas odpowiedzi).
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
