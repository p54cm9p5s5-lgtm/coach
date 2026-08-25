/* Livello dati: IndexedDB, nessuna dipendenza.
   Tutti i dati restano sul dispositivo. */

const DB_NAME = "coach";
// Sale solo quando si aggiunge un archivio: l'aggiornamento qui sotto crea
// quello che manca e non tocca niente di quello che c'è già.
const DB_VERSION = 6;

/** store -> { keyPath, indexes: { nome: keyPath } } */
export const SCHEMA = {
  impostazioni: { keyPath: "chiave" },
  programma: { keyPath: "id" },
  esercizi: { keyPath: "id" },
  sedute: { keyPath: "id", indexes: { data: "data" } },
  serie: { keyPath: "id", indexes: { sedutaId: "sedutaId", esercizioId: "esercizioId" } },
  esercizioLog: {
    keyPath: "id",
    indexes: { sedutaId: "sedutaId", esercizioId: "esercizioId" },
  },
  misure: { keyPath: "id", indexes: { data: "data", tipo: "tipo" } },
  foto: { keyPath: "id", indexes: { data: "data" } },
  giorniSalute: { keyPath: "data" },
  notti: { keyPath: "data" },
  allenamentiWatch: { keyPath: "uuid", indexes: { sedutaId: "sedutaId" } },
  proposte: { keyPath: "id", indexes: { stato: "stato", esercizioId: "esercizioId" } },
  decisioni: { keyPath: "id", indexes: { data: "data" } },
  segnali: { keyPath: "id", indexes: { data: "data" } },
  // Una riga per sigaretta, non un totale al giorno: l'ora serve a vedere
  // quando capitano, e disfare l'ultima diventa togliere una riga.
  fumo: { keyPath: "id", indexes: { data: "data" } },
  // Una riga al giorno: hai bevuto abbastanza, sì o no. La data è la chiave,
  // quindi rispondere due volte lo stesso giorno corregge invece di sommare.
  acqua: { keyPath: "data" },
  // Attività fuori scheda: una corsa, una camminata, una nuotata. Più d'una
  // nello stesso giorno è normale, quindi la chiave è la riga e non la data.
  extra: { keyPath: "id", indexes: { data: "data" } },
  // Quello che scrivi tu su un allenamento dell'orologio: il talk-test e una
  // nota. Sta in un archivio a parte e non dentro `allenamentiWatch` per una
  // ragione precisa: quello è roba dell'orologio, si riscrive a ogni import e
  // si può svuotare in blocco. Quello che scrivi tu non deve sparire con lui.
  // Chiave: lo stesso uuid dell'allenamento.
  noteWatch: { keyPath: "uuid" },
  // Le copertine dei video, scaricate una volta sola e tenute qui.
  //
  // Non sono un tuo dato: sono immagini pubbliche di YouTube. Stanno in un
  // archivio a parte per due motivi — restano fuori dai backup (peserebbero
  // più di tutto il resto messo insieme) e si possono buttare in blocco senza
  // toccare niente di tuo. Chiave: l'id del video.
  copertine: { keyPath: "id" },
};

let dbPromise = null;

export function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, def] of Object.entries(SCHEMA)) {
        const store = db.objectStoreNames.contains(name)
          ? req.transaction.objectStore(name)
          : db.createObjectStore(name, { keyPath: def.keyPath });
        for (const [idx, path] of Object.entries(def.indexes || {})) {
          if (!store.indexNames.contains(idx)) store.createIndex(idx, path);
        }
      }
    };
    // Se un'altra scheda tiene aperta la versione vecchia, l'aggiornamento
    // resterebbe in attesa per sempre e l'app non partirebbe più.
    req.onblocked = () =>
      reject(new Error("L'archivio è aperto in un'altra scheda: chiudila e riapri l'app."));
    req.onsuccess = () => {
      const database = req.result;
      // Quando una scheda nuova porta uno schema nuovo, questa si fa da parte.
      database.onversionchange = () => {
        database.close();
        dbPromise = null;
      };
      resolve(database);
    };
    req.onerror = () => {
      // «The requested version (3) is less than the existing version (4)» è la
      // frase del browser per una cosa che ha un significato preciso e una
      // soluzione precisa: un'altra scheda ha già aggiornato l'app, e questa è
      // rimasta a una versione che quell'archivio non sa più leggere. Detto in
      // inglese e con due numeri non aiuta nessuno, e finisce a schermo tale e
      // quale nella pagina «questa schermata non si è aperta».
      if (req.error?.name === "VersionError") {
        reject(
          new Error(
            "Questa scheda ha una versione dell'app più vecchia dell'archivio: " +
              "un'altra scheda l'ha già aggiornata. Chiudi le altre schede di Coach e ricarica."
          )
        );
        return;
      }
      reject(req.error);
    };
  });
  // Un fallimento non resta memorizzato: senza questo, un errore momentaneo
  // (archivio occupato da un'altra scheda) rendeva l'app inutilizzabile fino
  // al riavvio, perché ogni tentativo successivo riusava la stessa promessa
  // già fallita.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx(db, stores, mode) {
  const t = db.transaction(stores, mode);
  return {
    t,
    done: new Promise((res, rej) => {
      t.oncomplete = () => res();
      // Un'operazione annullata NON porta sempre con sé il motivo: t.error può
      // essere vuoto, e allora l'errore arrivava senza messaggio — l'app
      // sembrava non fare niente invece di dire che non aveva salvato.
      t.onerror = () => rej(t.error || new Error("Scrittura non riuscita nell'archivio del telefono."));
      t.onabort = () =>
        rej(
          t.error ||
            new Error("Scrittura annullata dal telefono: di solito è lo spazio finito.")
        );
    }),
  };
}

const wrap = (req) =>
  new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

/**
 * Gli archivi che il telefono non ha ancora.
 *
 * Gli archivi nuovi li crea l'aggiornamento di versione qui sopra, e solo
 * quello: questa funzione non ne crea nessuno, si limita a dire quali mancano.
 * Serve a backup e ripristino, che senza questo controllo fallirebbero in
 * silenzio su un archivio inesistente — per esempio su un telefono che non ha
 * ancora aperto la versione che ha introdotto «acqua».
 */
export async function archiviMancanti() {
  const db = await open();
  return Object.keys(SCHEMA).filter((s) => !db.objectStoreNames.contains(s));
}

export async function get(store, key) {
  const db = await open();
  return wrap(db.transaction(store).objectStore(store).get(key));
}

export async function all(store) {
  const db = await open();
  return wrap(db.transaction(store).objectStore(store).getAll());
}

export async function byIndex(store, index, value) {
  const db = await open();
  return wrap(db.transaction(store).objectStore(store).index(index).getAll(value));
}

export async function put(store, value) {
  const db = await open();
  const { t, done } = tx(db, [store], "readwrite");
  t.objectStore(store).put(value);
  await done;
  return value;
}

export async function putMany(store, values) {
  if (!values.length) return values;
  const db = await open();
  const { t, done } = tx(db, [store], "readwrite");
  const os = t.objectStore(store);
  for (const v of values) os.put(v);
  await done;
  return values;
}

/**
 * Cancella righe da più archivi in **una sola transazione**: o spariscono
 * tutte o non ne sparisce nessuna.
 *
 * Serve dove una cancellazione a metà lascia l'archivio in uno stato che non
 * è mai esistito — annullare un allenamento, per esempio: cancellando serie e
 * questionari uno per uno, un'interruzione a metà lasciava la seduta al suo
 * posto con tre serie su cinque.
 *
 * @param gruppi { nomeArchivio: [chiavi...] }
 */
export async function delMulti(gruppi) {
  const nomi = Object.keys(gruppi).filter((n) => (gruppi[n] || []).length);
  if (!nomi.length) return 0;
  const db = await open();
  const { t, done } = tx(db, nomi, "readwrite");
  let quante = 0;
  try {
    for (const nome of nomi) {
      const os = t.objectStore(nome);
      for (const k of gruppi[nome]) {
        os.delete(k);
        quante++;
      }
    }
  } catch (e) {
    // Senza abort esplicito la transazione si chiuderebbe da sola applicando
    // le cancellazioni già accodate: esattamente il caso a metà da evitare.
    try {
      t.abort();
    } catch {
      /* già annullata */
    }
    throw e;
  }
  await done;
  return quante;
}

export async function del(store, key) {
  const db = await open();
  const { t, done } = tx(db, [store], "readwrite");
  t.objectStore(store).delete(key);
  await done;
}

export async function clearStore(store) {
  const db = await open();
  const { t, done } = tx(db, [store], "readwrite");
  t.objectStore(store).clear();
  await done;
}

/**
 * Svuota tutto in un colpo solo: o si cancella tutto, o non si cancella
 * niente. A pezzi, un'interruzione lasciava l'app con metà archivio.
 */
export async function svuotaTutto() {
  const db = await open();
  const mancanti = await archiviMancanti();
  const presenti = Object.keys(SCHEMA).filter((s) => !mancanti.includes(s));
  const { t, done } = tx(db, presenti, "readwrite");
  for (const s of presenti) t.objectStore(s).clear();
  await done;
  return presenti;
}

export async function count(store) {
  const db = await open();
  return wrap(db.transaction(store).objectStore(store).count());
}

/**
 * Identificatore ordinabile per data di creazione, senza dipendenze.
 *
 * Il contatore si azzera a ogni millisecondo nuovo e **non cicla** dentro lo
 * stesso: prima tornava a zero ogni mille, e mille id nello stesso
 * millisecondo producevano due volte lo stesso identificatore. Su 5.000
 * generati in raffica ne uscivano 4.862 diversi — e un id ripetuto non dà
 * errore: **sovrascrive** il record che c'era, in silenzio. Non capita
 * registrando una serie alla volta, ma capita dove i record nascono a
 * pacchetti, ed è esattamente il posto dove non ci si accorgerebbe di niente.
 */
let seq = 0;
let ultimoMs = 0;
export function nuovoId(prefisso = "id") {
  const ora = Date.now();
  if (ora === ultimoMs) {
    seq += 1;
  } else {
    ultimoMs = ora;
    seq = 0;
  }
  // Tre cifre bastano quasi sempre; oltre, il numero si allunga invece di
  // ripartire da capo. Un id più lungo non fa danno, un id ripetuto sì.
  return `${prefisso}_${ora.toString(36)}${String(seq).padStart(3, "0")}`;
}

// ---------- backup ----------

/** Versione del formato di backup che questa app sa scrivere e rileggere. */
export const VERSIONE_BACKUP = 1;

/** `salta` evita di leggere store pesanti quando non servono (le foto). */
export async function esportaTutto({ salta = [] } = {}) {
  const dump = { formato: "coach-backup", versione: VERSIONE_BACKUP, creatoIl: new Date().toISOString(), dati: {} };
  const mancanti = await archiviMancanti();
  for (const store of Object.keys(SCHEMA)) {
    // Un archivio che su questo telefono non esiste non è un errore: si salta,
    // e si dice che manca. Prima l'intero backup falliva.
    if (mancanti.includes(store)) continue;
    dump.dati[store] = salta.includes(store) ? [] : await all(store);
  }
  if (mancanti.length) dump.archiviAssenti = mancanti;
  return dump;
}

/**
 * modo: 'sostituisci' svuota tutto, 'unisci' sovrascrive le chiavi presenti.
 *
 * Oggi l'app chiama sempre 'sostituisci': il ripristino da file è uno solo, e
 * il foglio di conferma promette esattamente quello. La modalità 'unisci' resta
 * qui perché è il mattone su cui si appoggia il ripristino della copia interna,
 * ma non c'è nessuna strada dall'interfaccia che la scelga da sola.
 *
 * Tutto avviene in UNA transazione sola: prima si svuota e poi si riscrive
 * dentro lo stesso blocco, così se qualcosa va storto a metà il database torna
 * com'era. Prima erano decine di transazioni separate: un'interruzione
 * lasciava l'archivio mezzo cancellato, senza modo di tornare indietro.
 */
export async function importaTutto(dump, modo = "sostituisci") {
  if (!dump || dump.formato !== "coach-backup") {
    throw new Error("File non riconosciuto: manca l'intestazione coach-backup.");
  }
  // Una versione che non è un numero non dice niente: il file può venire da
  // qualsiasi versione, anche molto più nuova. Prima passava il controllo qui
  // sotto — «boh» non è maggiore di 1 — e veniva importato come se fosse la
  // v1. Un file senza il campo resta buono: le prime copie non lo scrivevano.
  if (dump.versione !== undefined && !Number.isFinite(Number(dump.versione))) {
    throw new Error(
      `Il file dice di essere in formato «${dump.versione}», che non è una versione. Non ho toccato niente.`
    );
  }
  // Un file scritto da una versione più nuova può contenere cose che questa
  // app non sa leggere: importarlo lo stesso significherebbe ricostruire un
  // archivio a metà senza dirlo.
  if (Number(dump.versione) > VERSIONE_BACKUP) {
    throw new Error(
      `Il file è in formato v${dump.versione}, questa app legge la v${VERSIONE_BACKUP}. Aggiorna l'app e riprova: così com'è non lo tocco.`
    );
  }
  // Un file troncato o modificato a mano può avere una sezione illeggibile.
  // Prima quella sezione veniva semplicemente saltata — ma in «sostituisci»
  // era già stata svuotata, e i dati sparivano senza un avviso.
  const rotte = Object.entries(dump.dati || {})
    .filter(([nome, v]) => nome in SCHEMA && !Array.isArray(v))
    .map(([nome]) => nome);
  if (rotte.length) {
    throw new Error(
      `Il file è danneggiato: ${rotte.length === 1 ? "la sezione" : "le sezioni"} «${rotte.join("», «")}» non ${rotte.length === 1 ? "è leggibile" : "sono leggibili"}. Non ho toccato niente.`
    );
  }
  // Righe che non sono nemmeno oggetti, o senza la chiave del loro archivio:
  // IndexedDB le rifiuta con un errore in inglese che finiva dritto sullo
  // schermo, in mezzo a una frase italiana. Meglio accorgersene prima e dirlo
  // con le stesse parole delle altre sezioni rotte.
  const conRigheRotte = [];
  for (const [nome, righe] of Object.entries(dump.dati || {})) {
    if (!(nome in SCHEMA) || !Array.isArray(righe)) continue;
    const chiave = SCHEMA[nome].keyPath;
    const rotte = righe.filter(
      (r) => !r || typeof r !== "object" || Array.isArray(r) || r[chiave] === undefined || r[chiave] === null
    ).length;
    if (rotte) conRigheRotte.push(`«${nome}» (${rotte} ${rotte === 1 ? "riga" : "righe"})`);
  }
  if (conRigheRotte.length) {
    throw new Error(
      `Il file è danneggiato: ${conRigheRotte.join(", ")} non ${conRigheRotte.length === 1 ? "ha una forma" : "hanno una forma"} leggibile. Non ho toccato niente.`
    );
  }

  // Si scrive solo negli archivi che questo telefono ha davvero: nominarne uno
  // inesistente farebbe fallire tutto il ripristino, dati validi compresi.
  const mancanti = await archiviMancanti();
  const presenti = Object.keys(SCHEMA).filter(
    (s) => !mancanti.includes(s) && Array.isArray(dump.dati?.[s])
  );
  if (!presenti.length) throw new Error("Il file non contiene nessun dato riconoscibile.");

  // Una copia può dichiararsi parziale: la copia interna, per esempio, non
  // contiene le foto (pesano troppo per rifarla ogni volta). Un elenco vuoto
  // NON significa «cancella tutto»: significa «di questo non so niente».
  // Prima ripristinare la copia interna cancellava tutte le foto del corpo.
  const senzaOpinione = new Set(Array.isArray(dump.parziale) ? dump.parziale : []);
  const daScrivere = presenti.filter((s) => !senzaOpinione.has(s));

  // «Sostituisci tutto» deve sostituire davvero: gli archivi che il file NON
  // nomina vanno svuotati lo stesso (a meno che il file dichiari di non saperne
  // niente). Prima restavano i dati vecchi mescolati ai nuovi, e l'archivio
  // finiva in uno stato che non è mai esistito.
  const daSvuotare =
    modo === "sostituisci"
      ? Object.keys(SCHEMA).filter((s) => !mancanti.includes(s) && !senzaOpinione.has(s))
      : [];
  const coinvolti = [...new Set([...daScrivere, ...daSvuotare])];

  const db = await open();
  const { t, done } = tx(db, coinvolti, "readwrite");
  try {
    for (const store of daSvuotare) t.objectStore(store).clear();
    for (const store of daScrivere) {
      const os = t.objectStore(store);
      if (modo === "sostituisci" && !daSvuotare.includes(store)) os.clear();
      for (const riga of dump.dati[store]) os.put(riga);
    }
  } catch (e) {
    // Una riga malformata solleva subito: senza abort esplicito la transazione
    // si chiuderebbe da sola con lo svuotamento già applicato, cioè il caso
    // peggiore — archivio vuoto e dati nuovi mai scritti.
    try {
      t.abort();
    } catch {
      /* già abortita */
    }
    throw new Error(`Ripristino annullato, archivio invariato: ${e.message}`);
  }
  await done;
  // Quello che il file conteneva e questo telefono non sa dove mettere va
  // detto, non inghiottito in silenzio.
  const ignorati = Object.keys(dump.dati || {}).filter(
    (nome) => !Object.keys(SCHEMA).includes(nome) || mancanti.includes(nome)
  );
  return { scritti: daScrivere, svuotati: daSvuotare, ignorati };
}

/**
 * Chiede a iOS di non buttare via l'archivio quando lo spazio scarseggia.
 * Senza, i dati di un'app installata dalla schermata Home sono considerati
 * cancellabili: mesi di allenamenti possono sparire senza preavviso.
 */
export async function rendiPersistente() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
