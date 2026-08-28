jest.mock("../../../infra/onf/onfAdapter", () => ({
  getEsClient: jest.fn()
}));

jest.mock("../../../infra/redis/redisStreamQueue", () => ({
  ensureGroup: jest.fn(),
  clearRetryAndDeadLetterForReplicaUpdates: jest.fn(),
  enqueueMountNames: jest.fn()
}));

jest.mock("../../../infra/redis/redisClient", () => ({
  getRedisClient: jest.fn()
}));

jest.mock("../../../core/replicaStateStore", () => ({
  saveLastReplicaTime: jest.fn()
}));

const onfAdapter = require("../../../infra/onf/onfAdapter");
const redisQueue = require("../../../infra/redis/redisStreamQueue");
const { getRedisClient } = require("../../../infra/redis/redisClient");
const { saveLastReplicaTime } = require("../../../core/replicaStateStore");
const moduleUnderTest = require("./P1UpdateMwdiReplica");
const ERRORS = require("./ErrorsEnum");

const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const validRequest = (overrides = {}) => ({
  parameters: {},
  mwdiEsClient: { "index-alias": "mwdi-index", uuid: "source-uuid" },
  mwdiReplicaEsClient: { "index-alias": "replica-index", uuid: "replica-uuid" },
  loggingEsClient: { "index-alias": "logging-index", uuid: "logging-uuid" },
  runtimeConfig: { redis: { enqueueBatchSize: 10, enqueuePauseMs: 1 } },
  logger,
  ...overrides
});

const mockSourceClient = {
  reindex: jest.fn(),
  tasks: {
    get: jest.fn(),
    list: jest.fn()
  }
};

const mockReplicaClient = {
  search: jest.fn(),
  scroll: jest.fn(),
  clearScroll: jest.fn()
};

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
};

const mockLoggingClient = {
  index: jest.fn()
};

describe("P1UpdateMwdiReplica", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onfAdapter.getEsClient.mockReset();
    getRedisClient.mockResolvedValue(mockRedisClient);
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.set.mockResolvedValue("OK");
    mockRedisClient.del.mockResolvedValue(1);
    saveLastReplicaTime.mockResolvedValue();
    mockSourceClient.tasks.list.mockResolvedValue({ body: { nodes: {} } });

    onfAdapter.getEsClient.mockImplementation(async (forceCreate, uuid) => {
      if (uuid === "source-uuid") return mockSourceClient;
      if (uuid === "replica-uuid") return mockReplicaClient;
      if (uuid === "logging-uuid") return mockLoggingClient;
      throw new Error("unknown client");
    });

    redisQueue.ensureGroup.mockResolvedValue();
    redisQueue.clearRetryAndDeadLetterForReplicaUpdates.mockResolvedValue({
      mountNameCount: 0,
      retryStreamDeleted: 0,
      deadLetterStreamDeleted: 0
    });
    redisQueue.enqueueMountNames.mockResolvedValue({ enqueued: 1, skipped: 0, failed: 0 });
  });

  // ─── Module Validation ────────────────────────────────────────────────────

  describe("Module Validation", () => {
    test("exports a run function", () => {
      expect(moduleUnderTest.run).toBeDefined();
      expect(typeof moduleUnderTest.run).toBe("function");
    });
  });

  // ─── Input Validation ─────────────────────────────────────────────────────

  describe("Input Validation", () => {
    test("throws when request is null", async () => {
      await expect(moduleUnderTest.run(null)).rejects.toThrow(
        ERRORS.MISSING_REQUIRED_INPUT
      );
    });

    test("throws when request is missing required properties", async () => {
      await expect(
        moduleUnderTest.run({ parameters: {}, mwdiEsClient: {} })
      ).rejects.toThrow(ERRORS.MISSING_REQUIRED_INPUT);
    });

    test("throws when lastReplicaTime is invalid", async () => {
      await expect(
        moduleUnderTest.run(validRequest({ lastReplicaTime: "invalid-timestamp" }))
      ).rejects.toThrow(ERRORS.INVALID_LAST_REPLICA_TIME);
    });
  });

  // ─── Happy Path ───────────────────────────────────────────────────────────

  describe("Happy Path", () => {
    beforeEach(() => {
      mockSourceClient.reindex.mockResolvedValue({ body: { task: "node-1:123" } });
      mockSourceClient.tasks.get.mockResolvedValue({
        body: {
          completed: true,
          response: { created: 1, updated: 1, total: 1 }
        }
      });
      mockReplicaClient.search.mockResolvedValue({ body: { hits: { hits: [{ _id: "id-1", _source: { mountName: "device-1" } }] } } });
      mockReplicaClient.clearScroll.mockResolvedValue({});
      mockLoggingClient.index.mockResolvedValue({});
    });

    test("returns updated mount names and timestamp", async () => {
      const result = await moduleUnderTest.run(validRequest());

      expect(result).toEqual({
        updatedMountNames: ["device-1"],
        timestamp: expect.any(String)
      });
    });

    test("uses only the configured eight-minute lookback on first start", async () => {
      const beforeRun = Date.now();

      await moduleUnderTest.run(validRequest({
        lastReplicaTime: null,
        runtimeConfig: {
          redis: { enqueueBatchSize: 10, enqueuePauseMs: 1 },
          service: { replicaInitialLookbackMs: 480000 }
        }
      }));

      const afterRun = Date.now();
      const reindexRequest = mockSourceClient.reindex.mock.calls[0][0];
      const range = reindexRequest.body.source.query.bool.must[1].range[
        "last-complete-control-construct-update-time"
      ];
      const periodStartMs = Date.parse(range.gt);

      expect(periodStartMs).toBeGreaterThanOrEqual(beforeRun - 480000);
      expect(periodStartMs).toBeLessThanOrEqual(afterRun - 480000);
    });

    test("calls Elasticsearch and Redis clients with expected parameters", async () => {
      await moduleUnderTest.run(validRequest());

      expect(onfAdapter.getEsClient).toHaveBeenCalledTimes(3);
      expect(mockSourceClient.reindex).toHaveBeenCalledTimes(1);
      expect(mockSourceClient.reindex).toHaveBeenCalledWith(
        expect.objectContaining({ wait_for_completion: false })
      );
      expect(mockSourceClient.tasks.get).toHaveBeenCalledWith({
        task_id: "node-1:123"
      });
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        "dpmdp:replica:active-reindex-task",
        expect.stringContaining('"taskId":"node-1:123"')
      );
      expect(mockReplicaClient.search).toHaveBeenCalledTimes(1);
      expect(redisQueue.ensureGroup).toHaveBeenCalledTimes(1);
      expect(redisQueue.clearRetryAndDeadLetterForReplicaUpdates).toHaveBeenCalledWith(
        ["device-1"],
        logger
      );
      expect(redisQueue.enqueueMountNames).toHaveBeenCalledWith(
        ["device-1"],
        expect.objectContaining({
          batchSize: 10,
          pauseMs: 1,
          clearRetryAndDeadLetterBeforeEnqueue: false
        }),
        logger
      );
      expect(mockLoggingClient.index).toHaveBeenCalledTimes(1);
      expect(saveLastReplicaTime).toHaveBeenCalledWith(
        validRequest().loggingEsClient,
        expect.any(String),
        logger
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        "dpmdp:replica:active-reindex-task"
      );
    });

    test("returns empty mount list when replica search returns no hits", async () => {
      mockReplicaClient.search.mockResolvedValue({ body: { hits: { hits: [] } } });

      const result = await moduleUnderTest.run(validRequest());

      expect(result.updatedMountNames).toEqual([]);
      expect(result.timestamp).toEqual(expect.any(String));
    });

    test("collects mount names from every replica search page", async () => {
      mockReplicaClient.search.mockResolvedValue({
        body: {
          _scroll_id: "scroll-1",
          hits: { hits: [{ _id: "id-1", _source: { mountName: "device-1" } }] }
        }
      });
      mockReplicaClient.scroll
        .mockResolvedValueOnce({
          body: {
            _scroll_id: "scroll-2",
            hits: { hits: [{ _id: "id-2", _source: { mountName: "device-2" } }] }
          }
        })
        .mockResolvedValueOnce({
          body: { _scroll_id: "scroll-2", hits: { hits: [] } }
        });

      const result = await moduleUnderTest.run(validRequest());

      expect(result.updatedMountNames).toEqual(["device-1", "device-2"]);
      expect(mockReplicaClient.scroll).toHaveBeenCalledTimes(2);
      expect(mockReplicaClient.clearScroll).toHaveBeenCalledWith({
        scroll_id: "scroll-2"
      });
    });

    test("resumes the active Redis task instead of starting a duplicate", async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        taskId: "node-1:existing",
        sourceIndex: "mwdi-index",
        destinationIndex: "replica-index",
        periodStartTime: "2026-01-01T00:00:00.000Z",
        periodEndTime: "2026-01-02T00:00:00.000Z"
      }));

      await moduleUnderTest.run(validRequest());

      expect(mockSourceClient.reindex).not.toHaveBeenCalled();
      expect(mockSourceClient.tasks.get).toHaveBeenCalledWith({
        task_id: "node-1:existing"
      });
    });

    test("finishes recovery when a saved Redis task completed before restart", async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        taskId: "node-1:completed-before-restart",
        sourceIndex: "mwdi-index",
        destinationIndex: "replica-index",
        periodStartTime: "2026-01-01T00:00:00.000Z",
        periodEndTime: "2026-01-02T00:00:00.000Z"
      }));
      mockSourceClient.tasks.get.mockRejectedValue({
        meta: { statusCode: 404 },
        message: "resource_not_found_exception"
      });

      const result = await moduleUnderTest.run(validRequest());

      expect(mockSourceClient.reindex).not.toHaveBeenCalled();
      expect(result.updatedMountNames).toEqual(["device-1"]);
      expect(saveLastReplicaTime).toHaveBeenCalledWith(
        validRequest().loggingEsClient,
        "2026-01-02T00:00:00.000Z",
        logger
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        "dpmdp:replica:active-reindex-task"
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "p1UpdateMwdiReplica.reindexTask.recoveredCompletion",
          taskId: "node-1:completed-before-restart",
          discovered: false
        }),
        expect.any(String)
      );
    });

    test("discovers and resumes an existing Elasticsearch task", async () => {
      mockSourceClient.tasks.list.mockResolvedValue({
        body: {
          nodes: {
            "node-1": {
              tasks: {
                "node-1:existing": {
                  description: "reindex from [mwdi-index] to [replica-index][_doc]",
                  start_time_in_millis: Date.parse("2026-01-02T00:00:00.000Z")
                }
              }
            }
          }
        }
      });

      await moduleUnderTest.run(validRequest());

      expect(mockSourceClient.reindex).not.toHaveBeenCalled();
      expect(mockSourceClient.tasks.get).toHaveBeenCalledWith({
        task_id: "node-1:existing"
      });
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        "dpmdp:replica:active-reindex-task",
        expect.stringContaining('"discovered":true')
      );
    });

    test("continues recovery when a discovered legacy task completed before polling", async () => {
      mockSourceClient.tasks.list.mockResolvedValue({
        body: {
          nodes: {
            "node-1": {
              tasks: {
                "node-1:legacy": {
                  description: "reindex from [mwdi-index] to [replica-index][_doc]",
                  start_time_in_millis: Date.parse("2026-01-02T00:00:00.000Z")
                }
              }
            }
          }
        }
      });
      mockSourceClient.tasks.get.mockRejectedValue({
        meta: { statusCode: 404 },
        message: "resource_not_found_exception"
      });

      const result = await moduleUnderTest.run(validRequest());

      expect(result.updatedMountNames).toEqual(["device-1"]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "p1UpdateMwdiReplica.reindexTask.recoveredCompletion",
          taskId: "node-1:legacy"
        }),
        expect.any(String)
      );
    });
  });

  // ─── Error Path ───────────────────────────────────────────────────────────

  describe("Error Path", () => {
    test("throws MWDI ES connection error when source client fails", async () => {
      onfAdapter.getEsClient.mockRejectedValueOnce(new Error("ES failure"));

      await expect(moduleUnderTest.run(validRequest())).rejects.toThrow(
        ERRORS.CONNECTION_MWDI_ES_FAILED
      );
    });

    test("throws replica ES connection error when replica client fails", async () => {
      onfAdapter.getEsClient
        .mockResolvedValueOnce(mockSourceClient)
        .mockRejectedValueOnce(new Error("Replica ES failure"));

      await expect(moduleUnderTest.run(validRequest())).rejects.toThrow(
        ERRORS.CONNECTION_MWDI_REPLICA_ES_FAILED
      );
    });

    test("throws logging ES connection error when logging client fails", async () => {
      onfAdapter.getEsClient
        .mockResolvedValueOnce(mockSourceClient)
        .mockResolvedValueOnce(mockReplicaClient)
        .mockRejectedValueOnce(new Error("Logging ES failure"));

      await expect(moduleUnderTest.run(validRequest())).rejects.toThrow(
        ERRORS.CONNECTION_LOGGING_ES_FAILED
      );
    });

    test("throws data replication failed when reindex errors", async () => {
      mockSourceClient.reindex.mockRejectedValueOnce(new Error("reindex failed"));

      await expect(moduleUnderTest.run(validRequest())).rejects.toThrow(
        ERRORS.DATA_REPLICATION_FAILED
      );
      expect(mockLoggingClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: "logging-index",
          body: expect.objectContaining({
            status: "FAILED",
            error: "reindex failed"
          })
        })
      );
    });

    test("throws data replication failed when the reindex task fails", async () => {
      mockSourceClient.reindex.mockResolvedValue({ body: { task: "node-1:failed" } });
      mockSourceClient.tasks.get.mockResolvedValue({
        body: {
          completed: true,
          error: { reason: "task failed" }
        }
      });

      await expect(moduleUnderTest.run(validRequest())).rejects.toThrow(
        ERRORS.DATA_REPLICATION_FAILED
      );
      expect(mockLoggingClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            status: "FAILED",
            error: "task failed"
          })
        })
      );
    });

    test("does not advance when replica search fails", async () => {
      mockSourceClient.reindex.mockResolvedValue({ body: { task: "node-1:123" } });
      mockSourceClient.tasks.get.mockResolvedValue({
        body: {
          completed: true,
          response: { created: 1, updated: 1, total: 1 }
        }
      });
      mockReplicaClient.search.mockRejectedValueOnce(new Error("search failed"));
      mockLoggingClient.index.mockResolvedValue({});

      await expect(moduleUnderTest.run(validRequest())).rejects.toThrow("search failed");

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "p1UpdateMwdiReplica.search"
        }),
        "Failed to search replica after reindex"
      );
      expect(redisQueue.enqueueMountNames).not.toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });
});
