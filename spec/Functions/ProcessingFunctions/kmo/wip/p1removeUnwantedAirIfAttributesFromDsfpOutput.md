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
    - adaptive-modulation-is-avail
    - duplex-distance-list
    - rx-frequency-max
    - tx-frequency-max
    - rx-frequency-min
    - tx-frequency-min
    - direction-of-acm-performance-values
    - supported-loop-back-kind-list (subclass)
    - clearing-threshold-cross-alarms-is-avail
    - duplex-distance-is-freely-configurable
    - maintenance-timer-range
    - acm-threshold-cross-alarms-is-avail
    - expected-equals-transmitted-radio-signal-id
    - atpc-is-avail
    - encryption-is-avail
    - receiver-on-off-is-avail
    - atpc-range
    - performance-monitoring-is-avail
    - auto-freq-select-is-avail
    - from *transmission-mode-list* (in array elements) remove:
      - tx-power-max
      - tx-power-min
      - rx-threshold
      - am-downshift-level
      - supported-as-fixed-configuration
      - transmission-mode-rank
      - am-upshift-level

  - from *air-interface-configuration* remove:
    - acm-threshold-cross-alarm-list (subclass)
    - g-826-threshold-cross-alarm-list (subclass)
    - xlts-threshold-cross-alarm-list (subclass)
    - rx-frequency
    - tx-frequency
    - auto-freq-select-range
    - loop-back-kind-on
    - mimo-is-on
    - encryption-is-on
    - maintenance-timer
    - duplex-distance
    - auto-freq-select-is-on
    - cryptographic-key
    - alic-is-on
    - receiver-is-on

  - from *air-interface-status* remove:
    - atpc-is-up
    - remote-end-point-id
    - received-radio-signal-id {alphanumeric-radio-signal-id, numeric-radio-signal-id}
    - auto-freq-select-is-up
    - xpic-is-up
    - alic-is-up
    - link-is-up
    - mimo-is-up
    - local-end-point-id
    - loop-back-kind-up

  - from *air-interface-historical-performances/historical-performance-data-list*, for every array element:
    - tb decided

#### Callbacks
none

#### Output
There is no additional output defined. All changes are to be applied directly to *data-structure-for-processing.output*.

---  

#### Kept attributes/subclasses

Kept from *air-interface-capability*:  
- supported-radio-signal-id-datatype
- supported-radio-signal-id-length
- type-of-equipment
- *transmission-mode-list*, with the following attributes per array element:
  - transmission-mode-name
  - symbol-rate-reduction-factor
  - channel-bandwidth
  - modulation-scheme-name-at-lct
  - modulation-scheme
  - code-rate
  - xpic-is-avail

Kept from *air-interface-configuration*:
- modulation-is-on
- performance-monitoring-is-on
- atpc-is-on
- adaptive-modulation-is-on
- transmitted-radio-signal-id {alphanumeric-radio-signal-id, numeric-radio-signal-id}
- expected-radio-signal-id {alphanumeric-radio-signal-id, numeric-radio-signal-id}
- remote-air-interface-name
- air-interface-name
- transmission-mode-min
- transmission-mode-max
- tx-power
- atpc-thresh-upper
- atpc-thresh-lower
- atpc-tx-power-min
- transmitter-is-on
- xpic-is-on
- power-is-on

Kept from *air-interface-status*:
- rx-frequency-cur
- tx-frequency-cur
- rx-level-cur
- tx-level-cur
- rf-temp-cur
- performance-monitoring-is-up
- transmission-mode-cur
- snir-cur
- xpd-cur
- interface-status

Kept from *air-interface-historical-performances/historical-performance-data-list*:
- todo











































