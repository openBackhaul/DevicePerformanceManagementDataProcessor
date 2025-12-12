# p1ReplicateMwdiEs  


### Overview  

The p1ReplicateMwdiEs replicates the MWDI ElasticSearch index.  
The resulting MWDI ES Replica provides the raw data for processing PM data in the DPMDP.  

The p1ReplicateMwdiEs function performs an incremental replication of the MWDI
ElasticSearch index into the MWDI ES Replica. The replication is based on the
`last-complete-control-construct-update-time-attempt` attribute.

For each execution the function:

1. Determines the replication time window  
   - `fromTs` = last successful replication timestamp minus a small overlap  
   - `toTs`   = current time at the start of the replication  
   The overlap ensures that no updates at the window boundary are missed.

2. Copies all ControlConstructs that changed in this window  
   - Uses the ElasticSearch `_reindex` API with a `range` filter on `lastUpdated`  
   - Source index: MWDI ES  
   - Destination index: MWDI ES Replica  
   - Existing documents in the replica are overwritten with the latest version.
   - Sample code:
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

3. Reconciles deletes within the same replication run  
   - Reads the set of all CC identifiers (e.g. `mountName` / `_id`) from the MWDI ES index  
   - Reads the set of all CC identifiers from the MWDI ES Replica index  
   - Computes the difference (CCs that exist only in the replica)  
   - Issues a bulk delete request for those CCs to the MWDI ES Replica.  
   This ensures that CCs removed from MWDI ES are also removed from the replica
   as part of the same replication cycle.

4. Updates the replication log  
   - Stores the replication window (`fromTs`, `toTs`), the number of replicated
     CCs and deleted CCs, and a status message in the ReplicateMwdiEsLog.  
   - Persists the new `lastReplicationTimestamp = toTs` in the DataStore to be
     used as the starting point for the next replication run.

After updating the MWDI ES Replica has completed successfully, the list of
updated ControlConstructs (identified by `mountName`) is passed to
`p1ProcessingPmData` for further PM processing.

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

The below listed APPLICATION and ELASTICSEARCH Setting 
will be organised and formatted later in a discussion with Thorsten.
# APPLICATION SETTINGS
JOB_NAME=mw-to-dp-sync-dev
SCHEDULE_MINUTES=8

# ELASTICSEARCH SETTINGS
ES_NODE=http://localhost:9200
MW_INDEX=devices
DP_INDEX=devices_dp
LAST_UPDATED_FIELD=lastUpdated
OVERLAP_MS=60000
REQ_PER_SEC=2
SCROLL_SIZE=200
SCROLL_TTL=2m
SYNC_STATE_INDEX=sync_state

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
