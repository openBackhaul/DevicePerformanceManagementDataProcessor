# p1Storing  

The function shall execute the following steps:
- store an input data-structure-for-processing object for a mount-name in the data-store under [/data-store/device=mount-name/data-structure-for-processing-list]  
- traverse the resultCC from the input [/data-structure-for-processing/result-cc]. For each found AirInterface and EthernetContainer, uniquely identified by uuid and local-id:
  - determine the most recent period-end-time for both 15min granularity and for 24h granularity
  - store the found timestamps along with local-id and layer-protocol-name under:
    - 15min: [/data-store/device=mount-name/ltp=uuid/lp=local-id/most-recent-period-end-time]
    - 24h: [/data-store/device=mount-name/ltp=uuid/lp=local-id/most-recent-period-end-time-24]
  - already existing entries for interfaces are overwritten
    



    ### p1SetMostRecentTimestampAndDatavInDeviceTable

    This function is for internal use in DMPMD only. It traverses all AirInterface and EthernetContainer instances in a specific [/data-structure-for-processing/output] object and records for each mount-name and LTP-id combination the newest period-end-time it has seen in the list of associated historical-performances. This information is written to the DPMDP deviceTable. Already existing entries are overwritten.  
    It also counts the number of records seen for every traversed interface instance for the respective date from period-end-time and records it in the data-availability-statistics of the deviceTable.
    Thereby it either adds a new (date, numberOfRecords)-entry, if there is none already existing for the respective date, or - if the date has already been added, the numberOfRecords in the deviceTable is increased by the number of records seen in the currently processed DSFP object.   

    #### Input
    The function receives the dataHandle in its requestBody for reading the data object directly from memory.

    #### Steps
    - The function reads the DsfpOutput object associated with the dataHandle from memory and traverses all found AirInterfaces and EthernetContainers.
    - For each mount-name/interface combination the mostRecentTimestamp, which is the newest period-end-time per interface, is recorded in the deviceTable,
      along with the data availability statistics

    #### Callbacks
    - `SettingMostRecentTimestampsAndDatavInDeviceTableCausesReadingDsfpOutput`:
      - *ReadDsfpOutputFromMemory*: reads the DsfpOutput object from memory
      - *SetMostRecentTimestamp*: writes the mostRecentTimestamps and data availability statistics for each found mount-name/interface combination to the deviceTable

    #### Output
    There is no response. Data is written directly into DPMDP's deviceTable.

