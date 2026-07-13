const { sleep } = require("../utils/retry");

function registerGracefulShutdown(appState, logger, options) {
  const shutdownGraceMs = (options || {}).shutdownGraceMs || 30000;
  let shutdownStarted = false;

  async function initiate(signal) {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    appState.isShuttingDown = true;

    logger.warn({ signal, shutdownGraceMs }, "Graceful shutdown started");

    const deadline = Date.now() + shutdownGraceMs;
    while (Date.now() < deadline) {
      await sleep(250);
    }

    logger.warn("Graceful shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => initiate("SIGTERM"));
  process.on("SIGINT", () => initiate("SIGINT"));
}

module.exports = { registerGracefulShutdown };