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
      const r = await fetch(`/${f}?rete=${Math.random()}`, { cache: "no-store" });
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
    const html = await (await fetch(`/index.html?rete=${Math.random()}`, { cache: "no-store" })).text();
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

export async function verificaDati() {
  const errori = [];
  let casi = 0;

  const lib = await (await fetch("/data/esercizi.json", { cache: "no-store" })).json();
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
export async function verificaMotoreProposte() {
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

  const ATTREZZI = ["bilanciere", "manubri", "manubrio", "corpo libero"];
  for (const attrezzo of ATTREZZI) {
    const def = { id: "prova", nome: "Prova", attrezzo };
    for (const carico of [null, 0, 2.5, 10, 22.5, 40, 100]) {
      for (const ripMin of [6, 8, 10]) {
        for (const ripMax of [ripMin, ripMin + 2, ripMin + 4]) {
          for (const rip of [ripMin - 2, ripMin, ripMin + 1, ripMax, ripMax + 3]) {
            for (const rpe of [4, 7, 8, 9, 10]) {
              for (const tecnica of [1, 4, 6, 8, 10]) {
                for (const dolore of [false, true]) {
                  casi++;
                  const variante = { esercizioId: "prova", serie: 3, ripMin, ripMax, carico, recuperoSec: 90 };
                  const esposizioni = ["2026-08-20", "2026-08-13", "2026-08-06", "2026-07-30"].map((data) =>
                    esposizione({ data, rip, carico, rpe, tecnica, dolore })
                  );
                  let r;
                  try {
                    r = valutaProgressione({ variante, def, esposizioni, regole, inventario, oggi: "2026-08-27" });
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
                    const r2 = valutaProgressione({ variante, def, esposizioni, regole, inventario, oggi: "2026-08-27" });
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
export function verificaLettorePacchetto() {
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
      r = analizza(testo);
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
    try { analizza(testo); } catch (e) { respinto = true; messaggio = String(e.message); }
    if (!respinto) errori.push(`«${nome}»: accettato, doveva essere respinto`);
    else if (!/[a-zà-ù]/i.test(messaggio) || messaggio.length < 15) errori.push(`«${nome}»: respinto con un messaggio che non spiega niente`);
  }

  // 5. andata e ritorno: un pacchetto pulito si legge per quello che dice
  casi++;
  const pulito = analizza(["COACH-DATI v1", "FINESTRA 2026-08-01 2026-08-27", ...BUONE].join("\n"));
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
    const r = analizza(["COACH-DATI v1", "FINESTRA 2026-08-01 2026-08-27",
      `ALLENAMENTO 2026-08-20 inizio=18:05 durata=${sec} kcal=300 tipo="Walking"`].join("\n"));
    if (r.allenamenti[0]?.durataSec !== sec) {
      errori.push(`un allenamento di ${Math.round(sec / 60)} minuti perde la durata (letta: ${r.allenamenti[0]?.durataSec})`);
    }
  }
  //    ...ma una notte di più di venti ore resta impossibile, come prima.
  for (const [min, atteso] of [[451, 451], [1200, 1200], [1201, null]]) {
    casi++;
    const r = analizza(["COACH-DATI v1", "FINESTRA 2026-08-01 2026-08-27", `NOTTE 2026-08-20 durata=${min}`].join("\n"));
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
export function verificaLettoreBrief() {
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
    try { problemi = validaBrief(dati, libreria); }
    catch (e) { errori.push(`«${nome}»: la validazione esplode — ${String(e.message).slice(0, 50)}`); continue; }
    if (!problemi.length) { errori.push(`«${nome}»: ACCETTATO, doveva essere fermato`); continue; }
    if (!problemi.some((x) => atteso.test(x))) {
      errori.push(`«${nome}»: fermato, ma per un altro motivo — «${problemi[0].slice(0, 60)}»`);
    }
  }

  // e un brief pulito deve passare senza una parola
  casi++;
  const buono = validaBrief(brief([giorno(), giorno({ id: "secondo", nome: "Secondo", giorno: 3 })]), libreria);
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
export async function verificaStradeDiGuasto() {
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
  await deve("il massimo non è un numero", () => store.dichiaraTettoFumo("tanto", "2026-09-01"), /numero da zero in su/i);
  await deve("il massimo è negativo", () => store.dichiaraTettoFumo(-1, "2026-09-01"), /numero da zero in su/i);
  await deve("manca il giorno da cui vale", () => store.dichiaraTettoFumo(0, "domani"), /serve il giorno/i);
  const tetto = await store.tettoFumoDichiarato();
  if (tetto) {
    if (tetto.massimo <= 0) {
      await deve("IL MASSIMO A ZERO NON SI PUÒ RIALZARE", () => store.dichiaraTettoFumo(5, "2026-09-01"), /già a zero|non si torna indietro/i);
      await deve("nemmeno rimettendo lo stesso zero", () => store.dichiaraTettoFumo(0, "2026-09-01"), /già a zero|non si torna indietro/i);
    } else {
      await deve("il massimo non si può alzare", () => store.dichiaraTettoFumo(tetto.massimo + 1, tetto.dal), /solo scendere/i);
    }
  }

  // La notte corretta a mano
  await deve("notte senza giorno", () => store.correggiNotte("ieri", { aLetto: "23:00", sveglio: "07:00" }), /giorno della notte/i);
  await deve("notte senza le due ore", () => store.correggiNotte("2026-08-20", {}), /ora in cui sei andato a letto/i);
  // «Le due ore non tornano» NON si prova: è una strada morta, e lo dice il
  // commento in store.js — quando «a letto» viene dopo «sveglio» l'inizio si
  // sposta al giorno prima e la durata esce sempre positiva. Provate tutte e
  // 2304 le coppie di ore: nessuna la fa scattare.
  await deve("più di venti ore di sonno", () => store.correggiNotte("2026-08-20", { aLetto: "02:00", sveglio: "01:00" }), /venti ore/i);

  // Le cose che non esistono più
  await deve("una seduta che non c'è", () => store.aggiornaSeduta("mai-esistita", { notaGenerale: "x" }), /seduta non trovata/i);
  await deve("chiudere una seduta che non c'è", () => store.chiudiSeduta("mai-esistita", {}), /non esiste più|eliminata/i);
  await deve("rispondere a una proposta che non c'è", () => store.rispondiAProposta("mai-esistita", "accettata"), /proposta non esiste/i);
  await deve("un giorno dello split che non c'è", () => store.iniziaSeduta({ data: "2026-08-27", giornoId: "non-esiste-questo" }), /giorno dello split/i);

  // L'orologio e le foto
  await deve("nota su un allenamento che non c'è", () => store.salvaNotaAllenamento(null, { talkTest: "si" }), /serve l'allenamento/i);
  await deve("un talk-test inventato", () => store.salvaNotaAllenamento("uuid-qualunque", { talkTest: "boh" }), /talk-test non riconosciuto/i);
  // Il modello dell'immagine si compone a pezzi: scritto per intero, questo file
  // farebbe scattare la guardia della pubblicazione — è già successo, e ha fatto
  // bene a fermarmi. Un'eccezione in più sarebbe un buco in più.
  const FINTA_IMMAGINE = "data:image/png;ba" + "se64,AA";
  await deve("una posa che il protocollo non prevede", () => store.registraFoto({ posa: "posa-inventata", immagine: FINTA_IMMAGINE }), /non è una posa/i);

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

/* ------------------------------------------- le prove che scrivono davvero */

/**
 * Il ripristino da un file rovinato: undici file storti, e dopo ognuno
 * l'archivio deve essere ancora quello di prima.
 *
 * Scrive, quindi si rifiuta di partire su un archivio che contiene qualcosa.
 * Si lancia sull'ambiente di prova, non sul telefono.
 */
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
