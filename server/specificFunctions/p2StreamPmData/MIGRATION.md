# Lot 5 v1.1 implementation notes

This directory contains the DPMDP v1.1 Lot 5 implementation. The original files
below `p1StreamPmData` remain unchanged and are not selected by the v1.1
application.

The implementation follows the v1.1 interfaces as follows:

- `P2StreamPmData` loads the p2 configuration, selects `P2ProcessDevice`, and
  exposes deterministic replica-cycle quality aggregation.
- `P2ProcessDevice` loads and propagates offsets/status, calls all formatters,
  transmits outputs, stores processing state, and returns device quality.
- `P2LoadRawCc` owns interface offsets and composes device PM-data quality.
- `P2CreateResultCc` accepts/returns status data and passes EthernetContainer
  interface state to the vendor iterator where Busy Hour functions execute.
- `P2Storing` writes `processing-data` and optional idempotent `result-data`
  entries using the v1.1 schema.

Vendor-owned functions are integrated as local source modules, not NPM
dependencies. Their canonical locations and supported CommonJS export shapes
are defined by `p2ProcessDevice/vendorFunctionAdapter.js`. Tests can inject the
same functions through a `dependencies` object until vendor source is copied
into those locations.
