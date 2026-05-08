# Possible output for quality statistics

The possible output for quality statistics could include:

- statistics for several days
- with following metrics per day:
  - overall datav (%)
  - statistics per deviceType
    - overall datav (%)
    - airInterface metrics:
      - overall airIf datav (%)
      - total airIf record count
      - expected airIf record count
    - ethernetContainer metrics:
      - same as for airIf

- overall percentages to be computed from (sum of relevant total record counts / sum of expected relevant record counts),
  e.g. overall deviceType datav = (sum of records for all airIf + ethContainer) / (sum of all expected airIf + ethContainer records)

- data could be gathered per device, but service output should be aggregated
- total number of records could simply be counted and aggregated per deviceType and day, but for expected counts this does not work, as they are tied to the actual number of interfaces data was delivered for
  - data may also contain a certain degree of uncertainty (e.g. if there are interface instances, where data should be there, but there is no data at all, so they may get filtered out, but the expected count should possibly be counted)
  - Note: datav only reported from SDN point of view: we report what data we could gather in relation to what from SDN side is expected to be there
    - if a device is e.g. offline from some time it does not appear in the datav statistics
    - but for APT this may be missing data - systems using datav metrics may have to take this into account

```
sample-output:
  - day: 21.04.2026                         # day already completed
    datav: 98           # percentages
    datav-per-device-type:
      - devType1: 91                        # data coverage for all interfaces
        deviceCount: 1
        airInterfacePerc: 88                # example: 3 airInterfaces
        airInterfaceTotal: 253              # received 253 records for those 3 airIfs on that day
        airInterfaceExpected: 288           # the number of expected records = 3 airIfs * 96 records
        ethernetContainerPerc: 93           # same for ethernetContainer; here 5 ethContainer example
        ethernetContainerTotal: 446
        ethernetContainerExpected: 480
      - devType2: 100
        deviceCount: 5000
        airInterface: 100
        ethernetContainer: 100
      - ...
      - unknown: 80
  - day: 22.04.2026
    datav: 10                               # only 10% for this day, because the day is not over yet and not all records for the day have been received
    datav-per-device-type:
    - ...
```
