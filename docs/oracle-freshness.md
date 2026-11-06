# Oracle freshness: observations, policies and guarantees

**Freshness remains `UNKNOWN`.** The selected cache's timestamp behavior is established by source/runtime evidence, but no verified heartbeat or upstream maximum-age guarantee has been found.

## Four separate concepts

| Field | Meaning | Current production conclusion |
| --- | --- | --- |
| `OBSERVATION_AGE` | Pinned block timestamp minus the workflow-supplied observation timestamp | Measurable when both inputs are available; not a freshness guarantee |
| `POLICY_MAX_AGE` | Explicit local operator threshold used only to reject an observation | None by default; origin is `OPERATOR_DEFINED_LOCAL_REJECTION` when set |
| `VERIFIED_HEARTBEAT` | Evidence-backed update cadence for this exact feed/configuration | `UNKNOWN` / null |
| `UPSTREAM_FRESHNESS_GUARANTEE` | Evidence-backed maximum age promised for this exact upstream/configuration | `UNKNOWN` / null |

A recent-looking answer, a successful read, approximately hourly updates or passing a local rejection policy proves neither of the last two fields. The code never derives a heartbeat from sampled intervals. There is no silent one-hour or other default maximum age.

## What the bound implementation does

The reproduced [cache](../evidence/phase1/sources/SelfManagedFeedsCache.sol) stores `observationsTimestamp` supplied by the workflow. Its `validFromTimestamp` input is ignored. Updates whose observation timestamp is less than or equal to the stored timestamp are skipped. There is no wall-clock maximum-age check, future-timestamp rejection or automatic expiry in this cache.

The reproduced [proxy](../evidence/phase1/sources/SelfManagedFeedsCacheProxy.sol) reports the same stored timestamp as `startedAt` and `updatedAt`, uses zero round IDs and rejects historical round getters. Consequently, `updatedAt` is not the transaction's publication timestamp or a proof of when an external market was observed.

The reproduced [Morpho feed library](../evidence/phase1/sources/verified-ChainlinkDataFeedLib.sol) rejects negative answers but does not enforce freshness. The local reader/evaluator additionally rejects zero/invalid prices and timestamp anomalies. Old answers may remain readable on-chain indefinitely under this implementation.

See [architecture](oracle-architecture.md) for exact chain/address/runtime bindings and compiler evidence. These behavioral findings apply to the reviewed runtime; a changed implementation invalidates that binding.

## Historical observations

Reference block **21864844**, hash **`0x34bed88e5dcc0890c2087cc2f2c7f71a484e74bd7a140cb5f8449c4196a61f8b`**, timestamp **1793553649**. The latest stored observation is **1793550276**, so the observation age is **3373 seconds** at that block. This is an arithmetic fact at the historical anchor, not a current-age claim.

| Sample | Publication block | Observation time | Publication time | Observed delay |
| --- | --- | --- | --- | --- |
| Latest sampled update | 21861577 | 1793550276 | 1793550295 | 19 seconds |
| Earlier sampled update | 21858258 | 1793546675 | 1793546695 | 20 seconds |

- Latest tx: `0x6f1979b3b875f70f333fd349625af81098cf78d37edf60eef971f1458176a061`; block hash `0x7bdfa6f9c98b287f61eddc89555d798ca606df19b221214a1a1a5b5eefef1423`; answer `1106203549076968373`.
- Earlier tx: `0x06283aad1d351d4bcad34a8a8fa7d1dc138674642e3ce968c0692299693cd849`; block hash `0x3f51a0e668cd427896ff7477f597b73be69908e1185b7e5abb5c1f025ae538b0`; answer `1106195893489863929`.

The observation interval is **3601 seconds**. Earlier retained observations showed **3603/3600 seconds**. Those are samples, not an SLA, verified heartbeat, maximum update latency, failure-detection guarantee or proof of economic correctness. The source of the claimed observation time remains an upstream trust assumption.

The [oracle CLI smoke record](../evidence/phase4/oracle-smoke.json) identifies the new live and historical bundles and their retrieval times. The two development audit bundles are superseded for current assurance use because of snapshot serialization binding errors, even though their archived public reads remain useful for explicitly labeled offline replay. Exact dispositions are in [the report](phase4-report.md).

## Local rejection and anomalies

`analyzeFreshness` in `src/oracle-assurance/freshness.ts` detects `ZERO_TIMESTAMP`, `FUTURE_TIMESTAMP`, `TIMESTAMP_REGRESSION` and `TIMESTAMP_MISMATCH`. It compares the previous observation only within the correct continuity scope and against the separately bound last complete baseline. A future timestamp retains a negative observation age rather than clamping it to zero.

An explicit local policy rejects only when `age > policyMaxAgeSeconds`; equality passes that local policy. Passing keeps freshness unknown without official timing evidence. A rejection makes freshness `FAILED` and the effective gate `DATA_INVALID`, suppressing recovery estimates without falsely asserting that an upstream promise was violated.

The lower-level timing model accepts a heartbeat/guarantee only with positive values and hashed `PROVEN` source/official-document evidence for the exact chain/feed, bound to the current configuration fingerprint. The production evaluator provides neither value because the necessary evidence is absent. Persisted schemas reject unsupported `VERIFIED` freshness claims.

Unavailable timestamps stay unavailable. A source failure never advances a timestamp or converts an old value into a current one. Observation restoration and dimension improvements can produce alerts, but neither clears configuration invalidation nor establishes actionability.

## Evidence needed to resolve freshness

The open questions are the exact feed-ID/workflow product mapping; independently attributable operator documentation for that product; its observation timestamp definition; its heartbeat and maximum-age/failure behavior; and proof that those terms apply to the selected configuration. A monitoring interval, local policy or differently named feed cannot answer these questions.
