# Telemetry Schemas
At a high level, we plan to have one schema for each measurement module.
There are some pieces of data that require coordinating across data from
multiple modules, so we'll integrate those into the schema for one of the
modules or make separate schemas for them.

We're considering at least two options for the pageNavigation schema, and we'll
carry the design choice to the other schemas as well.
1. `pageNavigation-list`: here, the data for each domain is stored as many instances of
the same object. This is easy to read, but results in lots of duplication.
1. `pageNavigation-nested`: here, the data is deeply nested to avoid duplication, but this
makes it harder to read and modify.

## Testing
It's easy to test with a command line JSON validator like [AJV](https://github.com/jessedc/ajv-cli).
```
npm install -g ajv-cli
ajv validate -s pageNavigation-list.json -d test-pageNavigation-list.json
```
