# p1LoadRawCc


### Overview  

The p1LoadRawCc function receives the mountName of a device as input and reads the raw ControlConstruct data of this
device from the MWDI ES replica.  
It filters the raw ControlConstruct from unwanted data and returns it as output.  

The following generic functions are called to reduce the data of raw ControlConstruct:
- [p1FieldsFilter](https://github.com/openBackhaul/ApplicationPattern/tree/develop/spec/genericFunctions/p1FieldsFilter/1.0.0)  
- [p1DiscardIrrelevantPmRecords](https://github.com/openBackhaul/ApplicationPattern/tree/develop/spec/genericFunctions/p1DiscardIrrelevantPmRecords/1.0.0)


### Diagram  

<p align="center">
  <img src="./p1LoadRawCc.png" alt="p1LoadRawCc diagram" width="400" />
</p>


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  
