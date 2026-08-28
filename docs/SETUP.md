# 🍕 Pizzeria Pinocchio Nordkirchen – Setup Anleitung v2

## Dateien
| Datei | Beschreibung |
|---|---|
| `server.js` | Backend (Node.js/Express/MongoDB) |
| `dashboard.html` | Admin Dashboard für den Wirt |
| `printnode-helper.js` | Bondrucker-Logik |
| `package.json` | Node.js Abhängigkeiten |
| `env-example.txt` | Vorlage für Umgebungsvariablen |

---

## Schritt 1 – GitHub Repository

1. github.com → **New Repository**
2. Name: `pinocchio-nordkirchen` · Sichtbarkeit: **Privat**
3. Alle Dateien hochladen (**OHNE `.env`!**)

---

## Schritt 2 – MongoDB Atlas

1. **mongodb.com/atlas** → Kostenlos registrieren
2. **Create a cluster** → Free Tier wählen (M0)
3. **Database Access** → Add New User:
   - Username + Passwort vergeben → merken!
4. **Network Access** → Add IP Address → **NUR die feste Render-Ausgangs-IP** des Backend-Service eintragen
   (Render → Service → *Connect/Outbound* → Static Outbound IPs). **NICHT** „Allow Access from Anywhere" (0.0.0.0/0) —
   das öffnet den Cluster fürs gesamte Internet. Für lokale Tests zusätzlich die eigene IP temporär erlauben und danach entfernen.
5. **Connect** → Drivers → Node.js → Connection String kopieren:
   ```
   mongodb+srv://USERNAME:PASSWORT@cluster0.xxxxx.mongodb.net/pinocchio-nordkirchen
   ```
   → `/pinocchio-nordkirchen` am Ende ist der Datenbankname — so lassen!
6. Diesen String als `MONGODB_URI` in Render eintragen (Schritt 5)

---

## Schritt 3 – Stripe einrichten (dein Plattform-Konto)

1. **stripe.com** → Registrieren (das ist **dein** Konto, nicht das der Pizzeria)
2. **Connect** aktivieren (im Stripe Dashboard unter „More")
3. **API-Schlüssel** → `sk_live_...` → als `STRIPE_SECRET_KEY` in Render
4. **Webhooks** → Endpunkt hinzufügen:
   - URL: `https://DEIN-BACKEND.onrender.com/api/stripe-webhook`
   - Events: `checkout.session.completed` + `checkout.session.expired`
   - Secret `whsec_...` → als `STRIPE_WEBHOOK_SECRET` in Render

### Pizzeria als Vendor anschließen (Stripe Connect):
5. Stripe Dashboard → **Connect** → **Accounts** → Create Account
6. Onboarding-Link an Pizzeria schicken → die füllen ihre Daten aus
7. Nach Abschluss: Account ID `acct_XXXXXXXXXX` erscheint → als `STRIPE_CONNECT_ACCOUNT` in Render

**Geldfluss automatisch:**
```
Kunde zahlt 22,49 €
    ↓ dein Stripe-Konto empfängt alles
    ↓ Stripe rechnet automatisch ab:
  0,99 € Servicegebühr  → bleibt bei dir
  5% Provision          → bleibt bei dir
  Rest                  → direkt zur Pizzeria (acct_XXX)
```

---

## Schritt 4 – Resend (E-Mail)

1. **resend.com** → Kostenlos registrieren (3.000 E-Mails/Monat gratis)
2. **API Keys** → Create API Key → als `RESEND_API_KEY` in Render
3. **Domains** → Add Domain → `pinocchio-nordkirchen.de` verifizieren (DNS-Einträge beim Domain-Anbieter)
4. `EMAIL_FROM` = `bestellungen@pinocchio-nordkirchen.de`
5. `RESTAURANT_EMAIL` = E-Mail des Wirts (bekommt Kopie + Wochenbericht)
6. `OWNER_EMAIL` = deine E-Mail (bekommt Wochenbericht als Kopie)

---

## Schritt 5 – Render Backend

1. **render.com** → New → **Web Service**
2. GitHub Repo verbinden → `pinocchio-nordkirchen` auswählen
3. Einstellungen:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Health Check Path:** `/api/health`
4. **Environment Variables** alle eintragen:

| Variable | Wert |
|---|---|
| `MONGODB_URI` | Von MongoDB Atlas (Schritt 2) |
| `STRIPE_SECRET_KEY` | Von stripe.com → API-Schlüssel |
| `STRIPE_WEBHOOK_SECRET` | Von stripe.com → Webhooks |
| `STRIPE_CONNECT_ACCOUNT` | `acct_XXXXXXXXXX` (Pizzeria Vendor-ID) |
| `RESEND_API_KEY` | Von resend.com |
| `EMAIL_FROM` | bestellungen@pinocchio-nordkirchen.de |
| `RESTAURANT_EMAIL` | E-Mail des Wirts |
| `OWNER_EMAIL` | Deine E-Mail |
| `PRINTNODE_API_KEY` | Von printnode.com (optional) |
| `PRINTNODE_PRINTER_ID` | Drucker-ID (optional) |
| `ADMIN_PASSWORD` | Passwort für den Wirt (mind. 12 Zeichen) |
| `ADMIN_TOKEN_SECRET` | Geheimer Token (mind. 40 Zeichen) |
| `WHATSAPP_NUMBER` | `4925218290600` (ohne + oder Leerzeichen) |
| `FRONTEND_URL` | URL der Speisekarte (nach Deploy eintragen) |
| `PORT` | `3001` |

5. **Deploy Web Service** → warten bis „Live" erscheint (~3 Min)
6. Testen: `https://NAME.onrender.com/api/health` → muss `{"status":"ok"}` zeigen

---

## Schritt 6 – Dashboard konfigurieren

Nur noch **eine** Stelle, und die liegt in `config.js`:

```javascript
window.PINOCCHIO_BACKEND = 'https://DEIN-BACKEND.onrender.com';
```

`index.html`, `account.html` und `dashboard.html` laden diese Datei im `<head>`.

> ⚠️ **Niemals ein Passwort oder Token in `dashboard.html` eintragen.**
> Die Datei wird öffentlich ausgeliefert – jeder kann sie im Quelltext lesen.
> Genau so lagen `ADMIN_PASSWORD` und `ADMIN_TOKEN_SECRET` bis August 2026
> offen im Netz.
>
> Der Admin-Login läuft ausschließlich über `POST /api/admin/login`. Der Server
> prüft das Passwort gegen `ADMIN_PASSWORD` und gibt ein auf 30 Tage
> befristetes JWT zurück. `ADMIN_TOKEN_SECRET` verlässt den Server nicht mehr.

---

## Schritt 7 – Render Static Site (Speisekarte + Dashboard)

1. render.com → New → **Static Site**
2. Gleiches GitHub Repo
3. **Publish Directory:** `.` (Punkt)
4. Deploy → URL kopieren → als `FRONTEND_URL` in Render Backend eintragen

---

## Schritt 8 – PrintNode Bondrucker (optional)

1. **printnode.com** → Registrieren
2. API Key → als `PRINTNODE_API_KEY` in Render
3. PrintNode Client auf dem Restaurant-PC installieren
4. Drucker-ID ablesen → als `PRINTNODE_PRINTER_ID` in Render

**Empfohlene Drucker:**
- Epson TM-T20III (~150 €) – USB oder LAN
- Epson TM-T88VII (~300 €) – USB, LAN, Bluetooth

---

## Schritt 9 – Testen

- [ ] Speisekarte öffnen → Artikel in Warenkorb → Barzahlung bestellen
- [ ] Dashboard öffnen → Alarm erscheint → Annehmen mit Zeit → E-Mail prüfen
- [ ] Test-Storno → Ablehnen mit Grund → Storno-E-Mail prüfen
- [ ] POS-Bestellung → „Neue Bestellung" Button → Speisen auswählen → Speichern
- [ ] Sold-Out Toggle → Artikel ausschalten → Speisekarte neu laden → „Ausverkauft" prüfen
- [ ] Stripe Test: `pk_test_...` und `sk_test_...` für Tests verwenden

---

## Häufige Fehler

| Problem | Lösung |
|---|---|
| Backend startet nicht | `MONGODB_URI` prüfen – Datenbankname `/pinocchio-nordkirchen` am Ende |
| MongoDB Verbindung fehlgeschlagen | Network Access in Atlas: **feste Render-Ausgangs-IP** eintragen (NICHT `0.0.0.0/0`) · Passwort im `MONGODB_URI` korrekt? |
| Login fehlschlägt | `ADMIN_PASSWORD` in Render prüfen · `JWT_SECRET` muss gesetzt sein (sonst antwortet `/api/admin/login` mit 500) |
| „Sitzung abgelaufen" im Dashboard | Token älter als 30 Tage oder `JWT_SECRET` gewechselt – einfach neu anmelden |
| Stripe Webhook Fehler | URL: `.../api/stripe-webhook` · Event `checkout.session.completed` aktiv? |
| E-Mails kommen nicht | Domain bei Resend verifiziert? · `EMAIL_FROM` muss verifizierte Domain nutzen |
| Bon wird nicht gedruckt | PrintNode Client auf Restaurant-PC läuft und eingeloggt? |
| Stripe Connect geht nicht | `STRIPE_CONNECT_ACCOUNT` = `acct_XXXXX` der Pizzeria, nicht deiner |

---

## Wochenbericht (automatisch)

Jeden **Sonntag um 23:59 Uhr** bekommen automatisch:
- **Pizzeria** → Rechnung mit Umsatz, Servicegebühren, Provision, Auszahlungsbetrag
- **Du** → Kopie zur Kontrolle

Kein manueller Aufwand nötig. ✅

---

*Pizzeria Pinocchio · Bergstr. 19 · 59394 Nordkirchen · Tel. 0 25 96 / 93 91 91*
