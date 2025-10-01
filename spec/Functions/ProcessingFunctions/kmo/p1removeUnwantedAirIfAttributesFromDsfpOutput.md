### p1removeUnwantedAirIfAttributesFromDsfpOutput

**this assumes data is in CC format, not in APTP format**

The service shall remove unwanted attributes from air interface data in *data-structure-for-processing.output*. All attributes or subclasses that are not listed as to be removed are to be kept.  

#### Input
There is no request body input. All required data is directly read from *data-structure-for-processing.output*

#### Steps
The service shall be processed as follows: 
- IF NOT (*data-structure-for-processing/object-path* contains "air-interface") THEN terminate
- read *data-structure-for-processing.output* and remove the following attributes and subclasses:
  - *air-interface-current-performance* (complete subclass)

  - from *air-interface-capability* remove:
    - acm-threshold-cross-alarms-is-avail
    - adaptive-modulation-is-avail
    - atpc-is-avail
    - atpc-range
    - auto-freq-select-is-avail
    - clearing-threshold-cross-alarms-is-avail
    - direction-of-acm-performance-values
    - duplex-distance-is-freely-configurable
    - duplex-distance-list
    - encryption-is-avail
    - expected-equals-transmitted-radio-signal-id
    - maintenance-timer-range
    - performance-monitoring-is-avail
    - receiver-on-off-is-avail
    - rx-frequency-max
    - rx-frequency-min
    - supported-loop-back-kind-list (subclass)
    - tx-frequency-max
    - tx-frequency-min
    - from *transmission-mode-list* (in array elements) remove:
      - am-downshift-level
      - am-upshift-level
      - rx-threshold
      - supported-as-fixed-configuration
      - transmission-mode-rank
      - tx-power-max
      - tx-power-min

  - from *air-interface-configuration* remove:
    - acm-threshold-cross-alarm-list (subclass)
    - g-826-threshold-cross-alarm-list (subclass)
    - xlts-threshold-cross-alarm-list (subclass)
    - alic-is-on
    - auto-freq-select-is-on
    - auto-freq-select-range
    - cryptographic-key
    - duplex-distance
    - encryption-is-on
    - loop-back-kind-on
    - maintenance-timer
    - mimo-is-on
    - receiver-is-on
    - rx-frequency
    - tx-frequency

  - from *air-interface-status* remove:
    - alic-is-up
    - atpc-is-up
    - auto-freq-select-is-up
    - link-is-up
    - local-end-point-id
    - loop-back-kind-up
    - mimo-is-up
    - received-radio-signal-id {alphanumeric-radio-signal-id, numeric-radio-signal-id}
    - remote-end-point-id
    - rf-temp-cur
    - rx-frequency-cur
    - rx-level-cur
    - snir-cur
    - transmission-mode-cur
    - tx-frequency-cur
    - tx-level-cur
    - xpd-cur
    - xpic-is-up


  - from *air-interface-historical-performances/historical-performance-data-list*, for every array element:
    - cses
    - defect-blocks-sum
    - rf-temp-avg
    - rf-temp-max
    - rf-temp-min    
    - from *time-xstates-list*:
      - time-xstate-sequence-number

#### Callbacks
none

#### Output
There is no additional output defined. All changes are to be applied directly to *data-structure-for-processing.output*.

---  

#### Kept attributes/subclasses

Kept from *air-interface-capability*:  
- attributes/counters:
  - supported-radio-signal-id-datatype
  - supported-radio-signal-id-length
  - type-of-equipment
  - *transmission-mode-list*, with the following attributes per array element:
    - channel-bandwidth
    - code-rate
    - modulation-scheme
    - modulation-scheme-name-at-lct
    - symbol-rate-reduction-factor
    - transmission-mode-name
    - xpic-is-avail

Kept from *air-interface-configuration*:
- attributes/counters:
  - adaptive-modulation-is-on
  - air-interface-name
  - atpc-is-on
  - atpc-thresh-lower
  - atpc-thresh-upper
  - atpc-tx-power-min
  - expected-radio-signal-id {alphanumeric-radio-signal-id, numeric-radio-signal-id}
  - modulation-is-on
  - performance-monitoring-is-on
  - power-is-on
  - remote-air-interface-name
  - transmission-mode-max
  - transmission-mode-min
  - transmitted-radio-signal-id {alphanumeric-radio-signal-id, numeric-radio-signal-id}
  - transmitter-is-on
  - tx-power
  - xpic-is-on

Kept from *air-interface-status*:
- attributes/counters:
  - interface-status
  - performance-monitoring-is-up

Kept from *air-interface-historical-performances/historical-performance-data-list*:
- attributes/counters:
  - es
  - ses
  - unavailability
  - rx-level-avg
  - rx-level-max
  - rx-level-min
  - tx-level-avg
  - tx-level-max
  - tx-level-min
  - snir-avg
  - snir-max
  - snir-min
  - xpd-avg
  - xpd-max
  - xpd-min
  - time-period (interesting in case it is less than 900 seconds)
  - from *time-xstates-list*:
    - time
    - transmission-mode
- note: temperature counters removed, as the contain the ODU temperature (only IDU temperature relevant)










































