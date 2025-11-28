# p1ProcessingPmData  

Orchestrates the device-wise processing, formatting, sending and storing of PM data.  


### Description  

The p1ProcessingPmData starts with creating a data structure for holding raw data, results, and administrative information.  
This data structure is called DataStructureForProcessing.  

The p1ProcessingPmData executes a hard coded sequence of Functions.  
Input to these Functions is taken from the DataStructureForProcessing.  
Resulting data gets attached to the DataStructureForProcessing.  
[Schema of the DataStructureForProcessing](./InformationStructure/DataStructureForProcessing.yaml)



<!-- todo: Update required -->
<!-- todo: It seems a lot of information should be located somewhere else -->

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


### Processing steps

After having received a new notification for a device (identified by mount-name):

(1) The ProcessingOrchestrator checks whether this notification is to be processed or ignored
  - depending on whether this is the first notification for this device related to a complete ControlConstruct update
  - or if other notifications for that udpate event have already been received within the *waitingTimeForProcessingNotificationsForSameDevice* timeframe

If the notification is to be processed:  
(2) DPMDP reads the complete ControlConstruct directly from ElasticSearch (i.e. no REST call) by executing function `/p1/create-dsfp-output-object-from-cache-data`
  - the function filters the data for relevant interfaces: AirInterface and EthernetContainer
  - these interfaces are only added to a potential output object, if they contain 15-min historical performance data, that has not been seen before
  - if no new relevant PM data is found, no output object is created
  - if relevant new output data is found, the function creates the output object under [/data-structure-for-processing/output] and also creates and returns the *data-handle* for further function calls

(3) The ProcessingOrchestrator reads the MWDI metadataTable information to retrieve the deviceType.
  - The deviceType is written to the [/data-structure-for-processing/device-type]

If an output object was created in (2):
(4) The ProcessingOrchestrator calls `/p1/set-out-of-range-level-values-to-default` to replace any out-of-range level attribute values in AirInterface data of [/data-structure-for-processing/output].
  - it reads the output object directly from DPMDP memory and writes updated values directly into it
  - the relevant output object in the memory is identified by the *data-handle*

(5) The ProcessingOrchestrator calls `/p1/inquire-15min-air-interface-kpis-from-caca` for computation of AirInterface KPI values.
  - it reads the relevant data from [/data-structure-for-processing/output]; the correct output object is again identified by *data-handle*
  - it sends this data to the CapacityCalculator app
  - it writes the received KPI attribute values back to [/data-structure-for-processing/output]

(6) The ProcessingOrchestrator calls `/p1/inquire-15min-ethernet-container-kpis-from-caca` for computation of EthernetContainer KPI values.
  - it reads the relevant data from [/data-structure-for-processing/output]; the correct output object is again identified by *data-handle*
  - it sends this data to the CapacityCalculator app
  - it writes the received KPI attribute values back to [/data-structure-for-processing/output]

(7) The ProcessingOrchestrator calls `/p1/replace-onf-default-values`, which replaces all ONF default attribute values of -1 (number) or "-1" (string) by null (number) or empty string (string). KPI attribute values are not changed.  
Note: the replacement values may change, as they need to be aligned with customers. Also note that the out-of-range level values are replaced by -1, if the related function is executed. If the ONF default values are replaced afterwards, those attribute values are again changed according to the rules defined for ONF default value replacement.  
  - it reads the relevant data from [/data-structure-for-processing/output]; the correct output object is again identified by *data-handle*
  - it writes changed attribute values back to [/data-structure-for-processing/output]

(8) The ProcessingOrchestrator calls `/p1/set-most-recent-timestamp-and-datav-in-device-table` for gathering information about the newest timestamp seen for each relevant AirInterface and EthernetContainer of the processed mount-name.  
This information is used to filter for relevant new data the next time a notification for the same mount-name is processed.  
  - it reads the relevant data from [/data-structure-for-processing/output]; the correct output object is again identified by *data-handle*
  - for each AirInterface and EthernetContainer instance it identifies the mostRecentTimestamp as the newest period-end-time for that interface instance
  - it writes the mount-name, interface (LtpId) and mostRecentTimestamp to the deviceTable. Already existing entries for that mount-name/interface combination are overwritten.

After all processing steps have been carried out and if a [/data-structure-for-processing/output] object has been created, there is a transition of the [/data-structure-for-processing] from Processing to Transmission. 


# TODO: den Ablauf an neue Änderungen anpassen