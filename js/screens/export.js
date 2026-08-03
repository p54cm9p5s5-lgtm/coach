import { h, toast, chiedi, dataBreve, dataLunga, aggiungi } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { nomeLivello } from "../segnali.js";
import {
  logSeduta, bloccoSalute, bloccoProposte, bloccoCorpo, intestazionePacchetto,
} from "../export.js";

const ETICHETTE_MISURE = {
  peso: "Peso",
  vitaOmbelico: "Vita ombelico",
  vitaStretta: "Vita punto stretto",
  fianchi: "Fianchi",
  petto: "Petto",
  bicipiteRilassato: "Bicipite rilassato",
  coscia: "Coscia",
};

const SCELTE = [
  { id: "seduta", nome: "Log dell'ultimo allenamento", sub: "formato §12, con recuperi e densità reali" },
  { id: "salute", nome: "Dati salute e finestre", sub: "movimento, sonno, stato delle 3 settimane" },
  { id: "proposte", nome: "Proposte in sospeso", sub: "con le quattro domande già compilate" },
  { id: "corpo", nome: "Misure e indici", sub: "solo se registrate" },
];

export async function render({ vaiA }) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Pacchetto", { etichetta: "Home", onclick: () => vaiA("oggi") }));

  const stato = { seduta: true, salute: true, proposte: true, corpo: false };
  const anteprima = h("pre", {
    style:
      "margin:0;padding:14px;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-word;" +
      "font-family:ui-monospace,monospace;color:var(--label-secondary)",
  });
  const contenitoreAnteprima = h(
    "div",
    { style: "background:var(--bg-grouped);border-radius:12px;max-height:340px;overflow:auto" },
    anteprima
  );

  let testoCorrente = "";
  const rigenera = async () => {
    testoCorrente = await componi(stato);
    anteprima.textContent = testoCorrente || "Non hai selezionato niente.";
  };

  const lista = h("div.list");
  for (const s of SCELTE) {
    const spunta = h("input", { type: "checkbox", checked: stato[s.id] });
    spunta.addEventListener("change", async () => {
      stato[s.id] = spunta.checked;
      await rigenera();
    });
    aggiungi(lista, h("label.row", { style: "cursor:pointer" },
      h("div.main", h("span.title", s.nome), h("span.sub", s.sub)),
      spunta
    ));
  }

  aggiungi(wrap,
    h("div.group", h("h2", "Cosa includere"), lista),
    h("div.group", h("h2", "Anteprima"), contenitoreAnteprima),
    h(
      "div.btn-wrap",
      h(
        "button.btn",
        {
          onclick: async () => {
            if (!testoCorrente) return toast("Non c'è niente da copiare.");
            try {
              await navigator.clipboard.writeText(testoCorrente);
              toast("Copiato. Incollalo nella chat.");
            } catch {
              await chiedi({
                titolo: "Copia non riuscita",
                testo: "iOS non ha concesso la scrittura negli appunti. Tieni premuto sull'anteprima e usa Seleziona tutto → Copia.",
                opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
              });
            }
          },
        },
        "Copia il pacchetto"
      ),
      h("div", { style: "height:8px" }),
      h(
        "button.btn.secondary",
        {
          onclick: () => {
            if (!testoCorrente) return;
            const blob = new Blob([testoCorrente], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = h("a", { href: url, download: `coach-${new Date().toISOString().slice(0, 10)}.md`, style: "display:none" });
            document.body.append(a);
            a.click();
            setTimeout(() => {
              URL.revokeObjectURL(url);
              a.remove();
            }, 1500);
          },
        },
        "Salva come file"
      )
    ),
    h(
      "p.footnote",
      { style: "margin:14px 16px 0" },
      "Il pacchetto è testo: nessuna immagine, nessuno screenshot. I numeri arrivano dai dati registrati, non trascritti a mano."
    )
  );

  await rigenera();
  return wrap;
}

async function componi(stato) {
  const pezzi = [];
  const contenuto = [];

  if (stato.seduta) {
    const tutte = await store.allenamenti();
    const ultima = tutte.find((s) => s.stato === "completata");
    if (ultima) {
      const serie = await store.serieDi(ultima.id);
      const questionari = await store.questionariDi(ultima.id);
      pezzi.push(
        logSeduta({
          seduta: ultima,
          serie,
          questionari,
          esercizio: store.esercizio,
          giornoSplit: store.giornoSplit,
        })
      );
      contenuto.push(`allenamento del ${dataBreve(ultima.data)}`);
    }
  }

  if (stato.salute) {
    const giorni = await store.giorniSalute();
    const notti = await store.notti();
    if (giorni.length || notti.length) {
      const r = store.regole().finestre || {};
      pezzi.push(
        bloccoSalute({
          giorni,
          notti,
          obiettivo: await store.impostazione("obiettivoMovimentoKcal"),
          finestraMovimento: store.statoFinestra(giorni, {
            settimane: r.movimento?.settimane ?? 3,
            minimoSettimana: r.movimento?.giorniMinSettimana ?? 5,
          }),
          finestraSonno: store.statoFinestra(notti, {
            settimane: r.sonno?.settimane ?? 3,
            minimoSettimana: r.sonno?.nottiMinSettimana ?? 5,
          }),
        })
      );
      contenuto.push("dati salute");
    }
  }

  if (stato.proposte) {
    await store.aggiornaProposte();
    const sospese = await store.proposteInSospeso();
    pezzi.push(bloccoProposte(sospese, nomeLivello));
    contenuto.push(`${sospese.length} proposte`);
  }

  if (stato.corpo) {
    const tutte = await store.misure();
    const perTipo = new Map();
    for (const m of tutte) if (!perTipo.has(m.tipo)) perTipo.set(m.tipo, m);
    const ultime = [...perTipo.values()];
    const blocco = bloccoCorpo({
      misure: ultime,
      etichette: ETICHETTE_MISURE,
      indici: store.indici({
        altezzaCm: store.programma()?.atleta?.altezzaCm,
        peso: perTipo.get("peso")?.valore,
        vitaOmbelico: perTipo.get("vitaOmbelico")?.valore,
        fianchi: perTipo.get("fianchi")?.valore,
      }),
    });
    if (blocco) {
      pezzi.push(blocco);
      contenuto.push("misure");
    }
  }

  if (!pezzi.length) return "";
  return [intestazionePacchetto(contenuto), "", pezzi.join("\n\n---\n\n")].join("\n");
}
