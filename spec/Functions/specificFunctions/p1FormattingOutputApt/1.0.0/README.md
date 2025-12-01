# p1FormattingOutputApt


### Overview  

The p1FormattingOutputApt function transforms an input ControlConstruct data object in ONF format into the [APT output format](./InformationStructure/OutputApt.yaml).  

The following additional generic functions are called to derive identifiers and LinkAggregation information for AirInterfaces and EthernetContainers from the input ControlConstruct:

- [p1ComputeAirInterfaceNames](https://github.com/openBackhaul/ApplicationPattern/tree/develop/spec/genericFunctions/p1ComputeAirInterfaceNames/1.0.0)  
- [p1ComputeAirInterfacePhysicalLag](https://github.com/openBackhaul/ApplicationPattern/tree/develop/spec/genericFunctions/p1ComputeAirInterfaceLag/1.0.0)  
- [p1ComputeEthContainerNames](https://github.com/openBackhaul/ApplicationPattern/tree/develop/spec/genericFunctions/p1ComputeEthernetContainerName/1.0.0)  

As described in [_PM/#21](https://github.com/openBackhaul/_PerformanceManagement/issues/21), only reasonable data will be provided. This means that in case of missing attribute values in the input ControlConstruct, these attributes will also be missing in the generated output.

### Diagram  

<p align="center">
  <img src="./p1FormattingOutputApt.png" alt="p1FormattingOutputApt diagram" width="400" />
</p>


### Interface  

Please find a detailed description of the [interface](./interface.yaml).  


### NPM Module  

There is no NPM module as this is not a generic function.