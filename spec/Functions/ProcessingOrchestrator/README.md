# ProcessingOrchestrator  

The ProcessingOrchestrator is triggered by incoming notifications about new data being available at the MWDI.  

### Notification receipt

The incoming notifications are created by MWDI when the *time-of-latest-change* attribute of and AirInterface or EthernetContainer changes.  
The current specification contains two ways for receiving those notifications:
- either from Kafka
- or via subscribing to the MWDI

MWDI cycically updates complete ControlConstructs - therefore multiple notifications for the same mount-name can be expected to be received everytime a complete ControlConstruct is uploaded to MWDI cache.  
DPMDP shall only process the first notification for a given device and ignore other notifications for the same device for the time interval configured in integerProfile instance *waitingTimeForProcessingNotificationsForSameDevice*.  

### Processing steps

After having received a new notification for a device (identified by mount-name):

(1) The ProcessingOrchestrator checks whether this notification is to be processed or ignored
  - depending on whether this is the first notification for this device related to a complete ControlConstruct update
  - or if other notifications for that udpate event have already been received within the *waitingTimeForProcessingNotificationsForSameDevice* timeframe

If the notification is to be processed:  
(2) DPMDP reads the complete ControlConstruct directly from ElasticSearch (i.e. no REST call) by executing function p1/create-dsfp-output-object-from-cache-data
  - the function filters the data for relevant interfaces: AirInterface and EthernetContainer
  - these interfaces are only added to a potential output object, if they contain 15-min historical performance data, that has not been seen before
  - if no new relevant PM data is found, no output object is created
  - if relevant new output data is found, the function creates the output object under [/data-structure-for-processing/output] and also creates and returns the *dsfp-output-object-id* for further function calls

If an output object was created in (2):
(3) The ProcessingOrchestrator calls /p1/set-out-of-range-level-values-to-default-in-dsfp-output to replace any out-of-range level attribute values in AirInterface data of [/data-structure-for-processing/output].
  - it reads the output object directly from DPMDP memory and writes updated values directly into it
  - the relevant output object in the memory is identified by the *dsfp-output-object-id*

(4) The ProcessingOrchestrator calls /p1/inquire-15min-air-interface-kpis-from-caca-and-set-in-dsfp-output for computation of AirInterface KPI values.
  - it reads the relevant data from [/data-structure-for-processing/output]; the correct output object is again identified by *dsfp-output-object-id*
  - it sends this data to the CapacityCalculator app
  - it writes the received KPI attribute values back to [/data-structure-for-processing/output]

(5) The ProcessingOrchestrator calls /p1/inquire-15min-ethernet-container-kpis-from-caca-and-set-in-dsfp-output for computation of EthernetContainer KPI values.
  - it reads the relevant data from [/data-structure-for-processing/output]; the correct output object is again identified by *dsfp-output-object-id*
  - it sends this data to the CapacityCalculator app
  - it writes the received KPI attribute values back to [/data-structure-for-processing/output]

(6) The ProcessingOrchestrator calls /p1/replace-onf-default-values-in-dsfp-output, which replaces all ONF default attribute values of -1 (number) or "-1" (string) by null (number) or empty string (string). KPI attribute values are not changed.  
Note: the replacement values may change, as they need to be aligned with customers.  
  - it reads the relevant data from [/data-structure-for-processing/output]; the correct output object is again identified by *dsfp-output-object-id*
  - it writes changed attribute values back to [/data-structure-for-processing/output]

Further processing steps (functions) may be added later on.

After all processing steps have been carried out and if a [/data-structure-for-processing/output] object has been created, there is a transition of the [/data-structure-for-processing] from Processing to Transmission. 