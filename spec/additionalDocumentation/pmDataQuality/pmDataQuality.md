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
    Der Erhalt eines aktualisierten ControlConstructs (CC) startet die Bearbeitung des Gerätes durch den DPMDP.  
    Dem DPMDP ist nicht bekannt, für welche Geräte Daten zu erwarten wären.  
    D.h. es fehlt die Referenz für eine Vollständigkeitsaussage in Bezug auf Geräte und Gerätetypen.  
    Diese Anforderung wird im Rahmen des DPMDP nicht berücksichtigt.  
  - in Bezug auf 15min-Werte  
    Die gelieferten PM Daten sind mit Zeitstempeln versehen.  
    Vom letzten in der Vergangenheit erhaltenen Zeitstempel und dem letzten Zeitstempel aus dem aktuellen Batch lässt sich eine Beobachtungsdauer ableiten.  
    Aufgrund der 15min-Granularität der PM Daten ist es möglich, von dieser Beobachtungsdauer auf die Anzahl der zu erwartenden Werte zu schließen (z.B. 12 innerhalb einer Beobachtungsdauer von 3 Stunden).  
    In diese Richtung wird entwickelt.  

## Gespräch mit Performance Management am 2026-04-28

Die Anforderungen waren noch nicht klar, bzw. widersprüchlich hinsichtlich des Detaillierungsgrads und des Ziels der darauf aufbauenden Analysen.  

## Design

Mit nachfolgendem Design soll ein schneller Überblick über die zuletzt gelieferten PM Daten ermöglicht werden.  
Eine detailliertere Analyse könnte zunächst in den konsumierenden Tools erfolgen.  

**Methode**  
Die Daten zu den erhaltenen PM Daten werden permanent erfasst und weitergegeben.  

Die Erhebung erfolgt zusammen mit der Aufarbeitung der PM Daten eines Gerätes.  
Die Weitergabe über Kafka erfolgt am Ende der Bearbeitung aller Geräte eines MwdiReplica Updates.  

Die Erfassung der erhaltenen PM Daten ist Teil der Aufarbeitung der Rohdaten.  
Die Berechnung der erwarteten PM Daten geschieht in einer dedizierten Funktion, so dass die Berechnung der PM Daten Qualität ggf. gezielt erweitert oder ersetzt werden kann.  

**Ergebnisstruktur**  
Die gelieferte Qualitätsinformation ist nach  

``` text
  |_Gerät  
    |_Interface  
      |_Datum (im Format YYYY/MM/DD)  
```

strukturiert.  
Die erhaltenen und erwarteten PM Daten werden in absoluten Anzahlen dokumentiert.  

Eine Speicherung der Daten im konsumierenden Tool vorausgesetzt, ermöglicht dies in vielerlei Hinsicht zu zu filtern und zu aggregieren, beispielsweise  

- die Daten eines Gerätes über einen längeren Zeitraum
- die Daten eines Interfaces über einen längeren Zeitraum
- die Daten mehrerer Geräte am selben Tag

**Kriterium für "geliefert"**  
Bei Vorhandensein des 15min PM Datensets (Datenobjekt) gelten die PM Daten als geliefert.  
Das Vorhandensein individueller Attribute wird nicht abgeprüft.  

**Kriterium für "erwartet"**  
Die jüngste [period-end-time] im gegenwärtig ausgewerteten Batch markiert das Ende der aktuellen Beobachtungsperiode.  
Die jüngste [period-end-time] des zuvor ausgewerteten Batches markiert den Beginn der aktuellen Beobachtungsperiode.  
Die Beobachtungsdauer ergibt sich aus der Differenz zwischen Ende und Beginn der Beobachtungsperiode.  
Die Anzahl der erwarteten 15min PM Datensets berechnet sich zu Beobachtungsperiode / 15.  
Gegebenenfalls ist bis 24:00Uhr und ab 0:00 zu rechnen um die erwarteten Datensets auf zwei Tage aufzuteilen.  

**Visualisierung**  
Der DPMDP wird keine GUI haben; er wird die Daten zur Servicequalität nicht selbst darstellen.  

**Datenauslieferung**  
Im Prozess p1StreamPmData wird in einer Endlosschleife die Datenbank des MWDI nach dem DPMDP repliziert und anschließend alle geänderten CCs prozessiert.  
Die nach Geräten und Interfaces sortierten und mit Datum markierten Daten werden am Ende eines Durchlaufs (alle geänderten CCs wurden prozessiert) nach Kafka übergeben und anschließend gelöscht.  

**Alarmierung**  
Eine Alarmierung wird zunächst nicht unterstützt.  

## Konkretes Format

Das nach Kafka übergebene Datenobjekt hat das folgende Format:

```yaml
pm-data-quality:
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
                  x-key: date
                  items:
                    type: object
                    required:
                      - date
                      - received
                      - expected
                    properties:
                      date:
                        type: string
                        description: >
                          'date in the format YYYY/MM/DD'
                      received:
                        type: integer
                        description: >
                          'number of 15min PM records that have been received during the monitoring period'
                      expected:
                        type: integer
                        description: >
                          'number of 15min PM records that have been expected to arrive during the monitoring period'
```
