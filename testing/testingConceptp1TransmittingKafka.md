# Test Concept: `p1TransmittingKafka`

## 1. Purpose
This document describes the high-level test concept for `p1TransmittingKafka` in `DevicePerformanceManagementDataProcessor`.

The function is responsible for:
- validating required input data,
- resolving Kafka routing information from `parameters` and `config-file`,
- iterating over all `output-format` entries,
- sending each payload to Kafka via `kafkaProducerService.sendMessage`.

The purpose of testing is to ensure that the function behaves correctly, predictably, and robustly under valid, invalid, and failure conditions.

---

## 2. Test Objective
The objective is to verify that `p1TransmittingKafka`:

- accepts only valid input structures,
- resolves the correct Kafka client and topic for each requested output format,
- sends exactly one message per valid `output-format` entry,
- passes the correct `topic` and `message` to the Kafka producer,
- handles configuration issues and transmission failures in a controlled way.

---

## 3. Test Scope

- Validation of required input fields:
  - `parameters`
  - `config-file`
  - `output-format`
- Resolution logic:
  - `format-name` -> parameter lookup
  - `purpose == kafkaClient`
  - parameter value -> `kafka-client-uuid`
  - `kafka-client-uuid` -> Kafka client in `config-file`
  - Kafka client -> `topic-name`
- Iteration over all output formats
- Invocation of `kafkaProducerService.sendMessage`
- Handling of producer and processing errors


---

## 4. Test Approach

### Primary Approach
Testing will focus mainly on:
- **Unit tests** for validation, mapping logic, loop behavior, and error handling
- **Component tests** for end-to-end execution of the function with a mocked Kafka producer

### Secondary Approach
A  number of **integration tests** may be added to verify actual interaction with a Kafka test environment.

### Test Double Strategy
`kafkaProducerService.sendMessage` will be mocked in most tests in order to:
- isolate business logic,
- verify call count,
- verify exact `topic` and `message` values,
- simulate producer success and failure responses.

---

## 5. Test Design Principles
Tests should be designed according to the following principles:

- **Specification-driven**: derive scenarios from sequence, interface, and variable definitions
- **Behavior-focused**: verify observable outcomes, not internal implementation details
- **Deterministic**: ensure stable and repeatable results
- **Table-driven where useful**: use structured scenario matrices for validation and mapping cases
- **Given–When–Then style**:
  - **Given** valid or invalid input and configuration
  - **When** `p1TransmittingKafka` is executed
  - **Then** the expected Kafka calls and function result occur

---

## 6. Main Test Scenario Groups

### 6.1 Happy Path Scenarios
- Single valid `output-format` entry is transmitted successfully
- Multiple valid `output-format` entries are all transmitted
- Different `format-name` values resolve to different Kafka topics

### 6.2 Validation Scenarios
- `parameters` missing or invalid
- `config-file` missing or invalid
- `output-format` missing or invalid

### 6.3 Resolution and Configuration Scenarios
- No matching `kafkaClient` parameter for a `format-name`
- Kafka client UUID cannot be resolved in `config-file`
- Kafka topic cannot be resolved from Kafka client configuration

### 6.4 Transmission Failure Scenarios
- `sendMessage` returns producer error
- `sendMessage` throws an exception
- Failure occurs during processing of one item in a multi-item batch

### 6.5 Boundary and Robustness Scenarios
- Empty `output-format` array
- Duplicate `format-name` entries
- Larger number of output-format entries

---


### Assumptions
- `parameters`, `config-file`, and `output-format` follow the structures defined in the specification
- `kafkaProducerService.sendMessage` is the only external dependency relevant for most tests
- Integration with a real Kafka broker is not required for the majority of functional verification

