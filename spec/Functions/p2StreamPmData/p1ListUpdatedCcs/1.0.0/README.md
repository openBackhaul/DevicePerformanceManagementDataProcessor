# p1ListUpdatedCcs

Determines the list of ControlConstructs that have been updated in MWDI since last update of OperationalDS.  

## Parameters

| Parameter Name    | Description                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| maxAge            | Maximum acceptable age of the update of a CC for its mountName being listed |
| metaDataTablePath | Path to the meta-data table in MWDI                                         |

The maxAge parameter is basically for limiting the number of entries in the returned [updatedMountNames] during the first round, when lastExaminationTime starts with its default value.  

## Detailed Specification

Re-use of [p1ListUpdatedCcs](https://github.com/openBackhaul/FirmWareManager/tree/develop/spec/Functions/Measurement/p1ListUpdatedCcs).  

