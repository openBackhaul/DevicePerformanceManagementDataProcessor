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

#### Harmonization  

- name  
  Harmonizes the semantic meaning of the data in this aspect  

- name  
  Harmonizes the semantic meaning of the data in that aspect  

#### KPIs  

- name  
  Adds this derived performance indicator  

- name  
  Adds that derived performance indicator  

#### Supplementation  

- name  
  Adds this interface configuration information  

- name  
  Adds that interface status information  
