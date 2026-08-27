/* Una schermata che si rompe apposta.
 *
 * Serve al banco in tools/rete.js: `provaLaRete()` chiede alla prova delle
 * schermate di disegnare questa, e pretende che se ne accorga. Senza un
 * guasto vero non c'è modo di sapere se quella prova controlla ancora.
 *
 * Non è raggiungibile dall'app: non è in nessuna rotta e nessuno la importa
 * tranne il banco. */
export async function render() {
  throw new Error("guasto di prova: questa schermata si rompe apposta");
}
