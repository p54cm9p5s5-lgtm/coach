/* Lettura del blocco tecnico COACH-DATA dal master brief.
   Funzioni pure: estrazione, validazione, confronto. L'applicazione sta in store.js. */

export const VERSIONE_SUPPORTATA = 1;

const APERTURA = /<!--\s*COACH-DATA\s+v(\d+)\s*-->/i;
const CHIUSURA = /<!--\s*\/COACH-DATA\s*-->/i;

export function estraiBlocco(testo) {
  const apre = testo.match(APERTURA);
  if (!apre) {
    throw new Error(
      "Nel file non c'è il blocco COACH-DATA. Serve la versione del master brief che lo contiene in coda."
    );
  }
  const versione = Number(apre[1]);
  if (versione !== VERSIONE_SUPPORTATA) {
    throw new Error(
      `Il blocco è in versione v${versione}, l'app legge la v${VERSIONE_SUPPORTATA}. Non applico niente.`
    );
  }
  const dopo = testo.slice(apre.index + apre[0].length);
  const chiude = dopo.match(CHIUSURA);
  if (!chiude) throw new Error("Il blocco COACH-DATA è aperto ma non chiuso.");

  let corpo = dopo.slice(0, chiude.index);
  // Dentro al blocco possono esserci commenti HTML e un recinto ```json: si tolgono entrambi.
  corpo = corpo.replace(/<!--[\s\S]*?-->/g, "");
  corpo = corpo.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  if (!corpo) throw new Error("Il blocco COACH-DATA è vuoto.");

  try {
    return JSON.parse(corpo);
  } catch (e) {
    throw new Error(`Il blocco COACH-DATA non è JSON valido: ${e.message}`);
  }
}

export function valida(dati, libreria) {
  const problemi = [];
  const noti = new Set(libreria.map((e) => e.id));

  if (!Array.isArray(dati.split) || !dati.split.length) {
    problemi.push("Manca lo split settimanale.");
  }

  for (const giorno of dati.split || []) {
    const visti = new Set();
    if (!giorno.id || !giorno.nome) problemi.push("Un giorno dello split è senza id o nome.");
    if (typeof giorno.giorno !== "number" || giorno.giorno < 0 || giorno.giorno > 6) {
      problemi.push(`Giorno della settimana non valido in "${giorno.nome || giorno.id}".`);
    }
    for (const v of giorno.esercizi || []) {
      if (!noti.has(v.esercizioId)) {
        problemi.push(`Esercizio sconosciuto: "${v.esercizioId}" in ${giorno.nome || giorno.id}.`);
      }
      if (!(v.serie > 0)) problemi.push(`Serie non valide per ${v.esercizioId}.`);
      // Lo stesso esercizio due volte nello stesso giorno manderebbe in
      // confusione punteggio e proposte, che ragionano per esercizio.
      if (visti.has(v.esercizioId)) {
        problemi.push(`${v.esercizioId} compare due volte in ${giorno.nome || giorno.id}.`);
      }
      visti.add(v.esercizioId);
      // A tempo si controlla la durata, a ripetizioni il range: prima un
      // esercizio a tempo senza durata passava tutti i controlli e poi in
      // allenamento chiedeva «0 secondi».
      if (v.aTempo) {
        if (!(v.durataSec > 0)) problemi.push(`Durata non valida per ${v.esercizioId}.`);
      } else if (!(v.ripMax >= v.ripMin && v.ripMin > 0)) {
        problemi.push(`Range ripetizioni non valido per ${v.esercizioId}.`);
      }
    }
  }

  const inv = dati.inventario;
  if (inv) {
    if (!(inv.barra >= 0)) problemi.push("Peso della barra non valido nell'inventario.");
    for (const [peso, q] of Object.entries(inv.dischi || {})) {
      if (!(Number(peso) > 0) || !(q >= 0)) problemi.push(`Disco non valido: ${peso} kg ×${q}.`);
      if (q % 2 !== 0) problemi.push(`Disco ${peso} kg in numero dispari (${q}): non è montabile a coppie.`);
    }
  }

  return problemi;
}

/** Differenze leggibili tra programma attuale e nuovo, per la conferma. */
export function confronta(corrente, nuovo, libreria) {
  const nome = (id) => libreria.find((e) => e.id === id)?.nome || id;
  const righe = [];

  if (!corrente) {
    const tot = (nuovo.split || []).reduce((n, g) => n + (g.esercizi?.length || 0), 0);
    righe.push({ tipo: "nuovo", testo: `Primo caricamento: ${nuovo.split.length} giorni, ${tot} esercizi.` });
    return righe;
  }

  const mappa = (p) => {
    const m = new Map();
    for (const g of p.split || []) {
      for (const v of g.esercizi || []) m.set(`${g.id}::${v.esercizioId}`, { g, v });
    }
    return m;
  };

  const a = mappa(corrente);
  const b = mappa(nuovo);

  const giorniA = new Set((corrente.split || []).map((g) => g.id));
  const giorniB = new Set((nuovo.split || []).map((g) => g.id));
  for (const g of giorniB) if (!giorniA.has(g)) righe.push({ tipo: "aggiunto", testo: `Nuovo giorno: ${g}` });
  for (const g of giorniA) if (!giorniB.has(g)) righe.push({ tipo: "rimosso", testo: `Giorno rimosso: ${g}` });

  for (const [k, { g, v }] of b) {
    if (!a.has(k)) {
      righe.push({ tipo: "aggiunto", testo: `${g.nome}: aggiunto ${nome(v.esercizioId)}` });
      continue;
    }
    const vecchio = a.get(k).v;
    const cambi = [];
    if (vecchio.serie !== v.serie) cambi.push(`serie ${vecchio.serie} → ${v.serie}`);
    if (vecchio.ripMin !== v.ripMin || vecchio.ripMax !== v.ripMax) {
      cambi.push(`rip ${vecchio.ripMin}-${vecchio.ripMax} → ${v.ripMin}-${v.ripMax}`);
    }
    if ((vecchio.carico ?? null) !== (v.carico ?? null)) {
      cambi.push(`carico ${vecchio.carico ?? "—"} → ${v.carico ?? "—"} kg`);
    }
    if (cambi.length) {
      righe.push({ tipo: "modificato", testo: `${g.nome} · ${nome(v.esercizioId)}: ${cambi.join(", ")}` });
    }
  }

  for (const [k, { g, v }] of a) {
    if (!b.has(k)) righe.push({ tipo: "rimosso", testo: `${g.nome}: tolto ${nome(v.esercizioId)}` });
  }

  const rc = JSON.stringify(corrente.regole || {});
  const rn = JSON.stringify(nuovo.regole || {});
  if (rc !== rn) righe.push({ tipo: "modificato", testo: "Regole e soglie aggiornate." });

  const ic = JSON.stringify(corrente.inventario || {});
  const inuovo = JSON.stringify(nuovo.inventario || {});
  if (ic !== inuovo) righe.push({ tipo: "modificato", testo: "Inventario dischi aggiornato." });

  if (!righe.length) righe.push({ tipo: "uguale", testo: "Nessuna differenza rispetto al programma attuale." });
  return righe;
}
