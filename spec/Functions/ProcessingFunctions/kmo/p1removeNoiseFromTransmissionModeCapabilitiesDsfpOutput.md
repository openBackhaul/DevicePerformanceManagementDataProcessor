### p1removeNoiseFromTransmissionModeCapabilitiesDsfpOutput

**this assumes data is in CC format, not in APTP format**

The service shall remove blocks for transmission modes from the *transmission-mode-list* of air interface capabilities, if they do not provide useful information.  
This is the case, when e.g. the code-rate is -1, which indicates that this transmission mode is not used.  

#### Input
There is no request body input. All required data is directly read from [/data-structure-for-processing/output]

#### Steps
The service shall be processed as follows: 
- IF NOT ([/data-structure-for-processing/object-path] contains "air-interface") THEN terminate
- read [/data-structure-for-processing/output],
  - navigate to *air-interface-capability/transmission-mode-list*
    - FOR EACH array item t read the value of *code-rate*,
    - IF (t.*code-rate* == -1) THEN delete the complete item t from the *transmission-mode-list*
  - when *transmission-mode-list* has been completely processed, terminate

#### Callbacks
none

#### Output
There is no additional output defined. All changes are to be applied directly to [/data-structure-for-processing/output].