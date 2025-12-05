# p1ReplicateMwdiEs  


### Overview  

The p1ReplicateMwdiEs replicates the MWDI ElasticSearch index.  
The resulting MWDI ES Replica provides the raw data for processing PM data in the DPMDP.  

The p1ReplicateMwdiEs reacts on entire ControlConstruct (CC) being updated, e.g. by the cyclic sliding window process in the MWDI.  
An instance of p1ProcessingPmData is triggered for every updated CC after updating the MWDI ES Replica has been completed.  

The update interval is configurable.  


### Diagram  

<p align="center">
  <img src="./p1ReplicateMwdiEs.png" alt="p1ReplicateMwdiEs diagram" width="400" />
</p>


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  


### Parameters  

The p1ReplicateMwdiEs requires the following parameters:  

- Interface to MWDI ES  
  - _ElasticSearchClientInterface
  - _HttpClientInterface
  - _TcpClientInterface

- Interface to MWDI ES Replica  
  - _ElasticSearchClientInterface
  - _HttpClientInterface
  - _TcpClientInterface

- Interface to ReplicateMwdiEsLog  
  - _ElasticSearchClientInterface
  - _HttpClientInterface
  - _TcpClientInterface

- Interface to DataStore  
  - _ElasticSearchClientInterface
  - _HttpClientInterface
  - _TcpClientInterface
  
- replicationInterval  
  Time interval between two replications of the MWDI ES index  
  StringProfile in the configFile
