/* Helper di interfaccia: DOM, date, suoni, wake lock, fogli modali. */

// ---------- DOM ----------

const SVG_NS = "http://www.w3.org/2000/svg";
const TAG_SVG = new Set(["svg", "circle", "path", "line", "rect", "g", "text", "polyline", "ellipse"]);

/**
 * Costruisce un elemento. I figli passano SEMPRE da `createTextNode`: qualunque
 * cosa arrivi — una nota scritta a mano, un titolo del calendario, il nome di
 * un esercizio dal brief — finisce a schermo come testo e non come markup.
 *
 * C'era una scorciatoia `html:` che scriveva direttamente in `innerHTML`: non
 * la usava nessuno, ed era l'unico punto dell'app da cui un testo scritto
 * altrove avrebbe potuto diventare codice. Tolta.
 */
export function h(tag, props, ...kids) {
  const [name, ...cls] = tag.split(".");
  const inSvg = TAG_SVG.has(name);
  // Gli elementi SVG vanno creati nel loro namespace, altrimenti il browser
  // costruisce elementi HTML omonimi che non disegnano nulla.
  const node = inSvg ? document.createElementNS(SVG_NS, name) : document.createElement(name || "div");
  if (cls.length) {
    if (inSvg) node.setAttribute("class", cls.join(" "));
    else node.className = cls.join(" ");
  }
  if (props && (props.nodeType || Array.isArray(props) || typeof props !== "object")) {
    kids.unshift(props);
  } else if (props) {
    for (const [k, v] of Object.entries(props)) {
      // gli attributi aria- sono testuali: "false" è un valore, non un'assenza
      if (k.startsWith("aria-") && typeof v === "boolean") {
        node.setAttribute(k, String(v));
        continue;
      }
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") {
        const attuale = inSvg ? node.getAttribute("class") : node.className;
        const unito = [attuale, v].filter(Boolean).join(" ");
        if (inSvg) node.setAttribute("class", unito);
        else node.className = unito;
      } else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (inSvg) node.setAttribute(k, v === true ? "" : v);
      else if (k in node && k !== "list" && k !== "type") node[k] = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const kid of kids.flat(4)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

/** append che ignora i figli assenti: `nodo.append(null)` scriverebbe "null". */
export function aggiungi(genitore, ...figli) {
  const validi = figli.flat(3).filter((x) => x !== null && x !== undefined && x !== false);
  if (validi.length) genitore.append(...validi);
  return genitore;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// ---------- date ----------

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

export function isoDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseIso(iso) {
  // Con `null` o una stringa senza data questa riga esplodeva («split of
  // null») e portava giù l'intera schermata che la stava disegnando. Meglio
  // una data non valida, che ogni formattatore sa già tradurre in «—».
  if (typeof iso !== "string") return new Date(NaN);
  const [y, m, d] = iso.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(NaN);
  const data = new Date(y, m - 1, d);
  // Una data che non esiste non va corretta in silenzio: `new Date(2026, 12, 45)`
  // diventa il 14 febbraio 2027, e «2026-13-45» finiva scritto a schermo come
  // «domenica 14 febbraio» — un giorno plausibile e sbagliato, peggio di un
  // trattino. Se i pezzi non tornano, la data non è una data.
  if (data.getFullYear() !== y || data.getMonth() !== m - 1 || data.getDate() !== d) {
    return new Date(NaN);
  }
  return data;
}

/** 0 = domenica … 6 = sabato, come Date.getDay(). */
export function weekdayOf(iso) {
  return parseIso(iso).getDay();
}

export function dataLunga(iso) {
  const d = parseIso(iso);
  if (!d || Number.isNaN(d.getTime())) return "—";
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

export function dataBreve(iso) {
  const d = parseIso(iso);
  // Una data che non si legge diventa un trattino, non «NaN/NaN»: il trattino
  // dice «non lo so», la sigla sembra un errore dell'app.
  if (!d || Number.isNaN(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

export function giorniTra(isoA, isoB) {
  return Math.round((parseIso(isoB) - parseIso(isoA)) / 86400000);
}

/**
 * Un orario che non c'è si scrive «—», non «NaN:NaN».
 */
export function oraDi(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * «Non lo so» e «zero» sono due cose diverse.
 *
 * `Number(null)` fa 0: il controllo qui sotto lasciava passare un valore
 * assente e lo scriveva come «00:00», cioè un tempo misurato pari a zero.
 * Su un recupero o su una durata è una bugia — quella giusta è il trattino.
 */
const nonMisurato = (v) => v === null || v === undefined || v === "" || !Number.isFinite(Number(v));

export function mmss(sec) {
  if (nonMisurato(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function durataUmana(sec) {
  if (nonMisurato(sec)) return "—";
  // Prima si arrotondano i minuti, POI si separano le ore: arrotondando dopo,
  // 1h 59m 40s diventava «1h 60m».
  const minuti = Math.round(Math.max(0, sec) / 60);
  const h = Math.floor(minuti / 60);
  const m = minuti % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

export function num(v, dec = 1) {
  // Anche l'infinito è un «non numero»: una divisione per zero da qualche parte
  // stamperebbe la parola «Infinity» in mezzo a una frase italiana.
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  const testo = Number(v)
    .toFixed(dec)
    .replace(/\.0+$/, "")
    .replace(".", ",");
  // «-0» non è un numero che si scrive: succede quando un valore negativo
  // piccolissimo si arrotonda a zero, e in una riga di differenza («-0 kg»)
  // dichiara un calo che non c'è stato.
  return /^-0(,0*)?$/.test(testo) ? testo.slice(1) : testo;
}

// ---------- toast ----------

let toastTimer = null;

export function toast(msg, ms = 2200) {
  qs(".toast")?.remove();
  const t = h("div.toast", msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

// ---------- fogli modali ----------

/** Pannelli aperti in questo momento: servono a poterli chiudere dall'esterno. */
const FOGLI_APERTI = new Set();

/**
 * Chiude tutti i pannelli aperti. La chiama il router quando si cambia
 * schermata: un pannello rimasto sopra a una schermata nuova sembra un'app
 * bloccata, perché copre tutto e non appartiene più a niente.
 */
export function chiudiFogli() {
  for (const chiudi of [...FOGLI_APERTI]) chiudi(undefined);
}

/**
 * C'è almeno un pannello aperto? Serve a chi deve decidere se è il momento di
 * ricaricare la pagina: un pannello aperto vuol dire che qualcosa è a metà.
 */
export function foglioAperto() {
  return FOGLI_APERTI.size > 0;
}

export function sheet(build) {
  return new Promise((resolve) => {
    let chiuso = false;
    const close = (val) => {
      if (chiuso) return;
      chiuso = true;
      FOGLI_APERTI.delete(close);
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    FOGLI_APERTI.add(close);
    const onKey = (e) => {
      if (e.key === "Escape") close(undefined);
    };

    const panel = h("div.sheet", h("div.grabber"));

    /**
     * Si chiude solo se il tocco è COMINCIATO sullo sfondo. Senza questo, un
     * secondo tocco rapido su un pulsante che nel frattempo si è spostato
     * (il contenuto cambia altezza) finisce sullo sfondo e chiude il pannello.
     */
    let partitoDaSfondo = false;
    const backdrop = h(
      "div.sheet-backdrop",
      {
        onpointerdown: (e) => {
          partitoDaSfondo = e.target === backdrop;
        },
        onclick: (e) => {
          if (e.target === backdrop && partitoDaSfondo) close(undefined);
        },
      },
      panel
    );

    // trascinamento verso il basso per chiudere
    // Il trascinamento parte SOLO dalla maniglia in cima. Prima bastava
    // scorrere il contenuto del pannello per farlo scendere e chiudere: si
    // perdeva quello che era stato scritto, per esempio la nota obbligatoria
    // del salto esercizio.
    let y0 = null;
    let spostamento = 0;
    panel.addEventListener("touchstart", (e) => {
      if (!e.target.closest(".grabber")) return;
      y0 = e.touches[0].clientY;
      spostamento = 0;
      panel.style.transition = "none";
    }, { passive: true });
    panel.addEventListener("touchmove", (e) => {
      if (y0 === null) return;
      spostamento = Math.max(0, e.touches[0].clientY - y0);
      panel.style.transform = `translateY(${spostamento}px)`;
    }, { passive: true });
    panel.addEventListener("touchend", () => {
      if (y0 === null) return;
      panel.style.transition = "transform .2s ease-out";
      if (spostamento > 90) close(undefined);
      else panel.style.transform = "";
      y0 = null;
    });
    // Se il sistema annulla il tocco (una chiamata, la barra di iOS) il
    // pannello torna al suo posto senza chiudersi: prima restava a metà strada
    // e sembrava bloccato.
    panel.addEventListener("touchcancel", () => {
      y0 = null;
      spostamento = 0;
      panel.style.transition = "transform .2s ease-out";
      panel.style.transform = "";
    });

    panel.append(build(close));
    document.body.append(backdrop);
    document.addEventListener("keydown", onKey);
  });
}

/**
 * `annulla: false` toglie il pulsante «Annulla»: serve ai pannelli che danno
 * solo una notizia («Ho capito», «Bene»), dove offrire di annullare fa pensare
 * che ci sia qualcosa da disfare. Resta per tutte le conferme, dove è la via
 * d'uscita. In ogni caso si può sempre chiudere toccando fuori dal pannello.
 */
export function chiedi({ titolo, testo, opzioni, annulla = true }) {
  return sheet((close) =>
    h(
      "div",
      titolo && h("h2", titolo),
      // `pre-line` e non `normal`: qui dentro arrivano elenchi già impaginati —
      // i problemi trovati nel brief, il risultato di un import, le due parti
      // di un avviso — scritti con gli a capo dentro il testo. In un paragrafo
      // normale il browser li buttava via e sei righe diverse diventavano un
      // muro unico, proprio dove bisogna leggere con attenzione.
      testo &&
        h(
          "p",
          { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:15px;white-space:pre-line" },
          testo
        ),
      h(
        // Dodici pixel fra una scelta e l'altra, non otto: qui dentro capita
        // che una delle opzioni cancelli un dato, e con i tasti appiccicati un
        // tocco impreciso sceglie quella sbagliata.
        "div.btn-wrap",
        { style: "display:grid;gap:12px" },
        ...opzioni.map((o) =>
          h(
            "button",
            {
              class: `btn ${o.stile || "secondary"}`,
              onclick: () => close(o.valore),
            },
            o.etichetta
          )
        ),
        annulla ? h("button.btn.secondary", { onclick: () => close(undefined) }, "Annulla") : null
      )
    )
  );
}

/**
 * Avvolge un gestore perché non possa partire due volte: il secondo tocco su
 * un pulsante che apre un pannello o scrive sul database creava dati doppi
 * (due allenamenti aperti, due misure, due set di foto).
 */
export function unaVoltaSola(fn) {
  let occupato = false;
  return async (...args) => {
    if (occupato) return;
    occupato = true;
    const bottone = args[0]?.currentTarget;
    if (bottone && "disabled" in bottone) bottone.disabled = true;
    try {
      return await fn(...args);
    } catch (e) {
      // Un errore qui non deve sparire: il pulsante tornava attivo e non
      // succedeva niente, e sembrava che l'app avesse ignorato il tocco.
      console.error(e);
      toast(`Qualcosa non ha funzionato: ${e.message}`, 4000);
    } finally {
      occupato = false;
      if (bottone && "disabled" in bottone) bottone.disabled = false;
    }
  };
}

// ---------- suoni ----------

let audioCtx = null;
let alarmTimer = null;
let elementoAllarme = null;
let rilascioBip = null;

/**
 * Che cosa dichiariamo a iOS sull'audio dell'app.
 *
 * - "transient": suono breve. Si sente anche con l'interruttore su silenzioso,
 *   mette in pausa quello che stai ascoltando e **iOS lo fa riprendere da solo**
 *   appena finiamo. È quello giusto mentre l'allarme suona.
 * - "ambient": l'app non possiede l'audio, si mescola a quello che c'è. È
 *   quello giusto in tutti gli altri momenti — cioè quasi sempre.
 * - "playback" (il valore che iOS sceglie da sé se non diciamo niente): l'app
 *   è un lettore musicale. Ferma la musica e non la fa ripartire.
 *
 * La dichiarazione va fatta PRIMA che parta qualunque suono, sblocco compreso:
 * una volta che la sessione si è attivata come "playback", cambiarle nome dopo
 * non restituisce la musica a chi ce l'aveva.
 */
function sessioneAudio(tipo) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = tipo;
  } catch {
    /* API non disponibile: si resta sul comportamento predefinito */
  }
}

/**
 * Lascia andare l'audio: niente contesto acceso, niente traccia caricata,
 * sessione dichiarata "ambient".
 *
 * Finché resta acceso un AudioContext — anche fermo, anche senza nessun suono —
 * iOS considera che l'app stia ancora usando l'audio, e la musica di chi c'era
 * prima non riparte. Il contesto lo apre `beep()`, cioè i bip di riserva: una
 * volta usati restavano accesi per tutto il resto dell'allenamento.
 */
function rilasciaAudio() {
  if (rilascioBip) {
    clearTimeout(rilascioBip);
    rilascioBip = null;
  }
  if (audioCtx) {
    try {
      const morente = audioCtx;
      audioCtx = null;
      if (typeof morente.close === "function") morente.close().catch(() => {});
    } catch {
      /* niente: quello che conta è non tenerlo acceso */
    }
  }
  sessioneAudio("ambient");
}

/**
 * Genera un WAV con tre bip, così non serve nessun file audio esterno.
 * I primi 0,35 secondi sono muti di proposito: lo sblocco dell'audio deve
 * far partire e fermare questa traccia, e senza il silenzio iniziale se ne
 * sentirebbe un frammento a ogni apertura dell'app.
 */
const SILENZIO_INIZIALE = 0.35;

function wavAllarme() {
  const hz = 22050;
  const durata = SILENZIO_INIZIALE + 1.6;
  const campioni = Math.floor(hz * durata);
  const dati = new Int16Array(campioni);
  const bip = [
    { da: SILENZIO_INIZIALE + 0.0, a: SILENZIO_INIZIALE + 0.16, f: 880 },
    { da: SILENZIO_INIZIALE + 0.22, a: SILENZIO_INIZIALE + 0.38, f: 880 },
    { da: SILENZIO_INIZIALE + 0.44, a: SILENZIO_INIZIALE + 0.68, f: 1175 },
  ];
  for (const b of bip) {
    const i0 = Math.floor(b.da * hz);
    const i1 = Math.floor(b.a * hz);
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / (i1 - i0);
      const inviluppo = Math.min(1, t * 12) * Math.min(1, (1 - t) * 6);
      dati[i] = Math.round(Math.sin((2 * Math.PI * b.f * i) / hz) * 26000 * inviluppo);
    }
  }

  const buffer = new ArrayBuffer(44 + dati.length * 2);
  const v = new DataView(buffer);
  const testo = (off, str) => [...str].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)));
  testo(0, "RIFF");
  v.setUint32(4, 36 + dati.length * 2, true);
  testo(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, hz, true);
  v.setUint32(28, hz * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  testo(36, "data");
  v.setUint32(40, dati.length * 2, true);
  new Int16Array(buffer, 44).set(dati);
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function elemento() {
  if (!elementoAllarme) {
    elementoAllarme = new Audio(wavAllarme());
    elementoAllarme.loop = true;
    elementoAllarme.preload = "auto";
    elementoAllarme.volume = 1;
    // Su iOS un elemento agganciato al documento è più affidabile di uno
    // creato solo in memoria: resta valido anche dopo un cambio di schermata.
    elementoAllarme.setAttribute("playsinline", "");
    elementoAllarme.style.display = "none";
    document.body.append(elementoAllarme);
  }
  return elementoAllarme;
}

let audioSbloccato = false;

/**
 * Va chiamata da un gesto dell'utente, ma NON all'apertura dell'app: iOS
 * lascia scappare un frammento della traccia e si sente un tic ogni volta.
 * La si chiama quando comincia un allenamento, cioè molto prima che serva
 * suonare davvero, e una volta sola.
 */
export function sbloccaAudio() {
  if (audioSbloccato) return Promise.resolve();
  // Attenzione all'ordine: «sbloccato» si scrive solo quando il `play()` è
  // andato a buon fine davvero, in fondo a questa funzione.
  //
  // Segnandolo qui, un primo tentativo fallito — capita su iOS quando il gesto
  // non viene riconosciuto o la sessione audio è occupata — lasciava l'app
  // convinta di aver sbloccato l'audio, e **non riprovava più**: l'allarme di
  // fine recupero restava muto per tutto l'allenamento, senza che niente lo
  // dicesse. Riprovare non costa niente: è un play muto, e ogni tocco dentro
  // la seduta è un gesto valido buono per riuscirci.
  // Qui la dichiarazione ci vuole, ed è "ambient".
  //
  // Senza, questo `play()` — muto, ma pur sempre un play — è il primo suono
  // dell'app e apre la sessione con il nome che sceglie iOS: quello del lettore
  // musicale. Da lì in poi la musica di chi stava ascoltando è ferma, e nessuna
  // dichiarazione successiva gliela restituisce. Succedeva all'inizio
  // dell'allenamento, ore prima che l'allarme suonasse davvero.
  sessioneAudio("ambient");
  const a = elemento();
  // Muto, volume a zero e senza ripetizione: tre precauzioni perché lo sblocco
  // non si senta. Su iOS «muted» da solo non basta sempre, e il frammento che
  // scappa diventa un tic a ogni apertura.
  const volumePrec = a.volume;
  a.muted = true;
  a.volume = 0;
  a.loop = false;
  const ripristina = () => {
    a.pause();
    a.currentTime = 0;
    a.muted = false;
    a.volume = volumePrec;
    a.loop = true;
  };
  const p = a.play();
  // Restituisce una promessa: chi vuole suonare subito dopo deve aspettare che
  // lo sblocco abbia finito, altrimenti si mettono in mezzo a vicenda.
  if (p && typeof p.then === "function") {
    return p
      .then(() => {
        audioSbloccato = true;
        ripristina();
      })
      .catch(ripristina);
  }
  audioSbloccato = true;
  ripristina();
  return Promise.resolve();
}

function beep(freq = 880, dur = 0.16, gain = 0.22) {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  const suona = () => {
    if (audioCtx.state !== "running") return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur + 0.02);
  };
  // Risvegliare l'audio richiede tempo: prima si suonava subito dopo averlo
  // chiesto, quando era ancora fermo, e non usciva niente. Proprio i bip di
  // riserva — quelli che suonano quando l'allarme normale non parte — non si
  // sentivano mai.
  if (audioCtx.state === "suspended") {
    audioCtx.resume().then(suona).catch(() => {});
  } else {
    suona();
  }
  // Finito il suono, si molla l'audio. Un contesto acceso, anche muto, per iOS
  // vuol dire «sto ancora usando l'altoparlante», e la musica di chi ce l'aveva
  // non riparte. Il preavviso dei tre secondi ne apriva uno e lo lasciava lì.
  // Non si molla se c'è un allarme in corso: quello lo chiude `fermaAllarme`.
  if (rilascioBip) clearTimeout(rilascioBip);
  rilascioBip = setTimeout(() => {
    rilascioBip = null;
    if (alarmTimer === null && bipTimer === null) rilasciaAudio();
  }, Math.round((dur + 0.3) * 1000));
}

let bipTimer = null;
// Il `play()` dell'allarme che non ha ancora finito di partire.
let playInVolo = null;

/**
 * Suona finché non si chiama fermaAllarme(). Se la traccia non parte — succede
 * quando iOS non ha autorizzato quell'elemento — si passa ai bip generati:
 * dichiarare che l'allarme sta suonando mentre non si sente niente è il modo
 * peggiore di fallire, perché il recupero finisce e nessuno se ne accorge.
 */
export function avviaAllarme() {
  fermaAllarme();
  sessioneAudio("transient");
  const a = elemento();
  a.loop = true;
  a.currentTime = 0;
  const p = a.play();
  if (p && typeof p.then === "function") {
    // iOS risolve `play()` con calma. Se nel frattempo l'allarme è stato
    // spento, il `pause()` di fermaAllarme è arrivato PRIMA che la traccia
    // partisse: veniva ignorato, la traccia partiva lo stesso e — essendo in
    // loop — non la fermava più nessuno. Qui si rimette in pausa appena il
    // play atterra, se nel frattempo l'allarme è stato spento.
    playInVolo = p;
    p.then(() => {
      if (playInVolo === p) playInVolo = null;
      if (alarmTimer === null) fermaAllarme();
    }).catch(() => {
      if (playInVolo === p) playInVolo = null;
      if (bipTimer || alarmTimer === null) return;
      beep(880, 0.3, 0.35);
      bipTimer = setInterval(() => beep(880, 0.3, 0.35), 1200);
    });
  }
  alarmTimer = setInterval(() => {}, 1000);
}

export function fermaAllarme() {
  if (alarmTimer) clearInterval(alarmTimer);
  alarmTimer = null;
  if (bipTimer) clearInterval(bipTimer);
  bipTimer = null;
  if (elementoAllarme) {
    // Prima si toglie la ripetizione: se un `play()` in volo dovesse comunque
    // partire dopo questa pausa, la traccia finisce dopo un giro invece di
    // suonare per sempre.
    elementoAllarme.loop = false;
    elementoAllarme.pause();
    elementoAllarme.currentTime = 0;
  }
  // Restituisce l'audio a chi lo stava usando: sessione "ambient" e contesto
  // dei bip spento. Prima qui si dichiarava "auto", che vuol dire «decidi tu»:
  // con una traccia ancora appesa al documento, iOS decideva che il lettore
  // musicale eravamo noi.
  rilasciaAudio();
}

export function allarmeAttivo() {
  return alarmTimer !== null;
}

/**
 * Versione che sta girando davvero sul telefono: la si chiede al service
 * worker attivo, poi al nome della copia locale. Il file sul server dice cosa
 * è stato pubblicato, non cosa hai installato: è la domanda sbagliata.
 */
export async function versioneInstallata() {
  try {
    const attivo = navigator.serviceWorker?.controller;
    if (attivo) {
      const risposta = await new Promise((ok) => {
        const canale = new MessageChannel();
        const scaduto = setTimeout(() => ok(null), 1200);
        canale.port1.onmessage = (e) => {
          clearTimeout(scaduto);
          ok(e.data);
        };
        attivo.postMessage("VERSIONE", [canale.port2]);
      });
      if (risposta) return risposta;
    }
  } catch {
    /* si prova col nome della copia locale */
  }
  try {
    const nome = (await caches.keys()).find((k) => k.startsWith("coach-"));
    if (nome) return nome.slice("coach-".length);
  } catch {
    /* niente cache: resta il server */
  }
  try {
    const r = await fetch("sw.js", { cache: "no-store" });
    const t = await r.text();
    const v = t.match(/const VERSION = "([^"]+)"/)?.[1];
    return v ? `${v} (sul server)` : "non verificabile";
  } catch {
    return "non verificabile";
  }
}

export function tick() {
  beep(660, 0.05, 0.12);
}

/** Prova del suono, per verificarlo senza allenarsi. */
let ripristinoProva = null;

export async function provaSuono() {
  // Il timer della prova precedente va annullato: due prove ravvicinate
  // lasciavano un timer orfano che rimetteva la ripetizione mentre la seconda
  // prova stava ancora suonando, e la traccia partiva in loop senza motivo.
  if (ripristinoProva) clearTimeout(ripristinoProva);
  await sbloccaAudio();
  sessioneAudio("transient");
  const a = elemento();
  a.loop = false;
  a.currentTime = 0;
  try {
    await a.play();
  } catch {
    /* se l'elemento resta bloccato non c'è altro da fare qui */
  }
  ripristinoProva = setTimeout(() => {
    ripristinoProva = null;
    a.loop = true;
    // Anche la prova del suono deve restituire l'audio: fatta due volte di
    // seguito dalle Impostazioni, lasciava la sessione a «decidi tu».
    rilasciaAudio();
  }, 2500);
}

// ---------- wake lock ----------

let lock = null;

export async function tieniSchermoAcceso() {
  try {
    if (!("wakeLock" in navigator) || lock) return;
    lock = await navigator.wakeLock.request("screen");
    lock.addEventListener("release", () => {
      lock = null;
    });
  } catch {
    lock = null;
  }
}

export function rilasciaSchermo() {
  lock?.release?.();
  lock = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && document.querySelector(".session")) {
    tieniSchermoAcceso();
  }
});
