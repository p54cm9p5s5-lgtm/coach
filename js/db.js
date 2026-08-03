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
    req.onsuccess = () => resolve(req.result);
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

export async function esportaTutto() {
  const dump = { formato: "coach-backup", versione: 1, creatoIl: new Date().toISOString(), dati: {} };
  for (const store of Object.keys(SCHEMA)) dump.dati[store] = await all(store);
  return dump;
}

/** modo: 'sostituisci' svuota tutto, 'unisci' sovrascrive solo le chiavi presenti. */
export async function importaTutto(dump, modo = "sostituisci") {
  if (!dump || dump.formato !== "coach-backup") {
    throw new Error("File non riconosciuto: manca l'intestazione coach-backup.");
  }
  for (const store of Object.keys(SCHEMA)) {
    const righe = dump.dati?.[store];
    if (!Array.isArray(righe)) continue;
    if (modo === "sostituisci") await clearStore(store);
    await putMany(store, righe);
  }
}
