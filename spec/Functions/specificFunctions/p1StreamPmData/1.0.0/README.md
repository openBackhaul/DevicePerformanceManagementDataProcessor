# p1StreamPmData  

The p1StreamPmData is cyclically processing:  
- Replicate updated ControlConstructs from the MWDI ES index into the MWDI ES Replica index (which holds the raw data for processing PM data in the DPMDP)  
- Initiate the processing of PM data of the updated ControlConstructs  


### Overview  

After getting started by the embedYourself function, the p1StreamPmData ...  
  - loads the parameter values for the entire cyclic PM data processing from the configFile  
  - composes the address information of all the involved ElasticSearch indices  
  - triggers the cyclic execution of the DataStore cleanup  
  - cyclically triggers the replication of the MWDI ES index and the subsequent processing of PM data  


### Diagram  

<p align="center">
  <img src="./p1StreamPmData.png" alt="p1StreamPmData diagram" width="400" />
</p>


### Variables  

Detailed description of the [internal variables](./variables.yaml).  


### Interface  

Detailed description of the [interface](./interface.yaml).  

