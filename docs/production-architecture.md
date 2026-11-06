# Production architecture — Phase 5

**Decision:** one dedicated Node.js worker, one host and one local SQLite database. An external supervisor owns process restart and log rotation. Operational inspection is a local CLI; there is no inbound HTTP service.

The verified development runtime is **Node v24.14.1 / SQLite 3.51.2 on Windows**. The production profile requires those exact Node/SQLite versions. The application version remains `0.1.0`; the broader `engines.node >=22.18.0` range is a compatibility declaration, not the verified production matrix.

## Process and data flow

```text
External supervisor
  -> one Node worker
       -> fixed RPC + hosted MCP, paced read-only requests
       -> block/identity/consistency validation
       -> existing accounting + indicative risk + oracle assurance
       -> SQLite transaction: state + cycle + fingerprints + alerts + outbox
       -> bounded console / explicitly enabled notification adapters

Operator CLI -> read-only database diagnostics
Backup CLI   -> SQLite online backup -> hashed evidence bundle -> isolated restore check
```

All chain access remains fixed to chain **1672**, RPC `https://rpc.pharos.xyz` and MCP `https://mcp.pharos.xyz/mcp`. Both paths share an upstream. Their agreement is not independent consensus. Endpoint, chain, position, runtime-hash and financial-policy changes require separate review; environment overrides are unsupported.

## Ownership and availability

- A separate `<database>-monitor-lock` SQLite connection holds an exclusive OS-managed transaction while a worker or maintenance owner writes. Competing writable opens fail before initialization or migration. Read-only status, health and backup connections remain available.
- SQLite is the authoritative state/outbox store. Local filesystem locks coordinate cooperating processes on this host; this is not a distributed lease. Multiple replicas, shared network volumes and parallel monitors against one database are unsupported.
- The worker uses an awaited scheduler, not overlapping intervals. A 60-second interval is measured after completion and may grow under failure backoff or notification dispatch. It is not a timeliness SLA.
- A host outage is a monitoring outage. Recovery restarts from durable accepted state and pending work; failover must first fence the old writer. A second simultaneously active host can duplicate alerts even with a copied database.
- Process health, operational readiness, oracle assurance and financial actionability are distinct outputs. A recently stopped clean worker may be operationally ready for another bounded observation while `monitorRunning=false`.

## Filesystem layout for a proposed host

| Location | Owner / mutability | Purpose |
| --- | --- | --- |
| Versioned release directory | Deployment administrator; worker read-only | `dist/`, runtime dependencies, package lock, configuration examples, reviewed source/evidence |
| `/etc/liquidation-watchdog/` | Administrator; worker read-only | Reviewed non-secret JSON and privately injected notification environment |
| `/var/lib/liquidation-watchdog/` | Dedicated worker; private writable directory | Main database, WAL/SHM and ownership sidecars |
| Separate backup area | Backup operator; exclusive destinations | Verified consistent database and all referenced evidence |
| Supervisor log store | Supervisor; bounded rotation | Sanitized stdout/stderr |
| Isolated recovery area | Recovery operator; private | Disposable `restore-verify` copies and separately approved recovery candidates |

Use ordinary local paths without symlinks/junctions, hardlink aliases, UNC/network paths, URI paths or parent traversal. Backups and runtime state are excluded from Git. The database directory needs create/write/delete permissions for SQLite sidecars; file-only write access is insufficient. POSIX file modes are advisory on Windows: validate inherited ACLs on the actual host.

The reference unit is [liquidation-watchdog.service.example](../deploy/liquidation-watchdog.service.example). Its worker can write only the database directory. Explicit evidence captures and backups should run as separately controlled operator commands with access to their designated destinations.

## Platform evaluation

| Model | Assessment |
| --- | --- |
| Dedicated Linux host + systemd | Preferred operational model after host acceptance: explicit SIGTERM grace, restart budget, memory/process limits and centralized logging. The example has not been installed or tested on Linux. |
| Windows foreground / service wrapper | This phase verified local Windows SQLite and real forced-process recovery. A chosen service wrapper must demonstrate graceful console-signal delivery, bounded stop and ACLs. Task termination alone is a crash, not graceful shutdown. |
| Container | Feasible only with one replica, a persistent local volume, non-root ownership, fixed runtime image digest, sufficient stop grace and off-container backups. Ephemeral container storage is unsuitable. No image was built or deployed in this phase. |
| Serverless / autoscaled web service | Poor fit for persistent single-writer ownership, durable outbox and long-lived scheduling. |

## Capacity and trust boundaries

Start host sizing evaluation at one dedicated vCPU, at least 2 GiB RAM and enough durable storage for the 4 GiB database ceiling, WAL, reviewed evidence, logs, recovery scratch and multiple backups. This is a proposed baseline, not measured production capacity. The application checks RSS at cycle boundaries; the supervisor provides the independent hard ceiling. See [resource settings](environment-variables.md#resource-settings) and [reliability verification](reliability-testing.md).

Oracle economics/operators remain **UNVERIFIED**, freshness **UNKNOWN**, and every estimate **indicative / actionable: false**. This architecture does not resolve those evidence gaps. [Release readiness](release-readiness.md) records the separate approval and host-acceptance gates.
