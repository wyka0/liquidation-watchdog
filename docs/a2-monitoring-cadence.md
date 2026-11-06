# A2 — Five-minute monitoring cadence

**Status: approved target, configured and verified locally only.** The proposed PostgreSQL scheduler interval is **300 seconds (5 minutes)**. No external scheduler is enabled, and no Neon, Render or Cloudflare resource exists. A3 provisioning remains separately gated.

## 1. One configuration source

`WATCHDOG_SCHEDULER_SLOT_SECONDS` is the single documented scheduler-cadence input. `postgresConfiguration()` reads and validates it during explicit `start:postgres` startup and stores the parsed integer as `PostgresConfiguration.slotPeriodSeconds`. If the variable is omitted, the approved A2 default is **300** (`SLOT_PERIOD_DEFAULT_SECONDS`). The parsed value is passed unchanged to:

- monitoring status configuration;
- UTC slot/body validation;
- scheduler runner and HTTP boundary;
- PostgreSQL duplicate/overlap admission and missed-slot arithmetic; and
- the public `schedule.periodSeconds`/`schedule.utcMinutes` status projection.

There is no independent interval constant in those components. The startup parser rejects noncanonical, zero, negative, fractional, exponential, sub-cycle-budget or off-grid values. An accepted value must be a positive whole-minute interval that divides one hour, be at least the existing bounded 240-second cycle budget, and be no greater than 3,600 seconds. The approved/default value produces UTC slots at minutes **00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50 and 55**.

The persisted `schedule='morpho-30m-v1'` string remains as the frozen Phase 10 database/identity lineage label. It is not used to calculate cadence. Changing that historical constraint would require a database migration, which A2 explicitly does not authorize.

## 2. Safety invariants unchanged

A shorter target interval changes only eligible scheduler slots. It does **not** change:

- observation freshness limit: **600 seconds**; an observation older than 600 seconds remains stale;
- oracle assurance: **UNVERIFIED**;
- freshness status: **UNKNOWN** until independently verified;
- `actionable: false`;
- exact BigInt financial calculations;
- warning/critical/recovery thresholds (1.30 / 1.10 / 1.25 / 1.00);
- chain ID **1672**;
- Pharos RPC/MCP endpoints; or
- the 240-second cycle, 300-second job, 360-second lease and 420-second HTTP bounds.

Five minutes is less than the 600-second age limit, but that relationship is not a freshness guarantee. Provider latency, a rejected observation, process startup, a missed trigger, quota exhaustion or an outage can leave the last accepted observation stale.

## 3. Scheduler assumptions and execution behavior

The design assumes a future external UTC scheduler sends one authenticated `POST /internal/monitor/run` for the current five-minute slot. This phase neither provisions nor activates that scheduler.

- **No overlap:** one database-wide fenced lease owns monitoring. The next invocation cannot start another cycle while the lease is live, even when HTTP requests overlap.
- **Duplicate invocation:** deterministic identity remains bound to `(namespace, frozen schedule lineage, slot)`. Concurrent duplicates converge on one `ACQUIRED` execution plus `IN_PROGRESS`, and later duplicates return the original durable receipt.
- **Delayed invocation:** database time, not host time, controls admission. The pre-existing bounded late-admission window remains 600 seconds. A late request is still subject to the non-regressing high-water mark and the global lease.
- **Missed invocation:** no timer inside the service creates work and no synthetic/catch-up observation is invented. A later admitted slot records the count of skipped five-minute slots; only a real completed provider read can persist an observation.
- **Failure/restart:** failed jobs publish a bound failed receipt; killed/expired owners are interrupted and fenced; lost acknowledgments resolve by durable identity; ambiguous notification attempts remain sticky. A later eligible slot may recover safely without replaying a completed slot.

## 4. Best-effort, not guaranteed

The target means **up to one attempted cycle per five-minute UTC slot** when the external scheduler, runtime, database and providers are all available. It does not promise:

- exactly twelve successful observations per hour;
- uninterrupted monitoring;
- provider data generated within the same slot;
- a fresh accepted observation every five minutes;
- delivery of every notification within five minutes; or
- production service-level availability.

The Phase 9 Free-tier findings remain material: Render Free may sleep after inbound idle time, cold starts consume part of the slot, CPU/memory are constrained, processes can restart, and the filesystem is ephemeral. More frequent triggers increase database wakes, compute, egress and quota pressure. Actual five-minute behavior, quota headroom and host/proxy timeouts are unmeasured until A3 resources and A6 finite host testing are separately approved. If those limits cannot sustain the target, the system must report missed/stale state rather than weakening safety labels.

## 5. Local verification

Local tests verify the 300-second default and status projection; invalid interval rejection; the twelve-slot five-minute UTC grid; bounded execution; concurrent duplicate/overlap prevention; skipped-slot counts without false observations; 601-second stale behavior with UNVERIFIED/UNKNOWN and `actionable:false`; failed-cycle recovery; lost-acknowledgment reconciliation; immediate PostgreSQL restart; and real killed-child recovery. Existing risk/threshold/freshness tests remain unchanged.

**Stopping point:** A2 local configuration complete. No provisioning, deployment, scheduler activation, migration or real notification is authorized before A3 and later approvals.
