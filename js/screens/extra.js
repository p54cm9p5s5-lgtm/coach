/* Extra: le attività fuori scheda — una corsa, una camminata, la bici, il nuoto.

   Non è un esercizio tracciato: niente carico, niente tecnica, niente RPE.
   Non ha obblighi — nessun giorno la prevede, quindi non farla non toglie
   niente. Ma farla conta: un giorno con un'attività registrata è un giorno in
   cui ti sei allenato, e vale come tale nel punteggio Salute (pieno, se hai
   risposto al talk-test).

   Un campo che non scrivi resta «non registrato», mai zero: è la stessa regola
   di tutte le altre tabelle dell'app. */

import { h, dataBreve, dataLunga, isoDate, aggiungi, toast, chiedi, sheet, durataUmana, num, unaVoltaSola } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";

/* Stessa forma dei campi degli altri pannelli dell'app, e testo al centro come
   tutto il resto: un valore allineato a sinistra dentro un pannello centrato
   sembra fuori posto. */
const STILE_CAMPO =
  "display:block;box-sizing:border-box;width:100%;margin:0 auto;border:0;background:var(--fill-tertiary);" +
  "border-radius:10px;padding:10px 12px;font:inherit;font-size:17px;color:var(--label);min-height:44px;text-align:center";
const ETICHETTA = "display:block;font-size:13px;color:var(--label-secondary);margin:0 0 5px;text-align:center";

const campo = (nome, etichetta, opzioni = {}) => {
  const input = h("input", {
    name: nome,
    type: opzioni.data ? "date" : opzioni.testo ? "text" : "number",
    inputmode: opzioni.numerico || !opzioni.testo ? "decimal" : "text",
    step: opzioni.step || "any",
    min: opzioni.testo ? null : "0",
    placeholder: opzioni.esempio || "",
    value: opzioni.valore ?? "",
    style: STILE_CAMPO,
  });
  return {
    input,
    nodo: h(
      "label",
      { style: "display:block;margin:0 0 12px;text-align:center" },
      h("span", { style: ETICHETTA }, etichetta),
      input
    ),
  };
};

/** Il foglio che registra un'attività. Restituisce true se ha salvato. */
async function registra(precompilato = {}) {
  const oggi = isoDate();
  let tipoScelto = precompilato.tipo || null;
  let talkScelto = precompilato.talkTest || null;

  // Stesso involucro di tutti gli altri campi: un'etichetta sopra e la casella
  // sotto. Prima il giorno era l'unico messo direttamente nel pannello, e
  // bastava una differenza di resa per farlo sembrare fuori squadra.
  const giorno = campo("data", "Giorno", { data: true, valore: precompilato.data || oggi });
  giorno.input.max = oggi;
  const data = giorno.input;

  // «Altro» da solo non dice niente: al coach arriverebbe una riga «Altro» e
  // basta, che è come non averla scritta. Scegliendolo si apre un campo per
  // dire cos'era davvero, e quella parola prende il posto di «Altro» ovunque —
  // nell'elenco, nel punteggio, nella tabella del pacchetto.
  const altroQuale = campo("altroQuale", "Che attività?", { testo: true, esempio: "kayak, arrampicata, padel…" });
  altroQuale.nodo.style.display = "none";
  const mostraAltro = () => {
    const serve = tipoScelto === "Altro";
    altroQuale.nodo.style.display = serve ? "block" : "none";
    if (serve) altroQuale.input.focus();
  };

  const bottoniTipo = store.TIPI_EXTRA.map((t) =>
    h(
      "button",
      {
        "aria-pressed": tipoScelto === t ? "true" : "false",
        onclick: (e) => {
          tipoScelto = t;
          for (const b of e.currentTarget.parentElement.children) {
            b.setAttribute("aria-pressed", b === e.currentTarget ? "true" : "false");
          }
          mostraAltro();
        },
      },
      t
    )
  );

  // Il talk-test è la sola risposta soggettiva, e resta facoltativa: senza, il
  // giorno non vale come allenamento nel punteggio, ma l'attività si registra
  // lo stesso e arriva al coach.
  const bottoniTalk = store.TALK_TEST.map((t) =>
    h(
      "button",
      {
        "aria-pressed": talkScelto === t.id ? "true" : "false",
        onclick: (e) => {
          talkScelto = talkScelto === t.id ? null : t.id;
          for (const b of e.currentTarget.parentElement.children) {
            b.setAttribute("aria-pressed", b.dataset.id === talkScelto ? "true" : "false");
          }
        },
        dataset: { id: t.id },
      },
      t.testo
    )
  );

  const durata = campo("durataMin", "Durata (minuti)", { esempio: "45", valore: precompilato.durataMin });
  // Testo, non numero: un campo numerico HTML scarta la virgola mentre la
  // scrivi, e «18,4» arrivava vuoto. La conversione la fa lo store.
  const km = campo("km", "Distanza (km)", { testo: true, numerico: true, esempio: "5,7", valore: precompilato.km });
  const ritmo = campo("ritmo", "Ritmo medio", { testo: true, esempio: "6'40\"", valore: precompilato.ritmo });
  const fcMedia = campo("fcMedia", "FC media", { esempio: "112", valore: precompilato.fcMedia });
  const fcMax = campo("fcMax", "FC massima", { esempio: "141", valore: precompilato.fcMax });
  const kcalAttive = campo("kcalAttive", "Kcal attive", { esempio: "320", valore: precompilato.kcalAttive });
  const kcalTotali = campo("kcalTotali", "Kcal totali", { esempio: "450", valore: precompilato.kcalTotali });
  const nota = campo("nota", "Nota", { testo: true, esempio: "facoltativa", valore: precompilato.nota });

  const avviso = h("p.footnote", { style: "margin:0 0 10px;color:var(--orange);text-align:center" }, "");

  const salvato = await sheet((close) =>
    h(
      "div",
      h("h2", { style: "text-align:center" }, "Registra un'attività"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:15px;text-align:center" },
        "Quello che non scrivi resta «non registrato», mai zero. Serve solo il tipo."
      ),
      h(
        "div",
        { style: "padding:14px 16px 0" },
        giorno.nodo,
        h("span", { style: ETICHETTA + ";margin:16px 0 0" }, "Tipo di attività"),
        h("div.scelte", ...bottoniTipo),
        altroQuale.nodo,
        h("span", { style: ETICHETTA + ";margin:16px 0 0" }, "Talk-test: riuscivi a parlare?"),
        // Una per riga: sono frasi, non parole, e affiancate andavano a capo
        // in mezzo («Frasi intere con / fiatone»).
        h("div.scelte.righe", ...bottoniTalk),
        h(
          "p",
          { style: "margin:8px 0 16px;font-size:12px;line-height:1.35;color:var(--label-tertiary);text-align:center" },
          "Se lo rispondi, la giornata vale come allenamento nel punteggio Salute."
        ),
        durata.nodo,
        km.nodo,
        ritmo.nodo,
        fcMedia.nodo,
        fcMax.nodo,
        kcalAttive.nodo,
        kcalTotali.nodo,
        nota.nodo,
        avviso
      ),
      h(
        "div.btn-wrap",
        { style: "display:grid;gap:12px" },
        h(
          "button.btn",
          {
            onclick: unaVoltaSola(async () => {
              if (!tipoScelto) {
                avviso.textContent = "Scegli il tipo di attività: è l'unica cosa che serve per forza.";
                return;
              }
              const scritto = altroQuale.input.value.trim();
              if (tipoScelto === "Altro" && !scritto) {
                avviso.textContent = "Hai scelto «Altro»: scrivi cos'era, altrimenti al coach arriva una riga che non dice niente.";
                altroQuale.input.focus();
                return;
              }
              // Un numero fuori scala non deve entrare in silenzio.
              //
              // Durata, km, battito e calorie si scrivono a mano, e una cifra
              // di troppo passava senza una parola: FC 999 e 400 di massima
              // sono finite in archivio in prova, e da lì nel pacchetto che
              // legge il coach. Come per le misure del corpo, non è un divieto
              // ma una domanda: se è giusto lo salvo.
              const LIMITI = [
                [durata, "Durata", 1, 600, "min"],
                [km, "Distanza", 0.05, 300, "km"],
                [fcMedia, "FC media", 30, 230, "bpm"],
                [fcMax, "FC massima", 30, 240, "bpm"],
                [kcalAttive, "Kcal attive", 1, 5000, "kcal"],
                [kcalTotali, "Kcal totali", 1, 6000, "kcal"],
              ];
              const strani = LIMITI.map(([campo, nome, min, max, unita]) => {
                const grezzo = String(campo.input.value ?? "").trim().replace(",", ".");
                if (!grezzo) return null;
                const v = Number(grezzo);
                if (!Number.isFinite(v) || v < min || v > max) return `${nome} ${grezzo} ${unita}`;
                return null;
              }).filter(Boolean);
              if (strani.length) {
                const scelta = await chiedi({
                  titolo: strani.length === 1 ? "Un numero fuori scala" : "Numeri fuori scala",
                  testo: `${strani.join(", ")}. È lontano da quello che un'attività può contenere: di solito è un tocco di troppo sulla tastiera. Se è giusto lo salvo, ma prima te lo chiedo.`,
                  opzioni: [
                    { etichetta: "È giusto, salva", valore: "salva" },
                    { etichetta: "Torno a correggere", valore: "correggi" },
                  ],
                  annulla: false,
                });
                if (scelta !== "salva") return;
              }
              await store.registraExtra({
                data: data.value,
                tipo: tipoScelto === "Altro" ? scritto : tipoScelto,
                talkTest: talkScelto,
                durataMin: durata.input.value,
                km: km.input.value,
                ritmo: ritmo.input.value,
                fcMedia: fcMedia.input.value,
                fcMax: fcMax.input.value,
                kcalAttive: kcalAttive.input.value,
                kcalTotali: kcalTotali.input.value,
                nota: nota.input.value,
              });
              close(true);
            }),
          },
          "Registra"
        ),
        h("button.btn.secondary", { onclick: () => close(false) }, "Annulla")
      )
    )
  );
  return salvato === true;
}

const descrivi = (x) =>
  [
    x.durataMin != null ? durataUmana(x.durataMin * 60) : null,
    x.km != null ? `${num(x.km, 2)} km` : null,
    x.ritmo ? `${x.ritmo}/km` : null,
    x.fcMedia != null ? `FC ${num(x.fcMedia, 0)}` : null,
    x.kcalAttive != null ? `${num(x.kcalAttive, 0)} kcal` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "nessun dato oltre al tipo";

export async function render({ ridisegna }) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Extra"));

  const righe = await store.extra();
  const oggi = isoDate();

  aggiungi(wrap,
    h(
      "div.hero",
      h("p.kicker", "Attività fuori scheda"),
      h("h2", "Corse, camminate, bici, nuoto"),
      h(
        "p",
        { style: "margin:8px 16px 0;color:var(--label-secondary);font-size:15px" },
        "Non è previsto da nessun giorno e non farlo non toglie niente. Ma quello che fai conta, e arriva al coach."
      )
    ),
    h(
      "div.btn-wrap",
      h(
        "button.btn",
        {
          onclick: unaVoltaSola(async () => {
            if (await registra()) {
              toast("Attività registrata.");
              await ridisegna();
            }
          }),
        },
        "Registra un'attività"
      )
    )
  );

  if (!righe.length) {
    aggiungi(wrap,
      h(
        "div.empty",
        h("h3", "Ancora niente"),
        h("p", "Quello che registri qui finisce nel pacchetto per il coach, in una tabella sua.")
      )
    );
    return wrap;
  }

  const lista = h("div.list");
  // Le prime sessanta, e le altre con un tocco.
  //
  // Erano sessanta e basta: con settantatré attività registrate le ultime
  // tredici non si potevano più vedere da nessuna parte, e niente lo diceva —
  // l'intestazione contava tutte, l'elenco no. Come nello Storico: non si
  // nasconde niente, si rimanda.
  const A_VISTA = 60;
  const riga = (x) => {
    const talk = store.TALK_TEST.find((t) => t.id === x.talkTest);
    return h(
        "button.row",
        {
          onclick: unaVoltaSola(async () => {
            const scelta = await chiedi({
              titolo: `${x.tipo} del ${dataBreve(x.data)}`,
              testo: [descrivi(x), talk ? `Talk-test: ${talk.testo.toLowerCase()}` : "Talk-test non risposto", x.nota]
                .filter(Boolean)
                .join("\n"),
              opzioni: [{ etichetta: "Elimina", valore: "elimina", stile: "danger" }],
            });
            if (scelta !== "elimina") return;
            await store.eliminaExtra(x.id);
            toast("Attività eliminata.");
            await ridisegna();
          }),
        },
        h(
          "div.main",
          h("span.title", `${x.tipo} · ${dataBreve(x.data)}${x.data === oggi ? " · oggi, giornata in corso" : ""}`),
          h("span.sub", descrivi(x)),
          talk ? h("span.sub", `talk-test: ${talk.testo.toLowerCase()}`) : h("span.sub", "talk-test non risposto")
        ),
        h("span.chevron", "›")
      );
  };

  for (const x of righe.slice(0, A_VISTA)) aggiungi(lista, riga(x));
  const restanti = righe.slice(A_VISTA);
  if (restanti.length) {
    const altre = h(
      "button.row",
      {
        onclick: () => {
          for (const x of restanti) lista.insertBefore(riga(x), altre);
          altre.remove();
        },
      },
      h(
        "div.main",
        h("span.title", restanti.length === 1 ? "Mostra l'ultima" : `Mostra le altre ${restanti.length}`),
        h("span.sub", `dal ${dataBreve(restanti[restanti.length - 1].data)} al ${dataBreve(restanti[0].data)}`)
      ),
      h("span.chevron", "›")
    );
    aggiungi(lista, altre);
  }

  aggiungi(wrap,
    h("div.group", h("h2", `Registrate (${righe.length})`), lista),
    h(
      "p.footnote",
      "Una giornata con un'attività registrata vale come giornata di allenamento nel punteggio Salute, ma solo se il talk-test è stato risposto: senza, resta fuori dal conto invece di valere zero."
    )
  );

  return wrap;
}
