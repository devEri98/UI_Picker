# ADR-0004 — Redazione prima della memorizzazione

- Stato: accettato
- Data: 2026-08-26

## Contesto

Il testo visibile, la rotta e gli attributi possono contenere dati personali o segreti. Redigere soltanto al momento della copia lascerebbe valori grezzi nella sessione, nell’undo e nell’interfaccia.

## Decisione

Applicare allowlist, redazione, normalizzazione e limiti prima di creare `UiTargetV1`. Conservare nella sessione e nello snapshot di undo soltanto oggetti sanificati. Non esporre candidati grezzi in log, callback o eventi pubblici.

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
- callback personalizzate devono essere sincrone e non ricevono accesso a cookie, storage o stato framework.

## Condizioni di revisione

Qualsiasi ampliamento dei dati ammessi richiede review privacy e nuovi test di non regressione.
