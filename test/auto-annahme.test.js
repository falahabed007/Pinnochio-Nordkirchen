// Automatische Annahme nach 15 Minuten (auto-annahme.js).
// Läuft ohne Datenbank und ohne .env: npm test
// Die Datenbank ist ein kleiner Speicher im Arbeitsspeicher, der die
// benutzten Mongo-Filter selbst auswertet.
const test   = require('node:test');
const assert = require('node:assert/strict');
const aa     = require('../auto-annahme');
const { kasseAnmerkung } = require('../kasse');

const MIN      = 60 * 1000;
const JETZT    = new Date('2026-12-01T18:00:00Z');
const STICHTAG = '2026-12-01T00:00:00+01:00';
const stumm    = { log() {}, warn() {}, error() {} };
const vor      = minuten => new Date(JETZT.getTime() - minuten * MIN);

// ─── Mini-Auswertung der Mongo-Filter ────────────────────────────
const leer = v => v === null || v === undefined;
const gleich = (a, b) => (a instanceof Date && b instanceof Date) ? a.getTime() === b.getTime()
  : (leer(a) && leer(b)) || a === b;
function feldPasst(wert, bed) {
  if (bed && typeof bed === 'object' && !(bed instanceof Date) && !Array.isArray(bed)) {
    return Object.entries(bed).every(([op, v]) => {
      switch (op) {
        case '$ne':  return !gleich(wert, v);
        case '$in':  return v.some(x => gleich(wert, x));
        case '$nin': return !v.some(x => gleich(wert, x));
        case '$gte': return !leer(wert) && wert >= v;
        case '$lte': return !leer(wert) && wert <= v;
        default: throw new Error('Operator fehlt im Testspeicher: ' + op);
      }
    });
  }
  return gleich(wert, bed);
}
function passt(doc, filter) {
  return Object.entries(filter).every(([k, v]) => {
    if (k === '$or')  return v.some(f => passt(doc, f));
    if (k === '$nor') return !v.some(f => passt(doc, f));
    return feldPasst(doc[k], v);
  });
}

function speicher(bestellungen, { vorDemSchreiben } = {}) {
  const docs = bestellungen.map((b, i) => ({ _id: 'id' + i, ...b }));
  const aufrufe = { finde: [], aendereWenn: [] };
  return {
    docs, aufrufe,
    async finde(filter, { limit }) {
      aufrufe.finde.push({ filter, limit });
      return docs.filter(d => passt(d, filter))
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, limit)
        .map(d => ({ _id: d._id, orderNum: d.orderNum }));
    },
    async aendereWenn(filter, aenderung) {
      aufrufe.aendereWenn.push({ filter, aenderung });
      if (vorDemSchreiben) vorDemSchreiben(docs, filter._id);
      const d = docs.find(x => passt(x, filter));
      if (!d) return null;
      Object.assign(d, aenderung.$set);
      return { ...d };
    },
  };
}

const bar = (orderNum, minutenAlt, mehr = {}) =>
  ({ orderNum, status: 'pending', payment: 'bar', paymentStatus: 'unpaid', createdAt: vor(minutenAlt), ...mehr });

function laufen(s, mehr = {}) {
  return aa.lauf({ speicher: s, jetzt: JETZT, stichtag: STICHTAG, minuten: 15, log: stumm, ...mehr });
}

// ─── Frist und Stichtag ──────────────────────────────────────────

test('fristMinuten: Standard 15, Zahl > 0 gilt, 0 / negativ / Unsinn = aus', () => {
  assert.equal(aa.fristMinuten({}), 15);
  assert.equal(aa.fristMinuten({ AUTO_ANNAHME_MINUTEN: '' }), 15);
  assert.equal(aa.fristMinuten({ AUTO_ANNAHME_MINUTEN: ' 2 ' }), 2);
  assert.equal(aa.fristMinuten({ AUTO_ANNAHME_MINUTEN: '0' }), 0);
  assert.equal(aa.fristMinuten({ AUTO_ANNAHME_MINUTEN: '-5' }), 0);
  assert.equal(aa.fristMinuten({ AUTO_ANNAHME_MINUTEN: 'aus' }), 0);
});

test('fristMinuten liest process.env zur Aufrufzeit', (t) => {
  const alt = process.env.AUTO_ANNAHME_MINUTEN;
  t.after(() => { if (alt === undefined) delete process.env.AUTO_ANNAHME_MINUTEN; else process.env.AUTO_ANNAHME_MINUTEN = alt; });
  process.env.AUTO_ANNAHME_MINUTEN = '7';
  assert.equal(aa.fristMinuten(), 7);
  delete process.env.AUTO_ANNAHME_MINUTEN;
  assert.equal(aa.fristMinuten(), 15);
});

test('faelligFilter: ohne Stichtag, mit ungültigem Stichtag oder Frist 0 -> null', () => {
  assert.equal(aa.faelligFilter(JETZT, { stichtag: null, minuten: 15 }), null);
  assert.equal(aa.faelligFilter(JETZT, { stichtag: 'kein Datum', minuten: 15 }), null);
  assert.equal(aa.faelligFilter(JETZT, { stichtag: STICHTAG, minuten: 0 }), null);
  const f = aa.faelligFilter(JETZT, { stichtag: STICHTAG, minuten: 15 });
  assert.equal(f.status, 'pending');
  assert.equal(f.createdAt.$gte.getTime(), new Date(STICHTAG).getTime());
  assert.equal(f.createdAt.$lte.getTime(), vor(15).getTime());
  assert.deepEqual(f.$nor, [{ payment: { $in: ['stripe', 'paypal'] }, paymentStatus: { $nin: ['paid', 'refunded'] } }]);
});

// ─── Lauf ────────────────────────────────────────────────────────

test('14 Minuten alt bleibt pending, 16 Minuten wird confirmed mit autoAngenommenAm', async () => {
  const s = speicher([bar(1, 14), bar(2, 16)]);
  const nummern = await laufen(s);
  assert.deepEqual(nummern, [2]);
  assert.equal(s.docs[0].status, 'pending');
  assert.equal(s.docs[0].autoAngenommenAm, undefined);
  assert.equal(s.docs[1].status, 'confirmed');
  assert.equal(s.docs[1].autoAngenommenAm.getTime(), JETZT.getTime());
  // kein prepTime, keine Bestätigung durch den Laden
  assert.equal('prepTime' in s.docs[1], false);
  assert.equal('ladenBestaetigtAm' in s.docs[1], false);
  assert.deepEqual(Object.keys(s.aufrufe.aendereWenn[0].aenderung.$set).sort(), ['autoAngenommenAm', 'status']);
});

test('awaiting_payment wird nie angenommen', async () => {
  const s = speicher([
    bar(1, 30, { status: 'awaiting_payment', payment: 'stripe', paymentStatus: 'pending' }),
    bar(2, 30, { status: 'awaiting_payment', payment: 'bar' }),
  ]);
  assert.deepEqual(await laufen(s), []);
  assert.equal(s.docs[0].status, 'awaiting_payment');
  assert.equal(s.docs[1].status, 'awaiting_payment');
});

test('pending mit Stripe/PayPal ohne bestätigte Zahlung wird nie angenommen, bezahlt schon', async () => {
  const s = speicher([
    bar(1, 30, { payment: 'stripe', paymentStatus: 'pending' }),
    bar(2, 30, { payment: 'paypal', paymentStatus: 'unpaid' }),
    bar(3, 30, { payment: 'stripe' }),                        // paymentStatus fehlt
    bar(4, 30, { payment: 'stripe', paymentStatus: 'paid' }),
    bar(5, 30, { payment: 'paypal', paymentStatus: 'paid' }),
  ]);
  assert.deepEqual(await laufen(s), [4, 5]);
  assert.deepEqual(s.docs.map(d => d.status), ['pending', 'pending', 'pending', 'confirmed', 'confirmed']);
});

test('vor dem Stichtag nie', async () => {
  const s = speicher([bar(1, 0, { createdAt: new Date('2026-11-30T22:59:59Z') }), bar(2, 60)]);
  assert.deepEqual(await laufen(s), [2]);
  assert.equal(s.docs[0].status, 'pending');
});

test('ohne Stichtag läuft nichts, der Speicher wird nicht einmal gefragt', async () => {
  for (const stichtag of [null, undefined, '', 'Quatsch']) {
    const s = speicher([bar(1, 60)]);
    assert.deepEqual(await laufen(s, { stichtag }), []);
    assert.equal(s.aufrufe.finde.length, 0);
    assert.equal(s.docs[0].status, 'pending');
  }
});

test('Frist 0 = aus, auch über AUTO_ANNAHME_MINUTEN', async (t) => {
  const s = speicher([bar(1, 60)]);
  assert.deepEqual(await laufen(s, { minuten: 0 }), []);
  assert.equal(s.aufrufe.finde.length, 0);

  const alt = process.env.AUTO_ANNAHME_MINUTEN;
  t.after(() => { if (alt === undefined) delete process.env.AUTO_ANNAHME_MINUTEN; else process.env.AUTO_ANNAHME_MINUTEN = alt; });
  process.env.AUTO_ANNAHME_MINUTEN = '0';
  assert.deepEqual(await aa.lauf({ speicher: s, jetzt: JETZT, stichtag: STICHTAG, log: stumm }), []);
  process.env.AUTO_ANNAHME_MINUTEN = '2';
  const s2 = speicher([bar(1, 3), bar(2, 1)]);
  assert.deepEqual(await aa.lauf({ speicher: s2, jetzt: JETZT, stichtag: STICHTAG, log: stumm }), [1]);
});

test('Laden war schneller: kein Treffer beim atomaren Schritt -> nicht in der Rückgabe', async () => {
  const s = speicher([bar(1, 20), bar(2, 20)], {
    // Zwischen Suchen und Schreiben nimmt der Laden #1 an
    vorDemSchreiben(docs, id) {
      const d = docs.find(x => x._id === id);
      if (d.orderNum === 1) Object.assign(d, { status: 'confirmed', prepTime: 30, ladenBestaetigtAm: JETZT });
    },
  });
  assert.deepEqual(await laufen(s), [2]);
  assert.equal(s.docs[0].autoAngenommenAm, undefined);
  assert.equal(s.docs[0].prepTime, 30);
  // der atomare Schritt prüft Status und Bestellung
  assert.equal(s.aufrufe.aendereWenn[0].filter.status, 'pending');
  assert.equal(s.aufrufe.aendereWenn[0].filter._id, 'id0');
});

test('Rückgabe enthält nur wirklich umgesetzte Nummern (Fehler beim Schreiben, null)', async () => {
  const s = speicher([bar(1, 20), bar(2, 20), bar(3, 20)]);
  const echt = s.aendereWenn.bind(s);
  s.aendereWenn = async (filter, aenderung) => {
    if (filter._id === 'id0') throw new Error('Netz weg');
    if (filter._id === 'id1') return null;
    return echt(filter, aenderung);
  };
  assert.deepEqual(await laufen(s), [3]);
});

test('schon bestätigte, stornierte oder angenommene Bestellungen bleiben unberührt', async () => {
  const s = speicher([
    bar(1, 30, { status: 'confirmed', ladenBestaetigtAm: vor(25), prepTime: 30 }),
    bar(2, 30, { status: 'cancelled' }),
    bar(3, 30, { status: 'preparing' }),
    bar(4, 30, { status: 'confirmed', autoAngenommenAm: vor(10) }),
  ]);
  const vorher = structuredClone(s.docs);
  assert.deepEqual(await laufen(s), []);
  assert.deepEqual(s.docs, vorher);
});

test('Grenze je Lauf: limit geht an den Speicher, älteste zuerst', async () => {
  const s = speicher([bar(1, 20), bar(2, 40), bar(3, 30)]);
  assert.deepEqual(await laufen(s, { limit: 2 }), [2, 3]);
  assert.equal(s.aufrufe.finde[0].limit, 2);
  assert.equal(aa.HOECHSTENS_JE_LAUF, 50);
});

// ─── Abbildung für Kasse und Gast ────────────────────────────────

const offenAuto = () => ({ _id: 'a', orderNum: 9, status: 'confirmed', autoAngenommenAm: vor(5), ladenBestaetigtAm: null,
                           items: [{ name: 'Pizza Salami', price: 9.5, qty: 1, extraDetails: [{ name: 'Groß', price: 2 }], note: 'scharf' }] });

test('istOffenAuto nur bei confirmed + autoAngenommenAm + ohne ladenBestaetigtAm', () => {
  assert.equal(aa.istOffenAuto(offenAuto()), true);
  assert.equal(aa.istOffenAuto({ ...offenAuto(), ladenBestaetigtAm: undefined }), true);
  assert.equal(aa.istOffenAuto({ ...offenAuto(), ladenBestaetigtAm: vor(1) }), false);
  assert.equal(aa.istOffenAuto({ ...offenAuto(), status: 'cancelled' }), false);
  assert.equal(aa.istOffenAuto({ ...offenAuto(), status: 'preparing' }), false);
  assert.equal(aa.istOffenAuto({ ...offenAuto(), autoAngenommenAm: null }), false);
  assert.equal(aa.istOffenAuto({ status: 'confirmed' }), false);
  assert.equal(aa.istOffenAuto(null), false);
});

test('OFFEN_AUTO und NEU passen zu istOffenAuto', () => {
  assert.deepEqual(aa.OFFEN_AUTO, { status: 'confirmed', autoAngenommenAm: { $ne: null }, ladenBestaetigtAm: null });
  const faelle = [
    offenAuto(),
    { ...offenAuto(), ladenBestaetigtAm: vor(1) },
    { ...offenAuto(), status: 'cancelled' },
    { status: 'confirmed' },
    { status: 'pending' },
  ];
  for (const f of faelle) assert.equal(passt(f, aa.OFFEN_AUTO), aa.istOffenAuto(f));
  assert.deepEqual(faelle.map(f => passt(f, aa.NEU)), [true, false, false, false, true]);
});

test('fuerKasse: OFFEN_AUTO wird pending + autoAngenommen, Eingabe bleibt unverändert', () => {
  const o = offenAuto();
  const vorher = structuredClone(o);
  const k = aa.fuerKasse(o);
  assert.equal(k.status, 'pending');
  assert.equal(k.autoAngenommen, true);
  assert.equal(k.orderNum, 9);
  assert.deepEqual(o, vorher);
});

test('fuerKasse: nicht nach ladenBestaetigtAm, nicht bei cancelled/preparing/pending', () => {
  for (const o of [
    { ...offenAuto(), ladenBestaetigtAm: vor(1) },
    { ...offenAuto(), status: 'cancelled' },
    { ...offenAuto(), status: 'preparing' },
    { _id: 'p', status: 'pending' },
    { _id: 'c', status: 'confirmed', prepTime: 30 },
  ]) {
    const k = aa.fuerKasse(o);
    assert.equal(k.status, o.status);
    assert.equal('autoAngenommen' in k, false);
    assert.deepEqual(k, o);
  }
  assert.equal(aa.fuerKasse(null), null);
});

test('fuerKasse nutzt toJSON (Mongoose-Dokument) und liefert ein schlichtes Objekt', () => {
  const doc = { status: 'x', toJSON() { return offenAuto(); } };
  const k = aa.fuerKasse(doc);
  assert.equal(typeof k.toJSON, 'undefined');
  assert.equal(k.status, 'pending');
  assert.equal(k.autoAngenommen, true);
});

test('fuerKasse zusammen mit kasseAnmerkung (Middleware unter /api/admin/orders)', () => {
  const req = { method: 'GET' };
  let gesendet;
  const res = { json(b) { gesendet = b; return this; } };
  kasseAnmerkung()(req, res, () => {});
  res.json({ pending: [aa.fuerKasse(offenAuto())] });
  const p = gesendet.pending[0];
  assert.equal(p.status, 'pending');
  assert.equal(p.autoAngenommen, true);
  assert.equal(p.items[0].extraDetails.at(-1).name, 'ANMERKUNG: scharf');
});

test('fuerGast: OFFEN_AUTO zeigt pending ohne Zeit, interne Felder fallen weg', () => {
  const g = aa.fuerGast({ ...offenAuto(), prepTime: 30 });
  assert.equal(g.status, 'pending');
  assert.equal(g.prepTime, null);
  assert.equal('autoAngenommenAm' in g, false);
  assert.equal('ladenBestaetigtAm' in g, false);
  assert.equal('autoAngenommen' in g, false);
});

test('fuerGast: nicht nach ladenBestaetigtAm, nicht bei cancelled/preparing', () => {
  const bestaetigt = aa.fuerGast({ ...offenAuto(), ladenBestaetigtAm: vor(1), prepTime: 30 });
  assert.equal(bestaetigt.status, 'confirmed');
  assert.equal(bestaetigt.prepTime, 30);
  assert.equal(aa.fuerGast({ ...offenAuto(), status: 'cancelled' }).status, 'cancelled');
  assert.equal(aa.fuerGast({ ...offenAuto(), status: 'preparing' }).status, 'preparing');
  assert.equal(aa.fuerGast({ status: 'pending' }).status, 'pending');
  const doc = { toJSON() { return { ...offenAuto(), orderNum: 4 }; } };
  assert.equal(aa.fuerGast(doc).status, 'pending');
  assert.equal(aa.fuerGast(doc).orderNum, 4);
});
