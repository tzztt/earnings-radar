# Earnings-Radar (Web-App)

Die App zeigt auf dem iPhone, was dein Kalender-Lauf erzeugt: Earnings-Termine, Kurs, RSI, Volumen,
Kursmarken, CRV in drei Varianten, Kunden-Kette und gemeldete Ergebnisse.

Sie ist eine reine Webseite ohne Server. Sie liest die Datei `dashboard.json` aus deinem **geheimen Gist**
(dort liegt sie schon, der Kalender-Lauf schreibt sie bei jedem Durchlauf neben die `earnings.ics`).
Im Seitencode stehen **keine Daten und keine Zugangsdaten**, deshalb darf das Repository öffentlich sein.

## Bildschirme
| Tab | Inhalt |
| --- | --- |
| **Radar** | Kommende Earnings nach Tag, Filter (Diese Woche, Nächste Woche, 30 Tage, Alle), Portfolio, Kunden, Sektoren, Suche, CRV-Variante umschaltbar |
| **Liste** | Alle Werte, sortierbar nach Termin, CRV, RSI oder A–Z, filterbar nach Sektor |
| **Kunden** | Hyperscaler und Großkunden mit ihren Zulieferern: wer berichtet vorher oder danach? |
| **Ergebnisse** | Gemeldete Earnings der letzten 7/30/90 Tage: Beat/Miss, Kursreaktion, Volumen |
| **Aktie** (Tippen auf einen Wert) | Termin, Technik, Kursmarken-Leiter, CRV-Rechner, Kunden, letzte Earnings, Link zu TradingView |
| **Einstellungen** (Zahnrad im Radar) | Quelle, Datenstand, Adresse ändern, Demo, Zurücksetzen |

## Einrichtung (einmalig, ca. 10 Minuten)

### 1. Neues öffentliches Repository
1. Auf GitHub: **+ → New repository**.
2. Name z. B. `earnings-radar`, Sichtbarkeit **Public**, dann **Create repository**.

> Es muss ein *zweites*, öffentliches Repository sein. Dein Kalender-Repository bleibt privat.
> GitHub Pages ist für private Repositories im kostenlosen Tarif nicht verfügbar.

### 2. Dateien hochladen
1. **Add file → Upload files**.
2. Markiere im entpackten Ordner **alle Dateien** (es gibt keine Unterordner) und zieh sie ins Fenster oder wähle sie über „choose your files“ aus.
3. Unten **Commit changes**.

Es sind diese zwölf Dateien: `index.html`, `app.css`, `app.js`, `screens.js`, `sw.js`, `manifest.webmanifest`,
`demo.json`, `icon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `README.md`.

### 3. GitHub Pages einschalten
1. Im neuen Repository: **Settings → Pages**.
2. Bei „Build and deployment“ → Source: **Deploy from a branch**.
3. Branch: **main**, Ordner: **/ (root)**, dann **Save**.
4. Nach 1–2 Minuten steht oben die Adresse, z. B. `https://DEIN-NAME.github.io/earnings-radar/`.

### 4. Auf dem iPhone installieren
1. Öffne die Adresse in **Safari**.
2. Tipp auf **Teilen → Zum Home-Bildschirm**.
3. Öffne die App **vom Home-Bildschirm**.
4. Gib die Abo-Adresse deines Kalenders ein (`webcal://gist.githubusercontent.com/…/earnings.ics`) und tipp auf **Laden**.

> Wichtig: Eine installierte App hat auf dem iPhone einen eigenen Speicher, getrennt von Safari.
> Die Adresse musst du deshalb in der **installierten** App eingeben, nicht vorher in Safari.
> Praktisch: Schick dir die Adresse per Notizen oder iMessage, dann kannst du sie kopieren.

Mit **Demo ansehen** kannst du die App vorab mit Beispieldaten ausprobieren.

## Wie aktuell sind die Daten?
- Der Kalender-Lauf auf GitHub läuft Mo–Fr zweimal täglich. Die App zeigt genau diesen Stand (oben im Radar: „Daten von …“).
- Beim Öffnen der App und nach 30 Minuten Pause lädt sie neu. Mit dem Pfeil-Symbol im Radar geht es von Hand.
- Ohne Internet zeigt die App den zuletzt gespeicherten Stand und blendet oben „Offline“ ein.
- Die Werte sind Momentaufnahmen und keine Live-Kurse.

## Datenschutz
- Die Abo-Adresse (mit deiner Gist-ID) wird nur im Speicher deines Geräts abgelegt.
- Die App sendet nichts an Dritte. Sie ruft nur deine Gist-Datei ab.
- Wer die Adresse der App kennt, sieht ohne deine Gist-ID nur eine leere Einrichtungsseite.

## Wenn etwas nicht klappt
| Meldung | Bedeutung |
| --- | --- |
| „Datei nicht gefunden (404)“ | Die Gist-ID in der Adresse stimmt nicht, oder der Kalender-Lauf hat die Datei noch nie geschrieben. |
| „Keine Verbindung oder Abruf blockiert“ | Kein Internet, oder ein Werbeblocker/VPN blockiert `gist.githubusercontent.com`. |
| „nicht das erwartete Format“ | Die Datei im Gist ist keine `dashboard.json` des Kalender-Projekts. |
| App zeigt alte Daten | Im Radar auf das Pfeil-Symbol tippen. Im Gist prüfen, ob der letzte Lauf grün war. |

Als Notlösung gibt es in den **Einstellungen → Datei laden**: Du kannst eine heruntergeladene `dashboard.json` direkt auswählen.

## Updates der App
Neue Dateien ins Repository hochladen (gleicher Name überschreibt). Die App holt sich Änderungen beim nächsten Öffnen.
Auf dem iPhone kann es einmal nötig sein, die App zu schließen und neu zu öffnen.

*Keine Anlageberatung. CRV und Kursmarken sind regelbasierte Rechenhilfen.*
