# DevicePerformanceManagementDataProcessor Specification


### API  

**ServiceList:**  
- [DevicePerformanceManagementDataProcessor+services](./DevicePerformanceManagementDataProcessor+services.yaml)  
- [embedYourself](./Services/embedYourself/1.0.0)

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
- [embedYourself](./Services/embedYourself/1.0.0)  


### Internal Structure  

**High Level Process:**  
<p align="center">
  <img src="./diagrams/hl_process.png" alt="High Level Process" width="400"/>
</p>

**High Level Sequence:**  
<p align="center">
  <img src="./diagrams/hl_sequence.png" alt="High Level Sequence" width="400"/>
</p>

**Parameters:**  
Although the sequence of function calls is hard-coded, actually calling a function can be enabled/disabled using a parameter.  
[More details about parameters](./Functions/p1StreamPmData/p1LoadParameters/1.0.0)

**Details about Functions:**  
- [p1StreamPmData](./Functions/p1StreamPmData/1.0.0)  
  - [p1LoadParameters*](./Functions/p1StreamPmData/p1LoadParameters/1.0.0)  
  - [p1ResolveEsAddress*](./Functions/p1StreamPmData/p1ResolveEsAddress/1.0.0)  
  - [p1InitKafka*](./Functions/p1StreamPmData/p1InitKafka/1.0.0)  
  - [p1UpdateMwdiReplica](./Functions/p1StreamPmData/p1UpdateMwdiReplica/1.0.0)  
  - [p1ProcessDevice](./Functions/p1StreamPmData/p1ProcessDevice/1.0.0)  
    - [p1LoadRawCc](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/1.1.0)  
      - [p1FieldsFilter*](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/p1FieldsFilter/1.0.0)  
      - [p1DiscardIrrelevantPmRecords*](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/p1DiscardIrrelevantPmRecords/1.0.0)  
    - [p1CreateResultCc](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/1.0.0)  
      - [p2PrepareTxModes](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p2PrepareTxModes/1.0.0)  
        - [p1CalculateAiCapacity*](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p2PrepareTxModes/p1CalculateAiCapacity/1.0.0)  
        - [p1CalculateIntervalCapacity*](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p2PrepareTxModes/p1CalculateIntervalCapacity/1.0.0)  
      - [p1CalculateEthernetKpis](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1CalculateEthernetKpis/1.0.0)  
    - [p1FormattingOutputApt](./Functions/p1StreamPmData/p1ProcessDevice/p1FormattingOutputApt/1.0.0)  
    - [p1TransmittingKafka](./Functions/p1StreamPmData/p1ProcessDevice/p1TransmittingKafka/1.0.0)  

*) Indicates a Generic Function that is part of the DPMDP's implementation.  


### Changes with DPMDP 1.1.0

- p1LoadRawCc had a backward compatible change.  
  p1LoadRawCc version 1.1.0 provides an additional /raw-cc/batch-timestamp attribute.  
