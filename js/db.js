/* Livello dati: IndexedDB, nessuna dipendenza.
   Tutti i dati restano sul dispositivo. */

const DB_NAME = "coach";
const DB_VERSION = 1;

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
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, stores, mode) {
  const t = db.transaction(stores, mode);
  return {
    t,
    done: new Promise((res, rej) => {
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }),
  };
}

const wrap = (req) =>
  new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

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

export async function count(store) {
  const db = await open();
  return wrap(db.transaction(store).objectStore(store).count());
}

/** Identificatore ordinabile per data di creazione, senza dipendenze. */
let seq = 0;
export function nuovoId(prefisso = "id") {
  seq = (seq + 1) % 1000;
  return `${prefisso}_${Date.now().toString(36)}${String(seq).padStart(3, "0")}`;
}

// ---------- backup ----------

/** `salta` evita di leggere store pesanti quando non servono (le foto). */
export async function esportaTutto({ salta = [] } = {}) {
  const dump = { formato: "coach-backup", versione: 1, creatoIl: new Date().toISOString(), dati: {} };
  for (const store of Object.keys(SCHEMA)) {
    dump.dati[store] = salta.includes(store) ? [] : await all(store);
  }
  return dump;
}

/**
 * modo: 'sostituisci' svuota tutto, 'unisci' sovrascrive le chiavi presenti.
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
  const presenti = Object.keys(SCHEMA).filter((s) => Array.isArray(dump.dati?.[s]));
  if (!presenti.length) throw new Error("Il file non contiene nessun dato riconoscibile.");

  const db = await open();
  const { t, done } = tx(db, presenti, "readwrite");
  try {
    for (const store of presenti) {
      const os = t.objectStore(store);
      if (modo === "sostituisci") os.clear();
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
