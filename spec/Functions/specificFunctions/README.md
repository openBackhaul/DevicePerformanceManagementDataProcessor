# Specific Functions

The following Functions are specifically provided as a part of this application's implementation:

- [p1StreamPmData](./p1StreamPmData/1.0.0)
  - [p1LoadParameters](./p1StreamPmData/p1LoadParameters/1.0.0)
  - [p1ResolveEsAddress](./p1StreamPmData/p1ResolveEsAddress/1.0.0)
  - [p1InitKafka](./p1StreamPmData/p1InitKafka/1.0.0)
  - [p1UpdateMwdiReplica](./p1StreamPmData/p1UpdateMwdiReplica/1.0.0)
  - [p1ProcessDevice](./p1StreamPmData/p1ProcessDevice/1.0.0)
    - [p1LoadRawCc](./p1StreamPmData/p1ProcessDevice/p1LoadRawCc/1.0.0)
      - [p1FieldsFilter](./p1StreamPmData/p1ProcessDevice/p1LoadRawCc/p1FieldsFilter/1.0.0)
      - [p1DiscardIrrelevantPmRecords](./p1StreamPmData/p1ProcessDevice/p1LoadRawCc/p1DiscardIrrelevantPmRecords/1.0.0)
    - [p1CreateResultCc](./p1StreamPmData/p1ProcessDevice/p1CreateResultCc/1.0.0)
      - [p1PrepareTxModes](./p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1PrepareTxModes/1.0.0)
        - [p1CalculateAiCapacity](./p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1PrepareTxModes/p1CalculateAiCapacity/1.0.0)
        - [p1CalculateIntervalCapacity](./p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1PrepareTxModes/p1CalculateIntervalCapacity/1.0.0)
      - [p1CalculateEthernetKpis](./p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1CalculateEthernetKpis/1.0.0)
    - [p1FormattingOutputApt](./p1StreamPmData/p1ProcessDevice/p1FormattingOutputApt/1.0.0)
    - [p1TransmittingKafka](./p1StreamPmData/p1ProcessDevice/p1TransmittingKafka/1.0.0)
