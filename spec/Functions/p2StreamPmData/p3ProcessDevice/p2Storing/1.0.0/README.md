# p2Storing  

Stores the resultCc (if activated), offsets and statusData of a device in the DataStore.  

Offsets and statusData of diverse Functions are identified by functionName.  
Offsets are for describing the status of the program execution, like pagination or mostRecentPeriodEndTimes.  
StatusData are for describing the status of the device, like total-bytes-output values of two 15-minute intervals that need some intermediate storing until the missing two values arrived and the aggregated value for the entire hour can be computed.  

**Attention**  
Storing of the resultCc is deactivated by default.  
Activating it requires activating the p1MaintainDs function, too!  
Please be aware that the deactivation of the p1MaintainDs function must be done a long while (maybe even several days) after the deactivation of the storing of the resultCc.  
Otherwise, the DataStore would stay permanently inflated with useless data.  

## Diagram  

<p align="center">  
  <img src="./p2Storing.png" alt="p2Storing diagram" width="400" />
</p>  

## Interface  

Please find a detailed description of the [interface](./interface.yaml).  

## Variables

Please find a detailed description of the [variables](./variables.yaml).  

## Schema of the DataStore

Please find a detailed description of the [schema](./data-store-schema/dataStore.yaml).  

## NPM Module  

[mw-sdn-p2-storing](https://www.npmjs.com/package/mw-sdn-p2-storing)  

## Additional notes

**Information on ElasticSearch representation (implementation note)**

This note refers to the actual implementation.  

The specification describes logical datastore paths such as: `/data-store/device={mountName}/processing-data`
The Elasticsearch implementation stores one document per device using: `_id = mountName`
The corresponding data is stored under:

```
_source.processing-data
_source.result-data
```

This implementation is semantically consistent with the specified datastore schema. However, the physical Elasticsearch representation is documented here to prevent the logical datastore path from being interpreted as the Elasticsearch document ID, for example: `device={mountName}/processing-data`

Note that:
- the Elasticsearch document ID is the mount name;
- processing-data and result-data are fields in the same device document;
- the logical datastore URL is not the physical Elasticsearch document ID.