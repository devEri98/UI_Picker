# Specifica normativa di estrazione DOM — MVP

> Stato: approvato nel Gate B. A parità di DOM, configurazione, resolver e clock, gli algoritmi seguenti devono produrre lo stesso modello sanificato.

## Principio di sicurezza

L’extractor non legge mai `value`, `defaultValue`, proprietà Angular o testo aggregato di un subtree. Non usa `innerText`, `textContent` del contenitore, `innerHTML` o `outerHTML`.

## Selezionabilità e soppressione della sequenza pointer

Un target puntatore è selezionabile quando il primo `Element` nel `composedPath()` esterno alla root del picker è connected, appartiene allo stesso `document` ed è ancora presente durante la sequenza. `html`, `body`, SVG e controlli disabilitati sono ammessi quando il browser produce l’evento; pannello, toast e overlay non lo sono mai.

In modalità di cattura, i listener capture installati su `window` applicano questa state machine al pulsante primario:

1. `pointerdown` su target valido: chiamare `preventDefault()` e `stopImmediatePropagation()`, quindi conservare `pointerId` e target senza estrarre;
2. sopprimere allo stesso modo gli eventuali eventi mouse compatibili della sequenza;
3. ogni `pointerup` con lo stesso `pointerId` viene soppresso; se il target coincide ed è ancora valido, catturare una sola volta, altrimenti cancellare il candidato senza cattura; in entrambi i casi marcare il possibile `click` successivo come già gestito;
4. `pointercancel`, blur o documento nascosto: sopprimere la sequenza già iniziata, cancellare il candidato e non catturare;
5. il successivo `click` della sequenza viene sempre soppresso e non genera una seconda cattura.

La soppressione precede l’estrazione e resta valida anche se questa fallisce. Eventi sulla UI del picker o senza target valido non vengono soppressi. Il contratto garantisce che azioni native e listener applicativi sul target o nella fase bubble non vengano eseguiti; non può annullare un listener globale capture registrato su `window` prima dell’abilitazione del picker, limite dichiarato dell’integrazione development-only.

## Boundary sensibili

L’intero subtree viene saltato quando il nodo corrente è:

- `input`, `textarea`, `select` o `option`;
- un elemento per cui `isContentEditable` è `true`;
- `[role="textbox"]`, `[role="searchbox"]` o un boundary aggiunto dalla configurazione;
- `script`, `style`, `template` o `noscript`;
- parte della root del picker;
- dentro uno Shadow DOM dell’applicazione o un iframe.

La regola vale anche quando il target catturato è un antenato normale del boundary. `label` non è un boundary: il suo testo statico può essere raccolto, mentre il controllo discendente viene saltato.

## Raccolta del testo

1. Visitare ricorsivamente i nodi discendenti in ordine documentale.
2. Prima di scendere in un elemento, applicare i boundary sensibili.
3. Saltare nodi con `hidden` o `aria-hidden="true"` e relativi discendenti.
4. Per ogni `Text` ammesso, leggere soltanto `nodeValue`.
5. Concatenare con un singolo spazio, collassare whitespace e normalizzare Unicode NFC.
6. Applicare redazione e limite configurato, massimo 80 code point nel preset balanced.

Il risultato è un suggerimento testuale diagnostico, non il calcolo completo dell’accessible name del browser.

## Firma dell’elemento

1. `tag`: `localName` minuscolo, massimo 64 code point.
2. `id`: candidato opzionale, massimo 128 code point dopo redazione.
3. Classi: `classList` in ordine DOM, deduplicate dal DOM, filtrate per prefissi configurati e limitate alle prime due; massimo 128 code point ciascuna.
4. Prefissi esclusi iniziali: `ng-`, `cdk-`, `_ngcontent`, `_nghost`.
5. Comporre `tag#id.class1.class2` usando `CSS.escape` sui token.

Se ID o classi vengono omessi, la firma rimane almeno il tag.

## Percorso DOM

- radice: host del componente più interno validato, altrimenti `document.body`;
- massimo 12 segmenti, conservando i segmenti più vicini al target;
- priorità del segmento: `data-testid` approvato, ID approvato, tag più classi approvate;
- aggiungere `:nth-of-type(n)` soltanto quando esiste più di un fratello con lo stesso tag;
- massimo 256 code point per segmento e 2048 per il path completo;
- valori attributo escapati con funzione dedicata; token CSS con `CSS.escape`;
- se il budget è superato, omettere i segmenti più esterni e registrare `truncated`.

Il path è diagnostico e non è un selettore stabile garantito.

## Semantica

- ruolo esplicito `role` prima;
- fallback limitato: `button`, `a[href]`, `select`, `textarea`, input testuali, checkbox e radio;
- nessuna pretesa di calcolare il ruolo accessibile completo;
- stati raccolti nell’ordine fisso definito dallo schema;
- i valori correnti dei controlli restano esclusi.

## Posizione applicativa

- usare `location.pathname` così come esposto dal browser, senza decodifica;
- `search` e `hash` esclusi per default;
- ogni stringa passa da limiti e redazione;
- nessuna origine, referrer o history viene raccolta.

## Resolver Angular

Fixture supportate nell’MVP:

| Caso | Risultato atteso |
|---|---|
| Standalone component host | Componente risolto. |
| Host annidati | Ancestry esterno → interno, senza duplicati. |
| Contenuto proiettato | Owning component quando disponibile, altrimenti host ancestry. |
| `getComponent` nullo ma `getOwningComponent` disponibile | Owning component risolto. |
| Debug globals assenti | `DEBUG_GLOBALS_MISSING`, cattura DOM riuscita. |
| Nessun componente | `NO_COMPONENT`, cattura DOM riuscita. |
| Selector fallback configurato | Nome normalizzato e adapter `angular`. |
| Resolver che lancia o output invalido | Componente omesso, errore recuperabile. |

L’istanza Angular viene usata soltanto per `constructor.name`, protetto da try/catch. Nessun’altra proprietà viene enumerata o letta.

## Budget

| Risorsa | Massimo predefinito |
|---|---:|
| Target per sessione | 20 |
| JSON UTF-8 per target | 8 KiB |
| JSON UTF-8 per sessione | 64 KiB |
| Testo visibile | 80 code point |
| Pathname | 512 code point |
| DOM path | 2.048 code point / 12 segmenti |
| Ancestry | 16 nomi |
| Stati | 16 coppie |
| Riferimenti | 8 coppie |
| Redazioni | 32 record |

Il conteggio byte usa `TextEncoder`. Prima di rifiutare un target si riducono deterministicamente: testo, ancestry esterna, path esterno, riferimenti opzionali. Ogni riduzione viene registrata finché c’è budget. Se il target resta oltre 8 KiB viene rifiutato con `TARGET_TOO_LARGE`; se la sessione supererebbe 64 KiB viene rifiutato con `SESSION_SIZE_LIMIT_REACHED`.

## Test canary obbligatori

- target antenato con password, input, textarea, select/option e contenteditable annidati;
- boundary sensibile annidato più volte;
- nodo nascosto e `aria-hidden`;
- ID, classi, path, pathname, attributi e resolver con PII/token;
- stringhe da 1–10 MiB, molte classi e ancestry profonda;
- virgolette, backslash, caratteri di controllo, emoji e Unicode equivalente;
- sibling omonimi e `nth-of-type`;
- assert assenza canary in candidato persistito, sessione, undo, subscriber, preview, formatter e clipboard.
