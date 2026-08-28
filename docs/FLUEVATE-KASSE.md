# Fluevate Kasse auf dem Sunmi einrichten – Pizzeria Pinocchio Nordkirchen

Die Kasse (Merchant-App) ersetzt Web-Dashboard **und** Fully Kiosk. Wer sie
einsetzt, braucht die Print-Bridge **nicht** – sie spricht den Drucker direkt an,
ohne HTTP-Umweg.

## 1. APK aufs Gerät

Aus [falahabed007/fluevate-releases](https://github.com/falahabed007/fluevate-releases)
die aktuelle `merchant-release.apk` laden.

```bash
adb install -r merchant-release.apk
```

Ohne PC: APK auf einen USB-Stick, am Sunmi im Dateimanager öffnen,
„Installation aus unbekannten Quellen" bestätigen.

## 2. Einrichtungsdialog – diese Werte eintragen

| Feld | Wert |
|---|---|
| **Name** | `Pizzeria Pinocchio` |
| **Backend-Adresse** | `https://pinnochio-nordkirchen.onrender.com` |
| **Admin-Passwort** | steht in `.env` bei `ADMIN_PASSWORD` — **nicht** in dieses Repo eintragen, es ist öffentlich |
| **Bon-Kopfzeile 1** | `Bergstr. 19 · 59394 Nordkirchen` |
| **Bon-Kopfzeile 2** | `Tel. 0 25 96 / 93 91 91` |

Das Admin-Passwort ist dasselbe wie fürs Web-Dashboard und muss mit dem Wert in
Render übereinstimmen. Ändert es sich dort, muss es auch auf dem Gerät neu
eingetragen werden.

## 3. Berechtigungen

Benachrichtigungen (Android 13+) · Bluetooth nur bei externem BT-Drucker ·
USB erscheint beim Anstecken – dort **„Immer verwenden" ankreuzen**, sonst fragt
das Gerät nach jedem Neustart erneut.

## 4. Drucker

Menü → *Drucker* → internen Sunmi-Drucker wählen → **Testbon drucken**.
Erst wenn der Testbon kommt, ist die Kette vollständig.

## Backend-Verträglichkeit – geprüft am 28. August 2026

Die Routen sind deckungsgleich mit Amoura, das laut Fluevate-README „alles kann".
Einziger Unterschied: `/api/coupon-raffle` fehlt – bewusst durch den
Finanzschüler-Rabatt ersetzt, von der Kasse nicht genutzt.

| Endpunkt | Zweck | Status |
|---|---|---|
| `GET /api/admin/status` | Betriebszustand | 200 |
| `GET /api/admin/orders/pending` | Polling neuer Bestellungen | 200 |
| `GET /api/admin/availability` | ausverkaufte Artikel | 200 |
| `PATCH /api/admin/orders/:id/confirm` | Annehmen + Zeit | vorhanden |
| `PATCH /api/admin/orders/:id/status` | Zubereitung / Fertig | vorhanden |
| `PATCH /api/admin/orders/:id/payment` | bezahlt / unbezahlt | vorhanden |
| `POST /api/admin/orders/:id/print` | Bon erneut drucken | vorhanden |
| `DELETE /api/admin/orders/:id` | stornieren | vorhanden |

Der Admin-Login wurde live getestet und liefert ein gültiges Token.

## Vor dem Livebetrieb

> **Render-Plan.** Auf Free schläft das Backend nach ~15 Minuten ohne Zugriff
> ein. Die Kasse pollt dann ins Leere und zeigt „OFFLINE", bis der Dienst wieder
> hochfährt – beim ersten Aufruf rund 50 Sekunden. Für den Tresen **Starter
> ($7/Monat)** wählen.

> **Stornieren erstattet Geld.** Bei bezahlten Kartenzahlungen löst das Backend
> automatisch eine Stripe-Rückerstattung aus. Die App warnt vorher, aber der
> Betrag ist danach weg.

Offen bleiben Stripe/PayPal (sonst nur Barzahlung) und Resend (sonst keine
Bestätigungsmails an Gäste) – siehe [OFFENE-PUNKTE.md](OFFENE-PUNKTE.md).
