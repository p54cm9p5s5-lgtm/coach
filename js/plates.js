/* Calcolo dei dischi da montare a partire dall'inventario reale.
   I dischi si contano a coppie: quello che si monta va su entrambi i lati. */

export const INVENTARIO_DEFAULT = {
  barra: 10,
  // peso disco -> quantità totale posseduta (non per lato)
  dischi: { 20: 2, 5: 4, 2.5: 4, 2: 4, 1: 8 },
  manubriRegolabili: true,
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
