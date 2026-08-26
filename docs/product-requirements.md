# Requisiti di prodotto — MVP

## Problema

Le descrizioni testuali degli elementi UI sono spesso ambigue. Questo rallenta l’individuazione del codice corretto e aumenta il rischio che sviluppatori o assistenti AI intervengano sul componente sbagliato.

## Risultato desiderato

Un utente deve poter indicare visualmente un elemento in un’applicazione di sviluppo o staging controllato e ottenere rapidamente un pacchetto di contesto tecnico compatto, deterministico e condivisibile.

## Utenti

- sviluppatori;
- QA;
- designer;
- product owner che collaborano con figure tecniche o assistenti AI.

## Flusso principale

1. L’integratore abilita esplicitamente UI Target Picker in un ambiente consentito.
2. L’utente attiva temporaneamente o continuativamente la modalità di selezione.
3. Il sistema evidenzia il bersaglio corrente senza alterare il layout della pagina.
4. L’utente seleziona uno o più elementi.
5. Il sistema estrae soltanto i dati ammessi e applica la redazione configurata.
6. Il target viene aggiunto alla sessione in memoria.
7. L’utente copia o esporta l’intera sessione in formato testuale o JSON.

## Requisiti funzionali

| ID | Requisito |
|---|---|
| FR-001 | Evidenziare l’elemento DOM sotto il puntatore senza modificare il layout applicativo. |
| FR-002 | Supportare selezione temporanea e modalità di cattura continua tramite scorciatoie configurabili. |
| FR-003 | Impedire che la sequenza pointer di cattura attivi handler target/bubble o azioni native del bersaglio. |
| FR-004 | Raccogliere più target in una sessione ordinata in memoria. |
| FR-005 | Applicare un limite massimo configurabile alla sessione. |
| FR-006 | Estrarre rotta, firma dell’elemento, percorso DOM, semantica, stato ammesso, testo redatto e geometria quando disponibili. |
| FR-007 | Risolvere il componente framework tramite adapter; l’MVP deve includere Angular. |
| FR-008 | Esportare la sessione in testo umano deterministico. |
| FR-009 | Esportare la sessione in JSON conforme a uno schema versionato. |
| FR-010 | Consentire copia, rimozione dei target e svuotamento esplicito della sessione. |
| FR-011 | Comunicare successo e fallimento della copia senza dipendere soltanto dalla console. |
| FR-012 | Non permettere al picker di selezionare la propria interfaccia. |
| FR-013 | Rilasciare tutti i listener e gli elementi UI tramite un disposer idempotente. |
| FR-014 | Consentire la cattura da tastiera dell’elemento applicativo attualmente focalizzato. |
| FR-015 | Rendere reversibili rimozione e svuotamento fino alla successiva mutazione della sessione o a `destroy`. |
| FR-016 | Applicare budget deterministici a campi, collezioni, target e sessione prima dello storage. |
| FR-017 | Validare e fallire chiusa su output invalido di redattori e resolver custom. |

## Requisiti non funzionali

| ID | Requisito |
|---|---|
| NFR-001 | Nessuna richiesta di rete o telemetria nel codice e nelle dipendenze controllati dalla libreria; callback e resolver custom sono codice privilegiato del consumer. |
| NFR-002 | Nessuna lettura di valori o testo nei subtree sensibili, anche quando viene catturato un loro antenato. |
| NFR-003 | Estrazione stabile a parità di DOM, configurazione, resolver e clock; formatter byte-identico dato lo stesso modello sanificato. |
| NFR-004 | Nessuna firma del picker nella build production dell’applicazione demo. |
| NFR-005 | Core privo di dipendenze da Angular e dalle API globali del browser. |
| NFR-006 | Pannello e comandi utilizzabili da tastiera e compatibili con i requisiti di accessibilità definiti nel design UX. |
| NFR-007 | Supporto ufficiale iniziale per Chrome ed Edge Stable correnti su Windows 11, rivalidato a ogni release. |
| NFR-008 | Firefox e Safari non devono essere dichiarati supportati prima di test reali documentati. |
| NFR-009 | Ogni dipendenza runtime deve avere una giustificazione documentata. |
| NFR-010 | La cattura non deve sovrascrivere automaticamente la clipboard; la copia richiede un’azione esplicita. |

## Requisiti UX e accessibilità

| ID | Requisito |
|---|---|
| UXR-001 | Disattivare la selezione temporanea su keyup, blur, visibility change, perdita del documento attivo e destroy. |
| UXR-002 | Riposizionare il focus deterministicamente quando il controllo attivo viene rimosso o nascosto. |
| UXR-003 | Presentare il fallback clipboard come dialog accessibile con contenimento, chiusura e ritorno focus. |
| UXR-004 | Mantenere il focus visibile e non interamente coperto dal pannello. |
| UXR-005 | Usare controlli semantici, nomi accessibili e ordine focus coerente. |
| UXR-006 | Usare una regione status persistente per messaggi non critici e alert soltanto per errori operativi. |
| UXR-007 | Rispettare WCAG 2.2 AA, reflow 320 CSS px/zoom 400%, forced-colors e target size minima. |
| UXR-008 | Rispettare `prefers-reduced-motion` e non bloccare input durante le transizioni. |
| UXR-009 | Fornire alternative da tastiera e reset per trascinamento e posizione. |
| UXR-010 | Gestire contenuti lunghi e viewport stretti senza scroll orizzontale. |
| UXR-011 | Fornire feedback e recovery osservabili per cattura, limite, copia, rimozione e clear. |
| UXR-012 | Non attivare scorciatoie durante IME o in contesti editabili. |

## Criteri di successo

| ID | Evidenza richiesta |
|---|---|
| SM-001 | Test che dimostrano l’assenza di lettura dei valori esclusi. |
| SM-002 | Test o controllo statico che dimostrano assenza di rete e telemetria. |
| SM-003 | Controllo automatico della build production della demo senza firme del picker. |
| SM-004 | Test deterministici dei formatter text e JSON. |
| SM-005 | Contract test e casi E2E dell’adapter Angular. |
| SM-006 | Flusso completo di selezione e copia verificato su Chrome ed Edge. |
| SM-007 | Controlli automatici e manuali dell’accessibilità del pannello. |
| SM-008 | Quality gate con browser/OS/versioni, artifact e commit registrati. |
| SM-009 | Mutation test dell’esclusione production basato sul grafo dei moduli. |
| SM-010 | Canary annidati che dimostrano l’assenza di dati sensibili in ogni artefatto. |

## Non-goals

Sono fuori dall’MVP:

- adapter diversi da Angular;
- estensioni browser o editor;
- screenshot;
- integrazioni remote;
- telemetria;
- persistenza oltre la scheda corrente;
- uso in produzione;
- individuazione di file e righe sorgente.

## Assunzioni da validare

- Il formato testuale rimane più utile del solo JSON per la condivisione con persone e chat AI.
- L’integrazione come dipendenza di sviluppo è sufficientemente semplice per il primo pubblico.
- Chrome ed Edge coprono il gruppo iniziale di utilizzatori.
- Il resolver Angular può funzionare in modo utile senza accedere allo stato interno delle istanze.

## Gate della fase

Il perimetro dell’MVP è approvato. Il progetto può passare al Product e UX design; lo sviluppo non inizia finché flussi, stati, accessibilità e recovery non sono stati consolidati.
