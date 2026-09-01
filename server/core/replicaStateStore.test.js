jest.mock("../infra/redis/redisClient", () => ({
  getRedisClient: jest.fn()
}));

jest.mock("../infra/onf/onfAdapter", () => ({
  getEsClient: jest.fn()
}));

const { getRedisClient } = require("../infra/redis/redisClient");
const onfAdapter = require("../infra/onf/onfAdapter");
const { loadLastReplicaTime } = require("./replicaStateStore");

const logger = {
  error: jest.fn()
};

describe("replicaStateStore", () => {
  const redis = { get: jest.fn() };
  const elasticsearch = { get: jest.fn() };
  const loggingEsClient = { uuid: "logging", "index-alias": "logging-index" };

  beforeEach(() => {
    jest.clearAllMocks();
    getRedisClient.mockResolvedValue(redis);
    onfAdapter.getEsClient.mockResolvedValue(elasticsearch);
    redis.get.mockResolvedValue(null);
  });

  test("loads the saved timestamp from an Elasticsearch 7 body response", async () => {
    elasticsearch.get.mockResolvedValue({
      body: {
        found: true,
        _source: { lastReplicaTime: "2026-07-16T10:00:00.000Z" }
      }
    });

    await expect(loadLastReplicaTime(loggingEsClient, logger)).resolves.toBe(
      "2026-07-16T10:00:00.000Z"
    );
  });

  test("uses the initial fallback when the state document does not exist", async () => {
    elasticsearch.get.mockResolvedValue({ body: { found: false } });

    await expect(loadLastReplicaTime(loggingEsClient, logger)).resolves.toBe(
      "1970-06-01T00:00:00.000Z"
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
