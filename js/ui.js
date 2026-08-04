/* Helper di interfaccia: DOM, date, suoni, wake lock, fogli modali. */

// ---------- DOM ----------

const SVG_NS = "http://www.w3.org/2000/svg";
const TAG_SVG = new Set(["svg", "circle", "path", "line", "rect", "g", "text", "polyline", "ellipse"]);

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
      } else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
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
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 0 = domenica … 6 = sabato, come Date.getDay(). */
export function weekdayOf(iso) {
  return parseIso(iso).getDay();
}

export function nomeGiorno(iso) {
  return GIORNI[weekdayOf(iso)];
}

export function dataLunga(iso) {
  const d = parseIso(iso);
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

export function dataBreve(iso) {
  const d = parseIso(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

export function giorniTra(isoA, isoB) {
  return Math.round((parseIso(isoB) - parseIso(isoA)) / 86400000);
}

export function oraDi(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function mmss(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function durataUmana(sec) {
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
  return Number(v)
    .toFixed(dec)
    .replace(/\.0+$/, "")
    .replace(".", ",");
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

export function sheet(build) {
  return new Promise((resolve) => {
    let chiuso = false;
    const close = (val) => {
      if (chiuso) return;
      chiuso = true;
      FOGLI_APERTI.delete(close);
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      const vv = window.visualViewport;
      if (vv) {
        vv.removeEventListener("resize", adattaTastiera);
        vv.removeEventListener("scroll", adattaTastiera);
      }
      resolve(val);
    };

    /**
     * Fa spazio alla tastiera. Su iOS la tastiera NON cambia né vh né dvh:
     * l'unico che se ne accorge è visualViewport. Senza questo, il pannello
     * resta alto quanto lo schermo e l'ultimo pulsante — «Importa», «Salva» —
     * finisce sotto i tasti, dove non lo raggiungi.
     */
    const adattaTastiera = () => {
      const vv = window.visualViewport;
      if (!vv || chiuso) return;
      const coperto = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (coperto > 60) {
        // Lo sfondo viene ridotto esattamente alla parte di schermo che si
        // vede: essendo allineato in basso, il pannello si appoggia sopra i
        // tasti invece di finirci sotto. Agire sull'altezza è più affidabile
        // che aggiungere spazio in fondo, che iOS a volte ignora.
        backdrop.style.top = `${Math.round(vv.offsetTop)}px`;
        backdrop.style.height = `${Math.round(vv.height)}px`;
        backdrop.style.bottom = "auto";
        panel.style.maxHeight = `${Math.max(180, Math.round(vv.height - 12))}px`;
      } else {
        backdrop.style.top = "";
        backdrop.style.height = "";
        backdrop.style.bottom = "";
        panel.style.maxHeight = "";
      }
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
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", adattaTastiera);
      vv.addEventListener("scroll", adattaTastiera);
      adattaTastiera();
    }
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
      testo && h("p", { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:15px" }, testo),
      h(
        "div.btn-wrap",
        { style: "display:grid;gap:8px" },
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

/**
 * "transient" serve per un suono breve: si fa sentire anche con l'interruttore
 * su silenzioso, abbassa per un attimo quello che stai ascoltando e poi lo
 * lascia riprendere. Dichiararla come "playback" — come facevo prima —
 * equivale a dire a iOS che l'app è un lettore musicale, e ferma la musica
 * per tutta la durata dell'allenamento.
 */
function sessioneAudio(tipo) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = tipo;
  } catch {
    /* API non disponibile: si resta sul comportamento predefinito */
  }
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
  audioSbloccato = true;
  // Nessuna dichiarazione di sessione qui: l'app non deve occupare l'audio
  // finché non c'è davvero qualcosa da suonare.
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
  if (p && typeof p.then === "function") return p.then(ripristina).catch(ripristina);
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
    return;
  }
  suona();
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
  // restituisce l'audio a chi lo stava usando
  sessioneAudio("auto");
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
    sessioneAudio("auto");
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
