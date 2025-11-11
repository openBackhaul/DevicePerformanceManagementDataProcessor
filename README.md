# DevicePerformanceManagementDataProcessor  

Retrieves PM data from cache, processes it, and makes it available via Kafka.  

### Description  

The DevicePerformanceManagementDataProcessor (DPMDP) requires a replica of the ElasticSearch index of the MicroWaveDeviceInventory (MWDI).  

The DPMDP gets triggered by AttributeValueChanged notifications (via Kafka consumer interface) that are indicating updated historical performance data.  

Whenever triggered, the DPMDP reads the raw performance data from the copied cache and prepares value added data that is streamed to out-of-domain tools (via Kafka provider interface).  

The DPMDP implements a hard coded workflow for processing the raw data, but it also facilitates to de-/activate individual processing modules.  

The following modules are provided:

#### Plausibility

- name  
  Checks this for plausibility  

- name  
  Checks that for plausibility  

- p1CreateDsfpOutputObjectFromCache
  Checks for plausibility during creation of the initial DataStructureForProcessing output object
  - removes performance measurement records without 15min granularity
  - removes adaptive modulation counter records from PM records in which no time was spent (if time <= 0)
  - removes adaptive modulation capability records without useful information (if code-rate == -1)

#### Harmonization  

- name  
  Harmonizes the semantic meaning of the data in this aspect  

- name  
  Harmonizes the semantic meaning of the data in that aspect  

- p1SetOutOfRangeLevelValuesToDefault
  Replaces receive and transmit level counter values which are out of predefined (configurable) ranges,
  by a configurable default value (initially -1)

- p1SetTxLevelValuesWithCapabilityMismatchToDefault
  TB discussed - nur TX, ersetze TX-Werte, die nicht zur Capability passen auch auf -1

- p1ReplaceOnfDefaultValues
  Replaces ONF default values of counter attributes by a configurable default value (initally null for numbers, empty string for string attributes)

#### KPIs  

- name  
  Adds this derived performance indicator  

- name  
  Adds that derived performance indicator  

- p1Inquire15minAirInterfaceKpisFromCaca
  Adds derived performance indicators for AirInterface

- p1Inquire15minEthernetContainerKpisFromCaca
  Adds derived performance indicators for EthernetContainer


#### Supplementation  

- name  
  Adds this interface configuration information  

- name  
  Adds that interface status information  

- service für berechnung von interface identifiern (todo)
  berechnet linkId, unitId für AirInterface; interfaceName für EthernetContainer
  auf Basis von Ltp Structure und Ltp Augment

- service für berechnung von physical LinkAggregation
  stellt für AirInterfaces die LAG infos bereit
  auf Basis von Ltp Structure und Ltp Augment

---  

internal DPMDP module:
- p1SetMostRecentTimestampAndDatavInDeviceTable
  für jedes Interface in einem DsfpOutput object liest die Funktion das Timestamp des neuesten PM-Records aus
  und zählt wieviele Records in diesem DsfpOutput object für das Interface geliefert werden.
  Das mostRecentTimestamp wird im DPDMP deviceTable gespeichert, die Anzahl der Records für ein IF werden pro Tag
  gespeichert (und aufsummiert)