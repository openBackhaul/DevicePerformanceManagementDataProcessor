# Busy Hour KPI Computation

### Busy Hour Definition

Die busy hour bezieht sich auf einen individuellen EthernetContainer (logisches Ethernet Interface).  
Es gibt genau eine busy hour pro Kalendertag.  
Die busy hour stellt den Beobachtungszeitraum dar, während dem an diesem Kalendertag die maximale Datenmenge übertragen wurde.  

Beobachtungszeiträume beginnen und enden zur vollen Stunde.  
D.h. es ergeben sich genau 24 Beobachtungszeiträume pro Kalendertag.  

Die Messung der übertragenen Datenmenge bezieht sich nicht auf Stunden, sondern auf 15 Minuten lange Perioden.  
Es wird unterstellt, dass die Geräte so programmiert sind, dass die 15-Minuten-Messperioden zur vollen Stunde (und 15, 30 bzw. 45 Minuten danach) beginnen.  

Die im Beobachtungszeitraum übertragene Datenmenge berechnet sich als Summe der Datenmengen, die in den vier Messperioden, die in den Beobachtungszeitraum fallen, gemessen wurden.  
Als Messwert wird das folgende Attribut ausgewertet /ethernet-container-2-0:ethernet-container-pac/ethernet-container-historical-performances/historical-performance-data-list/performance-data/total-bytes-output  
Die offizielle semantische Definition des Messwertes lautet: "Total number of Bytes of Ethernet traffic (before header compression) transmitted (in direction out of the device) during the measurement period."  
Die Maßeinheit des Messwertes lautet: Byte  
Es handelt sich damit um eine reine Mengenangabe, keine Flussgröße.  
Sollten weniger als die vier erwarteten Messwerte vorliegen, werden nur die vorhandenen Messwerte addiert.  

### Busy Hour Performance Indicators

Die Busy Hour Performance Indikatoren werden zusammen mit den anderen Performance Indikatoren des selben Kalendertages prozessiert und im resultCc gespeichert.  
Es wird unterstellt, dass die Geräte so programmiert sind, dass die 24-Stunden-Messperioden jeweils mit dem Kalendertag beginnen.  

Der Name und der Ort des kombinierte Datentyps lautet:  
/ethernet-container-2-0:ethernet-container-pac/ethernet-container-historical-performances/historical-performance-data-list/busy-hour  
Er erscheint ausschließlich in Instanzen von historical-performance-data-list mit einer granularity-period von 24 Stunden.  

Der kombinierte Datentyp enthält folgende Attribute:  
- period-end-time-list  
- label  
- throughput  
- capacity  
- utilization  
- errored-frames  
- dropped-frames  
- suspicious-result-flag  

#### busy-hour::period-end-time-list
Liste der Werte des period-end-time Attributes der bis zu vier Messperioden, die zusammen die busy hour bilden.  
Mit diesen Werten können die Messperioden für weitere Analysen adressiert werden.  

#### busy-hour::label
Die volle Stunde zu Beginn der busy hour wird in folgendem Format dargestellt: YYYY/MM/DD/hh/mm.  
Mit diesen Werten wird die busy hour in anderen Tools und Datenvorräten bezeichnet.  

#### busy-hour::throughput
Der busy hour throughput ist die Datenmenge, die während der busy hour hypothetisch im Mittel in einer (=1) der 3600 Sekunden gesendet wurde.  
Es handelt sich also um eine Flussgröße keine reine Menge.  
Die Einheit des busy hour throughput ist bit/s.  
D.h. die in Bytes ausgedrückte Datenmenge in der busy hour ist in bits umzurechnen und durch die statisch angenommene Länge des Beobachtungszeitraums (3600 Sekunden) zu teilen.  
Die Mittelwertbildung über 3600 Sekunden wirkt stark glättend.  
Dass die aufsummierte Länge der Messperioden von 3600 Sekunden abweichen könnte, wird ignoriert.  

#### busy-hour::capacity
Die in der busy hour verfügbare capacity, ist die dem EthernetContainer während der busy hour im Mittel bereitgestellte Übertragungskapazität.  
Hierfür werden die total-air-interface-interval-capacity Werte, die in den bis zu vier Messperioden, die in die busy hour fallen, dokumentiert wurden, addiert.  
Die semantische Definition des total-air-interface-interval-capacity Attributes lautet: "Sum of the intervalCapacity of all AirInterfaces in the aggregation group that is transporting this EthernetContainer in kbps."  
Die semantische Definition des intervalCapacity Attributes am AirInterface lautet: "AirInterface capacity weighted by duration of operation of the respective transmission mode in kbps."  
Die Einheit der total-air-interface-interval-capacity Werte ist kbit/s.  
Sie Summe der total-air-interface-interval-capacity Werte wird statisch durch vier geteilt und mit 1000 multipliziert.  
Die Einheit der busy-hour::capacity Werte ist bit/s.  
Dass weniger als vier Werte zu Verfügung stehen könnten, wird ignoriert.  

#### busy-hour::utilization
Die busy-hour::utilization berechnet sich als Quotient aus busy-hour::throughput und busy-hour::capacity und wird mit 100 multipliziert.  
Die Einheit der busy-hour::utilization Werte ist %.  
Es wird angenommen, dass im Falle von unvollständigen Messwerten nicht einzelne Performancewerte innerhalb einer Messperiode, sondern alle Daten einer Messperiode fehlen.  
D.h. obwohl das Fehlen von Messwerten sowohl bei der Berechnung des throughput als auch bei der Berechnung der capacity ignoriert wird, könnte sich dennoch ein halbwegs repräsentativer busy-hour::utilization Wert ergeben.  

#### busy-hour::errored-frames
Die bis zu vier errored-frames-input [frame] Werte, die in den Messperioden, die in die busy hour fallen, dokumentiert wurden, werden addiert.  
Die offizielle semantische Definition des errored-frames-input Attributes lautet: "Total number of errored frames received at this interface."  
Die errored-frames sind eine reine Mengenangabe und die Einheit ist frame.  
Dass weniger als vier Werte zu Verfügung stehen könnten, wird ignoriert.  

#### busy-hour::dropped-frames
Die bis zu vier dropped-frames-input [frame] Werte, die in den Messperioden, die in die busy hour fallen, dokumentiert wurden, werden addiert.  
Die offizielle semantische Definition des dropped-frames-input Attributes lautet: "Total number of Ethernet frames dropped at the receiver. The number of input Ethernet frames, for which no problems were encountered to prevent their continued processing, but were discarded (e.g., for lack of buffer space)."  
Die dropped-frames sind eine reine Mengenangabe und die Einheit ist frame.  
Dass weniger als vier Werte zu Verfügung stehen könnten, wird ignoriert.  


# Module

Das Problem zerfällt in folgende Segmente:  

- Kategorisierung der Datenmengen => p1CategorizeDataVolume  
  Die übertragenen Datenmengen, die in 15-Minuten-Messperioden dokumentiert wurden, werden nach Tagen und Label (Beobachtungszeiträume von einer Stunde) kategorisiert.  
  Neben total-bytes-output werden auch period-end-time, total-air-interface-interval-capacity, errored-frames-input und dropped-frames-input kategorisiert.  
  Da die Kategorisierung über die Grenzen der einzelnen Batches hinweg bestehen und vervollständigt werden muss, wird sie als Statusdaten in den DataStore geschrieben.  
  Falls 15-minute-values-by-day länger als zwei Einträge geworden ist, werden die ältesten Einträge gelöscht (älter als der Wert 1 ist der Wert 31).   

- Feststellen der busy hour und Berechnung der busy hour performance indicators => p1CalculateBusyHourPerformanceIndicators  
  Sobald die 24-Stunden-Messwerte eines Tages vorliegen, wird angenommen, dass mit dem aktuellen und den vorherigen Batch alle 15-Minuten-Messwerte eingetroffen und kategorisiert wurden.  
  Als Teil der Verarbeitung der 24-Stunden-Messwerte werden die Datenmengen in den jeweiligen Beobachtungszeiträumen aggregiert.  
  Die resultierenden 24 aggregierten Datenmengen werden verglichen.  
  Der Beobachtungszeitraum mit der höchsten aggregierten Datenmenge wird zur busy hour definiert.  
  In den 24-Stunden-Messdaten wird das busy-hour Attribut angelegt.  
  label und period-end-time-list werden mit den Werten der busy hour befüllt.  
  Die restlichen busy hour performance indicators werden wie oben beschrieben aus den Messwerten der busy hour berechnet und in das busy-hour Attribut eingetragen.  

# Aufrufe und Übergaben

- p1CategorizeDataVolume  
  p1CategorizeDataVolume wird von p1IterateEcPmSlices innerhalb der Schleife zur Bearbeitung der einzelnen Messperioden aufgerufen.  
  Nach dem Ausführen von p1CalculateUtilization wird geprüft, ob die Messperiode eine 15-Minuten-Messperiode ist.  
  Falls ja, wird p1CategorizeDataVolume aufgerufen.  
  Übergeben werden:  
  - historical-performance-data der aktuellen Messperiode  
  - status der p1CategorizeDataVolume Funktion ( /status-data=p1CategorizeDataVolume/status )  
  Zurückgegeben wird:  
  - status der p1CategorizeDataVolume Funktion  
```
status:
  type: object
  required:
    - 15-minute-values-by-day
  properties:
    15-minute-values-by-day:
      type: array
      x-key: day
      minItems: 0
      maxItems: 2
      items:
        type: object
        required:
          - day
          - 15-minute-values-by-label
        properties:
          day:
            type: integer
            minimum: 1
            maximum: 31
          15-minute-values-by-label:
            type: array
            x-key: label
            minItems: 24
            maxItems: 24
            items:
              type: object
              required:
                - label
                - 15-minute-values-by-period-end-time
              properties:
                label:
                  type: integer
                  minimum: 0
                  maximum: 23
                15-minute-values-by-period-end-time:
                  type: array
                  x-key: period-end-time
                  minItems: 0
                  maxItems: 4
                  items:
                    type: object
                    required:
                      - period-end-time
                    properties:
                      period-end-time:
                        type: string
                      total-bytes-output:
                        type: integer
                      total-air-interface-interval-capacity:
                        type: integer
                      errored-frames-input:
                        type: integer
                      dropped-frames-input:
                        type: integer
```

- p1CalculateBusyHourPerformanceIndicators  
  p1CalculateBusyHourPerformanceIndicators wird von p1IterateEcPmSlices innerhalb der Schleife zur Bearbeitung der einzelnen Messperioden aufgerufen.  
  Nach dem Ausführen von p1CalculateUtilization wird geprüft, ob die Messperiode eine 24-Stunden-Messperiode ist.  
  Falls ja, wird p1CalculateBusyHourPerformanceIndicators aufgerufen.  
  Übergeben werden:  
  - historical-performance-data der aktuellen Messperiode  
  - status der p1CategorizeDataVolume Funktion ( /status-data=p1CategorizeDataVolume/status )  
  Zurückgegeben wird:  
  - historical-performance-data der aktuellen Messperiode  




========  
hier geht's weiter
========  


  > Noch offen:  
  Es fehlen bis zu drei Messwerte zu Beginn des Batches.  
  Potential Solution: Die Summe aus den bis zu drei Messwerten, die am Ende eines Batches nicht mehr berücksichtigt werden, werden als Übertrag in ein neues /interface-metadata-list/busy-hour-calculation/total-bytes-output-spill-over Attribut eingetragen.  
  Das total-bytes-output-spill-over Attribut bekommt die Beschreibung "Sum of the total-bytes-output values that could not be consolidated into an hourly value at the end of a batch."  
  Der Wert des total-bytes-output-spill-over Attributs soll nur mit Datenmengen aus der selben Stunde verrechnet werden.  
  Es ist der Wert des /interface-metadata-list/most-recent-period-end-time Attributes zu beachten.]






# Noch offen:

- will SDN also provide 3DBH?

> => **Optimierungsvorschlag**:
> - wenn man in einem resultCC ein komplettes Interface verarbeitet hat, dann könnte man für den dadurch abgedeckten Zeitbereich das lokale Maximum bestimmen (also timestamp + maximaler BH base value)
> - für jedes Interface speichert man nur die Information zum lokalen Maximum (timestamp, Wert)
>   - das könnte man im resultCc abspeichern
>   - oder direkt im DataStore
> - wenn man dann das 24h Maximum bestimmen will, muss man nicht mehr alle (bis zu 96) BH base values für jedes Interface nochmal auslesen und daraus das Maximum bestimmen, sondern man muss nur das absolute Maximum anhand der lokalen Maxima berechnen
> - falls man das direkt im DataStore speichert, könnte man die Daten noch weiter verkürzen
>   - man muss nicht alle lokalen Maxima speichern, sondern eigentlich nur jedes Mal wenn man ein resultCc fertig bearbeitet hat, bestimmen, ob das aktuell hinterlegte Maximum immer noch das (bislang) absolute Maximum ist; falls die Daten im aktuellen resultCc ein höheres Maximum sind, wird das absolute Maximum dementsprechend aktualisiert
>   - d.h. man speicher (pro Interface): in welchem batch wurde das bislang größte Maximum gesehen (batch_timestamp), was war dessen periodEndTime und BH base value
>   - Frage: kann es vorkommen, dass das ein neues 24h Slice für Interface A später bereitgestellt wird, als für Interface B auf demselben device? (also in verschiedenen resultCcs)? => falls ja, wäre es gut, wenn man die resultCcs nicht 2x aus dem DataStore lesen muss...
>   - falls normierte Timestamps zu benutzen sind, muss man ggf. noch das Datum (yyyy-MM-dd) dazuspeichern, damit man nicht Daten von 2 Tagen vermischt.

### Step 1: Determine BH base values

For each 15min PM slice the BH base value is determined:
- iterate through the 15min PM slices of the currently processed interface in the resultCc
- for each slice aggregate the reference metric to an hourly value
  - input for the hourly value are the PM slices of the last hour
  - due to 15min granularity there should be 4 slices
  - it is possible that slices in between are missing, missing slices are not to be filled with slices from previous hours. I.e. in this case less than 4 slices are aggregated
  - the limitation is the periodEndTime of each slice, they may not be older than the periodEndTime of the last (current) slice minus 1 hour (rounded to minutes)
    - example: if the periodEndTime of the current slice is 15:07, only those of the previous 3 slices are input for the BH base value, where the periodEndTime is not older than 14:07.
    - see diagram for example
- how to hourly aggregate:
  - sum(up to 4 last reference metric values) / (number of relevant slices)
  - AirInterface: sum(*intervalCapacity* values) / (number of *intervalCapacity* values)
  - EthernetContainer: sum(*totalBytesOutput* values) / (number of *totalBytesOutput* values)

![bh_base_value_computation](./pictures/bh_base_value.png)

> [!NOTE]
> **TO BE DISCUSSED**:  
> 1. **Was soll an der Batch-Grenze passieren?**
>   - wird einfach ignoriert, dass die Daten in einem anderen resultCc liegen (verfälschte Base values)
>   - sollen die Daten aus dem vorherigen resultCc aus dem DataStore gelesen werden?
> 2. **Normierte Stunden?!**:
>   - falls die Customer auf normierte Stunden bestehen, müsste statt der periodEndTime die normalisierte periodEndTime benutzt werden.
>   - man berechnet BH reference values, die man gar nicht braucht; ggf. kann man das optimieren

## Step 2: Determine the Busy Hour (timestamp)

> [!NOTE]
> siehe Optimierungsvorschlag oben

The Busy Hour timestamp shall be determined, once a new 24h PM slice is seen during processing of a resultCc.  
This is, again, to be done per interface instance.  
A single resultCc only contains a subset of intervals of a days data. Therefore, additional batches (resultCcs) must be read from the dataStore.  

- To determine the BH, the 15min PM slices of the multiple resultCcs must be traversed
- input are the last up to 96 15min PM slices *s*, with relevant periodEndTimes:
  - with t = *s*.periodEndTime, tref = 24hSlice.periodEndTime (timestamps rounded to minutes)
  - t ∈ ( tref-24hours, tref ]
- find the 15min slice with the maximum BH base value
- the periodEndTime of this slice is the Busy Hour (timestamp)

## Step 3: Write the Busy Hour timestamp to resultCc

The Busy Hour timestamp of the interface is written into its 24h record in the current resultCc.

## Step 4: Calculate and provide the Busy Hour KPIs

Service-Vorschlag (für den Input interface uuid und BH timestamp):
- (0) stehen im DataStore schon die berechneten BH-KPIs? falls nein, weiter bei (1), sonst bei (6)
- (1) aus dem DataStore die passenden resultCc Kandidaten raussuchen
  - das batch_timestamp ist nur das neuestes currentAirInterface timestamp und daher nur bedingt aussagekräftig
- (2) auf diese resultCcs den FieldsFilter anwenden, so dass nur noch relevante Attribute übrig bleiben
- (3) dann in dem reduzierten resultCc für das Zielinterface prüfen, ob es ein record zum timestamp gibt
  - man kann hier ggf. erstmal prüfen, wie die erste und letzte periodEndTime aussehen (unter der Annahme, dass die von alt nach neu sortiert sind); wenn der Zeitraum nicht passt, kann man das resultCc verwerfen
  - ACHTUNG: es kann sein, dass die Daten über zwei resultCcs verteilt sind
  -> die 4 (oder weniger) relevanten 15min slices raussuchen
- (4) KPIs berechnen
- (5) Berechnete Werte in den DataStore schreiben
- (6) Daten bereitstellen

```
status:
  type: object
  required:
    - function-name
    - status
  properties:
    function-name:
      type: string
      enum:
        - 'p1CategorizeDataVolume'
    status:
      type: object
      required:
        - xyz
      properties:
        xyz:
          type: array
          x-key: day
          minItems: 0
          maxItems: 2
          items:
            type: object
            required:
              - day
              - lmn
            properties:
              day:
                type: integer
                minimum: 1
                maximum: 31
              lmn:
                type: array
                x-key: label
                minItems: 0
                maxItems: 24
                items:
                  type: object
                  required:
                    - label
                    - opq
                  properties:
                    label:
                      type: integer
                      minimum: 0
                      maximum: 23
                    opq:
                      type: array
                      x-key: period-end-time
                      minItems: 0
                      maxItems: 4
                      items:
                        type: object
                        required:
                          - period-end-time
                        properties:
                          period-end-time:
                            type: string
                          total-bytes-output:
                            type: integer
                          total-air-interface-interval-capacity:
                            type: integer
                          errored-frames-input:
                            type: integer
                          dropped-frames-input:
                            type: integer
```