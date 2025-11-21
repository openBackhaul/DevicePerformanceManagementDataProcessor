# p1LoadRawDeviceData

The function receives the mount-name of a device as input.  
It reads the raw ControlConstruct data for that mount-name from the MWDI ElasticSearch replica.  
It processes the raw ControlConstruct data (filters out unwanted data).  
Its output is a reference pointing to where the raw ControlConstruct object is kept in the DPMDP runtime memory. (I.e. not the data itself is passed back to the caller!)

The function executes the following steps:
1. read the ControlConstruct from ES
2. read timestamp information about already previously gathered data:
   - from the DPDMP datastore read the device object, which matches the input mount-name
   - this object contains a list of ltp/lps with most-recent-period-end-time information
3. special filtering is applied to the data gathered in step1. This is done in step `applyFilteringForLtpStructureAugmentAirIfAndEthContainer`. If a different filtering should be applied in a future release, another filter step could be added and executed instead.
  This step carries out the following filtering:
  - keep relevant equipment-augment information
  - keep relevant information about LTP structure and augment
  - keep layer-protocol information, if the layer-protocol is either an AirInterface or EthernetContainer instance
    - inside the layer-protocol only keep historical PM records,
      - which are of 15min or 24h granularity
      - and where the period-end-time is newer than the most-recent-period-end-time for this interface instance from step2
      - note: if in step2 no data was found for the mount-name at all, treat the historical PM record as newer; if data for the mount-name was found, but it does not contain the currently processed interface instance, also treat the historical PM record as newer (i.e. it shall be kept.)

The raw ControlConstruct data follows ONF format. Only relevant attributes and subclasses are kept.  
Note that raw ControlConstruct data returned can contain AirInterface or EthernetContainer instances, where no PM data remained after filtering. During processing by p1ProcessingOrchestratorForHistoricalPmData these instances will be filtered out and not be included in the data delivered to customers. However, as it might be required to provide a more full picture about interfaces available at the device, this data is kept in the raw ControlConstruct data for now to allow for future extensions.  
