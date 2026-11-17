# p1RemoveOutOfRangeTemperature

Deletes temperature attributes with values outside pre-defined range from \[equipment\].  
Borders of the valid range are configurable parameters.  

If would not represent an error, if the temperature attribute would not exist.  
Consequently, in this case no error message should be returned.  

## Diagram

<p align="center">
  <img src="./p1RemoveOutOfRangeTemperature.png" alt="p1RemoveOutOfRangeTemperature" width="400"/>
</p>

## Interface

Please find a detailed description of the [interface](./interface.yaml).  

## Variables

Please find a detailed description of the [variables](./variables.yaml).  

## Parameters

| Parameter Name        | Description                              |
|-----------------------|------------------------------------------|
| lowerTemperatureLimit | Lower bound of valid temperature values  |
| upperTemperatureLimit | Upper bound of valid temperature values  |

## NPM Module

[mw-sdn-p1-remove-out-of-range-temperature](https://www.npmjs.com/package/mw-sdn-p1-remove-out-of-range-temperature)  
