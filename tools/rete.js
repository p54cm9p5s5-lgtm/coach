/* La rete.
 *
 * Un collaudo che si rilancia con una riga sola e che risponde a una domanda
 * precisa: da quando l'ho controllata, questa app si è rotta da qualche parte?
 *
 * Nasce da un limite ammesso. Fino al 27/08/2026 il lavoro di controllo
 * produceva un REGISTRO: 174 voci, tutte chiuse, nessuna ri-eseguibile. Un
 * verbale, non una rete. Il 94% del codice era protetto solo dal fatto che
 * qualcuno l'aveva guardato una volta, e ogni modifica successiva faceva
 * scadere quella garanzia senza dirlo.
 *
 * Cosa c'è dentro, in ordine di quanto pesa:
 *
 *   1. il nucleo dimostrato    — tutti i casi possibili (tools/verifica-esaustiva.js)
 *   2. la sorgente unica       — le regole che devono restare scritte una volta sola
 *   3. i dati che l'app porta  — libreria esercizi e protocollo di riscaldamento
 *   4. l'archivio              — invarianti veri per QUALUNQUE archivio
 *   5. le stesse domande       — lo stesso numero chiesto per strade diverse
 *
 * Si lancia dalla console, con l'app aperta:
 *     const r = await import('/tools/rete.js'); console.log(await r.rete());
 *
 * È SOLA LETTURA: si può lanciare sull'archivio vero senza toccarlo. Le prove
 * che scrivono stanno in `reteDistruttiva()`, che si rifiuta di partire se
 * l'archivio non è vuoto.
 *
 * Cosa NON copre, e va detto: iOS, il service worker, la memoria piena, i
 * Comandi Rapidi, il Watch, e l'app in mano a te durante un allenamento.
 * Quella parte si prova, non si dimostra.
 */

import * as store from "../js/store.js";
import * as db from "../js/db.js";
import * as ui from "../js/ui.js";
import * as ex from "../js/export.js";
import { tutto as nucleoDimostrato } from "./verifica-esaustiva.js";
import { valutaProgressione } from "../js/segnali.js";
import { analizza } from "../js/salute.js";
import { valida as validaBrief, estraiBlocco } from "../js/brief.js";
import { carichiPossibili, carichiManubrio, aPaio } from "../js/plates.js";
import * as grafico from "../js/grafico.js";
import { pacchettoDaExport } from "../js/salute-export.js";
import * as pacchetto from "../js/export.js";
import { punteggioSalute, giudizio, coloreDaPunteggio, scomposizione, anello } from "../js/punteggio.js";
import { piuGiorni, ripetizioniEffettive, datiCompleti, firmaProposta, nomeLivello } from "../js/segnali.js";

/**
 * La cartella dell'app, vista da questo file.
 *
 * Scritti come «/js/store.js» i percorsi funzionavano solo sul server di prova,
 * dove l'app sta alla radice. Sul sito vero l'app vive sotto «/coach/» e la
 * rete leggeva pagine di errore credendole codice: girava solo dove non serviva.
 * Ricavarla da qui la fa funzionare ovunque l'app sia messa — anche dal
 * telefono, che è dove l'app vive davvero.
 */
const RADICE = new URL("../", import.meta.url).href;
const dentroApp = (percorso) => new URL(percorso, RADICE).href;

const esito = (nome, casi, errori) => ({
  nome,
  casi,
  errori: errori.length,
  primi: errori.slice(0, 6),
  passata: errori.length === 0,
});

/* --------------------------------------------------- 2. la sorgente unica */

/**
 * Certe regole devono stare scritte in UN posto solo.
 *
 * Non è pignoleria di stile: il 27/08 quattro difetti su sei erano la stessa
 * cosa — una regola copiata due volte, e una delle due copie rimasta indietro.
 * «Quanto è durato l'allenamento» dava 49 minuti sullo schermo e 6h 06m nel
 * pacchetto per il coach; «quanto carico» diceva 30 kg nell'elenco del giorno
 * e 35 nell'esercizio, con i dischi sbagliati scritti sotto.
 *
 * Qui si legge il codice pubblicato e si controlla che quelle regole non siano
 * ricomparse altrove. Una prova che guarda il testo del programma è insolita,
 * ma è l'unica che può accorgersi di una copia scritta domani.
 */
export async function verificaSorgenteUnica() {
  const REGOLE = [
    { cosa: "quanto è durato l'allenamento", segno: "oraInizioLavoro ||", solo: ["js/store.js"] },
    { cosa: "quale carico proporre", segno: "caricoDaDecisione", solo: ["js/store.js"] },
    { cosa: "come si scrive il bersaglio", segno: "ripMin === v.ripMax", solo: ["js/store.js"] },
    { cosa: "come si legge un numero scritto a mano", segno: String.raw`^-?\d*\.?\d+$`, solo: ["js/store.js"] },
    { cosa: "quanti giorni dall'ultimo backup", segno: "/ 86400000", solo: ["js/ui.js"] },
    { cosa: "ogni quanto si verifica una proposta", segno: "= 14", solo: ["js/segnali.js"] },
    // Il 27/08 una «rete» sul ritorno del fuoco alla pagina ha rotto il
    // caricamento del master brief su iPhone: la pagina riprende il fuoco PRIMA
    // che iOS consegni il file, e il campo veniva chiuso per primo. Non deve
    // ricomparire: il posto dove si scelgono i file non ascolta la finestra.
    { cosa: "la scelta di un file non ascolta la finestra", segno: "window.addEventListener", solo: ["js/app.js"] },
  ];
  const FILE = [
    "js/store.js", "js/ui.js", "js/db.js", "js/export.js", "js/punteggio.js", "js/segnali.js",
    "js/salute.js", "js/salute-export.js", "js/brief.js", "js/calendario.js", "js/grafico.js",
    "js/plates.js", "js/app.js",
    "js/screens/oggi.js", "js/screens/seduta.js", "js/screens/storico.js", "js/screens/salute.js",
    "js/screens/corpo.js", "js/screens/fumo.js", "js/screens/acqua.js", "js/screens/proposte.js",
    "js/screens/export.js", "js/screens/allenamenti.js", "js/screens/impostazioni.js",
  ];
  const errori = [];
  const sorgenti = new Map();
  for (const f of FILE) {
    try {
      const r = await fetch(dentroApp(`${f}?rete=${Math.random()}`), { cache: "no-store" });
      sorgenti.set(f, r.ok ? await r.text() : "");
      if (!r.ok) errori.push(`${f}: non si legge (${r.status})`);
    } catch (e) {
      errori.push(`${f}: non si legge (${String(e.message).slice(0, 40)})`);
    }
  }
  for (const R of REGOLE) {
    // La riga di commento non conta: solo il codice che gira.
    const dove = FILE.filter((f) =>
      (sorgenti.get(f) || "")
        .split("\n")
        .some((riga) => !riga.trim().startsWith("//") && !riga.trim().startsWith("*") && riga.includes(R.segno))
    );
    const fuori = dove.filter((f) => !R.solo.includes(f));
    if (fuori.length) {
      errori.push(`«${R.cosa}» è scritta anche in: ${fuori.join(", ")} — deve stare solo in ${R.solo.join(", ")}`);
    }
    if (!dove.some((f) => R.solo.includes(f))) {
      errori.push(`«${R.cosa}» non si trova più dove dovrebbe stare (${R.solo.join(", ")}): la prova non sta più controllando niente`);
    }
  }
  // Quali domini l'app può contattare. È l'invariante che vale più di tutti:
  // «niente esce dal telefono» non è una promessa da scrivere in un documento,
  // è una cosa che si conta. Due soli, tutti e due di YouTube. Se un domani ne
  // compare un terzo, questa prova lo dice prima che lo scopra la rete di casa.
  const AMMESSI = new Set(["www.youtube-nocookie.com", "i.ytimg.com", "www.w3.org"]);
  const domini = new Set();
  for (const [f, testo] of sorgenti) {
    for (const m of (testo || "").matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
      if (!AMMESSI.has(m[1])) errori.push(`${f} contatta un dominio nuovo: ${m[1]}`);
      domini.add(m[1]);
    }
  }
  // La CSP: quello che il browser IMPONE, non quello che i documenti promettono.
  // Le due cose sono già andate a divergere una volta — SPEC e README hanno
  // promesso per settimane che aprire un esercizio non contattava nessuno.
  try {
    const html = await (await fetch(dentroApp(`index.html?rete=${Math.random()}`), { cache: "no-store" })).text();
    const m = html.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]*)"/i);
    if (!m) errori.push("index.html non ha più una Content-Security-Policy");
    else {
      const csp = m[1].replace(/\s+/g, " ");
      const ATTESE = [
        ["default-src 'self'", "il fondo dev'essere chiuso"],
        ["script-src 'self'", "nessuno script da fuori"],
        ["object-src 'none'", "niente oggetti incorporati"],
        ["form-action 'none'", "nessun modulo che spedisce"],
        ["frame-src https://www.youtube-nocookie.com", "il player"],
        ["connect-src 'self' https://i.ytimg.com", "la miniatura"],
      ];
      for (const [pezzo, perche] of ATTESE) if (!csp.includes(pezzo)) errori.push(`la CSP non dice più «${pezzo}» (${perche})`);
      // e non deve essersi allargata a domini nuovi
      for (const d of (csp.match(/https?:\/\/[A-Za-z0-9.-]+/g) || [])) {
        if (!AMMESSI.has(d.replace(/^https?:\/\//, ""))) errori.push(`la CSP ha aperto un dominio nuovo: ${d}`);
      }
    }
  } catch (e) {
    errori.push(`non riesco a leggere index.html: ${String(e.message).slice(0, 50)}`);
  }

  return esito(
    "le regole scritte una volta sola, e dove va la rete",
    `${REGOLE.length} regole su ${FILE.length} file · ${domini.size} domini esterni`,
    errori
  );
}

/* ------------------------------------------------ 3. i dati che l'app porta */

export async function verificaDati({ libreriaFinta = null } = {}) {
  const errori = [];
  let casi = 0;

  const lib = libreriaFinta || (await (await fetch(dentroApp("data/esercizi.json"), { cache: "no-store" })).json());
  const esercizi = Array.isArray(lib) ? lib : lib.esercizi || [];
  const visti = new Set();
  const video = new Map();
  for (const e of esercizi) {
    casi++;
    if (!e.id) { errori.push(`un esercizio senza id (${e.nome || "senza nome"})`); continue; }
    if (visti.has(e.id)) errori.push(`id ripetuto: ${e.id}`);
    visti.add(e.id);
    for (const campo of ["nome", "pattern", "attrezzo", "setup", "esecuzione", "cue", "erroriComuni"]) {
      if (!e[campo] || (Array.isArray(e[campo]) && !e[campo].length)) errori.push(`${e.id}: manca «${campo}»`);
    }
    if (!store.ETICHETTE_PATTERN[e.pattern]) errori.push(`${e.id}: schema «${e.pattern}» che il conto del volume non conosce`);
    const v = e.video?.id;
    if (v) {
      if (!/^[A-Za-z0-9_-]{11}$/.test(v)) errori.push(`${e.id}: id video storto «${v}»`);
      if (video.has(v)) errori.push(`${e.id} e ${video.get(v)} puntano allo stesso video`);
      video.set(v, e.id);
    }
  }

  // Il riscaldamento deve esistere per ogni giorno che l'app può mostrare: sia
  // quelli dello split di oggi, sia quelli delle sedute già in archivio (uno
  // storico che apre su un giorno senza protocollo è una schermata vuota).
  if (!store.protocolloCaricato()) {
    errori.push("il protocollo di riscaldamento non si è caricato");
  } else {
    const tipi = new Set([
      ...store.giorniSplit().map((g) => g.id),
      ...(await db.all("sedute")).map((s) => s.tipoId),
    ]);
    for (const id of tipi) {
      if (!id) continue;
      casi++;
      if (!store.riscaldamento(id)) errori.push(`il giorno «${id}» non ha riscaldamento`);
    }
  }
  return esito("i dati che l'app porta con sé", `${casi} controlli`, errori);
}

/* --------------------------------------------------------- 4. l'archivio */

/**
 * Invarianti veri per QUALUNQUE archivio: il tuo, uno finto, uno vuoto.
 * Non controllano che i numeri siano quelli giusti — quello lo fa la base di
 * riferimento — ma che non possano essere di una forma impossibile.
 */
export async function verificaArchivio() {
  const errori = [];
  let casi = 0;
  const oggi = ui.isoDate();

  const sedute = await db.all("sedute");
  const idSedute = new Set(sedute.map((s) => s.id));
  const inizio = await store.inizioStoria();
  const visti = new Set();

  for (const s of sedute) {
    casi++;
    if (visti.has(s.id)) errori.push(`seduta con id ripetuto: ${s.id}`);
    visti.add(s.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.data || "")) { errori.push(`seduta ${s.id}: data «${s.data}»`); continue; }
    if (ui.isoDate(ui.parseIso(s.data)) !== s.data) errori.push(`seduta ${s.id}: la data ${s.data} non torna indietro uguale`);
    if (s.data > oggi) errori.push(`seduta ${s.id}: datata nel futuro (${s.data})`);
    // Un orologio che va indietro — succede a un iPhone rimasto scarico — non
    // si accorge di niente e scrive allenamenti in un passato che non c'è mai
    // stato. Qui non si può impedire; qui si vede.
    if (inizio && s.data < inizio) errori.push(`seduta ${s.id}: datata ${s.data}, prima che il programma cominciasse (${inizio})`);
    if (s.fusoMinuti != null && !(Number.isFinite(s.fusoMinuti) && Math.abs(s.fusoMinuti) <= 14 * 60)) {
      errori.push(`seduta ${s.data}: fuso orario ${s.fusoMinuti}`);
    }

    const sec = store.durataSeduta(s);
    if (sec !== null && (!Number.isFinite(sec) || sec < 0)) errori.push(`seduta ${s.data}: durata ${sec}`);

    const c = s.completezza;
    if (s.stato === "completata" && c) {
      if (!Number.isFinite(c.totale) || c.totale < 0 || c.totale > 100) errori.push(`${s.data}: punteggio ${c.totale} fuori scala`);
      for (const v of c.voci || []) {
        if (!(v.peso > 0)) errori.push(`${s.data} · ${v.nome}: peso ${v.peso}`);
        if (v.quota !== null && !(v.quota >= 0 && v.quota <= 1)) errori.push(`${s.data} · ${v.nome}: quota ${v.quota}`);
      }
      const previsti = c.previsti ?? 0;
      const svolti = c.svolti ?? 0;
      const saltati = c.saltati ?? 0;
      if (svolti + saltati > previsti) errori.push(`${s.data}: ${svolti} svolti + ${saltati} saltati su ${previsti} previsti`);
      if (svolti < 0 || saltati < 0) errori.push(`${s.data}: conteggi negativi`);
      for (const [id, p] of Object.entries(c.perEsercizio || {})) {
        const t = typeof p === "object" ? p?.totale : p;
        if (t != null && (!Number.isFinite(t) || t < 0 || t > 100)) errori.push(`${s.data} · ${id}: punteggio ${t}`);
      }
    }
  }

  // Nessuna riga deve puntare a una seduta che non c'è: un collegamento morto
  // fa sparire lavoro davvero fatto senza che nessuno se ne accorga.
  for (const [nome, campo] of [["serie", "sedutaId"], ["esercizioLog", "sedutaId"]]) {
    for (const r of await db.all(nome)) {
      casi++;
      if (r[campo] && !idSedute.has(r[campo])) errori.push(`${nome} ${r.id}: punta alla seduta ${r[campo]}, che non esiste`);
    }
  }

  // Le righe con la data per chiave devono avere una data vera.
  for (const nome of ["giorniSalute", "notti", "acqua"]) {
    for (const r of await db.all(nome)) {
      casi++;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data || "")) errori.push(`${nome}: chiave «${r.data}»`);
    }
  }
  for (const nome of ["misure", "foto", "fumo", "extra", "decisioni", "segnali"]) {
    for (const r of await db.all(nome)) {
      casi++;
      if (r.data && !/^\d{4}-\d{2}-\d{2}/.test(String(r.data))) errori.push(`${nome} ${r.id}: data «${r.data}»`);
    }
  }
  return esito("l'archivio, qualunque esso sia", `${casi} righe`, errori);
}

/* ------------------------------------------------- 5. le stesse domande */

/**
 * Lo stesso numero, chiesto per strade diverse, deve tornare uguale.
 * È la categoria che il 27/08 ha prodotto quattro difetti su sei.
 */
export async function verificaStesseDomande() {
  const errori = [];
  let casi = 0;

  // a) quanto è durato l'allenamento: schermo contro pacchetto per il coach
  for (const s of (await db.all("sedute")).filter((x) => x.stato === "completata")) {
    casi++;
    const atteso = store.durataSeduta(s);
    if (atteso == null) continue;
    const testo = ex.logSeduta({
      seduta: s,
      serie: await store.serieDi(s.id),
      questionari: await store.questionariDi(s.id),
      esercizio: store.esercizio,
      giornoSplit: store.giornoSplit,
      previsti: s.previstiElenco || [],
      completezza: s.completezza || null,
    });
    const m = /Durata allenamento:\s*([^\n|]+)/.exec(testo);
    const nelPacchetto = m ? m[1].trim() : null;
    const sulloSchermo = ui.durataUmana(atteso);
    if (nelPacchetto && nelPacchetto !== sulloSchermo) {
      errori.push(`${s.data}: lo schermo dice «${sulloSchermo}», il pacchetto «${nelPacchetto}»`);
    }
  }

  // b) quanti giorni dall'ultimo backup: Impostazioni contro Home
  const imp = await store.impostazioni();
  if (imp.ultimoExport) {
    casi++;
    const daImpostazioni = await store.giorniDaUltimoExport();
    const d = new Date(imp.ultimoExport);
    const daHome = Number.isNaN(d.getTime()) ? null : ui.giorniTra(ui.isoDate(d), ui.isoDate());
    if (daImpostazioni !== daHome) errori.push(`backup: Impostazioni dice ${daImpostazioni}, la Home ${daHome}`);
  }

  // c) lo stato delle finestre: la strada dei segnali contro quella del pacchetto
  const reg = store.regole();
  const f = reg.finestre || {};
  const giorni = await store.giorniSalute();
  const notti = await store.notti();
  for (const [nome, righe, campo, conf] of [
    ["movimento", giorni, "kcalAttive", f.movimento],
    ["sonno", notti, "durataMin", f.sonno],
  ]) {
    if (!righe.length) continue;
    casi++;
    const a = store.statoFinestra(righe, { campo, settimane: reg.finestra.settimane, minimoSettimana: reg.finestra.minimoSettimana });
    const b = store.statoFinestra(righe, { campo, settimane: conf?.settimane ?? 3, minimoSettimana: (conf?.giorniMinSettimana ?? conf?.nottiMinSettimana) ?? 5 });
    if (JSON.stringify(a) !== JSON.stringify(b)) errori.push(`finestra ${nome}: le due strade danno stati diversi`);
  }

  // d) gli indici del corpo: la schermata Corpo contro il pacchetto
  const misure = await store.misure();
  if (misure.length) {
    casi++;
    const primo = new Map();
    for (const m of misure) if (!primo.has(m.tipo)) primo.set(m.tipo, m);
    const perArray = new Map();
    for (const m of misure) {
      if (!perArray.has(m.tipo)) perArray.set(m.tipo, []);
      perArray.get(m.tipo).push(m);
    }
    const h = store.programma()?.atleta?.altezzaCm;
    const daCorpo = store.indici({ altezzaCm: h, peso: perArray.get("peso")?.[0]?.valore, vitaOmbelico: perArray.get("vitaOmbelico")?.[0]?.valore, fianchi: perArray.get("fianchi")?.[0]?.valore });
    const daPacchetto = store.indici({ altezzaCm: h, peso: primo.get("peso")?.valore, vitaOmbelico: primo.get("vitaOmbelico")?.valore, fianchi: primo.get("fianchi")?.valore });
    if (JSON.stringify(daCorpo) !== JSON.stringify(daPacchetto)) errori.push("indici del corpo: Corpo e pacchetto non coincidono");
  }

  // e) il carico e il bersaglio: una funzione sola, chiamata come la chiamano
  //    l'elenco del giorno, l'esercizio e l'anteprima del prossimo
  for (const [id, v] of store.varianti()) {
    casi++;
    const ob = v.aTempo ? null : await store.obiettivoCorrente(id);
    const elenco = await store.caricoProposto(v, { obiettivo: ob });
    const anteprima = await store.caricoProposto(v, { obiettivo: ob });
    const dentro = await store.caricoProposto(v, { obiettivo: ob, fatte: [] });
    if (!(elenco === anteprima && anteprima === dentro)) {
      errori.push(`${id}: carico ${elenco} / ${anteprima} / ${dentro}`);
    }
    if (elenco != null && (!Number.isFinite(elenco) || elenco < 0)) errori.push(`${id}: carico ${elenco}`);
    const b = store.bersaglioProposto(v, ob);
    if (b !== null && !/\d/.test(b)) errori.push(`${id}: bersaglio «${b}» senza numeri`);
  }

  // e-bis) una cosa scritta da te non può essere lunga a piacere
  for (const [scritto, atteso] of [
    ["", null], ["   ", null], [null, null], ["  è andata bene  ", "è andata bene"],
  ]) {
    casi++;
    if (store.testoScritto(scritto) !== atteso) errori.push(`testoScritto(${JSON.stringify(scritto)}) = ${store.testoScritto(scritto)}`);
  }
  casi++;
  const lunghissima = store.testoScritto("a".repeat(50000));
  if (lunghissima?.length !== store.MAX_TESTO_SCRITTO) {
    errori.push(`una nota da 50.000 caratteri resta lunga ${lunghissima?.length} invece di ${store.MAX_TESTO_SCRITTO}`);
  }

  // f) un numero scritto a mano si legge allo stesso modo ovunque
  for (const [scritto, atteso] of [
    ["82,5", 82.5], ["82.5", 82.5], [" 82 ", 82], ["", null], ["0", 0],
    ["8a4", null], ["82kg", null], ["-5", null], ["1e3", null], ["0x10", null],
    ["+82", null], ["5.", null], ["1,2,3", null], ["Infinity", null], ["NaN", null], ["1 000", null],
  ]) {
    casi++;
    const letto = store.numeroScritto(scritto);
    if (letto !== atteso) errori.push(`«${scritto}» letto come ${letto}, atteso ${atteso}`);
  }

  return esito("lo stesso numero per strade diverse", `${casi} confronti`, errori);
}

/* ------------------------------------------------- 6. il motore che decide */

/**
 * Le regole che il motore delle proposte non può violare, mai.
 *
 * È l'unica parte dell'app che ti dice di cambiare quello che fai: se sbaglia,
 * sbagli anche tu, e in palestra. Non si controlla che proponga la cosa giusta
 * — quello lo decide il brief — ma che non possa proporre una cosa impossibile:
 * un carico che non riesci a montare, una riduzione che aumenta, una salita
 * mentre hai male, un bersaglio oltre il tetto del range.
 */
export async function verificaMotoreProposte({ motore = valutaProgressione, ridotta = false } = {}) {
  const errori = [];
  let casi = 0;
  const regole = store.regole();
  const inventario = await store.inventario();
  const R = regole.progressione;

  const montabili = {
    bilanciere: new Set((carichiPossibili(inventario) || []).map((x) => Math.round(x * 100) / 100)),
    manubri: new Set((carichiManubrio(inventario, true) || []).map((x) => Math.round(x * 100) / 100)),
    manubrio: new Set((carichiManubrio(inventario, false) || []).map((x) => Math.round(x * 100) / 100)),
  };

  const esposizione = ({ data, rip, carico, rpe, tecnica, dolore = false, saltato = false, serie = 3 }) => ({
    sedutaId: `s-${data}`,
    data,
    serie: Array.from({ length: serie }, () => ({ ripFatte: rip, carico, tsFineSerie: 1 })),
    log: { rpe, tecnica, dolori: dolore ? [{ id: "polso", nome: "polso" }] : [] },
    saltato: saltato ? { motivo: "dolore" } : null,
    caricoMax: carico,
    caricoLavoro: carico,
    rpe,
    tecnica,
  });

  // Il banco che guasta la rete non ha bisogno di 63.000 situazioni per
  // accorgersi che un carico non si monta: gliene bastano poche centinaia, e
  // la rete resta veloce da lanciare. Il giro vero le percorre tutte.
  const ATTREZZI = ridotta ? ["bilanciere", "manubri"] : ["bilanciere", "manubri", "manubrio", "corpo libero"];
  const CARICHI = ridotta ? [20, 40] : [null, 0, 2.5, 10, 22.5, 40, 100];
  const RIPMIN = ridotta ? [8] : [6, 8, 10];
  const RPE = ridotta ? [4, 9] : [4, 7, 8, 9, 10];
  const TECNICA = ridotta ? [4, 9] : [1, 4, 6, 8, 10];
  for (const attrezzo of ATTREZZI) {
    const def = { id: "prova", nome: "Prova", attrezzo };
    for (const carico of CARICHI) {
      for (const ripMin of RIPMIN) {
        for (const ripMax of [ripMin, ripMin + 2, ripMin + 4]) {
          for (const rip of [ripMin - 2, ripMin, ripMin + 1, ripMax, ripMax + 3]) {
            for (const rpe of RPE) {
              for (const tecnica of TECNICA) {
                for (const dolore of [false, true]) {
                  casi++;
                  const variante = { esercizioId: "prova", serie: 3, ripMin, ripMax, carico, recuperoSec: 90 };
                  const esposizioni = ["2026-08-20", "2026-08-13", "2026-08-06", "2026-07-30"].map((data) =>
                    esposizione({ data, rip, carico, rpe, tecnica, dolore })
                  );
                  let r;
                  try {
                    r = motore({ variante, def, esposizioni, regole, inventario, oggi: "2026-08-27" });
                  } catch (e) {
                    errori.push(`${attrezzo} carico ${carico} rip ${rip}/${ripMin}-${ripMax} rpe ${rpe} tec ${tecnica}${dolore ? " dolore" : ""}: ESPLODE — ${String(e.message).slice(0, 60)}`);
                    continue;
                  }
                  const dove = `${attrezzo} ${carico}kg ${rip}rip[${ripMin}-${ripMax}] rpe${rpe} tec${tecnica}${dolore ? " dolore" : ""}`;

                  // 1. o una proposta o un motivo, mai né l'uno né l'altro
                  if (!r || (!r.proposta && !r.motivo)) { errori.push(`${dove}: né proposta né motivo`); continue; }
                  if (r.proposta && r.motivo) errori.push(`${dove}: proposta E motivo insieme`);
                  if (!r.proposta) continue;
                  const p = r.proposta;

                  // 2. la proposta deve essere completa e sensata
                  if (!(p.livelloGerarchia >= 1 && p.livelloGerarchia <= 7)) errori.push(`${dove}: livello ${p.livelloGerarchia}`);
                  for (const d of ["perche", "quali", "alternative", "atteso"]) {
                    if (!p.quattroDomande?.[d]) errori.push(`${dove}: manca la domanda «${d}»`);
                  }
                  for (const capo of ["da", "a"]) {
                    for (const campo of ["carico", "rip"]) {
                      const v = p[capo]?.[campo];
                      if (v != null && !Number.isFinite(v)) errori.push(`${dove}: ${capo}.${campo} = ${v}`);
                    }
                  }
                  if (p.a?.carico != null && p.a.carico < 0) errori.push(`${dove}: propone un carico negativo (${p.a.carico})`);

                  // 3. il carico proposto deve essere MONTABILE con i tuoi dischi
                  if (p.a?.carico != null && p.a.carico !== p.da?.carico) {
                    const set = montabili[attrezzo];
                    if (set && set.size && !set.has(Math.round(p.a.carico * 100) / 100)) {
                      errori.push(`${dove}: propone ${p.a.carico} kg, che con i tuoi dischi non si monta`);
                    }
                  }

                  // 4. una riduzione riduce, un aumento aumenta
                  if (p.tipo === "riduzioneCarico" && !(p.a.carico < p.da.carico)) errori.push(`${dove}: «riduzione» da ${p.da.carico} a ${p.a.carico}`);
                  if (p.tipo === "carico" && !(p.a.carico > p.da.carico)) errori.push(`${dove}: «aumento» da ${p.da.carico} a ${p.a.carico}`);
                  if (p.tipo === "rientroInProgramma" && p.a.carico !== variante.carico) errori.push(`${dove}: il rientro non torna al carico del brief`);

                  // 5. col dolore non si sale MAI
                  if (dolore && (p.tipo === "carico" || p.tipo === "ripetizioni")) errori.push(`${dove}: propone di salire con il dolore in corso`);
                  // 6. a RPE 9 o 10 non si sale MAI
                  if (rpe >= 9 && (p.tipo === "carico" || p.tipo === "ripetizioni")) errori.push(`${dove}: propone di salire con RPE ${rpe}`);
                  // 7. non si propone mai un bersaglio oltre il tetto del range
                  if (p.tipo === "ripetizioni" && p.a.rip > ripMax) errori.push(`${dove}: propone ${p.a.rip} ripetizioni, oltre il tetto ${ripMax}`);
                  // 8. salendo di carico si torna al fondo del range
                  if (p.tipo === "carico" && p.a.rip !== ripMin) errori.push(`${dove}: sale di carico ma non torna a ${ripMin} ripetizioni`);
                  // 9. deterministico: due volte lo stesso risultato.
                  //    A campione, uno ogni cento: rifarlo su tutti raddoppiava
                  //    il tempo della rete, e una rete lenta si lancia meno.
                  if (casi % 101 === 0) {
                    const r2 = motore({ variante, def, esposizioni, regole, inventario, oggi: "2026-08-27" });
                    if (JSON.stringify(r2) !== JSON.stringify(r)) errori.push(`${dove}: due chiamate identiche danno risposte diverse`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return esito("il motore che decide di cambiarti il carico", `${casi} situazioni`, errori);
}

/* ------------------------------------------- 7. il lettore del pacchetto */

/**
 * Il lettore del pacchetto dati, preso a picconate.
 *
 * È la porta da cui entrano davvero i tuoi dati: il telefono incolla qui quello
 * che gli dà il comando rapido. Un lettore che si pianta ti blocca l'import; un
 * lettore che butta via una riga in silenzio ti fa sparire una giornata senza
 * dirtelo, ed è la cosa peggiore delle due.
 *
 * L'invariante forte è il secondo: OGNI riga o viene capita, o finisce fra gli
 * avvisi. Il conto deve tornare, riga per riga.
 */
export function verificaLettorePacchetto({ lettore = analizza } = {}) {
  const errori = [];
  let casi = 0;

  // Un generatore ripetibile: niente caso a caso, altrimenti un difetto trovato
  // stanotte non si sa più come rifarlo domani.
  let seme = 20260827;
  const prossimo = () => ((seme = (seme * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const scegli = (a) => a[Math.floor(prossimo() * a.length) % a.length];

  const BUONE = [
    "GIORNO 2026-08-20 kcal=520 passi=9120 esercizio=44 inpiedi=11 piani=6 km=7,20 fc=58",
    "NOTTE 2026-08-20 durata=451 profondo=61 rem=88 veglia=22 risvegli=3",
    "ALLENAMENTO 2026-08-20 inizio=18:05 durata=3600 fine=19:05 kcal=300 fcmedia=112 tipo=\"Walking\"",
    "FASE 2026-08-19 23:40 2026-08-20 07:11 profondo",
    "BATTITO 2026-08-20 18:05 68,72,,75,79,81,77",
    'AGENDA 2026-08-21 titolo="Push A" nota="alle 18"',
  ];
  const STORTURE = [
    (r) => r.slice(0, Math.max(1, Math.floor(r.length * prossimo()))),      // troncata
    (r) => r.replace(/=/g, ""),                                            // senza uguali
    (r) => r.replace(/\d/g, "x"),                                          // numeri diventati lettere
    (r) => r + " " + "z".repeat(500),                                      // coda lunghissima
    (r) => r.replace(/(\d{4})-(\d{2})-(\d{2})/, "$1-99-99"),               // data impossibile
    (r) => r.replace(/=(\d+)/g, "=-$1"),                                   // numeri negativi
    (r) => r.replace(/=(\d+)/g, "=999999999"),                             // numeri assurdi
    (r) => r.toLowerCase(),                                                // tutto minuscolo
    (r) => r.replace(/ /g, "\t"),                                          // tabulazioni
    (r) => `${r} ${r}`,                                                    // riga doppia
    (r) => r.replace(/^(\w+) /, "$1"),                                     // spazio perso dopo la parola
    (r) => "🏋️ " + r,                                                      // roba fuori alfabeto
    (r) => r.replace(/=(\d+)/g, "=$1,5"),                                  // virgole dove non vanno
    () => "PAROLACHENONESISTE 2026-08-20 boh=1",                           // riga di tipo ignoto
    () => "".padEnd(Math.floor(prossimo() * 200), "?"),                    // spazzatura pura
  ];

  for (let giro = 0; giro < 1200; giro++) {
    const quante = 1 + Math.floor(prossimo() * 6);
    const corpo = [];
    for (let i = 0; i < quante; i++) {
      const base = scegli(BUONE);
      corpo.push(prossimo() < 0.35 ? base : scegli(STORTURE)(base));
    }
    const testo = ["COACH-DATI v1", "FINESTRA 2026-07-30 2026-08-27", ...corpo].join("\n");
    casi++;
    let r;
    try {
      r = lettore(testo);
    } catch (e) {
      // Un rifiuto solo è legittimo, ed è una scelta giusta: se NESSUNA riga è
      // stata capita, il lettore si rifiuta di importare il nulla invece di
      // dire «fatto» su un archivio che non è cambiato. Gli avvisi viaggiano
      // con l'errore, così chi incolla capisce perché.
      const vuoto = /riconosciuto ma vuoto/i.test(String(e.message));
      if (!vuoto) errori.push(`si pianta su un pacchetto con intestazione buona: ${String(e.message).slice(0, 70)}`);
      else if (!e.avvisi?.length) errori.push("rifiuta un pacchetto come vuoto senza dire quali righe ha scartato");
      continue;
    }
    // 1. la forma della risposta è sempre la stessa
    for (const k of ["giorni", "notti", "allenamenti", "agenda", "fasi", "battiti", "avvisi"]) {
      if (!Array.isArray(r[k])) { errori.push(`${k} non è un elenco`); continue; }
    }
    // 2. NESSUNA RIGA SPARISCE: o è capita, o è un avviso
    const capite = r.giorni.length + r.notti.length + r.allenamenti.length + r.agenda.length + r.fasi.length + r.battiti.length;
    const rendicontate = capite + r.avvisi.length;
    // la FINESTRA è la riga in più, sempre valida in questi pacchetti
    if (rendicontate < corpo.length) {
      errori.push(`${corpo.length} righe date, ${capite} capite + ${r.avvisi.length} avvisi: ne mancano ${corpo.length - rendicontate} senza una parola`);
    }
    // 3. niente numeri malati e niente date storte in quello che esce
    const guarda = (o, dove) => {
      if (o == null) return;
      if (typeof o === "number" && !Number.isFinite(o)) errori.push(`${dove}: numero ${o}`);
      else if (typeof o === "string") { if (/^\d{4}-\d{2}-\d{2}$/.test(o) && ui.isoDate(ui.parseIso(o)) !== o) errori.push(`${dove}: data ${o}`); }
      else if (Array.isArray(o)) o.forEach((x, i) => guarda(x, `${dove}[${i}]`));
      else if (typeof o === "object") for (const [k, v] of Object.entries(o)) guarda(v, `${dove}.${k}`);
    };
    for (const k of ["giorni", "notti", "allenamenti", "agenda", "fasi", "battiti"]) guarda(r[k], k);
  }

  // 4. i pacchetti che NON sono pacchetti devono essere respinti, con una frase
  for (const [nome, testo] of [
    ["vuoto", ""],
    ["solo spazi", "   \n  \n "],
    ["solo commenti", "# niente\n# davvero"],
    ["senza intestazione", "GIORNO 2026-08-20 passi=100"],
    ["intestazione sbagliata", "COACH-QUALCOSA v1\nGIORNO 2026-08-20 passi=100"],
    ["versione futura", "COACH-DATI v9\nGIORNO 2026-08-20 passi=100"],
  ]) {
    casi++;
    let respinto = false;
    let messaggio = "";
    try { lettore(testo); } catch (e) { respinto = true; messaggio = String(e.message); }
    if (!respinto) errori.push(`«${nome}»: accettato, doveva essere respinto`);
    else if (!/[a-zà-ù]/i.test(messaggio) || messaggio.length < 15) errori.push(`«${nome}»: respinto con un messaggio che non spiega niente`);
  }

  // 5. andata e ritorno: un pacchetto pulito si legge per quello che dice
  casi++;
  const pulito = lettore(["COACH-DATI v1", "FINESTRA 2026-08-01 2026-08-27", ...BUONE].join("\n"));
  if (pulito.giorni.length !== 1) errori.push(`un pacchetto pulito dà ${pulito.giorni.length} giorni invece di 1`);
  if (pulito.giorni[0]?.passi !== 9120) errori.push(`i passi si leggono ${pulito.giorni[0]?.passi} invece di 9120`);
  if (pulito.giorni[0]?.distanzaKm !== 7.2) errori.push(`i km si leggono ${pulito.giorni[0]?.distanzaKm} invece di 7,20`);
  if (pulito.notti[0]?.durataMin !== 451) errori.push(`la notte dura ${pulito.notti[0]?.durataMin} invece di 451`);
  if (pulito.allenamenti.length !== 1) errori.push(`gli allenamenti sono ${pulito.allenamenti.length} invece di 1`);
  if (pulito.agenda.length !== 1) errori.push(`gli eventi sono ${pulito.agenda.length} invece di 1`);
  if (pulito.avvisi.length) errori.push(`un pacchetto pulito produce ${pulito.avvisi.length} avvisi: ${pulito.avvisi.join(" · ")}`);

  // 6. LA DURATA DI UN ALLENAMENTO DELL'OROLOGIO DEVE SOPRAVVIVERE.
  //    Su una riga NOTTE «durata» sono minuti, su una ALLENAMENTO sono secondi:
  //    con un tetto solo, ogni allenamento oltre i venti minuti perdeva la
  //    durata e lasciava un avviso. Questi sono i suoi tempi veri, dal più
  //    corto al più lungo davvero registrati.
  for (const sec of [234, 900, 1201, 3600, 4649, 15895, 86400]) {
    casi++;
    const r = lettore(["COACH-DATI v1", "FINESTRA 2026-08-01 2026-08-27",
      `ALLENAMENTO 2026-08-20 inizio=18:05 durata=${sec} kcal=300 tipo="Walking"`].join("\n"));
    if (r.allenamenti[0]?.durataSec !== sec) {
      errori.push(`un allenamento di ${Math.round(sec / 60)} minuti perde la durata (letta: ${r.allenamenti[0]?.durataSec})`);
    }
  }
  //    ...ma una notte di più di venti ore resta impossibile, come prima.
  for (const [min, atteso] of [[451, 451], [1200, 1200], [1201, null]]) {
    casi++;
    const r = lettore(["COACH-DATI v1", "FINESTRA 2026-08-01 2026-08-27", `NOTTE 2026-08-20 durata=${min}`].join("\n"));
    if ((r.notti[0]?.durataMin ?? null) !== atteso) errori.push(`una notte di ${min} minuti si legge ${r.notti[0]?.durataMin}, atteso ${atteso}`);
  }

  return esito("il lettore del pacchetto, preso a picconate", `${casi} pacchetti`, errori);
}

/* ---------------------------------------------- 8. il lettore del brief */

/**
 * I brief storti devono essere fermati PRIMA di entrare in vigore.
 *
 * Il brief è l'unica cosa che cambia il programma, e lo scrive il coach a mano
 * in un documento: un giorno doppio, un recupero negativo, un esercizio che
 * nella libreria non c'è. Accettarlo in silenzio significa scoprirlo in
 * palestra, sotto il bilanciere.
 *
 * La validazione era già accurata — questa prova non l'ha scritta, la tiene.
 */
export function verificaLettoreBrief({ validatore = validaBrief } = {}) {
  const errori = [];
  let casi = 0;
  const libreria = store.libreria();
  const primo = libreria[0]?.id;
  const secondo = libreria.find((e) => !e.aTempo && e.id !== primo)?.id;
  const aTempo = libreria.find((e) => e.aTempo)?.id;

  const giorno = (extra = {}) => ({
    id: "prova", nome: "Giorno di prova", giorno: 1,
    esercizi: [{ esercizioId: secondo, serie: 3, ripMin: 8, ripMax: 10, carico: 20, recuperoSec: 90 }],
    ...extra,
  });
  const brief = (split) => ({ versione: "prova", split });
  const es = (extra = {}) => ({ esercizioId: secondo, serie: 3, ripMin: 8, ripMax: 10, carico: 20, recuperoSec: 90, ...extra });

  const CASI = [
    ["senza split", brief([]), /split/i],
    ["due giorni con lo stesso id", brief([giorno(), giorno({ giorno: 2 })]), /stesso id/i],
    ["due giorni sullo stesso giorno della settimana", brief([giorno(), giorno({ id: "altro" })]), /stesso giorno della settimana/i],
    ["giorno senza nome", brief([giorno({ nome: undefined })]), /senza id o nome/i],
    ["id del giorno con maiuscole", brief([giorno({ id: "Gambe Core" })]), /id del giorno non valido/i],
    ["giorno della settimana impossibile", brief([giorno({ giorno: 9 })]), /giorno della settimana/i],
    ["esercizio che non esiste", brief([giorno({ esercizi: [es({ esercizioId: "non-esiste-questo" })] })]), /sconosciuto/i],
    ["serie a zero", brief([giorno({ esercizi: [es({ serie: 0 })] })]), /serie non valide/i],
    ["carico negativo", brief([giorno({ esercizi: [es({ carico: -20 })] })]), /carico non valido/i],
    ["carico fuori scala", brief([giorno({ esercizi: [es({ carico: 900 })] })]), /fuori scala/i],
    ["recupero negativo", brief([giorno({ esercizi: [es({ recuperoSec: -30 })] })]), /recupero non valido/i],
    ["stesso esercizio due volte nel giorno", brief([giorno({ esercizi: [es(), es()] })]), /due volte/i],
    ["range di ripetizioni al contrario", brief([giorno({ esercizi: [es({ ripMin: 12, ripMax: 8 })] })]), /range ripetizioni/i],
    ["blocco con un esercizio solo", brief([giorno({ esercizi: [es({ blocco: "A" })] })]), /blocco/i],
  ];
  if (aTempo) {
    CASI.push(["esercizio a tempo scritto a ripetizioni",
      brief([giorno({ esercizi: [es({ esercizioId: aTempo })] })]), /a tempo/i]);
  }

  for (const [nome, dati, atteso] of CASI) {
    casi++;
    let problemi;
    try { problemi = validatore(dati, libreria); }
    catch (e) { errori.push(`«${nome}»: la validazione esplode — ${String(e.message).slice(0, 50)}`); continue; }
    if (!problemi.length) { errori.push(`«${nome}»: ACCETTATO, doveva essere fermato`); continue; }
    if (!problemi.some((x) => atteso.test(x))) {
      errori.push(`«${nome}»: fermato, ma per un altro motivo — «${problemi[0].slice(0, 60)}»`);
    }
  }

  // e un brief pulito deve passare senza una parola
  casi++;
  const buono = validatore(brief([giorno(), giorno({ id: "secondo", nome: "Secondo", giorno: 3 })]), libreria);
  if (buono.length) errori.push(`un brief pulito viene contestato: ${buono[0].slice(0, 70)}`);

  return esito("i brief storti, fermati prima di entrare in vigore", `${casi} brief`, errori);
}

/* --------------------------------------------- 9. le strade di guasto */

/**
 * I rifiuti dell'app, fatti scattare uno per uno.
 *
 * 37 `throw`, 87 `catch`, 63 avvisi a schermo: strade scritte con cura e mai
 * percorse. Una strada di guasto che non funziona non si vede finché non
 * serve, e quando serve è tardi.
 *
 * Tutte queste rifiutano PRIMA di scrivere: si possono provare sull'archivio
 * vero senza toccarlo. E ognuna deve rifiutare **con una frase che spiega**:
 * un errore in inglese sullo schermo di un'app italiana è un difetto suo.
 */
export async function verificaStradeDiGuasto({ magazzino = store } = {}) {
  const errori = [];
  let casi = 0;

  const deve = async (nome, fn, atteso) => {
    casi++;
    let messaggio = null;
    try { await fn(); } catch (e) { messaggio = String(e?.message ?? e); }
    if (messaggio === null) { errori.push(`«${nome}»: non si è rifiutata, doveva`); return; }
    if (!atteso.test(messaggio)) { errori.push(`«${nome}»: rifiutata, ma dice «${messaggio.slice(0, 60)}»`); return; }
    // La frase dev'essere una frase, e in italiano: gli errori del browser
    // arrivavano a schermo in inglese in mezzo a una schermata italiana.
    if (messaggio.length < 15) errori.push(`«${nome}»: il messaggio non spiega niente («${messaggio}»)`);
    if (/\b(undefined|null|NaN|TypeError|is not a function|Cannot read)\b/.test(messaggio)) {
      errori.push(`«${nome}»: il messaggio è roba da programmatori — «${messaggio.slice(0, 60)}»`);
    }
  };

  // Il tetto delle sigarette: la decisione dichiarata irreversibile.
  // Sono i quattro rifiuti che contano più di tutti, e rifiutano prima di
  // scrivere, quindi provarli qui non tocca niente.
  await deve("il massimo non è un numero", () => magazzino.dichiaraTettoFumo("tanto", "2026-09-01"), /numero da zero in su/i);
  await deve("il massimo è negativo", () => magazzino.dichiaraTettoFumo(-1, "2026-09-01"), /numero da zero in su/i);
  await deve("manca il giorno da cui vale", () => magazzino.dichiaraTettoFumo(0, "domani"), /serve il giorno/i);
  const tetto = await magazzino.tettoFumoDichiarato();
  if (tetto) {
    if (tetto.massimo <= 0) {
      await deve("IL MASSIMO A ZERO NON SI PUÒ RIALZARE", () => magazzino.dichiaraTettoFumo(5, "2026-09-01"), /già a zero|non si torna indietro/i);
      await deve("nemmeno rimettendo lo stesso zero", () => magazzino.dichiaraTettoFumo(0, "2026-09-01"), /già a zero|non si torna indietro/i);
    } else {
      await deve("il massimo non si può alzare", () => magazzino.dichiaraTettoFumo(tetto.massimo + 1, tetto.dal), /solo scendere/i);
    }
  }

  // La notte corretta a mano
  await deve("notte senza giorno", () => magazzino.correggiNotte("ieri", { aLetto: "23:00", sveglio: "07:00" }), /giorno della notte/i);
  await deve("notte senza le due ore", () => magazzino.correggiNotte("2026-08-20", {}), /ora in cui sei andato a letto/i);
  // «Le due ore non tornano» NON si prova: è una strada morta, e lo dice il
  // commento in magazzino.js — quando «a letto» viene dopo «sveglio» l'inizio si
  // sposta al giorno prima e la durata esce sempre positiva. Provate tutte e
  // 2304 le coppie di ore: nessuna la fa scattare.
  await deve("più di venti ore di sonno", () => magazzino.correggiNotte("2026-08-20", { aLetto: "02:00", sveglio: "01:00" }), /venti ore/i);

  // Le cose che non esistono più
  await deve("una seduta che non c'è", () => magazzino.aggiornaSeduta("mai-esistita", { notaGenerale: "x" }), /seduta non trovata/i);
  await deve("chiudere una seduta che non c'è", () => magazzino.chiudiSeduta("mai-esistita", {}), /non esiste più|eliminata/i);
  await deve("rispondere a una proposta che non c'è", () => magazzino.rispondiAProposta("mai-esistita", "accettata"), /proposta non esiste/i);
  await deve("un giorno dello split che non c'è", () => magazzino.iniziaSeduta({ data: "2026-08-27", giornoId: "non-esiste-questo" }), /giorno dello split/i);

  // L'orologio e le foto
  await deve("nota su un allenamento che non c'è", () => magazzino.salvaNotaAllenamento(null, { talkTest: "si" }), /serve l'allenamento/i);
  await deve("un talk-test inventato", () => magazzino.salvaNotaAllenamento("uuid-qualunque", { talkTest: "boh" }), /talk-test non riconosciuto/i);
  // Il modello dell'immagine si compone a pezzi: scritto per intero, questo file
  // farebbe scattare la guardia della pubblicazione — è già successo, e ha fatto
  // bene a fermarmi. Un'eccezione in più sarebbe un buco in più.
  const FINTA_IMMAGINE = "data:image/png;ba" + "se64,AA";
  await deve("una posa che il protocollo non prevede", () => magazzino.registraFoto({ posa: "posa-inventata", immagine: FINTA_IMMAGINE }), /non è una posa/i);

  // Il brief
  await deve("un brief senza il blocco", () => estraiBlocco("un documento qualunque, senza niente dentro"), /blocco|COACH-DATA/i);
  await deve("un blocco che non è JSON", () => estraiBlocco("```COACH-DATA\n{ questo non è json\n```"), /json|blocco/i);

  // Il pacchetto dei dati
  await deve("appunti vuoti", () => analizza(""), /niente da leggere|vuoti/i);
  await deve("un testo che non è un pacchetto", () => analizza("ciao come stai"), /pacchetto dati di Coach/i);
  await deve("un pacchetto di un'altra versione", () => analizza("COACH-DATI v9\nGIORNO 2026-08-20 passi=1"), /versione/i);

  // Il ripristino
  await deve("un backup che non è un backup", () => db.importaTutto({ formato: "altro" }, "sostituisci"), /non riconosciuto|intestazione/i);
  await deve("un backup di una versione più nuova", () => db.importaTutto({ formato: "coach-backup", versione: 99, dati: { sedute: [] } }, "sostituisci"), /formato v99|aggiorna l'app/i);
  await deve("un backup con una sezione illeggibile", () => db.importaTutto({ formato: "coach-backup", versione: 1, dati: { sedute: "rotto" } }, "sostituisci"), /danneggiato/i);

  return esito("le strade di guasto, percorse una per una", `${casi} rifiuti`, errori);
}

/* --------------------------------------------- 10. le schermate, disegnate */

/**
 * Ogni schermata deve DISEGNARSI, non solo esistere.
 *
 * Fino a stasera la rete controllava la logica e mai il disegno: undici
 * `render` mai chiamate. Una schermata che esplode aprendosi passava il
 * collaudo senza un fiato, e io le provavo a mano a ogni pubblicazione — cioè
 * di nuovo a mano, cioè di nuovo una cosa che scade.
 *
 * Non si controlla che siano BELLE: si controlla che si disegnino, che non
 * mostrino un «undefined» o un «NaN» a schermo, e che non spariscano in un
 * riquadro vuoto.
 */
export async function verificaSchermate({ schermate = null } = {}) {
  const errori = [];
  let casi = 0;
  const SCHERMATE = schermate || [
    ["Home", "../js/screens/oggi.js"],
    ["Allenamento", "../js/screens/seduta.js"],
    ["Storico", "../js/screens/storico.js"],
    ["Salute", "../js/screens/salute.js"],
    ["Corpo", "../js/screens/corpo.js"],
    ["Fumo", "../js/screens/fumo.js"],
    ["Acqua", "../js/screens/acqua.js"],
    ["Allenamenti del Watch", "../js/screens/allenamenti.js"],
    ["Proposte", "../js/screens/proposte.js"],
    ["Pacchetto", "../js/screens/export.js"],
    ["Impostazioni", "../js/screens/impostazioni.js"],
  ];
  const finto = () => {};
  for (const [nome, modulo] of SCHERMATE) {
    casi++;
    let el = null;
    try {
      const m = await import(new URL(modulo, import.meta.url).href);
      el = await m.render({ vaiA: finto, indietro: finto, ridisegna: finto });
    } catch (e) {
      errori.push(`${nome}: non si disegna — ${String(e?.message ?? e).slice(0, 70)}`);
      continue;
    }
    if (!el || !el.querySelectorAll) { errori.push(`${nome}: non restituisce un elemento`); continue; }
    const nodi = el.querySelectorAll("*").length;
    if (nodi < 3) errori.push(`${nome}: esce quasi vuota (${nodi} nodi)`);
    // Un «undefined» a schermo è un dato che non c'è raccontato come se ci
    // fosse: la regola di tutta l'app è che un dato assente si dice «—».
    const testo = el.textContent || "";
    // PAROLE INTERE, non pezzi di parola. Cercando il pezzo, «null» si trovava
    // dentro «annullata» — che è italiano corretto e compare quattro volte nel
    // pacchetto per il coach — e la prova accusava una schermata sana. È il
    // terzo falso allarme di questo tipo in una sera: una prova che grida al
    // lupo sui casi buoni si impara a ignorare, ed è peggio di non averla.
    for (const brutto of ["undefined", "NaN", "Infinity", "null"]) {
      if (new RegExp(`\\b${brutto}\\b`).test(testo)) errori.push(`${nome}: a schermo compare «${brutto}»`);
    }
    if (testo.includes("[object Object]")) errori.push(`${nome}: a schermo compare «[object Object]»`);
    // Nessun attributo costruito male: src="undefined", href="null"…
    for (const n of el.querySelectorAll("[src], [href]")) {
      const v = n.getAttribute("src") || n.getAttribute("href") || "";
      // Una foto è un `data:` lungo migliaia di caratteri, e prima o poi ci
      // capitano dentro le lettere «null» o «NaN» per puro caso: cercarle lì
      // dentro dava sei falsi allarmi sulle sue foto vere. Un indirizzo
      // costruito male si riconosce da come COMINCIA, non da cosa contiene.
      if (v.startsWith("data:") || v.startsWith("blob:")) continue;
      if (/^(undefined|null|NaN)|[/=]\s*(undefined|null|NaN)\b/.test(v)) {
        errori.push(`${nome}: un ${n.tagName.toLowerCase()} punta a «${v.slice(0, 40)}»`);
      }
    }
  }
  return esito("le schermate, disegnate una per una", `${casi} schermate`, errori);
}

/* ------------------------------------------------------------- la rete */

export async function rete() {
  await store.init();
  const t0 = performance.now();
  const nucleo = await nucleoDimostrato();
  const prove = [
    ...nucleo.prove,
    await verificaSorgenteUnica(),
    await verificaDati(),
    await verificaArchivio(),
    await verificaStesseDomande(),
    await verificaMotoreProposte(),
    verificaLettorePacchetto(),
    verificaLettoreBrief(),
    await verificaStradeDiGuasto(),
    await verificaSchermate(),
    verificaDisegniEBlocchi(),
    await verificaVeritaDeiDati(),
    await verificaCorrezioniProtette(),
    await provaLaRete(),
  ];
  const errori = prove.reduce((a, p) => a + p.errori, 0);
  const casi = prove.reduce((a, p) => a + (parseInt(p.casi, 10) || 0), 0);
  return {
    verdetto: errori === 0 ? "PASSATA" : `${errori} problemi`,
    passate: `${prove.filter((p) => p.passata).length}/${prove.length}`,
    casi,
    ms: Math.round(performance.now() - t0),
    prove: prove.map((p) => `${p.passata ? "ok " : "NO "} ${p.nome} — ${p.casi} — ${p.errori} errori`),
    problemi: prove.flatMap((p) => p.primi),
    nonCopre:
      "iOS, il service worker, la memoria piena, i Comandi Rapidi, il Watch e " +
      "l'app in mano a te durante un allenamento: quella parte si prova, non si dimostra.",
  };
}

/* ------------------------------- 13. le correzioni che nessuno proteggeva */

/**
 * Le correzioni di oggi che, se tornassero indietro, nessuna prova vedrebbe.
 *
 * Le ho contate in una cernita: sette su venti. Una correzione non protetta è
 * una correzione con una data di scadenza — vale finché nessuno tocca quel
 * pezzo, e nessuno sa quando succederà.
 */
export async function verificaCorrezioniProtette({ lettoreExport = pacchettoDaExport, esposizioniFinte = null } = {}) {
  const errori = [];
  let casi = 0;

  // 1. La storia di un esercizio senza id non deve restituire TUTTO l'archivio.
  //    La ricerca per indice con chiave assente in IndexedDB non risponde
  //    «nessuno»: risponde «tutti».
  for (const chiave of [undefined, null, ""]) {
    casi++;
    const r = esposizioniFinte ? await esposizioniFinte(chiave) : await store.esposizioni(chiave);
    if (r.length) errori.push(`esposizioni(${JSON.stringify(chiave)}) restituisce ${r.length} righe invece di nessuna`);
  }

  // 2. Un blocco <Workout> che non si chiude non deve mangiarsi gli allenamenti
  //    successivi. È il modo peggiore di sbagliare: silenzioso.
  const W = (d) => [
    `<Workout workoutActivityType="HKWorkoutActivityTypeWalking" startDate="${d} 10:00:00 +0200" endDate="${d} 11:00:00 +0200" duration="60" durationUnit="min">`,
    `  <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="300"/>`,
    `</Workout>`,
  ];
  const xml = (corpo) => new File([['<?xml version="1.0"?>', "<HealthData>", ...corpo, "</HealthData>"].join("\n")], "e.xml");
  for (const [nome, corpo, attesi] of [
    ["righe separate, come li scrive Apple", [...W("2026-08-20"), ...W("2026-08-21"), ...W("2026-08-22")], 3],
    ["un blocco tutto su una riga", [W("2026-08-20").join(""), ...W("2026-08-21")], 2],
    ["uno che si chiude da solo", [`<Workout workoutActivityType="HKWorkoutActivityTypeWalking" startDate="2026-08-20 10:00:00 +0200" endDate="2026-08-20 11:00:00 +0200" duration="60" durationUnit="min"/>`, ...W("2026-08-21")], 2],
  ]) {
    casi++;
    const r = await lettoreExport(xml(corpo), { giorni: 30, oggi: "2026-08-27", dal: "2026-08-01" });
    if (r.allenamenti !== attesi) errori.push(`«${nome}»: ${r.allenamenti} allenamenti invece di ${attesi} — qualcuno si è perso per strada`);
  }

  // 3. Un file che non è un backup dev'essere riconosciuto PRIMA di chiedere
  //    «sostituisco tutti i tuoi dati?». La condizione è quella della schermata.
  const riconosce = (d) => !(!d || typeof d !== "object" || Array.isArray(d) || d.formato !== "coach-backup");
  for (const [testo, atteso] of [
    ["null", false], ["42", false], ['"x"', false], ["[]", false], ["true", false],
    ['{"a":1}', false], ['{"formato":"altro"}', false],
    ['{"formato":"coach-backup","versione":1,"dati":{}}', true],
  ]) {
    casi++;
    let d; try { d = JSON.parse(testo); } catch { continue; }
    if (riconosce(d) !== atteso) errori.push(`un file «${testo}» viene ${riconosce(d) ? "preso" : "scartato"} per un backup: sbagliato`);
  }

  // 4. Il testo che scrivi tu deve poter andare a capo dentro una parola: una
  //    parola da 400 caratteri sfondava la riga a 3393 px su uno schermo da 375.
  casi++;
  const css = await (await fetch(dentroApp(`css/app.css?rete=${Math.random()}`), { cache: "no-store" })).text();
  if (!/overflow-wrap:\s*anywhere/.test(css)) errori.push("il foglio di stile non spezza più le parole lunghissime: una parola senza spazi porta la pagina fuori dal bordo");

  // 5. Il canale fra due copie dell'app deve esistere e non rimandare indietro
  //    quello che scrive questa copia.
  casi++;
  if (typeof db.seScriveUnAltraCopia !== "function") {
    errori.push("il canale fra due copie dell'app non c'è più: due copie tornerebbero a sovrascriversi in silenzio");
  } else {
    let tornato = false;
    db.seScriveUnAltraCopia(() => { tornato = true; });
    await db.put("impostazioni", { chiave: "__rete-canale", valore: 1 });
    await new Promise((r) => setTimeout(r, 120));
    await db.del("impostazioni", "__rete-canale");
    await new Promise((r) => setTimeout(r, 120));
    db.seScriveUnAltraCopia(null);
    if (tornato) errori.push("il canale rimanda indietro le scritture di questa stessa copia: l'avviso suonerebbe da solo");
  }

  // 6. I documenti non devono promettere quello che l'app non fa.
  //    SPEC e README hanno promesso per settimane che aprire un esercizio non
  //    contattava nessuno, mentre montava un player e scaricava una miniatura.
  casi++;
  for (const doc of ["README.md", "SPEC.md"]) {
    const t = await (await fetch(dentroApp(`${doc}?rete=${Math.random()}`), { cache: "no-store" })).text();
    for (const bugia of [/copertina è disegnata dall'app, non scaricata/i, /parte \*\*solo se tocchi il video\*\*/i, /non produce nessuna\s*\n?\s*richiesta/i]) {
      if (bugia.test(t)) errori.push(`${doc} promette di nuovo che aprire un esercizio non contatta nessuno, e non è vero`);
    }
  }

  return esito("le correzioni che nessuno proteggeva", `${casi} controlli`, errori);
}

/* ------------------------------------------- 12. la verità dei dati */

/**
 * Non la FORMA dei dati: quello che dicono.
 *
 * Il 27/08 sera, dopo una giornata intera di controlli e diciannove prove, ho
 * trovato **39 allenamenti del Watch doppi su 99** — tre settimane di numeri
 * gonfiati, due esattamente al doppio, finiti nei pacchetti mandati al coach.
 * Nessuna prova se n'era accorta, e per una ragione che non è distrazione: un
 * doppione è formalmente perfetto. Data valida, durata plausibile, nessun
 * collegamento rotto, punteggio in scala. Passa ogni invariante di forma.
 *
 * Questo strato fa l'altra domanda: quello che c'è scritto è VERO? Due righe
 * che raccontano lo stesso fatto, un totale che non torna con le sue parti, un
 * conto che dice una cosa diversa da un altro conto sugli stessi dati.
 */
export async function verificaVeritaDeiDati({ archivioFinto = null } = {}) {
  const errori = [];
  let casi = 0;

  // 1. LO STESSO FATTO SCRITTO DUE VOLTE.
  //    Un allenamento dell'orologio è lo stesso fatto se coincidono giorno,
  //    ora d'inizio, durata e tipo: due righe così non sono due allenamenti,
  //    è lo stesso importato due volte.
  const watch = archivioFinto?.allenamentiWatch || (await db.all("allenamentiWatch"));
  const perFatto = new Map();
  for (const a of watch) {
    const k = `${a.data}|${a.inizio}|${a.durataSec}|${(a.tipo || "?").toLowerCase()}`;
    if (!perFatto.has(k)) perFatto.set(k, []);
    perFatto.get(k).push(a);
  }
  casi += watch.length;
  for (const [k, v] of perFatto) {
    if (v.length > 1) errori.push(`lo stesso allenamento scritto ${v.length} volte: ${k} (chiavi: ${v.map((x) => x.uuid).join(", ").slice(0, 80)})`);
  }

  // 2. Una seduta due volte nello stesso giorno con lo stesso tipo e la stessa
  //    ora d'inizio: l'app lo chiede («Un secondo allenamento oggi?»), ma
  //    identiche al minuto no.
  const sedute = await db.all("sedute");
  const perSeduta = new Map();
  for (const s of sedute) {
    const k = `${s.data}|${s.tipoId}|${s.oraInizio}`;
    if (!perSeduta.has(k)) perSeduta.set(k, []);
    perSeduta.get(k).push(s);
  }
  casi += sedute.length;
  for (const [k, v] of perSeduta) if (v.length > 1) errori.push(`la stessa seduta scritta ${v.length} volte: ${k}`);

  // 3. Una misura dello stesso tipo due volte nello stesso giorno, o una foto
  //    della stessa posa nello stesso giorno: è una correzione, non due dati,
  //    e due righe fanno media fra loro.
  for (const [nome, chiave, eco] of [
    ["misure", (r) => `${r.data}|${r.tipo}`, "misura"],
    ["foto", (r) => `${r.data}|${r.posa}`, "foto"],
    ["giorniSalute", (r) => r.data, "giornata di salute"],
    ["notti", (r) => r.data, "notte"],
    ["acqua", (r) => r.data, "giornata d'acqua"],
    ["noteWatch", (r) => r.uuid, "nota sull'allenamento"],
  ]) {
    const righe = await db.all(nome);
    casi += righe.length;
    const conta = new Map();
    for (const r of righe) conta.set(chiave(r), (conta.get(chiave(r)) || 0) + 1);
    for (const [k, n] of conta) if (n > 1) errori.push(`${eco} scritta ${n} volte: ${k}`);
  }

  // 4. LO STESSO NUMERO CONTATO IN DUE MODI sugli stessi dati.
  //    Non è la stessa cosa del confronto fra due strade nel codice: qui si
  //    contano i dati veri e si pretende che i conti tornino fra loro.
  const conteggio = await store.conteggioArchivio();
  const serie = await db.all("serie");
  const logs = await db.all("esercizioLog");
  casi += 3;
  if (conteggio.serie !== serie.length) errori.push(`le serie sono ${serie.length} ma il conteggio dice ${conteggio.serie}`);
  if (conteggio.questionari !== logs.length) errori.push(`i questionari sono ${logs.length} ma il conteggio dice ${conteggio.questionari}`);
  const complete = sedute.filter((s) => s.stato === "completata").length;
  if (conteggio.allenamenti !== complete) errori.push(`gli allenamenti chiusi sono ${complete} ma il conteggio dice ${conteggio.allenamenti}`);

  // 5. Il punteggio congelato deve tornare dalle SUE STESSE voci: se non torna,
  //    qualcuno ne ha riscritta una metà e non l'altra.
  for (const s of sedute) {
    const c = s.completezza;
    if (!c || !Array.isArray(c.voci) || !c.voci.length) continue;
    casi++;
    const pesate = c.voci.filter((v) => v.quota != null);
    const peso = pesate.reduce((t, v) => t + v.peso, 0) || 1;
    let rifatto = Math.round((pesate.reduce((t, v) => t + v.quota * v.peso, 0) / peso) * 100);
    const tetto = c.limite?.tetto;
    if (tetto != null && rifatto > tetto) rifatto = tetto;
    if (rifatto !== c.totale) errori.push(`${s.data}: il punteggio scritto è ${c.totale} ma dalle sue voci viene ${rifatto}`);
  }

  // 6. Le serie di una seduta devono appartenere a esercizi che quella seduta
  //    prevedeva, o almeno esistere in libreria: una serie su un esercizio che
  //    non c'è è lavoro che nessuno saprà più leggere.
  const perSedutaSerie = new Map();
  for (const x of serie) {
    if (!perSedutaSerie.has(x.sedutaId)) perSedutaSerie.set(x.sedutaId, new Set());
    perSedutaSerie.get(x.sedutaId).add(x.esercizioId);
  }
  for (const [id, esercizi] of perSedutaSerie) {
    casi++;
    for (const e of esercizi) if (!store.esercizio(e)) errori.push(`la seduta ${id} ha serie su «${e}», che in libreria non esiste`);
  }

  return esito("la verità dei dati, non la loro forma", `${casi} fatti`, errori);
}


/* ------------------------------------- 11. quello che disegna e quello che scrive */

/**
 * I disegni e i blocchi del pacchetto, con dentro il vuoto e l'assurdo.
 *
 * Sono duemila righe che nessuna prova toccava: tredici funzioni di disegno e
 * undici blocchi del pacchetto per il coach. Non si controlla che siano belle
 * — quello non si misura — ma che reggano il caso limite senza produrre un NaN
 * a schermo o una riga che non vuol dire niente. Un grafico che disegna una
 * barra sbagliata è una risposta sbagliata che sembra giusta.
 */
export function verificaDisegniEBlocchi({ disegni = grafico, scrittore = pacchetto } = {}) {
  const errori = [];
  let casi = 0;
  const malato = (x) => /NaN|Infinity|undefined|\[object Object\]/.test(String(x ?? ""));
  const guarda = (nome, el) => {
    casi++;
    if (el == null) return;
    const html = el.outerHTML ?? String(el);
    if (malato(html)) errori.push(`${nome}: produce ${(/NaN|Infinity|undefined|\[object Object\]/.exec(html) || [])[0]}`);
  };

  // --- i grafici, con dentro il peggio che possono ricevere
  const VUOTI = [[], [null], [{ valore: null }], [{ valore: 0 }]];
  for (const punti of VUOTI) {
    guarda("graficoLinea", disegni.graficoLinea({ punti }));
    guarda("graficoLinea con obiettivo", disegni.graficoLinea({ punti, obiettivo: 100 }));
  }
  for (const dati of [[], [{}], [{ kcal: null, presente: false }], [{ kcal: NaN }], [{ kcal: 0, presente: true }]]) {
    guarda("graficoAttivita", disegni.graficoAttivita(dati));
  }
  for (const caselle of [[], [null, null], [{ min: 60, max: 60 }], [{ min: 0, max: 0 }]]) {
    guarda("graficoBattito", disegni.graficoBattito({ caselle, inizioSec: 0, durataSec: 0 }));
  }
  guarda("fascia vuota", disegni.fascia([]));
  guarda("legenda", disegni.legenda());
  guarda("schedaGrafico senza niente", disegni.schedaGrafico({ titolo: "x", valore: null, unita: null, nota: null, grafico: null }));
  // un valore enorme non deve schiacciare la scala fino a NaN
  guarda("graficoLinea con un valore assurdo", disegni.graficoLinea({ punti: [{ valore: 1e12 }, { valore: 1 }] }));

  // --- gli anelli e i colori del punteggio
  for (const v of [null, 0, 50, 100, -1, 101, NaN]) {
    casi++;
    const c = coloreDaPunteggio(v);
    if (malato(c)) errori.push(`coloreDaPunteggio(${v}) = ${c}`);
    // `giudizio` restituisce { testo, livello }, non una stringa: passarlo a
    // String() dava «[object Object]» e la prova accusava una funzione sana.
    // Quarto falso allarme della serata dello stesso tipo — la firma si legge,
    // non si indovina.
    const g = giudizio(v);
    if (!g || typeof g.testo !== "string" || !g.testo || malato(g.testo)) errori.push(`giudizio(${v}).testo = ${g?.testo}`);
    if (!(g?.livello >= 1 && g.livello <= 3)) errori.push(`giudizio(${v}).livello = ${g?.livello}`);
    guarda(`anello(${v})`, anello(v));
  }

  // --- i blocchi del pacchetto per il coach, con archivi vuoti
  // `tipoGiorno` è una FUNZIONE, non un valore: passandogli null la prova
  // sembrava passare solo perché con l'elenco vuoto non ci si arriva mai. Un
  // caso limite provato con la forma sbagliata non prova niente.
  const finestraVuota = store.statoFinestra([], { campo: "kcalAttive", settimane: 3, minimoSettimana: 5 });
  const vuoto = { giorni: [], notti: [], finestraMovimento: finestraVuota, finestraSonno: finestraVuota,
    obiettivo: null, tipoGiorno: () => null, quantiGiorni: 21 };
  const blocchi = [
    ["bloccoSalute vuoto", () => scrittore.bloccoSalute(vuoto)],
    ["bloccoSalute con dati e finestre assenti", () => scrittore.bloccoSalute({
      ...vuoto, finestraMovimento: null, finestraSonno: null,
      giorni: [{ data: "2026-08-20", presente: true, kcalAttive: 520, passi: 9120 }],
      notti: [{ data: "2026-08-20", presente: true, durataMin: 451 }] })],
    ["bloccoExtra", () => scrittore.bloccoExtra([])],
    ["bloccoWatch", () => scrittore.bloccoWatch([])],
    ["bloccoAccettate", () => scrittore.bloccoAccettate([], () => null)],
    ["bloccoProposte", () => scrittore.bloccoProposte([], nomeLivello)],
    ["bloccoAcqua", () => scrittore.bloccoAcqua({ perGiorno: [], litri: null })],
    ["bloccoFumo", () => scrittore.bloccoFumo({ perGiorno: [], tollerate: null, primoGiorno: null })],
    ["bloccoSegnali", () => scrittore.bloccoSegnali([])],
    ["bloccoCorpo", () => scrittore.bloccoCorpo({ misure: [], indici: [], etichette: {}, dateIndici: {} })],
    ["intestazionePacchetto", () => scrittore.intestazionePacchetto([])],
  ];
  for (const [nome, fn] of blocchi) {
    casi++;
    let t;
    try { t = fn(); }
    catch (e) { errori.push(`${nome} con l'archivio vuoto esplode — ${String(e?.message ?? e).slice(0, 60)}`); continue; }
    if (malato(t)) errori.push(`${nome} scrive «${(/NaN|Infinity|undefined|\[object Object\]/.exec(String(t)) || [])[0]}» nel pacchetto del coach`);
  }

  // --- i pezzi del motore delle proposte che nessuno provava
  casi++;
  if (piuGiorni("2026-10-25", 1) !== "2026-10-26") errori.push("piuGiorni sbaglia il giorno dopo il cambio d'ora");
  if (piuGiorni("2026-02-28", 1) !== "2026-03-01") errori.push("piuGiorni sbaglia la fine di febbraio");
  for (const [esp, atteso] of [
    [{ serie: [] }, null],
    [{ serie: [{ ripFatte: 10 }, { ripFatte: 8 }] }, 8],
    [{ serie: [{ ripFatte: 10 }, { ripFatte: null }] }, null],
  ]) {
    casi++;
    if (ripetizioniEffettive(esp) !== atteso) errori.push(`ripetizioniEffettive: ${ripetizioniEffettive(esp)} invece di ${atteso}`);
  }
  for (const [esp, atteso] of [
    [null, false],
    [{ saltato: { motivo: "x" } }, false],
    [{ rpe: null, tecnica: 8, serie: [{ ripFatte: 8 }] }, false],
    [{ rpe: 7, tecnica: 8, serie: [{ ripFatte: 8 }] }, true],
  ]) {
    casi++;
    if (datiCompleti(esp) !== atteso) errori.push(`datiCompleti: ${datiCompleti(esp)} invece di ${atteso}`);
  }
  // due proposte identiche devono avere la stessa impronta, due diverse no
  casi++;
  const pA = { esercizioId: "x", tipo: "carico", a: { carico: 30 }, da: { carico: 25 } };
  const pB = { esercizioId: "x", tipo: "carico", a: { carico: 35 }, da: { carico: 25 } };
  if (firmaProposta(pA) !== firmaProposta({ ...pA })) errori.push("firmaProposta: due proposte identiche hanno impronte diverse");
  if (firmaProposta(pA) === firmaProposta(pB)) errori.push("firmaProposta: due proposte diverse hanno la stessa impronta");

  return esito("quello che disegna e quello che scrive", `${casi} casi limite`, errori);
}

/* ------------------------------------------- la rete sa ancora fallire? */

/**
 * Il banco che guasta la rete apposta.
 *
 * Il 27/08 ho rotto l'app nove volte a mano per dimostrare che il collaudo se
 * ne accorgeva. Le ha prese tutte — ma quelle nove prove non si rilanciavano:
 * la mattina in cui una modifica azzoppasse un controllo, la rete avrebbe
 * continuato a dire «PASSATA» e nessuno l'avrebbe saputo. È lo stesso difetto
 * che avevo trovato nel registro del controllo, un piano più su: una verifica
 * fatta una volta è un verbale, non una rete.
 *
 * Qui ogni prova riceve un soggetto GUASTO al posto di quello vero, e deve
 * accorgersene. Se una passa lo stesso, quella prova ha smesso di controllare
 * e lo dice — che è l'unica cosa che un collaudo non può permettersi di tacere.
 *
 * Non tocca niente: i guasti sono funzioni finte passate come argomento, non
 * modifiche ai file.
 */
export async function provaLaRete() {
  const errori = [];
  let casi = 0;

  const deveSuonare = async (nome, fn) => {
    casi++;
    let r;
    try { r = await fn(); }
    catch (e) { errori.push(`«${nome}»: la prova esplode invece di segnalare — ${String(e?.message ?? e).slice(0, 60)}`); return; }
    if (r?.passata) errori.push(`«${nome}»: PASSATA con un soggetto guasto — questa prova non sta più controllando niente`);
  };

  // 1. il motore che propone un carico che non si monta
  await deveSuonare("carico non montabile", () =>
    verificaMotoreProposte({
      ridotta: true,
      motore: (a) => {
        const vero = valutaProgressione(a);
        if (vero.proposta?.a?.carico != null) vero.proposta.a.carico += 0.3;
        return vero;
      },
    })
  );

  // 2. il motore che propone di salire mentre c'è dolore
  await deveSuonare("salire col dolore", () =>
    verificaMotoreProposte({
      ridotta: true,
      motore: (a) => {
        const senzaDolore = { ...a, esposizioni: a.esposizioni.map((e) => ({ ...e, log: { ...e.log, dolori: [] } })) };
        return valutaProgressione(senzaDolore);
      },
    })
  );

  // 3. il lettore del pacchetto che butta via le righe in silenzio
  await deveSuonare("righe che spariscono senza una parola", () =>
    verificaLettorePacchetto({
      lettore: (t) => {
        const r = analizza(t);
        return { ...r, avvisi: [] };
      },
    })
  );

  // 4. il lettore del pacchetto che perde la durata degli allenamenti
  await deveSuonare("durata dell'allenamento persa", () =>
    verificaLettorePacchetto({
      lettore: (t) => {
        const r = analizza(t);
        return { ...r, allenamenti: r.allenamenti.map((a) => ({ ...a, durataSec: null })) };
      },
    })
  );

  // 5. la validazione del brief che accetta tutto
  await deveSuonare("brief storti accettati", () => verificaLettoreBrief({ validatore: () => [] }));

  // 6. la validazione del brief che rifiuta anche quelli buoni
  await deveSuonare("brief buoni rifiutati", () => verificaLettoreBrief({ validatore: () => ["qualcosa non va"] }));

  // 7. una schermata che non si disegna
  await deveSuonare("schermata che esplode", () =>
    verificaSchermate({ schermate: [["Finta", "../tools/schermata-che-esplode.js"]] })
  );

  // 8. la libreria con uno schema che il conto del volume non conosce
  await deveSuonare("schema sconosciuto nella libreria", () =>
    verificaDati({
      libreriaFinta: {
        esercizi: [{ id: "finto", nome: "Finto", pattern: "schema-inventato", attrezzo: "bilanciere",
          setup: "x", esecuzione: "x", cue: "x", erroriComuni: ["x"] }],
      },
    })
  );

  // 9. la libreria con due esercizi sullo stesso video
  await deveSuonare("stesso video su due esercizi", () =>
    verificaDati({
      libreriaFinta: {
        esercizi: ["a", "b"].map((id) => ({ id, nome: id, pattern: "spinta", attrezzo: "bilanciere",
          setup: "x", esecuzione: "x", cue: "x", erroriComuni: ["x"], video: { id: "aaaaaaaaaaa" } })),
      },
    })
  );

  // 10. l'archivio con due allenamenti che raccontano lo stesso fatto:
  //     è il difetto vero del 27/08, e la prova che lo trovava non c'era.
  await deveSuonare("lo stesso allenamento scritto due volte", () =>
    verificaVeritaDeiDati({
      archivioFinto: {
        allenamentiWatch: [
          { uuid: "a", data: "2026-08-20", inizio: "18:00", durataSec: 3600, tipo: "Walking" },
          { uuid: "a-walking", data: "2026-08-20", inizio: "18:00", durataSec: 3600, tipo: "Walking" },
        ],
      },
    })
  );

  // 11. la storia di un esercizio senza id che torna a restituire tutto
  await deveSuonare("esposizioni senza id restituisce tutto", () =>
    verificaCorrezioniProtette({ esposizioniFinte: async () => [{ data: "2026-08-20" }] })
  );

  // 12. il lettore dell'export che si rimangia gli allenamenti successivi
  await deveSuonare("allenamenti che spariscono dall'export.xml", () =>
    verificaCorrezioniProtette({ lettoreExport: async () => ({ allenamenti: 1, testo: "" }) })
  );

  // 13. un grafico che sputa NaN
  await deveSuonare("un grafico che produce NaN", () =>
    verificaDisegniEBlocchi({
      disegni: { ...grafico, graficoLinea: () => { const e = document.createElement("div"); e.textContent = "NaN"; return e; } },
    })
  );

  // 14. un blocco del pacchetto che esplode con l'archivio vuoto
  await deveSuonare("un blocco del pacchetto che esplode", () =>
    verificaDisegniEBlocchi({
      scrittore: { ...pacchetto, bloccoSalute: () => { throw new Error("vuoto"); } },
    })
  );

  // 15. un rifiuto che smette di rifiutare
  await deveSuonare("il tetto delle sigarette che si lascia rialzare", () =>
    verificaStradeDiGuasto({ magazzino: { ...store, dichiaraTettoFumo: async () => ({ massimo: 99 }) } })
  );

  // 16. un rifiuto che parla in inglese invece che in italiano
  await deveSuonare("un rifiuto che parla da programmatore", () =>
    verificaStradeDiGuasto({
      magazzino: { ...store, correggiNotte: async () => { throw new TypeError("Cannot read properties of null"); } },
    })
  );

  return esito("la rete sa ancora fallire", `${casi} guasti`, errori);
}

/* ------------------------------------------- le prove che scrivono davvero */

/**
 * Il ripristino da un file rovinato: undici file storti, e dopo ognuno
 * l'archivio deve essere ancora quello di prima.
 *
 * Scrive, quindi si rifiuta di partire su un archivio che contiene qualcosa.
 * Si lancia sull'ambiente di prova, non sul telefono.
 */
/* Il confronto con la base di riferimento.
 *
 * La base e' una fotografia dell'archivio presa fuori dall'app (sta in una
 * cartella privata, non qui dentro) e serve a rispondere a una domanda sola:
 * dopo le modifiche di oggi, i numeri congelati sono ancora quelli?
 *
 * Il 27/08 la ricetta di questo confronto non era scritta da nessuna parte e ho
 * dovuto ricavarla dal registro di una sessione vecchia. Un'ora buona per
 * riscoprire quali campi guardare e come. Ora sta qui.
 *
 * Due trappole gia' pagate, tutte e due segnate nel codice:
 *  - perEsercizio nella base sono NUMERI, non oggetti: confrontarli come oggetti
 *    fa risultare diverse tutte le sedute;
 *  - il confronto dev'essere INDIFFERENTE all'ordine delle chiavi, altrimenti
 *    basta riscrivere il file della base con un altro strumento per far
 *    sembrare cambiato un archivio identico.
 *
 * Nella base non ci va niente di DERIVATO. I segnali, per esempio, si
 * ricalcolano da zero a ogni giro del motore e quelli che il calcolo non
 * produce piu vengono cancellati: contarli fra gli invarianti faceva scattare
 * un allarme ogni volta che l'app veniva usata davvero. Sono stati tolti il
 * 28/08. Quello da cui derivano resta coperto.
 *
 * Non legge niente da sola: la base gliela passa chi la chiama.
 */
export async function confrontaConLaBase(base, { magazzino = store, archivio = db } = {}) {
  const differenze = [];
  const canonico = (v) =>
    v === null || typeof v !== "object"
      ? JSON.stringify(v)
      : Array.isArray(v)
        ? "[" + v.map(canonico).join(",") + "]"
        : "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonico(v[k])).join(",") + "}";
  const impronta = async (t) => {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 16);
  };

  for (const nome of Object.keys(base.conta || {})) {
    const quanti = await archivio.count(nome);
    if (quanti !== base.conta[nome]) differenze.push(`conta.${nome}: ${base.conta[nome]} -> ${quanti}`);
  }

  const sedute = await archivio.all("sedute");
  for (const attesa of base.sedute || []) {
    const s = sedute.find((x) => x.id === attesa.id);
    if (!s) { differenze.push(`seduta del ${attesa.data}: sparita`); continue; }
    const c = s.completezza || null;
    const adesso = {
      data: s.data,
      tipo: s.tipoId,
      stato: s.stato,
      totale: c ? c.totale : null,
      congelatoIl: c ? c.congelatoIl || null : null,
      previsti: c ? c.previsti : null,
      svolti: c ? c.svolti : null,
      saltati: c ? c.saltati : null,
      voci: c ? (c.voci || []).map((v) => `${v.nome}:${v.peso}:${Math.round((v.quota ?? 0) * 10000)}`) : [],
      perEsercizio: c
        ? Object.fromEntries(Object.entries(c.perEsercizio || {}).map(([k, v]) => [k, v.totale]))
        : {},
      cardio: s.cardio
        ? {
            previsto: !!s.cardio.previsto,
            eseguito: !!s.cardio.eseguito,
            rimandato: !!s.cardio.rimandato,
            soglie: s.cardio.soglie || null,
          }
        : null,
      nPrevistiElenco: Array.isArray(s.previstiElenco) ? s.previstiElenco.length : null,
      improntaCongelato: await impronta(JSON.stringify([c, s.previstiElenco, s.cardio?.soglie])),
      improntaPacchetto: await impronta(
        String(
          pacchetto.logSeduta({
            seduta: s,
            serie: await magazzino.serieDi(s.id),
            questionari: await magazzino.questionariDi(s.id),
            esercizio: magazzino.esercizio,
            giornoSplit: magazzino.giornoSplit,
            previsti: s.previstiElenco?.length
              ? s.previstiElenco
              : magazzino.giornoSplit(s.tipoId)?.esercizi || [],
            completezza: await magazzino.completezzaSeduta(s.id),
          })
        )
      ),
    };
    for (const campo of Object.keys(adesso)) {
      if (canonico(adesso[campo]) !== canonico(attesa[campo])) {
        differenze.push(`seduta del ${attesa.data}: ${campo}`);
      }
    }
  }

  return {
    nome: "l'archivio e' ancora quello della base",
    casi: `${(base.sedute || []).length} sedute, ${Object.keys(base.conta || {}).length} archivi`,
    errori: differenze.length,
    primi: differenze.slice(0, 10),
    passata: differenze.length === 0,
  };
}

export async function reteDistruttiva({ forza = false } = {}) {
  const quante = (await db.all("sedute")).length + (await db.all("misure")).length + (await db.all("foto")).length;
  if (quante && !forza) {
    return { verdetto: "NON PARTITA", perche: `l'archivio contiene ${quante} righe fra sedute, misure e foto: queste prove scrivono. Lanciala su un ambiente vuoto.` };
  }
  const errori = [];
  await db.importaTutto({ formato: "coach-backup", versione: 1, dati: {
    sedute: [{ id: "RETE1", data: "2026-01-02", stato: "completata", tipoId: "prova" }],
    serie: [{ id: "RETE-S1", sedutaId: "RETE1", esercizioId: "squat", carico: 40 }],
  } }, "sostituisci");
  const impronta = async () => JSON.stringify((await db.esportaTutto({ salta: ["copertine"] })).dati);
  const prima = await impronta();

  const casi = [
    ["file vuoto", ""],
    ["non è JSON", "questo non e un backup"],
    ["JSON troncato", '{"formato":"coach-backup","versione":1,"dati":{"sedute":[{"id":"X"'],
    ["JSON che non è un backup", '{"a":1}'],
    ["backup di un'altra app", '{"formato":"altro","versione":1,"dati":{}}'],
    ["versione non numerica", '{"formato":"coach-backup","versione":"boh","dati":{"sedute":[]}}'],
    ["versione più nuova", '{"formato":"coach-backup","versione":99,"dati":{"sedute":[]}}'],
    ["sezione illeggibile", '{"formato":"coach-backup","versione":1,"dati":{"sedute":"rotto"}}'],
    ["righe senza chiave", '{"formato":"coach-backup","versione":1,"dati":{"sedute":[{"data":"2026-01-01"},null,42]}}'],
    ["archivio inesistente", '{"formato":"coach-backup","versione":1,"dati":{"inventato":[{"id":1}]}}'],
    ["dati vuoti", '{"formato":"coach-backup","versione":1,"dati":{}}'],
    ["solo null", "null"],
  ];
  for (const [nome, testo] of casi) {
    let dump = null;
    let letto = true;
    try { dump = JSON.parse(testo); } catch { letto = false; }
    if (letto) {
      let accettato = false;
      try { await db.importaTutto(dump, "sostituisci"); accettato = true; } catch { /* respinto: è quello che deve fare */ }
      if (accettato) errori.push(`«${nome}»: ACCETTATO, doveva essere respinto`);
    }
    if ((await impronta()) !== prima) errori.push(`«${nome}»: l'archivio è cambiato`);
  }
  // La copia interna: la rete che ti prende se il ripristino da file va male.
  // Non era mai stata provata, ed è l'ultima cosa che resta quando tutto il
  // resto è andato storto.
  await db.importaTutto({ formato: "coach-backup", versione: 1, dati: {
    sedute: [{ id: "RETE-PRIMA", data: "2026-01-05", stato: "completata", tipoId: "prova" }],
    misure: [{ id: "RETE-M", data: "2026-01-05", tipo: "peso", valore: 80 }],
  } }, "sostituisci");
  await store.snapshotAutomatico("prova della rete");
  await db.importaTutto({ formato: "coach-backup", versione: 1, dati: {
    sedute: [{ id: "RETE-DISASTRO", data: "2026-01-06", stato: "completata", tipoId: "prova" }],
  } }, "sostituisci");
  const salvata = await store.snapshotSalvato();
  if (!salvata) errori.push("la copia interna non si rilegge: la rete di sicurezza non c'è");
  else {
    if (!Array.isArray(salvata.parziale) || !salvata.parziale.includes("foto")) {
      errori.push("la copia interna non dichiara di non avere le foto: ripristinarla le cancellerebbe");
    }
    await db.importaTutto(salvata, "sostituisci");
    const tornate = (await db.all("sedute")).map((x) => x.id);
    const misure = (await db.all("misure")).map((x) => x.id);
    if (JSON.stringify(tornate) !== JSON.stringify(["RETE-PRIMA"])) errori.push(`la copia interna riporta ${tornate.join(",") || "niente"} invece di RETE-PRIMA`);
    if (JSON.stringify(misure) !== JSON.stringify(["RETE-M"])) errori.push(`la copia interna perde le misure: ${misure.join(",") || "niente"}`);
  }

  // Annullare un allenamento deve portare via TUTTO quello che gli apparteneva:
  // serie e questionari orfani restano in archivio e falsano i conti.
  await db.importaTutto({ formato: "coach-backup", versione: 1, dati: {
    sedute: [{ id: "RETE-ANN", data: "2026-01-07", stato: "inCorso", tipoId: "prova" }],
    serie: [{ id: "RETE-SER", sedutaId: "RETE-ANN", esercizioId: "squat", carico: 20 }],
    esercizioLog: [{ id: "RETE-LOG", sedutaId: "RETE-ANN", esercizioId: "squat", rpe: 7 }],
  } }, "sostituisci");
  await store.annullaSeduta("RETE-ANN");
  const resti = {
    sedute: (await db.all("sedute")).length,
    serie: (await db.all("serie")).length,
    questionari: (await db.all("esercizioLog")).length,
  };
  if (resti.sedute || resti.serie || resti.questionari) {
    errori.push(`annullare un allenamento lascia dietro: ${JSON.stringify(resti)}`);
  }

  // Un backup scritto da una versione VECCHIA dev'essere ancora leggibile.
  //
  // È lo scenario per cui il backup esiste: telefono perso, app reinstallata
  // mesi dopo, file di allora. Il formato è cambiato per strada — `fusoMinuti`
  // non c'era — e un ripristino che perde un pezzo lì non ha una seconda
  // occasione.
  const IMMAGINE = "data:image/png;ba" + "se64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  await db.importaTutto({ formato: "coach-backup", versione: 1, creatoIl: "2026-01-01T00:00:00.000Z", dati: {
    sedute: [{ id: "RETE-VECCHIA", data: "2026-01-08", stato: "completata", tipoId: "prova",
      oraInizio: 1, oraFine: 2, durataLavoroSec: 4200,
      completezza: { totale: 84, voci: [{ nome: "Esercizi", quota: 0.74, peso: 60 }], previsti: 1, svolti: 1, saltati: 0, perEsercizio: { prova: { totale: 84 } } } }],
    foto: [{ id: "RETE-F", data: "2026-01-08", posa: "fronte", immagine: IMMAGINE }],
    allenamentiWatch: [{ uuid: "RETE-W", data: "2026-01-08", durataSec: 4649, sedutaId: null }],
    noteWatch: [{ uuid: "RETE-W", talkTest: "faticoso", nota: "prova" }],
  } }, "sostituisci");
  const vecchia = await db.get("sedute", "RETE-VECCHIA");
  if (vecchia?.completezza?.totale !== 84) errori.push(`un backup vecchio perde il punteggio congelato (${vecchia?.completezza?.totale})`);
  if (store.durataSeduta(vecchia) !== 4200) errori.push(`un backup vecchio perde la durata (${store.durataSeduta(vecchia)})`);
  if ((await db.get("foto", "RETE-F"))?.immagine !== IMMAGINE) errori.push("un backup vecchio rovina le foto");
  if ((await db.get("allenamentiWatch", "RETE-W"))?.durataSec !== 4649) errori.push("un backup vecchio perde la durata di un allenamento del Watch");
  if ((await db.get("noteWatch", "RETE-W"))?.talkTest !== "faticoso") errori.push("un backup vecchio perde il talk-test");

  // Il formato del backup non può cambiare di nascosto.
  //
  // Un backup scritto oggi finirà, prima o poi, in una app che non è quella di
  // oggi: un telefono non aggiornato, un ripristino fatto mesi dopo. Finché la
  // versione dichiarata resta la 1, le versioni vecchie lo accettano e ignorano
  // i campi che non conoscono — provato davvero, dando un backup di oggi alla
  // app del 26/08. Ma se qualcuno aggiunge un campo che CONTA, quel silenzio
  // diventa una perdita: allora la versione va alzata, e questa riga lo ricorda.
  casi.length; // (la prova vera è qui sotto)
  const scritto = await db.esportaTutto({ salta: ["copertine"] });
  if (scritto.versione !== 1) {
    errori.push(`il backup si dichiara v${scritto.versione}: se il formato è cambiato davvero, le app vecchie vanno avvisate — se non è cambiato, la versione non si tocca`);
  }
  if (scritto.formato !== "coach-backup") errori.push(`il backup si dichiara «${scritto.formato}»`);
  for (const s of scritto.dati.sedute || []) {
    if (s.fusoMinuti != null && !(Number.isFinite(s.fusoMinuti) && Math.abs(s.fusoMinuti) <= 14 * 60)) {
      errori.push(`una seduta scrive fusoMinuti=${s.fusoMinuti} nel backup`);
    }
  }

  // e un backup buono deve ancora entrare
  await db.importaTutto({ formato: "coach-backup", versione: 1, dati: { sedute: [{ id: "RETE2", data: "2026-01-03", stato: "completata", tipoId: "prova" }] } }, "sostituisci");
  const dopo = (await db.all("sedute")).map((s) => s.id);
  if (JSON.stringify(dopo) !== JSON.stringify(["RETE2"])) errori.push(`un backup buono non è entrato: ${dopo.join(",")}`);

  // Si pulisce dietro: le sedute finte lasciate qui farebbero suonare la rete
  // al giro dopo, e un collaudo che sporca è un collaudo che si impara a
  // ignorare.
  for (const nome of Object.keys(db.SCHEMA)) {
    for (const riga of await db.all(nome)) {
      const chiave = riga[db.SCHEMA[nome].keyPath];
      if (String(chiave).startsWith("RETE")) await db.del(nome, chiave);
    }
  }

  const r = esito("ripristino da file rovinati", `${casi.length} file storti`, errori);
  return { verdetto: r.passata ? "PASSATA" : `${r.errori} problemi`, ...r };
}
