/* Lettura del pacchetto dati prodotto dallo Shortcut.
   Formato a righe, volutamente tollerante: spazi, maiuscole e campi in più
   non fanno fallire l'import. */

export const VERSIONE = 1;

/**
 * Una data scritta bene non basta: deve anche esistere.
 *
 * Il controllo era solo sulla forma («quattro cifre, due, due»), e «2026-13-45»
 * la passava. Finiva in archivio una giornata inesistente che nessun grafico
 * avrebbe mai mostrato e nessun conto avrebbe mai potuto riconciliare: un dato
 * fantasma, peggio di un dato mancante.
 */
function dataVera(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
  const [a, m, g] = iso.split("-").map(Number);
  if (m < 1 || m > 12 || g < 1) return false;
  const d = new Date(Date.UTC(a, m - 1, g));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g;
}

/**
 * Numeri come li scrive un iPhone italiano: «10.700» sono diecimilasettecento,
 * non dieci virgola sette, e «886,5» ha la virgola decimale. Senza questa
 * distinzione i passi finirebbero divisi per mille senza dare nessun segnale.
 */
const NUMERO = (v, intero = false) => {
  if (v === undefined || v === null || v === "") return null;
  // Un numero negativo qui dentro non esiste: passi, minuti, chilometri,
  // battiti, calorie, risvegli sono tutti conteggi. Se arriva, è una lettura
  // sbagliata dell'orologio o del comando rapido, e vale «non registrato» —
  // non un valore che entra nei punteggi, nelle medie e nei grafici.
  if (/^\s*-/.test(String(v))) return null;
  let t = String(v).trim().replace(/\s|'| /g, "");
  // Campi che sono conteggi e basta — passi, piani, minuti, battiti: un punto
  // seguito da tre cifre lì è per forza il separatore delle migliaia. «9.120
  // passi» sono novemilacentoventi; nove virgola dodici passi non vogliono
  // dire niente. Per kcal e chilometri, che decimali lo sono davvero, resta
  // la regola prudente più sotto.
  if (intero && /^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    const soloCifre = Number(t.replace(/\./g, ""));
    return Number.isFinite(soloCifre) ? soloCifre : null;
  }
  if (t.includes(",")) {
    // virgola decimale: i punti che restano sono separatori di migliaia
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(t)) {
    // Due o più gruppi da tre cifre («1.234.567»): nessun numero decimale si
    // scrive così, quindi sono migliaia. Con UN gruppo solo, no.
    //
    // Prima bastava un gruppo, e «12.836» diventava dodicimilaottocento-
    // trentasei. Ma il comando rapido scrive numeri grezzi col punto decimale
    // — passi=13123 senza separatori, km=7.204671401863114 — e a inizio
    // giornata le calorie attive sono proprio numeri come «12.836», cioè
    // dodici virgola otto. Il risultato era un movimento da 12.836 kcal in una
    // giornata appena cominciata: mille volte tanto, in silenzio, e da lì
    // dentro il punteggio, le medie e il pacchetto per il coach.
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * I campi che ogni tipo di riga sa leggere. Servono a dire quali sono stati
 * ignorati: senza questo elenco un campo scritto male spariva in silenzio.
 * AGENDA resta fuori: il suo titolo è testo libero e può contenere di tutto.
 */
const CHIAVI_NOTE = {
  GIORNO: new Set([
    "kcal", "obiettivo", "passi", "esercizio", "inpiedi", "inpiediore",
    "piani", "km", "metri", "fc",
  ]),
  NOTTE: new Set(["durata", "profondo", "rem", "veglia", "risvegli"]),
  ALLENAMENTO: new Set([
    "uuid", "inizio", "fine", "durata", "kcal", "kcaltot", "km",
    "fcmedia", "fc", "fcmin", "fcmax", "sforzo", "indoor", "tipo",
  ]),
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

  const risultato = { finestra: null, giorni: [], notti: [], allenamenti: [], agenda: [], fasi: [], battiti: [], avvisi: [] };

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
      if (dataVera(da) && dataVera(a)) {
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
      // La forma non basta: «2026-13-45 25:99» ha la forma giusta e non esiste.
      // Passava, diventava una data non valida, e la notte finiva in archivio
      // con la chiave «NaN-NaN-NaN» e i minuti a NaN — un dato fantasma che
      // nessun grafico può mostrare, senza nemmeno un avviso.
      const oraVera = (o) => {
        const m = /^(\d{1,2}):(\d{2})/.exec(o || "");
        return Boolean(m) && Number(m[1]) < 24 && Number(m[2]) < 60;
      };
      const valida = (d, o) => dataVera(d) && oraVera(o);
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

    if (tipo === "BATTITO") {
      // La curva del battito di un allenamento, come la scrive il lettore
      // dell'export:  BATTITO 2026-08-13 07:12 68,72,,75,79
      // Non sono coppie chiave=valore ma un elenco, quindi si legge qui prima
      // che ci provi il lettore generico. Una casella vuota è un buco vero —
      // l'orologio lì non ha misurato — e resta vuota: la linea si spezzerà.
      const [d, ora, ...coda2] = resto;
      // La forma non basta: «09:99» ha la forma di un orario e non esiste. È lo
      // stesso controllo delle righe FASE, per lo stesso motivo.
      const mOra = /^(\d{1,2}):(\d{2})$/.exec(ora || "");
      const oraVera = Boolean(mOra) && Number(mOra[1]) < 24 && Number(mOra[2]) < 60;
      if (!dataVera(d) || !oraVera) {
        risultato.avvisi.push(`Riga BATTITO senza data o ora valida, ignorata: «${riga.slice(0, 44)}»`);
        continue;
      }
      // Ogni casella è «min-max» (la barretta del grafico) oppure un numero
      // solo, che vale sia per il minimo sia per il massimo. I pacchetti
      // scritti prima avevano solo numeri: continuano a leggersi.
      const valori = coda2
        .join("")
        .split(",")
        .map((v) => {
          if (v === "") return null;
          const due = /^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/.exec(v);
          if (due) {
            const min = NUMERO(due[1]);
            const max = NUMERO(due[2]);
            return min != null && max != null ? { min: Math.min(min, max), max: Math.max(min, max) } : null;
          }
          const n = NUMERO(v);
          return n == null ? null : { min: n, max: n };
        });
      if (valori.filter((v) => v != null).length < 3) {
        risultato.avvisi.push(`Riga BATTITO del ${d} ${ora} con troppi pochi valori: ignorata.`);
        continue;
      }
      risultato.battiti.push({ data: d, inizio: ora, valori });
      continue;
    }

    const data = (resto[0] || "").slice(0, 10);
    if (!dataVera(data)) {
      risultato.avvisi.push(`Riga senza data valida, ignorata: «${riga.slice(0, 40)}»`);
      continue;
    }
    // `coda.slice(data.length)` toglie la data e lascia le coppie chiave=valore,
    // anche quando la prima è attaccata alla data senza spazio.
    const c = coppie(coda.slice(data.length));

    // Un valore negativo diventa «non registrato» (vedi NUMERO): va detto, se
    // no un dato sparisce senza che nessuno se ne accorga.
    const negativi = Object.entries(c)
      .filter(([, v]) => /^\s*-\d/.test(String(v)))
      .map(([k]) => k);
    if (negativi.length) {
      risultato.avvisi.push(
        `${data}: ${negativi.join(", ")} ${negativi.length === 1 ? "ha un valore negativo e resta" : "hanno valori negativi e restano"} non registrat${negativi.length === 1 ? "o" : "i"}.`
      );
    }

    // Una chiave che l'app non conosce — «fcmed» invece di «fcmedia», «step»
    // invece di «passi» — veniva letta e buttata via senza una parola: il dato
    // spariva e il comando rapido sembrava a posto. Un errore di battitura nel
    // comando si scopre solo così.
    const note = CHIAVI_NOTE[tipo];
    if (note) {
      const sconosciute = Object.keys(c).filter((k) => !note.has(k));
      if (sconosciute.length) {
        risultato.avvisi.push(
          `${data}: ${sconosciute.join(", ")} non ${sconosciute.length === 1 ? "è un campo" : "sono campi"} che l'app conosce per ${tipo}, quindi ${sconosciute.length === 1 ? "è stato ignorato" : "sono stati ignorati"}.`
        );
      }
    }

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
        passi: NUMERO(c.passi, true),
        minutiEsercizio: NUMERO(c.esercizio, true),
        // «inpiedi» sono MINUTI: è quello che l'iPhone espone (tempo in piedi,
        // non il conteggio delle ore dell'anello). Chi avesse le ore può usare
        // «inpiediore» e vengono convertite.
        minutiInPiedi:
          NUMERO(c.inpiedi, true) != null
            ? NUMERO(c.inpiedi, true)
            : NUMERO(c.inpiediore) != null
              ? Math.round(NUMERO(c.inpiediore) * 60)
              : null,
        pianiSaliti: NUMERO(c.piani, true),
        distanzaKm: km != null ? km : metri != null ? Math.round((metri / 1000) * 100) / 100 : null,
        fcRiposo: NUMERO(c.fc, true),
      });
    } else if (tipo === "NOTTE") {
      risultato.notti.push({
        data,
        presente: true,
        durataMin: NUMERO(c.durata, true),
        profondoMin: NUMERO(c.profondo, true),
        remMin: NUMERO(c.rem, true),
        vegliaMin: NUMERO(c.veglia, true),
        risvegli: NUMERO(c.risvegli, true),
      });
    } else if (tipo === "ALLENAMENTO") {
      risultato.allenamenti.push({
        // Senza uuid la chiave la costruiamo noi, e ci va anche il tipo: una
        // camminata e una corsa cominciate nello stesso minuto e lunghe uguale
        // avevano la stessa chiave, e la seconda cancellava la prima. Con il
        // tipo dentro restano due allenamenti diversi; due righe identiche in
        // tutto restano una sola, che è quello che si vuole quando lo stesso
        // export viene importato due volte.
        uuid: c.uuid || `${data}-${c.inizio || "00:00"}-${c.durata || 0}-${(c.tipo || "?").toLowerCase()}`,
        data,
        inizio: c.inizio || null,
        fine: c.fine || null,
        durataSec: NUMERO(c.durata),
        km: NUMERO(c.km),
        fcMin: NUMERO(c.fcmin),
        kcalAttive: NUMERO(c.kcal),
        kcalTotali: NUMERO(c.kcaltot),
        // Su una riga GIORNO «fc» è la frequenza a riposo, e chi scrive il
        // comando rapido la riusa qui per la media dell'allenamento: è la cosa
        // più naturale da fare. Su un allenamento «fc» non può voler dire
        // altro, quindi vale come «fcmedia» invece di finire nel nulla.
        fcMedia: NUMERO(c.fcmedia) ?? NUMERO(c.fc),
        fcMax: NUMERO(c.fcmax),
        // Lo «Sforzo» dell'orologio, da 1 a 10. Fuori da quella scala non è
        // quel dato: meglio niente che un numero che non si sa cosa sia.
        sforzo: (() => {
          const v = NUMERO(c.sforzo);
          return v != null && v >= 1 && v <= 10 ? v : null;
        })(),
        // Al chiuso o all'aperto. Assente vuol dire «non lo so», non «fuori»:
        // gli allenamenti importati prima non portavano questo dato.
        indoor: c.indoor == null ? null : String(c.indoor) === "1" || /^(true|yes|si|sì)$/i.test(String(c.indoor)),
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

  // Le fasi diventano notti, e una notte porta la data del giorno in cui ci si
  // SVEGLIA: è la convenzione che usa tutto il resto dell'app — il punteggio
  // Salute del giorno X cerca la notte X, cioè quella cominciata la sera prima
  // e finita quella mattina.
  //
  // Prima qui si faceva l'opposto (etichettare con la sera in cui la notte
  // comincia) e le due convenzioni si davano battaglia: ogni notte finiva
  // archiviata con un giorno di anticipo, quella dell'ultima nottata non
  // compariva mai, e il sonno risultava semplicemente assente dal grafico.
  // Chi va a letto dopo mezzanotte lo vedeva peggio di tutti: addormentandosi
  // alle 3, la notte finiva sul giorno prima ancora.
  if (risultato.fasi.length) {
    const perNotte = new Map();
    const sonnellini = [];
    const p2 = (n) => String(n).padStart(2, "0");
    for (const f of risultato.fasi) {
      const inizio = new Date(f.inizio);
      const fine = new Date(f.fine);
      // Su un oggetto Date, `Number.isNaN` è sempre falso: il controllo di
      // prima non fermava niente e una data impossibile arrivava fin qui.
      if (Number.isNaN(inizio.getTime()) || Number.isNaN(fine.getTime())) continue;
      let minuti = Math.round((fine - inizio) / 60000);
      if (!Number.isFinite(minuti)) continue;
      // Una fase che scavalca la mezzanotte con la data di fine sbagliata
      // darebbe minuti negativi: si assume il giorno dopo.
      if (minuti < 0) minuti += 24 * 60;
      if (minuti <= 0 || minuti > 12 * 60) continue;

      // Una fase che comincia di sera finisce il giorno dopo: la notte è quella
      // del risveglio. Una che comincia dopo mezzanotte finisce nello stesso
      // giorno in cui è cominciata.
      //
      // Il taglio era a mezzogiorno, e cosi un sonnellino delle 15 diventava
      // «la notte di domani», cominciata alle 15: si mangiava la notte vera e
      // il punteggio del sonno del giorno dopo. Le ore centrali della giornata
      // non sono nessuna delle due notti: quel sonno c'è stato, ma non è la
      // notte, e viene detto invece di essere impastato con lei.
      const ora = inizio.getHours();
      if (ora >= 11 && ora < 18) {
        sonnellini.push({ quando: `${p2(inizio.getDate())}/${p2(inizio.getMonth() + 1)} alle ${p2(ora)}:${p2(inizio.getMinutes())}`, minuti });
        continue;
      }
      const notte = new Date(inizio);
      if (ora >= 18) notte.setDate(notte.getDate() + 1);
      const p = (n) => String(n).padStart(2, "0");
      const chiave = `${notte.getFullYear()}-${p(notte.getMonth() + 1)}-${p(notte.getDate())}`;

      if (!perNotte.has(chiave)) {
        perNotte.set(chiave, { data: chiave, presente: true, durataMin: 0, profondoMin: 0, remMin: 0, vegliaMin: 0, risvegli: 0, inizio: null });
      }
      const n = perNotte.get(chiave);
      // L'ora in cui la notte comincia: non è un dettaglio di contorno, entra
      // nel punteggio. Si tiene la fase più antica della notte, non la prima
      // che capita nel pacchetto, che non è detto sia in ordine.
      if (!n.inizio || f.inizio < n.inizio) n.inizio = f.inizio;
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
    // I sonnellini si dicono: sono sonno vero, ma non sono la notte, e sapere
    // che ci sono spiega una notte più corta del solito.
    if (sonnellini.length) {
      const totale = sonnellini.reduce((t, x) => t + x.minuti, 0);
      const elenco = sonnellini.slice(0, 3).map((x) => `${x.quando} (${x.minuti} min)`).join(", ");
      risultato.avvisi.push(
        `${sonnellini.length} ${sonnellini.length === 1 ? "sonnellino di giorno" : "sonnellini di giorno"} per ${totale} minuti in tutto` +
          `${elenco ? `: ${elenco}` : ""}${sonnellini.length > 3 ? " e altri" : ""}. Restano fuori dalle notti: il punteggio del sonno guarda la notte, non il pomeriggio.`
      );
    }
  }

  // Ogni curva va attaccata al suo allenamento: si riconoscono per giorno e ora
  // d'inizio, che è la stessa coppia con cui è stata scritta. Una curva che non
  // trova il suo allenamento viene detta invece di sparire: vuol dire che le due
  // righe non si corrispondono, ed è un errore di chi ha scritto il pacchetto.
  for (const b of risultato.battiti) {
    const suo = risultato.allenamenti.find((a) => a.data === b.data && a.inizio === b.inizio);
    if (!suo) {
      risultato.avvisi.push(`Curva del battito del ${b.data} ${b.inizio} senza un allenamento a cui riferirsi: ignorata.`);
      continue;
    }
    suo.battito = b.valori;
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
