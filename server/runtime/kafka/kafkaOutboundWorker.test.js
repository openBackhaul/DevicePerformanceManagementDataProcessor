jest.mock("../../infra/redis/redisStreamQueue", () => ({
  ackKafkaOutbound: jest.fn().mockResolvedValue(undefined),
  deleteKafkaOutboundMessage: jest.fn().mockResolvedValue(undefined),
  updateKafkaDailyMetrics: jest.fn().mockResolvedValue(undefined),
  recordKafkaOutboundSuccess: jest.fn().mockResolvedValue(undefined),
  moveKafkaOutboundToDeadLetter: jest.fn().mockResolvedValue(undefined)
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

    expect(redisQueue.ackKafkaOutbound).toHaveBeenCalledWith("1-0", expect.anything());
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
      messages[1], sizeError, expect.anything()
    );
    expect(redisQueue.updateKafkaDailyMetrics).toHaveBeenCalledWith(
      "oversized", "APT", 1, undefined
    );
  });
});
