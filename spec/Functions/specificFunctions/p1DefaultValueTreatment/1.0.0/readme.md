# p1DefaultValueTreatment  


### Overview  

The p1DefaultValueTreatment Function removes attributes representing the ONF default value.  


### Diagram  


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  


### NPM Module  

[mw-sdn-p1DefaultValueTreatment](https://www.npmjs.com/package/mw-sdn-p1DefaultValueTreatment)  


    ### p1ReplaceOnfDefaultValues

    This function replaces ONF default attribute values of -1 (number) or "-1" (string) and replaces them with null (numbers) or empty string (string). For KPI attributes -1 values are not replaced.  

    **Usage**:
    This function can be called from within DPMDP or can be used externally.  
    - DPMDP usage:
      - the dataHandle has to be provided in the requestBody
      - the function reads the complete output object from the [/data-structure-for-processing/output] object associated with the dataHandle directly from DPMDP memory
      - the modified output object with replaced values is written directly back into [/data-structure-for-processing/output]
    - external usage:
      - the required input data has to be provided in the requestBody; it follows the schema of [/data-structure-for-processing/output]
      - the modified output object with replaced values is returned in the response


    #### Input
    Either the dataHandle for internal usage or an complete output object for external usage.

    #### Steps
    The function shall be processed as follows:
    - read the output object from [/data-structure-for-processing/output] directly
    - for each counter attribute check whether it has an ONF default value of -1 (or "-1"), if it does, replace its value as follows:
      - for number attributes: with *null*
      - for string attributes: with empty string
      
    Note: for some EthernetContainers values are represented as string instead of numbers, thus, empty string is used instead of *null*.  

    #### Callbacks
    - `FunctionForReplacingOnfDefaultValuesCausesReadingDsfpOutput`
      - reads the data associated with the dataHandle directly from [/data-structure-for-processing/output]
    - `FunctionForReplacingOnfDefaultValuesCausesWritingOrReturningData`:
      - *replaceOnfDefaultsAndReturnData*: replaces ONF default values in the data from requestBody and returs it in the response
      - *replaceOnfDefaultValuesInMemory*: applies the same rules for ONF default value replacement as in *replaceOnfDefaultsAndReturnData*, but to the data read from memory. Then writes back the modified data to [/data-structure-for-processing/output]

    #### Output
    Changes are either directly written to [/data-structure-for-processing/output] (internal usage) or the modified input data is returned in the response (external usage).


