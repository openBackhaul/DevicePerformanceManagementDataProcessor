### p1removeNoiseFromQamTimeXstatesListDsfpOutput

**this assumes data is in CC format, not in APTP format**

The service shall remove blocks of time-xstates-list, if the amount of time the interface was running with a given modulation scheme is lesser than or equal to 0. In that case the modulation scheme was not used within the respective 15min interval.   

#### Input
There is no request body input. All required data is directly read from [/data-structure-for-processing/output]

#### Steps
The service shall be processed as follows: 
- IF NOT ([/data-structure-for-processing/object-path] contains "air-interface") THEN terminate
- read [/data-structure-for-processing/output],
  - navigate to *air-interface-historical-performances/historical-performance-data-list*
  - FOR EACH record in the *historical-performance-data-list*, read object *performance-data/time-xstates-list*
    - FOR EACH array item t in *time-xstates-list* read value of t.*time*
      - IF (t.*time* <= 0) THEN delete the complete item t from the *time-xstates-list*
      - when *time-xstates-list* has been completely processed, continue with next record
   - when *historical-performance-data-list* has been completely processed, terminate 

#### Callbacks
none

#### Output
There is no additional output defined. All changes are to be applied directly to [/data-structure-for-processing/output].