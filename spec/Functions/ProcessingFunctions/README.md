# ProcessingFunctions  

    Please add short descriptions of the individual ProcessingFunctions here
    The concrete description in the yaml should clarify:
      - where exactly is the input data coming from
      - exact formulation/algorithm etc.
      - where exactly is the output data written to
    Locations might often look like this:
      from [/data-structure-for-processing/input/...]
      to [/data-structure-for-processing/output/...]

### p1copyDsfpInputToDsfpOutput
Copies the contents of [/data-structure-for-processing/input] to [/data-structure-for-processing/output].  

### p1removeUnwantedAirIfAttributesFromDsfpOutput
If [/data-structure-for-processing/object-path] indicates that the interface is an air-interface, this function reads the contents from [/data-structure-for-processing/output] and deletes the unwanted interface data from it. (This does not not include certain attributes, which are handled by separate functions.)  
There is no additional input or output.  

### p1removeUnwantedEthContainerAttributesFromDsfpOutput
If [/data-structure-for-processing/object-path] indicates that the interface is an ethernet-container, this function reads the contents from [/data-structure-for-processing/output] and deletes the unwanted interface data from it.  
There is no additional input or output.  

### p1removeNoiseFromTransmissionModeCapabilitiesDsfpOutput
If [/data-structure-for-processing/object-path] indicates that the interface is an air-interface, this function reads the contents from [/data-structure-for-processing/output].  
Inside this data it navigates to *air-interface-capability/transmission-mode-list*, which indicates what modulations are available for the interface. For each array item inside the *transmission-mode-list* it checks whether the complete array item is to be kept or deleted. If the code-rate is -1, then the complete array item is deleted from the *transmission-mode-list*, as it does not provide useful information.  
All deletions are applied directly to the contents of [/data-structure-for-processing/output].
There is no additional input or output.  

### p1removeNoiseFromQamTimeXstatesListDsfpOutput
If [/data-structure-for-processing/object-path] indicates that the interface is an air-interface, this function reads the contents from [/data-structure-for-processing/output].  
Inside this data it navigates to *air-interface-historical-performances/historical-performances-data-list*, which stores the performance data for the different time intervals.
The function traverses through all the *performance-data/time-xstates-list* records and checks for each record, whether the contained *time* attribute is <= 0. If it is, the complete record is removed from the *time-xstates-list*.  
All deletions are applied directly to the contents of [/data-structure-for-processing/output].
There is no additional input or output.  

### p1setOutOfRangeLevelPmValuesToDefaultInDsfpOutput
If [/data-structure-for-processing/object-path] indicates that the interface is an air-interface, this function reads the contents from [/data-structure-for-processing/output].  
Inside this data it navigates to *air-interface-historical-performances/historical-performances-data-list* and reads every of its *performance-data* items.  
Whenever it encounters a TX level or RX level attribute, it is checking whether the attribute value is within a reasonable range - if not it gets replaced by an agreed upon default value.  
All deletions are applied directly to the contents of [/data-structure-for-processing/output].
There is no additional input or output.  

### 
  