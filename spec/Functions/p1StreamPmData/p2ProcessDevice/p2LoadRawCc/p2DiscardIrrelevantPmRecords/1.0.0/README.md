# p2DiscardIrrelevantPmRecords

Discards records that have already been processed in past from historical performance data list.  
Accepts both AirInterface and EthernetContainer PM records.  
Also counts the number of received and not filtered out 15min PM slices per date.

Returns the updated mostRecentPeriodEndTime information along with information about the number of received 15min PM slices. 

### Diagram  

<p align="center">
  <img src="./p2DiscardIrrelevantPmRecords.png" alt="p2DiscardIrrelevantPmRecords diagram" width="400" />
</p>


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  


### Variables

Please find a detailed description of the [variables](variables.yaml).


### NPM Module  

[mw-sdn-p1-discard-irrelevant-pm-records](https://www.npmjs.com/package/mw-sdn-p1-discard-irrelevant-pm-records)  

