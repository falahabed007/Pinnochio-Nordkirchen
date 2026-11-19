# PayPal-Setup (Pinocchio Nordkirchen)

Stand 19.11.2026 (übernommen aus Odi's Bowl Ahaus). PayPal läuft **direkt über das eigene
PayPal-Geschäftskonto des Ladens** (REST-App, Orders v2, ohne SDK): Das Geld geht direkt an den
Laden, FlueVate behält davon nichts ein. Unabhängig von Stripe (eigene Variablen, eigene Routen).
Die Sandbox wird nie angesprochen.

## Wann ist PayPal an?

Erst wenn **alles** davon stimmt – vorher sehen Gäste PayPal nicht, und alle PayPal-Routen lehnen ab:

1. `PAYPAL_CLIENT_ID` und `PAYPAL_CLIENT_SECRET` der **Live**-REST-App des Ladens sind gesetzt,
2. `PAYPAL_ENV` ist genau `live` (der bewusste Schalter; ohne ihn geht keine Anfrage an PayPal),
3. die Probe-Anmeldung bei PayPal gelingt,
4. der Server hat seinen Webhook (`https://api.pinnochionordkirchen.de/api/paypal-webhook`, Ereignisse
   `CHECKOUT.ORDER.APPROVED` und `PAYMENT.CAPTURE.COMPLETED`) in der PayPal-App angelegt oder gefunden.

Dann meldet `GET /api/config` `"paypal": true`, und erst dann setzt die Bestellseite den Eintrag
„💙 Online bezahlen (PayPal)“ in die Zahlauswahl.

## Einschalten (Betreiber)

1. In der Hosting-Umgebung `PAYPAL_CLIENT_ID` und `PAYPAL_CLIENT_SECRET` eintragen.
2. Zum Scharfschalten `PAYPAL_ENV=live`, Dienst neu starten.
3. `GET /api/admin/paypal` (Admin-Anmeldung) ansehen: Klartext ohne Geheimnisse, mit dem nächsten
   Schritt. `?erneut=1` versucht das Sicherstellen des Webhooks sofort.
4. Verweigert PayPal der App die Webhook-Verwaltung (Status zeigt „403“): Webhook in der PayPal-App
   von Hand auf die Adresse oben mit beiden Ereignissen anlegen und `PAYPAL_WEBHOOK_ID` setzen.

Optional: `PUBLIC_API_URL` überschreibt die öffentliche API-Adresse (Vorgabe im Code wie `config.js`).

## Was im Code passiert

- `paypal-direkt.js` (Tests: `test/paypal-direkt.test.js`): Schalter, Probe, Client, Webhook-Verwalter,
  Abgleich (Einzug nur aus `awaiting_payment`, Einbuchen nur bei passendem Betrag), Wachhund.
- `server.js`: `/api/config` (`paypal`), `POST /api/create-paypal-order`, `POST /api/paypal-capture`,
  `POST /api/paypal-webhook`, `GET /api/admin/paypal`, PayPal-Wachhund (alle 5 Minuten; nie bezahlte
  nach 1 Stunde abgeschlossen), Erstattung beim Stornieren.
- Kasse: unbezahlte PayPal-Bestellungen erscheinen in keiner `/api/admin/…`-Liste (`FUER_KASSE_PAYPAL`,
  `test/paypal-kasse.test.js`); Stripe und bar unverändert.
- Berichte: PayPal ist eine eigene Gruppe „PayPal (Ihr PayPal-Konto)“, nie unter Barzahlung. Gerechnet
  wie bar (Servicegebühr schuldet der Laden, Überweisung/offener Betrag nur aus Stripe), PayPal-Gebühren
  stehen nicht im Bericht (`test/paypal-bericht.test.js`).

Nicht ohne echtes PayPal prüfbar: ob die Live-App ihre Webhooks per API verwalten darf, echte
Signaturprüfung, Einzug und Erstattung. Das zeigt sich erst beim Scharfschalten in `GET /api/admin/paypal`.
