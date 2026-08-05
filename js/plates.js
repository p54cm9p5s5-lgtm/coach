/* Calcolo dei dischi da montare a partire dall'inventario reale.
   I dischi si contano a coppie: quello che si monta va su entrambi i lati. */

export const INVENTARIO_DEFAULT = {
  barra: 10,
  // peso disco -> quantità totale posseduta (non per lato)
  dischi: { 20: 2, 5: 4, 2.5: 4, 2: 4, 1: 8 },
  // I manubri regolabili usano gli STESSI dischi del bilanciere: non è un
  // secondo magazzino, è lo stesso ferro montato altrove. I fissi sono un
  // elenco: un peso per ogni manubrio posseduto.
  manubri: { regolabili: { scaricoKg: 2, quantita: 2 }, fissi: [] },
};

const arrotonda = (n) => Math.round(n * 100) / 100;

/**
 * Combinazione per lato che raggiunge esattamente il totale, o null.
 * Ricerca esaustiva: l'approccio goloso sbaglia su casi reali
 * (10,5 kg per lato = 5 + 2,5 + 2 + 1, che il goloso non trova).
 * Preferisce le soluzioni con meno dischi, cioè quelle più comode da montare.
 */
export function combinazioneEsatta(totale, inv = INVENTARIO_DEFAULT) {
  const perLato = arrotonda((totale - inv.barra) / 2);
  if (perLato < -0.001) return null;
  if (Math.abs(perLato) < 0.001) return { perLato: [], totale: inv.barra, barra: inv.barra };

  const pesi = Object.keys(inv.dischi)
    .map(Number)
    .sort((a, b) => b - a);

  let migliore = null;

  const cerca = (i, resto, presi, quanti) => {
    if (Math.abs(resto) < 0.001) {
      if (!migliore || quanti < migliore.quanti) migliore = { presi: [...presi], quanti };
      return;
    }
    if (i >= pesi.length || resto < -0.001) return;
    if (migliore && quanti >= migliore.quanti) return;

    const peso = pesi[i];
    const max = Math.min(Math.floor(inv.dischi[peso] / 2), Math.floor(arrotonda(resto / peso) + 0.001));
    for (let n = max; n >= 0; n--) {
      if (n) presi.push({ peso, n });
      cerca(i + 1, arrotonda(resto - n * peso), presi, quanti + n);
      if (n) presi.pop();
    }
  };

  cerca(0, perLato, [], 0);
  if (!migliore) return null;
  return { perLato: migliore.presi, totale: arrotonda(totale), barra: inv.barra };
}

/** Tutti i carichi realizzabili con il bilanciere, in ordine crescente. */
export function carichiPossibili(inv = INVENTARIO_DEFAULT) {
  const pesi = Object.keys(inv.dischi).map(Number);
  const somme = new Set([0]);
  for (const p of pesi) {
    const maxPerLato = Math.floor(inv.dischi[p] / 2);
    const attuali = [...somme];
    for (const base of attuali) {
      for (let n = 1; n <= maxPerLato; n++) somme.add(arrotonda(base + n * p));
    }
  }
  return [...somme].map((s) => arrotonda(inv.barra + s * 2)).sort((a, b) => a - b);
}

/** Il carico realizzabile più vicino, con preferenza per il verso indicato. */
export function carichoPiuVicino(target, verso = 0, inv = INVENTARIO_DEFAULT) {
  const lista = carichiPossibili(inv);
  if (verso > 0) return lista.find((c) => c > target + 0.001) ?? lista[lista.length - 1];
  if (verso < 0) return [...lista].reverse().find((c) => c < target - 0.001) ?? lista[0];
  return lista.reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best), lista[0]);
}

/** Incremento minimo realizzabile sopra un dato carico (in kg totali). */
export function incrementoMinimo(daCarico, inv = INVENTARIO_DEFAULT) {
  const sopra = carichoPiuVicino(daCarico, 1, inv);
  return arrotonda(sopra - daCarico);
}

export function descriviDischi(totale, inv = INVENTARIO_DEFAULT) {
  const c = combinazioneEsatta(totale, inv);
  if (!c) return null;
  if (!c.perLato.length) return `bilanciere scarico (${inv.barra} kg)`;
  const parti = c.perLato.map((d) => `${d.n}×${String(d.peso).replace(".", ",")}`).join(" + ");
  return `bilanciere ${inv.barra} kg + ${parti} kg per lato`;
}


// ---------- manubri ----------
//
// Un manubrio si carica sui due lati come il bilanciere, quindi il suo peso è
// «scarico + 2 × per lato». La differenza sta nei dischi che servono davvero:
// per un esercizio a due manubri ogni disco va montato QUATTRO volte (due lati
// per due manubri), non due. Con quattro dischi da 2 kg si arriva a 4 kg per
// manubrio in coppia, ma a 6 kg se il manubrio è uno solo.
//
// `paio` distingue i due casi, e nella libreria è già scritto: «manubri» sono
// due (uno per mano), «manubrio» è uno.

const manubriDi = (inv) => inv?.manubri || {};

/** Quanti dischi di quel peso si possono usare, montando in modo simmetrico. */
const usabiliPerManubrio = (quanti, paio) => Math.floor(quanti / (paio ? 4 : 2));

/**
 * Combinazione per lato di UN manubrio, o null se quel peso non si compone.
 * Se il peso corrisponde a un manubrio fisso posseduto, lo dice: è la
 * soluzione più comoda e non consuma dischi.
 */
export function combinazioneManubrio(kg, inv = INVENTARIO_DEFAULT, paio = true) {
  const m = manubriDi(inv);
  const fissi = Array.isArray(m.fissi) ? m.fissi : [];
  const quantiFissi = fissi.filter((f) => Math.abs(f - kg) < 0.001).length;
  if (quantiFissi >= (paio ? 2 : 1)) return { fisso: true, totale: arrotonda(kg) };

  const reg = m.regolabili;
  if (!reg || !(reg.quantita >= (paio ? 2 : 1))) return null;

  const scarico = reg.scaricoKg ?? 0;
  const perLato = arrotonda((kg - scarico) / 2);
  if (perLato < -0.001) return null;
  if (Math.abs(perLato) < 0.001) return { perLato: [], scarico, totale: arrotonda(kg) };

  const pesi = Object.keys(inv.dischi || {})
    .map(Number)
    .sort((a, b) => b - a);
  let migliore = null;
  const cerca = (i, resto, presi, quanti) => {
    if (Math.abs(resto) < 0.001) {
      if (!migliore || quanti < migliore.quanti) migliore = { presi: [...presi], quanti };
      return;
    }
    if (i >= pesi.length || resto < -0.001) return;
    if (migliore && quanti >= migliore.quanti) return;
    const peso = pesi[i];
    const max = Math.min(
      usabiliPerManubrio(inv.dischi[peso], paio),
      Math.floor(arrotonda(resto / peso) + 0.001)
    );
    for (let n = max; n >= 0; n--) {
      if (n) presi.push({ peso, n });
      cerca(i + 1, arrotonda(resto - n * peso), presi, quanti + n);
      if (n) presi.pop();
    }
  };
  cerca(0, perLato, [], 0);
  if (!migliore) return null;
  return { perLato: migliore.presi, scarico, totale: arrotonda(kg) };
}

/** Tutti i pesi realizzabili per manubrio, in ordine crescente. */
export function carichiManubrio(inv = INVENTARIO_DEFAULT, paio = true) {
  const m = manubriDi(inv);
  const out = new Set();
  const fissi = Array.isArray(m.fissi) ? m.fissi : [];
  const conta = new Map();
  for (const f of fissi) conta.set(f, (conta.get(f) || 0) + 1);
  for (const [peso, quanti] of conta) if (quanti >= (paio ? 2 : 1)) out.add(arrotonda(peso));

  const reg = m.regolabili;
  if (reg && reg.quantita >= (paio ? 2 : 1)) {
    const scarico = reg.scaricoKg ?? 0;
    const somme = new Set([0]);
    for (const p of Object.keys(inv.dischi || {}).map(Number)) {
      const max = usabiliPerManubrio(inv.dischi[p], paio);
      for (const base of [...somme]) for (let n = 1; n <= max; n++) somme.add(arrotonda(base + n * p));
    }
    for (const s of somme) out.add(arrotonda(scarico + s * 2));
  }
  return [...out].sort((a, b) => a - b);
}

/** Il peso per manubrio realizzabile più vicino, col verso preferito. */
export function manubrioPiuVicino(target, verso = 0, inv = INVENTARIO_DEFAULT, paio = true) {
  const lista = carichiManubrio(inv, paio);
  if (!lista.length) return target;
  if (verso > 0) return lista.find((c) => c > target + 0.001) ?? lista[lista.length - 1];
  if (verso < 0) return [...lista].reverse().find((c) => c < target - 0.001) ?? lista[0];
  return lista.reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best), lista[0]);
}

export function descriviManubri(kg, inv = INVENTARIO_DEFAULT, paio = true) {
  const c = combinazioneManubrio(kg, inv, paio);
  if (!c) return null;
  const quanti = paio ? "ogni manubrio" : "il manubrio";
  if (c.fisso) return `${paio ? "manubri fissi" : "manubrio fisso"} da ${String(kg).replace(".", ",")} kg`;
  if (!c.perLato.length) return `${paio ? "manubri scarichi" : "manubrio scarico"} (${String(c.scarico).replace(".", ",")} kg)`;
  const parti = c.perLato.map((d) => `${d.n}×${String(d.peso).replace(".", ",")}`).join(" + ");
  return `${quanti}: ${String(c.scarico).replace(".", ",")} kg + ${parti} kg per lato`;
}

/** Due manubri o uno solo, secondo com'è scritto nella libreria. */
export function aPaio(def) {
  return (def?.attrezzo || "").toLowerCase() === "manubri";
}

/**
 * L'inventario dice qualcosa sui manubri?
 *
 * Un brief che non li dichiara è legittimo — è così che sono stati tutti i
 * brief fino a oggi — e in quel caso l'app non deve inventarsi né pesi
 * montabili né istruzioni: torna al passo da un chilo e non mostra niente.
 */
export function conosceManubri(inv = INVENTARIO_DEFAULT, paio = true) {
  return carichiManubrio(inv, paio).length > 0;
}
