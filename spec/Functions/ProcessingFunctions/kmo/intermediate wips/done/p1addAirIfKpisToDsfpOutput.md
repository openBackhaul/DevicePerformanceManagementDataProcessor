### p1addAirIfKpisToDsfpOutput

The service shall add KPIs computed from air-interface data to [/data-structure-for-processing/output].  
Currently the only KPI is the air-interface capacity, which shall be added under path [/data-structure-for-processing/output/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list/performance-data/time-xstates-list].  
The KPIs are to be computed by the Capacity calculation app (CaCa). For this purpose the service hands over the required data to the CaCa.  

#### Input
There is no request body input. All required data is directly read from [/data-structure-for-processing/output].

#### Steps
The service shall be processed as follows:  
- from [/data-structure-for-processing/output] it reads the following data under *air-interface-2-0:air-interface-pac*:
  - *air-interface-capability/transmission-mode-list*
  - *air-interface-historical-performances/historical-performance-data-list*:
    - *period-end-time*
    - *performance-data/time-xstates-list*
- execution of callback RequestForComputingAirIfKpisCausesKpiComputationAtCaca to CaCa
  - response contains the air-interface capacity for each transmission-mode found under each *period-end-time*.
- add the computed air-interface capacity for each *period-end-time* under [/data-structure-for-processing/output/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list/performance-data/time-xstates-list].

#### Callbacks
- Callback RequestForComputingAirIfKpisCausesKpiComputationAtCaca to service CaCa://p1/compute-air-interface-capacities-for-intervals`
- input:
  - relevant data from *air-interface-capability/transmission-mode-list* (only those attributes, required for the KPI are included)
  - array of: *period-end-time* and *time-xstates-list* from the *historical-performance-data-list*
- output:
  - the calculated air-interface capacity for each *period-end-time* contained in the input

#### Output
There is no additional output defined. All changes are to be applied directly to [/data-structure-for-processing/output].  

---

### Callback input & output definitions: RequestForComputingAirIfKpisCausesKpiComputationAtCaca

**callback input schema**:
```yaml
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required:
            - air-interface-information
          properties:
            air-interface-information:
              type: object
              required:
                - capability-transmission-mode-list
                - performance-data-list
              properties:
                capability-transmission-mode-list:
                  type: array
                  items:
                    type: object
                    required:
                      - transmission-mode-name
                      - channel-bandwidth
                      - code-rate
                      - symbol-rate-reduction-factor
                    properties:
                      transmission-mode-name:
                        type: string
                        description: 'Key attribute, name of the transmission mode'
                      channel-bandwidth:
                        type: integer
                        description: 'Bandwidth of the transmit channel in kHz'
                      code-rate:
                        type: integer
                        description: 'Code rate of the coding scheme in %'
                      symbol-rate-reduction-factor:
                        type: integer
                        description: 'Reduction factor for the symbol rate. Example: value would be 4 for 1/4BPSK'
                  example:
                    capability-transmission-mode-list:
                      - transmission-mode-name: '0028-4QAM-188/204-1'
                        channel-bandwidth: 28000
                        code-rate: 96
                        symbol-rate-reduction-factor: 1
                performance-data-list:
                  type: array
                  items:
                    type: object
                    required:
                      - period-end-time
                      - time-xstates-list
                    properties:
                      period-end-time:
                        type: string
                      time-xstates-list:
                        type: array
                        items:
                          type: object
                          properties:
                            transmission-mode:
                              type: string
                              description: 'The transmission-mode name, as seen in capability/transmission-mode-name'
                            time:
                              type: integer
                              description: 'The time (seconds) spend in this modulation'
                  example:
                    performance-data-list:
                      - period-end-time: '2025-10-06T01:45:00+00:00'
                        time-xstates-list:
                          - transmission-mode: '0028-4QAM-188/204-1'
                            time: 200
                          - transmission-mode: '1361-112000-2048-Std'
                            time: 3
```

**callback output schema**
```yaml
  responses:
    '200':
      description: 'Capacity KPIs provided from CaCa'
      content:
        application/json:
          schema:
            type: object
            properties:
              capacity-for-performance-data-list:
                type: array
                items:
                  type: object
                  required:
                    - period-end-time
                    - time-xstates-list
                  properties:
                    period-end-time:
                      type: string
                      description: 'The period-end-time corresponding to the requestBody period-end-time'
                    time-xstates-list:
                      type: array
                      items:
                        type: object
                        properties:
                          transmission-mode:
                            type: string
                            description: 'The respective transmission-mode from the requestBody'
                          air-interface-capacity:
                            type: integer
                            description: >
                              'The capacity computed for this period-end-time and transmission-mode in Mbps.
                              Shall be added to [/data-structure-for-processing/output/air-interface-2-0:air-interface-pac/air-interface-historical-performances/historical-performance-data-list/performance-data/time-xstates-list]
                              in the array item of the respective transmission-mode for the respective period-end-time.
                              If no capacity could be calculated, the air-interface-capacity attribute shall still be added, but the value is to be left empty.'
          example:
            capacity-for-performance-data-list:
              - period-end-time: '2025-10-06T01:45:00+00:00'
                time-xstates-list:
                  - transmission-mode: '0028-4QAM-188/204-1'
                    air-interface-capacity: 300
                  - transmission-mode: '1361-112000-2048-Std'
                    air-interface-capacity: 1000
```


