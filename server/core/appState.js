class AppState {
  constructor() {
    this.isShuttingDown = false;
    this.startedAt = new Date().toISOString();
    this.instanceId = null;
    this.lastReplicaTime = null;
    this.lastReplicaLeaderRunAt = null;
    this.lastCleanupRunAt = null;
    this.metrics = {
      replicaCycles: 0,
      processedSuccess: 0,
      processedFailure: 0,
      retryEnqueued: 0
    };
  }
}

// Create and export a singleton instance
const appStateInstance = new AppState();
module.exports = { AppState, appState: appStateInstance };
