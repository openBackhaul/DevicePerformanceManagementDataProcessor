# Service Quality Monitoring

## Anforderer

- Performance Management  
  - Sven  
  - Burghard  
- MW SDN Domain  
  Eine domaininterne Überwachung der Servicequalität wird zunächst nicht berücksichtigt.  

## Ursprüngliche Anforderung von Performance Management

- Service Quality Monitoring  
  Statistics about the completeness and quality of the PM data shall be provided  

## Gespräch mit Performance Management am 2026-04-23

**Messwerte**  

- Vollständigkeit der gelieferten PM Daten ( gelieferte Daten / erwartete Daten in [%] )  
  - in Bezug auf Geräte und Gerätetypen  
    Dem DPMDP ist nicht bekannt, für welche Geräte Daten zu erwarten wären.  
    D.h. es fehlt die Referenz für eine Vollständigkeitsaussage in Bezug auf Geräte und Gerätetypen.  
    Diese Anforderung wird im Rahmen des DPMDP nicht berücksichtigt.  
  - in Bezug auf 15min-Werte  
    Aufgrund der 15min-Granularität der PM Daten ist es möglich, von der Beobachtungsdauer auf die Anzahl der zu erwartenden Werte zu schließen (z.B. 96 innerhalb eines Tages).  
    In diese Richtung wird entwickelt.  

Hinweise:  
Der Erhalt eines aktualisierten ControlConstructs (CC) startet die Bearbeitung des Gerätes durch den DPMDP.  
Folglich kann ein Nichterhalten des CCs nicht als Indikator für fehlende PM Daten herangezogen werden.  
Der Erhalt des 24hours PM Datensets startet die Berechnung der Service Quality Parameter.  
Folglich kann ein Nichterhalten des 24hours PM Datensets nicht als Indikator für fehlende PM Daten herangezogen werden.  
=> Der DPMDP kann also immer nur über unvollständige, nicht jedoch über vollständig fehlende PM Daten informieren.

## Gespräch mit Performance Management am 2026-04-28

Die Anforderungen waren noch nicht klar.  
In den vorbereiteten Fragestellungen konnten keine Entschlüsse gefasst werden.  

## Vorübergehendes Design

### Erfassung

**Methode**  
Die Daten zur Qualität werden permanent erfasst und gespeichert.  
Die Erfassung ist Teil der Bearbeitung der Batches.  
Sie geschieht in einer dedizierten Funktion, so dass ggf. unter verschiedenen Methoden ausgewählt werden kann.  

**Ergebnisstruktur**  
Das Ergebnis der Qualitätserfassung ist in einem Objekt verpackt, so dass dieses generisch durch die Hierarchie der Funktionen gereicht werden kann.  
Das Objekt bezieht sich auf ein Gerät und es löst die Qualität an den einzelnen Interfaces auf.  

**Qualitätsbegriff**  
Zunächst wird die Qualität nur in Vollständigkeit der 15min PM Datensets gemessen.  
Es werden absolute Anzahlen zu den erwarteten und den gelieferten Datensätzen dokumentiert, so dass diese über Batchgrenzen hinweg zusammengefügt und über Interfaces oder ganze Geräte hinweg aggregiert werden können.  
Die Anzahlen werden nach Tag im Monat kategorisiert.  

**Kriterium für "geliefert"**  
Bei Vorhandensein des 15min PM Datensets (Datenobjekt) gelten die PM Daten als geliefert.  
Das Vorhandensein individueller Attribute wird nicht abgeprüft.  
Die Funktion muss aus der Schleife zur Iteration der 15min PM Datensets heraus aufgerufen werden, so dass ggf. die PM Daten beurteilt werden können.  

```yaml
deliveries:
  type: object
  required:
    - most-recent-period-end-time
    - delivery
  properties:
    most-recent-period-end-time:
      type: string
      description: >
        'mostRecentPeriodEndTime of the processed set of 15-min slice at this interface'
    delivery:
      type: array
      x-key: day
      items:
        type: object
        required:
          - day
          - count
        properties:
          day:
            type: integer
            description: >
              'day of month, during which the PM data has been received'
          count:
            type: integer
            description: >
              'amount of 15-min slices that complied with the quality requirements'
```

**Kriterium für "erwartet"**  
Die jüngste [period-end-time] im gegenwärtig ausgewerteten Batch markiert das Ende der aktuellen Beobachtungsperiode.  
Die jüngste [period-end-time] des zuvor ausgewerteten Batches markiert den Beginn der aktuellen Beobachtungsperiode.  
Die Beobachtungsdauer ergibt sich aus der Differenz zwischen Ende und Beginn der Beobachtungsperiode.  
Die Anzahl der erwarteten 15min PM Datensets berechnet sich zu Beobachtungsperiode / 15.  
Gegebenenfalls ist bis 24:00Uhr und ab 0:00 zu rechnen um die erwarteten Datensets auf zwei Tage aufzuteilen.  

### Visualisierung

Der DPMDP wird keine GUI haben; er wird die Daten zur Servicequalität nicht selbst darstellen.  

### Datenauslieferung  

Im Prozess p1StreamPmData wird in einer Endlosschleife die Datenbank des MWDI nach dem DPMDP repliziert und anschließend alle geänderten CCs prozessiert.  
Die nach Geräten und Interfaces sortierten und mit Tag markierten Daten werden am Ende eines Durchlaufs (alle geänderten CCs wurden prozessiert) nach Kafka übergeben und anschließend gelöscht.  

Es ist den konsumieren Tools überlassen die Daten über die einzelnen Batches zu konsolidieren und nach eigenen Bedarfen ggf. über Interfaces und/oder Geräte zu aggregieren.  

### Quality Output Format

Das nach Kafka übergebene Datenobjekt hat das folgende Format:

```yaml
quality:
  type: object
  required:
    - device
  properties:
    device:
      type: array
      x-key: mount-name
      items:
        type: object
        required:
          - mount-name
          - interface
        properties:
          mount-name:
            type: string
            description: >
              'mountName'
          interface:
            type: array
            x-key: uuid
            items:
              type: object
              required:
                - uuid
                - quality
              properties:
                uuid:
                  type: string
                  description: >
                    'uuid of AirInterface or EthernetContainer'
                quality:
                  type: array
                  x-key: day
                  items:
                    type: object
                    required:
                      - day
                      - received
                      - expected
                    properties:
                      day:
                        type: integer
                        description: >
                          'day of month, during which the PM data has been received'
                      received:
                        type: integer
                        description: >
                          'amount of received 15-min slices'
                      expected:
                        type: integer
                        description: >
                          'amount of expected 15-min slices'
```

### Alarmierung

Eine Alarmierung wird zunächst nicht unterstützt.
