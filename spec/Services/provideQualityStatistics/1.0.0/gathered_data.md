# Proposal for data gathering


### General notes
- Data gathering per interface instance can be done in p2IterateAiPmSlices and p2IterateEcPmSlices
  - count the number of seen records per interface instance
  - take day from date into account when counting, as there may be data for more than 1 day inside the data
- the total amount of expected records depends on the number of interface instances,
  to differentiate between them, ltp uuids may be required
- differentiate between airInterface & ethernetContainer (and possibly later on also others like wire interface)
- attach deviceType information to gathered record counts



### First idea

First idea was to store this information only flattly in dataStore next to device.
But this introduces a problem with the expected record counts, as they are tied to the seen interface instances.

Therefore: this could still be used, but as a end result, but there still needs to be something similar to the status for BH calculation,
where intermediate results are gathered.

quality-measurements:
------------------------------
| day_1 | day_2| ... | day_n |        array with key = calender day
------------------------------
   |
   |__-----------------------------------------
      | devType_1 | devType_2 | ... | unknown |     array with key = deviceType
      -----------------------------------------     
        |
        |_---------------------------------------------
          |  interfaceType_1 | ... | interfaceType_n  |     array with key = interfaceType
          ---------------------------------------------     (currently only AirIf + EthContainer)
             |
             |
             ----------------------------     -----------------------------
             | num of records           |     | num of expected records:  |
             | for this devType         |     | (interfaceCount) * 96     |
             | + ifType combination     |     -----------------------------
             | for this day             |
             ----------------------------     interfaceCount differentiates between devType + ifType




