const http = require("http");

function startMonitoringServer(appState, logger, options) {
  const port = (options || {}).port || 8040;
  const enabled = options && options.enabled !== undefined ? options.enabled : true;

  if (!enabled) {
    return null;
  }

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      const status = appState.isShuttingDown ? 503 : 200;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: appState.isShuttingDown ? "shutting-down" : "ok",
          instanceId: appState.instanceId,
          startedAt: appState.startedAt,
          lastReplicaTime: appState.lastReplicaTime
        })
      );
      return;
    }

    if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      res.end(
        [
          `dpmdp_replica_cycles_total ${appState.metrics.replicaCycles}`,
          `dpmdp_processed_success_total ${appState.metrics.processedSuccess}`,
          `dpmdp_processed_failure_total ${appState.metrics.processedFailure}`,
          `dpmdp_retry_enqueued_total ${appState.metrics.retryEnqueued}`
        ].join("")
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  server.listen(port, () => {
    logger.info({ port }, "Monitoring server started");
  });

  return server;
}

module.exports = { startMonitoringServer };