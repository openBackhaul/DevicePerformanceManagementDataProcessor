# DevicePerformanceManagementDataProcessor  

Retrieves PM data from an MWDI database replica, processes it, formats it, transmits it via Kafka, and stores it in its own database.  


### Description  

The DevicePerformanceManagementDataProcessor (DPMDP) requires a replica of the ElasticSearch index of the MicroWaveDeviceInventory (MWDI).  

The DPMDP receives AttributeValueChanged (AVC) notifications (via Kafka consumer interface) sent by the MWDI.  

If the AVC notification is indicating updated historical performance data, the DPMDP reads raw data from the MWDI database replica.  

The DPMDP processes the raw performance data, formats it, and streams value added data to out-of-domain tools (via Kafka provider interface).  

Furthermore, the DPMDP stores the processed performance data in its own database for further usage.  


### Data Processing  

The DPMDP implements a hard coded workflow for processing the performance data, but it also facilitates to de-/activate individual processing Functions.  

The performance data, which has originally been retrieved from the devices, is processed in the following regards:  
  - Replacement and deletion of implausible data  
  - Harmonization in format and semantical meaning  
  - Completion by configuration information  
  - Completion by capability information  
  - Completion by calculated KPIs  


### Relevance  

The DPMDP provides input data to APT, Mycom and NetExplorer.  
In case of failure, data will be missing in the long term monitoring of the microwave network in these tools.  


### Resources  
- [Specification](./spec/)  
- [TestSuite](./testing/)  
- [Implementation](./server/)  


### Comments  
This application is part of the ComarchOSS replacement project.  
