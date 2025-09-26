# Functions

### ProcessingOrchestrator  

The ProcessingOrchestrator initiates the ProcessingFunctions according to a configuration list.  
Calling the ProcessingFunctions is triggered by receiving new data.  
RequestBodies or ResponseBodies are not exchanged with ProcessingFunctions.  
[Details on the ProcessingOrchestrator](./ProcessingOrchestrator/)  

### ProcessingFunctions  

The performance data, which has originally been retrieved from the devices, has to tbe processed in the following regards:
  - Replacement and deletion of implausible data
  - Harmonization in format and semantical meaning
  - Completion by configuration information
  - Completion by capability information
  - Completion by calculated KPIs

[Details on the ProcessingFunctions](./ProcessingFunctions/)  
