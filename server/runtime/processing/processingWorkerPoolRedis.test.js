jest.mock("../../infra/redis/redisStreamQueue", () => ({
  enqueueRetry: jest.fn(),
  clearRetryState: jest.fn(),
  ackMessage: jest.fn(),
  removeFromDedupSet: jest.fn(),
  deleteMessage: jest.fn()
}));

jest.mock("../../specificFunctions/p1StreamPmData/p1ProcessDevice/P1ProcessDevice", () => ({
  run: jest.fn()
}));

jest.mock("../../infra/redis/redisLock", () => ({
  acquireLock: jest.fn(),
  renewLock: jest.fn(),
  releaseLock: jest.fn()
}));

jest.mock("../../service/LoggingService.js", () => ({
  getLogger: () => ({
    warn: jest.fn(),
    error: jest.fn()
  })
}));

const redisQueue = require("../../infra/redis/redisStreamQueue");
const p1ProcessDevice = require("../../specificFunctions/p1StreamPmData/p1ProcessDevice/P1ProcessDevice");
const { acquireLock, renewLock, releaseLock } = require("../../infra/redis/redisLock");
const { _internal } = require("./processingWorkerPoolRedis");

describe("processingWorkerPoolRedis retry handling", () => {
  const context = {
    processDeviceParameters: {},
    configFile: {},
    mwdiReplicaEsClient: {},
    dataStoreEsClient: {},
    kafkaConsumerTypes: "ONF",
    maxRetryCount: 3,
    logger: {
      warn: jest.fn(),
      error: jest.fn()
    }
  };

  const message = {
    id: "1-0",
    message: {
      mountName: "device-1"
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    acquireLock.mockResolvedValue("lock-token");
    renewLock.mockResolvedValue(true);
    releaseLock.mockResolvedValue();
    redisQueue.enqueueRetry.mockResolvedValue({ status: "ENQUEUED" });
    redisQueue.clearRetryState.mockResolvedValue();
    redisQueue.ackMessage.mockResolvedValue();
    redisQueue.removeFromDedupSet.mockResolvedValue();
    redisQueue.deleteMessage.mockResolvedValue();
  });

  test("does not enqueue retry when processing error is non-retryable", async () => {
    const error = {
      message: "No AirInterface or EthernetContainer processing succeeded",
      stage: "p1CreateResultCc",
      retryable: false
    };

    p1ProcessDevice.run.mockRejectedValue(error);

    await _internal.handleMessage(message, context);

    expect(redisQueue.enqueueRetry).not.toHaveBeenCalled();
    expect(redisQueue.ackMessage).toHaveBeenCalledWith("1-0", context.logger);
    expect(redisQueue.removeFromDedupSet).toHaveBeenCalledWith("device-1", context.logger);
    expect(redisQueue.deleteMessage).toHaveBeenCalledWith("1-0", context.logger);
    expect(releaseLock).toHaveBeenCalledWith(
      "dpmdp:lock:process:device-1",
      "lock-token",
      context.logger
    );
  });

  test("enqueues retry when processing error is retryable", async () => {
    const error = new Error("temporary processing failure");
    error.stage = "p1ProcessDevice";
    error.retryable = true;

    p1ProcessDevice.run.mockRejectedValue(error);

    await _internal.handleMessage(message, context);

    expect(redisQueue.enqueueRetry).toHaveBeenCalledWith(
      "device-1",
      "p1ProcessDevice",
      "temporary processing failure",
      3,
      context.logger
    );
    expect(redisQueue.ackMessage).toHaveBeenCalledWith("1-0", context.logger);
    expect(redisQueue.removeFromDedupSet).toHaveBeenCalledWith("device-1", context.logger);
    expect(redisQueue.deleteMessage).toHaveBeenCalledWith("1-0", context.logger);
  });
});
