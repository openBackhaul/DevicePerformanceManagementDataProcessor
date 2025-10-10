### p1addEthContainerKpisToDsfpOutput

The service shall add KPIs computed from ethernet-container data to [/data-structure-for-processing/output].  
The KPIs are to be computed by the Capacity calculation app (CaCa). For this purpose the service hands over the required data to the CaCa.  

#### Input
There is no request body input. All required data is directly read from [/data-structure-for-processing/output].

#### Steps
The service shall be processed as follows:  
- from [/data-structure-for-processing/output] it reads the following data under *ethernet-container-2-0:ethernet-container-pac/ethernet-container-historical-performances/historical-performance-data-list*:
  - *period-end-time*
  - from *performance-data*:
    - *total-bytes-input*
    - *total-bytes-output*
- execution of callback RequestForComputingEthernetContainerKpisCausesKpiComputationAtCaca to CaCa
  - response contains the following ethernet-container KPIs for each *period-end-time*:
    - traffic-rx (in Mbps)
    - traffic-tx (in Mbps)
- add the computed ethernet-container KPIs for each *period-end-time* under [/data-structure-for-processing/output] <PATH TODO>

#### Callbacks
- Callback RequestForComputingEthernetContainerKpisCausesKpiComputationAtCaca to service CaCa://p1/compute-ethernet-container-kpis-for-intervals`
- input:
  - relevant data from *ethernet-container-historical-performances/historical-performance-data-list* (only those attributes, required for the KPI are included)
  - array of: *period-end-time* and relevant attributes from the *historical-performance-data-list/performance-data*
- output:
  - the calculated ethernet-container KPIs for each *period-end-time* contained in the input

#### Output
There is no additional output defined. All changes are to be applied directly to [/data-structure-for-processing/output].  

---

### Callback input & output definitions: RequestForComputingEthernetContainerKpisCausesKpiComputationAtCaca

**callback input schema**:
```yaml
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required:
            - ethernet-container-information
          properties:
            ethernet-container-information:
              type: object
              properties:
                performance-data-list:
                  type: array
                  items:
                    type: object
                    required:
                      - period-end-time
                      - total-bytes-input
                      - total-bytes-output
                    properties:
                      period-end-time:
                        type: string
                      total-bytes-input
                        type: integer
                      total-bytes-output:
                        type: integer
                  example:
                    performance-data-list:
                      - period-end-time: '2025-10-06T01:45:00+00:00'
                        total-bytes-input: 100000
                        total-bytes-output: 120000
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
```


