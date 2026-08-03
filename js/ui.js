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

/** Va chiamata da un gesto dell'utente, altrimenti iOS blocca l'audio. */
export function sbloccaAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
  const b = audioCtx.createBuffer(1, 1, 22050);
  const s = audioCtx.createBufferSource();
  s.buffer = b;
  s.connect(audioCtx.destination);
  s.start(0);
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

function tripletta() {
  beep(880, 0.14);
  setTimeout(() => beep(880, 0.14), 200);
  setTimeout(() => beep(1175, 0.22), 400);
  navigator.vibrate?.([120, 80, 120]);
}

/** Suona finché non si chiama fermaAllarme(). */
export function avviaAllarme() {
  fermaAllarme();
  tripletta();
  alarmTimer = setInterval(tripletta, 1600);
}

export function fermaAllarme() {
  if (alarmTimer) clearInterval(alarmTimer);
  alarmTimer = null;
}

export function allarmeAttivo() {
  return alarmTimer !== null;
}

export function tick() {
  beep(660, 0.05, 0.12);
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
