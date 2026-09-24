# p1ReduceData

The function removes irrelevant data from an input data structure in place.

The function should be used in the following scenarios:

- for larger input data structures where only a comparatively small subset of the data needs to be removed
- but only when modifications to the original input object are acceptable

A fields filter string is used to specify which data from the input data structure is considered relevant.

## Overview

The fields-filtering string must comply with the NETCONF definitions.  
The filtering itself follows the same definitions.  

## Diagram

<p align="center">
  <img src="./p1ReduceData.png" alt="p1ReduceData" width="400" />
</p>

## Interface

Please find a detailed description of the [interface](./interface.yaml).

## Variables

Please find a detailed description of the [variables](./variables.yaml).

## NPM Module  

[mw-sdn-p1-reduce-data](https://www.npmjs.com/package/mw-sdn-p1-reduce-data)  