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
  
- replicationInterval  
  Time interval between two replications of the MWDI ES index  
  StringProfile in the configFile


mwdiNotificationSubscriptionSwitch

```
  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'mwdiElasticSearchClientInterface'
      purpose: 'ElasticSearchClientInterface of the MWDI ES'
      pattern: '^([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-es-c-([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{3})$'
    configuration:
      string-value: ''

  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'mwdiHttpClientInterface'
      purpose: 'HttpClientInterface of the MWDI ES'
      pattern: '^([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-http-c-([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-000$'
    configuration:
      string-value: ''

  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'mwdiTcpClientInterface'
      purpose: 'TcpClientInterface of the MWDI ES'
      pattern: '^([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-tcp-c-([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-000$'
    configuration:
      string-value: ''

  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'mwdiReplicaElasticSearchClientInterface'
      purpose: 'ElasticSearchClientInterface of the MWDI ES Replica'
      pattern: '^([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-es-c-([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{3})$'
    configuration:
      string-value: ''

  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'mwdiReplicaHttpClientInterface'
      purpose: 'HttpClientInterface of the MWDI ES Replica'
      pattern: '^([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-http-c-([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-000$'
    configuration:
      string-value: ''

  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'mwdiReplicaTcpClientInterface'
      purpose: 'TcpClientInterface of the MWDI ES Replica'
      pattern: '^([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-tcp-c-([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-000$'
    configuration:
      string-value: ''

  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'p1ReplicateMwdiEsLoggingElasticSearchClientInterface
      purpose: 'ElasticSearchClientInterface of the Logging of the p1ReplicateMwdiEs Function'
      pattern: '^([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-es-c-([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{3})$'
    configuration:
      string-value: ''

  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'p1ReplicateMwdiEsLoggingHttpClientInterface'
      purpose: 'HttpClientInterface of the Logging of the p1ReplicateMwdiEs Function'
      pattern: '^([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-http-c-([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-000$'
    configuration:
      string-value: ''

  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'p1ReplicateMwdiEsLoggingTcpClientInterface'
      purpose: 'TcpClientInterface of the Logging of the p1ReplicateMwdiEs Function'
      pattern: '^([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-tcp-c-([a-z]{2,6})-([0-9]{1,2})-([0-9]{1,2})-([0-9]{1,2})-000$'
    configuration:
      string-value: ''

  - profile-name: 'StringProfile'
    uuid: 'dpmdp-1-0-0-string-p-???'
    capability:
      string-name: 'p1ReplicateMwdiEsReplicationInterval'
      purpose: 'Length of time interval between two replications of the MWDI ES index in seconds'
    configuration:
      string-value: '30'

```
