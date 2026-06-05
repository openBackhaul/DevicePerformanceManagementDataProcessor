# p1IterateEcPmSlices

Iterates through all EthernetContainer historical performance data slices and calls the processing Functions.  

**Iteration order**  
The key attributes for iterating through the PM slices are periodEndTime and granularity.  
It must be ensured that the function first iterates through all 15min PM slices, before a potentially contained 24h PM slice is processed.  

## Diagram

<p align="center">
  <img src="p1IterateEcPmSlices.png" alt="p1IterateEcPmSlices" width="400"/>
</p>

## Interface

Please find a detailed description of the [interface](interface.yaml).  

## Variables

Please find a detailed description of the [variables](variables.yaml).  

## Parameters

Just passing through parameters to sub-functions.  

## NPM Module  

[mw-sdn-p1-iterate-ec-pm-slices](https://www.npmjs.com/package/mw-sdn-p1-iterate-ec-pm-slices)  
