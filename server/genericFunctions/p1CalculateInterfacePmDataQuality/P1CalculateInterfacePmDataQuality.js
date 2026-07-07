const ERRORS = require('./ErrorsEnum');

// Function p1CalculateInterfacePmDataQuality
// Calculates the number of expected 15min PM records.
// Forms an array categorizing expected and received amounts by date.
function p1CalculateInterfacePmDataQuality(input) {
  try {
    const validationError = validateMainInput(input);
    if (validationError) {
      return validationError;
    } 

    const expectedResult = calculateAmountExpected({
      'former-most-recent-period-end-time': input['former-most-recent-period-end-time'],
      'new-most-recent-period-end-time': input['new-most-recent-period-end-time']
    });

    if (expectedResult.error) {
      return ERRORS.EXP_AMOUNT_COULDNT_CALC;
    }

    const qualityResult = composeInterfacePmDataQuality({
      'uuid': input['uuid'],
      'amount-received': input['amount-received'],
      'amount-expected': expectedResult['amount-expected']
    });

    if (qualityResult.error) {
      return { error: qualityResult.error };
    }

    return {
      'interface-pm-data-quality': qualityResult['interface-pm-data-quality']
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

/**
 * Calculates expected 15-min PM records categorized by date.
 */
function calculateAmountExpected(input) {
  try {
    const former = input['former-most-recent-period-end-time'];
    const newer = input['new-most-recent-period-end-time'];

    // Check former most recent period end time
    if (!former) {
      return ERRORS.FORMER_MRPET_NOT_PROVIDED;
    }
    if (!isValidDate(former)) {
      return ERRORS.FORMER_MRPET_INVALID;
    }

    // Check newer most recent period end time
    if (!newer) {
      return ERRORS.NEW_MRPET_NOT_PROVIDED;
    }
    if (!isValidDate(newer)) {
      return ERRORS.NEW_MRPET_INVALID;
    }

    const start = new Date(former);
    const end = new Date(newer);

    if (end <= start) {
      return ERRORS.MONITORING_PERIOD_COULNT_CALC;
    }

    const amountExpected = [];
    let current = new Date(start);

    while (current < end) {
      const currentDateKey = formatDate(current);

      const endOfCurrentDay = new Date(current);
      endOfCurrentDay.setHours(24, 0, 0, 0);

      const segmentEnd = end < endOfCurrentDay ? end : endOfCurrentDay;

      const monitoringPeriodLength =
        (segmentEnd.getTime() - current.getTime()) / 1000 / 60;

      const expectedNumber = Math.round(monitoringPeriodLength / 15);

      amountExpected.push({
        'date': currentDateKey,
        'monitoring-period-length': monitoringPeriodLength,
        'number': expectedNumber
      });

      current = segmentEnd;
    }

    return {
      'amount-expected': amountExpected
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

/**
 * Composes interface PM data quality.
 */
function composeInterfacePmDataQuality(input) {
  try {
    const uuid = input['uuid'];
    const amountReceived = input['amount-received'];
    const amountExpected = input['amount-expected'];

    if (!uuid) {
      return ERRORS.UUID_NOT_PROVIDED;
    }

    if (typeof uuid !== "string") {
      return ERRORS.UUID_INVALID;
    }

    if (!amountReceived) {
      return ERRORS.AMOUNT_RECV_NOT_PROVIDED;
    }

    if (!Array.isArray(amountReceived)) {
      return ERRORS.AMOUNT_RECV_INVALID;
    }

    if (!amountExpected) {
      return ERRORS.AMOUNT_EXP_NOT_PROVIDED;
    }

    if (!Array.isArray(amountExpected)) {
      return ERRORS.AMOUNT_EXP_INVALID;
    }

    const receivedByDate = new Map();

    for (const item of amountReceived) {
      if (!item || typeof item !== "object") {
        return ERRORS.AMOUNT_RECV_INVALID;
      }

      const date = normalizeDate(item.date);
      const count = item.count ?? item.number ?? item.received;

      if (!date || typeof count !== "number") {
        return ERRORS.AMOUNT_RECV_INVALID;
      }

      receivedByDate.set(date, count);
    }

    const quality = amountExpected.map(expectedItem => {
      const date = normalizeDate(expectedItem.date);

      return {
        date,
        'received': receivedByDate.get(date) ?? 0,
        'expected': expectedItem.number
      };
    });

    return {
      'interface-pm-data-quality': {
        uuid,
        quality
      }
    };

  } catch (error) {
    return ERRORS.GENERAL_ERROR;
  }
}

function validateMainInput(input) {
  if (!input || typeof input !== "object") {
    return ERRORS.GENERAL_ERROR;
  }

  if (!input['uuid']) {
    return ERRORS.UUID_NOT_PROVIDED;
  }

  if (typeof input['uuid'] !== "string") {
    return ERRORS.UUID_INVALID;
  }

  if (!input['former-most-recent-period-end-time']) {
    return ERRORS.FORMER_MRPET_NOT_PROVIDED;
  }

  if (!isValidDate(input['former-most-recent-period-end-time'])) {
    return ERRORS.FORMER_MRPET_INVALID;
  }

  if (!input['new-most-recent-period-end-time']) {
    return ERRORS.NEW_MRPET_NOT_PROVIDED;
  }

  if (!isValidDate(input['new-most-recent-period-end-time'])) {
    return ERRORS.NEW_MRPET_INVALID;
  }

  if (!input['amount-received']) {
    return ERRORS.AMOUNT_RECV_NOT_PROVIDED;
  }
  if (!Array.isArray(input['amount-received'])) {
    return ERRORS.AMOUNT_RECV_INVALID;
  }

  return null;
}

function isValidDate(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
}

function normalizeDate(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (value.includes("/")) {
    return value;
  }

  if (isValidDate(value)) {
    return formatDate(new Date(value));
  }

  return null;
}

module.exports = p1CalculateInterfacePmDataQuality;
