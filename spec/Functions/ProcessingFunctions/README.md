# ProcessingFunctions  

    Please add short descriptions of the individual ProcessingFunctions here
    The concrete description in the yaml should clarify:
      - where exactly is the input data coming from
      - exact formulation/algorithm etc.
      - where exactly is the output data written to
    Locations might often look like this:
      from [/data-structure-for-processing/input/...]
      to [/data-structure-for-processing/output/...]

### p1CreateDsfpOutputObjectFromCache

This function reads the complete ControlConstruct data of a mount-name provided in the requestBody directly from ElasticSearch and creates the output object [/data-structure-for-processing/output] in the internal memory of DPMDP.  
When it reads the input data it directly applies some filtering logic and discards information which is irrelevant.  
It is possible that after having applied said filter logic, no relevant PM data remains. In that case, the output object is NOT created.  

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

#### Callbacks
- CreatingDsfpOutputCausesReadingControlConstructFromCache:
  - reads the ControlConstruct from ElasticSearch
- CreatingDsfpOutputCausesReadingMostRecentTimestampsForDeviceInterfacesFromDeviceTable
  - reads the mostRecentTimestamp for every interface of the given mount-name found inside the DPMDP deviceTable
- CreatingDsfpOutputCausesFilteringAndClusteringInputData
  - clusters input data into LTP structure and augment, lists of AirInterfaces and EthernetContainers
- CreatingDsfpOutputCausesComputingInterfaceNames
  - computes identifiers for AirInterface (link-id, link-endpoint-id) and EthernetContainer (interface-name) from LTP structure and augment information
- CreatingDsfpOutputCausesComputingLagInformation
  - computes link-aggregation-identifiers for AirInterface from LTP structure and augment information

#### Output
In the case that relevant data is found in the ControlConstruct data, the function creates a [/data-structure-for-processing/output] object in DPMDP memory.  

---  

### p1SetOutOfLevelValuesToDefaultInDsfpOutput

**TODO: ADD INFO HOW TO IDENTIFY THE CORRECT DSFP/OUTPUT OBJECT IN THE MEMORY!**

This function replaces invalid level values found in AirInterface entries of [/data-structure-for-processing/output].  
It directly updates the values of the relevant attributes inside the output object.  

The level values should be withing the following expected ranges, otherwise they are considered out-of-range:
- transmit-level: ∈ [−30.0, 40.0]
- receive-level: ∈ (−129.0, −99.9) ∪ (−99.9, −10.0)

#### Input
**TODO**

#### Steps
The function shall be processed as follows:  
- read the [/data-structure-for-processing/output] object from DPMDP memory
- check for all AirInterfaces in air-interface-list, whether the transmit-level and receive-level attributes contain out-of-range-values
  - if the value is out-of-range then set to respective attribute to -1
- the changed attribute values then are written directly to [/data-structure-for-processing/output]

#### Callbacks
- SettingOutOfRangeLevelValuesToDefaultCausesReadingFromAndWritingToDsfpOutput
  - first reads the data
  - then updates the changed attributes in the cache

#### Output
Changes are directly written to [/data-structure-for-processing/output]. Target are the level attributes of AirInterface data.


---  

### p1Inquire15minAirInterfaceKpisFromCacaAndSetInDsfpOutput

**TODO: ADD INFO HOW TO IDENTIFY THE CORRECT DSFP/OUTPUT OBJECT IN THE MEMORY!**

This function sends AirInterface data relevant for capacity calculation to the CapacityCalculator app and writes the received KPI values into the related capacity attributes in [/data-structure-for-processing/output].  

#### Input
The function 

#### Steps
The function shall be processed as follows:  
- read the attributes relevant for AirInterface capacity calculation from [/data-structure-for-processing/output]
- send the data to the CapacityCalculator
- update the KPI attributes with the received values directly in [/data-structure-for-processing/output]

#### Callbacks
- InquiringFor15minAirIfCapacityKpiCalculationCausesReadingFromDsfpOutput
  - reads the relevant AirInterface attributes for all AirInterfaces found in the air-interface-list of [/data-structure-for-processing/output]
- InquiringFor15minAirInterfaceCapacityKpiCalculationCausesCallingCaca
  - then it sends this data to the CapacityCalculator
- InquiringFor15minAirInterfaceCapacityKpiCalculationCausesWritingToDsfpOutput
  - and upon receipt of the computed KPI values it writes them back into [/data-structure-for-processing/output]

#### Output
Changes are directly written to [/data-structure-for-processing/output]. Target are the capacity attributes of AirInterface data.


---  

### p1Inquire15minEthernetContainerKpisFromCacaAndSetInDsfpOutput

**TODO: ADD INFO HOW TO IDENTIFY THE CORRECT DSFP/OUTPUT OBJECT IN THE MEMORY!**

This function sends EthernetContainer data relevant for KPI to the CapacityCalculator app and writes the received KPI values into the related EthernetContainer attributes in [/data-structure-for-processing/output].  

#### Input
The function 

#### Steps
The function shall be processed as follows:  
- read the attributes relevant for EthernetContainer KPI calculation from [/data-structure-for-processing/output]
- send the data to the CapacityCalculator
- update the KPI attributes with the received values directly in [/data-structure-for-processing/output]

#### Callbacks
- InquiringFor15minEthContainerCapacityKpiCalculationCausesReadingFromDsfpOutput
  - reads the relevant EthernetContainer attributes for all EthernetContainers found in the ethernet-container-list of [/data-structure-for-processing/output]
- InquiringFor15minEthContainerCapacityKpiCalculationCausesCallingCaca
  - then it sends this data to the CapacityCalculator
- InquiringFor15minEthContainerCapacityKpiCalculationCausesWritingToDsfpOutput
  - and upon receipt of the computed KPI values it writes them back into [/data-structure-for-processing/output]

#### Output
Changes are directly written to [/data-structure-for-processing/output]. Target are the KPI attributes of EthernetContainer data.

---  

### p1ReplaceOnfDefaultValuesinDsfpOutput

**TODO: ADD INFO HOW TO IDENTIFY THE CORRECT DSFP/OUTPUT OBJECT IN THE MEMORY!**

This function reads the counter attributes in [/data-structure-for-processing/output] and replaces ONF default values of -1 with null (numbers) or empty string (string).  
For KPI attributes -1 is not replaced.

#### Input
The function 

#### Steps
The function shall be processed as follows:
- read the output object from [/data-structure-for-processing/output] directly
- for each counter attribute check whether it has an ONF default value of -1 (or "-1"), if it does, replace its value as follows:
  - for number attributes: with *null*
  - for string attributes: with empty string
  
Note: for some EthernetContainers values are represented as string instead of numbers, thus, empty string is used instead of *null*.  

#### Callbacks
- FunctionForReplacingOnfDefaultValuesCausesReadingAndChandingDsfpOutput
  - reads the data directly from [/data-structure-for-processing/output]
  - writes back the data to [/data-structure-for-processing/output] with replaced ONF default values

#### Output
Changes are directly written to [/data-structure-for-processing/output]. Target are all counter attributes.

  