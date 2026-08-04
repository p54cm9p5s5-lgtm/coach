/* Lettura del pacchetto dati prodotto dallo Shortcut.
   Formato a righe, volutamente tollerante: spazi, maiuscole e campi in più
   non fanno fallire l'import. */

export const VERSIONE = 1;

/**
 * Numeri come li scrive un iPhone italiano: «10.700» sono diecimilasettecento,
 * non dieci virgola sette, e «886,5» ha la virgola decimale. Senza questa
 * distinzione i passi finirebbero divisi per mille senza dare nessun segnale.
 */
const NUMERO = (v) => {
  if (v === undefined || v === null || v === "") return null;
  let t = String(v).trim().replace(/\s|'| /g, "");
  if (t.includes(",")) {
    // virgola decimale: i punti che restano sono separatori di migliaia
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    // solo punti, e a gruppi di tre: sono migliaia
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

function coppie(resto) {
  const out = {};
  // chiave=valore, con valore eventualmente tra virgolette
  const re = /(\w+)\s*=\s*("([^"]*)"|\S+)/g;
  let m;
  while ((m = re.exec(resto))) out[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : m[2];
  return out;
}

/**
 * Restituisce { finestra, giorni, notti, allenamenti, avvisi }.
 * Lancia solo se il pacchetto non è riconoscibile del tutto.
 */
export function analizza(testo) {
  const righe = String(testo || "")
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r && !r.startsWith("#"));

  if (!righe.length) throw new Error("Non ho trovato niente da leggere: gli appunti sono vuoti.");

  // «COACH-DATI» è il nome giusto da quando il pacchetto porta anche gli
  // eventi del calendario; «COACH-SALUTE» resta valido per non rompere un
  // comando rapido già configurato.
  const intestazione = righe[0].match(/^COACH-(?:SALUTE|DATI)\s+v(\d+)/i);
  if (!intestazione) {
    throw new Error(
      "Questo non è un pacchetto dati di Coach. La prima riga deve essere «COACH-DATI v1»."
    );
  }
  if (Number(intestazione[1]) !== VERSIONE) {
    throw new Error(`Pacchetto in versione v${intestazione[1]}, l'app legge la v${VERSIONE}.`);
  }

  const risultato = { finestra: null, giorni: [], notti: [], allenamenti: [], agenda: [], fasi: [], avvisi: [] };

  for (const grezza of righe.slice(1)) {
    // Tolleranza allo spazio perso: costruendo il comando rapido capita di
    // attaccare la parola alla data («GIORNO2026-08-04»). È una sbavatura di
    // battitura, non un dato sbagliato: si rimette lo spazio e si va avanti.
    const riga = grezza.replace(
      /^(FINESTRA|GIORNO|NOTTE|ALLENAMENTO|AGENDA)(?=\d{4}-\d{2}-\d{2})/i,
      "$1 "
    );
    const [parola, ...resto] = riga.split(/\s+/);
    const tipo = parola.toUpperCase();
    const coda = resto.join(" ");

    if (tipo === "FINESTRA") {
      const [da, a] = resto;
      if (/^\d{4}-\d{2}-\d{2}$/.test(da || "") && /^\d{4}-\d{2}-\d{2}$/.test(a || "")) {
        risultato.finestra = { da, a };
      } else {
        risultato.avvisi.push("Riga FINESTRA con date non valide: ignorata.");
      }
      continue;
    }

    if (tipo === "FASE") {
      // Una fase del sonno grezza, come la registra l'orologio:
      //   FASE 2026-08-03 23:14 2026-08-04 00:02 Core
      // Sono due istanti (data e ora separate da uno spazio) più il nome della
      // fase. I minuti e le notti li calcola l'app: dentro il comando rapido
      // servirebbero date, condizioni e dizionari, e sarebbe fragile.
      const [d1, o1, d2, o2, ...resto2] = resto;
      const valida = (d, o) => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && /^\d{1,2}:\d{2}/.test(o || "");
      if (!valida(d1, o1) || !valida(d2, o2)) {
        risultato.avvisi.push(`Riga FASE con orari non validi, ignorata: «${riga.slice(0, 44)}»`);
        continue;
      }
      risultato.fasi.push({
        inizio: `${d1}T${o1.padStart(5, "0")}`,
        fine: `${d2}T${o2.padStart(5, "0")}`,
        fase: (resto2.join(" ") || "").trim(),
      });
      continue;
    }

    const data = (resto[0] || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      risultato.avvisi.push(`Riga senza data valida, ignorata: «${riga.slice(0, 40)}»`);
      continue;
    }
    // `coda.slice(data.length)` toglie la data e lascia le coppie chiave=valore,
    // anche quando la prima è attaccata alla data senza spazio.
    const c = coppie(coda.slice(data.length));

    if (tipo === "GIORNO") {
      // La distanza può arrivare in chilometri o in metri, a seconda di come è
      // impostata l'unità nel comando rapido: si accettano tutte e due invece
      // di far dipendere il dato da un'impostazione che si dimentica.
      const km = NUMERO(c.km);
      const metri = NUMERO(c.metri);
      risultato.giorni.push({
        data,
        presente: true,
        kcalAttive: NUMERO(c.kcal),
        obiettivoKcal: NUMERO(c.obiettivo),
        passi: NUMERO(c.passi),
        minutiEsercizio: NUMERO(c.esercizio),
        // «inpiedi» sono MINUTI: è quello che l'iPhone espone (tempo in piedi,
        // non il conteggio delle ore dell'anello). Chi avesse le ore può usare
        // «inpiediore» e vengono convertite.
        minutiInPiedi:
          NUMERO(c.inpiedi) != null
            ? NUMERO(c.inpiedi)
            : NUMERO(c.inpiediore) != null
              ? Math.round(NUMERO(c.inpiediore) * 60)
              : null,
        pianiSaliti: NUMERO(c.piani),
        distanzaKm: km != null ? km : metri != null ? Math.round((metri / 1000) * 100) / 100 : null,
        fcRiposo: NUMERO(c.fc),
      });
    } else if (tipo === "NOTTE") {
      risultato.notti.push({
        data,
        presente: true,
        durataMin: NUMERO(c.durata),
        profondoMin: NUMERO(c.profondo),
        remMin: NUMERO(c.rem),
        vegliaMin: NUMERO(c.veglia),
        risvegli: NUMERO(c.risvegli),
      });
    } else if (tipo === "ALLENAMENTO") {
      risultato.allenamenti.push({
        uuid: c.uuid || `${data}-${c.inizio || "00:00"}-${c.durata || 0}`,
        data,
        inizio: c.inizio || null,
        durataSec: NUMERO(c.durata),
        kcalAttive: NUMERO(c.kcal),
        kcalTotali: NUMERO(c.kcaltot),
        fcMedia: NUMERO(c.fcmedia),
        fcMax: NUMERO(c.fcmax),
        tipo: c.tipo || null,
        sedutaId: null,
      });
    } else if (tipo === "AGENDA") {
      // Un evento del calendario: dice quale allenamento tocca quel giorno.
      // Il contenuto (esercizi, carichi) resta quello del master brief.
      // I titoli degli eventi hanno gli spazi («Full Body A», «Gambe e core»).
      // Letti a coppie chiave=valore si fermavano alla prima parola, e il
      // resto del titolo spariva: un evento poteva non essere più riconosciuto
      // come allenamento. Qui il titolo è tutto quello che segue «titolo=»
      // fino all'eventuale chiave dopo (nota=).
      const grezzo = coda.slice(data.length).trim();
      const intero = grezzo.match(/titolo\s*=\s*(?:"([^"]*)"|(.*?))(?=\s+[a-zA-Z]\w*\s*=|$)/);
      const titolo = ((intero?.[1] ?? intero?.[2] ?? c.titolo) || "").trim();
      if (!titolo) {
        risultato.avvisi.push(`Evento senza titolo il ${data}: ignorato.`);
        continue;
      }
      const notaIntera = grezzo.match(/nota\s*=\s*(?:"([^"]*)"|(.*?))(?=\s+[a-zA-Z]\w*\s*=|$)/);
      risultato.agenda.push({
        data,
        titolo,
        nota: ((notaIntera?.[1] ?? notaIntera?.[2] ?? c.nota) || "").trim() || null,
      });
    } else {
      risultato.avvisi.push(`Riga di tipo sconosciuto, ignorata: «${tipo}»`);
    }
  }

  // Le fasi diventano notti: una notte è etichettata con la sera in cui
  // comincia, quindi tutto quello che parte prima di mezzogiorno appartiene
  // alla notte del giorno prima.
  if (risultato.fasi.length) {
    const perNotte = new Map();
    for (const f of risultato.fasi) {
      const inizio = new Date(f.inizio);
      const fine = new Date(f.fine);
      if (Number.isNaN(inizio) || Number.isNaN(fine)) continue;
      let minuti = Math.round((fine - inizio) / 60000);
      // Una fase che scavalca la mezzanotte con la data di fine sbagliata
      // darebbe minuti negativi: si assume il giorno dopo.
      if (minuti < 0) minuti += 24 * 60;
      if (minuti <= 0 || minuti > 12 * 60) continue;

      const notte = new Date(inizio);
      if (notte.getHours() < 12) notte.setDate(notte.getDate() - 1);
      const p = (n) => String(n).padStart(2, "0");
      const chiave = `${notte.getFullYear()}-${p(notte.getMonth() + 1)}-${p(notte.getDate())}`;

      if (!perNotte.has(chiave)) {
        perNotte.set(chiave, { data: chiave, presente: true, durataMin: 0, profondoMin: 0, remMin: 0, vegliaMin: 0, risvegli: 0 });
      }
      const n = perNotte.get(chiave);
      const nome = f.fase.toLowerCase();
      if (/awake|sveglio|veglia/.test(nome)) {
        n.vegliaMin += minuti;
        // Un risveglio è un tratto sveglio di almeno cinque minuti: i micro
        // risvegli di pochi secondi li ha chiunque e non dicono niente.
        if (minuti >= 5) n.risvegli += 1;
      } else if (/inbed|a letto/.test(nome)) {
        // «A letto» non è sonno: non entra nella durata.
      } else {
        n.durataMin += minuti;
        if (/deep|profondo/.test(nome)) n.profondoMin += minuti;
        else if (/rem/.test(nome)) n.remMin += minuti;
      }
    }
    // Le notti scritte a mano (righe NOTTE) hanno la precedenza: se ci sono
    // tutte e due, quella esplicita vince.
    const gia = new Set(risultato.notti.map((n) => n.data));
    for (const n of perNotte.values()) if (!gia.has(n.data)) risultato.notti.push(n);
  }

  if (
    !risultato.giorni.length &&
    !risultato.notti.length &&
    !risultato.allenamenti.length &&
    !risultato.agenda.length
  ) {
    // Gli avvisi (righe scartate, date non valide) viaggiano con l'errore: senza,
    // chi incolla un pacchetto sbagliato leggeva solo «vuoto» e non capiva perché.
    const err = new Error("Pacchetto riconosciuto ma vuoto: nessun giorno, notte, allenamento o evento.");
    err.avvisi = risultato.avvisi;
    throw err;
  }
  return risultato;
}

/** Elenco di date fra due estremi compresi. */
export function giorniDellaFinestra(da, a) {
  const out = [];
  const d = new Date(da + "T00:00:00");
  const fine = new Date(a + "T00:00:00");
  while (d <= fine) {
    const p = (n) => String(n).padStart(2, "0");
    out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}
