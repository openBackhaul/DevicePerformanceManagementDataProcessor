# Schemas  

**[DataStructureForProcessing (DSFP)](./DataStructureForProcessing.yaml)**  
Owned by p1ProcessingOrchestratorForHistoricalPmData for orchestrating the processing, sending and storing of the PM data.  

**[Output](./OutputApt.yaml)**  
Owned by p1ProcessingOrchestratorForHistoricalPmData for holding the result of processing the raw PM data.  
PM data format that is agreed with the Consumers and transmitted via Kafka.  

**[DataStore](./DataStore.yaml)**  
Format of the data in the persistent data store.  


---

Most likely no longer required:  

[ProcessingSequence](./ProcessingSequence.yaml)  
Checklist for processing the raw PM data.  

--- 

Support for updating the APT interface:

Differences between APTP's asynchronous response to the /v1/provide-historical-pm-data-of-device service and the PM data provided via the Kafka event streaming interface of the DPMDP can be visualized by creating a diff-report comparing [Output_AptpLegacy.yaml](./Output_AptpLegacy.yaml) and [OutputApt.yaml](./OutputApt.yaml).  
