const ERRORS = {
    MISSING_REQUIRED_INPUT:
        "parameters, mwdiEsClient, mwdiReplicaEsClient and loggingEsClient are mandatory",
    INVALID_LAST_REPLICA_TIME: "lastReplicaTime must be a valid timestamp",
    CONNECTION_MWDI_ES_FAILED: "connection to MWDI ES failed",
    CONNECTION_MWDI_REPLICA_ES_FAILED: "connection to MWDI Replica ES failed",
    CONNECTION_LOGGING_ES_FAILED: "connection to Logging ES failed",
    DATA_REPLICATION_FAILED: "data replication failed"
};

ERRORS.knownErrors = new Set(Object.values(ERRORS));

module.exports = ERRORS;

