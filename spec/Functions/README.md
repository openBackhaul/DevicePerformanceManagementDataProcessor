# Functions

The following modules are provided here.

#### Workflow  

- p1ProcessingOrchestratorForHistoricalPmData  
  Orchestrates the device-wise processing, sending and storing of PM data for 15 minutes periods  


#### Plausibility

- [p1CreateDsfpOutputObjectFromCache](./spec/Functions/specificFunctions/p1CreateDsfpOutputObjectFromCache/1.0.0/)  
  - creates the initial Output object inside the DataStructureForProcessing object  
  - removes data that has already been processed in past  
  - removes performance measurement records that are not of 15 minutes granularity  
  - removes empty adaptive modulation counter records (device did not operate this modulation)  
  - removes incomplete adaptive modulation capabilities (codeRate attribute has default value)  
  - terminates process if no new data remains  

<!-- todo: Further entries to be used for additional plausibility checks or for making parts of the p1CreateDsfpOutputObjectFromCache available for individual de-/activation. Entries to be deleted if not needed. -->

- name  
  Checks this for plausibility  

- name  
  Checks that for plausibility  


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
