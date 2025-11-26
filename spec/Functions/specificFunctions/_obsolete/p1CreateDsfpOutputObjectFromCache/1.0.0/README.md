# p1CreateDsfpOutputObjectFromCache  


### Overview  

- creates the initial Output object inside the DataStructureForProcessing object  
- removes data that has already been processed in past  
- removes performance measurement records that are not of 15 minutes granularity  
- removes empty adaptive modulation counter records (device did not operate this modulation)  
- removes incomplete adaptive modulation capabilities (codeRate attribute has default value)  
- terminates process if no new data remains  


### Description  

The output object inside the DataStructureForProcessing object is comprising the PM data of all AirInterfaces and all EthernetContainers at the device.  

It comprises the latest 15 minute values.



<!-- todo: Detailed description to be added -->


### Interface  

[!interface](./interface.yaml)  


### Diagram  

[!diagram](./diagram.png)  


### NPM Module  

No NPM package for specific function.  
