
# OLD

p1StreamPmData 



### Overview  

The p1StreamPmData function performs an incremental replication of the MWDI
ElasticSearch index into the MWDI ES Replica.  
A new value of the lastCompleteControlConstructUpdateTimeAttempt attribute at a ControlConstruct in the MWDI ES index triggers the same ControlConstruct being replicated into the MWDI ES Replica.  

For each execution the function:  

  1. Determines the replication time window  
    - fromTs = last successful replication timestamp minus a small overlap  
    - toTs  = current time at the start of the replication  
    The overlap ensures that no updates at the window boundary are missed  

  2. Copies all ControlConstructs that changed in this window  
    - Uses the ElasticSearch _reindex API with a range filter on lastUpdated  
    - Source index: MWDI ES  
    - Destination index: MWDI ES Replica  
    - Existing documents in the replica are overwritten with the latest version  
    - Sample code:
        ```
          es.reindex({
            refresh: false,
            wait_for_completion: true,
            requests_per_second: config.es.requestsPerSecond,
            body: {
            source: {
              index: config.es.mwIndex,
              query: {
                range: {
                [config.es.lastUpdatedField]: {
                  gt: fromTs,
                  lte: toTs
                }
                }
              }
            },
            dest: {
              index: config.es.dpIndex,
              op_type: "index"
            },
            conflicts: "proceed"
            }
          });
        ```

  3. Reconciles deletes within the same replication run  
    - Reads the set of all CC identifiers (e.g. mountName / uuid) from the MWDI ES index  
    - Reads the set of all CC identifiers from the MWDI ES Replica index  
    - Computes the difference between the two sets (CCs that exist only in the replica)  
    - Issues a bulk delete request for those CCs to the MWDI ES Replica  

  This ensures that CCs removed from MWDI ES are also removed from the replica as part of the same replication cycle  
  <!-- todo: Please, double check the design, it might not be necessary to clean up the Replica on every run -->

  4. Updates the replication log  
    - Stores the replication window (fromTs, toTs), the number of replicated CCs and deleted CCs, and a status message in the ReplicateMwdiEsLog  
    - Persists the new lastReplicationTimestamp = toTs in the SynchStateEs to be used as the starting point for the next replication run  

After updating the MWDI ES Replica has completed successfully, the p1ProcessDevice Function is called for every MountName in the list of updated ControlConstructs.  
<!-- todo: Please consider how to avoid a load peaks caused by calling p1ProcessDevice for all devices in the list. Approximately 4 devices per second are updated in MWDI. What is a reasonable length of the synchPeriod? Would it make sense to distributed the calls of p1ProcessDevice over time? -->  

The update interval is configurable.  

