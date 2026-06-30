jest.mock("../../../../infra/kafka/confluentKafkaProducer", () => ({
  sendBatch: jest.fn()
}));

const { run } = require("./P1TransmittingKafka");
const ERRORS = require("./ErrorsEnum");
const { sendBatch } = require("../../../../infra/kafka/confluentKafkaProducer");

const logger = { info: jest.fn(), error: jest.fn() };

function validRequest(overrides = {}) {
  return {
    p1TransmittingKafkaParameters: {},
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
  });

  describe("request validation", () => {
    test("throws general processing error when request is undefined", async () => {
      await expect(
        run(undefined)
      ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);
    });

    test("throws general processing error when request is null", async () => {
      await expect(
        run(null)
      ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);
    });

    test("throws kafkaConnectionList not provided when kafkaConnectionList is missing", async () => {
      await expect(
        run(validRequest({ kafkaConnectionList: undefined }))
      ).rejects.toThrow(ERRORS.KAFKA_CONNECTION_LIST_NOT_PROVIDED);
    });

    test("throws kafkaConnectionList invalid when kafkaConnectionList is not an array", async () => {
      await expect(
        run(validRequest({ kafkaConnectionList: "invalid" }))
      ).rejects.toThrow(ERRORS.KAFKA_CONNECTION_LIST_INVALID);
    });

    test("throws kafkaConnectionList not provided when kafkaConnectionList is empty", async () => {
      await expect(
        run(validRequest({ kafkaConnectionList: [] }))
      ).rejects.toThrow(ERRORS.KAFKA_CONNECTION_LIST_NOT_PROVIDED);
    });
  });

  describe("module validation", () => {
    test("wraps missing module output messages as General processing error", async () => {
      const request = validRequest();
      delete request.outputMessages;

      await expect(run(request)).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);
      await expect(run(request)).rejects.toMatchObject({
        originalMessage: "outputMessages or outputMessage is mandatory"
      });
      expect(sendBatch).not.toHaveBeenCalled();
    });

    test("wraps empty outputMessages as General processing error", async () => {
      await expect(
        run(validRequest({ outputMessages: [] }))
      ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);

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
      ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);

      expect(sendBatch).not.toHaveBeenCalled();
    });

    test("wraps missing provider connection as General processing error", async () => {
      await expect(
        run(
          validRequest({
            outputMessages: [
              {
                targetConsumer: "other",
                mountName: "device-1",
                payload: { temperature: 32 }
              }
            ]
          })
        )
      ).rejects.toThrow(ERRORS.GENERAL_PROCESSING_ERROR);

      expect(sendBatch).not.toHaveBeenCalled();
    });

    test("throws oversized Kafka message error without sending", async () => {
      global.KAFKA_MAX_SINGLE_MESSAGE_BYTES = 1;

      try {
        const promise = run(validRequest());

        await expect(promise).rejects.toThrow("Kafka message too large");
        await expect(promise).rejects.toMatchObject({
          stage: "p1TransmittingKafka",
          reason: "KAFKA_MESSAGE_SIZE_TOO_LARGE",
          retryable: false
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
  });

  describe("error path", () => {
    test("wraps producer connection failures as Producer connection error", async () => {
      sendBatch.mockRejectedValueOnce(new Error("Kafka connect failed"));

      await expect(run(validRequest())).rejects.toThrow(ERRORS.PRODUCER_CONNECTION_ERROR);
    });

    test("wraps non-connection send failures as Other transmission error", async () => {
      sendBatch.mockRejectedValueOnce(new Error("Kafka send failed"));

      await expect(run(validRequest())).rejects.toThrow(ERRORS.OTHER_TRANSMISSION_ERROR);
    });
  });
});


