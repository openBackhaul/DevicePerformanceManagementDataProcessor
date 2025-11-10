# ProcessingOrchestratorFor15MinHistoricalPm  

This ProcessingOrchestrator is triggered by incoming notifications about new data being available at the MWDI.  

### Notification receipt

The incoming notifications of relevance are created by MWDI when the *time-of-latest-change* attribute of and AirInterface or EthernetContainer changes.  
The current specification contains two ways for receiving those notifications:
- either from Kafka
- or via subscribing to the MWDI

MWDI cycically updates complete ControlConstructs - therefore multiple notifications for the same mount-name can be expected to be received everytime a complete ControlConstruct is uploaded to MWDI cache.  
DPMDP shall only process the first notification for a given device and ignore other notifications for the same device for the time interval configured in integerProfile instance *waitingTimeForProcessingNotificationsForSameDevice*.  

For the current release MWDI is supposed to only send notifications for update values of *time-of-latest-change*.  
In future MWDI releases there may be more AVCN notifications created. If DPMDP is receiving them all via Webhook, it needs to ignore all those not related to *time-of-latest-change* for this processingOrchestrator (if other AVCN notifications are also to be processed, this will be done by a different processingOrchestrator!). If the DPMDP however fetches the notifications from Kafka, filtering can be applied before the notifications are made available to DPMDP. In that case, DPMDP does not need to carry out additional filtering by itself.

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