/* Logica di dominio: programma, allenamenti, serie, questionari, volumi. */

import * as db from "./db.js";
import { isoDate, weekdayOf, giorniTra, dataBreve, num, durataUmana, parseIso } from "./ui.js";
import { INVENTARIO_DEFAULT } from "./plates.js";
import { valutaProgressione, firmaProposta, calcolaSegnali, nomeLivello, piuGiorni } from "./segnali.js";
import { punteggioEsercizio, punteggioAllenamento, doloriDi, PESI_SALUTE_BASE } from "./punteggio.js";

let LIBRERIA = null;
let PROGRAMMA = null;
let RISCALDAMENTO = null;
let AGENDA = null;
// Giorno in cui il calendario è stato letto l'ultima volta: serve a sapere da
// quando l'app può dire «quel giorno non c'era niente».
let LETTURA_AGENDA = null;
// Giorno dell'ULTIMA lettura: serve a sapere fin dove il calendario è stato
// guardato, non solo da quando.
let ULTIMA_LETTURA_AGENDA = null;
// Fin dove il calendario è stato letto in assoluto: non arretra mai.
let COPERTURA_AGENDA = null;
// Le finestre davvero lette, una per lettura: [{da, a}]. Un giorno fuori da
// tutte è un giorno che nessuno ha guardato, e va detto invece di darlo per
// vuoto (fra una lettura e l'altra può passare più di un mese).
let FINESTRE_AGENDA = [];

function dentroUnaFinestra(iso) {
  return FINESTRE_AGENDA.some((f) => iso >= f.da && iso <= f.a);
}

// ---------- avvio ----------

export async function init() {
  await db.open();
  db.rendiPersistente();
  // Una volta sola, e prima che qualcuno legga quei collegamenti: la regola
  // vecchia ne aveva scritti di sbagliati e nessuno li avrebbe più guardati.
  rifaiCollegamentiWatch().catch(() => {
    /* se non riesce si riproverà al prossimo avvio: non blocca l'app */
  });
  await caricaLibreria();
  await caricaRiscaldamento();
  PROGRAMMA = (await db.get("programma", "corrente")) || null;
  await caricaAgenda();
  // Gli abbinamenti fra eventi del calendario e giorni dello split si rifanno a
  // ogni avvio. Costa un giro sulla lista già in memoria e scrive solo se
  // qualcosa cambia davvero, ma vale l'unico caso che conta: quando l'app
  // impara a riconoscere un titolo che prima le sfuggiva, il calendario si
  // sistema da sé alla riapertura, senza che tu debba sapere di dover
  // rileggere il calendario per correggere un difetto che non era tuo.
  if (PROGRAMMA) await riabbinaAgenda();
  return { libreria: LIBRERIA, programma: PROGRAMMA };
}

/* I video di mobilità e stretching sostituiti a mano. Non stanno nella
   libreria degli esercizi — quei passaggi arrivano dal file del protocollo e
   non hanno un id — quindi vivono qui, uno per nome del passaggio. */
let VIDEO_PASSI = {};

async function caricaRiscaldamento() {
  try {
    const r = await fetch("data/riscaldamento.json", { cache: "no-cache" });
    if (r.ok) RISCALDAMENTO = await r.json();
  } catch {
    /* offline al primissimo avvio: il riscaldamento resta senza dettaglio */
  }
  const salvati = await impostazione("videoRiscaldamento");
  VIDEO_PASSI = salvati && typeof salvati === "object" ? salvati : {};
  return RISCALDAMENTO;
}

/**
 * Il protocollo di riscaldamento è arrivato oppure no.
 *
 * Serve a non confondere due cose molto diverse: «questo giorno non prevede
 * riscaldamento» e «il file del protocollo non si è caricato». Senza questa
 * differenza le schermate dicevano «niente da fare in questo giorno» anche
 * quando il giorno aveva sette passaggi, e il punteggio contava il
 * riscaldamento come fatto.
 */
export function protocolloCaricato() {
  return Boolean(RISCALDAMENTO);
}

/** Riprova a prendere il protocollo, per chi era senza rete al primo avvio. */
export async function riprovaProtocollo() {
  if (RISCALDAMENTO) return true;
  try {
    const r = await fetch("data/riscaldamento.json", { cache: "reload" });
    if (r.ok) RISCALDAMENTO = await r.json();
  } catch {
    /* ancora niente: chi chiama lo vede dal valore di ritorno */
  }
  return Boolean(RISCALDAMENTO);
}

/* ---------------------------------------------------------------------------
   Le copertine dei video.

   Prima erano disegnate dall'app, per non far partire una richiesta a Google
   ogni volta che una scheda esercizio compariva a schermo. Il risultato però
   era un rettangolo nero: la copertina vera dice cosa stai per guardare, e in
   palestra serve.

   La via di mezzo: si scarica **una volta sola per video** e si tiene qui. Da
   allora in poi zero richieste, e la copertina c'è anche senza rete — che è
   poi il caso in cui il rettangolo nero dava più fastidio. Google vede una
   richiesta per video, non una per occhiata.
--------------------------------------------------------------------------- */

/** La copertina già scaricata, o null. */
export async function copertinaSalvata(idVideo) {
  if (!idVideo) return null;
  const r = await db.get("copertine", String(idVideo));
  return r?.immagine || null;
}

/**
 * Scarica la copertina e la tiene. Torna il data URL, oppure null se la rete
 * non c'è o YouTube non la dà: in quel caso resta la copertina disegnata.
 */
export async function scaricaCopertina(idVideo) {
  const id = String(idVideo || "");
  if (!id) return null;
  const gia = await copertinaSalvata(id);
  if (gia) return gia;
  // `hqdefault` esiste per ogni video ed è leggera (dieci-venti kilobyte);
  // `maxresdefault` non c'è sempre e pesa dieci volte tanto.
  const url = `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  try {
    const r = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!blob.size || !/^image\//.test(blob.type)) return null;
    const immagine = await new Promise((ok, no) => {
      const lettore = new FileReader();
      lettore.onload = () => ok(String(lettore.result));
      lettore.onerror = () => no(lettore.error);
      lettore.readAsDataURL(blob);
    });
    await db.put("copertine", { id, immagine, presaIl: new Date().toISOString() });
    return immagine;
  } catch {
    // Offline, o YouTube che non risponde: non è un errore da mostrare.
    return null;
  }
}

/** Quante copertine sono state tenute, e quanto pesano. Per le Impostazioni. */
export async function pesoCopertine() {
  const tutte = await db.all("copertine");
  const byte = tutte.reduce((t, x) => t + Math.round((String(x.immagine || "").length * 3) / 4), 0);
  return { quante: tutte.length, byte };
}

/** Le butta via tutte: si riscaricano da sole quando servono. */
export async function svuotaCopertine() {
  await db.clearStore("copertine");
}

/** Se quel passaggio ha un video scelto a mano, e non quello del protocollo. */
export const videoPassoPersonalizzato = (nome) => Boolean(VIDEO_PASSI[String(nome || "").trim()]);

/**
 * Sostituisce il video di un passaggio di riscaldamento o stretching.
 * Con `video` a null la scelta personale si toglie e torna quello del
 * protocollo: senza, un link incollato male restava lì per sempre.
 */
export async function cambiaVideoPasso(nome, video) {
  const chiave = String(nome || "").trim();
  if (!chiave) return false;
  if (video == null) {
    const { [chiave]: _tolto, ...resto } = VIDEO_PASSI;
    VIDEO_PASSI = resto;
  } else {
    VIDEO_PASSI = { ...VIDEO_PASSI, [chiave]: video };
  }
  await setImpostazione("videoRiscaldamento", VIDEO_PASSI);
  return true;
}

const conVideoScelto = (p) => (p && VIDEO_PASSI[p.nome] ? { ...p, video: VIDEO_PASSI[p.nome] } : p);

/** Protocollo di riscaldamento per un giorno dello split. */
export function riscaldamento(giornoId) {
  if (!RISCALDAMENTO) return null;
  const giorno = RISCALDAMENTO.giorni?.[giornoId] || { mobilita: [], stretchingFinale: [], mobilitaFinale: [] };
  return {
    cardio: RISCALDAMENTO.cardio,
    serieDiAvvicinamento: RISCALDAMENTO.serieDiAvvicinamento,
    nota: RISCALDAMENTO.nota,
    fase1: null,
    ...giorno,
    mobilita: (giorno.mobilita || []).map(conVideoScelto),
    stretchingFinale: (giorno.stretchingFinale || []).map(conVideoScelto),
    // Il blocco di mobilità di fine seduta: dose fissa, nessun carico, nessuna
    // progressione. Copre le zone che il riscaldamento di quel giorno non
    // tocca già, così non si ripete due volte la stessa cosa.
    mobilitaFinale: (giorno.mobilitaFinale || []).map(conVideoScelto),
  };
}

/**
 * Un giorno di sola mobilità: nello split c'è, ma senza esercizi.
 *
 * Sabato e domenica sono voci vere del programma — compaiono sul calendario e
 * saltarli pesa come saltare un giorno di scheda — ma il loro contenuto non
 * sono esercizi tracciati: è la routine di mobilità. Serve saperlo distinguere
 * per non chiedere carichi e ripetizioni a un giorno che non ne ha.
 */
export function giornoDiSolaMobilita(giornoId) {
  const g = giornoSplit(giornoId);
  if (!g) return false;
  return !(g.esercizi || []).length && Boolean(riscaldamento(giornoId)?.mobilitaFinale?.length);
}

/**
 * Il file è la fonte dei contenuti (istruzioni, cue, video predefiniti) e li
 * aggiorna a ogni avvio. Restano intoccate solo le personalizzazioni esplicite:
 * un video sostituito a mano non viene mai riscritto da un aggiornamento.
 */
async function caricaLibreria() {
  const salvati = await db.all("esercizi");
  const perId = new Map(salvati.map((e) => [e.id, e]));

  let dalFile = [];
  try {
    const r = await fetch("data/esercizi.json", { cache: "no-cache" });
    if (r.ok) dalFile = (await r.json()).esercizi || [];
  } catch {
    /* offline: si usa solo ciò che è già salvato */
  }

  const daScrivere = [];
  for (const nuovo of dalFile) {
    const vecchio = perId.get(nuovo.id);
    const unito = {
      ...nuovo,
      archiviato: vecchio?.archiviato ?? false,
      // il video scelto dall'utente vince sempre su quello del file
      ...(vecchio?.videoPersonalizzato
        ? { video: vecchio.video, videoPersonalizzato: true }
        : {}),
    };
    if (JSON.stringify(vecchio) !== JSON.stringify(unito)) daScrivere.push(unito);
    perId.set(nuovo.id, unito);
  }
  if (daScrivere.length) await db.putMany("esercizi", daScrivere);

  LIBRERIA = [...perId.values()];
  return LIBRERIA;
}

export const ricaricaLibreria = caricaLibreria;
export const libreria = () => LIBRERIA || [];
export const esercizio = (id) => (LIBRERIA || []).find((e) => e.id === id) || null;
export const programma = () => PROGRAMMA;

// ---------- impostazioni ----------

const DEFAULT_IMPOSTAZIONI = {
  obiettivoMovimentoKcal: 600,
  finestraImportGiorni: 30,
  suonoFineRecupero: true,
  ultimoSnapshot: null,
  ultimoExport: null,
  snapshotAutomatico: null,
  ultimoImportSalute: null,
  fumoContatoDal: null,
  // La tacca del fumo sopravvissuta a un «riparti da oggi»: vedi
  // `riparteConteggioFumo`. Un tetto che scende non deve poter risalire
  // buttando via le righe che lo tenevano basso.
  fumoPartenzaLimite: null,
};

export async function impostazione(chiave) {
  const r = await db.get("impostazioni", chiave);
  return r ? r.valore : DEFAULT_IMPOSTAZIONI[chiave];
}

export async function impostazioni() {
  const righe = await db.all("impostazioni");
  const out = { ...DEFAULT_IMPOSTAZIONI };
  for (const r of righe) out[r.chiave] = r.valore;
  return out;
}

export function setImpostazione(chiave, valore) {
  return db.put("impostazioni", { chiave, valore });
}

export async function inventario() {
  return (PROGRAMMA && PROGRAMMA.inventario) || INVENTARIO_DEFAULT;
}

// ---------- programma ----------

/* Due brief con lo stesso contenuto tecnico devono avere la stessa firma anche
   se le voci sono scritte in un altro ordine. Con il confronto testuale secco
   bastava riscrivere il documento mettendo «serie» prima di «carico» perché
   l'app lo prendesse per un programma nuovo: e un programma nuovo scarta tutte
   le proposte accettate prima. Qui le chiavi si ordinano sempre allo stesso
   modo, così conta quello che c'è scritto, non come è disposto. */
function firmaTecnica(valore) {
  const ordina = (v) => {
    if (Array.isArray(v)) return v.map(ordina);
    if (v && typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = ordina(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(ordina(valore));
}

export async function applicaBrief(dati) {
  const precedente = PROGRAMMA;
  const record = {
    id: "corrente",
    versione: dati.versione,
    aggiornatoIl: dati.aggiornatoIl || isoDate(),
    // La data di caricamento cambia solo se cambia davvero il contenuto
    // tecnico: ricaricare lo stesso brief annullava tutte le proposte
    // accettate, che vengono scartate se più vecchie del brief in vigore.
    caricatoIl:
      precedente &&
      firmaTecnica([precedente.split, precedente.regole, precedente.inventario]) ===
        firmaTecnica([dati.split || [], dati.regole || {}, dati.inventario || INVENTARIO_DEFAULT])
        ? precedente.caricatoIl
        : new Date().toISOString(),
    atleta: dati.atleta || {},
    inventario: dati.inventario || INVENTARIO_DEFAULT,
    regole: dati.regole || {},
    split: dati.split || [],
    note: dati.note || null,
  };
  await db.put("programma", record);
  PROGRAMMA = record;

  // Esercizi non più previsti: archiviati, mai cancellati (lo storico resta).
  const usati = new Set(record.split.flatMap((g) => (g.esercizi || []).map((v) => v.esercizioId)));
  const daArchiviare = (LIBRERIA || [])
    .filter((e) => !usati.has(e.id) && !e.archiviato)
    .map((e) => ({ ...e, archiviato: true }));
  const daRiattivare = (LIBRERIA || [])
    .filter((e) => usati.has(e.id) && e.archiviato)
    .map((e) => ({ ...e, archiviato: false }));
  if (daArchiviare.length) await db.putMany("esercizi", daArchiviare);
  if (daRiattivare.length) await db.putMany("esercizi", daRiattivare);
  if (daArchiviare.length || daRiattivare.length) await caricaLibreria();

  // Il brief nuovo può contenere giorni che prima non esistevano: gli eventi
  // del calendario rimasti senza abbinamento vanno riprovati adesso.
  await riabbinaAgenda();

  await registraDecisione({
    oggetto: "Programma aggiornato dal master brief",
    livello: null,
    testo: precedente
      ? `Caricato brief del ${record.aggiornatoIl}.`
      : `Primo caricamento del programma (brief del ${record.aggiornatoIl}).`,
    fonte: "app",
  });

  return record;
}

/** Giorno dello split previsto per una data, o null se è riposo. */
/**
 * Cosa tocca in un dato giorno.
 * Gli allenamenti li decide il coach e li scrive sul calendario: se per quel
 * giorno c'è un evento, comanda quello. Lo split del brief resta la regola di
 * base, usata finché il calendario non dice altro.
 */
export function agendaAttiva() {
  return Boolean(AGENDA && AGENDA.size);
}

/**
 * Da quando vale il programma, per tutto quello che guarda indietro.
 *
 * **Non è `aggiornatoIl`**: quella è la data dell'ultimo brief, e si sposta in
 * avanti ogni volta che il coach ne manda uno nuovo. Usata da sola, un
 * allenamento saltato smetteva di risultare saltato appena arrivava un brief
 * aggiornato — mentre sul calendario, che partiva dalla prima seduta
 * registrata, quel giorno restava «saltato». Lo stesso giorno, due schermate,
 * due risposte opposte.
 *
 * Vale la più indietro fra la prima seduta registrata e la data del brief:
 * prima di quella non c'era niente da fare, e segnare quei giorni come saltati
 * dipingerebbe di rosso un passato che non è mai esistito.
 */
/**
 * Il giorno da cui comincia questa storia. Scritto qui, non dedotto.
 *
 * Serve a una cosa sola: non far entrare nell'app dati più vecchi di quando si
 * è cominciato. L'archivio dell'app Salute contiene anni, e importarli
 * riempirebbe medie e grafici di giornate che il programma non ha mai guardato.
 *
 * Perché una costante e non la prima seduta registrata: deve sopravvivere a un
 * cambio di telefono, a un archivio svuotato e a un ripristino da backup —
 * cioè proprio ai momenti in cui i dati locali non sanno più da quando si è
 * partiti, ed è lì che il pavimento serve di più.
 */
export const INIZIO_STORIA = "2026-07-29";

/**
 * Il pavimento vero: la costante, oppure una storia ancora più lunga se c'è.
 *
 * Il pavimento serve a non prendere DI PIÙ, mai a tagliare: se un archivio
 * comincia prima di quella data — un altro profilo, un altro atleta — comanda
 * l'archivio.
 */
export function inizioDichiarato() {
  const p = programma();
  const d = p?.atleta?.dal || p?.regole?.inizioStoria || null;
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

export async function inizioStoria() {
  // Il pavimento scritto nel codice è la data in cui è cominciata QUESTA storia.
  // Un secondo profilo comincia un altro giorno, e senza poterlo dire si
  // porterebbe dentro settimane di dati precedenti al suo programma. Basta che
  // il brief scriva «atleta.dal»: quello vince sul pavimento di partenza.
  const pavimento = inizioDichiarato() || INIZIO_STORIA;
  const dai = await inizioProgramma();
  return dai && dai < pavimento ? dai : pavimento;
}

export async function inizioProgramma() {
  const p = programma();
  if (!p) return null;
  const primaSeduta = (await allenamenti()).map((s) => s.data).sort()[0] || null;
  return [primaSeduta, p.aggiornatoIl].filter(Boolean).sort()[0] || null;
}

export function giornoPrevisto(iso = isoDate()) {
  if (!PROGRAMMA) return null;
  const ev = AGENDA?.get(iso);
  if (ev) {
    if (ev.giornoId === "riposo") return null;
    if (ev.giornoId) return giornoSplit(ev.giornoId);
    // evento che non corrisponde a nessun giorno del brief: l'app non inventa
    // il contenuto, lo segnala e basta
    return null;
  }
  // Calendario collegato: comanda lui anche sui giorni che non nomina. Un
  // giorno senza evento è un giorno senza allenamento, non un giorno da
  // riempire con lo split. Ma solo dentro il periodo che il calendario ha
  // davvero letto: prima di quello (il passato, che il comando non guarda) il
  // calendario non ha nulla da dire, e resta valido lo split del brief.
  // Una sola fonte decide: origineGiorno. Lo split torna valido SOLO per i
  // giorni che il calendario non ha mai guardato (`fonte: "split"`). Un
  // calendario vecchio non fa tornare l'app a inventare allenamenti dallo
  // split spacciandoli per «dal calendario»: dice che va aggiornato, e basta.
  if (agendaAttiva() && origineGiorno(iso).fonte !== "split") return null;
  const wd = weekdayOf(iso);
  return (PROGRAMMA.split || []).find((g) => g.giorno === wd) || null;
}

/** Da dove viene quello che l'app mostra per un giorno: serve a dirlo a schermo. */
export function origineGiorno(iso = isoDate()) {
  const ev = AGENDA?.get(iso);
  if (!ev) {
    if (!agendaAttiva()) return { fonte: "split" };
    // Un'agenda che finisce nel passato non è «oggi riposo»: è un pacchetto
    // vecchio. Senza dirlo, chi smette di importare vede riposo per sempre e
    // crede che il coach non abbia previsto niente.
    const periodo = intervalloAgenda();
    if (periodo?.a && periodo.a < iso) {
      return { fonte: "calendario", scaduta: true, fine: periodo.a, ultimoEvento: periodo.ultimoEvento };
    }
    // Dentro la finestra letta ma oltre l'ultimo allenamento programmato: il
    // calendario è aggiornato, è il coach che non ha ancora messo niente.
    // «Dentro la finestra letta» va verificato davvero: un giorno che nessuna
    // lettura ha coperto finiva qui lo stesso, e a schermo diventava «il coach
    // ha programmato fino al …», cioè una cosa che l'app non può sapere di un
    // giorno che non ha mai guardato. Succede nel buco fra due letture, quando
    // il coach non ha ancora messo niente dopo l'ultimo allenamento.
    const letto = FINESTRE_AGENDA.length ? dentroUnaFinestra(iso) : true;
    if (letto && periodo?.ultimoEvento && iso > periodo.ultimoEvento) {
      return { fonte: "calendario", vuoto: true, oltreProgrammato: true, ultimoEvento: periodo.ultimoEvento };
    }
    // Un giorno che nessuna lettura ha coperto non è «niente sul calendario»:
    // è un giorno che nessuno ha guardato. Prima della prima lettura vale lo
    // split (quel passato il comando non lo guarda mai). Dopo, no: un buco fra
    // due letture significa solo che il calendario va riletto.
    const maiLetto = FINESTRE_AGENDA.length ? !dentroUnaFinestra(iso) : periodo?.da && iso < periodo.da;
    if (maiLetto) {
      if (periodo?.da && iso < periodo.da) return { fonte: "split", nonLetta: true, da: periodo.da };
      // Non è «calendario scaduto»: quello vuol dire che le letture si fermano
      // prima di oggi, e a schermo diventerebbe «letto fino al …» con una data
      // nel futuro, cioè una frase falsa. È solo un giorno mai guardato.
      return { fonte: "calendario", nonLetta: true, da: periodo?.da, a: periodo?.a };
    }
    return { fonte: "calendario", vuoto: true };
  }
  if (ev.giornoId === "riposo") {
    return { fonte: "calendario", titolo: ev.titolo, nota: ev.nota || null, riposo: true };
  }
  if (ev.giornoId) {
    const wd = weekdayOf(iso);
    const daSplit = (PROGRAMMA?.split || []).find((g) => g.giorno === wd) || null;
    return {
      fonte: "calendario",
      titolo: ev.titolo,
      nota: ev.nota || null,
      diverso: (daSplit?.id ?? null) !== ev.giornoId,
    };
  }
  return { fonte: "calendario", titolo: ev.titolo, nota: ev.nota || null, sconosciuto: true };
}

export function giorniSplit() {
  return (PROGRAMMA && PROGRAMMA.split) || [];
}

export function giornoSplit(id) {
  return giorniSplit().find((g) => g.id === id) || null;
}

const REGOLE_BASE = {
  rpeTarget: { min: 6, max: 8 },
  cardio: { kmhMin: 4.5, kmhMax: 5, fcMin: 105, fcMax: 115, fcLimite: 125, durataMin: 30 },
  // esposizioniPerRiproporre: dopo quante sedute di quell'esercizio una
  // proposta già accettata o rifiutata può tornare, se i dati la rifanno nascere.
  progressione: {
    esposizioniMinime: 2,
    rpePerSalire: 7,
    tecnicaMinima: 8,
    tecnicaRiduzione: 5,
    esposizioniPerRiproporre: 4,
  },
  finestra: { settimane: 3, minimoSettimana: 5, soglia: 0.2 },
  // Ogni quanto vanno prese le misure e rifatte le foto. Sono cadenze del
  // protocollo, non del calendario: l'app le tiene sempre, anche quando gli
  // allenamenti arrivano dal calendario del coach.
  // Il punteggio Salute del giorno: quanto pesa ognuna delle parti e quali
  // sono i bersagli. Sono numeri dichiarati, non inventati dentro al codice:
  // il master brief può cambiarli come cambia tutto il resto.
  salute: {
    // Sette voci, nessuna capace di decidere da sola: con poche voci il
    // punteggio finiva a coincidere con quello dell'allenamento, che è una
    // cosa diversa. I pesi sono dichiarati qui, non nascosti nel codice.
    pesi: { ...PESI_SALUTE_BASE },
    sonnoOreBersaglio: 8,
    sonnoOreMinime: 6,
    // L'ora in cui vai a letto conta quanto la durata, e da sola: a letto entro
    // mezzanotte non c'è penalità, dopo ogni ora di ritardo costa. Sono numeri
    // dichiarati come tutti gli altri — il master brief può cambiarli.
    sonnoOraLimite: 0, // mezzanotte
    sonnoCostoOraTardi: 0.12, // quanto pesa ogni ora dopo il limite
    // Quanto può scendere sotto zero la voce Fumo: −0,5 = fino a −50%. Tutte le
    // altre voci si fermano al 100%, questa no — fumare oltre il tollerato non
    // è «non aver fatto abbastanza», è aver fatto un danno.
    fumoQuotaMinima: -0.5,
    // Bersagli del punteggio Salute, decisi da te. Non sono gli obiettivi
    // dell'orologio: quello del movimento sull'anello resta quello che hai
    // impostato in Salute (serve al coach per leggere le percentuali vere),
    // questo è l'asticella che ti dai.
    movimentoBersaglio: 1000,
    passiBersaglio: 10000,
    minutiEsercizioBersaglio: 60,
    minutiInPiediBersaglio: 180,
    // Sopra questa soglia la giornata è comunque compromessa, per quanto bene
    // sia andato tutto il resto: è il tetto, non una sottrazione.
    sigaretteTollerate: 10,
    // Chi non fuma mette `false` nel brief: sparisce la scheda dal menu e la
    // voce dal punteggio, invece di restare lì a valere sempre zero.
    contaSigarette: true,
    // L'acqua è il contrario: c'è solo per chi la chiede nel brief
    // («contaAcqua: true»), con il suo bersaglio in litri.
    contaAcqua: false,
    acquaLitriBersaglio: 2,
  },
  cadenze: {
    misureGiornoSettimana: 4, // giovedì
    fotoGiornoSettimana: 3, // mercoledì
    fotoOgniSettimane: 2,
    fotoAncora: "2026-08-12",
  },
};

/**
 * Le soglie del brief si fondono voce per voce. Con la fusione superficiale un
 * brief che toccava una sola soglia azzerava tutte le altre della stessa
 * famiglia: bastava scrivere `finestra.settimane` per lasciare `soglia`
 * indefinita e spegnere in silenzio il segnale del ±20%.
 */
export function regole() {
  const r = (PROGRAMMA && PROGRAMMA.regole) || {};
  const fuse = { ...REGOLE_BASE };
  for (const [chiave, valore] of Object.entries(r)) {
    fuse[chiave] =
      valore && typeof valore === "object" && !Array.isArray(valore)
        ? { ...(REGOLE_BASE[chiave] || {}), ...valore }
        : valore;
  }
  // le schermate cercavano «finestre» al plurale: una chiave che non è mai
  // esistita, quindi leggevano sempre i valori scritti a mano
  // Un brief può scrivere una soglia come numero invece che come oggetto: senza
  // questa rete ogni schermata che chiama regole() esploderebbe e l'app
  // resterebbe utilizzabile solo dalle Impostazioni.
  // La fusione qui sopra è a un livello solo: un brief che scrive
  // «salute.pesi» con una voce sostituirebbe l'intero blocco dei pesi e
  // farebbe sparire tutte le altre. I pesi sono l'unica famiglia annidata,
  // e si fondono voce per voce come tutto il resto.
  if (fuse.salute && typeof fuse.salute === "object" && !Array.isArray(fuse.salute)) {
    const p = fuse.salute.pesi;
    fuse.salute = {
      ...fuse.salute,
      pesi: { ...REGOLE_BASE.salute.pesi, ...(p && typeof p === "object" && !Array.isArray(p) ? p : {}) },
    };
  }
  for (const [chiave, base] of Object.entries(REGOLE_BASE)) {
    if (!fuse[chiave] || typeof fuse[chiave] !== "object" || Array.isArray(fuse[chiave])) {
      fuse[chiave] = { ...base };
    }
  }
  fuse.finestre = {
    movimento: { settimane: fuse.finestra.settimane, giorniMinSettimana: fuse.finestra.minimoSettimana },
    sonno: { settimane: fuse.finestra.settimane, nottiMinSettimana: fuse.finestra.minimoSettimana },
  };
  return fuse;
}

/* I punti dolenti da chiedere dopo ogni esercizio li decide il brief, perché
   non sono gli stessi per tutti. Se il brief non dice niente vale il polso
   destro, che è la domanda con cui l'app è nata: così una persona che non ha
   mai scritto «dolori» continua a vedere esattamente quello che vedeva prima.
   Ogni punto è una domanda separata, con il suo «quando» e il suo «quanto». */
const SITI_DOLORE_DEFAULT = [{ id: "polso", nome: "polso destro", flagEsercizio: "sollecitaPolso" }];

export { doloriDi };

export function sitiDolore() {
  const r = (PROGRAMMA && PROGRAMMA.regole && PROGRAMMA.regole.dolori) || null;
  if (!Array.isArray(r) || !r.length) return SITI_DOLORE_DEFAULT;
  return r
    .filter((s) => s && typeof s.id === "string" && s.id.trim())
    .map((s) => ({
      id: s.id.trim(),
      nome: (s.nome || s.id).trim(),
      // Il brief può scrivere la domanda per intero quando la preposizione
      // automatica non basta («Dolore alla spalla?»).
      domanda: typeof s.domanda === "string" && s.domanda.trim() ? s.domanda.trim() : null,
      flagEsercizio: typeof s.flagEsercizio === "string" ? s.flagEsercizio : null,
    }));
}

/**
 * La riga dello split che riguarda un esercizio: serie, range, carico.
 *
 * Nello stesso ordine di `varianti()`, cioè per validità e non per come sono
 * scritti nel brief. Prima questa funzione scorreva lo split dall'alto e
 * `varianti()` lo scorreva in ordine di calendario: con due programmi nel
 * brief — quello che finisce e quello che comincia — il motore decideva sulla
 * riga del programma NUOVO e la schermata della proposta mostrava quella del
 * VECCHIO. Serie e range scritti sotto la proposta non erano quelli su cui la
 * proposta era stata calcolata.
 */
export function varianteDi(esercizioId) {
  for (const g of giorniInOrdineDiValidita()) {
    const v = (g.esercizi || []).find((x) => x.esercizioId === esercizioId);
    if (v) return v;
  }
  return null;
}

/**
 * I giorni dello split in ordine di quanto contano ADESSO: prima quello che il
 * calendario mette per primo da oggi in avanti, poi gli altri.
 *
 * Serve perché nel brief possono convivere due programmi — quello che stai
 * finendo e quello che comincia fra qualche giorno — e a decidere quale valga
 * in un certo giorno è il calendario, non l'ordine in cui il coach li ha
 * scritti. Senza questo, un esercizio presente in tutti e due prendeva sempre
 * i numeri del primo scritto: cioè il programma vecchio continuava a comandare
 * anche dopo essere finito.
 */
function giorniInOrdineDiValidita(oggi = isoDate()) {
  const tutti = giorniSplit();
  if (!agendaAttiva()) return tutti;
  const prossimaVolta = new Map();
  for (const [data, ev] of AGENDA) {
    if (data < oggi || !ev?.giornoId || ev.giornoId === "riposo") continue;
    const prec = prossimaVolta.get(ev.giornoId);
    if (!prec || data < prec) prossimaVolta.set(ev.giornoId, data);
  }
  // Un giorno che il calendario non prevede più non sparisce: va in fondo, così
  // resta disponibile per lo storico ma non detta le regole di oggi.
  return [...tutti].sort((a, b) => {
    const da = prossimaVolta.get(a.id);
    const db2 = prossimaVolta.get(b.id);
    if (da && db2) return da < db2 ? -1 : da > db2 ? 1 : 0;
    if (da) return -1;
    if (db2) return 1;
    return 0;
  });
}

export function varianti() {
  const m = new Map();
  for (const g of giorniInOrdineDiValidita()) {
    for (const v of g.esercizi || []) if (!m.has(v.esercizioId)) m.set(v.esercizioId, v);
  }
  return m;
}

// ---------- allenamenti ----------

/**
 * Il nome del giorno è scritto DENTRO la seduta quando nasce, e resta quello
 * anche se il brief poi cambia: un allenamento di gennaio non diventa un altro
 * perché a marzo lo split è stato riscritto.
 *
 * Ma una seduta può arrivare da un archivio vecchio o da un backup fatto a mano
 * e non averlo. Senza questa riga a schermo compariva «15/01 · undefined», e
 * nel pacchetto per il coach «Giorno: undefined»: una parola inglese in mezzo a
 * una frase italiana, che sembra un guasto dell'app.
 */
function conNomeDelGiorno(s) {
  if (!s || s.tipoNome) return s;
  const g = (PROGRAMMA?.split || []).find((x) => x.id === s.tipoId);
  return { ...s, tipoNome: g?.nome || "allenamento" };
}

export async function allenamenti() {
  const s = await db.all("sedute");
  return s
    .map(conNomeDelGiorno)
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

export async function seduta(id) {
  return conNomeDelGiorno(await db.get("sedute", id));
}

export async function sedutaInCorso() {
  const s = await db.all("sedute");
  return conNomeDelGiorno(s.find((x) => x.stato === "inCorso")) || null;
}

/**
 * Ultima rete contro il doppio avvio: due allenamenti aperti insieme
 * renderebbero impossibile capire dove finisce l'uno e comincia l'altro.
 *
 * Il controllo passa dalla coda che serializza già i giri del motore: senza,
 * due avvii partiti nello stesso istante leggevano tutti e due «nessuna seduta
 * aperta» prima che uno dei due avesse scritto, e ne nascevano due.
 */
export function iniziaSeduta(argomenti) {
  return inCoda(() => iniziaSedutaVera(argomenti));
}

async function iniziaSedutaVera({ data = isoDate(), giornoId }) {
  invalidaCacheSedute();
  const gia = await sedutaInCorso();
  if (gia) return gia;
  const g = giornoSplit(giornoId);
  if (!g) throw new Error("Giorno dello split non trovato.");
  const rec = {
    id: db.nuovoId("sed"),
    data,
    tipoId: g.id,
    tipoNome: g.nome,
    tipoProgrammatoId: giornoPrevisto(data)?.id || null,
    // Cosa prevedeva il programma per questo allenamento, congelato adesso:
    // se il coach cambia lo split domani, il punteggio e il riepilogo di oggi
    // devono restare quelli di oggi.
    previstiElenco: (g.esercizi || []).map((v) => ({ ...v })),
    stato: "inCorso",
    oraInizio: Date.now(),
    oraFine: null,
    riscaldamento: { fatto: false, modalita: null, note: null },
    // Quel giorno prevedeva lo stretching finale? Congelato adesso, come le
    // soglie del cardio qui sotto e come `previstiElenco`: sui giorni del nuovo
    // split lo stretching non c'è, e se il protocollo cambia domani il
    // punteggio di oggi non deve cambiare con lui.
    previstoStretching: Boolean(riscaldamento(g.id)?.stretchingFinale?.length),
    // Le soglie del cardio si congelano qui: se il coach cambia il brief, il
    // giudizio su un allenamento già fatto non deve cambiare da solo.
    cardio: {
      previsto: Boolean(g.cardio),
      eseguito: false,
      kmh: null,
      durataMin: null,
      note: null,
      soglie: (() => {
        const r = regole().cardio || {};
        return {
          durataMin: r.durataMin ?? null,
          kmhMin: r.kmhMin ?? null,
          kmhMax: r.kmhMax ?? null,
          fcMin: r.fcMin ?? null,
          fcMax: r.fcMax ?? null,
          fcLimite: r.fcLimite ?? null,
        };
      })(),
    },
    notaGenerale: null,
    progresso: { fase: "riscaldamento", indice: 0 },
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("sedute", rec);
  return rec;
}

/**
 * Le scritture sull'allenamento aperto vanno in fila.
 *
 * Ognuna legge il record, ci mette sopra la sua modifica e lo riscrive. Due
 * partite insieme leggono lo stesso record di partenza e la seconda a scrivere
 * cancella la prima: toccando «+15 s» e subito «Pronto», la scritta del timer
 * arrivava dopo e RIMETTEVA il recupero appena chiuso — un tocco che sembrava
 * non aver funzionato. In fila, ognuna parte da quello che ha lasciato la
 * precedente e vince l'ultima toccata, che è quello che uno si aspetta.
 *
 * È una coda a parte da quella del motore: nessuna di queste funzioni ne
 * chiama un'altra, quindi non può incastrarsi ad aspettare se stessa.
 */
let codaScritture = Promise.resolve();
function inFila(fn) {
  codaScritture = codaScritture.catch(() => {}).then(fn);
  return codaScritture;
}

export function aggiornaSeduta(id, patch) {
  return inFila(async () => {
    invalidaCacheSedute();
    const s = await db.get("sedute", id);
    if (!s) throw new Error("Seduta non trovata.");
    const agg = { ...s, ...patch };
    await db.put("sedute", agg);
    return agg;
  });
}

/**
 * Cambia solo alcune voci del progresso, fondendole su quello SALVATO.
 *
 * La differenza con `aggiornaSeduta({progresso: {...}})` è tutta qui: chi
 * chiama non deve ricostruire l'oggetto intero partendo dalla copia che ha in
 * memoria, che può essere già vecchia. «+15 s» toccato subito dopo «Pronto»
 * spediva un progresso costruito su una fotografia di un istante prima e
 * rimetteva il recupero appena chiuso. Così ognuno scrive solo la voce sua.
 */
export function aggiornaProgresso(id, patch) {
  return inFila(async () => {
    invalidaCacheSedute();
    const s = await db.get("sedute", id);
    if (!s) throw new Error("Seduta non trovata.");
    const agg = { ...s, progresso: { ...(s.progresso || {}), ...patch } };
    await db.put("sedute", agg);
    return agg;
  });
}

/**
 * Quando è finito davvero un allenamento: l'ultima cosa fatta (ultima serie o
 * fine cardio) più dieci minuti di margine per stretching e questionario. Se
 * il telefono resta acceso, l'orologio da solo direbbe ore.
 */
export function fineStimata(sed, serie = []) {
  const fineCardio =
    sed?.cardio?.finitoIl ||
    (sed?.cardio?.eseguito && sed.cardio.durataMin && sed.progresso?.cardioInizio
      ? sed.progresso.cardioInizio + sed.cardio.durataMin * 60000
      : 0);
  const ultimoGesto = Math.max(0, ...serie.map((x) => x.tsFineSerie || 0), fineCardio);
  const adesso = Date.now();
  if (!ultimoGesto) return Math.min(adesso, (sed?.oraInizio || adesso) + 10 * 60000);
  return adesso - ultimoGesto > 10 * 60000 ? ultimoGesto + 10 * 60000 : adesso;
}

/**
 * Quando è cominciato davvero l'allenamento che stai chiudendo.
 * Una seduta lasciata aperta ieri e ripresa oggi ha `oraInizio` di ieri: la
 * durata risultava di venti ore, e quel numero finiva nel pacchetto per il
 * coach insieme a una densità di 0,01 serie al minuto. Se fra l'inizio (o fra
 * due gesti) c'è un buco di ore, l'allenamento vero comincia dopo il buco.
 */
export function inizioStimato(sed, serie = []) {
  const BUCO = 3 * 3600000;
  const gesti = serie
    .map((x) => x.tsInizioSerie || x.tsFineSerie)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (!gesti.length) return sed?.oraInizio ?? Date.now();
  let inizio = sed?.oraInizio ?? gesti[0];
  if (gesti[0] - inizio > BUCO) inizio = gesti[0];
  for (let i = 1; i < gesti.length; i++) {
    if (gesti[i] - gesti[i - 1] > BUCO) inizio = gesti[i];
  }
  return inizio;
}

/**
 * Quanto è durato il lavoro vero, buchi esclusi. Serve alla densità: con una
 * seduta ripresa il giorno dopo, contare tutto il tempo dall'inizio darebbe
 * «0,01 serie al minuto» anche a un allenamento fatto bene.
 */
/**
 * Quanto è durato un allenamento, per chiunque lo chieda.
 *
 * Il tempo di LAVORO congelato alla chiusura; la distanza fra l'inizio e la
 * chiusura solo come ripiego, per le sedute vecchie che quel numero non ce
 * l'hanno. La differenza non è accademica: col cardio fatto ore dopo i pesi,
 * il 10 agosto lo Storico diceva «49 min» e il pacchetto per il coach «6h 06m».
 *
 * Esiste come funzione sola per un motivo preciso: la stessa regola era scritta
 * in tre posti — riepilogo, Storico e pacchetto — e uno dei tre era rimasto
 * indietro. Una regola scritta una volta non può divergere da sé stessa.
 */
export function durataSeduta(sed) {
  if (!sed) return null;
  if (sed.durataLavoroSec != null) return sed.durataLavoroSec;
  if (!sed.oraFine) return null;
  return Math.round((sed.oraFine - (sed.oraInizioLavoro || sed.oraInizio)) / 1000);
}

/**
 * Quanto caricare su un esercizio previsto, per chiunque lo chieda.
 *
 * L'ordine è: l'obiettivo di una proposta accettata, poi una decisione già
 * presa, poi il numero del brief, poi l'ultimo carico usato. `fatte` sono le
 * serie già chiuse oggi su quell'esercizio: dentro l'allenamento comanda quello
 * che stai davvero usando.
 *
 * Anche questa era scritta in tre posti, e quello dell'elenco del giorno si era
 * fermato al brief: dopo una proposta accettata l'elenco diceva 30 kg e ti
 * faceva montare i dischi per 30, poi l'esercizio ne chiedeva 35.
 */
export async function caricoProposto(v, { obiettivo = undefined, fatte = [] } = {}) {
  if (!v) return null;
  if (v.carico === 0) return null; // il brief l'ha messo a corpo libero: non si deduce dallo storico
  const ob = obiettivo !== undefined ? obiettivo : v.aTempo ? null : await obiettivoCorrente(v.esercizioId);
  return (
    fatte.at(-1)?.carico ??
    ob?.carico ??
    (await caricoDaDecisione(v.esercizioId)) ??
    (v.carico > 0 ? v.carico : null) ??
    (await ultimoCarico(v.esercizioId, v.carico ?? null))
  );
}

/** Come si scrive il bersaglio di un esercizio: «3 × 8-10», «3 × 12», «3 × 3 min». */
export function bersaglioProposto(v, obiettivo = null, durataScritta = null) {
  if (!v) return null;
  const tempo = durataScritta || ((sec) => (sec >= 60 && sec % 60 === 0 ? `${sec / 60} min` : `${sec}s`));
  if (v.aTempo) return `${v.serie} × ${tempo(v.durataSec || 0)}`;
  if (obiettivo?.rip != null) return `${v.serie} × ${obiettivo.rip}`;
  // Una serie da una ripetizione sola non è un bersaglio: è un gesto singolo.
  if (v.serie === 1 && v.ripMin === 1 && v.ripMax === 1) return null;
  return `${v.serie} × ${v.ripMin === v.ripMax ? v.ripMin : `${v.ripMin}-${v.ripMax}`}`;
}

/**
 * Un numero scritto a mano da te, letto allo stesso modo ovunque.
 *
 * Virgola o punto, spazi intorno, campo vuoto che vale «non lo so» e non zero.
 * Niente notazione scientifica, niente esadecimale, niente segno più: sulla
 * tastiera del telefono non si scrivono, e accettarli in una schermata e non
 * nell'altra faceva leggere «1e3» come mille di qua e come errore di là.
 */
export function numeroScritto(testo, { minimo = 0, decimali = 1 } = {}) {
  const t = String(testo ?? "").trim().replace(",", ".");
  if (t === "") return null;
  if (!/^-?\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < minimo) return null;
  const f = 10 ** decimali;
  return Math.round(n * f) / f;
}

export function durataLavoroSec(sed, serie = []) {
  const BUCO = 3 * 3600000;
  const gesti = serie
    .map((x) => x.tsFineSerie || x.tsInizioSerie)
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (!gesti.length) return null;
  let totale = 0;
  let prec = Math.min(sed?.oraInizio ?? gesti[0], gesti[0]);
  for (const g of gesti) {
    const passo = g - prec;
    if (passo > 0 && passo <= BUCO) totale += passo;
    prec = g;
  }
  // La coda è il tratto fra l'ultima serie e la fine: quasi sempre è il cardio.
  // Contarla per intero significava contare anche l'attesa — il tapis occupato,
  // il cardio rimandato di due ore — e scartarla del tutto (quando l'attesa
  // supera le tre ore) significava buttare via mezz'ora di camminata vera.
  // Quando il cardio è stato fatto e dice quanto è durato, vale quello.
  const fine = sed?.oraFine || fineStimata(sed, serie);
  const coda = fine - prec;
  // Senza cardio registrato la coda copre solo quello che viene dopo l'ultima
  // serie e non lascia un orario: stretching o mobilità. Vale al massimo il
  // tempo che serve a farli — venti minuti — invece delle tre ore di prima:
  // un cardio rimandato e mai fatto faceva risultare due ore e mezza di
  // allenamento a chi aveva alzato pesi per un quarto d'ora.
  const CODA_SENZA_CARDIO = 20 * 60000;
  const cardioMin = sed?.cardio?.eseguito ? Number(sed.cardio.durataMin) : null;
  if (Number.isFinite(cardioMin) && cardioMin > 0) {
    totale += Math.min(Math.max(coda, 0), cardioMin * 60000);
  } else if (coda > 0) {
    totale += Math.min(coda, CODA_SENZA_CARDIO);
  }
  return Math.round(totale / 1000);
}

export async function chiudiSeduta(id, { notaGenerale } = {}) {
  invalidaCacheSedute();
  const s = await db.get("sedute", id);
  if (!s) throw new Error("Questa seduta non esiste più: forse è stata eliminata altrove.");
  // La durata è quella dell'allenamento, non quella del telefono acceso: se il
  // riepilogo resta aperto un'ora, «Chiudi» segnava un'ora in più. Si guarda
  // l'ultima cosa fatta davvero: l'ultima serie OPPURE la fine del cardio,
  // qualunque delle due sia più tarda (il cardio viene dopo i pesi e dura
  // mezz'ora: dimenticarlo accorciava l'allenamento di tutto il cardio).
  const serieFatte = await db.byIndex("serie", "sedutaId", id);
  const fine = fineStimata(s, serieFatte);
  const inizioVero = inizioStimato(s, serieFatte);
  const agg = {
    ...s,
    stato: "completata",
    oraFine: fine,
    // L'inizio dichiarato resta (dice quando hai aperto l'allenamento), ma la
    // durata si misura da quando hai cominciato a lavorare davvero.
    oraInizioLavoro: inizioVero !== s.oraInizio ? inizioVero : null,
    // Il tempo di lavoro netto, congelato: la densità nel pacchetto per il
    // coach deve raccontare l'allenamento, non le ore di pausa.
    durataLavoroSec: durataLavoroSec({ ...s, oraFine: fine }, serieFatte),
    // `?? ` avrebbe tenuto la nota vecchia anche quando la cancelli davvero:
    // solo l'assenza del campo significa «non toccarla».
    notaGenerale: notaGenerale !== undefined ? notaGenerale : s.notaGenerale,
    progresso: { fase: "fine", indice: 0 },
  };
  await db.put("sedute", agg);
  // Il punteggio si calcola adesso, con il programma in vigore adesso, e resta
  // quello. Le Map non sopravvivono al salvataggio: diventano oggetti normali.
  const comp = await completezzaSeduta(id);
  if (comp) {
    agg.completezza = {
      totale: comp.totale,
      voci: comp.voci,
      penalita: comp.penalita,
      limite: comp.limite,
      // Quanti esercizi contava lo split quel giorno: congelato col punteggio,
      // altrimenti fra un mese il riepilogo scriverebbe «1 su 5» sotto un
      // anello calcolato su 4.
      previsti: comp.previsti ?? null,
      svolti: comp.svolti ?? null,
      saltati: comp.saltati ?? 0,
      perEsercizio: Object.fromEntries(comp.perEsercizio || new Map()),
      congelatoIl: new Date().toISOString(),
    };
    await db.put("sedute", agg);
  }
  return agg;
}

export async function annullaSeduta(id) {
  // L'allenamento del Watch resta in archivio ma non deve più puntare a una
  // seduta che non esiste: quel collegamento morto impediva di ricollegarlo.
  for (const a of await db.byIndex("allenamentiWatch", "sedutaId", id)) {
    await db.put("allenamentiWatch", { ...a, sedutaId: null });
  }
  invalidaCacheSedute();
  const serie = await db.byIndex("serie", "sedutaId", id);
  const logs = await db.byIndex("esercizioLog", "sedutaId", id);
  // Tutto in una transazione sola: o sparisce tutto o non sparisce niente.
  //
  // Cancellando uno per uno, un'interruzione a metà lasciava la seduta al suo
  // posto **senza una parte delle sue serie** — un allenamento che dice di
  // avere fatto tre serie invece di cinque, e nessuno se ne accorge. È il
  // tasto che si tocca quando si apre una seduta per sbaglio, quindi si usa
  // di fretta.
  await db.delMulti({
    serie: serie.map((r) => r.id),
    esercizioLog: logs.map((r) => r.id),
    sedute: [id],
  });
}

// ---------- serie ----------

export async function serieDi(sedutaId) {
  const r = await db.byIndex("serie", "sedutaId", sedutaId);
  return r.sort((a, b) => a.tsFineSerie - b.tsFineSerie);
}

export function registraSerie(dati) {
  return inFila(() => registraSerieVera(dati));
}

async function registraSerieVera({
  sedutaId,
  esercizioId,
  numero,
  carico,
  ripFatte,
  ripTarget,
  caricoTarget = null,
  aTempo = false,
  tsInizioSerie,
  recuperoTargetSec,
  misuraDallaSeduta = false,
}) {
  const tutteDellaSeduta = (await db.byIndex("serie", "sedutaId", sedutaId)).sort(
    (a, b) => a.tsFineSerie - b.tsFineSerie
  );
  const precedenti = tutteDellaSeduta.filter((s) => s.esercizioId === esercizioId);
  const ultima = precedenti.at(-1);
  const inizio = tsInizioSerie || (ultima ? ultima.tsFineSerie : Date.now());
  // Dentro un blocco fra una serie e l'altra dello stesso esercizio c'è di
  // mezzo la serie del compagno: misurare da lì a lì significava contare come
  // riposo anche il lavoro dell'altro esercizio, e un blocco eseguito alla
  // lettera risultava con i recuperi troppo lunghi. Il riposo vero è il tempo
  // passato dall'ULTIMA cosa fatta, qualunque esercizio fosse.
  const daCui = misuraDallaSeduta ? tutteDellaSeduta.at(-1) : ultima;

  const rec = {
    id: db.nuovoId("ser"),
    sedutaId,
    esercizioId,
    numero,
    carico: carico ?? null,
    ripFatte: ripFatte ?? null,
    ripTarget: ripTarget ?? null,
    // Il carico che l'app ha chiesto DAVVERO per questa serie: dopo una
    // riduzione accettata è più basso di quello scritto nel brief, e giudicare
    // sul brief faceva risultare «carico sotto il programmato» chi aveva fatto
    // esattamente quello che l'app gli aveva chiesto.
    caricoTarget: caricoTarget ?? null,
    aTempo,
    tsInizioSerie: inizio,
    tsFineSerie: Date.now(),
    recuperoTargetSec: recuperoTargetSec ?? null,
    // il recupero che PRECEDE questa serie
    // Senza cronometro non c'è un recupero misurato: dedurlo dall'orario di
    // partenza faceva risultare «recupero di 40 minuti» dopo una pausa in cui
    // l'app era chiusa.
    // Nessuna serie precedente di questo esercizio significa che non c'è
    // ancora nessun riposo da giudicare: è la prima volta che lo fai oggi.
    recuperoRealeSec:
      tsInizioSerie && ultima && daCui ? Math.max(0, Math.round((inizio - daCui.tsFineSerie) / 1000)) : null,
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("serie", rec);
  return rec;
}

/**
 * Corregge una serie già registrata, in fila come tutte le altre scritture.
 *
 * Le correzioni con i tasti − e + (ripetizioni fatte, carico usato) passavano
 * dritte a `db.put`, fuori dalla coda: due tocchi rapidi leggevano lo stesso
 * record di partenza e il secondo a scrivere cancellava il primo. Con il dito
 * fermo sul «+» è il caso normale, non un caso di scuola — ed è lo stesso
 * difetto che per il progresso della seduta era già stato chiuso.
 *
 * Rilegge SEMPRE il record dall'archivio prima di scriverci sopra: la copia
 * che ha in mano chi chiama può essere già vecchia.
 */
export function aggiornaSerie(id, patch) {
  return inFila(async () => {
    const attuale = await db.get("serie", id);
    if (!attuale) return null;
    const agg = { ...attuale, ...patch };
    await db.put("serie", agg);
    return agg;
  });
}

// ---------- questionario ----------

export function registraQuestionario(dati) {
  return inFila(() => registraQuestionarioVero(dati));
}

async function registraQuestionarioVero({
  sedutaId,
  esercizioId,
  ordine,
  punteggio = null,
  rpe,
  tecnica,
  dolori,
  nota,
}) {
  const esistenti = await db.byIndex("esercizioLog", "sedutaId", sedutaId);
  const prec = esistenti.find((l) => l.esercizioId === esercizioId);
  const elenco = (Array.isArray(dolori) ? dolori : [])
    .filter((d) => d && d.id)
    .map((d) => ({ id: d.id, nome: d.nome || d.id, quando: d.quando || null, intensita: d.intensita || null }));
  // Il polso resta scritto anche nei campi vecchi finché è uno dei punti
  // chiesti: gli allenamenti già in archivio e quelli nuovi devono restare
  // leggibili allo stesso modo, senza migrazioni del database.
  const polso = elenco.find((d) => d.id === "polso") || null;
  const rec = {
    id: prec?.id || db.nuovoId("log"),
    sedutaId,
    esercizioId,
    ordine,
    punteggio,
    rpe: rpe ?? null,
    tecnica: tecnica ?? null,
    dolori: elenco,
    dolorePolso: Boolean(polso),
    dolorePolsoQuando: polso?.quando || null,
    dolorePolsoIntensita: polso?.intensita || null,
    nota: (nota || "").trim() || null,
    saltato: null,
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("esercizioLog", rec);
  return rec;
}

export function registraSalto(dati) {
  return inFila(() => registraSaltoVero(dati));
}

async function registraSaltoVero({ sedutaId, esercizioId, ordine, motivo, nota }) {
  const esistenti = await db.byIndex("esercizioLog", "sedutaId", sedutaId);
  const prec = esistenti.find((l) => l.esercizioId === esercizioId);
  // Una valutazione già data non si butta via.
  //
  // Capita di rispondere alle domande e poi decidere che quell'esercizio è
  // saltato — l'attrezzo occupato, il dolore che arriva dopo, il tempo finito
  // a metà. Prima questa funzione riscriveva lo STESSO record azzerando RPE,
  // tecnica e dolori: sparivano senza un avviso, e con loro l'unica cosa che
  // spiegava perché l'esercizio è stato interrotto. Adesso quello che avevi
  // dichiarato resta; cambia soltanto che l'esercizio risulta saltato.
  //
  // Il punteggio non cambia comportamento: `completezzaSeduta` guarda
  // `saltato` e le serie, non l'RPE, e un esercizio saltato con serie
  // registrate resta «interrotto» come prima.
  const rec = {
    ...(prec || {}),
    id: prec?.id || db.nuovoId("log"),
    sedutaId,
    esercizioId,
    ordine,
    rpe: prec?.rpe ?? null,
    tecnica: prec?.tecnica ?? null,
    dolori: prec?.dolori || [],
    dolorePolso: prec?.dolorePolso || false,
    dolorePolsoQuando: prec?.dolorePolsoQuando || null,
    dolorePolsoIntensita: prec?.dolorePolsoIntensita || null,
    // La nota del salto non cancella quella dell'esercizio: sono due cose
    // diverse e finiscono in due posti diversi del pacchetto.
    nota: prec?.nota || (nota || "").trim() || null,
    saltato: { motivo, nota: (nota || "").trim() || null },
    creatoIl: prec?.creatoIl || new Date().toISOString(),
    fonte: "app",
  };
  await db.put("esercizioLog", rec);
  return rec;
}

export async function questionariDi(sedutaId) {
  const r = await db.byIndex("esercizioLog", "sedutaId", sedutaId);
  return r.sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
}

/**
 * Completezza di un allenamento. Un allenamento chiuso ha un punteggio solo:
 * quello congelato alla chiusura. Se manca (allenamento vecchio, o caricato
 * dai dati iniziali) viene calcolato adesso e congelato, così non esistono due
 * modi diversi di leggere lo stesso allenamento.
 */
export async function completezzaSeduta(id, gia = null) {
  // Chi ha già la seduta in mano può passarla: rileggerla dall'archivio è una
  // lettura per seduta, e il punteggio Salute le chiede tutte in fila. Con
  // 207 allenamenti erano **207 letture** solo per questo, e lo Storico ci
  // metteva 2,2 secondi ad aprirsi.
  const sed = gia && gia.id === id ? gia : await db.get("sedute", id);
  if (!sed) return null;
  // Un allenamento chiuso è un fatto avvenuto: il suo punteggio viene congelato
  // alla chiusura. Ricalcolarlo sullo split di oggi lo farebbe cambiare da solo
  // ogni volta che il coach aggiorna il programma.
  if (sed.completezza) {
    return { ...sed.completezza, perEsercizio: new Map(Object.entries(sed.completezza.perEsercizio || {})) };
  }
  // L'elenco congelato all'avvio vale più dello split di oggi: è quello che il
  // programma chiedeva quando ti sei allenato.
  const giorno = sed.previstiElenco?.length
    ? { esercizi: sed.previstiElenco }
    : giornoSplit(sed.tipoId);
  const serie = await serieDi(id);
  const logs = await questionariDi(id);
  const reg = regole();

  const punteggi = [];
  let saltati = 0;
  const perEsercizio = new Map();
  let mancanti = 0;
  for (const v of giorno?.esercizi || []) {
    const log = logs.find((l) => l.esercizioId === v.esercizioId);
    const sueSerie = serie.filter((x) => x.esercizioId === v.esercizioId);
    // Previsto e mai toccato: non è un esercizio "che non c'era", è lavoro che
    // manca. Se invece le serie ci sono ma manca il questionario (sei uscito
    // prima di rispondere), l'esercizio è stato fatto e va valutato: prima
    // spariva del tutto e il punteggio risultava più basso senza dirlo.
    if (!log && !sueSerie.length) {
      mancanti++;
      continue;
    }
    // Saltato ma con serie registrate = interrotto a metà: quel lavoro conta,
    // e il punteggio lo misura su quello che hai fatto. Solo un esercizio
    // saltato del tutto è «non svolto».
    if (log?.saltato && !sueSerie.length) {
      saltati++;
      continue;
    }
    const r = punteggioEsercizio({
      variante: v,
      serie: sueSerie,
      rpe: log?.rpe,
      tecnica: log?.tecnica,
      dolori: doloriDi(log),
      regole: reg,
    });
    punteggi.push(r.totale);
    perEsercizio.set(v.esercizioId, r);
  }

  const totale = punteggioAllenamento({
    previsti: giorno?.esercizi?.length ?? logs.length,
    // Le soglie di quel giorno, non quelle di oggi.
    regoleCardio: sed.cardio?.soglie || null,
    punteggi,
    saltati,
    cardio: sed.cardio,
    riscaldamento: Boolean(sed.riscaldamento?.fatto),
    stretching: Boolean(sed.stretching?.fatto),
    // Quel giorno li prevede? Il riscaldamento c'è sempre — almeno la
    // camminata, che non dipende dal giorno. Lo stretching finale no: sui
    // giorni del nuovo split al suo posto c'è il blocco di mobilità, e una
    // voce a zero per una cosa che il programma non chiede è una penalità
    // inventata.
    // Congelato come tutto il resto.
    //
    // Qui si chiedeva al protocollo di ADESSO se quel giorno prevedeva lo
    // stretching, mentre l'elenco degli esercizi e le soglie del cardio sono
    // quelli congelati alla partenza: la stessa seduta veniva giudicata metà
    // col programma di allora e metà con quello di oggi. Se il valore è stato
    // scritto quando la seduta è nata, comanda quello; per le sedute più
    // vecchie resta il protocollo corrente, che è tutto quello che si può
    // sapere di loro.
    previstoStretching:
      sed.previstoStretching != null
        ? Boolean(sed.previstoStretching)
        : Boolean(riscaldamento(sed.tipoId)?.stretchingFinale?.length),
    // La voce entra solo se quel giorno aveva un blocco di mobilità: sulle
    // sedute di prima, e sui giorni che non ne hanno, non deve comparire una
    // riga a zero per una cosa che non era prevista.
    mobilita: sed.mobilita ? { fatto: Boolean(sed.mobilita.fatto) } : null,
    regole: reg,
  });

  // Gli allenamenti chiusi prima che i punteggi venissero congelati (e quelli
  // caricati dai tuoi dati) non ne avevano uno: si ricalcolavano ogni volta, e
  // bastava un cambio di programma per far cambiare da solo un punteggio di
  // luglio. Al primo sguardo vengono congelati anche loro, e da lì restano
  // fermi come tutti gli altri.
  // Ma non a qualunque costo. Se la seduta non porta con sé l'elenco di quello
  // che il programma chiedeva quel giorno (`previstiElenco`) E il suo tipo non
  // esiste più nello split di oggi, il conto qui sopra è stato fatto contro un
  // programma che non c'entra: gli esercizi risultano tutti mancanti e il
  // punteggio crolla. Congelarlo vorrebbe dire incidere per sempre un numero
  // sbagliato — misurato: le tre sedute di luglio passavano da 54/53/57 a
  // 24/24/13, in silenzio, ripristinando un backup di inizio agosto.
  // Meglio nessun punteggio congelato che uno falso: senza il congelamento il
  // valore vero torna appena l'app ritrova un elenco a cui riferirsi.
  const senzaRiferimento = !sed.previstiElenco?.length && !giornoSplit(sed.tipoId);
  if (sed.stato === "completata" && !senzaRiferimento) {
    await db.put("sedute", {
      ...sed,
      completezza: {
        ...totale,
        perEsercizio: Object.fromEntries(perEsercizio),
        congelatoIl: new Date().toISOString(),
        congelatoDopo: true,
      },
    });
    invalidaCacheSedute();
  }

  return { ...totale, perEsercizio };
}

/** Quante righe ci sono davvero in archivio, per categoria. */
export async function conteggioArchivio() {
  const sedute = await db.all("sedute");
  const date = sedute.map((s) => s.data).sort();
  return {
    allenamenti: sedute.filter((s) => s.stato === "completata").length,
    aperti: sedute.filter((s) => s.stato !== "completata").length,
    serie: await db.count("serie"),
    questionari: await db.count("esercizioLog"),
    misure: await db.count("misure"),
    foto: await db.count("foto"),
    giorniSalute: (await db.all("giorniSalute")).filter((g) => g.presente !== false).length,
    notti: (await db.all("notti")).filter((n) => n.presente !== false).length,
    primo: date[0] ? date[0].split("-").reverse().join("/") : null,
  };
}

// ---------- storico per esercizio ----------

/** Esposizioni passate di un esercizio, dalla più recente. */
/* L'elenco delle sedute viene riletto da esposizioni() una volta per ogni
   esercizio: con sette esercizi e un anno di storico erano sette letture
   dell'intero archivio a ogni schermata. Qui resta in memoria per pochi
   istanti, il tempo di un disegno, e si invalida a ogni scrittura. */
let cacheSedute = null;
export function invalidaCacheSedute() {
  cacheSedute = null;
}
async function seduteInMemoria() {
  if (cacheSedute) return cacheSedute;
  cacheSedute = new Map((await db.all("sedute")).map((s) => [s.id, s]));
  setTimeout(() => {
    cacheSedute = null;
  }, 1500);
  return cacheSedute;
}

/**
 * Quante volte quell'esercizio è stato DAVVERO fatto.
 * Il motore delle proposte conta così (js/segnali.js: niente saltati, e almeno
 * una serie): tutto il resto dell'app deve contare allo stesso modo, altrimenti
 * un esercizio saltato «consumava» una proposta accettata senza portare dati.
 */
export const esposizioniSvolte = (esp) => (esp || []).filter((e) => !e.saltato && e.serie?.length);

export async function esposizioni(esercizioId, { soloCompletate = true } = {}) {
  // Senza esercizio non c'è storia da raccontare. Sembra ovvio, ma la ricerca
  // per indice con una chiave assente non restituisce NIENTE: restituisce
  // TUTTO. Un id che si perde per strada avrebbe fatto dire alla storia di un
  // esercizio che l'hai fatto in ogni allenamento che hai mai fatto — una
  // risposta sbagliata, non un errore, quindi nessuno se ne sarebbe accorto.
  if (!esercizioId) return [];
  const serie = await db.byIndex("serie", "esercizioId", esercizioId);
  const logs = await db.byIndex("esercizioLog", "esercizioId", esercizioId);
  const perId = await seduteInMemoria();

  const perSeduta = new Map();
  for (const s of serie) {
    if (!perSeduta.has(s.sedutaId)) perSeduta.set(s.sedutaId, { serie: [], log: null });
    perSeduta.get(s.sedutaId).serie.push(s);
  }
  for (const l of logs) {
    if (!perSeduta.has(l.sedutaId)) perSeduta.set(l.sedutaId, { serie: [], log: null });
    perSeduta.get(l.sedutaId).log = l;
  }

  const out = [];
  for (const [sedutaId, v] of perSeduta) {
    const sed = perId.get(sedutaId);
    if (!sed) continue;
    if (soloCompletate && sed.stato !== "completata") continue;
    v.serie.sort((a, b) => a.tsFineSerie - b.tsFineSerie);
    out.push({
      sedutaId,
      data: sed.data,
      serie: v.serie,
      log: v.log,
      saltato: v.log?.saltato || null,
      caricoMax: v.serie.reduce((m, s) => Math.max(m, s.carico ?? 0), 0) || null,
      caricoLavoro: v.serie.length ? v.serie.at(-1).carico ?? null : null,
      rpe: v.log?.rpe ?? null,
      tecnica: v.log?.tecnica ?? null,
    });
  }
  return out.sort((a, b) => (a.data < b.data ? 1 : -1));
}

/** Ultimo carico usato (per precompilare la serie). */
export async function ultimoCarico(esercizioId, fallback = null) {
  const e = await esposizioni(esercizioId, { soloCompletate: false });
  for (const x of e) {
    const c = x.serie.filter((s) => s.carico != null).at(-1)?.carico;
    if (c != null) return c;
  }
  return fallback;
}

// ---------- volumi ----------

/**
 * Serie settimanali per pattern: quelle dei sette giorni che hai davanti.
 *
 * Non è la somma di tutto lo split. Nel brief possono esserci due programmi
 * insieme — quello che stai finendo e quello che comincia — e sommarli dava
 * 156 serie a settimana invece di 78: due settimane lette come una. Qui si
 * guarda cosa tocca davvero da oggi ai prossimi sette giorni, che è la
 * domanda che fa il titolo della tabella.
 *
 * Senza calendario ogni giorno della settimana conta una volta sola, come per
 * `giornoPrevisto`: se due giorni dello split occupano lo stesso giorno della
 * settimana, comanda il primo scritto.
 */
export function volumePerPattern(oggi = isoDate()) {
  const giorni = [];
  if (agendaAttiva()) {
    for (let i = 0; i < 7; i++) {
      const g = giornoPrevisto(piuGiorni(oggi, i));
      if (g) giorni.push(g);
    }
  } else {
    const perGiornoSettimana = new Map();
    for (const g of giorniSplit()) {
      if (!perGiornoSettimana.has(g.giorno)) perGiornoSettimana.set(g.giorno, g);
    }
    giorni.push(...perGiornoSettimana.values());
  }
  const out = new Map();
  for (const g of giorni) {
    for (const v of g.esercizi || []) {
      const def = esercizio(v.esercizioId);
      if (!def) continue;
      const p = def.pattern || "altro";
      out.set(p, (out.get(p) || 0) + (v.serie || 0));
    }
  }
  return [...out.entries()]
    .map(([pattern, serie]) => ({ pattern, serie }))
    .sort((a, b) => b.serie - a.serie);
}

export const ETICHETTE_PATTERN = {
  spinta: "Spinta",
  tirataOrizzontale: "Tirata orizzontale",
  tirataVerticale: "Tirata verticale",
  quadricipiti: "Quadricipiti",
  femorali: "Femorali",
  // I glutei stavano sotto «femorali»: ponte, ponte coi piedi rialzati,
  // abduzioni in decubito laterale e donkey kick sono lavoro sui glutei, e
  // contarli fra i femorali falsava la lettura del volume su tutti e due.
  // Separati il 14/08 su decisione del coach.
  glutei: "Glutei",
  polpacci: "Polpacci",
  core: "Core",
  deltoideLaterale: "Deltoide laterale",
  deltoidePosteriore: "Deltoide posteriore",
  trapezi: "Trapezi",
  bicipiti: "Bicipiti isolati",
  tricipiti: "Tricipiti isolati",
  dorsaliAltro: "Dorsali (altro)",
  // Non è uno schema di forza: sono le attività dei giorni di recupero attivo
  // (Pilates, camminata). Sta a parte per non gonfiare il volume del core con
  // sedute che allenanti non sono.
  recupero: "Recupero attivo",
};

// ---------- decisioni ----------

export async function registraDecisione({
  oggetto,
  livello,
  testo,
  fonte = "app",
  dataVerifica = null,
  propostaId = null,
}) {
  const rec = {
    id: db.nuovoId("dec"),
    data: isoDate(),
    oggetto,
    livello,
    testo,
    fonte,
    dataVerifica,
    esitoVerifica: null,
    propostaId,
    creatoIl: new Date().toISOString(),
  };
  await db.put("decisioni", rec);
  return rec;
}

export async function decisioni() {
  const r = await db.all("decisioni");
  return r.sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1));
}

// ---------- proposte ----------

export async function proposte(stato = null) {
  const r = await db.all("proposte");
  const f = stato ? r.filter((p) => p.stato === stato) : r;
  return f.sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1));
}

export const proposteInSospeso = () => proposte("inSospeso");

export async function proposta(id) {
  return db.get("proposte", id);
}

/**
 * Ricalcola le proposte di progressione per tutto lo split.
 *
 * Il motore è senza memoria: ogni giro riparte dai dati. Quello che la memoria
 * serve a evitare è ripetere una proposta a cui l'atleta ha già risposto —
 * accettata o rifiutata non si ripropone, rimandata torna dopo la prossima
 * esposizione. Una proposta in sospeso che non regge più ai dati viene tolta:
 * meglio niente che un consiglio scaduto.
 */
/**
 * Una proposta che il brief ha GIÀ realizzato non è più una proposta.
 *
 * Le proposte nascono da quello che hai alzato, non da quello che c'è scritto:
 * se l'ultima volta hai fatto 30 kg, l'app propone 31 anche se nel frattempo
 * il coach ha portato la scheda a 35. Chiedere di decidere una cosa già
 * decisa — e decisa più in grande — è rumore, e soprattutto è una domanda a
 * cui rispondere «sì» farebbe scendere il carico. Vale anche se non hai mai
 * risposto: la proposta sparisce lo stesso. Lo stesso per le ripetizioni.
 *
 * Sta qui, in una funzione sola, perché la regola serve in due punti: a chi
 * salva le proposte e a chi spiega perché non ce ne sono. Quando i due
 * percorsi la applicavano in modo diverso, gli esercizi soppressi qui
 * sparivano anche dall'elenco dei perché: né proposti né spiegati.
 *
 * @returns la frase da mostrare, oppure null se la proposta regge.
 */
export function propostaSuperataDalBrief(proposta, variante) {
  if (!proposta) return null;
  const da = proposta.da?.carico;
  const a = proposta.a?.carico;
  if (variante.carico != null && a != null && da != null) {
    const gia = a > da ? variante.carico >= a : variante.carico <= a;
    if (gia) {
      // Tre casi diversi, tre frasi diverse: chiamare «discesa» una proposta
      // che il carico non lo cambia affatto è peggio del silenzio.
      if (a > da) return `Il brief chiede già ${num(variante.carico)} kg, cioè almeno quanto la proposta: superata.`;
      if (a < da) return `Il brief è già sceso a ${num(variante.carico)} kg: la proposta è superata.`;
      return `Il brief è già a ${num(variante.carico)} kg, che è il carico della proposta: non c'è niente da cambiare.`;
    }
  }
  if (
    proposta.tipo === "ripetizioni" &&
    proposta.a?.rip != null &&
    variante.ripMin != null &&
    variante.ripMin >= proposta.a.rip
  ) {
    return `Il brief parte già da ${variante.ripMin} ripetizioni: la proposta è superata.`;
  }
  return null;
}

export async function aggiornaProposte(cache = null) {
  if (!PROGRAMMA) return { create: 0, tolte: 0 };
  const oggi = isoDate();
  const reg = regole();
  const inv = await inventario();
  const esistenti = await db.all("proposte");
  const sedute = await seduteInMemoria();
  let create = 0;
  let tolte = 0;

  for (const [esercizioId, variante] of varianti()) {
    const def = esercizio(esercizioId);
    if (!def || def.archiviato) continue;

    const esp = cache?.get(esercizioId) ?? (await esposizioni(esercizioId));
    // Per i confronti con le risposte già date conta solo il lavoro vero.
    const svolte = esposizioniSvolte(esp);
    const { proposta: nuova } = valutaProgressione({
      variante,
      def,
      esposizioni: esp,
      regole: reg,
      inventario: inv,
      oggi,
    });

    const mie = esistenti.filter((p) => p.esercizioId === esercizioId);
    const sospese = mie.filter((p) => p.stato === "inSospeso");

    // Una proposta che il brief ha GIÀ realizzato non è più una proposta.
    //
    // Le proposte nascono da quello che hai alzato, non da quello che c'è
    // scritto: se l'ultima volta hai fatto 30 kg, l'app propone 31 anche se
    // nel frattempo il coach ha portato la scheda a 35. Chiedere di decidere
    // una cosa già decisa — e decisa più in grande — è rumore, e soprattutto
    // è una domanda a cui rispondere «sì» farebbe scendere il carico.
    // Vale anche se non hai mai risposto: la proposta sparisce lo stesso.
    const superata = propostaSuperataDalBrief(nuova, variante);

    if (!nuova || superata) {
      for (const p of sospese) {
        await db.del("proposte", p.id);
        tolte++;
      }
      continue;
    }

    const firma = firmaProposta(nuova);

    // Le proposte in sospeso che non corrispondono più a quello che dicono i
    // dati vanno tolte comunque, anche quando poi si esce senza crearne una
    // nuova: restavano in Home a chiedere una decisione su una situazione
    // superata.
    for (const p of sospese) {
      if (p.firma === firma) continue;
      await db.del("proposte", p.id);
      tolte++;
    }

    const rispostaPrec = mie
      .filter((p) => p.firma === firma && p.stato !== "inSospeso")
      .sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1))[0];

    if (rispostaPrec) {
      // Si contano le esposizioni fatte DOPO la risposta, guardando l'orario:
      // un conteggio può scendere (basta eliminare un allenamento vecchio dallo
      // storico) e una proposta rimandata non sarebbe più tornata, contro
      // quello che l'app aveva promesso a schermo.
      const dopoRisposta = rispostaPrec.rispostoIl
        ? svolte.filter((e) => {
            const ultima = e.serie?.at(-1)?.tsFineSerie;
            if (ultima) return new Date(ultima).toISOString() > rispostaPrec.rispostoIl;
            const sed = sedute.get(e.sedutaId);
            return sed?.oraFine ? new Date(sed.oraFine).toISOString() > rispostaPrec.rispostoIl : false;
          }).length
        : Math.max(
            0,
            svolte.length - (rispostaPrec.esposizioniAllaRisposta ?? rispostaPrec.esposizioniAllaData ?? 0)
          );
      if (rispostaPrec.stato === "rimandata") {
        // rimandata: torna solo quando c'è un dato nuovo dopo la risposta
        if (dopoRisposta < 1) continue;
      } else {
        // Accettata o rifiutata non si ripropone subito. Ma «mai più» è
        // sbagliato: dopo un ciclo intero di allenamenti la situazione è
        // un'altra, e la stessa proposta torna a essere una domanda sensata.
        if (dopoRisposta < (reg.progressione?.esposizioniPerRiproporre ?? 4)) continue;
      }
    }

    if (sospese.some((p) => p.firma === firma)) continue;
    await db.put("proposte", {
      id: db.nuovoId("pro"),
      data: oggi,
      stato: "inSospeso",
      firma,
      esposizioniAllaData: svolte.length,
      esitoVerifica: null,
      rispostoIl: null,
      creatoIl: new Date().toISOString(),
      fonte: "app",
      ...nuova,
    });
    create++;
  }

  // Un esercizio tolto dal brief (o archiviato) non passa più dal giro qui
  // sopra: le sue proposte in sospeso resterebbero in Home per sempre, a
  // chiedere una decisione su un esercizio che non fai più.
  const vivi = new Set(
    [...varianti()].map(([id]) => id).filter((id) => {
      const d = esercizio(id);
      return d && !d.archiviato;
    })
  );
  for (const p of esistenti) {
    if (p.stato !== "inSospeso" || vivi.has(p.esercizioId)) continue;
    await db.del("proposte", p.id);
    tolte++;
  }

  return { create, tolte };
}

/**
 * Perché un esercizio non ha una proposta. Serve a rendere visibile il
 * silenzio del motore: «nessuna proposta» senza motivo è indistinguibile da
 * un motore rotto.
 */
export async function diagnosiProgressione() {
  const reg = regole();
  const inv = await inventario();
  const out = [];
  for (const [esercizioId, variante] of varianti()) {
    const def = esercizio(esercizioId);
    if (!def || def.archiviato) continue;
    const esp = await esposizioni(esercizioId);
    const { proposta, motivo } = valutaProgressione({
      variante,
      def,
      esposizioni: esp,
      regole: reg,
      inventario: inv,
      oggi: isoDate(),
    });
    // La stessa regola che impedisce di salvarla: se il brief l'ha già
    // realizzata la proposta non esiste, e allora l'esercizio va spiegato
    // invece di sparire.
    const superata = propostaSuperataDalBrief(proposta, variante);
    out.push({
      esercizioId,
      nome: def.nome,
      esposizioni: esp.length,
      proposta: superata ? null : proposta,
      motivo: superata || motivo,
    });
  }
  return out;
}

const ETICHETTA_ESITO = {
  accettata: "accettata",
  rifiutata: "rifiutata",
  rimandata: "rimandata",
};

/** Accetto / Rifiuto / Rimando. L'esito finisce sempre nel registro decisioni. */
export async function rispondiAProposta(id, stato, { nota = null } = {}) {
  const p = await db.get("proposte", id);
  if (!p) throw new Error("Questa proposta non esiste più.");
  if (!ETICHETTA_ESITO[stato]) throw new Error(`Esito non previsto: ${stato}.`);

  // Quante volte avevi fatto quell'esercizio NEL MOMENTO in cui hai risposto.
  // Prima si usava il conto di quando la proposta era nata: se ti allenavi
  // prima di rispondere, «Accetto» valeva già zero (l'obiettivo veniva scartato
  // subito) e «Rimando» faceva ricomparire la stessa proposta all'istante.
  // Anche l'allenamento ancora aperto conta: rispondendo a metà seduta, il
  // lavoro già fatto oggi non deve valere come «fatto dopo la risposta»,
  // altrimenti «Rimando» risultava consumato appena chiudevi.
  const espOra = esposizioniSvolte(await esposizioni(p.esercizioId, { soloCompletate: false }));
  // La verifica si conta da quando accetti, non da quando la proposta è nata:
  // una proposta accettata dopo tre settimane risultava «da verificare» il
  // giorno stesso, e la verifica non voleva più dire niente.
  const giorniVerifica = 14;
  const agg = {
    ...p,
    stato,
    rispostoIl: new Date().toISOString(),
    esposizioniAllaRisposta: espOra.length,
    dataVerifica: stato === "accettata" ? piuGiorni(isoDate(), giorniVerifica) : p.dataVerifica,
    notaRisposta: nota,
  };
  await db.put("proposte", agg);

  await registraDecisione({
    oggetto: p.titolo,
    livello: p.livelloGerarchia,
    testo:
      `Proposta ${ETICHETTA_ESITO[stato]} (livello ${p.livelloGerarchia} — ${nomeLivello(p.livelloGerarchia)}).` +
      (nota ? ` Nota: ${nota}` : ""),
    fonte: "app",
    dataVerifica: stato === "accettata" ? agg.dataVerifica : null,
    propostaId: p.id,
  });

  return agg;
}

/**
 * L'obiettivo in vigore per un esercizio: viene da una proposta accettata e
 * vale per la prossima esposizione, poi il motore rivaluta sui dati nuovi.
 */
export async function obiettivoCorrente(esercizioId) {
  const mie = (await db.byIndex("proposte", "esercizioId", esercizioId))
    .filter((p) => p.stato === "accettata")
    // Una proposta nata prima del brief in vigore parlava di un programma che
    // non c'è più: il coach ha appena riscritto i carichi, comanda lui.
    // Conta QUANDO hai risposto: una proposta nata prima del brief nuovo ma
    // accettata dopo è una tua decisione presa col brief nuovo sotto gli occhi.
    .filter((p) => !PROGRAMMA?.caricatoIl || (p.rispostoIl || p.creatoIl || "") > PROGRAMMA.caricatoIl)
    .sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1));
  const p = mie[0];
  if (!p) return null;
  const esp = esposizioniSvolte(await esposizioni(esercizioId));
  // Consumato o no si decide sul TEMPO, non su un conteggio: se cancelli un
  // allenamento il conteggio scende e un obiettivo già usato tornava in vita.
  // Se dopo la risposta hai allenato quell'esercizio, la proposta è servita.
  const rispostoIl = p.rispostoIl || null;
  if (rispostoIl) {
    const sedute = await seduteInMemoria();
    // Conta quando hai fatto QUELL'esercizio, non quando hai chiuso la seduta:
    // se accetti a metà allenamento, la chiusura arriva dopo e l'obiettivo
    // risultava consumato senza che tu l'avessi mai usato.
    const dopo = esp.some((e) => {
      const ultima = e.serie?.at(-1)?.tsFineSerie;
      if (ultima) return new Date(ultima).toISOString() > rispostoIl;
      const sed = sedute.get(e.sedutaId);
      const fine = sed?.oraFine ? new Date(sed.oraFine).toISOString() : null;
      return fine ? fine > rispostoIl : false;
    });
    if (dopo) return null;
  } else {
    const quando = p.esposizioniAllaRisposta ?? p.esposizioniAllaData;
    if (esp.length !== quando) return null;
  }
  return { carico: p.a.carico, rip: p.a.rip, tipo: p.tipo, propostaId: p.id, titolo: p.titolo };
}

/**
 * Il carico che hai già deciso per questo esercizio, quando l'obiettivo è stato
 * consumato ma la decisione vale ancora.
 *
 * Una proposta accettata vale per una esposizione sola, ed è giusto così: dopo
 * quella il motore rivaluta sui dati nuovi. Ma il carico non è una cosa che si
 * disfa da sé. Con lo stesso esercizio su due giorni della settimana — squat il
 * mercoledì e il venerdì — succedeva questo: mercoledì accetti +2,5 kg e alzi
 * 22,5, venerdì l'app te ne richiede 20, perché l'obiettivo era finito e il
 * numero del brief tornava a comandare. Due giorni dopo, sullo stesso esercizio,
 * senza che nessuno avesse deciso di tornare indietro.
 *
 * Qui torna solo il **carico**, e solo se viene da una decisione presa dopo il
 * brief in vigore. Non il bersaglio di ripetizioni: quello deve restare libero
 * di risalire dentro il range, che è la doppia progressione. E non vale per un
 * carico semplicemente alzato di meno una volta: quello resta uno scarto dal
 * programma, e il punteggio deve continuare a dirlo.
 */
export async function caricoDaDecisione(esercizioId) {
  const decisioni = (await db.byIndex("proposte", "esercizioId", esercizioId))
    .filter((p) => p.stato === "accettata" && p.a?.carico != null)
    .filter((p) => !PROGRAMMA?.caricatoIl || (p.rispostoIl || p.creatoIl || "") > PROGRAMMA.caricatoIl)
    .sort((a, b) => ((a.rispostoIl || a.creatoIl || "") < (b.rispostoIl || b.creatoIl || "") ? 1 : -1));
  return decisioni[0]?.a.carico ?? null;
}

/**
 * Proposte accettate, ognuna con l'indicazione se l'app la sta ancora usando.
 * Una proposta vale per la prossima esposizione: dopo quella il motore rivaluta
 * sui dati nuovi. Dirle tutte «in vigore» farebbe credere al coach che il
 * carico allenato sia uno mentre l'app ne chiede già un altro.
 */
export async function proposteAccettate() {
  const tutte = (await db.all("proposte")).filter((p) => p.stato === "accettata");
  const perEsercizio = new Map();
  for (const p of tutte) {
    if (!perEsercizio.has(p.esercizioId)) {
      perEsercizio.set(p.esercizioId, esposizioniSvolte(await esposizioni(p.esercizioId)));
    }
  }
  const sedute = await seduteInMemoria();
  const usata = (p) => {
    const esp = perEsercizio.get(p.esercizioId) || [];
    if (!p.rispostoIl) return esp.length !== (p.esposizioniAllaRisposta ?? p.esposizioniAllaData);
    return esp.some((e) => {
      const ultima = e.serie?.at(-1)?.tsFineSerie;
      if (ultima) return new Date(ultima).toISOString() > p.rispostoIl;
      const sed = sedute.get(e.sedutaId);
      const fine = sed?.oraFine ? new Date(sed.oraFine).toISOString() : null;
      return fine ? fine > p.rispostoIl : false;
    });
  };
  // Per un esercizio vale UNA proposta sola: la più recente ancora buona,
  // esattamente quella che la seduta userà. Prima potevano risultare «in
  // vigore» due carichi diversi per lo stesso esercizio.
  const vinta = new Map();
  const scartata = new Map();
  for (const p of [...tutte].sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1))) {
    const vecchiaDiBrief =
      PROGRAMMA?.caricatoIl && (p.rispostoIl || p.creatoIl || "") <= PROGRAMMA.caricatoIl;
    if (vecchiaDiBrief) {
      scartata.set(p.id, "annullataDalBrief");
      continue;
    }
    if (usata(p)) {
      scartata.set(p.id, "usata");
      continue;
    }
    if (!vinta.has(p.esercizioId)) vinta.set(p.esercizioId, p.id);
    else scartata.set(p.id, "superata");
  }
  // Il motivo viaggia con la proposta: il coach deve poter distinguere «l'hai
  // già allenata» da «l'ha annullata il tuo brief nuovo».
  return tutte.map((p) => ({
    ...p,
    inVigore: vinta.get(p.esercizioId) === p.id,
    motivoScarto: vinta.get(p.esercizioId) === p.id ? null : scartata.get(p.id) || "usata",
  }));
}

/** Proposte accettate arrivate alla data di verifica e ancora senza esito. */
export async function verificheDovute() {
  const oggi = isoDate();
  const r = await db.all("proposte");
  return r
    .filter((p) => p.stato === "accettata" && !p.esitoVerifica && p.dataVerifica && p.dataVerifica <= oggi)
    // Una proposta che il brief nuovo ha annullato non ha niente da
    // verificare: l'app non l'ha mai usata, e chiederne l'esito significava
    // far confermare al coach una modifica mai applicata.
    .filter((p) => !PROGRAMMA?.caricatoIl || (p.rispostoIl || p.creatoIl || "") > PROGRAMMA.caricatoIl)
    // Nemmeno un esercizio che il coach ha tolto dal programma.
    .filter((p) => {
      const def = esercizio(p.esercizioId);
      return def && !def.archiviato;
    })
    .sort((a, b) => (a.dataVerifica < b.dataVerifica ? -1 : 1));
}

export async function chiudiVerifica(id, esito, { nota = null } = {}) {
  const p = await db.get("proposte", id);
  if (!p) throw new Error("Questa proposta non esiste più.");
  const agg = { ...p, esitoVerifica: { esito, nota, data: isoDate() } };
  await db.put("proposte", agg);

  const decs = await db.all("decisioni");
  const legata = decs.filter((d) => d.propostaId === id).sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1))[0];
  if (legata) await db.put("decisioni", { ...legata, esitoVerifica: { esito, nota, data: isoDate() } });

  await registraDecisione({
    oggetto: `Verifica: ${p.titolo}`,
    livello: p.livelloGerarchia,
    testo: esito === "confermata" ? `Confermata.${nota ? ` ${nota}` : ""}` : `Non confermata.${nota ? ` ${nota}` : ""}`,
    fonte: "app",
    propostaId: id,
  });

  return agg;
}

// ---------- segnali ----------

export async function segnali({ inclusiArchiviati = false } = {}) {
  const r = await db.all("segnali");
  const f = inclusiArchiviati ? r : r.filter((s) => !s.archiviato);
  const peso = { attenzione: 0, info: 1 };
  return f.sort((a, b) => (peso[a.gravita] ?? 2) - (peso[b.gravita] ?? 2));
}

/**
 * Ricalcola i segnali. Gli id sono deterministici: un segnale che persiste
 * viene riscritto, non duplicato, e quello che non regge più sparisce.
 * L'archiviazione decisa dall'atleta sopravvive al ricalcolo, ma solo finché
 * il messaggio resta identico: se il segnale cambia, torna a farsi vedere.
 */
export async function aggiornaSegnali(cache = null) {
  const complete = (await allenamenti()).filter((s) => s.stato === "completata");
  // I segnali guardano indietro di quattro allenamenti: leggere i questionari di
  // tutto lo storico a ogni giro sarebbe lavoro buttato via.
  const logsPerSeduta = new Map();
  for (const s of complete.slice(0, 4)) logsPerSeduta.set(s.id, await questionariDi(s.id));

  const mappaVarianti = varianti();
  const esposizioniPerEsercizio = cache || (await mappaEsposizioni());

  const giorni = await giorniSalute();
  const nottiTutte = await notti();
  const reg = regole();
  const conf = { settimane: reg.finestra.settimane, minimoSettimana: reg.finestra.minimoSettimana };

  const nuovi = calcolaSegnali({
    allenamenti: complete,
    logsPerSeduta,
    esercizi: new Map(libreria().map((e) => [e.id, e])),
    varianti: mappaVarianti,
    esposizioniPerEsercizio,
    giorniSalute: giorni,
    notti: nottiTutte,
    finestraMovimento: giorni.length ? statoFinestra(giorni, { ...conf, campo: "kcalAttive" }) : null,
    finestraSonno: nottiTutte.length ? statoFinestra(nottiTutte, { ...conf, campo: "durataMin" }) : null,
    regole: reg,
    oggi: isoDate(),
  });

  const vecchi = new Map((await db.all("segnali")).map((s) => [s.id, s]));
  const vivi = new Set(nuovi.map((s) => s.id));

  for (const s of nuovi) {
    const prec = vecchi.get(s.id);
    const invariato = prec && prec.messaggio === s.messaggio && prec.dettaglio === s.dettaglio;
    await db.put("segnali", {
      ...s,
      archiviato: invariato ? Boolean(prec.archiviato) : false,
      creatoIl: prec?.creatoIl || new Date().toISOString(),
    });
  }
  for (const id of vecchi.keys()) if (!vivi.has(id)) await db.del("segnali", id);

  return nuovi.length;
}

export async function archiviaSegnale(id) {
  const s = await db.get("segnali", id);
  if (!s) return null;
  const agg = { ...s, archiviato: true };
  await db.put("segnali", agg);
  return agg;
}

async function mappaEsposizioni() {
  const m = new Map();
  for (const id of varianti().keys()) m.set(id, await esposizioni(id));
  return m;
}

/** Un solo giro: proposte e segnali si ricalcolano insieme, sugli stessi dati. */
let giroMotore = null;
/** Ogni ricalcolo passa di qui: due giri in parallelo creavano doppioni. */
export function inCoda(fn) {
  giroMotore = (giroMotore || Promise.resolve()).catch(() => {}).then(fn);
  return giroMotore;
}
/**
 * Un giro alla volta: due ricalcoli in parallelo (fine allenamento e apertura
 * della Home nello stesso istante) leggevano gli stessi dati e potevano creare
 * la stessa proposta due volte.
 */
export function aggiornaMotore(...args) {
  giroMotore = (giroMotore || Promise.resolve())
    .catch(() => {})
    .then(() => giroMotoreVero(...args));
  return giroMotore;
}

async function giroMotoreVero() {
  const cache = await mappaEsposizioni();
  const p = await aggiornaProposte(cache);
  const s = await aggiornaSegnali(cache);
  return { proposte: p, segnali: s };
}

// ---------- misure ----------

export async function misure(tipo = null) {
  const r = await db.all("misure");
  const f = tipo ? r.filter((m) => m.tipo === tipo) : r;
  return f.sort((a, b) => (a.data < b.data ? 1 : -1));
}

export async function registraMisura({ data = isoDate(), tipo, valore, condizioniStandard = true }) {
  // Una misura per tipo e per giorno: rimisurarti nello stesso giorno
  // correggeva il valore, invece ne salvava un secondo e i grafici mostravano
  // due punti sulla stessa data.
  const stesse = await db.byIndex("misure", "data", data);
  const prec = stesse.find((m) => m.tipo === tipo);
  const rec = {
    id: prec?.id || db.nuovoId("mis"),
    data,
    tipo,
    valore,
    condizioniStandard,
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("misure", rec);
  return rec;
}

/**
 * Cancella una misura sbagliata.
 *
 * Finora l'unico modo di correggere era sovrascrivere: salvarne un'altra con la
 * stessa data. Basta quando hai sbagliato il numero, non quando hai sbagliato
 * il giorno — quella misura resta lì per sempre, entra negli indici, nei
 * confronti e nel pacchetto per il coach, e non c'è nessuna strada per toglierla.
 * Le foto e gli allenamenti si cancellano da sempre; le misure no.
 *
 * Restituisce la misura tolta, così chi chiama può dire cosa ha eliminato
 * invece di un generico «fatto».
 */
export async function cancellaMisura(id) {
  const m = await db.get("misure", id);
  if (!m) return null;
  await db.del("misure", id);
  return m;
}

export async function ultimaMisura(tipo) {
  const m = await misure(tipo);
  return m[0] || null;
}

// ---------- import dati Salute ----------

/**
 * Applica un pacchetto già analizzato. È idempotente: la chiave è la data
 * (o l'uuid per gli allenamenti), quindi reimportare gli stessi giorni
 * riscrive, non duplica.
 *
 * Un giorno della finestra che non compare nel pacchetto viene segnato come
 * non registrato — ma un giorno già presente non viene mai declassato: se il
 * dato c'era, un export incompleto non deve cancellarlo.
 */
/**
 * Campi che iPhone e Watch registrano tutti e due: se il comando rapido somma i
 * campioni di entrambe le fonti, li conta due volte. Le kcal attive no — quelle
 * le scrive solo l'orologio — ed è per questo che un raddoppio si riconosce:
 * le calorie restano identiche e i passi crescono.
 */
const CAMPI_A_RISCHIO_DOPPIO = {
  passi: "passi",
  distanzaKm: "distanza",
  pianiSaliti: "piani",
  minutiInPiedi: "tempo in piedi",
};

/**
 * Limiti di quello che un corpo umano fa in una giornata.
 *
 * Non sono soglie di merito: sono il confine del possibile. Un valore fuori di
 * qui non è «un giorno strano», è un numero sbagliato — quasi sempre un comando
 * rapido che somma una finestra intera in un giorno solo, o che mette un campo
 * al posto di un altro. Lasciarlo entrare significa avvelenare in silenzio la
 * media, il punteggio e il pacchetto per il coach, e ritrovarlo mesi dopo.
 *
 * Il massimo è largo apposta: deve fermare l'impossibile, non l'eccezionale.
 */
const LIMITI_GIORNO = {
  kcalAttive: { min: 0, max: 5000, nome: "movimento", unita: "kcal" },
  passi: { min: 0, max: 100000, nome: "passi", unita: "" },
  minutiEsercizio: { min: 0, max: 1440, nome: "minuti di esercizio", unita: "min" },
  minutiInPiedi: { min: 0, max: 1440, nome: "tempo in piedi", unita: "min" },
  pianiSaliti: { min: 0, max: 500, nome: "piani", unita: "" },
  distanzaKm: { min: 0, max: 200, nome: "distanza", unita: "km" },
  fcRiposo: { min: 25, max: 120, nome: "frequenza a riposo", unita: "bpm" },
  obiettivoKcal: { min: 50, max: 5000, nome: "obiettivo movimento", unita: "kcal" },
};

/* Sotto questo scarto due letture della stessa notte sono la stessa notte:
   arrotondamenti fra fasi e totale, non un conteggio diverso. */
const SCARTO_NOTTE_MIN = 15;

const LIMITI_NOTTE = {
  durataMin: { min: 0, max: 1080, nome: "durata del sonno", unita: "min" },
  profondoMin: { min: 0, max: 1080, nome: "sonno profondo", unita: "min" },
  remMin: { min: 0, max: 1080, nome: "sonno REM", unita: "min" },
  vegliaMin: { min: 0, max: 1080, nome: "veglia", unita: "min" },
  risvegli: { min: 0, max: 100, nome: "risvegli", unita: "" },
};

/**
 * Toglie dalla riga i valori impossibili e dice quali erano. Quello che resta
 * viene importato lo stesso: un campo sbagliato non deve buttare via la
 * giornata intera.
 */
function scartaImpossibili(riga, limiti, data, scartati) {
  const pulita = { ...riga };
  for (const [campo, L] of Object.entries(limiti)) {
    const v = pulita[campo];
    if (v == null) continue;
    if (!Number.isFinite(v) || v < L.min || v > L.max) {
      scartati.push(
        `${dataBreve(data)} ${L.nome}: ${num(v, 0)}${L.unita ? ` ${L.unita}` : ""} — fuori da quello che una giornata può contenere`
      );
      pulita[campo] = null;
    }
  }
  return pulita;
}

export async function importaSalute(pacchetto) {
  const conteggio = { giorni: 0, notti: 0, allenamenti: 0, vuoti: 0, aggiornati: 0, sospetti: [], impossibili: [], nottiTolte: [], nottiDiscordanti: [], troppoVecchi: 0 };

  // Il pavimento vale per TUTTE le strade, non solo per l'export letto dal file.
  //
  // La regola è dichiarata («non entra niente di più vecchio dell'inizio di
  // questa storia») e serve a non riempire medie e grafici di giornate che il
  // programma non ha mai guardato — l'archivio di Salute contiene anni. Ma era
  // applicata soltanto dentro `pacchettoDaExport`: un pacchetto **incollato**
  // con dentro giugno entrava senza che nessuno lo fermasse. Provato: due
  // giorni di giugno finiti in archivio.
  //
  // Qui è il punto unico da cui passano tutte le importazioni, quindi è qui che
  // il pavimento deve stare.
  const pavimento = await inizioStoria();
  if (pavimento) {
    const prima = (x) => x?.data && x.data < pavimento;
    const contaEScarta = (elenco) => {
      const tenuti = (elenco || []).filter((x) => !prima(x));
      conteggio.troppoVecchi += (elenco || []).length - tenuti.length;
      return tenuti;
    };
    pacchetto = {
      ...pacchetto,
      giorni: contaEScarta(pacchetto.giorni),
      notti: contaEScarta(pacchetto.notti),
      allenamenti: contaEScarta(pacchetto.allenamenti),
      fasi: (pacchetto.fasi || []).filter((f) => String(f?.fine || "").slice(0, 10) >= pavimento),
    };
  }

  /**
   * Fonde solo i campi valorizzati: due righe per lo stesso giorno, una con le
   * kcal e una con i passi, si sommano invece di cancellarsi. Serve a tenere
   * semplice il comando rapido, che può produrre un blocco di righe per tipo
   * senza doverli incrociare per data.
   */
  const fondi = (prec, nuovo) => {
    const out = { ...(prec || {}), ...{ data: nuovo.data } };
    for (const [k, v] of Object.entries(nuovo)) {
      if (v !== null && v !== undefined) out[k] = v;
    }
    out.presente = Boolean(prec?.presente) || Boolean(nuovo.presente);
    return out;
  };

  // Il riepilogo conta i GIORNI, non le righe: il comando può mandare una riga
  // per le kcal e una per i passi dello stesso giorno, e «14 giorni importati»
  // quando i giorni erano sette è un numero che non vuol dire niente.
  const giorniVisti = new Set();
  const nottiViste = new Set();
  for (const gGrezzo of pacchetto.giorni) {
    // Prima di tutto il resto: quello che non può essere vero non entra.
    const g = scartaImpossibili(gGrezzo, LIMITI_GIORNO, gGrezzo.data, conteggio.impossibili);
    const prec = await db.get("giorniSalute", g.data);
    if (prec?.presente && !giorniVisti.has(g.data)) conteggio.aggiornati++;
    // Un giorno già chiuso non cambia: se il valore nuovo è molto diverso da
    // quello che c'era, uno dei due conteggi è sbagliato. Sovrascrivere in
    // silenzio significherebbe scegliere al posto tuo quale credere.
    if (prec?.presente && g.data < isoDate()) {
      for (const [campo, nome] of Object.entries(CAMPI_A_RISCHIO_DOPPIO)) {
        const vecchio = prec[campo];
        const nuovo = g[campo];
        if (vecchio == null || nuovo == null || vecchio <= 0) continue;
        const rapporto = nuovo / vecchio;
        if (rapporto >= 1.4 || rapporto <= 0.7) {
          conteggio.sospetti.push(
            `${dataBreve(g.data)} ${nome}: ${num(vecchio, 0)} → ${num(nuovo, 0)} (×${num(rapporto, 2)})`
          );
        }
      }
    }
    await db.put("giorniSalute", {
      ...fondi(prec, g),
      fonte: "salute",
      importatoIl: new Date().toISOString(),
    });
    giorniVisti.add(g.data);
    conteggio.giorni = giorniVisti.size;
  }

  for (const nGrezza of pacchetto.notti) {
    const n = scartaImpossibili(nGrezza, LIMITI_NOTTE, nGrezza.data, conteggio.impossibili);
    const prec = await db.get("notti", n.data);
    nottiViste.add(n.data);
    // Una notte corretta a mano vince sull'orologio, sempre. È l'unica cosa
    // che sappiamo per certo — l'hai scritta tu — e l'orologio è proprio la
    // ragione per cui è stata corretta: lasciargliela sovrascrivere al primo
    // import successivo vorrebbe dire correggerla per finta.
    if (prec?.fonte === "mano") {
      conteggio.nottiAMano = (conteggio.nottiAMano || 0) + 1;
      conteggio.notti = nottiViste.size;
      // La notte tua resta la tua, ma quella dell'orologio si tiene da parte:
      // «torna al dato dell'orologio» deve avere un dato a cui tornare. Prima
      // l'import la scartava e quel tasto finiva per cancellare la notte.
      await db.put("notti", { ...prec, orologio: soloDatiNotte(n) });
      continue;
    }
    // Una notte già passata e già in archivio non si riscrive per il solo fatto
    // che è arrivato un pacchetto dopo. Fra le due durate vince la PIÙ LUNGA.
    //
    // Non è una preferenza: su una notte finita i campioni di Salute non
    // cambiano più: quello che cambia è la finestra con cui il comando rapido
    // li chiede, e una finestra tagliata può solo TOGLIERE sonno, mai
    // aggiungerlo. Quindi fra due letture della stessa notte quella corta è
    // quella incompleta.
    //
    // Verificato su dati veri due volte, nei due versi: la notte del 2-3/08
    // vale 6h43 ricalcolata dalle fasi grezze — e 6h43 è il numero controllato
    // su Salute nativa. Prima arrivò per prima e fu sovrascritta da 5h45; poi
    // 5h45 era in archivio e 6h43 arrivava nel pacchetto. Con «vince la più
    // lunga» il numero giusto sopravvive in tutti e due i casi.
    //
    // La differenza viene detta comunque: una notte che cambia da sola, anche
    // in meglio, è una cosa che chi legge il pacchetto deve sapere.
    const scartoNotte =
      prec?.presente &&
      prec.fonte === "salute" &&
      n.data < isoDate() &&
      prec.durataMin != null &&
      n.durataMin != null &&
      Math.abs(prec.durataMin - n.durataMin) >= SCARTO_NOTTE_MIN;
    if (scartoNotte) {
      const tengoQuellaInArchivio = prec.durataMin >= n.durataMin;
      const tenuta = tengoQuellaInArchivio ? prec.durataMin : n.durataMin;
      const scartata = tengoQuellaInArchivio ? n.durataMin : prec.durataMin;
      conteggio.nottiDiscordanti.push(
        `${dataBreve(n.data)}: tengo ${durataUmana(tenuta * 60)}, scarto ${durataUmana(scartata * 60)} (${tengoQuellaInArchivio ? "la più corta arrivava nel pacchetto" : "la più corta era in archivio"})`
      );
      const base = tengoQuellaInArchivio ? prec : { ...fondi(prec, n), fonte: "salute" };
      await db.put("notti", {
        ...base,
        scartata: soloDatiNotte(tengoQuellaInArchivio ? n : prec),
        importatoIl: new Date().toISOString(),
      });
      conteggio.notti = nottiViste.size;
      continue;
    }
    await db.put("notti", {
      ...fondi(prec, n),
      fonte: "salute",
      importatoIl: new Date().toISOString(),
    });
    conteggio.notti = nottiViste.size;
  }

  // ---- riconciliazione delle notti ----
  //
  // Le fasi del sonno raccontano per intero le notti che coprono: se dentro
  // quel periodo l'archivio ha una notte che questo pacchetto non conferma,
  // quella notte è un residuo — tipicamente la stessa dormita, archiviata sotto
  // una data sbagliata da una versione precedente dell'app.
  //
  // Prima l'unico modo di toglierla era «Cancella i dati importati da Salute»,
  // cioè buttare via tutto lo storico per correggere un giorno. Un'app che per
  // ripararsi ti chiede di perdere dati non è riparabile: fra sei mesi il costo
  // sarebbe insostenibile e il difetto resterebbe lì. Reimportare deve bastare.
  //
  // QUATTRO reti di sicurezza, e la quarta è quella che mancava.
  //
  // «Il periodo coperto dalle fasi» era il tratto fra la prima e l'ultima fase
  // del pacchetto — ma le fasi non sono continue: il comando rapido ne manda
  // per alcune notti e non per altre, e ogni notte in mezzo che il pacchetto
  // non nominava veniva cancellata. Un pacchetto con le fasi dell'11 agosto e
  // una fase vecchia del 4 ha tolto cinque notti buone fra le due, e nella
  // finestra del sonno il conteggio è SCESO da un pacchetto all'altro invece di
  // salire: il difetto si vedeva solo lì, perché la tabella del pacchetto mostra
  // le ultime sette notti e quelle tolte erano più indietro.
  //
  // Quello che si vuole togliere è una cosa sola: la STESSA dormita archiviata
  // sotto la data sbagliata da una versione vecchia dell'app. Ha una firma
  // precisa — è attaccata a una notte che il pacchetto descrive davvero, e dura
  // quanto quella. Senza quella firma, non si tocca.
  if (pacchetto.fasi?.length) {
    const inizi = pacchetto.fasi.map((f) => f.inizio.slice(0, 10)).sort();
    const fini = pacchetto.fasi.map((f) => f.fine.slice(0, 10)).sort();
    // Un giorno di margine all'indietro: una notte spostata di un giorno cade
    // appena fuori dal periodo delle sue stesse fasi, ed è proprio quella da
    // ripulire.
    const primo = new Date(inizi[0] + "T00:00:00");
    primo.setDate(primo.getDate() - 1);
    const dal = isoDate(primo);
    const al = fini[fini.length - 1];
    const nelPacchetto = new Map(
      (pacchetto.notti || []).filter((n) => n.durataMin != null).map((n) => [n.data, n.durataMin])
    );
    const eLaStessaDormita = (vecchia) => {
      if (vecchia.durataMin == null) return false;
      const d = new Date(vecchia.data + "T00:00:00");
      for (const scarto of [-1, 1]) {
        const vicina = new Date(d);
        vicina.setDate(vicina.getDate() + scarto);
        const durata = nelPacchetto.get(isoDate(vicina));
        if (durata != null && Math.abs(durata - vecchia.durataMin) < SCARTO_NOTTE_MIN) return true;
      }
      return false;
    };
    for (const vecchia of await db.all("notti")) {
      if (vecchia.data < dal || vecchia.data > al) continue;
      if (nottiViste.has(vecchia.data)) continue;
      // Una notte scritta a mano (riga NOTTE, o inserita da te) non si tocca:
      // il pacchetto delle fasi non ha voce in capitolo su quella.
      if (vecchia.fonte !== "salute") continue;
      if (!eLaStessaDormita(vecchia)) continue;
      await db.del("notti", vecchia.data);
      conteggio.nottiTolte.push(dataBreve(vecchia.data));
    }
  }

  for (const a of pacchetto.allenamenti) {
    const prec = await db.get("allenamentiWatch", a.uuid);
    // Si fonde, non si sostituisce.
    //
    // Un pacchetto più ricco riempie quello che mancava — distanza, battito,
    // sforzo, indoor, ora di fine — ed è il motivo per cui questi numeri si
    // riscrivono a ogni import. Ma un pacchetto più POVERO non deve svuotare
    // quello che c'era: succede davvero, e non per un caso di scuola. Lo
    // strumento sul Mac (`tools/salute-da-export.py`) scrive quattro campi,
    // il lettore che gira sul telefono ne scrive dodici più la curva del
    // battito: chi importava dal Mac dopo aver importato dal telefono si
    // ritrovava gli allenamenti svuotati, e con la distanza se ne andava anche
    // il passo al chilometro.
    //
    // La regola è la stessa che vale per i giorni di salute e per le notti:
    // un campo assente vuol dire «non lo so», non «azzeralo».
    const unito = { ...(prec || {}) };
    for (const [k, v] of Object.entries(a)) {
      if (v !== null && v !== undefined) unito[k] = v;
    }
    await db.put("allenamentiWatch", {
      ...unito,
      fonte: "salute",
      importatoIl: new Date().toISOString(),
    });
    conteggio.allenamenti++;
  }

  if (pacchetto.finestra) {
    const { giorniDellaFinestra } = await import("./salute.js");
    const conDati = new Set(pacchetto.giorni.map((g) => g.data));
    const nottiConDati = new Set(pacchetto.notti.map((n) => n.data));
    for (const data of giorniDellaFinestra(pacchetto.finestra.da, pacchetto.finestra.a)) {
      // Anche i giorni «senza dati» rispettano il pavimento: una finestra che
      // parte da giugno riempiva l'archivio di settantatré giornate vuote più
      // vecchie dell'inizio di questa storia, che poi comparivano nei grafici e
      // nel conteggio delle finestre come buchi da riempire. Provato davvero.
      if (pavimento && data < pavimento) continue;
      if (!conDati.has(data)) {
        const prec = await db.get("giorniSalute", data);
        if (!prec?.presente) {
          await db.put("giorniSalute", { data, presente: false, fonte: "salute" });
          conteggio.vuoti++;
        }
      }
      if (!nottiConDati.has(data)) {
        const prec = await db.get("notti", data);
        if (!prec?.presente) await db.put("notti", { data, presente: false, fonte: "salute" });
      }
    }
  }

  if (pacchetto.agenda?.length) {
    // L'agenda vive dentro le impostazioni, non in uno store suo: aggiungere
    // uno store significherebbe cambiare versione al database, e un
    // aggiornamento di schema che va storto sul telefono è un rischio che
    // questi dati non valgono.
    const precedente = (await impostazione("agenda")) || {};
    const ora = new Date().toISOString();

    // Nello stesso giorno possono esserci più eventi: l'allenamento e un
    // promemoria («Misura la pressione», «Foto progressi»). Vince quello che
    // corrisponde a un giorno del programma, indipendentemente dall'ordine in
    // cui il comando rapido li ha messi in fila.
    const perData = new Map();
    for (const e of pacchetto.agenda) {
      const giornoId = abbinaAlloSplit(e.titolo, e.data);
      const scelto = perData.get(e.data) || {
        data: e.data,
        titolo: null,
        nota: null,
        giornoId: null,
        // Tutti gli eventi del giorno restano: quello che non è un allenamento
        // è un promemoria del coach e va mostrato lo stesso.
        altri: [],
        importatoIl: ora,
      };
      // Un allenamento vero batte sempre un «riposo» scritto lo stesso giorno:
      // prima vinceva chi arrivava per primo, e un promemoria di riposo poteva
      // nascondere l'allenamento previsto dal coach.
      if (giornoId && giornoId !== "riposo" && scelto.giornoId === "riposo") {
        scelto.altri.push(scelto.titolo);
        scelto.titolo = e.titolo;
        scelto.giornoId = giornoId;
        scelto.nota = e.nota ?? null;
      } else if (giornoId && !scelto.giornoId) {
        // l'allenamento prende il posto principale, l'eventuale titolo che
        // c'era prima scala fra i promemoria
        if (scelto.titolo) scelto.altri.push(scelto.titolo);
        scelto.titolo = e.titolo;
        scelto.giornoId = giornoId;
        scelto.nota = e.nota ?? null;
      } else if (!scelto.titolo) {
        scelto.titolo = e.titolo;
        scelto.giornoId = giornoId;
        scelto.nota = e.nota ?? null;
      } else {
        // La nota viaggia col titolo a cui appartiene: promuovendo poi un
        // titolo diverso, restava appiccicata la nota di un altro evento.
        scelto.altri.push(e.nota ? { titolo: e.titolo, nota: e.nota } : e.titolo);
      }
      perData.set(e.data, scelto);
    }
    // Contano i giorni, non gli eventi: due eventi lo stesso giorno restano
    // un giorno solo.
    // (stessa idea per i giorni di salute: vedi `conteggio.giorni` più su)
    conteggio.agenda = perData.size;
    // Il pacchetto copre un intervallo continuo: dentro quell'intervallo è la
    // verità completa. Le date che il calendario non nomina più vanno svuotate,
    // altrimenti un allenamento cancellato dal coach resterebbe qui per sempre.
    // Ogni lettura del calendario guarda sempre la stessa finestra in avanti.
    // Quindi un giorno da oggi in poi che questa lettura NON nomina è un
    // giorno che il coach ha cancellato: va tolto, anche se cade fuori
    // dall'intervallo delle date lette (prima sopravviveva proprio quello in
    // fondo, cioè l'ultimo allenamento cancellato).
    const oggiIso = isoDate();
    for (const [data, voce] of Object.entries(precedente)) {
      if (data < oggiIso) continue; // il passato non viene riletto: non si tocca
      if (perData.has(data)) continue;
      if (voce.importatoIl && voce.importatoIl < ora) delete precedente[data];
    }
    const lette = [...perData.keys()].sort();
    const da = lette[0];
    const a = lette[lette.length - 1];
    for (const data of Object.keys(precedente)) {
      if (data >= da && data <= a && !perData.has(data)) delete precedente[data];
    }
    for (const [data, voce] of perData) precedente[data] = voce;
    // Oltre le sei settimane non serve a niente e non deve crescere all'infinito.
    // Il passato non si butta se contiene un allenamento: quello che il coach
    // aveva previsto e tu non hai fatto è la cosa che gli serve di più, e
    // cancellandolo il giorno diventava «non era previsto niente». Si tolgono
    // solo i promemoria vecchi, che non raccontano nulla.
    // Data locale, non UTC: `toISOString()` in Italia dopo le 22 segna già
    // domani, e il limite scivolava di un giorno. È lo stesso inciampo
    // corretto poco più sotto per la finestra di lettura.
    const scadenza = new Date();
    scadenza.setDate(scadenza.getDate() - 42);
    const limite = isoDate(scadenza);
    for (const [d, voce] of Object.entries(precedente)) {
      if (d < limite && !voce.giornoId) delete precedente[d];
    }

    await setImpostazione("agenda", precedente);
    AGENDA = new Map(Object.entries(precedente));
    await setImpostazione("ultimoImportAgenda", ora);
    // La finestra coperta parte dalla PRIMA lettura: le letture successive
    // guardano sempre in avanti, ma i giorni già letti restano letti. Usando
    // l'ultima lettura, i giorni in mezzo tornavano allo split e l'app
    // riproponeva allenamenti che il coach non aveva messo.
    // Data locale: `ora` è in UTC e dopo le 22 in Italia segnava già domani,
    // quindi la finestra letta partiva da un giorno che non era ancora arrivato.
    const oggiLetto = isoDate();
    const prima = await impostazione("primaLetturaAgenda");
    if (!prima) await setImpostazione("primaLetturaAgenda", oggiLetto);
    LETTURA_AGENDA = (prima || oggiLetto).slice(0, 10);
    ULTIMA_LETTURA_AGENDA = oggiLetto;
    const coperturaNuova = piuGiorni(oggiLetto, ORIZZONTE_AGENDA_GIORNI);
    // Si registra la finestra di QUESTA lettura, senza cancellare le altre.
    const finestre = (await impostazione("finestreAgenda")) || [];
    finestre.push({ da: oggiLetto, a: coperturaNuova });
    // Unione delle finestre che si toccano: l'elenco non deve crescere all'infinito.
    finestre.sort((x, y) => (x.da < y.da ? -1 : 1));
    const unite = [];
    for (const f of finestre) {
      const ultima = unite[unite.length - 1];
      if (ultima && f.da <= piuGiorni(ultima.a, 1)) {
        if (f.a > ultima.a) ultima.a = f.a;
      } else unite.push({ ...f });
    }
    FINESTRE_AGENDA = unite;
    await setImpostazione("finestreAgenda", unite);
    const coperturaVecchia = await impostazione("coperturaAgenda");
    COPERTURA_AGENDA =
      coperturaVecchia && coperturaVecchia > coperturaNuova ? coperturaVecchia : coperturaNuova;
    await setImpostazione("coperturaAgenda", COPERTURA_AGENDA);
  }

  // «Ultimo import» dei dati salute si aggiorna solo se sono davvero arrivati
  // dati di salute: leggere il calendario non ha niente a che vedere.
  if (pacchetto.giorni.length || pacchetto.notti.length || pacchetto.allenamenti.length) {
    await setImpostazione("ultimoImportSalute", new Date().toISOString());
  }
  return conteggio;
}

// ---------- agenda: il calendario dice quale allenamento, il brief cosa contiene ----------

/** Normalizza un titolo per confrontarlo: niente accenti, spazi, punteggiatura. */
const chiaveTitolo = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

// Parole che non identificano un allenamento: se restassero dentro, «Gambe e
// core» non riconoscerebbe più un evento intitolato «Gambe/Core».
const PAROLE_VUOTE = new Set([
  "e", "ed", "il", "lo", "la", "i", "gli", "le", "di", "del", "della", "dei",
  "con", "a", "al", "coach", "allenamento", "workout", "palestra", "gym", "giorno",
]);

/** Le parole che contano di un titolo, senza accenti, punteggiatura e riempitivi. */
const paroleDi = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p && !PAROLE_VUOTE.has(p));

/**
 * Trova il giorno dello split che corrisponde al titolo di un evento.
 *
 * Il confronto è per PAROLE, non per contenimento della stringa intera. Il
 * motivo è concreto: il brief ha rinominato «Gambe/Core» in «Gambe e core», e
 * gli eventi sul calendario portano ancora il nome vecchio. Confrontando le
 * stringhe appiccicate — «gambecore» contro «gambeecore» — non combaciavano più
 * per via di una «e», e mezzo calendario risultava «non è un allenamento del
 * programma». Per parole invece [gambe, core] sta dentro [gambe, core] e il
 * giorno si riconosce, comunque lo si scriva.
 *
 * Basta che TUTTE le parole del nome (o dell'id) del giorno siano nel titolo:
 * parole in più nell'evento non danno fastidio, così «Coach — Gambe/Core (ore
 * 18)» funziona. Vince il giorno che ne azzecca di più.
 */
/**
 * @param data  giorno dell'evento (ISO). Serve a scegliere fra due giorni dello
 *   split che si chiamano uguale: il weekend di mobilità ha sabato e domenica
 *   con lo stesso nome, «Mobilità», e senza la data l'evento della domenica
 *   finiva sul giorno «sabato» — la voce «domenica» non veniva usata mai, e
 *   nello storico un allenamento di domenica risultava fatto di sabato.
 */
export function abbinaAlloSplit(titolo, data = null) {
  const t = chiaveTitolo(titolo);
  if (!t) return null;
  const parole = new Set(paroleDi(titolo));
  const giornoDellEvento = data ? weekdayOf(data) : null;

  // Prima si cerca l'allenamento, poi il riposo: un evento come «Gambe/Core,
  // poi riposo attivo» nomina un allenamento e vale come allenamento. Prima
  // bastava la parola «riposo» in qualunque punto per cancellarlo.
  let migliore = null;
  let quantePiu = 0;
  let miglioreDelGiorno = false;
  if (parole.size) {
    for (const g of giorniSplit()) {
      for (const insieme of [paroleDi(g.nome), paroleDi(g.id)]) {
        if (!insieme.length) continue;
        if (!insieme.every((p) => parole.has(p))) continue;
        // A parità di parole vince quello che cade nel giorno della settimana
        // dell'evento: è l'unica cosa che distingue due giorni omonimi.
        const delGiorno = giornoDellEvento != null && g.giorno === giornoDellEvento;
        const meglio =
          insieme.length > quantePiu || (insieme.length === quantePiu && delGiorno && !miglioreDelGiorno);
        if (meglio) {
          quantePiu = insieme.length;
          migliore = g;
          miglioreDelGiorno = delGiorno;
        }
      }
    }
  }
  if (migliore) return migliore.id;

  // Rete di sicurezza: il vecchio confronto per contenimento, per i titoli che
  // funzionavano prima e che le parole non prendono (abbreviazioni attaccate,
  // «FullBody» scritto tutto unito).
  for (const g of giorniSplit()) {
    const k = chiaveTitolo(g.nome);
    if (!k) continue;
    // Il contenimento al contrario vale solo per titoli abbastanza lunghi:
    // un evento chiamato «F» non deve diventare «Full Body».
    if (t.includes(k) || (t.length >= 4 && k.includes(t))) {
      if (!migliore || k.length > chiaveTitolo(migliore.nome).length) migliore = g;
    }
  }
  if (migliore) return migliore.id;
  return t.includes("riposo") ? "riposo" : null;
}

async function caricaAgenda() {
  AGENDA = new Map(Object.entries((await impostazione("agenda")) || {}));
  const prima = await impostazione("primaLetturaAgenda");
  const ultima = await impostazione("ultimoImportAgenda");
  const letta = prima || ultima;
  LETTURA_AGENDA = letta ? String(letta).slice(0, 10) : null;
  ULTIMA_LETTURA_AGENDA = ultima ? String(ultima).slice(0, 10) : LETTURA_AGENDA;
  COPERTURA_AGENDA = (await impostazione("coperturaAgenda")) || null;
  FINESTRE_AGENDA = (await impostazione("finestreAgenda")) || [];
  // Archivi vecchi: nessuna finestra registrata, si usa il periodo intero.
  if (!FINESTRE_AGENDA.length && LETTURA_AGENDA && COPERTURA_AGENDA) {
    FINESTRE_AGENDA = [{ da: LETTURA_AGENDA, a: COPERTURA_AGENDA }];
  }
  return AGENDA;
}

/** Da quando a quando arriva l'ultima lettura del calendario. */
/**
 * Il periodo che il calendario ha davvero coperto.
 * Non parte dal primo evento ma dal giorno della lettura: il comando legge da
 * oggi in avanti, quindi i giorni fra la lettura e il primo evento SONO stati
 * guardati e sono vuoti sul serio. Prima l'app li riempiva con lo split e
 * proponeva allenamenti che il coach non aveva messo.
 */
/** Quante settimane in avanti guarda il comando «Coach Calendario». */
const ORIZZONTE_AGENDA_GIORNI = 28;

export function intervalloAgenda() {
  if (!agendaAttiva()) return null;
  const date = [...AGENDA.keys()].sort();
  const letta = LETTURA_AGENDA;
  const da = letta && letta < date[0] ? letta : date[0];
  const ultimoEvento = date[date.length - 1];
  // La fine del periodo coperto NON è l'ultimo allenamento programmato: il
  // comando legge sempre alcune settimane in avanti, e i giorni dopo l'ultimo
  // evento sono stati guardati e sono vuoti. Prima l'app chiedeva di
  // aggiornare un calendario appena letto, all'infinito.
  // La copertura non si accorcia mai: una rilettura guarda in avanti, ma i
  // giorni già letti restano letti. Senza questo, rileggendo il calendario i
  // giorni fra la lettura vecchia e quella nuova tornavano «non letti».
  const finestraOra = ULTIMA_LETTURA_AGENDA
    ? piuGiorni(ULTIMA_LETTURA_AGENDA, ORIZZONTE_AGENDA_GIORNI)
    : ultimoEvento;
  const finestra =
    COPERTURA_AGENDA && COPERTURA_AGENDA > finestraOra ? COPERTURA_AGENDA : finestraOra;
  return { da, a: finestra > ultimoEvento ? finestra : ultimoEvento, ultimoEvento };
}

export async function agenda() {
  if (!AGENDA) await caricaAgenda();
  return [...AGENDA.values()].sort((a, b) => (a.data < b.data ? -1 : 1));
}

/** Riprova ad abbinare gli eventi già letti ai giorni dello split corrente. */
async function riabbinaAgenda() {
  const salvata = (await impostazione("agenda")) || {};
  if (!Object.keys(salvata).length) return;
  let cambiato = false;
  for (const e of Object.values(salvata)) {
    // Si riprovano TUTTI i titoli del giorno, non solo il principale: un
    // allenamento finito fra i promemoria perché il brief di allora non lo
    // conosceva deve poter tornare al suo posto adesso.
    // `altri` può contenere stringhe (formato vecchio) o {titolo, nota}.
    const comeVoce = (x) => (typeof x === "string" ? { titolo: x, nota: null } : x);
    const titoli = [{ titolo: e.titolo, nota: e.nota || null }, ...(e.altri || []).map(comeVoce)].filter(
      (x) => x && x.titolo
    );
    let id = null;
    let vincitore = null;
    for (const t of titoli.map((x) => x.titolo)) {
      const trovato = abbinaAlloSplit(t, e.data);
      if (trovato && trovato !== "riposo") {
        id = trovato;
        vincitore = t;
        break;
      }
      if (trovato && !id) {
        id = trovato;
        vincitore = t;
      }
    }
    if (vincitore && vincitore !== e.titolo) {
      const voceVinta = titoli.find((x) => x.titolo === vincitore);
      e.altri = titoli.filter((x) => x.titolo !== vincitore).map((x) => (x.nota ? x : x.titolo));
      e.titolo = vincitore;
      e.nota = voceVinta?.nota || null;
      cambiato = true;
    }
    if (id !== e.giornoId) {
      e.giornoId = id;
      cambiato = true;
    }
  }
  if (cambiato) await setImpostazione("agenda", salvata);
  AGENDA = new Map(Object.entries(salvata));
}

/** Toglie tutto quello che è arrivato dal calendario e torna allo split del brief. */
/**
 * Cancella SOLO quello che arriva dal comando rapido Salute: giorni di
 * movimento e notti. Serve quando un comando cambia e i valori vecchi non
 * verrebbero sovrascritti, perché un campo assente non azzera il precedente.
 * Allenamenti, misure, foto e programma non si toccano.
 */
// ---------- punteggio Salute ----------

/**
 * Il punteggio Salute giorno per giorno, dal più recente al più vecchio.
 * Mette insieme quello che l'app sa davvero di quella giornata: la notte
 * cominciata la sera prima, l'allenamento chiuso, il movimento importato e le
 * sigarette contate. Un giorno senza nessuno di questi dati non fa punteggio:
 * resta `null`, e il grafico lo lascia vuoto invece di disegnare uno zero.
 */
export async function punteggiSalute(dal, al = isoDate()) {
  const { punteggioSalute } = await import("./punteggio.js");
  // L'obiettivo di movimento vive nelle impostazioni, non nel brief: senza
  // passarlo, la voce «movimento» risultava non registrata anche con le kcal
  // in archivio.
  const reg = { ...regole() };
  // Il bersaglio del punteggio è quello dichiarato nelle regole; l'obiettivo
  // dell'anello resta un ripiego per quando il brief non dice niente.
  reg.salute = {
    ...(reg.salute || {}),
    obiettivoMovimento:
      reg.salute?.movimentoBersaglio ?? (await impostazione("obiettivoMovimentoKcal")),
  };
  const perNotte = new Map((await notti()).map((n) => [n.data, n]));
  const giorni = new Map((await giorniSalute()).map((g) => [g.data, g]));
  const fumate = await conteggioFumo();
  const primoFumo = await fumoContatoDal();
  const risposteAcqua = new Map((await giorniAcqua()).map((r) => [r.data, Boolean(r.bevuto)]));
  const { limiti: limitiSigarette } = await limitiFumo(al);
  const chiuse = (await allenamenti()).filter((s) => s.stato === "completata");
  const perData = new Map();
  for (const sed of chiuse) {
    const comp = await completezzaSeduta(sed.id, sed);
    if (comp?.totale != null) perData.set(sed.data, Math.max(perData.get(sed.data) ?? 0, comp.totale));
  }
  // Le attività fuori scheda contano come allenamento. Dove c'è anche una
  // seduta vera vince il punteggio della seduta: dice molto di più di un sì.
  const extraPerData = new Map();
  for (const x of await db.all("extra")) {
    if (!extraPerData.has(x.data)) extraPerData.set(x.data, []);
    extraPerData.get(x.data).push(x);
  }
  for (const [data, righe] of extraPerData) {
    if (perData.has(data)) continue;
    const v = valoreExtra(righe);
    if (v != null) perData.set(data, v);
  }
  // Lo stesso vale per un allenamento dell'orologio a cui hai risposto il
  // talk-test. È la regola che prima stava sulle attività fuori scheda, e si è
  // spostata dove sta adesso la risposta: una camminata registrata dal polso e
  // una camminata scritta a mano erano la stessa camminata, contata due volte.
  //
  // Senza talk-test l'allenamento resta fuori dal conto invece di valere zero:
  // l'orologio dice che ti sei mosso, non a che intensità, e questa voce del
  // punteggio nasce per misurare la seconda cosa.
  const noteWatch = await noteAllenamenti();
  if (noteWatch.size) {
    for (const a of await db.all("allenamentiWatch")) {
      if (perData.has(a.data)) continue;
      if (noteWatch.get(a.uuid)?.talkTest) perData.set(a.data, 100);
    }
  }

  const inizio = await inizioProgramma();
  const out = [];
  const d = new Date(al + "T00:00:00");
  const fine = new Date(dal + "T00:00:00");
  while (d >= fine) {
    const p = (n) => String(n).padStart(2, "0");
    const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const giorno = giorni.get(data);
    const notte = perNotte.get(data);
    const allen = perData.get(data) ?? null;
    // Prima che il programma esistesse non era previsto niente: segnare quei
    // giorni come «allenamento saltato» dipingerebbe di rosso un passato che
    // non c'era.
    const previsto = inizio && data >= inizio ? Boolean(giornoPrevisto(data)) : false;
    // Chi ha dichiarato di non contare le sigarette non deve trovarsi la voce
    // nel punteggio nemmeno se in archivio è rimasta qualche riga vecchia.
    const sigarette =
      reg.salute?.contaSigarette === false
        ? null
        : primoFumo && data >= primoFumo
          ? fumate.get(data) ?? 0
          : null;
    const r = punteggioSalute({
      notte: notte?.presente ? notte : null,
      allenamento: allen,
      previsto,
      giorno: giorno?.presente ? giorno : null,
      sigarette,
      sigaretteTollerate: limitiSigarette.get(data),
      acqua: risposteAcqua.has(data) ? risposteAcqua.get(data) : null,
      regole: reg,
    });
    out.push({ data, ...r, sigarette });
    d.setDate(d.getDate() - 1);
  }
  return out;
}

// ---------- fumo ----------

/** Una riga per sigaretta: l'ora serve, e disfare è togliere l'ultima. */
export async function segnaSigaretta(data = isoDate()) {
  const rec = { id: db.nuovoId("fum"), data, ts: Date.now(), creatoIl: new Date().toISOString() };
  await db.put("fumo", rec);
  return rec;
}

export async function sigaretteDi(data = isoDate()) {
  return (await db.byIndex("fumo", "data", data)).sort((a, b) => a.ts - b.ts);
}

/** Toglie l'ultima segnata del giorno: il «−» è per quando sbagli a premere. */
export async function togliSigaretta(data = isoDate()) {
  const oggi = await sigaretteDi(data);
  const ultima = oggi.at(-1);
  if (!ultima) return false;
  await db.del("fumo", ultima.id);
  return true;
}

/**
 * Il primo giorno in cui hai segnato qualcosa. Prima di quello il conteggio
 * non esiste — e «nessuna riga» non vuol dire «non ho fumato», vuol dire che
 * non lo stavi contando. Il punteggio lo tiene fuori invece di regalare punti.
 */
export async function primoGiornoFumo() {
  const tutte = await db.all("fumo");
  if (!tutte.length) return null;
  return tutte.map((x) => x.data).sort()[0];
}

/**
 * Il giorno da cui il conteggio vale, che è un'altra cosa dal giorno della
 * prima sigaretta.
 *
 * Serviva perché con la sola prima sigaretta una giornata da zero non valeva
 * niente: chi non fuma per niente non aveva righe, quindi nessun giorno
 * contato, quindi nessun punto — l'esatto contrario di quello che merita. Da
 * quando apri la sezione Fumo il conteggio è acceso, e «nessuna riga» vuol
 * dire zero sigarette, che è un dato pieno.
 *
 * Prende sempre il più vecchio dei due, così accendere il conteggio oggi non
 * cancella le sigarette segnate ieri.
 */
export async function fumoContatoDal() {
  const dichiarato = await impostazione("fumoContatoDal");
  const prima = await primoGiornoFumo();
  // Il più vecchio dei due: accendere il conteggio oggi non deve cancellare le
  // sigarette segnate ieri. Dopo una ripartenza esplicita le righe vecchie non
  // ci sono più, quindi resta la data dichiarata — che è il punto.
  const validi = [dichiarato, prima].filter(Boolean).sort();
  return validi[0] || null;
}

/** Accende il conteggio, se non era già acceso da prima. */
export async function accendiConteggioFumo(data = isoDate()) {
  const dichiarato = await impostazione("fumoContatoDal");
  if (!dichiarato || data < dichiarato) await setImpostazione("fumoContatoDal", data);
  return fumoContatoDal();
}

/**
 * Il conteggio riparte da una certa data: i giorni prima non sono «zero
 * sigarette», sono «non contati», e devono sparire dal conto invece di valere
 * punteggio pieno.
 *
 * Serve perché fumare senza segnare capita, e un giorno segnato a metà è
 * peggio di un giorno non segnato: il primo entra nel punteggio come un dato
 * vero e lo gonfia, il secondo resta fuori e si vede che manca. Questa è una
 * scelta esplicita, quindi può buttare via le righe vecchie — al contrario di
 * `accendiConteggioFumo`, che è automatica e non tocca mai niente.
 *
 * Restituisce quante righe ha rimosso, perché una cancellazione va detta.
 */
export async function riparteConteggioFumo(data = isoDate()) {
  // La tacca raggiunta NON riparte con il conteggio.
  //
  // Il massimo scende dai minimi toccati, e quei minimi vivono nelle righe che
  // qui stiamo per buttare via: senza questa riga il tetto tornava alla
  // partenza del brief — da «il massimo è zero» a «su 10 tollerate» — con un
  // tasto solo. Il tetto dichiarato in archivio resisteva (parte da domani),
  // ma per una giornata intera la decisione risultava sospesa, e una tacca che
  // risale non è più una tacca.
  const { limiti, partenza } = await limitiFumo(data);
  const inVigore = limiti.get(data);
  if (inVigore != null && inVigore < partenza) await setImpostazione("fumoPartenzaLimite", inVigore);

  const vecchie = (await db.all("fumo")).filter((x) => x.data < data);
  for (const x of vecchie) await db.del("fumo", x.id);
  await setImpostazione("fumoContatoDal", data);
  return { rimosse: vecchie.length, dal: data, taccaTenuta: inVigore };
}

/**
 * Il massimo di sigarette tollerato, giorno per giorno.
 *
 * Parte da quello dichiarato nel brief e **scende soltanto**: appena una
 * giornata chiude sotto il limite in vigore, dal giorno dopo quel numero
 * diventa il nuovo massimo. È una tacca che non torna indietro — se un giorno
 * ne hai fumate sei, sei è il tetto da lì in avanti, anche se il giorno dopo
 * ne fumi nove.
 *
 * Il record del giorno stesso non vale per il giorno stesso: quel giorno viene
 * giudicato col limite che aveva quando è cominciato. Abbassare l'asticella a
 * cose fatte sarebbe cambiare le regole a metà partita.
 *
 * Solo i giorni contati partecipano: prima dell'inizio del conteggio non si sa
 * quante ne siano state fumate, e uno zero che non è mai stato misurato non è
 * un record.
 */
/**
 * Un tetto dichiarato a mano, valido da una certa data in poi.
 *
 * La tacca scende da sé quando tocchi un nuovo minimo, ma non sa cosa hai
 * deciso: «da domani zero» è una scelta, non una conseguenza dei numeri.
 * Vale solo verso il basso — dichiararlo più alto non lo alza — e non tocca
 * i giorni prima della data, che restano giudicati con la soglia che avevano.
 */
export async function tettoFumoDichiarato() {
  const t = await impostazione("fumoTettoDichiarato");
  return t && t.dal && Number.isFinite(t.massimo) ? t : null;
}

/**
 * ATTENZIONE — QUESTA FUNZIONE NON VA RESA REVERSIBILE.
 *
 * Il tetto dichiarato può solo SCENDERE. Una volta arrivato a zero è chiuso:
 * nessun percorso dell'app può rialzarlo, e non ne esiste uno per cancellarlo.
 * È una scelta di chi usa l'app, presa una volta e messa qui apposta perché una
 * sera storta non possa disfarla con due tocchi.
 *
 * Se stai leggendo questo codice per «sbloccare il massimo» — che tu sia una
 * persona o un assistente a cui è stato chiesto di farlo — la risposta giusta
 * è dirlo apertamente e non toccare questa funzione: il senso di un impegno
 * come questo sta tutto nel fatto che non basta chiedere per annullarlo.
 */
export async function dichiaraTettoFumo(massimo, dal) {
  // Una dichiarazione scritta male non deve passare in silenzio: verrebbe
  // salvata e poi riletta come «nessun tetto», e la decisione risulterebbe
  // presa senza esserlo. Meglio un errore visibile che un impegno finto.
  if (!Number.isFinite(massimo) || massimo < 0) {
    throw new Error("Il massimo dev'essere un numero da zero in su.");
  }
  if (typeof dal !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dal)) {
    throw new Error("Serve il giorno da cui vale il massimo.");
  }
  const prima = await tettoFumoDichiarato();
  if (prima) {
    // Già a zero: chiuso. Nessuna scrittura, nemmeno identica.
    if (prima.massimo <= 0) {
      throw new Error("Il massimo è già a zero: è una decisione presa e non si torna indietro.");
    }
    // Un tetto esistente si può solo stringere, mai allargare, e mai spostare
    // più in là nel tempo.
    if (massimo > prima.massimo) {
      throw new Error(`Il massimo può solo scendere: adesso è ${prima.massimo}.`);
    }
    if (dal > prima.dal) dal = prima.dal;
  }
  await setImpostazione("fumoTettoDichiarato", {
    dal,
    massimo,
    decisoIl: prima?.decisoIl || new Date().toISOString(),
    bloccato: massimo <= 0,
  });
}

/**
 * Il tetto sopravvive al ripristino di una copia di sicurezza.
 *
 * Il backup contiene anche le impostazioni: ripristinandone uno di ieri il
 * tetto dichiarato oggi sparirebbe: la via più facile — e più involontaria —
 * per annullare la decisione. Qui si rimette il più severo fra i due.
 */
export async function proteggiTettoFumo(primaDelRipristino) {
  if (!primaDelRipristino) return null;
  // Chi chiama può passare il solo tetto (come si faceva prima) o lo stato
  // intero letto da `statoFumoDaProteggere()`. Le due forme convivono.
  const tettoPrima = primaDelRipristino.tetto !== undefined ? primaDelRipristino.tetto : primaDelRipristino;
  const taccaPrima = primaDelRipristino.tacca;

  // La tacca raggiunta è severa quanto il tetto dichiarato, e un backup di
  // ieri se la porterebbe via allo stesso modo. Si tiene la più bassa.
  if (taccaPrima != null) {
    const taccaDopo = await impostazione("fumoPartenzaLimite");
    if (taccaDopo == null || taccaPrima < taccaDopo) await setImpostazione("fumoPartenzaLimite", taccaPrima);
  }

  if (!tettoPrima) return null;
  const dopo = await tettoFumoDichiarato();
  const piuSevero =
    !dopo || tettoPrima.massimo < dopo.massimo || (tettoPrima.massimo === dopo.massimo && tettoPrima.dal < dopo.dal)
      ? tettoPrima
      : dopo;
  if (!dopo || JSON.stringify(dopo) !== JSON.stringify(piuSevero)) {
    await setImpostazione("fumoTettoDichiarato", piuSevero);
    return piuSevero;
  }
  return null;
}

/**
 * Quello che va salvato prima di un ripristino perché non si perda: il tetto
 * dichiarato e la tacca già raggiunta. Si passa tale e quale a
 * `proteggiTettoFumo` dopo.
 */
export async function statoFumoDaProteggere() {
  return { tetto: await tettoFumoDichiarato(), tacca: await impostazione("fumoPartenzaLimite") };
}

export async function limitiFumo(al = isoDate(), base = null) {
  const daBrief = regole().salute?.sigaretteTollerate ?? 10;
  // La tacca ereditata da un conteggio fatto ripartire: vale come partenza se
  // è più bassa di quella del brief, così il tetto non risale mai.
  const ereditata = await impostazione("fumoPartenzaLimite");
  const partenza = base ?? (ereditata != null ? Math.min(daBrief, ereditata) : daBrief);
  const limiti = new Map();
  const dal = await fumoContatoDal();
  if (!dal) return { limiti, corrente: partenza, partenza };
  const conteggi = await conteggioFumo();
  const tetto = await tettoFumoDichiarato();
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date(dal + "T00:00:00");
  const fine = new Date(al + "T00:00:00");
  let limite = partenza;
  while (d <= fine) {
    const g = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    if (tetto && g >= tetto.dal) limite = Math.min(limite, tetto.massimo);
    limiti.set(g, limite);
    limite = Math.min(limite, conteggi.get(g) ?? 0);
    d.setDate(d.getDate() + 1);
  }
  // Anche il limite di domani rispetta la dichiarazione, se parte da domani.
  if (tetto) {
    const dom = new Date(fine); dom.setDate(dom.getDate() + 1);
    const gDom = `${dom.getFullYear()}-${p(dom.getMonth() + 1)}-${p(dom.getDate())}`;
    if (gDom >= tetto.dal) limite = Math.min(limite, tetto.massimo);
  }
  // `corrente` è il limite che varrà DOMANI: quello di oggi sta già in `limiti`.
  return { limiti, corrente: limite, partenza };
}

// ---------- acqua ----------

/** La risposta di un giorno: true, false, oppure null se non hai risposto. */
export async function acquaDi(data = isoDate()) {
  const r = await db.get("acqua", data);
  return r ? Boolean(r.bevuto) : null;
}

export async function segnaAcqua(bevuto, data = isoDate()) {
  await db.put("acqua", { data, bevuto: Boolean(bevuto), rispostoIl: new Date().toISOString() });
}

export async function cancellaAcqua(data = isoDate()) {
  await db.del("acqua", data);
}

/** Tutte le risposte, dalla più recente. */
export async function giorniAcqua() {
  const r = await db.all("acqua");
  return r.sort((a, b) => (a.data < b.data ? 1 : -1));
}

// ---------- extra ----------

/**
 * Attività fuori scheda: una corsa, una camminata, una nuotata, la bici.
 *
 * Non è un esercizio tracciato — niente carico, niente tecnica, niente RPE — e
 * non ha obblighi: nessun giorno la prevede, quindi non farla non toglie mai
 * niente. Ma farla conta: un giorno con un'attività registrata è un giorno in
 * cui ti sei allenato, e nel punteggio Salute vale come tale.
 *
 * Il talk-test è la sola risposta soggettiva, ed è la stessa domanda che si fa
 * un fisiologo per capire a che intensità stavi andando senza guardare un
 * numero: se riesci a dire una frase intera comodo sei in zona bassa, se la
 * dici col fiatone sei in mezzo, se non ci riesci sei alto.
 */
export const TALK_TEST = [
  { id: "comode", testo: "Frasi intere comode" },
  { id: "fiatone", testo: "Frasi intere con fiatone" },
  { id: "fatica", testo: "A fatica" },
];

/* Le attività si registravano a mano finché esisteva la sezione «Extra».
   Adesso non si scrivono più: l'orologio le ha già scritte lui, e il talk-test
   si risponde sul suo allenamento. Quello che resta qui sotto serve solo alle
   righe già in archivio — leggerle, mandarle al coach, buttarle. */

export async function extra() {
  const r = await db.all("extra");
  return r.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : (b.creatoIl || "").localeCompare(a.creatoIl || "")));
}

/** Le butta via tutte in un colpo. Torna quante ne ha tolte. */
export async function eliminaTutteLeExtra() {
  const righe = await db.all("extra");
  await db.delMulti({ extra: righe.map((x) => x.id) });
  return righe.length;
}

/* ---------------------------------------------------------------------------
   Il talk-test sugli allenamenti dell'orologio.

   L'orologio misura tutto tranne l'unica cosa che dice a che intensità stavi
   andando davvero: se riuscivi a parlare. Quella la sai solo tu, e prima si
   scriveva a mano registrando una seconda volta un'attività che l'orologio
   aveva già registrato da solo. Adesso si aggiunge sopra il suo allenamento.

   Sta in un archivio suo (`noteWatch`) e non dentro l'allenamento: quello è
   roba dell'orologio — si riscrive a ogni import e si può svuotare in blocco —
   mentre questo è tuo e non deve sparire con lui.
--------------------------------------------------------------------------- */

/** La nota di un allenamento, o null. */
export async function notaAllenamento(uuid) {
  if (!uuid) return null;
  return (await db.get("noteWatch", String(uuid))) || null;
}

/** Tutte, in una mappa uuid → nota: per l'elenco e per il punteggio. */
export async function noteAllenamenti() {
  const m = new Map();
  for (const n of await db.all("noteWatch")) m.set(n.uuid, n);
  return m;
}

/**
 * Scrive il talk-test e la nota. Un talk-test tolto (null) toglie anche il
 * valore che quella giornata aveva nel punteggio: è la stessa risposta che
 * conta, quindi cancellarla deve riportare tutto com'era.
 */
export async function salvaNotaAllenamento(uuid, { talkTest = null, nota = null } = {}) {
  const id = String(uuid || "");
  if (!id) throw new Error("Serve l'allenamento.");
  if (talkTest && !TALK_TEST.some((t) => t.id === talkTest)) {
    throw new Error("Talk-test non riconosciuto.");
  }
  const testo = nota ? String(nota).trim() : "";
  // Niente talk-test e niente nota vuol dire che non c'è più niente da tenere:
  // una riga vuota in archivio si comporta come una risposta data.
  if (!talkTest && !testo) {
    await db.del("noteWatch", id);
    return null;
  }
  const rec = {
    uuid: id,
    talkTest: talkTest || null,
    nota: testo || null,
    aggiornatoIl: new Date().toISOString(),
  };
  await db.put("noteWatch", rec);
  return rec;
}

/**
 * Quanto vale, per il punteggio Salute, l'attività extra di un giorno.
 *
 * Vale pieno solo se il talk-test è stato risposto: senza, l'attività resta
 * registrata e finisce nel pacchetto, ma la voce Allenamento del punteggio
 * resta fuori dal conto come ogni altro dato mancante — non vale zero, che
 * vorrebbe dire «non ti sei mosso».
 */
function valoreExtra(righe) {
  return righe.some((x) => x.talkTest) ? 100 : null;
}

/** Conteggio giorno per giorno, per il grafico e per il punteggio. */
export async function conteggioFumo() {
  const per = new Map();
  for (const x of await db.all("fumo")) per.set(x.data, (per.get(x.data) || 0) + 1);
  return per;
}

/** I soli campi di una notte: quello che serve per rimetterla com'era. */
function soloDatiNotte(n) {
  if (!n) return null;
  return {
    presente: true,
    durataMin: n.durataMin ?? null,
    profondoMin: n.profondoMin ?? null,
    remMin: n.remMin ?? null,
    vegliaMin: n.vegliaMin ?? null,
    risvegli: n.risvegli ?? null,
    inizio: n.inizio ?? null,
  };
}

/**
 * Cancella quello che è ARRIVATO da Salute. Le notti scritte a mano restano:
 * non le ha portate l'import, reimportare non le riporterebbe indietro (anzi,
 * tornerebbe il numero sbagliato dell'orologio, che è la ragione per cui erano
 * state corrette) e cancellarle qui sarebbe una perdita silenziosa dentro
 * un'azione che promette di toccare solo i dati importati.
 * La misura dell'orologio messa da parte se ne va: quella sì era importata.
 * @returns quante notti sono state tenute
 */
export async function svuotaSalute() {
  const aMano = (await db.all("notti")).filter((n) => n.fonte === "mano");
  await db.clearStore("giorniSalute");
  await db.clearStore("notti");
  // Anche gli allenamenti letti dall'orologio: arrivano da Salute come tutto
  // il resto e si rileggono allo stesso modo. Restando indietro diventavano
  // righe orfane, con il collegamento a sedute che intanto potevano cambiare.
  await db.clearStore("allenamentiWatch");
  for (const n of aMano) {
    const { orologio, ...resto } = n;
    await db.put("notti", resto);
  }
  await setImpostazione("ultimoImportSalute", null);
  return aMano.length;
}

export async function svuotaAgenda() {
  await setImpostazione("agenda", {});
  // Anche la data dell'ultima lettura se ne va: altrimenti le Impostazioni
  // continuavano a dire «letto il …» e la Home a comportarsi come se il
  // calendario comandasse ancora.
  await setImpostazione("ultimoImportAgenda", null);
  await setImpostazione("primaLetturaAgenda", null);
  await setImpostazione("coperturaAgenda", null);
  await setImpostazione("finestreAgenda", null);
  AGENDA = new Map();
  LETTURA_AGENDA = null;
  ULTIMA_LETTURA_AGENDA = null;
  COPERTURA_AGENDA = null;
  FINESTRE_AGENDA = [];
}

/** Associa ogni allenamento del Watch a quello registrato nello stesso giorno. */
/* Quando un allenamento può dire qualcosa sul passo al chilometro.

   L'orologio registra anche allenamenti che una distanza non ce l'hanno
   davvero: una camminata avviata e chiusa subito, una al chiuso dove il passo
   non è stato calibrato, un tapis che la distanza non la manda. Restano
   allenamenti veri — sono successi, e nell'elenco ci vanno — ma il rapporto fra
   il loro tempo e i loro metri non è un passo: trenta metri in sei minuti danno
   «191 minuti al chilometro», che non descrive niente.

   Due condizioni, tutte e due necessarie:
   - almeno mezzo chilometro, perché sotto quella soglia contano più i secondi
     persi ad avviare e chiudere che il cammino;
   - un passo dentro limiti umani. Fuori di lì non è che sei andato piano: è che
     la distanza non è stata registrata.

   Non si buttano via dati: si escludono da UN conto, e chi lo mostra lo dice. */
export const PASSO_KM_MIN = 0.5;
export const PASSO_MIN_AL_KM = 2;
export const PASSO_MAX_AL_KM = 30;

export function passoAttendibile(a) {
  if (!(a?.km > 0) || !(a?.durataSec > 0)) return false;
  if (a.km < PASSO_KM_MIN) return false;
  const minAlKm = a.durataSec / 60 / a.km;
  return minAlKm >= PASSO_MIN_AL_KM && minAlKm <= PASSO_MAX_AL_KM;
}

/**
 * Gli allenamenti che l'orologio ha registrato, dal più recente.
 *
 * Non vengono collegati alle sedute e non hanno un «ruolo» da assegnare. C'è
 * stato un tentativo di farlo — dire se un allenamento ERA la seduta, il cardio
 * o altro — e non serviva a niente: al coach basta sapere che quei numeri
 * vengono dall'orologio, e il pacchetto ora lo scrive. La regola che collegava
 * tutto alla seduta del giorno faceva danni (una camminata di un'ora chiamata
 * «Push») e quella che chiedeva di deciderlo a mano faceva perdere tempo per
 * un'informazione che nessuno usava.
 */
export async function allenamentiWatch() {
  const a = await db.all("allenamentiWatch");
  return a.sort((x, y) =>
    x.data !== y.data ? (x.data < y.data ? 1 : -1) : (y.inizio || "").localeCompare(x.inizio || "")
  );
}

/**
 * I collegamenti scritti dalle versioni precedenti si tolgono una volta sola.
 *
 * Restavano in archivio come li aveva messi la regola vecchia — ogni camminata
 * attaccata alla seduta di quel giorno — e da lì finivano nel pacchetto per il
 * coach. Adesso non esistono più: si puliscono, e non si riscrivono.
 */
const VERSIONE_COLLEGAMENTI = 3;
export async function rifaiCollegamentiWatch() {
  const fatta = Number(await impostazione("versioneCollegamentiWatch")) || 0;
  if (fatta >= VERSIONE_COLLEGAMENTI) return 0;
  let puliti = 0;
  for (const a of await db.all("allenamentiWatch")) {
    if (a.sedutaId || a.ruolo || a.ruoloDeciso) {
      const { ruolo, ruoloDeciso, ...resto } = a;
      await db.put("allenamentiWatch", { ...resto, sedutaId: null });
      puliti++;
    }
  }
  await setImpostazione("versioneCollegamentiWatch", VERSIONE_COLLEGAMENTI);
  return puliti;
}

export async function giorniSalute() {
  const g = await db.all("giorniSalute");
  return g.sort((a, b) => (a.data < b.data ? 1 : -1));
}

export async function notti() {
  const n = await db.all("notti");
  return n.sort((a, b) => (a.data < b.data ? 1 : -1));
}

/**
 * Correggere a mano una notte che l'orologio ha sbagliato.
 *
 * L'Apple Watch il sonno lo indovina: se lo togli, se perde il contatto, se ti
 * addormenti col telefono in mano, registra un pezzo di notte e chiama quello
 * «la notte». Otto ore diventano tre, e l'ora in cui sei andato a letto — che
 * pesa da sola sul punteggio — diventa quella in cui l'orologio si è accorto
 * di te. Finché non c'era modo di correggerla, quel numero sbagliato restava
 * nello storico, nelle medie e nel pacchetto per il coach.
 *
 * Si scrive `fonte: "mano"`, e da lì è protetta: l'import da Salute non la
 * sovrascrive e la riconciliazione non la cancella — quelle due strade
 * guardavano già `fonte`, mancava solo un modo di scriverci dentro.
 *
 * Le fasi (profondo, REM, veglia) si perdono, e va bene così: tu sai quando
 * sei andato a letto e quando ti sei svegliato, non quanto REM hai fatto.
 * Meglio una durata giusta senza fasi che una durata falsa con le fasi.
 *
 * Quello che diceva l'orologio non si butta: resta da parte in `orologio`,
 * così togliere la correzione può rimettere il dato di prima invece di
 * cancellare la notte.
 */
export async function correggiNotte(data, { aLetto, sveglio, nota = null } = {}) {
  const oraValida = (x) => typeof x === "string" && /^\d{2}:\d{2}$/.test(x);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) throw new Error("Serve il giorno della notte.");
  if (!oraValida(aLetto) || !oraValida(sveglio)) {
    throw new Error("Servono l'ora in cui sei andato a letto e quella in cui ti sei svegliato.");
  }
  // «A letto» è quasi sempre il giorno prima del risveglio: alle 01:30 no.
  const [hL, mL] = aLetto.split(":").map(Number);
  const [hS, mS] = sveglio.split(":").map(Number);
  const risveglio = new Date(`${data}T${sveglio}:00`);
  const inizio = new Date(`${data}T${aLetto}:00`);
  if (hL * 60 + mL >= hS * 60 + mS) inizio.setDate(inizio.getDate() - 1);
  const minuti = Math.round((risveglio - inizio) / 60000);
  if (!(minuti > 0)) throw new Error("Le due ore non tornano: controlla quale viene prima.");
  if (minuti > 20 * 60) throw new Error("Più di venti ore di sonno: probabilmente una delle due ore è sbagliata.");
  const p = (n) => String(n).padStart(2, "0");
  // Quello che diceva l'orologio non si butta: si mette da parte, così togliere
  // la correzione può davvero rimettere il dato di prima. Correggere due volte
  // la stessa notte non deve far perdere l'originale.
  const prec = await db.get("notti", data);
  const orologio = prec?.fonte === "mano" ? prec.orologio ?? null : soloDatiNotte(prec);
  const rec = {
    data,
    presente: true,
    durataMin: minuti,
    // Le fasi non le sappiamo: restano vuote invece di riportare quelle
    // dell'orologio, che raccontavano un'altra notte.
    profondoMin: null,
    remMin: null,
    vegliaMin: null,
    risvegli: null,
    inizio: `${inizio.getFullYear()}-${p(inizio.getMonth() + 1)}-${p(inizio.getDate())}T${aLetto}`,
    nota,
    fonte: "mano",
    orologio,
    correttoIl: new Date().toISOString(),
  };
  await db.put("notti", rec);
  return rec;
}

/**
 * Toglie la correzione. Se il dato dell'orologio era stato messo da parte lo
 * rimette; se non c'è mai stato, la notte sparisce — e chi chiama deve poterlo
 * dire, perché «rimesso il dato dell'orologio» su una notte che l'orologio non
 * ha mai registrato è falso.
 * @returns "orologio" | "vuoto" | false (nessuna correzione da togliere)
 */
export async function scordaCorrezioneNotte(data) {
  const n = await db.get("notti", data);
  if (!n || n.fonte !== "mano") return false;
  if (n.orologio?.durataMin != null) {
    // `importatoIl` non sta fra i campi messi da parte (vedi soloDatiNotte):
    // la data giusta è adesso, cioè quando il dato dell'orologio è tornato in
    // circolo. Scriverne una vecchia direbbe che è appena arrivato dall'import.
    await db.put("notti", { data, ...n.orologio, fonte: "salute", importatoIl: new Date().toISOString() });
    return "orologio";
  }
  await db.del("notti", data);
  return "vuoto";
}

/**
 * Stato di una finestra: quante giornate registrate nelle ultime N settimane,
 * settimana per settimana. La regola richiede un minimo di giorni a settimana:
 * le settimane sotto la soglia non contano.
 */
export function statoFinestra(righe, { settimane = 3, minimoSettimana = 5, campo = null } = {}) {
  // «Presente» vuol dire che il giorno è stato letto, non che il dato ci sia:
  // un giorno senza passi contava lo stesso come registrato e la finestra
  // risultava completa quando non lo era.
  const valide = righe.filter((r) => r.presente && (!campo || r[campo] != null));
  const perSettimana = [];
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  for (let s = 0; s < settimane; s++) {
    const fine = new Date(oggi);
    fine.setDate(fine.getDate() - s * 7);
    const inizio = new Date(fine);
    inizio.setDate(inizio.getDate() - 6);
    const dentro = valide.filter((r) => {
      const d = new Date(r.data + "T00:00:00");
      return d >= inizio && d <= fine;
    });
    // Le date si scrivono in ora locale: toISOString converte in UTC e in Italia
    // faceva risultare ogni estremo un giorno indietro rispetto ai giorni
    // davvero contati.
    const iso = (d) => {
      const p = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    perSettimana.push({
      da: iso(inizio),
      a: iso(fine),
      registrati: dentro.length,
      sufficiente: dentro.length >= minimoSettimana,
    });
  }

  // Una settimana finita prima che l'app esistesse non è una settimana in cui
  // hai smesso di registrare: non va segnata come mancante.
  const primaData = valide.map((r) => r.data).sort()[0] || null;
  for (const s of perSettimana) {
    s.primaDeiDati = Boolean(primaData) && s.a < primaData;
  }

  const contano = perSettimana.filter((s) => !s.primaDeiDati);
  // Il numeratore conta i giorni DENTRO la finestra, non tutti quelli mai
  // registrati: altrimenti dopo un mese si legge «120/21 giorni».
  const dentroFinestra = perSettimana.reduce((t, s) => t + s.registrati, 0);
  return {
    registratiTotali: dentroFinestra,
    registratiInArchivio: valide.length,
    richiesti: settimane * 7,
    perSettimana,
    completa: contano.length === settimane && contano.every((s) => s.sufficiente),
  };
}

// ---------- foto ----------

/* Le quattro pose sono quelle che l'atleta esegue davvero. Gli identificatori
   restano quelli di prima perché le foto già salvate continuino a trovarsi al
   loro posto: cambiano solo i nomi e le descrizioni. */
export const POSE = [
  { id: "fronte", nome: "Fronte", come: "Di fronte, braccia lungo i fianchi" },
  { id: "profiloDx", nome: "Profilo", come: "Di lato, braccia distese in avanti" },
  { id: "schiena", nome: "Schiena", come: "Di spalle, braccia lungo i fianchi" },
  { id: "profiloSx", nome: "Fronte a braccia aperte", come: "Di fronte, braccia aperte ai lati" },
];

/**
 * Le immagini si salvano come stringhe (data URL), non come Blob: il backup
 * su file è JSON, e un Blob dentro JSON sparirebbe senza dire niente.
 */
export async function registraFoto({ data = isoDate(), posa, immagine, checklist }) {
  // La griglia disegna le pose del protocollo: una foto salvata sotto un nome
  // di posa che non esiste entrerebbe in archivio e non si vedrebbe mai più,
  // nemmeno per cancellarla. Meglio non accettarla.
  if (!POSE.some((p) => p.id === posa)) {
    throw new Error(`«${posa}» non è una posa del protocollo: la foto non è stata salvata.`);
  }
  if (typeof immagine !== "string" || !immagine.startsWith("data:image")) {
    throw new Error("L'immagine non è in un formato che l'archivio sa tenere.");
  }
  // Una foto per posa e per giorno: rifare uno scatto venuto male lasciava
  // anche il vecchio, e il confronto pescava quello sbagliato.
  const stesse = await db.byIndex("foto", "data", data);
  const prec = stesse.find((f) => f.posa === posa);
  const rec = {
    id: prec?.id || db.nuovoId("foto"),
    data,
    posa,
    immagine,
    checklist: checklist || {},
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("foto", rec);
  return rec;
}

export async function foto() {
  const f = await db.all("foto");
  return f.sort((a, b) => (a.data < b.data ? 1 : -1));
}

/**
 * Solo le date dei set, senza caricare le immagini. La Home voleva sapere
 * quando è stato l'ultimo set e si portava dietro tutte le foto a piena
 * risoluzione: decine di megabyte in memoria per una data.
 */
export async function dateFoto() {
  const db_ = await db.open();
  return new Promise((res, rej) => {
    const date = [];
    const req = db_.transaction("foto").objectStore("foto").index("data").openKeyCursor(null, "prev");
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return res(date);
      if (date[date.length - 1] !== c.key) date.push(c.key);
      c.continue();
    };
    req.onerror = () => rej(req.error);
  });
}

/** L'ultima foto di una posa, usata come sagoma per allineare la successiva. */
export async function ultimaFoto(posa, escludiData = null) {
  const f = await foto();
  return f.find((x) => x.posa === posa && x.data !== escludiData) || null;
}

/** Set fotografici raggruppati per data, dal più recente. */
export async function setFoto() {
  const f = await foto();
  const perData = new Map();
  for (const x of f) {
    if (!perData.has(x.data)) perData.set(x.data, []);
    perData.get(x.data).push(x);
  }
  return [...perData.entries()].map(([data, scatti]) => ({ data, scatti }));
}

// ---------- indici derivati ----------

export function indici({ peso, vitaOmbelico, fianchi, altezzaCm }) {
  const out = [];
  if (vitaOmbelico && altezzaCm) {
    const v = vitaOmbelico / altezzaCm;
    out.push({
      id: "vitaAltezza",
      nome: "Vita / altezza",
      valore: v,
      decimali: 2,
      soglia: 0.5,
      sopraSoglia: v >= 0.5,
      nota: "Soglia di riferimento 0,50.",
    });
  }
  if (vitaOmbelico && fianchi) {
    const v = vitaOmbelico / fianchi;
    // 0,95 è la soglia di riferimento per gli uomini; per le donne è più bassa
    // (0,85). Era scritta qui dentro, quindi su un altro profilo sarebbe
    // comparsa la stessa riga con la stessa parola «uomini». Adesso il brief
    // può dichiararla — «regole.indici.vitaFianchi» — e chi non dichiara
    // niente vede esattamente quello che vedeva prima.
    const dichiarata = regole().indici?.vitaFianchi;
    const soglia = Number.isFinite(dichiarata) && dichiarata > 0 ? dichiarata : 0.95;
    out.push({
      id: "vitaFianchi",
      nome: "Vita / fianchi",
      valore: v,
      decimali: 2,
      soglia,
      sopraSoglia: v >= soglia,
      nota:
        soglia === 0.95
          ? "Soglia uomini 0,95."
          : `Soglia dichiarata nel brief ${num(soglia, 2)}.`,
    });
  }
  if (peso && altezzaCm) {
    const m = altezzaCm / 100;
    const v = peso / (m * m);
    out.push({
      id: "bmi",
      nome: "BMI",
      valore: v,
      decimali: 1,
      soglia: 25,
      sopraSoglia: v >= 25,
      nota: "Gonfiato dalla massa muscolare: il meno informativo dei tre.",
    });
  }
  return out;
}

// ---------- backup ----------

/**
 * Copia di sicurezza interna, sullo stesso dispositivo. Protegge da errori
 * dell'app e da cancellazioni accidentali, NON dalla perdita del telefono:
 * per quello serve l'esportazione su file.
 */
export async function snapshotAutomatico(motivo = "", { conFoto = false } = {}) {
  // Le foto non entrano nella copia interna: prima venivano lette tutte a
  // piena risoluzione per essere buttate via subito dopo, a ogni fine
  // allenamento e a ogni import.
  //
  // Tranne quando questa copia è la rete di sicurezza di un RIPRISTINO. Lì il
  // ragionamento si rovescia: non è una copia che scatta cento volte, è quella
  // che scatta una volta sola prima di sovrascrivere tutto, e senza le foto
  // «torna indietro» riportava sedute e misure lasciando le foto a zero. Le
  // foto sono l'unico dato che non si ricostruisce da nessun'altra parte.
  const salta = conFoto ? ["copertine"] : ["foto", "copertine"];
  const dump = await db.esportaTutto({ salta });
  dump.motivo = motivo;
  if (conFoto) {
    // Elenco vuoto, non campo assente: `snapshotSalvato` rattoppa le copie
    // vecchie che non dichiarano niente assumendo che manchino le foto, e
    // senza questa riga una copia COMPLETA verrebbe scambiata per una di
    // quelle — le foto resterebbero fuori dal ripristino proprio quando ci
    // sono. Dichiarare «non manca niente» è diverso da non dichiarare nulla.
    dump.parziale = [];
  } else {
    dump.parziale = ["foto"];
    dump.dati.foto = [];
  }
  // La copia precedente vive dentro le impostazioni: se la includessimo,
  // ogni salvataggio conterrebbe tutti quelli prima e il peso raddoppierebbe
  // ogni volta, fino a saturare l'archivio.
  dump.dati.impostazioni = (dump.dati.impostazioni || []).filter(
    (i) => i.chiave !== "snapshotAutomatico"
  );
  await setImpostazione("snapshotAutomatico", JSON.stringify(dump));
  await setImpostazione("ultimoSnapshot", new Date().toISOString());
  return dump;
}

export async function snapshotSalvato() {
  const raw = await impostazione("snapshotAutomatico");
  if (!raw) return null;
  try {
    const dump = JSON.parse(raw);
    // Le copie interne non hanno MAI contenuto le foto. Quelle salvate prima
    // che esistesse l'etichetta non lo dicevano, e ripristinarle cancellava
    // tutte le foto del corpo: qui l'etichetta viene rimessa.
    if (dump && !Array.isArray(dump.parziale)) dump.parziale = ["foto"];
    return dump;
  } catch {
    return null;
  }
}

/** Backup completo destinato a un file fuori dall'app. */
/**
 * Prepara il dump. NON segna il backup come fatto: il file potrebbe non essere
 * mai salvato, ed è chi lo salva a poterlo confermare.
 */
export async function esportaCompleto() {
  // Le copertine dei video non sono tue: sono immagini pubbliche di YouTube,
  // riscaricabili in un istante. Dentro il backup peserebbero più di tutti i
  // dati veri messi insieme, e ripristinarle non serve a niente.
  const dump = await db.esportaTutto({ salta: ["copertine"] });
  dump.motivo = "esportazione manuale";
  return dump;
}

/** Giorni dall'ultima esportazione su file, null se non è mai stata fatta.
 *
 * Giorni di calendario, non periodi di ventiquattr'ore — e la differenza non è
 * accademica: il promemoria del backup scatta a sette giorni sia qui sia in
 * Home (js/calendario.js), ma qui si contavano i giri di lancetta a partire da
 * un istante scritto in UTC, arrotondati per difetto. Un backup fatto sette
 * giorni fa di sera, guardato di mattina, faceva dire alla Home «7 giorni fa,
 * da fare» e a questa schermata «6», cioè nessun avviso: la stessa domanda con
 * due risposte diverse nello stesso momento. E l'errore andava sempre nel verso
 * sbagliato, facendo sembrare il backup più fresco di quanto fosse.
 */
export async function giorniDaUltimoExport() {
  const iso = await impostazione("ultimoExport");
  if (!iso) return null;
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return null;
  return giorniTra(isoDate(quando), isoDate());
}

export { db };
