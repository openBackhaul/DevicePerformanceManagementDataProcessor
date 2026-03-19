# p2DiscardIrrelevantPmRecords

Discards records that have already been processed in past from historical performance data list.  
Accepts both AirInterface and EthernetContainer PM records.  

> Bitte:
> Hier stand "Records are discarded, if they don't match the configured granularity (15min, 24h, both)
> Für busy hour Daten werden beide Granularitäten benötigt, bitte alle Elemente zu Auswahl und zu Löschung von Granularitäten beseitigen
> Alle Teile der Spezifikation dabei berücksichtigen (incl. parameter liste etc.)


### Diagram  

<p align="center">
  <img src="./p2DiscardIrrelevantPmRecords.png" alt="p2DiscardIrrelevantPmRecords diagram" width="400" />
</p>


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  

> Bitte:  
>- siehe bereits aktualisiertes p2DiscardIrrelevantPmRecords.plantuml  
  - offset Object für p2DiscardIrrelevantPmRecords wird als input übergeben  
  - granularity, mostRecentPeriodEndTime und mostRecentPeriodEndTime24 entfallen als input
  - offset wird pro interface mit mostRecentPeriodEndTime und mostRecentPeriodEndTime24 aus dem aktuellen batch aktualisiert  
>- interface.yaml aktualisieren, z.B. aber nicht nur  
>  - input  
>  - processing, z.B. aber nicht nur  
>    - describe new updateOffset precessing step  
>  - from statements  
>- danach diesen Block löschen  


### Variables

Please find a detailed description of the [variables](variables.yaml).

> Bitte:  
>- siehe bereits aktualisiertes p2DiscardIrrelevantPmRecords.plantuml  
>- variables.yaml aktualisieren
>- danach diesen Block löschen  


### Parameters

| Parameter Name               | Description                                                      |
|------------------------------|------------------------------------------------------------------|
| relevantGranularities        | regex pattern indicating which data granularities are to be kept |

> Bitte:  
>- relevantGranularities als Parameter aus allen anderen Spezifikationsbestandteilen löschen
>- das Kapitel Parameters hier löschen
>- danach diesen Block löschen  


### NPM Module  

[mw-sdn-p1-discard-irrelevant-pm-records](https://www.npmjs.com/package/mw-sdn-p1-discard-irrelevant-pm-records)  

