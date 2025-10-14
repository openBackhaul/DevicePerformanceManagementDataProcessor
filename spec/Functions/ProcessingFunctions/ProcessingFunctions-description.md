### p1ReadLtpListAndInfoFromCache

The function shall read the LTP structure and LTP augments from the DPMDP ElasticSearch (MWDI cache copy).  
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

---  

### /p1ReadAirInterfaceConfigAndCapabilitiesFromCache

The function shall read AirInterface configuration and capabilities from the DPMDP ElasticSearch and return the relevant subset of attributes in its response.

#### Input
The function gets a mount-name, as well as the target AirInterface's uuid and localId as input in its requestBody.

#### Steps
The service shall be processed as follows: 
- read the AirInterface configuration from the Cache via callback
- read the AirInterface capabilties from the Cache via callback
- add only relevant attributes gathered from the read operations to the output

Configuration and Capability are read separately. Directly accessing ElasticSearch would also have allowed to retrieve the complete pac and filter for configuration and capability, but instead two separate read options were specified to be conform to MWDI, where the complete pac is not exposed as an own ressource path.

#### Callbacks
The callback *FunctionForProvidingAirInterfaceConfigAndCabilitiesCausesReadingFromElasticSearch* consists of two steps:
- FunctionForProvidingAirInterfaceConfigAndCabilitiesCausesReadingFromElasticSearch.Config
- FunctionForProvidingAirInterfaceConfigAndCabilitiesCausesReadingFromElasticSearch.Capabilities

#### Output
The function returns relevant configuration and capability attributes for the given AirInterface instance.

---  

### /p1ReadRecentAirInterfaceHistoricalPmDataFromCache

The function shall read AirInterface historical PM data records with 15min granularity from Cache, which are newer than an input timestamp.  
If no input timestamp is provided, all found 15min records are returned. If no newer records are found, the result list remains empty.

#### Input
The function gets a mount-name, as well as the target AirInterface's uuid and localId as input in its requestBody.  
Additionally a timestamp filter attribute can be provided.

#### Steps
The service shall be processed as follows: 
- read all *air-interface-historical-performances/historical-performance-data-list* records WHERE *period-end-time* is newer than the input filter *timestamp* AND *granularity-period* indicates 15-min granularity
- all other records from the *historical-performance-data-list* are ignored
- return the filtered records which were found. If none were found, the list remains empty.

#### Callbacks
- FunctionForReadingRecentAirInterfaceHistoricalPmCausesReadingFromElasticSearch

#### Output
The function returns the *air-interface-historical-performances/historical-performance-data-list* with the filtered records of the most recent 15min data.  

---  

### /p1ReadRecentEthernetContainerHistoricalPmDataFromCache

The function shall read EthernetContainer historical PM data records with 15min granularity from Cache, which are newer than an input timestamp.  
If no input timestamp is provided, all found 15min records are returned. If no newer records are found, the result list remains empty.

#### Input
The function gets a mount-name, as well as the target EthernetContainer's uuid and localId as input in its requestBody.  
Additionally a timestamp filter attribute can be provided.

#### Steps
The service shall be processed as follows: 
- read all *ethernet-container-historical-performances/historical-performance-data-list* records WHERE *period-end-time* is newer than the input filter *timestamp* AND *granularity-period* indicates 15-min granularity
- all other records from the *historical-performance-data-list* are ignored
- return the filtered records which were found. If none were found, the list remains empty.

#### Callbacks
- FunctionForReadingRecentEthernetContainerHistoricalPmCausesReadingFromElasticSearch

#### Output
The function returns the *ethernet-container-historical-performances/historical-performance-data-list* with the filtered records of the most recent 15min data.  