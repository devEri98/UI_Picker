# ADR-0004 — Redazione prima della memorizzazione

- Stato: accettato
- Data: 2026-08-26

## Contesto

Il testo visibile, la rotta e gli attributi possono contenere dati personali o segreti. Redigere soltanto al momento della copia lascerebbe valori grezzi nella sessione, nell’undo e nell’interfaccia.

## Decisione

Applicare allowlist, redazione, normalizzazione e limiti prima di creare `UiTargetV1`. Conservare nella sessione e nello snapshot di undo soltanto oggetti sanificati. Non esporre candidati grezzi in log, subscriber o eventi pubblici.

Eccezione esplicita: il custom redactor è codice privilegiato e trusted del consumer e riceve una stringa grezza alla volta. Non riceve nodi DOM o globali. Il resolver custom costituisce un trust boundary separato perché riceve un `Element`; il suo output viene trattato come non fidato e sanificato.

Default:

- solo pathname della rotta;
- testo visibile limitato a 80 caratteri;
- query e hash esclusi;
- attributi in allowlist;
- valori dei controlli sempre esclusi.

## Alternative considerate

- redazione al momento della copia: consente preview più ricche ma conserva dati non necessari.
- nessun testo visibile: minimizza il rischio ma riduce fortemente la riconoscibilità del target.
- denylist: non può prevedere tutti i nomi di attributi sensibili e tende a fallire in modo permissivo.

## Conseguenze

- una redazione non può essere annullata senza una nuova cattura;
- preview, text e JSON condividono la stessa base sanificata;
- callback personalizzate devono essere sincrone e non ricevono accesso dalla libreria a cookie, storage o stato framework; possono comunque usare autonomamente globali disponibili al codice consumer.

## Condizioni di revisione

Qualsiasi ampliamento dei dati ammessi richiede review privacy e nuovi test di non regressione.
