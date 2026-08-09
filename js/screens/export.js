import { h, toast, chiedi, dataBreve, dataLunga, aggiungi , isoDate } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { nomeLivello } from "../segnali.js";
import {
  logSeduta, bloccoSalute, bloccoProposte, bloccoAccettate, bloccoCorpo, bloccoSegnali,
  bloccoFumo, bloccoAcqua, intestazionePacchetto,
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
  { id: "segnali", nome: "Segnali aperti", sub: "quello che l'app ha notato e non è una proposta" },
  { id: "fumo", nome: "Fumo", sub: "sigarette al giorno, se le stai contando" },
  { id: "acqua", nome: "Acqua", sub: "una risposta al giorno, se la stai contando" },
  { id: "corpo", nome: "Misure e indici", sub: "solo se registrate" },
];

/**
 * Fumo e acqua sono dichiarati nel brief, uno per profilo: chi non conta le
 * sigarette non deve vedere una casella «Fumo» che non accende niente. Una
 * voce che non fa niente sembra una voce che non funziona.
 */
function scelteDelProfilo() {
  const R = store.regole().salute || {};
  return SCELTE.filter(
    (s) =>
      (s.id !== "fumo" || R.contaSigarette !== false) &&
      (s.id !== "acqua" || R.contaAcqua === true)
  );
}

export async function render({ vaiA }) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Pacchetto", { etichetta: "Home", onclick: () => vaiA("oggi") }));

  const stato = { seduta: true, salute: true, proposte: true, segnali: true, fumo: true, acqua: true, corpo: false };
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
  let inCorso = false;
  // Comporre il pacchetto legge il database: due tocchi ravvicinati lanciano
  // due composizioni e la più lenta arriverebbe per ultima, lasciando a schermo
  // (e negli appunti) un pacchetto che non corrisponde alle scelte.
  let ultimaRichiesta = 0;
  const rigenera = async () => {
    const mia = ++ultimaRichiesta;
    inCorso = true;
    // Il testo vecchio non deve restare copiabile mentre se ne prepara uno
    // nuovo: si copierebbe un pacchetto che non corrisponde alle spunte.
    testoCorrente = "";
    anteprima.textContent = "Sto ricomponendo il pacchetto…";
    let testo;
    try {
      testo = await componi(stato);
    } catch (e) {
      // Senza questo, un errore in un solo blocco lasciava la schermata ferma
      // su «Sto ricomponendo…» per sempre, e non si capiva perché.
      if (mia !== ultimaRichiesta) return;
      inCorso = false;
      testoCorrente = "";
      aggiornaTasti();
      anteprima.textContent =
        `Il pacchetto non si è composto: ${e.message}\n\n` +
        "Togli una delle sezioni qui sopra per capire quale dà problemi, " +
        "oppure riprova. Nessun dato è stato toccato.";
      return;
    }
    if (mia !== ultimaRichiesta) return;
    testoCorrente = testo;
    inCorso = false;
    anteprima.textContent = testoCorrente || "Non hai selezionato niente.";
    aggiornaTasti();
  };

  // I due tasti di invio si spengono quando non c'è niente da mandare: prima
  // restavano accesi con l'anteprima che diceva «non hai selezionato niente», e
  // un tasto acceso che poi non fa niente è peggio di un tasto spento.
  const tastiInvio = [];
  const registra = (b) => { tastiInvio.push(b); return b; };
  const aggiornaTasti = () => {
    const pronto = Boolean(testoCorrente) && !inCorso;
    for (const b of tastiInvio) b.disabled = !pronto;
  };

  const lista = h("div.list");
  for (const s of scelteDelProfilo()) {
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
      registra(h(
        "button.btn",
        {
          disabled: true,
          onclick: async () => {
            if (inCorso) return toast("Aspetta un istante: sto ricomponendo il pacchetto.");
            if (!testoCorrente) return toast("Non c'è niente da copiare.");
            try {
              await navigator.clipboard.writeText(testoCorrente);
              toast("Copiato. Incollalo nella chat.");
            } catch {
              await chiedi({
                titolo: "Copia non riuscita",
                testo: "iOS non ha concesso la scrittura negli appunti. Tieni premuto sull'anteprima e usa Seleziona tutto → Copia.",
                opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
                annulla: false,
              });
            }
          },
        },
        "Copia il pacchetto"
      )),
      h("div", { style: "height:8px" }),
      registra(h(
        "button.btn.secondary",
        {
          disabled: true,
          onclick: () => {
            if (inCorso) return toast("Aspetta un istante: sto ricomponendo il pacchetto.");
            if (!testoCorrente) return toast("Non c'è niente da salvare.");
            const blob = new Blob([testoCorrente], { type: "text/markdown" });
            const url = URL.createObjectURL(blob);
            const a = h("a", { href: url, download: `coach-${isoDate()}.md`, style: "display:none" });
            document.body.append(a);
            a.click();
            setTimeout(() => {
              URL.revokeObjectURL(url);
              a.remove();
            }, 1500);
          },
        },
        "Salva come file"
      ))
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
    // La più recente per orario, non la prima trovata: con due allenamenti
    // nello stesso giorno veniva esportato quello più vecchio.
    const ultima = tutte
      .filter((s) => s.stato === "completata")
      .sort((a, b) => (b.oraFine || 0) - (a.oraFine || 0))[0];
    // Un allenamento ancora aperto oggi non entra nel pacchetto (i dati non
    // sono chiusi), ma va detto: senza, il coach riceveva il log di ieri
    // credendo che fosse l'ultima cosa fatta.
    const aperta = tutte.find((s) => s.stato === "inCorso");
    if (aperta) {
      const quante = (await store.serieDi(aperta.id)).length;
      pezzi.push(
        `NOTA: c'è un allenamento ancora aperto (${aperta.tipoNome} del ${dataBreve(aperta.data)}, ` +
          `${quante} ${quante === 1 ? "serie registrata" : "serie registrate"}). ` +
          `Non è in questo pacchetto perché non è stato chiuso: il log qui sotto è quello precedente.`
      );
      contenuto.push("avviso allenamento aperto");
    }
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
          // L'elenco congelato all'avvio: lo split di oggi può essere un altro.
          previsti: ultima.previstiElenco?.length
            ? ultima.previstiElenco
            : store.giornoSplit(ultima.tipoId)?.esercizi || [],
          completezza: await store.completezzaSeduta(ultima.id),
        })
      );
      contenuto.push(`allenamento del ${dataBreve(ultima.data)}`);
    }
  }

  if (stato.salute) {
    const giorni = await store.giorniSalute();
    const notti = await store.notti();
    const complete = (await store.allenamenti()).filter((s) => s.stato === "completata");
    const perData = new Map(complete.map((s) => [s.data, s.tipoNome]));
    // Anche l'allenamento ancora aperto va segnato: sulla riga di oggi il coach
    // deve vedere che c'è del lavoro registrato ma non chiuso.
    const apertaOggi = (await store.allenamenti()).find((s) => s.stato === "inCorso");
    if (apertaOggi && !perData.has(apertaOggi.data)) {
      perData.set(apertaOggi.data, `${apertaOggi.tipoNome}, non chiuso`);
    }
    // «Riposo» solo dove il riposo era previsto. Un giorno in cui il coach
    // aveva messo un allenamento e non l'hai fatto è un'altra cosa, e scriverlo
    // «Riposo» nascondeva al coach esattamente quello che gli serve vedere.
    const tipoGiorno = (data) => {
      if (perData.has(data)) return `Allenamento (${perData.get(data)})`;
      const previsto = store.giornoPrevisto(data);
      // Un giorno non ancora finito non è «non fatto»: il controllo di oggi
      // deve venire PRIMA, altrimenti l'allenamento di stasera risulta saltato.
      if (data >= isoDate()) return previsto ? `Oggi (previsto ${previsto.nome})` : "Oggi";
      if (previsto) return `Non fatto (era previsto ${previsto.nome})`;
      const org = store.origineGiorno(data);
      // Un evento in calendario che non è un allenamento — un promemoria per la
      // pressione, una visita — NON rende quel giorno «di tipo promemoria».
      // Prima finiva nella colonna Tipo al posto di «Riposo», e un giorno di
      // riposo passava per una giornata indefinita: il titolo dell'evento resta,
      // ma come nota fra parentesi, non come classificazione.
      if (org.sconosciuto) return `Riposo (in calendario: «${org.titolo}»)`;
      if (org.scaduta) return `Calendario non aggiornato (letto fino al ${dataBreve(org.fine)})`;
      if (org.oltreProgrammato) return "Non ancora programmato dal coach";
      if (org.nonLetta) return "Calendario non letto per quel giorno";
      return "Riposo";
    };
    if (giorni.length || notti.length) {
      const r = store.regole().finestre || {};
      pezzi.push(
        bloccoSalute({
          giorni,
          notti,
          obiettivo: await store.impostazione("obiettivoMovimentoKcal"),
          tipoGiorno,
          finestraMovimento: store.statoFinestra(giorni, {
            campo: "kcalAttive",
            settimane: r.movimento?.settimane ?? 3,
            minimoSettimana: r.movimento?.giorniMinSettimana ?? 5,
          }),
          finestraSonno: store.statoFinestra(notti, {
            campo: "durataMin",
            settimane: r.sonno?.settimane ?? 3,
            minimoSettimana: r.sonno?.nottiMinSettimana ?? 5,
          }),
        })
      );
      contenuto.push("dati salute");
    }
  }

  if (stato.proposte) {
    await store.inCoda(() => store.aggiornaProposte());
    const sospese = await store.proposteInSospeso();
    pezzi.push(bloccoProposte(sospese, nomeLivello));
    contenuto.push(`${sospese.length} ${sospese.length === 1 ? "proposta" : "proposte"}`);

    // Quelle già accettate cambiano l'obiettivo che l'app userà: il coach le
    // deve vedere anche se non deve più deciderle.
    const accettate = await store.proposteAccettate();
    const blocco = bloccoAccettate(accettate, store.esercizio);
    if (blocco) {
      pezzi.push(blocco);
      contenuto.push(`${accettate.length} accettate`);
    }
  }

  if (stato.segnali) {
    await store.inCoda(() => store.aggiornaSegnali());
    const avvisi = await store.segnali();
    const blocco = bloccoSegnali(avvisi);
    if (blocco) {
      pezzi.push(blocco);
      contenuto.push(`${avvisi.length} ${avvisi.length === 1 ? "segnale" : "segnali"}`);
    }
  }

  if (stato.fumo) {
    const primoGiorno = await store.fumoContatoDal();
    if (primoGiorno && store.regole().salute?.contaSigarette !== false) {
      const conteggi = await store.conteggioFumo();
      const oggi = isoDate();
      // La soglia scende a ogni nuovo minimo: serve quella di ogni giorno, non
      // una sola per tutti.
      const { limiti: limitiFumo } = await store.limitiFumo(oggi);
      const perGiorno = [];
      const d = new Date(oggi + "T00:00:00");
      // Gli stessi sette giorni della tabella salute: il coach li legge insieme.
      for (let i = 0; i < 7; i++) {
        const p = (n) => String(n).padStart(2, "0");
        const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        if (data < primoGiorno) break;
        perGiorno.push({ data, quante: conteggi.get(data) || 0, tollerate: limitiFumo.get(data) });
        d.setDate(d.getDate() - 1);
      }
      const blocco = bloccoFumo({
        perGiorno,
        tollerate: limitiFumo.get(oggi) ?? store.regole().salute?.sigaretteTollerate ?? 10,
        primoGiorno,
      });
      if (blocco) {
        pezzi.push(blocco);
        const tot = perGiorno.reduce((t, g) => t + g.quante, 0);
        contenuto.push(`${tot} ${tot === 1 ? "sigaretta" : "sigarette"} in ${perGiorno.length} ${perGiorno.length === 1 ? "giorno" : "giorni"}`);
      }
    }
  }

  if (stato.acqua && store.regole().salute?.contaAcqua === true) {
    const oggi = isoDate();
    const risposte = new Map((await store.giorniAcqua()).map((r) => [r.data, Boolean(r.bevuto)]));
    // Gli stessi sette giorni del fumo e della tabella salute: il coach li
    // legge insieme, e una finestra diversa per ogni blocco non si confronta.
    const perGiorno = [];
    const d = new Date(oggi + "T00:00:00");
    for (let i = 0; i < 7; i++) {
      const p = (n) => String(n).padStart(2, "0");
      const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      perGiorno.push({ data, bevuto: risposte.has(data) ? risposte.get(data) : null });
      d.setDate(d.getDate() - 1);
    }
    const blocco = bloccoAcqua({ perGiorno, litri: store.regole().salute?.acquaLitriBersaglio ?? 2 });
    if (blocco) {
      pezzi.push(blocco);
      const si = perGiorno.filter((g) => g.bevuto).length;
      const risposti = perGiorno.filter((g) => g.bevuto !== null).length;
      contenuto.push(`acqua ${si}/${risposti}`);
    }
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
      dateIndici: {
        peso: perTipo.get("peso")?.data,
        vitaOmbelico: perTipo.get("vitaOmbelico")?.data,
        fianchi: perTipo.get("fianchi")?.data,
      },
    });
    if (blocco) {
      pezzi.push(blocco);
      contenuto.push("misure");
    }
  }

  if (!pezzi.length) return "";
  return [intestazionePacchetto(contenuto), "", pezzi.join("\n\n---\n\n")].join("\n");
}
