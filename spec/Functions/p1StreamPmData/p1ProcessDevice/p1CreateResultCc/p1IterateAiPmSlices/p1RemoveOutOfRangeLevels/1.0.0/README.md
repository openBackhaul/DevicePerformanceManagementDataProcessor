# p1RemoveOutOfRangeLevels

Deletes RX level and TX level performance (min, max, avg) attributes with values outside pre-defined range from ResultCc.  
Borders of the valid range are configurable parameters.  


### Diagram

<p align="center">
  <img src="p1RemoveOutOfRangeLevels.png" alt="p1RemoveOutOfRangeLevels" width="400"/>
</p>


### Interface

Please find a detailed description of the [interface](interface.yaml).


### Variables

Please find a detailed description of the [variables](variables.yaml).


### Parameters

| Parameter Name               | Description                                                                        |
|------------------------------|------------------------------------------------------------------------------------|
| lowerTxLevelLimit            | Lower bound of valid values of the transmit level                                  |
| upperTxLevelLimit            | Upper bound of valid values of the transmit level                                  |
| lowerRxLevelLimit            | Lower bound of valid values of the receive level                                   |
| upperRxLevelLimit            | Upper bound of valid values of the receive level                                   |


### NPM Module  

[mw-sdn-p1-remove-out-of-range-levels](https://www.npmjs.com/package/mw-sdn-p1-remove-out-of-range-levels)  

