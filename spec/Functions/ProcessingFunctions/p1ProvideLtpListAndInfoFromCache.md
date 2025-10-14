### p1ProvideLtpListAndInfoFromCache

The function shall read the LTP structure and LTP augments from the ElasticSearch MWDI cache copy.  
The LTP augment information is used to enrich the interface information gathered from the LTP structure data.


#### Input
The function gets a mount-name as input in its requestBody.

#### Steps
The service shall be processed as follows: 
- (1) execute the callback *FunctionForReadingLtpInfoCausesReadingFromElasticSearch* to obtain the list of LTPs including LtpAugments for the input device
- (2) execute callback *FunctionForIdentifyingPhysicalLinkAggregationsReadsFromElasticSearch* for all AirInterfaces seen in the data gathered by (1)

#### Callbacks
- FunctionForReadingLtpInfoCausesReadingFromElasticSearch
- FunctionForIdentifyingPhysicalLinkAggregationsReadsFromElasticSearch

#### Output
The function returns the list of LTPs of the given mount-name. Entries for AirInterface and EthernetContainers are enriched with additional information from LTP augments.
