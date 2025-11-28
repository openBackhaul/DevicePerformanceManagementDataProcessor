# p1ReplicateMwdiEs  


### Overview  

The p1ReplicateMwdiEs replicates the MWDI ElasticSearch index.  
The resulting MWDI ES Replica provides the raw data for processing PM data in the DPMDP.  

The p1ReplicateMwdiEs reacts on entire ControlConstruct (CC) being updated, e.g. by the cyclic sliding window process in the MWDI.  
An instance of p1ProcessingPmData is triggered for every updated CC after updating the MWDI ES Replica has been completed.  

The update interval is configurable.  


### Parameters  

The p1ReplicateMwdiEs requires the following parameters:  

- Interface to MWDI ES  
  ElasticSearchClientInterface in the configFile  

- Interface to MWDI ES Replica  
  ElasticSearchClientInterface in the configFile  

- replicationInterval  
  Time interval between two replications of the MWDI ES index  
  StringProfile in the configFile


### Diagram  

<p align="center">
  <img src="./p1ReplicateMwdiEs.png" alt="p1ReplicateMwdiEs diagram" width="400" />
</p>


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  
