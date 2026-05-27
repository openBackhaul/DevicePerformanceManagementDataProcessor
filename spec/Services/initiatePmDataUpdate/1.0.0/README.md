# initiatePmDataUpdate

## Overview

The initiatePmDataUpdate service can be called on demand.  
It requires a list of mountNames as input, and triggers updating the controlConstruct of these devices in the MWDI ES.  
Updated controlConstructs trigger the processing and sending of PM data for these devices by the DPMDP.  

## Diagram

<p align="center">
  <img src="./initiatePmDataUpdate.png" alt="initiatePmDataUpdate diagram" width="400" />
</p>

## Interface

Please find a detailed description of the interface in the [openAPI specification](../../../DevicePerformanceManagementDataProcessor.yaml).  

## Variables

Please find a detailed description of the [variables](variables.yaml).  
