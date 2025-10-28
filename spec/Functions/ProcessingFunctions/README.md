# ProcessingFunctions  

In the following the different functions are shortly described.  

### p1CreateDsfpOutputObjectFromCache

This function reads the complete ControlConstruct data of a mount-name provided in the requestBody directly from ElasticSearch and creates the output object [/data-structure-for-processing/output] in the internal memory of DPMDP.  
When it reads the input data it directly applies some filtering logic and discards information which is irrelevant.  
It is possible that after having applied said filter logic, no relevant PM data remains. In that case, the output object is NOT created.  
Upon completion, the function returns the DsfpOutput object along with a unique dataHandle to where the object is stored in the DPMDP memory.

**Usage**: This function is for DPMDP internal usage only.  
With the dataHandle provided in the response, subsequent functions can read the output object directly from DPDMP memory, rather than it having to be handed over in the requestBody.  

#### Input
The function only receives a mount-name in its requestBody.

#### Steps
The function shall be processed as follows:  
- read ControlConstruct data directly from ElasticSearch
- read the mostRecentTimestamp for the mount-name's interfaces from the internal DPMDP deviceTable
- filter and cluster the input data
  - only keep the following data for further processing:
    - LTP structure and augment information
    - AirInterface data
    - EthernetContainer data
  - for both AirInterface and EthernetContainer historical performances filter for records
    - with 15 minute granularity,
    - which are newer than the mostRecentTimestamp for the given interface instance
    - if no records remain that interface is not going to be written to the output object; if no interface instance contains any relevant PM data, no output object is written at all
  - from AirInterface data only keep those entries in:
    - *time-xstates-list*, where *time*>0
    - *air-interface-capability/transmission-mode-list*, where *code-rate* != -1
- from the LTP structure and augment information determine AirInterface and EthernetContainer identifier attributes
- all relevant information is added to the output schema from the various steps above
  - note that KPIs are added as attributes with default value -1
- along with the output object the *dataHandle* is created; it allows to read the output object directly from DPMDP memory, rather than data having to be passed along via function requestBodies.

#### Callbacks
- `CreatingDsfpOutputCausesReadingControlConstructFromCache`:
  - reads the ControlConstruct from ElasticSearch
- `CreatingDsfpOutputCausesReadingMostRecentTimestampsForDeviceInterfacesFromDeviceTable`
  - reads the mostRecentTimestamp for every interface of the given mount-name found inside the DPMDP deviceTable
- `CreatingDsfpOutputCausesFilteringAndClusteringInputData`
  - clusters input data into LTP structure and augment, lists of AirInterfaces and EthernetContainers
  - discards unwanted data
- `CreatingDsfpOutputCausesComputingInterfaceNames`
  - computes identifiers for AirInterface (link-id, link-endpoint-id) and EthernetContainer (interface-name) from LTP structure and augment information
- `CreatingDsfpOutputCausesComputingLagInformation`
  - computes link-aggregation-identifiers for AirInterface from LTP structure and augment information

#### Output
In the case that relevant data is found in the ControlConstruct data, the function creates a [/data-structure-for-processing/output] object in DPMDP memory.  
For identifying the output object in the DPMDP memory in other functions an object id (*dataHandle*), which is not part of [/data-structure-for-processing/output] itself is also being created and returned.

---  

### p1SetMostRecentTimestampInDeviceTable

This function is for internal use in DMPMD only. It traverses all AirInterface and EthernetContainer instances in a specific [/data-structure-for-processing/output] object and records for each mount-name and LTP-id combination the newest period-end-time it has seen in the list of associated historical-performances. This information is written to the DPMDP deviceTable. Already existing entries are overwritten.  

#### Input
The function receives the dataHandle in its requestBody for reading the data object directly from memory.

#### Steps
- The function reads the DsfpOutput object associated with the dataHandle from memory and traverses all found AirInterfaces and EthernetContainers.
- For each mount-name/interface combination the mostRecentTimestamp, which is the newest period-end-time per interface, is recorded in the deviceTable.

#### Callbacks
- `SettingMostRecentTimestampsInDeviceTableCausesReadingDsfpOutput`:
  - *ReadDsfpOutputFromMemory*: reads the DsfpOutput object from memory
  - *SetMostRecentTimestamp*: writes the mostRecentTimestamps for each found mount-name/interface combination to the deviceTable

#### Output
There is no response. Data is written directly into DPMDP's deviceTable.

---  

### p1SetOutOfLevelValuesToDefault

This function replaces invalid level values of AirInterface attributes.  
The level values should be withing the following expected ranges, otherwise they are considered out-of-range:
- transmit-level: ∈ [−30.0, 40.0]
- receive-level: ∈ (−129.0, −99.9) ∪ (−99.9, −10.0)

**Usage**:
This function can be called from within DPMDP or can be used externally.  
- DPMDP usage:
  - the dataHandle has to be provided in the requestBody
  - the function reads data from the [/data-structure-for-processing/output] object associated with the dataHandle directly from DPMDP memory
  - the manipulated attribute values are also written directly back into [/data-structure-for-processing/output]
- external usage:
  - the required input data has to be provided in the requestBody; it follows the schema of [/data-structure-for-processing/output] but only contains the relevant attributes
  - the manipulated attribute values are returned in the response

#### Input
Either the dataHandle for internal usage or an air-interface-list (limited to the relevant identifiers and level attributes in the performance-measurement-list) for external usage.

#### Steps
The function shall be processed as follows:  
- for internal usage read the [/data-structure-for-processing/output] data associated with the dataHandle directly from DPMDP memory; for external usage this data is provided in the requestBody.
- check for all AirInterfaces in air-interface-list, whether the transmit-level and receive-level attributes contain out-of-range-values
  - if the value is out-of-range then set to respective attribute to -1
- the changed attribute values then are either written directly to [/data-structure-for-processing/output] (internal usage) or returned in the response (external usage)

#### Callbacks
- `SettingOutOfRangeLevelValuesToDefaultCausesReadingFromDsfpOutput`
  - reads the data associated witht the dataHandle from memory
- `SettingOutOfRangeLevelValuesToDefaultCausesWritingToDsfpOutputOrReturningChangedData`
  - *returnDataNonHandle*: [external usage] the level values are checked and replaced where necessary, they are returned
  - *updateDataInMemory*: [internal usage] the level values are checked and replaced where necessary, but written directly to memory

#### Output
Changes are either directly written to [/data-structure-for-processing/output] (internal usage) or the modified input data is returned in the response (external usage).

---  

### p1Inquire15minAirInterfaceKpisFromCaca

This function sends AirInterface data to the CapacityCalculator app for getting capacity KPI values.

**Usage**:
This function can be called from within DPMDP or can be used externally.  
- DPMDP usage:
  - the dataHandle has to be provided in the requestBody
  - the function reads data from the [/data-structure-for-processing/output] object associated with the dataHandle directly from DPMDP memory
  - the KPI attribute values received from CaCa are also written directly back into [/data-structure-for-processing/output]
- external usage:
  - the required input data has to be provided in the requestBody; it follows the schema of [/data-structure-for-processing/output] but only contains the relevant attributes
  - the KPI attribute values received from CaCa are returned in the response

#### Input
Either the dataHandle for internal usage or an air-interface-list (limited to the relevant attributes) for external usage.

#### Steps
The function shall be processed as follows:  
- for internal usage read the attributes relevant for AirInterface capacity KPI calculation from the [/data-structure-for-processing/output] object associated with the dataHandle; for external usage the relevant information is provided in the requestBody
- send the data to the CapacityCalculator
- update the KPI attributes with the received values directly in [/data-structure-for-processing/output] for internal usage, or return them in the response for external usage

#### Callbacks
- `InquiringFor15minAirIfCapacityKpiCalculationCausesReadingFromDsfpOutput`
  - reads the relevant AirInterface attributes for all AirInterfaces found in the air-interface-list of [/data-structure-for-processing/output]
- `InquiringFor15minAirInterfaceCapacityKpiCalculationCausesCallingCacaAndWritingOrReturningData`
  - *getKPIs*: sends this data to the CapacityCalculator
  - *updateDataInMemory*: in case of internal usage writes them back into [/data-structure-for-processing/output]

#### Output
Changes are either directly written to [/data-structure-for-processing/output] (internal usage) or the modified input data is returned in the response (external usage).

---  

### p1Inquire15minEthernetContainerKpisFromCaca

This function sends EthernetContainer data to the CapacityCalculator app for getting Ethernet KPI values.

**Usage**:
This function can be called from within DPMDP or can be used externally.  
- DPMDP usage:
  - the dataHandle has to be provided in the requestBody
  - the function reads data from the [/data-structure-for-processing/output] object associated with the dataHandle directly from DPMDP memory
  - the KPI attribute values received from CaCa are also written directly back into [/data-structure-for-processing/output]
- external usage:
  - the required input data has to be provided in the requestBody; it follows the schema of [/data-structure-for-processing/output] but only contains the relevant attributes
  - the KPI attribute values received from CaCa are returned in the response

#### Input
Either the dataHandle for internal usage or an ethernet-container-list (limited to the relevant attributes) for external usage.

#### Steps
The function shall be processed as follows:  
- for internal usage read the attributes relevant for EthernetContainer KPI calculation from the [/data-structure-for-processing/output] object associated with the dataHandle; for external usage the relevant information is provided in the requestBody
- send the data to the CapacityCalculator
- update the KPI attributes with the received values directly in [/data-structure-for-processing/output] for internal usage, or return them in the response for external usage


#### Callbacks
- `InquiringFor15minEthContainerKpiCalculationCausesReadingFromDsfpOutput`
  - reads the relevant EthernetContainer attributes for all EthernetContainers found in the ethernet-container-list of [/data-structure-for-processing/output]
- `InquiringFor15minEthContainerKpiCalculationCausesCallingCacaAndWritingOrReturningData`
  - *getKPIs*: sends this data to the CapacityCalculator
  - *updateDataInMemory*: in case of internal usage writes them back into [/data-structure-for-processing/output]

#### Output
Changes are either directly written to [/data-structure-for-processing/output] (internal usage) or the modified input data is returned in the response (external usage).

---  

### p1ReplaceOnfDefaultValues

This function replaces ONF default attribute values of -1 (number) or "-1" (string) and replaces them with null (numbers) or empty string (string). For KPI attributes -1 values are not replaced.  

**Usage**:
This function can be called from within DPMDP or can be used externally.  
- DPMDP usage:
  - the dataHandle has to be provided in the requestBody
  - the function reads the complete output object from the [/data-structure-for-processing/output] object associated with the dataHandle directly from DPMDP memory
  - the modified output object with replaced values is written directly back into [/data-structure-for-processing/output]
- external usage:
  - the required input data has to be provided in the requestBody; it follows the schema of [/data-structure-for-processing/output]
  - the modified output object with replaced values is returned in the response


#### Input
Either the dataHandle for internal usage or an complete output object for external usage.

#### Steps
The function shall be processed as follows:
- read the output object from [/data-structure-for-processing/output] directly
- for each counter attribute check whether it has an ONF default value of -1 (or "-1"), if it does, replace its value as follows:
  - for number attributes: with *null*
  - for string attributes: with empty string
  
Note: for some EthernetContainers values are represented as string instead of numbers, thus, empty string is used instead of *null*.  

#### Callbacks
- `FunctionForReplacingOnfDefaultValuesCausesReadingDsfpOutput`
  - reads the data associated with the dataHandle directly from [/data-structure-for-processing/output]
- `FunctionForReplacingOnfDefaultValuesCausesWritingOrReturningData`:
  - *replaceOnfDefaultsAndReturnData*: replaces ONF default values in the data from requestBody and returs it in the response
  - *replaceOnfDefaultValuesInMemory*: applies the same rules for ONF default value replacement as in *replaceOnfDefaultsAndReturnData*, but to the data read from memory. Then writes back the modified data to [/data-structure-for-processing/output]

#### Output
Changes are either directly written to [/data-structure-for-processing/output] (internal usage) or the modified input data is returned in the response (external usage).

  