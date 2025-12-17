# p1OutOfRangeValueTreatment


    ### p1SetOutOfRangeLevelValuesToDefault

    This function replaces invalid level values of AirInterface attributes.  
    The level values should be withing the following expected ranges, otherwise they are considered out-of-range:
    - transmit-level: ∈ [−30.0, 40.0]
    - receive-level: ∈ (−129.0, −99.9) ∪ (−99.9, −10.0)

    **Usage**:
    This function can be called from within DPMDP or can be used externally.  
    - DPMDP usage:
      - the dataHandle has to be provided in the requestBody
      - the function reads data from the [/process-device/output] object associated with the dataHandle directly from DPMDP memory
      - the manipulated attribute values are also written directly back into [/process-device/output]
    - external usage:
      - the required input data has to be provided in the requestBody; it follows the schema of [/process-device/output] but only contains the relevant attributes
      - the manipulated attribute values are returned in the response

    #### Input
    Either the dataHandle for internal usage or an air-interface-list (limited to the relevant identifiers and level attributes in the performance-measurement-list) for external usage.

    #### Steps
    The function shall be processed as follows:  
    - for internal usage read the [/process-device/output] data associated with the dataHandle directly from DPMDP memory; for external usage this data is provided in the requestBody.
    - check for all AirInterfaces in air-interface-list, whether the transmit-level and receive-level attributes contain out-of-range-values
      - if the value is out-of-range then set to respective attribute to -1
    - the changed attribute values then are either written directly to [/process-device/output] (internal usage) or returned in the response (external usage)

    #### Callbacks
    - `SettingOutOfRangeLevelValuesToDefaultCausesReadingFromDsfpOutput`
      - reads the data associated witht the dataHandle from memory
    - `SettingOutOfRangeLevelValuesToDefaultCausesWritingToDsfpOutputOrReturningChangedData`
      - *returnDataNonHandle*: [external usage] the level values are checked and replaced where necessary, they are returned
      - *updateDataInMemory*: [internal usage] the level values are checked and replaced where necessary, but written directly to memory

    #### Output
    Changes are either directly written to [/process-device/output] (internal usage) or the modified input data is returned in the response (external usage).