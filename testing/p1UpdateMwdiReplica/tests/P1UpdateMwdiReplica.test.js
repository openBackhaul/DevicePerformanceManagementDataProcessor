jest.mock("../../../server/infra/onf/onfAdapter", () => ({
  getEsClient: jest.fn()
}));

jest.mock("../../../server/infra/redis/redisStreamQueue", () => ({
  ensureGroup: jest.fn(),
  clearRetryAndDeadLetterForReplicaUpdates: jest.fn(),
  enqueueMountNames: jest.fn()
}));

jest.mock("../../../server/infra/redis/redisClient", () => ({
  getRedisClient: jest.fn()
}));

jest.mock("../../../server/core/replicaStateStore", () => ({
  saveLastReplicaTime: jest.fn()
}));

jest.mock("../../../server/utils/retry", () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
  withRetry: jest.fn(async (fn) => fn())
}));

const { run } = require("../../../server/specificFunctions/p1StreamPmData/p1UpdateMwdiReplica/P1UpdateMwdiReplica.js");
const onfAdapter = require("../../../server/infra/onf/onfAdapter");
const redisQueue = require("../../../server/infra/redis/redisStreamQueue");
const { getRedisClient } = require("../../../server/infra/redis/redisClient");
const { saveLastReplicaTime } = require("../../../server/core/replicaStateStore");
const { withRetry, sleep } = require("../../../server/utils/retry");

describe("P1UpdateMwdiReplica", () => {
  let sourceClient;
  let replicaClient;
  let loggingClient;
  let redisClient;
  let logger;

  const sourceIndex = "mwdi-source-index";
  const replicaIndex = "mwdi-replica-index";
  const loggingIndex = "mwdi-logging-index";
  const activeTaskKey = "dpmdp:replica:active-reindex-task";

  beforeEach(() => {
    jest.clearAllMocks();

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    sourceClient = {
      reindex: jest.fn().mockResolvedValue({
        body: { task: "node-1:12345" }
      }),
      tasks: {
        list: jest.fn().mockResolvedValue({ body: { nodes: {} } }),
        get: jest.fn().mockResolvedValue({
          body: {
            completed: true,
            response: {
              total: 2,
              created: 2,
              updated: 0,
              deleted: 0
            }
          }
        })
      }
    };

    replicaClient = {
      search: jest.fn().mockResolvedValue({
        body: {
          _scroll_id: "scroll-1",
          hits: {
            hits: [
              { _id: "doc-1" },
              { _id: "doc-2", _source: { mountName: "mount-B" } }
            ]
          }
        }
      }),
      scroll: jest.fn().mockResolvedValue({
        body: {
          _scroll_id: "scroll-1",
          hits: {
            hits: []
          }
        }
      }),
      clearScroll: jest.fn().mockResolvedValue({})
    };

    loggingClient = {
      index: jest.fn().mockResolvedValue({ body: { result: "created" } })
    };

    redisClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      del: jest.fn().mockResolvedValue(1)
    };

    onfAdapter.getEsClient.mockImplementation(async (_tls, uuid) => {
      if (uuid === "source-es") return sourceClient;
      if (uuid === "replica-es") return replicaClient;
      if (uuid === "logging-es") return loggingClient;
      throw new Error(`Unexpected ES client uuid: ${uuid}`);
    });

    getRedisClient.mockResolvedValue(redisClient);

    redisQueue.ensureGroup.mockResolvedValue();
    redisQueue.clearRetryAndDeadLetterForReplicaUpdates.mockResolvedValue();
    redisQueue.enqueueMountNames.mockResolvedValue({
      queued: 2,
      failed: 0,
      retried: 0
    });

    saveLastReplicaTime.mockResolvedValue();
  });

  function buildRequest(overrides = {}) {
    return {
      logger,
      parameters: {
        p1UpdateMwdiReplica: {
          jobName: "mwdi-replica-update-job",
          lastUpdatedField: "last-complete-control-construct-update-time",
          overlapMs: 1000,
          reqPerSec: 2,
          scrollSize: 200,
          scrollTtl: 2,
          reindexPollIntervalMs: 1
        }
      },
      mwdiEsClient: {
        uuid: "source-es",
        "index-alias": sourceIndex
      },
      mwdiReplicaEsClient: {
        uuid: "replica-es",
        "index-alias": replicaIndex
      },
      loggingEsClient: {
        uuid: "logging-es",
        "index-alias": loggingIndex
      },
      lastReplicaTime: "2026-07-30T09:59:00.000Z",
      runtimeConfig: {
        redis: {
          enqueueBatchSize: 500,
          enqueuePauseMs: 50
        }
      },
      ...overrides
    };
  }

  it("replicates MWDI data and emits mount names consumable by downstream applications", async () => {
    const result = await run(buildRequest());

    expect(sourceClient.tasks.list).toHaveBeenCalledTimes(1);

    expect(sourceClient.reindex).toHaveBeenCalledTimes(1);
    expect(sourceClient.reindex).toHaveBeenCalledWith(
      expect.objectContaining({
        refresh: true,
        wait_for_completion: false,
        requests_per_second: 2,
        scroll: "2m",
        body: expect.objectContaining({
          source: expect.objectContaining({
            index: sourceIndex,
            size: 200,
            query: expect.objectContaining({
              bool: expect.objectContaining({
                must: expect.arrayContaining([
                  { exists: { field: "core-model-1-4:control-construct" } },
                  expect.objectContaining({
                    range: expect.objectContaining({
                      "last-complete-control-construct-update-time": expect.any(Object)
                    })
                  })
                ])
              })
            })
          }),
          dest: expect.objectContaining({
            index: replicaIndex,
            op_type: "index"
          }),
          conflicts: "proceed"
        })
      })
    );

    expect(sourceClient.tasks.get).toHaveBeenCalledWith({
      task_id: "node-1:12345"
    });

    expect(replicaClient.search).toHaveBeenCalledWith(
      expect.objectContaining({
        index: replicaIndex,
        scroll: "2m",
        size: 200,
        body: expect.objectContaining({
          _source: false,
          query: expect.objectContaining({
            bool: expect.objectContaining({
              must: expect.arrayContaining([
                { exists: { field: "core-model-1-4:control-construct" } },
                expect.objectContaining({
                  range: expect.objectContaining({
                    "last-complete-control-construct-update-time": expect.any(Object)
                  })
                })
              ])
            })
          })
        })
      })
    );

    expect(replicaClient.scroll).toHaveBeenCalledWith({
      scroll_id: "scroll-1",
      scroll: "2m"
    });

    expect(replicaClient.clearScroll).toHaveBeenCalledWith({
      scroll_id: "scroll-1"
    });

    expect(redisQueue.ensureGroup).toHaveBeenCalledWith(logger);
    expect(redisQueue.clearRetryAndDeadLetterForReplicaUpdates).toHaveBeenCalledWith(
      ["doc-1", "mount-B"],
      logger
    );
    expect(redisQueue.enqueueMountNames).toHaveBeenCalledWith(
      ["doc-1", "mount-B"],
      expect.objectContaining({
        batchSize: 500,
        pauseMs: 50,
        clearRetryAndDeadLetterBeforeEnqueue: false
      }),
      logger
    );

    expect(loggingClient.index).toHaveBeenCalled();
    expect(saveLastReplicaTime).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: "logging-es",
        "index-alias": loggingIndex
      }),
      expect.any(String),
      logger
    );
    expect(redisClient.del).toHaveBeenCalledWith(activeTaskKey);

    expect(result).toEqual({
      updatedMountNames: ["doc-1", "mount-B"],
      timestamp: expect.any(String)
    });
  });

  it("returns success when no changed devices are found", async () => {
    replicaClient.search.mockResolvedValueOnce({
      body: {
        _scroll_id: "scroll-1",
        hits: {
          hits: []
        }
      }
    });

    const result = await run(buildRequest());

    expect(redisQueue.clearRetryAndDeadLetterForReplicaUpdates).toHaveBeenCalledWith(
      [],
      logger
    );
    expect(redisQueue.enqueueMountNames).toHaveBeenCalledWith(
      [],
      expect.any(Object),
      logger
    );
    expect(result.updatedMountNames).toEqual([]);
  });

  it("deduplicates multiple updated documents for the same mount name", async () => {
    replicaClient.search.mockResolvedValueOnce({
      body: {
        _scroll_id: "scroll-1",
        hits: {
          hits: [
            { _id: "1", _source: { mountName: "mount-A" } },
            { _id: "2", _source: { mountName: "mount-A" } },
            { _id: "3", _source: { mountName: "mount-B" } }
          ]
        }
      }
    });

    const result = await run(buildRequest());

    expect(redisQueue.enqueueMountNames).toHaveBeenCalledWith(
      ["mount-A", "mount-B"],
      expect.any(Object),
      logger
    );
    expect(result.updatedMountNames).toEqual(["mount-A", "mount-B"]);
  });

  it("supports mount identity fallback through mount-name, uuid, and _id", async () => {
    replicaClient.search.mockResolvedValueOnce({
      body: {
        _scroll_id: "scroll-1",
        hits: {
          hits: [
            { _id: "1", _source: { "mount-name": "mount-dash" } },
            { _id: "2", _source: { uuid: "uuid-only-mount" } },
            { _id: "id-fallback" }
          ]
        }
      }
    });

    const result = await run(buildRequest());

    expect(redisQueue.enqueueMountNames).toHaveBeenCalledWith(
      ["mount-dash", "uuid-only-mount", "id-fallback"],
      expect.any(Object),
      logger
    );
    expect(result.updatedMountNames).toEqual([
      "mount-dash",
      "uuid-only-mount",
      "id-fallback"
    ]);
  });

  it("uses a saved active reindex task instead of starting a new reindex", async () => {
    redisClient.get.mockResolvedValueOnce(
      JSON.stringify({
        taskId: "node-9:999",
        sourceIndex,
        destinationIndex: replicaIndex,
        periodStartTime: "2026-07-30T09:58:59.000Z",
        periodEndTime: "2026-07-30T10:00:00.000Z",
        createdAt: "2026-07-30T10:00:00.000Z"
      })
    );

    sourceClient.tasks.get.mockResolvedValueOnce({
      body: {
        completed: true,
        response: {
          total: 1,
          created: 1,
          updated: 0,
          deleted: 0
        }
      }
    });

    const result = await run(buildRequest());

    expect(sourceClient.reindex).not.toHaveBeenCalled();
    expect(sourceClient.tasks.get).toHaveBeenCalledWith({
      task_id: "node-9:999"
    });
    expect(result.updatedMountNames).toBeDefined();
    expect(redisClient.del).toHaveBeenCalledWith(activeTaskKey);
  });

  it("fails when lastReplicaTime is invalid", async () => {
    await expect(
      run(
        buildRequest({
          lastReplicaTime: "not-a-date"
        })
      )
    ).rejects.toThrow("lastReplicaTime must be a valid timestamp");
  });

  it("fails when source ES client creation fails", async () => {
    onfAdapter.getEsClient.mockRejectedValueOnce(new Error("source client boom"));

    await expect(run(buildRequest())).rejects.toThrow("connection to MWDI ES failed");
  });

  it("fails when replica ES client creation fails", async () => {
    onfAdapter.getEsClient
      .mockResolvedValueOnce(sourceClient)
      .mockRejectedValueOnce(new Error("replica client boom"));

    await expect(run(buildRequest())).rejects.toThrow("connection to MWDI Replica ES failed");
  });

  it("fails when logging ES client creation fails", async () => {
    onfAdapter.getEsClient
      .mockResolvedValueOnce(sourceClient)
      .mockResolvedValueOnce(replicaClient)
      .mockRejectedValueOnce(new Error("logging client boom"));

    await expect(run(buildRequest())).rejects.toThrow("connection to Logging ES failed");
  });

  it("fails when Elasticsearch reindex does not return a task id", async () => {
    sourceClient.reindex.mockResolvedValueOnce({
      body: {}
    });

    await expect(run(buildRequest())).rejects.toThrow("data replication failed");

    expect(loggingClient.index).toHaveBeenCalledWith(
      expect.objectContaining({
        index: loggingIndex,
        body: expect.objectContaining({
          status: "FAILED"
        }),
        refresh: false
      })
    );
  });

  it("fails when the reindex task completes with a terminal error", async () => {
    sourceClient.tasks.get.mockResolvedValueOnce({
      body: {
        completed: true,
        error: {
          reason: "terminal reindex failure"
        }
      }
    });

    await expect(run(buildRequest())).rejects.toThrow("data replication failed");
    expect(redisClient.del).toHaveBeenCalledWith(activeTaskKey);
  });

  it("fails when replica search fails", async () => {
    replicaClient.search.mockRejectedValueOnce(new Error("search failed"));

    await expect(run(buildRequest())).rejects.toThrow("search failed");
  });

  it("fails when Redis preparation fails", async () => {
    redisQueue.ensureGroup.mockRejectedValueOnce(new Error("group failed"));

    await expect(run(buildRequest())).rejects.toThrow("group failed");
  });

 it("fails when enqueueing changed mount names reports failures", async () => {
  redisQueue.enqueueMountNames.mockReset();
  redisQueue.enqueueMountNames.mockImplementation(async () => ({
    queued: 1,
    failed: 1,
    retried: 0
  }));

  await expect(run(buildRequest())).rejects.toThrow(
    "Failed to enqueue 1 changed devices"
  );

  expect(redisQueue.enqueueMountNames).toHaveBeenCalledTimes(1);
  expect(saveLastReplicaTime).not.toHaveBeenCalled();
});

  it("continues successfully when success logging fails", async () => {
    loggingClient.index.mockRejectedValueOnce(new Error("logging failed"));

    const result = await run(buildRequest());

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "p1UpdateMwdiReplica.logging",
        error: "logging failed"
      }),
      "Failed to index logging document"
    );
    expect(saveLastReplicaTime).toHaveBeenCalled();
    expect(result.updatedMountNames).toEqual(["doc-1", "mount-B"]);
  });

  it("recovers when an existing reindex task disappears during polling", async () => {
    redisClient.get.mockResolvedValueOnce(
      JSON.stringify({
        taskId: "node-9:999",
        sourceIndex,
        destinationIndex: replicaIndex,
        periodStartTime: "2026-07-30T09:58:59.000Z",
        periodEndTime: "2026-07-30T10:00:00.000Z",
        createdAt: "2026-07-30T10:00:00.000Z",
        discovered: true
      })
    );

    sourceClient.tasks.get.mockRejectedValueOnce(
      Object.assign(new Error("resource_not_found_exception"), {
        meta: { statusCode: 404 }
      })
    );

    const result = await run(buildRequest());

    expect(logger.warn).toHaveBeenCalled();
    expect(result.updatedMountNames).toEqual(["doc-1", "mount-B"]);
  });

  it("polls repeatedly until the reindex task completes", async () => {
    sourceClient.tasks.get
      .mockResolvedValueOnce({
        body: {
          completed: false,
          task: {
            status: {
              total: 2,
              created: 1,
              updated: 0,
              deleted: 0,
              batches: 1
            }
          }
        }
      })
      .mockResolvedValueOnce({
        body: {
          completed: true,
          response: {
            total: 2,
            created: 2,
            updated: 0,
            deleted: 0
          }
        }
      });

    await run(buildRequest());

    expect(sourceClient.tasks.get).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10000);
  });

  it("discovers an already running reindex task and resumes the oldest match", async () => {
    redisClient.get.mockResolvedValueOnce(null);

    sourceClient.tasks.list.mockResolvedValueOnce({
      body: {
        nodes: {
          nodeA: {
            tasks: {
              "node-2:222": {
                description: `reindex from [${sourceIndex}] to [${replicaIndex}]`,
                start_time_in_millis: 2000
              },
              "node-1:111": {
                description: `reindex from [${sourceIndex}] to [${replicaIndex}]`,
                start_time_in_millis: 1000
              }
            }
          }
        }
      }
    });

    await run(buildRequest());

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "p1UpdateMwdiReplica.reindex.duplicates",
        taskIds: ["node-1:111", "node-2:222"]
      }),
      "Multiple matching reindex tasks are already running; resuming the oldest"
    );

    expect(sourceClient.reindex).not.toHaveBeenCalled();
    expect(sourceClient.tasks.get).toHaveBeenCalledWith({
      task_id: "node-1:111"
    });
    expect(redisClient.set).toHaveBeenCalled();
  });
});