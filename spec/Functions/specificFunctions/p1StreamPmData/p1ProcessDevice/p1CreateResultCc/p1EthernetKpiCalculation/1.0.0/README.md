# p1EthernetKpiCalculation


    ### p1Inquire15minEthernetContainerKpisFromCaca

    This function sends EthernetContainer data to the CapacityCalculator app for getting Ethernet KPI values.

    **Usage**:
    This function can be called from within DPMDP or can be used externally.  
    - DPMDP usage:
      - the dataHandle has to be provided in the requestBody
      - the function reads data from the [/process-device/output] object associated with the dataHandle directly from DPMDP memory
      - the KPI attribute values received from CaCa are also written directly back into [/process-device/output]
    - external usage:
      - the required input data has to be provided in the requestBody; it follows the schema of [/process-device/output] but only contains the relevant attributes
      - the KPI attribute values received from CaCa are returned in the response

    #### Input
    Either the dataHandle for internal usage or an ethernet-container-list (limited to the relevant attributes) for external usage.

    #### Steps
    The function shall be processed as follows:  
    - for internal usage read the attributes relevant for EthernetContainer KPI calculation from the [/process-device/output] object associated with the dataHandle; for external usage the relevant information is provided in the requestBody
    - send the data to the CapacityCalculator
    - update the KPI attributes with the received values directly in [/process-device/output] for internal usage, or return them in the response for external usage


    #### Callbacks
    - `InquiringFor15minEthContainerKpiCalculationCausesReadingFromDsfpOutput`
      - reads the relevant EthernetContainer attributes for all EthernetContainers found in the ethernet-container-list of [/process-device/output]
    - `InquiringFor15minEthContainerKpiCalculationCausesCallingCacaAndWritingOrReturningData`
      - *getKPIs*: sends this data to the CapacityCalculator
      - *updateDataInMemory*: in case of internal usage writes them back into [/process-device/output]

    #### Output
    Changes are either directly written to [/process-device/output] (internal usage) or the modified input data is returned in the response (external usage).
