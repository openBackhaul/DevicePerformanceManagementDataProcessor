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
    - [p1LoadRawCc](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/1.0.0)  
      - [p1FieldsFilter*](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/p1FieldsFilter/1.0.0)  
      - [p1DiscardIrrelevantPmRecords*](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/p1DiscardIrrelevantPmRecords/1.0.0)  
    - [p1CreateResultCc](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/1.0.0)  
      - [p1PrepareTxModes](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1PrepareTxModes/1.0.0)  
        - [p1CalculateAiCapacity*](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1PrepareTxModes/p1CalculateAiCapacity/1.0.0)  
      - [p1IterateAiPmSlices](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateAiPmSlices/1.0.0)  
        - [p1CalculateIntervalCapacity*](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateAiPmSlices/p1CalculateIntervalCapacity/1.0.0)  
        - [p1RemoveOutOfRangeLevels](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateAiPmSlices/p1RemoveOutOfRangeLevels/1.0.0)  
        - [p1RemoveDefaultValues*](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateAiPmSlices/p1RemoveDefaultValues/1.0.0)  
      - [p1IterateEcPmSlices](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateEcPmSlices/1.0.0)  
        - [p1CalculateEthernetKpis](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateEcPmSlices/p1CalculateEthernetKpis/1.0.0)  
        - [p1RemoveDefaultValues*](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateAiPmSlices/p1RemoveDefaultValues/1.0.0)  
        - [p1CalculateUtilization](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateEcPmSlices/p1CalculateUtilization/1.0.0)  
      - [p1RemoveOutOfRangeTemperatures](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1RemoveOutOfRangeTemperatures/1.0.0)
    - [p1FormattingOutputApt](./Functions/p1StreamPmData/p1ProcessDevice/p1FormattingOutputApt/1.1.0)  
    - [p1TransmittingKafka](./Functions/p1StreamPmData/p1ProcessDevice/p1TransmittingKafka/1.0.1)  
    - [p1Storing*](./Functions/p1StreamPmData/p1ProcessDevice/p1Storing/1.0.0)  
    - [p1MaintainDs](./Functions/p1StreamPmData/p1MaintainDs/1.0.0)  

*) Indicates a Generic Function that is part of the DPMDP's implementation.  

**Most relevant Data Structures:**  
- [rawCc](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/1.1.0/variables.yaml)  
  - contains the prefiltered raw data  
  - initialized by reading raw data from Replica ES within [p1LoadRawCc](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/1.1.0/interface.yaml)  
  - overwritten by outputs of [p1FieldsFilter*](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/p1FieldsFilter/1.0.0/interface.yaml) and [p1DiscardIrrelevantPmRecords*](./Functions/p1StreamPmData/p1ProcessDevice/p1LoadRawCc/p1DiscardIrrelevantPmRecords/1.0.0/interface.yaml)  
- [resultCc](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/1.0.0/variables.yaml)  
  - contains the processed data, which is generated by copying the rawCc and then applying various  transformation functions to its data contents  
  - all generated output formats are based on the resultCc  
  - generated by [p1CreateResultCc](./Functions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/1.0.0/interface.yaml) and its subfunctions.  
- output  
  - there is not a dedicated *output* object  
  - instead each output format has its own output object, which is listed as content property under [output-format](./Functions/p1StreamPmData/p1InitKafka/1.0.0/variables.yaml)  
  - the different output objects depend on the format-name:  
    - *apt*: the *apt-output-format* is found in [apt-output-format](./Functions/p1StreamPmData/p1ProcessDevice/p1FormattingOutputApt/1.1.0/variables.yaml)  
    - *onf*: tbd  
    - *iveritas*: tbd  
- [data-store](./Functions/p1StreamPmData/p1ProcessDevice/p1Storing/1.0.0/data-store-schema/dataStore.yaml)
  - stores data per device
  - data written by [p1Storing](./Functions/p1StreamPmData/p1ProcessDevice/p1Storing/1.0.0/) and maintained by [p1MaintainDs](./Functions/p1StreamPmData/p1MaintainDs/1.0.0/)  
  

### Changes with DPMDP 1.1.0

- p1LoadRawCc had a backward compatible change.  
  p1LoadRawCc version 1.1.0 provides an additional /raw-cc/batch-timestamp attribute.  
