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
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

export function num(v, dec = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
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

export function sheet(build) {
  return new Promise((resolve) => {
    const close = (val) => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(undefined);
    };
    const panel = h("div.sheet", h("div.grabber"));
    const backdrop = h(
      "div.sheet-backdrop",
      {
        onclick: (e) => {
          if (e.target === backdrop) close(undefined);
        },
      },
      panel
    );
    panel.append(build(close));
    document.body.append(backdrop);
    document.addEventListener("keydown", onKey);
    panel.querySelector("button, input, textarea")?.focus?.();
  });
}

export function chiedi({ titolo, testo, opzioni }) {
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
        h("button.btn.secondary", { onclick: () => close(undefined) }, "Annulla")
      )
    )
  );
}

// ---------- suoni ----------

let audioCtx = null;
let alarmTimer = null;
let elementoAllarme = null;

/**
 * iOS zittisce l'audio "ambientale" quando l'interruttore laterale è su
 * silenzioso. Dichiarare la sessione come riproduzione fa suonare l'allarme
 * anche in quel caso: un timer di recupero che non suona è inutile.
 */
function dichiaraSessioneAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = "playback";
  } catch {
    /* API non disponibile: si resta sul comportamento predefinito */
  }
}

/** Genera un WAV con tre bip, così non serve nessun file audio esterno. */
function wavAllarme() {
  const hz = 22050;
  const durata = 1.6;
  const campioni = Math.floor(hz * durata);
  const dati = new Int16Array(campioni);
  const bip = [
    { da: 0.0, a: 0.16, f: 880 },
    { da: 0.22, a: 0.38, f: 880 },
    { da: 0.44, a: 0.68, f: 1175 },
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

/** Va chiamata da un gesto dell'utente, altrimenti iOS blocca l'audio. */
export function sbloccaAudio() {
  dichiaraSessioneAudio();
  const a = elemento();
  // riproduzione muta e immediata: sblocca l'elemento per gli usi successivi
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    })
    .catch(() => {
      a.muted = false;
    });

  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx?.state === "suspended") audioCtx.resume();
}

function beep(freq = 880, dur = 0.16, gain = 0.22) {
  if (!audioCtx || audioCtx.state !== "running") return;
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
}

/** Suona finché non si chiama fermaAllarme(). */
export function avviaAllarme() {
  fermaAllarme();
  dichiaraSessioneAudio();
  const a = elemento();
  a.currentTime = 0;
  a.play().catch(() => {
    /* se l'elemento è bloccato resta l'oscillatore come ripiego */
  });
  alarmTimer = setInterval(() => {}, 1000);
}

export function fermaAllarme() {
  if (alarmTimer) clearInterval(alarmTimer);
  alarmTimer = null;
  if (elementoAllarme) {
    elementoAllarme.pause();
    elementoAllarme.currentTime = 0;
  }
}

export function allarmeAttivo() {
  return alarmTimer !== null;
}

export function tick() {
  beep(660, 0.05, 0.12);
}

/** Prova del suono, per verificarlo senza allenarsi. */
export function provaSuono() {
  sbloccaAudio();
  setTimeout(() => {
    const a = elemento();
    a.loop = false;
    a.currentTime = 0;
    a.play().finally(() => {
      setTimeout(() => {
        a.loop = true;
      }, 2000);
    });
  }, 120);
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
