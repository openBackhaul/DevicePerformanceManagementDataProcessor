module.exports = {
  projects: [
    '<rootDir>/genericFunctions/p1RemoveOutOfRangeTemperature',
    '<rootDir>/genericFunctions/p1RemoveOutOfRangeLevels',
    '<rootDir>/genericFunctions/p1RemoveDefaultValues',
    '<rootDir>/genericFunctions/p1DiscardIrrelevantPmRecords',
    '<rootDir>/genericFunctions/p1CalculateIntervalCapacity',
    '<rootDir>/genericFunctions/p1CalculateAiCapacity',
    '<rootDir>/genericFunctions/p1CalculateUtilization',
    '<rootDir>/genericFunctions/p1CalculateEthernetKpis',
    '<rootDir>/specificFunctions/p1StreamPmData/p1ProcessDevice/p1FormattingOutputApt',
    '<rootDir>/specificFunctions/p1StreamPmData/p1ProcessDevice/p1FormattingOutputOnf',
    '<rootDir>/specificFunctions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1PrepareTxModes',
    '<rootDir>/specificFunctions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateAiPmSlices'
    // '<rootDir>/specificFunctions/p1StreamPmData/p1ProcessDevice/p1CreateResultCc/p1IterateEcPmSlices'
  ],
};
