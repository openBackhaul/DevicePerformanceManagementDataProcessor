# p1LoadRawCc

### Overview  

The p1LoadRawCc function receives the mountName of a device as input and reads the raw ControlConstruct data of this
device from the MWDI ES replica.  
It processes the raw ControlConstruct data and filters out unwanted data.  
Its output is a reference pointing to the where the raw ControlConstruct object is kept in the DPMDP runtime memory. (I.e. not the data itself is passed back to the caller!)

The function executes the following steps:
1. read the ControlConstruct from ES
2. read timestamp information about already previously gathered data:
   - from the DPDMP datastore read the device object, which matches the input mount-name
   - this object contains a list of ltp/lps with most-recent-period-end-time information (in case of a new device, the list will be empty)
3. special filtering is applied to the data gathered in step1. This is done in step `applyFilteringForLtpStructureAugmentAirIfAndEthContainer`.
  If a different filtering should be applied in a future release, another filter step could be added and executed instead.  
  This step carries out the following filtering:
  - keep relevant equipment-augment information
  - keep relevant information about LTP structure and augment
  - keep layer-protocol information, if the layer-protocol is either an AirInterface or EthernetContainer instance
    - inside the layer-protocol only keep historical PM records,
      - which are of 15min or 24h granularity
      - and where the period-end-time is newer than the most-recent-period-end-time for this interface instance from step2
      - note: if in step2 no data was found for the mount-name at all, or if the found data does not contain an entry for a specific interface, all data for that mount-name/interface is treated as newer.
    - interface instances are only to be kept in the raw ControlConstruct if historical PM records remain after filtering has been applied

The function currently does not contain any additional filter rules (e.g. removal of default values, etc.).  

The raw ControlConstruct data follows ONF format. Only relevant attributes and subclasses are kept.  

### Diagram  

<p align="center">
  <img src="./p1LoadRawCc.png" alt="p1LoadRawCc diagram" width="400" />
</p>


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  


### NPM Module  

There is no NPM module as this is not a generic function.


