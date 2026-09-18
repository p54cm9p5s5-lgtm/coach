/* Sincronizzazione iPhone → Mac, cifrata sul dispositivo.

   Una scelta dell'utente del 19/09/2026, e cambia una regola che valeva da
   sempre: fino a qui niente usciva dal telefono. Adesso, SE la accendi, esce
   una cosa sola — l'archivio cifrato con una frase che conosci solo tu — e va
   in un repository PRIVATO del tuo GitHub. Chi lo custodisce vede solo byte
   illeggibili; senza la frase non si apre, nemmeno da parte tua.

   I ruoli sono due, e non si mescolano:
   - il «principale» (l'iPhone) scrive: a ogni salvataggio, dopo qualche
     secondo di calma, manda l'archivio;
   - la «copia» (il Mac) legge: all'apertura e ogni minuto guarda se c'è
     qualcosa di nuovo, e se c'è sostituisce il suo archivio con quello.

   Perché non tutti e due scrivono: fondere due archivi non si può fare bene.
   Non c'è modo di sapere se una riga manca perché l'hai cancellata di qua o
   perché di là non c'è ancora — e indovinare vuol dire perdere dati senza
   dirlo. Con uno che scrive e uno che legge non c'è niente da indovinare. E
   la copia non finge di poter registrare: sul Mac gli archivi tuoi sono in
   sola lettura (js/db.js), e chi prova lo legge scritto.

   La configurazione — token, chiave, ruolo — vive in un archivio A PARTE
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
 * È la domanda che la copia fa ogni minuto: «è cambiato qualcosa?». Chiedere
 * i file uno per uno scaricherebbe ogni volta i dati interi, anche se sono gli
 * stessi di un minuto fa.
 */
async function shaDeiFile(conf) {
  const r = await fetch(`${indirizzo(conf)}/contents/`, { headers: intestazioni(conf), cache: "no-store" });
  if (r.status === 404) return {};
  if (!r.ok) throw erroreDiGitHub(r.status, "guardando cosa c'è nel repository");
  const elenco = await r.json();
  return Object.fromEntries((Array.isArray(elenco) ? elenco : []).map((f) => [f.name, f.sha]));
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

// ---------- cosa si manda, cosa si applica ----------

function parteDi(archivio) {
  if (FUORI.includes(archivio)) return null;
  for (const [nome, p] of Object.entries(PARTI)) if (p.archivi?.includes(archivio)) return nome;
  return "dati";
}

/** Il pezzo di archivio che va in una parte. */
async function contenutoDi(parte) {
  const tutti = Object.keys(db.SCHEMA);
  const dentro = tutti.filter((a) => parteDi(a) === parte);
  const dump = await db.esportaTutto({ salta: tutti.filter((a) => !dentro.includes(a)) });
  for (const a of tutti) if (!dentro.includes(a)) delete dump.dati[a];
  return dump;
}

/**
 * Da quello che è arrivato al backup da ripristinare. Pura: la rete la prova
 * senza toccare nessun archivio.
 *
 * Ogni archivio che NON arriva finisce in `parziale`: «di questo non so
 * niente», e il ripristino lo lascia com'è invece di svuotarlo. È la regola
 * che già protegge le foto nella copia interna (js/db.js), e qui vale per le
 * copertine — sempre — e per la parte che non è cambiata.
 */
export function daApplicare(arrivati) {
  const dump = { formato: "coach-backup", versione: db.VERSIONE_BACKUP, dati: {}, motivo: "sincronizzazione" };
  for (const pezzo of arrivati) {
    for (const [a, righe] of Object.entries(pezzo?.dati || {})) {
      // Solo archivi che questa versione conosce: uno scritto da un'app più
      // nuova non si applica a metà.
      if (a in db.SCHEMA && parteDi(a) !== null && Array.isArray(righe)) dump.dati[a] = righe;
    }
  }
  dump.parziale = Object.keys(db.SCHEMA).filter((a) => !(a in dump.dati));
  return dump;
}

// ---------- stato, per chi guarda ----------

let ascoltatori = new Set();
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
    datiDel: c.datiDel || null,
    errore: c.errore || null,
    inAttesa: c.ruolo === "principale" && Object.values(c.sporco || {}).some(Boolean),
  };
}

// ---------- il principale: manda ----------

let giroInCorso = null;
let rimandato = null;

async function manda() {
  const c = await leggiConf();
  if (!c || c.ruolo !== "principale") return;
  const daMandare = Object.keys(PARTI).filter((p) => c.sporco?.[p]);
  if (!daMandare.length) return;
  const sale = daBase64(c.sale);
  const nuoviSha = { ...(c.sha || {}) };
  for (const parte of daMandare) {
    // Si toglie il segno PRIMA di leggere l'archivio: una scrittura che arriva
    // mentre si spedisce lo rimette, e il giro dopo la manda.
    await ritocca({ sporco: { ...((await leggiConf()).sporco || {}), [parte]: false } });
    const busta = await sigilla(await contenutoDi(parte), c.chiave, { sale, dispositivo: c.dispositivo });
    const file = PARTI[parte].file;
    try {
      nuoviSha[parte] = await scriviFile(c, file, busta, nuoviSha[parte]);
    } catch (e) {
      if (!(e instanceof Conflitto)) {
        await ritocca({ sporco: { ...((await leggiConf()).sporco || {}), [parte]: true } });
        throw e;
      }
      // Lo sha che avevo è vecchio. Se l'ultimo a scrivere sono stato io —
      // un'altra scheda di questo stesso telefono — si riprova. Se è un altro
      // dispositivo, NO: vuol dire che qualcuno è diventato principale al
      // posto mio, e sovrascriverlo cancellerebbe quello che ha scritto.
      const lì = await leggiFile(c, file);
      if (lì && lì.busta?.scrittoDa !== c.dispositivo) {
        await ritocca({ sporco: { ...((await leggiConf()).sporco || {}), [parte]: true } });
        throw new Error(
          "Un altro dispositivo è diventato quello che scrive. Questo non manda più niente: se deve tornare a esserlo, riattiva la sincronizzazione qui."
        );
      }
      nuoviSha[parte] = await scriviFile(c, file, busta, lì?.sha);
    }
  }
  await ritocca({ sha: nuoviSha, ultimaVolta: new Date().toISOString(), errore: null });
}

// ---------- la copia: riceve ----------

async function ricevi(applica) {
  const c = await leggiConf();
  if (!c || c.ruolo !== "copia") return false;
  const arrivati = [];
  const nuoviSha = { ...(c.sha || {}) };
  let datiDel = c.datiDel || null;
  const presenti = await shaDeiFile(c);
  for (const [parte, p] of Object.entries(PARTI)) {
    const sha = presenti[p.file];
    if (!sha || sha === c.sha?.[parte]) continue;
    const f = await leggiFile(c, p.file);
    if (!f || f.sha === c.sha?.[parte]) continue;
    arrivati.push(await apri(f.busta, c.chiave));
    nuoviSha[parte] = f.sha;
    if (!datiDel || f.busta.scrittoIl > datiDel) datiDel = f.busta.scrittoIl;
  }
  if (arrivati.length) {
    await db.importaTutto(daApplicare(arrivati), "sostituisci", { daSincronizzazione: true });
  }
  await ritocca({ sha: nuoviSha, datiDel, ultimaVolta: new Date().toISOString(), errore: null });
  if (arrivati.length) await applica?.();
  return arrivati.length > 0;
}

// ---------- il giro ----------

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
      if (c.ruolo === "principale") await manda();
      else await ricevi(applica);
    } catch (e) {
      await ritocca({ errore: e?.message || String(e) });
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
 * Da chiamare una volta all'avvio. `applica` ridisegna la schermata quando
 * sulla copia arriva qualcosa di nuovo.
 */
export async function avvia(applica) {
  const c = await leggiConf();
  db.impostaSolaLettura(c?.ruolo === "copia");
  if (!c) return;
  ascolta(c.ruolo, applica);
  giro(applica);
}

/* Gli ascoltatori si mettono una volta sola per ruolo: accendere la
   sincronizzazione dalle Impostazioni non deve aspettare una riapertura
   dell'app per cominciare a lavorare, e riaccenderla non deve raddoppiarli. */
const inAscolto = new Set();

function ascolta(ruolo, applica) {
  if (inAscolto.has(ruolo)) return;
  inAscolto.add(ruolo);
  if (ruolo === "principale") {
    let timer = null;
    db.dopoOgniScrittura(async (archivi) => {
      const parti = new Set(archivi.map(parteDi).filter(Boolean));
      if (!parti.size) return;
      const ora = await leggiConf();
      if (!ora || ora.ruolo !== "principale") return;
      const sporco = { ...(ora.sporco || {}) };
      for (const p of parti) sporco[p] = true;
      await ritocca({ sporco });
      avvisa("sporco");
      // Qualche secondo di calma: registrando una serie dopo l'altra non si
      // spedisce l'archivio a ogni tocco.
      clearTimeout(timer);
      timer = setTimeout(() => giro(applica), 5000);
    });
    // Uscendo dall'app si prova subito: iOS può fermarla da un momento
    // all'altro. Se non ci riesce, il segno resta e si manda alla riapertura.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        clearTimeout(timer);
        giro(applica);
      }
    });
  } else {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") giro(applica);
    });
    setInterval(() => {
      if (document.visibilityState === "visible") giro(applica);
    }, 60000);
  }
}

// ---------- accendere e spegnere ----------

function repoValido(repo) {
  return /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(String(repo || "").trim());
}

/**
 * Accende la sincronizzazione su questo dispositivo.
 *
 * `conferma(testo)` viene chiamata solo se serve una decisione — sul
 * principale, quando nel deposito ci sono già dati scritti da un altro
 * dispositivo o con un'altra frase.
 */
export async function attiva({ ruolo, repo, token, frase, base }, { conferma, applica } = {}) {
  repo = String(repo || "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  token = String(token || "").trim();
  if (!repoValido(repo)) throw new Error("Il repository si scrive così: utente/nome.");
  if (!token) throw new Error("Manca il token.");
  if (String(frase || "").length < 12) throw new Error("La frase deve avere almeno 12 caratteri: è l'unica cosa che protegge i dati.");
  const conf = { ruolo, repo, token, base };
  await controllaRepo(conf, { scrive: ruolo === "principale" });

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
  if (!sale) {
    sale = crypto.getRandomValues(new Uint8Array(16));
    chiave = await derivaChiave(frase, sale);
  }

  const dispositivo = crypto.getRandomValues(new Uint32Array(2)).join("-");
  const nuova = {
    ruolo,
    repo,
    token,
    base,
    chiave,
    sale: inBase64(sale),
    dispositivo,
    sha: {},
    sporco: ruolo === "principale" ? { dati: true, foto: true } : {},
    errore: null,
  };
  if (ruolo === "principale" && esistente) {
    // Prendere il posto di chi scriveva: si parte dallo sha che c'è, e il
    // vecchio principale se ne accorge al suo prossimo invio.
    nuova.sha = { dati: esistente.sha };
    const foto = await leggiFile(conf, PARTI.foto.file);
    if (foto) nuova.sha.foto = foto.sha;
  }
  await scriviConf(nuova);
  db.impostaSolaLettura(ruolo === "copia");
  ascolta(ruolo, applica);
  await giro(applica);
  const dopo = await stato();
  if (dopo.errore) throw new Error(dopo.errore);
  return dopo;
}

/** Spegne: dimentica token e chiave. Il deposito su GitHub resta com'è. */
export async function spegni() {
  await scriviConf(null);
  db.impostaSolaLettura(false);
  avvisa("spenta");
}
