const { sleep } = require("../../utils/retry");
const p1MaintainDs = require("../../specificFunctions/p1StreamPmData/p1MaintainDs/P1MaintainDs");

async function startCleanupWorker(context) {
  const { logger, parameters, dataStoreEsClient, cleanupPeriodMs } = context;

  while (true) {
    try {
      await p1MaintainDs.run({
        parameters,
        dataStoreEsClient,
        logger
      });

      logger.info("Cleanup cycle completed");
    } catch (error) {
      logger.error({ error: error.message || error }, "Cleanup worker failed");
    }

    await sleep(cleanupPeriodMs || 3600000);
  }
}

module.exports = { startCleanupWorker };
