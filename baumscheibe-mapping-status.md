# Baumscheibe-Feldverknüpfung — Ist-Stand

Testmethode: `renderBaumscheibeSvg()` mit einer vollständig ausgefüllten Testpflanze (alle Booleans `true`, alle Text-/Zahlenfelder gesetzt) über einen Headless-Browser gerendert und das Ergebnis-SVG per `inkscape:label`-Suche ausgewertet — dieselbe Logik, die der Renderer selbst nutzt (`findByLabel()` in `baumscheibe-render.ts`). Ergänzt um eine manuelle Analyse von `baumscheibe-template.svg` (welche `inkscape:label`-Elemente tatsächlich existieren, welchen Element-Typ sie haben, ob sie standardmäßig sichtbar sind).

Quelle für Soll-Zustand: `baumscheibe3-data-fields.ods`, Sheet „baumscheibe3-data-fields".

**Ergebnis in Kurzform:** 25 von 38 PlantData-Feldern werden korrekt gerendert (inkl. Frucht-/Blütemonate, s.u.). `phVeryAcid`/`phVeryAlkaline` sind seit dem 2.3-Template neu dazugekommen; `growSpeedMid`/`growSpeedHigh` waren kurzzeitig tot (2.3-Template hat nur noch 1 statt 3 Wachstumsgeschwindigkeits-Icons), sind aber über eine Behelfslösung (`setGrowthSpeedIcon()`, zeigt das eine vorhandene Icon bei irgendeinem gesetzten Wert) wieder verdrahtet, s. Wachstum-Abschnitt unten. 6 Felder sind im Code gemappt, aber im SVG existiert kein passendes Element (Mapping läuft ins Leere — kein Fehler, einfach kein sichtbarer Effekt). 7 Felder haben gar kein Code-Mapping. Seit 2026-09-09 blenden alle Nutzung-/Funktionen-Felder mit einer Farbfläche (die "color"-Gruppe) diese zusammen mit dem Icon aus, statt dass die Farbe immer sichtbar bleibt. Mindestens 3 SVG-Icons sind unverknüpft und **immer sichtbar** (nicht ausgeblendet) — beim Test mit einer leeren Pflanze blieben zusätzlich zum bekannten Baum-/Duftverwirrer-/Faser-Icon noch eine zweite Biene und ein Holzscheit sichtbar, die keinem der drei dokumentierten Icons entsprechen; welche Felder das genau sein sollen ist unklar (evtl. die vom ODS-Kommentar erwähnte Aufteilung „mat-construction/mat-fibre" bei `material`, oder ein zweites Insekten-Icon) — nicht weiter untersucht, da außerhalb des aktuellen Auftrags.

**Update (2026-09-09) — Template auf `baumscheibe2.3_inkl-label.svg` umgestellt:** Der Rest dieses Dokuments beschreibt noch den Stand vor diesem Wechsel und ist an den mit „✅ NEU" markierten Stellen unten korrigiert. Kurzfassung der Änderung: die 2.3-Version ist ein frischer, farbiger PSD→SVG-Export (`psd2svg` + `add_inkscape_labels.py`) mit rohen Photoshop-Ebenennamen als `inkscape:label` (`u_edible`, `f_Nfixer`, `ph2_acid`, …) statt der bisherigen PlantData-Feldnamen. Die Zuordnung dieser rohen Labels zu den PlantData-Feldern wurde **nicht geraten**, sondern durch Positionsvergleich ermittelt: `getBBox()` jedes gelabelten Elements in altem und neuem Template gemessen und per nächstgelegenem Nachbarn gematcht (meist < 5px Abstand) — Details siehe Kommentar in `baumscheibe-mapping.ts`. Disc-Geometrie (Mittelpunkt/Radius) und die Frucht-/Blüte-Ringe im Hintergrundraster wurden per Pixel-Sampling erneut vermessen und sind **byte-identisch** zur alten Version (keine Anpassung an `pdf-export.ts`/`baumscheibe-render.ts` nötig). `latinName`/`commonName`/`heightM`/`widthM`/`climateZone` existierten im rohen Export nicht (wie schon in der alten Version waren das manuell nachgetragene Textfelder) — die entsprechenden Elemente wurden 1:1 aus dem alten Template übernommen und an derselben Position eingefügt. Per Playwright mit einer voll ausgefüllten und einer leeren Testpflanze sowie den echten PDF-Export-Pfaden (Einzelkarte, Bulk, 6er-Sheet) verifiziert.

## Legende

- ✅ **OK** — SVG-Element vorhanden, Code-Mapping vorhanden, im Test korrekt gerendert
- ⚠️ **Mapping tot** — Code-Mapping vorhanden, aber kein passendes `inkscape:label` im SVG gefunden → Feld hat nie eine sichtbare Wirkung
- ❌ **Kein Mapping** — kein Eintrag in `baumscheibe-mapping.ts`; teils weil im SVG kein Element existiert, teils bewusst zurückgestellt (siehe Kommentar)
- 🖼️ **Icon immer sichtbar** — SVG-Icon existiert, ist nicht an ein Feld gekoppelt und hat kein `display:none` im Template → erscheint auf **jeder** Karte unabhängig von den Pflanzendaten
- — **kein PlantData-Feld** — in der ODS als Konzept genannt, aber nicht im Datenmodell (`types.ts`) umgesetzt

## Identität / Dimensionen / Klima

| data-field | SVG-Element (Typ) | Status | Kommentar |
|---|---|---|---|
| `latinName` | `latinName` (`<image>`, wird durch injizierten `<text>` ersetzt) | ✅ OK | Sonderfall: Platzhalter-Raster wird versteckt, echter `<text>` an fester Position eingefügt (kursiv). Im 2.3-Export gab es nur unbeschriftete Deko-`<text>`-Elemente ("Botanical name") — jetzt mit `inkscape:label="latinName"` versehen, damit sie beim Rendern ausgeblendet werden |
| `commonName` | `commonName` (`<image>` → `<text>`) | ✅ OK | wie oben, nicht kursiv; im 2.3-Export war es "COMMON NAME", ebenfalls nachträglich gelabelt |
| `heightM` | `heightM` (`<text>`) | ✅ OK | existierte im 2.3-Rohexport gar nicht (wie schon vorher: manuell nachgetragenes Textfeld) — 1:1 aus dem alten Template übernommen |
| `widthM` | `widthM` (`<text>`) | ✅ OK | wie oben |
| `climateZone` | `climateZone` (`<text>`) | ✅ OK | wie oben |
| `imageUrl` | — | — n/a | ODS: „NA" — Baumscheibe hat keinen Foto-Slot, nur Poly-/Streifenkarte |
| (Pioneer) | `layer` (`<image>`, raster31) | — kein PlantData-Feld / 🖼️ immer sichtbar | ODS: „fehlt in Code". Icon existiert oben rechts im Kreis, ist nie ausgeblendet |
| `layer` (Ebene/Schicht) | `layer` (s.o., gleiches Icon wie Pioneer?) | — kein PlantData-Feld | Kein `layer`-Feld in `types.ts`; unklar ob Pioneer und Ebene dasselbe Icon teilen sollen |

## Wachstum

| data-field | SVG-Element | Status |
|---|---|---|
| `growSpeedLow` | generisches Icon (Gruppe „growth speed", `<image id="image_65">`) | ✅ OK (Behelfslösung) | |
| `growSpeedMid` | s.o. | ✅ OK (Behelfslösung) | |
| `growSpeedHigh` | s.o. | ✅ OK (Behelfslösung) | |

**Update (2026-09-09):** Das 2.3-Template hat nur ein einziges generisches Icon in der Gruppe „growth speed" statt drei getrennter Icons für Low/Mid/High — kann die drei Stufen also nicht optisch unterscheiden. `setGrowthSpeedIcon()` (in `baumscheibe-render.ts`, außerhalb des regulären `BOOL_FIELDS`-Loops, da eine 1:1-Feld-Zuordnung hier nicht möglich ist) zeigt das Icon, sobald *irgendeines* der drei Felder gesetzt ist — „ein Wert ist bekannt" statt „welcher Wert". Damit ist das Feld nicht mehr tot, aber auch nicht vollständig informativ. Echte Mid/High-Icons nachzurüsten bleibt offen (s. Priorisierte Lücken).

## Sonne — ✅ teilweise verdrahtet

| data-field | SVG-Element | Status |
|---|---|---|
| `sunFull` | kein Icon im PSD (auch keine ausgeblendete Ebene) | ❌ Kein Mapping — keine Artwork vorhanden |
| `sunMid` | `semishade1` (`<image>`, halbgefüllter Kreis) | ✅ OK |
| `sunShadow` | `fullshade1` (`<image>`, voll gefüllter Kreis) | ✅ OK |

`setSunIcon()` in `baumscheibe-render.ts` wählt zwischen `sunShadow`/`sunMid`; `sunFull` bleibt „kein Icon" (nicht unterscheidbar von „nichts gesetzt"). Seit der Neukonvertierung von `baumscheibe2.4.psd` (2026-09-24) liefert der Designer beide Zustände bereits fertig sichtbar an einer einzigen, bereinigten Canvas-Position — kein Spleißen mehr nötig (anders als beim vorherigen PSD, wo nur ein Zustand sichtbar war). Die Label-Nummerierung hat sich dabei verschoben (`fullshade2`/`semishade2`/`wet1`/`humid1` → `fullshade1`/`semishade1`/`wet2`/`humid2`), reine Umbenennung ohne Bedeutungsänderung. Ein zweites Duplikat-Paar (`fullshade2`/`semishade2`, an der jetzt aufgegebenen zweiten Icon-Position) liegt weiterhin ausgeblendet im PSD und bleibt ungenutzt.

## Wasser — ✅ teilweise verdrahtet

| data-field | SVG-Element | Status |
|---|---|---|
| `waterDry` | kein Icon im PSD (auch keine ausgeblendete Ebene) | ❌ Kein Mapping — keine Artwork vorhanden |
| `waterMid` | `humid2` (`<image>`, halber Tropfen) | ✅ OK |
| `waterWet` | `wet2` (`<image>`, voller Tropfen) | ✅ OK |

Gleiches Bild wie bei Sonne: `setWaterIcon()` wählt zwischen `waterWet`/`waterMid`, `waterDry` bleibt ohne Icon. (`waterPlant` gab es hier vorher auch als Feld — inzwischen aus `types.ts` entfernt, war nie mehr als ein „NA, für spätere Version"-Platzhalter.)

## Boden-pH — ✅ NEU: jetzt vollständig (alle 5 Stufen)

| data-field | Gesuchte Labels | SVG-Element | Status |
|---|---|---|---|
| `phVeryAcid` | `PH-Veryacid` / `phVeryAcid` / `ph1_v_acid` | `ph1_v_acid` (`<image>`) | ✅ OK (NEU) |
| `phAcid` | `phAcid` / `PH-acid` / `ph2_acid` | `ph2_acid` (`<image>`) | ✅ OK |
| `phNeutral` | `phNeutral` / `PH-neutral` / `ph3_neutral1` | `ph3_neutral1` (`<image>`) | ✅ OK |
| `phAlkaline` | `phAlkaline` / `PH-alkaline` / `ph5_alk` | `ph5_alk` (`<image>`) | ✅ OK |
| `phVeryAlkaline` | `PH-veralkaline` / `phVeryAlkaline` / `ph6_v_alk` | `ph6_v_alk` (`<image>`) | ✅ OK (NEU) |
| `phSaline` | — | kein Element | ❌ Kein Mapping (ODS: „NA, für spätere Version") |

**Vorher** waren nur die mittleren drei der 5 pH-Stufen im SVG vorhanden (s.o., ODS Task2: „Grafik in 5 Elemente ändern"). Im 2.3-Template sind jetzt alle 5 als eigene Icons vorhanden, nummeriert `ph1_v_acid` … `ph6_v_alk` (Nummer 4 ausgelassen) — Zuordnung über die selbsterklärende Nummerierung, nicht nur Position.

## Nutzung

| data-field | SVG-Element | Status | Kommentar |
|---|---|---|---|
| `eatable` | `eatable` → NEU `u_edible` (`<image>`) | ✅ OK | |
| `eatableScore` | — (Gruppe `rating` existiert, ungenutzt) | ❌ Kein Mapping | ODS: 5-Sterne-Grafik geplant, noch nicht verdrahtet |
| `culinaric` | `culinaric` → NEU `u_culinary` (`<image>`) | ✅ OK | |
| `meds` | `meds` → NEU `u_medicinal` (`<image>`) | ✅ OK | |
| `medsScore` | — (Gruppe `rating`) | ❌ Kein Mapping | s.o. |
| `material` | `material` → NEU `u_material` (`<image>`) | ✅ OK | |
| `materialScore` | — (Gruppe `rating`) | ❌ Kein Mapping | s.o. |
| `fodder` | `fodder` → NEU `u_fodder` (`<image>`) | ✅ OK | |
| `fuel` | `fuel` → NEU `u_fuel` (`<image>`) | ✅ OK | |
| `fiber` | `u_fiber` (`<image>`) | ✅ OK | Seit 2026-10-01 gemappt (war ungemappt und dadurch immer sichtbar) |
| `wood` | `u_timber` (`<image>`) | ✅ OK | Seit 2026-10-01 gemappt (war ungemappt und dadurch immer sichtbar) |

## Ökosystem-Funktionen

| data-field | SVG-Element | Status | Kommentar |
|---|---|---|---|
| `nitrogenFix` | `nitrogenFix` → NEU `f_Nfixer` (`<image>`) | ✅ OK | |
| `mineralFix` | `mineralFix` → NEU `f_dynacc` (`<image>`) | ✅ OK | |
| `groundCover` | `groundCover` → NEU `f_groundcover` (`<image>`) | ✅ OK | |
| `insects` | `insects` → NEU `f_pollinators` (`<image>`) | ✅ OK | |
| `pest` | `f_apc` + Farbkeil `apc` (Duftverwirrer-Icon) | ✅ OK | Seit 2026-10-01: `pest` = „Schädlingsschutz / pest control" deckt den Duftverwirrer ab; war ungemappt und immer sichtbar |
| `animalProtection` | `animalProtection` → NEU `f_shelter` (`<image>`) | ✅ OK | |
| `windBreaking` | `windBreaking` → NEU `f_windbreak2` (`<image>`) | ✅ OK | |
| `windBreakingOnSea` | — | kein Element | ❌ Kein Mapping (ODS: „NA, für spätere Version") |

## Phänologie

| data-field | Status |
|---|---|
| `fruitMonths` | ✅ OK (echte Template-Elemente, s.u.) |
| `flowerMonths` | ✅ OK (echte Template-Elemente, s.u.) |

**Update (2026-09-09) — auf echtes Label-Mapping umgestellt:** Der bisherige Hardcode-Workaround (per Pixel-Sampling vermessene Donut-Segmente über die Ring-Geometrie gelegt, s. Git-History für Details) ist hinfällig. Das 2.3-Template hat für genau diesen Zweck zwei gelabelte Gruppen, `harvest` (Frucht) und `flowering` (Blüte), die jeweils ein `<image>` pro Monat enthalten. Die Kind-Elemente selbst tragen kein individuelles Monats-Label, aber ihre DOM-Reihenfolge entspricht exakt der Winkel-Reihenfolge (per `getBBox()`-Winkelmessung von jedem Bild relativ zum Ringzentrum `(1140, 1130)` bestätigt: `flowering` läuft monoton von 171° links bis 7,5° rechts über 12 Bilder — Monat 0=Jan…11=Dez in DOM-Reihenfolge). `setMonthRing()` (in `baumscheibe-render.ts`) findet die Gruppe per `findByLabel()`, iteriert ihre `<image>`-Kinder in DOM-Reihenfolge und blendet sie einzeln per `display:none` je nach `fruitMonths[i]`/`flowerMonths[i]` ein/aus — genau das reguläre Label-Mapping-Verfahren, das für alle anderen Felder auch gilt.

**Besonderheit:** `harvest` hat nur 11 statt 12 Bilder — für April (Index 3) existiert kein Frucht-Icon im Artwork (nach Winkel-Abgleich gegen `flowering`s vollständige 12 Positionen zweifelsfrei bestimmt, nicht geraten). `HARVEST_MONTH_INDEX = [0,1,2,4,5,6,7,8,9,10,11]` überspringt diesen Index; ein Testfall mit *nur* April aktiv bestätigt: `flowerMonths[3]` zeigt weiterhin korrekt an, `fruitMonths[3]` bleibt (mangels Icon) unsichtbar.

Getestet: alle 12 Monate einzeln (harvest 11/11 bzw. flowering 12/12 sichtbar bei „alle an", 0/0 bei „alle aus"), der April-Sonderfall, ein realistisches Apfel-Muster (Blüte April–Mai, Frucht August–Oktober, visuell korrekt links bzw. rechts im Ring), und der Grenzfall „Frucht und Blüte im selben Monat" (beide Bilder liegen leicht winkelversetzt nebeneinander statt exakt übereinander — ergibt einen doppelt breiten Balken statt eines Glitches, das ist Eigenschaft des Artworks, kein Bug). Alle drei PDF-Export-Pfade erneut end-to-end verifiziert.

Frühere Einschränkung (hart codierte Geometrie, nur bei Template-Neuexport neu zu vermessen) entfällt damit — Zentrum/Radien werden nicht mehr gebraucht, nur noch die beiden Label-Namen und ggf. `HARVEST_MONTH_INDEX`, falls ein künftiger Export die fehlenden Monate ergänzt oder die Icon-Reihenfolge ändert.

## Statische/strukturelle SVG-Labels ohne Datenbezug

`?`, `Höhe, Breite`, `Name`, `background`, `functions`, `growthSpeedGroup`, `pH`, `phFrame`, `phText`, `rating`, `soil`, `sun`, `tbd`, `uses`, `water` — Gruppen-Container, Sektionsüberschriften oder Platzhalter ohne eigene Sichtbarkeits-Logik. `tbd` und `?` sind wörtlich unfertige Platzhalter im Template.

---

## Priorisierte Lücken (Vorschlag)

1. ~~**Sonne/Wasser komplett tot**~~ — teilweise erledigt seit 2026-09-22: `sunMid`/`sunShadow` und `waterMid`/`waterWet` zeigen jetzt je ein eigenes Icon (s.o.). Verbleibende Lücke: `sunFull`/`waterDry` haben im PSD überhaupt keine Zeichnung — braucht neue Artwork vom Designer (kein Mapping-Problem mehr).
2. **Immer sichtbare Geister-Icons** (`layer`, `duftverwirrer`, `fibre` + mind. 2 weitere unklare, s.o.) — zeigen aktuell bei *jeder* Pflanze an, auch wenn die Eigenschaft nicht zutrifft. Im 2.3-Template zusätzlich: die komplette Farbfläche hinter dem Nutzen-/Funktionen-Ring ist ebenfalls immer sichtbar (neues Gestaltungselement „color", unabhängig von den Daten) — vermutlich gewollt (Karte wirkt auch ohne Daten bunt/vollständig), aber falls nicht: gleiche Lösung wie bei den anderen Geister-Icons.
3. ~~**pH-Extremstufen**~~ — erledigt seit 2.3-Template: alle 5 Stufen vorhanden (s.o.).
4. **Score-Sterne** (`eatableScore`/`medsScore`/`materialScore`) — Gruppe `rating` existiert als Platzhalter, aber ohne Struktur für 3×5 Sterne.
6. ~~**`growSpeedMid`/`growSpeedHigh` tot**~~ — Behelfslösung seit 2026-09-09 (s. Wachstum-Abschnitt oben). Für eine echte Unterscheidung der drei Stufen braucht es in Photoshop/Inkscape zwei weitere Icons analog zum vorhandenen.
5. ~~**Fruchtmonate/Blütemonate**~~ — erledigt: programmatisch injizierter Kalender (s. Abschnitt Phänologie oben), da kein SVG-Ansatzpunkt existierte. Ringgeometrie nach dem 2.3-Wechsel erneut vermessen und bestätigt unverändert.

Diese Datei spiegelt den Stand von `baumscheibe-template.svg` + `baumscheibe-mapping.ts` zum Testzeitpunkt wider — bei Änderungen am SVG in Inkscape muss sie neu erzeugt werden.
