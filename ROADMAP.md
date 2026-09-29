# Roadmap — Perma Design Kit

Offene Punkte. Abgeschlossene Roadmap-Punkte stehen in [`CHANGELOG.md`](CHANGELOG.md).

## jetzt
- [x] in /root/pdk/temp steht eine neue psd, welche auch icons für wasser und licht beinhaltet - und weiter designänderungen beinhaltet. konvertiere dieses zu svg und nutze sie als basis für die baumscheibe. hinter der höhe und breite soll jeweils ein "m" für meter stehen.
- [x] Startseite übersichtlicher gestalten:
  - [x] Untermenü: kleine Verbesserungen für die Lesbarkeit:
    - [x] View / Ansicht vor den 3 Buttons für Pflanzenkacheln/Liste/.. schreiben
    - [x] Zwischen dieser Zeile "Ansicht" und Filter etwas mehr Abstand
    - [x] "Filter:" : gleiche Schriftgröße wie "Ansicht"
    - [x] Pflanzenkarten: Vor Dropdown "Baumscheibe.." schreiben: Ausgabe-Layout. Dann die PDF-Ausgaben gruppieren und auch eher als dropdown organisieren Ausgabeformat davor schreiben? Filter eins nach oben schieben
    - [x] export / Ausgabe: Ausgabeproject scale / Maßstab dazuschreiben

- [x] Sortenname auf Pflanzenkachel in Klammern hinter DE/EN-Namen schreiben
- [x] Tabellenansicht: Druck als pdf genauso wie auf anderen Seiten unter Filterzeile anzeigen (und aus Daten-Button entfernen). Genauso diese Tabellendruckfunktion im "Kalender"-Ansicht einfügen
- [x] checkbox im Kalender hinzufügen: "Pflanzen ohne Kalenderdaten anzeigen"
- [x] implement a sort function for all three views: show dropdown/tickbox to sort by date from january to december, do this for both flowering and harvest times. Also implement sorting method A-Z. (Also include option to show complete list irrespective of data completion.)
- [x] kalender: blüte und frucht übereinander in zwei horizontalen Reihen, wie im pdf
- [x] change title of the calendar view to "flowering & harvest calendars"
- [x] enable filter for all uses and functions
- [x] add an optional text field in "basic data" with the following Label: notes - Notizen


- [x] alle Ansichten: Sortierungen, v.a. a-Z (+innerhalb schichten)
- [x] Namensgebung Nutzung & Funktionen auf DE&EN korrekt eintragen mit folgender Liste:
  - [x] functions: nitrogen fixer - Stickstoff-Fixierer, dynamic accumulator - Mineraliensammler, invertebrates - Insekten, pest control - Schädlingsschutz, ground cover - Bodendecker, wildlife - Kleintiere, windbreak - Windschutz
  - [x] uses: edibility - Essbarkeit, medicinal - Gesundheit, culinary - Küche, materials - Materialien, fuel - Brennstoff, fodder - Tierfutter, fiber - Fasern, wood - Nutzholz 
- [x] menu order: plants- calendars - polycultures - "garden plan" last & grey out & put info into start page of garden plan "experimental, feature in development";
- [x] changes in the popup "edit mode" of a plant:
  - [x] field "uses": create three evenly distributed invisible rows, group the tickboxes as follows: edibility, medicinal and culinary in the first row; fuel, wood, materials in the second row; fodder, fiber in the third row
  - [x] field "uses": add tickboxes for the following uses: fuel, fodder, fiber, wood, ornamental
  - [x] field "functions": show tickboxes and labels for all possible functions

- [x] include the following new uses to the filtering dropdown menu "uses" and include tickboxes in the edit view of a plant, using the following english and Germen terms: ornamental - Ästhetik, wood - Nutzholz, dyes - Farbstoff, fiber - Fasern,
- [x] printing out: define min. size of plant card in cm to include in page by user. only print plant cards which will be bigger. show list of all discarded plants to user.

- [x] neue funktion: für jede pflanze soll die möglichkeit existieren sie in einer oder mehreren gruppen einzusortieren. implementiere dies, so, dass dies auf der bearbeiten-seite, in der liste und weiteren sichtbar ist in welchen gruppen eine Pflanze ist.

- [ ] in /root/pdk/temp stehen mehrere neue jpgs. erstelle 2-3 designs für die webseite basierend auf diesen jpgs - inkl. neuem logo auf basis dieser desings, welches oben links angezeigt wird. erstelle erstmal nur voransichten und schalte das nicht live. 

## Prios
- [ ] bug fixing
  - [ ] s.u.
  - [ ] Baumscheibe
  - [ ] prüfen: Wasser und Sonne sind im SVG nicht vollständig -> psd erneut in svg konvertieren @Andi
- [ ] Lizenz s.u.
- [ ] Newsletter button: Jetzt Jörn's Newsletter auf brevo nutzen mit api?
- [ ] spendenbutton
- [ ] präsentation check auf dropbox (Andi)
- [ ] impressum: Jörn aufnehmen?




## kurzfristig
- [ ] Logo&CI (Jörn)?: muster in dropbox:
'https://www.dropbox.com/scl/fi/r9p078v5vkvl1f17ol2le/pdk_1920px_v1.jpg?rlkey=2oy8d1d54m6f8hq2ud44213rb&dl=0
- [ ] zulip wieder starten: cd /opt/zulip && docker compose start
- [ ] EdibleForestGardens - Datensatz integrieren
Datei in Dropbox:
https://www.dropbox.com/scl/fi/kptyeduzlor049spvvvrq/Plant-Species-Toolkit.xlsx?rlkey=eer7brcd9h7tv9wb2a6zlwjmw&dl=0

## bis 1.11./Symposium
- [ ] bug reporting aufsetzen (mit Formular vorstrukturieren)
- [ ] Github aktualisieren (help.md, ...)
- [ ] Dokumentation fertig (readme.md; Help.md)

### Re: FUNKTIONALITÄT
- [x] Durchmesser auf Baumscheibe etwas runterschieben
      
### Re: Calendars
- [ ] current month: highlight white!
- [ ] infotextbox: WIP functionality 66%?; explain views

### Re: Polycultures
- [ ] textbox: poly def. & links
- [ ] anchor species is not always a central element!
- [ ] make companion search criteria definable!
- [ ] add functions that are covered by outside guilds


### Re: RECHTLICH/LIZENZ
- [ ] contributor erwähnen: Jörn, Andi, Jens, Sebastian, pfaf
  - [ ] lizenz
  - [ ] bild
- [ ] lizenz auf github: fair-use
  - [ ] Jens & Sebastian um Lizenzänderung bitten?
- [ ] naturadb anrufen (Anfrage: Erlaubnis für gemeinnützige, nicht-kommerzielle Nutzung der Daten?)
- [ ] Toensmeier: können wir seine Daten dafür nutzen? Anfrage ist raus@Joern





## später / Fragen für Präsentation
- [ ] Boden-Dreieck mappen und aktiveren
- [ ] unfarbige Felder in Baumscheibe
- [ ] medicinal & material sinnvoll auf Baumscheibe?
- [ ] plantlist-icon nutzen?
- [ ] erweiterung: essbarkeit: Pflanzenteile (aus PFAF) angeben
- [ ] PFAF hat noch eine agroforestry/regen.agricult. rubrik für weitere funktionen wie erosion control, carbon seq., etc die wir übernehmen wollen
- [ ] new functions: barrier
- [ ] create default/other plant lists: -CAFG (v5? - 41 spp.), CAFG full? (350+ spp.), PFAF - selected book, Grünheck?
- [ ] Zirkeldreher-Tool

- [x] domain permadesignkit.org gekauft
- [x] Tabelle: Baum/Strauch/Krautebene als Spalte und Filter/sortierfunktion
- [x] Zeichen für Baum/Strauch.. ebene -> psd erneut in svg konvertieren
      
### Debugging
#### Darstellung Scheibe & mapping prüfen
- [ ] some herbs get the shrub icon
- [ ] use: materials: s.t. questionable?
- [ ] uses: wood and fiber are always shown
- [ ] testen: **warum wird bei Beinwell Material und Brennstoff aktiviert - wo steht das bei pfaf?** — Zwei getrennte Befunde: **Material ist korrekt** — PFAFs eigenes „Other Uses Rating" für Comfrey/Beinwell steht bei 4 von 5, `material = materialScore > 2` bildet das nur ab. **Brennstoff war ein echter Bug**, jetzt behoben in `plant-proxy-server.mjs`: (1) die `fieldSection`-Extraktion (`/boots[^"]*"[^>]*>…<\/div>/gi`) matchte ungewollt auch die Kette „boots**trap**" aus dem Bootstrap-CDN-Link im `<head>`, wodurch der träge Capture bis zum nächsten `</div>` zig KB unbeteiligter Kopfzeilen-/Script-Inhalte mitriss — gefixt durch `class="boots\d*"[^>]*>…` (erfordert das `class="`-Präfix). (2) Der eigentliche Auslöser für den falschen Wert: `fuel`/`fodder`/`groundCover`/etc. wurden per loser Prosa-Suche (`/\bFuel\b/i` etc.) statt anhand von PFAFs echten Tag-Links geprüft — Comfrey ist bei PFAF nur mit Biomass/Compost/Gum/Dynamic accumulator/Food Forest getaggt, aber der Tooltip-Text des (korrekten) Biomass-Tags lautet „…can be converted into **fuel** etc.", und der Fließtext unter „Landscape Uses" erwähnt beiläufig „**Ground cover**" — beides wurde fälschlich als eigenes Tag erkannt. Fix: `hasUseTag()` prüft jetzt den exakten Anker-Text (`>Fuel</a>`) der zugewiesenen Tags, nicht mehr Fließtext-Vorkommen — geprüft gegen reale PFAF-Seiten (Comfrey, Robinia pseudoacacia, Acer campestre), nicht geraten. `windBreaking`/`animalProtection` bleiben Prosa-basiert (bestätigt: PFAF hat für „Windbreak"/„Living Trellis" gar keine eigene Tag-Kategorie, auch bei klassischen Windschutz-Arten wie Elaeagnus x ebbingei nicht), aber jetzt auf den korrekt eingegrenzten `fieldSection`-Ausschnitt statt den überlaufenden Blob angewandt. Live gegen `/api/plant-proxy` verifiziert: Comfrey liefert jetzt `fuel: false, fodder: false, groundCover: false, material: true, mineralFix: true`; Robinia/Acer weiterhin korrekt `fuel: true`.

#### weitere bugs / validierung
- [ ] limits für abruf bei pfaf

### Baumscheibe Karte Feinschliff
- [ ] Sonne/Wasser-Icons (je 3 Zustände) ergänzen — einzige verbleibende „komplett tot"-Gruppe, siehe `baumscheibe-mapping-status.md`
- [ ] sprache der karten auf ui-sprache einstellen

### sonst
- [ ] lizenzen manuell prüfen & unsere festlegen
- [ ] führung durch die webseite beim ersten aufruf der webseite
- [ ] nutzen prüfen, ist alles vorhanden, was in Baumscheibe angezeigt wird?#
- [ ] polykulturen-tab entwickeln

### PDF Generierung
- [ ] zweite Option: Größen entsprechend Baumdurchmesser

### Launch-Blocker
- [ ] **Plausible-Domain** — `data-domain` in `Layout.astro` auf Custom-Domain anpassen + im Plausible-Dashboard registrieren
- [ ] **Lizenz-Metadaten ergänzen** — `pwa/package.json` fehlt `"license": "MIT"`. Optional: Copyright-Hinweis in `LICENSE`/README erweitern, da die PWA inzwischen eine vollständige Neuentwicklung ist (Original von Sebastian Schucht war die PowerShell-Tooling-Basis in `legacy/`); MIT erlaubt das Rewrite ohne Einschränkung, solange die bestehende Attribution erhalten bleibt

### Lizenz & Datenquellen (Launch-Blocker)
- ⚠ Keine Rechtsberatung, nur technisch-praktische Einschätzung anhand der tatsächlichen Lizenztexte — vor öffentlichem/kommerziellem Launch ggf. kurz von einem Urheberrechtler gegenchecken lassen, insbesondere NaturaDB

### Sync (Feinschliff)
- [ ] **Konflikt-Erkennung** — vor dem Pull prüfen ob das Backup auf dem Server neuer ist als lokal; Warnung + Merge-Option statt blindem Überschreiben
- [ ] **Sync-Status im Header** — kleines Icon (✓ / ⚠) das den letzten Auto-Sync-Status zeigt ohne in die Einstellungen zu müssen
- [ ] **Background Sync API** — Service-Worker-basierter Sync, der auch funktioniert wenn die App geschlossen ist (Chrome only; graceful degradation)

### Polykulturen (Feinschliff)
- [ ] **PDF-Export einer Polykultur** — Pflanzenkarten der Mitglieder als Set + optionale Übersichtsseite
- [ ] **Bulk-Add aus Pflanzenliste** — „Auswahl zur Polykultur X hinzufügen"
- [ ] **Rollen-Vollständigkeits-Indikator** — welche Rollen noch fehlen, auf der Polykulturenkarte in der Listenansicht
- [ ] **Inkompatibilitäts-Warnung** — z.B. Walnuss-Allelopathie (Juglone)

### Baumscheibe-Karte (Feinschliff)
- [ ] **Fehlende Felder in der SVG ergänzen** — `inkscape:label`-Overlays für `fruitMonths`/`flowerMonths`, `pioneer`, `layer`, Sonne/Wasser/pH-Icons
- [ ] **Score-Sterne** — `eatableScore`/`medsScore`/`materialScore` als 5-Stern-Element in SVG anlegen
- [ ] **SVG-Template optimieren** — derzeit 5 MB durch ~30 inline Base64-PNGs; via `svgo` / externe Raster

### UI / UX
- [ ] **Konfigurierbare Farbthemen** — Farbenblindheits-Modus
- [ ] **Bild-Fallback** — Silhouette nach Pflanzentyp wenn kein Foto vorhanden

### Daten
- [ ] **Pflanzenbild-Upload** — Bild lokal speichern (Base64 in IndexedDB oder File in OPFS)
- [ ] Fehlende Felder: Boden-Typ, Ausbreitungsart, Wurzeltiefe

### von Opus 
  1. ✅ erledigt 2026-09-29 (Vitest-Suite, `npm test`; growth-model/blob-shape/compat noch ohne Tests). Kein Testnetz. Das Projekt hatte keine Testsuite — jede
  Regression fällt nur auf, wenn ich sie manuell per Playwright suche.
  Bei inzwischen ~10 Seiten und Modulen wie Wachstumsmodell,
  Blob-Geometrie, compatScore, PFAF-Parser wäre eine kleine Vitest-Suite
  für die reinen Funktionen (growth-model.ts, blob-shape.ts, compat.ts,
  plant-layer.ts, CSV-Import) in ~1 Stunde gebaut und würde dauerhaft
  Zeit sparen. Mein klarer Top-Vorschlag.

  2. gartenplan.astro ist mit ~800 Zeilen zu groß geworden — dasselbe
  Muster wie index.astro. Die Renderer sind schon in Libs ausgelagert,
  aber State + Handler liegen alle in einem <script>-Block. Aufteilen
  lohnt sich, bevor es weiter wächst.

  3. ✅ erledigt 2026-09-29 (`server/pfaf-parse.mjs` + Fixtures in `test/fixtures/pfaf/`). PFAF-Parser ist fragil. Wir hatten diese Session schon zwei echte
  Bugs darin (Bootstrap-Regex, Prosa-Matching). Der Parser hat null Tests
  und bricht still, wenn PFAF sein Markup ändert — ein Satz
  gespeicherter HTML-Fixtures plus Tests wäre günstig und würde genau die
  Klasse Fehler abfangen, die uns zweimal getroffen hat.

  4. Datenqualität sichtbar machen. Das Wachstumsmodell, die
  Ebenen-Ableitung und die Formen sind alles Heuristiken. In der Infobox
  steht es, aber in Karten und PDF-Export nicht — ein kleiner Hinweis
  dort wäre ehrlicher, gerade wenn Dritte die Ausdrucke sehen.

  5. Bundle-Größe. Der Build warnt bei jedem Lauf über Chunks >500 kB.
  Three.js und pdf-lib sind bereits lazy, der Rest ist ungeprüft — einmal
  reinschauen lohnt sich, gerade für eine PWA auf dem Handy im Garten.
---

## Mittelfristig

### Notizen & Beobachtungen
- [ ] **Beobachtungs-Tagebuch pro Pflanze** — freie Notizen mit Datum (z.B. „Erstmals geblüht", „Mehltau bemerkt"), gespeichert in IndexedDB
- [ ] **Foto-Upload pro Eintrag** — eigene Fotos direkt in der App

### Polykulturen — Kuratiertes Companion-Wissen (Phase 2)
- [ ] **`companions.json` als Golden Master** — bekannte gute Kombinationen aus Standardliteratur (Jacke & Toensmeier, Crawford, Hemenway)
- [ ] **Vorschläge erweitern** — mechanische Filter + Companion-Datenbank kombiniert
- [ ] **Pflege-Workflow** für Companion-Daten (PR-Prozess)

### Polykulturen — Visualisierung (Phase 3)
- [ ] **Schicht-Diagramm pro Polykultur** — Baumkrone → Strauch → Staude → Bodendecker → Wurzel
- [ ] **Kompatibilitäts-Matrix** als Heatmap (Sonne/Wasser/pH/Allelopathie)

### Polykulturen — SPARQL (Phase 4, Experiment)
- [ ] **Wikidata-SPARQL** direkt aus dem Browser — z.B. alle Stickstoff-fixierenden Pflanzen
- [ ] **Filter-Builder** im Vorschlags-Panel → SPARQL generieren, importieren
- ⚠ Wikidata-Coverage für ökologische Properties dünn; als Ergänzung, nicht Ersatz

### Visuelles Layout
- [ ] Pflanzplan-Ansicht: Bäume/Sträucher als Kreise auf 2D-Raster, maßstäblich
- [ ] Schichtmodell-Visualisierung
- [ ] Export als SVG/PNG

### Datenquellen
- [ ] Offline-Datenbank (GBIF-Subset o.ä.)
- [ ] Weitere Proxy-Quellen (Pflanzkollektiv, OpenEcoSystems)
- [ ] Wikidata-Properties erweitern (Bestäuber, Schädlingsabwehr)

---

## Langfristig

### Kuratierte Polykulturen als Community-Layer
Öffentlich geteilte Polykulturen (z.B. „Apfelbaum-Polykultur nach Crawford") zum Importieren.
Erfordert ein Backend oder ein standardisiertes JSON-Schema für den Austausch.
Mögliche Einstiegspunkte: GitHub-Repository mit kuratierten Polykulturen-JSONs (PR-Workflow),
später optionales Abo-Modell für gepflegte Sammlungen.

### PocketBase als Server-Backend (Option)

| Use Case | Jetzt (PWA + Netlify) | Mit PocketBase |
|---|---|---|
| Datenspeicher | IndexedDB, pro Browser | SQLite auf eigenem Server |
| Multi-Gerät-Sync | WebDAV / Gist (manuell + auto) | automatisch, Real-Time |
| Gemeinsame Pflanzenbibliothek | ✗ | ✓ |
| Offline-Nutzung | ✓ vollständig | möglich, Sync-Logik nötig |
| Auth / Benutzerkonten | — | eingebaut (OAuth2, E-Mail) |
| Deployment | Netlify (kostenlos) | VPS / Fly.io (ab ~5 €/Mo.) |

**Wann sinnvoll:** mehrere Nutzer, geteilte Bibliothek, kein Datenverlustrisiko.

### Mehrsprachigkeit
- [ ] Pflanzennamen mehrsprachig (de/en/la)

### Migration PowerShell → PWA
- [ ] PowerShell-Skripte als Legacy markieren
- [ ] Import bestehender `.psd1`-Datensätze

---

## Bekannte Probleme / Tech Debt

| Problem | Status |
|---|---|
| Baumscheibe-SVG-Template 5 MB (inline Base64) | offen — via `svgo` / externe Raster |
| Baumscheibe-SVG: kein Farbkeil für `material`/`fodder`/`fuel` in der "color"-Gruppe (nur 9 von 15 Nutzung/Funktionen-Feldern haben einen) — Tabellendots für diese drei nutzen daher einen Platzhalter-Hex statt einer echten Template-Farbe | offen — User ergänzt die fehlenden Farbkeile im Template |
| GitHub Gist: kein Konflikt-Abgleich beim Pull | offen — siehe Kurzfristig Sync |

## Aktueller Stand

Die PWA (`pwa/`) ist der aktive Entwicklungszweig und ersetzt die älteren PowerShell-Skripte. Sie läuft im Browser, speichert Daten lokal (IndexedDB) und kann ohne Installation offline genutzt werden.

### Implementiert

- **Pflanzenverwaltung** — Erstellen, Bearbeiten, Löschen von Pflanzen mit ~50 Attributen (Nutzung, Ökosystemfunktionen, Sonne/Wasser/pH, Wachstum, Blüte-/Fruchtmonate)
- **Pflanzendaten-Import** — Suche via lokale Golden-Master-DB (`plants-db.json`) + Wikidata-API (automatisch bei Import), Anreicherung via PFAF (eigener Server-Proxy, `server/plant-proxy-server.mjs`; NaturaDB aktuell deaktiviert)
- **CSV- & JSON-Import/Export** — inkl. CSV-Vorlagen-Download
- **Drei Ansichten** — Kachelansicht, Listenansicht (sortierbar), Kartenansicht; Toggle in der Toolbar
- **Drei Kartenvarianten** — Polykarte (70×120 mm), Streifenkarte (290×17 mm), **Baumscheibe** (SVG-Template mit Field-Mapped Overlays, A4 Hochformat)
- **Suchleiste** — prominent, mit Lupe-Icon, floating Dropdown, Multi-Add, Wikidata/PFAF/NaturaDB-Enrichment direkt beim Import
- **Kartenvorschau** — Live-Vorschau der Pflanzenkarten im Browser
- **PDF-Export** — Polykarten und Streifenkarten via pdf-lib (Auto-Download); Baumscheibe via pdf-lib (Chrome/Safari) bzw. nativem Druckdialog (Firefox); Bulk-PDF aus Selektion
- **Bulk-Operationen** — Auswählen (inkl. Shift-Klick Range), Löschen, Ergänzen, JSON/CSV/PDF-Export ausgewählter Pflanzen
- **Lokale Filter-Chips** — nach Nutzung, Sonne, Wasser, pH, Vollständigkeit; AND-Logik, persistent
- **Feldprovenenz** — `_sources` pro Datenpunkt; anklickbare Quell-Badges im Edit-Dialog (verlinken wie die Outline-Chips in Kacheln/Liste direkt auf den Quell-Datensatz)
- **Tastatur-Shortcuts** — `/` Suche, `n` Neue Pflanze, `g/l/c` View-Wechsel, `?` Cheatsheet
- **Einstellungsseite** — sechs Sektionen: Datenquellen, Ansicht, Theme, Privatsphäre, Daten, **Sync**
- **Dark Mode** — 3-State-Toggle (Auto/Hell/Dunkel), Pre-Paint-Inline-Skript (kein Light-Flash)
- **Plausible Analytics** — cookieless, EU-gehostet; In-App-Opt-out
- **Rechtliches** — Datenschutz, Impressum (Stub), Hilfe/Glossar, Footer
- **PWA-Install-Prompts** — Android Banner + iOS Safari Popup
- **UI-Redesign** — Kacheln mit Bild/Akzentstreifen/Vollständigkeitsbalken, Listenansicht sortierbar, leerer Zustand mit CTA
- **Mehrsprachigkeit** — Deutsch (Standard) und Englisch, Sprachauswahl oben rechts im Header, client-seitiges i18n (`src/lib/i18n/`), Details siehe „Mehrsprachigkeit" unter Langfristig
- **Druckanzahl / Deaktivieren** — Stepper pro Pflanze steuert, wie oft ihre Karte in Bulk-PDF-Exports erscheint (0 = ausgeschlossen)
- **Polykulturen MVP** — `/polykulturen` Seite mit Editor, Rollen-Slots, mechanischen Vorschlägen aus eigenem Bestand (`compatScore` Sonne/Wasser/pH), kuratierte `role-suggestions.json` (6 Rollen), Internet-Import direkt aus dem Vorschlagspanel
- **Backup & Sync**:
  - JSON-Backup-Download (inkl. Polykulturen)
  - Web Share API (teilen an andere Apps)
  - Backup einlesen (Restore, inkl. Polykulturen)
  - **WebDAV-Sync** (PUT/GET, Credentials in localStorage, CORS-Hinweis)
  - **Lokale Datei** (File System Access API, Chrome/Edge, `showSaveFilePicker`)
  - **GitHub Gist** (privates Gist via PAT, Gist-ID automatisch gespeichert)
  - **Auto-Sync** beim Tab-Verlassen (`visibilitychange`), lautlos, WebDAV → Gist Priorität
  - `navigator.storage.persist()` gegen Browser-Eviction
  - Backup-Reminder-Banner (30-Tage-Schwelle)
  - Letzter Sync-Zeitstempel + Anbieter in den Einstellungen
- **Service Worker** mit Build-Hash-Cache-Versioning
- **DB-Schemaevolution** — v3 mit idempotenter Upgrade-Logik (alle fehlenden Stores werden nachträglich angelegt)
- **Ernte- & Blütenkalender** (`/kalender`) — neue Seite mit Monats-Heatmap-Überblick aus `fruitMonths`/`flowerMonths` aller Pflanzen, per-Pflanze-Detailtabelle, Suche/Filter, aktueller Monat hervorgehoben; Nav-Link im Header
- **Baumscheibe Name-Fix** — `commonName` und `latinName` werden jetzt korrekt gerendert: SVG-`<image>`-Platzhalter werden ausgeblendet, echte `<text>`-Elemente an gleicher Bounding-Box-Position eingefügt; Latein kursiv

---
