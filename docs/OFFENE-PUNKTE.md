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

## 4. Technisch offen

- **`BACKEND_URL`** in `index.html` steht auf
  `https://website-pinocchio-nordkirchen.onrender.com` – nach dem Render-Deploy
  auf den echten Servicenamen ändern.
- **GitHub Pages** veröffentlicht pro Repository nur *eine* Site. `deploy.yml`,
  `deploy-amoura.yml` und `deploy-pinocchio-nordkirchen.yml` überschreiben sich
  gegenseitig. Für `pinnochionordkirchen.de` braucht dieses Projekt ein eigenes
  Repository – oder Render liefert das Frontend gleich mit aus
  (`express.static` ist in `server.js` aktiv).
- **Gerichtsfotos** stammen aus dem Amoura-Bestand (`img/menu/`, lizenzfrei,
  siehe `QUELLEN.md`) und sind thematisch, nicht gerichtsgenau zugeordnet.

## 5. Logo

Aus Seite 5 des Flyers freigestellt (`img/logo.png`, 520 px, transparent;
`img/logo-print.png` mit weißem Grund). Es ist ein Scan eines Drucks – für
größere Darstellung wäre eine Vektor- oder Originaldatei vom Wirt besser.
