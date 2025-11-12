# DevicePerformanceManagementDataProcessor  

Retrieves PM data from cache, processes it, and makes it available via Kafka.  


### Description  

The DevicePerformanceManagementDataProcessor (DPMDP) requires a replica of the ElasticSearch index of the MicroWaveDeviceInventory (MWDI).  

The DPMDP gets triggered by AttributeValueChanged (AVC) notifications (via Kafka consumer interface) that are indicating updated historical performance data.  

Whenever triggered, the DPMDP reads the raw performance data from the copied cache and prepares value added data that is streamed to out-of-domain tools (via Kafka provider interface).  

The DPMDP implements a hard coded workflow for processing the raw data, but it also facilitates to de-/activate individual processing modules.  

The performance data, which has originally been retrieved from the devices, has to tbe processed in the following regards:
  - Replacement and deletion of implausible data
  - Harmonization in format and semantical meaning
  - Completion by configuration information
  - Completion by capability information
  - Completion by calculated KPIs

Please find the [list of provided modules](./spec/Functions/).
