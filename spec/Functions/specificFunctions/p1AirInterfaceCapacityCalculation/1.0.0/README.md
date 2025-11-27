# p1AirInterfaceCapacityCalculation


    ### p1Inquire15minAirInterfaceKpisFromCaca

    This function sends AirInterface data to the CapacityCalculator app for getting capacity KPI values.

    **Usage**:
    This function can be called from within DPMDP or can be used externally.  
    - DPMDP usage:
      - the dataHandle has to be provided in the requestBody
      - the function reads data from the [/data-structure-for-processing/output] object associated with the dataHandle directly from DPMDP memory
      - the KPI attribute values received from CaCa are also written directly back into [/data-structure-for-processing/output]
    - external usage:
      - the required input data has to be provided in the requestBody; it follows the schema of [/data-structure-for-processing/output] but only contains the relevant attributes
      - the KPI attribute values received from CaCa are returned in the response

    #### Input
    Either the dataHandle for internal usage or an air-interface-list (limited to the relevant attributes) for external usage.

    #### Steps
    The function shall be processed as follows:  
    - for internal usage read the attributes relevant for AirInterface capacity KPI calculation from the [/data-structure-for-processing/output] object associated with the dataHandle; for external usage the relevant information is provided in the requestBody
    - send the data to the CapacityCalculator
    - update the KPI attributes with the received values directly in [/data-structure-for-processing/output] for internal usage, or return them in the response for external usage

    #### Callbacks
    - `InquiringFor15minAirIfCapacityKpiCalculationCausesReadingFromDsfpOutput`
      - reads the relevant AirInterface attributes for all AirInterfaces found in the air-interface-list of [/data-structure-for-processing/output]
    - `InquiringFor15minAirInterfaceCapacityKpiCalculationCausesCallingCacaAndWritingOrReturningData`
      - *getKPIs*: sends this data to the CapacityCalculator
      - *updateDataInMemory*: in case of internal usage writes them back into [/data-structure-for-processing/output]

    #### Output
    Changes are either directly written to [/data-structure-for-processing/output] (internal usage) or the modified input data is returned in the response (external usage).
