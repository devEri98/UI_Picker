# ADR-0005 — Shadow DOM open per il pannello

- Stato: accettato
- Data: 2026-08-26

## Contesto

Il pannello viene inserito in applicazioni con CSS, design system e z-index non controllati. Deve restare leggibile senza contaminare l’host e senza dipendere dai suoi stili.

## Decisione

Montare il pannello in uno Shadow DOM `open`, con font di sistema, reset mirato e token semantici interni. Overlay e host del pannello appartengono alla root del picker e sono esclusi dalla selezione.

Lo Shadow DOM dell’applicazione ospitante e gli iframe non vengono attraversati nell’MVP.

## Alternative considerate

- DOM normale con classi prefissate: più semplice, ma vulnerabile a cascade, reset globali e collisioni.
- Shadow DOM `closed`: maggiore incapsulamento superficiale, ma ostacola test, diagnosi e integrazione senza fornire un confine di sicurezza reale.
- iframe per il pannello: isolamento forte ma focus, dimensionamento, clipboard e integrazione risultano sproporzionatamente complessi.

## Conseguenze

- test e query E2E devono entrare nella shadow root;
- le variabili CSS ereditabili dell’host non vengono usate come fonte autorevole;
- l’host del pannello necessita di una strategia z-index e di clamping nel viewport;
- `open` non è un confine di sicurezza: i dati devono essere già sanificati.

## Condizioni di revisione

Riconsiderare l’attraversamento dello Shadow DOM applicativo o degli iframe soltanto come funzionalità separata, con nuova review privacy e UX.
