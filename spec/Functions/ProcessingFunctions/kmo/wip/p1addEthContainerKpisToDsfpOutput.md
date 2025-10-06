### p1addEthContainerKpisToDsfpOutput

The service shall add KPIs computed from ethernet-container data to [/data-structure-for-processing/output].  
The KPIs are to be computed by the Capacity calculation app (CaCa). For this purpose the service hands over the required data to the CaCa.  

#### Input
There is no request body input. All required data is directly read from [/data-structure-for-processing/output].

#### Steps
The service shall be processed as follows:  
- from [/data-structure-for-processing/output] it reads the following data under *ethernet-container-2-0:ethernet-container-pac*:
  - *ethernet-container-capability/transmission-mode-list*
  - *ethernet-container-historical-performances/historical-performance-data-list*:
    - *period-end-time*
    - *time-xstates-list*
- execution of callback RequestForComputingAirIfKpisCausesKpiComputationAtCaca to CaCa
  - response contains the ethernet-container capacity for each transmission-mode found under each *period-end-time*.
- add the computed ethernet-container capacity for each *period-end-time* under [/data-structure-for-processing/output] <PATH TODO>

#### Callbacks
- Callback RequestForComputingEthernetContainerKpisCausesKpiComputationAtCaca to service CaCa://p1/compute-ethernet-container-kpis-for-intervals`
- input:
  - relevant data from *ethernet-container-capability/transmission-mode-list* (only those attributes, required for the KPI are included)
  - array of: *period-end-time* and *time-xstates-list* from the *historical-performance-data-list*
- output:
  - the calculated ethernet-container capacity for each *period-end-time* contained in the input

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


