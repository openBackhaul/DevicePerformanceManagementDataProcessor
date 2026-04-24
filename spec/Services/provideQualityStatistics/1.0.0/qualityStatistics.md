# Service Quality Monitoring

### Anforderer

- Performance Management  
  - Sven  
  - Burghard  

- MW SDN Domain  
  Eine domaininterne Überwachung der Servicequalität wird zunächst nicht berücksichtigt.  

### Ursprüngliche Anforderung von Performance Management  

- Service Quality Monitoring  
  Statistics about the completeness and quality of the PM data shall be provided  

### Detaillierte Anforderungen von Performance Management (gemäß Gespräch am 2026-04-23)  

**Messwerte**  
  - Vollständigkeit der gelieferten PM Daten ( gelieferte Daten / erwartete Daten in [%] )  
    - in Bezug auf Geräte und Gerätetypen  
      Dem DPMDP ist nicht bekannt, für welche Geräte Daten zu erwarten wären.  
      D.h. es fehlt die Referenz für eine Vollständigkeitsaussage in Bezug auf Geräte und Gerätetypen.  
      Diese Anforderung wird im Rahmen des DPMDP nicht berücksichtigt.  
    - in Bezug auf 15min-Werte  
      Aufgrund der 15min-Granularität der PM Daten ist es möglich, vor der Beobachtungszeit auf die Anzahl der zu erwartenden Werte zu schließen (z.B. 96 innerhalb eines Tages).  
      In diese Richtung wird entwickelt.  

**Erfassung**  
Die Daten zur Service Quality werden permanent erfasst und gespeichert.  
Die 15min-Werte werden gerät-/interface-/batchweise gezählt.  
Die Anzahl der prozessierten 15min-Werte wird in 24-hours Wert dokumentiert.  

**Visualisierung**  
Der DPMDP wird keine GUI haben; er wird die Daten zur Servicequalität nicht selbst darstellen.  

**Datenauslieferung**  
_[bitte auswählen und ggf. ändern und ergänzen:]_  
  - [ ] Die Daten werden über einen separaten REST Service auf Abruf bereitgestellt.  
        Dies dient in erster Linie zur Visualisierung des aktuellen Stands.  
        - [ ] Dabei werden die Daten über die Interfaces eines Gerätes aggregiert.  
        - [ ] Dabei werden die Daten über einen gleitenden Zeitraum von x Stunden aggregiert.  
        Der zugrundelegende Datenbestand ist jedoch (gegenwärtig) auf einen Zeitraum von bis zu 2Tagen begrenzt.  
        Falls eine längere Historie visualisiert werden sollte, müsste das darstellende Tool einen zyklischen Abruf implementieren.  
  - [ ] Die Daten werden im Kafkastream der PM Daten gerät-/interface-/batchweise bereitgestellt.  
        Dies dient in erster Linie zur Schaffung eines langfristigen, detaillierten Datenbestands im konsumierenden Tool.  
        Aggregation über Zeiträume, Interfaces oder Geräte erfolgt im konsumierenden Tool, ggf. flexibel konfigurierbar.  
  - [ ] Der DPMDP wird wie ein weiteres Gerät dargestellt, das seine eigenen PM Daten batchweise im Kafkastream liefert.  
        Dies dient in erster Linie zur Schaffung eines langfristigen, detaillierten Datenbestands im konsumierenden Tool.  
        Aggregation über Zeiträume, Interfaces oder Geräte erfolgt im DPMDP.  
  
_[Alternativen 2 und 3 könnten eventuell auch kombiniert werden.]_

**Alarmierung**
_[Klären, ob folgendes in DPMDP oder einem konsumierenden Tool erfolgt:]_
Fehlende 15min-Werte sollen erkannt und notifiziert werden, für potentielle Fehlerbehebung.  
Der Quotient aus gelieferte und erwartete Werte soll überwacht werden, bei Unterschreitung eines Schwellenwertes soll eine Notification gesendet werden.  
Zwei Fälle bekannt:
  - für Gerät wird gar nichts geliefert (Kriterium schwierig weil erwartete Gerät nicht bekannt sind)  
    - für individuelle Geräte aufgrund von Arbeiten am DCN
    - für ganze Gerätetypen aufgrund von systematischen Fehlern wie neue Firmware
  - für Gerät werden nur einige Werte geliefert, aber nicht alle

