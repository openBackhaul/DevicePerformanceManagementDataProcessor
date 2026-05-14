const Errors = require('./ErrorsEnum');

const GRANULARITY_15 =
  'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-15-MIN';
const GRANULARITY_24 =
  'ethernet-container-2-0:GRANULARITY_PERIOD_TYPE_PERIOD-24-HOURS';

module.exports = ({ kpiService, removeDefaultService, utilizationService }) => {
  return {
    execute(input) {
      validateInput(input);

      let mostRecent15 = null;
      let mostRecent24 = null;

      const processedList = [];

      // ✅ Ensure 15-min slices processed first
      const sortedSlices = [...input['historical-performance-data-list']].sort(
        (a, b) => {
          if (a['granularity-period'] === GRANULARITY_15) return -1;
          if (b['granularity-period'] === GRANULARITY_15) return 1;
          return 0;
        }
      );

      for (const slice of sortedSlices) {
        let perfData = slice['performance-data'];

        // 1. KPI Calculation
        try {
          perfData = kpiService.calculate(perfData);
        } catch (e) {
          throw new Error(Errors.KPI_CALCULATION_FAILED);
        }

        // 2. Remove Default Values
        try {
          perfData = removeDefaultService.clean(
            input.parameters,
            perfData
          );
        } catch (e) {
          throw new Error(Errors.DEFAULT_VALUES_REMOVAL_FAILED);
        }

        // 3. Utilization Calculation
        try {
          perfData = utilizationService.calculate(
            perfData,
            input['aggregation-group'],
            input['result-cc']
          );
        } catch (e) {
          throw new Error(Errors.UTILIZATION_CALCULATION_FAILED);
        }

        // Update slice
        slice['performance-data'] = perfData;

        // 4. Update most recent timestamps
        const granularity = slice['granularity-period'];
        const endTime = slice['period-end-time'];

        if (granularity === GRANULARITY_15) {
          mostRecent15 = maxTime(mostRecent15, endTime);
        } else if (granularity === GRANULARITY_24) {
          mostRecent24 = maxTime(mostRecent24, endTime);
        }

        processedList.push(slice);
      }

      if (!processedList.length) {
        throw new Error(Errors.HISTORICAL_DATA_LIST_OUTPUT_FAILED);
      }

      return {
        'historical-performance-data-list': processedList,
        'most-recent-period-end-time': mostRecent15,
        'most-recent-period-end-time-24': mostRecent24
      };
    }
  };
};

// ----------------- Helpers -----------------

function validateInput(input) {
  if (!input) {
    throw new Error(Errors.PARAMETERS_NOT_PROVIDED);
  }

  if (!input.parameters) {
    throw new Error(Errors.PARAMETERS_INVALID);
  }

  if (!input['historical-performance-data-list']) {
    throw new Error(Errors.HISTORICAL_DATA_LIST_NOT_PROVIDED);
  }

  if (!Array.isArray(input['historical-performance-data-list'])) {
    throw new Error(Errors.HISTORICAL_DATA_LIST_INVALID);
  }
}

function maxTime(t1, t2) {
  if (!t1) return t2;
  return t1 >= t2 ? t1 : t2;
}