const { getParamFromFunction } = require("../../utils/functionTree");
const redisQueue = require("../../infra/redis/redisStreamQueue");
const { acquireLock, renewLock, releaseLock } = require("../../infra/redis/redisLock");
const { sleep } = require("../../utils/retry");
const p1UpdateMwdiReplica = require("../../specificFunctions/p1StreamPmData/p1UpdateMwdiReplica/P1UpdateMwdiReplica");

async function startReplicaLeaderLoop(context) {
    const lockKey = "dpmdp:lock:replica";
    const ttlMs = context.replicaLockTtlMs || 60000;
    const syncPeriodSec = Number(
        getParamFromFunction(context.updateParameters, "p1UpdateMwdiReplica", "syncPeriod", 480)
    );

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

            try {
                const renewer = setInterval(async () => {
                    await renewLock(lockKey, token, ttlMs, context.logger).catch(() => {});
                }, Math.max(5000, Math.floor(ttlMs / 3)));

                try {
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
                } finally {
                    clearInterval(renewer);
                }
            } finally {
                await releaseLock(lockKey, token, context.logger).catch(() => {});
            }

            await sleep(syncPeriodSec * 1000);
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
  startReplicaLeaderLoop
};
