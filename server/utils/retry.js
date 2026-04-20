function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(task, options) {
    const {
        label = "retryable-task",
        retryIntervalMs = 10000,
        maxAttempts = 2,
        logger = console
    } = options || {};

    let attempt = 0;

    while (true) {
        attempt += 1;

        try {
            return await task();
        } catch (error) {
            logger.error?.(
                {
                    label,
                    attempt,
                    retryIntervalMs,
                    error: error.message || String(error)
                },
                `${label} failed`
            );

            if (attempt >= maxAttempts) {
                throw error;
            }

            await sleep(retryIntervalMs);
        }
    }
}

module.exports = {
    sleep,
    withRetry
};