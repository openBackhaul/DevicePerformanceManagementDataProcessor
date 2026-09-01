jest.mock("../../../../infra/kafka/confluentKafkaProducer", () => ({
  sendBatch: jest.fn()
}));

const { run } = require("./P1TransmittingKafka");
const { sendBatch } = require("../../../../infra/kafka/confluentKafkaProducer");

const logger = { info: jest.fn(), error: jest.fn() };

function validRequest(overrides = {}) {
  return {
    parameters: {},
    "config-file": {},
    "output-format": ["json"],
    outputMessages: [
      {
        targetConsumer: "apt",
        mountName: "device-1",
        payload: { temperature: 32 }
      }
    ],
    kafkaConnectionList: [
      {
        type: "provider",
        parameterName: "aptProvider",
        topicName: "raw.mw-sdnc-dpmdp.apt",
        clientId: "apt-client",
        brokerList: ["localhost:9092"]
      }
    ],
    logger,
    ...overrides
  };
}

describe("P1TransmittingKafka", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete global.KAFKA_MAX_SINGLE_MESSAGE_BYTES;
  });

  describe("input validation", () => {
    test("throws parameters not provided when interface parameters are missing", async () => {
      await expect(
        run(validRequest({ parameters: undefined }))
      ).rejects.toThrow("parameters not provided");
    });

    test("throws parameters invalid when interface parameters are not an object", async () => {
      await expect(
        run(validRequest({ parameters: "invalid" }))
      ).rejects.toThrow("parameters invalid");
    });

    test("throws configFile not provided when config-file is missing", async () => {
      await expect(
        run(validRequest({ "config-file": undefined }))
      ).rejects.toThrow("configFile not provided");
    });

    test("throws configFile invalid when config-file is not an object", async () => {
      await expect(
        run(validRequest({ "config-file": [] }))
      ).rejects.toThrow("configFile invalid");
    });

    test("throws outputFormat not provided when output-format is missing", async () => {
      await expect(
        run(validRequest({ "output-format": undefined }))
      ).rejects.toThrow("outputFormat not provided");
    });

    test("throws outputFormat invalid when output-format is empty", async () => {
      await expect(
        run(validRequest({ "output-format": [] }))
      ).rejects.toThrow("outputFormat invalid");
    });
  });

  describe("module validation", () => {
    test("wraps missing module output messages as General processing error", async () => {
      const request = validRequest();
      delete request.outputMessages;

      await expect(run(request)).rejects.toThrow("General processing error");
      expect(sendBatch).not.toHaveBeenCalled();
    });

    test("wraps missing mountName for device messages as General processing error", async () => {
      await expect(
        run(
          validRequest({
            outputMessages: [
              {
                targetConsumer: "apt",
                payload: {}
              }
            ]
          })
        )
      ).rejects.toThrow("General processing error");

      expect(sendBatch).not.toHaveBeenCalled();
    });

    test("wraps missing provider connection as General processing error", async () => {
      await expect(
        run(validRequest({ kafkaConnectionList: [] }))
      ).rejects.toThrow("General processing error");

      expect(sendBatch).not.toHaveBeenCalled();
    });

    test("rejects oversized Kafka messages locally before sending to EMP", async () => {
      global.KAFKA_MAX_SINGLE_MESSAGE_BYTES = 1;

      try {
        await expect(run(validRequest())).rejects.toMatchObject({
          reason: "KAFKA_MESSAGE_SIZE_TOO_LARGE",
          retryable: false,
          maxBytes: 1
        });
        expect(sendBatch).not.toHaveBeenCalled();
      } finally {
        delete global.KAFKA_MAX_SINGLE_MESSAGE_BYTES;
      }
    });
  });

  describe("happy path", () => {
    test("sends built Kafka envelopes grouped by topic", async () => {
      sendBatch.mockResolvedValueOnce({ response: { status: 200 } });

      await expect(run(validRequest())).resolves.toEqual({
        transmissionResultList: [
          {
            topic: "raw.mw-sdnc-dpmdp.apt",
            clientId: "apt-client",
            brokers: ["localhost:9092"],
            messageCount: 1,
            status: "SENT"
          }
        ]
      });

      expect(sendBatch).toHaveBeenCalledTimes(1);
      expect(sendBatch).toHaveBeenCalledWith(
        "raw.mw-sdnc-dpmdp.apt",
        [
          expect.objectContaining({
            key: "device-1",
            value: expect.any(String)
          })
        ],
        logger,
        {
          clientId: "apt-client",
          brokers: ["localhost:9092"],
          kafkaClientUuid: undefined,
          parameterName: "aptProvider"
        }
      );

      const message = JSON.parse(sendBatch.mock.calls[0][1][0].value);
      expect(message).toEqual(
        expect.objectContaining({
          producer: "DPMDP",
          targetConsumer: "APT",
          messageType: "PERFORMANCE_OUTPUT",
          sourceSystem: "DPMDP",
          mountName: "device-1",
          payload: { temperature: 32 }
        })
      );
    });

    test("sends kafka auth through kafka options when auth is provided", async () => {
      const authRequest = validRequest({
        kafkaConnectionList: [
          {
            type: "provider",
            parameterName: "aptProvider",
            topicName: "raw.mw-sdnc-dpmdp.Apt",
            clientId: "apt-client",
            brokerList: ["localhost:9092"],
            auth: {
              "user-name": "emp-user",
              password: "emp-password"
            }
          }
        ]
      });

      sendBatch.mockResolvedValueOnce({ response: { status: 200 } });

      await expect(run(authRequest)).resolves.toEqual({
        transmissionResultList: [
          {
            topic: "raw.mw-sdnc-dpmdp.Apt",
            clientId: "apt-client",
            brokers: ["localhost:9092"],
            messageCount: 1,
            status: "SENT"
          }
        ]
      });

      expect(sendBatch).toHaveBeenCalledWith(
        "raw.mw-sdnc-dpmdp.Apt",
        expect.any(Array),
        logger,
        expect.objectContaining({
          clientId: "apt-client",
          brokers: ["localhost:9092"],
          auth: {
            "user-name": "emp-user",
            password: "emp-password"
          }
        })
      );
    });
  });

  describe("error path", () => {
    test("wraps producer connection failures as Producer connection error", async () => {
      sendBatch.mockRejectedValueOnce(new Error("Kafka connect failed"));

      await expect(run(validRequest())).rejects.toThrow("Producer connection error");
    });

    test("wraps non-connection send failures as Other transmission error", async () => {
      sendBatch.mockRejectedValueOnce(new Error("Kafka send failed"));

      await expect(run(validRequest())).rejects.toThrow("Other transmission error");
    });
  });
});


