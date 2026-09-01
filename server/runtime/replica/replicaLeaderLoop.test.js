const {
  calculateReplicaWaitMs,
  calculateReplicaLockTtlMs
} = require("./replicaLeaderLoop");

describe("calculateReplicaWaitMs", () => {
  test("waits until eight minutes after the shared checkpoint", () => {
    const checkpoint = "2026-08-31T14:00:00.000Z";
    const now = Date.parse("2026-08-31T14:05:00.000Z");

    expect(calculateReplicaWaitMs(checkpoint, 480, now)).toBe(180000);
  });

  test("allows a cycle when the eight-minute window is due", () => {
    const checkpoint = "2026-08-31T14:00:00.000Z";
    const now = Date.parse("2026-08-31T14:08:00.000Z");

    expect(calculateReplicaWaitMs(checkpoint, 480, now)).toBe(0);
  });

  test("allows the initial cycle when no valid checkpoint exists", () => {
    expect(calculateReplicaWaitMs(null, 480, Date.now())).toBe(0);
    expect(calculateReplicaWaitMs("not-a-date", 480, Date.now())).toBe(0);
  });
});

describe("calculateReplicaLockTtlMs", () => {
  test("keeps at least two eight-minute windows of lease headroom", () => {
    expect(calculateReplicaLockTtlMs(60000, 480)).toBe(960000);
  });

  test("honors a larger configured lease", () => {
    expect(calculateReplicaLockTtlMs(1800000, 480)).toBe(1800000);
  });
});
