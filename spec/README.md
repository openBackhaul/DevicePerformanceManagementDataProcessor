# DevicePerformanceManagementDataProcessor Specification

    Caution:
      The Pre-Release does not support the DataStore.  
      It is recommended to configure a testing MWDI with a
      small sliding window size to limit the number of 
      updated ControlConstructs.


### API  

**ServiceList:**  
- [DevicePerformanceManagementDataProcessor+services](./DevicePerformanceManagementDataProcessor+services.yaml)  
- [embedYourself](./embedYourself)  

**ProfileList and ProfileInstanceList:**  
- [DevicePerformanceManagementDataProcessor+profiles](./DevicePerformanceManagementDataProcessor+profiles.yaml)  
- [DevicePerformanceManagementDataProcessor+profileInstances](./DevicePerformanceManagementDataProcessor+profileInstances.yaml)  

**ForwardingList:**  
- [DevicePerformanceManagementDataProcessor+forwardings](./DevicePerformanceManagementDataProcessor+forwardings.yaml)  

**Open API specification (Swagger):**  
- [DevicePerformanceManagementDataProcessor](./DevicePerformanceManagementDataProcessor.yaml)  

**CONFIGfile (JSON):**  
- [DevicePerformanceManagementDataProcessor+config](./DevicePerformanceManagementDataProcessor+config.json)  

**Details about Services:**
- [More detailed information about Services (available via REST API)](./Services)


### Internal Structure  

**High Level Process:**  
<p align="center">
  <img src="./diagrams/hl_process.png" alt="High Level Process" width="400"/>
</p>

**High Level Sequence:**  
<p align="center">
  <img src="./diagrams/hl_sequence.png" alt="High Level Sequence" width="400"/>
</p>

**Details about Functions:**  
More detailed information about  
- [GenericFunctions that might be used in multiple applications](./Functions/genericFunctions)  
- [SpecificFunctions that are exclusive to this application](./Functions/specificFunctions)  

