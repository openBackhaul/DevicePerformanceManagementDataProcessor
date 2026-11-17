# p1CalculateEthernetKpis

Adds Ethernet KPIs to the historicalPerformanceData set.  

## Overview

This function processes a single PM data slice and adds:  

- transmitTraffic
- receiveTraffic
- frameLossInput
- frameLossOutput

Impact of missing input counter attributes:

- If removal of ONF default values is activated, input attributes to compute these metrics may be missing.
- This function is taking it into consideration.
- In case that a metric cannot be computed, it is simply not added to the output object (performanceData).
  - In such cases the performanceData is not considered to be incomplete or invalid; i.e. the performanceData object is returned only with those KPIs that could be computed instead of returning an error message.

## Diagram

<p align="center">
  <img src="p1CalculateEthernetKpis.png" alt="p1CalculateEthernetKpis" width="400"/>
</p>

## Interface

Please find a detailed description of the [interface](interface.yaml).  

## Variables

Please find a detailed description of the [variables](variables.yaml).  

## NPM Module

[mw-sdn-p1-calculate-ethernet-kpis](https://www.npmjs.com/package/mw-sdn-p1-calculate-ethernet-kpis)  
