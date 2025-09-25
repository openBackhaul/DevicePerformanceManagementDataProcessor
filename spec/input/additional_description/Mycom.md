## Mycom

Mycom serves as a platform and long-term storage for collecting Performance Measurement data in a centralized place, the PM data is also enriched with configuration information. It is not only gathering data for Microwave devices, but also for the large variety of other network elements present in the Telefonica network.  
Mycom allows to build complex KPIs from the raw counters and configuration data, which can be aggregated across network elements and time.  
While Mycom supports building a variety of reports from network elements and KPIs, for Microwave data it mainly acts as a data provider to other tools like APT or NetExplorer.  

#### Benefit of harmonized data model for Mycom
Mycom can greatly benefit from the harmonized data model, that all SDN devices adhere to.  
- In the past introducing new device types lead to extensive and long-taking modifications - first to be made in ComarchOSS (supplier of data to Mycom) and then in Mycom software itself in order to load the data into Mycom. Lastly, new KPIs had to be created and existing ones had to be modified to also include those new KPIs.  
- Also in case of issues and missing data, Mycom users suffered from intransparency.  
- With the SDN harmonized data model, adding new device types to the network leads to the data immediately being available as soon as it can be collected by the SDN applications, without the need for extensive modifications or adjustments in Mycom.   

#### Relevant PM statistics
Most commonly used MW information in Mycom are: 
- G.826 statistics (ES, SES, etc.)
- RX and TX level data
- QAM data
- Ethernet data (RX/TX packet and octet statistics)

SDN can also provide historical performance measurement data for these fields from the following interfaces:
- [air interface](https://github.com/openBackhaul/airInterface): G.826, RX/TX level, QAM
- [ethernet container](https://github.com/openBackhaul/ethernetContainer): bytes and frames statistics (instead of packets and octets)

**Suggestion**: store data for all counters from those interfaces in Mycom  
As Mycom stores large amounts of data and the both interfaces only have a limited number of counters, Mycom could store all of them.


#### Raw vs. aggregated data
Currently Mycom only gets raw data from ComarchOSS and performs all aggregations and complex computations from raw counters itself.  
SDN will also provide raw data. If aggregations would be required for other applications, the aggregated data could also be provided to Mycom.  