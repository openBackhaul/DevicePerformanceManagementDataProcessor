### p1setOutOfRangeLevelPmValuesToDefaultInDsfpOutput

**this assumes data is in CC format, not in APTP format**

The service shall replace the values of RX level and TX level attributes from air interface historical performances records, which are out of the reasonable ranges by the agreed default value (*null* - to be agreed).
- RX level ∈ (−129.0, −99.9) ∪ (−99.9, −10.0)
- TX level ∈ [−30.0, 40.0]
After the service has been executed [/data-structure-for-processing/output] shall no longer contain any out of range values for RX level and TX level attributes.

#### Input
There is no request body input. All required data is directly read from [/data-structure-for-processing/output]

#### Steps
The service shall be processed as follows: 
- IF NOT ([/data-structure-for-processing/object-path] contains "air-interface") THEN terminate
- read [/data-structure-for-processing/output],
  - navigate to *air-interface-historical-performances/historical-performance-data-list*
  - FOR EACH record in the *historical-performance-data-list*, read object *performance-data*
    - IF NOT (tx-level-max ∈ [−30.0, 40.0]) THEN replace tx-level-max value by *null*
    - IF NOT (tx-level-min ∈ [−30.0, 40.0]) THEN replace tx-level-min value by *null*
    - IF NOT (tx-level-avg ∈ [−30.0, 40.0]) THEN replace tx-level-avg value by *null*
    - IF NOT (rx-level-max ∈ (−129.0, −99.9) ∪ (−99.9, −10.0)) THEN replace rx-level-max value by *null*
    - IF NOT (rx-level-min ∈ (−129.0, −99.9) ∪ (−99.9, −10.0)) THEN replace rx-level-min value by *null*
    - IF NOT (rx-level-avg ∈ (−129.0, −99.9) ∪ (−99.9, −10.0)) THEN replace rx-level-avg value by *null*
  - when *historical-performance-data-list* has been completely processed, terminate

#### Callbacks
none

#### Output
There is no additional output defined. All changes are to be written directly into [/data-structure-for-processing/output].