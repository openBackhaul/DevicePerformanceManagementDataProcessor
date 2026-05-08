# p1TransmittingKafka

Transfers outputFormats to their respective KafkaClient.  


### Overview

p1TransmittingKafka receives the list of outputFormats.  
Each outputFormat is identified by its formatName.  
p1TransmittingKafka checks its parameters for an entry with purpose=="kafkaClient" and parameterName==formatName.  
If there is such an entry, then kafkaClientUuid=value.  
It uses the kafkaClientUuid to retrieve the kafkaClient's configuration from the configFile.  
Finally, it transmits the outputFormat to Kafka.  

Limitation:  
- Not supported are multiple kafkaClients for the same outputFormat.  
  (parameterName==formatName is key attribute in parameters.)  


### Diagram  

<p align="center">  
  <img src="./p1TransmittingKafka.png" alt="p1TransmittingKafka diagram" width="400" />
</p>  


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  


### Variables

Please find a detailed description of the [variables](./variables.yaml).


### Parameters

| Parameter Name               | Description                                                                        |
|------------------------------|------------------------------------------------------------------------------------|
| [formatName]                 | Special usage of the parameters. parameter-name is not static. For all parameters with purpose==kafkaClient, parameter-name is using the formatName for identifying a kafkaClient and value contains the kafkaClientUuid |


### NPM Module

[mw-sdn-p1-transmitting-kafka](https://www.npmjs.com/package/mw-sdn-p1-transmitting-kafka)  

