# DevicePerformanceManagementDataProcessor
Retrieves PM data from cache, processes it, and makes it available via Kafka.

## Description

The DevicePerformanceMangementDataProcessor (DPMDP) gatheres relevant historical performance data of devices from cache, triggered by MWDI notifications.
- Notification receipt:
  - MWDI cycically retrieves the complete ControlConstruct of devices, thereby creating a new attribute value change notification for every AirInterface and EthernetContainer with changed timeOfLastChange attribute
  - DPMDP can either subscribe to MWDI to directly receive these notifications via Webhook or can consume them from Kafka
  - Upon receipt, DPMDP only processes the first notification for a device related to this ControlConstruct update, subsequent notifications are ignored
- DPMDP reads the complete ControlConstruct for the device from the respective notification directly from ElasticSearch
- DPMDP applies various internal functions to process the data, like removing irrelevant data, replacing unreasonable attribute values, etc.
