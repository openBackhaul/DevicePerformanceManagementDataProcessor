# DevicePerformanceManagementDataProcessor  


### Location

The DevicePerformanceManagementDataProcessor belongs to the Network Management Interface.


### Description

It retrieves PM data from MWDI, processes it, formats it, transmits it via Kafka, and stores it in its own database.  

The DPMDP implements a hard coded workflow.  
The individual processing steps are structured into Functions.  
Individually de-/activating the calling of Functions is facilitated.  
Future changes to the processing means adding/removing Functions.  

Preparing the performance data is separated from formatting the output.  
=> Same data can be provided in diverse output formats, if required.  
Formatting the output is separated from transmitting it.  
=> Same output format can be transmitted via diverse protocols, if required.  
Internal data structure of prepared performance data follows ONF information model.  
=> Further processing and services can be added independently from customer-specific output formats.  


### Relevance  

The DPMDP provides input data to APT, Mycom and NetExplorer.  
In case of failure, data will be missing in the long term monitoring of the microwave network.  


### Resources  
- [Specification](./spec/)  
- [TestSuite](./testing/)  
- [Implementation](./server/)  


### Comments  
This application is part of the ComarchOSS replacement project.  
