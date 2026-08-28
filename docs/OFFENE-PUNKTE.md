# Offene Punkte – Pizzeria Pinocchio Nordkirchen

Stand: 28. August 2026 · Quelle: gedruckte Speisekarte 2026 (PDF-Scan)

Die Seite ist vollständig und lauffähig. Die folgenden Angaben ließen sich aus
dem Flyer **nicht** belegen und sind deshalb im Code als Platzhalter markiert,
statt sie zu erfinden.

## 1. Rechtlich erforderlich – vor dem Livegang klären

| Punkt | Fundstelle | Status |
|---|---|---|
| **Steuernummer** | `index.html` → `LEGAL.impressum` | `[noch eintragen]` |
| **Zuständiges Finanzamt** | `index.html` → `LEGAL.impressum` | `[noch eintragen]` |
| **E-Mail-Adresse** | überall `info@pinnochionordkirchen.de` | angenommen, nicht belegt |
| **Allergene & Zusatzstoffe je Gericht** | `index.html` → `var AM = {}` | **bewusst leer** |

Zu den Allergenen: Die Amoura-Karte hatte eine Codierung je Artikelnummer.
Übernommen hätte sie hier **falsche** Angaben erzeugt, weil dieselben Nummern
andere Gerichte bezeichnen. Die Tabelle ist daher leer; es erscheint keine
Kennzeichnung. AGB und Allergene-Modal verweisen solange auf telefonische
Auskunft. Sobald die Daten vorliegen, `AM` nach dem Muster `"12a": "A,G,1"`
füllen – die Anzeige greift dann automatisch.

## 2. Zwei unklare Stellen im Scan

| Nr. | Gericht | Problem | Eingetragen |
|---|---|---|---|
| **48** | Rustica | Nummer im Scan verdeckt | `48` – aus der Reihenfolge 47 → 49 erschlossen |
| **117** | Rigatoni al Forno | Preis angeschnitten (`,0`) | `9,50 €` – aus 116 = 9,00 € und 118 = 9,50 € abgeleitet |

Beide sind in `Menue/menu.json` hinterlegt, Nr. 117 zusätzlich mit dem Feld
`preis_unsicher`.

## 3. Preisannahmen ohne Beleg im Flyer

- **Familienpizza-Belag:** Der Flyer nennt für Nr. 66/67 nur „belegen wir nach
  Ihrem Wunsch“, ohne Preis. Übernommen wurde Amouras Modell
  *3 Zutaten frei, jede weitere +1,50 €* (`EXTRA_PRICE_FLAT` in `index.html`).
  Der ausgewiesene Maxi-Extrabelag von 1,50 € diente als Anhalt.
- **Servicegebühr 0,99 €** stammt aus dem Amoura-System, nicht aus dem Flyer.

## 4. Deployment – Stand 28. August 2026

### Erledigt
- **Repository:** `falahabed007/Pinnochio-Nordkirchen` (öffentlich), Dateien im Wurzelverzeichnis
- **GitHub Pages:** aktiv, Build über Actions (`.github/workflows/deploy.yml`), Deployment erfolgreich
- **Custom Domain:** `pinnochionordkirchen.de` in Pages eingetragen (`CNAME`)

### Offen – DNS umstellen
Die Domain liegt bei **Checkdomain** und zeigt noch auf deren Parkseite
(`130.185.109.77`). Solange das so ist, landet jeder Aufruf dort statt auf der
Seite. Beim Domain-Anbieter eintragen:

| Typ | Name | Wert |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `falahabed007.github.io.` |

Vorhandene A-Records auf `130.185.109.77` vorher entfernen. Nach der Umstellung
(bis 24 h) in GitHub → Settings → Pages **„Enforce HTTPS"** aktivieren; das
Zertifikat wird erst nach korrektem DNS ausgestellt.

Geprüft ist, dass GitHub den fertigen Stand ausliefert: ein Abruf direkt gegen
die Pages-IP mit Host-Header liefert die Seite mit 324 KB und korrektem Titel.

### Render – angelegt
Service: `https://pinnochio-nordkirchen.onrender.com` (Frankfurt, Node, Branch `main`).
`BACKEND_URL` in `index.html` zeigt darauf.

### MongoDB – Rechte fehlen (offen)

`MONGODB_URI` ist gesetzt und zeigt auf den vorhandenen Atlas-Cluster
(`cluster.honnxbz.mongodb.net`), Datenbank `pinocchio-nordkirchen`.
Der Connection-String ist korrekt – daran muss nichts geändert werden.

**Befund vom 28. August 2026:**

| Prüfung | Ergebnis |
|---|---|
| `/api/health` | `db: connected` – Anmeldung am Cluster klappt |
| `/api/availability` (lesen) | HTTP 500 |
| `POST /api/orders` (schreiben) | HTTP 500 |

Anmeldung erfolgreich, aber *jede* Operation scheitert – das ist die Signatur
eines datenbankgebundenen Benutzerrechts. Der Benutzer `amoura_app` ist auf
`pizzeria-amoura` beschränkt und hat auf `pinocchio-nordkirchen` keine Rechte.

**Lösung:** Atlas → *Database Access* → `amoura_app` → *Edit* →
*Add Additional Role*: `readWrite` auf `pinocchio-nordkirchen`. Danach in
Render einmal *Manual Deploy → Restart*, weil Mongoose den bestehenden
Verbindungspool offen hält und Rollenänderungen erst bei neuen Verbindungen
greifen.

Geplant ist ohnehin ein eigener Datenbankbenutzer je Pizzeria – dann entfällt
die Zusatzrolle und der Zugang wird gleich sauber getrennt.

> **Achtung beim Vorführen:** `/api/status` fällt bei Fehlern bewusst auf
> „geöffnet" zurück. Die Bestellsperre greift also *nicht* – ein Besucher kann
> den Warenkorb füllen und scheitert erst beim Absenden. Solange die Datenbank
> nicht funktioniert, die Seite besser nicht dem Wirt zeigen.

**Ebenfalls offen:** Stripe, PayPal und Resend (leere Werte schalten die
Dienste ab, stören den Start aber nicht).

> **Wichtig:** Solange kein Backend läuft, greift die Fail-Safe-Sperre – die
> Seite zeigt sich, aber Bestellen ist deaktiviert („Backend nicht erreichbar →
> auf geschlossen setzen"). Das ist gewolltes Verhalten aus dem Amoura-System.

**Plan beachten:** Auf dem Free-Plan schläft der Dienst nach ~15 Minuten ein.
Dann läuft die Minuten-Cron für die Auf/Zu-Automatik nicht mehr, die
22-Uhr-Berichte fallen aus, und der erste Gast wartet ~50 s auf den Kaltstart.
Für den Livebetrieb Starter ($7/Monat) wählen.

## 5. Technisch offen

- **Repo ist öffentlich.** Nötig, weil GitHub Pages auf dem Free-Plan private
  Repos nicht veröffentlicht – dieselbe Konstellation wie bei Amoura. Der
  Quelltext von `dashboard.html` ist damit einsehbar; geschützt wird der Zugang
  serverseitig über `ADMIN_PASSWORD`. Entsprechend gut wählen.
- **Gerichtsfotos** stammen aus dem Amoura-Bestand (`img/menu/`, lizenzfrei,
  siehe `QUELLEN.md`) und sind thematisch, nicht gerichtsgenau zugeordnet.

## 6. Logo

Aus Seite 5 des Flyers freigestellt (`img/logo.png`, 520 px, transparent;
`img/logo-print.png` mit weißem Grund). Es ist ein Scan eines Drucks – für
größere Darstellung wäre eine Vektor- oder Originaldatei vom Wirt besser.
