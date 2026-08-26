/* Avvio, routing, aggiornamenti. */

import { h, qs, qsa, clear, toast, chiudiFogli, foglioAperto } from "./ui.js";
import * as store from "./store.js";

const ROTTE = {
  oggi: () => import("./screens/oggi.js"),
  seduta: () => import("./screens/seduta.js"),
  corpo: () => import("./screens/corpo.js"),
  salute: () => import("./screens/salute.js"),
  fumo: () => import("./screens/fumo.js"),
  storico: () => import("./screens/storico.js"),
  allenamenti: () => import("./screens/allenamenti.js"),
  proposte: () => import("./screens/proposte.js"),
  acqua: () => import("./screens/acqua.js"),
  export: () => import("./screens/export.js"),
  impostazioni: () => import("./screens/impostazioni.js"),
};

const view = qs("#view");
let rottaCorrente = null;

/* Il tema è uno solo.

   Prima ce n'erano tre: chiaro di sistema, scuro di sistema e «nero e lime»,
   con un interruttore in Impostazioni e un colore del punteggio che si
   ricalcolava a ogni tramonto per restare leggibile sul fondo nuovo. Adesso
   l'app ha un fondo solo — carta calda — e i colori non dipendono più da
   quello che fa l'iPhone: niente attributo di tema, niente ricalcolo, niente
   ridisegno a metà allenamento perché fuori è calato il buio. */

function nomeRotta() {
  const raw = location.hash.replace(/^#\/?/, "").split("?")[0];
  return ROTTE[raw] ? raw : "oggi";
}

export function vaiA(rotta) {
  location.hash = `#/${rotta}`;
}

let modCorrente = null;
/* Un aggiornamento arrivato mentre sei DENTRO l'allenamento resta in attesa:
   si applica appena esci da quella schermata. Prima la condizione era «finché
   esiste una seduta aperta»: bastava un allenamento cominciato e mai chiuso —
   capita — perché il telefono non prendesse più nessun aggiornamento, per
   sempre. Quello che si perderebbe ricaricando (schermata, cronometro, gesto
   che ha sbloccato l'audio) esiste solo mentre la seduta è sotto gli occhi. */
let aggiornamentoInAttesa = false;

/**
 * Sto scrivendo qualcosa che ricaricare porterebbe via?
 *
 * Un aggiornamento che arriva fuori dall'allenamento ricarica la pagina
 * **subito**: se in quel momento c'è un pannello aperto — le misure di Corpo,
 * una nota, il motivo di un salto — quello che è stato scritto e non ancora
 * salvato sparisce sotto le dita, senza che nessuno abbia toccato niente. Non
 * capita spesso, ma capita esattamente quando fa più danno: mentre stai
 * scrivendo. In quel caso l'aggiornamento si mette in attesa come già fa
 * dentro la seduta, e entra al primo cambio di schermata.
 */
function stoScrivendo() {
  if (foglioAperto()) return true;
  const el = document.activeElement;
  if (!el) return false;
  const scrivibile = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
  if (!scrivibile) return false;
  return String(el.value ?? el.textContent ?? "").trim() !== "";
}

let hashDisegnato = null;

/* Dove eri arrivato, schermata per schermata — e da dove sei venuto.

   Toccare una riga e tornare indietro riportava sempre in cima: dalla Home si
   apriva una camminata del Watch e, tornando, bisognava riscorrere mezza
   pagina per ritrovare il punto. La posizione si segna quando si esce da una
   schermata e si rimette quando ci si torna — la chiave è l'indirizzo intero,
   così l'elenco degli allenamenti e il dettaglio di uno hanno due posizioni
   diverse.

   **Tutto questo vive in `sessionStorage`, non in memoria.** Sembra un
   dettaglio e invece è il punto: quando arriva una versione nuova, l'app si
   ricarica da sola alla prima navigazione. Con la memoria di prima la ricarica
   cancellava sia le posizioni sia la strada percorsa — e siccome la ricarica
   avviene proprio mentre stai aprendo qualcosa, il risultato era esattamente
   il difetto che si vedeva: apri un allenamento dalla Home, torni indietro, e
   ti ritrovi sull'elenco degli allenamenti con la Home dimenticata. Salvate
   qui, ricarica e ripresa non si vedono nemmeno.

   La pila serve anche a un'altra cosa: «Indietro» torna DA DOVE SEI VENUTO.
   Prima si appoggiava alla storia del browser, che una ricarica azzera. */
const CHIAVE_NAV = "coach-navigazione";
const MAX_POSIZIONI = 60;
const MAX_PILA = 20;

const nav = (() => {
  try {
    const grezzo = JSON.parse(sessionStorage.getItem(CHIAVE_NAV) || "null");
    if (grezzo && typeof grezzo === "object") {
      return { pos: grezzo.pos || {}, pila: Array.isArray(grezzo.pila) ? grezzo.pila : [] };
    }
  } catch {
    /* niente sessionStorage (navigazione privata): si resta in memoria */
  }
  return { pos: {}, pila: [] };
})();

function salvaNav() {
  try {
    sessionStorage.setItem(CHIAVE_NAV, JSON.stringify(nav));
  } catch {
    /* se non si può scrivere, la memoria di questa sessione basta lo stesso */
  }
}

function segnaPosizione(hash, y) {
  if (!hash) return;
  const chiavi = Object.keys(nav.pos);
  if (chiavi.length >= MAX_POSIZIONI && !(hash in nav.pos)) delete nav.pos[chiavi[0]];
  nav.pos[hash] = y;
}

/** La strada percorsa: serve a «Indietro», e non deve gonfiarsi all'infinito. */
function segnaPassaggio(hash) {
  if (!hash) return;
  if (nav.pila[nav.pila.length - 1] === hash) return;
  nav.pila.push(hash);
  while (nav.pila.length > MAX_PILA) nav.pila.shift();
}

function rimettiPosizione(y, turno) {
  const v = scorritore();
  v.scrollTop = y;
  aggiornaOmbraTestata();
  if (!y) return;

  /* Rimettere la posizione una volta sola non basta.

     Il contenuto continua a crescere dopo il primo disegno — i grafici in SVG
     prendono le loro misure, le miniature arrivano, il calendario si riempie —
     e finché la pagina è più corta della posizione da rimettere, il browser
     tronca lo scorrimento a quanto c'è. Su un telefono lento questo può durare
     quasi un secondo, cioè molto più dei due tentativi a tempo fisso che
     c'erano prima.

     Qui si guarda l'altezza vera: finché cambia, si rimette. Al primo dito che
     tocca lo schermo si smette, perché da quel momento la posizione la decidi
     tu e non l'app. */
  let fermo = false;
  const metti = () => {
    if (fermo || turno !== turnoCorrente) return;
    if (Math.abs(v.scrollTop - y) > 2) v.scrollTop = y;
    aggiornaOmbraTestata();
  };
  const basta = () => {
    fermo = true;
    osservatore?.disconnect();
  };

  let osservatore = null;
  try {
    osservatore = new ResizeObserver(metti);
    osservatore.observe(v.firstElementChild || v);
  } catch {
    /* senza ResizeObserver restano i tentativi a tempo qui sotto */
  }
  requestAnimationFrame(metti);
  for (const quando of [60, 180, 400, 700, 1000]) setTimeout(metti, quando);
  setTimeout(basta, 1300);
  for (const evento of ["touchstart", "wheel", "pointerdown"]) {
    v.addEventListener(evento, basta, { once: true, passive: true });
  }
}

/* Il tasto «Indietro» torna DA DOVE SEI VENUTO, non a una schermata decisa in
   partenza: aprendo una camminata dalla Home riportava all'elenco degli
   allenamenti, cioè in un posto in cui non eri mai stato.

   Non usa `history.back()`: la storia del browser si azzera a ogni ricarica —
   e l'app si ricarica da sola quando arriva una versione nuova — mentre la
   pila qui sopra sopravvive. La rotta di ripiego serve solo se la pila è
   vuota davvero, cioè se quella schermata è la prima che hai aperto. */
let tornandoIndietro = false;

export function indietro(rottaDiRipiego = "oggi") {
  tornandoIndietro = true;
  let meta = null;
  while (nav.pila.length) {
    const passo = nav.pila.pop();
    if (passo && passo !== location.hash) {
      meta = passo;
      break;
    }
  }
  salvaNav();
  const destinazione = meta || `#/${rottaDiRipiego}`;
  if (destinazione === location.hash) {
    tornandoIndietro = false;
    return;
  }
  location.hash = destinazione;
}

/**
 * L'ombra sotto la testata quando il contenuto scorre.
 *
 * Un ascoltatore solo, messo una volta sul contenitore che scorre: prima ne
 * veniva creato uno a ogni disegno, agganciato alla testata di quel momento, e
 * bastava un ridisegno perché l'ombra restasse accesa su una barra ferma in
 * cima.
 */
export function aggiornaOmbraTestata() {
  const bar = qs(".topbar");
  if (bar) bar.classList.toggle("scrolled", scorritore().scrollTop > 4);
}

/** Il contenitore che scorre davvero: non è più la pagina, è «#view». */
function scorritore() {
  return qs("#view") || document.scrollingElement || document.documentElement;
}

/** Riporta la pagina in cima, con l'animazione dove il browser la fa. */
export function inCima() {
  const v = scorritore();
  try {
    v.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    v.scrollTop = 0;
  }
  setTimeout(() => {
    if (v.scrollTop > 0) v.scrollTop = 0;
  }, 400);
}

let turnoCorrente = 0;

export async function ridisegna() {
  const mioTurno = ++turnoCorrente;
  const nome = nomeRotta();
  // Cambio di schermata: un pannello aperto non deve sopravvivere alla pagina
  // che l'ha aperto.
  const cambioSchermata = hashDisegnato === null || hashDisegnato !== location.hash;
  const hashPrecedente = hashDisegnato;
  // La posizione della schermata che sta per sparire si segna ADESSO, prima di
  // qualunque attesa.
  //
  // Segnarla in fondo, appena prima di sostituire il contenuto, sembrava più
  // naturale e invece perdeva un caso preciso: la primissima volta che si apre
  // una schermata il suo file va caricato, e in quel mezzo secondo può partire
  // un secondo disegno. Il primo — quello che avrebbe segnato la posizione —
  // si ferma al controllo del sorpasso senza arrivare in fondo, e il secondo
  // non vede più nessun cambio di schermata, quindi non segna niente. Risultato
  // visto davvero: dalla Home si apriva un allenamento del Watch, si tornava
  // indietro e la Home ripartiva da cima — ma **solo la prima volta**, perché
  // dalla seconda il file era già in memoria e il disegno arrivava in fondo.
  //
  // Qui il DOM è ancora quello vecchio e il suo scorrimento è quello vero.
  if (cambioSchermata && hashPrecedente) {
    segnaPosizione(hashPrecedente, scorritore().scrollTop);
    // Tornando indietro non si segna il passaggio, se no si rimbalza fra due
    // schermate: si esce da A verso B, e da B «Indietro» riporterebbe ad A che
    // però è appena stata rimessa nella pila.
    if (!tornandoIndietro) segnaPassaggio(hashPrecedente);
    salvaNav();
  }
  tornandoIndietro = false;
  if (hashDisegnato !== null && cambioSchermata) chiudiFogli();
  hashDisegnato = location.hash;
  if (nome === "fumo" && store.regole().salute?.contaSigarette === false) {
    location.hash = "#/oggi";
    return;
  }
  if (nome === "acqua" && store.regole().salute?.contaAcqua !== true) {
    location.hash = "#/oggi";
    return;
  }
  rottaCorrente = nome;

  // Aggiornamento rimasto in attesa: si applica appena si esce dalla schermata
  // dell'allenamento, senza chiedere che la seduta sia anche chiusa.
  //
  // Va fatto PRIMA di caricare il modulo della schermata. Il comando è già
  // passato alla versione nuova: il file della schermata arriverebbe nuovo
  // mentre ui.js e store.js restano quelli vecchi già in memoria. Se la
  // versione nuova importa da lì un nome che prima non esisteva, il caricamento
  // fallisce, si finisce sulla schermata «questa sezione non si è caricata» e
  // la riga qui sotto non viene mai raggiunta: l'aggiornamento non entra più e
  // «Riprova» rifà lo stesso errore, per sempre.
  //
  // E non nel mezzo di un tocco su un dettaglio: l'aggiornamento arriva
  // quando arriva, ma ricaricare proprio mentre apri una camminata del Watch
  // vuol dire farti aspettare due secondi con lo schermo bianco al posto della
  // schermata che hai chiesto. Un indirizzo con un «?» dentro è un dettaglio:
  // si aspetta la prossima navigazione a una schermata intera, che arriva
  // sempre poco dopo.
  if (
    aggiornamentoInAttesa &&
    nome !== "seduta" &&
    !location.hash.includes("?") &&
    !stoScrivendo()
  ) {
    aggiornamentoInAttesa = false;
    location.reload();
    return;
  }

  let mod;
  try {
    mod = await ROTTE[nome]();
  } catch (e) {
    // Il modulo di una schermata può non arrivare: rete caduta a metà, file
    // non ancora in cache. Senza questo la sezione restava irraggiungibile
    // per sempre, senza nessun messaggio.
    console.error("caricamento di", nome, e);
    if (mioTurno !== turnoCorrente) return;
    clear(view);
    view.append(
      h(
        "div.screen",
        intestazione("Coach"),
        h(
          "div.empty",
          h("h3", "Questa sezione non si è caricata"),
          h("p", "Probabilmente manca la connessione e il file non è ancora nella copia locale."),
          h(
            "div.btn-wrap",
            h("button.btn", { onclick: () => ridisegna() }, "Riprova"),
            h("div", { style: "height:8px" }),
            h("button.btn.secondary", { onclick: () => vaiA("oggi") }, "Torna alla Home")
          )
        )
      )
    );
    qs("#tabbar").classList.remove("hidden");
    return;
  }

  // Il modulo si carica in tempi diversi a seconda della dimensione: due tocchi
  // ravvicinati possono risolversi in ordine inverso. Chi è stato sorpassato si
  // ferma QUI, prima di toccare qualunque cosa: più avanti avrebbe già spento i
  // timer di una schermata viva o acceso quelli di una che non si vedrà mai.
  if (mioTurno !== turnoCorrente) return;

  // Una schermata che se ne va deve spegnere quello che ha acceso: senza
  // questo, i timer dell'allenamento restano vivi in sottofondo a ogni
  // cambio di scheda e possono suonare da soli.
  if (modCorrente && modCorrente !== mod) {
    try {
      modCorrente.pulisci?.();
    } catch (e) {
      console.error("pulizia schermata", e);
    }
  }
  modCorrente = mod;

  if (mioTurno !== turnoCorrente) return;

  let nodo;
  try {
    nodo = await mod.render({ vaiA, ridisegna });
  } catch (e) {
    // Una schermata che va in errore non deve lasciare la pagina precedente:
    // sembrerebbe che il tocco non abbia funzionato, e quella sezione
    // resterebbe irraggiungibile finché non si riavvia l'app.
    console.error("disegno di", nome, e);
    nodo = h(
      "div.screen",
      intestazione(nome === "oggi" ? "Home" : nome[0].toUpperCase() + nome.slice(1)),
      h(
        "div.empty",
        h("h3", "Questa schermata non si è aperta"),
        h("p", e?.message || "Errore sconosciuto."),
        h(
          "div.btn-wrap",
          h("button.btn", { onclick: () => ridisegna() }, "Riprova"),
          h("div", { style: "height:8px" }),
          h("button.btn.secondary", { onclick: () => vaiA("oggi") }, "Torna alla Home")
        )
      )
    );
  }

  // Un disegno più lento non deve coprire quello partito dopo. Se è successo,
  // la schermata giusta viene ridisegnata: il render sorpassato può aver
  // lasciato acceso qualcosa.
  if (mioTurno !== turnoCorrente) {
    try {
      mod.pulisci?.();
    } catch {
      /* niente */
    }
    return;
  }

  const posizione = scorritore().scrollTop;
  clear(view);
  view.append(nodo);
  // Ridisegnare la stessa schermata (freccia del mese, selettore del periodo)
  // non è una navigazione: la pagina deve restare dov'era.
  if (cambioSchermata) rimettiPosizione(nav.pos[location.hash] || 0, mioTurno);
  else scorritore().scrollTop = posizione;
  aggiornaOmbraTestata();

  // La sezione Fumo esiste solo per chi conta le sigarette. Chi non fuma la
  // dichiara nel brief («salute.contaSigarette: false») e non se la ritrova
  // fra i piedi: una scheda che non riguarda nessuno è solo rumore.
  const contaFumo = store.regole().salute?.contaSigarette !== false;
  const contaAcqua = store.regole().salute?.contaAcqua === true;
  // Corpo e Storico si aprono da dentro Salute e non hanno una scheda loro:
  // senza questa riga la barra resterebbe spenta del tutto, e sembrerebbe di
  // essere finiti fuori dall'app.
  const schedaAccesa = { corpo: "salute", storico: "salute" }[nome] || nome;
  for (const a of qsa(".tabbar a")) {
    a.classList.toggle("active", a.dataset.tab === schedaAccesa);
    if (a.dataset.tab === "fumo") a.classList.toggle("hidden", !contaFumo);
    if (a.dataset.tab === "acqua") a.classList.toggle("hidden", !contaAcqua);
  }
  qs("#tabbar").classList.toggle("hidden", Boolean(mod.nascondiTabBar));
}

/** Intestazione grande in stile iOS, con ombra allo scroll. */
// Profilo calcolato: 8 denti simmetrici, non disegnato a mano.
const INGRANAGGIO =
  "M9.84 4.92 L9.88 2.02 L14.12 2.02 L14.16 4.92 L15.47 5.47 L17.56 3.45 L20.55 6.44 L18.53 8.53 L19.08 9.84 L21.98 9.88 L21.98 14.12 L19.08 14.16 L18.53 15.47 L20.55 17.56 L17.56 20.55 L15.47 18.53 L14.16 19.08 L14.12 21.98 L9.88 21.98 L9.84 19.08 L8.53 18.53 L6.44 20.55 L3.45 17.56 L5.47 15.47 L4.92 14.16 L2.02 14.12 L2.02 9.88 L4.92 9.84 L5.47 8.53 L3.45 6.44 L6.44 3.45 L8.53 5.47 Z";

export function intestazione(titolo, azione) {
  const bottone = azione
    ? azione.icona === "ingranaggio"
      ? h(
          "button.bar-action",
          { onclick: azione.onclick, "aria-label": azione.etichetta || "Impostazioni", style: "padding:6px 0 2px" },
          h(
            "svg",
            {
              viewBox: "0 0 24 24", width: 24, height: 24, fill: "none",
              stroke: "currentColor", "stroke-width": 1.7,
              "stroke-linecap": "round", "stroke-linejoin": "round",
              "aria-hidden": "true", style: "display:block",
            },
            h("circle", { cx: 12, cy: 12, r: 3 }),
            h("path", { d: INGRANAGGIO })
          )
        )
      : h("button.bar-action", { onclick: azione.onclick }, azione.etichetta)
    : null;

  const bar = h("header.topbar", h("h1", titolo), bottone);
  return bar;
}

// ---------- aggiornamenti ----------

async function registraServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;
  // ?nosw serve in sviluppo: niente cache, così le modifiche si vedono subito.
  //
  // Solo in locale, però. Sul sito pubblicato quell'indirizzo disinstalla il
  // service worker e svuota tutte le cache: chi lo aprisse dal telefono — un
  // collegamento salvato, un indirizzo copiato male — resterebbe senza copia
  // offline, e senza rete l'app non si aprirebbe più. In palestra o in
  // vacanza è il posto peggiore per accorgersene, e non c'è modo di rimediare
  // finché non torna la linea. Qui non serve a nessuno: fuori da localhost si
  // ignora e basta.
  const inLocale = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(location.hostname);
  if (inLocale && location.search.includes("nosw")) {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    return;
  }
  try {
    // updateViaCache: "none" impedisce al browser di servire dalla cache HTTP
    // proprio il file che decide gli aggiornamenti. Senza, GitHub Pages lo
    // tiene per dieci minuti e il telefono non si accorge delle novità.
    const reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
    // Senza rete `update()` rifiuta, ed è la normalità: in palestra il telefono
    // spesso non ha campo. Va ignorato in silenzio — l'app funziona offline e
    // il controllo si rifà da solo alla prossima apertura.
    const controlla = () => reg.update().catch(() => {});
    controlla();

    // ricontrolla quando l'app torna in primo piano: su iPhone l'app viene
    // ripresa dalla memoria e senza questo non ci sarebbe nessun controllo
    let ultimoControllo = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimoControllo < 30_000) return;
      ultimoControllo = Date.now();
      controlla();
    });
    // Quando la nuova versione prende il comando, la pagina si ricarica una
    // volta sola: così i moduli già in memoria non restano quelli vecchi.
    // Al primissimo avvio non c'è nessuna versione vecchia da sostituire: il
    // service worker prende il comando per la prima volta e ricaricare
    // sarebbe solo un lampo bianco all'apertura dell'app.
    let avevaControllore = Boolean(navigator.serviceWorker.controller);
    let ricaricato = false;
    navigator.serviceWorker.addEventListener("controllerchange", async () => {
      // Vale solo per il PRIMO passaggio di comando (la prima installazione):
      // da lì in poi ogni cambio è un aggiornamento vero e va ricaricato.
      if (!avevaControllore) {
        avevaControllore = true;
        return;
      }
      if (ricaricato) return;
      // Mai ricaricare mentre stai guardando l'allenamento: si perderebbe la
      // schermata in corso, il timer e il gesto che ha autorizzato l'audio.
      // Fuori di lì non c'è niente da salvare e l'aggiornamento entra subito.
      if (rottaCorrente === "seduta" || stoScrivendo()) {
        aggiornamentoInAttesa = true;
        return;
      }
      ricaricato = true;
      location.reload();
    });
  } catch {
    /* in locale senza https il service worker può non registrarsi: non è un errore bloccante */
  }
}

// ---------- avvio ----------

async function avvia() {
  try {
    await store.init();
  } catch (e) {
    clear(view).append(
      h(
        "div.empty",
        h("h3", "Archivio non accessibile"),
        h("p", e.message),
        h("p", "Se stai usando la navigazione privata, i dati non possono essere salvati.")
      )
    );
    return;
  }

  // Rete di sicurezza per i tocchi che non passano da `unaVoltaSola` o da
  // `azione`, che un messaggio loro ce l'hanno già.
  //
  // Quasi ogni tocco finisce in archivio, e se l'archivio non risponde —
  // un'altra scheda che ha aggiornato l'app, la navigazione privata, lo spazio
  // finito — l'errore usciva dal gestore e non succedeva NIENTE: nessun
  // messaggio, il tasto sembrava rotto, e non c'era modo di sapere se il dato
  // fosse stato salvato. Stessa frase degli altri due, perché per chi legge è
  // la stessa cosa.
  window.addEventListener("unhandledrejection", (e) => {
    const messaggio = e.reason?.message || String(e.reason || "");
    if (!messaggio) return;
    e.preventDefault();
    console.error(e.reason);
    toast(`Qualcosa non ha funzionato: ${messaggio}`, 5000);
  });

  window.addEventListener("hashchange", ridisegna);

  // L'app resta aperta per giorni: senza questo, a mezzanotte «oggi» resta
  // ieri finché non si ricarica, e la Home propone l'allenamento sbagliato.
  let giornoDisegnato = new Date().toDateString();
  const seCambiatoGiorno = () => {
    const adesso = new Date().toDateString();
    if (adesso === giornoDisegnato) return;
    // Dentro un allenamento no. Ridisegnare rifà la schermata da capo e quello
    // che hai scritto e non ancora salvato — la nota del questionario, il
    // motivo di un salto — sparisce sotto le dita. E non serve a niente: la
    // seduta ha già la sua data, quella di quando è cominciata, e non cambia a
    // mezzanotte. Il giorno si aggiorna appena esci dall'allenamento.
    if (rottaCorrente === "seduta") return;
    giornoDisegnato = adesso;
    ridisegna();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") seCambiatoGiorno();
  });
  // Anche a schermo acceso: allenandoti a cavallo di mezzanotte l'app restava
  // a ieri, e il tocco su «visibilitychange» non arrivava mai perché non
  // uscivi mai dall'app.
  setInterval(seCambiatoGiorno, 60000);

  // Toccare la scheda in cui sei già riporta in cima, come nelle app di
  // sistema. Se invece sei dentro un dettaglio, il tocco torna all'elenco:
  // in quel caso è il cambio di indirizzo a fare il lavoro.
  qs("#tabbar").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-tab]");
    if (!a || a.getAttribute("href") !== location.hash) return;
    e.preventDefault();
    inCima();
  });
  // Niente sblocco audio qui: all'apertura l'app deve restare muta. Lo fa la
  // schermata dell'allenamento, al primo tocco dentro la seduta.

  await ridisegna();
  // Un ascoltatore solo per tutta la vita dell'app.
  qs("#view")?.addEventListener("scroll", aggiornaOmbraTestata, { passive: true });

  registraServiceWorker();

  // Le altre schermate si caricano subito dopo la prima, senza fretta: se la
  // rete se ne va mentre sei in palestra, cambiare scheda continua a
  // funzionare invece di dare «questa sezione non si è caricata».
  setTimeout(() => {
    for (const carica of Object.values(ROTTE)) {
      try {
        carica().catch(() => {});
      } catch {
        /* niente: è solo un anticipo, non un obbligo */
      }
    }
  }, 1200);
}

avvia().catch((e) => {
  console.error(e);
  // Un avviso che sparisce dopo sei secondi lascia lo schermo bianco e nessuna
  // spiegazione: da lontano, senza computer, è il guasto peggiore possibile
  // perché non si può nemmeno raccontare cosa si è visto. Qui resta a schermo
  // quello che serve per rimediare: cosa è successo, come riprovare, e come
  // mettere al sicuro i dati prima di toccare qualunque altra cosa.
  try {
    clear(view).append(
      h(
        "div.screen",
        h("header.topbar", h("h1", "Coach")),
        h(
          "div.empty",
          h("h3", "L'app non è partita"),
          h("p", e?.message || "Errore sconosciuto."),
          h(
            "p",
            "I tuoi dati non sono stati toccati: restano nell'archivio del telefono. " +
              "Riprova a ricaricare; se non riparte, chiudi l'app e riaprila."
          ),
          h(
            "div.btn-wrap",
            h("button.btn", { onclick: () => location.reload() }, "Ricarica"),
            h("div", { style: "height:8px" }),
            h(
              "button.btn.secondary",
              { onclick: () => { location.hash = "#/impostazioni"; location.reload(); } },
              "Vai alle impostazioni (backup)"
            )
          )
        )
      )
    );
  } catch {
    // Se non si riesce nemmeno a disegnare questo, resta l'avviso: è l'ultima
    // cosa che può ancora funzionare.
    toast("Errore all'avvio: " + e.message, 6000);
  }
});
