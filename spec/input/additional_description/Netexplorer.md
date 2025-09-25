## NetExplorer


#### Background
The NetExplorer already consumes MAC address data and configuration and general device data provisioned through the services in [NetExplorerProxy](https://github.com/openBackhaul/NetExplorerProxy) (NEP).  
Performance data initially should have been gathered in the NEP, but due to other consumers of PM data, it had been decided to build an own PM application for that.  

#### Required data
For NetExplorer the following information are required:
- [air interface](https://github.com/openBackhaul/airInterface):
  - G.826
  - RX and TX levels
  - XPD and SNIR
  - QAM statistics (time-xstates-list containing the transmission modes and time spent in the respective modes)
- [ethernet container](https://github.com/openBackhaul/ethernetContainer): 
  - total bytes and frames (RX/TX)
  - errored and dropped frames (RX/TX)
