jest.mock("../../infra/redis/redisStreamQueue", () => ({
  ackKafkaOutbound: jest.fn().mockResolvedValue(1),
  deleteKafkaOutboundMessage: jest.fn().mockResolvedValue(undefined),
  updateKafkaDailyMetrics: jest.fn().mockResolvedValue(undefined),
  recordKafkaOutboundSuccess: jest.fn().mockResolvedValue(undefined),
  moveKafkaOutboundToDeadLetter: jest.fn().mockResolvedValue(1),
  resetKafkaDailyMetricsIfNeeded: jest.fn().mockResolvedValue(undefined),
  renewKafkaOutboundOwnership: jest.fn(async (ids) => ids)
}));

jest.mock("../../infra/elasticSearch/kafkaPayloadStore", () => ({
  loadKafkaPayload: jest.fn().mockResolvedValue({ value: "large-payload" }),
  deleteKafkaPayload: jest.fn().mockResolvedValue(undefined),
  markKafkaPayloadAsOversizedEvidence: jest.fn().mockResolvedValue(undefined),
  storeKafkaPayload: jest.fn().mockResolvedValue("oversized-evidence-1")
}));

jest.mock("../../specificFunctions/p1StreamPmData/p1ProcessDevice/p1TransmittingKafka/P1TransmittingKafka", () => ({
  run: jest.fn()
}));

jest.mock("../../service/LoggingService.js", () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })
}));

const redisQueue = require("../../infra/redis/redisStreamQueue");
const kafkaPayloadStore = require("../../infra/elasticSearch/kafkaPayloadStore");
const p1TransmittingKafka = require("../../specificFunctions/p1StreamPmData/p1ProcessDevice/p1TransmittingKafka/P1TransmittingKafka");
const { _internal } = require("./kafkaOutboundWorker");

describe("kafkaOutboundWorker Elasticsearch payload references", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    kafkaPayloadStore.loadKafkaPayload.mockResolvedValue({ value: "large-payload" });
  });

  test("loads, delivers and deletes an ES-backed payload", async () => {
    const messages = [{
      id: "1-0",
      message: {
        payloadStorage: "ES",
        payloadRefId: "payload-1",
        mountName: "device-1"
      }
    }];

    await _internal.processKafkaOutboundMessages(messages, {
      appState: { isShuttingDown: false },
      dataStoreEsClient: { "index-alias": "datastore" },
      p1TransmittingKafkaParameters: {},
      kafkaConnectionList: []
    });

    expect(redisQueue.ackKafkaOutbound).toHaveBeenCalledWith(
      "1-0", undefined, expect.anything()
    );
    expect(redisQueue.deleteKafkaOutboundMessage).toHaveBeenCalledWith("1-0", expect.anything());
    expect(kafkaPayloadStore.loadKafkaPayload).toHaveBeenCalledWith(
      expect.objectContaining({ payloadRefId: "payload-1" })
    );
    expect(p1TransmittingKafka.run).toHaveBeenCalledWith(
      expect.objectContaining({
        outputMessages: [expect.objectContaining({
          mountName: "device-1",
          payload: { value: "large-payload" }
        })]
      })
    );
    expect(redisQueue.recordKafkaOutboundSuccess).toHaveBeenCalledWith(
      messages,
      expect.anything()
    );
    expect(kafkaPayloadStore.deleteKafkaPayload).toHaveBeenCalledWith(
      expect.objectContaining({ payloadRefId: "payload-1" })
    );
    expect(redisQueue.updateKafkaDailyMetrics).toHaveBeenCalledWith(
      "successful", "UNKNOWN", 1, undefined
    );
  });

  test("retains the ES payload when Redis ownership was lost before ACK", async () => {
    redisQueue.ackKafkaOutbound.mockResolvedValueOnce(0);
    const messages = [{
      id: "lost-1",
      message: {
        payloadStorage: "ES",
        payloadRefId: "payload-lost",
        mountName: "device-lost"
      }
    }];

    await _internal.processKafkaOutboundMessages(messages, {
      appState: { isShuttingDown: false },
      dataStoreEsClient: { "index-alias": "datastore" },
      p1TransmittingKafkaParameters: {},
      kafkaConnectionList: []
    });

    expect(redisQueue.deleteKafkaOutboundMessage).not.toHaveBeenCalled();
    expect(kafkaPayloadStore.deleteKafkaPayload).not.toHaveBeenCalled();
    expect(redisQueue.recordKafkaOutboundSuccess).toHaveBeenCalledWith([], expect.anything());
  });

  test("isolates and dead-letters only a missing ES payload reference", async () => {
    const missing = Object.assign(new Error("payload not found"), {
      reason: "KAFKA_PAYLOAD_REFERENCE_NOT_FOUND",
      retryable: false
    });
    const messages = [
      { id: "valid-1", message: { targetConsumer: "APT", mountName: "valid", payload: "{}" } },
      { id: "missing-1", message: { targetConsumer: "APT", mountName: "missing", payloadStorage: "ES", payloadRefId: "gone" } }
    ];
    kafkaPayloadStore.loadKafkaPayload.mockImplementation(async ({ payloadRefId }) => {
      if (payloadRefId === "gone") {
        throw missing;
      }
      return { value: "large-payload" };
    });

    await _internal.processKafkaOutboundMessages(messages, {
      appState: { isShuttingDown: false },
      dataStoreEsClient: { "index-alias": "datastore" },
      p1TransmittingKafkaParameters: {},
      kafkaConnectionList: []
    });

    expect(redisQueue.moveKafkaOutboundToDeadLetter).toHaveBeenCalledTimes(1);
    expect(redisQueue.moveKafkaOutboundToDeadLetter).toHaveBeenCalledWith(
      messages[1], missing, "failed", undefined, expect.anything()
    );
    expect(p1TransmittingKafka.run).toHaveBeenCalledTimes(1);
  });

  test("isolates a size failure and dead-letters only the individually rejected message", async () => {
    const sizeError = Object.assign(new Error("Broker: Message size too large"), {
      reason: "KAFKA_MESSAGE_SIZE_TOO_LARGE",
      retryable: false
    });
    const messages = [
      { id: "2-0", message: { targetConsumer: "APT", mountName: "small-1", payload: "{}", payloadBytes: "2" } },
      { id: "2-1", message: { targetConsumer: "APT", mountName: "oversized", payload: "{}", payloadBytes: "2" } },
      { id: "2-2", message: { targetConsumer: "APT", mountName: "small-2", payload: "{}", payloadBytes: "2" } }
    ];

    p1TransmittingKafka.run.mockImplementation(async ({ outputMessages }) => {
      if (outputMessages.length > 1 || outputMessages[0].mountName === "oversized") {
        throw sizeError;
      }
      return { transmissionResultList: [{ status: "SENT" }] };
    });

    await _internal.processKafkaOutboundMessages(messages, {
      appState: { isShuttingDown: false },
      dataStoreEsClient: { "index-alias": "datastore" },
      p1TransmittingKafkaParameters: {},
      kafkaConnectionList: []
    });

    expect(redisQueue.recordKafkaOutboundSuccess).toHaveBeenCalledTimes(2);
    expect(redisQueue.recordKafkaOutboundSuccess).toHaveBeenCalledWith(
      [messages[0]], expect.anything()
    );
    expect(redisQueue.recordKafkaOutboundSuccess).toHaveBeenCalledWith(
      [messages[2]], expect.anything()
    );
    expect(redisQueue.moveKafkaOutboundToDeadLetter).toHaveBeenCalledTimes(1);
    expect(redisQueue.moveKafkaOutboundToDeadLetter).toHaveBeenCalledWith(
      messages[1], sizeError, "oversized", undefined, expect.anything()
    );
    expect(redisQueue.updateKafkaDailyMetrics).not.toHaveBeenCalledWith(
      "oversized", expect.anything(), expect.anything(), expect.anything()
    );
  });

  test("does not count or clean up a failure when dead-letter ownership was lost", async () => {
    const missing = Object.assign(new Error("payload not found"), {
      reason: "KAFKA_PAYLOAD_REFERENCE_NOT_FOUND",
      retryable: false
    });
    const message = {
      id: "lost-failure",
      message: { targetConsumer: "APT", payloadStorage: "ES", payloadRefId: "gone" }
    };
    kafkaPayloadStore.loadKafkaPayload.mockRejectedValue(missing);
    redisQueue.moveKafkaOutboundToDeadLetter.mockResolvedValueOnce(0);

    await _internal.processKafkaOutboundMessages([message], {
      appState: { isShuttingDown: false },
      dataStoreEsClient: { "index-alias": "datastore" },
      p1TransmittingKafkaParameters: {},
      kafkaConnectionList: []
    });

    expect(redisQueue.updateKafkaDailyMetrics).not.toHaveBeenCalledWith(
      "failed", expect.anything(), expect.anything(), expect.anything()
    );
  });
});
