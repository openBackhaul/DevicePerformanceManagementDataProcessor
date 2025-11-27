# DevicePerformanceManagementDataProcessor  

Retrieves PM data from an MWDI database replica, processes it, formats it, transmits it via Kafka, and stores it in its own database.  


### Description  

The DevicePerformanceManagementDataProcessor (DPMDP) requires a replica of the ElasticSearch index of the MicroWaveDeviceInventory (MWDI).  
This ElasticSearch index replication is done by a cronjob.  

The DPMDP receives AttributeValueChanged (AVC) notifications (via Kafka consumer interface) sent by the MWDI.  
The DPMDP is creating a list of devices with updated performance data from these notifications.  

The DPMDP also receives AVC notifications sent by the cronjob that is creating the MWDI ElasticSearch index replica.  
As soon as the cronjob notifies an updated replica, DPMDP starts processing the performance data for the listed devices.  

The DPMDP reads the raw performance data, processes it, formats it, and streams the resulting data to out-of-domain tools (via Kafka provider interface).  

Furthermore, the DPMDP stores the processed performance data in its own database for further usage.  


### Data Processing  

**Coding Structure:**  
The DPMDP implements a hard coded workflow for processing the performance data, but  
  - the individual processing steps are structured into Functions  
  - de-/activating individual processing Functions is facilitated.  

Adding or removing Functions for other processing steps, output formats or transmit protocols should be easy to implement.  

**Types of Processing the Data:**  
The performance data, which has originally been retrieved from the devices, is manipulated in the following regards:  
  - Removal of already processed data  
  - Replacement and deletion of implausible data  
  - Harmonization in format and semantical meaning  
  - Completion by configuration information  
  - Completion by capability information  
  - Completion by calculated KPIs  
  - Formatting according to the requirements of the out-of-domain tools  


### Relevance  

The DPMDP provides input data to APT, Mycom and NetExplorer.  
In case of failure, data will be missing in the long term monitoring of the microwave network in these tools.  


### Resources  
- [Specification](./spec/)  
- [TestSuite](./testing/)  
- [Implementation](./server/)  


### Comments  
This application is part of the ComarchOSS replacement project.  
