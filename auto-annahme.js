// ═══════════════════════════════════════════════════════════════
// AUTOMATISCHE ANNAHME NACH 15 MINUTEN (Abed, 26.11.2026)
// ═══════════════════════════════════════════════════════════════
// Nimmt ein Laden eine Bestellung am Geraet nicht an, bleibt sie auf `pending`.
// Wochen- und Monatsbericht zaehlen nur confirmed/preparing/ready/delivered,
// die Bestellung fehlte also samt Servicegebuehr in der Abrechnung.
//
// Darum setzt ein Zeitjob (jede Minute, server.js) eine Bestellung nach der Frist
// in der Datenbank echt auf `confirmed` und merkt sich `autoAngenommenAm`. Damit
// zaehlen alle Berichte sie, ohne dass ein Filter geaendert wird. Keine Mail an
// den Gast, kein Bon, keine Zubereitungszeit: das passiert erst, wenn der Laden
// wirklich bestaetigt (setzt `ladenBestaetigtAm`) - oder er storniert.
//
// Bis dahin sehen Kasse und Gast die Bestellung weiter als wartend:
//  - fuerKasse(): status 'pending' und autoAngenommen:true, die Kasse klingelt,
//    zeigt sie unter "Neu" und druckt beim Annehmen wie bisher;
//  - fuerGast():  status 'pending', keine Zeit, der Gast sieht weiter "wartet".
//
// Notschalter: AUTO_ANNAHME_MINUTEN (Standard 15, 0 = aus).
// Stichtag: Der Job fasst nur Bestellungen ab dem Stichtag an, den server.js
// uebergibt (je Standort der Tag des Livegangs). Ohne Stichtag laeuft er nicht -
// sonst rutschen beim ersten Lauf alle alten liegengebliebenen `pending` auf
// einmal in die Berichte.
//
// Dieses Modul kennt weder Express noch Mongoose. Die Datenbank kommt als
// `speicher`-Objekt herein (test/auto-annahme.test.js). An allen Standorten
// Byte fuer Byte gleich halten.
'use strict';

const STANDARD_MINUTEN = 15;
// Hoechstens so viele Bestellungen je Lauf (jede Minute). Mehr kommen in einer
// Minute nie zusammen; die Grenze haelt nur einen Ausreisser klein.
const HOECHSTENS_JE_LAUF = 50;
const MIN = 60 * 1000;

// Automatisch angenommen, vom Laden noch nicht bestaetigt.
const OFFEN_AUTO = { status: 'confirmed', autoAngenommenAm: { $ne: null }, ladenBestaetigtAm: null };

// Was die Kasse unter "Neu" zeigt und was der Laden annehmen kann:
// echte `pending` und automatisch angenommene, noch nicht bestaetigte.
const NEU = { $or: [{ status: 'pending' }, OFFEN_AUTO] };

// Frist in Minuten, zur Aufrufzeit gelesen (Tests setzen env selbst).
// Nicht gesetzt oder leer -> 15. Eine Zahl > 0 -> diese. Alles andere
// (0, negativ, kein Zahlwert) -> 0 = aus: Ein vertippter Notschalter soll
// lieber ausschalten als mit einer Frist laufen, die keiner meinte.
function fristMinuten(env = process.env) {
  const roh = env ? env.AUTO_ANNAHME_MINUTEN : undefined;
  if (roh === undefined || roh === null || String(roh).trim() === '') return STANDARD_MINUTEN;
  const n = Number(String(roh).trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Stichtag als Date oder null (fehlt / ungueltig -> null = Job aus).
function stichtagAlsDatum(wert) {
  if (wert === undefined || wert === null || wert === '') return null;
  const d = wert instanceof Date ? new Date(wert.getTime()) : new Date(wert);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Mongo-Filter fuer faellige Bestellungen, oder null, wenn der Job aus ist.
// Unbezahlte Online-Bestellungen nie: wie FUER_KASSE (OdisBowlAhaus/server.js).
function faelligFilter(jetzt, { stichtag, minuten = fristMinuten() } = {}) {
  const ab = stichtagAlsDatum(stichtag);
  if (!ab || !(minuten > 0)) return null;
  const grenze = new Date(new Date(jetzt).getTime() - minuten * MIN);
  return {
    status: 'pending',
    createdAt: { $gte: ab, $lte: grenze },
    $nor: [{ payment: { $in: ['stripe', 'paypal'] }, paymentStatus: { $nin: ['paid', 'refunded'] } }],
  };
}

// Ein Lauf. speicher:
//   finde(filter, { limit })        -> Liste { _id, orderNum }, aelteste zuerst
//   aendereWenn(filter, aenderung)  -> geaenderte Bestellung oder null (atomar,
//                                      z. B. findOneAndUpdate mit new:true)
// Gibt die Bestellnummern zurueck, die WIRKLICH umgesetzt wurden. War der Laden
// schneller (kein Treffer beim atomaren Schritt), fehlt die Nummer.
async function lauf({ speicher, jetzt = new Date(), stichtag, minuten = fristMinuten(),
                      limit = HOECHSTENS_JE_LAUF, log = console } = {}) {
  const filter = faelligFilter(jetzt, { stichtag, minuten });
  if (!filter) return [];
  const kandidaten = await speicher.finde(filter, { limit });
  const umgesetzt = [];
  for (const o of kandidaten || []) {
    try {
      // Bedingung beim Schreiben noch einmal voll pruefen: nur, wenn die Bestellung
      // in diesem Moment noch faellig (also noch `pending`) ist.
      const neu = await speicher.aendereWenn(
        { ...filter, _id: o._id },
        { $set: { status: 'confirmed', autoAngenommenAm: new Date(new Date(jetzt).getTime()) } }
      );
      if (neu) umgesetzt.push(neu.orderNum !== undefined ? neu.orderNum : o.orderNum);
    } catch (e) {
      log.warn(`Auto-Annahme uebersprungen #${o && o.orderNum}: ${e.message}`);
    }
  }
  return umgesetzt;
}

function istOffenAuto(o) {
  return !!o && o.status === 'confirmed' && o.autoAngenommenAm != null && o.ladenBestaetigtAm == null;
}

// Schlichtes Objekt; Mongoose-Dokumente ueber toJSON (so wie res.json sie
// ausgeben wuerde). Das Original bleibt unveraendert.
function schlicht(o) {
  if (!o || typeof o !== 'object') return o;
  if (typeof o.toJSON === 'function') return o.toJSON();
  if (typeof o.toObject === 'function') return o.toObject();
  return { ...o };
}

// Antwort an die Kasse: automatisch angenommen und unbestaetigt -> wie neu.
function fuerKasse(o) {
  const x = schlicht(o);
  if (!x || typeof x !== 'object') return x;
  return istOffenAuto(x) ? { ...x, status: 'pending', autoAngenommen: true } : x;
}

// Antwort an den Gast (Statusabfrage, Bestellhistorie): automatisch angenommen
// und unbestaetigt -> weiter 'pending' ohne Zeit. Die beiden internen Felder
// gehen nie an den Gast.
function fuerGast(o) {
  const x = schlicht(o);
  if (!x || typeof x !== 'object') return x;
  const g = { ...x };
  if (istOffenAuto(x)) {
    g.status = 'pending';
    if ('prepTime' in g) g.prepTime = null;
  }
  delete g.autoAngenommenAm;
  delete g.ladenBestaetigtAm;
  return g;
}

module.exports = {
  STANDARD_MINUTEN, HOECHSTENS_JE_LAUF, OFFEN_AUTO, NEU,
  fristMinuten, stichtagAlsDatum, faelligFilter, lauf, istOffenAuto, fuerKasse, fuerGast,
};
