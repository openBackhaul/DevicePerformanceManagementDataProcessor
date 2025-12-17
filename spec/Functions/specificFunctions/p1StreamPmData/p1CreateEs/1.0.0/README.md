# p1CreateEs

Creates an ElasticSearch instance/index, if it does not already exist.


### Overview

The `p1CreateEs` function is a small utility function that is used by other
functions (e.g. `p1UpdateMwdiReplica`) to ensure that all required
ElasticSearch indices are available before they are accessed.

The function receives:
- a hierarchical `parameters` object, and
- an `es-client` object describing the concrete ElasticSearch endpoint
  (URL, index alias, API key, etc.).

From these inputs it derives:
- the ElasticSearch URL (`es-url`)
- the target index name / alias (`es-index`)
- the API key (`es-api-key`, if used)

The function then performs the following steps:

1. **Check if index exists**
    - Calls ElasticSearch using a HEAD/GET request on `/{es-index}`
    - If the index already exists and is accessible, the function returns
      successfully without making any changes.
    - Sample code:
   ```
    const exists = await es.indices.exists({ index: indexName });
   ```

2. **Create index if missing**
    - If the index does not exist, sends a `PUT /{es-index}` request to the
      configured ElasticSearch URL.
    - Uses the settings and mappings defined in the configuration (if provided)
      to create the index (for example, number of shards/replicas, field types,
      etc.).
    - If index creation succeeds, the function returns successfully.
    - Sample code:
   ```
   await es.indices.create({
      index: indexName,
      body: indexDefinition || {}
    });
   ```

3. **Error handling**
    - If ElasticSearch is not reachable, the credentials are invalid, or the
      index cannot be created for any other reason, the function returns an
      error description.
    - The caller is expected to log the error.

This function is intentionally generic. It can be used both for indices that
store business data (e.g. PM data, device replicas) and for technical indices
(e.g. logs, replication state), as long as the correct `es-client` configuration
is provided.


### Diagram

<p align="center">
  <img src="p1CreateEs.png" alt="p1CreateEs" width="200" />
</p>


### Interface

Please find a detailed description of the [interface](interface.yaml).


### Variables

Please find a detailed description of the [variables](variables.yaml).
