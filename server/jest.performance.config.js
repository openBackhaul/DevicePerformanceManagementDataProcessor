module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: [
    "<rootDir>/core/performanceMetrics.test.js",
    "<rootDir>/core/dailyPerformanceMetrics.test.js",
    "<rootDir>/infra/redis/redisStreamQueue.test.js",
    "<rootDir>/infra/kafka/confluentKafkaProducer.test.js",
    "<rootDir>/runtime/processing/processingWorkerPoolRedis.test.js",
    "<rootDir>/runtime/kafka/kafkaOutboundWorker.test.js",
    "<rootDir>/specificFunctions/p1StreamPmData/p1ProcessDevice/p1TransmittingKafka/P1TransmittingKafka.test.js"
  ]
};
