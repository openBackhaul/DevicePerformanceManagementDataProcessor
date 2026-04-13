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

### Latest Update

#### v1.1.0

This release adds new functionality and changes inner workings of DPMDP.
New functionality and changes e.g. include:
- provisioning of Busy Hour metrics
- quality service monitoring
- a new service for data dumps from DPMDP data store
- hardening against poison pills during removal of "old" data
  - when periodEndTimes are far in the future data loss might occur otherwise
- changes the data storage concept (offsets, status, results)

Details on changes are found in [DPMDP v1.1.0_spec](https://github.com/openBackhaul/DevicePerformanceManagementDataProcessor/milestone/3).


#### v1.0.1

This release contains updates for findings and bugs from v1.0.0 review.
Amongst others, it adds the following changes:
- addressing of PM slices is corrected (requires both periodEndTime and granularity to be considered as access keys)
- *p1IterateEcPmSlices* is required to first iterate through 15min PM slices, before a potentially available 24h slice is processed

Details on changes are found in [DPMDP v1.0.1_spec](https://github.com/openBackhaul/DevicePerformanceManagementDataProcessor/milestone/2).

#### v1.0.0 Initial release

The initial realease covers most of the main functionality requested by consumers, like providing 15min and 24h PM data for AirInterfaces and EthernetContainers.  
Data is gathered from a replicated MWDI cache ElasticSearch instance periodically.  
Various filtering and processing steps are carried out (e.g. removal of already delivered PM slices, removal attribute with default values from the output, etc.).
DPDMP allows for providing output in different formats.  
Data is provided to consumers via Kafka.  

Related issues are found in [DMPMDP v1.0.0_spec](https://github.com/openBackhaul/DevicePerformanceManagementDataProcessor/milestone/1?closed=1).

### Relevance  

The DPMDP provides input data to APT, Mycom and NetExplorer.  
In case of failure, data will be missing in the long term monitoring of the microwave network.  


### Resources  
- [Specification](./spec/)  
- [TestSuite](./testing/)  
- [Implementation](./server/)  


### Comments  
This application is part of the ComarchOSS replacement project.  
