This function shall be called to filter out PM data that is older than a given timestamp from a list of PM records.

Input:
- the list of PM records
- the filter timestamp
  - could be optional; if not provided anything will be considered newer and the input list is immediately returned
- maybe: also have a filter for data granularity (optional)

Output:
- the modified list containing only those of the the PM records which are newer than the filter timestamp


Usage here:
input = AirInterface or EthContainer PM record list
timestamp = mostRecentPeriodEndTime for the respective interface (if we don't have one, either call the function without the timestamp or not call it at all, as we know everything is newer)
