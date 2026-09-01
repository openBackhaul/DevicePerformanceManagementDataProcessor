const { getParamFromFunction } = require("../../utils/functionTree");
const redisQueue = require("../../infra/redis/redisStreamQueue");
const { acquireLock, renewLock, releaseLock } = require("../../infra/redis/redisLock");
const { sleep } = require("../../utils/retry");
const { loadLastReplicaTime } = require("../../core/replicaStateStore");
const p1UpdateMwdiReplica = require("../../specificFunctions/p1StreamPmData/p1UpdateMwdiReplica/P1UpdateMwdiReplica");

function calculateReplicaWaitMs(lastReplicaTime, syncPeriodSec, nowMs = Date.now()) {
    if (!lastReplicaTime) return 0;

    const checkpointMs = Date.parse(lastReplicaTime);
    if (!Number.isFinite(checkpointMs)) return 0;

    return Math.max(0, checkpointMs + (syncPeriodSec * 1000) - nowMs);
}

function calculateReplicaLockTtlMs(configuredTtlMs, syncPeriodSec) {
    const requestedTtlMs = Number(configuredTtlMs) || 60000;
    // The observed direct-MWDI cycle can take longer than one cadence window.
    // Keep enough lease headroom even if a heartbeat is delayed by a busy event loop.
    return Math.max(requestedTtlMs, syncPeriodSec * 1000 * 2);
}

async function startReplicaLeaderLoop(context) {
    const lockKey = "dpmdp:lock:replica";
    const syncPeriodSec = Number(
        getParamFromFunction(context.updateParameters, "p1UpdateMwdiReplica", "syncPeriod", 480)
    );
    const ttlMs = calculateReplicaLockTtlMs(context.replicaLockTtlMs, syncPeriodSec);

    while (true) {
        try {
            const currentQueueLength = await redisQueue.getQueueLength(context.logger);
            if (currentQueueLength >= context.maxQueueLengthBeforeReplicaPause) {
                context.logger.warn(
                    {
                        currentQueueLength,
                        maxQueueLengthBeforeReplicaPause: context.maxQueueLengthBeforeReplicaPause
                    },
                    "Replica loop paused due to backlog"
                );
                await sleep(context.replicaPauseMsWhenBacklogged);
                continue;
            }
            const token = await acquireLock(lockKey, ttlMs, context.logger);

            if (!token) {
                await sleep(5000);
                continue;
            }

            let sleepAfterIterationMs = syncPeriodSec * 1000;

            try {
                const renewer = setInterval(async () => {
                    const renewed = await renewLock(lockKey, token, ttlMs, context.logger)
                        .catch((error) => {
                            context.logger.error?.(
                                { error: error.message || error, lockKey },
                                "Failed to renew replica leader lock"
                            );
                            return false;
                        });
                    if (!renewed) {
                        context.logger.error?.(
                            { lockKey },
                            "Replica leader lock ownership was lost during a cycle"
                        );
                    }
                }, Math.max(5000, Math.floor(ttlMs / 3)));

                try {
                    // appState is local to a DPMDP instance. Reload the shared
                    // checkpoint after acquiring the distributed lock so that a
                    // waiting instance cannot start another cycle immediately
                    // after the previous leader releases the lock.
                    const sharedLastReplicaTime = await loadLastReplicaTime(
                        context.loggingEsClient,
                        context.logger
                    );
                    context.appState.lastReplicaTime = sharedLastReplicaTime;

                    const waitMs = calculateReplicaWaitMs(
                        sharedLastReplicaTime,
                        syncPeriodSec
                    );

                    if (waitMs > 0) {
                        context.logger.debug?.(
                            {
                                lastReplicaTime: sharedLastReplicaTime,
                                waitMs,
                                syncPeriodSec
                            },
                            "Replica cycle is not due yet"
                        );
                        sleepAfterIterationMs = waitMs;
                    } else {
                        const response = await p1UpdateMwdiReplica.run({
                            parameters: context.updateParameters,
                            mwdiEsClient: context.mwdiEsClient,
                            mwdiReplicaEsClient: context.mwdiReplicaEsClient,
                            loggingEsClient: context.loggingEsClient,
                            lastReplicaTime: context.appState.lastReplicaTime,
                            runtimeConfig: context.runtimeConfig,
                            logger: context.logger
                        });

                        context.appState.lastReplicaTime = response.timestamp;
                        context.appState.lastReplicaLeaderRunAt = new Date().toJSON();
                        context.appState.metrics.replicaCycles += 1;

                        // The cadence is measured from the checkpoint captured
                        // at the start of this cycle, not from completion. A
                        // long-running cycle therefore sleeps only for the
                        // remainder of its eight-minute window.
                        sleepAfterIterationMs = calculateReplicaWaitMs(
                            response.timestamp,
                            syncPeriodSec
                        );
                    }
                } finally {
                    clearInterval(renewer);
                }
            } finally {
                await releaseLock(lockKey, token, context.logger).catch(() => {});
            }

            await sleep(sleepAfterIterationMs);
        } catch (error) {
            context.logger.error(
                { error: error.message || error, code: error.code, type: error.type },
                "Replica leader iteration failed; loop will retry"
            );
            await sleep(Number(context.replicaFailureRetryMs || 30000));
        }
    }
}
module.exports = {
  startReplicaLeaderLoop,
  calculateReplicaWaitMs,
  calculateReplicaLockTtlMs
};
