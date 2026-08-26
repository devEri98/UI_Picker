# Privacy e sicurezza

## Obiettivo

UI Target Picker genera contenuto destinato a essere copiato e condiviso. La minimizzazione dei dati è quindi un requisito del prodotto, non una funzionalità opzionale.

## Invarianti approvati

- nessuna richiesta di rete;
- nessuna telemetria;
- nessuna persistenza della sessione oltre la scheda;
- nessuna lettura dei valori correnti di input, textarea, password o controlli equivalenti;
- nessuna serializzazione di `outerHTML` nell’MVP;
- nessuna lettura dello stato interno delle istanze del framework;
- nessuna inclusione nelle build di produzione della demo;
- redazione configurabile prima della formattazione e della copia.
- rendering del pannello esclusivamente tramite API DOM sicure; niente `innerHTML`, `eval` o esecuzione di stringhe;
- callback di redazione senza accesso a nodi DOM, globali browser o istanze framework.

## Dati candidati ammessi

Solo quando utili e dopo redazione:

- rotta corrente;
- tag, ID e classi significative;
- percorso DOM relativo;
- ruolo e stati ARIA ammessi;
- testo visibile normalizzato e limitato;
- attributi identificanti esplicitamente ammessi;
- geometria, viewport e scroll;
- riferimento al componente prodotto dall’adapter.

## Dati esclusi per default

- valori dei controlli;
- password e token;
- cookie, storage e header;
- proprietà delle istanze framework;
- HTML completo;
- listener applicativi;
- richieste e risposte di rete;
- screenshot;
- dati inviati automaticamente a servizi esterni.

## Rischi da trattare nel design

| ID | Rischio | Trattamento richiesto |
|---|---|---|
| SEC-001 | Testo visibile con dati personali | Limite, redazione configurabile e preview prima della condivisione. |
| SEC-002 | Attributi con identificatori sensibili | Allowlist minima e callback di redazione. |
| SEC-003 | Picker incluso accidentalmente in produzione | Default no-op o entrypoint esplicito e controllo automatico della build. |
| SEC-004 | Iniezione di markup nel pannello | Rendering testuale sicuro, senza usare HTML non fidato. |
| SEC-005 | Clipboard non disponibile o negata | Errore visibile e fallback che non allarghi i dati raccolti. |
| SEC-006 | Dipendenza compromessa | Dipendenze runtime minime, lockfile, review e scansione in CI. |
| SEC-007 | Configurazione troppo permissiva | Default restrittivi e warning espliciti per l’opt-in a dati aggiuntivi. |
| SEC-008 | Testo visibile con dati personali non riconoscibili automaticamente | Preset strict, preview, copia esplicita, ambienti controllati e rischio residuo dichiarato. |
| SEC-009 | Dipendenze o workflow compromessi | Lockfile frozen, release age, script allowlist, dependency review e trusted publishing con provenance. |

## Gate di sicurezza dell’MVP

- nessun finding Critical aperto;
- nessun finding High senza decisione documentata;
- test automatici degli invarianti principali;
- threat model leggero approvato;
- rischi residui dichiarati nella release checklist.
