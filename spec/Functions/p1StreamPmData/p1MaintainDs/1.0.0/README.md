# p1MaintainDs

Periodically deletes resultsCc (with batchTimestamp older than dataStoreRetentionPeriod) from the dataStore  
(It does not cover deletion of devices from the dataStore)


### Diagram  

<p align="center">  
  <img src="./p1MaintainDs.png" alt="p1MaintainDs diagram" width="400" />
</p>  


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  


### Variables

Please find a detailed description of the [variables](./variables.yaml).


### Parameters

| Parameter Name               | Description                                                  |
|------------------------------|--------------------------------------------------------------|
| dataStoreCleanupPeriod       | Time period between two cleanup runs                         |
| dataStoreRetentionPeriod     | Time period for which data is retained before deletion       |

