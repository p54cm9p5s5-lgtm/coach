/* Allenamenti: quello che l'orologio ha registrato, più l'unica cosa che
   l'orologio non può sapere.

   Ha una sezione sua nella barra in basso — al posto di «Extra», che chiedeva
   di riscrivere a mano una camminata che il polso aveva già scritto da solo.
   Qui la camminata c'è già: quello che aggiungi è il **talk-test**, cioè se
   riuscivi a parlare mentre la facevi. È la sola misura di intensità che non
   esce da un sensore, ed è quella che il coach legge.

   Tre livelli: la settimana in corso a colpo d'occhio, l'elenco raggruppato per
   settimana, il dettaglio di un allenamento con la curva del battito. */

import { h, aggiungi, dataBreve, durataUmana, num, toast, chiedi, sheet, unaVoltaSola } from "../ui.js";
import { intestazione, indietro } from "../app.js";
import * as store from "../store.js";
import { graficoBattito } from "../grafico.js";

/* I nomi di Apple sono in inglese e attaccati: «FunctionalStrengthTraining».
   Quelli che il programma usa davvero hanno il nome che usa il programma —
   «Rafforzamento funzionale» è la sessione che l'app stessa ti dice di avviare
   sull'orologio. Un tipo che non conosciamo resta scritto com'era: meglio una
   parola inglese che una traduzione inventata o, peggio, un buco. */
const TIPI = {
  Walking: "Camminata",
  Running: "Corsa",
  Hiking: "Escursione",
  Cycling: "Bici",
  IndoorCycling: "Cyclette",
  Swimming: "Nuoto",
  FunctionalStrengthTraining: "Rafforzamento funzionale",
  TraditionalStrengthTraining: "Pesi",
  CoreTraining: "Core",
  HighIntensityIntervalTraining: "Intervalli ad alta intensità",
  Yoga: "Yoga",
  Pilates: "Pilates",
  Elliptical: "Ellittica",
  Rowing: "Vogatore",
  StairClimbing: "Scale",
  Other: "Altro",
};

export const nomeTipo = (t) => TIPI[t] || t || "Allenamento";

/* L'elenco è in bianco e nero, e non è una rinuncia.

   Qui dentro i colori erano cinque, uno per famiglia di attività: servivano a
   riconoscere una riga senza leggerla. Ma questa schermata è una lista di
   nomi — «Camminata outdoor», «Pesi» — e il nome lo dice meglio di un pallino;
   cinque tinte sparse su una pagina di carta facevano rumore e basta. I colori
   dell'orologio restano dove sono un dato e non una decorazione: dentro il
   dettaglio di un allenamento, sui suoi numeri.

   I pallini e le barre restano perché la FORMA continua a servire — quanto è
   alta la barra, dove cade il punto — ma sono tutti d'inchiostro. */
const coloreTipo = () => "var(--label)";

/* Le tre risposte non hanno tre colori: hanno tre parole, e sono quelle che si
   leggono. La differenza fra «parlavo comodo» e «non parlavo» la fa la frase,
   non la tinta. */
const COLORI_TALK = { comode: "var(--label)", fiatone: "var(--label)", fatica: "var(--label)" };
const BREVE_TALK = { comode: "parlavo comodo", fiatone: "parlavo col fiatone", fatica: "non parlavo" };
/* Sotto la domanda «Riuscivi a parlare?» la risposta è una risposta, non una
   descrizione: tre frasi intere una sotto l'altra occupavano mezzo schermo per
   dire quello che dicono tre parole. Nel dettaglio, dove la domanda è più
   lontana, restano per esteso. */
const RISPOSTA_BREVE = { comode: "Sì, comodo", fiatone: "Sì, col fiatone", fatica: "No" };

/* Il talk-test ha senso solo dove l'intensità la decidi tu camminando: una
   camminata, una corsa, un'escursione. Su una sessione di pesi la domanda «e
   riuscivi a parlare?» non vuol dire niente — lì l'intensità sta nel carico e
   nell'RPE, che l'app registra da un'altra parte — e chiederla su ogni riga
   voleva dire lasciare per sempre due terzi degli allenamenti «senza risposta».
   Dove non si applica, il talk-test non compare né si conta. */
const CON_TALK_TEST = new Set(["Walking", "Running", "Hiking"]);
const haTalkTest = (a) => CON_TALK_TEST.has(a?.tipo);

/* Al chiuso o all'aperto lo dice il nome.
   Per Salute una camminata è sempre «Walking»: il tapis e il giro dell'isolato
   hanno lo stesso tipo, e la differenza sta in un dato a parte. Sul passo al
   chilometro sono due cose che non si mescolano, e nell'elenco erano due righe
   identiche. Dove l'informazione non c'è — gli allenamenti importati prima —
   il nome resta quello di prima, senza inventare. */
const CON_LUOGO = new Set(["Walking", "Running", "Cycling"]);
export function nomeAllenamento(a) {
  const base = nomeTipo(a?.tipo);
  if (a?.indoor == null || !CON_LUOGO.has(a?.tipo)) return base;
  return `${base} ${a.indoor ? "indoor" : "outdoor"}`;
}

const GIORNI_ABBR = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const LETTERE = ["D", "L", "M", "M", "G", "V", "S"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** «1:11:16», come lo scrive l'orologio, invece di «1h 11m». */
function durataOrologio(sec) {
  if (!sec) return "—";
  const o = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const p = (n) => String(n).padStart(2, "0");
  return o ? `${o}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/* Le parole con cui Apple traduce lo sforzo da 1 a 10: sono quelle che hai
   letto sull'orologio quando quel numero l'hai scelto. */
function parolaSforzo(v) {
  if (v <= 2) return "Molto facile";
  if (v <= 4) return "Facile";
  if (v <= 6) return "Moderato";
  if (v <= 8) return "Difficile";
  return "Massimo";
}

/**
 * Il passo medio: minuti e secondi per chilometro.
 *
 * Solo dove vuol dire qualcosa. Un allenamento di sei minuti con trenta metri
 * registrati darebbe «191'40" al km»: un numero vero e inservibile, che sembra
 * un errore dell'app mentre è un dato che l'orologio non ha misurato. La regola
 * sta nello store ed è la stessa dei grafici del passo in Salute.
 */
function passoMedio(a) {
  if (!store.passoAttendibile(a)) return null;
  const secPerKm = a.durataSec / a.km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${String(s).padStart(2, "0")}"`;
}

const oraInSecondi = (ora) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(ora || "");
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : 0;
};

const iso = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const giorniIndietro = (data, quanti) => {
  const d = new Date(data + "T00:00:00");
  d.setDate(d.getDate() - quanti);
  return iso(d);
};
/** Il lunedì della settimana di quella data: la settimana comincia di lunedì. */
const lunedi = (data) => {
  const d = new Date(data + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};

function parametri() {
  const q = location.hash.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

export async function render(ctx) {
  const p = parametri();
  return p.id ? dettaglio(p.id, ctx) : elenco(ctx);
}

// ---------- pezzi di disegno ----------

/** Un numero grande con la sua etichetta sotto: la trama di tutta la sezione. */
const numeroConEtichetta = (valore, unita, etichetta, colore = "var(--label)") =>
  h(
    "div",
    h(
      "p",
      {
        style:
          `margin:0;font-size:26px;font-weight:800;letter-spacing:-0.9px;line-height:1;color:${colore};` +
          "font-variant-numeric:tabular-nums",
      },
      valore,
      unita ? h("span", { style: "font-size:13px;font-weight:700;margin-left:3px" }, unita) : null
    ),
    h("p", { style: "margin:5px 0 0;font-size:12px;color:var(--label-secondary)" }, etichetta)
  );

// ---------- l'elenco ----------

async function elenco({ ridisegna }) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Allenamenti"));

  const tutti = await store.allenamentiWatch();
  const note = await store.noteAllenamenti();
  const oggi = new Date();
  const oggiIso = iso(oggi);

  // Le attività scritte a mano nella vecchia sezione Extra. Non spariscono da
  // sole: si vedono, e si buttano con un tocco quando decidi tu. Cancellare
  // dati senza dirlo è l'unica cosa che questa app non fa.
  const vecchieExtra = await store.extra();

  if (!tutti.length) {
    aggiungi(wrap,
      h("div.empty",
        h("h3", "Ancora niente"),
        h("p", "Qui arrivano gli allenamenti che l'orologio registra da solo, quando importi i dati da Salute."),
        h(
          "div.btn-wrap",
          h("button.btn", { onclick: () => (location.hash = "#/salute") }, "Vai a importare")
        )
      )
    );
    if (vecchieExtra.length) aggiungi(wrap, cartaVecchieExtra(vecchieExtra, ridisegna));
    return wrap;
  }

  // ---- la settimana in corso ----
  const daLunedi = lunedi(oggiIso);
  const settimana = tutti.filter((a) => a.data >= daLunedi && a.data <= oggiIso);
  const somma = (righe, campo) => righe.reduce((t, x) => t + (Number(x[campo]) || 0), 0);
  const minutiSettimana = Math.round(somma(settimana, "durataSec") / 60);
  const conDomanda = settimana.filter(haTalkTest);
  const rispostiSettimana = conDomanda.filter((a) => note.get(a.uuid)?.talkTest).length;

  /* Sette barrette, una per giorno da lunedì a oggi: quanto ti sei mosso, non
     quanto avresti dovuto. Un giorno vuoto resta una tacca bassa e spenta —
     sparire lo farebbe sembrare un giorno che non è esistito. */
  /* Le sette barre sono i sette giorni DI QUESTA SETTIMANA, da lunedì.

     Erano gli ultimi sette giorni all'indietro: sotto un titolo che dice
     «questa settimana», di mercoledì, le prime quattro barre erano giovedì,
     venerdì, sabato e domenica **della settimana prima** — giorni che nel
     conteggio qui sopra non c'entravano. Due finestre diverse sotto lo stesso
     titolo, che è il difetto peggiore: entrambi i numeri sono giusti e
     raccontano cose diverse.

     I giorni non ancora arrivati restano vuoti: è una settimana che si sta
     riempiendo, e vederlo è il punto. */
  const perGiorno = [];
  for (let i = 0; i < 7; i++) {
    const data = giorniIndietro(daLunedi, -i);
    const righe = tutti.filter((a) => a.data === data);
    perGiorno.push({
      data,
      futuro: data > oggiIso,
      minuti: Math.round(somma(righe, "durataSec") / 60),
      righe,
    });
  }
  const piu = Math.max(30, ...perGiorno.map((g) => g.minuti));
  const barre = h(
    "div",
    { style: "display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;margin:16px 0 0;height:74px" },
    ...perGiorno.map((g) => {
      const alt = g.minuti ? Math.max(8, Math.round((g.minuti / piu) * 62)) : 4;
      const colore = g.righe.length ? "var(--label)" : "var(--fill-tertiary)";
      return h(
        "div",
        { style: "display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:6px" },
        h("span", {
          style:
            `display:block;height:${alt}px;border-radius:6px;background:${colore};` +
            (g.futuro ? "opacity:.28;" : g.minuti ? "" : "opacity:.5;"),
          title: `${g.minuti} minuti`,
        }),
        h(
          "span",
          {
            style:
              "text-align:center;font-size:11px;font-variant-numeric:tabular-nums;" +
              (g.data === oggiIso ? "color:var(--label);font-weight:800" : "color:var(--label-tertiary)"),
          },
          LETTERE[new Date(g.data + "T00:00:00").getDay()]
        )
      );
    })
  );

  aggiungi(wrap,
    h(
      "div",
      { style: "margin:14px 16px 0;background:var(--bg-grouped);border-radius:18px;padding:18px" },
      h(
        "p",
        { style: "margin:0;font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:var(--label-secondary)" },
        "Questa settimana"
      ),
      h(
        "p",
        { style: "margin:6px 0 0;font-size:38px;font-weight:800;letter-spacing:-1.4px;line-height:1" },
        String(settimana.length),
        h(
          "span",
          { style: "font-size:17px;font-weight:700;color:var(--label-secondary);margin-left:8px;letter-spacing:0" },
          settimana.length === 1 ? "allenamento" : "allenamenti"
        )
      ),
      barre,
      h(
        "div",
        { style: "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0 0" },
        // Inchiostro anche questi: i colori dell'orologio stanno sui numeri
        // dell'orologio, cioè dentro il dettaglio di un allenamento. Qui sono
        // somme fatte dall'app su una settimana.
        numeroConEtichetta(minutiSettimana ? durataUmana(minutiSettimana * 60) : "—", null, "in movimento"),
        numeroConEtichetta(
          somma(settimana, "kcalAttive") ? String(Math.round(somma(settimana, "kcalAttive"))) : "—",
          somma(settimana, "kcalAttive") ? "kcal" : null,
          "attive"
        ),
        numeroConEtichetta(
          somma(settimana, "km") ? num(somma(settimana, "km"), 1) : "—",
          somma(settimana, "km") ? "km" : null,
          "percorsi"
        )
      ),
      conDomanda.length
        ? h(
            "p",
            { style: "margin:16px 0 0;font-size:13px;color:var(--label-secondary);line-height:1.4" },
            rispostiSettimana === conDomanda.length
              ? "Talk-test risposto su tutte le uscite: il coach sa a che intensità stavi andando."
              : rispostiSettimana === 0
                ? `Talk-test ancora da rispondere${conDomanda.length === 1 ? "" : ` su ${conDomanda.length} uscite`}.`
                : `Talk-test risposto su ${rispostiSettimana} uscite su ${conDomanda.length}.`
          )
        : null
    )
  );

  // ---- da rispondere ----
  /* Le uscite degli ultimi giorni a cui non hai ancora risposto, con le tre
     pastiglie lì accanto: il talk-test lo ricordi per un giorno o due, non per
     un mese, e andarlo a cercare dentro la scheda di ieri vuol dire non
     rispondere mai. Nel dettaglio si risponde lo stesso, in fondo.

     Solo camminate e corse — al chiuso o all'aperto — ed escursioni: sono le
     uscite in cui l'intensità la decidi tu andando. */
  const daRispondere = tutti
    .filter((a) => haTalkTest(a) && a.data >= giorniIndietro(oggiIso, 6) && a.data <= oggiIso && !note.get(a.uuid)?.talkTest)
    .slice(0, 3);
  if (daRispondere.length) {
    const lista = h("div", { style: "display:grid;gap:16px" });
    for (const a of daRispondere) aggiungi(lista, bloccoRisposta(a, ridisegna));
    aggiungi(wrap,
      h(
        "div",
        { style: "margin:14px 16px 0;padding:18px 0 0;border-top:1px solid var(--separator)" },
        h("p", { style: "margin:0 0 4px;font-size:20px;font-weight:800;letter-spacing:-0.5px" }, "Riuscivi a parlare?"),
        h(
          "p",
          { style: "margin:0 0 16px;font-size:13px;color:var(--label-secondary);line-height:1.4" },
          daRispondere.length === 1
            ? "L'unica cosa che l'orologio non misura. Rispondi e la giornata vale come giornata di allenamento."
            : "L'unica cosa che l'orologio non misura. Rispondi e quelle giornate valgono come giornate di allenamento."
        ),
        lista
      )
    );
  }

  // ---- come stavi andando ----
  const conTalk = tutti.filter((a) => haTalkTest(a) && note.get(a.uuid)?.talkTest);
  if (conTalk.length >= 3) {
    const conteggi = store.TALK_TEST.map((t) => ({
      ...t,
      quanti: conTalk.filter((a) => note.get(a.uuid).talkTest === t.id).length,
    }));
    const totale = conTalk.length;
    aggiungi(wrap,
      h(
        "div",
        { style: "margin:14px 16px 0;background:var(--bg-grouped);border-radius:18px;padding:18px" },
        h("p", { style: "margin:0 0 14px;font-size:20px;font-weight:800;letter-spacing:-0.5px" }, "Come stavi andando"),
        ...conteggi.map((c) =>
          h(
            "div",
            { style: "margin:0 0 12px" },
            h(
              "div",
              { style: "display:flex;align-items:baseline;justify-content:space-between;gap:10px" },
              h("span", { style: "font-size:15px;color:var(--label)" }, c.testo),
              h(
                "span",
                { style: `font-size:15px;font-weight:800;color:${COLORI_TALK[c.id]};font-variant-numeric:tabular-nums` },
                `${c.quanti} · ${Math.round((c.quanti / totale) * 100)}%`
              )
            ),
            h(
              "span",
              { style: "display:block;height:8px;border-radius:5px;background:var(--fill-tertiary);margin:7px 0 0;overflow:hidden" },
              h("span", {
                style:
                  `display:block;height:100%;border-radius:5px;background:${COLORI_TALK[c.id]};` +
                  `width:${Math.max(c.quanti ? 3 : 0, Math.round((c.quanti / totale) * 100))}%`,
              })
            )
          )
        ),
        h(
          "p",
          { style: "margin:2px 0 0;font-size:12px;color:var(--label-tertiary);line-height:1.4" },
          `Su ${totale} ${totale === 1 ? "uscita" : "uscite"} con il talk-test risposto, su ${tutti.filter(haTalkTest).length} fra camminate, corse ed escursioni.`
        )
      )
    );
  }

  // ---- quello che fai di più ----
  const perTipo = new Map();
  for (const a of tutti) {
    const k = a.tipo || "Other";
    const r = perTipo.get(k) || { tipo: k, quanti: 0, secondi: 0 };
    r.quanti++;
    r.secondi += Number(a.durataSec) || 0;
    perTipo.set(k, r);
  }
  const tipi = [...perTipo.values()].sort((a, b) => b.secondi - a.secondi).slice(0, 5);
  const maxSec = Math.max(1, ...tipi.map((t) => t.secondi));
  aggiungi(wrap,
    h(
      "div",
      { style: "margin:14px 16px 0;background:var(--bg-grouped);border-radius:18px;padding:18px" },
      h("p", { style: "margin:0 0 14px;font-size:20px;font-weight:800;letter-spacing:-0.5px" }, "Quello che fai di più"),
      ...tipi.map((t) =>
        h(
          "div",
          { style: "margin:0 0 12px" },
          h(
            "div",
            { style: "display:flex;align-items:baseline;justify-content:space-between;gap:10px" },
            h(
              "span",
              { style: "font-size:15px;color:var(--label);display:flex;align-items:center;gap:8px" },
              h("span", {
                style: `width:9px;height:9px;border-radius:50%;background:${coloreTipo(t.tipo)};flex:none`,
              }),
              nomeTipo(t.tipo)
            ),
            h(
              "span",
              { style: "font-size:14px;color:var(--label-secondary);font-variant-numeric:tabular-nums" },
              `${t.quanti} · ${durataUmana(t.secondi)}`
            )
          ),
          h(
            "span",
            { style: "display:block;height:8px;border-radius:5px;background:var(--fill-tertiary);margin:7px 0 0;overflow:hidden" },
            h("span", {
              style: `display:block;height:100%;border-radius:5px;background:${coloreTipo(t.tipo)};width:${Math.max(3, Math.round((t.secondi / maxSec) * 100))}%`,
            })
          )
        )
      )
    )
  );

  // ---- l'elenco, settimana per settimana ----
  /* Un anno di camminate sono trecento righe, cinque anni duemila: disegnate
     tutte insieme l'elenco ci mette un secondo ad aprirsi e da lì in poi
     peggiora. Si mostrano le più recenti — le uniche che si guardano davvero —
     e le altre si chiedono. */
  const A_VISTA = 60;
  const contenitore = h("div");
  const disegnaFino = (quanti) => {
    contenitore.textContent = "";
    const mostrati = tutti.slice(0, quanti);
    let settimanaCorrente = null;
    let lista = null;
    for (const a of mostrati) {
      const chiave = lunedi(a.data);
      if (chiave !== settimanaCorrente) {
        settimanaCorrente = chiave;
        lista = h("div.list");
        const righe = mostrati.filter((x) => lunedi(x.data) === chiave);
        aggiungi(contenitore,
          h(
            "div.group",
            h(
              "h2",
              { style: "display:flex;align-items:baseline;justify-content:space-between;gap:10px" },
              h("span", titoloSettimana(chiave, oggiIso)),
              h(
                "span",
                { style: "font-weight:600;color:var(--label-tertiary);text-transform:none;letter-spacing:0" },
                `${righe.length} · ${durataUmana(righe.reduce((t, x) => t + (Number(x.durataSec) || 0), 0))}`
              )
            ),
            lista
          )
        );
      }
      aggiungi(lista, rigaAllenamento(a, note));
    }
    const nascosti = tutti.length - mostrati.length;
    if (nascosti > 0) {
      const altri = h(
        "button.btn.secondary",
        { onclick: () => disegnaFino(quanti + 200) },
        nascosti === 1 ? "Mostra l'ultimo" : `Mostra gli altri ${nascosti}`
      );
      aggiungi(contenitore, h("div.btn-wrap", altri));
    }
  };
  disegnaFino(A_VISTA);
  aggiungi(wrap, contenitore);

  if (vecchieExtra.length) aggiungi(wrap, cartaVecchieExtra(vecchieExtra, ridisegna));

  aggiungi(wrap,
    h("div.group",
      h("p.footnote",
        `${tutti.length} ${tutti.length === 1 ? "allenamento" : "allenamenti"} registrati dall'orologio. ` +
          "I numeri li scrive lui e l'app non li tocca. Il talk-test invece lo scrivi tu, in fondo alla scheda di una " +
          "camminata, di una corsa o di un'escursione: è l'unica cosa qui dentro che l'orologio non può sapere, arriva " +
          "al coach, e fa valere la giornata come giornata di allenamento nel punteggio Salute. Senza risposta la " +
          "giornata resta fuori dal conto, non vale zero."
      )
    )
  );
  return wrap;
}

function titoloSettimana(lunediIso, oggiIso) {
  const questa = lunedi(oggiIso);
  if (lunediIso === questa) return "Questa settimana";
  if (lunediIso === lunedi(giorniIndietro(questa, 1))) return "Settimana scorsa";
  const d = new Date(lunediIso + "T00:00:00");
  const f = new Date(lunediIso + "T00:00:00");
  f.setDate(f.getDate() + 6);
  const stessoMese = d.getMonth() === f.getMonth();
  return stessoMese
    ? `${d.getDate()}–${f.getDate()} ${MESI[f.getMonth()]}`
    : `${d.getDate()} ${MESI[d.getMonth()].slice(0, 3)} – ${f.getDate()} ${MESI[f.getMonth()].slice(0, 3)}`;
}

function rigaAllenamento(a, note) {
  const numeri = [
    durataOrologio(a.durataSec),
    a.kcalAttive != null ? `${Math.round(a.kcalAttive)} kcal` : null,
    a.km != null ? `${num(a.km, 2)} km` : null,
    a.fcMedia != null ? `${Math.round(a.fcMedia)} bpm` : null,
  ].filter(Boolean);
  const giorno = GIORNI_ABBR[new Date(a.data + "T00:00:00").getDay()];
  const talk = haTalkTest(a) ? note.get(a.uuid)?.talkTest || null : null;
  return h(
    "button.row",
    { onclick: () => (location.hash = `#/allenamenti?id=${encodeURIComponent(a.uuid)}`) },
    // Il punto colorato del tipo: rende l'elenco leggibile senza leggerlo.
    h("span", {
      style: `width:10px;height:10px;border-radius:50%;background:${coloreTipo(a.tipo)};flex:none;margin-right:12px`,
    }),
    h(
      "div.main",
      h("span.title", nomeAllenamento(a)),
      h("span.sub", `${giorno} ${dataBreve(a.data)} · ${a.fine ? `${a.inizio}–${a.fine}` : a.inizio || "—"}`),
      h("span.sub", numeri.join(" · ")),
      talk ? h("span.sub", { style: "color:var(--label)" }, BREVE_TALK[talk]) : null
    ),
    h("span.chevron", "›")
  );
}

/** Le tre pastiglie che salvano il talk-test senza uscire dall'elenco. */
function bloccoRisposta(a, ridisegna) {
  const giorno = GIORNI_ABBR[new Date(a.data + "T00:00:00").getDay()];
  const scelte = h(
    "div.scelte",
    { style: "justify-content:flex-start;margin:10px 0 0" },
    ...store.TALK_TEST.map((t) =>
      h(
        "button",
        {
          "aria-pressed": "false",
          onclick: unaVoltaSola(async () => {
            const nota = await store.notaAllenamento(a.uuid);
            await store.salvaNotaAllenamento(a.uuid, { talkTest: t.id, nota: nota?.nota || null });
            toast("Segnato.");
            await ridisegna();
          }),
        },
        RISPOSTA_BREVE[t.id] || t.testo
      )
    )
  );
  return h(
    "div",
    h(
      "div",
      { style: "display:flex;align-items:baseline;gap:8px" },
      h("span", { style: "width:9px;height:9px;border-radius:50%;background:var(--label);flex:none" }),
      h("span", { style: "font-size:16px;font-weight:700" }, nomeAllenamento(a)),
      h(
        "span",
        { style: "font-size:13px;color:var(--label-secondary);margin-left:auto;white-space:nowrap" },
        `${giorno} ${dataBreve(a.data)} · ${durataOrologio(a.durataSec)}`
      )
    ),
    scelte
  );
}

/** La carta che chiude la vecchia sezione Extra: si vedono e si buttano. */
function cartaVecchieExtra(righe, ridisegna) {
  const elenco = righe
    .slice(0, 8)
    .map((x) => `${x.tipo} del ${dataBreve(x.data)}`)
    .join("\n");
  return h(
    "div.group",
    h("h2", "Attività scritte a mano"),
    h(
      "div.list",
      h(
        "button.row.danger",
        {
          onclick: unaVoltaSola(async () => {
            const scelta = await chiedi({
              titolo: righe.length === 1 ? "Eliminare l'attività?" : `Eliminare tutte e ${righe.length}?`,
              testo:
                `${elenco}${righe.length > 8 ? `\n…e altre ${righe.length - 8}` : ""}\n\n` +
                "Erano registrate a mano nella vecchia sezione Extra. Le stesse uscite l'orologio le ha già scritte da " +
                "solo, e da qui in avanti il talk-test si risponde sul suo allenamento.\n\n" +
                "Le giornate che valevano come allenamento solo grazie a queste righe tornano a essere giornate senza " +
                "allenamento nel punteggio Salute. Non si può disfare.",
              opzioni: [{ etichetta: "Eliminale tutte", valore: "elimina", stile: "destructive" }],
            });
            if (scelta !== "elimina") return;
            const quante = await store.eliminaTutteLeExtra();
            toast(quante === 1 ? "Attività eliminata." : `${quante} attività eliminate.`);
            await ridisegna();
          }),
        },
        h(
          "div.main",
          h("span.title", `Eliminale tutte (${righe.length})`),
          h("span.sub", "restano dalla vecchia sezione Extra: le stesse uscite ci sono già qui sopra")
        ),
        h("span.chevron", "›")
      )
    ),
    h(
      "p.footnote",
      "Finché sono in archivio continuano ad arrivare al coach e a far valere quelle giornate come giornate di " +
        "allenamento. Questa riga sparisce da sola quando non ce n'è più nessuna."
    )
  );
}

// ---------- il dettaglio ----------

async function dettaglio(uuid, { ridisegna }) {
  const wrap = h("div.screen");
  const a = (await store.allenamentiWatch()).find((x) => x.uuid === uuid);
  if (!a) {
    aggiungi(wrap, intestazione("Allenamento", { etichetta: "Indietro", onclick: () => indietro("allenamenti") }));
    aggiungi(wrap, h("div.empty", h("h3", "Allenamento non trovato")));
    return wrap;
  }
  aggiungi(wrap,
    intestazione(dataBreve(a.data), { etichetta: "Indietro", onclick: () => indietro("allenamenti") })
  );

  const nota = await store.notaAllenamento(uuid);

  /* La testata come la scrive Salute: il nome dell'allenamento grande, sotto le
     calorie in verde, poi giorno e orario, poi da dove viene il dato. */
  const dataEstesa = (() => {
    const d = new Date(a.data + "T00:00:00");
    return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
  })();

  aggiungi(wrap,
    h(
      "div",
      { style: "padding:14px 16px 4px" },
      h(
        "h2",
        { style: "margin:0;font-size:32px;font-weight:800;letter-spacing:-1px;line-height:1.05" },
        nomeAllenamento(a)
      ),
      a.kcalAttive != null
        ? h(
            "p",
            { style: "margin:6px 0 0;font-size:26px;font-weight:800;letter-spacing:-0.6px;color:var(--green)" },
            String(Math.round(a.kcalAttive)),
            h("span", { style: "font-size:16px;font-weight:700;margin-left:4px" }, "KCAL")
          )
        : null,
      h(
        "p",
        { style: "margin:8px 0 0;font-size:15px;color:var(--label-secondary)" },
        `${dataEstesa}, ${a.fine ? `${a.inizio}–${a.fine}` : a.inizio || "—"}`
      ),
      h("p", { style: "margin:2px 0 0;font-size:15px;color:var(--label-secondary)" }, "Apple Watch")
    )
  );

  /* I numeri, nella stessa forma dell'orologio: etichetta normale sopra, numero
     grande e colorato sotto, con l'unità piccola attaccata. I colori sono quelli
     con cui li hai già visti sul polso, così cercarli qui costa zero. */
  const numeroGrande = (etichetta, valore, unita, colore, nota2) =>
    h(
      "div",
      h("p", { style: "margin:0;font-size:17px;color:var(--label)" }, etichetta),
      h(
        "p",
        { style: `margin:2px 0 0;font-size:34px;font-weight:800;letter-spacing:-1.2px;line-height:1.05;color:${colore};font-variant-numeric:tabular-nums` },
        valore,
        unita ? h("span", { style: "font-size:17px;font-weight:800;letter-spacing:0;margin-left:4px" }, unita) : null
      ),
      nota2 ? h("p", { style: "margin:2px 0 0;font-size:12px;color:var(--label-tertiary)" }, nota2) : null
    );

  const passo = passoMedio(a);
  const coppie = [
    a.kcalTotali != null ? numeroGrande("Chilocalorie totali", String(Math.round(a.kcalTotali)), "KCAL", "var(--battito)") : null,
    a.fcMedia != null ? numeroGrande("Media battito", String(Math.round(a.fcMedia)), "BPM", "var(--orange)") : null,
    a.km != null ? numeroGrande("Distanza", num(a.km, 2), "KM", "var(--accent)", passo ? `${passo} al km` : null) : null,
    a.fcMax != null
      ? numeroGrande("Battito massimo", String(Math.round(a.fcMax)), "BPM", "var(--orange)", a.fcMin != null ? `minimo ${Math.round(a.fcMin)}` : null)
      : null,
  ].filter(Boolean);

  const aDue = (voci) =>
    h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:18px" }, ...voci);

  aggiungi(wrap,
    h(
      "div",
      { style: "margin:14px 16px 0;background:var(--bg-grouped);border-radius:16px;padding:18px;display:grid;gap:18px" },
      numeroGrande("Durata allenamento", durataOrologio(a.durataSec), null, "var(--giallo)"),
      a.kcalAttive != null
        ? numeroGrande("Chilocalorie attive", String(Math.round(a.kcalAttive)), "KCAL", "var(--battito)")
        : null,
      ...(coppie.length ? [aDue(coppie.slice(0, 2))] : []),
      ...(coppie.length > 2 ? [aDue(coppie.slice(2, 4))] : [])
    )
  );

  // ---- lo sforzo ----
  if (a.sforzo != null) {
    const s = Math.max(1, Math.min(10, Math.round(a.sforzo)));
    aggiungi(wrap,
      h(
        "div",
        { style: "margin:12px 16px 0;background:var(--bg-grouped);border-radius:16px;padding:18px" },
        h("p", { style: "margin:0 0 10px;font-size:17px;color:var(--label)" }, "Sforzo"),
        h(
          "div",
          { style: "display:flex;align-items:center;gap:14px" },
          h(
            "span",
            {
              style:
                "width:38px;height:38px;border-radius:50%;background:color-mix(in srgb, var(--sforzo) 22%, transparent);" +
                "color:var(--sforzo);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px",
            },
            String(s)
          ),
          h("span", { style: "font-size:30px;font-weight:800;letter-spacing:-0.9px;color:var(--sforzo)" }, parolaSforzo(s)),
          h(
            "span",
            { style: "margin-left:auto;display:flex;align-items:flex-end;gap:4px;height:30px" },
            ...Array.from({ length: 4 }, (_, i) =>
              h("span", {
                style:
                  `width:6px;border-radius:2px;height:${9 + i * 7}px;` +
                  `background:${s > i * 2.5 ? "var(--sforzo)" : "var(--fill-tertiary)"}`,
              })
            )
          )
        )
      )
    );
  }

  // ---- la frequenza cardiaca ----
  /* Le caselle arrivano in due forme: `{min,max}` da adesso, un numero solo dai
     pacchetti scritti prima. Si normalizzano qui, così un allenamento importato
     ieri continua a disegnarsi — con barrette alte un pelo, che è la verità: di
     quel momento sappiamo un valore solo. */
  const caselle = Array.isArray(a.battito)
    ? a.battito.map((c) =>
        c == null ? null : typeof c === "number" ? { min: c, max: c } : Number.isFinite(c.min) ? c : null
      )
    : [];
  const quante = caselle.filter(Boolean).length;
  if (quante >= 3) {
    aggiungi(wrap,
      h(
        "div",
        { style: "margin:22px 16px 0" },
        h("p", { style: "margin:0 0 10px;font-size:22px;font-weight:800;letter-spacing:-0.6px" }, "Frequenza cardiaca"),
        graficoBattito({
          caselle,
          inizioSec: oraInSecondi(a.inizio),
          durataSec: a.durataSec || quante * 30,
          media: a.fcMedia ?? null,
        })
      )
    );
  }

  /* Un allenamento importato prima dell'aggiornamento ha solo quattro numeri:
     giorno, ora, durata e calorie. Il resto sta nel file di Salute e c'è sempre
     stato — era il lettore che non lo prendeva. Dirlo qui è l'unico modo perché
     non sembri che l'orologio non l'abbia misurato. */
  if (a.km == null && a.fcMedia == null && !a.fine && !Array.isArray(a.battito)) {
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Mancano dei numeri"),
        h(
          "p.footnote",
          "Questo allenamento è stato importato da una versione dell'app che leggeva solo durata e calorie. " +
            "Battito, sforzo, distanza e orario di fine sono nel file di Salute: rifai l'importazione e si riempiono da soli."
        ),
        h(
          "div.list",
          h(
            "a.row",
            { href: "#/salute" },
            h("div.main", h("span.title", "Vai a importare i dati da Salute")),
            h("span.chevron", "›")
          )
        )
      )
    );
  }

  aggiungi(wrap, bloccoTalkTest(a, nota, ridisegna));

  aggiungi(wrap,
    h("div.group",
      h("p.footnote",
        "Numeri scritti dall'orologio e importati da Salute: l'app non li cambia e li manda al coach così come sono. " +
          (haTalkTest(a)
            ? "Il talk-test e la nota sono gli unici campi scritti da te, stanno in un archivio a parte, e non spariscono se rifai l'importazione."
            : "Il talk-test qui non c'è: si risponde solo su camminate, corse ed escursioni, dove l'intensità la decidi tu andando. Su una sessione come questa la dicono carico e RPE, che stanno nel log della seduta.")
      )
    )
  );
  return wrap;
}

/* Il talk-test, in fondo alla scheda.
   Sta dopo i numeri e non prima per due motivi: quello che apri a vedere sono
   i numeri dell'orologio, e questa è l'unica cosa che invece scrivi tu — le
   cose da fare vanno in fondo, dopo quelle da leggere. Compare solo su
   camminate, corse ed escursioni: altrove la domanda non vuol dire niente. */
function bloccoTalkTest(a, nota, ridisegna) {
  if (!haTalkTest(a)) return null;
  const uuid = a.uuid;
  const talkAttuale = nota?.talkTest || null;
  const scelteTalk = h(
    "div.scelte",
    { style: "margin:12px 0 0;justify-content:flex-start" },
    ...store.TALK_TEST.map((t) =>
      h(
        "button",
        {
          "aria-pressed": talkAttuale === t.id ? "true" : "false",
          onclick: unaVoltaSola(async () => {
            const nuovo = talkAttuale === t.id ? null : t.id;
            await store.salvaNotaAllenamento(uuid, { talkTest: nuovo, nota: nota?.nota || null });
            toast(nuovo ? "Segnato." : "Risposta tolta.");
            await ridisegna();
          }),
        },
        RISPOSTA_BREVE[t.id] || t.testo
      )
    )
  );

  const scrittaNota = h("p", {
    style:
      "margin:14px 0 0;padding:2px 0 2px 12px;border-left:3px solid var(--separator);" +
      "font-size:15px;color:var(--label);line-height:1.45;white-space:pre-wrap",
  });
  if (nota?.nota) scrittaNota.textContent = nota.nota;

  return h(
    "div",
    { style: "margin:24px 16px 0;padding:18px 0 0;border-top:1px solid var(--separator)" },
    h("p", { style: "margin:0;font-size:20px;font-weight:800;letter-spacing:-0.5px" }, "Riuscivi a parlare?"),
    h(
      "p",
      { style: "margin:6px 0 0;font-size:13px;color:var(--label-secondary);line-height:1.4" },
      "Il talk-test è la sola misura di intensità che l'orologio non prende. Rispondendo, la giornata vale come " +
        "giornata di allenamento nel punteggio Salute, e la risposta arriva al coach."
    ),
    scelteTalk,
    nota?.nota ? scrittaNota : null,
    h(
      "div",
      { style: "margin:14px 0 0" },
      h(
        "button.btn.secondary",
        {
          onclick: unaVoltaSola(async () => {
            const scritto = await chiediTesto({
              titolo: nota?.nota ? "Correggi la nota" : "Scrivi una nota",
              valore: nota?.nota || "",
            });
            if (scritto === null) return;
            await store.salvaNotaAllenamento(uuid, { talkTest: talkAttuale, nota: scritto });
            toast(scritto ? "Nota salvata." : "Nota tolta.");
            await ridisegna();
          }),
        },
        nota?.nota ? "Correggi la nota" : "Aggiungi una nota"
      )
    )
  );
}

/* Un foglio con una casella di testo sola. Non esisteva: le note dell'app si
   scrivevano tutte dentro pannelli fatti apposta, e per una riga sola bastava
   questo. Torna il testo scritto, oppure null se hai annullato. */
async function chiediTesto({ titolo, valore = "" }) {
  const area = h("textarea", {
    rows: 4,
    style:
      "display:block;box-sizing:border-box;width:100%;border:0;background:var(--fill-tertiary);border-radius:10px;" +
      "padding:12px;font:inherit;font-size:17px;color:var(--label);resize:none",
    placeholder: "com'è andata, come ti sentivi…",
  });
  area.value = valore;
  const esito = await sheet((close) =>
    h(
      "div",
      h("h2", { style: "text-align:center" }, titolo),
      h("div", { style: "padding:14px 16px 0" }, area),
      h(
        "div.btn-wrap",
        { style: "display:grid;gap:12px" },
        h("button.btn", { onclick: () => close(area.value.trim()) }, "Salva"),
        h("button.btn.secondary", { onclick: () => close(null) }, "Annulla")
      )
    )
  );
  return typeof esito === "string" ? esito : null;
}
