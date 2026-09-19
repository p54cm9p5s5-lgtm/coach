/* Sincronizzazione fra iPhone e Mac, cifrata sul dispositivo.

   Una scelta dell'utente del 19/09/2026, e cambia una regola che valeva da
   sempre: fino a qui niente usciva dal telefono. Adesso, SE la accendi, esce
   una cosa sola — l'archivio cifrato con una frase che conosci solo tu — e va
   in un repository PRIVATO del tuo GitHub. Chi lo custodisce vede solo byte
   illeggibili; senza la frase non si apre, nemmeno da parte tua.

   Si registra da tutti e due. Il primo giorno l'iPhone scriveva e il Mac
   leggeva soltanto; la sera stessa: «voglio poter registrare anche da Mac».
   Fondere due archivi è possibile se ognuno si ricorda com'erano le righe
   all'ultimo scambio (`impronte`): così, per ogni riga, si sa CHI l'ha cambiata —
   aggiunta, modificata o cancellata — e si tiene quel cambiamento. Il solo
   caso che non si risolve da sé è la stessa riga cambiata da tutte e due le
   parti fra uno scambio e l'altro: lì si tiene una versione e si dice quale,
   in Impostazioni. Vedi `unisci`.

   Ogni dispositivo, ogni secondo e mezzo mentre è aperto, guarda se di là è
   cambiato qualcosa; a ogni salvataggio, dopo 300 ms, fonde e manda.

   La configurazione — token, chiave, impronte — vive in un archivio A PARTE
   («coach-sync»), fuori da quello dell'app: non finisce nei backup su file,
   non viaggia dentro la sincronizzazione stessa, e un ripristino non la
   cancella. La frase non si salva da nessuna parte: si salva la chiave che ne
   deriva, e il browser la tiene come «non estraibile» — si può usare per
   cifrare, non si può leggere. */

import * as db from "./db.js";

const API = "https://api.github.com";
const FORMATO = "coach-sync";
const VERSIONE = 1;
const ITERAZIONI = 600000;
/* Due file e non uno: le foto pesano più di tutto il resto messo insieme e
   cambiano una volta a settimana. Rimandarle a ogni serie registrata
   vorrebbe dire spedire megabyte per scrivere un numero. */
const PARTI = {
  dati: { file: "coach-dati.json" },
  foto: { file: "coach-foto.json", archivi: ["foto"] },
};
/* Mai sincronizzate: le copertine dei video non sono tue, si riscaricano. */
const FUORI = ["copertine"];

// ---------- configurazione, nel suo archivio ----------

const CONF_DB = "coach-sync";
let confPromise = null;

function apriConf() {
  if (confPromise) return confPromise;
  confPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(CONF_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("conf");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return confPromise;
}

async function leggiConf() {
  const c = await apriConf();
  return new Promise((resolve, reject) => {
    const r = c.transaction("conf").objectStore("conf").get("c");
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
}

async function scriviConf(valore) {
  const c = await apriConf();
  return new Promise((resolve, reject) => {
    const t = c.transaction("conf", "readwrite");
    if (valore) t.objectStore("conf").put(valore, "c");
    else t.objectStore("conf").delete("c");
    t.oncomplete = () => resolve(valore);
    t.onerror = () => reject(t.error);
  });
}

/** Aggiorna solo i campi dati, rileggendo il resto: due giri che si
 *  sovrappongono non si cancellano a vicenda lo stato. */
async function ritocca(campi) {
  const c = await leggiConf();
  if (!c) return null;
  return scriviConf({ ...c, ...campi });
}

// ---------- cifratura ----------

function inBase64(byte) {
  let s = "";
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode(...byte.subarray(i, i + 0x8000));
  return btoa(s);
}

function daBase64(testo) {
  const s = atob(String(testo).replace(/\s+/g, ""));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function derivaChiave(frase, sale) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(frase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: sale, iterations: ITERAZIONI },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function comprimi(byte) {
  if (typeof CompressionStream === "undefined") return { byte, compresso: false };
  const s = new Blob([byte]).stream().pipeThrough(new CompressionStream("gzip"));
  return { byte: new Uint8Array(await new Response(s).arrayBuffer()), compresso: true };
}

async function decomprimi(byte) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Questo browser non sa aprire i dati compressi: aggiornalo e riprova.");
  }
  const s = new Blob([byte]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** Busta: si legge in chiaro solo quello che serve ad aprirla. */
export async function sigilla(contenuto, chiave, { sale, dispositivo }) {
  const { byte, compresso } = await comprimi(new TextEncoder().encode(JSON.stringify(contenuto)));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrato = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chiave, byte));
  return {
    formato: FORMATO,
    versione: VERSIONE,
    sale: inBase64(sale),
    iv: inBase64(iv),
    compresso,
    scrittoDa: dispositivo,
    scrittoIl: new Date().toISOString(),
    dati: inBase64(cifrato),
  };
}

export class FraseSbagliata extends Error {}

export async function apri(busta, chiave) {
  if (!busta || busta.formato !== FORMATO) throw new Error("Nel deposito c'è un file che non è di Coach.");
  if (Number(busta.versione) > VERSIONE) {
    throw new Error(`I dati sono stati scritti da una versione più nuova dell'app (v${busta.versione}): aggiorna Coach anche qui.`);
  }
  let chiaro;
  try {
    chiaro = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: daBase64(busta.iv) }, chiave, daBase64(busta.dati))
    );
  } catch {
    // AES-GCM non distingue «frase sbagliata» da «file manomesso»: in tutti e
    // due i casi non si apre, ed è giusto così.
    throw new FraseSbagliata("La frase non apre questi dati: controlla di averla scritta uguale sull'iPhone.");
  }
  if (busta.compresso) chiaro = await decomprimi(chiaro);
  return JSON.parse(new TextDecoder().decode(chiaro));
}

// ---------- il deposito su GitHub ----------

/** Cosa dire quando GitHub risponde di no — con le parole di chi usa l'app. */
function erroreDiGitHub(stato, cosa) {
  if (stato === 401) return new Error("GitHub non riconosce il token: forse è scaduto. Creane uno nuovo e reinseriscilo.");
  if (stato === 403) return new Error("Il token non ha il permesso di scrivere: serve «Contents: Read and write» su quel repository.");
  if (stato === 404) return new Error("GitHub non trova il repository: controlla il nome (utente/nome) e che il token lo possa vedere.");
  return new Error(`GitHub ha risposto ${stato} ${cosa}.`);
}

function intestazioni(conf, extra = {}) {
  return {
    Authorization: `Bearer ${conf.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

function indirizzo(conf, file = "") {
  const [utente, repo] = String(conf.repo).split("/");
  const base = conf.base || API;
  return `${base}/repos/${encodeURIComponent(utente)}/${encodeURIComponent(repo)}${file ? `/contents/${file}` : ""}`;
}

/** Il repository esiste, è privato, e questo token ci può scrivere? */
async function controllaRepo(conf, { scrive }) {
  const r = await fetch(indirizzo(conf), { headers: intestazioni(conf), cache: "no-store" });
  if (!r.ok) throw erroreDiGitHub(r.status, "aprendo il repository");
  const info = await r.json();
  // Un repository pubblico no, anche se i dati sono cifrati: la frase è
  // l'unica protezione, e non c'è motivo di esporli a chiunque per provarci.
  if (info.private === false) throw new Error("Il repository è pubblico: rendilo privato su GitHub, poi riprova.");
  if (scrive && info.permissions && info.permissions.push === false) {
    throw new Error("Il token può leggere ma non scrivere: serve «Contents: Read and write».");
  }
}

/** { sha, busta } oppure null se il file non c'è ancora. */
async function leggiFile(conf, file) {
  const r = await fetch(indirizzo(conf, file), { headers: intestazioni(conf), cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw erroreDiGitHub(r.status, `leggendo ${file}`);
  const info = await r.json();
  let testo;
  // Sopra un mega GitHub non manda il contenuto dentro la risposta: va chiesto
  // a parte, «grezzo».
  if (info.encoding === "base64" && info.content) {
    testo = new TextDecoder().decode(daBase64(info.content));
  } else {
    const g = await fetch(indirizzo(conf, file), {
      headers: intestazioni(conf, { Accept: "application/vnd.github.raw+json" }),
      cache: "no-store",
    });
    if (!g.ok) throw erroreDiGitHub(g.status, `scaricando ${file}`);
    testo = await g.text();
  }
  return { sha: info.sha, busta: JSON.parse(testo) };
}

/**
 * Gli sha dei file nella radice del repository, senza scaricarne nessuno.
 * È la domanda che ogni dispositivo fa di continuo: «è cambiato qualcosa?». Chiedere
 * i file uno per uno scaricherebbe ogni volta i dati interi, anche se sono gli
 * stessi di un minuto fa.
 */
let elencoEtag = null;
let elencoUltimo = null;

async function shaDeiFile(conf) {
  // La domanda si fa «condizionata»: se niente è cambiato GitHub risponde 304
  // senza contenuto, e quelle risposte NON contano nel limite di richieste
  // l'ora. È quello che permette di chiedere ogni secondo e mezzo invece che
  // ogni 5: prima ogni domanda consumava il limite, e più spesso di così i due
  // dispositivi insieme l'avrebbero finito.
  const extra = elencoEtag && elencoUltimo ? { "If-None-Match": elencoEtag } : {};
  const r = await fetch(`${indirizzo(conf)}/contents/`, { headers: intestazioni(conf, extra), cache: "no-store" });
  if (r.status === 304 && elencoUltimo) return elencoUltimo;
  if (r.status === 404) return {};
  if (!r.ok) throw erroreDiGitHub(r.status, "guardando cosa c'è nel repository");
  const elenco = await r.json();
  elencoEtag = r.headers.get("ETag");
  elencoUltimo = Object.fromEntries((Array.isArray(elenco) ? elenco : []).map((f) => [f.name, f.sha]));
  return elencoUltimo;
}

class Conflitto extends Error {}

async function scriviFile(conf, file, busta, sha) {
  const corpo = {
    message: `Coach · ${file} · ${busta.scrittoIl}`,
    content: inBase64(new TextEncoder().encode(JSON.stringify(busta))),
  };
  if (sha) corpo.sha = sha;
  const r = await fetch(indirizzo(conf, file), {
    method: "PUT",
    headers: intestazioni(conf, { "Content-Type": "application/json" }),
    body: JSON.stringify(corpo),
  });
  if (r.status === 409 || r.status === 422) throw new Conflitto(`${file} è cambiato nel frattempo`);
  if (!r.ok) throw erroreDiGitHub(r.status, `salvando ${file}`);
  return (await r.json()).content?.sha;
}

// ---------- cosa viaggia ----------

function parteDi(archivio) {
  if (FUORI.includes(archivio)) return null;
  for (const [nome, p] of Object.entries(PARTI)) if (p.archivi?.includes(archivio)) return nome;
  return "dati";
}

/* Impostazioni che appartengono al dispositivo e non all'archivio: la copia
   interna (un archivio intero, e ogni dispositivo ha la sua), quando è stato
   fatto il backup su file DA QUI, e il segno di una sistemazione già fatta
   sul database di questo dispositivo. Fatte viaggiare, il Mac crederebbe di
   avere un backup che ha fatto l'iPhone. */
const IMPOSTAZIONI_LOCALI = new Set(["snapshotAutomatico", "ultimoSnapshot", "ultimoExport", "versioneCollegamentiWatch"]);

function viaggia(archivio, riga) {
  return !(archivio === "impostazioni" && IMPOSTAZIONI_LOCALI.has(riga?.chiave));
}

/** Il pezzo di archivio che va in una parte: { archivio: [righe] }. */
async function contenutoDi(parte) {
  const tutti = Object.keys(db.SCHEMA);
  const dentro = tutti.filter((a) => parteDi(a) === parte);
  const dump = await db.esportaTutto({ salta: tutti.filter((a) => !dentro.includes(a)) });
  const dati = {};
  for (const a of dentro) if (Array.isArray(dump.dati[a])) dati[a] = dump.dati[a].filter((r) => viaggia(a, r));
  return dati;
}

// ---------- fondere due archivi ----------

/* Un'impronta per riga: cyrb53, veloce e senza dipendenze. Non protegge
   niente — a quello pensa la cifratura — serve solo a dire «questa riga è
   ancora quella di prima?». */
function impronta(testo) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < testo.length; i++) {
    const c = testo.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function chiaveDi(archivio, riga) {
  const kp = db.SCHEMA[archivio]?.keyPath;
  return kp ? String(riga?.[kp]) : null;
}

/** { archivio: { chiave: impronta } } — com'era l'archivio all'ultimo scambio. */
export function improntaDi(dati) {
  const out = {};
  for (const [a, righe] of Object.entries(dati || {})) {
    out[a] = {};
    for (const r of righe) out[a][chiaveDi(a, r)] = impronta(JSON.stringify(r));
  }
  return out;
}

/**
 * Fonde due archivi riga per riga, sapendo com'erano all'ultimo scambio
 * (`base`). Pura: la rete la prova senza toccare niente.
 *
 * Per ogni riga:
 * - uguale da tutte e due le parti → quella;
 * - cambiata da una parte sola → vince chi l'ha cambiata (anche se l'ha
 *   cancellata: cancellare è un cambiamento come un altro);
 * - cambiata da tutte e due in modo diverso → è un CONFLITTO. Se una delle
 *   due parti l'ha cancellata e l'altra modificata, si tiene la modificata:
 *   perdere una cancellazione si rimedia cancellando di nuovo, perdere una
 *   modifica no. Se tutte e due l'hanno modificata vince questo dispositivo —
 *   è quello che stai usando adesso — e il conflitto si racconta, non si
 *   inghiotte.
 *
 * Senza `base` (il primo incontro) niente è stato «cancellato»: le righe che
 * ci sono da una parte sola restano, e si ottiene l'unione.
 */
export function unisci(base, locale, remoto) {
  const unito = {};
  const conflitti = [];
  const archivi = new Set([...Object.keys(locale || {}), ...Object.keys(remoto || {})]);
  for (const a of archivi) {
    if (!(a in db.SCHEMA) || parteDi(a) === null) continue;
    // Quello che appartiene al dispositivo non si fonde: la versione che
    // mandava soltanto faceva viaggiare anche la copia interna.
    const L = new Map((locale?.[a] || []).filter((r) => viaggia(a, r)).map((r) => [chiaveDi(a, r), r]));
    const R = new Map((remoto?.[a] || []).filter((r) => viaggia(a, r)).map((r) => [chiaveDi(a, r), r]));
    const B = base?.[a] || {};
    const righe = [];
    for (const k of new Set([...L.keys(), ...R.keys()])) {
      const l = L.get(k);
      const r = R.get(k);
      const hl = l ? impronta(JSON.stringify(l)) : null;
      const hr = r ? impronta(JSON.stringify(r)) : null;
      const hb = B[k] ?? null;
      let scelta;
      if (hl === hr) scelta = l;
      else if (hl === hb) scelta = r;
      else if (hr === hb) scelta = l;
      else {
        scelta = l ?? r;
        conflitti.push({ archivio: a, chiave: k, tenuto: l ? "questo" : "altro" });
      }
      if (scelta) righe.push(scelta);
    }
    unito[a] = righe;
  }
  return { unito, conflitti };
}

function impronteUguali(a, b) {
  const nomi = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const n of nomi) {
    const pa = a?.[n] || {};
    const pb = b?.[n] || {};
    const ka = Object.keys(pa);
    if (ka.length !== Object.keys(pb).length) return false;
    for (const k of ka) if (pa[k] !== pb[k]) return false;
  }
  return true;
}

function uguali(x, y) {
  return impronteUguali(improntaDi(x), improntaDi(y));
}

/** Il backup da ripristinare con quello che è uscito dalla fusione. */
export function daApplicare(dati) {
  const dump = { formato: "coach-backup", versione: db.VERSIONE_BACKUP, dati: {}, motivo: "sincronizzazione" };
  for (const [a, righe] of Object.entries(dati || {})) {
    // Solo archivi che questa versione conosce: uno scritto da un'app più
    // nuova non si applica a metà.
    if (a in db.SCHEMA && parteDi(a) !== null && Array.isArray(righe)) dump.dati[a] = righe;
  }
  // Tutto quello che non c'è è «di questo non so niente»: il ripristino lo
  // lascia com'è invece di svuotarlo (la regola di js/db.js che protegge già
  // le foto nella copia interna). Vale per le copertine e per l'altra parte.
  dump.parziale = Object.keys(db.SCHEMA).filter((a) => !(a in dump.dati));
  return dump;
}

// ---------- stato, per chi guarda ----------

const ascoltatori = new Set();
export function quandoCambia(fn) {
  ascoltatori.add(fn);
  return () => ascoltatori.delete(fn);
}
function avvisa(cosa) {
  for (const fn of ascoltatori) {
    try {
      fn(cosa);
    } catch {
      /* chi ascolta non deve fermare la sincronizzazione */
    }
  }
}

export async function stato() {
  const c = await leggiConf();
  if (!c) return { attiva: false };
  return {
    attiva: true,
    ruolo: c.ruolo,
    repo: c.repo,
    ultimaVolta: c.ultimaVolta || null,
    errore: c.errore || null,
    conflitti: c.conflitti || [],
    ultimoArrivo: c.ultimoArrivo || null,
    inAttesa: Object.values(c.sporco || {}).some(Boolean),
  };
}

// ---------- il giro: prendi, fondi, rimanda ----------

let giroInCorso = null;
let rimandato = false;

async function segna(parte, valore) {
  const c = await leggiConf();
  if (c) await scriviConf({ ...c, sporco: { ...(c.sporco || {}), [parte]: valore } });
}

/**
 * Una parte (dati o foto): se nessuno ha cambiato niente non si fa niente; se
 * è cambiata di là si scarica e si fonde; se il risultato è diverso da quello
 * che c'è qui si scrive qui, se è diverso da quello che c'è di là si manda.
 * Torna true se l'archivio di questo dispositivo è cambiato.
 */
async function giroDellaParte(parte, presenti) {
  const c = await leggiConf();
  const file = PARTI[parte].file;
  const shaDiLa = presenti[file] || null;
  const cambiatoDiLa = shaDiLa !== (c.sha?.[parte] || null);
  if (!cambiatoDiLa && !c.sporco?.[parte] && c.impronte?.[parte]) return false;

  // Il segno si toglie PRIMA di leggere l'archivio: una scrittura che arriva
  // mentre questo giro lavora lo rimette, e il giro dopo la manda.
  const salvatoIl = c.sporcoDal?.[parte] || null;
  await segna(parte, false);
  const scrittureAllInizio = db.scritture();
  const locale = await contenutoDi(parte);

  let remoto = null;
  let shaLetto = c.sha?.[parte] || null;
  let arrivo = null;
  if (cambiatoDiLa && shaDiLa) {
    const f = await leggiFile(c, file);
    if (f) {
      remoto = (await apri(f.busta, c.chiave))?.dati || {};
      shaLetto = f.sha;
      // Quanto ci ha messo: dal salvataggio di là a adesso. Si mostra in
      // Impostazioni, perché «è lento» si discute meglio con un numero.
      const t = Date.parse(f.busta.salvatoIl || f.busta.scrittoIl);
      if (f.busta.scrittoDa !== c.dispositivo && Number.isFinite(t)) arrivo = { ms: Math.max(0, Date.now() - t), quando: new Date().toISOString() };
    }
  }

  // Senza impronte (non dovrebbe capitare: `avvia` le costruisce) si fonde
  // come al primo incontro, cioè senza cancellare niente.
  const base = c.impronte?.[parte] || {};

  const { unito, conflitti } = remoto ? unisci(base, locale, remoto) : { unito: locale, conflitti: [] };

  let cambiatoQui = false;
  if (remoto && !uguali(unito, locale)) {
    // Se nel frattempo hai salvato qualcosa qui, scrivere adesso lo
    // cancellerebbe: si lascia stare, e il giro dopo rifonde con quello.
    if (db.scritture() !== scrittureAllInizio) {
      await segna(parte, true);
      return false;
    }
    await db.importaTutto(daApplicare(unito), "sostituisci", { daSincronizzazione: true });
    cambiatoQui = true;
  }

  let nuovoSha = shaLetto;
  // Una scrittura che non ha cambiato niente — la stessa riga riscritta
  // uguale — segna «da mandare» lo stesso: se l'archivio è identico a quello
  // dell'ultimo scambio, non si manda niente.
  const comeAllUltimoScambio = Boolean(c.impronte?.[parte]) && impronteUguali(improntaDi(unito), c.impronte[parte]);
  const daMandare = !remoto
    ? !shaDiLa || (Boolean(c.sporco?.[parte]) && !comeAllUltimoScambio)
    : !uguali(unito, remoto);
  if (daMandare) {
    const busta = await sigilla({ dati: unito }, c.chiave, { sale: daBase64(c.sale), dispositivo: c.dispositivo });
    if (salvatoIl) busta.salvatoIl = salvatoIl;
    try {
      nuovoSha = await scriviFile(c, file, busta, shaDiLa);
    } catch (e) {
      // Qualcuno ha scritto di là mentre fondevo: si ricomincia al giro dopo,
      // con quello che ha scritto.
      await segna(parte, true);
      if (e instanceof Conflitto) return cambiatoQui;
      throw e;
    }
  }

  const ora = await leggiConf();
  await scriviConf({
    ...ora,
    ...(arrivo ? { ultimoArrivo: arrivo } : {}),
    // Il momento del primo salvataggio non ancora partito si dimentica solo
    // se nel frattempo non ne è arrivato un altro.
    sporcoDal: { ...(ora.sporcoDal || {}), [parte]: ora.sporco?.[parte] ? ora.sporcoDal?.[parte] || null : null },
    sha: { ...(ora.sha || {}), [parte]: nuovoSha },
    impronte: { ...(ora.impronte || {}), [parte]: improntaDi(unito) },
    conflitti: conflitti.length
      ? [...conflitti.map((x) => ({ ...x, quando: new Date().toISOString() })), ...(ora.conflitti || [])].slice(0, 20)
      : ora.conflitti || [],
  });
  return cambiatoQui;
}

/** Un giro alla volta: se ne chiedi un altro mentre gira, parte dopo. */
export async function giro(applica) {
  if (giroInCorso) {
    rimandato = true;
    return giroInCorso;
  }
  giroInCorso = (async () => {
    try {
      const c = await leggiConf();
      if (!c) return;
      const presenti = await shaDeiFile(c);
      let cambiato = false;
      for (const parte of Object.keys(PARTI)) cambiato = (await giroDellaParte(parte, presenti)) || cambiato;
      const ora = await leggiConf();
      if (ora) await scriviConf({ ...ora, ultimaVolta: new Date().toISOString(), errore: null });
      if (cambiato) await applica?.();
    } catch (e) {
      const ora = await leggiConf();
      if (ora) await scriviConf({ ...ora, errore: e?.message || String(e) });
    } finally {
      giroInCorso = null;
      avvisa("giro");
      if (rimandato) {
        rimandato = false;
        setTimeout(() => giro(applica), 0);
      }
    }
  })();
  return giroInCorso;
}

/**
 * Da chiamare una volta all'avvio. `applica` rilegge e ridisegna quando
 * dall'altro dispositivo arriva qualcosa.
 */
export async function avvia(applica) {
  let c = await leggiConf();
  db.impostaMotoreAltrove(c?.ruolo === "copia");
  if (!c) return;
  if (!c.impronte && c.sha) c = await impronteDallaVersioneDiPrima(c);
  ascolta(applica);
  giro(applica);
}

/**
 * Chi arriva dalla versione del primo giorno — l'iPhone mandava e basta, il
 * Mac riceveva e basta — non ha il «com'era all'ultimo scambio». Si ricostruisce
 * qui, all'avvio, PRIMA che tu possa registrare qualcosa: in quel momento
 * l'archivio di qui È l'ultimo scambio (il Mac applicava tutto, l'iPhone
 * mandava tutto).
 *
 * Tranne una parte con salvataggi che non erano ancora partiti: lì l'archivio
 * è PIÙ NUOVO dell'ultimo scambio, e prenderlo come base farebbe credere che
 * quei salvataggi ci fossero già di là — la fusione li cancellerebbe, visto
 * che di là mancano. Per quella parte si parte senza base, cioè dall'unione:
 * non si cancella niente, al massimo torna una riga cancellata di là. È
 * successo nella prova del 19/09: una sigaretta segnata sul Mac prima del
 * primo giro spariva.
 */
async function impronteDallaVersioneDiPrima(c) {
  const impronte = {};
  for (const parte of Object.keys(PARTI)) {
    impronte[parte] = c.sporco?.[parte] ? {} : improntaDi(await contenutoDi(parte));
  }
  const ora = await leggiConf();
  return scriviConf({ ...ora, impronte });
}

/* Gli ascoltatori si mettono una volta sola: accendere la sincronizzazione
   dalle Impostazioni non deve aspettare una riapertura per cominciare a
   lavorare, e riaccenderla non deve raddoppiarli. */
let inAscolto = false;

function ascolta(applica) {
  if (inAscolto) return;
  inAscolto = true;
  let timer = null;
  db.dopoOgniScrittura(async (archivi) => {
    const parti = new Set(archivi.map(parteDi).filter(Boolean));
    if (!parti.size) return;
    const ora = await leggiConf();
    if (!ora) return;
    const sporco = { ...(ora.sporco || {}) };
    const sporcoDal = { ...(ora.sporcoDal || {}) };
    const adesso = new Date().toISOString();
    for (const p of parti) {
      sporco[p] = true;
      if (!sporcoDal[p]) sporcoDal[p] = adesso;
    }
    await scriviConf({ ...ora, sporco, sporcoDal });
    avvisa("sporco");
    // Un attimo di calma, 300 ms: le scritture di un gesto solo (una serie e
    // i suoi campi) partono insieme, e l'attesa non si sente. Erano 5 secondi
    // la mattina, poi 1,5: «voglio che si aggiorni istantaneamente», e poi
    // «ci mette comunque troppo» (19/09).
    clearTimeout(timer);
    timer = setTimeout(() => giro(applica), 300);
  });
  document.addEventListener("visibilitychange", () => {
    // Uscendo si manda subito (iOS può fermare l'app da un momento all'altro;
    // se non ci riesce il segno resta e si manda alla riapertura), e
    // rientrando si guarda cosa è cambiato dall'altra parte.
    clearTimeout(timer);
    giro(applica);
  });
  // Ogni secondo e mezzo, finché la finestra è visibile. Istantaneo davvero
  // vorrebbe qualcuno che AVVISA l'altro dispositivo, e GitHub non lo fa:
  // questo è il più vicino con solo GitHub. La domanda è condizionata (vedi
  // `shaDeiFile`): quando niente è cambiato la risposta è un 304 vuoto che
  // non consuma il limite, e i dati si scaricano solo quando sono cambiati.
  setInterval(() => {
    if (document.visibilityState === "visible") giro(applica);
  }, 1500);
}

// ---------- accendere e spegnere ----------

function repoValido(repo) {
  return /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(String(repo || "").trim());
}

/**
 * Accende la sincronizzazione su questo dispositivo.
 *
 * «principale» è l'iPhone: crea il deposito se è vuoto, e se c'è già lo
 * fonde con il suo archivio. «copia» è il Mac: si unisce a un deposito che
 * esiste già e PRENDE quello che c'è — il suo archivio di prima viene
 * sostituito, per non mescolare dati vecchi di un backup ripristinato chissà
 * quando. Dopo, tutti e due registrano; la sola differenza è che le proposte
 * del coach le calcola l'iPhone (vedi `impostaMotoreAltrove` in js/db.js).
 *
 * `conferma(testo)` viene chiamata solo se serve una decisione.
 */
export async function attiva({ ruolo, repo, token, frase, base }, { conferma, applica } = {}) {
  repo = String(repo || "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  token = String(token || "").trim();
  if (!repoValido(repo)) throw new Error("Il repository si scrive così: utente/nome.");
  if (!token) throw new Error("Manca il token.");
  if (String(frase || "").length < 12) throw new Error("La frase deve avere almeno 12 caratteri: è l'unica cosa che protegge i dati.");
  const conf = { ruolo, repo, token, base };
  await controllaRepo(conf, { scrive: true });

  const esistente = await leggiFile(conf, PARTI.dati.file);
  let sale = null;
  let chiave = null;
  if (esistente) {
    sale = daBase64(esistente.busta.sale);
    chiave = await derivaChiave(frase, sale);
    try {
      await apri(esistente.busta, chiave);
    } catch (e) {
      if (!(e instanceof FraseSbagliata)) throw e;
      if (ruolo === "copia") throw e;
      const ok = await conferma?.(
        "Nel repository ci sono già dati di Coach cifrati con un'altra frase. Se continui li sostituisco con quelli di questo telefono, cifrati con la frase nuova — e sul Mac andrà reinserita."
      );
      if (!ok) throw new Error("Non ho toccato niente.");
      sale = null;
      chiave = null;
    }
  } else if (ruolo === "copia") {
    throw new Error("Nel repository non c'è ancora niente: attiva prima la sincronizzazione sull'iPhone.");
  }
  const riparteDaZero = !sale;
  if (!sale) {
    sale = crypto.getRandomValues(new Uint8Array(16));
    chiave = await derivaChiave(frase, sale);
  }

  const nuova = {
    ruolo,
    repo,
    token,
    base,
    chiave,
    sale: inBase64(sale),
    dispositivo: crypto.getRandomValues(new Uint32Array(2)).join("-"),
    sha: {},
    impronte: {},
    sporco: { dati: true, foto: true },
    conflitti: [],
    errore: null,
  };
  if (ruolo === "copia") {
    // Il Mac prende il deposito così com'è: niente fusione con quello che
    // aveva prima. Dopo questo giro il «com'era all'ultimo scambio» è il
    // deposito stesso.
    const presenti = await shaDeiFile(conf);
    const arrivati = {};
    for (const [parte, p] of Object.entries(PARTI)) {
      if (!presenti[p.file]) continue;
      const f = await leggiFile(conf, p.file);
      const dati = (await apri(f.busta, chiave))?.dati || {};
      Object.assign(arrivati, dati);
      nuova.sha[parte] = f.sha;
      nuova.impronte[parte] = improntaDi(dati);
    }
    await db.importaTutto(daApplicare(arrivati), "sostituisci", { daSincronizzazione: true });
    nuova.sporco = {};
  } else if (esistente && riparteDaZero) {
    // Frase nuova: quello che c'è non si apre, si sovrascrive (confermato).
    const presenti = await shaDeiFile(conf);
    for (const [parte, p] of Object.entries(PARTI)) if (presenti[p.file]) nuova.sha[parte] = presenti[p.file];
    nuova.impronte = { dati: {}, foto: {} };
  }
  // Principale con un deposito che si apre: sha e base vuoti, e il primo giro
  // fonde senza cancellare niente (l'unione di quello che c'è di qua e di là).
  await scriviConf(nuova);
  db.impostaMotoreAltrove(ruolo === "copia");
  ascolta(applica);
  if (ruolo === "principale" && esistente && riparteDaZero) {
    // La fusione non si può fare con dati che non si aprono: si manda e basta.
    await giroForzato();
  } else {
    await giro(applica);
  }
  if (ruolo === "copia") await applica?.();
  const dopo = await stato();
  if (dopo.errore) throw new Error(dopo.errore);
  return dopo;
}

/** Manda l'archivio di qui sopra quello che c'è, senza leggerlo. */
async function giroForzato() {
  const c = await leggiConf();
  for (const [parte, p] of Object.entries(PARTI)) {
    const dati = await contenutoDi(parte);
    const busta = await sigilla({ dati }, c.chiave, { sale: daBase64(c.sale), dispositivo: c.dispositivo });
    const sha = await scriviFile(c, p.file, busta, c.sha?.[parte]);
    const ora = await leggiConf();
    await scriviConf({
      ...ora,
      sha: { ...(ora.sha || {}), [parte]: sha },
      impronte: { ...(ora.impronte || {}), [parte]: improntaDi(dati) },
      sporco: { ...(ora.sporco || {}), [parte]: false },
    });
  }
  const ora = await leggiConf();
  await scriviConf({ ...ora, ultimaVolta: new Date().toISOString(), errore: null });
}

/** Dimentica i conflitti già letti. */
export async function dimenticaConflitti() {
  const c = await leggiConf();
  if (c) await scriviConf({ ...c, conflitti: [] });
}

/** Spegne: dimentica token e chiave. Il deposito su GitHub resta com'è. */
export async function spegni() {
  await scriviConf(null);
  db.impostaMotoreAltrove(false);
  avvisa("spenta");
}
