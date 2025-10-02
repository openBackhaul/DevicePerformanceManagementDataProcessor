### p1removeUnwantedEthContainerAttributesFromDsfpOutput

**this assumes data is in CC format, not in APTP format**

The service shall remove unwanted attributes from air interface data in [/data-structure-for-processing/output]. All attributes or subclasses that are not listed as to be removed are to be kept.  

#### Input
There is no request body input. All required data is directly read from [/data-structure-for-processing/output]

#### Steps
The service shall be processed as follows: 
- IF NOT ([/data-structure-for-processing/object-path] contains "ethernet-container") THEN terminate
- read [/data-structure-for-processing/output] and remove the following attributes and subclasses:
  - *ethernet-container-current-performance* (complete subclass)

  - from *ethernet-container-capability* remove:
    - available-queue-list (subclass/array)
    - supported-header-compression-kind-list (subclass/array)
    - admin-shut-down-is-avail
    - bundling-is-avail
    - dropping-behavior-configuration-is-avail
    - egress-shaping-is-avail
    - encryption-is-avail
    - explicit-congestion-notification-is-avail
    - fec-is-avail
    - fec-word-size-max
    - ingress-policing-is-avail
    - maintenance-timer-range
    - performance-monitoring-is-avail
    - scheduler-kind-configuration-is-avail
    - scheduler-profile-configuration-is-avail
    - statistics-is-avail
    - supported-fec-interleaver-depth-list
    - supported-fec-interleaver-kind-list
    - supported-fec-redundancy-size-list
    - supported-loop-back-kind-list
    - supported-maximum-burst-size-list
    - supported-maximum-information-rate-list
    - supported-wred-protocol-list
    - support-of-management-frames-without-preamble-is-avail
    - wred-profile-configuration-is-avail

  - from *ethernet-container-configuration* remove:
    - cryptographic-key
    - egress-shaping-is-on
    - encryption-is-on
    - explicit-congestion-notification-is-on
    - fec-interleaver-depth
    - fec-interleaver-kind
    - fec-is-on
    - fec-redundancy-size
    - fec-word-size
    - header-compression-kind
    - ingress-policing-profile
    - loop-back-kind-on
    - maintenance-timer
    - maximum-burst-size
    - maximum-information-rate
    - qos-profile
    - queue-behavior-list
    - scheduler-profile
    - statistics-is-on

  - from *ethernet-container-status* remove:
    - bundling-is-up
    - interface-status
    - performance-monitoring-is-up

  - from *ethernet-container-historical-performances/historical-performance-data-list*, for every array element:
    - queue-utilization-list (subclass/array)

#### Callbacks
none

#### Output
There is no additional output defined. All changes are to be applied directly to [/data-structure-for-processing/output].

---  

#### Kept attributes/subclasses

Kept from *ethernet-container-capability*:  
- attributes/counters:
    - bundling-group-size-max

Kept from *ethernet-container-configuration*:
- attributes/counters:
    - bundling-is-on
    - interface-is-on
    - interface-name
    - performance-monitoring-is-on

Kept from *ethernet-container-status*:
- attributes/counters:
    - broadcast-frames-input
    - broadcast-frames-output
    - dropped-frames-input
    - dropped-frames-output
    - errored-frames-input
    - errored-frames-output
    - forwarded-frames-input
    - forwarded-frames-output
    - fragmented-frames-input
    - frames-of-1024-to-1518-byte
    - frames-of-128-to-255-byte
    - frames-of-256-to-511-byte
    - frames-of-512-to-1023-byte
    - frames-of-64-byte
    - frames-of-65-to-127-byte
    - last-10-sec-data-input-rate
    - last-10-sec-data-output-rate
    - loop-back-kind-up
    - multicast-frames-input
    - multicast-frames-output
    - remote-site-is-faulty
    - statistics-is-up
    - timestamp
    - total-bytes-input
    - total-bytes-output
    - total-frames-input
    - total-frames-output
    - unicast-frames-input
    - unicast-frames-output

Kept from *ethernet-container-historical-performances/historical-performance-data-list*:
- attributes/counters:
    - broadcast-frames-input
    - broadcast-frames-output
    - dropped-frames-input
    - dropped-frames-output
    - errored-frames-input
    - errored-frames-output
    - forwarded-frames-input
    - forwarded-frames-output
    - fragmented-frames-input
    - jabber-frames-ingress
    - max-bytes-per-second-output
    - multicast-frames-input
    - multicast-frames-output
    - oversized-frames-ingress
    - total-bytes-input
    - total-bytes-output
    - total-frames-input
    - total-frames-output
    - undersized-frames-ingress
    - unicast-frames-input
    - unicast-frames-output
    - unknown-protocol-frames-input
    - time-period
- notes: time-period stores the actual measurement duration, which is not necessarily 900 seconds 










































